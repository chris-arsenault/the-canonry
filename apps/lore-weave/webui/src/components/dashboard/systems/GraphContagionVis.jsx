/**
 * GraphContagionVis - Force-directed graph visualization for graph contagion systems
 *
 * Shows:
 * - Nodes colored by SIR state (Susceptible/Infected/Recovered)
 * - Edges representing transmission vectors (relationship paths)
 * - Animated spreading when playing through ticks
 * - Node size based on connectivity/prominence
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Group } from '@visx/group';
import { ParentSize } from '@visx/responsive';
import * as d3Force from 'd3-force';
import './visualizations.css';

const MARGIN = { top: 20, right: 20, bottom: 20, left: 20 };

// SIR state colors
const STATE_COLORS = {
  susceptible: '#22c55e',
  infected: '#ef4444',
  recovered: '#64748b',
  immune: '#8b5cf6',
};

/**
 * Generate a network graph from snapshot data
 */
function generateNetworkFromSnapshot(snapshot) {
  if (!snapshot?.nodes?.length) {
    return { nodes: [], links: [] };
  }

  // Use fixed coordinate system (0-100 is the semantic plane range)
  // This prevents nodes from "jumping" as the population changes
  const PLANE_MIN = 0;
  const PLANE_MAX = 100;
  const PLANE_RANGE = PLANE_MAX - PLANE_MIN;

  const nodes = snapshot.nodes.map(n => ({
    id: n.id,
    label: n.name?.slice(0, 12) || n.id.slice(0, 8),
    state: n.state || 'susceptible',
    prominence: n.prominence ?? 2.0,  // Default to recognized (2.0)
    // Store normalized coordinates for initial layout hint
    initialX: ((n.x - PLANE_MIN) / PLANE_RANGE) * 400 + 50,
    initialY: ((n.y - PLANE_MIN) / PLANE_RANGE) * 300 + 50,
  }));

  const nodeIds = new Set(nodes.map(n => n.id));

  const links = (snapshot.edges || [])
    .filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map(e => ({
      source: e.source,
      target: e.target,
      strength: e.strength || 0.5,
      kind: e.kind,
      active: false,
    }));

  return { nodes, links };
}

/**
 * Run force simulation to position nodes
 */
function useForceLayout(nodes, links, width, height) {
  const [positions, setPositions] = useState({ nodes: [], links: [] });

  useEffect(() => {
    if (!nodes.length || width === 0 || height === 0) return;

    // Clone nodes and links for simulation
    const simNodes = nodes.map(n => ({ ...n }));
    const simLinks = links.map(l => ({
      ...l,
      source: typeof l.source === 'string' ? l.source : l.source.id,
      target: typeof l.target === 'string' ? l.target : l.target.id,
    }));

    const simulation = d3Force.forceSimulation(simNodes)
      .force('link', d3Force.forceLink(simLinks).id(d => d.id).distance(60).strength(0.3))
      .force('charge', d3Force.forceManyBody().strength(-120))
      .force('center', d3Force.forceCenter(width / 2, height / 2))
      .force('collision', d3Force.forceCollide().radius(20));

    // Run simulation synchronously
    simulation.stop();
    for (let i = 0; i < 120; i++) {
      simulation.tick();
    }

    setPositions({
      nodes: simNodes,
      links: simLinks,
    });

    return () => simulation.stop();
  }, [nodes, links, width, height]);

  return positions;
}

/**
 * Category legend for SIR states
 */
