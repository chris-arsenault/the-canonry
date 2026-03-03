/**
 * SimulationRunner - Runs the Lore Weave simulation
 */

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { SimulationDashboard } from "../dashboard";
import DebugSettingsModal from "../DebugSettingsModal";
import "./SimulationRunner.css";
import ParameterForm from "./ParameterForm";
import RunControls from "./RunControls";
import ConfigViewer from "./ConfigViewer";
import type { SimulationState, UseSimulationWorkerReturn } from "../../hooks/useSimulationWorker";
import type { WorldOutput } from "@canonry/world-schema";
import type { HardState } from "../../../../lib/core/worldTypes";
import type { EngineConfig } from "../../../../lib/engine/types";
import { useValiditySearch } from "./useValiditySearch";

const DEBUG_MODAL_PREFIX = "loreweave:debugModal:";

function loadStoredBoolean(key: string): boolean {
  if (!key || typeof localStorage === "undefined") return false;
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) === true : false; }
  catch { return false; }
}

function saveStoredBoolean(key: string, value: boolean) {
  if (!key || typeof localStorage === "undefined") return;
  try { if (value) localStorage.setItem(key, JSON.stringify(true)); else localStorage.removeItem(key); }
  catch { /* best effort */ }
}

interface ConfigItem {
  enabled: boolean;
  config: { id: string };
  systemType: string;
  [key: string]: unknown;
}

interface ValidationState {
  isValid: boolean;
  issues: string[];
  warnings: string[];
  stats: Record<string, number>;
}

interface SimulationRunnerProps {
  projectId: string;
  schema: Record<string, unknown>;
  eras: ConfigItem[];
  pressures: ConfigItem[];
  generators: ConfigItem[];
  systems: ConfigItem[];
  actions: ConfigItem[];
  seedEntities: HardState[];
  seedRelationships: unknown[];
  distributionTargets: Record<string, unknown> | null;
  validation: ValidationState;
  isRunning: boolean;
  setIsRunning: (v: boolean) => void;
  onComplete: (results: WorldOutput | null) => void;
  onViewResults: (() => void) | null;
  onSearchRunScored: ((data: Record<string, unknown>) => void) | null;
  externalSimulationState: SimulationState | null;
  onSimulationStateChange: ((state: SimulationState) => void) | null;
  simulationWorker: UseSimulationWorkerReturn;
}

