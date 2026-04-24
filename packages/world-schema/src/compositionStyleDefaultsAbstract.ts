/**
 * Default Composition Style Presets (Part 2: Landscape & Abstract)
 *
 * Categories: Landscape, Object, Concept, Event.
 * Types are defined in compositionStyles.ts.
 */

import type { CompositionStyle } from './compositionStyles.js';

export const LANDSCAPE_COMPOSITIONS: CompositionStyle[] = [
  {
    id: 'panoramic-vista',
    name: 'Panoramic Vista',
    description: 'Wide horizontal sweep from an elevated vantage point',
    promptFragment: 'panoramic landscape vista, wide horizontal composition, elevated vantage point, sweeping valley or ridgeline, full horizon visible, layered depth from foreground to distant mountains, sense of vastness and open space',
    targetCategory: 'landscape',
    defaultImageAspect: 'landscape',
  },
  {
    id: 'river-path',
    name: 'River Path',
    description: 'Natural watercourse or path drawing the eye into depth',
    promptFragment: 'landscape with winding river or natural path as compositional guide, leading line drawing eye deep into frame, watercourse cutting through terrain, atmospheric perspective, mist or haze adding depth layers',
    targetCategory: 'landscape',
    defaultImageAspect: 'landscape',
  },
  {
    id: 'weather-front',
    name: 'Weather Front',
    description: 'Landscape dominated by atmospheric drama',
    promptFragment: 'dramatic atmospheric landscape, massive weather system dominating sky, storm front or fog bank or aurora, volumetric light shafts piercing cloud layers, the sky as primary subject, land as grounding element beneath overwhelming atmosphere',
    targetCategory: 'landscape',
    defaultImageAspect: 'landscape',
  },
  {
    id: 'monolith',
    name: 'Monolith',
    description: 'Single overwhelming natural formation that dominates the frame',
    promptFragment: 'monumental natural formation filling the frame, sheer geological scale, shot from a position that makes the viewer feel insignificant, Half Dome or Uluru or volcanic caldera grandeur, the formation barely contained by the image edges',
    targetCategory: 'landscape',
    defaultImageAspect: 'portrait',
  },
  {
    id: 'cascade',
    name: 'Cascade',
    description: 'Water in dramatic freefall at overwhelming scale',
    promptFragment: 'massive waterfall or cascade system, water in freefall at staggering scale, mist rising and catching light, spray refracting into rainbows, terraced mineral shelves or sheer cliff face, the implied roar of falling water, National Geographic cover quality',
    targetCategory: 'landscape',
    defaultImageAspect: 'portrait',
  },
  {
    id: 'impossible-spire',
    name: 'Impossible Spire',
    description: 'Fantasy-scale vertical landscape defying geological sense',
    promptFragment: 'impossible vertical landscape at fantasy scale, towering rock pillars or crystalline spires rising from cloud seas, floating geological formations, vertical composition emphasizing absurd height, Final Fantasy vista grandeur, beauty beyond natural geology',
    targetCategory: 'landscape',
    defaultImageAspect: 'portrait',
  },
  {
    id: 'primordial-glow',
    name: 'Primordial Glow',
    description: 'Landscape lit by its own geology',
    promptFragment: 'landscape illuminated by geological light sources, bioluminescent caverns or volcanic lava rivers meeting ocean, geothermal pools in unearthly mineral colors, magma glow through translucent rock, the land itself as light source, primordial and ancient feeling',
    targetCategory: 'landscape',
    defaultImageAspect: 'landscape',
  },
  {
    id: 'sacred-earth',
    name: 'Sacred Earth',
    description: 'Reverential natural landscape as visual tone poem',
    promptFragment: 'reverential landscape, visual tone poem, luminous ethereal natural environment, 70mm clarity and depth, sacred contemplative framing, the land as eternal presence, shadows flowing across undulating curves, rapturous stillness, no human context, the permanence of nature communing with the viewer, a world beyond words',
    targetCategory: 'landscape',
    defaultImageAspect: 'landscape',
  },
];

