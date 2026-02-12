# Chronicle Review Guide

## What Actually Matters

Four questions determine whether a chronicle succeeds. Everything else in this guide is diagnostic — tools for identifying *why* something failed, not *what* success looks like.

1. **Is the accepted story good standalone fiction?** Does it work as a piece of writing a reader would want to finish? Does it have momentum, texture, and emotional weight?
2. **Does it read like machine-generated content?** Are there tells — hedging, balance words, samey rhythms, safe emotional choices, conceptual language where physical language should be?
3. **Does it exercise world lore well?** Are world facts, cultural values, and entity details woven into the story as lived experience, not exposition?
4. **Does it avoid repeating tropes from other stories?** Across the corpus, do chronicles feel like different windows into the same world, or template variations with swapped nouns?

The detailed review dimensions below (PS quality, Story Bible delivery, version comparison, copy-edit assessment, etc.) exist to track common failure modes. When a chronicle fails one of the four core questions, these dimensions help diagnose where in the pipeline the failure originated. They are not the quality bar themselves.

---

## Reviewer Objectivity

Context windows are finite. A reviewer typically holds 3-5 chronicles at a time. This creates a recency and anchoring bias — each new batch feels like it should be ranked against "the corpus," but the corpus isn't in memory.

**Rules:**

1. **No superlative corpus claims.** "Strongest in this batch" is the ceiling for comparative statements. "Best in corpus" or "best piece reviewed" requires a full corpus in context, which you don't have.
2. **Rank within the batch, not across batches.** You can compare the 3-5 pieces you're currently reviewing. You cannot reliably compare them to pieces from previous sessions.
3. **Assess against the style's own goals.** Did the piece do what its narrative style, perspective, and tone guidance asked for? That's measurable. "Outstanding" without reference to specific goals is enthusiasm, not assessment.
4. **Cite evidence, not adjectives.** "The struck clause technique works because it performs grief without breaking legal register" is a review. "This is exceptional" is not.
5. **Acknowledge what you can't see.** If this is the first piece in a given format or style you've reviewed, say so — you have no baseline for comparison within that category.
6. **Praise and criticism are both subject to these rules.** Don't inflate either direction. A piece with no detected issues is "clean," not "flawless." A piece with problems is "has specific issues," not "failed."

---

## Quick Reference: Key Files

### Generation Pipeline
| Component | Location |
|-----------|----------|
| Chronicle Types | `apps/illuminator/webui/src/lib/chronicleTypes.ts` |
| Prompt Builder | `apps/illuminator/webui/src/lib/chronicle/v2/promptBuilder.ts` |
| Copy-Edit Prompt | `apps/illuminator/webui/src/lib/chronicle/v2/copyEditPrompt.ts` |
| Worker Tasks | `apps/illuminator/webui/src/workers/tasks/chronicleTask.ts` |
| LLM Client | `apps/illuminator/webui/src/lib/llmClient.browser.ts` |
| Perspective Synthesizer | `apps/illuminator/webui/src/lib/perspectiveSynthesizer.ts` |

### Pipeline Steps (Story Format)

| Step | Version | What It Does |
|------|---------|-------------|
| Structured generation | V0 | Full prompt with Story Bible framing: beat sheet as requirements, voice textures, entity directives, craft posture |
| Creative freedom | V1 | Same PS guidance reframed as optional: structure "for reference," permission to reassign roles, invent characters, deviate from Character Notes |
| Combine | V2 | Editor merges best elements of V0 and V1 based on editorial direction |
| Copy-edit | V3 | Final polish pass with voice texture and motif preservation context |

**Important:** V0 and V1 receive identical PS content (Tone & Atmosphere, Character Notes, faceted facts, motifs, temporal narrative, perspective brief). The difference is framing, not content. V0 presents the narrative structure as requirements and PS guidance as Story Bible reference. V1 presents structure as optional reference and PS guidance as "pre-synthesized — follow their intent closely, but express them in your own voice." V1 adds permission to reassign narrative roles, invent minor characters, and use framing devices not in the prompt.

### Narrative Styles
| Style Type | Location |
|------------|----------|
| Story Styles | `packages/world-schema/src/narrativeStyles.ts` |
| Document Styles | `packages/world-schema/src/documentStyles.ts` |

### World Lore
| Content | Location |
|---------|----------|
| World Config | `apps/canonry/webui/public/default-project/illuminatorConfig.json` |
| Static Pages | `apps/canonry/webui/public/default-project/staticPages.json` |
| Schema (entities/relationships) | `apps/canonry/webui/public/default-project/schema.json` |

### Documentation
| Topic | Location |
|-------|----------|
| Corpus Review Guide | `docs/chronicle-corpus-review-guide.md` |
| Backport Review Guide | `docs/backport-review-guide.md` |
| Wizard UX Redesign | `apps/illuminator/docs/chronicle-wizard-ux-redesign.md` |

