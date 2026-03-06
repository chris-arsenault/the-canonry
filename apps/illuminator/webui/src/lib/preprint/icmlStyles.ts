/* eslint-disable max-lines -- data-heavy module: 60% is InDesign style definition arrays */
/**
 * ICML Core Types, Style Definitions, and Paragraph Utilities
 *
 * Shared between ICML and IDML generators. Contains:
 * - IcmlParagraph / IcmlRun types
 * - Character and paragraph style constants
 * - Style definition arrays for InDesign
 * - Paragraph construction helpers (plainPara, styledPara)
 * - Inline markdown parsing
 * - Block markdown-to-paragraph conversion
 * - Image extension helper
 */

import type { ImageMetadataRecord } from "./prePrintStats";

// =============================================================================
// Types
// =============================================================================

export interface IcmlRun {
  charStyle: string; // character style name, or '' for default
  text: string;
}

export interface IcmlParagraph {
  paraStyle: string;
  runs: IcmlRun[];
}

// =============================================================================
// Character Style Names
// =============================================================================

export const CS_NONE = "$ID/[No character style]";
export const CS_BOLD = "Bold";
export const CS_ITALIC = "Italic";
export const CS_BOLD_ITALIC = "BoldItalic";
export const CS_CODE = "Code";
export const CS_SYMBOL = "Symbol";
export const CS_FOOTNOTE_REF = "FootnoteRef";

// =============================================================================
// Paragraph Style Names
// =============================================================================

export const PS_SECTION_HEADING = "SectionHeading";
export const PS_ERA_HEADING = "EraHeading";
export const PS_ITEM_TITLE = "ItemTitle";
export const PS_ITEM_SUBTITLE = "ItemSubtitle";
export const PS_BODY = "Body";
export const PS_BODY_FIRST = "BodyFirst";
export const PS_HEADING1 = "Heading1";
export const PS_HEADING2 = "Heading2";
export const PS_HEADING3 = "Heading3";
export const PS_BLOCKQUOTE = "Blockquote";
export const PS_HISTORIAN_NOTE = "HistorianNote";
export const PS_CAPTION = "Caption";
export const PS_IMAGE_PLACEHOLDER = "ImagePlaceholder";
export const PS_METADATA = "Metadata";
export const PS_CAST_ENTRY = "CastEntry";
export const PS_SEPARATOR = "ItemSeparator";
export const PS_FOOTNOTE_TEXT = "FootnoteText";
export const PS_CALLOUT_BODY = "CalloutBody";

// =============================================================================
// Style Definition Interfaces
// =============================================================================

export interface ParagraphStyleDef {
  name: string;
  pointSize: number;
  leading: number;
  fontStyle: string;
  justification: string;
  firstLineIndent: number;
  leftIndent: number;
  rightIndent: number;
  spaceBefore: number;
  spaceAfter: number;
  appliedFont: string;
}

export interface CharacterStyleDef {
  name: string;
  fontStyle: string;
  appliedFont?: string;
  position?: string;
}

// =============================================================================
// Style Definition Arrays
// =============================================================================

export const CHARACTER_STYLE_DEFS: CharacterStyleDef[] = [
  { name: CS_BOLD, fontStyle: "Bold" },
  { name: CS_ITALIC, fontStyle: "Italic" },
  { name: CS_BOLD_ITALIC, fontStyle: "Bold Italic" },
  { name: CS_CODE, fontStyle: "Regular", appliedFont: "Courier New" },
  { name: CS_SYMBOL, fontStyle: "Regular", appliedFont: "Segoe UI Symbol" },
  { name: CS_FOOTNOTE_REF, fontStyle: "Regular", position: "Superscript" },
];

