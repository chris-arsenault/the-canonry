/**
 * Enrichment Service Worker
 *
 * Executes enrichment tasks outside the page lifecycle so work continues
 * across full reloads/HMR and results persist to IndexedDB.
 */

/// <reference lib="webworker" />

import type {
  EnrichmentType,
  WorkerTask,
  WorkerResult,
  EnrichmentResult,
} from "../lib/enrichmentTypes";
import {
  type WorkerConfig,
  type WorkerInbound,
  type WorkerOutbound,
  createClients,
  executeTask as executeEnrichmentTask,
} from "../workers/enrichmentCore";
import type { LLMClient } from "../lib/llmClient";
import type { ImageClient } from "../lib/imageClient";
import * as entityRepo from "../lib/db/entityRepository";

declare const self: ServiceWorkerGlobalScope;

/** Union of possible event.source values per the WebWorker spec. */
type MessageMessageEventSource = Client | ServiceWorker | MessagePort | null;

type ServiceWorkerMessage =
  | { type: "connect"; handleId: string }
  | ({ handleId: string } & WorkerInbound);

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_PREFIX = "[ServiceWorker]";

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
    chronicleMetadataSampling: task.chronicleMetadata?.generationSampling,
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

self.addEventListener("install", (event: ExtendableEvent) => {
  log("info", "Install");
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event: ExtendableEvent) => {
  log("info", "Activate");
  event.waitUntil(self.clients.claim());
});

// ============================================================================
// Message Parsing
// ============================================================================

/**
 * Type guard: validate that raw message data is a ServiceWorkerMessage.
 * The `data` property is `unknown` (narrowed from `any` via the declaration
 * merge in service-worker-types.d.ts). This function validates the shape
 * and narrows the type via a type predicate.
 */
function isServiceWorkerMessage(data: unknown): data is ServiceWorkerMessage {
  return !!data && typeof data === "object" && "type" in data;
}

/**
 * Type guard: check whether a parsed message carries a handleId and inbound
 * worker payload (all non-connect messages).
 */
function isInboundMessage(
  message: ServiceWorkerMessage
): message is { handleId: string } & WorkerInbound {
  return "handleId" in message && typeof message.handleId === "string" && message.handleId !== "";
}

/**
 * Extract the client ID from an event source if available.
 * The source can be MessageEventSource per spec.
 */
function extractClientId(
  source: MessageEventSource
): string | undefined {
  if (!source || !("id" in source) || typeof source.id !== "string") return undefined;
  return source.id;
}

// ============================================================================
// Helpers
// ============================================================================

function rememberClient(
  handleId: string,
  source: MessageEventSource
): void {
  const clientId = extractClientId(source);
  if (clientId) {
    handleClients.set(handleId, clientId);
  }
}

async function postToClient(handleId: string, message: WorkerOutbound): Promise<void> {
  const clientId = handleClients.get(handleId);
  if (!clientId) {
    log("warn", "Fallback post skipped - no clientId for handle", {
      handleId,
      messageType: message.type,
    });
    return;
  }
  const client = await self.clients.get(clientId);
  if (!client) {
    log("warn", "Fallback post skipped - client not found", {
      handleId,
      clientId,
      messageType: message.type,
    });
    return;
  }
  client.postMessage({ ...message, handleId, via: "service-worker-fallback" });
  log("debug", "Fallback post sent", { handleId, messageType: message.type });
}

function safePostMessage(handleId: string, message: WorkerOutbound): void {
  const port = handlePorts.get(handleId);
  if (!port) {
    log("warn", "PostMessage skipped - no port for handle", {
      handleId,
      messageType: message.type,
    });
    void postToClient(handleId, message);
    return;
  }

  try {
    port.postMessage(message);
  } catch {
    handlePorts.delete(handleId);
    log("warn", "PostMessage failed - port removed", { handleId, messageType: message.type });
    void postToClient(handleId, message);
  }
}

// ============================================================================
// Persist Helpers (extracted from persistResult to reduce complexity)
// ============================================================================

