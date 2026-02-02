/**
 * ApplicabilityRuleCard - Display and edit a single applicability rule
 */

import React, { useState } from 'react';
import { APPLICABILITY_TYPES } from '../constants';
import { ReferenceDropdown, ChipSelect, NumberInput, PROMINENCE_LEVELS } from '../../shared';
import { AddRuleButton } from './AddRuleButton';
import { createNewRule } from './createNewRule';
import { GraphPathEditor } from '../filters/GraphPathEditor';
import TagSelector from '@penguin-tales/shared-components/TagSelector';

const NUMBER_INPUT_STYLE = Object.freeze({ width: '80px' });

/**
 * @param {Object} props
 * @param {Object} props.rule - The rule configuration
 * @param {Function} props.onChange - Callback when rule changes
 * @param {Function} props.onRemove - Callback to remove this rule
 * @param {Object} props.schema - Domain schema
 * @param {Array} props.pressures - Available pressure definitions
 * @param {Array} props.eras - Available era definitions
 * @param {number} props.depth - Nesting depth for nested rules
 */
export function ApplicabilityRuleCard({ rule, onChange, onRemove, schema, pressures, eras, depth = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const typeConfig = APPLICABILITY_TYPES[rule.type] || {};

  const entityKinds = schema?.entityKinds || [];
  const entityKindOptions = entityKinds.map((ek) => ({
    value: ek.kind,
    label: ek.description || ek.kind,
  }));

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const tagRegistry = schema?.tagRegistry || [];

  const getSubtypesForKind = (kind) => {
    const ek = entityKinds.find((e) => e.kind === kind);
    if (!ek?.subtypes) return [];
    return ek.subtypes.map((st) => ({ value: st.id, label: st.name || st.id }));
  };

  const pressureOptions = (pressures || []).map((p) => ({
    value: p.id,
    label: p.name || p.id,
  }));

  const eraOptions = (eras || []).map((e) => ({
    value: e.id,
    label: e.name || e.id,
  }));

  const updateField = (field, value) => {
    onChange({ ...rule, [field]: value });
  };

  const getSummary = () => {
    switch (rule.type) {
      case 'entity_count':
        return `${rule.kind || '?'}${rule.subtype ? ':' + rule.subtype : ''} ${rule.min !== undefined ? `>= ${rule.min}` : ''}${rule.max !== undefined ? ` <= ${rule.max}` : ''}`;
      case 'pressure':
        return `${rule.pressureId || '?'} in [${rule.min ?? '-∞'}, ${rule.max ?? '∞'}]`;
      case 'pressure_any_above':
        return `Any of [${rule.pressureIds?.join(', ') || '?'}] > ${rule.threshold ?? '?'}`;
      case 'pressure_compare':
        return `${rule.pressureA || '?'} ${rule.operator || '>'} ${rule.pressureB || '?'}`;
      case 'relationship_count':
        return `${rule.relationshipKind || 'any'} count ${rule.min !== undefined ? `>= ${rule.min}` : ''}${rule.max !== undefined ? ` <= ${rule.max}` : ''}`;
      case 'relationship_exists':
        return `${rule.relationshipKind || '?'} exists${rule.targetKind ? ` to ${rule.targetKind}` : ''}`;
      case 'tag_exists':
        return `has tag "${rule.tag || '?'}"`;
      case 'tag_absent':
        return `missing tag "${rule.tag || '?'}"`;
      case 'status':
        return rule.not ? `status != ${rule.status || '?'}` : `status = ${rule.status || '?'}`;
      case 'prominence':
        return `prominence ${rule.min || '?'}-${rule.max || '?'}`;
      case 'time_elapsed':
        return `${rule.minTicks || '?'} ticks since ${rule.since || 'updated'}`;
      case 'growth_phases_complete':
        return `${rule.minPhases ?? '?'} growth phases${rule.eraId ? ` in ${rule.eraId}` : ''}`;
      case 'era_match':
        return rule.eras?.length ? rule.eras.join(', ') : 'No eras selected';
      case 'random_chance':
        return `${Math.round((rule.chance ?? 0.5) * 100)}% chance`;
      case 'cooldown_elapsed':
        return `${rule.cooldownTicks ?? '?'} ticks since last run`;
      case 'creations_per_epoch':
        return `max ${rule.maxPerEpoch ?? '?'} per epoch`;
      case 'graph_path':
        return `graph path (${rule.assert?.check || 'exists'})`;
      case 'entity_exists':
        return `entity ${rule.entity || '?'} exists`;
      case 'entity_has_relationship':
        return `${rule.entity || '?'} has ${rule.relationshipKind || '?'} relationship`;
      case 'or':
      case 'and':
        return `${rule.conditions?.length || 0} sub-rules`;
      case 'always':
        return 'always';
      default:
        return rule.type;
    }
  };

  const isNested = rule.type === 'or' || rule.type === 'and';

  return (
    <div className="condition-card">
      <div className="condition-card-header">
        <div className="condition-card-type">
          <div className="condition-card-icon" style={{ backgroundColor: `${typeConfig.color || '#3b82f6'}20` }}>
            {typeConfig.icon || '📋'}
          </div>
          <div>
            <div className="condition-card-label">{typeConfig.label || rule.type}</div>
            <div className="condition-card-summary">{getSummary()}</div>
          </div>
        </div>
        <div className="condition-card-actions">
          <button className="btn-icon" onClick={() => setExpanded(!expanded)}>
            {expanded ? '^' : 'v'}
          </button>
          <button className="btn-icon btn-icon-danger" onClick={onRemove}>
            x
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '12px' }}>
          <div className="form-grid">
            {rule.type === 'entity_count' && (
              <>
                <ReferenceDropdown
                  label="Entity Kind"
                  value={rule.kind}
                  onChange={(v) => {
                    updateField('kind', v);
                    if (rule.subtype) updateField('subtype', undefined);
                  }}
                  options={entityKindOptions}
                />
                <ReferenceDropdown
                  label="Subtype (optional)"
                  value={rule.subtype || ''}
                  onChange={(v) => updateField('subtype', v || undefined)}
                  options={[{ value: '', label: 'Any' }, ...getSubtypesForKind(rule.kind)]}
                  placeholder="Any"
                />
                <div className="form-group">
                  <label className="label">Min</label>
                  <NumberInput
                    value={rule.min}
                    onChange={(v) => updateField('min', v)}
                    min={0}
                    integer
                    allowEmpty
                  />
                </div>
                <div className="form-group">
                  <label className="label">Max</label>
                  <NumberInput
                    value={rule.max}
                    onChange={(v) => updateField('max', v)}
                    min={0}
                    integer
                    allowEmpty
                  />
                </div>
              </>
            )}

            {rule.type === 'pressure' && (
              <>
                <ReferenceDropdown
                  label="Pressure"
                  value={rule.pressureId}
                  onChange={(v) => updateField('pressureId', v)}
                  options={pressureOptions}
                />
                <div className="form-group">
                  <label className="label">Min Value</label>
                  <NumberInput
                    value={rule.min}
                    onChange={(v) => updateField('min', v)}
                    min={-100}
                    max={100}
                    integer
                    allowEmpty
                    placeholder="0"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Max Value</label>
                  <NumberInput
                    value={rule.max}
                    onChange={(v) => updateField('max', v)}
                    min={-100}
                    max={100}
                    integer
                    allowEmpty
                    placeholder="100"
                  />
                </div>
              </>
            )}

            {rule.type === 'pressure_any_above' && (
              <>
                <div style={{ gridColumn: '1 / -1' }}>
                  <ChipSelect
                    label="Pressures"
                    value={rule.pressureIds || []}
                    onChange={(v) => updateField('pressureIds', v)}
                    options={pressureOptions}
                    placeholder="+ Add pressure"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Threshold</label>
                  <NumberInput
                    value={rule.threshold}
                    onChange={(v) => updateField('threshold', v ?? 0)}
                    min={-100}
                    max={100}
                    integer
                    placeholder="50"
                  />
                </div>
              </>
            )}

            {rule.type === 'pressure_compare' && (
              <>
                <ReferenceDropdown
                  label="Pressure A"
                  value={rule.pressureA}
                  onChange={(v) => updateField('pressureA', v)}
                  options={pressureOptions}
                />
                <ReferenceDropdown
                  label="Operator"
                  value={rule.operator || '>'}
                  onChange={(v) => updateField('operator', v)}
                  options={[
                    { value: '>', label: '>' },
                    { value: '>=', label: '>=' },
                    { value: '<', label: '<' },
                    { value: '<=', label: '<=' },
                    { value: '==', label: '==' },
                    { value: '!=', label: '!=' },
                  ]}
                />
                <ReferenceDropdown
                  label="Pressure B"
                  value={rule.pressureB}
                  onChange={(v) => updateField('pressureB', v)}
                  options={pressureOptions}
                />
              </>
            )}

            {rule.type === 'era_match' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <ChipSelect
                  label="Eras"
                  value={rule.eras || []}
                  onChange={(v) => updateField('eras', v)}
                  options={eraOptions}
                  placeholder="+ Add era"
                />
              </div>
            )}

            {rule.type === 'random_chance' && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="label">Chance (%)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round((rule.chance ?? 0.5) * 100)}
                    onChange={(e) => updateField('chance', parseInt(e.target.value, 10) / 100)}
                    style={{ flex: 1 }}
                  />
                  <NumberInput
                    value={Math.round((rule.chance ?? 0.5) * 100)}
                    onChange={(v) => updateField('chance', Math.max(0, Math.min(100, v ?? 0)) / 100)}
                    min={0}
                    max={100}
                    integer
                    style={NUMBER_INPUT_STYLE}
                  />
                  <span>%</span>
                </div>
              </div>
            )}

            {rule.type === 'cooldown_elapsed' && (
              <div className="form-group">
                <label className="label">Cooldown (ticks)</label>
                <NumberInput
                  value={rule.cooldownTicks}
                  onChange={(v) => updateField('cooldownTicks', v ?? 0)}
                  min={1}
                  integer
                  placeholder="10"
                />
              </div>
            )}

            {rule.type === 'creations_per_epoch' && (
              <div className="form-group">
                <label className="label">Max Creations Per Epoch</label>
                <NumberInput
                  value={rule.maxPerEpoch}
                  onChange={(v) => updateField('maxPerEpoch', v ?? 0)}
                  min={1}
                  integer
                  placeholder="3"
                />
              </div>
            )}

            {rule.type === 'relationship_count' && (
              <>
                <ReferenceDropdown
                  label="Relationship Kind"
                  value={rule.relationshipKind || ''}
                  onChange={(v) => updateField('relationshipKind', v || undefined)}
                  options={relationshipKindOptions}
                  placeholder="Any"
                />
                <ReferenceDropdown
                  label="Direction"
                  value={rule.direction || 'both'}
                  onChange={(v) => updateField('direction', v)}
                  options={[
                    { value: 'both', label: 'Both' },
                    { value: 'src', label: 'Outgoing (src)' },
                    { value: 'dst', label: 'Incoming (dst)' },
                  ]}
                />
                <div className="form-group">
                  <label className="label">Min Count</label>
                  <NumberInput
                    value={rule.min}
                    onChange={(v) => updateField('min', v)}
                    min={0}
                    integer
                    allowEmpty
                  />
                </div>
                <div className="form-group">
                  <label className="label">Max Count</label>
                  <NumberInput
                    value={rule.max}
                    onChange={(v) => updateField('max', v)}
                    min={0}
                    integer
                    allowEmpty
                  />
                </div>
              </>
            )}

            {rule.type === 'relationship_exists' && (
              <>
                <ReferenceDropdown
                  label="Relationship Kind"
                  value={rule.relationshipKind || ''}
                  onChange={(v) => updateField('relationshipKind', v)}
                  options={relationshipKindOptions}
                />
                <ReferenceDropdown
                  label="Direction"
                  value={rule.direction || 'both'}
                  onChange={(v) => updateField('direction', v)}
                  options={[
                    { value: 'both', label: 'Both' },
                    { value: 'src', label: 'Outgoing (src)' },
                    { value: 'dst', label: 'Incoming (dst)' },
                  ]}
                />
                <ReferenceDropdown
                  label="Target Kind"
                  value={rule.targetKind || ''}
                  onChange={(v) => updateField('targetKind', v || undefined)}
                  options={entityKindOptions}
                  placeholder="Any"
                />
                <div className="form-group">
                  <label className="label">Target Subtype</label>
                  <input
                    type="text"
                    value={rule.targetSubtype || ''}
                    onChange={(e) => updateField('targetSubtype', e.target.value || undefined)}
                    className="input"
                    placeholder="Any"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Target Status</label>
                  <input
                    type="text"
                    value={rule.targetStatus || ''}
                    onChange={(e) => updateField('targetStatus', e.target.value || undefined)}
                    className="input"
                    placeholder="Any"
                  />
                </div>
              </>
            )}

            {(rule.type === 'tag_exists' || rule.type === 'tag_absent') && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="label">Tag</label>
                <TagSelector
                  value={rule.tag ? [rule.tag] : []}
                  onChange={(tags) => updateField('tag', tags[0] || '')}
                  tagRegistry={tagRegistry}
                  placeholder="Select tag..."
                  singleSelect
                />
              </div>
            )}

            {rule.type === 'tag_exists' && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="label">Value (optional)</label>
                <input
                  type="text"
                  value={rule.value ?? ''}
                  onChange={(e) => updateField('value', e.target.value || undefined)}
                  className="input"
                  placeholder="Any value"
                />
              </div>
            )}

            {rule.type === 'status' && (
              <>
                <div className="form-group">
                  <label className="label">Status</label>
                  <input
                    type="text"
                    value={rule.status || ''}
                    onChange={(e) => updateField('status', e.target.value || undefined)}
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={rule.not || false}
                      onChange={(e) => updateField('not', e.target.checked || undefined)}
                      className="checkbox"
                    />
                    Exclude status
                  </label>
                </div>
              </>
            )}

            {rule.type === 'prominence' && (
              <>
                <ReferenceDropdown
                  label="Min Prominence"
                  value={rule.min || ''}
                  onChange={(v) => updateField('min', v || undefined)}
                  options={PROMINENCE_LEVELS.map((p) => ({ value: p.value, label: p.label }))}
                  placeholder="Any"
                />
                <ReferenceDropdown
                  label="Max Prominence"
                  value={rule.max || ''}
                  onChange={(v) => updateField('max', v || undefined)}
                  options={PROMINENCE_LEVELS.map((p) => ({ value: p.value, label: p.label }))}
                  placeholder="Any"
                />
              </>
            )}

            {rule.type === 'time_elapsed' && (
              <>
                <div className="form-group">
                  <label className="label">Min Ticks</label>
                  <NumberInput
                    value={rule.minTicks}
                    onChange={(v) => updateField('minTicks', v ?? 0)}
                    min={0}
                    integer
                  />
                </div>
                <ReferenceDropdown
                  label="Since"
                  value={rule.since || 'updated'}
                  onChange={(v) => updateField('since', v)}
                  options={[
                    { value: 'updated', label: 'Updated' },
                    { value: 'created', label: 'Created' },
                  ]}
                />
              </>
            )}

            {rule.type === 'growth_phases_complete' && (
              <>
                <div className="form-group">
                  <label className="label">Min Growth Phases</label>
                  <NumberInput
                    value={rule.minPhases}
                    onChange={(v) => updateField('minPhases', v ?? 0)}
                    min={0}
                    integer
                  />
                </div>
                {eraOptions.length > 0 ? (
                  <ReferenceDropdown
                    label="Era (optional)"
                    value={rule.eraId || ''}
                    onChange={(v) => updateField('eraId', v || undefined)}
                    options={[{ value: '', label: 'Current era' }, ...eraOptions]}
                    placeholder="Current era"
                  />
                ) : (
                  <div className="form-group">
                    <label className="label">Era Id (optional)</label>
                    <input
                      type="text"
                      value={rule.eraId || ''}
                      onChange={(e) => updateField('eraId', e.target.value || undefined)}
                      className="input"
                      placeholder="Current era"
                    />
                  </div>
                )}
              </>
            )}

            {rule.type === 'graph_path' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <GraphPathEditor
                  assert={rule.assert}
                  onChange={(assert) => updateField('assert', assert)}
                  schema={schema}
                  availableRefs={['$target']}
                />
              </div>
            )}

            {rule.type === 'entity_exists' && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="label">Entity Reference</label>
                <input
                  type="text"
                  value={rule.entity || ''}
                  onChange={(e) => updateField('entity', e.target.value)}
                  className="input"
                  placeholder="$target"
                />
              </div>
            )}

            {rule.type === 'entity_has_relationship' && (
              <>
                <div className="form-group">
                  <label className="label">Entity Reference</label>
                  <input
                    type="text"
                    value={rule.entity || ''}
                    onChange={(e) => updateField('entity', e.target.value)}
                    className="input"
                    placeholder="$target"
                  />
                </div>
                <ReferenceDropdown
                  label="Relationship Kind"
                  value={rule.relationshipKind || ''}
                  onChange={(v) => updateField('relationshipKind', v)}
                  options={relationshipKindOptions}
                />
                <ReferenceDropdown
                  label="Direction"
                  value={rule.direction || 'both'}
                  onChange={(v) => updateField('direction', v)}
                  options={[
                    { value: 'both', label: 'Both' },
                    { value: 'src', label: 'Outgoing (src)' },
                    { value: 'dst', label: 'Incoming (dst)' },
                  ]}
                />
              </>
            )}
          </div>
        </div>
      )}

      {isNested && (
        <div className="condition-card-nested">
          {(rule.conditions || []).map((subRule, idx) => (
            <ApplicabilityRuleCard
              key={idx}
              rule={subRule}
              onChange={(updated) => {
                const newRules = [...(rule.conditions || [])];
                newRules[idx] = updated;
                updateField('conditions', newRules);
              }}
              onRemove={() => updateField('conditions', (rule.conditions || []).filter((_, i) => i !== idx))}
              schema={schema}
              pressures={pressures}
              eras={eras}
              depth={depth + 1}
            />
          ))}
          <AddRuleButton
            onAdd={(type) => {
              const newRule = createNewRule(type, pressures);
              updateField('conditions', [...(rule.conditions || []), newRule]);
            }}
            depth={depth + 1}
          />
        </div>
      )}
    </div>
  );
}

export default ApplicabilityRuleCard;
