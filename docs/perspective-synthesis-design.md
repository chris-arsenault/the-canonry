# Perspective Synthesis System Design

## Goal

Provide each chronicle with a **facet** of the same world - not a different world, but a different *emphasis* within the same world. The facet is derived from the chronicle's entity constellation and focal era.

**Key constraint:** Stories must feel like they exist in the same universe. The perspective synthesis adjusts emphasis, not facts. Core world truths remain inviolable.

---

## Architecture Overview

```
Entity Constellation + Focal Era
         │
         ▼
┌─────────────────────────────┐
│  Constellation Analyzer     │
│  (rule-based, no LLM)       │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Perspective Synthesizer    │
│  (LLM-assisted)             │
│                             │
│  Inputs:                    │
│  - Constellation analysis   │
│  - Core tone fragments      │
│  - All facts with metadata  │
│  - Narrative style          │
│                             │
│  Outputs:                   │
│  - Perspective brief (200w) │
│  - Prioritized facts (3-5)  │
│  - Suggested motifs         │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Chronicle Generation       │
│  (existing pipeline)        │
│                             │
│  Receives:                  │
│  - Core tone (always)       │
│  - Perspective brief        │
│  - Prioritized facts        │
│  - Full entity context      │
└─────────────────────────────┘
```

---

## Component 1: Entity Constellation Analyzer

Pure TypeScript function, no LLM. Computes signals from the entity set.

### Input
```typescript
interface ConstellationInput {
  entities: EntityContext[];     // From buildChronicleContext
  relationships: RelationshipContext[];
  events: NarrativeEventContext[];
  focalEra?: EraContext;
}
```

### Output
```typescript
interface EntityConstellation {
  // Culture distribution
  cultures: Record<string, number>;  // { "nightshelf": 3, "aurora_stack": 1 }
  dominantCulture: string | null;    // Majority culture, or null if balanced
  cultureBalance: 'single' | 'dominant' | 'mixed';  // >80%, 50-80%, <50%

  // Kind distribution
  kinds: Record<string, number>;     // { "npc": 4, "artifact": 1, "location": 1 }
  dominantKind: string | null;
  kindFocus: 'character' | 'place' | 'object' | 'event' | 'mixed';

  // Entity tags (aggregated)
  tagFrequency: Record<string, number>;  // { "trade": 2, "conflict": 1 }
  prominentTags: string[];               // Top 3-5 tags

  // Relationships
  relationshipKinds: Record<string, number>;  // { "ally": 2, "rival": 1 }
  hasConflict: boolean;
  hasTrade: boolean;
  hasFamilial: boolean;

  // Temporal
  focalEraId: string | null;
  eraSpan: 'single' | 'multiple';

  // Spatial (if coordinates available)
  coordinateCentroid?: { x: number; y: number };
  spatialSpread: 'tight' | 'dispersed';

  // Computed focus description (for prompt)
  focusSummary: string;  // e.g., "Nightshelf-dominant, NPC-focused, trade-related"
}
```

### Implementation Logic

```typescript
function analyzeConstellation(input: ConstellationInput): EntityConstellation {
  // Culture analysis
  const cultures: Record<string, number> = {};
  for (const e of input.entities) {
    if (e.culture) cultures[e.culture] = (cultures[e.culture] || 0) + 1;
  }
  const totalEntities = input.entities.length;
  const [topCulture, topCount] = Object.entries(cultures)
    .sort((a, b) => b[1] - a[1])[0] || [null, 0];

  const cultureBalance =
    topCount / totalEntities > 0.8 ? 'single' :
    topCount / totalEntities > 0.5 ? 'dominant' : 'mixed';

  // Kind analysis
  const kinds: Record<string, number> = {};
  for (const e of input.entities) {
    kinds[e.kind] = (kinds[e.kind] || 0) + 1;
  }

  const kindFocus = computeKindFocus(kinds);  // character/place/object/event/mixed

  // Tag aggregation
  const tagFrequency: Record<string, number> = {};
  for (const e of input.entities) {
    for (const [key, value] of Object.entries(e.tags || {})) {
      if (value) tagFrequency[key] = (tagFrequency[key] || 0) + 1;
    }
  }

  // Relationship analysis
  const relationshipKinds: Record<string, number> = {};
  for (const r of input.relationships) {
    relationshipKinds[r.kind] = (relationshipKinds[r.kind] || 0) + 1;
  }

  // Build focus summary
  const focusSummary = buildFocusSummary(cultureBalance, topCulture, kindFocus, prominentTags);

  return {
    cultures,
    dominantCulture: cultureBalance !== 'mixed' ? topCulture : null,
    cultureBalance,
    kinds,
    dominantKind: /* ... */,
    kindFocus,
    tagFrequency,
    prominentTags: Object.entries(tagFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag),
    relationshipKinds,
    hasConflict: /* check for conflict-type relationships */,
    hasTrade: /* check for trade-type relationships */,
    hasFamilial: /* check for family-type relationships */,
    focalEraId: input.focalEra?.id || null,
    eraSpan: /* single or multiple */,
    focusSummary,
  };
}
```

