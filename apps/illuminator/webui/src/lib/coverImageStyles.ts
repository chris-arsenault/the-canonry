/**
 * Cover Image Style Configuration
 *
 * Maps narrative styles to scene prompt templates and composition styles
 * for cover image generation. Scene prompt templates tell the scene-description
 * LLM what kind of visual to describe. Composition style IDs reference entries
 * in the composition style library (compositionStyles.ts).
 */

// ============================================================================
// Scene Prompt Templates
// ============================================================================

export interface ScenePromptTemplate {
  id: string;
  name: string;
  /** Framing paragraph injected BEFORE the chronicle content */
  framing: string;
  /** Instructions injected AFTER the chronicle content */
  instructions: string;
}

export const SCENE_PROMPT_TEMPLATES: ScenePromptTemplate[] = [
  {
    id: 'montage',
    name: 'Cinematic Montage',
    framing: `Generate a visual scene description for a cinematic montage-style cover image for this chronicle. The cover image should work like a movie poster (but with NO TEXT): overlapping visual elements showing key figures and settings from the chronicle, with dramatic layering and depth.`,
    instructions: `Write a vivid visual description of a montage composition that captures the essence of this chronicle. Describe:
- Which key figures should be prominent and at what scale (foreground, midground, background)
- What settings, objects, or atmospheric elements should appear
- The overall mood and lighting
- How elements overlap and layer (movie-poster style, NOT a single coherent scene)`,
  },
  {
    id: 'intimate-scene',
    name: 'Intimate Scene',
    framing: `Generate a visual scene description for a single evocative cover image for this chronicle. The cover image should capture ONE key moment — a still frame from the story, not a montage. Focus on atmosphere and emotional resonance over spectacle.`,
    instructions: `Write a vivid visual description of one scene that captures the emotional heart of this chronicle. Describe:
- The single moment that best represents the chronicle's core
- The setting in sensory detail
- Character positioning and body language
- Environmental mood — lighting, weather, time of day
- One or two small telling details that reward close looking`,
  },
  {
    id: 'symbolic-abstract',
    name: 'Symbolic / Abstract',
    framing: `Generate a visual scene description for an abstract, mood-driven cover image for this chronicle. The image should evoke the chronicle's emotional and thematic essence through symbolic visual elements rather than literal scenes.`,
    instructions: `Write a vivid visual description of an abstract composition that captures the thematic essence of this chronicle. Describe:
- Central symbolic elements or motifs drawn from the chronicle's themes
- Color palette and material quality that express the mood
- How visual elements relate spatially — the abstract composition
- What the viewer should feel before they understand what they're looking at
- Any recurring images or metaphors from the text rendered visually`,
  },
  {
    id: 'document-artifact',
    name: 'Document Artifact',
    framing: `Generate a visual scene description for a cover image that depicts the chronicle AS a physical document or artifact — something with history, handled by real hands. The composition should show the document the way it would naturally be encountered in the world, not always flat on a surface photographed from above.`,
    instructions: `Write a vivid visual description of this chronicle as a physical document. Describe:
- Who made this document, who it was for, and how it would naturally be encountered or displayed
- The physical form and material quality — chosen to match the document's purpose and social status
- The viewing angle and spatial relationship between the viewer and the document
- Signs of the document's specific history — how it has been used, handled, or damaged
- The immediate environment and lighting`,
  },
  {
    id: 'formal-tableau',
    name: 'Formal Tableau',
    framing: `Generate a visual scene description for a formal, symmetrically arranged cover image for this chronicle. The composition should feel like a ceremonial painting or official record — staged, hierarchical, deliberate.`,
    instructions: `Write a vivid visual description of a formal tableau composition that captures the ceremony or proceedings of this chronicle. Describe:
- The central figure or focal point of authority
- How other figures are arranged around them and what their positioning conveys
- The formal setting and what it tells us about the nature of the proceedings
- Architectural or environmental elements that reinforce the formality
- Lighting that emphasizes the power structure`,
  },
  {
    id: 'folk-illustration',
    name: 'Folk Illustration',
    framing: `Generate a visual scene description for a folk-art style cover image for this chronicle. The image should look like a traditional illustration — iconic, decorative, with flattened perspective. Characters are archetypes, not portraits.`,
    instructions: `Write a vivid visual description of a folk-art illustration that captures the central narrative of this chronicle. Describe:
- Key characters or creatures rendered as iconic, slightly stylized figures
- Decorative framing or border elements drawn from the chronicle's world
- A flattened, non-perspectival spatial arrangement
- Rich pattern and texture detail
- The central narrative moment that reads clearly as a single image`,
  },
  {
    id: 'vignette-sequence',
    name: 'Vignette Sequence',
    framing: `Generate a visual scene description for a multi-panel vignette cover image for this chronicle. The image should contain several small, self-contained scenes arranged together — multiple moments from the chronicle presented side by side.`,
    instructions: `Write a vivid visual description of a vignette sequence that captures the breadth of this chronicle. Describe:
- 3-5 distinct moments from the chronicle, each as a brief self-contained scene
- How the vignettes are arranged relative to each other
- Visual connectors between panels — what ties them together as a set
- Each vignette's focal subject and mood
- The overall rhythm of the arrangement`,
  },
];

