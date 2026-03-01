/**
 * Browser-compatible LLM Client
 *
 * Adapted from the Node.js version with:
 * - Web Crypto API for cache key generation
 * - Console/memory logging instead of file logging
 * - Fetch API instead of Anthropic SDK
 */

import type {
  LLMConfig, LLMRequest, LLMResult, CallLogEntry, NetworkDebugInfo,
  ResolvedSampling, AnthropicMessageResponse, SSEStreamState, StreamResult,
} from "./llmClient.types";

export type { LLMConfig, LLMRequest, LLMResult, CallLogEntry, NetworkDebugInfo } from "./llmClient.types";

const RATE_LIMIT_HEADER_KEYS = [
  "retry-after",
  "x-ratelimit-limit-requests", "x-ratelimit-remaining-requests",
  "x-ratelimit-reset-requests", "x-ratelimit-limit-tokens",
  "x-ratelimit-remaining-tokens", "x-ratelimit-reset-tokens",
  "anthropic-ratelimit-requests-limit", "anthropic-ratelimit-requests-remaining",
  "anthropic-ratelimit-requests-reset", "anthropic-ratelimit-tokens-limit",
  "anthropic-ratelimit-tokens-remaining", "anthropic-ratelimit-tokens-reset",
];

const REQUEST_ID_HEADER_KEYS = [
  "request-id", "x-request-id", "anthropic-request-id", "openai-request-id",
];

export function extractRateLimitHeaders(headers: Headers): Record<string, string> {
  const info: Record<string, string> = {};
  for (const key of RATE_LIMIT_HEADER_KEYS) {
    const value = headers.get(key);
    if (value) info[key] = value;
  }
  return info;
}

export function extractRequestId(headers: Headers): string | undefined {
  for (const key of REQUEST_ID_HEADER_KEYS) {
    const value = headers.get(key);
    if (value) return value;
  }
  return undefined;
}

function resolveTemperature(request: LLMRequest, configTemp: number | undefined, useThinking: boolean): number {
  return useThinking ? 1 : (request.temperature ?? configTemp ?? 0.4);
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : JSON.stringify(error);
}

function sseMessageStart(parsed: Record<string, unknown>, state: SSEStreamState): false {
  const msg = parsed.message as Record<string, unknown> | undefined;
  const usage = msg?.usage as Record<string, number> | undefined;
  if (usage?.input_tokens) { state.inputTokens = usage.input_tokens; state.hasUsage = true; }
  return false;
}

function sseContentBlockDelta(
  parsed: Record<string, unknown>, state: SSEStreamState,
  onThinkingDelta?: (d: string) => void, onTextDelta?: (d: string) => void,
): false {
  const delta = parsed.delta as Record<string, string> | undefined;
  if (delta?.type === "thinking_delta") { state.thinking += delta.thinking; onThinkingDelta?.(delta.thinking); }
  else if (delta?.type === "text_delta") { state.text += delta.text; onTextDelta?.(delta.text); }
  return false;
}

function sseMessageDelta(parsed: Record<string, unknown>, state: SSEStreamState): false {
  const usage = parsed.usage as Record<string, number> | undefined;
  if (usage?.output_tokens) { state.outputTokens = usage.output_tokens; state.hasUsage = true; }
  return false;
}

function sseErrorEvent(parsed: Record<string, unknown>): Error {
  const err = parsed.error as Record<string, string> | undefined;
  return new Error(`SSE error event: ${err?.message || (parsed.message as string) || JSON.stringify(parsed)}`);
}

export class LLMClient {
  private cache = new Map<string, string>();
  private config: LLMConfig;
  private callsCompleted = 0;
  private callsCreated = 0;
  private callLog: CallLogEntry[] = [];

  constructor(config: LLMConfig) {
    this.config = {
      ...config,
      model: (config.model || "claude-sonnet-4-6").trim(),
      apiKey: (config.apiKey || "").trim(),
    };
  }

  public isEnabled(): boolean {
    return Boolean(this.config.enabled && this.config.apiKey);
  }

  private resolveSampling(request: LLMRequest): ResolvedSampling {
    const useThinking = Boolean(request.thinkingBudget && request.thinkingBudget > 0);
    const maxTokens = request.maxTokens || this.config.maxTokens || 256;
    const topP = request.topP ?? this.config.topP;

    if (request.temperature !== undefined && topP !== undefined) {
      throw new Error("temperature and top_p are mutually exclusive");
    }
    if (topP !== undefined) return { useThinking, maxTokens, topP };

    const temperature = resolveTemperature(request, this.config.temperature, useThinking);
    return { useThinking, maxTokens, temperature };
  }

