import type { HardState, Region, WorldState } from "../types/world.ts";
import type {
  EntityKindDefinition,
  CircleBounds,
  RectBounds,
  PolygonBounds,
  AxisDefinition,
} from "@canonry/world-schema";

export type CanvasPoint = { x: number; y: number };
export type WorldToCanvasFn = (x: number, y: number) => CanvasPoint;
export type WorldToCanvasDistFn = (d: number) => number;
export interface MapBounds { min: number; max: number; }

export function getKindDisplayName(kindDef: EntityKindDefinition): string {
  return kindDef.style?.displayName || kindDef.description || kindDef.kind;
}

export function mergeRegions(seed: Region[], emergent: Region[]): Region[] {
  const merged = [...seed];
  const seen = new Set(seed.map((region) => region.id));
  for (const region of emergent) {
    if (!seen.has(region.id)) { merged.push(region); }
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
  if (!region.color) { throw new Error(`Archivist: region "${region.id}" is missing color.`); }
  return { fill: hexToRgba(region.color, 0.15), stroke: hexToRgba(region.color, 0.7) };
}

export function getEntityCoords(entity: HardState): { x: number; y: number; z: number } {
  const coords = entity.coordinates;
  if (!coords || typeof coords.x !== "number" || typeof coords.y !== "number" || typeof coords.z !== "number") {
    throw new Error(`Archivist: entity "${entity.id}" is missing valid coordinates.`);
  }
  return coords;
}

export function isPointInRegion(region: Region, worldX: number, worldY: number): boolean {
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
// Canvas drawing helpers
// ---------------------------------------------------------------------------

function getRegionStyles(
  colors: { fill: string; stroke: string }, isHovered: boolean, isSelected: boolean
): { fillStyle: string; strokeStyle: string; lineWidth: number; highlighted: boolean } {
  const highlighted = isHovered || isSelected;
  // eslint-disable-next-line sonarjs/slow-regex -- short rgba() string
  const fillStyle = highlighted ? colors.fill.replace(/[\d.]+\)$/, "0.3)") : colors.fill;
  // eslint-disable-next-line sonarjs/slow-regex -- short rgba() string
  const hoverStroke = isHovered ? colors.stroke.replace(/[\d.]+\)$/, "1)") : colors.stroke;
  const strokeStyle = isSelected ? "#ffffff" : hoverStroke;
  const baseWidth = isHovered ? 2.5 : 2;
  return { fillStyle, strokeStyle, lineWidth: isSelected ? 3 : baseWidth, highlighted };
}

