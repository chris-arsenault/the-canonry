/**
 * EventSwimlanes - Horizontal swimlanes for different event types
 *
 * Visual improvement: Instead of stacking all events at the bottom,
 * each event type gets its own horizontal lane for better clarity.
 */

import React from 'react';
import { SWIMLANE_CONFIG } from './scales';
import { EVENT_COLORS } from './SimulationTraceVisx';

const LANE_LABELS = {
  template: 'Templates',
  system: 'Systems',
  action: 'Actions',
};

const LANE_SYMBOLS = {
  template: 'triangle',
  system: 'diamond',
  action: 'circle',
};

/**
 * Render a marker shape based on type
 */
function MarkerShape({ type, cx, cy, size, fill, stroke, strokeWidth, opacity }) {
  switch (type) {
    case 'triangle':
      // Upward pointing triangle
      const h = size * 0.866; // height for equilateral
      return (
        <polygon
          points={`${cx},${cy - size * 0.6} ${cx - h * 0.6},${cy + size * 0.4} ${cx + h * 0.6},${cy + size * 0.4}`}
          fill={fill}
          fillOpacity={opacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case 'diamond':
      return (
        <polygon
          points={`${cx},${cy - size * 0.7} ${cx + size * 0.5},${cy} ${cx},${cy + size * 0.7} ${cx - size * 0.5},${cy}`}
          fill={fill}
          fillOpacity={opacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case 'circle':
    default:
      return (
        <circle
          cx={cx}
          cy={cy}
          r={size * 0.45}
          fill={fill}
          fillOpacity={opacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
  }
}

/**
 * Single swimlane for one event type
 */
function Swimlane({
  type,
  events,
  xScale,
  y,
  height,
  margin,
  hoveredEventId,
  selectedEventId,
  onEventHover,
  onEventClick,
}) {
  const color = EVENT_COLORS[type];
  const symbol = LANE_SYMBOLS[type];
  const centerY = y + height / 2;

  // Group events by tick for stacking within the lane
  const eventsByTick = new Map();
  for (const event of events) {
    if (!eventsByTick.has(event.tick)) {
      eventsByTick.set(event.tick, []);
    }
    eventsByTick.get(event.tick).push(event);
  }

  return (
    <g>
      {/* Lane background */}
      <rect
        x={margin.left}
        y={y}
        width={xScale.range()[1] - margin.left}
        height={height}
        fill="rgba(255,255,255,0.02)"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={1}
      />

      {/* Lane label */}
      <text
        x={margin.left - 8}
        y={centerY}
        textAnchor="end"
        dominantBaseline="middle"
        fill="rgba(255,255,255,0.4)"
        fontSize={9}
        fontWeight={500}
      >
        {LANE_LABELS[type]}
      </text>

      {/* Event markers */}
      {Array.from(eventsByTick.entries()).map(([tick, tickEvents]) => {
        const baseX = xScale(tick);

        return tickEvents.map((event, stackIndex) => {
          const isHovered = event.uniqueId === hoveredEventId;
          const isSelected = event.uniqueId === selectedEventId;

          // Stack horizontally if multiple events at same tick
          const offsetX = tickEvents.length > 1
            ? (stackIndex - (tickEvents.length - 1) / 2) * 12
            : 0;

          const cx = baseX + offsetX;
          const size = isSelected ? 12 : isHovered ? 11 : 9;
          const opacity = isSelected ? 1 : isHovered ? 0.9 : 0.7;

          return (
            <g
              key={event.uniqueId}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => onEventHover(event.uniqueId)}
              onMouseLeave={() => onEventHover(null)}
              onClick={(e) => {
                e.stopPropagation();
                onEventClick(event.uniqueId);
              }}
            >
              <MarkerShape
                type={symbol}
                cx={cx}
                cy={centerY}
                size={size}
                fill={color}
                stroke={isSelected ? '#fff' : isHovered ? color : 'none'}
                strokeWidth={isSelected ? 2 : 1}
                opacity={opacity}
              />

              {/* Count badge for stacked events */}
              {stackIndex === 0 && tickEvents.length > 3 && (
                <g>
                  <circle
                    cx={cx + 8}
                    cy={centerY - 6}
                    r={6}
                    fill="rgba(0,0,0,0.7)"
                    stroke={color}
                    strokeWidth={1}
                  />
                  <text
                    x={cx + 8}
                    y={centerY - 6}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#fff"
                    fontSize={8}
                    fontWeight={600}
                  >
                    {tickEvents.length}
                  </text>
                </g>
              )}
            </g>
          );
        });
      })}
    </g>
  );
}

/**
 * Main swimlanes component
 */
export default function EventSwimlanes({
  events,
  xScale,
  y,
  width,
  margin,
  hoveredEventId,
  selectedEventId,
  onEventHover,
  onEventClick,
}) {
  const { height, gap, types } = SWIMLANE_CONFIG;

  return (
    <g>
      {/* Swimlanes separator line */}
      <line
        x1={margin.left}
        y1={y - 4}
        x2={width - margin.right}
        y2={y - 4}
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={1}
      />

      {/* Individual swimlanes */}
      {types.map((type, i) => (
        <Swimlane
          key={type}
          type={type}
          events={events[type] || []}
          xScale={xScale}
          y={y + i * (height + gap)}
          height={height}
          margin={margin}
          hoveredEventId={hoveredEventId}
          selectedEventId={selectedEventId}
          onEventHover={onEventHover}
          onEventClick={onEventClick}
        />
      ))}
    </g>
  );
}
