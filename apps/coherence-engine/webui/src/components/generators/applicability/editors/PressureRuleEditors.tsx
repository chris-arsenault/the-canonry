/**
 * Rule editors for pressure-related applicability rules:
 * - PressureRangeEditor (pressure)
 * - PressureAnyAboveEditor (pressure_any_above)
 * - PressureCompareEditor (pressure_compare)
 */

import React, { useCallback, useMemo } from 'react';
import { ReferenceDropdown, ChipSelect, NumberInput } from '../../../shared';
import type { SelectOption, PressureRule, PressureAnyAboveRule, PressureCompareRule } from '../applicabilityRuleTypes';

// ---------------------------------------------------------------------------
// Pressure Range
// ---------------------------------------------------------------------------

interface PressureRangeEditorProps {
  rule: PressureRule;
  updateField: (field: string, value: unknown) => void;
  pressureOptions: SelectOption[];
}

export function PressureRangeEditor({ rule, updateField, pressureOptions }: Readonly<PressureRangeEditorProps>) {
  const handlePressureChange = useCallback(
    (v: string | undefined) => updateField('pressureId', v),
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
        label="Pressure"
        value={rule.pressureId}
        onChange={handlePressureChange}
        options={pressureOptions}
      />
      <div className="form-group">
        <label className="label">Min Value
        <NumberInput
          value={rule.min}
          onChange={handleMinChange}
          min={-100}
          max={100}
          integer
          allowEmpty
          placeholder="0"
        />
        </label>
      </div>
      <div className="form-group">
        <label className="label">Max Value
        <NumberInput
          value={rule.max}
          onChange={handleMaxChange}
          min={-100}
          max={100}
          integer
          allowEmpty
          placeholder="100"
        />
        </label>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Pressure Any Above
// ---------------------------------------------------------------------------

interface PressureAnyAboveEditorProps {
  rule: PressureAnyAboveRule;
  updateField: (field: string, value: unknown) => void;
  pressureOptions: SelectOption[];
}

export function PressureAnyAboveEditor({ rule, updateField, pressureOptions }: Readonly<PressureAnyAboveEditorProps>) {
  const pressureIds = useMemo(() => rule.pressureIds || [], [rule.pressureIds]);

  const handlePressureIdsChange = useCallback(
    (v: string[]) => updateField('pressureIds', v),
    [updateField],
  );
  const handleThresholdChange = useCallback(
    (v: number | undefined) => updateField('threshold', v ?? 0),
    [updateField],
  );

  return (
    <>
      <div className="grid-col-full">
        <ChipSelect
          label="Pressures"
          value={pressureIds}
          onChange={handlePressureIdsChange}
          options={pressureOptions}
          placeholder="+ Add pressure"
        />
      </div>
      <div className="form-group">
        <label className="label">Threshold
        <NumberInput
          value={rule.threshold}
          onChange={handleThresholdChange}
          min={-100}
          max={100}
          integer
          placeholder="50"
        />
        </label>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Pressure Compare
// ---------------------------------------------------------------------------

const OPERATOR_OPTIONS: SelectOption[] = [
  { value: '>', label: '>' },
  { value: '>=', label: '>=' },
  { value: '<', label: '<' },
  { value: '<=', label: '<=' },
  { value: '==', label: '==' },
  { value: '!=', label: '!=' },
];

interface PressureCompareEditorProps {
  rule: PressureCompareRule;
  updateField: (field: string, value: unknown) => void;
  pressureOptions: SelectOption[];
}

export function PressureCompareEditor({ rule, updateField, pressureOptions }: Readonly<PressureCompareEditorProps>) {
  const handlePressureAChange = useCallback(
    (v: string | undefined) => updateField('pressureA', v),
    [updateField],
  );
  const handleOperatorChange = useCallback(
    (v: string | undefined) => updateField('operator', v),
    [updateField],
  );
  const handlePressureBChange = useCallback(
    (v: string | undefined) => updateField('pressureB', v),
    [updateField],
  );

  return (
    <>
      <ReferenceDropdown
        label="Pressure A"
        value={rule.pressureA}
        onChange={handlePressureAChange}
        options={pressureOptions}
      />
      <ReferenceDropdown
        label="Operator"
        value={rule.operator || '>'}
        onChange={handleOperatorChange}
        options={OPERATOR_OPTIONS}
      />
      <ReferenceDropdown
        label="Pressure B"
        value={rule.pressureB}
        onChange={handlePressureBChange}
        options={pressureOptions}
      />
    </>
  );
}
