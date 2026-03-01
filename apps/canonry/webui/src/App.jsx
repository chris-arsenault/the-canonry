/**
 * The Canonry - Unified World-Building Suite
 *
 * Shell application that hosts name-forge, cosmographer, and lore-weave
 * as module federation remotes with a unified WorldSeedProject schema.
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useProjectStorage } from "./storage/useProjectStorage";
// saveUiState is now called by useCanonryUiStore subscribe()
import { useCanonryUiStore, selectActiveSection } from "./stores/useCanonryUiStore";
import { loadWorldStore, saveWorldData, saveWorldContext, saveEntityGuidance, saveCultureIdentities, saveEnrichmentConfig, saveStyleSelection, saveHistorianConfig, getSlots, getSlot, setActiveSlotIndex as persistActiveSlotIndex, saveSlot, saveToSlot, loadSlot, clearSlot, updateSlotTitle, generateSlotTitle } from "./storage/worldStore";
import ProjectManager from "./components/ProjectManager";
import Navigation from "./components/Navigation";
import SchemaEditor from "./components/SchemaEditor";
import LandingPage from "./components/LandingPage";
import HelpModal from "./components/HelpModal";
import { computeTagUsage, computeSchemaUsage, ErrorMessage } from "@the-canonry/shared-components";
import { validateAllConfigs } from "../../../lore-weave/lib/engine/configSchemaValidator";
import { mergeFrameworkSchemaSlice, FRAMEWORK_ENTITY_KIND_VALUES, FRAMEWORK_RELATIONSHIP_KIND_VALUES, FRAMEWORK_CULTURES, FRAMEWORK_CULTURE_DEFINITIONS, FRAMEWORK_TAG_VALUES } from "@canonry/world-schema";
import NameForgeHost from "./remotes/NameForgeHost";
import CosmographerHost from "./remotes/CosmographerHost";
import CoherenceEngineHost from "./remotes/CoherenceEngineHost";
import LoreWeaveHost from "./remotes/LoreWeaveHost";
import IlluminatorHost from "./remotes/IlluminatorHost";
import ArchivistHost from "./remotes/ArchivistHost";
import ChroniclerHost from "./remotes/ChroniclerHost";
import { useImageStore, IndexedDBBackend } from "@the-canonry/image-store";
import { getImagesByProject, getImageBlob, getImageMetadata } from "./lib/imageExportHelpers";
import { getStaticPagesForProject, importStaticPages } from "./storage/staticPageStorage";
import { getCompletedChroniclesForSimulation, getCompletedChroniclesForProject, importChronicles, getChronicleCountForProject } from "./storage/chronicleStorage";
import { getCompletedEraNarrativesForSimulation } from "./storage/eraNarrativeStorage";
import { importBundleImageReferences, getImageCountForProject } from "./storage/imageStorage";
import { importEntities, getEntityCountForRun } from "./storage/entityStorage";
import { importNarrativeEvents, getNarrativeEventCountForRun } from "./storage/eventStorage";
import { colors, typography, spacing } from "./theme";
import { isTokenValid } from "./aws/awsConfigStorage";
import { useCanonryAwsStore } from "./stores/useCanonryAwsStore";
import { extractCognitoTokensFromUrl, clearCognitoHash } from "./aws/cognitoAuth";
import { signInWithUserPool, getUserPoolSession, signOutUserPool, sessionToTokens } from "./aws/cognitoUserAuth";
import { createS3Client, buildImageStorageConfig, syncProjectImagesToS3, getS3ImageUploadPlan, listS3Prefixes, buildStorageImageUrl } from "./aws/awsS3";
import { exportIndexedDbToS3, importIndexedDbFromS3 } from "./aws/indexedDbSnapshot";
import { pullImagesFromS3 } from "./aws/s3ImagePull";

/** Stable empty array to avoid creating new references in JSX props */
const EMPTY_ARRAY = [];

/**
 * Extract loreData from enriched entities
 * Converts entity.enrichment into LoreRecord format for Chronicler
 *
 * Note: Summary and description are now stored directly on entity (entity.summary, entity.description).
 * The enrichment.text object contains metadata (aliases, visual traits, etc.).
 * Description lore records are no longer created - Chronicler reads entity.summary/description directly.
 */
function extractLoreDataFromEntities(worldData) {
  if (!worldData?.hardState) return null;
  const records = [];
  for (const entity of worldData.hardState) {
    const enrichment = entity.enrichment;
    if (!enrichment) continue;

    // Extract era narrative as LoreRecord (still uses lore record format)
    if (enrichment.eraNarrative?.text) {
      records.push({
        id: `era_${entity.id}`,
        type: entity.kind === "era" ? "era_chapter" : "entity_chronicle",
        targetId: entity.id,
        text: enrichment.eraNarrative.text,
        metadata: {
          generatedAt: enrichment.eraNarrative.generatedAt,
          model: enrichment.eraNarrative.model
        }
      });
    }

    // Chronicles are now loaded directly from IndexedDB by Chronicler
    // No longer stored in entity.enrichment.chronicles
  }
  if (records.length === 0) return null;
  return {
    llmEnabled: true,
    model: "mixed",
    records
  };
}

/**
 * Extract loreData from enriched entities
 * Note: Chronicles are now loaded directly from IndexedDB by Chronicler,
 * so this no longer needs to augment chronicle imageRefs.
 */
