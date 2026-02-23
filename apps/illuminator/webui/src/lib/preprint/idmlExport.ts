/**
 * IDML Export — Per-Entry Story Architecture
 *
 * Generates a complete InDesign Markup Language (.idml) package that opens
 * directly in InDesign with one Story per content entry.
 *
 * Architecture:
 * - Each content tree entry (entity, chronicle, era narrative, static page)
 *   gets its own Story XML, its own Spread(s), and optionally callout stories
 * - Folder headings get a simple story + spread
 * - 4 master spreads distinguish content types (A-Story, B-Document, C-Narrative, D-Encyclopedia)
 * - Minor annotations (popout) → inline <Footnote> elements at anchor positions
 * - Major annotations (full) → separate callout Story + TextFrame on the entry's spread
 * - Images → <Rectangle> + <Image> + <Link> elements on the entry's spread
 *
 * Pages are pre-created with threaded text frames per entry. Page count is
 * estimated per-entry with a 30% buffer — overallocation is preferred.
 */

import JSZip from 'jszip';
import type { PersistedEntity } from '../db/illuminatorDb';
import type { ChronicleRecord } from '../chronicleTypes';
import type { EraNarrativeRecord } from '../eraNarrativeTypes';
import type { HistorianNote } from '../historianTypes';
import { isNoteActive, noteDisplay } from '../historianTypes';
import { resolveAnchorPhrase } from '../fuzzyAnchor';
import type { ContentTreeState, ExportImageEntry, IdmlLayoutOptions } from './prePrintTypes';
import { IDML_PAGE_PRESETS, DEFAULT_IDML_LAYOUT } from './prePrintTypes';
import type { ImageMetadataRecord } from './prePrintStats';
import { flattenForExport } from './contentTree';
import {
  escapeXml,
  renderParagraphs,
  PARAGRAPH_STYLE_DEFS,
  CHARACTER_STYLE_DEFS,
  entityToIcmlParagraphs,
  chronicleToIcmlParagraphs,
  eraNarrativeToIcmlParagraphs,
  staticPageToIcmlParagraphs,
  createImageRegistrar,
  plainPara,
  PS_SECTION_HEADING,
  PS_ERA_HEADING,
  PS_FOOTNOTE_TEXT,
  PS_CALLOUT_BODY,
  PS_HISTORIAN_NOTE,
  PS_HEADING2,
  CS_BOLD,
  CS_NONE,
} from './icmlExport';
import type {
  ContentMaps,
  ParagraphStyleDef,
  CharacterStyleDef,
  IcmlParagraph,
} from './icmlExport';

// =============================================================================
// Constants
// =============================================================================

const DOM_VERSION = '8.0'; // CS4+ compatibility

// Self IDs
const ID_LAYER = 'uc5';
const ID_SECTION = 'uc9';

// Master spread IDs — one per content type
const MASTERS = {
  A: { spreadId: 'mA', leftPage: 'mA_L', rightPage: 'mA_R', leftFrame: 'mA_fL', rightFrame: 'mA_fR', storyId: 'mA_s', name: 'A-Story', prefix: 'A', base: 'Story' },
  B: { spreadId: 'mB', leftPage: 'mB_L', rightPage: 'mB_R', leftFrame: 'mB_fL', rightFrame: 'mB_fR', storyId: 'mB_s', name: 'B-Document', prefix: 'B', base: 'Document' },
  C: { spreadId: 'mC', leftPage: 'mC_L', rightPage: 'mC_R', leftFrame: 'mC_fL', rightFrame: 'mC_fR', storyId: 'mC_s', name: 'C-Narrative', prefix: 'C', base: 'Narrative' },
  D: { spreadId: 'mD', leftPage: 'mD_L', rightPage: 'mD_R', leftFrame: 'mD_fL', rightFrame: 'mD_fR', storyId: 'mD_s', name: 'D-Encyclopedia', prefix: 'D', base: 'Encyclopedia' },
} as const;

type MasterKey = keyof typeof MASTERS;

// =============================================================================
// Resolved Layout — computed from IdmlLayoutOptions
// =============================================================================

interface ResolvedLayout {
  pageWidth: number;
  pageHeight: number;
  marginTop: number;
  marginBottom: number;
  marginInside: number;
  marginOutside: number;
  textWidth: number;
  textHeight: number;
  linesPerPage: number;
  frameTy: number;
  rectoFrameTx: number;
  versoFrameTx: number;
  columnCount: number;
  columnGutter: number;
  fontFamily: string;
  bodySize: number;
  bodyLeading: number;
  paragraphSpacing: number;
}

function resolveLayout(options?: IdmlLayoutOptions): ResolvedLayout {
  const opts = options ?? DEFAULT_IDML_LAYOUT;
  const preset = IDML_PAGE_PRESETS[opts.pagePreset] ?? IDML_PAGE_PRESETS['trade-6x9'];

  const pageWidth = preset.widthIn * 72;
  const pageHeight = preset.heightIn * 72;
  const marginTop = preset.margins.top * 72;
  const marginBottom = preset.margins.bottom * 72;
  const marginInside = preset.margins.inside * 72;
  const marginOutside = preset.margins.outside * 72;
  const textWidth = pageWidth - marginInside - marginOutside;
  const textHeight = pageHeight - marginTop - marginBottom;

  return {
    pageWidth,
    pageHeight,
    marginTop,
    marginBottom,
    marginInside,
    marginOutside,
    textWidth,
    textHeight,
    linesPerPage: Math.floor(textHeight / opts.bodyLeading),
    frameTy: -(pageHeight / 2) + marginTop,
    rectoFrameTx: marginInside,
    versoFrameTx: -(pageWidth - marginOutside),
    columnCount: opts.columnCount,
    columnGutter: opts.columnGutter,
    fontFamily: opts.fontFamily,
    bodySize: opts.bodySize,
    bodyLeading: opts.bodyLeading,
    paragraphSpacing: opts.paragraphSpacing,
  };
}

// =============================================================================
// Types
// =============================================================================

interface StoryFile {
  filename: string;
  xml: string;
  storyId: string;
}

interface SpreadFile {
  filename: string;
  xml: string;
}

/** Footnote to be inserted inline at an anchor position */
interface FootnoteInsert {
  anchorPhrase: string;
  noteText: string;
  noteType: string;
}

/** Image to be placed as a Rectangle on the entry's spread */
interface ImagePlacement {
  imageId: string;
  filename: string;
}

// =============================================================================
// Page Count Estimation (per entry)
// =============================================================================

function estimateEntryPages(paragraphs: IcmlParagraph[], imageCount: number, linesPerPage: number): number {
  let totalLines = 0;

  for (const para of paragraphs) {
    const textLen = para.runs.reduce((sum, r) => sum + r.text.length, 0);
    const style = para.paraStyle;

    let charsPerLine: number;
    let extraLines: number;

    if (style === 'SectionHeading') {
      charsPerLine = 18;
      extraLines = 5;
    } else if (style === 'EraHeading') {
      charsPerLine = 22;
      extraLines = 3;
    } else if (style === 'ItemTitle') {
      charsPerLine = 28;
      extraLines = 2;
    } else if (style === 'ItemSubtitle') {
      charsPerLine = 38;
      extraLines = 1;
    } else if (style === 'ItemSeparator') {
      charsPerLine = 50;
      extraLines = 3;
    } else if (style === 'Blockquote' || style === 'HistorianNote') {
      charsPerLine = 42;
      extraLines = 0.8;
    } else if (style === 'Heading1') {
      charsPerLine = 30;
      extraLines = 2;
    } else if (style === 'Heading2' || style === 'Heading3') {
      charsPerLine = 35;
      extraLines = 1.5;
    } else {
      charsPerLine = 52;
      extraLines = 0.4;
    }

    totalLines += Math.max(1, Math.ceil(textLen / charsPerLine)) + extraLines;
  }

  // Each image takes roughly 8 lines of space
  totalLines += imageCount * 8;

  const estimated = Math.ceil(totalLines / linesPerPage);
  // Minimum 2 pages, add 30% buffer, round up to even for facing pages
  const buffered = Math.max(2, Math.ceil(estimated * 1.3));
  return buffered % 2 === 0 ? buffered : buffered + 1;
}

