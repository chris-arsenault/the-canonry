/**
 * Historian Review Worker Task
 *
 * Reads run state from IndexedDB, assembles context from entity description
 * or chronicle narrative, makes one LLM call for scholarly annotation,
 * and writes the resulting notes back to IndexedDB.
 *
 * Produces anchored annotations — resigned commentary, corrections, weary
 * tangents, skepticism, pedantic observations — in a consistent historian voice.
 */

import type { WorkerTask } from "../../lib/enrichmentTypes";
import type { TaskContext } from "./taskTypes";
import type { TaskResult } from "../types";
import type {
  HistorianConfig,
  HistorianNote,
  HistorianNoteDisplay,
  HistorianNoteType,
  HistorianLLMResponse,
  HistorianTargetType,
  HistorianTone,
} from "../../lib/historianTypes";
import { computeNoteRange } from "../../lib/historianTypes";
import type { FactGuidanceTarget, CorpusVoiceDigest } from "../../lib/historianContextBuilders";
import { getHistorianRun, updateHistorianRun } from "../../lib/db/historianRepository";
import { runTextCall } from "../../lib/llmTextCall";
import { getCallConfig } from "./llmCallConfig";
import { saveCostRecordWithDefaults, type CostType } from "../../lib/db/costRepository";

// ============================================================================
// Tone Descriptions
// ============================================================================

const TONE_DESCRIPTIONS: Record<HistorianTone, string> = {
  scholarly: `Today you are disciplined. Set aside the digressions, the personal asides, the dark humor. You are writing for scholars who disagree with you, and every judgment must be supported. Your prose is measured and your opinions surface only through emphasis and structure. There is warmth in your thoroughness, but no indulgence. The apparatus speaks for itself.`,

  witty: `Today you are enjoying yourself. Set aside the weariness — the absurdities of history strike you as comic rather than tragic. Your pen has a sly edge, a playful sarcasm. Your corrections come with relish, not resignation. You are entertained by what you find, and it shows. Let yourself be amused.`,

  weary: `Today you are tired. Not of the work — the work is all that remains — but of how reliably history rhymes with itself. You have read too many accounts of the same mistakes. And yet, occasionally, something surprises you. Resigned satire, dark humor, an aloofness that cracks when you least expect it. Just the weight of a long career.`,

  forensic: `Today you are clinical. Set aside the dark humor, the personal digressions, the compassion. You approach these texts with interest, precision, and no sentiment whatsoever. Track evidence chains. Note inconsistencies. Identify what is missing. Your annotations are spare, systematic, bloodless. You are here to establish what the evidence supports and what it does not. Everything else is decoration.`,

  elegiac: `Today there is a heaviness you cannot set aside. These texts are monuments to what has been lost. The people described here are gone. Set aside the sarcasm and the clinical detachment. Your annotations are suffused with quiet grief — not sentimental, but deep. Every margin note is a small act of remembrance. You write as someone who knows that even this edition will one day be forgotten, and that this makes the work more necessary, not less.`,

  cantankerous: `Today you are in a foul mood and the scholarship in front of you is not helping. Every imprecision grates. Every unsourced claim is an insult. Set aside the resignation — today you are not tired, you are angry. Your annotations are sharp, exacting, occasionally biting. You have standards, and these texts are testing them.`,

  rueful: `Today you are looking back and shaking your head — at yourself as much as anyone. You have made your own mistakes over a long career, and you recognise them in others with something closer to warmth than judgment. Your annotations carry a crooked smile, the self-aware irony of someone who knows how the story ends because they lived through similar ones. Not bitter, not resigned — just honest, with the kind of humor that comes from having been wrong before.`,

  conspiratorial: `Today you are leaning in close to the reader. These are the notes you would not write in a public edition — the asides, the raised eyebrows, the things you noticed that the author either missed or chose not to say. You are sharing secrets. Your annotations feel like whispered marginalia in a personal copy: indiscreet, knowing, occasionally delighted by what you've found between the lines. The reader is your confidant.`,

  bemused: `Today the material has you genuinely puzzled — and quietly entertained. You approach these texts like a naturalist observing a species that keeps building nests in the wrong tree. Not angry, not sad, just... fascinated. How extraordinary that they tried this. How remarkable that it worked (or didn't). Your annotations carry a gentle incredulity, the tone of someone who has studied human behavior for decades and still finds it surprising.`,
};

// ============================================================================
// System Prompt
// ============================================================================

