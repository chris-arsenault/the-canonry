/**
 * IntensitySparkline - Shows narrative intensity over time
 *
 * A small area chart that visualizes event density and significance,
 * helping users identify natural story arcs (rising action, climax, resolution).
 */

import { useMemo } from 'react';
import type { IntensityPoint } from '../../../lib/chronicle/timelineUtils';

interface IntensitySparklineProps {
  points: IntensityPoint[];
  width: number;
  height: number;
  extent: [number, number];
  /** Optional: highlight a selected range */
  selectedRange?: [number, number] | null;
  /** Color for the fill */
  fillColor?: string;
  /** Color for the stroke */
  strokeColor?: string;
}

export default function IntensitySparkline({
  points,
  width,
  height,
  extent,
  selectedRange,
  fillColor = 'rgba(99, 102, 241, 0.2)',
  strokeColor = 'rgba(99, 102, 241, 0.6)',
}: IntensitySparklineProps) {
  // Match padding with NarrativeTimeline for visual alignment
  const padding = { left: 40, right: 40, top: 4, bottom: 4 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Build the SVG path
  const { areaPath, linePath } = useMemo(() => {
    if (points.length < 2) {
      return { areaPath: '', linePath: '' };
    }

    const [minTick, maxTick] = extent;
    const tickRange = maxTick - minTick || 1;

    const scaleX = (tick: number) =>
      padding.left + ((tick - minTick) / tickRange) * innerWidth;

    const scaleY = (intensity: number) =>
      padding.top + (1 - intensity) * innerHeight;

    // Build line path
    let lineParts: string[] = [];
    let areaParts: string[] = [];

    points.forEach((point, i) => {
      const x = scaleX(point.tick);
      const y = scaleY(point.intensity);

      if (i === 0) {
        lineParts.push(`M ${x} ${y}`);
        areaParts.push(`M ${x} ${height - padding.bottom}`);
        areaParts.push(`L ${x} ${y}`);
      } else {
        lineParts.push(`L ${x} ${y}`);
        areaParts.push(`L ${x} ${y}`);
      }
    });

    // Close the area path
    const lastX = scaleX(points[points.length - 1].tick);
    areaParts.push(`L ${lastX} ${height - padding.bottom}`);
    areaParts.push('Z');

    return {
      areaPath: areaParts.join(' '),
      linePath: lineParts.join(' '),
    };
  }, [points, extent, innerWidth, innerHeight, height, padding]);

  // Build highlight rect for selected range
  const highlightRect = useMemo(() => {
    if (!selectedRange) return null;

    const [minTick, maxTick] = extent;
    const tickRange = maxTick - minTick || 1;

    const scaleX = (tick: number) =>
      padding.left + ((tick - minTick) / tickRange) * innerWidth;

    const x1 = scaleX(selectedRange[0]);
    const x2 = scaleX(selectedRange[1]);

    return {
      x: Math.min(x1, x2),
      width: Math.abs(x2 - x1),
    };
  }, [selectedRange, extent, innerWidth, padding]);

  if (points.length < 2) {
    return (
      <svg width={width} height={height}>
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          fontSize="10"
          fill="var(--text-muted)"
        >
          Not enough data
        </text>
      </svg>
    );
  }

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {/* Selected range highlight */}
      {highlightRect && (
        <rect
          x={highlightRect.x}
          y={0}
          width={highlightRect.width}
          height={height}
          fill="rgba(99, 102, 241, 0.15)"
        />
      )}

      {/* Area fill */}
      <path d={areaPath} fill={fillColor} />

      {/* Line stroke */}
      <path d={linePath} fill="none" stroke={strokeColor} strokeWidth={1.5} />

      {/* Label */}
      <text
        x={4}
        y={12}
        fontSize="9"
        fill="var(--text-muted)"
        fontFamily="inherit"
      >
        Narrative Intensity
      </text>
    </svg>
  );
}
