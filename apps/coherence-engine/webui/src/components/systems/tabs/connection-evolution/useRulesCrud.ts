/**
 * useRulesCrud - CRUD operations for the rules array.
 */

import { useCallback, useMemo } from "react";
import type { Rule, SystemConfig } from "./types";

export function useRulesCrud(
  config: SystemConfig,
  updateConfig: (field: string, value: unknown) => void,
) {
  const rules = useMemo(() => config.rules || [], [config.rules]);

  const addRule = useCallback(() => {
    updateConfig("rules", [
      ...rules,
      {
        condition: { operator: ">=", threshold: 1 },
        probability: 0.1,
        action: { type: "adjust_prominence", entity: "$self", delta: 0.2 },
      },
    ]);
  }, [updateConfig, rules]);

  const updateRule = useCallback(
    (index: number, rule: Rule) => {
      const newRules = [...rules];
      newRules[index] = rule;
      updateConfig("rules", newRules);
    },
    [updateConfig, rules],
  );

  const removeRule = useCallback(
    (index: number) => {
      updateConfig("rules", rules.filter((_, i) => i !== index));
    },
    [updateConfig, rules],
  );

  return { rules, addRule, updateRule, removeRule };
}
