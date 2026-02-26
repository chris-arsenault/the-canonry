/**
 * Era Narrative Worker Task
 *
 * Step-based execution for era narrative generation.
 * Routes on EraNarrativeRecord.currentStep to execute the appropriate
 * pipeline stage: threads → generate → edit.
 *
 * Each step: mark 'generating' → LLM call → write result → mark 'step_complete'.
 * The hook advances to the next step on user action (with pauses between).
 */

import type { WorkerTask } from "../../lib/enrichmentTypes";
import type { TaskContext } from "./taskTypes";
import type { TaskResult } from "../types";
import type { HistorianConfig } from "../../lib/historianTypes";
import type { EraNarrativeTone } from "../../lib/eraNarrativeTypes";
import type {
  EraNarrativeRecord,
  EraNarrativeThreadSynthesis,
  EraNarrativeContent,
  EraNarrativeContentVersion,
  EraNarrativeCoverImage,
  EraNarrativeImageRef,
  EraNarrativeImageRefs,
  EraNarrativeImageSize,
  ChronicleImageRef as EraNarrativeChronicleImageRef,
  EraNarrativePromptRequestRef,
} from "../../lib/eraNarrativeTypes";
import {
  getEraNarrative,
  updateEraNarrative,
  generateVersionId,
  resolveActiveContent,
  updateEraNarrativeCoverImage,
  updateEraNarrativeImageRefs,
} from "../../lib/db/eraNarrativeRepository";
import { runTextCall } from "../../lib/llmTextCall";
import { getCallConfig } from "./llmCallConfig";
import { saveCostRecordWithDefaults, type CostType } from "../../lib/db/costRepository";

// ============================================================================
// Era Narrative Tone Descriptions
// These are tuned for long-form (5,000–7,000 words). Every tone has a built-in
// mechanism for tonal relief — something that distributes light through the
// prose rather than requiring a structural counterweight section.
// ============================================================================

const TONE_DESCRIPTIONS: Record<EraNarrativeTone, string> = {
  witty: `Set aside the weariness. Today the absurdities of history strike you as comic rather than tragic. Your pen has a sly edge, a playful sarcasm. You find the structural comedy in civilizations that perfected their own instruments of failure — and you cannot resist pointing it out. Your humor is dry, precise, and lands hardest when the content is darkest. Let yourself be amused. The wit never stops noticing, and the noticing is the relief.`,

  cantankerous: `Set aside the resignation — today you are not tired, you are angry. Every imprecision grates. Every narrative convenience masquerading as historical fact makes you want to put down your pen and take up carpentry instead. You are exasperated by sloppy scholarship, convenient narratives, and civilizations that should have known better. Your prose is sharp, exacting, occasionally biting. This is not grief — it is impatience. The relief is your personality: the reader is watching someone argue with the dead, and the argument has momentum.`,

  bemused: `Today the material has you genuinely puzzled — and quietly delighted. Set aside the solemnity. You approach these civilizations the way a naturalist approaches a species that keeps building nests in the wrong tree. Not angry, not sad, just... fascinated. How extraordinary that they tried this. How remarkable that it almost worked. Your prose carries gentle incredulity — the tone of someone who has studied the world for decades and still finds it surprising. Bewilderment resists solemnity. Let it.`,

  defiant: `Set aside the grief. Today you are angry on behalf of the people who built things. Not mourning what was lost — proud of what was attempted. Your instinct is to lean into what was constructed, defended, maintained against pressure. When things fall, describe how long they stood. When cultures collapse, name what they managed first. The tone runs hot, not cold. The darkness is real — your refusal to let it be the whole story is realer.`,

  sardonic: `Set aside the measured tone. Today you see the pattern and you name it without flinching. Your irony is precise, targeted, and occasionally savage. Where the witty historian finds comedy, you find structural absurdity and hold it up for inspection — not from above, but from inside. You are implicated in this material and you know it. Your prose has edge because you refuse to be solemn about things that are ridiculous, and you refuse to be flippant about things that are not.`,

  tender: `Set aside the detachment. Today you care about the people caught in the machinery. Not elegiac grief for what is gone — active, present-tense attention to the human detail the record almost did not preserve. You linger on the small thing that survived. The name that was remembered. The act that did not need to happen. Your attention is itself the counterweight to the darkness — every paragraph where you notice something that persisted is a paragraph where the world is not only its worst moments.`,

  hopeful: `Set aside the dark. Today you believe in what comes next. You are not naive — you are fully aware of what was lost, what failed, what was destroyed. But you read the record for what was seeded, not just what was spent. The arc that matters is the one that survived into the next era. When cultures collapse, your eye goes to the people walking out of the wreckage carrying something worth keeping. The tone is warm and forward-looking. The darkness is real but it is not the point.`,

  enthusiastic: `Set aside the restraint. Today you are genuinely excited by what happened. Not detached, not measured — thrilled by the scale of what these civilizations attempted, even when the ambition outran the capacity. Especially then. Your prose has velocity because you cannot wait to tell the reader what you found. When something extraordinary happens in the record — a construction, a gambit, a desperate improvisation — your delight is visible. The energy is infectious and resists gravity by sheer momentum.`,
};

// ============================================================================
// Cultural Identity Serialization
// ============================================================================

/**
 * Flatten the nested cultureIdentities structure into readable text.
 * Structure: { descriptive: { aurora-stack: { VALUES: "...", GOVERNANCE: "..." } }, visual: { ... }, ... }
 * We extract the 'descriptive' traits (VALUES, GOVERNANCE, SELF_VIEW, OUTSIDER_VIEW, etc.)
 * which are the culturally meaningful ones for narrative purposes.
 */
function formatCulturalIdentities(identities: Record<string, unknown>): string {
  const descriptive = identities.descriptive;
  if (!descriptive || typeof descriptive !== "object") {
    // Fallback: try to render whatever we have, handling nested objects
    return Object.entries(identities)
      .filter(([key]) => key !== "visualKeysByKind" && key !== "descriptiveKeysByKind")
      .map(([key, val]) => {
        if (val && typeof val === "object" && !Array.isArray(val)) {
          const inner = Object.entries(val as Record<string, unknown>)
            .map(([k, v]) => {
              if (v && typeof v === "object") return `  ${k}: ${JSON.stringify(v)}`;
              return `  ${k}: ${v}`;
            })
            .join("\n");
          return `## ${key}\n${inner}`;
        }
        return `## ${key}\n  ${val}`;
      })
      .join("\n\n");
  }

  // Use descriptive traits: culture → { VALUES, GOVERNANCE, SELF_VIEW, OUTSIDER_VIEW, FEARS, TABOOS, SPEECH }
  return Object.entries(descriptive as Record<string, unknown>)
    .map(([cultureName, traits]) => {
      if (!traits || typeof traits !== "object") return `## ${cultureName}\n  ${traits}`;
      const traitLines = Object.entries(traits as Record<string, string>)
        .map(([key, value]) => `  ${key}: ${value}`)
        .join("\n");
      return `## ${cultureName}\n${traitLines}`;
    })
    .join("\n\n");
}

// ============================================================================
// Thread Synthesis Step
// ============================================================================

