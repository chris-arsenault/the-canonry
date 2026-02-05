# Chronicle Corpus Review Guide

This document provides a structured approach for reviewing multiple chronicles as a collection. Use this when evaluating whether generated stories form a cohesive anthology or show signs of LLM-generated sameness.

**Companion to**: `docs/chronicle-review-guide.md` (single chronicle review)

---

## When to Use This Guide

Use corpus review when you have 3+ chronicles and need to assess:
- Do the stories feel like a cohesive anthology from a shared world?
- Are the structures genuinely different or template variations?
- Are there unwieldy repeated tropes that signal LLM generation?
- Does narrative style actually change the output, or just the nouns?

---

## Quick Reference: What to Extract

For each chronicle in the corpus, extract:
```bash
# Final version content
cat export.json | jq -r '.versions[-1].content' > story_name.txt

# Metadata
cat export.json | jq '{
  title: .chronicle.title,
  style: .chronicle.narrativeStyle.name,
  wordCount: (.versions[-1].content | split(" ") | length)
}'
```

---

## Review Dimensions

### 1. Structural Diversity

**What to check**: Are stories genuinely different shapes, or noun-swapped retellings?

| Style | Expected Structure |
|-------|-------------------|
| Heroic Fantasy | Three-act: departure → ordeal → return |
| Epic Drama | Chronicle: omen → conflict → battle → aftermath |
| Slice of Life | Continuous time: bounded moment, no scene breaks |
| Romance | Convergence: meet → offerings/signals → conflict → declaration |
| Tragedy | In medias res: fall → height (flashback) → temptation → recognition |
| Action | Momentum: pursuit → confrontation → escape |

**Questions to answer:**
- [ ] Do different narrative styles produce visibly different structures?
- [ ] Is the scene count appropriate to each style's requirements?
- [ ] Do pacing and rhythm vary between stories?
- [ ] Would you be able to identify the style from structure alone?

**Red flags:**
- All stories have same number of scenes regardless of style
- All stories follow same emotional arc (tension → climax → resolution)
- Scene breaks appear at predictable intervals

---

### 2. Opening Line Variety

**What to check**: Do stories start differently, or is there a template?

**Extract all openings:**
```bash
for f in *.txt; do echo "=== $f ==="; head -1 "$f"; done
```

**Good variety looks like:**
- Different subjects (character vs. setting vs. action)
- Different sentence lengths
- Different emotional registers (contemplative vs. urgent vs. matter-of-fact)

**Red flags:**
- All openings start with weather/atmosphere
- All openings follow same [Subject] [verb] [sensory detail] pattern
- Multiple openings use same construction (e.g., "The X was doing something Y")

---

### 3. Ending Line Variety

**What to check**: Do stories land differently?

**Extract all endings:**
```bash
for f in *.txt; do echo "=== $f ==="; tail -3 "$f"; done
```

**Good variety looks like:**
- Different emotional registers (triumphant, horrific, melancholy, hopeful, bitter)
- Different techniques (single word, image, action, dialogue)
- Endings that match their genre's requirements

**Red flags:**
- All endings summarize themes ("The ice remembers everything")
- All endings use same sentence rhythm
- All endings resolve cleanly regardless of genre

---

### 4. Repeated Phrase Analysis

**What to check**: Which phrases appear across multiple stories?

**Search for common project motifs:**
```bash
grep -l "ice remembers" *.txt | wc -l    # Expected: some presence
grep -l "fire-core" *.txt | wc -l        # Expected: most (it's core tech)
grep -l "cold tea" *.txt | wc -l         # Watch for overuse
grep -l "warmth through wrapping" *.txt  # Watch for overuse
```

**Acceptable overlap:**
- Core world motifs ("the ice remembers") — 40-60% of stories
- Technology terms (fire-cores, aurora-crystals) — most stories
- Faction names — appropriate to cast

**Problematic overlap:**
- Same poetic phrase in 80%+ of stories
- Same metaphor/simile construction repeated
- Same emotional beat (e.g., "cold tea left for ghosts") in multiple stories

**Track repeated phrases in a table:**

| Phrase | Story 1 | Story 2 | Story 3 | Story 4 | Story 5 | Concern Level |
|--------|---------|---------|---------|---------|---------|---------------|
| "the ice remembers" | ✓ | ✓ | - | ✓ | - | Acceptable (project motif) |
| "cold tea / two cups" | ✓ | ✓ | - | - | - | Minor (different contexts) |
| [specific phrase] | | | | | | |

---

### 5. Physical Motif Variety

**What to check**: Do stories use different embodied details, or repeat the same ones?

**Common penguin physical elements to track:**
- Flipper trembling/shaking (limited options here — accept some repetition)
- Scars and marks (should be different scars with different meanings)
- Cold-burn / ice-burn patterns
- Feather coloring
- Movement patterns

**Questions to answer:**
- [ ] Do different characters have different physical signatures?
- [ ] Are scars/marks serving different narrative purposes?
- [ ] Do action sequences feel physically distinct?

**Note**: Penguin anatomy limits physical variety. Flipper trembling is often the only option for showing nervousness/trauma. Accept this limitation but ensure the *cause* and *context* vary.

---

### 6. Dialogue Pattern Variety

**What to check**: Do characters in different stories speak differently?

**Good variety looks like:**
- Heroic Fantasy: oaths and declarations ("I will hold this passage")
- Slice of Life: terse, minimal ("Two fish. The tea.")
- Romance: half-sentences, subtext ("The warming— ...isn't for sale")
- Action: short, physical ("She ran.")

