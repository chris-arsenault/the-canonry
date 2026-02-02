/**
 * Cluster Formation System Factory
 *
 * Creates configurable systems that cluster similar entities into meta-entities.
 * This pattern can implement:
 * - Magic school formation (cluster magic abilities)
 * - Legal code formation (cluster rules)
 * - Combat technique formation (cluster combat abilities)
 * - Any domain-specific entity consolidation
 *
 * The factory creates a SimulationSystem from a ClusterFormationConfig.
 */

import { SimulationSystem, SystemResult, ComponentPurpose } from '../engine/types';
import { HardState, Relationship } from '../core/worldTypes';
import { WorldRuntime } from '../runtime/worldRuntime';
import {
  ClusterConfig,
  ClusterCriterion,
  ClusterCriterionType,
  detectClusters,
  filterClusterableEntities
} from '../graph/clusteringUtils';
import { FRAMEWORK_RELATIONSHIP_KINDS, FRAMEWORK_TAGS, FRAMEWORK_STATUS } from '@canonry/world-schema';
import { pickRandom, weightedRandom } from '../utils';
import { selectEntities, createSystemContext } from '../rules';
import type { SelectionRule } from '../rules';
import type { SelectionFilter } from '../rules/filters/types';
import type { Mutation } from '../rules/mutations/types';
import { interpolate, createSystemRuleContext } from '../narrative/narrationTemplate';

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/**
 * Declarative clustering criterion (JSON-safe, no functions)
 */
export interface DeclarativeClusterCriterion {
  /** Type of criterion */
  type: Exclude<ClusterCriterionType, 'custom'>;
  /** Weight contribution to similarity score */
  weight: number;
  /** Optional threshold for this criterion */
  threshold?: number;
  /** For 'shared_relationship': the relationship kind to check */
  relationshipKind?: string;
  /** For 'shared_relationship': direction to check */
  direction?: 'src' | 'dst';
}

/**
 * Clustering configuration (JSON-safe)
 */
export interface DeclarativeClusterConfig {
  /** Minimum entities required to form a cluster */
  minSize: number;
  /** Maximum entities in a cluster (optional) */
  maxSize?: number;
  /** Criteria for calculating similarity */
  criteria: DeclarativeClusterCriterion[];
  /** Minimum total similarity score to be clustered together */
  minimumScore: number;
}

/**
 * Meta-entity configuration
 */
export interface MetaEntityConfig {
  /** Kind for the meta-entity */
  kind: string;
  /** If true, use majority subtype from cluster */
  subtypeFromMajority: boolean;
  /** Fixed subtype if subtypeFromMajority is false */
  fixedSubtype?: string;
  /** Status for the meta-entity */
  status: string;
  /** Prominence thresholds based on cluster size */
  prominenceFromSize: {
    /** Size threshold for 'marginal' prominence */
    marginal: number;
    /** Size threshold for 'recognized' prominence */
    recognized: number;
    /** Size threshold for 'renowned' prominence */
    renowned: number;
  };
  /** Tags to add to meta-entity */
  additionalTags?: string[];
  /** Description template (use {count} for cluster size, {names} for entity names) */
  descriptionTemplate?: string;
}

/**
 * Post-processing configuration
 */
export interface PostProcessConfig {
  /** Whether to create a governance faction (for legal codes) */
  createGovernanceFaction?: boolean;
  /** Faction subtype if creating governance faction */
  governanceFactionSubtype?: string;
  /** Relationship kind for faction→meta-entity */
  governanceRelationship?: string;
  /** Pressure changes after formation */
  pressureChanges?: Record<string, number>;
  /**
   * Whether to create an emergent region at the meta-entity's location.
   * This marks the semantic area where similar entities clustered.
   */
  createEmergentRegion?: boolean;
  /** Label template for the emergent region (use {name} for meta-entity name) */
  emergentRegionLabel?: string;
  /** Description template for the emergent region */
  emergentRegionDescription?: string;
}

