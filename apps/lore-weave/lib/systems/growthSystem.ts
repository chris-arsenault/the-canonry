import { GrowthTemplate, SimulationSystem, Era, EngineConfig, GrowthPhaseCompletion, TemplateResult } from '../engine/types';
import { DeclarativeTemplate } from '../engine/declarativeTypes';
import { TemplateInterpreter } from '../engine/templateInterpreter';
import { PopulationTracker, PopulationMetrics } from '../statistics/populationTracker';
import { ContractEnforcer } from '../engine/contractEnforcer';
import { WorldRuntime } from '../runtime/worldRuntime';
import { pickRandom } from '../utils';
import { initializeCatalystSmart } from '../systems/catalystHelpers';
import { StatisticsCollector } from '../statistics/statisticsCollector';
import type { HardState } from '../core/worldTypes';
import type { DiscretePressureModification, ISimulationEmitter, PressureModificationSource } from '../observer/types';
import type { StateChangeTracker, RelationshipSummary } from '../narrative/stateChangeTracker';
import type { MutationTracker } from '../narrative/mutationTracker';
import { prominenceLabel } from '../rules/types';
import { interpolate, createGeneratorContext } from '../narrative/narrationTemplate';

export interface GrowthSystemConfig {
  id: string;
  name: string;
  description: string;
  /** Hard cap on template executions per tick (default: 5) */
  maxTemplatesPerTick: number;
  /** Minimum templates to attempt per tick while target remains (default: 1) */
  minTemplatesPerTick: number;
  /** Rolling window for average entities per template (default: 30) */
  yieldAveragingWindow: number;
  /** Safety cap on selection attempts per tick (default: 40) */
  maxAttemptsPerTick: number;
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
  mutationTracker: MutationTracker;
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

// ============================================================================
// Module-level helpers (pure functions, no state)
// ============================================================================

function buildNarrationText(
  declTemplate: DeclarativeTemplate, target: HardState, result: TemplateResult,
  createdEntities: HardState[]
): string | undefined {
  if (!declTemplate.narrationTemplate) return undefined;
  const variables: Record<string, HardState | HardState[] | undefined> = { ...result.resolvedVariables };
  if (Object.keys(result.entityRefToIndex).length > 0) {
    for (const [entityRef, idx] of Object.entries(result.entityRefToIndex)) {
      if (createdEntities[idx]) {
        variables[entityRef.startsWith('$') ? entityRef : `$${entityRef}`] = createdEntities[idx];
      }
    }
  }
  const ctx = createGeneratorContext({ target, selected: target, variables, entitiesCreated: createdEntities, counts: {}, values: {} });
  const narrationResult = interpolate(declTemplate.narrationTemplate, ctx);
  return narrationResult.text;
}

function buildEntityCreationInfo(createdEntities: HardState[], result: TemplateResult) {
  return createdEntities.map((e, i) => {
    const debug = result.placementDebugList[i];
    return {
      id: e.id, name: e.name, kind: e.kind, subtype: e.subtype,
      culture: e.culture, prominence: prominenceLabel(e.prominence),
      tags: e.tags, placementStrategy: result.placementStrategies[i] || 'unknown',
      coordinates: e.coordinates, regionId: debug.regionId ?? e.regionId,
      allRegionIds: debug.allRegionIds,
      derivedTags: result.derivedTagsList[i],
      placement: {
        anchorType: debug.anchorType, anchorEntity: debug.anchorEntity,
        anchorCulture: debug.anchorCulture, resolvedVia: debug.resolvedVia,
        seedRegionsAvailable: debug.seedRegionsAvailable,
        regionsTried: [],
        emergentRegionCreated: debug.emergentRegionCreated,
        failureReason: '',
      },
    };
  });
}

// ============================================================================
// GrowthSystem class
// ============================================================================

/**
 * Growth system manages entity creation via template expansion.
 *
 * Responsibilities:
 * - Epoch lifecycle (start, apply per tick, complete)
 * - Template selection and application budgeting
 * - Entity creation, relationship formation, narration
 * - Contract enforcement and lineage tracking
 */
class GrowthSystemImpl implements GrowthSystem {
  readonly id: string;
  readonly name: string;
  state: unknown = null;

  private readonly maxTemplatesPerTick: number;
  private readonly minTemplatesPerTick: number;
  private readonly yieldWindow: number;
  private readonly maxAttemptsPerTick: number;
  private readonly deps: GrowthSystemDependencies;

  private epoch = -1;
  private epochTarget = 0;
  private entitiesCreated = 0;
  private templatesApplied = 0;
  private readonly templatesUsed = new Set<string>();
  private yieldSamples: number[] = [];
  private phaseCompleted = false;
  private epochEra!: Era;

