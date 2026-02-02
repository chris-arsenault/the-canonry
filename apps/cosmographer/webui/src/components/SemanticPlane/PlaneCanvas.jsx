/**
 * PlaneCanvas - 2D canvas for visualizing and editing semantic planes.
 * Coordinate system: 0-100 on both axes, with (0,0) at bottom-left.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';

const WORLD_MIN = 0;
const WORLD_MAX = 100;
const WORLD_SIZE = WORLD_MAX - WORLD_MIN;
const PADDING = 40; // Padding for axis labels

export default function PlaneCanvas({
  plane,
  regions = [],
  entities = [],
  cultures = [],
  axisDefinitions = [],
  selectedEntityId,
  selectedRegionId,
  onSelectEntity,
  onSelectRegion,
  onMoveEntity,
  onMoveRegion,
  onResizeRegion
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ width: 600, height: 400 });
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [interaction, setInteraction] = useState({ type: null, startX: 0, startY: 0, startCamera: null });

  // Track dragged positions locally to avoid expensive React state updates during drag
  const dragPositionRef = useRef(null);
  const [renderTrigger, setRenderTrigger] = useState(0); // Force canvas redraw without parent re-render

  // Resize observer to fill container
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

  // Calculate the drawable area (inside padding)
  const drawArea = {
    left: PADDING,
    top: PADDING,
    width: size.width - PADDING * 2,
    height: size.height - PADDING * 2
  };

  // Base scale to fit world in draw area (maintaining aspect ratio)
  const baseScale = Math.min(drawArea.width / WORLD_SIZE, drawArea.height / WORLD_SIZE);

  // Convert world coordinates (0-100) to canvas pixel coordinates
  const worldToCanvas = useCallback((wx, wy) => {
    const scale = baseScale * camera.zoom;
    // Center the world in the draw area
    const worldPixelSize = WORLD_SIZE * scale;
    const offsetX = drawArea.left + (drawArea.width - worldPixelSize) / 2;
    const offsetY = drawArea.top + (drawArea.height - worldPixelSize) / 2;

    return {
      x: offsetX + (wx - WORLD_MIN) * scale + camera.x,
      // Flip Y so 0 is at bottom
      y: offsetY + (WORLD_MAX - wy) * scale + camera.y
    };
  }, [baseScale, camera, drawArea]);

  // Convert canvas pixel coordinates to world coordinates
  const canvasToWorld = useCallback((cx, cy) => {
    const scale = baseScale * camera.zoom;
    const worldPixelSize = WORLD_SIZE * scale;
    const offsetX = drawArea.left + (drawArea.width - worldPixelSize) / 2;
    const offsetY = drawArea.top + (drawArea.height - worldPixelSize) / 2;

    return {
      x: (cx - camera.x - offsetX) / scale + WORLD_MIN,
      // Flip Y so 0 is at bottom
      y: WORLD_MAX - (cy - camera.y - offsetY) / scale
    };
  }, [baseScale, camera, drawArea]);

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = size;

    // Clear
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, width, height);

    const scale = baseScale * camera.zoom;

    // Get world corners in canvas space
    const topLeft = worldToCanvas(WORLD_MIN, WORLD_MAX);
    const bottomRight = worldToCanvas(WORLD_MAX, WORLD_MIN);
    const worldWidth = bottomRight.x - topLeft.x;
    const worldHeight = bottomRight.y - topLeft.y;

    // Draw world background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(topLeft.x, topLeft.y, worldWidth, worldHeight);

    // Draw grid
    ctx.strokeStyle = '#1a2332';
    ctx.lineWidth = 1;
    const gridStep = 10;

    for (let x = WORLD_MIN; x <= WORLD_MAX; x += gridStep) {
      const { x: cx } = worldToCanvas(x, 0);
      ctx.beginPath();
      ctx.moveTo(cx, topLeft.y);
      ctx.lineTo(cx, bottomRight.y);
      ctx.stroke();
    }
    for (let y = WORLD_MIN; y <= WORLD_MAX; y += gridStep) {
      const { y: cy } = worldToCanvas(0, y);
      ctx.beginPath();
      ctx.moveTo(topLeft.x, cy);
      ctx.lineTo(bottomRight.x, cy);
      ctx.stroke();
    }

    // Draw center crosshair
    ctx.strokeStyle = '#2a3a4a';
    ctx.lineWidth = 1;
    const center = worldToCanvas(50, 50);
    ctx.beginPath();
    ctx.moveTo(topLeft.x, center.y);
    ctx.lineTo(bottomRight.x, center.y);
    ctx.moveTo(center.x, topLeft.y);
    ctx.lineTo(center.x, bottomRight.y);
    ctx.stroke();

    // Draw world border
    ctx.strokeStyle = '#3a4a5a';
    ctx.lineWidth = 2;
    ctx.strokeRect(topLeft.x, topLeft.y, worldWidth, worldHeight);

    // Draw regions
    regions.forEach((region) => {
      const regionBounds = region.bounds;
      if (!regionBounds) return;

      const isSelected = region.id === selectedRegionId;
      ctx.fillStyle = (region.color || '#0f3460') + (isSelected ? '50' : '30');
      ctx.strokeStyle = isSelected ? '#fff' : (region.color || '#0f3460');
      ctx.lineWidth = isSelected ? 3 : 2;

      if (regionBounds.shape === 'circle' && regionBounds.center) {
        // Check for drag override position
        const drag = dragPositionRef.current;
        let centerX = regionBounds.center.x;
        let centerY = regionBounds.center.y;
        let radiusVal = regionBounds.radius || 10;

        if (drag && drag.id === region.id) {
          if (drag.type === 'region') {
            centerX = drag.position.x;
            centerY = drag.position.y;
          } else if (drag.type === 'resize') {
            radiusVal = drag.radius;
          }
        }

        const { x: cx, y: cy } = worldToCanvas(centerX, centerY);
        const radius = radiusVal * scale;

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Draw handles when selected
        if (isSelected) {
          // Center handle for moving
          ctx.beginPath();
          ctx.arc(cx, cy, 6, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.strokeStyle = region.color || '#0f3460';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Edge handles for resizing (at cardinal points)
          const handlePositions = [
            { x: cx + radius, y: cy },     // right
            { x: cx - radius, y: cy },     // left
            { x: cx, y: cy - radius },     // top
            { x: cx, y: cy + radius }      // bottom
          ];
          handlePositions.forEach(pos => {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#e94560';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
          });
        }

        // Label
        ctx.fillStyle = isSelected ? '#fff' : '#888';
        ctx.font = isSelected ? 'bold 11px sans-serif' : '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(region.label || '', cx, cy + radius + 14);
      }
    });

    // Draw entities
    entities.forEach((entity) => {
      if (!entity.coordinates) return;

      // Check for drag override position
      const drag = dragPositionRef.current;
      let coordX = entity.coordinates.x;
      let coordY = entity.coordinates.y;

      if (drag && drag.type === 'entity' && drag.id === entity.id) {
        coordX = drag.position.x;
        coordY = drag.position.y;
      }

      const { x: cx, y: cy } = worldToCanvas(coordX, coordY);
      const culture = cultures.find(c => c.id === entity.culture);
      const color = culture?.color || '#888';
      const isSelected = entity.id === selectedEntityId;

      // Entity dot
      ctx.beginPath();
      ctx.arc(cx, cy, isSelected ? 10 : 7, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Entity label
      ctx.fillStyle = '#ccc';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(entity.name || entity.id, cx, cy - 12);
    });

    // Draw axis labels on the edges
    const axes = plane?.axes || {};
    const axisById = new Map((axisDefinitions || []).map(axis => [axis.id, axis]));
    const resolveAxis = (axisRef) => axisRef?.axisId ? axisById.get(axisRef.axisId) : undefined;

    ctx.fillStyle = '#666';
    ctx.font = '11px sans-serif';

    // X axis labels
    if (axes.x) {
      const axisRef = axes.x;
      const axisDef = resolveAxis(axisRef);
      const axisName = axisDef?.name || axisRef.axisId || 'X Axis';
      const lowLabel = axisDef?.lowTag || '0';
      const highLabel = axisDef?.highTag || '100';
      ctx.textAlign = 'left';
      ctx.fillText(lowLabel, topLeft.x, bottomRight.y + 16);
      ctx.textAlign = 'right';
      ctx.fillText(highLabel, bottomRight.x, bottomRight.y + 16);
      ctx.textAlign = 'center';
      ctx.fillText(axisName, (topLeft.x + bottomRight.x) / 2, bottomRight.y + 28);
    }

    // Y axis labels
    if (axes.y) {
      const axisRef = axes.y;
      const axisDef = resolveAxis(axisRef);
      const axisName = axisDef?.name || axisRef.axisId || 'Y Axis';
      const lowLabel = axisDef?.lowTag || '0';
      const highLabel = axisDef?.highTag || '100';
      ctx.textAlign = 'right';
      ctx.fillText(lowLabel, topLeft.x - 6, bottomRight.y);
      ctx.fillText(highLabel, topLeft.x - 6, topLeft.y + 4);

      // Rotated Y axis name
      ctx.save();
      ctx.translate(topLeft.x - 28, (topLeft.y + bottomRight.y) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText(axisName, 0, 0);
      ctx.restore();
    }

  }, [plane, regions, entities, cultures, axisDefinitions, selectedEntityId, selectedRegionId, size, camera, baseScale, worldToCanvas, renderTrigger]);

  // Find entity at canvas position
  const findEntityAt = (cx, cy) => {
    for (const entity of entities) {
      if (!entity.coordinates) continue;
      const { x: ex, y: ey } = worldToCanvas(entity.coordinates.x, entity.coordinates.y);
      const dist = Math.sqrt((cx - ex) ** 2 + (cy - ey) ** 2);
      if (dist < 12) return entity;
    }
    return null;
  };

  // Find region at canvas position (checks if click is within region bounds)
  const findRegionAt = (cx, cy) => {
    const scale = baseScale * camera.zoom;
    // Check in reverse order so topmost (last drawn) regions are found first
    for (let i = regions.length - 1; i >= 0; i--) {
      const region = regions[i];
      const bounds = region.bounds;
      if (!bounds) continue;

      if (bounds.shape === 'circle' && bounds.center) {
        const { x: rx, y: ry } = worldToCanvas(bounds.center.x, bounds.center.y);
        const radius = (bounds.radius || 10) * scale;
        const dist = Math.sqrt((cx - rx) ** 2 + (cy - ry) ** 2);
        if (dist < radius) return region;
      }
    }
    return null;
  };

  // Check if clicking on the edge of the selected region (for resizing)
  const findRegionEdgeAt = (cx, cy) => {
    if (!selectedRegionId) return null;

    const region = regions.find(r => r.id === selectedRegionId);
    if (!region?.bounds?.center) return null;

    const scale = baseScale * camera.zoom;
    const { x: rx, y: ry } = worldToCanvas(region.bounds.center.x, region.bounds.center.y);
    const radius = (region.bounds.radius || 10) * scale;

    // Distance from click to center
    const distToCenter = Math.sqrt((cx - rx) ** 2 + (cy - ry) ** 2);

    // Check if near the edge (within 8px tolerance of the circle edge)
    const edgeTolerance = 8;
    if (Math.abs(distToCenter - radius) < edgeTolerance) {
      return region;
    }

    return null;
  };

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    // Check if clicking on an entity (entities have priority over regions)
    const entity = findEntityAt(cx, cy);
    if (entity) {
      onSelectEntity?.(entity.id);
      onSelectRegion?.(null);
      setInteraction({
        type: 'drag-entity',
        entityId: entity.id,
        startX: cx,
        startY: cy
      });
      return;
    }

    // Check if clicking on the edge of a selected region (for resizing)
    const edgeRegion = findRegionEdgeAt(cx, cy);
    if (edgeRegion) {
      const regionCenter = edgeRegion.bounds?.center || { x: 50, y: 50 };
      const { x: rx, y: ry } = worldToCanvas(regionCenter.x, regionCenter.y);
      setInteraction({
        type: 'resize-region',
        regionId: edgeRegion.id,
        centerX: rx,
        centerY: ry,
        startRadius: edgeRegion.bounds?.radius || 10
      });
      return;
    }

    // Check if clicking on a region
    const region = findRegionAt(cx, cy);
    if (region) {
      onSelectRegion?.(region.id);
      onSelectEntity?.(null);
      // Get current region center in world coords for offset calculation
      const worldClick = canvasToWorld(cx, cy);
      const regionCenter = region.bounds?.center || { x: 50, y: 50 };
      setInteraction({
        type: 'drag-region',
        regionId: region.id,
        startX: cx,
        startY: cy,
        // Store offset from click to region center
        offsetX: regionCenter.x - worldClick.x,
        offsetY: regionCenter.y - worldClick.y
      });
      return;
    }

    // Start panning (clicked on empty space)
    onSelectEntity?.(null);
    onSelectRegion?.(null);
    setInteraction({
      type: 'pan',
      startX: cx,
      startY: cy,
      startCamera: { ...camera }
    });
  };

  const handleMouseMove = (e) => {
    if (!interaction.type) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    if (interaction.type === 'drag-entity') {
      const world = canvasToWorld(cx, cy);
      // Clamp to world bounds
      const clampedX = Math.max(WORLD_MIN, Math.min(WORLD_MAX, world.x));
      const clampedY = Math.max(WORLD_MIN, Math.min(WORLD_MAX, world.y));
      // Store locally instead of calling parent - will commit on mouse up
      dragPositionRef.current = {
        type: 'entity',
        id: interaction.entityId,
        position: { x: clampedX, y: clampedY }
      };
      setRenderTrigger(n => n + 1); // Trigger canvas redraw
    } else if (interaction.type === 'drag-region') {
      const world = canvasToWorld(cx, cy);
      // Apply offset to maintain grab point relative to center
      const newX = world.x + interaction.offsetX;
      const newY = world.y + interaction.offsetY;
      // Clamp to world bounds
      const clampedX = Math.max(WORLD_MIN, Math.min(WORLD_MAX, newX));
      const clampedY = Math.max(WORLD_MIN, Math.min(WORLD_MAX, newY));
      // Store locally instead of calling parent - will commit on mouse up
      dragPositionRef.current = {
        type: 'region',
        id: interaction.regionId,
        position: { x: clampedX, y: clampedY }
      };
      setRenderTrigger(n => n + 1); // Trigger canvas redraw
    } else if (interaction.type === 'resize-region') {
      // Calculate distance from cursor to region center in canvas pixels
      const distToCenter = Math.sqrt(
        (cx - interaction.centerX) ** 2 + (cy - interaction.centerY) ** 2
      );
      // Convert to world units
      const scale = baseScale * camera.zoom;
      const newRadius = distToCenter / scale;
      // Clamp radius to reasonable bounds (1-50 in world units)
      const clampedRadius = Math.max(1, Math.min(50, newRadius));
      // Store locally instead of calling parent - will commit on mouse up
      dragPositionRef.current = {
        type: 'resize',
        id: interaction.regionId,
        radius: clampedRadius
      };
      setRenderTrigger(n => n + 1); // Trigger canvas redraw
    } else if (interaction.type === 'pan') {
      // Pan moves in same direction as mouse (natural scrolling)
      const dx = cx - interaction.startX;
      const dy = cy - interaction.startY;
      setCamera({
        ...camera,
        x: interaction.startCamera.x + dx,
        y: interaction.startCamera.y + dy
      });
    }
  };

  const handleMouseUp = () => {
    // Commit dragged position to parent state
    if (dragPositionRef.current) {
      const drag = dragPositionRef.current;
      if (drag.type === 'entity') {
        onMoveEntity?.(drag.id, drag.position);
      } else if (drag.type === 'region') {
        onMoveRegion?.(drag.id, drag.position);
      } else if (drag.type === 'resize') {
        onResizeRegion?.(drag.id, drag.radius);
      }
      dragPositionRef.current = null;
    }
    setInteraction({ type: null });
  };

  const handleWheel = (e) => {
    e.preventDefault();

    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    // Zoom towards cursor position
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.5, Math.min(4, camera.zoom * zoomFactor));

    // Adjust pan to keep point under cursor stationary
    const scale = baseScale * camera.zoom;
    const newScale = baseScale * newZoom;
    const scaleRatio = newScale / scale;

    // Get world coords before zoom
    const worldPos = canvasToWorld(cx, cy);

    // Calculate new camera position to keep world point under cursor
    const worldPixelSize = WORLD_SIZE * newScale;
    const offsetX = drawArea.left + (drawArea.width - worldPixelSize) / 2;
    const offsetY = drawArea.top + (drawArea.height - worldPixelSize) / 2;

    const newCameraX = cx - offsetX - (worldPos.x - WORLD_MIN) * newScale;
    const newCameraY = cy - offsetY - (WORLD_MAX - worldPos.y) * newScale;

    setCamera({
      x: newCameraX,
      y: newCameraY,
      zoom: newZoom
    });
  };

  const resetView = () => {
    setCamera({ x: 0, y: 0, zoom: 1 });
  };

  const zoomIn = () => {
    setCamera(c => ({ ...c, zoom: Math.min(4, c.zoom * 1.25) }));
  };

  const zoomOut = () => {
    setCamera(c => ({ ...c, zoom: Math.max(0.5, c.zoom * 0.8) }));
  };

  const getCursor = () => {
    if (interaction.type === 'pan') return 'grabbing';
    if (interaction.type === 'drag-entity') return 'move';
    if (interaction.type === 'drag-region') return 'move';
    if (interaction.type === 'resize-region') return 'nwse-resize';
    return 'grab';
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#0a0e14',
        borderRadius: '8px',
        overflow: 'hidden'
      }}
    >
      <canvas
        ref={canvasRef}
        width={size.width}
        height={size.height}
        style={{
          display: 'block',
          cursor: getCursor()
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Zoom controls */}
      <div style={{
        position: 'absolute',
        bottom: '12px',
        right: '12px',
        display: 'flex',
        gap: '4px'
      }}>
        <button
          onClick={zoomIn}
          style={{
            padding: '6px 12px',
            fontSize: '16px',
            backgroundColor: '#16213e',
            color: '#aaa',
            border: '1px solid #0f3460',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          +
        </button>
        <button
          onClick={zoomOut}
          style={{
            padding: '6px 12px',
            fontSize: '16px',
            backgroundColor: '#16213e',
            color: '#aaa',
            border: '1px solid #0f3460',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          −
        </button>
        <button
          onClick={resetView}
          style={{
            padding: '6px 12px',
            fontSize: '14px',
            backgroundColor: '#16213e',
            color: '#aaa',
            border: '1px solid #0f3460',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Reset
        </button>
      </div>

      {/* Zoom indicator */}
      <div style={{
        position: 'absolute',
        bottom: '12px',
        left: '12px',
        fontSize: '11px',
        color: '#666',
        backgroundColor: '#16213e',
        padding: '4px 8px',
        borderRadius: '4px'
      }}>
        {Math.round(camera.zoom * 100)}%
      </div>
    </div>
  );
}
