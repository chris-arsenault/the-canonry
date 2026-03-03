import { SimulationSystem, SystemResult, Era , entityCriteria } from '../engine/types';
import { HardState } from '../core/worldTypes';
import {
  FRAMEWORK_ENTITY_KINDS,
  FRAMEWORK_STATUS,
  FRAMEWORK_CULTURES,
  FRAMEWORK_TAGS
} from '@canonry/world-schema';
import { WorldRuntime } from '../runtime/worldRuntime';
import type { EraSpawnerConfig } from '../engine/systemInterpreter';
import { createSystemContext, prepareMutation } from '../rules';

/**
 * Era Spawner System
 *
 * Framework-level system that ensures the first era entity exists in the graph.
 *
 * NEW LAZY SPAWNING MODEL:
 * - Only the FIRST era is spawned at initialization
 * - Subsequent eras are spawned by eraTransition when conditions are met
 * - This supports divergent era paths where the next era depends on world state
 *
 * Era Lifecycle:
 * 1. First era is spawned at init with status='current'
 * 2. eraTransition handles checking exitConditions and finding/spawning next era
 * 3. Era entities are created on-demand when transitioned into
 *
 * This system only runs once to spawn the first era if it doesn't exist.
 */

/**
 * Create an era entity from config.
 * Exported so eraTransition can use it for lazy spawning.
 */
export function createEraEntity(
  configEra: Era,
  tick: number,
  status: string,
  id: string
): { entity: HardState } {
  // Use config ID as entity ID - this must match the era field in history events
  const resolvedId = id;
  const eraEntity: HardState = {
    id: resolvedId,
    kind: FRAMEWORK_ENTITY_KINDS.ERA,
    subtype: configEra.id,
    name: configEra.name,
    summary: configEra.summary,       // User-defined, locked
    lockedSummary: true,              // Prevent enrichment from overwriting
    narrativeHint: '',
    description: '',                  // LLM will generate via enrichment
    status: status,
    prominence: 5.0,  // Eras are always mythic (world-defining)
    culture: FRAMEWORK_CULTURES.WORLD,  // Eras are world-level entities
    eraId: resolvedId,
    tags: {
      [FRAMEWORK_TAGS.TEMPORAL]: true,
      [FRAMEWORK_TAGS.ERA]: true,
      [FRAMEWORK_TAGS.ERA_ID]: configEra.id
    },
    createdAt: tick,
    updatedAt: tick,
    coordinates: { x: 50, y: 50, z: 50 },  // Eras are world-level, centered in their map
    temporal: status === FRAMEWORK_STATUS.CURRENT
      ? { startTick: tick, end: { occurred: false, tick: 0 } }
      : { startTick: tick, end: { occurred: false, tick: 0 } },
    catalyst: { canAct: false },
    regionId: '',
    allRegionIds: [],
    createdBy: { tick, source: 'framework', sourceId: 'era_spawner', success: true, narration: '' },
  };

  return { entity: eraEntity };
}

/**
 * Apply entry effects when transitioning INTO an era.
 */
export function applyEntryEffects(
  graphView: WorldRuntime,
  configEra: Era
): Record<string, number> {
  const entryEffects = configEra.entryEffects;
  const mutations = entryEffects.mutations;
  if (mutations.length === 0) return {};

  const ctx = createSystemContext(graphView);
  const pressureChanges: Record<string, number> = {};

  for (const mutation of mutations) {
    const result = prepareMutation(mutation, ctx);
    for (const [pressureId, delta] of Object.entries(result.pressureChanges)) {
      pressureChanges[pressureId] = (pressureChanges[pressureId] || 0) + delta;
    }
  }

  return pressureChanges;
}

/**
 * Create an Era Spawner system with the given configuration.
 */
export function createEraSpawnerSystem(config: EraSpawnerConfig): SimulationSystem {
  const emptyResult = (description: string): SystemResult => ({
    relationshipsAdded: [],
    relationshipsAdjusted: [],
    relationshipsToArchive: [],
    entitiesModified: [],
    pressureChanges: {},
    description,
    details: {},
    narrationsByGroup: {},
  });

  return {
    id: config.id || 'era_spawner',
    name: config.name || 'Era Initialization',
    state: {},
    initialize: () => {},

    apply: (graphView: WorldRuntime, _modifier: number = 1.0): SystemResult => {
      // Check if any era entities already exist
      const existingEras = graphView.findEntities(entityCriteria({ kind: FRAMEWORK_ENTITY_KINDS.ERA }));

      if (existingEras.length > 0) {
        // Eras already exist - skip
        return emptyResult(`${existingEras.length} era entities already exist`);
      }

      // Get eras from config
      const configEras = graphView.config.eras;
      if (configEras.length === 0) {
        return emptyResult('No eras defined in config');
      }

      // LAZY SPAWNING: Only create the FIRST era at init
      const firstEraConfig = configEras[0];
      const { entity: firstEra } = createEraEntity(
        firstEraConfig,
        graphView.tick,
        FRAMEWORK_STATUS.CURRENT,
        firstEraConfig.id  // Use config ID directly
      );

      // Add era entity to graph
      graphView.loadEntity(firstEra);

      // Set currentEra reference
      graphView.setCurrentEra(firstEraConfig);

      // Apply entry effects for the first era
      const pressureChanges = applyEntryEffects(graphView, firstEraConfig);

      graphView.log('info', `[EraSpawner] Started first era: ${firstEraConfig.name}`, {});

      return {
        relationshipsAdded: [],
        relationshipsAdjusted: [],
        relationshipsToArchive: [],
        entitiesModified: [],
        pressureChanges,
        description: `Started first era: ${firstEraConfig.name}`,
        details: {},
        narrationsByGroup: {},
      };
    }
  };
}
