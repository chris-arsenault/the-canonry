/**
 * Framework primitives and schema definitions.
 *
 * These are the canonical framework-level kinds, relationships, tags, and cultures
 * required by Lore Weave and the Canonry MFEs.
 */

import type { EntityKindDefinition } from './entityKind.js';
import type { RelationshipKindDefinition } from './relationship.js';
import type { CultureDefinition } from './culture.js';
import type { CanonrySchemaSlice, TagDefinition } from './mfeContracts.js';

// ===========================
// FRAMEWORK ENTITY KINDS
// ===========================

export const FRAMEWORK_ENTITY_KINDS = {
  ERA: 'era',
  OCCURRENCE: 'occurrence',
} as const;

export type FrameworkEntityKind =
  typeof FRAMEWORK_ENTITY_KINDS[keyof typeof FRAMEWORK_ENTITY_KINDS];

export const FRAMEWORK_ENTITY_KIND_VALUES: readonly FrameworkEntityKind[] =
  Object.values(FRAMEWORK_ENTITY_KINDS);

// ===========================
// FRAMEWORK RELATIONSHIP KINDS
// ===========================

export const FRAMEWORK_RELATIONSHIP_KINDS = {
  SUPERSEDES: 'supersedes',
  PART_OF: 'part_of',
  ACTIVE_DURING: 'active_during',
  PARTICIPANT_IN: 'participant_in',
  EPICENTER_OF: 'epicenter_of',
  TRIGGERED_BY: 'triggered_by',
  CREATED_DURING: 'created_during',
} as const;

export type FrameworkRelationshipKind =
  typeof FRAMEWORK_RELATIONSHIP_KINDS[keyof typeof FRAMEWORK_RELATIONSHIP_KINDS];

export const FRAMEWORK_RELATIONSHIP_KIND_VALUES: readonly FrameworkRelationshipKind[] =
  Object.values(FRAMEWORK_RELATIONSHIP_KINDS);

// ===========================
// FRAMEWORK STATUS VALUES
// ===========================

export const FRAMEWORK_STATUS = {
  ACTIVE: 'active',
  HISTORICAL: 'historical',
  CURRENT: 'current',
  FUTURE: 'future',
  SUBSUMED: 'subsumed',
} as const;

export type FrameworkStatus = typeof FRAMEWORK_STATUS[keyof typeof FRAMEWORK_STATUS];

export const FRAMEWORK_STATUS_VALUES: readonly FrameworkStatus[] =
  Object.values(FRAMEWORK_STATUS);

// ===========================
// FRAMEWORK SUBTYPES
// ===========================

export const FRAMEWORK_SUBTYPES = {
  REGION: 'region',
} as const;

export type FrameworkSubtype = typeof FRAMEWORK_SUBTYPES[keyof typeof FRAMEWORK_SUBTYPES];

export const FRAMEWORK_SUBTYPE_VALUES: readonly FrameworkSubtype[] =
  Object.values(FRAMEWORK_SUBTYPES);

// ===========================
// FRAMEWORK CULTURES
// ===========================

export const FRAMEWORK_CULTURES = {
  WORLD: 'world',
} as const;

export type FrameworkCultureId = typeof FRAMEWORK_CULTURES[keyof typeof FRAMEWORK_CULTURES];

// ===========================
// FRAMEWORK TAGS
// ===========================

export const FRAMEWORK_TAGS = {
  META_ENTITY: 'meta-entity',
  TEMPORAL: 'temporal',
  ERA: 'era',
  ERA_ID: 'eraId',
  PROMINENCE_LOCKED: 'prominence_locked',
} as const;

export type FrameworkTag = typeof FRAMEWORK_TAGS[keyof typeof FRAMEWORK_TAGS];

export const FRAMEWORK_TAG_VALUES: readonly FrameworkTag[] =
  Object.values(FRAMEWORK_TAGS);

// ===========================
// TYPE GUARDS
// ===========================

export function isFrameworkEntityKind(kind: string): kind is FrameworkEntityKind {
  return FRAMEWORK_ENTITY_KIND_VALUES.includes(kind as FrameworkEntityKind);
}

export function isFrameworkRelationshipKind(kind: string): kind is FrameworkRelationshipKind {
  return FRAMEWORK_RELATIONSHIP_KIND_VALUES.includes(kind as FrameworkRelationshipKind);
}

export function isFrameworkStatus(status: string): status is FrameworkStatus {
  return FRAMEWORK_STATUS_VALUES.includes(status as FrameworkStatus);
}

export function isFrameworkSubtype(subtype: string): subtype is FrameworkSubtype {
  return FRAMEWORK_SUBTYPE_VALUES.includes(subtype as FrameworkSubtype);
}

