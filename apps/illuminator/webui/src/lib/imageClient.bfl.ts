/**
 * Black Forest Labs (BFL) Image Generation Client
 *
 * Async workflow: POST task -> poll -> fetch output image.
 * Requests go through a relay server because BFL's API doesn't set CORS headers.
 * The relay is a thin passthrough (see apps/illuminator/relay/) deployable as a Lambda.
 *
 * API docs: https://docs.bfl.ai/quick_start/generating_images
 */

import type { ImageConfig, ImageRequest, ImageResult } from "./imageClient.browser";
import type { NetworkDebugInfo } from "./llmClient.browser";

/** Relay base URL — local dev server or deployed Lambda. */
const RELAY_BASE = "http://localhost:3100/bfl";
const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 300_000; // 5 minutes
const SUBMIT_FETCH_TIMEOUT_MS = 30_000; // 30s per submit request
const POLL_FETCH_TIMEOUT_MS = 15_000; // 15s per poll request
const IMAGE_FETCH_TIMEOUT_MS = 60_000; // 60s for image download

/** Models that use aspect_ratio instead of width/height. */
const BFL_ASPECT_RATIO_MODELS = new Set([
  "flux-pro-1.1-ultra",
  "flux-pro-1.1-ultra-raw",
]);

/** Models that accept a `raw` parameter. */
const BFL_RAW_MODELS: Record<string, boolean> = {
  "flux-pro-1.1-ultra-raw": true,
};

interface BflSubmitResponse {
  id: string;
  polling_url: string;
  cost?: number;
  input_mp?: number;
  output_mp?: number;
}

interface BflPollResponse {
  id: string;
  status: string; // Ready | Error | Failed | Pending | Processing | Request Moderated | Content Moderated
  result?: {
    sample: string; // signed URL, valid 10 minutes
  };
  error?: string;
}

/** BFL status values that mean the task is terminally failed — stop polling. */
function isTerminalFailure(status: string): boolean {
  const s = status.toLowerCase();
  return (
    s === "error" ||
    s === "failed" ||
    s.includes("moderat") ||      // "Request Moderated", "Content Moderated"
    s.includes("rejected") ||
    s.includes("not found") ||    // "Task not found"
    s.includes("cancelled")
  );
}

function parseSizeDimensions(size: string): { width: number; height: number } {
  const parts = size.split("x").map(Number);
  const w = parts[0] || 1024;
  const h = parts[1] || 1024;
  // BFL requires multiples of 16
  return {
    width: Math.round(w / 16) * 16,
    height: Math.round(h / 16) * 16,
  };
}

function sizeToAspectRatio(size: string): string {
  const { width, height } = parseSizeDimensions(size);
  if (width === height) return "1:1";
  if (width > height) return "16:9";
  return "9:16";
}

/**
 * Resolve a model ID to its BFL API endpoint name.
 * Handles virtual variants (e.g. raw mode maps to the same endpoint).
 */
function resolveBflEndpoint(model: string): string {
  if (model === "flux-pro-1.1-ultra-raw") return "flux-pro-1.1-ultra";
  return model;
}

export class BflImageClient {
  private config: ImageConfig;
  private imagesGenerated = 0;

  constructor(config: ImageConfig) {
    this.config = {
      ...config,
      size: config.size || "1024x1024",
    };
  }

  public isEnabled(): boolean {
    return Boolean(this.config.enabled && this.config.apiKey);
  }

  public async generate(request: ImageRequest): Promise<ImageResult> {
    if (!this.isEnabled()) {
      console.warn("[BFL] Client disabled - missing API key");
      return { imageUrl: null, skipped: true };
    }

    try {
      return await this.executeRequest(request);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      console.error(`[BFL] Generation failed: ${message}`);
      return { imageUrl: null, skipped: true, error: message };
    }
  }

  private buildRequestBody(request: ImageRequest): Record<string, unknown> {
    const model = this.config.model || "flux-2-pro";
    const size = request.size || this.config.size || "1024x1024";

    const body: Record<string, unknown> = {
      prompt: request.prompt,
      // Disable prompt upsampling — BFL runs an LLM rewrite on prompts by default
      // (disable_pup defaults to false = upsampling ON). Our prompts are already
      // carefully structured; the upsampler fights with them and washes out color.
      disable_pup: true,
      output_format: "png",
      // Permissive moderation — default (2) triggers false positives on fantasy/magic content.
      // 0 = strict, 5 = most permissive. BFL website uses permissive settings.
      safety_tolerance: 5,
    };

    if (BFL_ASPECT_RATIO_MODELS.has(model)) {
      body.aspect_ratio = sizeToAspectRatio(size);
    } else {
      const { width, height } = parseSizeDimensions(size);
      body.width = width;
      body.height = height;
    }

    if (model in BFL_RAW_MODELS) {
      body.raw = BFL_RAW_MODELS[model];
    }

    return body;
  }

