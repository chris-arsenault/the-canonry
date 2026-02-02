/**
 * Unified Mutation Applier
 *
 * Single dispatch point for all mutation types.
 * Replaces multiple implementations across:
 * - executeStateUpdate (templateInterpreter)
 * - applyActions (thresholdTrigger)
 * - action dispatch (connectionEvolution)
 *
 * Mutations are prepared (not directly applied) so callers can batch
 * or validate before committing changes to the graph.
 */

import { HardState } from '../../core/worldTypes';
import { FRAMEWORK_TAGS } from '@canonry/world-schema';
import { clampProminence, prominenceLabel, normalizeDirection } from '../types';
import type { RuleContext } from '../context';
import type {
  Mutation,
  MutationResult,
  EntityModification,
  RelationshipToCreate,
  RelationshipToArchive,
  SetTagMutation,
  RemoveTagMutation,
  CreateRelationshipMutation,
  ArchiveRelationshipMutation,
  ArchiveAllRelationshipsMutation,
  AdjustRelationshipStrengthMutation,
  TransferRelationshipMutation,
  ChangeStatusMutation,
  AdjustProminenceMutation,
  ModifyPressureMutation,
  ForEachRelatedAction,
  ConditionalAction,
} from './types';
import { evaluateCondition } from '../conditions';
import { hasTag } from '../../utils';

// Re-export types
export * from './types';

type TagValue = string | boolean;
type TagPatch = Record<string, TagValue | undefined>;

export function applyTagPatch(
  base: Record<string, TagValue> | undefined,
  patch: TagPatch
): Record<string, TagValue> {
  const merged: Record<string, TagValue> = { ...(base ?? {}) };

  for (const [tag, value] of Object.entries(patch)) {
    if (!tag || tag === 'undefined') {
      continue;
    }
    if (value === undefined) {
      delete merged[tag];
    } else {
      merged[tag] = value;
    }
  }

  if ('undefined' in merged) {
    delete merged['undefined'];
  }
  if ('' in merged) {
    delete merged[''];
  }

  return merged;
}

export function buildTagPatch(
  before: Record<string, TagValue> | undefined,
  after: Record<string, TagValue>
): TagPatch {
  const base = before ?? {};
  const patch: TagPatch = {};

  for (const [tag, value] of Object.entries(after)) {
    if (!tag || tag === 'undefined') {
      continue;
    }
    if (base[tag] !== value) {
      patch[tag] = value;
    }
  }

  for (const tag of Object.keys(base)) {
    if (!tag || tag === 'undefined') {
      continue;
    }
    if (!(tag in after)) {
      patch[tag] = undefined;
    }
  }

  return patch;
}

function resolveEntityRef(ref: string, ctx: RuleContext): HardState | undefined {
  if (ref === '$self') {
    return ctx.self;
  }

  if (ref.startsWith('$')) {
    const name = ref.slice(1);
    const bound = ctx.entities?.[name];
    if (bound) return bound;
  }

  return ctx.resolver.resolveEntity(ref);
}

/**
 * Prepare a mutation for application.
 *
 * This returns a MutationResult describing what changes should be made,
 * without actually modifying the graph. The caller is responsible for
 * applying the changes.
 *
 * @param mutation - The mutation to prepare
 * @param ctx - The rule context
 * @returns MutationResult with prepared changes
 */
