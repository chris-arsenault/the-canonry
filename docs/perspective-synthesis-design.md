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
│  - All facts                │
│  - Narrative style          │
│                             │
│  Outputs:                   │
│  - Perspective brief (150-200w) │
│  - Faceted facts (configurable) │
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
│  - Faceted facts            │
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

## Component 2: Canon Facts

Facts are plain world truths with minimal control metadata. The LLM is responsible for selecting which facts to facet based on the chronicle’s constellation.

### Schema
```typescript
interface CanonFactWithMetadata {
  id: string;
  text: string;
  type?: 'world_truth' | 'generation_constraint';
  required?: boolean; // If true, must appear in facets
}
```

### Fact Selection Rules
- `generation_constraint` facts are always included verbatim in generation and never faceted.
- `required` facts must appear in the facets list.
- An optional `factSelection.targetCount` can request an exact number of facts to facet. Required facts count toward this. If required facts exceed the target (or the default 4–6 range), required facts are still included and optional facts are omitted.

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

WORLD FACTS (truths about this world):
{factsWithMetadata.map(f => `- [${f.id}] ${f.text}`).join('\n')}

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

2. FACETED FACTS (select the most relevant facts)
Select the most relevant world-truth facts for this chronicle (4-6 by default, or the configured target).
For each, provide a 1-2 sentence interpretation showing how this fact manifests for these entities.

3. SUGGESTED MOTIFS (2-3 short phrases)
What recurring images, phrases, or themes might echo through this chronicle?
These should feel natural to the entities involved, not forced. Avoid "the ice
remembers" unless this chronicle is specifically about memory/artifacts.
```

### Expected Output Format

```typescript
interface PerspectiveSynthesis {
  brief: string; // 150-200 words of perspective guidance
  facets: Array<{ factId: string; interpretation: string }>;
  suggestedMotifs: string[];
  narrativeVoice: Record<string, string>;
  entityDirectives: Array<{ entityId: string; entityName: string; directive: string }>;
}
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
    factSelection?: { targetCount?: number };
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

  // 3. Assemble tone from fragments
  const assembledTone = assembleTone(options.toneFragments, constellation);

  // 4. Synthesize perspective (LLM call)
  const perspective = await synthesizePerspective({
    constellation,
    entities: baseContext.entities,
    focalEra: baseContext.era,
    factsWithMetadata: options.factsWithMetadata,
    toneFragments: options.toneFragments,
    factSelection: options.factSelection,
  });

  // 5. Return augmented context
  return {
    ...baseContext,

    // Replace flat tone with assembled + perspective
    tone: assembledTone + '\n\n' + 'PERSPECTIVE FOR THIS CHRONICLE:\n' + perspective.brief,

    // Replace all facts with faceted facts
    canonFacts: perspective.facetedFacts,

    // Add suggested motifs for generation to use
    suggestedMotifs: perspective.suggestedMotifs,
  };
}
```

---

## Open Questions

1. **Tone fragment authoring** - Should I draft the full fragmented tone based on the current blob, or do you want to author these?

2. **Fact selection controls** - Is `required` + `targetCount` enough, or do we need additional steering?

3. **LLM model choice** - The perspective synthesis could use a smaller/faster model (haiku) since it's extraction/emphasis, not generation. Cost/quality tradeoff?

4. **Caching** - Should perspective synthesis be cached? Same entity set + same era = same perspective? Or allow variation?

5. **Fallback** - If LLM synthesis fails, should we fall back to rule-based fact selection + assembled tone without perspective brief?

---

## Next Steps

1. [ ] Review and refine this design
2. [ ] Author tone fragments from existing tone blob
3. [ ] Add required/target configuration to `illuminatorConfig.json`
4. [ ] Implement constellation analyzer
5. [ ] Implement perspective synthesizer
6. [ ] Integrate into chronicle generation pipeline
7. [ ] Test with diverse entity sets
