/**
 * Color Palette Types and Defaults
 *
 * Defines color direction for image generation.
 * Each palette uses soft hierarchy language (dominated by, supported by, accents)
 * to guide color distribution without being overly restrictive.
 */

/**
 * Color palette - defines color direction for image generation
 */
export interface ColorPalette {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Human-readable description */
  description: string;
  /** Group/category for organization (e.g. "hue", "contrast-pair", "metallic-triplet") */
  group: string;
  /** Prompt fragment for color direction (injected into image prompt) */
  promptFragment: string;
  /** Representative hex colors for UI swatch display (3-5 colors) */
  swatchColors: string[];
}

export const DEFAULT_COLOR_PALETTES: ColorPalette[] = [
  // ==========================================================================
  // Hue-Anchored Palettes (8)
  // ==========================================================================
  {
    id: 'crimson-dynasty',
    name: 'Crimson Dynasty',
    description: 'Deep ceremonial reds with dramatic contrast',
    group: 'hue',
    swatchColors: ['#8B0000', '#722F37', '#2C2C2C', '#C5A03F', '#1A1A1A'],
    promptFragment:
      'COLOR PALETTE: dominated by deep crimsons and burgundy wine, ' +
      'grounded in charcoal black shadows, antique gold metallic accents sparingly placed, ' +
      'dramatic value contrast, no orange or brown tones',
  },
  {
    id: 'amber-blaze',
    name: 'Amber Blaze',
    description: 'Pure warm oranges with cream and espresso',
    group: 'hue',
    swatchColors: ['#FF8C00', '#FF6B00', '#FFF5E1', '#3C1A00', '#E8A84C'],
    promptFragment:
      'COLOR PALETTE: dominated by pure amber and tangerine orange, ' +
      'supported by warm cream and vanilla tones, espresso brown accents for depth, ' +
      'luminous warmth, no reds no browns in main areas',
  },
  {
    id: 'gilded-sunlight',
    name: 'Gilded Sunlight',
    description: 'Radiant golds and yellows, bright and optimistic',
    group: 'hue',
    swatchColors: ['#FFD700', '#F4C430', '#FFFFF0', '#F5E6C8', '#CD7F32'],
    promptFragment:
      'COLOR PALETTE: dominated by radiant golden yellow and saffron, ' +
      'supported by ivory and champagne backgrounds, bronze metallic accents, ' +
      'bright and luminous, no orange, no brown',
  },
  {
    id: 'verdant-jungle',
    name: 'Verdant Jungle',
    description: 'Saturated tropical greens with coral pop',
    group: 'hue',
    swatchColors: ['#006B3C', '#50C878', '#98FF98', '#FF6F61', '#2E8B57'],
    promptFragment:
      'COLOR PALETTE: dominated by saturated emerald and jungle green, ' +
      'supported by pale mint and seafoam, bright coral accents sparingly, ' +
      'lush tropical vibrancy, no brown no earth tones',
  },
  {
    id: 'arctic-cyan',
    name: 'Arctic Cyan',
    description: 'Cool teals and cyans with crystalline clarity',
    group: 'hue',
    swatchColors: ['#00CED1', '#008B8B', '#F0FFFF', '#87CEEB', '#001F3F'],
    promptFragment:
      'COLOR PALETTE: dominated by cyan and teal, turquoise highlights, ' +
      'supported by ice white and pale aqua, deep navy accents for contrast, ' +
      'crystalline aquatic clarity, cool temperature throughout, no green',
  },
  {
    id: 'midnight-sapphire',
    name: 'Midnight Sapphire',
    description: 'Deep blues with silver accents',
    group: 'hue',
    swatchColors: ['#082567', '#0F52BA', '#708090', '#C0C0C0', '#1B1B3A'],
    promptFragment:
      'COLOR PALETTE: dominated by deep sapphire and navy blue, cobalt tones, ' +
      'supported by steel gray and slate, metallic silver accents, ' +
      'nocturnal depth, no purple no cyan',
  },
  {
    id: 'electric-magenta',
    name: 'Electric Magenta',
    description: 'Bold magentas with electric teal contrast',
    group: 'hue',
    swatchColors: ['#FF00FF', '#FF69B4', '#FFE4E1', '#008080', '#C71585'],
    promptFragment:
      'COLOR PALETTE: dominated by bold magenta and fuchsia, hot pink highlights, ' +
      'supported by pale pink and blush white, electric teal accents for contrast, ' +
      'vibrant high-energy, modern boldness, no purple no red',
  },
  {
    id: 'borealis',
    name: 'Borealis',
    description: 'Aurora lights glowing against dark polar sky',
    group: 'hue',
    swatchColors: ['#00FF7F', '#00CED1', '#FF69B4', '#8A2BE2', '#0D0D2B'],
    promptFragment:
      'COLOR PALETTE: electric green and cyan aurora ribbons, pink and violet wisps, ' +
      'against deep indigo and black polar sky, star white points, ' +
      'ethereal luminous glow, lights should pop against darkness',
  },

  // ==========================================================================
  // Special Character Palettes (3)
  // ==========================================================================
  {
    id: 'monochrome-noir',
    name: 'Monochrome Noir',
    description: 'Pure grayscale with extreme contrast',
    group: 'special',
    swatchColors: ['#1A1A1A', '#4A4A4A', '#808080', '#C0C0C0', '#F5F5F5'],
    promptFragment:
      'COLOR PALETTE: pure grayscale only, dominated by charcoal and medium grays, ' +
      'stark white highlights, jet black shadows, extreme value contrast, ' +
      'no color saturation whatsoever, dramatic chiaroscuro',
  },
  {
    id: 'volcanic-obsidian',
    name: 'Volcanic Obsidian',
    description: 'Black dominant with rare molten glow',
    group: 'special',
    swatchColors: ['#0A0A0A', '#1C1C1C', '#3D3D3D', '#FF4500', '#2C2C2C'],
    promptFragment:
      'COLOR PALETTE: dominated by obsidian black and volcanic dark tones, ' +
      'supported by ash gray and charcoal, rare molten orange-red glow accents only, ' +
      'primarily darkness with minimal fire, ember light should be scarce and precious',
  },
  {
    id: 'verdigris-patina',
    name: 'Verdigris Patina',
    description: 'Aged copper greens with rust accents',
    group: 'special',
    swatchColors: ['#4F9D8E', '#5F8A7E', '#8B6914', '#B87333', '#C25A2C'],
    promptFragment:
      'COLOR PALETTE: dominated by verdigris teal-green and patina oxidation, ' +
      'supported by weathered bronze and aged copper brown, rust orange accents sparingly, ' +
      'teal-green should dominate not brown, aged metal character',
  },

  // ==========================================================================
  // Natural / Realistic Palettes (3)
  // ==========================================================================
  {
    id: 'natural-daylight',
    name: 'Natural Daylight',
    description: 'Full spectrum realism under bright daylight',
    group: 'natural',
    swatchColors: ['#4A90D9', '#6ABF69', '#E8C84A', '#D95F4A', '#F5F0E6'],
    promptFragment:
      'COLOR PALETTE: full natural color spectrum, true-to-life colors as seen under bright daylight, ' +
      'balanced warm and cool tones, realistic saturation, ' +
      'no color grading or tinting, no dominant hue, colors as they actually appear in the real world',
  },
  {
    id: 'vivid-realism',
    name: 'Vivid Realism',
    description: 'Saturated but true-to-life, punchy real-world color',
    group: 'natural',
    swatchColors: ['#1E90FF', '#32CD32', '#FFD700', '#FF4500', '#FFFFFF'],
    promptFragment:
      'COLOR PALETTE: full natural color spectrum with heightened saturation, ' +
      'rich vivid colors as seen on a crisp clear day, punchy and eye-catching but still realistic, ' +
      'no color grading, no dominant hue, every color at its most vibrant natural intensity',
  },
  {
    id: 'comic-bold',
    name: 'Comic Bold',
    description: 'Bright, bold, distinct colors with strong separation',
    group: 'natural',
    swatchColors: ['#FF0000', '#0000FF', '#FFFF00', '#00CC00', '#FF6600'],
    promptFragment:
      'COLOR PALETTE: bright bold distinct colors, strong color separation between elements, ' +
      'saturated primaries and secondaries, each object a clear distinct hue, ' +
      'flat confident color fills, high contrast between adjacent areas, ' +
      'comic book color boldness, every color punchy and unapologetic',
  },

  // ==========================================================================
  // Metallic / Void Palettes (1)
  // ==========================================================================
  {
    id: 'void-iridescence',
    name: 'Void & Iridescence',
    description: 'Deep starfield black with electric cobalt, metallic gold, and oil-slick iridescent shifting surfaces',
    group: 'metallic',
    swatchColors: ['#0A0A1A', '#0044FF', '#FFD700', '#00CED1', '#8B00FF'],
    promptFragment:
      'COLOR PALETTE: dominated by deep void black and starfield darkness, ' +
      'electric cobalt blue and ultramarine as primary luminous color, ' +
      'metallic gold and burnished amber accents on ornamentation, ' +
      'iridescent oil-slick shifting cyan-green-purple on surfaces and ground planes, ' +
      'self-luminous subjects against pure darkness, no mid-tone backgrounds',
  },

  // ==========================================================================
  // High-Contrast Pairs (5)
  // ==========================================================================
  {
    id: 'blood-ivory',
    name: 'Blood & Ivory',
    description: 'Stark arterial red against bone white',
    group: 'contrast-pair',
    swatchColors: ['#8B0000', '#CC0000', '#FFFFF0', '#F5F0DC', '#0A0A0A'],
    promptFragment:
      'COLOR PALETTE: high contrast, arterial red and blood crimson ' +
      'against bone ivory and aged parchment white, absolute black accents only, ' +
      'stark two-color drama, visceral and bold, minimal color mixing',
  },
  {
    id: 'ink-gold',
    name: 'Ink & Gold',
    description: 'Jet black dominant with precious gold illumination',
    group: 'contrast-pair',
    swatchColors: ['#0A0A0A', '#1A1A1A', '#FFD700', '#B8860B', '#2C2C2C'],
    promptFragment:
      'COLOR PALETTE: high contrast, dominated by deep ink black and jet darkness, ' +
      'metallic gold and burnished gilt as primary accent, minimal other colors, ' +
      'luxurious darkness with precious metal light, graphic and bold, like gilt lettering on black lacquer',
  },
  {
    id: 'jade-obsidian',
    name: 'Jade & Obsidian',
    description: 'Precious jade green against volcanic black',
    group: 'contrast-pair',
    swatchColors: ['#00A86B', '#ACE1AF', '#0A0A0A', '#1C1C1C', '#FFFFF0'],
    promptFragment:
      'COLOR PALETTE: high contrast, rich jade green and celadon ' +
      'against obsidian black and deep shadow, ivory white accents sparingly, ' +
      'stark two-tone drama, like jade carvings on black silk, no other colors',
  },
  {
    id: 'azure-bone',
    name: 'Azure & Bone',
    description: 'Deep azure blue against stark ivory',
    group: 'contrast-pair',
    swatchColors: ['#003DA5', '#0047AB', '#FFFFF0', '#F5F0DC', '#2C2C2C'],
    promptFragment:
      'COLOR PALETTE: high contrast, deep azure and ultramarine blue ' +
      'against bone white and ivory, charcoal black accents sparingly, ' +
      'cool stark drama, like blue ink on parchment or Delft pottery, no other colors',
  },
  {
    id: 'violet-gold',
    name: 'Violet & Gold',
    description: 'Deep royal violet against burnished gold',
    group: 'contrast-pair',
    swatchColors: ['#4B0082', '#6A0DAD', '#FFD700', '#B8860B', '#1A1A2E'],
    promptFragment:
      'COLOR PALETTE: high contrast, deep royal violet and purple ' +
      'against burnished gold and gilt, dark indigo shadows, ' +
      'regal two-tone drama, like illuminated manuscripts or Byzantine mosaics, no other colors',
  },

  // ==========================================================================
  // Hue Gap Fills (2)
  // ==========================================================================
  {
    id: 'royal-amethyst',
    name: 'Royal Amethyst',
    description: 'Deep violet and amethyst against smoky plum with silver accents',
    group: 'hue',
    swatchColors: ['#6A0DAD', '#9B59B6', '#3C1053', '#C0C0C0', '#E8D5F5'],
    promptFragment:
      'COLOR PALETTE: dominated by deep amethyst violet and purple, ' +
      'supported by smoky plum and dark grape, cool silver metallic accents, ' +
      'pale lilac highlights sparingly, regal nocturnal mysticism, no blue no pink',
  },
  {
    id: 'desert-ochre',
    name: 'Desert Ochre',
    description: 'Warm ochre and sandstone against deep umber shadow',
    group: 'hue',
    swatchColors: ['#CC7722', '#C2956B', '#8B5E3C', '#3D2B1F', '#E8D4B8'],
    promptFragment:
      'COLOR PALETTE: dominated by warm ochre and raw sienna, ' +
      'supported by sandstone tan and pale buff, deep umber and burnt umber shadows, ' +
      'sun-baked arid warmth, no green no blue, ancient and earthy',
  },

  // ==========================================================================
  // Value / Saturation Gap Fills (4)
  // ==========================================================================
  {
    id: 'pale-bloom',
    name: 'Pale Bloom',
    description: 'Soft petal pinks, lavender, and cream — entirely high-value',
    group: 'mood',
    swatchColors: ['#F4C2C2', '#E6E6FA', '#FFFDD0', '#B0E0E6', '#FADADD'],
    promptFragment:
      'COLOR PALETTE: dominated by soft petal pink and blush rose, ' +
      'supported by pale lavender and cream, powder blue accents sparingly, ' +
      'entirely high-value pastel tones, no dark shadows, delicate airy softness, ' +
      'like watercolor on wet paper',
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    description: 'Sunset amber-pink glow against deepening blue-violet',
    group: 'mood',
    swatchColors: ['#FF7E47', '#FFB07C', '#FF6B8A', '#4A3F8A', '#2C1B4E'],
    promptFragment:
      'COLOR PALETTE: dominated by warm amber-orange and salmon-pink glow, ' +
      'supported by soft peach and rose, deepening blue-violet and indigo in shadows, ' +
      'warm-to-cool gradient like sunset sky, everything bathed in golden light, ' +
      'no pure white, no harsh contrast',
  },
  {
    id: 'autumn-ember',
    name: 'Autumn Ember',
    description: 'Burnt sienna, wine burgundy, faded olive, and tarnished gold',
    group: 'mood',
    swatchColors: ['#A0522D', '#722F37', '#6B7B3A', '#B8860B', '#3D2B1F'],
    promptFragment:
      'COLOR PALETTE: dominated by burnt sienna and russet brown, ' +
      'supported by wine-dark burgundy and faded olive green, tarnished gold accents, ' +
      'medium-low saturation throughout, decay-beautiful autumn warmth, ' +
      'like fallen leaves and aged wood',
  },
  {
    id: 'parchment-sepia',
    name: 'Parchment & Sepia',
    description: 'Aged manuscript tones — walnut ink on foxed paper',
    group: 'mood',
    swatchColors: ['#704214', '#8B7355', '#F5E6C8', '#D2B48C', '#3B2716'],
    promptFragment:
      'COLOR PALETTE: dominated by sepia brown and walnut ink, ' +
      'supported by aged parchment cream and foxed paper tan, dark espresso accents, ' +
      'warm desaturated throughout, no saturated color, ' +
      'like old photographs or weathered manuscripts',
  },
  {
    id: 'ashen-fog',
    name: 'Ashen Fog',
    description: 'Cool blue-grays and muted lavender in a narrow value band',
    group: 'mood',
    swatchColors: ['#778899', '#B0C4DE', '#C8C8D0', '#696980', '#A9A9C0'],
    promptFragment:
      'COLOR PALETTE: dominated by cool slate gray and blue-gray, ' +
      'supported by muted lavender-gray and silver, steel blue accents, ' +
      'narrow value range — no deep darks no bright whites, ' +
      'everything softened as if seen through heavy fog, quiet and melancholy',
  },

  // ==========================================================================
  // Metallic Triplets (4)
  // ==========================================================================
  {
    id: 'scarlet-cobalt-silver',
    name: 'Scarlet / Cobalt / Silver',
    description: 'Arterial red and deep cobalt clashing over polished silver',
    group: 'metallic-triplet',
    swatchColors: ['#CC0000', '#0047AB', '#C0C0C0', '#E8E8E8', '#1A1A2E'],
    promptFragment:
      'COLOR PALETTE: bold arterial scarlet red and deep cobalt blue in equal clash, ' +
      'polished silver and chrome metallic surfaces binding them together, ' +
      'high contrast between all three, metallic sheen on reflective surfaces, ' +
      'heraldic boldness, no muted tones, every surface either saturated color or gleaming metal',
  },
  {
    id: 'emerald-violet-gold',
    name: 'Emerald / Violet / Gold',
    description: 'Saturated emerald and deep violet over burnished gold',
    group: 'metallic-triplet',
    swatchColors: ['#006B3C', '#6A0DAD', '#FFD700', '#B8860B', '#1A1A1A'],
    promptFragment:
      'COLOR PALETTE: saturated emerald green and deep violet-purple in rich contrast, ' +
      'burnished gold and gilt metallic surfaces as binding element, ' +
      'jewel-toned regalia, metallic gold sheen on ornamentation and borders, ' +
      'opulent and ceremonial, no pastels no muted tones',
  },
  {
    id: 'crimson-teal-bronze',
    name: 'Crimson / Teal / Bronze',
    description: 'Deep crimson and teal clash over aged bronze',
    group: 'metallic-triplet',
    swatchColors: ['#8B0000', '#008080', '#B87333', '#CD7F32', '#1C1C1C'],
    promptFragment:
      'COLOR PALETTE: deep crimson red and rich teal in warm-cool clash, ' +
      'aged bronze and patina copper metallic surfaces as binding element, ' +
      'metallic bronze sheen with green-brown patina, ' +
      'ancient warrior aesthetic, bold contrast with weathered metal warmth',
  },
  {
    id: 'sapphire-amber-steel',
    name: 'Sapphire / Amber / Steel',
    description: 'Deep sapphire blue and warm amber over brushed steel',
    group: 'metallic-triplet',
    swatchColors: ['#0F52BA', '#FFBF00', '#71797E', '#A8A9AD', '#1A1A2E'],
    promptFragment:
      'COLOR PALETTE: deep sapphire blue and warm amber-gold in complementary contrast, ' +
      'brushed steel and gunmetal metallic surfaces as binding element, ' +
      'industrial-regal, metallic steel sheen on armor and architecture, ' +
      'no muted tones, saturated color against cold metal',
  },
];
