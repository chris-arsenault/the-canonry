import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-provider-cognito-identity";
import { getImageBlob, getImagesByProject } from "../lib/imageExportHelpers";
import { openIlluminatorDb } from "@the-canonry/world-store";
import {
  DEFAULT_ARTISTIC_STYLES,
  DEFAULT_COMPOSITION_STYLES,
  DEFAULT_COLOR_PALETTES,
} from "@canonry/world-schema";

const DEFAULT_RAW_PREFIX = "raw";
const DEFAULT_WEBP_PREFIX = "webp";
const DEFAULT_THUMB_PREFIX = "thumb";
const MANIFEST_NAME = "image-manifest.json";
const CATALOG_NAME = "catalog.json";
const THUMB_MAX_WIDTH = 400;
const WEBP_QUALITY = 0.85;
const THUMB_QUALITY = 0.75;

function normalizeImageSize(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeManifestSize(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }
  }
  return null;
}

function updateImageSize(db, imageId, size) {
  if (!db || !db.objectStoreNames.contains("images")) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    const tx = db.transaction("images", "readwrite");
    const store = tx.objectStore("images");
    let updated = false;
    const request = store.get(imageId);

    request.onsuccess = () => {
      const record = request.result;
      if (!record) return;
      if (record.size === size) return;
      record.size = size;
      store.put(record);
      updated = true;
    };
    request.onerror = () => {};

    tx.oncomplete = () => resolve(updated);
    tx.onerror = () => resolve(false);
  });
}

/**
 * Get the highest-resolution upscale blob for an image via raw IndexedDB.
 * Returns { blob, width, height } or null if no upscales exist.
 */
async function getHighestUpscaleBlob(imageId) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('illuminator');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Failed to open illuminator DB'));
  });

  try {
    // Check if upscaleBlobs table exists (may not on older schema versions)
    if (!db.objectStoreNames.contains('upscaleBlobs')) return null;

    const blobs = await new Promise((resolve, reject) => {
      const tx = db.transaction('upscaleBlobs', 'readonly');
      const store = tx.objectStore('upscaleBlobs');
      const index = store.index('imageId');
      const request = index.getAll(imageId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    if (blobs.length === 0) return null;

    // Find the largest by pixel count
    return blobs.reduce((best, cur) =>
      cur.width * cur.height > best.width * best.height ? cur : best
    );
  } finally {
    db.close();
  }
}

function toS3Key(...parts) {
  return parts
    .filter(Boolean)
    // eslint-disable-next-line sonarjs/slow-regex -- short path segment, no ReDoS risk
    .map((part) => part.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}

export function buildImageStorageConfig(config, projectId) {
  if (!config?.imageBucket) return null;
  const basePrefix = config?.imagePrefix?.trim() || "";
  return {
    provider: "s3",
    bucket: config.imageBucket.trim(),
    region: config.region?.trim() || "us-east-1",
    basePrefix,
    rawPrefix: DEFAULT_RAW_PREFIX,
    webpPrefix: DEFAULT_WEBP_PREFIX,
    thumbPrefix: DEFAULT_THUMB_PREFIX,
    projectId,
  };
}

export function createS3Client(config, tokens) {
  if (!config?.identityPoolId || !config?.region) return null;
  const region = config.region.trim();
  const identityPoolId = config.identityPoolId.trim();
  const logins = {};
  const userPoolId = config.cognitoUserPoolId?.trim();
  if (tokens?.idToken && userPoolId) {
    const loginKey = `cognito-idp.${region}.amazonaws.com/${userPoolId}`;
    logins[loginKey] = tokens.idToken;
  }

  return new S3Client({
    region,
    credentials: fromCognitoIdentityPool({
      clientConfig: { region },
      identityPoolId,
      logins: Object.keys(logins).length ? logins : undefined,
    }),
  });
}

async function readBodyAsText(body) {
  if (!body) return null;
  if (typeof body.transformToString === "function") {
    return body.transformToString();
  }
  if (typeof body.text === "function") {
    return body.text();
  }
  if (typeof body.arrayBuffer === "function") {
    const buffer = await body.arrayBuffer();
    return new TextDecoder().decode(buffer);
  }
  if (typeof body.getReader === "function" && typeof Response !== "undefined") {
    return new Response(body).text();
  }
  if (typeof body[Symbol.asyncIterator] === "function") {
    const chunks = [];
    for await (const chunk of body) {
      chunks.push(chunk);
    }
    const buffer = chunks.length === 1 ? chunks[0] : new Blob(chunks);
    if (buffer?.arrayBuffer) {
      const ab = await buffer.arrayBuffer();
      return new TextDecoder().decode(ab);
    }
  }
  return null;
}

export async function loadImageManifest(s3, { bucket, basePrefix }) {
  if (!s3 || !bucket) return null;
  const key = toS3Key(basePrefix, MANIFEST_NAME);
  try {
    const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const text = await readBodyAsText(response.Body);
    if (!text) return null;
    return JSON.parse(text);
  } catch (err) {
    if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    console.warn("Failed to load image manifest:", err);
    return null;
  }
}

export async function saveImageManifest(s3, { bucket, basePrefix }, manifest) {
  if (!s3 || !bucket) return;
  const key = toS3Key(basePrefix, MANIFEST_NAME);
  const body = JSON.stringify(manifest, null, 2);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "application/json",
      CacheControl: "no-store, must-revalidate",
    })
  );
}

