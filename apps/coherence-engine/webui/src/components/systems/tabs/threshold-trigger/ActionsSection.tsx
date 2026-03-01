/**
 * ActionsSection - Actions/mutations block for threshold trigger systems
 */

import React, { useCallback } from "react";
import MutationCard, { DEFAULT_MUTATION_TYPES } from "../../../shared/MutationCard";
import { createAction } from "./createAction";
import type { Mutation, MutationTypeOption, PressureEntry, Schema } from "./types";
import type { MutationSchema } from "../../../shared/mutationUtils";

const TRIGGER_MUTATION_TYPES: MutationTypeOption[] = DEFAULT_MUTATION_TYPES;

// ---------------------------------------------------------------------------
// ActionItem - renders a single action card with optional extras
// ---------------------------------------------------------------------------

interface ActionItemProps {
  readonly actionItem: Mutation;
  readonly index: number;
  readonly onUpdate: (index: number, action: Mutation) => void;
  readonly onRemove: (index: number) => void;
  readonly schema: Schema;
  readonly pressures: PressureEntry[];
  readonly entityOptions: ReadonlyArray<{ value: string; label: string }>;
  readonly createMutation: (type: string) => Mutation;
}

function ActionItem({
  actionItem,
  index,
  onUpdate,
  onRemove,
  schema,
  pressures,
  entityOptions,
  createMutation,
}: ActionItemProps) {
  const handleChange = useCallback(
    (a: Mutation) => onUpdate(index, a),
    [index, onUpdate],
  );

  const handleRemove = useCallback(
    () => onRemove(index),
    [index, onRemove],
  );

  const handleBetweenMatchingChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(index, { ...actionItem, betweenMatching: e.target.checked } as Mutation & { betweenMatching: boolean });
    },
    [actionItem, index, onUpdate],
  );

  return (
    <div className="mb-lg">
      <MutationCard
        mutation={actionItem}
        onChange={handleChange}
        onRemove={handleRemove}
        schema={schema as MutationSchema}
        pressures={pressures}
        entityOptions={entityOptions}
        typeOptions={TRIGGER_MUTATION_TYPES}
        createMutation={createMutation}
        titlePrefix="Action"
      />
      {actionItem.type === "create_relationship" && (
        <label className="checkbox-label mt-md">
          <input
            type="checkbox"
            checked={(actionItem as Mutation & { betweenMatching?: boolean }).betweenMatching || false}
            onChange={handleBetweenMatchingChange}
            className="checkbox"
          />
          Between matching entities
        </label>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActionsSection
// ---------------------------------------------------------------------------

interface ActionsSectionProps {
  readonly actions: Mutation[];
  readonly onUpdate: (field: string, value: unknown) => void;
  readonly schema: Schema;
  readonly pressures: PressureEntry[];
  readonly entityOptions: ReadonlyArray<{ value: string; label: string }>;
}

export function ActionsSection({
  actions,
  onUpdate,
  schema,
  pressures,
  entityOptions,
}: ActionsSectionProps) {
  const createActionForType = useCallback(
    (type: string) => createAction(type, pressures),
    [pressures],
  );

  const updateAction = useCallback(
    (index: number, action: Mutation) => {
      const next = [...actions];
      next[index] = action;
      onUpdate("actions", next);
    },
    [actions, onUpdate],
  );

  const removeAction = useCallback(
    (index: number) => {
      onUpdate("actions", actions.filter((_, i) => i !== index));
    },
    [actions, onUpdate],
  );

  const handleAddActionSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!e.target.value) return;
      onUpdate("actions", [...actions, createAction(e.target.value, pressures)]);
    },
    [actions, onUpdate, pressures],
  );

  return (
    <div className="section">
      <div className="section-title">Actions ({actions.length})</div>
      <div className="section-desc">
        Mutations applied to each matching entity (or clusters when configured).
      </div>

      {actions.map((actionItem, index) => (
        <ActionItem
          key={index}
          actionItem={actionItem}
          index={index}
          onUpdate={updateAction}
          onRemove={removeAction}
          schema={schema}
          pressures={pressures}
          entityOptions={entityOptions}
          createMutation={createActionForType}
        />
      ))}

      <div className="form-group mt-lg">
        <select
          className="select"
          value=""
          onChange={handleAddActionSelect}
        >
          <option value="">+ Add action...</option>
          {TRIGGER_MUTATION_TYPES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
