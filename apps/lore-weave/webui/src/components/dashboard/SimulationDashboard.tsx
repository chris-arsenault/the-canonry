/**
 * SimulationDashboard - Real-time visualization of simulation progress
 */

import React, { useMemo } from "react";
import type { SimulationState } from "../../hooks/useSimulationWorker";
import type { PressureUpdatePayload } from "../../../../lib/observer/types";
import ProgressOverview from "./ProgressOverview";
import EpochTimeline from "./EpochTimeline";
import PopulationMetrics from "./PopulationMetrics";
import TemplateUsage from "./TemplateUsage";
import FinalDiagnostics from "./FinalDiagnostics";
import LogStream from "./LogStream";

interface FeedbackItem {
  label: string;
  type: string;
  rawValue: number;
  coefficient: number;
  contribution: number;
}

interface FeedbackSum {
  label: string;
  type: string;
  totalRawValue: number;
  coefficient: number;
  totalContribution: number;
  ticksSeen: number;
}

/**
 * Accumulate feedback items from one tick into the running feedback sum map.
 */
function aggregateFeedbackByLabel(feedbackSum: Map<string, FeedbackSum>, feedbackItems: FeedbackItem[]) {
  for (const f of feedbackItems) {
    const current = feedbackSum.get(f.label) || {
      label: f.label,
      type: f.type,
      totalRawValue: 0,
      coefficient: f.coefficient,
      totalContribution: 0,
      ticksSeen: 0,
    };
    current.totalRawValue += f.rawValue;
    current.totalContribution += f.contribution;
    current.ticksSeen++;
    feedbackSum.set(f.label, current);
  }
}

interface PressureBreakdownFull {
  positiveFeedback: FeedbackItem[];
  negativeFeedback: FeedbackItem[];
  feedbackTotal: number;
  growthScaling: number;
  scaledFeedback: number;
  homeostasis: number;
  homeostaticDelta: number;
  eraModifier: number;
  rawDelta: number;
  smoothedDelta: number;
}

interface PressureEntryFull {
  id: string;
  name: string;
  newValue: number;
  previousValue: number;
  breakdown: PressureBreakdownFull;
}

interface PressureUpdateFull {
  tick: number;
  epoch: number;
  pressures: PressureEntryFull[];
  discreteModifications: Array<{ pressureId: string; delta: number; source: Record<string, string> }>;
}

/**
 * Aggregate all pressure updates for the current epoch into a single summary.
 */
function aggregatePressureUpdates(pressureUpdates: PressureUpdatePayload[], currentEpochNumber: number) {
  if (!pressureUpdates.length) return null;

  const epochUpdates = (pressureUpdates as unknown as PressureUpdateFull[]).filter((u) => u.epoch === currentEpochNumber);
  if (epochUpdates.length === 0) return null;

  epochUpdates.sort((a, b) => a.tick - b.tick);

  const firstUpdate = epochUpdates[0];
  const lastUpdate = epochUpdates[epochUpdates.length - 1];

  const aggregatedPressures: Array<Record<string, unknown>> = [];
  const pressureMap = new Map<string, Record<string, unknown>>();

  for (const p of firstUpdate.pressures) {
    pressureMap.set(p.id, {
      id: p.id,
      name: p.name,
      epochStartValue: p.previousValue,
      epochEndValue: p.newValue,
      totalFeedback: 0,
      positiveFeedbackSum: new Map<string, FeedbackSum>(),
      negativeFeedbackSum: new Map<string, FeedbackSum>(),
      totalScaledFeedback: 0,
      totalHomeostaticDelta: 0,
      totalRawDelta: 0,
      totalSmoothedDelta: 0,
      homeostasis: p.breakdown.homeostasis,
      tickCount: 0,
    });
  }

  for (const update of epochUpdates) {
    for (const p of update.pressures) {
      const agg = pressureMap.get(p.id);
      if (!agg) continue;

      agg.epochEndValue = p.newValue;
      (agg.tickCount as number)++;

      agg.totalFeedback = (agg.totalFeedback as number) + p.breakdown.feedbackTotal;
      agg.totalScaledFeedback = (agg.totalScaledFeedback as number) + p.breakdown.scaledFeedback;
      agg.totalHomeostaticDelta = (agg.totalHomeostaticDelta as number) + p.breakdown.homeostaticDelta;
      agg.totalRawDelta = (agg.totalRawDelta as number) + p.breakdown.rawDelta;
      agg.totalSmoothedDelta = (agg.totalSmoothedDelta as number) + p.breakdown.smoothedDelta;
      agg.homeostasis = p.breakdown.homeostasis;

      aggregateFeedbackByLabel(agg.positiveFeedbackSum as Map<string, FeedbackSum>, p.breakdown.positiveFeedback);
      aggregateFeedbackByLabel(agg.negativeFeedbackSum as Map<string, FeedbackSum>, p.breakdown.negativeFeedback);
    }
  }

  for (const [id, agg] of pressureMap) {
    aggregatedPressures.push({
      id: agg.id,
      name: agg.name,
      previousValue: agg.epochStartValue,
      newValue: agg.epochEndValue,
      delta: (agg.epochEndValue as number) - (agg.epochStartValue as number),
      tickCount: agg.tickCount,
      breakdown: {
        positiveFeedback: Array.from((agg.positiveFeedbackSum as Map<string, FeedbackSum>).values()).map((f) => ({
          label: f.label, type: f.type, rawValue: f.totalRawValue / f.ticksSeen, coefficient: f.coefficient, contribution: f.totalContribution,
        })),
        negativeFeedback: Array.from((agg.negativeFeedbackSum as Map<string, FeedbackSum>).values()).map((f) => ({
          label: f.label, type: f.type, rawValue: f.totalRawValue / f.ticksSeen, coefficient: f.coefficient, contribution: f.totalContribution,
        })),
        feedbackTotal: agg.totalFeedback,
        growthScaling: lastUpdate.pressures.find((p) => p.id === id)?.breakdown.growthScaling ?? 1,
        scaledFeedback: agg.totalScaledFeedback,
        homeostasis: agg.homeostasis,
        homeostaticDelta: agg.totalHomeostaticDelta,
        eraModifier: lastUpdate.pressures.find((p) => p.id === id)?.breakdown.eraModifier ?? 1,
        rawDelta: agg.totalRawDelta,
        smoothedDelta: agg.totalSmoothedDelta,
      },
    });
  }

  const allDiscreteMods: Array<Record<string, unknown>> = [];
  for (const update of epochUpdates) {
    if (update.discreteModifications) {
      allDiscreteMods.push(...update.discreteModifications);
    }
  }

  return {
    tick: lastUpdate.tick,
    epoch: currentEpochNumber,
    ticksAggregated: epochUpdates.length,
    pressures: aggregatedPressures,
    discreteModifications: allDiscreteMods,
  };
}

