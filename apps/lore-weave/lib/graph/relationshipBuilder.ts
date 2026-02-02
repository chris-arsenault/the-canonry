/**
 * Relationship Builder Utility
 *
 * Provides fluent API for creating relationships with validation and consistency.
 * Reduces boilerplate in templates and systems.
 */

import { Relationship } from '../core/worldTypes';
import { Graph } from '../engine/types';

export class RelationshipBuilder {
  private relationships: Relationship[] = [];

  /**
   * Add a relationship with fluent API
   * @param kind - Relationship type
   * @param src - Source entity ID
   * @param dst - Destination entity ID
   * @param strength - Optional relationship strength (0-1)
   */
  add(kind: string, src: string, dst: string, strength: number = 0.5): this {
    const rel: Relationship = { kind, src, dst, strength };
    this.relationships.push(rel);
    return this;
  }

  /**
   * Add multiple relationships of the same kind from one source to multiple destinations
   * @param kind - Relationship type
   * @param src - Source entity ID
   * @param destinations - Array of destination entity IDs
   * @param strength - Optional relationship strength
   */
  addManyFrom(kind: string, src: string, destinations: string[], strength?: number): this {
    destinations.forEach(dst => {
      this.add(kind, src, dst, strength);
    });
    return this;
  }

  /**
   * Add multiple relationships of the same kind from multiple sources to one destination
   * @param kind - Relationship type
   * @param sources - Array of source entity IDs
   * @param dst - Destination entity ID
   * @param strength - Optional relationship strength
   */
  addManyTo(kind: string, sources: string[], dst: string, strength?: number): this {
    sources.forEach(src => {
      this.add(kind, src, dst, strength);
    });
    return this;
  }

  /**
   * Add bidirectional relationship (creates two relationships)
   * @param kind - Relationship type
   * @param entity1 - First entity ID
   * @param entity2 - Second entity ID
   * @param strength - Optional relationship strength
   */
  addBidirectional(kind: string, entity1: string, entity2: string, strength?: number): this {
    this.add(kind, entity1, entity2, strength);
    this.add(kind, entity2, entity1, strength);
    return this;
  }

  /**
   * Add relationship only if it doesn't already exist in the graph
   * @param graph - Current graph state
   * @param kind - Relationship type
   * @param src - Source entity ID
   * @param dst - Destination entity ID
   * @param strength - Optional relationship strength
   */
  addIfNotExists(graph: Graph, kind: string, src: string, dst: string, strength?: number): this {
    const exists = graph.getRelationships().some(
      r => r.kind === kind && r.src === src && r.dst === dst
    );
    if (!exists) {
      this.add(kind, src, dst, strength);
    }
    return this;
  }

  /**
   * Get all relationships built so far
   */
  build(): Relationship[] {
    return this.relationships;
  }

  /**
   * Clear all relationships and start fresh
   */
  clear(): this {
    this.relationships = [];
    return this;
  }

  /**
   * Get count of relationships
   */
  count(): number {
    return this.relationships.length;
  }
}

/**
 * Helper function to create a new RelationshipBuilder
 * Usage: buildRelationships().add(...).add(...).build()
 */
export function buildRelationships(): RelationshipBuilder {
  return new RelationshipBuilder();
}

/**
 * Quick helper to create a single relationship
 * @param kind - Relationship type
 * @param src - Source entity ID
 * @param dst - Destination entity ID
 * @param strength - Optional relationship strength
 */
export function createRelationship(
  kind: string,
  src: string,
  dst: string,
  strength: number = 0.5
): Relationship {
  return { kind, src, dst, strength };
}