---

## Component 2: Fact Metadata

Each fact gets metadata for relevance scoring.

### Schema
```typescript
interface CanonFactWithMetadata {
  id: string;
  text: string;

  // Relevance boosters
  relevantCultures: string[];      // ["nightshelf", "aurora_stack", "*"]
  relevantKinds: string[];         // ["artifact", "npc", "*"]
  relevantTags: string[];          // ["trade", "conflict", "magic"]
  relevantRelationships: string[]; // ["ally", "rival", "trade_partner"]

  // Base priority (0-1)
  basePriority: number;  // Higher = more likely to be included

  // Is this a core world truth that should never be excluded?
  isCore: boolean;
}
```

### Current Facts with Proposed Metadata

```typescript
const CANON_FACTS: CanonFactWithMetadata[] = [
  {
    id: "berg-nature",
    text: "The Berg is a supernatural iceberg of impossible scale...",
    relevantCultures: ["*"],
    relevantKinds: ["location", "era"],
    relevantTags: [],
    relevantRelationships: [],
    basePriority: 0.9,
    isCore: true  // Always include - defines the world
  },
  {
    id: "penguin-sapience",
    text: "Penguins evolved sapience through exposure to aurora-light...",
    relevantCultures: ["aurora_stack", "nightshelf"],
    relevantKinds: ["npc"],
    relevantTags: [],
    relevantRelationships: [],
    basePriority: 0.7,
    isCore: true  // Always include - species definition
  },
  {
    id: "two-civilizations",
    text: "Two penguin civilizations exist: the Aurora Stack... and the Nightshelf...",
    relevantCultures: ["aurora_stack", "nightshelf"],
    relevantKinds: ["faction", "location"],
    relevantTags: [],
    relevantRelationships: [],
    basePriority: 0.8,
    isCore: true  // Always include - world structure
  },
  {
    id: "orca-raiders",
    text: "Orca pods are intelligent raiders from the surrounding sea...",
    relevantCultures: ["orca"],
    relevantKinds: ["npc", "faction", "occurrence"],
    relevantTags: ["conflict", "raid", "religious"],
    relevantRelationships: ["enemy", "rival"],
    basePriority: 0.5,
    isCore: false  // Only relevant when orcas involved
  },
  {
    id: "magic-sources",
    text: "Magic on The Berg draws from three sources...",
    relevantCultures: ["*"],
    relevantKinds: ["artifact", "ability", "rule"],
    relevantTags: ["magic", "ritual", "power"],
    relevantRelationships: [],
    basePriority: 0.6,
    isCore: false  // Important but not always relevant
  },
  {
    id: "ice-remembers",
    text: "The Berg's ice remembers. Ancient events leave literal impressions...",
    relevantCultures: ["*"],
    relevantKinds: ["artifact", "location", "era", "occurrence"],
    relevantTags: ["ancient", "historical", "memory"],
    relevantRelationships: [],
    basePriority: 0.4,  // LOWER base priority - not every story needs this
    isCore: false  // NOT core - this is a feature, not a foundation
  },
  {
    id: "no-escape",
    text: "No penguin has ever successfully left The Berg and returned...",
    relevantCultures: ["*"],
    relevantKinds: ["location"],
    relevantTags: ["exploration", "edge", "horizon"],
    relevantRelationships: [],
    basePriority: 0.3,
    isCore: false  // Rarely relevant unless story is about edges/escape
  },
  {
    id: "flipper-accord",
    text: "The two colonies maintain an uneasy peace through the Flipper Accord...",
    relevantCultures: ["aurora_stack", "nightshelf"],
    relevantKinds: ["faction"],
    relevantTags: ["trade", "politics", "diplomacy"],
    relevantRelationships: ["trade_partner", "ally"],
    basePriority: 0.5,
    isCore: false  // Only relevant for cross-cultural or trade stories
  },
  {
    id: "no-humans",
    text: "All sapient beings in this world are penguins or orcas...",
    relevantCultures: ["*"],
    relevantKinds: ["*"],
    relevantTags: [],
    relevantRelationships: [],
    basePriority: 0.9,
    isCore: true  // Always include - prevents human intrusion
  }
];
```

