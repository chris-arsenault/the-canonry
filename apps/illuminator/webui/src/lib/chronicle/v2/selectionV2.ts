/**
 * Chronicle V2 Selection
 *
 * Extracts the wizard-selected entities, relationships, and events
 * from the chronicle focus for prompt building.
 */

import type {
  ChronicleGenerationContext,
} from '../chronicleTypes';
import type { V2SelectionConfig, V2SelectionResult } from './types';
import { DEFAULT_V2_CONFIG } from './types';

/**
 * Extract selected entities/relationships/events from chronicle focus.
 *
 * The wizard has already done the selection work via role assignments.
 * This function just extracts and formats for prompt building.
 */
export function selectEntitiesV2(
  context: ChronicleGenerationContext,
  config: V2SelectionConfig = DEFAULT_V2_CONFIG
): V2SelectionResult {
  if (!context.focus?.roleAssignments?.length) {
    throw new Error('V2 selection requires focus with role assignments');
  }

  const selectedEntityIds = new Set(context.focus.selectedEntityIds);
  const selectedEntities = context.entities.filter(e => selectedEntityIds.has(e.id));

  // Use selected relationships from focus
  const selectedRelationships = context.focus.selectedRelationshipIds?.length
    ? context.relationships.filter(r => {
        const relId = `${r.src}:${r.dst}:${r.kind}`;
        return context.focus!.selectedRelationshipIds.includes(relId);
      })
    : context.relationships.filter(r =>
        selectedEntityIds.has(r.src) && selectedEntityIds.has(r.dst)
      );

  // Use selected events from focus
  const selectedEventIds = new Set(context.focus.selectedEventIds || []);
  const selectedEvents = selectedEventIds.size > 0
    ? context.events.filter(e => selectedEventIds.has(e.id))
    : context.events.filter(e =>
        selectedEntityIds.has(e.subjectId || '') || selectedEntityIds.has(e.objectId || '')
      ).slice(0, config.maxEvents);

  return {
    entities: selectedEntities,
    relationships: selectedRelationships.slice(0, config.maxRelationships),
    events: selectedEvents.slice(0, config.maxEvents),
  };
}
