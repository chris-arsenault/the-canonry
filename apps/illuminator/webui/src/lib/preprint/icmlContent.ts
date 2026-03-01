/* eslint-disable max-lines -- four content converters with typed helpers; splitting further fragments cohesive domain logic */
/**
 * ICML Content Converters
 *
 * Converts domain objects (entities, chronicles, era narratives, static pages)
 * into arrays of IcmlParagraph for use by both ICML and IDML generators.
 *
 * Extracted from icmlExport.ts to reduce file length and complexity.
 */

import type { PersistedEntity } from "../db/illuminatorDb";
import type { ChronicleRecord, EntityImageRef, PromptRequestRef } from "../chronicleTypes";
import type { ImageMetadataRecord } from "./prePrintStats";
import type { StaticPage } from "../staticPageTypes";
import type {
  EraNarrativeRecord,
  ChronicleImageRef as EraNarrativeChronicleRef,
  EraNarrativeThread,
} from "../eraNarrativeTypes";
import type { HistorianNote } from "../historianTypes";
import { isNoteActive, noteDisplay } from "../historianTypes";
import { resolveActiveContent } from "../db/eraNarrativeRepository";
import type { ContentTreeState, ExportImageEntry } from "./prePrintTypes";
import type { ImageType } from "../imageTypes";
import { flattenForExport } from "./contentTree";
import { resolveAnchorPhrase } from "../fuzzyAnchor";
import type { IcmlParagraph } from "./icmlStyles";
import {
  plainPara,
  styledPara,
  markdownToIcmlParagraphs,
  getImageExt,
  PS_ITEM_TITLE,
  PS_ITEM_SUBTITLE,
  PS_METADATA,
  PS_IMAGE_PLACEHOLDER,
  PS_CAPTION,
  PS_BLOCKQUOTE,
  PS_HEADING2,
  PS_HISTORIAN_NOTE,
  PS_CAST_ENTRY,
  PS_SEPARATOR,
  PS_SECTION_HEADING,
  PS_ERA_HEADING,
  CS_BOLD,
  CS_ITALIC,
} from "./icmlStyles";

// =============================================================================
// Types
// =============================================================================

/** Image source classification for export: entity, chronicle, or cover */
export type ImageSourceType = ImageType | "cover";

/** Callback for registering images encountered during content conversion */
export type ImageRegisterFn = (
  imgId: string,
  type: ImageSourceType,
  entityId?: string,
  entityName?: string,
  chronicleId?: string
) => void;

/** Common base shape for all image ref types used in annotation */
interface BaseImageRef {
  type: string;
  anchorText: string;
  anchorIndex?: number;
  size: string;
  justification?: string;
  caption?: string;
}

/** Container for image refs — shared between chronicle and era narrative records */
interface ImageRefsContainer {
  refs?: ReadonlyArray<BaseImageRef & Record<string, unknown>>;
}

/** Type guard: completed prompt-request image ref with a generated image */
function isCompletedPromptRef(
  r: BaseImageRef & Record<string, unknown>
): r is PromptRequestRef {
  return (
    r.type === "prompt_request" &&
    r["status"] === "complete" &&
    typeof r["generatedImageId"] === "string" &&
    r["generatedImageId"].length > 0
  );
}

/** Type guard: entity reference image ref */
function isEntityRef(
  r: BaseImageRef & Record<string, unknown>
): r is EntityImageRef {
  return r.type === "entity_ref";
}

/** Type guard: chronicle reference image ref (era narratives) */
function isChronicleRef(
  r: BaseImageRef & Record<string, unknown>
): r is EraNarrativeChronicleRef {
  return r.type === "chronicle_ref";
}

export interface ContentMaps {
  entityMap: Map<string, PersistedEntity>;
  chronicleMap: Map<string, ChronicleRecord>;
  pageMap: Map<string, StaticPage>;
  narrativeMap: Map<string, EraNarrativeRecord>;
}

// =============================================================================
// Anchor Resolution
// =============================================================================

function resolveInsertPosition(text: string, anchorText: string, anchorIndex?: number): number {
  const resolved = anchorText ? resolveAnchorPhrase(anchorText, text) : null;
  let position = resolved ? resolved.index : -1;
  if (position < 0 && anchorIndex !== undefined && anchorIndex < text.length) {
    position = anchorIndex;
  }
  if (position < 0) position = text.length;

  const anchorLength = anchorText?.length ?? 0;
  const anchorEnd = position + anchorLength;
  const paragraphEnd = text.indexOf("\n\n", anchorEnd);
  return paragraphEnd >= 0 ? paragraphEnd : text.length;
}

