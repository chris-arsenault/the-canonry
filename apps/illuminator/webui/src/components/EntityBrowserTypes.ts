/**
 * EntityBrowser type definitions
 *
 * Shared interfaces used across the decomposed EntityBrowser components.
 */

import type { EntityNavItem } from "../lib/db/entityNav";
import type { ProminenceScale } from "@canonry/world-schema";
import type { ImageGenSettings } from "../hooks/useImageGenSettings";

// ─── Enrichment status ─────────────────────────────────────────────────────

export type EnrichmentStatus = "missing" | "queued" | "running" | "complete" | "error" | "disabled";
export type EnrichmentType = "description" | "visualThesis" | "image";

// ─── Filter state ──────────────────────────────────────────────────────────

export interface EntityFilters {
  kind: string;
  prominence: string;
  status: string;
  culture: string;
  chronicleImage: string;
}

export interface FilterOptions {
  kinds: string[];
  cultures: string[];
}

// ─── Config & callbacks ────────────────────────────────────────────────────

export interface EntityBrowserConfig {
  minProminenceForImage: string;
  requireDescription?: boolean;
  minEventSignificance?: number;
}

export interface StyleLibraryProp {
  artisticStyles: Array<{ id: string; name: string }>;
  compositionStyles: Array<{ id: string; name: string }>;
  colorPalettes: Array<{ id: string; name: string }>;
}

export interface EntityBrowserProps {
  worldSchema?: unknown;
  config: EntityBrowserConfig;
  onConfigChange: (partial: Partial<EntityBrowserConfig>) => void;
  buildPrompt: (entity: unknown, type: string) => string;
  getVisualConfig?: (entity: unknown) => Record<string, unknown>;
  styleLibrary: StyleLibraryProp | null;
  imageGenSettings: ImageGenSettings;
  onStartRevision?: () => void;
  isRevising?: boolean;
  onBulkHistorianReview?: (ids: string[]) => void;
  onBulkHistorianEdition?: (ids: string[], reEdit?: boolean) => void;
  onBulkHistorianClear?: (ids: string[]) => void;
  isBulkHistorianActive?: boolean;
  onNavigateToTab?: (tab: string) => void;
}

// ─── Image modal state ─────────────────────────────────────────────────────

export interface ImageModalState {
  open: boolean;
  imageId: string;
  title: string;
}

// ─── Search result ─────────────────────────────────────────────────────────

export interface SearchMatch {
  field: string;
  value: string;
  matchIndex: number;
}

export interface SearchResult {
  entity: EntityNavItem;
  matches: SearchMatch[];
}

// ─── EntityRow prop group ──────────────────────────────────────────────────

export interface EntityRowProps {
  entity: EntityNavItem;
  descStatus: EnrichmentStatus;
  imgStatus: EnrichmentStatus;
  thesisStatus: EnrichmentStatus;
  selected: boolean;
  onToggleSelect: () => void;
  onQueueDesc: () => void;
  onQueueThesis: () => void;
  onQueueImg: () => void;
  onCancelDesc: () => void;
  onCancelThesis: () => void;
  onCancelImg: () => void;
  onAssignImage: () => void;
  canQueueImage: boolean;
  needsDescription: boolean;
  onImageClick: (imageId: string, title: string) => void;
  onEntityClick: () => void;
  onEditEntity?: (navItem: EntityNavItem) => void;
  onDeleteEntity?: (navItem: EntityNavItem) => void;
  descCost?: string;
  imgCost?: string;
  prominenceScale: ProminenceScale;
}