// =============================================================================
// File: mimetype
// =============================================================================

const MIMETYPE = 'application/vnd.adobe.indesign-idml-package';

// =============================================================================
// File: META-INF/container.xml
// =============================================================================

function buildContainerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="designmap.xml" media-type="text/xml" />
  </rootfiles>
</container>`;
}

// =============================================================================
// File: designmap.xml
// =============================================================================

function buildDesignmap(
  masterSpreads: { spreadId: string; filename: string }[],
  spreads: SpreadFile[],
  stories: StoryFile[],
  masterStoryIds: string[],
  totalPageCount: number,
): string {
  const masterRefs = masterSpreads
    .map((ms) => `  <idPkg:MasterSpread src="${ms.filename}" />`)
    .join('\n');

  const spreadRefs = spreads
    .map((s) => `  <idPkg:Spread src="${s.filename}" />`)
    .join('\n');

  // All stories: entry stories + callout stories + master stories
  const allStoryIds = [
    ...stories.map((s) => s.storyId),
    ...masterStoryIds,
  ];
  const storyRefs = stories
    .map((s) => `  <idPkg:Story src="${s.filename}" />`)
    .join('\n');
  const masterStoryRefs = masterStoryIds
    .map((id) => `  <idPkg:Story src="Stories/Story_${id}.xml" />`)
    .join('\n');

  const storyListStr = allStoryIds.join(' ');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?aid style="50" type="document" readerVersion="6.0" featureSet="257" product="8.0(370)" ?>
<Document xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"
    DOMVersion="${DOM_VERSION}"
    Self="d"
    StoryList="${storyListStr}"
    Name=""
    ZeroPoint="0 0"
    ActiveLayer="${ID_LAYER}">

  <Language Self="Language/$ID/English%3a USA"
      Name="$ID/English: USA"
      SingleQuotes="&#x2018;&#x2019;"
      DoubleQuotes="&#x201c;&#x201d;"
      PrimaryLanguageName="$ID/English"
      SublanguageName="$ID/USA"
      Id="269"
      HyphenationVendor="Hunspell"
      SpellingVendor="Hunspell" />

  <idPkg:Graphic src="Resources/Graphic.xml" />
  <idPkg:Fonts src="Resources/Fonts.xml" />
  <idPkg:Styles src="Resources/Styles.xml" />
  <idPkg:Preferences src="Resources/Preferences.xml" />

  <Layer Self="${ID_LAYER}" Name="Layer 1" Visible="true" Locked="false"
      IgnoreWrap="false" ShowGuides="true" LockGuides="false"
      UI="true" Expendable="true" Printable="true" />

${masterRefs}
${spreadRefs}

  <Section Self="${ID_SECTION}" Length="${totalPageCount}" Name="" AutomaticNumbering="true"
      IncludeSectionPrefix="false" Marker=""
      PageNumberStart="1" SectionPrefix=""
      PageNumberStyle="Arabic"
      ContinueNumbering="false" />

${storyRefs}
${masterStoryRefs}

  <idPkg:BackingStory src="XML/BackingStory.xml" />
  <idPkg:Tags src="XML/Tags.xml" />

</Document>`;
}

// =============================================================================
// File: Resources/Styles.xml
// =============================================================================

function buildIdmlCharacterStyle(def: CharacterStyleDef): string {
  const selfId = `CharacterStyle/${def.name}`;
  let attrs = `Self="${selfId}" Name="${def.name}"`;
  if (def.fontStyle) attrs += ` FontStyle="${def.fontStyle}"`;
  if (def.position) attrs += ` Position="${def.position}"`;

  if (def.appliedFont) {
    return `    <CharacterStyle ${attrs}>
      <Properties><AppliedFont type="string">${def.appliedFont}</AppliedFont></Properties>
    </CharacterStyle>`;
  }
  return `    <CharacterStyle ${attrs} />`;
}

function buildIdmlParagraphStyle(def: ParagraphStyleDef): string {
  return `    <ParagraphStyle Self="ParagraphStyle/${def.name}" Name="${def.name}"
        PointSize="${def.pointSize}" FontStyle="${def.fontStyle}"
        Justification="${def.justification}"
        FirstLineIndent="${def.firstLineIndent}"
        LeftIndent="${def.leftIndent}" RightIndent="${def.rightIndent}"
        SpaceBefore="${def.spaceBefore}" SpaceAfter="${def.spaceAfter}"
        Hyphenation="${def.justification.includes('Justified') ? 'true' : 'false'}">
      <Properties>
        <BasedOn type="string">$ID/NormalParagraphStyle</BasedOn>
        <AppliedFont type="string">${def.appliedFont}</AppliedFont>
        <Leading type="unit">${def.leading}</Leading>
      </Properties>
    </ParagraphStyle>`;
}

/** Scale paragraph style definitions based on layout options. */
function scaleParaStyles(defs: ParagraphStyleDef[], layout: ResolvedLayout): ParagraphStyleDef[] {
  const sizeScale = layout.bodySize / 11;
  const leadingScale = layout.bodyLeading / 14;
  const sp = layout.paragraphSpacing;

  return defs.map((def) => {
    // Don't override Courier New / Segoe UI Symbol styles
    const font = def.appliedFont === 'Courier New' ? 'Courier New' : layout.fontFamily;
    return {
      ...def,
      pointSize: Math.round(def.pointSize * sizeScale * 10) / 10,
      leading: Math.round(def.leading * leadingScale * 10) / 10,
      spaceBefore: Math.round(def.spaceBefore * sp * 10) / 10,
      spaceAfter: Math.round(def.spaceAfter * sp * 10) / 10,
      appliedFont: font,
    };
  });
}

