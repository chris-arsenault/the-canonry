/**
 * Pure data transformation functions for trace visualization.
 *
 * Extracted from SimulationTraceVisx to reduce per-component complexity
 * and satisfy max-lines-per-function / cognitive-complexity limits.
 */

import { EVENT_COLORS, getEntityKindColor } from "./traceConstants";
import type {
  PressureUpdate,
  EpochStat,
  TemplateApplication,
  ActionApplication,
  SystemActionRecord,
  TransformedPressureData,
  PressureDataPoint,
  TickBreakdownInfo,
  EventData,
  TemplateEventMarker,
  SystemEventMarker,
  ActionEventMarker,
  EraBoundary,
} from "./traceTypes";

// ---------------------------------------------------------------------------
// Pressure data
// ---------------------------------------------------------------------------

export function transformPressureData(
  pressureUpdates: PressureUpdate[]
): TransformedPressureData {
  if (!pressureUpdates?.length) {
    return { data: [], pressureIds: [], breakdownsByTick: new Map() };
  }

  const pressureIds = pressureUpdates[0]?.pressures?.map((p) => p.id) ?? [];
  const breakdownsByTick = new Map<number, Map<string, TickBreakdownInfo>>();

  const data: PressureDataPoint[] = pressureUpdates.map((update) => {
    const point: PressureDataPoint = { tick: update.tick, epoch: update.epoch };
    const tickBreakdowns = new Map<string, TickBreakdownInfo>();

    const discreteByPressure = new Map<string, typeof update.discreteModifications>();
    for (const mod of update.discreteModifications ?? []) {
      const existing = discreteByPressure.get(mod.pressureId);
      if (existing) {
        existing.push(mod);
      } else {
        discreteByPressure.set(mod.pressureId, [mod]);
      }
    }

    for (const p of update.pressures) {
      point[p.id] = p.newValue;
      point[`${p.id}_name`] = p.name;

      if (p.breakdown) {
        const discreteMods = discreteByPressure.get(p.id) ?? [];
        const discreteTotal = discreteMods.reduce((sum, m) => sum + m.delta, 0);

        tickBreakdowns.set(p.id, {
          id: p.id,
          name: p.name,
          value: p.newValue,
          previousValue: p.previousValue,
          delta: p.newValue - p.previousValue,
          breakdown: p.breakdown,
          discreteModifications: discreteMods,
          discreteTotal,
        });
      }
    }

    if (tickBreakdowns.size > 0) {
      breakdownsByTick.set(update.tick, tickBreakdowns);
    }

    return point;
  });

  return { data, pressureIds, breakdownsByTick };
}

// ---------------------------------------------------------------------------
// Event data - templates
// ---------------------------------------------------------------------------

function groupByTick<T extends { tick: number }>(items: T[]): Map<number, T[]> {
  const byTick = new Map<number, T[]>();
  for (const item of items) {
    const existing = byTick.get(item.tick);
    if (existing) {
      existing.push(item);
    } else {
      byTick.set(item.tick, [item]);
    }
  }
  return byTick;
}

function buildTemplateMarkers(
  templateApplications: TemplateApplication[]
): TemplateEventMarker[] {
  if (!templateApplications?.length) return [];

  const markers: TemplateEventMarker[] = [];
  const byTick = groupByTick(templateApplications);

  for (const [tick, apps] of byTick) {
    apps.forEach((app, stackIndex) => {
      const firstEntityKind = app.entitiesCreated?.[0]?.kind ?? null;
      markers.push({
        tick,
        uniqueId: `template-${tick}-${app.templateId}-${stackIndex}`,
        templateId: app.templateId,
        data: app,
        stackIndex,
        totalAtTick: apps.length,
        entityKind: firstEntityKind,
        color: getEntityKindColor(firstEntityKind),
      });
    });
  }
  return markers;
}

// ---------------------------------------------------------------------------
// Event data - system actions
// ---------------------------------------------------------------------------

function buildSystemMarkers(
  systemActions: SystemActionRecord[]
): SystemEventMarker[] {
  if (!systemActions?.length) return [];

  const filtered = systemActions.filter(
    (a) => a.systemId !== "framework-growth" && a.systemId !== "universal-catalyst"
  );

  const markers: SystemEventMarker[] = [];
  const byTick = groupByTick(filtered);

  for (const [tick, actions] of byTick) {
    actions.forEach((action, stackIndex) => {
      const isEraTransition = !!action.details?.eraTransition;
      markers.push({
        tick,
        uniqueId: `system-${tick}-${action.systemId}-${stackIndex}`,
        systemId: action.systemId,
        systemName: action.systemName,
        data: action,
        stackIndex,
        totalAtTick: actions.length,
        isEraTransition,
        color: isEraTransition ? "#f59e0b" : EVENT_COLORS.system,
      });
    });
  }
  return markers;
}