export function prepareMutation(
  mutation: Mutation,
  ctx: RuleContext
): MutationResult {
  const result: MutationResult = {
    applied: true,
    diagnostic: '',
    entityModifications: [],
    relationshipsCreated: [],
    relationshipsAdjusted: [],
    relationshipsToArchive: [],
    pressureChanges: {},
    rateLimitUpdated: false,
  };

  switch (mutation.type) {
    // =========================================================================
    // TAG MUTATIONS
    // =========================================================================

    case 'set_tag':
      return prepareSetTag(mutation, ctx, result);

    case 'remove_tag':
      return prepareRemoveTag(mutation, ctx, result);

    // =========================================================================
    // RELATIONSHIP MUTATIONS
    // =========================================================================

    case 'create_relationship':
      return prepareCreateRelationship(mutation, ctx, result);

    case 'archive_relationship':
      return prepareArchiveRelationship(mutation, ctx, result);

    case 'archive_all_relationships':
      // Convert to archive_relationship format (without 'with' = archives all)
      return prepareArchiveRelationship(
        {
          type: 'archive_relationship',
          entity: mutation.entity,
          relationshipKind: mutation.relationshipKind,
          direction: mutation.direction,
        },
        ctx,
        result
      );

    case 'adjust_relationship_strength':
      return prepareAdjustRelationshipStrength(mutation, ctx, result);

    case 'transfer_relationship':
      return prepareTransferRelationship(mutation, ctx, result);

    // =========================================================================
    // ENTITY MUTATIONS
    // =========================================================================

    case 'change_status':
      return prepareChangeStatus(mutation, ctx, result);

    case 'adjust_prominence':
      return prepareAdjustProminence(mutation, ctx, result);

    // =========================================================================
    // PRESSURE MUTATIONS
    // =========================================================================

    case 'modify_pressure':
      return prepareModifyPressure(mutation, result);

    // =========================================================================
    // RATE LIMIT MUTATIONS
    // =========================================================================

    case 'update_rate_limit':
      result.rateLimitUpdated = true;
      result.diagnostic = 'rate limit updated';
      return result;

    // =========================================================================
    // COMPOUND ACTIONS
    // =========================================================================

    case 'for_each_related':
      return prepareForEachRelated(mutation, ctx, result);

    case 'conditional':
      return prepareConditional(mutation, ctx, result);

    default:
      result.applied = false;
      result.diagnostic = `unknown mutation type: ${(mutation as Mutation).type}`;
      return result;
  }
}

/**
 * Apply a prepared mutation result to the graph.
 *
 * @param result - The prepared mutation result
 * @param ctx - The rule context
 */
export function applyMutationResult(result: MutationResult, ctx: RuleContext): void {
  // Apply entity modifications
  for (const mod of result.entityModifications) {
    const entity = ctx.graph.getEntity(mod.id);
    if (!entity) continue;

    if (mod.changes.status !== undefined) {
      ctx.graph.updateEntityStatus(mod.id, mod.changes.status);
    }

    if (mod.changes.prominence !== undefined) {
      ctx.graph.updateEntity(mod.id, { prominence: mod.changes.prominence as HardState['prominence'] });
    }

    if (mod.changes.tags !== undefined) {
      const newTags = applyTagPatch(entity.tags, mod.changes.tags);
      ctx.graph.updateEntity(mod.id, { tags: newTags });
    }
  }

  // Create relationships
  for (const rel of result.relationshipsCreated) {
    ctx.graph.createRelationship(rel.kind, rel.src, rel.dst, rel.strength);
  }

  // Adjust relationships
  for (const rel of result.relationshipsAdjusted) {
    ctx.graph.modifyRelationshipStrength(rel.src, rel.dst, rel.kind, rel.delta);
  }

  // Archive relationships
  for (const rel of result.relationshipsToArchive) {
    ctx.graph.archiveRelationship(rel.src, rel.dst, rel.kind);
  }

  // Apply pressure changes
  for (const [pressureId, delta] of Object.entries(result.pressureChanges)) {
    ctx.graph.modifyPressure(pressureId, delta);
  }

  // Update rate limit state if needed
  if (result.rateLimitUpdated && ctx.graph.rateLimitState) {
    ctx.graph.rateLimitState.lastCreationTick = ctx.tick;
    ctx.graph.rateLimitState.creationsThisEpoch++;
  }
}

/**
 * Prepare and immediately apply a mutation.
 * Convenience wrapper for simple cases.
 *
 * @param mutation - The mutation to apply
 * @param ctx - The rule context
 * @returns MutationResult describing what was done
 */
export function applyMutation(mutation: Mutation, ctx: RuleContext): MutationResult {
  const result = prepareMutation(mutation, ctx);
  if (result.applied) {
    applyMutationResult(result, ctx);
  }
  return result;
}

// =============================================================================
// TAG MUTATION PREPARERS
// =============================================================================