---

## Prompt Architecture

The generation prompt has a three-part structure. Understanding this architecture is essential for reviewing how PS output reaches the LLM and shapes the prose.

### V0 (Structured Generation)

```
CRAFT (how to write):
├── Narrative Structure       ← style's beat sheet (from narrativeStyles.ts), framed as requirements
├── Writing Style             ← coreTone + "PERSPECTIVE FOR THIS CHRONICLE" (PS brief)
│                               + SUGGESTED MOTIFS (PS suggestedMotifs)
│                               + Prose instructions (from narrativeStyles.ts)
└── Craft Posture             ← density/restraint constraints (from narrativeStyles.ts)

STORY BIBLE (background reference, not requirements):
├── Tone & Atmosphere         ← PS narrativeVoice dimensions (e.g., SHARD_THREADING, PRESSURE_AS_GRAMMAR)
└── Character Notes           ← PS entityDirectives (per-entity writing instructions)

WORLD DATA (what to write about):
├── Cast                      ← entity descriptions + narrative role assignments
├── Narrative Lens            ← lens entity description + "NOT a character" guidance
├── World                     ← worldDescription + Canon Facts with [FACET: ...] annotations (PS facets)
├── Name Bank                 ← culture-appropriate names for invented characters
├── Historical Context        ← era definition + "Current Conditions" (PS temporalNarrative)
└── Timeline / Events         ← what happened, to be shown through character experience
```

### V1 (Creative Freedom)

Identical PS content, reframed:

```
TASK DATA (how to write it):
├── Narrative Structure       ← same beat sheet, but "for reference — you can follow, subvert, or ignore"
├── Writing Style             ← same (coreTone, PS brief, motifs, prose instructions)
└── Craft Posture             ← same

GUIDANCE (pre-synthesized — follow intent closely, express in your own voice):
├── Tone & Atmosphere         ← same PS narrativeVoice dimensions
└── Character Notes           ← same PS entityDirectives, but "interpret creatively, don't reproduce"

WORLD DATA (what to write about):
├── Cast                      ← same, but "you may reassign characters to different roles"
├── Narrative Lens            ← same
├── World                     ← same Canon Facts with same [FACET: ...] annotations
├── Name Bank                 ← same
├── Historical Context        ← same (including PS temporalNarrative as Current Conditions)
└── Timeline / Events         ← same
```

### Where Each PS Field Lands

| PS Output Field | V0 Prompt Location | V1 Prompt Location |
|---|---|---|
| `brief` | Writing Style → "PERSPECTIVE FOR THIS CHRONICLE" | Same |
| `narrativeVoice` | Story Bible: Tone & Atmosphere | Tone & Atmosphere |
| `entityDirectives` | Story Bible: Character Notes | Character Notes |
| `facets` | Canon Facts → `[FACET: ...]` annotations | Same |
| `temporalNarrative` | Historical Context → "Current Conditions" | Same |
| `suggestedMotifs` | Writing Style → "SUGGESTED MOTIFS" | Same |

### Review Implication

When reviewing, evaluate these as delivered prompt sections, not as standalone PS artifacts:
- **Story Bible: Tone & Atmosphere** — Do the narrativeVoice dimensions shape the prose's sensory register, rhythm, and emotional texture?
- **Story Bible: Character Notes** — Do the entityDirectives produce distinct portrayals that feel different from each other?
- **Canon Fact Faceting** — Do the [FACET:] interpretations focus the world facts through this chronicle's specific lens?
- **Perspective Brief** — Does the "PERSPECTIVE FOR THIS CHRONICLE" give the output a thesis or organizing principle?
- **Current Conditions** — Does the temporalNarrative create felt constraints in the story, not exposited conditions?
- **Suggested Motifs** — Do the motif phrases echo through the prose, and do they survive the copy-edit?

---

## Review Checklist

### 1. Version Comparison (V0 Structured vs V1 Creative Freedom)

**What to check:**
V0 and V1 receive identical Story Bible content (Tone & Atmosphere, Character Notes, faceted facts, motifs, temporal narrative). The difference is authority: V0 frames structure as requirements and Story Bible as reference; V1 frames structure as optional and grants permission to reassign roles, invent characters, and deviate from Character Notes.

- Does V0's stricter framing produce more reliable format adherence?
- Does V1's latitude produce genuinely different structural choices (role reassignment, framing devices, subverted beat sheet)?
- Which version's prose is stronger — and is the difference attributable to the framing or to sampling variation?
- Does the combine (V2) successfully take the best of both?

**Questions to answer:**
- [ ] Did V1 actually exercise its freedoms (different role assignments, structural deviation, invented characters)?
- [ ] What does V0 do well that V1 misses (format adherence, closer Story Bible realization)?
- [ ] What does V1 do well that V0 misses (structural surprise, invented details, fresh angles)?
- [ ] Does V2 successfully merge both, or does it lose character from either?
- [ ] Does V3 (copy-edit) improve V2 without damaging texture?

