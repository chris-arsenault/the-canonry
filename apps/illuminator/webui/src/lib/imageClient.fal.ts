/**
 * fal.ai Upscale Client
 *
 * Async workflow: POST queue -> poll status -> fetch result -> fetch image.
 * Requests go through a relay server because fal.ai's API doesn't set CORS headers.
 * The relay is a thin passthrough (see apps/illuminator/relay/) at /fal/*.
 */

export type UpscaleModel = "clarity" | "creative" | "topaz";

export interface UpscaleRequest {
  imageDataUri: string; // base64 data URI
  model: UpscaleModel;
  factor: 2 | 4;
  creativity: number;
  resemblance: number;
  prompt: string;
  negativePrompt: string;
  falApiKey?: string; // client-provided key (falls back to server env var)
}

export interface UpscaleResult {
  imageBlob: Blob | null;
  width: number;
  height: number;
  error?: string;
}

const RELAY_BASE = "http://localhost:3100/fal";
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 600_000; // 10 minutes

const MODEL_IDS: Record<UpscaleModel, string> = {
  clarity: "fal-ai/clarity-upscaler",
  creative: "fal-ai/creative-upscaler",
  topaz: "fal-ai/topaz/upscale/image",
};

/** fal.ai queue submission response. */
interface FalQueueResponse {
  request_id: string;
  status: string;
}

/** fal.ai poll status response. */
interface FalStatusResponse {
  status: string; // IN_QUEUE | IN_PROGRESS | COMPLETED | FAILED
  error?: string;
}

/** fal.ai result response (after COMPLETED). */
interface FalResultResponse {
  image?: {
    url: string;
    width: number;
    height: number;
  };
  images?: Array<{
    url: string;
    width: number;
    height: number;
  }>;
  error?: string;
}

type StatusCallback = (status: string) => void;

function buildClarityBody(req: UpscaleRequest): Record<string, unknown> {
  return {
    image_url: req.imageDataUri,
    prompt: req.prompt,
    negative_prompt: req.negativePrompt,
    upscale_factor: req.factor,
    creativity: req.creativity,
    resemblance: req.resemblance,
    guidance_scale: 4,
    num_inference_steps: 28,
    enable_safety_checker: false,
  };
}

function buildCreativeBody(req: UpscaleRequest): Record<string, unknown> {
  return {
    image_url: req.imageDataUri,
    prompt: req.prompt,
    negative_prompt: req.negativePrompt,
    scale: req.factor,
    creativity: req.creativity,
    detail: 2.0,
    shape_preservation: 0.5,
    model_type: "SDXL",
    guidance_scale: 5,
    num_inference_steps: 30,
    enable_safety_checks: false,
  };
}

function buildTopazBody(req: UpscaleRequest): Record<string, unknown> {
  return {
    image_url: req.imageDataUri,
    model: "CGI",
    upscale_factor: req.factor,
    output_format: "png",
    face_enhancement: false,
  };
}

function buildRequestBody(req: UpscaleRequest): Record<string, unknown> {
  switch (req.model) {
    case "clarity":
      return buildClarityBody(req);
    case "creative":
      return buildCreativeBody(req);
    case "topaz":
      return buildTopazBody(req);
  }
}

function failResult(error: string): UpscaleResult {
  return { imageBlob: null, width: 0, height: 0, error };
}

/**
 * Upscale an image via fal.ai through the local relay.
 *
 * @param req         - Upscale parameters including the image data URI
 * @param onStatus    - Optional callback receiving status strings: "submitting", "processing", "downloading"
 * @param abortSignal - Optional AbortSignal for cancellation
 */