function prepareSetTag(
  mutation: SetTagMutation,
  ctx: RuleContext,
  result: MutationResult
): MutationResult {
  if (!mutation.tag || mutation.tag.trim() === '' || mutation.tag === 'undefined') {
    result.applied = false;
    result.diagnostic = 'set_tag missing tag';
    return result;
  }
  const entity = resolveEntityRef(mutation.entity, ctx);
  if (!entity) {
    // If it's a variable reference that didn't resolve, treat as no-op
    if (mutation.entity.startsWith('$')) {
      result.diagnostic = `skipped set_tag: ${mutation.entity} not resolved`;
      return result;
    }
    result.applied = false;
    result.diagnostic = `entity ${mutation.entity} not found`;
    return result;
  }

  let value: string | boolean;
  if (mutation.valueFrom) {
    const sourceValue = ctx.values?.[mutation.valueFrom];
    if (sourceValue === undefined) {
      result.applied = false;
      result.diagnostic = `value source ${mutation.valueFrom} not found`;
      return result;
    }
    if (typeof sourceValue === 'number') {
      result.applied = false;
      result.diagnostic = `value source ${mutation.valueFrom} is a number, not a valid tag value`;
      return result;
    }
    value = sourceValue;
  } else {
    value = mutation.value ?? true;
  }

  result.entityModifications.push({
    id: entity.id,
    changes: {
      tags: { [mutation.tag]: value },
    },
  });

  result.diagnostic = `set ${mutation.tag}=${value} on ${entity.name}`;
  return result;
}

function prepareRemoveTag(
  mutation: RemoveTagMutation,
  ctx: RuleContext,
  result: MutationResult
): MutationResult {
  const entity = resolveEntityRef(mutation.entity, ctx);
  if (!entity) {
    // If it's a variable reference that didn't resolve, treat as no-op
    if (mutation.entity.startsWith('$')) {
      result.diagnostic = `skipped remove_tag: ${mutation.entity} not resolved`;
      return result;
    }
    result.applied = false;
    result.diagnostic = `entity ${mutation.entity} not found`;
    return result;
  }

  result.entityModifications.push({
    id: entity.id,
    changes: { tags: { [mutation.tag]: undefined } },
  });

  result.diagnostic = `removed ${mutation.tag} from ${entity.name}`;
  return result;
}

// =============================================================================
// RELATIONSHIP MUTATION PREPARERS
// =============================================================================

function prepareCreateRelationship(
  mutation: CreateRelationshipMutation,
  ctx: RuleContext,
  result: MutationResult
): MutationResult {
  const src = resolveEntityRef(mutation.src, ctx);
  const dst = resolveEntityRef(mutation.dst, ctx);

  if (!src) {
    // If it's a variable reference that didn't resolve, treat as no-op
    if (mutation.src.startsWith('$')) {
      result.diagnostic = `skipped create_relationship: ${mutation.src} not resolved`;
      return result;
    }
    result.applied = false;
    result.diagnostic = `source entity ${mutation.src} not found`;
    return result;
  }

  if (!dst) {
    // If it's a variable reference that didn't resolve, treat as no-op
    if (mutation.dst.startsWith('$')) {
      result.diagnostic = `skipped create_relationship: ${mutation.dst} not resolved`;
      return result;
    }
    result.applied = false;
    result.diagnostic = `destination entity ${mutation.dst} not found`;
    return result;
  }

  const strength = mutation.strength ?? 1.0;

  result.relationshipsCreated.push({
    kind: mutation.kind,
    src: src.id,
    dst: dst.id,
    strength,
    category: mutation.category,
  });

  if (mutation.bidirectional) {
    result.relationshipsCreated.push({
      kind: mutation.kind,
      src: dst.id,
      dst: src.id,
      strength,
      category: mutation.category,
    });
  }

  result.diagnostic = `created ${mutation.kind} between ${src.name} and ${dst.name}`;
  return result;
}

