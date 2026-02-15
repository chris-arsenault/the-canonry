/**
 * Zustand selectors for the relationship store.
 *
 * Provides granular subscriptions so components only re-render when
 * the specific relationship data they care about changes.
 */

import { useRelationshipStore } from './relationshipStore';
import type { PersistedRelationship } from './illuminatorDb';
import type { RelationshipIndex } from './relationshipStore';

const EMPTY_ARRAY: PersistedRelationship[] = [];

/** Full flat relationship array — re-renders when relationships change */
export function useRelationships(): PersistedRelationship[] {
  return useRelationshipStore((state) => state.relationships);
}

/** Precomputed byEntity index — re-renders when relationships change */
export function useRelationshipsByEntity(): RelationshipIndex {
  return useRelationshipStore((state) => state.byEntity);
}

/** Relationships for a specific entity — re-renders when index changes */
export function useRelationshipsForEntity(entityId: string | undefined): PersistedRelationship[] {
  return useRelationshipStore((state) =>
    entityId ? ((state.byEntity.get(entityId) as PersistedRelationship[] | undefined) ?? EMPTY_ARRAY) : EMPTY_ARRAY
  );
}

/** Relationship count */
export function useRelationshipCount(): number {
  return useRelationshipStore((state) => state.relationships.length);
}
