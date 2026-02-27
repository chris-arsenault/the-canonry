/**
 * EntityEditor - Create and manage seed entities.
 */

import React, { useState } from "react";
import PropTypes from "prop-types";
import { generateEntityName } from "../../lib/name-generator.js";
import {
  TagSelector,
  ToolUsageBadges as UsageBadges,
  getEntityKindUsageSummary,
} from "@penguin-tales/shared-components";
import "./EntityEditor.css";

export default function EntityEditor({ project, onSave, onAddTag, schemaUsage = {} }) {
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [filterKind, setFilterKind] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);

  const entities = project?.seedEntities || [];
  // Schema v2: entityKinds at project root
  const entityKinds = project?.entityKinds || [];
  const cultures = project?.cultures || [];
  const tagRegistry = project?.tagRegistry || [];

  const filteredEntities = filterKind ? entities.filter((e) => e.kind === filterKind) : entities;

  const selectedEntity = entities.find((e) => e.id === selectedEntityId);
  const selectedKindDef = entityKinds.find((k) => k.kind === selectedEntity?.kind);

  const updateEntities = (newEntities) => {
    onSave({ seedEntities: newEntities });
  };

  const addEntity = () => {
    const defaultKind = entityKinds[0];
    if (!defaultKind) {
      alert("Define entity kinds in Schema first");
      return;
    }

    const newEntity = {
      id: `entity_${Date.now()}`,
      kind: defaultKind.kind,
      subtype: defaultKind.subtypes[0]?.id || "",
      name: "New Entity",
      summary: "",
      narrativeHint: "",
      description: "",
      status: defaultKind.statuses[0]?.id || "active",
      prominence: "recognized",
      culture: cultures[0]?.id || "",
      tags: {}, // Key-value pairs for semantic tagging
      links: [], // Relationships are stored separately, populated at load time
      coordinates: { x: 50, y: 50, z: 50 },
      createdAt: 0,
      updatedAt: 0,
    };

    updateEntities([...entities, newEntity]);
    setSelectedEntityId(newEntity.id);
  };

  const updateEntity = (updates) => {
    if (!selectedEntity) return;

    // If kind changed, reset subtype and status
    if (updates.kind && updates.kind !== selectedEntity.kind) {
      const newKind = entityKinds.find((k) => k.kind === updates.kind);
      updates.subtype = newKind?.subtypes[0]?.id || "";
      updates.status = newKind?.statuses[0]?.id || "active";
    }

    updateEntities(entities.map((e) => (e.id === selectedEntityId ? { ...e, ...updates } : e)));
  };

  const deleteEntity = () => {
    if (!selectedEntity) return;
    if (!confirm(`Delete "${selectedEntity.name}"?`)) return;

    updateEntities(entities.filter((e) => e.id !== selectedEntityId));
    setSelectedEntityId(null);
  };

  const getCultureColor = (cultureId) => {
    return cultures.find((c) => c.id === cultureId)?.color || "#707080";
  };

  const handleGenerateName = async () => {
    if (!selectedEntity) return;

    const culture = cultures.find((c) => c.id === selectedEntity.culture);
    if (!culture) {
      setGenerateError("Select a culture first");
      return;
    }

    // Check if culture has naming profiles
    if (!culture.naming?.profiles || culture.naming.profiles.length === 0) {
      setGenerateError(
        `Culture "${culture.name || culture.id}" has no naming profiles. Configure naming in Name Forge first.`
      );
      return;
    }

    setGenerating(true);
    setGenerateError(null);

    try {
      const name = await generateEntityName(culture, {
        kind: selectedEntity.kind,
        subtype: selectedEntity.subtype,
        prominence: selectedEntity.prominence,
        tags: Object.keys(selectedEntity.tags || {}),
      });
      updateEntity({ name });
    } catch (err) {
      console.error("Name generation error:", err);
      setGenerateError(err.message || "Failed to generate name");
    } finally {
      setGenerating(false);
    }
  };

  // Check if current entity can have names generated
  const canGenerateName = () => {
    if (!selectedEntity) return false;
    const culture = cultures.find((c) => c.id === selectedEntity.culture);
    return culture && culture.naming?.profiles && culture.naming.profiles.length > 0;
  };

  // Convert tags from object format { tag: true } to array format ['tag']
  const getTagsAsArray = () => {
    const tags = selectedEntity?.tags || {};
    return Object.keys(tags);
  };

  // Update tags from array format back to object format
  const handleTagsChange = (tagArray) => {
    if (!selectedEntity) return;
    const tagsObj = {};
    tagArray.forEach((tag) => {
      tagsObj[tag] = true;
    });
    updateEntity({ tags: tagsObj });
  };

  return (
    <div className="ee-container">
      <div className="ee-list-panel">
        <div className="ee-header">
          <div className="ee-title">Entities</div>
          <div className="ee-subtitle">Create seed entities to populate your world.</div>
        </div>

        <div className="ee-toolbar">
          <select
            className="ee-filter-select"
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value)}
          >
            <option value="">All kinds ({entities.length})</option>
            {entityKinds.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.description || k.kind} ({entities.filter((e) => e.kind === k.kind).length})
              </option>
            ))}
          </select>
          <button className="ee-add-button" onClick={addEntity}>
            + Add
          </button>
        </div>

        <div className="ee-entity-list">
          {filteredEntities.length === 0 ? (
            <div className="ee-empty-state">
              {entities.length === 0
                ? "No entities yet. Create one to get started."
                : "No entities match the filter."}
            </div>
          ) : (
            filteredEntities.map((entity) => (
              <div
                key={entity.id}
                className={`ee-entity-item${selectedEntityId === entity.id ? " ee-entity-item-selected" : ""}`}
                onClick={() => setSelectedEntityId(entity.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
              >
                <div
                  className="ee-entity-color"
                  style={{ '--ee-entity-color-bg': getCultureColor(entity.culture) }}
                />
                <div className="ee-entity-info">
                  <div className="ee-entity-name">{entity.name}</div>
                  <div className="ee-entity-meta-row">
                    <span className="ee-entity-meta">
                      {entity.kind} / {entity.subtype || "no subtype"}
                    </span>
                    <UsageBadges
                      usage={getEntityKindUsageSummary(schemaUsage, entity.kind)}
                      compact
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="ee-form-panel">
        {!selectedEntity ? (
          <div className="ee-empty-form">Select an entity to edit, or create a new one.</div>
        ) : (
          <>
            <div className="ee-form-title">Edit Entity</div>

            <div className="ee-form-group">
              <span className="ee-label">Name</span>
              <div className="ee-name-row">
                <input
                  className="ee-input ee-name-input"
                  value={selectedEntity.name}
                  onChange={(e) => updateEntity({ name: e.target.value })}
                />
                <button
                  className={`ee-generate-button${!canGenerateName() || generating ? " ee-generate-button-disabled" : ""}`}
                  onClick={handleGenerateName}
                  disabled={!canGenerateName() || generating}
                  title={(() => {
                    if (!selectedEntity.culture) return "Select a culture first";
                    if (!canGenerateName()) return "Configure naming in Name Forge first";
                    return "Generate a culturally-appropriate name";
                  })()}
                >
                  {generating ? "Generating..." : "Generate"}
                </button>
              </div>
              {generateError && (
                <div className="ee-generate-error">
                  {generateError}
                </div>
              )}
            </div>

            <div className="ee-row">
              <div className="ee-form-group-flex">
                <label htmlFor="kind" className="ee-label">Kind</label>
                <select id="kind"
                  className="ee-select"
                  value={selectedEntity.kind}
                  onChange={(e) => updateEntity({ kind: e.target.value })}
                >
                  {entityKinds.map((k) => (
                    <option key={k.kind} value={k.kind}>
                      {k.description || k.kind}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ee-form-group-flex">
                <label htmlFor="subtype" className="ee-label">Subtype</label>
                <select id="subtype"
                  className="ee-select"
                  value={selectedEntity.subtype || ""}
                  onChange={(e) => updateEntity({ subtype: e.target.value })}
                >
                  <option value="">None</option>
                  {selectedKindDef?.subtypes?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="ee-row">
              <div className="ee-form-group-flex">
                <label htmlFor="status" className="ee-label">Status</label>
                <select id="status"
                  className="ee-select"
                  value={selectedEntity.status}
                  onChange={(e) => updateEntity({ status: e.target.value })}
                >
                  {selectedKindDef?.statuses?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ee-form-group-flex">
                <label htmlFor="culture" className="ee-label">Culture</label>
                <select id="culture"
                  className="ee-select"
                  value={selectedEntity.culture || ""}
                  onChange={(e) => updateEntity({ culture: e.target.value })}
                >
                  <option value="">None</option>
                  {cultures.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="ee-form-group">
              <label htmlFor="prominence" className="ee-label">Prominence</label>
              <select id="prominence"
                className="ee-select"
                value={selectedEntity.prominence ?? 2.0}
                onChange={(e) => updateEntity({ prominence: parseFloat(e.target.value) })}
              >
                <option value="0.5">Forgotten</option>
                <option value="1.5">Marginal</option>
                <option value="2.5">Recognized</option>
                <option value="3.5">Renowned</option>
                <option value="4.5">Mythic</option>
              </select>
            </div>

            <div className="ee-form-group">
              <label className="ee-label">Tags
              <TagSelector
                value={getTagsAsArray()}
                onChange={handleTagsChange}
                tagRegistry={tagRegistry}
                placeholder="Select tags..."
                onAddToRegistry={onAddTag}
              />
              </label>
            </div>

            <div className="ee-form-group">
              <label htmlFor="summary" className="ee-label">Summary</label>
              <textarea id="summary"
                className="ee-textarea"
                value={
                  selectedEntity.summary ??
                  selectedEntity.narrativeHint ??
                  selectedEntity.description ??
                  ""
                }
                onChange={(e) =>
                  updateEntity({ summary: e.target.value, narrativeHint: e.target.value })
                }
                placeholder="Optional summary..."
              />
            </div>

            <div className="ee-form-group">
              <span className="ee-label">Coordinates</span>
              <div className="ee-coords-display">
                {["x", "y", "z"].map((axis) => (
                  <div key={axis} className="ee-coord-item">
                    <span className="ee-coord-label">{axis.toUpperCase()}:</span>
                    <span className="ee-coord-value">
                      {selectedEntity.coordinates?.[axis] ?? 50}
                    </span>
                  </div>
                ))}
              </div>
              <div className="ee-coord-hint">
                Edit coordinates by dragging entities on the Semantic Planes view
              </div>
            </div>

            <button className="ee-delete-button" onClick={deleteEntity}>
              Delete Entity
            </button>
          </>
        )}
      </div>
    </div>
  );
}

EntityEditor.propTypes = {
  project: PropTypes.object,
  onSave: PropTypes.func.isRequired,
  onAddTag: PropTypes.func,
  schemaUsage: PropTypes.object,
};