// =============================================================================
// Image Annotation Helpers
// =============================================================================

interface InsertionEntry {
  insertAt: number;
  marker: string;
}

function buildPromptInsertions(
  content: string,
  refs: ReadonlyArray<BaseImageRef & Record<string, unknown>>,
  imageMap: Map<string, ImageMetadataRecord>,
  registerFn: ImageRegisterFn
): InsertionEntry[] {
  const promptRefs = refs.filter(isCompletedPromptRef);

  return promptRefs
    .map((ref) => {
      const imgId = ref.generatedImageId ?? "";
      registerFn(imgId, "chronicle");
      const ext = getImageExt(imageMap.get(imgId));
      const caption = ref.caption || "";
      const marker = `\n\n<!-- IMAGE: images/${imgId}${ext} | size: ${ref.size} | float: ${ref.justification || "none"} | caption: "${caption}" -->\n\n`;
      return {
        insertAt: resolveInsertPosition(content, ref.anchorText, ref.anchorIndex),
        marker,
      };
    })
    .sort((a, b) => b.insertAt - a.insertAt);
}

function buildEntityRefInsertions(
  content: string,
  refs: ReadonlyArray<BaseImageRef & Record<string, unknown>>
): InsertionEntry[] {
  const entityRefs = refs.filter(isEntityRef);

  return entityRefs
    .map((ref) => {
      const caption = ref.caption || "";
      const marker = `\n\n<!-- IMAGE: entity-portrait-${ref.entityId} | size: ${ref.size} | float: ${ref.justification || "none"} | caption: "${caption}" -->\n\n`;
      return {
        insertAt: resolveInsertPosition(content, ref.anchorText, ref.anchorIndex),
        marker,
      };
    })
    .sort((a, b) => b.insertAt - a.insertAt);
}

function buildChronicleRefInsertions(
  content: string,
  refs: ReadonlyArray<BaseImageRef & Record<string, unknown>>,
  imageMap: Map<string, ImageMetadataRecord>,
  registerFn: ImageRegisterFn
): InsertionEntry[] {
  const chronicleRefs = refs.filter(isChronicleRef);

  return chronicleRefs
    .map((ref) => {
      const imgId = ref.imageId;
      registerFn(imgId, "chronicle");
      const ext = getImageExt(imageMap.get(imgId));
      const caption = ref.caption || "";
      const marker = `\n\n<!-- IMAGE: images/${imgId}${ext} | size: ${ref.size} | float: ${ref.justification || "none"} | caption: "${caption}" -->\n\n`;
      return {
        insertAt: resolveInsertPosition(content, ref.anchorText, ref.anchorIndex),
        marker,
      };
    })
    .sort((a, b) => b.insertAt - a.insertAt);
}

function applyInsertions(text: string, insertions: InsertionEntry[]): string {
  let result = text;
  for (const { insertAt, marker } of insertions) {
    result = result.slice(0, insertAt) + marker + result.slice(insertAt);
  }
  return result;
}

/**
 * Insert image markers into content text and return annotated markdown.
 * Mirrors the logic from markdownExport.ts.
 */
export function annotateContentWithImages(
  content: string,
  imageRefs: ImageRefsContainer | undefined,
  imageMap: Map<string, ImageMetadataRecord>,
  referencedImages: Map<string, ExportImageEntry>,
  registerFn: ImageRegisterFn
): string {
  if (!imageRefs?.refs || !content) return content;

  const refs = imageRefs.refs;
  let annotated = content;

  // Prompt-request images (insert in reverse position order to preserve indices)
  annotated = applyInsertions(
    annotated,
    buildPromptInsertions(content, refs, imageMap, registerFn)
  );

  // Entity-ref images
  annotated = applyInsertions(
    annotated,
    buildEntityRefInsertions(content, refs)
  );

  // Chronicle-ref images (for era narratives)
  annotated = applyInsertions(
    annotated,
    buildChronicleRefInsertions(content, refs, imageMap, registerFn)
  );

  return annotated;
}

// =============================================================================
// Historian Notes Helper
// =============================================================================

