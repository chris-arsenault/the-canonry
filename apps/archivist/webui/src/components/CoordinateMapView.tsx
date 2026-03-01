import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { WorldState, HardState, Point, Region } from "../types/world.ts";
import type {
  EntityKindDefinition,
  CircleBounds,
  RectBounds,
  PolygonBounds,
  SemanticAxis,
} from "@canonry/world-schema";
import "./CoordinateMapView.css";

interface CoordinateMapViewProps {
  data: WorldState;
  selectedNodeId?: string;
  onNodeSelect: (nodeId: string | undefined) => void;
}

type CanvasPoint = { x: number; y: number };
type WorldToCanvasFn = (x: number, y: number) => CanvasPoint;
type WorldToCanvasDistFn = (d: number) => number;

interface MapBounds {
  min: number;
  max: number;
}

// ---------------------------------------------------------------------------
// Pure helper functions (outside component)
// ---------------------------------------------------------------------------

function getKindDisplayName(kindDef: EntityKindDefinition): string {
  return kindDef.style?.displayName || kindDef.description || kindDef.kind;
}

function mergeRegions(seed: Region[], emergent: Region[]): Region[] {
  const merged = [...seed];
  const seen = new Set(seed.map((region) => region.id));
  for (const region of emergent) {
    if (!seen.has(region.id)) {
      merged.push(region);
    }
  }
  return merged;
}

function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
  }
  throw new Error(`Archivist: invalid color "${hex}".`);
}

function getRegionColor(region: Region): { fill: string; stroke: string } {
  if (!region.color) {
    throw new Error(`Archivist: region "${region.id}" is missing color.`);
  }
  return {
    fill: hexToRgba(region.color, 0.15),
    stroke: hexToRgba(region.color, 0.7),
  };
}

function getEntityCoords(entity: HardState): Point {
  const coords = entity.coordinates;
  if (!coords || typeof coords.x !== "number" || typeof coords.y !== "number" || typeof coords.z !== "number") {
    throw new Error(`Archivist: entity "${entity.id}" is missing valid coordinates.`);
  }
  return coords;
}

/** Check if a point is inside a region (circle or rect; polygon not supported). */
function isPointInRegion(region: Region, worldX: number, worldY: number): boolean {
  const { bounds } = region;
  if (bounds.shape === "circle") {
    const dx = worldX - bounds.center.x;
    const dy = worldY - bounds.center.y;
    return Math.sqrt(dx * dx + dy * dy) <= bounds.radius;
  }
  if (bounds.shape === "rect") {
    return worldX >= bounds.x1 && worldX <= bounds.x2 && worldY >= bounds.y1 && worldY <= bounds.y2;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Canvas drawing helpers (each handles one visual concern)
// ---------------------------------------------------------------------------

function getRegionStyles(
  colors: { fill: string; stroke: string },
  isHovered: boolean,
  isSelected: boolean
): { fillStyle: string; strokeStyle: string; lineWidth: number; highlighted: boolean } {
  const highlighted = isHovered || isSelected;
  // eslint-disable-next-line sonarjs/slow-regex -- short rgba() string
  const fillStyle = highlighted ? colors.fill.replace(/[\d.]+\)$/, "0.3)") : colors.fill;
  // eslint-disable-next-line sonarjs/slow-regex -- short rgba() string
  const hoverStroke = isHovered ? colors.stroke.replace(/[\d.]+\)$/, "1)") : colors.stroke;
  const strokeStyle = isSelected ? "#ffffff" : hoverStroke;
  const baseWidth = isHovered ? 2.5 : 2;
  const lineWidth = isSelected ? 3 : baseWidth;
  return { fillStyle, strokeStyle, lineWidth, highlighted };
}

