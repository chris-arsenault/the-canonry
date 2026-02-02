/**
 * Narrative Event Builder
 *
 * Creates NarrativeEvent objects from state changes during simulation.
 * Used to capture semantically meaningful world changes for story generation.
 */

import type {
  NarrativeEntityRef,
  EntityEffect,
  SemanticEffectKind,
  ParticipantEffect,
  Polarity,
} from '@canonry/world-schema';
import type { HardState } from '../core/worldTypes.js';
import { prominenceLabel } from '../rules/types.js';
import { getProminenceValue } from './significanceCalculator.js';

// Input types for mutation data passed to buildParticipantEffects
export interface EntityCreatedInput {
  entityId: string;
  kind: string;
  subtype: string;
  name: string;
}

export interface RelationshipCreatedInput {
  srcId: string;
  dstId: string;
  kind: string;
}

export interface RelationshipArchivedInput {
  srcId: string;
  dstId: string;
  kind: string;
}

export interface TagChangeInput {
  entityId: string;
  tag: string;
  value?: string | boolean;
}

export interface FieldChangeInput {
  entityId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface NarrativeContext {
  tick: number;
  eraId: string;
  getEntity: (id: string) => HardState | undefined;
  getEntityRelationships: (id: string) => { kind: string; src: string; dst: string }[];
  /** Get polarity for a relationship kind from schema */
  getRelationshipPolarity?: (kind: string) => Polarity | undefined;
  /** Get polarity for a status from schema */
  getStatusPolarity?: (entityKind: string, status: string) => Polarity | undefined;
  /** Get configured verb for relationship formation (from schema or default) */
  getRelationshipVerb?: (kind: string, action: 'formed' | 'ended' | 'inverseFormed' | 'inverseEnded') => string | undefined;
}

/**
 * Builder for creating narrative events from simulation state changes
 */
export class NarrativeEventBuilder {
  private context: NarrativeContext;

  constructor(context: NarrativeContext) {
    this.context = context;
  }

  /**
   * Update context (call at start of each tick)
   */
  updateContext(context: NarrativeContext): void {
    this.context = context;
  }

  /**
   * Build entity reference from HardState
   */
  private buildEntityRef(entity: HardState): NarrativeEntityRef {
    return {
      id: entity.id,
      name: entity.name,
      kind: entity.kind,
      subtype: entity.subtype,
    };
  }

  // ===========================================================================
  // PARTICIPANT EFFECTS BUILDER
  // ===========================================================================

