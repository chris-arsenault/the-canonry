/**
 * ThresholdTriggerTab - Configuration for threshold trigger systems
 */

import React, { useState, useCallback, useMemo } from "react";
import { CLUSTER_MODES } from "../constants";
import {
  ReferenceDropdown,
  NumberInput,
  LocalTextArea,
  useExpandBoolean,
  expandableProps,
} from "../../shared";
import VariableSelectionEditor from "../../shared/VariableSelectionEditor";
import { ApplicabilityRuleCard } from "../../generators/applicability/ApplicabilityRuleCard";
import { AddRuleButton } from "../../generators/applicability/AddRuleButton";
import { createNewRule } from "../../generators/applicability/createNewRule";
import MutationCard, { DEFAULT_MUTATION_TYPES } from "../../shared/MutationCard";
import type { Mutation, MutationTypeOption, PressureEntry, MutationSchema } from "../../shared/mutationUtils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EntityKindDef {
  kind: string;
  description?: string;
  subtypes?: Array<{ id: string; name?: string }>;
}

interface RelationshipKindDef {
  kind: string;
  description?: string;
}

interface Schema {
  entityKinds?: EntityKindDef[];
  relationshipKinds?: RelationshipKindDef[];
  tagRegistry?: Array<{ name: string; rarity: string; description?: string; isAxis?: boolean }>;
}

interface ApplicabilityRule {
  type: string;
  [key: string]: unknown;
}

interface VariableConfig {
  select: Record<string, unknown>;
  required?: boolean;
}

interface SystemConfig {
  conditions?: ApplicabilityRule[];
  variables?: Record<string, VariableConfig>;
  actions?: Mutation[];
  clusterMode?: string;
  clusterRelationshipKind?: string;
  minClusterSize?: number;
  narrationTemplate?: string;
}

interface System {
  config: SystemConfig;
  [key: string]: unknown;
}

interface ThresholdTriggerTabProps {
  readonly system: System;
  readonly onChange: (system: System) => void;
  readonly schema: Schema;
  readonly pressures: PressureEntry[];
}

// ---------------------------------------------------------------------------
// VariableCardHeader
// ---------------------------------------------------------------------------

interface VariableCardHeaderProps {
  readonly name: string;
  readonly isRequired: boolean;
  readonly displayMode: string;
  readonly displayStrategy: string;
  readonly filterCount: number;
  readonly expanded: boolean;
  readonly hovering: boolean;
  readonly onToggle: () => void;
  readonly onHoverEnter: () => void;
  readonly onHoverLeave: () => void;
  readonly onRemove: () => void;
}

