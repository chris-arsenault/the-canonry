/**
 * Canonical status types for world schema fields that track "has this happened?"
 *
 * These replace raw `number` or `number | null` fields where the semantics are
 * "either this happened at tick T, or it hasn't happened yet." A bare number
 * forces every consumer to know that 0 means "not yet" — these types make the
 * intent explicit and provide safe constructors.
 */

// =============================================================================
// TickStatus — "Did this happen, and if so, at which tick?"
// =============================================================================

/**
 * Tracks whether a tick-based event has occurred.
 *
 * Used for: entity lifecycle end, relationship archival, enrichment timestamps,
 * and any other field where the question is "has this happened yet?"
 *
 * The `occurred` discriminant makes branching explicit:
 * ```ts
 * if (entity.temporal.end.occurred) {
 *   console.log(`Ended at tick ${entity.temporal.end.tick}`);
 * }
 * ```
 */
export type TickStatus =
  | { occurred: true; tick: number }
  | { occurred: false; tick: 0 };

/** Construct a TickStatus for an event that has occurred. */
export function occurred(tick: number): TickStatus {
  return { occurred: true, tick };
}

/** Construct a TickStatus for an event that has not occurred. */
export function notOccurred(): TickStatus {
  return { occurred: false, tick: 0 };
}

/** Type guard: narrow a TickStatus to the occurred variant. */
export function hasOccurred(status: TickStatus): status is { occurred: true; tick: number } {
  return status.occurred;
}

// =============================================================================
// EventCause — "What caused this narrative event?"
// =============================================================================

/**
 * Tracks causality for narrative events.
 *
 * Not all events have a traceable cause — spontaneous template creation,
 * era transitions, etc. The `hasCause` discriminant makes this explicit.
 */
export type EventCause =
  | {
      hasCause: true;
      eventId: string;
      entityId: string;
      actionType: string;
      success: boolean;
    }
  | {
      hasCause: false;
      eventId: '';
      entityId: '';
      actionType: '';
      success: true;
    };

/** Construct an EventCause for an event with a known cause. */
export function caused(
  eventId: string,
  entityId: string,
  actionType: string,
  success: boolean,
): EventCause {
  return { hasCause: true, eventId, entityId, actionType, success };
}

/** Construct an EventCause for a spontaneous event with no traceable cause. */
export function uncaused(): EventCause {
  return { hasCause: false, eventId: '', entityId: '', actionType: '', success: true };
}
