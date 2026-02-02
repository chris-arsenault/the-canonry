/**
 * Document Style Types and Defaults
 *
 * Defines document-based narrative styles for in-universe documents
 * like news articles, treaties, letters, etc.
 *
 * Design principle: Mirrors story styles - freeform text blocks over structured micro-fields.
 * The LLM works best with natural language guidance, not fragmented config.
 */

import type { RoleDefinition } from './narrativeStyles.js';

/**
 * Document narrative style - for in-universe document formats
 *
 * Simplified structure that mirrors StoryNarrativeStyle:
 * - Freeform text blocks for guidance (documentInstructions, eventInstructions)
 * - Minimal structure for genuinely useful constraints (roles, pacing)
 */
export interface DocumentNarrativeStyle {
  format: 'document';

  // === Metadata (same as story) ===
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description shown in UI */
  description: string;
  /** Tags for categorization */
  tags?: string[];

  // === Freeform Text Blocks (injected directly into prompts) ===

  /**
   * Document structure and style instructions - how to write the document.
   * Includes: document type, section structure, voice, tone, what to include/avoid.
   * This is the primary guidance for document generation.
   */
  documentInstructions: string;

  /**
   * Event usage instructions - how to incorporate world events.
   * Optional - only needed if events require special handling.
   */
  eventInstructions?: string;

  // === Structured Data (genuinely useful as structured) ===

  /** Cast roles - what positions exist in this document */
  roles: RoleDefinition[];

  /** Pacing - word count range */
  pacing: {
    wordCount: { min: number; max: number };
  };

  /**
   * LLM temperature for chronicle generation (0.0-1.0).
   * Higher values produce more creative/varied output.
   * If not set, falls back to the hardcoded step default (0.7 for generation).
   */
  temperature?: number;
}

// =============================================================================
// Default Document Styles
// =============================================================================

