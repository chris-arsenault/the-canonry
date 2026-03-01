/**
 * ICML Export
 *
 * Generates a single InCopy Markup Language (ICML) file containing the entire
 * book content in tree order, with paragraph and character styles carrying
 * real typographic properties (font, size, leading, indent, spacing).
 *
 * Place the resulting .icml in InDesign via File > Place -- text flows through
 * frames with styles pre-applied. Override styles in the InDesign template
 * to match the target design.
 */

import type { ImageMetadataRecord } from "./prePrintStats";
import type { ContentTreeState, ExportImageEntry } from "./prePrintTypes";
import type { ContentMaps } from "./icmlContent";
import { buildBookParagraphs } from "./icmlContent";
import type { IcmlParagraph, ParagraphStyleDef } from "./icmlStyles";
import {
  renderParagraphs,
  CHARACTER_STYLE_DEFS,
  PARAGRAPH_STYLE_DEFS,
} from "./icmlStyles";

// Re-export everything from icmlStyles for backward compatibility
export {
  // Types
  type IcmlRun,
  type IcmlParagraph,
  type ParagraphStyleDef,
  type CharacterStyleDef,
  // Character style names
  CS_NONE,
  CS_BOLD,
  CS_ITALIC,
  CS_BOLD_ITALIC,
  CS_CODE,
  CS_SYMBOL,
  CS_FOOTNOTE_REF,
  // Paragraph style names
  PS_SECTION_HEADING,
  PS_ERA_HEADING,
  PS_ITEM_TITLE,
  PS_ITEM_SUBTITLE,
  PS_BODY,
  PS_BODY_FIRST,
  PS_HEADING1,
  PS_HEADING2,
  PS_HEADING3,
  PS_BLOCKQUOTE,
  PS_HISTORIAN_NOTE,
  PS_CAPTION,
  PS_IMAGE_PLACEHOLDER,
  PS_METADATA,
  PS_CAST_ENTRY,
  PS_SEPARATOR,
  PS_FOOTNOTE_TEXT,
  PS_CALLOUT_BODY,
  // Style arrays
  CHARACTER_STYLE_DEFS,
  PARAGRAPH_STYLE_DEFS,
  // Functions
  escapeXml,
  plainPara,
  styledPara,
  parseInlineRuns,
  markdownToIcmlParagraphs,
  renderParagraphs,
  getImageExt,
} from "./icmlStyles";

// Re-export content converters for backward compatibility
export {
  annotateContentWithImages,
  entityToIcmlParagraphs,
  chronicleToIcmlParagraphs,
  eraNarrativeToIcmlParagraphs,
  staticPageToIcmlParagraphs,
  createImageRegistrar,
  buildBookParagraphs,
} from "./icmlContent";
export type { ContentMaps, ImageSourceType, ImageRegisterFn } from "./icmlContent";

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
  position?: string
): string {
  const selfId =
    name === "[No character style]" ? `CharacterStyle/$ID/${name}` : `CharacterStyle/${name}`;
  let attrs = `Self="${selfId}" Name="${name}"`;
  if (fontStyle) attrs += ` FontStyle="${fontStyle}"`;
  if (position) attrs += ` Position="${position}"`;

  if (appliedFont) {
    return `    <CharacterStyle ${attrs}>\n      <Properties><AppliedFont type="string">${appliedFont}</AppliedFont></Properties>\n    </CharacterStyle>`;
  }
  return `    <CharacterStyle ${attrs} />`;
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
    buildCharacterStyleDef("[No character style]", ""),
    ...CHARACTER_STYLE_DEFS.map((cs) =>
      buildCharacterStyleDef(cs.name, cs.fontStyle, cs.appliedFont, cs.position)
    ),
  ];

  const lines: string[] = [];
  lines.push('  <RootCharacterStyleGroup Self="rc_styles">');
  for (const cs of charStyles) lines.push(cs);
  lines.push("  </RootCharacterStyleGroup>");
  lines.push('  <RootParagraphStyleGroup Self="rp_styles">');
  lines.push(
    '    <ParagraphStyle Self="ParagraphStyle/$ID/NormalParagraphStyle" Name="[No paragraph style]" />'
  );
  for (const ps of PARAGRAPH_STYLE_DEFS) lines.push(buildParagraphStyleDef(ps));
  lines.push("  </RootParagraphStyleGroup>");
  return lines.join("\n");
}

function buildStoryOpen(): string {
  return `  <Story Self="loreweave_story" TrackChanges="false" StoryTitle="" AppliedTOCStyle="n" AppliedNamedGrid="n">
    <StoryPreference OpticalMarginAlignment="true" OpticalMarginSize="12" />`;
}

// =============================================================================
// Top-Level ICML Document Assembly
// =============================================================================

/**
 * Build a complete ICML document from the content tree.
 * Wraps the shared paragraph output in ICML document structure.
 */
export function buildBookIcml(
  treeState: ContentTreeState,
  contentMaps: ContentMaps,
  imageMap: Map<string, ImageMetadataRecord>,
  referencedImages: Map<string, ExportImageEntry>
): string {
  const allParagraphs = buildBookParagraphs(treeState, contentMaps, imageMap, referencedImages);

  const parts: string[] = [];
  parts.push(ICML_HEADER);
  parts.push(buildStyleDefinitions());
  parts.push(buildStoryOpen());
  parts.push(renderParagraphs(allParagraphs));
  parts.push(ICML_FOOTER);
  return parts.join("\n");
}