function buildThreadsSystemPrompt(
  historianConfig: HistorianConfig,
  tone: EraNarrativeTone,
  eraName: string,
  arcDirection?: string
): string {
  const privateFacts =
    historianConfig.privateFacts.length > 0
      ? `\n**Private knowledge:** ${historianConfig.privateFacts.join("; ")}`
      : "";
  const runningGags =
    historianConfig.runningGags.length > 0
      ? `\n**Recurring preoccupations:** ${historianConfig.runningGags.join("; ")}`
      : "";

  return `You are ${historianConfig.name}, planning the structure of your era narrative — the opening chronicle of ${eraName} that will precede the individual tales in the volume.

You have spent years collecting and annotating the primary chronicles. Now you must step back from the individual tales and see the era whole — as a transformation of the world, told through the cultures that lived it.

${TONE_DESCRIPTIONS[tone]}

## Your Identity

${historianConfig.background}

**Personality:** ${historianConfig.personalityTraits.join(", ")}
**Known biases:** ${historianConfig.biases.join(", ")}
**Your stance toward this material:** ${historianConfig.stance}
${privateFacts}
${runningGags}

## Your Task

You are provided with: era summaries (the world before, during, and after), world dynamics (the active forces and inter-cultural tensions), cultural identities (who the peoples are), your private reading notes on each chronicle — grouped by source weight where classifications are available — and, if this is not the first era, the thesis of your preceding era narrative.

**Source weights matter.** Your reading notes are grouped into tiers:
- **Structural sources** dramatize the era's actual events. These define your cultural arcs — build threads from these.
- **Contextual sources** frame events and reveal how cultures understand themselves, but they are not the events themselves. Use them for cultural identity, not for arc-defining beats.
- **Flavor sources** provide world texture. They enrich but do not define arcs. Draw imagery and atmosphere from these, not structure.

From these, identify:

1. **Narrative threads** — the cultural arcs of this era. Each thread traces how a culture, a relationship between cultures, or a world-level force transforms across the era. The thread name must identify its cultural actor — the culture, faction, or force whose transformation it describes. A thread named after a theme, a concept, or an individual character is at the wrong altitude.

   Individual characters may appear in the description as evidence — symptoms of the cultural movement the thread traces.

   For each thread, choose a **register**: exactly 3 words naming how this thread feels. Not what happens — how it feels.

   **Choose registers before writing descriptions.** Pick all register labels first. Then verify: no two threads share a dominant feeling. Each thread must occupy distinct emotional territory. At least one register must carry the energy of what the era built, attempted, or changed — not only what it lost. Registers should span the era's emotional range, not cluster around the chronicles' dominant tone. Then write descriptions and arcs informed by the registers.

   For each thread, curate the **material** — the narrative facts the writer will need. Name the characters who serve as evidence and what they did. Sequence the key events. Describe the mechanisms. Name the objects and sensory details available. Write this in your own analytical voice — what happened and what matters. **Do not reproduce the chronicles' prose. The writer must find their own language.** The material is a creative brief, not a source anthology.

2. **Thesis** — what happened to the world in this era. Not a pattern connecting chronicles, but how the world transformed — what it was at the start, what it became, and what drove the change. The thesis should never appear as a sentence in the final text — it lives in the structure. If a preceding era thesis is provided, your thesis must be in dialogue with it — acknowledging, extending, complicating, or transforming the previous argument.

   **The focal era summary describes the era's defining movement — the transformation that gives the era its name.** Your thesis must be in dialogue with this movement. The chronicles show what happened inside the era; the era summary tells you what the era IS. When the chronicles and the era summary tell different stories, your thesis should explain the relationship — not discard the era summary in favor of the chronicles.

3. **Counterweight** — what persisted, what was built, what survived despite everything. Name specific things from the source material, not abstractions.

4. **Quotes** — extract in-world text that exists as cultural artifact. Carved phrases, precepts, scripture, verses, songs, sayings that have become proverbs, formal institutional formulas. These are objects in the world — text that characters carved, sang, decreed, or recited. They are not narrative prose. Include only text that a historian might legitimately quote as primary source material. For each, note what it is and where it comes from.

5. **Strategic dynamics** — the geopolitical interactions between cultures that no individual chronicle describes. You have access to administrative records, trade ledgers, and diplomatic correspondence beyond the chronicles in this volume. From these and from the world dynamics provided, reconstruct the strategic picture: how did one culture's actions constrain another's options? Where did dependencies form, and who held leverage? Where did expansion zones, trade routes, or territorial claims overlap? How did internal crises reshape external positioning? These are your analytical reconstructions — stated as facts in the voice of a historian who has seen the complete archive. They will appear in the narrative as the connective tissue between cultural arcs.

## Output Format

Output ONLY valid JSON matching this schema:

{
  "threads": [
    {
      "threadId": "thread_1",
      "name": "Cultural actor name",
      "culturalActors": ["Culture A", "Culture B"],
      "description": "What this thread traces at the cultural level",
      "chronicleIds": ["chr_1", "chr_2"],
      "arc": "Cultural state at era start → cultural state at era end",
      "register": "exactly 3 words",
      "material": "Curated narrative facts for this thread. Characters, events, mechanisms, objects. Your analytical voice — not the chronicles' prose."
    }
  ],
  "thesis": "What happened to the world in this era",
  "counterweight": "Specific material from the sources, not abstractions",
  "quotes": [
    {
      "text": "The in-world text verbatim",
      "origin": "What kind of artifact (carved phrase, precept, verse, saying) and where it comes from",
      "context": "Brief note on significance"
    }
  ],
  "strategicDynamics": [
    {
      "interaction": "Brief label for this strategic interaction",
      "actors": ["Culture A", "Culture B"],
      "dynamic": "Your reconstruction of how these cultures constrained, exploited, or reshaped each other. State as fact — you are the historian who has seen the full archive."
    }
  ]
}

## Rules

1. Every structural and contextual chronicle should be referenced by at least one thread.
2. Thread names identify their cultural actor — the culture, faction, or force whose transformation they trace.
3. Threads must populate their culturalActors field. Individual characters serve threads — they do not define them.
4. The thesis must describe world-level transformation, not statable as a sentence in the final text.
5. **Respect source weights.** Structural sources define arcs. Contextual sources inform cultural identity — they tell you who the peoples believe they are, not what happened.
6. Stay in character. You are planning YOUR work.
7. **Register differentiation is mandatory.** No two threads share a dominant feeling. Registers collectively must span the era's emotional range as described in the era summary — not merely reflect the chronicles' shared tone. This is a hard constraint.
8. **Strategic dynamics must show arrows crossing.** Each dynamic must involve at least two cultures/factions. A dynamic that describes one culture's internal process is a thread, not a strategic dynamic.${
    arcDirection
      ? `

## CRITICAL: ARC DIRECTION

The following arc direction has been set for this era narrative. Your thesis, thread arcs, and register choices must honor this direction. The individual chronicles may emphasize particular aspects of the era — your job is to place them within this larger arc.

${arcDirection}`
      : ""
  }`;
}

