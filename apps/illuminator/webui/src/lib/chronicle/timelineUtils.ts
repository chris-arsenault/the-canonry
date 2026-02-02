/**
 * Timeline utilities for the Narrative Arc Timeline visualization
 *
 * Provides computations for:
 * - Era ranges and positioning
 * - Event placement on timeline
 * - Intensity curve (narrative pacing)
 * - Range selection helpers
 */

import type { NarrativeEventContext, EntityContext } from '../chronicleTypes';

export interface EraRange {
  id: string;
  name: string;
  startTick: number;
  endTick: number;
  color: string;
}

export interface TimelineEvent {
  id: string;
  tick: number;
  eraId: string;
  headline: string;
  description?: string;
  significance: number; // 0-1
  involvesEntryPoint: boolean;
  involvesCastMember: boolean;
  participantCount: number;
  eventKind: string;
  selected: boolean;
}

export interface IntensityPoint {
  tick: number;
  intensity: number; // cumulative significance in window
}

// Era color palette - distinct, accessible colors
const ERA_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
];

/**
 * Convert eras to era ranges for timeline display.
 * Uses the actual era boundaries - no computation.
 */
export function getEraRanges(
  eras: Array<{ id: string; name: string; startTick: number; endTick: number | null }>
): EraRange[] {
  return eras.map((era, i) => ({
    id: era.id,
    name: era.name,
    startTick: era.startTick,
    endTick: era.endTick ?? era.startTick + 100, // fallback for ongoing era
    color: ERA_COLORS[i % ERA_COLORS.length],
  }));
}

// Keep old name for backwards compatibility during transition
export const computeEraRanges = (
  _events: NarrativeEventContext[],
  eras: Array<{ id: string; name: string; startTick?: number; endTick?: number | null }>
) => getEraRanges(eras as Array<{ id: string; name: string; startTick: number; endTick: number | null }>);

/**
 * Transform events into timeline format
 */
export function prepareTimelineEvents(
  events: NarrativeEventContext[],
  entryPointId: string | null,
  assignedEntityIds: Set<string>,
  selectedEventIds: Set<string>
): TimelineEvent[] {
  return events.map(event => {
    const participants = event.participants || [];
    const participantIds = new Set(participants.map(p => p.id));

    // Check if entry point or subject/object
    const involvesEntryPoint = entryPointId !== null && (
      event.subjectId === entryPointId ||
      event.objectId === entryPointId ||
      participantIds.has(entryPointId)
    );

    // Check if any cast member is involved
    const involvesCastMember = [...assignedEntityIds].some(id =>
      event.subjectId === id ||
      event.objectId === id ||
      participantIds.has(id)
    );

    return {
      id: event.id,
      tick: event.tick,
      eraId: event.era,
      headline: event.headline,
      description: event.description,
      significance: event.significance,
      involvesEntryPoint,
      involvesCastMember,
      participantCount: participants.length + (event.subjectId ? 1 : 0) + (event.objectId ? 1 : 0),
      eventKind: event.eventKind,
      selected: selectedEventIds.has(event.id),
    };
  });
}

/**
 * Compute intensity curve for sparkline
 * Uses a rolling window to smooth the data
 */
export function computeIntensityCurve(
  events: NarrativeEventContext[],
  windowSize: number = 10
): IntensityPoint[] {
  if (events.length === 0) return [];

  // Sort by tick
  const sorted = [...events].sort((a, b) => a.tick - b.tick);
  const minTick = sorted[0].tick;
  const maxTick = sorted[sorted.length - 1].tick;

  // Create intensity map
  const tickSignificance = new Map<number, number>();
  for (const event of sorted) {
    const current = tickSignificance.get(event.tick) || 0;
    tickSignificance.set(event.tick, current + event.significance);
  }

  // Generate points at regular intervals
  const numPoints = Math.min(50, maxTick - minTick + 1);
  const step = Math.max(1, Math.floor((maxTick - minTick) / numPoints));
  const points: IntensityPoint[] = [];

  for (let tick = minTick; tick <= maxTick; tick += step) {
    // Sum significance in window around this tick
    let intensity = 0;
    const halfWindow = Math.floor(windowSize / 2);

    for (const [t, sig] of tickSignificance) {
      if (t >= tick - halfWindow && t <= tick + halfWindow) {
        // Weight by distance from center
        const distance = Math.abs(t - tick);
        const weight = 1 - (distance / (halfWindow + 1));
        intensity += sig * weight;
      }
    }

    points.push({ tick, intensity });
  }

  // Normalize to 0-1
  const maxIntensity = Math.max(...points.map(p => p.intensity), 0.001);
  return points.map(p => ({
    tick: p.tick,
    intensity: p.intensity / maxIntensity,
  }));
}

/**
 * Get events within a tick range
 */
export function getEventsInRange(
  events: TimelineEvent[],
  startTick: number,
  endTick: number
): TimelineEvent[] {
  return events.filter(e => e.tick >= startTick && e.tick <= endTick);
}

/**
 * Get timeline extent from era boundaries.
 * Returns [0, maxEndTick] - the full simulation range.
 */
export function getTimelineExtent(
  eras: Array<{ startTick: number; endTick: number | null }>
): [number, number] {
  if (eras.length === 0) return [0, 100];

  const maxTick = Math.max(
    ...eras.map(e => e.endTick ?? e.startTick + 100)
  );

  return [0, maxTick];
}

// Keep old name for backwards compatibility
export const computeTimelineExtent = (
  _events: NarrativeEventContext[],
  eras?: Array<{ endTick?: number | null; startTick?: number }>
): [number, number] => {
  if (!eras || eras.length === 0) return [0, 100];
  return getTimelineExtent(eras as Array<{ startTick: number; endTick: number | null }>);
};

/**
 * Scale a tick value to SVG x coordinate
 */
export function tickToX(
  tick: number,
  extent: [number, number],
  width: number,
  padding: number = 0
): number {
  const [minTick, maxTick] = extent;
  const range = maxTick - minTick || 1;
  const usableWidth = width - 2 * padding;
  return padding + ((tick - minTick) / range) * usableWidth;
}

/**
 * Scale SVG x coordinate back to tick value
 */
export function xToTick(
  x: number,
  extent: [number, number],
  width: number,
  padding: number = 0
): number {
  const [minTick, maxTick] = extent;
  const range = maxTick - minTick || 1;
  const usableWidth = width - 2 * padding;
  const normalized = (x - padding) / usableWidth;
  return Math.round(minTick + normalized * range);
}

/**
 * Get fill pattern based on involvement level
 */
export function getEventFill(event: TimelineEvent): string {
  if (event.involvesEntryPoint) return 'var(--accent-color)';
  if (event.involvesCastMember) return 'var(--accent-color-muted, rgba(99, 102, 241, 0.6))';
  return 'var(--text-muted)';
}

/**
 * Get event height based on significance (for visual weight)
 */
export function getEventHeight(significance: number, maxHeight: number = 40, minHeight: number = 16): number {
  return minHeight + significance * (maxHeight - minHeight);
}
