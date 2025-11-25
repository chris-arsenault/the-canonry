# Web UI Quick Start Guide

## Overview

The Web UI provides a visual interface for:
- Managing multiple meta-domains (test, penguin)
- Creating domain configurations (phonology, morphology, style)
- Defining generation specs for lexemes and templates
- Generating content via LLM
- Exporting complete configurations for KB integration

## Setup & Launch

### Quick Start (Recommended)

```bash
# From project root
export ANTHROPIC_API_KEY="sk-ant-..."  # Optional - can also set in UI
npm run ui
```

This single command starts:
- **API Server** on http://localhost:3001
- **Web UI** on http://localhost:5173

Open **http://localhost:5173** in your browser.

### Manual Start (Advanced)

If you prefer to run components separately:

```bash
# Terminal 1 - API Server
export ANTHROPIC_API_KEY="sk-ant-..."
npm run api

# Terminal 2 - Web UI
cd webui
npm run dev
```

## Workflow

### Step 1: Select Meta-Domain

In the sidebar, choose between:
- **Test Domain**: Fantasy cultures (Elves, Dwarves, Goblins)
- **Penguin World**: Penguin cultures and Orcas

### Step 2: Create Domains (Optional)

Navigate to the **Domains** tab:

1. Click "+ New Domain"
2. Fill in:
   - **ID**: e.g., `elven_high`
   - **Culture ID**: e.g., `elven`
   - **Phonology**:
     - Consonants: `l, r, th, f, n, m`
     - Vowels: `a, e, i, o, ae`
     - Syllable Templates: `CV, CVC, CVV`
   - **Morphology** (optional): Prefixes, suffixes
   - **Style**: Capitalization, apostrophe rate
3. Click "Save"

Domains define the phonological rules for procedural name generation.

### Step 3: Create Lexeme Specs

Navigate to the **Specs** tab:

1. Click "+ New Lexeme Spec"
2. Fill in:
   - **ID**: e.g., `elven_nouns`
   - **Culture ID**: e.g., `elven`
   - **Part of Speech**: Select from dropdown (noun, verb_3sg, adj, etc.)
   - **Style Description**:
     ```
     ethereal, nature-focused, flowing, elvish.
     Think Tolkien-esque: stars, trees, light, ancient natural phenomena
     ```
   - **Target Count**: `30` (how many words to generate)
3. Click "Save"

Repeat for different POS tags and cultures as needed.

### Step 4: Generate Content

Navigate to the **Generate** tab:

1. **Enter API Key** (if not set in server env):
   - Your Anthropic API key (`sk-ant-...`)

2. **Select a Spec** from dropdown:
   - Choose a lexeme spec you created

3. **Click "Generate"**:
   - Wait ~5-10 seconds for LLM generation
   - View generated words and token usage
   - Words are automatically filtered by quality constraints

4. **Repeat** for other specs

### Step 5: Export Configuration

Navigate to the **Export** tab:

1. Review configuration summary:
   - Domains count
   - Generated lexeme lists count
   - Specs count

2. **Download JSON**:
   - Click "📥 Download JSON"
   - Saves `{metaDomain}-config-{timestamp}.json`

3. **Or Copy to Clipboard**:
   - Click "📋 Copy to Clipboard"
   - Paste into your code/config files

## Configuration Structure

Exported JSON includes:

```json
{
  "metaDomain": "test",
  "timestamp": "2025-01-24T...",
  "domains": [
    {
      "id": "elven_high",
      "cultureId": "elven",
      "phonology": { ... },
      "morphology": { ... },
      "style": { ... }
    }
  ],
  "lexemeLists": [
    {
      "id": "elven_nouns",
      "entries": ["Stars", "Moon", "Dawn", ...]
    }
  ],
  "profiles": [],
  "specs": {
    "lexeme": [...],
    "template": [...]
  }
}
```

## Using Exported Config

### With World-Gen Integration

```typescript
import { generateFromProfile, ExecutionContext } from 'world-gen-naming';

// Load your exported config
const config = JSON.parse(fs.readFileSync('test-config.json', 'utf-8'));

// Create execution context
const context: ExecutionContext = {
  domains: config.domains,
  profiles: config.profiles,
  lexemeLists: config.lexemeLists,
  grammarRules: [],
  entityLookup: myKnowledgeGraphAdapter, // Your KG adapter
  seed: 'my-seed'
};

// Generate names
const name = generateFromProfile(myProfile, context);
```

### With Direct Domain Usage

```typescript
import { generateName } from 'world-gen-naming';

// Use a domain from config
const domain = config.domains.find(d => d.id === 'elven_high');

// Generate name
const name = generateName({
  kind: 'npc',
  subKind: 'elf',
  tags: ['high', 'ancient']
}, [domain], { seed: 'my-seed' });
```

## Tips

### Good Style Descriptions

✅ **Good**:
```
ethereal, nature-focused, flowing, elvish.
Think Tolkien-esque: stars, trees, light, ancient natural phenomena
```

❌ **Too vague**:
```
fantasy names
```

### POS Tags Reference

- `noun` - Common nouns (tree, river, mountain)
- `verb_3sg` - Third-person singular verbs (walks, runs, hides)
- `adj` - Adjectives (dark, ancient, sacred)
- `noun_abstract` - Abstract nouns (honor, wisdom, courage)
- `prep` - Prepositions (in, under, through)
- `ordinal` - Ordinal numbers (first, second, third)

### Cost Estimation

- **Lexeme list (30 words)**: ~$0.004-0.006
- **Lexeme list (50 words)**: ~$0.006-0.008
- **With LLM critic enabled**: +$0.002-0.004

Total for a complete culture (5-10 lexeme lists): **~$0.03-0.08**

## Troubleshooting

### "API key required" error

**Solution**: Either:
1. Set `ANTHROPIC_API_KEY` environment variable before starting API server
2. OR enter API key in the Web UI generation panel

### "Failed to fetch" error

**Solution**: Make sure API server is running on port 3001:
```bash
npm run api
```

### No generated content appears

**Solution**:
1. Check browser console for errors
2. Verify API server logs for LLM errors
3. Ensure API key is valid
4. Try simpler style descriptions

### Generation is slow

**Expected**: First generation takes 5-15 seconds (LLM call)
- Subsequent generations are similar
- Use smaller `targetCount` for faster testing

## Architecture

```
┌─────────────┐         HTTP/JSON        ┌──────────────┐
│  React UI   │ ←──────────────────────→ │ Express API  │
│ (port 5173) │                          │ (port 3001)  │
└─────────────┘                          └──────────────┘
                                                  │
                                                  ▼
                                         ┌──────────────────┐
                                         │ Anthropic Claude │
                                         │   (LLM calls)    │
                                         └──────────────────┘
```

- **React UI**: Visual configuration builder
- **Express API**: Wraps LLM generation logic
- **Anthropic**: Claude 3.5 Sonnet for content generation

## Next Steps

1. **Create your first culture**:
   - Start with "Test" meta-domain
   - Create 2-3 lexeme specs (nouns, verbs, adjectives)
   - Generate content
   - Export config

2. **Test with name generation**:
   - Import exported config into your codebase
   - Use with `generateFromProfile()` or `generateName()`
   - Verify names have correct style

3. **Expand to Penguin domain**:
   - Switch to "Penguin World" meta-domain
   - Create Imperial, Orcish, Coastal cultures
   - Generate lexemes for each
   - Export penguin config

## Support

For issues or questions:
- Check `GENERATION.md` for LLM generation details
- Check API server logs for errors
- Verify all dependencies are installed
- Ensure Node.js version >= 18
