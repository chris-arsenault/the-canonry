/**
 * Rule editors for temporal applicability rules:
 * - TimeElapsedEditor
 * - GrowthPhasesCompleteEditor
 * - EraMatchEditor
 * - RandomChanceEditor
 * - CooldownElapsedEditor
 * - CreationsPerEpochEditor
 */

import React, { useCallback, useMemo } from 'react';
import { ReferenceDropdown, ChipSelect, NumberInput } from '../../../shared';
import type { SelectOption, TimeElapsedRule, GrowthPhasesCompleteRule, EraMatchRule, RandomChanceRule, CooldownElapsedRule, CreationsPerEpochRule } from '../applicabilityRuleTypes';

// ---------------------------------------------------------------------------
// Time Elapsed
// ---------------------------------------------------------------------------

const SINCE_OPTIONS: SelectOption[] = [
  { value: 'updated', label: 'Updated' },
  { value: 'created', label: 'Created' },
];

interface TimeElapsedEditorProps {
  rule: TimeElapsedRule;
  updateField: (field: string, value: unknown) => void;
}

export function TimeElapsedEditor({ rule, updateField }: Readonly<TimeElapsedEditorProps>) {
  const handleMinTicksChange = useCallback(
    (v: number | undefined) => updateField('minTicks', v ?? 0),
    [updateField],
  );
  const handleSinceChange = useCallback(
    (v: string | undefined) => updateField('since', v),
    [updateField],
  );

  return (
    <>
      <div className="form-group">
        <label className="label">Min Ticks
        <NumberInput
          value={rule.minTicks}
          onChange={handleMinTicksChange}
          min={0}
          integer
        />
        </label>
      </div>
      <ReferenceDropdown
        label="Since"
        value={rule.since || 'updated'}
        onChange={handleSinceChange}
        options={SINCE_OPTIONS}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Growth Phases Complete
// ---------------------------------------------------------------------------

interface GrowthPhasesCompleteEditorProps {
  rule: GrowthPhasesCompleteRule;
  updateField: (field: string, value: unknown) => void;
  eraOptions: SelectOption[];
}

export function GrowthPhasesCompleteEditor({
  rule,
  updateField,
  eraOptions,
}: Readonly<GrowthPhasesCompleteEditorProps>) {
  const handleMinPhasesChange = useCallback(
    (v: number | undefined) => updateField('minPhases', v ?? 0),
    [updateField],
  );
  const handleEraIdDropdownChange = useCallback(
    (v: string | undefined) => updateField('eraId', v || undefined),
    [updateField],
  );
  const handleEraIdTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => updateField('eraId', e.target.value || undefined),
    [updateField],
  );

  const eraDropdownOptions = useMemo(
    () => [{ value: '', label: 'Current era' }, ...eraOptions],
    [eraOptions],
  );

  return (
    <>
      <div className="form-group">
        <label className="label">Min Growth Phases
        <NumberInput
          value={rule.minPhases}
          onChange={handleMinPhasesChange}
          min={0}
          integer
        />
        </label>
      </div>
      {eraOptions.length > 0 ? (
        <ReferenceDropdown
          label="Era (optional)"
          value={rule.eraId || ''}
          onChange={handleEraIdDropdownChange}
          options={eraDropdownOptions}
          placeholder="Current era"
        />
      ) : (
        <div className="form-group">
          <label htmlFor="era-id-optional" className="label">Era Id (optional)</label>
          <input
            id="era-id-optional"
            type="text"
            value={rule.eraId || ''}
            onChange={handleEraIdTextChange}
            className="input"
            placeholder="Current era"
          />
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Era Match
// ---------------------------------------------------------------------------

interface EraMatchEditorProps {
  rule: EraMatchRule;
  updateField: (field: string, value: unknown) => void;
  eraOptions: SelectOption[];
}

export function EraMatchEditor({ rule, updateField, eraOptions }: Readonly<EraMatchEditorProps>) {
  const eras = useMemo(() => rule.eras || [], [rule.eras]);

  const handleErasChange = useCallback(
    (v: string[]) => updateField('eras', v),
    [updateField],
  );

  return (
    <div className="grid-col-full">
      <ChipSelect
        label="Eras"
        value={eras}
        onChange={handleErasChange}
        options={eraOptions}
        placeholder="+ Add era"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Random Chance
// ---------------------------------------------------------------------------

interface RandomChanceEditorProps {
  rule: RandomChanceRule;
  updateField: (field: string, value: unknown) => void;
}

export function RandomChanceEditor({ rule, updateField }: Readonly<RandomChanceEditorProps>) {
  const chancePercent = Math.round((rule.chance ?? 0.5) * 100);

  const handleRangeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateField('chance', parseInt(e.target.value, 10) / 100);
    },
    [updateField],
  );

  const handleNumberChange = useCallback(
    (v: number | undefined) => {
      updateField('chance', Math.max(0, Math.min(100, v ?? 0)) / 100);
    },
    [updateField],
  );

  return (
    <div className="form-group grid-col-full">
      <span className="label">Chance (%)</span>
      <div className="flex items-center gap-lg">
        <input
          type="range"
          min="0"
          max="100"
          value={chancePercent}
          onChange={handleRangeChange}
          className="flex-1"
        />
        <NumberInput
          value={chancePercent}
          onChange={handleNumberChange}
          min={0}
          max={100}
          integer
          className="input number-input-narrow"
        />
        <span>%</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cooldown Elapsed
// ---------------------------------------------------------------------------

interface CooldownElapsedEditorProps {
  rule: CooldownElapsedRule;
  updateField: (field: string, value: unknown) => void;
}

export function CooldownElapsedEditor({ rule, updateField }: Readonly<CooldownElapsedEditorProps>) {
  const handleCooldownChange = useCallback(
    (v: number | undefined) => updateField('cooldownTicks', v ?? 0),
    [updateField],
  );

  return (
    <div className="form-group">
      <label className="label">Cooldown (ticks)
      <NumberInput
        value={rule.cooldownTicks}
        onChange={handleCooldownChange}
        min={1}
        integer
        placeholder="10"
      />
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Creations Per Epoch
// ---------------------------------------------------------------------------

interface CreationsPerEpochEditorProps {
  rule: CreationsPerEpochRule;
  updateField: (field: string, value: unknown) => void;
}

export function CreationsPerEpochEditor({ rule, updateField }: Readonly<CreationsPerEpochEditorProps>) {
  const handleMaxChange = useCallback(
    (v: number | undefined) => updateField('maxPerEpoch', v ?? 0),
    [updateField],
  );

  return (
    <div className="form-group">
      <label className="label">Max Creations Per Epoch
      <NumberInput
        value={rule.maxPerEpoch}
        onChange={handleMaxChange}
        min={1}
        integer
        placeholder="3"
      />
      </label>
    </div>
  );
}
