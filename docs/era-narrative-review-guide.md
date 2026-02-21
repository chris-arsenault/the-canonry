# Era Narrative Review Guide

## What the Era Narrative Is

The chronicle volume is organized by era. Each era contains individual chronicles — stories, documents, songs, records — in chronological order. The era narrative is a **single opening narrative** (~5,000-7,000 words) that precedes all of an era's chronicles.

It functions the way a Silmarillion chapter functions relative to the longer tales. The overview gives you the arc. The individual tales give you the experience. You read the shape first. Then each tale lands with context, with weight, with the knowledge of where it fits.

```
ERA: THE GREAT THAW

  ── Era Narrative ─────────────────────────────
  │  Single continuous narrative
  │  ~5,000-7,000 words
  │  Gives the shape of the entire era
  └─────────────────────────────────────────────

    ◆ The Book of the Berg (sacred-text)
    ◆ The Shaping of the Berg (creation-myth)
    ◆ When the Brazier Woke Again (story)
    ◆ ... all chronicles in chronological order ...
```

### What It Does

1. **Gives the reader the shape of the era.** The arc, the forces, the major movements, how it ended.
2. **Makes the chronicles mean more.** When you turn the page and hit the first individual chronicle, you already know what it's part of.
3. **Reveals what no individual chronicle can show.** The connections, the patterns, the causation visible only at era scale.
4. **Tells it with the authority of knowing how it ends.** The only voice in the volume that speaks from after the ending.

### What It Is NOT

- Not a summary of the chronicles. The tales follow — all of them.
- Not the historian's commentary. That lives in the marginal notes alongside the chronicles.
- Not an entity reference. That lives in the Atlas volume.
- Not a table of contents. It is narrative — it moves through time at the scale of the era.

---

## What Actually Matters

Three questions determine whether an era narrative succeeds:

1. **Does it operate at the right altitude?** Cultures and forces are the grammatical subjects. Characters appear briefly as evidence of cultural forces in motion, not as agents with their own arcs. The world is the protagonist.
2. **Does it achieve the mythic-historical register?** Declarative, paratactic, concrete, restrained. Events told with the authority of compiled tradition, not with the intimacy of lived experience.
3. **Does it give the era a shape the reader carries into the chronicles?** After reading, does the reader know what this era was about — what transformed, who rose and fell, what the world became?

Everything else in this guide is diagnostic — tools for identifying why something failed, not what success looks like.

---

## Pipeline

```
threads → generate → edit → title
```

Each step pauses for review before advancing.

| Step | What It Does | Key Files |
|------|-------------|-----------|
| **Threads** | LLM reads prep briefs and world context, produces structural plan: threads (cultural arcs), movement plan, thesis, motifs, opening/closing images | `eraNarrativeTask.ts` L96-246 |
| **Generate** | Single LLM call produces the complete era narrative from the thread synthesis + source material | `eraNarrativeTask.ts` L252-435 |
| **Edit** | Register-aware editing: protect parataxis, restraint, temporal accordion; cut modern register breaks | `eraNarrativeTask.ts` L441-470 |
| **Title** | Fragment extraction → title shaping → candidate selection | `eraNarrativeTask.ts` L476+ |

### Key Files

| Component | Location |
|-----------|----------|
| Types | `apps/illuminator/webui/src/lib/eraNarrativeTypes.ts` |
| Task (prompts + execution) | `apps/illuminator/webui/src/workers/tasks/eraNarrativeTask.ts` |
| Hook (state machine) | `apps/illuminator/webui/src/hooks/useEraNarrative.ts` |
| Modal (UI) | `apps/illuminator/webui/src/components/EraNarrativeModal.jsx` |
| Repository | `apps/illuminator/webui/src/lib/db/eraNarrativeRepository.ts` |
| Style weights | `packages/world-schema/src/narrativeStyles.ts` (story), `packages/world-schema/src/documentStyles.ts` (document) |

---

## Source Material Tiering

Each chronicle's prep brief carries a **weight** derived from its narrative style's `eraNarrativeWeight` field. This determines how the brief is presented to the LLM in both the thread synthesis and generation prompts.

