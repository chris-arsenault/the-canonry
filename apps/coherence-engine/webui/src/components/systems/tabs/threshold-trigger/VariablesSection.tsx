/**
 * VariablesSection - Variable definitions block for threshold trigger systems
 */

import React, { useState, useCallback } from "react";
import VariableCard from "./VariableCard";
import type { VariableConfig, Schema } from "./types";

// ---------------------------------------------------------------------------
// AddVariableForm
// ---------------------------------------------------------------------------

interface AddVariableFormProps {
  readonly onAdd: (name: string) => void;
  readonly onCancel: () => void;
}

function AddVariableForm({ onAdd, onCancel }: AddVariableFormProps) {
  const [varName, setVarName] = useState("");

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setVarName(e.target.value.replace(/[^a-zA-Z0-9_$]/g, ""));
    },
    [],
  );

  const handleAdd = useCallback(() => {
    if (!varName.trim()) return;
    const name = varName.startsWith("$") ? varName : `$${varName}`;
    onAdd(name);
    setVarName("");
  }, [varName, onAdd]);

  return (
    <div className="item-card add-form">
      <div className="add-form-fields">
        <div className="flex-1">
          <label htmlFor="variable-name" className="label">Variable Name</label>
          <input
            id="variable-name"
            type="text"
            value={varName}
            onChange={handleNameChange}
            className="input"
            placeholder="$myVariable"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
        </div>
        <button
          className="btn btn-primary"
          onClick={handleAdd}
          disabled={!varName.trim()}
        >
          Add
        </button>
        <button
          className="btn btn-secondary"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
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

export function VariablesSection({ variables, onUpdate, schema }: VariablesSectionProps) {
  const [showAddVarForm, setShowAddVarForm] = useState(false);

  const handleAddVariable = useCallback(
    (name: string) => {
      onUpdate("variables", {
        ...variables,
        [name]: { select: { from: "graph", kind: "", pickStrategy: "random" } },
      });
      setShowAddVarForm(false);
    },
    [onUpdate, variables],
  );

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

  const handleCancelAdd = useCallback(() => setShowAddVarForm(false), []);
  const handleShowAddForm = useCallback(() => setShowAddVarForm(true), []);

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
        <AddVariableForm onAdd={handleAddVariable} onCancel={handleCancelAdd} />
      ) : (
        <button className="btn-add" onClick={handleShowAddForm}>
          + Add Variable
        </button>
      )}
    </div>
  );
}
