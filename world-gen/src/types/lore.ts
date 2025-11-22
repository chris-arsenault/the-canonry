import { HardState, Relationship } from './worldTypes';

export interface LoreIndex {
  sourceText: string;
  colonies: Array<{
    name: string;
    values: string[];
    style: string;
    notes?: string[];
  }>;
  factions: string[];
  namingRules: {
    patterns: string[];
    earnedNameRules: string;
    colonyTone: Record<string, string>;
  };
  relationshipPatterns: string[];
  techNotes: string[];
  magicNotes: string[];
  tensions: string[];
  canon: string[];
  legends: string[];
}

export type LoreRecordType =
  | 'name'
  | 'description'
  | 'era_narrative'
  | 'relationship_backstory'
  | 'tech_magic';

export interface LoreRecord {
  id: string;
  type: LoreRecordType;
  targetId?: string;
  relationship?: Relationship;
  text: string;
  warnings?: string[];
  cached?: boolean;
  metadata?: Record<string, any>;
}

export interface EnrichmentContext {
  graphSnapshot: {
    tick: number;
    era: string;
    pressures?: Record<string, number>;
  };
  nearbyEntities?: HardState[];
  relatedHistory?: string[];
}
