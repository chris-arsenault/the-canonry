/**
 * Canvas drawing and hit-testing functions for SemanticPlane.
 * Pure functions that operate on CanvasRenderingContext2D — no React dependency.
 */

import type { Optional } from "@the-canonry/shared-components";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Point { x: number; y: number }

export interface RegionBounds {
  shape: string;
  center: Optional<Point>;
  radius: Optional<number>;
}

export interface CanvasRegion {
  id: string;
  label: Optional<string>;
  color: Optional<string>;
  bounds: Optional<RegionBounds>;
}

export interface CanvasEntity {
  id: string;
  name: Optional<string>;
  kind: string;
  culture: string;
  coordinates: Optional<{ x: number; y: number; z: number }>;
}

export interface CanvasCulture { id: string; color: Optional<string> }

export interface CanvasAxisDef { id: string; name: string; lowTag: string; highTag: string }

export type DragState =
  | { type: "entity"; id: string; position: Point }
  | { type: "region"; id: string; position: Point }
  | { type: "resize"; id: string; radius: number };

export type WorldToCanvasFn = (wx: number, wy: number) => Point;

export const WORLD_MIN = 0;
export const WORLD_MAX = 100;
export const WORLD_SIZE = WORLD_MAX - WORLD_MIN;
export const PADDING = 40;

// ---------------------------------------------------------------------------
// Region drawing
// ---------------------------------------------------------------------------

function resolveCircleDrag(center: Point, radius: number, regionId: string, drag: DragState | null): { cx: number; cy: number; r: number } {
  let cx = center.x, cy = center.y, r = radius;
  if (drag && drag.id === regionId) {
    if (drag.type === "region") { cx = drag.position.x; cy = drag.position.y; }
    else if (drag.type === "resize") { r = drag.radius; }
  }
  return { cx, cy, r };
}

