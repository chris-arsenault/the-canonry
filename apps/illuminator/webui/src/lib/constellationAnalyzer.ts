/**
 * Constellation Analyzer
 *
 * Analyzes entity constellations for perspective synthesis.
 * Pure TypeScript - no LLM calls. Computes signals from the entity set.
 */

import type {
  EntityContext,
  RelationshipContext,
  NarrativeEventContext,
  EraContext,
} from './chronicleTypes';

// =============================================================================
// Types
// =============================================================================

export interface ConstellationInput {
  entities: EntityContext[];
  relationships: RelationshipContext[];
  events: NarrativeEventContext[];
  focalEra?: EraContext;
}

export type CultureBalance = 'single' | 'dominant' | 'mixed';
export type KindFocus = 'character' | 'place' | 'object' | 'event' | 'mixed';
export type SpatialSpread = 'tight' | 'dispersed';
export type EraSpan = 'single' | 'multiple';

export interface EntityConstellation {
  // Culture distribution
  cultures: Record<string, number>;
  dominantCulture: string | null;
  cultureBalance: CultureBalance;

  // Kind distribution
  kinds: Record<string, number>;
  dominantKind: string | null;
  kindFocus: KindFocus;

  // Entity tags (aggregated)
  tagFrequency: Record<string, number>;
  prominentTags: string[];

  // Relationships
  relationshipKinds: Record<string, number>;

  // Temporal
  focalEraId: string | null;
  eraSpan: EraSpan;

  // Spatial (if coordinates available)
  coordinateCentroid?: { x: number; y: number };
  spatialSpread: SpatialSpread;

  // Computed focus description (for prompt)
  focusSummary: string;
}

// =============================================================================
// Helper Functions
// =============================================================================


/**
 * Compute kind focus from kind distribution
 */
function computeKindFocus(kinds: Record<string, number>): KindFocus {
  const total = Object.values(kinds).reduce((a, b) => a + b, 0);
  if (total === 0) return 'mixed';

  const entries = Object.entries(kinds).sort((a, b) => b[1] - a[1]);
  const [topKind, topCount] = entries[0] || ['unknown', 0];
  const topRatio = topCount / total;

  // If one kind dominates (>50%), use that focus
  if (topRatio > 0.5) {
    switch (topKind) {
      case 'npc':
      case 'character':
        return 'character';
      case 'location':
      case 'place':
        return 'place';
      case 'artifact':
      case 'object':
      case 'item':
        return 'object';
      case 'occurrence':
      case 'event':
        return 'event';
      default:
        return 'mixed';
    }
  }

  return 'mixed';
}

/**
 * Build a human-readable focus summary
 */
function buildFocusSummary(
  cultureBalance: CultureBalance,
  topCulture: string | null,
  kindFocus: KindFocus,
  prominentTags: string[],
  relationshipKinds: Record<string, number>
): string {
  const parts: string[] = [];

  // Culture part
  if (cultureBalance === 'single' && topCulture) {
    parts.push(`${topCulture}-focused`);
  } else if (cultureBalance === 'dominant' && topCulture) {
    parts.push(`${topCulture}-dominant`);
  } else {
    parts.push('cross-cultural');
  }

  // Kind part
  if (kindFocus !== 'mixed') {
    parts.push(`${kindFocus}-centered`);
  }

  // Relationship kinds
  const relKinds = Object.keys(relationshipKinds);
  if (relKinds.length > 0) {
    parts.push(`relationships: ${relKinds.slice(0, 3).join(', ')}`);
  }

  // Tags
  if (prominentTags.length > 0) {
    parts.push(`themes: ${prominentTags.slice(0, 3).join(', ')}`);
  }

  return parts.join(', ');
}

/**
 * Compute centroid of entity coordinates
 */
function computeCentroid(
  entities: EntityContext[]
): { x: number; y: number } | undefined {
  const withCoords = entities.filter((e) => e.coordinates);
  if (withCoords.length === 0) return undefined;

  const sum = withCoords.reduce(
    (acc, e) => ({
      x: acc.x + (e.coordinates?.x || 0),
      y: acc.y + (e.coordinates?.y || 0),
    }),
    { x: 0, y: 0 }
  );

  return {
    x: sum.x / withCoords.length,
    y: sum.y / withCoords.length,
  };
}

