# Motif Variation Tool — Findings & Architecture

## Problem

The historian edition produced 74 annotations containing "thirty-one years." The phrase is character-defining but at 74 occurrences across ~318 entities, a reader will notice the repetition. The motif variation tool rewrites the clause containing the overused phrase while preserving the historian's voice.

## Iteration History

### Attempt 1: Phrase-level replacement (Haiku, no thinking)

Extracted just the sentence containing the phrase, sent it to the LLM with a surrounding context snippet, asked for a sentence-level rewrite.

**Result**: Fundamentally broken.
- ~25/74 variants absorbed content from adjacent sentences into the rewrite
- ~10/74 produced nonsense prose (double negatives, lost rhetorical structure)
- ~8/74 used generic bureaucratic fillers ("enough time", "my tenure", "my career")
- 2 instances used "hands" instead of "flippers"

**Root cause**: The LLM couldn't hear the historian's voice from a single extracted sentence. It had no cadence to match, no rhetorical context to preserve. Batches of 25-30 compounded the problem.

### Attempt 2: Sentence-level with visible context (Haiku, no thinking)

Same approach but added `contextBefore` and `contextAfter` to the export for review. Confirmed systemic context absorption — the LLM was merging the meaning of preceding/following sentences into its rewrite.

### Attempt 3: Full annotation + clause-only rewrite (Opus, 10k thinking)

Send the **entire annotation text** to the LLM. Ask it to return the full annotation with only the clause around the target phrase rewritten. Reduced batch size to 8. Switched to Opus with 10k thinking budget.

**Result**: Dramatically improved. Zero context absorption. Targeted clause-level changes. Voice preserved. ~60-65 of 74 are accept-quality, ~10 are strong improvements over the original phrase.

## Architecture (Current)

### Key Files

| File | Role |
|------|------|
| `components/AnnotationMotifTool.tsx` | UI: scan, generate, review, apply |
| `workers/tasks/motifVariationTask.ts` | Worker: builds prompts, calls LLM, parses response |
| `lib/llmCallTypes.ts` | Config: model, thinking budget, token limits |

### Payload (Vary Mode)

```typescript
interface MotifInstance {
  index: number;
  entityName: string;
  noteId: string;
  annotationText: string;    // Full annotation text
  matchedPhrase: string;     // The exact phrase to replace
}
```

### LLM Config

```
Call type: historian.motifVariation
Model: claude-opus-4-6
Thinking budget: 10000
Max tokens: 8192
Batch size: 8
```

### System Prompt (Vary Mode) — Key Rules

1. Receive FULL annotation text so the LLM can hear the historian's voice
2. Rewrite ONLY the clause/sentence containing the target phrase
3. Return the FULL annotation with the clause rewritten — every other word unchanged
4. Do NOT absorb/merge/duplicate content from surrounding sentences
5. Do NOT use generic duration substitutes ("enough time", "my tenure", "my career")
6. Vary aggressively — never reuse the same approach across instances

### Diff Display

`extractDiff()` finds the changed region between original and variant by computing common prefix/suffix, expanding to word boundaries, and showing ~80 chars of surrounding context. Used in both the review UI and the export.

### Apply Method

Full note text replacement — the variant IS the complete rewritten annotation, so apply is a direct text swap on the note object. No sentence-boundary math needed.

## Quality Findings (Opus Results)

### Replacement Strategy Categories

**Physical/experiential** (strongest category):
- "year after frost-scarced year"
- "gone grey in a silence no one audits"
- "worn my flippers down defending" / "worn my flippers raw scraping"
- "came to the Foundation Depths young and have grown old here"

**Self-interruption** (matches character voice):
- "done nothing else — nothing — but read"
- "— what is it now, most of a life —"
- "It has taken me — all of it, every winter down here —"
- "catalogued strata long enough — winter after winter after winter —"

**Scope/achievement substitution** (replaces time with what was accomplished):
- "from my earliest recording to yesterday's without a single deviation"
- "carried them unwritten through every edition of this work"
- "fought across every edition to prove"
- "I have mapped the Foundation Depths down to their oldest accessible strata"

**Biographical/relational**:
- "since I was young enough to think the impressions would explain themselves"
- "Unchanged clearance older than most of the staff who process it"
- "catalogued ice for as long as he has done anything"
- "longer than most archivists last in the Depths"

**Contextual** (uses the sentence's own metaphor):
- "one closed door at a time, across decades" (in a sentence about closed doors)
- "trusted since before I lost count of the seasons, trusted" (deliberate repetition)
- "every prior entry I have written without discussing them" (self-referential)

**Duration synonyms** (functional but less distinctive):
- "a full generation", "half a lifetime", "three decades", "a lifetime"
- "season upon season", "all my seasons", "this many winters"
- "most of my adult life", "more years than I care to count"

### Duplicates Found

| Phrase | Entities |
|--------|----------|
| "a full generation" | The Orca Incursion, The Shattered-Spire Assault |
| "Half a lifetime" | Accord (light-blessed), Foedus∴vincu |
| "Season upon season" | Silv-glaciere Arts, The Mbra∴silentiu |
| "every year since my first descent" | Calving (ice-raged), The Nighted~ Lantern |
| "worn my flippers [down/raw]" | The Gore Emissary, The Whispered Shrift~ (arguably fine — different verbs) |

### Lore Flag

"kept station since my twenty-third year" (The Pta∴extinct) — creates specific biographical canon: historian started at 23, currently 54. May or may not be desired. Compare "Three decades and a stray year" (Zhinghoua) which encodes the number more subtly.

## Applying to Description Motif Weaver

The `DescriptionMotifWeaver` component and `motifVariationTask.ts` weave mode currently use the sentence-level approach (extract sentence + surrounding context snippet). Based on the findings above, similar changes are likely needed:

### Changes Required

1. **Send full description** instead of extracted sentence + context snippet
2. **Ask for full description back** with only the target sentence rewritten to incorporate the phrase
3. **Switch to Opus with thinking** (weave mode currently inherits the same call config, but verify)
4. **Reduce batch size** to 8 (weave payloads may already be smaller)
5. **Update system prompt** with the same anti-absorption and voice-preservation rules
6. **Update apply logic** to full-description replacement instead of sentence swap

### Weave-Specific Considerations

- Weave is the inverse problem: incorporating "the ice remembers" INTO sentences, not removing a phrase
- The full-description approach is arguably even more important here — the LLM needs to see how the phrase fits the surrounding prose
- The weave prompt should emphasize that the phrase must feel organic, not inserted
- The current `MotifWeaveInstance` type has `sentence` + `surroundingContext` — needs to change to full description + target sentence identifier
