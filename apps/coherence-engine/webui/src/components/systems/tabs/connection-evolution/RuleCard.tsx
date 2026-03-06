/**
 * RuleCard - Expandable card for rule configuration.
 */

import React from "react";
import { expandableProps } from "../../../shared";
import { RuleCardHeader } from "./RuleCardHeader";
import { RuleConditionSection } from "./RuleConditionSection";
import { RuleActionSection } from "./RuleActionSection";
import { useRuleCardState } from "./useRuleCardState";
import type { Rule, DomainSchema } from "./types";
import { ENTITY_REF_OPTIONS } from "./types";

interface RuleCardProps {
  readonly rule: Rule;
  readonly onChange: (rule: Rule) => void;
  readonly onRemove: () => void;
  readonly schema?: DomainSchema;
}

export function RuleCard({ rule, onChange, onRemove, schema }: RuleCardProps) {
  const state = useRuleCardState(rule, onChange, onRemove, schema);

  return (
    <div className="item-card">
      <div className="item-card-header" {...expandableProps(state.handleToggle)}>
        <RuleCardHeader rule={rule} expanded={state.expanded} />
        <button
          className="btn-icon btn-icon-danger"
          onClick={state.handleRemoveClick}
        >
          x
        </button>
      </div>

      {state.expanded && (
        <div className="item-card-body">
          <RuleConditionSection
            rule={rule}
            onChange={onChange}
            onUpdateCondition={state.updateCondition}
          />
          <RuleActionSection
            rule={rule}
            onChange={onChange}
            onUpdateAction={state.updateAction}
            entityRefOptions={ENTITY_REF_OPTIONS}
            relationshipKindOptions={state.relationshipKindOptions}
            tagRegistry={state.tagRegistry}
          />
        </div>
      )}
    </div>
  );
}
