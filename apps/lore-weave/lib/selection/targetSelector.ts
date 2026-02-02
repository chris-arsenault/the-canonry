/**
 * Target Selector Service
 *
 * Framework-level weighted target selection that prevents super-hub formation.
 *
 * Problem: Naive target selection creates "super-hub" entities with dozens of connections,
 * making graphs unrealistic. Templates repeatedly select the same popular entities.
 *
 * Solution: Score-based selection with exponential penalties for existing connections,
 * similar to template diversity pressure. Can create new entities when all candidates
 * are oversaturated.
 */

import { Graph } from '../engine/types';
import { HardState, Relationship, ProminenceLabel } from '../core/worldTypes';
import { findEntities, hasTag } from '../utils';
import { prominenceLabel } from '../rules/types';

/**
 * Selection bias configuration - defines preferences and penalties
 */
export interface SelectionBias {
  /** Positive preferences - boost score for entities with these attributes */
  prefer?: {
    /** Preferred subtypes (e.g., ['merchant', 'outlaw'] for cult recruitment) */
    subtypes?: string[];

    /** Preferred tags (e.g., ['mystic', 'explorer']) */
    tags?: string[];

    /** Preferred prominence levels */
    prominence?: ProminenceLabel[];

    /** Same location as reference entity (for local recruitment) */
    sameLocationAs?: string; // Entity ID

    /**
     * Prefer entities matching this culture.
     * Culture is first-class - use this to create culturally cohesive groups.
     */
    sameCultureAs?: string;

    /** Boost multiplier for preferred attributes (default: 2.0) */
    preferenceBoost?: number;
  };

  /** Negative penalties - reduce score for oversaturated entities */
  avoid?: {
    /** Relationship kinds to penalize (e.g., ['member_of'] to avoid multi-faction NPCs) */
    relationshipKinds?: string[];

    /** Exponential hub penalty strength (default: 1.0, higher = more aggressive) */
    hubPenaltyStrength?: number;

    /** Hard cap - never select entities with this many total relationships */
    maxTotalRelationships?: number;

    /** Exclude entities already related to this entity */
    excludeRelatedTo?: {
      entityId: string;
      relationshipKind?: string; // If specified, only exclude this kind
    };

    /**
     * Penalty multiplier for entities with different culture than sameCultureAs.
     * Default: 1.0 (no penalty). Use 0.3-0.5 to make cross-culture selection rare.
     * Only applies when prefer.sameCultureAs is set.
     */
    differentCulturePenalty?: number;
  };

  /** Hard culture filters - applied before scoring */
  culture?: {
    /** Only select entities with this exact culture */
    require?: string;

    /** Exclude entities with any of these cultures */
    exclude?: string[];
  };

  /** Creation fallback - create new entity when all candidates are oversaturated */
  createIfSaturated?: {
    /** If best candidate score falls below this, create new entity (0-1, default: 0.1) */
    threshold: number;

    /** Factory function to create new entity */
    factory: (graph: Graph, context: SelectionContext) => Partial<HardState>;

    /** Maximum new entities to create per selection (default: count/2) */
    maxCreated?: number;
  };

  /** Diversity pressure - penalize recently selected entities */
  diversityTracking?: {
    /** Track ID for this selection type (e.g., 'cult_recruitment') */
    trackingId: string;

    /** Penalty strength (default: 1.0, uses same formula as template diversity) */
    strength?: number;
  };
}

/**
 * Context passed to creation factory
 */
export interface SelectionContext {
  /** The graph being operated on */
  graph: Graph;

  /** How many targets were requested */
  requestedCount: number;

  /** Best candidate score (to understand why creation was triggered) */
  bestCandidateScore: number;

  /** All candidates and their scores (for debugging) */
  candidates: Array<{ entity: HardState; score: number }>;
}

/**
 * Result of target selection
 */
export interface SelectionResult {
  /** Selected existing entities */
  existing: HardState[];

  /** Newly created entities (partial, need IDs assigned) */
  created: Array<Partial<HardState>>;

  /** Diagnostic info */
  diagnostics: {
    candidatesEvaluated: number;
    bestScore: number;
    worstScore: number;
    avgScore: number;
    creationTriggered: boolean;
    creationReason?: string;
  };
}

/**
 * Tracks selection history for diversity pressure
 */
class SelectionTracker {
  private selectionCounts: Map<string, Map<string, number>> = new Map();

  track(trackingId: string, entityId: string): void {
    if (!this.selectionCounts.has(trackingId)) {
      this.selectionCounts.set(trackingId, new Map());
    }
    const counts = this.selectionCounts.get(trackingId)!;
    counts.set(entityId, (counts.get(entityId) || 0) + 1);
  }

