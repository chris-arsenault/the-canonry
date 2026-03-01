/**
 * useHistorianCallbacks - Historian annotation, edition, and bulk workflows.
 * Calls useHistorianEdition, useHistorianReview, and useBulkHistorian internally.
 */

import type { MutableRefObject } from "react";
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useHistorianEdition } from "./useHistorianEdition";
import type { UseHistorianEditionReturn } from "./useHistorianEdition";
import { useHistorianReview } from "./useHistorianReview";
import type { HistorianReviewConfig, UseHistorianReviewReturn } from "./useHistorianReview";
import { useBulkHistorian } from "./useBulkHistorian";
import type { BulkHistorianProgress } from "./useBulkHistorian";
import { registerHistorianStarters } from "./useHistorianActions";
import { getCallConfig as getLLMCallConfig } from "../lib/llmModelSettings";
import type { HistorianConfig, HistorianNote, HistorianRun, HistorianTone, HistorianTargetType } from "../lib/historianTypes";
import type { SummaryRevisionRun, SummaryRevisionPatch } from "../lib/summaryRevisionTypes";
import type { ChronicleRecord } from "../lib/chronicleTypes";
import type { EntityNavItem } from "../lib/db/entityNav";
import * as entityRepo from "../lib/db/entityRepository";
import { useEntityStore } from "../lib/db/entityStore";
import { useChronicleStore } from "../lib/db/chronicleStore";
import { useIlluminatorConfigStore } from "../lib/db/illuminatorConfigStore";
import {
  getChronicle,
  updateChronicleHistorianNotes,
  computeCorpusFactStrength,
} from "../lib/db/chronicleRepository";
import { extractReinforcedFactIds } from "../lib/db/historianRunHelpers";
import { isHistorianConfigured } from "../lib/historianTypes";
import {
  buildHistorianEditionContext,
  buildHistorianReviewContext,
  collectPreviousNotes,
  buildFactCoverageGuidance,
} from "../lib/historianContextBuilders";
import { updateHistorianRun as updateHistorianRunRecord } from "../lib/db/historianRepository";

// ============================================================================
// Types
// ============================================================================

