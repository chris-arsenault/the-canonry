import type {
  CanonrySchemaSlice,
  CultureDefinition,
  EntityKindDefinition,
  NarrativeEvent,
  ProminenceLabel,
  SemanticCoordinates,
  SemanticRegion,
  Validation,
  WorldEntity as CanonryWorldEntity,
  WorldMetadata as CanonryWorldMetadata,
  WorldOutput as CanonryWorldOutput,
  WorldRelationship as CanonryWorldRelationship,
} from "@canonry/world-schema";
import type { Optional } from "@the-canonry/shared-components";

/** Links an anchor phrase in an entity's description to a source chronicle */
export interface ChronicleBackref {
  entityId: string;
  chronicleId: string;
  anchorPhrase: string;
  createdAt: number;
  /** Image to display at this backref anchor. undefined = legacy fallback (cover), null = no image */
  imageSource: Optional<
    | { source: "cover" }
    | { source: "image_ref"; refId: string }
    | { source: "entity"; entityId: string }
    | null
  >;
  /** Display size for the backref image */
  imageSize: Optional<"small" | "medium" | "large" | "full-width">;
  /** Float alignment for the backref image */
  imageAlignment: Optional<"left" | "right">;
}

export type HardState = CanonryWorldEntity & {
  enrichment: Optional<{
    image: Optional<{
      imageId: Optional<string>;
    }>;
    text: Optional<{
      aliases: Optional<string[]>;
      visualThesis: Optional<string>;
      visualTraits: Optional<string[]>;
      generatedAt: Optional<number>;
      model: Optional<string>;
    }>;
    slugAliases: Optional<string[]>;
    chronicleBackrefs: Optional<ChronicleBackref[]>;
    historianNotes: Optional<Array<{
      noteId: string;
      anchorPhrase: string;
      text: string;
      type: string;
      display: Optional<"disabled" | "popout" | "full">;
      enabled: Optional<boolean>;
    }>>;
  }>;
};
export type WorldState = Omit<CanonryWorldOutput, "hardState"> & {
  hardState: HardState[];
};
export type Relationship = CanonryWorldRelationship;
export type WorldMetadata = CanonryWorldMetadata;
export type Prominence = ProminenceLabel;
export type EntityKind = EntityKindDefinition["kind"];
export type Point = SemanticCoordinates;
export type Region = SemanticRegion;
export type Schema = CanonrySchemaSlice;

// Lore types
export type LoreType =
  | "description"
  | "relationship_backstory"
  | "era_narrative"
  | "chain_link"
  | "discovery_event"
  | "era_chapter"
  | "entity_chronicle"
  | "enhanced_entity_page"
  | "relationship_narrative"
  | "chronicle";

export interface LoreWikiSection {
  heading: string;
  level: Optional<1 | 2 | 3>;
  content: string;
}

export interface LoreWikiContent {
  sections: LoreWikiSection[];
  entityRefs: Optional<{ name: string; entityId: string; occurrences: number }[]>;
  imageSlots: Optional<{ position: string; entityId: Optional<string> }[]>;
  wordCount: Optional<number>;
}

export interface LoreRecord {
  id: string;
  type: LoreType;
  targetId: Optional<string>;
  text: string;
  cached: Optional<boolean>;
  warnings: Optional<string[]>;
  wikiContent: Optional<LoreWikiContent>;
  metadata: Optional<Record<string, unknown>>;
}

export interface LoreData {
  llmEnabled: boolean;
  model: string;
  records: LoreRecord[];
}

/** Image aspect ratio classification */
export type ImageAspect = "portrait" | "landscape" | "square";

export interface EntityImage {
  entityId: string;
  entityName: string;
  entityKind: string;
  prompt: string;
  localPath: string;
  imageId: string;
  /** Optimized thumbnail path (WebP, ~400px wide) - for inline display */
  thumbPath: Optional<string>;
  /** Optimized full-size path (WebP) - for lightbox view */
  fullPath: Optional<string>;
  /** Image width in pixels */
  width: Optional<number>;
  /** Image height in pixels */
  height: Optional<number>;
  /** Aspect ratio classification: portrait (<0.9), square (0.9-1.1), landscape (>1.1) */
  aspect: Optional<ImageAspect>;
}

