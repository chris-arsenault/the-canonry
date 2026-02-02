/**
 * Event Filtering Utilities
 *
 * Shared logic for filtering and extracting narrative events for entities.
 * Used by chronicler (EntityTimeline) and illuminator (description generation).
 */

import type { NarrativeEvent, EntityEffect } from './world.js';

/**
 * Options for filtering entity events
 */
export interface EventFilterOptions {
  /** Entity ID to filter events for */
  entityId: string;
  /** Minimum significance threshold (0, 0.25, 0.50, 0.75) */
  minSignificance?: number;
  /** Whether to exclude prominence-only events (default: true) */
  excludeProminenceOnly?: boolean;
  /** Maximum number of events to return */
  limit?: number;
}

/**
 * Check if an event is prominence-only for a given entity.
 * An event is "prominence-only" if ALL of its effects on the entity are
 * field_changed effects where field === 'prominence'.
 *
 * These events are typically noise (gradual prominence changes) rather than
 * narratively interesting happenings.
 */
export function isProminenceOnlyEvent(
  event: NarrativeEvent,
  entityId: string
): boolean {
  const participant = event.participantEffects?.find(p => p.entity.id === entityId);
  if (!participant || participant.effects.length === 0) return false;

  // Check if ALL effects are prominence field changes
  return participant.effects.every(
    effect => effect.type === 'field_changed' && effect.field === 'prominence'
  );
}

/**
 * Get effects for a specific entity from an event
 */
export function getEntityEffects(
  event: NarrativeEvent,
  entityId: string
): EntityEffect[] {
  const participant = event.participantEffects?.find(p => p.entity.id === entityId);
  return participant?.effects ?? [];
}

/**
 * Get filtered events for an entity from narrative history.
 *
 * Applies filters:
 * 1. Entity must appear in participantEffects
 * 2. Exclude prominence-only events (if enabled)
 * 3. Significance >= minSignificance
 *
 * Results are sorted chronologically (by tick).
 */
export function getEntityEvents(
  narrativeHistory: NarrativeEvent[],
  options: EventFilterOptions
): NarrativeEvent[] {
  const {
    entityId,
    minSignificance = 0,
    excludeProminenceOnly = true,
    limit,
  } = options;

  const filtered = narrativeHistory
    .filter(event => {
      // Entity must appear in participantEffects
      if (!event.participantEffects?.some(p => p.entity.id === entityId)) {
        return false;
      }

      // Exclude prominence-only events if configured
      if (excludeProminenceOnly && isProminenceOnlyEvent(event, entityId)) {
        return false;
      }

      // Filter by significance threshold
      if (event.significance < minSignificance) {
        return false;
      }

      return true;
    })
    .sort((a, b) => a.tick - b.tick); // Chronological order

  return limit ? filtered.slice(0, limit) : filtered;
}

/**
 * Format an event for inclusion in a prompt.
 * Produces a concise one-line summary.
 */
export function formatEventForPrompt(
  event: NarrativeEvent,
  entityId: string
): string {
  const effects = getEntityEffects(event, entityId);

  // Use the event description, or summarize effects
  if (event.description) {
    return `[Tick ${event.tick}] ${event.description}`;
  }

  // Fallback: summarize effects
  const effectSummary = effects
    .map(e => e.description)
    .filter(Boolean)
    .join('; ');

  return `[Tick ${event.tick}] ${effectSummary || event.action}`;
}
