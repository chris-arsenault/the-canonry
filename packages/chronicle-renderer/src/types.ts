/**
 * Shared types for chronicle rendering.
 * Used by both the chronicler (live view) and illuminator (finalize editor).
 */

export interface WikiSection {
  id: string;
  heading: string;
  level: number;
  content: string;
  images?: WikiSectionImage[];
}

export interface WikiSectionImage {
  refId: string;
  type: "entity_ref" | "chronicle_image";
  entityId?: string;
  imageId: string;
  anchorText: string;
  anchorIndex?: number;
  size: string;
  justification?: string | null;
  caption?: string | null;
}

export interface ChronicleImageRef {
  refId: string;
  anchorText: string;
  anchorIndex?: number;
  size: string;
  justification?: string | null;
  caption?: string | null;
  type: "entity_ref" | "prompt_request";
  entityId?: string;
  sceneDescription?: string;
  status?: string;
  generatedImageId?: string;
}

export interface HistorianNoteInput {
  noteId: string;
  anchorPhrase: string;
  text: string;
  type: string;
  display?: string | null;
  /** @deprecated Use display */
  enabled?: boolean | null;
}

export interface HistorianNoteResolved {
  noteId: string;
  anchorPhrase: string;
  text: string;
  type: string;
  display: "popout" | "full";
}

/** Minimal entity shape needed for image resolution */
export interface EntityImageSource {
  id: string;
  enrichment?: {
    image?: { imageId: string };
  };
}
