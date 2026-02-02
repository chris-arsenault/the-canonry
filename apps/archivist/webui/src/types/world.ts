import type {
  CanonrySchemaSlice,
  CultureDefinition,
  EntityKindDefinition,
  ProminenceLabel as CanonryProminenceLabel,
  SemanticCoordinates,
  SemanticRegion,
  Validation,
  WorldEntity as CanonryWorldEntity,
  WorldMetadata as CanonryWorldMetadata,
  WorldOutput as CanonryWorldOutput,
  WorldRelationship as CanonryWorldRelationship,
} from '@canonry/world-schema';

export type WorldState = Omit<CanonryWorldOutput, 'hardState'> & {
  hardState: HardState[];
};
export type HardState = CanonryWorldEntity & {
  enrichment?: {
    image?: {
      imageId?: string;
    };
  };
};
export type Relationship = CanonryWorldRelationship;
export type WorldMetadata = CanonryWorldMetadata;
export type Prominence = CanonryProminenceLabel;
export type EntityKind = EntityKindDefinition['kind'];
export type Point = SemanticCoordinates;
export type Region = SemanticRegion;
export type Schema = CanonrySchemaSlice;

export interface Filters {
  kinds: EntityKind[];
  minProminence: Prominence;
  timeRange: [number, number];
  tags: string[];
  searchQuery: string;
  relationshipTypes: string[];
  minStrength: number;
  showCatalyzedBy: boolean;
  showHistoricalRelationships: boolean;
}

export type GraphMode = 'full' | 'radial' | 'temporal' | 'faction' | 'conflict' | 'economic';

// Lore types
export type LoreType = 'description' | 'relationship_backstory' | 'era_narrative' | 'chain_link' | 'discovery_event';

export interface LoreRecord {
  id: string;
  type: LoreType;
  targetId?: string;  // For description, relationship_backstory, chain_link, discovery_event
  text: string;
  cached?: boolean;
  warnings?: string[];
}

export interface DescriptionLore extends LoreRecord {
  type: 'description';
  targetId: string;
}

export interface RelationshipBackstoryLore extends LoreRecord {
  type: 'relationship_backstory';
  targetId: string;
  relationship: {
    kind: string;
    src: string;
    dst: string;
  };
}

export interface EraNarrativeLore extends LoreRecord {
  type: 'era_narrative';
  metadata: {
    from: string;
    to: string;
    tick: number;
  };
}

export interface ChainLinkLore extends LoreRecord {
  type: 'chain_link';
  targetId: string;
  metadata: {
    sourceLocation: string;
    revealedTheme: string;
  };
}

export interface DiscoveryEventLore extends LoreRecord {
  type: 'discovery_event';
  targetId: string;
  metadata: {
    explorer: string;
    discoveryType: 'pressure' | 'chain';
    significance: string;
    tick: number;
  };
}

export interface LoreData {
  llmEnabled: boolean;
  model: string;
  records: (DescriptionLore | RelationshipBackstoryLore | EraNarrativeLore | ChainLinkLore | DiscoveryEventLore)[];
}

/** Image aspect ratio classification */
export type ImageAspect = 'portrait' | 'landscape' | 'square';

export interface EntityImage {
  entityId: string;
  entityName: string;
  entityKind: string;
  prompt: string;
  localPath: string;
  /** Image width in pixels */
  width?: number;
  /** Image height in pixels */
  height?: number;
  /** Aspect ratio classification: portrait (<0.9), square (0.9-1.1), landscape (>1.1) */
  aspect?: ImageAspect;
}

export interface ImageMetadata {
  generatedAt: string;
  totalImages: number;
  results: EntityImage[];
}

export type {
  CanonrySchemaSlice,
  CultureDefinition,
  EntityKindDefinition,
  Validation,
};
