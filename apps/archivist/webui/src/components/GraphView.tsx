import { useEffect, useRef, useMemo } from 'react';
import cytoscape from 'cytoscape';
import type { Core, NodeSingular, StylesheetJsonBlock } from 'cytoscape';
// @ts-ignore
import coseBilkent from 'cytoscape-cose-bilkent';
import type { WorldState } from '../types/world.ts';
import type { EntityKindDefinition, ProminenceScale } from '@canonry/world-schema';
import { transformWorldData } from '../utils/dataTransform.ts';

cytoscape.use(coseBilkent);

const SUPPORTED_NODE_SHAPES = new Set<cytoscape.Css.NodeShape>([
  'ellipse',
  'diamond',
  'hexagon',
  'rectangle',
  'star',
  'triangle',
  'octagon',
]);

function toNodeShape(shape?: string): cytoscape.Css.NodeShape | undefined {
  if (!shape) return undefined;
  return SUPPORTED_NODE_SHAPES.has(shape as cytoscape.Css.NodeShape)
    ? (shape as cytoscape.Css.NodeShape)
    : undefined;
}

// Generate Cytoscape style array from entity kind definitions
function generateEntityKindStyles(entityKinds: EntityKindDefinition[]): StylesheetJsonBlock[] {
  return entityKinds.map(ek => {
    const shape = toNodeShape(ek.style?.shape);
    const style: cytoscape.Css.Node = {
      'background-color': (() => {
        if (!ek.style?.color) {
          throw new Error(`Archivist: entity kind "${ek.kind}" is missing style.color.`);
        }
        return ek.style.color;
      })(),
    };

    if (shape) {
      style.shape = shape;
    }

    return {
      selector: `node[kind="${ek.kind}"]`,
      style,
    };
  });
}

