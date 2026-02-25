/**
 * ResultsPanel - Review completed enrichments and select for re-run
 *
 * Shows:
 * - Completed enrichments with previews
 * - Image thumbnails with full-size preview
 * - Multi-select for regeneration
 *
 * Note: Enrichment results are auto-saved to IndexedDB per slot.
 */

import { useState, useMemo } from "react";
import {
  buildProminenceScale,
  DEFAULT_PROMINENCE_DISTRIBUTION,
  prominenceLabelFromScale,
} from "@canonry/world-schema";
import "./ResultsPanel.css";

function EntityResultCard({
  entity,
  tasks,
  selected,
  onToggleSelect,
  onRegenerate,
  onPreviewImage,
  prominenceScale,
}) {
  const descriptionTask = tasks.find((t) => t.type === "description" && t.status === "complete");
  const imageTask = tasks.find((t) => t.type === "image" && t.status === "complete");

  return (
    <div className="illuminator-entity-card">
      {/* Image thumbnail */}
      <div className="illuminator-entity-image">
        {imageTask?.result?.imageUrl ? (
          <img
            src={imageTask.result.imageUrl}
            alt={entity.name}
            onClick={() => onPreviewImage(imageTask.result.imageUrl)}
            className="rp-clickable-image"
          />
        ) : (
          <div className="rp-placeholder-icon">
            {entity.kind === "npc" && "&#x1F9D1;"}
            {entity.kind === "location" && "&#x1F3D4;"}
            {entity.kind === "faction" && "&#x1F6E1;"}
            {entity.kind === "occurrence" && "&#x26A1;"}
            {!["npc", "location", "faction", "occurrence"].includes(entity.kind) && "&#x2728;"}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="illuminator-entity-details">
        <div className="illuminator-entity-name">{entity.name}</div>
        <div className="illuminator-entity-kind">
          {entity.kind}/{entity.subtype} -{" "}
          {prominenceLabelFromScale(entity.prominence, prominenceScale)}
        </div>
        {(descriptionTask?.result?.summary || descriptionTask?.result?.description) && (
          <div className="illuminator-entity-description">
            {descriptionTask.result.summary && (
              <>
                <div className="rp-section-heading">Summary</div>
                <div>{descriptionTask.result.summary}</div>
              </>
            )}
            {descriptionTask.result.description && (
              <>
                <div className="rp-description-heading">Description</div>
                <div>{descriptionTask.result.description}</div>
              </>
            )}
          </div>
        )}
        <div className="illuminator-entity-actions">
          <label className="rp-select-label">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              className="illuminator-checkbox"
            />
            <span className="rp-select-label-text">Select</span>
          </label>
          {imageTask && (
            <button
              onClick={() => onRegenerate(`img_${entity.id}`)}
              className="illuminator-button illuminator-button-secondary rp-regen-btn"
            >
              Regenerate Image
            </button>
          )}
          {descriptionTask && (
            <button
              onClick={() => onRegenerate(`desc_${entity.id}`)}
              className="illuminator-button illuminator-button-secondary rp-regen-btn"
            >
              Regenerate Description
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ImagePreviewModal({ imageUrl, onClose }) {
  if (!imageUrl) return null;

  return (
    <div className="rp-preview-overlay" onClick={onClose}>
      <img src={imageUrl} alt="Preview" className="rp-preview-image" />
      <button onClick={onClose} className="rp-preview-close">
        ×
      </button>
    </div>
  );
}

export default function ResultsPanel({ tasks, entities = [], onRegenerateTask }) {
  const [selectedEntities, setSelectedEntities] = useState(new Set());
  const [previewImage, setPreviewImage] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const effectiveProminenceScale = useMemo(() => {
    const values = (entities || [])
      .map((entity) => entity.prominence)
      .filter((value) => typeof value === "number" && Number.isFinite(value));
    return buildProminenceScale(values, { distribution: DEFAULT_PROMINENCE_DISTRIBUTION });
  }, [entities]);

  // Get entities with completed tasks
  const enrichedEntities = useMemo(() => {
    const entityMap = new Map();

    // Build entity map from world data
    for (const entity of entities || []) {
      entityMap.set(entity.id, { ...entity, tasks: [] });
    }

    // Add tasks to entities
    for (const task of tasks) {
      if (task.status === "complete" && entityMap.has(task.entityId)) {
        entityMap.get(task.entityId).tasks.push(task);
      }
    }

    // Filter to only entities with completed tasks
    return Array.from(entityMap.values()).filter((e) => e.tasks.length > 0);
  }, [entities, tasks]);

  // Apply filter
  const filteredEntities = useMemo(() => {
    if (filterType === "all") return enrichedEntities;
    return enrichedEntities.filter((e) => e.tasks.some((t) => t.type === filterType));
  }, [enrichedEntities, filterType]);

  const toggleSelect = (entityId) => {
    setSelectedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(entityId)) {
        next.delete(entityId);
      } else {
        next.add(entityId);
      }
      return next;
    });
  };

  const regenerateSelected = () => {
    const taskIds = [];
    for (const entityId of selectedEntities) {
      const entity = enrichedEntities.find((e) => e.id === entityId);
      if (entity) {
        for (const task of entity.tasks) {
          taskIds.push(task.id);
        }
      }
    }
    if (taskIds.length > 0) {
      onRegenerateTask(taskIds);
    }
  };

  const totalImages = tasks.filter((t) => t.type === "image" && t.status === "complete").length;
  const totalDescriptions = tasks.filter(
    (t) => t.type === "description" && t.status === "complete"
  ).length;

  return (
    <div>
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Enrichment Results</h2>
          <span className="rp-autosave-note">
            Changes auto-save to current slot
          </span>
        </div>

        {enrichedEntities.length === 0 ? (
          <div className="rp-empty-state">
            No enrichment results yet. Run some tasks to see results here.
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="rp-stats-bar">
              <div>
                <span className="rp-stat-value">{enrichedEntities.length}</span>
                <span className="rp-stat-label">
                  entities
                </span>
              </div>
              <div>
                <span className="rp-stat-value">{totalDescriptions}</span>
                <span className="rp-stat-label">
                  descriptions
                </span>
              </div>
              <div>
                <span className="rp-stat-value">{totalImages}</span>
                <span className="rp-stat-label">
                  images
                </span>
              </div>

              <div className="rp-filter-wrapper">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="illuminator-select rp-filter-select"
                >
                  <option value="all">All Types</option>
                  <option value="description">Descriptions</option>
                  <option value="image">Images</option>
                </select>
              </div>
            </div>

            {/* Entity cards */}
            <div>
              {filteredEntities.map((entity) => (
                <EntityResultCard
                  key={entity.id}
                  entity={entity}
                  tasks={entity.tasks}
                  selected={selectedEntities.has(entity.id)}
                  onToggleSelect={() => toggleSelect(entity.id)}
                  onRegenerate={onRegenerateTask}
                  onPreviewImage={setPreviewImage}
                  prominenceScale={effectiveProminenceScale}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Selection actions */}
      {selectedEntities.size > 0 && (
        <div className="rp-selection-bar">
          <span className="rp-selection-count">
            {selectedEntities.size} entit{selectedEntities.size !== 1 ? "ies" : "y"} selected
          </span>
          <div className="rp-selection-actions">
            <button
              onClick={() => setSelectedEntities(new Set())}
              className="illuminator-button illuminator-button-secondary"
            >
              Clear
            </button>
            <button onClick={regenerateSelected} className="illuminator-button">
              Regenerate Selected
            </button>
          </div>
        </div>
      )}

      {/* Image preview modal */}
      <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  );
}
