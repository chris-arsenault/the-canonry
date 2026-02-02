/**
 * EnsembleConstellation - Force-directed graph for role assignment
 *
 * Displays candidates as nodes with the entry point at center.
 * Nodes can be clicked to select, then assigned to roles.
 * Visual encoding: node color = kind, line thickness = strength,
 * opacity = era alignment, red glow = overused.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { EntityContext, RelationshipContext } from '../../../lib/chronicleTypes';
import type { EntitySelectionMetrics } from '../../../lib/chronicle/selectionWizard';

interface ConstellationNode {
  id: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  isEntryPoint: boolean;
  isAssigned: boolean;
  metrics?: EntitySelectionMetrics;
}

interface ConstellationEdge {
  source: string;
  target: string;
  strength: number;
  kind: string;
}

interface EnsembleConstellationProps {
  entryPointId: string;
  candidates: EntityContext[];
  relationships: RelationshipContext[];
  assignedEntityIds: Set<string>;
  metricsMap: Map<string, EntitySelectionMetrics>;
  /** Currently selected entity (for assignment) */
  selectedEntityId: string | null;
  /** Callback when entity is selected */
  onSelectEntity: (entityId: string | null) => void;
  width?: number;
  height?: number;
}

// Color mapping for entity kinds
const KIND_COLORS: Record<string, string> = {
  person: '#6366f1',
  faction: '#8b5cf6',
  location: '#10b981',
  artifact: '#f59e0b',
  creature: '#ec4899',
  event: '#06b6d4',
  concept: '#84cc16',
  organization: '#f97316',
};

/**
 * Simple force simulation - positions nodes in concentric circles by distance
 */
function computeLayout(
  entryPointId: string,
  candidates: EntityContext[],
  metricsMap: Map<string, EntitySelectionMetrics>,
  width: number,
  height: number
): ConstellationNode[] {
  const cx = width / 2;
  const cy = height / 2;
  const nodes: ConstellationNode[] = [];

  // Group candidates by distance
  const byDistance = new Map<number, EntityContext[]>();
  byDistance.set(0, []); // Entry point
  byDistance.set(1, []);
  byDistance.set(2, []);

  for (const entity of candidates) {
    const metrics = metricsMap.get(entity.id);
    const distance = metrics?.distance ?? 2;

    if (entity.id === entryPointId) {
      byDistance.get(0)!.push(entity);
    } else if (distance === 1) {
      byDistance.get(1)!.push(entity);
    } else {
      byDistance.get(2)!.push(entity);
    }
  }

  // Orbit radii
  const radii = {
    0: 0,          // Entry point at center
    1: Math.min(width, height) * 0.25,  // Direct connections
    2: Math.min(width, height) * 0.42,  // 2-hop connections
  };

  // Place nodes in circles
  for (const [distance, entities] of byDistance) {
    const radius = radii[distance as 0 | 1 | 2];
    const count = entities.length;

    if (count === 0) continue;

    const angleStep = (2 * Math.PI) / count;
    const startAngle = -Math.PI / 2; // Start from top

    entities.forEach((entity, i) => {
      const angle = startAngle + i * angleStep;
      // Add slight jitter for 2-hop to avoid exact circles
      const jitter = distance === 2 ? (Math.random() - 0.5) * 15 : 0;

      nodes.push({
        id: entity.id,
        name: entity.name,
        kind: entity.kind,
        x: cx + (radius + jitter) * Math.cos(angle),
        y: cy + (radius + jitter) * Math.sin(angle),
        isEntryPoint: entity.id === entryPointId,
        isAssigned: false, // Will be set by parent
        metrics: metricsMap.get(entity.id),
      });
    });
  }

  return nodes;
}

/**
 * Extract edges from relationships
 */
function computeEdges(
  relationships: RelationshipContext[],
  nodeIds: Set<string>
): ConstellationEdge[] {
  const edges: ConstellationEdge[] = [];
  const seen = new Set<string>();

  for (const rel of relationships) {
    // Only include edges where both nodes exist
    if (!nodeIds.has(rel.src) || !nodeIds.has(rel.dst)) continue;

    // Deduplicate
    const key = [rel.src, rel.dst].sort().join(':');
    if (seen.has(key)) continue;
    seen.add(key);

    edges.push({
      source: rel.src,
      target: rel.dst,
      strength: rel.strength ?? 0.5,
      kind: rel.kind,
    });
  }

  return edges;
}

