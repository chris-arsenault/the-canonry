/**
 * CausalLoopEditor - Visualizes causal relationships between pressures, generators, systems
 *
 * Uses react-force-graph-2d for interactive zoom/pan and force-directed layout.
 * Shows nodes (pressures/generators/systems/entity-kinds) and edges with polarity (+/-).
 */

import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

// Node type configurations
const NODE_TYPES = {
  pressure: { color: '#f59e0b', label: 'Pressure', abbrev: 'P', val: 5 },
  generator: { color: '#22c55e', label: 'Generator', abbrev: 'G', val: 4 },
  system: { color: '#8b5cf6', label: 'System', abbrev: 'S', val: 4 },
  action: { color: '#06b6d4', label: 'Action', abbrev: 'A', val: 3 },
  entityKind: { color: '#60a5fa', label: 'Entity Kind', abbrev: 'E', val: 3 },
};

const EDGE_COLORS = {
  positive: '#22c55e',
  negative: '#ef4444',
  neutral: '#6b7280',
};

/**
 * Extract all causal nodes and edges from config data
 * Returns { nodes, links, warnings } where warnings contains any referential integrity issues
 */
function extractCausalGraph(pressures, generators, systems, actions, schema, showDisabled = true, usageMap) {
  const nodes = [];
  const pendingEdges = [];
  const nodeMap = new Map();
  const warnings = [];
  const touchEdgeKeys = new Set();

  // Helper to add node if not exists
  const addNode = (id, type, label, data = {}, isDisabled = false) => {
    if (!nodeMap.has(id)) {
      const config = NODE_TYPES[type] || NODE_TYPES.entityKind;
      const node = {
        id,
        type,
        label,
        data,
        color: config.color,
        val: config.val,
        abbrev: config.abbrev,
        isDisabled,
      };
      nodes.push(node);
      nodeMap.set(id, node);
    }
    return nodeMap.get(id);
  };

  const addPressureEdgesFromChangeMap = (sourceId, pressureChanges = {}, edgeType = 'direct') => {
    Object.entries(pressureChanges || {}).forEach(([pressureId, delta]) => {
      if (typeof delta !== 'number') return;
      const polarity = delta >= 0 ? 'positive' : 'negative';
      pendingEdges.push({
        source: sourceId,
        target: `pressure:${pressureId}`,
        polarity,
        label: delta > 0 ? `+${delta}` : `${delta}`,
        edgeType,
      });
    });
  };

  const addPressureEdgesFromMutations = (sourceId, mutations) => {
    const stack = Array.isArray(mutations) ? [...mutations] : [mutations];
    while (stack.length > 0) {
      const mutation = stack.pop();
      if (!mutation || typeof mutation !== 'object') continue;
      if (mutation.type === 'modify_pressure' && mutation.pressureId) {
        const delta = Number(mutation.delta || 0);
        const polarity = delta >= 0 ? 'positive' : 'negative';
        pendingEdges.push({
          source: sourceId,
          target: `pressure:${mutation.pressureId}`,
          polarity,
          label: delta > 0 ? `+${delta}` : `${delta}`,
          edgeType: 'direct',
        });
      }
      Object.values(mutation).forEach((value) => {
        if (Array.isArray(value)) {
          value.forEach((entry) => stack.push(entry));
        } else if (value && typeof value === 'object') {
          stack.push(value);
        }
      });
    }
  };

  const addEntityKindEdge = (sourceId, kind, label = 'touches') => {
    if (!kind || kind === 'any') return;
    const targetId = `entityKind:${kind}`;
    addNode(targetId, 'entityKind', kind);
    const edgeKey = `${sourceId}|${targetId}`;
    if (touchEdgeKeys.has(edgeKey)) return;
    touchEdgeKeys.add(edgeKey);
    pendingEdges.push({
      source: sourceId,
      target: targetId,
      polarity: 'neutral',
      label,
      edgeType: 'touches',
    });
  };

  // 1. Add pressure nodes
  pressures.forEach(p => {
    addNode(`pressure:${p.id}`, 'pressure', p.name || p.id, { pressure: p });
  });

  // 2. Add generator nodes and their edges to pressures
  generators.forEach(g => {
    const gId = g.id;
    const gName = g.name || gId;
    const isDisabled = g.enabled === false;
    addNode(`generator:${gId}`, 'generator', gName, { generator: g }, isDisabled);

    // Direct pressure modifications via stateUpdates
    addPressureEdgesFromMutations(`generator:${gId}`, g.stateUpdates || []);

    // Generator creates entities - extract from creation array
    const creation = g.creation || [];
    const createdKinds = new Set();
    creation.forEach(c => {
      // kind can be a string or an object with inherit
      const kind = typeof c.kind === 'string' ? c.kind : null;
      if (kind) {
        createdKinds.add(kind);
      }
    });

    // Create edges for each entity kind this generator produces
    createdKinds.forEach(kind => {
      addNode(`entityKind:${kind}`, 'entityKind', kind);
      pendingEdges.push({
        source: `generator:${gId}`,
        target: `entityKind:${kind}`,
        polarity: 'positive',
        label: 'creates',
        edgeType: 'creates',
      });
    });
  });

  // 3. Add system nodes and their edges
  systems.forEach(s => {
    const sId = s.config.id;
    const sName = s.config.name || sId;
    const isSystemDisabled = s.enabled === false || s.config.enabled === false;
    addNode(`system:${sId}`, 'system', sName, { system: s }, isSystemDisabled);

    const config = s.config;

    // Pressure changes from systems (mutation-based actions)
    addPressureEdgesFromChangeMap(`system:${sId}`, config.pressureChanges, 'direct');
    addPressureEdgesFromChangeMap(`system:${sId}`, config.postProcess?.pressureChanges, 'postProcess');

    const divergencePressure = config.divergencePressure;
    if (divergencePressure?.pressureName && typeof divergencePressure.delta === 'number') {
      const polarity = divergencePressure.delta >= 0 ? 'positive' : 'negative';
      pendingEdges.push({
        source: `system:${sId}`,
        target: `pressure:${divergencePressure.pressureName}`,
        polarity,
        label: divergencePressure.delta > 0 ? `+${divergencePressure.delta}` : `${divergencePressure.delta}`,
        edgeType: 'divergence',
      });
    }

    if (Array.isArray(config.actions)) {
      addPressureEdgesFromMutations(`system:${sId}`, config.actions);
    }

    if (config.infectionAction) {
      addPressureEdgesFromMutations(`system:${sId}`, [config.infectionAction]);
    }

    if (Array.isArray(config.rules)) {
      config.rules.forEach((rule) => {
        if (rule?.action) {
          addPressureEdgesFromMutations(`system:${sId}`, [rule.action]);
        }
      });
    }
  });

  // 4. Add action nodes
  actions.forEach(a => {
    const aId = a.id;
    const aName = a.name || aId;
    const isActionDisabled = a.enabled === false;
    addNode(`action:${aId}`, 'action', aName, { action: a }, isActionDisabled);

    // Action outcome pressure changes
    addPressureEdgesFromMutations(`action:${aId}`, a.outcome?.mutations || []);

    const pressureModifiers = a.probability?.pressureModifiers || [];
    pressureModifiers.forEach((modifier) => {
      if (!modifier?.pressure) return;
      const multiplier = Number(modifier.multiplier);
      if (!Number.isFinite(multiplier) || multiplier === 0) return;
      pendingEdges.push({
        source: `pressure:${modifier.pressure}`,
        target: `action:${aId}`,
        polarity: multiplier >= 0 ? 'positive' : 'negative',
        label: `x${multiplier}`,
        edgeType: 'modifier',
      });
    });

    const variables = a.variables || {};
    Object.values(variables).forEach((variable) => {
      const selection = variable?.select;
      if (!selection) return;
      addEntityKindEdge(`action:${aId}`, selection.kind);
      (selection.kinds || []).forEach((kind) => addEntityKindEdge(`action:${aId}`, kind));
    });
  });

  // 5. Entity kind references (systems/actions)
  if (usageMap?.entityKinds) {
    Object.entries(usageMap.entityKinds).forEach(([kind, usage]) => {
      (usage.systems || []).forEach((sysRef) => {
        if (sysRef?.id) addEntityKindEdge(`system:${sysRef.id}`, kind);
      });
      (usage.actions || []).forEach((actionRef) => {
        if (actionRef?.id) addEntityKindEdge(`action:${actionRef.id}`, kind);
      });
    });
  }

  // 6. Pressure feedback loops - entity counts affect pressures
  pressures.forEach(p => {
    const growth = p.growth || {};
    const feedback = [
      ...(growth.positiveFeedback || []).map(f => ({ ...f, polarity: 'positive' })),
      ...(growth.negativeFeedback || []).map(f => ({ ...f, polarity: 'negative' })),
    ];

    feedback.forEach(factor => {
      if (factor.type === 'entity_count' && factor.kind) {
        const entityId = `entityKind:${factor.kind}`;
        addNode(entityId, 'entityKind', factor.kind);
        pendingEdges.push({
          source: entityId,
          target: `pressure:${p.id}`,
          polarity: factor.polarity,
          label: factor.polarity === 'positive' ? '+' : '-',
          edgeType: 'feedback',
        });
      }
    });
  });

  // 7. Pressure thresholds trigger generators/systems via era weights
  pressures.forEach(p => {
    const triggers = p.triggers || [];
    triggers.forEach(trigger => {
      if (trigger.activates) {
        const targetId = trigger.activates.startsWith('generator:')
          ? trigger.activates
          : `generator:${trigger.activates}`;
        pendingEdges.push({
          source: `pressure:${p.id}`,
          target: targetId,
          polarity: 'positive',
          label: `>${trigger.threshold}`,
          edgeType: 'trigger',
        });
      }
    });
  });

  // 8. Validate edges - filter out invalid references and generate warnings
  const validEdges = [];
  for (const edge of pendingEdges) {
    const sourceExists = nodeMap.has(edge.source);
    const targetExists = nodeMap.has(edge.target);

    if (!sourceExists || !targetExists) {
      const missingNode = !sourceExists ? edge.source : edge.target;
      const referrer = !sourceExists ? edge.target : edge.source;
      warnings.push({
        type: 'missing_reference',
        message: `Edge from "${referrer}" references missing node "${missingNode}"`,
        edge,
      });
    } else {
      validEdges.push(edge);
    }
  }

  // 9. Filter disabled nodes if requested
  const filteredNodes = showDisabled ? nodes : nodes.filter(n => !n.isDisabled);
  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredEdges = validEdges.filter(e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target));

  const connectedNodeIds = new Set();
  filteredEdges.forEach((edge) => {
    const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
    const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;
    if (sourceId) connectedNodeIds.add(sourceId);
    if (targetId) connectedNodeIds.add(targetId);
  });
  const connectedNodes = filteredNodes.filter(node => connectedNodeIds.has(node.id));

  return { nodes: connectedNodes, links: filteredEdges, warnings };
}

