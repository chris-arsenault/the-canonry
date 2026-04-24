/**
 * ChronicleImagePanel type definitions
 *
 * Shared interfaces for the decomposed ChronicleImagePanel components.
 */

import type { ChronicleImageRefs, EntityImageRef, PromptRequestRef } from "../lib/chronicleTypes";
import type { StyleInfo, WorldContext, CultureIdentities } from "../lib/promptBuilders";
import type { StyleLibrary, StyleSelection } from "@canonry/world-schema";
import type { ImageGenSettings } from "../hooks/useImageGenSettings";
import type { Culture } from "./chronicle-panel/chroniclePanelTypes";
import type { EntityNavItem } from "../lib/db/entityNav";

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

export interface ChronicleImagePanelProps {
  imageRefs: ChronicleImageRefs | null;
  entities: Map<string, EntityContext>;
  onGenerateImage?: (ref: PromptRequestRef, prompt: string, styleInfo: StyleInfo, imageSizeOverride?: string) => void;
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
  styleSelection?: Partial<StyleSelection>;
  cultures?: Culture[];
  cultureIdentities?: CultureIdentities;
  worldContext?: WorldContext;
  chronicleTitle?: string;
  imageSize?: string;
  imageQuality?: string;
  imageModel?: string;
  imageGenSettings?: ImageGenSettings;
  onOpenImageSettings?: () => void;
  /** Full entity map for name annotation in image prompts (all entities, not just chronicle cast) */
  fullEntityNavMap?: Map<string, EntityNavItem>;
  /** Chronicle's declared cast entity IDs — used for CAST line in image prompts */
  selectedEntityIds?: string[];
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

export type { ChronicleImageRefs, EntityImageRef, PromptRequestRef, StyleInfo, WorldContext, CultureIdentities, StyleLibrary, StyleSelection, Culture };
