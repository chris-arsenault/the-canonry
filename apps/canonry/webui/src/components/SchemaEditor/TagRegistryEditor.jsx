/**
 * TagRegistryEditor - Edit tag registry (tags with metadata)
 *
 * This is the authoritative place to define tags.
 * Tags can be referenced by templates, regions, and profiles.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { ExpandableCard, SectionHeader, EmptyState, NumberInput } from '@penguin-tales/shared-components';
import { ToolUsageBadges as UsageBadges } from '@penguin-tales/shared-components';

// Category colors (dynamic - keep as objects)
const CATEGORY_COLORS = {
  status: { bg: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' },
  trait: { bg: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' },
  affiliation: { bg: 'rgba(168, 85, 247, 0.2)', color: '#a855f7' },
  behavior: { bg: 'rgba(249, 115, 22, 0.2)', color: '#f97316' },
  theme: { bg: 'rgba(236, 72, 153, 0.2)', color: '#ec4899' },
  location: { bg: 'rgba(20, 184, 166, 0.2)', color: '#14b8a6' },
  system: { bg: 'rgba(148, 163, 184, 0.2)', color: '#94a3b8' },
};

// Rarity colors (dynamic - keep as objects)
const RARITY_COLORS = {
  common: { bg: 'rgba(156, 163, 175, 0.2)', color: '#9ca3af' },
  uncommon: { bg: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' },
  rare: { bg: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' },
  legendary: { bg: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24' },
};

const CATEGORIES = ['status', 'trait', 'affiliation', 'behavior', 'theme', 'location', 'system'];
const RARITIES = ['common', 'uncommon', 'rare', 'legendary'];

// Separate component for tag ID input to prevent cursor jumping
function TagIdInput({ value, onChange, allTagIds, disabled }) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e) => {
    const newId = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setLocalValue(newId);
  };

  const handleBlur = () => {
    if (localValue && localValue !== value && !allTagIds.includes(localValue)) {
      onChange(localValue);
    } else if (!localValue || allTagIds.includes(localValue)) {
      setLocalValue(value);
    }
  };

  return (
    <input
      className="input"
      style={{ fontFamily: 'monospace' }}
      value={localValue}
      disabled={disabled}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="tag_id"
    />
  );
}

export default function TagRegistryEditor({ tagRegistry = [], entityKinds = [], onChange, tagUsage = {} }) {
  const [expandedTags, setExpandedTags] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [rarityFilter, setRarityFilter] = useState('all');

  // Compute stats
  const stats = useMemo(() => {
    const byCategory = {};
    const byRarity = {};
    CATEGORIES.forEach(c => byCategory[c] = 0);
    RARITIES.forEach(r => byRarity[r] = 0);
    tagRegistry.forEach(tag => {
      byCategory[tag.category] = (byCategory[tag.category] || 0) + 1;
      byRarity[tag.rarity] = (byRarity[tag.rarity] || 0) + 1;
    });
    return { total: tagRegistry.length, byCategory, byRarity };
  }, [tagRegistry]);

  // Filter tags
  const filteredTags = useMemo(() => {
    return tagRegistry.filter(tag => {
      const matchesSearch = !searchQuery ||
        tag.tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tag.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || tag.category === categoryFilter;
      const matchesRarity = rarityFilter === 'all' || tag.rarity === rarityFilter;
      return matchesSearch && matchesCategory && matchesRarity;
    });
  }, [tagRegistry, searchQuery, categoryFilter, rarityFilter]);

  const toggleTag = (tagId) => {
    setExpandedTags((prev) => ({ ...prev, [tagId]: !prev[tagId] }));
  };

  const addTag = () => {
    const newTag = {
      tag: `new_tag_${Date.now()}`,
      category: 'trait',
      rarity: 'common',
      description: 'New tag description',
      usageCount: 0,
      templates: [],
      entityKinds: [],
      minUsage: 1,
      maxUsage: 50,
      relatedTags: [],
      conflictingTags: [],
    };
    onChange([newTag, ...tagRegistry]);
    setExpandedTags((prev) => ({ ...prev, [newTag.tag]: true }));
  };

  const updateTag = (tagId, updates) => {
    const existing = tagRegistry.find((t) => t.tag === tagId);
    if (existing?.isFramework) return;
    onChange(tagRegistry.map((t) => (t.tag === tagId ? { ...t, ...updates } : t)));
  };

  const usageNumberStyle = useMemo(
    () => ({ width: '60px', padding: '4px 6px', textAlign: 'center' }),
    []
  );

  const renderTagTitle = (tag) => (
    <span style={{ fontFamily: 'monospace' }}>{tag.tag}</span>
  );

  const renderTagActions = (tag, catColor, rarColor, isFramework) => (
    <>
      <span className="badge" style={{ backgroundColor: catColor.bg, color: catColor.color }}>
        {tag.category}
      </span>
      <span className="badge" style={{ backgroundColor: rarColor.bg, color: rarColor.color }}>
        {tag.rarity}
      </span>
      {tag.isAxis && (
        <span className="badge" style={{ backgroundColor: 'rgba(34, 211, 238, 0.2)', color: '#22d3ee' }}>
          ↔ axis
        </span>
      )}
      {isFramework && <span className="badge badge-info">framework</span>}
      {tagUsage[tag.tag] && <UsageBadges usage={tagUsage[tag.tag]} compact />}
      <span className="text-muted text-small">
        {tag.minUsage || 0}-{tag.maxUsage || '∞'} | {(tag.entityKinds || []).length} kinds
      </span>
    </>
  );

  const deleteTag = (tagId) => {
    const existing = tagRegistry.find((t) => t.tag === tagId);
    if (existing?.isFramework) return;
    if (confirm('Delete this tag? This cannot be undone.')) {
      onChange(tagRegistry.filter((t) => t.tag !== tagId));
    }
  };

  // Related tags management
  const removeRelatedTag = (tagId, relatedTag) => {
    const tag = tagRegistry.find((t) => t.tag === tagId);
    if (!tag) return;
    updateTag(tagId, { relatedTags: (tag.relatedTags || []).filter((r) => r !== relatedTag) });
  };

  // Conflicting tags management
  const removeConflictingTag = (tagId, conflictingTag) => {
    const tag = tagRegistry.find((t) => t.tag === tagId);
    if (!tag) return;
    updateTag(tagId, { conflictingTags: (tag.conflictingTags || []).filter((c) => c !== conflictingTag) });
  };

  const allTagNames = useMemo(() => tagRegistry.map(t => t.tag), [tagRegistry]);

  return (
    <div className="editor-container" style={{ maxWidth: '1100px' }}>
      <SectionHeader
        title="Tag Registry"
        description="Define tags that categorize entities. Tags provide governance through usage limits, relationships, and conflicts."
      />

      {/* Stats Bar - Compact */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <span className="text-small" style={{ padding: '4px 8px', background: 'var(--color-bg-dark)', borderRadius: '4px' }}>
          <strong>{stats.total}</strong> tags
        </span>
        {CATEGORIES.filter(cat => stats.byCategory[cat] > 0).map(cat => (
          <span
            key={cat}
            className="text-small"
            style={{
              padding: '4px 8px',
              background: CATEGORY_COLORS[cat].bg,
              color: CATEGORY_COLORS[cat].color,
              borderRadius: '4px'
            }}
          >
            {stats.byCategory[cat]} {cat}
          </span>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
        <input
          className="input"
          type="text"
          placeholder="Search tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ maxWidth: '300px' }}
        />
        <select className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">All Categories</option>
          {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <select className="input" value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value)}>
          <option value="all">All Rarities</option>
          {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <span className="text-muted">{filteredTags.length} of {tagRegistry.length} tags</span>
        <button className="btn btn-primary" onClick={addTag}>+ Add Tag</button>
      </div>

      {tagRegistry.length === 0 ? (
        <EmptyState icon="🏷️" title="No tags defined" description="Add one to get started." />
      ) : filteredTags.length === 0 ? (
        <EmptyState icon="🔍" title="No matches" description="No tags match your filters." />
      ) : (
        <div className="list-stack">
          {filteredTags.map((tag) => {
            const isExpanded = expandedTags[tag.tag];
            const catColor = CATEGORY_COLORS[tag.category] || CATEGORY_COLORS.trait;
            const rarColor = RARITY_COLORS[tag.rarity] || RARITY_COLORS.common;
            const isFramework = Boolean(tag.isFramework);

            return (
              <ExpandableCard
                key={tag.tag}
                expanded={isExpanded}
                onToggle={() => toggleTag(tag.tag)}
                title={renderTagTitle(tag)}
                actions={renderTagActions(tag, catColor, rarColor, isFramework)}
              >
                {/* Basic Info Row */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '12px' }}>
                  <div style={{ flex: '1 1 180px', minWidth: '120px' }}>
                    <div className="label" style={{ marginBottom: '4px' }}>Tag ID</div>
                    <TagIdInput
                      value={tag.tag}
                      allTagIds={allTagNames.filter(t => t !== tag.tag)}
                      disabled={isFramework}
                      onChange={(newId) => {
                        const oldId = tag.tag;
                        const updatedRegistry = tagRegistry.map(t => {
                          if (t.tag === oldId) return { ...t, tag: newId };
                          const updated = { ...t };
                          if (t.relatedTags?.includes(oldId)) {
                            updated.relatedTags = t.relatedTags.map(r => r === oldId ? newId : r);
                          }
                          if (t.conflictingTags?.includes(oldId)) {
                            updated.conflictingTags = t.conflictingTags.map(c => c === oldId ? newId : c);
                          }
                          return updated;
                        });
                        setExpandedTags(prev => {
                          const updated = { ...prev };
                          if (updated[oldId]) {
                            updated[newId] = updated[oldId];
                            delete updated[oldId];
                          }
                          return updated;
                        });
                        onChange(updatedRegistry);
                      }}
                    />
                  </div>
                  <div>
                    <div className="label" style={{ marginBottom: '4px' }}>Category</div>
                    <select
                      className="input"
                      style={{ width: 'auto', padding: '6px 10px' }}
                      value={tag.category}
                      onChange={(e) => updateTag(tag.tag, { category: e.target.value })}
                      disabled={isFramework}
                    >
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="label" style={{ marginBottom: '4px' }}>Rarity</div>
                    <select
                      className="input"
                      style={{ width: 'auto', padding: '6px 10px' }}
                      value={tag.rarity}
                      onChange={(e) => updateTag(tag.tag, { rarity: e.target.value })}
                      disabled={isFramework}
                    >
                      {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={tag.isAxis || false}
                        disabled={isFramework}
                        onChange={(e) => updateTag(tag.tag, { isAxis: e.target.checked })}
                        style={{ width: '14px', height: '14px' }}
                      />
                      <span className="text-small">Axis</span>
                    </label>
                  </div>
                </div>

                {/* Description */}
                <div style={{ marginBottom: '12px' }}>
                  <textarea
                    className="input"
                    style={{ minHeight: '50px', resize: 'vertical', padding: '8px 10px' }}
                    value={tag.description || ''}
                    disabled={isFramework}
                    onChange={(e) => updateTag(tag.tag, { description: e.target.value })}
                    placeholder="Description..."
                  />
                </div>

                {/* Usage Limits - Compact inline */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="text-small text-muted">Usage:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <NumberInput
                      className="input"
                      style={usageNumberStyle}
                      min={0}
                      value={tag.minUsage || 0}
                      disabled={isFramework}
                      onChange={(v) => updateTag(tag.tag, { minUsage: v ?? 0 })}
                      integer
                    />
                    <span className="text-small text-muted">–</span>
                    <NumberInput
                      className="input"
                      style={usageNumberStyle}
                      min={0}
                      value={tag.maxUsage || 50}
                      disabled={isFramework}
                      onChange={(v) => updateTag(tag.tag, { maxUsage: v ?? 50 })}
                      integer
                    />
                  </div>
                  <span className="text-small text-muted" style={{ marginLeft: '8px' }}>Merge →</span>
                  <select
                    className="input"
                    style={{ width: 'auto', padding: '2px 6px', fontSize: '12px' }}
                    value={tag.consolidateInto || ''}
                    disabled={isFramework}
                    onChange={(e) => updateTag(tag.tag, { consolidateInto: e.target.value || undefined })}
                  >
                    <option value="">none</option>
                    {allTagNames.filter(t => t !== tag.tag).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Consolidated Tag Relationships - 3 columns */}
                <div className="nested-section-compact">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    {/* Entity Kinds */}
                    <div>
                      <div className="label" style={{ marginBottom: '6px' }}>Applies to</div>
                      <div className="chip-list" style={{ marginBottom: '4px' }}>
                        {entityKinds.map((ek) => {
                          const isSelected = (tag.entityKinds || []).includes(ek.kind);
                          return (
                            <div
                              key={ek.kind}
                              className={`chip chip-clickable ${isSelected ? 'chip-active' : ''}`}
                              onClick={() => {
                                if (isFramework) return;
                                const current = tag.entityKinds || [];
                                const updated = isSelected
                                  ? current.filter(k => k !== ek.kind)
                                  : [...current, ek.kind];
                                updateTag(tag.tag, { entityKinds: updated });
                              }}
                              style={isFramework ? { pointerEvents: 'none', opacity: 0.6 } : { padding: '4px 8px', fontSize: '12px' }}
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

                    {/* Related Tags */}
                    <div>
                      <div className="label" style={{ marginBottom: '6px' }}>Related</div>
                      <div className="chip-list" style={{ marginBottom: '4px' }}>
                        {(tag.relatedTags || []).map((relatedTag) => (
                          <div key={relatedTag} className="chip" style={{ padding: '4px 8px', fontSize: '12px' }}>
                            <span>{relatedTag}</span>
                            <button
                              className="chip-remove"
                              onClick={() => removeRelatedTag(tag.tag, relatedTag)}
                              disabled={isFramework}
                              style={{ fontSize: '14px' }}
                            >×</button>
                          </div>
                        ))}
                        {!isFramework && (
                          <select
                            className="input"
                            style={{ width: 'auto', padding: '2px 6px', fontSize: '12px', minWidth: '80px' }}
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                const current = tag.relatedTags || [];
                                if (!current.includes(e.target.value)) {
                                  updateTag(tag.tag, { relatedTags: [...current, e.target.value] });
                                }
                              }
                            }}
                          >
                            <option value="">+ add</option>
                            {allTagNames.filter(t => t !== tag.tag && !(tag.relatedTags || []).includes(t)).map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>

                    {/* Conflicting Tags */}
                    <div>
                      <div className="label" style={{ marginBottom: '6px', color: 'var(--color-danger)' }}>Conflicts</div>
                      <div className="chip-list" style={{ marginBottom: '4px' }}>
                        {(tag.conflictingTags || []).map((conflictingTag) => (
                          <div key={conflictingTag} className="chip" style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: 'rgba(239, 68, 68, 0.2)' }}>
                            <span>{conflictingTag}</span>
                            <button
                              className="chip-remove"
                              onClick={() => removeConflictingTag(tag.tag, conflictingTag)}
                              disabled={isFramework}
                              style={{ fontSize: '14px' }}
                            >×</button>
                          </div>
                        ))}
                        {!isFramework && (
                          <select
                            className="input"
                            style={{ width: 'auto', padding: '2px 6px', fontSize: '12px', minWidth: '80px' }}
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                const current = tag.conflictingTags || [];
                                if (!current.includes(e.target.value)) {
                                  updateTag(tag.tag, { conflictingTags: [...current, e.target.value] });
                                }
                              }
                            }}
                          >
                            <option value="">+ add</option>
                            {allTagNames.filter(t => t !== tag.tag && !(tag.conflictingTags || []).includes(t)).map(t => (
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
                  <button className="btn btn-danger" onClick={() => deleteTag(tag.tag)} disabled={isFramework}>Delete Tag</button>
                </div>
              </ExpandableCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
