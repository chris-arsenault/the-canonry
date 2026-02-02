/**
 * TracePopover - Simulation trace button with full-screen visualization
 *
 * Shows a compact button with simulation stats that opens the full trace
 * visualization as a modal overlay. Uses module federation to load
 * SimulationTraceVisx from lore-weave.
 */

import React, { useState, useMemo, lazy, Suspense } from 'react';
import { colors } from '../theme';

// Lazy load the trace visualization from lore-weave remote
const SimulationTraceVisx = lazy(() => import('loreWeave/SimulationTraceVisx'));

const styles = {
  button: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '6px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
    color: colors.textPrimary,
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'all 0.15s ease',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  buttonActive: {
    borderColor: 'rgba(59, 130, 246, 0.4)',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    color: 'rgb(147, 197, 253)',
  },
  loadingOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    color: colors.textMuted,
    fontSize: '14px',
  },
};

export default function TracePopover({ simulationState }) {
  const [isOpen, setIsOpen] = useState(false);

  // Extract data from simulation state
  const hasData = simulationState?.pressureUpdates?.length > 0;
  const tickCount = simulationState?.pressureUpdates?.length || 0;
  const templateCount = simulationState?.templateApplications?.length || 0;
  const actionCount = simulationState?.actionApplications?.length || 0;
  const eraTransitions = (simulationState?.systemActions || []).filter(
    a => a.details?.eraTransition
  ).length;

  // Button label
  const buttonLabel = useMemo(() => {
    if (!hasData) return 'No trace';
    return `${tickCount} ticks`;
  }, [hasData, tickCount]);

  // Button style
  const buttonStyle = useMemo(() => {
    if (!hasData) {
      return { ...styles.button, ...styles.buttonDisabled };
    }
    return { ...styles.button, ...styles.buttonActive };
  }, [hasData]);

  const loadingFallback = useMemo(
    () => (
      <div style={styles.loadingOverlay}>
        Loading trace visualization...
      </div>
    ),
    []
  );

  const handleOpen = () => {
    if (hasData) {
      setIsOpen(true);
    }
  };

  return (
    <>
      <button
        style={buttonStyle}
        onClick={handleOpen}
        disabled={!hasData}
        title={hasData
          ? `View simulation trace: ${tickCount} ticks, ${templateCount} templates, ${actionCount} actions, ${eraTransitions} era transitions`
          : 'Run a simulation to see trace data'
        }
      >
        <span style={{ fontSize: '11px' }}>~</span>
        <span>{buttonLabel}</span>
      </button>

      {isOpen && hasData && (
        <Suspense fallback={loadingFallback}>
          <SimulationTraceVisx
            pressureUpdates={simulationState.pressureUpdates}
            epochStats={simulationState.epochStats}
            templateApplications={simulationState.templateApplications}
            actionApplications={simulationState.actionApplications}
            systemActions={simulationState.systemActions}
            onClose={() => setIsOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
}
