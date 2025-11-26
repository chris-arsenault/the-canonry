export const API_URL = 'http://localhost:3001';

export const POS_TAGS = ['noun', 'verb_3sg', 'adj', 'noun_abstract', 'prep', 'ordinal'];

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
