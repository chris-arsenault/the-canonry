/**
 * ICML Export
 *
 * Generates a single InCopy Markup Language (ICML) file containing the entire
 * book content in tree order, with paragraph and character styles carrying
 * real typographic properties (font, size, leading, indent, spacing).
 *
 * Place the resulting .icml in InDesign via File > Place — text flows through
 * frames with styles pre-applied. Override styles in the InDesign template
 * to match the target design.
 */

import type { PersistedEntity } from '../db/illuminatorDb';
import type { ChronicleRecord, ChronicleImageRef } from '../chronicleTypes';
import type { ImageMetadataRecord } from './prePrintStats';
import type { StaticPage } from '../staticPageTypes';
import type { EraNarrativeRecord } from '../eraNarrativeTypes';
import type { HistorianNote } from '../historianTypes';
import { isNoteActive, noteDisplay } from '../historianTypes';
import { resolveAnchorPhrase } from '../fuzzyAnchor';
import { resolveActiveContent } from '../db/eraNarrativeRepository';
import type { ContentTreeState, ContentTreeNode, ExportImageEntry } from './prePrintTypes';
import { flattenForExport } from './contentTree';
import { countWords } from '../db/staticPageRepository';

// =============================================================================
// Types
// =============================================================================

interface IcmlRun {
  charStyle: string; // character style name, or '' for default
  text: string;
}

interface IcmlParagraph {
  paraStyle: string;
  runs: IcmlRun[];
}

// =============================================================================
// Constants — Character & Paragraph Style Names
// =============================================================================

const CS_NONE = '$ID/[No character style]';
const CS_BOLD = 'Bold';
const CS_ITALIC = 'Italic';
const CS_BOLD_ITALIC = 'BoldItalic';
const CS_CODE = 'Code';

const PS_SECTION_HEADING = 'SectionHeading';
const PS_ERA_HEADING = 'EraHeading';
const PS_ITEM_TITLE = 'ItemTitle';
const PS_ITEM_SUBTITLE = 'ItemSubtitle';
const PS_BODY = 'Body';
const PS_BODY_FIRST = 'BodyFirst';
const PS_HEADING1 = 'Heading1';
const PS_HEADING2 = 'Heading2';
const PS_HEADING3 = 'Heading3';
const PS_BLOCKQUOTE = 'Blockquote';
const PS_HISTORIAN_NOTE = 'HistorianNote';
const PS_CAPTION = 'Caption';
const PS_IMAGE_PLACEHOLDER = 'ImagePlaceholder';
const PS_METADATA = 'Metadata';
const PS_CAST_ENTRY = 'CastEntry';
const PS_SEPARATOR = 'ItemSeparator';

// =============================================================================
// XML Helpers
// =============================================================================

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// =============================================================================
// ICML Document Structure
// =============================================================================

