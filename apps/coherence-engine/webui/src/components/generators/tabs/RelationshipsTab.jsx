/**
 * RelationshipsTab - Configure relationships between entities
 */

import React, { useState, useMemo } from 'react';
import { ReferenceDropdown, NumberInput } from '../../shared';

/**
 * Safely display a value that should be a string.
 * If it's an object, log a warning and return a fallback.
 */
function safeDisplay(value, fallback = '?', label = 'value') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') {
    console.warn(`[RelationshipsTab] Expected string for ${label} but got object:`, value);
    return `[object]`;
  }
  return String(value);
}

// Condition types supported by lore-weave runtime
const CONDITION_TYPES = [
  { value: 'random_chance', label: 'Random Chance', desc: 'Probabilistic creation' },
  { value: 'entity_exists', label: 'Entity Exists', desc: 'Only if entity reference resolves' },
  { value: 'entity_has_relationship', label: 'Entity Has Relationship', desc: 'Only if entity has specific relationship' },
];

// ============================================================================
// RelationshipConditionEditor - Edit a relationship condition
// ============================================================================

function RelationshipConditionEditor({ condition, onChange, onRemove, availableRefs, schema }) {
  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const updateCondition = (field, value) => {
    onChange({ ...condition, [field]: value });
  };

  return (
    <div className="condition-editor">
      <div className="condition-editor-header">
        <ReferenceDropdown
          value={condition.type || ''}
          onChange={(v) => {
            // Reset condition to new type with empty required fields
            if (v === 'random_chance') {
              onChange({ type: v, chance: 0 });
            } else if (v === 'entity_exists') {
              onChange({ type: v, entity: '' });
            } else if (v === 'entity_has_relationship') {
              onChange({ type: v, entity: '', relationshipKind: '' });
            }
          }}
          options={CONDITION_TYPES}
          placeholder="Select condition type..."
        />
        <button className="btn-icon btn-icon-danger" onClick={onRemove}>×</button>
      </div>

      {condition.type === 'random_chance' && (
        <div className="condition-editor-body">
          <div className="form-group">
            <label className="label">Chance (0-1)</label>
            <NumberInput
              value={condition.chance}
              onChange={(v) => updateCondition('chance', v ?? 0)}
              min={0}
              max={1}
              placeholder="0.5"
            />
          </div>
        </div>
      )}

      {condition.type === 'entity_exists' && (
        <div className="condition-editor-body">
          <ReferenceDropdown
            label="Entity Reference"
            value={condition.entity || ''}
            onChange={(v) => updateCondition('entity', v)}
            options={availableRefs.map((r) => ({ value: r, label: r }))}
            placeholder="Select entity..."
          />
        </div>
      )}

      {condition.type === 'entity_has_relationship' && (
        <div className="condition-editor-body">
          <div className="form-grid">
            <ReferenceDropdown
              label="Entity Reference"
              value={condition.entity || ''}
              onChange={(v) => updateCondition('entity', v)}
              options={availableRefs.map((r) => ({ value: r, label: r }))}
              placeholder="Select entity..."
            />
            <ReferenceDropdown
              label="Relationship Kind"
              value={condition.relationshipKind || ''}
              onChange={(v) => updateCondition('relationshipKind', v)}
              options={relationshipKindOptions}
              placeholder="Select relationship..."
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// RelationshipCard - Individual relationship editor card
// ============================================================================

function RelationshipCard({ rel, onChange, onRemove, schema, availableRefs }) {
  const [expanded, setExpanded] = useState(false);
  const [hovering, setHovering] = useState(false);

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const updateField = (field, value) => {
    onChange({ ...rel, [field]: value });
  };

  return (
    <div className="item-card">
      <div
        className={`item-card-header ${hovering ? 'item-card-header-hover' : ''}`}
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div className="rel-visual">
          <span className="rel-ref">{safeDisplay(rel.src, '?', 'src')}</span>
          <span className="rel-arrow">→</span>
          <span className="rel-kind">{safeDisplay(rel.kind, '?', 'kind')}</span>
          <span className="rel-arrow">→</span>
          <span className="rel-ref">{safeDisplay(rel.dst, '?', 'dst')}</span>
          {rel.bidirectional && <span className="rel-bidirectional">↔</span>}
        </div>
        <div className="item-card-actions">
          <button className="btn-icon">{expanded ? '▲' : '▼'}</button>
          <button className="btn-icon btn-icon-danger" onClick={(e) => { e.stopPropagation(); onRemove(); }}>×</button>
        </div>
      </div>

      {expanded && (
        <div className="item-card-body">
          <div className="form-grid">
            <ReferenceDropdown
              label="Relationship Kind"
              value={rel.kind}
              onChange={(v) => updateField('kind', v)}
              options={relationshipKindOptions}
            />
            <ReferenceDropdown
              label="Source"
              value={rel.src}
              onChange={(v) => updateField('src', v)}
              options={availableRefs.map((r) => ({ value: r, label: r }))}
            />
            <ReferenceDropdown
              label="Destination"
              value={rel.dst}
              onChange={(v) => updateField('dst', v)}
              options={availableRefs.map((r) => ({ value: r, label: r }))}
            />
            <div className="form-group">
              <label className="label">Strength</label>
              <NumberInput
                value={rel.strength}
                onChange={(v) => updateField('strength', v)}
                min={0}
                max={1}
                allowEmpty
                placeholder="0.8"
              />
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label className="label">Bidirectional</label>
            <div className="toggle-container">
              <div
                onClick={() => updateField('bidirectional', !rel.bidirectional)}
                className={`toggle ${rel.bidirectional ? 'toggle-on' : ''}`}
              >
                <div className={`toggle-knob ${rel.bidirectional ? 'toggle-knob-on' : ''}`} />
              </div>
              <span className="toggle-label">
                {rel.bidirectional ? 'Creates relationships in both directions' : 'One-way relationship'}
              </span>
            </div>
          </div>

          {/* Condition */}
          <div style={{ marginTop: '16px' }}>
            <label className="label">Condition (optional)</label>
            {rel.condition ? (
              <RelationshipConditionEditor
                condition={rel.condition}
                onChange={(updated) => updateField('condition', updated)}
                onRemove={() => updateField('condition', undefined)}
                availableRefs={availableRefs}
                schema={schema}
              />
            ) : (
              <button
                className="btn-add-inline"
                onClick={() => updateField('condition', { type: '' })}
              >
                + Add Condition
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ImpliedRelationshipCard - Read-only card for saturation-implied relationships
// ============================================================================

function ImpliedRelationshipCard({ saturationLimit, schema, createdEntityRef }) {
  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const getRelLabel = (kind) => {
    const rk = relationshipKindOptions.find(r => r.value === kind);
    return rk?.label || kind;
  };

  // Created entity will have a relationship with the target (bidirectional implied)
  return (
    <div className="item-card" style={{ opacity: 0.8, borderStyle: 'dashed' }}>
      <div className="item-card-header">
        <div className="rel-visual">
          <span className="rel-ref">{createdEntityRef}</span>
          <span className="rel-arrow">↔</span>
          <span className="rel-kind">{getRelLabel(saturationLimit.relationshipKind)}</span>
          <span className="rel-arrow">↔</span>
          <span className="rel-ref">$target</span>
        </div>
        <span style={{
          fontSize: '10px',
          padding: '2px 6px',
          borderRadius: '4px',
          background: 'var(--color-accent-muted, #e0e7ff)',
          color: 'var(--color-accent, #4f46e5)',
        }}>
          Implied
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// RelationshipsTab - Main tab component
// ============================================================================

/**
 * @param {Object} props
 * @param {Object} props.generator - The generator being edited
 * @param {Function} props.onChange - Callback when generator changes
 * @param {Object} props.schema - Domain schema
 */
export function RelationshipsTab({ generator, onChange, schema }) {
  const relationships = generator.relationships || [];
  const saturationLimits = generator.selection?.saturationLimits || [];

  const availableRefs = useMemo(() => {
    const refs = ['$target'];
    Object.keys(generator.variables || {}).forEach((v) => refs.push(v));
    (generator.creation || []).forEach((c) => { if (c.entityRef) refs.push(c.entityRef); });
    return refs;
  }, [generator.variables, generator.creation]);

  // Find the first created entity ref for implied relationships
  const firstCreatedRef = useMemo(() => {
    const creation = generator.creation || [];
    return creation.length > 0 ? creation[0].entityRef : '$created';
  }, [generator.creation]);

  const handleAdd = () => {
    onChange({
      ...generator,
      relationships: [...relationships, {
        kind: schema?.relationshipKinds?.[0]?.kind || 'ally_of',
        src: availableRefs[1] || '$entity1',
        dst: '$target',
        strength: 0.8,
      }],
    });
  };

  return (
    <div>
      <div className="section">
        <div className="section-title">Relationships</div>
        <div className="section-desc">
          Define relationships created between entities. Use entity references like <code className="inline-code">$target</code>,
          created entities like <code className="inline-code">$hero</code>, or variables like <code className="inline-code">$faction</code>.
        </div>

        {/* Implied relationships from saturation limits */}
        {saturationLimits.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
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
              This generator doesn't create any relationships. Add relationships to connect entities.
            </div>
          </div>
        ) : (
          relationships.map((rel, index) => (
            <RelationshipCard
              key={index}
              rel={rel}
              onChange={(updated) => {
                const newRels = [...relationships];
                newRels[index] = updated;
                onChange({ ...generator, relationships: newRels });
              }}
              onRemove={() => onChange({ ...generator, relationships: relationships.filter((_, i) => i !== index) })}
              schema={schema}
              availableRefs={availableRefs}
            />
          ))
        )}

        <button
          className="btn-add"
          onClick={handleAdd}
        >
          + Add Relationship
        </button>
      </div>
    </div>
  );
}

export default RelationshipsTab;
