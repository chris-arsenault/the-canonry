/**
 * TraceVisualization - SVG chart with pressure lines, era backgrounds,
 * event markers (template/system/action), and scroll controls.
 *
 * Decomposed from SimulationTraceVisx to stay within per-function complexity limits.
 */

import React, { useState, useMemo, useCallback, useRef } from "react";
import { createXScale, createPressureYScale, DEFAULT_MARGIN, ERA_TIMELINE_HEIGHT } from "./scales";
import PressureChart from "./PressureChart";
import EraTimeline from "./EraTimeline";
import { PRESSURE_COLORS, ERA_COLORS, VISIBLE_TICKS } from "./traceConstants";
import type {
  PressureDataPoint,
  EventData,
  EraBoundary,
  TemplateEventMarker,
  SystemEventMarker,
  ActionEventMarker,
  LinearScale,
  ChartMargin,
} from "./traceTypes";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InteractionState {
  selectedTick: number | null;
  lockedTick: number | null;
  hoveredEventId: string | null;
  selectedEventId: string | null;
  scrollOffset: number | null;
}

export interface InteractionCallbacks {
  onTickHover: (tick: number) => void;
  onTickClick: (tick: number) => void;
  onEventHover: (id: string | null) => void;
  onEventClick: (id: string) => void;
  onScrollChange: (offset: number) => void;
}

interface TraceVisualizationProps {
  width: number;
  height: number;
  pressureData: PressureDataPoint[];
  pressureIds: string[];
  eventData: EventData;
  eraBoundaries: EraBoundary[];
  hiddenPressures: Set<string>;
  interaction: InteractionState;
  callbacks: InteractionCallbacks;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MARKER_SIZE = 10;
const MARKER_STACK_OFFSET = 12;
const X_AXIS_LABEL_SPACE = 25;
const BOTTOM_PADDING = 10;
const THROTTLE_MS = 50;

// ---------------------------------------------------------------------------
// Tooltip type
// ---------------------------------------------------------------------------

interface TooltipData {
  x: number;
  y: number;
  tick: number;
  epoch: number | undefined;
  pressures: Array<{ name: string; value: number | undefined; color: string }>;
}

// ---------------------------------------------------------------------------
// Marker size/opacity helper
// ---------------------------------------------------------------------------

function markerAppearance(
  isSelected: boolean,
  isHovered: boolean,
  baseSize: number
): { size: number; opacity: number } {
  if (isSelected) return { size: baseSize + 3, opacity: 1 };
  if (isHovered) return { size: baseSize + 2, opacity: 0.9 };
  return { size: baseSize, opacity: 0.7 };
}

function strokeColor(isSelected: boolean, isHovered: boolean, eventColor: string): string {
  if (isSelected) return "#fff";
  if (isHovered) return eventColor;
  return "rgba(0,0,0,0.3)";
}

// ---------------------------------------------------------------------------
// Small marker sub-components
// ---------------------------------------------------------------------------

interface TemplateMarkerProps {
  event: TemplateEventMarker;
  xScale: LinearScale;
  chartBottom: number;
  hoveredEventId: string | null;
  selectedEventId: string | null;
  onEventHover: (id: string | null) => void;
  onEventClick: (id: string) => void;
}

function TemplateMarker({
  event, xScale, chartBottom, hoveredEventId, selectedEventId, onEventHover, onEventClick,
}: TemplateMarkerProps) {
  const cx = xScale(event.tick + 0.5);
  const cy = chartBottom - 10 - event.stackIndex * MARKER_STACK_OFFSET;
  const isHovered = event.uniqueId === hoveredEventId;
  const isSelected = event.uniqueId === selectedEventId;
  const { size, opacity } = markerAppearance(isSelected, isHovered, MARKER_SIZE);

  const h = size * 0.866;
  const points = `${cx},${cy - size * 0.6} ${cx - h * 0.6},${cy + size * 0.4} ${cx + h * 0.6},${cy + size * 0.4}`;
  const showBadge = event.stackIndex === event.totalAtTick - 1 && event.totalAtTick > 3;

  return (
    <g
      key={event.uniqueId}
      className="st-event-marker"
      onMouseEnter={() => onEventHover(event.uniqueId)}
      onMouseLeave={() => onEventHover(null)}
      onClick={(e) => { e.stopPropagation(); onEventClick(event.uniqueId); }}
    >
      <polygon
        points={points}
        fill={event.color}
        fillOpacity={opacity}
        stroke={strokeColor(isSelected, isHovered, event.color)}
        strokeWidth={isSelected ? 2 : 1}
      />
      {showBadge && (
        <CountBadge cx={cx} cy={cy} count={event.totalAtTick} color={event.color} />
      )}
    </g>
  );
}

interface CountBadgeProps {
  cx: number;
  cy: number;
  count: number;
  color: string;
}

function CountBadge({ cx, cy, count, color }: CountBadgeProps) {
  return (
    <g>
      <circle cx={cx + 8} cy={cy - 6} r={7} fill="rgba(0,0,0,0.8)" stroke={color} strokeWidth={1} />
      <text x={cx + 8} y={cy - 6} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={9} fontWeight={600}>
        {count}
      </text>
    </g>
  );
}

interface SystemMarkerProps {
  event: SystemEventMarker;
  xScale: LinearScale;
  margin: ChartMargin;
  chartBottom: number;
  hoveredEventId: string | null;
  selectedEventId: string | null;
  onEventHover: (id: string | null) => void;
  onEventClick: (id: string) => void;
}

function StarMarker({
  cx, cy, size, opacity, event, chartBottom, isSelected, isHovered,
  onEventHover, onEventClick,
}: {
  cx: number; cy: number; size: number; opacity: number;
  event: SystemEventMarker; chartBottom: number;
  isSelected: boolean; isHovered: boolean;
  onEventHover: (id: string | null) => void;
  onEventClick: (id: string) => void;
}) {
  const outerRadius = size * 0.8;
  const innerRadius = size * 0.4;
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    pts.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
  }