### Relevance Scoring

```typescript
function scoreFacts(
  facts: CanonFactWithMetadata[],
  constellation: EntityConstellation
): Array<{ fact: CanonFactWithMetadata; score: number }> {
  return facts.map(fact => {
    let score = fact.basePriority;

    // Culture boost
    if (fact.relevantCultures.includes("*") ||
        fact.relevantCultures.some(c => constellation.cultures[c])) {
      score += 0.2;
    }

    // Kind boost
    if (fact.relevantKinds.includes("*") ||
        fact.relevantKinds.some(k => constellation.kinds[k])) {
      score += 0.15;
    }

    // Tag boost
    const matchingTags = fact.relevantTags.filter(t =>
      constellation.prominentTags.includes(t)
    );
    score += matchingTags.length * 0.1;

    // Relationship boost
    const matchingRels = fact.relevantRelationships.filter(r =>
      constellation.relationshipKinds[r]
    );
    score += matchingRels.length * 0.1;

    // Core facts get minimum floor
    if (fact.isCore) {
      score = Math.max(score, 0.8);
    }

    return { fact, score };
  });
}
```

---

## Component 3: Tone Fragmentation

Break the current 700-word tone into composable pieces.

### Proposed Structure

```typescript
interface ToneFragments {
  // Always included (~200 words)
  core: string;

  // Included based on dominant culture (~100 words each)
  cultureOverlays: {
    nightshelf: string;
    aurora_stack: string;
    orca: string;
    mixed: string;  // For cross-cultural stories
  };

  // Included based on entity kind focus (~80 words each)
  kindOverlays: {
    character: string;  // NPC-heavy
    place: string;      // Location-heavy
    object: string;     // Artifact-heavy
    event: string;      // Occurrence-heavy
    mixed: string;      // Balanced
  };

  // Era-specific overlays (optional)
  eraOverlays?: Record<string, string>;
}
```

### Core Tone (~200 words)
*Always included - defines the baseline*

```
Dark, war-weary fantasy. History is written by survivors who remember the cost.

STYLE PRINCIPLES:
- Specificity over abstraction: Not 'a weapon' but 'a fire-core hammer with a cracked head.'
- Show through action and object, not introspection
- Subtext over statement: Let implications land
- Trust the reader: Don't explain metaphors. End on images, not morals.

SYNTACTIC POETRY:
Compressed power through rhythm and omission. Semicolons can do the work of paragraphs.

BITTER CAMARADERIE:
Include dark humor, loyalty despite failure, small kindnesses in terrible contexts.

AVOID AI TELLS:
No balance words (yet, however, ultimately). No introspection clichés.
No clean resolutions. Not everything works out.
```

### Culture Overlays (~100 words each)

**Nightshelf overlay:**
```
Underground textures: the way sound echoes differently, the smell of mineral and
fire-core, the constant awareness of weight above. Secrets are currency.
Silences speak louder than words. Fire is survival, not metaphor - when characters
share fire-core warmth, it costs them something real. The darkness isn't absence -
it's presence. Nightshelf characters notice light as intrusion, not relief.
```

**Aurora Stack overlay:**
```
Vertical perspectives: height as status, the weight of sky, the way light changes
with position. Formality masks negotiation. Consensus is performance. Characters
speak in layers - the words, the tone, the position they speak from. Crystal and
ice are tools, not wonder - the Stack has lived with aurora-light so long it's
infrastructure, not magic. Cold is baseline, not threat.
```

