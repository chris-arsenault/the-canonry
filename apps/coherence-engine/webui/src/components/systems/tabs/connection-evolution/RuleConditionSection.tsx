/**
 * RuleConditionSection - Condition form fields for a rule card.
 */

import React, { useCallback } from "react";
import { ReferenceDropdown, NumberInput } from "../../../shared";
import type { Rule } from "./types";
import { OPERATOR_OPTIONS } from "./types";

interface RuleConditionSectionProps {
  readonly rule: Rule;
  readonly onChange: (rule: Rule) => void;
  readonly onUpdateCondition: (field: string, value: unknown) => void;
}

export function RuleConditionSection({
  rule,
  onChange,
  onUpdateCondition,
}: RuleConditionSectionProps) {
  const handleThresholdChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      onUpdateCondition("threshold", isNaN(Number(v)) ? v : Number(v));
    },
    [onUpdateCondition],
  );

  const handleProbabilityChange = useCallback(
    (v: number | undefined) => onChange({ ...rule, probability: v ?? 0 }),
    [onChange, rule],
  );

  const handleOperatorChange = useCallback(
    (v: string | undefined) => onUpdateCondition("operator", v),
    [onUpdateCondition],
  );

  const handleMultiplierChange = useCallback(
    (v: number | undefined) => onUpdateCondition("multiplier", v),
    [onUpdateCondition],
  );

  return (
    <div className="form-grid">
      <ReferenceDropdown
        label="Operator"
        value={rule.condition?.operator || ">="}
        onChange={handleOperatorChange}
        options={OPERATOR_OPTIONS}
      />
      <div className="form-group">
        <label htmlFor="threshold" className="label">Threshold</label>
        <input
          id="threshold"
          type="text"
          value={rule.condition?.threshold ?? ""}
          onChange={handleThresholdChange}
          className="input"
          placeholder="Number or 'prominence_scaled'"
        />
      </div>
      {rule.condition?.threshold === "prominence_scaled" && (
        <div className="form-group">
          <label className="label">Multiplier
          <NumberInput
            value={rule.condition?.multiplier}
            onChange={handleMultiplierChange}
            allowEmpty
            placeholder="6"
          />
          </label>
        </div>
      )}
      <div className="form-group">
        <label className="label">Probability
        <NumberInput
          value={rule.probability}
          onChange={handleProbabilityChange}
          min={0}
          max={1}
        />
        </label>
      </div>
    </div>
  );
}
