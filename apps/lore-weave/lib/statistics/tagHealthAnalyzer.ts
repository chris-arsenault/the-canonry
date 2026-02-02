/**
 * Tag Health Analyzer
 *
 * Analyzes tag usage across the graph to detect:
 * - Coverage: % of entities with optimal tag count (3-5 tags)
 * - Diversity: Shannon index of tag distribution
 * - Orphan tags: Tags used only 1-2 times (should have minUsage: 3)
 * - Overused tags: Tags exceeding maxUsage threshold
 * - Conflicts: Entities with conflicting tags
 * - Consolidation opportunities: Tags that should be merged
 */

import { Graph, TagHealthReport, TagMetadata } from '../engine/types';
import { HardState, EntityTags } from '../core/worldTypes';
import {
  getTagMetadata as getTagMetadataHelper,
  tagsConflict as tagsConflictHelper,
  validateEntityTags as validateEntityTagsHelper,
  getConsolidationSuggestions as getConsolidationSuggestionsHelper
} from '../statistics/tagRegistryHelpers';

/** Helper to get tag keys from EntityTags */
function getTagKeys(tags: EntityTags | undefined): string[] {
  if (!tags) return [];
  return Object.keys(tags);
}

/** Helper to get tag key count */
function getTagCount(tags: EntityTags | undefined): number {
  return tags ? Object.keys(tags).length : 0;
}

/**
 * Tag Health Analyzer Service
 */
export class TagHealthAnalyzer {
  private registry: TagMetadata[];

  constructor(registry: TagMetadata[] = []) {
    this.registry = registry;
  }

  /**
   * Get tag metadata using the configured registry
   */
  private getTagMetadata(tag: string): TagMetadata | undefined {
    return getTagMetadataHelper(this.registry, tag);
  }

  /**
   * Check if two tags conflict
   */
  private tagsConflict(tag1: string, tag2: string): boolean {
    return tagsConflictHelper(this.registry, tag1, tag2);
  }

  /**
   * Validate entity tags for conflicts
   */
  private validateEntityTags(tags: EntityTags | undefined): { valid: boolean; conflicts: string[] } {
    return validateEntityTagsHelper(this.registry, tags);
  }

  /**
   * Get consolidation suggestions
   */
  private getConsolidationSuggestions(): Array<{ from: string; to: string }> {
    return getConsolidationSuggestionsHelper(this.registry);
  }

  /**
   * Analyze all tag usage in the graph and generate comprehensive health report
   */
  public analyzeGraph(graph: Graph): TagHealthReport {
    const entities = graph.getEntities();

    // Calculate coverage metrics
    const coverage = this.calculateCoverage(entities);

    // Calculate diversity metrics
    const diversity = this.calculateDiversity(entities);

    // Identify quality issues
    const issues = this.identifyIssues(entities);

    // Identify entity-level issues
    const entityIssues = this.identifyEntityIssues(entities);

    // Generate recommendations
    const recommendations = this.generateRecommendations(coverage, diversity, issues, entityIssues);

    return {
      coverage,
      diversity,
      issues,
      entityIssues,
      recommendations
    };
  }

  /**
   * Calculate coverage metrics
   * Coverage: % of entities with appropriate tag count
   */
  public calculateCoverage(entities: HardState[]): TagHealthReport['coverage'] {
    const totalEntities = entities.length;
    const entitiesWithTags = entities.filter(e => getTagCount(e.tags) > 0).length;
    const entitiesWithOptimalTags = entities.filter(e => {
      const count = getTagCount(e.tags);
      return count >= 3 && count <= 5;
    }).length;

    return {
      totalEntities,
      entitiesWithTags,
      entitiesWithOptimalTags,
      coveragePercentage: totalEntities > 0 ? (entitiesWithTags / totalEntities) * 100 : 0,
      optimalCoveragePercentage: totalEntities > 0 ? (entitiesWithOptimalTags / totalEntities) * 100 : 0
    };
  }

