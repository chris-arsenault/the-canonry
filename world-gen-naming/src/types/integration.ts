/**
 * Integration Types
 *
 * Interface definitions for integrating world-gen-naming with external systems.
 * These types provide a clean boundary between the naming system and knowledge graphs.
 */

/**
 * Generic entity representation for naming derivation
 *
 * This is a minimal interface that any KG can map to.
 * The naming system doesn't need to know about HardState, Node, or other KG-specific types.
 */
export interface Entity {
  id: string;
  name: string;
  type: string;        // Entity kind: "npc", "location", "faction", etc.
  tags?: string[];     // Optional tags for filtering
  properties?: Record<string, any>; // Optional additional properties
}

/**
 * Entity selector for querying a knowledge graph
 *
 * Used by derivedFromEntity strategies to find entities in the KG.
 * Implementers map these criteria to their specific KG query language.
 */
export interface EntitySelector {
  // Basic filters
  type?: string;              // Entity type/kind to match
  subType?: string;           // Subtype/subKind to match
  tags?: string[];            // Tags that entity must have (OR logic)
  requireAllTags?: boolean;   // If true, use AND logic for tags

  // Relationship-based filters
  relatedTo?: string;         // Entity ID that results must be related to
  relationshipKind?: string;  // Specific relationship type to follow

  // Spatial filters (for location-based queries)
  nearbyTo?: string;          // Entity ID that results must be near
  maxDistance?: number;       // Maximum distance (implementation-defined units)

  // Property filters
  hasProperty?: string;       // Entity must have this property
  propertyValue?: { key: string; value: any }; // Property must equal value

  // Selection strategy
  strategy?: "random" | "first" | "closest" | "highest_prominence";
  limit?: number;             // Maximum results to return
  seed?: string;              // Seed for deterministic random selection
}

/**
 * Entity lookup interface
 *
 * Implementers provide access to their knowledge graph through this interface.
 * The naming system uses this to find entities for derivedFromEntity strategies.
 */
export interface EntityLookup {
  /**
   * Find a single entity matching the selector
   * Returns null if no match found
   */
  findEntity(selector: EntitySelector): Entity | null;

  /**
   * Find all entities matching the selector
   * Returns empty array if no matches found
   */
  findEntities(selector: EntitySelector): Entity[];

  /**
   * Get entity by ID
   * Returns null if not found
   */
  getEntityById(id: string): Entity | null;
}

/**
 * Example implementation showing how to wrap a knowledge graph
 *
 * @example
 * ```typescript
 * class MyKGLookup implements EntityLookup {
 *   constructor(private kg: MyKnowledgeGraph) {}
 *
 *   findEntity(selector: EntitySelector): Entity | null {
 *     const results = this.findEntities(selector);
 *     return results[0] || null;
 *   }
 *
 *   findEntities(selector: EntitySelector): Entity[] {
 *     let candidates = this.kg.getAllEntities();
 *
 *     if (selector.type) {
 *       candidates = candidates.filter(e => e.kind === selector.type);
 *     }
 *
 *     if (selector.tags) {
 *       candidates = candidates.filter(e =>
 *         selector.tags!.some(tag => e.tags.includes(tag))
 *       );
 *     }
 *
 *     // Map your KG entities to Entity interface
 *     return candidates.map(e => ({
 *       id: e.id,
 *       name: e.name,
 *       type: e.kind,
 *       tags: e.tags,
 *     }));
 *   }
 *
 *   getEntityById(id: string): Entity | null {
 *     const entity = this.kg.findById(id);
 *     if (!entity) return null;
 *
 *     return {
 *       id: entity.id,
 *       name: entity.name,
 *       type: entity.kind,
 *       tags: entity.tags,
 *     };
 *   }
 * }
 * ```
 */
export class MockEntityLookup implements EntityLookup {
  constructor(private entities: Entity[] = []) {}

  findEntity(selector: EntitySelector): Entity | null {
    const results = this.findEntities(selector);

    if (results.length === 0) {
      return null;
    }

    // Apply selection strategy
    switch (selector.strategy) {
      case "first":
        return results[0];
      case "random":
      default:
        // For deterministic testing, just return first
        return results[0];
    }
  }

  findEntities(selector: EntitySelector): Entity[] {
    let candidates = [...this.entities];

    // Filter by type
    if (selector.type) {
      candidates = candidates.filter(e => e.type === selector.type);
    }

    // Filter by subType (assumes stored in properties)
    if (selector.subType) {
      candidates = candidates.filter(e => e.properties?.subType === selector.subType);
    }

    // Filter by tags
    if (selector.tags && selector.tags.length > 0) {
      if (selector.requireAllTags) {
        // AND logic: entity must have all tags
        candidates = candidates.filter(e =>
          selector.tags!.every(tag => e.tags?.includes(tag))
        );
      } else {
        // OR logic: entity must have at least one tag
        candidates = candidates.filter(e =>
          selector.tags!.some(tag => e.tags?.includes(tag))
        );
      }
    }

    // Apply limit
    if (selector.limit) {
      candidates = candidates.slice(0, selector.limit);
    }

    return candidates;
  }

  getEntityById(id: string): Entity | null {
    return this.entities.find(e => e.id === id) || null;
  }

  // Helper for tests
  addEntity(entity: Entity): void {
    this.entities.push(entity);
  }
}
