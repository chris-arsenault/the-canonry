/**
 * Event Repository — typed CRUD + named mutations for narrative events.
 *
 * All Dexie access for narrative events goes through this module.
 */

import type { NarrativeEvent } from '@canonry/world-schema';
import { db, type PersistedNarrativeEvent } from './illuminatorDb';
import { applyNarrativeEventPatches as applyPatches, type EventPatch } from '../entityRename';

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

export async function isNarrativeEventsSeeded(simulationRunId: string): Promise<boolean> {
  const count = await db.narrativeEvents
    .where('simulationRunId')
    .equals(simulationRunId)
    .count();
  console.log('[EventRepo] isNarrativeEventsSeeded', { simulationRunId, count, seeded: count > 0 });
  return count > 0;
}

export async function seedNarrativeEvents(
  simulationRunId: string,
  events: NarrativeEvent[],
): Promise<void> {
  console.log('[EventRepo] seedNarrativeEvents', { simulationRunId, eventCount: events.length });
  const records: PersistedNarrativeEvent[] = events.map((e) => ({
    ...e,
    simulationRunId,
  }));
  await db.narrativeEvents.bulkPut(records);
  console.log('[EventRepo] seedNarrativeEvents complete');
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getNarrativeEventsForRun(
  simulationRunId: string,
): Promise<PersistedNarrativeEvent[]> {
  const events = await db.narrativeEvents
    .where('simulationRunId')
    .equals(simulationRunId)
    .toArray();
  console.log('[EventRepo] getNarrativeEventsForRun', { simulationRunId, count: events.length });
  return events;
}

export async function getNarrativeEvent(
  eventId: string,
): Promise<PersistedNarrativeEvent | undefined> {
  return db.narrativeEvents.get(eventId);
}

// ---------------------------------------------------------------------------
// Named mutations
// ---------------------------------------------------------------------------

/**
 * Apply event patches from a rename operation.
 * Reads affected events from Dexie, applies text replacements, writes back.
 * Returns IDs of all updated events.
 */
export async function applyEventPatches(
  eventPatches: EventPatch[],
  simulationRunId: string,
): Promise<string[]> {
  console.log('[EventRepo] applyEventPatches called', {
    patchCount: eventPatches.length,
    simulationRunId,
    patchEventIds: eventPatches.map((p) => p.eventId),
    patchKeys: eventPatches.map((p) => Object.keys(p.changes)),
  });

  if (eventPatches.length === 0) return [];

  const updatedIds: string[] = [];

  await db.transaction('rw', db.narrativeEvents, async () => {
    // Load all events for the run (needed for the batch patch function)
    const allEvents = await db.narrativeEvents
      .where('simulationRunId')
      .equals(simulationRunId)
      .toArray();

    console.log('[EventRepo] Loaded events from Dexie', {
      totalEvents: allEvents.length,
      simulationRunId,
    });

    // Sample a patched event BEFORE applying patches
    const firstPatchId = eventPatches[0]?.eventId;
    const sampleBefore = allEvents.find((e) => e.id === firstPatchId);
    if (sampleBefore) {
      console.log('[EventRepo] Sample event BEFORE patch', {
        id: sampleBefore.id,
        description: sampleBefore.description?.substring(0, 200),
        action: (sampleBefore as any).action?.substring(0, 200),
      });
    } else {
      console.warn('[EventRepo] First patch target NOT FOUND in Dexie events', {
        targetId: firstPatchId,
        availableIds: allEvents.slice(0, 5).map((e) => e.id),
      });
    }

    // Apply patches using the existing pure function
    const patched = applyPatches(allEvents, eventPatches);

    // Sample the same event AFTER applying patches
    const sampleAfter = patched.find((e) => e.id === firstPatchId);
    if (sampleAfter) {
      console.log('[EventRepo] Sample event AFTER patch', {
        id: sampleAfter.id,
        description: sampleAfter.description?.substring(0, 200),
        action: (sampleAfter as any).action?.substring(0, 200),
      });
    }

    // Find which events actually changed and write them back
    const patchedEventIds = new Set(eventPatches.map((p) => p.eventId));
    let writeCount = 0;
    for (const event of patched) {
      if (patchedEventIds.has(event.id)) {
        await db.narrativeEvents.put(event);
        updatedIds.push(event.id);
        writeCount++;
      }
    }
    console.log('[EventRepo] Wrote patched events back to Dexie', {
      writeCount,
      updatedIds,
    });
  });

  // Verify: re-read one event to confirm persistence
  if (updatedIds.length > 0) {
    const verify = await db.narrativeEvents.get(updatedIds[0]);
    console.log('[EventRepo] VERIFY after transaction', {
      id: verify?.id,
      description: verify?.description?.substring(0, 200),
      action: (verify as any)?.action?.substring(0, 200),
    });
  }

  return updatedIds;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export async function deleteEventsForRun(simulationRunId: string): Promise<void> {
  await db.narrativeEvents.where('simulationRunId').equals(simulationRunId).delete();
}
