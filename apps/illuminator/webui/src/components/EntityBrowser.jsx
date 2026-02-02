/**
 * EntityBrowser - Primary entity-centric view
 *
 * Shows all entities with their enrichment status.
 * Allows filtering, selection, and queueing enrichment tasks.
 * Includes enrichment settings (moved from ConfigPanel).
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import ImageModal from './ImageModal';
import ImagePickerModal from './ImagePickerModal';
import EntityDetailView from './EntityDetailView';
import { ImageSettingsSummary } from './ImageSettingsDrawer';
import { useImageUrl } from '../hooks/useImageUrl';
import {
  estimateTextCost,
  estimateImageCost,
  formatCost,
  formatEstimatedCost,
} from '../lib/costEstimation';
import {
  buildProminenceScale,
  DEFAULT_PROMINENCE_DISTRIBUTION,
  prominenceLabelFromScale,
  prominenceThresholdFromScale,
} from '@canonry/world-schema';
// imageSettings imports removed - size/quality now in ImageSettingsDrawer

// Thumbnail component that lazy-loads image when visible via IntersectionObserver
function ImageThumbnail({ imageId, alt, onClick }) {
  const containerRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Only activate the hook once visible (pass null to skip loading)
  const { url, loading, error } = useImageUrl(visible ? imageId : null);

  const placeholder = (text, title) => (
    <div
      ref={containerRef}
      style={{
        width: '80px',
        height: '80px',
        borderRadius: '4px',
        background: 'var(--bg-tertiary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        fontSize: '10px',
      }}
      title={title}
    >
      {text}
    </div>
  );

  if (!visible || loading) return placeholder('Loading...');
  if (error || !url) return placeholder('No image', error || 'Image not found');

  return (
    <div ref={containerRef} style={{ cursor: 'pointer' }} onClick={() => onClick(imageId, alt)}>
      <img
        src={url}
        alt={alt}
        style={{
          width: '80px',
          height: '80px',
          objectFit: 'cover',
          borderRadius: '4px',
        }}
      />
    </div>
  );
}

const PROMINENCE_ORDER = ['mythic', 'renowned', 'recognized', 'marginal', 'forgotten'];

const PROMINENCE_OPTIONS = [
  { value: 'mythic', label: 'Mythic' },
  { value: 'renowned', label: 'Renowned' },
  { value: 'recognized', label: 'Recognized' },
  { value: 'marginal', label: 'Marginal' },
  { value: 'forgotten', label: 'Forgotten' },
];

function prominenceAtLeast(prominence, minProminence, scale) {
  if (typeof prominence === 'number' && Number.isFinite(prominence)) {
    return prominence >= prominenceThresholdFromScale(minProminence, scale);
  }
  if (typeof prominence === 'string') {
    const prominenceIndex = scale.labels.indexOf(prominence);
    const minIndex = scale.labels.indexOf(minProminence);
    return prominenceIndex >= 0 && minIndex >= 0 && prominenceIndex >= minIndex;
  }
  return false;
}

function EnrichmentStatusBadge({ status, label, cost }) {
  const styles = {
    missing: { background: 'var(--bg-tertiary)', color: 'var(--text-muted)' },
    queued: { background: '#3b82f6', color: 'white' },
    running: { background: '#f59e0b', color: 'white' },
    complete: { background: '#10b981', color: 'white' },
    error: { background: '#ef4444', color: 'white' },
    disabled: { background: 'var(--bg-tertiary)', color: 'var(--text-muted)', opacity: 0.5 },
  };

  const icons = {
    missing: '○',
    queued: '◷',
    running: '◐',
    complete: '✓',
    error: '✗',
    disabled: '─',
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 500,
        ...styles[status],
      }}
    >
      <span>{icons[status]}</span>
      <span>{label}</span>
      {cost !== undefined && (
        <span style={{ opacity: 0.8, marginLeft: '2px' }}>{cost}</span>
      )}
    </span>
  );
}

function EntityRow({
  entity,
  descStatus,
  imgStatus,
  selected,
  onToggleSelect,
  onQueueDesc,
  onQueueImg,
  onCancelDesc,
  onCancelImg,
  onAssignImage,
  canQueueImage,
  needsDescription,
  onImageClick,
  onEntityClick,
  descCost,
  imgCost,
  prominenceScale,
}) {
  const enrichment = entity.enrichment || {};

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr auto',
        gap: '12px',
        padding: '12px',
        borderBottom: '1px solid var(--border-color)',
        alignItems: 'start',
      }}
    >
      {/* Checkbox */}
      <div style={{ paddingTop: '2px' }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          style={{ cursor: 'pointer' }}
        />
      </div>

      {/* Entity info */}
      <div>
        <div
          style={{
            fontWeight: 500,
            marginBottom: '4px',
            cursor: 'pointer',
            color: 'var(--accent-color)',
          }}
          onClick={onEntityClick}
          title="Click to view entity details"
        >
          {entity.name}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
          {entity.kind}/{entity.subtype} · {prominenceLabelFromScale(entity.prominence, prominenceScale)}
          {entity.culture && ` · ${entity.culture}`}
        </div>

        {/* Content row: description and image side by side */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {/* Description preview if exists (summary is now on entity directly) */}
          {entity.summary && (
            <div
              style={{
                flex: 1,
                fontSize: '12px',
                color: 'var(--text-secondary)',
                padding: '8px',
                background: 'var(--bg-tertiary)',
                borderRadius: '4px',
                maxHeight: '80px',
                overflow: 'hidden',
                cursor: 'pointer',
              }}
              onClick={onEntityClick}
              title="Click to view entity details"
            >
              {entity.summary}
            </div>
          )}

          {/* Image preview if exists */}
          {enrichment.image?.imageId && (
            <ImageThumbnail
              imageId={enrichment.image.imageId}
              alt={entity.name}
              onClick={onImageClick}
            />
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
        {/* Description status and action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <EnrichmentStatusBadge status={descStatus} label="Desc" cost={descCost} />
          {descStatus === 'missing' && (
            <button
              onClick={onQueueDesc}
              className="illuminator-button illuminator-button-secondary"
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              Queue
            </button>
          )}
          {(descStatus === 'queued' || descStatus === 'running') && (
            <button
              onClick={onCancelDesc}
              className="illuminator-button illuminator-button-secondary"
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              Cancel
            </button>
          )}
          {descStatus === 'error' && (
            <button
              onClick={onQueueDesc}
              className="illuminator-button illuminator-button-secondary"
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              Retry
            </button>
          )}
          {descStatus === 'complete' && (
            <button
              onClick={onQueueDesc}
              className="illuminator-button illuminator-button-secondary"
              style={{ padding: '4px 8px', fontSize: '11px' }}
              title="Regenerate description"
            >
              Regen
            </button>
          )}
        </div>

        {/* Image status and action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <EnrichmentStatusBadge status={canQueueImage ? imgStatus : 'disabled'} label="Image" cost={canQueueImage ? imgCost : undefined} />
          {needsDescription && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              Needs desc first
            </span>
          )}
          {canQueueImage && imgStatus === 'missing' && (
            <>
              <button
                onClick={onQueueImg}
                className="illuminator-button illuminator-button-secondary"
                style={{ padding: '4px 8px', fontSize: '11px' }}
              >
                Queue
              </button>
              <button
                onClick={onAssignImage}
                className="illuminator-button illuminator-button-secondary"
                style={{ padding: '4px 8px', fontSize: '11px' }}
                title="Assign existing image from library"
              >
                Assign
              </button>
            </>
          )}
          {canQueueImage && (imgStatus === 'queued' || imgStatus === 'running') && (
            <button
              onClick={onCancelImg}
              className="illuminator-button illuminator-button-secondary"
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              Cancel
            </button>
          )}
          {canQueueImage && imgStatus === 'error' && (
            <>
              <button
                onClick={onQueueImg}
                className="illuminator-button illuminator-button-secondary"
                style={{ padding: '4px 8px', fontSize: '11px' }}
              >
                Retry
              </button>
              <button
                onClick={onAssignImage}
                className="illuminator-button illuminator-button-secondary"
                style={{ padding: '4px 8px', fontSize: '11px' }}
                title="Assign existing image from library"
              >
                Assign
              </button>
            </>
          )}
          {canQueueImage && imgStatus === 'complete' && (
            <>
              <button
                onClick={onQueueImg}
                className="illuminator-button illuminator-button-secondary"
                style={{ padding: '4px 8px', fontSize: '11px' }}
                title="Regenerate image"
              >
                Regen
              </button>
              <button
                onClick={onAssignImage}
                className="illuminator-button illuminator-button-secondary"
                style={{ padding: '4px 8px', fontSize: '11px' }}
                title="Assign different image from library"
              >
                Assign
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper to get cost display for an entity
function getEntityCostDisplay(entity, type, status, config, enrichment, buildPrompt) {
  // If complete, show actual cost
  if (status === 'complete') {
    if (type === 'description' && enrichment?.text?.actualCost) {
      return formatCost(enrichment.text.actualCost);
    }
    if (type === 'image' && enrichment?.image?.actualCost) {
      return formatCost(enrichment.image.actualCost);
    }
  }

  // If missing, show estimated cost
  if (status === 'missing') {
    if (type === 'description') {
      const prompt = buildPrompt(entity, 'description');
      const estimate = estimateTextCost(prompt, 'description', config.textModel);
      return formatEstimatedCost(estimate.estimatedCost);
    }
    if (type === 'image') {
      const cost = estimateImageCost(config.imageModel, imageGenSettings.imageSize, imageGenSettings.imageQuality);
      return formatEstimatedCost(cost);
    }
  }

  return undefined;
}

export default function EntityBrowser({
  entities,
  queue,
  onEnqueue,
  onCancel,
  onAssignImage,
  worldSchema,
  config,
  onConfigChange,
  buildPrompt,
  getVisualConfig,
  styleLibrary,
  imageGenSettings,
  onOpenImageSettings,
  prominenceScale,
  onStartRevision,
  isRevising,
  onUpdateBackrefs,
  onUndoDescription,
  onCopyEdit,
  isCopyEditActive,
  onHistorianReview,
  isHistorianActive,
  historianConfigured,
  onUpdateHistorianNote,
  onRename,
  onPatchEvents,
}) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [filters, setFilters] = useState({
    kind: 'all',
    prominence: 'all',
    status: 'all',
    culture: 'all',
    chronicleImage: 'all',
  });
  const effectiveProminenceScale = useMemo(() => {
    if (prominenceScale) return prominenceScale;
    const values = entities
      .map((entity) => entity.prominence)
      .filter((value) => typeof value === 'number' && Number.isFinite(value));
    return buildProminenceScale(values, { distribution: DEFAULT_PROMINENCE_DISTRIBUTION });
  }, [prominenceScale, entities]);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [imageModal, setImageModal] = useState({ open: false, imageId: '', title: '' });
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [imagePickerEntity, setImagePickerEntity] = useState(null);
  const imageModel = config.imageModel || 'dall-e-3';

  // Get unique values for filters
  const filterOptions = useMemo(() => {
    const kinds = new Set();
    const cultures = new Set();

    for (const entity of entities) {
      kinds.add(entity.kind);
      if (entity.culture) cultures.add(entity.culture);
    }

    return {
      kinds: Array.from(kinds).sort(),
      cultures: Array.from(cultures).sort(),
    };
  }, [entities]);

  // Get enrichment status for an entity
  const getStatus = useCallback(
    (entity, type) => {
      // Check queue first
      const queueItem = queue.find(
        (item) => item.entityId === entity.id && item.type === type
      );
      if (queueItem) {
        return queueItem.status;
      }

      // Check entity fields and enrichment
      if (type === 'description' && entity.summary && entity.description) return 'complete';
      if (type === 'image' && entity.enrichment?.image?.imageId) return 'complete';

      return 'missing';
    },
    [queue]
  );

  // Filter entities
  const filteredEntities = useMemo(() => {
    return entities.filter((entity) => {
      if (filters.kind !== 'all' && entity.kind !== filters.kind) return false;
      if (
        filters.prominence !== 'all' &&
        prominenceLabelFromScale(entity.prominence, effectiveProminenceScale) !== filters.prominence
      ) {
        return false;
      }
      if (filters.culture !== 'all' && entity.culture !== filters.culture) return false;

      const descStatus = getStatus(entity, 'description');
      const imgStatus = getStatus(entity, 'image');

      // Hide completed filter
      if (hideCompleted && descStatus === 'complete' && imgStatus === 'complete') {
        return false;
      }

      if (filters.status !== 'all') {
        if (filters.status === 'missing' && descStatus !== 'missing' && imgStatus !== 'missing') {
          return false;
        }
        if (filters.status === 'complete' && descStatus !== 'complete') {
          return false;
        }
        if (filters.status === 'queued' && descStatus !== 'queued' && imgStatus !== 'queued') {
          return false;
        }
        if (filters.status === 'running' && descStatus !== 'running' && imgStatus !== 'running') {
          return false;
        }
        if (filters.status === 'error' && descStatus !== 'error' && imgStatus !== 'error') {
          return false;
        }
      }

      // Chronicle image filter
      if (filters.chronicleImage !== 'all') {
        const backrefs = entity.enrichment?.chronicleBackrefs || [];
        if (filters.chronicleImage === 'none' && backrefs.length > 0) return false;
        if (filters.chronicleImage === 'unconfigured') {
          if (backrefs.length === 0) return false;
          if (!backrefs.some((b) => b.imageSource === undefined)) return false;
        }
        if (filters.chronicleImage === 'configured') {
          if (backrefs.length === 0) return false;
          if (backrefs.some((b) => b.imageSource === undefined)) return false;
        }
      }

      return true;
    });
  }, [entities, filters, hideCompleted, getStatus, effectiveProminenceScale]);

  // Toggle selection
  const toggleSelect = useCallback((entityId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entityId)) {
        next.delete(entityId);
      } else {
        next.add(entityId);
      }
      return next;
    });
  }, []);

  // Select all filtered
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredEntities.map((e) => e.id)));
  }, [filteredEntities]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Queue single item (with optional image overrides for image tasks)
  const queueItem = useCallback(
    (entity, type) => {
      const prompt = buildPrompt(entity, type);
      // For description tasks, pass visual config from template
      const visualConfig = type === 'description' && getVisualConfig ? getVisualConfig(entity) : {};
      // For image tasks, apply current global size/quality
      const imageOverrides = type === 'image'
        ? { imageSize: imageGenSettings.imageSize, imageQuality: imageGenSettings.imageQuality }
        : {};
      onEnqueue([{ entity, type, prompt, ...visualConfig, ...imageOverrides }]);
    },
    [onEnqueue, buildPrompt, getVisualConfig, imageGenSettings.imageSize, imageGenSettings.imageQuality]
  );

  // Cancel single item
  const cancelItem = useCallback(
    (entity, type) => {
      const queueItem = queue.find(
        (item) => item.entityId === entity.id && item.type === type
      );
      if (queueItem) {
        onCancel(queueItem.id);
      }
    },
    [queue, onCancel]
  );

  // Queue all missing descriptions for selected
  const queueSelectedDescriptions = useCallback(() => {
    const items = [];
    for (const entityId of selectedIds) {
      const entity = entities.find((e) => e.id === entityId);
      if (entity && getStatus(entity, 'description') === 'missing') {
        const visualConfig = getVisualConfig ? getVisualConfig(entity) : {};
        items.push({ entity, type: 'description', prompt: buildPrompt(entity, 'description'), ...visualConfig });
      }
    }
    if (items.length > 0) {
      onEnqueue(items);
    }
  }, [selectedIds, entities, getStatus, onEnqueue, buildPrompt, getVisualConfig]);

  // Queue all missing images for selected
  const queueSelectedImages = useCallback(() => {
    const items = [];
    for (const entityId of selectedIds) {
      const entity = entities.find((e) => e.id === entityId);
      if (
        entity &&
        prominenceAtLeast(entity.prominence, config.minProminenceForImage, effectiveProminenceScale) &&
        getStatus(entity, 'image') === 'missing' &&
        (!config.requireDescription || (entity.summary && entity.description))
      ) {
        items.push({
          entity,
          type: 'image',
          prompt: buildPrompt(entity, 'image'),
          imageSize: imageGenSettings.imageSize,
          imageQuality: imageGenSettings.imageQuality,
        });
      }
    }
    if (items.length > 0) {
      onEnqueue(items);
    }
  }, [
    selectedIds,
    entities,
    getStatus,
    onEnqueue,
    buildPrompt,
    config.minProminenceForImage,
    config.requireDescription,
    imageGenSettings.imageSize,
    imageGenSettings.imageQuality,
    effectiveProminenceScale,
  ]);

  // Regenerate all descriptions for selected (those with existing descriptions)
  const regenSelectedDescriptions = useCallback(() => {
    const items = [];
    for (const entityId of selectedIds) {
      const entity = entities.find((e) => e.id === entityId);
      if (entity && getStatus(entity, 'description') === 'complete') {
        const visualConfig = getVisualConfig ? getVisualConfig(entity) : {};
        items.push({ entity, type: 'description', prompt: buildPrompt(entity, 'description'), ...visualConfig });
      }
    }
    if (items.length > 0) {
      onEnqueue(items);
    }
  }, [selectedIds, entities, getStatus, onEnqueue, buildPrompt, getVisualConfig]);

  // Regenerate all images for selected (those with existing images)
  const regenSelectedImages = useCallback(() => {
    const items = [];
    for (const entityId of selectedIds) {
      const entity = entities.find((e) => e.id === entityId);
      if (
        entity &&
        prominenceAtLeast(entity.prominence, config.minProminenceForImage, effectiveProminenceScale) &&
        getStatus(entity, 'image') === 'complete'
      ) {
        items.push({
          entity,
          type: 'image',
          prompt: buildPrompt(entity, 'image'),
          imageSize: imageGenSettings.imageSize,
          imageQuality: imageGenSettings.imageQuality,
        });
      }
    }
    if (items.length > 0) {
      onEnqueue(items);
    }
  }, [
    selectedIds,
    entities,
    getStatus,
    onEnqueue,
    buildPrompt,
    config.minProminenceForImage,
    imageGenSettings.imageSize,
    imageGenSettings.imageQuality,
    effectiveProminenceScale,
  ]);

  // Quick action: queue all missing descriptions
  const queueAllMissingDescriptions = useCallback(() => {
    const items = [];
    for (const entity of filteredEntities) {
      if (getStatus(entity, 'description') === 'missing') {
        const visualConfig = getVisualConfig ? getVisualConfig(entity) : {};
        items.push({ entity, type: 'description', prompt: buildPrompt(entity, 'description'), ...visualConfig });
      }
    }
    if (items.length > 0) {
      onEnqueue(items);
    }
  }, [filteredEntities, getStatus, onEnqueue, buildPrompt, getVisualConfig]);

  // Quick action: queue all missing images (and dependent descriptions if required)
  const queueAllMissingImages = useCallback(() => {
    const items = [];
    for (const entity of filteredEntities) {
      if (
        prominenceAtLeast(entity.prominence, config.minProminenceForImage, effectiveProminenceScale) &&
        getStatus(entity, 'image') === 'missing'
      ) {
        // If requireDescription is enabled and entity lacks description, queue that first
        if (
          config.requireDescription &&
          !(entity.summary && entity.description) &&
          getStatus(entity, 'description') === 'missing'
        ) {
          const visualConfig = getVisualConfig ? getVisualConfig(entity) : {};
          items.push({ entity, type: 'description', prompt: buildPrompt(entity, 'description'), ...visualConfig });
        }
        items.push({
          entity,
          type: 'image',
          prompt: buildPrompt(entity, 'image'),
          imageSize: imageGenSettings.imageSize,
          imageQuality: imageGenSettings.imageQuality,
        });
      }
    }
    if (items.length > 0) {
      onEnqueue(items);
    }
  }, [
    filteredEntities,
    getStatus,
    onEnqueue,
    buildPrompt,
    getVisualConfig,
    config.minProminenceForImage,
    config.requireDescription,
    imageGenSettings.imageSize,
    imageGenSettings.imageQuality,
    effectiveProminenceScale,
  ]);

  // Count missing and calculate aggregate costs
  const { missingDescCount, missingDescCost } = useMemo(() => {
    let count = 0;
    let totalCost = 0;
    for (const entity of filteredEntities) {
      if (getStatus(entity, 'description') === 'missing') {
        count++;
        const prompt = buildPrompt(entity, 'description');
        const estimate = estimateTextCost(prompt, 'description', config.textModel);
        totalCost += estimate.estimatedCost;
      }
    }
    return { missingDescCount: count, missingDescCost: totalCost };
  }, [filteredEntities, getStatus, buildPrompt, config.textModel]);

  const { missingImgCount, missingImgCost, dependentDescCount } = useMemo(() => {
    let imgCount = 0;
    let descCount = 0;
    let totalCost = 0;
    const imgCostPerUnit = estimateImageCost(config.imageModel, imageGenSettings.imageSize, imageGenSettings.imageQuality);
    for (const entity of filteredEntities) {
      if (
        prominenceAtLeast(entity.prominence, config.minProminenceForImage, effectiveProminenceScale) &&
        getStatus(entity, 'image') === 'missing'
      ) {
        imgCount++;
        totalCost += imgCostPerUnit;
        // Count dependent descriptions that would be queued
        if (
          config.requireDescription &&
          !(entity.summary && entity.description) &&
          getStatus(entity, 'description') === 'missing'
        ) {
          descCount++;
          const prompt = buildPrompt(entity, 'description');
          const estimate = estimateTextCost(prompt, 'description', config.textModel);
          totalCost += estimate.estimatedCost;
        }
      }
    }
    return { missingImgCount: imgCount, missingImgCost: totalCost, dependentDescCount: descCount };
  }, [
    filteredEntities,
    getStatus,
    config.minProminenceForImage,
    config.imageModel,
    imageGenSettings.imageSize,
    imageGenSettings.imageQuality,
    config.requireDescription,
    config.textModel,
    buildPrompt,
    effectiveProminenceScale,
  ]);

  // Open image modal
  const openImageModal = useCallback((imageId, title) => {
    setImageModal({ open: true, imageId, title });
  }, []);

  // Open image picker for an entity
  const openImagePicker = useCallback((entity) => {
    setImagePickerEntity(entity);
  }, []);

  // Select entity for detail view
  const openEntityModal = useCallback((entity) => {
    setSelectedEntityId(entity.id);
  }, []);

  // Download debug info for selected entities
  const downloadSelectedDebug = useCallback(() => {
    const debugData = [];

    for (const entityId of selectedIds) {
      const entity = entities.find((e) => e.id === entityId);
      if (!entity) continue;

      const textEnrichment = entity.enrichment?.text;
      const timestamp = textEnrichment?.generatedAt;

      // Check for chain debug (3-step: narrative → thesis → traits)
      const chainDebug = textEnrichment?.chainDebug;

      // Fall back to legacy single debug
      let legacyDebug = textEnrichment?.debug;

      // Fall back to queue if no persisted debug
      if (!chainDebug && !legacyDebug) {
        const queueItem = queue.find(
          (item) => item.entityId === entity.id && item.type === 'description' && item.debug
        );
        if (queueItem?.debug) {
          legacyDebug = queueItem.debug;
        }
      }

      if (chainDebug || legacyDebug) {
        const entry = {
          entityId: entity.id,
          entityName: entity.name,
          entityKind: entity.kind,
          timestamp,
          model: textEnrichment?.model,
          // Include generated content for review (now on entity directly)
          summary: entity.summary,
          description: entity.description,
          visualThesis: textEnrichment?.visualThesis,
          visualTraits: textEnrichment?.visualTraits,
          aliases: textEnrichment?.aliases,
        };

        // Include chain debug if available (all 3 steps)
        if (chainDebug) {
          entry.chainDebug = chainDebug;
        }

        // Include legacy debug as fallback
        if (legacyDebug && !chainDebug) {
          entry.legacyDebug = legacyDebug;
        }

        debugData.push(entry);
      }
    }

    if (debugData.length === 0) {
      alert('No debug data available for selected entities.');
      return;
    }

    const json = JSON.stringify(debugData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `entity-debug-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [selectedIds, entities, queue]);

  // Handle image selection from picker
  const handleImageSelected = useCallback(
    (imageId, imageMetadata) => {
      if (imagePickerEntity && onAssignImage) {
        onAssignImage(imagePickerEntity.id, imageId, imageMetadata);
      }
      setImagePickerEntity(null);
    },
    [imagePickerEntity, onAssignImage]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Filters and Settings Card - fixed header */}
      <div className="illuminator-card" style={{ flexShrink: 0 }}>
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Entities</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {filteredEntities.length} of {entities.length} entities
          </span>
        </div>

        {/* Compact filters grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '8px',
            marginBottom: '12px',
          }}
        >
          <select
            value={filters.kind}
            onChange={(e) => setFilters((prev) => ({ ...prev, kind: e.target.value }))}
            className="illuminator-select"
          >
            <option value="all">All Kinds</option>
            {filterOptions.kinds.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>

          <select
            value={filters.prominence}
            onChange={(e) => setFilters((prev) => ({ ...prev, prominence: e.target.value }))}
            className="illuminator-select"
          >
            <option value="all">All Prominence</option>
            {PROMINENCE_ORDER.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            className="illuminator-select"
          >
            <option value="all">All Status</option>
            <option value="missing">Missing</option>
            <option value="complete">Complete</option>
            <option value="queued">Queued</option>
            <option value="running">Running</option>
            <option value="error">Error</option>
          </select>

          {filterOptions.cultures.length > 0 && (
            <select
              value={filters.culture}
              onChange={(e) => setFilters((prev) => ({ ...prev, culture: e.target.value }))}
              className="illuminator-select"
            >
              <option value="all">All Cultures</option>
              {filterOptions.cultures.map((culture) => (
                <option key={culture} value={culture}>
                  {culture}
                </option>
              ))}
            </select>
          )}

          <select
            value={filters.chronicleImage}
            onChange={(e) => setFilters((prev) => ({ ...prev, chronicleImage: e.target.value }))}
            className="illuminator-select"
          >
            <option value="all">Chronicle Img</option>
            <option value="none">No Backrefs</option>
            <option value="unconfigured">Unconfigured</option>
            <option value="configured">Configured</option>
          </select>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              padding: '6px 8px',
            }}
          >
            <input
              type="checkbox"
              checked={hideCompleted}
              onChange={(e) => setHideCompleted(e.target.checked)}
            />
            Hide completed
          </label>
        </div>

        {/* Enrichment Settings - inline */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '8px 12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '4px',
            marginBottom: '12px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Image threshold:</span>
          <select
            value={config.minProminenceForImage}
            onChange={(e) => onConfigChange({ minProminenceForImage: e.target.value })}
            className="illuminator-select"
            style={{ width: 'auto', minWidth: '100px' }}
          >
            {PROMINENCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}+
              </option>
            ))}
          </select>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Only entities at or above this prominence can have images generated
          </span>
        </div>

        {/* Image Settings Summary */}
        <ImageSettingsSummary
          settings={imageGenSettings}
          styleLibrary={styleLibrary}
          onOpenSettings={onOpenImageSettings}
        />

        {/* Min Event Significance for Descriptions */}
        <div style={{ marginBottom: '12px' }}>
          <label
            style={{
              display: 'block',
              marginBottom: '4px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
            }}
          >
            Min Event Importance (for descriptions)
          </label>
          <select
            value={config.minEventSignificance ?? 0.25}
            onChange={(e) => onConfigChange({ minEventSignificance: parseFloat(e.target.value) })}
            style={{
              width: '100%',
              padding: '6px 8px',
              borderRadius: '4px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '13px',
            }}
          >
            <option value={0}>All (&gt;0%)</option>
            <option value={0.25}>Low (&gt;25%)</option>
            <option value={0.5}>Medium (&gt;50%)</option>
            <option value={0.75}>High (&gt;75%)</option>
          </select>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
            Include events above this significance in description prompts
          </span>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={queueAllMissingDescriptions}
            className="illuminator-button illuminator-button-secondary"
            disabled={missingDescCount === 0}
          >
            Queue All Descriptions ({missingDescCount})
            {missingDescCount > 0 && (
              <span style={{ opacity: 0.7, marginLeft: '4px' }}>
                {formatEstimatedCost(missingDescCost)}
              </span>
            )}
          </button>
          <button
            onClick={queueAllMissingImages}
            className="illuminator-button illuminator-button-secondary"
            disabled={missingImgCount === 0}
          >
            {dependentDescCount > 0
              ? `Queue All Images + ${dependentDescCount} Desc (${missingImgCount})`
              : `Queue All Images (${missingImgCount})`}
            {missingImgCount > 0 && (
              <span style={{ opacity: 0.7, marginLeft: '4px' }}>
                {formatEstimatedCost(missingImgCost)}
              </span>
            )}
          </button>
          {onStartRevision && (
            <button
              onClick={onStartRevision}
              disabled={isRevising}
              className="illuminator-button illuminator-button-secondary"
            >
              {isRevising ? 'Revising...' : 'Revise Summaries'}
            </button>
          )}
        </div>
      </div>

      {/* Selection actions - fixed */}
      {selectedIds.size > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            marginBottom: '16px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--accent-color)',
            borderRadius: '6px',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '13px' }}>
            {selectedIds.size} selected
          </span>
          <button
            onClick={queueSelectedDescriptions}
            className="illuminator-button illuminator-button-secondary"
            style={{ padding: '6px 12px', fontSize: '12px' }}
            title="Queue missing descriptions"
          >
            Queue Desc
          </button>
          <button
            onClick={queueSelectedImages}
            className="illuminator-button illuminator-button-secondary"
            style={{ padding: '6px 12px', fontSize: '12px' }}
            title="Queue missing images"
          >
            Queue Img
          </button>
          <button
            onClick={regenSelectedDescriptions}
            className="illuminator-button illuminator-button-secondary"
            style={{ padding: '6px 12px', fontSize: '12px' }}
            title="Regenerate existing descriptions"
          >
            Regen Desc
          </button>
          <button
            onClick={regenSelectedImages}
            className="illuminator-button illuminator-button-secondary"
            style={{ padding: '6px 12px', fontSize: '12px' }}
            title="Regenerate existing images"
          >
            Regen Img
          </button>
          <button
            onClick={downloadSelectedDebug}
            className="illuminator-button illuminator-button-secondary"
            style={{ padding: '6px 12px', fontSize: '12px' }}
            title="Download debug request/response data for selected entities"
          >
            Download Debug
          </button>
          <button
            onClick={clearSelection}
            className="illuminator-button-link"
            style={{ marginLeft: 'auto' }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Entity detail view OR entity list */}
      {selectedEntityId && entities.find((e) => e.id === selectedEntityId) ? (
        <EntityDetailView
          entity={entities.find((e) => e.id === selectedEntityId)}
          entities={entities}
          queue={queue}
          onBack={() => setSelectedEntityId(null)}
          prominenceScale={effectiveProminenceScale}
          onUpdateBackrefs={onUpdateBackrefs}
          onUndoDescription={onUndoDescription}
          onCopyEdit={onCopyEdit}
          isCopyEditActive={isCopyEditActive}
          onHistorianReview={onHistorianReview}
          isHistorianActive={isHistorianActive}
          historianConfigured={historianConfigured}
          onUpdateHistorianNote={onUpdateHistorianNote}
          onRename={onRename}
          onPatchEvents={onPatchEvents}
        />
      ) : (
        <div className="illuminator-card" style={{ padding: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Header row - sticky */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 12px',
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-tertiary)',
              flexShrink: 0,
            }}
          >
            <input
              type="checkbox"
              checked={selectedIds.size === filteredEntities.length && filteredEntities.length > 0}
              onChange={(e) => (e.target.checked ? selectAll() : clearSelection())}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Select all
            </span>
          </div>

          {/* Entity rows - scrollable container */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {filteredEntities.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No entities match the current filters.
              </div>
            ) : (
              filteredEntities.map((entity) => {
                const descStatus = getStatus(entity, 'description');
                const imgStatus = getStatus(entity, 'image');
                const enrichment = entity.enrichment || {};
                return (
                  <EntityRow
                    key={entity.id}
                    entity={entity}
                    descStatus={descStatus}
                    imgStatus={imgStatus}
                    selected={selectedIds.has(entity.id)}
                    onToggleSelect={() => toggleSelect(entity.id)}
                    onQueueDesc={() => queueItem(entity, 'description')}
                    onQueueImg={() => queueItem(entity, 'image')}
                    onCancelDesc={() => cancelItem(entity, 'description')}
                    onCancelImg={() => cancelItem(entity, 'image')}
                    onAssignImage={() => openImagePicker(entity)}
                    canQueueImage={
                      prominenceAtLeast(entity.prominence, config.minProminenceForImage, effectiveProminenceScale) &&
                      (!config.requireDescription ||
                        (entity.summary && entity.description))
                    }
                    needsDescription={
                      prominenceAtLeast(entity.prominence, config.minProminenceForImage, effectiveProminenceScale) &&
                      config.requireDescription &&
                      !(entity.summary && entity.description)
                    }
                    onImageClick={openImageModal}
                    onEntityClick={() => openEntityModal(entity)}
                    descCost={getEntityCostDisplay(entity, 'description', descStatus, config, enrichment, buildPrompt)}
                    imgCost={getEntityCostDisplay(entity, 'image', imgStatus, config, enrichment, buildPrompt)}
                    prominenceScale={effectiveProminenceScale}
                  />
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Image Modal */}
      <ImageModal
        isOpen={imageModal.open}
        imageId={imageModal.imageId}
        title={imageModal.title}
        onClose={() => setImageModal({ open: false, imageId: '', title: '' })}
      />

      {/* Image Picker Modal */}
      <ImagePickerModal
        isOpen={!!imagePickerEntity}
        onClose={() => setImagePickerEntity(null)}
        onSelect={handleImageSelected}
        entityKind={imagePickerEntity?.kind}
        entityCulture={imagePickerEntity?.culture}
        currentImageId={imagePickerEntity?.enrichment?.image?.imageId}
      />
    </div>
  );
}
