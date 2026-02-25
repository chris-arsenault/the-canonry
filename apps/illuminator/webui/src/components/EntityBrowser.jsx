/**
 * EntityBrowser - Primary entity-centric view
 *
 * Shows all entities with their enrichment status.
 * Allows filtering, selection, and queueing enrichment tasks.
 * Includes enrichment settings (moved from ConfigPanel).
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import { useEntityNavList } from "../lib/db/entitySelectors";
import { useEntityStore } from "../lib/db/entityStore";
import { useProminenceScale } from "../lib/db/indexSelectors";
import { useEntityCrud, reloadEntities } from "../hooks/useEntityCrud";
import { useHistorianActions } from "../hooks/useHistorianActions";
import { convertLongEditionsToLegacy } from "../lib/db/entityRepository";
import { useIlluminatorModals } from "../lib/db/modalStore";
import { getEnqueue, getCancel } from "../lib/db/enrichmentQueueBridge";
import { useEnrichmentQueueStore } from "../lib/db/enrichmentQueueStore";
import DescriptionMotifWeaver from "./DescriptionMotifWeaver";
import ImageModal from "./ImageModal";
import ImagePickerModal from "./ImagePickerModal";
import EntityDetailView from "./EntityDetailView";
import { ImageSettingsSummary } from "./ImageSettingsDrawer";
import { useImageUrl } from "../hooks/useImageUrl";
import { formatCost } from "../lib/costEstimation";
import { prominenceLabelFromScale, prominenceThresholdFromScale } from "@canonry/world-schema";
import "./EntityBrowser.css";
// imageSettings imports removed - size/quality now in ImageSettingsDrawer

// Highlight matching substring within text for search results
function HighlightMatch({ text, query, truncate = 0, matchIndex }) {
  if (!query || !text) return text;
  const idx = matchIndex != null ? matchIndex : text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1)
    return truncate > 0 && text.length > truncate ? text.slice(0, truncate) + "\u2026" : text;

  let displayText = text;
  let displayIdx = idx;

  // For long text (summaries), show a window around the match
  if (truncate > 0 && text.length > truncate) {
    const contextRadius = Math.floor(truncate / 2);
    const winStart = Math.max(0, idx - contextRadius);
    const winEnd = Math.min(text.length, idx + query.length + contextRadius);
    displayText =
      (winStart > 0 ? "\u2026" : "") +
      text.slice(winStart, winEnd) +
      (winEnd < text.length ? "\u2026" : "");
    displayIdx = idx - winStart + (winStart > 0 ? 1 : 0);
  }

  const before = displayText.slice(0, displayIdx);
  const match = displayText.slice(displayIdx, displayIdx + query.length);
  const after = displayText.slice(displayIdx + query.length);

  return (
    <>
      {before}
      <span className="eb-highlight">{match}</span>
      {after}
    </>
  );
}

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
      { threshold: 0.1 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Only activate the hook once visible (pass null to skip loading)
  const { url, loading, error } = useImageUrl(visible ? imageId : null);

  const placeholder = (text, title) => (
    <div ref={containerRef} className="eb-thumb" title={title}>
      {text}
    </div>
  );

  if (!visible || loading) return placeholder("Loading...");
  if (error || !url) return placeholder("No image", error || "Image not found");

  return (
    <div ref={containerRef} className="eb-thumb-clickable" onClick={() => onClick(imageId, alt)}>
      <img src={url} alt={alt} className="eb-thumb-img" />
    </div>
  );
}

const PROMINENCE_ORDER = ["mythic", "renowned", "recognized", "marginal", "forgotten"];

const PROMINENCE_OPTIONS = [
  { value: "mythic", label: "Mythic" },
  { value: "renowned", label: "Renowned" },
  { value: "recognized", label: "Recognized" },
  { value: "marginal", label: "Marginal" },
  { value: "forgotten", label: "Forgotten" },
];

function prominenceAtLeast(prominence, minProminence, scale) {
  if (typeof prominence === "number" && Number.isFinite(prominence)) {
    return prominence >= prominenceThresholdFromScale(minProminence, scale);
  }
  if (typeof prominence === "string") {
    const prominenceIndex = scale.labels.indexOf(prominence);
    const minIndex = scale.labels.indexOf(minProminence);
    return prominenceIndex >= 0 && minIndex >= 0 && prominenceIndex >= minIndex;
  }
  return false;
}

function EnrichmentStatusBadge({ status, label, cost }) {
  const icons = {
    missing: "○",
    queued: "◷",
    running: "◐",
    complete: "✓",
    error: "✗",
    disabled: "─",
  };

  return (
    <span className={`eb-badge eb-badge--${status}`}>
      <span>{icons[status]}</span>
      <span>{label}</span>
      {cost !== undefined && <span className="eb-badge-cost">{cost}</span>}
    </span>
  );
}

function EntityRow({
  entity,
  descStatus,
  imgStatus,
  thesisStatus,
  selected,
  onToggleSelect,
  onQueueDesc,
  onQueueThesis,
  onQueueImg,
  onCancelDesc,
  onCancelThesis,
  onCancelImg,
  onAssignImage,
  canQueueImage,
  needsDescription,
  onImageClick,
  onEntityClick,
  onEditEntity,
  onDeleteEntity,
  descCost,
  imgCost,
  prominenceScale,
}) {
  return (
    <div className="eb-row">
      {/* Checkbox */}
      <div className="eb-row-checkbox">
        <input type="checkbox" checked={selected} onChange={onToggleSelect} />
      </div>

      {/* Entity info */}
      <div>
        <div className="eb-row-name" onClick={onEntityClick} title="Click to view entity details">
          {entity.name}
        </div>
        <div className="eb-row-meta">
          <span>
            {entity.kind}/{entity.subtype} ·{" "}
            {prominenceLabelFromScale(entity.prominence, prominenceScale)}
            {entity.culture && ` · ${entity.culture}`}
          </span>
          {entity.historianEditionCount > 0 && (
            <span
              title={`${entity.historianEditionCount} historian edition${entity.historianEditionCount !== 1 ? "s" : ""}`}
              className={
                entity.historianEditionCount >= 2
                  ? "eb-row-edition-count eb-row-edition-count-many"
                  : "eb-row-edition-count eb-row-edition-count-few"
              }
            >
              {"\u270E"}
              {entity.historianEditionCount}
            </span>
          )}
          {onEditEntity && entity.isManual && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditEntity(entity);
              }}
              className="illuminator-button illuminator-button-secondary eb-row-btn-sm"
              title="Edit entity attributes"
            >
              Edit
            </button>
          )}
          {onDeleteEntity && entity.isManual && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteEntity(entity);
              }}
              className="illuminator-button illuminator-button-secondary eb-row-btn-sm eb-row-btn-sm-danger"
              title="Delete this manually-created entity"
            >
              Delete
            </button>
          )}
        </div>

        {/* Content row: description and image side by side */}
        <div className="eb-row-content">
          {/* Description preview if exists */}
          {entity.summary && (
            <div
              className="eb-row-summary"
              onClick={onEntityClick}
              title="Click to view entity details"
            >
              {entity.summary}
            </div>
          )}

          {/* Image preview if exists */}
          {entity.imageId && (
            <ImageThumbnail imageId={entity.imageId} alt={entity.name} onClick={onImageClick} />
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="eb-row-actions">
        {/* Description status and action */}
        <div className="eb-row-action-group">
          <EnrichmentStatusBadge status={descStatus} label="Desc" cost={descCost} />
          {descStatus === "missing" && (
            <button
              onClick={onQueueDesc}
              className="illuminator-button illuminator-button-secondary eb-row-action-btn"
            >
              Queue
            </button>
          )}
          {(descStatus === "queued" || descStatus === "running") && (
            <button
              onClick={onCancelDesc}
              className="illuminator-button illuminator-button-secondary eb-row-action-btn"
            >
              Cancel
            </button>
          )}
          {descStatus === "error" && (
            <button
              onClick={onQueueDesc}
              className="illuminator-button illuminator-button-secondary eb-row-action-btn"
            >
              Retry
            </button>
          )}
          {descStatus === "complete" && (
            <button
              onClick={onQueueDesc}
              className="illuminator-button illuminator-button-secondary eb-row-action-btn"
              title="Regenerate description"
            >
              Regen
            </button>
          )}
        </div>

        {/* Visual thesis status and action — only show when description exists */}
        {descStatus === "complete" && (
          <div className="eb-row-action-group">
            <EnrichmentStatusBadge status={thesisStatus} label="Thesis" />
            {(thesisStatus === "missing" || thesisStatus === "complete") && (
              <button
                onClick={onQueueThesis}
                className="illuminator-button illuminator-button-secondary eb-row-action-btn"
                title={
                  thesisStatus === "complete"
                    ? "Regenerate visual thesis & traits"
                    : "Generate visual thesis & traits"
                }
              >
                {thesisStatus === "complete" ? "Regen" : "Queue"}
              </button>
            )}
            {(thesisStatus === "queued" || thesisStatus === "running") && (
              <button
                onClick={onCancelThesis}
                className="illuminator-button illuminator-button-secondary eb-row-action-btn"
              >
                Cancel
              </button>
            )}
            {thesisStatus === "error" && (
              <button
                onClick={onQueueThesis}
                className="illuminator-button illuminator-button-secondary eb-row-action-btn"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* Image status and action */}
        <div className="eb-row-action-group eb-row-action-group-wrap">
          <EnrichmentStatusBadge
            status={canQueueImage ? imgStatus : "disabled"}
            label="Image"
            cost={canQueueImage ? imgCost : undefined}
          />
          {needsDescription && <span className="eb-row-needs-desc">Needs desc first</span>}
          {canQueueImage && imgStatus === "missing" && (
            <>
              <button
                onClick={onQueueImg}
                className="illuminator-button illuminator-button-secondary eb-row-action-btn"
              >
                Queue
              </button>
              <button
                onClick={onAssignImage}
                className="illuminator-button illuminator-button-secondary eb-row-action-btn"
                title="Assign existing image from library"
              >
                Assign
              </button>
            </>
          )}
          {canQueueImage && (imgStatus === "queued" || imgStatus === "running") && (
            <button
              onClick={onCancelImg}
              className="illuminator-button illuminator-button-secondary eb-row-action-btn"
            >
              Cancel
            </button>
          )}
          {canQueueImage && imgStatus === "error" && (
            <>
              <button
                onClick={onQueueImg}
                className="illuminator-button illuminator-button-secondary eb-row-action-btn"
              >
                Retry
              </button>
              <button
                onClick={onAssignImage}
                className="illuminator-button illuminator-button-secondary eb-row-action-btn"
                title="Assign existing image from library"
              >
                Assign
              </button>
            </>
          )}
          {canQueueImage && imgStatus === "complete" && (
            <>
              <button
                onClick={onQueueImg}
                className="illuminator-button illuminator-button-secondary eb-row-action-btn"
                title="Regenerate image"
              >
                Regen
              </button>
              <button
                onClick={onAssignImage}
                className="illuminator-button illuminator-button-secondary eb-row-action-btn"
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

// Helper to get cost display for a nav item
function getNavItemCostDisplay(navItem, type, status) {
  if (status !== "complete") return undefined;
  if (type === "description" && navItem.descriptionCost) {
    return formatCost(navItem.descriptionCost);
  }
  if (type === "image" && navItem.imageCost) {
    return formatCost(navItem.imageCost);
  }
  return undefined;
}

export default function EntityBrowser({
  worldSchema,
  config,
  onConfigChange,
  buildPrompt,
  getVisualConfig,
  styleLibrary,
  imageGenSettings,
  onStartRevision,
  isRevising,
  onBulkHistorianReview,
  onBulkHistorianEdition,
  onBulkHistorianClear,
  isBulkHistorianActive,
  onNavigateToTab,
}) {
  const navEntities = useEntityNavList();
  const { handleAssignImage, handleDeleteEntity, handleClearNotes } = useEntityCrud();
  const { historianConfigured } = useHistorianActions();
  const { openRename, openPatchEvents, openCreateEntity, openEditEntity, openImageSettings } =
    useIlluminatorModals();
  const queue = useEnrichmentQueueStore((s) => s.queue);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState(false);
  const searchInputRef = useRef(null);
  const [filters, setFilters] = useState({
    kind: "all",
    prominence: "all",
    status: "all",
    culture: "all",
    chronicleImage: "all",
  });
  const prominenceScale = useProminenceScale();
  const [hideCompleted, setHideCompleted] = useState(false);
  const [imageModal, setImageModal] = useState({ open: false, imageId: "", title: "" });
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [imagePickerEntity, setImagePickerEntity] = useState(null);
  const [showMotifWeaver, setShowMotifWeaver] = useState(false);
  const imageModel = config.imageModel || "dall-e-3";

  // Get unique values for filters
  const filterOptions = useMemo(() => {
    const kinds = new Set();
    const cultures = new Set();

    for (const entity of navEntities) {
      kinds.add(entity.kind);
      if (entity.culture) cultures.add(entity.culture);
    }

    return {
      kinds: Array.from(kinds).sort(),
      cultures: Array.from(cultures).sort(),
    };
  }, [navEntities]);

  // Entity search — partial match on name, aliases, and optionally summary text
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    const results = [];
    for (const entity of navEntities) {
      const matches = [];
      // Name match
      const nameIdx = entity.name.toLowerCase().indexOf(q);
      if (nameIdx !== -1) {
        matches.push({ field: "name", value: entity.name, matchIndex: nameIdx });
      }
      // Alias matches
      for (const alias of entity.aliases) {
        if (typeof alias !== "string") continue;
        const aliasIdx = alias.toLowerCase().indexOf(q);
        if (aliasIdx !== -1) {
          matches.push({ field: "alias", value: alias, matchIndex: aliasIdx });
        }
      }
      // Slug alias matches
      for (const slug of entity.slugAliases) {
        if (typeof slug !== "string") continue;
        const slugIdx = slug.toLowerCase().indexOf(q);
        if (slugIdx !== -1) {
          matches.push({ field: "slug alias", value: slug, matchIndex: slugIdx });
        }
      }
      // Summary text matches (only when searchText enabled)
      if (searchText && entity.summary) {
        const sumIdx = entity.summary.toLowerCase().indexOf(q);
        if (sumIdx !== -1) {
          matches.push({ field: "summary", value: entity.summary, matchIndex: sumIdx });
        }
      }
      if (matches.length > 0) {
        results.push({ entity, matches });
      }
    }
    // Sort: name matches first, then by name alphabetically
    results.sort((a, b) => {
      const aHasName = a.matches.some((m) => m.field === "name") ? 0 : 1;
      const bHasName = b.matches.some((m) => m.field === "name") ? 0 : 1;
      if (aHasName !== bHasName) return aHasName - bHasName;
      return a.entity.name.localeCompare(b.entity.name);
    });
    return results;
  }, [navEntities, searchQuery, searchText]);

  const handleSearchSelect = useCallback((entityId) => {
    setSelectedEntityId(entityId);
    setSearchOpen(false);
    setSearchQuery("");
  }, []);

  // Get enrichment status for a nav item
  const getStatus = useCallback(
    (nav, type) => {
      // Check queue first
      const queueItem = queue.find((item) => item.entityId === nav.id && item.type === type);
      if (queueItem) {
        return queueItem.status;
      }

      // Check nav item flags
      if (type === "description" && nav.hasDescription) return "complete";
      if (type === "visualThesis" && nav.hasVisualThesis) return "complete";
      if (type === "image" && nav.imageId) return "complete";

      return "missing";
    },
    [queue]
  );

  // Filter entities via nav items
  const filteredNavItems = useMemo(() => {
    return navEntities.filter((nav) => {
      if (filters.kind !== "all" && nav.kind !== filters.kind) return false;
      if (
        filters.prominence !== "all" &&
        prominenceLabelFromScale(nav.prominence, prominenceScale) !== filters.prominence
      ) {
        return false;
      }
      if (filters.culture !== "all" && nav.culture !== filters.culture) return false;

      const descStatus = getStatus(nav, "description");
      const imgStatus = getStatus(nav, "image");

      // Hide completed filter
      if (hideCompleted && descStatus === "complete" && imgStatus === "complete") {
        return false;
      }

      if (filters.status !== "all") {
        if (filters.status === "missing" && descStatus !== "missing" && imgStatus !== "missing") {
          return false;
        }
        if (filters.status === "complete" && descStatus !== "complete") {
          return false;
        }
        if (filters.status === "queued" && descStatus !== "queued" && imgStatus !== "queued") {
          return false;
        }
        if (filters.status === "running" && descStatus !== "running" && imgStatus !== "running") {
          return false;
        }
        if (filters.status === "error" && descStatus !== "error" && imgStatus !== "error") {
          return false;
        }
      }

      // Chronicle image filter
      if (filters.chronicleImage !== "all") {
        if (filters.chronicleImage === "none" && nav.backrefCount > 0) return false;
        if (filters.chronicleImage === "unconfigured") {
          if (nav.backrefCount === 0) return false;
          if (nav.unconfiguredBackrefCount === 0) return false;
        }
        if (filters.chronicleImage === "configured") {
          if (nav.backrefCount === 0) return false;
          if (nav.unconfiguredBackrefCount > 0) return false;
        }
      }

      return true;
    });
  }, [navEntities, filters, hideCompleted, getStatus, prominenceScale]);

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
    setSelectedIds(new Set(filteredNavItems.map((e) => e.id)));
  }, [filteredNavItems]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Queue single item — load full entity from store for prompt building
  const queueItem = useCallback(
    async (entityId, type) => {
      const entity = await useEntityStore.getState().loadEntity(entityId);
      if (!entity) return;
      const prompt = buildPrompt(entity, type === "visualThesis" ? "description" : type);
      const visualConfig =
        (type === "description" || type === "visualThesis") && getVisualConfig
          ? getVisualConfig(entity)
          : {};
      const imageOverrides =
        type === "image"
          ? { imageSize: imageGenSettings.imageSize, imageQuality: imageGenSettings.imageQuality }
          : {};
      getEnqueue()([{ entity, type, prompt, ...visualConfig, ...imageOverrides }]);
    },
    [buildPrompt, getVisualConfig, imageGenSettings.imageSize, imageGenSettings.imageQuality]
  );

  // Cancel single item
  const cancelItem = useCallback(
    (entityId, type) => {
      const queueItem = queue.find((item) => item.entityId === entityId && item.type === type);
      if (queueItem) {
        getCancel()(queueItem.id);
      }
    },
    [queue]
  );

  // Queue all missing descriptions for selected — filter on nav items, load full for prompt
  const queueSelectedDescriptions = useCallback(async () => {
    const missingIds = [];
    for (const entityId of selectedIds) {
      const nav = navEntities.find((e) => e.id === entityId);
      if (nav && getStatus(nav, "description") === "missing") {
        missingIds.push(entityId);
      }
    }
    if (missingIds.length === 0) return;
    const fullEntities = await useEntityStore.getState().loadEntities(missingIds);
    const items = fullEntities.map((entity) => {
      const visualConfig = getVisualConfig ? getVisualConfig(entity) : {};
      return {
        entity,
        type: "description",
        prompt: buildPrompt(entity, "description"),
        ...visualConfig,
      };
    });
    if (items.length > 0) getEnqueue()(items);
  }, [selectedIds, navEntities, getStatus, buildPrompt, getVisualConfig]);

  // Queue all missing images for selected
  const queueSelectedImages = useCallback(async () => {
    const eligibleIds = [];
    for (const entityId of selectedIds) {
      const nav = navEntities.find((e) => e.id === entityId);
      if (
        nav &&
        prominenceAtLeast(nav.prominence, config.minProminenceForImage, prominenceScale) &&
        getStatus(nav, "image") === "missing" &&
        (!config.requireDescription || nav.hasDescription)
      ) {
        eligibleIds.push(entityId);
      }
    }
    if (eligibleIds.length === 0) return;
    const fullEntities = await useEntityStore.getState().loadEntities(eligibleIds);
    const items = fullEntities.map((entity) => ({
      entity,
      type: "image",
      prompt: buildPrompt(entity, "image"),
      imageSize: imageGenSettings.imageSize,
      imageQuality: imageGenSettings.imageQuality,
    }));
    if (items.length > 0) getEnqueue()(items);
  }, [
    selectedIds,
    navEntities,
    getStatus,
    buildPrompt,
    config.minProminenceForImage,
    config.requireDescription,
    imageGenSettings.imageSize,
    imageGenSettings.imageQuality,
    prominenceScale,
  ]);

  // Regenerate all descriptions for selected
  const regenSelectedDescriptions = useCallback(async () => {
    const completeIds = [];
    for (const entityId of selectedIds) {
      const nav = navEntities.find((e) => e.id === entityId);
      if (nav && getStatus(nav, "description") === "complete") {
        completeIds.push(entityId);
      }
    }
    if (completeIds.length === 0) return;
    const fullEntities = await useEntityStore.getState().loadEntities(completeIds);
    const items = fullEntities.map((entity) => {
      const visualConfig = getVisualConfig ? getVisualConfig(entity) : {};
      return {
        entity,
        type: "description",
        prompt: buildPrompt(entity, "description"),
        ...visualConfig,
      };
    });
    if (items.length > 0) getEnqueue()(items);
  }, [selectedIds, navEntities, getStatus, buildPrompt, getVisualConfig]);

  // Regenerate all images for selected
  const regenSelectedImages = useCallback(async () => {
    const completeIds = [];
    for (const entityId of selectedIds) {
      const nav = navEntities.find((e) => e.id === entityId);
      if (
        nav &&
        prominenceAtLeast(nav.prominence, config.minProminenceForImage, prominenceScale) &&
        getStatus(nav, "image") === "complete"
      ) {
        completeIds.push(entityId);
      }
    }
    if (completeIds.length === 0) return;
    const fullEntities = await useEntityStore.getState().loadEntities(completeIds);
    const items = fullEntities.map((entity) => ({
      entity,
      type: "image",
      prompt: buildPrompt(entity, "image"),
      imageSize: imageGenSettings.imageSize,
      imageQuality: imageGenSettings.imageQuality,
    }));
    if (items.length > 0) getEnqueue()(items);
  }, [
    selectedIds,
    navEntities,
    getStatus,
    buildPrompt,
    config.minProminenceForImage,
    imageGenSettings.imageSize,
    imageGenSettings.imageQuality,
    prominenceScale,
  ]);

  // Quick action: queue all missing descriptions — filter on nav, load full for prompt
  const queueAllMissingDescriptions = useCallback(async () => {
    const missingIds = filteredNavItems
      .filter((nav) => getStatus(nav, "description") === "missing")
      .map((nav) => nav.id);
    if (missingIds.length === 0) return;
    const fullEntities = await useEntityStore.getState().loadEntities(missingIds);
    const items = fullEntities.map((entity) => {
      const visualConfig = getVisualConfig ? getVisualConfig(entity) : {};
      return {
        entity,
        type: "description",
        prompt: buildPrompt(entity, "description"),
        ...visualConfig,
      };
    });
    if (items.length > 0) getEnqueue()(items);
  }, [filteredNavItems, getStatus, buildPrompt, getVisualConfig]);

  // Quick action: queue all missing images (and dependent descriptions if required)
  const queueAllMissingImages = useCallback(async () => {
    const eligibleNavs = filteredNavItems.filter(
      (nav) =>
        prominenceAtLeast(nav.prominence, config.minProminenceForImage, prominenceScale) &&
        getStatus(nav, "image") === "missing"
    );
    if (eligibleNavs.length === 0) return;
    const fullEntities = await useEntityStore
      .getState()
      .loadEntities(eligibleNavs.map((n) => n.id));
    const entityMap = new Map(fullEntities.map((e) => [e.id, e]));
    const items = [];
    for (const nav of eligibleNavs) {
      const entity = entityMap.get(nav.id);
      if (!entity) continue;
      if (
        config.requireDescription &&
        !nav.hasDescription &&
        getStatus(nav, "description") === "missing"
      ) {
        const visualConfig = getVisualConfig ? getVisualConfig(entity) : {};
        items.push({
          entity,
          type: "description",
          prompt: buildPrompt(entity, "description"),
          ...visualConfig,
        });
      }
      items.push({
        entity,
        type: "image",
        prompt: buildPrompt(entity, "image"),
        imageSize: imageGenSettings.imageSize,
        imageQuality: imageGenSettings.imageQuality,
      });
    }
    if (items.length > 0) getEnqueue()(items);
  }, [
    filteredNavItems,
    getStatus,
    buildPrompt,
    getVisualConfig,
    config.minProminenceForImage,
    config.requireDescription,
    imageGenSettings.imageSize,
    imageGenSettings.imageQuality,
    prominenceScale,
  ]);

  // Count missing entities (cost estimation deferred to queue time for nav-only rendering)
  const { missingDescCount, missingImgCount, dependentDescCount } = useMemo(() => {
    let descCount = 0;
    let imgCount = 0;
    let depDescCount = 0;
    for (const nav of filteredNavItems) {
      if (getStatus(nav, "description") === "missing") descCount++;
      if (
        prominenceAtLeast(nav.prominence, config.minProminenceForImage, prominenceScale) &&
        getStatus(nav, "image") === "missing"
      ) {
        imgCount++;
        if (
          config.requireDescription &&
          !nav.hasDescription &&
          getStatus(nav, "description") === "missing"
        ) {
          depDescCount++;
        }
      }
    }
    return {
      missingDescCount: descCount,
      missingImgCount: imgCount,
      dependentDescCount: depDescCount,
    };
  }, [
    filteredNavItems,
    getStatus,
    config.minProminenceForImage,
    config.requireDescription,
    prominenceScale,
  ]);

  // Count entities eligible for bulk historian operations
  const annotationEligibleCount = useMemo(
    () => filteredNavItems.filter((nav) => nav.hasDescription && !nav.hasHistorianNotes).length,
    [filteredNavItems]
  );

  const copyEditEligibleCount = useMemo(
    () => filteredNavItems.filter((nav) => nav.hasDescription && !nav.hasHistorianEdition).length,
    [filteredNavItems]
  );

  const reEditionEligibleCount = useMemo(
    () => filteredNavItems.filter((nav) => nav.hasDescription && nav.hasHistorianEdition).length,
    [filteredNavItems]
  );

  const legacyConvertEligibleCount = useMemo(
    () => filteredNavItems.filter((nav) => nav.hasHistorianEdition).length,
    [filteredNavItems]
  );

  const annotatedCount = useMemo(
    () => filteredNavItems.filter((nav) => nav.hasHistorianNotes).length,
    [filteredNavItems]
  );

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

  // Download debug info for selected entities — load full entities from store
  const downloadSelectedDebug = useCallback(async () => {
    const ids = Array.from(selectedIds);
    const fullEntities = await useEntityStore.getState().loadEntities(ids);
    const debugData = [];

    for (const entity of fullEntities) {
      const textEnrichment = entity.enrichment?.text;
      const timestamp = textEnrichment?.generatedAt;

      const chainDebug = textEnrichment?.chainDebug;
      let legacyDebug = textEnrichment?.debug;

      if (!chainDebug && !legacyDebug) {
        const qItem = queue.find(
          (item) => item.entityId === entity.id && item.type === "description" && item.debug
        );
        if (qItem?.debug) {
          legacyDebug = qItem.debug;
        }
      }

      if (chainDebug || legacyDebug) {
        const entry = {
          entityId: entity.id,
          entityName: entity.name,
          entityKind: entity.kind,
          timestamp,
          model: textEnrichment?.model,
          summary: entity.summary,
          description: entity.description,
          visualThesis: textEnrichment?.visualThesis,
          visualTraits: textEnrichment?.visualTraits,
          aliases: textEnrichment?.aliases,
        };
        if (chainDebug) entry.chainDebug = chainDebug;
        if (legacyDebug && !chainDebug) entry.legacyDebug = legacyDebug;
        debugData.push(entry);
      }
    }

    if (debugData.length === 0) {
      alert("No debug data available for selected entities.");
      return;
    }

    const json = JSON.stringify(debugData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `entity-debug-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [selectedIds, queue]);

  // Download edition comparison data (pre-historian / legacy / active + annotations) for selected entities
  const downloadSelectedEditions = useCallback(async () => {
    const ids = Array.from(selectedIds);
    const fullEntities = await useEntityStore.getState().loadEntities(ids);
    const editionSources = new Set(["historian-edition", "legacy-copy-edit"]);
    const exportEntries = [];

    for (const entity of fullEntities) {
      const history = entity.enrichment?.descriptionHistory;
      if (!history || !entity.description) continue;

      const historianEntries = history
        .map((entry, index) => ({ ...entry, historyIndex: index }))
        .filter((entry) => editionSources.has(entry.source || ""));

      if (historianEntries.length === 0) continue;

      const entry = {
        entityId: entity.id,
        entityName: entity.name,
        entityKind: entity.kind,
        prominence: entity.prominence,
        updatedAt: entity.updatedAt,
        preHistorian: historianEntries[0].description,
        legacyCopyEdit:
          historianEntries.length > 1
            ? historianEntries[historianEntries.length - 1].description
            : null,
        active: entity.description,
      };

      const activeNotes = entity.enrichment?.historianNotes?.filter(
        (n) => n.display !== "disabled"
      );
      if (activeNotes && activeNotes.length > 0) {
        entry.annotations = activeNotes.map((n) => ({
          type: n.type,
          display: n.display || "full",
          anchorPhrase: n.anchorPhrase,
          text: n.text,
        }));
      }

      exportEntries.push(entry);
    }

    if (exportEntries.length === 0) {
      alert("No edition history available for selected entities.");
      return;
    }

    const json = JSON.stringify(exportEntries, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `edition-export-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [selectedIds]);

  // Download annotation review data for selected entities
  const downloadSelectedAnnotations = useCallback(async () => {
    const ids = Array.from(selectedIds);
    const fullEntities = await useEntityStore.getState().loadEntities(ids);
    const rows = [];

    for (const entity of fullEntities) {
      const activeNotes = entity.enrichment?.historianNotes?.filter(
        (n) => n.display !== "disabled"
      );
      if (!activeNotes || activeNotes.length === 0) continue;

      rows.push({
        entityName: entity.name,
        entityKind: entity.kind,
        entitySubtype: entity.subtype || null,
        prominence: prominenceLabelFromScale(entity.prominence, prominenceScale),
        noteCount: activeNotes.length,
        annotations: activeNotes.map((n) => ({
          type: n.type,
          display: n.display || "full",
          anchorPhrase: n.anchorPhrase,
          text: n.text,
        })),
      });
    }

    if (rows.length === 0) {
      alert("No annotations found for selected entities.");
      return;
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      totalEntities: rows.length,
      totalAnnotations: rows.reduce((sum, r) => sum + r.noteCount, 0),
      entities: rows,
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `entity-annotation-review-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [selectedIds, prominenceScale]);

  // Handle image selection from picker
  const handleImageSelected = useCallback(
    (imageId, imageMetadata) => {
      if (imagePickerEntity) {
        handleAssignImage(imagePickerEntity.id, imageId, imageMetadata);
      }
      setImagePickerEntity(null);
    },
    [imagePickerEntity, handleAssignImage]
  );

  // Load full entity for detail view (on demand from bounded cache)
  // Subscribe to store cache so updates (e.g. historian note display toggle) propagate reactively
  const cachedEntity = useEntityStore((s) =>
    selectedEntityId ? s.cache.get(selectedEntityId) : undefined
  );
  const [selectedEntity, setSelectedEntity] = useState(null);
  useEffect(() => {
    if (selectedEntityId) {
      // If already in cache (from subscription), use it directly; otherwise load from Dexie
      if (cachedEntity) {
        setSelectedEntity(cachedEntity);
      } else {
        useEntityStore.getState().loadEntity(selectedEntityId).then(setSelectedEntity);
      }
    } else {
      setSelectedEntity(null);
    }
  }, [selectedEntityId, cachedEntity]);

  // Handle edit — load full entity from store before opening edit modal
  const handleEditEntity = useCallback(
    async (navItem) => {
      const fullEntity = await useEntityStore.getState().loadEntity(navItem.id);
      if (fullEntity) openEditEntity(fullEntity);
    },
    [openEditEntity]
  );

  // Progressive rendering — only render visible rows, load more on scroll
  const ENTITY_PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(ENTITY_PAGE_SIZE);
  const entityListRef = useRef(null);

  // Reset visible count when filters/search change
  useEffect(() => {
    setVisibleCount(ENTITY_PAGE_SIZE);
  }, [filters, hideCompleted, searchQuery]);

  // Scroll-based progressive loading — load more when near bottom
  useEffect(() => {
    const container = entityListRef.current;
    if (!container || visibleCount >= filteredNavItems.length) return;

    const checkScrollPosition = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop - clientHeight < 300) {
        setVisibleCount((prev) => Math.min(prev + ENTITY_PAGE_SIZE, filteredNavItems.length));
      }
    };

    container.addEventListener("scroll", checkScrollPosition, { passive: true });
    // Check after paint — if content doesn't fill the container, load more immediately
    requestAnimationFrame(checkScrollPosition);

    return () => container.removeEventListener("scroll", checkScrollPosition);
  }, [visibleCount, filteredNavItems.length]);

  const visibleNavItems = useMemo(
    () => filteredNavItems.slice(0, visibleCount),
    [filteredNavItems, visibleCount]
  );

  return (
    <div className="eb">
      {/* Filters and Settings Card - fixed header */}
      <div className="illuminator-card eb-settings-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Entities</h2>
          <span className="eb-entity-count">
            {filteredNavItems.length} of {navEntities.length} entities
          </span>
          <button
            onClick={openCreateEntity}
            className="illuminator-button illuminator-button-secondary eb-add-entity-btn"
            title="Create a new entity manually"
          >
            + Add Entity
          </button>
        </div>

        {/* Entity search bar */}
        <div className="eb-search-wrap">
          <div className="eb-search-row">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.trim().length >= 2) setSearchOpen(true);
              }}
              onFocus={() => {
                if (searchQuery.trim().length >= 2) setSearchOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearchOpen(false);
                  setSearchQuery("");
                  e.target.blur();
                }
                if (e.key === "Enter" && searchResults.length > 0)
                  handleSearchSelect(searchResults[0].entity.id);
              }}
              placeholder={
                searchText
                  ? "Search names, aliases, summaries, descriptions\u2026"
                  : "Search names, aliases\u2026"
              }
              className="illuminator-select eb-search-input"
            />
            <label className="eb-search-text-label">
              <input
                type="checkbox"
                checked={searchText}
                onChange={(e) => setSearchText(e.target.checked)}
              />
              Include text
            </label>
          </div>
          {searchOpen && searchQuery.trim().length >= 2 && (
            <div className="eb-search-dropdown">
              {searchResults.length === 0 ? (
                <div className="eb-search-empty">No matches</div>
              ) : (
                <>
                  <div className="eb-search-count">
                    {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                  </div>
                  {searchResults.map(({ entity, matches }) => {
                    const q = searchQuery.trim().toLowerCase();
                    return (
                      <div
                        key={entity.id}
                        onClick={() => handleSearchSelect(entity.id)}
                        className="eb-search-result"
                      >
                        <div className="eb-search-result-name">
                          <HighlightMatch text={entity.name} query={q} />
                          <span className="eb-search-result-kind">
                            {entity.kind}
                            {entity.subtype ? `/${entity.subtype}` : ""}
                          </span>
                        </div>
                        {matches
                          .filter((m) => m.field !== "name")
                          .map((m, i) => (
                            <div key={i} className="eb-search-match-row">
                              <span className="eb-search-match-field">{m.field}</span>
                              <HighlightMatch
                                text={m.value}
                                query={q}
                                truncate={
                                  m.field === "summary" || m.field === "description" ? 120 : 0
                                }
                                matchIndex={m.matchIndex}
                              />
                            </div>
                          ))}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
          {searchOpen && (
            <div
              className="eb-search-backdrop"
              onClick={() => {
                setSearchOpen(false);
              }}
            />
          )}
        </div>

        {/* Compact filters grid */}
        <div className="eb-filters">
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

          <label className="eb-hide-completed-label">
            <input
              type="checkbox"
              checked={hideCompleted}
              onChange={(e) => setHideCompleted(e.target.checked)}
            />
            Hide completed
          </label>
        </div>

        {/* Enrichment Settings - inline */}
        <div className="eb-enrichment-settings">
          <span className="eb-enrichment-label">Image threshold:</span>
          <select
            value={config.minProminenceForImage}
            onChange={(e) => onConfigChange({ minProminenceForImage: e.target.value })}
            className="illuminator-select eb-enrichment-select"
          >
            {PROMINENCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}+
              </option>
            ))}
          </select>
          <span className="eb-enrichment-hint">
            Only entities at or above this prominence can have images generated
          </span>
        </div>

        {/* Image Settings Summary */}
        <ImageSettingsSummary
          settings={imageGenSettings}
          styleLibrary={styleLibrary}
          onOpenSettings={openImageSettings}
        />

        {/* Min Event Significance for Descriptions */}
        <div className="eb-event-significance">
          <label className="eb-event-significance-label">
            Min Event Importance (for descriptions)
          </label>
          <select
            value={config.minEventSignificance ?? 0.25}
            onChange={(e) => onConfigChange({ minEventSignificance: parseFloat(e.target.value) })}
            className="eb-event-significance-select"
          >
            <option value={0}>All (&gt;0%)</option>
            <option value={0.25}>Low (&gt;25%)</option>
            <option value={0.5}>Medium (&gt;50%)</option>
            <option value={0.75}>High (&gt;75%)</option>
          </select>
          <span className="eb-event-significance-hint">
            Include events above this significance in description prompts
          </span>
        </div>

        {/* Quick actions */}
        <div className="eb-quick-actions">
          <button
            onClick={queueAllMissingDescriptions}
            className="illuminator-button illuminator-button-secondary"
            disabled={missingDescCount === 0}
          >
            Queue All Descriptions ({missingDescCount})
          </button>
          <button
            onClick={queueAllMissingImages}
            className="illuminator-button illuminator-button-secondary"
            disabled={missingImgCount === 0}
          >
            {dependentDescCount > 0
              ? `Queue All Images + ${dependentDescCount} Desc (${missingImgCount})`
              : `Queue All Images (${missingImgCount})`}
          </button>
          {onStartRevision && (
            <button
              onClick={onStartRevision}
              disabled={isRevising}
              className="illuminator-button illuminator-button-secondary"
            >
              {isRevising ? "Revising..." : "Revise Summaries"}
            </button>
          )}
          {historianConfigured && onBulkHistorianReview && (
            <button
              onClick={() => {
                const ids = filteredNavItems
                  .filter((n) => n.hasDescription && !n.hasHistorianNotes)
                  .map((n) => n.id);
                onBulkHistorianReview(ids);
              }}
              disabled={isBulkHistorianActive || annotationEligibleCount === 0}
              className="illuminator-button illuminator-button-secondary"
            >
              {isBulkHistorianActive ? "Running..." : `Annotate All (${annotationEligibleCount})`}
            </button>
          )}
          {historianConfigured && onBulkHistorianEdition && (
            <button
              onClick={() => {
                const ids = filteredNavItems
                  .filter((n) => n.hasDescription && !n.hasHistorianEdition)
                  .map((n) => n.id);
                onBulkHistorianEdition(ids);
              }}
              disabled={isBulkHistorianActive || copyEditEligibleCount === 0}
              className="illuminator-button illuminator-button-secondary"
            >
              {isBulkHistorianActive ? "Running..." : `Copy Edit All (${copyEditEligibleCount})`}
            </button>
          )}
          {historianConfigured && onBulkHistorianEdition && reEditionEligibleCount > 0 && (
            <button
              onClick={() => {
                const ids = filteredNavItems
                  .filter((n) => n.hasDescription && n.hasHistorianEdition)
                  .map((n) => n.id);
                onBulkHistorianEdition(ids, true);
              }}
              disabled={isBulkHistorianActive}
              className="illuminator-button illuminator-button-secondary"
            >
              {isBulkHistorianActive ? "Running..." : `Re-Edit All (${reEditionEligibleCount})`}
            </button>
          )}
          {historianConfigured && legacyConvertEligibleCount > 0 && (
            <button
              onClick={async () => {
                const ids = filteredNavItems.filter((n) => n.hasHistorianEdition).map((n) => n.id);
                const count = await convertLongEditionsToLegacy(ids);
                if (count > 0) await reloadEntities(ids);
              }}
              disabled={isBulkHistorianActive}
              className="illuminator-button illuminator-button-secondary"
              title="Relabel all historian-edition entries as legacy copy edits"
            >
              Convert to Legacy ({legacyConvertEligibleCount})
            </button>
          )}
          {historianConfigured && annotatedCount > 0 && onBulkHistorianClear && (
            <button
              onClick={() => {
                const ids = filteredNavItems.filter((n) => n.hasHistorianNotes).map((n) => n.id);
                onBulkHistorianClear(ids);
              }}
              disabled={isBulkHistorianActive}
              className="illuminator-button illuminator-button-secondary"
              title="Remove all annotations from filtered entities"
            >
              Clear All Notes ({annotatedCount})
            </button>
          )}
          {historianConfigured && annotatedCount > 0 && onNavigateToTab && (
            <button
              onClick={() => onNavigateToTab("finaledit")}
              disabled={isBulkHistorianActive}
              className="illuminator-button illuminator-button-secondary"
              title="Find and replace across corpus (Final Edit tab)"
            >
              Find/Replace
            </button>
          )}
          {historianConfigured && (
            <button
              onClick={() => setShowMotifWeaver(true)}
              disabled={isBulkHistorianActive}
              className="illuminator-button illuminator-button-secondary"
              title="Weave a thematic phrase into descriptions where the concept exists but the phrase was stripped"
            >
              Motif Weaver
            </button>
          )}
        </div>
      </div>

      {/* Selection actions - fixed */}
      {selectedIds.size > 0 && (
        <div className="eb-selection-bar">
          <span className="eb-selection-count">{selectedIds.size} selected</span>
          <button
            onClick={queueSelectedDescriptions}
            className="illuminator-button illuminator-button-secondary eb-selection-btn"
            title="Queue missing descriptions"
          >
            Queue Desc
          </button>
          <button
            onClick={queueSelectedImages}
            className="illuminator-button illuminator-button-secondary eb-selection-btn"
            title="Queue missing images"
          >
            Queue Img
          </button>
          <button
            onClick={regenSelectedDescriptions}
            className="illuminator-button illuminator-button-secondary eb-selection-btn"
            title="Regenerate existing descriptions"
          >
            Regen Desc
          </button>
          <button
            onClick={regenSelectedImages}
            className="illuminator-button illuminator-button-secondary eb-selection-btn"
            title="Regenerate existing images"
          >
            Regen Img
          </button>
          <button
            onClick={downloadSelectedDebug}
            className="illuminator-button illuminator-button-secondary eb-selection-btn"
            title="Download debug request/response data for selected entities"
          >
            Download Debug
          </button>
          <button
            onClick={downloadSelectedEditions}
            className="illuminator-button illuminator-button-secondary eb-selection-btn"
            title="Export pre-historian, legacy, and active description versions + annotations for selected entities"
          >
            Export Editions
          </button>
          <button
            onClick={downloadSelectedAnnotations}
            className="illuminator-button illuminator-button-secondary eb-selection-btn"
            title="Export historian annotations for selected entities (name, kind, prominence)"
          >
            Export Annotations
          </button>
          <button onClick={clearSelection} className="illuminator-button-link eb-selection-clear">
            Clear
          </button>
        </div>
      )}

      {/* Entity detail view OR entity list */}
      {selectedEntityId && selectedEntity ? (
        <EntityDetailView
          entity={selectedEntity}
          entities={navEntities}
          onBack={() => setSelectedEntityId(null)}
        />
      ) : (
        <div className="illuminator-card eb-list-card">
          {/* Header row - sticky */}
          <div className="eb-list-header">
            <input
              type="checkbox"
              checked={selectedIds.size === filteredNavItems.length && filteredNavItems.length > 0}
              onChange={(e) => (e.target.checked ? selectAll() : clearSelection())}
            />
            <span className="eb-list-header-label">Select all</span>
          </div>

          {/* Entity rows - scrollable container with progressive rendering */}
          <div ref={entityListRef} className="eb-list-scroll">
            {filteredNavItems.length === 0 ? (
              <div className="eb-list-empty">No entities match the current filters.</div>
            ) : (
              <>
                {visibleNavItems.map((nav) => {
                  const descStatus = getStatus(nav, "description");
                  const imgStatus = getStatus(nav, "image");
                  const thesisStatus = getStatus(nav, "visualThesis");
                  return (
                    <EntityRow
                      key={nav.id}
                      entity={nav}
                      descStatus={descStatus}
                      imgStatus={imgStatus}
                      thesisStatus={thesisStatus}
                      selected={selectedIds.has(nav.id)}
                      onToggleSelect={() => toggleSelect(nav.id)}
                      onQueueDesc={() => queueItem(nav.id, "description")}
                      onQueueThesis={() => queueItem(nav.id, "visualThesis")}
                      onQueueImg={() => queueItem(nav.id, "image")}
                      onCancelDesc={() => cancelItem(nav.id, "description")}
                      onCancelThesis={() => cancelItem(nav.id, "visualThesis")}
                      onCancelImg={() => cancelItem(nav.id, "image")}
                      onAssignImage={() => openImagePicker(nav)}
                      canQueueImage={
                        prominenceAtLeast(
                          nav.prominence,
                          config.minProminenceForImage,
                          prominenceScale
                        ) &&
                        (!config.requireDescription || nav.hasDescription)
                      }
                      needsDescription={
                        prominenceAtLeast(
                          nav.prominence,
                          config.minProminenceForImage,
                          prominenceScale
                        ) &&
                        config.requireDescription &&
                        !nav.hasDescription
                      }
                      onImageClick={openImageModal}
                      onEntityClick={() => openEntityModal(nav)}
                      onEditEntity={handleEditEntity}
                      onDeleteEntity={handleDeleteEntity}
                      descCost={getNavItemCostDisplay(nav, "description", descStatus)}
                      imgCost={getNavItemCostDisplay(nav, "image", imgStatus)}
                      prominenceScale={prominenceScale}
                    />
                  );
                })}
                {visibleCount < filteredNavItems.length && (
                  <div className="eb-list-loading">
                    Loading more... ({visibleCount} of {filteredNavItems.length})
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Image Modal */}
      <ImageModal
        isOpen={imageModal.open}
        imageId={imageModal.imageId}
        title={imageModal.title}
        onClose={() => setImageModal({ open: false, imageId: "", title: "" })}
      />

      {/* Image Picker Modal */}
      <ImagePickerModal
        isOpen={!!imagePickerEntity}
        onClose={() => setImagePickerEntity(null)}
        onSelect={handleImageSelected}
        entityKind={imagePickerEntity?.kind}
        entityCulture={imagePickerEntity?.culture}
        currentImageId={imagePickerEntity?.imageId}
      />

      {/* Description Motif Weaver */}
      {showMotifWeaver && <DescriptionMotifWeaver onClose={() => setShowMotifWeaver(false)} />}
    </div>
  );
}
