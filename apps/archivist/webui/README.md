# Archivist - World History Explorer

Interactive visualization tool for exploring procedurally generated world histories.

A React-based application for navigating knowledge graphs of ~150-200 interconnected entities, discovering LLM-enriched narratives, and tracing the evolution of civilizations across historical eras.

---

## Quick Start

```bash
# Install dependencies
npm install

# Start development server (remote-only)
npm run dev

# Build for production
npm run build
```

**Access**: Runs as a micro-frontend in the Canonry shell at http://localhost:5176/archivist/. There is no standalone Archivist app; the dev server only hosts the remote entry.

---

## Features

### Interactive Graph Exploration
- **Network Visualization** - Cytoscape.js-powered graph with physics-based layout
- **Color-Coded Entities** - Visual distinction by type and prominence
- **Pan & Zoom Controls** - Navigate graphs of 150-200 entities smoothly
- **Focus Mode** - Explore entity connections interactively

### Rich Narrative Integration
- **LLM-Generated Lore** - View cluster-enriched entity descriptions
- **Relationship Backstories** - Discover how connections formed
- **Era Narratives** - Read pivotal events between historical periods
- **Evolution Tracking** - See supplemental lore for entity changes over time

### Advanced Filtering
- **Entity Type** - Filter by NPCs, Factions, Locations, Rules, Abilities
- **Prominence Level** - Focus on forgotten, marginal, recognized, renowned, or mythic entities
- **Time Range** - View entities from specific epochs or eras
- **Tag Search** - Find entities by tags and keywords
- **Fuzzy Search** - Quick entity lookup with Fuse.js

### Entity Details
- **Complete Metadata** - Kind, subtype, status, prominence, creation time
- **Full Descriptions** - LLM-enriched narrative context
- **Relationship Explorer** - Navigate incoming and outgoing connections
- **Timeline Integration** - See when entities emerged and evolved

---

## Project Structure

```
archivist/webui/
├── src/
│   ├── components/
│   │   ├── WorldExplorer.tsx           # Main dashboard orchestrator
│   │   ├── GraphView.tsx               # Cytoscape graph visualization
│   │   ├── FilterPanel.tsx             # Advanced filtering controls
│   │   ├── EntityDetail.tsx            # Entity information panel
│   │   ├── LoreSection.tsx             # LLM-generated narratives
│   │   └── TimelineControl.tsx         # Temporal navigation
│   ├── types/
│   │   └── world.ts                    # TypeScript definitions
│   └── utils/
│       └── dataTransform.ts            # Graph data transformation
└── vite.config.ts
```

---

## Data Format

The application expects world data from the generation engine:

### World State

```json
{
  "metadata": {
    "tick": 135,
    "epoch": 9,
    "entityCount": 187,
    "relationshipCount": 453,
    "currentEra": "The Golden Age"
  },
  "hardState": [
    {
      "id": "npc_001",
      "kind": "npc",
      "subtype": "hero",
      "name": "Aldric the Bold",
      "description": "A renowned hero...",
      "status": "alive",
      "prominence": "renowned",
      "tags": ["warrior", "faction_wars_veteran"],
      "links": [...],
      "createdAt": 23,
      "updatedAt": 89
    }
  ],
  "relationships": [
    {
      "kind": "member_of",
      "src": "npc_001",
      "dst": "faction_005"
    }
  ]
}
```

---

## Controls

### Graph Navigation
- **Click** a node to view entity details
- **Scroll** to zoom in/out
- **Drag** the canvas to pan around
- **Click** relationship names in detail panel to navigate between entities

### Filtering
- **Toggle entity types** to show/hide NPCs, Factions, Locations, etc.
- **Adjust prominence** slider to focus on notable entities
- **Set time range** to view entities from specific epochs
- **Search by name or tags** for quick lookup

---

## Technologies

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Cytoscape.js** - Graph visualization library
- **Module Federation** - Micro-frontend integration
- **Fuse.js** - Fuzzy search functionality

---

## Performance

### Current Capabilities
- Handles graphs of **~200 entities** and **~500 relationships** smoothly
- Layout calculation runs in ~1-2 seconds
- Filtering is **instant** (client-side processing)

### For Larger Graphs (500+ entities)
- Consider moving layout calculation to **Web Worker**
- Implement **level-of-detail rendering**
- Add **progressive loading** for entity details

---

## License

[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/) - Free for non-commercial use.