async function persistDescriptionResult(
  entityId: string,
  result: EnrichmentResult
): Promise<void> {
  await entityRepo.applyDescriptionResult(
    entityId,
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
}

async function persistImageResult(entityId: string, result: EnrichmentResult): Promise<void> {
  if (!result.imageId) return;
  await entityRepo.applyImageResult(entityId, {
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
}

async function persistChronicleResult(
  entityId: string,
  result: EnrichmentResult
): Promise<void> {
  if (!result.chronicleId) return;
  await entityRepo.applyEntityChronicleResult(entityId, {
    chronicleId: result.chronicleId,
    generatedAt: result.generatedAt,
    model: result.model,
    estimatedCost: result.estimatedCost,
    actualCost: result.actualCost,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });
}

function shouldPersistImage(task: WorkerTask, result: EnrichmentResult): boolean {
  return task.type === "image" && Boolean(result.imageId) && task.imageType !== "chronicle";
}

async function dispatchPersist(task: WorkerTask, result: EnrichmentResult): Promise<void> {
  if (task.type === "description" && result.description) {
    await persistDescriptionResult(task.entityId, result);
  } else if (shouldPersistImage(task, result)) {
    await persistImageResult(task.entityId, result);
  } else if (task.type === "entityChronicle" && result.chronicleId) {
    await persistChronicleResult(task.entityId, result);
  }
}

async function persistResult(task: WorkerTask, result?: EnrichmentResult): Promise<void> {
  if (!result || !task.entityId) return;

  try {
    await dispatchPersist(task, result);
  } catch (err) {
    log("error", "Persist to Dexie failed", {
      taskId: task.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ============================================================================
// Task Config
// ============================================================================

/**
 * Build the effective WorkerConfig for a task, merging per-task LLM overrides
 * with the global config.
 */
function buildTaskConfig(task: WorkerTask, baseConfig: WorkerConfig): WorkerConfig {
  const perTaskOverrides = task.llmCallSettings;
  if (perTaskOverrides) {
    return { ...baseConfig, llmCallSettings: perTaskOverrides };
  }
  return baseConfig;
}

// ============================================================================
// Task Execution
// ============================================================================

async function executeTask(task: WorkerTask, handleId: string): Promise<void> {
  const taskState = activeTasks.get(task.id);
  const checkAborted = () => taskState?.aborted ?? false;

  log("info", "Task started", summarizeTask(task));
  safePostMessage(handleId, { type: "started", taskId: task.id });

  if (!config || !llmClient || !imageClient) {
    throw new Error("executeTask called before init - config/clients not ready");
  }
  const taskConfig = buildTaskConfig(task, config);
  const currentLlmClient = llmClient;
  const currentImageClient = imageClient;

  const onThinkingDelta = (delta: string) => {
    safePostMessage(handleId, { type: "thinking_delta", taskId: task.id, delta });
  };
  const onTextDelta = (delta: string) => {
    safePostMessage(handleId, { type: "text_delta", taskId: task.id, delta });
  };

  try {
    const result = await executeEnrichmentTask(task, {
      config: taskConfig,
      llmClient: currentLlmClient,
      imageClient: currentImageClient,
      isAborted: checkAborted,
      onThinkingDelta,
      onTextDelta,
    });

    if (!result.success) {
      const errorMessage = result.error || "Unknown error";
      log("warn", "Task failed", {
        taskId: task.id,
        error: errorMessage,
        debugMeta: result.debug?.meta,
      });
      safePostMessage(handleId, {
        type: "error",
        taskId: task.id,
        error: errorMessage,
        debug: result.debug,
      });
      return;
    }

    await persistResult(task, result.result);

    log("info", "Task complete", {
      taskId: task.id,
      type: task.type,
    });
    safePostMessage(handleId, {
      type: "complete",
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
    log("error", "Task execution threw", {
      taskId: task.id,
      error: error instanceof Error ? error.message : String(error),
    });
    safePostMessage(handleId, {
      type: "error",
      taskId: task.id,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    activeTasks.delete(task.id);
    log("debug", "Task cleared", { taskId: task.id, activeCount: activeTasks.size });
  }
}

// ============================================================================
// Message Handling
// ============================================================================

function handleInit(handleId: string, nextConfig: WorkerConfig): void {
  config = nextConfig;
  log("info", "Init", {
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
    safePostMessage(handleId, { type: "ready" });
  } else {
    pendingReady.add(handleId);
    log("debug", "Init pending - no port yet", { handleId });
  }
}

function handleAbort(handleId: string, taskId?: string): void {
  if (!taskId) return;
  const taskState = activeTasks.get(taskId);
  if (taskState) {
    taskState.aborted = true;
    log("info", "Task abort requested", { handleId, taskId });
    safePostMessage(handleId, {
      type: "error",
      taskId,
      error: "Task aborted by user",
    });
  } else {
    log("warn", "Abort requested for unknown task", { handleId, taskId });
  }
}

function handleConnect(
  message: ServiceWorkerMessage,
  ports: ReadonlyArray<MessagePort>,
  source: MessageEventSource
): void {
  const handleId = message.handleId;
  const port: MessagePort | undefined = ports[0];
  if (handleId && port) {
    handlePorts.set(handleId, port);
    port.start();
    rememberClient(handleId, source);
    log("info", "Client connected", { handleId });
    if (pendingReady.has(handleId)) {
      pendingReady.delete(handleId);
      safePostMessage(handleId, { type: "ready" });
      log("debug", "Ready sent to connected client", { handleId });
    }
  } else {
    log("warn", "Connect message missing handle or port", { handleId });
  }
}

function handleExecute(
  handleId: string,
  task: WorkerTask,
  event: ExtendableEvent
): void {
  if (!config) {
    log("warn", "Execute before init", { handleId, taskId: task.id });
    safePostMessage(handleId, {
      type: "error",
      taskId: task.id,
      error: "Worker not initialized - call init first",
    });
    return;
  }
  log("debug", "Execute received", summarizeTask(task));
  activeTasks.set(task.id, { handleId, aborted: false });
  event.waitUntil(executeTask(task, handleId));
}

function handleInboundMessage(
  message: { handleId: string } & WorkerInbound,
  event: ExtendableMessageEvent
): void {
  const handleId = message.handleId;
  rememberClient(handleId, event.source);

  switch (message.type) {
    case "init":
      handleInit(handleId, message.config);
      event.waitUntil(Promise.resolve());
      break;

    case "execute":
      handleExecute(handleId, message.task, event);
      break;

    case "abort":
      log("debug", "Abort received", { handleId, taskId: message.taskId });
      handleAbort(handleId, message.taskId);
      event.waitUntil(Promise.resolve());
      break;

    case "keepalive":
      // Keepalive pings from the main thread create fresh events in the SW
      // event loop, preventing the browser from terminating during long tasks
      // (era narratives with extended thinking can run 5-10+ minutes).
      event.waitUntil(Promise.resolve());
      break;
  }
}

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (!isServiceWorkerMessage(event.data)) return;
  const message = event.data;

  if (message.type === "connect") {
    handleConnect(message, event.ports, event.source);
    return;
  }

  if (!isInboundMessage(message)) return;
  handleInboundMessage(message, event);
});

export type { WorkerTask, WorkerResult, EnrichmentResult, EnrichmentType };
