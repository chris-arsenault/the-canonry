/**
 * PressureChart - Multi-line pressure visualization using visx
 */

import React from "react";
import { LinePath } from "@visx/shape";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { GridRows, GridColumns } from "@visx/grid";
import { PRESSURE_COLORS } from "./traceConstants";

const Y_AXIS_LABEL_PROPS = () => ({
  fill: "#93c5fd",
  fontSize: 11,
  textAnchor: "end" as const,
  dy: "0.33em",
  dx: -4,
});

const X_AXIS_LABEL_PROPS = () => ({
  fill: "#93c5fd",
  fontSize: 11,
  textAnchor: "middle" as const,
  dy: 4,
});

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

type ScaleFn = (value: number) => number;

interface PressureDataPoint {
  tick: number;
  [pressureId: string]: number;
}

interface PressureChartProps {
  data: PressureDataPoint[];
  pressureIds: string[];
  hiddenPressures: Set<string>;
  xScale: ScaleFn;
  yScale: ScaleFn;
  margin: Margin;
  height: number; // chartBottom, not total height
  width: number;
}

/**
 * Pressure chart component
 *
 * Note: `height` here is the y-coordinate of the chart bottom (chartBottom),
 * NOT the total chart height. The chart area spans from margin.top to height.
 */
function PressureLine({ pressureId, pressureIds, data, xScale, yScale }: Readonly<{
  pressureId: string; pressureIds: string[]; data: PressureDataPoint[]; xScale: ScaleFn; yScale: ScaleFn;
}>) {
  const colorIndex = pressureIds.indexOf(pressureId);
  const color = PRESSURE_COLORS[colorIndex % PRESSURE_COLORS.length];
  const getX = React.useCallback((d: PressureDataPoint) => xScale(d.tick), [xScale]);
  const getY = React.useCallback((d: PressureDataPoint) => yScale(Number(d[pressureId] ?? 0)), [yScale, pressureId]);
  return <LinePath data={data} x={getX} y={getY} stroke={color} strokeWidth={2} strokeLinecap="round" />;
}

export default function PressureChart({
  data,
  pressureIds,
  hiddenPressures,
  xScale,
  yScale,
  margin,
  height,
  width,
}: Readonly<PressureChartProps>) {
  if (!data?.length || !pressureIds?.length) {
    return null;
  }

  const visiblePressures = pressureIds.filter((id) => !hiddenPressures.has(id));
  const chartAreaHeight = height - margin.top;
  const zeroY = yScale(0);

  return (
    <g>
      {/* Grid */}
      <GridRows
        scale={yScale}
        width={width - margin.left - margin.right}
        left={margin.left}
        stroke="rgba(255,255,255,0.1)"
        strokeDasharray="3 3"
      />
      <GridColumns
        scale={xScale}
        height={chartAreaHeight}
        top={margin.top}
        stroke="rgba(255,255,255,0.1)"
        strokeDasharray="3 3"
      />
      {/* Equilibrium line */}
      {Number.isFinite(zeroY) && (
        <line
          x1={margin.left}
          x2={width - margin.right}
          y1={zeroY}
          y2={zeroY}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={1}
          strokeDasharray="4 2"
        />
      )}

      {/* Pressure lines */}
      {visiblePressures.map((pressureId) => (
        <PressureLine key={pressureId} pressureId={pressureId} pressureIds={pressureIds} data={data} xScale={xScale} yScale={yScale} />
      ))}

      {/* Y Axis */}
      <AxisLeft
        scale={yScale}
        left={margin.left}
        stroke="#93c5fd"
        tickStroke="#93c5fd"
        tickLabelProps={Y_AXIS_LABEL_PROPS}
        numTicks={5}
        hideAxisLine={false}
        hideTicks={false}
      />

      {/* X Axis - positioned at chart bottom */}
      <AxisBottom
        scale={xScale}
        top={height}
        stroke="#93c5fd"
        tickStroke="#93c5fd"
        tickLabelProps={X_AXIS_LABEL_PROPS}
        numTicks={Math.min(10, data.length)}
        hideAxisLine={false}
        hideTicks={false}
      />
    </g>
  );
}
