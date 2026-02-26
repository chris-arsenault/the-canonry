/**
 * Browser-compatible LLM Client
 *
 * Adapted from the Node.js version with:
 * - Web Crypto API for cache key generation
 * - Console/memory logging instead of file logging
 * - Fetch API instead of Anthropic SDK
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

const RATE_LIMIT_HEADER_KEYS = [
  "retry-after",
  "x-ratelimit-limit-requests",
  "x-ratelimit-remaining-requests",
  "x-ratelimit-reset-requests",
  "x-ratelimit-limit-tokens",
  "x-ratelimit-remaining-tokens",
  "x-ratelimit-reset-tokens",
  "anthropic-ratelimit-requests-limit",
  "anthropic-ratelimit-requests-remaining",
  "anthropic-ratelimit-requests-reset",
  "anthropic-ratelimit-tokens-limit",
  "anthropic-ratelimit-tokens-remaining",
  "anthropic-ratelimit-tokens-reset",
];

const REQUEST_ID_HEADER_KEYS = [
  "request-id",
  "x-request-id",
  "anthropic-request-id",
  "openai-request-id",
];

function extractRateLimitHeaders(headers: Headers): Record<string, string> {
  const info: Record<string, string> = {};
  for (const key of RATE_LIMIT_HEADER_KEYS) {
    const value = headers.get(key);
    if (value) info[key] = value;
  }
  return info;
}

function extractRequestId(headers: Headers): string | undefined {
  for (const key of REQUEST_ID_HEADER_KEYS) {
    const value = headers.get(key);
    if (value) return value;
  }
  return undefined;
}

export class LLMClient {
  private cache = new Map<string, string>();
  private config: LLMConfig;
  private callsCompleted = 0;
  private callsCreated = 0;
  private callLog: CallLogEntry[] = [];

  private resolveSampling(request: LLMRequest): {
    useThinking: boolean;
    maxTokens: number;
    temperature?: number;
    topP?: number;
  } {
    const useThinking = Boolean(request.thinkingBudget && request.thinkingBudget > 0);
    const maxTokens = request.maxTokens || this.config.maxTokens || 256;
    const topP = request.topP ?? this.config.topP;

    if (request.temperature !== undefined && topP !== undefined) {
      throw new Error("temperature and top_p are mutually exclusive");
    }

    if (topP !== undefined) {
      return { useThinking, maxTokens, topP };
    }

    const temperature = useThinking ? 1 : (request.temperature ?? this.config.temperature ?? 0.4);
    return { useThinking, maxTokens, temperature };
  }

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

  private buildRequestBody(
    request: LLMRequest,
    resolvedModel: string,
    resolvedSampling: ReturnType<typeof LLMClient.prototype.resolveSampling>
  ): { body: Record<string, unknown>; useSync: boolean } {
    const { useThinking, maxTokens, temperature, topP } = resolvedSampling;
    const body: Record<string, unknown> = {
      model: resolvedModel,
      max_tokens: maxTokens,
      system: request.systemPrompt,
      messages: [{ role: "user", content: request.prompt }],
    };

    if (temperature !== undefined) body.temperature = temperature;
    if (topP !== undefined) body.top_p = topP;
    if (useThinking) {
      body.thinking = { type: "enabled", budget_tokens: request.thinkingBudget };
    }

    const useSync = Boolean(request.disableStreaming);
    if (!useSync) body.stream = true;

    return { body, useSync };
  }

  private buildResponseMeta(response: Response, durationMs: number) {
    const rateLimit = extractRateLimitHeaders(response.headers);
    const requestId = extractRequestId(response.headers);
    return {
      provider: "anthropic" as const,
      status: response.status,
      statusText: response.statusText,
      durationMs,
      requestId,
      rateLimit: Object.keys(rateLimit).length > 0 ? rateLimit : undefined,
    };
  }

  private async executeAttempt(
    request: LLMRequest,
    resolvedModel: string,
    callNumber: number,
    attempt: number
  ): Promise<{ result: LLMResult; debug: NetworkDebugInfo }> {
    const resolvedSampling = this.resolveSampling(request);
    const logEntry = this.logRequest(request, attempt, callNumber, resolvedModel, resolvedSampling);
    const requestStart = Date.now();

    const { body: requestBody, useSync } = this.buildRequestBody(request, resolvedModel, resolvedSampling);
    const rawRequest = JSON.stringify(requestBody);

    const modeLabel = useSync ? "sync" : "streaming";
    console.log(`[LLM] Request start (${modeLabel})`, {
      callNumber, attempt, model: resolvedModel,
      maxTokens: resolvedSampling.maxTokens, temperature: resolvedSampling.temperature,
      topP: resolvedSampling.topP, promptChars: request.prompt.length,
      systemChars: request.systemPrompt.length, thinkingBudget: request.thinkingBudget,
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: rawRequest,
    });

    if (!response.ok) {
      const errorText = await response.text();
      const responseMeta = this.buildResponseMeta(response, Date.now() - requestStart);
      const debug: NetworkDebugInfo = { request: rawRequest, response: errorText, meta: responseMeta };
      console.warn("[LLM] Response error", { callNumber, attempt, ...responseMeta, responseChars: errorText.length });
      throw Object.assign(new Error(`API error ${response.status}: ${errorText}`), { debug });
    }

    const streamTimeoutMs = (request.streamTimeout ?? 0) * 1000;
    const streamResult = useSync
      ? await this.consumeJsonResponse(response)
      : await this.consumeSSEStream(response, request.onThinkingDelta, request.onTextDelta, streamTimeoutMs);

    const responseMeta = this.buildResponseMeta(response, Date.now() - requestStart);
    const debug: NetworkDebugInfo = { request: rawRequest, response: streamResult.rawResponse, meta: responseMeta };

    console.log(`[LLM] Response success (${modeLabel})`, {
      callNumber, attempt, ...responseMeta,
      usage: streamResult.usage, textChars: streamResult.text.length, thinkingChars: streamResult.thinking.length,
    });

    this.logResponse(logEntry, streamResult.text);

    if (streamResult.text) this.cache.set(await this.createCacheKey(request, resolvedModel), streamResult.text);

    return {
      result: {
        text: streamResult.text, cached: false,
        usage: streamResult.usage, debug,
        thinking: streamResult.thinking || undefined,
      },
      debug,
    };
  }

  public async complete(request: LLMRequest): Promise<LLMResult> {
    if (!this.isEnabled()) {
      console.warn("[LLM] Client disabled - missing API key");
      return { text: "", cached: false, skipped: true };
    }

    const resolvedModel = (request.model || this.config.model).trim();
    const cacheKey = await this.createCacheKey(request, resolvedModel);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log("[LLM] Cache hit", {
        model: resolvedModel, promptChars: request.prompt.length, systemChars: request.systemPrompt.length,
      });
      return { text: cached, cached: true };
    }

    this.callsCreated++;
    const callNumber = this.callsCreated;
    const maxAttempts = 3;
    const backoffMs = 1000;
    let lastDebug: NetworkDebugInfo | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { result, debug } = await this.executeAttempt(request, resolvedModel, callNumber, attempt);
        lastDebug = debug;
        this.callsCompleted++;
        return result;
      } catch (error: unknown) {
        const errWithDebug = error as { debug?: NetworkDebugInfo };
        if (errWithDebug.debug) lastDebug = errWithDebug.debug;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[LLM] Call ${callNumber}, Attempt ${attempt}/${maxAttempts}: ${message}`);

        if (attempt >= maxAttempts) {
          this.callsCompleted++;
          return { text: "", cached: false, skipped: true, error: message, debug: lastDebug };
        }

        await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt));
      }
    }

    return { text: "", cached: false, skipped: true };
  }

  /**
   * Parse a non-streaming JSON response from the Messages API.
   */
  private async consumeJsonResponse(response: Response): Promise<{
    text: string;
    thinking: string;
    usage: { inputTokens: number; outputTokens: number } | undefined;
    rawResponse: string;
  }> {
    const rawResponse = await response.text();
    const data = JSON.parse(rawResponse);

    let text = "";
    let thinking = "";

    if (Array.isArray(data.content)) {
      for (const block of data.content) {
        if (block.type === "thinking" && block.thinking) {
          thinking += block.thinking;
        } else if (block.type === "text" && block.text) {
          text += block.text;
        }
      }
    }

    const usage = data.usage
      ? { inputTokens: data.usage.input_tokens || 0, outputTokens: data.usage.output_tokens || 0 }
      : undefined;

    return { text, thinking, usage, rawResponse };
  }

  /**
   * Consume an SSE stream from the Messages API.
   *
   * When streamTimeoutMs > 0, each reader.read() races against a timeout.
   * Handles SSE `error` and `message_stop` event types.
   */
  private async readChunk(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    timeoutMs: number
  ): Promise<ReadableStreamReadResult<Uint8Array>> {
    if (timeoutMs <= 0) return reader.read();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`SSE read timeout — no data received for ${Math.round(timeoutMs / 1000)}s`)),
        timeoutMs
      );
    });
    return Promise.race([reader.read(), timeoutPromise]);
  }

  private handleSSEEvent(
    eventType: string,
    parsed: Record<string, unknown>,
    state: { text: string; thinking: string; inputTokens: number; outputTokens: number; hasUsage: boolean },
    onThinkingDelta?: (delta: string) => void,
    onTextDelta?: (delta: string) => void
  ): boolean {
    switch (eventType) {
      case "message_start": {
        const msg = parsed.message as Record<string, unknown> | undefined;
        const usage = msg?.usage as Record<string, number> | undefined;
        if (usage?.input_tokens) {
          state.inputTokens = usage.input_tokens;
          state.hasUsage = true;
        }
        return false;
      }
      case "content_block_start":
        return false;
      case "content_block_delta": {
        const delta = parsed.delta as Record<string, string> | undefined;
        if (delta?.type === "thinking_delta") {
          state.thinking += delta.thinking;
          onThinkingDelta?.(delta.thinking);
        } else if (delta?.type === "text_delta") {
          state.text += delta.text;
          onTextDelta?.(delta.text);
        }
        return false;
      }
      case "message_delta": {
        const usage = parsed.usage as Record<string, number> | undefined;
        if (usage?.output_tokens) {
          state.outputTokens = usage.output_tokens;
          state.hasUsage = true;
        }
        return false;
      }
      case "message_stop":
        return true;
      case "error": {
        const err = parsed.error as Record<string, string> | undefined;
        const errorMsg = err?.message || (parsed.message as string) || JSON.stringify(parsed);
        throw new Error(`SSE error event: ${errorMsg}`);
      }
      default:
        return false;
    }
  }

  private parseSSELines(
    lines: string[],
    state: { text: string; thinking: string; inputTokens: number; outputTokens: number; hasUsage: boolean },
    onThinkingDelta?: (delta: string) => void,
    onTextDelta?: (delta: string) => void
  ): boolean {
    let currentEventType = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEventType = line.slice(7).trim();
        continue;
      }
      if (!line.startsWith("data: ")) continue;

      const data = line.slice(6);
      if (data === "[DONE]") continue;

      try {
        const parsed = JSON.parse(data);
        const shouldStop = this.handleSSEEvent(
          currentEventType, parsed, state, onThinkingDelta, onTextDelta
        );
        if (shouldStop) return true;
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message.startsWith("SSE error event:")) {
          throw parseErr;
        }
      }
    }
    return false;
  }

  private async consumeSSEStream(
    response: Response,
    onThinkingDelta?: (delta: string) => void,
    onTextDelta?: (delta: string) => void,
    streamTimeoutMs?: number
  ): Promise<{
    text: string;
    thinking: string;
    usage: { inputTokens: number; outputTokens: number } | undefined;
    rawResponse: string;
  }> {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const timeoutMs = streamTimeoutMs && streamTimeoutMs > 0 ? streamTimeoutMs : 0;

    const state = { text: "", thinking: "", inputTokens: 0, outputTokens: 0, hasUsage: false };
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

        const shouldStop = this.parseSSELines(lines, state, onThinkingDelta, onTextDelta);
        if (shouldStop) break;
      }
    } finally {
      try { await reader.cancel(); } catch { /* reader already released */ }
    }

    return {
      text: state.text,
      thinking: state.thinking,
      usage: state.hasUsage ? { inputTokens: state.inputTokens, outputTokens: state.outputTokens } : undefined,
      rawResponse: rawChunks.join(""),
    };
  }

  private async createCacheKey(request: LLMRequest, model: string): Promise<string> {
    const resolvedSampling = this.resolveSampling(request);
    const payload = `${model}|${request.systemPrompt}|${request.prompt}|${resolvedSampling.maxTokens}|${resolvedSampling.temperature ?? "none"}|${resolvedSampling.topP ?? "none"}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  private logRequest(
    request: LLMRequest,
    attempt: number,
    callNumber: number,
    model: string,
    resolvedSampling: { maxTokens: number; temperature?: number; topP?: number }
  ): CallLogEntry {
    const entry: CallLogEntry = {
      callNumber,
      timestamp: new Date().toISOString(),
      attempt,
      request: {
        model,
        maxTokens: resolvedSampling.maxTokens,
        temperature: resolvedSampling.temperature,
        topP: resolvedSampling.topP,
        systemPrompt: request.systemPrompt,
        userPrompt: request.prompt,
      },
    };
    this.callLog.push(entry);
    return entry;
  }

  private logResponse(entry: CallLogEntry, text: string) {
    entry.response = {
      text,
      length: text.length,
    };
  }

  public getCallStats() {
    return {
      completed: this.callsCompleted,
      created: this.callsCreated,
    };
  }

  public getCallLog(): CallLogEntry[] {
    return [...this.callLog];
  }

  public clearCache(): void {
    this.cache.clear();
  }
}

/**
 * OpenAI Image Generation Client for DALL-E
 */
export interface ImageConfig {
  enabled: boolean;
  apiKey?: string;
  model?: string;
  size?: "1024x1024" | "1792x1024" | "1024x1792";
  quality?: "standard" | "hd";
}

export interface ImageRequest {
  prompt: string;
  size?: "1024x1024" | "1792x1024" | "1024x1792";
  quality?: "standard" | "hd";
}

export interface ImageResult {
  imageUrl: string | null;
  imageBlob?: Blob; // Base64 decoded blob
  revisedPrompt?: string;
  skipped?: boolean;
  error?: string;
  debug?: NetworkDebugInfo;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export class ImageGenerationClient {
  private config: ImageConfig;
  private imagesGenerated = 0;

  constructor(config: ImageConfig) {
    this.config = {
      ...config,
      model: config.model || "dall-e-3",
      size: config.size || "1024x1024",
      quality: config.quality || "standard",
    };
  }

  public isEnabled(): boolean {
    return Boolean(this.config.enabled && this.config.apiKey);
  }

  private buildImageRequestBody(request: ImageRequest): Record<string, unknown> {
    const model = this.config.model || "dall-e-3";
    const isGptImageModel = model.startsWith("gpt-image");
    const body: Record<string, unknown> = { model, prompt: request.prompt, n: 1 };

    const sizeParam = request.size || this.config.size;
    if (sizeParam && sizeParam !== "auto") {
      body.size = sizeParam;
    } else if (isGptImageModel && sizeParam === "auto") {
      body.size = "auto";
    }

    const qualityParam = request.quality || this.config.quality;
    if (qualityParam && qualityParam !== "auto") {
      body.quality = qualityParam;
    } else if (isGptImageModel && qualityParam === "auto") {
      body.quality = "auto";
    }

    if (!isGptImageModel) {
      body.response_format = "b64_json";
    }

    return body;
  }

  private static decodeBase64ToBlob(b64Data: string): Blob {
    const byteCharacters = atob(b64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    return new Blob([new Uint8Array(byteNumbers)], { type: "image/png" });
  }

  public async generate(request: ImageRequest): Promise<ImageResult> {
    if (!this.isEnabled()) {
      console.warn("[Image] Client disabled - missing API key");
      return { imageUrl: null, skipped: true };
    }

    let debug: NetworkDebugInfo | undefined;

    try {
      const requestStart = Date.now();
      const requestBody = this.buildImageRequestBody(request);
      const rawRequest = JSON.stringify(requestBody);

      console.log("[Image] Request start", {
        model: requestBody.model, promptChars: request.prompt.length,
        size: requestBody.size, quality: requestBody.quality,
      });

      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.config.apiKey}` },
        body: rawRequest,
      });

      const responseText = await response.text();
      const rateLimit = extractRateLimitHeaders(response.headers);
      const requestId = extractRequestId(response.headers);
      const responseMeta = {
        provider: "openai" as const, status: response.status, statusText: response.statusText,
        durationMs: Date.now() - requestStart, requestId,
        rateLimit: Object.keys(rateLimit).length > 0 ? rateLimit : undefined,
      };
      debug = { request: rawRequest, response: responseText, meta: responseMeta };

      if (!response.ok) {
        console.warn("[Image] Response error", { ...responseMeta, responseChars: responseText.length });
        throw new Error(`API error ${response.status}: ${responseText}`);
      }

      const data = JSON.parse(responseText);
      this.imagesGenerated++;

      const b64Data = data.data[0]?.b64_json;
      const imageBlob = b64Data ? ImageGenerationClient.decodeBase64ToBlob(b64Data) : undefined;
      const usage = data.usage
        ? { inputTokens: data.usage.input_tokens || 0, outputTokens: data.usage.output_tokens || 0 }
        : undefined;

      console.log("[Image] Response success", { ...responseMeta, usage, responseChars: responseText.length });

      return { imageUrl: null, imageBlob, revisedPrompt: data.data[0]?.revised_prompt, debug, usage };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Image] Generation failed: ${message}`);
      return { imageUrl: null, skipped: true, error: message, debug };
    }
  }

  public getStats() {
    return {
      generated: this.imagesGenerated,
    };
  }
}