/**
 * Configuration for selecting "masters" - practitioners who get
 * direct relationships to the meta-ability.
 * Applied to practitioners collected from cluster members.
 */
export interface MasterSelectionConfig {
  /** Filters to apply to practitioner candidates (e.g., matches_culture with $meta) */
  filters: SelectionFilter[];
  /** Pick strategy: 'weighted' uses prominence-weighted random, 'first' takes top N, 'random' is uniform */
  pickStrategy: 'weighted' | 'first' | 'random';
  /** Maximum number of masters to select */
  maxResults: number;
}

/**
 * Full cluster formation configuration
 */
export interface ClusterFormationConfig {
  /** Unique system identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;

  /** Selection rule for clustering candidates */
  selection: SelectionRule;

  /** Whether to only run at epoch end */
  runAtEpochEnd: boolean;

  /** Clustering configuration */
  clustering: DeclarativeClusterConfig;

  /** Meta-entity configuration */
  metaEntity: MetaEntityConfig;

  /** Optional post-processing */
  postProcess?: PostProcessConfig;

  /**
   * Optional master selection configuration.
   * When provided, only selected "masters" get direct practitioner_of relationships
   * to the meta-entity. Non-masters retain their relationships to absorbed abilities.
   * This reduces graph hub formation while preserving narrative structure.
   */
  masterSelection?: MasterSelectionConfig;

  /**
   * Optional mutations to apply to each absorbed cluster member.
   * $member is bound to each absorbed entity during mutation application.
   * Example: [{ type: 'change_status', entity: '$member', newStatus: 'subsumed' }]
   */
  memberUpdates?: Mutation[];

  /**
   * Narration template for cluster formation events.
   * Available variables:
   * - {$self.name} - The created meta-entity
   * - {count} - Number of entities clustered
   * - {names} - Names of clustered entities
   * Example: "{$self.name} emerged, unifying {count} traditions."
   */
  narrationTemplate?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert declarative criteria to ClusterCriterion[]
 */
function toClusterCriteria(declarative: DeclarativeClusterCriterion[]): ClusterCriterion[] {
  return declarative.map(d => ({
    type: d.type,
    weight: d.weight,
    threshold: d.threshold,
    relationshipKind: d.relationshipKind,
    direction: d.direction
  }));
}

/**
 * Get majority value from a map of counts
 */
function getMajority<T>(counts: Map<T, number>, defaultValue: T): T {
  let maxCount = 0;
  let majority = defaultValue;
  counts.forEach((count, value) => {
    if (count > maxCount) {
      maxCount = count;
      majority = value;
    }
  });
  return majority;
}

/**
 * Select masters from practitioners based on MasterSelectionConfig.
 * Filters by culture match with meta-entity, then selects using pick strategy.
 */
function selectMasters(
  practitioners: HardState[],
  metaEntity: HardState,
  config: MasterSelectionConfig
): HardState[] {
  // Apply filters
  let filtered = practitioners;

  for (const filter of config.filters) {
    if (filter.type === 'matches_culture' && filter.with === '$meta') {
      filtered = filtered.filter(p => p.culture === metaEntity.culture);
    }
    // Add other filter types as needed
  }

  // Sort by prominence (descending) for deterministic behavior
  filtered.sort((a, b) => b.prominence - a.prominence);

  // Apply pick strategy
  const limit = Math.min(config.maxResults, filtered.length);

  switch (config.pickStrategy) {
    case 'weighted':
      // Prominence-weighted sampling
      return sampleByProminence(filtered, limit);
    case 'first':
      return filtered.slice(0, limit);
    case 'random':
      return sampleRandom(filtered, limit);
    default:
      return filtered.slice(0, limit);
  }
}

/**
 * Sample entities weighted by prominence
 */
function sampleByProminence(entities: HardState[], count: number): HardState[] {
  if (count >= entities.length) return entities;

  const result: HardState[] = [];
  const remaining = [...entities];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    // Calculate weights based on prominence (higher prominence = higher weight)
    const weights = remaining.map(e => e.prominence + 1); // +1 to avoid zero weights
    const selected = weightedRandom(remaining, weights);
    if (selected) {
      result.push(selected);
      const idx = remaining.indexOf(selected);
      if (idx > -1) remaining.splice(idx, 1);
    }
  }

