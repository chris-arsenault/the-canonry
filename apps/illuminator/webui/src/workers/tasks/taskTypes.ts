import type { WorkerTask } from "../../lib/enrichmentTypes";
import type { LLMClient } from "../../lib/llmClient";
import type { ImageClient } from "../../lib/imageClient";
import type { TaskResult, WorkerConfig } from "../types";

export interface TaskContext {
  config: WorkerConfig;
  llmClient: LLMClient;
  imageClient: ImageClient;
  isAborted: () => boolean;
  /** Callback to forward thinking deltas to the UI */
  onThinkingDelta?: (delta: string) => void;
  /** Callback to forward text deltas to the UI */
  onTextDelta?: (delta: string) => void;
}

export interface TaskHandler<TTask extends WorkerTask = WorkerTask> {
  type: TTask["type"];
  execute: (task: TTask, context: TaskContext) => Promise<TaskResult>;
}

export type TaskHandlerMap = {
  [K in WorkerTask["type"]]: TaskHandler<Extract<WorkerTask, { type: K }>>;
};