export const OBJECT_COMPOSITIONS: CompositionStyle[] = [
  {
    id: 'object-study',
    name: 'Object Study',
    description: 'Focused object with dramatic lighting',
    promptFragment: 'object study, dramatic lighting, showing scale and detail, museum quality',
    targetCategory: 'object',
    defaultImageAspect: 'portrait',
  },
  {
    id: 'display-case',
    name: 'Display Case',
    description: 'Artifact presented in museum display case',
    promptFragment: 'museum display case presentation, glass enclosure, carefully lit from multiple angles, velvet or neutral pedestal, subtle reflections, archival preservation context, reverent display',
    targetCategory: 'object',
    defaultImageAspect: 'portrait',
  },
  {
    id: 'artifact-diagram',
    name: 'Artifact Diagram',
    description: 'Technical diagram with annotations and cross-sections',
    promptFragment: 'technical artifact diagram, exploded view, cross-section annotations, measurement indicators, multiple angle views, scientific illustration style, detailed construction breakdown',
    targetCategory: 'object',
    defaultImageAspect: 'landscape',
  },
  {
    id: 'relic-altar',
    name: 'Relic Altar',
    description: 'Sacred presentation on ceremonial altar or shrine',
    promptFragment: 'sacred altar presentation, ceremonial shrine setting, devotional lighting, candles or incense suggested, religious reverence, offering context, mystical atmosphere',
    targetCategory: 'object',
    defaultImageAspect: 'portrait',
  },
  {
    id: 'treasure-hoard',
    name: 'Treasure Hoard',
    description: 'Artifact among treasures, showing context and wealth',
    promptFragment: 'treasure hoard context, surrounded by coins and jewels, discovery moment, dramatic cave or vault lighting, archaeological find, sense of abundance and value',
    targetCategory: 'object',
    defaultImageAspect: 'landscape',
  },
  {
    id: 'field-study',
    name: 'Field Study',
    description: 'Naturalist observation of object in its environment',
    promptFragment:
      'naturalist field observation, object in situ, environmental context, discovery moment, field notes framing, specimen in natural habitat, documentary perspective',
    targetCategory: 'object',
    defaultImageAspect: 'landscape',
  },
  {
    id: 'scientific-drawing',
    name: 'Scientific Drawing',
    description: 'Technical illustration with symbols, charts, and measurement notation',
    promptFragment:
      'technical scientific illustration for peer-reviewed journal, precise cross-section diagrams, measurement notation with numbers and units, abstract symbols and glyphs instead of words, data charts and graphs, specimen plate arrangement, fine ruled lines and annotation arrows, systematic grid layout, professional academic quality, no readable English text, only mathematical symbols and formulae, not a children\'s book illustration',
    targetCategory: 'object',
    defaultImageAspect: 'portrait',
  },
  {
    id: 'schematic',
    name: 'Schematic',
    description: 'Engineering blueprint with precise measurements and assembly views',
    promptFragment:
      'engineering schematic, blueprint layout on drafting paper, precise dimension lines with numeric measurements, exploded assembly views, orthographic projections, cutaway cross-sections, abstract engineering symbols, professional technical drawing quality, no readable English text, only numbers and technical notation, not a cartoon or children\'s illustration',
    targetCategory: 'object',
    defaultImageAspect: 'landscape',
  },
];

export const CONCEPT_COMPOSITIONS: CompositionStyle[] = [
  {
    id: 'symbolic',
    name: 'Symbolic',
    description: 'Allegorical or symbolic representation',
    promptFragment: 'symbolic representation, iconographic, allegorical, conceptual',
    targetCategory: 'concept',
    defaultImageAspect: 'portrait',
  },
  {
    id: 'concept-duality',
    name: 'Duality',
    description: 'Split composition showing opposing forces or dual nature',
    promptFragment:
      'split composition, left-right duality, contrasting elements, mirrored opposition, yin-yang balance, visual tension between halves',
    targetCategory: 'concept',
    defaultImageAspect: 'landscape',
  },
  {
    id: 'concept-cycle',
    name: 'Cycle',
    description: 'Circular arrangement suggesting recurring patterns or seasons',
    promptFragment:
      'circular composition, cyclical arrangement, ouroboros framing, seasonal or temporal progression, elements arranged in wheel or spiral, eternal recurrence',
    targetCategory: 'concept',
    defaultImageAspect: 'square',
  },
  {
    id: 'concept-hierarchy',
    name: 'Hierarchy',
    description: 'Tiered vertical arrangement showing power or importance',
    promptFragment:
      'vertical hierarchy composition, tiered layers, pyramid arrangement, scale indicating importance, bottom-to-top progression, stratified visual structure',
    targetCategory: 'concept',
    defaultImageAspect: 'portrait',
  },
  {
    id: 'concept-web',
    name: 'Web of Connections',
    description: 'Network visualization with threads linking disparate elements',
    promptFragment:
      'web-like composition, interconnected nodes, thread lines linking elements, network structure, constellation arrangement, visible relationships between scattered focal points',
    targetCategory: 'concept',
    defaultImageAspect: 'landscape',
  },
  {
    id: 'divine-monument',
    name: 'Divine Monument',
    description: 'Monumental bilaterally-symmetric figure filling the frame with sacred geometry behind and receding ground plane',
    promptFragment:
      'monumental composition, strong bilateral symmetry, figure fills or exceeds the frame implying cosmic scale, ' +
      'radiating circular or mandala geometry behind the subject, ' +
      'low or centered camera angle conveying reverence, ' +
      'receding ground plane below providing depth, infinite void or starfield above, ' +
      'vertical orientation with clear hierarchy: void, sacred geometry, figure, ground',
    targetCategory: 'concept',
    defaultImageAspect: 'portrait',
  },
];

