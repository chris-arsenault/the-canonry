/**
 * SimulationDashboard - Real-time visualization of simulation progress
 */

import React, { useMemo } from 'react';
import ProgressOverview from './ProgressOverview';
import EpochTimeline from './EpochTimeline';
import PopulationMetrics from './PopulationMetrics';
import TemplateUsage from './TemplateUsage';
import FinalDiagnostics from './FinalDiagnostics';
import LogStream from './LogStream';

/**
 * Aggregate all pressure updates for the current epoch into a single summary.
 * This combines per-tick feedback contributions, discrete modifications, etc.
 */
function aggregatePressureUpdates(pressureUpdates, currentEpochNumber) {
  if (!pressureUpdates?.length) return null;

  // Filter updates for the current epoch
  const epochUpdates = pressureUpdates.filter(u => u.epoch === currentEpochNumber);
  if (epochUpdates.length === 0) return null;

  // Sort by tick to ensure proper ordering
  epochUpdates.sort((a, b) => a.tick - b.tick);

  const firstUpdate = epochUpdates[0];
  const lastUpdate = epochUpdates[epochUpdates.length - 1];

  // Build aggregated pressure details
  const aggregatedPressures = [];
  const pressureMap = new Map();

  // Initialize with first tick's data
  for (const p of firstUpdate.pressures) {
    pressureMap.set(p.id, {
      id: p.id,
      name: p.name,
      epochStartValue: p.previousValue,
      epochEndValue: p.newValue,
      // Aggregate breakdowns
      totalFeedback: 0,
      positiveFeedbackSum: new Map(), // label -> cumulative contribution
      negativeFeedbackSum: new Map(), // label -> cumulative contribution
      totalScaledFeedback: 0,
      totalHomeostaticDelta: 0,
      totalRawDelta: 0,
      totalSmoothedDelta: 0,
      homeostasis: p.breakdown.homeostasis,
      tickCount: 0
    });
  }

  // Aggregate across all ticks
  for (const update of epochUpdates) {
    for (const p of update.pressures) {
      const agg = pressureMap.get(p.id);
      if (!agg) continue;

      // Update end value to latest
      agg.epochEndValue = p.newValue;
      agg.tickCount++;

      // Sum breakdown values
      agg.totalFeedback += p.breakdown.feedbackTotal;
      agg.totalScaledFeedback += p.breakdown.scaledFeedback;
      agg.totalHomeostaticDelta += p.breakdown.homeostaticDelta;
      agg.totalRawDelta += p.breakdown.rawDelta;
      agg.totalSmoothedDelta += p.breakdown.smoothedDelta;
      agg.homeostasis = p.breakdown.homeostasis;

      // Aggregate positive feedback by label
      for (const f of p.breakdown.positiveFeedback) {
        const current = agg.positiveFeedbackSum.get(f.label) || {
          label: f.label,
          type: f.type,
          totalRawValue: 0,
          coefficient: f.coefficient,
          totalContribution: 0,
          ticksSeen: 0
        };
        current.totalRawValue += f.rawValue;
        current.totalContribution += f.contribution;
        current.ticksSeen++;
        agg.positiveFeedbackSum.set(f.label, current);
      }

      // Aggregate negative feedback by label
      for (const f of p.breakdown.negativeFeedback) {
        const current = agg.negativeFeedbackSum.get(f.label) || {
          label: f.label,
          type: f.type,
          totalRawValue: 0,
          coefficient: f.coefficient,
          totalContribution: 0,
          ticksSeen: 0
        };
        current.totalRawValue += f.rawValue;
        current.totalContribution += f.contribution;
        current.ticksSeen++;
        agg.negativeFeedbackSum.set(f.label, current);
      }
    }
  }

  // Convert to array format for display
  for (const [id, agg] of pressureMap) {
    aggregatedPressures.push({
      id: agg.id,
      name: agg.name,
      previousValue: agg.epochStartValue,
      newValue: agg.epochEndValue,
      delta: agg.epochEndValue - agg.epochStartValue,
      tickCount: agg.tickCount,
      breakdown: {
        positiveFeedback: Array.from(agg.positiveFeedbackSum.values()).map(f => ({
          label: f.label,
          type: f.type,
          rawValue: f.totalRawValue / f.ticksSeen, // Average raw value
          coefficient: f.coefficient,
          contribution: f.totalContribution // Total contribution across epoch
        })),
        negativeFeedback: Array.from(agg.negativeFeedbackSum.values()).map(f => ({
          label: f.label,
          type: f.type,
          rawValue: f.totalRawValue / f.ticksSeen, // Average raw value
          coefficient: f.coefficient,
          contribution: f.totalContribution // Total contribution across epoch
        })),
        feedbackTotal: agg.totalFeedback,
        growthScaling: lastUpdate.pressures.find(p => p.id === id)?.breakdown.growthScaling ?? 1,
        scaledFeedback: agg.totalScaledFeedback,
        homeostasis: agg.homeostasis,
        homeostaticDelta: agg.totalHomeostaticDelta,
        eraModifier: lastUpdate.pressures.find(p => p.id === id)?.breakdown.eraModifier ?? 1,
        rawDelta: agg.totalRawDelta,
        smoothedDelta: agg.totalSmoothedDelta
      }
    });
  }

  // Aggregate all discrete modifications from all ticks in this epoch
  const allDiscreteMods = [];
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
    discreteModifications: allDiscreteMods
  };
}

