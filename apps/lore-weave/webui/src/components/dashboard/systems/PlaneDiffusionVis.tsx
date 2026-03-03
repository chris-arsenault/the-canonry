/**
 * PlaneDiffusionVis - 2D scalar field visualization for plane diffusion systems
 */

import React, { useMemo, useState, useCallback, useRef } from "react";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { ParentSize } from "@visx/responsive";
import "./visualizations.css";

const MARGIN = { top: 20, right: 20, bottom: 40, left: 40 };

const COLOR_STOPS = [
  { offset: 0, color: "#2166ac" },
  { offset: 0.25, color: "#67a9cf" },
  { offset: 0.5, color: "#f7f7f7" },
  { offset: 0.75, color: "#ef8a62" },
  { offset: 1, color: "#b2182b" },
];

function interpolateColor(t: number): string {
  t = Math.max(0, Math.min(1, t));

  let lower = COLOR_STOPS[0];
  let upper = COLOR_STOPS[COLOR_STOPS.length - 1];

  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (t >= COLOR_STOPS[i].offset && t <= COLOR_STOPS[i + 1].offset) {
      lower = COLOR_STOPS[i];
      upper = COLOR_STOPS[i + 1];
      break;
    }
  }

  const segmentT = (t - lower.offset) / (upper.offset - lower.offset);

  const parseHex = (hex: string) => ({
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  });

  const lc = parseHex(lower.color);
  const uc = parseHex(upper.color);

  const r = Math.round(lc.r + (uc.r - lc.r) * segmentT);
  const g = Math.round(lc.g + (uc.g - lc.g) * segmentT);
  const b = Math.round(lc.b + (uc.b - lc.b) * segmentT);

  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
}

function normalizeValue(value: number, minValue = -100, maxValue = 100): number {
  return (value - minValue) / (maxValue - minValue);
}

function symlog(value: number, threshold = 1): number {
  if (Math.abs(value) < threshold) return (value / threshold) * 0.5;
  const sign = value > 0 ? 1 : -1;
  return sign * (0.5 + (Math.log10(Math.abs(value) / threshold) / Math.log10(100 / threshold)) * 0.5);
}

function normalizeValueLog(value: number): number {
  const logged = symlog(value, 1);
  return (logged + 1) / 2;
}

interface GradientLegendProps {
  title: string;
  minLabel: string;
  maxLabel: string;
  centerLabel: string;
}

