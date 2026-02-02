/**
 * Pre-Print Types
 *
 * Data structures for the pre-print preparation pipeline:
 * stats dashboard, content ordering tree, and markdown export.
 */

import type { HistorianNoteType } from '../historianTypes';
import type { ChronicleImageSize } from '../chronicleTypes';
import type { ImageAspect, ImageType } from '../imageTypes';

// =============================================================================
// Stats Dashboard
// =============================================================================

export interface WordCountBreakdown {
  chronicleBody: number;
  chronicleSummaries: number;
  entityDescriptions: number;
  entitySummaries: number;
  imageCaptions: number;
  historianNotes: number;
  staticPageContent: number;
}

export interface CharCountBreakdown {
  chronicleBody: number;
  chronicleSummaries: number;
  entityDescriptions: number;
  entitySummaries: number;
  imageCaptions: number;
  historianNotes: number;
  staticPageContent: number;
}

export interface ImageStats {
  total: number;
  totalStorageBytes: number;
  byAspect: Record<ImageAspect, number>;
  byType: Record<ImageType | 'cover', number>;
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

export type ContentNodeType = 'folder' | 'entity' | 'chronicle' | 'static_page';

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
  imageType: ImageType | 'cover';
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
