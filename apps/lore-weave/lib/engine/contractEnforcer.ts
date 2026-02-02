import { GrowthTemplate, EngineConfig, TagMetadata } from '../engine/types';
import { WorldRuntime } from '../runtime/worldRuntime';
import { HardState, EntityTags } from '../core/worldTypes';
import { TagHealthAnalyzer } from '../statistics/tagHealthAnalyzer';
import { getTagMetadata } from '../statistics/tagRegistryHelpers';

/** Helper to get tag keys from EntityTags */
function getTagKeysNormalized(tags: EntityTags | undefined): string[] {
  if (!tags) return [];
  return Object.keys(tags);
}

/** Helper to get tag key count */
function getTagKeyCount(tags: EntityTags | undefined): number {
  return tags ? Object.keys(tags).length : 0;
}

/**
 * ContractEnforcer
 *
 * Active framework enforcement for tag constraints:
 * - Tag saturation (check for overused tags)
 * - Tag coverage (ensure 3-5 tags per entity)
 * - Tag taxonomy (check for conflicting tags)
 *
 * Note: Input conditions are handled via applicability rules in templateInterpreter.ts.
 * Note: Lineage relationships are now created via placement types (near_ancestor)
 *       or explicit relationships in the template's relationships array.
 */
export class ContractEnforcer {
  private tagAnalyzer: TagHealthAnalyzer;
  private registry: TagMetadata[];

  constructor(private config: EngineConfig) {
    // TagDefinition from schema is looser than TagMetadata; filter to valid entries
    this.registry = (config.schema.tagRegistry || [])
      .filter((t): t is TagMetadata => t.category !== undefined) as TagMetadata[];
    this.tagAnalyzer = new TagHealthAnalyzer(this.registry);
  }

  // NOTE: enabledBy removed - input conditions are handled via applicability rules
  // NOTE: enforceLineage removed - lineage is handled via near_ancestor placement
  //       or explicit relationships in template's relationships array
  // NOTE: validateAffects removed - output validation is redundant with declarative templates

  /**
   * Check Tag Saturation
   *
   * Before template runs, check if it would add overused tags.
   * Uses tag registry to determine expected counts per tag.
   */
  public checkTagSaturation(
    graph: WorldRuntime,
    tagsToAdd: string[]
  ): { saturated: boolean; oversaturatedTags: string[]; reason?: string } {
    // Count current tag usage
    const tagCounts = new Map<string, number>();
    graph.forEachEntity((entity) => {
      for (const tag of getTagKeysNormalized(entity.tags)) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    });

    // Check which tags would exceed maxUsage
    const oversaturatedTags: string[] = [];

    for (const tag of tagsToAdd) {
      const def = getTagMetadata(this.registry, tag);
      if (!def || !def.maxUsage) continue;  // Unregistered tags can't be saturated

      const currentCount = tagCounts.get(tag) || 0;
      const newCount = currentCount + 1;

      if (newCount > def.maxUsage) {
        oversaturatedTags.push(tag);
      }
    }

    if (oversaturatedTags.length > 0) {
      return {
        saturated: true,
        oversaturatedTags,
        reason: `Tags would be oversaturated: ${oversaturatedTags.join(', ')}`
      };
    }

    return { saturated: false, oversaturatedTags: [] };
  }

  /**
   * ENFORCEMENT 6: Check Tag Orphans
   *
   * Warn if template creates single-use tags not in registry.
   * Legendary tags (single-use by design) are expected and don't trigger warnings.
   */
  public checkTagOrphans(tagsToAdd: string[]): { hasOrphans: boolean; orphanTags: string[] } {
    const orphanTags: string[] = [];

    for (const tag of tagsToAdd) {
      const def = getTagMetadata(this.registry, tag);

      if (!def) {
        orphanTags.push(tag);
      }
    }

    return {
      hasOrphans: orphanTags.length > 0,
      orphanTags
    };
  }

  /**
   * ENFORCEMENT 7: Enforce Tag Coverage
   *
   * After entity creation, ensure it has 3-5 tags.
   * Returns suggested tags to add or remove.
   */
  public enforceTagCoverage(
    entity: HardState,
    graph: WorldRuntime
  ): { needsAdjustment: boolean; suggestion: string; tagsToAdd?: string[]; tagsToRemove?: string[] } {
    const currentCount = getTagKeyCount(entity.tags);

    // Check if coverage is acceptable (3-5 tags)
    if (currentCount >= 3 && currentCount <= 5) {
      return { needsAdjustment: false, suggestion: 'Tag coverage is adequate' };
    }

    // Too few tags - suggest additions
    if (currentCount < 3) {
      const needed = 3 - currentCount;
      return {
        needsAdjustment: true,
        suggestion: `Entity ${entity.name} has only ${currentCount} tags, needs ${needed} more`,
        tagsToAdd: []  // Template should handle this
      };
    }

    // Too many tags - suggest removals
    if (currentCount > 5) {
      const excess = currentCount - 5;
      const tagKeys = Object.keys(entity.tags || {});
      return {
        needsAdjustment: true,
        suggestion: `Entity ${entity.name} has ${currentCount} tags, should remove ${excess}`,
        tagsToRemove: tagKeys.slice(5)  // Remove excess tags
      };
    }

    return { needsAdjustment: false, suggestion: 'Tag coverage is adequate' };
  }

  /**
   * ENFORCEMENT 8: Validate Tag Taxonomy
   *
   * Check for conflicting tags on entities (e.g., peaceful + warlike).
   * Returns conflicts if found.
   */
  public validateTagTaxonomy(
    entity: HardState
  ): { valid: boolean; conflicts: Array<{ tag1: string; tag2: string; reason: string }> } {
    const conflicts = this.tagAnalyzer.validateTagTaxonomy(entity);

    return {
      valid: conflicts.length === 0,
      conflicts
    };
  }

  /**
   * Get diagnostic info for why a template cannot run.
   * Note: Input conditions (formerly contract.enabledBy) are now handled via
   * applicability rules in templateInterpreter.ts.
   */
  public getDiagnostic(
    template: GrowthTemplate,
    graphView: WorldRuntime
  ): string {
    const parts: string[] = [];

    // Check canApply (includes applicability rules evaluation)
    const canApply = template.canApply(graphView);
    parts.push(`canApply(): ${canApply ? '✓' : '✗'}`);

    // Check targets
    const targets = template.findTargets ? template.findTargets(graphView) : [];
    parts.push(`Targets: ${targets.length}`);

    return parts.join(' | ');
  }

  /**
   * Get tag health analyzer instance for external use
   */
  public getTagAnalyzer(): TagHealthAnalyzer {
    return this.tagAnalyzer;
  }
}
