/**
 * GraphContagionVis - Force-directed graph visualization for graph contagion systems
 */

import React, { useMemo, useState, useCallback, useRef } from "react";
import { Group } from "@visx/group";
import { ParentSize } from "@visx/responsive";
import * as d3Force from "d3-force";
import "./visualizations.css";

const MARGIN = { top: 20, right: 20, bottom: 20, left: 20 };

const STATE_COLORS: Record<string, string> = {
  susceptible: "#22c55e",
  infected: "#ef4444",
  recovered: "#64748b",
  immune: "#8b5cf6",
};

interface SnapshotNode {
  id: string;
  name: string;
  state: string;
  prominence: number;
  x: number;
  y: number;
}

interface SnapshotEdge {
  source: string;
  target: string;
  strength: number;
  kind: string;
}

interface ContagionSnapshot {
  nodes: SnapshotNode[];
  edges: SnapshotEdge[];
  counts: Record<string, number>;
  newInfections: unknown[];
}

interface GraphNode {
  id: string;
  label: string;
  state: string;
  prominence: number;
  initialX: number;
  initialY: number;
  x: number;
  y: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  strength: number;
  kind: string;
  active: boolean;
}

interface SystemConfig {
  name: string;
  [key: string]: unknown;
}

interface SystemAction {
  tick: number;
  details: { contagionSnapshot: ContagionSnapshot | null; [key: string]: unknown };
}

function generateNetworkFromSnapshot(snapshot: ContagionSnapshot): { nodes: GraphNode[]; links: GraphLink[] } {
  if (!snapshot.nodes?.length) return { nodes: [], links: [] };

  const PLANE_MIN = 0;
  const PLANE_MAX = 100;
  const PLANE_RANGE = PLANE_MAX - PLANE_MIN;

  const nodes: GraphNode[] = snapshot.nodes.map((n) => ({
    id: n.id,
    label: n.name?.slice(0, 12) || n.id.slice(0, 8),
    state: n.state || "susceptible",
    prominence: n.prominence ?? 2.0,
    initialX: (((n.x || 0) - PLANE_MIN) / PLANE_RANGE) * 400 + 50,
    initialY: (((n.y || 0) - PLANE_MIN) / PLANE_RANGE) * 300 + 50,
  }));

  const nodeIds = new Set(nodes.map((n) => n.id));

  const links: GraphLink[] = (snapshot.edges || [])
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e) => ({
      source: e.source,
      target: e.target,
      strength: e.strength || 0.5,
      kind: e.kind,
      active: false,
    }));

  return { nodes, links };
}

function useForceLayout(nodes: GraphNode[], links: GraphLink[], width: number, height: number) {
  return useMemo(() => {
    if (!nodes.length || width === 0 || height === 0) return { nodes: [] as GraphNode[], links: [] as GraphLink[] };

    const simNodes = nodes.map((n) => ({ ...n }));
    const simLinks = links.map((l) => ({
      ...l,
      source: typeof l.source === "string" ? l.source : l.source.id,
      target: typeof l.target === "string" ? l.target : l.target.id,
    }));

    const simulation = d3Force
      .forceSimulation(simNodes)
      .force("link", d3Force.forceLink(simLinks).id((d) => d.id).distance(60).strength(0.3))
      .force("charge", d3Force.forceManyBody().strength(-120))
      .force("center", d3Force.forceCenter(width / 2, height / 2))
      .force("collision", d3Force.forceCollide().radius(20));

    simulation.stop();
    for (let i = 0; i < 120; i++) simulation.tick();
    simulation.stop();

    return { nodes: simNodes as GraphNode[], links: simLinks as unknown as GraphLink[] };
  }, [nodes, links, width, height]);
}

