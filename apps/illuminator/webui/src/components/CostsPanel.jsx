/**
 * CostsPanel - Cost tracking and breakdown view
 *
 * Shows:
 * - Running totals by type (text, image, chronicle)
 * - Breakdown by model
 * - Simulation costs, project costs, all-time costs (from IndexedDB)
 *
 * Costs are tracked independently in IndexedDB and never deleted when
 * entities/chronicles are regenerated.
 */

import { useMemo, useEffect, useState, useCallback } from 'react';
import { formatCost } from '../lib/costEstimation';
import {
  getCostsForSimulation,
  getCostsForProject,
  getAllCosts,
  summarizeCosts,
  clearAllCosts,
} from '../lib/db/costRepository';

function CostCard({ title, children }) {
  return (
    <div className="illuminator-card">
      <div className="illuminator-card-header">
        <h2 className="illuminator-card-title">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function CostRow({ label, value, isTotal, isEstimated }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: '1px solid var(--border-color)',
        fontWeight: isTotal ? 600 : 400,
      }}
    >
      <span>{label}</span>
      <span style={{ fontFamily: 'monospace' }}>
        {isEstimated && '~'}
        {formatCost(value)}
      </span>
    </div>
  );
}

// Group cost types into categories
function categorizeCosts(summary) {
  const text = {
    actual: 0,
    count: 0,
  };
  const image = {
    actual: 0,
    count: 0,
  };
  const chronicle = {
    actual: 0,
    count: 0,
  };
  const dynamics = {
    actual: 0,
    count: 0,
  };
  const revision = {
    actual: 0,
    count: 0,
  };

  const textTypes = ['description'];
  const imageTypes = ['image', 'imagePrompt'];
  const chronicleTypes = [
    'chronicleValidation',
    'chronicleRevision',
    'chronicleSummary',
    'chronicleImageRefs',
    'chronicleV2',
  ];
  const dynamicsTypes = ['dynamicsGeneration'];
  const revisionTypes = ['summaryRevision'];

  for (const [type, data] of Object.entries(summary.byType)) {
    if (textTypes.includes(type)) {
      text.actual += data.actual;
      text.count += data.count;
    } else if (imageTypes.includes(type)) {
      image.actual += data.actual;
      image.count += data.count;
    } else if (chronicleTypes.includes(type)) {
      chronicle.actual += data.actual;
      chronicle.count += data.count;
    } else if (dynamicsTypes.includes(type)) {
      dynamics.actual += data.actual;
      dynamics.count += data.count;
    } else if (revisionTypes.includes(type)) {
      revision.actual += data.actual;
      revision.count += data.count;
    }
  }

  return { text, image, chronicle, dynamics, revision };
}

