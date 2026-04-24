# WaveSpeed.ai Image Generation Integration

## Summary

Add WaveSpeed.ai as a second image generation provider alongside OpenAI. The user selects a model in ConfigPanel; if it's an OpenAI model, the existing path is used. If it's a WaveSpeed model, a new client handles the async API workflow. A curated set of top-tier WaveSpeed text-to-image models is exposed.

## WaveSpeed API

- **Base URL**: `https://api.wavespeed.ai/api/v3`
- **Auth**: `Authorization: Bearer {key}`
- **Workflow**: Async — POST `/{model-id}` returns task ID, poll GET `/predictions/{id}` until `completed`
- **Request params**: `prompt`, `width`, `height`, `seed` (model-specific)
- **Response**: `data.outputs[]` contains image URLs (fetched and converted to Blob)
- **Statuses**: `created` → `processing` → `completed` | `failed`

## Models

| Model ID | Label |
|---|---|
| `wavespeed-ai/qwen-image-2.0-pro/text-to-image` | Qwen Image 2.0 Pro |
| `google/nano-banana-pro/text-to-image` | Nano Banana Pro |
| `bytedance/seedream-v5.0-lite` | Seedream v5.0 Lite |
| `alibaba/wan-2.6/text-to-image` | WAN 2.6 |
| `kwaivgi/kling-image-o3/text-to-image` | Kling O3 |

## Architecture

One canonical `generate(request) → ImageResult` interface, two implementations. `imageTask.ts` is provider-agnostic — routing happens in `clients.ts` based on model ID.

### New Files

- `imageClient.wavespeed.ts` — `WaveSpeedImageClient` with POST → poll → fetch-blob workflow

### Modified Files

- `imageSettings.ts` — Add WaveSpeed models, size options per model, quality options (empty for WaveSpeed)
- `imageClient.ts` — Export provider detection helper `isWaveSpeedModel()`
- `clients.ts` — Create appropriate client based on model
- `useApiKeys.ts` — Add `wavespeedApiKey` state + persistence
- `IlluminatorSidebar.jsx` — Add WaveSpeed API key input
- `WorkerConfig` in `types.ts` — Add `wavespeedApiKey`
- `buildWorkerConfig` in `useIlluminatorSetup.ts` — Pass wavespeed key
- `ConfigPanel.jsx` — Group models with optgroup, rename label
- `ImageSettingsDrawer.tsx` — Hide quality section when model has no quality options
- `costEstimation.ts` — Flat per-image rate estimates for WaveSpeed models

### Unchanged

- Style/composition/palette logic (prompt-building, not API-specific)
- Claude prompt formatting (works with any image model)
- IndexedDB storage (receives Blob regardless of provider)
- `imageTask.ts` (calls `imageClient.generate()` which is provider-agnostic)

## Cost Tracking

WaveSpeed doesn't return token usage. Use flat per-image estimates ($0.03 default). Estimated cost stored; actual cost equals estimate.
