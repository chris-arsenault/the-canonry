/**
 * RelatedModeFields - Single-hop related entity selection fields.
 */

import React, { useCallback } from "react";
import { ReferenceDropdown } from "../index";
import type { DropdownOption, FromSpec } from "./types";
import { DIRECTION_OPTIONS } from "./types";

interface RelatedModeFieldsProps {
  readonly fromSpec: FromSpec | null;
  readonly availableRefOptions: DropdownOption[];
  readonly relationshipKindOptions: DropdownOption[];
  readonly onUpdateFrom: (field: string, value: string) => void;
}

export function RelatedModeFields({
  fromSpec,
  availableRefOptions,
  relationshipKindOptions,
  onUpdateFrom,
}: RelatedModeFieldsProps) {
  const handleRelatedToChange = useCallback(
    (v: string | undefined) => onUpdateFrom("relatedTo", v ?? ""),
    [onUpdateFrom],
  );
  const handleRelKindChange = useCallback(
    (v: string | undefined) => onUpdateFrom("relationshipKind", v ?? ""),
    [onUpdateFrom],
  );
  const handleDirectionChange = useCallback(
    (v: string | undefined) => onUpdateFrom("direction", v ?? "both"),
    [onUpdateFrom],
  );

  return (
    <>
      <ReferenceDropdown
        label="Related To"
        value={
          fromSpec?.relatedTo ?? availableRefOptions[0]?.value ?? "$target"
        }
        onChange={handleRelatedToChange}
        options={availableRefOptions}
        placeholder="Select entity..."
      />
      <ReferenceDropdown
        label="Relationship Kind"
        value={fromSpec?.relationshipKind || ""}
        onChange={handleRelKindChange}
        options={relationshipKindOptions}
        placeholder="Select relationship..."
      />
      <ReferenceDropdown
        label="Direction"
        value={fromSpec?.direction || "both"}
        onChange={handleDirectionChange}
        options={DIRECTION_OPTIONS}
      />
    </>
  );
}
