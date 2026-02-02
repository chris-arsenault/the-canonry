/**
 * SystemActivityPanel - Visualization of system activity during simulation
 *
 * Shows system executions over time using systemActions data:
 * - Timeline of when systems ran
 * - Aggregate metrics (relationships added, entities modified)
 * - System-specific details
 */

import React, { useMemo, useState } from 'react';
import { Group } from '@visx/group';
import { scaleLinear, scaleOrdinal, scaleBand } from '@visx/scale';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { Bar, Line, LinePath, Circle } from '@visx/shape';
import { GridRows } from '@visx/grid';
import { ParentSize } from '@visx/responsive';
import './SystemActivityPanel.css';

const MARGIN = { top: 20, right: 20, bottom: 40, left: 120 };

// System type colors
const SYSTEM_COLORS = {
  'plane-diffusion': '#f59e0b',
  'graph-contagion': '#8b5cf6',
  'cluster-formation': '#22c55e',
  'connection-evolution': '#3b82f6',
  'tag-diffusion': '#ec4899',
  'threshold-trigger': '#14b8a6',
  'framework-era-manager': '#ef4444',
  'default': '#64748b',
};

const AXIS_LABEL_PROPS = Object.freeze({
  fill: '#64748b',
  fontSize: 11,
});

function getSystemColor(systemId) {
  for (const [key, color] of Object.entries(SYSTEM_COLORS)) {
    if (systemId.includes(key)) return color;
  }
  return SYSTEM_COLORS.default;
}

/**
 * Process system actions into visualization-ready data
 */
function processSystemActions(systemActions) {
  if (!systemActions?.length) return { systems: [], timeline: [], maxTick: 0 };

  // Group by system
  const systemMap = new Map();
  let maxTick = 0;

  for (const action of systemActions) {
    // Skip framework-growth (shown via templates)
    if (action.systemId === 'framework-growth') continue;

    maxTick = Math.max(maxTick, action.tick);

    if (!systemMap.has(action.systemId)) {
      systemMap.set(action.systemId, {
        id: action.systemId,
        name: action.systemName,
        executions: [],
        totalRelationships: 0,
        totalModified: 0,
      });
    }

    const sys = systemMap.get(action.systemId);
    sys.executions.push({
      tick: action.tick,
      epoch: action.epoch,
      relationshipsAdded: action.relationshipsAdded || 0,
      entitiesModified: action.entitiesModified || 0,
      description: action.description,
      isEraTransition: !!action.details?.eraTransition,
    });
    sys.totalRelationships += action.relationshipsAdded || 0;
    sys.totalModified += action.entitiesModified || 0;
  }

  // Convert to array and sort by total activity
  const systems = Array.from(systemMap.values())
    .sort((a, b) => (b.totalRelationships + b.totalModified) - (a.totalRelationships + a.totalModified));

  // Build timeline data (aggregated per tick)
  const timelineMap = new Map();
  for (const action of systemActions) {
    if (action.systemId === 'framework-growth') continue;

    if (!timelineMap.has(action.tick)) {
      timelineMap.set(action.tick, { tick: action.tick, relationships: 0, modified: 0 });
    }
    const t = timelineMap.get(action.tick);
    t.relationships += action.relationshipsAdded || 0;
    t.modified += action.entitiesModified || 0;
  }
  const timeline = Array.from(timelineMap.values()).sort((a, b) => a.tick - b.tick);

  return { systems, timeline, maxTick };
}

/**
 * Swimlane chart showing when each system executed
 */
function SystemSwimlaneChart({ systems, maxTick, width, height }) {
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const xScale = scaleLinear({
    domain: [0, maxTick],
    range: [0, innerWidth],
  });

  const yScale = scaleBand({
    domain: systems.map(s => s.id),
    range: [0, innerHeight],
    padding: 0.3,
  });

  return (
    <svg width={width} height={height}>
      <Group left={MARGIN.left} top={MARGIN.top}>
        {/* Grid */}
        <GridRows
          scale={yScale}
          width={innerWidth}
          stroke="rgba(255,255,255,0.05)"
        />

        {/* System lanes */}
        {systems.map((sys) => {
          const y = yScale(sys.id);
          const laneHeight = yScale.bandwidth();
          const color = getSystemColor(sys.id);

          return (
            <g key={sys.id}>
              {/* Lane background */}
              <rect
                x={0}
                y={y}
                width={innerWidth}
                height={laneHeight}
                fill="rgba(255,255,255,0.02)"
              />

              {/* Execution markers */}
              {sys.executions.map((exec, i) => {
                const cx = xScale(exec.tick);
                const cy = y + laneHeight / 2;
                const hasActivity = exec.relationshipsAdded > 0 || exec.entitiesModified > 0;
                const size = hasActivity ? 6 : 3;

                return (
                  <Circle
                    key={i}
                    cx={cx}
                    cy={cy}
                    r={size}
                    fill={color}
                    fillOpacity={hasActivity ? 0.8 : 0.3}
                    stroke={exec.isEraTransition ? '#f59e0b' : 'none'}
                    strokeWidth={exec.isEraTransition ? 2 : 0}
                  />
                );
              })}
            </g>
          );
        })}

        {/* Y Axis - System names */}
        <AxisLeft
          scale={yScale}
          stroke="rgba(148, 163, 184, 0.3)"
          tickStroke="transparent"
          tickLabelProps={() => ({
            fill: '#94a3b8',
            fontSize: 11,
            textAnchor: 'end',
            dy: '0.33em',
          })}
          tickFormat={(id) => {
            const sys = systems.find(s => s.id === id);
            return sys?.name || id;
          }}
        />

        {/* X Axis */}
        <AxisBottom
          scale={xScale}
          top={innerHeight}
          stroke="rgba(148, 163, 184, 0.3)"
          tickStroke="rgba(148, 163, 184, 0.3)"
          tickLabelProps={() => ({
            fill: '#64748b',
            fontSize: 10,
            textAnchor: 'middle',
          })}
          label="Tick"
          labelOffset={25}
          labelProps={AXIS_LABEL_PROPS}
        />
      </Group>
    </svg>
  );
}

