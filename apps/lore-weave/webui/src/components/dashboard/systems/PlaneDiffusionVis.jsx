/**
 * PlaneDiffusionVis - 2D scalar field visualization for plane diffusion systems
 *
 * Shows:
 * - Heatmap of diffusion values across the 2D plane (from raw grid data)
 * - Source entities (emitters) as red markers
 * - Sink entities (absorbers) as blue markers
 * - Diverging color gradient: blue (negative) → white (zero) → red (positive)
 *
 * Values are in -100 to 100 range (same as pressure values).
 * Grid is 100x100 matching the semantic coordinate space.
 */

import React, { useMemo, useState, useCallback, useRef } from 'react';
import { Group } from '@visx/group';
import { scaleLinear } from '@visx/scale';
import { ParentSize } from '@visx/responsive';
import './visualizations.css';

const MARGIN = { top: 20, right: 20, bottom: 40, left: 40 };

// Diverging color scale: blue (negative) → white (zero) → red (positive)
const COLOR_STOPS = [
  { offset: 0, color: '#2166ac' },      // -100: deep blue
  { offset: 0.25, color: '#67a9cf' },   // -50: light blue
  { offset: 0.5, color: '#f7f7f7' },    // 0: white/neutral
  { offset: 0.75, color: '#ef8a62' },   // +50: light red
  { offset: 1, color: '#b2182b' },      // +100: deep red
];

/**
 * Interpolate color based on normalized value (0-1)
 */
function interpolateColor(t) {
  // Clamp t to [0, 1]
  t = Math.max(0, Math.min(1, t));

  // Find the two stops to interpolate between
  let lower = COLOR_STOPS[0];
  let upper = COLOR_STOPS[COLOR_STOPS.length - 1];

  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (t >= COLOR_STOPS[i].offset && t <= COLOR_STOPS[i + 1].offset) {
      lower = COLOR_STOPS[i];
      upper = COLOR_STOPS[i + 1];
      break;
    }
  }

  // Interpolate within the segment
  const segmentT = (t - lower.offset) / (upper.offset - lower.offset);

  // Parse hex colors
  const parseHex = (hex) => ({
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  });

  const lc = parseHex(lower.color);
  const uc = parseHex(upper.color);

  const r = Math.round(lc.r + (uc.r - lc.r) * segmentT);
  const g = Math.round(lc.g + (uc.g - lc.g) * segmentT);
  const b = Math.round(lc.b + (uc.b - lc.b) * segmentT);

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Convert raw value (-100 to 100) to normalized (0-1) for color lookup
 */
function normalizeValue(value, minValue = -100, maxValue = 100) {
  return (value - minValue) / (maxValue - minValue);
}

/**
 * Symmetric log transform - handles both positive and negative values
 * Maps value to a log scale while preserving sign
 */
function symlog(value, threshold = 1) {
  if (Math.abs(value) < threshold) {
    return value / threshold * 0.5; // Linear region near zero
  }
  const sign = value > 0 ? 1 : -1;
  return sign * (0.5 + Math.log10(Math.abs(value) / threshold) / Math.log10(100 / threshold) * 0.5);
}

/**
 * Normalize value using symmetric log scale for better visualization of exponential decay
 * Returns 0-1 where 0.5 = zero, 0 = -100, 1 = +100
 */
function normalizeValueLog(value) {
  // symlog returns roughly -1 to 1
  const logged = symlog(value, 1);
  // Map to 0-1 range
  return (logged + 1) / 2;
}

/**
 * Gradient legend component with diverging scale
 */