  /**
   * Build ParticipantEffect[] from mutation data.
   * Groups all effects by entity and generates natural language descriptions.
   * This is the core method used by all event builders.
   */
  buildParticipantEffects(
    entitiesCreated: EntityCreatedInput[],
    relationshipsCreated: RelationshipCreatedInput[],
    relationshipsArchived: RelationshipArchivedInput[],
    tagsAdded: TagChangeInput[],
    tagsRemoved: TagChangeInput[],
    fieldsChanged: FieldChangeInput[]
  ): ParticipantEffect[] {
    // Group effects by entity ID
    const effectsByEntity = new Map<string, EntityEffect[]>();

    const addEffect = (entityId: string, effect: EntityEffect) => {
      if (!effectsByEntity.has(entityId)) {
        effectsByEntity.set(entityId, []);
      }
      effectsByEntity.get(entityId)!.push(effect);
    };

    // Process entity creations
    for (const created of entitiesCreated) {
      addEffect(created.entityId, {
        type: 'created',
        description: this.getCreationVerb(created.kind),
      });
    }

    // Process relationship formations
    for (const rel of relationshipsCreated) {
      const srcEntity = this.context.getEntity(rel.srcId);
      const dstEntity = this.context.getEntity(rel.dstId);
      const srcRef: NarrativeEntityRef = srcEntity
        ? this.buildEntityRef(srcEntity)
        : { id: rel.srcId, name: rel.srcId, kind: 'unknown', subtype: 'unknown' };
      const dstRef: NarrativeEntityRef = dstEntity
        ? this.buildEntityRef(dstEntity)
        : { id: rel.dstId, name: rel.dstId, kind: 'unknown', subtype: 'unknown' };

      // Derive semantic kind from relationship polarity
      const polarity = this.context.getRelationshipPolarity?.(rel.kind);
      const semanticKind = this.deriveRelationshipSemanticKind(polarity, 'formed');

      // Use schema verb if available, otherwise fall back to default
      const schemaVerb = this.context.getRelationshipVerb?.(rel.kind, 'formed');
      const description = schemaVerb
        ? `${schemaVerb} ${dstRef.name}`
        : this.getRelationshipFormedVerb(rel.kind, dstRef.name);

      // Add effect for source entity
      addEffect(rel.srcId, {
        type: 'relationship_formed',
        relationshipKind: rel.kind,
        relatedEntity: dstRef,
        semanticKind,
        description,
      });

      // Add effect for destination entity (inverse perspective)
      const inverseSchemaVerb = this.context.getRelationshipVerb?.(rel.kind, 'inverseFormed');
      const inverseDescription = inverseSchemaVerb
        ? `${inverseSchemaVerb} ${srcRef.name}`
        : this.getRelationshipFormedInverseVerb(rel.kind, srcRef.name);

      addEffect(rel.dstId, {
        type: 'relationship_formed',
        relationshipKind: rel.kind,
        relatedEntity: srcRef,
        semanticKind,
        description: inverseDescription,
      });
    }

    // Process relationship dissolutions
    for (const rel of relationshipsArchived) {
      const srcEntity = this.context.getEntity(rel.srcId);
      const dstEntity = this.context.getEntity(rel.dstId);
      const srcRef: NarrativeEntityRef = srcEntity
        ? this.buildEntityRef(srcEntity)
        : { id: rel.srcId, name: rel.srcId, kind: 'unknown', subtype: 'unknown' };
      const dstRef: NarrativeEntityRef = dstEntity
        ? this.buildEntityRef(dstEntity)
        : { id: rel.dstId, name: rel.dstId, kind: 'unknown', subtype: 'unknown' };

      // Derive semantic kind from relationship polarity
      const polarity = this.context.getRelationshipPolarity?.(rel.kind);
      const semanticKind = this.deriveRelationshipSemanticKind(polarity, 'ended');

      // Use schema verb if available, otherwise fall back to default
      const schemaVerb = this.context.getRelationshipVerb?.(rel.kind, 'ended');
      const description = schemaVerb
        ? `${schemaVerb} ${dstRef.name}`
        : this.getRelationshipEndedVerb(rel.kind, dstRef.name);

      // Add effect for source entity
      addEffect(rel.srcId, {
        type: 'relationship_ended',
        relationshipKind: rel.kind,
        relatedEntity: dstRef,
        semanticKind,
        description,
      });

      // Add effect for destination entity (inverse perspective)
      const inverseSchemaVerb = this.context.getRelationshipVerb?.(rel.kind, 'inverseEnded');
      const inverseDescription = inverseSchemaVerb
        ? `${inverseSchemaVerb} ${srcRef.name}`
        : this.getRelationshipEndedInverseVerb(rel.kind, srcRef.name);

      addEffect(rel.dstId, {
        type: 'relationship_ended',
        relationshipKind: rel.kind,
        relatedEntity: srcRef,
        semanticKind,
        description: inverseDescription,
      });
    }

    // Process tag additions
    for (const tag of tagsAdded) {
      addEffect(tag.entityId, {
        type: 'tag_gained',
        tag: tag.tag,
        description: this.getTagGainedVerb(tag.tag),
      });
    }

    // Process tag removals
    for (const tag of tagsRemoved) {
      addEffect(tag.entityId, {
        type: 'tag_lost',
        tag: tag.tag,
        description: this.getTagLostVerb(tag.tag),
      });
    }

    // Process field changes
    for (const field of fieldsChanged) {
      // Check if this is an "ended" status change
      if (field.field === 'status' && (field.newValue === 'historical' || field.newValue === 'dissolved')) {
        addEffect(field.entityId, {
          type: 'ended',
          field: field.field,
          previousValue: field.oldValue,
          newValue: field.newValue,
          description: field.newValue === 'historical' ? 'passed into history' : 'dissolved',
        });
      } else if (field.field === 'status') {
        // For other status changes, derive semantic kind from polarity
        const entity = this.context.getEntity(field.entityId);
        const entityKind = entity?.kind || 'unknown';
        const newPolarity = this.context.getStatusPolarity?.(entityKind, String(field.newValue));
        const oldPolarity = this.context.getStatusPolarity?.(entityKind, String(field.oldValue));
        const semanticKind = this.deriveStatusSemanticKind(oldPolarity, newPolarity);

        addEffect(field.entityId, {
          type: 'field_changed',
          field: field.field,
          previousValue: field.oldValue,
          newValue: field.newValue,
          semanticKind,
          description: this.getFieldChangedVerb(field.field, field.oldValue, field.newValue),
        });
      } else {
        addEffect(field.entityId, {
          type: 'field_changed',
          field: field.field,
          previousValue: field.oldValue,
          newValue: field.newValue,
          description: this.getFieldChangedVerb(field.field, field.oldValue, field.newValue),
        });
      }
    }

    // Build ParticipantEffect[] from grouped effects
    const result: ParticipantEffect[] = [];
    for (const [entityId, effects] of effectsByEntity) {
      const entity = this.context.getEntity(entityId);
      if (entity) {
        result.push({
          entity: this.buildEntityRef(entity),
          effects,
        });
      } else {
        // Entity might be from created list but not yet in graph
        const createdEntity = entitiesCreated.find(e => e.entityId === entityId);
        if (createdEntity) {
          result.push({
            entity: {
              id: entityId,
              name: createdEntity.name,
              kind: createdEntity.kind,
              subtype: createdEntity.subtype,
            },
            effects,
          });
        }
      }
    }

    return result;
  }

