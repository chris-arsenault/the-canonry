/**
 * useEnrichmentQueue - UI-side queue management with multiple workers
 *
 * This hook manages the enrichment queue in the UI thread.
 * Workers are pure executors - this hook handles:
 * - Queue state (pending, running, completed, errored items)
 * - Distributing tasks to workers based on estimated workload
 * - Receiving results and updating entity state
 * - Progress tracking
 *
 * Task distribution uses "soonest available" estimation:
 * workload = num_text_tasks + (10 * num_image_tasks)
 * Images take ~10x longer than text, so they count more.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  QueueItem,
  EnrichmentTaskPayload,
  WorkerTask,
  EntityEnrichment,
  ApplyEnrichmentOutput,
} from "../lib/enrichmentTypes";
import { applyEnrichmentResult } from "../lib/enrichmentTypes";
import type { WorkerConfig, WorkerOutbound } from "../workers/enrichment.worker";
import { createWorkerPool, resetWorkerPool, type WorkerHandle } from "../lib/workerFactory";
import { getResolvedLLMCallSettings, type ResolvedLLMCallSettings } from "../lib/llmModelSettings";
import type { LLMCallType } from "../lib/llmCallTypes";
import type { EnrichmentType } from "../lib/enrichmentTypes";
import { useThinkingStore } from "../lib/db/thinkingStore";
import { executeBrowserTask } from "../lib/browserTaskExecutor";

/**
 * Map enrichment task types to their primary LLM call type.
 * Used to look up the runInBrowser flag for execution context decisions.
 */
const TASK_PRIMARY_CALL_TYPE: Partial<Record<EnrichmentType, LLMCallType>> = {
  description: "description.narrative",
  visualThesis: "description.visualThesis",
  image: "image.promptFormatting",
  entityChronicle: "chronicle.generation",
  paletteExpansion: "palette.expansion",
  dynamicsGeneration: "dynamics.generation",
  summaryRevision: "revision.summary",
  chronicleLoreBackport: "revision.loreBackport",
  historianEdition: "historian.edition",
  historianReview: "historian.entityReview",
  historianChronology: "historian.chronology",
  historianPrep: "historian.prep",
  eraNarrative: "historian.eraNarrative.threads",
  motifVariation: "historian.motifVariation",
  factCoverage: "chronicle.factCoverage",
  toneRanking: "chronicle.toneRanking",
  bulkToneRanking: "chronicle.bulkToneRanking",
};

function shouldRunInBrowser(taskType: string, settings: ResolvedLLMCallSettings): boolean {
  const callType = TASK_PRIMARY_CALL_TYPE[taskType as EnrichmentType];
  if (!callType) return false;
  return settings[callType]?.runInBrowser ?? false;
}

export interface EnrichedEntity {
  id: string;
  name: string;
  kind: string;
  subtype: string;
  prominence: string;
  culture: string;
  status: string;
  description: string;
  summary?: string;
  narrativeHint?: string;
  lockedSummary?: boolean;
  tags: Record<string, unknown>;
  createdAt?: number;
  enrichment?: EntityEnrichment;
}

export interface QueueStats {
  queued: number;
  running: number;
  completed: number;
  errored: number;
  total: number;
}

export interface UseEnrichmentQueueReturn {
  // State
  queue: QueueItem[];
  isWorkerReady: boolean;
  stats: QueueStats;

  // Actions
  initialize: (config: WorkerConfig) => void;
  enqueue: (items: EnqueueItem[]) => void;
  cancel: (itemId: string) => void;
  cancelAll: () => void;
  retry: (itemId: string) => void;
  clearCompleted: () => void;

  // Entity updates (call this when result comes back)
  getUpdatedEntity: (entity: EnrichedEntity) => EnrichedEntity;
}

// Cost weights for workload estimation
const TEXT_TASK_WEIGHT = 1;
const IMAGE_TASK_WEIGHT = 10;
const MAX_AUTO_RECONNECT_ATTEMPTS = 1;

interface WorkerState {
  worker: WorkerHandle;
  workerId: number;
  isReady: boolean;
  currentTaskId: string | null;
  // Track pending tasks assigned to this worker
  pendingTaskIds: Set<string>;
}

