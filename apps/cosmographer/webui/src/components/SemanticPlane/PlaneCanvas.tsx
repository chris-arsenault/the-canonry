/**
 * PlaneCanvas - 2D canvas for visualizing and editing semantic planes.
 * Coordinate system: 0-100 on both axes, with (0,0) at bottom-left.
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import type { Optional } from "@the-canonry/shared-components";
import {
  WORLD_MIN, WORLD_MAX, WORLD_SIZE, PADDING,
  drawBackground, drawPlaneRegion, drawEntities, drawAxisLabels,
  findEntityAt, findRegionAt, findRegionEdgeAt,
} from "./canvasDrawing.ts";
import type { CanvasRegion, CanvasEntity, CanvasCulture, CanvasAxisDef, DragState, Point } from "./canvasDrawing.ts";
import "./PlaneCanvas.css";

interface PlaneCanvasProps {
  plane: Optional<{ axes: Optional<Record<string, { axisId: Optional<string> }>> }>;
  regions: CanvasRegion[];
  entities: CanvasEntity[];
  cultures: CanvasCulture[];
  axisDefinitions: CanvasAxisDef[];
  selectedEntityId: Optional<string>;
  selectedRegionId: Optional<string>;
  onSelectEntity: Optional<(id: string | null) => void>;
  onSelectRegion: Optional<(id: string | null) => void>;
  onMoveEntity: Optional<(id: string, pos: Point) => void>;
  onMoveRegion: Optional<(id: string, pos: Point) => void>;
  onResizeRegion: Optional<(id: string, radius: number) => void>;
}

/* eslint-disable local/no-raw-undefined-union -- internal component state; optional fields depend on which interaction type is active (entity drag, region drag, resize, pan) */
interface InteractionState {
  type: string | null;
  startX: number;
  startY: number;
  startCamera?: { x: number; y: number; zoom: number };
  entityId?: string;
  regionId?: string;
  centerX?: number;
  centerY?: number;
  offsetX?: number;
  offsetY?: number;
}
/* eslint-enable local/no-raw-undefined-union */

const IDLE_INTERACTION: InteractionState = { type: null, startX: 0, startY: 0 };

function getCursor(type: string | null): string {
  if (type === "pan") return "grabbing";
  if (type === "drag-entity" || type === "drag-region") return "move";
  if (type === "resize-region") return "nwse-resize";
  return "grab";
}

