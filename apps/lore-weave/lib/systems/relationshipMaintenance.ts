import { SimulationSystem, SystemResult, ActionContext } from '../engine/types';
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

function buildMaintenanceDescription(
  decayed: number, reinforced: number, archived: number, removed: number, originalCount: number
): string {
  const parts: string[] = [];
  if (decayed > 0) parts.push(`${decayed} decayed`);
  if (reinforced > 0) parts.push(`${reinforced} reinforced`);
  if (archived > 0) parts.push(`${archived} archived`);
  if (removed > 0) parts.push(`${removed} removed (orphaned)`);
  return parts.length > 0
    ? `Relationship maintenance: ${parts.join(', ')} (${originalCount} total)`
    : `Relationship maintenance: all ${originalCount} relationships stable`;
}

function computeUpdatedStrength(
  rel: Relationship,
  isYoung: boolean,
  decayRate: DecayRate,
  metricCtx: ReturnType<typeof createSystemContext>,
  modifier: number,
  proximityRelationshipKinds: string[],
  reinforcementBonus: number,
  maxStrength: number,
  graphView: WorldRuntime
): { strength: number; decayed: boolean; reinforced: boolean } {
  let strength = rel.strength;
  let decayed = false;
  let reinforced = false;
  if (!isYoung && decayRate !== 'none') {
    const decayAmount = getDecayAmount(decayRate, metricCtx) * modifier;
    strength = Math.max(0, strength - decayAmount);
    decayed = true;
  }
  if (proximityRelationshipKinds.length > 0 &&
      areInProximity(graphView, rel.src, rel.dst, proximityRelationshipKinds)) {
    strength = Math.min(maxStrength, strength + reinforcementBonus * modifier);
    reinforced = true;
  }
  return { strength, decayed, reinforced };
}

// =============================================================================
// SYSTEM CREATION
// =============================================================================

/**
 * Create a Relationship Maintenance system with the given configuration.
 */
class RelationshipMaintenanceSystem implements SimulationSystem {
  readonly id: string;
  readonly name: string;
  state: unknown = null;
  private readonly frequency: number;
  private readonly cullThreshold: number;
  private readonly gracePeriod: number;
  private readonly reinforcementBonus: number;
  private readonly maxStrength: number;
  private readonly proximityKinds: string[];

  constructor(config: RelationshipMaintenanceConfig) {
    this.id = config.id || 'relationship_maintenance';
    this.name = config.name || 'Relationship Maintenance';
    this.frequency = config.maintenanceFrequency;
    this.cullThreshold = config.cullThreshold;
    this.gracePeriod = config.gracePeriod;
    this.reinforcementBonus = config.reinforcementBonus;
    this.maxStrength = config.maxStrength;
    this.proximityKinds = config.proximityRelationshipKinds;
  }

  initialize(): void { /* no-op */ }

  apply(graphView: WorldRuntime, modifier: number = 1.0): SystemResult {
    if (graphView.tick % this.frequency !== 0) {
      return { relationshipsAdded: [], relationshipsAdjusted: [], relationshipsToArchive: [], entitiesModified: [], pressureChanges: {}, description: 'Relationship maintenance dormant', details: {}, narrationsByGroup: {} };
    }

    const allRels = graphView.getAllRelationships({ includeHistorical: true });
    const originalCount = allRels.filter(r => r.status !== 'historical').length;
    const stats = { decayed: 0, reinforced: 0, archived: 0, removed: 0 };
    const metricCtx = createSystemContext(graphView);
    const maintained: Relationship[] = [];
    const modifiedIds = new Set<string>();

    for (const rel of allRels) {
      if (rel.status === 'historical') { maintained.push(rel); continue; }
      this.processRelationship(rel, graphView, metricCtx, modifier, stats, maintained, modifiedIds);
    }

    graphView.setRelationships(maintained);
    const ctx: ActionContext = { source: 'framework', sourceId: this.id, success: true };
    return {
      relationshipsAdded: [],
      relationshipsAdjusted: [],
      relationshipsToArchive: [],
      entitiesModified: Array.from(modifiedIds).map(id => ({ id, changes: { updatedAt: graphView.tick }, actionContext: ctx, narrativeGroupId: '' })),
      pressureChanges: {},
      description: buildMaintenanceDescription(stats.decayed, stats.reinforced, stats.archived, stats.removed, originalCount),
      details: {},
      narrationsByGroup: {},
    };
  }

  private processRelationship(
    rel: Relationship, graphView: WorldRuntime,
    metricCtx: ReturnType<typeof createSystemContext>, modifier: number,
    stats: { decayed: number; reinforced: number; archived: number; removed: number },
    maintained: Relationship[], modifiedIds: Set<string>
  ): void {
    const src = graphView.getEntity(rel.src);
    const dst = graphView.getEntity(rel.dst);
    if (!src || !dst) { stats.removed++; return; }

    const age = Math.min(graphView.tick - src.createdAt, graphView.tick - dst.createdAt);
    const isYoung = age < this.gracePeriod;
    const decayRate = getDecayRate(graphView, rel.kind);
    const cullable = isCullable(graphView, rel.kind);

    const update = computeUpdatedStrength(rel, isYoung, decayRate, metricCtx, modifier, this.proximityKinds, this.reinforcementBonus, this.maxStrength, graphView);
    if (update.decayed) stats.decayed++;
    if (update.reinforced) stats.reinforced++;

    if (!isYoung && cullable && update.strength < this.cullThreshold) {
      stats.archived++;
      rel.status = 'historical';
      rel.archived = { occurred: true, tick: graphView.tick };
      src.updatedAt = graphView.tick;
      dst.updatedAt = graphView.tick;
      modifiedIds.add(src.id);
      modifiedIds.add(dst.id);
      maintained.push(rel);
      return;
    }

    if (rel.strength !== update.strength) rel.strength = update.strength;
    maintained.push(rel);
  }
}

export function createRelationshipMaintenanceSystem(config: RelationshipMaintenanceConfig): SimulationSystem {
  return new RelationshipMaintenanceSystem(config);
}

