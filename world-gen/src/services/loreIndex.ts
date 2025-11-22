import fs from 'fs';
import path from 'path';
import { LoreIndex } from '../types/lore';

export function loadLoreIndex(lorePath: string): LoreIndex {
  const absolute = path.resolve(lorePath);
  let sourceText = '';

  try {
    sourceText = fs.readFileSync(absolute, 'utf-8');
  } catch (error) {
    console.warn(`Could not read lore bible at ${absolute}:`, error);
  }

  return {
    sourceText,
    colonies: [
      {
        name: 'Aurora Stack',
        values: ['commerce', 'tradition', 'recorded history'],
        style: 'orderly terraces, trade banners, sunlit face',
        notes: ['practical names', 'mayors serve until igloo melts', 'slogan: The tide lifts all boats']
      },
      {
        name: 'Nightfall Shelf',
        values: ['independence', 'innovation', 'ancestral memory'],
        style: 'shadow-side ledges, bioluminescent ice, rope bridges',
        notes: ['poetic names', 'elder council', 'slogan: The depths remember what the surface forgets']
      },
      { name: 'Windward Ridge', values: ['scouting', 'weather watch'], style: 'watchtower settlement' },
      { name: 'The Middle Pools', values: ['neutrality', 'shared fishing'], style: 'neutral fishing grounds' },
      { name: 'Echo Hollow', values: ['mystery'], style: 'abandoned, echoes of the past' }
    ],
    factions: [
      'Icebound Exchange',
      'Midnight Claws',
      'Deep Singers',
      'Frost Guard'
    ],
    namingRules: {
      patterns: [
        'Two-part names: ice name (birth) + earned name (First Dive deed)',
        'Aurora Stack names are shorter and practical',
        'Nightfall Shelf names are more poetic or descriptive'
      ],
      earnedNameRules: 'Earned names reflect memorable deeds (the Steady, Quick-Current, Deep-Seeker)',
      colonyTone: {
        'Aurora Stack': 'practical, trade-focused, concise',
        'Nightfall Shelf': 'poetic, mysterious, innovative'
      }
    },
    relationshipPatterns: [
      'Cross-colony relationships are rare but significant',
      'Mentor-apprentice bonds cross family lines but rarely colony lines',
      'Frost Guard recruits from both colonies to stay neutral',
      'Deep Singers often abandon colony identity'
    ],
    techNotes: [
      'Technology is communal and reliable (harmonic harpoons, krill nets, ice augers)',
      'Glow Stones, Message Ice, and Slide Wax are daily tools',
      'Ice coins melt on schedule to keep trade flowing'
    ],
    magicNotes: [
      'Ice Magic (Old Flows): frost shaping, deep sight, ice memory, aurora calling',
      'Magic has costs (ice fever) and requires cold meditation',
      'Magic is personal/old; technology is new/communal'
    ],
    tensions: [
      'Fissure rights and artifact control',
      'Krill scarcity and fishing territory',
      'Trade imbalance and melting ice coins',
      'Lost expeditions near Starfall Reach'
    ],
    canon: [
      'Two main colonies with trade and communication',
      'Ice magic exists but has costs',
      'Pre-penguin artifacts are in the berg',
      'Glow-Fissure is recent',
      'Frost Guard neutrality, Deep Singers knowledge'
    ],
    legends: [
      'Great Current still flows beneath',
      'Previous inhabitants may return',
      'Starfall Reach vanished mysteriously',
      'Aurora lights carry ancestral messages',
      'The berg swims toward a destination'
    ]
  };
}