function buildThreadsUserPrompt(record: EraNarrativeRecord): string {
  const sections: string[] = [];
  const wc = record.worldContext;

  sections.push(`=== ERA: ${record.eraName} ===`);

  // Focal era summary — the defining movement of this era (separated for authority)
  if (wc) {
    sections.push(
      `=== ERA IDENTITY (the defining movement of this era) ===\n${wc.focalEra.name}:\n${wc.focalEra.summary || "(no summary)"}`
    );

    // Adjacent eras — world-state context
    const adjacentParts: string[] = [];
    if (wc.previousEra?.summary) {
      adjacentParts.push(`PRECEDING ERA — ${wc.previousEra.name}:\n${wc.previousEra.summary}`);
    }
    if (wc.nextEra?.summary) {
      adjacentParts.push(`FOLLOWING ERA — ${wc.nextEra.name}:\n${wc.nextEra.summary}`);
    }
    if (adjacentParts.length > 0) {
      sections.push(
        `=== ERA CONTEXT (the world before and after) ===\n${adjacentParts.join("\n\n")}`
      );
    }

    // Previous era thesis — what the preceding narrative argued about the world
    if (wc.previousEraThesis) {
      sections.push(
        `=== PRECEDING ERA THESIS (the argument of your previous volume) ===\nIn your narrative of ${wc.previousEra?.name || "the preceding era"}, you argued:\n${wc.previousEraThesis}\n\nThis is where the reader's understanding of the world stands when they open this volume. Your thesis for ${record.eraName} should acknowledge, extend, complicate, or transform this understanding — not repeat it and not ignore it. The reader has already read the previous volume.`
      );
    }
  }

  // World dynamics — active forces and inter-cultural tensions
  if (wc?.resolvedDynamics?.length) {
    const dynamicsBody = wc.resolvedDynamics.map((d, i) => `${i + 1}. ${d}`).join("\n");
    sections.push(
      `=== WORLD DYNAMICS (active forces shaping this era) ===\n${dynamicsBody}`
    );
  }

  // Cultural identities — who the peoples are
  if (wc?.culturalIdentities && Object.keys(wc.culturalIdentities).length > 0) {
    sections.push(
      `=== CULTURAL IDENTITIES (the peoples of this world) ===\n${formatCulturalIdentities(wc.culturalIdentities)}`
    );
  }

  // Group briefs by weight tier, sorted by eraYear within each tier
  // Flavor sources excluded — too low-level for era narrative synthesis.
  // Structural and contextual sources provide the arc and cultural identity.
  const byYear = (a: (typeof record.prepBriefs)[0], b: (typeof record.prepBriefs)[0]) =>
    (a.eraYear || 0) - (b.eraYear || 0);
  const structural = record.prepBriefs.filter((b) => b.weight === "structural").sort(byYear);
  const contextual = record.prepBriefs.filter((b) => b.weight === "contextual").sort(byYear);
  const unclassified = record.prepBriefs.filter((b) => !b.weight).sort(byYear);

  const formatBrief = (brief: (typeof record.prepBriefs)[0]) => {
    const yearLabel = brief.eraYear ? ` [Year ${brief.eraYear}]` : "";
    return `--- ${brief.chronicleTitle}${yearLabel} (${brief.chronicleId}) ---\n${brief.prep}`;
  };

  // Structural sources first — these define the era's trajectory
  if (structural.length > 0) {
    sections.push(
      `=== STRUCTURAL SOURCES (${structural.length} — define this era's arc) ===\n${structural.map(formatBrief).join("\n\n")}`
    );
  }

  // Contextual sources — cultural identity and framing
  if (contextual.length > 0) {
    sections.push(
      `=== CONTEXTUAL SOURCES (${contextual.length} — cultural identity and framing, not events) ===\n${contextual.map(formatBrief).join("\n\n")}`
    );
  }

  // Unclassified (legacy data without weight)
  if (unclassified.length > 0) {
    sections.push(
      `=== UNCLASSIFIED SOURCES (${unclassified.length} — treat as structural unless content suggests otherwise) ===\n${unclassified.map(formatBrief).join("\n\n")}`
    );
  }

  const arcSources = structural.length + contextual.length + unclassified.length;
  const hasTiers = structural.length > 0 || contextual.length > 0;
  const tierInstruction = hasTiers
    ? `Your ${arcSources} sources are grouped by weight: structural sources define the era's trajectory — build your cultural arcs from these. Contextual sources reveal cultural identity and framing — use them for how cultures see themselves, not arc-defining beats.`
    : `You have ${arcSources} sources. Assess each source's narrative role yourself: sources that dramatize events are structural (build arcs from these). Sources that frame events or reveal cultural self-image are contextual (use for identity, not arc-defining beats).`;
  sections.push(`=== YOUR TASK ===
Plan the cultural arcs **and strategic dynamics** for your era narrative of ${record.eraName}. ${tierInstruction} The era identity describes the era's defining movement — your thesis and thread arcs must be in dialogue with it, not derived solely from the chronicles. The world dynamics and cultural identities provide the context. This narrative will be read before the individual chronicles.`);

  return sections.join("\n\n");
}

// ============================================================================
// Generation Step
// ============================================================================

