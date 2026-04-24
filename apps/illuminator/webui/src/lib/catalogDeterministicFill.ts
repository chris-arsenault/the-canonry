/**
 * catalogDeterministicFill — Fill image metadata fields from known sources.
 *
 * Fills: imageType reclassification, title, tags (from visualTags),
 * artisticStyleId, compositionStyleId, colorPaletteId (from suggested fields
 * on linked chronicle refs).
 *
 * Does NOT use LLM — only deterministic derivation from existing data.
 */

import { db } from "./db/illuminatorDb";
import { isChronicleImage } from "./imageTypes";
import type { ImageType } from "./imageTypes";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FillResult {
  updated: number;
  skipped: number;
  errors: number;
  details: { imageId: string; fieldsSet: string[] }[];
}

// ─── Ref Metadata Lookup ─────────────────────────────────────────────────────

interface RefSource {
  suggestedArtisticStyleId?: string;
  suggestedCompositionStyleId?: string;
  suggestedColorPaletteId?: string;
  visualTags?: string[];
  sceneDescription?: string;
  isCover: boolean;
  chronicleTitle?: string;
}

async function buildRefLookup(projectId: string): Promise<Map<string, RefSource>> {
  const lookup = new Map<string, RefSource>();
  const chronicles = await db.chronicles
    .where("projectId")
    .equals(projectId)
    .toArray();

  for (const c of chronicles) {
    const cRec = c as Record<string, unknown>;
    const title = (cRec.title as string) || (cRec.name as string) || "Chronicle";

    // Scene refs
    const imageRefs = cRec.imageRefs as { refs: Array<Record<string, unknown>> } | undefined;
    if (imageRefs?.refs) {
      for (const ref of imageRefs.refs) {
        const imgId = ref.generatedImageId as string | undefined;
        if (imgId) {
          lookup.set(imgId, {
            suggestedArtisticStyleId: ref.suggestedArtisticStyleId as string | undefined,
            suggestedCompositionStyleId: ref.suggestedCompositionStyleId as string | undefined,
            suggestedColorPaletteId: ref.suggestedColorPaletteId as string | undefined,
            visualTags: ref.visualTags as string[] | undefined,
            sceneDescription: ref.sceneDescription as string | undefined,
            isCover: false,
            chronicleTitle: title,
          });
        }
      }
    }

    // Cover image
    const cover = cRec.coverImage as Record<string, unknown> | undefined;
    if (cover?.generatedImageId) {
      lookup.set(cover.generatedImageId as string, {
        suggestedArtisticStyleId: cover.suggestedArtisticStyleId as string | undefined,
        suggestedCompositionStyleId: cover.suggestedCompositionStyleId as string | undefined,
        suggestedColorPaletteId: cover.suggestedColorPaletteId as string | undefined,
        visualTags: cover.visualTags as string[] | undefined,
        sceneDescription: cover.sceneDescription as string | undefined,
        isCover: true,
        chronicleTitle: title,
      });
    }
  }
  return lookup;
}

// ─── Deterministic Fill ──────────────────────────────────────────────────────

export async function runDeterministicFill(projectId: string): Promise<FillResult> {
  const allImages = await db.images
    .where("projectId")
    .equals(projectId)
    .toArray();

  const refLookup = await buildRefLookup(projectId);

  const result: FillResult = { updated: 0, skipped: 0, errors: 0, details: [] };

  for (const img of allImages) {
    const rec = img as unknown as Record<string, unknown>;
    const imageId = rec.imageId as string;
    const ref = refLookup.get(imageId);
    const updates: Record<string, unknown> = {};
    const fieldsSet: string[] = [];

    // 1. imageType reclassification
    const currentType = rec.imageType as string | undefined;
    if (!currentType || currentType === "chronicle") {
      let newType: ImageType;
      if (currentType === "chronicle" || isChronicleImage(currentType)) {
        newType = ref?.isCover ? "cover" : "scene";
      } else if (rec.entityId && !rec.chronicleId) {
        newType = "entity";
      } else {
        newType = "other";
      }
      // Only set if different from current
      if (newType !== currentType) {
        updates.imageType = newType;
        fieldsSet.push("imageType");
      }
    }

    // 2. title
    if (!rec.title) {
      const entityName = rec.entityName as string | undefined;
      const sceneDesc = (rec.sceneDescription as string | undefined) || ref?.sceneDescription;
      const effectiveType = (updates.imageType as string) || currentType;

      if (effectiveType === "cover" && ref?.chronicleTitle) {
        updates.title = `${ref.chronicleTitle} Cover`;
        fieldsSet.push("title");
      } else if (sceneDesc) {
        updates.title = sceneDesc.slice(0, 120);
        fieldsSet.push("title");
      } else if (entityName) {
        updates.title = entityName;
        fieldsSet.push("title");
      }
    }

    // 3. tags from visualTags
    const currentTags = rec.tags as string[] | undefined;
    if ((!currentTags || currentTags.length === 0) && ref?.visualTags?.length) {
      updates.tags = ref.visualTags;
      fieldsSet.push("tags");
    }

    // 4. artisticStyleId from suggested
    if (!rec.artisticStyleId && ref?.suggestedArtisticStyleId) {
      updates.artisticStyleId = ref.suggestedArtisticStyleId;
      fieldsSet.push("artisticStyleId");
    }

    // 5. compositionStyleId from suggested
    if (!rec.compositionStyleId && ref?.suggestedCompositionStyleId) {
      updates.compositionStyleId = ref.suggestedCompositionStyleId;
      fieldsSet.push("compositionStyleId");
    }

    // 6. colorPaletteId from suggested
    if (!rec.colorPaletteId && ref?.suggestedColorPaletteId) {
      updates.colorPaletteId = ref.suggestedColorPaletteId;
      fieldsSet.push("colorPaletteId");
    }

    // Apply updates
    if (fieldsSet.length > 0) {
      try {
        await db.images.update(imageId, updates);
        result.updated++;
        result.details.push({ imageId, fieldsSet });
      } catch (e) {
        console.error(`[CatalogFill] Failed to update ${imageId}:`, e);
        result.errors++;
      }
    } else {
      result.skipped++;
    }
  }

  return result;
}
