/**
 * Pre-Print Stats Computation
 *
 * Pure computation module: takes entities, chronicles, images, static pages,
 * and era narratives, returns a PrePrintStats object with all metrics a
 * copy editor needs.
 */

import type { PersistedEntity } from "../db/illuminatorDb";
import type { ChronicleRecord } from "../chronicleTypes";
import type { ImageRecord, ImageAspect, ImageType } from "../imageTypes";

/** Image metadata without blob — what getAllImages() returns */
export type ImageMetadataRecord = Omit<ImageRecord, "blob"> & { hasBlob: boolean };
import type { StaticPage } from "../staticPageTypes";
import type { EraNarrativeRecord } from "../eraNarrativeTypes";
import type { HistorianNote, HistorianNoteType } from "../historianTypes";
import type {
  PrePrintStats,
  WordCountBreakdown,
  CharCountBreakdown,
  ImageStats,
  CompletenessStats,
  HistorianNoteStats,
} from "./prePrintTypes";
import type { ChronicleImageSize } from "../chronicleTypes";
import { countWords } from "../db/staticPageRepository";
import { resolveActiveContent } from "../db/eraNarrativeRepository";

function countChars(text: string): number {
  return text.length;
}

function collectCaptions(chronicles: ChronicleRecord[]): string[] {
  const captions: string[] = [];
  for (const c of chronicles) {
    if (!c.imageRefs?.refs) continue;
    for (const ref of c.imageRefs.refs) {
      if (ref.caption) captions.push(ref.caption);
    }
  }
  return captions;
}

function collectHistorianNoteTexts(notes: HistorianNote[]): string {
  return notes.map((n) => n.text).join(" ");
}

function getPublishedContent(chronicle: ChronicleRecord): string {
  return chronicle.finalContent || chronicle.assembledContent || "";
}

function collectNarrativeTexts(narratives: EraNarrativeRecord[]): string[] {
  return narratives.map((n) => {
    const { content } = resolveActiveContent(n);
    return content || "";
  });
}

function collectHistorianNotes(
  entities: PersistedEntity[],
  chronicles: ChronicleRecord[]
): { entity: HistorianNote[]; chronicle: HistorianNote[] } {
  const entity: HistorianNote[] = [];
  for (const e of entities) {
    if (e.enrichment?.historianNotes?.length) {
      entity.push(...e.enrichment.historianNotes);
    }
  }
  const chronicle: HistorianNote[] = [];
  for (const c of chronicles) {
    if (c.historianNotes?.length) {
      chronicle.push(...c.historianNotes);
    }
  }
  return { entity, chronicle };
}

function computeImageStats(
  images: ImageMetadataRecord[],
  publishedChronicles: ChronicleRecord[]
): ImageStats {
  const byAspect: Record<ImageAspect, number> = { portrait: 0, landscape: 0, square: 0 };
  const byType: Record<ImageType | "cover", number> = { entity: 0, chronicle: 0, cover: 0 };
  const bySize: Record<ChronicleImageSize, number> = {
    small: 0,
    medium: 0,
    large: 0,
    "full-width": 0,
  };
  let minW = Infinity, maxW = 0, minH = Infinity, maxH = 0;
  let hasDimensions = false;
  for (const img of images) {
    const aspect = img.aspect || "square";
    byAspect[aspect]++;
    const isCover = img.imageRefId === "__cover_image__";
    const type = isCover ? "cover" : img.imageType || "entity";
    byType[type]++;
    if (img.width && img.height) {
      hasDimensions = true;
      if (img.width < minW) minW = img.width;
      if (img.width > maxW) maxW = img.width;
      if (img.height < minH) minH = img.height;
      if (img.height > maxH) maxH = img.height;
    }
  }
  for (const c of publishedChronicles) {
    if (!c.imageRefs?.refs) continue;
    for (const ref of c.imageRefs.refs) {
      bySize[ref.size]++;
    }
  }
  const totalStorageBytes = images.reduce((s, img) => s + (img.size || 0), 0);
  return {
    total: images.length,
    totalStorageBytes,
    byAspect,
    byType,
    bySize,
    dimensionRange: hasDimensions
      ? { minWidth: minW, maxWidth: maxW, minHeight: minH, maxHeight: maxH }
      : null,
  };
}

function computeCompletenessStats(
  entities: PersistedEntity[],
  publishedChronicles: ChronicleRecord[],
  staticPages: StaticPage[],
  publishedPages: StaticPage[],
  totalEras: number,
  eraNarratives: EraNarrativeRecord[]
): CompletenessStats {
  return {
    entitiesTotal: entities.length,
    entitiesWithDescription: entities.filter((e) => e.description).length,
    entitiesWithImage: entities.filter((e) => e.enrichment?.image?.imageId).length,
    entitiesWithSummary: entities.filter((e) => e.summary).length,
    chroniclesTotal: publishedChronicles.length,
    chroniclesPublished: publishedChronicles.filter((c) => c.status === "complete").length,
    chroniclesWithHistorianNotes: publishedChronicles.filter((c) => c.historianNotes?.length).length,
    chroniclesWithSceneImages: publishedChronicles.filter((c) =>
      c.imageRefs?.refs?.some((r) => r.type === "prompt_request" && r.status === "complete")
    ).length,
    staticPagesTotal: staticPages.length,
    staticPagesPublished: publishedPages.length,
    eraNarrativesTotal: totalEras,
    eraNarrativesComplete: eraNarratives.filter((n) => n.status === "complete").length,
    eraNarrativesWithCoverImage: eraNarratives.filter((n) => n.coverImage?.status === "complete").length,
  };
}

