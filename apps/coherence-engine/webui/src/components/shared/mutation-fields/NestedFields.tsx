/**
 * Fields for "for_each_related" and "conditional" mutation types.
 * These contain nested MutationCard instances.
 */

import React, { useCallback, useMemo } from "react";
import { ReferenceDropdown } from "../index";
import type {
  Mutation,
  EntityRefOption,
  MutationTypeOption,
  MutationSchema,
  PressureEntry,
} from "../mutationUtils";
import { DIRECTION_OPTIONS } from "../mutationUtils";

// ---------------------------------------------------------------------------
// Shared types for nested mutation rendering
// ---------------------------------------------------------------------------

export type MutationCardComponentType = React.ComponentType<{
  readonly mutation: Mutation;
  readonly onChange: (m: Mutation) => void;
  readonly onRemove: () => void;
  readonly schema: MutationSchema;
  readonly pressures: PressureEntry[];
  readonly entityOptions: ReadonlyArray<string | EntityRefOption>;
  readonly typeOptions: MutationTypeOption[];
  readonly createMutation?: (type: string) => Mutation;
}>;

/** Domain object grouping the shared context passed to nested action lists */
interface NestedContext {
  readonly schema: MutationSchema;
  readonly pressures: PressureEntry[];
  readonly createMutation?: (type: string) => Mutation;
  readonly MutationCardComponent: MutationCardComponentType;
}

// ---------------------------------------------------------------------------
// NestedActionItem
// ---------------------------------------------------------------------------

interface NestedActionItemProps {
  readonly nestedAction: Mutation;
  readonly idx: number;
  readonly actions: Mutation[];
  readonly field: string;
  readonly update: (field: string, value: Mutation[]) => void;
  readonly entityRefs: EntityRefOption[];
  readonly types: MutationTypeOption[];
  readonly colorClass: string;
  readonly ctx: NestedContext;
}