| Tier | Meaning | Prompt Framing | Examples |
|------|---------|---------------|----------|
| **Structural** | Stories that dramatize actual events. The meat of the era. | "define this era's arc" — presented first | epic-drama, political-intrigue, tragedy, heroic-fantasy, last-stand, romance, action-adventure |
| **Contextual** | Institutional documents that frame events, or non-canonical mythic content | "institutional and political framing" | chronicle-entry, field-report, diplomatic-accord, interrogation-record, creation-myth, origin-myth, sacred-text |
| **Flavor** | World texture — doesn't narrate events | "world texture, use for color not arc" | broadsheet, proverbs, tavern-notices, haiku, folk-song, nursery-rhymes, wanted-notice, slice-of-life, dreamscape |

### Review Implications

- Check that structural sources actually drive the thread arcs. If the LLM builds threads from flavor sources while ignoring structural ones, the tiering isn't working.
- Contextual and flavor sources should appear as texture in the narrative — a custom mentioned, a saying echoed, a treaty referenced — not as arc-defining material.
- If all sources are unclassified (no weight), the tiering system isn't being fed. Check that the chronicle's `narrativeStyle.eraNarrativeWeight` is populated and that the modal passes it to the prep brief.

---

## World-Level Context

The generation step receives world context that chronicles don't have access to:

| Context | Source | Purpose |
|---------|--------|---------|
| **Era summaries** | Focal era + adjacent eras from the simulation | World-state anchors — what came before, what this era is, what follows |
| **World dynamics** | Resolved dynamics for this era (with era overrides) | Active forces: inter-cultural tensions, resource pressures, political structures |
| **Cultural identities** | Descriptive traits per culture (VALUES, GOVERNANCE, SPEECH, FEARS, etc.) | Who the peoples are — needed for threads to name cultural actors correctly |

### Known Issue: Cultural Identity Serialization

Cultural identities have a 3-level nested structure: `{ descriptive: { culture-name: { TRAIT: "value" } } }`. A `formatCulturalIdentities()` helper extracts the `descriptive` sub-object and flattens it. If the narrative contains `[object Object]` or cultures have no trait content, this serialization has broken.

---

## The Prompts

### Thread Synthesis System Prompt

The historian plans the structure in character. Key constraints:

- **Thread naming:** Each thread must identify its cultural actor — the culture, faction, or force whose transformation it traces. Threads named after themes, concepts, or individual characters are at the wrong altitude.
- **culturalActors field:** Required. Names the world-level actors (cultures, factions) in the thread.
- **worldState per movement:** Required. 1-2 sentences describing how things stand for the cultures at that point.
- **Beats as cultural events:** "What happens to cultures — not what happens to characters."

### Thread Synthesis User Prompt

Source material is grouped by tier:
1. Era context (previous, focal, following era summaries)
2. World dynamics
3. Cultural identities
4. Structural sources (presented first, labeled "define this era's arc")
5. Contextual sources
6. Flavor sources
7. Task line reinforcing tiered usage

### Generation System Prompt

The main prompt. Sections in order:

1. **Framing** — what the era narrative is and where it sits in the volume
2. **Altitude** — cultures as grammatical subjects, proportion rules, movement openings from the world outward
3. **Voice** — declarative, paratactic, concrete, restrained, not-only-solemn (with Tolkien register examples)
4. **Prose Craft** — accumulation, landscape as cultural state, the catalog, the turn, sound
5. **Craft Posture** — sustained elaboration, compression ratio, catalog specificity, narrator's silence
6. **Time** — temporal accordion
7. **Characters** — arrive as forces, no interiority, serve cultural arcs
8. **Motifs** — recurring images, never explained
9. **Structure** — invocation, movements with ---, closing
10. **What This Is For** — the relationship to the chronicles that follow
11. **The Historian** — identity, personality, biases, stance, private knowledge (shows through editorial choices, not first person)
12. **Output** — continuous prose, 5,000-7,000 words

### Generation User Prompt

1. Era identity and year range
2. World arc (era summaries)
3. World dynamics
4. Cultural identities
5. Cultural arcs (threads with actors)
6. Movement plan (with world states)
7. Thesis, motifs, opening/closing images
8. Source material (tiered by weight)
9. Task line with altitude reminder

### Edit Prompts

System prompt names specific register features to **protect** (parataxis, restraint, temporal accordion, concrete imagery, transmission markers) and specific failure modes to **cut** (modern register breaks, psychology, stated themes, redundancy, filler transitions).

---