function safeTagValue(value, maxLen = 256) {
  if (value == null) return undefined;
  const text = String(value);
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function buildTagging(metadata) {
  const tags = [
    ["imageId", metadata.imageId],
    ["projectId", metadata.projectId],
    ["entityId", metadata.entityId],
    ["entityKind", metadata.entityKind],
    ["imageType", metadata.imageType],
    ["chronicleId", metadata.chronicleId],
    ["imageRefId", metadata.imageRefId],
    ["generatedAt", metadata.generatedAt],
    ["savedAt", metadata.savedAt],
  ]
    .map(([key, value]) => [key, safeTagValue(value)])
    .filter(([, value]) => value != null && value !== "");

  if (!tags.length) return undefined;
  return tags
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

export async function listS3Prefixes(s3, { bucket, prefix }) {
  if (!s3 || !bucket) return [];
  const response = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix || undefined,
      Delimiter: "/",
      MaxKeys: 200,
    })
  );
  return (response.CommonPrefixes || []).map((item) => item.Prefix).filter(Boolean);
}

function resolveEffectiveSize(image, entry, updatedAt, normalizedSize, repairSizes) {
  let effectiveSize = normalizedSize;
  let sizeSource = normalizedSize != null ? "metadata" : "unknown";
  let needsBlob = false;

  const needsBlobForPlan =
    entry &&
    entry.updatedAt >= updatedAt &&
    (normalizedSize == null || entry.size !== normalizedSize);
  const needsBlobForRepair = repairSizes && normalizedSize == null;
  if (needsBlobForPlan || needsBlobForRepair) {
    needsBlob = true;
  }

  return { effectiveSize, sizeSource, needsBlob };
}

function applyBlobSize(blob, effectiveSize, _sizeSource) {
  if (blob) {
    return { effectiveSize: blob.size, sizeSource: "blob" };
  }
  return { effectiveSize, sizeSource: "missing_blob" };
}

function repairManifestEntry(entry, updatedAt, effectiveSize, manifestRepairs) {
  const normalizedEntrySize = normalizeManifestSize(entry.size);
  if (normalizedEntrySize == null) {
    if (effectiveSize != null) {
      entry.size = effectiveSize;
      manifestRepairs.updated += 1;
      return true;
    }
    manifestRepairs.skipped += 1;
    return false;
  }
  if (normalizedEntrySize !== entry.size) {
    entry.size = normalizedEntrySize;
    manifestRepairs.updated += 1;
    return true;
  }
  return false;
}

async function repairImageSize(db, imageId, effectiveSize, repairs) {
  repairs.attempted += 1;
  try {
    const updated = await updateImageSize(db, imageId, effectiveSize);
    if (updated) {
      repairs.updated += 1;
    } else {
      repairs.skipped += 1;
    }
  } catch (err) {
    console.warn('[awsS3] Repair failed for entry:', err);
    repairs.failed += 1;
  }
}

function collectUploadReasons(entry, updatedAt, effectiveSize) {
  const reasons = [];
  if (!entry) {
    reasons.push("missing_manifest");
  } else {
    if (entry.updatedAt < updatedAt) reasons.push("updated_at");
    if (effectiveSize != null && entry.size !== effectiveSize) reasons.push("size_mismatch");
    if (effectiveSize == null) reasons.push("size_unknown");
  }
  return reasons;
}

