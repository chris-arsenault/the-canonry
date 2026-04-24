/**
 * catalogBuilder — Builds catalog.json from Dexie image records for the pics viewer.
 *
 * The catalog is a read-optimized projection of the unified Dexie image store,
 * built at S3 sync time. It contains all metadata needed for client-side
 * filtering/sorting/searching in the public viewer.
 */

import { db } from "./db/illuminatorDb";
import type { ImageAspect, ImageType } from "./imageTypes";

// ─── Catalog Types ───────────────────────────────────────────────────────────

export interface ImageCatalogEntry {
  imageId: string;
  title: string;
  artisticStyleId: string;
  compositionStyleId: string;
  colorPaletteId: string;
  imageType: ImageType;
  tags: string[];
  entityName?: string;
  entityKind?: string;
  entityCulture?: string;
  model: string;
  width: number;
  height: number;
  aspect: ImageAspect;
  generatedAt: number;
  thumbPath: string;
  fullPath: string;
  /** High-quality upscaled version path (only present for upscaled images) */
  hqPath?: string;
}

export interface ImageCatalog {
  version: 1;
  generatedAt: string;
  baseUrl: string;
  images: ImageCatalogEntry[];
  facets: {
    artisticStyles: string[];
    compositionStyles: string[];
    colorPalettes: string[];
    entityKinds: string[];
    cultures: string[];
    models: string[];
    imageTypes: string[];
  };
}

// ─── Builder ─────────────────────────────────────────────────────────────────

function buildImagePath(
  prefix: string,
  variant: string,
  projectId: string,
  imageId: string,
): string {
  const parts = [prefix, variant, projectId, `${imageId}.webp`].filter(Boolean);
  return parts.join("/");
}

/**
 * Build catalog.json from all images in Dexie for a given project.
 *
 * @param baseUrl CloudFront domain for image CDN (e.g. "https://cdn.example.com")
 * @param projectId Project to export
 * @param imagePrefix S3 base prefix (e.g. "canonry")
 */
export async function buildCatalog(
  baseUrl: string,
  projectId: string,
  imagePrefix: string,
): Promise<ImageCatalog> {
  const allImages = await db.images
    .where("projectId")
    .equals(projectId)
    .toArray();

  const entries: ImageCatalogEntry[] = [];
  const facetSets = {
    artisticStyles: new Set<string>(),
    compositionStyles: new Set<string>(),
    colorPalettes: new Set<string>(),
    entityKinds: new Set<string>(),
    cultures: new Set<string>(),
    models: new Set<string>(),
    imageTypes: new Set<string>(),
  };

  for (const img of allImages) {
    // Skip images without dimensions (can't display in masonry grid)
    if (!img.imageId || !img.width || !img.height) continue;

    const imageType: ImageType = (img.imageType as ImageType) || "other";
    const entry: ImageCatalogEntry = {
      imageId: img.imageId,
      title: img.title || img.entityName || "Untitled",
      artisticStyleId: img.artisticStyleId || "unknown",
      compositionStyleId: img.compositionStyleId || "unknown",
      colorPaletteId: img.colorPaletteId || "unknown",
      imageType,
      tags: img.tags || [],
      entityName: img.entityName,
      entityKind: img.entityKind,
      entityCulture: img.entityCulture,
      model: img.model,
      width: img.width,
      height: img.height,
      aspect: img.aspect || "square",
      generatedAt: img.generatedAt,
      thumbPath: buildImagePath(imagePrefix, "thumb", projectId, img.imageId),
      fullPath: buildImagePath(imagePrefix, "webp", projectId, img.imageId),
      hqPath: img.hqWidth
        ? [imagePrefix, "hq", projectId, `${img.imageId}.png`].filter(Boolean).join("/")
        : undefined,
    };
    entries.push(entry);

    // Accumulate facets (skip "unknown" placeholder values)
    if (entry.artisticStyleId !== "unknown")
      facetSets.artisticStyles.add(entry.artisticStyleId);
    if (entry.compositionStyleId !== "unknown")
      facetSets.compositionStyles.add(entry.compositionStyleId);
    if (entry.colorPaletteId !== "unknown")
      facetSets.colorPalettes.add(entry.colorPaletteId);
    if (entry.entityKind) facetSets.entityKinds.add(entry.entityKind);
    if (entry.entityCulture) facetSets.cultures.add(entry.entityCulture);
    facetSets.models.add(entry.model);
    facetSets.imageTypes.add(imageType);
  }

  // Sort newest first
  entries.sort((a, b) => b.generatedAt - a.generatedAt);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    baseUrl,
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
}
