/**
 * ChroniclerHost - Loads and hosts the Chronicler remote module
 *
 * Wiki-style explorer for world content with long-form narratives.
 */

import React, { Suspense, lazy } from "react";
import PropTypes from "prop-types";
import { ErrorBoundary } from "@penguin-tales/shared-components";
import RemotePlaceholder from "./RemotePlaceholder";
import { colors, typography } from "../theme";

// Lazy load the remote module
const ChroniclerRemote = lazy(() => import("chronicler/ChroniclerRemote").catch(() => ({
  default: () => <RemotePlaceholder name="Chronicler" port={5007} instructions="cd apps/chronicler/webui && npm install && npm run dev" />
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
}, "Loading Chronicler...");
export default function ChroniclerHost({
  projectId,
  activeSlotIndex,
  requestedPageId,
  onRequestedPageConsumed
}) {
  return <div className="inline-extracted-1">
      <ErrorBoundary title="Chronicler encountered an error">
      <Suspense fallback={loadingFallback}>
        <ChroniclerRemote projectId={projectId} activeSlotIndex={activeSlotIndex} requestedPageId={requestedPageId} onRequestedPageConsumed={onRequestedPageConsumed} />
      </Suspense>
      </ErrorBoundary>
    </div>;
}
ChroniclerHost.propTypes = {
  projectId: PropTypes.string,
  activeSlotIndex: PropTypes.number,
  requestedPageId: PropTypes.string,
  onRequestedPageConsumed: PropTypes.func
};
