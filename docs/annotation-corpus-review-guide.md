# Annotation Corpus Review Guide

This document provides a structured approach for reviewing the historian's annotations across the full chronicle and entity corpus. Use this when evaluating whether the historian's voice holds up at scale or shows signs of LLM-generated uniformity.

**Companion to**: `docs/chronicle-corpus-review-guide.md` (narrative quality), `docs/chronicle-review-guide.md` (single chronicle)

---

## When to Use This Guide

Use annotation corpus review when you have 20+ annotated chronicles and need to assess:
- Does the historian sound like a real scholar across hundreds of notes?
- Are annotation lengths naturally varied or robotically uniform?
- Are the same phrases, claims, and openings recycled across chronicles?
- Does the historian contradict themselves with repeated superlatives?
- Is personal disclosure calibrated or overused?

---

## Quick Reference: Data Extraction

```bash
# Extract all annotations from the annotation review JSON
cat annotation-review.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
for c in data:
  for a in c.get('annotations', []):
    print(json.dumps({
      'chronicle': c['title'],
      'type': a['type'],
      'text': a['text'],
      'anchor': a['anchorPhrase'],
      'display': a.get('display', 'full')
    }))
"

# Word count distribution
cat annotation-review.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
lengths = [len(a['text'].split()) for c in data for a in c.get('annotations', [])]
short = sum(1 for l in lengths if l <= 35)
med = sum(1 for l in lengths if 36 <= l <= 70)
long = sum(1 for l in lengths if l > 70)
total = len(lengths)
print(f'Short (≤35w): {short} ({100*short/total:.1f}%)')
print(f'Medium (36-70w): {med} ({100*med/total:.1f}%)')
print(f'Long (71+w): {long} ({100*long/total:.1f}%)')
print(f'Total: {total}, Mean: {sum(lengths)/total:.1f}w, StdDev: {(sum((l-sum(lengths)/total)**2 for l in lengths)/total)**0.5:.1f}w')
"
```

---

## Quality Metrics

### 1. Length Naturalism

**What to check**: Do note lengths vary naturally, or do they cluster in a narrow band?

**How to measure**: Compute character-length standard deviation across all annotations. Bucket by word count: short (≤35w), medium (36–70w), long (71+w).

**Scoring rubric**:

| Score | Criteria |
|-------|----------|
| ★★★★★ | Std dev > 120 chars. All three buckets represented (15%+ each). Feels hand-written. |
| ★★★★☆ | Std dev 80–120. Two buckets well-represented, third present. |
| ★★★☆☆ | Std dev 50–80. Slight clustering visible but not distracting. |
| ★★☆☆☆ | Std dev 30–50. Obvious uniformity. >80% in one bucket. |
| ★☆☆☆☆ | Std dev < 30. All notes visually identical length. |

**Benchmark** (initial audit): Std dev 49 chars, 96.3% medium bucket. ★★☆.

**Red flags**:
- All notes within ±20 chars of each other
- No single-sentence notes (≤20 words)
- No notes exceeding 90 words

---

### 2. Type Appropriateness

**What to check**: Does the note type label match the actual content?

**How to measure**: Sample 30+ notes. For each, read the text and independently assess whether the assigned type (commentary, correction, tangent, skepticism, pedantic, temporal) matches.

**Scoring rubric**:

| Score | Criteria |
|-------|----------|
| ★★★★★ | 95%+ type-appropriate. Types are distinctive and well-differentiated. |
| ★★★★☆ | 85–95%. Occasional soft mismatches (commentary vs. tangent overlap). |
| ★★★☆☆ | 70–85%. Types feel loosely applied. |
| ★★☆☆☆ | 50–70%. Type labels seem random relative to content. |
| ★☆☆☆☆ | <50%. Types are meaningless. |

**Benchmark**: ★★★★. Most notes type-appropriate; soft edges between commentary and tangent are acceptable.

---

### 3. Phrase Originality

**What to check**: Are distinctive phrases recycled across chronicles?

**How to measure**: Extract all 5-word n-grams from annotation texts. Count n-grams appearing in 3+ different chronicles. Also search for known problem phrases from prior audits.

```bash
# Known phrases to track from initial audit
grep -c "boundary between living world" annotations.txt
grep -c "ice does not always sort" annotations.txt
grep -c "what strikes me" annotations.txt
```

**Scoring rubric**:

