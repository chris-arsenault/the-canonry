/**
 * renderToHtml — Serializes a ChronicleRenderOutput to HTML for the TipTap editor.
 *
 * Uses the shared chronicle-renderer pipeline to build sections, then
 * serializes them to HTML. Images are referenced by data-image-id and
 * resolved to object URLs by the caller.
 */

import type {
  ChronicleRenderOutput,
  WikiSection,
  WikiSectionImage,
  HistorianNoteResolved,
} from "@the-canonry/chronicle-renderer";
import { resolveAnchorPhrase } from "@the-canonry/chronicle-renderer";
import { loadImage } from "../db/imageRepository";

// ── HTML helpers ─────────────────────────────────────────────────────────────

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMarkdown(text: string): string {
  let result = esc(text);
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/__(.+?)__/g, "<strong>$1</strong>");
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
  result = result.replace(/_(.+?)_/g, "<em>$1</em>");
  return result;
}

const NOTE_COLORS: Record<string, string> = {
  commentary: "#c49a5c",
  correction: "#c0392b",
  tangent: "#8b7355",
  skepticism: "#d4a017",
  pedantic: "#5b7a5e",
};

const NOTE_ICONS: Record<string, string> = {
  commentary: "\u2726",
  correction: "!",
  tangent: "~",
  skepticism: "?",
  pedantic: "#",
};

// ── Image URL resolution ─────────────────────────────────────────────────────

async function resolveImageUrls(
  render: ChronicleRenderOutput
): Promise<Map<string, string>> {
  const imageIds = new Set<string>();
  if (render.coverImageId) imageIds.add(render.coverImageId);
  for (const section of render.sections) {
    for (const img of section.images || []) {
      imageIds.add(img.imageId);
    }
  }

  const urlMap = new Map<string, string>();
  const results = await Promise.all(
    Array.from(imageIds).map((id) => loadImage(id).catch(() => null))
  );
  const ids = Array.from(imageIds);
  for (let i = 0; i < ids.length; i++) {
    if (results[i]) urlMap.set(ids[i], results[i]!.url);
  }
  return urlMap;
}

// ── Section to HTML ──────────────────────────────────────────────────────────

interface Insertion {
  position: number;
  html: string;
}

function buildImageHtml(img: WikiSectionImage, url: string): string {
  const sizeClass = `image-${img.size || "medium"}`;
  const justifyClass = img.justification ? `image-${img.justification}` : "";
  const caption = img.caption
    ? `<figcaption>${inlineMarkdown(img.caption)}</figcaption>`
    : "";
  return `<figure class="chronicle-figure ${sizeClass} ${justifyClass}" data-image-id="${esc(img.imageId)}"><img src="${esc(url)}" alt="${esc(img.caption || "")}" />${caption}</figure>`;
}

function buildNoteHtml(note: HistorianNoteResolved, index: number): string {
  const color = NOTE_COLORS[note.type] || NOTE_COLORS.commentary;
  const icon = NOTE_ICONS[note.type] || "\u2726";
  return `<aside class="historian-note" data-note-id="${esc(note.noteId)}" data-note-type="${esc(note.type)}" style="border-left-color:${color}"><span class="note-label" style="color:${color}">${icon} ${esc(note.type)} <sup>${index + 1}</sup></span>${esc(note.text)}</aside>`;
}

function sectionToHtml(
  section: WikiSection,
  imageUrls: Map<string, string>,
  allNotes: HistorianNoteResolved[],
  noteOffset: number,
): { html: string; noteCount: number } {
  const content = section.content;
  const insertions: Insertion[] = [];

  // Image insertions
  for (const img of section.images || []) {
    const url = imageUrls.get(img.imageId);
    if (!url) continue;
    const match = resolveAnchorPhrase(img.anchorText, content);
    const position = match ? match.index + match.phrase.length : content.length;
    insertions.push({ position, html: buildImageHtml(img, url) });
  }

  // Note insertions — only notes whose anchor resolves in this section
  let noteCount = 0;
  for (const note of allNotes) {
    const match = resolveAnchorPhrase(note.anchorPhrase, content);
    if (match) {
      insertions.push({
        position: match.index + match.phrase.length,
        html: buildNoteHtml(note, noteOffset + noteCount),
      });
      noteCount++;
    }
  }

  insertions.sort((a, b) => a.position - b.position);

  // Convert content to HTML with insertions
  const lines = content.split("\n");
  const parts: string[] = [];
  let charOffset = 0;
  let insertIdx = 0;

  for (const line of lines) {
    const lineEnd = charOffset + line.length;
    const trimmed = line.trim();

    if (trimmed === "") { /* skip */ }
    else if (trimmed === "---" || trimmed === "***" || trimmed === "___") parts.push("<hr />");
    else if (trimmed.startsWith("### ")) parts.push(`<h3>${inlineMarkdown(trimmed.slice(4))}</h3>`);
    else if (trimmed.startsWith("## ")) parts.push(`<h2>${inlineMarkdown(trimmed.slice(3))}</h2>`);
    else if (trimmed.startsWith("> ")) parts.push(`<blockquote><p>${inlineMarkdown(trimmed.slice(2))}</p></blockquote>`);
    else parts.push(`<p>${inlineMarkdown(trimmed)}</p>`);

    while (insertIdx < insertions.length && insertions[insertIdx].position <= lineEnd) {
      parts.push(insertions[insertIdx].html);
      insertIdx++;
    }

    charOffset = lineEnd + 1;
  }

  while (insertIdx < insertions.length) {
    parts.push(insertions[insertIdx].html);
    insertIdx++;
  }

  return { html: parts.join("\n"), noteCount };
}

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * Serialize a ChronicleRenderOutput to HTML with resolved image URLs.
 * Async because it loads image blobs from IndexedDB.
 */
export async function renderToHtml(render: ChronicleRenderOutput): Promise<string> {
  const imageUrls = await resolveImageUrls(render);
  const htmlParts: string[] = [];

  // Cover image
  if (render.coverImageId) {
    const coverUrl = imageUrls.get(render.coverImageId);
    if (coverUrl) {
      htmlParts.push(`<figure class="cover-image" data-image-id="${esc(render.coverImageId)}"><img src="${esc(coverUrl)}" alt="Cover" /></figure>`);
    }
  }

  // Sections with heading separators
  let noteOffset = 0;
  for (const section of render.sections) {
    if (section.heading !== "Chronicle" && section.heading !== "Narrative") {
      htmlParts.push(`<h2>${esc(section.heading)}</h2>`);
    }
    const { html, noteCount } = sectionToHtml(section, imageUrls, render.historianNotes, noteOffset);
    htmlParts.push(html);
    noteOffset += noteCount;
  }

  return htmlParts.join("\n") || "<p></p>";
}
