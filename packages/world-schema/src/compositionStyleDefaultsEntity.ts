/**
 * Default Composition Style Presets (Part 1: Entity & Environment)
 *
 * Categories: Character, Pair, Pose, Collective, Place.
 * Types are defined in compositionStyles.ts.
 */

import type { CompositionStyle } from './compositionStyles.js';

export const CHARACTER_COMPOSITIONS: CompositionStyle[] = [
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
];

export const PAIR_COMPOSITIONS: CompositionStyle[] = [
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
];

export const POSE_COMPOSITIONS: CompositionStyle[] = [
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
];

export const COLLECTIVE_COMPOSITIONS: CompositionStyle[] = [
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
];

export const PLACE_COMPOSITIONS: CompositionStyle[] = [
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
];
