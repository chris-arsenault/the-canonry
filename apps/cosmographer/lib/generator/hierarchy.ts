/**
 * Hierarchy Generator
 *
 * Generates plane hierarchies from semantic classifications.
 * Uses category relationships, priorities, and domain hints.
 */

import type {
  PlaneSpecification,
  SemanticAnalysisResult,
  GeneratedPlaneHierarchy,
  CosmographerInput,
} from '../types/index.js';

import {
  getCategory,
  canBeChildOf,
  categoryDistance
} from '../ontology/index.js';

/**
 * Internal representation of a plane during generation.
 */
interface PlaneNode {
  id: string;
  spec: PlaneSpecification;
  classification: SemanticAnalysisResult;
  priority: number;
  saturationThreshold: number;
  children: string[];
  visited: boolean;
}

/**
 * Determine priority for a plane based on classification and hints.
 */
function determinePriority(
  spec: PlaneSpecification,
  classification: SemanticAnalysisResult
): number {
  // Explicit hint takes precedence
  if (spec.hints?.priority !== undefined) {
    return spec.hints.priority;
  }

  // Primary hint = priority 1
  if (spec.hints?.isPrimary) {
    return 1;
  }

  // Use category's base priority
  const category = getCategory(classification.bestMatch);
  return category?.basePriority ?? 3;
}

/**
 * Determine saturation threshold for a plane.
 */
function determineSaturation(
  spec: PlaneSpecification,
  classification: SemanticAnalysisResult
): number {
  // Explicit hint takes precedence
  if (spec.hints?.saturationThreshold !== undefined) {
    return spec.hints.saturationThreshold;
  }

  // Use category's default saturation
  const category = getCategory(classification.bestMatch);
  return category?.defaultSaturation ?? 0.8;
}

/**
 * Determine valid children for a plane based on category and hints.
 */
function determineChildren(
  node: PlaneNode,
  allNodes: Map<string, PlaneNode>
): string[] {
  const spec = node.spec;
  const classification = node.classification;

  // Explicit cascadeTo hint takes precedence
  if (spec.hints?.cascadeTo && spec.hints.cascadeTo.length > 0) {
    return spec.hints.cascadeTo.filter(id => allNodes.has(id));
  }

  const candidates: Array<{ id: string; score: number }> = [];
  const neverCascade = new Set(spec.hints?.neverCascadeTo ?? []);

  for (const [id, candidateNode] of allNodes) {
    // Skip self
    if (id === node.id) continue;

    // Skip if explicitly excluded
    if (neverCascade.has(id)) continue;

    // Skip if already higher priority (would be parent, not child)
    if (candidateNode.priority <= node.priority) continue;

    // Check category compatibility
    const nodeCategory = classification.bestMatch;
    const candidateCategory = candidateNode.classification.bestMatch;

    let score = 0;

    // Higher priority difference = better child candidate
    score += (candidateNode.priority - node.priority) * 0.3;

    // Category relationship compatibility
    if (canBeChildOf(candidateCategory, nodeCategory)) {
      score += 0.5;
    }

    // Category semantic distance (closer = better child)
    const catDist = categoryDistance(nodeCategory, candidateCategory);
    score += Math.max(0, 1 - catDist * 0.2);

    if (score > 0) {
      candidates.push({ id, score });
    }
  }

  // Sort by score and take top candidates
  candidates.sort((a, b) => b.score - a.score);

  // Limit children to reasonable number (max 3)
  return candidates.slice(0, 3).map(c => c.id);
}

/** Find the node with the lowest priority value. */
function findPrimaryNode(nodes: Map<string, PlaneNode>): string | null {
  let primaryId: string | null = null;
  let lowestPriority = Infinity;

  for (const [id, node] of nodes) {
    if (node.priority < lowestPriority) {
      lowestPriority = node.priority;
      primaryId = id;
    }
  }

  return primaryId;
}

/** BFS traversal from a start node, returning visited order. */
function bfsTraversal(startId: string, nodes: Map<string, PlaneNode>): { order: string[]; visited: Set<string> } {
  const order: string[] = [];
  const queue: string[] = [startId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;

    visited.add(current);
    order.push(current);

    const node = nodes.get(current);
    if (!node) continue;
    for (const childId of node.children) {
      if (!visited.has(childId)) {
        queue.push(childId);
      }
    }
  }

  return { order, visited };
}

/**
 * Build hierarchy from nodes using BFS from primary.
 */
function buildHierarchyOrder(nodes: Map<string, PlaneNode>): string[] {
  const primaryId = findPrimaryNode(nodes);
  if (!primaryId) {
    return Array.from(nodes.keys());
  }

  const { order, visited } = bfsTraversal(primaryId, nodes);

  // Add any remaining unvisited nodes (disconnected)
  for (const id of nodes.keys()) {
    if (!visited.has(id)) {
      order.push(id);
    }
  }

  return order;
}

/**
 * Generate plane hierarchy from input and classifications.
 */