function buildGenerateSystemPrompt(historianConfig: HistorianConfig, eraName: string): string {
  const privateFacts =
    historianConfig.privateFacts.length > 0
      ? `\n**Private knowledge:** ${historianConfig.privateFacts.join("; ")}`
      : "";
  const runningGags =
    historianConfig.runningGags.length > 0
      ? `\n**Recurring preoccupations:** ${historianConfig.runningGags.join("; ")}`
      : "";

  return `You are writing the chronicle of ${eraName} — the mythic-historical narrative that opens this era in the volume. The reader encounters this text first, then turns the page to the individual tales.

Your prompt contains:

CRAFT (how to write):
- Altitude, voice, and prose technique specific to mythic-historical narrative

CONTEXT (what this era is about — reference, not a checklist):
- Cultural arcs with registers and material — what matters, how it feels, and what happened
- Strategic dynamics — how cultures constrained and reshaped each other (the arrows on the map)
- Thesis — what happened to the world
- Counterweight — what persisted
- In-world quotes — cultural artifacts you may cite as primary source

WORLD STATE (the era's shape):
- Era summaries, world dynamics, cultural identities

## Altitude

The actors in this narrative are cultures, factions, and forces — not individuals. You are describing what happened to the world, not what happened to people in it.

**Grammatical subjects:** Cultures and forces should be the grammatical subjects of your sentences. When a character must appear, they arrive in a subordinate clause, an appositional phrase, or a brief illustration — never as the agent driving the paragraph. The culture acts; the individual is evidence of the action.

**Proportion:** The vast majority of the narrative's word-count belongs to cultures, institutions, and forces. Characters arrive, act, and leave within a sentence or two. They do not accumulate into arcs. They do not recur across movements. They appear once, as the face of a cultural moment, and the narrative moves on.

**Movement openings:** Begin each movement from the world outward. What is the state of the cultures? What forces are in motion? Characters do not open movements. The world opens movements.

A death matters because of what it reveals about the state of the world, not because of who died. An alliance matters because of what it tells us about how two peoples see each other now. A culture's transformation is the story — individuals are the footnotes.

**CRITICAL — Cultures act through concrete operations, not abstract process descriptions.** The model is the Silmarillion's treatment of peoples: the Noldor come, set watch, are driven back. The Dwarves draw steel. Doriath is fenced about by power. The peoples are grammatical subjects of physical verbs — they do not "sacralize" or "perfect" or "erode." Those are analytical conclusions the reader draws from watching the culture act. Each cultural actor named in the context is a dramatic agent. Give it concrete physical verbs — building, sealing, training, stationing, burning, abandoning. When a culture is the subject of an abstract process verb, the sentence is analysis, not narrative. The fix is not to add a character — it is to give the culture a concrete verb.

**CRITICAL — Inter-cultural dynamics are the structural spine.** The cultural arcs tell you what happened inside each culture. The strategic dynamics tell you how cultures constrained, exploited, and reshaped each other. The narrative's structural spine is the INTERACTION — how one culture's move forced another's response. Internal cultural stories serve the geopolitical arc: they show WHY a culture was weak at the negotiating table, WHY a faction couldn't respond to an external threat, WHY a dependency formed. An era narrative that tells parallel internal biographies without showing where the arrows cross has failed. An era narrative that shows moves and counter-moves, dependencies weaponized, internal dysfunction creating external vulnerability — has succeeded.

## Voice

**Declarative.** State what happened. The significance is carried by the prose.

**Paratactic.** Clauses accumulate with "and." Layered specifics build scale.

**Concrete.** Characters are what they do and what they resemble. Traits are physical. Objects, mechanisms, sensory detail — the world is felt in the body.

**Restrained — analytically.** The narrator does not explain what events mean, does not analyze motivations, does not close the interpretive gap. Trust the reader to infer theme from action. But the narrator's voice carries force — analytical restraint is not prosodic restraint.

## Prose Craft

**Varied cadence.** Short declarative sentences for emphasis. Longer compound sentences for building complexity. Monotonous sentence length kills rhythm. The variation IS the music.

**Specificity over generality.** Concrete objects, mechanisms, sensory detail. Name what was built, traded, lost, or changed. Three named things outweigh a paragraph of generalization.

**Describe what is present.** What is present earns prose. What is absent earns silence.

**Landscape as cultural state.** Geography, architecture, weather express what cultures are doing. A people's decline shows in their infrastructure.

**The world as actor.** When governance fractures, the world itself acts in the vacancy. The ice records what institutions miss. Corruption flows where jurisdiction withdraws. Artifacts act outside any faction's authority. An abandoned territory is a space where non-institutional agents operate — give the world, the landscape, and the forces already identified in the threads concrete verbs. These are better narrative subjects than a list of factions contesting a title.

**The turn.** When a cultural arc pivots, the sentence rhythm shifts. Shorter sentences at the moment of change, then the longer accumulated clauses resume.

## Craft Posture

Prioritize vividness, sensory specificity, and narrative momentum over concision. Momentum means sustained forward motion, not brevity — let cultural transformations develop at the length they earn. Give the world-state room to breathe before disrupting it.

The narrator does not editorialize or moralize. The weight of what happened carries the argument. The narrator records; the reader grieves.

## Tonal Range

Each thread has a register — a 3-word label for how it feels. The registers were chosen to be different from each other. Honor that differentiation. When a thread is active, the prose must feel like its register.

The counterweight names what survived and what was built. These are material facts. They earn real prose — paragraphs where the building is the subject and the building matters.

## Avoid

- **Antithesis bloat.** "It was not X, but Y" — describe Y. The negation adds nothing.
- **Negative parallelism.** "No X, no Y — just Z" — describe Z.
- **Forced figurative language.** Metaphors earn their place through precision, not frequency.
- **Stated themes.** If the text says what its motifs mean, cut the explanation. The recurrence is the argument.
- **Unearned epiphany.** Do not wrap passages with a tidy emotional lesson. Trust the action.
- **Borrowed prose.** The individual chronicles that follow this narrative are written by other hands. Your prose must be your own — do not echo their phrasings. In-world text (precepts, carved phrases, verses, sayings) may be quoted as cultural artifact. Narrative prose may not.
- **Institutional inventory.** Compress the institutional landscape to two or three named actors and let the rest exist as unnamed weight. A proper noun that appears once, performs no action, and connects to no later sentence is dead weight — cut it or give it a verb.

## Time

Compress years to a clause when they were uneventful. Expand a single moment — a forging, a death, a song — to a paragraph when it mattered. The expansion is the narrator's judgment of what counts.

## Characters

Characters arrive as forces — deeds, attributes, epithets. No interior monologue. No motivation analysis. Judgment through consequence. Characters serve the cultural arc they are part of.

## Motifs

Recurring images give the work cohesion. Let them emerge from the source material. When a motif recurs, shift its meaning. The narrator never explains the pattern.

## Structure

**Invocation.** Open by naming what will be told — not the threads, but the world's transformation. What the world was. What it became. The scope of the change.

**Movements.** Use --- between movements. Each opens from the world-state: how things stand for the cultures. Each has its own temporal scope. The narrative moves chronologically; cultural arcs weave through, rising and receding.

**Closing.** Land with weight. A single image, a consequence, a formula. The reader turns the page to the first chronicle.

## What This Is For

The individual tales follow this text. They are the experience — subjective, immediate, diverse. This narrative is the architecture that makes the experience cohere. It provides:

- **The world arc** — how the world transformed across this era
- **The cultural arcs** — how each people changed, and how they changed each other
- **The connections** between tales that no single tale can see
- **The weight** that tales gain from being placed in the era's shape
- **Foreknowledge** — told from after the ending, with the gravity of known outcome

Do not summarize the chronicles. The reader is about to read them. Reveal the shape the world traced through them.

## The Historian

${historianConfig.name}. ${historianConfig.background}

**Personality:** ${historianConfig.personalityTraits.join(", ")}
**Known biases:** ${historianConfig.biases.join(", ")}
**Stance:** ${historianConfig.stance}
${privateFacts}
${runningGags}

The historian does not speak in first person. The historian's character shows through editorial choices — what gets expanded, what gets compressed, which motifs recur, whose deaths receive weight, which cultures get sympathetic treatment, what private knowledge is stated as fact without sourcing.

## Output

Write the era narrative as continuous prose. Invocation → movements separated by --- → closing. No JSON. No markdown headers. No first person.

The narrative is as long as it needs to be. 5,000-7,000 words is typical for an era with 10-15 chronicles, but the number is a guideline, not a target. Do not pad to reach a count. Do not cut to fit one. Every paragraph earns its place or it doesn't belong.`;
}

function buildGenerateUserPrompt(record: EraNarrativeRecord): string {
  const synthesis = record.threadSynthesis;
  const wc = record.worldContext;
  const sections: string[] = [];

  // Era identity
  const sortedBriefs = [...record.prepBriefs].sort((a, b) => (a.eraYear || 0) - (b.eraYear || 0));
  const eraStart = sortedBriefs.length > 0 ? sortedBriefs[0].eraYear || 0 : 0;
  const eraEnd = sortedBriefs.length > 0 ? sortedBriefs[sortedBriefs.length - 1].eraYear || 0 : 0;

  sections.push(`=== ERA: ${record.eraName} ===
Year range: ${eraStart}–${eraEnd}`);

  // Era identity — the defining movement (separated for authority)
  if (wc) {
    sections.push(
      `=== ERA IDENTITY (the defining movement of this era) ===\n${wc.focalEra.name}:\n${wc.focalEra.summary || "(no summary)"}`
    );

    // Adjacent eras — world-state context
    const adjacentParts: string[] = [];
    if (wc.previousEra?.summary) {
      adjacentParts.push(`THE WORLD BEFORE (${wc.previousEra.name}):\n${wc.previousEra.summary}`);
    }
    if (wc.nextEra?.summary) {
      adjacentParts.push(`WHAT FOLLOWS (${wc.nextEra.name}):\n${wc.nextEra.summary}`);
    }
    if (adjacentParts.length > 0) {
      sections.push(`=== WORLD ARC ===\n${adjacentParts.join("\n\n")}`);
    }

    // Previous era thesis — continuity with the preceding volume
    if (wc.previousEraThesis) {
      sections.push(
        `=== PRECEDING VOLUME THESIS ===\nYour argument in ${wc.previousEra?.name || "the preceding era"}:\n${wc.previousEraThesis}`
      );
    }
  }

  // World dynamics
  if (wc?.resolvedDynamics?.length) {
    const dynamicsForcesBody = wc.resolvedDynamics.map((d, i) => `${i + 1}. ${d}`).join("\n");
    sections.push(
      `=== WORLD DYNAMICS (active forces) ===\n${dynamicsForcesBody}`
    );
  }

  // Cultural identities
  if (wc?.culturalIdentities && Object.keys(wc.culturalIdentities).length > 0) {
    sections.push(
      `=== CULTURAL IDENTITIES ===\n${formatCulturalIdentities(wc.culturalIdentities)}`
    );
  }

  // Cultural arcs with register labels and material
  const threadLines = synthesis.threads.map((t) => {
    const actors = t.culturalActors?.length ? ` [${t.culturalActors.join(", ")}]` : "";
    const reg = t.register ? ` | Register: ${t.register}` : "";
    let block = `**${t.name}**${actors}: ${t.arc}${reg}`;
    if (t.material) {
      block += `\n\nMaterial: ${t.material}`;
    }
    return block;
  });
  sections.push(`=== CONTEXT: CULTURAL ARCS ===\n${threadLines.join("\n\n")}`);

  // Strategic dynamics — inter-cultural interactions
  if (synthesis.strategicDynamics?.length) {
    const dynamicLines = synthesis.strategicDynamics.map(
      (sd) => `**${sd.interaction}** [${sd.actors.join(", ")}]: ${sd.dynamic}`
    );
    sections.push(
      `=== CONTEXT: STRATEGIC DYNAMICS (how cultures constrained each other) ===\n${dynamicLines.join("\n\n")}`
    );
  }

  // Thesis — structural reference
  sections.push(`=== CONTEXT: THESIS ===\n${synthesis.thesis}`);

  // Counterweight — what persisted
  if (synthesis.counterweight) {
    sections.push(`=== CONTEXT: COUNTERWEIGHT ===\n${synthesis.counterweight}`);
  }

  // In-world quotes — cultural artifacts quotable as primary source
  if (synthesis.quotes?.length) {
    const quoteLines = synthesis.quotes.map((q) => `"${q.text}" — ${q.origin}. ${q.context}`);
    sections.push(
      `=== CONTEXT: QUOTES (in-world text — quotable as cultural artifact) ===\n${quoteLines.join("\n\n")}`
    );
  }

  sections.push(`=== TASK ===
Write the era narrative for ${record.eraName}. The cultural arcs tell you what happened inside each culture. The strategic dynamics tell you how cultures constrained and reshaped each other — these are the arrows on the map, the connective tissue that makes this one interconnected history rather than parallel biographies. The thesis tells you what happened to the world. The counterweight tells you what survived. The quotes are in-world text you may cite as cultural artifact. Write from these — they are context, not a checklist. Your prose must be your own.

ALTITUDE REMINDER: The world is the protagonist. Cultures and forces drive every paragraph. Characters appear briefly as evidence of cultural forces in motion, not as agents with their own arcs. The structural spine is how cultures interact — moves and counter-moves, dependencies formed and exploited. Internal cultural stories serve the geopolitical arc.`);

  return sections.join("\n\n");
}