function drawCircleRegion(
  ctx: CanvasRenderingContext2D,
  bounds: CircleBounds,
  label: string,
  highlighted: boolean,
  colors: { fill: string; stroke: string },
  worldToCanvas: WorldToCanvasFn,
  worldToCanvasDistance: WorldToCanvasDistFn
): void {
  const center = worldToCanvas(bounds.center.x, bounds.center.y);
  const radiusPixels = worldToCanvasDistance(bounds.radius);
  ctx.beginPath();
  ctx.arc(center.x, center.y, radiusPixels, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = highlighted ? "#ffffff" : colors.stroke;
  ctx.font = highlighted ? "bold 13px sans-serif" : "bold 12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, center.x, center.y);
}

function drawRectRegion(
  ctx: CanvasRenderingContext2D,
  bounds: RectBounds,
  label: string,
  highlighted: boolean,
  colors: { fill: string; stroke: string },
  worldToCanvas: WorldToCanvasFn
): void {
  const topLeft = worldToCanvas(bounds.x1, bounds.y2);
  const bottomRight = worldToCanvas(bounds.x2, bounds.y1);
  ctx.beginPath();
  ctx.rect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = highlighted ? "#ffffff" : colors.stroke;
  ctx.font = highlighted ? "bold 13px sans-serif" : "bold 12px sans-serif";
  ctx.textAlign = "center";
  const centerX = (topLeft.x + bottomRight.x) / 2;
  const centerY = (topLeft.y + bottomRight.y) / 2;
  ctx.fillText(label, centerX, centerY);
}

function drawPolygonRegion(
  ctx: CanvasRenderingContext2D,
  bounds: PolygonBounds,
  worldToCanvas: WorldToCanvasFn
): void {
  const points = bounds.points.map((p) => worldToCanvas(p.x, p.y));
  if (points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawRegion(
  ctx: CanvasRenderingContext2D,
  region: Region,
  hoveredRegion: Region | null | undefined,
  selectedRegionId: string | null,
  worldToCanvas: WorldToCanvasFn,
  worldToCanvasDistance: WorldToCanvasDistFn
): void {
  const colors = getRegionColor(region);
  const styles = getRegionStyles(colors, hoveredRegion?.id === region.id, selectedRegionId === region.id);
  ctx.fillStyle = styles.fillStyle;
  ctx.strokeStyle = styles.strokeStyle;
  ctx.lineWidth = styles.lineWidth;

  const { bounds } = region;
  if (bounds.shape === "circle") {
    drawCircleRegion(ctx, bounds, region.label, styles.highlighted, colors, worldToCanvas, worldToCanvasDistance);
  } else if (bounds.shape === "rect") {
    drawRectRegion(ctx, bounds, region.label, styles.highlighted, colors, worldToCanvas);
  } else if (bounds.shape === "polygon") {
    drawPolygonRegion(ctx, bounds, worldToCanvas);
  }
}

/** Draw the background grid. */
function drawGrid(
  ctx: CanvasRenderingContext2D,
  bounds: MapBounds,
  worldToCanvas: WorldToCanvasFn
): void {
  ctx.strokeStyle = "rgba(59, 130, 246, 0.1)";
  ctx.lineWidth = 1;
  const gridStep = 10;
  for (let i = bounds.min; i <= bounds.max; i += gridStep) {
    const start = worldToCanvas(i, bounds.min);
    const end = worldToCanvas(i, bounds.max);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    const hStart = worldToCanvas(bounds.min, i);
    const hEnd = worldToCanvas(bounds.max, i);
    ctx.beginPath();
    ctx.moveTo(hStart.x, hStart.y);
    ctx.lineTo(hEnd.x, hEnd.y);
    ctx.stroke();
  }
}

/** Draw a single horizontal (X) semantic axis with low/name/high labels. */
function drawXAxisLabels(
  ctx: CanvasRenderingContext2D,
  axis: SemanticAxis,
  bounds: MapBounds,
  worldToCanvas: WorldToCanvasFn
): void {
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";

  ctx.fillStyle = "rgba(252, 107, 107, 0.8)";
  const xLowPos = worldToCanvas(bounds.min + 5, bounds.min);
  ctx.fillText(`\u2190 ${axis.lowTag}`, xLowPos.x + 30, xLowPos.y + 25);

  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  const xCenterPos = worldToCanvas((bounds.min + bounds.max) / 2, bounds.min);
  ctx.fillText(axis.name, xCenterPos.x, xCenterPos.y + 25);

  ctx.fillStyle = "rgba(107, 252, 156, 0.8)";
  const xHighPos = worldToCanvas(bounds.max - 5, bounds.min);
  ctx.fillText(`${axis.highTag} \u2192`, xHighPos.x - 30, xHighPos.y + 25);
}

/** Draw a single vertical (Y) semantic axis with low/name/high labels. */
function drawYAxisLabels(
  ctx: CanvasRenderingContext2D,
  axis: SemanticAxis,
  bounds: MapBounds,
  worldToCanvas: WorldToCanvasFn
): void {
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";

  ctx.save();
  ctx.fillStyle = "rgba(252, 107, 107, 0.8)";
  const yLowPos = worldToCanvas(bounds.min, bounds.min + 5);
  ctx.translate(yLowPos.x - 25, yLowPos.y - 20);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`\u2190 ${axis.lowTag}`, 0, 0);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  const yCenterPos = worldToCanvas(bounds.min, (bounds.min + bounds.max) / 2);
  ctx.translate(yCenterPos.x - 25, yCenterPos.y);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(axis.name, 0, 0);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(107, 252, 156, 0.8)";
  const yHighPos = worldToCanvas(bounds.min, bounds.max - 5);
  ctx.translate(yHighPos.x - 25, yHighPos.y + 20);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`${axis.highTag} \u2192`, 0, 0);
  ctx.restore();
}

/** Draw small numeric reference labels along axes. */
function drawNumericLabels(
  ctx: CanvasRenderingContext2D,
  bounds: MapBounds,
  worldToCanvas: WorldToCanvasFn
): void {
  ctx.fillStyle = "rgba(59, 130, 246, 0.3)";
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  for (let i = bounds.min + 20; i < bounds.max; i += 20) {
    const pos = worldToCanvas(i, bounds.min);
    ctx.fillText(i.toString(), pos.x, pos.y + 12);
    ctx.textAlign = "right";
    const posY = worldToCanvas(bounds.min, i);
    ctx.fillText(i.toString(), posY.x - 5, posY.y + 3);
    ctx.textAlign = "center";
  }
}

/** Draw relationship lines between positioned entities. */
function drawRelationships(
  ctx: CanvasRenderingContext2D,
  relationships: WorldState["relationships"],
  entityPositions: Map<string, { x: number; y: number }>,
  worldToCanvas: WorldToCanvasFn
): void {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1;
  for (const rel of relationships) {
    const srcPos = entityPositions.get(rel.src);
    const dstPos = entityPositions.get(rel.dst);
    if (!srcPos || !dstPos) continue;
    const start = worldToCanvas(srcPos.x, srcPos.y);
    const end = worldToCanvas(dstPos.x, dstPos.y);
    ctx.globalAlpha = (rel.strength ?? 0.5) * 0.5;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/** Draw a single entity dot with optional label and highlight. */
function drawEntityDot(
  ctx: CanvasRenderingContext2D,
  entity: HardState,
  canvasPos: CanvasPoint,
  color: string,
  isPrimaryKind: boolean,
  isSelected: boolean,
  isHovered: boolean
): void {
  const radius = isPrimaryKind ? 8 : 5;
  ctx.beginPath();
  ctx.arc(canvasPos.x, canvasPos.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  if (isPrimaryKind) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (isSelected || isHovered) {
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(canvasPos.x, canvasPos.y, radius + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (isPrimaryKind || isSelected || isHovered) {
    ctx.fillStyle = "#fff";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(entity.name, canvasPos.x, canvasPos.y - radius - 5);
  }
}

// ---------------------------------------------------------------------------
// Force layout
// ---------------------------------------------------------------------------

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  anchored: boolean;
  entity: HardState;
}

function runForceLayout(
  nodes: LayoutNode[],
  relationships: Array<{ src: string; dst: string; strength?: number }>,
  iterations: number = 50
): void {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (let i = 0; i < iterations; i++) {
    for (const n of nodes) {
      if (!n.anchored) { n.vx = 0; n.vy = 0; }
    }
    applyAttraction(relationships, nodeMap);
    applyRepulsion(nodes);
    for (const n of nodes) {
      if (!n.anchored) {
        n.x = Math.max(0, Math.min(100, n.x + n.vx));
        n.y = Math.max(0, Math.min(100, n.y + n.vy));
      }
    }
  }
}

function applyAttraction(
  relationships: Array<{ src: string; dst: string; strength?: number }>,
  nodeMap: Map<string, LayoutNode>
): void {
  for (const rel of relationships) {
    const src = nodeMap.get(rel.src);
    const dst = nodeMap.get(rel.dst);
    if (!src || !dst) continue;
    const dx = dst.x - src.x;
    const dy = dst.y - src.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const strength = (rel.strength ?? 0.5) * 0.1;
    if (!src.anchored) { src.vx += (dx / dist) * strength; src.vy += (dy / dist) * strength; }
    if (!dst.anchored) { dst.vx -= (dx / dist) * strength; dst.vy -= (dy / dist) * strength; }
  }
}

function applyRepulsion(nodes: LayoutNode[]): void {
  for (const a of nodes) {
    if (a.anchored) continue;
    for (const b of nodes) {
      if (a.id === b.id) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dist < 10) {
        const force = 0.5 / dist;
        a.vx += (dx / dist) * force;
        a.vy += (dy / dist) * force;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface MapControlsProps {
  mapKind: string;
  onMapKindChange: (kind: string) => void;
  mappableKinds: string[];
  kindDisplayNames: Map<string, string>;
  mapDescription: string;
  showRelatedKinds: boolean;
  onToggleRelatedKinds: () => void;
  visibleLayers: Set<string>;
  onToggleLayer: (layer: string) => void;
}

function MapControls({
  mapKind,
  onMapKindChange,
  mappableKinds,
  kindDisplayNames,
  mapDescription,
  showRelatedKinds,
  onToggleRelatedKinds,
  visibleLayers,
  onToggleLayer,
}: Readonly<MapControlsProps>) {
  return (
    <div className="coordinate-map-controls">
      <div className="control-section">
        <div className="control-label">Entity Map</div>
        <select value={mapKind} onChange={(e) => onMapKindChange(e.target.value)} className="control-select">
          {mappableKinds.map((kind) => (
            <option key={kind} value={kind}>{kindDisplayNames.get(kind) ?? kind}</option>
          ))}
        </select>
        <div className="control-description">{mapDescription}</div>
      </div>
      <div className="control-section">
        <label className="layer-toggle">
          <input type="checkbox" checked={showRelatedKinds} onChange={onToggleRelatedKinds} />
          <span>Show related entities</span>
        </label>
      </div>
      <div className="control-section">
        <div className="control-label">Layers</div>
        <div className="layer-toggles">
          {["regions", "entities", "relationships"].map((layer) => (
            <label key={layer} className="layer-toggle">
              <input type="checkbox" checked={visibleLayers.has(layer)} onChange={() => onToggleLayer(layer)} />
              <span>{layer}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

interface MapLegendProps {
  entityKindSchemas: EntityKindDefinition[];
  effectiveMapKind: string;
  regions: Region[];
}

function MapLegend({ entityKindSchemas, effectiveMapKind, regions }: Readonly<MapLegendProps>) {
  return (
    <div className="coordinate-map-legend">
      <div className="legend-title">Entity Types</div>
      {entityKindSchemas.map((ek) => {
        if (!ek.style?.color) {
          throw new Error(`Archivist: entity kind "${ek.kind}" is missing style.color.`);
        }
        return (
          <div key={ek.kind} className="legend-item">
            <svg className="legend-dot-svg" viewBox="0 0 12 12" aria-hidden="true">
              <circle cx="6" cy="6" r="5" fill={ek.style.color} stroke={ek.kind === effectiveMapKind ? "#ffffff" : "none"} strokeWidth="2" />
            </svg>
            <span>{ek.description || ek.kind}</span>
            {ek.kind === effectiveMapKind && <span className="anchor-badge">primary</span>}
          </div>
        );
      })}
      {regions.length > 0 && (
        <>
          <div className="legend-divider" />
          <div className="legend-title">Regions ({regions.length})</div>
          {regions.map((region) => {
            if (!region.color) {
              throw new Error(`Archivist: region "${region.id}" is missing color.`);
            }
            return (
              <div key={region.id} className="legend-item">
                <svg className="legend-dot-svg" viewBox="0 0 12 12" aria-hidden="true">
                  <circle cx="6" cy="6" r="5" fill={region.color} />
                </svg>
                <span>{region.label}</span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

interface EntityTooltipProps {
  entity: HardState;
}

function EntityTooltip({ entity }: Readonly<EntityTooltipProps>) {
  const coords = getEntityCoords(entity);
  return (
    <div className="coordinate-map-tooltip coordinate-map-tooltip-fixed">
      <div className="tooltip-name">{entity.name}</div>
      <div className="tooltip-info">{entity.kind} / {entity.subtype}</div>
      <div className="tooltip-info">{entity.status}</div>
      <div className="tooltip-coords">
        x: {coords.x.toFixed(1)}, y: {coords.y.toFixed(1)}, z: {coords.z.toFixed(1)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CoordinateMapView({
  data,
  selectedNodeId,
  onNodeSelect,
}: Readonly<CoordinateMapViewProps>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [mapKind, setMapKind] = useState<string>(() => {
    const firstKind = data.schema.entityKinds.find((kind) => kind.semanticPlane)?.kind;
    return firstKind ?? "";
  });
  const [showRelatedKinds, setShowRelatedKinds] = useState(true);
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set(["regions", "entities", "relationships"]));
  const [hoveredEntity, setHoveredEntity] = useState<HardState | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<Region | null>(null);
  const [mousePos, setMousePos] = useState<CanvasPoint | null>(null);

  // Schema-derived lookups
  const entityKindSchemas = data.schema.entityKinds;
  const kindDisplayNames = useMemo(
    () => new Map(entityKindSchemas.map((kind) => [kind.kind, getKindDisplayName(kind)])),
    [entityKindSchemas]
  );
  const axisDefinitions = useMemo(() => data.schema.axisDefinitions || [], [data.schema.axisDefinitions]);
  const axisById = useMemo(() => new Map(axisDefinitions.map((axis) => [axis.id, axis])), [axisDefinitions]);
  const mappableKindSchemas = useMemo(() => entityKindSchemas.filter((kind) => kind.semanticPlane), [entityKindSchemas]);
  const mappableKinds = useMemo(() => mappableKindSchemas.map((kind) => kind.kind), [mappableKindSchemas]);

  const effectiveMapKind = mappableKinds.includes(mapKind) ? mapKind : mappableKinds[0] ?? mapKind;

  const activeKindDef = mappableKindSchemas.find((kind) => kind.kind === effectiveMapKind);
  if (!activeKindDef?.semanticPlane) {
    throw new Error("Archivist: map view requires a semantic plane on the selected entity kind.");
  }
  const displayName = getKindDisplayName(activeKindDef);
  const planeAxes = activeKindDef.semanticPlane.axes;
  const xAxis = planeAxes?.x?.axisId ? axisById.get(planeAxes.x.axisId) : undefined;
  const yAxis = planeAxes?.y?.axisId ? axisById.get(planeAxes.y.axisId) : undefined;
  if (planeAxes?.x?.axisId && !xAxis) {
    throw new Error(`Archivist: axis "${planeAxes.x.axisId}" not found in schema.axisDefinitions.`);
  }
  if (planeAxes?.y?.axisId && !yAxis) {
    throw new Error(`Archivist: axis "${planeAxes.y.axisId}" not found in schema.axisDefinitions.`);
  }
  const mapDescription = `Coordinate space for ${displayName} entities`;
  const seedRegions = activeKindDef.semanticPlane.regions ?? [];
  const emergentRegions = data.coordinateState?.emergentRegions?.[effectiveMapKind] ?? [];
  const regions = useMemo(() => mergeRegions(seedRegions, emergentRegions), [seedRegions, emergentRegions]);
  const bounds = useMemo<MapBounds>(() => ({ min: 0, max: 100 }), []);

  // Entity filtering and positioning
  const mapEntities = useMemo(() => {
    const primaryEntities = data.hardState.filter((e) => e.kind === effectiveMapKind);
    if (!showRelatedKinds) return primaryEntities;
    const primaryIds = new Set(primaryEntities.map((e) => e.id));
    const relatedIds = new Set<string>();
    for (const rel of data.relationships) {
      if (primaryIds.has(rel.src)) relatedIds.add(rel.dst);
      if (primaryIds.has(rel.dst)) relatedIds.add(rel.src);
    }
    const relatedEntities = data.hardState.filter((e) => relatedIds.has(e.id) && !primaryIds.has(e.id));
    return [...primaryEntities, ...relatedEntities];
  }, [data.hardState, data.relationships, effectiveMapKind, showRelatedKinds]);

  const entityColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const ek of entityKindSchemas) {
      if (!ek.style?.color) {
        throw new Error(`Archivist: entity kind "${ek.kind}" is missing style.color.`);
      }
      map.set(ek.kind, ek.style.color);
    }
    return map;
  }, [entityKindSchemas]);

  const entityPositions = useMemo(() => {
    const nodes: LayoutNode[] = mapEntities.map((entity) => {
      const coords = getEntityCoords(entity);
      return { id: entity.id, x: coords.x, y: coords.y, vx: 0, vy: 0, anchored: entity.kind === effectiveMapKind, entity };
    });
    const visibleIds = new Set(mapEntities.map((e) => e.id));
    const rels = data.relationships
      .filter((r) => visibleIds.has(r.src) && visibleIds.has(r.dst))
      .map((r) => ({ src: r.src, dst: r.dst, strength: r.strength }));
    runForceLayout(nodes, rels);
    return new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y, anchored: n.anchored }]));
  }, [mapEntities, data.relationships, effectiveMapKind]);

  // Coordinate transforms
  const padding = 40;
  const worldRange = bounds.max - bounds.min || 1;
  const availableWidth = Math.max(1, dimensions.width - padding * 2);
  const availableHeight = Math.max(1, dimensions.height - padding * 2);
  const uniformScale = Math.max(0.001, Math.min(availableWidth, availableHeight) / worldRange);
  const offsetX = padding + (availableWidth - worldRange * uniformScale) / 2;
  const offsetY = padding + (availableHeight - worldRange * uniformScale) / 2;

  const worldToCanvas = useCallback(
    (x: number, y: number): CanvasPoint => ({
      x: offsetX + (x - bounds.min) * uniformScale,
      y: dimensions.height - offsetY - (y - bounds.min) * uniformScale,
    }),
    [offsetX, offsetY, bounds.min, uniformScale, dimensions.height]
  );

  const canvasToWorld = useCallback(
    (canvasX: number, canvasY: number): CanvasPoint => ({
      x: bounds.min + (canvasX - offsetX) / uniformScale,
      y: bounds.min + (dimensions.height - offsetY - canvasY) / uniformScale,
    }),
    [offsetX, offsetY, bounds.min, uniformScale, dimensions.height]
  );

  const worldToCanvasDistance = useCallback(
    (worldDistance: number): number => worldDistance * uniformScale,
    [uniformScale]
  );

  // Resize handler
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      }
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Canvas draw effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0a1929";
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    drawGrid(ctx, bounds, worldToCanvas);
    if (xAxis) drawXAxisLabels(ctx, xAxis, bounds, worldToCanvas);
    if (yAxis) drawYAxisLabels(ctx, yAxis, bounds, worldToCanvas);
    drawNumericLabels(ctx, bounds, worldToCanvas);

    const selectedRegionId = selectedNodeId?.startsWith("region:") ? selectedNodeId.split(":")[2] : null;

    if (visibleLayers.has("regions")) {
      for (const region of regions) {
        drawRegion(ctx, region, hoveredRegion, selectedRegionId, worldToCanvas, worldToCanvasDistance);
      }
    }
    if (visibleLayers.has("relationships")) {
      drawRelationships(ctx, data.relationships, entityPositions, worldToCanvas);
    }
    if (visibleLayers.has("entities")) {
      for (const entity of mapEntities) {
        const pos = entityPositions.get(entity.id);
        if (!pos) continue;
        const canvasPos = worldToCanvas(pos.x, pos.y);
        const color = entityColorMap.get(entity.kind);
        if (!color) {
          throw new Error(`Archivist: entity kind "${entity.kind}" is missing style.color.`);
        }
        drawEntityDot(ctx, entity, canvasPos, color, entity.kind === effectiveMapKind, entity.id === selectedNodeId, entity.id === hoveredEntity?.id);
      }
    }
  }, [data, dimensions, effectiveMapKind, visibleLayers, entityPositions, entityColorMap, regions, bounds, selectedNodeId, hoveredEntity, hoveredRegion, mapEntities, xAxis, yAxis, worldToCanvas, worldToCanvasDistance]);

  // Event handlers
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const worldPos = canvasToWorld(e.clientX - rect.left, e.clientY - rect.top);
      setMousePos(worldPos);

      let foundEntity: HardState | null = null;
      let minDist = 3;
      for (const entity of mapEntities) {
        const pos = entityPositions.get(entity.id);
        if (!pos) continue;
        const dx = pos.x - worldPos.x;
        const dy = pos.y - worldPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) { minDist = dist; foundEntity = entity; }
      }
      setHoveredEntity(foundEntity);

      let foundRegion: Region | null = null;
      if (!foundEntity && visibleLayers.has("regions")) {
        for (let i = regions.length - 1; i >= 0; i--) {
          if (isPointInRegion(regions[i], worldPos.x, worldPos.y)) { foundRegion = regions[i]; break; }
        }
      }
      setHoveredRegion(foundRegion);
    },
    [canvasToWorld, mapEntities, entityPositions, visibleLayers, regions]
  );

  const handleClick = useCallback(() => {
    if (hoveredEntity) {
      onNodeSelect(hoveredEntity.id);
    } else if (hoveredRegion) {
      onNodeSelect(`region:${effectiveMapKind}:${hoveredRegion.id}`);
    } else {
      onNodeSelect(undefined);
    }
  }, [hoveredEntity, hoveredRegion, effectiveMapKind, onNodeSelect]);

  const toggleLayer = useCallback((layer: string) => {
    setVisibleLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) { next.delete(layer); } else { next.add(layer); }
      return next;
    });
  }, []);

  const toggleRelatedKinds = useCallback(() => setShowRelatedKinds((prev) => !prev), []);

  return (
    <div className="coordinate-map-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        className={hoveredEntity || hoveredRegion ? "coordinate-map-canvas coordinate-map-canvas-clickable" : "coordinate-map-canvas"}
      />
      <MapControls
        mapKind={mapKind}
        onMapKindChange={setMapKind}
        mappableKinds={mappableKinds}
        kindDisplayNames={kindDisplayNames}
        mapDescription={mapDescription}
        showRelatedKinds={showRelatedKinds}
        onToggleRelatedKinds={toggleRelatedKinds}
        visibleLayers={visibleLayers}
        onToggleLayer={toggleLayer}
      />
      <MapLegend entityKindSchemas={entityKindSchemas} effectiveMapKind={effectiveMapKind} regions={regions} />
      {hoveredEntity && mousePos && <EntityTooltip entity={hoveredEntity} />}
      {mousePos && (
        <div className="coordinate-display">
          x: {mousePos.x.toFixed(1)}, y: {mousePos.y.toFixed(1)}
        </div>
      )}
    </div>
  );
}
