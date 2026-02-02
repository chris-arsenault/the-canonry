/**
 * Chronicle Context Builder
 *
 * Gathers all structured data needed for chronicle generation.
 * This ensures full entity objects + enriched descriptions flow through the pipeline.
 *
 * See CHRONICLE_DESIGN.md for architecture documentation.
 */

import {
  buildProminenceScale,
  DEFAULT_PROMINENCE_DISTRIBUTION,
  prominenceThresholdFromScale,
} from '@canonry/world-schema';
import type { NarrativeStyle } from '@canonry/world-schema';
import type {
  ChronicleGenerationContext,
  ChronicleRoleAssignment,
  NarrativeLens,
  ChronicleFocus,
  ChronicleFocusType,
  EntityContext,
  RelationshipContext,
  EraContext,
  NarrativeEventContext,
  ChronicleTemporalContext,
  ToneFragments,
  CanonFactWithMetadata,
  WorldDynamic,
} from './chronicleTypes';

interface WorldData {
  hardState: Array<{
    id: string;
    name: string;
    kind: string;
    subtype?: string;
    prominence: string;
    culture?: string;
    status: string;
    tags?: Record<string, string>;
    eraId?: string;
    summary?: string;
    description?: string;
    coordinates?: { x: number; y: number };
    createdAt: number;
    updatedAt: number;
    enrichment?: {
      text?: {
        aliases?: string[];
      };
    };
  }>;
  relationships: Array<{
    src: string;
    dst: string;
    kind: string;
    strength?: number;
  }>;
  narrativeHistory?: Array<{
    id: string;
    tick: number;
    era: string;
    eventKind: string;
    significance: number;
    headline: string;
    description?: string;
    subject?: { id: string; name: string };
    object?: { id: string; name: string };
    stateChanges?: Array<{
      entityId: string;
      entityName: string;
      field: string;
      previousValue: unknown;
      newValue: unknown;
    }>;
    narrativeTags?: string[];
  }>;
}

interface WorldContext {
  name: string;
  description: string;

  // Required for chronicle generation (perspective synthesis)
  toneFragments: ToneFragments;
  canonFactsWithMetadata: CanonFactWithMetadata[];

  // World dynamics (optional narrative context statements)
  worldDynamics?: WorldDynamic[];
}

/**
 * Build entity context from raw entity data
 */
function buildEntityContext(entity: WorldData['hardState'][0]): EntityContext {
  return {
    id: entity.id,
    name: entity.name,
    kind: entity.kind,
    subtype: entity.subtype,
    prominence: entity.prominence,
    culture: entity.culture,
    status: entity.status,
    tags: entity.tags || {},
    eraId: entity.eraId,
    summary: entity.summary,
    description: entity.description,
    aliases: entity.enrichment?.text?.aliases || [],
    coordinates: entity.coordinates,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

/**
 * Build relationship context with resolved entity info
 */
function buildRelationshipContext(
  rel: WorldData['relationships'][0],
  entityMap: Map<string, WorldData['hardState'][0]>
): RelationshipContext {
  const src = entityMap.get(rel.src);
  const dst = entityMap.get(rel.dst);

  return {
    src: rel.src,
    dst: rel.dst,
    kind: rel.kind,
    strength: rel.strength,
    sourceName: src?.name || rel.src,
    sourceKind: src?.kind || 'unknown',
    targetName: dst?.name || rel.dst,
    targetKind: dst?.kind || 'unknown',
    // TODO: Add backstory from enrichment when available
    backstory: undefined,
  };
}

function resolveEntityEraId(entity: WorldData['hardState'][0] | undefined): string | undefined {
  if (!entity) return undefined;
  if (typeof entity.eraId === 'string' && entity.eraId) return entity.eraId;
  return undefined;
}

function buildEraLookup(
  entities: WorldData['hardState']
): Map<string, WorldData['hardState'][0]> {
  const map = new Map<string, WorldData['hardState'][0]>();
  for (const entity of entities) {
    if (entity.kind !== 'era') continue;
    map.set(entity.id, entity);
    if (typeof entity.eraId === 'string' && entity.eraId) {
      map.set(entity.eraId, entity);
    }
  }
  return map;
}

/**
 * Build era context from entity data
 */
function buildEraContext(entity: WorldData['hardState'][0]): EraContext {
  return {
    id: entity.eraId || entity.id,
    name: entity.name,
    description: entity.description,
  };
}

/**
 * Build narrative event context
 */
function buildEventContext(
  event: NonNullable<WorldData['narrativeHistory']>[0]
): NarrativeEventContext {
  return {
    id: event.id,
    tick: event.tick,
    era: event.era,
    eventKind: event.eventKind,
    significance: event.significance,
    headline: event.headline,
    description: event.description,
    subjectId: event.subject?.id,
    subjectName: event.subject?.name,
    objectId: event.object?.id,
    objectName: event.object?.name,
    participants: event.participants?.map(p => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      subtype: p.subtype,
    })),
    stateChanges: event.stateChanges,
    narrativeTags: event.narrativeTags,
  };
}

