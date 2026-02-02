import { GrowthTemplate, SimulationSystem, Era, EngineConfig, GrowthPhaseCompletion } from '../engine/types';
import { DeclarativeTemplate } from '../engine/declarativeTypes';
import { TemplateInterpreter } from '../engine/templateInterpreter';
import { PopulationTracker, PopulationMetrics } from '../statistics/populationTracker';
import { ContractEnforcer } from '../engine/contractEnforcer';
import { WorldRuntime } from '../runtime/worldRuntime';
import { pickRandom } from '../utils';
import { initializeCatalystSmart } from '../systems/catalystHelpers';
import { StatisticsCollector } from '../statistics/statisticsCollector';
import type { HardState, Relationship } from '../core/worldTypes';
import type { DiscretePressureModification, ISimulationEmitter, PressureModificationSource } from '../observer/types';
import type { StateChangeTracker, RelationshipSummary } from '../narrative/stateChangeTracker';
import type { MutationTracker } from '../narrative/mutationTracker';
import { prominenceLabel } from '../rules/types';
import { interpolate, createGeneratorContext } from '../narrative/narrationTemplate';

export interface GrowthSystemConfig {
  id: string;
  name: string;
  description?: string;
  /** Hard cap on template executions per tick (default: 5) */
  maxTemplatesPerTick?: number;
  /** Minimum templates to attempt per tick while target remains (default: 1) */
  minTemplatesPerTick?: number;
  /** Rolling window for average entities per template (default: 30) */
  yieldAveragingWindow?: number;
  /** Safety cap on selection attempts per tick (default: 40) */
  maxAttemptsPerTick?: number;
}

export interface GrowthSystemDependencies {
  engineConfig: EngineConfig;
  runtimeTemplates: GrowthTemplate[];
  declarativeTemplates: Map<string, DeclarativeTemplate>;
  templateInterpreter: TemplateInterpreter;
  populationTracker: PopulationTracker;
  contractEnforcer: ContractEnforcer;
  templateRunCounts: Map<string, number>;
  maxRunsPerTemplate: number;
  statisticsCollector: StatisticsCollector;
  emitter: ISimulationEmitter;
  stateChangeTracker: StateChangeTracker;
  /**
   * Mutation tracker for lineage context management.
   * Used to stamp entities/relationships with their creation source.
   * See LINEAGE.md for design details.
   */
  mutationTracker?: MutationTracker;
  getPendingPressureModifications: () => DiscretePressureModification[];
  trackPressureModification: (pressureId: string, delta: number, source: PressureModificationSource) => void;
  calculateGrowthTarget: () => number;
  sampleTemplate: (era: Era, applicableTemplates: GrowthTemplate[], metrics: PopulationMetrics) => GrowthTemplate | undefined;
  getCurrentEpoch: () => number;
  getEpochEra: () => Era;
}

export interface GrowthEpochSummary {
  epoch: number;
  target: number;
  entitiesCreated: number;
  templatesApplied: number;
  templatesUsed: string[];
}

export interface GrowthSystem extends SimulationSystem {
  startEpoch(era: Era): void;
  completeEpoch(): GrowthEpochSummary;
  reset(): void;
  getEpochTarget(): number;
}

interface GrowthState {
  epoch: number;
  epochTarget: number;
  entitiesCreated: number;
  templatesApplied: number;
  templatesUsed: Set<string>;
  yieldSamples: number[];
  phaseCompleted: boolean;
  epochEra?: Era;
}

