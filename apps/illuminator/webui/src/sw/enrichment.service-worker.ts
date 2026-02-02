/**
 * Enrichment Service Worker
 *
 * Executes enrichment tasks outside the page lifecycle so work continues
 * across full reloads/HMR and results persist to IndexedDB.
 */

import type { EnrichmentType, WorkerTask, WorkerResult, EnrichmentResult } from '../lib/enrichmentTypes';
import {
  type WorkerConfig,
  type WorkerInbound,
  type WorkerOutbound,
  createClients,
  executeTask as executeEnrichmentTask,
} from '../workers/enrichmentCore';
import type { LLMClient } from '../lib/llmClient';
import type { ImageClient } from '../lib/imageClient';
import * as entityRepo from '../lib/db/entityRepository';

const ctx = self as unknown as ServiceWorkerGlobalScope;

type ServiceWorkerMessage =
  | ({ type: 'connect'; handleId: string })
  | ({ handleId: string } & WorkerInbound);

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_PREFIX = '[ServiceWorker]';

function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  const logger = console[level] || console.log;
  if (data) {
    logger(`${LOG_PREFIX} ${message}`, data);
  } else {
    logger(`${LOG_PREFIX} ${message}`);
  }
}

function summarizeTask(task: WorkerTask): Record<string, unknown> {
  return {
    id: task.id,
    type: task.type,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    entitySubtype: task.entitySubtype,
    entityCulture: task.entityCulture,
    simulationRunId: task.simulationRunId,
    imageType: task.imageType,
    chronicleId: task.chronicleId,
    imageRefId: task.imageRefId,
    promptChars: task.prompt?.length,
  };
}

// ============================================================================
// State
// ============================================================================

let config: WorkerConfig | null = null;
let llmClient: LLMClient | null = null;
let imageClient: ImageClient | null = null;

const handlePorts = new Map<string, MessagePort>();
const pendingReady = new Set<string>();
const activeTasks = new Map<string, { handleId: string; aborted: boolean }>();
const handleClients = new Map<string, string>();

// ============================================================================
// Lifecycle
// ============================================================================

ctx.addEventListener('install', (event) => {
  log('info', 'Install');
  event.waitUntil(ctx.skipWaiting());
});

ctx.addEventListener('activate', (event) => {
  log('info', 'Activate');
  event.waitUntil(ctx.clients.claim());
});

// ============================================================================
// Helpers
// ============================================================================

function rememberClient(handleId: string, source: Client | null | undefined): void {
  if (!source || typeof (source as Client).id !== 'string') return;
  handleClients.set(handleId, (source as Client).id);
}

async function postToClient(handleId: string, message: WorkerOutbound): Promise<void> {
  const clientId = handleClients.get(handleId);
  if (!clientId) {
    log('warn', 'Fallback post skipped - no clientId for handle', { handleId, messageType: message.type });
    return;
  }
  const client = await ctx.clients.get(clientId);
  if (!client) {
    log('warn', 'Fallback post skipped - client not found', { handleId, clientId, messageType: message.type });
    return;
  }
  client.postMessage({ ...message, handleId, via: 'service-worker-fallback' });
  log('debug', 'Fallback post sent', { handleId, messageType: message.type });
}

