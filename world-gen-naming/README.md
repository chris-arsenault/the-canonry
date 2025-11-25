# World Gen Naming

Domain-aware procedural name generation system for world-building and game development.

## Overview

This system generates culturally-distinct names using:
- **Phonotactic rules** - Control sound patterns and allowed sequences
- **Morphological rules** - Apply prefixes, suffixes, and compound structures
- **Stylistic filters** - Add apostrophes, hyphens, capitalization patterns

Names are generated from **domain configs** that encode cultural/species/faction identity, making names instantly recognizable by their shape alone.

## Architecture

Built in 5 phases:

1. **Framework** ✅ - Core generation pipeline (phonology, morphology, style)
2. **Validation** ✅ - Capacity, diffuseness, and semiotic separation metrics
3. **Optimization** ✅ - Hill-climbing parameter tuning with fitness evaluation
4. **Extensions** ✅ - Profiles, templates, lexeme lists, KG integration
5. **Automated Generation** ✅ - LLM-powered lexeme and template creation

## Installation

```bash
npm install
```

## Usage

### Web UI (Recommended)

Visual configuration builder with LLM integration:

```bash
# Set API key (optional - can also set in UI)
export ANTHROPIC_API_KEY="sk-ant-..."

# Start both API server and web UI
npm run ui
```

Open **http://localhost:5173** in your browser.

See [WEBUI_GUIDE.md](./WEBUI_GUIDE.md) for complete documentation.

### CLI - Name Generation (Runtime)

```bash
# Generate names from a domain
npm run cli -- generate --domain path/to/domain.json --count 10

# Validate a domain config
npm run cli -- validate --domain path/to/domain.json
```

### CLI - Content Generation (Dev-Time)

Automatically generate lexeme lists and templates using LLMs:

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

See [GENERATION.md](./GENERATION.md) for complete CLI documentation.

## Development

```bash
npm run ui            # Start web UI + API server
npm run cli           # Run CLI (name generation)
npm run generate      # Run generation CLI (lexeme/template creation)
npm run api           # Start API server only
npm run build         # Compile TypeScript
npm run typecheck     # Type check without building
npm run test          # Run test suite
npm run clean         # Remove build artifacts
```

## Documentation

Design docs and guides:
- `01_FRAMEWORK.md` - Core architecture and generation pipeline
- `02_VALIDATION.md` - Quality metrics and testing
- `03_OPTIMIZATION.md` - Hill-climbing parameter tuning
- `04_NAME_EXTENSIONS.md` - Profiles, templates, and strategies
- `05_MORETYPES.md` - Extended entity types (battles, spells, laws)
- `06_WORD_LISTS.md` - Automated content generation approach
- `GENERATION.md` - Complete guide to LLM-powered generation

## Example Domain

```json
{
  "id": "elf_high",
  "appliesTo": {
    "kind": ["npc"],
    "subKind": ["elf"],
    "tags": ["high", "ancient"]
  },
  "phonology": {
    "consonants": ["l", "r", "th", "f", "n", "m"],
    "vowels": ["a", "e", "i", "o", "ae", "ea"],
    "syllableTemplates": ["CV", "CVV", "CVC"],
    "lengthRange": [2, 4]
  },
  "morphology": {
    "prefixes": ["Ael", "Ith", "Lae"],
    "suffixes": ["riel", "ion", "aen"],
    "structure": ["root-suffix", "prefix-root"]
  },
  "style": {
    "apostropheRate": 0.05,
    "capitalization": "title",
    "rhythmBias": "flowing"
  }
}
```

## License

MIT
