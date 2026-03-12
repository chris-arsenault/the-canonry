# Image Upscaling Feature — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Batch-upscale ~400 AI-generated images from ~1MP to 4K+ resolution for print, using fal.ai's diffusion-based upscalers with style-aware guidance prompts built from the existing style library.

**Architecture:** New "Upscale" sub-tab on PrePrintPanel. fal.ai API integration via relay extension (same pattern as BFL relay). Upscaled blobs stored in a new `upscaleBlobs` Dexie table keyed by `{imageId}:{WxH}`, allowing multiple resolution tiers per image. S3 sync extended with `hq` variant. Test mode saves to a separate `upscaleTestBlobs` table, disconnected from the primary image store.

**Tech Stack:** React + TypeScript (Illuminator webui), Dexie (IndexedDB), fal.ai REST API (queue-based async), existing relay server (Node.js HTTP), existing S3 sync (AWS SDK v3).

---

## Context: Key Files Reference

| Component | Path |
|---|---|
| Dexie schema | `apps/illuminator/webui/src/lib/db/illuminatorDb.ts` (v11, line 428) |
| Image types | `apps/illuminator/webui/src/lib/imageTypes.ts` |
| Image repository | `apps/illuminator/webui/src/lib/db/imageRepository.ts` |
| Image settings | `apps/illuminator/webui/src/lib/imageSettings.ts` |
| Worker task registry | `apps/illuminator/webui/src/workers/tasks/index.ts` |
| Task types | `apps/illuminator/webui/src/workers/tasks/taskTypes.ts` |
| Image task (reference) | `apps/illuminator/webui/src/workers/tasks/imageTask.ts` |
| Enrichment types | `apps/illuminator/webui/src/lib/enrichmentTypes.ts` |
| PrePrintPanel | `apps/illuminator/webui/src/components/PrePrintPanel.tsx` |
| Relay handler | `apps/illuminator/relay/handler.js` |
| Relay server | `apps/illuminator/relay/server.js` |
| S3 sync | `apps/canonry/webui/src/aws/awsS3.js` |
| Catalog builder | `apps/illuminator/webui/src/lib/catalogBuilder.ts` |
| Pics types | `apps/pics/webui/src/types.ts` |
| Artistic styles | `packages/world-schema/src/artisticStyles.ts` (31 styles) |
| Composition styles | `packages/world-schema/src/compositionStyles.ts` + defaults files |
| Color palettes | `packages/world-schema/src/colorPalettes.ts` (31 palettes) |

---

## Task 1: Dexie Schema Migration (v12)

Add two new tables: `upscaleBlobs` for production upscales, `upscaleTestBlobs` for test upscales.

**Files:**
- Modify: `apps/illuminator/webui/src/lib/db/illuminatorDb.ts:425-428`
- Modify: `apps/illuminator/webui/src/lib/imageTypes.ts`

**Step 1: Add upscale types to imageTypes.ts**

Add after the `ImageBlobRecord` interface (line 87):

```typescript
/** Upscaled image blob — keyed by "{imageId}:{width}x{height}" to allow multiple tiers */
export interface UpscaleBlobRecord {
  /** Compound key: "{imageId}:{width}x{height}" */
  blobId: string;
  /** FK to images table */
  imageId: string;
  blob: Blob;
  width: number;
  height: number;
  /** fal.ai upscale model used */
  model: "clarity" | "creative" | "topaz";
  /** Scale factor applied in this pass */
  factor: 2 | 4;
  creativity: number;
  resemblance: number;
  /** Guidance prompt sent to the upscaler */
  prompt: string;
  negativePrompt: string;
  /** Resolution of the source image for this pass */
  sourceWidth: number;
  sourceHeight: number;
  upscaledAt: number;
}

/** Test upscale blob — disconnected from primary image store */
export interface UpscaleTestBlobRecord {
  testId: string;
  /** Which image was upscaled (for display, not a DB link) */
  sourceImageId: string;
  blob: Blob;
  width: number;
  height: number;
  model: "clarity" | "creative" | "topaz";
  factor: 2 | 4;
  creativity: number;
  resemblance: number;
  prompt: string;
  negativePrompt: string;
  sourceWidth: number;
  sourceHeight: number;
  createdAt: number;
}
```

**Step 2: Add metadata fields to ImageMetadata**

Add to `ImageMetadata` interface in `imageTypes.ts` (after the catalog metadata block, ~line 72):

```typescript
  // Upscale metadata (set when production upscale is stored)
  /** Width of highest-resolution upscale available */
  hqWidth?: number;
  /** Height of highest-resolution upscale available */
  hqHeight?: number;
  /** Timestamp of most recent upscale */
  hqUpscaledAt?: number;
```

**Step 3: Add Dexie v12 migration**

In `illuminatorDb.ts`, replace the empty v11 declaration (line 428) — actually, add a new v12 after it:

```typescript
// v12 — upscale blob tables for print-quality image upscaling
this.version(12).stores({
  // All existing tables (redeclare unchanged)
  entities: "id, simulationRunId, kind, [simulationRunId+kind]",
  narrativeEvents: "id, simulationRunId",
  chronicles: "chronicleId, simulationRunId, projectId",
  images:
    "imageId, projectId, entityId, chronicleId, entityKind, entityCulture, model, imageType, generatedAt",
  costs: "id, projectId, simulationRunId, entityId, chronicleId, type, model, timestamp",
  traitPalettes: "id, projectId, entityKind",
  usedTraits: "id, projectId, simulationRunId, entityKind, entityId",
  historianRuns: "runId, projectId, status, createdAt",
  summaryRevisionRuns: "runId, projectId, status, createdAt",
  dynamicsRuns: "runId, projectId, status, createdAt",
  staticPages: "pageId, projectId, slug, status, updatedAt",
  styleLibrary: "id",
  imageBlobs: "imageId",
  contentTrees: "[projectId+simulationRunId]",
  relationships: "[simulationRunId+src+dst+kind], simulationRunId, src, dst, kind",
  simulationSlots: "[projectId+slotIndex], projectId, slotIndex, simulationRunId",
  worldSchemas: "projectId",
  coordinateStates: "simulationRunId",
  eraNarratives: "narrativeId, projectId, simulationRunId, eraId, status, createdAt",
  runIndexes: "simulationRunId",
  pageLayouts: "[simulationRunId+pageId], simulationRunId",

  // New: upscale blob tables
  upscaleBlobs: "blobId, imageId",
  upscaleTestBlobs: "testId, sourceImageId",
});
```