## Review Checklist

### 1. Altitude

The most critical dimension. The era narrative must operate at world-level, not entity-level.

**What to check:**
- Are cultures and forces the grammatical subjects of most sentences?
- Do characters appear briefly (a clause, a sentence) as evidence of cultural forces, or do they accumulate into arcs?
- Do movements open from the world outward (cultural state → events), or from characters inward?
- When a death is described, does it serve the cultural arc or command attention for its own sake?

**Failure modes:**
- Entity-level threads: thread names like "The Scholar's Burden" instead of "The Nightshelf Withdrawal"
- Character recurrence: the same individual appearing in multiple movements, developing an arc
- Character-driven paragraphs: "Korvan crossed the ice and..." where the culture should be acting
- Event summaries: retelling chronicle plots at the character level instead of synthesizing the cultural meaning

**Questions to answer:**
- [ ] Are >80% of paragraph-opening sentences about cultures/forces, not individuals?
- [ ] Do characters appear at most once per movement, in a subordinate clause?
- [ ] Does each movement open from the world-state, not from a character's situation?
- [ ] Could you remove all character names and still understand the era's shape?

### 2. Register

**What to check:**
- Declarative authority: statements of fact, not hedged analysis
- Paratactic accumulation: "and...and...and" clause structure
- Concrete imagery: physical traits, not psychological analysis
- Restraint: emotional weight from silence, not from labeling
- Transmission markers: "it is said," "thus ended" — used sparingly, structurally

**Failure modes:**
- Modern register: "significantly," "it should be noted," "this was a turning point"
- Academic analysis: "the political implications were far-reaching"
- Psychology: "she felt," "he realized," "they struggled with"
- Stated themes: "this was an era of transformation" — the recurrence of motifs is the argument, not a sentence about it

**Questions to answer:**
- [ ] Does the prose reward reading aloud? Does the rhythm carry authority?
- [ ] Are there modern register breaks? (journalism, self-help, editorial commentary)
- [ ] Does the narrator state what things mean, or let the images carry meaning?
- [ ] Is there paratactic accumulation, or is every clause subordinated?

### 3. Prose Craft

**What to check:**
- **Accumulation:** Do layered clauses build scale through specifics?
- **Landscape as cultural state:** Does geography/architecture express what cultures are doing?
- **Catalogs:** When things are built or lost, are they named specifically? Three named things > a paragraph of generalization.
- **The turn:** When a cultural arc pivots within a movement, does the sentence rhythm shift?
- **Sound:** Parallelism, consonance, incantatory passages at transitions?

**Questions to answer:**
- [ ] Are there catalog passages that name what was built, traded, or lost?
- [ ] Does landscape description serve cultural-state description?
- [ ] Do movement transitions have rhythmic weight?
- [ ] Is there at least one passage that works as incantation?

### 4. Craft Posture

**What to check:**
- **Sustained elaboration:** Do cultural transformations get paragraphs, not sentences?
- **Compression ratio:** Individual actions compressed to clauses, cultural states expanded to paragraphs?
- **Catalog specificity:** Do enumerations name things, or generalize?
- **Narrator's silence:** Does the narrator close the gap between what is recorded and what it means, or leave it open?

**Questions to answer:**
- [ ] Are cultural state descriptions given room to breathe?
- [ ] Are individual actions appropriately compressed?
- [ ] Does the narrator refrain from explaining significance?

### 5. Thread Synthesis Quality

**What to check:**
- Do threads name cultural actors, not themes or individuals?
- Are culturalActors populated for every thread?
- Does the thesis describe world-level transformation?
- Do motifs include their function (why they recur)?
- Does each movement have a worldState?
- Are structural sources driving the thread arcs?

**Questions to answer:**
- [ ] Could each thread name be completed with "...and how they changed"?
- [ ] Is every chronicle referenced by at least one thread?
- [ ] Does the thesis avoid being statable as a sentence in the final text?
- [ ] Do movements cover the era chronologically without gaps?

### 6. Source Material Usage

**What to check:**
- Are structural sources (stories that dramatize events) the primary arc material?
- Do contextual sources (institutional documents, myths) appear as framing?
- Do flavor sources (broadsheets, proverbs, songs) appear as texture — a saying echoed, a custom mentioned?
- Is any source ignored entirely?

