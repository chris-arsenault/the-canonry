import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-provider-cognito-identity";
import { getImageBlob, getImagesByProject } from "../lib/imageExportHelpers";
import { openIlluminatorDb } from "@the-canonry/world-store";

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

    existing[image.imageId] = manifestEntry;

    uploaded += 1;
    if (onProgress) {
      onProgress({ phase: "upload", processed, total, uploaded });
    }
  }

  // Catch-up: generate variants for images already in manifest but missing webp/thumb
  let variantsCatchup = 0;
  for (const image of images) {
    if (!image?.imageId) continue;
    const entry = existing[image.imageId];
    if (!entry || (entry.webpKey && entry.thumbKey)) continue;

    if (onProgress) {
      onProgress({ phase: "variants", processed: variantsCatchup, total: images.length, uploaded });
    }

    try {
      const blob = await getImageBlob(image.imageId);
      if (!blob) continue;

      const { webpKey, thumbKey } = await uploadImageVariants(
        s3, { bucket, basePrefix, projectId }, image.imageId, blob
      );
      entry.webpKey = webpKey;
      entry.thumbKey = thumbKey;
      variantsCatchup += 1;
    } catch (variantErr) {
      console.warn(`[awsS3] Variant catch-up failed for ${image.imageId}:`, variantErr);
    }
  }

  manifest.images = existing;
  manifest.generatedAt = new Date().toISOString();
  manifest.count = Object.keys(existing).length;
  await saveImageManifest(s3, { bucket, basePrefix }, manifest);

  return { total, uploaded, variantsCatchup, manifest };
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

// ─── Catalog JSON ──────────────────────────────────────────────────────────

/**
 * Build catalog.json from IndexedDB image records and upload to S3.
 */
export async function buildAndUploadCatalog(s3, config, projectId, cdnBaseUrl) {
  const bucket = config?.imageBucket?.trim();
  if (!bucket) throw new Error("Missing image bucket for catalog upload");

  const basePrefix = config?.imagePrefix?.trim() || "";
  const images = await getImagesByProject(projectId);

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

  const catalog = {
    version: 1,
    generatedAt: new Date().toISOString(),
    baseUrl: cdnBaseUrl || "",
    images: entries,
    facets: {
      artisticStyles: [...facetSets.artisticStyles].sort(),
      compositionStyles: [...facetSets.compositionStyles].sort(),
      colorPalettes: [...facetSets.colorPalettes].sort(),
      entityKinds: [...facetSets.entityKinds].sort(),
      cultures: [...facetSets.cultures].sort(),
      models: [...facetSets.models].sort(),
      imageTypes: [...facetSets.imageTypes].sort(),
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

  return { entries: entries.length, key };
}
