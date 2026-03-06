/**
 * ActionTypeFields - Dispatches to the correct action-type sub-component.
 */

import React from "react";
import { ActionProminenceFields } from "./ActionProminenceFields";
import { ActionRelationshipFields } from "./ActionRelationshipFields";
import { ActionStatusFields } from "./ActionStatusFields";
import { ActionTagFields } from "./ActionTagFields";
import type { RuleAction, DropdownOption, TagDefinition } from "./types";

interface ActionTypeFieldsProps {
  readonly actionType: string | undefined;
  readonly action: RuleAction | undefined;
  readonly onUpdateAction: (field: string, value: unknown) => void;
  readonly entityRefOptions: readonly DropdownOption[];
  readonly relationshipKindOptions: readonly DropdownOption[];
  readonly tagRegistry: readonly TagDefinition[];
}

export function ActionTypeFields({
  actionType,
  action,
  onUpdateAction,
  entityRefOptions,
  relationshipKindOptions,
  tagRegistry,
}: ActionTypeFieldsProps) {
  if (actionType === "adjust_prominence") {
    return (
      <ActionProminenceFields
        delta={action?.delta}
        onUpdateAction={onUpdateAction}
      />
    );
  }

  if (actionType === "create_relationship") {
    return (
      <ActionRelationshipFields
        action={action}
        onUpdateAction={onUpdateAction}
        entityRefOptions={entityRefOptions}
        relationshipKindOptions={relationshipKindOptions}
      />
    );
  }

  if (actionType === "change_status") {
    return (
      <ActionStatusFields
        newStatus={action?.newStatus}
        onUpdateAction={onUpdateAction}
      />
    );
  }

  if (actionType === "set_tag") {
    return (
      <ActionTagFields
        tag={action?.tag}
        actionValue={action?.value}
        onUpdateAction={onUpdateAction}
        tagRegistry={tagRegistry}
      />
    );
  }

  return null;
}