// Map Cytoscape shape to CSS clip-path for legend
function shapeToLegendStyle(shape: string): React.CSSProperties {
  switch (shape) {
    case 'ellipse':
      return { borderRadius: '50%' };
    case 'diamond':
      return { transform: 'rotate(45deg)' };
    case 'hexagon':
      return { clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' };
    case 'rectangle':
      return {}; // Default square
    case 'star':
      return { clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' };
    case 'triangle':
      return { clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' };
    case 'octagon':
      return { clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)' };
    default:
      return {};
  }
}

interface GraphViewProps {
  data: WorldState;
  selectedNodeId?: string;
  onNodeSelect: (nodeId: string | undefined) => void;
  showCatalyzedBy?: boolean;
  onRecalculateLayoutRef?: (handler: () => void) => void;
  prominenceScale: ProminenceScale;
}

export default function GraphView({
  data,
  selectedNodeId,
  onNodeSelect,
  showCatalyzedBy = false,
  onRecalculateLayoutRef,
  prominenceScale
}: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const isInitializedRef = useRef(false);

  // Get entity kind schemas from canonical schema
  const entityKindSchemas = useMemo(() => data.schema.entityKinds, [data.schema.entityKinds]);

  const handleRecalculateLayout = () => {
    if (!cyRef.current) return;

    const layout = cyRef.current.layout({
      name: 'cose-bilkent',
      randomize: true,  // Add jitter to break out of local minima
      fit: true,
      idealEdgeLength: 100,
      // Non-linear edge strength → spring length mapping for dramatic clustering
      edgeLength: (edge: any) => {
        const strength = edge.data('strength') ?? 0.5;
        // Non-linear scaling: emphasizes extremes away from 0.5
        // strength 1.0 → 25px (extremely tight clustering)
        // strength 0.7 → 70px (moderate clustering)
        // strength 0.5 → 130px (neutral)
        // strength 0.3 → 230px (loose)
        // strength 0.0 → 400px (very loose, almost disconnected)
        const invStrength = 1 - strength;
        return 25 + Math.pow(invStrength, 1.8) * 375;
      },
      nodeRepulsion: 100000,
      gravity: 0.25,
      numIter: 2500,
      tile: true,
      tilingPaddingVertical: 10,
      tilingPaddingHorizontal: 10,
      animate: true,
      animationDuration: 1000
    } as any);

    layout.run();
  };

  // Expose recalculate layout handler
  useEffect(() => {
    if (onRecalculateLayoutRef) {
      onRecalculateLayoutRef(handleRecalculateLayout);
    }
  }, [onRecalculateLayoutRef]);

  // Initialize graph once
  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return;

    // Generate entity kind styles dynamically from schema
    const entityStyles = generateEntityKindStyles(entityKindSchemas);

    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(name)',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '10px',
            'color': '#fff',
            'text-outline-color': '#000',
            'text-outline-width': 2,
            'width': 'mapData(prominence, 0, 4, 20, 60)',
            'height': 'mapData(prominence, 0, 4, 20, 60)',
            'background-color': '#666'
          }
        },
        // Dynamic entity kind styles from schema
        ...entityStyles,
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#FFD700',
            'background-color': '#FFD700'
          }
        },
        {
          // Edge strength visualization: strength values (0-1) control visual prominence
          // - Width: 0.5-7px (stronger = much thicker)
          // - Opacity: 0.2-1.0 (stronger = fully opaque, weak = nearly invisible)
          // Note: mapData doesn't work with colors, so we use fixed color + opacity
          selector: 'edge',
          style: {
            'width': 'mapData(strength, 0, 1, 0.5, 7)' as any,
            'line-color': '#888',
            'target-arrow-color': '#888',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'opacity': 'mapData(strength, 0, 1, 0.2, 1)' as any,
            'label': 'data(label)',
            'font-size': '8px',
            'color': '#999',
            'text-rotation': 'autorotate',
            'text-margin-y': -10
          }
        },
        {
          selector: 'edge.highlighted',
          style: {
            'line-color': '#FFD700',
            'target-arrow-color': '#FFD700',
            'width': 3
          }
        },
        {
          // Catalyzed edges - special styling to show meta-relationships
          selector: 'edge.catalyzed',
          style: {
            'line-style': 'dashed' as any,
            'line-dash-pattern': [6, 3] as any,
            'line-color': '#a78bfa' as any,  // Purple color for catalyzed relationships
            'target-arrow-color': '#a78bfa' as any,
            'width': 'mapData(strength, 0, 1, 1, 4)' as any,
            'opacity': 0.9 as any
          }
        }
      ],
      layout: {
        name: 'cose-bilkent',
        randomize: true,
        idealEdgeLength: 100,
        edgeLength: (edge: any) => {
          const strength = edge.data('strength') ?? 0.5;
          const invStrength = 1 - strength;
          return 25 + Math.pow(invStrength, 1.8) * 375;
        },
        nodeRepulsion: 100000,
        gravity: 0.25,
        numIter: 2500,
        tile: true,
        tilingPaddingVertical: 10,
        tilingPaddingHorizontal: 10
      } as any
    });

    // Handle node click
    cy.on('tap', 'node', (evt) => {
      const node = evt.target as NodeSingular;
      onNodeSelect(node.id());
    });

    // Handle background click (deselect)
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        onNodeSelect(undefined);
      }
    });

    cyRef.current = cy;
    isInitializedRef.current = true;

    return () => {
      cy.destroy();
      isInitializedRef.current = false;
    };
  }, []);

  // Update styles when entity kind schema changes
  useEffect(() => {
    if (!cyRef.current) return;
    const entityStyles = generateEntityKindStyles(entityKindSchemas);
    cyRef.current.style([
      {
        selector: 'node',
        style: {
          'label': 'data(name)',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '10px',
          'color': '#fff',
          'text-outline-color': '#000',
          'text-outline-width': 2,
          'width': 'mapData(prominence, 0, 4, 20, 60)',
          'height': 'mapData(prominence, 0, 4, 20, 60)',
          'background-color': '#666'
        }
      },
      ...entityStyles,
      {
        selector: 'node:selected',
        style: {
          'border-width': 4,
          'border-color': '#FFD700',
          'background-color': '#FFD700'
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 'mapData(strength, 0, 1, 0.5, 7)' as any,
          'line-color': '#888',
          'target-arrow-color': '#888',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'opacity': 'mapData(strength, 0, 1, 0.2, 1)' as any,
          'label': 'data(label)',
          'font-size': '8px',
          'color': '#999',
          'text-rotation': 'autorotate',
          'text-margin-y': -10
        }
      },
      {
        selector: 'edge.highlighted',
        style: {
          'line-color': '#FFD700',
          'target-arrow-color': '#FFD700',
          'width': 3
        }
      },
      {
        selector: 'edge.catalyzed',
        style: {
          'line-style': 'dashed' as any,
          'line-dash-pattern': [6, 3] as any,
          'line-color': '#a78bfa' as any,
          'target-arrow-color': '#a78bfa' as any,
          'width': 'mapData(strength, 0, 1, 1, 4)' as any,
          'opacity': 0.9 as any
        }
      }
    ]);
  }, [entityKindSchemas]);

  // Update graph data incrementally when data changes
  useEffect(() => {
    if (!cyRef.current) return;

    const cy = cyRef.current;
    const newElements = transformWorldData(data, showCatalyzedBy, prominenceScale);

    // Get current element IDs
    const currentNodeIds = new Set(cy.nodes().map(n => n.id()));
    const currentEdgeIds = new Set(cy.edges().map(e => e.id()));

    // Get new element IDs
    const newNodes = newElements.filter(e => !('source' in e.data));
    const newEdges = newElements.filter(e => 'source' in e.data);
    const newNodeIds = new Set(newNodes.map(n => n.data.id));
    const newEdgeIds = new Set(newEdges.map(e => e.data.id));

    // Remove elements that no longer exist
    cy.nodes().forEach(node => {
      if (!newNodeIds.has(node.id())) {
        cy.remove(node);
      }
    });
    cy.edges().forEach(edge => {
      if (!newEdgeIds.has(edge.id())) {
        cy.remove(edge);
      }
    });

    // Add new elements
    const elementsToAdd = newElements.filter(e => {
      const id = e.data.id;
      if ('source' in e.data) {
        return !currentEdgeIds.has(id);
      } else {
        return !currentNodeIds.has(id);
      }
    });

    if (elementsToAdd.length > 0) {
      cy.add(elementsToAdd);

      // If we're adding many nodes or have few existing nodes, do a full randomized layout
      const currentNodeCount = cy.nodes().length;
      const shouldFullLayout = elementsToAdd.filter(e => !('source' in e.data)).length > currentNodeCount * 0.3;

      const layout = cy.layout({
        name: 'cose-bilkent',
        randomize: shouldFullLayout,
        fit: shouldFullLayout,
        idealEdgeLength: 100,
        edgeLength: (edge: any) => {
          const strength = edge.data('strength') ?? 0.5;
          const invStrength = 1 - strength;
          return 25 + Math.pow(invStrength, 1.8) * 375;
        },
        nodeRepulsion: 100000,
        gravity: 0.25,
        numIter: shouldFullLayout ? 2500 : 1000,
        tile: true,
        tilingPaddingVertical: 10,
        tilingPaddingHorizontal: 10,
        animate: shouldFullLayout ? true : false,
        animationDuration: shouldFullLayout ? 1000 : 0
      } as any);

      layout.run();
    }
  }, [data, showCatalyzedBy, prominenceScale]);

  // Handle selection changes from outside
  useEffect(() => {
    if (!cyRef.current) return;

    cyRef.current.nodes().removeClass('highlighted');
    cyRef.current.edges().removeClass('highlighted');

    if (selectedNodeId) {
      const selectedNode = cyRef.current.getElementById(selectedNodeId);
      if (selectedNode.length > 0) {
        selectedNode.select();

        // Highlight connected edges
        const connectedEdges = selectedNode.connectedEdges();
        connectedEdges.addClass('highlighted');

        // Gently pan to selected node if it's off-screen (no zoom change)
        const renderedPos = selectedNode.renderedPosition();
        const containerWidth = cyRef.current.width();
        const containerHeight = cyRef.current.height();

        // Check if node is outside viewport
        const margin = 100;
        if (
          renderedPos.x < margin ||
          renderedPos.x > containerWidth - margin ||
          renderedPos.y < margin ||
          renderedPos.y > containerHeight - margin
        ) {
          // Only pan to bring into view, don't zoom
          cyRef.current.animate({
            center: {
              eles: selectedNode
            }
          }, {
            duration: 300
          });
        }
      }
    } else {
      cyRef.current.nodes().unselect();
    }
  }, [selectedNodeId]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div ref={containerRef} className="cytoscape-container" style={{ width: '100%', height: '100%' }} />

      {/* Legend - Dynamic from schema */}
      <div className="absolute bottom-6 left-6 rounded-xl text-white text-sm shadow-2xl border border-blue-500-30 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.95) 0%, rgba(10, 25, 41, 0.95) 100%)' }}>
        <div className="px-5 py-3 border-b border-blue-500-20" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
          <div className="font-bold text-blue-200 uppercase tracking-wider text-xs">Legend</div>
        </div>
        <div className="px-5 py-4 space-y-3">
          {entityKindSchemas.map(ek => (
            <div key={ek.kind} className="flex items-center gap-3">
              <div
                className="w-5 h-5 shadow-lg flex-shrink-0"
                style={{
                  backgroundColor: (() => {
                    if (!ek.style?.color) {
                      throw new Error(`Archivist: entity kind "${ek.kind}" is missing style.color.`);
                    }
                    return ek.style.color;
                  })(),
                  ...shapeToLegendStyle(ek.style?.shape || 'ellipse')
                }}
              ></div>
              <span className="font-medium">{ek.style?.displayName || ek.description || ek.kind}</span>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-blue-500-20" style={{ background: 'rgba(59, 130, 246, 0.05)' }}>
          <div className="text-xs text-blue-300 italic">Size indicates prominence</div>
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute top-6 left-6 rounded-xl text-white text-xs shadow-2xl border border-blue-500-30 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.95) 0%, rgba(10, 25, 41, 0.95) 100%)' }}>
        <div className="px-5 py-3 border-b border-blue-500-20" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
          <div className="font-bold text-blue-200 uppercase tracking-wider">Controls</div>
        </div>
        <div className="px-5 py-3 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-lg flex-shrink-0">🖱️</span>
            <span className="font-medium">Click to select</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg flex-shrink-0">🔍</span>
            <span className="font-medium">Scroll to zoom</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg flex-shrink-0">✋</span>
            <span className="font-medium">Drag to pan</span>
          </div>
        </div>
      </div>

    </div>
  );
}