export default function SimulationRunner({
  projectId, schema, eras, pressures, generators, systems, actions,
  seedEntities, seedRelationships, distributionTargets, validation,
  onComplete, onViewResults, onSearchRunScored,
  externalSimulationState, onSimulationStateChange, simulationWorker,
}: Readonly<SimulationRunnerProps>) {
  const [params, setParams] = useState({
    scaleFactor: 1.0, defaultMinDistance: 5, pressureDeltaSmoothing: 10,
    ticksPerEpoch: 20, maxEpochs: 14, maxTicks: 500,
    narrativeEnabled: true, narrativeMinSignificance: 0, maxValidityAttempts: 4,
  });

  // Debug config with localStorage persistence
  const [debugConfig, setDebugConfig] = useState({ enabled: false, enabledCategories: [] as string[] });
  const debugModalKey = projectId ? `${DEBUG_MODAL_PREFIX}${projectId}` : `${DEBUG_MODAL_PREFIX}global`;
  const [showDebugModal, setShowDebugModal] = useState(() => loadStoredBoolean(debugModalKey));
  useEffect(() => { setShowDebugModal(loadStoredBoolean(debugModalKey)); }, [debugModalKey]);
  useEffect(() => { saveStoredBoolean(debugModalKey, showDebugModal); }, [debugModalKey, showDebugModal]);

  // Worker integration
  const {
    state: workerSimState, start: startWorker, startStepping: startSteppingWorker,
    step: stepWorker, runToCompletion: runToCompletionWorker,
    reset: resetWorker, abort: abortWorker, clearLogs: workerClearLogs,
    isRunning: workerIsRunning, isPaused: workerIsPaused,
  } = simulationWorker;

  const simState: SimulationState = workerSimState.status === "idle" && externalSimulationState
    ? externalSimulationState : workerSimState;

  const prevStatusRef = React.useRef(workerSimState.status);
  useEffect(() => {
    if (onSimulationStateChange && workerSimState.status !== "idle" && prevStatusRef.current !== workerSimState.status) {
      prevStatusRef.current = workerSimState.status;
      onSimulationStateChange(workerSimState);
    }
  }, [workerSimState, workerSimState.status, onSimulationStateChange]);

  const clearLogs = useCallback(() => {
    workerClearLogs();
    if (onSimulationStateChange && externalSimulationState) onSimulationStateChange({ ...externalSimulationState, logs: [] });
  }, [workerClearLogs, onSimulationStateChange, externalSimulationState]);

  useEffect(() => {
    if (simState.status === "complete" && simState.result) onComplete(simState.result as unknown as WorldOutput);
  }, [simState.status, simState.result, onComplete]);

  // Engine config
  const engineConfig = useMemo(() => ({
    schema, eras, pressures,
    templates: generators.filter((g) => g.enabled !== false),
    systems: systems.filter((s) => s.enabled !== false),
    actions: actions.filter((a) => a.enabled !== false),
    ticksPerEpoch: params.ticksPerEpoch, maxEpochs: params.maxEpochs, maxTicks: params.maxTicks,
    maxRelationshipsPerType: 10, scaleFactor: params.scaleFactor,
    defaultMinDistance: params.defaultMinDistance, pressureDeltaSmoothing: params.pressureDeltaSmoothing,
    seedRelationships: seedRelationships || [], distributionTargets: distributionTargets || undefined,
    debugConfig, narrativeConfig: { enabled: params.narrativeEnabled, minSignificance: params.narrativeMinSignificance },
  }), [schema, eras, pressures, generators, systems, actions, params, seedRelationships, distributionTargets, debugConfig]);

  const runSimulation = useCallback(() => {
    if (validation.isValid) startWorker(engineConfig as unknown as EngineConfig, seedEntities);
  }, [validation, engineConfig, seedEntities, startWorker]);

  const startStepMode = useCallback(() => {
    if (validation.isValid) startSteppingWorker(engineConfig as unknown as EngineConfig, seedEntities);
  }, [validation, engineConfig, seedEntities, startSteppingWorker]);

  // Validity search
  const validity = useValiditySearch({
    simState, generators, actions, systems, eras, seedEntities,
    engineConfig, maxValidityAttempts: params.maxValidityAttempts,
    startWorker, abortWorker, onSearchRunScored,
  });

  const wrappedRunUntilValid = useCallback(() => {
    if (validation.isValid) validity.runUntilValid();
  }, [validation, validity]);

  const handleParamChange = useCallback((field: string, value: number | boolean) => {
    setParams((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleDownloadValidity = useCallback(() => void validity.downloadValidityData(), [validity]);
  const openDebugModal = useCallback(() => setShowDebugModal(true), []);
  const closeDebugModal = useCallback(() => setShowDebugModal(false), []);

  const showDashboard = workerIsRunning || workerIsPaused || simState.status === "complete" || simState.status === "error" || simState.logs.length > 0;

  return (
    <div className="lw-container">
      <div className="lw-header">
        <h1 className="lw-title">Run Simulation</h1>
        <p className="lw-subtitle">Configure and run the world generation simulation</p>
      </div>

      {!validation.isValid && <div className="lw-warning-box">Configuration is incomplete.</div>}

      {simState.error && (
        <div className="lw-issue-box">
          <strong>Error:</strong> {simState.error.message}
          {simState.error.phase && <span> (during {simState.error.phase})</span>}
        </div>
      )}

      <div className="lw-card">
        <div className={`lw-card-header ${workerIsRunning && !workerIsPaused ? "sr-card-header-running" : ""}`}>
          <div className="lw-card-title sr-card-title-flush">Simulation Parameters</div>
          <div className="lw-button-row sr-button-row-flush">
            <RunControls
              isRunning={workerIsRunning} isPaused={workerIsPaused} simState={simState} validation={validation}
              runValidity={validity.runValidity} isRunningUntilValid={validity.isRunningUntilValid}
              validityAttempts={validity.validityAttempts} maxValidityAttempts={params.maxValidityAttempts}
              validitySearchComplete={validity.validitySearchComplete} validityReport={validity.validityReport}
              onRun={runSimulation} onRunUntilValid={wrappedRunUntilValid}
              onCancelRunUntilValid={validity.cancelRunUntilValid}
              onDownloadValidityData={handleDownloadValidity}
              onStartStepMode={startStepMode} onStep={stepWorker} onRunToCompletion={runToCompletionWorker}
              onAbort={abortWorker} onReset={resetWorker} onViewResults={onViewResults}
            />
          </div>
        </div>
        {!workerIsRunning && <ParameterForm params={params} onParamChange={handleParamChange} />}
        {!workerIsRunning && <ConfigViewer engineConfig={engineConfig} debugConfig={debugConfig} onShowDebugModal={openDebugModal} />}
      </div>

      {showDashboard && <SimulationDashboard simState={simState} onClearLogs={clearLogs} />}
      <DebugSettingsModal isOpen={showDebugModal} onClose={closeDebugModal} debugConfig={debugConfig} onDebugConfigChange={setDebugConfig} />
    </div>
  );
}
