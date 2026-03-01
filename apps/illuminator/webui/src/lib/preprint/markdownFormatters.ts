/**
 * Markdown Export — content formatters.
 *
 * Each format* function produces a complete markdown document (with frontmatter)
 * for a single content item.
 */

import type { PersistedEntity } from "../db/illuminatorDb";
import type {
  ChronicleRecord,
  ChronicleImageRef as ChrChronicleImageRef,
  PromptRequestRef,
  EntityImageRef,
} from "../chronicleTypes";
import type { ImageMetadataRecord } from "./prePrintStats";
import type { StaticPage } from "../staticPageTypes";
import type { EraNarrativeRecord, EraNarrativePromptRequestRef } from "../eraNarrativeTypes";
import type { ExportImageEntry } from "./prePrintTypes";
import { countWords } from "../db/staticPageRepository";
import { resolveActiveContent } from "../db/eraNarrativeRepository";
import {
  yamlString,
  getImageExt,
  registerImage,
  resolveInsertPosition,
  appendHistorianNotes,
} from "./markdownHelpers";

// =============================================================================
// Entity Formatter
// =============================================================================

function buildEntityFrontmatter(entity: PersistedEntity): string[] {
  const imageId = entity.enrichment?.image?.imageId;
  const lines: string[] = [];

  lines.push("---");
  lines.push(`title: ${yamlString(entity.name)}`);
  lines.push("type: entity");
  lines.push(`entity_kind: ${entity.kind}`);
  if (entity.subtype) lines.push(`entity_subtype: ${entity.subtype}`);
  if (entity.culture) lines.push(`culture: ${entity.culture}`);
  lines.push(`status: ${entity.status}`);
  lines.push(`prominence: ${entity.prominence}`);
  lines.push(`word_count: ${countWords(entity.description || "")}`);
  lines.push(`has_image: ${!!imageId}`);
  if (imageId) lines.push(`image_id: ${imageId}`);

  const aliases = entity.enrichment?.text?.aliases;
  if (aliases?.length) {
    lines.push("aliases:");
    for (const a of aliases) lines.push(`  - ${yamlString(a)}`);
  }

  if (entity.tags && Object.keys(entity.tags).length > 0) {
    lines.push("tags:");
    for (const [k, v] of Object.entries(entity.tags)) {
      lines.push(`  ${k}: ${yamlString(String(v))}`);
    }
  }
  lines.push("---");
  lines.push("");
  return lines;
}

function buildEntityBody(
  entity: PersistedEntity,
  referencedImages: Map<string, ExportImageEntry>,
  imageMap: Map<string, ImageMetadataRecord>
): string[] {
  const lines: string[] = [];
  const imageId = entity.enrichment?.image?.imageId;

  lines.push(`# ${entity.name}`);
  lines.push("");
  if (entity.summary) {
    lines.push(`*${entity.summary}*`);
    lines.push("");
  }

  if (entity.description) {
    lines.push(entity.description);
    lines.push("");
  }

  if (imageId) {
    registerImage(referencedImages, imageId, imageMap, "entity", entity.id, entity.name);
    const ext = getImageExt(imageMap.get(imageId));
    lines.push(`![${entity.name} portrait](images/${imageId}${ext})`);
    lines.push("");
  }

  appendHistorianNotes(lines, entity.enrichment?.historianNotes);
  return lines;
}

export function formatEntityMarkdown(
  entity: PersistedEntity,
  referencedImages: Map<string, ExportImageEntry>,
  imageMap: Map<string, ImageMetadataRecord>
): string {
  const frontmatter = buildEntityFrontmatter(entity);
  const body = buildEntityBody(entity, referencedImages, imageMap);
  return [...frontmatter, ...body].join("\n");
}

// =============================================================================
// Chronicle Formatter
// =============================================================================

function buildChronicleFrontmatter(chronicle: ChronicleRecord): string[] {
  const content = chronicle.finalContent || chronicle.assembledContent || "";
  const sceneCount =
    chronicle.imageRefs?.refs?.filter((r) => r.type === "prompt_request" && r.status === "complete")
      .length || 0;
  const coverImageId = chronicle.coverImage?.generatedImageId;

  const lines: string[] = [];
  lines.push("---");
  lines.push(`title: ${yamlString(chronicle.title)}`);
  lines.push("type: chronicle");
  lines.push(`format: ${chronicle.format}`);
  if (chronicle.narrativeStyle?.name) {
    lines.push(`narrative_style: ${yamlString(chronicle.narrativeStyle.name)}`);
  }
  lines.push(`focus_type: ${chronicle.focusType}`);
  lines.push(`word_count: ${countWords(content)}`);
  lines.push(`has_cover_image: ${!!coverImageId}`);
  if (coverImageId) lines.push(`cover_image_id: ${coverImageId}`);
  lines.push(`scene_image_count: ${sceneCount}`);
  lines.push("---");
  lines.push("");
  return lines;
}