export default function SimulationDashboard({ simState, onClearLogs }) {
  const {
    status,
    progress,
    currentEpoch,
    epochStats,
    templateApplications,
    pressureUpdates,
    systemActions,
    populationReport,
    templateUsage,
    systemHealth,
    entityBreakdown,
    catalystStats,
    relationshipBreakdown,
    notableEntities,
    result,
    logs
  } = simState;

  // Extract pressures from latest epoch stats
  const pressures = epochStats.length > 0 ? epochStats[epochStats.length - 1].pressures : null;

  // Get the current epoch number
  const currentEpochNumber = currentEpoch?.epoch ?? (epochStats.length > 0 ? epochStats[epochStats.length - 1].epoch : 0);

  // Aggregate all pressure updates for the current epoch
  const aggregatedPressureUpdate = useMemo(
    () => aggregatePressureUpdates(pressureUpdates, currentEpochNumber),
    [pressureUpdates, currentEpochNumber]
  );

  const reachability = result?.metadata?.reachability;

  // Show final diagnostics when simulation is complete or we have diagnostic data
  const showFinalDiagnostics = status === 'complete' ||
    entityBreakdown || catalystStats || relationshipBreakdown || notableEntities;

  return (
    <div className="lw-dashboard">
      {/* Overview Bar */}
      <ProgressOverview progress={progress} status={status} />

      {/* Main Content Grid */}
      <div className="lw-main-content">
        {/* Left Panel */}
        <EpochTimeline
          epochStats={epochStats}
          currentEpoch={currentEpoch}
          pressures={pressures}
          pressureDetails={aggregatedPressureUpdate}
          reachability={reachability}
        />

        {/* Right Panel - stacked */}
        <div className="lw-flex-col lw-gap-lg">
          <PopulationMetrics
            populationReport={populationReport}
            epochStats={epochStats}
          />
          <TemplateUsage
            templateUsage={templateUsage}
            systemHealth={systemHealth}
          />
        </div>
      </div>

      {/* Final Diagnostics (shown after completion) */}
      {showFinalDiagnostics && (
        <FinalDiagnostics
          entityBreakdown={entityBreakdown}
          catalystStats={catalystStats}
          relationshipBreakdown={relationshipBreakdown}
          notableEntities={notableEntities}
        />
      )}

      {/* Log Stream */}
      <LogStream logs={logs} onClear={onClearLogs} />
    </div>
  );
}
