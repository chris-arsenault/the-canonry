/**
 * MutationCard - Edit a single mutation entry
 */

import React, { useState } from 'react';
import { ReferenceDropdown, NumberInput } from './index';
import TagSelector from '@penguin-tales/shared-components/TagSelector';
import { MUTATION_TYPE_META, MUTATION_TYPE_ORDER } from '../actions/constants';

export const DEFAULT_MUTATION_TYPES = [
  ...MUTATION_TYPE_ORDER.map((key) => ({
    value: key,
    label: MUTATION_TYPE_META[key]?.label || key,
  })),
];

const DIRECTION_OPTIONS = [
  { value: 'both', label: 'Both' },
  { value: 'src', label: 'Source (outgoing)' },
  { value: 'dst', label: 'Destination (incoming)' },
];

function normalizeOptions(options) {
  return (options || []).map((opt) => {
    if (typeof opt === 'string') return { value: opt, label: opt };
    return opt;
  });
}

function parseTagValue(value) {
  if (value === '') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (!Number.isNaN(Number(value))) return Number(value);
  return value;
}

function formatDelta(delta) {
  if (delta === undefined || delta === null || Number.isNaN(delta)) return '0';
  const numeric = Number(delta);
  if (Number.isNaN(numeric)) return String(delta);
  return `${numeric >= 0 ? '+' : ''}${numeric}`;
}

