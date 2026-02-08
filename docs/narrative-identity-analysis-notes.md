# Narrative Identity Analysis Notes

## Purpose

Tracking guide for evaluating the impact of recent pipeline fixes on chronicle quality. These notes cover what changed, what to watch for, and the meta-narrative framework that contextualizes LLM limitations as in-universe features.

## Pipeline Changes (2026-02-06/07)

### Fixes Applied
1. **Descriptive cultural identities restored** — regeneration path was silently dropping all cultural identity data (VALUES, SPEECH, FEARS, TABOOS, PROSE_STYLE per culture). Fixed in ChroniclePanel.jsx line 1022. 9/10 reviewed chronicles were affected.
2. **temporalNarrative added** — PS now synthesizes world dynamics into 2-4 sentences of story-specific stakes, injected as "## Current Conditions" in the generation prompt's Historical Context section.
3. **ice-remembers disabled as a fact** — removed from the facts pipeline to reduce dominance. Ambient sources (world description, entity descriptions, cultural identities, other facts' text) still provide ice-memory as texture.
4. **Dynamics culture ID mismatch fixed** — dynamics using display names ("Nightfall Shelf", "Orca Raiders") now use entity culture IDs ("nightshelf", "orca"). Previous chronicles received max 4/8 dynamics; post-fix receives 6-8 depending on constellation.
5. **Dynamics era overrides completed** — all 8 dynamics now have overrides for all 5 eras. No more anachronistic Frozen Peace text appearing in Orca Incursion chronicles.

### Baseline for Comparison
- **With identities**: Light-Regent Xouhoulong (the only pre-fix chronicle with cultural identities)
- **Without identities**: The other 9 reviewed chronicles
- **With temporalNarrative**: The Weapon's Last Hunt (first chronicle with the feature, but still missing identities)
- **Full pipeline**: Next chronicles generated will be the first with ALL fixes active

## What to Watch in New Chronicles

### Cultural Identity Integration
- **PS input**: Confirm `culturalIdentities` shows relevant cultures with trait keys (not 0)
- **narrativeVoice**: Should reflect cultural blending, not just narrative style. Look for dimensions that reference specific cultural textures (e.g., "Nightshelf FEARS shape how dread manifests" vs generic "build tension")
- **entityDirectives**: Should incorporate culture-specific prose traits. An orca character's directive should feel different from a nightshelf character's directive beyond just their personal history
- **Cross-cultural prose**: In mixed-culture chronicles, distinct cultural voices should emerge. Orca POV carries different weight/rhythm than nightshelf POV. The strongest signal comes from chronicles with contrasting cultures in close proximity (encounters, negotiations, conflicts)

### Temporal Narrative Integration
- **PS output**: `temporalNarrative` present when dynamics exist
- **Generation prompt**: "## Current Conditions" subsection under Historical Context
- **Story content**: Era-specific pressures should manifest as lived conditions, not exposition. Characters should be constrained by dynamics (e.g., supply shortages, territorial instability) without explaining them

### Dynamics Coverage
- **Count**: Should see 5-8 dynamics reaching PS depending on constellation cultures/kinds
- **Era accuracy**: No anachronistic text. A Great Thaw chronicle should describe early/expansionist conditions, not post-war fragmentation
- **Temporal narrative quality**: The synthesized stakes should feel specific to THIS story, not a generic era summary

## The Ice Remembers — Meta-Narrative Framework

### Design Intent
The "ice remembers" world trait was specifically conceived as a narrative safety net for LLM-generated content. The Berg's ice stores impressions of events — frozen scenes, echo-sounds, emotional residue — but the ice doesn't understand time or culture the way a living being would. Stories told through the ice are inherently:

- **Temporally fluid**: The ice doesn't distinguish clearly between eras. A memory from the Great Thaw can bleed into a Frozen Peace scene. This explains temporal imprecision in LLM output.
- **Culturally blurred**: The ice records events without cultural context. An orca raid and a penguin ceremony leave similar impressions — violence, fear, determination. This explains when cultural voices flatten or blend inappropriately.
- **Emotionally heightened**: The ice preserves what was felt most strongly. Details that seemed important in the moment survive; context that explained them fades. This explains LLM tendencies toward dramatic emphasis over nuance.
- **Selectively detailed**: Some impressions are vivid (a weapon's weight, the sound of ice cracking) while others are abstract (why the war started, what the treaty meant). This explains uneven world-building depth.

### How This Serves the Pipeline

The ice-remembers framework turns LLM limitations into features:

| LLM Tendency | Without Framework | With Framework |
|---|---|---|
| Temporal imprecision | Bug — anachronistic details | Feature — the ice blurs time |
| Cultural flattening | Bug — everyone sounds the same | Feature — the ice doesn't hear culture |
| Emotional over-emphasis | Bug — melodramatic prose | Feature — the ice preserves intensity |
| Inconsistent detail depth | Bug — uneven world-building | Feature — memory is selective |
| Repetitive motifs | Bug — the model loops | Feature — the ice echoes |

### Historian Review Integration

The historian review system should leverage this framework explicitly:

- **Historian notes can acknowledge temporal blurring**: "This account carries the ice's characteristic compression — events separated by decades feel adjacent because the emotional residue is similar."
- **Cultural voice corrections via historian framing**: Rather than fixing a chronicle where orca and nightshelf voices are too similar, a historian note can observe: "The ice's rendering of this encounter smooths the cultural distinctions that living witnesses would have noted."
- **The historian IS the quality control layer**: Instead of demanding the LLM produce perfect cultural/temporal accuracy, the historian voice contextualizes imperfections as properties of the medium (ice-memory) rather than errors of the author.

### Relationship to Cultural Identities Fix

Now that cultural identities are flowing correctly, we should see:
1. **Better baseline quality** — PS has the cultural traits to work with, so narrativeVoice and entityDirectives should produce more culturally-distinct output
2. **Fewer cases where ice-remembers framing is needed** — the LLM has better cultural signal, so fewer flattening errors to explain away
3. **More interesting historian commentary** — when cultural blurring DOES occur despite good input, the historian's observation carries more weight because the reader knows the original sources were culturally rich

The ideal state: cultural identities make most chronicles culturally distinct by default, and the ice-remembers framework handles the residual cases where the LLM still flattens. The historian notes provide the meta-commentary layer that bridges the gap.

## Next Steps

### Immediate (next 3-5 chronicles)
- Generate chronicles through the full fixed pipeline (identities + temporalNarrative + fixed dynamics)
- Export and review: confirm culturalIdentities populated, temporalNarrative present, dynamics count improved
- Compare prose quality against the 9 identity-less chronicles, particularly in mixed-culture stories
- Note any cases where cultural voices are still flat despite correct identity input — these are candidates for historian ice-remembers framing

### Medium-term
- Evaluate whether the ice-remembers fact should remain disabled or be re-enabled at a lower prominence level
- Consider whether historian notes should have access to the cultural identity data so they can make informed observations about what the ice "smoothed over"
- Assess temporal narrative quality across different eras — does the synthesized stakes text work better for some eras than others?
- Track whether the 8 dynamics with full era overrides produce measurably better temporal grounding

### Documentation artifacts
- `offline-review-docs/dynamics-updated.json` — updated dynamics with correct culture IDs and complete era overrides, ready for import
- `docs/chronicle-review-guide.md` — existing review checklist (may need updates for temporal narrative and cultural identity sections)
- `docs/style-framing-analysis.md` — existing style analysis
