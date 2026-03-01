/**
 * RelationshipsTab - Configure relationships between entities
 */

import React, { useState, useMemo, useCallback } from "react";
import { ReferenceDropdown, NumberInput, useExpandBoolean } from "../../shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RelationshipKind {
  kind: string;
  description?: string;
}

interface Schema {
  relationshipKinds?: RelationshipKind[];
}

interface Condition {
  type: string;
  chance?: number;
  entity?: string;
  relationshipKind?: string;
}

interface Relationship {
  kind: string;
  src: string;
  dst: string;
  strength?: number;
  bidirectional?: boolean;
  condition?: Condition;
}

interface CreationStep {
  entityRef?: string;
}

interface SelectionConfig {
  saturationLimits?: SaturationLimit[];
}

interface Generator {
  relationships?: Relationship[];
  variables?: Record<string, unknown>;
  creation?: CreationStep[];
  selection?: SelectionConfig;
}

interface SaturationLimit {
  relationshipKind: string;
}

interface ReferenceDropdownOption {
  value: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely display a value that should be a string.
 * If it's an object, log a warning and return a fallback.
 */
function safeDisplay(value: unknown, fallback = "?", label = "value"): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") {
    console.warn(`[RelationshipsTab] Expected string for ${label} but got object:`, value);
    return `[object]`;
  }
  return String(value);
}

// Condition types supported by lore-weave runtime
const CONDITION_TYPES: ReferenceDropdownOption[] = [
  { value: "random_chance", label: "Random Chance" },
  { value: "entity_exists", label: "Entity Exists" },
  { value: "entity_has_relationship", label: "Entity Has Relationship" },
];

function buildRelKindOptions(schema: Schema | undefined): ReferenceDropdownOption[] {
  return (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));
}

function buildRefOptions(refs: string[]): ReferenceDropdownOption[] {
  return refs.map((r) => ({ value: r, label: r }));
}

// ---------------------------------------------------------------------------
// RelationshipConditionEditor
// ---------------------------------------------------------------------------

interface RelationshipConditionEditorProps {
  condition: Condition;
  onChange: (condition: Condition) => void;
  onRemove: () => void;
  availableRefs: string[];
  schema: Schema | undefined;
}

