/**
 * SimulationEmitter Implementation
 *
 * Provides the concrete emitter used by WorldEngine to emit simulation events.
 * This implementation posts messages via a provided postMessage function,
 * making it suitable for web worker communication.
 */

import {
  ISimulationEmitter,
  SimulationEvent,
  ProgressPayload,
  LogPayload,
  ValidationPayload,
  EpochStartPayload,
  EpochStatsPayload,
  GrowthPhasePayload,
  TemplateApplicationPayload,
  ActionApplicationPayload,
  PressureUpdatePayload,
  PopulationPayload,
  TemplateUsagePayload,
  CoordinateStatsPayload,
  TagHealthPayload,
  SystemHealthPayload,
  SystemActionPayload,
  EntityBreakdownPayload,
  CatalystStatsPayload,
  RelationshipBreakdownPayload,
  NotableEntitiesPayload,
  SimulationResultPayload,
  StateExportPayload,
  ErrorPayload,
} from './types';

/**
 * SimulationEmitter that posts events via a provided function.
 * Typically used with web worker's postMessage.
 */
export class SimulationEmitter implements ISimulationEmitter {
  private postFn: (event: SimulationEvent) => void;

  constructor(postFn: (event: SimulationEvent) => void) {
    if (!postFn) {
      throw new Error(
        'SimulationEmitter: postFn is required. ' +
        'Provide a function that handles emitted events (e.g., postMessage for web workers).'
      );
    }
    this.postFn = postFn;
  }

  emit(event: SimulationEvent): void {
    this.postFn(event);
  }

  progress(payload: ProgressPayload): void {
    this.emit({ type: 'progress', payload });
  }

  log(level: LogPayload['level'], message: string, context?: Record<string, unknown>): void {
    this.emit({
      type: 'log',
      payload: {
        level,
        message,
        timestamp: Date.now(),
        context,
      },
    });
  }

  validation(payload: ValidationPayload): void {
    this.emit({ type: 'validation', payload });
  }

  epochStart(payload: EpochStartPayload): void {
    this.emit({ type: 'epoch_start', payload });
  }

  epochStats(payload: EpochStatsPayload): void {
    this.emit({ type: 'epoch_stats', payload });
  }

  growthPhase(payload: GrowthPhasePayload): void {
    this.emit({ type: 'growth_phase', payload });
  }

  templateApplication(payload: TemplateApplicationPayload): void {
    this.emit({ type: 'template_application', payload });
  }

  actionApplication(payload: ActionApplicationPayload): void {
    this.emit({ type: 'action_application', payload });
  }

  pressureUpdate(payload: PressureUpdatePayload): void {
    this.emit({ type: 'pressure_update', payload });
  }

  populationReport(payload: PopulationPayload): void {
    this.emit({ type: 'population_report', payload });
  }

  templateUsage(payload: TemplateUsagePayload): void {
    this.emit({ type: 'template_usage', payload });
  }

  coordinateStats(payload: CoordinateStatsPayload): void {
    this.emit({ type: 'coordinate_stats', payload });
  }

  tagHealth(payload: TagHealthPayload): void {
    this.emit({ type: 'tag_health', payload });
  }

  systemHealth(payload: SystemHealthPayload): void {
    this.emit({ type: 'system_health', payload });
  }

  systemAction(payload: SystemActionPayload): void {
    this.emit({ type: 'system_action', payload });
  }

  entityBreakdown(payload: EntityBreakdownPayload): void {
    this.emit({ type: 'entity_breakdown', payload });
  }

  catalystStats(payload: CatalystStatsPayload): void {
    this.emit({ type: 'catalyst_stats', payload });
  }

  relationshipBreakdown(payload: RelationshipBreakdownPayload): void {
    this.emit({ type: 'relationship_breakdown', payload });
  }

  notableEntities(payload: NotableEntitiesPayload): void {
    this.emit({ type: 'notable_entities', payload });
  }

  complete(payload: SimulationResultPayload): void {
    this.emit({ type: 'complete', payload });
  }

  stateExport(payload: StateExportPayload): void {
    this.emit({ type: 'state_export', payload });
  }

  error(payload: ErrorPayload): void {
    this.emit({ type: 'error', payload });
  }
}
