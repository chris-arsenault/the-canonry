# Chronicle Generation Experiments

This document tracks hypotheses, experimental results, and open questions about chronicle generation quality.

---

## Current Hypothesis State

### 1. Thinking vs Non-Thinking Mode

**Status**: INCONCLUSIVE

| Observation | Evidence |
|-------------|----------|
| Thinking mode may cause "box-checking" prose | Ice Remembers V2 (Opus thinking) was world-building document |
| But thinking mode can produce good results | Brazier V2 (Opus thinking) was the BEST version |
| Non-thinking doesn't guarantee soul | Ice Remembers V3-V4 (Opus non-thinking) were still documents |

**Current position**: Thinking mode is not the sole cause of quality degradation. Other factors interact.

---

### 2. Opus vs Sonnet

**Status**: INCONCLUSIVE

| Observation | Evidence |
|-------------|----------|
| Sonnet can produce excellent chronicles | Ice Remembers V1 (Sonnet) = gold standard |
| Sonnet with rich context loses soul | Ice Remembers V5 (Sonnet + rich context) = document |
| Opus can produce good action | Brazier V2 (Opus) = best version of that chronicle |

**Current position**: Model choice alone doesn't determine quality. Context and style interact with model.

---

### 3. Narrative Style Influence

**Status**: LEADING HYPOTHESIS

| Style | Instructions | Observed Effect |
|-------|--------------|-----------------|
| **Action Adventure** | "Dialogue happens while moving. No one stops to talk." | Protects against drift — Brazier V2 succeeded |
| **Epic Drama** | "The chronicler may... Editorialize" | Invites drift — Ice Remembers V2-V5 failed |
| **Lost Legacy** | "What did the artifact mean to this generation?" | Demands meaning-making — Three Days was document |

**Key insight**: Style instructions that permit/encourage editorializing and meaning-making may be the proximate cause of world-building document output.

**Confounding factor**: Ice Remembers V1 (the gold standard) was generated with a **different, unrecoverable narrative style prompt**. We cannot compare apples to apples.

---

### 4. Context Length / Volume

**Status**: UNVALIDATED

| Observation | Evidence |
|-------------|----------|
| Rich context may cause box-checking | Ice Remembers V5 (Sonnet + rich context) worse than V1 (Sonnet + simple context) |
| But rich context can work | Brazier V2 (Opus + rich context) = best version |
| Shorter word counts stay tighter | Brazier V2 at 1301 words = purest story; V4 at 1617 = some drift |

**Hypothesis**: Context volume interacts with style. Rich context + permissive style = drift. Rich context + restrictive style = okay.

**Unvalidated**: We haven't run controlled experiments isolating context volume.

---

### 5. Word Count / Length

**Status**: PARTIALLY SUPPORTED

| Observation | Evidence |
|-------------|----------|
| Shorter versions stay in story mode | Brazier V2 (1301 words) = tightest |
| Longer versions drift into exposition | Brazier V3 sections 1-2 good, section 3 drifts |
| But length alone doesn't explain it | Ice Remembers V1 (2468 words) = best; V2 (2010 words) = document |

**Hypothesis**: The model has finite "story energy." Longer word targets may be filled with exposition if story energy depletes. But this interacts with style and context.

---

## Experimental Data Summary

### "The Ice Remembers What Wakes"

| Version | Model | Thinking | Context | Words | Result |
|---------|-------|----------|---------|-------|--------|
| V1 | Sonnet | No | **Simple (old prompt)** | 2468 | GOLD STANDARD |
| V2 | Opus | Yes | Rich | 2010 | Document |
| V3 | Opus | No | Rich | 2166 | Document (better world-building) |
| V4 | Opus | No | Rich | 2003 | Almost chronicle |
| V5 | Sonnet | No | Rich | 2600 | Document |

**Key finding**: V1 used a different (unrecoverable) narrative style prompt. All comparisons are confounded.

---

### "Three Days"

| Version | Model | Thinking | Context | Words | Result |
|---------|-------|----------|---------|-------|--------|
| V1 | Opus | Yes | Rich | ~2500 | Document (elegant but no soul) |

**Style**: Lost Legacy (ensemble, artifact-as-protagonist)

**Problems**: Authorial commentary, deaths in retrospect, cosmic-witness ending, no bitter camaraderie despite prompt instruction.

---

### "When The Brazier Woke Again"

| Version | Model | Thinking | Context | Words | Result |
|---------|-------|----------|---------|-------|--------|
| V1 | Opus | ? | Old | 1530 | Good action |
| V2 | Opus | Yes | Rich | 1301 | BEST (tightest, bitter camaraderie callback) |
| V3 | Opus | ? | Rich | 1468 | Good, some drift |
| V4 | Sonnet | No | Rich | 1617 | Good, "Legend is a word for the dead" |
| V5 | Opus | No | Rich | 1554 | Good action |

**Style**: Action Adventure (countdown, urgency)

**Key finding**: Action Adventure style protected against drift even with rich context and thinking mode.

---

## Open Questions

1. **Can we recover Ice Remembers V1's prompt?** Without it, we can't isolate what made V1 succeed.

2. **Is the narrative style the proximate cause?** Need to test:
   - Same cast/events, different styles
   - Epic Drama with anti-editorializing instructions added

3. **Does context volume matter independent of style?** Need to test:
   - Action Adventure with minimal context vs rich context
   - Epic Drama with minimal context vs rich context

4. **Is there a thinking × style interaction?** Need to test:
   - Thinking mode + Action Adventure (we have: Brazier V2 = good)
   - Thinking mode + Epic Drama (we have: Ice Remembers V2 = bad)
   - Non-thinking + Action Adventure (we have: Brazier V4-V5 = good)
   - Non-thinking + Epic Drama (we have: Ice Remembers V3-V4 = bad)

5. **Why are results inconsistent?** Possible factors:
   - Random variation in generation
   - Uncontrolled variables (cast complexity, event count, etc.)
   - Style × context × model × thinking interactions we haven't mapped

---

## Proposed Next Experiments

### Experiment A: Style Isolation
Generate the same cast/events with:
1. Action Adventure style
2. Epic Drama style
3. Epic Drama style with anti-editorializing instructions

Compare on story vs document axis.

### Experiment B: Context Isolation
Generate the same chronicle with:
1. Full perspective synthesis output
2. "Seeds only" (4-6 evocative fragments)
3. Minimal context (just cast + events)

Compare on story vs document axis.

### Experiment C: Recover V1 Conditions
Attempt to reconstruct what made Ice Remembers V1 work:
- Was it a different style definition?
- Was it simpler context?
- Was it a different prompt structure entirely?

---

## Change Log

| Date | Change |
|------|--------|
| 2026-02-05 | Initial document created tracking experimental state |
