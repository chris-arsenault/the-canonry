# World Visualization & Exploration UI Guide

## Overview

This document outlines strategies and implementations for visualizing and exploring the procedurally generated world data (knowledge graph with ~200 entities and ~500 relationships).

## Core Visualization Libraries

### 1. Cytoscape.js (Recommended for Knowledge Graphs)

**Best for**: Interactive entity-relationship exploration, medium-sized graphs (100-1000 nodes)

```javascript
// Installation
npm install cytoscape cytoscape-cose-bilkent cytoscape-cola

// Basic setup
import cytoscape from 'cytoscape';
import coseBilkent from 'cytoscape-cose-bilkent';

cytoscape.use(coseBilkent);

const cy = cytoscape({
  container: document.getElementById('cy'),
  elements: transformWorldData(worldState),
  style: [
    {
      selector: 'node',
      style: {
        'label': 'data(name)',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': '10px',
        'width': 'mapData(prominence, 0, 4, 20, 60)',
        'height': 'mapData(prominence, 0, 4, 20, 60)'
      }
    },
    {
      selector: 'node[kind="npc"]',
      style: { 'background-color': '#6FB1FC' }
    },
    {
      selector: 'node[kind="faction"]',
      style: { 'background-color': '#FC6B6B' }
    },
    {
      selector: 'node[kind="location"]',
      style: { 'background-color': '#6BFC9C' }
    },
    {
      selector: 'edge',
      style: {
        'width': 2,
        'line-color': '#ccc',
        'target-arrow-color': '#ccc',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'label': 'data(kind)',
        'font-size': '8px'
      }
    }
  ],
  layout: {
    name: 'cose-bilkent',
    animate: true,
    randomize: true,
    idealEdgeLength: 100,
    nodeRepulsion: 100000,
    gravity: 0.25
  }
});
```

### 2. D3.js Force-Directed Graph

**Best for**: Custom visualizations, complete control over rendering

```javascript
// Installation
npm install d3

// Force-directed graph
import * as d3 from 'd3';

function createForceGraph(data, container) {
  const width = 1200;
  const height = 800;
  
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  const simulation = d3.forceSimulation(data.nodes)
    .force('link', d3.forceLink(data.links)
      .id(d => d.id)
      .distance(100))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width/2, height/2))
    .force('collision', d3.forceCollide().radius(30));
  
  // Add zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.1, 10])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
  
  svg.call(zoom);
  
  const g = svg.append('g');
  
  // Render links and nodes...
}
```

### 3. Sigma.js

**Best for**: Very large graphs (1000+ nodes), WebGL performance

```javascript
// Installation
npm install sigma graphology graphology-layout-forceatlas2

import Graph from 'graphology';
import Sigma from 'sigma';
import forceAtlas2 from 'graphology-layout-forceatlas2';

const graph = new Graph();

// Add nodes and edges
worldState.hardState.forEach(entity => {
  graph.addNode(entity.id, {
    x: Math.random(),
    y: Math.random(),
    size: getProminenceSize(entity.prominence),
    color: getKindColor(entity.kind),
    label: entity.name
  });
});

worldState.relationships.forEach(rel => {
  graph.addEdge(rel.src, rel.dst, {
    type: rel.kind,
    size: 1
  });
});

// Apply layout
forceAtlas2.assign(graph, { iterations: 50 });

// Render
const sigma = new Sigma(graph, container);
```

## Multi-View Dashboard Architecture

### React-based Explorer