function buildStylesXml(layout: ResolvedLayout): string {
  const charStyles = CHARACTER_STYLE_DEFS.map(buildIdmlCharacterStyle);
  const scaledParaDefs = scaleParaStyles(PARAGRAPH_STYLE_DEFS, layout);
  const paraStyles = scaledParaDefs.map(buildIdmlParagraphStyle);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Styles xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"
    DOMVersion="${DOM_VERSION}">

  <RootCharacterStyleGroup Self="u79">
    <CharacterStyle Self="CharacterStyle/$ID/[No character style]"
        Name="[No character style]" />
${charStyles.join('\n')}
  </RootCharacterStyleGroup>

  <RootParagraphStyleGroup Self="u78">
    <ParagraphStyle Self="ParagraphStyle/$ID/NormalParagraphStyle"
        Name="[No paragraph style]"
        PointSize="12" FontStyle="Regular"
        Justification="LeftAlign" Hyphenation="true"
        FirstLineIndent="0" LeftIndent="0" RightIndent="0"
        SpaceBefore="0" SpaceAfter="0">
      <Properties>
        <AppliedFont type="string">${layout.fontFamily}</AppliedFont>
        <Leading type="unit">14.4</Leading>
      </Properties>
    </ParagraphStyle>
${paraStyles.join('\n')}
  </RootParagraphStyleGroup>

  <RootObjectStyleGroup Self="u93">
    <ObjectStyle Self="ObjectStyle/$ID/[None]" Name="[None]" />
    <ObjectStyle Self="ObjectStyle/$ID/[Normal Graphics Frame]"
        Name="[Normal Graphics Frame]" />
    <ObjectStyle Self="ObjectStyle/$ID/[Normal Text Frame]"
        Name="[Normal Text Frame]" />
    <ObjectStyle Self="ObjectStyle/$ID/[Normal Grid]"
        Name="[Normal Grid]" />
  </RootObjectStyleGroup>

  <RootCellStyleGroup Self="u88">
    <CellStyle Self="CellStyle/$ID/[None]" Name="[None]" />
  </RootCellStyleGroup>

  <RootTableStyleGroup Self="u8a">
    <TableStyle Self="TableStyle/$ID/[No table style]"
        Name="[No table style]" />
    <TableStyle Self="TableStyle/$ID/[Basic Table]"
        Name="[Basic Table]" />
  </RootTableStyleGroup>

</idPkg:Styles>`;
}

// =============================================================================
// File: Resources/Preferences.xml
// =============================================================================

function buildPreferencesXml(layout: ResolvedLayout): string {
  const colPositions = layout.columnCount === 1
    ? `0 ${layout.textWidth}`
    : `0 ${(layout.textWidth - layout.columnGutter) / 2} ${(layout.textWidth + layout.columnGutter) / 2} ${layout.textWidth}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Preferences xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"
    DOMVersion="${DOM_VERSION}">

  <DocumentPreference Self="DocumentPreference/"
      PageHeight="${layout.pageHeight}"
      PageWidth="${layout.pageWidth}"
      PagesPerDocument="1"
      FacingPages="true"
      DocumentBleedTopOffset="0"
      DocumentBleedBottomOffset="0"
      DocumentBleedInsideOrLeftOffset="0"
      DocumentBleedOutsideOrRightOffset="0"
      DocumentBleedUniformSize="true"
      PageBinding="LeftToRight"
      AllowPageShuffle="true"
      OverprintBlack="true"
      ColumnDirection="Horizontal"
      Intent="PrintIntent" />

  <MarginPreference Self="MarginPreference/"
      ColumnCount="${layout.columnCount}"
      ColumnGutter="${layout.columnGutter}"
      Top="${layout.marginTop}"
      Bottom="${layout.marginBottom}"
      Left="${layout.marginInside}"
      Right="${layout.marginOutside}"
      ColumnDirection="Horizontal"
      ColumnsPositions="${colPositions}" />

  <TextPreference Self="TextPreference/"
      SmartTextReflow="true"
      AddPages="EndOfStory"
      LimitToMasterTextFrames="true"
      PreserveFacingPageSpreads="false"
      DeleteEmptyPages="true"
      TypographersQuotes="true"
      UseOpticalSize="true"
      UseParagraphLeading="false"
      SuperscriptSize="58.3"
      SuperscriptPosition="33.3"
      SubscriptSize="58.3"
      SubscriptPosition="33.3"
      SmallCap="70"
      ScalingAdjustsText="false" />

  <TextDefault Self="TextDefault/"
      AppliedParagraphStyle="ParagraphStyle/$ID/NormalParagraphStyle"
      AppliedCharacterStyle="CharacterStyle/$ID/[No character style]"
      PointSize="12" FontStyle="Regular" Hyphenation="true"
      Justification="LeftAlign" FirstLineIndent="0"
      LeftIndent="0" RightIndent="0" SpaceBefore="0" SpaceAfter="0">
    <Properties>
      <AppliedFont type="string">${layout.fontFamily}</AppliedFont>
      <Leading type="unit">14.4</Leading>
    </Properties>
  </TextDefault>

  <StoryPreference Self="StoryPreference/"
      OpticalMarginAlignment="true"
      OpticalMarginSize="12"
      FrameType="TextFrameType"
      StoryOrientation="Horizontal"
      StoryDirection="LeftToRightDirection" />

  <TextFramePreference Self="TextFramePreference/"
      TextColumnCount="${layout.columnCount}"
      TextColumnGutter="${layout.columnGutter}"
      AutoSizingType="Off"
      FirstBaselineOffset="LeadingOffset"
      MinimumFirstBaselineOffset="0"
      VerticalJustification="TopAlign"
      IgnoreWrap="false" />

</idPkg:Preferences>`;
}

// =============================================================================
// File: Resources/Graphic.xml
// =============================================================================

function buildGraphicXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Graphic xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"
    DOMVersion="${DOM_VERSION}">

  <Color Self="Color/Black" Model="Process" Space="CMYK"
      ColorValue="0 0 0 100" ColorOverride="SpecialBlack"
      AlternateSpace="NoAlternateColor" AlternateColorValue=""
      Name="Black" ColorEditable="false" ColorRemovable="false" Visible="true" />

  <Color Self="Color/Paper" Model="Process" Space="CMYK"
      ColorValue="0 0 0 0" ColorOverride="SpecialPaper"
      AlternateSpace="NoAlternateColor" AlternateColorValue=""
      Name="Paper" ColorEditable="true" ColorRemovable="false" Visible="true" />

  <Color Self="Color/Registration" Model="Registration" Space="CMYK"
      ColorValue="100 100 100 100" ColorOverride="SpecialRegistration"
      AlternateSpace="NoAlternateColor" AlternateColorValue=""
      Name="Registration" ColorEditable="false" ColorRemovable="false" Visible="false" />

  <Swatch Self="Swatch/None" Name="[None]"
      ColorEditable="false" ColorRemovable="false" Visible="true" />
  <Swatch Self="Color/Black" Name="Black" />
  <Swatch Self="Color/Paper" Name="Paper" />
  <Swatch Self="Color/Registration" Name="Registration" />

  <Ink Self="Ink/Cyan" Name="Cyan" Angle="75" Frequency="70"
      InkType="Normal" NeutralDensity="0.61" PrintInk="true"
      TrapOrder="1" IsProcessInk="true" />
  <Ink Self="Ink/Magenta" Name="Magenta" Angle="15" Frequency="70"
      InkType="Normal" NeutralDensity="0.76" PrintInk="true"
      TrapOrder="2" IsProcessInk="true" />
  <Ink Self="Ink/Yellow" Name="Yellow" Angle="0" Frequency="70"
      InkType="Normal" NeutralDensity="0.16" PrintInk="true"
      TrapOrder="3" IsProcessInk="true" />
  <Ink Self="Ink/Black" Name="Black" Angle="45" Frequency="70"
      InkType="Normal" NeutralDensity="1.7" PrintInk="true"
      TrapOrder="4" IsProcessInk="true" />

  <StrokeStyle Self="StrokeStyle/$ID/Solid" Name="$ID/Solid" />

</idPkg:Graphic>`;
}

// =============================================================================
// File: Resources/Fonts.xml
// =============================================================================

