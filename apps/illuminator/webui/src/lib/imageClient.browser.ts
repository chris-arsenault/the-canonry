/**
 * Browser-compatible Image Generation Client for DALL-E / GPT-Image
 *
 * Extracted from llmClient.browser.ts to keep file size under max-lines.
 */

import type { NetworkDebugInfo } from "./llmClient.browser";
import { extractRateLimitHeaders, extractRequestId } from "./llmClient.browser";

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
  imageBlob?: Blob;
  revisedPrompt?: string;
  skipped?: boolean;
  error?: string;
  debug?: NetworkDebugInfo;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/** Shape of the OpenAI image generation API response. */
interface OpenAIImageResponse {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

function resolveSize(
  requestSize: ImageRequest["size"],
  configSize: ImageConfig["size"],
  isGptImage: boolean,
): string | undefined {
  const sizeParam = requestSize || configSize;
  if (sizeParam && sizeParam !== "auto") return sizeParam;
  if (isGptImage && sizeParam === "auto") return "auto";
  return undefined;
}

function resolveQuality(
  requestQuality: ImageRequest["quality"],
  configQuality: ImageConfig["quality"],
  isGptImage: boolean,
): string | undefined {
  const qualityParam = requestQuality || configQuality;
  if (qualityParam && qualityParam !== "auto") return qualityParam;
  if (isGptImage && qualityParam === "auto") return "auto";
  return undefined;
}

function decodeBase64ToBlob(b64Data: string): Blob {
  const byteCharacters = atob(b64Data);
  const byteNumbers = new Array<number>(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: "image/png" });
}

function buildResponseMeta(
  response: Response,
  requestStart: number,
): NonNullable<NetworkDebugInfo["meta"]> {
  const rateLimit = extractRateLimitHeaders(response.headers);
  const requestId = extractRequestId(response.headers);
  return {
    provider: "openai",
    status: response.status,
    statusText: response.statusText,
    durationMs: Date.now() - requestStart,
    requestId,
    rateLimit: Object.keys(rateLimit).length > 0 ? rateLimit : undefined,
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
    const isGptImage = model.startsWith("gpt-image");
    const body: Record<string, unknown> = { model, prompt: request.prompt, n: 1 };

    const size = resolveSize(request.size, this.config.size, isGptImage);
    if (size) body.size = size;

    const quality = resolveQuality(request.quality, this.config.quality, isGptImage);
    if (quality) body.quality = quality;

    if (!isGptImage) body.response_format = "b64_json";

    return body;
  }

  public async generate(request: ImageRequest): Promise<ImageResult> {
    if (!this.isEnabled()) {
      console.warn("[Image] Client disabled - missing API key");
      return { imageUrl: null, skipped: true };
    }

    let debug: NetworkDebugInfo | undefined;

    try {
      const result = await this.executeImageRequest(request);
      debug = result.debug;
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      console.error(`[Image] Generation failed: ${message}`);
      return { imageUrl: null, skipped: true, error: message, debug };
    }
  }

  private async executeImageRequest(request: ImageRequest): Promise<ImageResult> {
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
    const responseMeta = buildResponseMeta(response, requestStart);
    const debug: NetworkDebugInfo = { request: rawRequest, response: responseText, meta: responseMeta };

    if (!response.ok) {
      console.warn("[Image] Response error", { ...responseMeta, responseChars: responseText.length });
      throw new Error(`API error ${response.status}: ${responseText}`);
    }

    const data = JSON.parse(responseText) as OpenAIImageResponse;
    this.imagesGenerated++;

    const firstEntry = data.data?.[0];
    const b64Data = firstEntry?.b64_json;
    const imageBlob = b64Data ? decodeBase64ToBlob(b64Data) : undefined;
    const usage = data.usage
      ? { inputTokens: data.usage.input_tokens ?? 0, outputTokens: data.usage.output_tokens ?? 0 }
      : undefined;

    console.log("[Image] Response success", { ...responseMeta, usage, responseChars: responseText.length });

    return { imageUrl: null, imageBlob, revisedPrompt: firstEntry?.revised_prompt, debug, usage };
  }

  public getStats() {
    return {
      generated: this.imagesGenerated,
    };
  }
}
