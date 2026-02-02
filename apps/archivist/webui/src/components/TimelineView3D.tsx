import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import type { WorldState } from '../types/world.ts';
import type { ProminenceScale } from '@canonry/world-schema';
import { getKindColor, prominenceToNumber } from '../utils/dataTransform.ts';
import * as THREE from 'three';

export type EdgeMetric = 'strength' | 'distance' | 'none';

interface TimelineView3DProps {
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
  createdAt: number;
  // Fixed position for era nodes (undefined = free)
  fx?: number;
  fy?: number;
  fz?: number;
}

interface GraphLink {
  source: string;
  target: string;
  kind: string;
  strength: number;
  distance?: number;
  catalyzed?: boolean;
  isCreatedDuring?: boolean;
}

// Era spacing along X-axis
const ERA_SPACING = 200;
const ERA_Y_POSITION = 0;
const ERA_Z_POSITION = 0;

// Relationship kinds that link entities to eras
const ERA_RELATIONSHIP_KINDS = ['active_during', 'created_during'];

export default function TimelineView3D({
  data,
  selectedNodeId,
  onNodeSelect,
  showCatalyzedBy = false,
  edgeMetric = 'strength',
  prominenceScale
}: TimelineView3DProps) {
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
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    }
  }, []);

  // Identify eras and sort by createdAt
  const { eraPositions, entityEraMap } = useMemo(() => {
    const eras = data.hardState
      .filter(e => e.kind === 'era')
      .sort((a, b) => a.createdAt - b.createdAt);

    const positions = new Map<string, number>();
    eras.forEach((era, index) => {
      // Center the timeline: first era at negative X, progressing to positive
      const centerOffset = (eras.length - 1) * ERA_SPACING / 2;
      positions.set(era.id, index * ERA_SPACING - centerOffset);
    });

    // Build entity -> era mapping
    // Priority: 1. eraId field, 2. created_during relationship, 3. first era
    const entityToEra = new Map<string, string>();
    const firstEraId = eras.length > 0 ? eras[0].id : null;

    // First pass: use eraId field directly
    data.hardState.forEach(entity => {
      if (entity.kind !== 'era' && (entity as any).eraId) {
        entityToEra.set(entity.id, (entity as any).eraId);
      }
    });

    // Second pass: use created_during relationships for entities without eraId
    data.relationships.forEach(rel => {
      if (rel.kind === 'created_during' && !entityToEra.has(rel.src)) {
        // created_during: src is entity, dst is era
        if (positions.has(rel.dst)) {
          entityToEra.set(rel.src, rel.dst);
        }
      }
    });

    // Third pass: entities still without era get assigned to first era
    data.hardState.forEach(entity => {
      if (entity.kind !== 'era' && !entityToEra.has(entity.id) && firstEraId) {
        entityToEra.set(entity.id, firstEraId);
      }
    });

    return { eraPositions: positions, entityEraMap: entityToEra };
  }, [data.hardState, data.relationships]);

  const legendItems = useMemo(() => {
    return data.schema.entityKinds
      .filter(kind => kind.kind !== 'era')
      .map(kind => {
        const label = kind.style?.displayName || kind.description || kind.kind;
        return {
          kind: kind.kind,
          label,
          color: getKindColor(kind.kind, data.schema),
        };
      });
  }, [data.schema]);

  // Transform data to force-graph format
  const graphData = useMemo(() => {
    const nodes: GraphNode[] = data.hardState.map(entity => {
      const isEra = entity.kind === 'era';

      // For eras: use their fixed position
      // For entities: get their era's X position as a soft target (not fixed)
      let eraX: number | undefined;
      if (isEra) {
        eraX = eraPositions.get(entity.id);
      } else {
        const entityEraId = entityEraMap.get(entity.id);
        if (entityEraId) {
          eraX = eraPositions.get(entityEraId);
        }
      }

      return {
        id: entity.id,
        name: entity.name,
        kind: entity.kind,
        prominence: prominenceToNumber(entity.prominence, data.schema, prominenceScale),
        color: isEra ? '#FFD700' : getKindColor(entity.kind, data.schema), // Gold for eras
        val: isEra ? 6 : prominenceToNumber(entity.prominence, data.schema, prominenceScale) + 1, // Eras are larger
        createdAt: entity.createdAt,
        // Fix era positions along X-axis, but not entity positions
        fx: isEra ? eraX : undefined,
        fy: isEra ? ERA_Y_POSITION : undefined,
        fz: isEra ? ERA_Z_POSITION : undefined,
        // Store the target X position for non-era entities (used by force simulation)
        _targetX: isEra ? undefined : eraX,
      } as GraphNode & { _targetX?: number };
    });

    const links: GraphLink[] = data.relationships.map(rel => {
      const catalyzedBy = (rel as any).catalyzedBy;
      // Both active_during and created_during link entities to eras
      const isEraLink = ERA_RELATIONSHIP_KINDS.includes(rel.kind);

      return {
        source: rel.src,
        target: rel.dst,
        kind: rel.kind,
        strength: rel.strength ?? 0.5,
        distance: rel.distance,
        catalyzed: showCatalyzedBy && !!catalyzedBy,
        isCreatedDuring: isEraLink, // Renamed to isEraLink semantically, but keeping field name for compatibility
      };
    });

    return { nodes, links };
  }, [data, showCatalyzedBy, eraPositions, entityEraMap, prominenceScale]);

  // Generate a stable key - includes mountId for fresh instance on remount,
  // and entity count for clean reset when filters change
  const graphKey = useMemo(() => {
    return `timeline-${mountId}-${data.hardState.length}`;
  }, [mountId, data.hardState.length]);

  // Calculate link distance based on selected metric and relationship type
  const linkDistance = useCallback((link: any) => {
    // created_during links should be shorter to pull entities toward their era
    if (link.isCreatedDuring) {
      return 50; // Short distance to cluster near era
    }

    if (edgeMetric === 'none') {
      return 100;
    } else if (edgeMetric === 'distance') {
      const dist = link.distance ?? 0.5;
      return 30 + dist * 170;
    } else {
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
    const isEra = node.kind === 'era';

    // Node geometry - eras are special
    const geometry = isEra
      ? new THREE.BoxGeometry(node.val * 3, node.val * 3, node.val * 3)
      : new THREE.SphereGeometry(node.val * 2, 16, 16);

    const material = new THREE.MeshLambertMaterial({
      color: node.color,
      transparent: true,
      opacity: node.id === selectedNodeId ? 1 : 0.9
    });
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);

    // Add glow for selected node
    if (node.id === selectedNodeId) {
      const glowGeometry = isEra
        ? new THREE.BoxGeometry(node.val * 4, node.val * 4, node.val * 4)
        : new THREE.SphereGeometry(node.val * 2.5, 16, 16);
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

      context.fillStyle = isEra ? 'rgba(50, 40, 0, 0.8)' : 'rgba(0, 0, 0, 0.7)';
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.font = isEra ? 'Bold 24px Arial' : 'Bold 20px Arial';
      context.fillStyle = isEra ? '#FFD700' : 'white';
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
      sprite.scale.set(isEra ? 30 : 20, isEra ? 7.5 : 5, 1);
      sprite.position.set(0, node.val * (isEra ? 3 : 2) + 5, 0);
      group.add(sprite);
    }

    return group;
  }, [selectedNodeId]);

  // Custom link appearance
  const linkColor = useCallback((link: any) => {
    if (link.isCreatedDuring) {
      return '#FFD70088'; // Golden for created_during links
    }
    if (link.catalyzed) {
      return '#a78bfa';
    }
    const opacity = Math.floor(link.strength * 255).toString(16).padStart(2, '0');
    return `#ffffff${opacity}`;
  }, []);

  const linkWidth = useCallback((link: any) => {
    if (link.isCreatedDuring) {
      return 1; // Thinner for created_during to reduce visual clutter
    }
    return link.strength * 2;
  }, []);

  // Set initial camera position and cleanup on unmount
  useEffect(() => {
    if (!isReady || !fgRef.current) {
      return;
    }

    const camera = fgRef.current.camera();
    // Position camera to see timeline from the side
    camera.position.set(0, 200, 500);

    // Cleanup: pause animation when component unmounts to prevent stale tick errors
    return () => {
      if (fgRef.current) {
        fgRef.current.pauseAnimation?.();
        // Also stop the d3 simulation
        const simulation = fgRef.current.d3Force?.('simulation');
        simulation?.stop?.();
      }
    };
  }, [isReady]);

  // Configure d3 forces for timeline layout
  useEffect(() => {
    if (!isReady || !fgRef.current) {
      return;
    }

    const fg = fgRef.current;

    // Configure the d3 link force
    const linkForce = fg.d3Force('link');
    if (linkForce) {
      linkForce
        .distance((link: any) => {
          // Era links (active_during, created_during) are shorter to cluster near era
          if (link.isCreatedDuring) {
            return 50;
          }
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
        .strength((link: any) => {
          // Era links have higher strength to pull entities toward eras
          if (link.isCreatedDuring) {
            return 1.5;
          }
          return 0.5;
        });

      fg.d3ReheatSimulation();
    }

    // Add custom force to pull entities toward their era's X position
    // This works even for entities without direct era relationships
    fg.d3Force('eraX', (alpha: number) => {
      graphData.nodes.forEach((node: any) => {
        if (node.kind !== 'era' && node._targetX !== undefined && node.fx === undefined) {
          // Pull toward era's X position
          const dx = node._targetX - (node.x ?? 0);
          node.vx = (node.vx || 0) + dx * alpha * 0.1;
        }
      });
    });

    // Add a weak force pushing non-era nodes away from Y=0 axis
    // This spreads entities vertically while keeping them near their era
    fg.d3Force('spreadY', (alpha: number) => {
      graphData.nodes.forEach((node: any) => {
        if (node.kind !== 'era' && node.fy === undefined) {
          // Weak force pushing away from y=0
          const sign = (node.y ?? 0) >= 0 ? 1 : -1;
          node.vy = (node.vy || 0) + sign * alpha * 0.5;
        }
      });
    });
  }, [edgeMetric, graphData.nodes, isReady]);

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
      <div className="absolute bottom-6 left-6 rounded-xl text-white text-sm shadow-2xl border border-amber-500/30 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(50, 40, 20, 0.95) 0%, rgba(20, 15, 5, 0.95) 100%)' }}>
        <div className="px-5 py-3 border-b border-amber-500/20" style={{ background: 'rgba(255, 215, 0, 0.1)' }}>
          <div className="font-bold text-amber-200 uppercase tracking-wider text-xs">Timeline View</div>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded shadow-lg flex-shrink-0" style={{ backgroundColor: '#FFD700' }}></div>
            <span className="font-medium">Eras (fixed timeline)</span>
          </div>
          {legendItems.map(item => (
            <div key={item.kind} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full shadow-lg flex-shrink-0" style={{ backgroundColor: item.color }}></div>
              <span className="font-medium">{item.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <div className="w-8 h-0.5 shadow-lg flex-shrink-0" style={{ backgroundColor: '#FFD700' }}></div>
            <span className="font-medium">Era links</span>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-amber-500/20" style={{ background: 'rgba(255, 215, 0, 0.05)' }}>
          <div className="text-xs text-amber-300 italic">Entities cluster near their creation era</div>
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute top-6 left-6 rounded-xl text-white text-xs shadow-2xl border border-amber-500/30 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(50, 40, 20, 0.95) 0%, rgba(20, 15, 5, 0.95) 100%)' }}>
        <div className="px-5 py-3 border-b border-amber-500/20" style={{ background: 'rgba(255, 215, 0, 0.1)' }}>
          <div className="font-bold text-amber-200 uppercase tracking-wider">Timeline Controls</div>
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
            <span className="text-lg flex-shrink-0">⏳</span>
            <span className="font-medium">Eras aligned on X-axis</span>
          </div>
        </div>
      </div>
    </div>
  );
}
