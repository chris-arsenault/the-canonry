# Automated Content Generation (Phase 5)

This document explains how to use the automated content generation system to create lexeme lists and naming templates without hand-crafting them.

## Overview

The generation system uses LLMs (Claude via Anthropic API) to generate:
- **Lexeme lists**: Word lists for template slots (verbs, nouns, adjectives, etc.)
- **Templates**: Naming patterns for different entity types and cultures

**Key Benefits:**
- Generate 30-50 thematically appropriate words in seconds
- Create diverse templates that match cultural styles
- Automatic quality filtering (length, banned words, pattern matching)
- Optional LLM critic for additional quality control
- Reproducible via spec files (just JSON)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set API Key

Set your Anthropic API key as an environment variable:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

Or pass it via `--api-key` flag when running commands.

## Usage

### Generate a Lexeme List

```bash
npm run generate -- lexeme <spec-file> [options]
```

**Example:**
```bash
npm run generate -- lexeme specs/examples/elven-nouns-lexeme.json -v
```

**Options:**
- `-o, --output <dir>` - Output directory (default: `./lexemes`)
- `--no-overwrite` - Don't overwrite existing files
- `--api-key <key>` - API key (or use env var)
- `--model <name>` - Model to use (default: `claude-3-5-sonnet-20241022`)
- `--temperature <temp>` - Temperature 0-1 (default: 1.0)
- `-v, --verbose` - Verbose output

### Generate Templates

```bash
npm run generate -- template <spec-file> [options]
```

**Example:**
```bash
npm run generate -- template specs/examples/orcish-battle-template.json -v
```

**Options:** Same as lexeme command, plus:
- `-o, --output <dir>` - Output directory (default: `./profiles`)

### Generate Batch (Multiple Lexemes + Templates)

```bash
npm run generate -- batch <spec-file> [options]
```

**Example:**
```bash
npm run generate -- batch specs/examples/penguin-imperial-batch.json -v
```

**Options:**
- `--lexeme-output <dir>` - Lexeme output directory (default: `./lexemes`)
- `--template-output <dir>` - Template output directory (default: `./profiles`)
- `--continue-on-error` - Continue even if some generations fail (default: true)

## Spec File Format

### Lexeme Slot Spec

```json
{
  "id": "elven_natural_nouns",
  "cultureId": "elven",
  "pos": "noun",
  "style": "ethereal, nature-focused, flowing, elvish",
  "targetCount": 40,
  "sourceMode": "llm",
  "description": "Natural nouns for Elven names",
  "qualityFilter": {
    "minLength": 3,
    "maxLength": 15,
    "allowedPattern": "^[A-Z][a-z]+$",
    "requireCapitalized": true,
    "llmCritic": true
  },
  "examples": [
    "Stars",
    "Moon",
    "Forest"
  ]
}
```

**Fields:**
- `id` (string, required): Unique identifier for this lexeme list
- `cultureId` (string, required): Culture identifier (e.g., "elven", "orcish")
- `pos` (PosTag, required): Part of speech (see POS Tags below)
- `style` (string, required): Natural language description of style
- `targetCount` (number, required): How many words to generate
- `sourceMode` ("llm" | "corpus" | "mixed", required): Generation method
- `description` (string, optional): Human-readable description
- `qualityFilter` (object, optional): Automatic filtering rules
- `examples` (string[], optional): Example words to guide generation

**Quality Filter Options:**
- `minLength` (number): Minimum character length
- `maxLength` (number): Maximum character length
- `forbiddenSubstrings` (string[]): Reject entries containing these
- `bannedWords` (string[]): Reject these exact words
- `allowedPattern` (string): Regex pattern (entries must match)
- `requireCapitalized` (boolean): Must start with capital letter
- `llmCritic` (boolean): Use LLM to filter out-of-place entries

### Template Spec

```json
{
  "id": "orcish_battle_names",
  "cultureId": "orcish",
  "type": "battle",
  "style": "brutal, aggressive, simple, direct",
  "targetCount": 8,
  "sourceMode": "llm",
  "description": "Templates for Orcish battle names",
  "slotHints": [
    {
      "name": "VERB",
      "kind": "lexemeList",
      "description": "Violent action verb",
      "listId": "orcish_battle_verbs"
    },
    {
      "name": "PLACE",
      "kind": "entityName",
      "description": "Location name from knowledge graph"
    }
  ],
  "examples": [
    "The {{PLACE}} Smash",
    "{{ADJ}} {{NOUN}}"
  ]
}
```

**Fields:**
- `id` (string, required): Unique identifier
- `cultureId` (string, required): Culture identifier
- `type` (string, required): Entity type ("person", "battle", "spell", etc.)
- `style` (string, required): Natural language style description
- `targetCount` (number, required): How many templates to generate
- `sourceMode` ("llm" | "corpus" | "mixed", required): Generation method
- `slotHints` (SlotHint[], required): Available slots for templates
- `examples` (string[], optional): Example templates
- `description` (string, optional): Human-readable description

