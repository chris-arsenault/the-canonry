/**
 * Default Narrative Style Presets (Part 1: Classic Drama)
 *
 * Styles: Epic Drama, Action Adventure, Romance, Slice of Life, Political Intrigue.
 * Types are defined in narrativeStyles.ts.
 */

import type { StoryNarrativeStyle } from './narrativeStyles.js';

export const NARRATIVE_STYLES_CLASSIC: StoryNarrativeStyle[] = [
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
      { role: 'chronicler', count: { min: 1, max: 1 }, description: 'The witness who survived to tell this - they frame everything, but tell the story rather than comment on telling it', selectionCriteria: '' },
      { role: 'protagonist', count: { min: 1, max: 1 }, description: 'The central figure - ground them in physical presence, not conceptual traits', selectionCriteria: '' },
      { role: 'antagonist', count: { min: 1, max: 1 }, description: 'The opposing force - villain, rival power, or circumstance', selectionCriteria: '' },
      { role: 'the-lost', count: { min: 0, max: 2 }, description: 'Those who did not survive - their loss should land, not be reported', selectionCriteria: '' },
      { role: 'the-weight', count: { min: 0, max: 1 }, description: 'The force that shaped events - a law, a power, an occurrence. Present in effects, not explained', selectionCriteria: '' },
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
      { role: 'hero', count: { min: 1, max: 2 }, description: 'Racing the clock - defined by what they do, not what they think', selectionCriteria: '' },
      { role: 'deadline', count: { min: 1, max: 1 }, description: 'The ticking clock - tide, ritual, collapse, arrival. Must be concrete and visible', selectionCriteria: '' },
      { role: 'objective', count: { min: 1, max: 1 }, description: 'What must be reached, retrieved, stopped, or saved before time runs out', selectionCriteria: '' },
      { role: 'obstacle', count: { min: 1, max: 2 }, description: 'What blocks the path and costs precious time to overcome', selectionCriteria: '' },
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
    eraNarrativeWeight: 'contextual',
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
      { role: 'lover-a', count: { min: 1, max: 1 }, description: 'First perspective - we live in their world before the meeting', selectionCriteria: '' },
      { role: 'lover-b', count: { min: 1, max: 1 }, description: 'Second perspective - different world, different lack', selectionCriteria: '' },
      { role: 'obstacle', count: { min: 0, max: 1 }, description: 'What makes connection difficult - not villain, but genuine barrier (duty, history, fear)', selectionCriteria: '' },
      { role: 'catalyst', count: { min: 0, max: 1 }, description: 'What brings them into contact - place, event, person, circumstance', selectionCriteria: '' },
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
      { role: 'focal-point', count: { min: 1, max: 1 }, description: 'The consciousness we inhabit - person, place, or moment', selectionCriteria: '' },
      { role: 'passing-through', count: { min: 0, max: 2 }, description: 'Brief presences - someone who shares the space temporarily', selectionCriteria: '' },
      { role: 'the-moment', count: { min: 0, max: 1 }, description: 'The bounded time - the meal, the walk, the morning', selectionCriteria: '' },
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
      { role: 'player-a', count: { min: 1, max: 1 }, description: 'The protagonist - observant, calculating, making moves through the political landscape', selectionCriteria: '' },
      { role: 'player-b', count: { min: 1, max: 1 }, description: 'Current authority figure or primary opposition - has something player-a needs or threatens', selectionCriteria: '' },
      { role: 'player-c', count: { min: 0, max: 1 }, description: 'Representative of competing interest - offers alliance or opposition', selectionCriteria: '' },
      { role: 'the-event', count: { min: 1, max: 1 }, description: 'The central occurrence that sets the machinations in motion', selectionCriteria: '' },
      { role: 'the-prize', count: { min: 0, max: 1 }, description: 'What is being contested - position, resource, authentication, territory', selectionCriteria: '' },
    ],

    pacing: {
      totalWordCount: { min: 1600, max: 2200 },
      sceneCount: { min: 4, max: 4 },
    },
  },

];