const ICML_HEADER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?aid style="50" type="snippet" readerVersion="6.0" featureSet="513" product="8.0(370)" ?>
<?aid SnippetType="InCopyInterchange"?>
<Document DOMVersion="8.0" Self="loreweave_doc">`;

const ICML_FOOTER = `  </Story>
</Document>`;

function buildCharacterStyleDef(
  name: string,
  fontStyle: string,
  appliedFont?: string,
  position?: string,
): string {
  const selfId = name === '[No character style]' ? `CharacterStyle/$ID/${name}` : `CharacterStyle/${name}`;
  let attrs = `Self="${selfId}" Name="${name}"`;
  if (fontStyle) attrs += ` FontStyle="${fontStyle}"`;
  if (position) attrs += ` Position="${position}"`;

  if (appliedFont) {
    return `    <CharacterStyle ${attrs}>\n      <Properties><AppliedFont type="string">${appliedFont}</AppliedFont></Properties>\n    </CharacterStyle>`;
  }
  return `    <CharacterStyle ${attrs} />`;
}

interface ParagraphStyleDef {
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

function buildParagraphStyleDef(def: ParagraphStyleDef): string {
  return `    <ParagraphStyle Self="ParagraphStyle/${def.name}" Name="${def.name}"
        PointSize="${def.pointSize}" Leading="${def.leading}"
        Justification="${def.justification}" FontStyle="${def.fontStyle}"
        FirstLineIndent="${def.firstLineIndent}"
        LeftIndent="${def.leftIndent}" RightIndent="${def.rightIndent}"
        SpaceBefore="${def.spaceBefore}" SpaceAfter="${def.spaceAfter}">
      <Properties>
        <BasedOn type="string">$ID/NormalParagraphStyle</BasedOn>
        <AppliedFont type="string">${def.appliedFont}</AppliedFont>
      </Properties>
    </ParagraphStyle>`;
}

function buildStyleDefinitions(): string {
  const charStyles = [
    buildCharacterStyleDef('[No character style]', ''),
    buildCharacterStyleDef(CS_BOLD, 'Bold'),
    buildCharacterStyleDef(CS_ITALIC, 'Italic'),
    buildCharacterStyleDef(CS_BOLD_ITALIC, 'Bold Italic'),
    buildCharacterStyleDef(CS_CODE, 'Regular', 'Courier New'),
  ];

  const paraStyles: ParagraphStyleDef[] = [
    { name: PS_SECTION_HEADING, pointSize: 28, leading: 34, fontStyle: 'Regular', justification: 'CenterAlign', firstLineIndent: 0, leftIndent: 0, rightIndent: 0, spaceBefore: 36, spaceAfter: 18, appliedFont: 'Minion Pro' },
    { name: PS_ERA_HEADING, pointSize: 20, leading: 26, fontStyle: 'Regular', justification: 'LeftAlign', firstLineIndent: 0, leftIndent: 0, rightIndent: 0, spaceBefore: 24, spaceAfter: 12, appliedFont: 'Minion Pro' },
    { name: PS_ITEM_TITLE, pointSize: 16, leading: 20, fontStyle: 'Bold', justification: 'LeftAlign', firstLineIndent: 0, leftIndent: 0, rightIndent: 0, spaceBefore: 18, spaceAfter: 4, appliedFont: 'Minion Pro' },
    { name: PS_ITEM_SUBTITLE, pointSize: 10, leading: 14, fontStyle: 'Italic', justification: 'LeftAlign', firstLineIndent: 0, leftIndent: 0, rightIndent: 0, spaceBefore: 0, spaceAfter: 8, appliedFont: 'Minion Pro' },
    { name: PS_BODY, pointSize: 11, leading: 14, fontStyle: 'Regular', justification: 'LeftJustified', firstLineIndent: 18, leftIndent: 0, rightIndent: 0, spaceBefore: 0, spaceAfter: 4, appliedFont: 'Minion Pro' },
    { name: PS_BODY_FIRST, pointSize: 11, leading: 14, fontStyle: 'Regular', justification: 'LeftJustified', firstLineIndent: 0, leftIndent: 0, rightIndent: 0, spaceBefore: 0, spaceAfter: 4, appliedFont: 'Minion Pro' },
    { name: PS_HEADING1, pointSize: 14, leading: 18, fontStyle: 'Bold', justification: 'LeftAlign', firstLineIndent: 0, leftIndent: 0, rightIndent: 0, spaceBefore: 14, spaceAfter: 6, appliedFont: 'Minion Pro' },
    { name: PS_HEADING2, pointSize: 12, leading: 16, fontStyle: 'Bold', justification: 'LeftAlign', firstLineIndent: 0, leftIndent: 0, rightIndent: 0, spaceBefore: 10, spaceAfter: 4, appliedFont: 'Minion Pro' },
    { name: PS_HEADING3, pointSize: 11, leading: 14, fontStyle: 'Bold Italic', justification: 'LeftAlign', firstLineIndent: 0, leftIndent: 0, rightIndent: 0, spaceBefore: 8, spaceAfter: 4, appliedFont: 'Minion Pro' },
    { name: PS_BLOCKQUOTE, pointSize: 10, leading: 13, fontStyle: 'Italic', justification: 'LeftJustified', firstLineIndent: 0, leftIndent: 24, rightIndent: 24, spaceBefore: 6, spaceAfter: 6, appliedFont: 'Minion Pro' },
    { name: PS_HISTORIAN_NOTE, pointSize: 9, leading: 12, fontStyle: 'Regular', justification: 'LeftAlign', firstLineIndent: 0, leftIndent: 18, rightIndent: 0, spaceBefore: 4, spaceAfter: 4, appliedFont: 'Minion Pro' },
    { name: PS_CAPTION, pointSize: 9, leading: 12, fontStyle: 'Italic', justification: 'CenterAlign', firstLineIndent: 0, leftIndent: 0, rightIndent: 0, spaceBefore: 4, spaceAfter: 8, appliedFont: 'Minion Pro' },
    { name: PS_IMAGE_PLACEHOLDER, pointSize: 9, leading: 12, fontStyle: 'Regular', justification: 'LeftAlign', firstLineIndent: 0, leftIndent: 0, rightIndent: 0, spaceBefore: 8, spaceAfter: 8, appliedFont: 'Courier New' },
    { name: PS_METADATA, pointSize: 9, leading: 12, fontStyle: 'Regular', justification: 'LeftAlign', firstLineIndent: 0, leftIndent: 0, rightIndent: 0, spaceBefore: 2, spaceAfter: 2, appliedFont: 'Minion Pro' },
    { name: PS_CAST_ENTRY, pointSize: 10, leading: 13, fontStyle: 'Regular', justification: 'LeftAlign', firstLineIndent: 0, leftIndent: 18, rightIndent: 0, spaceBefore: 2, spaceAfter: 2, appliedFont: 'Minion Pro' },
    { name: PS_SEPARATOR, pointSize: 11, leading: 20, fontStyle: 'Regular', justification: 'CenterAlign', firstLineIndent: 0, leftIndent: 0, rightIndent: 0, spaceBefore: 12, spaceAfter: 12, appliedFont: 'Minion Pro' },
  ];

  const lines: string[] = [];
  lines.push('  <RootCharacterStyleGroup Self="rc_styles">');
  for (const cs of charStyles) lines.push(cs);
  lines.push('  </RootCharacterStyleGroup>');
  lines.push('  <RootParagraphStyleGroup Self="rp_styles">');
  lines.push('    <ParagraphStyle Self="ParagraphStyle/$ID/NormalParagraphStyle" Name="[No paragraph style]" />');
  for (const ps of paraStyles) lines.push(buildParagraphStyleDef(ps));
  lines.push('  </RootParagraphStyleGroup>');
  return lines.join('\n');
}

function buildStoryOpen(): string {
  return `  <Story Self="loreweave_story" TrackChanges="false" StoryTitle="" AppliedTOCStyle="n" AppliedNamedGrid="n">
    <StoryPreference OpticalMarginAlignment="true" OpticalMarginSize="12" />`;
}

// =============================================================================
// Paragraph & Run Rendering
// =============================================================================

function renderRun(charStyle: string, text: string): string {
  const csAttr = charStyle
    ? `CharacterStyle/${charStyle}`
    : `CharacterStyle/${CS_NONE}`;
  return `      <CharacterStyleRange AppliedCharacterStyle="${csAttr}"><Content>${escapeXml(text)}</Content></CharacterStyleRange>`;
}

function renderParagraph(para: IcmlParagraph): string {
  const lines: string[] = [];
  lines.push(`    <ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/${para.paraStyle}">`);
  for (const run of para.runs) {
    lines.push(renderRun(run.charStyle, run.text));
  }
  lines.push('    </ParagraphStyleRange>');
  return lines.join('\n');
}

