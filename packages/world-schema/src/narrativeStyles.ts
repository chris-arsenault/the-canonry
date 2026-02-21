/**
 * Narrative Style Types and Defaults
 *
 * Defines story-based narrative styles for chronicle generation.
 *
 * Design principle: Each style has a DISTINCT STRUCTURE, not just different adjectives.
 * Structure, roles, and prose instructions must reinforce each other.
 */

/**
 * Role definition for entity casting
 */
export interface RoleDefinition {
  /** Role identifier (e.g., 'protagonist', 'love-interest', 'schemer') */
  role: string;
  /** How many entities can fill this role */
  count: { min: number; max: number };
  /** Description of this role for the LLM */
  description: string;
  /** Optional selection criteria hint (used by document styles) */
  selectionCriteria?: string;
}

/**
 * Pacing configuration - simple numeric ranges
 */
export interface PacingConfig {
  /** Target total word count */
  totalWordCount: { min: number; max: number };
  /** Number of scenes */
  sceneCount: { min: number; max: number };
}

/**
 * Narrative format type - distinguishes stories from documents
 */
export type NarrativeFormat = 'story' | 'document';

/**
 * Story narrative style - simplified structure with freeform text blocks
 *
 * Instead of dozens of structured fields that get fragmented in prompts,
 * we use a few rich text blocks that flow naturally into generation prompts.
 */
/**
 * Era narrative weight — determines how a chronicle using this style
 * is weighted in era narrative prompt assembly.
 *
 * - 'structural': Defines the era's trajectory. These chronicles ARE the major events.
 * - 'contextual': Provides institutional, political, or personal framing.
 * - 'flavor': World texture. Color and atmosphere, not arc-defining.
 */
export type EraNarrativeWeight = 'structural' | 'contextual' | 'flavor';

export interface StoryNarrativeStyle {
  format: 'story';

  // === Metadata ===
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description shown in UI */
  description: string;
  /** Tags for categorization */
  tags?: string[];
  /** How this style weights in era narrative assembly */
  eraNarrativeWeight?: EraNarrativeWeight;

  // === Freeform Text Blocks (injected directly into prompts) ===

  /**
   * Narrative structure instructions - how to build the story.
   * Includes: plot structure, scene progression, emotional arcs, beats.
   * This is the primary guidance for story construction.
   */
  narrativeInstructions: string;

  /**
   * Prose style instructions - how to write the story.
   * Includes: tone, dialogue style, description approach, pacing notes, what to avoid.
   */
  proseInstructions: string;

  /**
   * Event usage instructions - how to incorporate world events.
   * Optional - only needed if events require special handling.
   */
  eventInstructions?: string;

  /**
   * Craft posture - how the author should relate to the material.
   * Controls density, withholding, elaboration mode, emotional signaling.
   * Orthogonal to prose instructions (which say what the writing should feel like)
   * and word count (which controls quantity). This controls density within
   * whatever word count is specified.
   */
  craftPosture?: string;

  /**
   * Title guidance - how titles for this style should feel.
   * Freeform description of the title's shape, register, and energy.
   * Injected into the title generation prompt as the primary style constraint.
   */
  titleGuidance?: string;

  // === Structured Data (genuinely useful as structured) ===

  /** Cast roles - what positions exist in this narrative */
  roles: RoleDefinition[];

  /** Pacing - word count and scene count ranges */
  pacing: PacingConfig;

}