function VariableCardHeader({
  name,
  isRequired,
  displayMode,
  displayStrategy,
  filterCount,
  expanded,
  hovering,
  onToggle,
  onHoverEnter,
  onHoverLeave,
  onRemove,
}: VariableCardHeaderProps) {
  const keyDownHandler = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    },
    [],
  );

  const handleRemoveClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove();
    },
    [onRemove],
  );

  return (
    <div
      className={`item-card-header ${hovering ? "item-card-header-hover" : ""}`}
      onClick={onToggle}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      role="button"
      tabIndex={0}
      onKeyDown={keyDownHandler}
    >
      <div className="item-card-icon item-card-icon-variable">&#x1F4E6;</div>
      <div className="item-card-info">
        <div className="item-card-title">
          <span className="variable-ref">{name}</span>
          {isRequired && (
            <span className="badge badge-warning tab-required-badge">
              Required
            </span>
          )}
        </div>
        <div className="item-card-subtitle">
          {displayMode} &bull; {displayStrategy}
          {filterCount > 0 && (
            <span className="ml-xs">
              &bull; {filterCount} filter{filterCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
      <div className="item-card-actions">
        <button className="btn-icon">{expanded ? "\u25B2" : "\u25BC"}</button>
        <button
          className="btn-icon btn-icon-danger"
          onClick={handleRemoveClick}
        >
          &times;
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VariableCard
// ---------------------------------------------------------------------------

interface VariableCardProps {
  readonly name: string;
  readonly config: VariableConfig;
  readonly onChange: (config: VariableConfig) => void;
  readonly onRemove: () => void;
  readonly schema: Schema;
  readonly availableRefs: string[];
}

function VariableCard({
  name,
  config,
  onChange,
  onRemove,
  schema,
  availableRefs,
}: VariableCardProps) {
  const { expanded, toggle, hovering, setHovering } = useExpandBoolean();

  const selectConfig = config.select || {};
  const isRequired = config.required || false;

  const updateRequired = useCallback(
    (value: boolean) => {
      onChange({ ...config, required: value });
    },
    [config, onChange],
  );

  const handleSelectionChange = useCallback(
    (updated: Record<string, unknown>) => {
      onChange({ ...config, select: updated });
    },
    [config, onChange],
  );

  const displayMode = useMemo(() => {
    const from = selectConfig.from;
    if (!from || from === "graph") {
      return (selectConfig.kind as string) || "Not configured";
    }
    if (typeof from === "object" && from !== null && "path" in from) {
      const stepCount = ((from as Record<string, unknown>).path as unknown[])?.length || 0;
      return `Path traversal (${stepCount} step${stepCount !== 1 ? "s" : ""})`;
    }
    return "Related entities";
  }, [selectConfig.from, selectConfig.kind]);

  const displayStrategy = (selectConfig.pickStrategy as string) || "Not set";
  const filterCount = ((selectConfig.filters as unknown[]) || []).length;

  const handleHoverEnter = useCallback(() => setHovering(true), [setHovering]);
  const handleHoverLeave = useCallback(() => setHovering(false), [setHovering]);

  return (
    <div className="item-card">
      <VariableCardHeader
        name={name}
        isRequired={isRequired}
        displayMode={displayMode}
        displayStrategy={displayStrategy}
        filterCount={filterCount}
        expanded={expanded}
        hovering={hovering}
        onToggle={toggle}
        onHoverEnter={handleHoverEnter}
        onHoverLeave={handleHoverLeave}
        onRemove={onRemove}
      />

      {expanded && (
        <div className="item-card-body">
          <div className="mb-xl">
            <label className="tab-checkbox-label">
              <input
                type="checkbox"
                checked={isRequired}
                onChange={(e) => updateRequired(e.target.checked)}
              />
              <span className="label mb-0">
                Required
              </span>
              <span className="text-muted tab-required-hint">
                (Entity is skipped if this variable can&apos;t be resolved)
              </span>
            </label>
          </div>

          <VariableSelectionEditor
            value={selectConfig}
            onChange={handleSelectionChange}
            schema={schema}
            availableRefs={availableRefs}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mutation type options
// ---------------------------------------------------------------------------

const TRIGGER_MUTATION_TYPES: MutationTypeOption[] = DEFAULT_MUTATION_TYPES;

// ---------------------------------------------------------------------------
// createAction helper
// ---------------------------------------------------------------------------

function createAction(type: string, pressures: PressureEntry[]): Mutation {
  const defaultPressure = pressures[0]?.id || "";
  switch (type) {
    case "modify_pressure":
      return { type: "modify_pressure", pressureId: defaultPressure, delta: 0 };
    case "set_tag":
      return { type: "set_tag", entity: "$self", tag: "", value: true };
    case "remove_tag":
      return { type: "remove_tag", entity: "$self", tag: "" };
    case "change_status":
      return { type: "change_status", entity: "$self", newStatus: "" };
    case "adjust_prominence":
      return { type: "adjust_prominence", entity: "$self", delta: 0.25 };
    case "archive_relationship":
      return {
        type: "archive_relationship",
        entity: "$self",
        relationshipKind: "",
        direction: "both",
      };
    case "adjust_relationship_strength":
      return {
        type: "adjust_relationship_strength",
        kind: "",
        src: "$self",
        dst: "$self",
        delta: 0.1,
      };
    case "transfer_relationship":
      return {
        type: "transfer_relationship",
        entity: "$self",
        relationshipKind: "",
        from: "$self",
        to: "$self",
      };
    case "update_rate_limit":
      return { type: "update_rate_limit" };
    case "for_each_related":
      return { type: "for_each_related", relationship: "", direction: "both", actions: [] };
    case "conditional":
      return {
        type: "conditional",
        thenActions: [],
        elseActions: [],
      };
    case "create_relationship":
    default:
      return { type: "create_relationship", kind: "", src: "$self", dst: "$self", strength: 0.5 };
  }
}

// ---------------------------------------------------------------------------
// ConditionsSection
// ---------------------------------------------------------------------------

interface ConditionsSectionProps {
  readonly conditions: ApplicabilityRule[];
  readonly onUpdate: (field: string, value: unknown) => void;
  readonly schema: Schema;
  readonly pressures: PressureEntry[];
}

function ConditionsSection({ conditions, onUpdate, schema, pressures }: ConditionsSectionProps) {
  const addCondition = useCallback(
    (type: string) => {
      const newRule = createNewRule(type, pressures);
      onUpdate("conditions", [...conditions, newRule]);
    },
    [conditions, onUpdate, pressures],
  );

  const updateCondition = useCallback(
    (index: number, cond: ApplicabilityRule) => {
      const next = [...conditions];
      next[index] = cond;
      onUpdate("conditions", next);
    },
    [conditions, onUpdate],
  );

  const removeCondition = useCallback(
    (index: number) => {
      onUpdate("conditions", conditions.filter((_, i) => i !== index));
    },
    [conditions, onUpdate],
  );

  return (
    <div className="section">
      <div className="section-title">Conditions ({conditions.length})</div>
      <div className="section-desc">
        All conditions must pass for an entity to be included in the trigger.
      </div>

      {conditions.length === 0 ? (
        <div className="empty-state-compact">No conditions defined.</div>
      ) : (
        conditions.map((cond, index) => (
          <ApplicabilityRuleCard
            key={index}
            rule={cond}
            onChange={(c: ApplicabilityRule) => updateCondition(index, c)}
            onRemove={() => removeCondition(index)}
            schema={schema}
            pressures={pressures}
          />
        ))
      )}

      <AddRuleButton onAdd={addCondition} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// VariablesSection
// ---------------------------------------------------------------------------

interface VariablesSectionProps {
  readonly variables: Record<string, VariableConfig>;
  readonly onUpdate: (field: string, value: unknown) => void;
  readonly schema: Schema;
}

function VariablesSection({ variables, onUpdate, schema }: VariablesSectionProps) {
  const [newVarName, setNewVarName] = useState("");
  const [showAddVarForm, setShowAddVarForm] = useState(false);

  const handleAddVariable = useCallback(() => {
    if (!newVarName.trim()) return;
    const name = newVarName.startsWith("$") ? newVarName : `$${newVarName}`;
    onUpdate("variables", {
      ...variables,
      [name]: { select: { from: "graph", kind: "", pickStrategy: "random" } },
    });
    setNewVarName("");
    setShowAddVarForm(false);
  }, [newVarName, onUpdate, variables]);

  const updateVariable = useCallback(
    (name: string, config: VariableConfig) => {
      onUpdate("variables", { ...variables, [name]: config });
    },
    [onUpdate, variables],
  );

  const removeVariable = useCallback(
    (name: string) => {
      const newVars = { ...variables };
      delete newVars[name];
      onUpdate("variables", newVars);
    },
    [onUpdate, variables],
  );

  const buildAvailableRefs = useCallback(
    (excludeVar: string): string[] => {
      const refs = ["$self"];
      Object.keys(variables).forEach((v) => {
        if (v !== excludeVar) refs.push(v);
      });
      return refs;
    },
    [variables],
  );

  const handleVarNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewVarName(e.target.value.replace(/[^a-zA-Z0-9_$]/g, ""));
    },
    [],
  );

  const handleCancelAdd = useCallback(() => {
    setShowAddVarForm(false);
    setNewVarName("");
  }, []);

  const handleShowAddForm = useCallback(() => {
    setShowAddVarForm(true);
  }, []);

  const varKeys = Object.keys(variables);

  return (
    <div className="section">
      <div className="section-title">Variables ({varKeys.length})</div>
      <div className="section-desc">
        Variables select additional entities from the graph to use in actions. Referenced as{" "}
        <code className="inline-code">$varName</code> in action entity fields.
      </div>

      {varKeys.length === 0 && !showAddVarForm ? (
        <div className="empty-state-compact">No variables defined.</div>
      ) : (
        Object.entries(variables).map(([name, varConfig]) => (
          <VariableCard
            key={name}
            name={name}
            config={varConfig}
            onChange={(updated) => updateVariable(name, updated)}
            onRemove={() => removeVariable(name)}
            schema={schema}
            availableRefs={buildAvailableRefs(name)}
          />
        ))
      )}

      {showAddVarForm ? (
        <div className="item-card add-form">
          <div className="add-form-fields">
            <div className="flex-1">
              <label htmlFor="variable-name" className="label">Variable Name</label>
              <input
                id="variable-name"
                type="text"
                value={newVarName}
                onChange={handleVarNameChange}
                className="input"
                placeholder="$myVariable"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={handleAddVariable}
              disabled={!newVarName.trim()}
            >
              Add
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleCancelAdd}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-add" onClick={handleShowAddForm}>
          + Add Variable
        </button>
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

function ActionsSection({
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

  const addAction = useCallback(
    (type: string) => {
      onUpdate("actions", [...actions, createAction(type, pressures)]);
    },
    [actions, onUpdate, pressures],
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
      addAction(e.target.value);
    },
    [addAction],
  );

  const handleBetweenMatchingChange = useCallback(
    (index: number, actionItem: Mutation, checked: boolean) => {
      updateAction(index, { ...actionItem, betweenMatching: checked } as Mutation & { betweenMatching: boolean });
    },
    [updateAction],
  );

  return (
    <div className="section">
      <div className="section-title">Actions ({actions.length})</div>
      <div className="section-desc">
        Mutations applied to each matching entity (or clusters when configured).
      </div>

      {actions.map((actionItem, index) => (
        <div key={index} className="mb-lg">
          <MutationCard
            mutation={actionItem}
            onChange={(a: Mutation) => updateAction(index, a)}
            onRemove={() => removeAction(index)}
            schema={schema as MutationSchema}
            pressures={pressures}
            entityOptions={entityOptions}
            typeOptions={TRIGGER_MUTATION_TYPES}
            createMutation={createActionForType}
            titlePrefix="Action"
          />
          {actionItem.type === "create_relationship" && (
            <label className="checkbox-label mt-md">
              <input
                type="checkbox"
                checked={(actionItem as Mutation & { betweenMatching?: boolean }).betweenMatching || false}
                onChange={(e) => handleBetweenMatchingChange(index, actionItem, e.target.checked)}
                className="checkbox"
              />
              Between matching entities
            </label>
          )}
        </div>
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

// ---------------------------------------------------------------------------
// ClusteringSection
// ---------------------------------------------------------------------------

interface ClusteringSectionProps {
  readonly config: SystemConfig;
  readonly onUpdate: (field: string, value: unknown) => void;
  readonly relationshipKindOptions: ReadonlyArray<{ value: string; label: string }>;
}

function ClusteringSection({ config, onUpdate, relationshipKindOptions }: ClusteringSectionProps) {
  const handleClusterModeChange = useCallback(
    (v: string | undefined) => onUpdate("clusterMode", v),
    [onUpdate],
  );

  const handleClusterRelChange = useCallback(
    (v: string | undefined) => onUpdate("clusterRelationshipKind", v),
    [onUpdate],
  );

  const handleMinClusterSizeChange = useCallback(
    (v: number | undefined) => onUpdate("minClusterSize", v),
    [onUpdate],
  );

  return (
    <div className="section">
      <div className="section-title">Clustering</div>
      <div className="form-grid">
        <ReferenceDropdown
          label="Cluster Mode"
          value={config.clusterMode || "individual"}
          onChange={handleClusterModeChange}
          options={CLUSTER_MODES}
        />
        {config.clusterMode === "by_relationship" && (
          <>
            <ReferenceDropdown
              label="Cluster Relationship"
              value={config.clusterRelationshipKind}
              onChange={handleClusterRelChange}
              options={relationshipKindOptions}
            />
            <div className="form-group">
              <label className="label">Min Cluster Size
              <NumberInput
                value={config.minClusterSize}
                onChange={handleMinClusterSizeChange}
                min={1}
                integer
                allowEmpty
              />
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ThresholdTriggerTab
// ---------------------------------------------------------------------------

export function ThresholdTriggerTab({
  system,
  onChange,
  schema,
  pressures,
}: ThresholdTriggerTabProps) {
  const config = system.config;

  const updateConfig = useCallback(
    (field: string, value: unknown) => {
      onChange({ ...system, config: { ...config, [field]: value } });
    },
    [system, config, onChange],
  );

  const conditions = config.conditions || [];
  const variables = config.variables || {};
  const actions = config.actions || [];

  const relationshipKindOptions = useMemo(
    () =>
      (schema?.relationshipKinds || []).map((rk) => ({
        value: rk.kind,
        label: rk.description || rk.kind,
      })),
    [schema?.relationshipKinds],
  );

  const entityOptions = useMemo(
    () => [
      { value: "$self", label: "$self" },
      { value: "$member", label: "$member" },
      { value: "$member2", label: "$member2" },
      ...Object.keys(variables).map((v) => ({ value: v, label: v })),
    ],
    [variables],
  );

  const handleNarrationChange = useCallback(
    (value: string) => {
      updateConfig("narrationTemplate", value || undefined);
    },
    [updateConfig],
  );

  return (
    <div>
      <ConditionsSection
        conditions={conditions}
        onUpdate={updateConfig}
        schema={schema}
        pressures={pressures}
      />

      <VariablesSection
        variables={variables}
        onUpdate={updateConfig}
        schema={schema}
      />

      <ActionsSection
        actions={actions}
        onUpdate={updateConfig}
        schema={schema}
        pressures={pressures}
        entityOptions={entityOptions}
      />

      <ClusteringSection
        config={config}
        onUpdate={updateConfig}
        relationshipKindOptions={relationshipKindOptions}
      />

      <div className="section">
        <div className="section-title">Narration Template</div>
        <div className="section-desc mb-md text-xs">
          Syntax: {"{$self.field}"}, {"{$varName.field}"}, {"{field|fallback}"}.
        </div>
        <LocalTextArea
          value={config.narrationTemplate || ""}
          onChange={handleNarrationChange}
          placeholder="e.g., {$self.name} reached a critical threshold and transformed."
          rows={2}
        />
      </div>
    </div>
  );
}
