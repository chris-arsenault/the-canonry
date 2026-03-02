import React, { useEffect, useRef, useCallback, useState, useMemo } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import { addNodeMesh, addSelectionGlow, addTextSprite, webglAvailable } from "../utils/forceGraphRendering.ts";
import {
  type TimelineView3DProps, type GraphNode, type GraphLink, type SimulationNode,
  type ForceGraphInstance,
  useEraLayout, useTimelineGraphData, useTimelineLegend,
} from "../utils/useTimelineData.ts";
import "./visualization-overlay.css";
import "./TimelineView3D.css";

// eslint-disable-next-line max-lines-per-function -- ForceGraph3D imperative API requires collocated state, effects, and callbacks for data transform, era positioning, physics, THREE.js rendering, and lifecycle
export default function TimelineView3D({
  data, selectedNodeId, onNodeSelect, showCatalyzedBy = false, edgeMetric = "strength", prominenceScale,
}: Readonly<TimelineView3DProps>) {
  const fgRef = useRef<ForceGraphInstance>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isReady, setIsReady] = useState(false);
  const [mountId] = useState(() => Date.now());

  useEffect(() => {
    if (!webglAvailable) return;
    const frameId = requestAnimationFrame(() => { setIsReady(true); });
    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (!webglAvailable || !containerRef.current) return;
    const updateDimensions = () => {
      if (containerRef.current) { setDimensions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight }); }
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const { eraPositions, entityEraMap } = useEraLayout(data.hardState, data.relationships);
  const legendItems = useTimelineLegend(data.schema);
  const graphData = useTimelineGraphData(data, showCatalyzedBy, eraPositions, entityEraMap, prominenceScale);
  const graphKey = useMemo(() => `timeline-${mountId}-${data.hardState.length}`, [mountId, data.hardState.length]);

  const linkDistance = useCallback((link: GraphLink) => {
    if (link.isCreatedDuring) return 50;
    if (edgeMetric === "none") return 100;
    if (edgeMetric === "distance") { const dist = link.distance ?? 0.5; return 30 + dist * 170; }
    const strength = link.strength ?? 0.5; return 30 + (1 - strength) * 170;
  }, [edgeMetric]);

  const handleNodeClick = useCallback((node: GraphNode) => { onNodeSelect(node.id); }, [onNodeSelect]);
  const handleBackgroundClick = useCallback(() => { onNodeSelect(undefined); }, [onNodeSelect]);

  const nodeThreeObject = useCallback((node: GraphNode) => {
    const group = new THREE.Group();
    const isEra = node.kind === "era";
    const isSelected = node.id === selectedNodeId;
    addNodeMesh(group, node, isEra, isSelected);
    if (isSelected) { addSelectionGlow(group, node, isEra); }
    addTextSprite(group, node, isEra);
    return group;
  }, [selectedNodeId]);

  const linkColor = useCallback((link: GraphLink) => {
    if (link.isCreatedDuring) return "#FFD70088";
    if (link.catalyzed) return "#a78bfa";
    return `#ffffff${Math.floor(link.strength * 255).toString(16).padStart(2, "0")}`;
  }, []);

  const linkWidth = useCallback((link: GraphLink) => link.isCreatedDuring ? 1 : link.strength * 2, []);

  useEffect(() => {
    if (!isReady || !fgRef.current) return;
    const fg = fgRef.current;
    fg.camera().position.set(0, 200, 500);
    return () => { fg.pauseAnimation?.(); fg.d3Force("simulation")?.stop?.(); };
  }, [isReady]);

  useEffect(() => {
    if (!isReady || !fgRef.current) return;
    const fg = fgRef.current;
    const linkForce = fg.d3Force("link");
    if (linkForce) {
      linkForce
        .distance((link: GraphLink) => {
          if (link.isCreatedDuring) return 50;
          if (edgeMetric === "none") return 100;
          if (edgeMetric === "distance") { const dist = link.distance ?? 0.5; return 30 + dist * 170; }
          const strength = link.strength ?? 0.5; return 30 + (1 - strength) * 170;
        })
        .strength((link: GraphLink) => link.isCreatedDuring ? 1.5 : 0.5);
      fg.d3ReheatSimulation();
    }
    fg.d3Force("eraX", (alpha: number) => {
      (graphData.nodes as SimulationNode[]).forEach((node) => {
        if (node.kind !== "era" && node._targetX !== undefined && node.fx === undefined) {
          node.vx = (node.vx || 0) + (node._targetX - (node.x ?? 0)) * alpha * 0.1;
        }
      });
    });
    fg.d3Force("spreadY", (alpha: number) => {
      (graphData.nodes as SimulationNode[]).forEach((node) => {
        if (node.kind !== "era" && node.fy === undefined) {
          node.vy = (node.vy || 0) + ((node.y ?? 0) >= 0 ? 1 : -1) * alpha * 0.5;
        }
      });
    });
  }, [edgeMetric, graphData.nodes, isReady]);

  if (!webglAvailable) {
    return (
      <div className="viz-no-webgl">
        <div className="viz-no-webgl-inner">
          <div className="viz-no-webgl-icon">&#x1F4A0;</div>
          <div className="viz-no-webgl-title">WebGL not available</div>
          <div className="viz-no-webgl-message">3D timeline view requires WebGL. Switch to the <strong>2D Graph</strong> or <strong>Map</strong> view instead.</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="viz-container viz-theme-golden">
      {isReady && (
        // eslint-disable-next-line local/max-jsx-props -- react-force-graph-3d API requires individual props for graph data, physics, rendering, and interaction
        <ForceGraph3D
          key={graphKey} ref={fgRef} graphData={graphData}
          width={dimensions.width} height={dimensions.height}
          nodeId="id" nodeLabel="name" nodeColor="color" nodeVal="val"
          nodeThreeObject={nodeThreeObject}
          onNodeClick={handleNodeClick} onBackgroundClick={handleBackgroundClick}
          linkSource="source" linkTarget="target"
          linkColor={linkColor} linkWidth={linkWidth} linkOpacity={0.6}
          // @ts-expect-error react-force-graph supports linkDistance
          linkDistance={linkDistance}
          linkDirectionalArrowLength={3} linkDirectionalArrowRelPos={1}
          enableNodeDrag={true} enableNavigationControls={true} showNavInfo={false}
          backgroundColor="#0a1929"
          d3VelocityDecay={0.4} d3AlphaDecay={0.015} d3AlphaMin={0.001}
          warmupTicks={200} cooldownTicks={Infinity} cooldownTime={20000}
        />
      )}
      <div className="absolute bottom-6 left-6 rounded-xl text-white text-sm shadow-2xl border border-amber-500/30 overflow-hidden viz-legend">
        <div className="px-5 py-3 border-b border-amber-500/20 viz-legend-header">
          <div className="font-bold text-amber-200 uppercase tracking-wider text-xs">Timeline View</div>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-3"><div className="w-5 h-5 rounded shadow-lg flex-shrink-0 tv3d-era-swatch"></div><span className="font-medium">Eras (fixed timeline)</span></div>
          {legendItems.map((item) => (
            <div key={item.kind} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full shadow-lg flex-shrink-0 viz-legend-swatch" style={{ '--viz-swatch-color': item.color } as React.CSSProperties}></div>
              <span className="font-medium">{item.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-3"><div className="w-8 h-0.5 shadow-lg flex-shrink-0 tv3d-era-link"></div><span className="font-medium">Era links</span></div>
        </div>
        <div className="px-5 py-3 border-t border-amber-500/20 viz-legend-footer">
          <div className="text-xs text-amber-300 italic">Entities cluster near their creation era</div>
        </div>
      </div>
      <div className="absolute top-6 left-6 rounded-xl text-white text-xs shadow-2xl border border-amber-500/30 overflow-hidden viz-controls">
        <div className="px-5 py-3 border-b border-amber-500/20 viz-controls-header">
          <div className="font-bold text-amber-200 uppercase tracking-wider">Timeline Controls</div>
        </div>
        <div className="px-5 py-3 space-y-2">
          <div className="flex items-center gap-3"><span className="text-lg flex-shrink-0">🖱️</span><span className="font-medium">Click to select</span></div>
          <div className="flex items-center gap-3"><span className="text-lg flex-shrink-0">🔄</span><span className="font-medium">Drag to rotate</span></div>
          <div className="flex items-center gap-3"><span className="text-lg flex-shrink-0">🔍</span><span className="font-medium">Scroll to zoom</span></div>
          <div className="flex items-center gap-3"><span className="text-lg flex-shrink-0">⏳</span><span className="font-medium">Eras aligned on X-axis</span></div>
        </div>
      </div>
    </div>
  );
}
