/**
 * ChronicleImagePanel type definitions
 *
 * Shared interfaces for the decomposed ChronicleImagePanel components.
 */

import type { ChronicleImageRefs, EntityImageRef, PromptRequestRef } from "../lib/chronicleTypes";
import type { StyleInfo } from "../lib/promptBuilders";
import type { ImageGenSettings } from "../hooks/useImageGenSettings";

export interface EntityContext {
  id: string;
  name: string;
  kind: string;
  culture?: string;
  enrichment?: {
    image?: {
      imageId: string;
    };
    text?: {
      visualThesis?: string;
      visualTraits?: string[];
    };
  };
}

export interface Culture {
  id: string;
  name: string;
  styleKeywords?: string[];
}

export interface StyleLibrary {
  artisticStyles: Array<{
    id: string;
    name: string;
    description?: string;
    promptFragment?: string;
  }>;
  compositionStyles: Array<{
    id: string;
    name: string;
    description?: string;
    promptFragment?: string;
    suitableForKinds?: string[];
  }>;
  colorPalettes: Array<{ id: string; name: string; description?: string; promptFragment?: string }>;
}

export interface WorldContext {
  name?: string;
  description?: string;
  toneFragments?: { core: string };
  speciesConstraint?: string;
}

export interface CultureIdentities {
  visual?: Record<string, Record<string, string>>;
  descriptive?: Record<string, Record<string, string>>;
  visualKeysByKind?: Record<string, string[]>;
  descriptiveKeysByKind?: Record<string, string[]>;
}

export interface ChronicleImagePanelProps {
  imageRefs: ChronicleImageRefs | null;
  entities: Map<string, EntityContext>;
  onGenerateImage?: (ref: PromptRequestRef, prompt: string, styleInfo: StyleInfo) => void;
  onResetImage?: (ref: PromptRequestRef) => void;
  onRegenerateDescription?: (ref: PromptRequestRef) => void;
  onUpdateAnchorText?: (ref: EntityImageRef | PromptRequestRef, anchorText: string) => void;
  onUpdateSize?: (
    ref: EntityImageRef | PromptRequestRef,
    size: ChronicleImageRefs["refs"][number]["size"]
  ) => void;
  onUpdateJustification?: (
    ref: EntityImageRef | PromptRequestRef,
    justification: "left" | "right"
  ) => void;
  onSelectExistingImage?: (ref: PromptRequestRef, imageId: string) => void;
  projectId?: string;
  chronicleId?: string;
  chronicleText?: string;
  isGenerating?: boolean;
  styleLibrary?: StyleLibrary;
  styleSelection?: {
    artisticStyleId?: string;
    compositionStyleId?: string;
    colorPaletteId?: string;
  };
  cultures?: Culture[];
  cultureIdentities?: CultureIdentities;
  worldContext?: WorldContext;
  chronicleTitle?: string;
  imageSize?: string;
  imageQuality?: string;
  imageModel?: string;
  imageGenSettings?: ImageGenSettings;
  onOpenImageSettings?: () => void;
}

// Size display names
export const SIZE_LABELS: Record<string, string> = {
  small: "Small (150px)",
  medium: "Medium (300px)",
  large: "Large (450px)",
  "full-width": "Full Width",
};

// Status badge colors
export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "rgba(245, 158, 11, 0.2)", text: "#f59e0b" },
  generating: { bg: "rgba(59, 130, 246, 0.2)", text: "#3b82f6" },
  complete: { bg: "rgba(16, 185, 129, 0.2)", text: "#10b981" },
  failed: { bg: "rgba(239, 68, 68, 0.2)", text: "#ef4444" },
};

export const JUSTIFY_SIZES = new Set(["small", "medium", "large"]);
export const DEFAULT_VISUAL_IDENTITY_KIND = "scene";

export type { ChronicleImageRefs, EntityImageRef, PromptRequestRef, StyleInfo };