function GradientLegend({ title, minLabel, maxLabel, centerLabel }) {
  const gradientStyle = {
    background: `linear-gradient(to right, ${COLOR_STOPS.map(s => s.color).join(', ')})`,
  };

  return (
    <div className="vis-legend vis-legend-gradient">
      <div className="vis-legend-title">{title}</div>
      <div className="vis-legend-gradient-bar" style={gradientStyle} />
      <div className="vis-legend-gradient-labels">
        <span>{minLabel}</span>
        <span>{centerLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

/**
 * Main visualization component - renders raw grid data directly
 */
function DiffusionFieldChart({ width, height, gridData, gridSize, valueRange, sources, sinks, entities, useLogScale }) {
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef(null);

  const availableWidth = width - MARGIN.left - MARGIN.right;
  const availableHeight = height - MARGIN.top - MARGIN.bottom;

  // Use square aspect ratio - take the smaller dimension
  const squareSize = Math.min(availableWidth, availableHeight);
  const innerWidth = squareSize;
  const innerHeight = squareSize;

  // Center the square in available space
  const offsetX = (availableWidth - squareSize) / 2;
  const offsetY = (availableHeight - squareSize) / 2;

  // Determine display grid resolution (downsample if needed for performance)
  const displayGridSize = Math.min(gridSize, 100);
  const sampleStep = gridSize / displayGridSize;

  // Process grid data into downsampled 2D array for rendering
  const field = useMemo(() => {
    if (!gridData || !gridData.length) return [];

    const result = [];
    for (let y = 0; y < displayGridSize; y++) {
      const row = [];
      for (let x = 0; x < displayGridSize; x++) {
        // Sample from the flat array (row-major order)
        const srcY = Math.floor(y * sampleStep);
        const srcX = Math.floor(x * sampleStep);
        const idx = srcY * gridSize + srcX;
        row.push(gridData[idx] ?? 0);
      }
      result.push(row);
    }
    return result;
  }, [gridData, gridSize, displayGridSize, sampleStep]);

  // Scales - both map 0-1 to pixel space
  const xScale = scaleLinear({
    domain: [0, 1],
    range: [0, innerWidth],
  });

  const yScale = scaleLinear({
    domain: [0, 1],
    range: [0, innerHeight],
  });

  const cellSize = squareSize / displayGridSize;
  const { min: minValue, max: maxValue } = valueRange || { min: -100, max: 100 };

  // Handle mouse move for tooltip
  const handleMouseMove = useCallback((event) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = event.clientX - rect.left - MARGIN.left - offsetX;
    const relY = event.clientY - rect.top - MARGIN.top - offsetY;
    const x = relX / innerWidth;
    const y = 1 - relY / innerHeight; // Invert Y for coordinate display

    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      const gridX = Math.floor(x * displayGridSize);
      const gridY = Math.floor((1 - y) * displayGridSize);
      const value = field[gridY]?.[gridX] ?? 0;

      // Convert to semantic coordinates (0-100)
      const coordX = (x * 100).toFixed(0);
      const coordY = (y * 100).toFixed(0);

      setTooltip({
        x: event.clientX,
        y: event.clientY,
        coords: { x: coordX, y: coordY },
        value: value.toFixed(1),
      });
    }
  }, [innerWidth, innerHeight, displayGridSize, field, offsetX, offsetY]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  // Convert from data Y (0=bottom, 1=top) to SVG Y (0=top)
  const dataYToSvgY = (dataY) => innerHeight - yScale(dataY);

  return (
    <>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="plane-diffusion-vis"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id="diffusionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            {COLOR_STOPS.map((stop, i) => (
              <stop key={i} offset={`${stop.offset * 100}%`} stopColor={stop.color} />
            ))}
          </linearGradient>
        </defs>

        <Group left={MARGIN.left + offsetX} top={MARGIN.top + offsetY}>
          {/* Background */}
          <rect
            x={0}
            y={0}
            width={innerWidth}
            height={innerHeight}
            fill="#1e293b"
          />

          {/* Heatmap cells - Y is inverted: grid row 0 corresponds to data Y=1 (top) */}
          {field.map((row, yi) =>
            row.map((value, xi) => (
              <rect
                key={`${xi}-${yi}`}
                x={xi * cellSize}
                y={(displayGridSize - 1 - yi) * cellSize}
                width={cellSize + 0.5}
                height={cellSize + 0.5}
                fill={interpolateColor(useLogScale ? normalizeValueLog(value) : normalizeValue(value, minValue, maxValue))}
                fillOpacity={0.9}
              />
            ))
          )}

          {/* Grid lines (sparse) */}
          {[0.25, 0.5, 0.75].map((t) => (
            <g key={t}>
              <line
                x1={xScale(t)}
                y1={0}
                x2={xScale(t)}
                y2={innerHeight}
                stroke="rgba(255,255,255,0.1)"
                strokeDasharray="2 4"
              />
              <line
                x1={0}
                y1={dataYToSvgY(t)}
                x2={innerWidth}
                y2={dataYToSvgY(t)}
                stroke="rgba(255,255,255,0.1)"
                strokeDasharray="2 4"
              />
            </g>
          ))}

          {/* Source markers */}
          {sources.map((source, i) => (
            <g key={`source-${i}`} transform={`translate(${xScale(source.x)}, ${dataYToSvgY(source.y)})`}>
              <circle
                r={6 + Math.abs(source.strength) / 20}
                className="source-marker"
              />
              <text
                y={-10 - Math.abs(source.strength) / 20}
                textAnchor="middle"
                fill="#ef4444"
                fontSize={10}
                fontWeight={600}
              >
                {source.label || `S${i + 1}`}
              </text>
            </g>
          ))}

          {/* Sink markers */}
          {sinks.map((sink, i) => (
            <g key={`sink-${i}`} transform={`translate(${xScale(sink.x)}, ${dataYToSvgY(sink.y)})`}>
              <rect
                x={-5 - Math.abs(sink.strength) / 25}
                y={-5 - Math.abs(sink.strength) / 25}
                width={10 + Math.abs(sink.strength) / 12}
                height={10 + Math.abs(sink.strength) / 12}
                className="sink-marker"
              />
              <text
                y={-9 - Math.abs(sink.strength) / 25}
                textAnchor="middle"
                fill="#3b82f6"
                fontSize={10}
                fontWeight={600}
              >
                {sink.label || `K${i + 1}`}
              </text>
            </g>
          ))}

          {/* Entity markers (if provided) */}
          {entities?.map((entity, i) => (
            <circle
              key={`entity-${i}`}
              cx={xScale(entity.x)}
              cy={dataYToSvgY(entity.y)}
              r={4}
              fill={entity.fieldValue > 0 ? '#ef4444' : entity.fieldValue < 0 ? '#3b82f6' : '#94a3b8'}
              fillOpacity={0.7}
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={1}
            />
          ))}

          {/* Axis labels */}
          <text
            x={innerWidth / 2}
            y={innerHeight + 30}
            textAnchor="middle"
            fill="#64748b"
            fontSize={11}
          >
            X Coordinate
          </text>
          <text
            x={-innerHeight / 2}
            y={-25}
            textAnchor="middle"
            fill="#64748b"
            fontSize={11}
            transform="rotate(-90)"
          >
            Y Coordinate
          </text>
        </Group>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="vis-tooltip"
          style={{
            left: tooltip.x + 15,
            top: tooltip.y - 10,
          }}
        >
          <div className="vis-tooltip-header">Position ({tooltip.coords.x}, {tooltip.coords.y})</div>
          <div className="vis-tooltip-row">
            <span className="vis-tooltip-label">Field Value</span>
            <span className="vis-tooltip-value">{tooltip.value}</span>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Main exported component with responsive wrapper
 *
 * @param {boolean} autoScaleColors - If true, scale colors to actual min/max instead of fixed -100/100
 */
export function PlaneDiffusionVis({ config, systemActions, selectedTick, autoScaleColors = false }) {
  // Find the snapshot for the selected tick (or most recent if no tick selected)
  const snapshot = useMemo(() => {
    if (!systemActions?.length) return null;

    // Filter to actions from this system that have diffusion snapshots
    const validActions = systemActions.filter(a => a.details?.diffusionSnapshot);
    if (!validActions.length) return null;

    // If selectedTick is specified, find closest action at or before that tick
    // If no snapshot exists yet at that tick, return null (don't show future data)
    if (selectedTick !== undefined && selectedTick !== null) {
      const atOrBefore = validActions.filter(a => a.tick <= selectedTick);
      if (atOrBefore.length > 0) {
        return atOrBefore[atOrBefore.length - 1].details.diffusionSnapshot;
      }
      // No snapshot at or before selected tick - return null
      return null;
    }

    // No tick selected - return most recent snapshot
    return validActions[validActions.length - 1].details.diffusionSnapshot;
  }, [systemActions, selectedTick]);

  // Extract data from snapshot
  const { gridData, gridSize, valueRange, gridStats, sources, sinks, entities: entityData } = useMemo(() => {
    if (!snapshot) {
      return { gridData: null, gridSize: 100, valueRange: { min: -100, max: 100 }, gridStats: null, sources: [], sinks: [], entities: [] };
    }

    // Use fixed coordinate system (0-100 is the semantic plane range)
    const PLANE_RANGE = 100;

    const normalize = (p) => ({
      ...p,
      x: p.x / PLANE_RANGE,
      y: p.y / PLANE_RANGE,
    });

    // Determine color scale range
    let effectiveRange = snapshot.valueRange || { min: -100, max: 100 };
    if (autoScaleColors && snapshot.gridStats) {
      // Use actual data range for better visibility of small values
      const { min, max } = snapshot.gridStats;
      // Add small padding and ensure we don't have a zero-width range
      const padding = Math.max(1, (max - min) * 0.05);
      effectiveRange = {
        min: min - padding,
        max: max + padding,
      };
    }

    return {
      gridData: snapshot.grid,
      gridSize: snapshot.gridSize || 100,
      valueRange: effectiveRange,
      gridStats: snapshot.gridStats || null,
      sources: snapshot.sources.map(s => ({
        ...normalize(s),
        label: s.name?.slice(0, 8) || 'S',
      })),
      sinks: (snapshot.sinks || []).map(k => ({
        ...normalize(k),
        label: k.name?.slice(0, 8) || 'K',
      })),
      entities: snapshot.entities.map(e => ({
        ...normalize(e),
        fieldValue: e.fieldValue,
      })),
    };
  }, [snapshot, autoScaleColors]);

  if (!config) {
    return (
      <div className="vis-empty">
        <div className="vis-empty-icon">&#9783;</div>
        <div>No diffusion configuration</div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="vis-empty">
        <div className="vis-empty-icon">&#9783;</div>
        <div>No diffusion data</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
          Run simulation with {config.name} enabled
        </div>
      </div>
    );
  }

  return (
    <div className="vis-container">
      <div className="vis-container-header">
        <div className="vis-container-title">
          {config.name}
          {selectedTick !== undefined && <span style={{ color: '#64748b', marginLeft: 8 }}>Tick {selectedTick}</span>}
        </div>
        <div style={{ fontSize: 11, color: '#64748b' }}>
          {sources.length} sources, {sinks.length} sinks, {entityData.length} entities
          {gridStats && (
            <span style={{ marginLeft: 12 }}>
              | min: {gridStats.min?.toFixed(1)} max: {gridStats.max?.toFixed(1)} avg: {gridStats.avg?.toFixed(2)} ({gridStats.nonZeroCount} non-zero)
            </span>
          )}
        </div>
      </div>
      <div className="vis-container-body">
        <ParentSize>
          {({ width, height }) => (
            width > 0 && height > 0 && (
              <DiffusionFieldChart
                width={width}
                height={height}
                gridData={gridData}
                gridSize={gridSize}
                valueRange={valueRange}
                sources={sources}
                sinks={sinks}
                entities={entityData}
                useLogScale={autoScaleColors}
              />
            )
          )}
        </ParentSize>
        <GradientLegend
          title={autoScaleColors ? "Field Value (log scale)" : "Field Value"}
          minLabel="-100"
          centerLabel="0"
          maxLabel="+100"
        />
      </div>
    </div>
  );
}

export default PlaneDiffusionVis;