| Score | Criteria |
|-------|----------|
| ★★★★★ | <20 repeated 5-grams across corpus. No phrase in >5% of chronicles. |
| ★★★★☆ | 20–50 repeated 5-grams. No single phrase in >10% of chronicles. |
| ★★★☆☆ | 50–150 repeated 5-grams. Some phrases noticeable on re-reading. |
| ★★☆☆☆ | 150–300 repeated 5-grams. Clear "house phrases" visible. |
| ★☆☆☆☆ | 300+ repeated 5-grams. Notes feel templated. |

**Benchmark**: 296 repeated 5-grams, "boundary between living world and ice-memory" ×18. ★★☆.

---

### 4. Personal Disclosure Calibration

**What to check**: Are personal tangents (memories, asides, confessions) used sparingly enough to feel genuine?

**How to measure**: Count notes of type `tangent`. Calculate as percentage of total. Also search for refusal patterns ("I do not discuss", "I will not speak of").

**Scoring rubric**:

| Score | Criteria |
|-------|----------|
| ★★★★★ | 3–8% tangent rate. Each disclosure feels earned and unique. Zero refusal patterns. |
| ★★★★☆ | 8–12% tangent rate. Slight over-sharing but disclosures are varied. |
| ★★★☆☆ | 12–18% tangent rate. Some disclosures feel formulaic. Minor refusal patterns. |
| ★★☆☆☆ | 18–25% tangent rate. The historian's personal life dominates. |
| ★☆☆☆☆ | >25% or <3%. Either constant confession or no personality at all. |

**Benchmark**: 11.9% tangent rate, 26 "I do not discuss" refusal patterns. ★★★.

**Red flags**:
- "I do not discuss [topic]" — a scholar annotating a text would explain why, not refuse
- Same personal memory surfacing in multiple chronicles
- Tangent notes that are actually commentary with "I remember" prepended

---

### 5. Cross-Reference Integrity

**What to check**: When the historian references other texts, entities, or events, are those references accurate?

**How to measure**: Sample 20 notes that mention specific entities, events, or facts. Verify against the world data.

**Scoring rubric**:

| Score | Criteria |
|-------|----------|
| ★★★★★ | All cross-references checkable and accurate. |
| ★★★★☆ | 90%+ accurate. Minor imprecisions in dates or names. |
| ★★★☆☆ | 75–90%. Some references are vague enough to be uncheckable. |
| ★★☆☆☆ | 50–75%. Frequent vague or incorrect references. |
| ★☆☆☆☆ | <50%. References are fabricated or contradictory. |

**Benchmark**: ★★★★. Cross-references generally solid; occasional vagueness.

---

### 6. Format Sensitivity

**What to check**: Does annotation style shift appropriately between document formats (stories, field reports, proverbs, notices) and entity descriptions?

**How to measure**: Group annotations by chronicle format. Compare tone, type distribution, and content style across groups.

**Scoring rubric**:

| Score | Criteria |
|-------|----------|
| ★★★★★ | Clear format awareness. Proverb annotations differ from story annotations differ from entity annotations. |
| ★★★★☆ | Good differentiation on most formats. One or two formats treated generically. |
| ★★★☆☆ | Some format awareness but notes could be swapped between formats without notice. |
| ★★☆☆☆ | Minimal format sensitivity. All annotations read the same regardless of source. |
| ★☆☆☆☆ | No format awareness at all. |

**Benchmark**: ★★★★. Three-mode prompt system (entity/story/document) produces good differentiation.

---

### 7. Lore Contribution

**What to check**: Do annotations add genuine world-building value beyond restating what the text says?

**How to measure**: Sample 30 notes. For each, assess: does this annotation add information, context, or perspective that isn't in the source text?

**Scoring rubric**:

| Score | Criteria |
|-------|----------|
| ★★★★★ | 90%+ of notes add genuine new information, connections, or context. Some notes could become canon. |
| ★★★★☆ | 75–90%. Most notes add value. A few restate without adding. |
| ★★★☆☆ | 50–75%. Mixed. Some genuine insight, some padding. |
| ★★☆☆☆ | 25–50%. Most notes paraphrase or offer generic observations. |
| ★☆☆☆☆ | <25%. Notes are summaries dressed as commentary. |

**Benchmark**: ★★★★★. Strong lore contribution — the historian's private facts and running gags create genuine supplementary world-building.

---

### 8. Superlative Self-Consistency

**What to check**: Does the historian contradict themselves by declaring multiple things "the most X" or "the only Y"?