function renderParagraphs(paras: IcmlParagraph[]): string {
  if (paras.length === 0) return '';
  return paras.map(renderParagraph).join('\n    <Br />\n');
}

// =============================================================================
// Inline Markdown Parsing → IcmlRun[]
// =============================================================================

/**
 * Parse inline markdown formatting into character style runs.
 * Handles: ***bold italic***, **bold**, *italic*, `code`
 */
function parseInlineRuns(text: string): IcmlRun[] {
  const runs: IcmlRun[] = [];
  // Order matters: bold-italic before bold before italic
  const pattern = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      runs.push({ charStyle: '', text: text.slice(lastIndex, match.index) });
    }

    if (match[2]) {
      // ***bold italic***
      runs.push({ charStyle: CS_BOLD_ITALIC, text: match[2] });
    } else if (match[3]) {
      // **bold**
      runs.push({ charStyle: CS_BOLD, text: match[3] });
    } else if (match[4]) {
      // *italic*
      runs.push({ charStyle: CS_ITALIC, text: match[4] });
    } else if (match[5]) {
      // `code`
      runs.push({ charStyle: CS_CODE, text: match[5] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    runs.push({ charStyle: '', text: text.slice(lastIndex) });
  }

  // If no runs were generated, add the full text as a default run
  if (runs.length === 0 && text.length > 0) {
    runs.push({ charStyle: '', text });
  }

  return runs;
}

/** Create a simple paragraph with a single default-style run */
function plainPara(style: string, text: string): IcmlParagraph {
  return { paraStyle: style, runs: [{ charStyle: '', text }] };
}

/** Create a paragraph with inline markdown parsed into runs */
function styledPara(style: string, text: string): IcmlParagraph {
  return { paraStyle: style, runs: parseInlineRuns(text) };
}

// =============================================================================
// Markdown Block Parsing → IcmlParagraph[]
// =============================================================================

/** Image comment marker pattern from markdown export */
const IMAGE_MARKER_RE = /^<!--\s*IMAGE:\s*(.+?)\s*-->$/;

/** Parse a single image marker line into content */
function parseImageMarker(line: string): { path: string; caption: string } | null {
  const m = IMAGE_MARKER_RE.exec(line.trim());
  if (!m) return null;
  const parts = m[1].split('|').map((p) => p.trim());
  const path = parts[0] || '';
  let caption = '';
  for (const part of parts) {
    const cm = /^caption:\s*"?(.*?)"?\s*$/.exec(part);
    if (cm) caption = cm[1];
  }
  return { path, caption };
}

/**
 * Convert markdown text to ICML paragraphs. Handles:
 * - Headings (# ## ###)
 * - Blockquotes (>)
 * - Horizontal rules (--- or ***)
 * - Image markers (<!-- IMAGE: ... -->)
 * - Inline formatting (**bold**, *italic*, ***both***, `code`)
 */
function markdownToIcmlParagraphs(markdown: string): IcmlParagraph[] {
  if (!markdown || !markdown.trim()) return [];

  const paras: IcmlParagraph[] = [];
  const lines = markdown.split('\n');
  let blockLines: string[] = [];
  let afterHeading = false;

  function flushBlock() {
    const text = blockLines.join(' ').trim();
    if (text) {
      const style = afterHeading ? PS_BODY_FIRST : PS_BODY;
      paras.push(styledPara(style, text));
      afterHeading = false;
    }
    blockLines = [];
  }

  for (const rawLine of lines) {
    const line = rawLine;
    const trimmed = line.trim();

    // Empty line = flush paragraph
    if (!trimmed) {
      flushBlock();
      continue;
    }

    // Image marker
    const img = parseImageMarker(trimmed);
    if (img) {
      flushBlock();
      paras.push(plainPara(PS_IMAGE_PLACEHOLDER, `[IMAGE: ${img.path}]`));
      if (img.caption) {
        paras.push(plainPara(PS_CAPTION, img.caption));
      }
      afterHeading = false;
      continue;
    }

    // Heading
    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      flushBlock();
      const level = headingMatch[1].length;
      const headingStyle = level === 1 ? PS_HEADING1 : level === 2 ? PS_HEADING2 : PS_HEADING3;
      paras.push(styledPara(headingStyle, headingMatch[2]));
      afterHeading = true;
      continue;
    }

    // Horizontal rule → separator
    if (/^[-*_]{3,}\s*$/.test(trimmed)) {
      flushBlock();
      paras.push(plainPara(PS_SEPARATOR, '* * *'));
      afterHeading = false;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      flushBlock();
      const quoteText = trimmed.replace(/^>\s*/, '');
      paras.push(styledPara(PS_BLOCKQUOTE, quoteText));
      afterHeading = false;
      continue;
    }

    // Regular text — accumulate into block
    blockLines.push(trimmed);
  }

  flushBlock();
  return paras;
}