**Failure modes:**
- Arc built from flavor: the narrative derives its cultural thread from a collection of proverbs instead of from the epic-drama that dramatized the actual events
- Structural sources summarized: the narrative retells the plot of a structural chronicle instead of synthesizing its cultural meaning
- Flavor sources over-weighted: a wanted notice or tavern posting driving a narrative thread

### 7. Structure

**What to check:**
- Invocation opens by naming what will be told — the world's transformation, not the threads
- Movements separated by `---`, each with its own temporal scope
- Each movement opens from the world-state outward
- Closing lands with weight — image, consequence, or formula
- 3-5 movements, ~5,000-7,000 words total

**Questions to answer:**
- [ ] Does the invocation promise the era's shape without summarizing it?
- [ ] Do movements flow chronologically?
- [ ] Does the closing land, or does it trail off?
- [ ] Is the word count in range? (Overage is fine if the words earn their place.)

### 8. The Historian

**What to check:**
- The historian's character shows through editorial choices, not through first-person commentary
- Biases are visible in what gets expanded vs. compressed
- Private knowledge appears as stated fact without sourcing
- Running gags/preoccupations surface as narrative attention
- Tone matches the selected tone (scholarly, weary, witty, etc.)

**Questions to answer:**
- [ ] Is there any first-person intrusion? (There should not be.)
- [ ] Can you detect the historian's biases in what receives emphasis?
- [ ] Does private knowledge appear as matter-of-fact declaration?
- [ ] Does the tone feel consistent throughout?

### 9. Edit Quality

**What to check:**
- Does the edit preserve the register features (parataxis, restraint, temporal accordion)?
- Does it cut modern register breaks?
- Does it cut stated themes and psychology?
- Are motifs preserved (count instances before and after)?
- Is the edit genuinely tighter, or did it just rearrange?

---

## The Tonal Gravity Problem

The era narrative operates in the mythic-historical register, which defaults to gravity — solemnity, weight, mourning. But a world that is only its darkest moments is a document, not a lived world. The prompt includes a "not only solemn" directive:

> The mythic register includes fierce joy, defiance, wry observation, stubborn beauty, and the persistence of small things. Gravity is the default — but relief from gravity is what gives it weight.

**What to watch for:**
- Is the entire narrative uniformly solemn?
- Are there moments of defiance, stubborn beauty, or absurdity?
- Does the narrative include something that was built, that survived, that persisted despite everything?
- Do the historian's lighter preoccupations (if any) surface?

An era narrative that is all darkness reads as a catalog of disasters. The relief moments — a custom that survived, a people who built something, an unexpected kindness — are what make the darkness land.

---

## Corpus Position

| Artifact | Voice | Position | Value |
|---|---|---|---|
| **Era Narrative** | Mythic-historical, compiled tradition | Opens each era in the chronicle volume | The shape — arc, connection, weight, foreknowledge |
| Chronicles | 40 styles (stories + documents) | The tales themselves, chronological | The experience — subjective, immediate, diverse |
| Entity Descriptions | Historian's scholarly first-person | Atlas volume | The reference — who, what, when |
| Historian's Notes | Personal, critical, anchored | Marginalia with chronicles | The commentary — skepticism, correction, tangent |

Four voices. Four positions. No redundancy.

---

## Review Summary Table

Every era narrative review should conclude with a summary table. Use specific evidence, not adjectives.

### Rating Scale

| Stars | Meaning |
|-------|---------|
| ★★★★★ | Reference-quality execution; no meaningful issues |
| ★★★★☆ | Strong — minor issues that don't undermine the whole |
| ★★★☆☆ | Solid — notable gaps or inconsistencies worth addressing |
| ★★☆☆☆ | Weak — significant problems affecting quality |
| ★☆☆☆☆ | Failed — fundamental issues; dimension not achieved |

### Dimensions

