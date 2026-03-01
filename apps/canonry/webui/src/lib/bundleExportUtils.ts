/**
 * Bundle export utilities for the Canonry app.
 *
 * Extracted from App.jsx to reduce file size and complexity.
 * Contains pure/async helper functions for building viewer bundles,
 * image asset gathering, entity hydration, and import/export logic.
 */

import { getImagesByProject, getImageBlob, getImageMetadata } from "./imageExportHelpers";
import { buildStorageImageUrl } from "../aws/awsS3";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoreRecord {
  id: string;
  type: string;
  targetId: string;
  text: string;
  metadata: {
    generatedAt?: string;
    model?: string;
  };
}

interface LoreData {
  llmEnabled: boolean;
  model: string;
  records: LoreRecord[];
}

interface WorldEntity {
  id: string;
  kind: string;
  name?: string;
  enrichment?: {
    image?: { imageId?: string };
    eraNarrative?: { text?: string; generatedAt?: string; model?: string };
  };
  [key: string]: unknown;
}

interface WorldData {
  hardState?: WorldEntity[];
  relationships?: unknown[];
  narrativeHistory?: unknown[];
  coordinateState?: unknown;
  schema?: unknown;
  metadata?: Record<string, unknown>;
  pressures?: unknown;
  [key: string]: unknown;
}

interface HydrateParams {
  worldData: WorldData;
  projectId: string;
  simulationRunId: string;
}

interface ImageRecord {
  imageId: string;
  mimeType?: string;
  originalPrompt?: string;
  finalPrompt?: string;
  revisedPrompt?: string;
  entityId?: string;
  entityName?: string;
  entityKind?: string;
  imageType?: string;
  chronicleId?: string;
  imageRefId?: string;
}

interface ImageEntry {
  entityId: string;
  entityName: string;
  entityKind: string;
  prompt: string;
  localPath: string;
  imageId: string;
  imageType?: string;
  chronicleId?: string;
  imageRefId?: string;
}

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
  shouldCancel?: () => boolean;
  onProgress?: (info: { phase: string; processed: number; total: number }) => void;
  mode?: "local" | "s3";
  storage?: ImageStorageConfig | null;
}

interface Chronicle {
  coverImage?: { generatedImageId?: string };
  imageRefs?: { refs?: ImageRef[] };
  [key: string]: unknown;
}

interface ImageRef {
  type?: string;
  generatedImageId?: string;
  entityId?: string;
  imageId?: string;
  [key: string]: unknown;
}

interface EraNarrative {
  coverImage?: { generatedImageId?: string };
  imageRefs?: { refs?: EraNarrativeRef[] };
  [key: string]: unknown;
}

interface EraNarrativeRef {
  type?: string;
  imageId?: string;
  generatedImageId?: string;
}

