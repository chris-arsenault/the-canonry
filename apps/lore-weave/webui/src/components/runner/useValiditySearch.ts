/**
 * useValiditySearch — Hook for running multiple simulation attempts
 * and selecting the best scoring run.
 */

import { useCallback, useEffect, useRef, useMemo, useReducer } from "react";
import type { SimulationState } from "../../hooks/useSimulationWorker";
import type { WorldOutput } from "@canonry/world-schema";
import type { HardState } from "../../../../lib/core/worldTypes";
import type { EngineConfig } from "../../../../lib/engine/types";
import JSZip from "jszip";

const INFRASTRUCTURE_SYSTEMS = new Set(["era_spawner", "era_transition", "universal_catalyst", "relationship_maintenance"]);
const RUN_SCORE_WEIGHTS = { templates: 3, actions: 2, systems: 1 };

interface ConfigItem { enabled: boolean; config: { id: string }; systemType: string; [key: string]: unknown; }
interface NarrativeEvent { id: string; [key: string]: unknown; }
interface ScoreBreakdownEntry { used: number; total: number; weight: number; }

export interface RunValidityState {
  score: number;
  maxScore: number;
  scoreBreakdown: { templates: ScoreBreakdownEntry; actions: ScoreBreakdownEntry; systems: ScoreBreakdownEntry } | null;
  reachedFinalEra: boolean;
  unusedSystems: string[];
}

interface RunDataEntry {
  attempt: number; runScore: number; runScoreMax: number;
  runScoreDetails: RunValidityState["scoreBreakdown"];
  finalEra: string; finalEraName: string; reachedFinalEra: boolean;
  unusedTemplates: string[]; unusedActions: string[]; unusedSystems: string[];
  entityCount: number; relationshipCount: number;
  simulationResults: WorldOutput; simulationState: SimulationState;
}

export interface ValidityReport {
  summary: { totalAttempts: number; bestScore: number; bestScoreMax: number | null; bestAttempt: number | null };
  runs: Array<Record<string, unknown>>;
  failureAnalysis: Record<string, unknown>;
}

function countEnabled(items: ConfigItem[]): number {
  return items.filter((item) => item.enabled !== false).length;
}

function getUnusedSystems(narrativeHistory: NarrativeEvent[] | undefined, systems: ConfigItem[]): string[] {
  const used = new Set(
    (narrativeHistory || []).filter((e) => e.id?.startsWith("sys-")).map((e) => {
      const w = e.id.slice(4); const h = w.lastIndexOf("-");
      if (h === -1) return null;
      const t = w.slice(0, h); const c = t.indexOf(":");
      return c !== -1 ? t.slice(0, c) : t;
    }).filter(Boolean)
  );
  return systems.filter((s) => s.enabled !== false)
    .map((s) => s.config?.id || s.systemType || "")
    .filter((id) => id && !INFRASTRUCTURE_SYSTEMS.has(id) && !used.has(id));
}

interface UseValiditySearchParams {
  simState: SimulationState;
  generators: ConfigItem[]; actions: ConfigItem[]; systems: ConfigItem[]; eras: ConfigItem[];
  seedEntities: HardState[]; engineConfig: Record<string, unknown>;
  maxValidityAttempts: number;
  startWorker: (config: EngineConfig, entities: HardState[]) => void;
  abortWorker: () => void;
  onSearchRunScored: ((data: Record<string, unknown>) => void) | null;
}

// Consolidated search state to avoid cascading setState in effects
interface SearchState {
  attempts: number;
  running: boolean;
  complete: boolean;
  runData: RunDataEntry[];
}

type SearchAction =
  | { type: "start" }
  | { type: "cancel" }
  | { type: "complete"; runData: RunDataEntry }
  | { type: "continue"; runData: RunDataEntry };

function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case "start": return { attempts: 1, running: true, complete: false, runData: [] };
    case "cancel": return { ...state, running: false, complete: false };
    case "complete": return { ...state, running: false, complete: true, runData: [...state.runData, action.runData] };
    case "continue": return { ...state, attempts: state.attempts + 1, runData: [...state.runData, action.runData] };
  }
}

const INITIAL_SEARCH: SearchState = { attempts: 0, running: false, complete: false, runData: [] };