/**
 * Compute spatial spread from entity coordinates
 */
function computeSpatialSpread(entities: EntityContext[]): SpatialSpread {
  const withCoords = entities.filter((e) => e.coordinates);
  if (withCoords.length < 2) return 'tight';

  const centroid = computeCentroid(entities);
  if (!centroid) return 'tight';

  // Compute average distance from centroid
  const avgDistance =
    withCoords.reduce((acc, e) => {
      const dx = (e.coordinates?.x || 0) - centroid.x;
      const dy = (e.coordinates?.y || 0) - centroid.y;
      return acc + Math.sqrt(dx * dx + dy * dy);
    }, 0) / withCoords.length;

  // Threshold for dispersed (arbitrary, can be tuned)
  return avgDistance > 0.3 ? 'dispersed' : 'tight';
}

// =============================================================================
// Main Analyzer
// =============================================================================

/**
 * Analyze entity constellation to derive signals for perspective synthesis.
 *
 * This is a pure function with no LLM calls. It computes culture mix,
 * kind focus, tag frequency, relationship dynamics, and temporal scope
 * from the provided entity set.
 */
export function analyzeConstellation(
  input: ConstellationInput
): EntityConstellation {
  const { entities, relationships, events, focalEra } = input;
  const totalEntities = entities.length;

  // ==========================================================================
  // Culture Analysis
  // ==========================================================================

  const cultures: Record<string, number> = {};
  for (const e of entities) {
    if (e.culture) {
      cultures[e.culture] = (cultures[e.culture] || 0) + 1;
    }
  }

  const cultureEntries = Object.entries(cultures).sort((a, b) => b[1] - a[1]);
  const [topCulture, topCultureCount] = cultureEntries[0] || [null, 0];

  let cultureBalance: CultureBalance;
  if (totalEntities === 0) {
    cultureBalance = 'mixed';
  } else if (topCultureCount / totalEntities > 0.8) {
    cultureBalance = 'single';
  } else if (topCultureCount / totalEntities > 0.5) {
    cultureBalance = 'dominant';
  } else {
    cultureBalance = 'mixed';
  }

  // ==========================================================================
  // Kind Analysis
  // ==========================================================================

  const kinds: Record<string, number> = {};
  for (const e of entities) {
    kinds[e.kind] = (kinds[e.kind] || 0) + 1;
  }

  const kindEntries = Object.entries(kinds).sort((a, b) => b[1] - a[1]);
  const [topKind] = kindEntries[0] || [null];

  const kindFocus = computeKindFocus(kinds);

  // ==========================================================================
  // Tag Aggregation
  // ==========================================================================

  const tagFrequency: Record<string, number> = {};
  for (const e of entities) {
    if (e.tags) {
      for (const [key, value] of Object.entries(e.tags)) {
        if (value) {
          tagFrequency[key] = (tagFrequency[key] || 0) + 1;
        }
      }
    }
  }

  const prominentTags = Object.entries(tagFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  // ==========================================================================
  // Relationship Analysis
  // ==========================================================================

  const relationshipKinds: Record<string, number> = {};
  for (const r of relationships) {
    relationshipKinds[r.kind] = (relationshipKinds[r.kind] || 0) + 1;
  }

  // ==========================================================================
  // Temporal Analysis
  // ==========================================================================

  const focalEraId = focalEra?.id || null;

  // Check era span from events
  const eraIds = new Set(events.map((e) => e.era).filter(Boolean));
  const eraSpan: EraSpan = eraIds.size > 1 ? 'multiple' : 'single';

  // ==========================================================================
  // Spatial Analysis
  // ==========================================================================

  const coordinateCentroid = computeCentroid(entities);
  const spatialSpread = computeSpatialSpread(entities);

  // ==========================================================================
  // Focus Summary
  // ==========================================================================

  const focusSummary = buildFocusSummary(
    cultureBalance,
    topCulture,
    kindFocus,
    prominentTags,
    relationshipKinds
  );

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    cultures,
    dominantCulture: cultureBalance !== 'mixed' ? topCulture : null,
    cultureBalance,
    kinds,
    dominantKind: topKind || null,
    kindFocus,
    tagFrequency,
    prominentTags,
    relationshipKinds,
    focalEraId,
    eraSpan,
    coordinateCentroid,
    spatialSpread,
    focusSummary,
  };
}
