/**
 * React hook for managing simulation web worker
 */

import { useCallback, useRef, useEffect, useReducer } from "react";
import type {
  SimulationEvent,
  ProgressPayload, LogPayload, ValidationPayload, EpochStartPayload, EpochStatsPayload,
  GrowthPhasePayload, TemplateApplicationPayload, ActionApplicationPayload,
  PressureUpdatePayload, PopulationPayload, TemplateUsagePayload, CoordinateStatsPayload,
  TagHealthPayload, SystemHealthPayload, SystemActionPayload, EntityBreakdownPayload,
  CatalystStatsPayload, RelationshipBreakdownPayload, NotableEntitiesPayload,
  SimulationResultPayload, StateExportPayload, ErrorPayload,
} from "../../../lib/observer/types";
import type { EngineConfig } from "../../../lib/engine/types";
import type { HardState } from "../../../lib/core/worldTypes";
import { simulationReducer, INITIAL_SIM_STATE } from "./simulationReducer";
import type { SimAction } from "./simulationReducer";

export interface SimulationState {
  status: "idle" | "initializing" | "validating" | "running" | "finalizing" | "paused" | "complete" | "error";
  progress: ProgressPayload | null;
  validation: ValidationPayload | null;
  currentEpoch: EpochStartPayload | null;
  epochStats: EpochStatsPayload[];
  growthPhases: GrowthPhasePayload[];
  templateApplications: TemplateApplicationPayload[];
  actionApplications: ActionApplicationPayload[];
  pressureUpdates: PressureUpdatePayload[];
  populationReport: PopulationPayload | null;
  templateUsage: TemplateUsagePayload | null;
  coordinateStats: CoordinateStatsPayload | null;
  tagHealth: TagHealthPayload | null;
  systemHealth: SystemHealthPayload | null;
  systemActions: SystemActionPayload[];
  entityBreakdown: EntityBreakdownPayload | null;
  catalystStats: CatalystStatsPayload | null;
  relationshipBreakdown: RelationshipBreakdownPayload | null;
  notableEntities: NotableEntitiesPayload | null;
  result: SimulationResultPayload | null;
  stateExport: StateExportPayload | null;
  error: ErrorPayload | null;
  logs: LogPayload[];
}

export interface UseSimulationWorkerReturn {
  state: SimulationState;
  start: (config: EngineConfig, initialState: HardState[]) => void;
  startStepping: (config: EngineConfig, initialState: HardState[]) => void;
  step: () => void;
  runToCompletion: () => void;
  reset: () => void;
  abort: () => void;
  clearLogs: () => void;
  requestExport: () => void;
  isRunning: boolean;
  isPaused: boolean;
}

function createWorker(dispatch: (action: SimAction) => void): Worker {
  const worker = new Worker(new URL("../workers/simulation.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<SimulationEvent>) => dispatch({ type: "message", event: event.data });
  worker.onerror = (error) => dispatch({ type: "workerError", message: error.message || "Worker error" });
  return worker;
}

export function useSimulationWorker(): UseSimulationWorkerReturn {
  const [state, dispatch] = useReducer(simulationReducer, INITIAL_SIM_STATE);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => () => { if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; } }, []);

  const start = useCallback((config: EngineConfig, initialEntities: HardState[]) => {
    if (workerRef.current) workerRef.current.terminate();
    dispatch({ type: "init" });
    workerRef.current = createWorker(dispatch);
    workerRef.current.postMessage({ type: "start", config, initialState: initialEntities });
  }, []);

  const startStepping = useCallback((config: EngineConfig, initialEntities: HardState[]) => {
    if (workerRef.current) workerRef.current.terminate();
    dispatch({ type: "init" });
    workerRef.current = createWorker(dispatch);
    workerRef.current.postMessage({ type: "startStepping", config, initialState: initialEntities });
  }, []);

  const step = useCallback(() => { workerRef.current?.postMessage({ type: "step" }); }, []);
  const runToCompletion = useCallback(() => { workerRef.current?.postMessage({ type: "runToCompletion" }); }, []);
  const reset = useCallback(() => { dispatch({ type: "reset" }); workerRef.current?.postMessage({ type: "reset" }); }, []);

  const abort = useCallback(() => {
    if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; }
    dispatch({ type: "abort" });
  }, []);

  const requestExport = useCallback(() => { dispatch({ type: "clearExport" }); workerRef.current?.postMessage({ type: "exportState" }); }, []);
  const clearLogs = useCallback(() => dispatch({ type: "clearLogs" }), []);

  const isRunning = state.status === "initializing" || state.status === "validating" || state.status === "running" || state.status === "finalizing";
  const isPaused = state.status === "paused";

  return { state, start, startStepping, step, runToCompletion, reset, abort, clearLogs, requestExport, isRunning, isPaused };
}
