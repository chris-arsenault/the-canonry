/**
 * useBonusesCrud - CRUD operations for the subtypeBonuses array.
 */

import { useCallback, useMemo } from "react";
import type { SubtypeBonus, SystemConfig } from "./types";

export function useBonusesCrud(
  config: SystemConfig,
  updateConfig: (field: string, value: unknown) => void,
) {
  const subtypeBonuses = useMemo(
    () => config.subtypeBonuses || [],
    [config.subtypeBonuses],
  );

  const addSubtypeBonus = useCallback(() => {
    updateConfig("subtypeBonuses", [
      ...subtypeBonuses,
      { subtype: "", bonus: 0 },
    ]);
  }, [updateConfig, subtypeBonuses]);

  const updateSubtypeBonus = useCallback(
    (index: number, bonus: SubtypeBonus) => {
      const newBonuses = [...subtypeBonuses];
      newBonuses[index] = bonus;
      updateConfig("subtypeBonuses", newBonuses);
    },
    [updateConfig, subtypeBonuses],
  );

  const removeSubtypeBonus = useCallback(
    (index: number) => {
      updateConfig("subtypeBonuses", subtypeBonuses.filter((_, i) => i !== index));
    },
    [updateConfig, subtypeBonuses],
  );

  return { subtypeBonuses, addSubtypeBonus, updateSubtypeBonus, removeSubtypeBonus };
}