function StateLegend() {
  const states = [
    { key: "susceptible", label: "Susceptible" },
    { key: "infected", label: "Infected" },
    { key: "recovered", label: "Recovered" },
  ];

  return (
    <div className="vis-legend">
      <div className="vis-legend-title">Node State</div>
      <div className="vis-legend-categories">
        {states.map((s) => (
          <div key={s.key} className="vis-legend-item">
            <div
              className="vis-legend-swatch circle vis-legend-swatch-dynamic"
              style={{ '--vis-swatch-color': STATE_COLORS[s.key] } as React.CSSProperties}
            />
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ContagionGraphProps {
  width: number;
  height: number;
  network: { nodes: GraphNode[]; links: GraphLink[] };
  isPlaying: boolean;
}

function ContagionGraph({ width, height, network, isPlaying }: Readonly<ContagionGraphProps>) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: GraphNode } | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const { nodes, links } = useForceLayout(network.nodes, network.links, innerWidth, innerHeight);

  const getNodeRadius = useCallback((node: GraphNode) => {
    if (node.prominence >= 4.0) return 16;
    if (node.prominence >= 3.0) return 12;
    if (node.prominence >= 2.0) return 9;
    if (node.prominence >= 1.0) return 6;
    return 8;
  }, []);

  const handleNodeEnter = useCallback((event: React.MouseEvent, node: GraphNode) => {
    setHoveredNode(node.id);
    setTooltip({ x: event.clientX, y: event.clientY, node });
  }, []);

  const handleNodeLeave = useCallback(() => {
    setHoveredNode(null);
    setTooltip(null);
  }, []);

  const connectedLinks = useMemo(() => {
    if (!hoveredNode) return new Set<number>();
    return new Set(
      links
        .map((l, i) => {
          const srcId = typeof l.source === "object" ? l.source.id : l.source;
          const tgtId = typeof l.target === "object" ? l.target.id : l.target;
          return srcId === hoveredNode || tgtId === hoveredNode ? i : -1;
        })
        .filter((i) => i >= 0)
    );
  }, [hoveredNode, links]);

  if (!nodes.length) {
    return (
      <svg width={width} height={height}>
        <text x={width / 2} y={height / 2} textAnchor="middle" fill="#64748b">Computing layout...</text>
      </svg>
    );
  }

  return (
    <>
      <svg ref={svgRef} width={width} height={height} className="graph-contagion-vis">
        <Group left={MARGIN.left} top={MARGIN.top}>
          <rect x={0} y={0} width={innerWidth} height={innerHeight} fill="#0f172a" rx={4} />

          {links.map((link, i) => {
            const source = typeof link.source === "object" ? link.source : nodes.find((n) => n.id === link.source);
            const target = typeof link.target === "object" ? link.target : nodes.find((n) => n.id === link.target);
            if (!source || !target) return null;

            const isHighlighted = connectedLinks.has(i);
            const isActive = link.active || (isPlaying && source.state === "infected");

            return (
              <line
                key={i}
                className={`link ${isActive ? "active" : ""}`}
                x1={source.x} y1={source.y} x2={target.x} y2={target.y}
                stroke={isHighlighted ? "#60a5fa" : "rgba(148, 163, 184, 0.3)"}
                strokeWidth={isHighlighted ? 2 : 1 + link.strength}
                strokeOpacity={isHighlighted ? 0.8 : 0.4}
              />
            );
          })}

          {nodes.map((node) => {
            const radius = getNodeRadius(node);
            const isHovered = hoveredNode === node.id;

            return (
              <g key={node.id} transform={`translate(${String(node.x)}, ${String(node.y)})`} onMouseEnter={(e) => handleNodeEnter(e, node)} onMouseLeave={handleNodeLeave}>
                {node.state === "infected" && (
                  <circle r={radius + 6} fill="none" stroke={STATE_COLORS.infected} strokeWidth={2} strokeOpacity={0.3} />
                )}
                <circle className="node" r={isHovered ? radius + 3 : radius} fill={STATE_COLORS[node.state] || STATE_COLORS.susceptible} stroke={isHovered ? "#fff" : "rgba(0,0,0,0.3)"} strokeWidth={isHovered ? 2 : 1} />
                {(node.prominence >= 3.0 || isHovered) && (
                  <text y={-radius - 6} textAnchor="middle" fill="#94a3b8" fontSize={10} fontWeight={isHovered ? 600 : 400}>{node.label}</text>
                )}
              </g>
            );
          })}
        </Group>
      </svg>

      {tooltip && (
        <div className="vis-tooltip vis-tooltip-dynamic" style={{ '--vis-tooltip-left': `${String(tooltip.x + 15)}px`, '--vis-tooltip-top': `${String(tooltip.y - 10)}px` } as React.CSSProperties}>
          <div className="vis-tooltip-header">{tooltip.node.label}</div>
          <div className="vis-tooltip-row">
            <span className="vis-tooltip-label">State</span>
            <span className="vis-tooltip-value vis-tooltip-value-dynamic" style={{ '--vis-tooltip-value-color': STATE_COLORS[tooltip.node.state] } as React.CSSProperties}>{tooltip.node.state}</span>
          </div>
          <div className="vis-tooltip-row">
            <span className="vis-tooltip-label">Prominence</span>
            <span className="vis-tooltip-value">{tooltip.node.prominence}</span>
          </div>
          <div className="vis-tooltip-row">
            <span className="vis-tooltip-label">Connections</span>
            <span className="vis-tooltip-value">
              {links.filter((l) => {
                const srcId = typeof l.source === "object" ? l.source.id : l.source;
                const tgtId = typeof l.target === "object" ? l.target.id : l.target;
                return srcId === tooltip.node.id || tgtId === tooltip.node.id;
              }).length}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

interface GraphContagionVisProps {
  config: SystemConfig | null;
  systemActions: SystemAction[];
  selectedTick?: number | null;
}

export function GraphContagionVis({ config, systemActions, selectedTick }: Readonly<GraphContagionVisProps>) {
  const snapshots = useMemo(() => {
    if (!systemActions?.length) return [];
    return systemActions
      .filter((a) => a.details?.contagionSnapshot)
      .map((a) => ({ tick: a.tick, snapshot: a.details.contagionSnapshot }))
      .sort((a, b) => a.tick - b.tick);
  }, [systemActions]);

  const currentSnapshot = useMemo(() => {
    if (!snapshots.length) return null;
    if (selectedTick === undefined || selectedTick === null) {
      return snapshots[snapshots.length - 1].snapshot;
    }
    const atOrBefore = snapshots.filter((s) => s.tick <= selectedTick);
    return atOrBefore.length > 0 ? atOrBefore[atOrBefore.length - 1].snapshot : null;
  }, [snapshots, selectedTick]);

  const network = useMemo(() => {
    if (!currentSnapshot) return { nodes: [] as GraphNode[], links: [] as GraphLink[] };
    return generateNetworkFromSnapshot(currentSnapshot);
  }, [currentSnapshot]);

  if (!config) {
    return (<div className="vis-empty"><div className="vis-empty-icon">&#9673;</div><div>No contagion configuration</div></div>);
  }

  if (!currentSnapshot) {
    return (<div className="vis-empty"><div className="vis-empty-icon">&#9673;</div><div>No contagion data</div><div className="vis-info-hint">Run simulation with {config.name} enabled</div></div>);
  }

  const counts = currentSnapshot.counts || {};
  const newInfections = currentSnapshot.newInfections?.length || 0;

  return (
    <div className="vis-container">
      <div className="vis-container-header">
        <div className="vis-container-title">
          {config.name}
          <span className="vis-subtitle">S:{counts.susceptible || 0} I:{counts.infected || 0} R:{counts.recovered || 0}</span>
        </div>
        {newInfections > 0 && <div className="vis-info-danger">+{newInfections} new infections</div>}
      </div>
      <div className="vis-container-body vis-container-body-full">
        <ParentSize>
          {({ width, height }) =>
            width > 0 && height > 0 && (
              <ContagionGraph width={width} height={height} network={network} isPlaying={false} />
            )
          }
        </ParentSize>
        <StateLegend />
      </div>
    </div>
  );
}

export default GraphContagionVis;