export default function EnsembleConstellation({
  entryPointId,
  candidates,
  relationships,
  assignedEntityIds,
  metricsMap,
  selectedEntityId,
  onSelectEntity,
  width = 400,
  height = 350,
}: EnsembleConstellationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Compute layout
  const nodes = useMemo(() => {
    const layout = computeLayout(entryPointId, candidates, metricsMap, width, height);
    // Mark assigned nodes
    return layout.map(node => ({
      ...node,
      isAssigned: assignedEntityIds.has(node.id),
    }));
  }, [entryPointId, candidates, metricsMap, width, height, assignedEntityIds]);

  const nodeMap = useMemo(() => {
    return new Map(nodes.map(n => [n.id, n]));
  }, [nodes]);

  // Compute edges
  const edges = useMemo(() => {
    const nodeIds = new Set(nodes.map(n => n.id));
    return computeEdges(relationships, nodeIds);
  }, [relationships, nodes]);

  // Compute bridge nodes (unassigned nodes connected to 2+ unique assigned entities)
  const bridgeNodeIds = useMemo(() => {
    // Map entity ID -> set of unique assigned entity IDs it connects to
    const connectedToAssigned = new Map<string, Set<string>>();

    for (const rel of relationships) {
      const srcAssigned = assignedEntityIds.has(rel.src);
      const dstAssigned = assignedEntityIds.has(rel.dst);

      if (srcAssigned && !dstAssigned) {
        if (!connectedToAssigned.has(rel.dst)) connectedToAssigned.set(rel.dst, new Set());
        connectedToAssigned.get(rel.dst)!.add(rel.src);
      }
      if (dstAssigned && !srcAssigned) {
        if (!connectedToAssigned.has(rel.src)) connectedToAssigned.set(rel.src, new Set());
        connectedToAssigned.get(rel.src)!.add(rel.dst);
      }
    }

    const bridges = new Set<string>();
    for (const [id, assignedConnections] of connectedToAssigned) {
      if (assignedConnections.size >= 2) bridges.add(id);
    }
    return bridges;
  }, [relationships, assignedEntityIds]);

  const getKindColor = (kind: string): string => {
    return KIND_COLORS[kind.toLowerCase()] || 'var(--text-muted)';
  };

  const handleNodeClick = useCallback((nodeId: string) => {
    if (selectedEntityId === nodeId) {
      onSelectEntity(null);
    } else {
      onSelectEntity(nodeId);
    }
  }, [selectedEntityId, onSelectEntity]);

  // Determine node visual properties
  const getNodeStyle = (node: ConstellationNode) => {
    const isSelected = selectedEntityId === node.id;
    const isHovered = hoveredNodeId === node.id;
    const metrics = node.metrics;

    // Base size
    let radius = node.isEntryPoint ? 18 : 12;
    if (isSelected || isHovered) radius += 2;

    // Opacity based on era alignment
    let opacity = 1;
    if (metrics && !metrics.eraAligned && !node.isEntryPoint) {
      opacity = 0.5;
    }

    // Overused indicator
    const isOverused = metrics && metrics.usageCount >= 5;

    return { radius, opacity, isOverused, isSelected, isHovered };
  };

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{
        display: 'block',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
      }}
    >
      {/* Orbit guides */}
      <circle
        cx={width / 2}
        cy={height / 2}
        r={Math.min(width, height) * 0.25}
        fill="none"
        stroke="var(--border-color)"
        strokeWidth={1}
        strokeDasharray="4,4"
        opacity={0.5}
      />
      <circle
        cx={width / 2}
        cy={height / 2}
        r={Math.min(width, height) * 0.42}
        fill="none"
        stroke="var(--border-color)"
        strokeWidth={1}
        strokeDasharray="4,4"
        opacity={0.3}
      />

      {/* Edges */}
      {edges.map((edge, i) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) return null;

        const sourceAssigned = assignedEntityIds.has(edge.source);
        const targetAssigned = assignedEntityIds.has(edge.target);
        const sourceSelected = selectedEntityId === edge.source || hoveredNodeId === edge.source;
        const targetSelected = selectedEntityId === edge.target || hoveredNodeId === edge.target;

        // Determine edge color and style based on node states
        let strokeColor = 'var(--border-color)';
        let strokeOpacity = 0.2;
        let strokeWidth = 1 + edge.strength * 1.5;

        if (sourceAssigned && targetAssigned) {
          // Both assigned - green, prominent
          strokeColor = 'var(--success)';
          strokeOpacity = 0.7;
          strokeWidth = 2 + edge.strength * 2;
        } else if ((sourceAssigned && targetSelected) || (targetAssigned && sourceSelected)) {
          // One assigned, one selected - orange/gold
          strokeColor = 'var(--warning)';
          strokeOpacity = 0.8;
          strokeWidth = 2 + edge.strength * 2;
        } else if (sourceSelected || targetSelected) {
          // One selected, neither assigned - purple
          strokeColor = 'var(--accent-color)';
          strokeOpacity = 0.8;
          strokeWidth = 2 + edge.strength * 2;
        } else if (sourceAssigned || targetAssigned) {
          // One assigned, not selected - cyan to show potential ensemble connections
          strokeColor = '#06b6d4'; // cyan
          strokeOpacity = 0.5;
          strokeWidth = 1.5 + edge.strength * 1.5;
        }

        return (
          <line
            key={i}
            x1={source.x}
            y1={source.y}
            x2={target.x}
            y2={target.y}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeOpacity={strokeOpacity}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map(node => {
        const style = getNodeStyle(node);
        const color = getKindColor(node.kind);

        return (
          <g
            key={node.id}
            style={{ cursor: 'pointer' }}
            onClick={() => handleNodeClick(node.id)}
            onMouseEnter={() => setHoveredNodeId(node.id)}
            onMouseLeave={() => setHoveredNodeId(null)}
          >
            {/* Overused glow */}
            {style.isOverused && (
              <circle
                cx={node.x}
                cy={node.y}
                r={style.radius + 4}
                fill="none"
                stroke="var(--error)"
                strokeWidth={2}
                opacity={0.6}
              />
            )}

            {/* Selection ring */}
            {style.isSelected && (
              <circle
                cx={node.x}
                cy={node.y}
                r={style.radius + 3}
                fill="none"
                stroke="var(--accent-color)"
                strokeWidth={2}
              />
            )}

            {/* Bridge indicator (unassigned node connected to 2+ assigned) */}
            {!node.isAssigned && !node.isEntryPoint && bridgeNodeIds.has(node.id) && (
              <circle
                cx={node.x}
                cy={node.y}
                r={style.radius + 2}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="2,2"
              />
            )}

            {/* Assigned indicator */}
            {node.isAssigned && !node.isEntryPoint && (
              <circle
                cx={node.x}
                cy={node.y}
                r={style.radius + 2}
                fill="none"
                stroke="var(--success)"
                strokeWidth={2}
                strokeDasharray="3,2"
              />
            )}

            {/* Node circle */}
            <circle
              cx={node.x}
              cy={node.y}
              r={style.radius}
              fill={node.isEntryPoint ? 'var(--accent-color)' : color}
              opacity={style.opacity}
              stroke={style.isHovered ? 'white' : 'transparent'}
              strokeWidth={2}
            />

            {/* Entry point star */}
            {node.isEntryPoint && (
              <text
                x={node.x}
                y={node.y}
                textAnchor="middle"
                dy={5}
                fontSize="14"
                fill="white"
                fontWeight="bold"
                style={{ pointerEvents: 'none' }}
              >
                ★
              </text>
            )}

            {/* Kind initial for non-entry-point nodes */}
            {!node.isEntryPoint && (
              <text
                x={node.x}
                y={node.y}
                textAnchor="middle"
                dy={4}
                fontSize="9"
                fill="white"
                fontWeight="500"
                style={{ pointerEvents: 'none' }}
              >
                {node.kind.charAt(0).toUpperCase()}
              </text>
            )}

          </g>
        );
      })}

      {/* Tooltip layer - rendered on top of all nodes */}
      {(() => {
        const tooltipNodeId = hoveredNodeId || selectedEntityId;
        const tooltipNode = tooltipNodeId ? nodeMap.get(tooltipNodeId) : null;
        if (!tooltipNode) return null;

        const style = getNodeStyle(tooltipNode);
        const metrics = tooltipNode.metrics;
        const usageCount = metrics?.usageCount ?? 0;
        const linksToEnsemble = (() => {
          if (tooltipNode.isAssigned) return null; // Don't show for assigned
          let count = 0;
          for (const rel of relationships) {
            if (rel.src === tooltipNode.id && assignedEntityIds.has(rel.dst)) count++;
            if (rel.dst === tooltipNode.id && assignedEntityIds.has(rel.src)) count++;
          }
          return count;
        })();

        // Build info line
        const infoParts: string[] = [];
        if (usageCount > 0) {
          infoParts.push(`${usageCount}× used`);
        } else {
          infoParts.push('unused');
        }
        if (linksToEnsemble !== null) {
          infoParts.push(linksToEnsemble > 0 ? `${linksToEnsemble} link${linksToEnsemble > 1 ? 's' : ''}` : 'no links');
        }

        return (
          <g style={{ pointerEvents: 'none' }}>
            <rect
              x={tooltipNode.x - 52}
              y={tooltipNode.y + style.radius + 4}
              width={104}
              height={28}
              rx={4}
              fill="#1e1e2e"
              stroke="#45475a"
              strokeWidth={1}
            />
            <text
              x={tooltipNode.x}
              y={tooltipNode.y + style.radius + 16}
              textAnchor="middle"
              fontSize="10"
              fill="#cdd6f4"
              fontWeight="500"
            >
              {tooltipNode.name.length > 14 ? tooltipNode.name.slice(0, 14) + '…' : tooltipNode.name}
            </text>
            <text
              x={tooltipNode.x}
              y={tooltipNode.y + style.radius + 27}
              textAnchor="middle"
              fontSize="9"
              fill="#a6adc8"
            >
              {infoParts.join(' · ')}
            </text>
          </g>
        );
      })()}

      {/* Legend */}
      <g transform={`translate(8, ${height - 24})`}>
        <text fontSize="9" fill="var(--text-muted)">
          <tspan fill="var(--success)">―</tspan>
          <tspan dx="2">ensemble</tspan>
          <tspan dx="6" fill="#06b6d4">―</tspan>
          <tspan dx="2">to ensemble</tspan>
          <tspan dx="6" fill="#f59e0b">◌</tspan>
          <tspan dx="2">bridge</tspan>
          <tspan dx="6" fill="var(--error)">◯</tspan>
          <tspan dx="2">overused</tspan>
        </text>
      </g>
    </svg>
  );
}
