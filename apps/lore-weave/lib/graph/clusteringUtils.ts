/**
 * Clustering Utilities
 *
 * Domain-agnostic clustering functions for grouping similar entities.
 * Used by SimulationSystems that need to detect and form clusters
 * (e.g., meta-entity formation, faction consolidation).
 */

import { HardState, EntityTags } from '../core/worldTypes';
import { WorldRuntime } from '../runtime/worldRuntime';
import { FRAMEWORK_STATUS, FRAMEWORK_TAGS } from '@canonry/world-schema';
import { hasTag } from '../utils';

/**
 * Result of clustering operation
 */
export interface Cluster {
  /** Entities in this cluster */
  entities: HardState[];
  /** Similarity score of the cluster */
  score: number;
  /** Which criteria contributed to clustering */
  matchedCriteria: string[];
}

/**
 * Criterion types for calculating similarity between entities
 */
export type ClusterCriterionType =
  | 'shared_relationship'    // Share a relationship of specific kind to same entity
  | 'shared_tags'            // Have overlapping tags
  | 'temporal_proximity'     // Created close in time
  | 'same_subtype'           // Have the same subtype
  | 'same_culture'           // Have the same culture
  | 'custom';                // Custom predicate function

/**
 * Configuration for a clustering criterion
 */
export interface ClusterCriterion {
  /** Type of criterion */
  type: ClusterCriterionType;

  /** Weight contribution to similarity score */
  weight: number;

  /** Optional threshold for this criterion */
  threshold?: number;

  /** For 'shared_relationship': the relationship kind to check */
  relationshipKind?: string;

  /** For 'shared_relationship': direction to check ('src' = this entity is src, 'dst' = this entity is dst) */
  direction?: 'src' | 'dst';

  /** For 'custom': custom predicate function */
  predicate?: (e1: HardState, e2: HardState, graphView: WorldRuntime) => boolean;
}

/**
 * Configuration for clustering operation
 */
export interface ClusterConfig {
  /** Minimum entities required to form a cluster */
  minSize: number;

  /** Maximum entities in a cluster (optional) */
  maxSize?: number;

  /** Criteria for calculating similarity */
  criteria: ClusterCriterion[];

  /** Minimum total similarity score to be clustered together */
  minimumScore: number;

  /** Similarity threshold multiplier for adding to existing cluster (default: 0.7) */
  clusterJoinThreshold?: number;
}

/**
 * Calculate similarity score between two entities based on criteria
 */
export function calculateSimilarity(
  e1: HardState,
  e2: HardState,
  criteria: ClusterCriterion[],
  graphView: WorldRuntime
): { score: number; matchedCriteria: string[] } {
  let score = 0;
  const matchedCriteria: string[] = [];

  for (const criterion of criteria) {
    let matches = false;

    switch (criterion.type) {
      case 'shared_relationship': {
        if (!criterion.relationshipKind) break;
        const direction = criterion.direction || 'src';

        const e1Related = graphView.getConnectedEntities(e1.id, criterion.relationshipKind, direction);
        const e2Related = graphView.getConnectedEntities(e2.id, criterion.relationshipKind, direction);
        const e1RelatedIds = new Set(e1Related.map(r => r.id));
        matches = e2Related.some(r => e1RelatedIds.has(r.id));
        break;
      }

      case 'shared_tags': {
        const e1Tags = new Set(Object.keys(e1.tags || {}));
        const e2Tags = new Set(Object.keys(e2.tags || {}));
        const intersection = Array.from(e1Tags).filter(t => e2Tags.has(t)).length;
        const union = new Set([...e1Tags, ...e2Tags]).size;
        const jaccard = union > 0 ? intersection / union : 0;
        matches = jaccard >= (criterion.threshold || 0.3);
        break;
      }

      case 'temporal_proximity': {
        const timeDiff = Math.abs(e1.createdAt - e2.createdAt);
        matches = timeDiff <= (criterion.threshold || 30);
        break;
      }

      case 'same_subtype': {
        matches = e1.subtype === e2.subtype;
        break;
      }

      case 'same_culture': {
        matches = e1.culture === e2.culture;
        break;
      }

      case 'custom': {
        if (criterion.predicate) {
          matches = criterion.predicate(e1, e2, graphView);
        }
        break;
      }
    }

    if (matches) {
      score += criterion.weight;
      matchedCriteria.push(criterion.type);
    }
  }

  return { score, matchedCriteria };
}

