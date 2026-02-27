/**
 * CoherenceEngineRemote - Module Federation entry point for Coherence Engine
 *
 * This component is loaded by The Canonry shell and receives:
 * - schema: Read-only world schema (entityKinds, relationshipKinds, cultures)
 * - eras: Array of era configurations
 * - onErasChange: Callback when eras are modified
 * - activeSection: Current navigation section
 * - onSectionChange: Callback when navigation changes
 *
 * The Coherence Engine provides configuration and validation tools for
 * world simulation parameters: pressures, eras, generators, actions, and systems.
 */

import React, { useMemo } from "react";
import PropTypes from "prop-types";
import "@penguin-tales/shared-components/styles";
import "./styles/index.css";
import "./CoherenceEngineRemote.css";
import { ErasEditor } from "./components/eras";
import PressuresEditor from "./components/PressuresEditor";
import GeneratorsEditor from "./components/GeneratorsEditor";
import ActionsEditor from "./components/ActionsEditor";
import SystemsEditor from "./components/SystemsEditor";
import ValidationEditor, { getValidationStatus } from "./components/ValidationEditor";
import { WeightMatrixEditor } from "./components/weight-matrix";
import CausalLoopEditor from "./components/CausalLoopEditor";
import { computeUsageMap } from "@penguin-tales/shared-components";

const TABS = [
  { id: "validation", label: "Validation" },
  { id: "causal", label: "Causal Loop" },
  { id: "pressures", label: "Pressures" },
  { id: "eras", label: "Eras" },
  { id: "matrix", label: "Weight Matrix" },
  { id: "generators", label: "Generators" },
  { id: "actions", label: "Actions" },
  { id: "systems", label: "Systems" },
];

// Validation status colors
const STATUS_COLORS = {
  clean: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
};

// Placeholder descriptions for each section
const SECTION_INFO = {
  validation: {
    title: "Validation",
    description:
      "Pre-run validation checks for your world configuration. View and fix issues before running the simulation.",
  },
  causal: {
    title: "Causal Loop Diagram",
    description:
      "Visualize feedback relationships between pressures, generators, systems, and entity kinds. Identify reinforcing and balancing loops.",
  },
  pressures: {
    title: "Pressures",
    description:
      "Configure environmental and social pressures that drive world evolution. Pressures create constraints and opportunities that shape entity behavior.",
  },
  eras: {
    title: "Eras",
    description:
      "Define historical eras and their characteristics. Eras determine which templates and systems are active during different phases of world generation.",
  },
  matrix: {
    title: "Weight Matrix",
    description:
      "Spreadsheet view for managing generator and system weights across all eras. Quickly assign weights, copy configurations, and identify gaps.",
  },
  generators: {
    title: "Generators",
    description:
      "Configure entity generators (growth templates) that populate the world. Each generator creates entities with specific characteristics and relationships.",
  },
  actions: {
    title: "Actions",
    description:
      "Define the action domains available to entities. Actions determine how entities interact with each other and the world.",
  },
  systems: {
    title: "Systems",
    description:
      "Configure simulation systems that run during the simulation phase. Systems create relationships and modify entity states based on world conditions.",
  },
};

