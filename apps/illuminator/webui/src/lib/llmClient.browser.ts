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
}

export interface LLMRequest {
  systemPrompt: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** Enable extended thinking with budget in tokens (Sonnet/Opus only) */
  thinkingBudget?: number;
}

export interface NetworkDebugInfo {
  request: string;
  response?: string;
  meta?: {
    provider?: 'anthropic' | 'openai';
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
}

export interface CallLogEntry {
  callNumber: number;
  timestamp: string;
  request: {
    model: string;
    maxTokens: number;
    temperature: number;
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
  'retry-after',
  'x-ratelimit-limit-requests',
  'x-ratelimit-remaining-requests',
  'x-ratelimit-reset-requests',
  'x-ratelimit-limit-tokens',
  'x-ratelimit-remaining-tokens',
  'x-ratelimit-reset-tokens',
  'anthropic-ratelimit-requests-limit',
  'anthropic-ratelimit-requests-remaining',
  'anthropic-ratelimit-requests-reset',
  'anthropic-ratelimit-tokens-limit',
  'anthropic-ratelimit-tokens-remaining',
  'anthropic-ratelimit-tokens-reset',
];

const REQUEST_ID_HEADER_KEYS = [
  'request-id',
  'x-request-id',
  'anthropic-request-id',
  'openai-request-id',
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

  constructor(config: LLMConfig) {
    this.config = {
      ...config,
      model: (config.model || 'claude-sonnet-4-20250514').trim(),
      apiKey: (config.apiKey || '').trim(),
    };
  }

  public isEnabled(): boolean {
    return Boolean(this.config.enabled && this.config.apiKey);
  }

  public async complete(request: LLMRequest): Promise<LLMResult> {
    if (!this.isEnabled()) {
      console.warn('[LLM] Client disabled - missing API key');
      return { text: '', cached: false, skipped: true };
    }

    const resolvedModel = (request.model || this.config.model).trim();
    const cacheKey = await this.createCacheKey(request, resolvedModel);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log('[LLM] Cache hit', {
        model: resolvedModel,
        promptChars: request.prompt.length,
        systemChars: request.systemPrompt.length,
      });
      return { text: cached, cached: true };
    }

    this.callsCreated++;
    const callNumber = this.callsCreated;

    let attempt = 0;
    const maxAttempts = 3;
    const backoffMs = 1000;
    let lastDebug: NetworkDebugInfo | undefined;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const logEntry = this.logRequest(request, attempt, callNumber, resolvedModel);
        const requestStart = Date.now();

        // Build request body - extended thinking requires special handling
        const useThinking = request.thinkingBudget && request.thinkingBudget > 0;
        const resolvedMaxTokens = request.maxTokens || this.config.maxTokens || 256;
        const resolvedTemperature = useThinking ? 1 : (request.temperature ?? this.config.temperature ?? 0.4);
        const requestBody: Record<string, unknown> = {
          model: resolvedModel,
          max_tokens: resolvedMaxTokens,
          // Temperature must be 1 when using extended thinking
          temperature: resolvedTemperature,
          system: request.systemPrompt,
          messages: [{ role: 'user', content: request.prompt }],
        };

        // Add extended thinking if requested (Sonnet/Opus only)
        if (useThinking) {
          requestBody.thinking = {
            type: 'enabled',
            budget_tokens: request.thinkingBudget,
          };
        }

        const rawRequest = JSON.stringify(requestBody);
        lastDebug = { request: rawRequest };

        console.log('[LLM] Request start', {
          callNumber,
          attempt,
          model: resolvedModel,
          maxTokens: resolvedMaxTokens,
          temperature: resolvedTemperature,
          promptChars: request.prompt.length,
          systemChars: request.systemPrompt.length,
          thinkingBudget: request.thinkingBudget,
        });

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey!,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: rawRequest,
        });

        const responseText = await response.text();
        const durationMs = Date.now() - requestStart;
        const rateLimit = extractRateLimitHeaders(response.headers);
        const requestId = extractRequestId(response.headers);
        const responseMeta = {
          provider: 'anthropic' as const,
          status: response.status,
          statusText: response.statusText,
          durationMs,
          requestId,
          rateLimit: Object.keys(rateLimit).length > 0 ? rateLimit : undefined,
        };

        lastDebug = { request: rawRequest, response: responseText, meta: responseMeta };

        if (!response.ok) {
          console.warn('[LLM] Response error', {
            callNumber,
            attempt,
            ...responseMeta,
            responseChars: responseText.length,
          });
          throw new Error(`API error ${response.status}: ${responseText}`);
        }