  private buildRequestBody(request: LLMRequest, resolvedModel: string, sampling: ResolvedSampling) {
    const { useThinking, maxTokens, temperature, topP } = sampling;
    const body: Record<string, unknown> = {
      model: resolvedModel, max_tokens: maxTokens,
      system: request.systemPrompt, messages: [{ role: "user", content: request.prompt }],
    };
    if (temperature !== undefined) body.temperature = temperature;
    if (topP !== undefined) body.top_p = topP;
    if (useThinking) body.thinking = { type: "enabled", budget_tokens: request.thinkingBudget };
    const useSync = Boolean(request.disableStreaming);
    if (!useSync) body.stream = true;
    return { body, useSync };
  }

  private buildResponseMeta(response: Response, durationMs: number) {
    const rateLimit = extractRateLimitHeaders(response.headers);
    const requestId = extractRequestId(response.headers);
    return {
      provider: "anthropic" as const, status: response.status,
      statusText: response.statusText, durationMs, requestId,
      rateLimit: Object.keys(rateLimit).length > 0 ? rateLimit : undefined,
    };
  }

  private async executeAttempt(
    request: LLMRequest, resolvedModel: string, callNumber: number, attempt: number,
  ): Promise<{ result: LLMResult; debug: NetworkDebugInfo }> {
    const sampling = this.resolveSampling(request);
    const logEntry = this.logRequest(request, attempt, callNumber, resolvedModel, sampling);
    const requestStart = Date.now();
    const { body: requestBody, useSync } = this.buildRequestBody(request, resolvedModel, sampling);
    const rawRequest = JSON.stringify(requestBody);

    console.log(`[LLM] Request start (${useSync ? "sync" : "streaming"})`, {
      callNumber, attempt, model: resolvedModel,
      maxTokens: sampling.maxTokens, temperature: sampling.temperature,
      topP: sampling.topP, promptChars: request.prompt.length,
      systemChars: request.systemPrompt.length, thinkingBudget: request.thinkingBudget,
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json", "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true",
      },
      body: rawRequest,
    });

    if (!response.ok) {
      const errorText = await response.text();
      const meta = this.buildResponseMeta(response, Date.now() - requestStart);
      const debug: NetworkDebugInfo = { request: rawRequest, response: errorText, meta };
      console.warn("[LLM] Response error", { callNumber, attempt, ...meta, responseChars: errorText.length });
      throw Object.assign(new Error(`API error ${response.status}: ${errorText}`), { debug });
    }

    const streamResult = useSync
      ? await this.consumeJsonResponse(response)
      : await this.consumeSSEStream(response, request.onThinkingDelta, request.onTextDelta, (request.streamTimeout ?? 0) * 1000);
    const meta = this.buildResponseMeta(response, Date.now() - requestStart);
    const debug: NetworkDebugInfo = { request: rawRequest, response: streamResult.rawResponse, meta };

    console.log(`[LLM] Response success (${useSync ? "sync" : "streaming"})`, {
      callNumber, attempt, ...meta,
      usage: streamResult.usage, textChars: streamResult.text.length, thinkingChars: streamResult.thinking.length,
    });
    this.logResponse(logEntry, streamResult.text);
    if (streamResult.text) this.cache.set(await this.createCacheKey(request, resolvedModel), streamResult.text);