type EnqueueItem = Omit<
  EnrichmentTaskPayload,
  | "id"
  | "entityId"
  | "entityName"
  | "entityKind"
  | "entitySubtype"
  | "entityCulture"
  | "simulationRunId"
> & {
  entity: EnrichedEntity;
};

/**
 * Calculate estimated workload for a worker based on its assigned tasks
 */
function calculateWorkload(workerState: WorkerState, queue: QueueItem[]): number {
  let workload = 0;

  // Add weight for current running task
  if (workerState.currentTaskId) {
    const currentTask = queue.find((q) => q.id === workerState.currentTaskId);
    if (currentTask) {
      workload += currentTask.type === "image" ? IMAGE_TASK_WEIGHT : TEXT_TASK_WEIGHT;
    }
  }

  // Add weight for pending tasks assigned to this worker
  for (const taskId of workerState.pendingTaskIds) {
    const task = queue.find((q) => q.id === taskId);
    if (task && task.status === "queued") {
      workload += task.type === "image" ? IMAGE_TASK_WEIGHT : TEXT_TASK_WEIGHT;
    }
  }

  return workload;
}

/**
 * Find the worker with lowest estimated workload
 */
function findLeastBusyWorker(workers: WorkerState[], queue: QueueItem[]): WorkerState | null {
  const readyWorkers = workers.filter((w) => w.isReady);
  if (readyWorkers.length === 0) return null;

  let leastBusy = readyWorkers[0];
  let lowestWorkload = calculateWorkload(leastBusy, queue);

  for (let i = 1; i < readyWorkers.length; i++) {
    const workload = calculateWorkload(readyWorkers[i], queue);
    if (workload < lowestWorkload) {
      lowestWorkload = workload;
      leastBusy = readyWorkers[i];
    }
  }

  return leastBusy;
}

/**
 * Create an updater function for setQueue that patches a single item by ID.
 * Extracted to reduce nesting depth in callbacks.
 */
function patchQueueItem(
  itemId: string,
  patch: Partial<QueueItem>
): (prev: QueueItem[]) => QueueItem[] {
  return (prev) =>
    prev.map((item) =>
      item.id === itemId ? { ...item, ...patch } : item
    );
}

