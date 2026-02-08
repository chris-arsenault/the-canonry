# Backport Review Guide

This document provides a structured approach for reviewing entity description backports — patches generated from chronicle content that update entity descriptions to reflect narrative events.

**Companion to**: `docs/chronicle-review-guide.md` (single chronicle review), `docs/chronicle-corpus-review-guide.md` (corpus review)

---

## What Backports Do

After a chronicle is generated, the system proposes patches to entity descriptions. These patches integrate chronicle events, world-building inventions, and character developments back into the canonical entity descriptions that feed future generation.

**The goal**: Entity descriptions grow richer over time as chronicles add lore, without drifting into plot summaries or losing their encyclopedic voice.

---

## Review Checklist

### 1. Verbatim Chronicle Lifting

**What to check**: Are phrases copied word-for-word from the chronicle narrative into entity descriptions?

Entity descriptions and chronicle prose serve different purposes. Descriptions are reference documents — they should state facts, properties, and history. Chronicle prose is lived narrative — it dramatizes moments. Lifting dramatic prose into a reference document creates register mismatch.

**Acceptable:**
- Extracting a *mechanic* or *property* that the chronicle dramatized: "The compass tracks fire sealed into living flesh; forge-scars burned deep enough into skin will draw the needle."
- Stating an *event* that occurred: "The mystic ☽'Ilun the Refracted studied the Medallion's carvings and was murdered for what she learned."

**Problematic:**
- Copying poetic/dramatic phrasing verbatim: "crystalline precision frozen forever, readable by anyone who traces the grooves" appearing in both the chronicle and the entity description with near-identical wording.
- Importing the chronicle's metaphors as if they're canonical facts: "rising toward the surface like evidence in a melting glacier" is a narrator's simile, not a property of the artifact.

**Questions to answer:**
- [ ] Can you find any sentence in the proposed patch that appears near-verbatim in the chronicle?
- [ ] Do imported phrases match the description's existing prose register?
- [ ] Are metaphors from the chronicle presented as literal properties?

---

### 2. Cross-Entity Duplication

**What to check**: Does the same phrase, fact, or sentence appear in multiple entity patches from the same chronicle?

This is one of the most common backport failures. A chronicle event involves multiple entities, and the backport system describes the same event in the same words across each affected entity.

**Red flags:**
- Identical event summaries in two or more entity descriptions
- The same list of consequences (e.g., "thirty winters of crimes, three magistrates who quietly resigned") appearing in multiple patches
- Details about Entity A's actions appearing verbatim in Entity B's description

**What to do instead:**
- Each entity's description should reference the shared event *from that entity's perspective*
- Entity A's description mentions the event in terms of what it meant for A
- Entity B's description mentions it in terms of what changed for B
- Shared facts should be stated differently in each, or referenced once in the most relevant entity and alluded to in others

**Questions to answer:**
- [ ] Search the full patch file for repeated phrases across entities
- [ ] Does each entity describe shared events from its own perspective?
- [ ] Would reading two patched descriptions back-to-back feel repetitive?

---

### 3. Single Voice / Register Consistency

**What to check**: Do the inserted passages match the voice of the existing description?

Entity descriptions in this world have a distinctive register: encyclopedic but atmospheric, factual but opinionated, third-person omniscient with a wry observational tone. Backport insertions should be indistinguishable from the surrounding text.

**Voice markers to preserve:**
- Parenthetical asides that reveal social dynamics
- Declarative statements with embedded judgment
- Physical/sensory detail grounding abstract concepts
- Bitter humor and understatement

**Red flags:**
- Plot-summary register: "When X happened, Y did Z, which led to W" — narrative causation chains don't belong in descriptions
- Chronicle-narrator register: dramatic tension, suspense beats, revelation structure
- Over-explanation: spelling out what the original description left evocatively ambiguous

**Questions to answer:**
- [ ] Could you identify which sentences are new without seeing the diff?
- [ ] Do inserted passages use the same sentence rhythms as surrounding text?
- [ ] Is there a register shift between original and inserted material?

---

### 4. Temporal Locking

**What to check**: Do the patches "lock" an entity to a specific moment in time?

Entity descriptions must remain useful across chronicles set at different points in the timeline. A description that says "Nyla currently leads the Claws" is useless for a chronicle set after her confession. A description that says "Nyla is gone and the Claws are leaderless" is useless for a chronicle set before the confession.

**Prefer:**
- Past-tense for events: "Nyla confessed her crimes before the council" (fact, happened)
- Timeless present for properties: "The Medallion maps routes through memory-ice" (it always does this)
- Hedged temporality: "at one point in their history" rather than "currently"
- Layered time: "Once X, then Y, and eventually Z" — this gives the reader the arc without locking to a moment

