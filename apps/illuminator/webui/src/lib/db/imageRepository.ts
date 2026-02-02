/**
 * Image Repository — Dexie-based replacement for workerStorage image operations.
 *
 * All image CRUD, search, and export functions backed by the unified
 * IlluminatorDatabase instead of raw IndexedDB.
 */

import { db } from './illuminatorDb';
import type {
  ImageType,
  ImageAspect,
  ImageMetadata,
  ImageRecord,
  ImageListItem,
  ImageSearchOptions,
  ImagePromptExport,
} from '../imageTypes';

// Re-export all types so consumers can migrate imports to this module
export type {
  ImageType,
  ImageAspect,
  ImageMetadata,
  ImageRecord,
  ImageListItem,
  ImageSearchOptions,
  ImagePromptExport,
};

const LOG_PREFIX = '[ImageRepository]';

// ============================================================================
// Pure Functions
// ============================================================================

export function generateImageId(entityId: string): string {
  return `img_${entityId}_${Date.now()}`;
}

/**
 * Classify aspect ratio from width/height.
 */
export function classifyAspect(width: number, height: number): ImageAspect {
  const ratio = width / height;
  if (ratio < 0.9) return 'portrait';
  if (ratio > 1.1) return 'landscape';
  return 'square';
}

/**
 * Extract dimensions from an image blob using createImageBitmap (works in workers).
 */
export async function extractImageDimensions(blob: Blob): Promise<{ width: number; height: number; aspect: ImageAspect }> {
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  bitmap.close();
  return { width, height, aspect: classifyAspect(width, height) };
}

// ============================================================================
// CRUD
// ============================================================================

export async function saveImage(
  imageId: string,
  blob: Blob,
  metadata: ImageMetadata
): Promise<string> {
  const metadataRecord = {
    imageId,
    mimeType: blob.type || 'image/png',
    size: blob.size,
    ...metadata,
    savedAt: Date.now(),
  };

  console.log(`${LOG_PREFIX} Image save start`, {
    imageId,
    entityId: metadata.entityId,
    projectId: metadata.projectId,
    size: blob.size,
  });

  await db.transaction('rw', [db.images, db.imageBlobs], async () => {
    await db.images.put(metadataRecord as any);
    await db.imageBlobs.put({ imageId, blob });
  });

  console.log(`${LOG_PREFIX} Image save complete`, {
    imageId,
    entityId: metadata.entityId,
    projectId: metadata.projectId,
    size: blob.size,
  });

  return imageId;
}