async function processUploadPlanImage(image, existing, candidates, repairSizes, canRepairManifest, manifestRepairs, repairs, db) {
  if (!image?.imageId) return false;
  const updatedAt = image.savedAt || image.generatedAt || 0;
  const entry = existing[image.imageId];
  const rawSize = image.size;
  const normalizedSize = normalizeImageSize(rawSize);
  let { effectiveSize, sizeSource, needsBlob } = resolveEffectiveSize(image, entry, updatedAt, normalizedSize, repairSizes);
  let blob = null;
  if (needsBlob) {
    blob = await getImageBlob(image.imageId);
    ({ effectiveSize, sizeSource } = applyBlobSize(blob, effectiveSize, sizeSource));
  }
  let manifestUpdated = false;
  if (canRepairManifest && entry && entry.updatedAt >= updatedAt) {
    if (repairManifestEntry(entry, updatedAt, effectiveSize, manifestRepairs)) {
      manifestUpdated = true;
    }
  }
  if (repairSizes && blob && effectiveSize != null && effectiveSize !== normalizedSize) {
    await repairImageSize(db, image.imageId, effectiveSize, repairs);
  }
  const reasons = collectUploadReasons(entry, updatedAt, effectiveSize);
  if (!reasons.length) return manifestUpdated;
  candidates.push({
    imageId: image.imageId,
    entityId: image.entityId || null,
    entityName: image.entityName || null,
    imageType: image.imageType || "entity",
    updatedAt,
    size: rawSize ?? null,
    effectiveSize,
    sizeSource,
    manifestUpdatedAt: entry?.updatedAt ?? null,
    manifestSize: entry?.size ?? null,
    reason: reasons.join("+"),
  });
  return manifestUpdated;
}
export async function getS3ImageUploadPlan({ projectId, s3, config, repairSizes = false }) {
  if (!projectId) throw new Error("Missing projectId for image sync");
  if (!s3) throw new Error("Missing S3 client");
  const bucket = config?.imageBucket?.trim();
  if (!bucket) throw new Error("Missing image bucket");

  const basePrefix = config?.imagePrefix?.trim() || "";
  const manifestFromS3 = await loadImageManifest(s3, { bucket, basePrefix });
  const manifest = manifestFromS3 || {
    version: 1,
    generatedAt: new Date().toISOString(),
    bucket,
    basePrefix,
    rawPrefix: DEFAULT_RAW_PREFIX,
    webpPrefix: DEFAULT_WEBP_PREFIX,
    thumbPrefix: DEFAULT_THUMB_PREFIX,
    images: {},
  };

  const existing = manifest.images || {};
  const images = await getImagesByProject(projectId);
  const candidates = [];
  const repairs = { attempted: 0, updated: 0, skipped: 0, failed: 0 };
  const manifestRepairs = { updated: 0, skipped: 0, failed: 0 };
  const canRepairManifest = Boolean(repairSizes && manifestFromS3);
  let manifestChanged = false;
  let db = null;

  try {
    if (repairSizes) {
      db = await openIlluminatorDb();
    }

    for (const image of images) {
      const changed = await processUploadPlanImage(
        image, existing, candidates, repairSizes, canRepairManifest, manifestRepairs, repairs, db
      );
      if (changed) manifestChanged = true;
    }
  } finally {
    if (db) {
      db.close();
    }
  }

  if (canRepairManifest && manifestChanged) {
    manifest.generatedAt = new Date().toISOString();
    manifest.count = Object.keys(existing).length;
    await saveImageManifest(s3, { bucket, basePrefix }, manifest);
  }

  return {
    total: images.length,
    candidates,
    manifestFound: Boolean(manifestFromS3),
    basePrefix,
    repairs: repairSizes ? repairs : null,
    manifestRepairs: canRepairManifest ? manifestRepairs : null,
  };
}

function shouldSkipSyncImage(entry, updatedAt, normalizedSize, blob) {
  if (!entry || entry.updatedAt < updatedAt) return false;
  if (normalizedSize != null) return entry.size === normalizedSize;
  if (!blob) return true;
  return entry.size === blob.size;
}

function buildManifestEntry(image, projectId, rawKey, blob, normalizedSize, contentLength, updatedAt) {
  return {
    imageId: image.imageId,
    projectId,
    rawKey,
    mimeType: image.mimeType || blob.type || "application/octet-stream",
    size: normalizedSize ?? contentLength ?? null,
    updatedAt,
    entityId: image.entityId || null,
    entityKind: image.entityKind || null,
    entityName: image.entityName || null,
    imageType: image.imageType || "entity",
    chronicleId: image.chronicleId || null,
    imageRefId: image.imageRefId || null,
    generatedAt: image.generatedAt || null,
    model: image.model || null,
  };
}

