import { SimulationSystem, SystemResult } from '../engine/types';
import { Relationship } from '../core/worldTypes';
import { WorldRuntime } from '../runtime/worldRuntime';
import type { RelationshipKindDefinition } from '@canonry/world-schema';
import type { RelationshipMaintenanceConfig } from '../engine/systemInterpreter';
import { createSystemContext, evaluateMetric } from '../rules';
import { isFrameworkRelationshipKind } from '@canonry/world-schema';

type DecayRate = NonNullable<RelationshipKindDefinition['decayRate']>;

/**
 * Relationship Maintenance System
 *
 * Unified system for relationship lifecycle management:
 * - Decay: Reduces strength over time based on relationship kind's decayRate
 * - Reinforcement: Increases strength when entities are in proximity or share context
 * - Culling: Archives weak relationships (marks as historical, respecting cullable flag)
 *
 * Decay rates map to strength reduction per maintenance cycle:
 * - 'none': 0 (permanent)
 * - 'slow': 0.01 per cycle
 * - 'medium': 0.03 per cycle
 * - 'fast': 0.06 per cycle
 */

// =============================================================================
// HELPERS (internal to this system)
// =============================================================================

/** Map decay rate to strength reduction per cycle */
function getDecayAmount(rate: DecayRate, ctx: ReturnType<typeof createSystemContext>): number {
  return evaluateMetric({ type: 'decay_rate', rate }, ctx).value;
}

/** Get relationship kind definition from the canonical schema */
function getRelationshipKindDef(
  graphView: WorldRuntime,
  kind: string
): RelationshipKindDefinition | undefined {
  return graphView.config.schema.relationshipKinds.find(
    (rk: RelationshipKindDefinition) => rk.kind === kind
  );
}

/** Check if a relationship kind is cullable */
function isCullable(graphView: WorldRuntime, kind: string): boolean {
  // Framework relationships are NEVER cullable - they are structural
  if (isFrameworkRelationshipKind(kind)) {
    return false;
  }
  const def = getRelationshipKindDef(graphView, kind);
  // Default to true if not specified
  return def?.cullable !== false;
}

/** Get decay rate for a relationship kind */
function getDecayRate(graphView: WorldRuntime, kind: string): DecayRate {
  // Framework relationships NEVER decay - they are permanent structural relationships
  if (isFrameworkRelationshipKind(kind)) {
    return 'none';
  }
  const def = getRelationshipKindDef(graphView, kind);
  // Default to 'medium' if not specified
  return def?.decayRate ?? 'medium';
}

/**
 * Check if two entities are in proximity via shared related entities.
 * Entities are in proximity if they both have relationships of the specified kinds
 * pointing to the same destination entity.
 */
function areInProximity(
  graphView: WorldRuntime,
  srcId: string,
  dstId: string,
  proximityRelationshipKinds: string[]
): boolean {
  if (proximityRelationshipKinds.length === 0) return false;

  const srcEntity = graphView.getEntity(srcId);
  const dstEntity = graphView.getEntity(dstId);
  if (!srcEntity || !dstEntity) return false;

  // Get destinations for src entity via proximity relationship kinds
  const srcDestinations = new Set(
    graphView.getAllRelationships()
      .filter(rel => rel.src === srcId && proximityRelationshipKinds.includes(rel.kind))
      .map(rel => rel.dst)
  );

  if (srcDestinations.size === 0) return false;

  // Check if dst entity shares any destination
  return graphView.getAllRelationships().some(
    rel =>
      rel.src === dstId &&
      proximityRelationshipKinds.includes(rel.kind) &&
      srcDestinations.has(rel.dst)
  );
}

// =============================================================================
// SYSTEM CREATION
// =============================================================================

/**
 * Create a Relationship Maintenance system with the given configuration.
 */