function prepareArchiveRelationship(
  mutation: ArchiveRelationshipMutation,
  ctx: RuleContext,
  result: MutationResult
): MutationResult {
  const entity = resolveEntityRef(mutation.entity, ctx);
  if (!entity) {
    // If it's a variable reference that didn't resolve, treat as no-op
    if (mutation.entity.startsWith('$')) {
      result.diagnostic = `skipped archive_relationship: ${mutation.entity} not resolved`;
      return result;
    }
    result.applied = false;
    result.diagnostic = `entity ${mutation.entity} not found`;
    return result;
  }

  const withRef = mutation.with;
  const withEntity = withRef && withRef !== 'any' ? resolveEntityRef(withRef, ctx) : null;
  const direction = normalizeDirection(mutation.direction);

  if (withRef && withRef !== 'any' && !withEntity) {
    // If it's a variable reference that didn't resolve, treat as no-op
    if (withRef.startsWith('$')) {
      result.diagnostic = `skipped archive_relationship: ${withRef} not resolved`;
      return result;
    }
    result.applied = false;
    result.diagnostic = `entity ${withRef} not found for archive_relationship`;
    return result;
  }

  // Collect relationships to archive (deferred execution)
  const rels = ctx.graph.getAllRelationships();

  if (withEntity) {
    // Archive only relationships between entity and withEntity
    for (const rel of rels) {
      if (rel.kind !== mutation.relationshipKind || rel.status === 'historical') continue;

      const isPair =
        (rel.src === entity.id && rel.dst === withEntity.id) ||
        (rel.dst === entity.id && rel.src === withEntity.id);

      if (!isPair) continue;

      const matchesDirection =
        direction === 'both' ||
        (direction === 'src' && rel.src === entity.id) ||
        (direction === 'dst' && rel.dst === entity.id);

      if (!matchesDirection) continue;

      result.relationshipsToArchive.push({
        kind: rel.kind,
        src: rel.src,
        dst: rel.dst,
      });
    }
  } else {
    // Archive all relationships of this kind involving entity
    for (const rel of rels) {
      if (rel.kind !== mutation.relationshipKind || rel.status === 'historical') continue;

      const matchesDirection =
        direction === 'both' ||
        (direction === 'src' && rel.src === entity.id) ||
        (direction === 'dst' && rel.dst === entity.id);

      if (!matchesDirection) continue;

      // Check if entity is involved
      if (rel.src !== entity.id && rel.dst !== entity.id) continue;

      result.relationshipsToArchive.push({
        kind: rel.kind,
        src: rel.src,
        dst: rel.dst,
      });
    }
  }

  result.diagnostic = `archived ${result.relationshipsToArchive.length} ${mutation.relationshipKind} relationships`;
  return result;
}

function prepareAdjustRelationshipStrength(
  mutation: AdjustRelationshipStrengthMutation,
  ctx: RuleContext,
  result: MutationResult
): MutationResult {
  const src = resolveEntityRef(mutation.src, ctx);
  const dst = resolveEntityRef(mutation.dst, ctx);

  if (!src || !dst) {
    // If either is a variable reference that didn't resolve, treat as no-op
    if ((!src && mutation.src.startsWith('$')) || (!dst && mutation.dst.startsWith('$'))) {
      result.diagnostic = `skipped adjust_relationship_strength: endpoint not resolved`;
      return result;
    }
    result.applied = false;
    result.diagnostic = `relationship endpoints not found (${mutation.src} -> ${mutation.dst})`;
    return result;
  }

  const pushChange = (srcId: string, dstId: string) => {
    result.relationshipsAdjusted.push({
      kind: mutation.kind,
      src: srcId,
      dst: dstId,
      delta: mutation.delta,
    });
  };

  pushChange(src.id, dst.id);
  if (mutation.bidirectional) {
    pushChange(dst.id, src.id);
  }

  result.diagnostic = `adjusted ${mutation.kind} by ${mutation.delta}`;
  return result;
}

// =============================================================================
// ENTITY MUTATION PREPARERS
// =============================================================================

function prepareChangeStatus(
  mutation: ChangeStatusMutation,
  ctx: RuleContext,
  result: MutationResult
): MutationResult {
  const entity = resolveEntityRef(mutation.entity, ctx);
  if (!entity) {
    // If it's a variable reference that didn't resolve, treat as no-op
    if (mutation.entity.startsWith('$')) {
      result.diagnostic = `skipped change_status: ${mutation.entity} not resolved`;
      return result;
    }
    result.applied = false;
    result.diagnostic = `entity ${mutation.entity} not found`;
    return result;
  }

  result.entityModifications.push({
    id: entity.id,
    changes: { status: mutation.newStatus },
  });

  result.diagnostic = `changed ${entity.name} status to ${mutation.newStatus}`;
  return result;
}

