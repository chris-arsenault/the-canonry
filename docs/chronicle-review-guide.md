# Chronicle Review Guide

This document provides a structured approach for reviewing chronicle generation outputs. It identifies what to examine, where to find relevant source code and lore, and what questions to ask.

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
| Structured generation | V0 | Full PS-synthesized prompt: beat sheet, voice textures, entity directives, craft posture |
| Creative freedom | V1 | Stripped-down prompt: world data only, no prescribed structure/voice/style. Skips PS. |
| Combine | V2 | Editor merges best elements of V0 and V1 based on editorial direction |
| Copy-edit | V3 | Final polish pass with voice texture and motif preservation context |

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

## Review Checklist

### 1. Version Comparison (V0 Structured vs V1 Creative Freedom)

**What to check:**
- Does V0 (structured, full PS guidance) produce reliable format adherence?
- Does V1 (creative freedom, stripped-down prompt) find angles the structured version missed?
- Which version has stronger prose, more creative risk, better use of the material?
- Does the combine (V2) successfully take the best of both?

**Questions to answer:**
- [ ] What does V0 do well that V1 misses (format adherence, voice texture realization)?
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

### 4. Perspective Synthesis Validity

**What to check:**
- Is the constellation analysis accurate (culture balance, entity kinds)?
- Are narrative voice directives actionable and specific?
- Are entity directives distinct from each other?
- Do faceted facts add chronicle-specific context?
- Does temporalNarrative synthesize dynamics into story-specific stakes?
- Do cultural identities reach PS input with full trait keys (not 0)?

**Where perspective synthesis happens:**
```typescript
// perspectiveSynthesizer.ts → synthesizePerspective()
// Input: constellation, style, entities, cultural identities, world dynamics
// Output: brief, facets, narrativeVoice, entityDirectives, temporalNarrative, suggestedMotifs
```

**Export fields to examine:**
```json
{
  "perspectiveSynthesis": {
    "input": {
      "constellation": { /* culture/kind distribution */ },
      "culturalIdentities": { /* per-culture traits: VALUES, SPEECH, FEARS, TABOOS, PROSE_STYLE, etc. */ },
      "worldDynamics": [ /* era-specific political/resource conditions */ ],
      "entities": [ /* summaries for synthesis */ ]
    },
    "output": {
      "brief": "Chronicle framing in 100-200 words",
      "facets": [ /* per-fact chronicle interpretations */ ],
      "narrativeVoice": { /* synthesized prose guidance — 4-5 named dimensions */ },
      "entityDirectives": [ /* per-entity writing instructions */ ],
      "temporalNarrative": "2-4 sentences: dynamics distilled into story-specific stakes",
      "suggestedMotifs": [ /* 2-4 phrases that might echo through the chronicle */ ]
    }
  }
}
```

**Questions to answer:**
- [ ] Does the brief capture the chronicle's essence?
- [ ] Do facets add useful specificity to canon facts?
- [ ] Can you see narrative voice directives reflected in the output?
- [ ] Are entity directives distinguishable from each other?
- [ ] Does temporalNarrative feel specific to THIS story (not a generic era summary)?
- [ ] Do suggestedMotifs appear in the generated content?

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

### World Dynamics and Temporal Narrative
World dynamics now reach PS input (check `perspectiveSynthesis.input.worldDynamics`). PS synthesizes them into a `temporalNarrative` field — 2-4 sentences distilling era-specific conditions into story-specific stakes. This appears in the generation prompt as "## Current Conditions" under Historical Context.

**What to check:**
- `worldDynamics` array present in PS input (should have 5-8 dynamics depending on constellation cultures/kinds)
- `temporalNarrative` present in PS output and `generationContext`
- "## Current Conditions" subsection visible in the generation prompt's Historical Context
- Era overrides are correct (no anachronistic text — a Frozen Peace chronicle should not describe Orca Incursion-era conditions)
- The synthesized stakes feel specific to THIS story, not a generic era summary

**Impact when working well:** Characters are constrained by dynamics (supply shortages, political instability, territorial disputes) without expositing them. The temporalNarrative bridges world-level dynamics and character-level stakes.

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
When perspective synthesis produces rich output (detailed entity directives, many facets, long narrative voice guidance), the structured generation (V0) may prioritize lore integration over style guidance. The creative freedom generation (V1) mitigates this by stripping PS guidance entirely, giving the LLM latitude to find its own angle. The combine step (V2) then merges V1's creative risks with V0's structural reliability.

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

4. **Evaluate perspective synthesis**—does the brief accurately frame the chronicle?

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

### Required Dimensions

| Dimension | What It Measures |
|-----------|-----------------|
| **Standalone Quality** | Does the content work as a piece of writing without reference to prompts or pipeline? |
| **Lore Fit** | Are world facts, cultural values, canon constraints, and entity details honored? |
| **Comparison Report** | Does the auto-generated comparison identify real differences, and are combine instructions executable? |
| **Perspective Synthesis** | Are PS brief, narrative voice dimensions, entity directives, facets, and temporal narrative visible in the output? |
| **Cultural Identity** | Are cultural traits (VALUES, SPEECH, FEARS, TABOOS, PROSE_STYLE) operationalized as genre mechanics, not just described? |
| **Lens Integration** | Does the lens entity function as ambient context — felt, not explained? |
| **Historian Notes** | Do notes add depth with consistent scholarly personality? (N/A for document formats) |
| **Style Adherence** | Does output follow the style's structure, voice, word count guidance, and required sections? |
| **Story vs Document** | Where does the output sit on the axis, and is that position appropriate for the format? |
| **Pipeline Impact** | Use the existing 6-level scale (Transformative → Incremental) with a comment on what the pipeline contributed |
| **Copy-Edit** | Did the copy-edit improve the piece? Cuts defensible, motifs preserved, voice textures respected, no lore errors? |
| **Version Comparison** | One-sentence characterization of each version's strengths/weaknesses relative to the others |
| **Recommended Version** | Which version to use (or "Combined" if the combine succeeded), with brief justification |

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
- **Voice textures**: PS-synthesized `narrativeVoice` dimensions (e.g., JUSTIFICATION_ARCHITECTURE, THREE_REGISTERS)
- **Recurring motifs**: PS `suggestedMotifs` marked "do not cut or collapse"

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
- PS narrativeVoice dimensions describe intentional prose choices
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