/** World context shape passed to historian callbacks */
interface HistorianWorldContext {
  canonFactsWithMetadata?: Array<{ id?: string; text: string; type?: string; disabled?: boolean; [key: string]: unknown }>;
  worldDynamics?: Array<{ text: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

type ReloadEntities = (entityIds: string[]) => Promise<void>;

/** Cast summary for chronicle context JSON */
interface CastSummary {
  name: string;
  kind: string;
  summary: string;
}

/** Cast entry for chronicle context JSON */
interface CastEntry {
  entityName: string;
  role: string;
  kind: string;
}

/** Cache ref for corpus fact strength */
interface CorpusStrengthCache {
  runId: string | null;
  strength: Map<string, number> | null;
}

export interface UseHistorianCallbacksProps {
  projectId: string | null;
  simulationRunId: string | null;
  worldContext: HistorianWorldContext;
  historianConfig: HistorianConfig;
  reloadEntities: ReloadEntities;
  entityNavMap: Map<string, EntityNavItem>;
}

export interface UseHistorianCallbacksReturn {
  historianEditionRun: SummaryRevisionRun | null;
  isHistorianEditionActive: boolean;
  startHistorianEdition: UseHistorianEditionReturn["startHistorianEdition"];
  toggleHistorianEditionPatchDecision: UseHistorianEditionReturn["togglePatchDecision"];
  handleAcceptHistorianEdition: () => Promise<void>;
  cancelHistorianEdition: UseHistorianEditionReturn["cancelHistorianEdition"];
  historianRun: HistorianRun | null;
  isHistorianActive: boolean;
  startHistorianReview: UseHistorianReviewReturn["startReview"];
  toggleHistorianNoteDecision: UseHistorianReviewReturn["toggleNoteDecision"];
  cancelHistorianReview: UseHistorianReviewReturn["cancelReview"];
  handleAcceptHistorianNotes: () => Promise<void>;
  handleUpdateHistorianNote: (targetType: HistorianTargetType, targetId: string, noteId: string, updates: Partial<HistorianNote>) => Promise<void>;
  handleEditHistorianNoteText: (noteId: string, newText: string) => void;
  handleChronicleHistorianReview: (chronicleId: string, tone?: HistorianTone) => Promise<void>;
  bulkHistorianProgress: BulkHistorianProgress;
  isBulkHistorianActive: boolean;
  showBulkHistorianModal: boolean;
  editionMaxTokens: number;
  setBulkHistorianTone: (tone: HistorianTone) => void;
  handleStartBulkHistorianReview: (eligibleEntityIds: string[]) => void;
  handleStartBulkHistorianEdition: (eligibleEntityIds: string[], reEdition?: boolean) => void;
  handleStartBulkHistorianClear: (eligibleEntityIds: string[]) => void;
  handleConfirmBulkHistorian: () => void;
  handleCancelBulkHistorian: () => void;
  handleCloseBulkHistorian: () => void;
}

// --- Module-level helpers ---

function buildCastData(
  chronicle: ChronicleRecord,
  castMap: Map<string, { id: string; name: string; kind: string; summary?: string; description?: string; [key: string]: unknown }>
): { castSummaries: CastSummary[]; cast: CastEntry[] } {
  const castSummaries: CastSummary[] = (chronicle.roleAssignments || [])
    .slice(0, 10)
    .map((ra) => {
      const entity = castMap.get(ra.entityId);
      if (!entity) return null;
      return {
        name: entity.name,
        kind: entity.kind,
        summary: entity.summary || entity.description?.slice(0, 200) || "",
      };
    })
    .filter((item): item is CastSummary => item !== null);

  const cast: CastEntry[] = (chronicle.roleAssignments || []).map((ra) => {
    const entity = castMap.get(ra.entityId);
    return {
      entityName: entity?.name || ra.entityId,
      role: ra.role,
      kind: entity?.kind || "unknown",
    };
  });

  return { castSummaries, cast };
}

async function resolveFactCoverageGuidance(
  chronicle: ChronicleRecord,
  worldContext: HistorianWorldContext,
  simulationRunId: string,
  corpusStrengthCacheRef: MutableRefObject<CorpusStrengthCache>
): Promise<unknown> {
  if (!chronicle.factCoverageReport?.entries?.length) return undefined;

  if (corpusStrengthCacheRef.current.runId !== simulationRunId) {
    corpusStrengthCacheRef.current = {
      runId: simulationRunId,
      strength: await computeCorpusFactStrength(simulationRunId),
    };
  }

  const constraintFactIds = new Set(
    (worldContext.canonFactsWithMetadata || [])
      .filter((f) => f.type === "generation_constraint" || f.disabled)
      .map((f) => f.id)
  );

  return buildFactCoverageGuidance(
    chronicle.factCoverageReport,
    corpusStrengthCacheRef.current.strength,
    constraintFactIds
  );
}

function buildChronicleContextJson(
  chronicle: ChronicleRecord,
  castSummaries: CastSummary[],
  cast: CastEntry[],
  worldContext: HistorianWorldContext,
  factCoverageGuidance: unknown
): string {
  return JSON.stringify({
    chronicleId: chronicle.chronicleId,
    title: chronicle.title || "Untitled",
    format: chronicle.format,
    narrativeStyleId: chronicle.narrativeStyleId || "",
    cast,
    castSummaries,
    canonFacts: (worldContext.canonFactsWithMetadata || []).map((f) => f.text),
    worldDynamics: (worldContext.worldDynamics || []).map((d) => d.text),
    factCoverageGuidance,
    temporalNarrative: chronicle.perspectiveSynthesis?.temporalNarrative || undefined,
    focalEra: chronicle.temporalContext?.focalEra
      ? {
          name: chronicle.temporalContext.focalEra.name,
          description: chronicle.temporalContext.focalEra.description,
        }
      : undefined,
    temporalCheckReport: chronicle.temporalCheckReport || undefined,
  });
}

async function acceptEntityNotes(targetId: string, notes: HistorianNote[], reloadEntities: ReloadEntities): Promise<void> {
  await entityRepo.setHistorianNotes(targetId, notes);
  await reloadEntities([targetId]);
}

async function acceptChronicleNotes(targetId: string, notes: HistorianNote[], historianRun: HistorianRun): Promise<void> {
  try {
    const prompts =
      historianRun.systemPrompt && historianRun.userPrompt
        ? { systemPrompt: historianRun.systemPrompt, userPrompt: historianRun.userPrompt }
        : undefined;
    const reinforcedFacts = historianRun.contextJson
      ? extractReinforcedFactIds(historianRun.contextJson)
      : undefined;
    await updateChronicleHistorianNotes(targetId, notes, prompts, reinforcedFacts);
    await useChronicleStore.getState().refreshChronicle(targetId);
  } catch (err) {
    console.error("[Historian] Failed to save chronicle notes:", err);
  }
}

async function updateEntityNote(targetId: string, noteId: string, updates: Partial<HistorianNote>, reloadEntities: ReloadEntities): Promise<void> {
  const entity = await useEntityStore.getState().loadEntity(targetId);
  if (!entity?.enrichment?.historianNotes) return;
  const updatedNotes = entity.enrichment.historianNotes.map((n) =>
    n.noteId === noteId ? { ...n, ...updates } : n
  );
  await entityRepo.setHistorianNotes(targetId, updatedNotes);
  await reloadEntities([targetId]);
}

async function updateChronicleNote(targetId: string, noteId: string, updates: Partial<HistorianNote>): Promise<void> {
  try {
    const chronicle = await getChronicle(targetId);
    if (!chronicle?.historianNotes) return;
    const updatedNotes = chronicle.historianNotes.map((n) =>
      n.noteId === noteId ? { ...n, ...updates } : n
    );
    await updateChronicleHistorianNotes(targetId, updatedNotes);
    await useChronicleStore.getState().refreshChronicle(targetId);
  } catch (err) {
    console.error("[Historian] Failed to update note:", err);
  }
}

function validateChronicleForReview(projectId: string | null, simulationRunId: string | null, chronicleId: string, historianConfig: HistorianConfig): boolean {
  if (!projectId || !simulationRunId || !chronicleId) return false;
  return isHistorianConfigured(historianConfig);
}

function getCastEntityIds(chronicle: ChronicleRecord): string[] {
  return (chronicle.roleAssignments || []).map((ra) => ra.entityId).filter(Boolean);
}

function buildChronicleReviewPayload(
  chronicle: ChronicleRecord,
  chronicleId: string,
  tone: HistorianTone | undefined,
  projectId: string | null,
  simulationRunId: string | null,
  contextJson: string,
  previousNotesJson: string,
  historianConfig: HistorianConfig
): HistorianReviewConfig {
  return {
    projectId: projectId,
    simulationRunId: simulationRunId,
    targetType: "chronicle" as const,
    targetId: chronicleId,
    targetName: chronicle.title || "Untitled Chronicle",
    sourceText: chronicle.finalContent,
    contextJson,
    previousNotesJson,
    historianConfig,
    tone: tone || chronicle.assignedTone || "weary",
  };
}

async function runChronicleHistorianReview({
  projectId,
  simulationRunId,
  chronicleId,
  tone,
  worldContext,
  historianConfig,
  corpusStrengthCacheRef,
  startHistorianReview,
}: {
  projectId: string | null;
  simulationRunId: string | null;
  chronicleId: string;
  tone?: HistorianTone;
  worldContext: HistorianWorldContext;
  historianConfig: HistorianConfig;
  corpusStrengthCacheRef: MutableRefObject<CorpusStrengthCache>;
  startHistorianReview: (config: HistorianReviewConfig) => Promise<void>;
}): Promise<void> {
  if (!validateChronicleForReview(projectId, simulationRunId, chronicleId, historianConfig)) return;
  const chronicle = await getChronicle(chronicleId);
  if (!chronicle?.finalContent || chronicle.status !== "complete") return;

  const castEntityIds = getCastEntityIds(chronicle);
  const castFull = await useEntityStore.getState().loadEntities(castEntityIds);
  const castMap = new Map(castFull.map((e) => [e.id, e]));
  const { castSummaries, cast } = buildCastData(chronicle, castMap);
  const factCoverageGuidance = await resolveFactCoverageGuidance(
    chronicle,
    worldContext,
    simulationRunId,
    corpusStrengthCacheRef
  );
  const contextJson = buildChronicleContextJson(
    chronicle,
    castSummaries,
    cast,
    worldContext,
    factCoverageGuidance
  );
  const previousNotes = await collectPreviousNotes({ relatedEntityIds: castEntityIds });

  void startHistorianReview(
    buildChronicleReviewPayload(
      chronicle,
      chronicleId,
      tone,
      projectId,
      simulationRunId,
      contextJson,
      JSON.stringify(previousNotes),
      historianConfig
    )
  );
}

async function runAcceptHistorianEdition(applyAcceptedPatches: () => SummaryRevisionPatch[], reloadEntities: ReloadEntities): Promise<void> {
  const patches = applyAcceptedPatches();
  if (!patches?.length) return;

  const updatedIds = await entityRepo.applyRevisionPatches(patches, "historian-edition");
  for (const patch of patches) {
    if (patch.entityId) {
      await entityRepo.setHistorianNotes(patch.entityId, []);
    }
  }
  await reloadEntities(updatedIds);
}

async function runAcceptHistorianNotes(historianRun: HistorianRun | null, applyAcceptedNotes: () => HistorianNote[], reloadEntities: ReloadEntities): Promise<void> {
  const targetId = historianRun?.targetId;
  const targetType = historianRun?.targetType;
  const notes = applyAcceptedNotes();
  if (notes.length === 0) return;

  if (targetType === "entity" && targetId) {
    await acceptEntityNotes(targetId, notes, reloadEntities);
  } else if (targetType === "chronicle" && targetId) {
    await acceptChronicleNotes(targetId, notes, historianRun);
  }
}

function runEditHistorianNoteText(historianRun: HistorianRun | null, noteId: string, newText: string): void {
  if (!historianRun) return;
  const updatedNotes = historianRun.notes.map((n) =>
    n.noteId === noteId ? { ...n, text: newText } : n
  );
  void updateHistorianRunRecord(historianRun.runId, { notes: updatedNotes });
}

async function applyReviewNotesForEntity(entityId: string, notes: HistorianNote[]): Promise<void> {
  await entityRepo.setHistorianNotes(entityId, notes);
}

async function applyEditionPatchesForEntity(patches: SummaryRevisionPatch[]): Promise<string[]> {
  const updatedIds = await entityRepo.applyRevisionPatches(patches, "historian-edition");
  for (const patch of patches) {
    if (patch.entityId) {
      await entityRepo.setHistorianNotes(patch.entityId, []);
    }
  }
  return updatedIds;
}

async function runUpdateHistorianNote(targetType: HistorianTargetType, targetId: string, noteId: string, updates: Partial<HistorianNote>, reloadEntities: ReloadEntities): Promise<void> {
  if (targetType === "entity" && targetId) {
    await updateEntityNote(targetId, noteId, updates, reloadEntities);
  } else if (targetType === "chronicle" && targetId) {
    await updateChronicleNote(targetId, noteId, updates);
  }
}

// --- Bulk historian helper hook ---

interface BulkHistorianSetupProps {
  applyReviewNotesForEntity: (entityId: string, notes: HistorianNote[]) => Promise<void>;
  applyEditionPatchesForEntity: (patches: SummaryRevisionPatch[]) => Promise<string[]>;
  reloadEntities: ReloadEntities;
  entityNavMap: Map<string, EntityNavItem>;
}

interface BulkHistorianSetupReturn {
  bulkHistorianProgress: BulkHistorianProgress;
  isBulkHistorianActive: boolean;
  showBulkHistorianModal: boolean;
  editionMaxTokens: number;
  setBulkHistorianTone: (tone: HistorianTone) => void;
  handleStartBulkHistorianReview: (eligibleEntityIds: string[]) => void;
  handleStartBulkHistorianEdition: (eligibleEntityIds: string[], reEdition?: boolean) => void;
  handleStartBulkHistorianClear: (eligibleEntityIds: string[]) => void;
  handleConfirmBulkHistorian: () => void;
  handleCancelBulkHistorian: () => void;
  handleCloseBulkHistorian: () => void;
}

function useBulkHistorianSetup({
  applyReviewNotesForEntity,
  applyEditionPatchesForEntity,
  reloadEntities,
  entityNavMap,
}: BulkHistorianSetupProps): BulkHistorianSetupReturn {
  const bulkHistorianDeps = useMemo(
    () => ({
      buildReviewContext: buildHistorianReviewContext,
      buildEditionContext: buildHistorianEditionContext,
      applyReviewNotes: applyReviewNotesForEntity,
      applyEditionPatches: applyEditionPatchesForEntity,
      reloadEntities,
      getEntityNav: (entityId: string) => entityNavMap.get(entityId),
    }),
    [applyReviewNotesForEntity, applyEditionPatchesForEntity, reloadEntities, entityNavMap]
  );

  const {
    progress: bulkHistorianProgress,
    isActive: isBulkHistorianActive,
    prepareBulkHistorian,
    confirmBulkHistorian,
    cancelBulkHistorian,
    setTone: setBulkHistorianTone,
  } = useBulkHistorian(bulkHistorianDeps);

  const [showBulkHistorianModal, setShowBulkHistorianModal] = useState<boolean>(false);
  const editionMaxTokens = useMemo<number>(() => getLLMCallConfig("historian.edition").maxTokens, []);

  const handleStartBulkHistorianReview = useCallback(
    (eligibleEntityIds: string[]) => {
      prepareBulkHistorian("review", "scholarly", eligibleEntityIds);
      setShowBulkHistorianModal(true);
    },
    [prepareBulkHistorian]
  );

  const handleStartBulkHistorianEdition = useCallback(
    (eligibleEntityIds: string[], reEdition?: boolean) => {
      prepareBulkHistorian("edition", "scholarly", eligibleEntityIds, reEdition);
      setShowBulkHistorianModal(true);
    },
    [prepareBulkHistorian]
  );

  const handleStartBulkHistorianClear = useCallback(
    (eligibleEntityIds: string[]) => {
      prepareBulkHistorian("clear", "scholarly", eligibleEntityIds);
      setShowBulkHistorianModal(true);
    },
    [prepareBulkHistorian]
  );

  const handleCancelBulkHistorian = useCallback(() => {
    cancelBulkHistorian();
    setShowBulkHistorianModal(false);
  }, [cancelBulkHistorian]);

  const handleCloseBulkHistorian = useCallback(() => {
    setShowBulkHistorianModal(false);
  }, []);

  // Close modal if prepare found no eligible entities
  useEffect(() => {
    if (showBulkHistorianModal && bulkHistorianProgress.status === "idle") {
      const timer = setTimeout(() => {
        if (bulkHistorianProgress.status === "idle") {
          setShowBulkHistorianModal(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showBulkHistorianModal, bulkHistorianProgress.status]);

  return {
    bulkHistorianProgress,
    isBulkHistorianActive,
    showBulkHistorianModal,
    editionMaxTokens,
    setBulkHistorianTone,
    handleStartBulkHistorianReview,
    handleStartBulkHistorianEdition,
    handleStartBulkHistorianClear,
    handleConfirmBulkHistorian: confirmBulkHistorian,
    handleCancelBulkHistorian,
    handleCloseBulkHistorian,
  };
}

// --- Main hook ---

export function useHistorianCallbacks({
  projectId,
  simulationRunId,
  worldContext,
  historianConfig,
  reloadEntities,
  entityNavMap,
}: UseHistorianCallbacksProps): UseHistorianCallbacksReturn {
  const {
    run: historianEditionRun,
    isActive: isHistorianEditionActive,
    startHistorianEdition,
    togglePatchDecision: toggleHistorianEditionPatchDecision,
    applyAccepted: applyAcceptedHistorianEditionPatches,
    cancelHistorianEdition,
  } = useHistorianEdition();
  const {
    run: historianRun,
    isActive: isHistorianActive,
    startReview: startHistorianReview,
    toggleNoteDecision: toggleHistorianNoteDecision,
    applyAccepted: applyAcceptedHistorianNotes,
    cancelReview: cancelHistorianReview,
  } = useHistorianReview();

  registerHistorianStarters({
    startHistorianEdition: (config) => { void startHistorianEdition(config); },
    startHistorianReview: (config) => { void startHistorianReview(config); },
  });
  useEffect(() => {
    useIlluminatorConfigStore.getState().setConfig({ isHistorianEditionActive, isHistorianActive });
  }, [isHistorianEditionActive, isHistorianActive]);

  const handleAcceptHistorianEdition = useCallback(
    () => runAcceptHistorianEdition(applyAcceptedHistorianEditionPatches, reloadEntities),
    [applyAcceptedHistorianEditionPatches, reloadEntities]
  );

  const corpusStrengthCacheRef = useRef<CorpusStrengthCache>({ runId: null, strength: null });
  const handleChronicleHistorianReview = useCallback(
    (chronicleId: string, tone?: HistorianTone) =>
      runChronicleHistorianReview({
        projectId,
        simulationRunId,
        chronicleId,
        tone,
        worldContext,
        historianConfig,
        corpusStrengthCacheRef,
        startHistorianReview,
      }),
    [projectId, simulationRunId, worldContext, historianConfig, startHistorianReview]
  );

  const {
    bulkHistorianProgress,
    isBulkHistorianActive,
    showBulkHistorianModal,
    editionMaxTokens,
    setBulkHistorianTone,
    handleStartBulkHistorianReview,
    handleStartBulkHistorianEdition,
    handleStartBulkHistorianClear,
    handleConfirmBulkHistorian,
    handleCancelBulkHistorian,
    handleCloseBulkHistorian,
  } = useBulkHistorianSetup({
    applyReviewNotesForEntity,
    applyEditionPatchesForEntity,
    reloadEntities,
    entityNavMap,
  });

  const handleAcceptHistorianNotes = useCallback(
    () => runAcceptHistorianNotes(historianRun, applyAcceptedHistorianNotes, reloadEntities),
    [applyAcceptedHistorianNotes, historianRun, reloadEntities]
  );
  const handleUpdateHistorianNote = useCallback(
    (targetType: HistorianTargetType, targetId: string, noteId: string, updates: Partial<HistorianNote>) =>
      runUpdateHistorianNote(targetType, targetId, noteId, updates, reloadEntities),
    [reloadEntities]
  );
  const handleEditHistorianNoteText = useCallback(
    (noteId: string, newText: string) => runEditHistorianNoteText(historianRun, noteId, newText),
    [historianRun]
  );

  return {
    historianEditionRun,
    isHistorianEditionActive,
    startHistorianEdition,
    toggleHistorianEditionPatchDecision,
    handleAcceptHistorianEdition,
    cancelHistorianEdition,
    historianRun,
    isHistorianActive,
    startHistorianReview,
    toggleHistorianNoteDecision,
    cancelHistorianReview,
    handleAcceptHistorianNotes,
    handleUpdateHistorianNote,
    handleEditHistorianNoteText,
    handleChronicleHistorianReview,
    bulkHistorianProgress,
    isBulkHistorianActive,
    showBulkHistorianModal,
    editionMaxTokens,
    setBulkHistorianTone,
    handleStartBulkHistorianReview,
    handleStartBulkHistorianEdition,
    handleStartBulkHistorianClear,
    handleConfirmBulkHistorian,
    handleCancelBulkHistorian,
    handleCloseBulkHistorian,
  };
}
