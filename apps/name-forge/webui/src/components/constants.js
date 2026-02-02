export const API_URL = 'http://localhost:3001';

// Lexeme categories for name generation
export const LEXEME_CATEGORIES = {
  // Grammatical
  noun: { label: 'Noun', desc: 'Concrete nouns - objects, things' },
  verb: { label: 'Verb', desc: 'Action words' },
  adjective: { label: 'Adjective', desc: 'Descriptive words' },
  abstract: { label: 'Abstract', desc: 'Concepts, ideas, qualities' },
  core: { label: 'Core Word', desc: 'Short, concrete Germanic-root words (monosyllabic, visceral, dual-use)' },

  // Name components
  title: { label: 'Title', desc: 'Honorifics before names' },
  epithet: { label: 'Epithet', desc: 'Descriptive phrases after names' },
  prefix: { label: 'Prefix', desc: 'Word beginnings that attach to roots' },
  suffix: { label: 'Suffix', desc: 'Word endings that attach to roots' },
  connector: { label: 'Connector', desc: 'Linking words (of, the, von)' },

  // Semantic categories
  place: { label: 'Place Word', desc: 'Geographic/location terms' },
  creature: { label: 'Creature', desc: 'Beasts, monsters, animals' },
  element: { label: 'Element', desc: 'Natural forces and phenomena' },
  material: { label: 'Material', desc: 'Substances and materials' },
  celestial: { label: 'Celestial', desc: 'Heavenly bodies, sky phenomena' },
  color: { label: 'Color', desc: 'Color words' },
  kinship: { label: 'Kinship', desc: 'Family and clan terms' },
  occupation: { label: 'Occupation', desc: 'Roles, jobs, callings' },
  virtue: { label: 'Virtue', desc: 'Positive traits and values' },
  vice: { label: 'Vice', desc: 'Negative traits and flaws' },
  number: { label: 'Number', desc: 'Numeric and ordinal words' },

  // Organization/Group
  collective: { label: 'Collective', desc: 'Group type words (guild, order, brotherhood, council, syndicate)' },
  organization: { label: 'Organization', desc: 'Formal group names (company, house, clan, legion)' },
};

// For backwards compatibility
export const POS_TAGS = Object.keys(LEXEME_CATEGORIES);

export const PROMINENCE_LEVELS = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'];

export const MARKOV_MODELS = [
  { id: 'norse', name: 'Norse', desc: 'Viking-era Scandinavian names' },
  { id: 'germanic', name: 'Germanic', desc: 'German/Swedish names' },
  { id: 'finnish', name: 'Finnish', desc: 'Uralic language names' },
  { id: 'arabic', name: 'Arabic', desc: 'Semitic language names' },
  { id: 'celtic', name: 'Celtic', desc: 'Irish/Welsh/Gaelic names' },
  { id: 'slavic', name: 'Slavic', desc: 'Russian/Polish/Czech names' },
  { id: 'latin', name: 'Latin/Romance', desc: 'Italian/Spanish/French names' },
  { id: 'japanese', name: 'Japanese', desc: 'Japanese names in romaji' },
  { id: 'african', name: 'African', desc: 'Pan-African names' },
];

export const CONTEXT_KEYS = {
  npcRelations: [
    { key: 'leader', desc: "leader_of relationship (NPC who leads this location/faction)" },
    { key: 'founder', desc: "founder_of relationship (NPC who founded this faction)" },
    { key: 'discoverer', desc: "discovered_by relationship (NPC who discovered this location)" },
    { key: 'mentor', desc: "mentor_of relationship (NPC's mentor)" },
    { key: 'resident', desc: "resident_of relationship (NPC who lives here)" }
  ],
  locationFactionRelations: [
    { key: 'location', desc: "Related location (resident_of, stronghold_of, etc.)" },
    { key: 'faction', desc: "Related faction (member_of, stronghold_of, etc.)" },
    { key: 'birthplace', desc: "birthplace_of relationship (location where NPC was born)" },
    { key: 'stronghold', desc: "stronghold_of relationship (faction's base location)" },
    { key: 'origin', desc: "origin_of relationship (where faction originated)" }
  ]
};

export const COMMON_LITERALS = ['-', "'", "'s", 'of', 'the', 'von', 'de', 'el', 'al'];

// Grammar modifiers for token transformation
export const GRAMMAR_MODIFIERS = {
  derivation: [
    { code: '~er', desc: 'Agentive: hunt → hunter, forge → forger' },
    { code: '~est', desc: 'Superlative: deep → deepest, grim → grimmest' },
    { code: '~comp', desc: 'Comparative: dark → darker, swift → swifter' },
    { code: '~ing', desc: 'Gerund: burn → burning, forge → forging' },
    { code: '~ed', desc: 'Past tense: curse → cursed, slay → slain' },
    { code: '~poss', desc: "Possessive: storm → storm's, darkness → darkness'" },
  ],
  truncation: [
    { code: '~chopL', desc: 'Chop left: silent → ent (remove 1-3 chars from start)' },
    { code: '~chopR', desc: 'Chop right: shadow → sha (remove 1-3 chars from end)' },
    { code: '~chop', desc: 'Random chop: truncate from either start or end' },
  ],
  capitalization: [
    { code: '~cap', desc: 'Capitalize first letter' },
    { code: '~lower', desc: 'Force lowercase' },
    { code: '~upper', desc: 'Force UPPERCASE' },
    { code: '~title', desc: 'Title Case Each Word' },
  ],
  operators: [
    { code: '^', desc: 'Concatenate (join without space)' },
    { code: '|', desc: 'Alternative (random choice between options)' },
  ],
};

// Word style presets for structured lexeme generation
export const WORD_STYLE_PRESETS = {
  none: {
    label: 'None (freeform)',
    wordStyle: null,
    description: 'Use style description only, no structural constraints'
  },
  hard_words: {
    label: 'Hard Words (Anglo-Saxon)',
    wordStyle: {
      etymology: 'germanic',
      syllables: { min: 1, max: 1 },
      phonetics: { consonants: 'hard' },
      dualUse: true,
      register: 'visceral'
    },
    description: 'Short, concrete Germanic-root words like hunt, blood, storm, fang'
  },
  soft_germanic: {
    label: 'Soft Germanic',
    wordStyle: {
      etymology: 'germanic',
      syllables: { min: 1, max: 2 },
      phonetics: { consonants: 'soft' },
      register: 'neutral'
    },
    description: 'Germanic words with softer sounds like wind, wave, mist, dream'
  },
  poetic_latinate: {
    label: 'Poetic Latinate',
    wordStyle: {
      etymology: 'latinate',
      syllables: { min: 3, max: 5 },
      register: 'poetic'
    },
    description: 'Flowing, multisyllabic Romance-language derivatives like celestial, illumination'
  },
  technical_latinate: {
    label: 'Technical Latinate',
    wordStyle: {
      etymology: 'latinate',
      syllables: { min: 2, max: 4 },
      register: 'technical'
    },
    description: 'Precise, formal terminology like apparatus, mechanism, protocol'
  },
  visceral_mixed: {
    label: 'Visceral Mixed',
    wordStyle: {
      etymology: 'mixed',
      syllables: { min: 1, max: 2 },
      register: 'visceral'
    },
    description: 'High-imagery physical words from any origin like scar, venom, agony'
  }
};