  return (
    <g
      key={event.uniqueId}
      className="st-event-marker"
      onMouseEnter={() => onEventHover(event.uniqueId)}
      onMouseLeave={() => onEventHover(null)}
      onClick={(e) => { e.stopPropagation(); onEventClick(event.uniqueId); }}
    >
      <polygon
        points={pts.join(" ")}
        fill={event.color}
        fillOpacity={opacity}
        stroke={strokeColor(isSelected, isHovered, event.color)}
        strokeWidth={isSelected ? 2 : 1}
      />
      <line
        x1={cx} y1={cy + outerRadius} x2={cx} y2={chartBottom}
        stroke={event.color} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.5}
      />
    </g>
  );
}

function DiamondMarker({
  cx, cy, size, opacity, event, isSelected, isHovered,
  onEventHover, onEventClick,
}: {
  cx: number; cy: number; size: number; opacity: number;
  event: SystemEventMarker; isSelected: boolean; isHovered: boolean;
  onEventHover: (id: string | null) => void;
  onEventClick: (id: string) => void;
}) {
  const halfSize = size * 0.6;
  const pts = `${cx},${cy - halfSize} ${cx + halfSize},${cy} ${cx},${cy + halfSize} ${cx - halfSize},${cy}`;

  return (
    <g
      key={event.uniqueId}
      className="st-event-marker"
      onMouseEnter={() => onEventHover(event.uniqueId)}
      onMouseLeave={() => onEventHover(null)}
      onClick={(e) => { e.stopPropagation(); onEventClick(event.uniqueId); }}
    >
      <polygon
        points={pts}
        fill={event.color}
        fillOpacity={opacity}
        stroke={strokeColor(isSelected, isHovered, event.color)}
        strokeWidth={isSelected ? 2 : 1}
      />
    </g>
  );
}

function SystemMarker({
  event, xScale, margin, chartBottom, hoveredEventId, selectedEventId,
  onEventHover, onEventClick,
}: SystemMarkerProps) {
  const cx = xScale(event.tick + 0.5);
  const cy = margin.top - 10 - event.stackIndex * MARKER_STACK_OFFSET;
  const isHovered = event.uniqueId === hoveredEventId;
  const isSelected = event.uniqueId === selectedEventId;
  const { size, opacity } = markerAppearance(isSelected, isHovered, MARKER_SIZE);

  if (event.isEraTransition) {
    return (
      <StarMarker
        cx={cx} cy={cy} size={size} opacity={opacity}
        event={event} chartBottom={chartBottom}
        isSelected={isSelected} isHovered={isHovered}
        onEventHover={onEventHover} onEventClick={onEventClick}
      />
    );
  }

  return (
    <DiamondMarker
      cx={cx} cy={cy} size={size} opacity={opacity}
      event={event} isSelected={isSelected} isHovered={isHovered}
      onEventHover={onEventHover} onEventClick={onEventClick}
    />
  );
}

