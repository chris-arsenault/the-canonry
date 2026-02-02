import type { ChronicleGenerationContext, NarrativeFocus } from './chronicleTypes';

export function applyFocusToContext(
  context: ChronicleGenerationContext,
  focus: NarrativeFocus
): ChronicleGenerationContext {
  const entitySet = new Set(focus.selectedEntityIds);
  const eventSet = new Set(focus.selectedEventIds);

  const filteredEntities = context.entities.filter((e) => entitySet.has(e.id));
  const filteredEvents = context.events.filter((e) => eventSet.has(e.id));
  const filteredRelationships = context.relationships.filter(
    (r) => entitySet.has(r.src) && entitySet.has(r.dst)
  );

  return {
    ...context,
    entities: filteredEntities,
    events: filteredEvents,
    relationships: filteredRelationships,
  };
}