  // ===========================================================================
  // SEMANTIC KIND DERIVATION
  // ===========================================================================

  /**
   * Derive semantic kind for relationship effects based on polarity.
   * - Positive relationship formed → alliance
   * - Negative relationship formed → rivalry
   * - Positive relationship ended → betrayal
   * - Negative relationship ended → reconciliation
   */
  private deriveRelationshipSemanticKind(
    polarity: Polarity | undefined,
    action: 'formed' | 'ended'
  ): SemanticEffectKind | undefined {
    if (!polarity || polarity === 'neutral') return undefined;

    if (action === 'formed') {
      return polarity === 'positive' ? 'alliance' : 'rivalry';
    } else {
      return polarity === 'positive' ? 'betrayal' : 'reconciliation';
    }
  }

  /**
   * Derive semantic kind for status changes based on polarity transition.
   * - Transition to positive polarity → triumph
   * - Transition to negative polarity → downfall
   */
  private deriveStatusSemanticKind(
    oldPolarity: Polarity | undefined,
    newPolarity: Polarity | undefined
  ): SemanticEffectKind | undefined {
    // Only meaningful if polarities differ
    if (oldPolarity === newPolarity) return undefined;
    if (!newPolarity || newPolarity === 'neutral') return undefined;

    // Transition to positive = triumph, to negative = downfall
    if (newPolarity === 'positive') return 'triumph';
    if (newPolarity === 'negative') return 'downfall';

    return undefined;
  }

  // ===========================================================================
  // VERB MAPPINGS FOR EFFECT DESCRIPTIONS
  // ===========================================================================

  /**
   * Get creation verb based on entity kind.
   * TODO: Domain-specific verbs should be in domain config.
   */
  private getCreationVerb(kind: string): string {
    const verbs: Record<string, string> = {
      location: 'was founded',
      npc: 'emerged',
      faction: 'was formed',
      artifact: 'was created',
      occurrence: 'began',
      era: 'dawned',
      rules: 'was established',
    };
    return verbs[kind] || 'was created';
  }

