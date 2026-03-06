/**
 * ConnectionEvolutionTab - Configuration for connection evolution systems.
 *
 * Decomposed into sub-components under ./connection-evolution/ for
 * complexity and line-count compliance.
 */

import React from "react";
import { MetricSection } from "./connection-evolution/MetricSection";
import { RulesSection } from "./connection-evolution/RulesSection";
import { SubtypeBonusesSection } from "./connection-evolution/SubtypeBonusesSection";
import { useConnectionEvolutionState } from "./connection-evolution/useConnectionEvolutionState";
import type { System, DomainSchema } from "./connection-evolution/types";

interface ConnectionEvolutionTabProps {
  readonly system: System;
  readonly onChange: (system: System) => void;
  readonly schema?: DomainSchema;
}

export function ConnectionEvolutionTab({
  system,
  onChange,
  schema,
}: ConnectionEvolutionTabProps) {
  const state = useConnectionEvolutionState(system, onChange, schema);

  return (
    <div>
      <MetricSection
        config={state.config}
        onUpdateMetric={state.updateMetric}
        relationshipKindOptions={state.relationshipKindOptions}
      />
      <RulesSection
        rules={state.rules}
        onAddRule={state.addRule}
        onUpdateRule={state.updateRule}
        onRemoveRule={state.removeRule}
        schema={schema}
      />
      <SubtypeBonusesSection
        subtypeBonuses={state.subtypeBonuses}
        selectionKind={state.selectionKind}
        getSubtypeOptions={state.getSubtypeOptions}
        onAddBonus={state.addSubtypeBonus}
        onUpdateBonus={state.updateSubtypeBonus}
        onRemoveBonus={state.removeSubtypeBonus}
      />
    </div>
  );
}