export function createGrowthSystem(
  config: GrowthSystemConfig,
  deps: GrowthSystemDependencies
): GrowthSystem {
  const state: GrowthState = {
    epoch: -1,
    epochTarget: 0,
    entitiesCreated: 0,
    templatesApplied: 0,
    templatesUsed: new Set(),
    yieldSamples: [],
    phaseCompleted: false
  };

  const maxTemplatesPerTick = config.maxTemplatesPerTick ?? 5;
  const minTemplatesPerTick = config.minTemplatesPerTick ?? 1;
  const yieldWindow = config.yieldAveragingWindow ?? 30;
  const maxAttemptsPerTick = config.maxAttemptsPerTick ?? 40;

  function getExpectedYield(): number {
    if (state.yieldSamples.length === 0) return 1;
    const avg = state.yieldSamples.reduce((sum, val) => sum + val, 0) / state.yieldSamples.length;
    // Avoid runaway budgets from unlucky zeros
    return Math.max(1, avg);
  }

  function recordPhaseCompletion(graphView: WorldRuntime, reason: GrowthPhaseCompletion['reason']): void {
    if (state.phaseCompleted) return;
    if (state.epochTarget <= 0) return;
    const eraId = state.epochEra?.id ?? deps.getEpochEra().id;
    if (!eraId) return;

    state.phaseCompleted = true;
    graphView.growthPhaseHistory.push({
      epoch: state.epoch,
      eraId,
      tick: graphView.tick,
      reason
    });
  }

  async function applyTemplateOnce(
    template: GrowthTemplate,
    graphView: WorldRuntime,
    era: Era
  ): Promise<number> {
    try {
      // Check applicability
      if (!template.canApply(graphView)) {
        const declTemplate = deps.declarativeTemplates.get(template.id);
        if (declTemplate) {
          const diag = deps.templateInterpreter.diagnoseCanApply(declTemplate, graphView);
          if (!diag.applicabilityPassed) {
            graphView.debug('templates', `${template.id} rejected: ${diag.failedRules.join('; ')}`);
          } else if (diag.selectionCount === 0) {
            graphView.debug('templates', `${template.id} selection(${diag.selectionStrategy}) returned 0 targets`);
          }
        }
        return 0;
      }

      const templateTargets = template.findTargets(graphView);
      if (templateTargets.length === 0) {
        graphView.debug('selection', `${template.id} found no targets via findTargets()`);
        return 0;
      }

      const target = pickRandom(templateTargets);

      const pressureModsBefore = deps.getPendingPressureModifications().length;
      graphView.setPressureModificationCallback((pressureId, delta, source) => {
        deps.trackPressureModification(pressureId, delta, source);
      });
      graphView.setCurrentSource({ type: 'template', templateId: template.id });

      // LINEAGE: Enter template context for entity/relationship stamping.
      // All entities and relationships created will have
      // createdBy = { tick, source: 'template', sourceId: template.id }.
      // See LINEAGE.md for design details.
      // NOTE: Context must stay open until AFTER addEntity/createRelationship calls below.
      deps.mutationTracker?.enterContext('template', template.id);

      let result;
      try {
        result = await template.expand(graphView, target);
      } catch (error) {
        // LINEAGE: Exit context on expand error
        deps.mutationTracker?.exitContext();
        throw error;
      }
      graphView.clearCurrentSource();

      // Contract enforcement warnings
      const allTagsSet = new Set<string>();
      for (const entity of result.entities) {
        Object.keys(entity.tags || {}).forEach(tag => allTagsSet.add(tag));
      }
      const allTagsToAdd = Array.from(allTagsSet);
      const tagSaturationCheck = deps.contractEnforcer.checkTagSaturation(graphView, allTagsToAdd);
      if (tagSaturationCheck.saturated) {
        deps.emitter.log('warn', `Template ${template.id} would oversaturate tags: ${tagSaturationCheck.oversaturatedTags.join(', ')}`);
      }
      const orphanCheck = deps.contractEnforcer.checkTagOrphans(allTagsToAdd);
      if (orphanCheck.hasOrphans && orphanCheck.orphanTags.length >= 3) {
        deps.emitter.log('debug', `Template ${template.id} creates unregistered tags: ${orphanCheck.orphanTags.slice(0, 5).join(', ')}`);
      }

      deps.statisticsCollector.recordTemplateApplication(template.id);

      const createdEntities: HardState[] = [];
      const newIds: string[] = [];

      for (let i = 0; i < result.entities.length; i++) {
        const entity = result.entities[i];
        const placementStrategy = result.placementStrategies?.[i] || 'unknown';
        const id = await graphView.addEntity(entity, `template:${template.id}`, placementStrategy);
        newIds.push(id);
        const ref = graphView.getEntity(id);
        if (ref) {
          createdEntities.push(ref);
        }
      }

      for (const entity of createdEntities) {
        initializeCatalystSmart(entity);
      }

      result.relationships.forEach(rel => {
        const srcId = rel.src.startsWith('will-be-assigned-')
          ? newIds[parseInt(rel.src.split('-')[3])]
          : rel.src;
        const dstId = rel.dst.startsWith('will-be-assigned-')
          ? newIds[parseInt(rel.dst.split('-')[3])]
          : rel.dst;

        if (srcId && dstId) {
          graphView.createRelationship(rel.kind, srcId, dstId, rel.strength);
        }
      });

      // LINEAGE: Exit template context now that entities/relationships are created.
      // They are now stamped with createdBy = { source: 'template', sourceId: template.id }.
      deps.mutationTracker?.exitContext();

      for (const entity of createdEntities) {
        const coverageCheck = deps.contractEnforcer.enforceTagCoverage(entity, graphView);
        if (coverageCheck.needsAdjustment) {
          deps.emitter.log('debug', coverageCheck.suggestion || '', { entity: entity.id });
        }
        const taxonomyCheck = deps.contractEnforcer.validateTagTaxonomy(entity);
        if (!taxonomyCheck.valid) {
          deps.emitter.log('warn', `Entity ${entity.name} has conflicting tags`, { conflicts: taxonomyCheck.conflicts });
        }
      }

      // Record creation batch for narrative event generation
      if (newIds.length > 0) {
        // Summarize relationships by kind
        const relationshipCounts = new Map<string, number>();
        for (const rel of result.relationships) {
          relationshipCounts.set(rel.kind, (relationshipCounts.get(rel.kind) || 0) + 1);
        }
        const relationshipSummary: RelationshipSummary[] = [];
        for (const [kind, count] of relationshipCounts) {
          relationshipSummary.push({ kind, count });
        }

        // Use description from first creation item if available
        const declTemplate = deps.declarativeTemplates.get(template.id);
        const rawDescription = declTemplate?.creation?.[0]?.description;
        // DescriptionSpec can be string or { template, replacements } - extract string if possible
        const primaryDescription = typeof rawDescription === 'string' ? rawDescription : undefined;

        // Generate narration ONCE here, now that entities have names
        // result.resolvedVariables contains $target, $enemy, etc. from template expansion
        let narration: string | undefined;
        if (declTemplate?.narrationTemplate) {
          // Start with the resolved variables from template expansion (like $target, $enemy)
          const variables: Record<string, HardState | HardState[] | undefined> = {
            ...(result.resolvedVariables || {}),
          };

          // Add created entities by their entityRef (like $war, $ideology)
          // Use entityRefToIndex mapping since createChance can skip entities
          if (result.entityRefToIndex) {
            for (const [entityRef, idx] of Object.entries(result.entityRefToIndex)) {
              const index = idx as number;
              if (createdEntities[index]) {
                // Ensure $ prefix for the key
                const key = entityRef.startsWith('$') ? entityRef : `$${entityRef}`;
                variables[key] = createdEntities[index];
              }
            }
          }

          const narrationCtx = createGeneratorContext({
            target,
            variables,
          });
          const narrationResult = interpolate(declTemplate.narrationTemplate, narrationCtx);
          // Use narration even if not complete - partial narration better than mechanical
          narration = narrationResult.text;
          if (!narrationResult.complete) {
            // Debug: log unresolved tokens (use debug level since partial is expected sometimes)
            console.debug(`[GrowthSystem] Template ${template.id} narration partial:`, {
              unresolvedTokens: narrationResult.unresolvedTokens,
              variableKeys: Object.keys(variables),
            });
          }
        }

        deps.stateChangeTracker.recordCreationBatch(
          template.id,
          template.name || template.id,
          newIds,
          relationshipSummary,
          primaryDescription || result.description,
          narration
        );
      }

      const templatePressureMods = deps.getPendingPressureModifications().slice(pressureModsBefore);
      const pressureChanges: Record<string, number> = {};
      for (const mod of templatePressureMods) {
        pressureChanges[mod.pressureId] = (pressureChanges[mod.pressureId] || 0) + mod.delta;
      }

      const resolvedRelationships = result.relationships.map(rel => ({
        kind: rel.kind,
        srcId: rel.src.startsWith('will-be-assigned-')
          ? newIds[parseInt(rel.src.split('-')[3])]
          : rel.src,
        dstId: rel.dst.startsWith('will-be-assigned-')
          ? newIds[parseInt(rel.dst.split('-')[3])]
          : rel.dst,
        strength: rel.strength
      }));

      deps.emitter.templateApplication({
        tick: graphView.tick,
        epoch: deps.getCurrentEpoch(),
        templateId: template.id,
        targetEntityId: target.id,
        targetEntityName: target.name,
        targetEntityKind: target.kind,
        description: result.description,
        entitiesCreated: createdEntities.map((e, i) => {
          const placementDebug = result.placementDebugList?.[i];
          const strategy = result.placementStrategies?.[i] || 'unknown';
          return {
            id: e.id,
            name: e.name,
            kind: e.kind,
            subtype: e.subtype,
            culture: e.culture,
            prominence: prominenceLabel(e.prominence),
            tags: e.tags,
            placementStrategy: strategy,
            coordinates: e.coordinates,
            regionId: placementDebug?.regionId ?? e.regionId,
            allRegionIds: placementDebug?.allRegionIds ?? e.allRegionIds,
            derivedTags: result.derivedTagsList?.[i],
            placement: placementDebug ? {
              anchorType: placementDebug.anchorType,
              anchorEntity: placementDebug.anchorEntity,
              anchorCulture: placementDebug.anchorCulture,
              resolvedVia: placementDebug.resolvedVia,
              seedRegionsAvailable: placementDebug.seedRegionsAvailable,
              emergentRegionCreated: placementDebug.emergentRegionCreated
            } : undefined
          };
        }),
        relationshipsCreated: resolvedRelationships,
        pressureChanges
      });

      return result.entities.length;
    } catch (error) {
      graphView.clearCurrentSource();
      const message = error instanceof Error ? error.message : String(error);
      const templateLabel = template.name ? `${template.name} (${template.id})` : template.id;
      throw new Error(`Template ${templateLabel} failed: ${message}`);
    }
  }

  function buildApplicableTemplates(
    graphView: WorldRuntime,
    rejectionReasons: Map<string, string>
  ): GrowthTemplate[] {
    return deps.runtimeTemplates.filter(t => {
      const runCount = deps.templateRunCounts.get(t.id) || 0;
      if (runCount >= deps.maxRunsPerTemplate) {
        rejectionReasons.set(t.id, `run_cap: ${runCount}/${deps.maxRunsPerTemplate}`);
        return false;
      }

      if (!t.canApply(graphView)) {
        const declTemplate = deps.declarativeTemplates.get(t.id);
        if (declTemplate) {
          const diag = deps.templateInterpreter.diagnoseCanApply(declTemplate, graphView);
          if (!diag.applicabilityPassed) {
            rejectionReasons.set(t.id, `applicability: ${diag.failedRules.join('; ')}`);
          } else if (diag.selectionCount === 0) {
            rejectionReasons.set(t.id, `selection(${diag.selectionStrategy}): no targets found`);
          }
        } else {
          rejectionReasons.set(t.id, 'canApply: false');
        }
        return false;
      }

      return true;
    });
  }

  const system: GrowthSystem = {
    id: config.id,
    name: config.name,

    startEpoch: (era: Era) => {
      state.epoch = deps.getCurrentEpoch();
      state.epochTarget = deps.calculateGrowthTarget();
      state.entitiesCreated = 0;
      state.templatesApplied = 0;
      state.templatesUsed.clear();
      state.phaseCompleted = false;
      state.epochEra = era;

      deps.emitter.log('info', `[Growth] Planning epoch ${state.epoch} in era ${era.name} with target ${state.epochTarget}`);
    },

    getEpochTarget: () => state.epochTarget,

    completeEpoch: (): GrowthEpochSummary => ({
      epoch: state.epoch,
      target: state.epochTarget,
      entitiesCreated: state.entitiesCreated,
      templatesApplied: state.templatesApplied,
      templatesUsed: Array.from(state.templatesUsed)
    }),

    reset: () => {
      state.epoch = -1;
      state.epochTarget = 0;
      state.entitiesCreated = 0;
      state.templatesApplied = 0;
      state.templatesUsed.clear();
      state.yieldSamples = [];
      state.phaseCompleted = false;
    },

    apply: async (graphView: WorldRuntime, modifier: number) => {
      if (state.epoch !== deps.getCurrentEpoch()) {
        state.epochTarget = deps.calculateGrowthTarget();
        state.entitiesCreated = 0;
        state.templatesApplied = 0;
        state.templatesUsed.clear();
        state.epoch = deps.getCurrentEpoch();
        state.phaseCompleted = false;
        state.epochEra = deps.getEpochEra();
        const syncedEra = state.epochEra ?? deps.getEpochEra();
        deps.emitter.log('info', `[Growth] Auto-sync epoch ${state.epoch} in era ${syncedEra.name} with target ${state.epochTarget}`);
      }
      const era = state.epochEra ?? deps.getEpochEra();

      if (modifier <= 0) {
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: 'Growth disabled for this era'
        };
      }

      const remainingEntities = Math.max(0, state.epochTarget - state.entitiesCreated);
      if (remainingEntities === 0) {
        recordPhaseCompletion(graphView, 'target_met');
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: `Growth target met for epoch ${state.epoch}`
        };
      }

      deps.populationTracker.update(graphView);
      const metrics = deps.populationTracker.getMetrics();

      const tickInEpoch = graphView.tick % deps.engineConfig.ticksPerEpoch;
      const ticksRemaining = Math.max(1, deps.engineConfig.ticksPerEpoch - tickInEpoch);
      const expectedYield = getExpectedYield();

      let templateBudget = Math.ceil((remainingEntities / ticksRemaining) / expectedYield);
      templateBudget = Math.ceil(templateBudget * modifier);
      const effectiveMin = remainingEntities > 0 ? minTemplatesPerTick : 0;
      templateBudget = Math.max(effectiveMin, Math.min(maxTemplatesPerTick, templateBudget));

      let appliedThisTick = 0;
      let createdThisTick = 0;
      let attempts = 0;

      while (appliedThisTick < templateBudget && attempts < maxAttemptsPerTick) {
        attempts++;
        const rejectionReasons: Map<string, string> = new Map();
        const applicableTemplates = buildApplicableTemplates(graphView, rejectionReasons);

        if (applicableTemplates.length === 0) {
          deps.emitter.log('warn', `No applicable templates remaining (${state.entitiesCreated}/${state.epochTarget} entities created)`);
          graphView.debug('templates', `[Filter] All ${deps.runtimeTemplates.length} templates rejected:`);
          for (const [templateId, reason] of rejectionReasons) {
            graphView.debug('templates', `  ${templateId}: ${reason}`);
          }
          recordPhaseCompletion(graphView, 'exhausted');
          break;
        }

        const template = deps.sampleTemplate(era, applicableTemplates, metrics);
        if (!template) {
          if (attempts < 5 || attempts % 20 === 0) {
            graphView.debug('templates', `[Attempt ${attempts}] Failed to sample template from ${applicableTemplates.length} options`);
          }
          continue;
        }

        const entitiesCreated = await applyTemplateOnce(template, graphView, era);
        if (entitiesCreated > 0) {
          appliedThisTick++;
          createdThisTick += entitiesCreated;
          state.entitiesCreated += entitiesCreated;
          state.templatesApplied += 1;
          state.templatesUsed.add(template.id);
          const currentCount = deps.templateRunCounts.get(template.id) || 0;
          deps.templateRunCounts.set(template.id, currentCount + 1);

          state.yieldSamples.push(entitiesCreated);
          if (state.yieldSamples.length > yieldWindow) {
            state.yieldSamples.shift();
          }
        }

        if (state.entitiesCreated >= state.epochTarget) {
          break;
        }
      }

      if (state.entitiesCreated >= state.epochTarget) {
        recordPhaseCompletion(graphView, 'target_met');
      }

      return {
        relationshipsAdded: [],
        entitiesModified: [],
        pressureChanges: {},
        description: createdThisTick > 0
          ? `Growth tick: +${createdThisTick} entities (epoch ${state.entitiesCreated}/${state.epochTarget})`
          : 'Growth tick: no entities created'
      };
    }
  };

  return system;
}
