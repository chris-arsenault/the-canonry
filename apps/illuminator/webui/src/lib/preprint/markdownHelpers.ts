/**
 * Markdown Export — shared helper utilities.
 *
 * Pure functions used by formatters, manifest builder, and script generators.
 */

import type { HistorianNote } from "../historianTypes";
import { isNoteActive, noteDisplay } from "../historianTypes";
import { resolveAnchorPhrase } from "../fuzzyAnchor";
import type { ImageMetadataRecord } from "./prePrintStats";
import type { ExportImageEntry } from "./prePrintTypes";

// =============================================================================
// Text Helpers
// =============================================================================

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "untitled"
  );
}

export function yamlString(value: string): string {
  if (/[:#\[\]{}&*!|>'"%@`]/.test(value) || value.includes("\n")) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}

// =============================================================================
// Image Helpers
// =============================================================================

export function getImageExt(image?: ImageMetadataRecord): string {
  if (!image?.mimeType) return "";
  if (image.mimeType.includes("png")) return ".png";
  if (image.mimeType.includes("jpeg") || image.mimeType.includes("jpg")) return ".jpg";
  if (image.mimeType.includes("webp")) return ".webp";
  return "";
}

export function registerImage(
  map: Map<string, ExportImageEntry>,
  imageId: string,
  imageMap: Map<string, ImageMetadataRecord>,
  type: "entity" | "chronicle" | "cover",
  entityId?: string,
  entityName?: string,
  chronicleId?: string
): void {
  if (map.has(imageId)) return;
  const img = imageMap.get(imageId);
  // Skip image IDs not present in metadata — malformed composite keys won't exist in S3
  if (!img) return;
  const ext = getImageExt(img);
  map.set(imageId, {
    imageId,
    filename: `${imageId}${ext}`,
    width: img.width,
    height: img.height,
    aspect: img.aspect,
    imageType: type,
    entityId: entityId || img.entityId,
    entityName: entityName || img.entityName,
    chronicleId: chronicleId || img.chronicleId,
    mimeType: img.mimeType,
  });
}

// =============================================================================
// Anchor Position Resolution
// =============================================================================

export function resolveInsertPosition(
  text: string,
  anchorText: string,
  anchorIndex?: number
): number {
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
// Historian Note Formatting
// =============================================================================

export function formatHistorianNote(note: HistorianNote): string {
  const typeLabel = note.type.charAt(0).toUpperCase() + note.type.slice(1);
  return `> **[${typeLabel}]** ${note.text} *(anchored to: "${note.anchorPhrase}")*\n`;
}

export function formatHistorianFootnote(note: HistorianNote): string {
  const typeLabel = note.type.charAt(0).toUpperCase() + note.type.slice(1);
  return `- *[${typeLabel}]* ${note.text} — "${note.anchorPhrase}"\n`;
}

/**
 * Append historian notes (full and popout) to the output lines array.
 */
export function appendHistorianNotes(
  lines: string[],
  notes: HistorianNote[] | undefined
): void {
  const activeNotes = notes?.filter((n) => isNoteActive(n));
  if (!activeNotes?.length) return;

  const fullNotes = activeNotes.filter((n) => noteDisplay(n) === "full");
  const popoutNotes = activeNotes.filter((n) => noteDisplay(n) === "popout");

  if (fullNotes.length > 0) {
    lines.push("## Historian's Notes");
    lines.push("");
    for (const note of fullNotes) {
      lines.push(formatHistorianNote(note));
    }
    lines.push("");
  }

  if (popoutNotes.length > 0) {
    if (fullNotes.length === 0) {
      lines.push("## Historian's Notes");
      lines.push("");
    }
    for (const note of popoutNotes) {
      lines.push(formatHistorianFootnote(note));
    }
    lines.push("");
  }
}
