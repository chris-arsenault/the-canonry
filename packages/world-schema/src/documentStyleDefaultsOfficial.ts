/**
 * Default Document Style Presets (Part 1: Official & News)
 *
 * Styles: Herald's Dispatch through Diplomatic Accord.
 * Types are defined in documentStyles.ts.
 */

import type { DocumentNarrativeStyle } from './documentStyles.js';

export const DOCUMENT_STYLES_OFFICIAL: DocumentNarrativeStyle[] = [
  // 1. HERALD'S DISPATCH
  {
    id: 'heralds-dispatch',
    name: "Herald's Dispatch",
    description: 'Official news proclamation or town crier announcement about recent events',
    tags: ['document', 'news', 'official', 'proclamation'],
    eraNarrativeWeight: 'contextual',
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

    titleGuidance: 'The title is an announcement — what the crier shouts to gather a crowd. It leads with the event, the decree, or the name that commands attention. Declarative register, present tense energy, urgency. Short enough to shout across a square. The title is news, not analysis.',

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
    eraNarrativeWeight: 'flavor',
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

    titleGuidance: 'Academic and classificatory. The title names the subject under study with the precision of a scholar establishing scope. Formal and descriptive register — what would appear on a leather-bound spine in a university library. Prepositions carry institutional weight: "On," "Of," "Concerning." The title claims territory rather than making an argument.',

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
    eraNarrativeWeight: 'flavor',
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

    titleGuidance: 'The title sells. It is what a merchant would paint on a sign or shout at passersby — a boast, a promise, a name that sticks. Commercial register: confident, specific, slightly louder than necessary. Name the goods, the shop, or the deal. The title should make someone curious enough to read further.',

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
    eraNarrativeWeight: 'contextual',
    format: 'document',

    documentInstructions: `This is a collection of authentic personal letters between entities.

STRUCTURE:
- First Letter (~200 words): Opens with date, location, salutation. Raises questions, shares news, makes a request. The letter itself provides all context — who they are to each other is evident from how they write.
- Reply (~200 words): Addresses the first letter. Reveals the other perspective. Deepens the situation.
- Final Letter (~180 words, optional): Concludes the exchange or leaves tantalizing loose ends.

No editor's note, no collector's frame. The letters present themselves. Postmarks, dates, and salutations do the anchoring.

VOICE & TONE: First person from each writer. Each letter has distinct voice matching the entity. Personal, intimate, revealing, period-appropriate, distinctive-voices.

Include personal details, emotional subtext, period greetings/closings, references to shared history. Their bond should be evident in how they write.

Avoid identical voices, exposition dumps, modern idioms, perfect information.`,

    eventInstructions: 'Events are what they write about. News, reactions, consequences discussed in personal terms.',

    titleGuidance: 'The title names the correspondence as a found document — who wrote to whom, or the matter that prompted the exchange. Archival register: the voice of a collector or editor presenting private letters to the public. The intimacy is in the content, not the title. The title is a catalog label for something personal.',

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
    eraNarrativeWeight: 'contextual',
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

    titleGuidance: 'The title is a record heading — what an archivist would write on the folder. It names the event, the period, or the territory documented. Archival register: neutral, factual, locating the record rather than interpreting it. No judgment, no drama. The title places the entry in time and subject.',

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
    eraNarrativeWeight: 'flavor',
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

    titleGuidance: 'The title is what gets painted at the top of a posted notice — blunt, authoritative, designed to be read at a glance. Name the fugitive, the crime, or the bounty. Official and terse register: commands, not sentences. No ambiguity. The title identifies and accuses in the same breath.',

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
    eraNarrativeWeight: 'contextual',
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

    titleGuidance: 'The title is a treaty name — formal, bilateral, naming the parties or the matter resolved. Diplomatic register: precise and ceremonial. Real treaties name locations, dates, or the subject of agreement. The title should sound like what both sides agreed to call the document. Neutrality is a design feature.',

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

];