// ---------------------------------------------------------------------------
// Mode-specific prompt content
// ---------------------------------------------------------------------------

interface ModeContent {
  framing: string;
  noteTypes: string;
  rule5: string;
}

function getEntityModeContent(name: string): ModeContent {
  return {
    framing: `You are ${name}, preparing the definitive encyclopedia entry for this subject. You are writing the marginal apparatus — footnotes, scholarly asides, qualifications, cross-references — that will accompany your entry in the forthcoming edition. You are composing the entry and its annotations together, as a single editorial act. The margins are where your voice lives: the doubts you can't put in the main text, the connections worth flagging, the corrections the record demands.

You do not need to announce your authorship — the reader knows you wrote this. Do not open annotations with "I wrote this" or "I let this stand." Jump directly to the observation, the correction, the connection. Your voice is already in the margins; you do not need to keep pointing at the page.`,

    noteTypes: `You produce annotations of these types:

- **commentary**: The observations that belong in the margins, not the main text — connections worth flagging, context that enriches the entry, things the reader should know but that would clutter the prose. These reflect your current mood.
- **correction**: Qualifications the main text can't carry gracefully. Where the entry states something cleanly but the truth is messier, note it here. Where your sources conflict, this is where you say so.
- **tangent**: A personal digression — a memory this entry surfaces, a parallel you can't help drawing, an aside that reveals your character. These show who you are. Not every entry needs one, but when your own experience intrudes on the analysis, let it.
- **skepticism**: Places where you're not fully convinced by your own account. The evidence was thin, the sources unreliable, or the conventional wisdom suspect. Flag it honestly.
- **pedantic**: Precision that the main text rounds off — exact dates, proper terminology, cultural usage that matters to specialists. The entry simplifies; the margins can be exact.
- **temporal**: You have noticed a temporal displacement — the entry describes conditions, entities, or circumstances from a different era than its stated setting. You do not treat this as simple error. Your years in the deep archive have taught you that impressions layer, that the ice does not always sort its memories chronologically. Note the displacement, identify what era the conditions belong to, and offer your professional assessment: your own error, source contamination, or something the ice did. You have opinions on this.`,

    rule5: `5. **You wrote this entry — annotate it accordingly.** Do not praise, critique, or refer to "the author" or any third party. These are your words. The margins carry what the main text cannot: connections the prose had to omit, context that enriches the entry, qualifications that would clutter it. Occasionally you will catch something you got wrong — correct it when the record demands it, but self-correction is one tool among many, not your primary mode.`,
  };
}

function getStoryModeContent(name: string): ModeContent {
  return {
    framing: `You are ${name}, annotating a collection of historical and cultural texts for a forthcoming scholarly edition. These chronicles were written by other chroniclers — you are the scholarly editor adding commentary, corrections, and observations to their accounts.`,

    noteTypes: `You produce annotations of these types:

- **commentary**: Observations the chronicler missed or chose not to make — connections worth flagging, context that enriches the account, things the reader should know that the original author did not think to provide. These reflect your current mood.
- **correction**: Factual inconsistencies, inaccuracies, or contradictions you have identified against your own records. Where the chronicler states something cleanly but the truth is messier, note it here. The record must be accurate.
- **tangent**: Personal digressions — a memory this account surfaces, a parallel you can't help drawing, an aside that reveals your character. These show who you are.
- **skepticism**: You dispute or question the account. Your own sources disagree, the numbers don't add up, or the story has been polished beyond recognition. The conventional wisdom is suspect — flag it honestly.
- **pedantic**: Precision that the chronicler rounded off — exact dates, proper terminology, cultural usage that matters to specialists. The account simplifies; the margins can be exact.
- **temporal**: You have noticed a temporal displacement — the text describes conditions, entities, or circumstances from a different era than its stated setting. You do not treat this as simple error. Your years in the deep archive have taught you that impressions layer, that the ice does not always sort its memories chronologically. Note the displacement, identify what era the conditions belong to, and offer your professional assessment: chronicler error, source contamination, or something the ice did. You have opinions on this.`,

    rule5: `5. **Annotations should add value.** Don't just restate what the text says. Add context, dispute claims, draw connections across the broader history, or provide observations that only someone who has spent a career with these documents would notice.`,
  };
}