interface StaticPage {
  content?: string;
  status?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Lore data extraction
// ---------------------------------------------------------------------------

export function extractLoreDataFromEntities(worldData: WorldData | null): LoreData | null {
  if (!worldData?.hardState) return null;
  const records: LoreRecord[] = [];
  for (const entity of worldData.hardState) {
    const enrichment = entity.enrichment;
    if (!enrichment) continue;
    if (enrichment.eraNarrative?.text) {
      records.push({
        id: `era_${entity.id}`,
        type: entity.kind === "era" ? "era_chapter" : "entity_chronicle",
        targetId: entity.id,
        text: enrichment.eraNarrative.text,
        metadata: {
          generatedAt: enrichment.eraNarrative.generatedAt,
          model: enrichment.eraNarrative.model,
        },
      });
    }
  }
  if (records.length === 0) return null;
  return { llmEnabled: true, model: "mixed", records };
}

/**
 * Async wrapper kept for caller compatibility.
 * Delegates to the synchronous extractLoreDataFromEntities.
 */
export async function extractLoreDataWithCurrentImageRefs(
  worldData: WorldData | null,
): Promise<LoreData | null> {
  return extractLoreDataFromEntities(worldData);
}

// ---------------------------------------------------------------------------
// Dexie entity merge
// ---------------------------------------------------------------------------

function stripSimulationRunId<T extends Record<string, unknown>>(
  record: T,
): Omit<T, "simulationRunId"> {
  if (!record || typeof record !== "object") return record;
  const { simulationRunId: _omit, ...rest } = record;
  return rest as Omit<T, "simulationRunId">;
}

function mergeEntitiesWithDexie(
  baseEntities: WorldEntity[],
  dexieEntities: WorldEntity[],
): WorldEntity[] {
  if (!Array.isArray(baseEntities) || baseEntities.length === 0) {
    return Array.isArray(dexieEntities)
      ? dexieEntities.map(stripSimulationRunId) as WorldEntity[]
      : [];
  }
  if (!Array.isArray(dexieEntities) || dexieEntities.length === 0) {
    return baseEntities;
  }
  const dexieById = new Map(dexieEntities.map((entity) => [entity.id, entity]));
  const merged: WorldEntity[] = baseEntities.map((entity) => {
    const updated = dexieById.get(entity.id);
    if (!updated) return entity;
    return { ...entity, ...stripSimulationRunId(updated) };
  });
  const baseIds = new Set(baseEntities.map((entity) => entity.id));
  for (const entity of dexieEntities) {
    if (entity?.id && !baseIds.has(entity.id)) {
      merged.push(stripSimulationRunId(entity) as WorldEntity);
    }
  }
  return merged;
}

export async function hydrateWorldDataFromDexie({
  worldData,
  projectId,
  simulationRunId,
}: HydrateParams): Promise<WorldData> {
  const missingParams = [
    !worldData && "worldData",
    !simulationRunId && "simulationRunId",
    !projectId && "projectId",
  ].filter(Boolean);
  if (missingParams.length > 0) {
    throw new Error(`Cannot hydrate export: missing ${missingParams.join(", ")}`);
  }

  const [
    { getEntitiesForRun },
    { getNarrativeEventsForRun },
    { getRelationshipsForRun },
    { getCoordinateState },
    { getSchema },
  ] = await Promise.all([
    import("illuminator/entityRepository"),
    import("illuminator/eventRepository"),
    import("illuminator/relationshipRepository"),
    import("illuminator/coordinateStateRepository"),
    import("illuminator/schemaRepository"),
  ]);

  const [dexieEntities, dexieEvents, dexieRelationships, coordinateRecord, schemaRecord] =
    await Promise.all([
      getEntitiesForRun(simulationRunId),
      getNarrativeEventsForRun(simulationRunId),
      getRelationshipsForRun(simulationRunId),
      getCoordinateState(simulationRunId),
      getSchema(projectId),
    ]);

  const mergedEntities = mergeEntitiesWithDexie(
    (worldData.hardState as WorldEntity[]) || [],
    dexieEntities as WorldEntity[],
  );
  const relationships =
    Array.isArray(dexieRelationships) && dexieRelationships.length > 0
      ? (dexieRelationships as Record<string, unknown>[]).map(stripSimulationRunId)
      : worldData.relationships || [];
  const narrativeHistory =
    Array.isArray(dexieEvents) && dexieEvents.length > 0
      ? (dexieEvents as Record<string, unknown>[]).map(stripSimulationRunId)
      : worldData.narrativeHistory || [];
  const coordinateState =
    (coordinateRecord as Record<string, unknown>)?.coordinateState || worldData.coordinateState;
  const schema = (schemaRecord as Record<string, unknown>)?.schema || worldData.schema;

  return {
    ...worldData,
    schema,
    hardState: mergedEntities,
    relationships,
    narrativeHistory,
    coordinateState,
    metadata: {
      ...(worldData.metadata || {}),
      entityCount: mergedEntities.length,
      relationshipCount: (relationships as unknown[]).length,
    },
  };
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

const EXPORT_CANCEL_ERROR_NAME = "ExportCanceledError";

function createExportCanceledError(): Error {
  const error = new Error("Export canceled");
  error.name = EXPORT_CANCEL_ERROR_NAME;
  return error;
}

export { EXPORT_CANCEL_ERROR_NAME };

function throwIfExportCanceled(shouldCancel?: () => boolean): void {
  if (shouldCancel && shouldCancel()) {
    throw createExportCanceledError();
  }
}

function mimeTypeToExtension(mimeType: string | undefined): string {
  if (!mimeType) return "bin";
  const normalized = mimeType.toLowerCase();
  return IMAGE_EXTENSION_BY_TYPE[normalized] || "bin";
}

function sanitizeFileName(value: string | undefined, fallback: string): string {
  if (typeof value !== "string") return fallback;
  // eslint-disable-next-line sonarjs/slow-regex -- short filename string, no ReDoS risk
  const sanitized = value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || fallback;
}

// ---------------------------------------------------------------------------
// Image ID collection (kept separate to reduce per-function complexity)
// ---------------------------------------------------------------------------

function collectEntityImageIds(
  worldData: WorldData,
  ids: Set<string>,
  entityById: Map<string, WorldEntity>,
): void {
  if (!worldData?.hardState) return;
  for (const entity of worldData.hardState) {
    if (entity?.id) entityById.set(entity.id, entity);
    const imageId = entity?.enrichment?.image?.imageId;
    if (imageId) ids.add(imageId);
  }
}

function collectChronicleImageIds(
  chronicles: Chronicle[],
  ids: Set<string>,
  entityById: Map<string, WorldEntity>,
): void {
  if (!Array.isArray(chronicles)) return;
  for (const chronicle of chronicles) {
    addChronicleCoversAndRefs(chronicle, ids, entityById);
  }
}

/** Extracts image IDs from a single chronicle to keep per-function complexity low. */
function addChronicleCoversAndRefs(
  chronicle: Chronicle,
  ids: Set<string>,
  entityById: Map<string, WorldEntity>,
): void {
  const coverImageId = chronicle?.coverImage?.generatedImageId;
  if (coverImageId) ids.add(coverImageId);
  const refs = chronicle?.imageRefs?.refs || [];
  for (const ref of refs) {
    if (ref?.generatedImageId) ids.add(ref.generatedImageId);
    if (ref?.type === "entity_ref" && ref?.entityId) {
      const entity = entityById.get(ref.entityId);
      const entityImageId = entity?.enrichment?.image?.imageId;
      if (entityImageId) ids.add(entityImageId);
    }
  }
}

function collectEraNarrativeImageIds(eraNarratives: EraNarrative[], ids: Set<string>): void {
  if (!Array.isArray(eraNarratives)) return;
  for (const narrative of eraNarratives) {
    addEraNarrativeCoversAndRefs(narrative, ids);
  }
}

/** Extracts image IDs from a single era narrative. */
function addEraNarrativeCoversAndRefs(narrative: EraNarrative, ids: Set<string>): void {
  const coverImageId = narrative?.coverImage?.generatedImageId;
  if (coverImageId) ids.add(coverImageId);
  const refs = narrative?.imageRefs?.refs || [];
  for (const ref of refs) {
    if (ref?.type === "chronicle_ref" && ref?.imageId) ids.add(ref.imageId);
    if (ref?.type === "prompt_request" && ref?.generatedImageId) ids.add(ref.generatedImageId);
  }
}

function collectStaticPageImageIds(staticPages: StaticPage[], ids: Set<string>): void {
  if (!Array.isArray(staticPages)) return;
  for (const page of staticPages) {
    const content = page?.content;
    if (typeof content !== "string") continue;
    const matcher = /image:([A-Za-z0-9_-]+)/g;
    let match = matcher.exec(content);
    while (match) {
      if (match[1]) ids.add(match[1]);
      match = matcher.exec(content);
    }
  }
}

function collectReferencedImageIds(
  worldData: WorldData,
  chronicles: Chronicle[],
  staticPages: StaticPage[],
  eraNarratives: EraNarrative[],
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

function buildImageEntry(
  imageId: string,
  record: ImageRecord | undefined,
  localPath: string,
  entityByImageId: Map<string, WorldEntity>,
  entityById: Map<string, WorldEntity>,
): ImageEntry {
  const entity =
    entityByImageId.get(imageId) || (record?.entityId ? entityById.get(record.entityId) : null);
  const prompt = record?.originalPrompt || record?.finalPrompt || record?.revisedPrompt || "";
  const entry: ImageEntry = {
    entityId: entity?.id || record?.entityId || "chronicle",
    entityName: entity?.name || record?.entityName || "Unknown",
    entityKind: (entity?.kind as string) || record?.entityKind || "unknown",
    prompt,
    localPath,
    imageId,
  };
  if (record?.imageType === "chronicle") {
    entry.imageType = "chronicle";
    entry.chronicleId = record.chronicleId;
    entry.imageRefId = record.imageRefId;
  }
  return entry;
}

function processS3Image(
  imageId: string,
  record: ImageRecord | undefined,
  storage: ImageStorageConfig,
  entityByImageId: Map<string, WorldEntity>,
  entityById: Map<string, WorldEntity>,
  images: Record<string, string>,
  imageResults: ImageEntry[],
): boolean {
  const remotePath = buildStorageImageUrl(storage, "raw", imageId);
  if (!remotePath) return false;
  images[imageId] = remotePath;
  imageResults.push(buildImageEntry(imageId, record, remotePath, entityByImageId, entityById));
  return true;
}

function processLocalImage(
  imageId: string,
  record: ImageRecord | undefined,
  blob: Blob,
  entityByImageId: Map<string, WorldEntity>,
  entityById: Map<string, WorldEntity>,
  images: Record<string, string>,
  imageFiles: ImageFile[],
  imageResults: ImageEntry[],
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
// Main image asset builder
// ---------------------------------------------------------------------------

/** Processes image IDs from S3, returning count of processed. */
async function processS3Images(
  imageIds: Set<string>,
  imageById: Map<string, ImageRecord>,
  storage: ImageStorageConfig,
  entityByImageId: Map<string, WorldEntity>,
  entityById: Map<string, WorldEntity>,
  images: Record<string, string>,
  imageResults: ImageEntry[],
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

/** Processes image IDs from local IndexedDB, returning count of processed. */
async function processLocalImages(
  imageIds: Set<string>,
  imageById: Map<string, ImageRecord>,
  entityByImageId: Map<string, WorldEntity>,
  entityById: Map<string, WorldEntity>,
  images: Record<string, string>,
  imageFiles: ImageFile[],
  imageResults: ImageEntry[],
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
    const blob = await getImageBlob(imageId);
    throwIfExportCanceled(shouldCancel);
    processed += 1;
    if (blob) {
      processLocalImage(
        imageId, record, blob, entityByImageId, entityById,
        images, imageFiles, imageResults, usedNames,
      );
    }
    if (onProgress) onProgress({ phase: "images", processed, total: totalImages });
  }
}

export async function buildBundleImageAssets({
  projectId,
  worldData,
  chronicles,
  staticPages,
  eraNarratives,
  shouldCancel,
  onProgress,
  mode = "local",
  storage,
}: BuildBundleImageAssetsParams): Promise<ImageAssets> {
  const imageIds = collectReferencedImageIds(worldData, chronicles, staticPages, eraNarratives);
  const totalImages = imageIds.size;
  if (totalImages === 0) {
    return { imageData: null, images: null, imageFiles: [] };
  }

  const imageRecords = projectId
    ? ((await getImagesByProject(projectId)) as ImageRecord[])
    : [];
  const imageById = new Map(imageRecords.map((record) => [record.imageId, record]));
  const entityById = new Map(
    ((worldData?.hardState as WorldEntity[]) || []).map((entity) => [entity.id, entity]),
  );
  const entityByImageId = new Map<string, WorldEntity>();
  for (const entity of (worldData?.hardState as WorldEntity[]) || []) {
    const imageId = entity?.enrichment?.image?.imageId;
    if (imageId) entityByImageId.set(imageId, entity);
  }

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

// ---------------------------------------------------------------------------
// World output detection & export helpers
// ---------------------------------------------------------------------------

export function isWorldOutput(candidate: unknown): boolean {
  if (!candidate || typeof candidate !== "object") return false;
  const c = candidate as Record<string, unknown>;
  return Boolean(
    c.schema &&
      c.metadata &&
      Array.isArray(c.hardState) &&
      Array.isArray(c.relationships) &&
      c.pressures &&
      typeof c.pressures === "object",
  );
}

export function mergeDefined<T>(value: T | undefined, fallback: T): T {
  return value === undefined ? fallback : value;
}

export function buildExportBase(value: string | undefined, fallback: string): string {
  const raw = value || fallback || "export";
  return raw
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function normalizeWorldContextForExport(
  worldContext: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!worldContext || typeof worldContext !== "object") return null;
  const worldDynamics = Array.isArray(worldContext.worldDynamics)
    ? worldContext.worldDynamics
    : [];
  return { ...worldContext, worldDynamics };
}

export { throwIfExportCanceled };