function safePostMessage(handleId: string, message: WorkerOutbound): void {
  const port = handlePorts.get(handleId);
  if (!port) {
    log('warn', 'PostMessage skipped - no port for handle', { handleId, messageType: message.type });
    void postToClient(handleId, message);
    return;
  }

  try {
    port.postMessage(message);
  } catch {
    handlePorts.delete(handleId);
    log('warn', 'PostMessage failed - port removed', { handleId, messageType: message.type });
    void postToClient(handleId, message);
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
    log('error', 'Persist to Dexie failed', {
      taskId: task.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ============================================================================
// Task Execution
// ============================================================================

async function executeTask(task: WorkerTask, handleId: string): Promise<void> {
  const taskState = activeTasks.get(task.id);
  const checkAborted = () => taskState?.aborted ?? false;

  log('info', 'Task started', summarizeTask(task));
  safePostMessage(handleId, { type: 'started', taskId: task.id });

  try {
    const result = await executeEnrichmentTask(task, {
      config: config!,
      llmClient: llmClient!,
      imageClient: imageClient!,
      isAborted: checkAborted,
    });

    if (!result.success) {
      log('warn', 'Task failed', {
        taskId: task.id,
        error: result.error || 'Unknown error',
        debugMeta: result.debug?.meta,
      });
      safePostMessage(handleId, {
        type: 'error',
        taskId: task.id,
        error: result.error || 'Unknown error',
        debug: result.debug,
      });
      return;
    }

    await persistResult(task, result.result);

    log('info', 'Task complete', {
      taskId: task.id,
      type: task.type,
    });
    safePostMessage(handleId, {
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
    log('error', 'Task execution threw', {
      taskId: task.id,
      error: error instanceof Error ? error.message : String(error),
    });
    safePostMessage(handleId, {
      type: 'error',
      taskId: task.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    activeTasks.delete(task.id);
    log('debug', 'Task cleared', { taskId: task.id, activeCount: activeTasks.size });
  }
}

// ============================================================================
// Message Handling
// ============================================================================

function handleInit(handleId: string, nextConfig: WorkerConfig): void {
  config = nextConfig;
  log('info', 'Init', {
    handleId,
    llmEnabled: Boolean(config.anthropicApiKey),
    imageEnabled: Boolean(config.openaiApiKey),
    numWorkers: config.numWorkers,
    llmCallSettings: config.llmCallSettings,
  });
  const clients = createClients(config);
  llmClient = clients.llmClient;
  imageClient = clients.imageClient;

  if (handlePorts.has(handleId)) {
    safePostMessage(handleId, { type: 'ready' });
  } else {
    pendingReady.add(handleId);
    log('debug', 'Init pending - no port yet', { handleId });
  }
}

function handleAbort(handleId: string, taskId?: string): void {
  if (!taskId) return;
  const taskState = activeTasks.get(taskId);
  if (taskState) {
    taskState.aborted = true;
    log('info', 'Task abort requested', { handleId, taskId });
    safePostMessage(handleId, {
      type: 'error',
      taskId,
      error: 'Task aborted by user',
    });
  } else {
    log('warn', 'Abort requested for unknown task', { handleId, taskId });
  }
}

ctx.addEventListener('message', (event) => {
  const message = event.data as ServiceWorkerMessage | undefined;
  if (!message || typeof message !== 'object' || !('type' in message)) return;

  if (message.type === 'connect') {
    const handleId = message.handleId;
    const port = event.ports[0];
    if (handleId && port) {
      handlePorts.set(handleId, port);
      port.start();
      rememberClient(handleId, event.source as Client | null);
      log('info', 'Client connected', { handleId });
      if (pendingReady.has(handleId)) {
        pendingReady.delete(handleId);
        safePostMessage(handleId, { type: 'ready' });
        log('debug', 'Ready sent to connected client', { handleId });
      }
    } else {
      log('warn', 'Connect message missing handle or port', { handleId });
    }
    return;
  }

  if (!('handleId' in message) || !message.handleId) return;
  const handleId = message.handleId;
  rememberClient(handleId, event.source as Client | null);

  switch (message.type) {
    case 'init':
      event.waitUntil(Promise.resolve(handleInit(handleId, message.config)));
      break;

    case 'execute':
      if (!config) {
        log('warn', 'Execute before init', { handleId, taskId: message.task.id });
        safePostMessage(handleId, {
          type: 'error',
          taskId: message.task.id,
          error: 'Worker not initialized - call init first',
        });
        return;
      }
      log('debug', 'Execute received', summarizeTask(message.task));
      activeTasks.set(message.task.id, { handleId, aborted: false });
      event.waitUntil(executeTask(message.task, handleId));
      break;

    case 'abort':
      log('debug', 'Abort received', { handleId, taskId: message.taskId });
      event.waitUntil(Promise.resolve(handleAbort(handleId, message.taskId)));
      break;
  }
});

export type { WorkerTask, WorkerResult, EnrichmentResult, EnrichmentType };