  return result;
}

/**
 * Random sampling without replacement
 */
function sampleRandom(entities: HardState[], count: number): HardState[] {
  if (count >= entities.length) return entities;

  const shuffled = [...entities];
  // Fisher-Yates shuffle
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
}

/**
 * Determine prominence based on cluster size.
 * Returns numeric prominence value (2=recognized, 3=renowned, 1=marginal).
 */
function getProminence(
  size: number,
  thresholds: { marginal: number; recognized: number; renowned: number }
): number {
  if (size >= thresholds.renowned) return 3.5; // renowned
  if (size >= thresholds.recognized) return 2.5; // recognized
  return 1.5; // marginal
}

/**
 * Create a meta-entity from a cluster
 */
async function createMetaEntity(
  cluster: HardState[],
  config: MetaEntityConfig,
  graphView: WorldRuntime
): Promise<Partial<HardState>> {
  // Determine subtype
  let subtype: string;
  if (config.subtypeFromMajority) {
    const subtypeCounts = new Map<string, number>();
    cluster.forEach(e => {
      subtypeCounts.set(e.subtype, (subtypeCounts.get(e.subtype) || 0) + 1);
    });
    subtype = getMajority(subtypeCounts, cluster[0].subtype);
  } else {
    subtype = config.fixedSubtype || cluster[0].subtype;
  }

  // Determine culture from majority
  const cultureCounts = new Map<string, number>();
  cluster.forEach(e => {
    cultureCounts.set(e.culture, (cultureCounts.get(e.culture) || 0) + 1);
  });
  const culture = getMajority(cultureCounts, cluster[0].culture);

  // Aggregate tags from cluster (top 4 to leave room for meta-entity tag)
  const allTags = new Set<string>();
  cluster.forEach(e => {
    Object.keys(e.tags || {}).forEach(tag => {
      // Skip meta-entity and temp tags
      if (!tag.startsWith(FRAMEWORK_TAGS.META_ENTITY) && !tag.startsWith('temp:')) {
        allTags.add(tag);
      }
    });
  });
  const tagArray = Array.from(allTags).slice(0, 4);

  // Build tags object
  const tags: Record<string, boolean> = {};
  tagArray.forEach(tag => tags[tag] = true);
  tags[FRAMEWORK_TAGS.META_ENTITY] = true;
  if (config.additionalTags) {
    config.additionalTags.forEach(tag => tags[tag] = true);
  }

  // Build narrative hint
  const entityNames = cluster.map(e => e.name).join(', ');
  let narrativeHint = config.descriptionTemplate
    ? config.descriptionTemplate
        .replace('{count}', String(cluster.length))
        .replace('{names}', entityNames)
    : `A unified tradition encompassing ${entityNames}. Formed from ${cluster.length} related entities.`;

  // Determine prominence
  const prominence = getProminence(cluster.length, config.prominenceFromSize);

  // Derive coordinates from cluster using culture-aware placement
  const placement = await graphView.deriveCoordinatesWithCulture(
    culture,
    config.kind,
    cluster
  );

  return {
    kind: config.kind,
    subtype,
    narrativeHint,
    status: config.status,
    prominence,
    culture,
    tags,
    coordinates: placement.coordinates
  };
}

/**
 * Create a governance faction for a legal code
 */
