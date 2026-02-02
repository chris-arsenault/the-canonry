/**
 * PressureChart - Multi-line pressure visualization using visx
 */

import React from 'react';
import { LinePath } from '@visx/shape';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { GridRows, GridColumns } from '@visx/grid';
import { PRESSURE_COLORS } from './SimulationTraceVisx';

/**
 * Pressure chart component
 *
 * Note: `height` here is the y-coordinate of the chart bottom (chartBottom),
 * NOT the total chart height. The chart area spans from margin.top to height.
 */
export default function PressureChart({
  data,
  pressureIds,
  hiddenPressures,
  xScale,
  yScale,
  margin,
  height, // This is chartBottom, not total height
  width,
}) {
  if (!data?.length || !pressureIds?.length) {
    return null;
  }

  const visiblePressures = pressureIds.filter(id => !hiddenPressures.has(id));
  // Chart area height is from margin.top to chartBottom (height param)
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
      {visiblePressures.map((pressureId, i) => {
        const colorIndex = pressureIds.indexOf(pressureId);
        const color = PRESSURE_COLORS[colorIndex % PRESSURE_COLORS.length];

        return (
          <LinePath
            key={pressureId}
            data={data}
            x={d => xScale(d.tick)}
            y={d => yScale(d[pressureId] ?? 0)}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        );
      })}

      {/* Y Axis */}
      <AxisLeft
        scale={yScale}
        left={margin.left}
        stroke="#93c5fd"
        tickStroke="#93c5fd"
        tickLabelProps={() => ({
          fill: '#93c5fd',
          fontSize: 11,
          textAnchor: 'end',
          dy: '0.33em',
          dx: -4,
        })}
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
        tickLabelProps={() => ({
          fill: '#93c5fd',
          fontSize: 11,
          textAnchor: 'middle',
          dy: 4,
        })}
        numTicks={Math.min(10, data.length)}
        hideAxisLine={false}
        hideTicks={false}
      />
    </g>
  );
}
