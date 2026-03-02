/**
 * Image asset builder for bundle exports.
 *
 * Collects referenced image IDs from world data, chronicles, era narratives,
 * and static pages, then gathers the actual image blobs/URLs for inclusion
 * in viewer bundles.
 */

import type { Optional } from "@the-canonry/shared-components";
import { getImagesByProject, getImageBlob, getImageMetadata } from "./imageExportHelpers";
import { buildStorageImageUrl } from "../aws/awsS3";
import type { WorldEntity, WorldData } from "./bundleExportUtils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImageRecordBase {
  imageId: string;
  mimeType: string;
  originalPrompt: string;
  finalPrompt: string;
  revisedPrompt: string;
}

type ImageRecord =
  | ImageRecordBase & { imageType: "entity"; entityId: string; entityName: string; entityKind: string }
  | ImageRecordBase & { imageType: "chronicle"; chronicleId: string; imageRefId: string };

interface ImageEntryBase {
  entityId: string;
  entityName: string;
  entityKind: string;
  prompt: string;
  localPath: string;
  imageId: string;
}

type ImageEntry =
  | ImageEntryBase & { imageType: "entity" }
  | ImageEntryBase & { imageType: "chronicle"; chronicleId: string; imageRefId: string };

interface ImageFile {
  path: string;
  blob: Blob;
}

interface ImageAssets {
  imageData: { generatedAt: string; totalImages: number; results: ImageEntry[] } | null;
  images: Record<string, string> | null;
  imageFiles: ImageFile[];
}

interface ImageStorageConfig {
  bucket: string;
  prefix: string;
  region: string;
}

interface BuildBundleImageAssetsParams {
  projectId: string | null;
  worldData: WorldData;
  chronicles: Chronicle[];
  staticPages: StaticPage[];
  eraNarratives: EraNarrative[];
  shouldCancel: Optional<() => boolean>;
  onProgress: Optional<(info: { phase: string; processed: number; total: number }) => void>;
  mode: Optional<"local" | "s3">;
  storage: Optional<ImageStorageConfig>;
}

interface Chronicle {
  coverImage: Optional<{ generatedImageId: string }>;
  imageRefs: Optional<{ refs: ImageRef[] }>;
  [key: string]: unknown;
}

type ImageRef =
  | { type: "entity_ref"; entityId: string }
  | { type: "prompt_request"; generatedImageId: string };

interface EraNarrative {
  coverImage: Optional<{ generatedImageId: string }>;
  imageRefs: Optional<{ refs: EraNarrativeRef[] }>;
  [key: string]: unknown;
}

type EraNarrativeRef =
  | { type: "chronicle_ref"; imageId: string }
  | { type: "prompt_request"; generatedImageId: string };

