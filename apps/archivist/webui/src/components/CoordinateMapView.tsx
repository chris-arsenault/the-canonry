import { useEffect, useRef, useState, useMemo } from 'react';
import type { WorldState, HardState, Point, Region } from '../types/world.ts';
import type { EntityKindDefinition } from '@canonry/world-schema';
import './CoordinateMapView.css';

interface CoordinateMapViewProps {
  data: WorldState;
  selectedNodeId?: string;
  onNodeSelect: (nodeId: string | undefined) => void;
}

function getKindDisplayName(kindDef: EntityKindDefinition): string {
  return kindDef.style?.displayName || kindDef.description || kindDef.kind;
}

function mergeRegions(seed: Region[], emergent: Region[]): Region[] {
  const merged = [...seed];
  const seen = new Set(seed.map(region => region.id));
  for (const region of emergent) {
    if (!seen.has(region.id)) {
      merged.push(region);
    }
  }
  return merged;
}

// Convert hex color to rgba with alpha
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
    stroke: hexToRgba(region.color, 0.7)
  };
}

// Get entity coordinates (requires valid x/y/z)
function getEntityCoords(entity: HardState): Point {
  const coords = entity.coordinates;

  if (!coords || typeof coords.x !== 'number' || typeof coords.y !== 'number' || typeof coords.z !== 'number') {
    throw new Error(`Archivist: entity "${entity.id}" is missing valid coordinates.`);
  }
  return coords;
}

// Simple force-directed layout for floating entities
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
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  for (let i = 0; i < iterations; i++) {
    // Reset velocities
    nodes.forEach(n => {
      if (!n.anchored) {
        n.vx = 0;
        n.vy = 0;
      }
    });

    // Attraction to related anchored nodes
    relationships.forEach(rel => {
      const src = nodeMap.get(rel.src);
      const dst = nodeMap.get(rel.dst);
      if (!src || !dst) return;

      const dx = dst.x - src.x;
      const dy = dst.y - src.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const strength = (rel.strength ?? 0.5) * 0.1;

      if (!src.anchored) {
        src.vx += dx / dist * strength;
        src.vy += dy / dist * strength;
      }
      if (!dst.anchored) {
        dst.vx -= dx / dist * strength;
        dst.vy -= dy / dist * strength;
      }
    });

    // Repulsion between floating nodes
    nodes.forEach(a => {
      if (a.anchored) return;
      nodes.forEach(b => {
        if (a.id === b.id) return;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 10) {
          const force = 0.5 / dist;
          a.vx += dx / dist * force;
          a.vy += dy / dist * force;
        }
      });
    });

    // Apply velocities
    nodes.forEach(n => {
      if (!n.anchored) {
        n.x = Math.max(0, Math.min(100, n.x + n.vx));
        n.y = Math.max(0, Math.min(100, n.y + n.vy));
      }
    });
  }
}