async function fetchBlobForSync(image, entry, updatedAt, normalizedSize) {
  let blob = null;
  if (entry && entry.updatedAt >= updatedAt && normalizedSize == null) {
    blob = await getImageBlob(image.imageId);
  }
  if (shouldSkipSyncImage(entry, updatedAt, normalizedSize, blob)) return { skip: true, blob: null };
  if (!blob) {
    blob = await getImageBlob(image.imageId);
    if (!blob) return { skip: true, blob: null };
  }
  return { skip: false, blob };
}
export async function syncProjectImagesToS3({ projectId, s3, config, onProgress }) {
  if (!projectId) throw new Error("Missing projectId for image sync");
  if (!s3) throw new Error("Missing S3 client");
  const bucket = config?.imageBucket?.trim();
  if (!bucket) throw new Error("Missing image bucket");

  const basePrefix = config?.imagePrefix?.trim() || "";
  const rawPrefix = DEFAULT_RAW_PREFIX;
  const manifest = (await loadImageManifest(s3, { bucket, basePrefix })) || {
    version: 1,
    generatedAt: new Date().toISOString(),
    bucket,
    basePrefix,
    rawPrefix,
    webpPrefix: DEFAULT_WEBP_PREFIX,
    thumbPrefix: DEFAULT_THUMB_PREFIX,
    images: {},
  };

  const existing = manifest.images || {};
  const images = await getImagesByProject(projectId);
  let processed = 0;
  let uploaded = 0;
  const total = images.length;

  for (const image of images) {
    if (!image?.imageId) continue;
    processed += 1;
    if (onProgress) {
      onProgress({ phase: "scan", processed, total, uploaded });
    }

    const updatedAt = image.savedAt || image.generatedAt || 0;
    const entry = existing[image.imageId];
    const normalizedSize = normalizeImageSize(image.size);

    const { skip, blob } = await fetchBlobForSync(image, entry, updatedAt, normalizedSize);
    if (skip) continue;

    const buffer = await blob.arrayBuffer();
    const body = new Uint8Array(buffer);
    const contentLength = body.byteLength;

    const rawKey = toS3Key(basePrefix, rawPrefix, projectId, image.imageId);
    const tagging = buildTagging({ ...image, projectId, savedAt: updatedAt });

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: rawKey,
        Body: body,
        ContentType: image.mimeType || blob.type || "application/octet-stream",
        ContentLength: contentLength,
        Tagging: tagging,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    const manifestEntry = buildManifestEntry(
      image, projectId, rawKey, blob, normalizedSize, contentLength, updatedAt
    );

    // Generate and upload WebP + thumbnail variants
    try {
      const { webpKey, thumbKey } = await uploadImageVariants(
        s3, { bucket, basePrefix, projectId }, image.imageId, blob
      );
      manifestEntry.webpKey = webpKey;
      manifestEntry.thumbKey = thumbKey;
    } catch (variantErr) {
      console.warn(`[awsS3] Variant upload failed for ${image.imageId}:`, variantErr);
    }

    // Upload HQ variant if an upscale exists
    try {
      const hqBlob = await getHighestUpscaleBlob(image.imageId);
      if (hqBlob) {
        const hqKey = toS3Key(basePrefix, "hq", projectId, `${image.imageId}.png`);
        const hqBuffer = new Uint8Array(await hqBlob.blob.arrayBuffer());
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: hqKey,
            Body: hqBuffer,
            ContentType: "image/png",
            ContentLength: hqBuffer.byteLength,
            CacheControl: "public, max-age=31536000, immutable",
          })
        );
        manifestEntry.hqKey = hqKey;
        manifestEntry.hqWidth = hqBlob.width;
        manifestEntry.hqHeight = hqBlob.height;
      }
    } catch (hqErr) {
      console.warn(`[awsS3] HQ upload failed for ${image.imageId}:`, hqErr);
    }

    existing[image.imageId] = manifestEntry;

    uploaded += 1;
    if (onProgress) {
      onProgress({ phase: "upload", processed, total, uploaded });
    }
  }

  // Catch-up: generate variants for images already in manifest but missing webp/thumb
  const variantsTodo = images.filter(img => {
    if (!img?.imageId) return false;
    const entry = existing[img.imageId];
    return entry && (!entry.webpKey || !entry.thumbKey);
  });

  let variantsCatchup = 0;
  for (const image of variantsTodo) {
    if (onProgress) {
      onProgress({ phase: "variants", processed: variantsCatchup, total: variantsTodo.length, uploaded });
    }

    try {
      const blob = await getImageBlob(image.imageId);
      if (!blob) continue;

      const { webpKey, thumbKey } = await uploadImageVariants(
        s3, { bucket, basePrefix, projectId }, image.imageId, blob
      );
      const entry = existing[image.imageId];
      entry.webpKey = webpKey;
      entry.thumbKey = thumbKey;
      variantsCatchup += 1;
    } catch (variantErr) {
      console.warn(`[awsS3] Variant catch-up failed for ${image.imageId}:`, variantErr);
    }
  }

  // HQ catch-up: upload HQ variants for images in manifest but missing hqKey
  const hqTodo = images.filter(img => {
    if (!img?.imageId) return false;
    const entry = existing[img.imageId];
    return entry && !entry.hqKey;
  });

  let hqCatchup = 0;
  for (const image of hqTodo) {
    if (onProgress) {
      onProgress({ phase: "hq-variants", processed: hqCatchup, total: hqTodo.length, uploaded });
    }

    try {
      const hqBlob = await getHighestUpscaleBlob(image.imageId);
      if (hqBlob) {
        const hqKey = toS3Key(basePrefix, "hq", projectId, `${image.imageId}.png`);
        const hqBuffer = new Uint8Array(await hqBlob.blob.arrayBuffer());
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: hqKey,
            Body: hqBuffer,
            ContentType: "image/png",
            ContentLength: hqBuffer.byteLength,
            CacheControl: "public, max-age=31536000, immutable",
          })
        );
        const entry = existing[image.imageId];
        entry.hqKey = hqKey;
        entry.hqWidth = hqBlob.width;
        entry.hqHeight = hqBlob.height;
        hqCatchup += 1;
      }
    } catch (hqCatchupErr) {
      console.warn(`[awsS3] HQ catch-up failed for ${image.imageId}:`, hqCatchupErr);
    }
  }

  manifest.images = existing;
  manifest.generatedAt = new Date().toISOString();
  manifest.count = Object.keys(existing).length;
  await saveImageManifest(s3, { bucket, basePrefix }, manifest);

  return { total, uploaded, variantsCatchup, hqCatchup, manifest };
}