| Dimension | What It Measures |
|-----------|-----------------|
| **Altitude** | Cultures and forces as protagonists. Characters as footnotes. World-level grammatical subjects. |
| **Register** | Mythic-historical voice: declarative, paratactic, concrete, restrained. No modern register breaks. |
| **Prose Craft** | Accumulation, catalog passages, landscape as cultural state, rhythmic turns, sound. |
| **Craft Posture** | Density calibration: cultural states elaborated, individual actions compressed, narrator's silence maintained. |
| **Thread Synthesis** | Cultural arcs correctly identified. Thesis at world level. Motifs functional. Movement plan coherent. |
| **Source Tiering** | Structural sources drive arcs. Contextual sources frame. Flavor sources texture. No over/under-weighting. |
| **Structure** | Invocation, movements, closing. Chronological flow. Appropriate word count. |
| **Historian Voice** | Character through editorial choices. No first person. Biases visible. Tone consistent. |
| **Tonal Range** | Not uniformly solemn. Relief from gravity present. Something persisted or was built. |
| **Edit Quality** | Register preserved/strengthened. Modern breaks cut. Motifs intact. Genuinely tighter. |

---

## Export Structure Reference

```json
{
  "narrativeId": "...",
  "projectId": "...",
  "eraId": "...",
  "eraName": "...",
  "status": "complete",
  "tone": "weary",
  "historianConfigJson": "{ ... }",
  "currentStep": "title",

  "prepBriefs": [
    {
      "chronicleId": "...",
      "chronicleTitle": "...",
      "eraYear": 42,
      "weight": "structural",
      "prep": "Historian's reading notes on this chronicle..."
    }
  ],

  "worldContext": {
    "focalEra": { "id": "...", "name": "...", "summary": "..." },
    "previousEra": { "id": "...", "name": "...", "summary": "..." },
    "nextEra": { "id": "...", "name": "...", "summary": "..." },
    "resolvedDynamics": ["Dynamic 1...", "Dynamic 2..."],
    "culturalIdentities": {
      "descriptive": {
        "culture-name": { "VALUES": "...", "GOVERNANCE": "...", "SPEECH": "..." }
      }
    }
  },

  "threadSynthesis": {
    "threads": [
      {
        "threadId": "thread_1",
        "name": "The Nightshelf Withdrawal",
        "culturalActors": ["Nightshelf"],
        "description": "...",
        "chronicleIds": ["chr_1", "chr_2"],
        "arc": "Nightshelf cultural state at start → cultural state at end"
      }
    ],
    "movements": [
      {
        "movementIndex": 0,
        "yearRange": [0, 7],
        "worldState": "How things stand for the cultures...",
        "threadFocus": ["thread_1", "thread_3"],
        "beats": "Key moments as cultural events..."
      }
    ],
    "thesis": "What happened to the world",
    "motifs": ["motif — function"],
    "openingImage": "...",
    "closingImage": "...",
    "generatedAt": 1234567890,
    "model": "...",
    "systemPrompt": "...",
    "userPrompt": "...",
    "inputTokens": 0,
    "outputTokens": 0,
    "actualCost": 0
  },

  "narrative": {
    "content": "The full generated narrative...",
    "editedContent": "The edited version (if edit step completed)...",
    "wordCount": 5700,
    "editedWordCount": 5400,
    "generatedAt": 1234567890,
    "editedAt": 1234567891,
    "model": "...",
    "systemPrompt": "...",
    "userPrompt": "...",
    "inputTokens": 0,
    "outputTokens": 0,
    "actualCost": 0
  },

  "titleCandidates": ["Title A", "Title B", "Title C"],
  "titleFragments": ["fragment 1", "fragment 2"],
  "selectedTitle": "The Chosen Title",

  "totalInputTokens": 0,
  "totalOutputTokens": 0,
  "totalActualCost": 0,
  "createdAt": 1234567890,
  "updatedAt": 1234567891
}
```

---

## Reviewer Workflow

1. **Read the narrative first** without looking at prompts. Does it work as mythic-historical prose? Does it give the era a shape?

2. **Check altitude** — scan paragraph openings. Are cultures/forces the subjects, or are characters?

3. **Check register** — read a few passages aloud. Does the rhythm carry authority? Any modern breaks?

4. **Review thread synthesis** — do threads name cultural actors? Does the thesis describe world transformation? Are structural sources driving arcs?

5. **Check source tiering** — are structural chronicles driving threads, contextual providing frame, flavor providing color?

6. **Check prose craft** — catalog passages, landscape as cultural state, rhythmic turns at pivots?

7. **Check the historian** — can you detect biases? Does private knowledge appear as fact? Any first-person intrusion?

8. **If edited, compare** — did the edit preserve register features? Cut modern breaks? Keep motifs?

9. **Produce summary table** — score each dimension with specific evidence.
