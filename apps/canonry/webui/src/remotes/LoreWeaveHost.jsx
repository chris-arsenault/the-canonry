/**
 * LoreWeaveHost - Loads and hosts the Lore Weave remote module
 */

import React, { Suspense, lazy } from "react";
import PropTypes from "prop-types";
import { ErrorBoundary } from "@the-canonry/shared-components";
import RemotePlaceholder from "./RemotePlaceholder";
import { colors, typography } from "../theme";

// Lazy load the remote module
const LoreWeaveRemote = lazy(() => import("loreWeave/LoreWeaveRemote").catch(err => {
  console.error("[LoreWeaveHost] Failed to load remote:", err);
  return {
    default: () => <RemotePlaceholder name="Lore Weave" port={5004} instructions="cd apps/lore-weave/webui && npm install && npm run dev" />
  };
}));
const styles = {
  container: {
    height: "100%",
    overflow: "auto"
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: colors.textMuted,
    fontSize: typography.sizeLg,
    fontFamily: typography.fontFamily
  }
};
const loadingFallback = React.createElement("div", {
  style: styles.loading
}, "Loading Lore Weave...");
export default function LoreWeaveHost({
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
  simulationResults,
  onSimulationResultsChange,
  simulationState,
  onSimulationStateChange,
  onSearchRunScored
}) {
  return <div className="inline-extracted-1">
      <ErrorBoundary title="Lore Weave encountered an error">
      <Suspense fallback={loadingFallback}>
        <LoreWeaveRemote projectId={projectId} schema={schema} eras={eras} pressures={pressures} generators={generators} systems={systems} actions={actions} seedEntities={seedEntities} seedRelationships={seedRelationships} distributionTargets={distributionTargets} onDistributionTargetsChange={onDistributionTargetsChange} activeSection={activeSection} onSectionChange={onSectionChange} simulationResults={simulationResults} onSimulationResultsChange={onSimulationResultsChange} simulationState={simulationState} onSimulationStateChange={onSimulationStateChange} onSearchRunScored={onSearchRunScored} />
      </Suspense>
      </ErrorBoundary>
    </div>;
}
LoreWeaveHost.propTypes = {
  projectId: PropTypes.string,
  schema: PropTypes.object,
  eras: PropTypes.array,
  pressures: PropTypes.array,
  generators: PropTypes.array,
  systems: PropTypes.array,
  actions: PropTypes.array,
  seedEntities: PropTypes.array,
  seedRelationships: PropTypes.array,
  distributionTargets: PropTypes.object,
  onDistributionTargetsChange: PropTypes.func,
  activeSection: PropTypes.string,
  onSectionChange: PropTypes.func,
  simulationResults: PropTypes.object,
  onSimulationResultsChange: PropTypes.func,
  simulationState: PropTypes.object,
  onSimulationStateChange: PropTypes.func,
  onSearchRunScored: PropTypes.func
};