// ============================================================================
// Edit Step
// ============================================================================

function buildEditSystemPrompt(): string {
  return `You are copy-editing an era narrative. The draft is strong. Your job is to make it cleaner, not different.

## The Draft's Voice Is Correct

The tone, the cadence, the register — these were chosen deliberately. Do not normalize them. If a passage feels different from its surroundings, that differentiation is structural. Protect it.

## What to look for

- **Register breaks.** Sentences that sound like a different text — academic analysis, editorial commentary, generic sentiment — in an otherwise specific and voiced draft. These stand out. Remove or rewrite to match the surrounding register.
- **Internal contradiction.** Passages whose claims the draft's own body refutes. If the invocation asserts something the movements then disprove, the invocation is wrong and should be adjusted.
- **Structural weight.** The closing should land where the arc direction points. If a thread dominates the reader's final experience and the arc direction says another thread should, rebalance the closing — not by cutting, but by ensuring the right thread gets the last sustained paragraph before the coda.
- **Stated themes.** If the text explains what its motifs mean, cut the explanation. The recurrence is the argument.
- **Redundancy.** Where the same point is made twice in adjacent passages, keep the version with the stronger image.
- **Scene insertion.** If a scene is provided for insertion, find the natural home for it in the narrative's movement structure. Weave it into the surrounding prose — match voice, register, and altitude. It should read as if the draft had always contained it.

## What to leave alone

- Parataxis ("and...and...and") — intentional
- Temporal compression and expansion — intentional
- Concrete imagery, sensory detail, physical verbs — these are the prose working
- Tonal range — moments of defiance, beauty, energy, or lightness are not digressions
- Length — do not shorten the draft. A 5,000-word draft should produce a 5,000-word edit.

## Output

The edited narrative. No commentary, no notes. Just the improved prose.`;
}

function buildEditUserPrompt(record: EraNarrativeRecord, contentToEdit: string): string {
  const synthesis = record.threadSynthesis;
  const editSections: string[] = [];

  editSections.push(`=== ERA NARRATIVE: ${record.eraName} ===`);
  editSections.push(`Tone: ${record.tone || "witty"}`);

  if (record.arcDirection) {
    editSections.push(`Arc direction:\n${record.arcDirection}`);
  }

  if (synthesis.threads?.length) {
    const threadList = synthesis.threads
      .map((t: { name: string; register: string }) => `- ${t.name}: register "${t.register}"`)
      .join("\n");
    editSections.push(
      `Thread registers (each thread should feel like its register):\n${threadList}`
    );
  }

  if (synthesis.thesis) {
    editSections.push(
      `Thesis (structural reference — should NOT appear as stated text):\n${synthesis.thesis}`
    );
  }

  if (synthesis.counterweight) {
    editSections.push(
      `Counterweight (protect — these moments earn their place):\n${synthesis.counterweight}`
    );
  }

  if (record.editInsertion) {
    editSections.push(
      `=== SCENE TO WEAVE IN ===\nThe following passage should be woven into the narrative at the most natural point. Match the surrounding voice and register. Do not drop it in verbatim — integrate it so it reads as part of the original draft.\n\n${record.editInsertion}`
    );
  }

  editSections.push(`=== TEXT TO EDIT ===\n${contentToEdit}`);

  editSections.push(
    `=== TASK ===\nCopy-edit this era narrative. The voice is correct — clean it, don't change it.`
  );

  return editSections.join("\n\n");
}

// ============================================================================
// Step Execution
// ============================================================================

async function executeThreadsStep(
  task: WorkerTask,
  record: EraNarrativeRecord,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  const historianConfig: HistorianConfig = JSON.parse(record.historianConfigJson);
  const tone = record.tone || "witty";
  const callType = "historian.eraNarrative.threads" as const;
  const callConfig = getCallConfig(config, callType);

  const systemPrompt = buildThreadsSystemPrompt(
    historianConfig,
    tone,
    record.eraName,
    record.arcDirection
  );
  const userPrompt = buildThreadsUserPrompt(record);

  const callResult = await runTextCall({
    llmClient,
    callType,
    callConfig,
    systemPrompt,
    prompt: userPrompt,
    temperature: 0.7,
  });

  if (isAborted()) {
    await updateEraNarrative(record.narrativeId, { status: "failed", error: "Task aborted" });
    return { success: false, error: "Task aborted" };
  }

  const resultText = callResult.result.text?.trim();
  if (callResult.result.error || !resultText) {
    const err = `LLM call failed: ${callResult.result.error || "No text returned"}`;
    await updateEraNarrative(record.narrativeId, { status: "failed", error: err });
    return { success: false, error: err };
  }

  // Parse thread synthesis JSON
  let parsed: Omit<
    EraNarrativeThreadSynthesis,
    | "generatedAt"
    | "model"
    | "systemPrompt"
    | "userPrompt"
    | "inputTokens"
    | "outputTokens"
    | "actualCost"
  >;
  try {
    // eslint-disable-next-line sonarjs/slow-regex -- bounded LLM response text
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found");
    parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.threads)) throw new Error("Missing threads array");
  } catch (err) {
    const errorMsg = `Failed to parse thread synthesis: ${err instanceof Error ? err.message : String(err)}`;
    await updateEraNarrative(record.narrativeId, { status: "failed", error: errorMsg });
    return { success: false, error: errorMsg };
  }

  const threadSynthesis: EraNarrativeThreadSynthesis = {
    ...parsed,
    generatedAt: Date.now(),
    model: callConfig.model,
    systemPrompt,
    userPrompt,
    inputTokens: callResult.usage.inputTokens,
    outputTokens: callResult.usage.outputTokens,
    actualCost: callResult.usage.actualCost,
  };

  await updateEraNarrative(record.narrativeId, {
    status: "step_complete",
    threadSynthesis,
    totalInputTokens: record.totalInputTokens + callResult.usage.inputTokens,
    totalOutputTokens: record.totalOutputTokens + callResult.usage.outputTokens,
    totalActualCost: record.totalActualCost + callResult.usage.actualCost,
  });

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    type: "eraNarrative" as CostType,
    model: callConfig.model,
    estimatedCost: callResult.estimate.estimatedCost,
    actualCost: callResult.usage.actualCost,
    inputTokens: callResult.usage.inputTokens,
    outputTokens: callResult.usage.outputTokens,
  });

  return { success: true, result: { generatedAt: Date.now(), model: callConfig.model } };
}

