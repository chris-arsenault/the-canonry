/**
 * PathModeFields - Multi-hop path step list with add/remove.
 */

import React from "react";
import type { DropdownOption, PathSpec, PathStep } from "./types";
import { PathStepCard } from "./PathStepCard";

interface PathModeFieldsProps {
  readonly pathSpec: PathSpec | null;
  readonly availableRefOptions: DropdownOption[];
  readonly relationshipKindOptions: DropdownOption[];
  readonly entityKindOptions: DropdownOption[];
  readonly onUpdatePathStep: (index: number, step: PathStep) => void;
  readonly onRemovePathStep: (index: number) => void;
  readonly onAddPathStep: () => void;
}

export function PathModeFields({
  pathSpec,
  availableRefOptions,
  relationshipKindOptions,
  entityKindOptions,
  onUpdatePathStep,
  onRemovePathStep,
  onAddPathStep,
}: PathModeFieldsProps) {
  const steps = pathSpec?.path ?? [];

  return (
    <div className="mt-xl">
      {steps.map((step, index) => (
        <PathStepCard
          key={index}
          step={step}
          index={index}
          availableRefOptions={availableRefOptions}
          relationshipKindOptions={relationshipKindOptions}
          entityKindOptions={entityKindOptions}
          onUpdate={onUpdatePathStep}
          onRemove={onRemovePathStep}
        />
      ))}
      <button className="btn-add" onClick={onAddPathStep}>
        + Add Step
      </button>
    </div>
  );
}