### 2. Lore Fit

**What to check:**
- Do entity descriptions match their use in the chronicle?
- Are cultural values correctly represented?
- Are world facts honored (no humans, magic sources, etc.)?
- Are names culturally appropriate?

**Where to find lore:**
- World description: `illuminatorConfig.json` → `worldName`, `worldDescription`
- Cultural identities: `illuminatorConfig.json` → `culturalIdentities`
- Canon facts: `illuminatorConfig.json` → `canonFactsWithMetadata`
- Entity schemas: `schema.json`

**Questions to answer:**
- [ ] Do Nightshelf characters speak in "coded warnings, proverbs with edges"?
- [ ] Do Aurora Stack elements appear as intrusion/corruption when in Nightshelf contexts?
- [ ] Are specific entity details (tags, descriptions) reflected?
- [ ] Are relationships between entities used?

### 3. Comparison Report Assessment

**What to check:**
- Does the comparison identify genuine differences?
- Are its quality judgments defensible?
- Are combine instructions executable without breaking the chosen version?

**Where comparisons are generated:**
```typescript
// chronicleTask.ts → executeCompareStep()
```

**Questions to answer:**
- [ ] Do you agree with the prose quality assessment?
- [ ] Is the structural analysis accurate?
- [ ] Are world-building details correctly attributed?
- [ ] Is the recommendation well-justified?
- [ ] Can the combine instructions actually be followed?

### 4. Perspective Synthesis

PS is a separate pipeline step that runs before generation. It takes the constellation, style, entities, cultural identities, and world dynamics as input and produces a structured output (`perspectiveSynthesis.output` in the export JSON). That output is then distributed across the generation prompt as Story Bible sections (see Prompt Architecture above).

Review has two parts: (a) is the PS output itself well-formed, and (b) does it shape the prose when delivered through the prompt?

**Where perspective synthesis happens:**
```typescript
// perspectiveSynthesizer.ts → synthesizePerspective()
// Input: constellation, style, entities, cultural identities, world dynamics
// Output: brief, facets, narrativeVoice, entityDirectives, temporalNarrative, suggestedMotifs
```

**PS output quality** (is the artifact well-formed?):
- Is the constellation analysis accurate (culture balance, entity kinds)?
- Are `narrativeVoice` dimensions actionable and specific — sentence-level guidance ("sentences that compress under weight") rather than thematic ("this is a story about loss")?
- Are `entityDirectives` distinct from each other, or could they be swapped without changing anything?
- Do `facets` add chronicle-specific context that the base canon facts don't have?
- Does `temporalNarrative` synthesize dynamics into story-specific stakes, not a generic era summary?
- Is the `brief` specific enough to constrain? (A brief that could apply to any chronicle with this cast is too generic)
- Do cultural identities reach PS input with full trait keys (not 0)?

**Story Bible delivery** (does it shape the prose?):

Each PS field reaches the prompt under a specific heading. Evaluate whether the prompt section does its job:

| PS Field | Prompt Section | What to Check |
|---|---|---|
| `narrativeVoice` | Story Bible: Tone & Atmosphere | Does the prose *enact* the named dimensions, or just describe the world they point at? |
| `entityDirectives` | Story Bible: Character Notes | Does each entity feel different — different sensory register, behavior, relationship to space/time? |
| `facets` | Canon Facts → `[FACET:]` annotations | Are facets integrated organically, or do they appear as exposition? |
| `brief` | Writing Style → "PERSPECTIVE FOR THIS CHRONICLE" | Can you identify the brief's thesis in the output's structure? |
| `temporalNarrative` | Historical Context → "Current Conditions" | Are conditions shown through what characters can/can't do, not explained? |
| `suggestedMotifs` | Writing Style → "SUGGESTED MOTIFS" | Do motifs appear, evolve across appearances, and survive the copy-edit? |

**Questions to answer:**
- [ ] Is the PS output internally coherent — do dimensions, directives, and facets work together?
- [ ] Do Tone & Atmosphere dimensions shape prose rhythm, sensory register, or sentence structure?
- [ ] Do Character Notes produce distinct entity portrayals?
- [ ] Do faceted facts focus world truths through this chronicle's lens?
- [ ] Does the Perspective Brief provide an organizing thesis visible in the output?
- [ ] Does temporalNarrative create felt constraints, not exposited conditions?
- [ ] Do suggestedMotifs appear, evolve, and survive the copy-edit?

### 4a. Cultural Identity Integration

**What to check:**
Cultural identities (VALUES, SPEECH, GOVERNANCE, OUTSIDER_VIEW, SELF_VIEW, FEARS, TABOOS, PROSE_STYLE per culture) flow through PS into narrativeVoice and entityDirectives. The key question isn't "are they present?" but "are they operationalized for the genre?"

