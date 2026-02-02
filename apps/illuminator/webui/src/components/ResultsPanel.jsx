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

import { useState, useMemo } from 'react';
import {
  buildProminenceScale,
  DEFAULT_PROMINENCE_DISTRIBUTION,
  prominenceLabelFromScale,
} from '@canonry/world-schema';

function EntityResultCard({
  entity,
  tasks,
  selected,
  onToggleSelect,
  onRegenerate,
  onPreviewImage,
  prominenceScale,
}) {
  const descriptionTask = tasks.find((t) => t.type === 'description' && t.status === 'complete');
  const imageTask = tasks.find((t) => t.type === 'image' && t.status === 'complete');

  return (
    <div className="illuminator-entity-card">
      {/* Image thumbnail */}
      <div className="illuminator-entity-image">
        {imageTask?.result?.imageUrl ? (
          <img
            src={imageTask.result.imageUrl}
            alt={entity.name}
            onClick={() => onPreviewImage(imageTask.result.imageUrl)}
            style={{ cursor: 'pointer' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: '32px',
            }}
          >
            {entity.kind === 'npc' && '&#x1F9D1;'}
            {entity.kind === 'location' && '&#x1F3D4;'}
            {entity.kind === 'faction' && '&#x1F6E1;'}
            {entity.kind === 'occurrence' && '&#x26A1;'}
            {!['npc', 'location', 'faction', 'occurrence'].includes(entity.kind) && '&#x2728;'}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="illuminator-entity-details">
        <div className="illuminator-entity-name">{entity.name}</div>
        <div className="illuminator-entity-kind">
          {entity.kind}/{entity.subtype} - {prominenceLabelFromScale(entity.prominence, prominenceScale)}
        </div>
        {(descriptionTask?.result?.summary || descriptionTask?.result?.description) && (
          <div className="illuminator-entity-description">
            {descriptionTask.result.summary && (
              <>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Summary</div>
                <div>{descriptionTask.result.summary}</div>
              </>
            )}
            {descriptionTask.result.description && (
              <>
                <div style={{ fontWeight: 600, margin: '8px 0 4px' }}>Description</div>
                <div>{descriptionTask.result.description}</div>
              </>
            )}
          </div>
        )}
        <div className="illuminator-entity-actions">
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              className="illuminator-checkbox"
            />
            <span style={{ fontSize: '12px' }}>Select</span>
          </label>
          {imageTask && (
            <button
              onClick={() => onRegenerate(`img_${entity.id}`)}
              className="illuminator-button illuminator-button-secondary"
              style={{ padding: '4px 10px', fontSize: '11px' }}
            >
              Regenerate Image
            </button>
          )}
          {descriptionTask && (
            <button
              onClick={() => onRegenerate(`desc_${entity.id}`)}
              className="illuminator-button illuminator-button-secondary"
              style={{ padding: '4px 10px', fontSize: '11px' }}
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
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        cursor: 'pointer',
      }}
      onClick={onClose}
    >
      <img
        src={imageUrl}
        alt="Preview"
        style={{
          maxWidth: '90%',
          maxHeight: '90%',
          objectFit: 'contain',
          borderRadius: '8px',
        }}
      />
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'rgba(255, 255, 255, 0.2)',
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          color: 'white',
          fontSize: '20px',
          cursor: 'pointer',
        }}
      >
        ×
      </button>
    </div>
  );
}

export default function ResultsPanel({
  tasks,
  worldData,
  onRegenerateTask,
}) {
  const [selectedEntities, setSelectedEntities] = useState(new Set());
  const [previewImage, setPreviewImage] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const effectiveProminenceScale = useMemo(() => {
    const values = (worldData?.hardState || [])
      .map((entity) => entity.prominence)
      .filter((value) => typeof value === 'number' && Number.isFinite(value));
    return buildProminenceScale(values, { distribution: DEFAULT_PROMINENCE_DISTRIBUTION });
  }, [worldData]);

  // Get entities with completed tasks
  const enrichedEntities = useMemo(() => {
    const entityMap = new Map();

    // Build entity map from world data
    for (const entity of worldData?.hardState || []) {
      entityMap.set(entity.id, { ...entity, tasks: [] });
    }

    // Add tasks to entities
    for (const task of tasks) {
      if (task.status === 'complete' && entityMap.has(task.entityId)) {
        entityMap.get(task.entityId).tasks.push(task);
      }
    }

    // Filter to only entities with completed tasks
    return Array.from(entityMap.values()).filter((e) => e.tasks.length > 0);
  }, [worldData, tasks]);

  // Apply filter
  const filteredEntities = useMemo(() => {
    if (filterType === 'all') return enrichedEntities;
    return enrichedEntities.filter((e) =>
      e.tasks.some((t) => t.type === filterType)
    );
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

  const totalImages = tasks.filter((t) => t.type === 'image' && t.status === 'complete').length;
  const totalDescriptions = tasks.filter((t) => t.type === 'description' && t.status === 'complete').length;

  return (
    <div>
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Enrichment Results</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Changes auto-save to current slot
          </span>
        </div>

        {enrichedEntities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No enrichment results yet. Run some tasks to see results here.
          </div>
        ) : (
          <>
            {/* Stats */}
            <div
              style={{
                display: 'flex',
                gap: '16px',
                marginBottom: '16px',
                padding: '12px',
                background: 'var(--bg-tertiary)',
                borderRadius: '4px',
              }}
            >
              <div>
                <span style={{ fontSize: '18px', fontWeight: 600 }}>{enrichedEntities.length}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                  entities
                </span>
              </div>
              <div>
                <span style={{ fontSize: '18px', fontWeight: 600 }}>{totalDescriptions}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                  descriptions
                </span>
              </div>
              <div>
                <span style={{ fontSize: '18px', fontWeight: 600 }}>{totalImages}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                  images
                </span>
              </div>

              <div style={{ marginLeft: 'auto' }}>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="illuminator-select"
                  style={{ width: '140px' }}
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
        <div
          style={{
            position: 'sticky',
            bottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--accent-color)',
            borderRadius: '6px',
          }}
        >
          <span style={{ fontSize: '13px' }}>
            {selectedEntities.size} entit{selectedEntities.size !== 1 ? 'ies' : 'y'} selected
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
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