export function isFrameworkTag(tag: string): tag is FrameworkTag {
  return FRAMEWORK_TAG_VALUES.includes(tag as FrameworkTag);
}

// ===========================
// FRAMEWORK STATUS SETS
// ===========================

export const FRAMEWORK_ERA_STATUS_VALUES = [
  FRAMEWORK_STATUS.CURRENT,
  FRAMEWORK_STATUS.FUTURE,
  FRAMEWORK_STATUS.HISTORICAL,
] as const;

export const FRAMEWORK_OCCURRENCE_STATUS_VALUES = [
  FRAMEWORK_STATUS.ACTIVE,
  FRAMEWORK_STATUS.HISTORICAL,
] as const;

// ===========================
// RELATIONSHIP PROPERTIES
// ===========================

export const FRAMEWORK_RELATIONSHIP_PROPERTIES = {
  [FRAMEWORK_RELATIONSHIP_KINDS.SUPERSEDES]: {
    defaultStrength: 0.7,
    description: 'Era lineage (newer era supersedes older)',
  },
  [FRAMEWORK_RELATIONSHIP_KINDS.PART_OF]: {
    defaultStrength: 0.5,
    description: 'Subsumption into meta-entity',
  },
  [FRAMEWORK_RELATIONSHIP_KINDS.ACTIVE_DURING]: {
    defaultStrength: 0.3,
    description: 'Temporal association with era',
  },
  [FRAMEWORK_RELATIONSHIP_KINDS.PARTICIPANT_IN]: {
    defaultStrength: 1.0,
    description: 'Entity participates in an occurrence',
  },
  [FRAMEWORK_RELATIONSHIP_KINDS.EPICENTER_OF]: {
    defaultStrength: 1.0,
    description: 'Occurrence has a location epicenter',
  },
  [FRAMEWORK_RELATIONSHIP_KINDS.TRIGGERED_BY]: {
    defaultStrength: 0.8,
    description: 'Occurrence was triggered by entity/event',
  },
  [FRAMEWORK_RELATIONSHIP_KINDS.CREATED_DURING]: {
    defaultStrength: 0.5,
    description: 'Entity was created during this era (temporal origin)',
  },
} as const;

export function getFrameworkRelationshipStrength(kind: FrameworkRelationshipKind): number {
  return FRAMEWORK_RELATIONSHIP_PROPERTIES[kind].defaultStrength;
}

// ===========================
// FRAMEWORK SCHEMA DEFINITIONS
// ===========================

export const FRAMEWORK_ENTITY_KIND_DEFINITIONS: EntityKindDefinition[] = [
  {
    kind: FRAMEWORK_ENTITY_KINDS.ERA,
    description: 'Era',
    category: 'era',
    isFramework: true,
    subtypes: [],
    statuses: [
      { id: FRAMEWORK_STATUS.CURRENT, name: 'Current', isTerminal: false, polarity: 'neutral' },
      { id: FRAMEWORK_STATUS.FUTURE, name: 'Future', isTerminal: false, polarity: 'neutral' },
      { id: FRAMEWORK_STATUS.HISTORICAL, name: 'Historical', isTerminal: true, polarity: 'neutral' },
    ],
    defaultStatus: FRAMEWORK_STATUS.CURRENT,
    style: { color: '#FFD700', displayName: 'Era' },
  },
  {
    kind: FRAMEWORK_ENTITY_KINDS.OCCURRENCE,
    description: 'Occurrence',
    category: 'event',
    isFramework: true,
    subtypes: [],
    statuses: [
      { id: FRAMEWORK_STATUS.ACTIVE, name: 'Active', isTerminal: false, polarity: 'neutral' },
      { id: FRAMEWORK_STATUS.HISTORICAL, name: 'Historical', isTerminal: true, polarity: 'neutral' },
    ],
    defaultStatus: FRAMEWORK_STATUS.ACTIVE,
    style: { color: '#FCD76B', displayName: 'Occurrence' },
  },
];