function drawCircleHandles(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, regionColor: Optional<string>): void {
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = regionColor || "#0f3460";
  ctx.lineWidth = 2;
  ctx.stroke();
  for (const pos of [
    { x: cx + radius, y: cy }, { x: cx - radius, y: cy },
    { x: cx, y: cy - radius }, { x: cx, y: cy + radius },
  ]) {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#e94560";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// eslint-disable-next-line complexity -- renders a single region with selection-dependent visual properties (fill alpha, stroke, line width, handles, label font); flat visual toggles, not nested logic
export function drawPlaneRegion(ctx: CanvasRenderingContext2D, region: CanvasRegion, selectedRegionId: string | null, drag: DragState | null, worldToCanvas: WorldToCanvasFn, scale: number): void {
  if (!region.bounds) return;
  if (region.bounds.shape !== "circle" || !region.bounds.center) return;
  const isSelected = region.id === selectedRegionId;
  ctx.fillStyle = (region.color || "#0f3460") + (isSelected ? "50" : "30");
  ctx.strokeStyle = isSelected ? "#fff" : region.color || "#0f3460";
  ctx.lineWidth = isSelected ? 3 : 2;
  const { cx, cy, r } = resolveCircleDrag(region.bounds.center, region.bounds.radius || 10, region.id, drag);
  const { x: px, y: py } = worldToCanvas(cx, cy);
  const radius = r * scale;
  ctx.beginPath();
  ctx.arc(px, py, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (isSelected) drawCircleHandles(ctx, px, py, radius, region.color);
  ctx.fillStyle = isSelected ? "#fff" : "#888";
  ctx.font = isSelected ? "bold 11px sans-serif" : "11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(region.label || "", px, py + radius + 14);
}

// ---------------------------------------------------------------------------
// Entity drawing
// ---------------------------------------------------------------------------

// eslint-disable-next-line complexity -- iterates entities drawing dot + label with selection highlight and drag override; branches from Optional coordinates, drag check, culture color lookup, and selection styling
export function drawEntities(ctx: CanvasRenderingContext2D, entities: CanvasEntity[], cultures: CanvasCulture[], selectedEntityId: string | null, drag: DragState | null, worldToCanvas: WorldToCanvasFn): void {
  for (const entity of entities) {
    if (!entity.coordinates) continue;
    let ex = entity.coordinates.x, ey = entity.coordinates.y;
    if (drag && drag.type === "entity" && drag.id === entity.id) {
      ex = drag.position.x;
      ey = drag.position.y;
    }
    const { x: cx, y: cy } = worldToCanvas(ex, ey);
    const culture = cultures.find((c) => c.id === entity.culture);
    const isSelected = entity.id === selectedEntityId;
    ctx.beginPath();
    ctx.arc(cx, cy, isSelected ? 10 : 7, 0, Math.PI * 2);
    ctx.fillStyle = culture?.color || "#888";
    ctx.fill();
    if (isSelected) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = "#ccc";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(entity.name || entity.id, cx, cy - 12);
  }
}

// ---------------------------------------------------------------------------
// Axis labels
// ---------------------------------------------------------------------------

// eslint-disable-next-line complexity -- renders axis labels for x and y axes with Optional resolution and fallback expressions for lowTag, highTag, and name per axis; flat visual rendering, not nested logic
export function drawAxisLabels(ctx: CanvasRenderingContext2D, axes: Optional<Record<string, { axisId: Optional<string> }>>, axisDefinitions: CanvasAxisDef[], topLeft: Point, bottomRight: Point): void {
  if (!axes) return;
  const axisById = new Map(axisDefinitions.map((a) => [a.id, a]));
  const resolve = (ref: { axisId: Optional<string> }) => ref.axisId ? axisById.get(ref.axisId) : undefined;
  ctx.fillStyle = "#666";
  ctx.font = "11px sans-serif";
  if (axes.x) {
    const def = resolve(axes.x);
    ctx.textAlign = "left";
    ctx.fillText(def?.lowTag || "0", topLeft.x, bottomRight.y + 16);
    ctx.textAlign = "right";
    ctx.fillText(def?.highTag || "100", bottomRight.x, bottomRight.y + 16);
    ctx.textAlign = "center";
    ctx.fillText(def?.name || axes.x.axisId || "X Axis", (topLeft.x + bottomRight.x) / 2, bottomRight.y + 28);
  }
  if (axes.y) {
    const def = resolve(axes.y);
    ctx.textAlign = "right";
    ctx.fillText(def?.lowTag || "0", topLeft.x - 6, bottomRight.y);
    ctx.fillText(def?.highTag || "100", topLeft.x - 6, topLeft.y + 4);
    ctx.save();
    ctx.translate(topLeft.x - 28, (topLeft.y + bottomRight.y) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText(def?.name || axes.y.axisId || "Y Axis", 0, 0);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Grid + background
// ---------------------------------------------------------------------------

export function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number, topLeft: Point, bottomRight: Point, worldToCanvas: WorldToCanvasFn): void {
  ctx.fillStyle = "#0a0e14";
  ctx.fillRect(0, 0, width, height);
  const worldWidth = bottomRight.x - topLeft.x;
  const worldHeight = bottomRight.y - topLeft.y;
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(topLeft.x, topLeft.y, worldWidth, worldHeight);
  ctx.strokeStyle = "#1a2332";
  ctx.lineWidth = 1;
  for (let x = WORLD_MIN; x <= WORLD_MAX; x += 10) {
    const { x: gx } = worldToCanvas(x, 0);
    ctx.beginPath(); ctx.moveTo(gx, topLeft.y); ctx.lineTo(gx, bottomRight.y); ctx.stroke();
  }
  for (let y = WORLD_MIN; y <= WORLD_MAX; y += 10) {
    const { y: gy } = worldToCanvas(0, y);
    ctx.beginPath(); ctx.moveTo(topLeft.x, gy); ctx.lineTo(bottomRight.x, gy); ctx.stroke();
  }
  const center = worldToCanvas(50, 50);
  ctx.strokeStyle = "#2a3a4a";
  ctx.beginPath();
  ctx.moveTo(topLeft.x, center.y); ctx.lineTo(bottomRight.x, center.y);
  ctx.moveTo(center.x, topLeft.y); ctx.lineTo(center.x, bottomRight.y);
  ctx.stroke();
  ctx.strokeStyle = "#3a4a5a";
  ctx.lineWidth = 2;
  ctx.strokeRect(topLeft.x, topLeft.y, worldWidth, worldHeight);
}

// ---------------------------------------------------------------------------
// Hit testing
// ---------------------------------------------------------------------------

export function findEntityAt(entities: CanvasEntity[], worldToCanvas: WorldToCanvasFn, cx: number, cy: number): CanvasEntity | null {
  for (const entity of entities) {
    if (!entity.coordinates) continue;
    const { x: ex, y: ey } = worldToCanvas(entity.coordinates.x, entity.coordinates.y);
    if (Math.sqrt((cx - ex) ** 2 + (cy - ey) ** 2) < 12) return entity;
  }
  return null;
}

export function findRegionAt(regions: CanvasRegion[], worldToCanvas: WorldToCanvasFn, scale: number, cx: number, cy: number): CanvasRegion | null {
  for (let i = regions.length - 1; i >= 0; i--) {
    const region = regions[i];
    if (!region.bounds?.center || region.bounds.shape !== "circle") continue;
    const { x: rx, y: ry } = worldToCanvas(region.bounds.center.x, region.bounds.center.y);
    const radius = (region.bounds.radius || 10) * scale;
    if (Math.sqrt((cx - rx) ** 2 + (cy - ry) ** 2) < radius) return region;
  }
  return null;
}

export function findRegionEdgeAt(regions: CanvasRegion[], selectedRegionId: string | null, worldToCanvas: WorldToCanvasFn, scale: number, cx: number, cy: number): CanvasRegion | null {
  if (!selectedRegionId) return null;
  const region = regions.find((r) => r.id === selectedRegionId);
  if (!region?.bounds?.center) return null;
  const { x: rx, y: ry } = worldToCanvas(region.bounds.center.x, region.bounds.center.y);
  const radius = (region.bounds.radius || 10) * scale;
  if (Math.abs(Math.sqrt((cx - rx) ** 2 + (cy - ry) ** 2) - radius) < 8) return region;
  return null;
}
