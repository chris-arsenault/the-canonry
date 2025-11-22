# Penguin History - Procedural World Generation & Visualization

A complete system for generating and visualizing rich, interconnected world histories through a hybrid approach of growth templates and simulation systems.

## Projects

This repository contains two sub-projects:

### 📊 [world-gen/](./world-gen/) - History Generation Engine
Procedural world generation system that creates knowledge graphs of ~150-200 entities with complex relationships.

```bash
cd world-gen
npm install
npm run dev
```

**Output**: `world-gen/output/generated_world.json`

### 🌐 [world-explorer/](./world-explorer/) - Interactive Visualization
React + Cytoscape.js application for exploring generated worlds through an interactive graph interface.

```bash
cd world-explorer
npm install
npm run dev
```

**Access**: http://localhost:5173/

## Quick Start

### Initial Setup
```bash
# Install dependencies for both projects
npm run install:all
```

### Generate & Visualize (All-in-One)
```bash
# Generate world and launch visualization
npm run dev
```

Then open http://localhost:5173/ to explore the generated world!

### Individual Commands
```bash
# Generate a world
npm run generate

# Sync generated world to visualization
npm run sync

# Generate and sync in one command
npm run generate:sync

# Launch visualization only
npm run viz
```

## Key Concepts

- **Entities**: NPCs, Locations, Factions, Rules, and Abilities
- **Templates**: Procedural generators that create batches of related entities
- **Systems**: Simulation rules that create relationships and modify the world
- **Eras**: Time periods that influence what happens (expansion, conflict, innovation, etc.)
- **Pressures**: Background forces that build up and trigger events

## Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Detailed system design and implementation guide
- **[CLAUDE.md](./CLAUDE.md)** - Guide for Claude Code when working in this repository
- **[UI.md](./UI.md)** - Visualization strategies and implementation options
- **[LLM_INTEGRATION.md](./LLM_INTEGRATION.md)** - LLM-based narrative generation
- **[NEW_MECHANICS.md](./NEW_MECHANICS.md)** - Advanced mechanics and extensions

## Project Structure

```
penguin-history/
├── world-gen/              # History generation engine
│   ├── src/
│   │   ├── engine/         # Main orchestration
│   │   ├── templates/      # Entity creation
│   │   ├── systems/        # Simulation rules
│   │   ├── config/         # Eras and pressures
│   │   └── types/          # TypeScript definitions
│   ├── data/               # Initial seed state
│   └── output/             # Generated worlds
│
├── world-explorer/         # Interactive visualization
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── types/          # TypeScript definitions
│   │   ├── utils/          # Data transformation
│   │   └── data/           # World data (JSON)
│   └── public/
│
├── ARCHITECTURE.md         # Technical documentation
├── CLAUDE.md              # Development guide
└── UI.md                  # Visualization guide
```

## Workflow

1. **Generate**: Run `world-gen` to create a procedural history
2. **Explore**: Copy output to `world-explorer` and visualize
3. **Iterate**: Adjust templates/systems and regenerate
4. **Customize**: Modify eras, pressures, and initial state

## Example Output

A typical generation produces:
- **~150-200 entities** across 5 types
- **~300-500 relationships** forming a dense graph
- **10 epochs** spanning 5 historical eras
- **Rich narrative elements** with interconnected stories

Entity distribution:
- NPCs: heroes, mayors, merchants, outlaws
- Locations: icebergs, colonies, anomalies
- Factions: political, criminal, cults, companies
- Rules: edicts, taboos, social norms
- Abilities: magic, technology, physical skills

## Technologies

**Generation Engine**:
- TypeScript
- Node.js
- JSON output

**Visualization**:
- React 18
- TypeScript
- Cytoscape.js (graph visualization)
- Vite (build tool)
- Tailwind CSS (styling)

## License

See individual project directories for licensing information.