function RelationshipConditionEditor({
  condition,
  onChange,
  onRemove,
  availableRefs,
  schema,
}: RelationshipConditionEditorProps) {
  const relationshipKindOptions = useMemo(() => buildRelKindOptions(schema), [schema]);
  const refOptions = useMemo(() => buildRefOptions(availableRefs), [availableRefs]);

  const handleTypeChange = useCallback(
    (v: string | undefined) => {
      if (v === "random_chance") {
        onChange({ type: v, chance: 0 });
      } else if (v === "entity_exists") {
        onChange({ type: v, entity: "" });
      } else if (v === "entity_has_relationship") {
        onChange({ type: v, entity: "", relationshipKind: "" });
      }
    },
    [onChange],
  );

  const handleChanceChange = useCallback(
    (v: number | undefined) => onChange({ ...condition, chance: v ?? 0 }),
    [condition, onChange],
  );

  const handleEntityChange = useCallback(
    (v: string | undefined) => onChange({ ...condition, entity: v || "" }),
    [condition, onChange],
  );

  const handleRelKindChange = useCallback(
    (v: string | undefined) => onChange({ ...condition, relationshipKind: v || "" }),
    [condition, onChange],
  );

  return (
    <div className="condition-editor">
      <div className="condition-editor-header">
        <ReferenceDropdown
          value={condition.type || ""}
          onChange={handleTypeChange}
          options={CONDITION_TYPES}
          placeholder="Select condition type..."
        />
        <button className="btn-icon btn-icon-danger" onClick={onRemove}>
          ×
        </button>
      </div>

      {condition.type === "random_chance" && (
        <div className="condition-editor-body">
          <div className="form-group">
            <label className="label">Chance (0-1)
            <NumberInput
              value={condition.chance}
              onChange={handleChanceChange}
              min={0}
              max={1}
              placeholder="0.5"
            />
            </label>
          </div>
        </div>
      )}

      {condition.type === "entity_exists" && (
        <div className="condition-editor-body">
          <ReferenceDropdown
            label="Entity Reference"
            value={condition.entity || ""}
            onChange={handleEntityChange}
            options={refOptions}
            placeholder="Select entity..."
          />
        </div>
      )}

      {condition.type === "entity_has_relationship" && (
        <div className="condition-editor-body">
          <div className="form-grid">
            <ReferenceDropdown
              label="Entity Reference"
              value={condition.entity || ""}
              onChange={handleEntityChange}
              options={refOptions}
              placeholder="Select entity..."
            />
            <ReferenceDropdown
              label="Relationship Kind"
              value={condition.relationshipKind || ""}
              onChange={handleRelKindChange}
              options={relationshipKindOptions}
              placeholder="Select relationship..."
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RelationshipCardBody - Expanded body of a relationship card
// ---------------------------------------------------------------------------

interface RelationshipCardBodyProps {
  rel: Relationship;
  schema: Schema | undefined;
  availableRefs: string[];
  onUpdateField: (field: keyof Relationship, value: unknown) => void;
}

function RelationshipCardBody({ rel, schema, availableRefs, onUpdateField }: RelationshipCardBodyProps) {
  const relationshipKindOptions = useMemo(() => buildRelKindOptions(schema), [schema]);
  const refOptions = useMemo(() => buildRefOptions(availableRefs), [availableRefs]);

  const handleKindChange = useCallback(
    (v: string | undefined) => onUpdateField("kind", v),
    [onUpdateField],
  );
  const handleSrcChange = useCallback(
    (v: string | undefined) => onUpdateField("src", v),
    [onUpdateField],
  );
  const handleDstChange = useCallback(
    (v: string | undefined) => onUpdateField("dst", v),
    [onUpdateField],
  );
  const handleStrengthChange = useCallback(
    (v: number | undefined) => onUpdateField("strength", v),
    [onUpdateField],
  );
  const handleBidirectionalToggle = useCallback(
    () => onUpdateField("bidirectional", !rel.bidirectional),
    [rel.bidirectional, onUpdateField],
  );
  const handleConditionChange = useCallback(
    (updated: Condition) => onUpdateField("condition", updated),
    [onUpdateField],
  );
  const handleConditionRemove = useCallback(
    () => onUpdateField("condition", undefined),
    [onUpdateField],
  );
  const handleAddCondition = useCallback(
    () => onUpdateField("condition", { type: "" }),
    [onUpdateField],
  );

  return (
    <div className="item-card-body">
      <div className="form-grid">
        <ReferenceDropdown
          label="Relationship Kind"
          value={rel.kind}
          onChange={handleKindChange}
          options={relationshipKindOptions}
        />
        <ReferenceDropdown
          label="Source"
          value={rel.src}
          onChange={handleSrcChange}
          options={refOptions}
        />
        <ReferenceDropdown
          label="Destination"
          value={rel.dst}
          onChange={handleDstChange}
          options={refOptions}
        />
        <div className="form-group">
          <label className="label">Strength
          <NumberInput
            value={rel.strength}
            onChange={handleStrengthChange}
            min={0}
            max={1}
            allowEmpty
            placeholder="0.8"
          />
          </label>
        </div>
      </div>

      <div className="mt-xl">
        <span className="label">Bidirectional</span>
        <div className="toggle-container">
          <div
            onClick={handleBidirectionalToggle}
            className={`toggle ${rel.bidirectional ? "toggle-on" : ""}`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
          >
            <div className={`toggle-knob ${rel.bidirectional ? "toggle-knob-on" : ""}`} />
          </div>
          <span className="toggle-label">
            {rel.bidirectional
              ? "Creates relationships in both directions"
              : "One-way relationship"}
          </span>
        </div>
      </div>

      <div className="mt-xl">
        <span className="label">Condition (optional)</span>
        {rel.condition ? (
          <RelationshipConditionEditor
            condition={rel.condition}
            onChange={handleConditionChange}
            onRemove={handleConditionRemove}
            availableRefs={availableRefs}
            schema={schema}
          />
        ) : (
          <button className="btn-add-inline" onClick={handleAddCondition}>
            + Add Condition
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RelationshipCard - Individual relationship editor card
// ---------------------------------------------------------------------------

interface RelationshipCardProps {
  rel: Relationship;
  onChange: (updated: Relationship) => void;
  onRemove: () => void;
  schema: Schema | undefined;
  availableRefs: string[];
}

function RelationshipCard({ rel, onChange, onRemove, schema, availableRefs }: RelationshipCardProps) {
  const { expanded, hovering, headerProps } = useExpandBoolean();

  const handleUpdateField = useCallback(
    (field: keyof Relationship, value: unknown) => {
      onChange({ ...rel, [field]: value });
    },
    [rel, onChange],
  );

  const handleRemoveClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove();
    },
    [onRemove],
  );

  return (
    <div className="item-card">
      <div
        className={`item-card-header ${hovering ? "item-card-header-hover" : ""}`}
        {...headerProps}
      >
        <div className="rel-visual">
          <span className="rel-ref">{safeDisplay(rel.src, "?", "src")}</span>
          <span className="rel-arrow">→</span>
          <span className="rel-kind">{safeDisplay(rel.kind, "?", "kind")}</span>
          <span className="rel-arrow">→</span>
          <span className="rel-ref">{safeDisplay(rel.dst, "?", "dst")}</span>
          {rel.bidirectional && <span className="rel-bidirectional">↔</span>}
        </div>
        <div className="item-card-actions">
          <button className="btn-icon">{expanded ? "▲" : "▼"}</button>
          <button className="btn-icon btn-icon-danger" onClick={handleRemoveClick}>
            ×
          </button>
        </div>
      </div>

      {expanded && (
        <RelationshipCardBody
          rel={rel}
          schema={schema}
          availableRefs={availableRefs}
          onUpdateField={handleUpdateField}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImpliedRelationshipCard
// ---------------------------------------------------------------------------

interface ImpliedRelationshipCardProps {
  saturationLimit: SaturationLimit;
  schema: Schema | undefined;
  createdEntityRef: string;
}

function ImpliedRelationshipCard({ saturationLimit, schema, createdEntityRef }: ImpliedRelationshipCardProps) {
  const relationshipKindOptions = useMemo(() => buildRelKindOptions(schema), [schema]);

  const getRelLabel = useCallback(
    (kind: string) => {
      const rk = relationshipKindOptions.find((r) => r.value === kind);
      return rk?.label || kind;
    },
    [relationshipKindOptions],
  );

  return (
    <div className="item-card rt-implied-card">
      <div className="item-card-header">
        <div className="rel-visual">
          <span className="rel-ref">{createdEntityRef}</span>
          <span className="rel-arrow">↔</span>
          <span className="rel-kind">{getRelLabel(saturationLimit.relationshipKind)}</span>
          <span className="rel-arrow">↔</span>
          <span className="rel-ref">$target</span>
        </div>
        <span className="rt-implied-badge">Implied</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RelationshipList - Renders the list of relationship cards
// ---------------------------------------------------------------------------

interface RelationshipListProps {
  relationships: Relationship[];
  saturationLimits: SaturationLimit[];
  schema: Schema | undefined;
  availableRefs: string[];
  firstCreatedRef: string;
  generator: Generator;
  onChange: (generator: Generator) => void;
}

function RelationshipList({
  relationships,
  saturationLimits,
  schema,
  availableRefs,
  firstCreatedRef,
  generator,
  onChange,
}: RelationshipListProps) {
  const handleRelChange = useCallback(
    (index: number, updated: Relationship) => {
      const newRels = [...relationships];
      newRels[index] = updated;
      onChange({ ...generator, relationships: newRels });
    },
    [relationships, generator, onChange],
  );

  const handleRelRemove = useCallback(
    (index: number) => {
      onChange({
        ...generator,
        relationships: relationships.filter((_, i) => i !== index),
      });
    },
    [relationships, generator, onChange],
  );

  return (
    <>
      {saturationLimits.length > 0 && (
        <div className="mb-xl">
          {saturationLimits.map((limit, index) => (
            <ImpliedRelationshipCard
              key={`implied-${index}`}
              saturationLimit={limit}
              schema={schema}
              createdEntityRef={firstCreatedRef}
            />
          ))}
        </div>
      )}

      {relationships.length === 0 && saturationLimits.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔗</div>
          <div className="empty-state-title">No relationships</div>
          <div className="empty-state-desc">
            This generator doesn&apos;t create any relationships. Add relationships to connect
            entities.
          </div>
        </div>
      ) : (
        relationships.map((rel, index) => (
          <RelationshipCard
            key={index}
            rel={rel}
            onChange={(updated) => handleRelChange(index, updated)}
            onRemove={() => handleRelRemove(index)}
            schema={schema}
            availableRefs={availableRefs}
          />
        ))
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// RelationshipsTab - Main tab component
// ---------------------------------------------------------------------------

interface RelationshipsTabProps {
  generator: Generator;
  onChange: (generator: Generator) => void;
  schema: Schema | undefined;
}

export function RelationshipsTab({ generator, onChange, schema }: RelationshipsTabProps) {
  const relationships = generator.relationships || [];
  const saturationLimits = generator.selection?.saturationLimits || [];

  const availableRefs = useMemo(() => {
    const refs = ["$target"];
    Object.keys(generator.variables || {}).forEach((v) => refs.push(v));
    (generator.creation || []).forEach((c) => {
      if (c.entityRef) refs.push(c.entityRef);
    });
    return refs;
  }, [generator.variables, generator.creation]);

  const firstCreatedRef = useMemo(() => {
    const creation = generator.creation || [];
    return creation.length > 0 ? (creation[0].entityRef ?? "$created") : "$created";
  }, [generator.creation]);

  const handleAdd = useCallback(() => {
    onChange({
      ...generator,
      relationships: [
        ...relationships,
        {
          kind: schema?.relationshipKinds?.[0]?.kind || "ally_of",
          src: availableRefs[1] || "$entity1",
          dst: "$target",
          strength: 0.8,
        },
      ],
    });
  }, [generator, relationships, schema, availableRefs, onChange]);

  return (
    <div>
      <div className="section">
        <div className="section-title">Relationships</div>
        <div className="section-desc">
          Define relationships created between entities. Use entity references like{" "}
          <code className="inline-code">$target</code>, created entities like{" "}
          <code className="inline-code">$hero</code>, or variables like{" "}
          <code className="inline-code">$faction</code>.
        </div>

        <RelationshipList
          relationships={relationships}
          saturationLimits={saturationLimits}
          schema={schema}
          availableRefs={availableRefs}
          firstCreatedRef={firstCreatedRef}
          generator={generator}
          onChange={onChange}
        />

        <button className="btn-add" onClick={handleAdd}>
          + Add Relationship
        </button>
      </div>
    </div>
  );
}

export default RelationshipsTab;