export const FRAMEWORK_RELATIONSHIP_KIND_DEFINITIONS: RelationshipKindDefinition[] = [
  {
    kind: FRAMEWORK_RELATIONSHIP_KINDS.SUPERSEDES,
    name: 'Supersedes',
    description: FRAMEWORK_RELATIONSHIP_PROPERTIES[FRAMEWORK_RELATIONSHIP_KINDS.SUPERSEDES].description,
    isFramework: true,
    srcKinds: [],
    dstKinds: [],
    cullable: false,
    decayRate: 'none',
    polarity: 'neutral',
  },
  {
    kind: FRAMEWORK_RELATIONSHIP_KINDS.PART_OF,
    name: 'Part Of',
    description: FRAMEWORK_RELATIONSHIP_PROPERTIES[FRAMEWORK_RELATIONSHIP_KINDS.PART_OF].description,
    isFramework: true,
    srcKinds: [],
    dstKinds: [],
    cullable: false,
    decayRate: 'none',
    polarity: 'positive',  // Membership is generally positive
  },
  {
    kind: FRAMEWORK_RELATIONSHIP_KINDS.ACTIVE_DURING,
    name: 'Active During',
    description: FRAMEWORK_RELATIONSHIP_PROPERTIES[FRAMEWORK_RELATIONSHIP_KINDS.ACTIVE_DURING].description,
    isFramework: true,
    srcKinds: [],
    dstKinds: [FRAMEWORK_ENTITY_KINDS.ERA],
    cullable: false,
    decayRate: 'none',
    polarity: 'neutral',
  },
  {
    kind: FRAMEWORK_RELATIONSHIP_KINDS.PARTICIPANT_IN,
    name: 'Participant In',
    description: FRAMEWORK_RELATIONSHIP_PROPERTIES[FRAMEWORK_RELATIONSHIP_KINDS.PARTICIPANT_IN].description,
    isFramework: true,
    srcKinds: [],
    dstKinds: [FRAMEWORK_ENTITY_KINDS.OCCURRENCE],
    cullable: false,
    decayRate: 'none',
    polarity: 'neutral',
  },
  {
    kind: FRAMEWORK_RELATIONSHIP_KINDS.EPICENTER_OF,
    name: 'Epicenter Of',
    description: FRAMEWORK_RELATIONSHIP_PROPERTIES[FRAMEWORK_RELATIONSHIP_KINDS.EPICENTER_OF].description,
    isFramework: true,
    srcKinds: [FRAMEWORK_ENTITY_KINDS.OCCURRENCE],
    dstKinds: [],
    cullable: false,
    decayRate: 'none',
    polarity: 'neutral',
  },
  {
    kind: FRAMEWORK_RELATIONSHIP_KINDS.TRIGGERED_BY,
    name: 'Triggered By',
    description: FRAMEWORK_RELATIONSHIP_PROPERTIES[FRAMEWORK_RELATIONSHIP_KINDS.TRIGGERED_BY].description,
    isFramework: true,
    srcKinds: [FRAMEWORK_ENTITY_KINDS.OCCURRENCE],
    dstKinds: [],
    cullable: false,
    decayRate: 'none',
    polarity: 'neutral',
  },
  {
    kind: FRAMEWORK_RELATIONSHIP_KINDS.CREATED_DURING,
    name: 'Created During',
    description: FRAMEWORK_RELATIONSHIP_PROPERTIES[FRAMEWORK_RELATIONSHIP_KINDS.CREATED_DURING].description,
    isFramework: true,
    srcKinds: [],
    dstKinds: [FRAMEWORK_ENTITY_KINDS.ERA],
    cullable: false,
    decayRate: 'none',
    polarity: 'neutral',
  },
];

export const FRAMEWORK_CULTURE_DEFINITIONS: CultureDefinition[] = [
  {
    id: FRAMEWORK_CULTURES.WORLD,
    name: 'World',
    description: 'Transcendent entities that belong to no single culture.',
    color: '#9CA3AF',
    isFramework: true,
  },
];

export const FRAMEWORK_TAG_DEFINITIONS: TagDefinition[] = [
  {
    tag: FRAMEWORK_TAGS.META_ENTITY,
    category: 'system',
    rarity: 'common',
    description: 'Entity formed via clustering or meta-entity formation.',
    isFramework: true,
  },
  {
    tag: FRAMEWORK_TAGS.TEMPORAL,
    category: 'system',
    rarity: 'common',
    description: 'Marks entities with temporal tracking semantics.',
    isFramework: true,
  },
  {
    tag: FRAMEWORK_TAGS.ERA,
    category: 'system',
    rarity: 'common',
    description: 'Marks entities that represent eras.',
    isFramework: true,
  },
  {
    tag: FRAMEWORK_TAGS.ERA_ID,
    category: 'system',
    rarity: 'common',
    description: 'Stores the era identifier for era entities.',
    isFramework: true,
  },
  {
    tag: FRAMEWORK_TAGS.PROMINENCE_LOCKED,
    category: 'system',
    rarity: 'common',
    description: 'Prevents prominence changes for entities locked at era transition.',
    isFramework: true,
  },
];

// ===========================
// SCHEMA MERGE HELPERS
// ===========================

