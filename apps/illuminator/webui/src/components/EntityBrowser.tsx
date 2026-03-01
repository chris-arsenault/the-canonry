/**
 * EntityBrowser - Primary entity-centric view
 *
 * Shows all entities with their enrichment status.
 * Allows filtering, selection, and queueing enrichment tasks.
 * Includes enrichment settings (moved from ConfigPanel).
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useEntityNavList } from "../lib/db/entitySelectors";
import { useEntityStore } from "../lib/db/entityStore";
import { useProminenceScale } from "../lib/db/indexSelectors";
import { useEntityCrud, reloadEntities } from "../hooks/useEntityCrud";
import { useHistorianActions } from "../hooks/useHistorianActions";
import { convertLongEditionsToLegacy } from "../lib/db/entityRepository";
import { useIlluminatorModals } from "../lib/db/modalStore";
import { getEnqueue, getCancel } from "../lib/db/enrichmentQueueBridge";
import { useEnrichmentQueueStore } from "../lib/db/enrichmentQueueStore";
import { prominenceLabelFromScale, prominenceThresholdFromScale } from "@canonry/world-schema";
import type { ProminenceScale } from "@canonry/world-schema";
import DescriptionMotifWeaver from "./DescriptionMotifWeaver";
import ImageModal from "./ImageModal";
import ImagePickerModal from "./ImagePickerModal";
import EntityDetailView from "./EntityDetailView";
import { ImageSettingsSummary } from "./ImageSettingsDrawer";
import { EntityRow, getNavItemCostDisplay } from "./EntityBrowserHelpers";
import { EntityBrowserSearch } from "./EntityBrowserSearch";
import { EntityBrowserSelectionBar } from "./EntityBrowserSelectionBar";
import { useEntityBrowserSearch } from "./hooks/useEntityBrowserSearch";
import { useEntityBrowserFilters } from "./hooks/useEntityBrowserFilters";
import { useEntityBrowserQueue } from "./hooks/useEntityBrowserQueue";
import { useEntityBrowserDownloads } from "./hooks/useEntityBrowserDownloads";
import type { EntityNavItem } from "../lib/db/entityNav";
import type {
  EntityBrowserProps,
  EntityFilters,
  FilterOptions,
  ImageModalState,
  EnrichmentStatus,
} from "./EntityBrowserTypes";
import "./EntityBrowser.css";

const PROMINENCE_ORDER = ["mythic", "renowned", "recognized", "marginal", "forgotten"];

const PROMINENCE_OPTIONS = [
  { value: "mythic", label: "Mythic" },
  { value: "renowned", label: "Renowned" },
  { value: "recognized", label: "Recognized" },
  { value: "marginal", label: "Marginal" },
  { value: "forgotten", label: "Forgotten" },
];

const ENTITY_PAGE_SIZE = 20;

function prominenceAtLeast(
  prominence: number | string,
  minProminence: string,
  scale: ProminenceScale
): boolean {
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

export default function EntityBrowser({
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
}: Readonly<EntityBrowserProps>) {
  const navEntities = useEntityNavList();
  const { handleAssignImage, handleDeleteEntity } = useEntityCrud();
  const { historianConfigured } = useHistorianActions();
  const { openCreateEntity, openEditEntity, openImageSettings } = useIlluminatorModals();
  const queue = useEnrichmentQueueStore((s) => s.queue);
  const prominenceScale = useProminenceScale();

  // ── Local state ──────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<EntityFilters>({
    kind: "all",
    prominence: "all",
    status: "all",
    culture: "all",
    chronicleImage: "all",
  });
  const [hideCompleted, setHideCompleted] = useState(false);
  const [imageModal, setImageModal] = useState<ImageModalState>({
    open: false,
    imageId: "",
    title: "",
  });
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [imagePickerEntity, setImagePickerEntity] = useState<EntityNavItem | null>(null);
  const [showMotifWeaver, setShowMotifWeaver] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ENTITY_PAGE_SIZE);
  const entityListRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Search ───────────────────────────────────────────────────────────
  const {
    searchQuery,
    searchOpen,
    searchText,
    searchResults,
    setSearchQuery,
    setSearchOpen,
    setSearchText,
    handleSearchSelect: rawSearchSelect,
  } = useEntityBrowserSearch(navEntities);

  const handleSearchSelect = useCallback(
    (entityId: string) => {
      rawSearchSelect(entityId);
      setSelectedEntityId(entityId);
    },
    [rawSearchSelect]
  );

  // ── Enrichment status ────────────────────────────────────────────────
  const getStatus = useCallback(
    (nav: EntityNavItem, type: string): EnrichmentStatus => {
      const queueItem = queue.find((item) => item.entityId === nav.id && item.type === type);
      if (queueItem) return queueItem.status as EnrichmentStatus;
      if (type === "description" && nav.hasDescription) return "complete";
      if (type === "visualThesis" && nav.hasVisualThesis) return "complete";
      if (type === "image" && nav.imageId) return "complete";
      return "missing";
    },
    [queue]
  );

  // ── Filters ──────────────────────────────────────────────────────────
  const { filteredNavItems, filterOptions } = useEntityBrowserFilters(
    navEntities,
    filters,
    hideCompleted,
    getStatus,
    prominenceScale,
    config
  );

  // ── Queue operations ─────────────────────────────────────────────────
  const queueOps = useEntityBrowserQueue(
    selectedIds,
    navEntities,
    filteredNavItems,
    getStatus,
    buildPrompt,
    getVisualConfig,
    config,
    imageGenSettings,
    prominenceScale
  );

  // ── Download operations ──────────────────────────────────────────────
  const downloadOps = useEntityBrowserDownloads(selectedIds, queue, prominenceScale);

  // ── Selection ────────────────────────────────────────────────────────
  const toggleSelect = useCallback((entityId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entityId)) next.delete(entityId);
      else next.add(entityId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredNavItems.map((e) => e.id)));
  }, [filteredNavItems]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // ── Image & entity modals ───────────────────────────────────────────
  const openImageModal = useCallback((imageId: string, title: string) => {
    setImageModal({ open: true, imageId, title });
  }, []);

  const closeImageModal = useCallback(() => {
    setImageModal({ open: false, imageId: "", title: "" });
  }, []);

  const openImagePicker = useCallback((entity: EntityNavItem) => {
    setImagePickerEntity(entity);
  }, []);

  const openEntityModal = useCallback((entity: EntityNavItem) => {
    setSelectedEntityId(entity.id);
  }, []);

  const handleEditEntity = useCallback(
    async (navItem: EntityNavItem) => {
      const fullEntity = await useEntityStore.getState().loadEntity(navItem.id);
      if (fullEntity) openEditEntity(fullEntity);
    },
    [openEditEntity]
  );

  const handleImageSelected = useCallback(
    (imageId: string, imageMetadata: Record<string, unknown>) => {
      if (imagePickerEntity) handleAssignImage(imagePickerEntity.id, imageId, imageMetadata);
      setImagePickerEntity(null);
    },
    [imagePickerEntity, handleAssignImage]
  );

  const handleBackClick = useCallback(() => setSelectedEntityId(null), []);

  // ── Selected entity detail view ─────────────────────────────────────
  const cachedEntity = useEntityStore((s) =>
    selectedEntityId ? s.cache.get(selectedEntityId) : undefined
  );
  const [selectedEntity, setSelectedEntity] = useState<unknown>(null);

  // Derive selected entity from cache or load from Dexie.
  // Using useMemo + effect combo avoids synchronous setState-in-effect.
  const resolvedEntity = useMemo(() => {
    if (!selectedEntityId) return null;
    return cachedEntity ?? null;
  }, [selectedEntityId, cachedEntity]);

  useEffect(() => {
    if (!selectedEntityId) {
      setSelectedEntity(null);
      return;
    }
    if (resolvedEntity) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing external store cache into local state for detail view
      setSelectedEntity(resolvedEntity);
    } else {
      void useEntityStore
        .getState()
        .loadEntity(selectedEntityId)
        .then((e) => setSelectedEntity(e));
    }
  }, [selectedEntityId, resolvedEntity]);

  // ── Progressive rendering ────────────────────────────────────────────
  const filtersKey = `${filters.kind}|${filters.prominence}|${filters.status}|${filters.culture}|${filters.chronicleImage}|${String(hideCompleted)}|${searchQuery}`;
  const prevFiltersKeyRef = useRef(filtersKey);
  if (prevFiltersKeyRef.current !== filtersKey) {
    prevFiltersKeyRef.current = filtersKey;
    // Reset visible count synchronously during render instead of useEffect
    if (visibleCount !== ENTITY_PAGE_SIZE) {
      setVisibleCount(ENTITY_PAGE_SIZE);
    }
  }

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
    requestAnimationFrame(checkScrollPosition);

    return () => container.removeEventListener("scroll", checkScrollPosition);
  }, [visibleCount, filteredNavItems.length]);

  const visibleNavItems = useMemo(
    () => filteredNavItems.slice(0, visibleCount),
    [filteredNavItems, visibleCount]
  );

  // ── Bulk historian counts ────────────────────────────────────────────
  const bulkCounts = useMemo(() => {
    let annotationEligible = 0;
    let copyEditEligible = 0;
    let reEditionEligible = 0;
    let legacyConvertEligible = 0;
    let annotated = 0;
    let missingDesc = 0;
    let missingImg = 0;
    let dependentDesc = 0;

    for (const nav of filteredNavItems) {
      if (nav.hasDescription && !nav.hasHistorianNotes) annotationEligible++;
      if (nav.hasDescription && !nav.hasHistorianEdition) copyEditEligible++;
      if (nav.hasDescription && nav.hasHistorianEdition) reEditionEligible++;
      if (nav.hasHistorianEdition) legacyConvertEligible++;
      if (nav.hasHistorianNotes) annotated++;
      if (getStatus(nav, "description") === "missing") missingDesc++;

      const isImageEligible = prominenceAtLeast(
        nav.prominence,
        config.minProminenceForImage,
        prominenceScale
      );
      if (isImageEligible && getStatus(nav, "image") === "missing") {
        missingImg++;
        if (config.requireDescription && !nav.hasDescription && getStatus(nav, "description") === "missing") {
          dependentDesc++;
        }
      }
    }

    return {
      annotationEligible,
      copyEditEligible,
      reEditionEligible,
      legacyConvertEligible,
      annotated,
      missingDesc,
      missingImg,
      dependentDesc,
    };
  }, [filteredNavItems, getStatus, config.minProminenceForImage, config.requireDescription, prominenceScale]);

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="eb">
      {/* Settings Card */}
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

        <EntityBrowserSearch
          searchQuery={searchQuery}
          searchText={searchText}
          searchOpen={searchOpen}
          searchResults={searchResults}
          searchInputRef={searchInputRef}
          onSearchQueryChange={setSearchQuery}
          onSearchTextChange={setSearchText}
          onSearchOpen={setSearchOpen}
          onSearchSelect={handleSearchSelect}
        />

        <EntityBrowserFilterGrid
          filters={filters}
          filterOptions={filterOptions}
          hideCompleted={hideCompleted}
          onFiltersChange={setFilters}
          onHideCompletedChange={setHideCompleted}
        />

        {/* Enrichment Settings */}
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
          <span className="ilu-hint-sm eb-enrichment-hint">
            Only entities at or above this prominence can have images generated
          </span>
        </div>

        <ImageSettingsSummary
          settings={imageGenSettings}
          styleLibrary={styleLibrary}
          onOpenSettings={openImageSettings}
        />

        {/* Min Event Significance */}
        <div className="eb-event-significance">
          <label htmlFor="min-event-importance-for-descriptions" className="eb-event-significance-label">
            Min Event Importance (for descriptions)
          </label>
          <select
            id="min-event-importance-for-descriptions"
            value={config.minEventSignificance ?? 0.25}
            onChange={(e) => onConfigChange({ minEventSignificance: parseFloat(e.target.value) })}
            className="eb-event-significance-select"
          >
            <option value={0}>All (&gt;0%)</option>
            <option value={0.25}>Low (&gt;25%)</option>
            <option value={0.5}>Medium (&gt;50%)</option>
            <option value={0.75}>High (&gt;75%)</option>
          </select>
          <span className="ilu-hint-sm eb-event-significance-hint">
            Include events above this significance in description prompts
          </span>
        </div>

        <EntityBrowserQuickActions
          bulkCounts={bulkCounts}
          onQueueAllDescriptions={queueOps.queueAllMissingDescriptions}
          onQueueAllImages={queueOps.queueAllMissingImages}
          onStartRevision={onStartRevision}
          isRevising={isRevising}
          historianConfigured={historianConfigured}
          onBulkHistorianReview={onBulkHistorianReview}
          onBulkHistorianEdition={onBulkHistorianEdition}
          onBulkHistorianClear={onBulkHistorianClear}
          isBulkHistorianActive={isBulkHistorianActive}
          filteredNavItems={filteredNavItems}
          onNavigateToTab={onNavigateToTab}
          onShowMotifWeaver={() => setShowMotifWeaver(true)}
        />
      </div>

      <EntityBrowserSelectionBar
        selectedCount={selectedIds.size}
        onQueueSelectedDescriptions={() => void queueOps.queueSelectedDescriptions()}
        onQueueSelectedImages={() => void queueOps.queueSelectedImages()}
        onRegenSelectedDescriptions={() => void queueOps.regenSelectedDescriptions()}
        onRegenSelectedImages={() => void queueOps.regenSelectedImages()}
        onDownloadSelectedDebug={() => void downloadOps.downloadSelectedDebug()}
        onDownloadSelectedEditions={() => void downloadOps.downloadSelectedEditions()}
        onDownloadSelectedAnnotations={() => void downloadOps.downloadSelectedAnnotations()}
        onClearSelection={clearSelection}
      />

      {/* Entity detail view OR entity list */}
      {selectedEntityId && selectedEntity ? (
        <EntityDetailView entity={selectedEntity} entities={navEntities} onBack={handleBackClick} />
      ) : (
        <div className="illuminator-card eb-list-card">
          <div className="eb-list-header">
            <input
              type="checkbox"
              checked={selectedIds.size === filteredNavItems.length && filteredNavItems.length > 0}
              onChange={(e) => (e.target.checked ? selectAll() : clearSelection())}
            />
            <span className="eb-list-header-label">Select all</span>
          </div>
          <div ref={entityListRef} className="eb-list-scroll">
            {filteredNavItems.length === 0 ? (
              <div className="ilu-empty eb-list-empty">No entities match the current filters.</div>
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
                      onQueueDesc={() => void queueOps.queueItem(nav.id, "description")}
                      onQueueThesis={() => void queueOps.queueItem(nav.id, "visualThesis")}
                      onQueueImg={() => void queueOps.queueItem(nav.id, "image")}
                      onCancelDesc={() => queueOps.cancelItem(nav.id, "description")}
                      onCancelThesis={() => queueOps.cancelItem(nav.id, "visualThesis")}
                      onCancelImg={() => queueOps.cancelItem(nav.id, "image")}
                      onAssignImage={() => openImagePicker(nav)}
                      canQueueImage={
                        prominenceAtLeast(nav.prominence, config.minProminenceForImage, prominenceScale) &&
                        (!config.requireDescription || nav.hasDescription)
                      }
                      needsDescription={
                        prominenceAtLeast(nav.prominence, config.minProminenceForImage, prominenceScale) &&
                        Boolean(config.requireDescription) &&
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
                  <div className="ilu-empty eb-list-loading">
                    Loading more... ({visibleCount} of {filteredNavItems.length})
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <ImageModal
        isOpen={imageModal.open}
        imageId={imageModal.imageId}
        title={imageModal.title}
        onClose={closeImageModal}
      />

      <ImagePickerModal
        isOpen={!!imagePickerEntity}
        onClose={() => setImagePickerEntity(null)}
        onSelect={handleImageSelected}
        entityKind={imagePickerEntity?.kind}
        entityCulture={imagePickerEntity?.culture}
        currentImageId={imagePickerEntity?.imageId}
      />

      {showMotifWeaver && <DescriptionMotifWeaver onClose={() => setShowMotifWeaver(false)} />}
    </div>
  );
}

// ─── Inline sub-components ──────────────────────────────────────────────────

interface FilterGridProps {
  filters: EntityFilters;
  filterOptions: FilterOptions;
  hideCompleted: boolean;
  onFiltersChange: React.Dispatch<React.SetStateAction<EntityFilters>>;
  onHideCompletedChange: (checked: boolean) => void;
}

function EntityBrowserFilterGrid({
  filters,
  filterOptions,
  hideCompleted,
  onFiltersChange,
  onHideCompletedChange,
}: Readonly<FilterGridProps>) {
  return (
    <div className="eb-filters">
      <select
        value={filters.kind}
        onChange={(e) => onFiltersChange((prev) => ({ ...prev, kind: e.target.value }))}
        className="illuminator-select"
      >
        <option value="all">All Kinds</option>
        {filterOptions.kinds.map((kind) => (
          <option key={kind} value={kind}>{kind}</option>
        ))}
      </select>
      <select
        value={filters.prominence}
        onChange={(e) => onFiltersChange((prev) => ({ ...prev, prominence: e.target.value }))}
        className="illuminator-select"
      >
        <option value="all">All Prominence</option>
        {PROMINENCE_ORDER.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <select
        value={filters.status}
        onChange={(e) => onFiltersChange((prev) => ({ ...prev, status: e.target.value }))}
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
          onChange={(e) => onFiltersChange((prev) => ({ ...prev, culture: e.target.value }))}
          className="illuminator-select"
        >
          <option value="all">All Cultures</option>
          {filterOptions.cultures.map((culture) => (
            <option key={culture} value={culture}>{culture}</option>
          ))}
        </select>
      )}
      <select
        value={filters.chronicleImage}
        onChange={(e) => onFiltersChange((prev) => ({ ...prev, chronicleImage: e.target.value }))}
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
          onChange={(e) => onHideCompletedChange(e.target.checked)}
        />
        Hide completed
      </label>
    </div>
  );
}

interface QuickActionsProps {
  bulkCounts: {
    missingDesc: number;
    missingImg: number;
    dependentDesc: number;
    annotationEligible: number;
    copyEditEligible: number;
    reEditionEligible: number;
    legacyConvertEligible: number;
    annotated: number;
  };
  onQueueAllDescriptions: () => Promise<void>;
  onQueueAllImages: () => Promise<void>;
  onStartRevision?: () => void;
  isRevising?: boolean;
  historianConfigured: boolean;
  onBulkHistorianReview?: (ids: string[]) => void;
  onBulkHistorianEdition?: (ids: string[], reEdit?: boolean) => void;
  onBulkHistorianClear?: (ids: string[]) => void;
  isBulkHistorianActive?: boolean;
  filteredNavItems: EntityNavItem[];
  onNavigateToTab?: (tab: string) => void;
  onShowMotifWeaver: () => void;
}

function EntityBrowserQuickActions({
  bulkCounts,
  onQueueAllDescriptions,
  onQueueAllImages,
  onStartRevision,
  isRevising,
  historianConfigured,
  onBulkHistorianReview,
  onBulkHistorianEdition,
  onBulkHistorianClear,
  isBulkHistorianActive,
  filteredNavItems,
  onNavigateToTab,
  onShowMotifWeaver,
}: Readonly<QuickActionsProps>) {
  const handleAnnotateAll = useCallback(() => {
    if (!onBulkHistorianReview) return;
    const ids = filteredNavItems.filter((n) => n.hasDescription && !n.hasHistorianNotes).map((n) => n.id);
    onBulkHistorianReview(ids);
  }, [onBulkHistorianReview, filteredNavItems]);

  const handleCopyEditAll = useCallback(() => {
    if (!onBulkHistorianEdition) return;
    const ids = filteredNavItems.filter((n) => n.hasDescription && !n.hasHistorianEdition).map((n) => n.id);
    onBulkHistorianEdition(ids);
  }, [onBulkHistorianEdition, filteredNavItems]);

  const handleReEditAll = useCallback(() => {
    if (!onBulkHistorianEdition) return;
    const ids = filteredNavItems.filter((n) => n.hasDescription && n.hasHistorianEdition).map((n) => n.id);
    onBulkHistorianEdition(ids, true);
  }, [onBulkHistorianEdition, filteredNavItems]);

  const handleConvertToLegacy = useCallback(() => {
    void (async () => {
      const ids = filteredNavItems.filter((n) => n.hasHistorianEdition).map((n) => n.id);
      const count = await convertLongEditionsToLegacy(ids);
      if (count > 0) await reloadEntities(ids);
    })();
  }, [filteredNavItems]);

  const handleClearAllNotes = useCallback(() => {
    if (!onBulkHistorianClear) return;
    const ids = filteredNavItems.filter((n) => n.hasHistorianNotes).map((n) => n.id);
    onBulkHistorianClear(ids);
  }, [onBulkHistorianClear, filteredNavItems]);

  const handleFindReplace = useCallback(() => {
    if (onNavigateToTab) onNavigateToTab("finaledit");
  }, [onNavigateToTab]);

  return (
    <div className="eb-quick-actions">
      <button
        onClick={() => void onQueueAllDescriptions()}
        className="illuminator-button illuminator-button-secondary"
        disabled={bulkCounts.missingDesc === 0}
      >
        Queue All Descriptions ({bulkCounts.missingDesc})
      </button>
      <button
        onClick={() => void onQueueAllImages()}
        className="illuminator-button illuminator-button-secondary"
        disabled={bulkCounts.missingImg === 0}
      >
        {bulkCounts.dependentDesc > 0
          ? `Queue All Images + ${bulkCounts.dependentDesc} Desc (${bulkCounts.missingImg})`
          : `Queue All Images (${bulkCounts.missingImg})`}
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
          onClick={handleAnnotateAll}
          disabled={isBulkHistorianActive || bulkCounts.annotationEligible === 0}
          className="illuminator-button illuminator-button-secondary"
        >
          {isBulkHistorianActive ? "Running..." : `Annotate All (${bulkCounts.annotationEligible})`}
        </button>
      )}
      {historianConfigured && onBulkHistorianEdition && (
        <button
          onClick={handleCopyEditAll}
          disabled={isBulkHistorianActive || bulkCounts.copyEditEligible === 0}
          className="illuminator-button illuminator-button-secondary"
        >
          {isBulkHistorianActive ? "Running..." : `Copy Edit All (${bulkCounts.copyEditEligible})`}
        </button>
      )}
      {historianConfigured && onBulkHistorianEdition && bulkCounts.reEditionEligible > 0 && (
        <button
          onClick={handleReEditAll}
          disabled={isBulkHistorianActive}
          className="illuminator-button illuminator-button-secondary"
        >
          {isBulkHistorianActive ? "Running..." : `Re-Edit All (${bulkCounts.reEditionEligible})`}
        </button>
      )}
      {historianConfigured && bulkCounts.legacyConvertEligible > 0 && (
        <button
          onClick={handleConvertToLegacy}
          disabled={isBulkHistorianActive}
          className="illuminator-button illuminator-button-secondary"
          title="Relabel all historian-edition entries as legacy copy edits"
        >
          Convert to Legacy ({bulkCounts.legacyConvertEligible})
        </button>
      )}
      {historianConfigured && bulkCounts.annotated > 0 && onBulkHistorianClear && (
        <button
          onClick={handleClearAllNotes}
          disabled={isBulkHistorianActive}
          className="illuminator-button illuminator-button-secondary"
          title="Remove all annotations from filtered entities"
        >
          Clear All Notes ({bulkCounts.annotated})
        </button>
      )}
      {historianConfigured && bulkCounts.annotated > 0 && onNavigateToTab && (
        <button
          onClick={handleFindReplace}
          disabled={isBulkHistorianActive}
          className="illuminator-button illuminator-button-secondary"
          title="Find and replace across corpus (Final Edit tab)"
        >
          Find/Replace
        </button>
      )}
      {historianConfigured && (
        <button
          onClick={onShowMotifWeaver}
          disabled={isBulkHistorianActive}
          className="illuminator-button illuminator-button-secondary"
          title="Weave a thematic phrase into descriptions where the concept exists but the phrase was stripped"
        >
          Motif Weaver
        </button>
      )}
    </div>
  );
}