/**
 * Detect clusters of similar entities using greedy clustering algorithm.
 *
 * Algorithm:
 * 1. Sort entities by creation time (chronological clustering)
 * 2. For each entity, try to add to existing cluster if similar enough
 * 3. If no match, create new cluster with this entity
 * 4. Filter clusters by minimum size
 *
 * @param entities - Entities to cluster
 * @param config - Clustering configuration
 * @param graphView - Graph view for relationship queries
 * @returns Array of detected clusters
 */
export function detectClusters(
  entities: HardState[],
  config: ClusterConfig,
  graphView: WorldRuntime
): Cluster[] {
  if (entities.length < config.minSize) {
    return [];
  }

  // Sort by creation time (cluster chronologically related entities)
  const sorted = [...entities].sort((a, b) => a.createdAt - b.createdAt);

  // Greedy clustering: try to add each entity to an existing cluster or create new one
  const clusters: Cluster[] = [];
  const clusterJoinThreshold = config.clusterJoinThreshold ?? 0.7;

  for (const entity of sorted) {
    let addedToCluster = false;

    // Try to add to existing cluster
    for (const cluster of clusters) {
      // Check if entity is similar enough to cluster members
      let clusterScore = 0;
      let matchCount = 0;
      const allMatchedCriteria: string[] = [];

      for (const member of cluster.entities) {
        const { score, matchedCriteria } = calculateSimilarity(
          entity,
          member,
          config.criteria,
          graphView
        );
        if (score > 0) {
          clusterScore += score;
          matchCount++;
          allMatchedCriteria.push(...matchedCriteria);
        }
      }

      // Average similarity to cluster members
      const avgSimilarity = matchCount > 0 ? clusterScore / matchCount : 0;

      // If similar enough, add to cluster
      if (avgSimilarity >= config.minimumScore * clusterJoinThreshold) {
        cluster.entities.push(entity);
        cluster.score = (cluster.score + avgSimilarity) / 2; // Update cluster score
        cluster.matchedCriteria = [...new Set([...cluster.matchedCriteria, ...allMatchedCriteria])];
        addedToCluster = true;
        break;
      }
    }

    // If not added to any cluster, create new cluster
    if (!addedToCluster) {
      clusters.push({
        entities: [entity],
        score: config.minimumScore,
        matchedCriteria: []
      });
    }
  }

  // Filter clusters by minimum size and apply maximum size
  const validClusters = clusters.filter(c => {
    if (c.entities.length < config.minSize) return false;
    if (config.maxSize && c.entities.length > config.maxSize) {
      // Truncate cluster to max size (keep earliest created)
      c.entities = c.entities.slice(0, config.maxSize);
    }
    return true;
  });

  return validClusters;
}

/**
 * Filter entities that are eligible for clustering.
 * Excludes historical entities and meta-entities.
 *
 * @param entities - All entities to filter
 * @returns Filtered entities eligible for clustering
 */
export function filterClusterableEntities(entities: HardState[]): HardState[] {
  return entities.filter(e =>
    e.status !== FRAMEWORK_STATUS.HISTORICAL &&
    e.status !== FRAMEWORK_STATUS.SUBSUMED &&
    !hasTag(e.tags, FRAMEWORK_TAGS.META_ENTITY)
  );
}

/**
 * Find the best cluster match for a new entity.
 * Useful for deciding which existing cluster to add a new entity to.
 *
 * @param entity - Entity to find cluster for
 * @param clusters - Existing clusters
 * @param criteria - Similarity criteria
 * @param graphView - Graph view for relationship queries
 * @param minimumScore - Minimum score to be considered a match
 * @returns Best matching cluster or undefined
 */
export function findBestClusterMatch(
  entity: HardState,
  clusters: Cluster[],
  criteria: ClusterCriterion[],
  graphView: WorldRuntime,
  minimumScore: number
): Cluster | undefined {
  let bestCluster: Cluster | undefined;
  let bestScore = 0;

  for (const cluster of clusters) {
    let totalScore = 0;
    let count = 0;

    for (const member of cluster.entities) {
      const { score } = calculateSimilarity(entity, member, criteria, graphView);
      totalScore += score;
      count++;
    }

    const avgScore = count > 0 ? totalScore / count : 0;

    if (avgScore >= minimumScore && avgScore > bestScore) {
      bestCluster = cluster;
      bestScore = avgScore;
    }
  }

  return bestCluster;
}