export const PARAGRAPH_STYLE_DEFS: ParagraphStyleDef[] = [
  {
    name: PS_SECTION_HEADING,
    pointSize: 28,
    leading: 34,
    fontStyle: "Regular",
    justification: "CenterAlign",
    firstLineIndent: 0,
    leftIndent: 0,
    rightIndent: 0,
    spaceBefore: 36,
    spaceAfter: 18,
    appliedFont: "Junicode",
  },
  {
    name: PS_ERA_HEADING,
    pointSize: 20,
    leading: 26,
    fontStyle: "Regular",
    justification: "LeftAlign",
    firstLineIndent: 0,
    leftIndent: 0,
    rightIndent: 0,
    spaceBefore: 24,
    spaceAfter: 12,
    appliedFont: "Junicode",
  },
  {
    name: PS_ITEM_TITLE,
    pointSize: 16,
    leading: 20,
    fontStyle: "Bold",
    justification: "LeftAlign",
    firstLineIndent: 0,
    leftIndent: 0,
    rightIndent: 0,
    spaceBefore: 18,
    spaceAfter: 4,
    appliedFont: "Junicode",
  },
  {
    name: PS_ITEM_SUBTITLE,
    pointSize: 10,
    leading: 14,
    fontStyle: "Italic",
    justification: "LeftAlign",
    firstLineIndent: 0,
    leftIndent: 0,
    rightIndent: 0,
    spaceBefore: 0,
    spaceAfter: 8,
    appliedFont: "Junicode",
  },
  {
    name: PS_BODY,
    pointSize: 11,
    leading: 14,
    fontStyle: "Regular",
    justification: "LeftJustified",
    firstLineIndent: 18,
    leftIndent: 0,
    rightIndent: 0,
    spaceBefore: 0,
    spaceAfter: 4,
    appliedFont: "Junicode",
  },
  {
    name: PS_BODY_FIRST,
    pointSize: 11,
    leading: 14,
    fontStyle: "Regular",
    justification: "LeftJustified",
    firstLineIndent: 0,
    leftIndent: 0,
    rightIndent: 0,
    spaceBefore: 0,
    spaceAfter: 4,
    appliedFont: "Junicode",
  },
  {
    name: PS_HEADING1,
    pointSize: 14,
    leading: 18,
    fontStyle: "Bold",
    justification: "LeftAlign",
    firstLineIndent: 0,
    leftIndent: 0,
    rightIndent: 0,
    spaceBefore: 14,
    spaceAfter: 6,
    appliedFont: "Junicode",
  },
  {
    name: PS_HEADING2,
    pointSize: 12,
    leading: 16,
    fontStyle: "Bold",
    justification: "LeftAlign",
    firstLineIndent: 0,
    leftIndent: 0,
    rightIndent: 0,
    spaceBefore: 10,
    spaceAfter: 4,
    appliedFont: "Junicode",
  },
  {
    name: PS_HEADING3,
    pointSize: 11,
    leading: 14,
    fontStyle: "Bold Italic",
    justification: "LeftAlign",
    firstLineIndent: 0,
    leftIndent: 0,
    rightIndent: 0,
    spaceBefore: 8,
    spaceAfter: 4,
    appliedFont: "Junicode",
  },
  {
    name: PS_BLOCKQUOTE,
    pointSize: 10,
    leading: 13,
    fontStyle: "Italic",
    justification: "LeftJustified",
    firstLineIndent: 0,
    leftIndent: 24,
    rightIndent: 24,
    spaceBefore: 6,
    spaceAfter: 6,
    appliedFont: "Junicode",
  },
  {
    name: PS_HISTORIAN_NOTE,
    pointSize: 9,
    leading: 12,
    fontStyle: "Regular",
    justification: "LeftAlign",
    firstLineIndent: 0,
    leftIndent: 18,
    rightIndent: 0,
    spaceBefore: 4,
    spaceAfter: 4,
    appliedFont: "Junicode",
  },
  {
    name: PS_CAPTION,
    pointSize: 9,
    leading: 12,
    fontStyle: "Italic",
    justification: "CenterAlign",
    firstLineIndent: 0,
    leftIndent: 0,
    rightIndent: 0,
    spaceBefore: 4,
    spaceAfter: 8,
    appliedFont: "Junicode",
  },
  {
    name: PS_IMAGE_PLACEHOLDER,
    pointSize: 9,
    leading: 12,
    fontStyle: "Regular",
    justification: "LeftAlign",
    firstLineIndent: 0,
    leftIndent: 0,
    rightIndent: 0,
    spaceBefore: 8,
    spaceAfter: 8,
    appliedFont: "Courier New",
  },
  {
    name: PS_METADATA,
    pointSize: 9,
    leading: 12,
    fontStyle: "Regular",
    justification: "LeftAlign",
    firstLineIndent: 0,
    leftIndent: 0,
    rightIndent: 0,
    spaceBefore: 2,
    spaceAfter: 2,
    appliedFont: "Junicode",
  },
  {
    name: PS_CAST_ENTRY,
    pointSize: 10,
    leading: 13,
    fontStyle: "Regular",
    justification: "LeftAlign",
    firstLineIndent: 0,
    leftIndent: 18,
    rightIndent: 0,
    spaceBefore: 2,
    spaceAfter: 2,
    appliedFont: "Junicode",
  },
  {
    name: PS_SEPARATOR,
    pointSize: 11,
    leading: 20,
    fontStyle: "Regular",
    justification: "CenterAlign",
    firstLineIndent: 0,
    leftIndent: 0,
    rightIndent: 0,
    spaceBefore: 12,
    spaceAfter: 12,
    appliedFont: "Junicode",
  },
  {
    name: PS_FOOTNOTE_TEXT,
    pointSize: 8,
    leading: 10,
    fontStyle: "Regular",
    justification: "LeftAlign",
    firstLineIndent: 0,
    leftIndent: 0,
    rightIndent: 0,
    spaceBefore: 0,
    spaceAfter: 2,
    appliedFont: "Junicode",
  },
  {
    name: PS_CALLOUT_BODY,
    pointSize: 10,
    leading: 13,
    fontStyle: "Italic",
    justification: "LeftAlign",
    firstLineIndent: 0,
    leftIndent: 12,
    rightIndent: 0,
    spaceBefore: 4,
    spaceAfter: 4,
    appliedFont: "Junicode",
  },
];