**Orca overlay:**
```
Predator logic: everything is territory, resource, or threat. Pack bonds are
absolute - betraying pod is worse than death. Violence is honest; diplomacy is
weakness performed. Water is home; land is hunting ground. The dead god isn't
mythology - it's destination. Every raid serves the waking.
```

**Mixed culture overlay:**
```
Translation failures: what one culture considers courtesy, another reads as
insult. Trade requires trust no one fully extends. Characters code-switch -
different selves for different audiences. The Accord is a scar everyone picks at.
Neither side believes the other understands the cost. Third spaces (trading posts,
neutral ground) have their own rules that satisfy no one.
```

### Kind Overlays (~80 words each)

**Character focus:**
```
Bodies carry history: scars, habits, the way someone holds themselves.
What they reach for under stress. Who they mention without naming.
The gap between reputation and person. Someone remembers them differently
than they remember themselves.
```

**Place focus:**
```
Locations have moods, not just features. Who built this and who uses it now -
the layers. What sound fills the silence. Where people gather vs where they
avoid. The unofficial names. What happened here that no one talks about.
```

**Object focus:**
```
Artifacts earn their weight through use, not description. Who held it last.
What it costs to carry. The scratch that tells a story. Why someone refuses
to touch it. Objects have wakes - they change what's near them.
```

**Event focus:**
```
History is what survivors choose to remember. The official version vs what
actually happened. Who benefits from this telling. The detail everyone
includes that wasn't actually important. The crucial thing no one mentions.
```

---

## Component 4: Perspective Synthesizer (LLM-Assisted)

### Purpose

Synthesize a **perspective brief** that adjusts emphasis while maintaining world coherence. The output helps the chronicle generation focus on relevant aspects without contradicting canon.

### Prompt Design

```
SYSTEM:
You are a perspective consultant for a fantasy chronicle series. Your job is to
help each chronicle feel like a distinct window into the same world - not a
different world, but a different EMPHASIS within the same world.

You will receive:
1. An analysis of which entities this chronicle focuses on
2. Core tone guidance for the world
3. A list of world facts with relevance scores

Your output is a brief perspective guide that tells the story generator what to
EMPHASIZE for this specific chronicle. You are NOT creating new facts or changing
the world - you are choosing what to foreground and what to let recede.

USER:
CHRONICLE FOCUS:
{constellation.focusSummary}

Dominant culture: {constellation.dominantCulture || 'mixed'}
Entity focus: {constellation.kindFocus}
Era: {focalEra?.name || 'unspecified'}
Prominent themes: {constellation.prominentTags.join(', ')}
Relationship dynamics: {hasConflict ? 'conflict present' : ''} {hasTrade ? 'trade present' : ''}

ENTITIES IN THIS CHRONICLE:
{entities.map(e => `- ${e.name} (${e.kind}, ${e.culture}): ${e.summary || e.description?.slice(0, 100)}`).join('\n')}

WORLD FACTS (with relevance to this chronicle):
{scoredFacts.map(f => `[${f.score.toFixed(1)}] ${f.fact.text}`).join('\n')}

CORE TONE:
{toneFragments.core}

---

Based on this specific chronicle's focus, provide:

1. PERSPECTIVE BRIEF (150-200 words)
What lens should this chronicle view the world through? What concerns, fears, or
preoccupations would these specific entities have? What aspects of the world feel
most present to THEM?

Do NOT invent new world facts. Do NOT contradict existing facts. Instead, choose
what to emphasize - what's in the foreground vs background for these characters.

2. PRIORITIZED FACTS (list 3-5 fact IDs in order of relevance)
Which facts matter most for THIS specific story? List by ID.

3. SUGGESTED MOTIFS (2-3 short phrases)
What recurring images, phrases, or themes might echo through this chronicle?
These should feel natural to the entities involved, not forced. Avoid "the ice
remembers" unless this chronicle is specifically about memory/artifacts.
```

### Expected Output Format

```typescript
interface PerspectiveSynthesis {
  brief: string;           // 150-200 words of perspective guidance
  prioritizedFactIds: string[];  // e.g., ["berg-nature", "two-civilizations", "flipper-accord"]
  suggestedMotifs: string[];     // e.g., ["fire shared is debt owed", "the tunnels know"]
}
```

### Example Output