```jsx
// Main dashboard structure
import React, { useState, useEffect } from 'react';
import GraphView from './components/GraphView';
import TimelineView from './components/TimelineView';
import EntityDetail from './components/EntityDetail';
import FilterPanel from './components/FilterPanel';
import SearchBar from './components/SearchBar';
import StatsPanel from './components/StatsPanel';

function WorldExplorer({ worldData }) {
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [filters, setFilters] = useState({
    kinds: ['npc', 'faction', 'location'],
    minProminence: 'marginal',
    timeRange: [0, worldData.metadata.tick],
    tags: [],
    searchQuery: ''
  });
  const [graphMode, setGraphMode] = useState('full'); // full, radial, temporal, faction
  
  const filteredData = applyFilters(worldData, filters);
  
  return (
    <div className="h-screen flex flex-col">
      <Header>
        <SearchBar onSearch={(q) => setFilters({...filters, searchQuery: q})} />
        <ModeSelector mode={graphMode} onChange={setGraphMode} />
      </Header>
      
      <div className="flex-1 flex">
        <aside className="w-64 border-r">
          <FilterPanel 
            filters={filters} 
            onChange={setFilters}
            stats={calculateStats(filteredData)}
          />
          <StatsPanel data={worldData} />
        </aside>
        
        <main className="flex-1 flex flex-col">
          <GraphView 
            data={filteredData}
            mode={graphMode}
            onNodeSelect={setSelectedEntity}
            selectedNode={selectedEntity}
          />
          <TimelineView 
            events={worldData.history}
            timeRange={filters.timeRange}
            onTimeChange={(range) => setFilters({...filters, timeRange: range})}
          />
        </main>
        
        <aside className="w-96 border-l">
          <EntityDetail 
            entity={selectedEntity}
            worldData={worldData}
            onRelatedClick={setSelectedEntity}
          />
        </aside>
      </div>
    </div>
  );
}
```

### Data Transformation Functions

```javascript
// Transform world data for Cytoscape
function transformWorldData(worldState) {
  const nodes = worldState.hardState.map(entity => ({
    data: {
      id: entity.id,
      name: entity.name,
      kind: entity.kind,
      subtype: entity.subtype,
      prominence: prominenceToNumber(entity.prominence),
      status: entity.status,
      tags: entity.tags,
      description: entity.description
    },
    classes: `${entity.kind} ${entity.subtype} ${entity.prominence}`
  }));
  
  const edges = worldState.relationships.map((rel, i) => ({
    data: {
      id: `edge-${i}`,
      source: rel.src,
      target: rel.dst,
      kind: rel.kind
    },
    classes: rel.kind.replace(/_/g, '-')
  }));
  
  return { nodes, edges };
}

function prominenceToNumber(prominence) {
  const map = { forgotten: 0, marginal: 1, recognized: 2, renowned: 3, mythic: 4 };
  return map[prominence] || 0;
}
```

## Specialized Visualization Components

### 1. Timeline Component

```javascript
// Using vis-timeline
import { Timeline } from 'vis-timeline/standalone';

function createTimeline(container, history) {
  const groups = [
    { id: 'growth', content: 'Entities Created' },
    { id: 'simulation', content: 'Relationships' },
    { id: 'era', content: 'Era Changes' }
  ];
  
  const items = history.map((event, i) => ({
    id: i,
    content: event.description || `${event.entitiesCreated.length} entities`,
    start: event.tick,
    group: event.type,
    className: `event-${event.era}`
  }));
  
  const options = {
    stack: false,
    showMajorLabels: true,
    showCurrentTime: false,
    zoomMin: 10,
    zoomMax: 1000
  };
  
  new Timeline(container, items, groups, options);
}
```

### 2. Relationship Explorer

```javascript
// Chord diagram for faction relationships
function createChordDiagram(factions, relationships) {
  const matrix = buildAdjacencyMatrix(factions, relationships);
  
  const chord = d3.chord()
    .padAngle(0.05)
    .sortGroups(d3.descending);
  
  const arc = d3.arc()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius);
  
  const ribbon = d3.ribbon()
    .radius(innerRadius);
  
  // Render chord diagram...
}

// Hierarchical edge bundling for complex relationships
function createEdgeBundling(data) {
  const hierarchy = d3.hierarchy(data)
    .sum(d => d.value)
    .sort((a, b) => b.height - a.height || b.value - a.value);
  
  const cluster = d3.cluster()
    .size([360, innerRadius]);
  
  const root = cluster(hierarchy);
  // Render bundled edges...
}
```

### 3. Search & Filter Interface

