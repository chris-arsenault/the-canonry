/**
 * EraTimeline - Dedicated era visualization with transition markers
 */

type ScaleFn = (value: number) => number;

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface EraBoundary {
  era: string;
  epoch: number;
  startTick: number;
  endTick: number;
}

import React from "react";
const ERA_COLORS = [
  { bg: "rgba(59, 130, 246, 0.25)", border: "rgba(59, 130, 246, 0.6)", text: "#93c5fd" },
  { bg: "rgba(168, 85, 247, 0.25)", border: "rgba(168, 85, 247, 0.6)", text: "#c4b5fd" },
  { bg: "rgba(236, 72, 153, 0.25)", border: "rgba(236, 72, 153, 0.6)", text: "#f9a8d4" },
  { bg: "rgba(34, 197, 94, 0.25)", border: "rgba(34, 197, 94, 0.6)", text: "#86efac" },
  { bg: "rgba(249, 115, 22, 0.25)", border: "rgba(249, 115, 22, 0.6)", text: "#fdba74" },
];

function TransitionMarker({ x, y, height }: Readonly<{ x: number; y: number; height: number }>) {
  const markerSize = 8;

  return (
    <g>
      <line
        x1={x}
        y1={y}
        x2={x}
        y2={y + height}
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={2}
        strokeDasharray="4 2"
      />
      <polygon
        points={`${String(x)},${String(y - markerSize)} ${String(x + markerSize)},${String(y)} ${String(x)},${String(y + markerSize)} ${String(x - markerSize)},${String(y)}`}
        fill="rgba(255,255,255,0.2)"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth={1}
      />
    </g>
  );
}

interface EraSegmentProps {
  era: EraBoundary;
  index: number;
  xScale: ScaleFn;
  y: number;
  height: number;
}

function EraSegment({ era, index, xScale, y, height }: Readonly<EraSegmentProps>) {
  const colors = ERA_COLORS[index % ERA_COLORS.length];
  const x1 = xScale(era.startTick);
  const x2 = xScale(era.endTick);
  const rawWidth = x2 - x1;
  const tickCount = era.endTick - era.startTick;

  if (rawWidth <= 0) return null;

  const width = rawWidth;
  const minWidthForFullName = 80;
  const displayName = width < minWidthForFullName ? era.era.slice(0, 3) + "..." : era.era;

  return (
    <g>
      <rect x={x1} y={y} width={width} height={height} fill={colors.bg} stroke={colors.border} strokeWidth={1} rx={4} ry={4} />
      <text x={x1 + width / 2} y={y + height / 2 - 4} textAnchor="middle" dominantBaseline="middle" fill={colors.text} fontSize={11} fontWeight={600}>
        {displayName}
      </text>
      <text x={x1 + width / 2} y={y + height / 2 + 10} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.4)" fontSize={9}>
        {tickCount} ticks
      </text>
      {width > 50 && (
        <g>
          <rect x={x1 + 4} y={y + 4} width={20} height={14} fill="rgba(0,0,0,0.3)" rx={3} ry={3} />
          <text x={x1 + 14} y={y + 11} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.6)" fontSize={8} fontWeight={500}>
            E{era.epoch}
          </text>
        </g>
      )}
    </g>
  );
}

interface EraTimelineProps {
  eraBoundaries: EraBoundary[];
  xScale: ScaleFn;
  y: number;
  height: number;
  width: number;
  margin: Margin;
}

export default function EraTimeline({ eraBoundaries, xScale, y, height, width, margin }: Readonly<EraTimelineProps>) {
  if (!eraBoundaries?.length) return null;

  return (
    <g>
      <line x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />

      {eraBoundaries.map((era, i) => (
        <EraSegment key={`era-${String(i)}`} era={era} index={i} xScale={xScale} y={y + 2} height={height - 4} />
      ))}

      {eraBoundaries.slice(1).map((era, i) => (
        <TransitionMarker key={`transition-${String(i)}`} x={xScale(era.startTick)} y={y} height={height} />
      ))}

      <text x={margin.left - 8} y={y + height / 2} textAnchor="end" dominantBaseline="middle" fill="rgba(255,255,255,0.4)" fontSize={9} fontWeight={500}>
        Eras
      </text>
    </g>
  );
}