  private async executeRequest(request: ImageRequest): Promise<ImageResult> {
    const model = this.config.model || "flux-2-pro";
    const endpoint = resolveBflEndpoint(model);
    const requestBody = this.buildRequestBody(request);
    const rawRequest = JSON.stringify(requestBody);

    console.log("[BFL] Submitting task", {
      model,
      endpoint,
      promptChars: request.prompt.length,
      width: requestBody.width,
      height: requestBody.height,
      aspect_ratio: requestBody.aspect_ratio,
    });

    // Step 1: Submit task via relay
    const submitResponse = await fetch(`${RELAY_BASE}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        "x-key": this.config.apiKey || "",
      },
      body: rawRequest,
      signal: AbortSignal.timeout(SUBMIT_FETCH_TIMEOUT_MS),
    });

    const submitText = await submitResponse.text();
    if (!submitResponse.ok) {
      // BFL returns 422 for content moderation at submit time, 400 for bad params
      // Parse error details if JSON, otherwise use raw text
      let errorDetail = submitText;
      try {
        const parsed = JSON.parse(submitText);
        errorDetail = parsed.detail || parsed.error || parsed.message || submitText;
      } catch { /* raw text fallback */ }
      throw new Error(`BFL submit error ${submitResponse.status}: ${errorDetail}`);
    }

    const submitData = JSON.parse(submitText) as BflSubmitResponse;
    const taskId = submitData.id;

    console.log("[BFL] Task submitted", { taskId, cost: submitData.cost, pollingUrl: submitData.polling_url });

    // Step 2: Poll for completion via relay (pass BFL's polling URL through)
    // Each poll fetch has a timeout so a dropped connection can't hang the loop.
    // On transient errors (network/timeout), we retry — the BFL task is still
    // running server-side, we just lost the connection.
    const pollUrl = `${RELAY_BASE}/poll?url=${encodeURIComponent(submitData.polling_url)}`;
    const requestStart = Date.now();
    let resultData: BflPollResponse | null = null;
    let consecutiveErrors = 0;

    while (Date.now() - requestStart < POLL_TIMEOUT_MS) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      let pollResponse: Response;
      try {
        pollResponse = await fetch(pollUrl, {
          headers: {
            accept: "application/json",
            "x-key": this.config.apiKey || "",
          },
          signal: AbortSignal.timeout(POLL_FETCH_TIMEOUT_MS),
        });
      } catch (err) {
        // Network error or timeout — connection likely dropped. Retry.
        consecutiveErrors++;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[BFL] Poll fetch failed (attempt ${consecutiveErrors}): ${msg}`);
        if (consecutiveErrors >= 10) {
          throw new Error(`BFL polling failed after ${consecutiveErrors} consecutive errors: ${msg}`);
        }
        continue;
      }

      if (!pollResponse.ok) {
        consecutiveErrors++;
        console.warn(`[BFL] Poll HTTP ${pollResponse.status} (attempt ${consecutiveErrors})`);
        if (consecutiveErrors >= 10) {
          throw new Error(`BFL poll error ${pollResponse.status} after ${consecutiveErrors} retries`);
        }
        continue;
      }

      consecutiveErrors = 0;
      resultData = (await pollResponse.json()) as BflPollResponse;
      const status = resultData.status;

      if (status === "Ready") break;
      if (isTerminalFailure(status)) {
        // Content moderation, errors, etc. — don't keep polling
        const detail = resultData.error || `status: ${status}`;
        throw new Error(`BFL task rejected (${status}): ${detail}`);
      }
      // Pending | Processing -> keep polling
    }

    if (!resultData || resultData.status !== "Ready") {
      throw new Error("BFL task timed out");
    }

    const outputUrl = resultData.result?.sample;
    if (!outputUrl) {
      throw new Error("BFL returned no output image");
    }

    // Step 3: Fetch the image via relay (Azure Blob Storage lacks CORS)
    const imageProxyUrl = `${RELAY_BASE}/image?url=${encodeURIComponent(outputUrl)}`;
    const imageResponse = await fetch(imageProxyUrl, {
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
    });
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch BFL output image: ${imageResponse.status}`);
    }
    const imageBlob = await imageResponse.blob();

    this.imagesGenerated++;

    const durationMs = Date.now() - requestStart;
    console.log("[BFL] Generation complete", { taskId, durationMs });

    const debug: NetworkDebugInfo = {
      request: rawRequest,
      response: JSON.stringify(resultData),
      meta: {
        provider: "bfl",
        status: 200,
        statusText: "OK",
        durationMs,
      },
    };

    return { imageUrl: null, imageBlob, debug };
  }

  public getStats() {
    return { generated: this.imagesGenerated };
  }
}