async function extractLoreDataWithCurrentImageRefs(worldData) {
  // Just delegate to the synchronous function
  // The async wrapper is kept for backwards compatibility with existing callers
  return extractLoreDataFromEntities(worldData);
}
function stripSimulationRunId(record) {
  if (!record || typeof record !== "object") return record;
  const {
    simulationRunId: _omit,
    ...rest
  } = record; // eslint-disable-line sonarjs/no-unused-vars
  return rest;
}
function mergeEntitiesWithDexie(baseEntities, dexieEntities) {
  if (!Array.isArray(baseEntities) || baseEntities.length === 0) {
    return Array.isArray(dexieEntities) ? dexieEntities.map(stripSimulationRunId) : [];
  }
  if (!Array.isArray(dexieEntities) || dexieEntities.length === 0) {
    return baseEntities;
  }
  const dexieById = new Map(dexieEntities.map(entity => [entity.id, entity]));
  const merged = baseEntities.map(entity => {
    const updated = dexieById.get(entity.id);
    if (!updated) return entity;
    return {
      ...entity,
      ...stripSimulationRunId(updated)
    };
  });
  const baseIds = new Set(baseEntities.map(entity => entity.id));
  for (const entity of dexieEntities) {
    if (entity?.id && !baseIds.has(entity.id)) {
      merged.push(stripSimulationRunId(entity));
    }
  }
  return merged;
}
async function hydrateWorldDataFromDexie({
  worldData,
  projectId,
  simulationRunId
}) {
  if (!worldData || !simulationRunId || !projectId) {
    throw new Error(`Cannot hydrate export: missing ${[!worldData && "worldData", !simulationRunId && "simulationRunId", !projectId && "projectId"].filter(Boolean).join(", ")}`);
  }
  const [{
    getEntitiesForRun
  }, {
    getNarrativeEventsForRun
  }, {
    getRelationshipsForRun
  }, {
    getCoordinateState
  }, {
    getSchema
  }] = await Promise.all([import("illuminator/entityRepository"), import("illuminator/eventRepository"), import("illuminator/relationshipRepository"), import("illuminator/coordinateStateRepository"), import("illuminator/schemaRepository")]);
  const [dexieEntities, dexieEvents, dexieRelationships, coordinateRecord, schemaRecord] = await Promise.all([getEntitiesForRun(simulationRunId), getNarrativeEventsForRun(simulationRunId), getRelationshipsForRun(simulationRunId), getCoordinateState(simulationRunId), getSchema(projectId)]);
  const mergedEntities = mergeEntitiesWithDexie(worldData.hardState || [], dexieEntities);
  const relationships = Array.isArray(dexieRelationships) && dexieRelationships.length > 0 ? dexieRelationships.map(stripSimulationRunId) : worldData.relationships || [];
  const narrativeHistory = Array.isArray(dexieEvents) && dexieEvents.length > 0 ? dexieEvents.map(stripSimulationRunId) : worldData.narrativeHistory || [];
  const coordinateState = coordinateRecord?.coordinateState || worldData.coordinateState;
  const schema = schemaRecord?.schema || worldData.schema;
  return {
    ...worldData,
    schema,
    hardState: mergedEntities,
    relationships,
    narrativeHistory,
    coordinateState,
    metadata: {
      ...worldData.metadata,
      entityCount: mergedEntities.length,
      relationshipCount: relationships.length
    }
  };
}
const IMAGE_EXTENSION_BY_TYPE = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg"
};
const EXPORT_CANCEL_ERROR_NAME = "ExportCanceledError";
function createExportCanceledError() {
  const error = new Error("Export canceled");
  error.name = EXPORT_CANCEL_ERROR_NAME;
  return error;
}
function throwIfExportCanceled(shouldCancel) {
  if (shouldCancel && shouldCancel()) {
    throw createExportCanceledError();
  }
}
function mimeTypeToExtension(mimeType) {
  if (!mimeType) return "bin";
  const normalized = mimeType.toLowerCase();
  return IMAGE_EXTENSION_BY_TYPE[normalized] || "bin";
}
function sanitizeFileName(value, fallback) {
  if (typeof value !== "string") return fallback;
  // eslint-disable-next-line sonarjs/slow-regex -- short filename string, no ReDoS risk
  const sanitized = value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || fallback;
}
function collectEntityImageIds(worldData, ids, entityById) {
  if (!worldData?.hardState) return;
  for (const entity of worldData.hardState) {
    if (entity?.id) entityById.set(entity.id, entity);
    const imageId = entity?.enrichment?.image?.imageId;
    if (imageId) ids.add(imageId);
  }
}
function collectChronicleImageIds(chronicles, ids, entityById) {
  if (!Array.isArray(chronicles)) return;
  for (const chronicle of chronicles) {
    const coverImageId = chronicle?.coverImage?.generatedImageId;
    if (coverImageId) ids.add(coverImageId);
    const refs = chronicle?.imageRefs?.refs || [];
    for (const ref of refs) {
      const imageId = ref?.generatedImageId;
      if (imageId) ids.add(imageId);
      if (ref?.type === "entity_ref" && ref?.entityId) {
        const entity = entityById.get(ref.entityId);
        const entityImageId = entity?.enrichment?.image?.imageId;
        if (entityImageId) ids.add(entityImageId);
      }
    }
  }
}
function collectEraNarrativeImageIds(eraNarratives, ids) {
  if (!Array.isArray(eraNarratives)) return;
  for (const narrative of eraNarratives) {
    const coverImageId = narrative?.coverImage?.generatedImageId;
    if (coverImageId) ids.add(coverImageId);
    const refs = narrative?.imageRefs?.refs || [];
    for (const ref of refs) {
      if (ref?.type === "chronicle_ref" && ref?.imageId) ids.add(ref.imageId);
      if (ref?.type === "prompt_request" && ref?.generatedImageId) ids.add(ref.generatedImageId);
    }
  }
}
function collectStaticPageImageIds(staticPages, ids) {
  if (!Array.isArray(staticPages)) return;
  for (const page of staticPages) {
    const content = page?.content;
    if (typeof content !== "string") continue;
    const matcher = /image:([A-Za-z0-9_-]+)/g;
    let match = matcher.exec(content);
    while (match) {
      if (match[1]) ids.add(match[1]);
      match = matcher.exec(content);
    }
  }
}
function collectReferencedImageIds(worldData, chronicles, staticPages, eraNarratives) {
  const ids = new Set();
  const entityById = new Map();
  collectEntityImageIds(worldData, ids, entityById);
  collectChronicleImageIds(chronicles, ids, entityById);
  collectEraNarrativeImageIds(eraNarratives, ids);
  collectStaticPageImageIds(staticPages, ids);
  return ids;
}
function buildImageEntry(imageId, record, localPath, entityByImageId, entityById) {
  const entity = entityByImageId.get(imageId) || (record?.entityId ? entityById.get(record.entityId) : null);
  const prompt = record?.originalPrompt || record?.finalPrompt || record?.revisedPrompt || "";
  const entry = {
    entityId: entity?.id || record?.entityId || "chronicle",
    entityName: entity?.name || record?.entityName || "Unknown",
    entityKind: entity?.kind || record?.entityKind || "unknown",
    prompt,
    localPath,
    imageId
  };
  if (record?.imageType === "chronicle") {
    entry.imageType = "chronicle";
    entry.chronicleId = record.chronicleId;
    entry.imageRefId = record.imageRefId;
  }
  return entry;
}
function processS3Image(imageId, record, storage, entityByImageId, entityById, images, imageResults) {
  const remotePath = buildStorageImageUrl(storage, "raw", imageId);
  if (!remotePath) return false;
  images[imageId] = remotePath;
  imageResults.push(buildImageEntry(imageId, record, remotePath, entityByImageId, entityById));
  return true;
}
function processLocalImage(imageId, record, blob, entityByImageId, entityById, images, imageFiles, imageResults, usedNames) {
  const ext = mimeTypeToExtension(record?.mimeType || blob.type);
  const baseName = sanitizeFileName(imageId, `image-${imageResults.length + 1}`);
  const currentCount = (usedNames.get(baseName) || 0) + 1;
  usedNames.set(baseName, currentCount);
  const suffix = currentCount > 1 ? `-${currentCount}` : "";
  const filename = `${baseName}${suffix}.${ext}`;
  const path = `images/${filename}`;
  images[imageId] = path;
  imageFiles.push({
    path,
    blob
  });
  imageResults.push(buildImageEntry(imageId, record, path, entityByImageId, entityById));
}
async function buildBundleImageAssets({
  projectId,
  worldData,
  chronicles,
  staticPages,
  eraNarratives,
  shouldCancel,
  onProgress,
  mode = "local",
  storage
}) {
  const imageIds = collectReferencedImageIds(worldData, chronicles, staticPages, eraNarratives);
  const totalImages = imageIds.size;
  if (imageIds.size === 0) {
    return {
      imageData: null,
      images: null,
      imageFiles: []
    };
  }
  const imageRecords = projectId ? await getImagesByProject(projectId) : [];
  const imageById = new Map(imageRecords.map(record => [record.imageId, record]));
  const entityById = new Map((worldData?.hardState || []).map(entity => [entity.id, entity]));
  const entityByImageId = new Map();
  for (const entity of worldData?.hardState || []) {
    const imageId = entity?.enrichment?.image?.imageId;
    if (imageId) entityByImageId.set(imageId, entity);
  }
  const imageResults = [];
  const imageFiles = [];
  const images = {};
  const usedNames = new Map();
  let processed = 0;
  if (onProgress) {
    onProgress({
      phase: "images",
      processed,
      total: totalImages
    });
  }
  for (const imageId of imageIds) {
    throwIfExportCanceled(shouldCancel);
    let record = imageById.get(imageId);
    if (!record) record = await getImageMetadata(imageId);
    if (mode === "s3" && storage) {
      processed += 1;
      processS3Image(imageId, record, storage, entityByImageId, entityById, images, imageResults);
      if (onProgress) onProgress({
        phase: "images",
        processed,
        total: totalImages
      });
      continue;
    }
    const blob = await getImageBlob(imageId);
    throwIfExportCanceled(shouldCancel);
    processed += 1;
    if (blob) {
      processLocalImage(imageId, record, blob, entityByImageId, entityById, images, imageFiles, imageResults, usedNames);
    }
    if (onProgress) onProgress({
      phase: "images",
      processed,
      total: totalImages
    });
  }
  if (imageResults.length === 0) {
    return {
      imageData: null,
      images: null,
      imageFiles: []
    };
  }
  return {
    imageData: {
      generatedAt: new Date().toISOString(),
      totalImages: imageResults.length,
      results: imageResults
    },
    images,
    imageFiles
  };
}
const styles = {
  app: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    backgroundColor: colors.bgPrimary,
    color: colors.textPrimary,
    fontFamily: typography.fontFamily
  },
  content: {
    flex: 1,
    overflow: "hidden"
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: colors.textMuted
  },
  footer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
    padding: `${spacing.sm} ${spacing.lg}`,
    backgroundColor: colors.bgPrimary,
    borderTop: `1px solid ${colors.border}`,
    fontSize: typography.sizeSm,
    color: colors.textMuted,
    flexShrink: 0
  },
  awsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: spacing.md
  },
  awsField: {
    display: "flex",
    flexDirection: "column",
    gap: spacing.xs
  },
  awsLabel: {
    fontSize: typography.sizeXs,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: "0.06em"
  },
  awsInput: {
    width: "100%",
    padding: `${spacing.sm} ${spacing.md}`,
    borderRadius: spacing.sm,
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.bgSecondary,
    color: colors.textPrimary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizeSm
  }
};
const VALID_TABS = ["enumerist", "names", "cosmography", "coherence", "simulation", "illuminator", "archivist", "chronicler"];
const SLOT_EXPORT_FORMAT = "canonry-slot-export";
const SLOT_EXPORT_VERSION = 1;
const VIEWER_BUNDLE_FORMAT = "canonry-viewer-bundle";
const VIEWER_BUNDLE_VERSION = 1;
function isWorldOutput(candidate) {
  if (!candidate || typeof candidate !== "object") return false;
  return Boolean(candidate.schema && candidate.metadata && Array.isArray(candidate.hardState) && Array.isArray(candidate.relationships) && candidate.pressures && typeof candidate.pressures === "object");
}
function mergeDefined(value, fallback) {
  return value === undefined ? fallback : value;
}
function buildExportBase(value, fallback) {
  const raw = value || fallback || "export";
  return raw.toString().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function normalizeWorldContextForExport(worldContext) {
  if (!worldContext || typeof worldContext !== "object") return null;
  const worldDynamics = Array.isArray(worldContext.worldDynamics) ? worldContext.worldDynamics : [];
  return {
    ...worldContext,
    worldDynamics
  };
}

// normalizeUiState moved to stores/useCanonryUiStore.js

export default function App() {
  const activeTab = useCanonryUiStore(s => s.activeTab);
  const activeSectionByTab = useCanonryUiStore(s => s.activeSectionByTab);
  const showHome = useCanonryUiStore(s => s.showHome);
  const helpModalOpen = useCanonryUiStore(s => s.helpModalOpen);
  const chroniclerRequestedPage = useCanonryUiStore(s => s.chroniclerRequestedPage);
  const [archivistData, setArchivistData] = useState(null);
  const [worldContext, setWorldContext] = useState(null);
  const [entityGuidance, setEntityGuidance] = useState(null);
  const [cultureIdentities, setCultureIdentities] = useState(null);
  const [enrichmentConfig, setEnrichmentConfig] = useState(null);
  const [styleSelection, setStyleSelection] = useState(null);
  const [historianConfig, setHistorianConfig] = useState(null);
  const [simulationResults, setSimulationResults] = useState(null);
  const [simulationState, setSimulationState] = useState(null);
  const [slots, setSlots] = useState({});
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const [exportModalSlotIndex, setExportModalSlotIndex] = useState(null);
  const [exportBundleStatus, setExportBundleStatus] = useState({
    state: "idle",
    detail: ""
  });
  // AWS state from zustand store
  const awsModalOpen = useCanonryAwsStore(s => s.modalOpen);
  const awsConfig = useCanonryAwsStore(s => s.config);
  const awsTokens = useCanonryAwsStore(s => s.tokens);
  const awsStatus = useCanonryAwsStore(s => s.status);
  const awsBrowseState = useCanonryAwsStore(s => s.browseState);
  const awsUsername = useCanonryAwsStore(s => s.username);
  const awsPassword = useCanonryAwsStore(s => s.password);
  const awsUserLabel = useCanonryAwsStore(s => s.userLabel);
  const awsSyncProgress = useCanonryAwsStore(s => s.syncProgress);
  const awsUploadPlan = useCanonryAwsStore(s => s.uploadPlan);
  const snapshotStatus = useCanonryAwsStore(s => s.snapshotStatus);
  // AWS actions from zustand store (stable references, no useCallback needed)
  const updateAwsConfig = useCanonryAwsStore(s => s.updateConfig);
  const setAwsTokens = useCanonryAwsStore(s => s.setTokens);
  const setAwsStatus = useCanonryAwsStore(s => s.setStatus);
  const setAwsBrowseState = useCanonryAwsStore(s => s.setBrowseState);
  const setAwsUsername = useCanonryAwsStore(s => s.setUsername);
  const setAwsPassword = useCanonryAwsStore(s => s.setPassword);
  const setAwsUserLabel = useCanonryAwsStore(s => s.setUserLabel);
  const setAwsSyncProgress = useCanonryAwsStore(s => s.setSyncProgress);
  const setAwsUploadPlan = useCanonryAwsStore(s => s.setUploadPlan);
  const setSnapshotStatus = useCanonryAwsStore(s => s.setSnapshotStatus);
  const openAwsModal = useCanonryAwsStore(s => s.openModal);
  const closeAwsModal = useCanonryAwsStore(s => s.closeModal);
  const exportCancelRef = useRef(false);
  const exportModalMouseDown = useRef(false);
  const awsModalMouseDown = useRef(false);
  const simulationOwnerRef = useRef(null);
  const currentProjectRef = useRef(null);
  // Track whether we're loading from a saved slot (to skip auto-save to scratch)
  const isLoadingSlotRef = useRef(false);
  // Track the last saved simulation results object to detect new simulations
  const lastSavedResultsRef = useRef(null);
  const bestRunScoreRef = useRef(-Infinity);
  const bestRunSaveQueueRef = useRef(Promise.resolve());
  const activeSection = useCanonryUiStore(selectActiveSection);
  const s3Client = useMemo(() => createS3Client(awsConfig, awsTokens), [awsConfig, awsTokens]);
  useEffect(() => {
    const tokens = extractCognitoTokensFromUrl();
    if (tokens) {
      setAwsTokens(tokens);
      clearCognitoHash();
    }
  }, [setAwsTokens]);
  useEffect(() => {
    let canceled = false;
    const userPoolConfigured = Boolean(awsConfig?.cognitoUserPoolId && awsConfig?.cognitoClientId);
    if (!userPoolConfigured || isTokenValid(awsTokens)) return;
    getUserPoolSession(awsConfig).then(session => {
      if (canceled || !session) return;
      const nextTokens = sessionToTokens(session);
      if (nextTokens) {
        setAwsTokens(nextTokens);
      }
      const username = session.getIdToken().payload?.["cognito:username"] || "";
      if (username) setAwsUserLabel(username);
    }).catch(() => {});
    return () => {
      canceled = true;
    };
  }, [awsConfig, awsTokens, setAwsTokens, setAwsUserLabel]);
  // UI actions from zustand store (stable references, no useCallback needed)
  const setActiveSection = useCanonryUiStore(s => s.setActiveSection);
  const setActiveSectionForTab = useCanonryUiStore(s => s.setActiveSectionForTab);
  const handleTabChange = useCanonryUiStore(s => s.setActiveTab);
  const handleGoHome = useCanonryUiStore(s => s.goHome);
  const handleLandingNavigate = useCanonryUiStore(s => s.setActiveTab);
  const clearChroniclerRequestedPage = useCanonryUiStore(s => s.clearChroniclerRequestedPage);
  const openHelpModal = useCanonryUiStore(s => s.openHelpModal);
  const closeHelpModal = useCanonryUiStore(s => s.closeHelpModal);
  // Listen for cross-MFE navigation events (e.g., Archivist -> Chronicler)
  useEffect(() => {
    const navigateTo = useCanonryUiStore.getState().navigateTo;
    const handleCrossNavigation = e => {
      const {
        tab,
        pageId
      } = e.detail || {};
      if (tab) navigateTo(tab, pageId);
    };
    window.addEventListener("canonry:navigate", handleCrossNavigation);
    return () => window.removeEventListener("canonry:navigate", handleCrossNavigation);
  }, []);

  // Listen for Illuminator world data mutations (rename, patch, enrichment)
  // The Illuminator writes to its own Dexie store, then dispatches this event.
  // We read from Dexie and merge into archivistData so other tabs see the changes.
  useEffect(() => {
    const handler = async e => {
      const {
        simulationRunId
      } = e.detail || {};
      if (!simulationRunId) return;
      try {
        const [{
          getEntitiesForRun
        }, {
          getNarrativeEventsForRun
        }] = await Promise.all([import("illuminator/entityRepository"), import("illuminator/eventRepository")]);
        await Promise.all([getEntitiesForRun(simulationRunId), getNarrativeEventsForRun(simulationRunId)]);

        // DISABLED: Automatic hardState updates removed due to data loss bug.
        // The enrichment data lives in Dexie and is loaded by IlluminatorRemote.
        // Do NOT modify worldData.hardState from this event handler.
      } catch (err) {
        console.warn("[Canonry] Failed to load Illuminator world data from Dexie:", err);
      }
    };
    window.addEventListener("illuminator:worlddata-changed", handler);
    return () => window.removeEventListener("illuminator:worlddata-changed", handler);
  }, []);

  // Listen for hash changes to switch tabs (enables back button across MFEs)
  // Hash formats: Archivist uses #/entity/{id}, Chronicler uses #/page/{id|slug}
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith("#/entity/") || hash === "#/entity") {
        if (activeTab !== "archivist") handleTabChange("archivist");
      } else if (hash.startsWith("#/page/") || hash === "#/page") {
        if (activeTab !== "chronicler") handleTabChange("chronicler");
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [activeTab, handleTabChange]);
  const openExportModal = useCallback(slotIndex => {
    exportCancelRef.current = false;
    setExportBundleStatus({
      state: "idle",
      detail: ""
    });
    setExportModalSlotIndex(slotIndex);
  }, []);
  const closeExportModal = useCallback(() => {
    setExportModalSlotIndex(null);
    setExportBundleStatus({
      state: "idle",
      detail: ""
    });
  }, []);
  const handleExportModalMouseDown = useCallback(e => {
    exportModalMouseDown.current = e.target === e.currentTarget;
  }, []);
  const handleExportModalClick = useCallback(e => {
    if (exportBundleStatus.state === "working") return;
    if (exportModalMouseDown.current && e.target === e.currentTarget) {
      closeExportModal();
    }
  }, [closeExportModal, exportBundleStatus.state]);
  const handleAwsModalMouseDown = useCallback(e => {
    awsModalMouseDown.current = e.target === e.currentTarget;
  }, []);
  const handleAwsModalClick = useCallback(e => {
    if (awsModalMouseDown.current && e.target === e.currentTarget) {
      closeAwsModal();
    }
  }, [closeAwsModal]);
  const handleAwsLogin = useCallback(async () => {
    if (!awsUsername || !awsPassword) {
      alert("Enter username and password.");
      return;
    }
    try {
      setAwsStatus({
        state: "working",
        detail: "Signing in..."
      });
      const session = await signInWithUserPool({
        username: awsUsername,
        password: awsPassword,
        config: awsConfig
      });
      const nextTokens = sessionToTokens(session);
      if (nextTokens) {
        setAwsTokens(nextTokens);
      }
      setAwsUserLabel(awsUsername);
      setAwsPassword("");
      setAwsStatus({
        state: "idle",
        detail: "Signed in."
      });
    } catch (err) {
      console.error("Failed to sign in:", err);
      setAwsStatus({
        state: "error",
        detail: err.message || "Sign in failed."
      });
    }
  }, [awsUsername, awsPassword, awsConfig, setAwsStatus, setAwsTokens, setAwsUserLabel, setAwsPassword]);
  const handleAwsLogout = useCallback(() => {
    signOutUserPool(awsConfig);
    setAwsTokens(null);
    setAwsUserLabel("");
    setAwsStatus({
      state: "idle",
      detail: "Signed out."
    });
  }, [awsConfig, setAwsTokens, setAwsUserLabel, setAwsStatus]);
  const handleAwsBrowsePrefixes = useCallback(async () => {
    if (!s3Client || !awsConfig?.imageBucket) {
      setAwsBrowseState({
        loading: false,
        prefixes: [],
        error: "Missing S3 client or bucket."
      });
      return;
    }
    try {
      setAwsBrowseState({
        loading: true,
        prefixes: [],
        error: null
      });
      const prefixes = await listS3Prefixes(s3Client, {
        bucket: awsConfig.imageBucket,
        prefix: awsConfig.imagePrefix || ""
      });
      setAwsBrowseState({
        loading: false,
        prefixes,
        error: null
      });
    } catch (err) {
      setAwsBrowseState({
        loading: false,
        prefixes: [],
        error: err.message || "Failed to list prefixes."
      });
    }
  }, [s3Client, awsConfig, setAwsBrowseState]);
  const handleAwsTestSetup = useCallback(async () => {
    if (!s3Client) {
      setAwsStatus({
        state: "error",
        detail: "Missing AWS credentials."
      });
      return;
    }
    if (!awsConfig?.imageBucket) {
      setAwsStatus({
        state: "error",
        detail: "Missing image bucket."
      });
      return;
    }
    try {
      setAwsStatus({
        state: "working",
        detail: "Testing S3 access..."
      });
      setAwsSyncProgress({
        phase: "test",
        processed: 0,
        total: 0,
        uploaded: 0
      });
      const prefixes = await listS3Prefixes(s3Client, {
        bucket: awsConfig.imageBucket,
        prefix: awsConfig.imagePrefix || ""
      });
      const prefixLabel = prefixes.length ? `Found ${prefixes.length} prefixes.` : "Access OK.";
      setAwsStatus({
        state: "idle",
        detail: `Test passed. ${prefixLabel}`
      });
    } catch (err) {
      console.error("Failed to test S3 setup:", err);
      setAwsStatus({
        state: "error",
        detail: err.message || "S3 test failed."
      });
    }
  }, [s3Client, awsConfig, setAwsStatus, setAwsSyncProgress]);
  const handleAwsSyncImages = useCallback(async () => {
    const projectId = currentProjectRef.current?.id;
    if (!projectId) return;
    if (!s3Client) {
      alert("Missing S3 client. Check Cognito configuration and login.");
      return;
    }
    setAwsStatus({
      state: "working",
      detail: "Syncing images to S3..."
    });
    setAwsSyncProgress({
      phase: "scan",
      processed: 0,
      total: 0,
      uploaded: 0
    });
    try {
      await syncProjectImagesToS3({
        projectId,
        s3: s3Client,
        config: awsConfig,
        onProgress: ({
          phase,
          processed,
          total,
          uploaded
        }) => {
          const label = phase === "upload" ? "Uploading" : "Scanning";
          setAwsStatus({
            state: "working",
            detail: `${label} images ${processed}/${total} (uploaded ${uploaded})...`
          });
          setAwsSyncProgress({
            phase,
            processed,
            total,
            uploaded
          });
        }
      });
      setAwsStatus({
        state: "idle",
        detail: "Image sync complete."
      });
    } catch (err) {
      console.error("Failed to sync images:", err);
      setAwsStatus({
        state: "error",
        detail: err.message || "Image sync failed."
      });
    }
  }, [s3Client, awsConfig, setAwsStatus, setAwsSyncProgress]);
  const handleExportSnapshot = useCallback(async () => {
    if (!s3Client) return;
    setSnapshotStatus({
      state: "working",
      detail: "Starting export..."
    });
    try {
      const result = await exportIndexedDbToS3(s3Client, awsConfig, ({
        detail
      }) => {
        setSnapshotStatus({
          state: "working",
          detail
        });
      });
      setSnapshotStatus({
        state: "idle",
        detail: `Exported ${result.dbCount} databases, ${result.storeCount} stores (${result.sizeMb} MB) to s3://${awsConfig.imageBucket}/${result.key}`
      });
    } catch (err) {
      console.error("Snapshot export failed:", err);
      setSnapshotStatus({
        state: "error",
        detail: err.message || "Export failed."
      });
    }
  }, [s3Client, awsConfig, setSnapshotStatus]);
  const handleImportSnapshot = useCallback(async () => {
    if (!s3Client) return;
    if (!window.confirm('This will REPLACE all local data (projects, runs, entities, chronicles, costs, etc.) with the snapshot from S3.\n\nImages are not included — use "Sync Images to S3" separately.\n\nThe page will reload after import. Continue?')) return;
    setSnapshotStatus({
      state: "working",
      detail: "Starting import..."
    });
    try {
      const result = await importIndexedDbFromS3(s3Client, awsConfig, ({
        detail
      }) => {
        setSnapshotStatus({
          state: "working",
          detail
        });
      });
      const warnSuffix = result.warnings?.length ? ` (${result.warnings.length} warnings — check console)` : "";
      setSnapshotStatus({
        state: "idle",
        detail: `Restored ${result.dbCount} databases, ${result.storeCount} stores, ${result.recordCount} records (snapshot from ${result.exportedAt})${warnSuffix}. Reloading...`
      });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error("Snapshot import failed:", err);
      setSnapshotStatus({
        state: "error",
        detail: err.message || "Import failed."
      });
    }
  }, [s3Client, awsConfig, setSnapshotStatus]);
  const handlePullImages = useCallback(async () => {
    const projectId = currentProjectRef.current?.id;
    if (!s3Client) {
      alert("Missing S3 client. Check Cognito configuration and login.");
      return;
    }
    setAwsStatus({
      state: "working",
      detail: "Pulling images from S3..."
    });
    setAwsSyncProgress({
      phase: "scan",
      processed: 0,
      total: 0,
      uploaded: 0
    });
    try {
      const result = await pullImagesFromS3({
        s3: s3Client,
        config: awsConfig,
        projectId: projectId || null,
        onProgress: ({
          detail
        }) => {
          setAwsStatus({
            state: "working",
            detail
          });
        }
      });
      const parts = [`${result.downloaded} downloaded`, `${result.skipped} already local`];
      if (result.errors) parts.push(`${result.errors} errors`);
      setAwsStatus({
        state: "idle",
        detail: `Image pull complete: ${parts.join(", ")}.`
      });
    } catch (err) {
      console.error("Image pull failed:", err);
      setAwsStatus({
        state: "error",
        detail: err.message || "Image pull failed."
      });
    }
    setAwsSyncProgress({
      phase: "idle",
      processed: 0,
      total: 0,
      uploaded: 0
    });
  }, [s3Client, awsConfig, setAwsStatus, setAwsSyncProgress]);
  const handleAwsPreviewUploads = useCallback(async () => {
    const projectId = currentProjectRef.current?.id;
    if (!projectId) return;
    if (!s3Client) {
      setAwsUploadPlan({
        loading: false,
        error: "Missing S3 client. Check Cognito configuration and login.",
        summary: null,
        json: ""
      });
      return;
    }
    if (!awsConfig?.imageBucket) {
      setAwsUploadPlan({
        loading: false,
        error: "Missing image bucket.",
        summary: null,
        json: ""
      });
      return;
    }
    setAwsUploadPlan({
      loading: true,
      error: null,
      summary: null,
      json: ""
    });
    try {
      const plan = await getS3ImageUploadPlan({
        projectId,
        s3: s3Client,
        config: awsConfig,
        repairSizes: true
      });
      const summary = {
        total: plan.total,
        uploadCount: plan.candidates.length,
        manifestFound: plan.manifestFound,
        basePrefix: plan.basePrefix,
        repairs: plan.repairs,
        manifestRepairs: plan.manifestRepairs
      };
      const payload = {
        summary,
        images: plan.candidates
      };
      setAwsUploadPlan({
        loading: false,
        error: null,
        summary,
        json: JSON.stringify(payload, null, 2)
      });
      setAwsStatus({
        state: "idle",
        detail: `Upload plan ready: ${summary.uploadCount}/${summary.total} images.`
      });
    } catch (err) {
      console.error("Failed to build upload plan:", err);
      setAwsUploadPlan({
        loading: false,
        error: err.message || "Failed to build upload plan.",
        summary: null,
        json: ""
      });
      setAwsStatus({
        state: "error",
        detail: err.message || "Failed to build upload plan."
      });
    }
  }, [s3Client, awsConfig, setAwsUploadPlan, setAwsStatus]);
  const handleCancelExportBundle = useCallback(() => {
    exportCancelRef.current = true;
    setExportBundleStatus({
      state: "idle",
      detail: ""
    });
    closeExportModal();
  }, [closeExportModal]);

  // UI state persistence is handled by useCanonryUiStore's subscribe()

  useEffect(() => {
    const score = slots[1]?.runScore;
    bestRunScoreRef.current = typeof score === "number" ? score : -Infinity;
  }, [slots]);
  const {
    projects,
    currentProject,
    loading,
    error,
    createProject,
    openProject,
    save,
    removeProject,
    duplicateProject,
    exportProject,
    importProject,
    reloadProjectFromDefaults,
    DEFAULT_PROJECT_ID
  } = useProjectStorage();
  useEffect(() => {
    currentProjectRef.current = currentProject;
  }, [currentProject]);

  // Wrap reloadProjectFromDefaults to also update React state
  const handleReloadFromDefaults = useCallback(async () => {
    await reloadProjectFromDefaults();
    // Re-read worldStore since the useEffect won't re-run (same project ID)
    if (currentProject?.id) {
      const store = await loadWorldStore(currentProject.id);
      if (store?.worldContext) {
        setWorldContext(store.worldContext);
      }
      if (store?.entityGuidance) {
        setEntityGuidance(store.entityGuidance);
      }
      if (store?.cultureIdentities) {
        setCultureIdentities(store.cultureIdentities);
      }
      if (store?.enrichmentConfig) {
        setEnrichmentConfig(store.enrichmentConfig);
      }
      if (store?.styleSelection) {
        setStyleSelection(store.styleSelection);
      }
      if (store?.historianConfig) {
        setHistorianConfig(store.historianConfig);
      }
    }
  }, [reloadProjectFromDefaults, currentProject?.id]);

  // Configure the shared image store with an IndexedDB backend
  useEffect(() => {
    const backend = new IndexedDBBackend();
    useImageStore.getState().configure(backend);
    return () => useImageStore.getState().cleanup();
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (!currentProject?.id) {
      simulationOwnerRef.current = null;
      setSimulationResults(null);
      setSimulationState(null);
      setArchivistData(null);
      setSlots({});
      setActiveSlotIndex(0);
      return undefined;
    }
    simulationOwnerRef.current = null;
    isLoadingSlotRef.current = false;
    lastSavedResultsRef.current = null;
    setSimulationResults(null);
    setSimulationState(null);
    setArchivistData(null);
    setWorldContext(null);
    setEntityGuidance(null);
    setCultureIdentities(null);
    setEnrichmentConfig(null);
    setStyleSelection(null);
    setHistorianConfig(null);
    setSlots({});
    setActiveSlotIndex(0);

    // Load world store and run slots
    Promise.all([loadWorldStore(currentProject.id), getSlots(currentProject.id)]).then(([store, loadedSlots]) => {
      if (cancelled) return;
      simulationOwnerRef.current = currentProject.id;

      // Set slots and active index
      const loadedActiveIndex = store?.activeSlotIndex ?? 0;
      setSlots(loadedSlots);
      setActiveSlotIndex(loadedActiveIndex);

      // Load data from active slot
      const activeSlot = loadedSlots[loadedActiveIndex];
      // Only skip auto-save if we actually loaded prior simulation/world data
      isLoadingSlotRef.current = Boolean(activeSlot?.simulationResults || activeSlot?.simulationState || activeSlot?.worldData);
      if (activeSlot) {
        // Track the loaded simulation results to prevent re-saving as "new"
        lastSavedResultsRef.current = activeSlot.simulationResults || null;
        setSimulationResults(activeSlot.simulationResults || null);
        setSimulationState(activeSlot.simulationState || null);
        if (activeSlot.worldData) {
          // Extract loreData from enriched entities (with current imageRefs)
          extractLoreDataWithCurrentImageRefs(activeSlot.worldData).then(loreData => {
            if (cancelled) return;
            setArchivistData({
              worldData: activeSlot.worldData,
              loreData
            });
          });
        }
      }

      // Load shared data (world context, entity guidance, culture identities, and Illuminator config)
      if (store?.worldContext) {
        setWorldContext(store.worldContext);
      }
      if (store?.entityGuidance) {
        setEntityGuidance(store.entityGuidance);
      }
      if (store?.cultureIdentities) {
        setCultureIdentities(store.cultureIdentities);
      }
      if (store?.enrichmentConfig) {
        setEnrichmentConfig(store.enrichmentConfig);
      }
      if (store?.styleSelection) {
        setStyleSelection(store.styleSelection);
      }
      if (store?.historianConfig) {
        setHistorianConfig(store.historianConfig);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [currentProject?.id]);
  useEffect(() => {
    if (!currentProject?.id) return;
    if (simulationOwnerRef.current !== currentProject.id) return;
    if (!simulationResults && !simulationState) return;
    const status = simulationState?.status;
    if (status && status !== "complete" && status !== "error") return;

    // Skip auto-save to scratch if we're loading from a saved slot
    if (isLoadingSlotRef.current) {
      isLoadingSlotRef.current = false;
      return;
    }

    // Check if this is a genuinely new simulation (different results object)
    const isNewSimulation = Boolean(simulationResults && simulationResults !== lastSavedResultsRef.current);
    const worldData = simulationResults ?? null;
    const now = Date.now();
    let cancelled = false;
    const persist = async () => {
      const existingSlot = (await getSlot(currentProject.id, 0)) || {};
      let title = existingSlot.title || "Scratch";
      let createdAt = existingSlot.createdAt || now;

      // Only generate new title for genuinely new simulations
      if (isNewSimulation && simulationResults?.hardState) {
        const entityCount = simulationResults.hardState.length;
        const date = new Date(now);
        const timeStr = date.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true
        });
        title = `Run - ${timeStr} (${entityCount} entities)`;
        createdAt = now;
      }
      const slotData = {
        ...existingSlot,
        simulationResults,
        simulationState,
        worldData,
        title,
        createdAt
      };
      await saveSlot(currentProject.id, 0, slotData);
      await persistActiveSlotIndex(currentProject.id, 0);
      if (cancelled) return;
      setSlots(prev => ({
        ...prev,
        0: slotData
      }));

      // Track this simulation as saved
      lastSavedResultsRef.current = simulationResults || null;

      // Update archivistData for immediate use
      if (worldData) {
        extractLoreDataWithCurrentImageRefs(worldData).then(loreData => {
          if (cancelled) return;
          setArchivistData({
            worldData,
            loreData
          });
        });
      }

      // Ensure we're viewing scratch after new simulation
      setActiveSlotIndex(0);
    };
    persist().catch(err => {
      console.error("Failed to save simulation results:", err);
    });
    return () => {
      cancelled = true;
    };
  }, [currentProject?.id, simulationResults, simulationState]);
  const handleSearchRunScored = useCallback((payload = {}) => {
    const {
      runScore,
      runScoreMax,
      simulationResults: scoredResults,
      simulationState: scoredState,
      runScoreDetails
    } = payload;
    if (!currentProject?.id) return Promise.resolve();
    if (!scoredResults || !Number.isFinite(runScore)) return Promise.resolve();
    if (runScore <= bestRunScoreRef.current) return Promise.resolve();
    bestRunScoreRef.current = runScore;
    const saveTask = async () => {
      if (runScore < bestRunScoreRef.current) return;
      const now = Date.now();
      const scoreLabel = Number.isFinite(runScoreMax) ? `${runScore}/${runScoreMax}` : `${runScore}`;
      const slotData = {
        simulationResults: scoredResults,
        simulationState: scoredState,
        worldData: scoredResults,
        title: `Best Run - Score ${scoreLabel}`,
        createdAt: now,
        savedAt: now,
        runScore,
        runScoreMax,
        runScoreDetails
      };
      await saveSlot(currentProject.id, 1, slotData);
      setSlots(prev => ({
        ...prev,
        1: slotData
      }));
    };
    const queued = bestRunSaveQueueRef.current.then(saveTask);
    bestRunSaveQueueRef.current = queued.catch(() => {});
    return queued;
  }, [currentProject?.id]);

  // Persist world data when it changes (for Archivist/Illuminator)
  useEffect(() => {
    if (!currentProject?.id) return;
    if (!archivistData?.worldData) return;
    saveWorldData(currentProject.id, archivistData.worldData);
  }, [currentProject?.id, archivistData]);

  // Persist world context when it changes (for Illuminator)
  useEffect(() => {
    if (!currentProject?.id) return;
    if (!worldContext) return;
    const timeoutId = setTimeout(() => {
      saveWorldContext(currentProject.id, worldContext);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [currentProject?.id, worldContext]);

  // Persist entity guidance when it changes (for Illuminator)
  useEffect(() => {
    if (!currentProject?.id) return;
    if (!entityGuidance) return;
    const timeoutId = setTimeout(() => {
      saveEntityGuidance(currentProject.id, entityGuidance);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [currentProject?.id, entityGuidance]);

  // Persist culture identities when they change (for Illuminator)
  useEffect(() => {
    if (!currentProject?.id) return;
    if (!cultureIdentities) return;
    const timeoutId = setTimeout(() => {
      saveCultureIdentities(currentProject.id, cultureIdentities);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [currentProject?.id, cultureIdentities]);

  // Persist enrichment config when it changes (for Illuminator)
  useEffect(() => {
    if (!currentProject?.id) return;
    if (!enrichmentConfig) return;
    const timeoutId = setTimeout(() => {
      saveEnrichmentConfig(currentProject.id, enrichmentConfig);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [currentProject?.id, enrichmentConfig]);

  // Persist style selection when it changes (for Illuminator)
  useEffect(() => {
    if (!currentProject?.id) return;
    if (!styleSelection) return;
    const timeoutId = setTimeout(() => {
      saveStyleSelection(currentProject.id, styleSelection);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [currentProject?.id, styleSelection]);

  // Persist historian config when it changes (for Illuminator)
  useEffect(() => {
    if (!currentProject?.id) return;
    if (!historianConfig) return;
    const timeoutId = setTimeout(() => {
      saveHistorianConfig(currentProject.id, historianConfig);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [currentProject?.id, historianConfig]);
  const mergeFrameworkOverrides = (items, existingItems, frameworkKeys, keyField) => {
    const filtered = (items || []).filter(item => !item?.isFramework);
    const existingOverrides = (existingItems || []).filter(item => frameworkKeys.has(item?.[keyField]));
    const existingKeys = new Set(filtered.map(item => item?.[keyField]));
    const merged = [...filtered, ...existingOverrides.filter(item => !existingKeys.has(item?.[keyField]))];
    return merged;
  };

  // Update functions that auto-save
  const updateEntityKinds = useCallback(entityKinds => {
    if (!currentProject) return;
    const frameworkKeys = new Set(FRAMEWORK_ENTITY_KIND_VALUES);
    const merged = mergeFrameworkOverrides(entityKinds, currentProject.entityKinds, frameworkKeys, "kind");
    save({
      entityKinds: merged
    });
  }, [currentProject, save]);
  const updateRelationshipKinds = useCallback(relationshipKinds => {
    if (!currentProject) return;
    const frameworkKeys = new Set(FRAMEWORK_RELATIONSHIP_KIND_VALUES);
    const merged = mergeFrameworkOverrides(relationshipKinds, currentProject.relationshipKinds, frameworkKeys, "kind");
    save({
      relationshipKinds: merged
    });
  }, [currentProject, save]);
  const updateCultures = useCallback(cultures => {
    if (!currentProject) return;
    const frameworkKeys = new Set(Object.values(FRAMEWORK_CULTURES));
    const merged = mergeFrameworkOverrides(cultures, currentProject.cultures, frameworkKeys, "id");
    save({
      cultures: merged
    });
  }, [currentProject, save]);
  const updateSeedEntities = useCallback(seedEntities => save({
    seedEntities
  }), [save]);
  const updateSeedRelationships = useCallback(seedRelationships => save({
    seedRelationships
  }), [save]);
  const updateEras = useCallback(eras => save({
    eras
  }), [save]);
  const updatePressures = useCallback(pressures => save({
    pressures
  }), [save]);
  const updateGenerators = useCallback(generators => save({
    generators
  }), [save]);
  const updateSystems = useCallback(systems => save({
    systems
  }), [save]);
  const updateActions = useCallback(actions => save({
    actions
  }), [save]);
  const updateTagRegistry = useCallback(tagRegistry => {
    if (!currentProject) return;
    const frameworkKeys = new Set(FRAMEWORK_TAG_VALUES);
    const merged = mergeFrameworkOverrides(tagRegistry, currentProject.tagRegistry, frameworkKeys, "tag");
    save({
      tagRegistry: merged
    });
  }, [currentProject, save]);
  const updateAxisDefinitions = useCallback(axisDefinitions => save({
    axisDefinitions
  }), [save]);
  const updateDistributionTargets = useCallback(distributionTargets => save({
    distributionTargets
  }), [save]);

  // Add a single tag to the registry (for remotes)
  const addTag = useCallback(newTag => {
    if (!currentProject) return;
    const existingRegistry = currentProject.tagRegistry || [];
    // Don't add if already exists
    if (existingRegistry.some(t => t.tag === newTag.tag)) return;
    save({
      tagRegistry: [...existingRegistry, newTag]
    });
  }, [currentProject, save]);

  // Update a single culture's naming data (for Name Forge)
  const updateCultureNaming = useCallback((cultureId, namingData) => {
    if (!currentProject) return;
    const existing = currentProject.cultures.find(c => c.id === cultureId);
    if (existing) {
      const cultures = currentProject.cultures.map(c => c.id === cultureId ? {
        ...c,
        naming: namingData
      } : c);
      save({
        cultures
      });
      return;
    }
    const baseCulture = FRAMEWORK_CULTURE_DEFINITIONS.find(c => c.id === cultureId);
    if (!baseCulture) return;
    const cultures = [...currentProject.cultures, {
      id: baseCulture.id,
      name: baseCulture.name,
      naming: namingData
    }];
    save({
      cultures
    });
  }, [currentProject, save]);

  // ==========================================================================
  // Slot operations
  // ==========================================================================

  // Load a slot (switch active slot)
  const handleLoadSlot = useCallback(async slotIndex => {
    if (!currentProject?.id) return;
    try {
      await loadSlot(currentProject.id, slotIndex);
      setActiveSlotIndex(slotIndex);

      // Load data from storage to ensure we have the latest
      const [storedSlot, loadedSlots] = await Promise.all([getSlot(currentProject.id, slotIndex), getSlots(currentProject.id)]);

      // Update local slots state with data from storage
      setSlots(loadedSlots);

      // Mark that we're loading from a saved slot (skip auto-save effect)
      isLoadingSlotRef.current = true;

      // Set simulation state from stored slot
      if (storedSlot) {
        // Track the loaded simulation results to prevent re-saving as "new"
        lastSavedResultsRef.current = storedSlot.simulationResults || null;
        setSimulationResults(storedSlot.simulationResults || null);
        setSimulationState(storedSlot.simulationState || null);
        if (storedSlot.worldData) {
          // Extract loreData (with current imageRefs)
          const loreData = await extractLoreDataWithCurrentImageRefs(storedSlot.worldData);
          setArchivistData({
            worldData: storedSlot.worldData,
            loreData
          });
        } else {
          setArchivistData(null);
        }
      } else {
        lastSavedResultsRef.current = null;
        setSimulationResults(null);
        setSimulationState(null);
        setArchivistData(null);
      }
    } catch (err) {
      console.error("Failed to load slot:", err);
    }
  }, [currentProject?.id]);

  // Save scratch to a slot (move data)
  const handleSaveToSlot = useCallback(async targetSlotIndex => {
    if (!currentProject?.id) return;
    try {
      await saveToSlot(currentProject.id, targetSlotIndex);

      // Reload slots from storage to ensure consistency
      const loadedSlots = await getSlots(currentProject.id);
      setSlots(loadedSlots);
      setActiveSlotIndex(targetSlotIndex);

      // Update the ref to match the saved slot's data (now in targetSlotIndex)
      const savedSlot = loadedSlots?.[targetSlotIndex];
      lastSavedResultsRef.current = savedSlot?.simulationResults || null;
    } catch (err) {
      console.error("Failed to save to slot:", err);
      alert(err.message || "Failed to save to slot");
    }
  }, [currentProject?.id]);

  // Update slot title
  const handleUpdateSlotTitle = useCallback(async (slotIndex, title) => {
    if (!currentProject?.id) return;
    try {
      await updateSlotTitle(currentProject.id, slotIndex, title);
      setSlots(prev => ({
        ...prev,
        [slotIndex]: {
          ...prev[slotIndex],
          title
        }
      }));
    } catch (err) {
      console.error("Failed to update slot title:", err);
    }
  }, [currentProject?.id]);

  // Clear a slot
  const handleClearSlot = useCallback(async slotIndex => {
    if (!currentProject?.id) return;
    try {
      await clearSlot(currentProject.id, slotIndex);

      // Reload slots from storage
      const loadedSlots = await getSlots(currentProject.id);
      setSlots(loadedSlots);

      // If we cleared the active slot, reset state
      if (slotIndex === activeSlotIndex) {
        // Mark as loading to prevent auto-save effect from triggering
        isLoadingSlotRef.current = true;
        lastSavedResultsRef.current = null;
        setSimulationResults(null);
        setSimulationState(null);
        setArchivistData(null);

        // If we cleared slot 0 (scratch), stay on it but with empty state
        // If we cleared a saved slot, switch to scratch (or first available)
        if (slotIndex !== 0) {
          // Find first slot with data, or default to scratch
          const availableSlot = loadedSlots[0] ? 0 : Object.keys(loadedSlots).map(Number).sort()[0];
          setActiveSlotIndex(availableSlot ?? 0);
        }
        // For slot 0, activeSlotIndex stays at 0 (scratch is always slot 0 even if empty)
      }
    } catch (err) {
      console.error("Failed to clear slot:", err);
    }
  }, [currentProject?.id, activeSlotIndex]);
  const parseSlotImportPayload = useCallback(payload => {
    if (payload?.format === SLOT_EXPORT_FORMAT && payload?.version === SLOT_EXPORT_VERSION) {
      const worldData = payload.worldData || payload.simulationResults;
      if (!isWorldOutput(worldData)) {
        throw new Error("Slot export is missing a valid world output.");
      }
      return {
        worldData,
        simulationResults: payload.simulationResults ?? worldData,
        simulationState: payload.simulationState ?? null,
        worldContext: payload.worldContext,
        entityGuidance: payload.entityGuidance,
        cultureIdentities: payload.cultureIdentities,
        slotTitle: payload.slot?.title,
        slotCreatedAt: payload.slot?.createdAt
      };
    }
    if (payload?.format === VIEWER_BUNDLE_FORMAT && payload?.version === VIEWER_BUNDLE_VERSION) {
      const worldData = payload.worldData;
      if (!isWorldOutput(worldData)) {
        throw new Error("Viewer bundle is missing a valid world output.");
      }
      if (!worldData?.metadata?.simulationRunId && payload?.metadata?.simulationRunId) {
        worldData.metadata = {
          ...worldData.metadata,
          simulationRunId: payload.metadata.simulationRunId
        };
      }
      return {
        worldData,
        simulationResults: worldData,
        simulationState: null,
        slotTitle: payload.slot?.title || payload.metadata?.title,
        slotCreatedAt: payload.slot?.createdAt,
        chronicles: Array.isArray(payload.chronicles) ? payload.chronicles : [],
        staticPages: Array.isArray(payload.staticPages) ? payload.staticPages : [],
        imageData: payload.imageData ?? null,
        images: payload.images ?? null
      };
    }
    if (isWorldOutput(payload)) {
      return {
        worldData: payload,
        simulationResults: payload,
        simulationState: null
      };
    }
    throw new Error("Unsupported import format. Expected a Canonry slot export, viewer bundle, or world output JSON.");
  }, []);
  const importSlotPayload = useCallback(async (slotIndex, payload, options = {}) => {
    if (!currentProject?.id) return;
    const parsed = parseSlotImportPayload(payload);
    const now = Date.now();
    const existingSlot = (await getSlot(currentProject.id, slotIndex)) || {};
    const title = parsed.slotTitle || existingSlot.title || options.defaultTitle || (slotIndex === 0 ? "Scratch" : generateSlotTitle(slotIndex, now));
    const createdAt = parsed.slotCreatedAt ?? existingSlot.createdAt ?? now;
    const worldData = mergeDefined(parsed.worldData, existingSlot.worldData ?? null);
    const simulationResults = mergeDefined(parsed.simulationResults ?? parsed.worldData, existingSlot.simulationResults ?? null);
    const simulationState = mergeDefined(parsed.simulationState, existingSlot.simulationState ?? null);
    if (worldData?.hardState) {
      const incomingEntities = Array.isArray(worldData.hardState) ? worldData.hardState : [];
      const existingEntities = Array.isArray(existingSlot.worldData?.hardState) ? existingSlot.worldData.hardState : [];
      const existingIds = new Set(existingEntities.map(entity => entity?.id).filter(Boolean));
      let overwritten = 0;
      for (const entity of incomingEntities) {
        if (entity?.id && existingIds.has(entity.id)) overwritten += 1;
      }
      console.log("[Canonry] Import entities", {
        processed: incomingEntities.length,
        overwritten,
        new: Math.max(0, incomingEntities.length - overwritten)
      });
    }
    const slotData = {
      ...existingSlot,
      title,
      createdAt,
      savedAt: now,
      simulationResults,
      simulationState,
      worldData
    };
    await saveSlot(currentProject.id, slotIndex, slotData);
    const simulationRunId = worldData?.metadata?.simulationRunId;
    if (!simulationRunId && worldData?.hardState?.length) {
      console.warn("[Canonry] Import skipped Dexie entity merge: missing simulationRunId");
    }
    if (simulationRunId && Array.isArray(worldData?.hardState) && worldData.hardState.length > 0) {
      const entityResult = await importEntities(simulationRunId, worldData.hardState);
      console.log("[Canonry] Import entities (Dexie)", entityResult);
    }
    if (simulationRunId && Array.isArray(worldData?.narrativeHistory) && worldData.narrativeHistory.length > 0) {
      const eventResult = await importNarrativeEvents(simulationRunId, worldData.narrativeHistory);
      console.log("[Canonry] Import narrative events (Dexie)", eventResult);
    }
    if (Array.isArray(parsed.staticPages) && parsed.staticPages.length > 0) {
      await importStaticPages(currentProject.id, parsed.staticPages, {
        preserveIds: true
      });
    }
    if (Array.isArray(parsed.chronicles) && parsed.chronicles.length > 0) {
      const chronicleResult = await importChronicles(currentProject.id, parsed.chronicles, {
        simulationRunId
      });
      console.log("[Canonry] Import chronicles", chronicleResult);
    }
    if (parsed.imageData) {
      const imageResult = await importBundleImageReferences({
        projectId: currentProject.id,
        imageData: parsed.imageData,
        images: parsed.images
      });
      console.log("[Canonry] Import image references", imageResult);
    }
    if (parsed.staticPages?.length || parsed.chronicles?.length || parsed.imageData || worldData?.hardState?.length) {
      const [staticPages, chronicleCount, imageCount, entityCount, eventCount] = await Promise.all([getStaticPagesForProject(currentProject.id), getChronicleCountForProject(currentProject.id), getImageCountForProject(currentProject.id), getEntityCountForRun(simulationRunId), getNarrativeEventCountForRun(simulationRunId)]);
      console.debug("[Canonry] Import store counts", {
        staticPages: staticPages?.length || 0,
        chronicles: chronicleCount,
        images: imageCount,
        entities: entityCount,
        narrativeEvents: eventCount
      });
    }
    if (parsed.worldContext !== undefined) {
      setWorldContext(parsed.worldContext);
      await saveWorldContext(currentProject.id, parsed.worldContext);
    }
    if (parsed.entityGuidance !== undefined) {
      setEntityGuidance(parsed.entityGuidance);
      await saveEntityGuidance(currentProject.id, parsed.entityGuidance);
    }
    if (parsed.cultureIdentities !== undefined) {
      setCultureIdentities(parsed.cultureIdentities);
      await saveCultureIdentities(currentProject.id, parsed.cultureIdentities);
    }
    await handleLoadSlot(slotIndex);
  }, [currentProject?.id, parseSlotImportPayload, handleLoadSlot, getSlot, saveSlot, saveWorldContext, saveEntityGuidance, saveCultureIdentities, importStaticPages, importChronicles, importBundleImageReferences, getStaticPagesForProject, getChronicleCountForProject, getImageCountForProject, importEntities, getEntityCountForRun, importNarrativeEvents, getNarrativeEventCountForRun]);
  const handleExportSlotDownload = useCallback(slotIndex => {
    const slot = slots[slotIndex];
    if (!slot) {
      alert("Slot is empty.");
      return;
    }
    const worldData = slot.worldData || slot.simulationResults;
    if (!isWorldOutput(worldData)) {
      alert("Slot does not contain a valid world output.");
      return;
    }
    const exportWorldContext = normalizeWorldContextForExport(worldContext);
    const exportPayload = {
      format: SLOT_EXPORT_FORMAT,
      version: SLOT_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      slot: {
        index: slotIndex,
        title: slot.title || (slotIndex === 0 ? "Scratch" : `Slot ${slotIndex}`),
        createdAt: slot.createdAt || null,
        savedAt: slot.savedAt || null
      },
      worldData,
      simulationResults: slot.simulationResults || null,
      simulationState: slot.simulationState || null,
      worldContext: exportWorldContext,
      entityGuidance: entityGuidance ?? null,
      cultureIdentities: cultureIdentities ?? null
    };
    const slotFallback = `slot-${slotIndex}`;
    const safeBase = buildExportBase(exportPayload.slot.title, slotFallback);
    const filename = `${safeBase || slotFallback}.canonry-slot.json`;
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, [slots, worldContext, entityGuidance, cultureIdentities]);
  const handleExportBundle = useCallback(async slotIndex => {
    if (!currentProject?.id) return;
    const slot = slots[slotIndex];
    if (!slot) {
      alert("Slot is empty.");
      return;
    }
    const slotWorldData = slot.worldData || slot.simulationResults;
    const liveWorldData = slotIndex === activeSlotIndex ? archivistData?.worldData : null;
    const liveRunId = liveWorldData?.metadata?.simulationRunId;
    const slotRunId = slotWorldData?.metadata?.simulationRunId;
    const worldData = isWorldOutput(liveWorldData) && (!slotWorldData || !slotRunId || slotRunId === liveRunId) ? liveWorldData : slotWorldData;
    if (!isWorldOutput(worldData)) {
      alert("Slot does not contain a valid world output.");
      return;
    }
    const shouldCancel = () => exportCancelRef.current;
    exportCancelRef.current = false;
    setExportBundleStatus({
      state: "working",
      detail: "Gathering run data..."
    });
    try {
      const simulationRunId = worldData?.metadata?.simulationRunId;
      const exportWorldData = await hydrateWorldDataFromDexie({
        worldData,
        projectId: currentProject.id,
        simulationRunId
      });
      const [loreData, staticPagesRaw, chroniclesRaw, eraNarrativesRaw] = await Promise.all([extractLoreDataWithCurrentImageRefs(exportWorldData), getStaticPagesForProject(currentProject.id), simulationRunId ? getCompletedChroniclesForSimulation(simulationRunId) : getCompletedChroniclesForProject(currentProject.id), simulationRunId ? getCompletedEraNarrativesForSimulation(simulationRunId) : Promise.resolve([])]);
      throwIfExportCanceled(shouldCancel);
      const staticPages = (staticPagesRaw || []).filter(page => page.status === "published");
      const chronicles = chroniclesRaw || [];
      const eraNarratives = eraNarrativesRaw || [];
      const useS3Images = Boolean(awsConfig?.useS3Images && awsConfig?.imageBucket);
      const imageStorage = useS3Images ? buildImageStorageConfig(awsConfig, currentProject.id) : null;
      if (useS3Images) {
        if (!s3Client) {
          throw new Error("S3 sync is enabled but AWS credentials are not ready.");
        }
        setExportBundleStatus(prev => prev.state === "working" ? {
          ...prev,
          detail: "Syncing images to S3..."
        } : prev);
        await syncProjectImagesToS3({
          projectId: currentProject.id,
          s3: s3Client,
          config: awsConfig,
          onProgress: ({
            processed,
            total,
            uploaded
          }) => {
            setExportBundleStatus(prev => prev.state === "working" ? {
              ...prev,
              detail: `Syncing images to S3 (${processed}/${total}, uploaded ${uploaded})...`
            } : prev);
          }
        });
      }
      const {
        imageData,
        images,
        imageFiles
      } = await buildBundleImageAssets({
        projectId: currentProject.id,
        worldData: exportWorldData,
        chronicles,
        staticPages,
        eraNarratives,
        shouldCancel,
        onProgress: ({
          phase,
          processed,
          total
        }) => {
          if (phase !== "images") return;
          setExportBundleStatus(prev => prev.state === "working" ? {
            ...prev,
            detail: `Collecting images (${processed}/${total})...`
          } : prev);
        },
        mode: useS3Images ? "s3" : "local",
        storage: imageStorage
      });
      throwIfExportCanceled(shouldCancel);
      setExportBundleStatus(prev => prev.state === "working" ? {
        ...prev,
        detail: "Packaging bundle..."
      } : prev);
      const exportTitle = slot.title || (slotIndex === 0 ? "Scratch" : `Slot ${slotIndex}`);
      const safeBase = buildExportBase(exportTitle, `slot-${slotIndex}`);
      const exportedAt = new Date().toISOString();
      // Note: illuminatorConfig is intentionally omitted from viewer bundles.
      const bundle = {
        format: "canonry-viewer-bundle",
        version: 1,
        metadata: {
          title: exportTitle,
          exportedAt,
          projectId: currentProject.id,
          projectName: currentProject?.name || null,
          simulationRunId: simulationRunId || null
        },
        projectId: currentProject.id,
        slot: {
          index: slotIndex,
          title: exportTitle,
          createdAt: slot.createdAt || null,
          savedAt: slot.savedAt || null
        },
        worldData: exportWorldData,
        loreData,
        staticPages,
        chronicles,
        eraNarratives,
        imageData,
        images
      };
      const bundleJson = JSON.stringify(bundle, null, 2);
      throwIfExportCanceled(shouldCancel);
      if (imageFiles.length === 0) {
        // S3 mode (or no local images) — export a timestamped JSON file directly
        const timestamp = exportedAt.replace(/[:.]/g, "-").replace("T", "_").replace("Z", "");
        const blob = new Blob([bundleJson], {
          type: "application/json"
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const bundleBase = safeBase || `slot-${slotIndex}`;
        link.download = `${bundleBase}.bundle.${timestamp}.json`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        // Local mode — zip bundle.json with embedded image blobs
        const {
          default: JSZip
        } = await import("jszip");
        const zip = new JSZip();
        zip.file("bundle.json", bundleJson);
        for (const file of imageFiles) {
          zip.file(file.path, file.blob);
        }
        const zipBlob = await zip.generateAsync({
          type: "blob"
        });
        throwIfExportCanceled(shouldCancel);
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement("a");
        link.href = url;
        const zipBase = safeBase || `slot-${slotIndex}`;
        link.download = `${zipBase}.canonry-bundle.zip`;
        link.click();
        URL.revokeObjectURL(url);
      }
      closeExportModal();
    } catch (err) {
      if (err?.name === EXPORT_CANCEL_ERROR_NAME) {
        return;
      }
      console.error("Failed to export bundle:", err);
      alert(err.message || "Failed to export bundle");
    } finally {
      exportCancelRef.current = false;
      setExportBundleStatus({
        state: "idle",
        detail: ""
      });
    }
  }, [activeSlotIndex, archivistData?.worldData, awsConfig, closeExportModal, currentProject?.id, currentProject?.name, s3Client, slots]);
  const handleExportSlot = useCallback(slotIndex => {
    const slot = slots[slotIndex];
    if (!slot) {
      alert("Slot is empty.");
      return;
    }
    openExportModal(slotIndex);
  }, [slots, openExportModal]);
  const handleImportSlot = useCallback(async (slotIndex, file) => {
    if (!currentProject?.id || !file) return;
    try {
      const isZip = file.type === "application/zip" || file.name?.toLowerCase().endsWith(".zip");
      let payload;
      if (isZip) {
        const {
          default: JSZip
        } = await import("jszip");
        const zip = await JSZip.loadAsync(file);
        const bundleFile = zip.file("bundle.json");
        if (!bundleFile) {
          throw new Error("Bundle zip is missing bundle.json.");
        }
        const text = await bundleFile.async("string");
        payload = JSON.parse(text);
      } else {
        const text = await file.text();
        payload = JSON.parse(text);
      }
      await importSlotPayload(slotIndex, payload, {
        defaultTitle: "Imported Output"
      });
    } catch (err) {
      console.error("Failed to import slot:", err);
      alert(err.message || "Failed to import slot data");
    }
  }, [currentProject?.id, importSlotPayload]);
  const handleLoadExampleOutput = useCallback(async () => {
    if (!currentProject?.id) return;
    try {
      const baseUrl = import.meta.env.BASE_URL || "/";
      const response = await fetch(`${baseUrl}default-project/worldOutput.json`);
      if (!response.ok) {
        throw new Error("Example output not found.");
      }
      const payload = await response.json();
      await importSlotPayload(0, payload, {
        defaultTitle: "Example Output"
      });
    } catch (err) {
      console.error("Failed to load example output:", err);
      alert(err.message || "Failed to load example output");
    }
  }, [currentProject?.id, importSlotPayload]);

  // Check if scratch has data
  const hasDataInScratch = Boolean(slots[0]?.simulationResults);
  const exportModalSlot = exportModalSlotIndex !== null ? slots[exportModalSlotIndex] : null;
  const exportModalFallbackTitle = exportModalSlotIndex === 0 ? "Scratch" : `Slot ${exportModalSlotIndex}`;
  const exportModalTitle = exportModalSlot ? exportModalSlot.title || exportModalFallbackTitle : "Slot";
  const isExportingBundle = exportBundleStatus.state === "working";
  const hasAwsToken = isTokenValid(awsTokens);
  const awsLoginConfigured = Boolean(awsConfig?.cognitoUserPoolId && awsConfig?.cognitoClientId);
  const awsReady = Boolean(awsConfig?.identityPoolId && awsConfig?.region && (!awsLoginConfigured || hasAwsToken));

  // Extract naming data for Name Forge (keyed by culture ID)
  const namingData = useMemo(() => {
    if (!currentProject) return {};
    const data = {};
    currentProject.cultures.forEach(culture => {
      if (culture.naming) {
        data[culture.id] = culture.naming;
      }
    });
    return data;
  }, [currentProject?.cultures]);

  // Derived data for remotes (read-only schema)
  const schema = useMemo(() => {
    const baseSchema = currentProject ? {
      id: currentProject.id,
      name: currentProject.name,
      version: currentProject.version,
      entityKinds: currentProject.entityKinds || [],
      relationshipKinds: currentProject.relationshipKinds || [],
      cultures: currentProject.cultures || [],
      tagRegistry: currentProject.tagRegistry || [],
      axisDefinitions: currentProject.axisDefinitions || [],
      uiConfig: currentProject.uiConfig
    } : {
      id: "",
      name: "",
      version: "",
      entityKinds: [],
      relationshipKinds: [],
      cultures: [],
      tagRegistry: [],
      axisDefinitions: [],
      uiConfig: undefined
    };
    return mergeFrameworkSchemaSlice(baseSchema);
  }, [currentProject?.id, currentProject?.name, currentProject?.version, currentProject?.entityKinds, currentProject?.relationshipKinds, currentProject?.cultures, currentProject?.tagRegistry, currentProject?.axisDefinitions, currentProject?.uiConfig]);

  // Compute tag usage across all tools
  const tagUsage = useMemo(() => {
    if (!currentProject) return {};
    return computeTagUsage({
      cultures: currentProject.cultures,
      seedEntities: currentProject.seedEntities,
      generators: currentProject.generators,
      systems: currentProject.systems,
      pressures: currentProject.pressures,
      entityKinds: currentProject.entityKinds,
      axisDefinitions: currentProject.axisDefinitions
    });
  }, [currentProject?.cultures, currentProject?.seedEntities, currentProject?.generators, currentProject?.systems, currentProject?.pressures, currentProject?.entityKinds, currentProject?.axisDefinitions]);

  // Compute schema element usage across Coherence Engine
  const schemaUsage = useMemo(() => {
    if (!currentProject) return {};
    return computeSchemaUsage({
      generators: currentProject.generators || [],
      systems: currentProject.systems || [],
      actions: currentProject.actions || [],
      pressures: currentProject.pressures || [],
      seedEntities: currentProject.seedEntities || []
    });
  }, [currentProject?.generators, currentProject?.systems, currentProject?.actions, currentProject?.pressures, currentProject?.seedEntities]);

  // Compute structure validation for ValidationPopover
  const validationResult = useMemo(() => {
    if (!currentProject) return {
      valid: true,
      errors: [],
      warnings: []
    };
    const cultures = schema.cultures?.map(c => c.id) || [];
    const entityKinds = schema.entityKinds?.map(k => k.kind) || [];
    const relationshipKinds = schema.relationshipKinds?.map(k => k.kind) || [];
    return validateAllConfigs({
      templates: currentProject.generators || [],
      pressures: currentProject.pressures || [],
      systems: currentProject.systems || [],
      eras: currentProject.eras || [],
      actions: currentProject.actions || [],
      seedEntities: currentProject.seedEntities || [],
      schema: {
        cultures,
        entityKinds,
        relationshipKinds
      }
    });
  }, [currentProject?.generators, currentProject?.pressures, currentProject?.systems, currentProject?.eras, currentProject?.actions, currentProject?.seedEntities, schema]);

  // Navigate to validation tab
  const handleNavigateToValidation = useCallback(() => {
    handleTabChange("simulation");
    setActiveSectionForTab("simulation", "validate");
  }, [handleTabChange, setActiveSectionForTab]);

  // Remove property from config at given path (for validation error quick-fix)
  const handleRemoveProperty = useCallback((path, propName) => {
    if (!currentProject || !path || !propName) return;

    // Parse path - formats:
    // 1. Top-level property: "item_id" or "item_id/" (trailing slash from validator)
    // 2. Nested property: "item_id"/nested/path
    const topLevelMatch = path.match(/^"([^"]+)"(?:\/)?$/);
    const nestedMatch = path.match(/^"([^"]+)"\/(.+)$/);
    let itemId;
    let pathSegments = [];
    if (nestedMatch) {
      // Nested property (check first since it's more specific)
      itemId = nestedMatch[1];
      pathSegments = nestedMatch[2].split("/");
    } else if (topLevelMatch) {
      // Top-level property like "metadata" on the item itself
      itemId = topLevelMatch[1];
    } else {
      return;
    }

    // Try to find item in each config array
    const configArrays = [{
      key: "generators",
      data: currentProject.generators,
      update: updateGenerators
    }, {
      key: "systems",
      data: currentProject.systems,
      update: updateSystems
    }, {
      key: "pressures",
      data: currentProject.pressures,
      update: updatePressures
    }, {
      key: "eras",
      data: currentProject.eras,
      update: updateEras
    }, {
      key: "actions",
      data: currentProject.actions,
      update: updateActions
    }];
    for (const {
      data,
      update
    } of configArrays) {
      if (!data) continue;
      const itemIndex = data.findIndex(item => item.id === itemId);
      if (itemIndex === -1) continue;

      // Deep clone the item
      const newData = [...data];
      const item = JSON.parse(JSON.stringify(data[itemIndex]));
      if (pathSegments.length === 0) {
        // Top-level property - delete directly from item
        delete item[propName];
      } else {
        // Navigate to parent of the property to delete
        let obj = item;
        for (let i = 0; i < pathSegments.length; i++) {
          const seg = pathSegments[i];
          if (obj[seg] === undefined) return; // Path doesn't exist
          if (i === pathSegments.length - 1) {
            // At the target object, delete the property
            delete obj[seg][propName];
          } else {
            obj = obj[seg];
          }
        }
      }
      newData[itemIndex] = item;
      update(newData);
      return;
    }
  }, [currentProject, updateGenerators, updateSystems, updatePressures, updateEras, updateActions]);
  const renderContent = () => {
    // Show landing page if explicitly on home or no project selected
    if (showHome || !currentProject) {
      return <LandingPage onNavigate={handleLandingNavigate} hasProject={!!currentProject} />;
    }
    switch (activeTab) {
      case "enumerist":
        return <SchemaEditor project={schema} activeSection={activeSection} onSectionChange={setActiveSection} onUpdateEntityKinds={updateEntityKinds} onUpdateRelationshipKinds={updateRelationshipKinds} onUpdateCultures={updateCultures} onUpdateTagRegistry={updateTagRegistry} tagUsage={tagUsage} schemaUsage={schemaUsage} namingData={namingData} />;
      case "names":
        return <NameForgeHost projectId={currentProject?.id} schema={schema} onNamingDataChange={updateCultureNaming} onAddTag={addTag} activeSection={activeSection} onSectionChange={setActiveSection} generators={currentProject?.generators || EMPTY_ARRAY} />;
      case "cosmography":
        return <CosmographerHost schema={schema} axisDefinitions={currentProject.axisDefinitions || EMPTY_ARRAY} seedEntities={currentProject.seedEntities} seedRelationships={currentProject.seedRelationships} onEntityKindsChange={updateEntityKinds} onCulturesChange={updateCultures} onAxisDefinitionsChange={updateAxisDefinitions} onTagRegistryChange={updateTagRegistry} onSeedEntitiesChange={updateSeedEntities} onSeedRelationshipsChange={updateSeedRelationships} onAddTag={addTag} activeSection={activeSection} onSectionChange={setActiveSection} schemaUsage={schemaUsage} />;
      case "coherence":
        return <CoherenceEngineHost projectId={currentProject?.id} schema={schema} eras={currentProject?.eras || EMPTY_ARRAY} onErasChange={updateEras} pressures={currentProject?.pressures || EMPTY_ARRAY} onPressuresChange={updatePressures} generators={currentProject?.generators || EMPTY_ARRAY} onGeneratorsChange={updateGenerators} actions={currentProject?.actions || EMPTY_ARRAY} onActionsChange={updateActions} systems={currentProject?.systems || EMPTY_ARRAY} onSystemsChange={updateSystems} activeSection={activeSection} onSectionChange={setActiveSection} />;
      case "simulation":
      case "illuminator":
      case "archivist":
      case "chronicler":
        // Keep LoreWeaveHost, IlluminatorHost, ArchivistHost, and ChroniclerHost mounted so state persists
        // when navigating between them
        return <>
            <div className={activeTab === "simulation" ? "canonry-remote-pane canonry-remote-pane-visible" : "canonry-remote-pane canonry-remote-pane-hidden"}>
              <LoreWeaveHost projectId={currentProject?.id} schema={schema} eras={currentProject?.eras || EMPTY_ARRAY} pressures={currentProject?.pressures || EMPTY_ARRAY} generators={currentProject?.generators || EMPTY_ARRAY} systems={currentProject?.systems || EMPTY_ARRAY} actions={currentProject?.actions || EMPTY_ARRAY} seedEntities={currentProject?.seedEntities || EMPTY_ARRAY} seedRelationships={currentProject?.seedRelationships || EMPTY_ARRAY} distributionTargets={currentProject?.distributionTargets || null} onDistributionTargetsChange={updateDistributionTargets} activeSection={activeSection} onSectionChange={setActiveSection} simulationResults={simulationResults} onSimulationResultsChange={setSimulationResults} simulationState={simulationState} onSimulationStateChange={setSimulationState} onSearchRunScored={handleSearchRunScored} />
            </div>
            <div className={activeTab === "illuminator" ? "canonry-remote-pane canonry-remote-pane-visible" : "canonry-remote-pane canonry-remote-pane-hidden"}>
              <IlluminatorHost projectId={currentProject?.id} schema={schema} worldData={archivistData?.worldData} worldContext={worldContext} onWorldContextChange={setWorldContext} entityGuidance={entityGuidance} onEntityGuidanceChange={setEntityGuidance} cultureIdentities={cultureIdentities} onCultureIdentitiesChange={setCultureIdentities} enrichmentConfig={enrichmentConfig} onEnrichmentConfigChange={setEnrichmentConfig} styleSelection={styleSelection} onStyleSelectionChange={setStyleSelection} historianConfig={historianConfig} onHistorianConfigChange={setHistorianConfig} activeSection={activeSection} onSectionChange={setActiveSection} activeSlotIndex={activeSlotIndex} />
            </div>
            <div className={activeTab === "archivist" ? "canonry-remote-pane canonry-remote-pane-visible" : "canonry-remote-pane canonry-remote-pane-hidden"}>
              <ArchivistHost projectId={currentProject?.id} activeSlotIndex={activeSlotIndex} />
            </div>
            <div className={activeTab === "chronicler" ? "canonry-remote-pane canonry-remote-pane-visible" : "canonry-remote-pane canonry-remote-pane-hidden"}>
              <ChroniclerHost projectId={currentProject?.id} activeSlotIndex={activeSlotIndex} requestedPageId={chroniclerRequestedPage} onRequestedPageConsumed={clearChroniclerRequestedPage} />
            </div>
          </>;
      default:
        return null;
    }
  };
  if (loading) {
    console.log("[Canonry] Project storage still loading");
    return <div className="canonry-app-loading">
        <div className="inline-extracted-3">Loading...</div>
      </div>;
  }
  return <div className="inline-extracted-4">
      <ProjectManager projects={projects} currentProject={currentProject} onCreateProject={createProject} onOpenProject={openProject} onDeleteProject={removeProject} onDuplicateProject={duplicateProject} onExportProject={exportProject} onImportProject={importProject} onReloadFromDefaults={handleReloadFromDefaults} defaultProjectId={DEFAULT_PROJECT_ID} onGoHome={handleGoHome} validationResult={validationResult} onNavigateToValidation={handleNavigateToValidation} onRemoveProperty={handleRemoveProperty} simulationState={simulationState} systems={currentProject?.systems || EMPTY_ARRAY} slots={slots} activeSlotIndex={activeSlotIndex} onLoadSlot={handleLoadSlot} onSaveToSlot={handleSaveToSlot} onClearSlot={handleClearSlot} onUpdateSlotTitle={handleUpdateSlotTitle} onExportSlot={handleExportSlot} onImportSlot={handleImportSlot} onLoadExampleOutput={handleLoadExampleOutput} hasDataInScratch={hasDataInScratch} />
      {currentProject && !showHome && <Navigation activeTab={activeTab} onTabChange={handleTabChange} onAwsClick={openAwsModal} onHelpClick={openHelpModal} />}
      <div className="inline-extracted-1">{renderContent()}</div>
      <footer className="inline-extracted-5">
        <span>Copyright © 2026</span>
        <a href="https://ahara.io" target="_blank" rel="noopener noreferrer">
          <img src="/tsonu-combined.png" alt="tsonu" height="14" />
        </a>
      </footer>
      {error && <ErrorMessage message={error} />}
      {exportModalSlotIndex !== null && <div className="modal-overlay" onMouseDown={handleExportModalMouseDown} onClick={handleExportModalClick} role="button" tabIndex={0} onKeyDown={e => {
      if (e.key === "Enter" || e.key === " ") handleExportModalClick(e);
    }}>
          <div className="modal modal-simple">
            <div className="modal-header" role="button" tabIndex={0} onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
        }}>
              <div className="modal-title">Export {exportModalTitle}</div>
              {!isExportingBundle && <button className="btn-close" onClick={closeExportModal}>
                  ×
                </button>}
            </div>
            <div className="modal-body">
              {isExportingBundle ? <div className="modal-status">
                  <div className="modal-spinner" aria-hidden="true" />
                  <div>
                    <div className="modal-status-title">Building viewer bundle</div>
                    <div className="modal-status-subtitle">
                      {exportBundleStatus.detail || "This can take a few minutes for large image sets."}
                    </div>
                  </div>
                </div> : <>
                  <div className="inline-extracted-7">
                    Choose the export format for this run slot.
                  </div>
                  <div className="inline-extracted-8">
                    Viewer bundles include chronicles, static pages, and referenced images.
                  </div>
                  {awsConfig?.useS3Images && <div className="inline-extracted-9">
                      S3 image sync enabled: bundle will reference remote images and skip embedding
                      them.
                    </div>}
                </>}
            </div>
            <div className="modal-actions">
              {isExportingBundle ? <button className="btn-sm" onClick={handleCancelExportBundle}>
                  Cancel Export
                </button> : <>
                  <button className="btn-sm" onClick={closeExportModal}>
                    Cancel
                  </button>
                  <button className="btn-sm" onClick={() => {
              handleExportSlotDownload(exportModalSlotIndex);
              closeExportModal();
            }}>
                    Standard Export
                  </button>
                  <button className="btn-sm btn-sm-primary" onClick={() => {
              handleExportBundle(exportModalSlotIndex);
            }}>
                    Viewer Bundle
                  </button>
                </>}
            </div>
          </div>
        </div>}
      {awsModalOpen && <div className="modal-overlay" onMouseDown={handleAwsModalMouseDown} onClick={handleAwsModalClick} role="button" tabIndex={0} onKeyDown={e => {
      if (e.key === "Enter" || e.key === " ") handleAwsModalClick(e);
    }}>
          <div className="modal modal-simple inline-extracted-2">
            <div className="modal-header" role="button" tabIndex={0} onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
        }}>
              <div className="modal-title">AWS Sync</div>
              <button className="btn-close" onClick={() => closeAwsModal()}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="inline-extracted-10">
                <div className="inline-extracted-11">Session</div>
                <div className="inline-extracted-12">
                  {(() => {
                if (awsLoginConfigured) {
                  return hasAwsToken ? `Signed in as ${awsUserLabel || "Cognito user"}.` : "Not authenticated. Login required.";
                }
                return "No user pool configured. Identity pool must allow unauthenticated access.";
              })()}
                </div>
              </div>

              {awsStatus.detail && <div className="modal-status inline-extracted-13">
                  <div className="modal-status-title">AWS Status</div>
                  <div className="modal-status-subtitle">{awsStatus.detail}</div>
                </div>}
              {awsSyncProgress.total > 0 && <div className="inline-extracted-14">
                  <div className="inline-extracted-15">
                    Sync progress: {awsSyncProgress.processed}/{awsSyncProgress.total} processed
                    {awsSyncProgress.uploaded ? `, ${awsSyncProgress.uploaded} uploaded` : ""}
                  </div>
                  <div className="inline-extracted-16">
                    <progress className="canonry-aws-sync-progress" max={Math.max(awsSyncProgress.total, 1)} value={Math.min(awsSyncProgress.processed, Math.max(awsSyncProgress.total, 1))} />
                  </div>
                </div>}

              <div className="inline-extracted-17">
                <div className="modal-title inline-extracted-18">
                  Cognito Auth
                </div>
                <div className="inline-extracted-19">
                  <div className="inline-extracted-20">
                    <label htmlFor="region" className="inline-extracted-21">Region</label>
                    <input id="region" value={awsConfig.region} onChange={e => updateAwsConfig({
                  region: e.target.value
                })} placeholder="us-east-1" className="inline-extracted-22" />
                  </div>
                  <div className="inline-extracted-23">
                    <label htmlFor="identity-pool-id" className="inline-extracted-24">Identity Pool ID</label>
                    <input id="identity-pool-id" value={awsConfig.identityPoolId} onChange={e => updateAwsConfig({
                  identityPoolId: e.target.value
                })} placeholder="us-east-1:xxxx-xxxx" className="inline-extracted-25" />
                  </div>
                  <div className="inline-extracted-26">
                    <label htmlFor="user-pool-id" className="inline-extracted-27">User Pool ID</label>
                    <input id="user-pool-id" value={awsConfig.cognitoUserPoolId} onChange={e => updateAwsConfig({
                  cognitoUserPoolId: e.target.value
                })} placeholder="us-east-1_XXXXXX" className="inline-extracted-28" />
                  </div>
                  <div className="inline-extracted-29">
                    <label htmlFor="app-client-id" className="inline-extracted-30">App Client ID</label>
                    <input id="app-client-id" value={awsConfig.cognitoClientId} onChange={e => updateAwsConfig({
                  cognitoClientId: e.target.value
                })} placeholder="Cognito client id" className="inline-extracted-31" />
                  </div>
                </div>
                <div className="inline-extracted-32">
                  {hasAwsToken ? <div className="inline-extracted-33">
                      <div className="inline-extracted-34">
                        {awsUserLabel ? `User: ${awsUserLabel}` : "User authenticated."}
                      </div>
                      <button className="btn-sm" onClick={handleAwsLogout}>
                        Sign Out
                      </button>
                    </div> : <div className="inline-extracted-35">
                      <div className="inline-extracted-36">
                        <label htmlFor="username" className="inline-extracted-37">Username</label>
                        <input id="username" value={awsUsername} onChange={e => setAwsUsername(e.target.value)} placeholder="username" className="inline-extracted-38" />
                      </div>
                      <div className="inline-extracted-39">
                        <label htmlFor="password" className="inline-extracted-40">Password</label>
                        <input id="password" type="password" value={awsPassword} onChange={e => setAwsPassword(e.target.value)} placeholder="password" className="inline-extracted-41" />
                      </div>
                      <div className="inline-extracted-42">
                        <button className="btn-sm btn-sm-primary" onClick={handleAwsLogin}>
                          Sign In
                        </button>
                      </div>
                    </div>}
                </div>
              </div>

              <div className="inline-extracted-43">
                <div className="modal-title inline-extracted-44">
                  S3 Image Storage
                </div>
                <div className="inline-extracted-45">
                  <div className="inline-extracted-46">
                    <label htmlFor="image-bucket" className="inline-extracted-47">Bucket</label>
                    <input id="image-bucket" value={awsConfig.imageBucket} onChange={e => updateAwsConfig({
                  imageBucket: e.target.value
                })} placeholder="bucket-name" className="inline-extracted-48" />
                  </div>
                  <div className="inline-extracted-49">
                    <label htmlFor="image-prefix" className="inline-extracted-50">Base Prefix</label>
                    <input id="image-prefix" value={awsConfig.imagePrefix} onChange={e => updateAwsConfig({
                  imagePrefix: e.target.value
                })} placeholder="canonry" className="inline-extracted-51" />
                  </div>
                </div>
                <div className="inline-extracted-52">
                  <button className="btn-sm" onClick={handleAwsBrowsePrefixes}>
                    Browse Prefix
                  </button>
                  <button className="btn-sm" onClick={handleAwsTestSetup}>
                    Test Setup
                  </button>
                  <button className="btn-sm" disabled={!awsReady || awsUploadPlan.loading} onClick={handleAwsPreviewUploads}>
                    Preview Uploads
                  </button>
                  <button className="btn-sm" disabled={!awsReady || awsStatus.state === "working"} onClick={handlePullImages}>
                    Pull Images from S3
                  </button>
                  <button className="btn-sm btn-sm-primary" disabled={!awsReady || awsStatus.state === "working"} onClick={handleAwsSyncImages}>
                    Push Images to S3
                  </button>
                </div>
                {awsBrowseState.loading && <div className="inline-extracted-53">
                    Loading prefixes...
                  </div>}
                {awsBrowseState.error && <div className="inline-extracted-54">
                    {awsBrowseState.error}
                  </div>}
                {awsBrowseState.prefixes.length > 0 && <div className="inline-extracted-55">
                    {awsBrowseState.prefixes.map(prefix => <button key={prefix} className="btn-sm inline-extracted-56" onClick={() => updateAwsConfig({
                imagePrefix: prefix.replace(/\/$/, "")
              })}>
                        {prefix}
                      </button>)}
                  </div>}
              </div>

              <div className="inline-extracted-57">
                <label className="inline-extracted-58">
                  <input type="checkbox" checked={Boolean(awsConfig.useS3Images)} onChange={e => updateAwsConfig({
                useS3Images: e.target.checked
              })} />
                  <span>Use S3 images for viewer exports</span>
                </label>
              </div>

              <div className="inline-extracted-59">
                <div className="modal-title inline-extracted-60">
                  Data Snapshot
                </div>
                <div className="inline-extracted-61">
                  Export/import all IndexedDB data (projects, runs, entities, chronicles, costs,
                  styles, etc.) to S3. Images excluded — sync those separately.
                </div>
                <div className="inline-extracted-62">
                  <button className="btn-sm" disabled={!awsReady || snapshotStatus.state === "working"} onClick={handleExportSnapshot}>
                    Export to S3
                  </button>
                  <button className="btn-sm" disabled={!awsReady || snapshotStatus.state === "working"} onClick={handleImportSnapshot}>
                    Import from S3
                  </button>
                </div>
                {snapshotStatus.detail && <div className={snapshotStatus.state === "error" ? "canonry-snapshot-detail canonry-snapshot-detail-error" : "canonry-snapshot-detail canonry-snapshot-detail-default"}>
                    {snapshotStatus.detail}
                  </div>}
              </div>

              <div className="inline-extracted-63">
                <div className="modal-title inline-extracted-64">
                  Upload Plan
                </div>
                <div className="inline-extracted-65">
                  {(() => {
                if (awsUploadPlan.loading) return "Calculating upload plan...";
                if (awsUploadPlan.summary) return `Would upload ${awsUploadPlan.summary.uploadCount} of ${awsUploadPlan.summary.total} images.`;
                return 'Click "Preview Uploads" to see which images would be uploaded.';
              })()}
                </div>
                {awsUploadPlan.summary && <div className="inline-extracted-66">
                    Manifest: {awsUploadPlan.summary.manifestFound ? "found" : "missing"} · Prefix:{" "}
                    {awsUploadPlan.summary.basePrefix || "(root)"}
                  </div>}
                {awsUploadPlan.summary?.repairs && <div className="inline-extracted-67">
                    Repairs: {awsUploadPlan.summary.repairs.updated} updated,{" "}
                    {awsUploadPlan.summary.repairs.skipped} skipped,{" "}
                    {awsUploadPlan.summary.repairs.failed} failed.
                  </div>}
                {awsUploadPlan.summary?.manifestRepairs && <div className="inline-extracted-68">
                    Manifest repairs: {awsUploadPlan.summary.manifestRepairs.updated} updated,{" "}
                    {awsUploadPlan.summary.manifestRepairs.skipped} skipped,{" "}
                    {awsUploadPlan.summary.manifestRepairs.failed} failed.
                  </div>}
                {awsUploadPlan.error && <div className="inline-extracted-69">
                    {awsUploadPlan.error}
                  </div>}
                {awsUploadPlan.json && <textarea readOnly value={awsUploadPlan.json} className="inline-extracted-70" />}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-sm" onClick={() => closeAwsModal()}>
                Close
              </button>
            </div>
          </div>
        </div>}
      <HelpModal isOpen={helpModalOpen} onClose={closeHelpModal} activeTab={activeTab} />
    </div>;
}
