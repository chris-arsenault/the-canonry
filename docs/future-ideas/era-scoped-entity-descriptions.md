# Era-Scoped Entity Descriptions

## Problem

Backporting chronicles to entity descriptions creates temporal bleed. Entity descriptions accumulate details from all eras into a single flat text blob. When a chronicle is generated for an earlier era, the prompt includes details about events, factions, and conditions that haven't happened yet in that era's timeline. The LLM can't reliably separate past from future because the descriptions have no temporal markers.

Example: An entity description updated by a Frozen Peace chronicle now references Orca Incursion outcomes. When that entity appears in a Great Thaw chronicle, the LLM may incorporate anachronistic details.

The existing prompt includes era timeline context ("The world passed through the Great Thaw. It now exists in the Faction Wars...") and a temporal instruction ("Entity descriptions reflect their CURRENT state — write them as they WERE"), but without markers in the description text, the LLM has to guess what's from which era.

## Proposed Solution: Era Tags on Backported Text

When the backport process appends text to an entity description, prefix it with the source chronicle's era:

```
[Orca Incursion] Deployed the Obelisk during the assault on Terrace Momiou...
[Frozen Peace] Now controls what's left of Nightfall Shelf...
```

The prompt builder then uses the chronicle's target era and the era order (already defined in domain config) to either:
- **Strip** tagged text from future eras before including it in the prompt
- **Annotate** it with `[FUTURE — do not reference]` markers so the LLM can act on it

## Implementation Notes

- Changes needed: backport write path (tag insertion), prompt builder (era-aware filtering)
- Era order comparison is straightforward — eras are already ordered in the domain config
- Existing untagged descriptions remain as-is — only newly backported content gets tags
- Improves gradually as more chronicles are backported
- Degrades gracefully: untagged text passes through without filtering

## Alternatives Considered

**Prompt-side era fence (lighter):** Add explicit exclusion text to the prompt ("do not reference organizations from future eras"). Unreliable — the LLM can't determine what's anachronistic from flat text.

**Era-scoped description snapshots (heavier):** Snapshot each entity's description at each era boundary, serve the era-appropriate snapshot during generation. Full accuracy but requires new storage model and snapshot management. Overkill.

## Status

Tabled. Identified during chronicle review sessions (Feb 2026). Temporal bleed is infrequent enough at current corpus size (~80% complete) that the cost of implementation and re-backporting doesn't justify the fix mid-project. Worth implementing for future iterations or new domain projects.
