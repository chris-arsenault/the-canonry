/**
 * WorldContextEditor - Configure world context for LLM prompts
 *
 * Exposes:
 * - World name and description
 * - Canon facts (for perspective synthesis)
 * - Tone fragments (core + culture/kind overlays)
 * - Legacy: simple canon facts and tone (for backwards compatibility)
 */

import React, { useState, useCallback } from "react";
import PropTypes from "prop-types";
import { LocalTextArea } from "@penguin-tales/shared-components";
import "./WorldContextEditor.css";

// ============================================================================
// Canon Facts Editor
// ============================================================================

function FactCard({ fact, onUpdate, onRemove }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateField = (field, value) => {
    const next = { ...fact, [field]: value };
    if (field === "type" && value === "generation_constraint") {
      next.required = false;
    }
    if (field === "disabled" && value) {
      next.required = false;
    }
    onUpdate(next);
  };

  const isConstraint = fact.type === "generation_constraint";
  const isDisabled = Boolean(fact.disabled);

  return (
    <div className={`wce-fact-card ${isDisabled ? "wce-fact-card-disabled" : ""}`}>
      {/* Header */}
      <div className="wce-fact-header" onClick={() => setIsExpanded(!isExpanded)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }} >
        <span className="wce-fact-chevron">{isExpanded ? "▼" : "▶"}</span>
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
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="wce-remove-btn"
        >
          ×
        </button>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="wce-fact-detail">
          <div>
            <label className="wce-field-label">Text
            <LocalTextArea
              value={fact.text || ""}
              onChange={(value) => updateField("text", value)}
              className="illuminator-input wce-textarea-compact"
            />
            </label>
          </div>

          <div className="wce-fact-detail-grid">
            <div>
              <label htmlFor="fact-type" className="wce-field-label">Fact Type</label>
              <select id="fact-type"
                value={fact.type || "world_truth"}
                onChange={(e) => updateField("type", e.target.value)}
                className="illuminator-input wce-input-sm"
              >
                <option value="world_truth">World Truth (faceted by perspective)</option>
                <option value="generation_constraint">
                  Generation Constraint (always verbatim)
                </option>
              </select>
            </div>
            <div>
              <span className="wce-field-label">Required</span>
              <label className="wce-checkbox-label">
                <input
                  type="checkbox"
                  checked={Boolean(fact.required) && !isConstraint && !isDisabled}
                  onChange={(e) => updateField("required", e.target.checked)}
                  disabled={isConstraint || isDisabled}
                />
                <span className="wce-checkbox-text">Always include in facets</span>
              </label>
            </div>
            <div>
              <span className="wce-field-label">Disabled</span>
              <label className="wce-checkbox-label">
                <input
                  type="checkbox"
                  checked={isDisabled}
                  onChange={(e) => {
                    const next = { ...fact, disabled: e.target.checked };
                    if (e.target.checked) next.required = false;
                    onUpdate(next);
                  }}
                />
                <span className="wce-checkbox-text">Exclude from prompts</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FactsEditor({ facts, onChange }) {
  const [newFactId, setNewFactId] = useState("");

  const normalizeFact = (fact) => ({
    id: fact.id,
    text: fact.text || "",
    type: fact.type || "world_truth",
    required:
      fact.type === "generation_constraint" || fact.disabled ? false : Boolean(fact.required),
    disabled: Boolean(fact.disabled),
  });

  const handleAddFact = () => {
    if (!newFactId.trim()) return;
    const newFact = normalizeFact({
      id: newFactId.trim().toLowerCase().replace(/\s+/g, "-"),
      text: "",
      type: "world_truth",
      required: false,
    });
    onChange([...facts, newFact]);
    setNewFactId("");
  };

  const handleUpdateFact = (index, updatedFact) => {
    const newFacts = [...facts];
    newFacts[index] = normalizeFact(updatedFact);
    onChange(newFacts.map(normalizeFact));
  };

  const handleRemoveFact = (index) => {
    onChange(facts.filter((_, i) => i !== index).map(normalizeFact));
  };

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
          onChange={(e) => setNewFactId(e.target.value)}
          placeholder="new-fact-id"
          className="illuminator-input wce-add-input"
          onKeyDown={(e) => e.key === "Enter" && handleAddFact()}
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
// World Dynamics Editor
// ============================================================================

function WorldDynamicCard({ dynamic, onUpdate, onRemove, eras }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newOverrideEraId, setNewOverrideEraId] = useState("");

  const updateField = (field, value) => {
    onUpdate({ ...dynamic, [field]: value });
  };

  const formatArray = (arr) => (arr || []).filter((s) => s !== "*").join(", ");
  const parseArray = (str) => {
    const items = str
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return items.length === 0 ? [] : items;
  };

  return (
    <div className="wce-dynamic-card">
      {/* Header */}
      <div className="wce-dynamic-header" onClick={() => setIsExpanded(!isExpanded)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }} >
        <span className="wce-dynamic-chevron">{isExpanded ? "▼" : "▶"}</span>
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
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="wce-remove-btn"
        >
          ×
        </button>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="wce-dynamic-detail">
          <div>
            <label className="wce-field-label">Dynamic Statement
            <LocalTextArea
              value={dynamic.text || ""}
              onChange={(value) => updateField("text", value)}
              className="illuminator-input wce-textarea-compact"
            />
            </label>
          </div>

          <div className="wce-dynamic-detail-grid">
            <div>
              <label htmlFor="relevant-cultures" className="wce-field-label">
                Relevant Cultures (comma-separated, empty = always)
              </label>
              <input id="relevant-cultures"
                type="text"
                value={formatArray(dynamic.cultures)}
                onChange={(e) => updateField("cultures", parseArray(e.target.value))}
                className="illuminator-input wce-input-sm"
                placeholder="e.g., nightshelf, aurora_stack"
              />
            </div>
            <div>
              <label htmlFor="relevant-kinds" className="wce-field-label">
                Relevant Kinds (comma-separated, empty = always)
              </label>
              <input id="relevant-kinds"
                type="text"
                value={formatArray(dynamic.kinds)}
                onChange={(e) => updateField("kinds", parseArray(e.target.value))}
                className="illuminator-input wce-input-sm"
                placeholder="e.g., artifact, npc"
              />
            </div>
          </div>

          {/* Era Overrides */}
          {eras && eras.length > 0 && (
            <div>
              <span className="wce-field-label wce-field-label-mb6">
                Era Overrides (optional — adjust this dynamic for specific eras)
              </span>
              {Object.entries(dynamic.eraOverrides || {}).map(([eraId, override]) => {
                const eraName = eras.find((e) => e.id === eraId)?.name || eraId;
                return (
                  <div key={eraId} className="wce-override-card">
                    <div className="wce-override-header">
                      <span className="wce-override-era-name">{eraName}</span>
                      <label className="wce-override-replace-label">
                        <input
                          type="checkbox"
                          checked={override.replace}
                          onChange={(e) => {
                            const newOverrides = { ...dynamic.eraOverrides };
                            newOverrides[eraId] = { ...override, replace: e.target.checked };
                            updateField("eraOverrides", newOverrides);
                          }}
                        />
                        Replace (instead of append)
                      </label>
                      <button
                        onClick={() => {
                          const newOverrides = { ...dynamic.eraOverrides };
                          delete newOverrides[eraId];
                          updateField(
                            "eraOverrides",
                            Object.keys(newOverrides).length > 0 ? newOverrides : undefined
                          );
                        }}
                        className="wce-remove-btn wce-remove-btn-sm"
                      >
                        ×
                      </button>
                    </div>
                    <LocalTextArea
                      value={override.text || ""}
                      onChange={(value) => {
                        const newOverrides = { ...dynamic.eraOverrides };
                        newOverrides[eraId] = { ...override, text: value };
                        updateField("eraOverrides", newOverrides);
                      }}
                      className="illuminator-input wce-textarea-compact wce-textarea-compact-short"
                      placeholder={
                        override.replace
                          ? "Replacement text for this era..."
                          : "Additional context for this era (appended)..."
                      }
                    />
                  </div>
                );
              })}
              {/* Add new era override */}
              {(() => {
                const existingEraIds = new Set(Object.keys(dynamic.eraOverrides || {}));
                const availableEras = eras.filter((e) => !existingEraIds.has(e.id));
                if (availableEras.length === 0) return null;
                return (
                  <div className="wce-add-override-row">
                    <select
                      value={newOverrideEraId}
                      onChange={(e) => setNewOverrideEraId(e.target.value)}
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
                      onClick={() => {
                        if (!newOverrideEraId) return;
                        const newOverrides = {
                          ...(dynamic.eraOverrides || {}),
                          [newOverrideEraId]: { text: "", replace: false },
                        };
                        updateField("eraOverrides", newOverrides);
                        setNewOverrideEraId("");
                      }}
                      className="illuminator-button illuminator-button-secondary wce-add-override-btn"
                      disabled={!newOverrideEraId}
                    >
                      Add Override
                    </button>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WorldDynamicsEditor({ dynamics, onChange, eras }) {
  const [newDynamicId, setNewDynamicId] = useState("");

  const handleAddDynamic = () => {
    if (!newDynamicId.trim()) return;
    const newDynamic = {
      id: newDynamicId.trim().toLowerCase().replace(/\s+/g, "-"),
      text: "",
      cultures: [],
      kinds: [],
    };
    onChange([...dynamics, newDynamic]);
    setNewDynamicId("");
  };

  const handleUpdateDynamic = (index, updated) => {
    const newDynamics = [...dynamics];
    newDynamics[index] = updated;
    onChange(newDynamics);
  };

  const handleRemoveDynamic = (index) => {
    onChange(dynamics.filter((_, i) => i !== index));
  };

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
          onChange={(e) => setNewDynamicId(e.target.value)}
          placeholder="new-dynamic-id"
          className="illuminator-input wce-add-input"
          onKeyDown={(e) => e.key === "Enter" && handleAddDynamic()}
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
// Tone Fragments Editor
// ============================================================================

function ToneFragmentsEditor({ fragments, onChange }) {
  const updateField = (field, value) => {
    onChange({ ...fragments, [field]: value });
  };

  return (
    <div className="wce-tone-layout">
      {/* Core Tone */}
      <div>
        <label className="wce-tone-core-label">Core Tone (always included)
        <LocalTextArea
          value={fragments?.core || ""}
          onChange={(value) => updateField("core", value)}
          placeholder="Core style principles that apply to all chronicles..."
          className="illuminator-input wce-textarea-core-tone"
        />
        </label>
      </div>

      {/* Note about where other guidance lives */}
      <div className="wce-tone-note">
        <strong>Note:</strong> Culture-specific prose guidance is now in{" "}
        <em>Identity → Descriptive → PROSE_STYLE</em>. Entity kind prose guidance is in{" "}
        <em>Guidance → [kind] → proseHint</em>. These are automatically assembled during perspective
        synthesis based on the chronicle&apos;s entity constellation.
      </div>
    </div>
  );
}

function EditableList({ items, onChange, placeholder }) {
  const [newItem, setNewItem] = useState("");

  const handleAdd = () => {
    if (newItem.trim()) {
      onChange([...items, newItem.trim()]);
      setNewItem("");
    }
  };

  const handleRemove = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div>
      <div className="wce-editable-list-add">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="illuminator-input wce-editable-list-add-input"
        />
        <button
          onClick={handleAdd}
          className="illuminator-button illuminator-button-secondary"
          disabled={!newItem.trim()}
        >
          Add
        </button>
      </div>
      <div className="wce-editable-list-items">
        {items.map((item, index) => (
          <div key={index} className="wce-editable-list-item">
            <span className="wce-editable-list-item-text">{item}</span>
            <button onClick={() => handleRemove(index)} className="wce-editable-list-remove">
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WorldContextEditor({
  worldContext,
  onWorldContextChange,
  eras,
  onGenerateDynamics,
  isGeneratingDynamics,
}) {
  const updateField = useCallback(
    (field, value) => {
      onWorldContextChange({ [field]: value });
    },
    [onWorldContextChange]
  );

  const parseDynamicsFile = useCallback((fileContent) => {
    try {
      const parsed = JSON.parse(fileContent);
      if (!Array.isArray(parsed)) {
        alert("Invalid dynamics file: expected a JSON array.");
        return;
      }
      const valid = parsed.every(
        (d) => d && typeof d.id === "string" && typeof d.text === "string"
      );
      if (!valid) {
        alert("Invalid dynamics file: each entry must have id and text strings.");
        return;
      }
      updateField("worldDynamics", parsed);
    } catch (err) {
      alert(`Failed to parse dynamics JSON: ${err.message}`);
    }
  }, [updateField]);

  const handleImportDynamicsJson = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => parseDynamicsFile(ev.target.result);
      reader.readAsText(file);
    };
    input.click();
  }, [parseDynamicsFile]);

  return (
    <div>
      {/* Info Banner */}
      <div className="wce-info-banner">
        <div className="wce-info-banner-title">Entity context is built automatically</div>
        <div className="wce-info-banner-desc">
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
          <label htmlFor="world-name" className="illuminator-label">World Name</label>
          <input id="world-name"
            type="text"
            value={worldContext.name || ""}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="e.g., The Frozen Realms of Aurora Berg"
            className="illuminator-input"
          />
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">World Description
          <LocalTextArea
            value={worldContext.description || ""}
            onChange={(value) => updateField("description", value)}
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
        <p className="wce-description-text">
          Rule for what species can appear in generated images. This is added as a SPECIES
          REQUIREMENT at the top of image prompts to ensure all depicted figures match your world&apos;s
          inhabitants.
        </p>
        <div className="illuminator-form-group">
          <LocalTextArea
            value={worldContext.speciesConstraint || ""}
            onChange={(value) => updateField("speciesConstraint", value)}
            placeholder="e.g., All depicted figures must be penguins or orcas. No humans exist in this world."
            className="illuminator-input wce-textarea-tone"
          />
        </div>
      </div>

      {/* World Context Configuration */}
      <div className="wce-section-divider">
        <div className="wce-section-header">
          <h2 className="wce-section-title">Chronicle Generation</h2>
          <p className="wce-section-subtitle">
            Tone and facts for chronicle generation. Chronicles use perspective synthesis to create
            focused, faceted views based on each chronicle&apos;s entity constellation.
          </p>
        </div>

        {/* Canon Facts */}
        <div className="illuminator-card">
          <div className="illuminator-card-header">
            <h2 className="illuminator-card-title">Canon Facts</h2>
          </div>
          <p className="wce-description-text">
            World truths and generation constraints. Required facts must appear in perspective
            facets. Generation constraints are always included verbatim and never faceted.
          </p>
          <div className="illuminator-form-group wce-form-group-mb16">
            <span className="illuminator-label">Facet Range (optional)</span>
            <div className="wce-facet-range-row">
              <input
                type="number"
                min="1"
                step="1"
                value={worldContext.factSelection?.minCount ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  const num = Number(raw);
                  let parsed;
                  if (raw === "") {
                    parsed = undefined;
                  } else if (Number.isFinite(num)) {
                    parsed = Math.max(1, Math.floor(num));
                  } else {
                    parsed = undefined;
                  }
                  updateField("factSelection", {
                    ...(worldContext.factSelection || {}),
                    minCount: parsed,
                  });
                }}
                placeholder="min (4)"
                className="illuminator-input wce-facet-range-input"
              />
              <span className="wce-facet-range-separator">to</span>
              <input
                type="number"
                min="1"
                step="1"
                value={worldContext.factSelection?.maxCount ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  const num = Number(raw);
                  let parsed;
                  if (raw === "") {
                    parsed = undefined;
                  } else if (Number.isFinite(num)) {
                    parsed = Math.max(1, Math.floor(num));
                  } else {
                    parsed = undefined;
                  }
                  updateField("factSelection", {
                    ...(worldContext.factSelection || {}),
                    maxCount: parsed,
                  });
                }}
                placeholder="max (6)"
                className="illuminator-input wce-facet-range-input"
              />
            </div>
            <div className="wce-facet-range-hint">
              Range of world-truth facts to facet. Required facts count toward this; min is raised
              to match required count if needed.
            </div>
          </div>
          <FactsEditor
            facts={worldContext.canonFactsWithMetadata || []}
            onChange={(facts) => updateField("canonFactsWithMetadata", facts)}
          />
        </div>

        {/* World Dynamics */}
        <div className="illuminator-card">
          <div className="illuminator-card-header wce-dynamics-header">
            <h2 className="illuminator-card-title">World Dynamics</h2>
            <div className="wce-dynamics-actions">
              <button
                onClick={handleImportDynamicsJson}
                className="illuminator-button illuminator-button-secondary wce-dynamics-btn"
              >
                Import JSON
              </button>
              {worldContext.worldDynamics?.length > 0 && (
                <button
                  onClick={() => {
                    const json = JSON.stringify(worldContext.worldDynamics, null, 2);
                    const blob = new Blob([json], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `dynamics-${new Date().toISOString().slice(0, 10)}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
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
          </div>
          <p className="wce-description-text">
            Higher-level narrative context about inter-group forces and behaviors. These statements
            describe macro-level dynamics that individual relationships are expressions of.
            Optionally filter by culture or entity kind so they only appear in relevant chronicles.
          </p>
          <WorldDynamicsEditor
            dynamics={worldContext.worldDynamics || []}
            onChange={(dynamics) => updateField("worldDynamics", dynamics)}
            eras={eras}
          />
        </div>


        {/* Tone Fragments */}
        <div className="illuminator-card">
          <div className="illuminator-card-header">
            <h2 className="illuminator-card-title">Tone Fragments</h2>
          </div>
          <p className="wce-description-text">
            Composable tone guidance. Core is always included; culture and kind overlays are added
            based on the chronicle&apos;s entity constellation.
          </p>
          <ToneFragmentsEditor
            fragments={worldContext.toneFragments || {}}
            onChange={(fragments) => updateField("toneFragments", fragments)}
          />
        </div>
      </div>
    </div>
  );
}

FactCard.propTypes = {
  fact: PropTypes.object.isRequired,
  onUpdate: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};

FactsEditor.propTypes = {
  facts: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
};

WorldDynamicCard.propTypes = {
  dynamic: PropTypes.object.isRequired,
  onUpdate: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  eras: PropTypes.array,
};

WorldDynamicsEditor.propTypes = {
  dynamics: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  eras: PropTypes.array,
};

ToneFragmentsEditor.propTypes = {
  fragments: PropTypes.object,
  onChange: PropTypes.func.isRequired,
};

EditableList.propTypes = {
  items: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
};

WorldContextEditor.propTypes = {
  worldContext: PropTypes.object.isRequired,
  onWorldContextChange: PropTypes.func.isRequired,
  eras: PropTypes.array,
  onGenerateDynamics: PropTypes.func,
  isGeneratingDynamics: PropTypes.bool,
};
