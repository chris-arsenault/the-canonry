/**
 * Pre-Print Stats Computation
 *
 * Pure computation module: takes entities, chronicles, images, and static pages,
 * returns a PrePrintStats object with all metrics a copy editor needs.
 */

import type { PersistedEntity } from '../db/illuminatorDb';
import type { ChronicleRecord, ChronicleImageRef } from '../chronicleTypes';
import type { ImageRecord, ImageAspect, ImageType } from '../imageTypes';

/** Image metadata without blob — what getAllImages() returns */
export type ImageMetadataRecord = Omit<ImageRecord, 'blob'> & { hasBlob: boolean };
import type { StaticPage } from '../staticPageTypes';
import type { HistorianNote, HistorianNoteType } from '../historianTypes';
import type {
  PrePrintStats,
  WordCountBreakdown,
  CharCountBreakdown,
  ImageStats,
  CompletenessStats,
  HistorianNoteStats,
} from './prePrintTypes';
import type { ChronicleImageSize } from '../chronicleTypes';
import { countWords } from '../db/staticPageRepository';

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
    if (c.coverImage?.sceneDescription) {
      // Scene descriptions aren't captions per se, but they're image-related text
    }
  }
  return captions;
}

function collectHistorianNoteTexts(notes: HistorianNote[]): string {
  return notes.map((n) => n.text).join(' ');
}

function getPublishedContent(chronicle: ChronicleRecord): string {
  return chronicle.finalContent || chronicle.assembledContent || '';
}