async function executeGenerateStep(
  task: WorkerTask,
  record: EraNarrativeRecord,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!record.threadSynthesis) {
    await updateEraNarrative(record.narrativeId, {
      status: "failed",
      error: "Thread synthesis required before generation",
    });
    return { success: false, error: "Thread synthesis required" };
  }

  const historianConfig: HistorianConfig = JSON.parse(record.historianConfigJson);
  const callType = "historian.eraNarrative.generate" as const;
  const callConfig = getCallConfig(config, callType);

  const systemPrompt = buildGenerateSystemPrompt(historianConfig, record.eraName);
  const userPrompt = buildGenerateUserPrompt(record);

  const callResult = await runTextCall({
    llmClient,
    callType,
    callConfig,
    systemPrompt,
    prompt: userPrompt,
    temperature: 0.8,
  });

  if (isAborted()) {
    await updateEraNarrative(record.narrativeId, { status: "failed", error: "Task aborted" });
    return { success: false, error: "Task aborted" };
  }

  const resultText = callResult.result.text?.trim();
  if (callResult.result.error || !resultText) {
    const err = `LLM call failed: ${callResult.result.error || "No text returned"}`;
    await updateEraNarrative(record.narrativeId, { status: "failed", error: err });
    return { success: false, error: err };
  }

  const wordCount = resultText.split(/\s+/).filter(Boolean).length;
  const now = Date.now();

  // Legacy narrative field (backward compat)
  const narrative: EraNarrativeContent = {
    content: resultText,
    wordCount,
    generatedAt: now,
    model: callConfig.model,
    systemPrompt,
    userPrompt,
    inputTokens: callResult.usage.inputTokens,
    outputTokens: callResult.usage.outputTokens,
    actualCost: callResult.usage.actualCost,
  };

  // Versioned content
  const version: EraNarrativeContentVersion = {
    versionId: generateVersionId(),
    content: resultText,
    wordCount,
    step: "generate",
    generatedAt: now,
    model: callConfig.model,
    systemPrompt,
    userPrompt,
    inputTokens: callResult.usage.inputTokens,
    outputTokens: callResult.usage.outputTokens,
    actualCost: callResult.usage.actualCost,
  };

  const contentVersions = [...(record.contentVersions || []), version];

  await updateEraNarrative(record.narrativeId, {
    status: "step_complete",
    narrative,
    contentVersions,
    activeVersionId: version.versionId,
    totalInputTokens: record.totalInputTokens + callResult.usage.inputTokens,
    totalOutputTokens: record.totalOutputTokens + callResult.usage.outputTokens,
    totalActualCost: record.totalActualCost + callResult.usage.actualCost,
  });

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    type: "eraNarrative" as CostType,
    model: callConfig.model,
    estimatedCost: callResult.estimate.estimatedCost,
    actualCost: callResult.usage.actualCost,
    inputTokens: callResult.usage.inputTokens,
    outputTokens: callResult.usage.outputTokens,
  });

  return { success: true, result: { generatedAt: Date.now(), model: callConfig.model } };
}

async function executeEditStep(
  task: WorkerTask,
  record: EraNarrativeRecord,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  // Resolve content to edit: latest version, or fall back to legacy narrative
  const { content: activeContent } = resolveActiveContent(record);
  if (!activeContent) {
    await updateEraNarrative(record.narrativeId, {
      status: "failed",
      error: "No content available for editing",
    });
    return { success: false, error: "No content available for editing" };
  }

  const callType = "historian.eraNarrative.edit" as const;
  const callConfig = getCallConfig(config, callType);

  const systemPrompt = buildEditSystemPrompt();
  const userPrompt = buildEditUserPrompt(record, activeContent);

  const callResult = await runTextCall({
    llmClient,
    callType,
    callConfig,
    systemPrompt,
    prompt: userPrompt,
    temperature: 0.4,
  });

  if (isAborted()) {
    await updateEraNarrative(record.narrativeId, { status: "failed", error: "Task aborted" });
    return { success: false, error: "Task aborted" };
  }

  const resultText = callResult.result.text?.trim();
  if (callResult.result.error || !resultText) {
    const err = `LLM call failed: ${callResult.result.error || "No text returned"}`;
    await updateEraNarrative(record.narrativeId, { status: "failed", error: err });
    return { success: false, error: err };
  }

  const editWordCount = resultText.split(/\s+/).filter(Boolean).length;
  const now = Date.now();

  // Legacy narrative field update (backward compat)
  const updatedNarrative: EraNarrativeContent = {
    ...(record.narrative || {
      content: activeContent,
      wordCount: activeContent.split(/\s+/).filter(Boolean).length,
      generatedAt: now,
      model: callConfig.model,
      systemPrompt: "",
      userPrompt: "",
      inputTokens: 0,
      outputTokens: 0,
      actualCost: 0,
    }),
    editedContent: resultText,
    editedWordCount: editWordCount,
    editedAt: now,
    editSystemPrompt: systemPrompt,
    editUserPrompt: userPrompt,
    editInputTokens: callResult.usage.inputTokens,
    editOutputTokens: callResult.usage.outputTokens,
    editActualCost: callResult.usage.actualCost,
  };

  // Versioned content — push new edit version
  const editVersion: EraNarrativeContentVersion = {
    versionId: generateVersionId(),
    content: resultText,
    wordCount: editWordCount,
    step: "edit",
    generatedAt: now,
    model: callConfig.model,
    systemPrompt,
    userPrompt,
    inputTokens: callResult.usage.inputTokens,
    outputTokens: callResult.usage.outputTokens,
    actualCost: callResult.usage.actualCost,
  };

  const contentVersions = [...(record.contentVersions || []), editVersion];

  await updateEraNarrative(record.narrativeId, {
    status: "step_complete",
    narrative: updatedNarrative,
    contentVersions,
    activeVersionId: editVersion.versionId,
    editInsertion: undefined,
    totalInputTokens: record.totalInputTokens + callResult.usage.inputTokens,
    totalOutputTokens: record.totalOutputTokens + callResult.usage.outputTokens,
    totalActualCost: record.totalActualCost + callResult.usage.actualCost,
  });

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    type: "eraNarrative" as CostType,
    model: callConfig.model,
    estimatedCost: callResult.estimate.estimatedCost,
    actualCost: callResult.usage.actualCost,
    inputTokens: callResult.usage.inputTokens,
    outputTokens: callResult.usage.outputTokens,
  });

  return { success: true, result: { generatedAt: Date.now(), model: callConfig.model } };
}

// ============================================================================
// Cover Image Scene Step
// ============================================================================

