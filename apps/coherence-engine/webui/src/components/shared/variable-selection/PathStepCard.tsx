/**
 * PathStepCard - Single step in a multi-hop path traversal.
 */

import React, { useCallback } from "react";
import { ReferenceDropdown } from "../index";
import type { DropdownOption, PathStep } from "./types";
import { DIRECTION_OPTIONS } from "./types";

interface PathStepCardProps {
  readonly step: PathStep;
  readonly index: number;
  readonly availableRefOptions: DropdownOption[];
  readonly relationshipKindOptions: DropdownOption[];
  readonly entityKindOptions: DropdownOption[];
  readonly onUpdate: (index: number, step: PathStep) => void;
  readonly onRemove: (index: number) => void;
}

export function PathStepCard({
  step,
  index,
  availableRefOptions,
  relationshipKindOptions,
  entityKindOptions,
  onUpdate,
  onRemove,
}: PathStepCardProps) {
  const handleRemove = useCallback(() => onRemove(index), [onRemove, index]);
  const handleFromChange = useCallback(
    (v: string | undefined) => onUpdate(index, { ...step, from: v }),
    [onUpdate, index, step],
  );
  const handleViaChange = useCallback(
    (v: string | undefined) => onUpdate(index, { ...step, via: v ?? "" }),
    [onUpdate, index, step],
  );
  const handleDirectionChange = useCallback(
    (v: string | undefined) =>
      onUpdate(index, { ...step, direction: v ?? "both" }),
    [onUpdate, index, step],
  );
  const handleTargetKindChange = useCallback(
    (v: string | undefined) =>
      onUpdate(index, { ...step, targetKind: v || undefined }),
    [onUpdate, index, step],
  );

  return (
    <div className="item-card mb-lg">
      <div className="item-card-header p-lg">
        <div className="item-card-icon">&#128279;</div>
        <div className="item-card-info">
          <div className="item-card-title">Step {index + 1}</div>
        </div>
        <button
          className="btn-icon btn-icon-danger"
          onClick={handleRemove}
          title="Remove step"
        >
          &times;
        </button>
      </div>
      <div className="item-card-body">
        <div className="form-grid">
          {index === 0 && (
            <ReferenceDropdown
              label="Start From"
              value={step.from ?? availableRefOptions[0]?.value ?? "$self"}
              onChange={handleFromChange}
              options={availableRefOptions}
              placeholder="Select entity..."
            />
          )}
          <ReferenceDropdown
            label="Via Relationship"
            value={step.via || ""}
            onChange={handleViaChange}
            options={relationshipKindOptions}
            placeholder="Select relationship..."
          />
          <ReferenceDropdown
            label="Direction"
            value={step.direction || "both"}
            onChange={handleDirectionChange}
            options={DIRECTION_OPTIONS}
          />
          <ReferenceDropdown
            label="Target Kind (optional)"
            value={step.targetKind || ""}
            onChange={handleTargetKindChange}
            options={entityKindOptions}
            placeholder="Any kind"
          />
        </div>
      </div>
    </div>
  );
}
