/**
 * ProminenceTimeline - Visual prominence tracking over time
 *
 * Displays a line graph of prominence changes with:
 * - X-axis: simulation tick
 * - Y-axis: prominence value (0-5)
 * - Vertical markers when prominence crosses level thresholds (1, 2, 3, 4)
 * - Hover tooltips with details
 */

import React, { useMemo, useState, useCallback } from "react";
import {
  prominenceLabelFromScale,
  type ProminenceScale,
  type NarrativeEvent,
} from "@canonry/world-schema";
import type { Optional } from "@the-canonry/shared-components";

// Prominence level colors used in SVG - warm palette
const PROMINENCE_COLORS = {
  forgotten: "#6b6155", // warm gray
  marginal: "#d4a017", // warm amber
  recognized: "#c49a5c", // burnished gold
  renowned: "#8b7355", // warm brown
  mythic: "#d4aa6c", // light gold
};

// SVG graph colors - warm palette
const graphColors = {
  line: "#c49a5c",
  marker: "#d4a017",
  levelLine: "rgba(232, 220, 200, 0.1)",
  textMuted: "#8a7d6b",
};

interface ProminenceDataPoint {
  tick: number;
  era: string;
  previousValue: number;
  newValue: number;
  description: string;
  eventId: string;
  crossesThreshold: number | null; // threshold value if crossed, null otherwise
}

interface ProminenceTimelineProps {
  events: NarrativeEvent[];
  entityId: string;
  initialProminence: Optional<number>;
  prominenceScale: ProminenceScale;
}

interface GraphMetrics {
  allPoints: Array<{ tick: number; value: number }>;
  xScale: (tick: number) => number;
  yScale: (value: number) => number;
}

interface ProminenceLevel {
  threshold: number;
  label: string;
  color: string;
}

// --- Data extraction ---

function findCrossedThreshold(thresholds: number[], previousValue: number, newValue: number): number | null {
  for (const threshold of thresholds) {
    const crossedUp = previousValue < threshold && newValue >= threshold;
    const crossedDown = previousValue >= threshold && newValue < threshold;
    if (crossedUp || crossedDown) return threshold;
  }
  return null;
}

function extractProminenceData(
  events: NarrativeEvent[],
  entityId: string,
  _initialProminence: number,
  prominenceScale: ProminenceScale
): ProminenceDataPoint[] {
  const dataPoints: ProminenceDataPoint[] = [];
  const thresholds = prominenceScale.thresholds;

  const sortedEvents = [...events].sort((a, b) => a.tick - b.tick);

  for (const event of sortedEvents) {
    const participant = event.participantEffects?.find((p) => p.entity.id === entityId);
    if (!participant) continue;

    for (const effect of participant.effects) {
      if (effect.type === "field_changed" && effect.field === "prominence") {
        const previousValue = effect.previousValue as number;
        const newValue = effect.newValue as number;
        dataPoints.push({
          tick: event.tick,
          era: event.era,
          previousValue,
          newValue,
          description: effect.description,
          eventId: event.id,
          crossesThreshold: findCrossedThreshold(thresholds, previousValue, newValue),
        });
      }
    }
  }

  return dataPoints;
}

// --- Graph computation ---

function computeGraphMetrics(dataPoints: ProminenceDataPoint[]): GraphMetrics | null {
  if (dataPoints.length === 0) return null;

  const firstPoint = { tick: dataPoints[0].tick, value: dataPoints[0].previousValue };
  const allPoints = [firstPoint, ...dataPoints.map((p) => ({ tick: p.tick, value: p.newValue }))];

  const minTick = 0;
  const maxTick = Math.max(...allPoints.map((p) => p.tick), 1);

  return {
    allPoints,
    xScale: (tick: number) => ((tick - minTick) / (maxTick - minTick)) * 100,
    yScale: (value: number) => ((5 - value) / 5) * 100,
  };
}

function buildLinePath(metrics: GraphMetrics): string {
  if (metrics.allPoints.length === 0) return "";

  const points = metrics.allPoints;
  const parts: string[] = [
    `M ${metrics.xScale(points[0].tick)} ${metrics.yScale(points[0].value)}`,
  ];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    parts.push(`L ${metrics.xScale(curr.tick)} ${metrics.yScale(prev.value)}`);
    parts.push(`L ${metrics.xScale(curr.tick)} ${metrics.yScale(curr.value)}`);
  }

  return parts.join(" ");
}

// --- Sub-components ---