```javascript
// Using Fuse.js for fuzzy search
import Fuse from 'fuse.js';

function createSearchIndex(worldState) {
  const fuse = new Fuse(worldState.hardState, {
    keys: [
      { name: 'name', weight: 0.4 },
      { name: 'description', weight: 0.3 },
      { name: 'tags', weight: 0.2 },
      { name: 'subtype', weight: 0.1 }
    ],
    threshold: 0.3,
    includeScore: true
  });
  
  return fuse;
}

// Filter panel component
function FilterPanel({ filters, onChange, stats }) {
  return (
    <div className="p-4 space-y-4">
      <div>
        <label>Entity Types</label>
        <MultiSelect
          options={['npc', 'faction', 'location', 'rules', 'abilities']}
          value={filters.kinds}
          onChange={(kinds) => onChange({...filters, kinds})}
        />
      </div>
      
      <div>
        <label>Minimum Prominence</label>
        <select 
          value={filters.minProminence}
          onChange={(e) => onChange({...filters, minProminence: e.target.value})}
        >
          <option value="forgotten">Forgotten</option>
          <option value="marginal">Marginal</option>
          <option value="recognized">Recognized</option>
          <option value="renowned">Renowned</option>
          <option value="mythic">Mythic</option>
        </select>
      </div>
      
      <div>
        <label>Time Range</label>
        <RangeSlider
          min={0}
          max={stats.maxTick}
          value={filters.timeRange}
          onChange={(range) => onChange({...filters, timeRange: range})}
        />
      </div>
      
      <div>
        <label>Tags</label>
        <TagCloud
          tags={stats.allTags}
          selected={filters.tags}
          onToggle={(tag) => {
            const tags = filters.tags.includes(tag)
              ? filters.tags.filter(t => t !== tag)
              : [...filters.tags, tag];
            onChange({...filters, tags});
          }}
        />
      </div>
    </div>
  );
}
```

## Exploration Modes

### 1. Progressive Disclosure

```javascript
class ProgressiveGraph {
  constructor(worldState) {
    this.fullGraph = worldState;
    this.visibleNodes = new Set();
    this.visibleEdges = new Set();
  }
  
  // Start with only high-prominence entities
  initializeCore() {
    this.fullGraph.hardState
      .filter(e => ['renowned', 'mythic'].includes(e.prominence))
      .forEach(e => this.visibleNodes.add(e.id));
    
    this.updateVisibleEdges();
  }
  
  // Expand to show neighbors
  expandNode(nodeId, depth = 1) {
    const toExplore = [nodeId];
    const explored = new Set();
    
    for (let d = 0; d < depth; d++) {
      const nextLevel = [];
      
      toExplore.forEach(id => {
        if (explored.has(id)) return;
        explored.add(id);
        
        const neighbors = this.getNeighbors(id);
        neighbors.forEach(n => {
          this.visibleNodes.add(n);
          nextLevel.push(n);
        });
      });
      
      toExplore.length = 0;
      toExplore.push(...nextLevel);
    }
    
    this.updateVisibleEdges();
  }
  
  // Collapse to hide low-importance branches
  collapseLeaves(minProminence = 'marginal') {
    const prominenceValue = {'forgotten': 0, 'marginal': 1, 'recognized': 2};
    const threshold = prominenceValue[minProminence];
    
    this.visibleNodes.forEach(nodeId => {
      const node = this.getNode(nodeId);
      if (prominenceValue[node.prominence] < threshold) {
        const neighbors = this.getNeighbors(nodeId);
        if (neighbors.length <= 1) {
          this.visibleNodes.delete(nodeId);
        }
      }
    });
    
    this.updateVisibleEdges();
  }
}
```

### 2. View Modes

```javascript
const ViewModes = {
  // Show radial view from selected entity
  radial: (graph, centerNodeId, maxDistance = 2) => {
    const distances = calculateDistances(graph, centerNodeId);
    return graph.filter(node => distances[node.id] <= maxDistance);
  },
  
  // Show only faction-related subgraph
  faction: (graph, factionId) => {
    const members = graph.relationships
      .filter(r => r.kind === 'member_of' && r.dst === factionId)
      .map(r => r.src);
    
    const relatedLocations = graph.relationships
      .filter(r => r.src === factionId && r.kind === 'controls')
      .map(r => r.dst);
    
    return [...members, ...relatedLocations, factionId];
  },
  
  // Show temporal slice
  temporal: (graph, startTick, endTick) => {
    return graph.hardState.filter(entity => 
      entity.createdAt >= startTick && entity.createdAt <= endTick
    );
  },
  
  // Show conflict network
  conflict: (graph) => {
    const conflictRels = ['enemy_of', 'rival_of', 'at_war_with'];
    const conflictEdges = graph.relationships.filter(r => 
      conflictRels.includes(r.kind)
    );
    
    const involvedNodes = new Set();
    conflictEdges.forEach(e => {
      involvedNodes.add(e.src);
      involvedNodes.add(e.dst);
    });
    
    return Array.from(involvedNodes);
  },
  
  // Show trade/economic network
  economic: (graph) => {
    const economicEntities = graph.hardState.filter(e =>
      e.kind === 'faction' && e.subtype === 'company' ||
      e.tags.includes('trade') ||
      e.tags.includes('merchant')
    );
    
    return economicEntities.map(e => e.id);
  }
};
```