export default function CostsPanel({ queue, projectId, simulationRunId }) {
  // Cost data from IndexedDB
  const [simulationCosts, setSimulationCosts] = useState(null);
  const [projectCosts, setProjectCosts] = useState(null);
  const [allTimeCosts, setAllTimeCosts] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Track running tasks to know when to refresh
  const runningTaskCount = useMemo(() => {
    return queue.filter(
      (item) => item.status === 'queued' || item.status === 'running'
    ).length;
  }, [queue]);

  // Fetch costs from IndexedDB
  const fetchCosts = useCallback(async () => {
    try {
      // All-time costs
      const allRecords = await getAllCosts();
      setAllTimeCosts(summarizeCosts(allRecords));

      // Project costs
      if (projectId) {
        const projectRecords = await getCostsForProject(projectId);
        setProjectCosts(summarizeCosts(projectRecords));
      } else {
        setProjectCosts(null);
      }

      // Simulation costs
      if (simulationRunId) {
        const simRecords = await getCostsForSimulation(simulationRunId);
        setSimulationCosts(summarizeCosts(simRecords));
      } else {
        setSimulationCosts(null);
      }
    } catch (err) {
      console.error('[CostsPanel] Failed to fetch costs:', err);
    }
  }, [projectId, simulationRunId]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchCosts();
  }, [fetchCosts, refreshTrigger]);

  // Refresh when queue changes (tasks complete)
  useEffect(() => {
    // Only refresh when queue length decreases (task completed)
    const timer = setTimeout(() => {
      setRefreshTrigger((prev) => prev + 1);
    }, 500);
    return () => clearTimeout(timer);
  }, [queue.length, runningTaskCount]);

  // Calculate pending queue costs (estimated)
  const queueCosts = useMemo(() => {
    let textEstimated = 0;
    let imageEstimated = 0;
    let chronicleEstimated = 0;

    for (const item of queue) {
      if (item.status === 'complete') continue;
      if (item.estimatedCost) {
        if (item.type === 'image') {
          imageEstimated += item.estimatedCost;
        } else if (item.type === 'entityChronicle') {
          chronicleEstimated += item.estimatedCost;
        } else {
          textEstimated += item.estimatedCost;
        }
      } else if (item.type === 'entityChronicle' && item.status !== 'complete') {
        // Estimate chronicle cost if not available (~$0.05-0.15 per chronicle depending on length)
        chronicleEstimated += 0.08;
      }
    }

    return {
      textEstimated,
      imageEstimated,
      chronicleEstimated,
      total: textEstimated + imageEstimated + chronicleEstimated,
    };
  }, [queue]);

  // Categorize costs for display
  const simCategorized = simulationCosts ? categorizeCosts(simulationCosts) : null;
  const projCategorized = projectCosts ? categorizeCosts(projectCosts) : null;
  const allCategorized = allTimeCosts ? categorizeCosts(allTimeCosts) : null;

  const handleClearHistory = async () => {
    if (confirm('Clear all cost history? This cannot be undone.')) {
      await clearAllCosts();
      setRefreshTrigger((prev) => prev + 1);
    }
  };

  return (
    <div>
      {/* Current Simulation */}
      {simCategorized && (
        <CostCard title="Current Simulation">
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Costs from this simulation run.
          </div>
          <CostRow label="Text generations" value={simCategorized.text.actual} />
          <CostRow
            label={`  \u2514 ${simCategorized.text.count} requests`}
            value={simCategorized.text.actual}
          />
          <CostRow label="Image generations" value={simCategorized.image.actual} />
          <CostRow
            label={`  \u2514 ${simCategorized.image.count} images`}
            value={simCategorized.image.actual}
          />
          <CostRow label="Chronicle generations" value={simCategorized.chronicle.actual} />
          <CostRow
            label={`  \u2514 ${simCategorized.chronicle.count} steps`}
            value={simCategorized.chronicle.actual}
          />
          <CostRow label="Dynamics generation" value={simCategorized.dynamics.actual} />
          <CostRow
            label={`  \u2514 ${simCategorized.dynamics.count} turns`}
            value={simCategorized.dynamics.actual}
          />
          <CostRow label="Summary revision" value={simCategorized.revision.actual} />
          <CostRow
            label={`  \u2514 ${simCategorized.revision.count} batches`}
            value={simCategorized.revision.actual}
          />
          <CostRow
            label="Simulation Total"
            value={simulationCosts.totalActual}
            isTotal
          />
        </CostCard>
      )}

      {/* Pending Queue */}
      {queueCosts.total > 0 && (
        <CostCard title="Pending Queue (Estimated)">
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Estimated costs for queued tasks not yet completed.
          </div>
          <CostRow label="Text generations" value={queueCosts.textEstimated} isEstimated />
          <CostRow label="Image generations" value={queueCosts.imageEstimated} isEstimated />
          <CostRow label="Chronicle generations" value={queueCosts.chronicleEstimated} isEstimated />
          <CostRow label="Queue Total" value={queueCosts.total} isTotal isEstimated />
        </CostCard>
      )}

      {/* By Model */}
      {simulationCosts && Object.keys(simulationCosts.byModel).length > 0 && (
        <CostCard title="By Model (Simulation)">
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Cost breakdown by model used.
          </div>
          {Object.entries(simulationCosts.byModel)
            .sort((a, b) => b[1].actual - a[1].actual)
            .map(([model, data]) => (
              <CostRow key={model} label={model} value={data.actual} />
            ))}
        </CostCard>
      )}

      {/* Project Total */}
      {projCategorized && (
        <CostCard title="Project Total">
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Accumulated costs for this project across all simulations.
          </div>
          <CostRow label="Text generations" value={projCategorized.text.actual} />
          <CostRow label="Image generations" value={projCategorized.image.actual} />
          <CostRow label="Chronicle generations" value={projCategorized.chronicle.actual} />
          <CostRow
            label="Project Total"
            value={projectCosts.totalActual}
            isTotal
          />
        </CostCard>
      )}

      {/* All Time */}
      {allCategorized && (
        <CostCard title="All Time Total">
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Accumulated costs across all projects and sessions.
          </div>
          <CostRow label="Text generations" value={allCategorized.text.actual} />
          <CostRow label="Image generations" value={allCategorized.image.actual} />
          <CostRow label="Chronicle generations" value={allCategorized.chronicle.actual} />
          <CostRow
            label="All Time Total"
            value={allTimeCosts.totalActual}
            isTotal
          />
          <CostRow
            label={`  \u2514 ${allTimeCosts.count} total records`}
            value={allTimeCosts.totalActual}
          />

          <button
            onClick={handleClearHistory}
            className="illuminator-button-link"
            style={{ marginTop: '12px', fontSize: '11px' }}
          >
            Clear History
          </button>
        </CostCard>
      )}

      {/* Empty state */}
      {!simulationCosts && !allTimeCosts && queueCosts.total === 0 && (
        <CostCard title="Cost Tracking">
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '12px 0' }}>
            No costs recorded yet. Costs will appear here as you generate content.
          </div>
        </CostCard>
      )}
    </div>
  );
}