function ProminenceGraphSvg({
  metrics,
  linePath,
  prominenceLevels,
  thresholdCrossings,
  prominenceScale,
  onPointHover,
}: Readonly<{
  metrics: GraphMetrics;
  linePath: string;
  prominenceLevels: ProminenceLevel[];
  thresholdCrossings: ProminenceDataPoint[];
  prominenceScale: ProminenceScale;
  onPointHover: (point: ProminenceDataPoint | null, e?: React.MouseEvent) => void;
}>) {
  return (
    <svg className="svg" viewBox="0 0 100 100" preserveAspectRatio="none">
      {prominenceLevels.map((level, i) => {
        const nextThreshold = prominenceLevels[i + 1]?.threshold ?? prominenceScale.max;
        return (
          <rect
            key={level.label}
            x={0}
            y={metrics.yScale(nextThreshold)}
            width={100}
            height={metrics.yScale(level.threshold) - metrics.yScale(nextThreshold)}
            fill={level.color}
            opacity={0.1}
          />
        );
      })}

      {prominenceScale.thresholds.map((threshold) => (
        <line
          key={`grid-${threshold}`}
          x1={0} y1={metrics.yScale(threshold)}
          x2={100} y2={metrics.yScale(threshold)}
          stroke={graphColors.levelLine}
          strokeWidth={0.2}
        />
      ))}

      <path d={linePath} fill="none" stroke={graphColors.line} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />

      {thresholdCrossings.map((point, i) => (
        <line
          key={`crossing-${i}`}
          x1={metrics.xScale(point.tick)} y1={0}
          x2={metrics.xScale(point.tick)} y2={100}
          stroke={graphColors.marker} strokeWidth={0.5} opacity={0.7}
        />
      ))}

      {thresholdCrossings.map((point, i) => (
        <circle
          key={`point-${i}`}
          cx={metrics.xScale(point.tick)}
          cy={metrics.yScale(point.newValue)}
          r={2}
          fill={graphColors.marker}
          className="data-point"
          onMouseEnter={(e) => onPointHover(point, e)}
          onMouseLeave={() => onPointHover(null)}
        />
      ))}
    </svg>
  );
}

function ProminenceTooltip({
  hoveredPoint,
  prominenceScale,
}: Readonly<{
  hoveredPoint: { point: ProminenceDataPoint; x: number; y: number };
  prominenceScale: ProminenceScale;
}>) {
  const resolveLabel = (value: number) => prominenceLabelFromScale(value, prominenceScale);
  const resolveColor = (value: number) => {
    const label = resolveLabel(value);
    return PROMINENCE_COLORS[label as keyof typeof PROMINENCE_COLORS];
  };

  return (
    <div
      className="tooltip"
      style={{
        "--tooltip-left": `${hoveredPoint.x + 10}px`,
        "--tooltip-top": `${hoveredPoint.y - 40}px`,
      } as React.CSSProperties}
    >
      <div className="tooltip-value">
        <span
          style={{ "--prominence-color": resolveColor(hoveredPoint.point.previousValue) } as React.CSSProperties}
          className="transition-color"
        >
          {resolveLabel(hoveredPoint.point.previousValue)}
        </span>
        {" "}
        <span
          style={{ "--prominence-color": graphColors.textMuted } as React.CSSProperties}
          className="transition-color"
        >
          &rarr;
        </span>
        {" "}
        <span
          style={{ "--prominence-color": resolveColor(hoveredPoint.point.newValue) } as React.CSSProperties}
          className="transition-color"
        >
          {resolveLabel(hoveredPoint.point.newValue)}
        </span>
      </div>
      <div className="tooltip-description">{hoveredPoint.point.description}</div>
    </div>
  );
}

// --- Main component ---

export default function ProminenceTimeline({
  events,
  entityId,
  initialProminence = 2.5,
  prominenceScale,
}: Readonly<ProminenceTimelineProps>) {
  const [hoveredPoint, setHoveredPoint] = useState<{
    point: ProminenceDataPoint;
    x: number;
    y: number;
  } | null>(null);

  const dataPoints = useMemo(
    () => extractProminenceData(events, entityId, initialProminence, prominenceScale),
    [events, entityId, initialProminence, prominenceScale]
  );

  const prominenceLevels = useMemo(() => {
    return prominenceScale.labels.map((label, index) => ({
      threshold: index === 0 ? prominenceScale.min : prominenceScale.thresholds[index - 1],
      label,
      color: PROMINENCE_COLORS[label as keyof typeof PROMINENCE_COLORS],
    }));
  }, [prominenceScale]);

  const graphMetrics = useMemo(() => computeGraphMetrics(dataPoints), [dataPoints]);
  const thresholdCrossings = useMemo(() => dataPoints.filter((p) => p.crossesThreshold !== null), [dataPoints]);
  const linePath = useMemo(() => (graphMetrics ? buildLinePath(graphMetrics) : ""), [graphMetrics]);

  const handlePointHover = useCallback(
    (point: ProminenceDataPoint | null, e?: React.MouseEvent) => {
      if (point && e) {
        const rect = (e.target as SVGElement).closest("svg")?.getBoundingClientRect();
        if (rect) {
          setHoveredPoint({ point, x: e.clientX - rect.left, y: e.clientY - rect.top });
        }
      } else {
        setHoveredPoint(null);
      }
    },
    []
  );

  if (dataPoints.length === 0) return null;
  if (!graphMetrics) return null;

  return (
    <div className="pt-container">
      <div className="pt-title">Prominence Over Time</div>
      <div className="graph-container">
        <ProminenceGraphSvg
          metrics={graphMetrics}
          linePath={linePath}
          prominenceLevels={prominenceLevels}
          thresholdCrossings={thresholdCrossings}
          prominenceScale={prominenceScale}
          onPointHover={handlePointHover}
        />
        {hoveredPoint && (
          <ProminenceTooltip hoveredPoint={hoveredPoint} prominenceScale={prominenceScale} />
        )}
      </div>
    </div>
  );
}
