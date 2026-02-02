/**
 * SimulationRunner - Runs the Lore Weave simulation
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { SimulationDashboard } from '../dashboard';
import DebugSettingsModal from '../DebugSettingsModal';
import ParameterForm from './ParameterForm';
import RunControls from './RunControls';
import ConfigViewer from './ConfigViewer';
import JSZip from 'jszip';

const DEBUG_MODAL_PREFIX = 'loreweave:debugModal:';

// Infrastructure systems excluded from validity checking
// These are framework systems that don't represent domain-specific behavior
const INFRASTRUCTURE_SYSTEMS = new Set([
  'era_spawner',           // Only fires at tick 0
  'era_transition',        // Always fires on era changes
  'universal_catalyst',    // Always fires (action selection infrastructure)
  'relationship_maintenance', // Cleanup system
]);

const RUN_SCORE_WEIGHTS = {
  templates: 3,
  actions: 2,
  systems: 1,
};

function countEnabled(items) {
  return (items || []).filter(item => item.enabled !== false).length;
}

function loadStoredBoolean(key) {
  if (!key || typeof localStorage === 'undefined') return false;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) === true : false;
  } catch {
    return false;
  }
}

function saveStoredBoolean(key, value) {
  if (!key || typeof localStorage === 'undefined') return;
  try {
    if (value) {
      localStorage.setItem(key, JSON.stringify(true));
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Best-effort only.
  }
}

/**
 * Extract unused systems from simulation result by scanning narrativeHistory.
 * System events have IDs like "sys-{systemId}-{tick}" or "sys-{systemId}:{entityId}-{tick}".
 */
function getUnusedSystems(narrativeHistory, systems) {
  // Get all system IDs that fired (from narrative events)
  const systemsUsed = new Set(
    (narrativeHistory || [])
      .filter(e => e.id?.startsWith('sys-'))
      .map(e => {
        // Extract system ID from "sys-{systemId}-{tick}" or "sys-{systemId}:{entityId}-{tick}"
        // Remove "sys-" prefix
        const withoutPrefix = e.id.slice(4);
        // Remove "-{tick}" suffix (last hyphen and everything after)
        const lastHyphen = withoutPrefix.lastIndexOf('-');
        if (lastHyphen === -1) return null;
        const withoutTick = withoutPrefix.slice(0, lastHyphen);
        // If there's a colon, take only the system ID (before colon)
        const colonIndex = withoutTick.indexOf(':');
        if (colonIndex !== -1) {
          return withoutTick.slice(0, colonIndex);
        }
        return withoutTick;
      })
      .filter(Boolean)
  );

  // Get all enabled system IDs (excluding infrastructure)
  const allSystemIds = (systems || [])
    .filter(s => s.enabled !== false)
    .map(s => s.config?.id || s.systemType)
    .filter(id => id && !INFRASTRUCTURE_SYSTEMS.has(id));

  // Return systems that never fired
  return allSystemIds.filter(id => !systemsUsed.has(id));
}