**How to measure**: Regex-extract superlative claims from all annotations:

```bash
grep -oiP 'the (most|only|finest|best|worst|first|last|greatest|single) \w+' annotations.txt | sort | uniq -c | sort -rn
```

For each superlative pattern, count how many different targets it's applied to. A claim like "the most honest line" applied to 3 different lines is a self-contradiction.

**Scoring rubric**:

| Score | Criteria |
|-------|----------|
| ★★★★★ | No superlative repeated for different targets. Or superlatives are properly qualified ("among the most"). |
| ★★★★☆ | 1–2 duplicated superlatives. Minor and unlikely to be noticed in sequence. |
| ★★★☆☆ | 3–5 duplicated superlatives. Would be noticed in a close reading. |
| ★★☆☆☆ | 6–10 duplicated superlatives. Undermines the historian's credibility. |
| ★☆☆☆☆ | 10+. The historian declares everything "the most" of something. |

**Benchmark**: 11 different things declared "the most honest," "the most honest line" used 3× identically. ★★☆.

---

## Common Corpus Issues

### The "Word Budget Robot" Problem

All notes are the same length because the prompt specifies a rigid word range. The historian sounds like they're filling a form, not writing in margins.

**Diagnosis**: Compute length std dev. If <50 chars, the word budget is too tight.

**Fix**: Widen the word range and inject a length histogram showing the skew so the LLM self-corrects.

### The "Greatest Hits" Problem

The same striking phrases appear across many annotations because the model learned they work well and has no mechanism to track what it's already said.

**Diagnosis**: Extract 5-word n-grams, find phrases in 5+ chronicles. If the same metaphor or construction appears in >10% of annotations, it's a crutch.

**Fix**: Accumulate overused phrases and inject as an avoidance list in the prompt.

### The "Superlative Inflation" Problem

The historian keeps declaring new things "the most honest" or "the only true example" because each annotation session is independent and doesn't know about prior claims.

**Diagnosis**: Regex-extract superlative claims, group by pattern, count targets per pattern.

**Fix**: Accumulate superlative claims and inject as "claims already made" so the historian knows their own track record.

### The "I Do Not Discuss This" Problem

The historian refuses to engage with certain topics, creating empty margins instead of annotations. This is the LLM's safety training leaking through the character.

**Diagnosis**: Search for "I do not discuss", "I will not speak of", "some things are best left."

**Fix**: Explicit anti-refusal rule in system prompt. A scholar annotating a text has opinions about everything — discomfort is itself worth annotating.

### The "Constant Confessor" Problem

Too many notes are personal tangents, diluting their impact. When every annotation is "I remember when...", the historian's personal life overshadows the scholarship.

**Diagnosis**: Calculate tangent-type percentage. If >15%, the historian is over-sharing.

**Fix**: Inject tangent count from prior corpus as a soft budget.

---

## Review Workflow

1. **Export annotations** to a review JSON (via the annotation export tool)
2. **Compute statistics** — length distribution, type distribution, tangent rate
3. **Run phrase analysis** — extract n-grams, find repeated phrases, build tracking table
4. **Run superlative analysis** — extract superlative claims, find contradictions
5. **Sample for quality** — read 30+ annotations across different formats and tones
6. **Score each metric** using the rubrics above
7. **Identify top 3 issues** and trace them to prompt/pipeline causes
8. **Document findings** with specific examples and proposed fixes

---

## Summary Scorecard Template

| Metric | Score | Notes |
|--------|-------|-------|
| Length Naturalism | ★☆☆☆☆ – ★★★★★ | Std dev, bucket distribution |
| Type Appropriateness | ★☆☆☆☆ – ★★★★★ | Sample accuracy rate |
| Phrase Originality | ★☆☆☆☆ – ★★★★★ | Repeated n-gram count |
| Personal Disclosure Calibration | ★☆☆☆☆ – ★★★★★ | Tangent %, refusal count |
| Cross-Reference Integrity | ★☆☆☆☆ – ★★★★★ | Accuracy rate in sample |
| Format Sensitivity | ★☆☆☆☆ – ★★★★★ | Differentiation across formats |
| Lore Contribution | ★☆☆☆☆ – ★★★★★ | Value-add rate in sample |
| Superlative Self-Consistency | ★☆☆☆☆ – ★★★★★ | Duplicated claim count |
| **Composite** | | Average of all 8 |