function buildFontsXml(fontFamily: string): string {
  // Generate a safe XML ID from the font name
  const fontId = 'di4a';
  const safeFont = escapeXml(fontFamily);

  // Build the primary font family declaration — InDesign resolves the actual
  // font from what's installed on the machine. We declare all four styles.
  const primaryFontFamily = `  <FontFamily Self="${fontId}" Name="${safeFont}">
    <Font Self="${fontId}FontnRegular"
        FontFamily="${safeFont}" Name="${safeFont}"
        PostScriptName="${fontFamily.replace(/\s+/g, '-')}-Regular"
        FontStyleName="Regular" FontType="OpenTypeTrueType"
        WritingScript="0" FullName="${safeFont} Regular"
        FullNameNative="${safeFont} Regular"
        FontStyleNameNative="Regular" />
    <Font Self="${fontId}FontnBold"
        FontFamily="${safeFont}" Name="${safeFont} Bold"
        PostScriptName="${fontFamily.replace(/\s+/g, '-')}-Bold"
        FontStyleName="Bold" FontType="OpenTypeTrueType"
        WritingScript="0" FullName="${safeFont} Bold"
        FullNameNative="${safeFont} Bold"
        FontStyleNameNative="Bold" />
    <Font Self="${fontId}FontnItalic"
        FontFamily="${safeFont}" Name="${safeFont} Italic"
        PostScriptName="${fontFamily.replace(/\s+/g, '-')}-Italic"
        FontStyleName="Italic" FontType="OpenTypeTrueType"
        WritingScript="0" FullName="${safeFont} Italic"
        FullNameNative="${safeFont} Italic"
        FontStyleNameNative="Italic" />
    <Font Self="${fontId}FontnBoldItalic"
        FontFamily="${safeFont}" Name="${safeFont} Bold Italic"
        PostScriptName="${fontFamily.replace(/\s+/g, '-')}-BoldItalic"
        FontStyleName="Bold Italic" FontType="OpenTypeTrueType"
        WritingScript="0" FullName="${safeFont} Bold Italic"
        FullNameNative="${safeFont} Bold Italic"
        FontStyleNameNative="Bold Italic" />
  </FontFamily>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Fonts xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"
    DOMVersion="${DOM_VERSION}">

${primaryFontFamily}

  <FontFamily Self="di4b" Name="Courier New">
    <Font Self="di4bFontnRegular"
        FontFamily="Courier New" Name="Courier New"
        PostScriptName="CourierNewPSMT"
        FontStyleName="Regular" FontType="TrueType"
        WritingScript="0" FullName="Courier New"
        FullNameNative="Courier New"
        FontStyleNameNative="Regular" />
  </FontFamily>

  <FontFamily Self="di4c" Name="Segoe UI Symbol">
    <Font Self="di4cFontnRegular"
        FontFamily="Segoe UI Symbol" Name="Segoe UI Symbol"
        PostScriptName="SegoeUISymbol"
        FontStyleName="Regular" FontType="TrueType"
        WritingScript="0" FullName="Segoe UI Symbol"
        FullNameNative="Segoe UI Symbol"
        FontStyleNameNative="Regular" />
  </FontFamily>

</idPkg:Fonts>`;
}

// =============================================================================
// Geometry Helpers
// =============================================================================

function buildPathGeometry(width: number, height: number): string {
  return `      <Properties>
        <PathGeometry>
          <GeometryPathType PathOpen="false">
            <PathPointArray>
              <PathPointType Anchor="0 0" LeftDirection="0 0" RightDirection="0 0" />
              <PathPointType Anchor="0 ${height}" LeftDirection="0 ${height}" RightDirection="0 ${height}" />
              <PathPointType Anchor="${width} ${height}" LeftDirection="${width} ${height}" RightDirection="${width} ${height}" />
              <PathPointType Anchor="${width} 0" LeftDirection="${width} 0" RightDirection="${width} 0" />
            </PathPointArray>
          </GeometryPathType>
        </PathGeometry>
      </Properties>`;
}

// =============================================================================
// Master Spreads (4 masters: A through D)
// =============================================================================

function buildMasterSpreadXml(master: typeof MASTERS[MasterKey], layout: ResolvedLayout): string {
  const colPositions = layout.columnCount === 1
    ? `0 ${layout.textWidth}`
    : `0 ${(layout.textWidth - layout.columnGutter) / 2} ${(layout.textWidth + layout.columnGutter) / 2} ${layout.textWidth}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:MasterSpread xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"
    DOMVersion="${DOM_VERSION}">

  <MasterSpread Self="${master.spreadId}"
      Name="${master.name}" NamePrefix="${master.prefix}" BaseName="${master.base}"
      ShowMasterItems="true" PageCount="2"
      ItemTransform="1 0 0 1 0 0">

    <Page Self="${master.leftPage}"
        GeometricBounds="0 0 ${layout.pageHeight} ${layout.pageWidth}"
        ItemTransform="1 0 0 1 ${-layout.pageWidth} ${-(layout.pageHeight / 2)}"
        Name="L" AppliedMaster="n" OverrideList=""
        MasterPageTransform="1 0 0 1 0 0">
      <MarginPreference ColumnCount="${layout.columnCount}" ColumnGutter="${layout.columnGutter}"
          Top="${layout.marginTop}" Bottom="${layout.marginBottom}"
          Left="${layout.marginOutside}" Right="${layout.marginInside}"
          ColumnDirection="Horizontal"
          ColumnsPositions="${colPositions}" />
    </Page>

    <Page Self="${master.rightPage}"
        GeometricBounds="0 0 ${layout.pageHeight} ${layout.pageWidth}"
        ItemTransform="1 0 0 1 0 ${-(layout.pageHeight / 2)}"
        Name="R" AppliedMaster="n" OverrideList=""
        MasterPageTransform="1 0 0 1 0 0">
      <MarginPreference ColumnCount="${layout.columnCount}" ColumnGutter="${layout.columnGutter}"
          Top="${layout.marginTop}" Bottom="${layout.marginBottom}"
          Left="${layout.marginInside}" Right="${layout.marginOutside}"
          ColumnDirection="Horizontal"
          ColumnsPositions="${colPositions}" />
    </Page>

    <TextFrame Self="${master.leftFrame}"
        ParentStory="${master.storyId}"
        PreviousTextFrame="n"
        NextTextFrame="${master.rightFrame}"
        ContentType="TextType"
        AppliedObjectStyle="ObjectStyle/$ID/[Normal Text Frame]"
        ItemLayer="${ID_LAYER}"
        Visible="true"
        Name="$ID/"
        ItemTransform="1 0 0 1 ${layout.versoFrameTx} ${layout.frameTy}">
${buildPathGeometry(layout.textWidth, layout.textHeight)}
      <TextFramePreference TextColumnCount="${layout.columnCount}" />
    </TextFrame>

    <TextFrame Self="${master.rightFrame}"
        ParentStory="${master.storyId}"
        PreviousTextFrame="${master.leftFrame}"
        NextTextFrame="n"
        ContentType="TextType"
        AppliedObjectStyle="ObjectStyle/$ID/[Normal Text Frame]"
        ItemLayer="${ID_LAYER}"
        Visible="true"
        Name="$ID/"
        ItemTransform="1 0 0 1 ${layout.rectoFrameTx} ${layout.frameTy}">
${buildPathGeometry(layout.textWidth, layout.textHeight)}
      <TextFramePreference TextColumnCount="${layout.columnCount}" />
    </TextFrame>

  </MasterSpread>
</idPkg:MasterSpread>`;
}

function buildMasterStoryXml(storyId: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Story xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"
    DOMVersion="${DOM_VERSION}">

  <Story Self="${storyId}"
      UserText="false"
      IsEndnoteStory="false"
      AppliedTOCStyle="n"
      TrackChanges="false"
      StoryTitle="$ID/"
      AppliedNamedGrid="n">
    <ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/$ID/NormalParagraphStyle">
      <CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]">
        <Content>&#xFEFF;</Content>
      </CharacterStyleRange>
    </ParagraphStyleRange>
  </Story>
