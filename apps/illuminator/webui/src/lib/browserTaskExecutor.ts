/**
 * browserTaskExecutor — Execute enrichment tasks in the main browser thread.
 *
 * Same execution path as the service worker, but runs inline.
 * Used when a call type has `runInBrowser: true` in its config.
 *
 * Benefits over service worker:
 * - No lifecycle termination risk (the page stays alive)
 * - No SSE streaming needed to keep the worker alive
 * - Simpler debugging (console, network tab, breakpoints all work)
 *
 * Trade-off:
 * - Work does not survive page navigation/reload
 */

import type { WorkerTask, EnrichmentResult } from "./enrichmentTypes";
import type { WorkerConfig, TaskResult } from "../workers/types";
import { createClients } from "../workers/clients";
import { executeTask } from "../workers/tasks";
import * as entityRepo from "./db/entityRepository";

export interface BrowserTaskCallbacks {
  onThinkingDelta?: (taskId: string, delta: string) => void;
  onTextDelta?: (taskId: string, delta: string) => void;
}

/**
 * Persist task results to IndexedDB (same logic as service worker persistResult).
 */
async function persistResult(task: WorkerTask, result?: EnrichmentResult): Promise<void> {
  if (!result || !task.entityId) return;

  try {
    if (task.type === "description" && result.description) {
      await entityRepo.applyDescriptionResult(
        task.entityId,
        {
          text: {
            aliases: result.aliases || [],
            visualThesis: result.visualThesis,
            visualTraits: result.visualTraits || [],
            generatedAt: result.generatedAt,
            model: result.model,
            estimatedCost: result.estimatedCost,
            actualCost: result.actualCost,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            debug: result.debug,
            chainDebug: result.chainDebug,
          },
        },
        result.summary,
        result.description
      );
    } else if (task.type === "image" && result.imageId && task.imageType !== "chronicle") {
      await entityRepo.applyImageResult(task.entityId, {
        imageId: result.imageId,
        generatedAt: result.generatedAt,
        model: result.model,
        revisedPrompt: result.revisedPrompt,
        estimatedCost: result.estimatedCost,
        actualCost: result.actualCost,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        width: result.width,
        height: result.height,
        aspect: result.aspect,
      });
    } else if (task.type === "entityChronicle" && result.chronicleId) {
      await entityRepo.applyEntityChronicleResult(task.entityId, {
        chronicleId: result.chronicleId,
        generatedAt: result.generatedAt,
        model: result.model,
        estimatedCost: result.estimatedCost,
        actualCost: result.actualCost,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      });
    }
  } catch (err) {
    console.error("[BrowserTask] Persist to IndexedDB failed", {
      taskId: task.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Execute an enrichment task in the main browser thread.
 *
 * Returns the same TaskResult shape as the service worker path.
 */
export async function executeBrowserTask(
  task: WorkerTask,
  config: WorkerConfig,
  callbacks?: BrowserTaskCallbacks
): Promise<TaskResult> {
  // Merge task-level llmCallSettings with global config
  const taskConfig = task.llmCallSettings
    ? { ...config, llmCallSettings: task.llmCallSettings }
    : config;

  const { llmClient, imageClient } = createClients(taskConfig);

  console.log("[BrowserTask] Started", { taskId: task.id, type: task.type });

  try {
    const result = await executeTask(task, {
      config: taskConfig,
      llmClient,
      imageClient,
      isAborted: () => false,
      onThinkingDelta: callbacks?.onThinkingDelta
        ? (delta) => callbacks.onThinkingDelta!(task.id, delta)
        : undefined,
      onTextDelta: callbacks?.onTextDelta
        ? (delta) => callbacks.onTextDelta!(task.id, delta)
        : undefined,
    });

    if (result.success) {
      await persistResult(task, result.result);
      console.log("[BrowserTask] Complete", { taskId: task.id, type: task.type });
    } else {
      console.warn("[BrowserTask] Failed", { taskId: task.id, error: result.error });
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[BrowserTask] Threw", { taskId: task.id, error: message });
    return { success: false, error: message };
  }
}