## Analytics & Insights

### Graph Metrics

```javascript
class GraphAnalytics {
  constructor(worldState) {
    this.graph = worldState;
  }
  
  // Find most connected entities (hubs)
  findHubs(limit = 10) {
    const degrees = {};
    
    this.graph.relationships.forEach(rel => {
      degrees[rel.src] = (degrees[rel.src] || 0) + 1;
      degrees[rel.dst] = (degrees[rel.dst] || 0) + 1;
    });
    
    return Object.entries(degrees)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([id, degree]) => ({
        entity: this.graph.hardState.find(e => e.id === id),
        connections: degree
      }));
  }
  
  // Detect communities using Louvain algorithm
  detectCommunities() {
    // Implement or use library like graphology-communities
    // Returns array of community clusters
  }
  
  // Calculate faction power
  analyzeFactionPower() {
    const factions = this.graph.hardState.filter(e => e.kind === 'faction');
    
    return factions.map(faction => {
      const members = this.graph.relationships
        .filter(r => r.kind === 'member_of' && r.dst === faction.id)
        .length;
      
      const territories = this.graph.relationships
        .filter(r => r.kind === 'controls' && r.src === faction.id)
        .length;
      
      const conflicts = this.graph.relationships
        .filter(r => r.kind === 'at_war_with' && 
                (r.src === faction.id || r.dst === faction.id))
        .length;
      
      return {
        faction: faction.name,
        members,
        territories,
        conflicts,
        power: members * 2 + territories * 3 - conflicts
      };
    });
  }
  
  // Find critical events in history
  findCriticalEvents(threshold = 5) {
    return this.graph.history.filter(event =>
      event.entitiesCreated.length >= threshold ||
      event.type === 'era_transition' ||
      event.description?.includes('war') ||
      event.description?.includes('collapse')
    );
  }
  
  // Calculate relationship distribution
  getRelationshipStats() {
    const stats = {};
    
    this.graph.relationships.forEach(rel => {
      stats[rel.kind] = (stats[rel.kind] || 0) + 1;
    });
    
    return Object.entries(stats)
      .sort(([,a], [,b]) => b - a)
      .map(([kind, count]) => ({ kind, count }));
  }
}
```

### Story Extraction

```javascript
// Extract narrative threads from the graph
function extractNarratives(worldState) {
  const narratives = [];
  
  // Hero journeys
  const heroes = worldState.hardState.filter(e => 
    e.kind === 'npc' && e.subtype === 'hero'
  );
  
  heroes.forEach(hero => {
    const journey = {
      protagonist: hero,
      events: worldState.history.filter(e => 
        e.actors?.includes(hero.id)
      ),
      relationships: worldState.relationships.filter(r =>
        r.src === hero.id || r.dst === hero.id
      ),
      arc: determineArc(hero, worldState)
    };
    narratives.push(journey);
  });
  
  // Faction conflicts
  const wars = worldState.relationships.filter(r => 
    r.kind === 'at_war_with'
  );
  
  wars.forEach(war => {
    const conflict = {
      type: 'war',
      parties: [war.src, war.dst],
      timeline: findConflictEvents(war, worldState.history),
      outcome: determineOutcome(war, worldState)
    };
    narratives.push(conflict);
  });
  
  return narratives;
}
```

## Performance Optimization

### 1. Virtualization for Large Lists

```javascript
// Using react-window
import { FixedSizeList } from 'react-window';

function VirtualizedEntityList({ entities, height, itemHeight }) {
  return (
    <FixedSizeList
      height={height}
      itemCount={entities.length}
      itemSize={itemHeight}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <EntityCard entity={entities[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}
```