function GradientLegend({ title, minLabel, maxLabel, centerLabel }: Readonly<GradientLegendProps>) {
  const gradientBackground = `linear-gradient(to right, ${COLOR_STOPS.map((s) => s.color).join(", ")})`;

  return (
    <div className="vis-legend vis-legend-gradient">
      <div className="vis-legend-title">{title}</div>
      <div className="vis-legend-gradient-bar vis-legend-gradient-bar-dynamic" style={{ '--vis-gradient-bg': gradientBackground } as React.CSSProperties} />
      <div className="vis-legend-gradient-labels">
        <span>{minLabel}</span>
        <span>{centerLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

interface MarkerPoint {
  x: number;
  y: number;
  strength: number;
  label: string;
}

interface EntityPoint {
  x: number;
  y: number;
  fieldValue: number;
}

interface ValueRange {
  min: number;
  max: number;
}

interface TooltipData {
  x: number;
  y: number;
  coords: { x: string; y: string };
  value: string;
}

interface DiffusionFieldChartProps {
  width: number;
  height: number;
  gridData: number[] | null;
  gridSize: number;
  valueRange: ValueRange;
  sources: MarkerPoint[];
  sinks: MarkerPoint[];
  entities: EntityPoint[];
  useLogScale: boolean;
}

function entityFieldColor(fieldValue: number): string {
  if (fieldValue > 0) return "#ef4444";
  if (fieldValue < 0) return "#3b82f6";
  return "#94a3b8";
}

function DiffusionFieldChart({
  width, height, gridData, gridSize, valueRange, sources, sinks, entities, useLogScale,
}: Readonly<DiffusionFieldChartProps>) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const availableWidth = width - MARGIN.left - MARGIN.right;
  const availableHeight = height - MARGIN.top - MARGIN.bottom;
  const squareSize = Math.min(availableWidth, availableHeight);
  const innerWidth = squareSize;
  const innerHeight = squareSize;
  const offsetX = (availableWidth - squareSize) / 2;
  const offsetY = (availableHeight - squareSize) / 2;
  const displayGridSize = Math.min(gridSize, 100);
  const sampleStep = gridSize / displayGridSize;

  const field = useMemo(() => {
    if (!gridData?.length) return [] as number[][];
    const result: number[][] = [];
    for (let y = 0; y < displayGridSize; y++) {
      const row: number[] = [];
      for (let x = 0; x < displayGridSize; x++) {
        const srcY = Math.floor(y * sampleStep);
        const srcX = Math.floor(x * sampleStep);
        const idx = srcY * gridSize + srcX;
        row.push(gridData[idx] ?? 0);
      }
      result.push(row);
    }
    return result;
  }, [gridData, gridSize, displayGridSize, sampleStep]);

  const xScale = scaleLinear({ domain: [0, 1], range: [0, innerWidth] });
  const yScale = scaleLinear({ domain: [0, 1], range: [0, innerHeight] });

  const cellSize = squareSize / displayGridSize;
  const { min: minValue, max: maxValue } = valueRange;

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const relX = event.clientX - rect.left - MARGIN.left - offsetX;
      const relY = event.clientY - rect.top - MARGIN.top - offsetY;
      const x = relX / innerWidth;
      const y = 1 - relY / innerHeight;

      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
        const gridX = Math.floor(x * displayGridSize);
        const gridY = Math.floor((1 - y) * displayGridSize);
        const value = field[gridY]?.[gridX] ?? 0;

        setTooltip({
          x: event.clientX, y: event.clientY,
          coords: { x: (x * 100).toFixed(0), y: (y * 100).toFixed(0) },
          value: value.toFixed(1),
        });
      }
    },
    [innerWidth, innerHeight, displayGridSize, field, offsetX, offsetY]
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  const dataYToSvgY = (dataY: number) => innerHeight - (yScale(dataY));

  return (
    <>
      <svg ref={svgRef} width={width} height={height} className="plane-diffusion-vis" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
        <defs>
          <linearGradient id="diffusionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            {COLOR_STOPS.map((stop, i) => (
              <stop key={i} offset={`${String(stop.offset * 100)}%`} stopColor={stop.color} />
            ))}
          </linearGradient>
        </defs>

        <Group left={MARGIN.left + offsetX} top={MARGIN.top + offsetY}>
          <rect x={0} y={0} width={innerWidth} height={innerHeight} fill="#1e293b" />

          {field.map((row, yi) =>
            row.map((value, xi) => (
              <rect
                key={`${String(xi)}-${String(yi)}`}
                x={xi * cellSize}
                y={(displayGridSize - 1 - yi) * cellSize}
                width={cellSize + 0.5}
                height={cellSize + 0.5}
                fill={interpolateColor(useLogScale ? normalizeValueLog(value) : normalizeValue(value, minValue, maxValue))}
                fillOpacity={0.9}
              />
            ))
          )}

          {[0.25, 0.5, 0.75].map((t) => (
            <g key={t}>
              <line x1={xScale(t)} y1={0} x2={xScale(t)} y2={innerHeight} stroke="rgba(255,255,255,0.1)" strokeDasharray="2 4" />
              <line x1={0} y1={dataYToSvgY(t)} x2={innerWidth} y2={dataYToSvgY(t)} stroke="rgba(255,255,255,0.1)" strokeDasharray="2 4" />
            </g>
          ))}

          {sources.map((source, i) => (
            <g key={`source-${String(i)}`} transform={`translate(${String(xScale(source.x))}, ${String(dataYToSvgY(source.y))})`}>
              <circle r={6 + Math.abs(source.strength) / 20} className="source-marker" />
              <text y={-10 - Math.abs(source.strength) / 20} textAnchor="middle" fill="#ef4444" fontSize={10} fontWeight={600}>{source.label}</text>
            </g>
          ))}

          {sinks.map((sink, i) => (
            <g key={`sink-${String(i)}`} transform={`translate(${String(xScale(sink.x))}, ${String(dataYToSvgY(sink.y))})`}>
              <rect x={-5 - Math.abs(sink.strength) / 25} y={-5 - Math.abs(sink.strength) / 25} width={10 + Math.abs(sink.strength) / 12} height={10 + Math.abs(sink.strength) / 12} className="sink-marker" />
              <text y={-9 - Math.abs(sink.strength) / 25} textAnchor="middle" fill="#3b82f6" fontSize={10} fontWeight={600}>{sink.label}</text>
            </g>
          ))}

          {entities.map((entity, i) => (
            <circle
              key={`entity-${String(i)}`}
              cx={xScale(entity.x)}
              cy={dataYToSvgY(entity.y)}
              r={4}
              fill={entityFieldColor(entity.fieldValue)}
              fillOpacity={0.7}
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={1}
            />
          ))}

          <text x={innerWidth / 2} y={innerHeight + 30} textAnchor="middle" fill="#64748b" fontSize={11}>X Coordinate</text>
          <text x={-innerHeight / 2} y={-25} textAnchor="middle" fill="#64748b" fontSize={11} transform="rotate(-90)">Y Coordinate</text>
        </Group>
      </svg>

      {tooltip && (
        <div className="vis-tooltip vis-tooltip-dynamic" style={{ '--vis-tooltip-left': `${String(tooltip.x + 15)}px`, '--vis-tooltip-top': `${String(tooltip.y - 10)}px` } as React.CSSProperties}>
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

interface DiffusionSnapshot {
  grid: number[];
  gridSize: number;
  valueRange: ValueRange;
  gridStats: { min: number; max: number; avg: number; nonZeroCount: number } | null;
  sources: Array<{ x: number; y: number; strength: number; name: string }>;
  sinks: Array<{ x: number; y: number; strength: number; name: string }>;
  entities: Array<{ x: number; y: number; fieldValue: number }>;
}

interface SystemAction {
  tick: number;
  details: { diffusionSnapshot: DiffusionSnapshot | null; [key: string]: unknown };
}

interface SystemConfig {
  name: string;
  [key: string]: unknown;
}

interface PlaneDiffusionVisProps {
  config: SystemConfig | null;
  systemActions: SystemAction[];
  selectedTick: number | null;
  autoScaleColors: boolean;
}

export function PlaneDiffusionVis({ config, systemActions, selectedTick, autoScaleColors }: Readonly<PlaneDiffusionVisProps>) {
  const snapshot = useMemo(() => {
    if (!systemActions?.length) return null;
    const validActions = systemActions.filter((a) => a.details?.diffusionSnapshot);
    if (!validActions.length) return null;

    if (selectedTick !== undefined && selectedTick !== null) {
      const atOrBefore = validActions.filter((a) => a.tick <= selectedTick);
      return atOrBefore.length > 0 ? atOrBefore[atOrBefore.length - 1].details.diffusionSnapshot : null;
    }

    return validActions[validActions.length - 1].details.diffusionSnapshot;
  }, [systemActions, selectedTick]);

  interface GridStats { min: number; max: number; avg: number; nonZeroCount: number }
  const { gridData, gridSize, valueRange, gridStats, sources, sinks, entities: entityData } = useMemo((): {
    gridData: number[] | null; gridSize: number; valueRange: ValueRange; gridStats: GridStats | null;
    sources: MarkerPoint[]; sinks: MarkerPoint[]; entities: EntityPoint[];
  } => {
    if (!snapshot) {
      return { gridData: null, gridSize: 100, valueRange: { min: -100, max: 100 } as ValueRange, gridStats: null, sources: [] as MarkerPoint[], sinks: [] as MarkerPoint[], entities: [] as EntityPoint[] };
    }

    const PLANE_RANGE = 100;
    const normalize = <T extends { x: number; y: number }>(p: T) => ({ ...p, x: p.x / PLANE_RANGE, y: p.y / PLANE_RANGE });

    let effectiveRange: ValueRange = snapshot.valueRange || { min: -100, max: 100 };
    if (autoScaleColors && snapshot.gridStats) {
      const { min, max } = snapshot.gridStats;
      const padding = Math.max(1, (max - min) * 0.05);
      effectiveRange = { min: min - padding, max: max + padding };
    }

    return {
      gridData: snapshot.grid,
      gridSize: snapshot.gridSize || 100,
      valueRange: effectiveRange,
      gridStats: snapshot.gridStats || null,
      sources: snapshot.sources.map((s) => ({ ...normalize(s), strength: s.strength, label: s.name?.slice(0, 8) || "S" })),
      sinks: (snapshot.sinks || []).map((k) => ({ ...normalize(k), strength: k.strength, label: k.name?.slice(0, 8) || "K" })),
      entities: snapshot.entities.map((e) => ({ ...normalize(e), fieldValue: e.fieldValue })),
    };
  }, [snapshot, autoScaleColors]);

  if (!config) return (<div className="vis-empty"><div className="vis-empty-icon">&#9783;</div><div>No diffusion configuration</div></div>);
  if (!snapshot) return (<div className="vis-empty"><div className="vis-empty-icon">&#9783;</div><div>No diffusion data</div><div className="vis-info-hint">Run simulation with {config.name} enabled</div></div>);

  return (
    <div className="vis-container">
      <div className="vis-container-header">
        <div className="vis-container-title">
          {config.name}
          {selectedTick !== undefined && <span className="vis-subtitle">Tick {selectedTick}</span>}
        </div>
        <div className="vis-info-text">
          {sources.length} sources, {sinks.length} sinks, {entityData.length} entities
          {gridStats && (
            <span className="vis-info-stats">
              | min: {gridStats.min.toFixed(1)} max: {gridStats.max.toFixed(1)} avg: {gridStats.avg.toFixed(2)} ({gridStats.nonZeroCount} non-zero)
            </span>
          )}
        </div>
      </div>
      <div className="vis-container-body">
        <ParentSize>
          {({ width, height }) =>
            width > 0 && height > 0 && (
              <DiffusionFieldChart width={width} height={height} gridData={gridData} gridSize={gridSize} valueRange={valueRange} sources={sources} sinks={sinks} entities={entityData} useLogScale={autoScaleColors} />
            )
          }
        </ParentSize>
        <GradientLegend title={autoScaleColors ? "Field Value (log scale)" : "Field Value"} minLabel="-100" centerLabel="0" maxLabel="+100" />
      </div>
    </div>
  );
}

export default PlaneDiffusionVis;