export function createRelationshipMaintenanceSystem(config: RelationshipMaintenanceConfig): SimulationSystem {
  // Extract config with defaults
  const maintenanceFrequency = config.maintenanceFrequency ?? 5;
  const cullThreshold = config.cullThreshold ?? 0.15;
  const gracePeriod = config.gracePeriod ?? 20;
  const reinforcementBonus = config.reinforcementBonus ?? 0.02;
  const maxStrength = config.maxStrength ?? 1.0;
  const proximityRelationshipKinds = config.proximityRelationshipKinds ?? [];

  return {
    id: config.id || 'relationship_maintenance',
    name: config.name || 'Relationship Maintenance',

    apply: (graphView: WorldRuntime, modifier: number = 1.0): SystemResult => {
      // Only run every N ticks
      if (graphView.tick % maintenanceFrequency !== 0) {
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: 'Relationship maintenance dormant'
        };
      }

      // Get all relationships including historical
      const allRelationships = graphView.getAllRelationships({ includeHistorical: true });
      const originalCount = allRelationships.filter(r => r.status !== 'historical').length;

      let decayed = 0;
      let reinforced = 0;
      let archived = 0;
      let removed = 0;

      const metricCtx = createSystemContext(graphView);

      const maintainedRelationships: Relationship[] = [];
      const modifiedEntityIds = new Set<string>();

      for (const rel of allRelationships) {
        // Preserve historical relationships unchanged
        if (rel.status === 'historical') {
          maintainedRelationships.push(rel);
          continue;
        }

        const srcEntity = graphView.getEntity(rel.src);
        const dstEntity = graphView.getEntity(rel.dst);

        // Remove relationships to non-existent entities (can't archive - no entity to reference)
        if (!srcEntity || !dstEntity) {
          removed++;
          continue;
        }

        // Calculate relationship age
        const age = Math.min(
          graphView.tick - srcEntity.createdAt,
          graphView.tick - dstEntity.createdAt
        );

        // Young relationships are protected
        const isYoung = age < gracePeriod;

        // Get relationship kind properties
        const decayRate = getDecayRate(graphView, rel.kind);
        const cullable = isCullable(graphView, rel.kind);

        let strength = rel.strength ?? 0.5;

        // === DECAY ===
        // Apply decay to relationships that aren't young and have decay enabled
        if (!isYoung && decayRate !== 'none') {
          const decayAmount = getDecayAmount(decayRate, metricCtx) * modifier;
          strength = Math.max(0, strength - decayAmount);
          decayed++;
        }

        // === REINFORCEMENT ===
        // Strengthen relationships when entities are in proximity
        if (proximityRelationshipKinds.length > 0 &&
            areInProximity(graphView, rel.src, rel.dst, proximityRelationshipKinds)) {
          strength = Math.min(maxStrength, strength + reinforcementBonus * modifier);
          reinforced++;
        }

        // === CULLING (now archives instead of deleting) ===
        // Archive weak relationships that are cullable and past grace period
        if (!isYoung && cullable && strength < cullThreshold) {
          archived++;

          // Mark as historical instead of removing
          rel.status = 'historical';
          rel.archivedAt = graphView.tick;

          if (srcEntity) {
            srcEntity.updatedAt = graphView.tick;
            modifiedEntityIds.add(srcEntity.id);
          }
          if (dstEntity) {
            dstEntity.updatedAt = graphView.tick;
            modifiedEntityIds.add(dstEntity.id);
          }

          maintainedRelationships.push(rel);
          continue;
        }

        // Update strength if changed
        if (rel.strength !== strength) {
          rel.strength = strength;
        }

        maintainedRelationships.push(rel);
      }

      // Update graph with all maintained relationships
      graphView.setRelationships(maintainedRelationships);

      // Build description
      const parts: string[] = [];
      if (decayed > 0) parts.push(`${decayed} decayed`);
      if (reinforced > 0) parts.push(`${reinforced} reinforced`);
      if (archived > 0) parts.push(`${archived} archived`);
      if (removed > 0) parts.push(`${removed} removed (orphaned)`);

      const description = parts.length > 0
        ? `Relationship maintenance: ${parts.join(', ')} (${originalCount} total)`
        : `Relationship maintenance: all ${originalCount} relationships stable`;

      return {
        relationshipsAdded: [],
        entitiesModified: Array.from(modifiedEntityIds).map(id => ({
          id,
          changes: { updatedAt: graphView.tick }
        })),
        pressureChanges: {},
        description
      };
    }
  };
}

