/**
 * Default Narrative Style Presets (Part 2: Experimental)
 *
 * Styles: Rashomon, Poetic Lyrical, Dark Comedy, Heroic Fantasy.
 * Types are defined in narrativeStyles.ts.
 */

import type { StoryNarrativeStyle } from './narrativeStyles.js';

export const NARRATIVE_STYLES_EXPERIMENTAL: StoryNarrativeStyle[] = [
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
      { role: 'witness-a', count: { min: 1, max: 1 }, description: 'First perspective - their account opens the story and establishes the baseline truth that subsequent accounts will complicate', selectionCriteria: '' },
      { role: 'witness-b', count: { min: 1, max: 1 }, description: 'Second perspective - contradicts or complicates the first account through different position and interpretation', selectionCriteria: '' },
      { role: 'witness-c', count: { min: 1, max: 1 }, description: 'Third perspective - often marginal to the main players, reveals what the principals missed or misread', selectionCriteria: '' },
      { role: 'the-moment', count: { min: 1, max: 1 }, description: 'The pivotal event all three witnesses observed - must be specific and bounded, a single scene lasting minutes not hours', selectionCriteria: '' },
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
      { role: 'consciousness', count: { min: 1, max: 1 }, description: 'The perceiving presence - we see through them, feel with them', selectionCriteria: '' },
      { role: 'the-image', count: { min: 1, max: 1 }, description: 'The central image that opens and closes the loop - must be concrete and specific', selectionCriteria: '' },
      { role: 'presence', count: { min: 0, max: 1 }, description: 'What enters awareness - visitor, memory, other consciousness', selectionCriteria: '' },
      { role: 'absence', count: { min: 0, max: 1 }, description: 'What is longed for or lost - may never appear directly', selectionCriteria: '' },
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
      { role: 'fool', count: { min: 1, max: 2 }, description: 'The reasonable person trapped in unreasonable circumstances - competent, professional, doing everything right', selectionCriteria: '' },
      { role: 'system', count: { min: 1, max: 1 }, description: 'The inadequate structure - bureaucracy, protocol, or procedure that cannot handle what it encounters', selectionCriteria: '' },
      { role: 'catalyst', count: { min: 0, max: 1 }, description: 'What sets the disaster in motion - small, routine, the kind of thing that happens every day', selectionCriteria: '' },
      { role: 'victim', count: { min: 0, max: 2 }, description: 'Collateral damage - those permanently affected by the catastrophe through no fault of their own', selectionCriteria: '' },
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
      { role: 'hero', count: { min: 1, max: 1 }, description: 'The chosen one - starts ordinary, becomes extraordinary', selectionCriteria: '' },
      { role: 'darkness', count: { min: 1, max: 1 }, description: 'The evil to be vanquished - dark lord, corrupting power, or malevolent force', selectionCriteria: '' },
      { role: 'guide', count: { min: 0, max: 1 }, description: 'Mentor figure who provides wisdom and/or the call', selectionCriteria: '' },
      { role: 'companion', count: { min: 0, max: 2 }, description: 'Those who journey with the hero - may fall, may be saved', selectionCriteria: '' },
      { role: 'quest-object', count: { min: 0, max: 1 }, description: 'What is sought - weapon, knowledge, place of power', selectionCriteria: '' },
      { role: 'the-calling', count: { min: 0, max: 1 }, description: 'The prophecy, ancient law, forbidden power, or world-event that sets the quest in motion. Defines what the hero must confront beyond any single enemy', selectionCriteria: '' },
    ],

    pacing: {
      totalWordCount: { min: 1800, max: 2400 },
      sceneCount: { min: 4, max: 6 },
    },
  },

];