Add table declarations to the class body (near the existing `imageBlobs!` declaration):

```typescript
upscaleBlobs!: Table<UpscaleBlobRecord, string>;
upscaleTestBlobs!: Table<UpscaleTestBlobRecord, string>;
```

**Step 4: Commit**

```
feat: add Dexie v12 schema with upscale blob tables
```

---

## Task 2: Upscale Repository (CRUD for upscale blobs)

New file for upscale blob storage operations.

**Files:**
- Create: `apps/illuminator/webui/src/lib/db/upscaleRepository.ts`

**Step 1: Write the repository**

```typescript
/**
 * Upscale Repository — CRUD for upscaled image blobs.
 *
 * upscaleBlobs: production upscales keyed by "{imageId}:{WxH}".
 * upscaleTestBlobs: test upscales keyed by random testId.
 */

import { db } from "./illuminatorDb";
import type { UpscaleBlobRecord, UpscaleTestBlobRecord } from "../imageTypes";

// ---------------------------------------------------------------------------
// Production upscale blobs
// ---------------------------------------------------------------------------

function makeBlobId(imageId: string, width: number, height: number): string {
  return `${imageId}:${width}x${height}`;
}

/** Save an upscaled blob. Overwrites if same imageId + dimensions already exist. */
export async function saveUpscaleBlob(
  record: Omit<UpscaleBlobRecord, "blobId">
): Promise<string> {
  const blobId = makeBlobId(record.imageId, record.width, record.height);
  await db.upscaleBlobs.put({ ...record, blobId });

  // Update images metadata with highest upscale info
  const allForImage = await db.upscaleBlobs
    .where("imageId")
    .equals(record.imageId)
    .toArray();
  const largest = allForImage.reduce((best, cur) =>
    cur.width * cur.height > best.width * best.height ? cur : best
  );
  await db.images.update(record.imageId, {
    hqWidth: largest.width,
    hqHeight: largest.height,
    hqUpscaledAt: largest.upscaledAt,
  });

  return blobId;
}

/** Get all upscale tiers for an image, sorted largest first. */
export async function getUpscaleBlobsForImage(
  imageId: string
): Promise<UpscaleBlobRecord[]> {
  const blobs = await db.upscaleBlobs
    .where("imageId")
    .equals(imageId)
    .toArray();
  return blobs.sort((a, b) => b.width * b.height - a.width * a.height);
}

/** Get the highest-resolution upscale blob for an image. */
export async function getHighestUpscaleBlob(
  imageId: string
): Promise<UpscaleBlobRecord | undefined> {
  const blobs = await getUpscaleBlobsForImage(imageId);
  return blobs[0];
}

/** Get the best available source blob for upscaling (highest upscale, or original). */
export async function getBestSourceBlob(
  imageId: string
): Promise<{ blob: Blob; width: number; height: number }> {
  const highest = await getHighestUpscaleBlob(imageId);
  if (highest) {
    return { blob: highest.blob, width: highest.width, height: highest.height };
  }
  // Fall back to original
  const original = await db.imageBlobs.get(imageId);
  if (!original) throw new Error(`No blob found for image ${imageId}`);
  const meta = await db.images.get(imageId);
  return {
    blob: original.blob,
    width: meta?.width || 0,
    height: meta?.height || 0,
  };
}

/** Delete all upscale blobs for an image. */
export async function deleteUpscaleBlobsForImage(imageId: string): Promise<void> {
  await db.upscaleBlobs.where("imageId").equals(imageId).delete();
  await db.images.update(imageId, {
    hqWidth: undefined,
    hqHeight: undefined,
    hqUpscaledAt: undefined,
  });
}

// ---------------------------------------------------------------------------
// Test upscale blobs
// ---------------------------------------------------------------------------

/** Save a test upscale blob. Returns the testId. */
export async function saveTestUpscaleBlob(
  record: UpscaleTestBlobRecord
): Promise<string> {
  await db.upscaleTestBlobs.put(record);
  return record.testId;
}

/** Get all test upscales for a given source image. */
export async function getTestBlobsForImage(
  sourceImageId: string
): Promise<UpscaleTestBlobRecord[]> {
  return db.upscaleTestBlobs
    .where("sourceImageId")
    .equals(sourceImageId)
    .toArray();
}

/** Get all test blobs (for test results strip). */
export async function getAllTestBlobs(): Promise<UpscaleTestBlobRecord[]> {
  return db.upscaleTestBlobs.toArray();
}

/** Promote a test blob to production. Moves from test table to upscale table. */
export async function promoteTestBlob(testId: string): Promise<string> {
  const test = await db.upscaleTestBlobs.get(testId);
  if (!test) throw new Error(`Test blob ${testId} not found`);

  const blobId = await saveUpscaleBlob({
    imageId: test.sourceImageId,
    blob: test.blob,
    width: test.width,
    height: test.height,
    model: test.model,
    factor: test.factor,
    creativity: test.creativity,
    resemblance: test.resemblance,
    prompt: test.prompt,
    negativePrompt: test.negativePrompt,
    sourceWidth: test.sourceWidth,
    sourceHeight: test.sourceHeight,
    upscaledAt: Date.now(),
  });

  await db.upscaleTestBlobs.delete(testId);
  return blobId;
}

/** Delete a single test blob. */
export async function deleteTestBlob(testId: string): Promise<void> {
  await db.upscaleTestBlobs.delete(testId);
}

/** Delete all test blobs. */
export async function clearAllTestBlobs(): Promise<void> {
  await db.upscaleTestBlobs.clear();
}
```

