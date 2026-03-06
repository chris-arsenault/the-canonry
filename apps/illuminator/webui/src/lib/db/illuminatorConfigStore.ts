/**
 * useIlluminatorConfigStore — Zustand store for project-level configuration.
 *
 * Centralizes configuration that was previously only available in IlluminatorRemote's
 * local state. IlluminatorRemote writes to this store via useEffect (one-way sync:
 * parent writes, children read). Child components and hooks read imperatively via
 * `useIlluminatorConfigStore.getState()`.
 *
 * ## What lives here
 *
 * - projectId, simulationRunId: identity (simulationRunId also on entityStore)
 * - worldContext: canon facts, world dynamics
 * - historianConfig: historian persona definition
 * - entityGuidance: entity description/image prompt guidance
 * - cultureIdentities: culture-specific identity configs
 *
 * ## Why a separate store from entityStore
 *
 * entityStore holds entity data (nav items, cache). This store holds *configuration*
 * that drives LLM prompt building and historian operations. Different concerns,
 * different update cadences.
 */

import { create } from "zustand";
import { DEFAULT_HISTORIAN_CONFIG } from "../historianTypes";
import type { HistorianConfig } from "../historianTypes";

export interface WorldContext {
  canonFactsWithMetadata?: Array<{ text: string; [key: string]: unknown }>;
  worldDynamics?: Array<{ text: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

interface IlluminatorConfigState {
  projectId: string | null;
  simulationRunId: string | null;
  worldContext: WorldContext;
  historianConfig: HistorianConfig;
  entityGuidance: unknown;
  cultureIdentities: unknown;

  // Historian activity flags — synced from primitive hooks in IlluminatorRemote
  isHistorianEditionActive: boolean;
  isHistorianActive: boolean;

  /** Called by IlluminatorRemote to sync config into the store */
  setConfig: (
    config: Partial<
      Pick<
        IlluminatorConfigState,
        | "projectId"
        | "simulationRunId"
        | "worldContext"
        | "historianConfig"
        | "entityGuidance"
        | "cultureIdentities"
        | "isHistorianEditionActive"
        | "isHistorianActive"
      >
    >
  ) => void;
}

export const useIlluminatorConfigStore = create<IlluminatorConfigState>((set) => ({
  projectId: null,
  simulationRunId: null,
  worldContext: {},
  historianConfig: DEFAULT_HISTORIAN_CONFIG,
  entityGuidance: null,
  cultureIdentities: null,
  isHistorianEditionActive: false,
  isHistorianActive: false,

  setConfig: (config) => set(config),
}));