  constructor(config: GrowthSystemConfig, deps: GrowthSystemDependencies) {
    this.id = config.id;
    this.name = config.name;
    this.maxTemplatesPerTick = config.maxTemplatesPerTick;
    this.minTemplatesPerTick = config.minTemplatesPerTick;
    this.yieldWindow = config.yieldAveragingWindow;
    this.maxAttemptsPerTick = config.maxAttemptsPerTick;
    this.deps = deps;
  }

  initialize(): void { /* no-op — state initialized in constructor */ }

  startEpoch(era: Era): void {
    this.epoch = this.deps.getCurrentEpoch();
    this.epochTarget = this.deps.calculateGrowthTarget();
    this.entitiesCreated = 0;
    this.templatesApplied = 0;
    this.templatesUsed.clear();
    this.phaseCompleted = false;
    this.epochEra = era;
    this.deps.emitter.log('info', `[Growth] Planning epoch ${this.epoch} in era ${era.name} with target ${this.epochTarget}`, {});
  }

  getEpochTarget(): number { return this.epochTarget; }

  completeEpoch(): GrowthEpochSummary {
    return {
      epoch: this.epoch, target: this.epochTarget,
      entitiesCreated: this.entitiesCreated, templatesApplied: this.templatesApplied,
      templatesUsed: Array.from(this.templatesUsed),
    };
  }

  reset(): void {
    this.epoch = -1;
    this.epochTarget = 0;
    this.entitiesCreated = 0;
    this.templatesApplied = 0;
    this.templatesUsed.clear();
    this.yieldSamples = [];
    this.phaseCompleted = false;
  }

  async apply(graphView: WorldRuntime, modifier: number): Promise<import('../engine/types').SystemResult> {
    this.syncEpochIfNeeded();
    if (modifier <= 0) return this.emptyResult('Growth disabled for this era');

    const remaining = Math.max(0, this.epochTarget - this.entitiesCreated);
    if (remaining === 0) {
      this.recordPhaseCompletion(graphView, 'target_met');
      return this.emptyResult(`Growth target met for epoch ${this.epoch}`);
    }

    this.deps.populationTracker.update(graphView);
    const metrics = this.deps.populationTracker.getMetrics();
    const budget = this.computeBudget(graphView, remaining, modifier);

    let applied = 0, created = 0, attempts = 0;
    while (applied < budget && attempts < this.maxAttemptsPerTick) {
      attempts++;
      const r = await this.attemptOneTemplate(graphView, this.epochEra, metrics, attempts);
      if (r.exhausted) break;
      applied += r.appliedDelta;
      created += r.createdDelta;
      if (this.entitiesCreated >= this.epochTarget) break;
    }

    if (this.entitiesCreated >= this.epochTarget) this.recordPhaseCompletion(graphView, 'target_met');
    return this.emptyResult(created > 0
      ? `Growth tick: +${created} entities (epoch ${this.entitiesCreated}/${this.epochTarget})`
      : 'Growth tick: no entities created');
  }

  // --- Epoch management ---

  private syncEpochIfNeeded(): void {
    if (this.epoch === this.deps.getCurrentEpoch()) return;
    this.epochTarget = this.deps.calculateGrowthTarget();
    this.entitiesCreated = 0;
    this.templatesApplied = 0;
    this.templatesUsed.clear();
    this.epoch = this.deps.getCurrentEpoch();
    this.phaseCompleted = false;
    this.epochEra = this.deps.getEpochEra();
    this.deps.emitter.log('info', `[Growth] Auto-sync epoch ${this.epoch} in era ${this.epochEra.name} with target ${this.epochTarget}`, {});
  }

  private computeBudget(graphView: WorldRuntime, remaining: number, modifier: number): number {
    const tickInEpoch = graphView.tick % this.deps.engineConfig.ticksPerEpoch;
    const ticksLeft = Math.max(1, this.deps.engineConfig.ticksPerEpoch - tickInEpoch);
    const yield_ = this.yieldSamples.length === 0 ? 1 : Math.max(1, this.yieldSamples.reduce((s, v) => s + v, 0) / this.yieldSamples.length);
    const budget = Math.ceil(Math.ceil((remaining / ticksLeft) / yield_) * modifier);
    return Math.max(remaining > 0 ? this.minTemplatesPerTick : 0, Math.min(this.maxTemplatesPerTick, budget));
  }

  private recordPhaseCompletion(graphView: WorldRuntime, reason: GrowthPhaseCompletion['reason']): void {
    if (this.phaseCompleted || this.epochTarget <= 0 || !this.epochEra.id) return;
    this.phaseCompleted = true;
    graphView.growthPhaseHistory.push({ epoch: this.epoch, eraId: this.epochEra.id, tick: graphView.tick, reason });
  }

  // --- Template selection and application ---