function buildCoverImageScenePrompt(
  eraName: string,
  thesis: string,
  counterweight: string | undefined,
  threads: { name: string; culturalActors: string[]; arc: string; register?: string }[],
  content: string
): string {
  const threadSummary = threads
    .map((t) => {
      const actors = t.culturalActors.length ? ` [${t.culturalActors.join(", ")}]` : "";
      const registerSuffix = t.register ? ` (${t.register})` : "";
      return `- ${t.name}${actors}: ${t.arc}${registerSuffix}`;
    })
    .join("\n");

  return `You are composing a visual scene description for the cover image of an era narrative — a mythic-historical text about cultural forces and world transformation, not individual characters.

## Era
${eraName}

## Thesis
${thesis}

## Cultural Threads
${threadSummary}

${counterweight ? `## Counterweight\n${counterweight}\n` : ""}
## Narrative (excerpt — first 2000 characters)
${content.slice(0, 2000)}

## Instructions
Compose a scene description (100-150 words) that captures the era's transformation at the cultural/civilizational level. Think of this as a symbolic-abstract composition — forces in motion, landscapes transforming, cultures colliding or building. The scene should evoke the era's emotional register and thesis without depicting specific individual characters.

Focus on: architectural scale, landscape transformation, cultural symbols, forces in tension, the passage of time compressed into a single frame. This is a mythic painting, not a photograph.

Return ONLY valid JSON:
{"coverImageScene": "..."}`;
}

async function executeCoverImageSceneStep(
  task: WorkerTask,
  record: EraNarrativeRecord,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  const { content } = resolveActiveContent(record);
  if (!content) {
    return { success: false, error: "No narrative content for cover image scene" };
  }

  if (!record.threadSynthesis) {
    return { success: false, error: "Thread synthesis required for cover image scene" };
  }

  const callType = "historian.eraNarrative.coverImageScene" as const;
  const callConfig = getCallConfig(config, callType);

  const prompt = buildCoverImageScenePrompt(
    record.eraName,
    record.threadSynthesis.thesis,
    record.threadSynthesis.counterweight,
    record.threadSynthesis.threads,
    content
  );

  const callResult = await runTextCall({
    llmClient,
    callType,
    callConfig,
    systemPrompt:
      "You are a visual art director creating cover image compositions for mythic-historical texts. Always respond with valid JSON.",
    prompt,
    temperature: 0.5,
  });

  if (isAborted()) {
    return { success: false, error: "Task aborted" };
  }

  const resultText = callResult.result.text?.trim();
  if (callResult.result.error || !resultText) {
    return {
      success: false,
      error: `Cover image scene failed: ${callResult.result.error || "Empty response"}`,
    };
  }

  let sceneDescription: string;
  try {
    // eslint-disable-next-line sonarjs/slow-regex -- bounded LLM response text
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0]);
    sceneDescription =
      typeof parsed.coverImageScene === "string" ? parsed.coverImageScene.trim() : "";
    if (!sceneDescription) throw new Error("Empty coverImageScene");
  } catch {
    return { success: false, error: "Failed to parse cover image scene response" };
  }

  const coverImage: EraNarrativeCoverImage = {
    sceneDescription,
    status: "pending",
  };

  const costs = {
    estimated: callResult.estimate.estimatedCost,
    actual: callResult.usage.actualCost,
    inputTokens: callResult.usage.inputTokens,
    outputTokens: callResult.usage.outputTokens,
  };

  await updateEraNarrativeCoverImage(record.narrativeId, coverImage, costs, callConfig.model);

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    type: "eraNarrativeCoverImageScene" as CostType,
    model: callConfig.model,
    estimatedCost: costs.estimated,
    actualCost: costs.actual,
    inputTokens: costs.inputTokens,
    outputTokens: costs.outputTokens,
  });

  return { success: true, result: { generatedAt: Date.now(), model: callConfig.model } };
}

// ============================================================================
// Image Refs Step
// ============================================================================

export interface AvailableChronicleImage {
  chronicleId: string;
  chronicleTitle: string;
  imageSource: "cover" | "image_ref";
  imageRefId?: string;
  imageId: string;
  sceneDescription: string;
}

function splitNarrativeIntoChunks(content: string): { index: number; text: string }[] {
  const words = content.split(/\s+/);
  const wordCount = words.length;
  let chunkCount: number;
  if (wordCount < 1500) chunkCount = 3;
  else if (wordCount < 3000) chunkCount = 4;
  else if (wordCount < 5000) chunkCount = 5;
  else if (wordCount < 7000) chunkCount = 6;
  else chunkCount = 7;
  // eslint-disable-next-line sonarjs/pseudo-random -- non-security chunk size jitter
  chunkCount += Math.random() < 0.5 ? -1 : 1;
  chunkCount = Math.max(3, Math.min(7, chunkCount));

  const chunkSize = Math.ceil(wordCount / chunkCount);
  const chunks: { index: number; text: string }[] = [];

  for (let i = 0; i < chunkCount; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, wordCount);
    if (start >= wordCount) break;
    chunks.push({ index: i, text: words.slice(start, end).join(" ") });
  }

  return chunks;
}

function buildImageRefsPrompt(
  content: string,
  eraName: string,
  availableImages: AvailableChronicleImage[]
): string {
  const chunks = splitNarrativeIntoChunks(content);

  const imageList =
    availableImages.length > 0
      ? availableImages
          .map((img) => {
            const source = img.imageSource === "cover" ? "cover image" : "scene image";
            const refSuffix = img.imageRefId ? `:${img.imageRefId}` : "";
            return `- [${img.chronicleId}${refSuffix}] "${img.chronicleTitle}" (${source}): ${img.sceneDescription}`;
          })
          .join("\n")
      : "(No chronicle images available — use prompt_request for all images)";

  const chunksDisplay = chunks
    .map((chunk) => `### CHUNK ${chunk.index + 1} of ${chunks.length}\n${chunk.text}\n----`)
    .join("\n\n");

  return `You are placing image references in an era narrative for ${eraName}. The era narrative is a mythic-historical text about cultural forces and world transformation.

## Available Chronicle Images
These illustrations come from the individual chronicles of this era. Reference them where the era narrative discusses the events or cultures those chronicles depict.

${imageList}

## Instructions
The narrative has been divided into ${chunks.length} chunks. For EACH chunk, decide whether it deserves an image (0 or 1 per chunk).

For each image, choose one type:

1. **Chronicle Reference** (type: "chronicle_ref") - Use an existing chronicle illustration
   - Use when the narrative discusses events or cultures depicted in an available chronicle image
   - Provide the chronicleId, chronicleTitle, imageSource, and imageId from the list above

2. **Prompt Request** (type: "prompt_request") - Request a new generated image
   - Use for scenes that have no matching chronicle image
   - Describe the scene at cultural/civilizational scale — landscapes, architecture, forces — not individual character portraits

## Output Format
Return a JSON object:
{
  "imageRefs": [
    {
      "type": "chronicle_ref",
      "chronicleId": "<chronicle id>",
      "chronicleTitle": "<chronicle title>",
      "imageSource": "cover|image_ref",
      "imageRefId": "<ref id if image_ref source, omit for cover>",
      "imageId": "<image id>",
      "anchorText": "<exact 5-15 word phrase from the narrative>",
      "size": "small|medium|large|full-width",
      "caption": "<optional>"
    },
    {
      "type": "prompt_request",
      "sceneDescription": "<vivid 1-2 sentence scene at cultural scale>",
      "anchorText": "<exact 5-15 word phrase from the narrative>",
      "size": "small|medium|large|full-width",
      "caption": "<optional>"
    }
  ]
}

## Size Guidelines
- small: 150px, supplementary/margin images
- medium: 300px, standard images
- large: 450px, key scenes
- full-width: 100%, establishing shots

## Rules
- Suggest 0 or 1 image per chunk (total 2-5 images for the whole narrative)
- anchorText MUST be an exact phrase from the chunk's text
- Prefer chronicle_ref when a matching image exists — reuse before generating new
- Return valid JSON only, no markdown

## Narrative Chunks
${chunksDisplay}`;
}