function NestedActionItem({
  nestedAction,
  idx,
  actions,
  field,
  update,
  entityRefs,
  types,
  colorClass,
  ctx,
}: NestedActionItemProps) {
  const handleChange = useCallback(
    (a: Mutation) => {
      const newActions = [...actions];
      newActions[idx] = a;
      update(field, newActions);
    },
    [actions, idx, field, update],
  );
  const handleRemove = useCallback(() => {
    update(
      field,
      actions.filter((_, i) => i !== idx),
    );
  }, [actions, idx, field, update]);

  const { MutationCardComponent, schema, pressures, createMutation } = ctx;

  return (
    <div className={`mc-nested-action ${colorClass}`}>
      <MutationCardComponent
        mutation={nestedAction}
        onChange={handleChange}
        onRemove={handleRemove}
        schema={schema}
        pressures={pressures}
        entityOptions={entityRefs}
        typeOptions={types}
        createMutation={createMutation}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// NestedActionList
// ---------------------------------------------------------------------------

interface NestedActionListProps {
  readonly actions: Mutation[];
  readonly field: string;
  readonly update: (field: string, value: Mutation[]) => void;
  readonly entityRefs: EntityRefOption[];
  readonly types: MutationTypeOption[];
  readonly colorClass: string;
  readonly addLabel: string;
  readonly defaultEntity: string;
  readonly ctx: NestedContext;
}

function NestedActionList({
  actions,
  field,
  update,
  entityRefs,
  types,
  colorClass,
  addLabel,
  defaultEntity,
  ctx,
}: NestedActionListProps) {
  const handleAdd = useCallback(() => {
    update(field, [
      ...actions,
      { type: "set_tag", entity: defaultEntity, tag: "" },
    ]);
  }, [actions, field, update, defaultEntity]);

  return (
    <>
      {actions.map((nestedAction, idx) => (
        <NestedActionItem
          key={idx}
          nestedAction={nestedAction}
          idx={idx}
          actions={actions}
          field={field}
          update={update}
          entityRefs={entityRefs}
          types={types}
          colorClass={colorClass}
          ctx={ctx}
        />
      ))}
      <button className="btn-add mc-nested-add-btn" onClick={handleAdd}>
        + {addLabel}
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// ForEachRelatedFields - text inputs
// ---------------------------------------------------------------------------

interface ForEachTextFieldsProps {
  readonly mutation: Mutation;
  readonly update: (field: string, value: string | undefined) => void;
}

function ForEachTextFields({ mutation, update }: ForEachTextFieldsProps) {
  const handleTargetKindChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      update("targetKind", e.target.value || undefined),
    [update],
  );
  const handleTargetSubtypeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      update("targetSubtype", e.target.value || undefined),
    [update],
  );

  return (
    <>
      <div className="form-group">
        <label htmlFor="target-kind-optional" className="label">
          Target Kind (optional)
        </label>
        <input
          id="target-kind-optional"
          type="text"
          value={mutation.targetKind || ""}
          onChange={handleTargetKindChange}
          className="input"
          placeholder="e.g., artifact"
        />
      </div>
      <div className="form-group">
        <label htmlFor="target-subtype-optional" className="label">
          Target Subtype (optional)
        </label>
        <input
          id="target-subtype-optional"
          type="text"
          value={mutation.targetSubtype || ""}
          onChange={handleTargetSubtypeChange}
          className="input"
          placeholder="e.g., weapon"
        />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// ForEachRelatedFields
// ---------------------------------------------------------------------------

interface ForEachRelatedFieldsProps {
  readonly mutation: Mutation;
  readonly update: (field: string, value: Mutation[] | string | undefined) => void;
  readonly entityRefs: EntityRefOption[];
  readonly relationshipKindOptions: ReadonlyArray<{ value: string; label: string }>;
  readonly types: MutationTypeOption[];
  readonly schema: MutationSchema;
  readonly pressures: PressureEntry[];
  readonly createMutation?: (type: string) => Mutation;
  readonly MutationCardComponent: MutationCardComponentType;
}

export function ForEachRelatedFields({
  mutation,
  update,
  entityRefs,
  relationshipKindOptions,
  types,
  schema,
  pressures,
  createMutation,
  MutationCardComponent,
}: ForEachRelatedFieldsProps) {
  const handleRelChange = useCallback(
    (v: string | undefined) => update("relationship", v),
    [update],
  );
  const handleDirChange = useCallback(
    (v: string | undefined) => update("direction", v),
    [update],
  );

  const nestedActions = mutation.actions || [];
  const nestedEntityRefs = useMemo(
    () => [...entityRefs, { value: "$related", label: "$related" }],
    [entityRefs],
  );
  const nestedTypes = useMemo(
    () => types.filter((t) => t.value !== "for_each_related"),
    [types],
  );
  const ctx = useMemo(
    () => ({ schema, pressures, createMutation, MutationCardComponent }),
    [schema, pressures, createMutation, MutationCardComponent],
  );

  return (
    <>
      <ReferenceDropdown
        label="Relationship"
        value={mutation.relationship || ""}
        onChange={handleRelChange}
        options={relationshipKindOptions}
        placeholder="Select relationship..."
      />
      <ReferenceDropdown
        label="Direction"
        value={mutation.direction || "both"}
        onChange={handleDirChange}
        options={DIRECTION_OPTIONS}
      />
      <ForEachTextFields mutation={mutation} update={update} />
      <div className="mc-nested-container mt-xl">
        <label className="label">
          Nested Actions ({nestedActions.length})
        </label>
        <div className="info-box-text mc-nested-info">
          Actions executed for each related entity. Use{" "}
          <code>$related</code> to reference the current entity.
        </div>
        <NestedActionList
          actions={nestedActions}
          field="actions"
          update={update}
          entityRefs={nestedEntityRefs}
          types={nestedTypes}
          colorClass="mc-nested-action-purple"
          addLabel="Add Nested Action"
          defaultEntity="$related"
          ctx={ctx}
        />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// ConditionalFields
// ---------------------------------------------------------------------------

interface ConditionalFieldsProps {
  readonly mutation: Mutation;
  readonly update: (field: string, value: Mutation[]) => void;
  readonly entityRefs: EntityRefOption[];
  readonly types: MutationTypeOption[];
  readonly schema: MutationSchema;
  readonly pressures: PressureEntry[];
  readonly createMutation?: (type: string) => Mutation;
  readonly MutationCardComponent: MutationCardComponentType;
}

export function ConditionalFields({
  mutation,
  update,
  entityRefs,
  types,
  schema,
  pressures,
  createMutation,
  MutationCardComponent,
}: ConditionalFieldsProps) {
  const thenActions = mutation.thenActions || [];
  const elseActions = mutation.elseActions || [];
  const ctx = useMemo(
    () => ({ schema, pressures, createMutation, MutationCardComponent }),
    [schema, pressures, createMutation, MutationCardComponent],
  );

  return (
    <div className="mc-nested-container">
      <div className="info-box-text mc-nested-info mb-lg">
        Execute different actions based on a condition.
      </div>
      <div className="mc-conditional-then">
        <label className="label">
          Then Actions ({thenActions.length})
        </label>
        <div className="info-box-text mc-nested-info">
          Actions executed when condition passes.
        </div>
        <NestedActionList
          actions={thenActions}
          field="thenActions"
          update={update}
          entityRefs={entityRefs}
          types={types}
          colorClass="mc-nested-action-green"
          addLabel="Add Then Action"
          defaultEntity="$self"
          ctx={ctx}
        />
      </div>
      <div>
        <label className="label">
          Else Actions ({elseActions.length})
        </label>
        <div className="info-box-text mc-nested-info">
          Actions executed when condition fails (optional).
        </div>
        <NestedActionList
          actions={elseActions}
          field="elseActions"
          update={update}
          entityRefs={entityRefs}
          types={types}
          colorClass="mc-nested-action-red"
          addLabel="Add Else Action"
          defaultEntity="$self"
          ctx={ctx}
        />
      </div>
    </div>
  );
}

export default ForEachRelatedFields;
