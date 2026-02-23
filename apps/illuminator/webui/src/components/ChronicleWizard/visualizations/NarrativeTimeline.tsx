/**
 * NarrativeTimeline - Visual timeline with era swim lanes and event cards
 *
 * Replaces checkbox lists with a visual timeline showing:
 * - Era bands as colored horizontal lanes
 * - Event cards positioned by tick, height by significance
 * - Click to select/deselect events
 * - Hover for full details
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import {
  type TimelineEvent,
  type EraRange,
  type CastMarker,
  computeTimelineExtent,
  tickToX,
  getEventFill,
  getEventHeight,
  getCastMarkerShape,
  getCastMarkerColor,
} from '../../../lib/chronicle/timelineUtils';

interface NarrativeTimelineProps {
  events: TimelineEvent[];
  eraRanges: EraRange[];
  width: number;
  height: number;
  /** Callback when event selection toggled */
  onToggleEvent: (eventId: string) => void;
  /** Optional: focal era to highlight */
  focalEraId?: string | null;
  /** Timeline extent [minTick, maxTick] - if not provided, computed from events */
  extent?: [number, number];
  /** Optional cast markers showing when entities were created */
  castMarkers?: CastMarker[];
}

interface TooltipData {
  event: TimelineEvent;
  x: number;
  y: number;
}

interface CastTooltipData {
  marker: CastMarker;
  x: number;
  y: number;
}

