/**
 * Enrichment Worker - Single Task Executor with Direct Persistence
 *
 * This worker executes enrichment tasks AND persists images directly to IndexedDB.
 * By persisting in the worker (before notifying main thread), we minimize data loss
 * when users navigate away mid-operation.
 *
 * Flow:
 * 1. Receive task from main thread
 * 2. Make API call
 * 3. For images: save blob to IndexedDB immediately
 * 4. Notify main thread of completion (with imageId, not blob)
 *
 * Messages:
 * - init: Set up API clients with keys and config
 * - execute: Run a single enrichment task
 * - abort: Cancel current task (if possible)
 */

import type { EnrichmentType, WorkerTask, WorkerResult, EnrichmentResult } from '../lib/enrichmentTypes';
import {
  type WorkerConfig,
  type WorkerInbound,
  type WorkerOutbound,
  createClients,
  executeTask as executeEnrichmentTask,
} from './enrichmentCore';
import type { LLMClient } from '../lib/llmClient';
import type { ImageClient } from '../lib/imageClient';
import * as entityRepo from '../lib/db/entityRepository';

// Worker context
const ctx: Worker = self as unknown as Worker;

// ============================================================================
// State
// ============================================================================

let config: WorkerConfig | null = null;
let llmClient: LLMClient | null = null;
let imageClient: ImageClient | null = null;
let currentTaskId: string | null = null;
let isAborted = false;

// ============================================================================
// Helpers
// ============================================================================

function emit(message: WorkerOutbound): void {
  ctx.postMessage(message);
}

async function persistResult(task: WorkerTask, result?: EnrichmentResult): Promise<void> {
  if (!result || !task.entityId) return;

  try {
    if (task.type === 'description' && result.description) {
      await entityRepo.applyDescriptionResult(task.entityId, {
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
      }, result.summary, result.description);
    } else if (task.type === 'image' && result.imageId && task.imageType !== 'chronicle') {
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
    } else if (task.type === 'entityChronicle' && result.chronicleId) {
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
    console.warn('[Worker] Failed to persist to Dexie:', err);
  }
}

// ============================================================================
// Task Execution
// ============================================================================

async function executeTask(task: WorkerTask): Promise<WorkerResult> {
  currentTaskId = task.id;
  isAborted = false;

  emit({ type: 'started', taskId: task.id });

  const checkAborted = () => isAborted;

  try {
    let result;

    result = await executeEnrichmentTask(task, {
      config: config!,
      llmClient: llmClient!,
      imageClient: imageClient!,
      isAborted: checkAborted,
    });

    if (!result.success) {
      return {
        id: task.id,
        entityId: task.entityId,
        type: task.type,
        success: false,
        error: result.error,
        debug: result.debug,
      };
    }

    return {
      id: task.id,
      entityId: task.entityId,
      type: task.type,
      success: true,
      result: result.result,
      debug: result.debug,
    };
  } catch (error) {
    return {
      id: task.id,
      entityId: task.entityId,
      type: task.type,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    currentTaskId = null;
  }
}

// ============================================================================
// Message Handler
// ============================================================================

ctx.onmessage = async (event: MessageEvent<WorkerInbound>) => {
  const message = event.data;

  switch (message.type) {
    case 'init': {
      config = message.config;
      console.log('[Worker] Init - LLM call settings:', config.llmCallSettings);
      const clients = createClients(config);
      llmClient = clients.llmClient;
      imageClient = clients.imageClient;
      emit({ type: 'ready' });
      break;
    }

    case 'execute': {
      if (!config) {
        emit({
          type: 'error',
          taskId: message.task.id,
          error: 'Worker not initialized - call init first',
        });
        break;
      }

      const result = await executeTask(message.task);

      if (result.success) {
        await persistResult(message.task, result.result);
        emit({ type: 'complete', result });
      } else {
        emit({
          type: 'error',
          taskId: result.id,
          error: result.error || 'Unknown error',
          debug: result.debug,
        });
      }
      break;
    }

    case 'abort': {
      isAborted = true;
      const taskIdToAbort = message.taskId || currentTaskId;
      if (taskIdToAbort) {
        emit({
          type: 'error',
          taskId: taskIdToAbort,
          error: 'Task aborted by user',
        });
      }
      break;
    }
  }
};

// Re-export types for consumers
export type {
  WorkerTask,
  WorkerResult,
  EnrichmentResult,
  EnrichmentType,
  WorkerConfig,
  WorkerInbound,
  WorkerOutbound,
};
