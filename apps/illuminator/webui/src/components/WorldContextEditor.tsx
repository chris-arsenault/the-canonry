/**
 * WorldContextEditor - Configure world context for LLM prompts
 *
 * Exposes:
 * - World name and description
 * - Canon facts (for perspective synthesis)
 * - Tone fragments (core + culture/kind overlays)
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  LocalTextArea,
  useExpandBoolean,
  expandableProps,
} from "@the-canonry/shared-components";
import "./WorldContextEditor.css";

// ============================================================================
// Types
// ============================================================================

interface CanonFact {
  id: string;
  text: string;
  type: "world_truth" | "generation_constraint";
  required: boolean;
  disabled: boolean;
}

interface EraOverride {
  text: string;
  replace: boolean;
}

interface WorldDynamic {
  id: string;
  text: string;
  cultures: string[];
  kinds: string[];
  eraOverrides?: Record<string, EraOverride>;
}

interface Era {
  id: string;
  name: string;
}

interface FactSelection {
  minCount?: number;
  maxCount?: number;
}

interface ToneFragments {
  core?: string;
}

interface WorldContext {
  name?: string;
  description?: string;
  speciesConstraint?: string;
  canonFactsWithMetadata?: CanonFact[];
  worldDynamics?: WorldDynamic[];
  toneFragments?: ToneFragments;
  factSelection?: FactSelection;
}

interface WorldContextEditorProps {
  worldContext: WorldContext;
  onWorldContextChange: (patch: Partial<WorldContext>) => void;
  eras?: Era[];
  onGenerateDynamics?: () => void;
  isGeneratingDynamics?: boolean;
}

// ============================================================================
// FactCard — header row
// ============================================================================

interface FactCardHeaderProps {
  fact: CanonFact;
  isConstraint: boolean;
  isDisabled: boolean;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
}

function FactCardHeader({
  fact,
  isConstraint,
  isDisabled,
  expanded,
  onToggle,
  onRemove,
}: Readonly<FactCardHeaderProps>) {
  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove();
    },
    [onRemove],
  );

  return (
    <div className="wce-fact-header" {...expandableProps(onToggle)}>
      <span className="wce-fact-chevron">{expanded ? "\u25BC" : "\u25B6"}</span>
      <span className="wce-fact-id">{fact.id}</span>
      <span className="wce-fact-preview">{fact.text}</span>
      <span
        className={`wce-fact-type-badge ${isConstraint ? "wce-fact-type-badge-constraint" : "wce-fact-type-badge-truth"}`}
        title={
          isConstraint
            ? "Meta-instruction (always verbatim)"
            : "World truth (faceted by perspective)"
        }
      >
        {isConstraint ? "constraint" : "truth"}
      </span>
      {fact.required && !isConstraint && !isDisabled && (
        <span
          className="wce-fact-status-badge wce-fact-status-badge-required"
          title="Required fact (must be included in perspective facets)"
        >
          required
        </span>
      )}
      {isDisabled && (
        <span
          className="wce-fact-status-badge wce-fact-status-badge-disabled"
          title="Disabled — excluded from perspective synthesis and generation"
        >
          disabled
        </span>
      )}
      <button onClick={handleRemove} className="wce-remove-btn">
        &times;
      </button>
    </div>
  );
}

// ============================================================================
// FactCard — detail panel
// ============================================================================

interface FactCardDetailProps {
  fact: CanonFact;
  isConstraint: boolean;
  isDisabled: boolean;
  onUpdate: (updated: CanonFact) => void;
}

function FactCardDetail({
  fact,
  isConstraint,
  isDisabled,
  onUpdate,
}: Readonly<FactCardDetailProps>) {
  const handleTextChange = useCallback(
    (value: string) => onUpdate({ ...fact, text: value }),
    [fact, onUpdate],
  );

  const handleTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const next = { ...fact, type: e.target.value as CanonFact["type"] };
      if (e.target.value === "generation_constraint") {
        next.required = false;
      }
      onUpdate(next);
    },
    [fact, onUpdate],
  );

  const handleRequiredChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ ...fact, required: e.target.checked }),
    [fact, onUpdate],
  );

  const handleDisabledChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = { ...fact, disabled: e.target.checked };
      if (e.target.checked) next.required = false;
      onUpdate(next);
    },
    [fact, onUpdate],
  );

  return (
    <div className="wce-fact-detail">
      <div>
        <label className="ilu-hint-sm wce-field-label">
          Text
          <LocalTextArea
            value={fact.text || ""}
            onChange={handleTextChange}
            className="illuminator-input wce-textarea-compact"
          />
        </label>
      </div>

      <div className="wce-fact-detail-grid">
        <div>
          <label htmlFor="fact-type" className="ilu-hint-sm wce-field-label">
            Fact Type
          </label>
          <select
            id="fact-type"
            value={fact.type || "world_truth"}
            onChange={handleTypeChange}
            className="illuminator-input wce-input-sm"
          >
            <option value="world_truth">World Truth (faceted by perspective)</option>
            <option value="generation_constraint">
              Generation Constraint (always verbatim)
            </option>
          </select>
        </div>
        <div>
          <span className="ilu-hint-sm wce-field-label">Required</span>
          <label className="wce-checkbox-label">
            <input
              type="checkbox"
              checked={Boolean(fact.required) && !isConstraint && !isDisabled}
              onChange={handleRequiredChange}
              disabled={isConstraint || isDisabled}
            />
            <span className="wce-checkbox-text">Always include in facets</span>
          </label>
        </div>
        <div>
          <span className="ilu-hint-sm wce-field-label">Disabled</span>
          <label className="wce-checkbox-label">
            <input
              type="checkbox"
              checked={isDisabled}
              onChange={handleDisabledChange}
            />
            <span className="wce-checkbox-text">Exclude from prompts</span>
          </label>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FactCard
// ============================================================================

interface FactCardProps {
  fact: CanonFact;
  onUpdate: (updated: CanonFact) => void;
  onRemove: () => void;
}

function FactCard({ fact, onUpdate, onRemove }: Readonly<FactCardProps>) {
  const { expanded, toggle } = useExpandBoolean();
  const isConstraint = fact.type === "generation_constraint";
  const isDisabled = Boolean(fact.disabled);

  return (
    <div className={`wce-fact-card ${isDisabled ? "wce-fact-card-disabled" : ""}`}>
      <FactCardHeader
        fact={fact}
        isConstraint={isConstraint}
        isDisabled={isDisabled}
        expanded={expanded}
        onToggle={toggle}
        onRemove={onRemove}
      />
      {expanded && (
        <FactCardDetail
          fact={fact}
          isConstraint={isConstraint}
          isDisabled={isDisabled}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}

// ============================================================================
// FactsEditor
// ============================================================================

interface FactsEditorProps {
  facts: CanonFact[];
  onChange: (facts: CanonFact[]) => void;
}

function normalizeFact(fact: Partial<CanonFact> & { id: string }): CanonFact {
  return {
    id: fact.id,
    text: fact.text || "",
    type: fact.type || "world_truth",
    required:
      fact.type === "generation_constraint" || fact.disabled ? false : Boolean(fact.required),
    disabled: Boolean(fact.disabled),
  };
}

function FactsEditor({ facts, onChange }: Readonly<FactsEditorProps>) {
  const [newFactId, setNewFactId] = useState("");

  const handleAddFact = useCallback(() => {
    if (!newFactId.trim()) return;
    const newFact = normalizeFact({
      id: newFactId.trim().toLowerCase().replace(/\s+/g, "-"),
      text: "",
      type: "world_truth",
      required: false,
    });
    onChange([...facts, newFact]);
    setNewFactId("");
  }, [newFactId, facts, onChange]);

  const handleUpdateFact = useCallback(
    (index: number, updatedFact: CanonFact) => {
      const newFacts = [...facts];
      newFacts[index] = normalizeFact(updatedFact);
      onChange(newFacts.map(normalizeFact));
    },
    [facts, onChange],
  );

  const handleRemoveFact = useCallback(
    (index: number) => {
      onChange(facts.filter((_, i) => i !== index).map(normalizeFact));
    },
    [facts, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleAddFact();
    },
    [handleAddFact],
  );

  const handleNewFactIdChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setNewFactId(e.target.value),
    [],
  );

  return (
    <div>
      {facts.map((fact, index) => (
        <FactCard
          key={fact.id || index}
          fact={fact}
          onUpdate={(updated) => handleUpdateFact(index, updated)}
          onRemove={() => handleRemoveFact(index)}
        />
      ))}
      <div className="wce-add-row">
        <input
          type="text"
          value={newFactId}
          onChange={handleNewFactIdChange}
          placeholder="new-fact-id"
          className="illuminator-input wce-add-input"
          onKeyDown={handleKeyDown}
        />
        <button
          onClick={handleAddFact}
          className="illuminator-button illuminator-button-secondary"
          disabled={!newFactId.trim()}
        >
          Add Fact
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// WorldDynamicCard — era override sub-card
// ============================================================================

interface EraOverrideCardProps {
  eraId: string;
  eraName: string;
  override: EraOverride;
  onReplaceToggle: (eraId: string, checked: boolean) => void;
  onTextChange: (eraId: string, text: string) => void;
  onRemove: (eraId: string) => void;
}

function EraOverrideCard({
  eraId,
  eraName,
  override,
  onReplaceToggle,
  onTextChange,
  onRemove,
}: Readonly<EraOverrideCardProps>) {
  const handleReplaceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onReplaceToggle(eraId, e.target.checked),
    [eraId, onReplaceToggle],
  );
  const handleTextChange = useCallback(
    (value: string) => onTextChange(eraId, value),
    [eraId, onTextChange],
  );
  const handleRemoveClick = useCallback(() => onRemove(eraId), [eraId, onRemove]);

  return (
    <div className="wce-override-card">
      <div className="wce-override-header">
        <span className="wce-override-era-name">{eraName}</span>
        <label className="wce-override-replace-label">
          <input
            type="checkbox"
            checked={override.replace}
            onChange={handleReplaceChange}
          />
          Replace (instead of append)
        </label>
        <button onClick={handleRemoveClick} className="wce-remove-btn wce-remove-btn-sm">
          &times;
        </button>
      </div>
      <LocalTextArea
        value={override.text || ""}
        onChange={handleTextChange}
        className="illuminator-input wce-textarea-compact wce-textarea-compact-short"
        placeholder={
          override.replace
            ? "Replacement text for this era..."
            : "Additional context for this era (appended)..."
        }
      />
    </div>
  );
}

// ============================================================================
// WorldDynamicCard
// ============================================================================

interface WorldDynamicCardProps {
  dynamic: WorldDynamic;
  onUpdate: (updated: WorldDynamic) => void;
  onRemove: () => void;
  eras?: Era[];
}

function formatArray(arr: string[] | undefined): string {
  return (arr || []).filter((s) => s !== "*").join(", ");
}

function parseArray(str: string): string[] {
  const items = str
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length === 0 ? [] : items;
}

function WorldDynamicCard({
  dynamic,
  onUpdate,
  onRemove,
  eras,
}: Readonly<WorldDynamicCardProps>) {
  const { expanded, toggle } = useExpandBoolean();
  const [newOverrideEraId, setNewOverrideEraId] = useState("");

  const updateField = useCallback(
    (field: string, value: unknown) => {
      onUpdate({ ...dynamic, [field]: value });
    },
    [dynamic, onUpdate],
  );

  const handleRemoveClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove();
    },
    [onRemove],
  );

  const handleTextChange = useCallback(
    (value: string) => updateField("text", value),
    [updateField],
  );

  const handleCulturesChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => updateField("cultures", parseArray(e.target.value)),
    [updateField],
  );

  const handleKindsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => updateField("kinds", parseArray(e.target.value)),
    [updateField],
  );

  // Era override handlers
  const handleOverrideReplaceToggle = useCallback(
    (eraId: string, checked: boolean) => {
      const newOverrides = { ...dynamic.eraOverrides };
      const existing = newOverrides[eraId];
      if (existing) {
        newOverrides[eraId] = { ...existing, replace: checked };
      }
      updateField("eraOverrides", newOverrides);
    },
    [dynamic.eraOverrides, updateField],
  );

  const handleOverrideTextChange = useCallback(
    (eraId: string, text: string) => {
      const newOverrides = { ...dynamic.eraOverrides };
      const existing = newOverrides[eraId];
      if (existing) {
        newOverrides[eraId] = { ...existing, text };
      }
      updateField("eraOverrides", newOverrides);
    },
    [dynamic.eraOverrides, updateField],
  );

  const handleOverrideRemove = useCallback(
    (eraId: string) => {
      const newOverrides = { ...dynamic.eraOverrides };
      delete newOverrides[eraId];
      updateField(
        "eraOverrides",
        Object.keys(newOverrides).length > 0 ? newOverrides : undefined,
      );
    },
    [dynamic.eraOverrides, updateField],
  );

  const handleAddOverride = useCallback(() => {
    if (!newOverrideEraId) return;
    const newOverrides = {
      ...(dynamic.eraOverrides || {}),
      [newOverrideEraId]: { text: "", replace: false },
    };
    updateField("eraOverrides", newOverrides);
    setNewOverrideEraId("");
  }, [newOverrideEraId, dynamic.eraOverrides, updateField]);

  const handleOverrideEraSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => setNewOverrideEraId(e.target.value),
    [],
  );

  const eraOverrideEntries = useMemo(
    () => Object.entries(dynamic.eraOverrides || {}),
    [dynamic.eraOverrides],
  );

  const availableEras = useMemo(() => {
    if (!eras || eras.length === 0) return [];
    const existingEraIds = new Set(Object.keys(dynamic.eraOverrides || {}));
    return eras.filter((e) => !existingEraIds.has(e.id));
  }, [eras, dynamic.eraOverrides]);

  return (
    <div className="wce-dynamic-card">
      {/* Header */}
      <div className="wce-dynamic-header" {...expandableProps(toggle)}>
        <span className="wce-dynamic-chevron">{expanded ? "\u25BC" : "\u25B6"}</span>
        <span className="wce-dynamic-id">{dynamic.id}</span>
        <span className="wce-dynamic-preview">{dynamic.text}</span>
        {dynamic.cultures?.length > 0 && dynamic.cultures[0] !== "*" && (
          <span className="wce-dynamic-scope-badge">
            {dynamic.cultures.length} culture{dynamic.cultures.length !== 1 ? "s" : ""}
          </span>
        )}
        {dynamic.kinds?.length > 0 && dynamic.kinds[0] !== "*" && (
          <span className="wce-dynamic-scope-badge">
            {dynamic.kinds.length} kind{dynamic.kinds.length !== 1 ? "s" : ""}
          </span>
        )}
        <button onClick={handleRemoveClick} className="wce-remove-btn">
          &times;
        </button>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="wce-dynamic-detail">
          <div>
            <label className="ilu-hint-sm wce-field-label">
              Dynamic Statement
              <LocalTextArea
                value={dynamic.text || ""}
                onChange={handleTextChange}
                className="illuminator-input wce-textarea-compact"
              />
            </label>
          </div>

          <div className="wce-dynamic-detail-grid">
            <div>
              <label htmlFor="relevant-cultures" className="ilu-hint-sm wce-field-label">
                Relevant Cultures (comma-separated, empty = always)
              </label>
              <input
                id="relevant-cultures"
                type="text"
                value={formatArray(dynamic.cultures)}
                onChange={handleCulturesChange}
                className="illuminator-input wce-input-sm"
                placeholder="e.g., nightshelf, aurora_stack"
              />
            </div>
            <div>
              <label htmlFor="relevant-kinds" className="ilu-hint-sm wce-field-label">
                Relevant Kinds (comma-separated, empty = always)
              </label>
              <input
                id="relevant-kinds"
                type="text"
                value={formatArray(dynamic.kinds)}
                onChange={handleKindsChange}
                className="illuminator-input wce-input-sm"
                placeholder="e.g., artifact, npc"
              />
            </div>
          </div>

          {/* Era Overrides */}
          {eras && eras.length > 0 && (
            <div>
              <span className="ilu-hint-sm wce-field-label wce-field-label-mb6">
                Era Overrides (optional — adjust this dynamic for specific eras)
              </span>
              {eraOverrideEntries.map(([eraId, override]) => {
                const eraName = eras.find((e) => e.id === eraId)?.name || eraId;
                return (
                  <EraOverrideCard
                    key={eraId}
                    eraId={eraId}
                    eraName={eraName}
                    override={override}
                    onReplaceToggle={handleOverrideReplaceToggle}
                    onTextChange={handleOverrideTextChange}
                    onRemove={handleOverrideRemove}
                  />
                );
              })}
              {/* Add new era override */}
              {availableEras.length > 0 && (
                <div className="wce-add-override-row">
                  <select
                    value={newOverrideEraId}
                    onChange={handleOverrideEraSelect}
                    className="illuminator-input wce-add-override-select"
                  >
                    <option value="">Select era...</option>
                    {availableEras.map((era) => (
                      <option key={era.id} value={era.id}>
                        {era.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddOverride}
                    className="illuminator-button illuminator-button-secondary wce-add-override-btn"
                    disabled={!newOverrideEraId}
                  >
                    Add Override
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// WorldDynamicsEditor
// ============================================================================

interface WorldDynamicsEditorProps {
  dynamics: WorldDynamic[];
  onChange: (dynamics: WorldDynamic[]) => void;
  eras?: Era[];
}

function WorldDynamicsEditor({ dynamics, onChange, eras }: Readonly<WorldDynamicsEditorProps>) {
  const [newDynamicId, setNewDynamicId] = useState("");

  const handleAddDynamic = useCallback(() => {
    if (!newDynamicId.trim()) return;
    const newDynamic: WorldDynamic = {
      id: newDynamicId.trim().toLowerCase().replace(/\s+/g, "-"),
      text: "",
      cultures: [],
      kinds: [],
    };
    onChange([...dynamics, newDynamic]);
    setNewDynamicId("");
  }, [newDynamicId, dynamics, onChange]);

  const handleUpdateDynamic = useCallback(
    (index: number, updated: WorldDynamic) => {
      const newDynamics = [...dynamics];
      newDynamics[index] = updated;
      onChange(newDynamics);
    },
    [dynamics, onChange],
  );

  const handleRemoveDynamic = useCallback(
    (index: number) => {
      onChange(dynamics.filter((_, i) => i !== index));
    },
    [dynamics, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleAddDynamic();
    },
    [handleAddDynamic],
  );

  const handleNewDynamicIdChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setNewDynamicId(e.target.value),
    [],
  );

  return (
    <div>
      {dynamics.map((dynamic, index) => (
        <WorldDynamicCard
          key={dynamic.id || index}
          dynamic={dynamic}
          onUpdate={(updated) => handleUpdateDynamic(index, updated)}
          onRemove={() => handleRemoveDynamic(index)}
          eras={eras}
        />
      ))}
      <div className="wce-add-row">
        <input
          type="text"
          value={newDynamicId}
          onChange={handleNewDynamicIdChange}
          placeholder="new-dynamic-id"
          className="illuminator-input wce-add-input"
          onKeyDown={handleKeyDown}
        />
        <button
          onClick={handleAddDynamic}
          className="illuminator-button illuminator-button-secondary"
          disabled={!newDynamicId.trim()}
        >
          Add Dynamic
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// ToneFragmentsEditor
// ============================================================================

interface ToneFragmentsEditorProps {
  fragments: ToneFragments;
  onChange: (fragments: ToneFragments) => void;
}

function ToneFragmentsEditor({ fragments, onChange }: Readonly<ToneFragmentsEditorProps>) {
  const handleCoreChange = useCallback(
    (value: string) => onChange({ ...fragments, core: value }),
    [fragments, onChange],
  );

  return (
    <div className="wce-tone-layout">
      {/* Core Tone */}
      <div>
        <label className="wce-tone-core-label">
          Core Tone (always included)
          <LocalTextArea
            value={fragments?.core || ""}
            onChange={handleCoreChange}
            placeholder="Core style principles that apply to all chronicles..."
            className="illuminator-input wce-textarea-core-tone"
          />
        </label>
      </div>

      {/* Note about where other guidance lives */}
      <div className="wce-tone-note">
        <strong>Note:</strong> Culture-specific prose guidance is now in{" "}
        <em>Identity &rarr; Descriptive &rarr; PROSE_STYLE</em>. Entity kind prose guidance is in{" "}
        <em>Guidance &rarr; [kind] &rarr; proseHint</em>. These are automatically assembled during
        perspective synthesis based on the chronicle&apos;s entity constellation.
      </div>
    </div>
  );
}

// ============================================================================
// FacetRangeInput
// ============================================================================

interface FacetRangeInputProps {
  factSelection: FactSelection | undefined;
  onChangeFactSelection: (fs: FactSelection) => void;
}

function parseFacetCount(raw: string): number | undefined {
  if (raw === "") return undefined;
  const num = Number(raw);
  if (Number.isFinite(num)) return Math.max(1, Math.floor(num));
  return undefined;
}

function FacetRangeInput({ factSelection, onChangeFactSelection }: Readonly<FacetRangeInputProps>) {
  const handleMinChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChangeFactSelection({
        ...(factSelection || {}),
        minCount: parseFacetCount(e.target.value),
      });
    },
    [factSelection, onChangeFactSelection],
  );

  const handleMaxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChangeFactSelection({
        ...(factSelection || {}),
        maxCount: parseFacetCount(e.target.value),
      });
    },
    [factSelection, onChangeFactSelection],
  );

  return (
    <div className="illuminator-form-group wce-form-group-mb16">
      <span className="illuminator-label">Facet Range (optional)</span>
      <div className="wce-facet-range-row">
        <input
          type="number"
          min="1"
          step="1"
          value={factSelection?.minCount ?? ""}
          onChange={handleMinChange}
          placeholder="min (4)"
          className="illuminator-input wce-facet-range-input"
        />
        <span className="wce-facet-range-separator">to</span>
        <input
          type="number"
          min="1"
          step="1"
          value={factSelection?.maxCount ?? ""}
          onChange={handleMaxChange}
          placeholder="max (6)"
          className="illuminator-input wce-facet-range-input"
        />
      </div>
      <div className="ilu-hint-sm wce-facet-range-hint">
        Range of world-truth facts to facet. Required facts count toward this; min is raised to
        match required count if needed.
      </div>
    </div>
  );
}

// ============================================================================
// DynamicsActions — header buttons for import/export/generate
// ============================================================================

interface DynamicsActionsProps {
  worldDynamics: WorldDynamic[] | undefined;
  onImportJson: () => void;
  onGenerateDynamics?: () => void;
  isGeneratingDynamics?: boolean;
}

function exportDynamicsJson(worldDynamics: WorldDynamic[]): void {
  const json = JSON.stringify(worldDynamics, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dynamics-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function DynamicsActions({
  worldDynamics,
  onImportJson,
  onGenerateDynamics,
  isGeneratingDynamics,
}: Readonly<DynamicsActionsProps>) {
  const handleExport = useCallback(() => {
    if (worldDynamics && worldDynamics.length > 0) {
      exportDynamicsJson(worldDynamics);
    }
  }, [worldDynamics]);

  return (
    <div className="wce-dynamics-actions">
      <button
        onClick={onImportJson}
        className="illuminator-button illuminator-button-secondary wce-dynamics-btn"
      >
        Import JSON
      </button>
      {worldDynamics && worldDynamics.length > 0 && (
        <button
          onClick={handleExport}
          className="illuminator-button illuminator-button-secondary wce-dynamics-btn"
        >
          Export JSON
        </button>
      )}
      {onGenerateDynamics && (
        <button
          onClick={onGenerateDynamics}
          disabled={isGeneratingDynamics}
          className="illuminator-button illuminator-button-secondary wce-dynamics-btn"
        >
          {isGeneratingDynamics ? "Generating..." : "Generate from Lore"}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// WorldContextEditor (main)
// ============================================================================

export default function WorldContextEditor({
  worldContext,
  onWorldContextChange,
  eras,
  onGenerateDynamics,
  isGeneratingDynamics,
}: Readonly<WorldContextEditorProps>) {
  const updateField = useCallback(
    (field: string, value: unknown) => {
      onWorldContextChange({ [field]: value } as Partial<WorldContext>);
    },
    [onWorldContextChange],
  );

  const parseDynamicsFile = useCallback(
    (fileContent: string) => {
      try {
        const parsed: unknown = JSON.parse(fileContent);
        if (!Array.isArray(parsed)) {
          alert("Invalid dynamics file: expected a JSON array.");
          return;
        }
        const valid = parsed.every(
          (d: unknown) =>
            d !== null &&
            typeof d === "object" &&
            "id" in d &&
            typeof (d as Record<string, unknown>).id === "string" &&
            "text" in d &&
            typeof (d as Record<string, unknown>).text === "string",
        );
        if (!valid) {
          alert("Invalid dynamics file: each entry must have id and text strings.");
          return;
        }
        updateField("worldDynamics", parsed);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        alert(`Failed to parse dynamics JSON: ${message}`);
      }
    },
    [updateField],
  );

  const handleImportDynamicsJson = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => parseDynamicsFile(ev.target?.result as string);
      reader.readAsText(file);
    };
    input.click();
  }, [parseDynamicsFile]);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => updateField("name", e.target.value),
    [updateField],
  );

  const handleDescriptionChange = useCallback(
    (value: string) => updateField("description", value),
    [updateField],
  );

  const handleSpeciesChange = useCallback(
    (value: string) => updateField("speciesConstraint", value),
    [updateField],
  );

  const handleFactsChange = useCallback(
    (facts: CanonFact[]) => updateField("canonFactsWithMetadata", facts),
    [updateField],
  );

  const handleFactSelectionChange = useCallback(
    (fs: FactSelection) => updateField("factSelection", fs),
    [updateField],
  );

  const handleDynamicsChange = useCallback(
    (dynamics: WorldDynamic[]) => updateField("worldDynamics", dynamics),
    [updateField],
  );

  const handleToneChange = useCallback(
    (fragments: ToneFragments) => updateField("toneFragments", fragments),
    [updateField],
  );

  const canonFacts = useMemo(
    () => worldContext.canonFactsWithMetadata || [],
    [worldContext.canonFactsWithMetadata],
  );

  const dynamics = useMemo(
    () => worldContext.worldDynamics || [],
    [worldContext.worldDynamics],
  );

  const toneFragments = useMemo(
    () => worldContext.toneFragments || {},
    [worldContext.toneFragments],
  );

  return (
    <div>
      {/* Info Banner */}
      <div className="wce-info-banner">
        <div className="wce-info-banner-title">Entity context is built automatically</div>
        <div className="ilu-hint wce-info-banner-desc">
          Relationships, cultural peers, faction members, and entity age are extracted from the
          simulation data. This panel only configures world-level context that applies to all
          entities.
        </div>
      </div>

      {/* World Identity */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">World Identity</h2>
        </div>

        <div className="illuminator-form-group">
          <label htmlFor="world-name" className="illuminator-label">
            World Name
          </label>
          <input
            id="world-name"
            type="text"
            value={worldContext.name || ""}
            onChange={handleNameChange}
            placeholder="e.g., The Frozen Realms of Aurora Berg"
            className="illuminator-input"
          />
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">
            World Description
            <LocalTextArea
              value={worldContext.description || ""}
              onChange={handleDescriptionChange}
              placeholder="Brief description of your world's setting, themes, and what makes it unique..."
              className="illuminator-input wce-textarea-description"
            />
          </label>
        </div>
      </div>

      {/* Species Constraint */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Species Constraint</h2>
        </div>
        <p className="ilu-hint wce-description-text">
          Rule for what species can appear in generated images. This is added as a SPECIES
          REQUIREMENT at the top of image prompts to ensure all depicted figures match your
          world&apos;s inhabitants.
        </p>
        <div className="illuminator-form-group">
          <LocalTextArea
            value={worldContext.speciesConstraint || ""}
            onChange={handleSpeciesChange}
            placeholder="e.g., All depicted figures must be penguins or orcas. No humans exist in this world."
            className="illuminator-input wce-textarea-tone"
          />
        </div>
      </div>

      {/* World Context Configuration */}
      <div className="wce-section-divider">
        <div className="viewer-section-header wce-section-header">
          <h2 className="viewer-section-title wce-section-title">Chronicle Generation</h2>
          <p className="ilu-hint-sm wce-section-subtitle">
            Tone and facts for chronicle generation. Chronicles use perspective synthesis to create
            focused, faceted views based on each chronicle&apos;s entity constellation.
          </p>
        </div>

        {/* Canon Facts */}
        <div className="illuminator-card">
          <div className="illuminator-card-header">
            <h2 className="illuminator-card-title">Canon Facts</h2>
          </div>
          <p className="ilu-hint wce-description-text">
            World truths and generation constraints. Required facts must appear in perspective
            facets. Generation constraints are always included verbatim and never faceted.
          </p>
          <FacetRangeInput
            factSelection={worldContext.factSelection}
            onChangeFactSelection={handleFactSelectionChange}
          />
          <FactsEditor facts={canonFacts} onChange={handleFactsChange} />
        </div>

        {/* World Dynamics */}
        <div className="illuminator-card">
          <div className="illuminator-card-header wce-dynamics-header">
            <h2 className="illuminator-card-title">World Dynamics</h2>
            <DynamicsActions
              worldDynamics={worldContext.worldDynamics}
              onImportJson={handleImportDynamicsJson}
              onGenerateDynamics={onGenerateDynamics}
              isGeneratingDynamics={isGeneratingDynamics}
            />
          </div>
          <p className="ilu-hint wce-description-text">
            Higher-level narrative context about inter-group forces and behaviors. These statements
            describe macro-level dynamics that individual relationships are expressions of.
            Optionally filter by culture or entity kind so they only appear in relevant chronicles.
          </p>
          <WorldDynamicsEditor dynamics={dynamics} onChange={handleDynamicsChange} eras={eras} />
        </div>

        {/* Tone Fragments */}
        <div className="illuminator-card">
          <div className="illuminator-card-header">
            <h2 className="illuminator-card-title">Tone Fragments</h2>
          </div>
          <p className="ilu-hint wce-description-text">
            Composable tone guidance. Core is always included; culture and kind overlays are added
            based on the chronicle&apos;s entity constellation.
          </p>
          <ToneFragmentsEditor fragments={toneFragments} onChange={handleToneChange} />
        </div>
      </div>
    </div>
  );
}
