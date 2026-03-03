/**
 * Default Document Style Presets (Part 2: Professional & Sacred)
 *
 * Styles: Tavern Notice Board through Origin Myth.
 * Types are defined in documentStyles.ts.
 */

import type { DocumentNarrativeStyle } from './documentStyles.js';

export const DOCUMENT_STYLES_PROFESSIONAL: DocumentNarrativeStyle[] = [
  // 8. TAVERN NOTICE BOARD
  {
    id: 'tavern-notices',
    name: 'Tavern Notice Board',
    description: 'Collection of community postings: jobs, rumors, announcements, personal ads',
    tags: ['document', 'community', 'rumors', 'informal'],
    eraNarrativeWeight: 'flavor',
    format: 'document',

    documentInstructions: `This is a collection of notices as they would appear on a public tavern board.

STRUCTURE:
- Board Location (~30 words): Name of establishment. Brief atmosphere.
- Help Wanted (~80 words): Someone needs something done. Clear task and payment.
- Local Talk (~100 words): What people are whispering about. May or may not be true.
- Announcements (~80 words): Upcoming events, changes, official notices.
- Personal Notices (~80 words): Seeking companions, lost items, looking for relatives.
- Curious Posting (~60 words, optional): Something intriguing or ominous. Questions unanswered.

VOICE & TONE: Multiple first-person voices. Each notice reflects its poster - educated or not, local or foreign. Varied, authentic, community, informal, diverse-voices.

Include spelling quirks for some posters, local slang, specific locations, realistic requests. Different social classes write differently.

Avoid modern references, all notices sounding the same, only dramatic content.`,

    eventInstructions: 'Events become rumors and gossip. Different takes on the same events add texture.',

    craftPosture: '',
    titleGuidance: 'The title names the establishment or the board itself — what a regular would call the collection of notices pinned to the wall. Informal register: local, specific, the voice of a community that doesn\'t explain itself to outsiders. Grounded in a place name or a location people know by reputation.',

    roles: [
      { role: 'establishment', count: { min: 0, max: 1 }, description: 'The tavern or public house hosting the board', selectionCriteria: '' },
      { role: 'job-poster', count: { min: 0, max: 1 }, description: 'Someone seeking help', selectionCriteria: '' },
      { role: 'rumor-subject', count: { min: 0, max: 2 }, description: 'Person or event being gossiped about', selectionCriteria: '' },
      { role: 'mysterious-poster', count: { min: 0, max: 1 }, description: 'Unknown entity leaving intriguing notice', selectionCriteria: '' },
    ],

    pacing: {
      wordCount: { min: 350, max: 550 },
    },
  },

  // 9. FIELD REPORT
  {
    id: 'field-report',
    name: 'Field Report',
    description: 'Military scout report, expedition log, or reconnaissance document',
    tags: ['document', 'military', 'reconnaissance', 'tactical'],
    eraNarrativeWeight: 'contextual',
    format: 'document',

    documentInstructions: `This is a professional military or expedition field report.

STRUCTURE:
- Report Header (~50 words): Classification, date, unit, commander addressed.
- Mission & Status (~60 words): What the mission was. Current status of unit.
- Observations (~200 words): What was seen, heard, learned. Numbers, positions, movements.
- Encounters (~100 words): Any interactions with hostiles, locals, or allies. Outcomes.
- Tactical Assessment (~80 words): What this means. Threats, opportunities, unknowns.
- Recommendations (~60 words): What the reporting officer suggests. Specific and actionable.

VOICE & TONE: First person plural for unit actions. Third person for observations. Military register. Professional, concise, tactical, factual, urgent.

Include numbers and quantities, directions and distances, time references, unit designations. Describe entities tactically - capabilities, positions.

Avoid emotional language, speculation without marking it, irrelevant details, casual tone.`,

    eventInstructions: 'Events are mission-relevant occurrences. Report with tactical implications.',

    craftPosture: '',
    titleGuidance: 'The title is a file designation — what gets stamped on the cover before it is sent up the chain. Name the location, the operation, or the tactical subject. Military register: functional, abbreviated, stripped of personality. The title is for filing, not for reading aloud.',

    roles: [
      { role: 'enemy-force', count: { min: 0, max: 2 }, description: 'Hostile faction or army being observed', selectionCriteria: '' },
      { role: 'terrain-assessed', count: { min: 0, max: 2 }, description: 'Territory, fortification, or location being reported on', selectionCriteria: '' },
      { role: 'capability-observed', count: { min: 0, max: 2 }, description: 'Enemy abilities, magic, or weapons noted', selectionCriteria: '' },
      { role: 'reporting-unit', count: { min: 0, max: 1 }, description: 'Scout or reconnaissance party submitting report', selectionCriteria: '' },
      { role: 'strategic-asset', count: { min: 0, max: 1 }, description: 'Resource, weapon, or item of tactical importance', selectionCriteria: '' },
    ],

    pacing: {
      wordCount: { min: 450, max: 650 },
    },
  },

  // 10. ARTISAN'S CATALOGUE
  {
    id: 'artisans-catalogue',
    name: "Artisan's Catalogue",
    description: 'Detailed catalog of items, artifacts, or creations with descriptions and provenance',
    tags: ['document', 'catalog', 'items', 'artifacts'],
    eraNarrativeWeight: 'flavor',
    format: 'document',

    documentInstructions: `This is an item catalog or collection inventory from a knowledgeable collector or artisan.

STRUCTURE:
- Introduction (~80 words): What this catalog covers. Notable inclusions. Curator credentials.
- Catalog Entry (~150 words): Full description of one significant item. History, properties, significance.
- Second Entry (~150 words): Different type of item. Contrast with first entry.
- Third Entry (~120 words, optional): Perhaps a more mysterious or less documented piece.
- Curator's Notes (~60 words, optional): Patterns observed, items sought, authentication concerns.

VOICE & TONE: First person curatorial. Knowledgeable but accessible. Pride in the collection. Knowledgeable, appreciative, detailed, authoritative.

Include physical details, provenance, special properties, comparative value. Items may be associated with entities as creators or former owners.

Avoid generic descriptions, identical formats for each item, excessive jargon.`,

    eventInstructions: 'Events give items history - "used in the Battle of X" or "created during the Y crisis."',

    craftPosture: '',
    titleGuidance: 'The title names the collection, the workshop, or the artisan — what would appear on the catalog\'s cover page in a confident hand. Trade register: proud but practical, establishing credibility through specificity. It should sound like something an artisan would hand to a patron, naming what they make and where to find them.',

    roles: [
      { role: 'catalogued-item', count: { min: 1, max: 3 }, description: 'Artifact, creation, or treasure being documented', selectionCriteria: '' },
      { role: 'creator-or-owner', count: { min: 0, max: 2 }, description: 'Artisan who made it or notable previous owners', selectionCriteria: '' },
      { role: 'provenance-place', count: { min: 0, max: 2 }, description: 'Locations significant to the item history', selectionCriteria: '' },
      { role: 'associated-power', count: { min: 0, max: 1 }, description: 'Ability or enchantment the item possesses', selectionCriteria: '' },
    ],

    pacing: {
      wordCount: { min: 450, max: 700 },
    },
  },

  // 11. SACRED TEXT
  {
    id: 'sacred-text',
    name: 'Sacred Text',
    description: 'Religious scripture, prophecy, or spiritual teaching from a culture or faith tradition',
    tags: ['document', 'religious', 'spiritual', 'sacred'],
    eraNarrativeWeight: 'contextual',
    format: 'document',

    documentInstructions: `This is a religious or sacred text with reverence and weight appropriate to sacred literature.

STRUCTURE:
- Invocation (~40 words): Traditional opening. Names of the divine. Blessing on the reader.
- Core Teaching (~200 words): The main spiritual or moral content. Poetic structure. Memorable phrases.
- Parable or Vision (~150 words, optional): A teaching story, prophetic vision, or divine encounter.
- Precepts (~100 words): What followers must do or avoid. Stated with authority.
- Closing Blessing (~50 words): Final blessing, promise, or warning. Memorable closing.

VOICE & TONE: Divine voice, prophetic utterance, or ancient sage. Second person for commandments. Third person for narrative. Reverent, elevated, ancient, authoritative, poetic.

Include repetition for emphasis, metaphor and symbol, direct address to faithful, cosmic scope. Divine beings, prophets, or founders may be named.

Avoid casual language, modern idioms, uncertainty or hedging, irony.`,

    eventInstructions: 'Mythic events, creation stories, or prophesied future events. Frame as eternal truths.',

    craftPosture: '',
    titleGuidance: 'The title is a name, not a description — spoken the way believers speak the name of their scripture. It should feel like it has always existed: not chosen but revealed, not composed but received. Sacred register: elevated, set apart from common speech, carrying the weight of doctrine in as few words as possible. One to three words.',

    roles: [
      { role: 'divine-teaching', count: { min: 1, max: 2 }, description: 'Doctrine, law, or spiritual truth being revealed', selectionCriteria: '' },
      { role: 'sacred-power', count: { min: 0, max: 1 }, description: 'Divine ability, blessing, or cosmic force', selectionCriteria: '' },
      { role: 'prophesied-era', count: { min: 0, max: 1 }, description: 'Age that was, is, or will be', selectionCriteria: '' },
      { role: 'divine-figure', count: { min: 0, max: 2 }, description: 'God, prophet, or holy person', selectionCriteria: '' },
      { role: 'sacred-place', count: { min: 0, max: 1 }, description: 'Holy site or realm', selectionCriteria: '' },
    ],

    pacing: {
      wordCount: { min: 400, max: 650 },
    },
  },

  // 12. CREATION MYTH
  {
    id: 'creation-myth',
    name: 'Creation Myth',
    description: 'Cosmogonic narration — how the world was made, why it divided, what was sealed. Competing traditions, multiple shapers, mythic specificity',
    tags: ['document', 'myth', 'cosmogony', 'origin'],
    eraNarrativeWeight: 'contextual',
    format: 'document',

    documentInstructions: `This is a creation myth — a cosmogonic text narrating how the world was made, divided, and settled into its present shape.

STRUCTURE:
The myth moves from undifferentiation to differentiation: formless to formed, nameless to named, unified to divided. Let the cast and the world's fractures determine the proportions, but the arc follows this cosmogonic sequence:

1. PRIMORDIAL STATE: Open with negative cosmology — enumerate what did not yet exist. "Before X had been named, before Y had been separated from Z." The primordial state is specific: primordial waters, a cosmic body, commingled substances, a generative darkness. Something exists, but nothing has been distinguished from anything else.

2. THE COSMOGONIC ACT: How differentiation began. Multiple shapers with conflicting agendas — one builds while another steals, one creates by speech while another creates by sacrifice or dismemberment. Draw from the toolkit of cosmogonic motifs: separation of sky and earth, body-to-world transformation (a being's blood becomes rivers, bones become mountains), naming and speech as creative acts, cosmic combat whose aftermath becomes landscape, failed attempts before the world holds its shape. The shapers' contributions are real and costly. Their acts leave marks on the world that persist.

3. THE DIVISION: Why the world split. The central fracture — what separated cultures, powers, or geographies. Caused by specific acts with specific consequences, where both sides of the split have legitimate claims.

4. THE UNRESOLVED: What was sealed, buried, or left open. The myth carries its world's anxieties forward: the door that stays shut, the force contained rather than destroyed, the question the traditions still argue over.

TEMPORAL ANCHOR:
The myth belongs to the time of making. Its central acts are cosmogonic — the shaping, the dividing, the sealing. Events from later ages are consequences the myth foreshadows, not events it narrates. The figures exist here at their fullest scale.

COMPETING TRADITIONS:
This text was assembled from multiple source traditions that agree on events but disagree on meaning. The compiler is visible — the seams between accounts show. Where traditions contradict, both versions stand. The text has layers and argues with itself.

COSMOGONIC REGISTER:
Deep-time narration — geological ages compressed into paragraphs. Declarative, confident, primordial past tense ("in the time before time," "when the first vein split"). Parallelism and structural repetition: catalog passages that enumerate what was made from what ("from the teeth, the ridgeline stones; from the breath, the trade winds; from the open eye, the northern sea"). Paired opposites recur (light/dark, above/below, shaped/unworked). The rhythm is incantatory — closer to genealogical chant than to prose narrative.

MYTHIC SPECIFICITY:
Even in deep time, the world's physical reality holds. Gods and shapers carry specific objects, leave specific marks, bleed specific colors. Body-to-world correspondences are concrete and sensory: particular anatomies become particular geographies. Sacred means heavy with detail, dense with material.`,

    eventInstructions: 'Foundational events are the myth itself. Creation events, schisms, and sealed catastrophes are narrated as the acts of shapers and the resistance of the substrate. Frame events as cosmological acts with physical consequences that persist in the present landscape.',

    craftPosture: `Confident declaration throughout. Each tradition states its version as fact.
The compiler shows the seams but does not resolve the contradictions.
Restraint at the edges — what was sealed stays sealed, what is unanswered stays unanswered. The myth ends with the world as it is: fractured, contested, held together by acts still in progress.`,

    titleGuidance: 'The title names the text the way a civilization names its foundational document — a proper name that carries weight, spoken the way a people speak the name of their origin. Short, declarative, old-sounding. One to four words. A noun phrase, spoken as if it has always existed.',

    roles: [
      { role: 'shaper', count: { min: 1, max: 3 }, description: 'Entities that actively shaped or divided the world — creators, tricksters, builders. Their agendas conflict.', selectionCriteria: '' },
      { role: 'adversary-witness', count: { min: 0, max: 2 }, description: 'Forces that observed, tested, or opposed creation — older presences, cosmic opponents, those with competing claims on the substrate', selectionCriteria: '' },
      { role: 'prophet-keeper', count: { min: 0, max: 2 }, description: 'Those who carry or guard knowledge from the making — hermits, seers, door-wardens', selectionCriteria: '' },
      { role: 'sacred-order', count: { min: 0, max: 2 }, description: 'Groups or factions descended from the shapers\' work — priesthoods, guilds, custodial orders', selectionCriteria: '' },
      { role: 'primordial-body', count: { min: 1, max: 2 }, description: 'The world-substrate itself — locations that ARE the creation. The body from which geography was carved, the matter that was separated or dismembered into landscape.', selectionCriteria: '' },
      { role: 'sacred-artifact', count: { min: 0, max: 3 }, description: 'Objects of power from or before the making — instruments, weapons, sealed containers', selectionCriteria: '' },
      { role: 'sealed-threshold', count: { min: 0, max: 2 }, description: 'Places where creation\'s work meets its limits — sealed doors, boundaries, containment sites', selectionCriteria: '' },
      { role: 'foundational-event', count: { min: 0, max: 2 }, description: 'Occurrences that anchor the myth\'s timeline — the shattering, the division, the sealing', selectionCriteria: '' },
    ],

    pacing: {
      wordCount: { min: 1500, max: 3500 },
    },
  },

  // 13. ORIGIN MYTH
  {
    id: 'origin-myth',
    name: 'Origin Myth',
    description: 'Gods who walk in the world — how the current age was forged by divine-scale figures whose acts reshaped the landscape itself',
    tags: ['document', 'myth', 'origin', 'age-transition', 'divine'],
    eraNarrativeWeight: 'contextual',
    format: 'document',

    documentInstructions: `This is an origin myth — the story of divine or near-divine figures whose acts during a previous age shaped the world into its current form. The world already existed. These figures walked in it, and the world bent around them. Their griefs reshaped coastlines. Their conflicts created new geographies. Their departures changed the climate. Where a mortal chronicle records a battle, this records the mountain that was raised to win it.

STRUCTURE:
Three to five chapters, numbered with Roman numerals. Each chapter is a substantial movement of the myth — long enough to build, dense enough to carry weight. Let chapter breaks fall at genuine turning points in the narrative, not at each new topic or each new figure. Establish the figures in relation to each other and to the world in the same movement — their story is how they interacted, how their powers collided and complemented, not a sequence of isolated portraits.

The arc: establish the old age and the figures who shaped it. Build toward what destabilized that age — divine-scale acts with physical consequences on the world. Move through the transition: what was destroyed, transformed, or carried. End at the threshold of the current age, where the figures are receding and what survives of them is partial.

TEMPORAL ANCHOR:
This myth belongs to the old age. Its central acts, its defining choices, its dramatic weight all belong to the time before the transition. Events that the current age records as recent history are consequences the myth foreshadows — echoes and inheritances, not the myth's own story. The figures' mortal-era deeds are aftermath. The myth tells what they did when they were still walking at full scale.

VOICE:
The myth speaks for itself. No compiler frame, no curatorial apparatus, no editorial commentary explaining where traditions diverge. Where traditions contradict, weave both versions into the narrative directly — let the reader feel the seam without a narrator pointing to it. The text is the myth as it has been told and retold, not an academic assembly of sources.

MYTHIC REGISTER:
Deep-time narration at divine scale. The figures' actions have geological and climatic consequences described with physical specificity. Parallelism and catalog passages that enumerate what a figure made, destroyed, or left behind. Declarative, confident, incantatory at the transitions.

MYTHIC SPECIFICITY:
Divine scale means more detail, not less. A god's weapon has a name and a material. A divine act leaves a specific geographic consequence — this particular ridge, that particular current, the silence in this specific valley. Their physical presence is overwhelming and particular.`,

    eventInstructions: 'Events are the acts of divine-scale figures with world-shaping consequences. Anchor events in the old age — the myth tells what these figures did at full scale, before they diminished. Later-era events are consequences the myth foreshadows, not events it narrates.',

    craftPosture: `Confident narration throughout. The myth knows what happened, even when it disagrees with itself about why.
Where traditions contradict, both stand without resolution — the seams show in the telling, not in editorial commentary.
Economy over exhaustiveness — each passage earns its place.`,

    titleGuidance: 'The title names the old age, the transition, or the figures themselves — what later generations call the time when gods walked. Short, heavy, carrying the weight of deep memory. One to four words. A noun phrase that sounds ancient and well-worn, spoken with reverence or fear depending on who speaks it.',

    roles: [
      { role: 'elder-power', count: { min: 1, max: 3 }, description: 'Divine or near-divine figures of the old age — beings whose acts reshaped geography, climate, and the structure of the world', selectionCriteria: '' },
      { role: 'inheritor', count: { min: 0, max: 2 }, description: 'Those who carried something through the transition — keepers of knowledge, founders of the new age\'s first institutions', selectionCriteria: '' },
      { role: 'lost-order', count: { min: 0, max: 2 }, description: 'Powers, alliances, or institutions that existed in the old age and were destroyed or transformed by the transition', selectionCriteria: '' },
      { role: 'shaped-ground', count: { min: 1, max: 2 }, description: 'Locations that bear the marks of divine action — landscapes carved, frozen, raised, or broken by the figures of the old age', selectionCriteria: '' },
      { role: 'catalyst-event', count: { min: 0, max: 2 }, description: 'The specific acts that triggered or defined the transition — divine choices with world-scale consequences', selectionCriteria: '' },
      { role: 'relic', count: { min: 0, max: 3 }, description: 'Objects of power from the old age or from before it — things that survived the transition, things even the divine figures did not fully understand', selectionCriteria: '' },
      { role: 'sealed-legacy', count: { min: 0, max: 2 }, description: 'What was sealed, buried, or withdrawn — divine works that the new age contains rather than understands', selectionCriteria: '' },
      { role: 'contested-figure', count: { min: 0, max: 2 }, description: 'Figures the traditions disagree about — savior to one account, destroyer to another. Large enough that different communities experienced them differently.', selectionCriteria: '' },
    ],

    pacing: {
      wordCount: { min: 1500, max: 3500 },
    },
  },

];
