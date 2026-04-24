# WaveSpeed.ai Image Generation Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add WaveSpeed.ai as a second image generation provider, routing by model selection — OpenAI models use the existing client, WaveSpeed models use a new async client.

**Architecture:** One `generate(request) → ImageResult` interface, two implementations. `clients.ts` picks the right one based on model ID. The worker task (`imageTask.ts`) is provider-agnostic. WaveSpeed uses async POST→poll workflow; the client hides this behind the same `generate()` promise.

**Tech Stack:** TypeScript, React, fetch API, localStorage

**Design doc:** `docs/plans/2026-03-07-wavespeed-integration-design.md`

---

### Task 1: Add WaveSpeed models to image settings

**Files:**
- Modify: `apps/illuminator/webui/src/lib/imageSettings.ts`

**Step 1: Add provider helper and WaveSpeed models to IMAGE_MODELS**

Replace the `IMAGE_MODELS` constant and add WaveSpeed entries. Add `isWaveSpeedModel()` helper. Add size/quality entries for WaveSpeed models.

```typescript
// After existing IMAGE_MODELS, reorganize into grouped structure:

export const IMAGE_MODELS = [
  // OpenAI
  { value: "gpt-image-1.5", label: "GPT Image 1.5", provider: "openai" },
  { value: "gpt-image-1", label: "GPT Image 1", provider: "openai" },
  { value: "dall-e-3", label: "DALL-E 3", provider: "openai" },
  { value: "dall-e-2", label: "DALL-E 2 (cheaper)", provider: "openai" },
  // WaveSpeed
  { value: "wavespeed-ai/qwen-image-2.0-pro/text-to-image", label: "Qwen Image 2.0 Pro", provider: "wavespeed" },
  { value: "google/nano-banana-pro/text-to-image", label: "Nano Banana Pro", provider: "wavespeed" },
  { value: "bytedance/seedream-v5.0-lite", label: "Seedream v5.0 Lite", provider: "wavespeed" },
  { value: "alibaba/wan-2.6/text-to-image", label: "WAN 2.6", provider: "wavespeed" },
  { value: "kwaivgi/kling-image-o3/text-to-image", label: "Kling O3", provider: "wavespeed" },
] as const;
```

Add a helper:

```typescript
export function isWaveSpeedModel(model: string): boolean {
  return IMAGE_MODELS.some((m) => m.value === model && m.provider === "wavespeed");
}

export function getProviderForModel(model: string): "openai" | "wavespeed" {
  return isWaveSpeedModel(model) ? "wavespeed" : "openai";
}
```

Add WaveSpeed size entries to `IMAGE_SIZES_BY_MODEL`. WaveSpeed models accept `width`/`height` rather than a size string, but we store the same `WxH` format and parse it in the client:

```typescript
// All WaveSpeed models share the same size options
const WAVESPEED_SIZES = [
  { value: "1024x1024", label: "1024x1024 (Square)" },
  { value: "1536x1024", label: "1536x1024 (Landscape)" },
  { value: "1024x1536", label: "1024x1536 (Portrait)" },
];

// Add entries for each WaveSpeed model ID
IMAGE_SIZES_BY_MODEL["wavespeed-ai/qwen-image-2.0-pro/text-to-image"] = WAVESPEED_SIZES;
IMAGE_SIZES_BY_MODEL["google/nano-banana-pro/text-to-image"] = WAVESPEED_SIZES;
IMAGE_SIZES_BY_MODEL["bytedance/seedream-v5.0-lite"] = WAVESPEED_SIZES;
IMAGE_SIZES_BY_MODEL["alibaba/wan-2.6/text-to-image"] = WAVESPEED_SIZES;
IMAGE_SIZES_BY_MODEL["kwaivgi/kling-image-o3/text-to-image"] = WAVESPEED_SIZES;
```

