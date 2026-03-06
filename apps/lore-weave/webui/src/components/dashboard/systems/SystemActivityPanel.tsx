/**
 * SystemActivityPanel - Visualization of system activity during simulation
 */

import React, { useMemo, useState } from "react";
import { Group } from "@visx/group";
import { scaleLinear, scaleBand } from "@visx/scale";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { LinePath, Circle } from "@visx/shape";
import { GridRows } from "@visx/grid";
import { ParentSize } from "@visx/responsive";
import "./SystemActivityPanel.css";

const MARGIN = { top: 20, right: 20, bottom: 40, left: 120 };

const SYSTEM_COLORS: Record<string, string> = {
  "plane-diffusion": "#f59e0b",
  "graph-contagion": "#8b5cf6",
  "cluster-formation": "#22c55e",
  "connection-evolution": "#3b82f6",
  "tag-diffusion": "#ec4899",
  "threshold-trigger": "#14b8a6",
  "framework-era-manager": "#ef4444",
  default: "#64748b",
};

const AXIS_LABEL_PROPS = Object.freeze({ fill: "#64748b", fontSize: 11 });
const Y_TICK_LABEL = () => ({ fill: "#94a3b8", fontSize: 11, textAnchor: "end" as const, dy: "0.33em" });
const X_TICK_LABEL = () => ({ fill: "#64748b", fontSize: 10, textAnchor: "middle" as const });
const Y_TICK_LABEL_SM = () => ({ fill: "#64748b", fontSize: 10, textAnchor: "end" as const, dy: "0.33em" });

function getSystemColor(systemId: string): string {
  for (const [key, color] of Object.entries(SYSTEM_COLORS)) {
    if (systemId.includes(key)) return color;
  }
  return SYSTEM_COLORS.default;
}

interface SystemAction {
  systemId: string;
  systemName: string;
  tick: number;
  epoch: number;
  relationshipsAdded: number;
  entitiesModified: number;
  description: string;
  details: Record<string, unknown>;
}

interface SystemExecution {
  tick: number;
  epoch: number;
  relationshipsAdded: number;
  entitiesModified: number;
  description: string;
  isEraTransition: boolean;
}

interface ProcessedSystem {
  id: string;
  name: string;
  executions: SystemExecution[];
  totalRelationships: number;
  totalModified: number;
}

interface TimelineEntry {
  tick: number;
  relationships: number;
  modified: number;
}