/**
 * Detect loops in the graph using DFS
 */
function detectLoops(nodes, links) {
  const adjacency = new Map();
  nodes.forEach(n => adjacency.set(n.id, []));
  links.forEach(e => {
    const sourceId = typeof e.source === 'object' ? e.source.id : e.source;
    const adj = adjacency.get(sourceId);
    if (adj) adj.push({ target: typeof e.target === 'object' ? e.target.id : e.target, edge: e });
  });

  const loops = [];
  const visited = new Set();
  const path = [];
  const pathSet = new Set();

  function dfs(nodeId) {
    if (pathSet.has(nodeId)) {
      const loopStart = path.indexOf(nodeId);
      const loop = path.slice(loopStart);
      loop.push(nodeId);
      loops.push(loop);
      return;
    }
    if (visited.has(nodeId)) return;

    visited.add(nodeId);
    path.push(nodeId);
    pathSet.add(nodeId);

    const neighbors = adjacency.get(nodeId) || [];
    for (const { target } of neighbors) {
      dfs(target);
    }

    path.pop();
    pathSet.delete(nodeId);
  }

  nodes.forEach(n => {
    if (!visited.has(n.id)) {
      dfs(n.id);
    }
  });

  return loops.map(loop => {
    let negativeCount = 0;
    for (let i = 0; i < loop.length - 1; i++) {
      const edge = links.find(e => {
        const sourceId = typeof e.source === 'object' ? e.source.id : e.source;
        const targetId = typeof e.target === 'object' ? e.target.id : e.target;
        return sourceId === loop[i] && targetId === loop[i + 1];
      });
      if (edge?.polarity === 'negative') negativeCount++;
    }
    const type = negativeCount % 2 === 0 ? 'reinforcing' : 'balancing';
    return { nodes: loop, type };
  });
}

