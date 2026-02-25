/**
 * Relationship Repository — typed CRUD for world relationships.
 *
 * All Dexie access for relationships goes through this module.
 */

import type { WorldRelationship } from "@canonry/world-schema";
import { db, type PersistedRelationship } from "./illuminatorDb";

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

export async function isRelationshipsSeeded(simulationRunId: string): Promise<boolean> {
  const count = await db.relationships.where("simulationRunId").equals(simulationRunId).count();
  console.log("[RelationshipRepo] isRelationshipsSeeded", {
    simulationRunId,
    count,
    seeded: count > 0,
  });
  return count > 0;
}

export async function seedRelationships(
  simulationRunId: string,
  relationships: WorldRelationship[]
): Promise<void> {
  console.log("[RelationshipRepo] seedRelationships", {
    simulationRunId,
    count: relationships.length,
  });
  const records: PersistedRelationship[] = relationships.map((rel) => ({
    ...rel,
    simulationRunId,
  }));
  await db.relationships.bulkPut(records);
  console.log("[RelationshipRepo] seedRelationships complete");
}

/**
 * Patch relationships without overwriting existing records.
 * Inserts only missing relationship keys (src/dst/kind).
 */
export async function patchRelationships(
  simulationRunId: string,
  relationships: WorldRelationship[]
): Promise<number> {
  if (!relationships?.length) return 0;

  const existing = await db.relationships
    .where("simulationRunId")
    .equals(simulationRunId)
    .toArray();
  const existingKeys = new Set(existing.map((rel) => `${rel.src}:${rel.dst}:${rel.kind}`));

  const toAdd: PersistedRelationship[] = [];
  for (const rel of relationships) {
    const key = `${rel.src}:${rel.dst}:${rel.kind}`;
    if (!existingKeys.has(key)) {
      toAdd.push({ ...rel, simulationRunId });
    }
  }

  if (toAdd.length > 0) {
    await db.relationships.bulkPut(toAdd);
  }

  return toAdd.length;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getRelationshipsForRun(
  simulationRunId: string
): Promise<PersistedRelationship[]> {
  const relationships = await db.relationships
    .where("simulationRunId")
    .equals(simulationRunId)
    .toArray();
  console.log("[RelationshipRepo] getRelationshipsForRun", {
    simulationRunId,
    count: relationships.length,
  });
  return relationships;
}

/**
 * Get all relationships involving a specific entity (as src or dst).
 * Uses the existing 'src' and 'dst' indexes for efficient per-entity queries.
 */
export async function getRelationshipsForEntity(
  simulationRunId: string,
  entityId: string
): Promise<PersistedRelationship[]> {
  const [asSrc, asDst] = await Promise.all([
    db.relationships
      .where("src")
      .equals(entityId)
      .and((r) => r.simulationRunId === simulationRunId)
      .toArray(),
    db.relationships
      .where("dst")
      .equals(entityId)
      .and((r) => r.simulationRunId === simulationRunId)
      .toArray(),
  ]);
  const seen = new Set<string>();
  const result: PersistedRelationship[] = [];
  for (const rel of [...asSrc, ...asDst]) {
    const key = `${rel.src}:${rel.dst}:${rel.kind}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(rel);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export async function deleteRelationshipsForRun(simulationRunId: string): Promise<void> {
  await db.relationships.where("simulationRunId").equals(simulationRunId).delete();
}