</idPkg:Story>`;
}

// =============================================================================
// Story XML Generation (per entry)
// =============================================================================

/**
 * Build a footnote XML element for inline insertion.
 * The footnote wraps the note text in FootnoteText paragraph style.
 */
function buildFootnoteXml(noteType: string, noteText: string): string {
  const typeLabel = noteType.charAt(0).toUpperCase() + noteType.slice(1);
  const content = escapeXml(`[${typeLabel}] ${noteText}`);
  return `<Footnote>
        <ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/${PS_FOOTNOTE_TEXT}">
          <CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]">
            <Content>${content}</Content>
          </CharacterStyleRange>
        </ParagraphStyleRange>
      </Footnote>`;
}

/**
 * Render paragraphs to XML, splicing inline footnotes at their anchor positions.
 *
 * For each footnote, we search for its anchor phrase in the paragraph text.
 * When found, we split the Content at the anchor end and insert <Footnote>.
 * Unmatched footnotes are appended at the end of the last body paragraph.
 */
function renderParagraphsWithFootnotes(
  paras: IcmlParagraph[],
  footnotes: FootnoteInsert[],
): string {
  if (footnotes.length === 0) {
    return renderParagraphs(paras);
  }

  // Build a map of full text per paragraph for anchor matching
  const paraTexts = paras.map((p) =>
    p.runs.map((r) => r.text).join('')
  );

  // Track which footnotes have been placed
  const placed = new Set<number>();
  // Map: paraIndex → list of { charOffset (in full text), footnoteIdx }
  const placements = new Map<number, { charOffset: number; fnIdx: number }[]>();

  for (let fnIdx = 0; fnIdx < footnotes.length; fnIdx++) {
    const fn = footnotes[fnIdx];
    // Search through paragraphs for the anchor phrase
    for (let pIdx = 0; pIdx < paraTexts.length; pIdx++) {
      const resolved = resolveAnchorPhrase(fn.anchorPhrase, paraTexts[pIdx]);
      if (resolved) {
        const insertAt = resolved.index + fn.anchorPhrase.length;
        if (!placements.has(pIdx)) placements.set(pIdx, []);
        placements.get(pIdx)!.push({ charOffset: insertAt, fnIdx });
        placed.add(fnIdx);
        break;
      }
    }
  }

  // Render each paragraph, inserting footnotes where matched
  const renderedParas: string[] = [];

  for (let pIdx = 0; pIdx < paras.length; pIdx++) {
    const para = paras[pIdx];
    const fnPlacements = placements.get(pIdx);

    if (!fnPlacements || fnPlacements.length === 0) {
      // No footnotes in this paragraph — render normally
      renderedParas.push(renderSingleParagraph(para));
      continue;
    }

    // Sort footnote placements by offset (ascending) so we process left to right
    const sorted = [...fnPlacements].sort((a, b) => a.charOffset - b.charOffset);

    // Render paragraph with footnotes spliced in
    renderedParas.push(renderParagraphWithFootnotes(para, sorted, footnotes));
  }

  // Append unplaced footnotes at the very end as standalone footnote paragraphs
  const unplaced = footnotes.filter((_, i) => !placed.has(i));
  if (unplaced.length > 0 && renderedParas.length > 0) {
    // Insert unplaced footnotes after the last paragraph
    // We create a "footnotes collector" paragraph
    const fnParaRuns: string[] = [];
    fnParaRuns.push(`      <CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]">`);
    fnParaRuns.push(`        <Content> </Content>`);
    for (const fn of unplaced) {
      fnParaRuns.push(`        ${buildFootnoteXml(fn.noteType, fn.noteText)}`);
    }
    fnParaRuns.push(`      </CharacterStyleRange>`);

    renderedParas.push(`    <ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/Body">
${fnParaRuns.join('\n')}
    </ParagraphStyleRange>`);
  }

  return renderedParas.join('\n    <Br/>\n');
}

/**
 * Render a single paragraph (no footnotes) to XML.
 */
function renderSingleParagraph(para: IcmlParagraph): string {
  const lines: string[] = [];
  lines.push(`    <ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/${para.paraStyle}">`);
  for (const run of para.runs) {
    const csAttr = run.charStyle
      ? `CharacterStyle/${run.charStyle}`
      : `CharacterStyle/${CS_NONE}`;
    lines.push(`      <CharacterStyleRange AppliedCharacterStyle="${csAttr}"><Content>${escapeXml(run.text)}</Content></CharacterStyleRange>`);
  }
  lines.push('    </ParagraphStyleRange>');
  return lines.join('\n');
}

/**
 * Render a paragraph with footnotes spliced at specific character offsets.
 */
function renderParagraphWithFootnotes(
  para: IcmlParagraph,
  fnPlacements: { charOffset: number; fnIdx: number }[],
  allFootnotes: FootnoteInsert[],
): string {
  const lines: string[] = [];
  lines.push(`    <ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/${para.paraStyle}">`);

  // Walk through runs and insert footnotes at the right character offsets
  let globalCharPos = 0;
  let fnPlacementIdx = 0;

  for (const run of para.runs) {
    const csAttr = run.charStyle
      ? `CharacterStyle/${run.charStyle}`
      : `CharacterStyle/${CS_NONE}`;

    const runEnd = globalCharPos + run.text.length;

    // Check if any footnotes fall within this run
    const fnInRun: { localOffset: number; fnIdx: number }[] = [];
    while (fnPlacementIdx < fnPlacements.length && fnPlacements[fnPlacementIdx].charOffset <= runEnd) {
      fnInRun.push({
        localOffset: fnPlacements[fnPlacementIdx].charOffset - globalCharPos,
        fnIdx: fnPlacements[fnPlacementIdx].fnIdx,
      });
      fnPlacementIdx++;
    }

    if (fnInRun.length === 0) {
      // No footnotes in this run — render normally
      lines.push(`      <CharacterStyleRange AppliedCharacterStyle="${csAttr}"><Content>${escapeXml(run.text)}</Content></CharacterStyleRange>`);
    } else {
      // Split run text at footnote positions
      let lastPos = 0;
      for (const { localOffset, fnIdx } of fnInRun) {
        const fn = allFootnotes[fnIdx];
        // Text before footnote
        const beforeText = run.text.slice(lastPos, localOffset);
        if (beforeText) {
          lines.push(`      <CharacterStyleRange AppliedCharacterStyle="${csAttr}">`);
          lines.push(`        <Content>${escapeXml(beforeText)}</Content>`);
          lines.push(`        ${buildFootnoteXml(fn.noteType, fn.noteText)}`);
          lines.push(`      </CharacterStyleRange>`);
        } else {
          // Footnote at the very start of a run — attach to previous or emit standalone
          lines.push(`      <CharacterStyleRange AppliedCharacterStyle="${csAttr}">`);
          lines.push(`        <Content> </Content>`);
          lines.push(`        ${buildFootnoteXml(fn.noteType, fn.noteText)}`);
          lines.push(`      </CharacterStyleRange>`);
        }
        lastPos = localOffset;
      }
      // Remaining text after last footnote
      const afterText = run.text.slice(lastPos);
      if (afterText) {
        lines.push(`      <CharacterStyleRange AppliedCharacterStyle="${csAttr}"><Content>${escapeXml(afterText)}</Content></CharacterStyleRange>`);
      }
    }

    globalCharPos = runEnd;
  }

  lines.push('    </ParagraphStyleRange>');
  return lines.join('\n');
}

/**
 * Build a complete Story XML file for an entry.
 */