    return {
      result: { text: streamResult.text, cached: false, usage: streamResult.usage, debug, thinking: streamResult.thinking || undefined },
      debug,
    };
  }

  public async complete(request: LLMRequest): Promise<LLMResult> {
    if (!this.isEnabled()) {
      console.warn("[LLM] Client disabled - missing API key");
      return { text: "", cached: false, skipped: true };
    }

    const resolvedModel = (request.model || this.config.model).trim();
    const cached = this.cache.get(await this.createCacheKey(request, resolvedModel));
    if (cached) {
      console.log("[LLM] Cache hit", { model: resolvedModel, promptChars: request.prompt.length });
      return { text: cached, cached: true };
    }

    this.callsCreated++;
    const callNumber = this.callsCreated;
    let lastDebug: NetworkDebugInfo | undefined;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { result, debug } = await this.executeAttempt(request, resolvedModel, callNumber, attempt);
        lastDebug = debug;
        this.callsCompleted++;
        return result;
      } catch (error: unknown) {
        const errWithDebug = error as { debug?: NetworkDebugInfo };
        if (errWithDebug.debug) lastDebug = errWithDebug.debug;
        const message = errorToMessage(error);
        console.error(`[LLM] Call ${callNumber}, Attempt ${attempt}/3: ${message}`);
        if (attempt >= 3) { this.callsCompleted++; return { text: "", cached: false, skipped: true, error: message, debug: lastDebug }; }
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
    return { text: "", cached: false, skipped: true };
  }

  private async consumeJsonResponse(response: Response): Promise<StreamResult> {
    const rawResponse = await response.text();
    const data = JSON.parse(rawResponse) as AnthropicMessageResponse;
    let text = "";
    let thinking = "";
    if (Array.isArray(data.content)) {
      for (const block of data.content) {
        if (block.type === "thinking" && block.thinking) thinking += block.thinking;
        else if (block.type === "text" && block.text) text += block.text;
      }
    }
    const usage = data.usage
      ? { inputTokens: data.usage.input_tokens ?? 0, outputTokens: data.usage.output_tokens ?? 0 }
      : undefined;
    return { text, thinking, usage, rawResponse };
  }

  private async readChunk(reader: ReadableStreamDefaultReader<Uint8Array>, timeoutMs: number) {
    if (timeoutMs <= 0) return reader.read();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`SSE read timeout — no data received for ${Math.round(timeoutMs / 1000)}s`)), timeoutMs);
    });
    return Promise.race([reader.read(), timeoutPromise]);
  }

  private handleSSEEvent(
    eventType: string, parsed: Record<string, unknown>,
    state: SSEStreamState, onThinkingDelta?: (d: string) => void, onTextDelta?: (d: string) => void,
  ): boolean {
    switch (eventType) {
      case "message_start": return sseMessageStart(parsed, state);
      case "content_block_start": return false;
      case "content_block_delta": return sseContentBlockDelta(parsed, state, onThinkingDelta, onTextDelta);
      case "message_delta": return sseMessageDelta(parsed, state);
      case "message_stop": return true;
      case "error": throw sseErrorEvent(parsed);
      default: return false;
    }
  }

  private parseSSELines(
    lines: string[], state: SSEStreamState,
    onThinkingDelta?: (d: string) => void, onTextDelta?: (d: string) => void,
  ): boolean {
    let eventType = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) { eventType = line.slice(7).trim(); continue; }
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data) as Record<string, unknown>;
        if (this.handleSSEEvent(eventType, parsed, state, onThinkingDelta, onTextDelta)) return true;
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message.startsWith("SSE error event:")) throw parseErr;
      }
    }
    return false;
  }

  private async consumeSSEStream(
    response: Response, onThinkingDelta?: (d: string) => void,
    onTextDelta?: (d: string) => void, streamTimeoutMs?: number,
  ): Promise<StreamResult> {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const timeoutMs = streamTimeoutMs && streamTimeoutMs > 0 ? streamTimeoutMs : 0;
    const state: SSEStreamState = { text: "", thinking: "", inputTokens: 0, outputTokens: 0, hasUsage: false };
    const rawChunks: string[] = [];
    let buffer = "";
    try {
      while (true) {
        const readResult = await this.readChunk(reader, timeoutMs);
        if (readResult.done) break;
        const chunk = decoder.decode(readResult.value, { stream: true });
        rawChunks.push(chunk);
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        if (this.parseSSELines(lines, state, onThinkingDelta, onTextDelta)) break;
      }
    } finally {
      try { await reader.cancel(); } catch { /* reader already released */ }
    }
    return {
      text: state.text, thinking: state.thinking,
      usage: state.hasUsage ? { inputTokens: state.inputTokens, outputTokens: state.outputTokens } : undefined,
      rawResponse: rawChunks.join(""),
    };
  }

  private async createCacheKey(request: LLMRequest, model: string): Promise<string> {
    const s = this.resolveSampling(request);
    const payload = `${model}|${request.systemPrompt}|${request.prompt}|${s.maxTokens}|${s.temperature ?? "none"}|${s.topP ?? "none"}`;
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
    return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  private logRequest(
    request: LLMRequest, attempt: number, callNumber: number, model: string,
    sampling: { maxTokens: number; temperature?: number; topP?: number },
  ): CallLogEntry {
    const entry: CallLogEntry = {
      callNumber, timestamp: new Date().toISOString(), attempt,
      request: { model, maxTokens: sampling.maxTokens, temperature: sampling.temperature, topP: sampling.topP, systemPrompt: request.systemPrompt, userPrompt: request.prompt },
    };
    this.callLog.push(entry);
    return entry;
  }

  private logResponse(entry: CallLogEntry, text: string) {
    entry.response = { text, length: text.length };
  }

  public getCallStats() { return { completed: this.callsCompleted, created: this.callsCreated }; }
  public getCallLog(): CallLogEntry[] { return [...this.callLog]; }
  public clearCache(): void { this.cache.clear(); }
}