export async function upscaleImage(
  req: UpscaleRequest,
  onStatus?: StatusCallback,
  abortSignal?: AbortSignal,
): Promise<UpscaleResult> {
  const modelId = MODEL_IDS[req.model];

  try {
    // Step 1: Submit to queue
    onStatus?.("submitting");

    const body = buildRequestBody(req);
    const rawBody = JSON.stringify(body);

    console.log("[fal] Submitting upscale", {
      model: req.model,
      modelId,
      factor: req.factor,
      bodyBytes: rawBody.length,
    });

    const falKey = req.falApiKey || "";
    const authHeaders = (): Record<string, string> => falKey ? { "x-fal-key": falKey } : {};

    const submitResponse = await fetch(`${RELAY_BASE}/queue/${modelId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: rawBody,
      signal: abortSignal,
    });

    const submitText = await submitResponse.text();
    if (!submitResponse.ok) {
      let errorDetail = submitText;
      try {
        const parsed = JSON.parse(submitText);
        errorDetail = parsed.detail || parsed.error || parsed.message || submitText;
      } catch {
        /* raw text fallback */
      }
      throw new Error(`fal submit error ${submitResponse.status}: ${errorDetail}`);
    }

    const submitData = JSON.parse(submitText) as FalQueueResponse;
    const requestId = submitData.request_id;

    console.log("[fal] Queued", { requestId, status: submitData.status });

    // Step 2: Poll for completion
    onStatus?.("processing");

    const pollStart = Date.now();
    let lastStatus: FalStatusResponse | null = null;

    while (Date.now() - pollStart < POLL_TIMEOUT_MS) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      if (abortSignal?.aborted) {
        // Best-effort cancel via PUT
        try {
          await fetch(`${RELAY_BASE}/cancel/${modelId}/${requestId}`, {
            method: "PUT",
            headers: authHeaders(),
          });
        } catch {
          /* ignore cancel failures */
        }
        throw new Error("Upscale cancelled");
      }

      const pollResponse = await fetch(
        `${RELAY_BASE}/status/${modelId}/${requestId}`,
        { headers: authHeaders(), signal: abortSignal },
      );

      if (!pollResponse.ok) {
        console.warn(`[fal] Poll HTTP ${pollResponse.status}`);
        continue;
      }

      lastStatus = (await pollResponse.json()) as FalStatusResponse;

      if (lastStatus.status === "COMPLETED") break;
      if (lastStatus.status === "FAILED") {
        throw new Error(`fal task failed: ${lastStatus.error || "unknown error"}`);
      }
      // IN_QUEUE | IN_PROGRESS -> keep polling
    }

    if (!lastStatus || lastStatus.status !== "COMPLETED") {
      throw new Error("fal task timed out");
    }

    // Step 3: Fetch result metadata
    onStatus?.("downloading");

    const resultResponse = await fetch(
      `${RELAY_BASE}/result/${modelId}/${requestId}`,
      { headers: authHeaders(), signal: abortSignal },
    );

    if (!resultResponse.ok) {
      throw new Error(`fal result error ${resultResponse.status}`);
    }

    const resultData = (await resultResponse.json()) as FalResultResponse;

    // fal models return image data in either .image or .images[0]
    const imageInfo = resultData.image || resultData.images?.[0];
    if (!imageInfo?.url) {
      throw new Error("fal returned no output image");
    }

    const { url: imageUrl, width, height } = imageInfo;

    console.log("[fal] Result ready", { requestId, width, height });

    // Step 4: Fetch image through relay (avoids CORS)
    const imageProxyUrl = `${RELAY_BASE}/image?url=${encodeURIComponent(imageUrl)}`;
    const imageResponse = await fetch(imageProxyUrl, { headers: authHeaders(), signal: abortSignal });

    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch fal output image: ${imageResponse.status}`);
    }

    const imageBlob = await imageResponse.blob();

    const durationMs = Date.now() - pollStart;
    console.log("[fal] Upscale complete", { requestId, model: req.model, durationMs, width, height });

    return { imageBlob, width, height };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    console.error(`[fal] Upscale failed: ${message}`);
    return failResult(message);
  }
}