function buildEntryStoryXml(
  storyId: string,
  paragraphs: IcmlParagraph[],
  footnotes: FootnoteInsert[],
): string {
  const content = renderParagraphsWithFootnotes(paragraphs, footnotes);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Story xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"
    DOMVersion="${DOM_VERSION}">

  <Story Self="${storyId}"
      UserText="true"
      IsEndnoteStory="false"
      AppliedTOCStyle="n"
      TrackChanges="false"
      StoryTitle="$ID/"
      AppliedNamedGrid="n">

    <StoryPreference OpticalMarginAlignment="true"
        OpticalMarginSize="12"
        FrameType="TextFrameType"
        StoryOrientation="Horizontal"
        StoryDirection="LeftToRightDirection" />
    <InCopyExportOption IncludeGraphicProxies="true"
        IncludeAllResources="false" />

${content}
  </Story>
</idPkg:Story>`;
}

/**
 * Build a callout Story XML — a small story for a single major historian note.
 */
function buildCalloutStoryXml(storyId: string, noteType: string, noteText: string, anchorPhrase: string): string {
  const typeLabel = noteType.charAt(0).toUpperCase() + noteType.slice(1);
  const content = escapeXml(`[${typeLabel}] ${noteText}`);
  const anchor = escapeXml(`\u2014 \u201C${anchorPhrase}\u201D`);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Story xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"
    DOMVersion="${DOM_VERSION}">

  <Story Self="${storyId}"
      UserText="true"
      IsEndnoteStory="false"
      AppliedTOCStyle="n"
      TrackChanges="false"
      StoryTitle="$ID/"
      AppliedNamedGrid="n">

    <ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/${PS_CALLOUT_BODY}">
      <CharacterStyleRange AppliedCharacterStyle="CharacterStyle/${CS_BOLD}">
        <Content>${escapeXml(`[${typeLabel}]`)}</Content>
      </CharacterStyleRange>
      <CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]">
        <Content> ${content}</Content>
      </CharacterStyleRange>
    </ParagraphStyleRange>
    <Br/>
    <ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/${PS_CALLOUT_BODY}">
      <CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]">
        <Content>${anchor}</Content>
      </CharacterStyleRange>
    </ParagraphStyleRange>
  </Story>
</idPkg:Story>`;
}

// =============================================================================
// Spread Generation (per entry)
// =============================================================================

/** Build a page XML element within a spread. */
function buildPage(
  pageId: string,
  pageNumber: number,
  isRecto: boolean,
  masterId: string,
  layout: ResolvedLayout,
): string {
  const pageTx = isRecto ? 0 : -layout.pageWidth;
  const pageTy = -(layout.pageHeight / 2);
  const leftMargin = isRecto ? layout.marginInside : layout.marginOutside;
  const rightMargin = isRecto ? layout.marginOutside : layout.marginInside;
  const colPositions = layout.columnCount === 1
    ? `0 ${layout.textWidth}`
    : `0 ${(layout.textWidth - layout.columnGutter) / 2} ${(layout.textWidth + layout.columnGutter) / 2} ${layout.textWidth}`;

  return `    <Page Self="${pageId}"
        GeometricBounds="0 0 ${layout.pageHeight} ${layout.pageWidth}"
        ItemTransform="1 0 0 1 ${pageTx} ${pageTy}"
        Name="${pageNumber}"
        AppliedMaster="${masterId}"
        OverrideList=""
        MasterPageTransform="1 0 0 1 0 0"
        GridStartingPoint="TopOutside"
        TabOrder="">
      <MarginPreference ColumnCount="${layout.columnCount}" ColumnGutter="${layout.columnGutter}"
          Top="${layout.marginTop}" Bottom="${layout.marginBottom}"
          Left="${leftMargin}" Right="${rightMargin}"
          ColumnDirection="Horizontal"
          ColumnsPositions="${colPositions}" />
    </Page>`;
}

/** Build a text frame XML element for a spread. */
function buildTextFrame(
  frameId: string,
  storyId: string,
  prevFrameId: string,
  nextFrameId: string,
  isRecto: boolean,
  layout: ResolvedLayout,
): string {
  const tx = isRecto ? layout.rectoFrameTx : layout.versoFrameTx;
  return `    <TextFrame Self="${frameId}"
        ParentStory="${storyId}"
        PreviousTextFrame="${prevFrameId}"
        NextTextFrame="${nextFrameId}"
        ContentType="TextType"
        AppliedObjectStyle="ObjectStyle/$ID/[Normal Text Frame]"
        ItemLayer="${ID_LAYER}"
        Visible="true"
        Name="$ID/"
        ItemTransform="1 0 0 1 ${tx} ${layout.frameTy}">
${buildPathGeometry(layout.textWidth, layout.textHeight)}
      <TextFramePreference TextColumnCount="${layout.columnCount}" />
    </TextFrame>`;
}

/** Build an image Rectangle element with linked image. */
function buildImageRectangle(imageId: string, filename: string, yOffset: number, layout: ResolvedLayout): string {
  const imgWidth = 200;
  const imgHeight = 200;

  return `    <Rectangle Self="img_${imageId}"
        ItemLayer="${ID_LAYER}"
        Visible="true"
        Name="${escapeXml(filename)}"
        AppliedObjectStyle="ObjectStyle/$ID/[Normal Graphics Frame]"
        ItemTransform="1 0 0 1 ${layout.pageWidth + 20} ${-layout.pageHeight / 2 + yOffset}">
${buildPathGeometry(imgWidth, imgHeight)}
      <Image Self="img_${imageId}_img" ItemTransform="1 0 0 1 0 0">
        <Link Self="link_${imageId}" LinkResourceURI="file:images/${escapeXml(filename)}"
            StoredState="Normal" LinkClassID="35906" LinkResourceFormat="$ID/" />
        <Properties>
          <Profile type="string">$ID/None</Profile>
          <GraphicBounds>0 0 ${imgHeight} ${imgWidth}</GraphicBounds>
        </Properties>
      </Image>
    </Rectangle>`;
}

/** Build a callout text frame linked to a callout story. */
function buildCalloutFrame(frameId: string, calloutStoryId: string, yOffset: number, layout: ResolvedLayout): string {
  const calloutWidth = 200;
  const calloutHeight = 100;

  return `    <TextFrame Self="${frameId}"
        ParentStory="${calloutStoryId}"
        PreviousTextFrame="n"
        NextTextFrame="n"
        ContentType="TextType"
        AppliedObjectStyle="ObjectStyle/$ID/[Normal Text Frame]"
        ItemLayer="${ID_LAYER}"
        Visible="true"
        Name="$ID/"
        ItemTransform="1 0 0 1 ${layout.pageWidth + 20} ${-layout.pageHeight / 2 + yOffset}">
${buildPathGeometry(calloutWidth, calloutHeight)}
      <TextFramePreference TextColumnCount="1" />
    </TextFrame>`;
}

/**
 * Build spread(s) for an entry. Returns spread files and the number of pages consumed.
 *
 * Each entry gets at least one 2-page spread (verso + recto).
 * If the entry needs more pages, additional spreads are chained.
 * Text frames within an entry are threaded to the same story.
 */