  private async attemptOneTemplate(
    graphView: WorldRuntime, era: Era, metrics: PopulationMetrics, attempts: number
  ): Promise<{ appliedDelta: number; createdDelta: number; exhausted: boolean }> {
    const rejections = new Map<string, string>();
    const applicable = this.filterApplicable(graphView, rejections);
    if (applicable.length === 0) {
      this.deps.emitter.log('warn', `No applicable templates remaining (${this.entitiesCreated}/${this.epochTarget})`, {});
      for (const [id, reason] of rejections) graphView.debug('templates', `  ${id}: ${reason}`);
      this.recordPhaseCompletion(graphView, 'exhausted');
      return { appliedDelta: 0, createdDelta: 0, exhausted: true };
    }
    const template = this.deps.sampleTemplate(era, applicable, metrics);
    if (!template) {
      if (attempts < 5 || attempts % 20 === 0) graphView.debug('templates', `[Attempt ${attempts}] No sample from ${applicable.length}`);
      return { appliedDelta: 0, createdDelta: 0, exhausted: false };
    }
    const count = await this.applyTemplate(template, graphView);
    if (count > 0) {
      this.recordYield(template, count);
      return { appliedDelta: 1, createdDelta: count, exhausted: this.entitiesCreated >= this.epochTarget };
    }
    return { appliedDelta: 0, createdDelta: 0, exhausted: false };
  }

  private filterApplicable(graphView: WorldRuntime, rejections: Map<string, string>): GrowthTemplate[] {
    return this.deps.runtimeTemplates.filter(t => {
      const runs = this.deps.templateRunCounts.get(t.id) || 0;
      if (runs >= this.deps.maxRunsPerTemplate) { rejections.set(t.id, `run_cap: ${runs}/${this.deps.maxRunsPerTemplate}`); return false; }
      if (!t.canApply(graphView)) { this.diagnoseRejection(t, graphView, rejections); return false; }
      return true;
    });
  }

  private diagnoseRejection(t: GrowthTemplate, graphView: WorldRuntime, rejections: Map<string, string>): void {
    const decl = this.deps.declarativeTemplates.get(t.id);
    if (!decl) { rejections.set(t.id, 'canApply: false'); return; }
    const d = this.deps.templateInterpreter.diagnoseCanApply(decl, graphView);
    rejections.set(t.id, !d.applicabilityPassed ? `applicability: ${d.failedRules.join('; ')}` : `selection(${d.selectionStrategy}): no targets`);
  }