function StateLegend() {
  const states = [
    { key: 'susceptible', label: 'Susceptible' },
    { key: 'infected', label: 'Infected' },
    { key: 'recovered', label: 'Recovered' },
  ];

  return (
    <div className="vis-legend">
      <div className="vis-legend-title">Node State</div>
      <div className="vis-legend-categories">
        {states.map(s => (
          <div key={s.key} className="vis-legend-item">
            <div
              className="vis-legend-swatch circle"
              style={{ backgroundColor: STATE_COLORS[s.key] }}
            />
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Main graph visualization component
 */
function ContagionGraph({ width, height, network, config, selectedTick, isPlaying }) {
  const [tooltip, setTooltip] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const svgRef = useRef(null);

  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  // Run force layout
  const { nodes, links } = useForceLayout(network.nodes, network.links, innerWidth, innerHeight);

  // Get node size based on prominence
  const getNodeRadius = useCallback((node) => {
    switch (node.prominence) {
      case 'mythic': return 16;
      case 'renowned': return 12;
      case 'recognized': return 9;
      case 'marginal': return 6;
      default: return 8;
    }
  }, []);

  // Handle node hover
  const handleNodeEnter = useCallback((event, node) => {
    setHoveredNode(node.id);
    setTooltip({
      x: event.clientX,
      y: event.clientY,
      node,
    });
  }, []);

  const handleNodeLeave = useCallback(() => {
    setHoveredNode(null);
    setTooltip(null);
  }, []);

  // Find connected links for highlighting
  const connectedLinks = useMemo(() => {
    if (!hoveredNode) return new Set();
    return new Set(
      links
        .filter(l => {
          const srcId = typeof l.source === 'object' ? l.source.id : l.source;
          const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
          return srcId === hoveredNode || tgtId === hoveredNode;
        })
        .map((_, i) => i)
    );
  }, [hoveredNode, links]);

  if (!nodes.length) {
    return (
      <svg width={width} height={height}>
        <text x={width / 2} y={height / 2} textAnchor="middle" fill="#64748b">
          Computing layout...
        </text>
      </svg>
    );
  }

  return (
    <>
      <svg ref={svgRef} width={width} height={height} className="graph-contagion-vis">
        <Group left={MARGIN.left} top={MARGIN.top}>
          {/* Background */}
          <rect
            x={0}
            y={0}
            width={innerWidth}
            height={innerHeight}
            fill="#0f172a"
            rx={4}
          />

          {/* Links */}
          {links.map((link, i) => {
            const source = typeof link.source === 'object' ? link.source : nodes.find(n => n.id === link.source);
            const target = typeof link.target === 'object' ? link.target : nodes.find(n => n.id === link.target);

            if (!source || !target) return null;

            const isHighlighted = connectedLinks.has(i);
            const isActive = link.active || (isPlaying && source.state === 'infected');

            return (
              <line
                key={i}
                className={`link ${isActive ? 'active' : ''}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={isHighlighted ? '#60a5fa' : 'rgba(148, 163, 184, 0.3)'}
                strokeWidth={isHighlighted ? 2 : 1 + link.strength}
                strokeOpacity={isHighlighted ? 0.8 : 0.4}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const radius = getNodeRadius(node);
            const isHovered = hoveredNode === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={(e) => handleNodeEnter(e, node)}
                onMouseLeave={handleNodeLeave}
              >
                {/* Glow effect for infected nodes */}
                {node.state === 'infected' && (
                  <circle
                    r={radius + 6}
                    fill="none"
                    stroke={STATE_COLORS.infected}
                    strokeWidth={2}
                    strokeOpacity={0.3}
                  />
                )}

                {/* Main node */}
                <circle
                  className="node"
                  r={isHovered ? radius + 3 : radius}
                  fill={STATE_COLORS[node.state] || STATE_COLORS.susceptible}
                  stroke={isHovered ? '#fff' : 'rgba(0,0,0,0.3)'}
                  strokeWidth={isHovered ? 2 : 1}
                />

                {/* Label for prominent nodes (renowned >= 3.0, mythic >= 4.0) */}
                {(node.prominence >= 3.0 || isHovered) && (
                  <text
                    y={-radius - 6}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize={10}
                    fontWeight={isHovered ? 600 : 400}
                  >
                    {node.label}
                  </text>
                )}
              </g>
            );
          })}
        </Group>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="vis-tooltip"
          style={{
            left: tooltip.x + 15,
            top: tooltip.y - 10,
          }}
        >
          <div className="vis-tooltip-header">{tooltip.node.label}</div>
          <div className="vis-tooltip-row">
            <span className="vis-tooltip-label">State</span>
            <span
              className="vis-tooltip-value"
              style={{ color: STATE_COLORS[tooltip.node.state] }}
            >
              {tooltip.node.state}
            </span>
          </div>
          <div className="vis-tooltip-row">
            <span className="vis-tooltip-label">Prominence</span>
            <span className="vis-tooltip-value">{tooltip.node.prominence}</span>
          </div>
          <div className="vis-tooltip-row">
            <span className="vis-tooltip-label">Connections</span>
            <span className="vis-tooltip-value">
              {links.filter(l => {
                const srcId = typeof l.source === 'object' ? l.source.id : l.source;
                const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
                return srcId === tooltip.node.id || tgtId === tooltip.node.id;
              }).length}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Main exported component
 */
export function GraphContagionVis({ config, systemActions, selectedTick }) {
  // Find all snapshots from systemActions
  const snapshots = useMemo(() => {
    if (!systemActions?.length) return [];
    return systemActions
      .filter(a => a.details?.contagionSnapshot)
      .map(a => ({
        tick: a.tick,
        snapshot: a.details.contagionSnapshot,
      }))
      .sort((a, b) => a.tick - b.tick);
  }, [systemActions]);

  // Find snapshot for current tick
  const currentSnapshot = useMemo(() => {
    if (!snapshots.length) return null;

    // If no tick selected, return most recent snapshot
    if (selectedTick === undefined || selectedTick === null) {
      return snapshots[snapshots.length - 1].snapshot;
    }

    // Find snapshot at or before selected tick
    // If no snapshot exists yet at that tick, return null (don't show future data)
    const atOrBefore = snapshots.filter(s => s.tick <= selectedTick);
    if (atOrBefore.length > 0) {
      return atOrBefore[atOrBefore.length - 1].snapshot;
    }
    return null;
  }, [snapshots, selectedTick]);

  // Generate network from snapshot
  const network = useMemo(() => {
    if (!currentSnapshot) return { nodes: [], links: [] };
    return generateNetworkFromSnapshot(currentSnapshot);
  }, [currentSnapshot]);

  if (!config) {
    return (
      <div className="vis-empty">
        <div className="vis-empty-icon">&#9673;</div>
        <div>No contagion configuration</div>
      </div>
    );
  }

  if (!currentSnapshot) {
    return (
      <div className="vis-empty">
        <div className="vis-empty-icon">&#9673;</div>
        <div>No contagion data</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
          Run simulation with {config.name} enabled
        </div>
      </div>
    );
  }

  // Get state counts from snapshot
  const counts = currentSnapshot.counts || {};
  const newInfections = currentSnapshot.newInfections?.length || 0;

  return (
    <div className="vis-container">
      <div className="vis-container-header">
        <div className="vis-container-title">
          {config.name}
          <span style={{ color: '#64748b', marginLeft: 8 }}>
            S:{counts.susceptible || 0} I:{counts.infected || 0} R:{counts.recovered || 0}
          </span>
        </div>
        {newInfections > 0 && (
          <div style={{ fontSize: 11, color: '#ef4444' }}>
            +{newInfections} new infections
          </div>
        )}
      </div>
      <div className="vis-container-body" style={{ height: 'calc(100% - 40px)' }}>
        <ParentSize>
          {({ width, height }) => (
            width > 0 && height > 0 && (
              <ContagionGraph
                width={width}
                height={height}
                network={network}
                config={config}
                selectedTick={selectedTick}
                isPlaying={false}
              />
            )
          )}
        </ParentSize>
        <StateLegend />
      </div>
    </div>
  );
}

export default GraphContagionVis;