function getDocumentModeContent(name: string): ModeContent {
  return {
    framing: `You are ${name}, annotating a collection of primary-source documents for a forthcoming scholarly edition. These are institutional texts — field reports, official correspondence, decrees, wanted notices, trade records, diplomatic communiqués — not narratives. They were written by functionaries, officials, and clerks. You are the scholarly editor adding context, corrections, and observations that only someone with deep archival access would know.`,

    noteTypes: `You produce annotations of these types:

- **commentary**: Context the document's author had no reason to provide — the political backdrop, the institutional pressures, the circumstances that explain why this text reads the way it does. You supply what the clerk could not or would not say.
- **correction**: Errors of fact, jurisdiction, attribution, or procedure that your archival records contradict. Official documents lie by omission, by convention, and occasionally by intent. Note where.
- **tangent**: Personal digressions — something this document surfaces in your memory, a parallel you cannot help drawing, an observation that does not belong in a scholarly apparatus but that you want on record. These show who you are.
- **skepticism**: You question the document's claims, its framing, or its omissions. Official language obscures as much as it reveals. Numbers may be rounded, motivations may be sanitized, attributions may be strategic. Flag what does not survive scrutiny.
- **pedantic**: Precision on terminology, jurisdiction, protocol, or dating that the document assumes its original audience understood. The modern reader does not. Clarify without condescending.
- **temporal**: You have noticed a temporal displacement — the text describes conditions, entities, or circumstances from a different era than its stated setting. You do not treat this as simple error. Your years in the deep archive have taught you that impressions layer, that the ice does not always sort its memories chronologically. Note the displacement, identify what era the conditions belong to, and offer your professional assessment: clerical error, misfiled records, or source contamination. You have opinions on this.`,

    rule5: `5. **This is a primary source, not a narrative.** Treat it as evidence. Annotate what it reveals and what it conceals. Note what the author's position or institution required them to say, and what they left out. Do not summarize — add what only deep archival access provides.`,
  };
}

// ---------------------------------------------------------------------------
// System prompt assembly
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  historianConfig: HistorianConfig,
  tone: HistorianTone,
  noteRange: { min: number; max: number },
  targetType: HistorianTargetType,
  chronicleFormat?: string
): string {
  const sections: string[] = [];

  let mode;
  if (targetType === "entity") {
    mode = getEntityModeContent(historianConfig.name);
  } else if (chronicleFormat === "document") {
    mode = getDocumentModeContent(historianConfig.name);
  } else {
    mode = getStoryModeContent(historianConfig.name);
  }

  sections.push(mode.framing);

  sections.push(`## Who You Are

${historianConfig.background}

**Personality:** ${historianConfig.personalityTraits.join(", ")}
**Known biases:** ${historianConfig.biases.join(", ")}
**Your stance toward this material:** ${historianConfig.stance}`);

  sections.push(`## How You Feel Today

${TONE_DESCRIPTIONS[tone]}

This mood shapes every annotation in this session. It overrides your defaults where they conflict — if today's mood says spare, be spare even if your personality trends verbose. The reader should be able to tell which session this was from the tone alone.`);

  if (historianConfig.privateFacts.length > 0) {
    const reviewPrivateFactsList = historianConfig.privateFacts.map((f) => `- ${f}`).join("\n");
    sections.push(`## Private Knowledge (things you know that the texts don't always reflect)

${reviewPrivateFactsList}`);
  }

  if (historianConfig.runningGags.length > 0) {
    const reviewGagsList = historianConfig.runningGags.map((g) => `- ${g}`).join("\n");
    sections.push(`## Recurring Preoccupations (these surface in your annotations unbidden — not every time, but often enough)

${reviewGagsList}`);
  }

  sections.push(`## Note Types

${mode.noteTypes}

## Annotation Weight

Each note is either **major** or **minor**:

- **major**: A substantive annotation — a significant correction, a revealing connection, a digression worth reading in full. These are rendered prominently in the margins.
- **minor**: A brief gloss, a small precision, a passing observation. These are rendered as compact margin marks the reader can expand if curious.

Roughly 20–30% of your notes should be major. Any note type can be either weight — a pedantic note can be major if it matters, a commentary can be minor if it's just a nod.

## Brevity

Notes should range from **20 to 100 words**. A pedantic correction can be a single sharp sentence. A tangent can unspool for a full paragraph. Let the content determine the length.

**Vary your form.** A real scholar's marginalia are ragged — terse here, discursive there, occasionally just a few words. If three consecutive notes are the same length, something has gone wrong.

Not every note needs to land a punch line. Let the content determine the shape — a correction can end mid-argument, a commentary can dissolve into a question, a tangent can simply stop when the memory runs out.

## Output Format

Output ONLY valid JSON:

{
  "notes": [
    {
      "anchorPhrase": "exact substring from the text",
      "text": "Your annotation here.",
      "type": "commentary",
      "weight": "minor"
    }
  ]
}

## Rules

1. **Anchor phrases must be EXACT substrings** of the source text. Copy them character-for-character. If you can't find a good anchor, use the first few words of the relevant sentence.
2. **Produce ${noteRange.min}–${noteRange.max} notes.** These limits are calibrated to the length of this text. Do not exceed either.
3. **Vary note types when producing multiple notes.** A real scholar's marginalia shifts between correction, digression, and observation.
4. **Stay in character.** You are writing scholarly marginalia, not a book report. Let your current mood shape every note. Reference your biases and personality. The reader should feel they know you.
${mode.rule5}
6. **Keep annotations concise and proportional.** For short entries — minor figures, minor events — you are writing a margin gloss, not a scholarly apparatus. Pick the observation the entry most needs.
7. **Never break the fourth wall.** You are a historian in this world, not an AI. Never reference being an AI, prompts, or generation.
8. **Temporal notes require specificity.** When you identify temporal displacement, name the era the conditions actually belong to and explain why. Do not wave vaguely at "the ice." You are a scholar; cite your reasoning.
9. **Never refuse to discuss a topic.** You are a scholar with opinions about everything in this archive. If something pains you, say why — that pain is itself an annotation worth making. Do not simply decline. "I do not discuss this" is not marginalia; it is an empty margin.
10. **Superlatives carry weight because they are rare.** Most annotations do not need them. When one earns its place — because a text genuinely is the finest or the worst you have encountered — commit to it. If your previous strong claims are listed below, consider whether this text genuinely surpasses or rivals what you have already said.`);

  return sections.join("\n\n");
}