export function computePrePrintStats(
  entities: PersistedEntity[],
  chronicles: ChronicleRecord[],
  images: ImageMetadataRecord[],
  staticPages: StaticPage[]
): PrePrintStats {
  // Filter to publishable content
  const publishedChronicles = chronicles.filter(
    (c) => c.status === 'complete' || c.status === 'assembly_ready'
  );
  const publishedPages = staticPages.filter((p) => p.status === 'published');

  // =========================================================================
  // Word & Character Counts
  // =========================================================================

  const chronicleBodyTexts = publishedChronicles.map(getPublishedContent);
  const chronicleSummaryTexts = publishedChronicles.map((c) => c.summary || '');
  const entityDescTexts = entities.map((e) => e.description || '');
  const entitySummaryTexts = entities.map((e) => e.summary || '');
  const captionTexts = collectCaptions(publishedChronicles);
  const pageTexts = publishedPages.map((p) => p.content || '');

  // Historian notes: collect from both entities and chronicles
  const entityHistorianNotes: HistorianNote[] = [];
  for (const e of entities) {
    if (e.enrichment?.historianNotes?.length) {
      entityHistorianNotes.push(...e.enrichment.historianNotes);
    }
  }
  const chronicleHistorianNotes: HistorianNote[] = [];
  for (const c of publishedChronicles) {
    if (c.historianNotes?.length) {
      chronicleHistorianNotes.push(...c.historianNotes);
    }
  }
  const allHistorianNotes = [...entityHistorianNotes, ...chronicleHistorianNotes];
  const historianNoteText = collectHistorianNoteTexts(allHistorianNotes);

  const sumWords = (texts: string[]) => texts.reduce((s, t) => s + countWords(t), 0);
  const sumChars = (texts: string[]) => texts.reduce((s, t) => s + countChars(t), 0);

  const wordBreakdown: WordCountBreakdown = {
    chronicleBody: sumWords(chronicleBodyTexts),
    chronicleSummaries: sumWords(chronicleSummaryTexts),
    entityDescriptions: sumWords(entityDescTexts),
    entitySummaries: sumWords(entitySummaryTexts),
    imageCaptions: sumWords(captionTexts),
    historianNotes: countWords(historianNoteText),
    staticPageContent: sumWords(pageTexts),
  };

  const charBreakdown: CharCountBreakdown = {
    chronicleBody: sumChars(chronicleBodyTexts),
    chronicleSummaries: sumChars(chronicleSummaryTexts),
    entityDescriptions: sumChars(entityDescTexts),
    entitySummaries: sumChars(entitySummaryTexts),
    imageCaptions: sumChars(captionTexts),
    historianNotes: countChars(historianNoteText),
    staticPageContent: sumChars(pageTexts),
  };

  const totalWords = Object.values(wordBreakdown).reduce((s, v) => s + v, 0);
  const totalChars = Object.values(charBreakdown).reduce((s, v) => s + v, 0);

  // =========================================================================
  // Image Stats
  // =========================================================================

  const byAspect: Record<ImageAspect, number> = { portrait: 0, landscape: 0, square: 0 };
  const byType: Record<ImageType | 'cover', number> = { entity: 0, chronicle: 0, cover: 0 };
  const bySize: Record<ChronicleImageSize, number> = { small: 0, medium: 0, large: 0, 'full-width': 0 };

  let minW = Infinity, maxW = 0, minH = Infinity, maxH = 0;
  let hasDimensions = false;

  for (const img of images) {
    const aspect = img.aspect || 'square';
    byAspect[aspect]++;

    const type = img.imageType || 'entity';
    byType[type]++;

    if (img.width && img.height) {
      hasDimensions = true;
      if (img.width < minW) minW = img.width;
      if (img.width > maxW) maxW = img.width;
      if (img.height < minH) minH = img.height;
      if (img.height > maxH) maxH = img.height;
    }
  }

  // Count cover images separately
  for (const c of publishedChronicles) {
    if (c.coverImage?.generatedImageId && c.coverImage.status === 'complete') {
      byType.cover++;
    }
  }

  // Count image size designations from chronicle image refs
  for (const c of publishedChronicles) {
    if (!c.imageRefs?.refs) continue;
    for (const ref of c.imageRefs.refs) {
      bySize[ref.size]++;
    }
  }

  const totalStorageBytes = images.reduce((s, img) => s + (img.size || 0), 0);

  const imageStats: ImageStats = {
    total: images.length,
    totalStorageBytes,
    byAspect,
    byType,
    bySize,
    dimensionRange: hasDimensions
      ? { minWidth: minW, maxWidth: maxW, minHeight: minH, maxHeight: maxH }
      : null,
  };

  // =========================================================================
  // Completeness
  // =========================================================================

  const entityImageIds = new Set(
    images.filter((i) => (i.imageType || 'entity') === 'entity').map((i) => i.entityId)
  );

  const completeness: CompletenessStats = {
    entitiesTotal: entities.length,
    entitiesWithDescription: entities.filter((e) => e.description).length,
    entitiesWithImage: entities.filter((e) => entityImageIds.has(e.id)).length,
    entitiesWithSummary: entities.filter((e) => e.summary).length,
    chroniclesTotal: publishedChronicles.length,
    chroniclesPublished: publishedChronicles.filter((c) => c.status === 'complete').length,
    chroniclesWithHistorianNotes: publishedChronicles.filter((c) => c.historianNotes?.length).length,
    chroniclesWithSceneImages: publishedChronicles.filter(
      (c) => c.imageRefs?.refs?.some((r) => r.type === 'prompt_request' && r.status === 'complete')
    ).length,
    staticPagesTotal: staticPages.length,
    staticPagesPublished: publishedPages.length,
  };

  // =========================================================================
  // Historian Notes
  // =========================================================================

  const noteTypes: HistorianNoteType[] = ['commentary', 'correction', 'tangent', 'skepticism', 'pedantic'];
  const byNoteType: Record<HistorianNoteType, number> = {
    commentary: 0, correction: 0, tangent: 0, skepticism: 0, pedantic: 0,
  };
  for (const note of allHistorianNotes) {
    if (byNoteType[note.type] !== undefined) {
      byNoteType[note.type]++;
    }
  }

  const historianNoteStats: HistorianNoteStats = {
    total: allHistorianNotes.length,
    byType: byNoteType,
    onEntities: entityHistorianNotes.length,
    onChronicles: chronicleHistorianNotes.length,
  };

  return {
    totalWords,
    totalChars,
    estimatedPages: Math.ceil(totalWords / 250),
    wordBreakdown,
    charBreakdown,
    images: imageStats,
    completeness,
    historianNotes: historianNoteStats,
    calculatedAt: Date.now(),
  };
}