// =============================================================================
// Content Formatters
// =============================================================================

function getImageExt(image?: ImageMetadataRecord): string {
  if (!image?.mimeType) return '';
  if (image.mimeType.includes('png')) return '.png';
  if (image.mimeType.includes('jpeg') || image.mimeType.includes('jpg')) return '.jpg';
  if (image.mimeType.includes('webp')) return '.webp';
  return '';
}

function resolveInsertPosition(
  text: string,
  anchorText: string,
  anchorIndex?: number,
): number {
  const resolved = anchorText ? resolveAnchorPhrase(anchorText, text) : null;
  let position = resolved ? resolved.index : -1;
  if (position < 0 && anchorIndex !== undefined && anchorIndex < text.length) {
    position = anchorIndex;
  }
  if (position < 0) position = text.length;

  const anchorLength = anchorText?.length ?? 0;
  const anchorEnd = position + anchorLength;
  const paragraphEnd = text.indexOf('\n\n', anchorEnd);
  return paragraphEnd >= 0 ? paragraphEnd : text.length;
}

/**
 * Insert image markers into content text and return annotated markdown.
 * Mirrors the logic from markdownExport.ts.
 */
function annotateContentWithImages(
  content: string,
  imageRefs: { refs?: any[] } | undefined,
  imageMap: Map<string, ImageMetadataRecord>,
  referencedImages: Map<string, ExportImageEntry>,
  registerFn: (imgId: string, type: 'entity' | 'chronicle' | 'cover', entityId?: string, entityName?: string, chronicleId?: string) => void,
): string {
  if (!imageRefs?.refs || !content) return content;

  let annotated = content;

  // Prompt-request images
  const promptRefs = imageRefs.refs.filter(
    (r: any) => r.type === 'prompt_request' && r.status === 'complete' && r.generatedImageId
  );
  const promptInsertions = promptRefs.map((ref: any) => ({
    ref,
    insertAt: resolveInsertPosition(content, ref.anchorText, ref.anchorIndex),
  })).sort((a: any, b: any) => b.insertAt - a.insertAt);

  for (const { ref, insertAt } of promptInsertions) {
    const imgId = ref.generatedImageId;
    registerFn(imgId, 'chronicle');
    const ext = getImageExt(imageMap.get(imgId));
    const caption = ref.caption || '';
    const marker = `\n\n<!-- IMAGE: images/${imgId}${ext} | size: ${ref.size} | float: ${ref.justification || 'none'} | caption: "${caption}" -->\n\n`;
    annotated = annotated.slice(0, insertAt) + marker + annotated.slice(insertAt);
  }

  // Entity-ref images
  const entityRefs = imageRefs.refs.filter((r: any) => r.type === 'entity_ref');
  const entityInsertions = entityRefs.map((ref: any) => ({
    ref,
    insertAt: resolveInsertPosition(content, ref.anchorText, ref.anchorIndex),
  })).sort((a: any, b: any) => b.insertAt - a.insertAt);

  for (const { ref, insertAt } of entityInsertions) {
    const caption = ref.caption || '';
    const marker = `\n\n<!-- IMAGE: entity-portrait-${ref.entityId} | size: ${ref.size} | float: ${ref.justification || 'none'} | caption: "${caption}" -->\n\n`;
    annotated = annotated.slice(0, insertAt) + marker + annotated.slice(insertAt);
  }

  // Chronicle-ref images (for era narratives)
  const chronicleRefs = imageRefs.refs.filter((r: any) => r.type === 'chronicle_ref');
  const chronicleInsertions = chronicleRefs.map((ref: any) => ({
    ref,
    insertAt: resolveInsertPosition(content, ref.anchorText, ref.anchorIndex),
  })).sort((a: any, b: any) => b.insertAt - a.insertAt);

  for (const { ref, insertAt } of chronicleInsertions) {
    const imgId = ref.imageId;
    registerFn(imgId, 'chronicle');
    const ext = getImageExt(imageMap.get(imgId));
    const caption = ref.caption || '';
    const marker = `\n\n<!-- IMAGE: images/${imgId}${ext} | size: ${ref.size} | float: ${ref.justification || 'none'} | caption: "${caption}" -->\n\n`;
    annotated = annotated.slice(0, insertAt) + marker + annotated.slice(insertAt);
  }

  return annotated;
}