// ---------------------------------------------------------------------------
// Event data - action applications
// ---------------------------------------------------------------------------

function buildActionMarkers(
  actionApplications: ActionApplication[]
): ActionEventMarker[] {
  if (!actionApplications?.length) return [];

  const successful = actionApplications.filter(
    (app) => app.outcome?.status === "success"
  );

  const markers: ActionEventMarker[] = [];
  const byTick = groupByTick(successful);

  for (const [tick, apps] of byTick) {
    apps.forEach((app, stackIndex) => {
      const color = app.outcome.status === "success" ? "#22c55e" : "#ef4444";
      markers.push({
        tick,
        uniqueId: `action-${tick}-${app.actionId}-${app.actorId}`,
        actionId: app.actionId,
        actionName: app.actionName,
        data: app,
        stackIndex,
        totalAtTick: apps.length,
        color,
      });
    });
  }
  return markers;
}

// ---------------------------------------------------------------------------
// Combined event data entry point
// ---------------------------------------------------------------------------

export function transformEventData(
  templateApplications: TemplateApplication[],
  actionApplications: ActionApplication[],
  systemActions: SystemActionRecord[]
): EventData {
  return {
    template: buildTemplateMarkers(templateApplications),
    system: buildSystemMarkers(systemActions),
    action: buildActionMarkers(actionApplications),
  };
}

// ---------------------------------------------------------------------------
// Era boundaries
// ---------------------------------------------------------------------------

function formatEpochEraLabel(
  era: EpochStat["era"],
  fallback: string
): string {
  if (!era) return fallback;
  const startName = era.start?.name;
  const endName = era.end?.name ?? startName;
  if (!startName) return fallback;
  if (!era.transitions || era.transitions.length === 0 || startName === endName) {
    return endName ?? fallback;
  }
  return `${startName} \u2192 ${endName}`;
}

function extractFromTransitions(
  eraTransitions: SystemActionRecord[],
  minTick: number,
  maxTick: number
): EraBoundary[] {
  const boundaries: EraBoundary[] = [];

  const firstTransition = eraTransitions[0];
  const transition0 = firstTransition.details?.eraTransition;
  if (transition0) {
    boundaries.push({
      era: transition0.fromEra,
      eraId: transition0.fromEraId,
      epoch: firstTransition.epoch,
      startTick: minTick,
      endTick: firstTransition.tick,
    });
  }

  for (let i = 0; i < eraTransitions.length; i++) {
    const t = eraTransitions[i];
    const detail = t.details?.eraTransition;
    if (!detail) continue;

    const nextTransition = eraTransitions[i + 1];
    boundaries.push({
      era: detail.toEra,
      eraId: detail.toEraId,
      epoch: t.epoch,
      startTick: t.tick,
      endTick: nextTransition?.tick ?? maxTick,
    });
  }

  return boundaries;
}

function extractFromEpochs(
  pressureUpdates: PressureUpdate[],
  epochStats: EpochStat[],
  maxTick: number
): EraBoundary[] {
  const boundaries: EraBoundary[] = [];
  let currentEpoch = -1;
  let currentEra: string | null = null;
  let startTick = 0;

  for (const update of pressureUpdates) {
    if (update.epoch !== currentEpoch) {
      if (currentEra !== null) {
        boundaries.push({ era: currentEra, epoch: currentEpoch, startTick, endTick: update.tick });
      }
      currentEpoch = update.epoch;
      const epochStat = epochStats?.find((e) => e.epoch === currentEpoch);
      currentEra = formatEpochEraLabel(epochStat?.era, `Epoch ${currentEpoch}`);
      startTick = update.tick;
    }
  }

  if (currentEra !== null) {
    boundaries.push({ era: currentEra, epoch: currentEpoch, startTick, endTick: maxTick });
  }

  return boundaries;
}

export function extractEraBoundaries(
  pressureUpdates: PressureUpdate[],
  epochStats: EpochStat[],
  systemActions: SystemActionRecord[]
): EraBoundary[] {
  if (!pressureUpdates?.length) return [];

  const minTick = pressureUpdates[0].tick;
  const maxTick = pressureUpdates[pressureUpdates.length - 1].tick;

  const eraTransitions = (systemActions ?? [])
    .filter((a) => a.details?.eraTransition)
    .sort((a, b) => a.tick - b.tick);

  if (eraTransitions.length > 0) {
    return extractFromTransitions(eraTransitions, minTick, maxTick);
  }

  return extractFromEpochs(pressureUpdates, epochStats, maxTick);
}
