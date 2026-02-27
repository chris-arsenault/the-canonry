/**
 * TracePopover - Simulation trace button with full-screen visualization
 *
 * Shows a compact button with simulation stats that opens the full trace
 * visualization as a modal overlay. Uses module federation to load
 * SimulationTraceVisx from lore-weave.
 */

import React, { useState, useMemo, useCallback, lazy, Suspense } from "react";
import PropTypes from "prop-types";
import "./TracePopover.css";

// Lazy load the trace visualization from lore-weave remote
const SimulationTraceVisx = lazy(() => import("loreWeave/SimulationTraceVisx"));

export default function TracePopover({ simulationState }) {
  const [isOpen, setIsOpen] = useState(false);

  // Extract data from simulation state
  const hasData = simulationState?.pressureUpdates?.length > 0;
  const tickCount = simulationState?.pressureUpdates?.length || 0;
  const templateCount = simulationState?.templateApplications?.length || 0;
  const actionCount = simulationState?.actionApplications?.length || 0;
  const eraTransitions = (simulationState?.systemActions || []).filter(
    (a) => a.details?.eraTransition
  ).length;

  // Button label
  const buttonLabel = useMemo(() => {
    if (!hasData) return "No trace";
    return `${tickCount} ticks`;
  }, [hasData, tickCount]);

  // Button class
  const buttonClassName = useMemo(() => {
    if (!hasData) {
      return "tp-button tp-button-disabled";
    }
    return "tp-button tp-button-active";
  }, [hasData]);

  const loadingFallback = useMemo(
    () => <div className="tp-loading-overlay">Loading trace visualization...</div>,
    []
  );

  const handleOpen = () => {
    if (hasData) {
      setIsOpen(true);
    }
  };
  const handleClose = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        className={buttonClassName}
        onClick={handleOpen}
        disabled={!hasData}
        title={
          hasData
            ? `View simulation trace: ${tickCount} ticks, ${templateCount} templates, ${actionCount} actions, ${eraTransitions} era transitions`
            : "Run a simulation to see trace data"
        }
      >
        <span className="tp-tilde">~</span>
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
            onClose={handleClose}
          />
        </Suspense>
      )}
    </>
  );
}

TracePopover.propTypes = {
  simulationState: PropTypes.object,
};