export function useEnrichmentQueue(
  onEntityUpdate: (entityId: string, output: ApplyEnrichmentOutput) => void,
  projectId?: string,
  simulationRunId?: string
): UseEnrichmentQueueReturn {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const workersRef = useRef<WorkerState[]>([]);
  const configRef = useRef<WorkerConfig | null>(null);
  const numWorkersRef = useRef<number>(4);
  const projectIdRef = useRef<string | undefined>(projectId);
  const simulationRunIdRef = useRef<string | undefined>(simulationRunId);
  const reconnectInProgressRef = useRef(false);
  const autoReconnectAttemptsRef = useRef<Map<string, number>>(new Map());
  const pendingAutoRetryRef = useRef<Set<string>>(new Set());
  // Track tasks currently executing in the browser (not on a worker).
  // Prevents re-entry: queueRef.current is stale until React re-renders,
  // so without this guard the same task can be picked up multiple times.
  const browserRunningTasksRef = useRef<Set<string>>(new Set());

  // Keep projectId ref in sync
  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  // Keep simulationRunId ref in sync
  useEffect(() => {
    simulationRunIdRef.current = simulationRunId;
  }, [simulationRunId]);

  // Track which tasks are assigned to which worker
  const taskWorkerMapRef = useRef<Map<string, number>>(new Map());

  // Refs for accessing latest values in callbacks (avoid stale closures)
  const queueRef = useRef<QueueItem[]>([]);
  const onEntityUpdateRef = useRef(onEntityUpdate);
  const initializeRef = useRef<((config: WorkerConfig) => void) | null>(null);

  // Keep refs in sync
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    onEntityUpdateRef.current = onEntityUpdate;
  }, [onEntityUpdate]);

  // Calculate stats
  const stats: QueueStats = {
    queued: queue.filter((item) => item.status === "queued").length,
    running: queue.filter((item) => item.status === "running").length,
    completed: queue.filter((item) => item.status === "complete").length,
    errored: queue.filter((item) => item.status === "error").length,
    total: queue.length,
  };

  // Process next item for a specific worker (uses refs to avoid stale closures)
  const processNextForWorker = useCallback(
    (workerId: number) => {
      const workerState = workersRef.current.find((w) => w.workerId === workerId);
      if (!workerState || !workerState.isReady || workerState.currentTaskId) return;

      // Use ref to get latest queue
      const currentQueue = queueRef.current;

      // Find next queued task assigned to this worker
      // Also exclude tasks already running in the browser — queueRef is stale
      // until React re-renders, so status may still read 'queued'.
      const nextItem = currentQueue.find(
        (item) =>
          item.status === "queued" &&
          taskWorkerMapRef.current.get(item.id) === workerId &&
          !browserRunningTasksRef.current.has(item.id)
      );

      if (!nextItem) return;

      workerState.currentTaskId = nextItem.id;
      workerState.pendingTaskIds.delete(nextItem.id);

      // Update status to running
      setQueue((prev) =>
        prev.map((item) =>
          item.id === nextItem.id
            ? { ...item, status: "running" as const, startedAt: Date.now() }
            : item
        )
      );

      // Build task payload — strip runtime-only fields via rest destructuring
      /* eslint-disable @typescript-eslint/no-unused-vars, sonarjs/no-unused-vars, sonarjs/no-dead-store */
      const {
        status: _status,
        queuedAt: _queuedAt,
        startedAt: _startedAt,
        completedAt: _completedAt,
        result: _result,
        error: _error,
        debug: _debug,
        estimatedCost: _estimatedCost,
        ...taskPayload
      } = nextItem;
      /* eslint-enable @typescript-eslint/no-unused-vars, sonarjs/no-unused-vars, sonarjs/no-dead-store */
      const latestLlmSettings = getResolvedLLMCallSettings();
      if (configRef.current) {
        configRef.current = { ...configRef.current, llmCallSettings: latestLlmSettings };
      }
      const task: WorkerTask = {
        ...taskPayload,
        projectId: projectIdRef.current || "unknown",
        llmCallSettings: latestLlmSettings,
      };

      // Check if this task should run in the browser instead of the service worker
      if (shouldRunInBrowser(task.type, latestLlmSettings) && configRef.current) {
        // Release the worker slot — this task runs in the main thread
        workerState.currentTaskId = null;
        browserRunningTasksRef.current.add(nextItem.id);

        console.log("[EnrichmentQueue] Executing in browser", { taskId: task.id, type: task.type });

        // Initialize thinking entry (same as 'started' message handler)
        useThinkingStore.getState().startTask(task.id, nextItem.entityName, nextItem.type);

        void executeBrowserTask(task, configRef.current, {
          onThinkingDelta: (taskId, delta) =>
            useThinkingStore.getState().appendDelta(taskId, delta),
          onTextDelta: (taskId, delta) =>
            useThinkingStore.getState().appendTextDelta(taskId, delta),
        }).then((taskResult) => {
          browserRunningTasksRef.current.delete(task.id);
          taskWorkerMapRef.current.delete(task.id);
          if (taskResult.success) {
            setQueue(patchQueueItem(task.id, {
              status: "complete" as const,
              completedAt: Date.now(),
              result: taskResult.result,
              debug: taskResult.debug,
            }));
            if (taskResult.result) {
              const queueItem = queueRef.current.find((item) => item.id === task.id);
              const isChronicleImage = queueItem?.imageType === "chronicle";
              if (!isChronicleImage) {
                const output = applyEnrichmentResult(
                  {},
                  task.type,
                  taskResult.result,
                  queueItem?.entityLockedSummary
                );
                onEntityUpdateRef.current(task.entityId, output);
              }
            }
          } else {
            setQueue(patchQueueItem(task.id, {
              status: "error" as const,
              completedAt: Date.now(),
              error: taskResult.error,
              debug: taskResult.debug,
            }));
          }
          useThinkingStore.getState().finishTask(task.id);
          // Process next tasks — browser execution freed this worker
          setTimeout(() => processNextForWorker(workerId), 0);
        });

        // Process next task for this worker immediately (it's not blocked)
        setTimeout(() => processNextForWorker(workerId), 0);
        return;
      }

      workerState.worker.postMessage({ type: "execute", task });
    },
    [] // No dependencies - uses refs
  );

  // Handle worker messages (uses refs to avoid stale closures)
  const handleMessage = useCallback(
    (workerId: number) => (event: MessageEvent<WorkerOutbound>) => {
      const message = event.data;
      const workerState = workersRef.current.find((w) => w.workerId === workerId);

      switch (message.type) {
        case "ready":
          if (workerState) {
            workerState.isReady = true;
          }
          // Check if all workers are ready
          if (workersRef.current.every((w) => w.isReady)) {
            setIsWorkerReady(true);
          }
          break;

        case "started": {
          // Already updated status when we sent the task
          // Initialize thinking entry for this task
          const startedItem = queueRef.current.find((item) => item.id === message.taskId);
          if (startedItem) {
            useThinkingStore
              .getState()
              .startTask(message.taskId, startedItem.entityName, startedItem.type);
          }
          break;
        }

        case "thinking_delta":
          useThinkingStore.getState().appendDelta(message.taskId, message.delta);
          break;

        case "text_delta":
          useThinkingStore.getState().appendTextDelta(message.taskId, message.delta);
          break;

        case "complete": {
          const result = message.result;

          if (workerState) {
            workerState.currentTaskId = null;
          }

          autoReconnectAttemptsRef.current.delete(result.id);
          pendingAutoRetryRef.current.delete(result.id);

          // Clean up task-worker mapping
          taskWorkerMapRef.current.delete(result.id);

          // Worker already saved image to IndexedDB, just update queue and notify parent
          setQueue(patchQueueItem(result.id, {
            status: "complete" as const,
            completedAt: Date.now(),
            result: result.result,
            debug: result.debug,
          }));

          // Notify parent to update entity (skip for chronicle images - they have their own storage)
          if (result.result) {
            const queueItem = queueRef.current.find((item) => item.id === result.id);
            const isChronicleImage = queueItem?.imageType === "chronicle";
            if (!isChronicleImage) {
              const output = applyEnrichmentResult(
                {},
                result.type,
                result.result,
                queueItem?.entityLockedSummary
              );
              onEntityUpdateRef.current(result.entityId, output);
            }
          }

          useThinkingStore.getState().finishTask(result.id);

          // Process next task for this worker
          setTimeout(() => processNextForWorker(workerId), 0);
          break;
        }

        case "error": {
          if (workerState) {
            workerState.currentTaskId = null;
          }

          // Clean up task-worker mapping
          taskWorkerMapRef.current.delete(message.taskId);

          setQueue(patchQueueItem(message.taskId, {
            status: "error" as const,
            completedAt: Date.now(),
            error: message.error,
            debug: message.debug,
          }));

          useThinkingStore.getState().finishTask(message.taskId);

          if (message.error?.includes("Worker not initialized")) {
            const attempts = autoReconnectAttemptsRef.current.get(message.taskId) || 0;
            if (attempts < MAX_AUTO_RECONNECT_ATTEMPTS) {
              autoReconnectAttemptsRef.current.set(message.taskId, attempts + 1);
              pendingAutoRetryRef.current.add(message.taskId);
              if (workerState) {
                workerState.isReady = false;
              }
              const config = configRef.current;
              if (config && !reconnectInProgressRef.current) {
                reconnectInProgressRef.current = true;
                resetWorkerPool();
                initializeRef.current?.(config);
              }
            }
          }

          // Process next task for this worker
          setTimeout(() => processNextForWorker(workerId), 0);
          break;
        }
      }
    },
    [processNextForWorker] // Only depends on processNextForWorker (which has no deps)
  );

  // Process queue when it changes - try to start work on idle workers
  useEffect(() => {
    if (!isWorkerReady) return;

    // For each idle worker, try to process next task
    for (const workerState of workersRef.current) {
      if (workerState.isReady && !workerState.currentTaskId) {
        processNextForWorker(workerState.workerId);
      }
    }
  }, [queue, isWorkerReady, processNextForWorker]);

  // Cleanup workers on unmount
  useEffect(() => {
    return () => {
      for (const workerState of workersRef.current) {
        if (workerState.worker.type === "dedicated") {
          workerState.worker.terminate();
        }
      }
      workersRef.current = [];
    };
  }, []);

  // Initialize workers (SharedWorker with fallback to dedicated Worker)
  const initialize = useCallback(
    (config: WorkerConfig) => {
      // Terminate existing workers
      for (const workerState of workersRef.current) {
        if (workerState.worker.type === "dedicated") {
          workerState.worker.terminate();
        }
      }
      workersRef.current = [];
      taskWorkerMapRef.current.clear();

      configRef.current = config;
      numWorkersRef.current = config.numWorkers || 4;
      setIsWorkerReady(false);

      // Create new workers using factory (SharedWorker with fallback)
      const workers = createWorkerPool(config, numWorkersRef.current);
      for (let i = 0; i < workers.length; i++) {
        const worker = workers[i];

        const workerState: WorkerState = {
          worker,
          workerId: i,
          isReady: false,
          currentTaskId: null,
          pendingTaskIds: new Set(),
        };

        worker.onmessage = handleMessage(i);

        worker.onerror = (error) => {
          console.error(`Worker ${i} error:`, error);
          const failedTaskId = workerState.currentTaskId;
          if (failedTaskId) {
            taskWorkerMapRef.current.delete(failedTaskId);
            setQueue(patchQueueItem(failedTaskId, {
              status: "error" as const,
              completedAt: Date.now(),
              error: error.message || "Worker error",
            }));
          }
          workerState.currentTaskId = null;
          setTimeout(() => processNextForWorker(workerState.workerId), 0);
        };

        workersRef.current.push(workerState);
        // Note: createWorker already sends init message
      }

      const queuedItems = queueRef.current.filter((item) => item.status === "queued");
      for (const item of queuedItems) {
        const leastBusyWorker = findLeastBusyWorker(workersRef.current, queueRef.current);
        if (leastBusyWorker) {
          taskWorkerMapRef.current.set(item.id, leastBusyWorker.workerId);
          leastBusyWorker.pendingTaskIds.add(item.id);
        } else {
          taskWorkerMapRef.current.set(item.id, 0);
          if (workersRef.current[0]) {
            workersRef.current[0].pendingTaskIds.add(item.id);
          }
        }
      }
    },
    [handleMessage]
  );

  useEffect(() => {
    initializeRef.current = initialize;
  }, [initialize]);

  // Enqueue items - distribute to workers based on estimated workload
  const enqueue = useCallback(
    (items: EnqueueItem[]) => {
      const runId = simulationRunIdRef.current;
      if (!runId) {
        console.error("[EnrichmentQueue] simulationRunId is required to enqueue tasks.");
        return;
      }

      const newItems: QueueItem[] = [];
      const currentQueue = queueRef.current;

      for (const item of items) {
        const { entity, ...taskFields } = item;
        const queueItem: QueueItem = {
          id: `${item.type}_${entity.id}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
          entityId: entity.id,
          entityName: entity.name,
          entityKind: entity.kind,
          entitySubtype: entity.subtype,
          entityCulture: entity.culture,
          entityLockedSummary: entity.lockedSummary,
          entityLockedSummaryText:
            entity.lockedSummary && entity.summary ? entity.summary : undefined,
          entityNarrativeHintText: entity.narrativeHint,
          ...taskFields,
          simulationRunId: runId,
          status: "queued" as const,
          queuedAt: Date.now(),
        };

        // Find the least busy worker and assign this task
        const leastBusyWorker = findLeastBusyWorker(workersRef.current, [
          ...currentQueue,
          ...newItems,
        ]);
        if (leastBusyWorker) {
          taskWorkerMapRef.current.set(queueItem.id, leastBusyWorker.workerId);
          leastBusyWorker.pendingTaskIds.add(queueItem.id);
        } else {
          // No ready workers - assign to worker 0 by default
          taskWorkerMapRef.current.set(queueItem.id, 0);
          if (workersRef.current[0]) {
            workersRef.current[0].pendingTaskIds.add(queueItem.id);
          }
        }

        newItems.push(queueItem);
      }

      setQueue((prev) => [...prev, ...newItems]);
    },
    [] // No dependencies - uses refs
  );

  // Cancel a specific item
  const cancel = useCallback((itemId: string) => {
    setQueue((prev) => {
      const item = prev.find((i) => i.id === itemId);
      if (!item) return prev;

      const workerId = taskWorkerMapRef.current.get(itemId);

      // If running, abort the worker (include taskId for SharedWorker)
      if (item.status === "running" && workerId !== undefined) {
        const workerState = workersRef.current.find((w) => w.workerId === workerId);
        if (workerState) {
          workerState.worker.postMessage({ type: "abort", taskId: itemId });
          workerState.currentTaskId = null;
        }
      }

      // Clean up tracking
      taskWorkerMapRef.current.delete(itemId);
      for (const ws of workersRef.current) {
        ws.pendingTaskIds.delete(itemId);
      }

      // Remove from queue
      return prev.filter((i) => i.id !== itemId);
    });
  }, []);

  // Cancel all
  const cancelAll = useCallback(() => {
    for (const workerState of workersRef.current) {
      // Abort each running task on this worker
      if (workerState.currentTaskId) {
        workerState.worker.postMessage({ type: "abort", taskId: workerState.currentTaskId });
      }
      workerState.currentTaskId = null;
      workerState.pendingTaskIds.clear();
    }
    taskWorkerMapRef.current.clear();
    setQueue([]);
  }, []);

  // Retry errored item
  const retry = useCallback((itemId: string) => {
    setQueue((prev) => {
      const item = prev.find((i) => i.id === itemId);
      if (!item || item.status !== "error") return prev;

      // Reassign to least busy worker (use prev instead of ref since we're inside setQueue)
      const leastBusyWorker = findLeastBusyWorker(workersRef.current, prev);
      if (leastBusyWorker) {
        taskWorkerMapRef.current.set(itemId, leastBusyWorker.workerId);
        leastBusyWorker.pendingTaskIds.add(itemId);
      } else {
        taskWorkerMapRef.current.set(itemId, 0);
        if (workersRef.current[0]) {
          workersRef.current[0].pendingTaskIds.add(itemId);
        }
      }

      return prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              status: "queued" as const,
              error: undefined,
              debug: undefined,
              queuedAt: Date.now(),
            }
          : i
      );
    });
  }, []);

  useEffect(() => {
    if (!isWorkerReady) return;

    if (pendingAutoRetryRef.current.size > 0) {
      const taskIds = Array.from(pendingAutoRetryRef.current);
      pendingAutoRetryRef.current.clear();
      for (const taskId of taskIds) {
        retry(taskId);
      }
    }

    reconnectInProgressRef.current = false;
  }, [isWorkerReady, retry]);

  // Clear completed items
  const clearCompleted = useCallback(() => {
    setQueue((prev) => {
      const completedIds = prev.filter((item) => item.status === "complete").map((i) => i.id);
      for (const id of completedIds) {
        taskWorkerMapRef.current.delete(id);
      }
      return prev.filter((item) => item.status !== "complete");
    });
  }, []);

  // Get updated entity with enrichment from queue results
  const getUpdatedEntity = useCallback(
    (entity: EnrichedEntity): EnrichedEntity => {
      const completedItems = queue.filter(
        (item) => item.entityId === entity.id && item.status === "complete" && item.result
      );

      if (completedItems.length === 0) return entity;

      let result = { ...entity };
      for (const item of completedItems) {
        if (item.result) {
          const output = applyEnrichmentResult(
            { enrichment: result.enrichment },
            item.type,
            item.result,
            entity.lockedSummary
          );
          result = {
            ...result,
            enrichment: output.enrichment,
            // Apply entity field updates from text enrichment
            ...(output.summary !== undefined && { summary: output.summary }),
            ...(output.description !== undefined && { description: output.description }),
          };
        }
      }

      return result;
    },
    [queue]
  );

  return {
    queue,
    isWorkerReady,
    stats,
    initialize,
    enqueue,
    cancel,
    cancelAll,
    retry,
    clearCompleted,
    getUpdatedEntity,
  };
}
