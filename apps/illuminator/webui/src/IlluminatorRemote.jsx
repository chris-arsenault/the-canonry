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
import DynamicsGenerationModal from './components/DynamicsGenerationModal';
import SummaryRevisionModal from './components/SummaryRevisionModal';
import EntityRenameModal from './components/EntityRenameModal';
import RevisionFilterModal from './components/RevisionFilterModal';
import BackportConfigModal from './components/BackportConfigModal';
import { useEnrichmentQueue } from './hooks/useEnrichmentQueue';
import { useDynamicsGeneration } from './hooks/useDynamicsGeneration';
import { useSummaryRevision } from './hooks/useSummaryRevision';
import { useChronicleLoreBackport } from './hooks/useChronicleLoreBackport';
import { useCopyEdit } from './hooks/useCopyEdit';
import { useHistorianReview } from './hooks/useHistorianReview';
import HistorianReviewModal from './components/HistorianReviewModal';
import HistorianConfigEditor from './components/HistorianConfigEditor';
import PrePrintPanel from './components/PrePrintPanel';
import { DEFAULT_HISTORIAN_CONFIG, isHistorianConfigured, isNoteActive } from './lib/historianTypes';
import { getPublishedStaticPagesForProject } from './lib/db/staticPageRepository';
import { getEntityUsageStats, getChronicle, getChroniclesForSimulation, updateChronicleLoreBackported, updateChronicleHistorianNotes } from './lib/db/chronicleRepository';
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
import { buildEntityIndex, buildRelationshipIndex, resolveEraInfo } from './lib/worldData';
import { resolveStyleSelection } from './components/StyleSelector';
import { exportImagePrompts, downloadImagePromptExport } from './lib/db/imageRepository';
import { getResolvedLLMCallSettings } from './lib/llmModelSettings';
import * as entityRepo from './lib/db/entityRepository';
import * as eventRepo from './lib/db/eventRepository';
import { migrateFromLegacyDbs } from './lib/db/migrateFromLegacyDbs';
import { useEntityStore } from './lib/db/entityStore';
import {
  buildProminenceScale,
  DEFAULT_PROMINENCE_DISTRIBUTION,
  prominenceThresholdFromScale,
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
  { id: 'pages', label: 'Pages' },           // 8. Static pages (user-authored)
  { id: 'activity', label: 'Activity' },     // 9. Monitor queue
  { id: 'costs', label: 'Costs' },           // 10. Track spending
  { id: 'storage', label: 'Storage' },       // 11. Manage images
  { id: 'traits', label: 'Traits' },         // 12. Visual trait palettes
  { id: 'historian', label: 'Historian' },   // 13. Historian persona config
  { id: 'preprint', label: 'Pre-Print' },   // 14. Print preparation
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

// Default world context
const DEFAULT_WORLD_CONTEXT = {
  name: '',
  description: '',
  // Structured fields - the canonical source of truth
  toneFragments: { core: '' },
  canonFactsWithMetadata: [],
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
  activeSection,
  onSectionChange,
  activeSlotIndex = 0,
}) {
  // Show warning when enriching data in temporary slot
  const isTemporarySlot = activeSlotIndex === 0;

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
  // renameModal: { entityId, mode: 'rename' | 'patch' } | null
  const [renameModal, setRenameModal] = useState(null);

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

  // Image settings drawer open state
  const [imageSettingsOpen, setImageSettingsOpen] = useState(false);

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

  // Historian config - project-level persona definition
  const [localHistorianConfig, setLocalHistorianConfig] = useState(() => {
    // Try to load from localStorage as a cross-session fallback
    try {
      const stored = localStorage.getItem('illuminator:historianConfig');
      if (stored) return JSON.parse(stored);
    } catch {}
    return DEFAULT_HISTORIAN_CONFIG;
  });
  const historianConfig = localHistorianConfig;
  const updateHistorianConfig = useCallback((next) => {
    setLocalHistorianConfig(next);
    try {
      localStorage.setItem('illuminator:historianConfig', JSON.stringify(next));
    } catch {}
  }, []);

  // Entities with enrichment state
  const [entities, setEntities] = useState([]);
  const [narrativeEvents, setNarrativeEvents] = useState([]);
  // Track which simulation run we've initialized — after init, local state is authoritative
  const initializedRunIdRef = useRef(null);

  // Initialize entities from worldData on first load. Dexie seed effect will overwrite
  // with canonical data if already seeded. We only set from worldData when there's a
  // new simulationRunId we haven't seen yet.
  useEffect(() => {
    if (!worldData?.hardState) {
      setEntities([]);
      initializedRunIdRef.current = null;
      return;
    }

    const runId = worldData.metadata?.simulationRunId || null;

    // Already initialized for this run — skip (local state is authoritative)
    if (runId && initializedRunIdRef.current === runId) return;

    initializedRunIdRef.current = runId;

    // Fresh initialization from worldData (Dexie seed effect will overwrite with canonical data)
    setEntities(worldData.hardState);
  }, [worldData]);

  const entityById = useMemo(() => buildEntityIndex(entities), [entities]);
  const prominenceScale = useMemo(() => {
    const values = entities
      .map((entity) => entity.prominence)
      .filter((value) => typeof value === 'number' && Number.isFinite(value));
    return buildProminenceScale(values, { distribution: DEFAULT_PROMINENCE_DISTRIBUTION });
  }, [entities]);
  const renownedThreshold = useMemo(
    () => prominenceThresholdFromScale('renowned', prominenceScale),
    [prominenceScale]
  );
  const relationshipsByEntity = useMemo(
    () => buildRelationshipIndex(worldData?.relationships || []),
    [worldData?.relationships]
  );
  const currentEra = useMemo(
    () => resolveEraInfo(worldData?.metadata, entities),
    [worldData?.metadata, entities]
  );

  // Build era temporal info for description prompts (same format as chronicle wizard)
  // NOTE: Use era entity temporal data directly - do not compute ranges from history or ticks.
  const eraTemporalInfo = useMemo(() => {
    if (!entities?.length) return [];

    const eraEntities = entities.filter((e) => e.kind === 'era' && e.temporal?.startTick != null);
    if (eraEntities.length === 0) return [];

    const sortedEras = [...eraEntities].sort(
      (a, b) => a.temporal.startTick - b.temporal.startTick
    );

    const result = sortedEras.map((era, index) => {
      const startTick = era.temporal.startTick;
      const endTick = era.temporal.endTick ?? startTick;
      const eraId = resolveEntityEraId(era) || era.id;
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

    console.log('[IlluminatorRemote] eraTemporalInfo built:', {
      eraCount: result.length,
      eraRanges: result.map(e => ({ id: e.id, name: e.name, start: e.startTick, end: e.endTick })),
    });

    return result;
  }, [entities]);

  const eraTemporalInfoByKey = useMemo(() => {
    if (!eraTemporalInfo.length || !entities?.length) return new Map();

    const byId = new Map(eraTemporalInfo.map((era) => [era.id, era]));
    const map = new Map(byId);

    for (const entity of entities) {
      if (entity.kind !== 'era') continue;
      const eraInfo = byId.get(entity.id);
      if (!eraInfo) continue;
      if (typeof entity.eraId === 'string' && entity.eraId) {
        map.set(entity.eraId, eraInfo);
      }
    }

    return map;
  }, [entities, eraTemporalInfo]);

  const prominentByCulture = useMemo(() => {
    const map = new Map();
    for (const entity of entities) {
      if (!entity.culture) continue;
      // Prominence at or above renowned
      if (typeof entity.prominence !== 'number' || entity.prominence < renownedThreshold) continue;
      const existing = map.get(entity.culture);
      if (existing) {
        existing.push(entity);
      } else {
        map.set(entity.culture, [entity]);
      }
    }
    return map;
  }, [entities, renownedThreshold]);

  // Extract simulationRunId from worldData for content association
  const simulationRunId = worldData?.metadata?.simulationRunId;

  // Shared helper: write to Dexie → reload local state → notify host
  const reloadAndNotify = useCallback(async (invalidateIds) => {
    const [freshEntities, freshEvents] = await Promise.all([
      entityRepo.getEntitiesForRun(simulationRunId),
      eventRepo.getNarrativeEventsForRun(simulationRunId),
    ]);
    if (invalidateIds?.length) {
      const store = useEntityStore.getState();
      for (const id of invalidateIds) store.invalidate(id);
    }
    setEntities(freshEntities);
    setNarrativeEvents(freshEvents);
    window.dispatchEvent(new CustomEvent('illuminator:worlddata-changed', {
      detail: { simulationRunId },
    }));
  }, [simulationRunId]);

  // Handle assigning an existing image from the library to an entity
  const handleAssignImage = useCallback(async (entityId, imageId, imageMetadata) => {
    await entityRepo.assignImage(entityId, imageId, imageMetadata);
    await reloadAndNotify([entityId]);
  }, [reloadAndNotify]);

  // Handle entity enrichment update from queue
  // output is ApplyEnrichmentOutput with { enrichment, summary?, description? }
  const handleEntityUpdate = useCallback(async (entityId, output) => {
    if (output.enrichment?.image) {
      await entityRepo.applyImageResult(entityId, output.enrichment.image);
    } else if (output.enrichment?.entityChronicle) {
      await entityRepo.applyEntityChronicleResult(entityId, output.enrichment.entityChronicle);
    } else {
      await entityRepo.applyDescriptionResult(
        entityId, output.enrichment, output.summary, output.description,
      );
    }
    await reloadAndNotify([entityId]);
  }, [reloadAndNotify]);

  // Undo last description change — pop from history
  const handleUndoDescription = useCallback(async (entityId) => {
    await entityRepo.undoDescription(entityId);
    await reloadAndNotify([entityId]);
  }, [reloadAndNotify]);

  // Handle backref image config update
  const handleUpdateBackrefs = useCallback(async (entityId, updatedBackrefs) => {
    await entityRepo.updateBackrefs(entityId, updatedBackrefs);
    await reloadAndNotify([entityId]);
  }, [reloadAndNotify]);

  // Seed Dexie from worldData and load canonical entities from the DAL.
  // Runs once per simulationRunId.
  const entityStore = useEntityStore;
  const seedWorldDataRef = useRef(worldData);
  seedWorldDataRef.current = worldData;

  useEffect(() => {
    if (!simulationRunId || !seedWorldDataRef.current?.hardState?.length) return;
    let cancelled = false;
    const wd = seedWorldDataRef.current;

    (async () => {
      try {
        console.log('[Illuminator] Seed effect running', { simulationRunId, hasNarrativeHistory: !!wd.narrativeHistory?.length });

        // Migrate legacy IndexedDB databases into Dexie (no-op after first run)
        await migrateFromLegacyDbs();

        // Seed Dexie from worldData if not already done for this run
        const entitySeeded = await entityRepo.isSeeded(simulationRunId);
        console.log('[Illuminator] Entity seed check', { entitySeeded });
        if (!entitySeeded) {
          await entityRepo.seedEntities(simulationRunId, wd.hardState);
          console.log('[Illuminator] Entities seeded', { count: wd.hardState.length });
        }

        const eventSeeded = wd.narrativeHistory?.length
          ? await eventRepo.isNarrativeEventsSeeded(simulationRunId)
          : true;
        console.log('[Illuminator] Event seed check', { eventSeeded, narrativeHistoryLength: wd.narrativeHistory?.length });
        if (wd.narrativeHistory?.length && !eventSeeded) {
          await eventRepo.seedNarrativeEvents(simulationRunId, wd.narrativeHistory);
        }

        if (cancelled) return;

        // Initialize zustand coordinator (loads entity ID list)
        await entityStore.getState().initialize(simulationRunId);

        // Load canonical data from Dexie into local state (backward compat)
        const dexieEntities = await entityRepo.getEntitiesForRun(simulationRunId);
        const dexieEvents = await eventRepo.getNarrativeEventsForRun(simulationRunId);
        console.log('[Illuminator] Loaded from Dexie', {
          entityCount: dexieEntities.length,
          eventCount: dexieEvents.length,
        });
        if (!cancelled && dexieEntities.length > 0) {
          setEntities(dexieEntities);
        }
        if (!cancelled && dexieEvents.length > 0) {
          setNarrativeEvents(dexieEvents);
        }
      } catch (err) {
        console.warn('[Illuminator] DAL seed/load failed:', err);
      }
    })();

    return () => { cancelled = true; };
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
    if (!worldData?.metadata) return undefined;
    return {
      currentTick: worldData.metadata.tick,
      currentEra: currentEra || undefined,
    };
  }, [worldData?.metadata, currentEra]);

  // Extract era entities for palette generation
  const eraEntities = useMemo(() => {
    return entities
      .filter((e) => e.kind === 'era')
      .map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
      }));
  }, [entities]);

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

  // Check if we have world data
  const hasWorldData = worldData?.hardState?.length > 0;

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
      // Build relationships
      const relationships = (relationshipsByEntity.get(entity.id) || []).slice(0, 8).map((rel) => {
        const targetId = rel.src === entity.id ? rel.dst : rel.src;
        const target = entityById.get(targetId);
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
          name: currentEra?.name || worldData?.metadata?.era || '',
          description: currentEra?.description,
        },
        entityAge: 'established',
        culturalPeers: (prominentByCulture.get(entity.culture) || [])
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
          // Get era name from entity index (era field is an ID)
          const eraEntity = entityById.get(e.era);
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
      entityById,
      currentEra,
      worldData?.metadata?.era,
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
  } = useDynamicsGeneration(enqueue, handleDynamicsAccepted);

  // Summary revision (batch entity summary/description revision)
  const getEntityContextsForRevision = useCallback((entityIds) => {
    return entityIds.map((id) => {
      const entity = entityById.get(id);
      if (!entity) return null;

      const rels = (relationshipsByEntity.get(entity.id) || []).slice(0, 8).map((rel) => {
        const targetId = rel.src === entity.id ? rel.dst : rel.src;
        const target = entityById.get(targetId);
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
        ...(existingAnchorPhrases.length > 0 ? { existingAnchorPhrases } : {}),
        ...(kindFocus ? { kindFocus } : {}),
      };
    }).filter(Boolean);
  }, [entityById, relationshipsByEntity, prominenceScale, entityGuidance]);

  const handleRevisionApplied = useCallback(async (patches, source = 'summary-revision') => {
    if (!patches?.length) return;
    const updatedIds = await entityRepo.applyRevisionPatches(patches, source);
    await reloadAndNotify(updatedIds);
  }, [reloadAndNotify]);

  const {
    run: revisionRun,
    isActive: isRevisionActive,
    startRevision,
    continueToNextBatch,
    autoContineAll: autoContineAllRevision,
    togglePatchDecision,
    applyAccepted: applyAcceptedPatches,
    cancelRevision,
  } = useSummaryRevision(enqueue, getEntityContextsForRevision);

  // Revision filter modal state
  const [revisionFilter, setRevisionFilter] = useState({
    open: false,
    totalEligible: 0,
    usedInChronicles: 0,
    chronicleEntityIds: new Set(),
  });

  const handleOpenRevisionFilter = useCallback(async () => {
    if (!projectId || !simulationRunId) return;

    const eligible = entities.filter((e) => e.summary && e.description && !e.lockedSummary);

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
  }, [projectId, simulationRunId, entities]);

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

    // Build entity contexts — exclude locked and optionally chronicle-used entities
    const revisionEntities = entities
      .filter((e) => {
        if (!e.summary || !e.description || e.lockedSummary) return false;
        if (excludeChronicleEntities && revisionFilter.chronicleEntityIds.has(e.id)) return false;
        return true;
      })
      .map((e) => {
        const rels = (relationshipsByEntity.get(e.id) || []).slice(0, 8).map((rel) => {
          const targetId = rel.src === e.id ? rel.dst : rel.src;
          const target = entityById.get(targetId);
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
  }, [projectId, simulationRunId, worldContext, worldSchema, entities, entityById, relationshipsByEntity, prominenceScale, startRevision, revisionFilter.chronicleEntityIds]);

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
  } = useChronicleLoreBackport(enqueue, getEntityContextsForRevision);

  // Backport config modal state
  const [backportConfig, setBackportConfig] = useState(null);

  const handleBackportLore = useCallback(async (chronicleId) => {
    if (!projectId || !simulationRunId || !chronicleId) return;

    const chronicle = await getChronicle(chronicleId);
    if (!chronicle?.finalContent) {
      console.warn('[Backport] Chronicle not found or has no final content:', chronicleId);
      return;
    }

    // Build entity contexts for the cast
    const castEntityIds = (chronicle.roleAssignments || []).map((r) => r.entityId);
    const castContexts = getEntityContextsForRevision(castEntityIds);
    if (castContexts.length === 0) {
      console.warn('[Backport] No valid cast entities found for chronicle:', chronicleId);
      return;
    }

    // Include lens entity if present (marked specially for different prompt treatment)
    if (chronicle.lens && !castEntityIds.includes(chronicle.lens.entityId)) {
      const lensContexts = getEntityContextsForRevision([chronicle.lens.entityId]);
      if (lensContexts.length > 0) {
        castContexts.push({ ...lensContexts[0], isLens: true });
      }
    }

    // Extract perspective synthesis output
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
      });
    }

    // Open config modal instead of starting immediately
    setBackportConfig({
      chronicleId,
      chronicleTitle: chronicle.title || 'Untitled Chronicle',
      entities: castContexts,
      chronicleText: chronicle.finalContent,
      perspectiveSynthesisJson,
    });
  }, [projectId, simulationRunId, getEntityContextsForRevision]);

  const handleBackportConfigStart = useCallback((selectedEntityIds, customInstructions) => {
    if (!backportConfig || !projectId || !simulationRunId) return;

    const selectedEntities = backportConfig.entities.filter(e => selectedEntityIds.includes(e.id));
    if (selectedEntities.length === 0) return;

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
    await handleRevisionApplied(patches, 'lore-backport');

    // Revalidate backrefs + upsert new backref for this chronicle
    if (cId) {
      await entityRepo.revalidateBackrefs(patches, { chronicleId: cId });
      await reloadAndNotify(patches.map((p) => p.entityId));
      // Mark chronicle as backported and refresh the chronicle list
      updateChronicleLoreBackported(cId, true).then(() => {
        setChronicleRefreshTrigger((n) => n + 1);
      }).catch((err) => {
        console.warn('[Backport] Failed to set loreBackported flag:', err);
      });
    }
  }, [applyAcceptedBackportPatches, handleRevisionApplied, backportChronicleId, reloadAndNotify]);

  // ---- Auto-backport all chronicles ----
  const [autoBackportQueue, setAutoBackportQueue] = useState(null); // { ids: string[], total: number } | null
  const autoBackportRef = useRef(false); // tracks whether we're in auto-backport mode

  const handleStartAutoBackport = useCallback(async () => {
    if (!simulationRunId) return;
    const allChronicles = await getChroniclesForSimulation(simulationRunId);
    const eligible = allChronicles
      .filter((c) => !c.loreBackported && c.finalContent)
      .map((c) => c.chronicleId);
    if (eligible.length === 0) {
      alert('No chronicles eligible for backport (all already backported or unpublished).');
      return;
    }
    console.log(`[Auto-Backport] Starting: ${eligible.length} chronicles eligible`, eligible);
    autoBackportRef.current = true;
    setAutoBackportQueue({ ids: eligible, total: eligible.length });
    // Kick off the first one
    await handleBackportLore(eligible[0]);
  }, [simulationRunId, handleBackportLore]);

  const handleCancelAutoBackport = useCallback(() => {
    autoBackportRef.current = false;
    setAutoBackportQueue(null);
    cancelBackport();
  }, [cancelBackport]);

  // Watch backportRun — when results arrive in auto mode, accept and advance
  useEffect(() => {
    if (!autoBackportRef.current || !autoBackportQueue) return;
    if (!backportRun) return;
    const status = backportRun.status;
    if (status !== 'batch_reviewing' && status !== 'run_reviewing') return;

    // Auto-accept
    console.log(`[Auto-Backport] Auto-accepting results for chronicle ${autoBackportQueue.ids[0]}`);
    handleAcceptBackport();

    // Advance to next
    const remaining = autoBackportQueue.ids.slice(1);
    if (remaining.length === 0) {
      console.log('[Auto-Backport] Complete — all chronicles backported');
      autoBackportRef.current = false;
      setAutoBackportQueue(null);
      return;
    }
    setAutoBackportQueue({ ids: remaining, total: autoBackportQueue.total });
    // Delay to let state settle before starting next
    setTimeout(() => {
      if (autoBackportRef.current) {
        console.log(`[Auto-Backport] Starting next: ${remaining[0]} (${remaining.length} remaining)`);
        handleBackportLore(remaining[0]);
      }
    }, 1000);
  }, [backportRun?.status, autoBackportQueue, handleAcceptBackport, handleBackportLore]);

  // Description copy edit (single-entity readability pass)
  const {
    run: copyEditRun,
    isActive: isCopyEditActive,
    startCopyEdit,
    togglePatchDecision: toggleCopyEditPatchDecision,
    applyAccepted: applyAcceptedCopyEditPatches,
    cancelCopyEdit,
  } = useCopyEdit(enqueue);

  const handleCopyEdit = useCallback((entityId) => {
    if (!projectId || !simulationRunId || !entityId) return;

    const entity = entityById.get(entityId);
    if (!entity?.description) {
      console.warn('[CopyEdit] Entity not found or has no description:', entityId);
      return;
    }

    // Build relationships
    const rels = (relationshipsByEntity.get(entity.id) || []).slice(0, 12).map((rel) => {
      const targetId = rel.src === entity.id ? rel.dst : rel.src;
      const target = entityById.get(targetId);
      return {
        kind: rel.kind,
        targetName: target?.name || targetId,
        targetKind: target?.kind || 'unknown',
      };
    });

    const kindFocus = entityGuidance[entity.kind]?.focus || '';
    const visualThesis = entity.enrichment?.text?.visualThesis || '';

    startCopyEdit({
      projectId,
      simulationRunId,
      entityId: entity.id,
      entityName: entity.name,
      entityKind: entity.kind,
      entitySubtype: entity.subtype || '',
      entityCulture: entity.culture || '',
      entityProminence: prominenceLabelFromScale(entity.prominence, prominenceScale),
      description: entity.description,
      summary: entity.summary || '',
      kindFocus,
      visualThesis,
      relationships: rels,
    });
  }, [projectId, simulationRunId, entityById, relationshipsByEntity, entityGuidance, prominenceScale, startCopyEdit]);

  const handleAcceptCopyEdit = useCallback(async () => {
    const patches = applyAcceptedCopyEditPatches();
    await handleRevisionApplied(patches, 'copy-edit');

    // Revalidate existing backrefs against updated descriptions (with fuzzy fallback)
    await entityRepo.revalidateBackrefs(patches, { fuzzyFallback: true });
    await reloadAndNotify(patches.map((p) => p.entityId));
  }, [applyAcceptedCopyEditPatches, handleRevisionApplied, reloadAndNotify]);

  // Entity rename / patch events
  const handleStartRename = useCallback((entityId) => {
    setRenameModal({ entityId, mode: 'rename' });
  }, []);

  const handleStartPatchEvents = useCallback((entityId) => {
    setRenameModal({ entityId, mode: 'patch' });
  }, []);

  const handleRenameApplied = useCallback(async ({ entityPatches, eventPatches, targetEntityId, newName }) => {
    try {
      // 1. Write entity patches to Dexie (source of truth)
      const updatedIds = await entityRepo.applyRename(targetEntityId, newName, entityPatches, simulationRunId);

      // 2. Write narrative event patches to Dexie
      if (eventPatches.length > 0) {
        await eventRepo.applyEventPatches(eventPatches, simulationRunId);
      }

      // 3. Reload from Dexie + notify host
      await reloadAndNotify(updatedIds);
    } catch (err) {
      console.error('[Illuminator] Rename persist failed:', err);
    }

    setRenameModal(null);
    setChronicleRefreshTrigger((n) => n + 1);
  }, [simulationRunId, reloadAndNotify]);

  // Historian review (scholarly annotations for entities and chronicles)
  const {
    run: historianRun,
    isActive: isHistorianActive,
    startReview: startHistorianReview,
    toggleNoteDecision: toggleHistorianNoteDecision,
    applyAccepted: applyAcceptedHistorianNotes,
    cancelReview: cancelHistorianReview,
  } = useHistorianReview(enqueue);

  // Configurable caps for historian voice-continuity sampling
  const HISTORIAN_SAMPLING = useMemo(() => ({
    maxTotal: 15,       // Total notes in the sample
    maxPerTarget: 3,    // Max notes from any single entity/chronicle
  }), []);

  // Collect previous historian notes for memory/continuity (sample from entities + chronicles)
  const collectPreviousNotes = useCallback(() => {
    const { maxTotal, maxPerTarget } = HISTORIAN_SAMPLING;

    // Group enabled notes by target name
    const byTarget = {};

    // Entity notes
    for (const entity of entities) {
      const notes = (entity.enrichment?.historianNotes || []).filter(isNoteActive);
      if (notes.length > 0) {
        byTarget[entity.name] = notes.map(n => ({
          targetName: entity.name,
          anchorPhrase: n.anchorPhrase,
          text: n.text,
          type: n.type,
        }));
      }
    }

    // Chronicle notes
    const chronicleRecords = useChronicleStore.getState().chronicles;
    for (const chronicle of Object.values(chronicleRecords)) {
      const notes = (chronicle.historianNotes || []).filter(isNoteActive);
      if (notes.length > 0) {
        const name = chronicle.title || chronicle.chronicleId;
        byTarget[name] = (byTarget[name] || []).concat(notes.map(n => ({
          targetName: name,
          anchorPhrase: n.anchorPhrase,
          text: n.text,
          type: n.type,
        })));
      }
    }

    // Cap each target at maxPerTarget
    const targets = Object.keys(byTarget);
    for (const target of targets) {
      if (byTarget[target].length > maxPerTarget) {
        byTarget[target] = byTarget[target].slice(0, maxPerTarget);
      }
    }

    // Round-robin across targets to fill up to maxTotal
    const sample = [];
    let round = 0;
    while (sample.length < maxTotal && round < maxPerTarget) {
      let added = false;
      for (const target of targets) {
        if (sample.length >= maxTotal) break;
        if (round < byTarget[target].length) {
          sample.push(byTarget[target][round]);
          added = true;
        }
      }
      if (!added) break;
      round++;
    }

    return sample;
  }, [entities, HISTORIAN_SAMPLING]);

  const handleHistorianReview = useCallback((entityId, tone) => {
    if (!projectId || !simulationRunId || !entityId) return;
    if (!isHistorianConfigured(historianConfig)) return;

    const entity = entityById.get(entityId);
    if (!entity?.description) return;

    // Build relationships
    const rels = (relationshipsByEntity.get(entity.id) || []).slice(0, 12).map((rel) => {
      const targetId = rel.src === entity.id ? rel.dst : rel.src;
      const target = entityById.get(targetId);
      return {
        kind: rel.kind,
        targetName: target?.name || targetId,
        targetKind: target?.kind || 'unknown',
      };
    });

    // Get neighbor summaries (from relationships)
    const neighborSummaries = (relationshipsByEntity.get(entity.id) || []).slice(0, 5).map((rel) => {
      const targetId = rel.src === entity.id ? rel.dst : rel.src;
      const target = entityById.get(targetId);
      if (!target) return null;
      return {
        name: target.name,
        kind: target.kind,
        summary: target.summary || target.description?.slice(0, 200) || '',
      };
    }).filter(Boolean);

    // Assemble context
    const contextJson = JSON.stringify({
      entityId: entity.id,
      entityName: entity.name,
      entityKind: entity.kind,
      entitySubtype: entity.subtype || '',
      entityCulture: entity.culture || '',
      entityProminence: prominenceLabelFromScale(entity.prominence, prominenceScale),
      summary: entity.summary || '',
      relationships: rels,
      neighborSummaries,
      canonFacts: (worldContext.canonFactsWithMetadata || []).map((f) => f.text),
      worldDynamics: (worldContext.worldDynamics || []).map((d) => d.text),
    });

    const previousNotes = collectPreviousNotes();

    startHistorianReview({
      projectId,
      simulationRunId,
      targetType: 'entity',
      targetId: entity.id,
      targetName: entity.name,
      sourceText: entity.description,
      contextJson,
      previousNotesJson: JSON.stringify(previousNotes),
      historianConfig,
      tone: tone || 'weary',
    });
  }, [projectId, simulationRunId, entityById, relationshipsByEntity, worldContext, historianConfig, prominenceScale, collectPreviousNotes, startHistorianReview]);

  const handleChronicleHistorianReview = useCallback(async (chronicleId, tone) => {
    if (!projectId || !simulationRunId || !chronicleId) return;
    if (!isHistorianConfigured(historianConfig)) return;

    const chronicle = await getChronicle(chronicleId);
    if (!chronicle) return;

    const content = chronicle.finalContent || chronicle.assembledContent;
    if (!content) return;

    // Build cast summaries
    const castSummaries = (chronicle.roleAssignments || []).slice(0, 10).map((ra) => {
      const entity = entityById.get(ra.entityId);
      if (!entity) return null;
      return {
        name: entity.name,
        kind: entity.kind,
        summary: entity.summary || entity.description?.slice(0, 200) || '',
      };
    }).filter(Boolean);

    const cast = (chronicle.roleAssignments || []).map((ra) => {
      const entity = entityById.get(ra.entityId);
      return {
        entityName: entity?.name || ra.entityId,
        role: ra.role,
        kind: entity?.kind || 'unknown',
      };
    });

    const contextJson = JSON.stringify({
      chronicleId: chronicle.chronicleId,
      title: chronicle.title || 'Untitled',
      format: chronicle.format,
      narrativeStyleId: chronicle.narrativeStyleId || '',
      cast,
      castSummaries,
      canonFacts: (worldContext.canonFactsWithMetadata || []).map((f) => f.text),
      worldDynamics: (worldContext.worldDynamics || []).map((d) => d.text),
    });

    const previousNotes = collectPreviousNotes();

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
      tone: tone || 'weary',
    });
  }, [projectId, simulationRunId, entityById, worldContext, historianConfig, collectPreviousNotes, startHistorianReview]);

  const handleAcceptHistorianNotes = useCallback(async () => {
    const targetId = historianRun?.targetId;
    const targetType = historianRun?.targetType;
    const notes = applyAcceptedHistorianNotes();
    if (notes.length === 0) return;

    if (targetType === 'entity' && targetId) {
      await entityRepo.setHistorianNotes(targetId, notes);
      await reloadAndNotify([targetId]);
    } else if (targetType === 'chronicle' && targetId) {
      try {
        await updateChronicleHistorianNotes(targetId, notes);
        await useChronicleStore.getState().refreshChronicle(targetId);
      } catch (err) {
        console.error('[Historian] Failed to save chronicle notes:', err);
      }
    }
  }, [applyAcceptedHistorianNotes, historianRun, reloadAndNotify]);

  const handleUpdateHistorianNote = useCallback(async (targetType, targetId, noteId, updates) => {
    if (targetType === 'entity' && targetId) {
      const entity = entities.find((e) => e.id === targetId);
      if (!entity?.enrichment?.historianNotes) return;
      const updatedNotes = entity.enrichment.historianNotes.map((n) =>
        n.noteId === noteId ? { ...n, ...updates } : n
      );
      await entityRepo.setHistorianNotes(targetId, updatedNotes);
      await reloadAndNotify([targetId]);
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
  }, [entities, reloadAndNotify]);

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

    // Build entity context for search execution
    const entityContexts = entities.map((e) => ({
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

    const relationships = (worldData?.relationships || []).map((r) => ({
      src: r.src,
      dst: r.dst,
      kind: r.kind,
      weight: r.weight,
      srcName: entityById.get(r.src)?.name || r.src,
      dstName: entityById.get(r.dst)?.name || r.dst,
    }));

    startDynamicsGeneration({
      projectId,
      simulationRunId,
      staticPagesContext,
      schemaContext,
      entities: entityContexts,
      relationships,
    });
  }, [projectId, simulationRunId, worldSchema, entities, worldData, entityById, startDynamicsGeneration]);

  if (!hasWorldData) {
    return (
      <div className="illuminator-empty-state">
        <div className="illuminator-empty-state-icon">&#x2728;</div>
        <div className="illuminator-empty-state-title">No World Data</div>
        <div className="illuminator-empty-state-desc">
          Run a simulation in <strong>Lore Weave</strong> first, then return here to enrich your
          world with LLM-generated descriptions and images.
        </div>
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
            onClick={() => setImageSettingsOpen(true)}
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
              entities={entities}
              queue={queue}
              onEnqueue={enqueue}
              onCancel={cancel}
              onAssignImage={handleAssignImage}
              worldSchema={worldSchema}
              config={config}
              onConfigChange={updateConfig}
              buildPrompt={buildPrompt}
              getVisualConfig={getVisualConfig}
              styleLibrary={styleLibrary}
              imageGenSettings={imageGenSettings}
              onOpenImageSettings={() => setImageSettingsOpen(true)}
              prominenceScale={prominenceScale}
              onStartRevision={handleOpenRevisionFilter}
              isRevising={isRevisionActive}
              onUpdateBackrefs={handleUpdateBackrefs}
              onUndoDescription={handleUndoDescription}
              onCopyEdit={handleCopyEdit}
              isCopyEditActive={isCopyEditActive}
              onHistorianReview={handleHistorianReview}
              isHistorianActive={isHistorianActive}
              historianConfigured={isHistorianConfigured(historianConfig)}
              onUpdateHistorianNote={handleUpdateHistorianNote}
              onRename={handleStartRename}
              onPatchEvents={handleStartPatchEvents}
            />
          </div>
        )}

        {activeTab === 'chronicle' && (
          <div className="illuminator-content">
            <ChroniclePanel
              worldData={worldData}
              entities={entities}
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
              autoBackportQueue={autoBackportQueue}
              onStartAutoBackport={handleStartAutoBackport}
              onCancelAutoBackport={handleCancelAutoBackport}
              refreshTrigger={chronicleRefreshTrigger}
              imageModel={config.imageModel}
              onOpenImageSettings={() => setImageSettingsOpen(true)}
              onHistorianReview={handleChronicleHistorianReview}
              isHistorianActive={isHistorianActive}
              historianConfigured={isHistorianConfigured(historianConfig)}
              onUpdateHistorianNote={handleUpdateHistorianNote}
            />
          </div>
        )}

        {activeTab === 'pages' && (
          <div className="illuminator-content">
            <StaticPagesPanel
              projectId={projectId}
              entities={entities}
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
              worldData={worldData}
              worldSchema={worldSchema}
              simulationMetadata={simulationMetadata}
              prominenceScale={prominenceScale}
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
              enrichmentTriggers={worldData?.metadata?.enrichmentTriggers}
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
              entities={entities}
              projectId={projectId}
              simulationRunId={simulationRunId}
            />
          </div>
        )}
      </div>

      {/* Image Settings Drawer */}
      <ImageSettingsDrawer
        isOpen={imageSettingsOpen}
        onClose={() => setImageSettingsOpen(false)}
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
        onStart={handleBackportConfigStart}
        onCancel={() => setBackportConfig(null)}
      />

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

      {/* Description Copy Edit Modal */}
      <SummaryRevisionModal
        run={copyEditRun}
        isActive={isCopyEditActive}
        onTogglePatch={toggleCopyEditPatchDecision}
        onAccept={handleAcceptCopyEdit}
        onCancel={cancelCopyEdit}
        getEntityContexts={getEntityContextsForRevision}
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
          entities={entities}
          cultures={worldSchema?.cultures || []}
          simulationRunId={simulationRunId || ''}
          relationships={worldData?.relationships || []}
          narrativeEvents={narrativeEvents}
          mode={renameModal.mode}
          onApply={handleRenameApplied}
          onClose={() => setRenameModal(null)}
        />
      )}
    </div>
  );
}