  private async applyTemplate(template: GrowthTemplate, graphView: WorldRuntime): Promise<number> {
    if (!template.canApply(graphView)) return 0;
    const targets = template.findTargets(graphView);
    if (targets.length === 0) { graphView.debug('selection', `${template.id} found no targets`); return 0; }
    try {
      return await this.expandAndCommit(template, graphView, pickRandom(targets));
    } catch (error) {
      graphView.clearCurrentSource();
      throw new Error(`Template ${template.name || template.id} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async expandAndCommit(template: GrowthTemplate, graphView: WorldRuntime, target: HardState): Promise<number> {
    const pressureBefore = this.deps.getPendingPressureModifications().length;
    graphView.setPressureModificationCallback((p, d, s) => this.deps.trackPressureModification(p, d, s));
    graphView.setCurrentSource({ type: 'template', templateId: template.id });
    this.deps.mutationTracker.enterContext('template', template.id, true, '');

    let result: TemplateResult;
    try { result = await template.expand(graphView, target); }
    catch (e) { this.deps.mutationTracker.exitContext(); throw e; }
    graphView.clearCurrentSource();

    this.checkContracts(result, template, graphView);
    this.deps.statisticsCollector.recordTemplateApplication(template.id);

    const { newIds, created } = await this.createEntities(result, graphView, template);
    this.formRelationships(result, graphView, newIds);
    this.deps.mutationTracker.exitContext();

    this.validateCreated(created, graphView);
    this.recordBatch(template, result, newIds, created, target);
    this.emitApplication(template, result, target, graphView, newIds, created, pressureBefore);
    return result.entities.length;
  }

  // --- Entity operations ---

  private async createEntities(result: TemplateResult, graphView: WorldRuntime, template: GrowthTemplate) {
    const newIds: string[] = [];
    const created: HardState[] = [];
    for (let i = 0; i < result.entities.length; i++) {
      const id = await graphView.addEntity(result.entities[i], `template:${template.id}`, result.placementStrategies[i] || 'unknown');
      newIds.push(id);
      const ref = graphView.getEntity(id);
      if (ref) created.push(ref);
    }
    for (const e of created) initializeCatalystSmart(e);
    return { newIds, created };
  }

  private formRelationships(result: TemplateResult, graphView: WorldRuntime, newIds: string[]): void {
    for (const rel of result.relationships) {
      const src = rel.src.startsWith('will-be-assigned-') ? newIds[parseInt(rel.src.split('-')[3])] : rel.src;
      const dst = rel.dst.startsWith('will-be-assigned-') ? newIds[parseInt(rel.dst.split('-')[3])] : rel.dst;
      if (src && dst) graphView.createRelationship(rel.kind, src, dst, rel.strength);
    }
  }

  private checkContracts(result: TemplateResult, template: GrowthTemplate, graphView: WorldRuntime): void {
    const tags = Array.from(new Set(result.entities.flatMap(e => Object.keys(e.tags ?? {}))));
    const sat = this.deps.contractEnforcer.checkTagSaturation(graphView, tags);
    if (sat.saturated) this.deps.emitter.log('warn', `Template ${template.id} oversaturates: ${sat.oversaturatedTags.join(', ')}`, {});
    const orph = this.deps.contractEnforcer.checkTagOrphans(tags);
    if (orph.hasOrphans && orph.orphanTags.length >= 3) this.deps.emitter.log('debug', `Template ${template.id} unregistered: ${orph.orphanTags.slice(0, 5).join(', ')}`, {});
  }

  private validateCreated(entities: HardState[], graphView: WorldRuntime): void {
    for (const e of entities) {
      const cov = this.deps.contractEnforcer.enforceTagCoverage(e, graphView);
      if (cov.needsAdjustment) this.deps.emitter.log('debug', cov.suggestion || '', { entity: e.id });
      const tax = this.deps.contractEnforcer.validateTagTaxonomy(e);
      if (!tax.valid) this.deps.emitter.log('warn', `Entity ${e.name} has conflicting tags`, { conflicts: tax.conflicts });
    }
  }

  // --- Event recording ---

  private recordBatch(template: GrowthTemplate, result: TemplateResult, newIds: string[], created: HardState[], target: HardState): void {
    if (newIds.length === 0) return;
    const counts = new Map<string, number>();
    for (const r of result.relationships) counts.set(r.kind, (counts.get(r.kind) || 0) + 1);
    const summary: RelationshipSummary[] = [...counts].map(([kind, count]) => ({ kind, count }));
    const decl = this.deps.declarativeTemplates.get(template.id);
    const raw = decl?.creation[0]?.description;
    const narration = decl ? buildNarrationText(decl, target, result, created) : undefined;
    this.deps.stateChangeTracker.recordCreationBatch(template.id, template.name || template.id, newIds, summary, (typeof raw === 'string' ? raw : '') || result.description, narration ?? '');
  }

  private emitApplication(
    template: GrowthTemplate, result: TemplateResult, target: HardState,
    graphView: WorldRuntime, newIds: string[], created: HardState[], pressureBefore: number
  ): void {
    const mods = this.deps.getPendingPressureModifications().slice(pressureBefore);
    const pc: Record<string, number> = {};
    for (const m of mods) pc[m.pressureId] = (pc[m.pressureId] || 0) + m.delta;
    this.deps.emitter.templateApplication({
      tick: graphView.tick, epoch: this.deps.getCurrentEpoch(),
      templateId: template.id, targetEntityId: target.id, targetEntityName: target.name, targetEntityKind: target.kind,
      description: result.description, entitiesCreated: buildEntityCreationInfo(created, result),
      relationshipsCreated: result.relationships.map(r => ({
        kind: r.kind,
        srcId: r.src.startsWith('will-be-assigned-') ? newIds[parseInt(r.src.split('-')[3])] : r.src,
        dstId: r.dst.startsWith('will-be-assigned-') ? newIds[parseInt(r.dst.split('-')[3])] : r.dst,
        strength: r.strength,
      })),
      pressureChanges: pc,
    });
  }

  private recordYield(template: GrowthTemplate, count: number): void {
    this.entitiesCreated += count;
    this.templatesApplied += 1;
    this.templatesUsed.add(template.id);
    this.deps.templateRunCounts.set(template.id, (this.deps.templateRunCounts.get(template.id) || 0) + 1);
    this.yieldSamples.push(count);
    if (this.yieldSamples.length > this.yieldWindow) this.yieldSamples.shift();
  }

  private emptyResult(description: string): import('../engine/types').SystemResult {
    return { relationshipsAdded: [], relationshipsAdjusted: [], relationshipsToArchive: [], entitiesModified: [], pressureChanges: {}, description, details: {}, narrationsByGroup: {} };
  }
}

// ============================================================================
// Factory function (preserves existing API)
// ============================================================================

export function createGrowthSystem(config: GrowthSystemConfig, deps: GrowthSystemDependencies): GrowthSystem {
  return new GrowthSystemImpl(config, deps);
}
