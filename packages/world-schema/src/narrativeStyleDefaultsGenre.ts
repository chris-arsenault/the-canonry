/**
 * Default Narrative Style Presets (Part 3: Genre)
 *
 * Styles: Tragedy, Mystery Suspense, Treasure Hunt, Haunted Relic, Lost Legacy.
 * Types are defined in narrativeStyles.ts.
 */

import type { StoryNarrativeStyle } from './narrativeStyles.js';

export const NARRATIVE_STYLES_GENRE: StoryNarrativeStyle[] = [
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

];
