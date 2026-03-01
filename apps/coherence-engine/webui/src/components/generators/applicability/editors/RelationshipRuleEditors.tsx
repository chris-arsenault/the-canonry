/**
 * Rule editors for relationship-related applicability rules:
 * - RelationshipCountEditor
 * - RelationshipExistsEditor
 */

import React, { useCallback } from 'react';
import { ReferenceDropdown, NumberInput } from '../../../shared';
import type { SelectOption, RelationshipCountRule, RelationshipExistsRule } from '../applicabilityRuleTypes';

const DIRECTION_OPTIONS: SelectOption[] = [
  { value: 'both', label: 'Both' },
  { value: 'src', label: 'Outgoing (src)' },
  { value: 'dst', label: 'Incoming (dst)' },
];

// ---------------------------------------------------------------------------
// Relationship Count
// ---------------------------------------------------------------------------

interface RelationshipCountEditorProps {
  rule: RelationshipCountRule;
  updateField: (field: string, value: unknown) => void;
  relationshipKindOptions: SelectOption[];
}

export function RelationshipCountEditor({
  rule,
  updateField,
  relationshipKindOptions,
}: Readonly<RelationshipCountEditorProps>) {
  const handleKindChange = useCallback(
    (v: string | undefined) => updateField('relationshipKind', v || undefined),
    [updateField],
  );
  const handleDirectionChange = useCallback(
    (v: string | undefined) => updateField('direction', v),
    [updateField],
  );
  const handleMinChange = useCallback(
    (v: number | undefined) => updateField('min', v),
    [updateField],
  );
  const handleMaxChange = useCallback(
    (v: number | undefined) => updateField('max', v),
    [updateField],
  );

  return (
    <>
      <ReferenceDropdown
        label="Relationship Kind"
        value={rule.relationshipKind || ''}
        onChange={handleKindChange}
        options={relationshipKindOptions}
        placeholder="Any"
      />
      <ReferenceDropdown
        label="Direction"
        value={rule.direction || 'both'}
        onChange={handleDirectionChange}
        options={DIRECTION_OPTIONS}
      />
      <div className="form-group">
        <label className="label">Min Count
        <NumberInput
          value={rule.min}
          onChange={handleMinChange}
          min={0}
          integer
          allowEmpty
        />
        </label>
      </div>
      <div className="form-group">
        <label className="label">Max Count
        <NumberInput
          value={rule.max}
          onChange={handleMaxChange}
          min={0}
          integer
          allowEmpty
        />
        </label>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Relationship Exists
// ---------------------------------------------------------------------------

interface RelationshipExistsEditorProps {
  rule: RelationshipExistsRule;
  updateField: (field: string, value: unknown) => void;
  relationshipKindOptions: SelectOption[];
  entityKindOptions: SelectOption[];
}

export function RelationshipExistsEditor({
  rule,
  updateField,
  relationshipKindOptions,
  entityKindOptions,
}: Readonly<RelationshipExistsEditorProps>) {
  const handleKindChange = useCallback(
    (v: string | undefined) => updateField('relationshipKind', v),
    [updateField],
  );
  const handleDirectionChange = useCallback(
    (v: string | undefined) => updateField('direction', v),
    [updateField],
  );
  const handleTargetKindChange = useCallback(
    (v: string | undefined) => updateField('targetKind', v || undefined),
    [updateField],
  );
  const handleTargetSubtypeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => updateField('targetSubtype', e.target.value || undefined),
    [updateField],
  );
  const handleTargetStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => updateField('targetStatus', e.target.value || undefined),
    [updateField],
  );

  return (
    <>
      <ReferenceDropdown
        label="Relationship Kind"
        value={rule.relationshipKind || ''}
        onChange={handleKindChange}
        options={relationshipKindOptions}
      />
      <ReferenceDropdown
        label="Direction"
        value={rule.direction || 'both'}
        onChange={handleDirectionChange}
        options={DIRECTION_OPTIONS}
      />
      <ReferenceDropdown
        label="Target Kind"
        value={rule.targetKind || ''}
        onChange={handleTargetKindChange}
        options={entityKindOptions}
        placeholder="Any"
      />
      <div className="form-group">
        <label htmlFor="target-subtype" className="label">Target Subtype</label>
        <input
          id="target-subtype"
          type="text"
          value={rule.targetSubtype || ''}
          onChange={handleTargetSubtypeChange}
          className="input"
          placeholder="Any"
        />
      </div>
      <div className="form-group">
        <label htmlFor="target-status" className="label">Target Status</label>
        <input
          id="target-status"
          type="text"
          value={rule.targetStatus || ''}
          onChange={handleTargetStatusChange}
          className="input"
          placeholder="Any"
        />
      </div>
    </>
  );
}