export const EVENT_COMPOSITIONS: CompositionStyle[] = [
  {
    id: 'chronicle-panorama',
    name: 'Chronicle Panorama',
    description: 'Panoramic scene for chronicle headings',
    promptFragment: 'panoramic scene, sweeping vista, layered depth, cinematic horizon, spacious composition, chapter heading framing',
    targetCategory: 'event',
    defaultImageAspect: 'landscape',
  },
  {
    id: 'chronicle-overview',
    name: 'Chronicle Overview',
    description: 'Montage-style overview for chronicle cover images, overlapping elements like a movie poster',
    promptFragment: 'cinematic montage composition, overlapping character silhouettes and scene elements, layered movie-poster layout, multiple focal points at different scales, dramatic depth layering, figures and settings blending into each other, NO TEXT NO TITLES NO LETTERING',
    targetCategory: 'event',
    defaultImageAspect: 'landscape',
  },
  {
    id: 'chronicle-intimate',
    name: 'Chronicle Intimate',
    description: 'Single evocative scene for intimate or character-focused chronicles',
    promptFragment: 'intimate scene composition, single focal point, environmental storytelling, atmospheric depth, soft focus background, cinematic still frame, NO TEXT NO TITLES NO LETTERING',
    targetCategory: 'event',
    defaultImageAspect: 'landscape',
  },
  {
    id: 'chronicle-symbolic',
    name: 'Chronicle Symbolic',
    description: 'Abstract mood-driven composition for dreamlike or poetic chronicles',
    promptFragment: 'abstract painterly composition, symbolic elements, fluid forms, dreamlike perspective, mood over narrative, ethereal atmosphere, NO TEXT NO TITLES NO LETTERING',
    targetCategory: 'event',
    defaultImageAspect: 'landscape',
  },
  {
    id: 'chronicle-document',
    name: 'Chronicle Document',
    description: 'Physical document artifact for broadsheets, letters, notices, and reports',
    promptFragment: 'aged document artifact, parchment or paper with visible text blocks, wax seals or stamps, creased folds, ink blots, physical object photography, NO TEXT NO TITLES NO LETTERING',
    targetCategory: 'event',
    defaultImageAspect: 'landscape',
  },
  {
    id: 'chronicle-tableau',
    name: 'Chronicle Tableau',
    description: 'Formal symmetrical arrangement for trials, accords, and ceremonies',
    promptFragment: 'formal symmetrical composition, hierarchical figure arrangement, ceremonial staging, solemn atmosphere, balanced framing, NO TEXT NO TITLES NO LETTERING',
    targetCategory: 'event',
    defaultImageAspect: 'landscape',
  },
  {
    id: 'chronicle-folk',
    name: 'Chronicle Folk Art',
    description: 'Folk-art illustration for fables, folk songs, and nursery rhymes',
    promptFragment: 'folk-art illustration, iconic figures, decorative borders, flat perspective with rich pattern detail, woodcut or linocut aesthetic, NO TEXT NO TITLES NO LETTERING',
    targetCategory: 'event',
    defaultImageAspect: 'landscape',
  },
  {
    id: 'chronicle-vignette',
    name: 'Chronicle Vignette',
    description: 'Multiple framed moments for comedies, catalogues, and notice boards',
    promptFragment: 'multiple framed vignettes, panel layout, small contained scenes, grid or mosaic arrangement, varied focal points, NO TEXT NO TITLES NO LETTERING',
    targetCategory: 'event',
    defaultImageAspect: 'landscape',
  },
];
