/**
 * EventSwimlanes - Horizontal swimlanes for different event types
 */

import React from "react";
import "./EventSwimlanes.css";
import { SWIMLANE_CONFIG } from "./scales";
import { EVENT_COLORS } from "./traceConstants";

type ScaleFn = ((value: number) => number) & { range: () => number[] };

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface TraceEvent {
  tick: number;
  uniqueId: string;
  [key: string]: unknown;
}

const LANE_LABELS: Record<string, string> = {
  template: "Templates",
  system: "Systems",
  action: "Actions",
};

const LANE_SYMBOLS: Record<string, string> = {
  template: "triangle",
  system: "diamond",
  action: "circle",
};

interface MarkerShapeProps {
  type: string;
  cx: number;
  cy: number;
  size: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

function MarkerShape({ type, cx, cy, size, fill, stroke, strokeWidth, opacity }: Readonly<MarkerShapeProps>) {
  switch (type) {
    case "triangle": {
      const h = size * 0.866;
      return (
        <polygon
          points={`${String(cx)},${String(cy - size * 0.6)} ${String(cx - h * 0.6)},${String(cy + size * 0.4)} ${String(cx + h * 0.6)},${String(cy + size * 0.4)}`}
          fill={fill} fillOpacity={opacity} stroke={stroke} strokeWidth={strokeWidth}
        />
      );
    }
    case "diamond":
      return (
        <polygon
          points={`${String(cx)},${String(cy - size * 0.7)} ${String(cx + size * 0.5)},${String(cy)} ${String(cx)},${String(cy + size * 0.7)} ${String(cx - size * 0.5)},${String(cy)}`}
          fill={fill} fillOpacity={opacity} stroke={stroke} strokeWidth={strokeWidth}
        />
      );
    case "circle":
    default:
      return <circle cx={cx} cy={cy} r={size * 0.45} fill={fill} fillOpacity={opacity} stroke={stroke} strokeWidth={strokeWidth} />;
  }
}

interface SwimlaneProps {
  type: string;
  events: TraceEvent[];
  xScale: ScaleFn;
  y: number;
  height: number;
  margin: Margin;
  hoveredEventId: string | null;
  selectedEventId: string | null;
  onEventHover: (id: string | null) => void;
  onEventClick: (id: string) => void;
}

function Swimlane({ type, events, xScale, y, height, margin, hoveredEventId, selectedEventId, onEventHover, onEventClick }: Readonly<SwimlaneProps>) {
  const color = EVENT_COLORS[type] || "#94a3b8";
  const symbol = LANE_SYMBOLS[type];
  const centerY = y + height / 2;

  const eventsByTick = new Map<number, TraceEvent[]>();
  for (const event of events) {
    if (!eventsByTick.has(event.tick)) eventsByTick.set(event.tick, []);
    eventsByTick.get(event.tick)?.push(event);
  }

  return (
    <g>
      <rect x={margin.left} y={y} width={xScale.range()[1] - margin.left} height={height} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
      <text x={margin.left - 8} y={centerY} textAnchor="end" dominantBaseline="middle" fill="rgba(255,255,255,0.4)" fontSize={9} fontWeight={500}>{LANE_LABELS[type]}</text>

      {Array.from(eventsByTick.entries()).map(([tick, tickEvents]) => {
        const baseX = xScale(tick);

        return tickEvents.map((event, stackIndex) => {
          const isHovered = event.uniqueId === hoveredEventId;
          const isSelected = event.uniqueId === selectedEventId;
          const offsetX = tickEvents.length > 1 ? (stackIndex - (tickEvents.length - 1) / 2) * 12 : 0;
          const cx = baseX + offsetX;
          let size = 9;
          if (isSelected) size = 12;
          else if (isHovered) size = 11;
          let opacity = 0.7;
          if (isSelected) opacity = 1;
          else if (isHovered) opacity = 0.9;
          let stroke = "none";
          if (isSelected) stroke = "#fff";
          else if (isHovered) stroke = color;

          return (
            <g key={event.uniqueId} className="es-marker" onMouseEnter={() => onEventHover(event.uniqueId)} onMouseLeave={() => onEventHover(null)} onClick={(e) => { e.stopPropagation(); onEventClick(event.uniqueId); }}>
              <MarkerShape type={symbol} cx={cx} cy={centerY} size={size} fill={color} stroke={stroke} strokeWidth={isSelected ? 2 : 1} opacity={opacity} />
              {stackIndex === 0 && tickEvents.length > 3 && (
                <g>
                  <circle cx={cx + 8} cy={centerY - 6} r={6} fill="rgba(0,0,0,0.7)" stroke={color} strokeWidth={1} />
                  <text x={cx + 8} y={centerY - 6} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={8} fontWeight={600}>{tickEvents.length}</text>
                </g>
              )}
            </g>
          );
        });
      })}
    </g>
  );
}

interface EventSwimlanesProps {
  events: Record<string, TraceEvent[]>;
  xScale: ScaleFn;
  y: number;
  width: number;
  margin: Margin;
  hoveredEventId: string | null;
  selectedEventId: string | null;
  onEventHover: (id: string | null) => void;
  onEventClick: (id: string) => void;
}

export default function EventSwimlanes({ events, xScale, y, width, margin, hoveredEventId, selectedEventId, onEventHover, onEventClick }: Readonly<EventSwimlanesProps>) {
  const { height, gap, types } = SWIMLANE_CONFIG;

  return (
    <g>
      <line x1={margin.left} y1={y - 4} x2={width - margin.right} y2={y - 4} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
      {types.map((type, i) => (
        <Swimlane key={type} type={type} events={events[type] || []} xScale={xScale} y={y + i * (height + gap)} height={height} margin={margin} hoveredEventId={hoveredEventId} selectedEventId={selectedEventId} onEventHover={onEventHover} onEventClick={onEventClick} />
      ))}
    </g>
  );
}