Add empty quality entries for WaveSpeed models (they don't have quality params):

```typescript
const WAVESPEED_QUALITY: Array<{ value: string; label: string }> = [];

IMAGE_QUALITY_BY_MODEL["wavespeed-ai/qwen-image-2.0-pro/text-to-image"] = WAVESPEED_QUALITY;
IMAGE_QUALITY_BY_MODEL["google/nano-banana-pro/text-to-image"] = WAVESPEED_QUALITY;
IMAGE_QUALITY_BY_MODEL["bytedance/seedream-v5.0-lite"] = WAVESPEED_QUALITY;
IMAGE_QUALITY_BY_MODEL["alibaba/wan-2.6/text-to-image"] = WAVESPEED_QUALITY;
IMAGE_QUALITY_BY_MODEL["kwaivgi/kling-image-o3/text-to-image"] = WAVESPEED_QUALITY;
```

**Step 2: Commit**

```bash
git add apps/illuminator/webui/src/lib/imageSettings.ts
git commit -m "feat: add WaveSpeed models to image settings"
```

---

### Task 2: Create WaveSpeed image client

**Files:**
- Create: `apps/illuminator/webui/src/lib/imageClient.wavespeed.ts`

**Step 1: Implement WaveSpeedImageClient**

This client implements the same `generate(request) → ImageResult` contract as `ImageGenerationClient`. It handles the async POST→poll workflow internally.

```typescript
/**
 * WaveSpeed.ai Image Generation Client
 *
 * Async workflow: POST task → poll for completion → fetch output image.
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

function parseSizeDimensions(size: string): { width: number; height: number } {
  const [w, h] = size.split("x").map(Number);
  return { width: w || 1024, height: h || 1024 };
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
    const { width, height } = parseSizeDimensions(size);

    const requestBody = { prompt: request.prompt, width, height };
    const rawRequest = JSON.stringify(requestBody);

    console.log("[WaveSpeed] Submitting task", { model, promptChars: request.prompt.length, width, height });

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
      // created | processing → keep polling
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
```

**Step 2: Commit**

```bash
git add apps/illuminator/webui/src/lib/imageClient.wavespeed.ts
git commit -m "feat: add WaveSpeed image generation client"
```

---

### Task 3: Update imageClient barrel export and clients factory

**Files:**
- Modify: `apps/illuminator/webui/src/lib/imageClient.ts`
- Modify: `apps/illuminator/webui/src/workers/clients.ts`
- Modify: `apps/illuminator/webui/src/workers/types.ts` (WorkerConfig)

**Step 1: Update imageClient.ts barrel**

Add WaveSpeed client export and re-export the provider helper:

```typescript
export { ImageGenerationClient as ImageClient } from "./imageClient.browser";
export { WaveSpeedImageClient } from "./imageClient.wavespeed";
export type { ImageConfig, ImageRequest, ImageResult } from "./imageClient.browser";
export { isWaveSpeedModel } from "./imageSettings";
```

**Step 2: Add wavespeedApiKey to WorkerConfig**

In `apps/illuminator/webui/src/workers/types.ts`, add to the `WorkerConfig` interface:

```typescript
wavespeedApiKey: string;
```

**Step 3: Update clients.ts to route by provider**

Replace `createClients` to pick the right image client:

```typescript
import { LLMClient } from "../lib/llmClient";
import { ImageClient, WaveSpeedImageClient, isWaveSpeedModel } from "../lib/imageClient";
import type { ImageConfig } from "../lib/imageClient";
import type { WorkerConfig } from "./types";

export function createClients(config: WorkerConfig): {
  llmClient: LLMClient;
  imageClient: { isEnabled(): boolean; generate(req: import("../lib/imageClient").ImageRequest): Promise<import("../lib/imageClient").ImageResult>; getStats(): { generated: number } };
} {
  const llmClient = new LLMClient({
    enabled: Boolean(config.anthropicApiKey),
    apiKey: config.anthropicApiKey,
    model: "claude-sonnet-4-6",
  });

  const model = config.imageModel || "dall-e-3";
  const imageConfig: ImageConfig = {
    enabled: false,
    model,
    size: config.imageSize || "1024x1024",
    quality: config.imageQuality || "standard",
  };

  let imageClient;
  if (isWaveSpeedModel(model)) {
    imageClient = new WaveSpeedImageClient({
      ...imageConfig,
      enabled: Boolean(config.wavespeedApiKey),
      apiKey: config.wavespeedApiKey,
    });
  } else {
    imageClient = new ImageClient({
      ...imageConfig,
      enabled: Boolean(config.openaiApiKey),
      apiKey: config.openaiApiKey,
    });
  }

  return { llmClient, imageClient };
}
```

**Step 4: Commit**

```bash
git add apps/illuminator/webui/src/lib/imageClient.ts apps/illuminator/webui/src/workers/clients.ts apps/illuminator/webui/src/workers/types.ts
git commit -m "feat: route image client by provider (OpenAI vs WaveSpeed)"
```

---

### Task 4: Add wavespeedApiKey to useApiKeys hook

**Files:**
- Modify: `apps/illuminator/webui/src/hooks/useApiKeys.ts`

**Step 1: Add wavespeed key state and persistence**

Add `wavespeedApiKey` and `setWavespeedApiKey` following the exact pattern of the existing `openaiApiKey`. Update the `UseApiKeysReturn` interface, add state, add to useEffect persistence, and add to return value.

In the interface (around line 4):
```typescript
wavespeedApiKey: string;
setWavespeedApiKey: Dispatch<SetStateAction<string>>;
```

In the hook body, add state (after openaiApiKey state, around line 44):
```typescript
const [wavespeedApiKey, setWavespeedApiKey] = useState<string>(() =>
  readPersistedApiKey("illuminator:wavespeedApiKey")
);
```

In the useEffect (around line 49), add persistence lines alongside the existing keys:
```typescript
if (persistApiKeys) {
  localStorage.setItem("illuminator:anthropicApiKey", anthropicApiKey);
  localStorage.setItem("illuminator:openaiApiKey", openaiApiKey);
  localStorage.setItem("illuminator:wavespeedApiKey", wavespeedApiKey);
} else {
  localStorage.removeItem("illuminator:anthropicApiKey");
  localStorage.removeItem("illuminator:openaiApiKey");
  localStorage.removeItem("illuminator:wavespeedApiKey");
}
```

Update the useEffect dependency array to include `wavespeedApiKey`.

Add to return object:
```typescript
wavespeedApiKey,
setWavespeedApiKey,
```

**Step 2: Commit**

```bash
git add apps/illuminator/webui/src/hooks/useApiKeys.ts
git commit -m "feat: add wavespeedApiKey to useApiKeys hook"
```

---

### Task 5: Add WaveSpeed API key to sidebar UI

**Files:**
- Modify: `apps/illuminator/webui/src/components/IlluminatorSidebar.jsx`

**Step 1: Add WaveSpeed key input to ApiKeySection**

Add `wavespeedApiKey` and `setWavespeedApiKey` to `ApiKeySection` props. Add a third input block after the OpenAI key block (after line 83):

```jsx
<div className="illuminator-api-dropdown-title">WaveSpeed API Key</div>
<p className="illuminator-api-dropdown-hint">Required for WaveSpeed image models.</p>
<input
  type="password"
  value={wavespeedApiKey}
  onChange={(e) => setWavespeedApiKey(e.target.value)}
  placeholder="ws-..."
  className="illuminator-api-input"
/>
```

Add the props to `ApiKeySection` destructuring (line 45), to `IlluminatorSidebar` destructuring (line 104), to the `<ApiKeySection>` usage (line 146), and to all three `propTypes` declarations.

**Step 2: Commit**

```bash
git add apps/illuminator/webui/src/components/IlluminatorSidebar.jsx
git commit -m "feat: add WaveSpeed API key input to sidebar"
```

---

### Task 6: Wire wavespeedApiKey through setup and config

**Files:**
- Modify: `apps/illuminator/webui/src/hooks/useIlluminatorSetup.ts` (lines 51-53, 202-214)

**Step 1: Add wavespeedApiKey to ApiKeys interface**

At line 53, add:
```typescript
wavespeedApiKey: string;
```

**Step 2: Add to buildWorkerConfig**

In `buildWorkerConfig` (line 202), add `wavespeedApiKey: apiKeys.wavespeedApiKey` to the returned object.

**Step 3: Commit**

```bash
git add apps/illuminator/webui/src/hooks/useIlluminatorSetup.ts
git commit -m "feat: wire wavespeedApiKey through worker config"
```

---

### Task 7: Update ConfigPanel model dropdown

**Files:**
- Modify: `apps/illuminator/webui/src/components/ConfigPanel.jsx`

**Step 1: Group models with optgroup**

Replace the model dropdown (lines 74-86) with grouped select:

```jsx
<label htmlFor="model-image" className="illuminator-label">Image Model</label>
<select id="model-image"
  value={config.imageModel}
  onChange={(e) => handleModelChange(e.target.value)}
  className="illuminator-select"
>
  <optgroup label="OpenAI">
    {IMAGE_MODELS.filter(m => m.provider === "openai").map((model) => (
      <option key={model.value} value={model.value}>
        {model.label}
      </option>
    ))}
  </optgroup>
  <optgroup label="WaveSpeed">
    {IMAGE_MODELS.filter(m => m.provider === "wavespeed").map((model) => (
      <option key={model.value} value={model.value}>
        {model.label}
      </option>
    ))}
  </optgroup>
</select>
```

**Step 2: Commit**

```bash
git add apps/illuminator/webui/src/components/ConfigPanel.jsx
git commit -m "feat: group image models by provider in ConfigPanel"
```

---

### Task 8: Update ImageSettingsDrawer for WaveSpeed quality handling

**Files:**
- Modify: `apps/illuminator/webui/src/components/ImageSettingsDrawer.tsx`

**Step 1: Hide quality section when model has no quality options**

In the Output section (around line 426), wrap the quality block with a conditional:

```tsx
{/* Quality - segmented buttons (hidden for models without quality params) */}
{qualityOptions.length > 0 && (
  <div className="isd-output-group">
    <div className="isd-output-label">Quality</div>
    <div className="isd-output-btns">
      {qualityOptions.map(opt => {
        const isSelected = settings.imageQuality === opt.value;
        return <button key={opt.value} onClick={() => onSettingsChange({
          imageQuality: opt.value
        })} className="isd-output-btn" data-selected={isSelected}>
          {opt.label}
        </button>;
      })}
    </div>
  </div>
)}
```

**Step 2: Commit**

```bash
git add apps/illuminator/webui/src/components/ImageSettingsDrawer.tsx
git commit -m "feat: hide quality section for models without quality params"
```

---

### Task 9: Update cost estimation for WaveSpeed models

**Files:**
- Modify: `apps/illuminator/webui/src/lib/costEstimation.ts`

**Step 1: Add WaveSpeed rate entries**

Import the helper and add a flat rate for WaveSpeed models. After the existing `IMAGE_MODEL_RATES` entries, add:

```typescript
import { isWaveSpeedModel } from "./imageSettings";
```

Update `estimateImageCost` to handle unknown models (WaveSpeed) with a flat rate:

At the top of `estimateImageCost`, before the existing logic:
```typescript
if (isWaveSpeedModel(model)) {
  return 0.03; // Flat estimate — WaveSpeed pricing varies by model
}
```

Same pattern in `calculateActualImageCost`:
```typescript
if (isWaveSpeedModel(model)) {
  return 0.03;
}
```

**Step 2: Commit**

```bash
git add apps/illuminator/webui/src/lib/costEstimation.ts
git commit -m "feat: add flat cost estimate for WaveSpeed models"
```

---

### Task 10: Update imageTask error message

**Files:**
- Modify: `apps/illuminator/webui/src/workers/tasks/imageTask.ts`

**Step 1: Update error message to be provider-agnostic**

At line 99, change:
```typescript
return { success: false, error: "Image generation not configured - missing OpenAI API key" };
```
to:
```typescript
return { success: false, error: "Image generation not configured - missing API key for selected image model" };
```

**Step 2: Commit**

```bash
git add apps/illuminator/webui/src/workers/tasks/imageTask.ts
git commit -m "fix: make image task error message provider-agnostic"
```

---

### Task 11: Smoke test the integration

**Step 1: Verify the dev server loads without errors**

Open the Illuminator UI. Check browser console for import/type errors. Verify:
- ConfigPanel shows two model groups (OpenAI / WaveSpeed)
- Selecting a WaveSpeed model updates size options and hides quality
- Sidebar API key section shows all three key inputs
- ImageSettingsDrawer adapts to selected model

**Step 2: Final commit with any fixups**

```bash
git add -A
git commit -m "feat: WaveSpeed.ai image generation integration"
```