  /**
   * Get verb for relationship formation.
   * TODO: Domain-specific verbs should be in domain config.
   */
  private getRelationshipFormedVerb(kind: string, targetName: string): string {
    const verbs: Record<string, string> = {
      // Framework relationships
      'allied_with': `allied with ${targetName}`,
      'ally_of': `allied with ${targetName}`,
      'at_war_with': `declared war on ${targetName}`,
      'enemy_of': `became enemies with ${targetName}`,
      'friend_of': `befriended ${targetName}`,
      'member_of': `joined ${targetName}`,
      'serves': `began serving ${targetName}`,
      'rules': `began ruling ${targetName}`,
      'trades_with': `began trading with ${targetName}`,
      'part_of': `became part of ${targetName}`,
      'located_at': `moved to ${targetName}`,
      'resident_of': `moved to ${targetName}`,
      'owns': `acquired ${targetName}`,
      'possesses': `obtained ${targetName}`,
      'rivals': `became rivals with ${targetName}`,
      'mentors': `began mentoring ${targetName}`,
      'active_during': `became active during ${targetName}`,
      'supersedes': `superseded ${targetName}`,
      'created_during': `was created during ${targetName}`,
      'originated_in': `originated in ${targetName}`,
      'controls': `gained control of ${targetName}`,
      'adjacent_to': `became adjacent to ${targetName}`,
      'related_to': `became related to ${targetName}`,
      'stored_at': `was stored at ${targetName}`,
      'central_to': `became central to ${targetName}`,
      // Domain-specific (TODO: extract to domain config)
      'corrupted_by': `was corrupted by ${targetName}`,
      'manifests_at': `manifested at ${targetName}`,
      'worships': `began worshipping ${targetName}`,
      'practitioner_of': `became a practitioner of ${targetName}`,
      'believer_of': `started believing in ${targetName}`,
      'patron_of': `became patron of ${targetName}`,
      'blessed_by': `was blessed by ${targetName}`,
      'cursed_by': `was cursed by ${targetName}`,
      'trained_by': `began training under ${targetName}`,
      'apprentice_of': `became apprentice of ${targetName}`,
      'disciple_of': `became disciple of ${targetName}`,
      'bound_to': `became bound to ${targetName}`,
      'inhabits': `began inhabiting ${targetName}`,
      'haunts': `began haunting ${targetName}`,
      'guards': `began guarding ${targetName}`,
      'protects': `began protecting ${targetName}`,
    };
    return verbs[kind] || `formed ${kind} with ${targetName}`;
  }

  /**
   * Get verb for relationship dissolution.
   * TODO: Domain-specific verbs should be in domain config.
   */
  private getRelationshipEndedVerb(kind: string, targetName: string): string {
    const verbs: Record<string, string> = {
      'allied_with': `broke alliance with ${targetName}`,
      'ally_of': `broke alliance with ${targetName}`,
      'at_war_with': `made peace with ${targetName}`,
      'enemy_of': `reconciled with ${targetName}`,
      'friend_of': `ended friendship with ${targetName}`,
      'member_of': `left ${targetName}`,
      'serves': `stopped serving ${targetName}`,
      'rules': `stopped ruling ${targetName}`,
      'trades_with': `stopped trading with ${targetName}`,
      'part_of': `separated from ${targetName}`,
      'located_at': `left ${targetName}`,
      'resident_of': `left ${targetName}`,
      'owns': `lost ownership of ${targetName}`,
      'possesses': `lost ${targetName}`,
      'rivals': `ended rivalry with ${targetName}`,
      'mentors': `stopped mentoring ${targetName}`,
      // Domain-specific (TODO: extract to domain config)
      'corrupted_by': `was cleansed of corruption from ${targetName}`,
      'manifests_at': `departed from ${targetName}`,
      'worships': `abandoned worship of ${targetName}`,
      'practitioner_of': `abandoned the practice of ${targetName}`,
      'believer_of': `stopped believing in ${targetName}`,
      'patron_of': `ceased patronage of ${targetName}`,
      'blessed_by': `lost the blessing of ${targetName}`,
      'cursed_by': `was freed from the curse of ${targetName}`,
      'bound_to': `was freed from ${targetName}`,
    };
    return verbs[kind] || `ended ${kind} with ${targetName}`;
  }

