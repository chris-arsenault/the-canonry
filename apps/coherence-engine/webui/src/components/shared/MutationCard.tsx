/**
 * MutationCard - Edit a single mutation entry
 */

import React, { useCallback, useMemo } from "react";
import { ReferenceDropdown, useExpandBoolean } from "./index";
import {
  normalizeOptions,
  getMutationSummary,
  DEFAULT_MUTATION_TYPES,
  MUTATION_TYPE_META,
} from "./mutationUtils";
import type {
  Mutation,
  MutationCardProps,
  EntityRefOption,
  MutationTypeOption,
  MutationSchema,
  PressureEntry,
  MutationTypeMeta,
} from "./mutationUtils";
import { PressureFields } from "./mutation-fields/PressureFields";
import { TagFields, SetTagValueFields } from "./mutation-fields/TagFields";
import {
  ChangeStatusFields,
  AdjustProminenceFields,
} from "./mutation-fields/EntityStatusFields";
import {
  CreateRelationshipFields,
  AdjustRelStrengthFields,
  ArchiveRelFields,
  ArchiveAllRelFields,
  TransferRelFields,
} from "./mutation-fields/RelationshipFields";
import {
  ForEachRelatedFields,
  ConditionalFields,
} from "./mutation-fields/NestedFields";
import "./MutationCard.css";

export { DEFAULT_MUTATION_TYPES };

const FALLBACK_TYPE_META: MutationTypeMeta = {
  icon: "?",
  label: "Unknown",
  color: "#6b7280",
};

// ---------------------------------------------------------------------------
// MutationCardHeader
// ---------------------------------------------------------------------------

interface MutationCardHeaderProps {
  readonly headerLabel: string;
  readonly summary: string;
  readonly typeMeta: MutationTypeMeta;
  readonly expanded: boolean;
  readonly toggle: () => void;
  readonly onRemove?: () => void;
}

