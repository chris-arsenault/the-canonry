/**
 * ProminenceTimeline - Visual prominence tracking over time
 *
 * Displays a line graph of prominence changes with:
 * - X-axis: simulation tick
 * - Y-axis: prominence value (0-5)
 * - Vertical markers when prominence crosses level thresholds (1, 2, 3, 4)
 * - Hover tooltips with details
 */

import React, { useMemo, useState, useCallback } from 'react';
import { prominenceLabelFromScale, type ProminenceScale, type NarrativeEvent } from '@canonry/world-schema';
import styles from './ProminenceTimeline.module.css';

// Prominence level colors used in SVG
const PROMINENCE_COLORS = {
  forgotten: '#6b7280',   // gray
  marginal: '#f59e0b',    // amber
  recognized: '#3b82f6',  // blue
  renowned: '#8b5cf6',    // purple
  mythic: '#ec4899',      // pink
};

// SVG graph colors
const graphColors = {
  line: '#10b981',
  marker: '#f59e0b',
  levelLine: 'rgba(255, 255, 255, 0.1)',
  textMuted: '#60a5fa',
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
  initialProminence?: number;
  prominenceScale: ProminenceScale;
}

/**
 * Extract prominence change data points from narrative events
 */
function extractProminenceData(
  events: NarrativeEvent[],
  entityId: string,
  _initialProminence: number,
  prominenceScale: ProminenceScale
): ProminenceDataPoint[] {
  const dataPoints: ProminenceDataPoint[] = [];
  const thresholds = prominenceScale.thresholds;

  // Sort events by tick
  const sortedEvents = [...events].sort((a, b) => a.tick - b.tick);

  for (const event of sortedEvents) {
    const participant = event.participantEffects?.find(p => p.entity.id === entityId);
    if (!participant) continue;

    for (const effect of participant.effects) {
      if (effect.type === 'field_changed' && effect.field === 'prominence') {
        const previousValue = effect.previousValue as number;
        const newValue = effect.newValue as number;

        // Check if this change crosses a threshold (1, 2, 3, or 4)
        let crossesThreshold: number | null = null;
        for (const threshold of thresholds) {
          const crossedUp = previousValue < threshold && newValue >= threshold;
          const crossedDown = previousValue >= threshold && newValue < threshold;
          if (crossedUp || crossedDown) {
            crossesThreshold = threshold;
            break;
          }
        }

        dataPoints.push({
          tick: event.tick,
          era: event.era,
          previousValue,
          newValue,
          description: effect.description,
          eventId: event.id,
          crossesThreshold,
        });
      }
    }
  }

  return dataPoints;
}