        let data: any;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          throw new Error(`Failed to parse response JSON: ${parseError}`);
        }
        let text = '';
        for (const part of data.content) {
          if (part.type === 'text') {
            text += part.text;
          }
        }

        // Extract usage data from response
        const usage = data.usage ? {
          inputTokens: data.usage.input_tokens || 0,
          outputTokens: data.usage.output_tokens || 0,
        } : undefined;

        console.log('[LLM] Response success', {
          callNumber,
          attempt,
          ...responseMeta,
          usage,
          responseChars: responseText.length,
        });

        this.logResponse(logEntry, text);

        if (text) {
          this.cache.set(cacheKey, text);
        }

        this.callsCompleted++;
        return { text, cached: false, usage, debug: lastDebug };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[LLM] Call ${callNumber}, Attempt ${attempt}/${maxAttempts}: ${message}`);

        if (attempt >= maxAttempts) {
          this.callsCompleted++;
          return { text: '', cached: false, skipped: true, error: message, debug: lastDebug };
        }

        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt));
      }
    }

    return { text: '', cached: false, skipped: true };
  }

  private async createCacheKey(request: LLMRequest, model: string): Promise<string> {
    const payload = `${model}|${request.systemPrompt}|${request.prompt}|${request.maxTokens}|${request.temperature}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  private logRequest(request: LLMRequest, attempt: number, callNumber: number, model: string): CallLogEntry {
    const entry: CallLogEntry = {
      callNumber,
      timestamp: new Date().toISOString(),
      attempt,
      request: {
        model,
        maxTokens: request.maxTokens || this.config.maxTokens || 256,
        temperature: request.temperature ?? this.config.temperature ?? 0.4,
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
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
}

export interface ImageRequest {
  prompt: string;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
}

export interface ImageResult {
  imageUrl: string | null;
  imageBlob?: Blob;  // Base64 decoded blob
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
      model: config.model || 'dall-e-3',
      size: config.size || '1024x1024',
      quality: config.quality || 'standard',
    };
  }

  public isEnabled(): boolean {
    return Boolean(this.config.enabled && this.config.apiKey);
  }

  public async generate(request: ImageRequest): Promise<ImageResult> {
    if (!this.isEnabled()) {
      console.warn('[Image] Client disabled - missing API key');
      return { imageUrl: null, skipped: true };
    }

    let debug: NetworkDebugInfo | undefined;

    try {
      const requestStart = Date.now();
      const model = this.config.model || 'dall-e-3';
      const isGptImageModel = model.startsWith('gpt-image');

      // Build request body with model-appropriate parameters
      const requestBody: Record<string, unknown> = {
        model,
        prompt: request.prompt,
        n: 1,
      };

      // Size parameter
      const sizeParam = request.size || this.config.size;
      if (sizeParam && sizeParam !== 'auto') {
        requestBody.size = sizeParam;
      } else if (isGptImageModel && sizeParam === 'auto') {
        // GPT image models support 'auto' as an explicit value
        requestBody.size = 'auto';
      }

      // Quality parameter
      const qualityParam = request.quality || this.config.quality;
      if (qualityParam && qualityParam !== 'auto') {
        requestBody.quality = qualityParam;
      } else if (isGptImageModel && qualityParam === 'auto') {
        // GPT image models support 'auto' as an explicit value
        requestBody.quality = 'auto';
      }

      // response_format: only for DALL-E models (GPT image models always return base64)
      if (!isGptImageModel) {
        requestBody.response_format = 'b64_json';
      }

      const rawRequest = JSON.stringify(requestBody);
      console.log('[Image] Request start', {
        model,
        promptChars: request.prompt.length,
        size: sizeParam,
        quality: qualityParam,
      });

      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: rawRequest,
      });

      const responseText = await response.text();
      const durationMs = Date.now() - requestStart;
      const rateLimit = extractRateLimitHeaders(response.headers);
      const requestId = extractRequestId(response.headers);
      const responseMeta = {
        provider: 'openai' as const,
        status: response.status,
        statusText: response.statusText,
        durationMs,
        requestId,
        rateLimit: Object.keys(rateLimit).length > 0 ? rateLimit : undefined,
      };

      debug = { request: rawRequest, response: responseText, meta: responseMeta };

      if (!response.ok) {
        console.warn('[Image] Response error', {
          ...responseMeta,
          responseChars: responseText.length,
        });
        throw new Error(`API error ${response.status}: ${responseText}`);
      }

      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Failed to parse response JSON: ${parseError}`);
      }
      this.imagesGenerated++;

      // Decode base64 to blob
      const b64Data = data.data[0]?.b64_json;
      let imageBlob: Blob | undefined;
      if (b64Data) {
        const byteCharacters = atob(b64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        imageBlob = new Blob([byteArray], { type: 'image/png' });
      }

      // Extract usage data (GPT Image models return token usage)
      const usage = data.usage ? {
        inputTokens: data.usage.input_tokens || 0,
        outputTokens: data.usage.output_tokens || 0,
      } : undefined;

      console.log('[Image] Response success', {
        ...responseMeta,
        usage,
        responseChars: responseText.length,
      });

      return {
        imageUrl: null,  // No URL when using b64_json format
        imageBlob,
        revisedPrompt: data.data[0]?.revised_prompt,
        debug,
        usage,
      };
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
