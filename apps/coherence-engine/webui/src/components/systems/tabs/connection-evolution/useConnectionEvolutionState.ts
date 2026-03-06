/**
 * useConnectionEvolutionState - Orchestrator hook for ConnectionEvolutionTab.
 *
 * Composes useRulesCrud and useBonusesCrud with metric/schema-derived state.
 */

import { useCallback, useMemo } from "react";
import { useRulesCrud } from "./useRulesCrud";
import { useBonusesCrud } from "./useBonusesCrud";
import type { System, DomainSchema, DropdownOption } from "./types";

export function useConnectionEvolutionState(
  system: System,
  onChange: (system: System) => void,
  schema?: DomainSchema,
) {
  const config = system.config;

  const selectionKind =
    config.selection?.kind && config.selection.kind !== "any"
      ? config.selection.kind
      : undefined;

  const relationshipKindOptions = useMemo(
    () =>
      (schema?.relationshipKinds || []).map((rk) => ({
        value: rk.kind,
        label: rk.description || rk.kind,
      })),
    [schema?.relationshipKinds],
  );

  const getSubtypeOptions = useCallback(
    (kind: string | undefined): DropdownOption[] => {
      if (!kind) return [];
      const ek = (schema?.entityKinds || []).find((e) => e.kind === kind);
      if (!ek?.subtypes) return [];
      return ek.subtypes.map((st) => ({ value: st.id, label: st.name || st.id }));
    },
    [schema?.entityKinds],
  );

  const updateConfig = useCallback(
    (field: string, value: unknown) => {
      onChange({ ...system, config: { ...config, [field]: value } });
    },
    [onChange, system, config],
  );

  const updateMetric = useCallback(
    (field: string, value: unknown) => {
      updateConfig("metric", { ...config.metric, [field]: value });
    },
    [updateConfig, config.metric],
  );

  const rulesCrud = useRulesCrud(config, updateConfig);
  const bonusesCrud = useBonusesCrud(config, updateConfig);

  return {
    config,
    selectionKind,
    relationshipKindOptions,
    getSubtypeOptions,
    updateMetric,
    ...rulesCrud,
    ...bonusesCrud,
  };
}
