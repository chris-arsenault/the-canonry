/**
 * IlluminatorRemote - Module Federation entry point for Illuminator
 *
 * This component is loaded by The Canonry shell and receives:
 * - projectId: Current project ID
 * - schema: Read-only world schema (entityKinds, cultures)
 * - worldData: Simulation results from lore-weave
 *
 * Architecture:
 * - Entity-centric view (Entities tab is primary)
 * - UI-side queue management
 * - Worker is a pure executor
 * - Dexie (IndexedDB) is the canonical persistence layer
 * - CustomEvent 'illuminator:worlddata-changed' signals host to reload
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import './App.css';
import EntityBrowser from './components/EntityBrowser';
import ChroniclePanel from './components/ChroniclePanel';
import WorldContextEditor from './components/WorldContextEditor';
import EntityGuidanceEditor from './components/EntityGuidanceEditor';
import VisualIdentityPanel from './components/VisualIdentityPanel';
import ActivityPanel from './components/ActivityPanel';
import ConfigPanel from './components/ConfigPanel';
import CostsPanel from './components/CostsPanel';
import StoragePanel from './components/StoragePanel';
import TraitPaletteSection from './components/TraitPaletteSection';
import StyleLibraryEditor from './components/StyleLibraryEditor';
import StaticPagesPanel from './components/StaticPagesPanel';
import CoveragePanel from './components/CoveragePanel';
import FinalEditTab from './components/FinalEditTab';
import EntityCoveragePanel from './components/EntityCoveragePanel';
import DynamicsGenerationModal from './components/DynamicsGenerationModal';
import SummaryRevisionModal from './components/SummaryRevisionModal';
import EntityRenameModal from './components/EntityRenameModal';
import CreateEntityModal from './components/CreateEntityModal';
import RevisionFilterModal from './components/RevisionFilterModal';
import BackportConfigModal from './components/BackportConfigModal';
import BulkBackportModal from './components/BulkBackportModal';
import BulkHistorianModal from './components/BulkHistorianModal';
import { getCallConfig as getLLMCallConfig } from './lib/llmModelSettings';
import { useBulkHistorian } from './hooks/useBulkHistorian';
import { useEnrichmentQueue } from './hooks/useEnrichmentQueue';
import { useChronicleQueueWatcher } from './hooks/useChronicleQueueWatcher';
import { useDynamicsGeneration } from './hooks/useDynamicsGeneration';
import { useSummaryRevision } from './hooks/useSummaryRevision';
import { useChronicleLoreBackport } from './hooks/useChronicleLoreBackport';
import { useBulkBackport } from './hooks/useBulkBackport';
import { useHistorianEdition } from './hooks/useHistorianEdition';
import { useHistorianReview } from './hooks/useHistorianReview';
import HistorianReviewModal from './components/HistorianReviewModal';
import HistorianConfigEditor from './components/HistorianConfigEditor';
import { ThinkingViewer } from './components/ThinkingViewer';
import { FloatingPills } from './components/FloatingPills';
import BulkToneRankingModal from './components/BulkToneRankingModal';
import ToneAssignmentPreviewModal from './components/ToneAssignmentPreviewModal';
import BulkChronicleAnnotationModal from './components/BulkChronicleAnnotationModal';
import InterleavedAnnotationModal from './components/InterleavedAnnotationModal';
import { useToneRankingStore } from './lib/db/toneRankingStore';
import { useBulkChronicleAnnotationStore } from './lib/db/bulkChronicleAnnotationStore';
import { useInterleavedAnnotationStore } from './lib/db/interleavedAnnotationStore';
import { extractReinforcedFactIds } from './lib/db/historianRunHelpers';
import PrePrintPanel from './components/PrePrintPanel';
import { DEFAULT_HISTORIAN_CONFIG, isHistorianConfigured } from './lib/historianTypes';
import { getPublishedStaticPagesForProject } from './lib/db/staticPageRepository';
import { getEntityUsageStats, getChronicle, getChroniclesForSimulation, updateChronicleEntityBackportStatus, updateChronicleHistorianNotes, refreshEraSummariesInChronicles, repairFactCoverageWasFaceted, computeCorpusFactStrength } from './lib/db/chronicleRepository';
import { computeBackportProgress } from './lib/chronicleTypes';
import { useChronicleStore } from './lib/db/chronicleStore';
import { useStyleLibrary } from './hooks/useStyleLibrary';
import { useImageGenSettings } from './hooks/useImageGenSettings';
import ImageSettingsDrawer, { ImageSettingsTrigger } from './components/ImageSettingsDrawer';
import {
  buildDescriptionPromptFromGuidance,
  buildImagePromptFromGuidance,
  getVisualConfigFromGuidance,
  createDefaultEntityGuidance,
  createDefaultCultureIdentities,
  buildProseHints,
} from './lib/promptBuilders';
import { resolveStyleSelection } from './components/StyleSelector';
import { exportImagePrompts, downloadImagePromptExport } from './lib/db/imageRepository';
import { getResolvedLLMCallSettings } from './lib/llmModelSettings';
import * as entityRepo from './lib/db/entityRepository';
import * as eventRepo from './lib/db/eventRepository';
import * as relationshipRepo from './lib/db/relationshipRepository';
import * as slotRepo from './lib/db/slotRepository';
import * as schemaRepo from './lib/db/schemaRepository';
import * as coordinateStateRepo from './lib/db/coordinateStateRepository';
import { useEntityStore } from './lib/db/entityStore';
import { useIlluminatorModals } from './lib/db/modalStore';
import { useIlluminatorConfigStore } from './lib/db/illuminatorConfigStore';
import { useIndexStore } from './lib/db/indexStore';
import { registerHistorianStarters } from './hooks/useHistorianActions';
import { registerQueue } from './lib/db/enrichmentQueueBridge';
import { useEnrichmentQueueStore } from './lib/db/enrichmentQueueStore';
import { buildHistorianEditionContext, buildHistorianReviewContext, collectPreviousNotes, buildFactCoverageGuidance } from './lib/historianContextBuilders';
import {
  useProminenceScale,
  useRenownedThreshold,
  useEraTemporalInfo,
  useEraTemporalInfoByKey,
  useProminentByCulture,
} from './lib/db/indexSelectors';
import { useEntityNavList, useEntityNavItems } from './lib/db/entitySelectors';
import { useRelationshipStore } from './lib/db/relationshipStore';
import { useRelationships, useRelationshipsByEntity } from './lib/db/relationshipSelectors';
import { useNarrativeEventStore } from './lib/db/narrativeEventStore';
import { useNarrativeEvents } from './lib/db/narrativeEventSelectors';
import { computeRunIndexes } from './lib/db/indexComputation';
import { upsertRunIndexes } from './lib/db/indexRepository';
import {
  prominenceLabelFromScale,
  getEntityEvents,
  getEntityEffects,
} from '@canonry/world-schema';

// Expose diagnostic functions on window for console access (for Module Federation)
if (typeof window !== 'undefined') {
  window.illuminatorDebug = {
    /** Export all image prompt data (original, refined, revised) as array */
    exportImagePrompts,
    /** Download image prompt data as JSON file */
    downloadImagePromptExport,
    /** Rebuild precomputed indexes for a simulation run from current Dexie entities */
    async rebuildRunIndexes(simulationRunId) {
      if (!simulationRunId) {
        console.error('[rebuildRunIndexes] simulationRunId is required');
        return;
      }
      const entities = await entityRepo.getEntitiesForRun(simulationRunId);
      if (!entities.length) {
        console.error('[rebuildRunIndexes] No entities found for run', simulationRunId);
        return;
      }
      const record = computeRunIndexes(simulationRunId, entities);
      await upsertRunIndexes(record);
      const { useIndexStore: store } = await import('./lib/db/indexStore');
      await store.getState().refresh();
      console.log('[rebuildRunIndexes] Done', {
        simulationRunId,
        entityCount: entities.length,
        eraCount: record.eraTemporalInfo.length,
        cultureCount: Object.keys(record.prominentByCulture).length,
      });
    },
    repairFactCoverageWasFaceted,
  };
}

// Tabs ordered by workflow: setup → work → monitor → manage
const TABS = [
  { id: 'configure', label: 'Configure' },   // 1. Set API keys and models
  { id: 'context', label: 'Context' },       // 2. Define world context
  { id: 'guidance', label: 'Guidance' },      // 3. Per-kind entity guidance
  { id: 'identity', label: 'Identity' },     // 4. Visual identity per culture
  { id: 'styles', label: 'Styles' },         // 5. Manage style library
  { id: 'entities', label: 'Entities' },     // 6. Main enrichment work
  { id: 'chronicle', label: 'Chronicle' },   // 7. Wiki-ready long-form content
  { id: 'coverage', label: 'Coverage' },     // 8. Fact usage tracking
  { id: 'finaledit', label: 'Final Edit' }, // 9. Corpus-wide editorial tools
  { id: 'pages', label: 'Pages' },           // 10. Static pages (user-authored)
  { id: 'activity', label: 'Activity' },     // 10. Monitor queue
  { id: 'costs', label: 'Costs' },           // 11. Track spending
  { id: 'storage', label: 'Storage' },       // 12. Manage images
  { id: 'traits', label: 'Traits' },         // 13. Visual trait palettes
  { id: 'historian', label: 'Historian' },   // 14. Historian persona config
  { id: 'preprint', label: 'Pre-Print' },   // 15. Print preparation
];

// Default image prompt template for Claude formatting
const DEFAULT_IMAGE_PROMPT_TEMPLATE = `Transform the structured prompt below into a single, coherent image prompt for {{modelName}}. Do NOT simply reformat—actively synthesize and reshape:

Honor the VISUAL THESIS: This is the primary visual signal. The thesis describes the dominant silhouette feature that makes this entity instantly recognizable. Build the entire image around it.

Synthesize, don't list:
- Merge SUBJECT + CONTEXT + CULTURAL IDENTITY into a unified visual
- Apply STYLE (artistic approach) and COMPOSITION (framing/perspective) to shape the rendering
- Translate SUPPORTING TRAITS into concrete visual details that reinforce the thesis
- Incorporate COLOR PALETTE if provided

Establish clear composition and perspective:
- Honor the COMPOSITION directive for framing and vantage point
- Use environmental storytelling (objects, weathering, traces) to convey history
- The SETTING provides world context but the subject is the focus

Create specific visual instructions: Rather than listing adjectives, use concrete visual language: "weathered by decades of X," "visible scars of Y," "rendered in the style of Z"

Respect the AVOID list: These are hard constraints—elements that break the visual language.

Condense to a single, authoritative prompt: Output should be 150-300 words, reading as clear artistic direction that could be handed to a concept artist—not a bulleted list.
{{globalImageRules}}
Original prompt:
{{prompt}}`;

// Default enrichment config
// Note: LLM model settings are now managed per-call-type via llmModelSettings.ts
// and configured in the LLMCallConfigPanel. Only image-related settings remain here.
const DEFAULT_CONFIG = {
  imageModel: 'gpt-image-1.5',
  minProminenceForImage: 'mythic',
  numWorkers: 4,
  // Multishot prompting options
  requireDescription: false,
  useClaudeForImagePrompt: false,
  claudeImagePromptTemplate: DEFAULT_IMAGE_PROMPT_TEMPLATE,
  // Global image rules - domain-specific constraints injected into Claude image prompt
  globalImageRules: '',
  // Description generation options
  minEventSignificance: 0.25, // Include events above 'low' threshold
};

const normalizeEnrichmentConfig = (config) => {
  if (!config) return null;
  // Remove legacy model fields that have been migrated to per-call settings
  const { textModel, chronicleModel, textModal, chronicleModal, thinkingModel, thinkingBudget, useThinkingForDescriptions, ...rest } = config;
  return { ...DEFAULT_CONFIG, ...rest };
};

const buildSchemaContext = (schema) => {
  if (!schema) return '';
  const sections = [];
  if (schema.entityKinds?.length) {
    sections.push('Entity Kinds: ' + schema.entityKinds.map((k) => k.kind).join(', '));
  }
  if (schema.relationshipKinds?.length) {
    sections.push('Relationship Kinds: ' + schema.relationshipKinds.map((k) => k.kind).join(', '));
  }
  if (schema.cultures?.length) {
    sections.push('Cultures: ' + schema.cultures.map((c) => c.name || c.id).join(', '));
  }
  return sections.join('\n');
};