export default function ProminenceTimeline({
  events,
  entityId,
  initialProminence = 2.5,
  prominenceScale,
}: ProminenceTimelineProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{
    point: ProminenceDataPoint;
    x: number;
    y: number;
  } | null>(null);

  // Extract prominence data from events
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

  // Calculate graph dimensions and scales
  const graphMetrics = useMemo(() => {
    if (dataPoints.length === 0) {
      return null;
    }

    // Start line from first data point (entity's initial prominence), not tick 0
    // First point is the previousValue at the first event tick, then each subsequent newValue
    const firstPoint = { tick: dataPoints[0].tick, value: dataPoints[0].previousValue };
    const allPoints = [firstPoint, ...dataPoints.map(p => ({ tick: p.tick, value: p.newValue }))];

    // Ribbon spans full era, but line only starts from first event
    const minTick = 0;
    const maxTick = Math.max(...allPoints.map(p => p.tick), 1);
    const minValue = 0;
    const maxValue = 5;

    // Graph dimensions (full width ribbon)
    const leftPadding = 0;
    const rightPadding = 0;
    const topPadding = 0;
    const bottomPadding = 0;

    return {
      allPoints,
      minTick,
      maxTick,
      minValue,
      maxValue,
      leftPadding,
      rightPadding,
      topPadding,
      bottomPadding,
      xScale: (tick: number) => leftPadding + ((tick - minTick) / (maxTick - minTick)) * (100 - leftPadding - rightPadding),
      yScale: (value: number) => topPadding + ((maxValue - value) / (maxValue - minValue)) * (100 - topPadding - bottomPadding),
    };
  }, [dataPoints]);

  // Find threshold crossings
  const thresholdCrossings = useMemo(() => {
    return dataPoints.filter(p => p.crossesThreshold !== null);
  }, [dataPoints]);

  // Build SVG path for the line
  const linePath = useMemo(() => {
    if (!graphMetrics || graphMetrics.allPoints.length === 0) return '';

    const points = graphMetrics.allPoints;
    const pathParts: string[] = [];

    // Start at first point
    pathParts.push(`M ${graphMetrics.xScale(points[0].tick)} ${graphMetrics.yScale(points[0].value)}`);

    // Step line (horizontal then vertical to show discrete changes)
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      // Horizontal line to new tick
      pathParts.push(`L ${graphMetrics.xScale(curr.tick)} ${graphMetrics.yScale(prev.value)}`);
      // Vertical line to new value
      pathParts.push(`L ${graphMetrics.xScale(curr.tick)} ${graphMetrics.yScale(curr.value)}`);
    }

    return pathParts.join(' ');
  }, [graphMetrics]);

  // Handle point hover
  const handlePointHover = useCallback((point: ProminenceDataPoint | null, e?: React.MouseEvent) => {
    if (point && e) {
      const rect = (e.target as SVGElement).closest('svg')?.getBoundingClientRect();
      if (rect) {
        setHoveredPoint({
          point,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    } else {
      setHoveredPoint(null);
    }
  }, []);

  const resolveLabel = (value: number) => prominenceLabelFromScale(value, prominenceScale);
  const resolveColor = (value: number) => {
    const label = resolveLabel(value);
    return PROMINENCE_COLORS[label as keyof typeof PROMINENCE_COLORS];
  };

  if (dataPoints.length === 0) {
    return null; // Don't render anything if no prominence changes
  }

  return (
    <div className={styles.container}>
      <div className={styles.title}>Prominence Over Time</div>

      <div className={styles.graphContainer}>
        <svg className={styles.svg} viewBox="0 0 100 100" preserveAspectRatio="none">
          {graphMetrics && (
            <>
              {/* Background level bands */}
              {prominenceLevels.map((level, i) => {
                const nextThreshold = prominenceLevels[i + 1]?.threshold ?? prominenceScale.max;
                return (
                  <rect
                    key={level.label}
                    x={0}
                    y={graphMetrics.yScale(nextThreshold)}
                    width={100}
                    height={graphMetrics.yScale(level.threshold) - graphMetrics.yScale(nextThreshold)}
                    fill={level.color}
                    opacity={0.1}
                  />
                );
              })}

              {/* Horizontal grid lines for each level threshold */}
              {prominenceScale.thresholds.map((threshold) => (
                <line
                  key={`grid-${threshold}`}
                  x1={0}
                  y1={graphMetrics.yScale(threshold)}
                  x2={100}
                  y2={graphMetrics.yScale(threshold)}
                  stroke={graphColors.levelLine}
                  strokeWidth={0.2}
                />
              ))}

              {/* Main line */}
              <path
                d={linePath}
                fill="none"
                stroke={graphColors.line}
                strokeWidth={0.8}
                vectorEffect="non-scaling-stroke"
              />

              {/* Threshold crossing markers (vertical lines) */}
              {thresholdCrossings.map((point, i) => (
                <g key={`crossing-${i}`}>
                  <line
                    x1={graphMetrics.xScale(point.tick)}
                    y1={0}
                    x2={graphMetrics.xScale(point.tick)}
                    y2={100}
                    stroke={graphColors.marker}
                    strokeWidth={0.5}
                    opacity={0.7}
                  />
                </g>
              ))}

              {/* Data points - only show threshold crossings as dots */}
              {thresholdCrossings.map((point, i) => (
                <circle
                  key={`point-${i}`}
                  cx={graphMetrics.xScale(point.tick)}
                  cy={graphMetrics.yScale(point.newValue)}
                  r={2}
                  fill={graphColors.marker}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => handlePointHover(point, e)}
                  onMouseLeave={() => handlePointHover(null)}
                />
              ))}
            </>
          )}
        </svg>

        {/* Tooltip - shows narrative description on hover */}
        {hoveredPoint && (
          <div
            className={styles.tooltip}
            style={{ left: hoveredPoint.x + 10, top: hoveredPoint.y - 40 }}
          >
            <div className={styles.tooltipValue}>
              <span style={{ color: resolveColor(hoveredPoint.point.previousValue) }}>
                {resolveLabel(hoveredPoint.point.previousValue)}
              </span>
              <span style={{ color: graphColors.textMuted }}>&rarr;</span>
              <span style={{ color: resolveColor(hoveredPoint.point.newValue) }}>
                {resolveLabel(hoveredPoint.point.newValue)}
              </span>
            </div>
            <div className={styles.tooltipDescription}>
              {hoveredPoint.point.description}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