**Avoid:**
- "currently" / "now" / "at present" for states that may change
- Descriptions that assume a post-event status quo without acknowledging the pre-event state
- Removing pre-event description content to replace it with post-event content (this destroys the entity's history)

**Special case — tense shifts:** If an entity description is rewritten from present tense ("Nyla moves through tunnels") to past tense ("Nyla moved through tunnels"), this is a major temporal lock. It asserts the character is no longer active. This may be valid, but it must be evaluated — does this chronicle's event definitively end the character's active status, or is this just one possible outcome?

**Questions to answer:**
- [ ] Does the patch use "currently," "now," or present-tense language that assumes a specific moment?
- [ ] Would this description work for a chronicle set *before* the events?
- [ ] Was existing timeless/present-tense content replaced with past-tense content?
- [ ] If a tense shift occurred, is the character's status change truly canonical?

---

### 5. Synthesis Quality — Properties vs. Plot

**What to check**: Does the backport extract *reusable world-building* from the chronicle, or does it paste in *plot summary*?

The best backports identify a mechanic, property, relationship, or cultural practice that the chronicle invented during its narrative, and state it as a general fact about the entity. The worst backports narrate what happened in the chronicle as a sequence of events.

**Gold standard:**
Chronicle scene: "Nyla pressed her scarred flipper to the ice. The Berg remembered. Not sound. Not sight. But *pressure*—the emotional residue of violence committed quickly."
Backport: "That scarred flipper could read the ice itself, sensing emotional residue and memory-pressure when pressed to frozen stone."
→ Extracts a *capability* from a *scene*. Reusable. Doesn't narrate the scene.

**Gold standard:**
Chronicle scene: Compass needle bends toward Nyla's forge-scarred flipper.
Backport: "The compass tracks not only fire-cores and burning stores but fire sealed into living flesh; forge-scars burned deep enough into skin will draw the needle and make it sing."
→ Extracts a *property* of the artifact. Future chronicles can use this mechanic.

**Anti-pattern:**
Chronicle plot: Nyla killed ☽'Ilun, framed Mortus~, then confessed.
Backport: "When the mystic ☽'Ilun examined the Medallion and saw Nyla's crimes, Nyla cut her throat. She planted evidence intending to frame Mortus~ and trade his guilt for the Claws' survival. But the Medallion showed Nyla her own past..."
→ This is plot summary. It narrates a sequence of events with causation and character motivation. It reads like a synopsis, not a description.

**Questions to answer:**
- [ ] Does each insertion add a reusable fact, property, or mechanic?
- [ ] Could a future chronicle use the new information without re-narrating this chronicle's plot?
- [ ] Are there multi-sentence narrative sequences that describe "what happened" rather than "what is true"?

---

### 6. Lore Consistency

**What to check**: Do the patches introduce contradictions with existing entity descriptions or cross-entity facts?

Chronicles are creative works — the LLM makes narrative choices that may not align with canonical entity descriptions. When the backport imports those choices, it can overwrite canonical facts.

**Common issues:**
- **Location drift**: Chronicle places an artifact in a different location than the entity description specifies. Backport accepts the chronicle's location as canonical.
- **Capability inflation**: Chronicle gives an entity dramatic new powers for narrative purposes. Backport treats narrative invention as canonical property.
- **Relationship invention**: Chronicle creates connections between entities that don't exist in the graph. Backport enshrines them.
- **Historical rewriting**: Chronicle's creative interpretation of an event differs from the event's own description. Backport overwrites the event description.

**What to verify:**
- Cross-reference patched location names against original entity descriptions
- Check if newly added capabilities contradict existing entity tags or kind
- Verify that named relationships exist in the entity graph
- Compare event descriptions against the event entity's own canonical text

**Questions to answer:**
- [ ] Do location references match between entities? (e.g., if Artifact says "enshrined at Location X," does Location's description agree?)
- [ ] Are newly attributed capabilities consistent with the entity's kind and tags?
- [ ] Do cross-entity references agree? (e.g., if A's patch says "B did X," does B's patch tell the same story?)

---

### 7. Prose Quality — What Was Lost

**What to check**: Did the backport remove good prose to make room for chronicle events?

Backports often need to restructure descriptions to integrate new content. In doing so, they may cut evocative, well-written passages from the original. Every deletion should be justified.

**Watch for:**
- Evocative ambiguity replaced by explicit explanation (removing mystery)
- Bitter humor or dark jokes cut in favor of plot summary
- Atmospheric detail trimmed to fit event narration
- Powerful closing lines weakened or replaced

**Questions to answer:**
- [ ] Is any original text deleted? What was it?
- [ ] Was the deleted text weak/redundant, or was it doing important work?
- [ ] Does the patch's ending land as well as the original's?

---

## Reviewer Workflow

1. **Read the chronicle first** — understand the full narrative so you can identify what the backport is drawing from.

2. **Read each patch's CURRENT and PROPOSED side by side** — identify every insertion, deletion, and modification.

3. **Search for cross-entity duplication** — search the full patch file for repeated phrases.

4. **Check temporal assumptions** — would each patched description work for chronicles set at different points in the timeline?

5. **Evaluate synthesis quality** — for each insertion, classify it as "property extraction" (good) or "plot summary" (problematic).

6. **Verify lore consistency** — cross-reference locations, capabilities, and events across entities.

7. **Assess prose impact** — identify what was removed and whether the trade was worth it.

---

## Scoring Rubric

| Dimension | Score 1-5 | Notes |
|-----------|-----------|-------|
| Verbatim avoidance | | Phrases restated, not copied? |
| Cross-entity independence | | Each entity tells its own version? |
| Voice consistency | | Insertions match existing register? |
| Temporal flexibility | | Description works across timeline? |
| Synthesis over summary | | Properties extracted, not plots narrated? |
| Lore consistency | | No contradictions introduced? |
| Prose preservation | | Good original writing retained? |

**Overall assessment:**
- **5/5 on all**: Seamless enrichment — can't tell what's new
- **4/5 average**: Good synthesis with minor voice or duplication issues
- **3/5 average**: Functional but reads as "chronicle summary pasted in"
- **2/5 average**: Significant duplication, plot summary, or consistency issues
- **1/5 average**: Entity descriptions have become chronicle recaps