**How cultural identities manifest by genre:**

| Genre | Cultural Operationalization | Example |
|-------|---------------------------|---------|
| Political Intrigue | Cultural perception gaps become political mechanics | aurora-stack SPEECH vs nightshelf SPEECH creates Rashomon-lens; characters see the same event through incompatible frameworks |
| Mystery/Suspense | Cultural traits become investigation mechanics | aurora-stack formality enables precise dishonesty (EVASION AS DIALECT); TABOOS create zones of silence where evidence hides |
| Slice of Life | Culture IS the story when no plot carries it | orca PREDATOR_STILLNESS and PACK_TEXTURE shape scene rhythm; cultural VALUES determine what "ordinary" looks like |
| Romance | Cross-cultural friction creates romantic tension | Different SPEECH patterns and VALUES create misunderstanding as intimacy barrier |
| Action Adventure | Cultural impact depends on entity-kind composition | Rule entities give PS cultural hooks (e.g., Pactum∴silenti as "gag in the mouth"); without rules, action defaults to physical |
| Lost Legacy | Cultural attitudes toward the past shape discovery | How cultures remember (or refuse to remember) determines what can be found |

**What to look for in narrativeVoice dimensions:**
- Dimensions should reference specific cultural traits, not generic narrative advice
- Cross-cultural chronicles: look for dimensions organized around perception gaps between cultures
- Single-culture chronicles: look for dimensions that operationalize one culture's traits as genre mechanics
- The strongest PS output transforms cultural traits into story mechanisms (e.g., aurora-stack formality → mystery camouflage, nightshelf silence → action-adventure tension)

**What to look for in entityDirectives:**
- Directives should reflect the entity's culture, not just their personal history
- An aurora-stack character's directive should feel different from a nightshelf character's — different sensory registers, different relationship to speech and silence
- Rule entities (laws, pacts, customs) should carry their culture's values as structural constraints on other characters

**Cultural balance considerations:**
- `single` (1 culture): PS works with cultural depth — can a single culture's traits carry the genre's needs?
- `dominant` (one culture with minority): PS should contrast dominant and minority perspectives
- `mixed` (roughly equal): PS should organize around cross-cultural friction and translation failure

**Questions to answer:**
- [ ] Do narrativeVoice dimensions reference specific cultural traits (VALUES, SPEECH, FEARS, etc.)?
- [ ] Are cultural traits operationalized for the genre, or just described?
- [ ] In cross-cultural stories, do distinct cultural voices emerge in the prose?
- [ ] In single-culture stories, does cultural depth substitute for cultural contrast?
- [ ] Do entity directives incorporate culture-specific prose traits?
- [ ] If rule entities are present, do they carry cultural values as structural constraints?

### 5. Lens Integration

**What to check:**
- Does the lens entity appear as context/constraint rather than character?
- Is the lens felt in "what is possible and impossible, in what goes unsaid"?
- Is it referenced naturally without exposition?

**Where lens is configured:**
```typescript
// promptBuilder.ts → buildNarrativeLensSection()
// Lens Guidance: "This entity is NOT a character in the story..."
```

**Questions to answer:**
- [ ] Does the lens entity appear as ambient presence?
- [ ] Is it explained (bad) or assumed (good)?
- [ ] Do characters react to its effects without naming it?

### 6. Historian Notes Quality

**What to check:**
- Does the historian have consistent personality?
- Are note types varied (skepticism, pedantic, commentary, correction, tangent)?
- Do notes add genuine world depth?
- Are corrections plausible and specific?

**Note types defined in:**
```typescript
// historianTypes.ts
type HistorianNoteType = 'skepticism' | 'pedantic' | 'commentary' | 'correction' | 'tangent';
```

**Questions to answer:**
- [ ] Does the historian sound like a real scholar?
- [ ] Do notes reveal personality through word choice?
- [ ] Are tangents interesting rather than indulgent?
- [ ] Do corrections add lore rather than just contradict?
- [ ] Is there appropriate skepticism about sources?

### 7. Style Adherence

**What to check:**
- Does the output follow the style's structure requirements?
- Are prose instructions followed?
- Word count is a guide for the LLM, not a hard limit. Overage is fine as long as the words are well used — don't penalize length if the extra content earns its place.

**Where styles are defined:**
- Story styles: `narrativeStyles.ts` → `NARRATIVE_STYLES`
- Document styles: `documentStyles.ts` → `DOCUMENT_STYLES`

**Style structure to check:**
```typescript
// For document styles like folk-song:
{
  pacing: { wordCount: { min: 250, max: 400 } },
  documentInstructions: "...", // Structure, voice, tone
  eventInstructions: "...",    // How to use events
  roles: [...]                 // Document roles to fill
}
```

