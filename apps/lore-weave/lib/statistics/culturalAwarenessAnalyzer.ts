/**
 * Cultural Awareness Analyzer
 *
 * Framework-level debugging and reporting tool that analyzes how well
 * domain code is utilizing culture as a first-class concept.
 *
 * Reports on:
 * - Cross-culture vs same-culture relationships
 * - Cultural homogeneity of locations and factions
 * - Entity culture alignment with parent entities
 * - Selection operations that may be culture-blind
 */

import { Graph } from '../engine/types';
import { findEntities } from '../utils';

/**
 * Cultural awareness metrics for a single analysis
 */
export interface CulturalAwarenessReport {
  // Relationship analysis
  relationships: {
    total: number;
    sameCulture: number;
    crossCulture: number;
    crossCultureRatio: number;
    byKind: Record<string, { same: number; cross: number }>;
  };

  // Location homogeneity
  locations: {
    total: number;
    homogeneous: number;
    mixed: number;
    homogeneityRatio: number;
    details: Array<{
      id: string;
      name: string;
      culture: string;
      residentCultures: string[];
      isHomogeneous: boolean;
    }>;
  };

  // Faction homogeneity
  factions: {
    total: number;
    homogeneous: number;
    mixed: number;
    homogeneityRatio: number;
    details: Array<{
      id: string;
      name: string;
      culture: string;
      memberCultures: string[];
      isHomogeneous: boolean;
    }>;
  };

  // Culture distribution
  distribution: {
    byCulture: Record<string, number>;
    byKindAndCulture: Record<string, Record<string, number>>;
  };

  // Warnings for potential culture-blind patterns
  warnings: string[];

  // Overall culture-first score (0-100)
  cultureFirstScore: number;
}

/**
 * Analyze cultural awareness in a graph
 */
export class CulturalAwarenessAnalyzer {
  /**
   * Generate a comprehensive cultural awareness report
   */
  analyze(graph: Graph): CulturalAwarenessReport {
    const warnings: string[] = [];

    // Analyze relationships
    const relationships = this.analyzeRelationships(graph, warnings);

    // Analyze location homogeneity
    const locations = this.analyzeLocationHomogeneity(graph, warnings);

    // Analyze faction homogeneity
    const factions = this.analyzeFactionHomogeneity(graph, warnings);

    // Analyze culture distribution
    const distribution = this.analyzeDistribution(graph);

    // Calculate overall score
    const cultureFirstScore = this.calculateScore(
      relationships,
      locations,
      factions,
      warnings
    );

    return {
      relationships,
      locations,
      factions,
      distribution,
      warnings,
      cultureFirstScore
    };
  }

  /**
   * Analyze relationship cultural alignment
   */
  private analyzeRelationships(
    graph: Graph,
    warnings: string[]
  ): CulturalAwarenessReport['relationships'] {
    const socialKinds = [
      'follower_of', 'rival_of', 'lover_of', 'enemy_of',
      'allied_with', 'member_of', 'leader_of'
    ];

    const allRels = graph.getRelationships();
    const socialRels = allRels.filter(r => socialKinds.includes(r.kind));

    let sameCulture = 0;
    let crossCulture = 0;
    const byKind: Record<string, { same: number; cross: number }> = {};

    for (const rel of socialRels) {
      const src = graph.getEntity(rel.src);
      const dst = graph.getEntity(rel.dst);
      if (!src || !dst) continue;

      if (!byKind[rel.kind]) byKind[rel.kind] = { same: 0, cross: 0 };

      if (src.culture === dst.culture) {
        sameCulture++;
        byKind[rel.kind].same++;
      } else {
        crossCulture++;
        byKind[rel.kind].cross++;
      }
    }

    const total = sameCulture + crossCulture;
    const crossCultureRatio = total > 0 ? crossCulture / total : 0;

    this.warnHighCrossCulture(crossCultureRatio, total, byKind, warnings);

    return { total, sameCulture, crossCulture, crossCultureRatio, byKind };
  }

  private warnHighCrossCulture(
    crossCultureRatio: number,
    total: number,
    byKind: Record<string, { same: number; cross: number }>,
    warnings: string[]
  ): void {
    if (crossCultureRatio > 0.5 && total > 10) {
      warnings.push(
        `High cross-culture relationship ratio (${(crossCultureRatio * 100).toFixed(1)}%). ` +
        `Consider adding sameCultureAs preferences to relationship formation.`
      );
    }

    for (const [kind, counts] of Object.entries(byKind)) {
      const kindTotal = counts.same + counts.cross;
      const kindCrossRatio = kindTotal > 0 ? counts.cross / kindTotal : 0;
      if (kindCrossRatio > 0.6 && kindTotal > 5) {
        warnings.push(
          `${kind} relationships are ${(kindCrossRatio * 100).toFixed(0)}% cross-culture. ` +
          `This relationship type may not be using cultural affinity.`
        );
      }
    }
  }

