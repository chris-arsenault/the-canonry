/**
 * SelectionRuleEditor - Edit a SelectionRule
 */

import React from 'react';
import { ReferenceDropdown, ChipSelect, NumberInput, PROMINENCE_LEVELS } from './index';
import { PICK_STRATEGIES } from '../generators/constants';
import { SelectionFiltersEditor } from '../generators/filters';

export function SelectionRuleEditor({
  value,
  onChange,
  schema,
  availableRefs = [],
  showPickStrategy = true,
  showMaxResults = true,
  showFilters = true,
  allowAnyKind = false,
  showExcludeSubtypes = false,
}) {
  const selection = value || { strategy: 'by_kind' };

  const baseKindOptions = (schema?.entityKinds || []).map((ek) => ({
    value: ek.kind,
    label: ek.description || ek.kind,
  }));
  const entityKindOptions = allowAnyKind
    ? [{ value: 'any', label: 'Any kind' }, ...baseKindOptions]
    : baseKindOptions;

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const getSubtypeOptions = (kind) => {
    const ek = (schema?.entityKinds || []).find((e) => e.kind === kind);
    if (!ek?.subtypes) return [];
    return ek.subtypes.map((st) => ({ value: st.id, label: st.name || st.id }));
  };

  const updateSelection = (field, fieldValue) => {
    onChange({ ...selection, [field]: fieldValue });
  };

  const updateSelectionMultiple = (updates) => {
    onChange({ ...selection, ...updates });
  };

  const referenceOptions = (availableRefs.length > 0 ? availableRefs : ['$target']).map((ref) => ({
    value: ref,
    label: ref,
  }));

  return (
    <div>
      <div className="form-grid">
        <ReferenceDropdown
          label="Selection Strategy"
          value={selection.strategy || 'by_kind'}
          onChange={(v) => updateSelection('strategy', v)}
          options={[
            { value: 'by_kind', label: 'By Entity Kind' },
            { value: 'by_preference_order', label: 'By Subtype Preference' },
            { value: 'by_relationship', label: 'By Relationship Presence' },
            { value: 'by_proximity', label: 'By Proximity' },
            { value: 'by_prominence', label: 'By Prominence' },
          ]}
        />

        {showPickStrategy && (
          <ReferenceDropdown
            label="Pick Strategy"
            value={selection.pickStrategy || 'random'}
            onChange={(v) => updateSelection('pickStrategy', v)}
            options={PICK_STRATEGIES}
          />
        )}

        {showMaxResults && (
          <div className="form-group">
            <label className="label">Max Results</label>
            <NumberInput
              value={selection.maxResults}
              onChange={(v) => updateSelection('maxResults', v)}
              min={1}
              integer
              allowEmpty
              placeholder="1"
            />
          </div>
        )}
      </div>

      <div className="form-grid" style={{ marginTop: '16px' }}>
        <ReferenceDropdown
          label="Entity Kind"
          value={selection.kind || ''}
          onChange={(v) => updateSelectionMultiple({ kind: v || undefined, subtypes: undefined, excludeSubtypes: undefined })}
          options={entityKindOptions}
          placeholder="Any kind"
        />
        <div className="form-group">
          <label className="label">Status (optional)</label>
          <input
            type="text"
          value={selection.status || ''}
          onChange={(e) => updateSelection('status', e.target.value || undefined)}
            className="input"
            placeholder="e.g., active"
          />
        </div>
        <div className="form-group">
          <label className="label">Not Status (optional)</label>
          <input
            type="text"
            value={selection.notStatus || ''}
            onChange={(e) => updateSelection('notStatus', e.target.value || undefined)}
            className="input"
            placeholder="e.g., dead"
          />
        </div>
      </div>

      {selection.kind && selection.kind !== 'any' && (
        <div style={{ marginTop: '16px' }}>
          <ChipSelect
            label="Subtypes (optional)"
            value={selection.subtypes || []}
            onChange={(v) => updateSelection('subtypes', v.length > 0 ? v : undefined)}
            options={getSubtypeOptions(selection.kind)}
            placeholder="Any subtype"
          />
        </div>
      )}

      {selection.kind && selection.kind !== 'any' && showExcludeSubtypes && (
        <div style={{ marginTop: '16px' }}>
          <ChipSelect
            label="Exclude Subtypes (optional)"
            value={selection.excludeSubtypes || []}
            onChange={(v) => updateSelection('excludeSubtypes', v.length > 0 ? v : undefined)}
            options={getSubtypeOptions(selection.kind)}
            placeholder="None"
          />
        </div>
      )}

      {selection.strategy === 'by_preference_order' && (
        <div style={{ marginTop: '16px' }}>
          <label className="label">Subtype Preferences (comma-separated)</label>
          <input
            type="text"
            value={(selection.subtypePreferences || []).join(', ')}
            onChange={(e) => {
              const prefs = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
              updateSelection('subtypePreferences', prefs.length > 0 ? prefs : undefined);
            }}
            className="input"
            placeholder="e.g., noble, commoner"
          />
        </div>
      )}

      {selection.strategy === 'by_relationship' && (
        <div className="form-grid" style={{ marginTop: '16px' }}>
          <ReferenceDropdown
            label="Relationship Kind"
            value={selection.relationshipKind || ''}
            onChange={(v) => updateSelection('relationshipKind', v)}
            options={relationshipKindOptions}
            placeholder="Select relationship..."
          />
          <ReferenceDropdown
            label="Direction"
            value={selection.direction || 'both'}
            onChange={(v) => updateSelection('direction', v)}
            options={[
              { value: 'both', label: 'Both' },
              { value: 'src', label: 'Source (outgoing)' },
              { value: 'dst', label: 'Destination (incoming)' },
            ]}
          />
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={selection.mustHave !== false}
                onChange={(e) => updateSelection('mustHave', e.target.checked)}
                className="checkbox"
              />
              Must Have Relationship
            </label>
          </div>
        </div>
      )}

      {selection.strategy === 'by_proximity' && (
        <div className="form-grid" style={{ marginTop: '16px' }}>
          <ReferenceDropdown
            label="Reference Entity"
            value={selection.referenceEntity || ''}
            onChange={(v) => updateSelection('referenceEntity', v || undefined)}
            options={referenceOptions}
            placeholder={referenceOptions[0]?.value || ''}
          />
          <div className="form-group">
            <label className="label">Max Distance</label>
            <NumberInput
              value={selection.maxDistance}
              onChange={(v) => updateSelection('maxDistance', v)}
              min={0}
              allowEmpty
              placeholder="50"
            />
          </div>
        </div>
      )}

      {selection.strategy === 'by_prominence' && (
        <div style={{ marginTop: '16px' }}>
          <ReferenceDropdown
            label="Minimum Prominence"
            value={selection.minProminence || ''}
            onChange={(v) => updateSelection('minProminence', v || undefined)}
            options={PROMINENCE_LEVELS.map((p) => ({ value: p.value, label: p.label }))}
            placeholder="Any"
          />
        </div>
      )}

      {showFilters && (
        <div style={{ marginTop: '24px' }}>
          <label className="label">Selection Filters</label>
          <div className="info-box-text" style={{ marginBottom: '12px', fontSize: '12px' }}>
            Optional filters to narrow down which entities can be selected. All filters must pass.
          </div>
          <SelectionFiltersEditor
            filters={selection.filters}
            onChange={(filters) => updateSelection('filters', filters.length > 0 ? filters : undefined)}
            schema={schema}
            availableRefs={availableRefs}
          />
        </div>
      )}
    </div>
  );
}

export default SelectionRuleEditor;