function buildChronicleCastTable(chronicle: ChronicleRecord): string[] {
  if (!chronicle.roleAssignments?.length) return [];
  const lines: string[] = [];
  lines.push("## Cast");
  lines.push("");
  lines.push("| Role | Character | Kind | Emphasis |");
  lines.push("|------|-----------|------|----------|");
  for (const ra of chronicle.roleAssignments) {
    lines.push(
      `| ${ra.role} | ${ra.entityName} | ${ra.entityKind} | ${ra.isPrimary ? "Primary" : "Supporting"} |`
    );
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  return lines;
}

function insertPromptImageMarkers(
  text: string,
  refs: ChrChronicleImageRef[],
  referencedImages: Map<string, ExportImageEntry>,
  imageMap: Map<string, ImageMetadataRecord>,
  chronicleId: string
): string {
  const promptRefs = refs.filter(
    (r): r is PromptRequestRef =>
      r.type === "prompt_request" && r.status === "complete" && !!r.generatedImageId
  );

  const insertions = promptRefs
    .map((ref) => ({
      ref,
      insertAt: resolveInsertPosition(text, ref.anchorText, ref.anchorIndex),
    }))
    .sort((a, b) => b.insertAt - a.insertAt);

  let result = text;
  for (const { ref, insertAt } of insertions) {
    const imgId = ref.generatedImageId;
    registerImage(referencedImages, imgId, imageMap, "chronicle", undefined, undefined, chronicleId);
    const ext = getImageExt(imageMap.get(imgId));
    const caption = ref.caption || "";
    const marker = `\n\n<!-- IMAGE: images/${imgId}${ext} | size: ${ref.size} | float: ${ref.justification || "none"} | caption: "${caption}" -->\n\n`;
    result = result.slice(0, insertAt) + marker + result.slice(insertAt);
  }
  return result;
}

function insertEntityRefMarkers(text: string, refs: ChrChronicleImageRef[]): string {
  const entityRefs = refs.filter(
    (r): r is EntityImageRef => r.type === "entity_ref"
  );

  const insertions = entityRefs
    .map((ref) => ({
      ref,
      insertAt: resolveInsertPosition(text, ref.anchorText, ref.anchorIndex),
    }))
    .sort((a, b) => b.insertAt - a.insertAt);

  let result = text;
  for (const { ref, insertAt } of insertions) {
    const caption = ref.caption || "";
    const marker = `\n\n<!-- IMAGE: entity-portrait-${ref.entityId} | size: ${ref.size} | float: ${ref.justification || "none"} | caption: "${caption}" -->\n\n`;
    result = result.slice(0, insertAt) + marker + result.slice(insertAt);
  }
  return result;
}

function buildChronicleContent(
  chronicle: ChronicleRecord,
  referencedImages: Map<string, ExportImageEntry>,
  imageMap: Map<string, ImageMetadataRecord>
): string[] {
  const lines: string[] = [];
  const coverImageId = chronicle.coverImage?.generatedImageId;
  const content = chronicle.finalContent || chronicle.assembledContent || "";

  // Title and summary
  lines.push(`# ${chronicle.title}`);
  lines.push("");
  if (chronicle.summary) {
    lines.push(`*${chronicle.summary}*`);
    lines.push("");
  }

  // Cover image
  if (coverImageId && chronicle.coverImage?.status === "complete") {
    registerImage(
      referencedImages, coverImageId, imageMap, "cover",
      undefined, undefined, chronicle.chronicleId
    );
    const ext = getImageExt(imageMap.get(coverImageId));
    lines.push(`![Cover](images/${coverImageId}${ext})`);
    lines.push("");
  }

  // Full narrative with inline image markers
  if (content) {
    let annotated = content;
    if (chronicle.imageRefs?.refs) {
      annotated = insertPromptImageMarkers(
        annotated, chronicle.imageRefs.refs, referencedImages, imageMap, chronicle.chronicleId
      );
      annotated = insertEntityRefMarkers(annotated, chronicle.imageRefs.refs);
    }
    lines.push(annotated);
    lines.push("");
  }

  appendHistorianNotes(lines, chronicle.historianNotes);
  return lines;
}

export function formatChronicleMarkdown(
  chronicle: ChronicleRecord,
  referencedImages: Map<string, ExportImageEntry>,
  imageMap: Map<string, ImageMetadataRecord>
): string {
  const frontmatter = buildChronicleFrontmatter(chronicle);
  const castTable = buildChronicleCastTable(chronicle);
  const body = buildChronicleContent(chronicle, referencedImages, imageMap);
  return [...frontmatter, ...castTable, ...body].join("\n");
}

// =============================================================================
// Static Page Formatter
// =============================================================================

export function formatStaticPageMarkdown(page: StaticPage, entities: PersistedEntity[]): string {
  const lines: string[] = [];

  lines.push("---");
  lines.push(`title: ${yamlString(page.title)}`);
  lines.push("type: static_page");
  lines.push(`word_count: ${page.wordCount}`);

  if (page.linkedEntityIds?.length) {
    const entityMap = new Map(entities.map((e) => [e.id, e]));
    lines.push("linked_entities:");
    for (const id of page.linkedEntityIds) {
      const name = entityMap.get(id)?.name || id;
      lines.push(`  - ${yamlString(name)}`);
    }
  }
  lines.push("---");
  lines.push("");

  lines.push(page.content || "");
  lines.push("");

  return lines.join("\n");
}

// =============================================================================
// Era Narrative Formatter
// =============================================================================

function buildEraNarrativeFrontmatter(
  narrative: EraNarrativeRecord,
  content: string | undefined
): string[] {
  const coverImageId = narrative.coverImage?.generatedImageId;
  const lines: string[] = [];

  lines.push("---");
  lines.push(`title: ${yamlString(narrative.eraName)}`);
  lines.push("type: era_narrative");
  lines.push(`era_id: ${narrative.eraId}`);
  lines.push(`tone: ${narrative.tone}`);
  lines.push(`status: ${narrative.status}`);
  lines.push(`word_count: ${countWords(content || "")}`);
  lines.push(`has_cover_image: ${!!coverImageId && narrative.coverImage?.status === "complete"}`);
  if (coverImageId) lines.push(`cover_image_id: ${coverImageId}`);

  if (narrative.threadSynthesis?.thesis) {
    lines.push(`thesis: ${yamlString(narrative.threadSynthesis.thesis)}`);
  }

  if (narrative.threadSynthesis?.threads?.length) {
    lines.push("threads:");
    for (const t of narrative.threadSynthesis.threads) {
      lines.push(`  - ${yamlString(t.name)}`);
    }
  }
  lines.push("---");
  lines.push("");
  return lines;
}

function insertNarrativeImageMarkers(
  text: string,
  narrative: EraNarrativeRecord,
  referencedImages: Map<string, ExportImageEntry>,
  imageMap: Map<string, ImageMetadataRecord>
): string {
  if (!narrative.imageRefs?.refs) return text;

  const insertableRefs = narrative.imageRefs.refs.filter((r) => {
    if (r.type === "chronicle_ref") return true;
    if (r.type === "prompt_request" && r.status === "complete" && r.generatedImageId) return true;
    return false;
  });

  const insertions = insertableRefs
    .map((ref) => ({
      ref,
      insertAt: resolveInsertPosition(text, ref.anchorText, ref.anchorIndex),
    }))
    .sort((a, b) => b.insertAt - a.insertAt);

  let result = text;
  for (const { ref, insertAt } of insertions) {
    const imgId = resolveNarrativeImageId(ref);
    registerImage(referencedImages, imgId, imageMap, "chronicle");
    const ext = getImageExt(imageMap.get(imgId));
    const caption = ref.caption || "";
    const marker = `\n\n<!-- IMAGE: images/${imgId}${ext} | size: ${ref.size} | float: ${ref.justification || "none"} | caption: "${caption}" -->\n\n`;
    result = result.slice(0, insertAt) + marker + result.slice(insertAt);
  }
  return result;
}

/**
 * Extract the image ID from a narrative image ref, properly narrowing the union type.
 */
function resolveNarrativeImageId(
  ref: import("../eraNarrativeTypes").EraNarrativeImageRef
): string {
  if (ref.type === "chronicle_ref") return ref.imageId;
  // At this point TypeScript knows ref is EraNarrativePromptRequestRef
  const promptRef: EraNarrativePromptRequestRef = ref;
  return promptRef.generatedImageId || "";
}

function buildEraNarrativeBody(
  narrative: EraNarrativeRecord,
  content: string | undefined,
  referencedImages: Map<string, ExportImageEntry>,
  imageMap: Map<string, ImageMetadataRecord>
): string[] {
  const lines: string[] = [];
  const coverImageId = narrative.coverImage?.generatedImageId;

  lines.push(`# ${narrative.eraName}`);
  lines.push("");

  if (narrative.threadSynthesis?.thesis) {
    lines.push(`*${narrative.threadSynthesis.thesis}*`);
    lines.push("");
  }

  if (coverImageId && narrative.coverImage?.status === "complete") {
    registerImage(referencedImages, coverImageId, imageMap, "cover");
    const ext = getImageExt(imageMap.get(coverImageId));
    lines.push(`![Cover](images/${coverImageId}${ext})`);
    lines.push("");
  }

  if (content) {
    const annotated = insertNarrativeImageMarkers(content, narrative, referencedImages, imageMap);
    lines.push(annotated);
    lines.push("");
  }

  return lines;
}

export function formatEraNarrativeMarkdown(
  narrative: EraNarrativeRecord,
  referencedImages: Map<string, ExportImageEntry>,
  imageMap: Map<string, ImageMetadataRecord>
): string {
  const { content } = resolveActiveContent(narrative);
  const frontmatter = buildEraNarrativeFrontmatter(narrative, content);
  const body = buildEraNarrativeBody(narrative, content, referencedImages, imageMap);
  return [...frontmatter, ...body].join("\n");
}