### 2. Web Worker for Layout Calculation

```javascript
// layout.worker.js
import forceSimulation from 'd3-force';

self.addEventListener('message', (e) => {
  const { nodes, links, config } = e.data;
  
  const simulation = forceSimulation(nodes)
    .force('link', forceLink(links).id(d => d.id))
    .force('charge', forceManyBody().strength(config.charge))
    .force('center', forceCenter(config.width/2, config.height/2));
  
  simulation.tick(config.iterations);
  
  self.postMessage({ nodes, links });
});

// Main thread
const worker = new Worker('./layout.worker.js');
worker.postMessage({ nodes, links, config });
worker.onmessage = (e) => {
  updateGraph(e.data);
};
```

### 3. Level of Detail (LOD)

```javascript
function applyLOD(graph, zoomLevel) {
  if (zoomLevel < 0.5) {
    // Far zoom: Show only major entities
    return {
      nodes: graph.nodes.filter(n => n.prominence >= 3),
      edges: graph.edges.filter(e => e.importance === 'high'),
      labels: false
    };
  } else if (zoomLevel < 1.5) {
    // Medium zoom: Show recognized+ entities
    return {
      nodes: graph.nodes.filter(n => n.prominence >= 2),
      edges: graph.edges,
      labels: true,
      abbreviated: true
    };
  } else {
    // Close zoom: Show everything
    return {
      nodes: graph.nodes,
      edges: graph.edges,
      labels: true,
      descriptions: true
    };
  }
}
```

## Tech Stack Recommendations

### Option 1: React + Cytoscape (Recommended)

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "cytoscape": "^3.26.0",
    "cytoscape-cose-bilkent": "^4.1.0",
    "react-cytoscapejs": "^2.0.0",
    "vis-timeline": "^7.5.1",
    "fuse.js": "^6.6.2",
    "react-select": "^5.7.0",
    "react-window": "^1.8.9",
    "tailwindcss": "^3.3.0",
    "@headlessui/react": "^1.7.0"
  },
  "devDependencies": {
    "@types/cytoscape": "^3.19.0",
    "vite": "^4.4.0"
  }
}
```

### Option 2: Observable Notebook

Create at observablehq.com:
- Import data directly
- Use built-in D3
- Interactive cells
- Easy sharing and forking

### Option 3: Svelte + D3

```json
{
  "dependencies": {
    "svelte": "^4.0.0",
    "d3": "^7.8.0",
    "d3-force": "^3.0.0",
    "d3-hierarchy": "^3.1.0"
  }
}
```

## Quick Start Template

```bash
# Create new React app with Vite
npm create vite@latest world-explorer -- --template react-ts
cd world-explorer

# Install dependencies
npm install cytoscape cytoscape-cose-bilkent react-cytoscapejs \
  vis-timeline fuse.js react-select tailwindcss

# Copy your generated world data
cp ../penguin-history-engine/output/generated_world.json src/data/

# Create basic structure
mkdir src/components
touch src/components/{GraphView,Timeline,FilterPanel,EntityDetail}.tsx
```

## Deployment Options

### 1. Static Site (GitHub Pages)
```bash
npm run build
npx gh-pages -d dist
```

### 2. Vercel
```bash
vercel deploy
```

### 3. Local Electron App
```javascript
// For desktop application
const { app, BrowserWindow } = require('electron');

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    webPreferences: {
      nodeIntegration: true
    }
  });
  
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);
```

## Additional Resources

- [Cytoscape.js Demos](https://js.cytoscape.org/demos/)
- [D3 Graph Gallery](https://d3-graph-gallery.com/)
- [Observable Graph Examples](https://observablehq.com/@d3/gallery#networks)
- [React Flow](https://reactflow.dev/) - Alternative graph library
- [Graphin](https://graphin.antv.vision/) - Ant Design graph components

## Next Steps

1. Choose your primary visualization library (recommend Cytoscape)
2. Set up basic dashboard with graph + filters
3. Add progressive disclosure for better performance
4. Implement search and analytics
5. Add export features (PNG, SVG, JSON subgraphs)
6. Consider adding narrative generation for discovered patterns