**Step 2: Commit**

```
feat: add upscale repository for production and test blob CRUD
```

---

## Task 3: fal.ai Relay Extension

Extend the existing BFL relay with `/fal` routes. The relay injects the `FAL_KEY` server-side — browser never sees it.

**Files:**
- Create: `apps/illuminator/relay/falHandler.js`
- Modify: `apps/illuminator/relay/server.js:17` (add route dispatch)

**Step 1: Create the fal.ai handler**

`apps/illuminator/relay/falHandler.js`:

```javascript
/**
 * fal.ai API Relay — Lambda-compatible handler
 *
 * Forwards requests to fal.ai queue API with Authorization header injected.
 * The browser sends requests to /fal/* and the relay adds the API key.
 *
 * Routes:
 *   POST /fal/queue/:modelId       → POST https://queue.fal.run/:modelId
 *   GET  /fal/status/:modelId/:id  → GET  https://queue.fal.run/:modelId/requests/:id/status
 *   GET  /fal/result/:modelId/:id  → GET  https://queue.fal.run/:modelId/requests/:id
 *   PUT  /fal/cancel/:modelId/:id  → PUT  https://queue.fal.run/:modelId/requests/:id/cancel
 *   GET  /fal/image?url=           → GET  (proxy fal output image download)
 */

const FAL_QUEUE_BASE = "https://queue.fal.run";
const FAL_KEY = process.env.FAL_KEY || "";

const SUBMIT_TIMEOUT_MS = 30_000;
const POLL_TIMEOUT_MS = 15_000;
const IMAGE_TIMEOUT_MS = 120_000; // upscaled images can be large

const LOG_LEVEL = (process.env.FAL_RELAY_LOG || "info").toLowerCase();
const isDebug = LOG_LEVEL === "debug";

function logDebug(...args) {
  if (isDebug) console.log("[fal relay]", ...args);
}

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
  "access-control-allow-headers": "content-type, accept",
  "access-control-max-age": "86400",
};

function json(statusCode, body, extra = {}) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, "content-type": "application/json", ...extra },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}

/** Allowed hosts for image proxying */
const ALLOWED_IMAGE_HOSTS = [
  ".fal.run",
  ".fal.ai",
  "fal.media",
  ".amazonaws.com",
];

function isAllowedImageHost(hostname) {
  return ALLOWED_IMAGE_HOSTS.some(
    (suffix) => hostname === suffix.replace(/^\./, "") || hostname.endsWith(suffix)
  );
}

/**
 * Parse route from path like /fal/queue/fal-ai/clarity-upscaler
 * Returns { action, modelId, requestId }
 */
function parseRoute(path) {
  // Strip leading /fal/
  const rest = path.replace(/^\/fal\//, "");
  const parts = rest.split("/");

  if (parts[0] === "image") return { action: "image" };

  // /fal/queue/fal-ai/clarity-upscaler → action=queue, modelId=fal-ai/clarity-upscaler
  // /fal/status/fal-ai/clarity-upscaler/REQ_ID → action=status, modelId=fal-ai/clarity-upscaler, requestId=REQ_ID
  // /fal/result/fal-ai/clarity-upscaler/REQ_ID → action=result
  // /fal/cancel/fal-ai/clarity-upscaler/REQ_ID → action=cancel
  const action = parts[0]; // queue | status | result | cancel
  // Model IDs contain slashes (e.g. fal-ai/clarity-upscaler or fal-ai/topaz/upscale/image)
  // The request ID is always the last segment for status/result/cancel
  if (action === "queue") {
    return { action, modelId: parts.slice(1).join("/") };
  }
  // For status/result/cancel, the last part is the request ID
  const requestId = parts[parts.length - 1];
  const modelId = parts.slice(1, -1).join("/");
  return { action, modelId, requestId };
}

export async function handler(event) {
  const { method, path, headers, body } = event;
  const query = new URLSearchParams(event.queryString || "");

  if (method === "OPTIONS") return json(204, "");

  if (!path.startsWith("/fal/")) {
    return json(404, { error: "Not a fal route" });
  }

  if (!FAL_KEY) {
    return json(500, { error: "FAL_KEY not configured on relay" });
  }

  const route = parseRoute(path);
  logDebug(`${method} ${path} → action=${route.action} model=${route.modelId}`);

  try {
    if (route.action === "image") {
      return await handleImageProxy(query);
    }
    if (route.action === "queue" && method === "POST") {
      return await handleSubmit(route.modelId, body);
    }
    if (route.action === "status" && method === "GET") {
      return await handleStatus(route.modelId, route.requestId, query);
    }
    if (route.action === "result" && method === "GET") {
      return await handleResult(route.modelId, route.requestId);
    }
    if (route.action === "cancel" && method === "PUT") {
      return await handleCancel(route.modelId, route.requestId);
    }
    return json(400, { error: `Unknown fal action: ${route.action}` });
  } catch (err) {
    console.error("[fal relay] Error:", err.message);
    return json(502, { error: err.message });
  }
}

async function handleSubmit(modelId, body) {
  const url = `${FAL_QUEUE_BASE}/${modelId}`;
  logDebug("Submit →", url);
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${FAL_KEY}`,
    },
    body,
    signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
  });
  const text = await resp.text();
  return json(resp.status, text);
}

async function handleStatus(modelId, requestId, query) {
  const logs = query.get("logs") ? "?logs=1" : "";
  const url = `${FAL_QUEUE_BASE}/${modelId}/requests/${requestId}/status${logs}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Key ${FAL_KEY}` },
    signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
  });
  const text = await resp.text();
  return json(resp.status, text);
}