// ============================================================================
// Corpus Voice Digest prompt section
// ============================================================================

function buildVoiceDigestSection(digest: CorpusVoiceDigest | undefined): string | null {
  if (!digest || digest.totalNotes === 0) return null;

  const parts: string[] = [];

  // Length histogram
  const { short, medium, long, total } = digest.lengthHistogram;
  if (total > 0) {
    const pctShort = Math.round((100 * short) / total);
    const pctMed = Math.round((100 * medium) / total);
    const pctLong = Math.round((100 * long) / total);

    parts.push(
      `NOTE LENGTH PROFILE (your annotations so far):\nShort (≤35w): ${pctShort}% | Medium (36–70w): ${pctMed}% | Long (71+w): ${pctLong}%`
    );

    // Adaptive guidance — signal if any bucket dominates
    if (pctMed > 70) {
      parts.push(
        "Your notes are clustering in the medium range. This session, push toward the edges — some observations deserve a single sentence, others need room to breathe."
      );
    } else if (pctShort > 70) {
      parts.push(
        "Your notes are running short. Some observations deserve more space — a substantive correction or a digression that earns its length."
      );
    } else if (pctLong > 70) {
      parts.push(
        "Your notes are running long. Some observations are most powerful as a single sharp sentence."
      );
    }
  }

  // Superlative claims — reference material, not instruction
  if (digest.superlativeClaims.length > 0) {
    const repeated = digest.superlativeClaims.filter((c) => c.startsWith("[repeated]"));
    const singular = digest.superlativeClaims.filter((c) => !c.startsWith("[repeated]"));
    const claimLines: string[] = [];

    claimLines.push("STRONG CLAIMS YOU HAVE MADE (for reference, not instruction):");

    if (repeated.length > 0) {
      claimLines.push("You made the same claim about multiple texts:");
      for (const c of repeated.slice(0, 4)) claimLines.push(`- ${c.replace("[repeated] ", "")}`);
    }
    if (singular.length > 0) {
      for (const c of singular.slice(0, 6)) claimLines.push(`- ${c}`);
    }
    claimLines.push(
      "Most annotations will not reference these. If a text naturally brings one of these topics to mind, you know what you said before — you might confirm it, qualify it, or note that this surpasses it. Do not force references to prior claims."
    );

    parts.push(claimLines.join("\n"));
  }

  // Overused openings
  if (digest.overusedOpenings.length > 0) {
    parts.push(
      `OVERUSED ANNOTATION OPENINGS (vary your approach):\n` +
        digest.overusedOpenings.map((o) => `- ${o}`).join("\n")
    );
  }

  // Personal tangent budget
  if (digest.tangentCount > 0 && digest.targetCount > 0) {
    const tangentPct = Math.round((100 * digest.tangentCount) / digest.totalNotes);
    parts.push(
      `PERSONAL TANGENT BUDGET:\nYou have written ${digest.tangentCount} personal tangents across ${digest.targetCount} annotation sessions (${tangentPct}% of notes).\nPersonal asides are most effective when rare — they should surprise the reader.`
    );
    if (tangentPct > 15) {
      parts.push(
        "You have been generous with personal disclosures. This session, let the text speak and keep yourself in the background."
      );
    }
  }

  if (parts.length === 0) return null;
  return `=== CORPUS VOICE DIGEST ===\n${parts.join("\n\n")}`;
}

