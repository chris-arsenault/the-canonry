# Name Forge

> Because your fantasy names deserve enterprise-grade infrastructure.

A dramatically over-engineered procedural name generator for fantasy worlds, games, and fiction. Instead of a simple random name picker, we've built a system with phonological domains, context-free grammars, Markov chains, genetic algorithm optimization, and multi-culture support. You know, the essentials.

**[Try it live at penguin-tales.com/name-forge](https://penguin-tales.com/name-forge/)**

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-purple.svg)](https://polyformproject.org/licenses/noncommercial/1.0.0/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)

## Features (Yes, All of Them)

- **Multi-Culture Support** - Define distinct naming conventions for elves, dwarves, space corporations, or whatever cultures inhabit your world
- **Phonological Domains** - Control consonants, vowels, syllable structures, and forbidden clusters (because "Xzqwrth" might be valid in Scrabble, but it's not a name)
- **Context-Free Grammars** - Chain production rules together like you're writing a compiler, but for names
- **Markov Chain Integration** - Train on real-world linguistic patterns (Norse, Finnish, Germanic, etc.)
- **Strategy Profiles** - Mix phonotactic generation, grammar rules, and Markov chains with weighted probabilities
- **Conditional Generation** - Different naming rules based on entity type, tags, and prominence
- **Optimization Algorithms** - Hill climbing, simulated annealing, genetic algorithms, and Bayesian optimization (TPE)
- **LLM-Powered Lexeme Generation** - Automatically generate thematic word lists using Claude

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Web UI](#web-ui)
- [TypeScript Library Usage](#typescript-library-usage)
- [CLI Usage](#cli-usage)
- [Project Structure](#project-structure)
- [Configuration Schema](#configuration-schema)
- [API Reference](#api-reference)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
# Clone the repository
git clone https://github.com/your-org/name-forge.git
cd name-forge

# Install dependencies
npm install

# Build the TypeScript
npm run build
```

### Requirements

- Node.js 18+
- npm 9+

## Quick Start

The fastest way to get started is with the Web UI:

```bash
# Optional: Set API key for LLM-powered lexeme generation
export ANTHROPIC_API_KEY="sk-ant-..."

# Start the web UI and API server
npm run ui
```

Open **http://localhost:5173** and you'll have a visual editor for creating naming configurations.

## Web UI

The web interface provides a complete workflow for creating and testing name generators:

1. **Schema Tab** - Define your world's entity types (NPCs, locations, factions) and create cultures
2. **Workshop Tab** - Configure each culture's domains, lexemes, grammars, and profiles
3. **Optimizer Tab** - Let algorithms tune your domain parameters automatically
4. **Generate Tab** - Produce names with full control over context and conditions

### Exporting Your Configuration

Once you've configured your naming system in the web UI:

1. Click **Export** in the Project Manager section
2. Save the JSON file (e.g., `my-world.json`)
3. Use this file with the TypeScript library or CLI

The exported file contains all cultures, domains, lexeme lists, grammars, and profiles.

## TypeScript Library Usage

Name Forge can be used as a library in your TypeScript/JavaScript projects.

### Installation (as dependency)

```bash
# From npm (when published)
npm install name-forge

# Or link locally during development
npm link ../path/to/name-forge
```

### Basic Usage

```typescript
import {
  generateFromProfile,
  type NamingProfile,
  type NamingDomain,
  type ExecutionContext,
} from "name-forge";

// Load your exported configuration
import config from "./my-world.json";

// Extract resources for a specific culture
const culture = config.cultures.elven;
const domains = culture.domains;
const grammars = culture.grammars;
const lexemes = culture.lexemeLists;
const profile = culture.profiles[0];

// Create execution context
const context: ExecutionContext = {
  domains,
  profiles: [profile],
  lexemeLists: Object.values(lexemes),
  grammarRules: grammars,
  seed: `my-seed-${Date.now()}`,
  entityAttributes: {
    tags: ["noble", "ancient"],
    prominence: "renowned",
    subtype: "high_elf",
  },
};

// Generate a name
const name = generateFromProfile(profile, context);
console.log(name); // "Aelindril Starweaver"
```

### Using with Exported Web UI Config

Here's a complete example loading an exported configuration:

```typescript
import * as fs from "fs";
import {
  generateFromProfile,
  type ExecutionContext,
  type NamingProfile,
  type NamingDomain,
  type GrammarRule,
  type LexemeList,
} from "name-forge";

// Load exported configuration
const config = JSON.parse(fs.readFileSync("./my-world.json", "utf-8"));

/**
 * Generate names for a specific culture
 */
function generateNames(
  cultureId: string,
  count: number,
  options?: {
    profileId?: string;
    tags?: string[];
    prominence?: string;
    subtype?: string;
  }
): string[] {
  const culture = config.cultures[cultureId];
  if (!culture) {
    throw new Error(`Culture not found: ${cultureId}`);
  }

  // Get profile (use specified or first available)
  const profile = options?.profileId
    ? culture.profiles.find((p: NamingProfile) => p.id === options.profileId)
    : culture.profiles[0];

  if (!profile) {
    throw new Error(`No profile found for culture: ${cultureId}`);
  }

  // Build execution context
  const context: ExecutionContext = {
    domains: culture.domains as NamingDomain[],
    profiles: culture.profiles as NamingProfile[],
    lexemeLists: Object.values(culture.lexemeLists || {}) as LexemeList[],
    grammarRules: culture.grammars as GrammarRule[],
    entityAttributes: {
      tags: options?.tags,
      prominence: options?.prominence as any,
      subtype: options?.subtype,
    },
  };

  // Generate names
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    context.seed = `gen-${Date.now()}-${i}`;
    names.push(generateFromProfile(profile, context));
  }

  return names;
}

// Usage
const elvenNames = generateNames("elven", 10, {
  tags: ["noble"],
  prominence: "renowned",
});
console.log(elvenNames);

const dwarvenNames = generateNames("dwarven", 5, {
  subtype: "mountain_dwarf",
});
console.log(dwarvenNames);
```

### Advanced: Custom Strategy Execution

```typescript
import {
  executeStrategy,
  selectStrategy,
  getEffectiveGroups,
  type NamingStrategy,
} from "name-forge";

// Get all strategies that match current conditions
const groups = getEffectiveGroups(profile);
const strategy = selectStrategy(profile, seed, entityAttributes);

// Execute a specific strategy
const name = executeStrategy(strategy, context);
```

## CLI Usage

### Name Generation (Runtime)

```bash
# Generate names from a domain config
npm run cli -- generate --domain path/to/domain.json --count 10

# Validate a domain config
npm run cli -- validate --domain path/to/domain.json
```

### Content Generation (Dev-Time)

Generate lexeme lists and templates using LLMs:

```bash
# Set API key
export ANTHROPIC_API_KEY="sk-ant-..."

# Generate a lexeme list
npm run generate -- lexeme specs/examples/elven-nouns-lexeme.json -v

# Generate templates
npm run generate -- template specs/examples/orcish-battle-template.json -v

# Generate batch (multiple lexemes + templates)
npm run generate -- batch specs/examples/penguin-imperial-batch.json -v
```

## Project Structure

```
name-forge/
├── lib/                    # Core TypeScript library
│   ├── index.ts           # Main exports
│   ├── profile-executor.ts # Strategy execution engine
│   ├── phonology.ts       # Phonotactic generation
│   ├── morphology.ts      # Prefix/suffix handling
│   ├── markov.ts          # Markov chain integration
│   ├── domain-selector.ts # Domain matching logic
│   └── types/             # TypeScript type definitions
├── server/                 # API server and CLI
│   ├── api-server.ts      # REST API for web UI
│   ├── cli.ts             # Name generation CLI
│   └── cli-generate.ts    # LLM content generation CLI
├── webui/                  # React web interface
│   ├── src/components/    # React components
│   └── public/            # Static assets
├── data/                   # Sample configurations
├── docs/                   # Architecture documentation
└── validation/            # Test fixtures and validation
```

## Configuration Schema

### Domain Configuration

Domains define the phonological rules for a naming style:

```json
{
  "id": "elf_high",
  "cultureId": "elven",
  "phonology": {
    "consonants": ["l", "r", "th", "f", "n", "m", "v", "s"],
    "vowels": ["a", "e", "i", "o", "ae", "ea", "ie"],
    "syllableTemplates": ["CV", "CVV", "CVC", "V"],
    "lengthRange": [2, 4],
    "favoredClusters": ["th", "ae", "el"],
    "forbiddenClusters": ["xx", "qq"]
  },
  "morphology": {
    "prefixes": ["Ael", "Ith", "Lae", "Fae"],
    "suffixes": ["riel", "ion", "aen", "wyn"],
    "structure": ["root-suffix", "prefix-root", "root"],
    "structureWeights": [0.4, 0.3, 0.3]
  },
  "style": {
    "capitalization": "title",
    "apostropheRate": 0.05,
    "hyphenRate": 0,
    "rhythmBias": "flowing"
  }
}
```

### Grammar Rules

Grammars use a CFG-like syntax for complex name patterns:

```json
{
  "id": "elven_full_name",
  "productions": [
    "{given} {family}",
    "{given} of {place}",
    "{title} {given} {epithet}"
  ],
  "slots": {
    "given": { "source": "lexeme:elven_given_names" },
    "family": { "source": "lexeme:elven_family_names" },
    "place": { "source": "grammar:elven_places" },
    "title": { "source": "lexeme:elven_titles" },
    "epithet": { "source": "domain:elf_high", "transform": "the {value}" }
  }
}
```

### Profile Configuration

Profiles combine strategies with weighted selection:

```json
{
  "id": "elven_npc",
  "cultureId": "elven",
  "strategyGroups": [
    {
      "weight": 0.6,
      "strategies": [
        { "kind": "grammar", "grammarId": "elven_full_name", "weight": 1.0 }
      ]
    },
    {
      "weight": 0.3,
      "strategies": [
        { "kind": "phonotactic", "domainId": "elf_high", "weight": 1.0 }
      ],
      "conditions": {
        "tags": ["ancient", "mythic"]
      }
    }
  ]
}
```

## API Reference

### Core Functions

| Function | Description |
|----------|-------------|
| `generateFromProfile(profile, context)` | Generate a name using a profile |
| `executeStrategy(strategy, context)` | Execute a specific strategy |
| `selectStrategy(profile, seed, attributes)` | Select a strategy based on conditions |
| `resolveProfile(cultureId, type, profiles)` | Find matching profile |
| `generatePhonotacticName(rng, domain)` | Generate from phonological rules |

### Types

| Type | Description |
|------|-------------|
| `NamingProfile` | Profile configuration |
| `NamingDomain` | Phonological domain config |
| `NamingStrategy` | Individual strategy definition |
| `ExecutionContext` | Runtime context for generation |
| `GrammarRule` | CFG grammar definition |
| `LexemeList` | Word list with metadata |

## Development

```bash
npm run ui            # Start web UI + API server
npm run cli           # Run CLI (name generation)
npm run generate      # Run generation CLI (lexeme/template creation)
npm run api           # Start API server only
npm run build         # Compile TypeScript
npm run typecheck     # Type check without building
npm run test          # Run test suite
npm run test:coverage # Run tests with coverage
npm run clean         # Remove build artifacts
```

## Documentation

Detailed architecture docs are in the `docs/` folder:

- `01_FRAMEWORK.md` - Core architecture and generation pipeline
- `02_VALIDATION.md` - Quality metrics and testing
- `03_OPTIMIZATION.md` - Hill-climbing parameter tuning
- `04_NAME_EXTENSIONS.md` - Profiles, templates, and strategies
- `05_MORETYPES.md` - Extended entity types
- `06_WORD_LISTS.md` - Automated content generation
- `GENERATION.md` - Complete LLM generation guide

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Write tests for new functionality
- Follow existing code style
- Update documentation as needed
- Add JSDoc comments for public APIs

## FAQ

**Q: Isn't this overkill for generating fantasy names?**

A: Yes, absolutely. But where's the fun in a simple solution?

**Q: Why not just use a list of names?**

A: Because then your 10,000th generated elf would be named "Legolas_9847" and that breaks immersion.

**Q: Do I really need genetic algorithms to name my NPCs?**

A: Need? No. But your NPCs deserve names that have been evolutionarily optimized for phonetic pleasantness.

## License

[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/) - free for non-commercial use.

---

*Yes, this is probably overkill for generating fantasy names. No, we're not sorry.*

---

<p align="center">
  <sub>Copyright © 2025 <img src="./webui/public/tsonu-combined.png" alt="tsonu" aria-label="tsonu" height="16" style="vertical-align: middle;" /></sub>
</p>
