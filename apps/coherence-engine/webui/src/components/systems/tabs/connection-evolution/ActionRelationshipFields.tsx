/**
 * ActionRelationshipFields - Fields for the "create_relationship" action type.
 */

import React, { useMemo } from "react";
import { ReferenceDropdown, NumberInput } from "../../../shared";
import { useActionFieldHandler } from "./useActionFieldHandler";
import type { DropdownOption, RuleAction } from "./types";

interface ActionRelationshipFieldsProps {
  readonly action: RuleAction | undefined;
  readonly onUpdateAction: (field: string, value: unknown) => void;
  readonly entityRefOptions: readonly DropdownOption[];
  readonly relationshipKindOptions: readonly DropdownOption[];
}

export function ActionRelationshipFields({
  action,
  onUpdateAction,
  entityRefOptions,
  relationshipKindOptions,
}: ActionRelationshipFieldsProps) {
  const { handleString, handleNumber, handleInputText, handleCheckbox } =
    useActionFieldHandler(onUpdateAction);

  const handlers = useMemo(
    () => ({
      kind: handleString("kind"),
      src: handleString("src"),
      dst: handleString("dst"),
      category: handleInputText("category", true),
      strength: handleNumber("strength"),
      bidirectional: handleCheckbox("bidirectional"),
    }),
    [handleString, handleNumber, handleInputText, handleCheckbox],
  );

  const srcValue = action?.src ?? "$member";
  const dstValue = action?.dst ?? "$member2";
  const categoryValue = action?.category ?? "";
  const isBidirectional = action?.bidirectional ?? false;

  return (
    <>
      <ReferenceDropdown
        label="Relationship Kind"
        value={action?.kind}
        onChange={handlers.kind}
        options={relationshipKindOptions}
      />
      <ReferenceDropdown
        label="Source"
        value={srcValue}
        onChange={handlers.src}
        options={entityRefOptions}
      />
      <ReferenceDropdown
        label="Destination"
        value={dstValue}
        onChange={handlers.dst}
        options={entityRefOptions}
      />
      <div className="form-group">
        <label htmlFor="category" className="label">Category</label>
        <input
          id="category"
          type="text"
          value={categoryValue}
          onChange={handlers.category}
          className="input"
          placeholder="Optional"
        />
      </div>
      <div className="form-group">
        <label className="label">Strength
        <NumberInput
          value={action?.strength}
          onChange={handlers.strength}
          min={0}
          max={1}
          allowEmpty
        />
        </label>
      </div>
      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={isBidirectional}
            onChange={handlers.bidirectional}
            className="checkbox"
          />
          Bidirectional
        </label>
      </div>
    </>
  );
}
