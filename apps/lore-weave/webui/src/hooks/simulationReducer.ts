/**
 * Simulation state reducer — handles all worker message types
 * and updates the SimulationState accordingly.
 */

import type { SimulationState } from "./useSimulationWorker";
import type { SimulationEvent } from "../../../lib/observer/types";

const MAX_LOG_ENTRIES = 1000;
const MAX_TEMPLATE_APPS = 1000;
const MAX_PRESSURE_UPDATES = 500;
const MAX_SYSTEM_ACTIONS = 500;

export type SimAction =
  | { type: "message"; event: SimulationEvent }
  | { type: "init" }
  | { type: "reset" }
  | { type: "abort" }
  | { type: "clearLogs" }
  | { type: "clearExport" }
  | { type: "workerError"; message: string };

function limitArray<T>(arr: T[], max: number): T[] {
  return arr.length > max ? arr.slice(arr.length - max) : arr;
}

export function simulationReducer(state: SimulationState, action: SimAction): SimulationState {
  switch (action.type) {
    case "init":
      return { ...INITIAL_SIM_STATE, status: "initializing" };
    case "reset":
      return {
        ...state, status: "initializing",
        epochStats: [], growthPhases: [], pressureUpdates: [],
        populationReport: null, templateUsage: null, coordinateStats: null,
        tagHealth: null, systemHealth: null, systemActions: [],
        entityBreakdown: null, catalystStats: null, relationshipBreakdown: null,
        notableEntities: null, result: null, error: null,
      };
    case "abort":
      return { ...state, status: "idle" };
    case "clearLogs":
      return { ...state, logs: [] };
    case "clearExport":
      return { ...state, stateExport: null };
    case "workerError":
      return { ...state, status: "error", error: { message: action.message, phase: "worker", context: {} } };
    case "message":
      return handleMessage(state, action.event);
  }
}

type MessageHandler = (state: SimulationState, payload: SimulationEvent['payload']) => SimulationState;

// Simple field assignments — maps event type to the state field it updates
const SIMPLE_FIELD_MAP: Record<string, keyof SimulationState> = {
  validation: "validation",
  epoch_start: "currentEpoch",
  population_report: "populationReport",
  template_usage: "templateUsage",
  coordinate_stats: "coordinateStats",
  tag_health: "tagHealth",
  system_health: "systemHealth",
  entity_breakdown: "entityBreakdown",
  catalyst_stats: "catalystStats",
  relationship_breakdown: "relationshipBreakdown",
  notable_entities: "notableEntities",
  state_export: "stateExport",
};

// Append-to-array fields
const APPEND_FIELD_MAP: Record<string, { field: keyof SimulationState; limit: number }> = {
  epoch_stats: { field: "epochStats", limit: Infinity },
  growth_phase: { field: "growthPhases", limit: Infinity },
  template_application: { field: "templateApplications", limit: MAX_TEMPLATE_APPS },
  action_application: { field: "actionApplications", limit: Infinity },
  pressure_update: { field: "pressureUpdates", limit: MAX_PRESSURE_UPDATES },
  system_action: { field: "systemActions", limit: MAX_SYSTEM_ACTIONS },
};

// Special-case handlers
const SPECIAL_HANDLERS: Record<string, MessageHandler> = {
  progress: (state, payload) => ({ ...state, status: (payload as { phase: string }).phase as SimulationState["status"], progress: payload as SimulationState["progress"] }),
  log: (state, payload) => ({ ...state, logs: limitArray([...state.logs, payload as SimulationState["logs"][0]], MAX_LOG_ENTRIES) }),
  complete: (state, payload) => ({ ...state, status: "complete", result: payload as SimulationState["result"] }),
  error: (state, payload) => ({ ...state, status: "error", error: payload as SimulationState["error"] }),
};

function handleMessage(state: SimulationState, msg: SimulationEvent): SimulationState {
  // Check simple field assignment
  const simpleField = SIMPLE_FIELD_MAP[msg.type];
  if (simpleField) return { ...state, [simpleField]: msg.payload };

  // Check append-to-array
  const appendConfig = APPEND_FIELD_MAP[msg.type];
  if (appendConfig) {
    const current = state[appendConfig.field] as unknown[];
    const updated = appendConfig.limit === Infinity ? [...current, msg.payload] : limitArray([...current, msg.payload], appendConfig.limit);
    return { ...state, [appendConfig.field]: updated };
  }

  // Check special handlers
  const handler = SPECIAL_HANDLERS[msg.type];
  if (handler) return handler(state, msg.payload);

  return state;
}

export const INITIAL_SIM_STATE: SimulationState = {
  status: "idle",
  progress: null,
  validation: null,
  currentEpoch: null,
  epochStats: [],
  growthPhases: [],
  templateApplications: [],
  actionApplications: [],
  pressureUpdates: [],
  populationReport: null,
  templateUsage: null,
  coordinateStats: null,
  tagHealth: null,
  systemHealth: null,
  systemActions: [],
  entityBreakdown: null,
  catalystStats: null,
  relationshipBreakdown: null,
  notableEntities: null,
  result: null,
  stateExport: null,
  error: null,
  logs: [],
};