// =============================================================================
// Paragraph Construction
// =============================================================================

/** Create a simple paragraph with a single default-style run */
export function plainPara(style: string, text: string): IcmlParagraph {
  return { paraStyle: style, runs: [{ charStyle: "", text }] };
}

/** Create a paragraph with inline markdown parsed into runs */
export function styledPara(style: string, text: string): IcmlParagraph {
  return { paraStyle: style, runs: parseInlineRuns(text) };
}

// =============================================================================
// Inline Markdown Parsing -> IcmlRun[]
// =============================================================================

/**
 * Parse inline markdown formatting into character style runs.
 * Handles: ***bold italic***, **bold**, *italic*, `code`
 */
export function parseInlineRuns(text: string): IcmlRun[] {
  const runs: IcmlRun[] = [];
  const pattern = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push({ charStyle: "", text: text.slice(lastIndex, match.index) });
    }
    pushFormattingRun(runs, match);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    runs.push({ charStyle: "", text: text.slice(lastIndex) });
  }

  if (runs.length === 0 && text.length > 0) {
    runs.push({ charStyle: "", text });
  }

  return splitSymbolRuns(runs);
}

/** Push a formatting run based on which capture group matched */
function pushFormattingRun(runs: IcmlRun[], match: RegExpExecArray): void {
  if (match[2]) {
    runs.push({ charStyle: CS_BOLD_ITALIC, text: match[2] });
  } else if (match[3]) {
    runs.push({ charStyle: CS_BOLD, text: match[3] });
  } else if (match[4]) {
    runs.push({ charStyle: CS_ITALIC, text: match[4] });
  } else if (match[5]) {
    runs.push({ charStyle: CS_CODE, text: match[5] });
  }
}

/**
 * Post-process runs: any \u263D characters get wrapped in the CS_SYMBOL character
 * style so InDesign renders them from Segoe UI Symbol instead of the body font.
 */
function splitSymbolRuns(runs: IcmlRun[]): IcmlRun[] {
  const SYMBOL_RE = /\u263D/g;
  const result: IcmlRun[] = [];

  for (const run of runs) {
    if (!SYMBOL_RE.test(run.text)) {
      result.push(run);
      SYMBOL_RE.lastIndex = 0;
      continue;
    }
    SYMBOL_RE.lastIndex = 0;

    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = SYMBOL_RE.exec(run.text)) !== null) {
      if (m.index > last) {
        result.push({ charStyle: run.charStyle, text: run.text.slice(last, m.index) });
      }
      result.push({ charStyle: CS_SYMBOL, text: "\u263D" });
      last = m.index + m[0].length;
    }
    if (last < run.text.length) {
      result.push({ charStyle: run.charStyle, text: run.text.slice(last) });
    }
  }

  return result;
}

// =============================================================================
// Markdown Block Parsing -> IcmlParagraph[]
// =============================================================================

/** Image comment marker pattern from markdown export */
// eslint-disable-next-line sonarjs/slow-regex -- single line from controlled markdown output
const IMAGE_MARKER_RE = /^<!--\s*IMAGE:\s*(.+?)\s*-->$/;