**Slot Hint Fields:**
- `name` (string): Slot name in UPPER_CASE (used as `{{SLOT_NAME}}`)
- `kind` (string): "lexemeList" | "phonotactic" | "grammar" | "entityName" | "subGenerator"
- `description` (string): What this slot represents
- `listId` (string, optional): For lexemeList slots
- `domainId` (string, optional): For phonotactic slots
- `grammarId` (string, optional): For grammar slots

### Batch Spec

```json
{
  "name": "penguin_imperial_complete",
  "description": "Complete Imperial Penguin culture",
  "lexemeSpecs": [
    { ...lexeme spec... },
    { ...lexeme spec... }
  ],
  "templateSpecs": [
    { ...template spec... },
    { ...template spec... }
  ],
  "profileSpecs": []
}
```

## POS Tags

Supported parts of speech for lexeme generation:

- `noun` - Common noun (person, place, thing)
- `noun_proper` - Proper noun (specific name)
- `noun_abstract` - Abstract noun (concept, idea, quality)
- `verb` - Base form verb (infinitive)
- `verb_3sg` - Third-person singular present (walks, runs, hides)
- `verb_past` - Past tense (walked, ran, hid)
- `verb_gerund` - -ing form (walking, running, hiding)
- `adj` - Adjective (describing word)
- `adv` - Adverb (modifies verbs/adjectives)
- `prep` - Preposition (in, on, under, through)
- `ordinal` - Ordinal number (first, second, third)
- `any` - Any part of speech

## Examples

### Example 1: Generate Elven Nature Nouns

```bash
npm run generate -- lexeme specs/examples/elven-nouns-lexeme.json -v
```

This generates 40 nature-themed nouns for Elven naming, with automatic filtering and LLM critic enabled.

**Output:** `lexemes/elven-noun.json`

### Example 2: Generate Orcish Battle Templates

```bash
npm run generate -- template specs/examples/orcish-battle-template.json -v
```

This generates 8 templates for Orcish battle names with slots for verbs, nouns, adjectives, and place names.

**Output:** `profiles/orcish-battle.json`

### Example 3: Generate Complete Imperial Culture

```bash
npm run generate -- batch specs/examples/penguin-imperial-batch.json -v
```

This generates:
- 3 lexeme lists (titles, virtues, ordinals)
- 2 template sets (person names, law names)

**Outputs:**
- `lexemes/imperial-noun.json`
- `lexemes/imperial-noun_abstract.json`
- `lexemes/imperial-ordinal.json`
- `profiles/imperial-person.json`
- `profiles/imperial-law.json`

## Tips for Writing Good Specs

### Style Descriptions

Be specific and evocative:

✅ Good:
```
"ethereal, nature-focused, flowing, elvish. Think Tolkien-esque: stars, trees, light, ancient natural phenomena"
```

❌ Too vague:
```
"fantasy names"
```

### Quality Filters

Use filters to enforce consistency:

```json
{
  "minLength": 4,
  "maxLength": 12,
  "allowedPattern": "^[A-Z][a-z]+s$",
  "requireCapitalized": true
}
```

This ensures all entries:
- Are 4-12 characters
- Match pattern (capitalized word ending in 's')
- Start with capital letter

### LLM Critic

Enable `llmCritic: true` for important lexeme lists where quality matters more than speed. The LLM will review generated words and filter out anything that feels out-of-place.

**Trade-off:** Uses extra tokens and adds ~10-20 seconds per list.

### Examples

Provide 3-6 examples to guide the LLM's style:

```json
{
  "examples": [
    "Steals",
    "Sneaks",
    "Pilfers",
    "Scurries"
  ]
}
```

## Cost Estimation

Approximate token usage:

- **Lexeme list (30-50 words)**: ~1,000-1,500 tokens (~$0.004-0.006)
- **Template set (5-10 templates)**: ~1,500-2,000 tokens (~$0.006-0.008)
- **LLM critic (per list)**: ~500-1,000 tokens (~$0.002-0.004)

**Example batch cost** (3 lexeme lists + 2 template sets with critic):
- Total: ~8,000-10,000 tokens
- Cost: ~$0.032-0.040 (less than 4 cents)

## Troubleshooting

### "Anthropic API key not provided"

Set the `ANTHROPIC_API_KEY` environment variable or pass `--api-key`:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
# or
npm run generate -- lexeme spec.json --api-key "sk-ant-..."
```

### "Failed to parse JSON response"

The LLM occasionally returns invalid JSON. The system will automatically retry (up to 3 times). If it still fails, try:
- Simplifying your style description
- Reducing targetCount
- Adjusting temperature (lower = more deterministic)

### "Uses unavailable slot: X"

The generated template uses a slot that's not in `slotHints`. This usually happens when:
- The LLM invents a new slot name
- There's a typo in the template

The system automatically filters these out. If too many are invalid, adjust your examples or style description.

### Rate Limiting

The system adds a 1-second delay between requests. For large batches (10+ specs), expect 20-30 seconds total runtime.

## Next Steps

1. Create spec files for your cultures and entity types
2. Generate lexemes and templates
3. Use generated content in your naming profiles
4. Integrate with world-gen simulation

For integration with validation metrics, see [02_VALIDATION.md](./02_VALIDATION.md).
