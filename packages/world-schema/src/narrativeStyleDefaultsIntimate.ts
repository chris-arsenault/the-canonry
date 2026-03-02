/**
 * Default Narrative Style Presets (Part 4: Intimate)
 *
 * Styles: Confession, Fable, Trial Judgment, Dreamscape.
 * Types are defined in narrativeStyles.ts.
 */

import type { StoryNarrativeStyle } from './narrativeStyles.js';

export const NARRATIVE_STYLES_INTIMATE: StoryNarrativeStyle[] = [
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
    eraNarrativeWeight: 'flavor',
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

];
