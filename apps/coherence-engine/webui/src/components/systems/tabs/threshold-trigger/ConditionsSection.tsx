/**
 * ConditionsSection - Conditions block for threshold trigger systems
 */

import React, { useCallback } from "react";
import { ApplicabilityRuleCard } from "../../../generators/applicability/ApplicabilityRuleCard";
import { AddRuleButton } from "../../../generators/applicability/AddRuleButton";
import { createNewRule } from "../../../generators/applicability/createNewRule";
import type { ApplicabilityRule, Schema, PressureEntry } from "./types";

interface ConditionsSectionProps {
  readonly conditions: ApplicabilityRule[];
  readonly onUpdate: (field: string, value: unknown) => void;
  readonly schema: Schema;
  readonly pressures: PressureEntry[];
}

export function ConditionsSection({
  conditions,
  onUpdate,
  schema,
  pressures,
}: ConditionsSectionProps) {
  const addCondition = useCallback(
    (type: string) => {
      const newRule = createNewRule(type, pressures) as ApplicabilityRule;
      onUpdate("conditions", [...conditions, newRule]);
    },
    [conditions, onUpdate, pressures],
  );

  const updateCondition = useCallback(
    (index: number, cond: ApplicabilityRule) => {
      const next = [...conditions];
      next[index] = cond;
      onUpdate("conditions", next);
    },
    [conditions, onUpdate],
  );

  const removeCondition = useCallback(
    (index: number) => {
      onUpdate("conditions", conditions.filter((_, i) => i !== index));
    },
    [conditions, onUpdate],
  );

  return (
    <div className="section">
      <div className="section-title">Conditions ({conditions.length})</div>
      <div className="section-desc">
        All conditions must pass for an entity to be included in the trigger.
      </div>

      {conditions.length === 0 ? (
        <div className="empty-state-compact">No conditions defined.</div>
      ) : (
        conditions.map((cond, index) => (
          <ApplicabilityRuleCard
            key={index}
            rule={cond}
            onChange={(c: ApplicabilityRule) => updateCondition(index, c)}
            onRemove={() => removeCondition(index)}
            schema={schema}
            pressures={pressures}
          />
        ))
      )}

      <AddRuleButton onAdd={addCondition} />
    </div>
  );
}