export function buildStorageImageUrl(storage, variant, imageId) {
  if (!storage || !imageId) return null;
  const basePrefix = storage.basePrefix || "";
  const projectId = storage.projectId || "";
  let prefix;
  if (variant === "raw") {
    prefix = storage.rawPrefix;
  } else if (variant === "thumb") {
    prefix = storage.thumbPrefix;
  } else {
    prefix = storage.webpPrefix;
  }
  const filename = variant === "raw" ? imageId : `${imageId}.webp`;
  const path = toS3Key(basePrefix, prefix, projectId, filename);
  return `/${path}`;
}

// ─── Image Optimization ────────────────────────────────────────────────────

/**
 * Convert an image blob to WebP, optionally resizing to maxWidth.
 * Uses an off-screen canvas in the browser.
 */
async function convertBlobToWebp(blob, maxWidth, quality) {
  const bitmap = await createImageBitmap(blob);
  let { width, height } = bitmap;

  if (maxWidth && width > maxWidth) {
    const ratio = maxWidth / width;
    width = maxWidth;
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve) => {
    canvas.toBlob(
      (webpBlob) => resolve(webpBlob),
      "image/webp",
      quality,
    );
  });
}

async function uploadVariant(s3, bucket, key, blob) {
  const buffer = await blob.arrayBuffer();
  const body = new Uint8Array(buffer);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "image/webp",
      ContentLength: body.byteLength,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

/**
 * Generate and upload WebP + thumbnail variants for an image.
 * Returns { webpKey, thumbKey } on success.
 */
export async function uploadImageVariants(s3, { bucket, basePrefix, projectId }, imageId, rawBlob) {
  const webpBlob = await convertBlobToWebp(rawBlob, null, WEBP_QUALITY);
  const thumbBlob = await convertBlobToWebp(rawBlob, THUMB_MAX_WIDTH, THUMB_QUALITY);

  const webpKey = toS3Key(basePrefix, DEFAULT_WEBP_PREFIX, projectId, `${imageId}.webp`);
  const thumbKey = toS3Key(basePrefix, DEFAULT_THUMB_PREFIX, projectId, `${imageId}.webp`);

  await uploadVariant(s3, bucket, webpKey, webpBlob);
  await uploadVariant(s3, bucket, thumbKey, thumbBlob);

  return { webpKey, thumbKey };
}

// ─── Manifest Reconciliation ────────────────────────────────────────────────

/**
 * List ALL objects under a given S3 prefix, handling pagination.
 * Returns an array of { Key, Size }.
 */
async function listAllS3Objects(s3, bucket, prefix) {
  const objects = [];
  let continuationToken;
  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      })
    );
    if (response.Contents) {
      for (const obj of response.Contents) {
        objects.push({ key: obj.Key, size: obj.Size });
      }
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);
  return objects;
}