  /**
   * Calculate diversity metrics using Shannon entropy
   * High entropy = tags are evenly distributed (good)
   * Low entropy = tags are concentrated on few entities (bad)
   */
  public calculateDiversity(entities: HardState[]): TagHealthReport['diversity'] {
    // Count tag occurrences
    const tagCounts = new Map<string, number>();
    let totalTagInstances = 0;

    for (const entity of entities) {
      for (const tag of getTagKeys(entity.tags)) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        totalTagInstances++;
      }
    }

    const uniqueTags = tagCounts.size;

    // Calculate Shannon index H = -Σ(p_i * ln(p_i))
    let shannonIndex = 0;
    for (const count of tagCounts.values()) {
      const p = count / totalTagInstances;
      if (p > 0) {
        shannonIndex -= p * Math.log(p);
      }
    }

    // Calculate evenness (normalized Shannon index)
    // Evenness = H / ln(S) where S is number of unique tags
    const maxPossibleEntropy = uniqueTags > 1 ? Math.log(uniqueTags) : 1;
    const evenness = shannonIndex / maxPossibleEntropy;

    return {
      uniqueTags,
      shannonIndex,
      evenness
    };
  }

  /**
   * Get orphan tags (used 1-2 times, below minUsage threshold)
   */
  public getOrphanTags(entities: HardState[]): Array<{ tag: string; count: number }> {
    const tagCounts = new Map<string, number>();

    for (const entity of entities) {
      for (const tag of getTagKeys(entity.tags)) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    const orphanTags: Array<{ tag: string; count: number }> = [];

    for (const [tag, count] of tagCounts.entries()) {
      const metadata = this.getTagMetadata(tag);

      if (metadata && metadata.minUsage) {
        if (count < metadata.minUsage) {
          orphanTags.push({ tag, count });
        }
      } else if (count <= 2) {
        // Unregistered tags used only 1-2 times
        orphanTags.push({ tag, count });
      }
    }

    return orphanTags.sort((a, b) => a.count - b.count);
  }

  /**
   * Get overused tags (exceeding maxUsage threshold)
   */
  public getOverusedTags(entities: HardState[]): Array<{ tag: string; count: number; max: number }> {
    const tagCounts = new Map<string, number>();

    for (const entity of entities) {
      for (const tag of getTagKeys(entity.tags)) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    const overusedTags: Array<{ tag: string; count: number; max: number }> = [];

    for (const [tag, count] of tagCounts.entries()) {
      const metadata = this.getTagMetadata(tag);

      if (metadata?.maxUsage && count > metadata.maxUsage) {
        overusedTags.push({ tag, count, max: metadata.maxUsage });
      }
    }

    return overusedTags.sort((a, b) => b.count - a.count);
  }

  /**
   * Get entities with conflicting tags
   */
  public getConflicts(entities: HardState[]): Array<{ entityId: string; tags: EntityTags; conflict: string }> {
    const conflicts: Array<{ entityId: string; tags: EntityTags; conflict: string }> = [];

    for (const entity of entities) {
      const validation = this.validateEntityTags(entity.tags);

      if (!validation.valid) {
        for (const conflict of validation.conflicts) {
          conflicts.push({
            entityId: entity.id,
            tags: entity.tags,
            conflict
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Identify all quality issues
   */
  private identifyIssues(entities: HardState[]): TagHealthReport['issues'] {
    const orphanTags = this.getOrphanTags(entities);
    const overusedTags = this.getOverusedTags(entities);
    const conflicts = this.getConflicts(entities);

    // Get consolidation opportunities from registry
    const consolidationSuggestions = this.getConsolidationSuggestions();

    // Count actual usage of tags marked for consolidation
    const tagCounts = new Map<string, number>();
    for (const entity of entities) {
      for (const tag of getTagKeys(entity.tags)) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    const consolidationOpportunities = consolidationSuggestions.map(({ from, to }) => ({
      from,
      to,
      count: tagCounts.get(from) || 0
    })).filter(c => c.count > 0);

    return {
      orphanTags,
      overusedTags,
      conflicts,
      consolidationOpportunities
    };
  }

  /**
   * Identify entity-level issues
   */
  private identifyEntityIssues(entities: HardState[]): TagHealthReport['entityIssues'] {
    const undertagged: string[] = [];
    const overtagged: string[] = [];

    for (const entity of entities) {
      const count = getTagCount(entity.tags);
      if (count < 3) {
        undertagged.push(entity.id);
      } else if (count > 5) {
        // This shouldn't happen due to the 5-tag constraint, but check anyway
        overtagged.push(entity.id);
      }
    }

    return {
      undertagged,
      overtagged
    };
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    coverage: TagHealthReport['coverage'],
    diversity: TagHealthReport['diversity'],
    issues: TagHealthReport['issues'],
    entityIssues: TagHealthReport['entityIssues']
  ): string[] {
    const recommendations: string[] = [];

    // Coverage recommendations
    if (coverage.coveragePercentage < 95) {
      recommendations.push(
        `Tag coverage is ${coverage.coveragePercentage.toFixed(1)}%. Consider adding tags to ${coverage.totalEntities - coverage.entitiesWithTags} entities.`
      );
    }

    if (coverage.optimalCoveragePercentage < 70) {
      recommendations.push(
        `Only ${coverage.optimalCoveragePercentage.toFixed(1)}% of entities have optimal tag count (3-5 tags). ` +
        `Target: 70%+. ${entityIssues.undertagged.length} entities need more tags.`
      );
    }

    // Diversity recommendations
    if (diversity.evenness < 0.6) {
      recommendations.push(
        `Tag distribution is uneven (evenness: ${diversity.evenness.toFixed(2)}). ` +
        `Some tags are overused while others are underused. Aim for evenness > 0.6.`
      );
    }

    // Orphan tag recommendations
    if (issues.orphanTags.length > 10) {
      recommendations.push(
        `${issues.orphanTags.length} orphan tags detected (used < minUsage). ` +
        `Consider: (1) increasing their usage, (2) removing them, or (3) adjusting minUsage thresholds.`
      );
    }

    // Overused tag recommendations
    if (issues.overusedTags.length > 0) {
      const topOverused = issues.overusedTags[0];
      recommendations.push(
        `${issues.overusedTags.length} tags exceed maxUsage. ` +
        `Top offender: "${topOverused.tag}" (${topOverused.count}/${topOverused.max}). ` +
        `Consider raising maxUsage or reducing template frequency.`
      );
    }

    // Conflict recommendations
    if (issues.conflicts.length > 0) {
      recommendations.push(
        `${issues.conflicts.length} tag conflicts detected. ` +
        `Review conflictingTags definitions in tagRegistry.ts or fix template logic.`
      );
    }

    // Consolidation recommendations
    if (issues.consolidationOpportunities.length > 0) {
      const totalConsolidatable = issues.consolidationOpportunities.reduce((sum, c) => sum + c.count, 0);
      recommendations.push(
        `${issues.consolidationOpportunities.length} tags marked for consolidation (${totalConsolidatable} total uses). ` +
        `Merge: ${issues.consolidationOpportunities.map(c => `"${c.from}" → "${c.to}"`).join(', ')}`
      );
    }

    // Overall health recommendation
    if (recommendations.length === 0) {
      recommendations.push('Tag health is excellent! All metrics are within target ranges.');
    }

    return recommendations;
  }

  /**
   * Get a concise summary of tag health
   */
  public getSummary(report: TagHealthReport): string {
    const lines: string[] = [];

    lines.push('=== TAG HEALTH SUMMARY ===');
    lines.push('');
    lines.push('COVERAGE:');
    lines.push(`  Total entities: ${report.coverage.totalEntities}`);
    lines.push(`  With tags: ${report.coverage.entitiesWithTags} (${report.coverage.coveragePercentage.toFixed(1)}%)`);
    lines.push(`  Optimal (3-5 tags): ${report.coverage.entitiesWithOptimalTags} (${report.coverage.optimalCoveragePercentage.toFixed(1)}%)`);
    lines.push('');

    lines.push('DIVERSITY:');
    lines.push(`  Unique tags: ${report.diversity.uniqueTags}`);
    lines.push(`  Shannon index: ${report.diversity.shannonIndex.toFixed(3)}`);
    lines.push(`  Evenness: ${report.diversity.evenness.toFixed(3)} (target: >0.6)`);
    lines.push('');

    lines.push('ISSUES:');
    lines.push(`  Orphan tags: ${report.issues.orphanTags.length}`);
    lines.push(`  Overused tags: ${report.issues.overusedTags.length}`);
    lines.push(`  Tag conflicts: ${report.issues.conflicts.length}`);
    lines.push(`  Consolidation opportunities: ${report.issues.consolidationOpportunities.length}`);
    lines.push('');

    lines.push('ENTITY ISSUES:');
    lines.push(`  Undertagged (<3 tags): ${report.entityIssues.undertagged.length}`);
    lines.push(`  Overtagged (>5 tags): ${report.entityIssues.overtagged.length}`);
    lines.push('');

    lines.push('RECOMMENDATIONS:');
    for (const rec of report.recommendations) {
      lines.push(`  - ${rec}`);
    }

    return lines.join('\n');
  }

  /**
   * Get detailed issue report (for debugging)
   */
  public getDetailedIssues(report: TagHealthReport): string {
    const lines: string[] = [];

    if (report.issues.orphanTags.length > 0) {
      lines.push('');
      lines.push('ORPHAN TAGS (used < minUsage):');
      for (const { tag, count } of report.issues.orphanTags) {
        const metadata = this.getTagMetadata(tag);
        const minUsage = metadata?.minUsage || 3;
        lines.push(`  ${tag.padEnd(30)} (${count}/${minUsage})`);
      }
    }

    if (report.issues.overusedTags.length > 0) {
      lines.push('');
      lines.push('OVERUSED TAGS (exceeding maxUsage):');
      for (const { tag, count, max } of report.issues.overusedTags) {
        lines.push(`  ${tag.padEnd(30)} (${count}/${max})`);
      }
    }

    if (report.issues.conflicts.length > 0) {
      lines.push('');
      lines.push('TAG CONFLICTS:');
      for (const { entityId, conflict } of report.issues.conflicts) {
        lines.push(`  Entity ${entityId}: ${conflict}`);
      }
    }

    if (report.issues.consolidationOpportunities.length > 0) {
      lines.push('');
      lines.push('CONSOLIDATION OPPORTUNITIES:');
      for (const { from, to, count } of report.issues.consolidationOpportunities) {
        lines.push(`  "${from}" → "${to}" (${count} uses)`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Check if adding tags to an entity would create saturation
   */
  public checkTagSaturation(
    graph: Graph,
    tagsToAdd: string[]
  ): { saturated: boolean; oversaturatedTags: string[] } {
    // Count current tag usage
    const tagCounts = new Map<string, number>();
    for (const entity of graph.getEntities()) {
      for (const tag of getTagKeys(entity.tags)) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    // Check which tags would exceed maxUsage
    const oversaturatedTags: string[] = [];

    for (const tag of tagsToAdd) {
      const metadata = this.getTagMetadata(tag);
      if (!metadata?.maxUsage) continue;

      const currentCount = tagCounts.get(tag) || 0;
      const newCount = currentCount + 1;

      if (newCount > metadata.maxUsage) {
        oversaturatedTags.push(tag);
      }
    }

    return {
      saturated: oversaturatedTags.length > 0,
      oversaturatedTags
    };
  }

  /**
   * Check if tags are orphans (unregistered)
   */
  public checkTagOrphans(tagsToAdd: string[]): { hasOrphans: boolean; orphanTags: string[] } {
    const orphanTags = tagsToAdd.filter(tag => !this.getTagMetadata(tag));

    return {
      hasOrphans: orphanTags.length > 0,
      orphanTags
    };
  }

  /**
   * Validate tag taxonomy for conflicts
   */
  public validateTagTaxonomy(entity: HardState): Array<{ tag1: string; tag2: string; reason: string }> {
    const conflicts: Array<{ tag1: string; tag2: string; reason: string }> = [];

    if (!entity.tags) {
      return conflicts;
    }

    const tagKeys = Object.keys(entity.tags);

    for (let i = 0; i < tagKeys.length; i++) {
      for (let j = i + 1; j < tagKeys.length; j++) {
        const tag1 = tagKeys[i];
        const tag2 = tagKeys[j];

        if (this.tagsConflict(tag1, tag2)) {
          conflicts.push({
            tag1,
            tag2,
            reason: `${tag1} conflicts with ${tag2}`
          });
        }
      }
    }

    return conflicts;
  }
}