function buildRunData(
  simState: SimulationState, runValidity: RunValidityState, attempt: number
): RunDataEntry {
  return {
    attempt, runScore: runValidity.score, runScoreMax: runValidity.maxScore,
    runScoreDetails: runValidity.scoreBreakdown,
    finalEra: simState.currentEpoch?.era?.id || "unknown",
    finalEraName: simState.currentEpoch?.era?.name || "Unknown",
    reachedFinalEra: runValidity.reachedFinalEra,
    unusedTemplates: (simState.templateUsage?.unusedTemplates as Array<{ templateId: string }> || []).map((t) => t.templateId),
    unusedActions: (simState.catalystStats?.unusedActions as Array<{ actionId: string }> || []).map((a) => a.actionId),
    unusedSystems: runValidity.unusedSystems || [],
    entityCount: (simState.result as Record<string, unknown>)?.hardState ? ((simState.result as Record<string, unknown>).hardState as unknown[]).length : 0,
    relationshipCount: (simState.result as Record<string, unknown>)?.relationships ? ((simState.result as Record<string, unknown>).relationships as unknown[]).length : 0,
    simulationResults: simState.result as unknown as WorldOutput,
    simulationState: simState,
  };
}

function notifyScored(onSearchRunScored: ((data: Record<string, unknown>) => void) | null, runData: RunDataEntry): void {
  if (!onSearchRunScored) return;
  onSearchRunScored({ attempt: runData.attempt, runScore: runData.runScore, runScoreMax: runData.runScoreMax,
    runScoreDetails: runData.runScoreDetails, simulationResults: runData.simulationResults, simulationState: runData.simulationState,
  } as unknown as Record<string, unknown>);
}

