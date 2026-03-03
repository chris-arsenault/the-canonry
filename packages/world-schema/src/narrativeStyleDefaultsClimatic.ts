/**
 * Default Narrative Style Presets (Part 5: Climactic)
 *
 * Styles: Apocalyptic Vision, Last Stand, Breakthrough, Common Ground.
 * Types are defined in narrativeStyles.ts.
 */

import type { StoryNarrativeStyle } from './narrativeStyles.js';

export const NARRATIVE_STYLES_CLIMACTIC: StoryNarrativeStyle[] = [
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
      { role: 'prophet', count: { min: 1, max: 1 }, description: 'The one who sees - unwilling, overwhelmed, transformed by the vision', selectionCriteria: '' },
      { role: 'the-guide', count: { min: 0, max: 1 }, description: 'Angelic, divine, or cosmic presence that frames and explains the vision', selectionCriteria: '' },
      { role: 'the-old-world', count: { min: 1, max: 1 }, description: 'What is ending - the world the prophet knew, made specific and beloved so its loss wounds', selectionCriteria: '' },
      { role: 'the-new-world', count: { min: 0, max: 1 }, description: 'What rises from the ashes - strange, beautiful, not yet understood', selectionCriteria: '' },
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
      { role: 'the-line', count: { min: 1, max: 1 }, description: 'What is being held — a location, a faction, an artifact, a principle. The thing that makes the stand necessary. Not a person but what people are willing to die for', selectionCriteria: '' },
      { role: 'squad-member', count: { min: 2, max: 3 }, description: 'Members of the unit — defined by how they talk, what they carry, and how they relate to each other under pressure. Named through action and dialog, not backstory. At least one will not survive', selectionCriteria: '' },
      { role: 'the-tide', count: { min: 1, max: 1 }, description: 'The opposing force — a faction, a commander, an occurrence bearing down. Treated with the same dignity as the unit. They have their own bonds, their own reasons, their own cost to pay', selectionCriteria: '' },
      { role: 'the-price', count: { min: 1, max: 1 }, description: 'What the sacrifice costs or what is sacrificed — may be an ability, an artifact, a bond, or a person. The thing that ends this battle but scars everything it touches. Described by what it does, not what it means', selectionCriteria: '' },
      { role: 'the-weight', count: { min: 0, max: 1 }, description: 'What survivors carry after — an ideology born from the cost, a corruption that won\'t cleanse, a sound that won\'t stop. Not present in the battle itself; felt only in the silence after. The thing the story was really about, visible only from the far side of violence', selectionCriteria: '' },
    ],

    pacing: {
      totalWordCount: { min: 1600, max: 2200 },
      sceneCount: { min: 4, max: 4 },
    },
  },

  // ============================================================================
  // 22. BREAKTHROUGH - Process of Making Structure
  // ============================================================================
  {
    id: 'breakthrough',
    name: 'Breakthrough',
    description: 'The process of solving a problem that resists solution — tension from understanding, payoff from the thing working',
    tags: ['innovation', 'craft', 'problem-solving', 'patient'],
    eraNarrativeWeight: 'structural',
    format: 'story',

    narrativeInstructions: `STRUCTURE: THE MAKING
This story is about the process of solving a hard problem. The tension is the problem itself, which resists understanding. The payoff is the thing working. The structure builds toward insight, not toward victory.

=== SCENE 1: THE RESISTANCE ===
The problem. What won't yield, what's been tried, why it matters. Not abstract — show the specific failure. The material that cracks. The instrument that reads wrong. The technique that should work and doesn't.

Establish the maker's competence. This is not a story about someone learning the basics — it's about someone who has mastered everything available and hit the wall beyond mastery. The problem is genuinely hard. Show what others have tried and why it hasn't worked.

End with the maker committed but not yet seeing.

=== SCENE 2: THE WORKSHOP ===
The space, the tools, the accumulated knowledge of predecessors. Show the iterative process — attempts that fail but teach something. A technique borrowed from an adjacent discipline. A variation that reveals an unexpected property.

This scene is physical. Hands on materials. The smell of what they're working with. The temperature of the room. The specific feel of the tools. Competence as embodied knowledge — the body knows things the conscious mind hasn't articulated yet.

At least one failure in this scene should reveal something the maker doesn't yet recognize as important. The reader may see it before the maker does.

=== SCENE 3: THE SHIFT ===
The realization arrives through the work, not despite it. Two things that were separate connect. A failure reinterpreted. A property noticed in passing that suddenly reorganizes everything.

The shift should feel earned — it emerges from the accumulated attempts of Scene 2, not from luck or outside intervention. The maker sees the material differently because the failed attempts gave them enough information to see what was always there.

=== SCENE 4: THE MAKING ===
The actual construction. Detailed, physical, present. The maker working with the new understanding, translating insight into material form. Confident and precise, but with the particular intensity of someone doing something for the first time.

Show the thing coming into being through accumulated, careful steps. Each step could still fail. The maker knows this and proceeds anyway, because the understanding is sound even if the execution is untested.

=== SCENE 5: THE PROOF ===
It works. Show what it does — not through explanation but through demonstration. The instrument reads correctly. The material holds. The technique produces what was promised.

Show what this changes — what becomes possible that wasn't before. The proof earns weight from the accumulated difficulty that preceded it.`,

    proseInstructions: `TONE: Patient, precise, physically grounded. Unhurried confidence, attention to material detail, the particular satisfaction of things fitting together.

DIALOGUE: Sparse. Makers talk to themselves, to the material, to absent predecessors. When dialogue occurs between people, it is technical — specific, practical, about the problem at hand.

DESCRIPTION: Material and sensory. What things feel like under the hands. The specific behavior of materials under specific conditions. The workshop described through what's in it and what those things do, not through atmosphere. Tools are named. Processes are shown.

TECHNIQUE - EMBODIED KNOWLEDGE: The maker's expertise shows in their body — how they hold tools, what they notice automatically, the small adjustments they make without thinking. Competence is shown, not stated.

TECHNIQUE - THE TEACHING FAILURE: Failed attempts that reveal something. Each failure should leave the reader (and eventually the maker) with more understanding than before. Failure is not defeat — it's data.

TECHNIQUE - THE MATERIAL SPEAKS: Materials have properties that resist and reveal. The maker is in dialogue with the material, not imposing will on it. Good making is listening.

AVOID: Montage. Time-skips that compress the work into a sentence — the work IS the story. Insight arriving from outside the process — from a dream, a stranger's hint, a convenient accident unrelated to the attempts. Speeches about the meaning of innovation or progress. The doubting colleague who exists to be proved wrong. The maker narrating their own thought process instead of working. Triumph music — if the ending feels like a victory lap, it has overshot.`,

    eventInstructions: 'Events provide the problem or the context that makes the problem urgent. The event is why this breakthrough matters — what needs the thing being built. But the story is the making, not the event.',

    craftPosture: `- Dwell in the process. The work earns its space by being specific and physical. Every step shown is a step the reader understands.
- Failures are content, not obstacles to skip past. Each failed attempt reveals something.
- The shift must be earned by what precedes it. If the insight doesn't emerge from the accumulated work, the story has cheated.
- Restraint at the payoff. The proof lands because of what preceded it, not because the prose announces its importance.`,

    titleGuidance: 'Name the thing made, the material worked, or the problem solved — concrete and specific. The register is workshop-practical, not grandiose. If the title sounds like what a maker would call their own work when describing it to a colleague, it fits. One to four words. No triumph announced; the title trusts the reader to understand what the making cost.',

    roles: [
      { role: 'maker', count: { min: 1, max: 2 }, description: 'The craftsperson, scholar, or engineer — defined by competence and attention. Not a hero; a person who knows their craft and has hit its limits', selectionCriteria: '' },
      { role: 'the-problem', count: { min: 1, max: 1 }, description: 'What resists solution — a material property, a theoretical gap, a technique that should work and doesn\'t. The problem is the antagonist, and it is honest', selectionCriteria: '' },
      { role: 'the-material', count: { min: 1, max: 1 }, description: 'What they work with — the substance or medium whose properties must be understood, not overcome', selectionCriteria: '' },
      { role: 'witness', count: { min: 0, max: 1 }, description: 'Someone present for the proof who understands what it means', selectionCriteria: '' },
    ],

    pacing: {
      totalWordCount: { min: 1400, max: 1800 },
      sceneCount: { min: 4, max: 5 },
    },
  },

  // ============================================================================
  // 23. COMMON GROUND - Cross-Cultural Collaboration Structure
  // ============================================================================
  {
    id: 'common-ground',
    name: 'Common Ground',
    description: 'Two cultures forced to work together build something neither could make alone — productive friction, provisional trust',
    tags: ['cross-cultural', 'collaboration', 'friction', 'building'],
    eraNarrativeWeight: 'structural',
    format: 'story',

    narrativeInstructions: `STRUCTURE: PRODUCTIVE FRICTION
Two parties from different cultures must work together on something neither can accomplish alone. The cultural gap between them is both the obstacle and — eventually — the source of the innovation. This is not a story about people learning to like each other. It is a story about incompatible methods colliding until the collision produces something new.

=== SCENE 1: THE NEED ===
A problem that genuinely spans both cultures' domains. Not a contrivance — a real situation where one culture has knowledge the other lacks, and vice versa. Establish why neither party can solve this alone and why they must solve it together.

Show both parties arriving with their own assumptions, their own methods, their own definitions of what "good work" looks like. The friction is methodological, not personal. They respect each other's competence while finding each other's approach fundamentally wrong.

=== SCENE 2: THE FRICTION ===
They attempt to work together and the cultural gap asserts itself. Different assumptions about hierarchy, about how knowledge is shared, about what constitutes proof. Specific misunderstandings — not comic relief but genuine collisions of worldview.

One party's standard practice offends or baffles the other. A technique that one culture considers basic, the other considers dangerous or taboo. A piece of information that one party shares freely and the other believes should never have been spoken aloud.

The collaboration threatens to fail. Not from bad faith — from genuine incompatibility. Both parties are doing their best. Their bests conflict.

=== SCENE 3: THE TURN ===
Something breaks through — and it should emerge from the friction itself, not despite the cultural difference but because of it. The gap between their approaches illuminates something neither could see from inside their own framework. The difference becomes generative. What one tradition lacks, the other supplies — not because they overlap, but because they don't.

The turn is not "they realize they're not so different." They are different. They remain different. The turn is that the difference produces something.

=== SCENE 4: THE WORK ===
They build the thing together. Show the hybrid — techniques from both traditions, compromises that create something that belongs to neither tradition alone. The work is physical, specific, detailed.

This is not smooth. There are still disagreements, still moments where one party grits their teeth at the other's approach. But the thing is taking shape, and the shape is new.

=== SCENE 5: THE THING THEY MADE ===
The result. Show what it does. Show that it works. Show that it contains elements from both traditions in a configuration neither tradition would have arrived at independently.

The collaboration may or may not survive the project. The trust is provisional — earned for this work, not guaranteed for the next. But the thing they made is real, and it works.`,

    proseInstructions: `TONE: Tense, earned, specific. The prose carries the effort of working across a divide — the particular exhaustion of being understood imperfectly and proceeding anyway.

DIALOGUE: Heavy — this is a story told through conversation, negotiation, and misunderstanding. Both parties speak in their own cultural register. Translation failures are shown, not explained. When one party uses a term the other doesn't share, the gap is felt in the moment, not glossed by the narrator.

DESCRIPTION: Two ways of seeing the same object or process. When both parties look at the same material, they notice different properties. When both assess the same result, they measure by different standards. Show this through what gets noticed and named — each culture's attention reveals its priorities.

TECHNIQUE - THE GAP: Cultural difference is rendered through specific physical moments, not through narrated generalities. The gap lives in gesture, in what is touched and what is not touched, in what is said aloud and what is kept silent. Show the collision at the level of hands and habits.

TECHNIQUE - THE HYBRID: When the two methods combine, show both contributing something irreplaceable. The result should be visibly composite — containing elements that are recognizably from each tradition, arranged in a way that belongs to neither.

TECHNIQUE - PROVISIONAL TRUST: Trust is built through small acts, not declarations. One party takes a risk on the other's method. One party shares something they normally wouldn't. These moments are noted by the characters and not commented on. Trust accretes; it is not announced.

AVOID: Resolution of cultural difference — they do not become the same, they do not discover secret commonality, they do not bond over shared values. One culture being right and the other learning from it — both contribute, both compromise, the result is neither's ideal. Characters explaining what the collaboration means. Narration that frames the work as a lesson about tolerance. Friction that evaporates once the turn arrives — the disagreements persist through the work and into the ending.`,

    eventInstructions: 'Events provide the need — the problem that forces collaboration. The event should make both cultures\' involvement necessary, not optional. The urgency comes from the problem, not from time pressure.',

    craftPosture: `- Let the friction breathe. Don't rush past the misunderstandings to get to the resolution. The friction IS the story.
- Both cultures rendered with equal specificity and equal dignity. Neither is the viewpoint culture. Neither is the student.
- The hybrid result is described with the same material attention as any other making — show what it's made of and how it works.
- Provisional, not triumphant. The ending earns satisfaction, not celebration. The trust is real and it is limited.`,

    titleGuidance: 'Name the thing built, the place where they met, or the problem they solved together. The register is practical and cross-cultural — the kind of name that gets used by both sides, possibly meaning slightly different things to each. If the title sounds like what historians call this collaboration when they cite it as precedent, it fits.',

    roles: [
      { role: 'party-a', count: { min: 1, max: 1 }, description: 'Representative of one culture — competent in their own tradition, genuinely baffled or frustrated by the other\'s approach', selectionCriteria: '' },
      { role: 'party-b', count: { min: 1, max: 1 }, description: 'Representative of the other culture — equally competent, equally frustrated. Not the student; the counterpart', selectionCriteria: '' },
      { role: 'the-need', count: { min: 1, max: 1 }, description: 'The problem that requires both cultures\' capabilities — a location, a material, a crisis that spans both domains', selectionCriteria: '' },
      { role: 'the-work', count: { min: 1, max: 1 }, description: 'What they build together — the hybrid result, the thing that belongs to neither tradition alone', selectionCriteria: '' },
      { role: 'catalyst', count: { min: 0, max: 1 }, description: 'What forces the collaboration — a shared threat, a resource neither controls, an authority that mandates cooperation', selectionCriteria: '' },
    ],

    pacing: {
      totalWordCount: { min: 1600, max: 2200 },
      sceneCount: { min: 4, max: 5 },
    },
  },
];