// ============================================================================
// Per-Narrative-Style Cover Image Configuration
// ============================================================================

export interface CoverImageConfig {
  scenePromptId: string;
  compositionStyleId: string;
}

const DEFAULT_CONFIG: CoverImageConfig = {
  scenePromptId: 'montage',
  compositionStyleId: 'chronicle-overview',
};

const COVER_IMAGE_CONFIG: Record<string, CoverImageConfig> = {
  // --- Story styles ---
  'epic-drama':         { scenePromptId: 'montage',           compositionStyleId: 'chronicle-overview' },
  'action-adventure':   { scenePromptId: 'montage',           compositionStyleId: 'chronicle-overview' },
  'heroic-fantasy':     { scenePromptId: 'montage',           compositionStyleId: 'chronicle-overview' },
  'treasure-hunt':      { scenePromptId: 'montage',           compositionStyleId: 'chronicle-overview' },
  'political-intrigue': { scenePromptId: 'montage',           compositionStyleId: 'chronicle-overview' },
  'tragedy':            { scenePromptId: 'montage',           compositionStyleId: 'chronicle-overview' },
  'mystery-suspense':   { scenePromptId: 'montage',           compositionStyleId: 'chronicle-overview' },
  'haunted-relic':      { scenePromptId: 'montage',           compositionStyleId: 'chronicle-overview' },
  'lost-legacy':        { scenePromptId: 'montage',           compositionStyleId: 'chronicle-overview' },
  'apocalyptic-vision': { scenePromptId: 'symbolic-abstract', compositionStyleId: 'chronicle-symbolic' },
  'romance':            { scenePromptId: 'intimate-scene',    compositionStyleId: 'chronicle-intimate' },
  'slice-of-life':      { scenePromptId: 'intimate-scene',    compositionStyleId: 'chronicle-intimate' },
  'confession':         { scenePromptId: 'intimate-scene',    compositionStyleId: 'chronicle-intimate' },
  'poetic-lyrical':     { scenePromptId: 'symbolic-abstract', compositionStyleId: 'chronicle-symbolic' },
  'dreamscape':         { scenePromptId: 'symbolic-abstract', compositionStyleId: 'chronicle-symbolic' },
  'dark-comedy':        { scenePromptId: 'vignette-sequence', compositionStyleId: 'chronicle-vignette' },
  'fable':              { scenePromptId: 'folk-illustration', compositionStyleId: 'chronicle-folk' },
  'trial-judgment':     { scenePromptId: 'formal-tableau',    compositionStyleId: 'chronicle-tableau' },

  // --- Document styles ---
  'heralds-dispatch':     { scenePromptId: 'document-artifact',  compositionStyleId: 'chronicle-document' },
  'merchants-broadsheet': { scenePromptId: 'document-artifact',  compositionStyleId: 'chronicle-document' },
  'collected-letters':    { scenePromptId: 'document-artifact',  compositionStyleId: 'chronicle-document' },
  'chronicle-entry':      { scenePromptId: 'document-artifact',  compositionStyleId: 'chronicle-document' },
  'wanted-notice':        { scenePromptId: 'document-artifact',  compositionStyleId: 'chronicle-document' },
  'field-report':         { scenePromptId: 'document-artifact',  compositionStyleId: 'chronicle-document' },
  'personal-diary':       { scenePromptId: 'intimate-scene',     compositionStyleId: 'chronicle-intimate' },
  'interrogation-record': { scenePromptId: 'formal-tableau',     compositionStyleId: 'chronicle-tableau' },
  'diplomatic-accord':    { scenePromptId: 'formal-tableau',     compositionStyleId: 'chronicle-tableau' },
  'treatise-powers':      { scenePromptId: 'document-artifact',   compositionStyleId: 'chronicle-document' },
  'sacred-text':          { scenePromptId: 'symbolic-abstract',  compositionStyleId: 'chronicle-symbolic' },
  'artisans-catalogue':   { scenePromptId: 'vignette-sequence',  compositionStyleId: 'chronicle-vignette' },
  'tavern-notices':       { scenePromptId: 'vignette-sequence',  compositionStyleId: 'chronicle-vignette' },
  'product-reviews':      { scenePromptId: 'vignette-sequence',  compositionStyleId: 'chronicle-vignette' },
  'folk-song':            { scenePromptId: 'folk-illustration',  compositionStyleId: 'chronicle-folk' },
  'nursery-rhymes':       { scenePromptId: 'folk-illustration',  compositionStyleId: 'chronicle-folk' },
  'haiku-collection':     { scenePromptId: 'symbolic-abstract',  compositionStyleId: 'chronicle-symbolic' },
  'proverbs-sayings':     { scenePromptId: 'symbolic-abstract',  compositionStyleId: 'chronicle-symbolic' },
};

// ============================================================================
// Lookup Functions
// ============================================================================

const templateMap = new Map(SCENE_PROMPT_TEMPLATES.map((t) => [t.id, t]));

export function getCoverImageConfig(narrativeStyleId: string): CoverImageConfig {
  return COVER_IMAGE_CONFIG[narrativeStyleId] || DEFAULT_CONFIG;
}

export function getScenePromptTemplate(id: string): ScenePromptTemplate {
  return templateMap.get(id) || templateMap.get('montage')!;
}