export interface ImageMetadata {
  generatedAt: string;
  totalImages: number;
  results: EntityImage[];
}

/**
 * Image size variants for optimized loading
 * - 'thumb': Thumbnail (~400px wide) for inline display and hover cards
 * - 'full': Full-size image for lightbox view
 */
export type ImageSize = "thumb" | "full";

/**
 * Lightweight page index entry for navigation and search
 * Contains only the minimal info needed without building full content
 */
export interface PageIndexEntry {
  id: string;
  title: string;
  type: WikiPage["type"];
  slug: string;
  summary: Optional<string>;
  aliases: Optional<string[]>;
  categories: string[];
  chronicle: Optional<{
    format: "story" | "document";
    entrypointId: Optional<string>;
    narrativeStyleId: Optional<string>;
    roleAssignments: Optional<ChronicleRoleAssignment[]>;
    selectedEventIds: Optional<string[]>;
    selectedRelationshipIds: Optional<string[]>;
    temporalContext: Optional<ChronicleTemporalContext>;
  }>;
  // For entity pages
  entityKind: Optional<string>;
  entitySubtype: Optional<string>;
  prominence: Optional<number>;
  culture: Optional<string>;
  // For static pages
  static: Optional<{
    pageId: string;
    status: "draft" | "published";
  }>;
  // For era narrative pages
  eraNarrative: Optional<{
    eraId: string;
    tone: string;
    thesis: Optional<string>;
    sourceChronicleIds: Optional<string[]>;
  }>;
  // Cover image for gallery display
  coverImageId: Optional<string>;
  // For link resolution
  linkedEntities: string[];
  lastUpdated: number;
}

/**
 * Disambiguation entry for pages sharing a base name
 */
export interface DisambiguationEntry {
  pageId: string;
  title: string;
  namespace: Optional<string>; // e.g., "Cultures", "Names", or undefined for no namespace
  type: WikiPage["type"];
  entityKind: Optional<string>; // For entity pages
}

/**
 * Full page index with lookup maps
 */
export interface WikiPageIndex {
  entries: PageIndexEntry[];
  // Quick lookup maps
  byId: Map<string, PageIndexEntry>;
  byName: Map<string, string>; // lowercase name -> id
  byAlias: Map<string, string>; // lowercase alias -> id
  bySlug: Map<string, string>; // slugified name/alias -> id (for URL resolution)
  categories: WikiCategory[];
  // Disambiguation: baseName (lowercase) -> pages sharing that base name
  byBaseName: Map<string, DisambiguationEntry[]>;
}

/**
 * Serialized page index — Maps converted to entry arrays for JSON transport.
 * Used by the viewer build to pre-compute the index at build time.
 */
export interface SerializedPageIndex {
  entries: PageIndexEntry[];
  byName: [string, string][];
  byAlias: [string, string][];
  bySlug: [string, string][];
  categories: WikiCategory[];
  byBaseName: [string, DisambiguationEntry[]][];
}

// Wiki-specific types
/** Role assignment for chronicle seed */
export interface ChronicleRoleAssignment {
  role: string;
  entityId: string;
  entityName: string;
  entityKind: string;
  isPrimary: boolean;
}

export interface ChronicleTemporalContext {
  focalEra: Optional<{
    id: string;
    name: string;
    summary: Optional<string>;
    order: Optional<number>;
    startTick: Optional<number>;
    endTick: Optional<number>;
    duration: Optional<number>;
  }>;
  chronicleTickRange: Optional<[number, number]>;
  temporalScope: Optional<string>;
  isMultiEra: Optional<boolean>;
  touchedEraIds: Optional<string[]>;
  temporalDescription: Optional<string>;
}

