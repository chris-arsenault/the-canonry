/**
 * chronicleToHtml — Renders a chronicle record to clean semantic HTML
 * suitable for loading into the TipTap WYSIWYG editor.
 *
 * Produces:
 * - Headings from markdown ## markers
 * - Paragraphs from text blocks
 * - Horizontal rules from ---
 * - Inline formatting (bold, italic) from markdown
 * - Images as <figure> with data-image-id for image-store resolution
 * - Historian annotations as <aside> blocks
 * - Cover image as a leading <figure>
 *
 * Does NOT produce wiki-links or entity cross-references (those are
 * chronicler-specific rendering concerns, not content).
 */

import type { ChronicleRecord } from "../chronicleTypes";
import { resolveAnchorPhrase } from "../fuzzyAnchor";

interface ImageRef {
  refId: string;
  imageId: string;
  anchorText: string;
  size: string;
  justification?: string | null;
  caption?: string | null;
}

interface HistorianNote {
  noteId: string;
  anchorPhrase: string;
  text: string;
  type: string;
  display?: string | null;
}

/**
 * Resolve image refs to their imageIds.
 * Entity refs need the entity's image ID from enrichment — passed in as a map.
 */
function resolveImageRefs(
  chronicle: ChronicleRecord,
  entityImageMap: Map<string, string>
): ImageRef[] {
  if (!chronicle.imageRefs?.refs) return [];
  const resolved: ImageRef[] = [];
  for (const ref of chronicle.imageRefs.refs) {
    if (ref.type === "prompt_request" && ref.status !== "complete") continue;
    let imageId: string | undefined;
    if (ref.type === "entity_ref" && ref.entityId) {
      imageId = entityImageMap.get(ref.entityId);
    } else if (ref.type === "prompt_request" && ref.generatedImageId) {
      imageId = ref.generatedImageId;
    }
    if (!imageId) continue;
    resolved.push({
      refId: ref.refId,
      imageId,
      anchorText: ref.anchorText,
      size: ref.size,
      justification: ref.justification,
      caption: ref.caption,
    });
  }
  return resolved;
}

/** Escape HTML entities */
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Convert basic markdown inline formatting to HTML */
function inlineMarkdown(text: string): string {
  let result = esc(text);
  // Bold: **text** or __text__
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/__(.+?)__/g, "<strong>$1</strong>");
  // Italic: *text* or _text_
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
  result = result.replace(/_(.+?)_/g, "<em>$1</em>");
  return result;
}

/** Build a <figure> element for an image ref */
function buildImageHtml(ref: ImageRef): string {
  const attrs = [
    `data-image-id="${esc(ref.imageId)}"`,
    `data-ref-id="${esc(ref.refId)}"`,
    `data-size="${esc(ref.size)}"`,
  ];
  if (ref.justification) attrs.push(`data-justify="${esc(ref.justification)}"`);
  const captionHtml = ref.caption
    ? `<figcaption>${inlineMarkdown(ref.caption)}</figcaption>`
    : "";
  return `<figure class="chronicle-image" ${attrs.join(" ")}><img src="" alt="${esc(ref.caption || "")}" />${captionHtml}</figure>`;
}

/** Build an <aside> element for a historian annotation */
function buildAnnotationHtml(note: HistorianNote): string {
  const display = note.display || "full";
  if (display === "disabled") return "";
  return `<aside class="historian-note" data-note-id="${esc(note.noteId)}" data-note-type="${esc(note.type)}" data-display="${esc(display)}"><span class="note-label">${esc(note.type)}</span> ${esc(note.text)}</aside>`;
}

/**
 * Render a chronicle record to semantic HTML for the WYSIWYG editor.
 *
 * @param chronicle - The source chronicle record
 * @param entityImageMap - Map of entityId → imageId for entity_ref resolution
 * @returns HTML string
 */
export function renderChronicleToHtml(
  chronicle: ChronicleRecord,
  entityImageMap: Map<string, string>
): string {
  const content = chronicle.finalContent || chronicle.assembledContent || "";
  if (!content.trim()) return "<p></p>";

  const imageRefs = resolveImageRefs(chronicle, entityImageMap);
  const historianNotes: HistorianNote[] = (chronicle.historianNotes || [])
    .filter((n) => (n.display || "full") !== "disabled")
    .map((n) => ({
      noteId: n.noteId,
      anchorPhrase: n.anchorPhrase,
      text: n.text,
      type: n.type,
      display: n.display,
    }));

  // Resolve anchor positions for images and notes
  interface Insertion {
    kind: "image" | "note";
    position: number;
    html: string;
  }

  const insertions: Insertion[] = [];

  for (const ref of imageRefs) {
    const match = resolveAnchorPhrase(ref.anchorText, content);
    const position = match ? match.index + match.phrase.length : content.length;
    insertions.push({ kind: "image", position, html: buildImageHtml(ref) });
  }

  for (const note of historianNotes) {
    const match = resolveAnchorPhrase(note.anchorPhrase, content);
    const position = match ? match.index + match.phrase.length : content.length;
    insertions.push({ kind: "note", position, html: buildAnnotationHtml(note) });
  }

  insertions.sort((a, b) => a.position - b.position);

  // Build HTML by processing content line by line, inserting images/notes at paragraph boundaries
  const lines = content.split("\n");
  const htmlParts: string[] = [];

  // Cover image
  if (chronicle.coverImage?.status === "complete" && chronicle.coverImage.generatedImageId) {
    htmlParts.push(`<figure class="cover-image" data-image-id="${esc(chronicle.coverImage.generatedImageId)}"><img src="" alt="Cover" /></figure>`);
  }

  let charOffset = 0;
  let pendingInsertions = [...insertions];

  for (const line of lines) {
    const trimmed = line.trim();
    const lineEnd = charOffset + line.length;

    // Flush any insertions that fall before or within this line
    const flushBefore: string[] = [];
    while (pendingInsertions.length > 0 && pendingInsertions[0].position <= lineEnd) {
      flushBefore.push(pendingInsertions.shift()!.html);
    }

    if (trimmed === "" || trimmed === "\n") {
      // Empty line — skip (paragraph break handled by surrounding <p> tags)
    } else if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      htmlParts.push("<hr />");
    } else if (trimmed.startsWith("## ")) {
      htmlParts.push(`<h2>${inlineMarkdown(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith("### ")) {
      htmlParts.push(`<h3>${inlineMarkdown(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith("> ")) {
      htmlParts.push(`<blockquote><p>${inlineMarkdown(trimmed.slice(2))}</p></blockquote>`);
    } else {
      htmlParts.push(`<p>${inlineMarkdown(trimmed)}</p>`);
    }

    // Insert images/notes after this line
    for (const html of flushBefore) {
      htmlParts.push(html);
    }

    charOffset = lineEnd + 1; // +1 for the \n
  }

  // Flush any remaining insertions
  for (const ins of pendingInsertions) {
    htmlParts.push(ins.html);
  }

  return htmlParts.join("\n");
}
