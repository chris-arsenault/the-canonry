/**
 * ResultsViewer - Displays simulation results
 */

import React from "react";
import { useState, useMemo } from "react";
import "./ResultsViewer.css";

interface Entity {
  kind: string;
  subtype: string;
  [key: string]: unknown;
}

interface Relationship {
  kind: string;
  [key: string]: unknown;
}

interface ResultsMetadata {
  entityCount: number;
  relationshipCount: number;
  tick: number;
  epoch: number;
  era: string;
  [key: string]: unknown;
}

interface SimulationResults {
  metadata: ResultsMetadata;
  hardState: Entity[];
  relationships: Relationship[];
  pressures: Record<string, number>;
  engineConfig: Record<string, unknown>;
}

interface ResultsViewerProps {
  results: SimulationResults | null;
  schema: Record<string, unknown>;
  onNewRun: () => void;
}

function StatCard({ label, value }: Readonly<{ label: string; value: number | string }>) {
  return (
    <div className="lw-stat-card">
      <div className="lw-stat-card-label">{label}</div>
      <div className="lw-stat-card-value">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function PressureBar({ name, value }: Readonly<{ name: string; value: number }>) {
  const numValue = typeof value === "number" ? value : 50;
  const percent = Math.max(0, Math.min(100, numValue));

  let color;
  if (percent > 70) color = "var(--lw-danger)";
  else if (percent > 30) color = "var(--lw-warning)";
  else color = "var(--lw-success)";

  return (
    <div className="lw-pressure-gauge">
      <span className="lw-pressure-name">{name}</span>
      <div className="lw-pressure-bar">
        <div
          className="lw-pressure-fill rv-pressure-fill"
          style={{ '--rv-pressure-fill-width': `${String(percent)}%`, '--rv-pressure-fill-color': color as string } as React.CSSProperties}
        />
      </div>
      <span className="lw-pressure-value">{numValue.toFixed(0)}</span>
    </div>
  );
}

function OverviewTab({ entityGroups, relationshipGroups }: Readonly<{ entityGroups: Record<string, Entity[]>; relationshipGroups: Record<string, Relationship[]> }>) {
  return (
    <>
      <div className="lw-card">
        <div className="lw-card-title">Entity Breakdown ({Object.keys(entityGroups).length} types)</div>
        <div className="lw-item-list">
          {Object.entries(entityGroups).map(([type, entities]) => <span key={type} className="lw-item-badge">{type}: {entities.length}</span>)}
          {Object.keys(entityGroups).length === 0 && <span className="lw-comment">No entities generated</span>}
        </div>
      </div>
      <div className="lw-card">
        <div className="lw-card-title">Relationship Types ({Object.keys(relationshipGroups).length} kinds)</div>
        <div className="lw-item-list">
          {Object.entries(relationshipGroups).map(([kind, rels]) => <span key={kind} className="lw-item-badge">{kind}: {rels.length}</span>)}
          {Object.keys(relationshipGroups).length === 0 && <span className="lw-comment">No relationships generated</span>}
        </div>
      </div>
    </>
  );
}

function ResultsTabContent({ activeTab, processedData, results }: Readonly<{
  activeTab: string;
  processedData: { entityGroups: Record<string, Entity[]>; relationshipGroups: Record<string, Relationship[]>; pressures: Record<string, number>; engineConfig: Record<string, unknown> };
  results: SimulationResults;
}>) {
  if (activeTab === "overview") return <OverviewTab entityGroups={processedData.entityGroups} relationshipGroups={processedData.relationshipGroups} />;
  if (activeTab === "entities") return (
    <div className="lw-card"><div className="lw-card-title">Generated Entities</div>
      {results.hardState.length === 0 ? <div className="lw-comment">No entities generated.</div> : <div className="lw-code-block">{JSON.stringify(results.hardState, null, 2)}</div>}
    </div>
  );
  if (activeTab === "pressures") return (
    <div className="lw-card"><div className="lw-card-title">Final Pressure States</div>
      {Object.entries(processedData.pressures).length === 0 ? <div className="lw-comment">No pressure data</div> : (
        <div className="lw-flex-col lw-gap-md">{Object.entries(processedData.pressures).map(([name, value]) => <PressureBar key={name} name={name} value={value} />)}</div>
      )}
    </div>
  );
  if (activeTab === "config") return (
    <div className="lw-card"><div className="lw-card-title">Engine Configuration Used</div><div className="lw-code-block">{JSON.stringify(processedData.engineConfig, null, 2)}</div></div>
  );
  return null;
}

export default function ResultsViewer({ results, onNewRun }: Readonly<ResultsViewerProps>) {
  const [activeTab, setActiveTab] = useState("overview");

  const processedData = useMemo(() => {
    if (!results) return null;

    const { metadata, hardState, relationships, pressures, engineConfig } = results;

    const entityGroups: Record<string, Entity[]> = {};
    (hardState || []).forEach((entity) => {
      const key = `${entity.kind}:${entity.subtype}`;
      if (!entityGroups[key]) entityGroups[key] = [];
      entityGroups[key].push(entity);
    });

    const relationshipGroups: Record<string, Relationship[]> = {};
    (relationships || []).forEach((rel) => {
      if (!relationshipGroups[rel.kind]) relationshipGroups[rel.kind] = [];
      relationshipGroups[rel.kind].push(rel);
    });

    return {
      metadata,
      entityGroups,
      relationshipGroups,
      pressures: pressures || {},
      engineConfig,
    };
  }, [results]);

  if (!results || !processedData) {
    return (
      <div className="lw-container">
        <div className="viewer-empty-state viewer-empty-state">
          <div className="lw-empty-icon"></div>
          <div className="lw-empty-title">No Results Yet</div>
          <div className="lw-empty-text">
            Run a simulation to see the generated world history here.
          </div>
          <button className="lw-btn lw-btn-primary" onClick={onNewRun}>
            Go to Run
          </button>
        </div>
      </div>
    );
  }

  const exportResults = () => {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lore-weave-results.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(processedData.engineConfig, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "engine-config.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="lw-container">
      <div className="lw-header">
        <h1 className="lw-title">Simulation Results</h1>
        <p className="lw-subtitle">
          Generated world with {processedData.metadata.entityCount} entities and{" "}
          {processedData.metadata.relationshipCount} relationships
        </p>
      </div>

      <div className="lw-button-group rv-button-group">
        <button className="lw-btn lw-btn-secondary" onClick={exportResults}>
          Export Results
        </button>
        <button className="lw-btn lw-btn-secondary" onClick={exportConfig}>
          Export Config
        </button>
        <button className="lw-btn lw-btn-secondary" onClick={onNewRun}>
          Run New Simulation
        </button>
      </div>

      <div className="lw-stats-grid">
        <StatCard label="Total Entities" value={processedData.metadata.entityCount} />
        <StatCard label="Total Relationships" value={processedData.metadata.relationshipCount} />
        <StatCard label="Final Tick" value={processedData.metadata.tick} />
        <StatCard label="Epochs" value={processedData.metadata.epoch} />
        <StatCard label="Final Era" value={processedData.metadata.era || "N/A"} />
      </div>

      <div className="lw-tabs">
        {(["overview", "entities", "pressures", "config"] as const).map((tab) => (
          <button
            key={tab}
            className={`lw-tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <ResultsTabContent activeTab={activeTab} processedData={processedData} results={results} />
    </div>
  );
}
