/**
 * Shared types for EntityCoveragePanel and its sub-sections.
 */

import type { PersistedEntity, PersistedNarrativeEvent, PersistedRelationship } from "../../lib/db/illuminatorDb";
import type { ChronicleRecord } from "../../lib/chronicleTypes";

// ---------------------------------------------------------------------------
// Filter option
// ---------------------------------------------------------------------------

export interface FilterOption {
  value: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Column sort state
// ---------------------------------------------------------------------------

export interface SortState {
  col: string;
  desc: boolean;
}

// ---------------------------------------------------------------------------
// Core analysis output from computeCoreAnalysis
// ---------------------------------------------------------------------------

export interface EntityUsageEntry {
  total: number;
  primary: number;
  supporting: number;
  chronicleIds: string[];
}

export interface EraChronicleEntry {
  total: number;
  completed: number;
  backported: number;
}

export interface CultureRoleEntry {
  primary: number;
  supporting: number;
  entityIds: Set<string>;
}

export interface CultureEntityEntry {
  count: number;
  totalProminence: number;
  entityIds: Set<string>;
}

export interface CoreAnalysis {
  nonEraEntities: PersistedEntity[];
  activeChronicles: ChronicleRecord[];
  entityUsage: Map<string, EntityUsageEntry>;
  eventCoverage: Map<string, number>;
  eraChronicles: Map<string, EraChronicleEntry>;
  eraEntityCounts: Map<string, number>;
  eraEventCounts: Map<string, number>;
  cultureRoles: Map<string, CultureRoleEntry>;
  cultureEntities: Map<string, CultureEntityEntry>;
  entityBackportedCount: Map<string, number>;
}

// ---------------------------------------------------------------------------
// Section component shared props
// ---------------------------------------------------------------------------

export interface SuggestionsSectionProps {
  events: PersistedNarrativeEvent[];
  entities: PersistedEntity[];
  eventCoverage: Map<string, number>;
  entityUsage: Map<string, EntityUsageEntry>;
  expanded: boolean;
}

export interface BackrefsSectionProps {
  entities: PersistedEntity[];
  expanded: boolean;
}

export interface HistorySectionProps {
  entities: PersistedEntity[];
  expanded: boolean;
}

export interface CultureSectionProps {
  entities: PersistedEntity[];
  cultureRoles: Map<string, CultureRoleEntry>;
  cultureEntities: Map<string, CultureEntityEntry>;
  entityUsage: Map<string, EntityUsageEntry>;
  expanded: boolean;
}

export interface EventsSectionProps {
  events: PersistedNarrativeEvent[];
  eventCoverage: Map<string, number>;
  expanded: boolean;
}

export interface PotentialSectionProps {
  entities: PersistedEntity[];
  narrativeEvents: PersistedNarrativeEvent[];
  relationships: PersistedRelationship[];
  entityUsage: Map<string, EntityUsageEntry>;
  expanded: boolean;
}

export interface ErasSectionProps {
  entities: PersistedEntity[];
  events: PersistedNarrativeEvent[];
  eraChronicles: Map<string, EraChronicleEntry>;
  eraEntityCounts: Map<string, number>;
  eraEventCounts: Map<string, number>;
  expanded: boolean;
}

export interface IntegrationSectionProps {
  entities: PersistedEntity[];
  entityBackportedCount: Map<string, number>;
  expanded: boolean;
}

// ---------------------------------------------------------------------------
// Table helper component props
// ---------------------------------------------------------------------------

export interface SortableThProps {
  children: React.ReactNode;
  sortKey: string;
  sort: SortState;
  onSort: (col: string) => void;
  right?: boolean;
}

export interface StaticThProps {
  children: React.ReactNode;
  right?: boolean;
}

export interface EmptyRowProps {
  colSpan: number;
  text: string;
}