async function createGovernanceFaction(
  graphView: WorldRuntime,
  metaEntityId: string,
  metaEntity: HardState,
  config: PostProcessConfig
): Promise<{ factionId: string | null; relationships: Relationship[] }> {
  const relationships: Relationship[] = [];

  // Find locations where this code applies
  const codeLocations = graphView.getAllRelationships()
    .filter(r => r.kind === 'applies_in' && r.src === metaEntityId)
    .map(r => graphView.getEntity(r.dst))
    .filter((l): l is HardState => l !== undefined);

  if (codeLocations.length === 0) {
    return { factionId: null, relationships: [] };
  }

  const primaryLocation = codeLocations[0];

  // Check if a political faction already governs this location
  const existingGoverningFaction = graphView.getEntities().find(e =>
    e.kind === 'faction' &&
    e.subtype === (config.governanceFactionSubtype || 'political') &&
    graphView.getAllRelationships().some(r =>
      r.kind === 'controls' &&
      r.src === e.id &&
      r.dst === primaryLocation.id
    )
  );

  if (existingGoverningFaction) {
    // Link existing faction to the meta-entity
    const relKind = config.governanceRelationship || 'weaponized_by';
    graphView.createRelationship(relKind, existingGoverningFaction.id, metaEntityId);
    relationships.push({
      kind: relKind,
      src: existingGoverningFaction.id,
      dst: metaEntityId,
      strength: 0.8
    });
    return { factionId: null, relationships };
  }

  // Derive coordinates for faction
  if (!primaryLocation.culture) {
    throw new Error(`createGovernanceFaction: primary location "${primaryLocation.name}" has no culture.`);
  }
  const factionPlacement = await graphView.deriveCoordinatesWithCulture(
    primaryLocation.culture,
    'faction',
    [primaryLocation, metaEntity]
  );
  // Create political faction
  const factionPartial: Partial<HardState> = {
    kind: 'faction',
    subtype: config.governanceFactionSubtype || 'political',
    narrativeHint: `A legislative body formed to administer ${metaEntity.name}.`,
    status: 'active',
    prominence: metaEntity.prominence,
    culture: primaryLocation.culture,
    tags: { governance: true, legislative: true, political: true },
    coordinates: factionPlacement.coordinates
  };

  const factionId = await graphView.addEntity(factionPartial);

  // Link faction to meta-entity
  const relKind = config.governanceRelationship || 'weaponized_by';
  graphView.createRelationship(relKind, factionId, metaEntityId);
  relationships.push({
    kind: relKind,
    src: factionId,
    dst: metaEntityId,
    strength: 0.8
  });

  // Link faction to location
  graphView.createRelationship('controls', factionId, primaryLocation.id);
  relationships.push({
    kind: 'controls',
    src: factionId,
    dst: primaryLocation.id,
    strength: 0.8
  });

  return { factionId, relationships };
}

// =============================================================================
// SYSTEM FACTORY
// =============================================================================

/**
 * Create a SimulationSystem from a ClusterFormationConfig
 */