function renderHistorianNotes(notes: HistorianNote[] | undefined): IcmlParagraph[] {
  const active = notes?.filter((n: HistorianNote) => isNoteActive(n));
  if (!active?.length) return [];

  const fullNotes = active.filter((n: HistorianNote) => noteDisplay(n) === "full");
  const popoutNotes = active.filter((n: HistorianNote) => noteDisplay(n) === "popout");

  if (fullNotes.length === 0 && popoutNotes.length === 0) return [];

  const paras: IcmlParagraph[] = [];
  paras.push(plainPara(PS_HEADING2, "Historian\u2019s Notes"));

  for (const note of fullNotes) {
    const typeLabel = note.type.charAt(0).toUpperCase() + note.type.slice(1);
    paras.push({
      paraStyle: PS_HISTORIAN_NOTE,
      runs: [
        { charStyle: CS_BOLD, text: `[${typeLabel}] ` },
        { charStyle: "", text: note.text },
        { charStyle: CS_ITALIC, text: ` (anchored to: \u201C${note.anchorPhrase}\u201D)` },
      ],
    });
  }

  for (const note of popoutNotes) {
    const typeLabel = note.type.charAt(0).toUpperCase() + note.type.slice(1);
    paras.push({
      paraStyle: PS_HISTORIAN_NOTE,
      runs: [
        { charStyle: CS_ITALIC, text: `[${typeLabel}] ` },
        { charStyle: "", text: `${note.text} \u2014 \u201C${note.anchorPhrase}\u201D` },
      ],
    });
  }

  return paras;
}

// =============================================================================
// Entity Metadata Helpers
// =============================================================================

function buildEntityMetadata(entity: PersistedEntity): IcmlParagraph[] {
  const paras: IcmlParagraph[] = [];

  // Subtitle: kind / subtype / culture
  const subtitleParts = [entity.kind];
  if (entity.subtype) subtitleParts.push(entity.subtype);
  if (entity.culture) subtitleParts.push(entity.culture);
  paras.push(plainPara(PS_ITEM_SUBTITLE, subtitleParts.join(" \u2022 ")));

  // Prominence and status
  paras.push(plainPara(PS_METADATA, `Prominence: ${entity.prominence} | Status: ${entity.status}`));

  // Aliases
  const aliases = entity.enrichment?.text?.aliases;
  if (aliases?.length) {
    paras.push(plainPara(PS_METADATA, `Also known as: ${aliases.join(", ")}`));
  }

  // Tags
  if (entity.tags && Object.keys(entity.tags).length > 0) {
    const tagStr = Object.entries(entity.tags)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" | ");
    paras.push(plainPara(PS_METADATA, tagStr));
  }

  return paras;
}

function buildEntityImage(
  entity: PersistedEntity,
  imageMap: Map<string, ImageMetadataRecord>,
  registerFn: ImageRegisterFn
): IcmlParagraph[] {
  const imageId = entity.enrichment?.image?.imageId;
  if (!imageId) return [];

  registerFn(imageId, "entity", entity.id, entity.name);
  const ext = getImageExt(imageMap.get(imageId));
  return [
    plainPara(PS_IMAGE_PLACEHOLDER, `[IMAGE: images/${imageId}${ext}]`),
    plainPara(PS_CAPTION, `${entity.name} portrait`),
  ];
}

// =============================================================================
// Content Converters
// =============================================================================

/** Convert an entity to ICML paragraphs */
export function entityToIcmlParagraphs(
  entity: PersistedEntity,
  imageMap: Map<string, ImageMetadataRecord>,
  referencedImages: Map<string, ExportImageEntry>,
  registerFn: ImageRegisterFn
): IcmlParagraph[] {
  const paras: IcmlParagraph[] = [];

  paras.push(plainPara(PS_ITEM_TITLE, entity.name));
  paras.push(...buildEntityMetadata(entity));
  paras.push(...buildEntityImage(entity, imageMap, registerFn));

  if (entity.summary) {
    paras.push(styledPara(PS_BLOCKQUOTE, entity.summary));
  }

  if (entity.description) {
    paras.push(...markdownToIcmlParagraphs(entity.description));
  }

  paras.push(...renderHistorianNotes(entity.enrichment?.historianNotes));

  return paras;
}

// =============================================================================
// Chronicle Helpers
// =============================================================================

function buildChronicleHeader(chronicle: ChronicleRecord): IcmlParagraph[] {
  const paras: IcmlParagraph[] = [];

  paras.push(plainPara(PS_ITEM_TITLE, chronicle.title || "Untitled Chronicle"));

  const subtitleParts = [chronicle.format, chronicle.focusType];
  if (chronicle.narrativeStyle?.name) subtitleParts.push(chronicle.narrativeStyle.name);
  paras.push(plainPara(PS_ITEM_SUBTITLE, subtitleParts.join(" \u2022 ")));

  if (chronicle.summary) {
    paras.push(styledPara(PS_BLOCKQUOTE, chronicle.summary));
  }

  return paras;
}