function prepareAdjustProminence(
  mutation: AdjustProminenceMutation,
  ctx: RuleContext,
  result: MutationResult
): MutationResult {
  const entity = resolveEntityRef(mutation.entity, ctx);
  if (!entity) {
    // If it's a variable reference that didn't resolve, treat as no-op
    if (mutation.entity.startsWith('$')) {
      result.diagnostic = `skipped adjust_prominence: ${mutation.entity} not resolved`;
      return result;
    }
    result.applied = false;
    result.diagnostic = `entity ${mutation.entity} not found`;
    return result;
  }

  if (hasTag(entity.tags, FRAMEWORK_TAGS.PROMINENCE_LOCKED)) {
    result.diagnostic = `${entity.name} prominence locked`;
    return result;
  }

  const currentValue = entity.prominence;
  const newValue = clampProminence(currentValue + mutation.delta);
  const oldLabel = prominenceLabel(currentValue);
  const newLabel = prominenceLabel(newValue);

  if (newValue !== currentValue) {
    result.entityModifications.push({
      id: entity.id,
      changes: { prominence: newValue },
    });

    const levelChange = oldLabel !== newLabel ? ` (now ${newLabel})` : '';
    const deltaStr = mutation.delta > 0 ? `+${mutation.delta.toFixed(2)}` : mutation.delta.toFixed(2);
    result.diagnostic = `adjusted ${entity.name} prominence by ${deltaStr}${levelChange}`;
  } else {
    result.diagnostic = `${entity.name} prominence at ${mutation.delta > 0 ? 'maximum' : 'minimum'}`;
  }

  return result;
}

// =============================================================================
// PRESSURE MUTATION PREPARERS
// =============================================================================

function prepareModifyPressure(
  mutation: ModifyPressureMutation,
  result: MutationResult
): MutationResult {
  result.pressureChanges[mutation.pressureId] = mutation.delta;
  result.diagnostic = `pressure ${mutation.pressureId} ${mutation.delta >= 0 ? '+' : ''}${mutation.delta}`;
  return result;
}

// =============================================================================
// TRANSFER RELATIONSHIP PREPARER
// =============================================================================

function prepareTransferRelationship(
  mutation: TransferRelationshipMutation,
  ctx: RuleContext,
  result: MutationResult
): MutationResult {
  const entity = resolveEntityRef(mutation.entity, ctx);
  const from = resolveEntityRef(mutation.from, ctx);
  const to = resolveEntityRef(mutation.to, ctx);

  if (!entity) {
    // If it's a variable reference that didn't resolve, treat as no-op
    if (mutation.entity.startsWith('$')) {
      result.diagnostic = `skipped transfer_relationship: ${mutation.entity} not resolved`;
      return result;
    }
    result.applied = false;
    result.diagnostic = `entity ${mutation.entity} not found`;
    return result;
  }

  if (!from) {
    // If it's a variable reference that didn't resolve, treat as no-op
    if (mutation.from.startsWith('$')) {
      result.diagnostic = `skipped transfer_relationship: ${mutation.from} not resolved`;
      return result;
    }
    result.applied = false;
    result.diagnostic = `from entity ${mutation.from} not found`;
    return result;
  }

  if (!to) {
    // If it's a variable reference that didn't resolve, treat as no-op
    if (mutation.to.startsWith('$')) {
      result.diagnostic = `skipped transfer_relationship: ${mutation.to} not resolved`;
      return result;
    }
    result.applied = false;
    result.diagnostic = `to entity ${mutation.to} not found`;
    return result;
  }

  // Check condition if present
  if (mutation.condition) {
    const conditionMet = evaluateCondition(mutation.condition, ctx);
    if (!conditionMet) {
      result.diagnostic = `transfer_relationship condition not met`;
      return result;
    }
  }

  // Archive the old relationship (deferred)
  const rels = ctx.graph.getAllRelationships();
  let foundOld = false;
  for (const rel of rels) {
    if (
      rel.kind === mutation.relationshipKind &&
      rel.status !== 'historical' &&
      ((rel.src === entity.id && rel.dst === from.id) ||
        (rel.src === from.id && rel.dst === entity.id))
    ) {
      result.relationshipsToArchive.push({
        kind: rel.kind,
        src: rel.src,
        dst: rel.dst,
      });
      foundOld = true;
      break;
    }
  }

  // Create the new relationship
  result.relationshipsCreated.push({
    kind: mutation.relationshipKind,
    src: entity.id,
    dst: to.id,
    strength: 0.8, // Default strength for transferred relationships
  });

  result.diagnostic = foundOld
    ? `transferred ${mutation.relationshipKind} from ${from.name} to ${to.name}`
    : `created ${mutation.relationshipKind} to ${to.name} (no previous relationship found)`;
  return result;
}

