/**
 * Chronicle section builder — parses markdown content into sections,
 * attaches images at anchor positions, resolves historian notes.
 *
 * Pure data transformation, no React dependency.
 * Used by both chronicler (live rendering) and illuminator (finalize editor).
 */

import type {
  WikiSection,
  WikiSectionImage,
  ChronicleImageRef,
  EntityImageSource,
  HistorianNoteInput,
  HistorianNoteResolved,
} from "./types";
import { resolveAnchorPhrase } from "./fuzzyAnchor";

// ── Image attachment ─────────────────────────────────────────────────────────

function findSectionForAnchor(sections: WikiSection[], anchorText: string): WikiSection | null {
  if (!anchorText || sections.length === 0) return sections[0] ?? null;
  for (const section of sections) {
    if (resolveAnchorPhrase(anchorText, section.content)) return section;
  }
  return sections[0];
}

function resolveImageRefId(
  ref: ChronicleImageRef,
  entities: EntityImageSource[]
): string | undefined {
  if (ref.type === "entity_ref" && ref.entityId) {
    const entity = entities.find((e) => e.id === ref.entityId);
    return entity?.enrichment?.image?.imageId;
  }
  if (ref.type === "prompt_request" && ref.generatedImageId) return ref.generatedImageId;
  return undefined;
}

function buildSectionImage(ref: ChronicleImageRef, imageId: string): WikiSectionImage {
  return {
    refId: ref.refId,
    type: ref.type === "entity_ref" ? "entity_ref" : "chronicle_image",
    entityId: ref.type === "entity_ref" ? ref.entityId : undefined,
    imageId,
    anchorText: ref.anchorText,
    anchorIndex: ref.anchorIndex,
    size: ref.size,
    justification: ref.justification,
    caption: ref.caption,
  };
}

export function attachImagesToSections(
  sections: WikiSection[],
  refs: ChronicleImageRef[],
  entities: EntityImageSource[]
): void {
  for (const ref of refs) {
    if (ref.type === "prompt_request" && ref.status !== "complete") continue;
    const section = findSectionForAnchor(sections, ref.anchorText);
    if (!section) continue;
    const imageId = resolveImageRefId(ref, entities);
    if (!imageId) continue;
    if (!section.images) section.images = [];
    section.images.push(buildSectionImage(ref, imageId));
  }
}

// ── Section parsing ──────────────────────────────────────────────────────────

function parseMarkdownSections(
  content: string,
  prefix: string,
  defaultHeading: string
): WikiSection[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  let body = trimmed;
  if (body.startsWith("# ")) {
    const lines = body.split("\n");
    body = lines.slice(1).join("\n").trim();
  }

  const sections: WikiSection[] = [];
  let currentHeading = defaultHeading;
  let buffer: string[] = [];
  let sectionIndex = 0;

  const flush = () => {
    const sectionBody = buffer.join("\n").trim();
    if (!sectionBody) return;
    sections.push({
      id: `${prefix}-section-${sectionIndex}`,
      heading: currentHeading,
      level: 2,
      content: sectionBody,
    });
    sectionIndex++;
  };

  for (const line of body.split("\n")) {
    if (line.startsWith("## ")) {
      flush();
      currentHeading = line.replace(/^##\s+/, "").trim() || defaultHeading;
      buffer = [];
      continue;
    }
    buffer.push(line);
  }
  flush();

  if (sections.length === 0 && body) {
    sections.push({
      id: `${prefix}-section-0`,
      heading: defaultHeading,
      level: 2,
      content: body,
    });
  }
  return sections;
}

// ── Historian notes ──────────────────────────────────────────────────────────

export function resolveHistorianNotes(
  notes: HistorianNoteInput[] | null | undefined
): HistorianNoteResolved[] {
  if (!notes) return [];
  return notes
    .filter((n) => {
      const display = n.display || (n.enabled === false ? "disabled" : "full");
      return display !== "disabled";
    })
    .map((n) => ({
      noteId: n.noteId,
      anchorPhrase: n.anchorPhrase,
      text: n.text,
      type: n.type,
      display: (n.display || (n.enabled === false ? "disabled" : "full")) as "popout" | "full",
    }));
}

// ── Main entry point ─────────────────────────────────────────────────────────

export interface ChronicleRenderInput {
  /** The chronicle text content (finalContent or assembledContent) */
  content: string;
  /** Image refs from the chronicle record */
  imageRefs?: { refs: ChronicleImageRef[] } | null;
  /** Entities for resolving entity_ref image IDs */
  entities: EntityImageSource[];
  /** Historian notes from the chronicle record */
  historianNotes?: HistorianNoteInput[] | null;
  /** Cover image ID (already resolved) */
  coverImageId?: string | null;
}

export interface ChronicleRenderOutput {
  sections: WikiSection[];
  historianNotes: HistorianNoteResolved[];
  coverImageId?: string;
}

/**
 * Build the section structure for a chronicle — the shared rendering
 * pipeline used by both the chronicler and the finalize editor.
 */
export function buildChronicleRender(input: ChronicleRenderInput): ChronicleRenderOutput {
  const sections = parseMarkdownSections(input.content, "chronicle", "Chronicle");

  if (input.imageRefs?.refs && input.entities.length > 0) {
    attachImagesToSections(sections, input.imageRefs.refs, input.entities);
  }

  const historianNotes = resolveHistorianNotes(input.historianNotes);

  const coverImageId =
    input.coverImageId || undefined;

  return { sections, historianNotes, coverImageId };
}