function drawCircleRegion(
  ctx: CanvasRenderingContext2D, bounds: CircleBounds, label: string,
  highlighted: boolean, colors: { fill: string; stroke: string },
  worldToCanvas: WorldToCanvasFn, worldToCanvasDistance: WorldToCanvasDistFn
): void {
  const center = worldToCanvas(bounds.center.x, bounds.center.y);
  const radiusPixels = worldToCanvasDistance(bounds.radius);
  ctx.beginPath(); ctx.arc(center.x, center.y, radiusPixels, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = highlighted ? "#ffffff" : colors.stroke;
  ctx.font = highlighted ? "bold 13px sans-serif" : "bold 12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, center.x, center.y);
}

function drawRectRegion(
  ctx: CanvasRenderingContext2D, bounds: RectBounds, label: string,
  highlighted: boolean, colors: { fill: string; stroke: string }, worldToCanvas: WorldToCanvasFn
): void {
  const topLeft = worldToCanvas(bounds.x1, bounds.y2);
  const bottomRight = worldToCanvas(bounds.x2, bounds.y1);
  ctx.beginPath();
  ctx.rect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = highlighted ? "#ffffff" : colors.stroke;
  ctx.font = highlighted ? "bold 13px sans-serif" : "bold 12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, (topLeft.x + bottomRight.x) / 2, (topLeft.y + bottomRight.y) / 2);
}

function drawPolygonRegion(ctx: CanvasRenderingContext2D, bounds: PolygonBounds, worldToCanvas: WorldToCanvasFn): void {
  const points = bounds.points.map((p) => worldToCanvas(p.x, p.y));
  if (points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) { ctx.lineTo(points[i].x, points[i].y); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
}

export function drawRegion(
  ctx: CanvasRenderingContext2D, region: Region,
  hoveredRegion: Region | null | undefined, selectedRegionId: string | null,
  worldToCanvas: WorldToCanvasFn, worldToCanvasDistance: WorldToCanvasDistFn
): void {
  const colors = getRegionColor(region);
  const styles = getRegionStyles(colors, hoveredRegion?.id === region.id, selectedRegionId === region.id);
  ctx.fillStyle = styles.fillStyle;
  ctx.strokeStyle = styles.strokeStyle;
  ctx.lineWidth = styles.lineWidth;
  const { bounds } = region;
  if (bounds.shape === "circle") { drawCircleRegion(ctx, bounds, region.label, styles.highlighted, colors, worldToCanvas, worldToCanvasDistance); }
  else if (bounds.shape === "rect") { drawRectRegion(ctx, bounds, region.label, styles.highlighted, colors, worldToCanvas); }
  else if (bounds.shape === "polygon") { drawPolygonRegion(ctx, bounds, worldToCanvas); }
}

export function drawGrid(ctx: CanvasRenderingContext2D, bounds: MapBounds, worldToCanvas: WorldToCanvasFn): void {
  ctx.strokeStyle = "rgba(59, 130, 246, 0.1)";
  ctx.lineWidth = 1;
  const gridStep = 10;
  for (let i = bounds.min; i <= bounds.max; i += gridStep) {
    const start = worldToCanvas(i, bounds.min);
    const end = worldToCanvas(i, bounds.max);
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    const hStart = worldToCanvas(bounds.min, i);
    const hEnd = worldToCanvas(bounds.max, i);
    ctx.beginPath(); ctx.moveTo(hStart.x, hStart.y); ctx.lineTo(hEnd.x, hEnd.y); ctx.stroke();
  }
}

export function drawXAxisLabels(ctx: CanvasRenderingContext2D, axis: AxisDefinition, bounds: MapBounds, worldToCanvas: WorldToCanvasFn): void {
  ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
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

export function drawYAxisLabels(ctx: CanvasRenderingContext2D, axis: AxisDefinition, bounds: MapBounds, worldToCanvas: WorldToCanvasFn): void {
  ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
  ctx.save();
  ctx.fillStyle = "rgba(252, 107, 107, 0.8)";
  const yLowPos = worldToCanvas(bounds.min, bounds.min + 5);
  ctx.translate(yLowPos.x - 25, yLowPos.y - 20); ctx.rotate(-Math.PI / 2);
  ctx.fillText(`\u2190 ${axis.lowTag}`, 0, 0); ctx.restore();
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  const yCenterPos = worldToCanvas(bounds.min, (bounds.min + bounds.max) / 2);
  ctx.translate(yCenterPos.x - 25, yCenterPos.y); ctx.rotate(-Math.PI / 2);
  ctx.fillText(axis.name, 0, 0); ctx.restore();
  ctx.save();
  ctx.fillStyle = "rgba(107, 252, 156, 0.8)";
  const yHighPos = worldToCanvas(bounds.min, bounds.max - 5);
  ctx.translate(yHighPos.x - 25, yHighPos.y + 20); ctx.rotate(-Math.PI / 2);
  ctx.fillText(`${axis.highTag} \u2192`, 0, 0); ctx.restore();
}

export function drawNumericLabels(ctx: CanvasRenderingContext2D, bounds: MapBounds, worldToCanvas: WorldToCanvasFn): void {
  ctx.fillStyle = "rgba(59, 130, 246, 0.3)"; ctx.font = "9px monospace"; ctx.textAlign = "center";
  for (let i = bounds.min + 20; i < bounds.max; i += 20) {
    const pos = worldToCanvas(i, bounds.min);
    ctx.fillText(i.toString(), pos.x, pos.y + 12);
    ctx.textAlign = "right";
    const posY = worldToCanvas(bounds.min, i);
    ctx.fillText(i.toString(), posY.x - 5, posY.y + 3);
    ctx.textAlign = "center";
  }
}

export function drawRelationships(
  ctx: CanvasRenderingContext2D, relationships: WorldState["relationships"],
  entityPositions: Map<string, { x: number; y: number }>, worldToCanvas: WorldToCanvasFn
): void {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)"; ctx.lineWidth = 1;
  for (const rel of relationships) {
    const srcPos = entityPositions.get(rel.src);
    const dstPos = entityPositions.get(rel.dst);
    if (!srcPos || !dstPos) continue;
    const start = worldToCanvas(srcPos.x, srcPos.y);
    const end = worldToCanvas(dstPos.x, dstPos.y);
    ctx.globalAlpha = (rel.strength ?? 0.5) * 0.5;
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawEntityDot(
  ctx: CanvasRenderingContext2D, entity: HardState, canvasPos: CanvasPoint,
  color: string, isPrimaryKind: boolean, isSelected: boolean, isHovered: boolean
): void {
  const radius = isPrimaryKind ? 8 : 5;
  ctx.beginPath(); ctx.arc(canvasPos.x, canvasPos.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  if (isPrimaryKind) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke(); }
  if (isSelected || isHovered) {
    ctx.strokeStyle = "#FFD700"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(canvasPos.x, canvasPos.y, radius + 4, 0, Math.PI * 2); ctx.stroke();
  }
  if (isPrimaryKind || isSelected || isHovered) {
    ctx.fillStyle = "#fff"; ctx.font = "10px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(entity.name, canvasPos.x, canvasPos.y - radius - 5);
  }
}

export function drawEntityLayer(
  ctx: CanvasRenderingContext2D, mapEntities: HardState[],
  entityPositions: Map<string, { x: number; y: number }>,
  entityColorMap: Map<string, string>, effectiveMapKind: string,
  selectedNodeId: string | null, hoveredEntity: HardState | null, toCanvas: WorldToCanvasFn
): void {
  for (const entity of mapEntities) {
    const pos = entityPositions.get(entity.id);
    if (!pos) continue;
    const canvasPos = toCanvas(pos.x, pos.y);
    const color = entityColorMap.get(entity.kind);
    if (!color) { throw new Error(`Archivist: entity kind "${entity.kind}" is missing style.color.`); }
    drawEntityDot(ctx, entity, canvasPos, color, entity.kind === effectiveMapKind, entity.id === selectedNodeId, entity.id === hoveredEntity?.id);
  }
}
