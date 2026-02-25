/**
 * useBackportFlow - Hook for chronicle lore backport workflows
 *
 * Extracted from IlluminatorRemote. Contains:
 * - assembleContextForChronicle: build full context for a chronicle backport
 * - backportConfig: modal state for backport entity selection
 * - handleBackportLore: single-chronicle backport entry point
 * - handleBackportConfigStart: start backport with selected entities
 * - handleAcceptBackport: accept and apply backport patches
 * - handleMarkEntityNotNeeded: mark entities as not needing backport
 * - Bulk backport state and handlers (delegates to useBulkBackport)
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useChronicleLoreBackport } from "./useChronicleLoreBackport";
import { useBulkBackport } from "./useBulkBackport";
import * as entityRepo from "../lib/db/entityRepository";
import { useEntityStore } from "../lib/db/entityStore";
import {
  getChronicle,
  getChroniclesForSimulation,
  updateChronicleEntityBackportStatus,
} from "../lib/db/chronicleRepository";
import { computeBackportProgress } from "../lib/chronicleTypes";

// --- Module-level helpers ---

async function buildCastContexts(chronicle, getEntityContextsForRevision) {
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

  return castContexts;
}

async function appendTertiaryContexts(allContexts, chronicle, getEntityContextsForRevision) {
  const acceptedTertiary = (chronicle.tertiaryCast || []).filter((e) => e.accepted);
  if (acceptedTertiary.length === 0) return;

  const existingIds = new Set(allContexts.map((c) => c.id));
  const tertiaryFiltered = acceptedTertiary.filter((e) => !existingIds.has(e.entityId));
  const tertiaryIds = tertiaryFiltered.map((e) => e.entityId);
  if (tertiaryIds.length === 0) return;

  const tertiaryContexts = await getEntityContextsForRevision(tertiaryIds);
  const tertiaryByEntityId = new Map(tertiaryFiltered.map((t) => [t.entityId, t]));
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

function buildPerspectiveSynthesisJson(chronicle) {
  const ps = chronicle.perspectiveSynthesis;
  if (!ps) return "";
  return JSON.stringify({
    brief: ps.brief || "",
    facets: ps.facets || [],
    narrativeVoice: ps.narrativeVoice || {},
    entityDirectives: ps.entityDirectives || [],
    suggestedMotifs: ps.suggestedMotifs || [],
    chronicleFormat: chronicle.format || "",
    ...(chronicle.narrativeDirection ? { narrativeDirection: chronicle.narrativeDirection } : {}),
  });
}

async function resolvePerEntityBackportStatus(allContexts, chronicleBackportMap, chronicleId) {
  const perEntityStatus = {};
  const unresolvedIds = allContexts
    .filter((ctx) => !chronicleBackportMap[ctx.id])
    .map((ctx) => ctx.id);
  const loadedEntities =
    unresolvedIds.length > 0 ? await useEntityStore.getState().loadEntities(unresolvedIds) : [];
  const loadedMap = new Map(loadedEntities.map((e) => [e.id, e]));

  for (const ctx of allContexts) {
    if (chronicleBackportMap[ctx.id]) {
      perEntityStatus[ctx.id] = chronicleBackportMap[ctx.id].status;
      continue;
    }
    const entity = loadedMap.get(ctx.id);
    const hasBackref = (entity?.enrichment?.chronicleBackrefs || []).some(
      (br) => br.chronicleId === chronicleId
    );
    if (hasBackref) {
      perEntityStatus[ctx.id] = "backported";
    }
  }
  return perEntityStatus;
}

async function assembleChronicleContext(projectId, simulationRunId, chronicleId, getEntityContextsForRevision) {
  if (!projectId || !simulationRunId || !chronicleId) return null;
  const chronicle = await getChronicle(chronicleId);
  if (!chronicle?.finalContent) return null;
  const castContexts = await buildCastContexts(chronicle, getEntityContextsForRevision);
  if (!castContexts) return null;
  const allContexts = [...castContexts];
  await appendTertiaryContexts(allContexts, chronicle, getEntityContextsForRevision);
  const perspectiveSynthesisJson = buildPerspectiveSynthesisJson(chronicle);
  const chronicleBackportMap = chronicle.entityBackportStatus || {};
  const perEntityStatus = await resolvePerEntityBackportStatus(allContexts, chronicleBackportMap, chronicleId);
  return {
    chronicleId, chronicleTitle: chronicle.title || "Untitled Chronicle",
    entities: allContexts, chronicleText: chronicle.finalContent,
    perspectiveSynthesisJson, perEntityStatus,
  };
}

async function applyBackportPatches(patches, chronicleId, reloadEntities) {
  const updatedIds = await entityRepo.applyRevisionPatches(patches, "lore-backport");
  if (chronicleId) {
    await entityRepo.revalidateBackrefs(patches, { chronicleId });
  }
  await reloadEntities(updatedIds);
}

async function markEntitiesBackported(chronicleId, entityIds, setChronicleRefreshTrigger) {
  const now = Date.now();
  const entries = entityIds.map((id) => ({ entityId: id, status: "backported", updatedAt: now }));
  try {
    await updateChronicleEntityBackportStatus(chronicleId, entries);
    setChronicleRefreshTrigger((n) => n + 1);
  } catch (err) {
    console.warn("[Backport] Failed to set entity backport status:", err);
  }
}

async function getEligibleChronicleIds(simRunId) {
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
        chronicleTitle: c.title || "Untitled Chronicle",
        pendingCount: progress.total - progress.done,
      };
    });
}

// --- Extracted handler bodies (module-level) ---

function runBackportConfigStart(backportConfig, projectId, simulationRunId, selectedEntityIds, customInstructions, backportSentEntityIdsRef, startBackport, setBackportConfig) {
  if (!backportConfig || !projectId || !simulationRunId) return;
  const selectedEntities = backportConfig.entities.filter((e) => selectedEntityIds.includes(e.id));
  if (selectedEntities.length === 0) return;
  backportSentEntityIdsRef.current = selectedEntityIds;
  startBackport({
    projectId, simulationRunId, chronicleId: backportConfig.chronicleId,
    chronicleText: backportConfig.chronicleText,
    perspectiveSynthesisJson: backportConfig.perspectiveSynthesisJson,
    entities: selectedEntities, customInstructions: customInstructions || undefined,
  });
  setBackportConfig(null);
}

async function runAcceptBackport(backportChronicleId, applyAcceptedBackportPatches, reloadEntities, backportSentEntityIdsRef, setChronicleRefreshTrigger) {
  const cId = backportChronicleId;
  const patches = applyAcceptedBackportPatches();
  if (!patches?.length) return;
  await applyBackportPatches(patches, cId, reloadEntities);
  if (cId) {
    const sentIds = backportSentEntityIdsRef.current || patches.map((p) => p.entityId);
    await markEntitiesBackported(cId, sentIds, setChronicleRefreshTrigger);
    backportSentEntityIdsRef.current = null;
  }
}

async function runMarkEntityNotNeeded(backportConfig, entityIds, setBackportConfig, setChronicleRefreshTrigger) {
  if (!backportConfig?.chronicleId) return;
  const now = Date.now();
  const entries = entityIds.map((id) => ({ entityId: id, status: "not_needed", updatedAt: now }));
  await updateChronicleEntityBackportStatus(backportConfig.chronicleId, entries);
  setBackportConfig((prev) => {
    if (!prev) return null;
    const updated = { ...prev.perEntityStatus };
    for (const id of entityIds) updated[id] = "not_needed";
    return { ...prev, perEntityStatus: updated };
  });
  setChronicleRefreshTrigger((n) => n + 1);
}

// --- Bulk backport helper hook ---

function useBulkBackportSetup({ assembleContextForChronicle, reloadEntities, setChronicleRefreshTrigger, simulationRunId, projectId }) {
  const applyBulkPatches = useCallback(async (patches, chronicleId, sentEntityIds) => {
    if (patches.length > 0) {
      await applyBackportPatches(patches, chronicleId, reloadEntities);
    }
    await markEntitiesBackported(chronicleId, sentEntityIds, setChronicleRefreshTrigger);
  }, [reloadEntities, setChronicleRefreshTrigger]);

  const bulkBackportDeps = useMemo(() => ({
    assembleContextForChronicle, applyPatches: applyBulkPatches, getEligibleChronicleIds,
  }), [assembleContextForChronicle, applyBulkPatches]);

  const {
    progress: bulkBackportProgress, isActive: isBulkBackportActive,
    prepareBulkBackport, confirmBulkBackport, cancelBulkBackport,
  } = useBulkBackport(bulkBackportDeps);

  const [showBulkBackportModal, setShowBulkBackportModal] = useState(false);

  const handleStartBulkBackport = useCallback(async () => {
    if (!simulationRunId || !projectId) return;
    setShowBulkBackportModal(true);
    await prepareBulkBackport(simulationRunId, projectId);
  }, [simulationRunId, projectId, prepareBulkBackport]);

  const handleConfirmBulkBackport = confirmBulkBackport;

  const handleCancelBulkBackport = useCallback(() => { cancelBulkBackport(); setShowBulkBackportModal(false); }, [cancelBulkBackport]);

  const handleCloseBulkBackport = useCallback(() => { setShowBulkBackportModal(false); }, []);

  useEffect(() => {
    if (showBulkBackportModal && bulkBackportProgress.status === "idle") {
      const timer = setTimeout(() => {
        if (bulkBackportProgress.status === "idle") {
          setShowBulkBackportModal(false);
          alert("No chronicles eligible for backport (all already backported or unpublished).");
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showBulkBackportModal, bulkBackportProgress.status]);

  return {
    bulkBackportProgress, isBulkBackportActive, showBulkBackportModal,
    handleStartBulkBackport, handleConfirmBulkBackport, handleCancelBulkBackport, handleCloseBulkBackport,
  };
}

// --- Main hook ---

export function useBackportFlow({
  projectId, simulationRunId,
  getEntityContextsForRevision, reloadEntities,
  setChronicleRefreshTrigger,
}) {
  const {
    run: backportRun, isActive: isBackportActive,
    chronicleId: backportChronicleId, startBackport,
    togglePatchDecision: toggleBackportPatchDecision,
    updateAnchorPhrase: updateBackportAnchorPhrase,
    applyAccepted: applyAcceptedBackportPatches, cancelBackport,
  } = useChronicleLoreBackport(getEntityContextsForRevision);

  const assembleContextForChronicle = useCallback(
    (chronicleId) => assembleChronicleContext(projectId, simulationRunId, chronicleId, getEntityContextsForRevision),
    [projectId, simulationRunId, getEntityContextsForRevision]
  );

  const [backportConfig, setBackportConfig] = useState(null);
  const backportSentEntityIdsRef = useRef(null);

  const handleBackportLore = useCallback(async (chronicleId) => {
    const context = await assembleContextForChronicle(chronicleId);
    if (!context) { console.warn("[Backport] Could not assemble context for chronicle:", chronicleId); return; }
    setBackportConfig(context);
  }, [assembleContextForChronicle]);

  const handleBackportConfigStart = useCallback((selectedEntityIds, customInstructions) => {
    runBackportConfigStart(backportConfig, projectId, simulationRunId, selectedEntityIds, customInstructions, backportSentEntityIdsRef, startBackport, setBackportConfig);
  }, [backportConfig, projectId, simulationRunId, startBackport]);

  const handleAcceptBackport = useCallback(async () => {
    await runAcceptBackport(backportChronicleId, applyAcceptedBackportPatches, reloadEntities, backportSentEntityIdsRef, setChronicleRefreshTrigger);
  }, [applyAcceptedBackportPatches, backportChronicleId, reloadEntities, setChronicleRefreshTrigger]);

  const handleMarkEntityNotNeeded = useCallback(async (entityIds) => {
    await runMarkEntityNotNeeded(backportConfig, entityIds, setBackportConfig, setChronicleRefreshTrigger);
  }, [backportConfig, setChronicleRefreshTrigger]);

  const {
    bulkBackportProgress, isBulkBackportActive, showBulkBackportModal,
    handleStartBulkBackport, handleConfirmBulkBackport, handleCancelBulkBackport, handleCloseBulkBackport,
  } = useBulkBackportSetup({ assembleContextForChronicle, reloadEntities, setChronicleRefreshTrigger, simulationRunId, projectId });

  return {
    backportRun, isBackportActive, backportChronicleId,
    toggleBackportPatchDecision, updateBackportAnchorPhrase, cancelBackport,
    backportConfig, setBackportConfig, handleBackportLore,
    handleBackportConfigStart, handleAcceptBackport, handleMarkEntityNotNeeded,
    bulkBackportProgress, isBulkBackportActive, showBulkBackportModal,
    handleStartBulkBackport, handleConfirmBulkBackport, handleCancelBulkBackport, handleCloseBulkBackport,
    assembleContextForChronicle,
  };
}
