/**
 * Types for the browser LLM client.
 */

export interface LLMConfig {
  enabled: boolean;
  model: string;
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

export interface LLMRequest {
  systemPrompt: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  /** Enable extended thinking with budget in tokens (Sonnet/Opus only) */
  thinkingBudget?: number;
  /** Callback for streaming thinking deltas — called on every thinking chunk */
  onThinkingDelta?: (delta: string) => void;
  /** Callback for streaming text deltas — called on every text chunk */
  onTextDelta?: (delta: string) => void;
  /** SSE read timeout in seconds. 0 = no timeout. When set, each reader.read() races against this. */
  streamTimeout?: number;
  /** When true, bypass SSE streaming — use a single JSON request/response. */
  disableStreaming?: boolean;
}

export interface NetworkDebugInfo {
  request: string;
  response?: string;
  meta?: {
    provider?: "anthropic" | "openai";
    status?: number;
    statusText?: string;
    durationMs?: number;
    requestId?: string;
    rateLimit?: Record<string, string>;
  };
}

export interface LLMResult {
  text: string;
  cached: boolean;
  skipped?: boolean;
  error?: string;
  debug?: NetworkDebugInfo;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Accumulated thinking text from extended thinking (if enabled) */
  thinking?: string;
}

export interface CallLogEntry {
  callNumber: number;
  timestamp: string;
  request: {
    model: string;
    maxTokens: number;
    temperature?: number;
    topP?: number;
    systemPrompt: string;
    userPrompt: string;
  };
  response?: {
    text: string;
    length: number;
  };
  error?: string;
  attempt: number;
}

/** Resolved sampling parameters after mutual-exclusion checks. */
export interface ResolvedSampling {
  useThinking: boolean;
  maxTokens: number;
  temperature?: number;
  topP?: number;
}

/** Shape of a content block in the Anthropic Messages API response. */
export interface AnthropicContentBlock {
  type?: string;
  thinking?: string;
  text?: string;
}

/** Shape of the Anthropic Messages API JSON response. */
export interface AnthropicMessageResponse {
  content?: AnthropicContentBlock[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

/** Accumulated SSE state during stream consumption. */
export interface SSEStreamState {
  text: string;
  thinking: string;
  inputTokens: number;
  outputTokens: number;
  hasUsage: boolean;
}

/** Result of consuming either a JSON response or an SSE stream. */
export interface StreamResult {
  text: string;
  thinking: string;
  usage: { inputTokens: number; outputTokens: number } | undefined;
  rawResponse: string;
}
