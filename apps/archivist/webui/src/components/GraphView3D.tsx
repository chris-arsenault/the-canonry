import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import type { WorldState } from '../types/world.ts';
import type { ProminenceScale } from '@canonry/world-schema';
import { getKindColor, prominenceToNumber } from '../utils/dataTransform.ts';
import * as THREE from 'three';

export type EdgeMetric = 'strength' | 'distance' | 'none';

interface GraphView3DProps {
  data: WorldState;
  selectedNodeId?: string;
  onNodeSelect: (nodeId: string | undefined) => void;
  showCatalyzedBy?: boolean;
  edgeMetric?: EdgeMetric;
  prominenceScale: ProminenceScale;
}

interface GraphNode {
  id: string;
  name: string;
  kind: string;
  prominence: number;
  color: string;
  val: number;
}

interface GraphLink {
  source: string;
  target: string;
  kind: string;
  strength: number;
  distance?: number;
  catalyzed?: boolean;
}

export default function GraphView3D({
  data,
  selectedNodeId,
  onNodeSelect,
  showCatalyzedBy = false,
  edgeMetric = 'strength',
  prominenceScale,
}: GraphView3DProps) {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  // Delay render by one frame to let any stale animation callbacks clear
  const [isReady, setIsReady] = useState(false);
  // Unique ID per mount to ensure ForceGraph gets a fresh instance
  const [mountId] = useState(() => Date.now());

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setIsReady(true);
    });
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Get container dimensions
  useEffect(() => {
    if (containerRef.current) {
      const updateDimensions = () => {
        if (containerRef.current) {
          setDimensions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight
          });
        }
      };

      updateDimensions();

      // Update on window resize
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    }
  }, []);

  // Transform data to force-graph format
  // We need both useMemo (for sync computation) and imperative update (library mutates data)
  const graphData = useMemo(() => {
    const nodes: GraphNode[] = data.hardState.map(entity => ({
      id: entity.id,
      name: entity.name,
      kind: entity.kind,
      prominence: prominenceToNumber(entity.prominence, data.schema, prominenceScale),
      color: getKindColor(entity.kind, data.schema),
      val: prominenceToNumber(entity.prominence, data.schema, prominenceScale) + 1 // Size multiplier (1-5)
    }));

    const links: GraphLink[] = data.relationships.map(rel => {
      const catalyzedBy = (rel as any).catalyzedBy;
      return {
        source: rel.src,
        target: rel.dst,
        kind: rel.kind,
        strength: rel.strength ?? 0.5,
        distance: rel.distance,
        catalyzed: showCatalyzedBy && !!catalyzedBy
      };
    });

    return { nodes, links };
  }, [data, showCatalyzedBy, prominenceScale]);

  // Generate a stable key - includes mountId for fresh instance on remount,
  // and entity count for clean reset when filters change
  const graphKey = useMemo(() => {
    return `graph-${mountId}-${data.hardState.length}`;
  }, [mountId, data.hardState.length]);

  const legendItems = useMemo(() => {
    return data.schema.entityKinds.map(kind => {
      const label = kind.style?.displayName || kind.description || kind.kind;
      return {
        kind: kind.kind,
        label,
        color: getKindColor(kind.kind, data.schema),
      };
    });
  }, [data.schema]);

  // Calculate link distance based on selected metric
  const linkDistance = useCallback((link: any) => {
    if (edgeMetric === 'none') {
      return 100; // Equal distance for all links
    } else if (edgeMetric === 'distance') {
      // Lower distance = more similar = shorter spring (pull closer together)
      // distance is 0-1, so we scale it: 0 -> 30px, 1 -> 200px
      const dist = link.distance ?? 0.5;
      return 30 + dist * 170;
    } else {
      // strength metric (default)
      // Higher strength = shorter spring (pull closer together)
      // strength is 0-1, so we invert it: 1 -> 30px, 0 -> 200px
      const strength = link.strength ?? 0.5;
      return 30 + (1 - strength) * 170;
    }
  }, [edgeMetric]);

  // Handle node click
  const handleNodeClick = useCallback((node: any) => {
    onNodeSelect(node.id);
  }, [onNodeSelect]);

  // Handle background click
  const handleBackgroundClick = useCallback(() => {
    onNodeSelect(undefined);
  }, [onNodeSelect]);

  // Custom node appearance with text label
  const nodeThreeObject = useCallback((node: any) => {
    const group = new THREE.Group();

    // Node sphere
    const geometry = new THREE.SphereGeometry(node.val * 2, 16, 16);
    const material = new THREE.MeshLambertMaterial({
      color: node.color,
      transparent: true,
      opacity: node.id === selectedNodeId ? 1 : 0.9
    });
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);

    // Add glow for selected node
    if (node.id === selectedNodeId) {
      const glowGeometry = new THREE.SphereGeometry(node.val * 2.5, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: '#FFD700',
        transparent: true,
        opacity: 0.3
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      group.add(glow);
    }

    // Create text sprite
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context) {
      canvas.width = 256;
      canvas.height = 64;

      context.fillStyle = 'rgba(0, 0, 0, 0.7)';
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.font = 'Bold 20px Arial';
      context.fillStyle = 'white';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(node.name, canvas.width / 2, canvas.height / 2);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.9
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.scale.set(20, 5, 1);
      sprite.position.set(0, node.val * 2 + 5, 0); // Position above the node
      group.add(sprite);
    }

    return group;
  }, [selectedNodeId]);

  // Custom link appearance
  const linkColor = useCallback((link: any) => {
    if (link.catalyzed) {
      return '#a78bfa'; // Purple for catalyzed
    }
    // Fade color based on strength
    const opacity = Math.floor(link.strength * 255).toString(16).padStart(2, '0');
    return `#ffffff${opacity}`;
  }, []);

  const linkWidth = useCallback((link: any) => {
    return link.strength * 2; // 0-2px width based on strength
  }, []);

  // Set initial camera position and cleanup on unmount
  useEffect(() => {
    if (fgRef.current) {
      const camera = fgRef.current.camera();
      camera.position.set(0, 0, 500);
    }

    // Cleanup: pause animation when component unmounts to prevent stale tick errors
    return () => {
      if (fgRef.current) {
        fgRef.current.pauseAnimation?.();
        // Also stop the d3 simulation
        const simulation = fgRef.current.d3Force?.('simulation');
        simulation?.stop?.();
      }
    };
  }, []);

  // Configure d3 forces when metric changes
  useEffect(() => {
    if (fgRef.current) {
      const fg = fgRef.current;

      // Configure the d3 link force to use our distance function
      const linkForce = fg.d3Force('link');
      if (linkForce) {
        linkForce
          .distance((link: any) => {
            if (edgeMetric === 'none') {
              return 100;
            } else if (edgeMetric === 'distance') {
              const dist = link.distance ?? 0.5;
              return 30 + dist * 170;
            } else {
              const strength = link.strength ?? 0.5;
              return 30 + (1 - strength) * 170;
            }
          })
          .strength(2.0); // Higher strength so distances have stronger effect

        // Restart the simulation to apply new forces
        fg.d3ReheatSimulation();
      }
    }
  }, [edgeMetric]);

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {isReady && (
        <ForceGraph3D
          key={graphKey}
          ref={fgRef}
          graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        nodeId="id"
        nodeLabel="name"
        nodeColor="color"
        nodeVal="val"
        nodeThreeObject={nodeThreeObject}
        onNodeClick={handleNodeClick}
        onBackgroundClick={handleBackgroundClick}
        linkSource="source"
        linkTarget="target"
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkOpacity={0.6}
        // @ts-expect-error react-force-graph supports linkDistance
        linkDistance={linkDistance}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        enableNodeDrag={true}
        enableNavigationControls={true}
        showNavInfo={false}
        backgroundColor="#0a1929"
        d3VelocityDecay={0.4}
        d3AlphaDecay={0.015}
        d3AlphaMin={0.001}
        warmupTicks={200}
        cooldownTicks={Infinity}
        cooldownTime={20000}
        />
      )}

      {/* Legend */}
      <div className="absolute bottom-6 left-6 rounded-xl text-white text-sm shadow-2xl border border-blue-500-30 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.95) 0%, rgba(10, 25, 41, 0.95) 100%)' }}>
        <div className="px-5 py-3 border-b border-blue-500-20" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
          <div className="font-bold text-blue-200 uppercase tracking-wider text-xs">Legend</div>
        </div>
        <div className="px-5 py-4 space-y-3">
          {legendItems.map(item => (
            <div key={item.kind} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full shadow-lg flex-shrink-0" style={{ backgroundColor: item.color }}></div>
              <span className="font-medium">{item.label}</span>
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
          <div className="font-bold text-blue-200 uppercase tracking-wider">3D Controls</div>
        </div>
        <div className="px-5 py-3 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-lg flex-shrink-0">🖱️</span>
            <span className="font-medium">Click to select</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg flex-shrink-0">🔄</span>
            <span className="font-medium">Drag to rotate</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg flex-shrink-0">🔍</span>
            <span className="font-medium">Scroll to zoom</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg flex-shrink-0">⌨️</span>
            <span className="font-medium">Right-click drag to pan</span>
          </div>
        </div>
      </div>
    </div>
  );
}
