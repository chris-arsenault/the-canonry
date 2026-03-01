/**
 * RuleActionSection - Action form fields and narration template for a rule card.
 */

import React, { useCallback } from "react";
import { ReferenceDropdown } from "../../../shared";
import { ActionTypeFields } from "./ActionTypeFields";
import { NarrationSection } from "./NarrationSection";
import type { Rule, DropdownOption, TagDefinition } from "./types";
import { ACTION_TYPE_OPTIONS } from "./types";

interface RuleActionSectionProps {
  readonly rule: Rule;
  readonly onChange: (rule: Rule) => void;
  readonly onUpdateAction: (field: string, value: unknown) => void;
  readonly entityRefOptions: readonly DropdownOption[];
  readonly relationshipKindOptions: readonly DropdownOption[];
  readonly tagRegistry: readonly TagDefinition[];
}

export function RuleActionSection({
  rule,
  onChange,
  onUpdateAction,
  entityRefOptions,
  relationshipKindOptions,
  tagRegistry,
}: RuleActionSectionProps) {
  const actionType = rule.action?.type;

  const handleTypeChange = useCallback(
    (v: string | undefined) => onUpdateAction("type", v),
    [onUpdateAction],
  );

  const handleEntityChange = useCallback(
    (v: string | undefined) => onUpdateAction("entity", v),
    [onUpdateAction],
  );

  const handleBetweenMatchingChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...rule, betweenMatching: e.target.checked }),
    [onChange, rule],
  );

  const showEntityRef =
    actionType === "adjust_prominence" ||
    actionType === "change_status" ||
    actionType === "set_tag";

  return (
    <>
      <div className="mt-xl">
        <span className="label">Action</span>
        <div className="form-grid">
          <ReferenceDropdown
            label="Type"
            value={actionType || "adjust_prominence"}
            onChange={handleTypeChange}
            options={ACTION_TYPE_OPTIONS}
          />
          {showEntityRef && (
            <ReferenceDropdown
              label="Entity"
              value={rule.action?.entity || "$self"}
              onChange={handleEntityChange}
              options={entityRefOptions}
            />
          )}
          <ActionTypeFields
            actionType={actionType}
            action={rule.action}
            onUpdateAction={onUpdateAction}
            entityRefOptions={entityRefOptions}
            relationshipKindOptions={relationshipKindOptions}
            tagRegistry={tagRegistry}
          />
        </div>
      </div>

      {actionType === "create_relationship" && (
        <div className="mt-xl">
          <label className="label">
            <input
              type="checkbox"
              checked={rule.betweenMatching || false}
              onChange={handleBetweenMatchingChange}
              className="mr-md"
            />
            Between Matching (create relationships between all entity pairs that pass condition)
          </label>
        </div>
      )}

      <NarrationSection rule={rule} onChange={onChange} />
    </>
  );
}