function processSystemActions(systemActions: SystemAction[]): { systems: ProcessedSystem[]; timeline: TimelineEntry[]; maxTick: number } {
  if (!systemActions?.length) return { systems: [], timeline: [], maxTick: 0 };

  const systemMap = new Map<string, ProcessedSystem>();
  let maxTick = 0;

  for (const action of systemActions) {
    if (action.systemId === "framework-growth") continue;
    maxTick = Math.max(maxTick, action.tick);

    if (!systemMap.has(action.systemId)) {
      systemMap.set(action.systemId, {
        id: action.systemId, name: action.systemName,
        executions: [], totalRelationships: 0, totalModified: 0,
      });
    }

    const sys = systemMap.get(action.systemId);
    sys.executions.push({
      tick: action.tick, epoch: action.epoch,
      relationshipsAdded: action.relationshipsAdded || 0,
      entitiesModified: action.entitiesModified || 0,
      description: action.description,
      isEraTransition: !!action.details?.eraTransition,
    });
    sys.totalRelationships += action.relationshipsAdded || 0;
    sys.totalModified += action.entitiesModified || 0;
  }

  const systems = Array.from(systemMap.values()).sort(
    (a, b) => b.totalRelationships + b.totalModified - (a.totalRelationships + a.totalModified)
  );

  const timelineMap = new Map<number, TimelineEntry>();
  for (const action of systemActions) {
    if (action.systemId === "framework-growth") continue;
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

function SystemSwimlaneChart({ systems, maxTick, width, height }: Readonly<{ systems: ProcessedSystem[]; maxTick: number; width: number; height: number }>) {
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const xScale = scaleLinear({ domain: [0, maxTick], range: [0, innerWidth] });
  const yScale = scaleBand({ domain: systems.map((s) => s.id), range: [0, innerHeight], padding: 0.3 });

  return (
    <svg width={width} height={height}>
      <Group left={MARGIN.left} top={MARGIN.top}>
        <GridRows scale={yScale} width={innerWidth} stroke="rgba(255,255,255,0.05)" />
        {systems.map((sys) => {
          const y = yScale(sys.id) ?? 0;
          const laneHeight = yScale.bandwidth();
          const color = getSystemColor(sys.id);
          return (
            <g key={sys.id}>
              <rect x={0} y={y} width={innerWidth} height={laneHeight} fill="rgba(255,255,255,0.02)" />
              {sys.executions.map((exec, i) => {
                const cx = xScale(exec.tick);
                const cy = y + laneHeight / 2;
                const hasActivity = exec.relationshipsAdded > 0 || exec.entitiesModified > 0;
                return (
                  <Circle key={i} cx={cx} cy={cy} r={hasActivity ? 6 : 3} fill={color} fillOpacity={hasActivity ? 0.8 : 0.3}
                    stroke={exec.isEraTransition ? "#f59e0b" : "none"} strokeWidth={exec.isEraTransition ? 2 : 0} />
                );
              })}
            </g>
          );
        })}
        <AxisLeft scale={yScale} stroke="rgba(148, 163, 184, 0.3)" tickStroke="transparent"
          tickLabelProps={Y_TICK_LABEL}
          tickFormat={React.useCallback((id: string) => systems.find((s) => s.id === id)?.name || String(id), [systems])} />
        <AxisBottom scale={xScale} top={innerHeight} stroke="rgba(148, 163, 184, 0.3)" tickStroke="rgba(148, 163, 184, 0.3)"
          tickLabelProps={X_TICK_LABEL}
          label="Tick" labelOffset={25} labelProps={AXIS_LABEL_PROPS} />
      </Group>
    </svg>
  );
}

function ActivityTimelineChart({ timeline, maxTick, width, height }: Readonly<{ timeline: TimelineEntry[]; maxTick: number; width: number; height: number }>) {
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;
  const maxValue = Math.max(...timeline.map((t) => Math.max(t.relationships, t.modified)), 1);
  const xScale = scaleLinear({ domain: [0, maxTick], range: [0, innerWidth] });
  const yScale = scaleLinear({ domain: [0, maxValue], range: [innerHeight, 0] });
  const xTick = React.useCallback((d: TimelineEntry) => xScale(d.tick), [xScale]);
  const yRel = React.useCallback((d: TimelineEntry) => yScale(d.relationships), [yScale]);
  const yMod = React.useCallback((d: TimelineEntry) => yScale(d.modified), [yScale]);

  return (
    <svg width={width} height={height}>
      <Group left={MARGIN.left} top={MARGIN.top}>
        <GridRows scale={yScale} width={innerWidth} stroke="rgba(255,255,255,0.05)" />
        <LinePath data={timeline} x={xTick} y={yRel} stroke="#8b5cf6" strokeWidth={2} strokeLinecap="round" />
        <LinePath data={timeline} x={xTick} y={yMod} stroke="#22c55e" strokeWidth={2} strokeLinecap="round" strokeDasharray="4 2" />
        <AxisLeft scale={yScale} stroke="rgba(148, 163, 184, 0.3)" tickStroke="rgba(148, 163, 184, 0.3)"
          tickLabelProps={Y_TICK_LABEL_SM} numTicks={5} />
        <AxisBottom scale={xScale} top={innerHeight} stroke="rgba(148, 163, 184, 0.3)" tickStroke="rgba(148, 163, 184, 0.3)"
          tickLabelProps={X_TICK_LABEL} />
      </Group>
    </svg>
  );
}

function SystemSummaryCards({ systems }: Readonly<{ systems: ProcessedSystem[] }>) {
  return (
    <div className="system-summary-cards">
      {systems.slice(0, 6).map((sys) => {
        const color = getSystemColor(sys.id);
        return (
          <div key={sys.id} className="system-card" style={{ '--sa-card-border-color': color } as React.CSSProperties}>
            <div className="system-card-header">
              <span className="system-card-name">{sys.name}</span>
              <span className="system-card-count">{sys.executions.length}x</span>
            </div>
            <div className="system-card-stats">
              <div className="system-stat"><span className="system-stat-value">{sys.totalRelationships}</span><span className="system-stat-label">relationships</span></div>
              <div className="system-stat"><span className="system-stat-value">{sys.totalModified}</span><span className="system-stat-label">modified</span></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SystemActivityPanel({ systemActions }: Readonly<{ systemActions: SystemAction[] }>) {
  const [activeView, setActiveView] = useState("swimlane");
  const { systems, timeline, maxTick } = useMemo(() => processSystemActions(systemActions), [systemActions]);

  if (!systems.length) {
    return (<div className="system-activity-empty"><div className="system-activity-empty-icon">&#9881;</div><div>No system activity recorded</div></div>);
  }

  return (
    <div className="system-activity-panel">
      <div className="system-activity-header">
        <div className="system-activity-title">System Activity</div>
        <div className="view-switcher">
          <button className={`system-toggle ${activeView === "swimlane" ? "active" : ""}`} onClick={() => setActiveView("swimlane")}>Swimlane</button>
          <button className={`system-toggle ${activeView === "timeline" ? "active" : ""}`} onClick={() => setActiveView("timeline")}>Timeline</button>
        </div>
      </div>
      <SystemSummaryCards systems={systems} />
      <div className="system-activity-chart">
        <ParentSize>
          {({ width }) => {
            if (width === 0) return null;
            const chartHeight = Math.max(200, Math.min(300, systems.length * 40 + 60));
            return activeView === "swimlane"
              ? <SystemSwimlaneChart systems={systems} maxTick={maxTick} width={width} height={chartHeight} />
              : <ActivityTimelineChart timeline={timeline} maxTick={maxTick} width={width} height={chartHeight} />;
          }}
        </ParentSize>
      </div>
      <div className="system-activity-legend">
        {activeView === "timeline" && (
          <>
            <div className="legend-item"><span className="legend-line sa-legend-line" style={{ '--sa-legend-line-color': '#8b5cf6' } as React.CSSProperties} /><span>Relationships Added</span></div>
            <div className="legend-item"><span className="legend-line dashed sa-legend-line" style={{ '--sa-legend-line-color': '#22c55e' } as React.CSSProperties} /><span>Entities Modified</span></div>
          </>
        )}
        {activeView === "swimlane" && (
          <>
            <div className="legend-item"><Circle cx={6} cy={6} r={6} fill="#8b5cf6" /><span>Active (with changes)</span></div>
            <div className="legend-item"><Circle cx={6} cy={6} r={3} fill="#64748b" fillOpacity={0.3} /><span>Dormant</span></div>
          </>
        )}
      </div>
    </div>
  );
}
