import React, { useEffect, useRef, useMemo } from "react";
import cytoscape from "cytoscape";
import type { Core, NodeSingular } from "cytoscape";
// @ts-expect-error No types available for cytoscape-cose-bilkent
import coseBilkent from "cytoscape-cose-bilkent";
import type { WorldState } from "../types/world.ts";
import type { ProminenceScale } from "@canonry/world-schema";
import type { Optional } from "@the-canonry/shared-components";
import { transformWorldData } from "../utils/dataTransform.ts";
import { getCytoscapeStyles, createLayoutOptions, shapeToLegendClass } from "../utils/graphViewStyles.ts";
import "./visualization-overlay.css";
import "./GraphView.css";

cytoscape.use(coseBilkent as cytoscape.Ext);

interface GraphViewProps {
  data: WorldState;
  selectedNodeId: Optional<string>;
  onNodeSelect: (nodeId: string | undefined) => void;
  showCatalyzedBy: Optional<boolean>;
  onRecalculateLayoutRef: Optional<(handler: () => void) => void>;
  prominenceScale: ProminenceScale;
}

// eslint-disable-next-line max-lines-per-function -- Cytoscape graph requires collocated lifecycle management (init, style updates, data sync, selection sync) due to imperative API
export default function GraphView({
  data, selectedNodeId, onNodeSelect, showCatalyzedBy = false,
  onRecalculateLayoutRef, prominenceScale,
}: Readonly<GraphViewProps>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const isInitializedRef = useRef(false);
  const entityKindSchemas = useMemo(() => data.schema.entityKinds, [data.schema.entityKinds]);
  const onNodeSelectRef = useRef(onNodeSelect);
  useEffect(() => { onNodeSelectRef.current = onNodeSelect; }, [onNodeSelect]);

  const handleRecalculateLayout = () => {
    if (!cyRef.current) return;
    cyRef.current.layout(createLayoutOptions({
      randomize: true, fit: true, animate: true, numIter: 2500, animationDuration: 1000,
    })).run();
  };

  useEffect(() => {
    if (onRecalculateLayoutRef) { onRecalculateLayoutRef(handleRecalculateLayout); }
  }, [onRecalculateLayoutRef]);

  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return;
    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      style: getCytoscapeStyles(entityKindSchemas),
      layout: createLayoutOptions({ randomize: true, fit: true, animate: false, numIter: 2500, animationDuration: 0 }),
    });
    cy.on("tap", "node", (evt) => { onNodeSelectRef.current((evt.target as NodeSingular).id()); });
    cy.on("tap", (evt) => { if (evt.target === cy) { onNodeSelectRef.current(undefined); } });
    cyRef.current = cy;
    isInitializedRef.current = true;
    return () => { cy.destroy(); isInitializedRef.current = false; };
  }, [entityKindSchemas]);

  useEffect(() => {
    if (!cyRef.current) return;
    cyRef.current.style(getCytoscapeStyles(entityKindSchemas));
  }, [entityKindSchemas]);

  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    const newElements = transformWorldData(data, showCatalyzedBy, prominenceScale);
    const currentNodeIds = new Set(cy.nodes().map((n) => n.id()));
    const currentEdgeIds = new Set(cy.edges().map((e) => e.id()));
    const newNodes = newElements.filter((e) => !("source" in e.data));
    const newEdges = newElements.filter((e) => "source" in e.data);
    const newNodeIds = new Set(newNodes.map((n) => n.data.id));
    const newEdgeIds = new Set(newEdges.map((e) => e.data.id));
    cy.nodes().forEach((node) => { if (!newNodeIds.has(node.id())) { cy.remove(node); } });
    cy.edges().forEach((edge) => { if (!newEdgeIds.has(edge.id())) { cy.remove(edge); } });

    const elementsToAdd = newElements.filter((e) => {
      const id = e.data.id;
      return ("source" in e.data) ? !currentEdgeIds.has(id) : !currentNodeIds.has(id);
    });
    if (elementsToAdd.length > 0) {
      cy.add(elementsToAdd);
      const currentNodeCount = cy.nodes().length;
      const shouldFullLayout = elementsToAdd.filter((e) => !("source" in e.data)).length > currentNodeCount * 0.3;
      cy.layout(createLayoutOptions({
        randomize: shouldFullLayout, fit: shouldFullLayout, animate: shouldFullLayout,
        numIter: shouldFullLayout ? 2500 : 1000, animationDuration: shouldFullLayout ? 1000 : 0,
      })).run();
    }
  }, [data, showCatalyzedBy, prominenceScale]);

  useEffect(() => {
    if (!cyRef.current) return;
    cyRef.current.nodes().removeClass("highlighted");
    cyRef.current.edges().removeClass("highlighted");
    if (selectedNodeId) {
      const selectedNode = cyRef.current.getElementById(selectedNodeId);
      if (selectedNode.length > 0) {
        selectedNode.select();
        selectedNode.connectedEdges().addClass("highlighted");
        const renderedPos = selectedNode.renderedPosition();
        const margin = 100;
        if (renderedPos.x < margin || renderedPos.x > cyRef.current.width() - margin ||
            renderedPos.y < margin || renderedPos.y > cyRef.current.height() - margin) {
          cyRef.current.animate({ center: { eles: selectedNode } }, { duration: 300 });
        }
      }
    } else {
      cyRef.current.nodes().unselect();
    }
  }, [selectedNodeId]);

  return (
    <div className="viz-container viz-theme-blue">
      <div ref={containerRef} className="cytoscape-container gv-cytoscape" />
      <div className="absolute bottom-6 left-6 rounded-xl text-white text-sm shadow-2xl border border-blue-500-30 overflow-hidden viz-legend">
        <div className="px-5 py-3 border-b border-blue-500-20 viz-legend-header">
          <div className="font-bold text-blue-200 uppercase tracking-wider text-xs">Legend</div>
        </div>
        <div className="px-5 py-4 space-y-3">
          {entityKindSchemas.map((ek) => (
            <div key={ek.kind} className="flex items-center gap-3">
              <div
                className={`w-5 h-5 shadow-lg flex-shrink-0 viz-legend-swatch ${shapeToLegendClass(ek.style?.shape || "ellipse")}`}
                style={{ '--viz-swatch-color': (() => {
                  if (!ek.style?.color) { throw new Error(`Archivist: entity kind "${ek.kind}" is missing style.color.`); }
                  return ek.style.color;
                })() } as React.CSSProperties}
              ></div>
              <span className="font-medium">{ek.style?.displayName || ek.description || ek.kind}</span>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-blue-500-20 viz-legend-footer">
          <div className="text-xs text-blue-300 italic">Size indicates prominence</div>
        </div>
      </div>
      <div className="absolute top-6 left-6 rounded-xl text-white text-xs shadow-2xl border border-blue-500-30 overflow-hidden viz-controls">
        <div className="px-5 py-3 border-b border-blue-500-20 viz-controls-header">
          <div className="font-bold text-blue-200 uppercase tracking-wider">Controls</div>
        </div>
        <div className="px-5 py-3 space-y-2">
          <div className="flex items-center gap-3"><span className="text-lg flex-shrink-0">🖱️</span><span className="font-medium">Click to select</span></div>
          <div className="flex items-center gap-3"><span className="text-lg flex-shrink-0">🔍</span><span className="font-medium">Scroll to zoom</span></div>
          <div className="flex items-center gap-3"><span className="text-lg flex-shrink-0">✋</span><span className="font-medium">Drag to pan</span></div>
        </div>
      </div>
    </div>
  );
}