async function handleResult(modelId, requestId) {
  const url = `${FAL_QUEUE_BASE}/${modelId}/requests/${requestId}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Key ${FAL_KEY}` },
    signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
  });
  const text = await resp.text();
  return json(resp.status, text);
}

async function handleCancel(modelId, requestId) {
  const url = `${FAL_QUEUE_BASE}/${modelId}/requests/${requestId}/cancel`;
  const resp = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Key ${FAL_KEY}` },
    signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
  });
  const text = await resp.text();
  return json(resp.status, text);
}

async function handleImageProxy(query) {
  const imageUrl = query.get("url");
  if (!imageUrl) return json(400, { error: "Missing url parameter" });

  let hostname;
  try {
    hostname = new URL(imageUrl).hostname;
  } catch {
    return json(400, { error: "Invalid url parameter" });
  }
  if (!isAllowedImageHost(hostname)) {
    return json(403, { error: `Host ${hostname} not allowed for image proxy` });
  }

  const resp = await fetch(imageUrl, {
    signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
  });
  if (!resp.ok) {
    return json(resp.status, { error: `Image fetch failed: ${resp.status}` });
  }

  const buffer = Buffer.from(await resp.arrayBuffer());
  return {
    statusCode: 200,
    headers: {
      ...CORS_HEADERS,
      "content-type": resp.headers.get("content-type") || "image/png",
      "content-length": String(buffer.length),
    },
    body: buffer.toString("base64"),
    isBase64Encoded: true,
  };
}
```

**Step 2: Wire into relay server**

In `apps/illuminator/relay/server.js`, import the fal handler and route `/fal/*` to it. The BFL handler continues to handle `/bfl/*`.

Modify the server's request handler to dispatch:
- `/fal/*` → `falHandler.handler(event)`
- `/bfl/*` → `bflHandler.handler(event)` (existing)

**Step 3: Commit**

```
feat: add fal.ai relay handler for upscale API proxying
```

---

## Task 4: fal.ai Client Library

Browser-side client that talks to the relay. Mirrors the WaveSpeed client pattern: submit → poll → fetch.

**Files:**
- Create: `apps/illuminator/webui/src/lib/imageClient.fal.ts`

**Step 1: Write the client**

```typescript
/**
 * fal.ai Upscale Client
 *
 * Queue-based async workflow via relay:
 *   POST /fal/queue/:model → poll /fal/status/:model/:id → GET /fal/result/:model/:id
 *   Output image fetched via /fal/image?url=
 */

const RELAY_BASE = "http://localhost:3100/fal";
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 600_000; // 10 minutes — upscaling is slow

export type UpscaleModel = "clarity" | "creative" | "topaz";

/** fal.ai model IDs for each upscaler */
const MODEL_IDS: Record<UpscaleModel, string> = {
  clarity: "fal-ai/clarity-upscaler",
  creative: "fal-ai/creative-upscaler",
  topaz: "fal-ai/topaz/upscale/image",
};

export interface UpscaleRequest {
  imageDataUri: string; // base64 data URI
  model: UpscaleModel;
  factor: 2 | 4;
  creativity: number;
  resemblance: number;
  prompt: string;
  negativePrompt: string;
}

export interface UpscaleResult {
  imageBlob: Blob | null;
  width: number;
  height: number;
  error?: string;
}

function buildRequestBody(req: UpscaleRequest): Record<string, unknown> {
  const { model, imageDataUri, factor, creativity, resemblance, prompt, negativePrompt } = req;

  if (model === "clarity") {
    return {
      image_url: imageDataUri,
      prompt,
      negative_prompt: negativePrompt,
      upscale_factor: factor,
      creativity,
      resemblance,
      guidance_scale: 4,
      num_inference_steps: 28,
      enable_safety_checker: false,
    };
  }

  if (model === "creative") {
    return {
      image_url: imageDataUri,
      prompt,
      negative_prompt: negativePrompt,
      scale: factor,
      creativity: creativity,
      detail: 2.0,
      shape_preservation: 0.5,
      model_type: "SDXL",
      guidance_scale: 5,
      num_inference_steps: 30,
      enable_safety_checks: false,
    };
  }

  // topaz — no prompt support, use CGI model
  return {
    image_url: imageDataUri,
    model: "CGI",
    upscale_factor: factor,
    output_format: "png",
    face_enhancement: false,
  };
}

export async function upscaleImage(
  req: UpscaleRequest,
  onStatus?: (status: string) => void,
  abortSignal?: AbortSignal,
): Promise<UpscaleResult> {
  const modelId = MODEL_IDS[req.model];
  const body = buildRequestBody(req);

  // Step 1: Submit to queue
  onStatus?.("submitting");
  const submitResp = await fetch(`${RELAY_BASE}/queue/${modelId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: abortSignal,
  });

  if (!submitResp.ok) {
    const text = await submitResp.text();
    return { imageBlob: null, width: 0, height: 0, error: `Submit failed (${submitResp.status}): ${text}` };
  }

  const submitData = await submitResp.json();
  const requestId = submitData.request_id;

  // Step 2: Poll for completion
  onStatus?.("processing");
  const pollStart = Date.now();
  while (Date.now() - pollStart < POLL_TIMEOUT_MS) {
    if (abortSignal?.aborted) {
      // Try to cancel
      fetch(`${RELAY_BASE}/cancel/${modelId}/${requestId}`, { method: "PUT" }).catch(() => {});
      return { imageBlob: null, width: 0, height: 0, error: "Aborted" };
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const statusResp = await fetch(
      `${RELAY_BASE}/status/${modelId}/${requestId}`,
      { signal: abortSignal },
    );
    if (!statusResp.ok) continue;

    const statusData = await statusResp.json();
    if (statusData.status === "COMPLETED") break;
    if (statusData.status === "FAILED") {
      return { imageBlob: null, width: 0, height: 0, error: "fal.ai task failed" };
    }
    // IN_QUEUE or IN_PROGRESS → keep polling
  }

  // Step 3: Fetch result
  onStatus?.("downloading");
  const resultResp = await fetch(
    `${RELAY_BASE}/result/${modelId}/${requestId}`,
    { signal: abortSignal },
  );
  if (!resultResp.ok) {
    return { imageBlob: null, width: 0, height: 0, error: `Result fetch failed: ${resultResp.status}` };
  }

  const resultData = await resultResp.json();
  const imageInfo = resultData.image;
  if (!imageInfo?.url) {
    return { imageBlob: null, width: 0, height: 0, error: "No image URL in result" };
  }

  // Step 4: Fetch the image via relay proxy
  const imageResp = await fetch(
    `${RELAY_BASE}/image?url=${encodeURIComponent(imageInfo.url)}`,
    { signal: abortSignal },
  );
  if (!imageResp.ok) {
    return { imageBlob: null, width: 0, height: 0, error: `Image download failed: ${imageResp.status}` };
  }

  const imageBlob = await imageResp.blob();
  return {
    imageBlob,
    width: imageInfo.width || 0,
    height: imageInfo.height || 0,
  };
}
```

**Step 2: Commit**

```
feat: add fal.ai upscale client library with relay integration
```

---

## Task 5: Upscale Prompt Builder

Builds style-aware guidance prompts from the style library metadata stored on each image.

**Files:**
- Create: `apps/illuminator/webui/src/lib/upscalePromptBuilder.ts`

**Step 1: Write the prompt builder**

```typescript
/**
 * Upscale Prompt Builder
 *
 * Builds guidance prompts for diffusion-based upscalers from the style library
 * metadata stored on each image record (artisticStyleId, compositionStyleId,
 * colorPaletteId).
 *
 * Design principles:
 * - Tell the upscaler what KIND of image it's looking at (medium, palette)
 *   so it hallucinates appropriate texture, NOT what to generate.
 * - Use style name + artist exemplar for medium anchoring.
 * - Use palette promptFragment for color constraints (includes "no X" directives).
 * - Use composition name (not promptFragment — that's scene direction, not upscale).
 * - Permanent anti-slop layer prevents regression to training corpus mean.
 */