function buildEntrySpreads(
  entryId: string,
  storyId: string,
  masterId: string,
  pageCount: number,
  startPageNum: number,
  images: ImagePlacement[],
  calloutStories: { storyId: string }[],
  layout: ResolvedLayout,
): { spreads: SpreadFile[]; pagesUsed: number } {
  const spreads: SpreadFile[] = [];
  const frameIds: string[] = [];

  // Generate frame IDs for all pages
  for (let i = 0; i < pageCount; i++) {
    frameIds.push(`tf_${entryId}_${i}`);
  }

  let pageIdx = 0;
  let spreadNum = 0;

  // First spread might be a single recto if we're starting on an odd page
  // For simplicity, all entry spreads are 2-page facing spreads
  while (pageIdx < pageCount) {
    const spreadId = `sp_${entryId}_${spreadNum}`;
    const isFirstSpread = spreadNum === 0;
    const isLastSpread = pageIdx + 2 >= pageCount;
    const spreadPageCount = Math.min(2, pageCount - pageIdx);

    let pagesXml = '';
    let framesXml = '';
    let extrasXml = '';

    // Verso page (left)
    const versoPageNum = startPageNum + pageIdx;
    const versoPageId = `pg_${entryId}_${pageIdx}`;
    const versoFrameId = frameIds[pageIdx];
    const versoPrev = pageIdx > 0 ? frameIds[pageIdx - 1] : 'n';
    const versoNext = pageIdx + 1 < frameIds.length ? frameIds[pageIdx + 1] : 'n';

    pagesXml += buildPage(versoPageId, versoPageNum, false, masterId, layout);
    framesXml += buildTextFrame(versoFrameId, storyId, versoPrev, versoNext, false, layout);

    if (spreadPageCount === 2) {
      // Recto page (right)
      const rectoPageNum = startPageNum + pageIdx + 1;
      const rectoPageId = `pg_${entryId}_${pageIdx + 1}`;
      const rectoFrameId = frameIds[pageIdx + 1];
      const rectoPrev = versoFrameId;
      const rectoNext = pageIdx + 2 < frameIds.length ? frameIds[pageIdx + 2] : 'n';

      pagesXml += '\n\n' + buildPage(rectoPageId, rectoPageNum, true, masterId, layout);
      framesXml += '\n\n' + buildTextFrame(rectoFrameId, storyId, rectoPrev, rectoNext, true, layout);
    }

    // Add image rectangles and callout frames to the FIRST spread only
    if (isFirstSpread) {
      let yOffset = 0;
      for (const img of images) {
        extrasXml += '\n\n' + buildImageRectangle(img.imageId, img.filename, yOffset, layout);
        yOffset += 210; // Stack vertically with 10pt gap
      }

      for (let ci = 0; ci < calloutStories.length; ci++) {
        const cfId = `cf_${entryId}_${ci}`;
        extrasXml += '\n\n' + buildCalloutFrame(cfId, calloutStories[ci].storyId, yOffset, layout);
        yOffset += 110;
      }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Spread xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"
    DOMVersion="${DOM_VERSION}">

  <Spread Self="${spreadId}"
      PageCount="${spreadPageCount}"
      BindingLocation="0"
      AllowPageShuffle="true"
      ItemTransform="1 0 0 1 0 0"
      PageTransitionType="None"
      PageTransitionDirection="NotApplicable"
      PageTransitionDuration="Medium">

    <FlattenerPreference Self="fp_${entryId}_${spreadNum}"
        LineArtAndTextResolution="300"
        GradientAndMeshResolution="150" />

${pagesXml}

${framesXml}
${extrasXml}

  </Spread>
</idPkg:Spread>`;

    spreads.push({ filename: `Spreads/Spread_${spreadId}.xml`, xml });
    pageIdx += spreadPageCount;
    spreadNum++;
  }

  return { spreads, pagesUsed: pageCount };
}

// =============================================================================
// XML Support Files
// =============================================================================

function buildBackingStoryXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:BackingStory xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"
    DOMVersion="${DOM_VERSION}">
  <XmlStory Self="uaa" UserText="true" IsEndnoteStory="false"
      AppliedTOCStyle="n" TrackChanges="false"
      StoryTitle="$ID/" AppliedNamedGrid="n">
    <ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/$ID/NormalParagraphStyle">
      <CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]">
        <XMLElement Self="di2" MarkupTag="XMLTag/Root" />
        <Content>&#xFEFF;</Content>
      </CharacterStyleRange>
    </ParagraphStyleRange>
  </XmlStory>
</idPkg:BackingStory>`;
}

function buildTagsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Tags xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"
    DOMVersion="${DOM_VERSION}">
  <XMLTag Self="XMLTag/Root" Name="Root">
    <Properties>
      <TagColor type="enumeration">LightBlue</TagColor>
    </Properties>
  </XMLTag>
</idPkg:Tags>`;
}

// =============================================================================
// Historian Note Handling for IDML
// =============================================================================

/**
 * Strip historian notes from the paragraph list.
 *
 * The ICML content formatters (entityToIcmlParagraphs, etc.) append historian
 * notes as HistorianNote-styled paragraphs at the end with a "Historian's Notes"
 * heading. In IDML, those notes are rendered as inline footnotes and callout
 * stories instead, so we strip them from the main story paragraphs to avoid
 * double-rendering.
 */
function stripHistorianNotes(paras: IcmlParagraph[]): IcmlParagraph[] {
  // Find the "Historian's Notes" heading (if any) and remove everything from there
  const headingIdx = paras.findIndex(
    (p) => p.paraStyle === PS_HEADING2 &&
      p.runs.length > 0 &&
      p.runs[0].text.includes('Historian') &&
      p.runs[0].text.includes('Notes')
  );

  if (headingIdx < 0) {
    // No heading found — just strip any stray HistorianNote paragraphs
    return paras.filter((p) => p.paraStyle !== PS_HISTORIAN_NOTE);
  }

  // Remove the heading and all subsequent HistorianNote paragraphs
  const result = paras.slice(0, headingIdx);
  // Keep any non-historian-note paragraphs that might follow (unlikely but safe)
  for (let i = headingIdx + 1; i < paras.length; i++) {
    if (paras[i].paraStyle !== PS_HISTORIAN_NOTE) {
      result.push(paras[i]);
    }
  }
  return result;
}

/** Extract footnotes (popout notes) and callouts (full notes) from historian notes */
function classifyHistorianNotes(notes: HistorianNote[] | undefined): {
  footnotes: FootnoteInsert[];
  callouts: { anchorPhrase: string; noteText: string; noteType: string }[];
} {
  const footnotes: FootnoteInsert[] = [];
  const callouts: { anchorPhrase: string; noteText: string; noteType: string }[] = [];

  if (!notes) return { footnotes, callouts };

  for (const note of notes) {
    if (!isNoteActive(note)) continue;
    const display = noteDisplay(note);

    if (display === 'popout') {
      footnotes.push({
        anchorPhrase: note.anchorPhrase,
        noteText: note.text,
        noteType: note.type,
      });
    } else if (display === 'full') {
      callouts.push({
        anchorPhrase: note.anchorPhrase,
        noteText: note.text,
        noteType: note.type,
      });
    }
  }

  return { footnotes, callouts };
}

// =============================================================================
// Image Tracking for Spreads
// =============================================================================

/**
 * Collect image references from a content entry for spread placement.
 * Returns ImagePlacement[] for Rectangle elements.
 */
function collectEntryImages(
  entry: PersistedEntity | ChronicleRecord | EraNarrativeRecord,
  imageMap: Map<string, ImageMetadataRecord>,
): ImagePlacement[] {
  const placements: ImagePlacement[] = [];

  function getExt(img?: ImageMetadataRecord): string {
    if (!img?.mimeType) return '.png';
    if (img.mimeType.includes('png')) return '.png';
    if (img.mimeType.includes('jpeg') || img.mimeType.includes('jpg')) return '.jpg';
    if (img.mimeType.includes('webp')) return '.webp';
    return '.png';
  }

  // Entity portrait
  if ('enrichment' in entry && entry.enrichment?.image?.imageId) {
    const imgId = entry.enrichment.image.imageId;
    const ext = getExt(imageMap.get(imgId));
    placements.push({ imageId: imgId, filename: `${imgId}${ext}` });
  }

  // Chronicle cover image
  if ('coverImage' in entry && entry.coverImage?.generatedImageId && entry.coverImage?.status === 'complete') {
    const imgId = entry.coverImage.generatedImageId;
    const ext = getExt(imageMap.get(imgId));
    placements.push({ imageId: imgId, filename: `${imgId}${ext}` });
  }

  // Chronicle/narrative inline image refs
  if ('imageRefs' in entry && entry.imageRefs?.refs) {
    for (const ref of entry.imageRefs.refs) {
      if (ref.type === 'prompt_request' && ref.status === 'complete' && ref.generatedImageId) {
        const imgId = ref.generatedImageId;
        if (!placements.some((p) => p.imageId === imgId)) {
          const ext = getExt(imageMap.get(imgId));
          placements.push({ imageId: imgId, filename: `${imgId}${ext}` });
        }
      } else if (ref.type === 'chronicle_ref' && ref.imageId) {
        const imgId = ref.imageId;
        if (!placements.some((p) => p.imageId === imgId)) {
          const ext = getExt(imageMap.get(imgId));
          placements.push({ imageId: imgId, filename: `${imgId}${ext}` });
        }
      }
    }
  }

  return placements;
}

// =============================================================================
// Master Spread Selection
// =============================================================================

function selectMaster(
  nodeType: string,
  contentMaps: ContentMaps,
  contentId?: string,
): MasterKey {
  if (nodeType === 'chronicle' && contentId) {
    const chronicle = contentMaps.chronicleMap.get(contentId);
    if (chronicle?.format === 'document') return 'B';
    return 'A';
  }
  if (nodeType === 'era_narrative') return 'C';
  // entity, static_page, folder
  return 'D';
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Build a complete IDML package as a Blob.
 *
 * The .idml file is a ZIP containing all the XML files that define
 * an InDesign document. Each content entry gets its own story and spread(s).
 */
export async function buildIdmlPackage(
  treeState: ContentTreeState,
  contentMaps: ContentMaps,
  imageMap: Map<string, ImageMetadataRecord>,
  referencedImages: Map<string, ExportImageEntry>,
  layoutOptions?: IdmlLayoutOptions,
): Promise<Blob> {
  const layout = resolveLayout(layoutOptions);
  const registerFn = createImageRegistrar(referencedImages, imageMap);

  const allStories: StoryFile[] = [];
  const allSpreads: SpreadFile[] = [];
  let currentPageNum = 1;
  let entryCounter = 0;

  const flattened = flattenForExport(treeState);

  for (const { node, depth } of flattened) {
    const entryId = `e${entryCounter++}`;

    if (node.type === 'folder') {
      // Folder heading: simple story + 2-page spread
      const storyId = `story_${entryId}`;
      const headingStyle = depth <= 0 ? PS_SECTION_HEADING : PS_ERA_HEADING;
      const paras = [plainPara(headingStyle, node.name)];

      const storyXml = buildEntryStoryXml(storyId, paras, []);
      allStories.push({
        filename: `Stories/Story_${storyId}.xml`,
        xml: storyXml,
        storyId,
      });

      const masterId = MASTERS.D.spreadId; // folders use D-Encyclopedia master
      const { spreads, pagesUsed } = buildEntrySpreads(
        entryId, storyId, masterId, 2, currentPageNum, [], [], layout
      );
      allSpreads.push(...spreads);
      currentPageNum += pagesUsed;
      continue;
    }

    if (!node.contentId) continue;

    // Content entry: build paragraphs, classify notes, collect images
    let contentParas: IcmlParagraph[] = [];
    let footnotes: FootnoteInsert[] = [];
    let callouts: { anchorPhrase: string; noteText: string; noteType: string }[] = [];
    let images: ImagePlacement[] = [];
    const masterKey = selectMaster(node.type, contentMaps, node.contentId);

    if (node.type === 'entity') {
      const entity = contentMaps.entityMap.get(node.contentId);
      if (entity) {
        contentParas = entityToIcmlParagraphs(entity, imageMap, referencedImages, registerFn);
        const notes = classifyHistorianNotes(entity.enrichment?.historianNotes);
        footnotes = notes.footnotes;
        callouts = notes.callouts;
        images = collectEntryImages(entity, imageMap);
      }
    } else if (node.type === 'chronicle') {
      const chronicle = contentMaps.chronicleMap.get(node.contentId);
      if (chronicle) {
        contentParas = chronicleToIcmlParagraphs(chronicle, imageMap, referencedImages, registerFn);
        const notes = classifyHistorianNotes(chronicle.historianNotes);
        footnotes = notes.footnotes;
        callouts = notes.callouts;
        images = collectEntryImages(chronicle, imageMap);
      }
    } else if (node.type === 'era_narrative') {
      const narrative = contentMaps.narrativeMap.get(node.contentId);
      if (narrative) {
        contentParas = eraNarrativeToIcmlParagraphs(narrative, imageMap, referencedImages, registerFn);
        // Era narratives don't have historian notes
        images = collectEntryImages(narrative, imageMap);
      }
    } else if (node.type === 'static_page') {
      const page = contentMaps.pageMap.get(node.contentId);
      if (page) {
        contentParas = staticPageToIcmlParagraphs(page);
        // Static pages have no images or notes
      }
    }

    if (contentParas.length === 0) continue;

    // Strip historian note paragraphs from the main content — in IDML,
    // popout notes become inline footnotes and full notes become callout stories
    if (footnotes.length > 0 || callouts.length > 0) {
      contentParas = stripHistorianNotes(contentParas);
    }

    // Build main story (with inline footnotes)
    const storyId = `story_${entryId}`;
    const storyXml = buildEntryStoryXml(storyId, contentParas, footnotes);
    allStories.push({
      filename: `Stories/Story_${storyId}.xml`,
      xml: storyXml,
      storyId,
    });

    // Build callout stories
    const calloutStoryRefs: { storyId: string }[] = [];
    for (let ci = 0; ci < callouts.length; ci++) {
      const callout = callouts[ci];
      const calloutStoryId = `story_${entryId}_co${ci}`;
      const calloutXml = buildCalloutStoryXml(
        calloutStoryId, callout.noteType, callout.noteText, callout.anchorPhrase
      );
      allStories.push({
        filename: `Stories/Story_${calloutStoryId}.xml`,
        xml: calloutXml,
        storyId: calloutStoryId,
      });
      calloutStoryRefs.push({ storyId: calloutStoryId });
    }

    // Estimate pages and build spreads
    const pageCount = estimateEntryPages(contentParas, images.length, layout.linesPerPage);
    const masterId = MASTERS[masterKey].spreadId;

    const { spreads, pagesUsed } = buildEntrySpreads(
      entryId, storyId, masterId, pageCount, currentPageNum, images, calloutStoryRefs, layout
    );
    allSpreads.push(...spreads);
    currentPageNum += pagesUsed;
  }

  // Build master spread files
  const masterKeys: MasterKey[] = ['A', 'B', 'C', 'D'];
  const masterSpreadFiles: { spreadId: string; filename: string }[] = [];
  const masterStoryIds: string[] = [];

  const zip = new JSZip();

  // mimetype MUST be the first entry (uncompressed)
  zip.file('mimetype', MIMETYPE);

  for (const key of masterKeys) {
    const master = MASTERS[key];
    const filename = `MasterSpreads/MasterSpread_${master.spreadId}.xml`;
    zip.file(filename, buildMasterSpreadXml(master, layout));
    masterSpreadFiles.push({ spreadId: master.spreadId, filename });

    // Master story
    const masterStoryFilename = `Stories/Story_${master.storyId}.xml`;
    zip.file(masterStoryFilename, buildMasterStoryXml(master.storyId));
    masterStoryIds.push(master.storyId);
  }

  // Structural files
  zip.file('META-INF/container.xml', buildContainerXml());

  // Resources
  zip.file('Resources/Graphic.xml', buildGraphicXml());
  zip.file('Resources/Fonts.xml', buildFontsXml(layout.fontFamily));
  zip.file('Resources/Styles.xml', buildStylesXml(layout));
  zip.file('Resources/Preferences.xml', buildPreferencesXml(layout));

  // Entry spreads
  for (const spread of allSpreads) {
    zip.file(spread.filename, spread.xml);
  }

  // Entry stories
  for (const story of allStories) {
    zip.file(story.filename, story.xml);
  }

  // XML structure
  zip.file('XML/BackingStory.xml', buildBackingStoryXml());
  zip.file('XML/Tags.xml', buildTagsXml());

  // Designmap (must reference everything)
  const totalPages = currentPageNum - 1;
  zip.file('designmap.xml', buildDesignmap(
    masterSpreadFiles, allSpreads, allStories, masterStoryIds, totalPages
  ));

  // Generate with STORE compression (standard for IDML)
  return zip.generateAsync({ type: 'blob', compression: 'STORE' });
}