// eslint-disable-next-line max-lines-per-function -- canvas component wiring coordinate transforms, draw loop, and 4 interaction modes (entity drag, region drag, resize, pan); line count from mouse handler dispatch logic
export default function PlaneCanvas({
  plane, regions = [], entities = [], cultures = [], axisDefinitions = [],
  selectedEntityId, selectedRegionId,
  onSelectEntity, onSelectRegion, onMoveEntity, onMoveRegion, onResizeRegion,
}: Readonly<PlaneCanvasProps>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 600, height: 400 });
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [interaction, setInteraction] = useState<InteractionState>(IDLE_INTERACTION);
  const dragPositionRef = useRef<DragState | null>(null);
  const [renderTrigger, setRenderTrigger] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const drawArea = useMemo(() => ({
    left: PADDING, top: PADDING,
    width: size.width - PADDING * 2, height: size.height - PADDING * 2,
  }), [size.width, size.height]);

  const baseScale = Math.min(drawArea.width / WORLD_SIZE, drawArea.height / WORLD_SIZE);

  const worldToCanvas = useCallback((wx: number, wy: number) => {
    const scale = baseScale * camera.zoom;
    const worldPixelSize = WORLD_SIZE * scale;
    const offsetX = drawArea.left + (drawArea.width - worldPixelSize) / 2;
    const offsetY = drawArea.top + (drawArea.height - worldPixelSize) / 2;
    return {
      x: offsetX + (wx - WORLD_MIN) * scale + camera.x,
      y: offsetY + (WORLD_MAX - wy) * scale + camera.y,
    };
  }, [baseScale, camera, drawArea]);

  const canvasToWorld = useCallback((cx: number, cy: number) => {
    const scale = baseScale * camera.zoom;
    const worldPixelSize = WORLD_SIZE * scale;
    const offsetX = drawArea.left + (drawArea.width - worldPixelSize) / 2;
    const offsetY = drawArea.top + (drawArea.height - worldPixelSize) / 2;
    return {
      x: (cx - camera.x - offsetX) / scale + WORLD_MIN,
      y: WORLD_MAX - (cy - camera.y - offsetY) / scale,
    };
  }, [baseScale, camera, drawArea]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = baseScale * camera.zoom;
    const topLeft = worldToCanvas(WORLD_MIN, WORLD_MAX);
    const bottomRight = worldToCanvas(WORLD_MAX, WORLD_MIN);
    drawBackground(ctx, size.width, size.height, topLeft, bottomRight, worldToCanvas);
    regions.forEach((region) => drawPlaneRegion(ctx, region, selectedRegionId ?? null, dragPositionRef.current, worldToCanvas, scale));
    drawEntities(ctx, entities, cultures, selectedEntityId ?? null, dragPositionRef.current, worldToCanvas);
    drawAxisLabels(ctx, plane?.axes, axisDefinitions, topLeft, bottomRight);
  }, [plane, regions, entities, cultures, axisDefinitions, selectedEntityId, selectedRegionId, size, camera, baseScale, worldToCanvas, renderTrigger]);

  // eslint-disable-next-line complexity -- flat dispatch: 4 sequential if-return blocks for entity, edge-resize, region, and pan interactions; no nesting
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const entity = findEntityAt(entities, worldToCanvas, cx, cy);
    if (entity) {
      onSelectEntity?.(entity.id);
      onSelectRegion?.(null);
      setInteraction({ type: "drag-entity", entityId: entity.id, startX: cx, startY: cy });
      return;
    }
    const scale = baseScale * camera.zoom;
    const edgeRegion = findRegionEdgeAt(regions, selectedRegionId ?? null, worldToCanvas, scale, cx, cy);
    if (edgeRegion) {
      const regionCenter = edgeRegion.bounds?.center || { x: 50, y: 50 };
      const { x: rx, y: ry } = worldToCanvas(regionCenter.x, regionCenter.y);
      setInteraction({ type: "resize-region", regionId: edgeRegion.id, startX: cx, startY: cy, centerX: rx, centerY: ry });
      return;
    }
    const region = findRegionAt(regions, worldToCanvas, scale, cx, cy);
    if (region) {
      onSelectRegion?.(region.id);
      onSelectEntity?.(null);
      const worldClick = canvasToWorld(cx, cy);
      const regionCenter = region.bounds?.center || { x: 50, y: 50 };
      setInteraction({ type: "drag-region", regionId: region.id, startX: cx, startY: cy, offsetX: regionCenter.x - worldClick.x, offsetY: regionCenter.y - worldClick.y });
      return;
    }
    onSelectEntity?.(null);
    onSelectRegion?.(null);
    setInteraction({ type: "pan", startX: cx, startY: cy, startCamera: { ...camera } });
  }, [entities, regions, selectedRegionId, worldToCanvas, canvasToWorld, baseScale, camera, onSelectEntity, onSelectRegion]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interaction.type) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const clamp = (v: number) => Math.max(WORLD_MIN, Math.min(WORLD_MAX, v));

    if (interaction.type === "drag-entity") {
      const world = canvasToWorld(cx, cy);
      dragPositionRef.current = { type: "entity", id: interaction.entityId, position: { x: clamp(world.x), y: clamp(world.y) } };
      setRenderTrigger((n) => n + 1);
    } else if (interaction.type === "drag-region") {
      const world = canvasToWorld(cx, cy);
      dragPositionRef.current = { type: "region", id: interaction.regionId, position: { x: clamp(world.x + interaction.offsetX), y: clamp(world.y + interaction.offsetY) } };
      setRenderTrigger((n) => n + 1);
    } else if (interaction.type === "resize-region") {
      const dist = Math.sqrt((cx - interaction.centerX) ** 2 + (cy - interaction.centerY) ** 2);
      const scale = baseScale * camera.zoom;
      dragPositionRef.current = { type: "resize", id: interaction.regionId, radius: Math.max(1, Math.min(50, dist / scale)) };
      setRenderTrigger((n) => n + 1);
    } else if (interaction.type === "pan" && interaction.startCamera) {
      setCamera({ ...camera, x: interaction.startCamera.x + (cx - interaction.startX), y: interaction.startCamera.y + (cy - interaction.startY) });
    }
  }, [interaction, canvasToWorld, baseScale, camera]);

  const handleMouseUp = useCallback(() => {
    if (dragPositionRef.current) {
      const drag = dragPositionRef.current;
      if (drag.type === "entity") onMoveEntity?.(drag.id, drag.position);
      else if (drag.type === "region") onMoveRegion?.(drag.id, drag.position);
      else if (drag.type === "resize") onResizeRegion?.(drag.id, drag.radius);
      dragPositionRef.current = null;
    }
    setInteraction(IDLE_INTERACTION);
  }, [onMoveEntity, onMoveRegion, onResizeRegion]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const newZoom = Math.max(0.5, Math.min(4, camera.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
    const newScale = baseScale * newZoom;
    const worldPos = canvasToWorld(cx, cy);
    const worldPixelSize = WORLD_SIZE * newScale;
    const offsetX = drawArea.left + (drawArea.width - worldPixelSize) / 2;
    const offsetY = drawArea.top + (drawArea.height - worldPixelSize) / 2;
    setCamera({
      x: cx - offsetX - (worldPos.x - WORLD_MIN) * newScale,
      y: cy - offsetY - (WORLD_MAX - worldPos.y) * newScale,
      zoom: newZoom,
    });
  }, [camera, baseScale, canvasToWorld, drawArea]);

  const resetView = useCallback(() => setCamera({ x: 0, y: 0, zoom: 1 }), []);
  const zoomIn = useCallback(() => setCamera((c) => ({ ...c, zoom: Math.min(4, c.zoom * 1.25) })), []);
  const zoomOut = useCallback(() => setCamera((c) => ({ ...c, zoom: Math.max(0.5, c.zoom * 0.8) })), []);

  return (
    <div ref={containerRef} className="pc-container">
      <canvas
        ref={canvasRef}
        width={size.width}
        height={size.height}
        className="pc-canvas"
        style={{ '--pc-canvas-cursor': getCursor(interaction.type) } as React.CSSProperties}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
      <div className="pc-zoom-controls">
        <button onClick={zoomIn} className="pc-zoom-btn">+</button>
        <button onClick={zoomOut} className="pc-zoom-btn">−</button>
        <button onClick={resetView} className="pc-reset-btn">Reset</button>
      </div>
      <div className="pc-zoom-indicator">{Math.round(camera.zoom * 100)}%</div>
    </div>
  );
}