interface SimulationDashboardProps {
  simState: SimulationState;
  onClearLogs: () => void;
}

export default function SimulationDashboard({ simState, onClearLogs }: Readonly<SimulationDashboardProps>) {
  const {
    status,
    progress,
    currentEpoch,
    epochStats,
    pressureUpdates,
    populationReport,
    templateUsage,
    systemHealth,
    entityBreakdown,
    catalystStats,
    relationshipBreakdown,
    notableEntities,
    result,
    logs,
  } = simState;

  const pressures = epochStats.length > 0 ? epochStats[epochStats.length - 1].pressures : null;

  const currentEpochNumber =
    currentEpoch?.epoch ?? (epochStats.length > 0 ? epochStats[epochStats.length - 1].epoch : 0);

  const aggregatedPressureUpdate = useMemo(
    () => aggregatePressureUpdates(pressureUpdates, currentEpochNumber),
    [pressureUpdates, currentEpochNumber]
  );

  const reachability = (result?.metadata as Record<string, unknown>)?.reachability as Record<string, unknown> | undefined;

  const showFinalDiagnostics =
    status === "complete" ||
    entityBreakdown ||
    catalystStats ||
    relationshipBreakdown ||
    notableEntities;

  return (
    <div className="lw-dashboard">
      <ProgressOverview progress={progress} status={status} />

      <div className="lw-main-content">
        <EpochTimeline
          epochStats={epochStats}
          currentEpoch={currentEpoch}
          pressures={pressures}
          pressureDetails={aggregatedPressureUpdate}
          reachability={reachability}
        />

        <div className="lw-flex-col lw-gap-lg">
          <PopulationMetrics populationReport={populationReport} epochStats={epochStats as Array<{ entitiesByKind: Record<string, number> }>} />
          <TemplateUsage templateUsage={templateUsage as Parameters<typeof TemplateUsage>[0]['templateUsage']} systemHealth={systemHealth as Parameters<typeof TemplateUsage>[0]['systemHealth']} />
        </div>
      </div>

      {showFinalDiagnostics && (
        <FinalDiagnostics
          entityBreakdown={entityBreakdown as Parameters<typeof FinalDiagnostics>[0]['entityBreakdown']}
          catalystStats={catalystStats as Parameters<typeof FinalDiagnostics>[0]['catalystStats']}
          relationshipBreakdown={relationshipBreakdown as Parameters<typeof FinalDiagnostics>[0]['relationshipBreakdown']}
          notableEntities={notableEntities as Parameters<typeof FinalDiagnostics>[0]['notableEntities']}
        />
      )}

      <LogStream logs={logs} onClear={onClearLogs} />
    </div>
  );
}