export const DEFAULT_NARRATIVE_STYLES: StoryNarrativeStyle[] = [
  // ============================================================================
  // 1. EPIC DRAMA - Retrospective Chronicle Structure
  // ============================================================================
  {
    id: 'epic-drama',
    name: 'Epic Drama',
    description: 'Grand narratives told as chronicle - we know how it ends, the question is how it came to this',
    tags: ['dramatic', 'high-stakes', 'retrospective'],
    eraNarrativeWeight: 'structural',
    format: 'story',

    narrativeInstructions: `STRUCTURE: RETROSPECTIVE CHRONICLE
This story is told looking backward. The chronicler knows the outcome. The reader learns the ending before the beginning. Tension comes not from "what happens" but from "how did it come to this."

=== SCENE 1: THE CHRONICLER'S FRAME ===
Open in the present. The chronicler (witness role) prepares to record or recite. We learn immediately how it ended - who fell, what was lost, what changed. This is not a spoiler; it is the premise.

Establish: The outcome. The chronicler's physical presence - they carry what happened in their body. The weight of recording.
End with: The chronicler beginning to tell.

=== SCENES 2-3: THE EVENTS (TOLD AS MEMORY) ===
The chronicler recounts. These scenes are the past, but vivid - dramatized, not summarized. The chronicler:
- Compresses time between significant moments
- Skips to significant moments rather than proceeding linearly
- TELLS THE STORY rather than commenting on the telling

Scene 2: THE GATHERING - The protagonist assembling power, allies, purpose. Show the relationships between characters - the bitter humor, the debts owed, the friction and loyalty. Ground characters in physical details that recur.

Scene 3: THE CRISIS AND FALL - The confrontation, the cost, the moment everything changed. Deaths and losses should land in the moment, not be reported from a distance.

=== SCENE 4: THE CHRONICLER'S CLOSE ===
Return to present. The chronicler finishes.

End with the chronicler alone. Not a meditation on history. Not a reflection on what was learned. A moment - concrete, present, landing.

The last line should arrive unexpectedly. Not a summary of theme.`,

    proseInstructions: `TONE: Elegiac, weighted, already-grieving. The narrator speaks from beyond the events - but speaks INTO them, not about them.

DIALOGUE: Past dialogue is dramatic, not merely reported. Key exchanges should play out with the weight they carried. Let characters speak to each other, not through the chronicler's summary.

DESCRIPTION: Past scenes vivid as memory - certain details hyper-clear, others compressed. Present-frame scenes spare and immediate. Physical details that recur across scenes anchor the reader in bodies, not concepts.

TECHNIQUE - THE WEIGHT OF KNOWING: The chronicler's voice carries knowledge of what's coming. This creates dramatic irony, not commentary.

TECHNIQUE - BITTER CAMARADERIE: Even in grief, characters have relationships. Dark humor. Debts and loyalties. Small moments between large events. Grimness without relief becomes a document.

AVOID: The chronicler explaining what events "meant." Losses described at a distance rather than felt in the moment. Ending with thematic summary. Commentary on the act of chronicling itself. Conceptual descriptions where physical ones would serve.`,

    eventInstructions: 'Events are what the chronicler dramatizes. Significant moments should play out, not be summarized. The chronicle is a story, not a historical summary with narrative framing.',

    craftPosture: `- Sustain elaboration. Accumulated detail is the method — let scenes breathe and dramatize rather than compress.
- Institutional texture earns its place when it reveals how power operates through people.
- Withhold commentary. The gap between what is recorded and what happened does the work.`,

    titleGuidance: 'Retrospective and weighted. The title names the event as history — something already concluded, already grieved. It should sound like what survivors call this era when they speak of it years later. Concrete over abstract: a place, a name, a cost.',

    roles: [
      { role: 'chronicler', count: { min: 1, max: 1 }, description: 'The witness who survived to tell this - they frame everything, but tell the story rather than comment on telling it' },
      { role: 'protagonist', count: { min: 1, max: 1 }, description: 'The central figure - ground them in physical presence, not conceptual traits' },
      { role: 'antagonist', count: { min: 1, max: 1 }, description: 'The opposing force - villain, rival power, or circumstance' },
      { role: 'the-lost', count: { min: 0, max: 2 }, description: 'Those who did not survive - their loss should land, not be reported' },
      { role: 'the-weight', count: { min: 0, max: 1 }, description: 'The force that shaped events - a law, a power, an occurrence. Present in effects, not explained' },
    ],

    pacing: {
      totalWordCount: { min: 1600, max: 2200 },
      sceneCount: { min: 3, max: 4 },
    },
  },

  // ============================================================================
  // 2. ACTION ADVENTURE - Countdown Structure
  // ============================================================================
  {
    id: 'action-adventure',
    name: 'Action Adventure',
    description: 'Race against time - each scene marked by how long remains, tension from the ticking clock',
    tags: ['action', 'countdown', 'urgent'],
    eraNarrativeWeight: 'structural',
    format: 'story',

    narrativeInstructions: `STRUCTURE: COUNTDOWN
This story is organized by TIME REMAINING, not plot beats. Each scene heading includes a time marker. The deadline is real and its consequences are clear. The hero cannot do everything - they must choose.

=== SCENE 1: THE CLOCK STARTS ===
[TIME MARKER: e.g., "Six hours until the tide rises"]
Establish the deadline and its stakes in the first paragraph. What happens if they fail. The hero learns what must be done and how little time remains. The objective is clear. The obstacles become apparent.

The scene ends with the hero committing to a course - and the clock already eating into their margin.

=== SCENE 2: TIME BURNS ===
[TIME MARKER: e.g., "Four hours remaining"]
A complication costs precious time. The hero must choose between being thorough and being fast. Whatever they skip will matter later. Show the physical toll - exhaustion, injury, desperation creeping in.

Dialogue happens while moving. No one stops to talk.

=== SCENE 3: RUNNING OUT ===
[TIME MARKER: e.g., "Forty minutes"]
Desperation. Shortcuts taken. The hero does things they wouldn't do with more time. The obstacle that seemed manageable now seems impossible. Everything narrows to the immediate.

=== SCENE 4: THE EDGE ===
[TIME MARKER: e.g., "Three minutes" or "Too late"]
The final push. Success or failure at the absolute limit. If success, it should be by seconds, by inches, by one last desperate choice. If failure, show what that costs.

Either way, end with the hero's body and face showing what it took.`,

    proseInstructions: `TONE: Breathless, urgent, kinetic. Sentences short when action peaks, longer only in brief moments of forced waiting.

DIALOGUE: Clipped. Functional. People speak while doing. "Left!" not "Go to your left!" No speeches. Questions answered with actions.

DESCRIPTION: Motion-focused. Active verbs. What can be climbed, broken, used. Sensory impact - heat, cold, impact, exhaustion. The environment is obstacle and tool.

TECHNIQUE - TIME PRESSURE IN PROSE: Refer to the deadline. "Two hours ago that would have been easy." "No time to check if it would hold." The clock haunts every decision.

TECHNIQUE - COST ON THE BODY: Show exhaustion accumulating. Hands shaking. Vision blurring. The hero running on fumes by Scene 3.

AVOID: Scenes where people stand and talk. Internal monologue. Reflection. Any sentence that starts with "He realized..."`,

    eventInstructions: 'Events are obstacles that cost time. Each one forces a choice: deal with it (lose time) or bypass it (face consequences later).',

    craftPosture: `- Compress. Every sentence advances motion or raises stakes. Cut anything static.
- Description is functional — what can be used, reached, or broken. No atmosphere for its own sake.
- Show physical cost accumulating. Exhaustion and injury in detail, not emotion in summary.`,

    titleGuidance: 'Short and physical. Name something you can see or feel — a place, a distance, a weapon, a threshold. Momentum lives in concrete nouns and active verbs. The register is immediate, not reflective. If the title could be shouted across a room, it fits.',

    roles: [
      { role: 'hero', count: { min: 1, max: 2 }, description: 'Racing the clock - defined by what they do, not what they think' },
      { role: 'deadline', count: { min: 1, max: 1 }, description: 'The ticking clock - tide, ritual, collapse, arrival. Must be concrete and visible' },
      { role: 'objective', count: { min: 1, max: 1 }, description: 'What must be reached, retrieved, stopped, or saved before time runs out' },
      { role: 'obstacle', count: { min: 1, max: 2 }, description: 'What blocks the path and costs precious time to overcome' },
    ],

    pacing: {
      totalWordCount: { min: 1400, max: 1800 },
      sceneCount: { min: 4, max: 5 },
    },
  },

  // ============================================================================
  // 3. ROMANCE - Parallel Convergence Structure
  // ============================================================================
  {
    id: 'romance',
    name: 'Romance',
    description: 'Two lives shown separately before they collide - the reader knows both before they know each other',
    tags: ['romantic', 'dual-POV', 'convergence'],
    eraNarrativeWeight: 'structural',
    format: 'story',

    narrativeInstructions: `STRUCTURE: PARALLEL CONVERGENCE
Two points of view, shown separately, then brought together. The reader understands both characters before they understand each other. The romance earns its weight because we've lived in both worlds.

=== SCENE 1: LOVER-A ALONE ===
Show Lover-A in their world, in a moment that reveals character. What do they do when no one important is watching? What do they lack? What do they want but won't admit?

This is not backstory dump. This is a complete small scene - a morning, an encounter, a task - that lets us inhabit Lover-A before we see them through Lover-B's eyes.

End with something unresolved. A want. A lack. A question they're not asking.

=== SCENE 2: LOVER-B ALONE ===
Same approach for Lover-B. Different world, different lack, different want.

IMPORTANT: The two worlds should feel distinct. Different textures, different rhythms, different concerns. The reader should feel the distance between them.

Optional: A near-miss. They almost cross paths but don't notice. The reader sees it; they don't.

=== SCENE 3: THE MEETING ===
Now they collide. But we see it differently than they do - we know what each one wants, what each one lacks, what each one isn't showing.

The first impression should be incomplete. They don't see each other clearly. But something catches. A detail. A moment. Something to carry away.

Show both perspectives within this scene, or choose one but let the reader supply the other from what we learned.

=== SCENE 4: THE QUESTION ===
After the meeting. Separate again, or together facing an obstacle. The question is not "will they get together" but "can they see each other truly?"

End with a moment of vulnerability - offered or withheld. Not a declaration. A gesture. A silence that says something.`,

    proseInstructions: `TONE: Intimate, observant, yearning. Different textures for each character's scenes.

DIALOGUE: Heavy subtext. What's not said. Questions that are really statements. Statements that are really questions. Silences that speak.

DESCRIPTION: Body language. Small gestures. What the eyes do. The particular quality of this specific person - not generic beauty but what makes them them.

TECHNIQUE - DISTINCT TEXTURES: Lover-A's scenes and Lover-B's scenes should feel different. Word choice, sentence rhythm, what gets noticed. The reader should feel whose head they're in.

TECHNIQUE - THE DETAIL THAT CATCHES: In the meeting scene, one specific detail should snag. Not "she was beautiful" but "the way she held her cup with both hands, like she was cold even in summer."

AVOID: Love at first sight without complication. External plot overwhelming the relationship. Rushing emotional development. Telling us characters are compatible instead of showing it.`,

    eventInstructions: 'Events are pretexts for emotional revelation. The plot exists to put pressure on hearts, not to resolve through action.',

    craftPosture: `- Precise physical detail over emotional exposition. One specific gesture outweighs a paragraph of feeling.
- Withhold declarations. The approach is the story, not the arrival.
- Differentiate density between characters. Each perspective earns its own texture.`,

    titleGuidance: 'The title lives in the space between two people. Name the thing that connects or separates them — a shared place, a private gesture, the quality of their particular distance. Intimate register: the voice of someone remembering. Sonic warmth matters; the title should be pleasant to say quietly.',

    roles: [
      { role: 'lover-a', count: { min: 1, max: 1 }, description: 'First perspective - we live in their world before the meeting' },
      { role: 'lover-b', count: { min: 1, max: 1 }, description: 'Second perspective - different world, different lack' },
      { role: 'obstacle', count: { min: 0, max: 1 }, description: 'What makes connection difficult - not villain, but genuine barrier (duty, history, fear)' },
      { role: 'catalyst', count: { min: 0, max: 1 }, description: 'What brings them into contact - place, event, person, circumstance' },
    ],

    pacing: {
      totalWordCount: { min: 1400, max: 1800 },
      sceneCount: { min: 4, max: 4 },
    },
  },

  // ============================================================================
  // 4. SLICE OF LIFE - Single Extended Scene Structure
  // ============================================================================
  {
    id: 'slice-of-life',
    name: 'Slice of Life',
    description: 'One continuous moment, no scene breaks - time unfolds without interruption',
    tags: ['quiet', 'continuous', 'immersive'],
    eraNarrativeWeight: 'flavor',
    format: 'story',

    narrativeInstructions: `STRUCTURE: SINGLE EXTENDED SCENE
No scene breaks. One continuous flow of time - an hour, a meal, a walk, a task. The story lives in presence, not plot. Nothing dramatic needs to happen. The extraordinary is found in the ordinary through quality of attention.

=== THE CONTINUOUS SCENE ===
Choose a bounded moment: a morning routine, a journey between two places, a meal prepared and eaten, a craft practiced.

MOVEMENT 1 - ARRIVAL: The focal-point enters the moment. Waking, arriving, beginning. Establish the sensory world with precision. Temperature. Light quality. Sounds. What the body feels.

MOVEMENT 2 - THE TEXTURE OF PRESENCE: The focal-point inhabits the moment. The specific knowledge of their work or place. The way their hands know what to do. Unhurried attention to process.

MOVEMENT 3 - THE SMALL SHIFT: Something changes, but nothing dramatic. Weather shifts. A memory surfaces. Someone passes through. A bird calls. The focal-point notices something they hadn't noticed before.

MOVEMENT 4 - DEPARTURE: The moment ends naturally. The meal finished. The destination reached. The work complete. The focal-point carries something forward - not a lesson, just a feeling, a changed quality of attention.

NO SCENE BREAKS. Time flows continuously. If you feel the urge to skip ahead, instead inhabit the time between.`,

    proseInstructions: `TONE: Present, attentive, unhurried, textured. No urgency.

DIALOGUE: If dialogue occurs, it should be natural, meandering, about small things. Not exposition. Not conflict. Just people talking the way people talk when nothing needs to be decided.

DESCRIPTION: Sensory precision. Not "a nice day" but the exact quality of light, the specific smell of bread, the particular way steam rises. Unhurried sentences that let the reader sink in. Present tense works well but is not required.

TECHNIQUE - DURATION: Let things take the time they take. Describe the whole process of making tea. The walk across a room. The moments that other stories skip.

TECHNIQUE - LAYERED ATTENTION: The focal-point notices, then notices something within what they noticed, then notices their own noticing. Attention deepens rather than jumps.

TECHNIQUE - EARNED SILENCE: Silence is not empty. When dialogue stops, we stay with the focal-point in the quiet. What does silence feel like in this moment?

AVOID: Dramatic events. Conflict requiring resolution. Backstory dumps. Realizations. Character arcs. The story does not need to "go somewhere."`,

    eventInstructions: 'Events are texture, not drivers. They happen in the background or memory. The moment being lived is not about events.',

    craftPosture: `- Dwell. Duration is the method. Let process and presence take the space that plot would.
- Sensory precision over emotional labeling. Depth, not breadth.
- Stillness is not a gap. Resist filling quiet moments with significance.`,

    titleGuidance: 'Particular and unhurried. The title names the ordinary thing — a place, a time of day, a task, a season. Specific enough to be someone\'s real life, quiet enough to almost miss. One to four words. No drama, no significance announced; the title trusts the reader to find what matters.',

    roles: [
      { role: 'focal-point', count: { min: 1, max: 1 }, description: 'The consciousness we inhabit - person, place, or moment' },
      { role: 'passing-through', count: { min: 0, max: 2 }, description: 'Brief presences - someone who shares the space temporarily' },
      { role: 'the-moment', count: { min: 0, max: 1 }, description: 'The bounded time - the meal, the walk, the morning' },
    ],

    pacing: {
      totalWordCount: { min: 800, max: 1200 },
      sceneCount: { min: 1, max: 1 },
    },
  },

  // ============================================================================
  // 5. POLITICAL INTRIGUE - Sequential Machination Structure
  // ============================================================================
  {
    id: 'political-intrigue',
    name: 'Political Intrigue',
    description: 'Schemes unfold through sequential moves - each scene a chess move in a larger game',
    tags: ['political', 'machination', 'layered'],
    eraNarrativeWeight: 'structural',
    format: 'story',

    narrativeInstructions: `STRUCTURE: SEQUENTIAL MACHINATION
A political game told through moves and counter-moves. Each scene is a discrete encounter where power shifts, information changes hands, or positions are established. The protagonist navigates between factions, making calculated choices.

=== SCENE 1: THE BOARD ===
Establish the political landscape through a public moment - a ceremony, council session, or formal occasion. Multiple players are present. Show:
- The protagonist observing, calculating, noting who speaks to whom
- The surface ritual (what everyone pretends is happening)
- The undercurrents (what's actually being negotiated)
- A first contact - someone approaches with an offer, threat, or test

End with the protagonist holding something (information, an offer, a suspicion) they must decide what to do with.

=== SCENE 2: THE PRIVATE GAME ===
A one-on-one encounter with a power figure. Behind closed doors, the masks come off - partially. Show:
- What each party wants from the other
- What each party is hiding
- The negotiation beneath the conversation
- A reveal that changes the protagonist's understanding

The protagonist learns something that reframes Scene 1.

=== SCENE 3: THE COUNTER-MOVE ===
The protagonist acts on what they've learned. Another private encounter, different player. Show:
- The protagonist using information as leverage
- An alliance forming or breaking
- The cost of the move (what the protagonist trades away)
- A commitment that cannot be undone

=== SCENE 4: THE NEW BOARD ===
The consequences manifest. Brief. The political landscape has shifted. Show:
- Who rose, who fell
- What the protagonist gained and lost
- The next game already beginning
- The ice remembers (or equivalent) - actions have been recorded

The protagonist is now a player, not an observer. Whether that's victory depends on what comes next.`,

    proseInstructions: `TONE: Calculated, observant, measured. Every gesture is potentially meaningful. Every word choice is deliberate.

DIALOGUE: Subtext-heavy. Characters rarely say what they mean directly. Courtesy as threat. Agreement as refusal. Questions that are really accusations. Listen for what's NOT said.

DESCRIPTION: Status markers, power dynamics, who stands where. The protagonist notices leverage points - information, relationships, obligations. Rooms are described in terms of who controls them.

TECHNIQUE - THE OBSERVER: The protagonist watches before acting. They count allies, note exits, read body language. Their observations reveal character.

TECHNIQUE - THE OFFER: Every scene contains an offer - explicit or implicit. Taking it has costs. Refusing it has costs. The protagonist must choose.

TECHNIQUE - THE RECORD: Actions leave traces. The ice remembers. Documents exist. Someone always knows. Political moves create evidence that can be used later.

AVOID: Mustache-twirling villains. Characters who state their true motives. Easy moral clarity. Rushed conclusions. Politics is patient.`,

    eventInstructions: 'Events are leverage. What happened creates obligations, grudges, and evidence. The protagonist must navigate history as much as present circumstances.',

    craftPosture: `- Layer surface and undercurrent simultaneously. Every exchange carries two meanings.
- Patience. Let each position establish before shifting it. Do not rush to the endgame.
- Detail earns its place when it reveals power dynamics. Restrain revelation — suspicion before knowledge.`,

    titleGuidance: 'The title should operate the way its characters do — saying one thing while meaning another. Institutional language that carries threat. Positions, courtesies, and formalities that are really weapons. The register is controlled and public-facing, with pressure underneath.',

    roles: [
      { role: 'player-a', count: { min: 1, max: 1 }, description: 'The protagonist - observant, calculating, making moves through the political landscape' },
      { role: 'player-b', count: { min: 1, max: 1 }, description: 'Current authority figure or primary opposition - has something player-a needs or threatens' },
      { role: 'player-c', count: { min: 0, max: 1 }, description: 'Representative of competing interest - offers alliance or opposition' },
      { role: 'the-event', count: { min: 1, max: 1 }, description: 'The central occurrence that sets the machinations in motion' },
      { role: 'the-prize', count: { min: 0, max: 1 }, description: 'What is being contested - position, resource, authentication, territory' },
    ],

    pacing: {
      totalWordCount: { min: 1600, max: 2200 },
      sceneCount: { min: 4, max: 4 },
    },
  },

  // ============================================================================
  // 6. RASHOMON - Same Event, Multiple Accounts
  // ============================================================================
  {
    id: 'rashomon',
    name: 'Rashomon',
    description: 'One pivotal moment told three times - each account complete, each contradictory, truth assembled by the reader',
    tags: ['multi-POV', 'unreliable', 'layered'],
    eraNarrativeWeight: 'structural',
    format: 'story',

    narrativeInstructions: `STRUCTURE: THREE ACCOUNTS OF ONE MOMENT
This story retells the SAME pivotal event three times from three different positions. Not three sequential events - ONE event, THREE versions.

The pivotal event is provided in your cast (the-moment). This is the ONLY event you dramatize in Scenes 1-3. Each scene tells this same moment from a different witness.

=== SCENE 1: FIRST WITNESS ===
Open with a header naming this witness. Tell the pivotal event from their position - first-person or close third, inside their head. Include what they physically observed from where they stood, what they concluded about others' motives, and one specific detail they emphasize.

This account should feel COMPLETE. A reader stopping here would believe this is the truth.

=== SCENE 2: SECOND WITNESS ===
Header naming the second witness. Tell THE SAME EVENT from their position. The same observable facts, noticed differently. A different interpretation of the same actions. The emphasized detail from Scene 1 should be contradicted, ignored, or given opposite meaning. Include something Witness-A could not have seen from their position.

The reader now holds two incompatible truths.

=== SCENE 3: THIRD WITNESS ===
Header naming the third witness - often someone marginal to the main players. Tell THE SAME EVENT from this third position. Include something BOTH previous witnesses missed. A detail that destabilizes both accounts. No resolution - this account adds uncertainty, not clarity.

=== SCENE 4: AFTER ===
Brief. No header. The moment is past. Show ONE of the witnesses alone, acting on their version of events. The reader knows their understanding is partial. The witness does not.

End in that gap between what they believe and what we suspect.`,

    proseInstructions: `TONE: Certain, observant, partial. Each witness speaks with complete confidence about their incomplete view. The prose carries no doubt even as the contradictions multiply. Three distinct voices - different rhythms, different concerns, different ways of seeing the same room.

DIALOGUE: The same exchange appears in multiple accounts, quoted differently each time. The words shift slightly between tellings. Both versions feel accurate. The reader cannot know which is true.

DESCRIPTION: Selective, character-driven. Each witness notices according to their nature. The same space rendered three ways, each rendering complete and confident.

TECHNIQUE - THE PIVOT: One moment appears in all three accounts - a phrase, gesture, or glance. Each witness interprets it completely differently. This repeated-and-reframed moment is the heart of the story.

TECHNIQUE - CONFIDENT INCOMPATIBILITY: No witness hedges. No "I think" or "perhaps." Each states their version as fact. The contradiction emerges from certainty meeting certainty.

AVOID: Omniscient resolution. One account being obviously correct. Witnesses acknowledging their view is partial. Scene 4 revealing what really happened. Any voice outside the witnesses' perspectives.`,

    eventInstructions: 'The event is given to you as the-moment in the cast. This is the ONLY thing you dramatize. Do not invent additional events. Tell this one moment three ways.',

    craftPosture: `- Each account fully elaborated and confident. Certainty is the technique — no hedging.
- Contradiction emerges from selective attention, not from altering facts.
- Restraint in the closing. Brief, concrete, unresolved. Do not adjudicate.`,

    titleGuidance: 'The title names the event or object at the center — the thing all witnesses agree exists but disagree about entirely. It should feel stable, even factual, while the story beneath it fractures. A concrete noun phrase carrying the weight of contested truth. The title is the one thing everyone recognizes; everything else is disputed.',

    roles: [
      { role: 'witness-a', count: { min: 1, max: 1 }, description: 'First perspective - their account opens the story and establishes the baseline truth that subsequent accounts will complicate' },
      { role: 'witness-b', count: { min: 1, max: 1 }, description: 'Second perspective - contradicts or complicates the first account through different position and interpretation' },
      { role: 'witness-c', count: { min: 1, max: 1 }, description: 'Third perspective - often marginal to the main players, reveals what the principals missed or misread' },
      { role: 'the-moment', count: { min: 1, max: 1 }, description: 'The pivotal event all three witnesses observed - must be specific and bounded, a single scene lasting minutes not hours' },
    ],

    pacing: {
      totalWordCount: { min: 1400, max: 1800 },
      sceneCount: { min: 4, max: 4 },
    },
  },

  // ============================================================================
  // 7. POETIC/LYRICAL - Circular Return Structure
  // ============================================================================
  {
    id: 'poetic-lyrical',
    name: 'Poetic/Lyrical',
    description: 'Circular structure - the ending returns to the opening image, transformed by what came between',
    tags: ['literary', 'circular', 'meditative'],
    eraNarrativeWeight: 'flavor',
    format: 'story',

    narrativeInstructions: `STRUCTURE: CIRCULAR RETURN
The story is a loop. The final scene returns to the opening image, but everything has changed. The structure itself carries meaning - time circles, understanding deepens, what seemed simple becomes complex.

=== SCENE 1: THE IMAGE ===
A single vivid image, described with full attention. This is the poem's secret heart. Concrete and specific - a particular light, a particular object, a particular quality of air.

Do not explain what it means. The meaning is in the seeing.

This scene should be SHORT - a paragraph or two of pure presence. End the scene while still in the image.

=== SCENE 2: DEPARTURE ===
Movement away. The consciousness begins to wander - through memory, through association, through what the image evokes. Time becomes fluid. Past and present may interweave.

One image leads to another through hidden rhymes - color, texture, feeling, sound. The path is emotional logic, not narrative logic.

The absence (if one is assigned) may hover here - what is longed for or lost.

=== SCENE 3: THE ENCOUNTER ===
A presence enters. Another consciousness, a visitor, a memory made vivid. Conversation is less about information than about rhythm - what's said, what's almost said, what remains silent.

This is not plot. This is two presences sharing space, briefly.

=== SCENE 4: THE RETURN ===
Return to the opening image. Use SIMILAR OR IDENTICAL LANGUAGE from Scene 1, but now every word carries the weight of what came between.

The image has not changed. The consciousness has.

End IN the image, not after it. No explanation. No moral. Just the image, seen newly.`,

    proseInstructions: `TONE: Luminous, precise, haunting. Every word chosen for sound as well as meaning.

DIALOGUE: Sparse. When words come, they carry weight. Silences are as important as speech. What is not said.

DESCRIPTION: Concrete details that open into abstraction. Synesthesia welcome - colors that sound, textures that taste. Find the exact word even if it takes the whole sentence to get there.

TECHNIQUE - REPETITION WITH VARIATION: Key phrases, images, rhythms should echo. Not identical repetition but rhyme - the same shape with different content.

TECHNIQUE - WHITE SPACE: Let scenes breathe. Short paragraphs. Space between movements. Trust silence.

TECHNIQUE - THE RETURN: The final scene should quote or closely echo the opening. The reader should feel the loop close - same words, different weight.

AVOID: Plot mechanics. Explaining what images mean. Rushing to conclusion. Generic "beautiful" language - find the strange, specific beauty.`,

    eventInstructions: 'Events are prompts for meditation, not drivers. They exist to be contemplated, not resolved.',

    craftPosture: `- Trust the image. If it needs explanation, replace the explanation with a better image.
- White space is compositional. Short paragraphs. Let the poem breathe in gaps.
- Sound and meaning carry equal weight. Rhythm is a structural element.`,

    titleGuidance: 'The title is an image, not a description of one. One to four words. Concrete and sensory — a color, a texture, a quality of light, a natural element. It should carry the emotional weight of the whole piece in a single phrase the reader returns to after finishing. Sound matters as much as meaning; say it aloud.',

    roles: [
      { role: 'consciousness', count: { min: 1, max: 1 }, description: 'The perceiving presence - we see through them, feel with them' },
      { role: 'the-image', count: { min: 1, max: 1 }, description: 'The central image that opens and closes the loop - must be concrete and specific' },
      { role: 'presence', count: { min: 0, max: 1 }, description: 'What enters awareness - visitor, memory, other consciousness' },
      { role: 'absence', count: { min: 0, max: 1 }, description: 'What is longed for or lost - may never appear directly' },
    ],

    pacing: {
      totalWordCount: { min: 1000, max: 1400 },
      sceneCount: { min: 3, max: 4 },
    },

  },

  // ============================================================================
  // 8. DARK COMEDY - Cascading Catastrophe Structure
  // ============================================================================
  {
    id: 'dark-comedy',
    name: 'Dark Comedy',
    description: 'One disaster escalating through reasonable responses - the gap between catastrophe and procedure is the comedy',
    tags: ['comedy', 'escalation', 'deadpan'],
    eraNarrativeWeight: 'structural',
    format: 'story',

    narrativeInstructions: `STRUCTURE: CASCADING CATASTROPHE
A single disaster that escalates because every reasonable response makes it worse. Not multiple funny situations - one serious situation met with inadequate tools. The comedy lives in the gap between what's happening and how it's being handled.

Real stakes. Real consequences. Real damage. The fool does everything right and everything goes wrong anyway.

=== SCENE 1: THE SMALL PROBLEM ===
A routine task. Standard procedure. The fool is competent, professional, following protocol. Something small goes wrong - not their fault, just circumstance. They respond reasonably.

Establish the system's rules and the fool's competence within them. The audience should trust that this person knows what they're doing.

=== SCENE 2: THE ESCALATION ===
The reasonable response has made things worse. The problem is no longer small. The fool consults procedure, finds the next appropriate step, implements it correctly.

Things get worse. The system's tools are inadequate but they're the only tools available. The fool keeps documenting.

=== SCENE 3: THE CATASTROPHE ===
Full disaster. Real consequences - people are hurt, things are permanently damaged, the situation is beyond recovery. The fool is still following procedure because what else can they do?

The comedy peaks here: catastrophe unfolding while someone fills out the correct forms. "I followed procedure" spoken into the abyss.

=== SCENE 4: THE SYSTEM CONTINUES ===
Aftermath. The disaster is contained or past. The damage is real and lasting. The system processes what happened through its inadequate categories.

The fool is rewarded - promoted, commended, given more responsibility. Their documentation was thorough. The system learned nothing. A new task awaits.

End with the fool accepting the next assignment, or a new fool approaching the same trap.`,

    proseInstructions: `TONE: Deadpan, clinical, precise. The narrator observes catastrophe with the detachment of an incident report. No one thinks they're in a comedy. Everyone is doing their best.

DIALOGUE: Characters mean what they say. They're not being funny - they're being professional in unprofessional circumstances. Bureaucratic language applied to disaster. Technical terms for catastrophe.

DESCRIPTION: Specific observation of escalating disaster. The exact form number. The precise policy that doesn't cover this situation. The careful documentation of things going irreversibly wrong.

TECHNIQUE - THE GAP: Comedy lives in the distance between what's happening and how it's being processed. Catastrophe described in bureaucratic language. Cosmic horror met with paperwork.

TECHNIQUE - REAL STAKES: People get hurt. Things break permanently. The disaster has consequences that outlast the story. This is not slapstick - the collateral damage matters.

TECHNIQUE - THE COMPETENT FOOL: The protagonist isn't stupid. They're good at their job. They follow procedure correctly. The system is what fails, not the person. The fool must be sympathetic - we would do the same thing in their position.

TECHNIQUE - DEADPAN ESCALATION: Each scene worse than the last, same tone throughout. Never acknowledge the absurdity. The characters take everything seriously. The gap between their seriousness and the situation is the joke.

AVOID: Jokes. Punchlines. Winking at the audience. Characters being funny on purpose. Consequence-free disaster. Stupid protagonists. The tragedy must be real for the comedy to land.`,

    eventInstructions: 'Events are triggers for systemic failure. The catalyst should be small, reasonable, forgettable - something anyone might do. The catastrophe emerges from the system, not the individual.',

    craftPosture: `- Never acknowledge the absurdity. The gap between prose register and content does the work.
- Escalation is procedural, not dramatic. Each step follows logically from the last.
- Linger on consequences. The comedy requires that the damage is real and specific.`,

    titleGuidance: 'The title should sound like a bureaucratic label, an incident report heading, or a perfectly reasonable description of something that is not reasonable at all. Flat register, no winking. The gap between the title\'s composure and the story\'s catastrophe is where the comedy lives. The more procedural and precise, the funnier.',

    roles: [
      { role: 'fool', count: { min: 1, max: 2 }, description: 'The reasonable person trapped in unreasonable circumstances - competent, professional, doing everything right' },
      { role: 'system', count: { min: 1, max: 1 }, description: 'The inadequate structure - bureaucracy, protocol, or procedure that cannot handle what it encounters' },
      { role: 'catalyst', count: { min: 0, max: 1 }, description: 'What sets the disaster in motion - small, routine, the kind of thing that happens every day' },
      { role: 'victim', count: { min: 0, max: 2 }, description: 'Collateral damage - those permanently affected by the catastrophe through no fault of their own' },
    ],

    pacing: {
      totalWordCount: { min: 1600, max: 2200 },
      sceneCount: { min: 4, max: 4 },
    },
  },

  // ============================================================================
  // 9. HEROIC FANTASY - Classic Three-Act Structure
  // ============================================================================
  {
    id: 'heroic-fantasy',
    name: 'Heroic Fantasy',
    description: 'The classic hero\'s journey in explicit three-act form - departure, ordeal, return',
    tags: ['heroic', 'three-act', 'mythic'],
    eraNarrativeWeight: 'structural',
    format: 'story',

    narrativeInstructions: `STRUCTURE: CLASSIC THREE-ACT
The hero's journey in its clearest form. Three distinct movements with clear breaks between them. This is mythic storytelling - good and evil are real, transformation is possible, the world can be saved.

=== ACT I: DEPARTURE (1-2 scenes) ===
The hero in their ordinary world. Establish what they have to lose. The world is already touched by darkness or lacking something vital.

THE CALL: Disruption arrives - the guide appears, the threat manifests, the quest-object reveals itself. The hero may resist ("I can't leave" / "I'm not ready" / "Choose someone else").

THE THRESHOLD: The hero commits. They leave behind everything familiar. The ordinary world recedes. Mark this crossing clearly - a door that won't reopen, a shore that fades, a word that can't be unsaid.

=== ACT II: THE ORDEAL (2-3 scenes) ===
The longest section. The hero faces trials that test specific virtues. Each challenge should test something different - courage, wisdom, sacrifice, trust.

COMPANIONS: Allies appear. Each represents something the hero will need. Their loyalty should be tested and proven.

THE ABYSS: The darkest moment. Apparent defeat. Perhaps a companion falls. The quest seems lost. The hero must find something in themselves they didn't know was there.

=== ACT III: RETURN (1 scene) ===
The final confrontation. Internal and external battles converge. The hero uses everything learned. Victory comes not from strength alone but from transformation.

THE NEW WORLD: Brief glimpse of what victory created. The hero is changed. The world is changed. End with the new order taking shape - not every detail resolved, but the shape clear.`,

    proseInstructions: `TONE: Heroic, stirring, grand. The language of legends. This story wants to be told around fires.

DIALOGUE: Oaths and declarations. Characters speak as if their words will be remembered. Avoid modern idioms. "I will hold this passage" not "I've got this."

DESCRIPTION: Vivid, colorful. Good is beautiful (but not soft); evil is terrible (but not cartoonish). Magic costs something and means something. Landscapes carry moral weight.

TECHNIQUE - THE THRESHOLD: Mark act breaks clearly. The hero crossing into adventure should feel momentous. Don't rush past transitions.

TECHNIQUE - THE TRIAL: Each trial tests something specific. Name it (even if only to yourself). Courage. Trust. Sacrifice. The hero fails or succeeds based on virtue, not luck.

TECHNIQUE - THE TRANSFORMATION: By Act III, the hero should be visibly different from Act I. Show it in how they move, speak, choose.

AVOID: Irony. Deconstruction. Moral ambiguity. Anticlimactic endings. This is not the place to subvert the genre - play it straight.`,

    eventInstructions: 'Events are trials and victories. Each is a step in the hero\'s transformation. Treat them as legendary deeds.',

    craftPosture: `- Mythic simplicity. Clean, powerful strokes over elaborate texture. When in doubt, cut.
- Let sacrifice and transformation speak for themselves. Do not narrativize internal process.
- The world exists through what characters touch and see, not through explanation.`,

    titleGuidance: 'Common words arranged with mythic weight. The title should sound ancient even if every word is simple — the kind of name that survives oral retelling across generations. It names the hero, the quest, or the legendary thing in a way that feels inevitable. Short, rhythmic, spoken-aloud quality. Simple monosyllables over Latinate abstractions.',

    roles: [
      { role: 'hero', count: { min: 1, max: 1 }, description: 'The chosen one - starts ordinary, becomes extraordinary' },
      { role: 'darkness', count: { min: 1, max: 1 }, description: 'The evil to be vanquished - dark lord, corrupting power, or malevolent force' },
      { role: 'guide', count: { min: 0, max: 1 }, description: 'Mentor figure who provides wisdom and/or the call' },
      { role: 'companion', count: { min: 0, max: 2 }, description: 'Those who journey with the hero - may fall, may be saved' },
      { role: 'quest-object', count: { min: 0, max: 1 }, description: 'What is sought - weapon, knowledge, place of power' },
      { role: 'the-calling', count: { min: 0, max: 1 }, description: 'The prophecy, ancient law, forbidden power, or world-event that sets the quest in motion. Defines what the hero must confront beyond any single enemy' },
    ],

    pacing: {
      totalWordCount: { min: 1800, max: 2400 },
      sceneCount: { min: 4, max: 6 },
    },
  },

  // ============================================================================
  // 10. TRAGEDY - In Medias Res Structure
  // ============================================================================
  {
    id: 'tragedy',
    name: 'Tragedy',
    description: 'Begin at the fall, then show how we got there - the ending is known, the tragedy is in the becoming',
    tags: ['tragic', 'non-linear', 'inevitable'],
    eraNarrativeWeight: 'structural',
    format: 'story',

    narrativeInstructions: `STRUCTURE: ENDING FIRST - THEN FLASHBACK
We open at the chronological END. Then we go back to show how it came to this. The audience knows the ending; the doomed does not. Tragic irony pervades every scene.

=== SCENE 1: THE ENDING (PRESENT) ===
CRITICAL: This is the CHRONOLOGICAL END of the story. Do NOT open with the doomed at their height. Do NOT start with things going well. Do NOT begin at the beginning.

Open with destruction already underway - the throne already lost, the cascade already consuming, the resignation already being spoken, the betrayal already revealed. The reader sees devastation before they understand why.

This scene should disorient. We don't know these people yet. We don't know what led here. We only know it's terrible. Show the cost before we understand it.

End mid-fall. Do not resolve.

=== SCENE 2: THE HEIGHT (PAST) ===
Flash back to before. The doomed at their peak. Their power, their glory, their certainty. Show why they mattered. Show why this fall will be devastating.

But also show THE FLAW. The thing that will destroy them is visible here, if you know to look. Pride that reads as confidence. Rigidity that reads as principle. The seed of destruction in the flower of success.

=== SCENE 3: THE TEMPTATION (PAST) ===
Still in the past, later. An opportunity appears. Taking it is completely in character - this is who the doomed IS. The flaw makes it feel right.

The audience knows where this leads. The doomed does not. Dramatic irony: every confident word is heartbreaking.

End with the line crossed that cannot be uncrossed.

=== SCENE 4: THE RECOGNITION (PRESENT) ===
Return to the present. We've caught up to Scene 1 and pass it. The destruction completes.

The moment of terrible clarity. The doomed finally sees what we have seen all along. They understand their flaw, their complicity, the shape of their own destruction.

This recognition is devastating because it comes too late. End in that knowledge. Something has been lost that cannot be recovered.

NOTE: Scenes 1 and 4 are the SAME timeframe (present). Scenes 2 and 3 are flashback (past). The story structure is: END → BEGINNING → MIDDLE → END.`,

    proseInstructions: `TONE: Inevitable, magnificent, terrible. The weight of fate. Words that sound like eulogy even as events unfold.

DIALOGUE: Characters speak as if history is listening. Formal, weighted. Past-tense scenes should include lines that land differently knowing the ending. "This peace will last" is unbearable when we've seen the war.

DESCRIPTION: Beauty and destruction intertwined. The grandeur of what's falling. Imagery of height and fall, breaking, things that cannot be mended.

TECHNIQUE - TRAGIC IRONY: Every scene in the past should contain lines that mean one thing to the character and another to the audience. Confidence that we know is misplaced. Promises we know will break.

TECHNIQUE - THE FLAW VISIBLE: In Scene 2, the flaw must be present but not labeled. The audience should recognize it; the doomed cannot. Show, don't name.

TECHNIQUE - THE RECOGNITION: This is the emotional climax. The doomed's face when they finally see. Spend time on this moment. Let it land.

AVOID: Redemption arcs. Last-minute saves. Villains to blame. The tragedy is that the doomed did this to themselves.`,

    eventInstructions: 'Events are steps toward doom. Each should feel inevitable in retrospect. The audience should see them coming before the characters do.',

    craftPosture: `- Dramatic irony sustains elaboration. Every detail carries double weight when the ending is known. Lean into that richness.
- Show the flaw, don't name it. Invest density in establishing what will be lost.
- Give the moment of recognition room. Cut anything that makes the doom feel accidental.`,

    titleGuidance: 'The title carries the weight of a thing already decided. It names the fall, the figure, or the flaw — often compressed into a single phrase. Elegiac register: the sound of aftermath, not anticipation. Tragedy is not about surprise; the title is the spoiler the reader accepts because watching the inevitable arrive is the point.',

    roles: [
      { role: 'doomed', count: { min: 1, max: 1 }, description: 'The great figure who will fall - their greatness and their flaw must both be real' },
      { role: 'flaw', count: { min: 0, max: 1 }, description: 'The fatal weakness - hubris, rigidity, blind spot. May be embodied in a choice, belief, or relationship' },
      { role: 'enabler', count: { min: 0, max: 1 }, description: 'Those who feed the destruction - sycophants, or simply those who don\'t say no' },
      { role: 'witness', count: { min: 0, max: 1 }, description: 'Who survives to tell the tale, to carry the memory' },
    ],

    pacing: {
      totalWordCount: { min: 1600, max: 2200 },
      sceneCount: { min: 4, max: 4 },
    },
  },

  // ============================================================================
  // 11. MYSTERY/SUSPENSE - Revelation Reframe Structure
  // ============================================================================
  {
    id: 'mystery-suspense',
    name: 'Mystery/Suspense',
    description: 'Write the opening so it can be reread after the revelation - clues hidden in plain sight',
    tags: ['mystery', 'revelation', 'rereadable'],
    eraNarrativeWeight: 'structural',
    format: 'story',

    narrativeInstructions: `STRUCTURE: REVELATION THAT REFRAMES
The truth, when revealed, should send the reader back to Scene 1 with new eyes. Write the opening knowing the ending - hide clues in plain sight, make innocent details secretly damning.

=== SCENE 1: THE QUESTION ===
Establish the mystery. Something is wrong, hidden, unexplained. The investigator is drawn in.

CRITICAL: Write this scene knowing the answer. Include:
- At least one detail that seems innocent but is actually a clue
- At least one statement that means something different than it appears
- The culprit, if present, behaving in a way that's explicable NOW but damning LATER

The reader should be able to return after Scene 4 and say "it was right there."

=== SCENE 2: LAYER ONE ===
First theory. Evidence that supports it. The investigator pursues a plausible but wrong explanation.

This should feel like progress. The reader should be tempted to think they've solved it.

=== SCENE 3: LAYER TWO ===
The first theory breaks. New evidence doesn't fit. Something in Scene 1 or 2 meant something different than assumed.

Doubt. Reexamination. The investigator (and reader) must reconsider everything.

=== SCENE 4: THE REVELATION ===
The truth. Not just "whodunit" but WHY the clues in Scene 1 pointed there all along. The revelation should make the reader want to reread the opening.

Show consequences. Justice may or may not be served. But truth is exposed.`,

    proseInstructions: `TONE: Suspicious, attentive, uneasy. The prose notices things - details that might matter, behaviors that might mean something.

DIALOGUE: Everyone has something to hide. Listen for evasions, careful word choice, statements that are technically true but misleading.

DESCRIPTION: Clues hidden in texture. The reader should be able to solve it, but not easily. Fair play - nothing hidden from the reader that the investigator could see.

TECHNIQUE - THE PLANT AND PAYOFF: Every clue in Scene 1 must pay off in Scene 4. Every revelation in Scene 4 must have been planted in Scene 1-2. Map this explicitly before writing.

TECHNIQUE - DOUBLE MEANING: Dialogue in Scene 1 should be writable with two meanings - the surface meaning for first-read, the true meaning for re-read. "I haven't seen her since yesterday" might be technically true but misleading.

TECHNIQUE - THE INNOCENT DETAIL: The most damning clue should seem most innocent. A cup in the wrong place. A window that should have been closed. Something the reader's eye passes over.

AVOID: Cheating. Clues the reader couldn't have noticed. Revelations that come from nowhere. Detectives who explain rather than demonstrate.`,

    eventInstructions: 'Events are clues with surface meaning and hidden meaning. Write knowing both.',

    craftPosture: `- Front-load density. The opening requires the most craft — it must work innocently and reward re-reading.
- Invest equally in false leads. Wrong theories deserve real evidence.
- The revelation reframes, it doesn't explain. Show the new shape, don't narrate it.`,

    titleGuidance: 'The title should function twice: innocently on first encounter, devastatingly on re-read. Name the clue hidden in plain sight, the detail that seemed ordinary, the phrase that turns out to mean something else. Simple surface, specific enough to be the key. After the revelation, the reader should look at the title and feel it click.',

    roles: [
      { role: 'investigator', count: { min: 1, max: 1 }, description: 'The seeker of truth - we follow their attention, share their mistakes' },
      { role: 'mystery', count: { min: 1, max: 1 }, description: 'What must be solved - crime, disappearance, inexplicable event' },
      { role: 'suspect', count: { min: 1, max: 2 }, description: 'Plausible but wrong answers - red herrings that feel real' },
      { role: 'culprit', count: { min: 1, max: 1 }, description: 'The true answer - present from the start, hidden in plain sight' },
    ],

    pacing: {
      totalWordCount: { min: 1500, max: 2000 },
      sceneCount: { min: 4, max: 4 },
    },
  },

  // ============================================================================
  // 12. TREASURE HUNT - Extended Quest Structure
  // ============================================================================
  {
    id: 'treasure-hunt',
    name: 'Treasure Hunt',
    description: 'The journey is the story - multiple trials, each testing something different, building to discovery',
    tags: ['quest', 'trials', 'adventure'],
    eraNarrativeWeight: 'structural',
    format: 'story',

    narrativeInstructions: `STRUCTURE: QUEST WITH TRIALS
More scenes than other styles. The journey matters as much as the destination. Each trial tests something different; the seeker is transformed by the seeking.

=== SCENE 1: THE LEGEND ===
The treasure must be established as worth pursuing. Not just valuable - meaningful. A rumor, a dying mentor's revelation, a fragment of map.

Establish the seeker's motivation - both practical (what they'll gain) and personal (why THEY must seek this). Establish the rival or guardian if present.

End with departure. The ordinary world left behind.

=== SCENES 2-4: THE TRIALS ===
Three distinct challenges on the path to the treasure. Each should:
- Test a different virtue (wit, will, sacrifice, trust, humility)
- Reveal something about the seeker's character
- Change the seeker in some way
- Bring them closer to (or seemingly further from) the goal

At least one trial should involve the rival. At least one should require sacrifice - giving something up to continue.

Trials are not just obstacles; they're teachers.

=== SCENE 5: THE THRESHOLD ===
The final barrier. The resting-place revealed. The guardian's test (if there is one).

The treasure discovered. This should be a moment of awe - and possibly terror. The object should exceed or subvert expectations. Show its power, its cost, its weight.

=== SCENE 6: THE CHOICE ===
Possessing the treasure changes everything. What will the seeker do?

Keep it? Destroy it? Pass it on? Use it and accept the cost?

The ending should honor the difficulty of the journey. The seeker is not who they were when they started.`,

    proseInstructions: `TONE: Adventurous, reverent, driven. Wonder at the world's hidden places. Respect for the treasure's power.

DIALOGUE: Seekers speak of the treasure with awe or hunger. Guardians speak in riddles or challenges. Rivals speak with competing claim.

DESCRIPTION: Rich detail for the treasure and its resting-place. Age and power should be tangible. The artifact described with precision - materials, markings, weight, the way light interacts with it. Locations should feel ancient, layered, earned.

TECHNIQUE - THE TRIAL'S LESSON: Each trial teaches something the seeker will need later. The connection may not be obvious until the final scenes.

TECHNIQUE - THE WORTHY SEEKER: The journey should change the seeker. They should earn the treasure not through strength but through becoming someone capable of possessing it.

TECHNIQUE - THE WEIGHT OF DISCOVERY: The moment of finding should be emotional peak. Spend time on it. The reader should feel the accumulated weight of the journey.

AVOID: Easy victories. Luck over virtue. Anticlimactic discovery. Treasure that's just valuable rather than meaningful.`,

    eventInstructions: 'Events are trials and revelations. Each advances the journey and tests the seeker.',

    craftPosture: `- Each trial earns its space by testing something distinct. Redundant challenges should be cut.
- Invest density in the moment of discovery. The reader should feel the accumulated weight of the journey.
- Establish what will be sacrificed before it's lost. Cost requires prior investment.`,

    titleGuidance: 'The title should carry the pull of the thing sought — name the treasure, the legendary place, or the threshold that must be crossed. The register is reverent and hungry: the way seekers speak about what they have spent their lives pursuing. A named object is more compelling than a category; specificity creates desire.',

    roles: [
      { role: 'treasure', count: { min: 1, max: 1 }, description: 'The artifact sought - not just valuable but meaningful, with history and power' },
      { role: 'seeker', count: { min: 1, max: 2 }, description: 'Those who pursue - defined by why they seek and what they\'ll sacrifice' },
      { role: 'guardian', count: { min: 0, max: 1 }, description: 'What protects the treasure - may be creature, trap, curse, or test' },
      { role: 'rival', count: { min: 0, max: 1 }, description: 'Competing seeker - their presence raises stakes and reveals character' },
      { role: 'resting-place', count: { min: 0, max: 1 }, description: 'Where the treasure waits - the final destination, earned' },
      { role: 'the-price', count: { min: 0, max: 1 }, description: 'The rule, curse, ability, or consequence bound to the treasure. What possessing it demands. The cost that makes the seeker hesitate' },
    ],

    pacing: {
      totalWordCount: { min: 1800, max: 2400 },
      sceneCount: { min: 5, max: 6 },
    },
  },

  // ============================================================================
  // 13. HAUNTED RELIC - Dual Timeline Structure
  // ============================================================================
  {
    id: 'haunted-relic',
    name: 'Haunted Relic',
    description: 'Alternating past and present - the curse\'s origin and its current manifestation intercut',
    tags: ['horror', 'dual-timeline', 'curse'],
    eraNarrativeWeight: 'structural',
    format: 'story',

    narrativeInstructions: `STRUCTURE: DUAL TIMELINE
Past and present given equal weight. The curse's origin and its current manifestation illuminate each other. Each timeline is incomplete alone; together they reveal the full horror.

=== SCENE 1 (PRESENT): ACQUISITION ===
The artifact comes into the victim's possession. It seems fortunate - inheritance, discovery, gift, purchase. Something feels slightly wrong but is easily dismissed.

Establish the victim's normal life - what they have to lose.

=== SCENE 2 (PAST): ORIGIN ===
How the curse was laid. Who was wronged. What made this object terrible.

This should be a complete mini-story - sympathetic or horrifying, but understandable. The curse has logic, even if it's terrible logic.

=== SCENE 3 (PRESENT): MANIFESTATION ===
The curse affecting the victim. Small wrongnesses accumulating - dreams, relationships, body. The pattern from Scene 2 beginning to repeat.

The victim may not yet connect this to the artifact.

=== SCENE 4 (PAST): THE CYCLE ===
A previous owner. Their fate. The pattern that the victim is now entering.

Now the reader sees the full shape: origin, previous victim, current victim. The repetition is the horror.

=== SCENE 5 (PRESENT): RECKONING ===
The victim understands. They've seen (or learned) the pattern from the past. They know what's coming.

Choice: bear it, pass it on, attempt to break it. Whatever the outcome, the artifact survives. The cycle will continue.`,

    proseInstructions: `TONE: Creeping dread, wrong, beautiful-terrible. Past scenes may have different texture than present (more formal? more vivid?).

DIALOGUE: Present-day characters talk around the horror - euphemism, denial, nervous deflection. Past characters may be more direct; they're already lost.

DESCRIPTION: Sensory wrongness. The artifact feels, sounds, smells slightly off. Cumulative unease. The horror is in accumulation of small details, not sudden shocks.

TECHNIQUE - TIMELINE RHYME: Past and present scenes should echo. Same phrases in different mouths. Same gestures across centuries. Same doomed hope.

TECHNIQUE - THE PATTERN: By Scene 4, the reader should be able to predict Scene 5. The inevitability is the horror.

TECHNIQUE - BEAUTIFUL TERRIBLE: The artifact should be beautiful or valuable. Its appeal makes the curse worse. We understand why people keep taking it.

AVOID: Jump scares. Gore without meaning. Easy cures. Heroes who don't suffer. The curse must cost.`,

    eventInstructions: 'Events are manifestations of the curse across time. Past events foreshadow; present events echo.',

    craftPosture: `- Accumulate dread through small details, not dramatic reveals. Wrongness creeps.
- Both timelines at equal density. Neither is backstory for the other.
- Invest as much detail in the artifact's appeal as in its horror.`,

    titleGuidance: 'Name the specific thing that carries the curse — the object, the place, or the sensation of wrongness. Concrete nouns are more unsettling than abstract ones. The title should feel inert on the surface, the way a cursed object looks harmless on a shelf. The dread is in what the reader brings back to it after reading.',

    roles: [
      { role: 'artifact', count: { min: 1, max: 1 }, description: 'The cursed object - beautiful and terrible, its appeal is part of the trap' },
      { role: 'victim', count: { min: 1, max: 1 }, description: 'Present-day possessor - we watch them enter the pattern' },
      { role: 'origin', count: { min: 0, max: 1 }, description: 'Who or what created the curse - the wronged, the sacrifice, the malevolence' },
      { role: 'previous-owner', count: { min: 1, max: 2 }, description: 'Past victims whose fate foreshadows the present' },
      { role: 'the-binding', count: { min: 0, max: 1 }, description: 'The rule, power, or event that created the curse - not a person but the mechanism itself. The logic that makes the pattern repeat' },
    ],

    pacing: {
      totalWordCount: { min: 1600, max: 2000 },
      sceneCount: { min: 5, max: 5 },
    },
  },

  // ============================================================================
  // 14. LOST LEGACY - Generational Mosaic Structure
  // ============================================================================
  {
    id: 'lost-legacy',
    name: 'Lost Legacy',
    description: 'Multiple generations, no privileged present - the artifact is the protagonist, carrying meaning through time',
    tags: ['generational', 'mosaic', 'inheritance'],
    eraNarrativeWeight: 'structural',
    format: 'story',

    narrativeInstructions: `STRUCTURE: GENERATIONAL MOSAIC
The artifact is the protagonist. Each scene is a different generation - a complete mini-story showing what the artifact meant in that time. No single "present" is privileged; all generations are equally real.

=== SCENE 1: FIRST GENERATION ===
The artifact's origin or first significant moment in the lineage. A complete mini-story - character, conflict, resolution - but brief.

What did the artifact mean to this generation? What did they add to its meaning? How did it come to pass on?

=== SCENE 2: MIDDLE GENERATION ===
A different time. The artifact has traveled - years, decades, maybe centuries. The world has changed. The artifact means something different now.

Another complete mini-story. Different character, different conflict. But echoes of the first - same object, evolved meaning.

=== SCENE 3: LATER GENERATION ===
Still later. The pattern visible now. What the artifact carries across time - not just material but meaning, obligation, curse, blessing.

The reader sees the through-line. Each generation added something. The artifact is layered with history.

=== SCENE 4: THE CURRENT HOLDER ===
The most recent generation. Briefer than the others - not privileged, just the current moment in an ongoing story.

The current holder faces a choice that acknowledges all that came before. Keep faith? Transform the meaning? End the line?

The artifact passes on (or is destroyed, or is transformed). The story doesn't end - it just leaves our view.`,

    proseInstructions: `TONE: Generational, layered, bittersweet. Each generation has its own texture - vocabulary, concerns, relationship to the past.

DIALOGUE: Family speaks in echoes. Phrases passed down. Expectations unspoken. The artifact discussed differently in each era.

DESCRIPTION: The artifact described differently in each generation. Same object, different seeing. What one generation treasured, another might resent. What one polished, another let tarnish.

TECHNIQUE - GENERATION VOICES: Each scene should feel like its era. Not just vocabulary but concerns, assumptions, what's normal and what's strange.

TECHNIQUE - THE ECHO: Moments should rhyme across generations. Same gesture, different meaning. Same choice, different outcome. The repetition reveals the pattern.

TECHNIQUE - THE ARTIFACT'S JOURNEY: Track what happens to the artifact between scenes. It may be treasured, neglected, lost and found, modified, restored. Its physical state tells a story.

AVOID: Privileging one generation as "the real story." Sentimentality about ancestors. Simple inheritance (good artifact from good ancestors). The artifact should be complicated.`,

    eventInstructions: 'Events span generations. What happened to the artifact? How did it pass? What moments changed its meaning?',

    craftPosture: `- Gesture over catalog. Compress institutional detail to the single telling moment.
- Deaths and departures in half-sentences. Don't linger.
- Each generation gets exactly what it needs, no more. Silence is content, not a gap.`,

    titleGuidance: 'The title names what endured across generations — a place, a family name, an object, a tradition. It should carry the particular melancholy of things that outlast the people who made them. Retrospective and institutional register, like a plaque on a building or the name of an estate. Time should be felt in the title even if no time word appears.',

    roles: [
      { role: 'artifact', count: { min: 1, max: 1 }, description: 'The object that passes through time - the true protagonist, carrying accumulated meaning' },
      { role: 'first-generation', count: { min: 1, max: 1 }, description: 'Origin point - who made it, found it, first held it' },
      { role: 'middle-generation', count: { min: 1, max: 2 }, description: 'Those between - who carried, changed, lost, or saved it' },
      { role: 'current-holder', count: { min: 1, max: 1 }, description: 'Present moment - facing the choice of what to do with inherited meaning' },
      { role: 'the-obligation', count: { min: 0, max: 1 }, description: 'The law, tradition, ability, or historical event bound to the artifact. What each generation inherits alongside the object - duty, prohibition, or power' },
    ],

    pacing: {
      totalWordCount: { min: 1600, max: 2000 },
      sceneCount: { min: 4, max: 4 },
    },
  },

  // ============================================================================
  // 15. CONFESSION - Unreliable Monologue Structure
  // ============================================================================
  {
    id: 'confession',
    name: 'Confession',
    description: 'A single voice justifying themselves to someone - judge, lover, god, or self. The reader sees what the speaker cannot.',
    tags: ['unreliable', 'first-person', 'intimate', 'self-deception'],
    eraNarrativeWeight: 'structural',
    format: 'story',

    narrativeInstructions: `STRUCTURE: UNRELIABLE MONOLOGUE
The entire story is one voice speaking to an audience. The speaker is trying to justify, explain, or confess. They believe they are being honest. They are not. The reader must assemble the truth from the gaps, contradictions, and telling omissions.

=== MOVEMENT 1: THE FRAME ===
Establish who is speaking and to whom. A prisoner before judgment. A lover explaining why they did what they did. A leader defending their reign. A parent justifying a choice.

The speaker should sound reasonable, sympathetic, even compelling. They believe their version. Set the reader up to believe it too - briefly.

=== MOVEMENT 2: THE ACCOUNT ===
The speaker tells their story. What happened, why they acted as they did, what they felt. This is their truth.

But: include details that don't quite fit. A justification that's slightly too elaborate. A person described with too much venom or too little grief. An event glossed over that deserves more attention. The speaker doesn't notice these cracks. The reader should.

=== MOVEMENT 3: THE UNRAVELING ===
The speaker's account begins to contradict itself - or the emotional register shifts in ways that reveal the lie beneath. They may become defensive without being challenged. They may over-explain something nobody questioned. They may suddenly change the subject from something important.

The audience (judge, lover, god) may be implied to react - the speaker responds to unheard objections, defends against unspoken accusations.

=== MOVEMENT 4: THE FINAL PLEA ===
The speaker concludes. They may circle back to their opening claim. They may make a desperate bid for absolution, understanding, or vindication.

The reader now holds two stories: the one the speaker told, and the one visible through the cracks. Do NOT resolve which is "true." The monologue ends. The speaker believes they have made their case.`,

    proseInstructions: `TONE: Intimate, persuasive, self-aware-but-not-enough. The speaker is intelligent and articulate - this is not a fool lying badly. This is someone who has convinced themselves.

DIALOGUE: There is only one voice. The speaker may quote others, but always filtered through their interpretation. Quoted speech reveals the speaker's bias, not the quoted person's truth.

DESCRIPTION: Selective. The speaker describes what serves their narrative. What they omit is as telling as what they include. Physical details are emotionally loaded - enemies described with disgust, allies idealized.

TECHNIQUE - THE CRACK: At least three moments where the speaker's account doesn't hold. These should be subtle enough that a first-time reader might miss them, but a re-reader will catch.

TECHNIQUE - THE TELL: The speaker has a verbal habit that intensifies when they're lying or avoiding. Repetition of a phrase. Sudden formality. Switching from "I" to "one" or "we."

TECHNIQUE - THE ABSENT VOICE: The person the speaker wronged is never given their own words fairly. Their silence (or misquotation) is the loudest thing in the story.

AVOID: Making the speaker obviously villainous. Making the "truth" explicitly stated. Third-person intrusion. The speaker must remain sympathetic even as the reader sees through them.`,

    eventInstructions: 'Events are what the speaker is trying to explain or justify. Their version of events is the story. The true version is what the reader infers.',

    craftPosture: `- Invest in making the speaker's version compelling. The self-deception only works if their account is persuasive.
- Calibrate crack visibility — catchable on re-read, not on first pass.
- The unraveling is self-generated. Excess justification, not external contradiction, does the revealing.`,

    titleGuidance: 'The title belongs to the speaker — it is what they would call their own account. It should carry their particular self-deception: a justification framed as a title, a euphemism for what they did, or a claim about themselves the reader will learn to doubt. Intimate register. The title is the first unreliable thing the speaker says.',

    roles: [
      { role: 'confessor', count: { min: 1, max: 1 }, description: 'The speaker - articulate, self-deceiving, sympathetic despite everything' },
      { role: 'audience', count: { min: 1, max: 1 }, description: 'Who the confession is addressed to - judge, lover, deity, self. May never speak but shapes the confession' },
      { role: 'the-wronged', count: { min: 1, max: 1 }, description: 'The person the speaker harmed - present only through the speaker\'s distorted account' },
      { role: 'the-event', count: { min: 0, max: 1 }, description: 'What happened - the act being justified or confessed' },
    ],

    pacing: {
      totalWordCount: { min: 1200, max: 1800 },
      sceneCount: { min: 3, max: 4 },
    },

  },

  // ============================================================================
  // 16. FABLE - Allegorical Tale Structure
  // ============================================================================
  {
    id: 'fable',
    name: 'Fable',
    description: 'History exaggerated into allegory - real events mythologized, real people made into archetypes, truth bent to serve a moral',
    tags: ['allegorical', 'mythologized', 'didactic', 'embellished'],
    eraNarrativeWeight: 'structural',
    format: 'story',

    narrativeInstructions: `STRUCTURE: ALLEGORICAL TALE
This is history that has been told so many times it has become myth. Real events are exaggerated. Real people are simplified into archetypes - the Clever One, the Proud King, the Faithful Servant. Details are wrong in ways that serve the story's moral. The teller doesn't know (or care) what really happened. They know what the story MEANS.

=== SCENE 1: THE WORLD AS IT WAS ===
Establish the setting with the simplicity of folk narrative. "In the time when the rivers ran backward" or "When the first stones were laid." The world is painted in broad strokes - good and evil, wise and foolish, rich and poor.

Introduce the central figure as an archetype, not a person. They may have a real name from the world, but they are described by their defining trait. "The merchant who could not stop counting" or "The queen who trusted only mirrors."

=== SCENE 2: THE TEST ===
A challenge arrives that will expose the central figure's nature. The test is simple but resonant - a choice between easy and right, between self and other, between the clever path and the true one.

Other figures appear as archetypes too: the trickster, the innocent, the wise animal, the disguised stranger. They speak in proverbs or riddles. The world of the fable is stylized, not realistic.

=== SCENE 3: THE CONSEQUENCE ===
The choice is made and its results unfold with the inexorability of folk logic. Good choices bear fruit (though perhaps not immediately). Bad choices carry exactly the punishment they deserve - poetic, proportional, often ironic.

The exaggeration is deliberate: numbers are rounded up, feats are magnified, failures are spectacular. A real battle becomes "a thousand against one." A real drought becomes "the year the sky forgot how to weep."

=== SCENE 4: THE MORAL ===
The story concludes with its lesson - stated directly or embodied in a final image. The moral may be wise or questionable (folk wisdom is not always just). The teller presents it as eternal truth.

End with a formulaic closing: "And so it is to this day..." or "Which is why we say..." The fable becomes part of the culture's living wisdom.`,

    proseInstructions: `TONE: Folk-narrative, oral, stylized. The voice of someone who has told this story a hundred times. Confident, rhythmic, slightly performative.

DIALOGUE: Characters speak in aphorisms, riddles, or declarations. No naturalistic conversation. "You may take the gold or the goat, but not both" - the language of fable.

DESCRIPTION: Bold, simple, symbolic. Colors are primary. Landscapes are archetypal (the dark forest, the golden city, the endless desert). Details serve the moral, not realism.

TECHNIQUE - THE EXAGGERATION: Real historical events should be visibly inflated. If a siege lasted three months, the fable says three years. If a leader was cunning, the fable says they could outwit the wind itself. The exaggeration IS the style.

TECHNIQUE - THE ARCHETYPE: Characters are their defining trait. They do not have interior lives in the fable. They act as their nature demands. The clever one is always clever. The proud one cannot bend.

TECHNIQUE - THE FORMULA: Use repetitive structures. Things happen in threes. Challenges escalate. The same phrase appears at each stage, slightly changed. The rhythm of oral storytelling.

AVOID: Psychological complexity. Moral ambiguity (the fable has a clear lesson, even if the lesson is debatable). Modern irony. Realistic dialogue. The fable is not trying to be true - it is trying to be memorable.`,

    eventInstructions: 'Events are the raw material that the fable exaggerates. A real battle becomes a legendary clash. A real betrayal becomes an eternal cautionary tale. The fable does not respect facts - it respects meaning.',

    craftPosture: `- Bold strokes. Simplify to archetype. Do not complicate characters beyond their defining trait.
- Embrace formulaic patterns. Repetition and escalation are structural tools, not flaws.
- Exaggerate without apology. Inflate scale deliberately. State the moral directly.`,

    titleGuidance: 'Name the creature, the object, or the choice at the center. Fable titles are the simplest of all forms — they work as labels spoken by a storyteller to a listening audience. Oral and declarative register. No subtlety, no double meaning. The title announces what the story is about with the directness of someone who has told it a hundred times.',

    roles: [
      { role: 'archetype', count: { min: 1, max: 1 }, description: 'The central figure - defined by one trait, simplified from a real entity into a folk character' },
      { role: 'the-test', count: { min: 1, max: 1 }, description: 'The challenge or choice that reveals character - simple, resonant, archetypal' },
      { role: 'the-trickster', count: { min: 0, max: 1 }, description: 'A figure who disrupts, tests, or teaches through mischief or disguise' },
      { role: 'the-lesson', count: { min: 0, max: 1 }, description: 'The moral embodied - may be a person, object, or consequence' },
    ],

    pacing: {
      totalWordCount: { min: 800, max: 1400 },
      sceneCount: { min: 3, max: 4 },
    },
  },

  // ============================================================================
  // 17. TRIAL & JUDGMENT - Adversarial Structure
  // ============================================================================
  {
    id: 'trial-judgment',
    name: 'Trial & Judgment',
    description: 'Adversarial courtroom or tribunal - two sides construct opposing narratives from the same facts, judgment falls',
    tags: ['adversarial', 'formal', 'justice', 'multi-voice'],
    eraNarrativeWeight: 'structural',
    format: 'story',

    narrativeInstructions: `STRUCTURE: ADVERSARIAL TRIBUNAL
Two opposing narratives built from the same facts. The accused and the accuser each construct a story. Witnesses complicate both. The judge (or the reader) must weigh truth from rhetoric. Justice may or may not be served.

=== SCENE 1: THE CHARGES ===
The tribunal opens. Formal setting - court, council chamber, sacred ground, or public square. The charges are read. The accused is named. The stakes are clear (punishment, exile, death, disgrace).

Establish the tribunal's authority and rules. Who presides. What customs govern. The formality should feel real and specific to this world.

The accused enters. First impression - how they carry themselves. Defiant? Resigned? Performing innocence?

=== SCENE 2: THE PROSECUTION ===
The accuser makes their case. Witnesses called. Evidence presented. A coherent narrative of guilt constructed from facts, testimony, and implication.

This should be compelling. The reader should feel the weight of the case. Specific incidents. Named witnesses. Documented acts.

But also: notice what the prosecution emphasizes and what it skips. What questions it doesn't ask. What emotional appeals it makes. The prosecution has a story, and stories are selective.

=== SCENE 3: THE DEFENSE ===
The accused (or their advocate) responds. The same facts reframed. Witnesses challenged. Context provided that changes meaning. What looked like guilt from one angle looks like necessity, loyalty, or misunderstanding from another.

This should also be compelling. The reader should feel the case shift. The defense has its own omissions, its own selective emphasis.

At least one moment where a witness says something that cuts both ways - useful to prosecution AND defense, depending on interpretation.

=== SCENE 4: THE JUDGMENT ===
Deliberation (brief) and verdict. The judge or tribunal weighs what was heard.

The verdict should feel earned but arguable. Whether guilty or innocent, the reader should be able to see how the opposite verdict was also defensible. Justice is a human institution with human limits.

End with the aftermath: the accused's face. The accuser's reaction. What the verdict means for both. The tribunal disperses. The consequences begin.`,

    proseInstructions: `TONE: Formal, combative, procedural. The passion is channeled through legal structure. Characters at their most controlled - which makes breaks in composure devastating.

DIALOGUE: Rhetorical. The prosecution and defense are performing for the tribunal. Witnesses speak under constraint - oath, fear, loyalty. The best dialogue has subtext: what they're not allowed to say.

DESCRIPTION: The courtroom/tribunal space should feel specific. Where people sit. Who watches. The accused's hands. The judge's expression. Small physical details carry enormous weight in a space where words are all that matter.

TECHNIQUE - THE CONTESTED FACT: At least one piece of evidence should be interpreted completely differently by prosecution and defense. Same object, same event - two irreconcilable meanings.

TECHNIQUE - THE WITNESS: Witnesses should feel like real people dragged into formal proceedings. Their discomfort, their partial knowledge, their divided loyalties are visible through the formal structure.

TECHNIQUE - THE JUDGE'S BURDEN: The person who must decide should be visible struggling. The verdict is not obvious. Show the weight of judgment.

AVOID: Clear-cut guilt or innocence. Perry Mason revelations. Courtroom drama cliches (surprise witness, last-minute evidence). The truth should remain genuinely contested.`,

    eventInstructions: 'Events are evidence. They appear as testified facts, challenged interpretations, and contested narratives. The same event looks different from the witness stand than it did when it happened.',

    craftPosture: `- Clinical precision. Procedural formality carries emotional weight through contrast.
- Evidence accumulates. Don't rush the verdict. Let testimony build its own pressure.
- Contested facts earn the most space. Give both interpretations room to be compelling.`,

    titleGuidance: 'The title should carry the weight of formal proceedings — a case name, a charge, a verdict, or the principle being tested. Legal register: precise, impersonal, procedural. The gravity comes from the system, not from emotion. The best trial titles sound like documents that decide fates.',

    roles: [
      { role: 'accused', count: { min: 1, max: 1 }, description: 'The one on trial - their guilt or innocence genuinely uncertain' },
      { role: 'accuser', count: { min: 1, max: 1 }, description: 'The prosecution - may be wronged party, state authority, or political rival' },
      { role: 'judge', count: { min: 1, max: 1 }, description: 'Who presides and decides - carries the weight of judgment' },
      { role: 'witness', count: { min: 1, max: 2 }, description: 'Those who testify - their divided loyalties and partial knowledge complicate both narratives' },
      { role: 'the-precedent', count: { min: 0, max: 1 }, description: 'The law, doctrine, tradition, or past event invoked by both sides. The principle being tested as much as the accused' },
    ],

    pacing: {
      totalWordCount: { min: 1600, max: 2200 },
      sceneCount: { min: 4, max: 4 },
    },
  },

  // ============================================================================
  // 18. DREAMSCAPE - Psychedelic/Surreal Structure
  // ============================================================================
  {
    id: 'dreamscape',
    name: 'Dreamscape',
    description: 'Surreal, psychedelic narrative where logic dissolves - images transform, identities merge, causality breaks',
    tags: ['surreal', 'psychedelic', 'non-linear', 'hallucinatory'],
    eraNarrativeWeight: 'flavor',
    format: 'story',

    narrativeInstructions: `STRUCTURE: DISSOLVING LOGIC
This is not a story with a plot. It is an experience. The dreamer moves through a landscape that transforms constantly. Identities are unstable. Time is meaningless. The logic is associative - one image becomes another through hidden connections of color, sound, emotion, or symbol.

=== MOVEMENT 1: THE THRESHOLD ===
The dreamer enters the dream. The waking world dissolves - a door opens onto the wrong room, a reflection moves independently, the ground becomes water. The transition should be seamless and disorienting.

Establish a SEED IMAGE: something concrete that will recur in transformed versions throughout the dream. A red thread. A bell sound. A face half-seen. This image is the dream's anchor.

=== MOVEMENT 2: THE TRANSFORMATIONS ===
The longest section. The dreamer moves through spaces that shift. A corridor becomes a forest becomes the inside of a mouth becomes a library. Each transformation is triggered by an association - a color, a texture, a word, a feeling.

Characters appear but are not stable. A friend's face becomes a stranger's. A voice speaks but the body is wrong. Names change mid-sentence. The dreamer accepts this as dreams accept everything.

The SEED IMAGE recurs in new forms: the red thread is now a vein, now a river, now a crack in the sky.

Time behaves strangely: moments stretch into years, years compress into heartbeats. Cause and effect run backward or sideways.

=== MOVEMENT 3: THE HEART ===
The dream reaches its emotional center - not a climax in the narrative sense, but the deepest point of the psyche. This is where whatever the dream is "about" (fear, desire, grief, wonder) manifests most intensely.

The imagery here should be the most vivid and the most impossible. The dreamer may split into multiple selves. The environment may respond to emotion. The boundary between inner and outer dissolves completely.

=== MOVEMENT 4: THE SURFACE ===
The dream releases. Images simplify. The transformations slow. The waking world begins to bleed through - but changed, seen differently.

The SEED IMAGE appears one final time, now carrying the accumulated weight of all its transformations.

The dreamer surfaces. They carry something back. They cannot name it.`,

    proseInstructions: `TONE: Hallucinatory, fluid, vivid. Language itself should feel slightly altered - unusual syntax, unexpected word combinations, sensory descriptions that cross boundaries.

DIALOGUE: Fragmentary. Characters speak in non-sequiturs that feel meaningful. Questions are answered with images. Statements dissolve mid-sentence into descriptions. "I wanted to tell you about the—" and then the sentence becomes a landscape.

DESCRIPTION: Synesthetic. Colors have weight. Sounds have texture. Smells have shape. The senses are cross-wired. Detail is hyper-vivid but unstable - described precisely, then transformed before the sentence ends.

TECHNIQUE - THE TRANSFORMATION: Never use "suddenly" or "it changed into." The transformation should happen inside the sentence. "The corridor narrowed until the walls were bark and the ceiling was branches and she was walking through the forest she'd forgotten." Seamless, continuous, inevitable.

TECHNIQUE - THE SEED IMAGE: One concrete image threads through the entire dream, appearing in at least four different forms. Its recurrence creates the dream's hidden structure.

TECHNIQUE - DREAM ACCEPTANCE: The dreamer never questions the impossible. They walk on water without surprise. They speak to the dead without grief. The emotional register is acceptance, wonder, or unease - never rational objection.

AVOID: Plot. Causality. Rational explanations. Metaphors that are "explained" - the images ARE the meaning. Waking up as a resolution. Treating the dream as allegory to be decoded.`,

    eventInstructions: 'Events dissolve into imagery. A battle becomes a color. A betrayal becomes a smell. The dream transforms events into their emotional essence.',

    craftPosture: `- Inhabit, don't describe. The prose is the experience, not a report of it.
- Every sentence transforms something. If nothing changes within it, it doesn't earn its place.
- Cross sensory boundaries without announcing it. Synesthesia is native here.`,

    titleGuidance: 'The title should feel like something remembered from a dream — specific and vivid, but the logic is slightly wrong. Sensory words in unexpected combinations. A color that shouldn\'t modify that noun. A texture where a sound should be. The title doesn\'t need to make sense; it needs to make the reader feel the way dreams feel just before they dissolve.',

    roles: [
      { role: 'dreamer', count: { min: 1, max: 1 }, description: 'The consciousness moving through the dream - may split, transform, or dissolve' },
      { role: 'the-seed', count: { min: 1, max: 1 }, description: 'The recurring image that anchors the dream - concrete, transforming, accumulating meaning' },
      { role: 'the-shifting', count: { min: 0, max: 2 }, description: 'Figures who appear in the dream - unstable identities, faces that change, voices that belong to the wrong bodies' },
    ],

    pacing: {
      totalWordCount: { min: 1000, max: 1600 },
      sceneCount: { min: 3, max: 4 },
    },

  },

  // ============================================================================
  // 19. APOCALYPTIC VISION - Prophetic Revelation Structure
  // ============================================================================
  {
    id: 'apocalyptic-vision',
    name: 'Apocalyptic Vision',
    description: 'Prophetic revelation of doom and transformation - cosmic scale, symbolic imagery, the end of one world and birth of another',
    tags: ['prophetic', 'apocalyptic', 'visionary', 'cosmic'],
    eraNarrativeWeight: 'flavor',
    format: 'story',

    narrativeInstructions: `STRUCTURE: PROPHETIC REVELATION
The visionary witnesses the end of the world - and what comes after. This follows the prophetic literary tradition: seals opening, signs appearing, destruction cascading, transformation emerging from ruin. The vision has structure even in its enormity.

Unlike the Dreamscape (which is psychedelic and associative), this is STRUCTURED revelation. The prophet sees clearly. The images are symbolic but precise. Each sign means something. The cosmos has a plan, even if it is terrible.

=== SCENE 1: THE SUMMONING ===
The prophet is called to see. They did not seek this vision - it seized them. Establish the prophet in their ordinary state, then the rupture: the sky tears, a voice commands, the ground opens, fire speaks.

The prophet's first response is terror. They are not worthy. They cannot bear it. But the vision will not release them.

Establish the voice or presence that guides the vision - angelic, demonic, divine, cosmic. This guide will frame what the prophet sees.

=== SCENE 2: THE SIGNS ===
The first wave of revelation. Signs appear in ordered sequence - each more terrible than the last. These are cosmic events: stars falling, seas boiling, mountains walking, the dead rising, time stopping.

Each sign should be described with the hyper-clarity of prophetic sight. Not vague or dreamy - PRECISE and enormous. "The third seal broke and the ocean stood upright like a wall, and within the wall I saw every ship that had ever sunk, and their crews still sailing."

The signs build. What begins as wonder becomes dread.

=== SCENE 3: THE DESTRUCTION ===
The old world ends. Everything the prophet knew is consumed. Cities, kingdoms, peoples, gods - all swept away. This should be devastating and magnificent.

But the destruction has logic. It is not random catastrophe. It is judgment, transformation, or cosmic necessity. The prophet (and reader) should feel that this ending, however terrible, was always coming.

Show the cost. Name what is lost. The destruction should not be abstract - specific things the prophet loved are burning.

=== SCENE 4: THE NEW WORLD ===
From the ashes, transformation. What rises is not the old world restored but something genuinely new - strange, beautiful, perhaps frightening in its strangeness.

The prophet sees the new order taking shape. They may not understand it fully. They may be changed by what they've witnessed - no longer able to return to ordinary life.

End with the prophet released from the vision, carrying the weight of what they've seen. They must speak what they saw. Whether anyone will believe them is another matter.`,

    proseInstructions: `TONE: Exalted, terrible, awestruck. The language of someone seeing things no mortal was meant to see. Formal but not stiff - the formality comes from overwhelmed reverence, not convention.

DIALOGUE: The guiding voice speaks in pronouncements. The prophet speaks in fragments of astonishment. "And I saw—" "And then—" "How long, how long—" The prophet cannot fully articulate what they witness.

DESCRIPTION: Enormous and precise simultaneously. Cosmic imagery grounded in specific detail. Not "the world ended" but "the seventh mountain cracked along its western face and from the crack poured light the color of old copper, and in that light I saw the faces of every ruler who had ever sat in judgment."

TECHNIQUE - THE CATALOG: Prophetic literature loves lists. Name what is destroyed. Name what rises. The accumulation creates scale. "The harbor and the lighthouse and the keeper's daughter and the ships and the morning market and the smell of bread—all of it, consumed."

TECHNIQUE - THE TERRIBLE BEAUTY: The destruction should be simultaneously horrifying and magnificent. The prophet is awed even as they grieve. Do not make the apocalypse ugly - make it sublime.

TECHNIQUE - SYMBOLIC PRECISION: Unlike the Dreamscape's fluid associations, prophetic imagery is fixed and meaningful. Each sign means something specific (even if the prophet doesn't fully understand). Seven of something. Three of something. The numbers and symbols carry weight.

AVOID: Nihilism. Destruction without meaning. Modern apocalyptic cliches (zombies, nuclear). Vague mysticism. The vision should feel ancient, specific, and earned.`,

    eventInstructions: 'Events are transformed into cosmic signs. A real war becomes the opening of a seal. A real famine becomes the withering of the world-tree. History becomes prophecy.',

    craftPosture: `- Enumerate, don't summarize. Accumulation of named specifics creates cosmic scale.
- Precision at enormous scope. Render destruction through what is concretely lost.
- Witnessing, not narrating. The overwhelm should be felt in the prose, not described.`,

    titleGuidance: 'The title should sound like scripture naming an event that has been foretold. Prophetic register: absolute, vast, carrying the weight of cosmic certainty. It names the transformation, the judgment, or the era ending. Short — prophetic titles compress enormity into two or three words that feel like they were always the name of this reckoning.',

    roles: [
      { role: 'prophet', count: { min: 1, max: 1 }, description: 'The one who sees - unwilling, overwhelmed, transformed by the vision' },
      { role: 'the-guide', count: { min: 0, max: 1 }, description: 'Angelic, divine, or cosmic presence that frames and explains the vision' },
      { role: 'the-old-world', count: { min: 1, max: 1 }, description: 'What is ending - the world the prophet knew, made specific and beloved so its loss wounds' },
      { role: 'the-new-world', count: { min: 0, max: 1 }, description: 'What rises from the ashes - strange, beautiful, not yet understood' },
    ],

    pacing: {
      totalWordCount: { min: 1400, max: 2000 },
      sceneCount: { min: 4, max: 4 },
    },

  },

  // ============================================================================
  // 20. LAST STAND - Ground-Level War Narrative
  // ============================================================================
  {
    id: 'last-stand',
    name: 'Last Stand',
    description: 'War from the inside — a unit holding the line, the bonds between soldiers, the arithmetic of sacrifice. No heroes, no villains. Just duty and its cost.',
    tags: ['war', 'ensemble', 'visceral', 'sacrifice', 'ground-level'],
    eraNarrativeWeight: 'structural',
    format: 'story',

    narrativeInstructions: `STRUCTURE: THE LINE HOLDS (OR BREAKS)
This story is told from inside a unit. Not from above, not in retrospect — from the ground, in the noise, in the dark. The unit is the protagonist. Individual members are facets of a collective will that emerges from shared exhaustion, shared jokes, shared fear. The enemy is not evil — they have their own bonds, their own duties, their own reasons for being here. Both sides are paying the same price in different currency.

The narrative is linear. Time moves forward because in combat, time only moves forward. No flashbacks. No retrospective framing. What happened before is carried in how people talk to each other, what they carry, what they don't say. History lives in the scars, the nicknames, the debts mentioned in half-sentences.

=== SCENE 1: THE LINE ===
The unit in position. Not a briefing — a breath. Soldiers doing what soldiers do before the fight: checking gear, complaining about something petty, sharing what's left of the rations. These small moments ARE the story. Every relationship in the unit should be visible in how people stand near each other, who finishes whose sentences, what names they use and what names they avoid.

Dark humor is the register. The worse things get, the funnier the jokes. Someone's boots are ruined. Someone owes someone a drink they'll never collect. Someone starts a story they'll finish later — and "later" is a promise no one believes but everyone makes. This is not warmth. This is armor. The banter is how units survive the waiting.

Establish what they're holding and why it matters — not in strategic terms but in gut terms. This is where their people sleep. This is what falls if the line breaks. The arithmetic is already visible: not enough bodies, not enough supplies, not enough of whatever they need.

End Scene 1 still in the quiet. The last joke before the noise.

=== SCENE 2: CONTACT ===
The fight arrives. Not cinematically — chaotically. The plan, if there was one, lasts thirty seconds. Communication breaks. Visibility drops. People are shouting things that matter and no one can hear them.

Time compresses and stretches. A moment of terror lasts forever; an hour of fighting vanishes into a sentence. Dialog becomes functional: commands, warnings, names called out. "Left!" "Down!" "Where's —?" Someone who was talking in Scene 1 stops talking. Don't eulogize them. Don't pause. The unit registers the absence in half-seconds — a gap in the line, a voice missing from the call-and-response — and keeps fighting because that's what units do. Grief is a luxury for people who aren't currently dying.

The enemy must be visible as people. An opposing commander directing forces with the same desperate competence as the unit's leader. A warrior who hesitates at the wrong moment. A formation that shows training, discipline, someone else's version of the same bonds the unit has. Give the enemy at least one moment of specificity — a detail that makes clear there are soldiers on that side too, not monsters.

If magic or special abilities are involved, render them physically. Not as spectacle but as bodily experience — the way the air changes, what it does to the ears, the taste it leaves. Magic in combat is another weapon, and weapons are described by what they do to flesh.

=== SCENE 3: THE ARITHMETIC ===
The moment when someone does the math. Not enough fire. Not enough bodies. Not enough time. The line will break unless someone pays a price that can't be refunded.

This is not a heroic volunteer scene. No one steps into a shaft of light and makes a speech. This is people looking at each other and knowing. Maybe someone says "I'll go" and it's quiet — not dramatic, just tired and certain. Maybe no one says anything because the person who has the ability is already moving. Maybe they argue about it — briefly, viciously, because there's no time — and the argument reveals what each person values more than their own survival.

The sacrifice is physical, specific, ugly. Not a clean death. Not a noble gesture. Someone doing something terrible to themselves or to the world because it's the only option left on the table. Show what it costs the person doing it: the pain, the fear they're hiding badly, the moment their hands shake before they stop shaking. Show what it costs the people watching: the ones who look away, the one who doesn't, the one who tries to stop it and gets pulled back.

The enemy feels it too. If the sacrifice is a weapon, show what it does to the other side — not as victory but as violence done to people who were also just doing their duty. The orca commander whose pod-bonds snap. The warrior who was singing and then wasn't. No triumph in this. Just the cost.

=== SCENE 4: AFTER ===
Brief. The quiet after noise is louder than the noise was.

Someone standing where someone else was standing. A weapon on the ground with no one holding it. The sound that won't stop — a frequency, a drip, a crack in something structural. The surviving members of the unit doing whatever comes next because that's all there is to do.

No reflection. No meaning-making. No one says "it was worth it" or "they died for something." A concrete moment: picking up someone's gear. Saying a name into empty air. Starting to walk in a direction that is "away" rather than "toward." The unit is smaller now. The jokes will be different. Someone will take the dead soldier's watch position tonight because the watch still needs keeping.

End mid-motion. Not a conclusion — a continuation. The war isn't over. The line held or it didn't, and either way, tomorrow they do it again.`,

    proseInstructions: `TONE: Ground-level, compressed, physical. The prose should carry exhaustion in its bones — short sentences when action peaks, longer ones in the quiet moments when bodies catch up to what's been happening. Not pretty. Accurate. The difference between "the aurora shimmered" and "the light made his eyes ache."

DIALOGUE: This style is dialog-heavy. People talk the way soldiers talk: gallows humor, understatement, insults as endearments, incomplete sentences finished by someone who's heard this a hundred times. No speeches. No declarations of principle. "You good?" "No." "Same. Move." — that register. The worse the situation gets, the more deadpan the delivery. Someone cracks a joke while bleeding. Someone complains about the cold while the world is ending. This isn't comic relief. It's how people survive proximity to death — by refusing to give it the gravity it demands.

Dialog reveals relationship. How a veteran talks to a new member. How the unit leader talks when there's time versus when there isn't. The word someone uses for the person they're about to lose — a nickname that compresses years of shared misery into two syllables. When dialog stops, something has changed. Silence in a unit that never shuts up is the loudest sound in the story.

Erikson's principle applies: dialog is "cagey." Characters speak for their own needs, not the reader's. They reference shared history without explaining it. They use in-group shorthand. The reader assembles context from fragments, the way a new recruit would.

DESCRIPTION: Physical and sensory. Not beautiful — functional. The way exhaustion makes hands shake and decisions slow. The sound that pressure-magic makes when it hits crystalline architecture. The weight of gear after the fourth hour. Wounds described by what they do to capability, not how they look: "her left flipper wouldn't close anymore" not "blood streamed from the wound."

The environment is tactical and lived-in. Sight lines, cover, footing. The cold — always the cold. Darkness and noise as disorientation. Smells that soldiers notice because bodies notice before minds do.

TECHNIQUE - THE UNIT VOICE: The ensemble develops a collective identity through accumulated dialog — running jokes, shared complaints, a particular way of handling fear that belongs to this unit and no other. By Scene 3, losing a member should feel like losing part of a private language. A joke that won't land anymore because the person who always responded is gone.

TECHNIQUE - THE ENEMY AS MIRROR: The opposing force is rendered with the same specificity as the unit. A commander who cares about his people. A warrior who fights well because someone taught her. A formation that shows bonds as deep as the defenders'. The reader should be able to imagine the same story told from the other side, and it would be just as true.

TECHNIQUE - DEATH WITHOUT CEREMONY: People die mid-sentence. Mid-action. Mid-joke. The narrative does not pause to honor them because the battle doesn't pause. Their absence is registered in the gaps — who stops responding, whose position goes silent, whose name gets called and called and called with no answer. Grief is deferred. The living grieve by continuing to fight. The dead are mourned in Scene 4's silence, if they're mourned at all.

TECHNIQUE - SACRIFICE AS ARITHMETIC: The sacrifice scene is not an emotional crescendo — it's math. Someone has the ability. The situation requires it. The cost is understood. They do it because the alternative is everyone. Make the math visible: show what's left, show what's needed, show the gap between them. The reader should arrive at the same conclusion the characters do, a beat before anyone speaks.

AVOID: Heroic speeches. Slow-motion deaths. The enemy as evil or monstrous — they are soldiers with families, orders, and the same fear. Clean deaths where people close their eyes and go still. War as adventure or spectacle. Protagonists who don't get tired, scared, hungry, or petty. Sacrifice as glory rather than cost. Narration that tells the reader how to feel. Any sentence that could appear on a monument.`,

    eventInstructions: 'Events are the battle. They arrive as chaos, not as plot points. Multiple things happen simultaneously and the unit experiences them partially — an explosion three corridors away, a shout from a flank they can\'t see, a shift in the enemy\'s formation that means something has changed but no one on the ground knows what. The full picture is never available to anyone holding a weapon.',

    craftPosture: `- Dialog is the primary tool. Let people talk. Their voices carry character, relationship, and tension more efficiently than any description. The quiet moments between soldiers earn more space than the violence.
- Compress action, expand the human moments. The conversation before the fight and the silence after it are where the story lives. Combat is rendered in bursts — sharp, disorienting, over before the reader has fully processed it.
- Death in half-sentences. Don't linger. The absence after is louder than the moment of dying. Let gaps do the mourning.
- Symmetry between sides. If the unit has bonds, show that the enemy does too. If sacrifice costs the defenders, register what it costs the attackers. The story's moral weight comes from refusing to make one side's suffering matter more than the other's.
- Physical before emotional. Show the shaking hands before naming the fear. Show the wound before the grief. The body knows before the mind does, and the prose should follow that order.`,

    titleGuidance: 'The title names the ground — the position, the corridor, the ridge, the terrace. Military and concrete. It should sound like what survivors call this fight when they talk about it years later: not the official name, not the strategic significance, just the place where it happened. The register is tired, specific, earned. Two to four words. No glory in it. If the title sounds like it belongs on a memorial wall where someone has traced the letters with a flipper, it fits.',

    roles: [
      { role: 'the-line', count: { min: 1, max: 1 }, description: 'What is being held — a location, a faction, an artifact, a principle. The thing that makes the stand necessary. Not a person but what people are willing to die for' },
      { role: 'squad-member', count: { min: 2, max: 3 }, description: 'Members of the unit — defined by how they talk, what they carry, and how they relate to each other under pressure. Named through action and dialog, not backstory. At least one will not survive' },
      { role: 'the-tide', count: { min: 1, max: 1 }, description: 'The opposing force — a faction, a commander, an occurrence bearing down. Treated with the same dignity as the unit. They have their own bonds, their own reasons, their own cost to pay' },
      { role: 'the-price', count: { min: 1, max: 1 }, description: 'What the sacrifice costs or what is sacrificed — may be an ability, an artifact, a bond, or a person. The thing that ends this battle but scars everything it touches. Described by what it does, not what it means' },
      { role: 'the-weight', count: { min: 0, max: 1 }, description: 'What survivors carry after — an ideology born from the cost, a corruption that won\'t cleanse, a sound that won\'t stop. Not present in the battle itself; felt only in the silence after. The thing the story was really about, visible only from the far side of violence' },
    ],

    pacing: {
      totalWordCount: { min: 1600, max: 2200 },
      sceneCount: { min: 4, max: 4 },
    },
  },
];