export default function NarrativeTimeline({
  events,
  eraRanges,
  width,
  height,
  onToggleEvent,
  focalEraId,
  extent: extentProp,
  castMarkers,
}: NarrativeTimelineProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredEvent, setHoveredEvent] = useState<TooltipData | null>(null);
  const [hoveredCastMarker, setHoveredCastMarker] = useState<CastTooltipData | null>(null);

  const padding = { left: 40, right: 40, top: 24, bottom: 32 };
  const hasCastMarkers = castMarkers && castMarkers.length > 0;
  const castTrackHeight = hasCastMarkers ? 28 : 0;
  const laneHeight = height - padding.top - padding.bottom;
  const eventAreaTop = padding.top + 20; // Leave room for era labels
  const eventAreaHeight = laneHeight - 20 - castTrackHeight;
  const castBaselineY = eventAreaTop + eventAreaHeight + 4;
  const castMarkerCenterY = castBaselineY + 12;

  // Use provided extent or compute from events as fallback
  const extent = useMemo(() => {
    if (extentProp) return extentProp;
    return computeTimelineExtent(events.map(e => ({ tick: e.tick } as any)));
  }, [extentProp, events]);

  // Scale functions
  const scaleX = useCallback(
    (tick: number) => tickToX(tick, extent, width, padding.left),
    [extent, width, padding.left]
  );

  // Position events to avoid overlap using simple row allocation
  const eventPositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number; height: number; row: number }>();
    const rows: Array<{ endX: number }> = [];
    const eventWidth = 24;
    const eventGap = 4;

    // Sort by tick
    const sorted = [...events].sort((a, b) => a.tick - b.tick);

    for (const event of sorted) {
      const x = scaleX(event.tick);
      const eventHeight = getEventHeight(event.significance, 50, 20);

      // Find first available row
      let row = 0;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].endX + eventGap < x) {
          row = i;
          break;
        }
        row = i + 1;
      }

      // Ensure row exists
      while (rows.length <= row) {
        rows.push({ endX: 0 });
      }
      rows[row].endX = x + eventWidth;

      // Calculate y position (stack from bottom)
      const y = eventAreaTop + eventAreaHeight - eventHeight - row * 12;

      positions.set(event.id, { x, y, height: eventHeight, row });
    }

    return positions;
  }, [events, scaleX, eventAreaTop, eventAreaHeight]);

  // Generate tick marks
  const tickMarks = useMemo(() => {
    const [minTick, maxTick] = extent;
    const range = maxTick - minTick;
    const step = Math.ceil(range / 8);
    const marks: number[] = [];

    for (let tick = Math.ceil(minTick / step) * step; tick <= maxTick; tick += step) {
      marks.push(tick);
    }

    return marks;
  }, [extent]);

  const handleEventClick = useCallback(
    (e: React.MouseEvent, eventId: string) => {
      e.stopPropagation();
      onToggleEvent(eventId);
    },
    [onToggleEvent]
  );

  const handleEventHover = useCallback(
    (event: TimelineEvent | null, e?: React.MouseEvent) => {
      if (event && e && svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setHoveredEvent({
          event,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      } else {
        setHoveredEvent(null);
      }
    },
    []
  );

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ display: 'block', background: 'var(--bg-secondary)', borderRadius: '8px' }}
      >
        {/* Era bands */}
        {eraRanges.map((era) => {
          // Clamp era boundaries to the usable timeline area
          const x1 = Math.max(scaleX(era.startTick), padding.left);
          const x2 = Math.min(scaleX(era.endTick), width - padding.right);
          const isFocal = focalEraId === era.id;
          const bandWidth = x2 - x1;

          // Skip eras that fall entirely outside the visible range
          if (bandWidth <= 0) return null;

          return (
            <g key={era.id}>
              {/* Era background band */}
              <rect
                x={x1}
                y={padding.top}
                width={bandWidth}
                height={laneHeight}
                fill={era.color}
                opacity={isFocal ? 0.15 : 0.08}
              />
              {/* Era divider line */}
              <line
                x1={x1}
                y1={padding.top}
                x2={x1}
                y2={height - padding.bottom}
                stroke={era.color}
                strokeWidth={isFocal ? 2 : 1}
                strokeDasharray={isFocal ? 'none' : '4,4'}
              />
              {/* Era label */}
              <text
                x={x1 + 6}
                y={padding.top + 14}
                fontSize="10"
                fontWeight={isFocal ? 600 : 400}
                fill={era.color}
              >
                {era.name}
                {isFocal && ' ★'}
              </text>
            </g>
          );
        })}

        {/* Timeline axis */}
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke="var(--border-color)"
          strokeWidth={1}
        />

        {/* Tick marks */}
        {tickMarks.map((tick) => {
          const x = scaleX(tick);
          return (
            <g key={tick}>
              <line
                x1={x}
                y1={height - padding.bottom}
                x2={x}
                y2={height - padding.bottom + 4}
                stroke="var(--text-muted)"
                strokeWidth={1}
              />
              <text
                x={x}
                y={height - padding.bottom + 16}
                textAnchor="middle"
                fontSize="9"
                fill="var(--text-muted)"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* Event cards */}
        {events.map((event) => {
          const pos = eventPositions.get(event.id);
          if (!pos) return null;

          const fill = getEventFill(event);
          const cardWidth = 20;

          return (
            <g
              key={event.id}
              style={{ cursor: 'pointer' }}
              onClick={(e) => handleEventClick(e, event.id)}
              onMouseEnter={(e) => handleEventHover(event, e)}
              onMouseLeave={() => handleEventHover(null)}
            >
              {/* Event card */}
              <rect
                x={pos.x - cardWidth / 2}
                y={pos.y}
                width={cardWidth}
                height={pos.height}
                rx={3}
                fill={fill}
                opacity={event.selected ? 1 : 0.4}
                stroke={event.selected ? 'white' : 'transparent'}
                strokeWidth={event.selected ? 2 : 0}
              />
              {/* Selection checkmark */}
              {event.selected && (
                <text
                  x={pos.x}
                  y={pos.y + pos.height / 2 + 4}
                  textAnchor="middle"
                  fontSize="12"
                  fill="white"
                  fontWeight="bold"
                  style={{ pointerEvents: 'none' }}
                >
                  ✓
                </text>
              )}
            </g>
          );
        })}

        {/* Cast creation markers */}
        {hasCastMarkers && (
          <g>
            {/* Dashed baseline */}
            <line
              x1={padding.left}
              y1={castBaselineY}
              x2={width - padding.right}
              y2={castBaselineY}
              stroke="var(--border-color)"
              strokeWidth={1}
              strokeDasharray="4,3"
            />
            {/* "Cast" label */}
            <text
              x={padding.left - 4}
              y={castMarkerCenterY + 3}
              textAnchor="end"
              fontSize="9"
              fill="var(--text-muted)"
            >
              Cast
            </text>
            {/* Markers */}
            {castMarkers!.map((marker) => {
              if (typeof marker.createdAt !== 'number' || Number.isNaN(marker.createdAt)) return null;
              const x = scaleX(marker.createdAt);
              const shape = getCastMarkerShape(marker.entityKind);
              const color = getCastMarkerColor(marker.entityKind);
              const isHovered = hoveredCastMarker?.marker.entityId === marker.entityId;

              return (
                <g
                  key={marker.entityId}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    if (svgRef.current) {
                      const rect = svgRef.current.getBoundingClientRect();
                      setHoveredCastMarker({
                        marker,
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                      });
                    }
                  }}
                  onMouseLeave={() => setHoveredCastMarker(null)}
                >
                  {/* Vertical tick from baseline to marker */}
                  <line
                    x1={x}
                    y1={castBaselineY}
                    x2={x}
                    y2={castMarkerCenterY - shape.size / 2}
                    stroke={color}
                    strokeWidth={1}
                    opacity={0.5}
                  />
                  {/* Shape */}
                  <path
                    d={shape.path}
                    transform={`translate(${x}, ${castMarkerCenterY})`}
                    fill={color}
                    opacity={isHovered ? 1 : 0.85}
                    stroke={isHovered ? 'white' : 'transparent'}
                    strokeWidth={1.5}
                  />
                  {/* Primary / entry point ring */}
                  {marker.isPrimary && (
                    <circle
                      cx={x}
                      cy={castMarkerCenterY}
                      r={shape.size / 2 + 3}
                      fill="none"
                      stroke={color}
                      strokeWidth={1}
                      strokeDasharray={marker.isEntryPoint ? 'none' : '2,2'}
                      opacity={0.6}
                    />
                  )}
                  {/* Lens indicator - dotted ring in amber */}
                  {marker.isLens && (
                    <circle
                      cx={x}
                      cy={castMarkerCenterY}
                      r={shape.size / 2 + 3}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth={1}
                      strokeDasharray="1,2"
                      opacity={0.7}
                    />
                  )}
                </g>
              );
            })}
          </g>
        )}

        {/* Axis label */}
        <text
          x={width / 2}
          y={height - 4}
          textAnchor="middle"
          fontSize="10"
          fill="var(--text-muted)"
        >
          Simulation Tick
        </text>
      </svg>

      {/* Tooltip */}
      {hoveredEvent && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(hoveredEvent.x + 12, width - 220),
            top: Math.max(hoveredEvent.y - 60, 8),
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '10px 12px',
            fontSize: '11px',
            maxWidth: '200px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 100,
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>
            {hoveredEvent.event.headline}
          </div>
          <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>
            Tick {hoveredEvent.event.tick} · {hoveredEvent.event.eventKind}
          </div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
            <span
              style={{
                padding: '1px 4px',
                background: 'var(--bg-tertiary)',
                borderRadius: '3px',
                fontSize: '9px',
              }}
            >
              {(hoveredEvent.event.significance * 100).toFixed(0)}% sig
            </span>
            {hoveredEvent.event.involvesEntryPoint && (
              <span
                style={{
                  padding: '1px 4px',
                  background: 'var(--accent-color)',
                  color: 'white',
                  borderRadius: '3px',
                  fontSize: '9px',
                }}
              >
                Entry
              </span>
            )}
          </div>
          {hoveredEvent.event.description && (
            <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
              {hoveredEvent.event.description.length > 120
                ? hoveredEvent.event.description.slice(0, 120) + '...'
                : hoveredEvent.event.description}
            </div>
          )}
          <div
            style={{
              marginTop: '6px',
              fontSize: '9px',
              color: hoveredEvent.event.selected ? 'var(--success)' : 'var(--text-muted)',
            }}
          >
            {hoveredEvent.event.selected ? '✓ Selected' : 'Click to select'}
          </div>
        </div>
      )}

      {/* Cast marker tooltip */}
      {hoveredCastMarker && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(hoveredCastMarker.x + 12, width - 200),
            top: Math.max(hoveredCastMarker.y - 50, 8),
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '8px 10px',
            fontSize: '11px',
            maxWidth: '180px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 100,
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '3px' }}>
            {hoveredCastMarker.marker.entityName}
          </div>
          <div style={{ color: 'var(--text-muted)', marginBottom: '3px', fontSize: '10px' }}>
            {hoveredCastMarker.marker.entityKind}
            {hoveredCastMarker.marker.subtype && ` · ${hoveredCastMarker.marker.subtype}`}
          </div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
            {hoveredCastMarker.marker.role && (
              <span style={{
                padding: '1px 4px',
                background: 'var(--bg-tertiary)',
                borderRadius: '3px',
                fontSize: '9px',
              }}>
                {hoveredCastMarker.marker.role}
              </span>
            )}
            {hoveredCastMarker.marker.isEntryPoint && (
              <span style={{
                padding: '1px 4px',
                background: 'var(--accent-color)',
                color: 'white',
                borderRadius: '3px',
                fontSize: '9px',
              }}>
                Entry Point
              </span>
            )}
            {hoveredCastMarker.marker.isLens && (
              <span style={{
                padding: '1px 4px',
                background: '#f59e0b',
                color: 'white',
                borderRadius: '3px',
                fontSize: '9px',
              }}>
                Lens
              </span>
            )}
            {hoveredCastMarker.marker.isPrimary && !hoveredCastMarker.marker.isEntryPoint && (
              <span style={{
                padding: '1px 4px',
                background: getCastMarkerColor(hoveredCastMarker.marker.entityKind),
                color: 'white',
                borderRadius: '3px',
                fontSize: '9px',
              }}>
                Primary
              </span>
            )}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
            Created at tick {hoveredCastMarker.marker.createdAt}
          </div>
        </div>
      )}
    </div>
  );
}
