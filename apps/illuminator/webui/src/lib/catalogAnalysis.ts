/**
 * catalogAnalysis — Scan images in Dexie to produce a coverage report.
 *
 * Reports per-field completeness and derivability for catalog metadata fields.
 * Drives the iterative backfill workflow in the Catalog tab.
 */

import { db } from "./db/illuminatorDb";
import { isChronicleImage } from "./imageTypes";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FieldCoverage {
  field: string;
  present: number;
  missing: number;
  derivable: number;
  derivableSource: string;
  remainingAfterFill: number;
  remainingWithPrompt: number;
  remainingNoPrompt: number;
}

export interface CoverageReport {
  totalImages: number;
  fields: FieldCoverage[];
  generatedAt: number;
}

// ─── Ref Lookup Builder ──────────────────────────────────────────────────────

interface RefMetadata {
  suggestedArtisticStyleId?: string;
  suggestedCompositionStyleId?: string;
  suggestedColorPaletteId?: string;
  visualTags?: string[];
  sceneDescription?: string;
  isCover: boolean;
}

/**
 * Build a lookup from generatedImageId → ref metadata across all chronicles.
 */
async function buildRefLookup(projectId: string): Promise<Map<string, RefMetadata>> {
  const lookup = new Map<string, RefMetadata>();
  const chronicles = await db.chronicles
    .where("projectId")
    .equals(projectId)
    .toArray();

  for (const c of chronicles) {
    // Scene refs
    const refs = (c as Record<string, unknown>).imageRefs as
      | { refs: Array<Record<string, unknown>> }
      | undefined;
    if (refs?.refs) {
      for (const ref of refs.refs) {
        const imgId = ref.generatedImageId as string | undefined;
        if (imgId) {
          lookup.set(imgId, {
            suggestedArtisticStyleId: ref.suggestedArtisticStyleId as string | undefined,
            suggestedCompositionStyleId: ref.suggestedCompositionStyleId as string | undefined,
            suggestedColorPaletteId: ref.suggestedColorPaletteId as string | undefined,
            visualTags: ref.visualTags as string[] | undefined,
            sceneDescription: ref.sceneDescription as string | undefined,
            isCover: false,
          });
        }
      }
    }

    // Cover image
    const cover = (c as Record<string, unknown>).coverImage as Record<string, unknown> | undefined;
    if (cover?.generatedImageId) {
      lookup.set(cover.generatedImageId as string, {
        suggestedArtisticStyleId: cover.suggestedArtisticStyleId as string | undefined,
        suggestedCompositionStyleId: cover.suggestedCompositionStyleId as string | undefined,
        suggestedColorPaletteId: cover.suggestedColorPaletteId as string | undefined,
        visualTags: cover.visualTags as string[] | undefined,
        sceneDescription: cover.sceneDescription as string | undefined,
        isCover: true,
      });
    }
  }
  return lookup;
}

// ─── Coverage Analysis ───────────────────────────────────────────────────────

export async function analyzeCoverage(projectId: string): Promise<CoverageReport> {
  const allImages = await db.images
    .where("projectId")
    .equals(projectId)
    .toArray();

  const refLookup = await buildRefLookup(projectId);

  const fields: FieldCoverage[] = [];

  // Helper: count field coverage
  function analyzeField(
    fieldName: string,
    getValue: (img: Record<string, unknown>) => unknown,
    canDerive: (img: Record<string, unknown>) => boolean,
    derivableSource: string,
  ): FieldCoverage {
    let present = 0;
    let missing = 0;
    let derivable = 0;
    let remainingWithPrompt = 0;
    let remainingNoPrompt = 0;

    for (const img of allImages) {
      const rec = img as unknown as Record<string, unknown>;
      const val = getValue(rec);
      const hasValue =
        val !== undefined && val !== null && val !== "" &&
        !(Array.isArray(val) && val.length === 0);

      if (hasValue) {
        present++;
      } else {
        missing++;
        if (canDerive(rec)) {
          derivable++;
        } else {
          // Check if we have prompt data for LLM inference
          if (rec.finalPrompt || rec.originalPrompt) {
            remainingWithPrompt++;
          } else {
            remainingNoPrompt++;
          }
        }
      }
    }

    return {
      field: fieldName,
      present,
      missing,
      derivable,
      derivableSource,
      remainingAfterFill: missing - derivable,
      remainingWithPrompt,
      remainingNoPrompt,
    };
  }

  // imageType — derivable for all images
  fields.push(
    analyzeField(
      "imageType",
      (img) => {
        const t = img.imageType as string | undefined;
        // "chronicle" is legacy and needs reclassification
        return t && t !== "chronicle" ? t : undefined;
      },
      () => true, // Always derivable — entity stays entity, chronicle → scene/cover
      "entity type or chronicle ref type",
    ),
  );

  // title — derivable for all images
  fields.push(
    analyzeField(
      "title",
      (img) => img.title,
      () => true, // Always derivable from entityName or sceneDescription
      "entityName / sceneDescription pattern",
    ),
  );

  // tags — derivable where linked ref has visualTags
  fields.push(
    analyzeField(
      "tags",
      (img) => img.tags,
      (img) => {
        const ref = refLookup.get(img.imageId as string);
        return Boolean(ref?.visualTags?.length);
      },
      "visualTags on linked chronicle ref",
    ),
  );

  // artisticStyleId
  fields.push(
    analyzeField(
      "artisticStyleId",
      (img) => img.artisticStyleId,
      (img) => {
        const ref = refLookup.get(img.imageId as string);
        return Boolean(ref?.suggestedArtisticStyleId);
      },
      "suggestedArtisticStyleId on linked ref",
    ),
  );

  // compositionStyleId
  fields.push(
    analyzeField(
      "compositionStyleId",
      (img) => img.compositionStyleId,
      (img) => {
        const ref = refLookup.get(img.imageId as string);
        return Boolean(ref?.suggestedCompositionStyleId);
      },
      "suggestedCompositionStyleId on linked ref",
    ),
  );

  // colorPaletteId
  fields.push(
    analyzeField(
      "colorPaletteId",
      (img) => img.colorPaletteId,
      (img) => {
        const ref = refLookup.get(img.imageId as string);
        return Boolean(ref?.suggestedColorPaletteId);
      },
      "suggestedColorPaletteId on linked ref",
    ),
  );

  return {
    totalImages: allImages.length,
    fields,
    generatedAt: Date.now(),
  };
}