  /**
   * Get inverse verb for relationship formation (from destination's perspective).
   * Used when the source forms a relationship with the destination.
   * TODO: Domain-specific verbs should be in domain config.
   */
  private getRelationshipFormedInverseVerb(kind: string, sourceName: string): string {
    const verbs: Record<string, string> = {
      // Framework relationships - destination perspective
      'allied_with': `allied with ${sourceName}`,
      'ally_of': `gained ${sourceName} as ally`,
      'at_war_with': `was attacked by ${sourceName}`,
      'enemy_of': `became enemies with ${sourceName}`,
      'friend_of': `befriended ${sourceName}`,
      'member_of': `gained ${sourceName} as member`,
      'serves': `gained ${sourceName} as servant`,
      'rules': `came under rule of ${sourceName}`,
      'trades_with': `began trading with ${sourceName}`,
      'part_of': `incorporated ${sourceName}`,
      'located_at': `received ${sourceName}`,
      'resident_of': `gained ${sourceName} as resident`,
      'owns': `was acquired by ${sourceName}`,
      'possesses': `was obtained by ${sourceName}`,
      'rivals': `became rivals with ${sourceName}`,
      'mentors': `became mentored by ${sourceName}`,
      'active_during': `saw ${sourceName} become active`,
      'supersedes': `was superseded by ${sourceName}`,
      'created_during': `witnessed creation of ${sourceName}`,
      'originated_in': `gave rise to ${sourceName}`,
      'controls': `came under control of ${sourceName}`,
      'adjacent_to': `became adjacent to ${sourceName}`,
      'related_to': `became related to ${sourceName}`,
      'stored_at': `began storing ${sourceName}`,
      'central_to': `gained ${sourceName} as central element`,
      // Domain-specific (TODO: extract to domain config)
      'corrupted_by': `corrupted ${sourceName}`,
      'manifests_at': `became site of ${sourceName}'s manifestation`,
      'worships': `gained ${sourceName} as worshipper`,
      'practitioner_of': `gained ${sourceName} as practitioner`,
      'believer_of': `gained ${sourceName} as believer`,
      'patron_of': `gained ${sourceName} as patron`,
      'blessed_by': `blessed ${sourceName}`,
      'cursed_by': `cursed ${sourceName}`,
      'trained_by': `began training ${sourceName}`,
      'apprentice_of': `gained ${sourceName} as apprentice`,
      'disciple_of': `gained ${sourceName} as disciple`,
      'bound_to': `bound ${sourceName}`,
      'inhabits': `became inhabited by ${sourceName}`,
      'haunts': `became haunted by ${sourceName}`,
      'guards': `became guarded by ${sourceName}`,
      'protects': `became protected by ${sourceName}`,
      'leader_of': `gained ${sourceName} as leader`,
      'owned_by': `acquired ${sourceName}`,
      'derived_from': `inspired ${sourceName}`,
      'participant_in': `gained ${sourceName} as participant`,
      'epicenter_of': `gained ${sourceName} as epicenter`,
      'triggered_by': `triggered ${sourceName}`,
      'commemorates': `was commemorated by ${sourceName}`,
    };
    return verbs[kind] || `gained ${sourceName} via ${kind}`;
  }