/**
 * Chronicle selections from wizard (chronicle-first architecture)
 */
export interface ChronicleSelections {
  /** Role assignments define the cast - primary identity */
  roleAssignments: ChronicleRoleAssignment[];
  /** Optional narrative lens - contextual frame entity */
  lens?: NarrativeLens;
  /** Selected event IDs */
  selectedEventIds: string[];
  /** Selected relationship IDs (src:dst:kind format) */
  selectedRelationshipIds: string[];
  /** Entry point used for graph traversal (mechanical, not displayed) */
  entrypointId?: string;
}

/**
 * Derive focus type from role assignments
 */
function deriveFocusType(roleAssignments: ChronicleRoleAssignment[]): ChronicleFocusType {
  const primaryCount = roleAssignments.filter(r => r.isPrimary).length;
  if (primaryCount <= 1) return 'single';
  return 'ensemble';
}

/**
 * Build a ChronicleFocus from selections
 */
function buildFocus(
  roleAssignments: ChronicleRoleAssignment[],
  selectedEventIds: string[],
  selectedRelationshipIds: string[],
  lens?: NarrativeLens
): ChronicleFocus {
  const primaryEntityIds = roleAssignments
    .filter(r => r.isPrimary)
    .map(r => r.entityId);
  const supportingEntityIds = roleAssignments
    .filter(r => !r.isPrimary)
    .map(r => r.entityId);
  const selectedEntityIds = roleAssignments.map(r => r.entityId);
  // Include lens entity in selected IDs so it's available for context building
  if (lens && !selectedEntityIds.includes(lens.entityId)) {
    selectedEntityIds.push(lens.entityId);
  }

  return {
    type: deriveFocusType(roleAssignments),
    roleAssignments,
    lens,
    primaryEntityIds,
    supportingEntityIds,
    selectedEntityIds,
    selectedEventIds,
    selectedRelationshipIds,
  };
}

/**
 * Build generation context from chronicle selections (chronicle-first architecture)
 *
 * This is the primary entry point for building generation context.
 * Role assignments define the chronicle's identity, not a single entity.
 *
 * @param selections - Chronicle selections from wizard
 * @param worldData - World simulation data
 * @param worldContext - World context (name, description, etc.)
 * @param narrativeStyle - Narrative style selected for this chronicle
 * @param nameBank - Optional pre-generated names by culture for invented characters
 * @param proseHints - Optional per-kind prose hints for narrative guidance
 * @param culturalIdentities - Optional cultural identity data (VALUES, SPEECH, FEARS, TABOOS etc.)
 * @param temporalContext - Optional temporal context computed from selected events and eras
 */
