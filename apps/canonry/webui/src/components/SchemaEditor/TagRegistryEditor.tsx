/**
 * TagRegistryEditor - Edit tag registry (tags with metadata)
 *
 * This is the authoritative place to define tags.
 * Tags can be referenced by templates, regions, and profiles.
 */

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  ExpandableCard,
  SectionHeader,
  EmptyState,
  NumberInput,
  useExpandSet,
} from "@the-canonry/shared-components";
import { ToolUsageBadges as UsageBadges } from "@the-canonry/shared-components";
import type { SchemaUsage } from "@the-canonry/shared-components";
import "./schema-editor-shared.css";
import "./TagRegistryEditor.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CategoryColor {
  bg: string;
  color: string;
}

type TagCategory = "status" | "trait" | "affiliation" | "behavior" | "theme" | "location" | "system";
type TagRarity = "common" | "uncommon" | "rare" | "legendary";

interface TagEntry {
  tag: string;
  category: TagCategory;
  rarity: TagRarity;
  description?: string;
  usageCount?: number;
  templates?: string[];
  entityKinds?: string[];
  minUsage?: number;
  maxUsage?: number;
  relatedTags?: string[];
  conflictingTags?: string[];
  isAxis?: boolean;
  isFramework?: boolean;
  consolidateInto?: string;
}

interface EntityKindRef {
  kind: string;
  description?: string;
}

interface TagUsageMap {
  [tagId: string]: Record<string, number>;
}

interface TagRegistryEditorProps {
  tagRegistry?: TagEntry[];
  entityKinds?: EntityKindRef[];
  onChange: (tags: TagEntry[]) => void;
  tagUsage?: TagUsageMap;
}

interface TagIdInputProps {
  value: string;
  onChange: (newId: string) => void;
  allTagIds: string[];
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<TagCategory, CategoryColor> = {
  status: { bg: "rgba(34, 197, 94, 0.2)", color: "#22c55e" },
  trait: { bg: "rgba(59, 130, 246, 0.2)", color: "#3b82f6" },
  affiliation: { bg: "rgba(168, 85, 247, 0.2)", color: "#a855f7" },
  behavior: { bg: "rgba(249, 115, 22, 0.2)", color: "#f97316" },
  theme: { bg: "rgba(236, 72, 153, 0.2)", color: "#ec4899" },
  location: { bg: "rgba(20, 184, 166, 0.2)", color: "#14b8a6" },
  system: { bg: "rgba(148, 163, 184, 0.2)", color: "#94a3b8" },
};

const RARITY_COLORS: Record<TagRarity, CategoryColor> = {
  common: { bg: "rgba(156, 163, 175, 0.2)", color: "#9ca3af" },
  uncommon: { bg: "rgba(34, 197, 94, 0.2)", color: "#22c55e" },
  rare: { bg: "rgba(59, 130, 246, 0.2)", color: "#3b82f6" },
  legendary: { bg: "rgba(251, 191, 36, 0.2)", color: "#fbbf24" },
};

const CATEGORIES: TagCategory[] = ["status", "trait", "affiliation", "behavior", "theme", "location", "system"];
const RARITIES: TagRarity[] = ["common", "uncommon", "rare", "legendary"];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TagIdInput({ value, onChange, allTagIds, disabled }: TagIdInputProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newId = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setLocalValue(newId);
  }, []);

  const handleBlur = useCallback(() => {
    if (localValue && localValue !== value && !allTagIds.includes(localValue)) {
      onChange(localValue);
    } else if (!localValue || allTagIds.includes(localValue)) {
      setLocalValue(value);
    }
  }, [localValue, value, allTagIds, onChange]);

  return (
    <input
      className="input tre-monospace"
      value={localValue}
      disabled={disabled}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="tag_id"
    />
  );
}

// ---------------------------------------------------------------------------
// Tag card header helpers (pure render functions)
// ---------------------------------------------------------------------------

function TagTitle({ tag }: { tag: TagEntry }) {
  return <span className="tre-monospace">{tag.tag}</span>;
}

interface TagActionsProps {
  tag: TagEntry;
  catColor: CategoryColor;
  rarColor: CategoryColor;
  isFramework: boolean;
  tagUsage: TagUsageMap;
}

