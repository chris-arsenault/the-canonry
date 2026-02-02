/**
 * Enrichment SharedWorker
 *
 * SharedWorker version that persists across page navigations within the same origin.
 * Falls back to regular Worker if SharedWorker is not supported.
 *
 * SharedWorkers use a port-based communication model:
 * - Each tab/window that connects gets its own MessagePort
 * - The worker maintains state across all connections
 * - Work in progress survives page navigations (within same origin)
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

// SharedWorker context
const ctx = self as unknown as SharedWorkerGlobalScope;

// ============================================================================
// State
// ============================================================================

let config: WorkerConfig | null = null;
let llmClient: LLMClient | null = null;
let imageClient: ImageClient | null = null;

// Track active tasks and their originating ports
const activeTasks = new Map<string, { port: MessagePort; aborted: boolean }>();

// Track all connected ports
const connectedPorts = new Set<MessagePort>();

function safePostMessage(port: MessagePort, message: WorkerOutbound): void {
  try {
    port.postMessage(message);
  } catch (err) {
    connectedPorts.delete(port);
  }
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
    console.warn('[SharedWorker] Failed to persist to Dexie:', err);
  }
}

// ============================================================================
// Task Execution
// ============================================================================

async function executeTask(task: WorkerTask, port: MessagePort): Promise<void> {
  const taskState = activeTasks.get(task.id);
  const checkAborted = () => taskState?.aborted ?? false;

  safePostMessage(port, { type: 'started', taskId: task.id });

  try {
    let result;

    result = await executeEnrichmentTask(task, {
      config: config!,
      llmClient: llmClient!,
      imageClient: imageClient!,
      isAborted: checkAborted,
    });

    if (!result.success) {
      safePostMessage(port, {
        type: 'error',
        taskId: task.id,
        error: result.error || 'Unknown error',
        debug: result.debug,
      });
      return;
    }

    await persistResult(task, result.result);

    safePostMessage(port, {
      type: 'complete',
      result: {
        id: task.id,
        entityId: task.entityId,
        type: task.type,
        success: true,
        result: result.result,
        debug: result.debug,
      },
    });
  } catch (error) {
    safePostMessage(port, {
      type: 'error',
      taskId: task.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    activeTasks.delete(task.id);
  }
}

// ============================================================================
// Connection Handler
// ============================================================================

ctx.onconnect = (event: MessageEvent) => {
  const port = event.ports[0];
  connectedPorts.add(port);

  port.onmessage = async (e: MessageEvent<WorkerInbound>) => {
    const message = e.data;

    switch (message.type) {
      case 'init': {
        config = message.config;
        console.log('[SharedWorker] Init - LLM call settings:', config.llmCallSettings);
        const clients = createClients(config);
        llmClient = clients.llmClient;
        imageClient = clients.imageClient;
        safePostMessage(port, { type: 'ready' });
        break;
      }

      case 'execute': {
        if (!config) {
          safePostMessage(port, {
            type: 'error',
            taskId: message.task.id,
            error: 'Worker not initialized - call init first',
          });
          break;
        }

        activeTasks.set(message.task.id, { port, aborted: false });
        executeTask(message.task, port);
        break;
      }

      case 'abort': {
        if (message.taskId) {
          const taskState = activeTasks.get(message.taskId);
          if (taskState) {
            taskState.aborted = true;
            safePostMessage(port, {
              type: 'error',
              taskId: message.taskId,
              error: 'Task aborted by user',
            });
          }
        }
        break;
      }
    }
  };

  port.onmessageerror = () => {
    connectedPorts.delete(port);
  };

  port.start();
};

export type { WorkerTask, WorkerResult, EnrichmentResult, EnrichmentType };
