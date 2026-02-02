/**
 * Semantic Enricher
 *
 * Post-processes narrative events to detect complex patterns and upgrade
 * eventKind based on aggregate analysis. This layer adds higher-level
 * semantic interpretation that requires looking across multiple effects
 * or comparing against world state.
 *
 * Detected patterns:
 * - War: Connected component of entities with negative relationships
 * - Coalescence: Multiple entities joining same container via part_of
 * - Power Vacuum: Authority entity ended with no clear successor
 * - Succession: Container entity ended, members must reorganize
 */

import type {
  NarrativeEvent,
  NarrativeEventKind,
  ParticipantEffect,
  EntityEffect,
  SemanticEffectKind,
} from '@canonry/world-schema';
import type { HardState } from '../core/worldTypes.js';
import type { Graph } from '../engine/types.js';

/**
 * Context needed for semantic enrichment
 */
export interface EnrichmentContext {
  /** Get entity by ID */
  getEntity: (id: string) => HardState | undefined;
  /** Get all active relationships for an entity */
  getEntityRelationships: (id: string) => Array<{ kind: string; src: string; dst: string }>;
  /** Check if a relationship kind has negative polarity */
  isNegativeRelationship: (kind: string) => boolean;
  /** Check if a subtype is an authority type */
  isAuthoritySubtype: (subtype: string) => boolean;
  /** Get inbound part_of relationships for an entity */
  getPartOfMembers: (entityId: string) => string[];
}

/**
 * Semantic Enricher post-processes events to detect complex narrative patterns
 */
export class SemanticEnricher {
  private context: EnrichmentContext;

  constructor(context: EnrichmentContext) {
    this.context = context;
  }

  /**
   * Update context (call when graph state changes)
   */
  updateContext(context: EnrichmentContext): void {
    this.context = context;
  }

  /**
   * Enrich a batch of events from the same tick.
   * Analyzes patterns across events and upgrades eventKind where appropriate.
   */
  enrichEvents(events: NarrativeEvent[]): NarrativeEvent[] {
    const enriched: NarrativeEvent[] = [];

    for (const event of events) {
      const upgraded = this.enrichEvent(event, events);
      enriched.push(upgraded);
    }

    // Detect multi-event patterns (war, coalescence)
    const warEvents = this.detectWarPatterns(enriched);
    const coalescenceEvents = this.detectCoalescencePatterns(enriched);

    // Merge pattern events (these may replace or supplement existing events)
    return this.mergePatternEvents(enriched, warEvents, coalescenceEvents);
  }

  /**
   * Enrich a single event based on its effects
   */
  private enrichEvent(event: NarrativeEvent, allEvents: NarrativeEvent[]): NarrativeEvent {
    if (!event.participantEffects || event.participantEffects.length === 0) {
      return event;
    }

    // Check for power vacuum pattern
    const powerVacuumKind = this.detectPowerVacuum(event);
    if (powerVacuumKind) {
      return {
        ...event,
        eventKind: 'power_vacuum',
        narrativeTags: [...event.narrativeTags, 'power_vacuum', 'leadership'],
      };
    }

    // Check for succession pattern
    const successionKind = this.detectSuccession(event);
    if (successionKind) {
      return {
        ...event,
        eventKind: 'succession',
        narrativeTags: [...event.narrativeTags, 'succession', 'reorganization'],
      };
    }

    // Check for leadership established pattern
    const leadershipKind = this.detectLeadershipEstablished(event);
    if (leadershipKind) {
      return {
        ...event,
        eventKind: 'leadership_established',
        narrativeTags: [...event.narrativeTags, 'leadership'],
      };
    }

    // Upgrade eventKind based on dominant semantic effects
    const upgradedKind = this.deriveEventKindFromEffects(event);
    if (upgradedKind && upgradedKind !== event.eventKind) {
      return {
        ...event,
        eventKind: upgradedKind,
        narrativeTags: [...event.narrativeTags, upgradedKind],
      };
    }

    return event;
  }