function buildChronicleCoverImage(
  chronicle: ChronicleRecord,
  imageMap: Map<string, ImageMetadataRecord>,
  registerFn: ImageRegisterFn
): IcmlParagraph[] {
  const coverImageId = chronicle.coverImage?.generatedImageId;
  if (!coverImageId || chronicle.coverImage?.status !== "complete") return [];

  registerFn(coverImageId, "cover", undefined, undefined, chronicle.chronicleId);
  const ext = getImageExt(imageMap.get(coverImageId));
  return [
    plainPara(PS_IMAGE_PLACEHOLDER, `[IMAGE: images/${coverImageId}${ext}]`),
    plainPara(PS_CAPTION, chronicle.title || "Cover"),
  ];
}

function buildChronicleCast(chronicle: ChronicleRecord): IcmlParagraph[] {
  if (!chronicle.roleAssignments?.length) return [];

  const paras: IcmlParagraph[] = [];
  paras.push(plainPara(PS_HEADING2, "Cast"));
  for (const ra of chronicle.roleAssignments) {
    const emphasis = ra.isPrimary ? "Primary" : "Supporting";
    paras.push({
      paraStyle: PS_CAST_ENTRY,
      runs: [
        { charStyle: CS_BOLD, text: ra.role },
        { charStyle: "", text: ` \u2014 ${ra.entityName} (${ra.entityKind}, ${emphasis})` },
      ],
    });
  }
  return paras;
}

/** Convert a chronicle to ICML paragraphs */
export function chronicleToIcmlParagraphs(
  chronicle: ChronicleRecord,
  imageMap: Map<string, ImageMetadataRecord>,
  referencedImages: Map<string, ExportImageEntry>,
  registerFn: ImageRegisterFn
): IcmlParagraph[] {
  const paras: IcmlParagraph[] = [];
  const content = chronicle.finalContent || chronicle.assembledContent || "";

  paras.push(...buildChronicleHeader(chronicle));
  paras.push(...buildChronicleCoverImage(chronicle, imageMap, registerFn));
  paras.push(...buildChronicleCast(chronicle));

  if (content) {
    const annotated = annotateContentWithImages(
      content,
      chronicle.imageRefs,
      imageMap,
      referencedImages,
      registerFn
    );
    paras.push(...markdownToIcmlParagraphs(annotated));
  }

  paras.push(...renderHistorianNotes(chronicle.historianNotes));

  return paras;
}

// =============================================================================
// Era Narrative Helpers
// =============================================================================

function buildEraNarrativeHeader(
  narrative: EraNarrativeRecord
): IcmlParagraph[] {
  const paras: IcmlParagraph[] = [];

  paras.push(plainPara(PS_ITEM_TITLE, narrative.eraName));
  paras.push(plainPara(PS_ITEM_SUBTITLE, `${narrative.tone} \u2022 era narrative`));

  if (narrative.threadSynthesis?.thesis) {
    paras.push(styledPara(PS_BLOCKQUOTE, narrative.threadSynthesis.thesis));
  }

  if (narrative.threadSynthesis?.threads?.length) {
    const threadNames = narrative.threadSynthesis.threads
      .map((t: EraNarrativeThread) => t.name)
      .join(", ");
    paras.push(plainPara(PS_METADATA, `Threads: ${threadNames}`));
  }

  return paras;
}

function buildEraNarrativeCoverImage(
  narrative: EraNarrativeRecord,
  imageMap: Map<string, ImageMetadataRecord>,
  registerFn: ImageRegisterFn
): IcmlParagraph[] {
  const coverImageId = narrative.coverImage?.generatedImageId;
  if (!coverImageId || narrative.coverImage?.status !== "complete") return [];

  registerFn(coverImageId, "cover");
  const ext = getImageExt(imageMap.get(coverImageId));
  return [
    plainPara(PS_IMAGE_PLACEHOLDER, `[IMAGE: images/${coverImageId}${ext}]`),
    plainPara(PS_CAPTION, narrative.eraName),
  ];
}