**Questions to answer:**
- [ ] Does structure match style requirements?
- [ ] Are required sections present?
- [ ] Does voice match tone keywords?

---

## Story vs World-Building Document Axis

A critical evaluation dimension: does the output read as a **lived story** or an **elegant world-building document**?

### Story/Chronicle Markers
| Marker | What It Looks Like |
|--------|-------------------|
| **Active opening** | "The ice spoke before the orcas did" — immediate, subject acting |
| **Recurring physical motif** | Hollows's shaking left flipper (4+ mentions, varies in context) |
| **Bitter camaraderie** | "Still owe you that fire-tea, Profundix. You'll have to drink my cup for me." |
| **Dark humor** | "The dead weren't using it" / "Democracy is just choosing how you die together" |
| **Deaths mid-action** | "died in half a sentence, her words cut off as Vel'keth's jaws closed" |
| **Devastating ending** | "Counting." — single word, unexpected, lands hard |

### World-Building Document Markers
| Marker | What It Looks Like |
|--------|-------------------|
| **Passive opening** | "The ice at The Fissured Smelt~ tasted wrong" — diffuse, atmospheric |
| **Conceptual traits** | "eyes held too many timelines" — metaphorical, not physical |
| **Authorial commentary** | "A culture built on secrets learning the taste of public record; of course they tried." |
| **Deaths in retrospect** | "They were cut short. That was how the chronicles recorded it." — meta, not visceral |
| **Explaining systems** | "Protocol says we carve the names... Vestigium∴moria. Memorial-rule." |
| **Thematic ending** | "The ice remembers everything." — summarizes rather than lands |

### Known Factors Affecting This Axis

**1. Thinking vs Non-Thinking Mode**
- Thinking mode (extended thinking) tends toward organized, analytical output
- Non-thinking mode tends toward more intuitive, flowing prose
- The analytical pass may "double-analyze" what perspective synthesis already did

**2. Context Volume**
- Rich context (full perspective synthesis, entity directives, facets) → model spends creative budget on integration
- Even with the same model (Sonnet), rich context produces world-building documents while simple context produces stories
- Example: "Ice Remembers" V1 (simple context, 2468 words) = pure chronicle; V5 (rich context, 2600 words) = document

**3. Word Count / Length**
- Longer word targets may allow drift into exposition
- Pattern observed: story energy in early sections, documentation in later sections
- The model may "run out of story" and fill remaining word budget with explanation
- Example: "Brazier" V3 has great story in Sections 1-2, drifts into memorial protocol explanation in Section 3

**4. Tone Guidance Being Ignored**
The prompt includes explicit instructions like:
```
BITTER CAMARADERIE:
Grimness alone is exhausting. Include dark humor between allies,
loyalty despite failure, small kindnesses in terrible contexts.
```
Yet V2-V5 of "Ice Remembers" completely ignore this. The model prioritizes integrating lore content over following style guidance when context is heavy.

### Gold Standard Reference
**"Ice Remembers What Wakes" V1** (Sonnet non-thinking, simpler context) demonstrates what we're aiming for:
- Hollows's shaking flipper as recurring embodied trauma
- "Still owe you that fire-tea" bitter camaraderie
- "Democracy is just choosing how you die together" dark humor
- Totatirus~ dies mid-sentence, brutal
- Ending: "Counting." — devastating single word

---

## Common Issues to Watch For

### Sameness Patterns
Watch for cross-chronicle sameness (use `docs/chronicle-corpus-review-guide.md` for batch review):
- Same closing phrases across chronicles
- Same emotional arc across different styles
- Identical structural shapes regardless of narrative style
- Repeated motifs appearing in every chronicle rather than being chronicle-specific

**Note**: Sameness is a problem *between* different chronicles, not between versions of the same chronicle. Some consistency across versions is expected and acceptable.

### World Dynamics and Current Conditions
World dynamics reach PS input (check `perspectiveSynthesis.input.worldDynamics`). PS synthesizes them into a `temporalNarrative` field — 2-4 sentences distilling era-specific conditions into story-specific stakes. This appears in the generation prompt as "## Current Conditions" under Historical Context (see Prompt Architecture above).

**What to check:**
- `worldDynamics` array present in PS input (should have 5-8 dynamics depending on constellation cultures/kinds)
- `temporalNarrative` present in PS output
- "## Current Conditions" subsection visible in the generation prompt's Historical Context
- Era overrides are correct (no anachronistic text — a Frozen Peace chronicle should not describe Orca Incursion-era conditions)
- The synthesized stakes feel specific to THIS story, not a generic era summary

**Impact when working well:** Characters are constrained by dynamics (supply shortages, political instability, territorial disputes) without expositing them. Current Conditions bridges world-level dynamics and character-level stakes.

### Pipeline Impact Assessment

After reviewing the chronicle, assess the PS/cultural identity pipeline's contribution. Use this scale:

