/**
 * Entity Cluster Builder
 *
 * Simplifies creating groups of related entities with pre-connected relationships.
 * Handles placeholder ID generation and resolution automatically.
 *
 * Usage:
 * ```typescript
 * const cluster = new EntityClusterBuilder()
 *   .addEntity({ kind: 'faction', subtype: 'guild', name: 'Traders' })
 *   .addEntity({ kind: 'npc', subtype: 'merchant', name: 'Bob' })
 *   .relate(0, 1, 'member_of')  // merchant Bob joins guild
 *   .build();
 * ```
 */

import { HardState, Relationship } from '../core/worldTypes';
import { TemplateResult } from '../engine/types';

export class EntityClusterBuilder {
  private entities: Array<Partial<HardState>> = [];
  private relationships: Relationship[] = [];

  /**
   * Add an entity to the cluster
   * Returns the index of the added entity for use in relate()
   * @param entity - Partial entity (id will be assigned as placeholder)
   */
  addEntity(entity: Partial<HardState>): this {
    this.entities.push(entity);
    return this;
  }

  /**
   * Add multiple entities at once
   * @param entities - Array of partial entities
   */
  addEntities(entities: Array<Partial<HardState>>): this {
    entities.forEach(entity => this.addEntity(entity));
    return this;
  }

  /**
   * Create a relationship between entities in the cluster
   * @param fromIndex - Index of source entity (0-based)
   * @param toIndex - Index or ID of destination entity
   * @param kind - Relationship type
   * @param strength - Optional relationship strength
   */
  relate(
    fromIndex: number,
    toIndex: number | string,
    kind: string,
    strength?: number
  ): this {
    const src = typeof fromIndex === 'number'
      ? `will-be-assigned-${fromIndex}`
      : fromIndex;

    const dst = typeof toIndex === 'number'
      ? `will-be-assigned-${toIndex}`
      : toIndex;

    const rel: Relationship = { kind, src, dst, strength: strength ?? 0.5 };

    this.relationships.push(rel);
    return this;
  }

  /**
   * Create a relationship from a cluster entity to an existing entity
   * @param fromIndex - Index of source entity in cluster
   * @param toEntityId - ID of destination entity (already in graph)
   * @param kind - Relationship type
   * @param strength - Optional relationship strength
   */
  relateToExisting(
    fromIndex: number,
    toEntityId: string,
    kind: string,
    strength?: number
  ): this {
    return this.relate(fromIndex, toEntityId, kind, strength);
  }

  /**
   * Create a relationship from an existing entity to a cluster entity
   * @param fromEntityId - ID of source entity (already in graph)
   * @param toIndex - Index of destination entity in cluster
   * @param kind - Relationship type
   * @param strength - Optional relationship strength
   */
  relateFromExisting(
    fromEntityId: string,
    toIndex: number,
    kind: string,
    strength?: number
  ): this {
    return this.relate(fromEntityId as any, toIndex, kind, strength);
  }

  /**
   * Create relationships from one cluster entity to multiple others
   * @param fromIndex - Index of source entity
   * @param toIndices - Array of destination indices or IDs
   * @param kind - Relationship type
   * @param strength - Optional relationship strength
   */
  relateManyFrom(
    fromIndex: number,
    toIndices: Array<number | string>,
    kind: string,
    strength?: number
  ): this {
    toIndices.forEach(toIndex => {
      this.relate(fromIndex, toIndex, kind, strength);
    });
    return this;
  }

  /**
   * Create relationships from multiple cluster entities to one
   * @param fromIndices - Array of source indices
   * @param toIndex - Destination index or ID
   * @param kind - Relationship type
   * @param strength - Optional relationship strength
   */
  relateManyTo(
    fromIndices: number[],
    toIndex: number | string,
    kind: string,
    strength?: number
  ): this {
    fromIndices.forEach(fromIndex => {
      this.relate(fromIndex, toIndex, kind, strength);
    });
    return this;
  }

  /**
   * Create a bidirectional relationship between two cluster entities
   * @param index1 - First entity index
   * @param index2 - Second entity index
   * @param kind - Relationship type
   * @param strength - Optional relationship strength
   */
  relateBidirectional(
    index1: number,
    index2: number,
    kind: string,
    strength?: number
  ): this {
    this.relate(index1, index2, kind, strength);
    this.relate(index2, index1, kind, strength);
    return this;
  }

  /**
   * Get the number of entities in the cluster
   */
  entityCount(): number {
    return this.entities.length;
  }

  /**
   * Get the number of relationships in the cluster
   */
  relationshipCount(): number {
    return this.relationships.length;
  }

  /**
   * Build and return the TemplateResult
   * @param description - Description of what this cluster represents
   */
  buildWithDescription(description: string): TemplateResult {
    return {
      entities: this.entities,
      relationships: this.relationships,
      description
    };
  }

  /**
   * Build and return raw entities and relationships
   */
  build(): { entities: Array<Partial<HardState>>; relationships: Relationship[] } {
    return {
      entities: this.entities,
      relationships: this.relationships
    };
  }

  /**
   * Clear all entities and relationships
   */
  clear(): this {
    this.entities = [];
    this.relationships = [];
    return this;
  }
}

/**
 * Helper function to create a new EntityClusterBuilder
 * Usage: buildCluster().addEntity(...).relate(...).build()
 */
export function buildCluster(): EntityClusterBuilder {
  return new EntityClusterBuilder();
}
