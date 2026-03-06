import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { WorldState, HardState, Region } from "../types/world.ts";
import type { EntityKindDefinition } from "@canonry/world-schema";
import type { Optional } from "@the-canonry/shared-components";
import {
  type CanvasPoint, type MapBounds,
  getKindDisplayName, mergeRegions, getEntityCoords, isPointInRegion,
  drawGrid, drawXAxisLabels, drawYAxisLabels, drawNumericLabels,
  drawRegion, drawRelationships, drawEntityLayer,
} from "../utils/coordinateMapDrawing.ts";
import { buildLayoutNodes, runForceLayout } from "../utils/coordinateMapLayout.ts";
import "./CoordinateMapView.css";

interface CoordinateMapViewProps {
  data: WorldState;
  selectedNodeId: Optional<string>;
  onNodeSelect: (nodeId: string | undefined) => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface MapControlsProps {
  mapKind: string; onMapKindChange: (kind: string) => void; mappableKinds: string[];
  kindDisplayNames: Map<string, string>; mapDescription: string;
  showRelatedKinds: boolean; onToggleRelatedKinds: () => void;
  visibleLayers: Set<string>; onToggleLayer: (layer: string) => void;
}

function MapControls({ mapKind, onMapKindChange, mappableKinds, kindDisplayNames, mapDescription, showRelatedKinds, onToggleRelatedKinds, visibleLayers, onToggleLayer }: Readonly<MapControlsProps>) {
  return (
    <div className="coordinate-map-controls">
      <div className="control-block">
        <div className="control-label">Entity Map</div>
        <select value={mapKind} onChange={(e) => onMapKindChange(e.target.value)} className="control-select">
          {mappableKinds.map((kind) => <option key={kind} value={kind}>{kindDisplayNames.get(kind) ?? kind}</option>)}
        </select>
        <div className="control-description">{mapDescription}</div>
      </div>
      <div className="control-block">
        <label className="layer-check"><input type="checkbox" checked={showRelatedKinds} onChange={onToggleRelatedKinds} /><span>Show related entities</span></label>
      </div>
      <div className="control-block">
        <div className="control-label">Layers</div>
        <div className="layer-checks">
          {["regions", "entities", "relationships"].map((layer) => (
            <label key={layer} className="layer-check"><input type="checkbox" checked={visibleLayers.has(layer)} onChange={() => onToggleLayer(layer)} /><span>{layer}</span></label>
          ))}
        </div>
      </div>
    </div>
  );
}

function MapLegend({ entityKindSchemas, effectiveMapKind, regions }: Readonly<{ entityKindSchemas: EntityKindDefinition[]; effectiveMapKind: string; regions: Region[] }>) {
  return (
    <div className="coordinate-map-legend">
      <div className="legend-title">Entity Types</div>
      {entityKindSchemas.map((ek) => {
        if (!ek.style?.color) { throw new Error(`Archivist: entity kind "${ek.kind}" is missing style.color.`); }
        return (
          <div key={ek.kind} className="legend-item">
            <svg className="legend-dot-svg" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill={ek.style.color} stroke={ek.kind === effectiveMapKind ? "#ffffff" : "none"} strokeWidth="2" /></svg>
            <span>{ek.description || ek.kind}</span>
            {ek.kind === effectiveMapKind && <span className="anchor-badge">primary</span>}
          </div>
        );
      })}
      {regions.length > 0 && (<>
        <div className="legend-divider" />
        <div className="legend-title">Regions ({regions.length})</div>
        {regions.map((region) => {
          if (!region.color) { throw new Error(`Archivist: region "${region.id}" is missing color.`); }
          return (
            <div key={region.id} className="legend-item">
              <svg className="legend-dot-svg" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill={region.color} /></svg>
              <span>{region.label}</span>
            </div>
          );
        })}
      </>)}
    </div>
  );
}

function EntityTooltip({ entity }: Readonly<{ entity: HardState }>) {
  const coords = getEntityCoords(entity);
  return (
    <div className="coordinate-map-tooltip coordinate-map-tooltip-fixed">
      <div className="tooltip-name">{entity.name}</div>
      <div className="tooltip-info">{entity.kind} / {entity.subtype}</div>
      <div className="tooltip-info">{entity.status}</div>
      <div className="tooltip-coords">x: {coords.x.toFixed(1)}, y: {coords.y.toFixed(1)}, z: {coords.z.toFixed(1)}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

// eslint-disable-next-line max-lines-per-function, complexity -- interactive canvas map with layered rendering, coordinate transforms, force layout, hit testing, and conditional display
export default function CoordinateMapView({ data, selectedNodeId, onNodeSelect }: Readonly<CoordinateMapViewProps>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [mapKind, setMapKind] = useState<string>(() => data.schema.entityKinds.find((kind) => kind.semanticPlane)?.kind ?? "");
  const [showRelatedKinds, setShowRelatedKinds] = useState(true);
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set(["regions", "entities", "relationships"]));
  const [hoveredEntity, setHoveredEntity] = useState<HardState | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<Region | null>(null);
  const [mousePos, setMousePos] = useState<CanvasPoint | null>(null);

  const entityKindSchemas = data.schema.entityKinds;
  const kindDisplayNames = useMemo(() => new Map(entityKindSchemas.map((kind) => [kind.kind, getKindDisplayName(kind)])), [entityKindSchemas]);
  const axisDefinitions = useMemo(() => data.schema.axisDefinitions || [], [data.schema.axisDefinitions]);
  const axisById = useMemo(() => new Map(axisDefinitions.map((axis) => [axis.id, axis])), [axisDefinitions]);
  const mappableKindSchemas = useMemo(() => entityKindSchemas.filter((kind) => kind.semanticPlane), [entityKindSchemas]);
  const mappableKinds = useMemo(() => mappableKindSchemas.map((kind) => kind.kind), [mappableKindSchemas]);
  const effectiveMapKind = mappableKinds.includes(mapKind) ? mapKind : mappableKinds[0] ?? mapKind;

  const activeKindDef = mappableKindSchemas.find((kind) => kind.kind === effectiveMapKind);
  if (!activeKindDef?.semanticPlane) { throw new Error("Archivist: map view requires a semantic plane on the selected entity kind."); }
  const displayName = getKindDisplayName(activeKindDef);
  const planeAxes = activeKindDef.semanticPlane.axes;
  const xAxis = planeAxes?.x?.axisId ? axisById.get(planeAxes.x.axisId) : undefined;
  const yAxis = planeAxes?.y?.axisId ? axisById.get(planeAxes.y.axisId) : undefined;
  if (planeAxes?.x?.axisId && !xAxis) { throw new Error(`Archivist: axis "${planeAxes.x.axisId}" not found in schema.axisDefinitions.`); }
  if (planeAxes?.y?.axisId && !yAxis) { throw new Error(`Archivist: axis "${planeAxes.y.axisId}" not found in schema.axisDefinitions.`); }
  const mapDescription = `Coordinate space for ${displayName} entities`;

  const semanticPlaneRegions = activeKindDef.semanticPlane.regions;
  const emergentRegionMap = data.coordinateState?.emergentRegions;
  const regions = useMemo(() => {
    const seed = semanticPlaneRegions ?? [];
    const emergent = emergentRegionMap?.[effectiveMapKind] ?? [];
    return mergeRegions(seed, emergent);
  }, [semanticPlaneRegions, emergentRegionMap, effectiveMapKind]);
  const bounds = useMemo<MapBounds>(() => ({ min: 0, max: 100 }), []);

  const mapEntities = useMemo(() => {
    const primaryEntities = data.hardState.filter((e) => e.kind === effectiveMapKind);
    if (!showRelatedKinds) return primaryEntities;
    const primaryIds = new Set(primaryEntities.map((e) => e.id));
    const relatedIds = new Set<string>();
    for (const rel of data.relationships) {
      if (primaryIds.has(rel.src)) relatedIds.add(rel.dst);
      if (primaryIds.has(rel.dst)) relatedIds.add(rel.src);
    }
    return [...primaryEntities, ...data.hardState.filter((e) => relatedIds.has(e.id) && !primaryIds.has(e.id))];
  }, [data.hardState, data.relationships, effectiveMapKind, showRelatedKinds]);

  const entityColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const ek of entityKindSchemas) {
      if (!ek.style?.color) { throw new Error(`Archivist: entity kind "${ek.kind}" is missing style.color.`); }
      map.set(ek.kind, ek.style.color);
    }
    return map;
  }, [entityKindSchemas]);

  const entityPositions = useMemo(() => {
    const nodes = buildLayoutNodes(mapEntities, effectiveMapKind);
    const visibleIds = new Set(mapEntities.map((e) => e.id));
    const rels = data.relationships.filter((r) => visibleIds.has(r.src) && visibleIds.has(r.dst)).map((r) => ({ src: r.src, dst: r.dst, strength: r.strength }));
    runForceLayout(nodes, rels);
    return new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y, anchored: n.anchored }]));
  }, [mapEntities, data.relationships, effectiveMapKind]);

  const padding = 40;
  const worldRange = bounds.max - bounds.min || 1;
  const availableWidth = Math.max(1, dimensions.width - padding * 2);
  const availableHeight = Math.max(1, dimensions.height - padding * 2);
  const uniformScale = Math.max(0.001, Math.min(availableWidth, availableHeight) / worldRange);
  const offsetX = padding + (availableWidth - worldRange * uniformScale) / 2;
  const offsetY = padding + (availableHeight - worldRange * uniformScale) / 2;

  const worldToCanvas = useCallback(
    (x: number, y: number): CanvasPoint => ({ x: offsetX + (x - bounds.min) * uniformScale, y: dimensions.height - offsetY - (y - bounds.min) * uniformScale }),
    [offsetX, offsetY, bounds.min, uniformScale, dimensions.height]
  );
  const canvasToWorld = useCallback(
    (canvasX: number, canvasY: number): CanvasPoint => ({ x: bounds.min + (canvasX - offsetX) / uniformScale, y: bounds.min + (dimensions.height - offsetY - canvasY) / uniformScale }),
    [offsetX, offsetY, bounds.min, uniformScale, dimensions.height]
  );
  const worldToCanvasDistance = useCallback((worldDistance: number): number => worldDistance * uniformScale, [uniformScale]);

  useEffect(() => {
    const updateDimensions = () => { if (containerRef.current) { setDimensions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight }); } };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // eslint-disable-next-line complexity -- layered canvas rendering: each visibility check is an independent layer concern
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
    if (visibleLayers.has("regions")) { for (const region of regions) { drawRegion(ctx, region, hoveredRegion, selectedRegionId, worldToCanvas, worldToCanvasDistance); } }
    if (visibleLayers.has("relationships")) { drawRelationships(ctx, data.relationships, entityPositions, worldToCanvas); }
    if (visibleLayers.has("entities")) { drawEntityLayer(ctx, mapEntities, entityPositions, entityColorMap, effectiveMapKind, selectedNodeId, hoveredEntity, worldToCanvas); }
  }, [data, dimensions, effectiveMapKind, visibleLayers, entityPositions, entityColorMap, regions, bounds, selectedNodeId, hoveredEntity, hoveredRegion, mapEntities, xAxis, yAxis, worldToCanvas, worldToCanvasDistance]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
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
      const dx = pos.x - worldPos.x, dy = pos.y - worldPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) { minDist = dist; foundEntity = entity; }
    }
    setHoveredEntity(foundEntity);
    let foundRegion: Region | null = null;
    if (!foundEntity && visibleLayers.has("regions")) {
      for (let i = regions.length - 1; i >= 0; i--) { if (isPointInRegion(regions[i], worldPos.x, worldPos.y)) { foundRegion = regions[i]; break; } }
    }
    setHoveredRegion(foundRegion);
  }, [canvasToWorld, mapEntities, entityPositions, visibleLayers, regions]);

  const handleClick = useCallback(() => {
    if (hoveredEntity) { onNodeSelect(hoveredEntity.id); }
    else if (hoveredRegion) { onNodeSelect(`region:${effectiveMapKind}:${hoveredRegion.id}`); }
    else { onNodeSelect(undefined); }
  }, [hoveredEntity, hoveredRegion, effectiveMapKind, onNodeSelect]);

  const toggleLayer = useCallback((layer: string) => {
    setVisibleLayers((prev) => { const next = new Set(prev); if (next.has(layer)) { next.delete(layer); } else { next.add(layer); } return next; });
  }, []);
  const toggleRelatedKinds = useCallback(() => setShowRelatedKinds((prev) => !prev), []);

  return (
    <div className="coordinate-map-container" ref={containerRef}>
      <canvas ref={canvasRef} width={dimensions.width} height={dimensions.height} onMouseMove={handleMouseMove} onClick={handleClick}
        className={hoveredEntity || hoveredRegion ? "coordinate-map-canvas coordinate-map-canvas-clickable" : "coordinate-map-canvas"} />
      <MapControls mapKind={mapKind} onMapKindChange={setMapKind} mappableKinds={mappableKinds} kindDisplayNames={kindDisplayNames}
        mapDescription={mapDescription} showRelatedKinds={showRelatedKinds} onToggleRelatedKinds={toggleRelatedKinds} visibleLayers={visibleLayers} onToggleLayer={toggleLayer} />
      <MapLegend entityKindSchemas={entityKindSchemas} effectiveMapKind={effectiveMapKind} regions={regions} />
      {hoveredEntity && mousePos && <EntityTooltip entity={hoveredEntity} />}
      {mousePos && <div className="coordinate-display">x: {mousePos.x.toFixed(1)}, y: {mousePos.y.toFixed(1)}</div>}
    </div>
  );
}
