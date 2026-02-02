/**
 * ChroniclePanel - Narrative generation interface
 *
 * Provides UI for generating long-form narrative content via single-shot LLM generation.
 * Includes wizard for entity/event selection and style configuration.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import ChronicleReviewPanel from './ChronicleReviewPanel';
import { ChronicleWizard } from './ChronicleWizard';
import { buildChronicleContext } from '../lib/chronicleContextBuilder';
import { generateNameBank, extractCultureIds } from '../lib/chronicle/nameBank';
import { deriveStatus } from '../hooks/useChronicleGeneration';
import { useChronicleStore } from '../lib/db/chronicleStore';
import { useChronicleNavItems, useSelectedChronicle } from '../lib/db/chronicleSelectors';
import { useChronicleActions } from '../hooks/useChronicleActions';
import { useChronicleQueueWatcher } from '../hooks/useChronicleQueueWatcher';
import { buildChronicleScenePrompt } from '../lib/promptBuilders';
import { resolveStyleSelection } from './StyleSelector';
import { getCoverImageConfig } from '../lib/coverImageStyles';
import { computeTemporalContext } from '../lib/chronicle/selectionWizard';
import {
  updateChronicleImageRef,
  updateChronicleTemporalContext,
  updateChronicleActiveVersion,
  updateChronicleCombineInstructions,
  unpublishChronicle,
  updateChronicleCoverImageStatus,
  generateChronicleId,
  deriveTitleFromRoles,
  createChronicleShell,
} from '../lib/db/chronicleRepository';
import { downloadChronicleExport } from '../lib/chronicleExport';

const REFINEMENT_STEPS = new Set(['summary', 'image_refs', 'compare', 'combine', 'cover_image_scene', 'cover_image']);
const NAV_PAGE_SIZE = 10;

const SORT_OPTIONS = [
  { value: 'created_desc', label: 'Newest created' },
  { value: 'created_asc', label: 'Oldest created' },
  { value: 'length_desc', label: 'Longest' },
  { value: 'length_asc', label: 'Shortest' },
  { value: 'type_asc', label: 'Type A-Z' },
  { value: 'type_desc', label: 'Type Z-A' },
  { value: 'era_asc', label: 'Era (earliest)' },
  { value: 'era_desc', label: 'Era (latest)' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'not_started', label: 'Not started' },
  { value: 'generating', label: 'Generating' },
  { value: 'assembly_ready', label: 'Assembly ready' },
  { value: 'failed', label: 'Failed' },
  { value: 'complete', label: 'Complete' },
];

const FOCUS_OPTIONS = [
  { value: 'all', label: 'All focuses' },
  { value: 'single', label: 'Single' },
  { value: 'ensemble', label: 'Ensemble' },
];

function buildTemporalDescription(focalEra, tickRange, scope, isMultiEra, eraCount) {
  const duration = tickRange[1] - tickRange[0];
  const scopeDescriptions = {
    moment: 'a brief moment',
    episode: 'a short episode',
    arc: 'an extended arc',
    saga: 'an epic saga',
  };
  const scopeText = scopeDescriptions[scope] || 'a span of time';

  if (isMultiEra) {
    return `${scopeText} spanning ${eraCount} eras, centered on the ${focalEra.name}`;
  }

  if (duration === 0) {
    return `a single moment during the ${focalEra.name}`;
  }

  return `${scopeText} during the ${focalEra.name} (${duration} ticks)`;
}

function ChronicleItemCard({ item, isSelected, onClick }) {
  const getStatusLabel = () => {
    switch (item.status) {
      case 'not_started':
        return { label: 'Not Started', color: 'var(--text-muted)' };
      case 'generating':
        return { label: 'Generating...', color: '#3b82f6' };
      case 'assembly_ready':
        return { label: 'Assembly Ready', color: '#f59e0b' };
      case 'editing':
        return { label: 'Editing...', color: '#3b82f6' };
      case 'validating':
        return { label: 'Validating...', color: '#3b82f6' };
      case 'validation_ready':
        return { label: 'Review', color: '#f59e0b' };
      case 'failed': {
        const stepLabels = {
          validate: 'Validate',
          edit: 'Edit',
          generate_v2: 'Generation',
        };
        const stepLabel = stepLabels[item.failureStep] || 'Generation';
        return { label: `${stepLabel} Failed`, color: '#ef4444' };
      }
      case 'complete':
        return { label: 'Complete', color: '#10b981' };
      default:
        return { label: 'Unknown', color: 'var(--text-muted)' };
    }
  };

  // Inline symbols for title row
  const inlineSymbols = useMemo(() => {
    const syms = [];

    // Focus type: ◆ solo, ◇◇ ensemble, ○ no primary
    if (item.focusType === 'ensemble') {
      syms.push({ symbol: '\u25C7\u25C7', title: 'Ensemble', color: '#a855f7' });
    } else if (item.primaryCount > 0) {
      syms.push({ symbol: '\u25C6', title: 'Single focus', color: '#3b82f6' });
    } else {
      syms.push({ symbol: '\u25CB', title: 'No primary entity', color: 'var(--text-muted)' });
    }

    // Perspective synthesis
    if (item.perspectiveSynthesis) {
      syms.push({ symbol: '\u2726', title: 'Perspective synthesis', color: '#06b6d4' });
    }

    // Combined versions
    if (item.combineInstructions) {
      syms.push({ symbol: '\u2727', title: 'Versions combined', color: '#f59e0b' });
    }

    // Cover image generated
    if (item.coverImageComplete) {
      syms.push({ symbol: '\u25A3', title: 'Cover image generated', color: '#10b981' });
    }

    // Lore backported
    if (item.loreBackported) {
      syms.push({ symbol: '\u21C4', title: 'Lore backported to cast', color: 'var(--text-secondary)' });
    }

    // Narrative lens
    if (item.lens) {
      syms.push({ symbol: '\u25C8', title: `Lens: ${item.lens.entityName}`, color: '#8b5cf6' });
    }

    return syms;
  }, [item.focusType, item.primaryCount, item.perspectiveSynthesis, item.combineInstructions, item.coverImageComplete, item.loreBackported, item.lens]);

  // Compact numeric badge: cast count + scene image count
  const castCount = (item.primaryCount || 0) + (item.supportingCount || 0);
  const sceneCount = item.imageRefCompleteCount || 0;
  const hasCover = item.coverImageComplete;
  const imageCount = sceneCount + (hasCover ? 1 : 0);

  // Narrative style name for subtitle
  const styleName = item.narrativeStyleName || null;

  const status = getStatusLabel();

  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 16px',
        background: isSelected ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
        border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
        borderRadius: '6px',
        cursor: 'pointer',
        marginBottom: '8px',
        transition: 'all 0.15s',
      }}
    >
      {/* Title row with inline symbols */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <span style={{ fontWeight: 500, fontSize: '14px', flex: 1 }}>
          {item.name}
          {inlineSymbols.map((sym, i) => (
            <span
              key={i}
              title={sym.title}
              style={{ marginLeft: '5px', fontSize: '11px', color: sym.color, opacity: 0.85 }}
            >{sym.symbol}</span>
          ))}
        </span>
        <span style={{ fontSize: '11px', color: status.color, fontWeight: 500, whiteSpace: 'nowrap' }}>
          {status.label}
        </span>
      </div>

      {/* Subtitle: narrative style + numeric counts */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
        {styleName ? (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {styleName}
          </span>
        ) : (
          <span />
        )}
        {(castCount > 0 || imageCount > 0) && (
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', gap: '8px', whiteSpace: 'nowrap' }}>
            {castCount > 0 && (
              <span title={`${item.primaryCount || 0} primary, ${item.supportingCount || 0} supporting`}>
                <span style={{ opacity: 0.6 }}>{'\u2630'}</span> {castCount}
              </span>
            )}
            {imageCount > 0 && (
              <span title={`${hasCover ? 'Cover + ' : ''}${sceneCount} scene image${sceneCount !== 1 ? 's' : ''}`}>
                <span style={{ opacity: 0.6 }}>{'\u25A3'}</span> {imageCount}
              </span>
            )}
          </span>
        )}
      </div>

    </div>
  );
}