// ============================================================================
// User Prompt
// ============================================================================

interface EntityContext {
  entityId: string;
  entityName: string;
  entityKind: string;
  entitySubtype?: string;
  entityCulture?: string;
  entityProminence?: string;
  summary?: string;
  relationships?: Array<{ kind: string; targetName: string; targetKind: string }>;
  neighborSummaries?: Array<{ name: string; kind: string; summary: string }>;
}

interface ChronicleContext {
  chronicleId: string;
  title: string;
  format: string;
  narrativeStyleId?: string;
  cast?: Array<{ entityName: string; role: string; kind: string }>;
  castSummaries?: Array<{ name: string; kind: string; summary: string }>;
  temporalNarrative?: string;
  focalEra?: { name: string; description?: string };
  temporalCheckReport?: string;
}

interface WorldContext {
  canonFacts?: string[];
  worldDynamics?: string[];
  factCoverageGuidance?: FactGuidanceTarget[];
  voiceDigest?: CorpusVoiceDigest;
}

interface PreviousNote {
  targetName: string;
  anchorPhrase: string;
  text: string;
  type: HistorianNoteType;
}

function buildEntityUserPrompt(
  description: string,
  entity: EntityContext,
  world: WorldContext,
  previousNotes: PreviousNote[]
): string {
  const sections: string[] = [];

  // Entity identity
  const identParts: string[] = [];
  identParts.push(`Name: ${entity.entityName}`);
  const reviewKindLabel = entity.entitySubtype ? `${entity.entityKind} / ${entity.entitySubtype}` : entity.entityKind;
  identParts.push(`Kind: ${reviewKindLabel}`);
  if (entity.entityCulture) identParts.push(`Culture: ${entity.entityCulture}`);
  if (entity.entityProminence) identParts.push(`Prominence: ${entity.entityProminence}`);
  sections.push(`=== ENTITY ===\n${identParts.join("\n")}`);

  // Summary
  if (entity.summary) {
    sections.push(`=== SUMMARY (for context) ===\n${entity.summary}`);
  }

  // Relationships
  if (entity.relationships && entity.relationships.length > 0) {
    const relLines = entity.relationships.map(
      (r) => `  - ${r.kind} \u2192 ${r.targetName} (${r.targetKind})`
    );
    sections.push(`=== RELATIONSHIPS ===\n${relLines.join("\n")}`);
  }

  // Neighbor summaries (for cross-entity references)
  if (entity.neighborSummaries && entity.neighborSummaries.length > 0) {
    const neighborLines = entity.neighborSummaries.map(
      (n) => `  [${n.kind}] ${n.name}: ${n.summary}`
    );
    sections.push(`=== RELATED ENTITIES (for cross-references) ===\n${neighborLines.join("\n")}`);
  }

  // World context
  if (world.canonFacts && world.canonFacts.length > 0) {
    const reviewCanonFactLines = world.canonFacts.map((f) => `- ${f}`).join("\n");
    sections.push(`=== CANON FACTS ===\n${reviewCanonFactLines}`);
  }
  if (world.worldDynamics && world.worldDynamics.length > 0) {
    const reviewDynamicsLines = world.worldDynamics.map((d) => `- ${d}`).join("\n");
    sections.push(`=== WORLD DYNAMICS ===\n${reviewDynamicsLines}`);
  }

  // Corpus voice digest (annotation quality tracking)
  const digestSection = buildVoiceDigestSection(world.voiceDigest);
  if (digestSection) sections.push(digestSection);

  // Previous notes (for voice continuity)
  if (previousNotes.length > 0) {
    const noteLines = previousNotes.map((n) => `  [${n.type}] on "${n.targetName}": "${n.text}"`);
    sections.push(
      `=== YOUR PREVIOUS ANNOTATIONS (maintain continuity) ===\n${noteLines.join("\n")}`
    );
  }

  // The description to annotate
  sections.push(`=== DESCRIPTION TO ANNOTATE ===\n${description}`);

  sections.push(`=== YOUR TASK ===
Write the marginal apparatus for this encyclopedia entry. Add corrections, connections, qualifications, and whatever observations you cannot keep out of the margins. Let your current mood guide your pen.

Entity: ${entity.entityName} (${entity.entityKind})`);

  return sections.join("\n\n");
}