export function MutationCard({
  mutation,
  onChange,
  onRemove,
  schema,
  pressures,
  entityOptions,
  typeOptions,
  createMutation,
  titlePrefix,
}) {
  const [expanded, setExpanded] = useState(false);
  const types = typeOptions || DEFAULT_MUTATION_TYPES;
  const entityRefs = normalizeOptions(entityOptions);
  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));
  const pressureOptions = (pressures || []).map((p) => ({
    value: p.id,
    label: p.name || p.id,
  }));
  const tagRegistry = schema?.tagRegistry || [];

  const update = (field, value) => {
    onChange({ ...mutation, [field]: value });
  };

  const updateType = (value) => {
    if (createMutation) {
      onChange(createMutation(value));
      return;
    }
    update('type', value);
  };

  const fallbackLabel = types.find((t) => t.value === mutation.type)?.label
    || MUTATION_TYPE_META[mutation.type]?.label
    || mutation.type;
  const typeMeta = MUTATION_TYPE_META[mutation.type] || { icon: '?', color: '#6b7280' };
  const headerLabel = titlePrefix ? `${titlePrefix}: ${fallbackLabel}` : fallbackLabel;

  const getSummary = () => {
    switch (mutation.type) {
      case 'modify_pressure':
        return `${mutation.pressureId || '?'} ${formatDelta(mutation.delta)}`;
      case 'set_tag': {
        const value = mutation.value !== undefined ? ` = ${mutation.value}` : '';
        return `${mutation.entity || '?'} tag ${mutation.tag || '?'}${value}`;
      }
      case 'remove_tag':
        return `${mutation.entity || '?'} remove ${mutation.tag || '?'}`;
      case 'change_status':
        return `${mutation.entity || '?'} -> ${mutation.newStatus || '?'}`;
      case 'adjust_prominence':
        return `${mutation.entity || '?'} ${formatDelta(mutation.delta)}`;
      case 'archive_relationship': {
        return `${mutation.entity || '?'} ${mutation.relationshipKind || '?'} with ${mutation.with || '?'}`;
      }
      case 'archive_all_relationships': {
        const dirLabel = mutation.direction && mutation.direction !== 'both' ? ` (${mutation.direction})` : '';
        return `${mutation.entity || '?'} all ${mutation.relationshipKind || '?'}${dirLabel}`;
      }
      case 'adjust_relationship_strength':
        return `${mutation.kind || '?'} ${mutation.src || '?'} -> ${mutation.dst || '?'} ${formatDelta(mutation.delta)}`;
      case 'create_relationship': {
        const arrow = mutation.bidirectional ? '<->' : '->';
        return `${mutation.kind || '?'} ${mutation.src || '?'} ${arrow} ${mutation.dst || '?'}`;
      }
      case 'update_rate_limit':
        return 'track execution';
      case 'transfer_relationship':
        return `${mutation.entity || '?'} ${mutation.relationshipKind || '?'} from ${mutation.from || '?'} to ${mutation.to || '?'}`;
      case 'for_each_related': {
        const actionCount = (mutation.actions || []).length;
        return `${mutation.relationship || '?'} (${actionCount} action${actionCount !== 1 ? 's' : ''})`;
      }
      case 'conditional': {
        const thenCount = (mutation.thenActions || []).length;
        const elseCount = (mutation.elseActions || []).length;
        return `then: ${thenCount}, else: ${elseCount}`;
      }
      default:
        return '';
    }
  };

  const summary = getSummary();

  return (
    <div className="condition-card">
      <div
        className="condition-card-header"
        style={{ marginBottom: expanded ? undefined : 0 }}
      >
        <div className="condition-card-type">
          <div className="condition-card-icon" style={{ backgroundColor: `${typeMeta.color}20` }}>
            {typeMeta.icon}
          </div>
          <div>
            <div className="condition-card-label">{headerLabel}</div>
            {summary && <div className="condition-card-summary">{summary}</div>}
          </div>
        </div>
        <div className="condition-card-actions">
          <button className="btn-icon" onClick={() => setExpanded(!expanded)}>
            {expanded ? '^' : 'v'}
          </button>
          {onRemove && (
            <button className="btn-icon btn-icon-danger" onClick={onRemove}>
              x
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="condition-card-fields">
          <div className="form-grid" style={{ flex: '1 1 100%' }}>
            <ReferenceDropdown
              label="Type"
              value={mutation.type}
              onChange={updateType}
              options={types}
            />

            {mutation.type === 'modify_pressure' && (
              <>
                <ReferenceDropdown
                  label="Pressure"
                  value={mutation.pressureId || ''}
                  onChange={(v) => update('pressureId', v)}
                  options={pressureOptions}
                  placeholder="Select pressure..."
                />
                <div className="form-group">
                  <label className="label">Delta</label>
                  <NumberInput
                    value={mutation.delta}
                    onChange={(v) => update('delta', v ?? 0)}
                  />
                </div>
              </>
            )}

            {(mutation.type === 'set_tag' || mutation.type === 'remove_tag') && (
              <>
                <ReferenceDropdown
                  label="Entity"
                  value={mutation.entity || ''}
                  onChange={(v) => update('entity', v)}
                  options={entityRefs}
                  placeholder="Select entity..."
                />
                <div className="form-group">
                  <label className="label">Tag</label>
                  <TagSelector
                    value={mutation.tag ? [mutation.tag] : []}
                    onChange={(tags) => update('tag', tags[0] || '')}
                    tagRegistry={tagRegistry}
                    placeholder="Select tag..."
                    singleSelect
                  />
                </div>
              </>
            )}

            {mutation.type === 'set_tag' && (
              <>
                <div className="form-group">
                  <label className="label">Value (optional)</label>
                  <input
                    type="text"
                    value={mutation.value !== undefined ? String(mutation.value) : ''}
                    onChange={(e) => update('value', parseTagValue(e.target.value))}
                    className="input"
                    placeholder="true"
                    disabled={Boolean(mutation.valueFrom)}
                  />
                </div>
                <div className="form-group">
                  <label className="label">Value Source (optional)</label>
                  <input
                    type="text"
                    value={mutation.valueFrom || ''}
                    onChange={(e) => update('valueFrom', e.target.value || undefined)}
                    className="input"
                    placeholder="e.g., cluster_id"
                  />
                </div>
              </>
            )}

            {mutation.type === 'change_status' && (
              <>
                <ReferenceDropdown
                  label="Entity"
                  value={mutation.entity || ''}
                  onChange={(v) => update('entity', v)}
                  options={entityRefs}
                  placeholder="Select entity..."
                />
                <div className="form-group">
                  <label className="label">New Status</label>
                  <input
                    type="text"
                    value={mutation.newStatus || ''}
                    onChange={(e) => update('newStatus', e.target.value || undefined)}
                    className="input"
                    placeholder="e.g., active"
                  />
                </div>
              </>
            )}

            {mutation.type === 'adjust_prominence' && (
              <>
                <ReferenceDropdown
                  label="Entity"
                  value={mutation.entity || ''}
                  onChange={(v) => update('entity', v)}
                  options={entityRefs}
                  placeholder="Select entity..."
                />
                <div className="form-group">
                  <label className="label">Delta</label>
                  <NumberInput
                    value={mutation.delta}
                    onChange={(v) => update('delta', v ?? 0)}
                    placeholder="e.g., 0.25 or -0.15"
                  />
                </div>
              </>
            )}

            {mutation.type === 'create_relationship' && (
              <>
                <ReferenceDropdown
                  label="Relationship Kind"
                  value={mutation.kind || ''}
                  onChange={(v) => update('kind', v)}
                  options={relationshipKindOptions}
                  placeholder="Select relationship..."
                />
                <ReferenceDropdown
                  label="Source"
                  value={mutation.src || ''}
                  onChange={(v) => update('src', v)}
                  options={entityRefs}
                  placeholder="Select source..."
                />
                <ReferenceDropdown
                  label="Destination"
                  value={mutation.dst || ''}
                  onChange={(v) => update('dst', v)}
                  options={entityRefs}
                  placeholder="Select destination..."
                />
                <div className="form-group">
                  <label className="label">Strength</label>
                  <NumberInput
                    value={mutation.strength}
                    onChange={(v) => update('strength', v)}
                    min={0}
                    max={1}
                    allowEmpty
                  />
                </div>
                <div className="form-group">
                  <label className="label">Category (optional)</label>
                  <input
                    type="text"
                    value={mutation.category || ''}
                    onChange={(e) => update('category', e.target.value || undefined)}
                    className="input"
                    placeholder="Optional"
                  />
                </div>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={mutation.bidirectional || false}
                      onChange={(e) => update('bidirectional', e.target.checked || undefined)}
                      className="checkbox"
                    />
                    Bidirectional
                  </label>
                </div>
              </>
            )}

            {mutation.type === 'adjust_relationship_strength' && (
              <>
                <ReferenceDropdown
                  label="Relationship Kind"
                  value={mutation.kind || ''}
                  onChange={(v) => update('kind', v)}
                  options={relationshipKindOptions}
                  placeholder="Select relationship..."
                />
                <ReferenceDropdown
                  label="Source"
                  value={mutation.src || ''}
                  onChange={(v) => update('src', v)}
                  options={entityRefs}
                  placeholder="Select source..."
                />
                <ReferenceDropdown
                  label="Destination"
                  value={mutation.dst || ''}
                  onChange={(v) => update('dst', v)}
                  options={entityRefs}
                  placeholder="Select destination..."
                />
                <div className="form-group">
                  <label className="label">Delta</label>
                  <NumberInput
                    value={mutation.delta}
                    onChange={(v) => update('delta', v ?? 0)}
                  />
                </div>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={mutation.bidirectional || false}
                      onChange={(e) => update('bidirectional', e.target.checked || undefined)}
                      className="checkbox"
                    />
                    Bidirectional
                  </label>
                </div>
              </>
            )}

            {mutation.type === 'archive_relationship' && (
              <>
                <ReferenceDropdown
                  label="Entity"
                  value={mutation.entity || ''}
                  onChange={(v) => update('entity', v)}
                  options={entityRefs}
                  placeholder="Select entity..."
                />
                <ReferenceDropdown
                  label="Relationship Kind"
                  value={mutation.relationshipKind || ''}
                  onChange={(v) => update('relationshipKind', v)}
                  options={relationshipKindOptions}
                  placeholder="Select relationship..."
                />
                <ReferenceDropdown
                  label="With Entity"
                  value={mutation.with || ''}
                  onChange={(v) => update('with', v)}
                  options={entityRefs}
                  placeholder="Select entity..."
                />
                <ReferenceDropdown
                  label="Direction"
                  value={mutation.direction || 'both'}
                  onChange={(v) => update('direction', v)}
                  options={DIRECTION_OPTIONS}
                />
              </>
            )}

            {mutation.type === 'archive_all_relationships' && (
              <>
                <ReferenceDropdown
                  label="Entity"
                  value={mutation.entity || ''}
                  onChange={(v) => update('entity', v)}
                  options={entityRefs}
                  placeholder="Select entity..."
                />
                <ReferenceDropdown
                  label="Relationship Kind"
                  value={mutation.relationshipKind || ''}
                  onChange={(v) => update('relationshipKind', v)}
                  options={relationshipKindOptions}
                  placeholder="Select relationship..."
                />
                <ReferenceDropdown
                  label="Direction"
                  value={mutation.direction || 'both'}
                  onChange={(v) => update('direction', v)}
                  options={DIRECTION_OPTIONS}
                />
              </>
            )}

            {mutation.type === 'update_rate_limit' && (
              <div className="text-muted" style={{ gridColumn: '1 / -1' }}>
                Tracks generator execution for rate limiting.
              </div>
            )}

            {mutation.type === 'transfer_relationship' && (
              <>
                <ReferenceDropdown
                  label="Entity"
                  value={mutation.entity || ''}
                  onChange={(v) => update('entity', v)}
                  options={entityRefs}
                  placeholder="Select entity..."
                />
                <ReferenceDropdown
                  label="Relationship Kind"
                  value={mutation.relationshipKind || ''}
                  onChange={(v) => update('relationshipKind', v)}
                  options={relationshipKindOptions}
                  placeholder="Select relationship..."
                />
                <ReferenceDropdown
                  label="From"
                  value={mutation.from || ''}
                  onChange={(v) => update('from', v)}
                  options={entityRefs}
                  placeholder="Select source..."
                />
                <ReferenceDropdown
                  label="To"
                  value={mutation.to || ''}
                  onChange={(v) => update('to', v)}
                  options={entityRefs}
                  placeholder="Select destination..."
                />
              </>
            )}

            {mutation.type === 'for_each_related' && (
              <>
                <ReferenceDropdown
                  label="Relationship"
                  value={mutation.relationship || ''}
                  onChange={(v) => update('relationship', v)}
                  options={relationshipKindOptions}
                  placeholder="Select relationship..."
                />
                <ReferenceDropdown
                  label="Direction"
                  value={mutation.direction || 'both'}
                  onChange={(v) => update('direction', v)}
                  options={DIRECTION_OPTIONS}
                />
                <div className="form-group">
                  <label className="label">Target Kind (optional)</label>
                  <input
                    type="text"
                    value={mutation.targetKind || ''}
                    onChange={(e) => update('targetKind', e.target.value || undefined)}
                    className="input"
                    placeholder="e.g., artifact"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Target Subtype (optional)</label>
                  <input
                    type="text"
                    value={mutation.targetSubtype || ''}
                    onChange={(e) => update('targetSubtype', e.target.value || undefined)}
                    className="input"
                    placeholder="e.g., weapon"
                  />
                </div>
                <div style={{ gridColumn: '1 / -1', marginTop: '16px' }}>
                  <label className="label">Nested Actions ({(mutation.actions || []).length})</label>
                  <div className="info-box-text" style={{ marginBottom: '8px', fontSize: '12px' }}>
                    Actions executed for each related entity. Use <code>$related</code> to reference the current entity.
                  </div>
                  {(mutation.actions || []).map((nestedAction, idx) => (
                    <div key={idx} style={{ marginBottom: '8px', marginLeft: '16px', borderLeft: '2px solid #a855f7', paddingLeft: '12px' }}>
                      <MutationCard
                        mutation={nestedAction}
                        onChange={(a) => {
                          const newActions = [...(mutation.actions || [])];
                          newActions[idx] = a;
                          update('actions', newActions);
                        }}
                        onRemove={() => {
                          update('actions', (mutation.actions || []).filter((_, i) => i !== idx));
                        }}
                        schema={schema}
                        pressures={pressures}
                        entityOptions={[...entityRefs, { value: '$related', label: '$related' }]}
                        typeOptions={types.filter(t => t.value !== 'for_each_related')}
                        createMutation={createMutation}
                      />
                    </div>
                  ))}
                  <button
                    className="btn-add"
                    onClick={() => update('actions', [...(mutation.actions || []), { type: 'set_tag', entity: '$related', tag: '' }])}
                    style={{ marginLeft: '16px' }}
                  >
                    + Add Nested Action
                  </button>
                </div>
              </>
            )}

            {mutation.type === 'conditional' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="info-box-text" style={{ marginBottom: '12px', fontSize: '12px' }}>
                  Execute different actions based on a condition.
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label className="label">Then Actions ({(mutation.thenActions || []).length})</label>
                  <div className="info-box-text" style={{ marginBottom: '8px', fontSize: '12px' }}>
                    Actions executed when condition passes.
                  </div>
                  {(mutation.thenActions || []).map((nestedAction, idx) => (
                    <div key={idx} style={{ marginBottom: '8px', marginLeft: '16px', borderLeft: '2px solid #10b981', paddingLeft: '12px' }}>
                      <MutationCard
                        mutation={nestedAction}
                        onChange={(a) => {
                          const newActions = [...(mutation.thenActions || [])];
                          newActions[idx] = a;
                          update('thenActions', newActions);
                        }}
                        onRemove={() => {
                          update('thenActions', (mutation.thenActions || []).filter((_, i) => i !== idx));
                        }}
                        schema={schema}
                        pressures={pressures}
                        entityOptions={entityRefs}
                        typeOptions={types}
                        createMutation={createMutation}
                      />
                    </div>
                  ))}
                  <button
                    className="btn-add"
                    onClick={() => update('thenActions', [...(mutation.thenActions || []), { type: 'set_tag', entity: '$self', tag: '' }])}
                    style={{ marginLeft: '16px' }}
                  >
                    + Add Then Action
                  </button>
                </div>
                <div>
                  <label className="label">Else Actions ({(mutation.elseActions || []).length})</label>
                  <div className="info-box-text" style={{ marginBottom: '8px', fontSize: '12px' }}>
                    Actions executed when condition fails (optional).
                  </div>
                  {(mutation.elseActions || []).map((nestedAction, idx) => (
                    <div key={idx} style={{ marginBottom: '8px', marginLeft: '16px', borderLeft: '2px solid #ef4444', paddingLeft: '12px' }}>
                      <MutationCard
                        mutation={nestedAction}
                        onChange={(a) => {
                          const newActions = [...(mutation.elseActions || [])];
                          newActions[idx] = a;
                          update('elseActions', newActions);
                        }}
                        onRemove={() => {
                          update('elseActions', (mutation.elseActions || []).filter((_, i) => i !== idx));
                        }}
                        schema={schema}
                        pressures={pressures}
                        entityOptions={entityRefs}
                        typeOptions={types}
                        createMutation={createMutation}
                      />
                    </div>
                  ))}
                  <button
                    className="btn-add"
                    onClick={() => update('elseActions', [...(mutation.elseActions || []), { type: 'set_tag', entity: '$self', tag: '' }])}
                    style={{ marginLeft: '16px' }}
                  >
                    + Add Else Action
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MutationCard;