export function generateHierarchy(
  input: CosmographerInput,
  classifications: Map<string, SemanticAnalysisResult>
): GeneratedPlaneHierarchy[] {
  // Build nodes
  const nodes = new Map<string, PlaneNode>();

  for (const spec of input.planes) {
    const classification = classifications.get(spec.id);
    if (!classification) continue;

    const node: PlaneNode = {
      id: spec.id,
      spec,
      classification,
      priority: determinePriority(spec, classification),
      saturationThreshold: determineSaturation(spec, classification),
      children: [],
      visited: false
    };

    nodes.set(spec.id, node);
  }

  // Determine children for each node
  for (const node of nodes.values()) {
    node.children = determineChildren(node, nodes);
  }

  // Remove circular references (child can't also be ancestor)
  for (const node of nodes.values()) {
    const ancestors = new Set<string>();

    // Walk up to find ancestors
    for (const [id, n] of nodes) {
      if (n.children.includes(node.id)) {
        ancestors.add(id);
      }
    }

    // Remove any ancestors from children
    node.children = node.children.filter(id => !ancestors.has(id));
  }

  // Build traversal order
  const order = buildHierarchyOrder(nodes);

  // Generate output
  const hierarchy: GeneratedPlaneHierarchy[] = [];

  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    const node = nodes.get(id);
    if (!node) continue;

    // Filter children to only include those that come after in order
    const orderSet = new Set(order.slice(i + 1));
    const validChildren = node.children.filter(c => orderSet.has(c));

    hierarchy.push({
      planeId: id,
      children: validChildren,
      saturationThreshold: node.saturationThreshold,
      priority: i + 1 // Renumber based on actual order
    });
  }

  return hierarchy;
}

/** Compute the distance between two planes, using hints or category analysis. */
function computePairDistance(
  from: string,
  to: string,
  hintMap: Map<string, number>,
  classifications: Map<string, SemanticAnalysisResult>
): number {
  if (from === to) return 0;

  const hintKey = `${from}:${to}`;
  if (hintMap.has(hintKey)) return hintMap.get(hintKey)!;

  const fromClass = classifications.get(from);
  const toClass = classifications.get(to);

  if (!fromClass || !toClass) return 2.0;

  const catDist = categoryDistance(fromClass.bestMatch, toClass.bestMatch);
  const fromAccess = getCategory(fromClass.bestMatch)?.accessibilityWeight ?? 1.0;
  const toAccess = getCategory(toClass.bestMatch)?.accessibilityWeight ?? 1.0;
  const avgAccess = (fromAccess + toAccess) / 2;

  return Math.max(1, catDist * (2 - avgAccess));
}

/**
 * Generate cross-plane distance matrix.
 */
export function generateDistances(
  input: CosmographerInput,
  classifications: Map<string, SemanticAnalysisResult>
): Record<string, Record<string, number>> {
  const distances: Record<string, Record<string, number>> = {};
  const planeIds = input.planes.map(p => p.id);

  // Build hint lookup
  const hintMap = new Map<string, number>();
  for (const hint of input.distanceHints ?? []) {
    const key = `${hint.from}:${hint.to}`;
    const value = typeof hint.hint === 'number'
      ? hint.hint
      : hintToNumber(hint.hint);
    hintMap.set(key, value);
    hintMap.set(`${hint.to}:${hint.from}`, value); // Symmetric
  }

  for (const from of planeIds) {
    distances[from] = {};

    for (const to of planeIds) {
      distances[from][to] = computePairDistance(from, to, hintMap, classifications);
    }
  }

  return distances;
}

/**
 * Convert hint string to numeric distance.
 */
function hintToNumber(hint: string): number {
  switch (hint) {
    case 'adjacent': return 1.0;
    case 'near': return 1.5;
    case 'moderate': return 2.0;
    case 'difficult': return 3.0;
    case 'very_difficult': return 4.0;
    case 'extreme': return 5.0;
    default: return 2.0;
  }
}

/**
 * Generate axis weights based on domain class.
 */
export function generateAxisWeights(
  input: CosmographerInput
): {
  plane: number;
  sector_x: number;
  sector_y: number;
  cell_x: number;
  cell_y: number;
  z_band: number;
} {
  // Base weights depend on space type
  switch (input.spaceType) {
    case 'spatial':
      // Physical space - plane changes expensive
      return {
        plane: 10.0,
        sector_x: 1.0,
        sector_y: 1.0,
        cell_x: 0.1,
        cell_y: 0.1,
        z_band: 2.0
      };

    case 'metaphysical':
      // Spirit planes - more fluid transitions
      return {
        plane: 5.0,
        sector_x: 0.5,
        sector_y: 0.5,
        cell_x: 0.05,
        cell_y: 0.05,
        z_band: 3.0
      };

    case 'conceptual':
      // Abstract systems - sector matters less
      return {
        plane: 8.0,
        sector_x: 0.3,
        sector_y: 0.3,
        cell_x: 0.02,
        cell_y: 0.02,
        z_band: 1.0
      };

    case 'hybrid':
    default:
      // Balanced
      return {
        plane: 7.0,
        sector_x: 0.7,
        sector_y: 0.7,
        cell_x: 0.07,
        cell_y: 0.07,
        z_band: 1.5
      };
  }
}