import type { StyleLibrary } from "@canonry/world-schema";

// ---------------------------------------------------------------------------
// Anti-slop constants — permanent across all images
// ---------------------------------------------------------------------------

/** Positive anchors: what this world IS */
const WORLD_ANCHORS = [
  "Dark, weathered, world-weary tone",
  "Emperor penguin subjects, non-human world",
  "High detail, print quality",
].join(". ");

/** Negative anchors: what the upscaler must NOT hallucinate toward */
const ANTI_SLOP_NEGATIVE = [
  "human face", "human hands", "human skin", "humanoid features",
  "smooth plastic skin", "stock photography", "generic AI art",
  "bright cheerful lighting", "clean pristine surfaces", "modern clean aesthetic",
  "text", "watermark", "signature", "blurry", "low quality",
].join(", ");

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface UpscalePromptPair {
  prompt: string;
  negativePrompt: string;
}

/**
 * Build an upscale guidance prompt from style library metadata.
 *
 * Falls back gracefully: images without style IDs get only the anti-slop layer.
 */
export function buildUpscalePrompt(
  styleLibrary: StyleLibrary | null,
  artisticStyleId?: string,
  compositionStyleId?: string,
  colorPaletteId?: string,
): UpscalePromptPair {
  const promptParts: string[] = [];
  const negativeParts: string[] = [];

  if (styleLibrary) {
    // Artistic style: name + artist exemplar (anchors medium/texture)
    if (artisticStyleId) {
      const style = styleLibrary.artisticStyles.find((s) => s.id === artisticStyleId);
      if (style) {
        const exemplar = style.artistExemplar
          ? `, ${style.artistExemplar} influence`
          : "";
        promptParts.push(`${style.name}${exemplar}`);
        if (style.negativePrompt) {
          negativeParts.push(style.negativePrompt);
        }
      }
    }

    // Composition style: name only (not promptFragment — that's scene direction)
    if (compositionStyleId) {
      const comp = styleLibrary.compositionStyles.find((s) => s.id === compositionStyleId);
      if (comp) {
        promptParts.push(`${comp.name} composition`);
      }
    }

    // Color palette: name + full promptFragment (includes hex associations + "no X" constraints)
    if (colorPaletteId) {
      const palette = styleLibrary.colorPalettes.find((p) => p.id === colorPaletteId);
      if (palette) {
        promptParts.push(`${palette.name} palette`);
        // The promptFragment contains detailed color constraints like
        // "dominated by deep crimsons, no orange or brown tones"
        promptParts.push(palette.promptFragment);
      }
    }
  }

  // Anti-slop layer (always present)
  promptParts.push(WORLD_ANCHORS);
  negativeParts.push(ANTI_SLOP_NEGATIVE);

  return {
    prompt: promptParts.join(". "),
    negativePrompt: negativeParts.join(", "),
  };
}
```

**Step 2: Commit**

```
feat: add upscale prompt builder with style library integration and anti-slop layer
```

---

## Task 6: Upscale Worker Task

New task handler registered in the enrichment worker.

**Files:**
- Create: `apps/illuminator/webui/src/workers/tasks/upscaleTask.ts`
- Modify: `apps/illuminator/webui/src/workers/tasks/index.ts` (register)
- Modify: `apps/illuminator/webui/src/lib/enrichmentTypes.ts` (add to WorkerTask union)

**Step 1: Add upscale task type to enrichmentTypes.ts**

Add to the `WorkerTask` discriminated union (find where the other task types are declared):

```typescript
| {
    type: "upscale";
    imageId: string;
    upscaleModel: "clarity" | "creative" | "topaz";
    factor: 2 | 4;
    creativity: number;
    resemblance: number;
    prompt: string;
    negativePrompt: string;
    testMode: boolean;
    // Carried for display — not used by the task itself
    entityId: string;
    entityName: string;
    entityKind: string;
    projectId: string;
  }
