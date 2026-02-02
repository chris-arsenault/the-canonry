/**
 * MiniConstellation - Small network preview showing 1-hop connections
 *
 * Displays the selected entity at center with connected entities arranged
 * in a circular layout around it, showing relationship structure at a glance.
 */

import { useMemo } from 'react';
import type { ConnectedEntity } from '../../../lib/chronicle/storyPotential';

interface MiniConstellationProps {
  /** Center entity name */
  centerName: string;
  /** Connected entities */
  connections: ConnectedEntity[];
  /** Size of the visualization */
  size?: number;
  /** Maximum connections to show (others collapsed) */
  maxConnections?: number;
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

export default function MiniConstellation({
  centerName,
  connections,
  size = 180,
  maxConnections = 8,
}: MiniConstellationProps) {
  const cx = size / 2;
  const cy = size / 2;
  const centerRadius = 16;
  const nodeRadius = 10;
  const orbitRadius = (size / 2) - nodeRadius - 12;

  // Limit and arrange connections
  const visibleConnections = useMemo(() => {
    // Group by kind and take most diverse sample
    const byKind = new Map<string, ConnectedEntity[]>();
    for (const conn of connections) {
      const list = byKind.get(conn.kind) || [];
      list.push(conn);
      byKind.set(conn.kind, list);
    }

    // Take one from each kind first, then fill remaining
    const result: ConnectedEntity[] = [];
    const kindIterators = [...byKind.values()].map(list => list[Symbol.iterator]());

    while (result.length < maxConnections && kindIterators.length > 0) {
      for (let i = kindIterators.length - 1; i >= 0; i--) {
        if (result.length >= maxConnections) break;
        const next = kindIterators[i].next();
        if (next.done) {
          kindIterators.splice(i, 1);
        } else {
          result.push(next.value);
        }
      }
    }

    return result;
  }, [connections, maxConnections]);

  const hiddenCount = connections.length - visibleConnections.length;

  // Position nodes in a circle
  const nodePositions = useMemo(() => {
    const count = visibleConnections.length;
    if (count === 0) return [];

    const angleStep = (2 * Math.PI) / count;
    const startAngle = -Math.PI / 2; // Start from top

    return visibleConnections.map((conn, i) => {
      const angle = startAngle + i * angleStep;
      return {
        ...conn,
        x: cx + orbitRadius * Math.cos(angle),
        y: cy + orbitRadius * Math.sin(angle),
        angle,
      };
    });
  }, [visibleConnections, cx, cy, orbitRadius]);

  const getKindColor = (kind: string): string => {
    return KIND_COLORS[kind.toLowerCase()] || 'var(--text-muted)';
  };

  if (connections.length === 0) {
    return (
      <svg width={size} height={size} style={{ display: 'block' }}>
        {/* Center node */}
        <circle
          cx={cx}
          cy={cy}
          r={centerRadius}
          fill="var(--accent-color)"
        />
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dy={3}
          fontSize="10"
          fill="white"
          fontWeight="500"
        >
          ★
        </text>
        <text
          x={cx}
          y={cy + centerRadius + 14}
          textAnchor="middle"
          fontSize="9"
          fill="var(--text-muted)"
        >
          No connections
        </text>
      </svg>
    );
  }

  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      {/* Connection lines */}
      {nodePositions.map((node, i) => {
        const color = getKindColor(node.kind);
        const strength = node.strength ?? 0.5;

        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={node.x}
            y2={node.y}
            stroke={color}
            strokeWidth={1 + strength * 2}
            strokeOpacity={0.4 + strength * 0.4}
          />
        );
      })}

      {/* Outer nodes */}
      {nodePositions.map((node, i) => {
        const color = getKindColor(node.kind);

        return (
          <g key={i}>
            {/* Node circle */}
            <circle
              cx={node.x}
              cy={node.y}
              r={nodeRadius}
              fill={color}
              opacity={0.9}
            />
            {/* Kind initial */}
            <text
              x={node.x}
              y={node.y}
              textAnchor="middle"
              dy={3}
              fontSize="8"
              fill="white"
              fontWeight="500"
            >
              {node.kind.charAt(0).toUpperCase()}
            </text>
            {/* Name label */}
            <title>{`${node.name} (${node.kind})\n${node.relationshipKind}`}</title>
          </g>
        );
      })}

      {/* Center node (entry point) */}
      <circle
        cx={cx}
        cy={cy}
        r={centerRadius}
        fill="var(--accent-color)"
        stroke="white"
        strokeWidth={2}
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dy={4}
        fontSize="12"
        fill="white"
        fontWeight="600"
      >
        ★
      </text>

      {/* Center label */}
      <text
        x={cx}
        y={size - 6}
        textAnchor="middle"
        fontSize="9"
        fill="var(--text-muted)"
      >
        {visibleConnections.length} connections
        {hiddenCount > 0 && ` (+${hiddenCount})`}
      </text>

      {/* Legend - show unique kinds */}
      {(() => {
        const uniqueKinds = [...new Set(visibleConnections.map(c => c.kind))];
        if (uniqueKinds.length <= 4) {
          return (
            <g>
              {uniqueKinds.map((kind, i) => (
                <g key={kind} transform={`translate(${4 + i * 40}, 4)`}>
                  <circle cx={4} cy={6} r={4} fill={getKindColor(kind)} />
                  <text x={12} y={9} fontSize="8" fill="var(--text-muted)">
                    {kind.slice(0, 4)}
                  </text>
                </g>
              ))}
            </g>
          );
        }
        return null;
      })()}
    </svg>
  );
}