export function mergeFrameworkSchemaSlice(schema: CanonrySchemaSlice): CanonrySchemaSlice {
  const entityOverrides = new Map(
    (schema.entityKinds || []).map(item => [item.kind, item])
  );
  const relationshipOverrides = new Map(
    (schema.relationshipKinds || []).map(item => [item.kind, item])
  );
  const cultureOverrides = new Map(
    (schema.cultures || []).map(item => [item.id, item])
  );
  const tagOverrides = new Map(
    (schema.tagRegistry || []).map(item => [item.tag, item])
  );

  const frameworkEntityKindIds = new Set(FRAMEWORK_ENTITY_KIND_VALUES.map(String));
  const frameworkRelationshipKindIds = new Set(FRAMEWORK_RELATIONSHIP_KIND_VALUES.map(String));
  const frameworkCultureIds = new Set(Object.values(FRAMEWORK_CULTURES).map(String));
  const frameworkTagIds = new Set(FRAMEWORK_TAG_VALUES.map(String));

  const mergeSubtypes = (base: EntityKindDefinition, override?: EntityKindDefinition) => {
    const seen = new Set(base.subtypes.map(s => s.id));
    const extra = (override?.subtypes || []).filter(s => !seen.has(s.id));
    return [...base.subtypes, ...extra];
  };

  const mergeStatuses = (base: EntityKindDefinition, override?: EntityKindDefinition) => {
    const seen = new Set(base.statuses.map(s => s.id));
    const extra = (override?.statuses || []).filter(s => !seen.has(s.id));
    return [...base.statuses, ...extra];
  };

  const mergeRequiredRelationships = (
    base: EntityKindDefinition,
    override?: EntityKindDefinition
  ) => {
    const baseRules = base.requiredRelationships || [];
    const seen = new Set(baseRules.map(r => r.kind));
    const extra = (override?.requiredRelationships || []).filter(r => !seen.has(r.kind));
    return baseRules.length > 0 || extra.length > 0 ? [...baseRules, ...extra] : undefined;
  };

  const mergedEntityKinds = [
    ...FRAMEWORK_ENTITY_KIND_DEFINITIONS.map((base) => {
      const override = entityOverrides.get(base.kind);
      const merged: EntityKindDefinition = {
        ...base,
        ...(override || {}),
        kind: base.kind,
        isFramework: true,
        subtypes: mergeSubtypes(base, override),
        statuses: mergeStatuses(base, override),
        requiredRelationships: mergeRequiredRelationships(base, override),
        style: { ...(base.style || {}), ...(override?.style || {}) },
        semanticPlane: override?.semanticPlane ?? base.semanticPlane,
        defaultStatus: override?.defaultStatus ?? base.defaultStatus,
      };
      return merged;
    }),
    ...(schema.entityKinds || []).filter(item => !frameworkEntityKindIds.has(String(item.kind))),
  ];

  const mergedRelationshipKinds = [
    ...FRAMEWORK_RELATIONSHIP_KIND_DEFINITIONS.map((base) => {
      const override = relationshipOverrides.get(base.kind);
      const merged: RelationshipKindDefinition = {
        ...base,
        ...(override || {}),
        kind: base.kind,
        isFramework: true,
        srcKinds: (override?.srcKinds && override.srcKinds.length > 0)
          ? override.srcKinds
          : base.srcKinds,
        dstKinds: (override?.dstKinds && override.dstKinds.length > 0)
          ? override.dstKinds
          : base.dstKinds,
        cullable: base.cullable,
        decayRate: base.decayRate,
      };
      return merged;
    }),
    ...(schema.relationshipKinds || []).filter(item => !frameworkRelationshipKindIds.has(String(item.kind))),
  ];

  const mergedCultures = [
    ...FRAMEWORK_CULTURE_DEFINITIONS.map((base) => {
      const override = cultureOverrides.get(base.id);
      const merged: CultureDefinition = {
        ...base,
        ...(override || {}),
        id: base.id,
        isFramework: true,
        name: base.name,
        description: base.description ?? override?.description,
        color: base.color ?? override?.color,
        naming: override?.naming ?? base.naming,
        axisBiases: override?.axisBiases ?? base.axisBiases,
        homeRegions: override?.homeRegions ?? base.homeRegions,
      };
      return merged;
    }),
    ...(schema.cultures || []).filter(item => !frameworkCultureIds.has(String(item.id))),
  ];

  const mergedTags = [
    ...FRAMEWORK_TAG_DEFINITIONS.map((base) => {
      const override = tagOverrides.get(base.tag);
      const merged: TagDefinition = {
        ...base,
        ...(override || {}),
        tag: base.tag,
        isFramework: true,
      };
      return merged;
    }),
    ...(schema.tagRegistry || []).filter(item => !frameworkTagIds.has(String(item.tag))),
  ];

  return {
    ...schema,
    entityKinds: mergedEntityKinds,
    relationshipKinds: mergedRelationshipKinds,
    cultures: mergedCultures,
    tagRegistry: mergedTags,
  };
}
