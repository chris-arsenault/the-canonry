/**
 * WorldSeedProject - The Unified Schema
 *
 * This is the single source of truth for all world-building tools in The Canonry.
 * Each tool reads/writes this format. No mappers, no converters.
 */

import type { EntityKindDefinition } from './entityKind.js';
import type { RelationshipKindDefinition } from './relationship.js';
import type { CultureDefinition } from './culture.js';
import type { SeedEntity, SeedRelationship } from './seed.js';
import type { AxisDefinition, TagDefinition } from './mfeContracts.js';
import type { DomainUIConfig } from './ui.js';

/**
 * The complete world seed project
 */
export interface WorldSeedProject {
  /** Unique identifier for this project */
  id: string;
  /** Display name */
  name: string;
  /** Schema version */
  version: string;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;

  // === SCHEMA DEFINITION ===

  /** All entity kinds in this world */
  entityKinds: EntityKindDefinition[];
  /** All relationship kinds in this world */
  relationshipKinds: RelationshipKindDefinition[];
  /** Axis definitions referenced by semantic planes */
  axisDefinitions?: AxisDefinition[];
  /** Tag registry for schema governance */
  tagRegistry?: TagDefinition[];
  /** Optional UI configuration */
  uiConfig?: DomainUIConfig;

  // === CULTURES ===

  /** All cultures in this world */
  cultures: CultureDefinition[];

  // === SEED DATA ===

  /** Initial entities */
  seedEntities: SeedEntity[];
  /** Initial relationships */
  seedRelationships: SeedRelationship[];
}

/**
 * Metadata for a project (without full data)
 */
export interface ProjectMetadata {
  id: string;
  name: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  /** Summary counts for display */
  counts?: {
    entityKinds: number;
    relationshipKinds: number;
    cultures: number;
    seedEntities: number;
    seedRelationships: number;
  };
}
