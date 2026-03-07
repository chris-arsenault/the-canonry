/**
 * WaveSpeed.ai Image Generation Client
 *
 * Async workflow: POST task -> poll for completion -> fetch output image.
 * Presents the same generate() interface as the OpenAI ImageGenerationClient.
 */

import type { ImageConfig, ImageRequest, ImageResult } from "./imageClient.browser";
import type { NetworkDebugInfo } from "./llmClient.browser";

const WAVESPEED_BASE = "https://api.wavespeed.ai/api/v3";
const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 300_000; // 5 minutes

interface WaveSpeedTaskResponse {
  code: number;
  message: string;
  data: {
    id: string;
    status: string;
    urls: { get: string };
  };
}

interface WaveSpeedResultResponse {
  code: number;
  message: string;
  data: {
    id: string;
    model: string;
    status: string; // created | processing | completed | failed
    outputs?: string[];
    timings?: { inference: number };
    error?: string;
  };
}

/** Convert "1024x1024" to WaveSpeed's "1024*1024" format. */
function toWaveSpeedSize(size: string): string {
  return size.replace("x", "*");
}

export class WaveSpeedImageClient {
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
      console.warn("[WaveSpeed] Client disabled - missing API key");
      return { imageUrl: null, skipped: true };
    }

    try {
      return await this.executeRequest(request);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      console.error(`[WaveSpeed] Generation failed: ${message}`);
      return { imageUrl: null, skipped: true, error: message };
    }
  }

  private async executeRequest(request: ImageRequest): Promise<ImageResult> {
    const model = this.config.model || "";
    const size = request.size || this.config.size || "1024x1024";
    const wavespeedSize = toWaveSpeedSize(size);

    const requestBody = { prompt: request.prompt, size: wavespeedSize };
    const rawRequest = JSON.stringify(requestBody);

    console.log("[WaveSpeed] Submitting task", { model, promptChars: request.prompt.length, size: wavespeedSize });

    // Step 1: Submit task
    const submitResponse = await fetch(`${WAVESPEED_BASE}/${model}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: rawRequest,
    });

    const submitText = await submitResponse.text();
    if (!submitResponse.ok) {
      throw new Error(`WaveSpeed submit error ${submitResponse.status}: ${submitText}`);
    }

    const submitData = JSON.parse(submitText) as WaveSpeedTaskResponse;
    const pollUrl = submitData.data.urls.get;
    const taskId = submitData.data.id;

    console.log("[WaveSpeed] Task submitted", { taskId });

    // Step 2: Poll for completion
    const requestStart = Date.now();
    let resultData: WaveSpeedResultResponse | null = null;

    while (Date.now() - requestStart < POLL_TIMEOUT_MS) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      const pollResponse = await fetch(pollUrl, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
      });

      if (!pollResponse.ok) {
        throw new Error(`WaveSpeed poll error ${pollResponse.status}`);
      }

      resultData = (await pollResponse.json()) as WaveSpeedResultResponse;
      const status = resultData.data.status;

      if (status === "completed") break;
      if (status === "failed") {
        throw new Error(`WaveSpeed task failed: ${resultData.data.error || "unknown error"}`);
      }
      // created | processing -> keep polling
    }

    if (!resultData || resultData.data.status !== "completed") {
      throw new Error("WaveSpeed task timed out");
    }

    const outputUrl = resultData.data.outputs?.[0];
    if (!outputUrl) {
      throw new Error("WaveSpeed returned no output image");
    }

    // Step 3: Fetch the image
    const imageResponse = await fetch(outputUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch WaveSpeed output image: ${imageResponse.status}`);
    }
    const imageBlob = await imageResponse.blob();

    this.imagesGenerated++;

    const durationMs = Date.now() - requestStart;
    const inferenceMs = resultData.data.timings?.inference;
    console.log("[WaveSpeed] Generation complete", { taskId, durationMs, inferenceMs });

    const debug: NetworkDebugInfo = {
      request: rawRequest,
      response: JSON.stringify(resultData.data),
      meta: {
        provider: "wavespeed",
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
