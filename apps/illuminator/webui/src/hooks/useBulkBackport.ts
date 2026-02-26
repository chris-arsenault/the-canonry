/**
 * useBulkBackport - Fully automatic multi-chronicle, multi-batch backport orchestration
 *
 * Flow:
 * 1. prepareBulkBackport() — scans eligible chronicles, builds entity summary, enters 'confirming' state
 * 2. User reviews entity list in BulkBackportModal and clicks Confirm
 * 3. confirmBulkBackport() — processes all chronicles sequentially with chunked batches
 *
 * Creates one SummaryRevisionRun per chunk (reusing the existing worker task unchanged),
 * polls for completion, auto-accepts results, and advances.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { EnrichmentType } from "../lib/enrichmentTypes";
import { getEnqueue } from "../lib/db/enrichmentQueueBridge";
import type { SummaryRevisionPatch, RevisionEntityContext } from "../lib/summaryRevisionTypes";
import {
  createRevisionRun,
  getRevisionRun,
  generateRevisionRunId,
  deleteRevisionRun,
} from "../lib/db/summaryRevisionRepository";

// ============================================================================
// Types
// ============================================================================

export interface BackportContext {
  chronicleId: string;
  chronicleTitle: string;
  /** All entities with isPrimary, isLens, isTertiary flags */
  entities: RevisionEntityContext[];
  chronicleText: string;
  perspectiveSynthesisJson: string;
  /** entityId -> 'backported' | 'not_needed' */
  perEntityStatus: Record<string, string>;
}

export interface BulkBackportEntitySummary {
  entityId: string;
  entityName: string;
  entityKind: string;
  entitySubtype: string;
  /** Number of chronicles that will backport this entity */
  chronicleCount: number;
}

export interface BulkBackportChronicleProgress {
  chronicleId: string;
  chronicleTitle: string;
  totalEntities: number;
  processedEntities: number;
  totalBatches: number;
  completedBatches: number;
  status: "pending" | "running" | "complete" | "failed";
  error?: string;
}

export interface BulkBackportProgress {
  status: "idle" | "confirming" | "running" | "complete" | "cancelled" | "failed";
  chronicles: BulkBackportChronicleProgress[];
  currentChronicleIndex: number;
  totalEntities: number;
  processedEntities: number;
  totalCost: number;
  error?: string;
  /** Entity summary for confirmation screen (only populated in 'confirming' status) */
  entitySummary?: BulkBackportEntitySummary[];
}