**Red flags:**
- All dialogue follows same rhythm regardless of genre
- All characters speak in complete, formal sentences
- Distinctive speech patterns (like half-sentences) don't appear when style calls for them

---

### 7. World Cohesion Check

**What to check**: Do stories feel like the same world?

**Consistent elements (should be present):**
- [ ] Faction names match (Aurora Stack, Nightshelf, Midnight Claws, etc.)
- [ ] Technology is consistent (fire-cores, aurora-crystals, same magic systems)
- [ ] Geography references are compatible
- [ ] Historical events are consistent (Vum∴tenebra, Faction Wars, etc.)
- [ ] Cultural practices align (memorial rules, Flipper Accord, etc.)

**Cross-references (good sign):**
- Historical figures mentioned across multiple stories
- Locations appear in multiple stories with consistent descriptions
- Events referenced as shared history

**Red flags:**
- Contradictory facts between stories
- Technology works differently in different stories
- Same location described inconsistently

---

### 8. LLM-Generated Sameness Assessment

**Final check**: Would these pass as authored by different writers in a shared universe?

**Scoring rubric:**

| Dimension | Score 1-5 | Notes |
|-----------|-----------|-------|
| Structural variety | | Different shapes for different styles? |
| Opening variety | | Different constructions and registers? |
| Ending variety | | Different emotional landings? |
| Dialogue variety | | Characters speak differently across stories? |
| Unique stylistic elements | | Does each story have something only it does? |
| Acceptable motif repetition | | Core motifs present but not overwhelming? |
| World cohesion | | Same world, different windows? |

**Overall assessment:**
- **5/5 on all**: Reads as professional anthology
- **4/5 average**: Minor patterns visible but not distracting
- **3/5 average**: Noticeable LLM fingerprints, but stories are distinct
- **2/5 average**: Template variations, not genuine variety
- **1/5 average**: Same story with noun swaps

---

## Common Corpus Issues

### The "House Style" Problem
All stories sound like they were written by the same author even when they shouldn't. This indicates the base prompt is overpowering style-specific instructions.

**Diagnosis**: Compare prose rhythm, metaphor choices, and sentence construction across styles. If Heroic Fantasy and Slice of Life read similarly, the style instructions aren't landing.

### The "Greatest Hits" Problem
The same impressive phrases or images appear in every story because the model learned they work well.

**Diagnosis**: Track striking phrases. If "the ice remembered" or similar appears as a climactic moment in 4/5 stories, it's become a crutch.

### The "Theme Park" Problem
Stories feel like tours of the world rather than lived experiences. Every story explains the same world systems to a presumed newcomer.

**Diagnosis**: Check for repeated exposition of basic world facts. If every story explains what fire-cores are, the model is treating each story as standalone introduction rather than part of a corpus.

### The "Emotional Monotone" Problem
All stories hit the same emotional beats regardless of genre. Everything is melancholy, or everything is triumphant.

**Diagnosis**: Map emotional arc of each story. If Romance and Tragedy have the same shape, something is wrong.

---

## Corpus Review Workflow

1. **Extract all final versions** to separate text files

2. **Quick read-through** — read all stories back-to-back without analysis. Note gut reactions to variety/sameness.

3. **Opening/ending comparison** — extract and compare first and last lines

4. **Phrase frequency analysis** — search for repeated phrases, build tracking table

5. **Structural mapping** — outline each story's structure, compare to style expectations

6. **Unique element identification** — what does each story do that no other story does?

7. **World cohesion check** — verify consistent facts, geography, technology

8. **Score and summarize** — use rubric to produce overall assessment

---

## Example Corpus Assessment

**Corpus**: 5 chronicles (Heroic Fantasy, Epic Drama, Slice of Life, Romance, Action)

**Structural Diversity**: 5/5
- Each style produced visibly different structure
- Scene counts match style requirements
- Pacing varies appropriately

**Opening Variety**: 5/5
- No two openings share construction
- Different subjects, lengths, registers

**Ending Variety**: 5/5
- Each ending matches its genre
- Different techniques (single word, image, reconciliation, horror, action)

**Dialogue Variety**: 4/5
- Romance half-sentences are unique
- Slice of Life terseness is distinct
- Some similarity between Heroic Fantasy and Epic Drama dialogue

**Unique Elements**: 5/5
- Romance: half-sentence communication system
- Slice of Life: routine path-counting
- Action: sustained momentum without scene breaks

**Motif Repetition**: 4/5
- "Ice remembers" in 3/5 (acceptable, project motif)
- "Two cups / cold tea" in 2/5 (minor concern, different contexts)
- Flipper trembling in 3/5 (accepted limitation)

**World Cohesion**: 5/5
- Consistent factions, technology, history
- Cross-references work
- No contradictions

**Overall**: 4.6/5 — Reads as cohesive anthology with minor "house style" patterns. Would pass as multi-author shared universe.

---

## When to Re-evaluate Prompts

If corpus review reveals:
- **Structural sameness**: Check if narrative style instructions are being passed and weighted appropriately
- **Phrase repetition**: Check if perspective synthesis is generating the same motifs
- **Emotional monotone**: Check if frame prompts are overriding style-specific tone
- **World-building exposition in every story**: Check if system prompt assumes unfamiliarity

Changes to investigate:
- `perspectiveSynthesizer.ts` — is it matching style register?
- `promptBuilder.ts` — are frame prompts neutral enough for style override?
- `narrativeStyles.ts` — are style instructions specific enough?