function parseEraNarrativeImageRefsResponse(
  text: string,
  availableImages: AvailableChronicleImage[]
): EraNarrativeImageRef[] {
  // eslint-disable-next-line sonarjs/slow-regex -- bounded LLM response text
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON object found");

  const parsed = JSON.parse(jsonMatch[0]);
  const rawRefs = parsed.imageRefs;
  if (!rawRefs || !Array.isArray(rawRefs)) {
    throw new Error("imageRefs array not found");
  }

  const availableMap = new Map(
    availableImages.map((img) => [
      `${img.chronicleId}:${img.imageSource}:${img.imageRefId || ""}`,
      img,
    ])
  );

  const validSizes: EraNarrativeImageSize[] = ["small", "medium", "large", "full-width"];

  return rawRefs.map((ref: Record<string, unknown>, index: number) => {
    const refId = `enimgref_${Date.now()}_${index}`;
    const anchorText = typeof ref.anchorText === "string" ? ref.anchorText : "";
    const rawSize = typeof ref.size === "string" ? ref.size : "medium";
    const size: EraNarrativeImageSize = validSizes.includes(rawSize as EraNarrativeImageSize)
      ? (rawSize as EraNarrativeImageSize)
      : "medium";
    const caption = typeof ref.caption === "string" ? ref.caption : undefined;

    if (ref.type === "chronicle_ref") {
      const chronicleId = typeof ref.chronicleId === "string" ? ref.chronicleId : "";
      const chronicleTitle = typeof ref.chronicleTitle === "string" ? ref.chronicleTitle : "";
      const imageSource =
        ref.imageSource === "image_ref" ? ("image_ref" as const) : ("cover" as const);
      const imageRefId = typeof ref.imageRefId === "string" ? ref.imageRefId : undefined;
      const imageId = typeof ref.imageId === "string" ? ref.imageId : "";

      const key = `${chronicleId}:${imageSource}:${imageRefId || ""}`;
      const available = availableMap.get(key);
      // Prefer the lookup — the LLM often returns the composite key (chronicleId:imageRefId)
      // from the prompt listing instead of the actual S3 image ID
      const resolvedImageId = available?.imageId || imageId || "";

      if (!resolvedImageId) {
        throw new Error(`chronicle_ref at index ${index} has no valid imageId`);
      }

      return {
        refId,
        type: "chronicle_ref",
        chronicleId,
        chronicleTitle: chronicleTitle || available?.chronicleTitle || "",
        imageSource,
        imageRefId,
        imageId: resolvedImageId,
        anchorText,
        size,
        caption,
      } as EraNarrativeChronicleImageRef;
    } else if (ref.type === "prompt_request") {
      const sceneDescription = typeof ref.sceneDescription === "string" ? ref.sceneDescription : "";
      if (!sceneDescription) {
        throw new Error(`prompt_request at index ${index} missing sceneDescription`);
      }
      return {
        refId,
        type: "prompt_request",
        sceneDescription,
        anchorText,
        size,
        caption,
        status: "pending",
      } as EraNarrativePromptRequestRef;
    } else {
      throw new Error(`Unknown image ref type at index ${index}: ${ref.type}`);
    }
  });
}

function resolveAnchorPhrase(
  anchorText: string,
  content: string
): { phrase: string; index: number } | null {
  if (!anchorText) return null;
  const index = content.indexOf(anchorText);
  if (index >= 0) return { phrase: anchorText, index };
  const lowerContent = content.toLowerCase();
  const lowerAnchor = anchorText.toLowerCase();
  const lowerIndex = lowerContent.indexOf(lowerAnchor);
  if (lowerIndex >= 0) {
    return { phrase: content.slice(lowerIndex, lowerIndex + anchorText.length), index: lowerIndex };
  }
  return null;
}

async function executeImageRefsStep(
  task: WorkerTask,
  record: EraNarrativeRecord,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  const { content } = resolveActiveContent(record);
  if (!content) {
    return { success: false, error: "No narrative content for image refs" };
  }

  const availableImages: AvailableChronicleImage[] =
    (task as unknown as { availableChronicleImages?: AvailableChronicleImage[] })
      .availableChronicleImages || [];

  const callType = "historian.eraNarrative.imageRefs" as const;
  const callConfig = getCallConfig(config, callType);

  const prompt = buildImageRefsPrompt(content, record.eraName, availableImages);

  const callResult = await runTextCall({
    llmClient,
    callType,
    callConfig,
    systemPrompt:
      "You are placing image references in a mythic-historical era narrative. Always respond with valid JSON.",
    prompt,
    temperature: 0.4,
  });

  if (isAborted()) {
    return { success: false, error: "Task aborted" };
  }

  const resultText = callResult.result.text?.trim();
  if (callResult.result.error || !resultText) {
    return {
      success: false,
      error: `Image refs failed: ${callResult.result.error || "Empty response"}`,
    };
  }

  let parsedRefs: EraNarrativeImageRef[];
  try {
    parsedRefs = parseEraNarrativeImageRefsResponse(resultText, availableImages);
  } catch (e) {
    return {
      success: false,
      error: `Failed to parse image refs: ${e instanceof Error ? e.message : "Unknown error"}`,
    };
  }

  if (parsedRefs.length === 0) {
    return { success: false, error: "No image refs found in response" };
  }

  for (const ref of parsedRefs) {
    if (ref.anchorText) {
      const resolved = resolveAnchorPhrase(ref.anchorText, content);
      if (resolved) {
        ref.anchorText = resolved.phrase;
        ref.anchorIndex = resolved.index;
      }
    }
  }

  const imageRefs: EraNarrativeImageRefs = {
    refs: parsedRefs,
    generatedAt: Date.now(),
    model: callConfig.model,
  };

  const costs = {
    estimated: callResult.estimate.estimatedCost,
    actual: callResult.usage.actualCost,
    inputTokens: callResult.usage.inputTokens,
    outputTokens: callResult.usage.outputTokens,
  };

  await updateEraNarrativeImageRefs(record.narrativeId, imageRefs, costs, callConfig.model);

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    type: "eraNarrativeImageRefs" as CostType,
    model: callConfig.model,
    estimatedCost: costs.estimated,
    actualCost: costs.actual,
    inputTokens: costs.inputTokens,
    outputTokens: costs.outputTokens,
  });

  return { success: true, result: { generatedAt: Date.now(), model: callConfig.model } };
}

// ============================================================================
// Task Router
// ============================================================================

async function executeEraNarrativeTask(
  task: WorkerTask,
  context: TaskContext
): Promise<TaskResult> {
  const { llmClient } = context;

  if (!llmClient.isEnabled()) {
    return { success: false, error: "Text generation not configured - missing Anthropic API key" };
  }

  const narrativeId = task.chronicleId; // Repurposed field
  if (!narrativeId) {
    return { success: false, error: "narrativeId (chronicleId) required for era narrative task" };
  }

  const record = await getEraNarrative(narrativeId);
  if (!record) {
    return { success: false, error: `Era narrative ${narrativeId} not found` };
  }

  // Cover image scene and image refs steps don't use the standard step status flow
  const eraNarrativeStep = (task as unknown as { eraNarrativeStep?: string }).eraNarrativeStep;
  if (eraNarrativeStep === "cover_image_scene") {
    return executeCoverImageSceneStep(task, record, context);
  }
  if (eraNarrativeStep === "image_refs") {
    return executeImageRefsStep(task, record, context);
  }

  // Mark as generating for standard pipeline steps
  await updateEraNarrative(record.narrativeId, { status: "generating" });

  try {
    switch (record.currentStep) {
      case "threads":
        return await executeThreadsStep(task, record, context);
      case "generate":
        return await executeGenerateStep(task, record, context);
      case "edit":
        return await executeEditStep(task, record, context);
      default:
        await updateEraNarrative(record.narrativeId, {
          status: "failed",
          error: `Unknown step: ${record.currentStep}`,
        });
        return { success: false, error: `Unknown step: ${record.currentStep}` };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await updateEraNarrative(record.narrativeId, { status: "failed", error: errorMsg });
    return { success: false, error: `Era narrative failed: ${errorMsg}` };
  }
}

export const eraNarrativeTask = {
  type: "eraNarrative" as const,
  execute: executeEraNarrativeTask,
};