  /**
   * Derive eventKind from the dominant semantic effects in participantEffects
   */
  private deriveEventKindFromEffects(event: NarrativeEvent): NarrativeEventKind | null {
    if (!event.participantEffects) return null;

    // Count semantic kinds across all effects
    const semanticCounts: Record<string, number> = {};
    for (const participant of event.participantEffects) {
      for (const effect of participant.effects) {
        if (effect.semanticKind) {
          semanticCounts[effect.semanticKind] = (semanticCounts[effect.semanticKind] || 0) + 1;
        }
      }
    }

    // Find dominant semantic kind
    let dominant: SemanticEffectKind | null = null;
    let maxCount = 0;
    for (const [kind, count] of Object.entries(semanticCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominant = kind as SemanticEffectKind;
      }
    }

    if (!dominant) return null;

    // Map semantic effect kinds to event kinds
    const semanticToEventKind: Partial<Record<SemanticEffectKind, NarrativeEventKind>> = {
      betrayal: 'betrayal',
      reconciliation: 'reconciliation',
      alliance: 'alliance_formed',
      rivalry: 'rivalry_formed',
      triumph: 'triumph',
      downfall: 'downfall',
    };

    return semanticToEventKind[dominant] || null;
  }

  /**
   * Detect power vacuum: authority entity ended with no clear successor
   */
  private detectPowerVacuum(event: NarrativeEvent): boolean {
    if (!event.participantEffects) return false;

    for (const participant of event.participantEffects) {
      const endedEffect = participant.effects.find(e => e.type === 'ended');
      if (!endedEffect) continue;

      // Check if this entity was an authority
      const entity = this.context.getEntity(participant.entity.id);
      if (!entity || !this.context.isAuthoritySubtype(entity.subtype)) continue;

      // Check for inbound authority relationships (entities that this one ruled)
      const relationships = this.context.getEntityRelationships(participant.entity.id);
      const hasSubordinates = relationships.some(r =>
        r.dst === participant.entity.id && (r.kind === 'serves' || r.kind === 'rules')
      );

      if (hasSubordinates) {
        // Authority with subordinates ended = power vacuum
        return true;
      }
    }

    return false;
  }

  /**
   * Detect succession: container entity ended with part_of members
   */
  private detectSuccession(event: NarrativeEvent): boolean {
    if (!event.participantEffects) return false;

    for (const participant of event.participantEffects) {
      const endedEffect = participant.effects.find(e => e.type === 'ended');
      if (!endedEffect) continue;

      // Check if this entity had part_of members
      const members = this.context.getPartOfMembers(participant.entity.id);
      if (members.length > 0) {
        // Container with members ended = succession
        return true;
      }
    }

    return false;
  }

  /**
   * Detect leadership established: first authority relationship for a target
   */
  private detectLeadershipEstablished(event: NarrativeEvent): boolean {
    if (!event.participantEffects) return false;

    for (const participant of event.participantEffects) {
      const authorityEffects = participant.effects.filter(e =>
        e.type === 'relationship_formed' &&
        (e.relationshipKind === 'rules' || e.relationshipKind === 'serves')
      );

      if (authorityEffects.length > 0) {
        // Check if target had no previous authority relationships
        // This is a heuristic - in practice, we'd need historical data
        // For now, assume relationship_formed for rules/serves is leadership
        return true;
      }
    }

    return false;
  }

  /**
   * Detect war patterns: connected components of negative relationships
   */
  private detectWarPatterns(events: NarrativeEvent[]): NarrativeEvent[] {
    // Collect all rivalry effects from this tick
    const rivalryPairs: Array<{ src: string; dst: string }> = [];

    for (const event of events) {
      if (!event.participantEffects) continue;
      for (const participant of event.participantEffects) {
        for (const effect of participant.effects) {
          if (effect.semanticKind === 'rivalry' && effect.relatedEntity) {
            rivalryPairs.push({
              src: participant.entity.id,
              dst: effect.relatedEntity.id,
            });
          }
        }
      }
    }

    // Find connected components of 3+ entities
    if (rivalryPairs.length < 2) return [];

    const components = this.findConnectedComponents(rivalryPairs);
    const warEvents: NarrativeEvent[] = [];

    for (const component of components) {
      if (component.size >= 3) {
        // Generate a war_started event
        const participants = [...component].map(id => {
          const entity = this.context.getEntity(id);
          return entity ? {
            id: entity.id,
            name: entity.name,
            kind: entity.kind,
            subtype: entity.subtype,
          } : null;
        }).filter(Boolean);

        if (participants.length >= 3) {
          const firstEvent = events[0];
          warEvents.push({
            id: `war-${firstEvent.tick}-${Math.random().toString(36).substr(2, 9)}`,
            tick: firstEvent.tick,
            era: firstEvent.era,
            eventKind: 'war_started',
            significance: 0.8 + Math.min(0.2, participants.length * 0.02),
            subject: participants[0]!,
            action: 'war_started',
            participantEffects: participants.map(p => ({
              entity: p!,
              effects: [{ type: 'relationship_formed' as const, semanticKind: 'rivalry' as const, description: 'entered conflict' }],
            })),
            description: `War erupts between ${participants.slice(0, 3).map(p => p!.name).join(', ')}${participants.length > 3 ? ` and ${participants.length - 3} others` : ''}`,
            narrativeTags: ['war', 'conflict', 'multi-entity'],
          });
        }
      }
    }

    return warEvents;
  }

