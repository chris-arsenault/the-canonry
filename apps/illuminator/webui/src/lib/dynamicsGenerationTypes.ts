/**
 * Dynamics Generation Types
 *
 * Multi-turn, human-steered LLM flow for generating world dynamics.
 * Uses IndexedDB as a shared mailbox between the worker (LLM calls)
 * and the main thread (search execution, user feedback).
 */

// =============================================================================
// Run Status Machine
// =============================================================================

export type DynamicsRunStatus =
  | 'pending'                // Created, waiting for first LLM turn
  | 'generating'             // LLM call in progress (worker is running)
  | 'awaiting_review'        // LLM returned proposed dynamics, user needs to review
  | 'complete'               // User accepted final dynamics
  | 'failed';                // Error occurred

// =============================================================================
// Conversation Messages
// =============================================================================

export type DynamicsMessageRole = 'system' | 'assistant' | 'user';

export interface DynamicsMessage {
  role: DynamicsMessageRole;
  content: string;
  timestamp: number;
}

// =============================================================================
// LLM Response Shape
// =============================================================================

export interface ProposedDynamic {
  text: string;
  cultures?: string[];
  kinds?: string[];
  eraOverrides?: Record<string, { text: string; replace: boolean }>;
}

export interface DynamicsLLMResponse {
  /** Current proposed dynamics */
  dynamics: ProposedDynamic[];
  /** Reasoning shown to user */
  reasoning: string;
  /** Whether the LLM considers this complete */
  complete: boolean;
}

// =============================================================================
// Run Record (stored in IndexedDB)
// =============================================================================

export interface DynamicsRun {
  runId: string;
  projectId: string;
  simulationRunId: string;

  status: DynamicsRunStatus;

  /** Full conversation history */
  messages: DynamicsMessage[];

  /** Current proposed dynamics from the LLM */
  proposedDynamics?: ProposedDynamic[];

  /** User feedback text (set by UI before triggering next turn) */
  userFeedback?: string;

  /** Error message if status=failed */
  error?: string;

  /** Cost tracking */
  totalInputTokens: number;
  totalOutputTokens: number;
  totalActualCost: number;

  createdAt: number;
  updatedAt: number;
}