/** Convert an entity to ICML paragraphs */
function entityToIcmlParagraphs(
  entity: PersistedEntity,
  imageMap: Map<string, ImageMetadataRecord>,
  referencedImages: Map<string, ExportImageEntry>,
  registerFn: (imgId: string, type: 'entity' | 'chronicle' | 'cover', entityId?: string, entityName?: string, chronicleId?: string) => void,
): IcmlParagraph[] {
  const paras: IcmlParagraph[] = [];

  // Title
  paras.push(plainPara(PS_ITEM_TITLE, entity.name));

  // Subtitle: kind / subtype
  const subtitleParts = [entity.kind];
  if (entity.subtype) subtitleParts.push(entity.subtype);
  if (entity.culture) subtitleParts.push(entity.culture);
  paras.push(plainPara(PS_ITEM_SUBTITLE, subtitleParts.join(' \u2022 ')));

  // Metadata
  paras.push(plainPara(PS_METADATA, `Prominence: ${entity.prominence} | Status: ${entity.status}`));

  const aliases = entity.enrichment?.text?.aliases;
  if (aliases?.length) {
    paras.push(plainPara(PS_METADATA, `Also known as: ${aliases.join(', ')}`));
  }

  if (entity.tags && Object.keys(entity.tags).length > 0) {
    const tagStr = Object.entries(entity.tags)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ');
    paras.push(plainPara(PS_METADATA, tagStr));
  }

  // Entity image
  const imageId = entity.enrichment?.image?.imageId;
  if (imageId) {
    registerFn(imageId, 'entity', entity.id, entity.name);
    const ext = getImageExt(imageMap.get(imageId));
    paras.push(plainPara(PS_IMAGE_PLACEHOLDER, `[IMAGE: images/${imageId}${ext}]`));
    paras.push(plainPara(PS_CAPTION, `${entity.name} portrait`));
  }

  // Summary
  if (entity.summary) {
    paras.push(styledPara(PS_BLOCKQUOTE, entity.summary));
  }

  // Description body
  if (entity.description) {
    const bodyParas = markdownToIcmlParagraphs(entity.description);
    paras.push(...bodyParas);
  }

  // Historian notes
  const notes = entity.enrichment?.historianNotes?.filter((n: HistorianNote) => isNoteActive(n));
  if (notes?.length) {
    const fullNotes = notes.filter((n: HistorianNote) => noteDisplay(n) === 'full');
    const popoutNotes = notes.filter((n: HistorianNote) => noteDisplay(n) === 'popout');

    if (fullNotes.length > 0 || popoutNotes.length > 0) {
      paras.push(plainPara(PS_HEADING2, 'Historian\u2019s Notes'));
    }

    for (const note of fullNotes) {
      const typeLabel = note.type.charAt(0).toUpperCase() + note.type.slice(1);
      paras.push({
        paraStyle: PS_HISTORIAN_NOTE,
        runs: [
          { charStyle: CS_BOLD, text: `[${typeLabel}] ` },
          { charStyle: '', text: note.text },
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
          { charStyle: '', text: `${note.text} \u2014 \u201C${note.anchorPhrase}\u201D` },
        ],
      });
    }
  }

  return paras;
}