export interface UseBulkBackportReturn {
  progress: BulkBackportProgress;
  isActive: boolean;
  /** Scan eligible chronicles and enter confirmation state */
  prepareBulkBackport: (simulationRunId: string, projectId: string) => Promise<void>;
  /** Start processing after user confirms */
  confirmBulkBackport: () => void;
  cancelBulkBackport: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_BATCH_SIZE = 8;
const POLL_INTERVAL_MS = 1500;

const IDLE_PROGRESS: BulkBackportProgress = {
  status: "idle",
  chronicles: [],
  currentChronicleIndex: 0,
  totalEntities: 0,
  processedEntities: 0,
  totalCost: 0,
};

// ============================================================================
// Helpers
// ============================================================================

function chunkEntities(
  entities: RevisionEntityContext[],
  maxSize: number
): RevisionEntityContext[][] {
  const chunks: RevisionEntityContext[][] = [];
  for (let i = 0; i < entities.length; i += maxSize) {
    chunks.push(entities.slice(i, i + maxSize));
  }
  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Hook
// ============================================================================

export function useBulkBackport(deps: {
  assembleContextForChronicle: (chronicleId: string) => Promise<BackportContext | null>;
  applyPatches: (
    patches: SummaryRevisionPatch[],
    chronicleId: string,
    sentEntityIds: string[]
  ) => Promise<void>;
  getEligibleChronicleIds: (
    simulationRunId: string
  ) => Promise<Array<{ chronicleId: string; chronicleTitle: string; pendingCount: number }>>;
}): UseBulkBackportReturn {
  const [progress, setProgress] = useState<BulkBackportProgress>(IDLE_PROGRESS);
  const cancelledRef = useRef(false);
  const activeRef = useRef(false);

  // Keep a ref to deps so the async loop always calls the latest callbacks
  const depsRef = useRef(deps);
  useEffect(() => {
    depsRef.current = deps;
  }, [deps]);

  // Stash scan results so confirmBulkBackport can use them
  const scanRef = useRef<{
    simulationRunId: string;
    projectId: string;
    eligible: Array<{ chronicleId: string; chronicleTitle: string; pendingCount: number }>;
    chronicleContexts: Array<{
      context: BackportContext;
      pendingEntities: RevisionEntityContext[];
    }>;
  } | null>(null);

  const dispatchBatch = useCallback(
    (runId: string, batchEntityContexts: RevisionEntityContext[]) => {
      const sentinelEntity = {
        id: "__chronicle_lore_backport__",
        name: "Chronicle Lore Backport",
        kind: "system",
        subtype: "",
        prominence: "",
        culture: "",
        status: "active",
        description: "",
        tags: {},
      };
      getEnqueue()([
        {
          entity: sentinelEntity,
          type: "chronicleLoreBackport" as EnrichmentType,
          prompt: JSON.stringify(batchEntityContexts),
          chronicleId: runId,
        },
      ]);
    },
    []
  );

  const pollForCompletion = useCallback(
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

  // Phase 1: Scan all eligible chronicles and build entity summary for confirmation
  const prepareBulkBackport = useCallback(async (simulationRunId: string, projectId: string) => {
    if (activeRef.current) return;

    const eligible = await depsRef.current.getEligibleChronicleIds(simulationRunId);
    if (eligible.length === 0) return;

    // Scan each chronicle to get actual pending entities
    const entityChronicleCount = new Map<
      string,
      { entity: RevisionEntityContext; count: number }
    >();
    const chronicleContexts: Array<{
      context: BackportContext;
      pendingEntities: RevisionEntityContext[];
    }> = [];

    for (const { chronicleId } of eligible) {
      const context = await depsRef.current.assembleContextForChronicle(chronicleId);
      if (!context) continue;

      const pendingEntities = context.entities.filter((e) => !context.perEntityStatus[e.id]);
      if (pendingEntities.length === 0) continue;

      chronicleContexts.push({ context, pendingEntities });

      for (const entity of pendingEntities) {
        const existing = entityChronicleCount.get(entity.id);
        if (existing) {
          existing.count++;
        } else {
          entityChronicleCount.set(entity.id, { entity, count: 1 });
        }
      }
    }

    if (chronicleContexts.length === 0) return;

    // Build entity summary sorted by chronicle count (descending), then name
    const entitySummary: BulkBackportEntitySummary[] = Array.from(entityChronicleCount.values())
      .map(({ entity, count }) => ({
        entityId: entity.id,
        entityName: entity.name,
        entityKind: entity.kind,
        entitySubtype: entity.subtype,
        chronicleCount: count,
      }))
      .sort(
        (a, b) => b.chronicleCount - a.chronicleCount || a.entityName.localeCompare(b.entityName)
      );

    const chronicleProgress: BulkBackportChronicleProgress[] = chronicleContexts.map(
      ({ context, pendingEntities }) => ({
        chronicleId: context.chronicleId,
        chronicleTitle: context.chronicleTitle,
        totalEntities: pendingEntities.length,
        processedEntities: 0,
        totalBatches: Math.ceil(pendingEntities.length / MAX_BATCH_SIZE),
        completedBatches: 0,
        status: "pending" as const,
      })
    );

    const totalEntities = chronicleProgress.reduce((sum, c) => sum + c.totalEntities, 0);

    // Stash for confirmBulkBackport
    scanRef.current = { simulationRunId, projectId, eligible, chronicleContexts };

    setProgress({
      status: "confirming",
      chronicles: chronicleProgress,
      currentChronicleIndex: 0,
      totalEntities,
      processedEntities: 0,
      totalCost: 0,
      entitySummary,
    });
  }, []);

  // Phase 2: User confirmed — run the processing loop
  const confirmBulkBackport = useCallback(() => {
    const scan = scanRef.current;
    if (!scan || activeRef.current) return;

    activeRef.current = true;
    cancelledRef.current = false;

    // Clear entity summary and transition to running
    setProgress((p) => ({ ...p, status: "running", entitySummary: undefined }));

    // Run the async processing loop
    void (async () => {
      try {
        const { simulationRunId, projectId, chronicleContexts } = scan;

        // Re-read progress for chronicle list (was set in prepare)
        const chronicleProgress: BulkBackportChronicleProgress[] = chronicleContexts.map(
          ({ context, pendingEntities }) => ({
            chronicleId: context.chronicleId,
            chronicleTitle: context.chronicleTitle,
            totalEntities: pendingEntities.length,
            processedEntities: 0,
            totalBatches: Math.ceil(pendingEntities.length / MAX_BATCH_SIZE),
            completedBatches: 0,
            status: "pending" as const,
          })
        );

        let globalProcessed = 0;
        let globalCost = 0;

        for (let ci = 0; ci < chronicleContexts.length; ci++) {
          if (cancelledRef.current) break;

          const { context: originalContext } = chronicleContexts[ci];
          const chronicleId = originalContext.chronicleId;

          // Assemble fresh context (entity descriptions may have been updated by prior batches)
          const context = await depsRef.current.assembleContextForChronicle(chronicleId);
          if (!context) {
            chronicleProgress[ci] = {
              ...chronicleProgress[ci],
              status: "complete",
              totalEntities: 0,
              totalBatches: 0,
            };
            setProgress((p) => ({
              ...p,
              chronicles: [...chronicleProgress],
              currentChronicleIndex: ci,
            }));
            continue;
          }

          const pendingEntities = context.entities.filter((e) => !context.perEntityStatus[e.id]);
          if (pendingEntities.length === 0) {
            chronicleProgress[ci] = {
              ...chronicleProgress[ci],
              status: "complete",
              totalEntities: 0,
              totalBatches: 0,
            };
            setProgress((p) => ({
              ...p,
              chronicles: [...chronicleProgress],
              currentChronicleIndex: ci,
            }));
            continue;
          }

          const chunks = chunkEntities(pendingEntities, MAX_BATCH_SIZE);

          chronicleProgress[ci] = {
            ...chronicleProgress[ci],
            status: "running",
            totalEntities: pendingEntities.length,
            totalBatches: chunks.length,
            completedBatches: 0,
            processedEntities: 0,
          };
          setProgress((p) => ({
            ...p,
            chronicles: [...chronicleProgress],
            currentChronicleIndex: ci,
          }));

          let chronicleFailed = false;

          for (let bi = 0; bi < chunks.length; bi++) {
            if (cancelledRef.current) break;

            const chunk = chunks[bi];
            const runId = generateRevisionRunId();

            await createRevisionRun(
              runId,
              projectId,
              simulationRunId,
              [
                {
                  culture: "cast",
                  entityIds: chunk.map((e) => e.id),
                  status: "pending" as const,
                  patches: [],
                },
              ],
              {
                worldDynamicsContext: context.chronicleText,
                staticPagesContext: context.perspectiveSynthesisJson,
                schemaContext: "",
                revisionGuidance: "",
              }
            );

            dispatchBatch(runId, chunk);

            try {
              const result = await pollForCompletion(runId);
              if (cancelledRef.current || !result) break;

              const batchEntityIds = chunk.map((e) => e.id);
              if (result.patches.length > 0) {
                await depsRef.current.applyPatches(result.patches, chronicleId, batchEntityIds);
              } else {
                await depsRef.current.applyPatches([], chronicleId, batchEntityIds);
              }

              globalCost += result.cost;
              const batchEntityCount = chunk.length;
              globalProcessed += batchEntityCount;

              chronicleProgress[ci] = {
                ...chronicleProgress[ci],
                completedBatches: bi + 1,
                processedEntities: chronicleProgress[ci].processedEntities + batchEntityCount,
              };
              setProgress((p) => ({
                ...p,
                chronicles: [...chronicleProgress],
                processedEntities: globalProcessed,
                totalCost: globalCost,
              }));
            } catch (err) {
              console.error(
                `[Bulk Backport] Batch ${bi + 1}/${chunks.length} failed for chronicle ${chronicleId}:`,
                err
              );
              chronicleProgress[ci] = {
                ...chronicleProgress[ci],
                status: "failed",
                error: err instanceof Error ? err.message : String(err),
              };
              setProgress((p) => ({
                ...p,
                chronicles: [...chronicleProgress],
                processedEntities: globalProcessed,
                totalCost: globalCost,
              }));
              chronicleFailed = true;
              break;
            }
          }

          if (cancelledRef.current) break;

          if (!chronicleFailed) {
            chronicleProgress[ci] = { ...chronicleProgress[ci], status: "complete" };
            setProgress((p) => ({
              ...p,
              chronicles: [...chronicleProgress],
            }));
          }
        }

        if (cancelledRef.current) {
          setProgress((p) => ({ ...p, status: "cancelled" }));
        } else {
          setProgress((p) => ({ ...p, status: "complete" }));
        }
      } catch (err) {
        console.error("[Bulk Backport] Fatal error:", err);
        setProgress((p) => ({
          ...p,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        }));
      } finally {
        activeRef.current = false;
        scanRef.current = null;
      }
    })();
  }, [dispatchBatch, pollForCompletion]);

  const cancelBulkBackport = useCallback(() => {
    cancelledRef.current = true;
    scanRef.current = null;
    // If still in confirming state, reset to idle immediately
    setProgress((p) => {
      if (p.status === "confirming") return IDLE_PROGRESS;
      return p; // running state will pick up cancellation via cancelledRef
    });
  }, []);

  return {
    progress,
    isActive:
      activeRef.current || progress.status === "running" || progress.status === "confirming",
    prepareBulkBackport,
    confirmBulkBackport,
    cancelBulkBackport,
  };
}