```

**Step 2: Write the upscale task handler**

`apps/illuminator/webui/src/workers/tasks/upscaleTask.ts`:

```typescript
import type { WorkerTask } from "../../lib/enrichmentTypes";
import type { TaskHandler } from "./taskTypes";
import { upscaleImage } from "../../lib/imageClient.fal";
import {
  getBestSourceBlob,
  saveUpscaleBlob,
  saveTestUpscaleBlob,
} from "../../lib/db/upscaleRepository";
import { extractImageDimensions } from "../../lib/db/imageRepository";

export const upscaleTask = {
  type: "upscale",
  async execute(task, context) {
    const { isAborted } = context;

    // Get best available source (highest upscale or original)
    const source = await getBestSourceBlob(task.imageId);
    if (!source.blob) {
      return { success: false, error: `No source blob for image ${task.imageId}` };
    }

    if (isAborted()) return { success: false, error: "Aborted" };

    // Convert source blob to base64 data URI
    const arrayBuffer = await source.blob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((s, b) => s + String.fromCharCode(b), "")
    );
    const mimeType = source.blob.type || "image/png";
    const dataUri = `data:${mimeType};base64,${base64}`;

    if (isAborted()) return { success: false, error: "Aborted" };

    // Call fal.ai upscaler
    const result = await upscaleImage({
      imageDataUri: dataUri,
      model: task.upscaleModel,
      factor: task.factor,
      creativity: task.creativity,
      resemblance: task.resemblance,
      prompt: task.prompt,
      negativePrompt: task.negativePrompt,
    });

    if (isAborted()) return { success: false, error: "Aborted" };

    if (result.error || !result.imageBlob) {
      return { success: false, error: result.error || "No image returned" };
    }

    // Extract actual dimensions from the result blob
    const dimensions = await extractImageDimensions(result.imageBlob);
    const width = dimensions.width || result.width;
    const height = dimensions.height || result.height;

    if (task.testMode) {
      // Save to test table (disconnected from primary store)
      const testId = `test_${task.imageId}_${Date.now()}`;
      await saveTestUpscaleBlob({
        testId,
        sourceImageId: task.imageId,
        blob: result.imageBlob,
        width,
        height,
        model: task.upscaleModel,
        factor: task.factor,
        creativity: task.creativity,
        resemblance: task.resemblance,
        prompt: task.prompt,
        negativePrompt: task.negativePrompt,
        sourceWidth: source.width,
        sourceHeight: source.height,
        createdAt: Date.now(),
      });

      return {
        success: true,
        result: { testId, width, height, model: task.upscaleModel },
      };
    }

    // Save to production upscale table
    const blobId = await saveUpscaleBlob({
      imageId: task.imageId,
      blob: result.imageBlob,
      width,
      height,
      model: task.upscaleModel,
      factor: task.factor,
      creativity: task.creativity,
      resemblance: task.resemblance,
      prompt: task.prompt,
      negativePrompt: task.negativePrompt,
      sourceWidth: source.width,
      sourceHeight: source.height,
      upscaledAt: Date.now(),
    });

    return {
      success: true,
      result: { blobId, width, height, model: task.upscaleModel },
    };
  },
} satisfies TaskHandler<WorkerTask & { type: "upscale" }>;
```

**Step 3: Register in task index**

In `apps/illuminator/webui/src/workers/tasks/index.ts`:

- Import: `import { upscaleTask } from "./upscaleTask";`
- Add to `TASK_HANDLERS`: `upscale: upscaleTask,`
- Add to named exports

**Step 4: Commit**

```
feat: add upscale worker task with fal.ai integration and test/production modes
```

---

## Task 7: S3 Sync — HQ Variant Upload

Extend S3 sync to upload the highest-resolution upscale blob as an `hq` variant.

**Files:**
- Modify: `apps/canonry/webui/src/aws/awsS3.js` (sync function + manifest entry)

**Step 1: Extend the sync loop**

In `syncProjectImagesToS3`, after the existing webp/thumb variant upload block (~line 483-489), add HQ variant upload:

```javascript
// Upload HQ variant if an upscale exists
try {
  const { getHighestUpscaleBlob } = await import(
    /* webpackIgnore: true */
    "../../../illuminator/webui/src/lib/db/upscaleRepository"
  );
  const hqBlob = await getHighestUpscaleBlob(image.imageId);
  if (hqBlob) {
    const hqKey = toS3Key(basePrefix, "hq", projectId, `${image.imageId}.png`);
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: hqKey,
      Body: new Uint8Array(await hqBlob.blob.arrayBuffer()),
      ContentType: "image/png",
      CacheControl: "public, max-age=31536000, immutable",
    }));
    manifestEntry.hqKey = hqKey;
    manifestEntry.hqWidth = hqBlob.width;
    manifestEntry.hqHeight = hqBlob.height;
  }
} catch (hqErr) {
  console.warn(`[awsS3] HQ upload failed for ${image.imageId}:`, hqErr);
}
```

Note: The dynamic import above is a sketch. The actual implementation should import the upscale repository at the top of the sync function or pass `getHighestUpscaleBlob` as a dependency. Decide at implementation time based on module boundary preferences — the canonry app importing from illuminator's DB may need a shared export.

**Step 2: Commit**

```
feat: extend S3 sync with HQ variant upload from upscale blobs
```

---

## Task 8: Catalog Builder — HQ Path

Extend catalog entries with optional `hqPath` for the pics viewer.

**Files:**
- Modify: `apps/illuminator/webui/src/lib/catalogBuilder.ts:111-112`
- Modify: `apps/pics/webui/src/types.ts:23` (add `hqPath` field)

**Step 1: Add hqPath to CatalogImageBase**

In `apps/pics/webui/src/types.ts`, add after `fullPath`:

```typescript
  /** High-quality upscaled version for print (optional, largest upscale tier) */
  hqPath?: string;