/** Convert a chronicle to ICML paragraphs */
function chronicleToIcmlParagraphs(
  chronicle: ChronicleRecord,
  imageMap: Map<string, ImageMetadataRecord>,
  referencedImages: Map<string, ExportImageEntry>,
  registerFn: (imgId: string, type: 'entity' | 'chronicle' | 'cover', entityId?: string, entityName?: string, chronicleId?: string) => void,
): IcmlParagraph[] {
  const paras: IcmlParagraph[] = [];
  const content = chronicle.finalContent || chronicle.assembledContent || '';

  // Title
  paras.push(plainPara(PS_ITEM_TITLE, chronicle.title || 'Untitled Chronicle'));

  // Subtitle
  const subtitleParts = [chronicle.format, chronicle.focusType];
  if (chronicle.narrativeStyle?.name) subtitleParts.push(chronicle.narrativeStyle.name);
  paras.push(plainPara(PS_ITEM_SUBTITLE, subtitleParts.join(' \u2022 ')));

  // Summary
  if (chronicle.summary) {
    paras.push(styledPara(PS_BLOCKQUOTE, chronicle.summary));
  }

  // Cover image
  const coverImageId = chronicle.coverImage?.generatedImageId;
  if (coverImageId && chronicle.coverImage?.status === 'complete') {
    registerFn(coverImageId, 'cover', undefined, undefined, chronicle.chronicleId);
    const ext = getImageExt(imageMap.get(coverImageId));
    paras.push(plainPara(PS_IMAGE_PLACEHOLDER, `[IMAGE: images/${coverImageId}${ext}]`));
    paras.push(plainPara(PS_CAPTION, chronicle.title || 'Cover'));
  }

  // Cast
  if (chronicle.roleAssignments?.length) {
    paras.push(plainPara(PS_HEADING2, 'Cast'));
    for (const ra of chronicle.roleAssignments) {
      const emphasis = ra.isPrimary ? 'Primary' : 'Supporting';
      paras.push({
        paraStyle: PS_CAST_ENTRY,
        runs: [
          { charStyle: CS_BOLD, text: ra.role },
          { charStyle: '', text: ` \u2014 ${ra.entityName} (${ra.entityKind}, ${emphasis})` },
        ],
      });
    }
  }

  // Narrative content with inline images
  if (content) {
    const annotated = annotateContentWithImages(
      content, chronicle.imageRefs, imageMap, referencedImages, registerFn
    );
    const bodyParas = markdownToIcmlParagraphs(annotated);
    paras.push(...bodyParas);
  }

  // Historian notes
  const notes = chronicle.historianNotes?.filter((n: HistorianNote) => isNoteActive(n));
  if (notes?.length) {
    const fullNotes = notes.filter((n: HistorianNote) => noteDisplay(n) === 'full');
    const popoutNotes = notes.filter((n: HistorianNote) => noteDisplay(n) === 'popout');

    if (fullNotes.length > 0 || popoutNotes.length > 0) {
      paras.push(plainPara(PS_HEADING2, 'Historian\u2019s Notes'));
    }

    for (const note of fullNotes) {
      const typeLabel = note.type.charAt(0).toUpperCase() + note.type.slice(1);
      paras.push({
        paraStyle: PS_HISTORIAN_NOTE,
        runs: [
          { charStyle: CS_BOLD, text: `[${typeLabel}] ` },
          { charStyle: '', text: note.text },
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
          { charStyle: '', text: `${note.text} \u2014 \u201C${note.anchorPhrase}\u201D` },
        ],
      });
    }
  }

  return paras;
}

