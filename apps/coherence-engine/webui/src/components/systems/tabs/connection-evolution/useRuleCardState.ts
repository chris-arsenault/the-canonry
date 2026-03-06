/**
 * useRuleCardState - State management hook for RuleCard.
 */

import React, { useCallback, useMemo } from "react";
import { useExpandBoolean } from "../../../shared";
import type { Rule, DomainSchema } from "./types";

export function useRuleCardState(
  rule: Rule,
  onChange: (rule: Rule) => void,
  onRemove: () => void,
  schema?: DomainSchema,
) {
  const { expanded, toggle } = useExpandBoolean();

  const relationshipKindOptions = useMemo(
    () =>
      (schema?.relationshipKinds || []).map((rk) => ({
        value: rk.kind,
        label: rk.description || rk.kind,
      })),
    [schema?.relationshipKinds],
  );

  const tagRegistry = useMemo(
    () => schema?.tagRegistry || [],
    [schema?.tagRegistry],
  );

  const updateCondition = useCallback(
    (field: string, value: unknown) => {
      onChange({
        ...rule,
        condition: { ...rule.condition, [field]: value },
      });
    },
    [onChange, rule],
  );

  const updateAction = useCallback(
    (field: string, value: unknown) => {
      onChange({ ...rule, action: { ...rule.action, [field]: value } });
    },
    [onChange, rule],
  );

  const handleRemoveClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove();
    },
    [onRemove],
  );

  const handleToggle = useCallback(() => toggle(), [toggle]);

  return {
    expanded,
    handleToggle,
    handleRemoveClick,
    relationshipKindOptions,
    tagRegistry,
    updateCondition,
    updateAction,
  };
}
