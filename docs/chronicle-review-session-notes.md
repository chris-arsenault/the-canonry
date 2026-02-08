# Chronicle Review Session Notes

## Current Session: Story Chronicle Reviews (2026-02-07)

### Context

We are reviewing **story-format chronicles** where:

- **V0** was generated on an older pipeline that included PS but **before** the following changes:
  - Reframing of the generation prompt as written by an "expert fantasy author" (vs generic "writer")
  - Adoption of "Story Bible" terminology in the prompt structure (Tone & Atmosphere, Character Notes sections)
  - Cultural identities **may or may not** have been present in V0's PS input — verify per export
  - Era tracking was **broken** in V0 — era mismatches in V0 are a **known pipeline issue**, not a review finding. Do not flag V0 era errors.

- **V1/V2** use the **current pipeline** with:
  - "Expert fantasy author" framing
  - Story Bible structure (Tone & Atmosphere, Character Notes)
  - Full cultural identity integration
  - New PS synthesis (only the V1/V2 PS is retained in the export)

- Only **one version of PS** is retained in the export (the V1/V2 version). V0's PS output is not available for comparison.

### Review Adjustments for This Session

1. **V0 is the baseline, not a competitor.** The primary question is: does the new pipeline (V1/V2) produce measurably better output than V0? V0 should be read first for its standalone quality, then V1/V2 evaluated for improvement along specific dimensions.

2. **Era errors in V0 are not review findings.** Note them for completeness but don't penalize. The pipeline has been fixed.

3. **The Story vs Document axis matters more for stories.** Documents were consistently documentary (good). Stories are where the pipeline struggles with the world-building-document drift. Watch for:
   - Does V1/V2 read more like a **lived story** or an **elegant world-building document**?
   - Does the "expert fantasy author" reframing produce more story-axis output?
   - Does the Story Bible structure help or hurt — does organized reference material cause the LLM to "organize" its output into documentation?

4. **Cultural identity comparison.** If V0 lacked cultural identities in PS input, note whether V1/V2's cultural integration represents a visible quality improvement. If V0 had them, note whether the new PS synthesis uses them differently.

5. **The key comparison dimensions** for this session are:
   - **Story energy**: Does V1/V2 sustain story energy longer than V0? Or does the richer context cause documentation drift in later sections?
   - **Tone guidance adherence**: The review guide notes that rich context causes models to prioritize lore integration over style guidance (bitter camaraderie, dark humor, syntactic poetry). Does the expert-author reframing help?
   - **Character embodiment**: Do characters feel like people acting, or like lore entries walking around? The Story Bible's Character Notes are designed to give the model backstory without making it exposition-dump.
   - **Motif usage**: Do suggested motifs appear as organic echoes or forced insertions?
   - **Comparison report quality**: Does the auto-comparison correctly identify story-vs-document differences between versions?

6. **Pipeline impact comparison** is especially important this session. We're evaluating whether the pipeline *changes* (author framing, Story Bible, new PS) improve output quality. Rate pipeline impact for V0 separately from V1/V2 if the difference is notable.

### Export Structure Notes

- **Era information** in story-format exports lives in `generationContext.focalEra`, NOT in per-version fields. Document-format exports had per-version era fields; story-format exports specify the era once at the generation context level. The `temporalNarrative` in PS input/output provides additional era-contextual framing. Do not flag "missing era information" — check `focalEra` first.

### Emerging Patterns

1. **Temporal narrative vs. personal directives — priority competition.** When the PS provides both strong personal/emotional directives (voice dimensions, entity directives) AND era-contextual framing (temporal narrative, focalEra dynamics), the model may deprioritize era material in favor of the personal dimensions. Observed in "What the Mask Cannot Say" (confession format) — the Clever Ice Age dynamics (workshop demand, knowledge wars, information networks tightening) are absent from the output, while the personal voice dimensions (THE_TELL, SELECTIVE_MEMORY) are fully realized. For inward-facing formats (confession, elegy), this is the correct priority — the model chose well. **Watch for this in outward-facing stories** (battle accounts, political narratives, trade chronicles) where era-contextual dynamics should be more visible and where temporal narrative should actively shape the plot, not just frame it.

### What NOT to Focus On

- V0 era errors (known issue, fixed)
- Missing V0 PS data (not retained)
- Missing per-version era fields (era is in `generationContext.focalEra` for story exports)
- Word count precision (guide for the LLM, not a hard limit)
- Document-format concerns (we've moved past documents)
