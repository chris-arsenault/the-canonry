/**
 * ChroniclePanel - Narrative generation interface
 *
 * Provides UI for generating long-form narrative content via single-shot LLM generation.
 * Includes wizard for entity/event selection and style configuration.
 *
 * PROP CHAIN: ChroniclePanel → ChronicleReviewPanel → ChronicleWorkspace
 * When adding/changing props, all three files must be updated in concert:
 *   - ChroniclePanel.jsx (this file) — creates callbacks, passes to ChronicleReviewPanel
 *   - ChronicleReviewPanel.jsx — destructures and forwards to ChronicleWorkspace
 *   - chronicle-workspace/ChronicleWorkspace.jsx — receives and distributes to tabs
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useEntityNavList, useEntityNavItems } from '../lib/db/entitySelectors';
import { getEntitiesForRun, resetEntitiesToPreBackportState } from '../lib/db/entityRepository';
import { useRelationships } from '../lib/db/relationshipSelectors';
import { useNarrativeEvents } from '../lib/db/narrativeEventSelectors';
import ChronicleReviewPanel from './ChronicleReviewPanel';
import { ChronicleWizard } from './ChronicleWizard';
import { buildChronicleContext, buildEventHeadline } from '../lib/chronicleContextBuilder';
import { generateNameBank, extractCultureIds } from '../lib/chronicle/nameBank';
import { deriveStatus } from '../hooks/useChronicleGeneration';
import { useChronicleStore } from '../lib/db/chronicleStore';
import { useChronicleNavItems, useSelectedChronicle } from '../lib/db/chronicleSelectors';
import { useChronicleActions } from '../hooks/useChronicleActions';
import { buildChronicleScenePrompt } from '../lib/promptBuilders';
import { resolveStyleSelection } from './StyleSelector';
import { getCoverImageConfig } from '../lib/coverImageStyles';
import { computeTemporalContext } from '../lib/chronicle/selectionWizard';
import ChronologyModal from './ChronologyModal';
import EraNarrativeModal from './EraNarrativeModal';
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
  resetAllBackportFlags,
  reconcileBackportStatusFromEntities,
  deleteChronicleVersion,
  applyImageRefSelections,
  getChronicle,
  updateChronicleTertiaryCast,
  updateChronicleAssignedTone,
  getChroniclesForSimulation,
  updateChronicleHistorianPrep,
} from '../lib/db/chronicleRepository';
import { findEntityMentions } from '../lib/wikiLinkService';
import { downloadChronicleExport, downloadBulkToneReviewExport, downloadBulkAnnotationReviewExport } from '../lib/chronicleExport';
import { getCallConfig } from '../lib/llmModelSettings';
import { useFactCoverage } from '../hooks/useFactCoverage';
import BulkFactCoverageModal from './BulkFactCoverageModal';
import { useToneRanking } from '../hooks/useToneRanking';
import { useBulkChronicleAnnotationStore } from '../lib/db/bulkChronicleAnnotationStore';
import { useInterleavedAnnotationStore } from '../lib/db/interleavedAnnotationStore';
import { useEntityStore } from '../lib/db/entityStore';
import { annotateEntityNames } from '../lib/annotateEntityNames';
import { getEraNarrativesForSimulation } from '../lib/db/eraNarrativeRepository';
import { useIlluminatorModals } from '../lib/db/modalStore';
import { buildEraNarrativeNavItem } from '../lib/db/eraNarrativeNav';
import EraNarrativeViewer from './EraNarrativeViewer';
import BulkEraNarrativeModal from './BulkEraNarrativeModal';
import { useBulkEraNarrativeStore } from '../lib/db/bulkEraNarrativeStore';

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

    // Lore backported (per-entity progress)
    if (item.backportDone > 0) {
      const allDone = item.backportDone === item.backportTotal;
      syms.push({
        symbol: '\u21C4',
        title: `Backport: ${item.backportDone}/${item.backportTotal} entities`,
        color: allDone ? '#10b981' : '#f59e0b',
      });
    }

    // Historian notes
    if (item.historianNoteCount > 0) {
      syms.push({ symbol: '\u2020', title: 'Historian notes', color: '#8b7355' });
    }

    // Narrative lens
    if (item.lens) {
      syms.push({ symbol: '\u25C8', title: `Lens: ${item.lens.entityName}`, color: '#8b5cf6' });
    }

    // Temporal alignment check
    if (item.hasTemporalNarrative) {
      syms.push({
        symbol: '\u29D6',
        title: item.hasTemporalCheck ? 'Temporal alignment checked' : 'Temporal narrative (no alignment check)',
        color: item.hasTemporalCheck ? '#f59e0b' : 'var(--text-muted)',
      });
    }

    // Historian prep
    if (item.hasHistorianPrep) {
      syms.push({ symbol: '\u270E', title: 'Historian prep brief', color: '#8b7355' });
    }

    // Assigned tone
    if (item.assignedTone) {
      const toneSymbols = { witty: '\u2736', weary: '\u25CB', forensic: '\u25C8', elegiac: '\u25C7', cantankerous: '\u266F' };
      const toneLabels = { witty: 'Witty', weary: 'Weary', forensic: 'Forensic', elegiac: 'Elegiac', cantankerous: 'Cantankerous' };
      syms.push({
        symbol: toneSymbols[item.assignedTone] || '?',
        title: `Tone: ${toneLabels[item.assignedTone] || item.assignedTone}`,
        color: '#b8860b',
      });
    }

    return syms;
  }, [item.focusType, item.primaryCount, item.perspectiveSynthesis, item.combineInstructions, item.coverImageComplete, item.backportDone, item.backportTotal, item.historianNoteCount, item.lens, item.hasTemporalNarrative, item.hasTemporalCheck, item.hasHistorianPrep, item.assignedTone]);

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

      {/* Subtitle: era year + narrative style + numeric counts */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {item.eraYear != null && (
            <span
              style={{ color: '#8b7355', fontWeight: 500, fontStyle: 'normal' }}
              title={`Year ${item.eraYear}${item.focalEraStartTick != null ? ` (era-relative: Y${item.eraYear - item.focalEraStartTick + 1})` : ''}`}
            >
              {'\u231B'} Y{item.focalEraStartTick != null ? item.eraYear - item.focalEraStartTick + 1 : item.eraYear}
            </span>
          )}
          {styleName && <span style={{ fontStyle: 'italic' }}>{styleName}</span>}
        </span>
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

