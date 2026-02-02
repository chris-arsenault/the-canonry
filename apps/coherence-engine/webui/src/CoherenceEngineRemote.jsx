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

import React, { useMemo } from 'react';
import '@penguin-tales/shared-components/styles';
import './styles/index.css';
import { ErasEditor } from './components/eras';
import PressuresEditor from './components/PressuresEditor';
import GeneratorsEditor from './components/GeneratorsEditor';
import ActionsEditor from './components/ActionsEditor';
import SystemsEditor from './components/SystemsEditor';
import ValidationEditor, { getValidationStatus } from './components/ValidationEditor';
import { WeightMatrixEditor } from './components/weight-matrix';
import CausalLoopEditor from './components/CausalLoopEditor';
import { computeUsageMap } from '@penguin-tales/shared-components';

const TABS = [
  { id: 'validation', label: 'Validation' },
  { id: 'causal', label: 'Causal Loop' },
  { id: 'pressures', label: 'Pressures' },
  { id: 'eras', label: 'Eras' },
  { id: 'matrix', label: 'Weight Matrix' },
  { id: 'generators', label: 'Generators' },
  { id: 'actions', label: 'Actions' },
  { id: 'systems', label: 'Systems' },
];

// Coherence Engine accent gradient (amber) - Arctic Blue base theme
const ACCENT_GRADIENT = 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)';
const ACCENT_COLOR = '#f59e0b';

// Validation status colors
const STATUS_COLORS = {
  clean: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
};

const styles = {
  container: {
    display: 'flex',
    height: '100%',
    backgroundColor: '#0a1929',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  sidebar: {
    width: '200px',
    backgroundColor: '#0c1f2e',
    borderRight: '1px solid rgba(59, 130, 246, 0.3)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  nav: {
    padding: '12px',
  },
  navButton: {
    display: 'block',
    width: '100%',
    padding: '10px 12px',
    marginBottom: '4px',
    fontSize: '13px',
    fontWeight: 500,
    textAlign: 'left',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  },
  navButtonInactive: {
    backgroundColor: 'transparent',
    color: '#93c5fd',
  },
  navButtonActive: {
    background: ACCENT_GRADIENT,
    color: '#0a1929',
    fontWeight: 600,
  },
  navButtonContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#60a5fa',
    textAlign: 'center',
  },
  placeholderIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.5,
  },
  placeholderTitle: {
    fontSize: '18px',
    fontWeight: 500,
    marginBottom: '8px',
    color: '#ffffff',
  },
  placeholderDesc: {
    fontSize: '14px',
    color: '#93c5fd',
    maxWidth: '400px',
  },
};

// Placeholder descriptions for each section
const SECTION_INFO = {
  validation: {
    title: 'Validation',
    description: 'Pre-run validation checks for your world configuration. View and fix issues before running the simulation.',
  },
  causal: {
    title: 'Causal Loop Diagram',
    description: 'Visualize feedback relationships between pressures, generators, systems, and entity kinds. Identify reinforcing and balancing loops.',
  },
  pressures: {
    title: 'Pressures',
    description: 'Configure environmental and social pressures that drive world evolution. Pressures create constraints and opportunities that shape entity behavior.',
  },
  eras: {
    title: 'Eras',
    description: 'Define historical eras and their characteristics. Eras determine which templates and systems are active during different phases of world generation.',
  },
  matrix: {
    title: 'Weight Matrix',
    description: 'Spreadsheet view for managing generator and system weights across all eras. Quickly assign weights, copy configurations, and identify gaps.',
  },
  generators: {
    title: 'Generators',
    description: 'Configure entity generators (growth templates) that populate the world. Each generator creates entities with specific characteristics and relationships.',
  },
  actions: {
    title: 'Actions',
    description: 'Define the action domains available to entities. Actions determine how entities interact with each other and the world.',
  },
  systems: {
    title: 'Systems',
    description: 'Configure simulation systems that run during the simulation phase. Systems create relationships and modify entity states based on world conditions.',
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
  const activeTab = activeSection || 'validation';
  const setActiveTab = onSectionChange || (() => {});

  const currentSection = SECTION_INFO[activeTab] || SECTION_INFO.validation;

  // Compute usage map for cross-reference tracking and validation (must be before validationStatus)
  const usageMap = useMemo(() =>
    computeUsageMap(schema, pressures, eras, generators, systems, actions),
    [schema, pressures, eras, generators, systems, actions]
  );

  // Calculate validation status for the nav indicator (uses usageMap)
  const validationStatus = useMemo(() =>
    getValidationStatus(usageMap, schema, eras, pressures, generators, systems),
    [usageMap, schema, eras, pressures, generators, systems]
  );

  // Navigate to generators tab and optionally select a specific generator
  const handleNavigateToGenerator = (generatorId) => {
    setActiveTab('generators');
    // TODO: Could add logic to expand the specific generator
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'validation':
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
      case 'causal':
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
      case 'pressures':
        return (
          <PressuresEditor
            projectId={projectId}
            pressures={pressures}
            onChange={onPressuresChange || (() => {})}
            schema={schema}
            usageMap={usageMap}
          />
        );
      case 'eras':
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
      case 'matrix':
        return (
          <WeightMatrixEditor
            generators={generators}
            systems={systems}
            eras={eras}
            onErasChange={onErasChange || (() => {})}
          />
        );
      case 'generators':
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
      case 'actions':
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
      case 'systems':
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
          <div style={styles.placeholder}>
            <div style={styles.placeholderIcon}></div>
            <div style={styles.placeholderTitle}>{currentSection.title}</div>
            <div style={styles.placeholderDesc}>{currentSection.description}</div>
          </div>
        );
    }
  };

  return (
    <div style={styles.container}>
      {/* Left sidebar with nav */}
      <div style={styles.sidebar}>
        <nav style={styles.nav}>
          {TABS.map((tab) => {
            // Show status indicator for validation tab
            const showStatus = tab.id === 'validation';
            const statusColor = STATUS_COLORS[validationStatus.status];

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  ...styles.navButton,
                  ...(activeTab === tab.id
                    ? styles.navButtonActive
                    : styles.navButtonInactive),
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.id) {
                    e.target.style.backgroundColor = 'rgba(245, 158, 11, 0.15)';
                    e.target.style.color = ACCENT_COLOR;
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.id) {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.color = '#93c5fd';
                  }
                }}
              >
                <span style={styles.navButtonContent}>
                  <span>{tab.label}</span>
                  {showStatus && (
                    <span
                      style={{
                        ...styles.statusDot,
                        backgroundColor: statusColor,
                      }}
                      title={validationStatus.status === 'clean'
                        ? 'All validations passed'
                        : `${validationStatus.totalIssues} issue${validationStatus.totalIssues === 1 ? '' : 's'}`
                      }
                    />
                  )}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main content area */}
      <div style={styles.main}>
        <div style={styles.content}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