```

**Step 2: Extend catalog builder**

In `apps/illuminator/webui/src/lib/catalogBuilder.ts`, where `thumbPath` and `fullPath` are built (~line 111-112), add:

```typescript
  hqPath: img.hqWidth
    ? buildImagePath(imagePrefix, "hq", projectId, `${img.imageId}.png`)
    : undefined,
```

This conditionally includes `hqPath` only for images that have been upscaled (indicated by `hqWidth` on the images metadata).

**Step 3: Commit**

```
feat: add hqPath to catalog entries for upscaled images
```

---

## Task 9: Pics App — Prefer HQ in Display Contexts

Lightbox, slideshow, and compare views should use `hqPath` when available.

**Files:**
- Modify: `apps/pics/webui/src/Lightbox.tsx`
- Modify: `apps/pics/webui/src/Slideshow.tsx`
- Modify: `apps/pics/webui/src/Compare.tsx`

**Step 1: Add URL resolver**

In each component, where `fullPath` is resolved to a display URL, replace with:

```typescript
const displayPath = image.hqPath ?? image.fullPath;
```

This is a one-line change per component. `MasonryGrid.tsx` stays on `thumbPath` (thumbnails don't need HQ).

**Step 2: Commit**

```
feat: prefer HQ path in pics lightbox, slideshow, and compare views
```

---

## Task 10: Upscale Sub-Tab on PrePrintPanel

The main UI component. New "Upscale" sub-tab alongside Stats, Tree, Export.

**Files:**
- Create: `apps/illuminator/webui/src/components/preprint/UpscaleView.tsx`
- Create: `apps/illuminator/webui/src/components/preprint/UpscaleView.css`
- Modify: `apps/illuminator/webui/src/components/PrePrintPanel.tsx:27,171-175`

This is the largest task. Break into sub-steps:

**Step 1: Add sub-tab routing in PrePrintPanel**

In `PrePrintPanel.tsx`:
- Add `"upscale"` to the `SubTab` type union (line 27)
- Add `{ id: "upscale", label: "Upscale" }` to `subTabs` array (line 171-175)
- Import and render `UpscaleView` in the content area
- Pass `images`, `projectId`, `simulationRunId` to it

**Step 2: Create UpscaleView component**

`apps/illuminator/webui/src/components/preprint/UpscaleView.tsx`:

The component has four sections:

1. **Settings bar** — Model selector (Clarity/Creative/Topaz), factor selector (2x/4x), creativity slider, resemblance slider, test mode checkbox, cost estimate, batch action button.

2. **Image grid** — Filtered publishable images with status badges (none / upscaled / test available). Each card shows thumbnail, current dimensions, style name. Checkbox selection for batch operations.

3. **Before/after preview** — Side panel or modal. Shows original and upscaled side-by-side. Resolution tier dropdown when multiple tiers exist. Slider overlay for comparison. For test results: "Promote to HQ" button.

4. **Test results strip** — Visible when test results exist for the selected image. Shows horizontal strip of thumbnails from `upscaleTestBlobs`, each with settings diff labels.

Key implementation notes:
- Uses `useStyleLibrary` hook to get the StyleLibrary for prompt building
- Uses `buildUpscalePrompt()` to construct prompts
- Uses the enrichment queue store's `enqueue()` to submit upscale tasks
- Progress tracked via existing toast/activity panel infrastructure
- Cost estimate: `(imageCount × factor² × sourceMP × $0.03)` for Clarity, live-updating

**Step 3: Create UpscaleView.css**

Follow existing PrePrint CSS patterns from `apps/illuminator/webui/src/components/PrePrintPanel.css`.

**Step 4: Commit**

```
feat: add Upscale sub-tab to PrePrint panel with batch upscaling UI
```

---

## Task 11: Resolution Switcher in PrePrint

After production upscales exist, PrePrint panel shows a resolution dropdown per image.

**Files:**
- Modify: `apps/illuminator/webui/src/components/preprint/UpscaleView.tsx`

**Step 1: Implement resolution tier display**

For each image card in the grid that has upscale blobs:

```
[▼ 4096×6144]
    4096×6144  (2x from 2048×3072, Clarity 0.30, Mar 10)
    2048×3072  (2x from 1024×1536, Clarity 0.30, Mar 10)
    1024×1536  (original)