/**
 * Activity timeline chart
 */
function ActivityTimelineChart({ timeline, maxTick, width, height }) {
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const maxValue = Math.max(
    ...timeline.map(t => Math.max(t.relationships, t.modified)),
    1
  );

  const xScale = scaleLinear({
    domain: [0, maxTick],
    range: [0, innerWidth],
  });

  const yScale = scaleLinear({
    domain: [0, maxValue],
    range: [innerHeight, 0],
  });

  return (
    <svg width={width} height={height}>
      <Group left={MARGIN.left} top={MARGIN.top}>
        {/* Grid */}
        <GridRows
          scale={yScale}
          width={innerWidth}
          stroke="rgba(255,255,255,0.05)"
        />

        {/* Relationships line */}
        <LinePath
          data={timeline}
          x={d => xScale(d.tick)}
          y={d => yScale(d.relationships)}
          stroke="#8b5cf6"
          strokeWidth={2}
          strokeLinecap="round"
        />

        {/* Modified entities line */}
        <LinePath
          data={timeline}
          x={d => xScale(d.tick)}
          y={d => yScale(d.modified)}
          stroke="#22c55e"
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="4 2"
        />

        {/* Y Axis */}
        <AxisLeft
          scale={yScale}
          stroke="rgba(148, 163, 184, 0.3)"
          tickStroke="rgba(148, 163, 184, 0.3)"
          tickLabelProps={() => ({
            fill: '#64748b',
            fontSize: 10,
            textAnchor: 'end',
            dy: '0.33em',
          })}
          numTicks={5}
        />

        {/* X Axis */}
        <AxisBottom
          scale={xScale}
          top={innerHeight}
          stroke="rgba(148, 163, 184, 0.3)"
          tickStroke="rgba(148, 163, 184, 0.3)"
          tickLabelProps={() => ({
            fill: '#64748b',
            fontSize: 10,
            textAnchor: 'middle',
          })}
        />
      </Group>
    </svg>
  );
}

/**
 * System summary cards
 */
function SystemSummaryCards({ systems }) {
  return (
    <div className="system-summary-cards">
      {systems.slice(0, 6).map((sys) => {
        const color = getSystemColor(sys.id);
        const execCount = sys.executions.length;

        return (
          <div key={sys.id} className="system-card" style={{ borderLeftColor: color }}>
            <div className="system-card-header">
              <span className="system-card-name">{sys.name}</span>
              <span className="system-card-count">{execCount}x</span>
            </div>
            <div className="system-card-stats">
              <div className="system-stat">
                <span className="system-stat-value">{sys.totalRelationships}</span>
                <span className="system-stat-label">relationships</span>
              </div>
              <div className="system-stat">
                <span className="system-stat-value">{sys.totalModified}</span>
                <span className="system-stat-label">modified</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Main panel component
 */
export default function SystemActivityPanel({ systemActions }) {
  const [activeView, setActiveView] = useState('swimlane');

  const { systems, timeline, maxTick } = useMemo(
    () => processSystemActions(systemActions),
    [systemActions]
  );

  if (!systems.length) {
    return (
      <div className="system-activity-empty">
        <div className="system-activity-empty-icon">&#9881;</div>
        <div>No system activity recorded</div>
      </div>
    );
  }

  return (
    <div className="system-activity-panel">
      {/* Header with view toggle */}
      <div className="system-activity-header">
        <div className="system-activity-title">System Activity</div>
        <div className="system-activity-toggles">
          <button
            className={`system-toggle ${activeView === 'swimlane' ? 'active' : ''}`}
            onClick={() => setActiveView('swimlane')}
          >
            Swimlane
          </button>
          <button
            className={`system-toggle ${activeView === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveView('timeline')}
          >
            Timeline
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <SystemSummaryCards systems={systems} />

      {/* Chart area */}
      <div className="system-activity-chart">
        <ParentSize>
          {({ width, height }) => {
            if (width === 0) return null;
            const chartHeight = Math.max(200, Math.min(300, systems.length * 40 + 60));

            return activeView === 'swimlane' ? (
              <SystemSwimlaneChart
                systems={systems}
                maxTick={maxTick}
                width={width}
                height={chartHeight}
              />
            ) : (
              <ActivityTimelineChart
                timeline={timeline}
                maxTick={maxTick}
                width={width}
                height={chartHeight}
              />
            );
          }}
        </ParentSize>
      </div>

      {/* Legend */}
      <div className="system-activity-legend">
        {activeView === 'timeline' && (
          <>
            <div className="legend-item">
              <span className="legend-line" style={{ backgroundColor: '#8b5cf6' }} />
              <span>Relationships Added</span>
            </div>
            <div className="legend-item">
              <span className="legend-line dashed" style={{ backgroundColor: '#22c55e' }} />
              <span>Entities Modified</span>
            </div>
          </>
        )}
        {activeView === 'swimlane' && (
          <>
            <div className="legend-item">
              <Circle cx={6} cy={6} r={6} fill="#8b5cf6" />
              <span>Active (with changes)</span>
            </div>
            <div className="legend-item">
              <Circle cx={6} cy={6} r={3} fill="#64748b" fillOpacity={0.3} />
              <span>Dormant</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