/**
 * Reconcile the S3 image manifest by listing actual objects across all three
 * prefixes (raw, webp, thumb) and cross-referencing with local IndexedDB
 * image metadata.
 *
 * This recovers from a failed sync where images were uploaded but the manifest
 * was never saved (e.g. Cognito token timeout).
 */
export async function reconcileManifestFromS3({ projectId, s3, config, onProgress }) {
  if (!projectId) throw new Error("Missing projectId for manifest reconciliation");
  if (!s3) throw new Error("Missing S3 client");
  const bucket = config?.imageBucket?.trim();
  if (!bucket) throw new Error("Missing image bucket");

  const basePrefix = config?.imagePrefix?.trim() || "";

  if (onProgress) onProgress({ phase: "loading-manifest", detail: "Loading manifest..." });
  const manifest = (await loadImageManifest(s3, { bucket, basePrefix })) || {
    version: 1,
    generatedAt: new Date().toISOString(),
    bucket,
    basePrefix,
    rawPrefix: DEFAULT_RAW_PREFIX,
    webpPrefix: DEFAULT_WEBP_PREFIX,
    thumbPrefix: DEFAULT_THUMB_PREFIX,
    images: {},
  };
  const existing = manifest.images || {};

  // List all three prefixes in parallel
  const rawPrefixFull = toS3Key(basePrefix, DEFAULT_RAW_PREFIX, projectId) + "/";
  const webpPrefixFull = toS3Key(basePrefix, DEFAULT_WEBP_PREFIX, projectId) + "/";
  const thumbPrefixFull = toS3Key(basePrefix, DEFAULT_THUMB_PREFIX, projectId) + "/";
  if (onProgress) onProgress({ phase: "listing", detail: "Listing raw, webp, and thumb objects..." });
  const [rawObjects, webpObjects, thumbObjects] = await Promise.all([
    listAllS3Objects(s3, bucket, rawPrefixFull),
    listAllS3Objects(s3, bucket, webpPrefixFull),
    listAllS3Objects(s3, bucket, thumbPrefixFull),
  ]);

  // Build maps: imageId → S3 object for each prefix
  const rawMap = new Map();
  for (const obj of rawObjects) {
    const imageId = obj.key.split("/").pop();
    if (imageId) rawMap.set(imageId, obj);
  }
  const webpMap = new Map();
  for (const obj of webpObjects) {
    // webp files are named {imageId}.webp
    const filename = obj.key.split("/").pop();
    if (filename?.endsWith(".webp")) webpMap.set(filename.slice(0, -5), obj);
  }
  const thumbMap = new Map();
  for (const obj of thumbObjects) {
    const filename = obj.key.split("/").pop();
    if (filename?.endsWith(".webp")) thumbMap.set(filename.slice(0, -5), obj);
  }

  // Collect all known image IDs across all prefixes
  const allImageIds = new Set([...rawMap.keys(), ...webpMap.keys(), ...thumbMap.keys()]);

  // Load local image metadata from IndexedDB
  if (onProgress) onProgress({ phase: "loading-local", detail: "Loading local image metadata..." });
  const localImages = await getImagesByProject(projectId);
  const localMap = new Map();
  for (const img of localImages) {
    if (img.imageId) localMap.set(img.imageId, img);
  }

  // Reconcile
  let added = 0;
  let updated = 0;
  let webpLinked = 0;
  let thumbLinked = 0;
  const total = allImageIds.size;
  let processed = 0;

  for (const imageId of allImageIds) {
    processed++;
    if (onProgress && processed % 100 === 0) {
      onProgress({ phase: "reconciling", detail: `Reconciling ${processed}/${total}...` });
    }

    const rawObj = rawMap.get(imageId);
    const webpObj = webpMap.get(imageId);
    const thumbObj = thumbMap.get(imageId);
    const entry = existing[imageId];
    const localImg = localMap.get(imageId);

    if (entry) {
      // Entry exists — patch missing fields
      let changed = false;
      if (rawObj && (entry.size == null || entry.size !== rawObj.size)) {
        entry.size = rawObj.size;
        changed = true;
      }
      if (webpObj && !entry.webpKey) {
        entry.webpKey = webpObj.key;
        webpLinked++;
        changed = true;
      }
      if (thumbObj && !entry.thumbKey) {
        entry.thumbKey = thumbObj.key;
        thumbLinked++;
        changed = true;
      }
      if (changed) updated++;
      continue;
    }

    // No manifest entry — create one
    const rawKey = rawObj?.key ?? toS3Key(basePrefix, DEFAULT_RAW_PREFIX, projectId, imageId);
    const newEntry = localImg
      ? {
          imageId,
          projectId,
          rawKey,
          mimeType: localImg.mimeType || "application/octet-stream",
          size: rawObj?.size ?? null,
          updatedAt: localImg.savedAt || localImg.generatedAt || 0,
          entityId: localImg.entityId || null,
          entityKind: localImg.entityKind || null,
          entityName: localImg.entityName || null,
          imageType: localImg.imageType || "entity",
          chronicleId: localImg.chronicleId || null,
          imageRefId: localImg.imageRefId || null,
          generatedAt: localImg.generatedAt || null,
          model: localImg.model || null,
        }
      : {
          imageId,
          projectId,
          rawKey,
          mimeType: "application/octet-stream",
          size: rawObj?.size ?? null,
          updatedAt: 0,
        };
    if (webpObj) {
      newEntry.webpKey = webpObj.key;
      webpLinked++;
    }
    if (thumbObj) {
      newEntry.thumbKey = thumbObj.key;
      thumbLinked++;
    }
    existing[imageId] = newEntry;
    added++;
  }

  // Save updated manifest
  manifest.images = existing;
  manifest.generatedAt = new Date().toISOString();
  manifest.count = Object.keys(existing).length;
  if (onProgress) onProgress({ phase: "saving", detail: "Saving manifest..." });
  await saveImageManifest(s3, { bucket, basePrefix }, manifest);

  return {
    raw: rawMap.size,
    webp: webpMap.size,
    thumb: thumbMap.size,
    added,
    updated,
    webpLinked,
    thumbLinked,
    manifestTotal: Object.keys(existing).length,
  };
}