export interface WikiPage {
  id: string;
  slug: string;
  title: string;
  type:
    | "entity"
    | "era"
    | "category"
    | "relationship"
    | "chronicle"
    | "static"
    | "region"
    | "era_narrative";
  chronicle: Optional<{
    format: "story" | "document";
    entrypointId: Optional<string>;
    // Seed data for generation context display
    narrativeStyleId: Optional<string>;
    roleAssignments: Optional<ChronicleRoleAssignment[]>;
    selectedEventIds: Optional<string[]>;
    selectedRelationshipIds: Optional<string[]>;
    temporalContext: Optional<ChronicleTemporalContext>;
  }>;
  static: Optional<{
    pageId: string;
    status: "draft" | "published";
  }>;
  eraNarrative: Optional<{
    eraId: string;
    tone: string;
    thesis: Optional<string>;
    sourceChronicleIds: Optional<string[]>;
  }>;
  aliases: Optional<string[]>;
  content: WikiContent;
  categories: string[];
  linkedEntities: string[];
  images: WikiImage[];
  /** Raw narrative events for timeline display (entity pages) */
  timelineEvents: Optional<NarrativeEvent[]>;
  lastUpdated: number;
}

/** Historian annotation note (read-only in Chronicler, managed in Illuminator) */
export interface WikiHistorianNote {
  noteId: string;
  anchorPhrase: string;
  text: string;
  type: string;
  /** Display mode: 'full' (inline callout) or 'popout' (collapsed/minimal) */
  display: "full" | "popout";
}

export interface WikiContent {
  sections: WikiSection[];
  summary: Optional<string>;
  /** Cover image ID for chronicle pages */
  coverImageId: Optional<string>;
  infobox: Optional<WikiInfobox>;
  /** Enabled historian annotations for this page */
  historianNotes: Optional<WikiHistorianNote[]>;
}

/** Image display size for chronicle inline images */
export type WikiImageSize = "small" | "medium" | "large" | "full-width";

/** Inline image within a wiki section */
export interface WikiSectionImage {
  refId: string;
  type: "entity_ref" | "chronicle_image";
  entityId: Optional<string>;
  imageId: string;
  anchorText: string;
  /** Character index where anchorText was found (fallback if text changes) */
  anchorIndex: Optional<number>;
  size: WikiImageSize;
  justification: Optional<"left" | "right">;
  caption: Optional<string>;
}

export interface WikiSection {
  id: string;
  heading: string;
  level: 1 | 2 | 3;
  content: string;
  /** Inline images for this section (chronicle pages) */
  images: Optional<WikiSectionImage[]>;
}

export interface WikiInfobox {
  type: "entity" | "era" | "relationship";
  fields: WikiInfoboxField[];
  image: Optional<WikiImage>;
}

export interface WikiInfoboxField {
  label: string;
  value: string | string[];
  linkedEntity: Optional<string>;
}

export interface WikiImage {
  entityId: string;
  path: string;
  caption: Optional<string>;
  /** Image width in pixels */
  width: Optional<number>;
  /** Image height in pixels */
  height: Optional<number>;
  /** Aspect ratio classification for display */
  aspect: Optional<ImageAspect>;
}

export interface WikiCategory {
  id: string;
  name: string;
  description: Optional<string>;
  parentCategory: Optional<string>;
  type: "auto" | "manual";
  pageCount: number;
}

export interface WikiBacklink {
  pageId: string;
  pageTitle: string;
  pageType: WikiPage["type"];
  context: string;
}

// Per-page layout override (mirrors illuminator's PageLayoutOverride)
export type LayoutMode = "flow" | "margin" | "centered";
export type AnnotationDisplay = "full" | "popout" | "disabled";
export type AnnotationPosition = "sidenote" | "inline" | "footnote";
export type ImageLayout = "float" | "margin" | "block" | "hidden";
export type ContentWidth = "narrow" | "standard" | "wide";
export type TextAlign = "left" | "center" | "justify";

export interface PageLayoutOverride {
  pageId: string;
  simulationRunId: string;
  layoutMode: Optional<LayoutMode>;
  annotationDisplay: Optional<AnnotationDisplay>;
  annotationPosition: Optional<AnnotationPosition>;
  imageLayout: Optional<ImageLayout>;
  contentWidth: Optional<ContentWidth>;
  dropcap: Optional<"on" | "off">;
  textAlign: Optional<TextAlign>;
  customClass: Optional<string>;
  updatedAt: number;
}

export type {
  CanonrySchemaSlice,
  CultureDefinition,
  EntityKindDefinition,
  NarrativeEvent,
  Validation,
};