/** Convert an era narrative to ICML paragraphs */
export function eraNarrativeToIcmlParagraphs(
  narrative: EraNarrativeRecord,
  imageMap: Map<string, ImageMetadataRecord>,
  referencedImages: Map<string, ExportImageEntry>,
  registerFn: ImageRegisterFn
): IcmlParagraph[] {
  const paras: IcmlParagraph[] = [];
  const { content } = resolveActiveContent(narrative);

  paras.push(...buildEraNarrativeHeader(narrative));
  paras.push(...buildEraNarrativeCoverImage(narrative, imageMap, registerFn));

  if (content) {
    const annotated = annotateContentWithImages(
      content,
      narrative.imageRefs,
      imageMap,
      referencedImages,
      registerFn
    );
    paras.push(...markdownToIcmlParagraphs(annotated));
  }

  return paras;
}

/** Convert a static page to ICML paragraphs */
export function staticPageToIcmlParagraphs(page: StaticPage): IcmlParagraph[] {
  const paras: IcmlParagraph[] = [];

  paras.push(plainPara(PS_ITEM_TITLE, page.title));

  if (page.content) {
    paras.push(...markdownToIcmlParagraphs(page.content));
  }

  return paras;
}

// =============================================================================
// Image Registration
// =============================================================================

export function createImageRegistrar(
  referencedImages: Map<string, ExportImageEntry>,
  imageMap: Map<string, ImageMetadataRecord>
): ImageRegisterFn {
  return function registerImage(
    imgId: string,
    type: ImageSourceType,
    entityId?: string,
    entityName?: string,
    chronicleId?: string
  ): void {
    if (referencedImages.has(imgId)) return;
    const img = imageMap.get(imgId);
    const ext = getImageExt(img);
    referencedImages.set(imgId, {
      imageId: imgId,
      filename: `${imgId}${ext}`,
      width: img?.width,
      height: img?.height,
      aspect: img?.aspect,
      imageType: type,
      entityId: entityId || img?.entityId,
      entityName: entityName || img?.entityName,
      chronicleId: chronicleId || img?.chronicleId,
      mimeType: img?.mimeType,
    });
  };
}

// =============================================================================
// Book Assembly
// =============================================================================

function convertNodeContent(
  nodeType: string,
  contentId: string,
  contentMaps: ContentMaps,
  imageMap: Map<string, ImageMetadataRecord>,
  referencedImages: Map<string, ExportImageEntry>,
  registerFn: ImageRegisterFn
): IcmlParagraph[] {
  if (nodeType === "entity") {
    const entity = contentMaps.entityMap.get(contentId);
    return entity ? entityToIcmlParagraphs(entity, imageMap, referencedImages, registerFn) : [];
  }
  if (nodeType === "chronicle") {
    const chronicle = contentMaps.chronicleMap.get(contentId);
    return chronicle
      ? chronicleToIcmlParagraphs(chronicle, imageMap, referencedImages, registerFn)
      : [];
  }
  if (nodeType === "era_narrative") {
    const narrative = contentMaps.narrativeMap.get(contentId);
    return narrative
      ? eraNarrativeToIcmlParagraphs(narrative, imageMap, referencedImages, registerFn)
      : [];
  }
  if (nodeType === "static_page") {
    const page = contentMaps.pageMap.get(contentId);
    return page ? staticPageToIcmlParagraphs(page) : [];
  }
  return [];
}

/**
 * Walk the content tree and produce an array of styled paragraphs.
 * Used by both ICML and IDML generators.
 */
export function buildBookParagraphs(
  treeState: ContentTreeState,
  contentMaps: ContentMaps,
  imageMap: Map<string, ImageMetadataRecord>,
  referencedImages: Map<string, ExportImageEntry>
): IcmlParagraph[] {
  const registerFn = createImageRegistrar(referencedImages, imageMap);

  const allParagraphs: IcmlParagraph[] = [];
  const flattened = flattenForExport(treeState);
  let prevWasContent = false;

  for (const { node, depth } of flattened) {
    if (node.type === "folder") {
      if (prevWasContent) {
        allParagraphs.push(plainPara(PS_SEPARATOR, "* * *"));
        prevWasContent = false;
      }
      const headingStyle = depth <= 0 ? PS_SECTION_HEADING : PS_ERA_HEADING;
      allParagraphs.push(plainPara(headingStyle, node.name));
      continue;
    }

    if (!node.contentId) continue;

    if (prevWasContent) {
      allParagraphs.push(plainPara(PS_SEPARATOR, "* * *"));
    }

    const contentParas = convertNodeContent(
      node.type,
      node.contentId,
      contentMaps,
      imageMap,
      referencedImages,
      registerFn
    );

    if (contentParas.length > 0) {
      allParagraphs.push(...contentParas);
      prevWasContent = true;
    }
  }

  return allParagraphs;
}