const resolveEntityEraId = (entity) => {
  if (!entity) return undefined;
  if (typeof entity.eraId === 'string' && entity.eraId) return entity.eraId;
  return undefined;
};

const resolveFinalEraIdFromHardState = (hardState, eraValue) => {
  if (!eraValue) return null;
  const eraEntity = (hardState || []).find(
    (entity) =>
      entity.kind === 'era' &&
      (entity.id === eraValue || entity.eraId === eraValue || entity.name === eraValue)
  );
  if (eraEntity) return eraEntity.eraId || eraEntity.id || eraValue;
  return eraValue;
};

// Default world context
const DEFAULT_WORLD_CONTEXT = {
  name: '',
  description: '',
  // Structured fields - the canonical source of truth
  toneFragments: { core: '' },
  canonFactsWithMetadata: [],
  factSelection: {},
  worldDynamics: [],
};

// Fields in enrichment.text (summary/description are now on entity directly)
export default function IlluminatorRemote({
  projectId,
  schema,
  worldData,
  worldContext: externalWorldContext,
  onWorldContextChange,
  entityGuidance: externalEntityGuidance,
  onEntityGuidanceChange,
  cultureIdentities: externalCultureIdentities,
  onCultureIdentitiesChange,
  enrichmentConfig: externalEnrichmentConfig,
  onEnrichmentConfigChange,
  styleSelection: externalStyleSelection,
  onStyleSelectionChange,
  historianConfig: externalHistorianConfig,
  onHistorianConfigChange,
  activeSection,
  onSectionChange,
  activeSlotIndex = 0,
}) {
  // Use passed-in section or default to 'entities'
  const activeTab = activeSection || 'entities';
  const setActiveTab = onSectionChange || (() => {});

  // API Keys - optionally persisted to localStorage
  const [persistApiKeys, setPersistApiKeys] = useState(() => {
    try {
      return localStorage.getItem('illuminator:persistApiKeys') === 'true';
    } catch {
      return false;
    }
  });
  const [anthropicApiKey, setAnthropicApiKey] = useState(() => {
    try {
      if (localStorage.getItem('illuminator:persistApiKeys') === 'true') {
        return localStorage.getItem('illuminator:anthropicApiKey') || '';
      }
    } catch {}
    return '';
  });
  const [openaiApiKey, setOpenaiApiKey] = useState(() => {
    try {
      if (localStorage.getItem('illuminator:persistApiKeys') === 'true') {
        return localStorage.getItem('illuminator:openaiApiKey') || '';
      }
    } catch {}
    return '';
  });
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [chronicleRefreshTrigger, setChronicleRefreshTrigger] = useState(0);
  // Modal state — from centralized store (children open via store actions directly)
  const renameModal = useIlluminatorModals((s) => s.renameModal);
  const createEntityModal = useIlluminatorModals((s) => s.createEntityModal);
  const editEntityModal = useIlluminatorModals((s) => s.editEntityModal);
  const imageSettingsOpen = useIlluminatorModals((s) => s.imageSettingsOpen);

  // Persist API keys when enabled
  useEffect(() => {
    try {
      localStorage.setItem('illuminator:persistApiKeys', persistApiKeys ? 'true' : 'false');
      if (persistApiKeys) {
        localStorage.setItem('illuminator:anthropicApiKey', anthropicApiKey);
        localStorage.setItem('illuminator:openaiApiKey', openaiApiKey);
      } else {
        localStorage.removeItem('illuminator:anthropicApiKey');
        localStorage.removeItem('illuminator:openaiApiKey');
      }
    } catch {}
  }, [persistApiKeys, anthropicApiKey, openaiApiKey]);

  // Enrichment config - use external prop if provided, else localStorage fallback
  const [localConfig, setLocalConfig] = useState(() => {
    // Prefer external config, fall back to localStorage
    if (externalEnrichmentConfig) {
      return normalizeEnrichmentConfig(externalEnrichmentConfig) || DEFAULT_CONFIG;
    }
    try {
      const saved = localStorage.getItem('illuminator:config');
      if (saved) {
        return normalizeEnrichmentConfig(JSON.parse(saved)) || DEFAULT_CONFIG;
      }
    } catch {}
    return DEFAULT_CONFIG;
  });
  const pendingConfigSyncRef = useRef(null);
  const skipConfigSyncRef = useRef(false);

  // Sync from external config when it changes
  useEffect(() => {
    if (externalEnrichmentConfig) {
      const normalized = normalizeEnrichmentConfig(externalEnrichmentConfig) || DEFAULT_CONFIG;
      skipConfigSyncRef.current = true;
      setLocalConfig(normalized);
    }
  }, [externalEnrichmentConfig]);

  // Use the local config as the active config
  const config = localConfig;

  // Wrapper to update config and sync to parent
  const setConfig = useCallback((updater) => {
    setLocalConfig((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      pendingConfigSyncRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    if (skipConfigSyncRef.current) {
      skipConfigSyncRef.current = false;
      pendingConfigSyncRef.current = null;
      return;
    }
    const pending = pendingConfigSyncRef.current;
    if (!pending) return;
    pendingConfigSyncRef.current = null;
    if (onEnrichmentConfigChange) {
      onEnrichmentConfigChange(pending);
    } else {
      try {
        localStorage.setItem('illuminator:config', JSON.stringify(pending));
      } catch {}
    }
  }, [localConfig, onEnrichmentConfigChange]);

  // Global image generation settings (style, composition, palette, size, quality)
  // Backed by localStorage via useImageGenSettings hook
  const [imageGenSettings, updateImageGenSettings] = useImageGenSettings(
    onStyleSelectionChange ? (settings) => {
      onStyleSelectionChange({
        artisticStyleId: settings.artisticStyleId,
        compositionStyleId: settings.compositionStyleId,
        colorPaletteId: settings.colorPaletteId,
      });
    } : undefined
  );

  // Derive a styleSelection-shaped object for backward compat with buildPrompt etc.
  const styleSelection = useMemo(() => ({
    artisticStyleId: imageGenSettings.artisticStyleId,
    compositionStyleId: imageGenSettings.compositionStyleId,
    colorPaletteId: imageGenSettings.colorPaletteId,
  }), [imageGenSettings.artisticStyleId, imageGenSettings.compositionStyleId, imageGenSettings.colorPaletteId]);

  // Style library - loaded from IndexedDB or defaults from world-schema
  const {
    styleLibrary,
    loading: styleLibraryLoading,
    isCustom: hasCustomStyleLibrary,
    save: saveStyleLibrary,
    reset: resetStyleLibrary,
    addArtisticStyle,
    updateArtisticStyle,
    deleteArtisticStyle,
    addCompositionStyle,
    updateCompositionStyle,
    deleteCompositionStyle,
    addNarrativeStyle,
    updateNarrativeStyle,
    deleteNarrativeStyle,
  } = useStyleLibrary();

  // World context - edit locally and debounce sync to shell to avoid re-rendering MFEs on each keypress
  const [localWorldContext, setLocalWorldContext] = useState(DEFAULT_WORLD_CONTEXT);
  const worldContext = localWorldContext;
  const worldContextSyncTimeoutRef = useRef(null);
  const worldContextDirtyRef = useRef(false);
  const pendingWorldContextRef = useRef(localWorldContext);

  useEffect(() => {
    if (externalWorldContext === undefined) return;
    if (worldContextSyncTimeoutRef.current) {
      clearTimeout(worldContextSyncTimeoutRef.current);
      worldContextSyncTimeoutRef.current = null;
    }
    worldContextDirtyRef.current = false;
    const nextContext = externalWorldContext || DEFAULT_WORLD_CONTEXT;
    pendingWorldContextRef.current = nextContext;
    setLocalWorldContext(nextContext);
  }, [externalWorldContext]);

  // Entity guidance and culture identities - the canonical configuration format
  const [localEntityGuidance, setLocalEntityGuidance] = useState(() => createDefaultEntityGuidance());
  const [localCultureIdentities, setLocalCultureIdentities] = useState(() => createDefaultCultureIdentities());
  const entityGuidance = localEntityGuidance;
  const cultureIdentities = localCultureIdentities;
  const pendingEntityGuidanceRef = useRef(localEntityGuidance);
  const pendingCultureIdentitiesRef = useRef(localCultureIdentities);
  // Sync entity guidance from external prop
  useEffect(() => {
    if (externalEntityGuidance === undefined) return;
    const nextEntityGuidance = externalEntityGuidance || createDefaultEntityGuidance();
    pendingEntityGuidanceRef.current = nextEntityGuidance;
    setLocalEntityGuidance(nextEntityGuidance);
  }, [externalEntityGuidance]);

  // Sync culture identities from external prop
  useEffect(() => {
    if (externalCultureIdentities === undefined) return;
    const nextCultureIdentities = externalCultureIdentities || createDefaultCultureIdentities();
    pendingCultureIdentitiesRef.current = nextCultureIdentities;
    setLocalCultureIdentities(nextCultureIdentities);
  }, [externalCultureIdentities]);

  const LEGACY_HISTORIAN_CONFIG_KEY = 'illuminator:historianConfig';
  const readLegacyHistorianConfig = () => {
    try {
      const stored = localStorage.getItem(LEGACY_HISTORIAN_CONFIG_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  };

  // Historian config - project-level persona definition
  const [localHistorianConfig, setLocalHistorianConfig] = useState(() => {
    if (externalHistorianConfig) return externalHistorianConfig;
    const legacy = readLegacyHistorianConfig();
    return legacy || DEFAULT_HISTORIAN_CONFIG;
  });
  const historianConfig = localHistorianConfig;
  const pendingHistorianConfigRef = useRef(localHistorianConfig);
  const migratedHistorianConfigRef = useRef(false);
  // Sync historian config from external prop
  useEffect(() => {
    if (externalHistorianConfig === undefined) return;
    if (externalHistorianConfig) {
      pendingHistorianConfigRef.current = externalHistorianConfig;
      setLocalHistorianConfig(externalHistorianConfig);
      return;
    }

    if (!migratedHistorianConfigRef.current) {
      const legacy = readLegacyHistorianConfig();
      if (legacy && isHistorianConfigured(legacy)) {
        migratedHistorianConfigRef.current = true;
        pendingHistorianConfigRef.current = legacy;
        setLocalHistorianConfig(legacy);
        if (onHistorianConfigChange) {
          onHistorianConfigChange(legacy);
        }
        try {
          localStorage.removeItem(LEGACY_HISTORIAN_CONFIG_KEY);
        } catch {}
        return;
      }
    }

    const nextConfig = DEFAULT_HISTORIAN_CONFIG;
    pendingHistorianConfigRef.current = nextConfig;
    setLocalHistorianConfig(nextConfig);
  }, [externalHistorianConfig, onHistorianConfigChange]);
  const historianConfigSyncTimeoutRef = useRef(null);
  const updateHistorianConfig = useCallback((next) => {
    setLocalHistorianConfig(next);
    pendingHistorianConfigRef.current = next;
    if (!onHistorianConfigChange) return;
    if (historianConfigSyncTimeoutRef.current) {
      clearTimeout(historianConfigSyncTimeoutRef.current);
    }
    historianConfigSyncTimeoutRef.current = setTimeout(() => {
      onHistorianConfigChange(pendingHistorianConfigRef.current);
      historianConfigSyncTimeoutRef.current = null;
    }, 300);
  }, [onHistorianConfigChange]);

  // World data from Zustand stores (source: Dexie)
  const navEntities = useEntityNavList();
  const entityNavMap = useEntityNavItems();
  const narrativeEvents = useNarrativeEvents();
  const relationships = useRelationships();
  const relationshipsByEntity = useRelationshipsByEntity();
  const [slotRecord, setSlotRecord] = useState(null);
  const [dataSyncStatus, setDataSyncStatus] = useState(null);
  const [isDataSyncing, setIsDataSyncing] = useState(false);
  const isTemporarySlot = slotRecord?.isTemporary ?? activeSlotIndex === 0;

  // Load slot metadata explicitly from Dexie (no auto-migration on load)
  useEffect(() => {
    if (!projectId) {
      setSlotRecord(null);
      return;
    }
    let cancelled = false;

    (async () => {
      const slot = await slotRepo.getSlot(projectId, activeSlotIndex);
      if (cancelled) return;
      setSlotRecord(slot || null);
      useEntityStore.getState().reset();
      useIndexStore.getState().reset();
      useNarrativeEventStore.getState().reset();
      useRelationshipStore.getState().reset();
    })();

    return () => { cancelled = true; };
  }, [projectId, activeSlotIndex]);

  const prominenceScale = useProminenceScale();
  const renownedThreshold = useRenownedThreshold();
  const [currentEra, setCurrentEra] = useState(null);
  useEffect(() => {
    const eraId = slotRecord?.finalEraId;
    if (!eraId) { setCurrentEra(null); return; }
    const eraNav = navEntities.find(
      (entity) =>
        entity.kind === 'era' &&
        (entity.id === eraId || entity.eraId === eraId || entity.name === eraId)
    );
    if (!eraNav) { setCurrentEra({ name: eraId }); return; }
    // Load full entity for description
    useEntityStore.getState().loadEntity(eraNav.id).then((full) => {
      setCurrentEra(full ? { name: full.name, description: full.description } : { name: eraNav.name });
    });
  }, [slotRecord?.finalEraId, navEntities]);

  const eraTemporalInfo = useEraTemporalInfo();
  const eraTemporalInfoByKey = useEraTemporalInfoByKey();
  const prominentByCulture = useProminentByCulture();

  // Extract simulationRunId from slot metadata for content association
  const simulationRunId = slotRecord?.simulationRunId || undefined;
  const hasHardState = Boolean(worldData?.hardState?.length);
  const hasHardRelationships = Boolean(worldData?.relationships?.length);
  const hasHardEvents = Boolean(worldData?.narrativeHistory?.length);

  // Sync project-level config into the centralized store.
  // Children (useHistorianActions, historianContextBuilders) read these imperatively.
  useEffect(() => {
    useIlluminatorConfigStore.getState().setConfig({
      projectId: projectId || null,
      simulationRunId: simulationRunId || null,
      worldContext,
      historianConfig,
      entityGuidance,
      cultureIdentities,
    });
  }, [projectId, simulationRunId, worldContext, historianConfig, entityGuidance, cultureIdentities]);

  // Scoped reload helpers: fetch only the data that actually changed.
  // Entity-only reload — the common case (enrichment, backport, CRUD, historian)
  const reloadEntities = useCallback(async (invalidateIds, overrideRunId) => {
    const runId = overrideRunId ?? simulationRunId;
    if (!runId) return;
    const store = useEntityStore.getState();
    if (invalidateIds?.length) {
      await store.refreshEntities(invalidateIds);
    } else {
      await store.refreshAll();
    }
    window.dispatchEvent(new CustomEvent('illuminator:worlddata-changed', {
      detail: { simulationRunId: runId, scope: 'entities' },
    }));
  }, [simulationRunId]);

  // Entity + events reload — rename only (applies text patches to narrative events)
  const reloadEntitiesAndEvents = useCallback(async (invalidateIds, overrideRunId) => {
    const runId = overrideRunId ?? simulationRunId;
    if (!runId) return;
    const entityStore = useEntityStore.getState();
    if (invalidateIds?.length) {
      await entityStore.refreshEntities(invalidateIds);
    } else {
      await entityStore.refreshAll();
    }
    await useNarrativeEventStore.getState().refreshAll();
    window.dispatchEvent(new CustomEvent('illuminator:worlddata-changed', {
      detail: { simulationRunId: runId, scope: 'entities+events' },
    }));
  }, [simulationRunId]);

  // Full reload — data sync only (seeds entities, events, AND relationships)
  const reloadAll = useCallback(async (invalidateIds, overrideRunId) => {
    const runId = overrideRunId ?? simulationRunId;
    if (!runId) return;
    await useEntityStore.getState().refreshAll();
    await Promise.all([
      useNarrativeEventStore.getState().refreshAll(),
      useRelationshipStore.getState().refreshAll(),
    ]);
    window.dispatchEvent(new CustomEvent('illuminator:worlddata-changed', {
      detail: { simulationRunId: runId, scope: 'all' },
    }));
  }, [simulationRunId]);

  const handleDataSync = useCallback(async (mode) => {
    const hardRunId = worldData?.metadata?.simulationRunId;
    if (!hardRunId) {
      setDataSyncStatus({ type: 'error', message: 'Missing simulation run ID in hard state.' });
      return;
    }
    if (!hasHardState || !worldData?.hardState?.length) {
      setDataSyncStatus({ type: 'error', message: 'No hard state available to import.' });
      return;
    }
    if (slotRecord?.simulationRunId && slotRecord.simulationRunId !== hardRunId) {
      const ok = window.confirm(
        `Hard state run ID (${hardRunId}) does not match this slot's run (${slotRecord.simulationRunId}). Importing will switch this slot to the hard state run. Continue?`
      );
      if (!ok) return;
    }
    if (mode === 'overwrite') {
      const ok = window.confirm(
        'Overwrite will replace ALL Dexie entities, events, and relationships for this run with hard state. This can delete local enrichment. Continue?'
      );
      if (!ok) return;
    }

    setIsDataSyncing(true);
    setDataSyncStatus(null);

    try {
      if (mode === 'overwrite') {
        await Promise.all([
          entityRepo.deleteEntitiesForRun(hardRunId),
          eventRepo.deleteEventsForRun(hardRunId),
          relationshipRepo.deleteRelationshipsForRun(hardRunId),
        ]);

        await entityRepo.seedEntities(hardRunId, worldData.hardState);
        if (worldData.narrativeHistory?.length) {
          await eventRepo.seedNarrativeEvents(hardRunId, worldData.narrativeHistory);
        }
        if (worldData.relationships?.length) {
          await relationshipRepo.seedRelationships(hardRunId, worldData.relationships);
        }

        setDataSyncStatus({
          type: 'success',
          message: 'Overwrite complete. Dexie now matches hard state for this run.',
        });
      } else {
        const { added, patched } = await entityRepo.patchEntitiesFromHardState(
          hardRunId,
          worldData.hardState
        );
        const eventsAdded = await eventRepo.patchNarrativeEvents(
          hardRunId,
          worldData.narrativeHistory || []
        );
        const relationshipsAdded = await relationshipRepo.patchRelationships(
          hardRunId,
          worldData.relationships || []
        );

        setDataSyncStatus({
          type: 'success',
          message: `Patch complete. Entities added: ${added}, patched: ${patched}. Events added: ${eventsAdded}. Relationships added: ${relationshipsAdded}.`,
        });
      }

      if (projectId && worldData?.schema) {
        await schemaRepo.upsertSchema(projectId, worldData.schema);
      }
      if (worldData?.coordinateState) {
        await coordinateStateRepo.upsertCoordinateState(hardRunId, worldData.coordinateState);
      }

      const nextSlotRecord = {
        projectId,
        slotIndex: activeSlotIndex,
        simulationRunId: hardRunId,
        finalTick: Number.isFinite(worldData?.metadata?.tick) ? worldData.metadata.tick : null,
        finalEraId: resolveFinalEraIdFromHardState(worldData.hardState, worldData?.metadata?.era),
        label: slotRecord?.label ?? (activeSlotIndex === 0 ? 'Scratch' : `Slot ${activeSlotIndex}`),
        isTemporary: slotRecord?.isTemporary ?? (activeSlotIndex === 0),
        updatedAt: Date.now(),
      };
      await slotRepo.upsertSlot(nextSlotRecord);
      setSlotRecord(nextSlotRecord);

      const store = useEntityStore.getState();
      store.reset();
      await store.initialize(hardRunId);

      // Compute and persist run indexes from freshly seeded entities
      const allEntities = await entityRepo.getEntitiesForRun(hardRunId);
      const indexRecord = computeRunIndexes(hardRunId, allEntities);
      await upsertRunIndexes(indexRecord);
      const indexStore = useIndexStore.getState();
      indexStore.reset();
      await indexStore.initialize(hardRunId);

      useNarrativeEventStore.getState().reset();
      await useNarrativeEventStore.getState().initialize(hardRunId);
      useRelationshipStore.getState().reset();
      await useRelationshipStore.getState().initialize(hardRunId);

      window.dispatchEvent(new CustomEvent('illuminator:worlddata-changed', {
        detail: { simulationRunId: hardRunId, scope: 'all' },
      }));
    } catch (err) {
      setDataSyncStatus({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsDataSyncing(false);
    }
  }, [activeSlotIndex, hasHardState, projectId, slotRecord, worldData]);

  useEffect(() => {
    const handleEntitiesUpdated = (event) => {
      if (!simulationRunId) return;
      const ids = event?.detail?.entityIds;
      reloadEntities(ids);
    };

    window.addEventListener('entities-updated', handleEntitiesUpdated);
    return () => window.removeEventListener('entities-updated', handleEntitiesUpdated);
  }, [reloadEntities, simulationRunId]);

  // Handle entity enrichment update from queue
  // output is ApplyEnrichmentOutput with { enrichment, summary?, description? }
  const handleEntityUpdate = useCallback(async (entityId, output) => {
    if (output.enrichment?.image) {
      await entityRepo.applyImageResult(entityId, output.enrichment.image);
    } else if (output.enrichment?.entityChronicle) {
      await entityRepo.applyEntityChronicleResult(entityId, output.enrichment.entityChronicle);
    } else if (output.enrichment?.text && !output.description) {
      // Visual thesis only — no description change
      await entityRepo.applyVisualThesisResult(entityId, output.enrichment.text.visualThesis, output.enrichment.text.visualTraits || [], {
        generatedAt: output.enrichment.text.generatedAt,
        model: output.enrichment.text.model,
        estimatedCost: output.enrichment.text.estimatedCost,
        actualCost: output.enrichment.text.actualCost,
        inputTokens: output.enrichment.text.inputTokens,
        outputTokens: output.enrichment.text.outputTokens,
        chainDebug: output.enrichment.text.chainDebug,
      });
    } else {
      await entityRepo.applyDescriptionResult(
        entityId, output.enrichment, output.summary, output.description,
      );
    }
    await reloadEntities([entityId]);
  }, [reloadEntities]);

  // Refresh era summaries in all chronicle temporal contexts
  const handleRefreshEraSummaries = useCallback(async () => {
    if (!simulationRunId || !eraTemporalInfo.length) return 0;
    const count = await refreshEraSummariesInChronicles(simulationRunId, eraTemporalInfo);
    if (count > 0) {
      await useChronicleStore.getState().refreshAll();
    }
    return count;
  }, [simulationRunId, eraTemporalInfo]);

  // Load from Dexie only (explicit import required to seed).
  useEffect(() => {
    if (!simulationRunId) return;

    (async () => {
      try {
        // Initialize all zustand stores from Dexie
        await useEntityStore.getState().initialize(simulationRunId);
        await useIndexStore.getState().initialize(simulationRunId);
        await useNarrativeEventStore.getState().initialize(simulationRunId);
        await useRelationshipStore.getState().initialize(simulationRunId);

        console.log('[Illuminator] Loaded from Dexie', {
          entityCount: useEntityStore.getState().navItems.size,
          eventCount: useNarrativeEventStore.getState().events.length,
          relationshipCount: useRelationshipStore.getState().relationships.length,
        });
      } catch (err) {
        console.warn('[Illuminator] DAL load failed:', err);
      }
    })();
  }, [simulationRunId]);

  // Queue management
  const {
    queue,
    isWorkerReady,
    stats,
    initialize: initializeWorker,
    enqueue,
    cancel,
    cancelAll,
    retry,
    clearCompleted,
  } = useEnrichmentQueue(handleEntityUpdate, projectId, simulationRunId);

  // Register queue functions on the bridge (hooks call getEnqueue() imperatively)
  registerQueue(enqueue, cancel);

  // Sync queue state to the store for reactive reads by child components
  useEffect(() => {
    useEnrichmentQueueStore.getState().setQueue(queue, stats);
  }, [queue, stats]);

  // Bridge chronicle-related queue completions to chronicle store refreshes
  useChronicleQueueWatcher(queue);

  // Initialize worker when API keys change
  useEffect(() => {
    if (anthropicApiKey || openaiApiKey) {
      initializeWorker({
        anthropicApiKey,
        openaiApiKey,
        imageModel: config.imageModel,
        imageSize: imageGenSettings.imageSize,
        imageQuality: imageGenSettings.imageQuality,
        // Multishot prompting options
        useClaudeForImagePrompt: config.useClaudeForImagePrompt,
        claudeImagePromptTemplate: config.claudeImagePromptTemplate,
        globalImageRules: config.globalImageRules,
        // Per-call LLM model settings (resolved from localStorage)
        llmCallSettings: getResolvedLLMCallSettings(),
      });
    }
  }, [anthropicApiKey, openaiApiKey, config, imageGenSettings.imageSize, imageGenSettings.imageQuality, initializeWorker]);

  // Build world schema from props
  const worldSchema = useMemo(() => {
    if (worldData?.schema) return worldData.schema;
    return schema || { entityKinds: [], relationshipKinds: [], cultures: [], tagRegistry: [] };
  }, [worldData?.schema, schema]);

  const simulationMetadata = useMemo(() => {
    if (!slotRecord) return undefined;
    return {
      currentTick: typeof slotRecord.finalTick === 'number' ? slotRecord.finalTick : undefined,
      currentEra: currentEra || undefined,
    };
  }, [slotRecord, currentEra]);

  // Extract era entities for palette generation (needs description from full entities)
  const [eraEntities, setEraEntities] = useState([]);
  useEffect(() => {
    const eraNavs = navEntities.filter((e) => e.kind === 'era');
    if (eraNavs.length === 0) { setEraEntities([]); return; }
    useEntityStore.getState().loadEntities(eraNavs.map((e) => e.id)).then((fullEras) => {
      setEraEntities(fullEras.map((e) => ({ id: e.id, name: e.name, description: e.description })));
    });
  }, [navEntities]);

  // Build subtypes by kind map for palette generation
  // Extract subtype IDs from Subtype objects ({ id, name } → id)
  const subtypesByKind = useMemo(() => {
    const map = {};
    for (const kindDef of worldSchema?.entityKinds || []) {
      if (kindDef.kind && kindDef.subtypes?.length > 0) {
        map[kindDef.kind] = kindDef.subtypes.map((st) => st.id);
      }
    }
    return map;
  }, [worldSchema?.entityKinds]);

  // Check if we have world data (from Dexie)
  const hasWorldData = navEntities.length > 0;
  const canImport = hasHardState;

  // Check if API keys are set
  const hasAnthropicKey = anthropicApiKey.length > 0;
  const hasOpenaiKey = openaiApiKey.length > 0;
  const hasRequiredKeys = hasAnthropicKey;

  // Get visual config for an entity (thesis/traits prompts, avoid elements, era)
  const getVisualConfig = useCallback(
    (entity) => {
      const visualConfig = getVisualConfigFromGuidance(entityGuidance, entity.kind);

      const entityEraId = resolveEntityEraId(entity);
      const entityFocalEra = entityEraId ? eraTemporalInfoByKey.get(entityEraId) : undefined;
      const entityAllEras = eraTemporalInfo.length > 0 ? eraTemporalInfo : undefined;

      return {
        ...visualConfig,
        entityEraId,
        entityFocalEra,
        entityAllEras,
      };
    },
    [entityGuidance, eraTemporalInfo, eraTemporalInfoByKey]
  );

  // Build prompt for entity using EntityGuidance and CultureIdentities directly
  const buildPrompt = useCallback(
    (entity, type) => {
      // Build relationships (use nav items for name/kind resolution)
      const relationships = (relationshipsByEntity.get(entity.id) || []).slice(0, 8).map((rel) => {
        const targetId = rel.src === entity.id ? rel.dst : rel.src;
        const target = entityNavMap.get(targetId);
        return {
          kind: rel.kind,
          targetName: target?.name || targetId,
          targetKind: target?.kind || 'unknown',
          targetSubtype: target?.subtype,
          strength: rel.strength,
        };
      });

      // Build entity context
      const entityContext = {
        entity: {
          id: entity.id,
          name: entity.name,
          kind: entity.kind,
          subtype: entity.subtype,
          prominence: prominenceLabelFromScale(entity.prominence, prominenceScale),
          culture: entity.culture || '',
          status: entity.status || 'active',
          summary: entity.summary || '',
          description: entity.description || '',
          tags: entity.tags || {},
          visualThesis: entity.enrichment?.text?.visualThesis || '',
          visualTraits: entity.enrichment?.text?.visualTraits || [],
        },
        relationships,
        era: {
          name: currentEra?.name || '',
          description: currentEra?.description,
        },
        entityAge: 'established',
        culturalPeers: (prominentByCulture[entity.culture] || [])
          .filter((peer) => peer.id !== entity.id)
          .slice(0, 3)
          .map((peer) => peer.name),
      };

      if (type === 'description') {
        // Get entity events from narrative history (filtered by significance)
        const entityEvents = getEntityEvents(
          narrativeEvents,
          {
            entityId: entity.id,
            minSignificance: config.minEventSignificance ?? 0.25,
            excludeProminenceOnly: true,
            limit: 10, // Cap at 10 events to avoid prompt bloat
          }
        );

        // Add events to entity context (use era name instead of tick)
        entityContext.events = entityEvents.map((e) => {
          // Get era name from nav items (era field is an ID)
          const eraEntity = entityNavMap.get(e.era);
          const eraName = eraEntity?.name || e.era;
          return {
            era: eraName,
            description: e.description,
            significance: e.significance,
            effects: getEntityEffects(e, entity.id).map((eff) => ({
              type: eff.type,
              description: eff.description,
            })),
          };
        });
        return buildDescriptionPromptFromGuidance(
          entityGuidance,
          cultureIdentities,
          worldContext,
          entityContext
        );
      } else if (type === 'image') {
        // Resolve style selection for this entity
        const resolvedStyle = resolveStyleSelection({
          selection: styleSelection,
          entityCultureId: entity.culture,
          entityKind: entity.kind,
          cultures: worldSchema?.cultures || [],
          styleLibrary,
        });

        // Build style info for the prompt
        const styleInfo = {
          artisticPromptFragment: resolvedStyle.artisticStyle?.promptFragment,
          compositionPromptFragment: resolvedStyle.compositionStyle?.promptFragment,
          colorPalettePromptFragment: resolvedStyle.colorPalette?.promptFragment,
          cultureKeywords: resolvedStyle.cultureKeywords,
        };

        return buildImagePromptFromGuidance(
          entityGuidance,
          cultureIdentities,
          worldContext,
          entityContext,
          styleInfo
        );
      }

      return `Describe ${entity.name}, a ${entity.subtype} ${entity.kind}.`;
    },
    [
      worldContext,
      entityGuidance,
      cultureIdentities,
      relationshipsByEntity,
      entityNavMap,
      currentEra,
      narrativeEvents,
      prominentByCulture,
      styleSelection,
      worldSchema?.cultures,
      styleLibrary,
      config.minEventSignificance,
      prominenceScale,
    ]
  );

  // Update config
  const updateConfig = useCallback((updates) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateWorldContext = useCallback(
    (updates) => {
      setLocalWorldContext((prev) => {
        const merged = { ...prev, ...updates };
        pendingWorldContextRef.current = merged;
        if (onWorldContextChange) {
          worldContextDirtyRef.current = true;
          if (worldContextSyncTimeoutRef.current) {
            clearTimeout(worldContextSyncTimeoutRef.current);
          }
          worldContextSyncTimeoutRef.current = setTimeout(() => {
            if (!worldContextDirtyRef.current) return;
            worldContextDirtyRef.current = false;
            onWorldContextChange(pendingWorldContextRef.current);
            worldContextSyncTimeoutRef.current = null;
          }, 300);
        }
        return merged;
      });
    },
    [onWorldContextChange]
  );

  // Update entity guidance
  const entityGuidanceSyncTimeoutRef = useRef(null);
  const updateEntityGuidance = useCallback(
    (nextGuidance) => {
      setLocalEntityGuidance(nextGuidance);
      pendingEntityGuidanceRef.current = nextGuidance;
      if (!onEntityGuidanceChange) return;
      if (entityGuidanceSyncTimeoutRef.current) {
        clearTimeout(entityGuidanceSyncTimeoutRef.current);
      }
      entityGuidanceSyncTimeoutRef.current = setTimeout(() => {
        onEntityGuidanceChange(pendingEntityGuidanceRef.current);
        entityGuidanceSyncTimeoutRef.current = null;
      }, 300);
    },
    [onEntityGuidanceChange]
  );

  // Update culture identities
  const cultureIdentitiesSyncTimeoutRef = useRef(null);
  const updateCultureIdentities = useCallback(
    (nextIdentities) => {
      setLocalCultureIdentities(nextIdentities);
      pendingCultureIdentitiesRef.current = nextIdentities;
      if (!onCultureIdentitiesChange) return;
      if (cultureIdentitiesSyncTimeoutRef.current) {
        clearTimeout(cultureIdentitiesSyncTimeoutRef.current);
      }
      cultureIdentitiesSyncTimeoutRef.current = setTimeout(() => {
        onCultureIdentitiesChange(pendingCultureIdentitiesRef.current);
        cultureIdentitiesSyncTimeoutRef.current = null;
      }, 300);
    },
    [onCultureIdentitiesChange]
  );

  useEffect(() => {
    return () => {
      if (worldContextSyncTimeoutRef.current) {
        clearTimeout(worldContextSyncTimeoutRef.current);
        worldContextSyncTimeoutRef.current = null;
      }
      if (entityGuidanceSyncTimeoutRef.current) {
        clearTimeout(entityGuidanceSyncTimeoutRef.current);
        entityGuidanceSyncTimeoutRef.current = null;
      }
      if (cultureIdentitiesSyncTimeoutRef.current) {
        clearTimeout(cultureIdentitiesSyncTimeoutRef.current);
        cultureIdentitiesSyncTimeoutRef.current = null;
      }
      if (worldContextDirtyRef.current && onWorldContextChange) {
        onWorldContextChange(pendingWorldContextRef.current);
      }
    };
  }, [onWorldContextChange]);

  // Dynamics generation (multi-turn LLM flow for world dynamics)
  const handleDynamicsAccepted = useCallback((proposedDynamics) => {
    if (!proposedDynamics?.length) return;
    const newDynamics = proposedDynamics.map((d, i) => ({
      id: `dyn_gen_${Date.now()}_${i}`,
      text: d.text,
      cultures: d.cultures?.length ? d.cultures : undefined,
      kinds: d.kinds?.length ? d.kinds : undefined,
      eraOverrides: d.eraOverrides && Object.keys(d.eraOverrides).length > 0 ? d.eraOverrides : undefined,
    }));
    const existing = worldContext?.worldDynamics || [];
    updateWorldContext({ worldDynamics: [...existing, ...newDynamics] });
  }, [worldContext, updateWorldContext]);

  const {
    run: dynamicsRun,
    isActive: isDynamicsActive,
    startGeneration: startDynamicsGeneration,
    submitFeedback: submitDynamicsFeedback,
    acceptDynamics,
    cancelGeneration: cancelDynamicsGeneration,
  } = useDynamicsGeneration(handleDynamicsAccepted);

  // Summary revision (batch entity summary/description revision)
  const getEntityContextsForRevision = useCallback(async (entityIds) => {
    const fullEntities = await useEntityStore.getState().loadEntities(entityIds);
    return fullEntities.map((entity) => {
      const rels = (relationshipsByEntity.get(entity.id) || []).slice(0, 8).map((rel) => {
        const targetId = rel.src === entity.id ? rel.dst : rel.src;
        const target = entityNavMap.get(targetId);
        return {
          kind: rel.kind,
          targetName: target?.name || targetId,
          targetKind: target?.kind || 'unknown',
        };
      });

      // Collect existing backref anchor phrases so the LLM can preserve them
      const existingAnchorPhrases = (entity.enrichment?.chronicleBackrefs || [])
        .map((br) => br.anchorPhrase)
        .filter(Boolean);

      // Per-kind description focus from entity guidance config
      const kindFocus = entityGuidance[entity.kind]?.focus || '';

      return {
        id: entity.id,
        name: entity.name,
        kind: entity.kind,
        subtype: entity.subtype || '',
        prominence: prominenceLabelFromScale(entity.prominence, prominenceScale),
        culture: entity.culture || '',
        status: entity.status || 'active',
        summary: entity.summary || '',
        description: entity.description || '',
        visualThesis: entity.enrichment?.text?.visualThesis || '',
        relationships: rels,
        aliases: (entity.enrichment?.text?.aliases || []).filter(a => typeof a === 'string' && a.length >= 3),
        ...(existingAnchorPhrases.length > 0 ? { existingAnchorPhrases } : {}),
        ...(kindFocus ? { kindFocus } : {}),
      };
    });
  }, [entityNavMap, relationshipsByEntity, prominenceScale, entityGuidance]);

  const handleRevisionApplied = useCallback(async (patches, source = 'summary-revision') => {
    if (!patches?.length) return;
    const updatedIds = await entityRepo.applyRevisionPatches(patches, source);
    await reloadEntities(updatedIds);
  }, [reloadEntities]);

  const {
    run: revisionRun,
    isActive: isRevisionActive,
    startRevision,
    continueToNextBatch,
    autoContineAll: autoContineAllRevision,
    togglePatchDecision,
    applyAccepted: applyAcceptedPatches,
    cancelRevision,
  } = useSummaryRevision(getEntityContextsForRevision);

  // Revision filter modal state
  const [revisionFilter, setRevisionFilter] = useState({
    open: false,
    totalEligible: 0,
    usedInChronicles: 0,
    chronicleEntityIds: new Set(),
  });

  const handleOpenRevisionFilter = useCallback(async () => {
    if (!projectId || !simulationRunId) return;

    const eligible = navEntities.filter((e) => e.hasDescription && !e.lockedSummary);

    let chronicleEntityIds = new Set();
    try {
      const usageStats = await getEntityUsageStats(simulationRunId);
      chronicleEntityIds = new Set(usageStats.keys());
    } catch (err) {
      console.warn('[Revision] Failed to load chronicle usage stats:', err);
    }

    const usedInChronicles = eligible.filter((e) => chronicleEntityIds.has(e.id)).length;

    setRevisionFilter({
      open: true,
      totalEligible: eligible.length,
      usedInChronicles,
      chronicleEntityIds,
    });
  }, [projectId, simulationRunId, navEntities]);

  const handleStartRevision = useCallback(async (excludeChronicleEntities) => {
    if (!projectId || !simulationRunId) return;

    setRevisionFilter((prev) => ({ ...prev, open: false }));

    // Load static pages for lore context
    let staticPagesContext = '';
    try {
      const pages = await getPublishedStaticPagesForProject(projectId);
      if (pages.length > 0) {
        staticPagesContext = pages
          .map((p) => `## ${p.title}\n\n${p.content}`)
          .join('\n\n---\n\n');
      }
    } catch (err) {
      console.warn('[Revision] Failed to load static pages:', err);
    }

    // Build world dynamics context
    const dynamicsContext = (worldContext?.worldDynamics || [])
      .map((d) => {
        let text = d.text;
        if (d.cultures?.length) text += ` [cultures: ${d.cultures.join(', ')}]`;
        if (d.kinds?.length) text += ` [kinds: ${d.kinds.join(', ')}]`;
        return `- ${text}`;
      })
      .join('\n');

    // Build schema context
    const schemaContext = buildSchemaContext(worldSchema);

    // Filter eligible entity IDs via lightweight nav items, then load full records from Dexie
    const eligibleIds = navEntities
      .filter((nav) => {
        if (!nav.hasDescription || nav.lockedSummary) return false;
        if (excludeChronicleEntities && revisionFilter.chronicleEntityIds.has(nav.id)) return false;
        return true;
      })
      .map((nav) => nav.id);

    const fullEntities = await useEntityStore.getState().loadEntities(eligibleIds);

    const revisionEntities = fullEntities
      .filter((e) => e.summary && e.description)
      .map((e) => {
        const rels = (relationshipsByEntity.get(e.id) || []).slice(0, 8).map((rel) => {
          const targetId = rel.src === e.id ? rel.dst : rel.src;
          const target = entityNavMap.get(targetId);
          return {
            kind: rel.kind,
            targetName: target?.name || targetId,
            targetKind: target?.kind || 'unknown',
          };
        });

        return {
          id: e.id,
          name: e.name,
          kind: e.kind,
          subtype: e.subtype || '',
          prominence: prominenceLabelFromScale(e.prominence, prominenceScale),
          culture: e.culture || '',
          status: e.status || 'active',
          summary: e.summary || '',
          description: e.description || '',
          visualThesis: e.enrichment?.text?.visualThesis || '',
          relationships: rels,
        };
      });

    startRevision({
      projectId,
      simulationRunId,
      worldDynamicsContext: dynamicsContext,
      staticPagesContext,
      schemaContext,
      revisionGuidance: '',
      entities: revisionEntities,
    });
  }, [projectId, simulationRunId, worldContext, worldSchema, navEntities, entityNavMap, relationshipsByEntity, prominenceScale, startRevision, revisionFilter.chronicleEntityIds]);

  const handleAcceptRevision = useCallback(() => {
    const patches = applyAcceptedPatches();
    handleRevisionApplied(patches);
  }, [applyAcceptedPatches, handleRevisionApplied]);

  // Chronicle lore backport (extract lore from published chronicles into cast entity descriptions)
  const {
    run: backportRun,
    isActive: isBackportActive,
    chronicleId: backportChronicleId,
    startBackport,
    togglePatchDecision: toggleBackportPatchDecision,
    updateAnchorPhrase: updateBackportAnchorPhrase,
    applyAccepted: applyAcceptedBackportPatches,
    cancelBackport,
  } = useChronicleLoreBackport(getEntityContextsForRevision);

  // Shared context assembly for both single and bulk backport
  const assembleContextForChronicle = useCallback(async (chronicleId) => {
    if (!projectId || !simulationRunId || !chronicleId) return null;

    const chronicle = await getChronicle(chronicleId);
    if (!chronicle?.finalContent) return null;

    const roleAssignments = chronicle.roleAssignments || [];
    const castEntityIds = roleAssignments.map((r) => r.entityId);
    const baseContexts = await getEntityContextsForRevision(castEntityIds);
    if (baseContexts.length === 0) return null;

    const primarySet = new Set(roleAssignments.filter((r) => r.isPrimary).map((r) => r.entityId));
    const castContexts = baseContexts.map((ctx) => ({
      ...ctx,
      isPrimary: primarySet.has(ctx.id),
    }));

    if (chronicle.lens && !castEntityIds.includes(chronicle.lens.entityId)) {
      const lensContexts = await getEntityContextsForRevision([chronicle.lens.entityId]);
      if (lensContexts.length > 0) {
        castContexts.push({ ...lensContexts[0], isLens: true });
      }
    }

    const allContexts = [...castContexts];
    const acceptedTertiary = (chronicle.tertiaryCast || []).filter(e => e.accepted);
    if (acceptedTertiary.length > 0) {
      const existingIds = new Set(allContexts.map(c => c.id));
      const tertiaryFiltered = acceptedTertiary.filter(e => !existingIds.has(e.entityId));
      const tertiaryIds = tertiaryFiltered.map(e => e.entityId);
      if (tertiaryIds.length > 0) {
        const tertiaryContexts = await getEntityContextsForRevision(tertiaryIds);
        const tertiaryByEntityId = new Map(tertiaryFiltered.map(t => [t.entityId, t]));
        for (const ctx of tertiaryContexts) {
          const entry = tertiaryByEntityId.get(ctx.id);
          const matchedAs = entry?.matchedAs;
          allContexts.push({
            ...ctx,
            isTertiary: true,
            ...(matchedAs && matchedAs !== ctx.name ? { chronicleName: matchedAs } : {}),
          });
        }
      }
    }

    let perspectiveSynthesisJson = '';
    const ps = chronicle.perspectiveSynthesis;
    if (ps) {
      perspectiveSynthesisJson = JSON.stringify({
        brief: ps.brief || '',
        facets: ps.facets || [],
        narrativeVoice: ps.narrativeVoice || {},
        entityDirectives: ps.entityDirectives || [],
        suggestedMotifs: ps.suggestedMotifs || [],
        chronicleFormat: chronicle.format || '',
        ...(chronicle.narrativeDirection ? { narrativeDirection: chronicle.narrativeDirection } : {}),
      });
    }

    const perEntityStatus = {};
    const chronicleBackportMap = chronicle.entityBackportStatus || {};
    // Load full entities for backref checking (only those not already resolved via chronicle map)
    const unresolvedIds = allContexts
      .filter((ctx) => !chronicleBackportMap[ctx.id])
      .map((ctx) => ctx.id);
    const loadedEntities = unresolvedIds.length > 0
      ? await useEntityStore.getState().loadEntities(unresolvedIds)
      : [];
    const loadedMap = new Map(loadedEntities.map((e) => [e.id, e]));

    for (const ctx of allContexts) {
      if (chronicleBackportMap[ctx.id]) {
        perEntityStatus[ctx.id] = chronicleBackportMap[ctx.id].status;
        continue;
      }
      const entity = loadedMap.get(ctx.id);
      const hasBackref = (entity?.enrichment?.chronicleBackrefs || [])
        .some(br => br.chronicleId === chronicleId);
      if (hasBackref) {
        perEntityStatus[ctx.id] = 'backported';
      }
    }

    return {
      chronicleId,
      chronicleTitle: chronicle.title || 'Untitled Chronicle',
      entities: allContexts,
      chronicleText: chronicle.finalContent,
      perspectiveSynthesisJson,
      perEntityStatus,
    };
  }, [projectId, simulationRunId, getEntityContextsForRevision]);

  // Backport config modal state
  const [backportConfig, setBackportConfig] = useState(null);
  const backportSentEntityIdsRef = useRef(null); // Track entity IDs sent in most recent backport

  const handleBackportLore = useCallback(async (chronicleId) => {
    const context = await assembleContextForChronicle(chronicleId);
    if (!context) {
      console.warn('[Backport] Could not assemble context for chronicle:', chronicleId);
      return;
    }
    setBackportConfig(context);
  }, [assembleContextForChronicle]);

  const handleBackportConfigStart = useCallback((selectedEntityIds, customInstructions) => {
    if (!backportConfig || !projectId || !simulationRunId) return;

    const selectedEntities = backportConfig.entities.filter(e => selectedEntityIds.includes(e.id));
    if (selectedEntities.length === 0) return;

    // Track which entities were sent so handleAcceptBackport can mark them all
    backportSentEntityIdsRef.current = selectedEntityIds;

    startBackport({
      projectId,
      simulationRunId,
      chronicleId: backportConfig.chronicleId,
      chronicleText: backportConfig.chronicleText,
      perspectiveSynthesisJson: backportConfig.perspectiveSynthesisJson,
      entities: selectedEntities,
      customInstructions: customInstructions || undefined,
    });

    setBackportConfig(null);
  }, [backportConfig, projectId, simulationRunId, startBackport]);

  const handleAcceptBackport = useCallback(async () => {
    const cId = backportChronicleId;
    const patches = applyAcceptedBackportPatches();
    if (!patches?.length) return;

    // Apply revision patches + revalidate backrefs, then reload once
    const updatedIds = await entityRepo.applyRevisionPatches(patches, 'lore-backport');
    if (cId) {
      await entityRepo.revalidateBackrefs(patches, { chronicleId: cId });
    }
    await reloadEntities(updatedIds);

    // Mark all sent entities as backported (not just those with patches —
    // entities with no LLM changes are still "done" for this chronicle)
    if (cId) {
      const sentIds = backportSentEntityIdsRef.current || patches.map((p) => p.entityId);
      const now = Date.now();
      const entries = sentIds.map(id => ({
        entityId: id,
        status: 'backported',
        updatedAt: now,
      }));
      updateChronicleEntityBackportStatus(cId, entries).then(() => {
        setChronicleRefreshTrigger((n) => n + 1);
      }).catch((err) => {
        console.warn('[Backport] Failed to set entity backport status:', err);
      });
      backportSentEntityIdsRef.current = null;
    }
  }, [applyAcceptedBackportPatches, backportChronicleId, reloadEntities]);

  const handleMarkEntityNotNeeded = useCallback(async (entityIds) => {
    if (!backportConfig?.chronicleId) return;
    const now = Date.now();
    const entries = entityIds.map(id => ({
      entityId: id,
      status: 'not_needed',
      updatedAt: now,
    }));
    await updateChronicleEntityBackportStatus(backportConfig.chronicleId, entries);
    // Update local modal state
    setBackportConfig(prev => {
      if (!prev) return null;
      const updated = { ...prev.perEntityStatus };
      for (const id of entityIds) {
        updated[id] = 'not_needed';
      }
      return { ...prev, perEntityStatus: updated };
    });
    setChronicleRefreshTrigger((n) => n + 1);
  }, [backportConfig]);

  // ---- Bulk backport (multi-chronicle, chunked) ----

  const applyBulkPatches = useCallback(async (patches, chronicleId, sentEntityIds) => {
    if (patches.length > 0) {
      // Apply revision patches + revalidate backrefs, then reload once
      const updatedIds = await entityRepo.applyRevisionPatches(patches, 'lore-backport');
      await entityRepo.revalidateBackrefs(patches, { chronicleId });
      await reloadEntities(updatedIds);
    }

    // Mark all sent entities as backported on the chronicle record
    const now = Date.now();
    const entries = sentEntityIds.map(id => ({
      entityId: id,
      status: 'backported',
      updatedAt: now,
    }));
    await updateChronicleEntityBackportStatus(chronicleId, entries);
    setChronicleRefreshTrigger((n) => n + 1);
  }, [reloadEntities]);

  const getEligibleChronicleIds = useCallback(async (simRunId) => {
    const allChronicles = await getChroniclesForSimulation(simRunId);
    return allChronicles
      .filter((c) => {
        if (!c.finalContent) return false;
        const progress = computeBackportProgress(c);
        return progress.done < progress.total;
      })
      .map((c) => {
        const progress = computeBackportProgress(c);
        return {
          chronicleId: c.chronicleId,
          chronicleTitle: c.title || 'Untitled Chronicle',
          pendingCount: progress.total - progress.done,
        };
      });
  }, []);

  const bulkBackportDeps = useMemo(() => ({
    assembleContextForChronicle,
    applyPatches: applyBulkPatches,
    getEligibleChronicleIds,
  }), [assembleContextForChronicle, applyBulkPatches, getEligibleChronicleIds]);

  const {
    progress: bulkBackportProgress,
    isActive: isBulkBackportActive,
    prepareBulkBackport,
    confirmBulkBackport,
    cancelBulkBackport,
  } = useBulkBackport(bulkBackportDeps);

  const [showBulkBackportModal, setShowBulkBackportModal] = useState(false);

  const handleStartBulkBackport = useCallback(async () => {
    if (!simulationRunId || !projectId) return;
    setShowBulkBackportModal(true);
    await prepareBulkBackport(simulationRunId, projectId);
  }, [simulationRunId, projectId, prepareBulkBackport]);

  // Close modal if prepare found nothing (progress stays idle)
  useEffect(() => {
    if (showBulkBackportModal && bulkBackportProgress.status === 'idle') {
      // Small delay to avoid closing during the brief async gap
      const timer = setTimeout(() => {
        if (bulkBackportProgress.status === 'idle') {
          setShowBulkBackportModal(false);
          alert('No chronicles eligible for backport (all already backported or unpublished).');
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showBulkBackportModal, bulkBackportProgress.status]);

  const handleConfirmBulkBackport = useCallback(() => {
    confirmBulkBackport();
  }, [confirmBulkBackport]);

  const handleCancelBulkBackport = useCallback(() => {
    cancelBulkBackport();
    setShowBulkBackportModal(false);
  }, [cancelBulkBackport]);

  const handleCloseBulkBackport = useCallback(() => {
    setShowBulkBackportModal(false);
  }, []);

  // Historian edition (historian-voiced description synthesis from full archive)
  const {
    run: historianEditionRun,
    isActive: isHistorianEditionActive,
    startHistorianEdition,
    togglePatchDecision: toggleHistorianEditionPatchDecision,
    applyAccepted: applyAcceptedHistorianEditionPatches,
    cancelHistorianEdition,
  } = useHistorianEdition();

  const handleRenameApplied = useCallback(async ({ entityPatches, eventPatches, targetEntityId, newName, addOldNameAsAlias }) => {
    try {
      // 1. Write entity patches to Dexie (source of truth)
      const updatedIds = await entityRepo.applyRename(targetEntityId, newName, entityPatches, simulationRunId, addOldNameAsAlias);

      // 2. Write narrative event patches to Dexie
      if (eventPatches.length > 0) {
        await eventRepo.applyEventPatches(eventPatches, simulationRunId);
      }

      // 3. Recompute indexes (rename changes prominentByCulture names)
      const allEntities = await entityRepo.getEntitiesForRun(simulationRunId);
      const indexRecord = computeRunIndexes(simulationRunId, allEntities);
      await upsertRunIndexes(indexRecord);
      await useIndexStore.getState().refreshAll();

      // 4. Reload entities + events from Dexie (rename patches both)
      await reloadEntitiesAndEvents(updatedIds);
    } catch (err) {
      console.error('[Illuminator] Rename persist failed:', err);
    }

    useIlluminatorModals.getState().closeRename();
    setChronicleRefreshTrigger((n) => n + 1);
  }, [simulationRunId, reloadEntitiesAndEvents]);

  // Manual entity creation
  const handleCreateEntity = useCallback(async (entityData) => {
    if (!simulationRunId) return;
    try {
      const created = await entityRepo.createEntity(simulationRunId, entityData);

      // Recompute indexes (new entity may affect prominence distribution)
      const allEntities = await entityRepo.getEntitiesForRun(simulationRunId);
      const indexRecord = computeRunIndexes(simulationRunId, allEntities);
      await upsertRunIndexes(indexRecord);
      await useIndexStore.getState().refreshAll();

      await reloadEntities([created.id]);
    } catch (err) {
      console.error('[Illuminator] Create entity failed:', err);
    }
    useIlluminatorModals.getState().closeCreateEntity();
  }, [simulationRunId, reloadEntities]);

  // Manual entity editing (manual_ entities only)
  const handleEditEntity = useCallback(async (entityData) => {
    if (!editEntityModal) return;
    try {
      await entityRepo.updateEntityFields(editEntityModal.id, {
        ...entityData,
        updatedAt: Date.now(),
      });
      await reloadEntities([editEntityModal.id]);
    } catch (err) {
      console.error('[Illuminator] Edit entity failed:', err);
    }
    useIlluminatorModals.getState().closeEditEntity();
  }, [editEntityModal, reloadEntities]);

  // Historian review (scholarly annotations for entities and chronicles)
  const {
    run: historianRun,
    isActive: isHistorianActive,
    startReview: startHistorianReview,
    toggleNoteDecision: toggleHistorianNoteDecision,
    applyAccepted: applyAcceptedHistorianNotes,
    cancelReview: cancelHistorianReview,
  } = useHistorianReview();

  // Register historian start functions for useHistorianActions bridge
  registerHistorianStarters({ startHistorianEdition, startHistorianReview });

  // Sync historian isActive flags to config store for reactive reads
  useEffect(() => {
    useIlluminatorConfigStore.getState().setConfig({
      isHistorianEditionActive,
      isHistorianActive,
    });
  }, [isHistorianEditionActive, isHistorianActive]);

  // Accept historian edition — apply the rewritten description
  const handleAcceptHistorianEdition = useCallback(async () => {
    const patches = applyAcceptedHistorianEditionPatches();
    if (!patches?.length) return;

    // Apply revision patches + clear historian notes, then reload once
    const updatedIds = await entityRepo.applyRevisionPatches(patches, 'historian-edition');
    for (const patch of patches) {
      if (patch.entityId) {
        await entityRepo.setHistorianNotes(patch.entityId, []);
      }
    }
    await reloadEntities(updatedIds);
  }, [applyAcceptedHistorianEditionPatches, reloadEntities]);

  // Standalone result-application callbacks — used by both single-entity and bulk flows
  const applyReviewNotesForEntity = useCallback(async (entityId, notes) => {
    await entityRepo.setHistorianNotes(entityId, notes);
  }, []);

  const applyEditionPatchesForEntity = useCallback(async (patches) => {
    const updatedIds = await entityRepo.applyRevisionPatches(patches, 'historian-edition');
    for (const patch of patches) {
      if (patch.entityId) {
        await entityRepo.setHistorianNotes(patch.entityId, []);
      }
    }
    return updatedIds;
  }, []);

  // Cache corpus fact strength for the session to avoid recomputing per-chronicle
  const corpusStrengthCacheRef = useRef({ runId: null, strength: null });

  const handleChronicleHistorianReview = useCallback(async (chronicleId, tone) => {
    if (!projectId || !simulationRunId || !chronicleId) return;
    if (!isHistorianConfigured(historianConfig)) return;

    const chronicle = await getChronicle(chronicleId);
    if (!chronicle) return;

    if (chronicle.status !== 'complete' || !chronicle.finalContent) return;
    const content = chronicle.finalContent;

    // Build cast summaries — load full entities for summary/description access
    const castEntityIds = (chronicle.roleAssignments || []).map((ra) => ra.entityId).filter(Boolean);
    const castFull = await useEntityStore.getState().loadEntities(castEntityIds);
    const castMap = new Map(castFull.map((e) => [e.id, e]));

    const castSummaries = (chronicle.roleAssignments || []).slice(0, 10).map((ra) => {
      const entity = castMap.get(ra.entityId);
      if (!entity) return null;
      return {
        name: entity.name,
        kind: entity.kind,
        summary: entity.summary || entity.description?.slice(0, 200) || '',
      };
    }).filter(Boolean);

    const cast = (chronicle.roleAssignments || []).map((ra) => {
      const entity = castMap.get(ra.entityId);
      return {
        entityName: entity?.name || ra.entityId,
        role: ra.role,
        kind: entity?.kind || 'unknown',
      };
    });

    // Compute fact coverage guidance if report exists
    let factCoverageGuidance = undefined;
    if (chronicle.factCoverageReport?.entries?.length) {
      if (corpusStrengthCacheRef.current.runId !== simulationRunId) {
        corpusStrengthCacheRef.current = {
          runId: simulationRunId,
          strength: await computeCorpusFactStrength(simulationRunId),
        };
      }
      const constraintFactIds = new Set(
        (worldContext.canonFactsWithMetadata || [])
          .filter((f) => f.type === 'generation_constraint' || f.disabled)
          .map((f) => f.id),
      );
      factCoverageGuidance = buildFactCoverageGuidance(
        chronicle.factCoverageReport,
        corpusStrengthCacheRef.current.strength,
        constraintFactIds,
      );
    }

    const contextJson = JSON.stringify({
      chronicleId: chronicle.chronicleId,
      title: chronicle.title || 'Untitled',
      format: chronicle.format,
      narrativeStyleId: chronicle.narrativeStyleId || '',
      cast,
      castSummaries,
      canonFacts: (worldContext.canonFactsWithMetadata || []).map((f) => f.text),
      worldDynamics: (worldContext.worldDynamics || []).map((d) => d.text),
      factCoverageGuidance,
      temporalNarrative: chronicle.perspectiveSynthesis?.temporalNarrative || undefined,
      focalEra: chronicle.temporalContext?.focalEra
        ? { name: chronicle.temporalContext.focalEra.name, description: chronicle.temporalContext.focalEra.description }
        : undefined,
      temporalCheckReport: chronicle.temporalCheckReport || undefined,
    });

    const relatedEntityIds = new Set(
      (chronicle.roleAssignments || [])
        .map((ra) => ra.entityId)
        .filter(Boolean)
    );
    const previousNotes = await collectPreviousNotes({
      relatedEntityIds: Array.from(relatedEntityIds),
    });

    startHistorianReview({
      projectId,
      simulationRunId,
      targetType: 'chronicle',
      targetId: chronicleId,
      targetName: chronicle.title || 'Untitled Chronicle',
      sourceText: content,
      contextJson,
      previousNotesJson: JSON.stringify(previousNotes),
      historianConfig,
      tone: tone || chronicle.assignedTone || 'weary',
    });
  }, [projectId, simulationRunId, worldContext, historianConfig, startHistorianReview]);

  // Bulk historian (sequential annotation or copy-edit for all filtered entities)
  const bulkHistorianDeps = useMemo(() => ({
    buildReviewContext: buildHistorianReviewContext,
    buildEditionContext: buildHistorianEditionContext,
    applyReviewNotes: applyReviewNotesForEntity,
    applyEditionPatches: applyEditionPatchesForEntity,
    reloadEntities,
    getEntityNav: (entityId) => entityNavMap.get(entityId),
  }), [applyReviewNotesForEntity, applyEditionPatchesForEntity, reloadEntities, entityNavMap]);

  const {
    progress: bulkHistorianProgress,
    isActive: isBulkHistorianActive,
    prepareBulkHistorian,
    confirmBulkHistorian,
    cancelBulkHistorian,
    setTone: setBulkHistorianTone,
  } = useBulkHistorian(bulkHistorianDeps);

  const [showBulkHistorianModal, setShowBulkHistorianModal] = useState(false);
  const editionMaxTokens = useMemo(() => getLLMCallConfig('historian.edition').maxTokens, []);

  const handleStartBulkHistorianReview = useCallback((eligibleEntityIds) => {
    prepareBulkHistorian('review', 'scholarly', eligibleEntityIds);
    setShowBulkHistorianModal(true);
  }, [prepareBulkHistorian]);

  const handleStartBulkHistorianEdition = useCallback((eligibleEntityIds, reEdition) => {
    prepareBulkHistorian('edition', 'scholarly', eligibleEntityIds, reEdition);
    setShowBulkHistorianModal(true);
  }, [prepareBulkHistorian]);

  const handleStartBulkHistorianClear = useCallback((eligibleEntityIds) => {
    prepareBulkHistorian('clear', 'scholarly', eligibleEntityIds);
    setShowBulkHistorianModal(true);
  }, [prepareBulkHistorian]);

  const handleConfirmBulkHistorian = useCallback(() => {
    confirmBulkHistorian();
  }, [confirmBulkHistorian]);

  const handleCancelBulkHistorian = useCallback(() => {
    cancelBulkHistorian();
    setShowBulkHistorianModal(false);
  }, [cancelBulkHistorian]);

  const handleCloseBulkHistorian = useCallback(() => {
    setShowBulkHistorianModal(false);
  }, []);

  // Close modal if prepare found no eligible entities
  useEffect(() => {
    if (showBulkHistorianModal && bulkHistorianProgress.status === 'idle') {
      const timer = setTimeout(() => {
        if (bulkHistorianProgress.status === 'idle') {
          setShowBulkHistorianModal(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showBulkHistorianModal, bulkHistorianProgress.status]);

  // Tone Ranking — state lives in Zustand store, persists across tab switches
  const toneRankingProgress = useToneRankingStore((s) => s.progress);
  const confirmToneRanking = useToneRankingStore((s) => s.confirmToneRanking);
  const cancelToneRanking = useToneRankingStore((s) => s.cancelToneRanking);
  const closeToneRanking = useToneRankingStore((s) => s.closeToneRanking);
  const toneAssignmentPreview = useToneRankingStore((s) => s.assignmentPreview);
  const applyToneAssignment = useToneRankingStore((s) => s.applyAssignment);
  const closeToneAssignment = useToneRankingStore((s) => s.closeAssignment);

  // Bulk Chronicle Annotations — state lives in Zustand store
  const bulkAnnotationProgress = useBulkChronicleAnnotationStore((s) => s.progress);
  const confirmBulkAnnotation = useBulkChronicleAnnotationStore((s) => s.confirmAnnotation);
  const cancelBulkAnnotation = useBulkChronicleAnnotationStore((s) => s.cancelAnnotation);
  const closeBulkAnnotation = useBulkChronicleAnnotationStore((s) => s.closeAnnotation);

  // Interleaved Annotation — Zustand store
  const interleavedProgress = useInterleavedAnnotationStore((s) => s.progress);
  const confirmInterleaved = useInterleavedAnnotationStore((s) => s.confirmInterleaved);
  const cancelInterleaved = useInterleavedAnnotationStore((s) => s.cancelInterleaved);
  const closeInterleaved = useInterleavedAnnotationStore((s) => s.closeInterleaved);

  const handleAcceptHistorianNotes = useCallback(async () => {
    const targetId = historianRun?.targetId;
    const targetType = historianRun?.targetType;
    const notes = applyAcceptedHistorianNotes();
    if (notes.length === 0) return;

    if (targetType === 'entity' && targetId) {
      await entityRepo.setHistorianNotes(targetId, notes);
      await reloadEntities([targetId]);
    } else if (targetType === 'chronicle' && targetId) {
      try {
        const prompts = historianRun.systemPrompt && historianRun.userPrompt
          ? { systemPrompt: historianRun.systemPrompt, userPrompt: historianRun.userPrompt }
          : undefined;
        const reinforcedFacts = historianRun.contextJson
          ? extractReinforcedFactIds(historianRun.contextJson)
          : undefined;
        await updateChronicleHistorianNotes(targetId, notes, prompts, reinforcedFacts);
        await useChronicleStore.getState().refreshChronicle(targetId);
      } catch (err) {
        console.error('[Historian] Failed to save chronicle notes:', err);
      }
    }
  }, [applyAcceptedHistorianNotes, historianRun, reloadEntities]);

  const handleUpdateHistorianNote = useCallback(async (targetType, targetId, noteId, updates) => {
    if (targetType === 'entity' && targetId) {
      const entity = await useEntityStore.getState().loadEntity(targetId);
      if (!entity?.enrichment?.historianNotes) return;
      const updatedNotes = entity.enrichment.historianNotes.map((n) =>
        n.noteId === noteId ? { ...n, ...updates } : n
      );
      await entityRepo.setHistorianNotes(targetId, updatedNotes);
      await reloadEntities([targetId]);
    } else if (targetType === 'chronicle' && targetId) {
      try {
        const chronicle = await getChronicle(targetId);
        if (!chronicle?.historianNotes) return;
        const updatedNotes = chronicle.historianNotes.map((n) =>
          n.noteId === noteId ? { ...n, ...updates } : n
        );
        await updateChronicleHistorianNotes(targetId, updatedNotes);
        await useChronicleStore.getState().refreshChronicle(targetId);
      } catch (err) {
        console.error('[Historian] Failed to update note:', err);
      }
    }
  }, [reloadEntities]);

  const handleEditHistorianNoteText = useCallback((noteId, newText) => {
    if (!historianRun) return;
    const updatedNotes = historianRun.notes.map((n) =>
      n.noteId === noteId ? { ...n, text: newText } : n
    );
    // Update local state (the run object in the hook)
    // We need to update via the storage to keep in sync
    import('./lib/db/historianRepository').then(({ updateHistorianRun: updateRun }) => {
      updateRun(historianRun.runId, { notes: updatedNotes });
    });
  }, [historianRun]);

  const handleGenerateDynamics = useCallback(async () => {
    if (!projectId || !simulationRunId) return;

    // Load static pages for lore context
    let staticPagesContext = '';
    try {
      const pages = await getPublishedStaticPagesForProject(projectId);
      if (pages.length > 0) {
        staticPagesContext = pages
          .map((p) => `## ${p.title}\n\n${p.content}`)
          .join('\n\n---\n\n');
      }
    } catch (err) {
      console.warn('[Dynamics] Failed to load static pages:', err);
    }

    // Build schema context
    const schemaContext = buildSchemaContext(worldSchema);

    // Build entity context — load full entities from Dexie (needs description, tags)
    const allEntities = await entityRepo.getEntitiesForRun(simulationRunId);
    const entityContexts = allEntities.map((e) => ({
      id: e.id,
      name: e.name,
      kind: e.kind,
      subtype: e.subtype || '',
      culture: e.culture || '',
      status: e.status || '',
      summary: e.summary || '',
      description: e.description || '',
      tags: e.tags || {},
      eraId: e.eraId,
    }));

    const relationshipsPayload = relationships.map((r) => ({
      src: r.src,
      dst: r.dst,
      kind: r.kind,
      weight: r.weight ?? r.strength,
      srcName: entityNavMap.get(r.src)?.name || r.src,
      dstName: entityNavMap.get(r.dst)?.name || r.dst,
    }));

    startDynamicsGeneration({
      projectId,
      simulationRunId,
      staticPagesContext,
      schemaContext,
      entities: entityContexts,
      relationships: relationshipsPayload,
    });
  }, [projectId, simulationRunId, worldSchema, entityNavMap, relationships, startDynamicsGeneration]);

  if (!hasWorldData) {
    return (
      <div className="illuminator-empty-state">
        <div className="illuminator-empty-state-icon">&#x2728;</div>
        <div className="illuminator-empty-state-title">
          {canImport ? 'No Local Data Loaded' : 'No World Data'}
        </div>
        <div className="illuminator-empty-state-desc">
          {canImport
            ? 'Dexie is empty for this slot. Import from hard state to begin.'
            : (
              <>
                Run a simulation in <strong>Lore Weave</strong> first, then return here to enrich your
                world with LLM-generated descriptions and images.
              </>
            )}
        </div>
        {canImport && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="illuminator-btn illuminator-btn-primary"
              disabled={isDataSyncing}
              onClick={() => handleDataSync('patch')}
            >
              {isDataSyncing ? 'Importing...' : 'Patch from Hard State'}
            </button>
            <button
              type="button"
              className="illuminator-btn illuminator-btn-danger"
              disabled={isDataSyncing}
              onClick={() => handleDataSync('overwrite')}
            >
              Overwrite from Hard State
            </button>
          </div>
        )}
        {dataSyncStatus && (
          <div style={{ marginTop: '12px', fontSize: '12px', color: dataSyncStatus.type === 'error' ? '#ef4444' : '#10b981' }}>
            {dataSyncStatus.message}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="illuminator-container">
      {/* Left sidebar with nav, progress, and API keys */}
      <div className="illuminator-sidebar">
        <nav className="illuminator-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`illuminator-nav-button ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
              {tab.id === 'activity' && stats.running > 0 && (
                <span
                  style={{
                    marginLeft: 'auto',
                    background: '#f59e0b',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    fontSize: '10px',
                  }}
                >
                  {stats.running}
                </span>
              )}
              {tab.id === 'activity' && stats.errored > 0 && stats.running === 0 && (
                <span
                  style={{
                    marginLeft: 'auto',
                    background: '#ef4444',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    fontSize: '10px',
                  }}
                >
                  {stats.errored}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        {/* Image Settings trigger */}
        <div style={{ padding: '0 8px', marginBottom: '4px' }}>
          <ImageSettingsTrigger
            settings={imageGenSettings}
            styleLibrary={styleLibrary}
            onClick={() => useIlluminatorModals.getState().openImageSettings()}
          />
        </div>

        {/* API Key section */}
        <div className="illuminator-api-section">
          <button
            onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            className={`illuminator-api-button ${hasRequiredKeys ? 'active' : ''}`}
          >
            {hasRequiredKeys ? 'API Keys Set' : 'Set API Keys'}
          </button>
          {showApiKeyInput && (
            <div className="illuminator-api-dropdown">
              <div className="illuminator-api-dropdown-title">Anthropic API Key</div>
              <p className="illuminator-api-dropdown-hint">Required for text enrichment.</p>
              <input
                type="password"
                value={anthropicApiKey}
                onChange={(e) => setAnthropicApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="illuminator-api-input"
              />
              <div className="illuminator-api-dropdown-title">OpenAI API Key</div>
              <p className="illuminator-api-dropdown-hint">Required for image generation.</p>
              <input
                type="password"
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                placeholder="sk-..."
                className="illuminator-api-input"
              />
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={persistApiKeys}
                  onChange={(e) => setPersistApiKeys(e.target.checked)}
                />
                Remember API keys (stored in browser)
              </label>
              <button
                onClick={() => setShowApiKeyInput(false)}
                className="illuminator-api-button active"
                style={{ marginTop: '12px' }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="illuminator-main">
        {/* Temporary slot warning */}
        {isTemporarySlot && (
          <div className="illuminator-temp-slot-warning">
            <span className="illuminator-temp-slot-warning-icon">⚠</span>
            <span>
              You are enriching data in a <strong>temporary slot</strong>, which will be
              automatically deleted when a new Lore Weave simulation is run. Consider saving to a
              permanent slot before enrichment.
            </span>
          </div>
        )}

        {/* No API keys warning */}
        {!hasRequiredKeys && activeTab === 'entities' && (
          <div
            style={{
              padding: '12px 16px',
              marginBottom: '16px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              fontSize: '13px',
            }}
          >
            Set your API keys in the sidebar to enable enrichment.
          </div>
        )}

        {activeTab === 'entities' && (
          <div className="illuminator-content">
            <EntityBrowser
              worldSchema={worldSchema}
              config={config}
              onConfigChange={updateConfig}
              buildPrompt={buildPrompt}
              getVisualConfig={getVisualConfig}
              styleLibrary={styleLibrary}
              imageGenSettings={imageGenSettings}
              onStartRevision={handleOpenRevisionFilter}
              isRevising={isRevisionActive}
              onBulkHistorianReview={handleStartBulkHistorianReview}
              onBulkHistorianEdition={handleStartBulkHistorianEdition}
              onBulkHistorianClear={handleStartBulkHistorianClear}
              isBulkHistorianActive={isBulkHistorianActive}
              onNavigateToTab={setActiveTab}
            />
          </div>
        )}

        {activeTab === 'chronicle' && (
          <div className="illuminator-content">
            <ChroniclePanel
              worldData={worldData}
              queue={queue}
              onEnqueue={enqueue}
              onCancel={cancel}
              worldContext={worldContext}
              projectId={projectId}
              simulationRunId={simulationRunId}
              buildPrompt={buildPrompt}
              styleLibrary={styleLibrary}
              imageGenSettings={imageGenSettings}
              entityGuidance={entityGuidance}
              cultureIdentities={cultureIdentities}
              onBackportLore={handleBackportLore}
              onStartBulkBackport={handleStartBulkBackport}
              isBulkBackportActive={isBulkBackportActive}
              refreshTrigger={chronicleRefreshTrigger}
              imageModel={config.imageModel}
              onOpenImageSettings={() => useIlluminatorModals.getState().openImageSettings()}
              onHistorianReview={handleChronicleHistorianReview}
              isHistorianActive={isHistorianActive}
              historianConfigured={isHistorianConfigured(historianConfig)}
              historianConfig={historianConfig}
              onUpdateHistorianNote={handleUpdateHistorianNote}
              onRefreshEraSummaries={handleRefreshEraSummaries}
              onNavigateToTab={setActiveTab}
            />
          </div>
        )}

        {activeTab === 'coverage' && (
          <div className="illuminator-content">
            <CoveragePanel
              worldContext={worldContext}
              simulationRunId={simulationRunId}
              onWorldContextChange={updateWorldContext}
            />
            <EntityCoveragePanel
              simulationRunId={simulationRunId}
            />
          </div>
        )}

        {activeTab === 'finaledit' && (
          <div className="illuminator-content">
            <FinalEditTab />
          </div>
        )}

        {activeTab === 'pages' && (
          <div className="illuminator-content">
            <StaticPagesPanel
              projectId={projectId}
            />
          </div>
        )}

        {activeTab === 'context' && (
          <div className="illuminator-content">
            <WorldContextEditor
              worldContext={worldContext}
              onWorldContextChange={updateWorldContext}
              eras={eraTemporalInfo}
              onGenerateDynamics={handleGenerateDynamics}
              isGeneratingDynamics={isDynamicsActive}
            />
          </div>
        )}

        {activeTab === 'guidance' && (
          <div className="illuminator-content">
            <EntityGuidanceEditor
              entityGuidance={entityGuidance}
              onEntityGuidanceChange={updateEntityGuidance}
              worldContext={worldContext}
              worldSchema={worldSchema}
              simulationMetadata={simulationMetadata}
            />
          </div>
        )}

        {activeTab === 'identity' && (
          <div className="illuminator-content">
            <VisualIdentityPanel
              cultures={worldSchema?.cultures || []}
              entityKinds={worldSchema?.entityKinds || []}
              cultureIdentities={cultureIdentities}
              onCultureIdentitiesChange={updateCultureIdentities}
            />
          </div>
        )}

        {activeTab === 'styles' && (
          <div className="illuminator-content">
            <StyleLibraryEditor
              styleLibrary={styleLibrary}
              loading={styleLibraryLoading}
              isCustom={hasCustomStyleLibrary}
              onAddArtisticStyle={addArtisticStyle}
              onUpdateArtisticStyle={updateArtisticStyle}
              onDeleteArtisticStyle={deleteArtisticStyle}
              onAddCompositionStyle={addCompositionStyle}
              onUpdateCompositionStyle={updateCompositionStyle}
              onDeleteCompositionStyle={deleteCompositionStyle}
              onAddNarrativeStyle={addNarrativeStyle}
              onUpdateNarrativeStyle={updateNarrativeStyle}
              onDeleteNarrativeStyle={deleteNarrativeStyle}
              onReset={resetStyleLibrary}
              entityKinds={(worldSchema?.entityKinds || []).map((k) => k.kind)}
            />
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="illuminator-content">
            <ActivityPanel
              queue={queue}
              stats={stats}
              onCancel={cancel}
              onRetry={retry}
              onCancelAll={cancelAll}
              onClearCompleted={clearCompleted}
            />
          </div>
        )}

        {activeTab === 'costs' && (
          <div className="illuminator-content">
            <CostsPanel queue={queue} projectId={projectId} simulationRunId={simulationRunId} />
          </div>
        )}

        {activeTab === 'storage' && (
          <div className="illuminator-content">
            <StoragePanel projectId={projectId} />
          </div>
        )}

        {activeTab === 'traits' && (
          <div className="illuminator-content">
            <TraitPaletteSection
              projectId={projectId}
              simulationRunId={simulationRunId}
              worldContext={worldContext?.description || ''}
              entityKinds={(worldSchema?.entityKinds || []).map((k) => k.kind)}
              subtypesByKind={subtypesByKind}
              eras={eraEntities}
              cultures={(worldSchema?.cultures || []).map((c) => ({
                name: c.name,
                description: c.description,
                visualIdentity: c.visualIdentity,
              }))}
              enqueue={enqueue}
              queue={queue}
              isWorkerReady={isWorkerReady}
            />
          </div>
        )}

        {activeTab === 'configure' && (
          <div className="illuminator-content">
            <ConfigPanel config={config} onConfigChange={updateConfig} worldSchema={worldSchema} />
            <div className="illuminator-card">
              <div className="illuminator-card-header">
                <h2 className="illuminator-card-title">Data Sync</h2>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Import simulation output into Dexie. This is manual by design.
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="illuminator-btn illuminator-btn-primary"
                  disabled={isDataSyncing || !hasHardState}
                  onClick={() => handleDataSync('patch')}
                >
                  {isDataSyncing ? 'Importing...' : 'Patch from Hard State'}
                </button>
                <button
                  type="button"
                  className="illuminator-btn illuminator-btn-danger"
                  disabled={isDataSyncing || !hasHardState}
                  onClick={() => handleDataSync('overwrite')}
                >
                  Overwrite from Hard State
                </button>
              </div>
              <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                {hasHardState
                  ? `Hard state: ${worldData?.hardState?.length || 0} entities, ${hasHardEvents ? worldData?.narrativeHistory?.length || 0 : 0} events, ${hasHardRelationships ? worldData?.relationships?.length || 0 : 0} relationships.`
                  : 'No hard state available for import.'}
              </div>
              {dataSyncStatus && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: dataSyncStatus.type === 'error' ? '#ef4444' : '#10b981' }}>
                  {dataSyncStatus.message}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'historian' && (
          <div className="illuminator-content">
            <HistorianConfigEditor
              config={historianConfig}
              onChange={updateHistorianConfig}
            />
          </div>
        )}

        {activeTab === 'preprint' && (
          <div className="illuminator-content">
            <PrePrintPanel
              projectId={projectId}
              simulationRunId={simulationRunId}
            />
          </div>
        )}
      </div>

      {/* Image Settings Drawer */}
      <ImageSettingsDrawer
        isOpen={imageSettingsOpen}
        onClose={() => useIlluminatorModals.getState().closeImageSettings()}
        settings={imageGenSettings}
        onSettingsChange={updateImageGenSettings}
        styleLibrary={styleLibrary}
        cultures={worldSchema?.cultures}
        imageModel={config.imageModel}
      />

      {/* Dynamics Generation Modal */}
      <DynamicsGenerationModal
        run={dynamicsRun}
        isActive={isDynamicsActive}
        onSubmitFeedback={submitDynamicsFeedback}
        onAccept={acceptDynamics}
        onCancel={cancelDynamicsGeneration}
      />

      {/* Revision Filter Modal (pre-step) */}
      <RevisionFilterModal
        isOpen={revisionFilter.open}
        totalEligible={revisionFilter.totalEligible}
        usedInChronicles={revisionFilter.usedInChronicles}
        onStart={handleStartRevision}
        onCancel={() => setRevisionFilter((prev) => ({ ...prev, open: false }))}
      />

      {/* Summary Revision Modal */}
      <SummaryRevisionModal
        run={revisionRun}
        isActive={isRevisionActive}
        onContinue={continueToNextBatch}
        onAutoContine={autoContineAllRevision}
        onTogglePatch={togglePatchDecision}
        onAccept={handleAcceptRevision}
        onCancel={cancelRevision}
        getEntityContexts={getEntityContextsForRevision}
      />

      {/* Backport Config Modal (pre-backport entity selection + instructions) */}
      <BackportConfigModal
        isOpen={backportConfig !== null}
        chronicleTitle={backportConfig?.chronicleTitle || ''}
        entities={backportConfig?.entities || []}
        perEntityStatus={backportConfig?.perEntityStatus || {}}
        onStart={handleBackportConfigStart}
        onMarkNotNeeded={handleMarkEntityNotNeeded}
        onCancel={() => setBackportConfig(null)}
      />

      {/* Bulk Backport Progress Modal */}
      {showBulkBackportModal && (
        <BulkBackportModal
          progress={bulkBackportProgress}
          onConfirm={handleConfirmBulkBackport}
          onCancel={handleCancelBulkBackport}
          onClose={handleCloseBulkBackport}
        />
      )}

      {/* Bulk Historian Modal */}
      {showBulkHistorianModal && (
        <BulkHistorianModal
          progress={bulkHistorianProgress}
          onConfirm={handleConfirmBulkHistorian}
          onCancel={handleCancelBulkHistorian}
          onClose={handleCloseBulkHistorian}
          onChangeTone={setBulkHistorianTone}
          editionMaxTokens={editionMaxTokens}
        />
      )}

      {/* Chronicle Lore Backport Review Modal */}
      <SummaryRevisionModal
        run={backportRun}
        isActive={isBackportActive}
        onTogglePatch={toggleBackportPatchDecision}
        onAccept={handleAcceptBackport}
        onCancel={cancelBackport}
        getEntityContexts={getEntityContextsForRevision}
        onUpdateAnchorPhrase={updateBackportAnchorPhrase}
      />

      {/* Historian Edition Modal */}
      <SummaryRevisionModal
        run={historianEditionRun}
        isActive={isHistorianEditionActive}
        onTogglePatch={toggleHistorianEditionPatchDecision}
        onAccept={handleAcceptHistorianEdition}
        onCancel={cancelHistorianEdition}
        getEntityContexts={getEntityContextsForRevision}
        descriptionBaseline={historianEditionRun?.worldDynamicsContext}
      />

      {/* Historian Review Modal */}
      <HistorianReviewModal
        run={historianRun}
        isActive={isHistorianActive}
        onToggleNote={toggleHistorianNoteDecision}
        onEditNoteText={handleEditHistorianNoteText}
        onAccept={handleAcceptHistorianNotes}
        onCancel={cancelHistorianReview}
      />

      {/* Entity Rename / Patch Modal */}
      {renameModal && (
        <EntityRenameModal
          entityId={renameModal.entityId}
          cultures={worldSchema?.cultures || []}
          simulationRunId={simulationRunId || ''}
          mode={renameModal.mode}
          onApply={handleRenameApplied}
          onClose={() => useIlluminatorModals.getState().closeRename()}
        />
      )}

      {createEntityModal && (
        <CreateEntityModal
          worldSchema={worldSchema}
          eras={eraTemporalInfo}
          onSubmit={handleCreateEntity}
          onClose={() => useIlluminatorModals.getState().closeCreateEntity()}
        />
      )}

      {editEntityModal && (
        <CreateEntityModal
          worldSchema={worldSchema}
          eras={eraTemporalInfo}
          editEntity={editEntityModal}
          onSubmit={handleEditEntity}
          onClose={() => useIlluminatorModals.getState().closeEditEntity()}
        />
      )}

      <BulkToneRankingModal
        progress={toneRankingProgress}
        onConfirm={confirmToneRanking}
        onCancel={cancelToneRanking}
        onClose={closeToneRanking}
      />
      <ToneAssignmentPreviewModal
        preview={toneAssignmentPreview}
        onApply={applyToneAssignment}
        onClose={closeToneAssignment}
      />
      <BulkChronicleAnnotationModal
        progress={bulkAnnotationProgress}
        onConfirm={confirmBulkAnnotation}
        onCancel={cancelBulkAnnotation}
        onClose={closeBulkAnnotation}
      />
      <InterleavedAnnotationModal
        progress={interleavedProgress}
        onConfirm={confirmInterleaved}
        onCancel={cancelInterleaved}
        onClose={closeInterleaved}
      />
      <ThinkingViewer />
      <FloatingPills onNavigate={setActiveTab} />
    </div>
  );
}
