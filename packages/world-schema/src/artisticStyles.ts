/**
 * Artistic Style Types and Defaults
 *
 * Defines visual rendering approaches for image generation.
 */

/**
 * Categories for artistic styles, grouping by medium/tradition.
 */
export type ArtisticStyleCategory =
  | 'painting'
  | 'ink-print'
  | 'digital'
  | 'camera'
  | 'experimental'
  | 'document';

/**
 * Artistic style - defines the visual rendering approach
 */
export interface ArtisticStyle {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Prompt fragment for artistic direction (injected into image prompt) */
  promptFragment: string;
  /** Additional keywords for the style */
  keywords?: string[];
  /** Visual medium category for filtering */
  category?: ArtisticStyleCategory;
}

export const DEFAULT_ARTISTIC_STYLES: ArtisticStyle[] = [
  // ===========================
  // PAINTING
  // ===========================
  {
    id: 'oil-painting',
    name: 'Oil Painting',
    description: 'Classical oil painting with rich textures',
    promptFragment: 'oil painting style, rich textures, visible brushstrokes, painterly, classical technique',
    keywords: ['traditional', 'classical', 'painterly'],
    category: 'painting',
  },
  {
    id: 'watercolor',
    name: 'Watercolor',
    description: 'Soft watercolor with fluid washes',
    promptFragment: 'watercolor style, soft edges, fluid washes, delicate, translucent layers',
    keywords: ['soft', 'fluid', 'delicate'],
    category: 'painting',
  },
  {
    id: 'impressionist',
    name: 'Impressionist',
    description: 'Light-focused impressionist style',
    promptFragment: 'impressionist style, visible brushstrokes, light and color emphasis, atmospheric',
    keywords: ['atmospheric', 'light', 'expressive'],
    category: 'painting',
  },
  {
    id: 'baroque-chiaroscuro',
    name: 'Baroque Chiaroscuro',
    description: 'Dramatic contrast in the style of Caravaggio',
    promptFragment: 'baroque chiaroscuro, dramatic tenebrism, deep shadows against illuminated subjects, Caravaggio style, rich oil pigments, theatrical lighting, Renaissance master painting technique',
    keywords: ['baroque', 'dramatic', 'contrast', 'classical'],
    category: 'painting',
  },
  {
    id: 'fantasy-illustration',
    name: 'Fantasy Illustration',
    description: 'Classic fantasy book illustration style',
    promptFragment: 'fantasy book illustration, detailed, dramatic lighting, rich colors, epic scope',
    keywords: ['fantasy', 'dramatic', 'detailed'],
    category: 'painting',
  },

  // ===========================
  // INK & PRINT
  // ===========================
  {
    id: 'sketch',
    name: 'Pencil Sketch',
    description: 'Detailed pencil or charcoal sketch',
    promptFragment: 'pencil sketch, detailed linework, crosshatching, graphite, artistic study',
    keywords: ['linework', 'sketch', 'monochrome'],
    category: 'ink-print',
  },
  {
    id: 'hyperdetailed-charcoal',
    name: 'Hyperdetailed Charcoal with Color',
    description: 'Intricate charcoal drawing with vivid color accents',
    promptFragment: 'hyperdetailed charcoal drawing, intricate textures, deep blacks, dramatic shading, splashes of bright saturated color breaking through the monochrome, selective color highlights, fine art quality',
    keywords: ['charcoal', 'hyperdetailed', 'selective-color', 'dramatic'],
    category: 'ink-print',
  },
  {
    id: 'ukiyo-e',
    name: 'Ukiyo-e Woodblock',
    description: 'Traditional Japanese woodblock print style',
    promptFragment: 'ukiyo-e style, Japanese woodblock print, flat color areas, bold outlines, traditional Edo period aesthetic, waves and nature motifs, organic flowing lines, limited color palette',
    keywords: ['japanese', 'traditional', 'woodblock', 'flat-color'],
    category: 'ink-print',
  },
  {
    id: 'art-nouveau',
    name: 'Art Nouveau',
    description: 'Elegant Art Nouveau decorative style',
    promptFragment: 'art nouveau style, elegant flowing lines, decorative, organic forms, ornamental',
    keywords: ['decorative', 'elegant', 'ornamental'],
    category: 'ink-print',
  },
  {
    id: 'ink-wash',
    name: 'Ink Wash',
    description: 'East Asian sumi-e brushwork with deliberate negative space',
    promptFragment: 'ink wash technique, sumi-e influence, tonal gradients, rice paper texture, deliberate brushwork, negative space, meditative composition',
    keywords: ['ink', 'wash', 'sumi-e', 'tonal'],
    category: 'ink-print',
  },
  {
    id: 'linocut',
    name: 'Linocut Print',
    description: 'Bold relief print with hand-carved gouge marks and stark contrast',
    promptFragment: 'linocut print, bold contrast, hand-carved texture, visible gouge marks, relief printing, stark negative space, expressionist woodcut tradition',
    keywords: ['linocut', 'woodcut', 'relief', 'bold'],
    category: 'ink-print',
  },

  // ===========================
  // DIGITAL
  // ===========================
  {
    id: 'digital-art',
    name: 'Digital Art',
    description: 'Modern digital concept art',
    promptFragment: 'digital concept art, clean lines, vibrant colors, polished, professional illustration',
    keywords: ['modern', 'clean', 'polished'],
    category: 'digital',
  },
  {
    id: 'pixel-art',
    name: 'Pixel Art',
    description: 'Retro pixel art style',
    promptFragment: 'pixel art style, retro, limited palette, 16-bit aesthetic, crisp pixels',
    keywords: ['retro', 'pixel', '16-bit'],
    category: 'digital',
  },
  {
    id: 'cel-shaded',
    name: 'Cel Shaded',
    description: 'Bold flat shading with hard light edges, anime/game influenced',
    promptFragment: 'cel-shaded rendering, hard shadow edges, flat color fills, bold outlines, anime-influenced lighting, clean gradients, stylized 3D aesthetic',
    keywords: ['cel-shaded', 'anime', 'flat-shading', 'stylized'],
    category: 'digital',
  },
  {
    id: 'low-poly',
    name: 'Low Poly',
    description: 'Faceted geometric surfaces with flat-shaded triangles',
    promptFragment: 'low-poly 3D render, faceted geometric surfaces, flat-shaded triangles, crystalline forms, minimal polygon count aesthetic, sharp edges, subtle ambient occlusion',
    keywords: ['low-poly', 'geometric', 'faceted', '3d'],
    category: 'digital',
  },
  {
    id: 'synthwave',
    name: 'Synthwave Neon',
    description: 'Retro-futuristic neon grids, chrome reflections, 1980s futurism',
    promptFragment: 'synthwave aesthetic, neon glow, chrome reflections, retrowave grid horizon, 1980s futurism, scanline artifacts, gradient sky',
    keywords: ['synthwave', 'neon', 'retro-futuristic', 'vaporwave'],
    category: 'digital',
  },

  // ===========================
  // CAMERA
  // ===========================
  {
    id: 'hdr-nature-photography',
    name: '4K HDR Nature Photography',
    description: 'Ultra-realistic nature photography with HDR processing',
    promptFragment: '4K HDR nature photography, ultra high resolution, stunning dynamic range, vivid natural colors, professional wildlife or landscape shot, National Geographic quality, sharp focus, natural lighting',
    keywords: ['photography', 'HDR', 'nature', 'realistic'],
    category: 'camera',
  },
  {
    id: 'cinematic-still',
    name: 'Cinematic Film Still',
    description: 'Dramatic movie scene with cinematic color grading',
    promptFragment: 'cinematic film still, anamorphic lens, dramatic lighting, film grain, professional cinematography, color graded, 35mm film aesthetic, atmospheric depth',
    keywords: ['cinematic', 'film', 'dramatic', 'atmospheric'],
    category: 'camera',
  },
  {
    id: 'daguerreotype',
    name: 'Daguerreotype',
    description: 'Early photographic process with mirror-like silver plate shimmer',
    promptFragment: 'daguerreotype photograph, silver plate shimmer, mirror-like reflections at angles, soft focus, mid-1800s portraiture aesthetic, vignette edges, oxidation patina',
    keywords: ['daguerreotype', 'antique', 'silver', 'early-photography'],
    category: 'camera',
  },
  {
    id: 'tilt-shift',
    name: 'Tilt-Shift Miniature',
    description: 'Selective focus making real scenes look like toy dioramas',
    promptFragment: 'tilt-shift photography, extreme shallow depth of field, miniature diorama effect, overhead or elevated angle, toy-like scale illusion, selective focus band',
    keywords: ['tilt-shift', 'miniature', 'diorama', 'selective-focus'],
    category: 'camera',
  },
  {
    id: 'double-exposure',
    name: 'Double Exposure',
    description: 'Two superimposed images creating dreamlike composite silhouettes',
    promptFragment: 'double exposure photography, two superimposed images, ghostly overlay, silhouette merge, transparent layering, dreamlike composite, film photography technique',
    keywords: ['double-exposure', 'composite', 'dreamlike', 'film'],
    category: 'camera',
  },

  // ===========================
  // EXPERIMENTAL
  // ===========================
  {
    id: 'eldritch-biomechanical',
    name: 'Eldritch Biomechanical',
    description: 'Giger/Beksinski nightmare fusion of organic tissue and impossible machinery',
    promptFragment: 'eldritch biomechanical horror, HR Giger influence, Beksinski dreamscape, organic-mechanical fusion, impossible anatomy, non-Euclidean architecture, visceral texture, alien grandeur, unsettling beauty',
    keywords: ['eldritch', 'biomechanical', 'giger', 'beksinski', 'horror'],
    category: 'experimental',
  },
  {
    id: 'datamosh-glitch',
    name: 'Datamosh Glitch',
    description: 'Corrupted data aesthetic with displaced color channels and pixel bleeding',
    promptFragment: 'datamosh glitch art, corrupted video data, displaced color channels, pixel bleeding, compression artifacts, chromatic aberration, VHS decay, intentional digital malfunction',
    keywords: ['datamosh', 'glitch', 'corrupted', 'chromatic-aberration'],
    category: 'experimental',
  },
  {
    id: 'chromatic-shatter',
    name: 'Chromatic Shatter',
    description: 'Sharp geometric fragments with RGB channel separation between breaks',
    promptFragment: 'chromatic shatter effect, fractured geometric planes, RGB channel separation at break points, prismatic light dispersion, sharp crystalline fragments, dimensional crack aesthetic',
    keywords: ['chromatic', 'shatter', 'prismatic', 'fractured'],
    category: 'experimental',
  },
  {
    id: 'non-euclidean',
    name: 'Non-Euclidean Perspective',
    description: 'Warped spatial geometry where perspective rules break down',
    promptFragment: 'non-Euclidean perspective, warped spatial dimensions, hyperbolic geometry, impossible vanishing points, curved horizon lines, space folding inward, fisheye distortion of reality, gravitational lensing effect, multiple simultaneous viewpoints',
    keywords: ['non-euclidean', 'warped', 'impossible', 'hyperbolic'],
    category: 'experimental',
  },
  {
    id: 'infrared',
    name: 'Infrared Dreamscape',
    description: 'False-color infrared photography with inverted foliage and ethereal glow',
    promptFragment: 'infrared photography, false color rendering, glowing white foliage, surreal landscape, deep contrast sky, ethereal luminescence, invisible spectrum visualization',
    keywords: ['infrared', 'false-color', 'ethereal', 'surreal'],
    category: 'experimental',
  },

  // ===========================
  // DOCUMENT
  // ===========================
  {
    id: 'manuscript-page',
    name: 'Illuminated Manuscript',
    description: 'Medieval illuminated manuscript with gold leaf and intricate borders',
    promptFragment: 'illuminated manuscript page, medieval codex style, gold leaf details, intricate decorative borders, calligraphic text suggestions, vellum texture, ornamental initial letters, monastic scriptorium quality, rich pigments on parchment',
    keywords: ['manuscript', 'medieval', 'illuminated', 'artifact'],
    category: 'document',
  },
  {
    id: 'encyclopedia-plate',
    name: 'Encyclopedia Illustration',
    description: 'Scientific encyclopedia plate with detailed technical rendering',
    promptFragment: 'encyclopedia illustration plate, detailed technical drawing, scientific journal quality, naturalist illustration, cross-section views, precise linework, Victorian-era scientific plate aesthetic, annotation arrows with numbers and symbols only, professional academic publication, no readable English text, not a children\'s book illustration',
    keywords: ['encyclopedia', 'scientific', 'technical', 'detailed'],
    category: 'document',
  },
  {
    id: 'museum-catalog',
    name: 'Museum Catalog',
    description: 'High-quality museum photography with neutral background',
    promptFragment: 'museum artifact photography, neutral gray background, professional studio lighting, archival documentation quality, multiple angle consideration, scale reference implied, pristine preservation, academic catalog standard',
    keywords: ['museum', 'catalog', 'artifact', 'archival'],
    category: 'document',
  },
];
