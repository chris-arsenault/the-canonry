/**
 * ArchivistHost - Loads and hosts the Archivist remote module
 *
 * Displays world data from lore-weave simulation results.
 */

import React, { Suspense, lazy } from "react";
import PropTypes from "prop-types";
import { ErrorBoundary } from "@the-canonry/shared-components";
import RemotePlaceholder from "./RemotePlaceholder";
import { colors, typography } from "../theme";

// Lazy load the remote module
const ArchivistRemote = lazy(() => import("archivist/ArchivistRemote").catch(() => ({
  default: () => <RemotePlaceholder name="Archivist" port={5005} instructions="cd apps/archivist/webui && npm install && npm run dev" />
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
}, "Loading Archivist...");
export default function ArchivistHost({
  projectId,
  activeSlotIndex
}) {
  return <div className="inline-extracted-1">
      <ErrorBoundary title="Archivist encountered an error">
      <Suspense fallback={loadingFallback}>
        <ArchivistRemote projectId={projectId} activeSlotIndex={activeSlotIndex} />
      </Suspense>
      </ErrorBoundary>
    </div>;
}
ArchivistHost.propTypes = {
  projectId: PropTypes.string,
  activeSlotIndex: PropTypes.number
};
