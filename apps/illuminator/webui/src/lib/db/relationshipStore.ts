/**
 * Relationship Store — Zustand reactive layer for relationship data.
 *
 * Unlike entities and chronicles, relationships use a SIMPLE store pattern:
 * all records fully loaded in memory, no nav/detail split. This is because
 * relationships are small (~150KB for ~1500 records) and buildPrompt needs
 * synchronous access for bulk "Queue All" operations.
 *
 * Holds the full relationship array and a precomputed byEntity index.
 * Components subscribe via selectors in relationshipSelectors.ts.
 * Dexie remains the source of truth.
 */

import { create } from "zustand";
import type { WorldRelationship } from "@canonry/world-schema";
import type { PersistedRelationship } from "./illuminatorDb";
import * as relationshipRepo from "./relationshipRepository";

export type RelationshipIndex = Map<string, WorldRelationship[]>;

function buildRelationshipIndex(relationships: WorldRelationship[] = []): RelationshipIndex {
  const index: RelationshipIndex = new Map();

  for (const rel of relationships) {
    const add = (id: string) => {
      const existing = index.get(id);
      if (existing) {
        existing.push(rel);
      } else {
        index.set(id, [rel]);
      }
    };

    if (rel.src) add(rel.src);
    if (rel.dst && rel.dst !== rel.src) add(rel.dst);
  }

  return index;
}

export interface RelationshipStoreState {
  simulationRunId: string | null;
  relationships: PersistedRelationship[];
  byEntity: RelationshipIndex;
  initialized: boolean;
  loading: boolean;
  error: string | null;

  initialize: (simulationRunId: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  getForEntity: (entityId: string) => PersistedRelationship[];
  reset: () => void;
}

export const useRelationshipStore = create<RelationshipStoreState>((set, get) => ({
  simulationRunId: null,
  relationships: [],
  byEntity: new Map(),
  initialized: false,
  loading: false,
  error: null,

  async initialize(simulationRunId: string) {
    const state = get();
    if (state.simulationRunId === simulationRunId && state.initialized) return;

    set({ loading: true, error: null, simulationRunId });
    try {
      const relationships = await relationshipRepo.getRelationshipsForRun(simulationRunId);
      set({
        relationships,
        byEntity: buildRelationshipIndex(relationships),
        initialized: true,
        loading: false,
      });
    } catch (err) {
      console.error("[RelationshipStore] Failed to initialize:", err);
      set({
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      });
    }
  },

  async refreshAll() {
    const { simulationRunId } = get();
    if (!simulationRunId) return;

    const relationships = await relationshipRepo.getRelationshipsForRun(simulationRunId);
    set({
      relationships,
      byEntity: buildRelationshipIndex(relationships),
    });
  },

  getForEntity(entityId: string) {
    return (get().byEntity.get(entityId) as PersistedRelationship[] | undefined) ?? [];
  },

  reset() {
    set({
      simulationRunId: null,
      relationships: [],
      byEntity: new Map(),
      initialized: false,
      loading: false,
      error: null,
    });
  },
}));
