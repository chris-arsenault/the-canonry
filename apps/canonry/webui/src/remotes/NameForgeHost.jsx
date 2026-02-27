/**
 * NameForgeHost - Loads and hosts the Name Forge remote module
 */

import React, { Suspense, lazy } from "react";
import PropTypes from "prop-types";
import { ErrorBoundary } from "@penguin-tales/shared-components";
import RemotePlaceholder from "./RemotePlaceholder";
import { colors, typography } from "../theme";

// Lazy load the remote module
// This will be replaced with actual federation import once name-forge exposes the remote
const NameForgeRemote = lazy(() => import("nameForge/NameForgeRemote").catch(() => ({
  default: () => <RemotePlaceholder name="Name Forge" port={5001} instructions="cd apps/name-forge/webui && npm run dev" />
})));
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
}, "Loading Name Forge...");
export default function NameForgeHost({
  projectId,
  schema,
  onNamingDataChange,
  onAddTag,
  activeSection,
  onSectionChange,
  generators
}) {
  return <div className="inline-extracted-1">
      <ErrorBoundary title="Name Forge encountered an error">
      <Suspense fallback={loadingFallback}>
        <NameForgeRemote projectId={projectId} schema={schema} onNamingDataChange={onNamingDataChange} onAddTag={onAddTag} activeSection={activeSection} onSectionChange={onSectionChange} generators={generators} />
      </Suspense>
      </ErrorBoundary>
    </div>;
}
NameForgeHost.propTypes = {
  projectId: PropTypes.string,
  schema: PropTypes.object,
  onNamingDataChange: PropTypes.func,
  onAddTag: PropTypes.func,
  activeSection: PropTypes.string,
  onSectionChange: PropTypes.func,
  generators: PropTypes.array
};