function MutationCardHeader({
  headerLabel,
  summary,
  typeMeta,
  expanded,
  toggle,
  onRemove,
}: MutationCardHeaderProps) {
  return (
    <div className={`condition-card-header ${expanded ? "" : "mb-0"}`}>
      <div className="condition-card-type">
        {/* eslint-disable local/no-inline-styles -- dynamic type color via CSS custom property */}
        <div
          className="condition-card-icon"
          style={{
            "--mc-icon-bg": `${typeMeta.color}20`,
            backgroundColor: "var(--mc-icon-bg)",
          } as React.CSSProperties}
        >
          {typeMeta.icon}
        </div>
        {/* eslint-enable local/no-inline-styles */}
        <div>
          <div className="condition-card-label">{headerLabel}</div>
          {summary && (
            <div className="condition-card-summary">{summary}</div>
          )}
        </div>
      </div>
      <div className="condition-card-actions">
        <button className="btn-icon" onClick={toggle}>
          {expanded ? "^" : "v"}
        </button>
        {onRemove && (
          <button className="btn-icon btn-icon-danger" onClick={onRemove}>
            x
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field routers (split to reduce cyclomatic complexity)
// ---------------------------------------------------------------------------

interface FieldRouterBaseProps {
  readonly mutation: Mutation;
  readonly update: (field: string, value: unknown) => void;
  readonly entityRefs: EntityRefOption[];
  readonly relationshipKindOptions: ReadonlyArray<{ value: string; label: string }>;
}

interface EntityFieldRouterProps extends FieldRouterBaseProps {
  readonly tagRegistry: MutationSchema["tagRegistry"];
}

function EntityFieldRouter({
  mutation, update, entityRefs, tagRegistry,
}: EntityFieldRouterProps): React.JSX.Element | null {
  switch (mutation.type) {
    case "set_tag":
    case "remove_tag":
      return (
        <>
          <TagFields mutation={mutation} update={update} entityRefs={entityRefs} tagRegistry={tagRegistry} />
          {mutation.type === "set_tag" && <SetTagValueFields mutation={mutation} update={update} />}
        </>
      );
    case "change_status":
      return <ChangeStatusFields mutation={mutation} update={update} entityRefs={entityRefs} />;
    case "adjust_prominence":
      return <AdjustProminenceFields mutation={mutation} update={update} entityRefs={entityRefs} />;
    default:
      return null;
  }
}

function RelationshipFieldRouter({
  mutation, update, entityRefs, relationshipKindOptions,
}: Readonly<FieldRouterBaseProps>): React.JSX.Element | null {
  const shared = { mutation, update, entityRefs, relationshipKindOptions };
  switch (mutation.type) {
    case "create_relationship":
      return <CreateRelationshipFields {...shared} />;
    case "adjust_relationship_strength":
      return <AdjustRelStrengthFields {...shared} />;
    case "archive_relationship":
      return <ArchiveRelFields {...shared} />;
    case "archive_all_relationships":
      return <ArchiveAllRelFields {...shared} />;
    case "transfer_relationship":
      return <TransferRelFields {...shared} />;
    default:
      return null;
  }
}

interface MutationFieldRouterProps extends EntityFieldRouterProps {
  readonly pressureOptions: ReadonlyArray<{ value: string; label: string }>;
  readonly types: MutationTypeOption[];
  readonly schema: MutationSchema;
  readonly pressures: PressureEntry[];
  readonly createMutation?: (type: string) => Mutation;
}

function MutationFieldRouter(props: MutationFieldRouterProps) {
  const {
    mutation, update, entityRefs, relationshipKindOptions,
    pressureOptions, tagRegistry, types, schema, pressures, createMutation,
  } = props;

  if (mutation.type === "modify_pressure") {
    return <PressureFields mutation={mutation} update={update} pressureOptions={pressureOptions} />;
  }
  if (mutation.type === "update_rate_limit") {
    return <div className="text-muted grid-col-full">Tracks generator execution for rate limiting.</div>;
  }
  if (mutation.type === "for_each_related") {
    return (
      <ForEachRelatedFields mutation={mutation} update={update} entityRefs={entityRefs}
        relationshipKindOptions={relationshipKindOptions} types={types} schema={schema}
        pressures={pressures} createMutation={createMutation} MutationCardComponent={MutationCard} />
    );
  }
  if (mutation.type === "conditional") {
    return (
      <ConditionalFields mutation={mutation} update={update} entityRefs={entityRefs}
        types={types} schema={schema} pressures={pressures}
        createMutation={createMutation} MutationCardComponent={MutationCard} />
    );
  }
  return (
    <EntityFieldRouter mutation={mutation} update={update} entityRefs={entityRefs}
      relationshipKindOptions={relationshipKindOptions} tagRegistry={tagRegistry} />
  ) ?? (
    <RelationshipFieldRouter mutation={mutation} update={update}
      entityRefs={entityRefs} relationshipKindOptions={relationshipKindOptions} />
  );
}

// ---------------------------------------------------------------------------
// useMutationCardState - extracted hook to reduce MutationCard line count
// ---------------------------------------------------------------------------

function useMutationCardState(props: MutationCardProps) {
  const { schema, pressures, entityOptions, onChange, mutation, createMutation, typeOptions } = props;
  const { expanded, toggle } = useExpandBoolean();
  const types = typeOptions;
  const entityRefs = useMemo(() => normalizeOptions(entityOptions), [entityOptions]);
  const relationshipKindOptions = useMemo(
    () => (schema.relationshipKinds || []).map((rk) => ({ value: rk.kind, label: rk.description || rk.kind })),
    [schema.relationshipKinds],
  );
  const pressureOptions = useMemo(
    () => pressures.map((p) => ({ value: p.id, label: p.name || p.id })),
    [pressures],
  );
  const tagRegistry = schema.tagRegistry || [];

  const update = useCallback(
    (field: string, value: unknown) => { onChange({ ...mutation, [field]: value }); },
    [mutation, onChange],
  );
  const updateType = useCallback(
    (value: string | undefined) => {
      if (value === undefined) return;
      if (createMutation) { onChange(createMutation(value)); return; }
      update("type", value);
    },
    [createMutation, onChange, update],
  );

  const typeMeta = MUTATION_TYPE_META[mutation.type] ?? FALLBACK_TYPE_META;
  const fallbackLabel = types.find((t) => t.value === mutation.type)?.label ?? typeMeta.label ?? mutation.type;
  const headerLabel = props.titlePrefix ? `${props.titlePrefix}: ${fallbackLabel}` : fallbackLabel;
  const summary = getMutationSummary(mutation);

  return {
    expanded, toggle, types, entityRefs, relationshipKindOptions,
    pressureOptions, tagRegistry, update, updateType, typeMeta,
    headerLabel, summary,
  };
}

// ---------------------------------------------------------------------------
// MutationCard
// ---------------------------------------------------------------------------

export function MutationCard(props: MutationCardProps) {
  const { mutation, onRemove, schema, pressures, createMutation } = props;
  const state = useMutationCardState(props);

  return (
    <div className="condition-card">
      <MutationCardHeader
        headerLabel={state.headerLabel} summary={state.summary}
        typeMeta={state.typeMeta} expanded={state.expanded}
        toggle={state.toggle} onRemove={onRemove}
      />
      {state.expanded && (
        <div className="condition-card-fields">
          <div className="form-grid mc-fields-full">
            <ReferenceDropdown label="Type" value={mutation.type} onChange={state.updateType} options={state.types} />
            <MutationFieldRouter
              mutation={mutation} update={state.update} entityRefs={state.entityRefs}
              relationshipKindOptions={state.relationshipKindOptions}
              pressureOptions={state.pressureOptions} tagRegistry={state.tagRegistry}
              types={state.types} schema={schema} pressures={pressures} createMutation={createMutation}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default MutationCard;