/** Convert an era narrative to ICML paragraphs */
function eraNarrativeToIcmlParagraphs(
  narrative: EraNarrativeRecord,
  imageMap: Map<string, ImageMetadataRecord>,
  referencedImages: Map<string, ExportImageEntry>,
  registerFn: (imgId: string, type: 'entity' | 'chronicle' | 'cover', entityId?: string, entityName?: string, chronicleId?: string) => void,
): IcmlParagraph[] {
  const paras: IcmlParagraph[] = [];
  const { content } = resolveActiveContent(narrative);

  // Title
  paras.push(plainPara(PS_ITEM_TITLE, narrative.eraName));

  // Subtitle
  paras.push(plainPara(PS_ITEM_SUBTITLE, `${narrative.tone} \u2022 era narrative`));

  // Thesis
  if (narrative.threadSynthesis?.thesis) {
    paras.push(styledPara(PS_BLOCKQUOTE, narrative.threadSynthesis.thesis));
  }

  // Threads
  if (narrative.threadSynthesis?.threads?.length) {
    const threadNames = narrative.threadSynthesis.threads.map((t: any) => t.name).join(', ');
    paras.push(plainPara(PS_METADATA, `Threads: ${threadNames}`));
  }

  // Cover image
  const coverImageId = narrative.coverImage?.generatedImageId;
  if (coverImageId && narrative.coverImage?.status === 'complete') {
    registerFn(coverImageId, 'cover');
    const ext = getImageExt(imageMap.get(coverImageId));
    paras.push(plainPara(PS_IMAGE_PLACEHOLDER, `[IMAGE: images/${coverImageId}${ext}]`));
    paras.push(plainPara(PS_CAPTION, narrative.eraName));
  }

  // Content with inline images
  if (content) {
    const annotated = annotateContentWithImages(
      content, narrative.imageRefs, imageMap, referencedImages, registerFn
    );
    const bodyParas = markdownToIcmlParagraphs(annotated);
    paras.push(...bodyParas);
  }

  return paras;
}

