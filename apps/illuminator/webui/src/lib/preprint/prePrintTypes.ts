/**
 * Pre-Print Types
 *
 * Data structures for the pre-print preparation pipeline:
 * stats dashboard, content ordering tree, and markdown export.
 */

import type { HistorianNoteType } from "../historianTypes";
import type { ChronicleImageSize } from "../chronicleTypes";
import type { ImageAspect, ImageType } from "../imageTypes";

// =============================================================================
// Stats Dashboard
// =============================================================================

export interface WordCountBreakdown {
  chronicleBody: number;
  chronicleSummaries: number;
  entityDescriptions: number;
  entitySummaries: number;
  eraNarrativeContent: number;
  imageCaptions: number;
  historianNotesEntity: number;
  historianNotesChronicle: number;
  staticPageContent: number;
}

export interface CharCountBreakdown {
  chronicleBody: number;
  chronicleSummaries: number;
  entityDescriptions: number;
  entitySummaries: number;
  eraNarrativeContent: number;
  imageCaptions: number;
  historianNotesEntity: number;
  historianNotesChronicle: number;
  staticPageContent: number;
}

export interface ImageStats {
  total: number;
  totalStorageBytes: number;
  byAspect: Record<ImageAspect, number>;
  byType: Record<ImageType | "cover", number>;
  bySize: Record<ChronicleImageSize, number>;
  dimensionRange: {
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
  } | null;
}

export interface CompletenessStats {
  entitiesTotal: number;
  entitiesWithDescription: number;
  entitiesWithImage: number;
  entitiesWithSummary: number;
  chroniclesTotal: number;
  chroniclesPublished: number;
  chroniclesWithHistorianNotes: number;
  chroniclesWithSceneImages: number;
  staticPagesTotal: number;
  staticPagesPublished: number;
  eraNarrativesTotal: number;
  eraNarrativesComplete: number;
  eraNarrativesWithCoverImage: number;
}

export interface HistorianNoteStats {
  total: number;
  byType: Record<HistorianNoteType, number>;
  onEntities: number;
  onChronicles: number;
}

export interface PrePrintStats {
  totalWords: number;
  totalChars: number;
  estimatedPages: number;
  wordBreakdown: WordCountBreakdown;
  charBreakdown: CharCountBreakdown;
  images: ImageStats;
  completeness: CompletenessStats;
  historianNotes: HistorianNoteStats;
  calculatedAt: number;
}

// =============================================================================
// Content Ordering Tree
// =============================================================================

export type ContentNodeType = "folder" | "entity" | "chronicle" | "static_page" | "era_narrative";

export interface ContentTreeNode {
  /** Unique ID for this node */
  id: string;
  /** Display name (editable for folders, derived from content for items) */
  name: string;
  /** Node type */
  type: ContentNodeType;
  /** Children (only for folders) */
  children?: ContentTreeNode[];
  /** Content reference ID (entityId, chronicleId, or pageId) - only for content items */
  contentId?: string;
}

export interface ContentTreeState {
  projectId: string;
  simulationRunId: string;
  nodes: ContentTreeNode[];
  updatedAt: number;
}

// =============================================================================
// Export
// =============================================================================

export interface ExportImageEntry {
  imageId: string;
  filename: string;
  width?: number;
  height?: number;
  aspect?: ImageAspect;
  imageType: ImageType | "cover";
  entityId?: string;
  entityName?: string;
  chronicleId?: string;
  mimeType?: string;
}

export interface ExportManifest {
  exportVersion: 1;
  exportedAt: string;
  projectId: string;
  simulationRunId: string;
  stats: {
    totalWordCount: number;
    estimatedPages: number;
    entityCount: number;
    chronicleCount: number;
    staticPageCount: number;
    eraNarrativeCount: number;
    imageCount: number;
    historianNoteCount: number;
  };
  tree: ContentTreeNode[];
  images: Record<string, ExportImageEntry>;
  s3?: {
    bucket: string;
    basePrefix: string;
    rawPrefix: string;
    projectId: string;
    region: string;
  };
}

export interface S3ExportConfig {
  bucket: string;
  basePrefix: string;
  rawPrefix: string;
  region: string;
}

export type ExportFormat = "markdown" | "indesign";

// =============================================================================
// IDML Layout Options
// =============================================================================

export interface IdmlPagePreset {
  label: string;
  widthIn: number;
  heightIn: number;
  margins: { top: number; bottom: number; inside: number; outside: number }; // inches
}

export interface IdmlLayoutOptions {
  pagePreset: string;
  fontFamily: string;
  bodySize: number;
  bodyLeading: number;
  columnCount: number;
  columnGutter: number;
  paragraphSpacing: number;
}

export const IDML_PAGE_PRESETS: Record<string, IdmlPagePreset> = {
  "trade-6x9": {
    label: "6\u00d79\u2033 Trade Paperback",
    widthIn: 6,
    heightIn: 9,
    margins: { top: 0.75, bottom: 0.75, inside: 0.875, outside: 0.625 },
  },
  "coffee-10x10": {
    label: "10\u00d710\u2033 Coffee Table",
    widthIn: 10,
    heightIn: 10,
    margins: { top: 1.0, bottom: 1.0, inside: 1.0, outside: 1.0 },
  },
  "coffee-9x12": {
    label: "9\u00d712\u2033 Coffee Table",
    widthIn: 9,
    heightIn: 12,
    margins: { top: 1.0, bottom: 1.0, inside: 1.125, outside: 0.875 },
  },
};

export const IDML_FONT_PRESETS = [
  "Junicode",
  "Adobe Garamond Pro",
  "Adobe Caslon Pro",
  "Baskerville",
  "Palatino",
  "Minion Pro",
] as const;

export const DEFAULT_IDML_LAYOUT: IdmlLayoutOptions = {
  pagePreset: "trade-6x9",
  fontFamily: "Junicode",
  bodySize: 11,
  bodyLeading: 14,
  columnCount: 1,
  columnGutter: 12,
  paragraphSpacing: 1.0,
};

// =============================================================================
// Page Layout Overrides
// =============================================================================

export type LayoutMode = "flow" | "margin" | "centered";
export type AnnotationDisplay = "full" | "popout" | "disabled";
export type AnnotationPosition = "sidenote" | "inline" | "footnote";
export type ImageLayout = "float" | "margin" | "block" | "hidden";
export type ContentWidth = "narrow" | "standard" | "wide";
export type TextAlign = "left" | "center" | "justify";

/**
 * Per-page layout overrides stored separately from content.
 * Applied at render time in the Chronicler to bypass the
 * heuristic-based analyzeLayout() decisions.
 *
 * All fields except pageId, simulationRunId, updatedAt are optional.
 * Undefined fields fall through to the engine defaults.
 */
export interface PageLayoutOverride {
  pageId: string;
  simulationRunId: string;

  layoutMode?: LayoutMode;
  annotationDisplay?: AnnotationDisplay;
  annotationPosition?: AnnotationPosition;
  imageLayout?: ImageLayout;
  contentWidth?: ContentWidth;
  dropcap?: boolean;
  textAlign?: TextAlign;
  customClass?: string;

  updatedAt: number;
}