interface StaticPage {
  content: string;
  status: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Export cancel
// ---------------------------------------------------------------------------

export const EXPORT_CANCEL_ERROR_NAME = "ExportCanceledError";

function createExportCanceledError(): Error {
  const error = new Error("Export canceled");
  error.name = EXPORT_CANCEL_ERROR_NAME;
  return error;
}

export function throwIfExportCanceled(shouldCancel?: () => boolean): void {
  if (shouldCancel && shouldCancel()) {
    throw createExportCanceledError();
  }
}

// ---------------------------------------------------------------------------
// Image helpers
// ---------------------------------------------------------------------------

const IMAGE_EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

function mimeTypeToExtension(mimeType: string | undefined): string {
  if (!mimeType) return "bin";
  return IMAGE_EXTENSION_BY_TYPE[mimeType.toLowerCase()] || "bin";
}

function sanitizeFileName(value: string | undefined, fallback: string): string {
  if (typeof value !== "string") return fallback;
  // eslint-disable-next-line sonarjs/slow-regex -- short filename string, no ReDoS risk
  const sanitized = value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || fallback;
}

// ---------------------------------------------------------------------------
// Image ID collection
// ---------------------------------------------------------------------------

function collectEntityImageIds(worldData: WorldData, ids: Set<string>, entityById: Map<string, WorldEntity>): void {
  if (!worldData?.hardState) return;
  for (const entity of worldData.hardState) {
    if (entity?.id) entityById.set(entity.id, entity);
    const imageId = entity?.enrichment?.image?.imageId;
    if (imageId) ids.add(imageId);
  }
}

function addImageRefIds(ref: ImageRef, ids: Set<string>, entityById: Map<string, WorldEntity>): void {
  if (ref.type === "prompt_request") {
    ids.add(ref.generatedImageId);
    return;
  }
  const imageId = entityById.get(ref.entityId)?.enrichment?.image?.imageId;
  if (imageId) ids.add(imageId);
}

function addChronicleCoversAndRefs(chronicle: Chronicle, ids: Set<string>, entityById: Map<string, WorldEntity>): void {
  if (chronicle?.coverImage?.generatedImageId) ids.add(chronicle.coverImage.generatedImageId);
  for (const ref of chronicle?.imageRefs?.refs || []) {
    addImageRefIds(ref, ids, entityById);
  }
}

function collectChronicleImageIds(chronicles: Chronicle[], ids: Set<string>, entityById: Map<string, WorldEntity>): void {
  if (!Array.isArray(chronicles)) return;
  for (const chronicle of chronicles) {
    addChronicleCoversAndRefs(chronicle, ids, entityById);
  }
}

function addEraNarrativeRefId(ref: EraNarrativeRef, ids: Set<string>): void {
  if (ref.type === "chronicle_ref") ids.add(ref.imageId);
  else if (ref.type === "prompt_request") ids.add(ref.generatedImageId);
}

function addEraNarrativeCoversAndRefs(narrative: EraNarrative, ids: Set<string>): void {
  if (narrative?.coverImage?.generatedImageId) ids.add(narrative.coverImage.generatedImageId);
  for (const ref of narrative?.imageRefs?.refs || []) {
    addEraNarrativeRefId(ref, ids);
  }
}

function collectEraNarrativeImageIds(eraNarratives: EraNarrative[], ids: Set<string>): void {
  if (!Array.isArray(eraNarratives)) return;
  for (const narrative of eraNarratives) {
    addEraNarrativeCoversAndRefs(narrative, ids);
  }
}

function collectStaticPageImageIds(staticPages: StaticPage[], ids: Set<string>): void {
  if (!Array.isArray(staticPages)) return;
  for (const page of staticPages) {
    if (!page.content) continue;
    const matcher = /image:([A-Za-z0-9_-]+)/g;
    let match = matcher.exec(page.content);
    while (match) {
      if (match[1]) ids.add(match[1]);
      match = matcher.exec(page.content);
    }
  }
}

function collectReferencedImageIds(
  worldData: WorldData, chronicles: Chronicle[], staticPages: StaticPage[], eraNarratives: EraNarrative[],
): Set<string> {
  const ids = new Set<string>();
  const entityById = new Map<string, WorldEntity>();
  collectEntityImageIds(worldData, ids, entityById);
  collectChronicleImageIds(chronicles, ids, entityById);
  collectEraNarrativeImageIds(eraNarratives, ids);
  collectStaticPageImageIds(staticPages, ids);
  return ids;
}

// ---------------------------------------------------------------------------
// Image entry building
// ---------------------------------------------------------------------------

function resolveEntityForImage(
  imageId: string, record: ImageRecord | undefined,
  entityByImageId: Map<string, WorldEntity>, entityById: Map<string, WorldEntity>,
): WorldEntity | undefined {
  const byImageId = entityByImageId.get(imageId);
  if (byImageId) return byImageId;
  if (record && record.imageType === "entity") return entityById.get(record.entityId);
  return undefined;
}

function resolvePrompt(record: ImageRecord | undefined): string {
  return record?.originalPrompt || record?.finalPrompt || record?.revisedPrompt || "";
}

interface EntityIdentity { entityId: string; entityName: string; entityKind: string }

function resolveEntityIdentity(
  entity: WorldEntity | undefined, record: ImageRecord | undefined, fallbackId: string,
): EntityIdentity {
  if (entity) return { entityId: entity.id, entityName: entity.name, entityKind: entity.kind };
  if (record && record.imageType === "entity") {
    return { entityId: record.entityId, entityName: record.entityName, entityKind: record.entityKind };
  }
  return { entityId: fallbackId, entityName: "Unknown", entityKind: "unknown" };
}

function buildImageEntry(
  imageId: string, record: ImageRecord | undefined, localPath: string,
  entityByImageId: Map<string, WorldEntity>, entityById: Map<string, WorldEntity>,
): ImageEntry {
  const entity = resolveEntityForImage(imageId, record, entityByImageId, entityById);
  const prompt = resolvePrompt(record);
  if (record && record.imageType === "chronicle") {
    return {
      imageType: "chronicle",
      ...resolveEntityIdentity(entity, record, "chronicle"),
      prompt, localPath, imageId,
      chronicleId: record.chronicleId,
      imageRefId: record.imageRefId,
    };
  }
  return {
    imageType: "entity",
    ...resolveEntityIdentity(entity, record, "unknown"),
    prompt, localPath, imageId,
  };
}

function processS3Image(
  imageId: string, record: ImageRecord | undefined, storage: ImageStorageConfig,
  entityByImageId: Map<string, WorldEntity>, entityById: Map<string, WorldEntity>,
  images: Record<string, string>, imageResults: ImageEntry[],
): void {
  const remotePath = buildStorageImageUrl(storage, "raw", imageId);
  if (!remotePath) return;
  images[imageId] = remotePath;
  imageResults.push(buildImageEntry(imageId, record, remotePath, entityByImageId, entityById));
}

function processLocalImage(
  imageId: string, record: ImageRecord | undefined, blob: Blob,
  entityByImageId: Map<string, WorldEntity>, entityById: Map<string, WorldEntity>,
  images: Record<string, string>, imageFiles: ImageFile[], imageResults: ImageEntry[],
  usedNames: Map<string, number>,
): void {
  const ext = mimeTypeToExtension(record?.mimeType || blob.type);
  const baseName = sanitizeFileName(imageId, `image-${imageResults.length + 1}`);
  const currentCount = (usedNames.get(baseName) || 0) + 1;
  usedNames.set(baseName, currentCount);
  const suffix = currentCount > 1 ? `-${currentCount}` : "";
  const filename = `${baseName}${suffix}.${ext}`;
  const path = `images/${filename}`;
  images[imageId] = path;
  imageFiles.push({ path, blob });
  imageResults.push(buildImageEntry(imageId, record, path, entityByImageId, entityById));
}

// ---------------------------------------------------------------------------
// S3 and local image processors
// ---------------------------------------------------------------------------

async function processS3Images(
  imageIds: Set<string>, imageById: Map<string, ImageRecord>, storage: ImageStorageConfig,
  entityByImageId: Map<string, WorldEntity>, entityById: Map<string, WorldEntity>,
  images: Record<string, string>, imageResults: ImageEntry[],
  shouldCancel: (() => boolean) | undefined,
  onProgress: ((info: { phase: string; processed: number; total: number }) => void) | undefined,
  totalImages: number,
): Promise<void> {
  let processed = 0;
  for (const imageId of imageIds) {
    throwIfExportCanceled(shouldCancel);
    let record = imageById.get(imageId);
    if (!record) record = (await getImageMetadata(imageId)) as ImageRecord | undefined;
    processed += 1;
    processS3Image(imageId, record, storage, entityByImageId, entityById, images, imageResults);
    if (onProgress) onProgress({ phase: "images", processed, total: totalImages });
  }
}

async function processLocalImages(
  imageIds: Set<string>, imageById: Map<string, ImageRecord>,
  entityByImageId: Map<string, WorldEntity>, entityById: Map<string, WorldEntity>,
  images: Record<string, string>, imageFiles: ImageFile[], imageResults: ImageEntry[],
  shouldCancel: (() => boolean) | undefined,
  onProgress: ((info: { phase: string; processed: number; total: number }) => void) | undefined,
  totalImages: number,
): Promise<void> {
  let processed = 0;
  const usedNames = new Map<string, number>();
  for (const imageId of imageIds) {
    throwIfExportCanceled(shouldCancel);
    let record = imageById.get(imageId);
    if (!record) record = (await getImageMetadata(imageId)) as ImageRecord | undefined;
    const blob = (await getImageBlob(imageId)) as Blob | null;
    throwIfExportCanceled(shouldCancel);
    processed += 1;
    if (blob) {
      processLocalImage(imageId, record, blob, entityByImageId, entityById, images, imageFiles, imageResults, usedNames);
    }
    if (onProgress) onProgress({ phase: "images", processed, total: totalImages });
  }
}

// ---------------------------------------------------------------------------
// Main image asset builder
// ---------------------------------------------------------------------------

function buildEntityImageIndex(worldData: WorldData): {
  entityById: Map<string, WorldEntity>;
  entityByImageId: Map<string, WorldEntity>;
} {
  const entityById = new Map((worldData?.hardState || []).map((entity) => [entity.id, entity]));
  const entityByImageId = new Map<string, WorldEntity>();
  for (const entity of worldData?.hardState || []) {
    const imageId = entity?.enrichment?.image?.imageId;
    if (imageId) entityByImageId.set(imageId, entity);
  }
  return { entityById, entityByImageId };
}

export async function buildBundleImageAssets({
  projectId, worldData, chronicles, staticPages, eraNarratives,
  shouldCancel, onProgress, mode = "local", storage,
}: BuildBundleImageAssetsParams): Promise<ImageAssets> {
  const imageIds = collectReferencedImageIds(worldData, chronicles, staticPages, eraNarratives);
  if (imageIds.size === 0) {
    return { imageData: null, images: null, imageFiles: [] };
  }

  const imageRecords = projectId ? ((await getImagesByProject(projectId)) as ImageRecord[]) : [];
  const imageById = new Map(imageRecords.map((record) => [record.imageId, record]));
  const { entityById, entityByImageId } = buildEntityImageIndex(worldData);
  const totalImages = imageIds.size;

  const imageResults: ImageEntry[] = [];
  const imageFiles: ImageFile[] = [];
  const images: Record<string, string> = {};

  if (onProgress) onProgress({ phase: "images", processed: 0, total: totalImages });

  if (mode === "s3" && storage) {
    await processS3Images(
      imageIds, imageById, storage, entityByImageId, entityById,
      images, imageResults, shouldCancel, onProgress, totalImages,
    );
  } else {
    await processLocalImages(
      imageIds, imageById, entityByImageId, entityById,
      images, imageFiles, imageResults, shouldCancel, onProgress, totalImages,
    );
  }

  if (imageResults.length === 0) {
    return { imageData: null, images: null, imageFiles: [] };
  }
  return {
    imageData: {
      generatedAt: new Date().toISOString(),
      totalImages: imageResults.length,
      results: imageResults,
    },
    images,
    imageFiles,
  };
}
