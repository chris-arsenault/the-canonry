/**
 * Composition Style Types and Defaults
 *
 * Defines framing and visual arrangement for image generation.
 */

import type { EntityCategory } from './entityKind.js';

/**
 * Categories for composition styles.
 * Extends EntityCategory with composition-specific groupings.
 */
export type CompositionCategory = EntityCategory | 'pair' | 'pose' | 'landscape';

/**
 * Composition style - defines framing and visual arrangement
 */
export interface CompositionStyle {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Prompt fragment for composition (injected into image prompt) */
  promptFragment: string;
  /**
   * Target category this composition is best suited for.
   * Used to filter/suggest compositions based on context.
   * If undefined, composition is considered universal.
   */
  targetCategory?: CompositionCategory;
}

export const DEFAULT_COMPOSITION_STYLES: CompositionStyle[] = [
  // ===========================
  // CHARACTER compositions
  // ===========================
  {
    id: 'portrait',
    name: 'Portrait',
    description: 'Head and shoulders portrait',
    promptFragment: 'portrait composition, head and shoulders, focused on face, eye contact',
    targetCategory: 'character',
  },
  {
    id: 'full-body',
    name: 'Full Body',
    description: 'Full figure standing pose',
    promptFragment: 'full body view, character standing, showing attire and posture, clear silhouette',
    targetCategory: 'character',
  },
  {
    id: 'bust',
    name: 'Bust',
    description: 'Upper body portrait with more context',
    promptFragment: 'bust composition, upper body visible, showing costume details, medium shot',
    targetCategory: 'character',
  },
  {
    id: 'action',
    name: 'Action Scene',
    description: 'Dynamic action moment',
    promptFragment: 'dynamic action pose, motion blur, dramatic angle, tension, movement',
    targetCategory: 'character',
  },
  {
    id: 'action-duel',
    name: 'Action: Duel',
    description: 'Focused one-on-one combat or standoff',
    promptFragment: 'dynamic duel, close-quarters combat, two figures in motion, dramatic tension, focused framing',
    targetCategory: 'character',
  },
  {
    id: 'action-chase',
    name: 'Action: Chase',
    description: 'High-speed pursuit with strong motion',
    promptFragment: 'high-speed chase, motion blur, strong leading lines, sense of pursuit, dynamic perspective',
    targetCategory: 'character',
  },

  // ===========================
  // PAIR compositions
  // ===========================
  {
    id: 'pair-mentor-student',
    name: 'Pair: Mentor & Student',
    description: 'Teaching moment between master and apprentice',
    promptFragment:
      'two figures in teaching dynamic, mentor demonstrating or guiding, student observing or mimicking, height or posture difference suggesting experience gap, supportive body language, focused attention, knowledge transfer moment',
    targetCategory: 'pair',
  },
  {
    id: 'pair-back-to-back',
    name: 'Pair: Back to Back',
    description: 'Allied stance with mutual trust or shared threat',
    promptFragment:
      'two figures standing back to back, defensive alliance, outward-facing vigilance, shoulders touching, weapons or hands ready, surrounded implication, unified silhouette',
    targetCategory: 'pair',
  },
  {
    id: 'pair-side-by-side',
    name: 'Pair: Side by Side',
    description: 'Aligned stance with unified direction',
    promptFragment:
      'two figures standing side by side, aligned stance, shared direction, cooperative energy, parallel posture, supportive proximity, balanced framing, unified presence',
    targetCategory: 'pair',
  },
  {
    id: 'pair-negotiation',
    name: 'Pair: Negotiation',
    description: 'Formal exchange or deal-making between two parties',
    promptFragment:
      'two figures across from each other, negotiation stance, table or barrier between them, guarded postures, strategic eye contact, formal composition, balanced framing',
    targetCategory: 'pair',
  },
  {
    id: 'pair-embrace',
    name: 'Pair: Embrace',
    description: 'Intimate moment of connection between two figures',
    promptFragment:
      'two figures embracing, arms wrapped around each other, emotional closeness, soft lighting, heads together or on shoulder, tender body language, intimate framing',
    targetCategory: 'pair',
  },
  {
    id: 'pair-heated-discussion',
    name: 'Pair: Heated Discussion',
    description: 'Tense verbal confrontation between two figures',
    promptFragment:
      'two figures facing each other, heated argument, aggressive body language, leaning forward, pointing gestures, tight framing, tension in negative space, eye contact',
    targetCategory: 'pair',
  },

  // ===========================
  // POSE compositions
  // ===========================
  {
    id: 'pose-superhero',
    name: 'Pose: Superhero',
    description: 'Heroic power stance with confident posture',
    promptFragment: 'full body view, heroic power stance, hands on hips, chest forward, confident posture, cape or cloak flowing, low angle perspective, dramatic silhouette',
    targetCategory: 'pose',
  },
  {
    id: 'pose-rooftop-leap',
    name: 'Pose: Rooftop Leap',
    description: 'Dynamic mid-jump from building edge',
    promptFragment: 'full body view, leaping from rooftop edge, mid-air dynamic pose, city below, wind-swept clothing, outstretched limbs, dramatic height perspective',
    targetCategory: 'pose',
  },
  {
    id: 'pose-seated',
    name: 'Pose: Seated',
    description: 'Character sitting in relaxed or contemplative pose',
    promptFragment: 'full body view, seated pose, relaxed posture, legs crossed or resting, hands visible, thoughtful expression, environmental seating context',
    targetCategory: 'pose',
  },
  {
    id: 'pose-reclining',
    name: 'Pose: Reclining',
    description: 'Laying down in restful or dramatic pose',
    promptFragment: 'full body view, reclining pose, laying down, horizontal composition, relaxed limbs, soft or dramatic lighting, surface context visible',
    targetCategory: 'pose',
  },
  {
    id: 'pose-crouching',
    name: 'Pose: Crouching',
    description: 'Low crouch ready to spring or hide',
    promptFragment: 'full body view, crouching low, coiled tension, ready to spring, one hand touching ground, predatory or stealthy stance, compact silhouette',
    targetCategory: 'pose',
  },
  {
    id: 'pose-kneeling',
    name: 'Pose: Kneeling',
    description: 'On one or both knees in reverence or defeat',
    promptFragment: 'full body view, kneeling pose, one or both knees on ground, head bowed or lifted, arms at sides or raised, ceremonial or defeated posture',
    targetCategory: 'pose',
  },
  {
    id: 'pose-walking',
    name: 'Pose: Walking',
    description: 'Mid-stride walking with purpose',
    promptFragment: 'full body view, walking pose, mid-stride, purposeful movement, natural arm swing, forward momentum, confident gait',
    targetCategory: 'pose',
  },
  {
    id: 'pose-back-turned',
    name: 'Pose: Back Turned',
    description: 'Mysterious view from behind',
    promptFragment: 'full body view, back turned to viewer, looking away or over shoulder, mysterious silhouette, costume details visible from behind, atmospheric backdrop',
    targetCategory: 'pose',
  },

  // ===========================
  // COLLECTIVE compositions
  // ===========================
  {
    id: 'logo-mark',
    name: 'Logo Mark',
    description: 'Iconic emblem or brand mark for factions and organizations',
    promptFragment: 'logo design, iconic emblem, clean geometric shapes, centered composition, flat colors, negative space, scalable vector style, brand identity, minimal',
    targetCategory: 'collective',
  },
  {
    id: 'badge-crest',
    name: 'Badge Crest',
    description: 'Heraldic crest or insignia in a badge form',
    promptFragment: 'heraldic emblem, crest design, symmetrical composition, iconic symbol, shield or banner form, unified color palette, insignia',
    targetCategory: 'collective',
  },
  {
    id: 'group-scene',
    name: 'Group Scene',
    description: 'Multiple figures in composition',
    promptFragment: 'group composition, multiple figures, unified aesthetic, collective identity',
    targetCategory: 'collective',
  },
  {
    id: 'action-battle',
    name: 'Action: Battle',
    description: 'Large-scale clash with multiple combatants',
    promptFragment: 'chaotic battle scene, multiple figures, sweeping movement, dust and debris, wide dynamic composition',
    targetCategory: 'collective',
  },
  {
    id: 'formation',
    name: 'Formation',
    description: 'Military or ritual formation from dramatic angle',
    promptFragment:
      'organized formation, ranked arrangement, disciplined rows, dramatic overhead or oblique angle, unified movement, regimented spacing, collective discipline',
    targetCategory: 'collective',
  },
  {
    id: 'council-chamber',
    name: 'Council Chamber',
    description: 'Deliberating figures seated around a table or circle',
    promptFragment:
      'council deliberation, figures seated around table or circle, varied postures of agreement and dissent, central focal point, formal chamber setting, political tension, candlelit or torch-lit atmosphere',
    targetCategory: 'collective',
  },

  // ===========================
  // PLACE compositions
  // ===========================
  {
    id: 'establishing-shot',
    name: 'Establishing Shot',
    description: 'Wide environmental shot',
    promptFragment: 'wide establishing shot, environmental storytelling, sense of scale, cinematic',
    targetCategory: 'place',
  },
  {
    id: 'interior',
    name: 'Interior View',
    description: 'Interior space with atmosphere',
    promptFragment: 'interior view, atmospheric lighting, detailed environment, lived-in feeling',
    targetCategory: 'place',
  },
  {
    id: 'aerial',
    name: 'Aerial View',
    description: "Bird's eye view from above",
    promptFragment: "aerial view, bird's eye perspective, showing layout and scope",
    targetCategory: 'place',
  },
  {
    id: 'cityscape',
    name: 'Cityscape',
    description: 'Urban skyline with architectural silhouettes',
    promptFragment: 'cityscape view, urban skyline, layered architecture, rooftops and spires, atmospheric depth, twilight or dawn lighting, sense of settlement scale',
    targetCategory: 'place',
  },
  {
    id: 'map-view',
    name: 'Map View',
    description: 'Stylized cartographic perspective',
    promptFragment: 'illustrated map view, cartographic style, labeled landmarks, hand-drawn aesthetic, parchment or vellum texture, compass rose, decorative borders',
    targetCategory: 'place',
  },
  {
    id: 'bustling-streets',
    name: 'Bustling Streets',
    description: 'Street-level view with crowd activity',
    promptFragment: 'street level perspective, crowded thoroughfare, market activity, figures in motion, vendor stalls, hanging signs, lived-in atmosphere, dynamic street life',
    targetCategory: 'place',
  },
  {
    id: 'landmark-focus',
    name: 'Landmark Focus',
    description: 'Architectural focal point with dramatic framing',
    promptFragment: 'architectural focal point, monumental structure, low angle dramatic perspective, sky backdrop, sense of grandeur, iconic silhouette, pilgrimage destination',
    targetCategory: 'place',
  },
  {
    id: 'district-view',
    name: 'District View',
    description: 'Neighborhood or quarter perspective showing character',
    promptFragment: 'district overview, neighborhood character, mixed building heights, winding streets, local atmosphere, community feeling, distinct architectural style',
    targetCategory: 'place',
  },

  // ===========================
  // LANDSCAPE compositions
  // ===========================
  {
    id: 'panoramic-vista',
    name: 'Panoramic Vista',
    description: 'Wide horizontal sweep from an elevated vantage point',
    promptFragment: 'panoramic landscape vista, wide horizontal composition, elevated vantage point, sweeping valley or ridgeline, full horizon visible, layered depth from foreground to distant mountains, sense of vastness and open space',
    targetCategory: 'landscape',
  },
  {
    id: 'river-path',
    name: 'River Path',
    description: 'Natural watercourse or path drawing the eye into depth',
    promptFragment: 'landscape with winding river or natural path as compositional guide, leading line drawing eye deep into frame, watercourse cutting through terrain, atmospheric perspective, mist or haze adding depth layers',
    targetCategory: 'landscape',
  },
  {
    id: 'weather-front',
    name: 'Weather Front',
    description: 'Landscape dominated by atmospheric drama',
    promptFragment: 'dramatic atmospheric landscape, massive weather system dominating sky, storm front or fog bank or aurora, volumetric light shafts piercing cloud layers, the sky as primary subject, land as grounding element beneath overwhelming atmosphere',
    targetCategory: 'landscape',
  },
  {
    id: 'monolith',
    name: 'Monolith',
    description: 'Single overwhelming natural formation that dominates the frame',
    promptFragment: 'monumental natural formation filling the frame, sheer geological scale, shot from a position that makes the viewer feel insignificant, Half Dome or Uluru or volcanic caldera grandeur, the formation barely contained by the image edges',
    targetCategory: 'landscape',
  },
  {
    id: 'cascade',
    name: 'Cascade',
    description: 'Water in dramatic freefall at overwhelming scale',
    promptFragment: 'massive waterfall or cascade system, water in freefall at staggering scale, mist rising and catching light, spray refracting into rainbows, terraced mineral shelves or sheer cliff face, the implied roar of falling water, National Geographic cover quality',
    targetCategory: 'landscape',
  },
  {
    id: 'impossible-spire',
    name: 'Impossible Spire',
    description: 'Fantasy-scale vertical landscape defying geological sense',
    promptFragment: 'impossible vertical landscape at fantasy scale, towering rock pillars or crystalline spires rising from cloud seas, floating geological formations, vertical composition emphasizing absurd height, Final Fantasy vista grandeur, beauty beyond natural geology',
    targetCategory: 'landscape',
  },
  {
    id: 'primordial-glow',
    name: 'Primordial Glow',
    description: 'Landscape lit by its own geology',
    promptFragment: 'landscape illuminated by geological light sources, bioluminescent caverns or volcanic lava rivers meeting ocean, geothermal pools in unearthly mineral colors, magma glow through translucent rock, the land itself as light source, primordial and ancient feeling',
    targetCategory: 'landscape',
  },

  {
    id: 'sacred-earth',
    name: 'Sacred Earth',
    description: 'Reverential natural landscape as visual tone poem',
    promptFragment: 'reverential landscape, visual tone poem, luminous ethereal natural environment, 70mm clarity and depth, sacred contemplative framing, the land as eternal presence, shadows flowing across undulating curves, rapturous stillness, no human context, the permanence of nature communing with the viewer, a world beyond words',
    targetCategory: 'landscape',
  },

  // ===========================
  // OBJECT compositions
  // ===========================
  {
    id: 'object-study',
    name: 'Object Study',
    description: 'Focused object with dramatic lighting',
    promptFragment: 'object study, dramatic lighting, showing scale and detail, museum quality',
    targetCategory: 'object',
  },
  {
    id: 'display-case',
    name: 'Display Case',
    description: 'Artifact presented in museum display case',
    promptFragment: 'museum display case presentation, glass enclosure, carefully lit from multiple angles, velvet or neutral pedestal, subtle reflections, archival preservation context, reverent display',
    targetCategory: 'object',
  },
  {
    id: 'artifact-diagram',
    name: 'Artifact Diagram',
    description: 'Technical diagram with annotations and cross-sections',
    promptFragment: 'technical artifact diagram, exploded view, cross-section annotations, measurement indicators, multiple angle views, scientific illustration style, detailed construction breakdown',
    targetCategory: 'object',
  },
  {
    id: 'relic-altar',
    name: 'Relic Altar',
    description: 'Sacred presentation on ceremonial altar or shrine',
    promptFragment: 'sacred altar presentation, ceremonial shrine setting, devotional lighting, candles or incense suggested, religious reverence, offering context, mystical atmosphere',
    targetCategory: 'object',
  },
  {
    id: 'treasure-hoard',
    name: 'Treasure Hoard',
    description: 'Artifact among treasures, showing context and wealth',
    promptFragment: 'treasure hoard context, surrounded by coins and jewels, discovery moment, dramatic cave or vault lighting, archaeological find, sense of abundance and value',
    targetCategory: 'object',
  },
  {
    id: 'field-study',
    name: 'Field Study',
    description: 'Naturalist observation of object in its environment',
    promptFragment:
      'naturalist field observation, object in situ, environmental context, discovery moment, field notes framing, specimen in natural habitat, documentary perspective',
    targetCategory: 'object',
  },
  {
    id: 'scientific-drawing',
    name: 'Scientific Drawing',
    description: 'Technical illustration with symbols, charts, and measurement notation',
    promptFragment:
      'technical scientific illustration for peer-reviewed journal, precise cross-section diagrams, measurement notation with numbers and units, abstract symbols and glyphs instead of words, data charts and graphs, specimen plate arrangement, fine ruled lines and annotation arrows, systematic grid layout, professional academic quality, no readable English text, only mathematical symbols and formulae, not a children\'s book illustration',
    targetCategory: 'object',
  },
  {
    id: 'schematic',
    name: 'Schematic',
    description: 'Engineering blueprint with precise measurements and assembly views',
    promptFragment:
      'engineering schematic, blueprint layout on drafting paper, precise dimension lines with numeric measurements, exploded assembly views, orthographic projections, cutaway cross-sections, abstract engineering symbols, professional technical drawing quality, no readable English text, only numbers and technical notation, not a cartoon or children\'s illustration',
    targetCategory: 'object',
  },

  // ===========================
  // CONCEPT compositions
  // ===========================
  {
    id: 'symbolic',
    name: 'Symbolic',
    description: 'Allegorical or symbolic representation',
    promptFragment: 'symbolic representation, iconographic, allegorical, conceptual',
    targetCategory: 'concept',
  },
  {
    id: 'concept-duality',
    name: 'Duality',
    description: 'Split composition showing opposing forces or dual nature',
    promptFragment:
      'split composition, left-right duality, contrasting elements, mirrored opposition, yin-yang balance, visual tension between halves',
    targetCategory: 'concept',
  },
  {
    id: 'concept-cycle',
    name: 'Cycle',
    description: 'Circular arrangement suggesting recurring patterns or seasons',
    promptFragment:
      'circular composition, cyclical arrangement, ouroboros framing, seasonal or temporal progression, elements arranged in wheel or spiral, eternal recurrence',
    targetCategory: 'concept',
  },
  {
    id: 'concept-hierarchy',
    name: 'Hierarchy',
    description: 'Tiered vertical arrangement showing power or importance',
    promptFragment:
      'vertical hierarchy composition, tiered layers, pyramid arrangement, scale indicating importance, bottom-to-top progression, stratified visual structure',
    targetCategory: 'concept',
  },
  {
    id: 'concept-web',
    name: 'Web of Connections',
    description: 'Network visualization with threads linking disparate elements',
    promptFragment:
      'web-like composition, interconnected nodes, thread lines linking elements, network structure, constellation arrangement, visible relationships between scattered focal points',
    targetCategory: 'concept',
  },

  // ===========================
  // EVENT compositions
  // ===========================
  {
    id: 'chronicle-panorama',
    name: 'Chronicle Panorama',
    description: 'Panoramic scene for chronicle headings',
    promptFragment: 'panoramic scene, sweeping vista, layered depth, cinematic horizon, spacious composition, chapter heading framing',
    targetCategory: 'event',
  },
  {
    id: 'chronicle-overview',
    name: 'Chronicle Overview',
    description: 'Montage-style overview for chronicle cover images, overlapping elements like a movie poster',
    promptFragment: 'cinematic montage composition, overlapping character silhouettes and scene elements, layered movie-poster layout, multiple focal points at different scales, dramatic depth layering, figures and settings blending into each other, NO TEXT NO TITLES NO LETTERING',
    targetCategory: 'event',
  },
  {
    id: 'chronicle-intimate',
    name: 'Chronicle Intimate',
    description: 'Single evocative scene for intimate or character-focused chronicles',
    promptFragment: 'intimate scene composition, single focal point, environmental storytelling, atmospheric depth, soft focus background, cinematic still frame, NO TEXT NO TITLES NO LETTERING',
    targetCategory: 'event',
  },
  {
    id: 'chronicle-symbolic',
    name: 'Chronicle Symbolic',
    description: 'Abstract mood-driven composition for dreamlike or poetic chronicles',
    promptFragment: 'abstract painterly composition, symbolic elements, fluid forms, dreamlike perspective, mood over narrative, ethereal atmosphere, NO TEXT NO TITLES NO LETTERING',
    targetCategory: 'event',
  },
  {
    id: 'chronicle-document',
    name: 'Chronicle Document',
    description: 'Physical document artifact for broadsheets, letters, notices, and reports',
    promptFragment: 'aged document artifact, parchment or paper with visible text blocks, wax seals or stamps, creased folds, ink blots, physical object photography, NO TEXT NO TITLES NO LETTERING',
    targetCategory: 'event',
  },
  {
    id: 'chronicle-tableau',
    name: 'Chronicle Tableau',
    description: 'Formal symmetrical arrangement for trials, accords, and ceremonies',
    promptFragment: 'formal symmetrical composition, hierarchical figure arrangement, ceremonial staging, solemn atmosphere, balanced framing, NO TEXT NO TITLES NO LETTERING',
    targetCategory: 'event',
  },
  {
    id: 'chronicle-folk',
    name: 'Chronicle Folk Art',
    description: 'Folk-art illustration for fables, folk songs, and nursery rhymes',
    promptFragment: 'folk-art illustration, iconic figures, decorative borders, flat perspective with rich pattern detail, woodcut or linocut aesthetic, NO TEXT NO TITLES NO LETTERING',
    targetCategory: 'event',
  },
  {
    id: 'chronicle-vignette',
    name: 'Chronicle Vignette',
    description: 'Multiple framed moments for comedies, catalogues, and notice boards',
    promptFragment: 'multiple framed vignettes, panel layout, small contained scenes, grid or mosaic arrangement, varied focal points, NO TEXT NO TITLES NO LETTERING',
    targetCategory: 'event',
  },
];
