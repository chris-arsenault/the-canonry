# Chronicle Review Guide

This document provides a structured approach for reviewing chronicle generation outputs. It identifies what to examine, where to find relevant source code and lore, and what questions to ask.

## Quick Reference: Key Files

### Generation Pipeline
| Component | Location |
|-----------|----------|
| Chronicle Types | `apps/illuminator/webui/src/lib/chronicleTypes.ts` |
| Prompt Builder | `apps/illuminator/webui/src/lib/chronicle/v2/promptBuilder.ts` |
| Worker Tasks | `apps/illuminator/webui/src/workers/tasks/chronicleTask.ts` |
| LLM Client | `apps/illuminator/webui/src/lib/llmClient.browser.ts` |
| Perspective Synthesizer | `apps/illuminator/webui/src/lib/perspectiveSynthesizer.ts` |

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
| Sameness Analysis | `docs/chronicle-sameness-analysis.md` |
| Perspective Synthesis Design | `docs/perspective-synthesis-design.md` |
| Wizard UX Redesign | `apps/illuminator/docs/chronicle-wizard-ux-redesign.md` |

---

## Review Checklist

### 1. Sampling Comparison (low vs normal top_p)

**What to check:**
- How does `top_p=0.95` (low) differ from `top_p=1.0` (normal)?
- Does low sampling produce more "safe" or formulaic output?
- Does normal sampling introduce creative risks that pay off?

**Where to find sampling config:**
```typescript
// chronicleTypes.ts
export type ChronicleSampling = 'normal' | 'low';
export const CHRONICLE_SAMPLING_TOP_P: Record<ChronicleSampling, number> = {
  normal: 1,
  low: 0.95,
};
```

**Questions to answer:**
- [ ] Which version has more natural rhythm/flow?
- [ ] Which takes more creative risks?
- [ ] Which follows the style instructions more literally?
- [ ] Do the versions have meaningfully different character?

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

### 4. Perspective Synthesis Validity

**What to check:**
- Is the constellation analysis accurate (culture balance, entity kinds)?
- Are narrative voice directives actionable and specific?
- Are entity directives distinct from each other?
- Do faceted facts add chronicle-specific context?

**Where perspective synthesis happens:**
```typescript
// perspectiveSynthesizer.ts → synthesizePerspective()
// Input: constellation, style, entities, cultural identities
// Output: brief, facets, narrativeVoice, entityDirectives
```

**Export fields to examine:**
```json
{
  "perspectiveSynthesis": {
    "input": {
      "constellation": { /* culture/kind distribution */ },
      "culturalIdentities": { /* per-culture prose styles */ },
      "entities": [ /* summaries for synthesis */ ]
    },
    "output": {
      "brief": "Chronicle framing in 100-200 words",
      "facets": [ /* per-fact chronicle interpretations */ ],
      "narrativeVoice": { /* synthesized prose guidance */ },
      "entityDirectives": [ /* per-entity writing instructions */ ]
    }
  }
}
```

**Questions to answer:**
- [ ] Does the brief capture the chronicle's essence?
- [ ] Do facets add useful specificity to canon facts?
- [ ] Can you see narrative voice directives reflected in the output?
- [ ] Are entity directives distinguishable from each other?

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
- Is word count within target range?

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
- [ ] Is word count within range?
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
See `docs/chronicle-sameness-analysis.md` for documented patterns:
- Same closing phrases ("the ice remembers")
- Same emotional arc across different styles
- Artifacts always having "cracks" or "agency"
- Identical 4-5 scene structures

**Note**: Sameness is a problem *between* different chronicles, not between versions of the same chronicle. Some consistency across versions is expected and acceptable.

### World Dynamics Not Passed (Known Bug)
World dynamics defined in `illuminatorConfig.json` are NOT being injected into chronicle generation. The `perspectiveSynthesis.input` contains `facts` but no `worldDynamics` field.

Impact: Chronicles don't reflect era-specific political/resource states (e.g., Aurora Stack fragmentation, fire-core scarcity, who controls which territories).

### Context Overload Pattern
When perspective synthesis produces rich output (detailed entity directives, many facets, long narrative voice guidance), the generation pass may:
- Treat style guidance as lower priority than lore integration
- Produce "box-checking" prose that includes all required elements without soul
- Drift into world-building explanation mode, especially in later sections

**Proposed mitigation (not yet implemented)**: "Seeds not outlines" — Phase 2 produces 4-6 evocative fragments rather than detailed directives. The creative pass receives anchors to weave in, not requirements to satisfy.

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
  "perspectiveSynthesis": {
    "input": { /* constellation, identities, entities */ },
    "output": { /* brief, facets, narrativeVoice, entityDirectives */ }
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

4. **Evaluate perspective synthesis**—does the brief accurately frame the chronicle?

5. **Read historian notes**—do they add depth or just noise?

6. **Check mechanics**—word count, structure, style adherence

7. **Note issues**—entity ID mismatches, undefined events, prompt problems

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