  /**
   * Detect coalescence: multiple entities joining same container
   */
  private detectCoalescencePatterns(events: NarrativeEvent[]): NarrativeEvent[] {
    // Collect all part_of formations grouped by target
    const partOfByTarget = new Map<string, Array<{ srcId: string; srcName: string }>>();

    for (const event of events) {
      if (!event.participantEffects) continue;
      for (const participant of event.participantEffects) {
        for (const effect of participant.effects) {
          if (effect.type === 'relationship_formed' &&
              effect.relationshipKind === 'part_of' &&
              effect.relatedEntity) {
            const targetId = effect.relatedEntity.id;
            if (!partOfByTarget.has(targetId)) {
              partOfByTarget.set(targetId, []);
            }
            partOfByTarget.get(targetId)!.push({
              srcId: participant.entity.id,
              srcName: participant.entity.name,
            });
          }
        }
      }
    }

    const coalescenceEvents: NarrativeEvent[] = [];

    for (const [targetId, members] of partOfByTarget) {
      if (members.length >= 2) {
        const target = this.context.getEntity(targetId);
        if (!target) continue;

        const firstEvent = events[0];
        coalescenceEvents.push({
          id: `coal-${firstEvent.tick}-${Math.random().toString(36).substr(2, 9)}`,
          tick: firstEvent.tick,
          era: firstEvent.era,
          eventKind: 'coalescence',
          significance: 0.6 + Math.min(0.3, members.length * 0.05),
          subject: {
            id: target.id,
            name: target.name,
            kind: target.kind,
            subtype: target.subtype,
          },
          action: 'coalescence',
          participantEffects: [{
            entity: { id: target.id, name: target.name, kind: target.kind, subtype: target.subtype },
            effects: [{ type: 'relationship_formed' as const, description: `received ${members.length} new members` }],
          }, ...members.map(m => ({
            entity: { id: m.srcId, name: m.srcName, kind: 'unknown', subtype: 'unknown' },
            effects: [{ type: 'relationship_formed' as const, relationshipKind: 'part_of', description: `joined ${target.name}` }],
          }))],
          description: `${members.map(m => m.srcName).slice(0, 3).join(', ')}${members.length > 3 ? ` and ${members.length - 3} others` : ''} united under ${target.name}`,
          narrativeTags: ['coalescence', 'unification', 'multi-entity'],
        });
      }
    }

    return coalescenceEvents;
  }

  /**
   * Find connected components in a graph of pairs
   */
  private findConnectedComponents(pairs: Array<{ src: string; dst: string }>): Set<string>[] {
    const adjacency = new Map<string, Set<string>>();

    for (const { src, dst } of pairs) {
      if (!adjacency.has(src)) adjacency.set(src, new Set());
      if (!adjacency.has(dst)) adjacency.set(dst, new Set());
      adjacency.get(src)!.add(dst);
      adjacency.get(dst)!.add(src);
    }

    const visited = new Set<string>();
    const components: Set<string>[] = [];

    for (const node of adjacency.keys()) {
      if (visited.has(node)) continue;

      const component = new Set<string>();
      const queue = [node];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);
        component.add(current);

        for (const neighbor of adjacency.get(current) || []) {
          if (!visited.has(neighbor)) {
            queue.push(neighbor);
          }
        }
      }

      components.push(component);
    }

    return components;
  }

  /**
   * Merge pattern events with original events.
   * Pattern events supplement but don't replace the original events.
   */
  private mergePatternEvents(
    original: NarrativeEvent[],
    warEvents: NarrativeEvent[],
    coalescenceEvents: NarrativeEvent[]
  ): NarrativeEvent[] {
    // Add pattern events to the list
    return [...original, ...warEvents, ...coalescenceEvents];
  }
}