| Level | Meaning | Signal |
|-------|---------|--------|
| **Transformative** | Story couldn't exist without PS output | narrativeVoice dimensions create genre-specific cultural mechanics; removing PS would produce a fundamentally different story |
| **Constitutive** | Cultural identity is woven into the story's texture | narrativeVoice shapes prose rhythm, sensory register, or scene structure; the story would lose its distinctive character without PS |
| **Structural** | PS organizes the story's architecture | Entity directives and facets determine plot structure and character relationships |
| **Operational** | PS provides useful guidance that improves quality | Better prose, more specific details, but the story's core would survive without PS |
| **Enriching** | PS adds texture but doesn't shape the story | Cultural details appear as decoration rather than structure |
| **Incremental** | Minimal visible PS impact | Generic output that could have been produced without cultural/narrative guidance |

**Factors that increase pipeline impact:**
- Political Intrigue, Mystery/Suspense: highest return (require cultural differentiation or cultural mechanics as genre foundation)
- Cross-cultural constellations with contrasting cultures in proximity
- Rule entities (laws, pacts, customs) that carry cultural values as constraints
- Slice of Life: culture IS the story when no plot carries it

**Factors that decrease pipeline impact:**
- Action Adventure with physical entities only (culture provides texture, not mechanics)
- Single-culture constellations without rule entities
- Genres that rely on plot mechanics over cultural mechanics

### Context Overload Pattern
When perspective synthesis produces rich output (detailed entity directives, many facets, long narrative voice guidance), V0 may prioritize lore integration over style guidance — the model spends its creative budget weaving in all the Story Bible and World Data rather than following Craft instructions. V1 receives the same PS content but with permissive framing ("follow their intent closely, but express them in your own voice"), which can give the LLM latitude to prioritize differently. However, V1 does NOT strip PS guidance — both versions receive identical Tone & Atmosphere dimensions, Character Notes, faceted facts, and motifs. The creative freedom lies in structural permission (reassign roles, deviate from beat sheet, invent characters), not in reduced context.

### Event Handling
Events in the export may have undefined headlines:
```json
"[creation_batch, 100%] undefined (subject: Entity)"
```
This forces generation to rely on entity descriptions alone. Check if events are actually being incorporated.

### Entity ID Mismatches
Image refs and historian notes may use different ID conventions than the chronicle. Check for consistency.

### Prompt Over-Length
Very large casts or many relationships can bloat the prompt. Check if important details got truncated.

---

## Export Structure Reference

```json
{
  "exportVersion": "1.3",
  "chronicle": {
    "id": "chronicle_...",
    "title": "...",
    "format": "story" | "document",
    "narrativeStyleId": "...",
    "lens": { "entityId": "...", "entityName": "..." }
  },
  "content": "...",                    // Final accepted content
  "generationLLMCall": {
    "systemPrompt": "...",
    "userPrompt": "...",
    "model": "..."
  },
  "versions": [
    {
      "versionId": "...",
      "sampling": "low" | "normal",
      "content": "...",
      "systemPrompt": "...",
      "userPrompt": "..."
    }
  ],
  "generationContext": {
    "narrativeVoice": { /* PS-synthesized voice dimensions */ },
    "entityDirectives": [ /* per-entity writing instructions */ ],
    "temporalNarrative": "PS-synthesized current conditions",
    "canonFacts": [ /* faceted facts with chronicle-specific interpretations */ ],
    "nameBank": { /* culture-appropriate names for invented characters */ }
  },
  "perspectiveSynthesis": {
    "input": {
      "constellation": { /* culture/kind distribution, cultureBalance */ },
      "culturalIdentities": { /* per-culture: VALUES, SPEECH, FEARS, TABOOS, PROSE_STYLE, etc. */ },
      "worldDynamics": [ /* era-specific political/resource conditions */ ],
      "entities": [ /* summaries for synthesis */ ]
    },
    "output": {
      "brief": "Chronicle framing",
      "facets": [ /* per-fact chronicle interpretations */ ],
      "narrativeVoice": { /* 4-5 named dimensions */ },
      "entityDirectives": [ /* per-entity instructions */ ],
      "temporalNarrative": "Dynamics distilled into story stakes",
      "suggestedMotifs": [ /* 2-4 echo phrases */ ]
    }
  },
  "comparisonReport": "...",           // Markdown comparison
  "combineInstructions": "...",        // How to merge versions
  "historianNotes": [
    {
      "anchorPhrase": "...",
      "text": "...",
      "type": "skepticism" | "pedantic" | "commentary" | "correction" | "tangent"
    }
  ],
  "summary": "...",                     // One-sentence summary
  "imageRefs": [...],                  // Image anchor points
  "coverImage": {...}                  // Cover image scene
}
```

---

## Reviewer Workflow

1. **Read the content first** without looking at prompts—does it work as a standalone piece?