// ─── Catalog JSON ──────────────────────────────────────────────────────────

/**
 * Repair missing width/height on image records by reading blobs and measuring.
 * Writes dimensions back to IndexedDB so this is a one-time cost per image.
 */
async function repairImageDimensions(images) {
  const needsRepair = images.filter((img) => img.imageId && (!img.width || !img.height));
  if (needsRepair.length === 0) return 0;

  let db;
  try {
    db = await openIlluminatorDb();
  } catch {
    return 0;
  }

  let repaired = 0;
  for (const img of needsRepair) {
    try {
      const blobRecord = await new Promise((resolve) => {
        const tx = db.transaction("imageBlobs", "readonly");
        const req = tx.objectStore("imageBlobs").get(img.imageId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
      const blob = blobRecord?.blob;
      if (!blob) continue;

      const bitmap = await createImageBitmap(blob);
      const { width, height } = bitmap;
      bitmap.close();

      if (!width || !height) continue;

      // Write back to IndexedDB
      await new Promise((resolve) => {
        const tx = db.transaction("images", "readwrite");
        const store = tx.objectStore("images");
        const req = store.get(img.imageId);
        req.onsuccess = () => {
          const record = req.result;
          if (record) {
            record.width = width;
            record.height = height;
            store.put(record);
          }
        };
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });

      // Update in-memory record so catalog picks it up
      img.width = width;
      img.height = height;
      repaired++;
    } catch {
      // Skip images that can't be measured
    }
  }

  db.close();
  return repaired;
}

/**
 * Build catalog.json from IndexedDB image records and upload to S3.
 */
export async function buildAndUploadCatalog(s3, config, projectId, cdnBaseUrl) {
  const bucket = config?.imageBucket?.trim();
  if (!bucket) throw new Error("Missing image bucket for catalog upload");

  const basePrefix = config?.imagePrefix?.trim() || "";
  const images = await getImagesByProject(projectId);

  // Repair images missing width/height before building catalog
  const dimensionsRepaired = await repairImageDimensions(images);
  if (dimensionsRepaired > 0) {
    console.log(`[catalog] Repaired dimensions for ${dimensionsRepaired} images`);
  }

  const entries = [];
  const facetSets = {
    artisticStyles: new Set(),
    compositionStyles: new Set(),
    colorPalettes: new Set(),
    entityKinds: new Set(),
    cultures: new Set(),
    models: new Set(),
    imageTypes: new Set(),
  };

  for (const img of images) {
    if (!img.imageId || !img.width || !img.height) continue;

    const imageType = img.imageType || "other";
    const entry = {
      imageId: img.imageId,
      title: img.title || img.entityName || "Untitled",
      artisticStyleId: img.artisticStyleId || "unknown",
      compositionStyleId: img.compositionStyleId || "unknown",
      colorPaletteId: img.colorPaletteId || "unknown",
      imageType,
      tags: img.tags || [],
      entityName: img.entityName || undefined,
      entityKind: img.entityKind || undefined,
      entityCulture: img.entityCulture || undefined,
      model: img.model,
      width: img.width,
      height: img.height,
      aspect: img.aspect || "square",
      generatedAt: img.generatedAt,
      thumbPath: toS3Key(basePrefix, DEFAULT_THUMB_PREFIX, projectId, `${img.imageId}.webp`),
      fullPath: toS3Key(basePrefix, DEFAULT_WEBP_PREFIX, projectId, `${img.imageId}.webp`),
    };
    entries.push(entry);

    if (entry.artisticStyleId !== "unknown") facetSets.artisticStyles.add(entry.artisticStyleId);
    if (entry.compositionStyleId !== "unknown") facetSets.compositionStyles.add(entry.compositionStyleId);
    if (entry.colorPaletteId !== "unknown") facetSets.colorPalettes.add(entry.colorPaletteId);
    if (entry.entityKind) facetSets.entityKinds.add(entry.entityKind);
    if (entry.entityCulture) facetSets.cultures.add(entry.entityCulture);
    facetSets.models.add(entry.model);
    facetSets.imageTypes.add(imageType);
  }

  entries.sort((a, b) => b.generatedAt - a.generatedAt);

  // Build id→name and id→group maps from style definitions
  const styleName = Object.fromEntries(DEFAULT_ARTISTIC_STYLES.map((s) => [s.id, s.name]));
  const styleGroup = Object.fromEntries(DEFAULT_ARTISTIC_STYLES.map((s) => [s.id, s.category]));
  const compName = Object.fromEntries(DEFAULT_COMPOSITION_STYLES.map((s) => [s.id, s.name]));
  const compGroup = Object.fromEntries(
    DEFAULT_COMPOSITION_STYLES.map((s) => [s.id, s.targetCategory || "general"]),
  );
  const paletteName = Object.fromEntries(DEFAULT_COLOR_PALETTES.map((s) => [s.id, s.name]));
  const paletteGroup = Object.fromEntries(DEFAULT_COLOR_PALETTES.map((s) => [s.id, s.group]));

  // Sort by group order, then by name within group
  const toGroupedFacet = (ids, nameMap, groupMap, groupOrder) => {
    const items = [...ids].map((id) => ({
      id,
      name: nameMap[id] || id,
      group: groupMap[id] || "other",
    }));
    items.sort((a, b) => {
      const ga = groupOrder.indexOf(a.group);
      const gb = groupOrder.indexOf(b.group);
      const oa = ga >= 0 ? ga : groupOrder.length;
      const ob = gb >= 0 ? gb : groupOrder.length;
      if (oa !== ob) return oa - ob;
      return a.name.localeCompare(b.name);
    });
    return items;
  };

  // Simple title-case for IDs without a lookup (entity kinds, cultures, models, image types)
  const titleCase = (s) => s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const selfName = (ids) => [...ids].sort().map((id) => ({ id, name: titleCase(id) }));

  const ARTISTIC_GROUP_ORDER = [
    "painting",
    "ink-print",
    "digital",
    "camera",
    "experimental",
    "document",
  ];
  const COMP_GROUP_ORDER = [
    "character",
    "pair",
    "pose",
    "collective",
    "place",
    "landscape",
    "object",
    "concept",
    "event",
    "general",
  ];
  const PALETTE_GROUP_ORDER = [
    "hue",
    "special",
    "natural",
    "mood",
    "metallic",
    "contrast-pair",
    "metallic-triplet",
  ];

  const catalog = {
    version: 2,
    generatedAt: new Date().toISOString(),
    baseUrl: cdnBaseUrl || "",
    images: entries,
    facets: {
      artisticStyles: toGroupedFacet(
        facetSets.artisticStyles,
        styleName,
        styleGroup,
        ARTISTIC_GROUP_ORDER,
      ),
      compositionStyles: toGroupedFacet(
        facetSets.compositionStyles,
        compName,
        compGroup,
        COMP_GROUP_ORDER,
      ),
      colorPalettes: toGroupedFacet(
        facetSets.colorPalettes,
        paletteName,
        paletteGroup,
        PALETTE_GROUP_ORDER,
      ),
      entityKinds: selfName(facetSets.entityKinds),
      cultures: selfName(facetSets.cultures),
      models: selfName(facetSets.models),
      imageTypes: selfName(facetSets.imageTypes),
    },
  };

  const key = toS3Key(basePrefix, CATALOG_NAME);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(catalog),
      ContentType: "application/json",
      CacheControl: "no-store, must-revalidate",
    }),
  );

  return { entries: entries.length, key, dimensionsRepaired };
}