/** Convert a static page to ICML paragraphs */
function staticPageToIcmlParagraphs(page: StaticPage): IcmlParagraph[] {
  const paras: IcmlParagraph[] = [];

  // Title
  paras.push(plainPara(PS_ITEM_TITLE, page.title));

  // Content (already markdown with headings, etc.)
  if (page.content) {
    const bodyParas = markdownToIcmlParagraphs(page.content);
    paras.push(...bodyParas);
  }

  return paras;
}

// =============================================================================
// Image Registration (mirrors markdownExport.ts pattern)
// =============================================================================

function createImageRegistrar(
  referencedImages: Map<string, ExportImageEntry>,
  imageMap: Map<string, ImageMetadataRecord>,
) {
  return function registerImage(
    imgId: string,
    type: 'entity' | 'chronicle' | 'cover',
    entityId?: string,
    entityName?: string,
    chronicleId?: string,
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
// Top-Level Assembly
// =============================================================================

interface ContentMaps {
  entityMap: Map<string, PersistedEntity>;
  chronicleMap: Map<string, ChronicleRecord>;
  pageMap: Map<string, StaticPage>;
  narrativeMap: Map<string, EraNarrativeRecord>;
}

/**
 * Build a complete ICML document from the content tree.
 * Walks the tree in order, emitting section/era headings for folders
 * and formatted content for items, separated by item separators.
 */
export function buildBookIcml(
  treeState: ContentTreeState,
  contentMaps: ContentMaps,
  imageMap: Map<string, ImageMetadataRecord>,
  referencedImages: Map<string, ExportImageEntry>,
): string {
  const registerFn = createImageRegistrar(referencedImages, imageMap);

  const allParagraphs: IcmlParagraph[] = [];
  const flattened = flattenForExport(treeState);
  let prevWasContent = false;

  for (const { node, depth } of flattened) {
    if (node.type === 'folder') {
      // Add separator before switching sections (but not at the very start)
      if (prevWasContent) {
        allParagraphs.push(plainPara(PS_SEPARATOR, '* * *'));
        prevWasContent = false;
      }

      // Depth 0 = top sections (Front Matter, Body, Back Matter)
      // Depth 1+ = sub-sections (era folders, encyclopedia, etc.)
      const headingStyle = depth <= 0 ? PS_SECTION_HEADING : PS_ERA_HEADING;
      allParagraphs.push(plainPara(headingStyle, node.name));
      continue;
    }

    if (!node.contentId) continue;

    // Add separator between content items within same section
    if (prevWasContent) {
      allParagraphs.push(plainPara(PS_SEPARATOR, '* * *'));
    }

    let contentParas: IcmlParagraph[] = [];

    if (node.type === 'entity') {
      const entity = contentMaps.entityMap.get(node.contentId);
      if (entity) {
        contentParas = entityToIcmlParagraphs(entity, imageMap, referencedImages, registerFn);
      }
    } else if (node.type === 'chronicle') {
      const chronicle = contentMaps.chronicleMap.get(node.contentId);
      if (chronicle) {
        contentParas = chronicleToIcmlParagraphs(chronicle, imageMap, referencedImages, registerFn);
      }
    } else if (node.type === 'era_narrative') {
      const narrative = contentMaps.narrativeMap.get(node.contentId);
      if (narrative) {
        contentParas = eraNarrativeToIcmlParagraphs(narrative, imageMap, referencedImages, registerFn);
      }
    } else if (node.type === 'static_page') {
      const page = contentMaps.pageMap.get(node.contentId);
      if (page) {
        contentParas = staticPageToIcmlParagraphs(page);
      }
    }

    if (contentParas.length > 0) {
      allParagraphs.push(...contentParas);
      prevWasContent = true;
    }
  }

  // Assemble the complete ICML document
  const parts: string[] = [];
  parts.push(ICML_HEADER);
  parts.push(buildStyleDefinitions());
  parts.push(buildStoryOpen());
  parts.push(renderParagraphs(allParagraphs));
  parts.push(ICML_FOOTER);
  return parts.join('\n');
}