function computeHistorianNoteStats(
  allNotes: HistorianNote[],
  entityNotes: HistorianNote[],
  chronicleNotes: HistorianNote[]
): HistorianNoteStats {
  const byNoteType: Record<HistorianNoteType, number> = {
    commentary: 0, correction: 0, tangent: 0, skepticism: 0, pedantic: 0,
  };
  for (const note of allNotes) {
    if (byNoteType[note.type] !== undefined) {
      byNoteType[note.type]++;
    }
  }
  return {
    total: allNotes.length,
    byType: byNoteType,
    onEntities: entityNotes.length,
    onChronicles: chronicleNotes.length,
  };
}

export function computePrePrintStats(
  entities: PersistedEntity[],
  chronicles: ChronicleRecord[],
  images: ImageMetadataRecord[],
  staticPages: StaticPage[],
  eraNarratives: EraNarrativeRecord[]
): PrePrintStats {
  const publishedChronicles = chronicles.filter(
    (c) => c.status === "complete" || c.status === "assembly_ready"
  );
  const publishedPages = staticPages.filter((p) => p.status === "published");
  const completedNarratives = eraNarratives.filter(
    (n) => n.status === "complete" || n.status === "step_complete"
  );

  const chronicleBodyTexts = publishedChronicles.map(getPublishedContent);
  const chronicleSummaryTexts = publishedChronicles.map((c) => c.summary || "");
  const entityDescTexts = entities.map((e) => e.description || "");
  const entitySummaryTexts = entities.map((e) => e.summary || "");
  const captionTexts = collectCaptions(publishedChronicles);
  const pageTexts = publishedPages.map((p) => p.content || "");
  const narrativeTexts = collectNarrativeTexts(completedNarratives);

  const { entity: entityHistorianNotes, chronicle: chronicleHistorianNotes } =
    collectHistorianNotes(entities, publishedChronicles);
  const allHistorianNotes = [...entityHistorianNotes, ...chronicleHistorianNotes];

  const sumWords = (texts: string[]) => texts.reduce((s, t) => s + countWords(t), 0);
  const sumChars = (texts: string[]) => texts.reduce((s, t) => s + countChars(t), 0);

  const entityHistorianNoteText = collectHistorianNoteTexts(entityHistorianNotes);
  const chronicleHistorianNoteText = collectHistorianNoteTexts(chronicleHistorianNotes);

  const wordBreakdown: WordCountBreakdown = {
    chronicleBody: sumWords(chronicleBodyTexts),
    chronicleSummaries: sumWords(chronicleSummaryTexts),
    entityDescriptions: sumWords(entityDescTexts),
    entitySummaries: sumWords(entitySummaryTexts),
    eraNarrativeContent: sumWords(narrativeTexts),
    imageCaptions: sumWords(captionTexts),
    historianNotesEntity: countWords(entityHistorianNoteText),
    historianNotesChronicle: countWords(chronicleHistorianNoteText),
    staticPageContent: sumWords(pageTexts),
  };

  const charBreakdown: CharCountBreakdown = {
    chronicleBody: sumChars(chronicleBodyTexts),
    chronicleSummaries: sumChars(chronicleSummaryTexts),
    entityDescriptions: sumChars(entityDescTexts),
    entitySummaries: sumChars(entitySummaryTexts),
    eraNarrativeContent: sumChars(narrativeTexts),
    imageCaptions: sumChars(captionTexts),
    historianNotesEntity: countChars(entityHistorianNoteText),
    historianNotesChronicle: countChars(chronicleHistorianNoteText),
    staticPageContent: sumChars(pageTexts),
  };

  const totalWords = Object.values(wordBreakdown).reduce((s, v) => s + v, 0);
  const totalChars = Object.values(charBreakdown).reduce((s, v) => s + v, 0);
  const totalEras = entities.filter((e) => e.kind === "era").length;

  return {
    totalWords,
    totalChars,
    estimatedPages: Math.ceil(totalWords / 250),
    wordBreakdown,
    charBreakdown,
    images: computeImageStats(images, publishedChronicles),
    completeness: computeCompletenessStats(
      entities, publishedChronicles, staticPages, publishedPages, totalEras, eraNarratives
    ),
    historianNotes: computeHistorianNoteStats(allHistorianNotes, entityHistorianNotes, chronicleHistorianNotes),
    calculatedAt: Date.now(),
  };
}
