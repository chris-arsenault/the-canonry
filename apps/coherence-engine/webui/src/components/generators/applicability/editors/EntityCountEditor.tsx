/**
 * EntityCountEditor - Editor for entity_count applicability rules
 */

import React, { useCallback, useMemo } from 'react';
import { ReferenceDropdown, NumberInput } from '../../../shared';
import type { SelectOption, EntityCountRule } from '../applicabilityRuleTypes';

interface EntityCountEditorProps {
  rule: EntityCountRule;
  updateField: (field: string, value: unknown) => void;
  entityKindOptions: SelectOption[];
  getSubtypesForKind: (kind: string) => SelectOption[];
}

const ANY_OPTION: SelectOption = { value: '', label: 'Any' };

export function EntityCountEditor({
  rule,
  updateField,
  entityKindOptions,
  getSubtypesForKind,
}: Readonly<EntityCountEditorProps>) {
  const handleKindChange = useCallback(
    (v: string | undefined) => {
      updateField('kind', v);
      if (rule.subtype) updateField('subtype', undefined);
    },
    [updateField, rule.subtype],
  );
  const handleSubtypeChange = useCallback(
    (v: string | undefined) => updateField('subtype', v || undefined),
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

  const subtypeOptions = useMemo(
    () => [ANY_OPTION, ...getSubtypesForKind(rule.kind || '')],
    [getSubtypesForKind, rule.kind],
  );

  return (
    <>
      <ReferenceDropdown
        label="Entity Kind"
        value={rule.kind}
        onChange={handleKindChange}
        options={entityKindOptions}
      />
      <ReferenceDropdown
        label="Subtype (optional)"
        value={rule.subtype || ''}
        onChange={handleSubtypeChange}
        options={subtypeOptions}
        placeholder="Any"
      />
      <div className="form-group">
        <label className="label">Min
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
        <label className="label">Max
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
