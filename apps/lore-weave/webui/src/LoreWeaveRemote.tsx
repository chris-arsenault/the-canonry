/**
 * LoreWeaveRemote - Module Federation entry point for Lore Weave
 */

import React, { useState, useMemo } from "react";
import "./App.css";
import ConfigurationSummary from "./components/config";
import { DistributionTargetsEditor } from "./components/targets";
import ValidationPanel from "./components/validation/ValidationPanel";
import { SimulationRunner } from "./components/runner";
import ResultsViewer from "./components/results";
import { useSimulationWorker } from "./hooks/useSimulationWorker";
import type { SimulationState } from "./hooks/useSimulationWorker";
import type { WorldOutput } from "@canonry/world-schema";

interface Culture {
  id: string;
  naming: { profiles: unknown[] };
  [key: string]: unknown;
}

interface DomainSchema {
  entityKinds: Array<{ kind: string; subtypes: Array<{ id: string }>; [key: string]: unknown }>;
  relationshipKinds: Array<{ kind: string; [key: string]: unknown }>;
  cultures: Culture[];
}

interface LoreWeaveRemoteProps {
  projectId: string;
  schema: DomainSchema;
  eras: unknown[];
  pressures: unknown[];
  generators: unknown[];
  systems: unknown[];
  actions: unknown[];
  seedEntities: unknown[];
  seedRelationships: unknown[];
  distributionTargets: Record<string, unknown> | null;
  onDistributionTargetsChange: (targets: Record<string, unknown>) => void;
  activeSection: string;
  onSectionChange: (section: string) => void;
  simulationResults: WorldOutput | null;
  onSimulationResultsChange: (results: WorldOutput | null) => void;
  simulationState: SimulationState | null;
  onSimulationStateChange: (state: SimulationState) => void;
  onSearchRunScored: (data: Record<string, unknown>) => void;
}

const TABS = [
  { id: "configure", label: "Configure" },
  { id: "targets", label: "Targets" },
  { id: "validate", label: "Validate" },
  { id: "run", label: "Run" },
  { id: "results", label: "Results" },
];

export default function LoreWeaveRemote({
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
  onDistributionTargetsChange,
  activeSection,
  onSectionChange,
  simulationResults: externalSimulationResults,
  onSimulationResultsChange,
  simulationState: externalSimulationState,
  onSimulationStateChange,
  onSearchRunScored,
}: Readonly<LoreWeaveRemoteProps>) {
  const activeTab = activeSection;
  const setActiveTab = onSectionChange;

  const simulationResults = externalSimulationResults;
  const setSimulationResults = onSimulationResultsChange;
  const [isRunning, setIsRunning] = useState(false);

  const simulationWorker = useSimulationWorker();

  const [prevIsRunning, setPrevIsRunning] = useState(simulationWorker.isRunning);
  if (prevIsRunning !== simulationWorker.isRunning) {
    setPrevIsRunning(simulationWorker.isRunning);
    setIsRunning(simulationWorker.isRunning);
  }

  const configValidation = useMemo(() => {
    const issues: string[] = [];
    const warnings: string[] = [];

    if (schema.entityKinds.length === 0) issues.push("No entity kinds defined");
    if (schema.relationshipKinds.length === 0) issues.push("No relationship kinds defined");
    if (schema.cultures.length === 0) issues.push("No cultures defined");
    if (eras.length === 0) issues.push("No eras defined");
    if (generators.length === 0) issues.push("No generators (growth templates) defined");

    if (pressures.length === 0) warnings.push("No pressures defined - simulation will have no dynamic feedback");
    if (seedEntities.length === 0) warnings.push("No seed entities - world will start empty");
    const hasNamingProfiles = schema.cultures.some((c) => c.naming?.profiles?.length);
    if (!hasNamingProfiles) warnings.push("No naming data - entities will need explicit names");

    return {
      isValid: issues.length === 0,
      issues,
      warnings,
      stats: {
        entityKinds: schema.entityKinds.length,
        relationshipKinds: schema.relationshipKinds.length,
        cultures: schema.cultures.length,
        eras: eras.length,
        pressures: pressures.length,
        generators: generators.length,
        seedEntities: seedEntities.length,
        seedRelationships: seedRelationships.length,
      },
    };
  }, [schema, eras, pressures, generators, seedEntities, seedRelationships]);

  const navigateToRun = React.useCallback(() => setActiveTab("run"), [setActiveTab]);
  const navigateToResults = React.useCallback(() => setActiveTab("results"), [setActiveTab]);

  const handleSimulationComplete = (results: WorldOutput | null) => {
    setSimulationResults(results);
    setIsRunning(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case "configure":
        return (
          <ConfigurationSummary
            schema={schema}
            eras={eras}
            pressures={pressures}
            generators={generators}
            seedEntities={seedEntities}
            seedRelationships={seedRelationships}
            validation={configValidation}
            onNavigateToRun={navigateToRun}
          />
        );
      case "targets":
        return (
          <DistributionTargetsEditor
            distributionTargets={distributionTargets as Parameters<typeof DistributionTargetsEditor>[0]['distributionTargets']}
            schema={schema as Parameters<typeof DistributionTargetsEditor>[0]['schema']}
            onDistributionTargetsChange={onDistributionTargetsChange as Parameters<typeof DistributionTargetsEditor>[0]['onDistributionTargetsChange']}
          />
        );
      case "validate":
        return (
          <ValidationPanel
            schema={schema}
            eras={eras}
            generators={generators}
            pressures={pressures}
            systems={systems}
            actions={actions}
            seedEntities={seedEntities}
          />
        );
      case "run":
        return (
          <SimulationRunner
            projectId={projectId}
            schema={schema}
            eras={eras}
            pressures={pressures}
            generators={generators}
            systems={systems}
            actions={actions}
            seedEntities={seedEntities}
            seedRelationships={seedRelationships}
            distributionTargets={distributionTargets}
            validation={configValidation}
            isRunning={isRunning}
            setIsRunning={setIsRunning}
            onComplete={handleSimulationComplete}
            onViewResults={navigateToResults}
            externalSimulationState={externalSimulationState}
            onSimulationStateChange={onSimulationStateChange}
            onSearchRunScored={onSearchRunScored}
            simulationWorker={simulationWorker}
          />
        );
      case "results":
        return (
          <ResultsViewer
            results={simulationResults}
            schema={schema}
            onNewRun={navigateToRun}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="lw-app-container">
      <div className="lw-sidebar">
        <nav className="lw-sidebar-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`lw-nav-button ${activeTab === tab.id ? "active" : ""}`}
            >
              {tab.label}
              {tab.id === "results" && simulationResults && (
                <span className="lw-nav-badge">{(simulationResults.metadata as Record<string, unknown>)?.entityCount as number || 0}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="lw-main-area">
        <div className="lw-content-area">{renderContent()}</div>
      </div>
    </div>
  );
}