export function useValiditySearch({
  simState, generators, actions, systems, eras, seedEntities,
  engineConfig, maxValidityAttempts, startWorker, abortWorker, onSearchRunScored,
}: UseValiditySearchParams) {
  const runValidity: RunValidityState = useMemo(() => {
    if (simState.status !== "complete") return { score: 0, maxScore: 0, scoreBreakdown: null, reachedFinalEra: false, unusedSystems: [] };

    const totalTemplates = simState.templateUsage?.totalTemplates ?? countEnabled(generators);
    const unusedTemplates = simState.templateUsage?.unusedTemplates || [];
    const templatesUsed = Math.max(totalTemplates - unusedTemplates.length, 0);
    const totalActions = countEnabled(actions);
    const unusedActions = simState.catalystStats?.unusedActions || [];
    const actionsUsed = Math.max(totalActions - unusedActions.length, 0);
    const unusedSystems = getUnusedSystems((simState.result as Record<string, unknown>)?.narrativeHistory as NarrativeEvent[] | undefined, systems);
    const totalSystems = systems.filter((s) => s.enabled !== false).map((s) => s.config?.id || s.systemType || "").filter((id) => id && !INFRASTRUCTURE_SYSTEMS.has(id)).length;
    const systemsUsed = Math.max(totalSystems - unusedSystems.length, 0);
    const finalEraId = eras.length > 0 ? (eras[eras.length - 1] as Record<string, unknown>).id as string : null;
    const reachedFinalEra = !!finalEraId && simState.currentEpoch?.era?.id === finalEraId;

    const score = templatesUsed * RUN_SCORE_WEIGHTS.templates + actionsUsed * RUN_SCORE_WEIGHTS.actions + systemsUsed * RUN_SCORE_WEIGHTS.systems;
    const maxScore = totalTemplates * RUN_SCORE_WEIGHTS.templates + totalActions * RUN_SCORE_WEIGHTS.actions + totalSystems * RUN_SCORE_WEIGHTS.systems;

    return { score, maxScore, scoreBreakdown: {
      templates: { used: templatesUsed, total: totalTemplates, weight: RUN_SCORE_WEIGHTS.templates },
      actions: { used: actionsUsed, total: totalActions, weight: RUN_SCORE_WEIGHTS.actions },
      systems: { used: systemsUsed, total: totalSystems, weight: RUN_SCORE_WEIGHTS.systems },
    }, unusedSystems, reachedFinalEra };
  }, [simState.status, simState.templateUsage, simState.catalystStats, simState.result, simState.currentEpoch, eras, systems, generators, actions]);

  const [search, dispatch] = useReducer(searchReducer, INITIAL_SEARCH);
  const runUntilValidRef = useRef(false);

  const runUntilValid = useCallback(() => {
    runUntilValidRef.current = true;
    dispatch({ type: "start" });
    startWorker(engineConfig as unknown as EngineConfig, seedEntities);
  }, [engineConfig, seedEntities, startWorker]);

  const cancelRunUntilValid = useCallback(() => {
    runUntilValidRef.current = false;
    dispatch({ type: "cancel" });
    abortWorker();
  }, [abortWorker]);

  useEffect(() => {
    if (!runUntilValidRef.current || simState.status !== "complete" || !simState.result) return;

    const runData = buildRunData(simState, runValidity, search.attempts);
    notifyScored(onSearchRunScored, runData);

    const done = runValidity.score >= runValidity.maxScore || search.attempts >= maxValidityAttempts;
    if (done) {
      runUntilValidRef.current = false;
      dispatch({ type: "complete", runData });
      return;
    }

    // Continue search — accumulate data and schedule next run
    dispatch({ type: "continue", runData });
    const timeoutId = setTimeout(() => {
      if (runUntilValidRef.current) startWorker(engineConfig as unknown as EngineConfig, seedEntities);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [simState.status, simState.result, simState.currentEpoch, simState.templateUsage, simState.catalystStats,
    runValidity, search.attempts, maxValidityAttempts, engineConfig, seedEntities, startWorker, onSearchRunScored]);

  const validityReport: ValidityReport | null = useMemo(() => {
    if (!search.complete || search.runData.length === 0) return null;
    const bestRun = search.runData.reduce<RunDataEntry | null>((best, run) => (!best || run.runScore > best.runScore) ? run : best, null);
    return {
      summary: { totalAttempts: search.runData.length, bestScore: bestRun?.runScore ?? 0, bestScoreMax: bestRun?.runScoreMax ?? null, bestAttempt: bestRun?.attempt || null },
      runs: search.runData.map((run) => ({
        attempt: run.attempt, runScore: run.runScore, runScoreMax: run.runScoreMax,
        runScoreDetails: run.runScoreDetails, finalEra: run.finalEraName, reachedFinalEra: run.reachedFinalEra,
        unusedTemplateCount: run.unusedTemplates.length, unusedTemplates: run.unusedTemplates,
        unusedActionCount: run.unusedActions.length, unusedActions: run.unusedActions,
        unusedSystemCount: run.unusedSystems.length, unusedSystems: run.unusedSystems,
        entityCount: run.entityCount, relationshipCount: run.relationshipCount,
      })),
      failureAnalysis: {
        eraFailures: search.runData.filter((r) => !r.reachedFinalEra).length,
        templateFailures: search.runData.filter((r) => r.unusedTemplates.length > 0).length,
        actionFailures: search.runData.filter((r) => r.unusedActions.length > 0).length,
        systemFailures: search.runData.filter((r) => r.unusedSystems.length > 0).length,
        templateFailureCounts: search.runData.reduce<Record<string, number>>((acc, run) => { run.unusedTemplates.forEach((t) => { acc[t] = (acc[t] || 0) + 1; }); return acc; }, {}),
        actionFailureCounts: search.runData.reduce<Record<string, number>>((acc, run) => { run.unusedActions.forEach((a) => { acc[a] = (acc[a] || 0) + 1; }); return acc; }, {}),
        systemFailureCounts: search.runData.reduce<Record<string, number>>((acc, run) => { run.unusedSystems.forEach((s) => { acc[s] = (acc[s] || 0) + 1; }); return acc; }, {}),
      },
    };
  }, [search.complete, search.runData]);

  const downloadValidityData = useCallback(async () => {
    if (!validityReport || search.runData.length === 0) return;
    const zip = new JSZip();
    search.runData.forEach((run) => {
      if (run.simulationResults) {
        zip.file(`run-${String(run.attempt)}.canonry-slot.json`, JSON.stringify({
          format: "canonry-slot-export", version: 1, exportedAt: new Date().toISOString(),
          slot: { index: run.attempt, title: `validity-run-${String(run.attempt)}`, createdAt: null, savedAt: null },
          worldData: null, simulationResults: run.simulationResults, simulationState: run.simulationState,
          worldContext: null, entityGuidance: null, cultureIdentities: null,
        }, null, 2));
      }
    });
    zip.file("validity-report.json", JSON.stringify(validityReport, null, 2));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `validity-search-${String(search.runData.length)}-runs.zip`;
    a.click(); URL.revokeObjectURL(url);
  }, [validityReport, search.runData]);

  return {
    runValidity,
    validityAttempts: search.attempts,
    isRunningUntilValid: search.running,
    validitySearchComplete: search.complete,
    validityReport,
    runUntilValid,
    cancelRunUntilValid,
    downloadValidityData,
  };
}