export function createClusterFormationSystem(
  config: ClusterFormationConfig
): SimulationSystem {
  // Convert declarative criteria to runtime criteria
  const clusterConfig: ClusterConfig = {
    minSize: config.clustering.minSize,
    maxSize: config.clustering.maxSize,
    criteria: toClusterCriteria(config.clustering.criteria),
    minimumScore: config.clustering.minimumScore
  };

  return {
    id: config.id,
    name: config.name,

    apply: async (graphView: WorldRuntime, modifier: number = 1.0): Promise<SystemResult> => {
      // Check epoch end if required
      if (config.runAtEpochEnd) {
        const ticksPerEpoch = graphView.config.ticksPerEpoch || 15;
        if (graphView.tick % ticksPerEpoch !== 0) {
          return {
            relationshipsAdded: [],
            entitiesModified: [],
            pressureChanges: {},
            description: `${config.name}: not epoch end, skipping`
          };
        }
      }

      // Find entities eligible for clustering
      const selectionCtx = createSystemContext(graphView);
      let entities = selectEntities(config.selection, selectionCtx);

      // Filter out historical and meta-entities
      entities = filterClusterableEntities(entities);

      if (entities.length < clusterConfig.minSize) {
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: `${config.name}: not enough entities (${entities.length})`
        };
      }

      // Detect clusters
      const clusters = detectClusters(entities, clusterConfig, graphView);

      const relationshipsAdded: Array<Relationship & { narrativeGroupId?: string }> = [];
      const entitiesModified: Array<{ id: string; changes: Partial<HardState>; narrativeGroupId?: string }> = [];
      const metaEntitiesCreated: string[] = [];
      const factionsCreated: string[] = [];
      const narrationsByGroup: Record<string, string> = {};

      // Form meta-entities from valid clusters
      for (const cluster of clusters) {
        if (cluster.score < clusterConfig.minimumScore) continue;

        // Create the meta-entity partial
        const metaEntityPartial = await createMetaEntity(cluster.entities, config.metaEntity, graphView);

        // Enter narration context BEFORE creating the entity (narration added after we have the name)
        const tracker = graphView.mutationTracker;
        const contextId = `${config.id}:${metaEntitiesCreated.length}`;
        if (config.narrationTemplate && tracker) {
          tracker.enterContext('system', contextId);
        }

        // Now create the entity (will be recorded under the narration context)
        const metaEntityId = await graphView.addEntity(metaEntityPartial);
        const metaEntity = graphView.getEntity(metaEntityId)!;
        metaEntitiesCreated.push(metaEntityId);

        // Generate narration now that we have the full entity with name
        // and SET IT ON THE CURRENT CONTEXT so the event builder finds it
        let generatedNarration: string | undefined;
        if (config.narrationTemplate && tracker) {
          const entityNames = cluster.entities.map(e => e.name).join(', ');
          const templateWithReplacements = config.narrationTemplate
            .replace('{count}', String(cluster.entities.length))
            .replace('{names}', entityNames);
          const narrationCtx = createSystemRuleContext({ self: metaEntity });
          const narrationResult = interpolate(templateWithReplacements, narrationCtx);
          if (narrationResult.complete) {
            generatedNarration = narrationResult.text;
            narrationsByGroup[metaEntityId] = generatedNarration;
            // Update the context's narration directly
            const currentContext = tracker.getCurrentContext();
            if (currentContext) {
              currentContext.narration = generatedNarration;
            }
          }
        }

        // Get cluster entity IDs
        const clusterIds = cluster.entities.map(e => e.id);

        // Handle practitioner relationships based on masterSelection config
        if (config.masterSelection) {
          // Collect all practitioners of cluster members
          const allPractitioners: HardState[] = [];
          const seenIds = new Set<string>();
          for (const memberId of clusterIds) {
            const practitioners = graphView.getConnectedEntities(memberId, 'practitioner_of', 'dst');
            for (const p of practitioners) {
              if (!seenIds.has(p.id)) {
                seenIds.add(p.id);
                allPractitioners.push(p);
              }
            }
          }

          // Select masters using the simplified selection logic
          const masters = selectMasters(allPractitioners, metaEntity, config.masterSelection);

          // Create practitioner_of relationships only for masters
          for (const master of masters) {
            graphView.createRelationship('practitioner_of', master.id, metaEntityId);
            relationshipsAdded.push({
              kind: 'practitioner_of',
              src: master.id,
              dst: metaEntityId,
              strength: 1.0,
              narrativeGroupId: metaEntityId
            });
            // Archive the old practitioner_of relationships for this master
            for (const memberId of clusterIds) {
              graphView.archiveRelationship(master.id, memberId, 'practitioner_of');
            }
          }

          // Find origin location from absorbed abilities' manifests_at relationships
          const locationCounts = new Map<string, number>();
          for (const memberId of clusterIds) {
            const locations = graphView.getConnectedEntities(memberId, 'manifests_at', 'src');
            for (const loc of locations) {
              locationCounts.set(loc.id, (locationCounts.get(loc.id) || 0) + 1);
            }
          }

          // Create originated_in link to most common location
          if (locationCounts.size > 0) {
            const originLocationId = getMajority(locationCounts, '');
            if (originLocationId) {
              graphView.createRelationship('originated_in', metaEntityId, originLocationId);
              relationshipsAdded.push({
                kind: 'originated_in',
                src: metaEntityId,
                dst: originLocationId,
                strength: 1.0,
                narrativeGroupId: metaEntityId
              });
            }
          }

          graphView.log('info', `${config.name}: selected ${masters.length} masters from ${allPractitioners.length} practitioners`);
        } else {
          // Original behavior: transfer all relationships
          graphView.transferRelationships(
            clusterIds,
            metaEntityId,
            {
              excludeKinds: [FRAMEWORK_RELATIONSHIP_KINDS.PART_OF],
              archiveOriginals: true
            }
          );
        }

        // Create subsumes relationships (meta-entity subsumes member)
        // This makes it explicit that the meta-entity absorbs the cluster members
        clusterIds.forEach((id, index) => {
          graphView.createRelationship('subsumes', metaEntityId, id);
          relationshipsAdded.push({
            kind: 'subsumes',
            src: metaEntityId,
            dst: id,
            strength: 1.0,
            // Link first relationship to narration for this cluster
            narrativeGroupId: index === 0 ? metaEntityId : undefined
          });
        });

        // Post-process: create emergent region if configured
        if (config.postProcess?.createEmergentRegion && metaEntityPartial.coordinates) {
          const regionLabel = (config.postProcess.emergentRegionLabel || '{name} Region')
            .replace('{name}', metaEntity.name);
          const regionDescription = (config.postProcess.emergentRegionDescription || 'A semantic cluster formed around {name}')
            .replace('{name}', metaEntity.name);

          const regionResult = graphView.createEmergentRegion(
            config.metaEntity.kind,
            metaEntityPartial.coordinates,
            regionLabel,
            regionDescription,
            metaEntity.culture,
            metaEntityId
          );

          if (regionResult.success && regionResult.region) {
            graphView.log('info', `Created emergent region "${regionResult.region.label}" for meta-entity "${metaEntity.name}"`);
          }
        }

        // Post-process: create governance faction if configured
        if (config.postProcess?.createGovernanceFaction) {
          const { factionId, relationships } = await createGovernanceFaction(
            graphView,
            metaEntityId,
            metaEntity,
            config.postProcess
          );

          relationshipsAdded.push(...relationships);
          if (factionId) {
            factionsCreated.push(factionId);
          }
        }

        // Apply member updates or fall back to archiving
        if (config.memberUpdates && config.memberUpdates.length > 0) {
          // Find the status mutation if present
          const statusMutation = config.memberUpdates.find(
            m => m.type === 'change_status'
          ) as { type: 'change_status'; newStatus: string } | undefined;

          const newStatus = statusMutation?.newStatus ?? FRAMEWORK_STATUS.SUBSUMED;

          // Apply status change to each cluster member
          for (const memberId of clusterIds) {
            graphView.updateEntityStatus(memberId, newStatus);

            entitiesModified.push({
              id: memberId,
              changes: { status: newStatus }
            });
          }
        } else {
          // Original behavior: archive as historical
          graphView.archiveEntities(
            clusterIds,
            {
              archiveRelationships: false,
              excludeRelationshipKinds: [FRAMEWORK_RELATIONSHIP_KINDS.PART_OF]
            }
          );

          // Track modifications
          clusterIds.forEach(id => {
            entitiesModified.push({
              id,
              changes: { status: 'historical' }
            });
          });
        }

        // Exit narration context if we entered one
        if (config.narrationTemplate && tracker) {
          tracker.exitContext();
        }
      }

      // Pressure changes
      const pressureChanges = metaEntitiesCreated.length > 0
        ? (config.postProcess?.pressureChanges ?? { stability: 2 })
        : {};

      return {
        relationshipsAdded,
        entitiesModified,
        pressureChanges,
        description: `${config.name}: ${metaEntitiesCreated.length} meta-entities formed` +
          (factionsCreated.length > 0 ? `, ${factionsCreated.length} factions` : ''),
        narrationsByGroup: Object.keys(narrationsByGroup).length > 0 ? narrationsByGroup : undefined
      };
    }
  };
}