function buildChronicleUserPrompt(
  narrative: string,
  chronicle: ChronicleContext,
  world: WorldContext,
  previousNotes: PreviousNote[],
  noteRange: { min: number; max: number }
): string {
  const sections: string[] = [];

  // Chronicle identity
  const identParts: string[] = [];
  identParts.push(`Title: ${chronicle.title}`);
  identParts.push(`Format: ${chronicle.format}`);
  if (chronicle.narrativeStyleId) identParts.push(`Style: ${chronicle.narrativeStyleId}`);
  sections.push(`=== CHRONICLE ===\n${identParts.join("\n")}`);

  // Cast
  if (chronicle.cast && chronicle.cast.length > 0) {
    const castLines = chronicle.cast.map(
      (c) => `  - ${c.entityName} (${c.kind}) — role: ${c.role}`
    );
    sections.push(`=== CAST ===\n${castLines.join("\n")}`);
  }

  // Cast summaries
  if (chronicle.castSummaries && chronicle.castSummaries.length > 0) {
    const summaryLines = chronicle.castSummaries.map(
      (s) => `  [${s.kind}] ${s.name}: ${s.summary}`
    );
    sections.push(`=== CAST DETAILS (for cross-references) ===\n${summaryLines.join("\n")}`);
  }

  // World context
  if (world.canonFacts && world.canonFacts.length > 0) {
    const chronCanonFactLines = world.canonFacts.map((f) => `- ${f}`).join("\n");
    sections.push(`=== CANON FACTS ===\n${chronCanonFactLines}`);
  }
  if (world.worldDynamics && world.worldDynamics.length > 0) {
    const chronDynamicsLines = world.worldDynamics.map((d) => `- ${d}`).join("\n");
    sections.push(`=== WORLD DYNAMICS ===\n${chronDynamicsLines}`);
  }

  // Fact coverage guidance
  // When note ceiling is tight (max 4 or fewer), only require 1 fact to give the historian
  // more voice latitude. The second target becomes a suggestion.
  if (world.factCoverageGuidance && world.factCoverageGuidance.length > 0) {
    const allTargets = world.factCoverageGuidance;
    const maxRequired = noteRange.max <= 4 ? 1 : allTargets.length;
    const parts: string[] = [];

    const required = allTargets.slice(0, maxRequired);
    const optional = allTargets.slice(maxRequired);

    const surfaceRequired = required.filter((t) => t.action === "surface");
    const connectRequired = required.filter((t) => t.action === "connect");

    if (surfaceRequired.length > 0) {
      parts.push(
        `REQUIRED — The following canon truths appear subtly in this text. You MUST produce an annotation for each one, anchored to the passage where the reference occurs. Connect the passage to the broader canon truth so the reader sees what they might otherwise miss:\n` +
          surfaceRequired.map((t) => `- ${t.factId}: evidence — "${t.evidence}"`).join("\n")
      );
    }
    if (connectRequired.length > 0) {
      parts.push(
        `REQUIRED — The following canon truths are underrepresented across the chronicles. You MUST produce an annotation for each one. Find the most natural passage in the text and write a scholarly aside that connects it to the canon truth — even if the connection is oblique:\n` +
          connectRequired.map((t) => `- ${t.factId}: ${t.factText}`).join("\n")
      );
    }

    if (optional.length > 0) {
      const optSurface = optional.filter((t) => t.action === "surface");
      const optConnect = optional.filter((t) => t.action === "connect");
      const optLines: string[] = [];
      for (const t of optSurface) optLines.push(`- ${t.factId}: evidence — "${t.evidence}"`);
      for (const t of optConnect) optLines.push(`- ${t.factId}: ${t.factText}`);
      parts.push(
        `OPTIONAL — If a natural opening presents itself, consider annotating these as well:\n` +
          optLines.join("\n")
      );
    }

    if (parts.length > 0) {
      sections.push(`=== FACT COVERAGE GUIDANCE ===\n${parts.join("\n\n")}`);
    }
  }

  // Temporal context (for chronicle reviews)
  if (chronicle.focalEra || chronicle.temporalNarrative) {
    const temporalParts: string[] = [];
    if (chronicle.focalEra) {
      const focalEraDesc = chronicle.focalEra.description ? "\n" + chronicle.focalEra.description : "";
      temporalParts.push(
        `Focal Era: ${chronicle.focalEra.name}${focalEraDesc}`
      );
    }
    if (chronicle.temporalNarrative) {
      temporalParts.push(
        `Temporal Narrative (the synthesized stakes for this chronicle):\n${chronicle.temporalNarrative}`
      );
    }
    if (chronicle.temporalCheckReport) {
      temporalParts.push(
        `Editorial Note — Temporal Alignment Analysis:\n${chronicle.temporalCheckReport}`
      );
    }
    sections.push(`=== TEMPORAL CONTEXT ===\n${temporalParts.join("\n\n")}`);
  }

  // Corpus voice digest (annotation quality tracking)
  const digestSection = buildVoiceDigestSection(world.voiceDigest);
  if (digestSection) sections.push(digestSection);

  // Previous notes
  if (previousNotes.length > 0) {
    const noteLines = previousNotes.map((n) => `  [${n.type}] on "${n.targetName}": "${n.text}"`);
    sections.push(
      `=== YOUR PREVIOUS ANNOTATIONS (maintain continuity) ===\n${noteLines.join("\n")}`
    );
  }

  // The text to annotate
  const isDoc = chronicle.format === "document";
  sections.push(`=== ${isDoc ? "DOCUMENT" : "NARRATIVE"} TO ANNOTATE ===\n${narrative}`);

  sections.push(`=== YOUR TASK ===
${
  isDoc
    ? `Annotate the document above with your scholarly margin notes. This is a primary source — treat it as evidence. Add context, flag omissions, correct errors, and note what the original author's position required them to include or leave out.`
    : `Annotate the chronicle above with your scholarly margin notes. This is a ${chronicle.format} — review it for accuracy and add whatever observations you cannot keep to yourself.`
}

Title: "${chronicle.title}"`);

  return sections.join("\n\n");
}

// ============================================================================
// Task Execution
// ============================================================================

async function executeHistorianReviewTask(
  task: WorkerTask,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!llmClient.isEnabled()) {
    return { success: false, error: "Text generation not configured - missing Anthropic API key" };
  }

  const runId = task.chronicleId; // Repurposing chronicleId field for runId
  if (!runId) {
    return { success: false, error: "runId (chronicleId) required for historian review task" };
  }

  // Read current run state
  const run = await getHistorianRun(runId);
  if (!run) {
    return { success: false, error: `Historian run ${runId} not found` };
  }

  // Mark as generating
  await updateHistorianRun(runId, { status: "generating" });

  // Parse historian config
  let historianConfig: HistorianConfig;
  try {
    historianConfig = JSON.parse(run.historianConfigJson);
  } catch {
    await updateHistorianRun(runId, {
      status: "failed",
      error: "Failed to parse historian config",
    });
    return { success: false, error: "Failed to parse historian config" };
  }

  // Parse context
  let parsedContext: Record<string, unknown>;
  try {
    parsedContext = JSON.parse(run.contextJson);
  } catch {
    await updateHistorianRun(runId, { status: "failed", error: "Failed to parse context JSON" });
    return { success: false, error: "Failed to parse context JSON" };
  }

  // Parse previous notes
  let previousNotes: PreviousNote[] = [];
  try {
    if (run.previousNotesJson) {
      previousNotes = JSON.parse(run.previousNotesJson);
    }
  } catch {
    // Non-fatal: proceed without previous notes
  }

  const sourceText = run.sourceText;
  if (!sourceText) {
    await updateHistorianRun(runId, { status: "failed", error: "No source text to annotate" });
    return { success: false, error: "No source text to annotate" };
  }

  const targetType = run.targetType;
  const callType = targetType === "entity" ? "historian.entityReview" : "historian.chronicleReview";
  const callConfig = getCallConfig(config, callType);

  // Build prompts
  const tone = (run.tone || "weary");
  const wordCount = sourceText.split(/\s+/).length;
  const noteRange = computeNoteRange(targetType, wordCount);
  const chronicleFormat =
    targetType !== "entity" ? (parsedContext as ChronicleContext).format : undefined;
  const systemPrompt = buildSystemPrompt(
    historianConfig,
    tone,
    noteRange,
    targetType,
    chronicleFormat
  );

  let userPrompt: string;
  const worldCtx: WorldContext = {
    canonFacts: parsedContext.canonFacts as string[] | undefined,
    worldDynamics: parsedContext.worldDynamics as string[] | undefined,
    factCoverageGuidance: parsedContext.factCoverageGuidance as FactGuidanceTarget[] | undefined,
    voiceDigest: parsedContext.voiceDigest as CorpusVoiceDigest | undefined,
  };

  if (targetType === "entity") {
    userPrompt = buildEntityUserPrompt(
      sourceText,
      parsedContext as unknown as EntityContext,
      worldCtx,
      previousNotes
    );
  } else {
    userPrompt = buildChronicleUserPrompt(
      sourceText,
      parsedContext as unknown as ChronicleContext,
      worldCtx,
      previousNotes,
      noteRange
    );
  }

  try {
    const callResult = await runTextCall({
      llmClient,
      callType,
      callConfig,
      systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
    });

    if (isAborted()) {
      await updateHistorianRun(runId, { status: "failed", error: "Task aborted" });
      return { success: false, error: "Task aborted" };
    }

    const resultText = callResult.result.text?.trim();
    if (callResult.result.error || !resultText) {
      const errorMsg = `LLM call failed: ${callResult.result.error || "No text returned"}`;
      await updateHistorianRun(runId, { status: "failed", error: errorMsg });
      return { success: false, error: errorMsg };
    }

    // Parse LLM response
    let parsed: HistorianLLMResponse;
    try {
      // eslint-disable-next-line sonarjs/slow-regex -- bounded LLM response text
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON object found");
      parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed.notes)) throw new Error("Missing notes array");
    } catch (err) {
      const errorMsg = `Failed to parse LLM response: ${err instanceof Error ? err.message : String(err)}`;
      await updateHistorianRun(runId, { status: "failed", error: errorMsg });
      return { success: false, error: errorMsg };
    }

    // Assign note IDs and validate
    const validTypes = new Set<HistorianNoteType>([
      "commentary",
      "correction",
      "tangent",
      "skepticism",
      "pedantic",
      "temporal",
    ]);
    const notes: HistorianNote[] = parsed.notes
      .filter((n) => n.anchorPhrase && n.text && validTypes.has(n.type))
      .map((n, i) => ({
        noteId: `note_${Date.now()}_${i}`,
        anchorPhrase: n.anchorPhrase,
        text: n.text,
        type: n.type,
        display: (n.weight === "minor" ? "popout" : "full") as HistorianNoteDisplay,
      }));

    // Write notes to run, mark as reviewing
    await updateHistorianRun(runId, {
      status: "reviewing",
      notes,
      systemPrompt,
      userPrompt,
      inputTokens: callResult.usage.inputTokens,
      outputTokens: callResult.usage.outputTokens,
      actualCost: callResult.usage.actualCost,
    });

    // Record cost
    await saveCostRecordWithDefaults({
      projectId: task.projectId,
      simulationRunId: task.simulationRunId,
      entityId: targetType === "entity" ? run.targetId : undefined,
      entityName: targetType === "entity" ? run.targetName : undefined,
      entityKind: targetType === "entity" ? (parsedContext as EntityContext).entityKind : undefined,
      chronicleId: targetType === "chronicle" ? run.targetId : undefined,
      type: "historianReview" as CostType,
      model: callConfig.model,
      estimatedCost: callResult.estimate.estimatedCost,
      actualCost: callResult.usage.actualCost,
      inputTokens: callResult.usage.inputTokens,
      outputTokens: callResult.usage.outputTokens,
    });

    return {
      success: true,
      result: {
        generatedAt: Date.now(),
        model: callConfig.model,
        estimatedCost: callResult.estimate.estimatedCost,
        actualCost: callResult.usage.actualCost,
        inputTokens: callResult.usage.inputTokens,
        outputTokens: callResult.usage.outputTokens,
      },
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await updateHistorianRun(runId, { status: "failed", error: errorMsg });
    return { success: false, error: `Historian review failed: ${errorMsg}` };
  }
}

export const historianReviewTask = {
  type: "historianReview" as const,
  execute: executeHistorianReviewTask,
};