export const DEFAULT_DOCUMENT_STYLES: DocumentNarrativeStyle[] = [
  // 1. HERALD'S DISPATCH
  {
    id: 'heralds-dispatch',
    name: "Herald's Dispatch",
    description: 'Official news proclamation or town crier announcement about recent events',
    tags: ['document', 'news', 'official', 'proclamation'],
    format: 'document',

    documentInstructions: `This is an official news dispatch meant to be read aloud in the town square.

STRUCTURE:
- Headline (~15 words): Punchy, declarative. Start with action verb or dramatic noun.
- Lead Paragraph (~60 words): Essential facts - who did what, where, and why it matters to the common folk.
- Full Account (~200 words): Expand on events, include witness accounts or official statements.
- Implications (~80 words): How this affects trade, safety, daily life. What might happen next.

VOICE & TONE: Third person, present tense for immediacy. Authoritative, urgent, formal-but-accessible. The voice of an official announcer.

Include specific names, locations, dates/times, official titles, and direct quotes. Reference entities by full title and name. Important figures should be quoted or mentioned.

Avoid modern journalism terms, passive voice in headlines, speculation presented as fact.`,

    eventInstructions: 'Events are the news. Present them as recent occurrences with immediate relevance.',

    roles: [
      { role: 'newsworthy-subject', count: { min: 1, max: 2 }, description: 'The occurrence or entity being announced' },
      { role: 'affected-territory', count: { min: 0, max: 2 }, description: 'Locations impacted by the news' },
      { role: 'faction-involved', count: { min: 0, max: 2 }, description: 'Organizations, kingdoms, or groups in the news' },
      { role: 'notable-figure', count: { min: 0, max: 2 }, description: 'Persons of importance mentioned' },
    ],

    pacing: {
      wordCount: { min: 300, max: 500 },
    },
  },

  // 2. TREATISE ON POWERS
  {
    id: 'treatise-powers',
    name: 'Treatise on Powers',
    description: 'Scholarly analysis of abilities, magic, or supernatural phenomena',
    tags: ['document', 'scholarly', 'abilities', 'academic'],
    format: 'document',

    documentInstructions: `This is an academic treatise presenting scholarly findings to peers.

STRUCTURE:
- Abstract (~80 words): Concise overview of what was studied and concluded.
- Introduction (~100 words): Why this ability matters. Historical context. What questions this treatise addresses.
- Observations (~200 words): Documented instances, effects observed, conditions required. Be specific.
- Theoretical Analysis (~150 words): What the observations suggest. How this connects to known principles.
- Caveats (~80 words): Risks of misuse, limitations, ethical considerations.
- Conclusion (~60 words): Key takeaways, questions for future study.

VOICE & TONE: Third person academic. First person plural ("we observe") for analysis. Formal register. Scholarly, precise, analytical, measured, authoritative.

Include technical terminology, specific examples, qualifications, citations to authorities. Reference documented capabilities of entities with abilities.

Avoid casual language, unsubstantiated claims, sensationalism, first person singular.`,

    eventInstructions: 'Events serve as case studies or evidence. Cite specific instances where powers manifested.',

    roles: [
      { role: 'studied-power', count: { min: 1, max: 2 }, description: 'The ability, magic, or phenomenon being analyzed' },
      { role: 'documented-practitioner', count: { min: 0, max: 2 }, description: 'Those who wield or manifest the power' },
      { role: 'scholarly-authority', count: { min: 0, max: 1 }, description: 'Expert or institution lending credibility' },
      { role: 'related-artifact', count: { min: 0, max: 2 }, description: 'Objects associated with the power' },
    ],

    pacing: {
      wordCount: { min: 600, max: 900 },
    },
  },

  // 3. MERCHANT'S BROADSHEET
  {
    id: 'merchants-broadsheet',
    name: "Merchant's Broadsheet",
    description: 'Commercial advertisement, trade announcement, or market bulletin',
    tags: ['document', 'commercial', 'trade', 'advertisement'],
    format: 'document',

    documentInstructions: `This is a commercial advertisement from a merchant trying to attract customers.

STRUCTURE:
- Attention Grabber (~30 words): Bold claim, question, or announcement. Make them curious.
- What We Offer (~150 words): Describe items with appeal. Focus on benefits, not just features.
- Why Trust Us (~80 words): Years of experience, famous customers, quality guarantees.
- Satisfied Customers (~60 words, optional): Quote from a satisfied buyer. Name and location add authenticity.
- Visit Us (~40 words): Where to find them, when open, special current deals.

VOICE & TONE: First person from merchant, or third person promotional. Enthusiastic, persuasive, confident, welcoming, urgent - but genuine.

Include specific products, prices or barter terms, location details, merchant personality. Items might reference artifacts or abilities.

Avoid modern marketing jargon, obvious lies, threatening language, desperation.`,

    eventInstructions: 'Recent events create opportunities. "After the siege, rebuilding supplies in high demand!"',

    roles: [
      { role: 'merchant', count: { min: 1, max: 1 }, description: 'The seller with personality and credibility' },
      { role: 'featured-goods', count: { min: 1, max: 3 }, description: 'Products or services being advertised' },
      { role: 'satisfied-customer', count: { min: 0, max: 1 }, description: 'Testimonial source' },
    ],

    pacing: {
      wordCount: { min: 300, max: 450 },
    },
  },

  // 4. COLLECTED CORRESPONDENCE
  {
    id: 'collected-letters',
    name: 'Collected Correspondence',
    description: 'Exchange of letters between entities revealing relationships and events',
    tags: ['document', 'letters', 'personal', 'epistolary'],
    format: 'document',

    documentInstructions: `This is a collection of authentic personal letters between entities.

STRUCTURE:
- Editor's Note (~60 words): Why these letters were preserved. Who the correspondents were.
- First Letter (~200 words): Initial communication. Raises questions, shares news, makes a request.
- Reply (~200 words): Addresses the first letter. Reveals the other perspective. Deepens the situation.
- Final Letter (~180 words, optional): Concludes the exchange or leaves tantalizing loose ends.

VOICE & TONE: First person from each writer. Each letter has distinct voice matching the entity. Personal, intimate, revealing, period-appropriate, distinctive-voices.

Include personal details, emotional subtext, period greetings/closings, references to shared history. Their bond should be evident in how they write.

Avoid identical voices, exposition dumps, modern idioms, perfect information.`,

    eventInstructions: 'Events are what they write about. News, reactions, consequences discussed in personal terms.',

    roles: [
      { role: 'correspondent-a', count: { min: 1, max: 1 }, description: 'First letter writer' },
      { role: 'correspondent-b', count: { min: 1, max: 1 }, description: 'Second letter writer / respondent' },
      { role: 'mentioned-party', count: { min: 0, max: 2 }, description: 'People or groups discussed in the letters' },
    ],

    pacing: {
      wordCount: { min: 500, max: 800 },
    },
  },

  // 5. CHRONICLE ENTRY
  {
    id: 'chronicle-entry',
    name: 'Chronicle Entry',
    description: 'Official historical record or archive entry documenting events',
    tags: ['document', 'historical', 'official', 'archive'],
    format: 'document',

    documentInstructions: `This is an official historical chronicle entry documenting events for posterity.

STRUCTURE:
- Entry Header (~40 words): Date, period, chronicler identification.
- Events Recorded (~250 words): Chronological account. Specific details. Who did what.
- Significance (~100 words): Why this matters. How it connects to other events. Precedents.
- Notable Figures (~80 words): List key entities and their roles. Titles and affiliations.
- Chronicler's Notes (~60 words, optional): Uncertainties, conflicting accounts, personal reflections.

VOICE & TONE: Third person objective. The chronicler may intrude briefly in notes sections. Objective, formal, precise, archival, measured.

Include specific dates, full titles, source attribution, cross-references. Use full titles and note entity roles.

Avoid emotional language, speculation as fact, modern historical terms, bias without acknowledgment.`,

    eventInstructions: 'Events are the primary content. Document them with precision and context.',

    roles: [
      { role: 'era-documented', count: { min: 0, max: 1 }, description: 'The age or period being recorded' },
      { role: 'pivotal-event', count: { min: 0, max: 2 }, description: 'Key occurrence being chronicled' },
      { role: 'historical-figure', count: { min: 0, max: 3 }, description: 'Notable persons documented' },
      { role: 'faction-recorded', count: { min: 0, max: 2 }, description: 'Organizations or powers mentioned' },
      { role: 'chronicler', count: { min: 0, max: 1 }, description: 'The voice recording history' },
    ],

    pacing: {
      wordCount: { min: 450, max: 650 },
    },
  },

  // 6. WANTED NOTICE
  {
    id: 'wanted-notice',
    name: 'Wanted Notice',
    description: 'Bounty poster, warning notice, or official alert about a person or threat',
    tags: ['document', 'warning', 'bounty', 'official'],
    format: 'document',

    documentInstructions: `This is an official notice meant to be posted publicly - a wanted poster or warning.

STRUCTURE:
- Alert Header (~20 words): WANTED, REWARD OFFERED, or WARNING. Large and clear.
- Subject Description (~100 words): Name, aliases, physical description, distinguishing marks, known abilities.
- Crimes/Reason (~80 words): List of offenses or reason for the notice. Specific incidents.
- Reward & Contact (~60 words): What is offered. Where to report. Conditions.
- Cautions (~40 words): Danger level. Do not approach. Special abilities to watch for.

VOICE & TONE: Official third person. Terse, declarative sentences. Commands where appropriate. Urgent, official, direct, warning, authoritative.

Include specific physical details, last known location, bounty amount, authority seal. Describe the subject as someone might identify them on sight.

Avoid ambiguity, lengthy prose, humor, speculation.`,

    eventInstructions: 'Events are the crimes or incidents. Reference specific acts.',

    roles: [
      { role: 'wanted-subject', count: { min: 1, max: 1 }, description: 'The person or entity being sought' },
      { role: 'issuing-authority', count: { min: 0, max: 1 }, description: 'Who posted the notice' },
      { role: 'victim', count: { min: 0, max: 2 }, description: 'Those harmed by the subject' },
    ],

    pacing: {
      wordCount: { min: 250, max: 400 },
    },
  },

  // 7. DIPLOMATIC ACCORD
  {
    id: 'diplomatic-accord',
    name: 'Diplomatic Accord',
    description: 'Treaty, alliance agreement, or formal pact between factions',
    tags: ['document', 'diplomatic', 'treaty', 'formal'],
    format: 'document',

    documentInstructions: `This is a formal diplomatic treaty or accord between powers.

STRUCTURE:
- Treaty Title (~20 words): Formal name including parties and purpose.
- Preamble (~100 words): Why the parties come together. Shared interests. Diplomatic language.
- Articles (~300 words): Numbered articles with clear terms. Rights, obligations, conditions.
- Enforcement & Duration (~80 words): How violations are handled. How long this lasts. Renewal terms.
- Signatures (~60 words): Who signs, their titles, date, location of signing.

VOICE & TONE: Third person formal. Legal register. "The parties hereby agree..." style. Formal, precise, diplomatic, binding, ceremonial.

Include specific obligations, mutual commitments, enforcement mechanisms, formal titles. Use full titles and formal names for parties.

Avoid ambiguous terms, one-sided benefits, informal language, unenforceable clauses.`,

    eventInstructions: 'Events may be what led to the treaty - referenced in preamble as context.',

    roles: [
      { role: 'signatory-faction', count: { min: 2, max: 4 }, description: 'Party to the accord' },
      { role: 'binding-principle', count: { min: 0, max: 2 }, description: 'Law, tradition, or doctrine being established or invoked' },
      { role: 'territorial-subject', count: { min: 0, max: 2 }, description: 'Land or region covered by the accord' },
      { role: 'signatory-leader', count: { min: 0, max: 2 }, description: 'Representative who signs on behalf of faction' },
    ],

    pacing: {
      wordCount: { min: 500, max: 750 },
    },
  },

  // 8. TAVERN NOTICE BOARD
  {
    id: 'tavern-notices',
    name: 'Tavern Notice Board',
    description: 'Collection of community postings: jobs, rumors, announcements, personal ads',
    tags: ['document', 'community', 'rumors', 'informal'],
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

    roles: [
      { role: 'establishment', count: { min: 0, max: 1 }, description: 'The tavern or public house hosting the board' },
      { role: 'job-poster', count: { min: 0, max: 1 }, description: 'Someone seeking help' },
      { role: 'rumor-subject', count: { min: 0, max: 2 }, description: 'Person or event being gossiped about' },
      { role: 'mysterious-poster', count: { min: 0, max: 1 }, description: 'Unknown entity leaving intriguing notice' },
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

    roles: [
      { role: 'enemy-force', count: { min: 0, max: 2 }, description: 'Hostile faction or army being observed' },
      { role: 'terrain-assessed', count: { min: 0, max: 2 }, description: 'Territory, fortification, or location being reported on' },
      { role: 'capability-observed', count: { min: 0, max: 2 }, description: 'Enemy abilities, magic, or weapons noted' },
      { role: 'reporting-unit', count: { min: 0, max: 1 }, description: 'Scout or reconnaissance party submitting report' },
      { role: 'strategic-asset', count: { min: 0, max: 1 }, description: 'Resource, weapon, or item of tactical importance' },
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

    roles: [
      { role: 'catalogued-item', count: { min: 1, max: 3 }, description: 'Artifact, creation, or treasure being documented' },
      { role: 'creator-or-owner', count: { min: 0, max: 2 }, description: 'Artisan who made it or notable previous owners' },
      { role: 'provenance-place', count: { min: 0, max: 2 }, description: 'Locations significant to the item history' },
      { role: 'associated-power', count: { min: 0, max: 1 }, description: 'Ability or enchantment the item possesses' },
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

    roles: [
      { role: 'divine-teaching', count: { min: 1, max: 2 }, description: 'Doctrine, law, or spiritual truth being revealed' },
      { role: 'sacred-power', count: { min: 0, max: 1 }, description: 'Divine ability, blessing, or cosmic force' },
      { role: 'prophesied-era', count: { min: 0, max: 1 }, description: 'Age that was, is, or will be' },
      { role: 'divine-figure', count: { min: 0, max: 2 }, description: 'God, prophet, or holy person' },
      { role: 'sacred-place', count: { min: 0, max: 1 }, description: 'Holy site or realm' },
    ],

    pacing: {
      wordCount: { min: 400, max: 650 },
    },
  },

  // 12. PROVERBS & SAYINGS
  {
    id: 'proverbs-sayings',
    name: 'Proverbs & Sayings',
    description: 'Collection of folk wisdom, traditional sayings, and cultural aphorisms',
    tags: ['document', 'wisdom', 'folklore', 'cultural'],
    format: 'document',

    documentInstructions: `This is a collection of authentic-feeling folk wisdom and proverbs.

STRUCTURE:
- Introduction (~60 words): Who uses these sayings. What they reveal about the culture.
- Common Sayings (~120 words): 4-6 proverbs about daily life, work, family. Practical wisdom.
- Cautionary Sayings (~100 words): 3-4 proverbs warning against folly, danger, or moral failure.
- Virtue Sayings (~100 words): 3-4 proverbs praising positive qualities valued by the culture.
- Old Sayings (~80 words, optional): 2-3 more mysterious proverbs. Meaning debated or lost.

VOICE & TONE: Collective wisdom. Third person observations. Some in imperative mood. Pithy, memorable, earthy, wise, traditional.

Include local imagery, rhythm and rhyme where natural, concrete metaphors, occasional contradictions. Legendary figures might appear in sayings.

Avoid modern concepts, abstract language, lengthy explanations within proverbs, forced rhymes.`,

    eventInstructions: 'Historical events become cautionary tales. "Remember the [disaster]" type sayings.',

    roles: [
      { role: 'cultural-value', count: { min: 1, max: 3 }, description: 'Tradition, belief, or principle expressed in the sayings' },
      { role: 'folk-hero', count: { min: 0, max: 2 }, description: 'Legendary figure referenced in proverbs' },
      { role: 'cultural-institution', count: { min: 0, max: 1 }, description: 'Guild, temple, or social group whose wisdom is cited' },
      { role: 'proverbial-place', count: { min: 0, max: 1 }, description: 'Location referenced in cautionary tales' },
    ],

    pacing: {
      wordCount: { min: 350, max: 550 },
    },
  },

  // 13. PRODUCT REVIEWS
  {
    id: 'product-reviews',
    name: 'Product Reviews',
    description: 'Customer testimonials and critiques of goods, services, or establishments',
    tags: ['document', 'commercial', 'reviews', 'informal'],
    format: 'document',

    documentInstructions: `This is a collection of authentic-feeling customer reviews with varied voices and opinions.

STRUCTURE:
- Subject Header (~30 words): Name of product/service/place. Vendor. Basic info.
- Satisfied Customer (~100 words): Enthusiastic review. Specific praise. Would recommend.
- Disappointed Customer (~100 words): Complaint with specifics. What went wrong. Warning to others.
- Balanced Review (~100 words): Pros and cons. Specific use cases. Qualified recommendation.
- Quick Takes (~80 words): 2-3 very brief reviews. Different perspectives. Varied literacy levels.

VOICE & TONE: Multiple first-person voices. Varied education levels and personalities. Some formal, some casual. Varied, authentic, opinionated, specific, personal.

Include specific details, comparisons to alternatives, usage context, personality quirks. Reviewers are ordinary people. Vendor might be a known entity.

Avoid identical voices, all positive or all negative, generic praise, modern review site language.`,

    eventInstructions: 'Reviews reference occasions. "Bought for the festival" or "Needed after the flood."',

    roles: [
      { role: 'reviewed-subject', count: { min: 1, max: 1 }, description: 'Product, service, or establishment being reviewed' },
      { role: 'vendor', count: { min: 0, max: 1 }, description: 'The seller or provider' },
      { role: 'notable-reviewer', count: { min: 0, max: 1 }, description: 'Famous customer whose opinion carries weight' },
    ],

    pacing: {
      wordCount: { min: 350, max: 500 },
    },
  },

  // 14. PERSONAL DIARY
  {
    id: 'personal-diary',
    name: 'Personal Diary',
    description: 'Private journal entries spanning days or weeks - unguarded, inconsistent, never meant to be read',
    tags: ['document', 'personal', 'private', 'journal'],
    format: 'document',

    documentInstructions: `This is a private diary. The writer is talking to themselves. There is no audience, no performance, no filter. Some entries are three words. Some are rambling paragraphs. The tone shifts with the writer's mood - bored, panicked, tender, petty, profound.

STRUCTURE:
- Entry 1 (~80 words): A mundane day. Establish the writer's voice, daily concerns, small complaints or pleasures. Dated.
- Entry 2 (~120 words): Something happened. The writer processes it messily - not as narrative but as emotional reaction. Incomplete sentences. Second-guessing. Crossed-out phrases represented as [struck through: ...] or dashes trailing off.
- Entry 3 (~150 words): The event's aftermath. The writer tries to make sense of things. Fails partially. Reveals something they wouldn't tell anyone - a fear, a desire, a secret opinion of someone.
- Entry 4 (~80 words): Time has passed. Shorter. Either the crisis resolved or the writer moved on. A new mundane concern. Life continues.
- Final Entry (~40 words, optional): Brief. Cryptic. May hint at something coming. Or may just be "Rain again. Need candles."

VOICE & TONE: First person, utterly private. Grammar loosens when emotional. Abbreviations, nicknames, private references the reader can't fully decode. The writer doesn't explain context - they already know it. Unfiltered, inconsistent, raw, intimate, messy.

Include private opinions about known entities (harsher or kinder than public face), mundane details (meals, weather, health), and emotional processing that's incomplete and honest.

Avoid consistent tone, literary polish, awareness of audience, complete narratives, exposition for the reader's benefit. The diary is NOT trying to communicate.`,

    eventInstructions: 'Events are experienced personally, not reported. "That thing at the market today" not "The merchant guild trade dispute." The writer assumes they remember context.',

    roles: [
      { role: 'diarist', count: { min: 1, max: 1 }, description: 'The private voice - their unguarded self, messier than their public persona' },
      { role: 'mentioned-person', count: { min: 0, max: 2 }, description: 'People the diarist writes about - described with unfiltered private opinion' },
      { role: 'private-concern', count: { min: 0, max: 1 }, description: 'The thing weighing on them - may be petty, profound, or both' },
    ],

    pacing: {
      wordCount: { min: 350, max: 550 },
    },
  },

  // 15. INTERROGATION RECORD
  {
    id: 'interrogation-record',
    name: 'Interrogation Record',
    description: 'Official transcript of questioning - terse exchanges, redacted sections, margin notes from a reviewing officer',
    tags: ['document', 'official', 'transcript', 'adversarial'],
    format: 'document',

    documentInstructions: `This is an official interrogation transcript. Bureaucratic header. Terse Q&A format. The interrogator is persistent. The subject is evasive, frightened, or defiant. Truth leaks out through cracks in the subject's composure.

STRUCTURE:
- Header (~40 words): Official classification. Date. Location. Interrogator rank and name. Subject name and status (prisoner, witness, detainee). Authorization reference.
- Opening Exchange (~100 words): Formal identification. Subject's state noted. The interrogator establishes authority and topic. The subject's first responses reveal their strategy - cooperation, defiance, or calculated partial truth.
- Core Questioning (~200 words): The interrogator presses on key points. Questions get sharper. Answers get shorter or more evasive. Include at least one [REDACTED] passage and one [Subject pauses] or [Subject becomes agitated] notation.
- Pressure Point (~100 words): The interrogator reveals something the subject didn't expect them to know. The subject's composure breaks briefly. What they say (or refuse to say) in this moment is the transcript's key revelation.
- Margin Notes (~60 words): Handwritten notes from a reviewing officer, formatted as [MARGIN NOTE: ...]. These are a second voice commenting on the transcript - noting inconsistencies, flagging follow-up questions, or recording their own assessment.
- Closing (~40 words): Session end notation. Subject returned to holding. Interrogator's signature. Recommendation for further action or release.

VOICE & TONE: Two voices. The interrogator is professional, persistent, occasionally threatening through implication. The subject is constrained - every word chosen carefully because words have consequences here. Terse, adversarial, bureaucratic, tense, controlled.

Include timestamps at key moments, [REDACTED] for sensitive information, stage directions in brackets ([Subject looks away], [Long silence], [Interrogator produces document]), and official reference numbers.

Avoid casual language, long speeches, the subject volunteering information freely, clear resolution. The transcript raises as many questions as it answers.`,

    eventInstructions: 'Events are what the interrogation is about. They appear as contested facts - the interrogator\'s version versus the subject\'s version, with the truth somewhere between.',

    roles: [
      { role: 'subject', count: { min: 1, max: 1 }, description: 'The one being questioned - their evasions reveal as much as their answers' },
      { role: 'interrogator', count: { min: 1, max: 1 }, description: 'The questioner - professional, persistent, holding information back strategically' },
      { role: 'reviewing-officer', count: { min: 0, max: 1 }, description: 'The margin-note voice - reads the transcript later, catches what the interrogator missed' },
    ],

    pacing: {
      wordCount: { min: 450, max: 650 },
    },
  },

  // 16. FOLK SONG
  {
    id: 'folk-song',
    name: 'Folk Song',
    description: 'Verse with stanzas and refrain - rhyming flow is primary, story optional or told obliquely through imagery',
    tags: ['document', 'verse', 'song', 'oral-tradition'],
    format: 'document',

    documentInstructions: `This is a folk song meant to be sung. Rhythm and rhyme are paramount. Story is optional - if present, it's told obliquely through images and refrains rather than narrated directly. The song should feel like it's been passed through many voices, smoothed by repetition into something that sounds inevitable.

STRUCTURE:
- Collector's Note (~40 words): Brief context. Where this song is sung, by whom, on what occasions. Attribution if known ("commonly heard among the river traders" or "attributed to the blind poet Kael").
- Verse 1 (~60 words, 4-6 lines): Establish the song's world in images, not exposition. A place, a mood, a season, a figure. The rhythm and rhyme scheme are set here - ABAB, AABB, or ABCB. The reader should hear the melody even without music.
- Refrain (~30 words, 2-4 lines): The emotional heart. Repeated after each verse. Should be the most singable, most memorable lines. May be a question, a lament, a boast, or a cryptic phrase that gains meaning through repetition.
- Verse 2 (~60 words, 4-6 lines): Develop or shift. New images that rhyme (thematically, not just phonetically) with verse 1. If there's a story, it advances here - but through image, not plot. The same rhyme scheme.
- Refrain (repeat)
- Verse 3 (~60 words, 4-6 lines): The turn or deepening. What seemed simple now carries weight. If a story, its consequence. If mood, its darkest or brightest point. The same structure, different content.
- Refrain (repeat, possibly with one word changed for devastating effect)
- Final Verse or Coda (~40 words, 2-4 lines, optional): Brief. May circle back to verse 1's opening image. May break the pattern. Ends the song with resonance.

VOICE & TONE: The voice of many mouths. This song belongs to a community, not an author. The language is simple but precise - no word wasted. Singable, rhythmic, communal, haunting, worn-smooth.

Rhyme and rhythm are more important than narrative clarity. Near-rhymes and slant-rhymes are welcome. Meter should be consistent within verses (tetrameter or trimeter work well for folk songs). The song should sound good read aloud.

Include imagery specific to the world and culture. Use concrete nouns over abstractions. The song's meaning may be debated - "some say this is about the fall of the Silver Court, others claim it's a love song."

Avoid prose disguised as verse, forced rhymes that sacrifice meaning, modern idioms, complex vocabulary. Folk songs use common words arranged uncommonly.`,

    eventInstructions: 'Events become imagery. A war becomes "the red year." A leader becomes "the one who wore the crown of thorns." The song remembers events as feelings and images, not facts.',

    roles: [
      { role: 'song-subject', count: { min: 1, max: 2 }, description: 'What or whom the song is about - may be a person, place, event, or feeling, transformed into imagery' },
      { role: 'cultural-origin', count: { min: 0, max: 1 }, description: 'The community that sings this - their concerns and values shape the song' },
    ],

    pacing: {
      wordCount: { min: 250, max: 400 },
    },

    temperature: 0.9,
  },

  // 17. NURSERY RHYMES
  {
    id: 'nursery-rhymes',
    name: 'Nursery Rhymes',
    description: 'Collection of short children\'s rhymes on diverse subjects - simple meter, memorable, often darker than they seem',
    tags: ['document', 'verse', 'children', 'folklore'],
    format: 'document',

    documentInstructions: `This is a collection of nursery rhymes - the songs and chants children use for games, skipping, counting, or bedtime. Each rhyme is independent, touching a different subject. Together they form a mosaic of a culture's anxieties, values, and history filtered through children's mouths.

STRUCTURE:
- Collector's Introduction (~50 words): Who collected these, from where. "Gathered from the schoolyards and hearths of [place]" or similar. Note that children's rhymes often preserve history adults have forgotten.
- Rhyme 1 (~40 words, 4-6 lines): A counting or game rhyme. Bouncy meter. Used for choosing who's "it" or counting steps. References a historical figure or event obliquely. Children don't know the origin.
- Rhyme 2 (~40 words, 4-6 lines): A cautionary rhyme. Warning dressed as play. "Don't go past the old wall / when the moon is thin" - real danger made into singsong.
- Rhyme 3 (~40 words, 4-6 lines): A nonsense rhyme. Sounds like gibberish but may preserve corrupted names, places, or events. The meaning is lost; the rhythm survives.
- Rhyme 4 (~40 words, 4-6 lines): A lullaby or bedtime rhyme. Gentler. May contain an undertone of sadness or threat ("and if the wind should take you away...").
- Rhyme 5 (~40 words, 4-6 lines, optional): A clapping or taunting rhyme. Used between children. May reference a real person or group in mocking terms.
- Collector's Note (~40 words, optional): Brief scholarly footnote connecting one or two rhymes to their probable historical origins.

VOICE & TONE: Children's voices. Simple words, strong rhythm, perfect or near-perfect rhyme. The rhymes should be genuinely singable and clappable. The darkness is accidental - children repeat what they've heard without understanding. Innocent, rhythmic, catchy, ancient, dark-underneath.

Each rhyme should be metrically tight. Nursery rhymes are defined by their rhythm - they must scan. Trochaic or iambic tetrameter/trimeter. The beat should be so strong a child could clap to it.

Include corrupted versions of real names from the world, references to real events transformed beyond recognition, specific local details (places, creatures, foods).

Avoid adult vocabulary, complex syntax, obvious allegory, rhymes that sound composed rather than inherited. These should feel like they've been chanted by a thousand children who have no idea what the words originally meant.`,

    eventInstructions: 'Historical events become unrecognizable in children\'s mouths. A plague becomes "Ring around the rosie." A tyrant becomes "Old King Grumblethorn." The rhyme preserves the emotional residue, not the facts.',

    roles: [
      { role: 'rhyme-subjects', count: { min: 2, max: 4 }, description: 'Diverse subjects across the rhymes - historical figures, places, events, all transformed into children\'s chant material' },
      { role: 'cultural-origin', count: { min: 0, max: 1 }, description: 'The culture whose children sing these - their world is embedded in the imagery' },
    ],

    pacing: {
      wordCount: { min: 250, max: 400 },
    },
  },

  // 18. HAIKU COLLECTION
  {
    id: 'haiku-collection',
    name: 'Haiku Collection',
    description: 'Three to four haikus - extreme compression, nature imagery, a single moment seized in 5-7-5 syllables',
    tags: ['document', 'verse', 'minimal', 'contemplative'],
    format: 'document',

    documentInstructions: `This is a small collection of 3-4 haikus. Each is exactly three lines: 5 syllables, 7 syllables, 5 syllables. The haiku captures a single moment of perception - not a thought, not a narrative, but a seeing. The world briefly holds still.

STRUCTURE:
- Attribution (~20 words): The poet's name (or "anonymous"), the occasion or season, and the place. Brief and formal.
- Haiku 1 (3 lines, 5-7-5): A nature observation. What is seen, heard, or felt in this moment. Present tense. No commentary. The image carries everything.
- Haiku 2 (3 lines, 5-7-5): A human moment set against nature. A person doing something ordinary while the world does something extraordinary around them (or vice versa).
- Haiku 3 (3 lines, 5-7-5): The deepest perception. An image that opens into something larger. Loneliness, mortality, wonder, change - expressed entirely through concrete detail.
- Haiku 4 (3 lines, 5-7-5, optional): A final image. May circle back to the first haiku's season or setting. A closing note.

VOICE & TONE: No voice. The haiku is a window, not a speaker. Present tense, concrete nouns, active verbs. No adjectives unless they are precise and sensory. No abstractions. No metaphors explained. Still, precise, vast, fleeting, natural.

The 5-7-5 syllable count is STRICT. Count every syllable. This constraint is the form - do not violate it.

Seasonal reference (kigo) in at least two haikus - specific plants, weather, light quality, animal behavior that places the moment in a season.

A cutting word or break (kireji) in each haiku - a pause that divides the haiku into two parts, creating juxtaposition. This is what gives the haiku its resonance: two images held together, the space between them alive with meaning.

Include imagery specific to the world - its flora, fauna, weather, landscapes. The haiku should feel rooted in this world, not generic.

Avoid sentimentality, abstraction, commentary, narrative, metaphor spelled out, anything that explains rather than shows. The haiku trusts the reader completely.`,

    eventInstructions: 'Events are absent. The haiku exists outside history, in the eternal present of perception. If a war raged yesterday, the haiku notices the frost on a blade of grass this morning.',

    roles: [
      { role: 'observed-moment', count: { min: 1, max: 2 }, description: 'The subject of perception - a season, a place, a fleeting natural event' },
      { role: 'poet-context', count: { min: 0, max: 1 }, description: 'The poet or the occasion - minimal, providing just enough frame' },
    ],

    pacing: {
      wordCount: { min: 80, max: 150 },
    },
  },
];
