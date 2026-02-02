/**
 * LoreWeaveRemote - Module Federation entry point for Lore Weave
 *
 * This component is loaded by The Canonry shell and receives:
 * - schema: Read-only world schema (entityKinds, relationshipKinds, cultures)
 * - eras: Array of era configurations
 * - pressures: Array of pressure configurations
 * - generators: Array of growth template configurations
 * - seedEntities: Initial entities for the world
 * - seedRelationships: Initial relationships for the world
 * - activeSection: Current navigation section
 * - onSectionChange: Callback when navigation changes
 *
 * Lore Weave generates procedural world history by running growth templates
 * and simulation systems in alternating phases across multiple eras.
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import './App.css';
import ConfigurationSummary from './components/config';
import { DistributionTargetsEditor } from './components/targets';
import ValidationPanel from './components/validation/ValidationPanel';
import { SimulationRunner } from './components/runner';
import ResultsViewer from './components/results';
import { useSimulationWorker } from './hooks/useSimulationWorker';

const TABS = [
  { id: 'configure', label: 'Configure' },
  { id: 'targets', label: 'Targets' },
  { id: 'validate', label: 'Validate' },
  { id: 'run', label: 'Run' },
  { id: 'results', label: 'Results' },
];

export default function LoreWeaveRemote({
  projectId,
  schema = { entityKinds: [], relationshipKinds: [], cultures: [] },
  eras = [],
  pressures = [],
  generators = [],
  systems = [],
  actions = [],
  seedEntities = [],
  seedRelationships = [],
  distributionTargets = null,
  onDistributionTargetsChange,
  activeSection,
  onSectionChange,
  simulationResults: externalSimulationResults,
  onSimulationResultsChange,
  simulationState: externalSimulationState,
  onSimulationStateChange,
  onSearchRunScored,
}) {
  // Use passed-in section or default to 'configure'
  const activeTab = activeSection || 'configure';
  const setActiveTab = onSectionChange || (() => {});

  // Simulation state - use external state if provided, otherwise use local state
  const [localSimulationResults, setLocalSimulationResults] = useState(null);
  const simulationResults = externalSimulationResults !== undefined ? externalSimulationResults : localSimulationResults;
  const setSimulationResults = onSimulationResultsChange || setLocalSimulationResults;
  const [isRunning, setIsRunning] = useState(false);

  // Lift worker management to this level so it persists across tab navigation
  // This allows stepping through epochs, exporting to Archivist, and returning to continue
  const simulationWorker = useSimulationWorker();

  // Sync worker running state (only update if value actually changed)
  const prevIsRunningRef = useRef(simulationWorker.isRunning);
  useEffect(() => {
    if (prevIsRunningRef.current !== simulationWorker.isRunning) {
      prevIsRunningRef.current = simulationWorker.isRunning;
      setIsRunning(simulationWorker.isRunning);
    }
  }, [simulationWorker.isRunning]);

  // Validate configuration completeness
  const configValidation = useMemo(() => {
    const issues = [];
    const warnings = [];

    // Required elements
    if (schema.entityKinds.length === 0) {
      issues.push('No entity kinds defined');
    }
    if (schema.relationshipKinds.length === 0) {
      issues.push('No relationship kinds defined');
    }
    if (schema.cultures.length === 0) {
      issues.push('No cultures defined');
    }
    if (eras.length === 0) {
      issues.push('No eras defined');
    }
    if (generators.length === 0) {
      issues.push('No generators (growth templates) defined');
    }

    // Warnings
    if (pressures.length === 0) {
      warnings.push('No pressures defined - simulation will have no dynamic feedback');
    }
    if (seedEntities.length === 0) {
      warnings.push('No seed entities - world will start empty');
    }
    const hasNamingProfiles = schema.cultures.some(c => c.naming?.profiles?.length);
    if (!hasNamingProfiles) {
      warnings.push('No naming data - entities will need explicit names');
    }

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

  // Handle simulation completion (don't auto-navigate - let user review logs first)
  const handleSimulationComplete = useCallback((results) => {
    setSimulationResults(results);
    setIsRunning(false);
    // Don't auto-navigate to results - user will click "View Results" button
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'configure':
        return (
          <ConfigurationSummary
            schema={schema}
            eras={eras}
            pressures={pressures}
            generators={generators}
            seedEntities={seedEntities}
            seedRelationships={seedRelationships}
            validation={configValidation}
            onNavigateToRun={() => setActiveTab('run')}
          />
        );
      case 'targets':
        return (
          <DistributionTargetsEditor
            distributionTargets={distributionTargets}
            schema={schema}
            onDistributionTargetsChange={onDistributionTargetsChange}
          />
        );
      case 'validate':
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
      case 'run':
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
            onViewResults={() => setActiveTab('results')}
            externalSimulationState={externalSimulationState}
            onSimulationStateChange={onSimulationStateChange}
            onSearchRunScored={onSearchRunScored}
            simulationWorker={simulationWorker}
          />
        );
      case 'results':
        return (
          <ResultsViewer
            results={simulationResults}
            schema={schema}
            onNewRun={() => setActiveTab('run')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="lw-app-container">
      {/* Left sidebar with nav */}
      <div className="lw-sidebar">
        <nav className="lw-sidebar-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`lw-nav-button ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
              {tab.id === 'results' && simulationResults && (
                <span className="lw-nav-badge">
                  {simulationResults.metadata?.entityCount || 0}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Main content area */}
      <div className="lw-main-area">
        <div className="lw-content-area">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