// =============================================================================
// COMPOUND ACTION PREPARERS
// =============================================================================

function prepareForEachRelated(
  mutation: ForEachRelatedAction,
  ctx: RuleContext,
  result: MutationResult
): MutationResult {
  const self = ctx.self;
  if (!self) {
    result.applied = false;
    result.diagnostic = 'for_each_related requires $self context';
    return result;
  }

  // Find related entities
  const direction = normalizeDirection(mutation.direction);
  const relationships = ctx.graph.getAllRelationships().filter((rel) => {
    if (rel.kind !== mutation.relationship || rel.status === 'historical') return false;

    // Check direction
    if (direction === 'src' && rel.src !== self.id) return false;
    if (direction === 'dst' && rel.dst !== self.id) return false;
    if (direction === 'both' && rel.src !== self.id && rel.dst !== self.id) return false;

    return true;
  });

  // Get related entity IDs
  const relatedIds = new Set<string>();
  for (const rel of relationships) {
    const relatedId = rel.src === self.id ? rel.dst : rel.src;
    relatedIds.add(relatedId);
  }

  // Filter by kind/subtype if specified
  const relatedEntities: HardState[] = [];
  for (const id of relatedIds) {
    const entity = ctx.graph.getEntity(id);
    if (!entity) continue;
    if (mutation.targetKind && entity.kind !== mutation.targetKind) continue;
    if (mutation.targetSubtype && entity.subtype !== mutation.targetSubtype) continue;
    relatedEntities.push(entity);
  }

  // Execute actions for each related entity
  const diagnostics: string[] = [];
  for (const related of relatedEntities) {
    // Create a new context with $related bound
    const nestedCtx: RuleContext = {
      ...ctx,
      entities: {
        ...ctx.entities,
        related: related,
      },
    };

    // Execute each action
    for (const action of mutation.actions) {
      const actionResult = prepareMutation(action, nestedCtx);
      if (actionResult.applied) {
        // Merge results
        result.entityModifications.push(...actionResult.entityModifications);
        result.relationshipsCreated.push(...actionResult.relationshipsCreated);
        result.relationshipsAdjusted.push(...actionResult.relationshipsAdjusted);
        result.relationshipsToArchive.push(...actionResult.relationshipsToArchive);
        for (const [k, v] of Object.entries(actionResult.pressureChanges)) {
          result.pressureChanges[k] = (result.pressureChanges[k] || 0) + v;
        }
        if (actionResult.rateLimitUpdated) result.rateLimitUpdated = true;
      }
      diagnostics.push(actionResult.diagnostic);
    }
  }

  result.diagnostic = `for_each_related: processed ${relatedEntities.length} entities. ${diagnostics.join('; ')}`;
  return result;
}

function prepareConditional(
  mutation: ConditionalAction,
  ctx: RuleContext,
  result: MutationResult
): MutationResult {
  const conditionResult = evaluateCondition(mutation.condition, ctx);
  const actionsToExecute = conditionResult.passed ? mutation.thenActions : mutation.elseActions || [];

  const diagnostics: string[] = [];
  for (const action of actionsToExecute) {
    const actionResult = prepareMutation(action, ctx);
    if (actionResult.applied) {
      // Merge results
      result.entityModifications.push(...actionResult.entityModifications);
      result.relationshipsCreated.push(...actionResult.relationshipsCreated);
      result.relationshipsAdjusted.push(...actionResult.relationshipsAdjusted);
      result.relationshipsToArchive.push(...actionResult.relationshipsToArchive);
      for (const [k, v] of Object.entries(actionResult.pressureChanges)) {
        result.pressureChanges[k] = (result.pressureChanges[k] || 0) + v;
      }
      if (actionResult.rateLimitUpdated) result.rateLimitUpdated = true;
    }
    diagnostics.push(actionResult.diagnostic);
  }

  result.diagnostic = `conditional (${conditionResult.passed ? 'then' : 'else'}): ${diagnostics.join('; ')}`;
  return result;
}