function TagActions({ tag, catColor, rarColor, isFramework, tagUsage }: TagActionsProps) {
  return (
    <>
      <span className="badge tre-badge-dynamic" style={{ '--tre-badge-bg': catColor.bg, '--tre-badge-color': catColor.color } as React.CSSProperties}>
        {tag.category}
      </span>
      <span className="badge tre-badge-dynamic" style={{ '--tre-badge-bg': rarColor.bg, '--tre-badge-color': rarColor.color } as React.CSSProperties}>
        {tag.rarity}
      </span>
      {tag.isAxis && (
        <span
          className="badge tre-badge-dynamic"
          style={{ '--tre-badge-bg': 'rgba(34, 211, 238, 0.2)', '--tre-badge-color': '#22d3ee' } as React.CSSProperties}
        >
          ↔ axis
        </span>
      )}
      {isFramework && <span className="badge badge-info">framework</span>}
      {tagUsage[tag.tag] && <UsageBadges usage={tagUsage[tag.tag]} compact />}
      <span className="text-muted text-small">
        {tag.minUsage || 0}-{tag.maxUsage || "\u221E"} | {(tag.entityKinds || []).length} kinds
      </span>
    </>
  );
}

// ---------------------------------------------------------------------------
// TagDetailPanel - expanded body for a single tag
// ---------------------------------------------------------------------------

interface TagDetailPanelProps {
  tag: TagEntry;
  isFramework: boolean;
  allTagNames: string[];
  entityKinds: EntityKindRef[];
  onUpdateTag: (tagId: string, updates: Partial<TagEntry>) => void;
  onDeleteTag: (tagId: string) => void;
  onTagIdChange: (oldId: string, newId: string) => void;
  onEntityKindToggle: (tag: TagEntry, ek: EntityKindRef, isFramework: boolean) => void;
  onRemoveRelatedTag: (tagId: string, relatedTag: string) => void;
  onRemoveConflictingTag: (tagId: string, conflictingTag: string) => void;
}

