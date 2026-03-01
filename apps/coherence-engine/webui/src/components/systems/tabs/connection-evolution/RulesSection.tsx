/**
 * RulesSection - List of rule cards with add button.
 */

import React, { useCallback } from "react";
import { RuleCard } from "./RuleCard";
import type { Rule, DomainSchema } from "./types";

interface RulesSectionProps {
  readonly rules: readonly Rule[];
  readonly onAddRule: () => void;
  readonly onUpdateRule: (index: number, rule: Rule) => void;
  readonly onRemoveRule: (index: number) => void;
  readonly schema?: DomainSchema;
}

export function RulesSection({
  rules,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
  schema,
}: RulesSectionProps) {
  return (
    <div className="section">
      <div className="section-title">Rules ({rules.length})</div>
      <div className="section-desc">Conditions and actions based on the metric.</div>

      {rules.map((rule, index) => (
        <RuleCardWrapper
          key={index}
          rule={rule}
          index={index}
          onUpdateRule={onUpdateRule}
          onRemoveRule={onRemoveRule}
          schema={schema}
        />
      ))}

      <button className="btn-add" onClick={onAddRule}>
        + Add Rule
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RuleCardWrapper - wraps callbacks to avoid inline closures in the map
// ---------------------------------------------------------------------------

interface RuleCardWrapperProps {
  readonly rule: Rule;
  readonly index: number;
  readonly onUpdateRule: (index: number, rule: Rule) => void;
  readonly onRemoveRule: (index: number) => void;
  readonly schema?: DomainSchema;
}

function RuleCardWrapper({
  rule,
  index,
  onUpdateRule,
  onRemoveRule,
  schema,
}: RuleCardWrapperProps) {
  const handleChange = useCallback(
    (r: Rule) => onUpdateRule(index, r),
    [onUpdateRule, index],
  );

  const handleRemove = useCallback(
    () => onRemoveRule(index),
    [onRemoveRule, index],
  );

  return (
    <RuleCard
      rule={rule}
      onChange={handleChange}
      onRemove={handleRemove}
      schema={schema}
    />
  );
}