export default function CoherenceEngineRemote({
  projectId,
  schema,
  eras = [],
  onErasChange,
  pressures = [],
  onPressuresChange,
  generators = [],
  onGeneratorsChange,
  actions = [],
  onActionsChange,
  systems = [],
  onSystemsChange,
  activeSection,
  onSectionChange,
}) {
  // Use passed-in section or default to 'validation'
  const activeTab = activeSection || "validation";
  const setActiveTab = onSectionChange || (() => {});

  const currentSection = SECTION_INFO[activeTab] || SECTION_INFO.validation;

  // Compute usage map for cross-reference tracking and validation (must be before validationStatus)
  const usageMap = useMemo(
    () => computeUsageMap(schema, pressures, eras, generators, systems, actions),
    [schema, pressures, eras, generators, systems, actions]
  );

  // Calculate validation status for the nav indicator (uses usageMap)
  const validationStatus = useMemo(
    () => getValidationStatus(usageMap, schema, eras, pressures, generators, systems),
    [usageMap, schema, eras, pressures, generators, systems]
  );

  // Navigate to generators tab and optionally select a specific generator
  const handleNavigateToGenerator = (_generatorId) => {
    setActiveTab("generators");
    // NOOP: generator expansion not yet implemented
  };

  const renderContent = () => {
    switch (activeTab) {
      case "validation":
        return (
          <ValidationEditor
            schema={schema}
            eras={eras}
            pressures={pressures}
            generators={generators}
            systems={systems}
            actions={actions}
            usageMap={usageMap}
            onNavigateToGenerator={handleNavigateToGenerator}
          />
        );
      case "causal":
        return (
          <CausalLoopEditor
            pressures={pressures}
            generators={generators}
            systems={systems}
            actions={actions}
            schema={schema}
            usageMap={usageMap}
          />
        );
      case "pressures":
        return (
          <PressuresEditor
            projectId={projectId}
            pressures={pressures}
            onChange={onPressuresChange || (() => {})}
            schema={schema}
            usageMap={usageMap}
          />
        );
      case "eras":
        return (
          <ErasEditor
            eras={eras}
            onChange={onErasChange || (() => {})}
            generators={generators}
            systems={systems}
            pressures={pressures}
            schema={schema}
            usageMap={usageMap}
          />
        );
      case "matrix":
        return (
          <WeightMatrixEditor
            generators={generators}
            systems={systems}
            eras={eras}
            onErasChange={onErasChange || (() => {})}
          />
        );
      case "generators":
        return (
          <GeneratorsEditor
            projectId={projectId}
            generators={generators}
            onChange={onGeneratorsChange || (() => {})}
            schema={schema}
            pressures={pressures}
            eras={eras}
            usageMap={usageMap}
          />
        );
      case "actions":
        return (
          <ActionsEditor
            projectId={projectId}
            actions={actions}
            onChange={onActionsChange || (() => {})}
            schema={schema}
            pressures={pressures}
            usageMap={usageMap}
          />
        );
      case "systems":
        return (
          <SystemsEditor
            projectId={projectId}
            systems={systems}
            onChange={onSystemsChange || (() => {})}
            schema={schema}
            pressures={pressures}
            usageMap={usageMap}
          />
        );
      default:
        return (
          <div className="cer-placeholder">
            <div className="cer-placeholder-icon"></div>
            <div className="cer-placeholder-title">{currentSection.title}</div>
            <div className="cer-placeholder-desc">{currentSection.description}</div>
          </div>
        );
    }
  };

  return (
    <div className="cer-container">
      {/* Left sidebar with nav */}
      <div className="cer-sidebar">
        <nav className="cer-nav">
          {TABS.map((tab) => {
            // Show status indicator for validation tab
            const showStatus = tab.id === "validation";
            const statusColor = STATUS_COLORS[validationStatus.status];

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`cer-nav-button ${activeTab === tab.id ? "cer-nav-button-active" : "cer-nav-button-inactive"}`}
              >
                <span className="cer-nav-button-content">
                  <span>{tab.label}</span>
                  {showStatus && (
                    <span
                      className="cer-status-dot"
                      // eslint-disable-next-line local/no-inline-styles -- dynamic color from validation status
                      style={{ '--cer-status-color': statusColor, backgroundColor: 'var(--cer-status-color)' }}
                      title={(() => {
                        if (validationStatus.status === "clean") return "All validations passed";
                        const plural = validationStatus.totalIssues === 1 ? "" : "s";
                        return `${validationStatus.totalIssues} issue${plural}`;
                      })()}
                    />
                  )}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main content area */}
      <div className="cer-main">
        <div className="cer-content">{renderContent()}</div>
      </div>
    </div>
  );
}

CoherenceEngineRemote.propTypes = {
  projectId: PropTypes.string,
  schema: PropTypes.object,
  eras: PropTypes.array,
  onErasChange: PropTypes.func,
  pressures: PropTypes.array,
  onPressuresChange: PropTypes.func,
  generators: PropTypes.array,
  onGeneratorsChange: PropTypes.func,
  actions: PropTypes.array,
  onActionsChange: PropTypes.func,
  systems: PropTypes.array,
  onSystemsChange: PropTypes.func,
  activeSection: PropTypes.string,
  onSectionChange: PropTypes.func,
};