interface ActionMarkerProps {
  event: ActionEventMarker;
  xScale: LinearScale;
  yScale: LinearScale;
  hoveredEventId: string | null;
  selectedEventId: string | null;
  onEventHover: (id: string | null) => void;
  onEventClick: (id: string) => void;
}

function ActionMarker({
  event, xScale, yScale, hoveredEventId, selectedEventId, onEventHover, onEventClick,
}: ActionMarkerProps) {
  const cx = xScale(event.tick + 0.5);
  const baseY = yScale(-60);
  const cy = baseY - event.stackIndex * MARKER_STACK_OFFSET;
  const isHovered = event.uniqueId === hoveredEventId;
  const isSelected = event.uniqueId === selectedEventId;
  const { size: rawSize, opacity } = markerAppearance(isSelected, isHovered, MARKER_SIZE);

  let radius: number;
  if (isSelected) radius = 6;
  else if (isHovered) radius = 5;
  else radius = 4;
  // rawSize is used only for consistency; actual radii are specific for circles
  void rawSize;

  const showBadge = event.stackIndex === event.totalAtTick - 1 && event.totalAtTick > 3;

  return (
    <g
      key={event.uniqueId}
      className="st-event-marker"
      onMouseEnter={() => onEventHover(event.uniqueId)}
      onMouseLeave={() => onEventHover(null)}
      onClick={(e) => { e.stopPropagation(); onEventClick(event.uniqueId); }}
    >
      <circle
        cx={cx} cy={cy} r={radius}
        fill={event.color} fillOpacity={opacity}
        stroke={strokeColor(isSelected, isHovered, event.color)}
        strokeWidth={isSelected ? 2 : 1}
      />
      {showBadge && (
        <CountBadge cx={cx} cy={cy} count={event.totalAtTick} color={event.color} />
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Scroll slider
// ---------------------------------------------------------------------------

interface ScrollSliderProps {
  maxScrollOffset: number;
  currentOffset: number;
  visibleData: PressureDataPoint[];
  totalCount: number;
  onScrollChange: (offset: number) => void;
}

function ScrollSlider({
  maxScrollOffset, currentOffset, visibleData, totalCount, onScrollChange,
}: ScrollSliderProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onScrollChange(parseInt(e.target.value, 10)),
    [onScrollChange]
  );

  if (maxScrollOffset <= 0) return null;

  return (
    <div className="lw-trace-view-scroll st-section-spaced">
      <span className="lw-trace-view-scroll-label">
        Ticks {visibleData[0]?.tick ?? 0}-{visibleData[visibleData.length - 1]?.tick ?? 0}
      </span>
      <input
        type="range"
        min={0}
        max={maxScrollOffset}
        value={currentOffset}
        onChange={handleChange}
        className="lw-trace-view-scroll-slider"
      />
      <span className="lw-trace-view-scroll-label">of {totalCount} total</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tooltip overlay
// ---------------------------------------------------------------------------

interface HoverTooltipProps {
  tooltip: TooltipData | null;
}

function HoverTooltip({ tooltip }: HoverTooltipProps) {
  if (!tooltip) return null;

  return (
    <div
      className="lw-trace-view-tooltip st-tooltip-fixed"
      style={{
        "--st-tooltip-left": `${tooltip.x + 15}px`,
        "--st-tooltip-top": `${tooltip.y - 10}px`,
      } as React.CSSProperties}
    >
      <div className="lw-trace-view-tooltip-header">
        Tick {tooltip.tick}
        {tooltip.epoch !== undefined && <span> / E{tooltip.epoch}</span>}
      </div>
      {tooltip.pressures?.map((p, i) => (
        <div key={i} className="lw-trace-view-tooltip-row">
          <span
            className="st-pressure-swatch"
            style={{ "--st-swatch-color": p.color } as React.CSSProperties}
          />
          <span className="st-tooltip-name">{p.name}</span>
          <span className="st-tooltip-value">{p.value?.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TraceVisualization({
  width,
  height,
  pressureData,
  pressureIds,
  eventData,
  eraBoundaries,
  hiddenPressures,
  interaction,
  callbacks,
}: TraceVisualizationProps) {
  const { selectedTick, lockedTick, hoveredEventId, selectedEventId, scrollOffset } = interaction;
  const { onTickHover, onTickClick, onEventHover, onEventClick, onScrollChange } = callbacks;
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  // Layout
  const eraTimelineY = DEFAULT_MARGIN.top;
  const chartTop = eraTimelineY + ERA_TIMELINE_HEIGHT + 8;
  const chartBottom = height - X_AXIS_LABEL_SPACE - BOTTOM_PADDING;
  const pressureChartHeight = chartBottom - chartTop;

  const margin = useMemo<ChartMargin>(
    () => ({ ...DEFAULT_MARGIN, top: chartTop, bottom: height - chartBottom }),
    [chartTop, chartBottom, height]
  );

  // Scrolling
  const { visibleData, maxScrollOffset, currentOffset } = useMemo(() => {
    if (pressureData.length <= VISIBLE_TICKS) {
      return { visibleData: pressureData, maxScrollOffset: 0, currentOffset: 0 };
    }
    const maxOffset = pressureData.length - VISIBLE_TICKS;
    const offset = scrollOffset === null ? maxOffset : Math.min(scrollOffset, maxOffset);
    return {
      visibleData: pressureData.slice(offset, offset + VISIBLE_TICKS),
      maxScrollOffset: maxOffset,
      currentOffset: offset,
    };
  }, [pressureData, scrollOffset]);

  // Visible event/era filtering
  const visibleEvents = useMemo(() => {
    if (!visibleData.length) return eventData;
    const startTick = visibleData[0]?.tick ?? 0;
    const endTick = visibleData[visibleData.length - 1]?.tick ?? Infinity;
    const inRange = (e: { tick: number }) => e.tick >= startTick && e.tick <= endTick;
    return {
      template: eventData.template.filter(inRange),
      system: eventData.system.filter(inRange),
      action: eventData.action.filter(inRange),
    };
  }, [eventData, visibleData]);

  const visibleEraBoundaries = useMemo(() => {
    if (!visibleData.length) return eraBoundaries;
    const startTick = visibleData[0]?.tick ?? 0;
    const endTick = visibleData[visibleData.length - 1]?.tick ?? Infinity;
    return eraBoundaries
      .filter((era) => era.endTick >= startTick && era.startTick <= endTick)
      .map((era) => ({
        ...era,
        startTick: Math.max(era.startTick, startTick),
        endTick: Math.min(era.endTick, endTick),
      }));
  }, [eraBoundaries, visibleData]);

  // Scales
  const xScale = useMemo(
    () => createXScale(visibleData, width, margin),
    [visibleData, width, margin]
  );
  const yScale = useMemo(
    () => createPressureYScale(visibleData, pressureIds, chartBottom, margin),
    [visibleData, pressureIds, chartBottom, margin]
  );

  // Mouse tracking
  const lastHoverRef = useRef(0);

  const findClosestPoint = useCallback(
    (clientX: number, rectBounds: DOMRect) => {
      const xInRect = clientX - rectBounds.left;
      const xInSvg = xInRect + margin.left;
      const tickValue = xScale.invert(xInSvg);
      return visibleData.reduce((closest, point) =>
        Math.abs(point.tick - tickValue) < Math.abs(closest.tick - tickValue) ? point : closest
      , visibleData[0]);
    },
    [xScale, visibleData, margin.left]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (lockedTick !== null) { setTooltip(null); return; }
      const now = Date.now();
      if (now - lastHoverRef.current < THROTTLE_MS) return;
      lastHoverRef.current = now;

      const closestPoint = findClosestPoint(event.clientX, event.currentTarget.getBoundingClientRect());
      if (!closestPoint) return;

      onTickHover(closestPoint.tick);
      const pressureValues = pressureIds
        .filter((id) => !hiddenPressures.has(id))
        .map((id, i) => ({
          name: (closestPoint[`${id}_name`] as string) ?? id,
          value: closestPoint[id] as number | undefined,
          color: PRESSURE_COLORS[i % PRESSURE_COLORS.length],
        }));

      setTooltip({
        x: event.clientX,
        y: event.clientY,
        tick: closestPoint.tick,
        epoch: closestPoint.epoch as number | undefined,
        pressures: pressureValues,
      });
    },
    [lockedTick, onTickHover, findClosestPoint, pressureIds, hiddenPressures]
  );

  const handleMouseLeave = useCallback(() => {
    if (lockedTick === null) setTooltip(null);
  }, [lockedTick]);

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      const closestPoint = findClosestPoint(event.clientX, event.currentTarget.getBoundingClientRect());
      if (closestPoint) onTickClick(closestPoint.tick);
    },
    [findClosestPoint, onTickClick]
  );

  return (
    <div className="st-trace-layout">
      <div className="st-trace-chart-wrap">
        <svg width={width} height={height} className="st-trace-svg">
          <EraTimeline
            eraBoundaries={visibleEraBoundaries}
            xScale={xScale}
            y={eraTimelineY}
            height={ERA_TIMELINE_HEIGHT}
            width={width}
            margin={margin}
          />

          {pressureChartHeight > 0 &&
            visibleEraBoundaries.map((era, i) => {
              const eraWidth = xScale(era.endTick) - xScale(era.startTick);
              if (eraWidth <= 0) return null;
              return (
                <rect
                  key={`era-bg-${i}`}
                  x={xScale(era.startTick)}
                  y={margin.top}
                  width={eraWidth}
                  height={pressureChartHeight}
                  fill={ERA_COLORS[i % ERA_COLORS.length]}
                />
              );
            })}

          <PressureChart
            data={visibleData}
            pressureIds={pressureIds}
            hiddenPressures={hiddenPressures}
            xScale={xScale}
            yScale={yScale}
            margin={margin}
            height={chartBottom}
            width={width}
          />

          {lockedTick !== null && visibleData.some((d) => d.tick === lockedTick) && (
            <line
              x1={xScale(lockedTick)} y1={margin.top}
              x2={xScale(lockedTick)} y2={chartBottom}
              stroke="#22c55e" strokeWidth={2}
            />
          )}
          {lockedTick === null && selectedTick !== null && visibleData.some((d) => d.tick === selectedTick) && (
            <line
              x1={xScale(selectedTick)} y1={margin.top}
              x2={xScale(selectedTick)} y2={chartBottom}
              stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4"
            />
          )}

          <rect
            x={margin.left} y={margin.top}
            width={Math.max(0, width - margin.left - margin.right)}
            height={Math.max(0, pressureChartHeight)}
            fill="transparent"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
          />

          {visibleEvents.template.map((event) => (
            <TemplateMarker
              key={event.uniqueId} event={event} xScale={xScale}
              chartBottom={chartBottom} hoveredEventId={hoveredEventId}
              selectedEventId={selectedEventId}
              onEventHover={onEventHover} onEventClick={onEventClick}
            />
          ))}

          {visibleEvents.system.map((event) => (
            <SystemMarker
              key={event.uniqueId} event={event} xScale={xScale}
              margin={margin} chartBottom={chartBottom}
              hoveredEventId={hoveredEventId} selectedEventId={selectedEventId}
              onEventHover={onEventHover} onEventClick={onEventClick}
            />
          ))}

          {visibleEvents.action.map((event) => (
            <ActionMarker
              key={event.uniqueId} event={event} xScale={xScale} yScale={yScale}
              hoveredEventId={hoveredEventId} selectedEventId={selectedEventId}
              onEventHover={onEventHover} onEventClick={onEventClick}
            />
          ))}
        </svg>
      </div>

      <ScrollSlider
        maxScrollOffset={maxScrollOffset}
        currentOffset={currentOffset}
        visibleData={visibleData}
        totalCount={pressureData.length}
        onScrollChange={onScrollChange}
      />

      <HoverTooltip tooltip={tooltip} />
    </div>
  );
}
