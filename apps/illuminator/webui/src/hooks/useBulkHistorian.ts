/**
 * useBulkHistorian - Sequential bulk historian annotation and copy-edit for entities
 *
 * Follows the useBulkBackport pattern:
 * 1. prepareBulkHistorian() — build entity summary, enter 'confirming' state
 * 2. User reviews entity list in BulkHistorianModal and clicks Confirm
 * 3. confirmBulkHistorian() — processes all entities sequentially, auto-accepting results
 *
 * Handles three operation types:
 * - 'review': Historian annotations (margin notes). Tones cycle through all 5 per entity.
 * - 'edition': Historian copy-edit (full description rewrite). Single user-selected tone.
 * - 'clear': Remove all historian annotations from selected entities.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { EnrichmentType } from "../lib/enrichmentTypes";
import { getEnqueue } from "../lib/db/enrichmentQueueBridge";
import type { EntityNavItem } from "../lib/db/entityNav";
import type { HistorianTone, HistorianNote } from "../lib/historianTypes";
import type { HistorianReviewConfig } from "./useHistorianReview";
import type { HistorianEditionConfig } from "./useHistorianEdition";
import type { SummaryRevisionPatch } from "../lib/summaryRevisionTypes";
import { createHistorianRun, generateHistorianRunId } from "../lib/db/historianRepository";
import {
  createRevisionRun,
  getRevisionRun,
  generateRevisionRunId,
  deleteRevisionRun,
} from "../lib/db/summaryRevisionRepository";
import {
  dispatchReviewTask as sharedDispatchReview,
  pollReviewCompletion as sharedPollReview,
  sleep,
  POLL_INTERVAL_MS,
} from "../lib/db/historianRunHelpers";

// ============================================================================
// Types
// ============================================================================

export type BulkHistorianOperation = "review" | "edition" | "clear";

export interface BulkHistorianEntitySummary {
  entityId: string;
  entityName: string;
  entityKind: string;
  entitySubtype: string;
  tone?: HistorianTone;
  tokenEstimate?: number; // estimated output tokens based on current description word count
}

export interface BulkHistorianProgress {
  status: "idle" | "confirming" | "running" | "complete" | "cancelled" | "failed";
  operation: BulkHistorianOperation;
  tone: HistorianTone;
  entities: BulkHistorianEntitySummary[];
  totalEntities: number;
  processedEntities: number;
  currentEntityName: string;
  currentEntityTone?: HistorianTone;
  totalCost: number;
  error?: string;
  failedEntities: Array<{ entityId: string; entityName: string; error: string }>;
}

export interface UseBulkHistorianReturn {
  progress: BulkHistorianProgress;
  isActive: boolean;
  prepareBulkHistorian: (
    operation: BulkHistorianOperation,
    tone: HistorianTone,
    entityIds: string[],
    reEdition?: boolean
  ) => void;
  confirmBulkHistorian: () => void;
  cancelBulkHistorian: () => void;
  setTone: (tone: HistorianTone) => void;
}

// ============================================================================
// Constants
// ============================================================================

const TONE_CYCLE: HistorianTone[] = ["witty", "weary", "forensic", "elegiac", "cantankerous"];

const IDLE_PROGRESS: BulkHistorianProgress = {
  status: "idle",
  operation: "review",
  tone: "scholarly",
  entities: [],
  totalEntities: 0,
  processedEntities: 0,
  currentEntityName: "",
  totalCost: 0,
  failedEntities: [],
};

// ============================================================================
// Hook
// ============================================================================

export function useBulkHistorian(deps: {
  buildReviewContext: (
    entityId: string,
    tone: HistorianTone
  ) => Promise<HistorianReviewConfig | null>;
  buildEditionContext: (
    entityId: string,
    tone: HistorianTone,
    reEdition?: boolean
  ) => Promise<HistorianEditionConfig | null>;
  applyReviewNotes: (entityId: string, notes: HistorianNote[]) => Promise<void>;
  applyEditionPatches: (patches: SummaryRevisionPatch[]) => Promise<string[]>;
  reloadEntities: (entityIds: string[]) => Promise<void>;
  getEntityNav: (entityId: string) => EntityNavItem | undefined;
}): UseBulkHistorianReturn {
  const [progress, setProgress] = useState<BulkHistorianProgress>(IDLE_PROGRESS);
  const cancelledRef = useRef(false);
  const activeRef = useRef(false);

  const depsRef = useRef(deps);
  useEffect(() => {
    depsRef.current = deps;
  }, [deps]);

  // Stash scan results so confirmBulkHistorian can use them
  const scanRef = useRef<{
    operation: BulkHistorianOperation;
    tone: HistorianTone;
    entities: BulkHistorianEntitySummary[];
    reEdition?: boolean;
  } | null>(null);

  // Cancellation check for shared poll helper
  const isCancelled = useCallback(() => cancelledRef.current, []);

  // Dispatch a historian edition task
  const dispatchEditionTask = useCallback((runId: string) => {
    getEnqueue()([
      {
        entity: {
          id: "__historian_edition__",
          name: "Historian Edition",
          kind: "system",
          subtype: "",
          prominence: "",
          culture: "",
          status: "active",
          description: "",
          tags: {},
        },
        type: "historianEdition" as EnrichmentType,
        prompt: "",
        chronicleId: runId,
      },
    ]);
  }, []);

  // Poll edition run for completion
  const pollEditionCompletion = useCallback(
    async (runId: string): Promise<{ patches: SummaryRevisionPatch[]; cost: number } | null> => {
      while (true) {
        if (cancelledRef.current) return null;
        await sleep(POLL_INTERVAL_MS);
        if (cancelledRef.current) return null;

        const run = await getRevisionRun(runId);
        if (!run) return null;

        if (run.status === "run_reviewing" || run.status === "batch_reviewing") {
          const patches: SummaryRevisionPatch[] = [];
          for (const batch of run.batches) {
            for (const patch of batch.patches) {
              patches.push(patch);
            }
          }
          const cost = run.totalActualCost || 0;
          await deleteRevisionRun(runId);
          return { patches, cost };
        }

        if (run.status === "failed") {
          const error = run.batches[0]?.error || "Unknown error";
          await deleteRevisionRun(runId);
          throw new Error(error);
        }
      }
    },
    []
  );

  // Phase 1: Build entity summary for confirmation
  const prepareBulkHistorian = useCallback(
    (
      operation: BulkHistorianOperation,
      tone: HistorianTone,
      entityIds: string[],
      reEdition?: boolean
    ) => {
      if (activeRef.current) return;

      // Resolve nav items and build summary
      const resolved: Array<{ nav: EntityNavItem; summary: BulkHistorianEntitySummary }> = [];
      for (const id of entityIds) {
        const nav = depsRef.current.getEntityNav(id);
        if (!nav) continue;
        // Clear: needs historian notes. Review/edition: needs a description.
        if (operation === "clear" ? !nav.hasHistorianNotes : !nav.hasDescription) continue;
        resolved.push({
          nav,
          summary: {
            entityId: nav.id,
            entityName: nav.name,
            entityKind: nav.kind,
            entitySubtype: nav.subtype,
            tokenEstimate:
              operation === "edition"
                ? Math.ceil((nav.descriptionWordCount || 0) * 1.35)
                : undefined,
          },
        });
      }

      // For review: assign tones via stratified cycling.
      // Sort by (kind, culture, prominence) so similar entities are adjacent,
      // then cycle tones globally — each stratum starts where the previous left off,
      // preventing any tone from being over-represented within a stratum.
      if (operation === "review") {
        resolved.sort(
          (a, b) =>
            a.nav.kind.localeCompare(b.nav.kind) ||
            a.nav.culture.localeCompare(b.nav.culture) ||
            a.nav.prominence - b.nav.prominence
        );
        for (let i = 0; i < resolved.length; i++) {
          resolved[i].summary.tone = TONE_CYCLE[i % TONE_CYCLE.length];
        }
      }

      const entities = resolved.map((r) => r.summary);

      if (entities.length === 0) return;

      scanRef.current = { operation, tone, entities, reEdition };

      setProgress({
        status: "confirming",
        operation,
        tone,
        entities,
        totalEntities: entities.length,
        processedEntities: 0,
        currentEntityName: "",
        totalCost: 0,
        failedEntities: [],
      });
    },
    []
  );

  // Allow tone change during confirmation (edition mode)
  const setTone = useCallback((tone: HistorianTone) => {
    if (scanRef.current) {
      scanRef.current.tone = tone;
    }
    setProgress((p) => (p.status === "confirming" ? { ...p, tone } : p));
  }, []);

  // Phase 2: Process all entities sequentially
  const confirmBulkHistorian = useCallback(() => {
    const scan = scanRef.current;
    if (!scan || activeRef.current) return;

    activeRef.current = true;
    cancelledRef.current = false;

    setProgress((p) => ({ ...p, status: "running" }));

    void (async () => {
      try {
        const { operation, tone, entities, reEdition } = scan;

        let globalProcessed = 0;
        let globalCost = 0;
        const failedEntities: Array<{ entityId: string; entityName: string; error: string }> = [];

        if (operation === "clear") {
          // Clear all historian notes — no enrichment dispatch, just DB writes
          for (const entity of entities) {
            if (cancelledRef.current) break;

            setProgress((p) => ({ ...p, currentEntityName: entity.entityName }));

            try {
              await depsRef.current.applyReviewNotes(entity.entityId, []);
              await depsRef.current.reloadEntities([entity.entityId]);
              globalProcessed++;
              setProgress((p) => ({ ...p, processedEntities: globalProcessed }));
            } catch (err) {
              globalProcessed++;
              failedEntities.push({
                entityId: entity.entityId,
                entityName: entity.entityName,
                error: err instanceof Error ? err.message : String(err),
              });
              setProgress((p) => ({
                ...p,
                processedEntities: globalProcessed,
                failedEntities: [...failedEntities],
              }));
            }
          }
        } else {
          // Review or edition — shuffle then process sequentially
          const shuffled = [...entities];
          for (let s = shuffled.length - 1; s > 0; s--) {
            // eslint-disable-next-line sonarjs/pseudo-random -- non-security shuffle for processing order
            const j = Math.floor(Math.random() * (s + 1));
            [shuffled[s], shuffled[j]] = [shuffled[j], shuffled[s]];
          }

          for (let i = 0; i < shuffled.length; i++) {
            if (cancelledRef.current) break;

            const entity = shuffled[i];
            const entityTone = operation === "review" && entity.tone ? entity.tone : tone;

            setProgress((p) => ({
              ...p,
              currentEntityName: entity.entityName,
              currentEntityTone: entityTone,
            }));

            try {
              if (operation === "review") {
                const config = await depsRef.current.buildReviewContext(
                  entity.entityId,
                  entityTone
                );
                if (!config) {
                  globalProcessed++;
                  setProgress((p) => ({ ...p, processedEntities: globalProcessed }));
                  continue;
                }

                const runId = generateHistorianRunId();
                const now = Date.now();

                await createHistorianRun({
                  runId,
                  projectId: config.projectId,
                  simulationRunId: config.simulationRunId,
                  status: "pending",
                  tone: config.tone,
                  targetType: config.targetType,
                  targetId: config.targetId,
                  targetName: config.targetName,
                  sourceText: config.sourceText,
                  notes: [],
                  noteDecisions: {},
                  contextJson: config.contextJson,
                  previousNotesJson: config.previousNotesJson,
                  historianConfigJson: JSON.stringify(config.historianConfig),
                  inputTokens: 0,
                  outputTokens: 0,
                  actualCost: 0,
                  createdAt: now,
                  updatedAt: now,
                });

                sharedDispatchReview(runId);

                const result = await sharedPollReview(runId, isCancelled);
                if (cancelledRef.current || !result) break;

                if (result.notes.length > 0) {
                  await depsRef.current.applyReviewNotes(entity.entityId, result.notes);
                }
                globalCost += result.cost;
              } else {
                // edition
                const config = await depsRef.current.buildEditionContext(
                  entity.entityId,
                  entityTone,
                  reEdition
                );
                if (!config) {
                  globalProcessed++;
                  setProgress((p) => ({ ...p, processedEntities: globalProcessed }));
                  continue;
                }

                const runId = generateRevisionRunId();

                await createRevisionRun(
                  runId,
                  config.projectId,
                  config.simulationRunId,
                  [
                    {
                      culture: "historian-edition",
                      entityIds: [config.entityId],
                      status: "pending" as const,
                      patches: [],
                    },
                  ],
                  {
                    worldDynamicsContext: config.description,
                    staticPagesContext: JSON.stringify({
                      entityId: config.entityId,
                      entityName: config.entityName,
                      entityKind: config.entityKind,
                      entitySubtype: config.entitySubtype,
                      entityCulture: config.entityCulture,
                      entityProminence: config.entityProminence,
                      summary: config.summary,
                      descriptionHistory: config.descriptionHistory,
                      chronicleSummaries: config.chronicleSummaries,
                      relationships: config.relationships,
                      neighborSummaries: config.neighborSummaries,
                      canonFacts: config.canonFacts,
                      worldDynamics: config.worldDynamics,
                      previousNotes: config.previousNotes,
                      historianConfig: config.historianConfig,
                      tone: config.tone,
                    }),
                    schemaContext: "",
                    revisionGuidance: "",
                  }
                );

                dispatchEditionTask(runId);

                const result = await pollEditionCompletion(runId);
                if (cancelledRef.current || !result) break;

                if (result.patches.length > 0) {
                  await depsRef.current.applyEditionPatches(result.patches);
                }
                globalCost += result.cost;
              }

              await depsRef.current.reloadEntities([entity.entityId]);
              globalProcessed++;

              setProgress((p) => ({
                ...p,
                processedEntities: globalProcessed,
                totalCost: globalCost,
                failedEntities: [...failedEntities],
              }));
            } catch (err) {
              console.error(`[Bulk Historian] Entity ${entity.entityName} failed:`, err);
              globalProcessed++;
              failedEntities.push({
                entityId: entity.entityId,
                entityName: entity.entityName,
                error: err instanceof Error ? err.message : String(err),
              });
              setProgress((p) => ({
                ...p,
                processedEntities: globalProcessed,
                totalCost: globalCost,
                failedEntities: [...failedEntities],
              }));
            }
          }
        } // end else (review/edition)

        if (cancelledRef.current) {
          setProgress((p) => ({ ...p, status: "cancelled", currentEntityName: "" }));
        } else {
          setProgress((p) => ({ ...p, status: "complete", currentEntityName: "" }));
        }
      } catch (err) {
        console.error("[Bulk Historian] Fatal error:", err);
        setProgress((p) => ({
          ...p,
          status: "failed",
          currentEntityName: "",
          error: err instanceof Error ? err.message : String(err),
        }));
      } finally {
        activeRef.current = false;
        scanRef.current = null;
      }
    })();
  }, [isCancelled, dispatchEditionTask, pollEditionCompletion]);

  const cancelBulkHistorian = useCallback(() => {
    cancelledRef.current = true;
    scanRef.current = null;
    setProgress((p) => {
      if (p.status === "confirming") return IDLE_PROGRESS;
      return p; // running state will pick up cancellation via cancelledRef
    });
  }, []);

  return {
    progress,
    isActive:
      activeRef.current || progress.status === "running" || progress.status === "confirming",
    prepareBulkHistorian,
    confirmBulkHistorian,
    cancelBulkHistorian,
    setTone,
  };
}