/** Parse a single image marker line into content */
function parseImageMarker(line: string): { path: string; caption: string } | null {
  const m = IMAGE_MARKER_RE.exec(line.trim());
  if (!m) return null;
  const parts = m[1].split("|").map((p) => p.trim());
  const path = parts[0] || "";
  let caption = "";
  for (const part of parts) {
    const cm = /^caption:\s*"?(.*?)"?\s*$/.exec(part); // eslint-disable-line sonarjs/slow-regex -- short caption field
    if (cm) caption = cm[1];
  }
  return { path, caption };
}

/** Map heading depth (1-3) to paragraph style */
function headingStyleForLevel(level: number): string {
  if (level === 1) return PS_HEADING1;
  if (level === 2) return PS_HEADING2;
  return PS_HEADING3;
}

/** Try to parse a markdown line as a special block element */
function parseSpecialLine(
  trimmed: string,
  flushBlock: () => void
): { paras: IcmlParagraph[]; isHeading: boolean } | null {
  const img = parseImageMarker(trimmed);
  if (img) {
    flushBlock();
    const paras = [plainPara(PS_IMAGE_PLACEHOLDER, `[IMAGE: ${img.path}]`)];
    if (img.caption) {
      paras.push(plainPara(PS_CAPTION, img.caption));
    }
    return { paras, isHeading: false };
  }

  const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed); // eslint-disable-line sonarjs/slow-regex -- single markdown line
  if (headingMatch) {
    flushBlock();
    const style = headingStyleForLevel(headingMatch[1].length);
    return { paras: [styledPara(style, headingMatch[2])], isHeading: true };
  }

  if (/^[-*_]{3,}\s*$/.test(trimmed)) {
    flushBlock();
    return { paras: [plainPara(PS_SEPARATOR, "* * *")], isHeading: false };
  }

  if (trimmed.startsWith(">")) {
    flushBlock();
    const quoteText = trimmed.replace(/^>\s*/, "");
    return { paras: [styledPara(PS_BLOCKQUOTE, quoteText)], isHeading: false };
  }

  return null;
}

/**
 * Convert markdown text to ICML paragraphs. Handles:
 * - Headings (# ## ###)
 * - Blockquotes (>)
 * - Horizontal rules (--- or ***)
 * - Image markers (<!-- IMAGE: ... -->)
 * - Inline formatting (**bold**, *italic*, ***both***, `code`)
 */
export function markdownToIcmlParagraphs(markdown: string): IcmlParagraph[] {
  if (!markdown || !markdown.trim()) return [];

  const paras: IcmlParagraph[] = [];
  const lines = markdown.split("\n");
  let blockLines: string[] = [];
  let afterHeading = false;

  function flushBlock() {
    const text = blockLines.join(" ").trim();
    if (text) {
      const style = afterHeading ? PS_BODY_FIRST : PS_BODY;
      paras.push(styledPara(style, text));
      afterHeading = false;
    }
    blockLines = [];
  }

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushBlock();
      continue;
    }

    const special = parseSpecialLine(trimmed, flushBlock);
    if (special) {
      paras.push(...special.paras);
      afterHeading = special.isHeading;
      continue;
    }

    blockLines.push(trimmed);
  }

  flushBlock();
  return paras;
}

// =============================================================================
// XML Helpers
// =============================================================================

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// =============================================================================
// Paragraph Rendering
// =============================================================================

function renderRun(charStyle: string, text: string): string {
  const csAttr = charStyle ? `CharacterStyle/${charStyle}` : `CharacterStyle/${CS_NONE}`;
  return `      <CharacterStyleRange AppliedCharacterStyle="${csAttr}"><Content>${escapeXml(text)}</Content></CharacterStyleRange>`;
}

function renderParagraph(para: IcmlParagraph): string {
  const lines: string[] = [];
  lines.push(`    <ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/${para.paraStyle}">`);
  for (const run of para.runs) {
    lines.push(renderRun(run.charStyle, run.text));
  }
  lines.push("    </ParagraphStyleRange>");
  return lines.join("\n");
}

export function renderParagraphs(paras: IcmlParagraph[]): string {
  if (paras.length === 0) return "";
  return paras.map(renderParagraph).join("\n    <Br/>\n");
}

// =============================================================================
// Image Extension Helper
// =============================================================================

export function getImageExt(image?: ImageMetadataRecord): string {
  if (!image?.mimeType) return "";
  if (image.mimeType.includes("png")) return ".png";
  if (image.mimeType.includes("jpeg") || image.mimeType.includes("jpg")) return ".jpg";
  if (image.mimeType.includes("webp")) return ".webp";
  return "";
}