2. **Check lore fit**—open `illuminatorConfig.json` and verify cultural values, canon facts

3. **Compare versions**—read both, form your own opinion before reading comparisonReport

4. **Evaluate perspective synthesis**—is PS output well-formed, and does it shape the prose through the Story Bible sections?

5. **Read historian notes**—do they add depth or just noise?

6. **Check mechanics**—word count, structure, style adherence

7. **Note issues**—entity ID mismatches, undefined events, prompt problems

8. **Produce summary table**—every review must end with the standardized dimension scorecard (see below)

---

## Review Summary Table

Every chronicle review MUST conclude with a summary table scoring each dimension on a 5-star scale with a one-sentence comment. This provides at-a-glance quality assessment and enables cross-chronicle comparison over time.

### Rating Scale

| Stars | Meaning |
|-------|---------|
| ★★★★★ | Exceptional — reference-quality execution; no meaningful issues |
| ★★★★☆ | Strong — minor issues that don't undermine the whole |
| ★★★☆☆ | Solid — notable gaps or inconsistencies worth addressing |
| ★★☆☆☆ | Weak — significant problems that affect the chronicle's quality |
| ★☆☆☆☆ | Failed — fundamental issues; dimension not achieved |
| N/A | Dimension does not apply to this format (e.g., historian notes for documents) |

### Core Dimensions

These are the actual quality bar. A chronicle that scores well here succeeds regardless of pipeline details.

| Dimension | What It Measures |
|-----------|-----------------|
| **Standalone Quality** | Is this good fiction? Does it have momentum, texture, emotional weight? Would a reader want to finish it? |
| **Machine-Generation Tells** | Does it read like AI output? Hedging, balance words, samey rhythms, safe choices, conceptual language where physical language should be? |
| **Lore Integration** | Are world facts, cultural values, and entity details exercised as lived experience, not exposition? |
| **Corpus Distinctiveness** | Does this chronicle feel like its own thing, or does it repeat tropes, structures, and phrases from other chronicles? |

### Diagnostic Dimensions

These track common failure modes. When a core dimension fails, these help identify where in the pipeline the problem originated.

| Dimension | What It Measures |
|-----------|-----------------|
| **Perspective Synthesis** | Is PS output well-formed? Do its fields shape the prose when delivered as Story Bible sections? |
| **Cultural Identity** | Are cultural traits operationalized as genre mechanics, not just described? |
| **Lens Integration** | Does the lens entity function as ambient context — felt, not explained? |
| **Style Adherence** | Does output follow the style's structure, voice, and required sections? |
| **Story vs Document** | Where does the output sit on the axis, and is that position appropriate for the format? |
| **Comparison Report** | Does the auto-generated comparison identify real differences, and are combine instructions executable? |
| **Copy-Edit** | Did the copy-edit improve the piece? Cuts defensible, motifs preserved, voice textures respected? |
| **Version Comparison** | One-sentence characterization of each version's strengths/weaknesses relative to the others |
| **Historian Notes** | Do notes add depth with consistent scholarly personality? (N/A for document formats) |
| **Pipeline Impact** | Use the existing 6-level scale (Transformative → Incremental) with a comment on what the pipeline contributed |

Comments should be specific — not "good" or "bad" but what worked or what broke. Reference specific lines, phrases, or structural choices where possible.

---

## Multi-Version Comparison

When comparing multiple versions of the same chronicle, evaluate:

### Primary Axis: Story vs Document
Rank versions from "most story" to "most world-building document" using the markers above.

### Secondary Considerations

**World-building quality** (for when you need institutional depth):
- Does it explain how systems work in interesting ways?
- Are there genuine creative inventions (new factions, artifacts, cultural practices)?
- Does it show systems thinking (how trade spreads corruption, how the Spiral changed conflict dynamics)?

**Structural boldness**:
- Does any version take a risk (e.g., orca POV in "Brazier" V3)?
- Bold structure can add emotional weight even if it drifts into documentation

**What to preserve in combines**:
- From story-leaning versions: recurring motifs, camaraderie moments, devastating endings
- From document-leaning versions: institutional frameworks, named lineages, systems insights

### Version Selection Heuristic
- If you need a war chronicle: pick the version highest on the story axis
- If you need world-building depth: the hybrid or document version may have better invented details
- Combines can theoretically merge both, but often lose the soul of the story version

---

## Example Review Questions

For a folk song chronicle:
- Is the refrain singable and memorable?
- Does the collector's note feel like field documentation?
- Do verses accumulate imagery rather than narrate plot?
- Does the final refrain variation land?
- Does it sound like it's been passed through many voices?

For a story chronicle:
- Does the structure match the style's scene count?
- Are entity roles correctly assigned?
- Do events appear as dramatized moments?
- Is the emotional arc appropriate to the style?

