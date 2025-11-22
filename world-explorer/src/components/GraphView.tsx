import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import type { Core, NodeSingular } from 'cytoscape';
// @ts-ignore
import coseBilkent from 'cytoscape-cose-bilkent';
import type { WorldState } from '../types/world.ts';
import { transformWorldData } from '../utils/dataTransform.ts';

cytoscape.use(coseBilkent);

interface GraphViewProps {
  data: WorldState;
  selectedNodeId?: string;
  onNodeSelect: (nodeId: string | undefined) => void;
}

export default function GraphView({ data, selectedNodeId, onNodeSelect }: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: transformWorldData(data),
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
        {
          selector: 'node[kind="npc"]',
          style: { 'background-color': '#6FB1FC', 'shape': 'ellipse' }
        },
        {
          selector: 'node[kind="faction"]',
          style: { 'background-color': '#FC6B6B', 'shape': 'diamond' }
        },
        {
          selector: 'node[kind="location"]',
          style: { 'background-color': '#6BFC9C', 'shape': 'hexagon' }
        },
        {
          selector: 'node[kind="rules"]',
          style: { 'background-color': '#FCA86B', 'shape': 'rectangle' }
        },
        {
          selector: 'node[kind="abilities"]',
          style: { 'background-color': '#C76BFC', 'shape': 'star' }
        },
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
            'width': 2,
            'line-color': '#555',
            'target-arrow-color': '#555',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
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
        }
      ],
      layout: {
        name: 'cose-bilkent',
        randomize: true,
        idealEdgeLength: 100,
        nodeRepulsion: 100000,
        gravity: 0.25,
        numIter: 2500,
        tile: true,
        tilingPaddingVertical: 10,
        tilingPaddingHorizontal: 10
      } as any,
      wheelSensitivity: 1.5
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

    return () => {
      cy.destroy();
    };
  }, [data]);

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

        // Center on selected node
        cyRef.current.animate({
          center: {
            eles: selectedNode
          },
          zoom: 1.5
        }, {
          duration: 500
        });
      }
    } else {
      cyRef.current.nodes().unselect();
    }
  }, [selectedNodeId]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="cytoscape-container" />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-gray-900 bg-opacity-90 p-4 rounded-lg text-white text-sm">
        <div className="font-bold mb-2">Legend</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#6FB1FC' }}></div>
            <span>NPCs</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4" style={{
              backgroundColor: '#FC6B6B',
              transform: 'rotate(45deg)'
            }}></div>
            <span>Factions</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4" style={{
              backgroundColor: '#6BFC9C',
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
            }}></div>
            <span>Locations</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4" style={{ backgroundColor: '#FCA86B' }}></div>
            <span>Rules</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4" style={{
              backgroundColor: '#C76BFC',
              clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'
            }}></div>
            <span>Abilities</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="text-xs text-gray-400">Size = Prominence</div>
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute top-4 left-4 bg-gray-900 bg-opacity-90 p-3 rounded-lg text-white text-xs">
        <div>🖱️ Click: Select node</div>
        <div>🔍 Scroll: Zoom</div>
        <div>✋ Drag: Pan</div>
      </div>
    </div>
  );
}