```

Uses `getUpscaleBlobsForImage(imageId)` to fetch all tiers. Clicking a tier loads that blob for preview. The before/after slider works between any two selected tiers.

**Step 2: Commit**

```
feat: add resolution tier switcher for upscaled images in PrePrint
```

---

## Task Summary

| # | Task | Creates | Modifies | Estimated Size |
|---|---|---|---|---|
| 1 | Dexie v12 migration | — | illuminatorDb.ts, imageTypes.ts | Small |
| 2 | Upscale repository | upscaleRepository.ts | — | Medium |
| 3 | fal.ai relay handler | falHandler.js | server.js | Medium |
| 4 | fal.ai client library | imageClient.fal.ts | — | Medium |
| 5 | Upscale prompt builder | upscalePromptBuilder.ts | — | Small |
| 6 | Upscale worker task | upscaleTask.ts | index.ts, enrichmentTypes.ts | Medium |
| 7 | S3 sync HQ variant | — | awsS3.js | Small |
| 8 | Catalog builder hqPath | — | catalogBuilder.ts, types.ts | Small |
| 9 | Pics app HQ preference | — | Lightbox/Slideshow/Compare.tsx | Small |
| 10 | Upscale UI sub-tab | UpscaleView.tsx + .css | PrePrintPanel.tsx | Large |
| 11 | Resolution switcher | — | UpscaleView.tsx | Medium |

**Dependency order:** 1 → 2 → 3+4+5 (parallel) → 6 → 7+8 (parallel) → 9 → 10 → 11

Tasks 3, 4, 5 have no dependencies on each other and can be implemented in parallel. Tasks 7 and 8 are also independent.

---

## Appendix A: fal.ai Model Parameter Reference

### Clarity Upscaler (`fal-ai/clarity-upscaler`)

| Parameter | Type | Default | Range | Notes |
|---|---|---|---|---|
| `image_url` | string | required | — | base64 data URI accepted |
| `prompt` | string | `"masterpiece, best quality, highres"` | — | |
| `negative_prompt` | string | `"(worst quality, low quality...)"` | — | |
| `upscale_factor` | float | 2 | 1–4 | |
| `creativity` | float | 0.35 | 0–1 | Denoise strength |
| `resemblance` | float | 0.6 | 0–1 | ControlNet fidelity |
| `guidance_scale` | float | 4 | 0–20 | CFG |
| `num_inference_steps` | int | 18 | 4–50 | |
| `seed` | int | null | — | |
| `enable_safety_checker` | bool | true | — | |

**Pricing:** $0.03 per output megapixel

### Creative Upscaler (`fal-ai/creative-upscaler`)

| Parameter | Type | Default | Range | Notes |
|---|---|---|---|---|
| `image_url` | string | required | — | |
| `prompt` | string | auto (BLIP2) | — | |
| `negative_prompt` | string | default set | — | |
| `model_type` | enum | SD_1_5 | SD_1_5, SDXL | |
| `scale` | float | 2 | 1–5 | |
| `creativity` | float | 0.5 | 0–1 | |
| `detail` | float | 1 | 0–5 | |
| `shape_preservation` | float | 0.25 | 0–3 | |
| `guidance_scale` | float | 7.5 | 0–16 | |
| `num_inference_steps` | int | 20 | 1–200 | |

**Pricing:** Per compute-second

### Topaz (`fal-ai/topaz/upscale/image`)

| Parameter | Type | Default | Range | Notes |
|---|---|---|---|---|
| `image_url` | string | required | — | |
| `model` | enum | Standard V2 | 10 models | Use `CGI` for AI art |
| `upscale_factor` | float | 2 | 1–4 | |
| `output_format` | enum | jpeg | jpeg, png | |
| `face_enhancement` | bool | true | — | Set false for penguins |
| `prompt` | string | — | max 1024 | Redefine model only |

**Pricing:** Tiered — $0.08 (≤24MP), $0.16 (≤48MP), $0.32 (≤96MP)

---

## Appendix B: Cost Estimates

### Per-image at 4x from 1MP source (→ ~16MP output)

| Model | Cost |
|---|---|
| Clarity | 16MP × $0.03 = $0.48 |
| Topaz | $0.08 (under 24MP tier) |
| Creative | ~$0.15 (compute-time based) |

### 400 images at 4x

| Model | Total |
|---|---|
| Clarity | ~$192 |
| Topaz | ~$32 |
| Creative | ~$60 |

### Multi-pass (2x then 2x again) from 1MP

| Pass | Output | Clarity Cost | Topaz Cost |
|---|---|---|---|
| Pass 1 (2x) | 4MP | $0.12 | $0.08 |
| Pass 2 (2x) | 16MP | $0.48 | $0.08 |
| Total | 16MP | $0.60 | $0.16 |

400 images × 2-pass Clarity = ~$240 (over budget)
350 × single 4x + 50 × 2-pass = ~$198 (under budget)

---

## Appendix C: Anti-Slop Prompt Examples

### Watercolor + Interior + Azure & Bone

**Prompt:**
> Watercolor, Winslow Homer influence. Interior composition. Azure & Bone palette. COLOR PALETTE: high contrast, deep azure and ultramarine blue against bone white and ivory, charcoal black accents sparingly, cool stark drama, like blue ink on parchment or Delft pottery, no other colors. Dark, weathered, world-weary tone. Emperor penguin subjects, non-human world. High detail, print quality.

**Negative:**
> photorealistic, hyperdetailed skin texture, sharp digital edges, CGI, 3D render, human face, human hands, human skin, humanoid features, smooth plastic skin, stock photography, generic AI art, bright cheerful lighting, clean pristine surfaces, modern clean aesthetic, text, watermark, signature, blurry, low quality

### Cosmic Chrome + Panoramic Vista + Void Iridescence

**Prompt:**
> Cosmic Chrome Mythology, Alex Grey influence. Panoramic Vista composition. Void Iridescence palette. COLOR PALETTE: dominated by deep void black and starfield darkness, electric cobalt blue and ultramarine as primary luminous color, metallic gold and burnished amber accents on ornamentation, iridescent oil-slick shifting cyan-green-purple on surfaces and ground planes, self-luminous subjects against pure darkness, no mid-tone backgrounds. Dark, weathered, world-weary tone. Emperor penguin subjects, non-human world. High detail, print quality.

**Negative:**
> natural lighting, mundane setting, photojournalism, human face, human hands, human skin, humanoid features, smooth plastic skin, stock photography, generic AI art, bright cheerful lighting, clean pristine surfaces, modern clean aesthetic, text, watermark, signature, blurry, low quality

### Image with no style IDs (fallback)

**Prompt:**
> Dark, weathered, world-weary tone. Emperor penguin subjects, non-human world. High detail, print quality.

**Negative:**
> human face, human hands, human skin, humanoid features, smooth plastic skin, stock photography, generic AI art, bright cheerful lighting, clean pristine surfaces, modern clean aesthetic, text, watermark, signature, blurry, low quality