For any chronicle:
- Would someone unfamiliar with the prompt understand the output?
- Does the perspective lens show without being explained?
- Do the historian notes reveal a consistent scholarly personality?
- Are cultural traits operationalized for the genre, or just described?
- Does temporalNarrative create felt constraints, not explained conditions?
- What is the pipeline impact level (transformative → incremental)?

## Copy-Edit Review

### What the Copy-Edit Receives

The copy-edit step receives **minimal context** — the text plus:
- **Format**: story or document (selects format-specific system prompt)
- **Style name**: e.g., "Confession", "Rashomon"
- **Craft posture**: density and restraint constraints from the narrative style
- **Word count context**: current word count and natural range, framed as context not target
- **Voice textures**: Tone & Atmosphere dimensions from the Story Bible (e.g., JUSTIFICATION_ARCHITECTURE, THREE_REGISTERS)
- **Recurring motifs**: Suggested motifs from the Story Bible marked "do not cut or collapse"

No world facts, entity data, or generation prompts. The editor works on the prose as written, not the prose as intended.

### What to Check

**Cuts should be genuine dead weight:**
- Filter words creating false distance ("she noticed," "he felt")
- Redundant modifiers, stage directions that reveal nothing about character
- Duplicate-purpose material: two sections doing the same narrative work (not same-event-different-perspective, which is format-intentional)

**Texture must survive:**
- Voice-establishing passages where a narrator reveals themselves through what they notice, how they frame what they see
- Characterizing observation that isn't plot, isn't dialogue register, but is doing real narrative work
- Structural rhetoric (tricolons, callbacks, deliberate repetition)

**Motifs must be preserved:**
- All motif phrases should survive in the copy-edit output
- Count instances before and after — motif frequency should not decrease

**Voice textures must be respected:**
- Tone & Atmosphere dimensions describe intentional prose choices
- The copy-edit should not cut material that a voice texture explicitly describes as intentional
- Watch for conflicts between craft posture and voice textures — craft posture says "cut X" but a voice texture says "X is intentional." The voice texture should win.

**Lore names must not be "corrected":**
- World names that look like typos (e.g., "Scared~ Shroud") will sometimes be "fixed" by the LLM despite the system prompt saying "leave world details exactly as they are"
- Check all unusual proper nouns in V3 against V2

### Established Principles

1. **Single responsibility:** Combine = ambitious assembly (grab everything good). Copy-edit = pare down. Don't put structural work back onto combine.
2. **Narrative purpose > same beat:** Deduplication should target narrative purpose, not event identity. Two scenes covering the same event from different perspectives serve different purposes and must both stay.
3. **Texture is not fat.** Characterizing observation, voice-establishing passages, and structural rhetoric are doing narrative work even when they don't advance plot.
4. **Word count is not a copy-edit metric.** The copy-edit's job is to make the piece better — not shorter, not longer. The neutral framing ("use this as context for what length feels natural") prevents reduction-hunting.
5. **User prompt must reinforce, not contradict, system prompt.** The system prompt's merge permission and the user prompt's preservation guidance must align.

### Model Note

Opus is significantly better at copy-edit than Sonnet. Opus makes real editorial decisions; Sonnet tends toward surface-level word swaps. The voice texture and motif preservation guidance matters more with Opus because Opus actually follows the directives.

---

## Document Format Review Notes

### Style Parity Fix (2026-02-07)

Document prompts now receive the same `# Writing Style` section as stories, containing:
- **coreTone**: World voice and style principles (specificity, subtext, avoid list, etc.)
- **PS brief**: Thematic perspective for this chronicle ("PERSPECTIVE FOR THIS CHRONICLE: ...")
- **Suggested motifs**: Echoing phrases

Previously, documents received PS narrativeVoice, entityDirectives, temporalNarrative, and faceted facts — but never the PS brief or world tone. This meant documents had voice guidance and entity guidance but no thematic center.

The document system prompt instructs the LLM to "apply [Writing Style] principles through the lens of your document type, not as narrative prose instructions." This is the key adaptation — a wiki entry shouldn't use syntactic poetry, but it should use specificity over abstraction.

### What to Watch in Document Reviews

**Positive signals (style parity working):**
- PS brief's thematic framing shapes the document's focus and organization
- World tone's avoid list applies (no balance words, no polite diction)
- Specificity: concrete details, not generic descriptions
- Motifs appear as thematic through-lines, adapted to document voice

**Negative signals (story bias leaking):**
- Document reads like a story wearing a document skin — narrative prose techniques applied literally
- "Bitter camaraderie" or "syntactic poetry" appearing in formats where they don't belong (reports, archives, assessments)
- Scene-like structure in a document that should be analytical or archival
- The document author's voice disappearing into the world narrator's voice

**Key comparison:** Generate the same chronicle as both story and document format. The PS brief should shape both, but the execution should feel fundamentally different — a story dramatizes, a document analyzes/records/testifies.
