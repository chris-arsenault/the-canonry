/**
 * StoryPotentialRadar - 5-axis spider chart for story potential
 *
 * Visualizes entity story potential across 5 dimensions:
 * - Connections: relationship richness
 * - Temporal Span: era coverage
 * - Role Diversity: variety of connected entity types
 * - Event Involvement: participation in events
 * - Prominence: entity prominence level
 */

import React, { useMemo } from "react";
import type { StoryPotential } from "../../../lib/chronicle/storyPotential";
import "./StoryPotentialRadar.css";

interface StoryPotentialRadarProps {
  potential: StoryPotential;
  size?: number;
  /** Show axis labels */
  showLabels?: boolean;
  /** Show value tooltips on hover */
  interactive?: boolean;
}

// Axis configuration
const AXES = [
  { key: "connections", label: "Connections", shortLabel: "Conn" },
  { key: "temporalSpan", label: "Temporal Span", shortLabel: "Time" },
  { key: "roleDiversity", label: "Role Diversity", shortLabel: "Roles" },
  { key: "eventInvolvement", label: "Events", shortLabel: "Events" },
  { key: "prominence", label: "Prominence", shortLabel: "Prom" },
] as const;

export default function StoryPotentialRadar({
  potential,
  size = 160,
  showLabels = true,
  interactive = true,
}: Readonly<StoryPotentialRadarProps>) {
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size / 2 - (showLabels ? 28 : 8);
  const numAxes = AXES.length;
  const angleStep = (2 * Math.PI) / numAxes;
  // Start from top (-90 degrees)
  const startAngle = -Math.PI / 2;

  // Compute axis endpoints
  const axisPoints = useMemo(() => {
    return AXES.map((_, i) => {
      const angle = startAngle + i * angleStep;
      return {
        x: cx + maxRadius * Math.cos(angle),
        y: cy + maxRadius * Math.sin(angle),
        labelX: cx + (maxRadius + 14) * Math.cos(angle),
        labelY: cy + (maxRadius + 14) * Math.sin(angle),
        angle,
      };
    });
  }, [cx, cy, maxRadius, angleStep, startAngle]);

  // Compute polygon points for the data
  const dataPoints = useMemo(() => {
    return AXES.map((axis, i) => {
      const value = potential[axis.key as keyof StoryPotential];
      const radius = value * maxRadius;
      const angle = startAngle + i * angleStep;
      return {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        value,
        label: axis.label,
      };
    });
  }, [potential, cx, cy, maxRadius, angleStep, startAngle]);

  // Build polygon path
  const polygonPath =
    dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  // Grid rings (25%, 50%, 75%, 100%)
  const gridRings = [0.25, 0.5, 0.75, 1];

  return (
    <svg width={size} height={size} className="spr-svg">
      {/* Background */}
      <circle cx={cx} cy={cy} r={maxRadius} fill="var(--bg-tertiary)" />

      {/* Grid rings */}
      {gridRings.map((ring) => (
        <circle
          key={ring}
          cx={cx}
          cy={cy}
          r={maxRadius * ring}
          fill="none"
          stroke="var(--border-color)"
          strokeWidth={ring === 1 ? 1 : 0.5}
          strokeDasharray={ring === 1 ? "none" : "2,2"}
        />
      ))}

      {/* Axis lines */}
      {axisPoints.map((point, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={point.x}
          y2={point.y}
          stroke="var(--border-color)"
          strokeWidth={0.5}
        />
      ))}

      {/* Data polygon */}
      <path
        d={polygonPath}
        fill="rgba(99, 102, 241, 0.3)"
        stroke="var(--accent-color)"
        strokeWidth={2}
      />

      {/* Data points */}
      {dataPoints.map((point, i) => (
        <g key={i}>
          <circle
            cx={point.x}
            cy={point.y}
            r={4}
            fill="var(--accent-color)"
            stroke="white"
            strokeWidth={1.5}
          />
          {interactive && <title>{`${point.label}: ${(point.value * 100).toFixed(0)}%`}</title>}
        </g>
      ))}

      {/* Axis labels */}
      {showLabels &&
        axisPoints.map((point, i) => {
          const axis = AXES[i];

          // Adjust text anchor based on position
          let textAnchor: "start" | "middle" | "end" = "middle";
          if (point.labelX < cx - 10) textAnchor = "end";
          else if (point.labelX > cx + 10) textAnchor = "start";

          // Adjust vertical position
          let dy = 4;
          if (point.labelY < cy - maxRadius * 0.5) dy = 12;
          else if (point.labelY > cy + maxRadius * 0.5) dy = -2;

          return (
            <text
              key={i}
              x={point.labelX}
              y={point.labelY}
              dy={dy}
              textAnchor={textAnchor}
              fontSize="9"
              fill="var(--text-muted)"
              fontFamily="inherit"
            >
              {axis.shortLabel}
            </text>
          );
        })}
    </svg>
  );
}

/**
 * Radar chart with score displayed below
 */
export function StoryPotentialRadarWithScore({
  potential,
  size = 160,
}: Readonly<{
  potential: StoryPotential;
  size?: number;
}>) {
  return (
    <div className="spr-with-score">
      <StoryPotentialRadar potential={potential} size={size} />
      <div className="spr-score-wrap">
        <div className="spr-score-number">
          {(potential.overallScore * 100).toFixed(0)}
        </div>
        <div className="spr-score-label">
          Story Score
        </div>
      </div>
    </div>
  );
}

/**
 * Compact score bar for list items
 */
export function StoryScoreBar({
  score,
  width = 60,
  height = 8,
}: Readonly<{
  score: number;
  width?: number;
  height?: number;
}>) {
  const fillWidth = score * width;

  return (
    <svg width={width} height={height} className="spr-svg">
      {/* Background */}
      <rect x={0} y={0} width={width} height={height} rx={height / 2} fill="var(--bg-tertiary)" />
      {/* Fill */}
      <rect
        x={0}
        y={0}
        width={fillWidth}
        height={height}
        rx={height / 2}
        fill="var(--accent-color)"
      />
    </svg>
  );
}

/**
 * Dot rating display (1-5 filled dots)
 */
export function StoryScoreDots({ score, maxDots = 5 }: Readonly<{ score: number; maxDots?: number }>) {
  const filledDots = Math.max(1, Math.min(maxDots, Math.round(score * maxDots)));

  return (
    <div className="spr-dots">
      {Array.from({ length: maxDots }).map((_, i) => (
        <span
          key={i}
          className={`spr-dot ${i < filledDots ? "spr-dot-filled" : "spr-dot-empty"}`}
        />
      ))}
    </div>
  );
}
