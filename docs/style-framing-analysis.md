# Style Framing Analysis

Tracking document for evaluating whether certain narrative styles benefit from alternative framing (non-fantasy-author) or if unified framing produces better corpus cohesion.

---

## Current Framing

All styles currently use the "expert fantasy author" frame from `promptBuilder.ts`:

> "You are an expert fantasy author writing engaging fiction. Your readers expect vivid characters, emotional truth, and prose that lands."

This was softened from earlier "action-forward" language to avoid contradicting quiet styles.

---

## Styles Under Consideration for Alternative Framing

| Style | Current Behavior | Concern |
|-------|-----------------|---------|
| Poetic/Lyrical | Produces embodied lyricism - abstract register grounded in physical detail | May benefit from more meditative framing |
| Slice of Life | Still producing scene breaks despite "no scene breaks" instruction | Fantasy author may imply narrative drive |
| Dreamscape | Untested with current framing | Psychedelic register may clash with "engaging fiction" frame |
| Confession | Untested | Monologue structure may need different voice |

---

## Case Study: Poetic/Lyrical

**Chronicle:** "Kaela and the Fissured Spire"

### What the Fantasy Author Framing Produced

Strengths:
- Grounded abstraction: "copper and burnt bone-marrow," "lamp-oil that trembles when her flippers tremble"
- Physical embodiment even with cosmic register
- Sensory specificity earning the lyrical moments
- Circular structure achieved with concrete recurring images

The framing pushed toward **embodied lyricism** rather than decorative abstraction. Lines like "a witness witnessing the witness" work because they're earned through physical detail.

### Would Alternative Framing Help?

Uncertain. The current output is strong. A "literary fiction author" or "poet" frame might:
- Allow more abstraction (risk: losing grounding)
- Permit slower pacing (benefit for contemplative styles)
- But might also produce "workshop poetry" - technically proficient but emotionally distant

**Current assessment:** Fantasy author framing is working for Poetic/Lyrical. The grounding it provides may be a feature, not a limitation.

---

## The Divergence Question

### Risk of Style-Specific Framing

If we give Poetic/Lyrical a "literary fiction" frame, Dreamscape a "surrealist" frame, and Slice of Life a "contemporary fiction" frame, we risk:

1. **Tonal fragmentation** - stories feel like they come from different authors/worlds
2. **Loss of "penguin tales" voice** - the project has a unified sensibility
3. **Over-optimization** - each style perfect in isolation, but corpus feels assembled rather than authored

### Risk of Unified Framing

If we keep "fantasy author" for everything:

1. **Style flattening** - quiet styles forced into narrative drive they don't want
2. **Missed potential** - some styles might genuinely benefit from different registers
3. **House style too strong** - everything sounds the same despite structural variety

---

## Recommendation

**Keep unified framing for now. Monitor these specific failure modes:**

1. **Slice of Life scene breaks** - if it keeps producing them, the issue is style instructions, not framing
2. **Dreamscape too narrative** - if it produces plot instead of association, consider alternative framing
3. **Confession too distant** - if monologue lacks intimacy, consider "literary fiction" frame

The Poetic/Lyrical case study suggests the fantasy author framing produces **grounded abstraction** - which may be exactly what distinguishes these chronicles from generic LLM poetry. The embodiment is a feature.

**Alternative approach:** Rather than changing the frame, strengthen style-specific prose instructions to override narrative-drive assumptions. The style instructions already have significant weight - the issue may be specificity, not framing.

---

## Test Plan (if we decide to experiment)

1. Generate same chronicle with both framings
2. Compare for:
   - Register (does alternative produce more appropriate tone?)
   - Grounding (does fantasy author produce more embodied prose?)
   - Corpus cohesion (would both versions feel like same world?)
3. Decide per-style whether divergence is worth the benefit

---

## Changelog

- 2026-02-05: Initial analysis based on Poetic/Lyrical review ("Kaela and the Fissured Spire")