export function buildChronicleContext(
  selections: ChronicleSelections,
  worldData: WorldData,
  worldContext: WorldContext,
  narrativeStyle: NarrativeStyle,
  nameBank?: Record<string, string[]>,
  proseHints?: Record<string, string>,
  culturalIdentities?: Record<string, Record<string, string>>,
  temporalContext?: ChronicleTemporalContext | null
): ChronicleGenerationContext {
  const entityMap = new Map(worldData.hardState.map((e) => [e.id, e]));

  // Build focus from role assignments
  const focus = buildFocus(
    selections.roleAssignments,
    selections.selectedEventIds,
    selections.selectedRelationshipIds,
    selections.lens
  );

  // Get entities from role assignments
  const entities = worldData.hardState
    .filter((e) => focus.selectedEntityIds.includes(e.id))
    .map(buildEntityContext);

  // Parse relationship IDs (format: src:dst:kind) and get selected relationships
  const relationships = selections.selectedRelationshipIds
    .map(id => {
      const [src, dst, kind] = id.split(':');
      return worldData.relationships.find(
        r => r.src === src && r.dst === dst && r.kind === kind
      );
    })
    .filter((r): r is NonNullable<typeof r> => r !== undefined)
    .map((r) => buildRelationshipContext(r, entityMap));

  // Get selected events
  const eventIdSet = new Set(selections.selectedEventIds);
  const events = (worldData.narrativeHistory || [])
    .filter((e) => eventIdSet.has(e.id))
    .sort((a, b) => b.significance - a.significance)
    .map(buildEventContext);

  // Resolve lens entity from world data
  const lensRaw = selections.lens ? entityMap.get(selections.lens.entityId) : undefined;
  const lensEntity = lensRaw ? buildEntityContext(lensRaw) : undefined;

  const eraLookup = buildEraLookup(worldData.hardState);

  // Find era from first primary entity (use entity eraId attribute directly)
  const primaryEntityId = focus.primaryEntityIds[0];
  const primaryEntity = primaryEntityId ? entityMap.get(primaryEntityId) : undefined;
  const primaryEraId = resolveEntityEraId(primaryEntity);
  const era = primaryEraId ? eraLookup.get(primaryEraId) : undefined;

  return {
    worldName: worldContext.name || 'The World',
    worldDescription: worldContext.description || '',
    // These will be populated by perspective synthesis
    canonFacts: [],
    tone: '',
    narrativeStyle,

    // Input for perspective synthesis (required)
    toneFragments: worldContext.toneFragments,
    canonFactsWithMetadata: worldContext.canonFactsWithMetadata,

    // Chronicle focus (primary)
    focus,

    // Narrative lens entity (contextual frame)
    lensEntity,

    era: era ? buildEraContext(era) : undefined,
    // Full temporal context with all eras and chronicle timeline
    temporalContext: temporalContext || undefined,
    entities,
    relationships,
    events,

    // Name bank for invented characters
    nameBank,

    // Prose hints for entity kinds (e.g., how to write about NPCs vs locations)
    proseHints,

    // Cultural identities for cultures (VALUES, SPEECH, FEARS, TABOOS, etc.)
    culturalIdentities,

    // World dynamics (narrative context statements)
    worldDynamics: worldContext.worldDynamics,
  };
}

/**
 * Check prerequisites for chronicle generation
 * Returns list of missing items that should be generated first
 */
export interface PrerequisiteCheck {
  ready: boolean;
  missing: {
    type: 'entityDescription';
    id: string;
    name: string;
  }[];
}

export function checkPrerequisites(
  context: ChronicleGenerationContext
): PrerequisiteCheck {
  const missing: PrerequisiteCheck['missing'] = [];

  if (!context.focus?.roleAssignments) {
    return { ready: false, missing };
  }

  // Check that primary entities have descriptions
  for (const role of context.focus.roleAssignments.filter(r => r.isPrimary)) {
    const entity = context.entities.find(e => e.id === role.entityId);
    if (entity && !(entity.summary && entity.description)) {
      missing.push({
        type: 'entityDescription',
        id: entity.id,
        name: entity.name,
      });
    }
  }

  return {
    ready: missing.length === 0,
    missing,
  };
}

/**
 * Get a summary of context for display
 */
export function summarizeContext(context: ChronicleGenerationContext): {
  entityCount: number;
  relationshipCount: number;
  eventCount: number;
  prominentEntities: string[];
  highSignificanceEvents: string[];
} {
  const prominenceScale = buildProminenceScale(
    context.entities
      .map((entity) => Number(entity.prominence))
      .filter((value) => Number.isFinite(value)),
    { distribution: DEFAULT_PROMINENCE_DISTRIBUTION }
  );
  const prominentThreshold = prominenceThresholdFromScale('renowned', prominenceScale);

  const prominentEntities = context.entities
    .filter((e) => Number(e.prominence) >= prominentThreshold)
    .map((e) => e.name)
    .slice(0, 10);

  const highSignificanceEvents = context.events
    .filter((e) => e.significance >= 0.7)
    .map((e) => e.headline)
    .slice(0, 5);

  return {
    entityCount: context.entities.length,
    relationshipCount: context.relationships.length,
    eventCount: context.events.length,
    prominentEntities,
    highSignificanceEvents,
  };
}