export async function deleteImage(imageId: string): Promise<void> {
  await db.transaction('rw', [db.images, db.imageBlobs], async () => {
    await db.images.delete(imageId);
    await db.imageBlobs.delete(imageId);
  });
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Search images with pagination — returns metadata only (no blobs).
 */
export async function searchImages(options: ImageSearchOptions = {}): Promise<{
  items: ImageListItem[];
  total: number;
  hasMore: boolean;
}> {
  const { projectId, search, limit = 20, offset = 0 } = options;
  const searchLower = search?.toLowerCase() || '';

  // Fetch candidates — use index when filtering by projectId
  const allRecords = projectId
    ? await db.images.where('projectId').equals(projectId).toArray()
    : await db.images.toArray();

  // Apply search filter (on entityName — lightweight)
  const filtered = searchLower
    ? allRecords.filter((r) => r.entityName && r.entityName.toLowerCase().includes(searchLower))
    : allRecords;

  const total = filtered.length;

  // Paginate and project to lightweight list items (no blob)
  const items: ImageListItem[] = filtered
    .slice(offset, offset + limit)
    .map((r) => ({
      imageId: r.imageId,
      entityId: r.entityId,
      projectId: r.projectId,
      entityName: r.entityName,
      entityKind: r.entityKind,
      generatedAt: r.generatedAt,
    }));

  return {
    items,
    total,
    hasMore: offset + items.length < total,
  };
}

/**
 * Load a single image's dataUrl by ID (on-demand loading).
 */
export async function getImageDataUrl(imageId: string): Promise<string | null> {
  const blobRecord = await db.imageBlobs.get(imageId);
  if (!blobRecord?.blob) return null;

  try {
    return await blobToDataUrl(blobRecord.blob);
  } catch (err) {
    console.warn(`Failed to convert image ${imageId} to dataUrl:`, err);
    return null;
  }
}

/**
 * Convert blob to data URL.
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

// ============================================================================
// Load / Browse (used by UI components that previously used Canonry imageStore)
// ============================================================================

/**
 * Load an image by ID and create an object URL.
 * Returns { url, ...metadata } or null if not found.
 * Caller is responsible for revoking the object URL.
 */
export async function loadImage(imageId: string): Promise<{
  url: string;
  imageId: string;
  entityId: string;
  projectId: string;
  mimeType: string;
  size: number;
  generatedAt: number;
  model: string;
  originalPrompt?: string;
  finalPrompt?: string;
  revisedPrompt?: string;
  entityName?: string;
  entityKind?: string;
  entityCulture?: string;
  imageType?: ImageType;
  chronicleId?: string;
  imageRefId?: string;
  sceneDescription?: string;
} | null> {
  if (!imageId) return null;
  const [metadata, blobRecord] = await Promise.all([
    db.images.get(imageId),
    db.imageBlobs.get(imageId),
  ]);
  if (!metadata || !blobRecord?.blob) return null;

  const url = URL.createObjectURL(blobRecord.blob);
  return {
    url,
    imageId: metadata.imageId,
    entityId: metadata.entityId,
    projectId: metadata.projectId,
    mimeType: metadata.mimeType,
    size: metadata.size,
    generatedAt: metadata.generatedAt,
    model: metadata.model,
    originalPrompt: metadata.originalPrompt,
    finalPrompt: metadata.finalPrompt,
    revisedPrompt: metadata.revisedPrompt,
    entityName: metadata.entityName,
    entityKind: metadata.entityKind,
    entityCulture: metadata.entityCulture,
    imageType: metadata.imageType,
    chronicleId: metadata.chronicleId,
    imageRefId: metadata.imageRefId,
    sceneDescription: metadata.sceneDescription,
  };
}

/**
 * Get raw image blob by ID.
 */
export async function getImageBlob(imageId: string): Promise<Blob | null> {
  if (!imageId) return null;
  const record = await db.imageBlobs.get(imageId);
  return record?.blob || null;
}

/**
 * Get all images (metadata only, no blobs) sorted newest first.
 */
export async function getAllImages(): Promise<Array<Omit<ImageRecord, 'blob'> & { hasBlob: boolean }>> {
  const records = await db.images.toArray();
  const images = records.map((record) => ({
    imageId: record.imageId,
    entityId: record.entityId,
    projectId: record.projectId,
    entityName: record.entityName,
    entityKind: record.entityKind,
    entityCulture: record.entityCulture,
    originalPrompt: record.originalPrompt,
    formattingPrompt: record.formattingPrompt,
    finalPrompt: record.finalPrompt,
    generatedAt: record.generatedAt,
    model: record.model,
    revisedPrompt: record.revisedPrompt,
    estimatedCost: record.estimatedCost,
    actualCost: record.actualCost,
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    width: record.width,
    height: record.height,
    aspect: record.aspect,
    imageType: record.imageType,
    chronicleId: record.chronicleId,
    imageRefId: record.imageRefId,
    sceneDescription: record.sceneDescription,
    mimeType: record.mimeType,
    size: (typeof record.size === 'number' && Number.isFinite(record.size)) ? record.size : 0,
    savedAt: record.savedAt,
    hasBlob: true,
  }));
  images.sort((a, b) => (b.generatedAt || 0) - (a.generatedAt || 0));
  return images;
}

/**
 * Delete multiple images by ID.
 */
export async function deleteImages(imageIds: string[]): Promise<void> {
  if (!imageIds?.length) return;
  await db.transaction('rw', [db.images, db.imageBlobs], async () => {
    await db.images.bulkDelete(imageIds);
    await db.imageBlobs.bulkDelete(imageIds);
  });
}

/**
 * Get storage statistics (count, total size, breakdown by project).
 */
export async function getStorageStats(): Promise<{
  totalCount: number;
  totalSize: number;
  byProject: Record<string, { count: number; size: number }>;
}> {
  const records = await db.images.toArray();

  let totalSize = 0;
  const byProject: Record<string, { count: number; size: number }> = {};

  for (const img of records) {
    const size = (typeof img.size === 'number' && Number.isFinite(img.size)) ? img.size : 0;
    totalSize += size;

    const pid = img.projectId || 'unknown';
    if (!byProject[pid]) {
      byProject[pid] = { count: 0, size: 0 };
    }
    byProject[pid].count++;
    byProject[pid].size += size;
  }

  return { totalCount: records.length, totalSize, byProject };
}

/**
 * Get unique values for a metadata field (for filter dropdowns).
 */
export async function getImageFilterOptions(
  field: 'entityKind' | 'entityCulture' | 'model' | 'projectId'
): Promise<string[]> {
  const records = await db.images.toArray();
  const values = new Set<string>();
  for (const record of records) {
    const val = (record as any)[field];
    if (val) values.add(val);
  }
  return [...values].sort();
}

/**
 * Search images with rich filters (entity kind, culture, model, text search).
 * Returns metadata without blobs.
 */
export async function searchImagesWithFilters(filters: {
  projectId?: string;
  entityKind?: string;
  entityCulture?: string;
  model?: string;
  imageType?: string;
  chronicleId?: string;
  searchText?: string;
  limit?: number;
} = {}): Promise<Array<Omit<ImageRecord, 'blob'> & { hasBlob: boolean }>> {
  const records = await db.images.toArray();

  let images: Array<Omit<ImageRecord, 'blob'> & { hasBlob: boolean }> = records.map((record) => ({
    ...record,
    hasBlob: true,
  }));

  if (filters.projectId) images = images.filter((img) => img.projectId === filters.projectId);
  if (filters.entityKind) images = images.filter((img) => img.entityKind === filters.entityKind);
  if (filters.entityCulture) images = images.filter((img) => img.entityCulture === filters.entityCulture);
  if (filters.model) images = images.filter((img) => img.model === filters.model);
  if (filters.imageType) images = images.filter((img) => img.imageType === filters.imageType);
  if (filters.chronicleId) images = images.filter((img) => img.chronicleId === filters.chronicleId);

  if (filters.searchText) {
    const search = filters.searchText.toLowerCase();
    images = images.filter((img) =>
      (img.entityName?.toLowerCase().includes(search)) ||
      (img.originalPrompt?.toLowerCase().includes(search)) ||
      (img.finalPrompt?.toLowerCase().includes(search)) ||
      (img.revisedPrompt?.toLowerCase().includes(search))
    );
  }

  images.sort((a, b) => (b.generatedAt || 0) - (a.generatedAt || 0));

  if (filters.limit && filters.limit > 0) {
    images = images.slice(0, filters.limit);
  }

  return images;
}

/**
 * Format bytes to human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ============================================================================
// Bulk Export for Prompt Analysis
// ============================================================================

/**
 * Export all image prompt data for analysis.
 * Excludes image blobs to keep export size manageable.
 */
export async function exportImagePrompts(): Promise<ImagePromptExport[]> {
  const records = await db.images.toArray();

  const exports: ImagePromptExport[] = records.map((record) => ({
    imageId: record.imageId,
    entityId: record.entityId,
    entityName: record.entityName,
    entityKind: record.entityKind,
    entityCulture: record.entityCulture,
    generatedAt: record.generatedAt,
    model: record.model,
    originalPrompt: record.originalPrompt,
    formattingPrompt: record.formattingPrompt,
    finalPrompt: record.finalPrompt,
    revisedPrompt: record.revisedPrompt,
    imageType: record.imageType,
    chronicleId: record.chronicleId,
    sceneDescription: record.sceneDescription,
  }));

  // Sort by generatedAt descending (newest first)
  exports.sort((a, b) => b.generatedAt - a.generatedAt);
  return exports;
}

/**
 * Export image prompts and download as JSON file.
 */
export async function downloadImagePromptExport(): Promise<void> {
  const exports = await exportImagePrompts();
  const json = JSON.stringify(exports, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `image-prompts-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`Exported ${exports.length} image prompt records`);
}