export default function SimulationRunner({
  projectId,
  schema,
  eras,
  pressures,
  generators,
  systems,
  actions,
  seedEntities,
  seedRelationships,
  distributionTargets,
  validation,
  isRunning,
  setIsRunning,
  onComplete,
  onViewResults,
  onSearchRunScored,
  externalSimulationState,
  onSimulationStateChange,
  simulationWorker,
}) {
  // Simulation parameters
  const [params, setParams] = useState({
    scaleFactor: 1.0,
    defaultMinDistance: 5,
    pressureDeltaSmoothing: 10,
    ticksPerEpoch: 20,
    maxEpochs: 14,
    maxTicks: 500,
    // Narrative event tracking
    narrativeEnabled: true,
    narrativeMinSignificance: 0,
    // Validity search
    maxValidityAttempts: 4,
  });

  // Debug configuration
  const [debugConfig, setDebugConfig] = useState({
    enabled: false,
    enabledCategories: [],
  });
  const debugModalKey = projectId ? `${DEBUG_MODAL_PREFIX}${projectId}` : `${DEBUG_MODAL_PREFIX}global`;
  const [showDebugModal, setShowDebugModal] = useState(() => loadStoredBoolean(debugModalKey));

  useEffect(() => {
    setShowDebugModal(loadStoredBoolean(debugModalKey));
  }, [debugModalKey]);

  useEffect(() => {
    saveStoredBoolean(debugModalKey, showDebugModal);
  }, [debugModalKey, showDebugModal]);

  // Use simulation worker passed from parent
  const {
    state: workerSimState,
    start: startWorker,
    startStepping: startSteppingWorker,
    step: stepWorker,
    runToCompletion: runToCompletionWorker,
    reset: resetWorker,
    abort: abortWorker,
    clearLogs: workerClearLogs,
    isRunning: workerIsRunning,
    isPaused: workerIsPaused
  } = simulationWorker;

  // Use external state if provided and worker is idle
  const simState = (workerSimState.status === 'idle' && externalSimulationState)
    ? externalSimulationState
    : workerSimState;

  // Sync worker state changes to external state
  const prevStatusRef = React.useRef(workerSimState.status);
  useEffect(() => {
    if (onSimulationStateChange && workerSimState.status !== 'idle') {
      if (prevStatusRef.current !== workerSimState.status) {
        prevStatusRef.current = workerSimState.status;
        onSimulationStateChange(workerSimState);
      }
    }
  }, [workerSimState.status, onSimulationStateChange]);

  // Wrap clearLogs to also clear external state
  const clearLogs = useCallback(() => {
    workerClearLogs();
    if (onSimulationStateChange && externalSimulationState) {
      onSimulationStateChange({ ...externalSimulationState, logs: [] });
    }
  }, [workerClearLogs, onSimulationStateChange, externalSimulationState]);

  // Handle completion
  useEffect(() => {
    if (simState.status === 'complete' && simState.result) {
      onComplete(simState.result);
    }
  }, [simState.status, simState.result, onComplete]);

  // Run scoring: templates fired (high), actions completed (med), systems executed (low)
  const runValidity = useMemo(() => {
    if (simState.status !== 'complete') {
      return {
        score: 0,
        maxScore: 0,
        scoreBreakdown: null,
        reachedFinalEra: false,
        unusedSystems: []
      };
    }

    const totalTemplates = simState.templateUsage?.totalTemplates ?? countEnabled(generators);
    const unusedTemplates = simState.templateUsage?.unusedTemplates || [];
    const templatesUsed = Math.max(totalTemplates - unusedTemplates.length, 0);

    const totalActions = countEnabled(actions);
    const unusedActions = simState.catalystStats?.unusedActions || [];
    const actionsUsed = Math.max(totalActions - unusedActions.length, 0);

    // Check systems fired (derived from narrativeHistory)
    const unusedSystems = getUnusedSystems(simState.result?.narrativeHistory, systems);
    const totalSystems = (systems || [])
      .filter(s => s.enabled !== false)
      .map(s => s.config?.id || s.systemType)
      .filter(id => id && !INFRASTRUCTURE_SYSTEMS.has(id))
      .length;
    const systemsUsed = Math.max(totalSystems - unusedSystems.length, 0);

    // Check if we reached the final era
    // The final era is the last one in the eras array
    const finalEraId = eras?.length > 0 ? eras[eras.length - 1].id : null;
    const currentEraId = simState.currentEpoch?.era?.id;
    const reachedFinalEra = finalEraId && currentEraId === finalEraId;

    const score = (templatesUsed * RUN_SCORE_WEIGHTS.templates)
      + (actionsUsed * RUN_SCORE_WEIGHTS.actions)
      + (systemsUsed * RUN_SCORE_WEIGHTS.systems);
    const maxScore = (totalTemplates * RUN_SCORE_WEIGHTS.templates)
      + (totalActions * RUN_SCORE_WEIGHTS.actions)
      + (totalSystems * RUN_SCORE_WEIGHTS.systems);

    return {
      score,
      maxScore,
      scoreBreakdown: {
        templates: {
          used: templatesUsed,
          total: totalTemplates,
          weight: RUN_SCORE_WEIGHTS.templates,
        },
        actions: {
          used: actionsUsed,
          total: totalActions,
          weight: RUN_SCORE_WEIGHTS.actions,
        },
        systems: {
          used: systemsUsed,
          total: totalSystems,
          weight: RUN_SCORE_WEIGHTS.systems,
        },
      },
      unusedSystems,
      reachedFinalEra
    };
  }, [simState.status, simState.templateUsage, simState.catalystStats, simState.result, simState.currentEpoch, eras, systems, generators, actions]);

  // Run Until Valid state
  const [validityAttempts, setValidityAttempts] = useState(0);
  const [isRunningUntilValid, setIsRunningUntilValid] = useState(false);
  const runUntilValidRef = useRef(false);

  // Store run data for validity search analysis
  const [validityRunData, setValidityRunData] = useState([]);
  const [validitySearchComplete, setValiditySearchComplete] = useState(false);

  // Generate the EngineConfig
  const engineConfig = useMemo(() => {
    return {
      schema,
      eras,
      pressures: pressures,
      templates: (generators || []).filter(g => g.enabled !== false),
      systems: (systems || []).filter(s => s.enabled !== false),
      actions: (actions || []).filter(a => a.enabled !== false),
      ticksPerEpoch: params.ticksPerEpoch,
      maxEpochs: params.maxEpochs,
      maxTicks: params.maxTicks,
      maxRelationshipsPerType: 10,
      scaleFactor: params.scaleFactor,
      defaultMinDistance: params.defaultMinDistance,
      pressureDeltaSmoothing: params.pressureDeltaSmoothing,
      seedRelationships: seedRelationships || [],
      distributionTargets: distributionTargets || undefined,
      debugConfig,
      // Narrative event tracking config
      narrativeConfig: {
        enabled: params.narrativeEnabled,
        minSignificance: params.narrativeMinSignificance,
      },
    };
  }, [schema, eras, pressures, generators, systems, actions, params, seedRelationships, distributionTargets, debugConfig]);

  // Run simulation
  const runSimulation = useCallback(() => {
    if (!validation.isValid) return;

    const initialEntities = seedEntities || [];
    startWorker(engineConfig, initialEntities);
  }, [validation, engineConfig, seedEntities, startWorker]);

  // Start in step mode
  const startStepMode = useCallback(() => {
    if (!validation.isValid) return;

    const initialEntities = seedEntities || [];
    startSteppingWorker(engineConfig, initialEntities);
  }, [validation, engineConfig, seedEntities, startSteppingWorker]);

  // Run Until Valid handler
  const runUntilValid = useCallback(() => {
    if (!validation.isValid) return;

    runUntilValidRef.current = true;
    setIsRunningUntilValid(true);
    setValidityAttempts(1);
    setValidityRunData([]); // Clear previous run data
    setValiditySearchComplete(false);

    const initialEntities = seedEntities || [];
    startWorker(engineConfig, initialEntities);
  }, [validation, engineConfig, seedEntities, startWorker]);

  // Cancel run until valid
  const cancelRunUntilValid = useCallback(() => {
    runUntilValidRef.current = false;
    setIsRunningUntilValid(false);
    setValiditySearchComplete(false);
    abortWorker();
  }, [abortWorker]);

  // Effect to handle "run until valid" loop and store run data
  useEffect(() => {
    if (!runUntilValidRef.current) return;
    if (simState.status !== 'complete') return;
    if (!simState.result) return; // Wait for result to be fully populated

    // Store this run's data for analysis - match canonry-slot export format
    const runData = {
      attempt: validityAttempts,
      runScore: runValidity.score,
      runScoreMax: runValidity.maxScore,
      runScoreDetails: runValidity.scoreBreakdown,
      finalEra: simState.currentEpoch?.era?.id || 'unknown',
      finalEraName: simState.currentEpoch?.era?.name || 'Unknown',
      reachedFinalEra: runValidity.reachedFinalEra,
      unusedTemplates: simState.templateUsage?.unusedTemplates?.map(t => t.templateId) || [],
      unusedActions: simState.catalystStats?.unusedActions?.map(a => a.actionId) || [],
      unusedSystems: runValidity.unusedSystems || [],
      entityCount: simState.result?.hardState?.length || 0,
      relationshipCount: simState.result?.relationships?.length || 0,
      // Store in canonry-slot format for script compatibility
      simulationResults: simState.result,
      simulationState: simState,
    };

    setValidityRunData(prev => [...prev, runData]);
    if (onSearchRunScored) {
      onSearchRunScored({
        attempt: runData.attempt,
        runScore: runData.runScore,
        runScoreMax: runData.runScoreMax,
        runScoreDetails: runData.runScoreDetails,
        simulationResults: runData.simulationResults,
        simulationState: runData.simulationState,
      });
    }

    // Check if we should continue
    if (runValidity.score >= runValidity.maxScore) {
      // Found a max-score run
      runUntilValidRef.current = false;
      setIsRunningUntilValid(false);
      setValiditySearchComplete(true);
      return;
    }

    if (validityAttempts >= params.maxValidityAttempts) {
      // Max attempts reached
      runUntilValidRef.current = false;
      setIsRunningUntilValid(false);
      setValiditySearchComplete(true);
      return;
    }

    // Schedule next run (start() already clears previous state)
    const timeoutId = setTimeout(() => {
      if (runUntilValidRef.current) {
        setValidityAttempts(prev => prev + 1);
        const initialEntities = seedEntities || [];
        startWorker(engineConfig, initialEntities);
      }
    }, 100); // Small delay to allow UI to update

    return () => clearTimeout(timeoutId);
  }, [simState.status, simState.result, simState.currentEpoch, simState.templateUsage, simState.catalystStats, runValidity, validityAttempts, params.maxValidityAttempts, engineConfig, seedEntities, startWorker, onSearchRunScored]);

  // Generate failure analysis report
  const validityReport = useMemo(() => {
    if (!validitySearchComplete || validityRunData.length === 0) return null;

    const bestRun = validityRunData.reduce((best, run) => {
      if (!best || run.runScore > best.runScore) return run;
      return best;
    }, null);

    return {
      summary: {
        totalAttempts: validityRunData.length,
        bestScore: bestRun?.runScore ?? 0,
        bestScoreMax: bestRun?.runScoreMax ?? null,
        bestAttempt: bestRun?.attempt || null,
      },
      runs: validityRunData.map(run => ({
        attempt: run.attempt,
        runScore: run.runScore,
        runScoreMax: run.runScoreMax,
        runScoreDetails: run.runScoreDetails,
        finalEra: run.finalEraName,
        reachedFinalEra: run.reachedFinalEra,
        unusedTemplateCount: run.unusedTemplates.length,
        unusedTemplates: run.unusedTemplates,
        unusedActionCount: run.unusedActions.length,
        unusedActions: run.unusedActions,
        unusedSystemCount: run.unusedSystems.length,
        unusedSystems: run.unusedSystems,
        entityCount: run.entityCount,
        relationshipCount: run.relationshipCount,
      })),
      failureAnalysis: {
        eraFailures: validityRunData.filter(r => !r.reachedFinalEra).length,
        templateFailures: validityRunData.filter(r => r.unusedTemplates.length > 0).length,
        actionFailures: validityRunData.filter(r => r.unusedActions.length > 0).length,
        systemFailures: validityRunData.filter(r => r.unusedSystems.length > 0).length,
        // Aggregate which templates/actions/systems failed most often
        templateFailureCounts: validityRunData.reduce((acc, run) => {
          run.unusedTemplates.forEach(t => {
            acc[t] = (acc[t] || 0) + 1;
          });
          return acc;
        }, {}),
        actionFailureCounts: validityRunData.reduce((acc, run) => {
          run.unusedActions.forEach(a => {
            acc[a] = (acc[a] || 0) + 1;
          });
          return acc;
        }, {}),
        systemFailureCounts: validityRunData.reduce((acc, run) => {
          run.unusedSystems.forEach(s => {
            acc[s] = (acc[s] || 0) + 1;
          });
          return acc;
        }, {}),
      },
    };
  }, [validitySearchComplete, validityRunData, eras]);

  // Download run data as zip - each run in canonry-slot format
  const downloadValidityData = useCallback(async () => {
    if (!validityReport || validityRunData.length === 0) return;

    const zip = new JSZip();

    // Add each run in canonry-slot export format for script compatibility
    validityRunData.forEach((run) => {
      if (run.simulationResults) {
        const slotPayload = {
          format: 'canonry-slot-export',
          version: 1,
          exportedAt: new Date().toISOString(),
          slot: {
            index: run.attempt,
            title: `validity-run-${run.attempt}`,
            createdAt: null,
            savedAt: null,
          },
          worldData: null, // Not available in this context
          simulationResults: run.simulationResults,
          simulationState: run.simulationState,
          worldContext: null,
          entityGuidance: null,
          cultureIdentities: null,
        };
        zip.file(`run-${run.attempt}.canonry-slot.json`, JSON.stringify(slotPayload, null, 2));
      }
    });

    // Add the analysis report
    zip.file('validity-report.json', JSON.stringify(validityReport, null, 2));

    // Generate and download
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validity-search-${validityRunData.length}-runs.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }, [validityReport, validityRunData]);

  const handleParamChange = (field, value) => {
    setParams(prev => ({ ...prev, [field]: value }));
  };

  // Show dashboard when running or has data
  const showDashboard = workerIsRunning ||
    workerIsPaused ||
    simState.status === 'complete' ||
    simState.status === 'error' ||
    simState.logs.length > 0;

  return (
    <div className="lw-container">
      <div className="lw-header">
        <h1 className="lw-title">Run Simulation</h1>
        <p className="lw-subtitle">
          Configure and run the world generation simulation
        </p>
      </div>

      {!validation.isValid && (
        <div className="lw-warning-box">
          Configuration is incomplete. Please fix the issues before running the simulation.
        </div>
      )}

      {simState.error && (
        <div className="lw-error-box">
          <strong>Error:</strong> {simState.error.message}
          {simState.error.phase && <span> (during {simState.error.phase})</span>}
        </div>
      )}

      {/* Parameters Card */}
      <div className="lw-card">
        <div className="lw-card-header" style={{ marginBottom: (workerIsRunning && !workerIsPaused) ? 0 : '16px' }}>
          <div className="lw-card-title" style={{ marginBottom: 0 }}>
            Simulation Parameters
          </div>
          <div className="lw-button-row" style={{ marginTop: 0 }}>
            <RunControls
              isRunning={workerIsRunning}
              isPaused={workerIsPaused}
              simState={simState}
              validation={validation}
              runValidity={runValidity}
              isRunningUntilValid={isRunningUntilValid}
              validityAttempts={validityAttempts}
              maxValidityAttempts={params.maxValidityAttempts}
              validitySearchComplete={validitySearchComplete}
              validityReport={validityReport}
              onRun={runSimulation}
              onRunUntilValid={runUntilValid}
              onCancelRunUntilValid={cancelRunUntilValid}
              onDownloadValidityData={downloadValidityData}
              onStartStepMode={startStepMode}
              onStep={stepWorker}
              onRunToCompletion={runToCompletionWorker}
              onAbort={abortWorker}
              onReset={resetWorker}
              onViewResults={onViewResults}
            />
          </div>
        </div>

        {!workerIsRunning && (
          <ParameterForm params={params} onParamChange={handleParamChange} />
        )}

        {!workerIsRunning && (
          <ConfigViewer
            engineConfig={engineConfig}
            debugConfig={debugConfig}
            onShowDebugModal={() => setShowDebugModal(true)}
          />
        )}
      </div>

      {/* Simulation Dashboard */}
      {showDashboard && (
        <SimulationDashboard
          simState={simState}
          onClearLogs={clearLogs}
        />
      )}

      {/* Debug Settings Modal */}
      <DebugSettingsModal
        isOpen={showDebugModal}
        onClose={() => setShowDebugModal(false)}
        debugConfig={debugConfig}
        onDebugConfigChange={setDebugConfig}
      />
    </div>
  );
}