  getCount(trackingId: string, entityId: string): number {
    return this.selectionCounts.get(trackingId)?.get(entityId) || 0;
  }

  reset(trackingId?: string): void {
    if (trackingId) {
      this.selectionCounts.delete(trackingId);
    } else {
      this.selectionCounts.clear();
    }
  }
}

/**
 * Target Selector - Framework service for intelligent entity selection
 */
export class TargetSelector {
  private tracker = new SelectionTracker();

  /**
   * Select entities using weighted scoring with hub penalties
   *
   * @param graph - World graph
   * @param kind - Entity kind to select
   * @param count - Number of entities to select
   * @param bias - Selection preferences and penalties
   * @returns Selection result with existing + created entities
   */
  selectTargets(
    graph: Graph,
    kind: string,
    count: number,
    bias: SelectionBias = {}
  ): SelectionResult {
    // Find all candidate entities
    const candidates = graph.getEntities()
      .filter(e => e.kind === kind);

    if (candidates.length === 0) {
      // No candidates at all - must create if factory provided
      if (bias.createIfSaturated?.factory) {
        return this.createNewEntities(graph, count, bias, []);
      }
      return this.emptyResult();
    }

    // Score all candidates
    const scored = candidates.map(entity => ({
      entity,
      score: this.scoreCandidate(graph, entity, bias)
    }));

    // Apply hard filters (maxTotalRelationships, excludeRelatedTo)
    const filtered = this.applyHardFilters(graph, scored, bias);

    // Sort by score (highest first)
    filtered.sort((a, b) => b.score - a.score);

    // Check if best candidate is below saturation threshold
    const bestScore = filtered.length > 0 ? filtered[0].score : 0;
    const threshold = bias.createIfSaturated?.threshold ?? 0.1;

    if (bestScore < threshold && bias.createIfSaturated?.factory) {
      // All candidates oversaturated - create new entities
      return this.createNewEntities(graph, count, bias, filtered);
    }

    // Select top N candidates
    const selected = filtered.slice(0, count).map(s => s.entity);

    // Track selections for diversity
    if (bias.diversityTracking?.trackingId) {
      selected.forEach(e => this.tracker.track(bias.diversityTracking!.trackingId, e.id));
    }

    // Calculate diagnostics
    const scores = filtered.map(s => s.score);
    const diagnostics = {
      candidatesEvaluated: candidates.length,
      bestScore: Math.max(...scores, 0),
      worstScore: Math.min(...scores, 0),
      avgScore: scores.reduce((a, b) => a + b, 0) / scores.length || 0,
      creationTriggered: false
    };

    return {
      existing: selected,
      created: [],
      diagnostics
    };
  }