  /**
   * Get inverse verb for relationship dissolution (from destination's perspective).
   * Used when the source ends a relationship with the destination.
   * TODO: Domain-specific verbs should be in domain config.
   */
  private getRelationshipEndedInverseVerb(kind: string, sourceName: string): string {
    const verbs: Record<string, string> = {
      'allied_with': `lost ${sourceName} as ally`,
      'ally_of': `lost ${sourceName} as ally`,
      'at_war_with': `made peace with ${sourceName}`,
      'enemy_of': `reconciled with ${sourceName}`,
      'friend_of': `ended friendship with ${sourceName}`,
      'member_of': `lost ${sourceName} as member`,
      'serves': `lost ${sourceName} as servant`,
      'rules': `was freed from rule of ${sourceName}`,
      'trades_with': `stopped trading with ${sourceName}`,
      'part_of': `released ${sourceName}`,
      'located_at': `lost ${sourceName}`,
      'resident_of': `lost ${sourceName} as resident`,
      'owns': `was released by ${sourceName}`,
      'possesses': `was released by ${sourceName}`,
      'rivals': `ended rivalry with ${sourceName}`,
      'mentors': `was no longer mentored by ${sourceName}`,
      // Domain-specific (TODO: extract to domain config)
      'corrupted_by': `stopped corrupting ${sourceName}`,
      'manifests_at': `lost ${sourceName}'s manifestation`,
      'worships': `lost ${sourceName} as worshipper`,
      'practitioner_of': `lost ${sourceName} as practitioner`,
      'believer_of': `lost ${sourceName} as believer`,
      'patron_of': `lost ${sourceName} as patron`,
      'blessed_by': `withdrew blessing from ${sourceName}`,
      'cursed_by': `lifted curse from ${sourceName}`,
      'bound_to': `released ${sourceName}`,
      'leader_of': `lost ${sourceName} as leader`,
      'owned_by': `released ${sourceName}`,
      'derived_from': `no longer inspires ${sourceName}`,
      'participant_in': `lost ${sourceName} as participant`,
    };
    return verbs[kind] || `lost ${sourceName} via ${kind}`;
  }

  /**
   * Get verb for tag gained.
   */
  private getTagGainedVerb(tag: string): string {
    const verbs: Record<string, string> = {
      'wounded': 'was wounded',
      'maimed': 'was maimed',
      'corrupted': 'became corrupted',
      'legendary': 'became legendary',
      'hostile': 'turned hostile',
      'leader': 'rose to leadership',
      'war_leader': 'became a war leader',
      'armed_raider': 'took up arms',
      'crisis': 'entered crisis',
      'discovered': 'was discovered',
      'thriving': 'began thriving',
      'stressed': 'became stressed',
      'dangerous': 'became dangerous',
      'friendly': 'became friendly',
      'organized': 'became organized',
      'devout': 'became devout',
    };
    return verbs[tag] || `gained ${tag.replace(/_/g, ' ')}`;
  }

  /**
   * Get verb for tag lost.
   */
  private getTagLostVerb(tag: string): string {
    const verbs: Record<string, string> = {
      'wounded': 'recovered from wounds',
      'maimed': 'healed from injuries',
      'corrupted': 'was purified',
      'legendary': 'had their legend fade',
      'hostile': 'became peaceful',
      'leader': 'stepped down from leadership',
      'war_leader': 'is no longer a war leader',
      'armed_raider': 'disarmed',
      'crisis': 'emerged from crisis',
      'discovered': 'was forgotten',
    };
    return verbs[tag] || `lost ${tag.replace(/_/g, ' ')}`;
  }

  /**
   * Get verb for field change.
   */
  private getFieldChangedVerb(field: string, oldValue: unknown, newValue: unknown): string {
    if (field === 'prominence') {
      const oldVal = getProminenceValue(oldValue as string | number);
      const newVal = getProminenceValue(newValue as string | number);
      // Get labels for both old and new values
      const oldLabel = typeof oldValue === 'number' ? prominenceLabel(oldValue) : oldValue;
      const newLabel = typeof newValue === 'number' ? prominenceLabel(newValue) : newValue;

      // Check if tier (label) changed
      const tierChanged = oldLabel !== newLabel;

      if (tierChanged) {
        // Tier changed - use "rose to" / "fell to"
        if (newVal > oldVal) {
          return `rose to ${newLabel} prominence`;
        } else {
          return `fell to ${newLabel} prominence`;
        }
      } else {
        // Same tier - describe incremental change with neutral phrasing
        if (newVal > oldVal) {
          return `gained prominence (still ${newLabel})`;
        } else {
          return `lost prominence (still ${newLabel})`;
        }
      }
    }
    if (field === 'status') {
      return `changed status from ${oldValue} to ${newValue}`;
    }
    return `changed ${field} from ${oldValue} to ${newValue}`;
  }

}