function EraNarrativeItemCard({ item, isSelected, onClick }) {
  const statusColors = {
    complete: '#10b981',
    step_complete: '#f59e0b',
    generating: '#3b82f6',
    pending: 'var(--text-muted)',
    failed: '#ef4444',
    cancelled: 'var(--text-muted)',
  };

  const inlineSymbols = useMemo(() => {
    const syms = [];
    syms.push({ symbol: '\u2756', title: 'Era narrative', color: '#d97706' });
    if (item.hasThesis) {
      syms.push({ symbol: '\u2261', title: 'Thesis identified', color: '#8b7355' });
    }
    if (item.threadCount > 0) {
      syms.push({ symbol: `\u2630`, title: `${item.threadCount} threads`, color: '#6366f1' });
    }
    return syms;
  }, [item.hasThesis, item.threadCount]);

  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 12px',
        background: isSelected ? 'var(--bg-tertiary)' : 'transparent',
        borderTop: isSelected ? '1px solid #d97706' : '1px solid transparent',
        borderRight: isSelected ? '1px solid #d97706' : '1px solid transparent',
        borderBottom: isSelected ? '1px solid #d97706' : '1px solid transparent',
        borderLeft: '3px solid #d97706',
        borderRadius: '6px',
        cursor: 'pointer',
        marginBottom: '4px',
        transition: 'background 0.1s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <span style={{ fontWeight: 500, fontSize: '13px', flex: 1, lineHeight: 1.3 }}>
          {item.name}
          {inlineSymbols.map((sym, i) => (
            <span
              key={i}
              title={sym.title}
              style={{ marginLeft: '5px', fontSize: '10px', color: sym.color, opacity: 0.85 }}
            >{sym.symbol}</span>
          ))}
        </span>
        <span style={{
          fontSize: '10px',
          color: statusColors[item.status] || 'var(--text-muted)',
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}>
          {item.status === 'complete' ? 'Complete' : item.status}
        </span>
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '3px',
        fontSize: '11px',
        color: 'var(--text-muted)',
      }}>
        <span style={{ fontStyle: 'italic' }}>{item.tone}</span>
        <span style={{ display: 'flex', gap: '8px' }}>
          {item.wordCount > 0 && (
            <span title={`${item.wordCount.toLocaleString()} words`}>
              {'\u270E'} {item.wordCount.toLocaleString()}
            </span>
          )}
          {item.movementCount > 0 && (
            <span title={`${item.movementCount} movements`}>
              {'\u25B8'} {item.movementCount}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

export default function ChroniclePanel({
  worldData,
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
  onStartBulkBackport,
  isBulkBackportActive,
  refreshTrigger,
  imageModel,
  onOpenImageSettings,
  onHistorianReview,
  isHistorianActive,
  historianConfigured,
  historianConfig,
  onUpdateHistorianNote,
  onRefreshEraSummaries,
  onNavigateToTab,
}) {
  const navEntities = useEntityNavList();
  const entityNavMap = useEntityNavItems();
  // Full entities from Dexie for generation context (tags, description, coordinates, etc.)
  const [fullEntities, setFullEntities] = useState([]);
  const fullEntityMapRef = useRef(new Map());
  const relationships = useRelationships();
  const narrativeEvents = useNarrativeEvents();
  const [selectedItemId, setSelectedItemId] = useState(() => {
    const saved = localStorage.getItem('illuminator:chronicle:selectedItemId');
    return saved || null;
  });
  const [groupByType, setGroupByType] = useState(false);
  const [sortMode, setSortMode] = useState('era_asc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [focusFilter, setFocusFilter] = useState('all');
  const [entitySearchQuery, setEntitySearchQuery] = useState('');
  const [entitySearchSelectedId, setEntitySearchSelectedId] = useState(null);
  const [showEntitySuggestions, setShowEntitySuggestions] = useState(false);
  const [navVisibleCount, setNavVisibleCount] = useState(NAV_PAGE_SIZE);
  const navListRef = useRef(null);
  const navLoadMoreRef = useRef(null);
  // Load full entities from Dexie for generation operations (tags, description, coordinates, etc.)
  useEffect(() => {
    if (!simulationRunId) return;
    let cancelled = false;
    getEntitiesForRun(simulationRunId).then((ents) => {
      if (cancelled) return;
      setFullEntities(ents);
      fullEntityMapRef.current = new Map(ents.map((e) => [e.id, e]));
    });
    return () => { cancelled = true; };
  }, [simulationRunId]);

  const chronicleWorldData = useMemo(() => ({
    entities: fullEntities,
    relationships: relationships || [],
    narrativeHistory: narrativeEvents || [],
  }), [fullEntities, relationships, narrativeEvents]);

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

  // State for reset backport flags modal
  const [showResetBackportModal, setShowResetBackportModal] = useState(false);
  const [resetBackportResult, setResetBackportResult] = useState(null);

  // State for reconcile backport status
  const [reconcileBackportResult, setReconcileBackportResult] = useState(null);

  // State for era summary refresh
  const [eraSummaryRefreshResult, setEraSummaryRefreshResult] = useState(null);

  // State for bulk temporal check
  const [temporalCheckResult, setTemporalCheckResult] = useState(null);

  // State for bulk tertiary re-detect
  const [tertiaryDetectResult, setTertiaryDetectResult] = useState(null);

  // State for bulk summary generation
  const [bulkSummaryResult, setBulkSummaryResult] = useState(null);

  // Collapsible bulk actions panel
  const [showBulkActions, setShowBulkActions] = useState(false);

  // State for chronology modal
  const [showChronologyModal, setShowChronologyModal] = useState(false);

  // Era narrative modal — state lives in Zustand store to survive tab switches
  const eraNarrativeModal = useIlluminatorModals((s) => s.eraNarrativeModal);

  // Bulk historian prep: skip chronicles that already have prep
  const [skipCompletedPrep, setSkipCompletedPrep] = useState(true);

  // Bulk era narrative modal
  const [showBulkEraNarrative, setShowBulkEraNarrative] = useState(false);
  const bulkEraNarrativeProgress = useBulkEraNarrativeStore((s) => s.progress);

  // Era narrative nav items (loaded from IndexedDB, merged into chronicle list)
  const [eraNarrativeNavItems, setEraNarrativeNavItems] = useState([]);

  // Fact coverage bulk analysis
  const {
    progress: factCoverageProgress,
    isActive: isFactCoverageActive,
    prepareFactCoverage,
    confirmFactCoverage,
    cancelFactCoverage,
    closeFactCoverage,
  } = useFactCoverage();

  // Tone ranking & assignment
  const {
    progress: toneRankingProgress,
    isActive: isToneRankingActive,
    prepareToneRanking,
    prepareAssignment,
  } = useToneRanking();

  // Bulk chronicle annotations (clear / run)
  const bulkAnnotationProgress = useBulkChronicleAnnotationStore((s) => s.progress);
  const prepareBulkAnnotation = useBulkChronicleAnnotationStore((s) => s.prepareAnnotation);
  const isBulkAnnotationActive = bulkAnnotationProgress.status === 'running' || bulkAnnotationProgress.status === 'confirming';

  // Interleaved annotation (chronicle + entity)
  const prepareInterleaved = useInterleavedAnnotationStore((s) => s.prepareInterleaved);
  const interleavedProgress = useInterleavedAnnotationStore((s) => s.progress);
  const isInterleavedActive = interleavedProgress.status === 'running' || interleavedProgress.status === 'confirming';
  const entityNavItems = useEntityStore((s) => s.navItems);

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

  // Enqueue-dependent actions (generate, compare, combine)
  const {
    generateV2,
    generateSummary,
    generateTitle,
    generateImageRefs: _generateImageRefs,
    regenerateWithSampling,
    regenerateFull,
    regenerateCreative,
    compareVersions,
    combineVersions,
    copyEdit,
    temporalCheck,
    quickCheck,
  } = useChronicleActions();

  // Lifecycle actions from store (no queue dependency)
  const acceptChronicle = useChronicleStore((s) => s.acceptChronicle);
  const cancelChronicle = useChronicleStore((s) => s.cancelChronicle);
  const restartChronicle = useChronicleStore((s) => s.restartChronicle);

  // Scope the "generating" lock to the selected chronicle so other chronicles remain interactive.
  const isGenerating = Boolean(selectedItemId) && queue.some(
    (item) => item.type === 'entityChronicle' &&
              item.chronicleId === selectedItemId &&
              (item.status === 'queued' || item.status === 'running')
  );

  // Refresh helpers
  const refresh = useCallback(() => useChronicleStore.getState().refreshAll(), []);
  const refreshChronicle = useCallback(
    (id) => useChronicleStore.getState().refreshChronicle(id),
    [],
  );

  // Assign tone to a chronicle without triggering annotation
  const handleSetAssignedTone = useCallback(async (chronicleId, tone) => {
    await updateChronicleAssignedTone(chronicleId, tone);
    refreshChronicle(chronicleId);
  }, [refreshChronicle]);

  // Detect tone for a single chronicle via LLM
  const handleDetectTone = useCallback(async (chronicleId, title) => {
    const record = await getChronicle(chronicleId);
    if (!record?.summary) return;
    const payload = {
      chronicleId,
      summary: record.summary,
      format: record.format || 'story',
      narrativeStyleName: record.narrativeStyle?.name,
      brief: record.perspectiveSynthesis?.brief,
    };
    const entity = {
      id: chronicleId,
      name: title || 'Chronicle',
      kind: 'chronicle',
      subtype: '',
      prominence: 'recognized',
      culture: '',
      status: 'active',
      description: '',
      tags: {},
    };
    onEnqueue([{ entity, type: 'toneRanking', prompt: JSON.stringify(payload), chronicleId }]);
  }, [onEnqueue]);

  // External refresh trigger (e.g. after lore backport)
  useEffect(() => {
    if (refreshTrigger > 0) refresh();
  }, [refreshTrigger, refresh]);

  const entitySuggestions = useMemo(() => {
    const query = entitySearchQuery.trim().toLowerCase();
    if (!query || !navEntities?.length) return [];
    return navEntities
      .filter((entity) => entity.name?.toLowerCase().includes(query))
      .slice(0, 8);
  }, [navEntities, entitySearchQuery]);

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
  const getEffectiveStatus = useCallback((chronicleId, baseStatus) => {
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
          default: return baseStatus;
        }
      }
      if (queueTask.status === 'queued') {
        switch (queueTask.chronicleStep) {
          case 'edit': return 'editing';
          case 'validate': return 'validating';
          case 'generate_v2': return 'generating';
          case 'regenerate_temperature': return 'generating';
          default: return baseStatus;
        }
      }
    }

    // Fall back to IndexedDB-derived status
    return baseStatus;
  }, [queue]);

  // Lightweight nav items from Zustand store (shallow-compared, only re-renders on nav-relevant changes)
  const chronicleItems = useChronicleNavItems(getEffectiveStatus);

  const getChronicleTypeLabel = useCallback((item) => {
    if (item?.itemType === 'era_narrative') return 'Era Narrative';
    if (item?.narrativeStyleName) return item.narrativeStyleName;
    if (item?.narrativeStyleId) {
      return narrativeStyleNameMap.get(item.narrativeStyleId) || item.narrativeStyleId;
    }
    return 'Unknown Type';
  }, [narrativeStyleNameMap]);

  const filteredChronicleItems = useMemo(() => {
    const query = entitySearchQuery.trim().toLowerCase();
    let items = chronicleItems;

    // Apply chronicle-specific filters (era narratives bypass these)
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

    // Merge era narrative nav items (they participate in sorting but not chronicle filters)
    const allItems = [...items, ...eraNarrativeNavItems];

    const getLength = (item) => item.wordCount || 0;

    const getEraOrder = (item) => typeof item.focalEraOrder === 'number' ? item.focalEraOrder : Number.MAX_SAFE_INTEGER;

    const getEraName = (item) => item.focalEraName || '';

    const sorted = [...allItems].sort((a, b) => {
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
          const yearA = a.eraYear ?? Number.MAX_SAFE_INTEGER;
          const yearB = b.eraYear ?? Number.MAX_SAFE_INTEGER;
          if (yearA !== yearB) return yearA - yearB;
          return getEraName(a).localeCompare(getEraName(b));
        }
        case 'era_desc': {
          const orderA = getEraOrder(a);
          const orderB = getEraOrder(b);
          if (orderA !== orderB) return orderB - orderA;
          const yearA = a.eraYear ?? -1;
          const yearB = b.eraYear ?? -1;
          if (yearA !== yearB) return yearB - yearA;
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
    eraNarrativeNavItems,
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

  // Era narrative selection: prefixed IDs distinguish from chronicle IDs
  const isEraNarrativeSelected = selectedItemId?.startsWith('eranarr:') ?? false;
  const selectedEraNarrativeId = isEraNarrativeSelected
    ? selectedItemId.slice('eranarr:'.length)
    : null;

  // Selected chronicle from store — only re-renders when THIS chronicle changes
  // Pass null when an era narrative is selected (no chronicle to load)
  const selectedChronicle = useSelectedChronicle(isEraNarrativeSelected ? null : selectedItemId);

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
      status: getEffectiveStatus(record.chronicleId, deriveStatus(record)),
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
      copyEdit: {
        running: isRunning('copy_edit'),
      },
      temporalCheck: {
        running: isRunning('temporal_check'),
      },
      quickCheck: {
        running: isRunning('quick_check'),
      },
      coverImageScene: {
        running: isRunning('cover_image_scene'),
      },
    };
  }, [selectedItem, queue]);

  // Clear selection if stored item no longer exists in current nav items
  // (Check nav items — synchronously available — not selectedItem which loads async from cache)
  // Era narrative selections use prefixed IDs and are checked against eraNarrativeNavItems
  useEffect(() => {
    if (selectedItemId && chronicleItems.length > 0) {
      if (selectedItemId.startsWith('eranarr:')) {
        const existsInEraNarr = eraNarrativeNavItems.some((item) => item.id === selectedItemId);
        if (eraNarrativeNavItems.length > 0 && !existsInEraNarr) {
          console.log('[Chronicle] Stored era narrative selectedItemId not found, clearing');
          setSelectedItemId(null);
        }
      } else {
        const existsInNav = chronicleItems.some((item) => item.chronicleId === selectedItemId);
        if (!existsInNav) {
          console.log('[Chronicle] Stored selectedItemId not found in current items, clearing');
          setSelectedItemId(null);
        }
      }
    }
  }, [selectedItemId, chronicleItems, eraNarrativeNavItems]);

  // Generate name bank when selected chronicle's entities change
  useEffect(() => {
    if (!selectedItem?.roleAssignments || !navEntities?.length || !worldData?.schema?.cultures) {
      return;
    }

    // Get entity IDs from role assignments
    const entityIds = selectedItem.roleAssignments.map(r => r.entityId);
    const selectedEntities = navEntities.filter(e => entityIds.includes(e.id));
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
  }, [selectedItem?.roleAssignments, navEntities, worldData?.schema?.cultures]);

  // Build generation context for selected item
  const generationContext = useMemo(() => {
    if (!selectedItem || !selectedNarrativeStyle) return null;

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
        factSelection: worldContext.factSelection,
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
          chronicleWorldData,
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
  }, [selectedItem, chronicleWorldData, worldContext, nameBank, entityGuidance, cultureIdentities, selectedNarrativeStyle]);

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
      const entity = fullEntityMapRef.current.get(entityCtx.id);
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
  }, [selectedItem, generationContext, onEnqueue]);

  const handleRegenerateDescription = useCallback((ref) => {
    if (!selectedItem || !generationContext) return;
    const primaryEntity = selectedItem.roleAssignments?.[0];

    // Build visual identities for involved entities
    const visualIdentities = {};
    for (const entityId of ref.involvedEntityIds || []) {
      const entity = fullEntityMapRef.current.get(entityId);
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
  }, [selectedItem, generationContext, onEnqueue]);

  // Cover image scene generation (LLM generates scene description)
  const handleGenerateCoverImageScene = useCallback(() => {
    if (!selectedItem || !generationContext) return;
    // Dispatch as a chronicle task with step 'cover_image_scene'
    const primaryEntity = selectedItem.roleAssignments?.[0];

    // Build visual identities map so the scene LLM can include them in the cast list
    const visualIdentities = {};
    for (const ra of selectedItem.roleAssignments || []) {
      const entity = fullEntityMapRef.current.get(ra.entityId);
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
  }, [selectedItem, generationContext, onEnqueue]);

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

  const handleRegenerateWithSampling = useCallback(() => {
    if (!selectedItem) return;
    regenerateWithSampling(selectedItem.chronicleId);
  }, [selectedItem, regenerateWithSampling]);

  // Full regeneration with new perspective synthesis
  const handleRegenerateFull = useCallback(async () => {
    if (!selectedItem || !worldContext) {
      console.error('[Chronicle] Missing selectedItem or worldContext for full regeneration');
      return;
    }

    // Get narrative style from live library (picks up edits), fall back to stored snapshot
    const liveStyle = styleLibrary?.narrativeStyles?.find(
      (s) => s.id === selectedItem.narrativeStyleId
    );
    const snapshotStyle = selectedItem.narrativeStyle;
    const narrativeStyle = liveStyle || snapshotStyle;
    console.log('[Chronicle] Full regen style resolution:', {
      styleId: selectedItem.narrativeStyleId,
      liveFound: !!liveStyle,
      snapshotFound: !!snapshotStyle,
      usingSource: liveStyle ? 'library' : 'snapshot',
      libraryStyleCount: styleLibrary?.narrativeStyles?.length,
      docInstructionsPreview: narrativeStyle?.documentInstructions?.substring(0, 120),
    });
    if (!narrativeStyle) {
      console.error('[Chronicle] Narrative style not found:', selectedItem.narrativeStyleId);
      return;
    }

    // Validate world context has required fields
    if (!worldContext?.toneFragments || !worldContext?.canonFactsWithMetadata) {
      console.error('[Chronicle] Missing toneFragments or canonFactsWithMetadata for full regeneration');
      return;
    }

    // Build selections from stored chronicle record
    const selections = {
      roleAssignments: selectedItem.roleAssignments || [],
      lens: selectedItem.lens,
      selectedEventIds: selectedItem.selectedEventIds || [],
      selectedRelationshipIds: selectedItem.selectedRelationshipIds || [],
      entrypointId: selectedItem.entrypointId,
    };

    // Build world context struct
    const wc = {
      name: worldContext?.name || 'The World',
      description: worldContext?.description || '',
      toneFragments: worldContext.toneFragments,
      canonFactsWithMetadata: worldContext.canonFactsWithMetadata,
      factSelection: worldContext.factSelection,
      worldDynamics: worldContext.worldDynamics,
    };

    // Generate name bank for invented characters if needed
    const entityIds = (selectedItem.roleAssignments || []).map(r => r.entityId);
    const selectedNavEntities = navEntities?.filter(e => entityIds.includes(e.id)) || [];
    const cultureIds = extractCultureIds(selectedNavEntities);
    let regenNameBank = {};
    if (cultureIds.length > 0 && worldData?.schema?.cultures) {
      try {
        regenNameBank = await generateNameBank(worldData.schema.cultures, cultureIds);
        console.log('[Chronicle] Generated name bank for full regen:', regenNameBank);
      } catch (e) {
        console.warn('[Chronicle] Failed to generate name bank:', e);
      }
    }

    // Build chronicle context
    const context = buildChronicleContext(
      selections,
      chronicleWorldData,
      wc,
      narrativeStyle,
      regenNameBank,
      worldContext?.proseHints,
      cultureIdentities?.descriptive,
      selectedItem.temporalContext
    );

    // Call regenerateFull with the context (sampling derived from LLM config)
    regenerateFull(selectedItem.chronicleId, context);
  }, [selectedItem, chronicleWorldData, worldContext, styleLibrary?.narrativeStyles, regenerateFull, navEntities, worldData?.schema?.cultures, cultureIdentities]);

  // Creative freedom regeneration — same context building as full, but dispatches to creative step
  const handleRegenerateCreative = useCallback(async () => {
    if (!selectedItem || !worldContext) {
      console.error('[Chronicle] Missing selectedItem or worldContext for creative regeneration');
      return;
    }

    const narrativeStyle = selectedItem.narrativeStyle || styleLibrary?.narrativeStyles?.find(
      (s) => s.id === selectedItem.narrativeStyleId
    );
    if (!narrativeStyle) {
      console.error('[Chronicle] Narrative style not found:', selectedItem.narrativeStyleId);
      return;
    }
    if (narrativeStyle.format !== 'story') {
      console.error('[Chronicle] Creative freedom mode is only available for story format');
      return;
    }
    const selections = {
      roleAssignments: selectedItem.roleAssignments || [],
      lens: selectedItem.lens,
      selectedEventIds: selectedItem.selectedEventIds || [],
      selectedRelationshipIds: selectedItem.selectedRelationshipIds || [],
      entrypointId: selectedItem.entrypointId,
    };

    const wc = {
      name: worldContext?.name || 'The World',
      description: worldContext?.description || '',
      toneFragments: worldContext.toneFragments,
      canonFactsWithMetadata: worldContext.canonFactsWithMetadata,
      factSelection: worldContext.factSelection,
      worldDynamics: worldContext.worldDynamics,
    };

    const entityIds = (selectedItem.roleAssignments || []).map(r => r.entityId);
    const selectedNavEntities = navEntities?.filter(e => entityIds.includes(e.id)) || [];
    const cultureIds = extractCultureIds(selectedNavEntities);
    let regenNameBank = {};
    if (cultureIds.length > 0 && worldData?.schema?.cultures) {
      try {
        regenNameBank = await generateNameBank(worldData.schema.cultures, cultureIds);
      } catch (e) {
        console.warn('[Chronicle] Failed to generate name bank:', e);
      }
    }

    const context = buildChronicleContext(
      selections,
      chronicleWorldData,
      wc,
      narrativeStyle,
      regenNameBank,
      worldContext?.proseHints,
      cultureIdentities?.descriptive,
      selectedItem.temporalContext
    );

    regenerateCreative(selectedItem.chronicleId, context);
  }, [selectedItem, chronicleWorldData, worldContext, styleLibrary?.narrativeStyles, regenerateCreative, navEntities, worldData?.schema?.cultures, cultureIdentities]);

  const handleCompareVersions = useCallback(() => {
    if (!selectedItem) return;
    compareVersions(selectedItem.chronicleId);
  }, [selectedItem, compareVersions]);

  const handleCombineVersions = useCallback(() => {
    if (!selectedItem) return;
    combineVersions(selectedItem.chronicleId);
  }, [selectedItem, combineVersions]);

  const handleCopyEdit = useCallback(() => {
    if (!selectedItem) return;
    copyEdit(selectedItem.chronicleId);
  }, [selectedItem, copyEdit]);

  const handleTemporalCheck = useCallback(() => {
    if (!selectedItem) return;
    temporalCheck(selectedItem.chronicleId);
  }, [selectedItem, temporalCheck]);

  const handleQuickCheck = useCallback(() => {
    if (!selectedItem) return;
    quickCheck(selectedItem.chronicleId);
  }, [selectedItem, quickCheck]);

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
      const chronicle = await useChronicleStore.getState().loadChronicle(pendingRestartChronicleId);
      if (chronicle) {
        // Resolve narrative style from live library (picks up edits), fall back to snapshot
        const liveStyle = styleLibrary?.narrativeStyles?.find(
          (s) => s.id === chronicle.narrativeStyleId
        );
        // Extract seed from the chronicle record
        const seed = {
          narrativeStyleId: chronicle.narrativeStyleId,
          narrativeStyle: liveStyle || chronicle.narrativeStyle,
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
  }, [pendingRestartChronicleId, restartChronicle, styleLibrary]);

  const handleRestartCancel = useCallback(() => {
    setShowRestartModal(false);
    setPendingRestartChronicleId(null);
  }, []);

  const logBackportHistorySources = useCallback(async () => {
    if (!simulationRunId) {
      console.log('[Backport Reset] Missing simulationRunId; cannot verify Dexie presence.');
      return;
    }

    try {
      const dexieEntities = await getEntitiesForRun(simulationRunId);
      if (dexieEntities.length === 0) {
        console.log('[Backport Reset] No entities found in Dexie.');
        return;
      }

      let withHistoryCount = 0;
      for (const entity of dexieEntities) {
        const history = entity.enrichment?.descriptionHistory || [];
        if (history.length === 0) continue;
        withHistoryCount += 1;

        const sourceCounts = history.reduce((acc, entry) => {
          const source = entry.source || 'unknown';
          acc[source] = (acc[source] || 0) + 1;
          return acc;
        }, {});

        console.log(
          `[Backport Reset] Entity ${entity.id}${entity.name ? ` (${entity.name})` : ''} history sources:`,
          sourceCounts,
        );
      }

      console.log(
        `[Backport Reset] Entities with history: ${withHistoryCount} of ${dexieEntities.length}.`
      );
    } catch (err) {
      console.warn('[Backport Reset] Failed to inspect Dexie entities:', err);
    }
  }, [simulationRunId]);

  const handleOpenResetBackportModal = useCallback(() => {
    logBackportHistorySources();
    setShowResetBackportModal(true);
  }, [logBackportHistorySources]);

  // Handle reset all backport flags AND entity descriptions
  const handleResetBackportConfirm = useCallback(async () => {
    if (!simulationRunId) return;
    try {
      // Reset chronicle flags
      const chronicleCount = await resetAllBackportFlags(simulationRunId);

      // Reset entity descriptions to pre-backport state
      const freshEntities = await getEntitiesForRun(simulationRunId);
      const entityResult = await resetEntitiesToPreBackportState(simulationRunId, freshEntities);

      setResetBackportResult({
        success: true,
        chronicleCount,
        entityCount: entityResult.resetCount,
      });
      await refresh();

      // Notify host to refresh entity data
      if (entityResult.entityIds.length > 0) {
        window.dispatchEvent(new CustomEvent('entities-updated', {
          detail: { entityIds: entityResult.entityIds },
        }));
      }
    } catch (err) {
      console.error('[Chronicle] Failed to reset backport state:', err);
      setResetBackportResult({ success: false, error: String(err) });
    }
    setShowResetBackportModal(false);
  }, [simulationRunId, refresh]);

  const handleResetBackportCancel = useCallback(() => {
    setShowResetBackportModal(false);
    setResetBackportResult(null);
  }, []);

  // Reconcile backport status from actual entity backrefs
  const handleReconcileBackports = useCallback(async () => {
    if (!simulationRunId) return;
    try {
      // Fetch fresh entities from Dexie to get current backref state
      const freshEntities = await getEntitiesForRun(simulationRunId);
      const count = await reconcileBackportStatusFromEntities(simulationRunId, freshEntities);
      setReconcileBackportResult({ success: true, count });
      await refresh();
      setTimeout(() => setReconcileBackportResult(null), 5000);
    } catch (err) {
      console.error('[Chronicle] Failed to reconcile backport status:', err);
      setReconcileBackportResult({ success: false, error: String(err) });
    }
  }, [simulationRunId, refresh]);

  // Bulk re-detect tertiary cast on all eligible chronicles
  const handleBulkDetectTertiary = useCallback(async () => {
    if (!simulationRunId) return;
    setTertiaryDetectResult({ running: true, count: 0 });

    try {
      const freshEntities = await getEntitiesForRun(simulationRunId);
      const wikiEntities = [];
      for (const entity of freshEntities) {
        if (entity.kind === 'era') continue;
        wikiEntities.push({ id: entity.id, name: entity.name });
        const aliases = entity.enrichment?.text?.aliases;
        if (Array.isArray(aliases)) {
          for (const alias of aliases) {
            if (typeof alias === 'string' && alias.length >= 3) {
              wikiEntities.push({ id: entity.id, name: alias });
            }
          }
        }
      }

      const eligible = chronicleItems.filter(
        (c) => c.status === 'complete' || c.status === 'assembly_ready',
      );
      let updated = 0;

      for (const navItem of eligible) {
        const record = await getChronicle(navItem.chronicleId);
        if (!record) continue;
        const content = record.finalContent || record.assembledContent;
        if (!content) continue;

        const mentions = findEntityMentions(content, wikiEntities);
        const declaredIds = new Set(record.selectedEntityIds || []);
        const prevDecisions = new Map(
          (record.tertiaryCast || []).map(e => [e.entityId, e.accepted])
        );

        const seen = new Set();
        const entries = [];
        for (const m of mentions) {
          if (declaredIds.has(m.entityId) || seen.has(m.entityId)) continue;
          seen.add(m.entityId);
          const entity = freshEntities.find(e => e.id === m.entityId);
          if (entity) {
            entries.push({
              entityId: entity.id,
              name: entity.name,
              kind: entity.kind,
              matchedAs: content.slice(m.start, m.end),
              matchStart: m.start,
              matchEnd: m.end,
              accepted: prevDecisions.get(entity.id) ?? true,
            });
          }
        }

        await updateChronicleTertiaryCast(navItem.chronicleId, entries);
        updated++;
      }

      await refresh();
      setTertiaryDetectResult({ success: true, count: updated });
      setTimeout(() => setTertiaryDetectResult(null), 4000);
    } catch (err) {
      console.error('[Chronicle] Bulk tertiary detect failed:', err);
      setTertiaryDetectResult({ success: false, error: String(err) });
      setTimeout(() => setTertiaryDetectResult(null), 6000);
    }
  }, [simulationRunId, chronicleItems, refresh]);

  // Prepare wizard data
  const wizardEntities = useMemo(() => {
    if (!fullEntities.length) return [];
    return fullEntities
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
  }, [fullEntities]);

  const wizardRelationships = useMemo(() => {
    if (!relationships?.length) return [];
    return relationships.map((r) => {
      const src = entityNavMap.get(r.src);
      const dst = entityNavMap.get(r.dst);
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
  }, [relationships, entityNavMap]);

  const wizardEvents = useMemo(() => {
    if (!narrativeEvents?.length) return [];
    const events = narrativeEvents.map((e) => ({
      id: e.id,
      tick: e.tick,
      era: e.era,
      eventKind: e.eventKind,
      significance: e.significance,
      headline: buildEventHeadline(e),
      description: e.description,
      subjectId: e.subject?.id,
      subjectName: e.subject?.name,
      objectId: e.object?.id,
      objectName: e.object?.name,
      stateChanges: e.stateChanges,
      narrativeTags: e.narrativeTags,
    }));

    return events;
  }, [narrativeEvents]);

  // Build era temporal info from era entities
  // NOTE: Era boundaries come directly from entity.temporal.startTick/endTick.
  // Do NOT compute boundaries from events - this causes overlap bugs and is incorrect.
  // Eras define their own authoritative tick ranges.
  const wizardEras = useMemo(() => {
    if (!fullEntities.length) return [];

    // Get era entities that have temporal data
    const eraEntities = fullEntities.filter((e) => e.kind === 'era' && e.temporal);
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
  }, [fullEntities]);

  // Load era narratives for the simulation run (merged into chronicle nav list)
  const refreshEraNarratives = useCallback(() => {
    if (!simulationRunId) return;
    getEraNarrativesForSimulation(simulationRunId).then((records) => {
      const eraOrderMap = new Map(wizardEras.map((e) => [e.id, e.order]));
      const navItems = records
        .map((r) => buildEraNarrativeNavItem(r, eraOrderMap.get(r.eraId)));
      setEraNarrativeNavItems(navItems);
    });
  }, [simulationRunId, wizardEras]);

  useEffect(() => {
    refreshEraNarratives();
  }, [refreshEraNarratives]);

  // Handle wizard completion
  const handleWizardGenerate = useCallback(async (wizardConfig) => {
    if (!worldContext) {
      console.error('[Chronicle Wizard] Missing worldContext');
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

    // Derive sampling mode from global LLM config
    const chronicleConfig = getCallConfig('chronicle.generation');
    const NORMAL_TOP_P = 1.0;
    const isLowSampling = (chronicleConfig.topP ?? NORMAL_TOP_P) < NORMAL_TOP_P;

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
      factSelection: worldContext.factSelection,
      worldDynamics: worldContext.worldDynamics,
    };

    // Generate name bank for invented characters
    // Must be done here (not in useEffect) because wizard creates new chronicles
    const entityIds = wizardConfig.roleAssignments.map(r => r.entityId);
    const selectedEntities = navEntities?.filter(e => entityIds.includes(e.id)) || [];
    const cultureIds = extractCultureIds(selectedEntities);
    let wizardNameBank = {};
    if (cultureIds.length > 0 && worldData?.schema?.cultures) {
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
      chronicleWorldData,
      wc,
      narrativeStyle,
      wizardNameBank,
      proseHints,
      cultureIdentities?.descriptive,
      wizardConfig.temporalContext,
      wizardConfig.narrativeDirection
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
      generationSampling: isLowSampling ? 'low' : 'normal',
      narrativeDirection: wizardConfig.narrativeDirection,
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
        generationSampling: isLowSampling ? 'low' : 'normal',
        narrativeDirection: wizardConfig.narrativeDirection,
      });
      // Refresh to show the new shell record
      await refresh();
    } catch (err) {
      console.error('[Chronicle Wizard] Failed to create shell record:', err);
    }

    // Generate the chronicle (sampling is now controlled globally via LLM config)
    generateV2(chronicleId, context, chronicleMetadata);

    // Select the newly generated chronicle by its chronicleId
    setSelectedItemId(chronicleId);
    // Close the wizard
    setShowWizard(false);
  }, [chronicleWorldData, worldContext, styleLibrary, generateV2, simulationRunId, refresh, entityGuidance, cultureIdentities, worldData?.schema?.cultures]);

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

  const handleApplyImageRefSelections = useCallback(
    async (selections, newTargetVersionId) => {
      if (!selectedItem?.chronicleId) return;
      await applyImageRefSelections(selectedItem.chronicleId, selections, newTargetVersionId);
      await refreshChronicle(selectedItem.chronicleId);
    },
    [selectedItem, refreshChronicle]
  );

  const handleSelectExistingImage = useCallback(
    async (ref, imageId) => {
      if (!selectedItem?.chronicleId) return;
      await updateChronicleImageRef(selectedItem.chronicleId, ref.refId, {
        generatedImageId: imageId,
        status: 'complete',
        error: undefined,
      });
      await refreshChronicle(selectedItem.chronicleId);
    },
    [selectedItem, refreshChronicle]
  );

  const handleSelectExistingCoverImage = useCallback(
    async (imageId) => {
      if (!selectedItem?.chronicleId || !selectedItem?.coverImage) return;
      await updateChronicleCoverImageStatus(selectedItem.chronicleId, {
        status: 'complete',
        generatedImageId: imageId,
        error: undefined,
      });
      await refreshChronicle(selectedItem.chronicleId);
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
        ? fullEntityMapRef.current.get(selectedItem.entrypointId)
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
    [selectedItem, wizardEras, wizardEvents, refreshChronicle]
  );

  const handleUpdateChronicleActiveVersion = useCallback(
    (versionId) => {
      if (!selectedItem?.chronicleId || !versionId) return;
      updateChronicleActiveVersion(selectedItem.chronicleId, versionId)
        .then(() => refreshChronicle(selectedItem.chronicleId))
        .catch((err) => console.error('[Chronicle] Failed to update active version:', err));
    },
    [selectedItem, refreshChronicle]
  );

  const handleDeleteVersion = useCallback(
    (versionId) => {
      if (!selectedItem?.chronicleId || !versionId) return;
      deleteChronicleVersion(selectedItem.chronicleId, versionId)
        .then(() => refreshChronicle(selectedItem.chronicleId))
        .catch((err) => console.error('[Chronicle] Failed to delete version:', err));
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
    useChronicleStore.getState().loadChronicle(selectedItem.chronicleId).then((chronicle) => {
      if (!chronicle) {
        console.error('[Chronicle] Cannot export: chronicle not found in storage');
        return;
      }
      downloadChronicleExport(chronicle);
    });
  }, [selectedItem]);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {stats.complete} / {chronicleItems.length} complete
            </span>
            <button
              onClick={() => setShowWizard(true)}
              disabled={!styleLibrary || !navEntities?.length}
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

      {/* Collapsible Bulk Actions */}
      <div
        style={{
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-primary)',
        }}
      >
        <button
          onClick={() => setShowBulkActions(!showBulkActions)}
          style={{
            width: '100%',
            padding: '6px 16px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            letterSpacing: '0.03em',
          }}
        >
          <span style={{ fontSize: '9px', transition: 'transform 0.15s', transform: showBulkActions ? 'rotate(90deg)' : 'none' }}>&#9654;</span>
          Bulk Actions
        </button>
        {showBulkActions && (
          <div
            style={{
              padding: '4px 16px 12px',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px',
            }}
          >
            {/* Validation */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 600 }}>
                Validation
              </span>
              <button
                onClick={() => {
                  const eligible = chronicleItems.filter(
                    (c) => c.hasTemporalNarrative && (c.status === 'complete' || c.status === 'assembly_ready'),
                  );
                  if (eligible.length === 0) {
                    setTemporalCheckResult({ success: true, count: 0 });
                    setTimeout(() => setTemporalCheckResult(null), 4000);
                    return;
                  }
                  const items = eligible.map((c) => {
                    const primaryRole = c.roleAssignments?.find((r) => r.isPrimary) || c.roleAssignments?.[0];
                    const entity = primaryRole
                      ? { id: primaryRole.entityId, name: primaryRole.entityName, kind: primaryRole.entityKind, subtype: '', prominence: 'recognized', culture: '', status: 'active', description: '', tags: {} }
                      : { id: c.chronicleId, name: c.title || 'Chronicle', kind: 'chronicle', subtype: '', prominence: 'recognized', culture: '', status: 'active', description: '', tags: {} };
                    return { entity, type: 'entityChronicle', prompt: '', chronicleStep: 'temporal_check', chronicleId: c.chronicleId };
                  });
                  onEnqueue(items);
                  setTemporalCheckResult({ success: true, count: eligible.length });
                  setTimeout(() => setTemporalCheckResult(null), 4000);
                }}
                className="illuminator-button"
                title="Re-run temporal alignment check on all chronicles that have a temporal narrative"
              >
                Rerun Temporal Checks
              </button>
              <button
                onClick={handleBulkDetectTertiary}
                disabled={tertiaryDetectResult?.running}
                className="illuminator-button"
                title="Re-detect tertiary cast (entity mentions not in declared cast) on all chronicles"
              >
                {tertiaryDetectResult?.running ? 'Detecting...' : 'Re-detect Tertiary'}
              </button>
              {onRefreshEraSummaries && (
                <button
                  onClick={async () => {
                    try {
                      const count = await onRefreshEraSummaries();
                      setEraSummaryRefreshResult({ success: true, count });
                      setTimeout(() => setEraSummaryRefreshResult(null), 4000);
                    } catch (err) {
                      setEraSummaryRefreshResult({ success: false, error: err.message });
                      setTimeout(() => setEraSummaryRefreshResult(null), 6000);
                    }
                  }}
                  className="illuminator-button"
                  title="Refresh era summaries in all chronicle temporal contexts from current entity data"
                >
                  Refresh Era Summaries
                </button>
              )}
              <button
                onClick={() => {
                  const eligible = chronicleItems.filter(
                    (c) => !c.hasSummary && (c.status === 'complete' || c.status === 'assembly_ready'),
                  );
                  if (eligible.length === 0) {
                    setBulkSummaryResult({ success: true, count: 0 });
                    setTimeout(() => setBulkSummaryResult(null), 4000);
                    return;
                  }
                  const items = eligible.map((c) => {
                    const primaryRole = c.roleAssignments?.find((r) => r.isPrimary) || c.roleAssignments?.[0];
                    const entity = primaryRole
                      ? { id: primaryRole.entityId, name: primaryRole.entityName, kind: primaryRole.entityKind, subtype: '', prominence: 'recognized', culture: '', status: 'active', description: '', tags: {} }
                      : { id: c.chronicleId, name: c.title || 'Chronicle', kind: 'chronicle', subtype: '', prominence: 'recognized', culture: '', status: 'active', description: '', tags: {} };
                    return { entity, type: 'entityChronicle', prompt: '', chronicleStep: 'summary', chronicleId: c.chronicleId };
                  });
                  onEnqueue(items);
                  setBulkSummaryResult({ success: true, count: eligible.length });
                  setTimeout(() => setBulkSummaryResult(null), 4000);
                }}
                className="illuminator-button"
                title="Generate summaries for all chronicles that are missing them"
              >
                Generate Summaries
              </button>
              <button
                onClick={() => prepareFactCoverage(chronicleItems)}
                disabled={isFactCoverageActive}
                className="illuminator-button"
                title="Analyze canon fact coverage across all chronicles using Haiku"
              >
                {isFactCoverageActive ? 'Analyzing...' : 'Fact Coverage'}
              </button>
            </div>
            {/* Historian Tone */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 600 }}>
                Historian Tone
              </span>
              <button
                onClick={() => prepareToneRanking(chronicleItems)}
                disabled={isToneRankingActive}
                className="illuminator-button"
                title="Rank top 3 historian annotation tones for each chronicle using Haiku"
              >
                {isToneRankingActive ? 'Ranking...' : 'Rank Tones'}
              </button>
              {(toneRankingProgress.status === 'complete' || toneRankingProgress.status === 'failed' || toneRankingProgress.status === 'cancelled') && (
                <div style={{ fontSize: '11px', padding: '2px 0', color: toneRankingProgress.status === 'complete' ? '#10b981' : toneRankingProgress.status === 'failed' ? '#ef4444' : '#f59e0b' }}>
                  {toneRankingProgress.status === 'complete' && `Ranked ${toneRankingProgress.processedChronicles}/${toneRankingProgress.totalChronicles}`}
                  {toneRankingProgress.status === 'failed' && (toneRankingProgress.error || 'Failed')}
                  {toneRankingProgress.status === 'cancelled' && `Cancelled (${toneRankingProgress.processedChronicles}/${toneRankingProgress.totalChronicles})`}
                </div>
              )}
              <button
                onClick={prepareAssignment}
                className="illuminator-button"
                title="Assign tones across corpus with distribution balancing (requires ranked tones)"
              >
                Assign Tones
              </button>
              <button
                onClick={() => downloadBulkToneReviewExport(simulationRunId)}
                className="illuminator-button"
                title="Export all chronicle tone/fact data for offline review"
              >
                Review Export
              </button>
            </div>
            {/* Backport */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 600 }}>
                Backport
              </span>
              <button
                onClick={onStartBulkBackport}
                disabled={isBulkBackportActive}
                className="illuminator-button"
                title="Backport lore from all published chronicles to cast entities (auto-accept, chunked)"
              >
                {isBulkBackportActive ? 'Bulk Backport Running...' : 'Backport All'}
              </button>
              <button
                onClick={handleReconcileBackports}
                className="illuminator-button"
                title="Reconcile backport status from actual entity backrefs — fixes status to match reality"
              >
                Reconcile Backports
              </button>
              <button
                onClick={handleOpenResetBackportModal}
                className="illuminator-button"
                title="Reset per-entity backport status on all chronicles (for re-running backport)"
              >
                Reset Backports
              </button>
            </div>
            {/* Historian */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 600 }}>
                Historian
              </span>
              <button
                onClick={() => setShowChronologyModal(true)}
                className="illuminator-button"
                disabled={!historianConfigured}
                title={historianConfigured
                  ? "Historian assigns chronological years to chronicles within each era"
                  : "Configure historian persona first"}
              >
                Chronology
              </button>
              <button
                onClick={() => {
                  let eligible = chronicleItems.filter(
                    (c) => (c.status === 'complete' || c.status === 'assembly_ready') && historianConfigured,
                  );
                  if (skipCompletedPrep) {
                    eligible = eligible.filter((c) => !c.hasHistorianPrep);
                  }
                  if (eligible.length === 0) return;
                  const items = eligible.map((c) => {
                    const primaryRole = c.roleAssignments?.find((r) => r.isPrimary) || c.roleAssignments?.[0];
                    const entity = primaryRole
                      ? { id: primaryRole.entityId, name: primaryRole.entityName, kind: primaryRole.entityKind, subtype: '', prominence: 'recognized', culture: '', status: 'active', description: '', tags: {} }
                      : { id: c.chronicleId, name: c.name || 'Chronicle', kind: 'chronicle', subtype: '', prominence: 'recognized', culture: '', status: 'active', description: '', tags: {} };
                    return { entity, type: 'historianPrep', prompt: JSON.stringify({ historianConfig, tone: 'weary' }), chronicleId: c.chronicleId };
                  });
                  onEnqueue(items);
                }}
                className="illuminator-button"
                disabled={!historianConfigured}
                title={historianConfigured
                  ? "Generate historian reading notes for all chronicles (input for era narratives)"
                  : "Configure historian persona first"}
              >
                Historian Prep
              </button>
              <label
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-muted)', cursor: 'pointer', marginTop: '-2px' }}
                title="Skip chronicles that already have historian prep briefs"
              >
                <input
                  type="checkbox"
                  checked={skipCompletedPrep}
                  onChange={(e) => setSkipCompletedPrep(e.target.checked)}
                  style={{ margin: 0 }}
                />
                Skip completed
              </label>
              <button
                onClick={() => useIlluminatorModals.getState().openEraNarrative()}
                className="illuminator-button"
                disabled={!historianConfigured}
                title={historianConfigured
                  ? "Generate a multi-chapter era narrative from historian prep briefs"
                  : "Configure historian persona first"}
              >
                Era Narrative
              </button>
              <button
                onClick={() => setShowBulkEraNarrative(true)}
                className="illuminator-button"
                disabled={!historianConfigured || bulkEraNarrativeProgress.status === 'running'}
                title={historianConfigured
                  ? "Run all eras through the full narrative pipeline (threads → generate → edit)"
                  : "Configure historian persona first"}
              >
                {bulkEraNarrativeProgress.status === 'running' ? 'Running...' : 'Bulk Era Narrative'}
              </button>
              <button
                onClick={() => prepareBulkAnnotation('run', chronicleItems)}
                disabled={!historianConfigured || isBulkAnnotationActive || isInterleavedActive}
                className="illuminator-button"
                title={historianConfigured
                  ? "Run historian annotations on all complete chronicles using their assigned tones"
                  : "Configure historian persona first"}
              >
                {isBulkAnnotationActive && bulkAnnotationProgress.operation === 'run' ? 'Annotating...' : 'Run Annotations'}
              </button>
              <button
                onClick={() => prepareBulkAnnotation('clear', chronicleItems)}
                disabled={isBulkAnnotationActive || isInterleavedActive}
                className="illuminator-button"
                title="Clear all historian annotations from chronicles that have them"
              >
                Clear Annotations
              </button>
              <button
                onClick={() => prepareInterleaved(chronicleItems, entityNavItems)}
                disabled={!historianConfigured || isBulkAnnotationActive || isInterleavedActive}
                className="illuminator-button"
                title="Annotate chronicles and their referenced entities in chronological order"
              >
                {isInterleavedActive ? 'Running...' : 'Annotate All (Interleaved)'}
              </button>
              <button
                onClick={() => downloadBulkAnnotationReviewExport(simulationRunId)}
                className="illuminator-button"
                title="Export all chronicle titles, styles, formats, and annotations for offline review"
              >
                Annotation Export
              </button>
              <button
                onClick={async () => {
                  if (!simulationRunId || entityNavItems.size === 0) return;
                  const chronicles = await getChroniclesForSimulation(simulationRunId);
                  let amended = 0;
                  const unchanged = [];
                  for (const record of chronicles) {
                    if (!record.historianPrep) continue;
                    const annotated = annotateEntityNames(record.historianPrep, entityNavItems);
                    if (annotated !== record.historianPrep) {
                      await updateChronicleHistorianPrep(record.chronicleId, annotated);
                      amended++;
                    } else {
                      unchanged.push(record.title || record.chronicleId);
                    }
                  }
                  const total = chronicles.filter(c => c.historianPrep).length;
                  console.log(`[Amend Briefs] Annotated ${amended}/${total} briefs`);
                  if (unchanged.length > 0) {
                    console.log(`[Amend Briefs] Unchanged (${unchanged.length}):`, unchanged);
                  }
                }}
                className="illuminator-button"
                title="Annotate entity names in historian prep briefs with type/culture metadata (e.g. faction/company, aurora-stack)"
              >
                Amend Briefs
              </button>
            </div>
          </div>
        )}
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
                  item.itemType === 'era_narrative' ? (
                    <EraNarrativeItemCard
                      key={item.id}
                      item={item}
                      isSelected={item.id === selectedItemId}
                      onClick={() => setSelectedItemId(item.id)}
                    />
                  ) : (
                    <ChronicleItemCard
                      key={item.id}
                      item={item}
                      isSelected={item.id === selectedItemId}
                      onClick={() => setSelectedItemId(item.id)}
                    />
                  )
                ))}
              </div>
            ))
          ) : (
            visibleChronicleItems.map((item) => (
              item.itemType === 'era_narrative' ? (
                <EraNarrativeItemCard
                  key={item.id}
                  item={item}
                  isSelected={item.id === selectedItemId}
                  onClick={() => setSelectedItemId(item.id)}
                />
              ) : (
                <ChronicleItemCard
                  key={item.id}
                  item={item}
                  isSelected={item.id === selectedItemId}
                  onClick={() => setSelectedItemId(item.id)}
                />
              )
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
          {isEraNarrativeSelected && selectedEraNarrativeId ? (
            <EraNarrativeViewer
              narrativeId={selectedEraNarrativeId}
              onEnqueue={onEnqueue}
              styleLibrary={styleLibrary}
              styleSelection={chronicleStyleSelection}
              imageSize={chronicleImageSize}
              imageQuality={chronicleImageQuality}
              imageModel={imageModel}
              imageGenSettings={imageGenSettings}
              onOpenImageSettings={onOpenImageSettings}
              cultures={worldData?.schema?.cultures}
              cultureIdentities={cultureIdentities}
              worldContext={worldContext}
            />
          ) : !selectedItem ? (
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
                  onRegenerateWithSampling={handleRegenerateWithSampling}
                  onRegenerateFull={handleRegenerateFull}
                  onRegenerateCreative={selectedItem?.narrativeStyle?.format === 'story' ? handleRegenerateCreative : undefined}
                  onCompareVersions={handleCompareVersions}
                  onCombineVersions={handleCombineVersions}
                  onCopyEdit={handleCopyEdit}
                  onTemporalCheck={handleTemporalCheck}
                  onQuickCheck={handleQuickCheck}
                  onGenerateChronicleImage={handleGenerateChronicleImage}
                  onResetChronicleImage={handleResetChronicleImage}
                  onRegenerateDescription={handleRegenerateDescription}
                  onUpdateChronicleAnchorText={handleUpdateChronicleAnchorText}
                  onUpdateChronicleImageSize={handleUpdateChronicleImageSize}
                  onUpdateChronicleImageJustification={handleUpdateChronicleImageJustification}
                  onApplyImageRefSelections={handleApplyImageRefSelections}
                  onSelectExistingImage={handleSelectExistingImage}
                  onSelectExistingCoverImage={handleSelectExistingCoverImage}
                  onUpdateChronicleTemporalContext={handleUpdateChronicleTemporalContext}
                  onUpdateChronicleActiveVersion={handleUpdateChronicleActiveVersion}
                  onDeleteVersion={handleDeleteVersion}
                  onUpdateCombineInstructions={handleUpdateCombineInstructions}
                  onUnpublish={handleUnpublish}
                  onExport={handleExport}
                  onBackportLore={onBackportLore ? () => onBackportLore(selectedItem.chronicleId) : undefined}
                  onHistorianReview={onHistorianReview && historianConfigured && selectedItem.status === 'complete'
                    ? (tone) => onHistorianReview(selectedItem.chronicleId, tone)
                    : undefined}
                  onSetAssignedTone={(tone) => handleSetAssignedTone(selectedItem.chronicleId, tone)}
                  onDetectTone={selectedItem.summary
                    ? () => handleDetectTone(selectedItem.chronicleId, selectedItem.name)
                    : undefined}
                  isHistorianActive={isHistorianActive}
                  onUpdateHistorianNote={onUpdateHistorianNote}
                  onGeneratePrep={historianConfigured && (selectedItem.status === 'complete' || selectedItem.status === 'assembly_ready')
                    ? () => {
                        const primaryRole = selectedItem.roleAssignments?.find((r) => r.isPrimary) || selectedItem.roleAssignments?.[0];
                        const entity = primaryRole
                          ? { id: primaryRole.entityId, name: primaryRole.entityName, kind: primaryRole.entityKind, subtype: '', prominence: 'recognized', culture: '', status: 'active', description: '', tags: {} }
                          : { id: selectedItem.chronicleId, name: selectedItem.name || 'Chronicle', kind: 'chronicle', subtype: '', prominence: 'recognized', culture: '', status: 'active', description: '', tags: {} };
                        onEnqueue([{ entity, type: 'historianPrep', prompt: JSON.stringify({ historianConfig, tone: 'weary' }), chronicleId: selectedItem.chronicleId }]);
                      }
                    : undefined}
                  isGenerating={isGenerating}
                  refinements={refinementState}
                  simulationRunId={simulationRunId}
                  worldSchema={{ entityKinds: worldData?.schema?.entityKinds || [], cultures: worldData?.schema?.cultures || [] }}
                  entities={navEntities}
                  styleLibrary={styleLibrary}
                  cultures={worldData?.schema?.cultures}
                  entityGuidance={entityGuidance}
                  cultureIdentities={cultureIdentities}
                  worldContext={worldContext}
                  eras={wizardEras}
                  events={wizardEvents}
                  onNavigateToTab={onNavigateToTab}
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

      {/* Reset Backport Flags confirmation modal */}
      {showResetBackportModal && (
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
          onClick={handleResetBackportCancel}
        >
          <div
            style={{
              background: 'var(--bg-primary)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '450px',
              width: '90%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>Reset All Backports?</h3>
            <p style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
              This will:
            </p>
            <ul style={{ margin: '0 0 16px 0', paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.8 }}>
              <li>Clear per-entity backport status on all chronicles</li>
              <li>Restore entity descriptions to their pre-backport state</li>
              <li>Clear chronicle backref links from entities</li>
            </ul>
            <p style={{ margin: '0 0 20px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
              Use this when you plan to regenerate chronicles and re-run backporting from scratch.
              Entity descriptions will be reverted to what they were before any lore backport was applied.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleResetBackportCancel}
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
                onClick={handleResetBackportConfirm}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  background: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Reset All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Era Summary Refresh notification */}
      {eraSummaryRefreshResult && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: eraSummaryRefreshResult.success ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
            color: 'white',
            padding: '16px 24px',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
          onClick={() => setEraSummaryRefreshResult(null)}
        >
          <span>
            {eraSummaryRefreshResult.success
              ? eraSummaryRefreshResult.count > 0
                ? `Updated era summaries in ${eraSummaryRefreshResult.count} chronicle${eraSummaryRefreshResult.count !== 1 ? 's' : ''}`
                : 'All chronicle era summaries are already up to date'
              : `Error: ${eraSummaryRefreshResult.error}`}
          </span>
          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Temporal Check notification */}
      {temporalCheckResult && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'rgba(16, 185, 129, 0.95)',
            color: 'white',
            padding: '16px 24px',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
          onClick={() => setTemporalCheckResult(null)}
        >
          <span>
            {temporalCheckResult.count > 0
              ? `Enqueued temporal checks for ${temporalCheckResult.count} chronicle${temporalCheckResult.count !== 1 ? 's' : ''}`
              : 'No eligible chronicles (need temporal narrative + assembled content)'}
          </span>
          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Bulk Summary Result notification */}
      {bulkSummaryResult && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'rgba(16, 185, 129, 0.95)',
            color: 'white',
            padding: '16px 24px',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
          onClick={() => setBulkSummaryResult(null)}
        >
          <span>
            {bulkSummaryResult.count > 0
              ? `Enqueued summary generation for ${bulkSummaryResult.count} chronicle${bulkSummaryResult.count !== 1 ? 's' : ''}`
              : 'No chronicles with missing summaries'}
          </span>
          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Reset Backport Result notification */}
      {resetBackportResult && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: resetBackportResult.success ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
            color: 'white',
            padding: '16px 24px',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
          onClick={() => setResetBackportResult(null)}
        >
          <span>
            {resetBackportResult.success
              ? `Reset ${resetBackportResult.chronicleCount} chronicle${resetBackportResult.chronicleCount !== 1 ? 's' : ''}, restored ${resetBackportResult.entityCount} entit${resetBackportResult.entityCount !== 1 ? 'ies' : 'y'}`
              : `Error: ${resetBackportResult.error}`}
          </span>
          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Reconcile Backport Result notification */}
      {reconcileBackportResult && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: reconcileBackportResult.success ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
            color: 'white',
            padding: '16px 24px',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
          onClick={() => setReconcileBackportResult(null)}
        >
          <span>
            {reconcileBackportResult.success
              ? `Reconciled ${reconcileBackportResult.count} chronicle${reconcileBackportResult.count !== 1 ? 's' : ''} from entity backrefs`
              : `Error: ${reconcileBackportResult.error}`}
          </span>
          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            &times;
          </button>
        </div>
      )}

      <BulkFactCoverageModal
        progress={factCoverageProgress}
        onConfirm={confirmFactCoverage}
        onCancel={cancelFactCoverage}
        onClose={closeFactCoverage}
      />


      {/* Chronicle Wizard Modal */}
      <ChronologyModal
        isOpen={showChronologyModal}
        onClose={() => setShowChronologyModal(false)}
        chronicleItems={chronicleItems}
        wizardEras={wizardEras}
        wizardEvents={wizardEvents}
        projectId={projectId}
        simulationRunId={simulationRunId}
        historianConfig={historianConfig}
        onEnqueue={onEnqueue}
        onApplied={() => {
          useChronicleStore.getState().refreshAll();
          setShowChronologyModal(false);
        }}
      />

      <EraNarrativeModal
        isOpen={eraNarrativeModal !== null}
        resumeNarrativeId={eraNarrativeModal?.narrativeId}
        onClose={() => { useIlluminatorModals.getState().closeEraNarrative(); refreshEraNarratives(); }}
        chronicleItems={chronicleItems}
        wizardEras={wizardEras}
        projectId={projectId}
        simulationRunId={simulationRunId}
        historianConfig={historianConfig}
        onEnqueue={onEnqueue}
        styleLibrary={styleLibrary}
      />

      <BulkEraNarrativeModal
        isOpen={showBulkEraNarrative || bulkEraNarrativeProgress.status === 'running'}
        onClose={() => { setShowBulkEraNarrative(false); refreshEraNarratives(); }}
        chronicleItems={chronicleItems}
        wizardEras={wizardEras}
        eraTemporalInfo={wizardEras}
        projectId={projectId}
        simulationRunId={simulationRunId}
        styleLibrary={styleLibrary}
      />

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