export default function CoordinateMapView({ data, selectedNodeId, onNodeSelect }: CoordinateMapViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [mapKind, setMapKind] = useState<string>(() => {
    const firstKind = data.schema.entityKinds.find(kind => kind.semanticPlane)?.kind;
    return firstKind ?? '';
  });  // Which entity kind's map to show
  const [showRelatedKinds, setShowRelatedKinds] = useState<boolean>(true);  // Show related entities from other kinds
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set(['regions', 'entities', 'relationships']));
  const [hoveredEntity, setHoveredEntity] = useState<HardState | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<Region | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Get entity kind schemas
  const entityKindSchemas = data.schema.entityKinds;
  const kindDisplayNames = useMemo(() => {
    return new Map(entityKindSchemas.map(kind => [kind.kind, getKindDisplayName(kind)]));
  }, [entityKindSchemas]);

  const axisDefinitions = data.schema.axisDefinitions || [];
  const axisById = useMemo(() => {
    return new Map(axisDefinitions.map(axis => [axis.id, axis]));
  }, [axisDefinitions]);

  const mappableKindSchemas = useMemo(
    () => entityKindSchemas.filter(kind => kind.semanticPlane),
    [entityKindSchemas]
  );
  const mappableKinds = mappableKindSchemas.map(kind => kind.kind);

  // Ensure mapKind is valid - default to first available kind if current selection is invalid
  useEffect(() => {
    if (mappableKinds.length > 0 && !mappableKinds.includes(mapKind)) {
      setMapKind(mappableKinds[0]);
    }
  }, [mappableKinds, mapKind]);

  // Get per-kind map config and regions (seed + emergent)
  const activeKindDef = mappableKindSchemas.find(kind => kind.kind === mapKind);
  if (!activeKindDef || !activeKindDef.semanticPlane) {
    throw new Error('Archivist: map view requires a semantic plane on the selected entity kind.');
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
  const emergentRegions = data.coordinateState?.emergentRegions?.[mapKind] ?? [];
  const regions = mergeRegions(seedRegions, emergentRegions);
  const bounds = { min: 0, max: 100 };

  // Filter entities for the current map - primary kind always shown, related kinds optionally
  const mapEntities = useMemo(() => {
    const primaryEntities = data.hardState.filter(e => e.kind === mapKind);

    if (!showRelatedKinds) {
      return primaryEntities;
    }

    // Find entities related to primary entities
    const primaryIds = new Set(primaryEntities.map(e => e.id));
    const relatedIds = new Set<string>();

    data.relationships.forEach(rel => {
      if (primaryIds.has(rel.src)) relatedIds.add(rel.dst);
      if (primaryIds.has(rel.dst)) relatedIds.add(rel.src);
    });

    const relatedEntities = data.hardState.filter(e =>
      relatedIds.has(e.id) && !primaryIds.has(e.id)
    );

    return [...primaryEntities, ...relatedEntities];
  }, [data.hardState, data.relationships, mapKind, showRelatedKinds]);

  // Build entity color map
  const entityColorMap = useMemo(() => {
    const map = new Map<string, string>();
    entityKindSchemas.forEach(ek => {
      if (!ek.style?.color) {
        throw new Error(`Archivist: entity kind "${ek.kind}" is missing style.color.`);
      }
      map.set(ek.kind, ek.style.color);
    });
    return map;
  }, [entityKindSchemas]);

  // Calculate entity positions with force layout
  const entityPositions = useMemo(() => {
    const nodes: LayoutNode[] = [];

    // All entities get coordinates
    mapEntities.forEach(entity => {
      const coords = getEntityCoords(entity);

      nodes.push({
        id: entity.id,
        x: coords.x,
        y: coords.y,
        vx: 0,
        vy: 0,
        // Only anchor primary kind entities
        anchored: entity.kind === mapKind,
        entity
      });
    });

    // Run force layout - only include relationships between visible entities
    const visibleIds = new Set(mapEntities.map(e => e.id));
    const relationships = data.relationships
      .filter(r => visibleIds.has(r.src) && visibleIds.has(r.dst))
      .map(r => ({
        src: r.src,
        dst: r.dst,
        strength: r.strength
      }));
    runForceLayout(nodes, relationships);

    return new Map(nodes.map(n => [n.id, { x: n.x, y: n.y, anchored: n.anchored }]));
  }, [mapEntities, data.relationships, mapKind]);

  // Use uniform scale to preserve aspect ratio (circles stay circular)
  const padding = 40;
  const worldRange = bounds.max - bounds.min || 1; // Prevent division by zero
  const availableWidth = Math.max(1, dimensions.width - padding * 2);
  const availableHeight = Math.max(1, dimensions.height - padding * 2);
  // Use the smaller scale so everything fits
  const uniformScale = Math.max(0.001, Math.min(availableWidth, availableHeight) / worldRange);
  // Center the content in the larger dimension
  const offsetX = padding + (availableWidth - worldRange * uniformScale) / 2;
  const offsetY = padding + (availableHeight - worldRange * uniformScale) / 2;

  // Convert world coordinates to canvas coordinates
  const worldToCanvas = (x: number, y: number): { x: number; y: number } => {
    return {
      x: offsetX + (x - bounds.min) * uniformScale,
      y: dimensions.height - offsetY - (y - bounds.min) * uniformScale // Flip Y for canvas
    };
  };

  // Convert canvas coordinates to world coordinates
  const canvasToWorld = (canvasX: number, canvasY: number): { x: number; y: number } => {
    return {
      x: bounds.min + (canvasX - offsetX) / uniformScale,
      y: bounds.min + (dimensions.height - offsetY - canvasY) / uniformScale
    };
  };

  // Convert world distance to canvas pixels (for radius calculations)
  const worldToCanvasDistance = (worldDistance: number): number => {
    return worldDistance * uniformScale;
  };

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Draw the map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#0a1929';
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Draw grid
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.1)';
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

    // Draw axis labels - semantic tags at ends, numeric in middle
    // Draw semantic axis labels at ends
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';

    // X-axis labels (low on left, high on right)
    if (xAxis) {
      // Low tag (left side)
      ctx.fillStyle = 'rgba(252, 107, 107, 0.8)';  // Reddish for low
      const xLowPos = worldToCanvas(bounds.min + 5, bounds.min);
      ctx.fillText(`← ${xAxis.lowTag}`, xLowPos.x + 30, xLowPos.y + 25);

      // Axis name (center bottom)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      const xCenterPos = worldToCanvas((bounds.min + bounds.max) / 2, bounds.min);
      ctx.fillText(xAxis.name, xCenterPos.x, xCenterPos.y + 25);

      // High tag (right side)
      ctx.fillStyle = 'rgba(107, 252, 156, 0.8)';  // Greenish for high
      const xHighPos = worldToCanvas(bounds.max - 5, bounds.min);
      ctx.fillText(`${xAxis.highTag} →`, xHighPos.x - 30, xHighPos.y + 25);
    }

    // Y-axis labels (low on bottom, high on top)
    if (yAxis) {
      ctx.save();

      // Low tag (bottom)
      ctx.fillStyle = 'rgba(252, 107, 107, 0.8)';
      const yLowPos = worldToCanvas(bounds.min, bounds.min + 5);
      ctx.translate(yLowPos.x - 25, yLowPos.y - 20);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(`← ${yAxis.lowTag}`, 0, 0);
      ctx.restore();

      // Axis name (center left)
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      const yCenterPos = worldToCanvas(bounds.min, (bounds.min + bounds.max) / 2);
      ctx.translate(yCenterPos.x - 25, yCenterPos.y);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(yAxis.name, 0, 0);
      ctx.restore();

      // High tag (top)
      ctx.save();
      ctx.fillStyle = 'rgba(107, 252, 156, 0.8)';
      const yHighPos = worldToCanvas(bounds.min, bounds.max - 5);
      ctx.translate(yHighPos.x - 25, yHighPos.y + 20);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(`${yAxis.highTag} →`, 0, 0);
      ctx.restore();
    }

    // Draw small numeric labels for reference
    ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    for (let i = bounds.min + 20; i < bounds.max; i += 20) {
      const pos = worldToCanvas(i, bounds.min);
      ctx.fillText(i.toString(), pos.x, pos.y + 12);

      ctx.textAlign = 'right';
      const posY = worldToCanvas(bounds.min, i);
      ctx.fillText(i.toString(), posY.x - 5, posY.y + 3);
      ctx.textAlign = 'center';
    }

    // Parse selectedNodeId to check if a region is selected
    const selectedRegionId = selectedNodeId?.startsWith('region:')
      ? selectedNodeId.split(':')[2]
      : null;

    // Draw regions if layer is visible
    if (visibleLayers.has('regions')) {
      regions.forEach(region => {
        const colors = getRegionColor(region);
        const isHovered = hoveredRegion?.id === region.id;
        const isSelected = selectedRegionId === region.id;

        // Adjust colors for hover/selection state
        ctx.fillStyle = isHovered || isSelected
          ? colors.fill.replace(/[\d.]+\)$/, '0.3)')  // Brighter fill
          : colors.fill;
        ctx.strokeStyle = isSelected
          ? '#ffffff'  // White stroke for selected
          : isHovered
            ? colors.stroke.replace(/[\d.]+\)$/, '1)')  // Full opacity on hover
            : colors.stroke;
        ctx.lineWidth = isSelected ? 3 : isHovered ? 2.5 : 2;

        if (region.bounds.shape === 'circle') {
          const center = worldToCanvas(region.bounds.center.x, region.bounds.center.y);
          const radiusPixels = worldToCanvasDistance(region.bounds.radius);

          ctx.beginPath();
          ctx.arc(center.x, center.y, radiusPixels, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Draw label
          ctx.fillStyle = isHovered || isSelected ? '#ffffff' : colors.stroke;
          ctx.font = isHovered || isSelected ? 'bold 13px sans-serif' : 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(region.label, center.x, center.y);
        } else if (region.bounds.shape === 'rect') {
          const topLeft = worldToCanvas(region.bounds.x1, region.bounds.y2);
          const bottomRight = worldToCanvas(region.bounds.x2, region.bounds.y1);

          ctx.beginPath();
          ctx.rect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
          ctx.fill();
          ctx.stroke();

          // Draw label
          ctx.fillStyle = isHovered || isSelected ? '#ffffff' : colors.stroke;
          ctx.font = isHovered || isSelected ? 'bold 13px sans-serif' : 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          const centerX = (topLeft.x + bottomRight.x) / 2;
          const centerY = (topLeft.y + bottomRight.y) / 2;
          ctx.fillText(region.label, centerX, centerY);
        } else if (region.bounds.shape === 'polygon') {
          const points = region.bounds.points.map(p => worldToCanvas(p.x, p.y));
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      });
    }

    // Draw relationships if layer is visible
    if (visibleLayers.has('relationships')) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;

      data.relationships.forEach(rel => {
        const srcPos = entityPositions.get(rel.src);
        const dstPos = entityPositions.get(rel.dst);
        if (!srcPos || !dstPos) return;

        const start = worldToCanvas(srcPos.x, srcPos.y);
        const end = worldToCanvas(dstPos.x, dstPos.y);

        ctx.globalAlpha = (rel.strength ?? 0.5) * 0.5;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    }

    // Draw entities if layer is visible
    if (visibleLayers.has('entities')) {
      mapEntities.forEach(entity => {
        const pos = entityPositions.get(entity.id);
        if (!pos) return;

        const canvasPos = worldToCanvas(pos.x, pos.y);
        const color = entityColorMap.get(entity.kind);
        if (!color) {
          throw new Error(`Archivist: entity kind "${entity.kind}" is missing style.color.`);
        }
        const isPrimaryKind = entity.kind === mapKind;
        const isSelected = entity.id === selectedNodeId;
        const isHovered = entity.id === hoveredEntity?.id;

        // Draw entity - primary kind entities are larger
        const radius = isPrimaryKind ? 8 : 5;
        ctx.beginPath();
        ctx.arc(canvasPos.x, canvasPos.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Draw primary kind indicator (white border)
        if (isPrimaryKind) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Draw selection/hover highlight
        if (isSelected || isHovered) {
          ctx.strokeStyle = '#FFD700';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(canvasPos.x, canvasPos.y, radius + 4, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Draw label for primary kind or selected/hovered entities
        if (isPrimaryKind || isSelected || isHovered) {
          ctx.fillStyle = '#fff';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(entity.name, canvasPos.x, canvasPos.y - radius - 5);
        }
      });
    }

  }, [data, dimensions, mapKind, visibleLayers, entityPositions, entityColorMap, regions, bounds, selectedNodeId, hoveredEntity, hoveredRegion, mapEntities, xAxis, yAxis]);

  // Check if a point is inside a region
  const isPointInRegion = (region: Region, worldX: number, worldY: number): boolean => {
    if (region.bounds.shape === 'circle') {
      const dx = worldX - region.bounds.center.x;
      const dy = worldY - region.bounds.center.y;
      return Math.sqrt(dx * dx + dy * dy) <= region.bounds.radius;
    } else if (region.bounds.shape === 'rect') {
      return worldX >= region.bounds.x1 && worldX <= region.bounds.x2 &&
             worldY >= region.bounds.y1 && worldY <= region.bounds.y2;
    }
    return false;
  };

  // Handle mouse events
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const worldPos = canvasToWorld(canvasX, canvasY);
    setMousePos(worldPos);

    // Find entity under cursor (only from visible entities)
    let foundEntity: HardState | null = null;
    let minDist = 3; // Threshold in world units - small to allow region selection

    mapEntities.forEach(entity => {
      const pos = entityPositions.get(entity.id);
      if (!pos) return;

      const dx = pos.x - worldPos.x;
      const dy = pos.y - worldPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < minDist) {
        minDist = dist;
        foundEntity = entity;
      }
    });

    setHoveredEntity(foundEntity);

    // Find region under cursor (if no entity found and regions visible)
    // Check regions in reverse order so topmost (last drawn) is selected first
    let foundRegion: Region | null = null;
    if (!foundEntity && visibleLayers.has('regions')) {
      for (let i = regions.length - 1; i >= 0; i--) {
        if (isPointInRegion(regions[i], worldPos.x, worldPos.y)) {
          foundRegion = regions[i];
          break;
        }
      }
    }
    setHoveredRegion(foundRegion);
  };

  const handleClick = () => {
    if (hoveredEntity) {
      onNodeSelect(hoveredEntity.id);
    } else if (hoveredRegion) {
      // Use prefixed ID for region selection: "region:{mapKind}:{regionId}"
      onNodeSelect(`region:${mapKind}:${hoveredRegion.id}`);
    } else {
      onNodeSelect(undefined);
    }
  };

  const toggleLayer = (layer: string) => {
    setVisibleLayers(prev => {
      const next = new Set(prev);
      if (next.has(layer)) {
        next.delete(layer);
      } else {
        next.add(layer);
      }
      return next;
    });
  };

  return (
    <div className="coordinate-map-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        style={{ cursor: (hoveredEntity || hoveredRegion) ? 'pointer' : 'default' }}
      />

      {/* Controls */}
      <div className="coordinate-map-controls">
        <div className="control-section">
          <div className="control-label">Entity Map</div>
          <select
            value={mapKind}
            onChange={e => setMapKind(e.target.value)}
            className="control-select"
          >
            {mappableKinds.map(kind => (
              <option key={kind} value={kind}>
                {kindDisplayNames.get(kind) ?? kind}
              </option>
            ))}
          </select>
          <div className="control-description">{mapDescription}</div>
        </div>

        <div className="control-section">
          <label className="layer-toggle">
            <input
              type="checkbox"
              checked={showRelatedKinds}
              onChange={() => setShowRelatedKinds(!showRelatedKinds)}
            />
            <span>Show related entities</span>
          </label>
        </div>

        <div className="control-section">
          <div className="control-label">Layers</div>
          <div className="layer-toggles">
            {['regions', 'entities', 'relationships'].map(layer => (
              <label key={layer} className="layer-toggle">
                <input
                  type="checkbox"
                  checked={visibleLayers.has(layer)}
                  onChange={() => toggleLayer(layer)}
                />
                <span>{layer}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="coordinate-map-legend">
        <div className="legend-title">Entity Types</div>
        {entityKindSchemas.map(ek => {
          if (!ek.style?.color) {
            throw new Error(`Archivist: entity kind "${ek.kind}" is missing style.color.`);
          }
          return (
            <div key={ek.kind} className="legend-item">
              <div
                className="legend-dot"
                style={{
                  backgroundColor: ek.style.color,
                  border: ek.kind === mapKind ? '2px solid white' : 'none'
                }}
              />
              <span>{ek.description || ek.kind}</span>
              {ek.kind === mapKind && <span className="anchor-badge">primary</span>}
            </div>
          );
        })}
        {regions.length > 0 && (
          <>
            <div className="legend-divider" />
            <div className="legend-title">Regions ({regions.length})</div>
            {regions.map(region => {
              if (!region.color) {
                throw new Error(`Archivist: region "${region.id}" is missing color.`);
              }
              return (
                <div key={region.id} className="legend-item">
                  <div
                    className="legend-dot"
                    style={{ backgroundColor: region.color }}
                  />
                  <span>{region.label}</span>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Hover tooltip */}
      {hoveredEntity && mousePos && (() => {
        const coords = getEntityCoords(hoveredEntity);
        return (
          <div className="coordinate-map-tooltip" style={{
            left: worldToCanvas(mousePos.x, mousePos.y).x + 15,
            top: worldToCanvas(mousePos.x, mousePos.y).y - 15
          }}>
            <div className="tooltip-name">{hoveredEntity.name}</div>
            <div className="tooltip-info">{hoveredEntity.kind} / {hoveredEntity.subtype}</div>
            <div className="tooltip-info">{hoveredEntity.status}</div>
            <div className="tooltip-coords">
              x: {coords.x.toFixed(1)},
              y: {coords.y.toFixed(1)},
              z: {coords.z.toFixed(1)}
            </div>
          </div>
        );
      })()}

      {/* Coordinate display */}
      {mousePos && (
        <div className="coordinate-display">
          x: {mousePos.x.toFixed(1)}, y: {mousePos.y.toFixed(1)}
        </div>
      )}
    </div>
  );
}