function TagDetailPanel({
  tag,
  isFramework,
  allTagNames,
  entityKinds,
  onUpdateTag,
  onDeleteTag,
  onTagIdChange,
  onEntityKindToggle,
  onRemoveRelatedTag,
  onRemoveConflictingTag,
}: TagDetailPanelProps) {
  const handleCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => onUpdateTag(tag.tag, { category: e.target.value as TagCategory }),
    [onUpdateTag, tag.tag],
  );
  const handleRarityChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => onUpdateTag(tag.tag, { rarity: e.target.value as TagRarity }),
    [onUpdateTag, tag.tag],
  );
  const handleAxisChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdateTag(tag.tag, { isAxis: e.target.checked }),
    [onUpdateTag, tag.tag],
  );
  const handleDescChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdateTag(tag.tag, { description: e.target.value }),
    [onUpdateTag, tag.tag],
  );
  const handleMinChange = useCallback(
    (v: number | undefined) => onUpdateTag(tag.tag, { minUsage: v ?? 0 }),
    [onUpdateTag, tag.tag],
  );
  const handleMaxChange = useCallback(
    (v: number | undefined) => onUpdateTag(tag.tag, { maxUsage: v ?? 50 }),
    [onUpdateTag, tag.tag],
  );
  const handleConsolidateChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => onUpdateTag(tag.tag, { consolidateInto: e.target.value || undefined }),
    [onUpdateTag, tag.tag],
  );
  const handleTagIdChangeLocal = useCallback(
    (newId: string) => onTagIdChange(tag.tag, newId),
    [onTagIdChange, tag.tag],
  );
  const handleDelete = useCallback(
    () => onDeleteTag(tag.tag),
    [onDeleteTag, tag.tag],
  );

  const otherTagNames = useMemo(
    () => allTagNames.filter((t) => t !== tag.tag),
    [allTagNames, tag.tag],
  );

  const handleAddRelated = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!e.target.value) return;
      const current = tag.relatedTags || [];
      if (!current.includes(e.target.value)) {
        onUpdateTag(tag.tag, { relatedTags: [...current, e.target.value] });
      }
      e.target.value = "";
    },
    [onUpdateTag, tag.tag, tag.relatedTags],
  );

  const handleAddConflicting = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!e.target.value) return;
      const current = tag.conflictingTags || [];
      if (!current.includes(e.target.value)) {
        onUpdateTag(tag.tag, { conflictingTags: [...current, e.target.value] });
      }
      e.target.value = "";
    },
    [onUpdateTag, tag.tag, tag.conflictingTags],
  );

  const availableRelated = useMemo(
    () => otherTagNames.filter((t) => !(tag.relatedTags || []).includes(t)),
    [otherTagNames, tag.relatedTags],
  );

  const availableConflicting = useMemo(
    () => otherTagNames.filter((t) => !(tag.conflictingTags || []).includes(t)),
    [otherTagNames, tag.conflictingTags],
  );

  return (
    <>
      {/* Basic Info Row */}
      <div className="tre-basic-row">
        <div className="tre-field-id">
          <div className="label tre-label-gap">Tag ID</div>
          <TagIdInput
            value={tag.tag}
            allTagIds={otherTagNames}
            disabled={isFramework}
            onChange={handleTagIdChangeLocal}
          />
        </div>
        <div>
          <div className="label tre-label-gap">Category</div>
          <select
            className="input se-select-compact"
            value={tag.category}
            onChange={handleCategoryChange}
            disabled={isFramework}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="label tre-label-gap">Rarity</div>
          <select
            className="input se-select-compact"
            value={tag.rarity}
            onChange={handleRarityChange}
            disabled={isFramework}
          >
            {RARITIES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="tre-axis-group">
          <label className="tre-axis-label">
            <input
              type="checkbox"
              checked={tag.isAxis || false}
              disabled={isFramework}
              onChange={handleAxisChange}
              className="se-checkbox-sm"
            />
            <span className="text-small">Axis</span>
          </label>
        </div>
      </div>

      {/* Description */}
      <div className="tre-description-wrapper">
        <textarea
          className="input tre-textarea"
          value={tag.description || ""}
          disabled={isFramework}
          onChange={handleDescChange}
          placeholder="Description..."
        />
      </div>

      {/* Usage Limits */}
      <div className="tre-usage-row">
        <span className="text-small text-muted">Usage:</span>
        <div className="tre-usage-inputs">
          <NumberInput
            className="input tre-usage-number"
            min={0}
            value={tag.minUsage || 0}
            disabled={isFramework}
            onChange={handleMinChange}
            integer
          />
          <span className="text-small text-muted">&ndash;</span>
          <NumberInput
            className="input tre-usage-number"
            min={0}
            value={tag.maxUsage || 50}
            disabled={isFramework}
            onChange={handleMaxChange}
            integer
          />
        </div>
        <span className="text-small text-muted tre-merge-label">Merge &rarr;</span>
        <select
          className="input tre-merge-select"
          value={tag.consolidateInto || ""}
          disabled={isFramework}
          onChange={handleConsolidateChange}
        >
          <option value="">none</option>
          {otherTagNames.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Tag Relationships - 3 columns */}
      <div className="nested-section-compact">
        <div className="tre-grid-3col">
          {/* Entity Kinds */}
          <EntityKindChips
            tag={tag}
            entityKinds={entityKinds}
            isFramework={isFramework}
            onToggle={onEntityKindToggle}
          />

          {/* Related Tags */}
          <div>
            <div className="label tre-section-label">Related</div>
            <div className="chip-list viewer-section">
              {(tag.relatedTags || []).map((relatedTag) => (
                <div key={relatedTag} className="chip tre-chip-compact">
                  <span>{relatedTag}</span>
                  <button
                    className="chip-remove tre-chip-remove-sm"
                    onClick={() => onRemoveRelatedTag(tag.tag, relatedTag)}
                    disabled={isFramework}
                  >
                    &times;
                  </button>
                </div>
              ))}
              {!isFramework && (
                <select className="input tre-add-select" value="" onChange={handleAddRelated}>
                  <option value="">+ add</option>
                  {availableRelated.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Conflicting Tags */}
          <div>
            <div className="label tre-conflicts-label">Conflicts</div>
            <div className="chip-list viewer-section">
              {(tag.conflictingTags || []).map((conflictingTag) => (
                <div key={conflictingTag} className="chip tre-chip-conflict">
                  <span>{conflictingTag}</span>
                  <button
                    className="chip-remove tre-chip-remove-sm"
                    onClick={() => onRemoveConflictingTag(tag.tag, conflictingTag)}
                    disabled={isFramework}
                  >
                    &times;
                  </button>
                </div>
              ))}
              {!isFramework && (
                <select className="input tre-add-select" value="" onChange={handleAddConflicting}>
                  <option value="">+ add</option>
                  {availableConflicting.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete */}
      <div className="danger-zone">
        <button className="btn btn-danger" onClick={handleDelete} disabled={isFramework}>
          Delete Tag
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// EntityKindChips sub-component
// ---------------------------------------------------------------------------

interface EntityKindChipsProps {
  tag: TagEntry;
  entityKinds: EntityKindRef[];
  isFramework: boolean;
  onToggle: (tag: TagEntry, ek: EntityKindRef, isFramework: boolean) => void;
}

function EntityKindChips({ tag, entityKinds, isFramework, onToggle }: EntityKindChipsProps) {
  return (
    <div>
      <div className="label tre-section-label">Applies to</div>
      <div className="chip-list viewer-section">
        {entityKinds.map((ek) => {
          const isSelected = (tag.entityKinds || []).includes(ek.kind);
          return (
            <div
              key={ek.kind}
              className={`chip chip-clickable ${isSelected ? "chip-active" : ""} ${isFramework ? "se-chip-framework" : "tre-chip-compact"}`}
              onClick={() => onToggle(tag, ek, isFramework)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
            >
              {ek.description || ek.kind}
            </div>
          );
        })}
      </div>
      {(tag.entityKinds || []).length === 0 && (
        <span className="text-small text-muted">all kinds</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TagRegistryEditor({
  tagRegistry = [],
  entityKinds = [],
  onChange,
  tagUsage = {},
}: TagRegistryEditorProps) {
  const { expanded: expandedTags, toggle: toggleTag, set: setExpandedTags } = useExpandSet();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | TagCategory>("all");
  const [rarityFilter, setRarityFilter] = useState<"all" | TagRarity>("all");

  // Compute stats
  const stats = useMemo(() => {
    const byCategory: Record<string, number> = {};
    const byRarity: Record<string, number> = {};
    CATEGORIES.forEach((c) => (byCategory[c] = 0));
    RARITIES.forEach((r) => (byRarity[r] = 0));
    tagRegistry.forEach((tag) => {
      byCategory[tag.category] = (byCategory[tag.category] || 0) + 1;
      byRarity[tag.rarity] = (byRarity[tag.rarity] || 0) + 1;
    });
    return { total: tagRegistry.length, byCategory, byRarity };
  }, [tagRegistry]);

  // Filter tags
  const filteredTags = useMemo(() => {
    return tagRegistry.filter((tag) => {
      const matchesSearch =
        !searchQuery ||
        tag.tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tag.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === "all" || tag.category === categoryFilter;
      const matchesRarity = rarityFilter === "all" || tag.rarity === rarityFilter;
      return matchesSearch && matchesCategory && matchesRarity;
    });
  }, [tagRegistry, searchQuery, categoryFilter, rarityFilter]);

  const allTagNames = useMemo(() => tagRegistry.map((t) => t.tag), [tagRegistry]);

  const addTag = useCallback(() => {
    const newTag: TagEntry = {
      tag: `new_tag_${Date.now()}`,
      category: "trait",
      rarity: "common",
      description: "New tag description",
      usageCount: 0,
      templates: [],
      entityKinds: [],
      minUsage: 1,
      maxUsage: 50,
      relatedTags: [],
      conflictingTags: [],
    };
    onChange([newTag, ...tagRegistry]);
    setExpandedTags((prev) => {
      const next = new Set(prev);
      next.add(newTag.tag);
      return next;
    });
  }, [onChange, tagRegistry, setExpandedTags]);

  const updateTag = useCallback((tagId: string, updates: Partial<TagEntry>) => {
    const existing = tagRegistry.find((t) => t.tag === tagId);
    if (existing?.isFramework) return;
    onChange(tagRegistry.map((t) => (t.tag === tagId ? { ...t, ...updates } : t)));
  }, [tagRegistry, onChange]);

  const deleteTag = useCallback((tagId: string) => {
    const existing = tagRegistry.find((t) => t.tag === tagId);
    if (existing?.isFramework) return;
    if (confirm("Delete this tag? This cannot be undone.")) {
      onChange(tagRegistry.filter((t) => t.tag !== tagId));
    }
  }, [tagRegistry, onChange]);

  const removeRelatedTag = useCallback((tagId: string, relatedTag: string) => {
    const tag = tagRegistry.find((t) => t.tag === tagId);
    if (!tag) return;
    updateTag(tagId, { relatedTags: (tag.relatedTags || []).filter((r) => r !== relatedTag) });
  }, [tagRegistry, updateTag]);

  const removeConflictingTag = useCallback((tagId: string, conflictingTag: string) => {
    const tag = tagRegistry.find((t) => t.tag === tagId);
    if (!tag) return;
    updateTag(tagId, {
      conflictingTags: (tag.conflictingTags || []).filter((c) => c !== conflictingTag),
    });
  }, [tagRegistry, updateTag]);

  const handleTagIdChange = useCallback((oldId: string, newId: string) => {
    const updatedRegistry = tagRegistry.map((t) => {
      if (t.tag === oldId) return { ...t, tag: newId };
      const updated = { ...t };
      if (t.relatedTags?.includes(oldId)) {
        updated.relatedTags = t.relatedTags.map((r) => (r === oldId ? newId : r));
      }
      if (t.conflictingTags?.includes(oldId)) {
        updated.conflictingTags = t.conflictingTags.map((c) => (c === oldId ? newId : c));
      }
      return updated;
    });
    setExpandedTags((prev) => {
      const next = new Set(prev);
      if (next.has(oldId)) {
        next.delete(oldId);
        next.add(newId);
      }
      return next;
    });
    onChange(updatedRegistry);
  }, [tagRegistry, onChange, setExpandedTags]);

  const handleEntityKindToggle = useCallback((tag: TagEntry, ek: EntityKindRef, isFramework: boolean) => {
    if (isFramework) return;
    const isSelected = (tag.entityKinds || []).includes(ek.kind);
    const current = tag.entityKinds || [];
    const updated = isSelected
      ? current.filter((k) => k !== ek.kind)
      : [...current, ek.kind];
    updateTag(tag.tag, { entityKinds: updated });
  }, [updateTag]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value),
    [],
  );
  const handleCategoryFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => setCategoryFilter(e.target.value as "all" | TagCategory),
    [],
  );
  const handleRarityFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => setRarityFilter(e.target.value as "all" | TagRarity),
    [],
  );

  return (
    <div className="editor-container tre-container">
      <SectionHeader
        title="Tag Registry"
        description="Define tags that categorize entities. Tags provide governance through usage limits, relationships, and conflicts."
      />

      {/* Stats Bar */}
      <div className="tre-stats-bar">
        <span className="text-small tre-stat-total">
          <strong>{stats.total}</strong> tags
        </span>
        {CATEGORIES.filter((cat) => stats.byCategory[cat] > 0).map((cat) => (
          <span
            key={cat}
            className="text-small tre-stat-category"
            style={{
              '--tre-stat-bg': CATEGORY_COLORS[cat].bg,
              '--tre-stat-color': CATEGORY_COLORS[cat].color,
            } as React.CSSProperties}
          >
            {stats.byCategory[cat]} {cat}
          </span>
        ))}
      </div>

      {/* Toolbar */}
      <div className="tre-toolbar">
        <input
          className="input tre-search"
          type="text"
          placeholder="Search tags..."
          value={searchQuery}
          onChange={handleSearchChange}
        />
        <select className="input" value={categoryFilter} onChange={handleCategoryFilterChange}>
          <option value="all">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select className="input" value={rarityFilter} onChange={handleRarityFilterChange}>
          <option value="all">All Rarities</option>
          {RARITIES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <span className="text-muted">
          {filteredTags.length} of {tagRegistry.length} tags
        </span>
        <button className="btn btn-primary" onClick={addTag}>
          + Add Tag
        </button>
      </div>

      {tagRegistry.length === 0 && (
        <EmptyState icon="&#x1F3F7;&#xFE0F;" title="No tags defined" description="Add one to get started." />
      )}
      {tagRegistry.length > 0 && filteredTags.length === 0 && (
        <EmptyState icon="&#x1F50D;" title="No matches" description="No tags match your filters." />
      )}
      {filteredTags.length > 0 && (
        <div className="list-stack">
          {filteredTags.map((tag) => {
            const isExpanded = expandedTags.has(tag.tag);
            const catColor = CATEGORY_COLORS[tag.category] || CATEGORY_COLORS.trait;
            const rarColor = RARITY_COLORS[tag.rarity] || RARITY_COLORS.common;
            const isFramework = Boolean(tag.isFramework);

            return (
              <ExpandableCard
                key={tag.tag}
                expanded={isExpanded}
                onToggle={toggleTag}
                toggleId={tag.tag}
                title={<TagTitle tag={tag} />}
                actions={
                  <TagActions
                    tag={tag}
                    catColor={catColor}
                    rarColor={rarColor}
                    isFramework={isFramework}
                    tagUsage={tagUsage}
                  />
                }
              >
                <TagDetailPanel
                  tag={tag}
                  isFramework={isFramework}
                  allTagNames={allTagNames}
                  entityKinds={entityKinds}
                  onUpdateTag={updateTag}
                  onDeleteTag={deleteTag}
                  onTagIdChange={handleTagIdChange}
                  onEntityKindToggle={handleEntityKindToggle}
                  onRemoveRelatedTag={removeRelatedTag}
                  onRemoveConflictingTag={removeConflictingTag}
                />
              </ExpandableCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