function AssembledContentViewer({ content, wordCount, onCopy }) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {wordCount.toLocaleString()} words
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onCopy}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Copy
          </button>
        </div>
      </div>

      <div
        style={{
          padding: '20px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          fontSize: '14px',
          lineHeight: 1.8,
          maxHeight: '600px',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
        }}
      >
        {content}
      </div>
    </div>
  );
}

export default function ChroniclePanel({
  worldData,
  entities,
  queue,
  onEnqueue,
  onCancel,
  worldContext,
  projectId,
  simulationRunId,
  buildPrompt,
  styleLibrary,
  imageGenSettings,
  entityGuidance,
  cultureIdentities,
  onBackportLore,
  autoBackportQueue,
  onStartAutoBackport,
  onCancelAutoBackport,
  refreshTrigger,
  imageModel,
  onOpenImageSettings,
  onHistorianReview,
  isHistorianActive,
  historianConfigured,
  onUpdateHistorianNote,
}) {
  const [selectedItemId, setSelectedItemId] = useState(() => {
    const saved = localStorage.getItem('illuminator:chronicle:selectedItemId');
    return saved || null;
  });
  const [groupByType, setGroupByType] = useState(false);
  const [sortMode, setSortMode] = useState('created_desc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [focusFilter, setFocusFilter] = useState('all');
  const [entitySearchQuery, setEntitySearchQuery] = useState('');
  const [entitySearchSelectedId, setEntitySearchSelectedId] = useState(null);
  const [showEntitySuggestions, setShowEntitySuggestions] = useState(false);
  const [navVisibleCount, setNavVisibleCount] = useState(NAV_PAGE_SIZE);
  const navListRef = useRef(null);
  const navLoadMoreRef = useRef(null);

  useEffect(() => {
    if (selectedItemId) {
      localStorage.setItem('illuminator:chronicle:selectedItemId', selectedItemId);
    } else {
      localStorage.removeItem('illuminator:chronicle:selectedItemId');
    }
  }, [selectedItemId]);

  // State for restart confirmation modal
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [pendingRestartChronicleId, setPendingRestartChronicleId] = useState(null);

  // State for wizard modal
  const [showWizard, setShowWizard] = useState(false);
  // Seed for restarting with previous settings
  const [wizardSeed, setWizardSeed] = useState(null);

  // Derive style/size/quality from global imageGenSettings
  const chronicleImageSize = imageGenSettings.imageSize;
  const chronicleImageQuality = imageGenSettings.imageQuality;
  const chronicleStyleSelection = {
    artisticStyleId: imageGenSettings.artisticStyleId,
    compositionStyleId: imageGenSettings.compositionStyleId,
    colorPaletteId: imageGenSettings.colorPaletteId,
  };

  // Name bank for invented characters (culture ID -> array of names)
  const [nameBank, setNameBank] = useState({});

  // Style library loading state (derived from prop)
  const stylesLoading = !styleLibrary;

  // Initialize chronicle store when simulation changes
  useEffect(() => {
    if (simulationRunId) {
      useChronicleStore.getState().initialize(simulationRunId);
    }
  }, [simulationRunId]);

  // Bridge enrichment queue completions to targeted store refreshes
  useChronicleQueueWatcher(queue);

  // Enqueue-dependent actions (generate, compare, combine)
  const {
    generateV2,
    generateSummary,
    generateTitle,
    generateImageRefs: _generateImageRefs,
    regenerateWithTemperature,
    compareVersions,
    combineVersions,
  } = useChronicleActions(onEnqueue);

  // Lifecycle actions from store (no queue dependency)
  const acceptChronicle = useChronicleStore((s) => s.acceptChronicle);
  const cancelChronicle = useChronicleStore((s) => s.cancelChronicle);
  const restartChronicle = useChronicleStore((s) => s.restartChronicle);

  const isGenerating = queue.some(
    (item) => item.type === 'entityChronicle' &&
              (item.status === 'queued' || item.status === 'running')
  );

  // Refresh helpers
  const refresh = useCallback(() => useChronicleStore.getState().refreshAll(), []);
  const refreshChronicle = useCallback(
    (id) => useChronicleStore.getState().refreshChronicle(id),
    [],
  );

  // External refresh trigger (e.g. after lore backport)
  useEffect(() => {
    if (refreshTrigger > 0) refresh();
  }, [refreshTrigger, refresh]);

  // Build entity map for lookups
  const entityMap = useMemo(() => {
    if (!entities) return new Map();
    return new Map(entities.map((e) => [e.id, e]));
  }, [entities]);

  const entitySuggestions = useMemo(() => {
    const query = entitySearchQuery.trim().toLowerCase();
    if (!query || !entities?.length) return [];
    return entities
      .filter((entity) => entity.name?.toLowerCase().includes(query))
      .slice(0, 8);
  }, [entities, entitySearchQuery]);

  const narrativeStyleNameMap = useMemo(() => {
    const map = new Map();
    const styles = styleLibrary?.narrativeStyles || [];
    for (const style of styles) {
      if (style?.id) {
        map.set(style.id, style.name || style.id);
      }
    }
    return map;
  }, [styleLibrary?.narrativeStyles]);

  // Helper to get status considering both IndexedDB and queue state
  const getEffectiveStatus = useCallback((chronicleId, chronicle) => {
    // First check queue for running/queued tasks for this chronicle
    const queueTask = queue.find(
      (item) => item.type === 'entityChronicle' &&
        item.chronicleId === chronicleId &&
        !REFINEMENT_STEPS.has(item.chronicleStep || '')
    );

    if (queueTask) {
      if (queueTask.status === 'running') {
        // Map chronicleStep to status
        switch (queueTask.chronicleStep) {
          case 'validate': return 'validating';
          case 'edit': return 'editing';
          case 'generate_v2': return 'generating';
          case 'regenerate_temperature': return 'generating';
          default: return deriveStatus(chronicle);
        }
      }
      if (queueTask.status === 'queued') {
        switch (queueTask.chronicleStep) {
          case 'edit': return 'editing';
          case 'validate': return 'validating';
          case 'generate_v2': return 'generating';
          case 'regenerate_temperature': return 'generating';
          default: return deriveStatus(chronicle);
        }
      }
    }

    // Fall back to IndexedDB-derived status
    return deriveStatus(chronicle);
  }, [queue]);

  // Lightweight nav items from Zustand store (shallow-compared, only re-renders on nav-relevant changes)
  const chronicleItems = useChronicleNavItems(getEffectiveStatus);

  const getChronicleTypeLabel = useCallback((item) => {
    if (item?.narrativeStyleName) return item.narrativeStyleName;
    if (item?.narrativeStyleId) {
      return narrativeStyleNameMap.get(item.narrativeStyleId) || item.narrativeStyleId;
    }
    return 'Unknown Type';
  }, [narrativeStyleNameMap]);

  const filteredChronicleItems = useMemo(() => {
    const query = entitySearchQuery.trim().toLowerCase();
    let items = chronicleItems;

    if (statusFilter !== 'all') {
      items = items.filter((item) => item.status === statusFilter);
    }

    if (focusFilter !== 'all') {
      items = items.filter((item) => item.focusType === focusFilter);
    }

    if (entitySearchSelectedId) {
      items = items.filter((item) => (item.selectedEntityIds || []).includes(entitySearchSelectedId));
    } else if (query) {
      items = items.filter((item) =>
        (item.roleAssignments || []).some((role) =>
          role.entityName?.toLowerCase().includes(query)
        )
      );
    }

    const getLength = (item) => item.wordCount || 0;

    const getEraOrder = (item) => typeof item.focalEraOrder === 'number' ? item.focalEraOrder : Number.MAX_SAFE_INTEGER;

    const getEraName = (item) => item.focalEraName || '';

    const sorted = [...items].sort((a, b) => {
      switch (sortMode) {
        case 'created_asc':
          return (a.createdAt || 0) - (b.createdAt || 0);
        case 'created_desc':
          return (b.createdAt || 0) - (a.createdAt || 0);
        case 'length_asc':
          return getLength(a) - getLength(b);
        case 'length_desc':
          return getLength(b) - getLength(a);
        case 'type_desc':
          return getChronicleTypeLabel(b).localeCompare(getChronicleTypeLabel(a));
        case 'era_asc': {
          const orderA = getEraOrder(a);
          const orderB = getEraOrder(b);
          if (orderA !== orderB) return orderA - orderB;
          return getEraName(a).localeCompare(getEraName(b));
        }
        case 'era_desc': {
          const orderA = getEraOrder(a);
          const orderB = getEraOrder(b);
          if (orderA !== orderB) return orderB - orderA;
          return getEraName(b).localeCompare(getEraName(a));
        }
        case 'type_asc':
        default:
          return getChronicleTypeLabel(a).localeCompare(getChronicleTypeLabel(b));
      }
    });

    return sorted;
  }, [
    chronicleItems,
    entitySearchQuery,
    entitySearchSelectedId,
    focusFilter,
    getChronicleTypeLabel,
    sortMode,
    statusFilter,
  ]);

  useEffect(() => {
    setNavVisibleCount(NAV_PAGE_SIZE);
  }, [statusFilter, focusFilter, entitySearchQuery, entitySearchSelectedId, sortMode, groupByType, simulationRunId]);

  const selectedNavIndex = useMemo(
    () => filteredChronicleItems.findIndex((item) => item.id === selectedItemId),
    [filteredChronicleItems, selectedItemId]
  );

  useEffect(() => {
    if (selectedNavIndex >= 0 && selectedNavIndex + 1 > navVisibleCount) {
      const nextCount = Math.min(
        filteredChronicleItems.length,
        Math.ceil((selectedNavIndex + 1) / NAV_PAGE_SIZE) * NAV_PAGE_SIZE
      );
      if (nextCount !== navVisibleCount) {
        setNavVisibleCount(nextCount);
      }
    }
  }, [selectedNavIndex, navVisibleCount, filteredChronicleItems.length]);

  useEffect(() => {
    if (filteredChronicleItems.length > 0 && navVisibleCount > filteredChronicleItems.length) {
      setNavVisibleCount(filteredChronicleItems.length);
    }
  }, [filteredChronicleItems.length, navVisibleCount]);

  useEffect(() => {
    const container = navListRef.current;
    const sentinel = navLoadMoreRef.current;
    if (!container || !sentinel) return;
    if (navVisibleCount >= filteredChronicleItems.length) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setNavVisibleCount((prev) =>
            Math.min(prev + NAV_PAGE_SIZE, filteredChronicleItems.length)
          );
        }
      },
      { root: container, rootMargin: '120px', threshold: 0.1 }
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [navVisibleCount, filteredChronicleItems.length]);

  const visibleChronicleItems = useMemo(() => {
    if (navVisibleCount >= filteredChronicleItems.length) return filteredChronicleItems;
    return filteredChronicleItems.slice(0, navVisibleCount);
  }, [filteredChronicleItems, navVisibleCount]);

  const groupedChronicleItems = useMemo(() => {
    if (!groupByType) return null;
    const groups = new Map();
    for (const item of visibleChronicleItems) {
      const label = getChronicleTypeLabel(item);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(item);
    }
    const labels = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));
    return labels.map((label) => ({ label, items: groups.get(label) }));
  }, [visibleChronicleItems, getChronicleTypeLabel, groupByType]);

  // Selected chronicle from store — only re-renders when THIS chronicle changes
  const selectedChronicle = useSelectedChronicle(selectedItemId);

  // Build selectedItem with derived fields for compatibility with existing callbacks/UI
  const selectedItem = useMemo(() => {
    if (!selectedChronicle) return undefined;
    const record = selectedChronicle;
    const displayName = record.title ||
      (record.roleAssignments?.length > 0
        ? record.roleAssignments.filter(r => r.isPrimary).map(r => r.entityName).join(' & ') ||
          record.roleAssignments[0]?.entityName
        : '') ||
      'Untitled Chronicle';

    return {
      ...record,
      id: record.chronicleId,
      type: 'chronicles',
      name: displayName,
      status: getEffectiveStatus(record.chronicleId, record),
      primaryCount: record.roleAssignments?.filter(r => r.isPrimary).length || 0,
      supportingCount: (record.roleAssignments?.length || 0) - (record.roleAssignments?.filter(r => r.isPrimary).length || 0),
      editVersion: record.editVersion ?? 0,
    };
  }, [selectedChronicle, getEffectiveStatus]);

  // Get the narrative style from the selected chronicle's stored seed data
  const selectedNarrativeStyle = useMemo(() => {
    if (selectedItem?.narrativeStyle) return selectedItem.narrativeStyle;
    if (!selectedItem?.narrativeStyleId) return null;
    if (stylesLoading || !styleLibrary?.narrativeStyles) return null;
    return styleLibrary.narrativeStyles.find((s) => s.id === selectedItem.narrativeStyleId);
  }, [selectedItem?.narrativeStyle, selectedItem?.narrativeStyleId, styleLibrary, stylesLoading]);

  const refinementState = useMemo(() => {
    if (!selectedItem) return null;
    const isRunning = (step) => queue.some(
      (item) => item.type === 'entityChronicle' &&
        item.chronicleId === selectedItem.chronicleId &&
        item.chronicleStep === step &&
        (item.status === 'queued' || item.status === 'running')
    );

    return {
      summary: {
        generatedAt: selectedItem.summaryGeneratedAt,
        model: selectedItem.summaryModel,
        running: isRunning('summary'),
      },
      title: {
        generatedAt: selectedItem.titleGeneratedAt,
        model: selectedItem.titleModel,
        running: isRunning('title'),
      },
      imageRefs: {
        generatedAt: selectedItem.imageRefsGeneratedAt,
        model: selectedItem.imageRefsModel,
        running: isRunning('image_refs'),
      },
      compare: {
        running: isRunning('compare'),
      },
      combine: {
        running: isRunning('combine'),
      },
      coverImageScene: {
        running: isRunning('cover_image_scene'),
      },
    };
  }, [selectedItem, queue]);

  // Clear selection if stored item no longer exists in current data
  useEffect(() => {
    if (selectedItemId && chronicleItems.length > 0 && !selectedItem) {
      console.log('[Chronicle] Stored selectedItemId not found in current items, clearing');
      setSelectedItemId(null);
    }
  }, [selectedItemId, chronicleItems, selectedItem]);

  // Generate name bank when selected chronicle's entities change
  useEffect(() => {
    if (!selectedItem?.roleAssignments || !worldData?.hardState || !worldData?.schema?.cultures) {
      return;
    }

    // Get entity IDs from role assignments
    const entityIds = selectedItem.roleAssignments.map(r => r.entityId);
    const selectedEntities = worldData.hardState.filter(e => entityIds.includes(e.id));
    const cultureIds = extractCultureIds(selectedEntities);

    if (cultureIds.length === 0) {
      setNameBank({});
      return;
    }

    // Generate names for each culture
    generateNameBank(worldData.schema.cultures, cultureIds)
      .then(bank => {
        console.log('[Chronicle] Generated name bank:', bank);
        setNameBank(bank);
      })
      .catch(e => {
        console.warn('[Chronicle] Failed to generate name bank:', e);
        setNameBank({});
      });
  }, [selectedItem?.roleAssignments, worldData?.hardState, worldData?.schema?.cultures]);

  // Build generation context for selected item
  const generationContext = useMemo(() => {
    if (!selectedItem || !worldData || !selectedNarrativeStyle) return null;

    try {
      // Validate required world context for perspective synthesis
      if (!worldContext?.toneFragments || !worldContext?.canonFactsWithMetadata) {
        console.error('World context missing toneFragments or canonFactsWithMetadata');
        return null;
      }

      const wc = {
        name: worldContext?.name || 'The World',
        description: worldContext?.description || '',
        // Required for perspective synthesis
        toneFragments: worldContext.toneFragments,
        canonFactsWithMetadata: worldContext.canonFactsWithMetadata,
        worldDynamics: worldContext.worldDynamics,
      };

      // Extract prose hints from entity guidance (if available)
      const proseHints = {};
      for (const [kind, guidance] of Object.entries(entityGuidance || {})) {
        if (guidance?.proseHint) {
          proseHints[kind] = guidance.proseHint;
        }
      }

      // Chronicles use the chronicle-first context builder
      if (selectedItem.type === 'chronicles') {
        return buildChronicleContext(
          {
            roleAssignments: selectedItem.roleAssignments || [],
            selectedEventIds: selectedItem.selectedEventIds || [],
            selectedRelationshipIds: selectedItem.selectedRelationshipIds || [],
            entrypointId: selectedItem.entrypointId,
          },
          worldData,
          wc,
          selectedNarrativeStyle,
          nameBank,
          proseHints,
          cultureIdentities?.descriptive
        );
      }
    } catch (e) {
      console.error('Failed to build generation context:', e);
    }
    return null;
  }, [selectedItem, worldData, worldContext, nameBank, entityGuidance, cultureIdentities, selectedNarrativeStyle]);

  // Handle accept chronicle - saves to IndexedDB (wiki links applied at render time in Chronicler)
  const handleAcceptChronicle = useCallback(async () => {
    if (!selectedItem) return;
    await acceptChronicle(selectedItem.chronicleId);
  }, [selectedItem, acceptChronicle]);

  const handleGenerateSummary = useCallback(() => {
    if (!selectedItem || !generationContext) return;
    generateSummary(selectedItem.chronicleId, generationContext);
  }, [selectedItem, generationContext, generateSummary]);

  const handleGenerateTitle = useCallback(() => {
    if (!selectedItem) return;
    generateTitle(selectedItem.chronicleId);
  }, [selectedItem, generateTitle]);

  const handleAcceptPendingTitle = useCallback(async (chosenTitle) => {
    if (!selectedItem) return;
    const { acceptPendingTitle } = await import('../lib/db/chronicleRepository');
    await acceptPendingTitle(selectedItem.chronicleId, chosenTitle || undefined);
    await refreshChronicle(selectedItem.chronicleId);
  }, [selectedItem, refreshChronicle]);

  const handleRejectPendingTitle = useCallback(async () => {
    if (!selectedItem) return;
    const { rejectPendingTitle } = await import('../lib/db/chronicleRepository');
    await rejectPendingTitle(selectedItem.chronicleId);
    await refreshChronicle(selectedItem.chronicleId);
  }, [selectedItem, refreshChronicle]);

  const handleGenerateImageRefs = useCallback(() => {
    if (!selectedItem || !generationContext) return;
    const primaryEntity = selectedItem.roleAssignments?.[0];

    // Build visual identities so the image refs LLM includes them in scene descriptions
    const visualIdentities = {};
    for (const entityCtx of generationContext.entities || []) {
      const entity = entities?.find((e) => e.id === entityCtx.id);
      if (entity?.enrichment?.text?.visualThesis) {
        visualIdentities[entityCtx.id] = entity.enrichment.text.visualThesis;
      }
    }

    onEnqueue([{
      entity: {
        id: primaryEntity?.entityId || selectedItem.chronicleId,
        name: primaryEntity?.entityName || selectedItem.name,
        kind: primaryEntity?.entityKind || 'chronicle',
      },
      type: 'entityChronicle',
      chronicleId: selectedItem.chronicleId,
      chronicleStep: 'image_refs',
      chronicleContext: generationContext,
      visualIdentities,
    }]);
  }, [selectedItem, generationContext, onEnqueue, entities]);

  const handleRegenerateDescription = useCallback((ref) => {
    if (!selectedItem || !generationContext) return;
    const primaryEntity = selectedItem.roleAssignments?.[0];

    // Build visual identities for involved entities
    const visualIdentities = {};
    for (const entityId of ref.involvedEntityIds || []) {
      const entity = entities?.find((e) => e.id === entityId);
      if (entity?.enrichment?.text?.visualThesis) {
        visualIdentities[entityId] = entity.enrichment.text.visualThesis;
      }
    }

    onEnqueue([{
      entity: {
        id: primaryEntity?.entityId || selectedItem.chronicleId,
        name: primaryEntity?.entityName || selectedItem.name,
        kind: primaryEntity?.entityKind || 'chronicle',
      },
      type: 'entityChronicle',
      chronicleId: selectedItem.chronicleId,
      chronicleStep: 'regenerate_scene_description',
      chronicleContext: generationContext,
      imageRefId: ref.refId,
      visualIdentities,
    }]);
  }, [selectedItem, generationContext, onEnqueue, entities]);

  // Cover image scene generation (LLM generates scene description)
  const handleGenerateCoverImageScene = useCallback(() => {
    if (!selectedItem || !generationContext) return;
    // Dispatch as a chronicle task with step 'cover_image_scene'
    const primaryEntity = selectedItem.roleAssignments?.[0];

    // Build visual identities map so the scene LLM can include them in the cast list
    const visualIdentities = {};
    for (const ra of selectedItem.roleAssignments || []) {
      const entity = entities?.find((e) => e.id === ra.entityId);
      if (entity?.enrichment?.text?.visualThesis) {
        visualIdentities[ra.entityId] = entity.enrichment.text.visualThesis;
      }
    }

    onEnqueue([
      {
        entity: {
          id: primaryEntity?.entityId || selectedItem.chronicleId,
          name: primaryEntity?.entityName || selectedItem.name,
          kind: primaryEntity?.entityKind || 'chronicle',
        },
        type: 'entityChronicle',
        chronicleId: selectedItem.chronicleId,
        chronicleStep: 'cover_image_scene',
        chronicleContext: generationContext,
        visualIdentities,
      },
    ]);
  }, [selectedItem, generationContext, onEnqueue, entities]);

  // Cover image generation (image model generates from scene description)
  const handleGenerateCoverImage = useCallback(() => {
    if (!selectedItem?.coverImage?.sceneDescription) return;

    const coverImage = selectedItem.coverImage;

    // Mark as generating
    updateChronicleCoverImageStatus(selectedItem.chronicleId, { status: 'generating' })
      .then(() => refreshChronicle(selectedItem.chronicleId));

    // Resolve user's style selections (handles random/none properly)
    const resolved = resolveStyleSelection({
      selection: chronicleStyleSelection,
      entityKind: 'chronicle',
      styleLibrary,
    });

    // Override composition with narrative-style-aware cover config
    const coverConfig = getCoverImageConfig(selectedItem.narrativeStyleId || 'epic-drama');
    const coverComposition = styleLibrary?.compositionStyles?.find((s) => s.id === coverConfig.compositionStyleId);

    const styleInfo = {
      compositionPromptFragment: coverComposition?.promptFragment || 'cinematic montage composition, overlapping character silhouettes and scene elements, layered movie-poster layout, multiple focal points at different scales, dramatic depth layering, figures and settings blending into each other, NO TEXT NO TITLES NO LETTERING',
      artisticPromptFragment: resolved.artisticStyle?.promptFragment,
      colorPalettePromptFragment: resolved.colorPalette?.promptFragment,
    };

    const prompt = buildChronicleScenePrompt(
      {
        sceneDescription: coverImage.sceneDescription,
        size: 'medium',
        chronicleTitle: selectedItem.title || selectedItem.name,
        world: worldContext ? {
          name: worldContext.name,
          description: worldContext.description,
          speciesConstraint: worldContext.speciesConstraint,
        } : undefined,
      },
      styleInfo
    );

    // Enqueue the image generation task
    onEnqueue([
      {
        entity: {
          id: selectedItem.chronicleId,
          name: selectedItem.name || 'Chronicle',
          kind: 'chronicle',
        },
        type: 'image',
        prompt,
        chronicleId: selectedItem.chronicleId,
        imageRefId: '__cover_image__',
        sceneDescription: coverImage.sceneDescription,
        imageType: 'chronicle',
        imageSize: chronicleImageSize,
        imageQuality: chronicleImageQuality,
      },
    ]);
  }, [selectedItem, styleLibrary, chronicleStyleSelection, worldContext, onEnqueue, refreshChronicle, chronicleImageSize, chronicleImageQuality]);

  const handleRegenerateWithTemperature = useCallback((temperature) => {
    if (!selectedItem) return;
    const clamped = Math.min(1, Math.max(0, Number(temperature)));
    regenerateWithTemperature(selectedItem.chronicleId, clamped);
  }, [selectedItem, regenerateWithTemperature]);

  const handleCompareVersions = useCallback(() => {
    if (!selectedItem) return;
    compareVersions(selectedItem.chronicleId);
  }, [selectedItem, compareVersions]);

  const handleCombineVersions = useCallback(() => {
    if (!selectedItem) return;
    combineVersions(selectedItem.chronicleId);
  }, [selectedItem, combineVersions]);

  // Handle regenerate (delete and go back to start screen) - uses restart modal
  const handleRegenerate = useCallback(() => {
    if (!selectedItem) return;
    // Use the same restart modal - use chronicleId for chronicle-first
    setPendingRestartChronicleId(selectedItem.chronicleId);
    setShowRestartModal(true);
  }, [selectedItem]);

  // Handle restart with confirmation modal (for completed chronicles)
  const handleRestartClick = useCallback((chronicleId) => {
    setPendingRestartChronicleId(chronicleId);
    setShowRestartModal(true);
  }, []);

  const handleRestartConfirm = useCallback(async () => {
    if (pendingRestartChronicleId) {
      // Get the chronicle record to extract seed before deleting
      const chronicle = useChronicleStore.getState().chronicles[pendingRestartChronicleId];
      if (chronicle) {
        // Extract seed from the chronicle record
        const seed = {
          narrativeStyleId: chronicle.narrativeStyleId,
          narrativeStyle: chronicle.narrativeStyle,
          entrypointId: chronicle.entrypointId,
          roleAssignments: chronicle.roleAssignments || [],
          lens: chronicle.lens,
          selectedEventIds: chronicle.selectedEventIds || [],
          selectedRelationshipIds: chronicle.selectedRelationshipIds || [],
        };
        setWizardSeed(seed);
      }

      // Delete the chronicle
      await restartChronicle(pendingRestartChronicleId);

      // Open wizard with seed
      setShowWizard(true);
    }
    setShowRestartModal(false);
    setPendingRestartChronicleId(null);
  }, [pendingRestartChronicleId, restartChronicle]);

  const handleRestartCancel = useCallback(() => {
    setShowRestartModal(false);
    setPendingRestartChronicleId(null);
  }, []);

  // Prepare wizard data
  const wizardEntities = useMemo(() => {
    if (!entities) return [];
    return entities
      .filter((e) => e.kind !== 'era')
      .map((e) => ({
        id: e.id,
        name: e.name,
        kind: e.kind,
        subtype: e.subtype,
        prominence: e.prominence,
        culture: e.culture,
        status: e.status,
        tags: e.tags || {},
        eraId: e.eraId,
        summary: e.summary,
        description: e.description,
        aliases: e.enrichment?.text?.aliases || [],
        coordinates: e.coordinates,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      }));
  }, [entities]);

  const wizardRelationships = useMemo(() => {
    if (!worldData?.relationships) return [];
    return worldData.relationships.map((r) => {
      const src = entityMap.get(r.src);
      const dst = entityMap.get(r.dst);
      return {
        src: r.src,
        dst: r.dst,
        kind: r.kind,
        strength: r.strength,
        sourceName: src?.name || r.src,
        sourceKind: src?.kind || 'unknown',
        targetName: dst?.name || r.dst,
        targetKind: dst?.kind || 'unknown',
      };
    });
  }, [worldData, entityMap]);

  const wizardEvents = useMemo(() => {
    if (!worldData?.narrativeHistory) return [];
    const events = worldData.narrativeHistory.map((e) => ({
      id: e.id,
      tick: e.tick,
      era: e.era,
      eventKind: e.eventKind,
      significance: e.significance,
      // NarrativeEvent.description is the natural language summary (used as headline)
      headline: e.description,
      description: e.description,
      subjectId: e.subject?.id,
      subjectName: e.subject?.name,
      objectId: e.object?.id,
      objectName: e.object?.name,
      stateChanges: e.stateChanges,
      narrativeTags: e.narrativeTags,
    }));

    return events;
  }, [worldData]);

  // Build era temporal info from era entities
  // NOTE: Era boundaries come directly from entity.temporal.startTick/endTick.
  // Do NOT compute boundaries from events - this causes overlap bugs and is incorrect.
  // Eras define their own authoritative tick ranges.
  const wizardEras = useMemo(() => {
    if (!entities) return [];

    // Get era entities that have temporal data
    const eraEntities = entities.filter((e) => e.kind === 'era' && e.temporal);
    if (eraEntities.length === 0) return [];

    // Sort by startTick to determine order
    const sortedEras = [...eraEntities].sort(
      (a, b) => a.temporal.startTick - b.temporal.startTick
    );

    // Map directly from era entity temporal data - no computation
    return sortedEras.map((era, index) => {
      const startTick = era.temporal.startTick;
      // TODO: Get actual max tick from simulation config or world data
      // Last era may not have endTick defined yet (ongoing era)
      const endTick = era.temporal.endTick ?? 150;
      const eraId = era.eraId || era.id;
      return {
        id: eraId,
        name: era.name,
        summary: era.summary || '',
        order: index,
        startTick,
        endTick,
        duration: endTick - startTick,
      };
    });
  }, [entities]);

  // Handle wizard completion
  const handleWizardGenerate = useCallback(async (wizardConfig) => {
    if (!worldData || !worldContext) {
      console.error('[Chronicle Wizard] Missing worldData or worldContext');
      return;
    }

    // Get the narrative style from library
    const narrativeStyle = wizardConfig.narrativeStyle || styleLibrary?.narrativeStyles?.find(
      (s) => s.id === wizardConfig.narrativeStyleId
    );
    if (!narrativeStyle) {
      console.error('[Chronicle Wizard] Narrative style not found:', wizardConfig.narrativeStyleId);
      return;
    }

    // Generate unique chronicle ID (chronicle-first: ID is independent of entities)
    const chronicleId = generateChronicleId();

    // Build chronicle selections (chronicle-first format)
    const selections = {
      roleAssignments: wizardConfig.roleAssignments,
      lens: wizardConfig.lens,
      selectedEventIds: wizardConfig.selectedEventIds,
      selectedRelationshipIds: wizardConfig.selectedRelationshipIds,
      entrypointId: wizardConfig.entryPointId, // Mechanical only, not identity
    };

    // Build world context (requires structured fields for perspective synthesis)
    if (!worldContext?.toneFragments || !worldContext?.canonFactsWithMetadata) {
      console.error('[Chronicle Wizard] Missing toneFragments or canonFactsWithMetadata');
      return;
    }
    const wc = {
      name: worldContext?.name || 'The World',
      description: worldContext?.description || '',
      toneFragments: worldContext.toneFragments,
      canonFactsWithMetadata: worldContext.canonFactsWithMetadata,
      worldDynamics: worldContext.worldDynamics,
    };

    // Generate name bank for invented characters
    // Must be done here (not in useEffect) because wizard creates new chronicles
    const entityIds = wizardConfig.roleAssignments.map(r => r.entityId);
    const selectedEntities = worldData.hardState?.filter(e => entityIds.includes(e.id)) || [];
    const cultureIds = extractCultureIds(selectedEntities);
    let wizardNameBank = {};
    if (cultureIds.length > 0 && worldData.schema?.cultures) {
      try {
        wizardNameBank = await generateNameBank(worldData.schema.cultures, cultureIds);
        console.log('[Chronicle Wizard] Generated name bank:', wizardNameBank);
      } catch (e) {
        console.warn('[Chronicle Wizard] Failed to generate name bank:', e);
      }
    }

    // Extract prose hints from entity guidance (if available)
    const proseHints = {};
    for (const [kind, guidance] of Object.entries(entityGuidance || {})) {
      if (guidance?.proseHint) {
        proseHints[kind] = guidance.proseHint;
      }
    }

    // Build the chronicle generation context (chronicle-first)
    const context = buildChronicleContext(
      selections,
      worldData,
      wc,
      narrativeStyle,
      wizardNameBank,
      proseHints,
      cultureIdentities?.descriptive,
      wizardConfig.temporalContext
    );

    // Derive chronicle metadata from role assignments
    const title = deriveTitleFromRoles(wizardConfig.roleAssignments);

    // Build selectedEntityIds including lens entity if present
    const selectedEntityIds = wizardConfig.roleAssignments.map(r => r.entityId);
    if (wizardConfig.lens && !selectedEntityIds.includes(wizardConfig.lens.entityId)) {
      selectedEntityIds.push(wizardConfig.lens.entityId);
    }

    // Chronicle metadata for storage (passed to generation functions)
    const chronicleMetadata = {
      chronicleId,
      title,
      format: narrativeStyle.format,
      roleAssignments: wizardConfig.roleAssignments,
      lens: wizardConfig.lens,
      narrativeStyleId: wizardConfig.narrativeStyleId,
      narrativeStyle,
      selectedEntityIds,
      selectedEventIds: wizardConfig.selectedEventIds,
      selectedRelationshipIds: wizardConfig.selectedRelationshipIds,
      entrypointId: wizardConfig.entryPointId,
      temporalContext: wizardConfig.temporalContext,
    };

    console.log('[Chronicle Wizard] Generated chronicle:', {
      chronicleId,
      title,
      roleCount: wizardConfig.roleAssignments.length,
      events: wizardConfig.selectedEventIds.length,
      relationships: wizardConfig.selectedRelationshipIds.length,
    });

    // Create shell record in IndexedDB BEFORE generation
    // This provides immediate UI feedback while generation is in progress
    try {
      await createChronicleShell(chronicleId, {
        projectId: simulationRunId ? simulationRunId.split('_')[0] : 'unknown',
        simulationRunId: simulationRunId || 'unknown',
        model: 'pending', // Will be updated by worker
        title,
        format: narrativeStyle.format,
        narrativeStyleId: wizardConfig.narrativeStyleId,
        narrativeStyle,
        roleAssignments: wizardConfig.roleAssignments,
        lens: wizardConfig.lens,
        selectedEntityIds,
        selectedEventIds: wizardConfig.selectedEventIds,
        selectedRelationshipIds: wizardConfig.selectedRelationshipIds,
        entrypointId: wizardConfig.entryPointId,
        temporalContext: wizardConfig.temporalContext,
      });
      // Refresh to show the new shell record
      await refresh();
    } catch (err) {
      console.error('[Chronicle Wizard] Failed to create shell record:', err);
    }

    // Generate the chronicle
    generateV2(chronicleId, context, chronicleMetadata, wizardConfig.temperatureOverride);

    // Select the newly generated chronicle by its chronicleId
    setSelectedItemId(chronicleId);
    // Close the wizard
    setShowWizard(false);
  }, [worldData, worldContext, styleLibrary, generateV2, simulationRunId, refresh, entityGuidance, cultureIdentities]);

  // Handle generating a chronicle image
  const handleGenerateChronicleImage = useCallback(
    (ref, prompt, _styleInfo) => {
      if (!selectedItem?.chronicleId) return;

      // First, update the image ref status to 'generating'
      updateChronicleImageRef(selectedItem.chronicleId, ref.refId, {
        status: 'generating',
      }).then(() => refreshChronicle(selectedItem.chronicleId));

      // Use the chronicleId as the entityId for storage - chronicle images belong to chronicles, not entities
      const chronicleEntity = {
        id: selectedItem.chronicleId,
        name: selectedItem.name || 'Chronicle',
        kind: 'chronicle',
      };

      // Enqueue the image generation task
      onEnqueue([
        {
          entity: chronicleEntity,
          type: 'image',
          prompt,
          // Chronicle image specific fields
          chronicleId: selectedItem.chronicleId,
          imageRefId: ref.refId,
          sceneDescription: ref.sceneDescription,
          imageType: 'chronicle',
          imageSize: chronicleImageSize,
          imageQuality: chronicleImageQuality,
        },
      ]);
    },
    [selectedItem, onEnqueue, refreshChronicle, chronicleImageSize, chronicleImageQuality]
  );

  const handleResetChronicleImage = useCallback(
    (ref) => {
      if (!selectedItem?.chronicleId) return;
      updateChronicleImageRef(selectedItem.chronicleId, ref.refId, {
        status: 'pending',
        error: '',
        generatedImageId: '',
      }).then(() => refreshChronicle(selectedItem.chronicleId));
    },
    [selectedItem, refreshChronicle]
  );

  const handleUpdateChronicleAnchorText = useCallback(
    (ref, anchorText) => {
      if (!selectedItem?.chronicleId) return;
      updateChronicleImageRef(selectedItem.chronicleId, ref.refId, {
        anchorText,
      }).then(() => refreshChronicle(selectedItem.chronicleId));
    },
    [selectedItem, refreshChronicle]
  );

  const handleUpdateChronicleImageSize = useCallback(
    (ref, size) => {
      if (!selectedItem?.chronicleId) return;
      const updates = { size };
      if (size === 'full-width') {
        updates.justification = null;
      }
      updateChronicleImageRef(selectedItem.chronicleId, ref.refId, updates).then(() => refreshChronicle(selectedItem.chronicleId));
    },
    [selectedItem, refreshChronicle]
  );

  const handleUpdateChronicleImageJustification = useCallback(
    (ref, justification) => {
      if (!selectedItem?.chronicleId) return;
      updateChronicleImageRef(selectedItem.chronicleId, ref.refId, {
        justification,
      }).then(() => refreshChronicle(selectedItem.chronicleId));
    },
    [selectedItem, refreshChronicle]
  );

  const handleUpdateChronicleTemporalContext = useCallback(
    (focalEraId) => {
      if (!selectedItem?.chronicleId || !focalEraId) return;

      const availableEras = wizardEras.length > 0
        ? wizardEras
        : (selectedItem.temporalContext?.allEras || []);
      if (availableEras.length === 0) return;

      const focalEra = availableEras.find((era) => era.id === focalEraId);
      if (!focalEra) return;

      const selectedEventIdSet = new Set(selectedItem.selectedEventIds || []);
      const selectedEvents = wizardEvents.filter((event) => selectedEventIdSet.has(event.id));

      const entrypointEntity = selectedItem.entrypointId
        ? entities?.find((entity) => entity.id === selectedItem.entrypointId)
        : undefined;
      const entryPoint = entrypointEntity
        ? { createdAt: entrypointEntity.createdAt ?? 0 }
        : undefined;

      let nextContext = availableEras.length > 0
        ? computeTemporalContext(selectedEvents, availableEras, entryPoint)
        : selectedItem.temporalContext;

      if (!nextContext) {
        nextContext = {
          focalEra,
          allEras: availableEras,
          chronicleTickRange: [0, 0],
          temporalScope: 'moment',
          isMultiEra: false,
          touchedEraIds: [],
          temporalDescription: buildTemporalDescription(focalEra, [0, 0], 'moment', false, 1),
        };
      }

      nextContext = {
        ...nextContext,
        focalEra,
        allEras: availableEras,
        temporalDescription: buildTemporalDescription(
          focalEra,
          nextContext.chronicleTickRange,
          nextContext.temporalScope,
          nextContext.isMultiEra,
          nextContext.touchedEraIds?.length || 0
        ),
      };

      updateChronicleTemporalContext(selectedItem.chronicleId, nextContext).then(() => refreshChronicle(selectedItem.chronicleId));
    },
    [selectedItem, wizardEras, wizardEvents, entities, refreshChronicle]
  );

  const handleUpdateChronicleActiveVersion = useCallback(
    (versionId) => {
      if (!selectedItem?.chronicleId || !versionId) return;
      updateChronicleActiveVersion(selectedItem.chronicleId, versionId).then(() => refreshChronicle(selectedItem.chronicleId));
    },
    [selectedItem, refreshChronicle]
  );

  const handleUpdateCombineInstructions = useCallback(
    (instructions) => {
      if (!selectedItem?.chronicleId) return;
      updateChronicleCombineInstructions(selectedItem.chronicleId, instructions || undefined).then(() => refreshChronicle(selectedItem.chronicleId));
    },
    [selectedItem, refreshChronicle]
  );

  const handleUnpublish = useCallback(() => {
    if (!selectedItem?.chronicleId) return;
    unpublishChronicle(selectedItem.chronicleId).then(() => refreshChronicle(selectedItem.chronicleId));
  }, [selectedItem, refreshChronicle]);

  // Handle export of completed chronicle
  // Uses ONLY stored data from the chronicle record - no reconstruction
  const handleExport = useCallback(() => {
    if (!selectedItem) {
      console.error('[Chronicle] Cannot export: no chronicle selected');
      return;
    }

    // Get the full chronicle record from storage
    const chronicle = useChronicleStore.getState().chronicles[selectedItem.chronicleId];
    if (!chronicle) {
      console.error('[Chronicle] Cannot export: chronicle not found in storage');
      return;
    }

    downloadChronicleExport(chronicle);
  }, [selectedItem]);

  // Track completed chronicle image tasks and update chronicle records
  const processedChronicleImageTasksRef = useRef(new Set());
  useEffect(() => {
    for (const task of queue) {
      // Look for completed chronicle image tasks that we haven't processed yet
      if (
        task.type === 'image' &&
        task.imageType === 'chronicle' &&
        task.status === 'complete' &&
        task.chronicleId &&
        task.imageRefId &&
        task.result?.imageId &&
        !processedChronicleImageTasksRef.current.has(task.id)
      ) {
        // Mark as processed to avoid duplicate updates
        processedChronicleImageTasksRef.current.add(task.id);

        if (task.imageRefId === '__cover_image__') {
          // Update cover image status
          updateChronicleCoverImageStatus(task.chronicleId, {
            status: 'complete',
            generatedImageId: task.result.imageId,
          }).then(() => refreshChronicle(task.chronicleId));
        } else {
          // Update the chronicle's image ref with the generated image ID
          updateChronicleImageRef(task.chronicleId, task.imageRefId, {
            status: 'complete',
            generatedImageId: task.result.imageId,
          }).then(() => refreshChronicle(task.chronicleId));
        }
      }

      // Also handle failed chronicle image tasks
      if (
        task.type === 'image' &&
        task.imageType === 'chronicle' &&
        task.status === 'error' &&
        task.chronicleId &&
        task.imageRefId &&
        !processedChronicleImageTasksRef.current.has(task.id)
      ) {
        processedChronicleImageTasksRef.current.add(task.id);

        if (task.imageRefId === '__cover_image__') {
          updateChronicleCoverImageStatus(task.chronicleId, {
            status: 'failed',
            error: task.error || 'Image generation failed',
          }).then(() => refreshChronicle(task.chronicleId));
        } else {
          updateChronicleImageRef(task.chronicleId, task.imageRefId, {
            status: 'failed',
            error: task.error || 'Image generation failed',
          }).then(() => refreshChronicle(task.chronicleId));
        }
      }
    }
  }, [queue, refreshChronicle]);

  // Calculate stats
  const stats = useMemo(() => {
    const byStatus = {
      not_started: 0,
      planning: 0,
      plan_ready: 0,
      expanding: 0,
      sections_ready: 0,
      assembling: 0,
      assembly_ready: 0,
      editing: 0,
      validating: 0,
      validation_ready: 0,
      failed: 0,
      complete: 0,
    };
    for (const item of chronicleItems) {
      byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    }
    return byStatus;
  }, [chronicleItems]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Chronicles</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Generate long-form narrative content
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {stats.complete} / {chronicleItems.length} complete
            </span>
            {autoBackportQueue ? (
              <button
                onClick={onCancelAutoBackport}
                className="illuminator-button"
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                Backporting {autoBackportQueue.total - autoBackportQueue.ids.length + 1}/{autoBackportQueue.total}
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  ({autoBackportQueue.ids.length - 1} left)
                </span>
                <span style={{ fontSize: '11px', color: 'var(--accent-color)' }}>cancel</span>
              </button>
            ) : (
              <button
                onClick={onStartAutoBackport}
                className="illuminator-button"
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                }}
                title="Backport lore from all published chronicles to cast entities (auto-accept)"
              >
                Backport All
              </button>
            )}
            <button
              onClick={() => setShowWizard(true)}
              disabled={!styleLibrary || !entities?.length}
              className="illuminator-button illuminator-button-primary"
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{ fontSize: '14px' }}>✨</span>
              New Chronicle
            </button>
          </div>
        </div>
      </div>

      {/* Sort / Filter / Group Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          padding: '10px 16px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-primary)',
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <input
            type="checkbox"
            checked={groupByType}
            onChange={(e) => setGroupByType(e.target.checked)}
          />
          Group by type
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sort:</span>
          <select
            className="illuminator-select"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            style={{ width: 'auto', minWidth: '150px', fontSize: '12px', padding: '4px 6px' }}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Status:</span>
          <select
            className="illuminator-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 'auto', minWidth: '140px', fontSize: '12px', padding: '4px 6px' }}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Focus:</span>
          <select
            className="illuminator-select"
            value={focusFilter}
            onChange={(e) => setFocusFilter(e.target.value)}
            style={{ width: 'auto', minWidth: '120px', fontSize: '12px', padding: '4px 6px' }}
          >
            {FOCUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div style={{ position: 'relative', minWidth: '220px', flex: 1 }}>
          <input
            className="illuminator-input"
            placeholder="Search cast by entity..."
            value={entitySearchQuery}
            onChange={(e) => {
              setEntitySearchQuery(e.target.value);
              setEntitySearchSelectedId(null);
            }}
            onFocus={() => setShowEntitySuggestions(true)}
            onBlur={() => setTimeout(() => setShowEntitySuggestions(false), 100)}
            style={{ width: '100%', fontSize: '12px', padding: '6px 8px' }}
          />
          {showEntitySuggestions && entitySuggestions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                zIndex: 10,
                maxHeight: '180px',
                overflowY: 'auto',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              }}
            >
              {entitySuggestions.map((entity) => (
                <div
                  key={entity.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setEntitySearchQuery(entity.name || '');
                    setEntitySearchSelectedId(entity.id);
                    setShowEntitySuggestions(false);
                  }}
                  style={{
                    padding: '6px 10px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span style={{ color: 'var(--text-primary)' }}>{entity.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{entity.kind}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left panel: Item list */}
        <div
          ref={navListRef}
          style={{
            width: '300px',
            borderRight: '1px solid var(--border-color)',
            overflow: 'auto',
            padding: '16px',
          }}
        >
          {filteredChronicleItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '14px' }}>No chronicles match your filters</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                Adjust filters or clear search to see more.
              </div>
            </div>
          ) : groupByType && groupedChronicleItems ? (
            groupedChronicleItems.map((group) => (
              <div key={group.label} style={{ marginBottom: '12px' }}>
                <div
                  style={{
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--text-muted)',
                    marginBottom: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>{group.label}</span>
                  <span style={{ fontSize: '10px' }}>{group.items.length}</span>
                </div>
                {group.items.map((item) => (
                  <ChronicleItemCard
                    key={item.id}
                    item={item}
                    isSelected={item.id === selectedItemId}
                    onClick={() => setSelectedItemId(item.id)}
                  />
                ))}
              </div>
            ))
          ) : (
            visibleChronicleItems.map((item) => (
              <ChronicleItemCard
                key={item.id}
                item={item}
                isSelected={item.id === selectedItemId}
                onClick={() => setSelectedItemId(item.id)}
              />
            ))
          )}
          {navVisibleCount < filteredChronicleItems.length && (
            <div
              ref={navLoadMoreRef}
              style={{
                padding: '8px',
                textAlign: 'center',
                fontSize: '11px',
                color: 'var(--text-muted)',
              }}
            >
              Loading more...
            </div>
          )}
        </div>

        {/* Right panel: Selected item detail */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {!selectedItem ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-muted)',
              }}
            >
              Select an item to begin generation
            </div>
          ) : (
            <>
              {/* Pipeline stage content */}
              {/* Not started = generation failed before producing content */}
              {selectedItem.status === 'not_started' && (
                <div style={{ padding: '24px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px' }}>
                  <h3 style={{ margin: '0 0 8px 0', color: '#ef4444' }}>Generation Failed</h3>
                  <p style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)' }}>
                    {selectedItem.failureReason || 'Chronicle generation failed before producing content.'}
                  </p>
                  <button
                    onClick={handleRegenerate}
                    className="illuminator-button illuminator-button-primary"
                    style={{ padding: '10px 18px', fontSize: '13px' }}
                  >
                    Delete &amp; Restart
                  </button>
                </div>
              )}

              {/* In-progress states - show spinner */}
              {(selectedItem.status === 'validating' ||
                selectedItem.status === 'editing' ||
                selectedItem.status === 'generating') && (
                <div style={{ textAlign: 'center', padding: '48px' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      margin: '0 auto 16px',
                      border: '4px solid var(--bg-tertiary)',
                      borderTopColor: 'var(--accent-primary)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                  <h3 style={{ margin: '0 0 8px 0' }}>
                    {selectedItem.status === 'validating' && 'Validating Cohesion...'}
                    {selectedItem.status === 'editing' && 'Applying Suggestions...'}
                    {selectedItem.status === 'generating' && 'Generating Chronicle...'}
                  </h3>
                  <div style={{ color: 'var(--text-muted)' }}>
                    <p>Generation in progress. This typically takes 30-60 seconds.</p>
                  </div>
                  <button
                    onClick={() => cancelChronicle(selectedItem.chronicleId)}
                    className="illuminator-button"
                    style={{ marginTop: '16px', padding: '8px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {selectedItem.status === 'failed' && (
                <div style={{ padding: '24px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px' }}>
                  <h3 style={{ margin: '0 0 8px 0', color: '#ef4444' }}>Generation Failed</h3>
                  <p style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)' }}>
                    {selectedItem.failureReason || 'Chronicle generation failed. Please regenerate to try again.'}
                  </p>
                  <button
                    onClick={handleRegenerate}
                    className="illuminator-button illuminator-button-primary"
                    style={{ padding: '10px 18px', fontSize: '13px' }}
                  >
                    Regenerate
                  </button>
                </div>
              )}

              {/* Review states - assembly_ready, complete */}
              {(selectedItem.status === 'assembly_ready' ||
                selectedItem.status === 'complete') && (
                <ChronicleReviewPanel
                  item={selectedItem}
                  onAddImages={handleGenerateImageRefs}
                  onAccept={handleAcceptChronicle}
                  onRegenerate={handleRegenerate}
                  onGenerateSummary={handleGenerateSummary}
                  onGenerateTitle={handleGenerateTitle}
                  onAcceptPendingTitle={handleAcceptPendingTitle}
                  onRejectPendingTitle={handleRejectPendingTitle}
                  onGenerateImageRefs={handleGenerateImageRefs}
                  onGenerateCoverImageScene={handleGenerateCoverImageScene}
                  onGenerateCoverImage={handleGenerateCoverImage}
                  styleSelection={chronicleStyleSelection}
                  imageSize={chronicleImageSize}
                  imageQuality={chronicleImageQuality}
                  imageModel={imageModel}
                  imageGenSettings={imageGenSettings}
                  onOpenImageSettings={onOpenImageSettings}
                  onRegenerateWithTemperature={handleRegenerateWithTemperature}
                  onCompareVersions={handleCompareVersions}
                  onCombineVersions={handleCombineVersions}
                  onGenerateChronicleImage={handleGenerateChronicleImage}
                  onResetChronicleImage={handleResetChronicleImage}
                  onRegenerateDescription={handleRegenerateDescription}
                  onUpdateChronicleAnchorText={handleUpdateChronicleAnchorText}
                  onUpdateChronicleImageSize={handleUpdateChronicleImageSize}
                  onUpdateChronicleImageJustification={handleUpdateChronicleImageJustification}
                  onUpdateChronicleTemporalContext={handleUpdateChronicleTemporalContext}
                  onUpdateChronicleActiveVersion={handleUpdateChronicleActiveVersion}
                  onUpdateCombineInstructions={handleUpdateCombineInstructions}
                  onUnpublish={handleUnpublish}
                  onExport={handleExport}
                  onBackportLore={onBackportLore ? () => onBackportLore(selectedItem.chronicleId) : undefined}
                  onHistorianReview={onHistorianReview && historianConfigured ? (tone) => onHistorianReview(selectedItem.chronicleId, tone) : undefined}
                  isHistorianActive={isHistorianActive}
                  onUpdateHistorianNote={onUpdateHistorianNote}
                  isGenerating={isGenerating}
                  refinements={refinementState}
                  entities={entities}
                  styleLibrary={styleLibrary}
                  cultures={worldData?.schema?.cultures}
                  entityGuidance={entityGuidance}
                  cultureIdentities={cultureIdentities}
                  worldContext={worldContext}
                  eras={wizardEras}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Restart confirmation modal */}
      {showRestartModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={handleRestartCancel}
        >
          <div
            style={{
              background: 'var(--bg-primary)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>Restart Chronicle?</h3>
            <p style={{ margin: '0 0 20px 0', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
              This will delete the current chronicle and open the wizard with the same settings.
              You can modify the settings before regenerating.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleRestartCancel}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRestartConfirm}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Delete & Restart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chronicle Wizard Modal */}
      <ChronicleWizard
        isOpen={showWizard}
        onClose={() => {
          setShowWizard(false);
          setWizardSeed(null); // Clear seed after close
        }}
        onGenerate={handleWizardGenerate}
        narrativeStyles={styleLibrary?.narrativeStyles || []}
        entities={wizardEntities}
        relationships={wizardRelationships}
        events={wizardEvents}
        entityKinds={worldData?.schema?.entityKinds || []}
        eras={wizardEras}
        initialSeed={wizardSeed}
        simulationRunId={simulationRunId}
      />

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