For a chronicle with 3 Nightshelf NPCs, 1 artifact tagged "trade", mixed with 1 Aurora Stack character:

```
PERSPECTIVE BRIEF:
This chronicle sees the world from below - literally. The characters live where
light is work, not given. Fire is the measure of all things: debts are counted in
fire-core hours, trust is proven by who you'd share warmth with, betrayal is
letting someone's fire go out.

The Aurora Stack character is an outsider here, their assumptions about "up" and
"open" constantly challenged. They notice the dark; the Nightshelf characters
notice *them* noticing. The trade artifact matters because trade is how these
worlds touch without merging - and touch leaves marks.

Emphasize: the weight of what's above, the cost of warmth, the way secrets move
through tunnels faster than official messages. De-emphasize: aurora-magic,
surface politics, the orca threat (they're distant here, a story told to scare
children).

PRIORITIZED FACTS:
- two-civilizations
- flipper-accord
- magic-sources
- berg-nature

SUGGESTED MOTIFS:
- "Fire shared is fire halved" (Nightshelf proverb about cost of generosity)
- "The ceiling remembers" (local variant - not ice, but stone above)
- "Surface manners" (said dismissively about politeness without substance)
```

---

## Integration Point

### Modified buildChronicleContext

```typescript
export async function buildChronicleContextWithPerspective(
  selections: ChronicleSelections,
  worldData: WorldData,
  worldContext: WorldContext,
  narrativeStyle: NarrativeStyle,
  options: {
    nameBank?: Record<string, string[]>;
    proseHints?: Record<string, string>;
    culturalIdentities?: Record<string, Record<string, string>>;
    temporalContext?: ChronicleTemporalContext | null;
    toneFragments: ToneFragments;
    factsWithMetadata: CanonFactWithMetadata[];
  }
): Promise<ChronicleGenerationContext> {

  // 1. Build base context (existing logic)
  const baseContext = buildChronicleContext(
    selections, worldData, worldContext, narrativeStyle,
    options.nameBank, options.proseHints, options.culturalIdentities, options.temporalContext
  );

  // 2. Analyze entity constellation
  const constellation = analyzeConstellation({
    entities: baseContext.entities,
    relationships: baseContext.relationships,
    events: baseContext.events,
    focalEra: baseContext.era,
  });

  // 3. Score facts
  const scoredFacts = scoreFacts(options.factsWithMetadata, constellation);

  // 4. Assemble tone from fragments
  const assembledTone = assembleTone(options.toneFragments, constellation);

  // 5. Synthesize perspective (LLM call)
  const perspective = await synthesizePerspective({
    constellation,
    entities: baseContext.entities,
    focalEra: baseContext.era,
    scoredFacts,
    coreTone: options.toneFragments.core,
  });

  // 6. Return augmented context
  return {
    ...baseContext,

    // Replace flat tone with assembled + perspective
    tone: assembledTone + '\n\n' + 'PERSPECTIVE FOR THIS CHRONICLE:\n' + perspective.brief,

    // Replace all facts with prioritized subset
    canonFacts: perspective.prioritizedFactIds
      .map(id => options.factsWithMetadata.find(f => f.id === id)?.text)
      .filter(Boolean) as string[],

    // Add suggested motifs for generation to use
    suggestedMotifs: perspective.suggestedMotifs,
  };
}
```

---

## Open Questions

1. **Tone fragment authoring** - Should I draft the full fragmented tone based on the current blob, or do you want to author these?

2. **Fact metadata** - The proposed metadata above is a starting point. Should facts have more/different relevance signals?

3. **LLM model choice** - The perspective synthesis could use a smaller/faster model (haiku) since it's extraction/emphasis, not generation. Cost/quality tradeoff?

4. **Caching** - Should perspective synthesis be cached? Same entity set + same era = same perspective? Or allow variation?

5. **Fallback** - If LLM synthesis fails, should we fall back to rule-based fact selection + assembled tone without perspective brief?

---

## Next Steps

1. [ ] Review and refine this design
2. [ ] Author tone fragments from existing tone blob
3. [ ] Add metadata to facts in illuminatorConfig.json
4. [ ] Implement constellation analyzer
5. [ ] Implement perspective synthesizer
6. [ ] Integrate into chronicle generation pipeline
7. [ ] Test with diverse entity sets