export default function CausalLoopEditor({
  pressures = [],
  generators = [],
  systems = [],
  actions = [],
  schema = {},
  usageMap,
}) {
  const containerRef = useRef(null);
  const graphRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [showLegend, setShowLegend] = useState(true);
  const [showDisabled, setShowDisabled] = useState(true);
  const [hoverNode, setHoverNode] = useState(null);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      const rect = containerRef.current.getBoundingClientRect();
      setDimensions({
        width: rect.width || 800,
        height: Math.max(500, window.innerHeight - rect.top - 100),
      });
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(containerRef.current);
    window.addEventListener('resize', updateDimensions);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Extract graph data
  const { nodes: graphNodes, links: graphLinks, warnings } = useMemo(
    () => extractCausalGraph(pressures, generators, systems, actions, schema, showDisabled, usageMap),
    [pressures, generators, systems, actions, schema, showDisabled, usageMap]
  );
  const graphData = useMemo(() => ({ nodes: graphNodes, links: graphLinks }), [graphNodes, graphLinks]);

  // Count disabled nodes for UI
  const disabledCount = useMemo(() => {
    const allNodes = extractCausalGraph(pressures, generators, systems, actions, schema, true, usageMap).nodes;
    return allNodes.filter(n => n.isDisabled).length;
  }, [pressures, generators, systems, actions, schema, usageMap]);

  // Detect loops
  const loops = useMemo(() => detectLoops(graphData.nodes, graphData.links), [graphData]);

  const reinforcingLoops = loops.filter(l => l.type === 'reinforcing');
  const balancingLoops = loops.filter(l => l.type === 'balancing');

  // Node styling
  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const label = node.label;
    const fontSize = Math.max(10 / globalScale, 3);
    const abbrevFontSize = Math.max(8 / globalScale, 3);
    const nodeRadius = Math.sqrt(node.val) * 3;
    const isDisabled = node.isDisabled;

    // Draw node circle with opacity for disabled
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI);
    ctx.fillStyle = isDisabled ? `${node.color}60` : node.color;
    ctx.fill();

    // Strikethrough pattern for disabled nodes
    if (isDisabled) {
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1 / globalScale;
      ctx.setLineDash([2 / globalScale, 2 / globalScale]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Highlight selected/hovered
    if (selectedNode === node.id || hoverNode === node.id) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }

    // Draw abbreviation inside node
    ctx.font = `bold ${abbrevFontSize}px Sans-Serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isDisabled ? '#64748b' : '#0a1929';
    ctx.fillText(node.abbrev || '?', node.x, node.y);

    // Draw label below node
    ctx.font = `${fontSize}px Sans-Serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = isDisabled ? '#64748b' : '#e2e8f0';
    const displayLabel = label.length > 15 ? label.slice(0, 13) + '...' : label;
    ctx.fillText(displayLabel, node.x, node.y + nodeRadius + 2);
  }, [selectedNode, hoverNode]);

  // Link styling
  const linkColor = useCallback((link) => {
    return EDGE_COLORS[link.polarity] || EDGE_COLORS.neutral;
  }, []);

  const linkWidth = useCallback((link) => {
    return link.edgeType === 'feedback' ? 1 : 2;
  }, []);

  const linkLineDash = useCallback((link) => {
    return link.edgeType === 'feedback' ? [4, 4] : [];
  }, []);

  // Handle node click
  const handleNodeClick = useCallback((node) => {
    setSelectedNode(selectedNode === node.id ? null : node.id);
  }, [selectedNode]);

  // Zoom to fit on load
  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      setTimeout(() => {
        graphRef.current.zoomToFit(400, 60);
      }, 500);
    }
  }, [graphData.nodes.length]);

  const selectedNodeData = selectedNode
    ? graphData.nodes.find(n => n.id === selectedNode)
    : null;

  // Get edges for selected node
  const selectedNodeEdges = useMemo(() => {
    if (!selectedNode) return { incoming: [], outgoing: [] };
    return {
      incoming: graphData.links.filter(l => {
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        return targetId === selectedNode;
      }),
      outgoing: graphData.links.filter(l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        return sourceId === selectedNode;
      }),
    };
  }, [selectedNode, graphData.links]);

  return (
    <div className="editor-container">
      <div className="header">
        <h1 className="title">Causal Loop Diagram</h1>
        <p className="subtitle">
          Visualize feedback loops between pressures, generators, systems, and entity kinds.
          {loops.length > 0 && (
            <span style={{ marginLeft: '8px' }}>
              <span style={{ color: '#ef4444' }}>{reinforcingLoops.length} reinforcing</span>
              {' / '}
              <span style={{ color: '#3b82f6' }}>{balancingLoops.length} balancing</span>
              {' loops detected'}
            </span>
          )}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className="button-secondary"
          onClick={() => setShowLegend(!showLegend)}
        >
          {showLegend ? 'Hide' : 'Show'} Legend
        </button>
        {disabledCount > 0 && (
          <button
            className="button-secondary"
            onClick={() => setShowDisabled(!showDisabled)}
            style={{ opacity: showDisabled ? 1 : 0.7 }}
          >
            {showDisabled ? 'Hide' : 'Show'} Disabled ({disabledCount})
          </button>
        )}
        <button
          className="button-secondary"
          onClick={() => graphRef.current?.zoomToFit(400, 60)}
        >
          Fit to View
        </button>
        <div style={{ color: '#93c5fd', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span>{graphData.nodes.length} nodes</span>
          <span>{graphData.links.length} edges</span>
          {warnings.length > 0 && (
            <span style={{ color: '#f59e0b' }}>{warnings.length} warnings</span>
          )}
          <span style={{ color: '#6b7280' }}>Scroll to zoom, drag to pan</span>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div style={{
          padding: '8px 12px',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid #f59e0b',
          borderRadius: '6px',
          marginBottom: '16px',
          fontSize: '12px',
        }}>
          <div style={{ color: '#f59e0b', fontWeight: 600, marginBottom: '4px' }}>
            Referential Integrity Warnings
          </div>
          <div style={{ color: '#fcd34d', maxHeight: '80px', overflowY: 'auto' }}>
            {warnings.slice(0, 5).map((w, i) => (
              <div key={i}>{w.message}</div>
            ))}
            {warnings.length > 5 && (
              <div style={{ color: '#f59e0b', marginTop: '4px' }}>
                ...and {warnings.length - 5} more warnings
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      {showLegend && (
        <div style={{
          display: 'flex',
          gap: '24px',
          padding: '12px 16px',
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          borderRadius: '8px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ color: '#93c5fd', fontSize: '12px', fontWeight: 500 }}>Nodes:</span>
            {Object.entries(NODE_TYPES).map(([type, config]) => (
              <span key={type} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                <span style={{
                  width: '16px',
                  height: '16px',
                  backgroundColor: config.color,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: '#0a1929',
                }}>
                  {config.abbrev}
                </span>
                <span style={{ color: '#e2e8f0' }}>{config.label}</span>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ color: '#93c5fd', fontSize: '12px', fontWeight: 500 }}>Edges:</span>
            <span style={{ color: EDGE_COLORS.positive, fontSize: '11px' }}>+ Positive</span>
            <span style={{ color: EDGE_COLORS.negative, fontSize: '11px' }}>- Negative</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ color: '#93c5fd', fontSize: '12px', fontWeight: 500 }}>Loops:</span>
            <span style={{ color: '#ef4444', fontSize: '11px' }}>Reinforcing (unstable)</span>
            <span style={{ color: '#3b82f6', fontSize: '11px' }}>Balancing (stable)</span>
          </div>
        </div>
      )}

      {/* Graph container */}
      <div
        ref={containerRef}
        style={{
          backgroundColor: '#0f172a',
          borderRadius: '8px',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          overflow: 'hidden',
        }}
      >
        {graphData.nodes.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '400px',
            color: '#93c5fd',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>&#128260;</div>
            <div style={{ fontSize: '16px', fontWeight: 500, color: '#fff', marginBottom: '8px' }}>
              No causal relationships found
            </div>
            <div style={{ fontSize: '13px', maxWidth: '400px', textAlign: 'center' }}>
              Add pressures with feedback factors, generators with state updates,
              or systems with pressure changes to see the causal loop diagram.
            </div>
          </div>
        ) : (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="#0f172a"
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={(node, color, ctx) => {
              const nodeRadius = Math.sqrt(node.val) * 3;
              ctx.beginPath();
              ctx.arc(node.x, node.y, nodeRadius + 5, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
            }}
            linkColor={linkColor}
            linkWidth={linkWidth}
            linkLineDash={linkLineDash}
            linkDirectionalArrowLength={6}
            linkDirectionalArrowRelPos={0.9}
            linkCurvature={0.2}
            onNodeClick={handleNodeClick}
            onNodeHover={node => setHoverNode(node?.id || null)}
            cooldownTicks={100}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
            d3AlphaMin={0.001}
            warmupTicks={50}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            enablePanInteraction={true}
            // Increase spacing between nodes
            linkDistance={120}
            d3Force={(forceName, force) => {
              if (forceName === 'charge') {
                force.strength(-300); // Stronger repulsion
              }
              if (forceName === 'link') {
                force.distance(120); // Longer links
              }
            }}
          />
        )}
      </div>

      {/* Selected node details */}
      {selectedNodeData && (
        <div style={{
          marginTop: '16px',
          padding: '16px',
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          borderRadius: '8px',
          border: `2px solid ${selectedNodeData.color}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{
              padding: '2px 8px',
              backgroundColor: selectedNodeData.color,
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#0a1929',
            }}>
              {NODE_TYPES[selectedNodeData.type]?.label}
            </span>
            <span style={{ color: '#fff', fontWeight: 500 }}>{selectedNodeData.label}</span>
            <button
              onClick={() => setSelectedNode(null)}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                color: '#93c5fd',
                cursor: 'pointer',
                fontSize: '16px',
              }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'flex', gap: '24px' }}>
            {/* Incoming edges */}
            <div style={{ flex: 1 }}>
              <span style={{ color: '#93c5fd', fontSize: '12px', fontWeight: 500 }}>
                Incoming ({selectedNodeEdges.incoming.length})
              </span>
              <div style={{ paddingLeft: '8px', fontSize: '12px', color: '#e2e8f0', marginTop: '4px' }}>
                {selectedNodeEdges.incoming.map((e, i) => {
                  const sourceId = typeof e.source === 'object' ? e.source.id : e.source;
                  const sourceNode = graphData.nodes.find(n => n.id === sourceId);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                      <span style={{ color: EDGE_COLORS[e.polarity] }}>
                        {e.polarity === 'positive' ? '+' : '-'}
                      </span>
                      <span>{sourceNode?.label || sourceId}</span>
                    </div>
                  );
                })}
                {selectedNodeEdges.incoming.length === 0 && (
                  <span style={{ color: '#6b7280' }}>none</span>
                )}
              </div>
            </div>

            {/* Outgoing edges */}
            <div style={{ flex: 1 }}>
              <span style={{ color: '#93c5fd', fontSize: '12px', fontWeight: 500 }}>
                Outgoing ({selectedNodeEdges.outgoing.length})
              </span>
              <div style={{ paddingLeft: '8px', fontSize: '12px', color: '#e2e8f0', marginTop: '4px' }}>
                {selectedNodeEdges.outgoing.map((e, i) => {
                  const targetId = typeof e.target === 'object' ? e.target.id : e.target;
                  const targetNode = graphData.nodes.find(n => n.id === targetId);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                      <span style={{ color: EDGE_COLORS[e.polarity] }}>
                        {e.polarity === 'positive' ? '+' : '-'}
                      </span>
                      <span>{targetNode?.label || targetId}</span>
                    </div>
                  );
                })}
                {selectedNodeEdges.outgoing.length === 0 && (
                  <span style={{ color: '#6b7280' }}>none</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loop summary */}
      {loops.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <h3 style={{ color: '#fff', fontSize: '14px', marginBottom: '8px' }}>Detected Loops</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {loops.slice(0, 5).map((loop, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 12px',
                  backgroundColor: loop.type === 'reinforcing' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                  border: `1px solid ${loop.type === 'reinforcing' ? '#ef4444' : '#3b82f6'}`,
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              >
                <span style={{
                  color: loop.type === 'reinforcing' ? '#ef4444' : '#3b82f6',
                  fontWeight: 600,
                  marginRight: '8px',
                }}>
                  {loop.type === 'reinforcing' ? '++ Reinforcing' : '+- Balancing'}
                </span>
                <span style={{ color: '#e2e8f0' }}>
                  {loop.nodes.slice(0, -1).map(id => {
                    const node = graphData.nodes.find(n => n.id === id);
                    return node?.label || id.split(':')[1];
                  }).join(' -> ')}
                </span>
              </div>
            ))}
            {loops.length > 5 && (
              <div style={{ color: '#93c5fd', fontSize: '12px' }}>
                ...and {loops.length - 5} more loops
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { CausalLoopEditor };