  /**
   * Score a candidate entity based on bias configuration
   * Higher score = more desirable target
   */
  private scoreCandidate(
    graph: Graph,
    entity: HardState,
    bias: SelectionBias
  ): number {
    let score = 1.0; // Base score

    // === POSITIVE PREFERENCES ===
    if (bias.prefer) {
      const boost = bias.prefer.preferenceBoost ?? 2.0;

      // Subtype preference
      if (bias.prefer.subtypes?.includes(entity.subtype)) {
        score *= boost;
      }

      // Tag preference
      if (bias.prefer.tags?.some(tag => hasTag(entity.tags, tag))) {
        score *= boost;
      }

      // Prominence preference
      if (bias.prefer.prominence?.includes(prominenceLabel(entity.prominence))) {
        score *= boost;
      }

      // Location preference (same location as reference)
      if (bias.prefer.sameLocationAs) {
        const refEntity = graph.getEntity(bias.prefer.sameLocationAs);
        const refLocations = refEntity
          ? new Set(
              graph.getEntityRelationships(refEntity.id, 'src')
                .filter(r => r.kind === 'resident_of')
                .map(r => r.dst)
            )
          : new Set<string>();
        const sameLocation = refLocations.size > 0 &&
          graph.getEntityRelationships(entity.id, 'src').some(
            r => r.kind === 'resident_of' && refLocations.has(r.dst)
          );
        if (sameLocation) {
          score *= boost;
        }
      }

      // Culture preference (same culture as reference)
      if (bias.prefer.sameCultureAs) {
        if (entity.culture === bias.prefer.sameCultureAs) {
          score *= boost;
        } else {
          // Apply cross-culture penalty if configured
          const crossCulturePenalty = bias.avoid?.differentCulturePenalty ?? 1.0;
          score *= crossCulturePenalty;
        }
      }
    }

    // === NEGATIVE PENALTIES ===
    if (bias.avoid) {
      // Count penalized relationships
      let penalizedCount = 0;
      if (bias.avoid.relationshipKinds) {
        penalizedCount = graph.getEntityRelationships(entity.id, 'both').filter(r =>
          bias.avoid!.relationshipKinds!.includes(r.kind)
        ).length;
      }

      // Hub penalty - exponential penalty for high-degree nodes
      // Formula: score *= (1 / (1 + count^strength))
      // Same formula as template diversity!
      const strength = bias.avoid.hubPenaltyStrength ?? 1.0;
      if (penalizedCount > 0) {
        const penalty = 1 / (1 + Math.pow(penalizedCount, strength));
        score *= penalty;
      }

      // Total relationship penalty (general hub avoidance)
      const totalLinks = graph.getEntityRelationships(entity.id, 'both').length;
      if (totalLinks > 5) { // Only penalize if significantly connected
        const generalPenalty = 1 / (1 + Math.pow(totalLinks - 5, 0.5));
        score *= generalPenalty;
      }
    }

    // === DIVERSITY PRESSURE ===
    if (bias.diversityTracking) {
      const selectionCount = this.tracker.getCount(
        bias.diversityTracking.trackingId,
        entity.id
      );
      if (selectionCount > 0) {
        const strength = bias.diversityTracking.strength ?? 1.0;
        const diversityPenalty = 1 / (1 + Math.pow(selectionCount, strength));
        score *= diversityPenalty;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Apply hard filters that completely exclude candidates
   */
  private applyHardFilters(
    graph: Graph,
    scored: Array<{ entity: HardState; score: number }>,
    bias: SelectionBias
  ): Array<{ entity: HardState; score: number }> {
    let filtered = scored;

    // Culture hard filters (applied first for efficiency)
    if (bias.culture?.require) {
      filtered = filtered.filter(s => s.entity.culture === bias.culture!.require);
    }

    if (bias.culture?.exclude?.length) {
      filtered = filtered.filter(s => !bias.culture!.exclude!.includes(s.entity.culture));
    }

    if (bias.avoid?.maxTotalRelationships !== undefined) {
      filtered = filtered.filter(
        s => graph.getEntityRelationships(s.entity.id, 'both').length < bias.avoid!.maxTotalRelationships!
      );
    }

    if (bias.avoid?.excludeRelatedTo) {
      const { entityId, relationshipKind } = bias.avoid.excludeRelatedTo;
      filtered = filtered.filter(s => {
        const hasRelationship = graph.getRelationships().some(r =>
          (r.src === s.entity.id && r.dst === entityId ||
           r.src === entityId && r.dst === s.entity.id) &&
          (!relationshipKind || r.kind === relationshipKind)
        );
        return !hasRelationship;
      });
    }

    return filtered;
  }

  /**
   * Create new entities when all candidates are oversaturated
   */
  private createNewEntities(
    graph: Graph,
    count: number,
    bias: SelectionBias,
    candidates: Array<{ entity: HardState; score: number }>
  ): SelectionResult {
    const factory = bias.createIfSaturated!.factory;
    const maxCreated = bias.createIfSaturated!.maxCreated ?? Math.ceil(count / 2);
    const numToCreate = Math.min(count, maxCreated);

    const context: SelectionContext = {
      graph,
      requestedCount: count,
      bestCandidateScore: candidates.length > 0 ? candidates[0].score : 0,
      candidates
    };

    const created: Array<Partial<HardState>> = [];
    for (let i = 0; i < numToCreate; i++) {
      created.push(factory(graph, context));
    }

    // Fill remaining slots with best existing candidates if needed
    const remaining = count - numToCreate;
    const existing = candidates.slice(0, remaining).map(s => s.entity);

    const scores = candidates.map(s => s.score);
    return {
      existing,
      created,
      diagnostics: {
        candidatesEvaluated: candidates.length,
        bestScore: Math.max(...scores, 0),
        worstScore: Math.min(...scores, 0),
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length || 0,
        creationTriggered: true,
        creationReason: `Best score ${context.bestCandidateScore.toFixed(2)} < threshold ${bias.createIfSaturated!.threshold}`
      }
    };
  }

  private emptyResult(): SelectionResult {
    return {
      existing: [],
      created: [],
      diagnostics: {
        candidatesEvaluated: 0,
        bestScore: 0,
        worstScore: 0,
        avgScore: 0,
        creationTriggered: false
      }
    };
  }

  /**
   * Reset diversity tracking (call at epoch boundaries or specific events)
   */
  resetDiversityTracking(trackingId?: string): void {
    this.tracker.reset(trackingId);
  }
}