  /**
   * Analyze location cultural homogeneity
   */
  private analyzeLocationHomogeneity(
    graph: Graph,
    warnings: string[]
  ): CulturalAwarenessReport['locations'] {
    const locations = findEntities(graph, { kind: 'location', subtype: 'colony' });
    const details: CulturalAwarenessReport['locations']['details'] = [];

    let homogeneous = 0;
    let mixed = 0;

    for (const location of locations) {
      const residents = graph.getRelationships()
        .filter(r => r.kind === 'resident_of' && r.dst === location.id);

      const residentCultures = new Set<string>();
      for (const rel of residents) {
        const resident = graph.getEntity(rel.src);
        if (resident) residentCultures.add(resident.culture);
      }

      const isHomogeneous = residentCultures.size <= 1;

      if (isHomogeneous) {
        homogeneous++;
      } else {
        mixed++;
      }

      details.push({
        id: location.id,
        name: location.name,
        culture: location.culture,
        residentCultures: Array.from(residentCultures),
        isHomogeneous
      });
    }

    const total = locations.length;
    const homogeneityRatio = total > 0 ? homogeneous / total : 1;

    // Warn if many locations are culturally mixed
    if (homogeneityRatio < 0.5 && total > 3) {
      warnings.push(
        `Only ${(homogeneityRatio * 100).toFixed(0)}% of locations are culturally homogeneous. ` +
        `NPCs may not be assigned to locations matching their culture.`
      );
    }

    return {
      total,
      homogeneous,
      mixed,
      homogeneityRatio,
      details
    };
  }

  /**
   * Analyze faction cultural homogeneity
   */
  private analyzeFactionHomogeneity(
    graph: Graph,
    warnings: string[]
  ): CulturalAwarenessReport['factions'] {
    const factions = findEntities(graph, { kind: 'faction' });
    const details: CulturalAwarenessReport['factions']['details'] = [];

    let homogeneous = 0;
    let mixed = 0;

    for (const faction of factions) {
      const members = graph.getRelationships()
        .filter(r => r.kind === 'member_of' && r.dst === faction.id);

      const memberCultures = new Set<string>();
      for (const rel of members) {
        const member = graph.getEntity(rel.src);
        if (member) memberCultures.add(member.culture);
      }

      const isHomogeneous = memberCultures.size <= 1;

      if (isHomogeneous) {
        homogeneous++;
      } else {
        mixed++;
      }

      details.push({
        id: faction.id,
        name: faction.name,
        culture: faction.culture,
        memberCultures: Array.from(memberCultures),
        isHomogeneous
      });
    }

    const total = factions.length;
    const homogeneityRatio = total > 0 ? homogeneous / total : 1;

    // Warn if many factions are culturally mixed
    if (homogeneityRatio < 0.6 && total > 3) {
      warnings.push(
        `Only ${(homogeneityRatio * 100).toFixed(0)}% of factions are culturally homogeneous. ` +
        `Templates may not be using sameCultureAs when recruiting members.`
      );
    }

    return {
      total,
      homogeneous,
      mixed,
      homogeneityRatio,
      details
    };
  }

  /**
   * Analyze culture distribution across entities
   */
  private analyzeDistribution(
    graph: Graph
  ): CulturalAwarenessReport['distribution'] {
    const entities = graph.getEntities();

    const byCulture: Record<string, number> = {};
    const byKindAndCulture: Record<string, Record<string, number>> = {};

    for (const entity of entities) {
      const culture = entity.culture || 'unknown';
      const kind = entity.kind;

      // Count by culture
      byCulture[culture] = (byCulture[culture] || 0) + 1;

      // Count by kind and culture
      if (!byKindAndCulture[kind]) {
        byKindAndCulture[kind] = {};
      }
      byKindAndCulture[kind][culture] = (byKindAndCulture[kind][culture] || 0) + 1;
    }

    return { byCulture, byKindAndCulture };
  }

  /**
   * Calculate overall culture-first score (0-100)
   */
  private calculateScore(
    relationships: CulturalAwarenessReport['relationships'],
    locations: CulturalAwarenessReport['locations'],
    factions: CulturalAwarenessReport['factions'],
    warnings: string[]
  ): number {
    // Weight: relationships 40%, locations 25%, factions 25%, warnings 10%
    const relationshipScore = (1 - relationships.crossCultureRatio) * 40;
    const locationScore = locations.homogeneityRatio * 25;
    const factionScore = factions.homogeneityRatio * 25;
    const warningPenalty = Math.min(warnings.length * 2, 10);

    return Math.round(
      Math.max(0, relationshipScore + locationScore + factionScore - warningPenalty)
    );
  }

  /**
   * Generate a human-readable summary
   */
  generateSummary(report: CulturalAwarenessReport): string {
    const lines: string[] = [
      '='.repeat(60),
      'CULTURAL AWARENESS REPORT',
      '='.repeat(60),
      '',
      `Culture-First Score: ${report.cultureFirstScore}/100`,
      '',
      '--- Relationships ---',
      `Total social relationships: ${report.relationships.total}`,
      `Same-culture: ${report.relationships.sameCulture} (${((1 - report.relationships.crossCultureRatio) * 100).toFixed(1)}%)`,
      `Cross-culture: ${report.relationships.crossCulture} (${(report.relationships.crossCultureRatio * 100).toFixed(1)}%)`,
      '',
      '--- Locations ---',
      `Total colonies: ${report.locations.total}`,
      `Culturally homogeneous: ${report.locations.homogeneous} (${(report.locations.homogeneityRatio * 100).toFixed(1)}%)`,
      `Culturally mixed: ${report.locations.mixed}`,
      '',
      '--- Factions ---',
      `Total factions: ${report.factions.total}`,
      `Culturally homogeneous: ${report.factions.homogeneous} (${(report.factions.homogeneityRatio * 100).toFixed(1)}%)`,
      `Culturally mixed: ${report.factions.mixed}`,
      '',
      '--- Culture Distribution ---'
    ];

    for (const [culture, count] of Object.entries(report.distribution.byCulture)) {
      lines.push(`  ${culture}: ${count} entities`);
    }

    if (report.warnings.length > 0) {
      lines.push('');
      lines.push('--- Warnings ---');
      for (const warning of report.warnings) {
        lines.push(`⚠️  ${warning}`);
      }
    }

    lines.push('');
    lines.push('='.repeat(60));

    return lines.join('\n');
  }
}
