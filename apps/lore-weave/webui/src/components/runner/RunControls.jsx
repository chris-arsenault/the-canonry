/**
 * RunControls - Simulation run/stop/step buttons
 */

import React from "react";
import PropTypes from "prop-types";
import "./RunControls.css";

function ValidityBadge({ runValidity }) {
  if (!runValidity) return null;

  const { score, maxScore, scoreBreakdown } = runValidity;

  const detailParts = [];
  if (scoreBreakdown?.templates) {
    detailParts.push(
      `Templates ${scoreBreakdown.templates.used}/${scoreBreakdown.templates.total}`
    );
  }
  if (scoreBreakdown?.actions) {
    detailParts.push(`Actions ${scoreBreakdown.actions.used}/${scoreBreakdown.actions.total}`);
  }
  if (scoreBreakdown?.systems) {
    detailParts.push(`Systems ${scoreBreakdown.systems.used}/${scoreBreakdown.systems.total}`);
  }

  const title =
    detailParts.length > 0
      ? `Score ${score}/${maxScore} • ${detailParts.join(", ")}`
      : `Score ${score}/${maxScore}`;

  const scoreRatio = maxScore > 0 ? score / maxScore : 1;
  let badgeClass;
  if (scoreRatio >= 0.9) {
    badgeClass = "rc-badge-good";
  } else if (scoreRatio >= 0.6) {
    badgeClass = "rc-badge-mid";
  } else {
    badgeClass = "rc-badge-low";
  }

  return (
    <span className={`lw-validity-badge ${badgeClass}`} title={title}>
      Score {score}/{maxScore}
    </span>
  );
}

export default function RunControls({
  isRunning,
  isPaused,
  simState,
  validation,
  runValidity,
  isRunningUntilValid,
  validityAttempts,
  maxValidityAttempts,
  validitySearchComplete,
  validityReport,
  onRun,
  onRunUntilValid,
  onCancelRunUntilValid,
  onDownloadValidityData,
  onStartStepMode,
  onStep,
  onRunToCompletion,
  onAbort,
  onReset,
  onViewResults,
}) {
  // Running until valid - show special stop button
  if (isRunningUntilValid && isRunning) {
    return (
      <>
        <div className="lw-step-indicator">
          <span>
            Attempt {validityAttempts} / {maxValidityAttempts}
          </span>
          <span className="rc-searching-label">SEARCHING FOR BEST RUN</span>
        </div>
        <button className="lw-btn lw-btn-danger" onClick={onCancelRunUntilValid}>
          ◼ Cancel
        </button>
      </>
    );
  }

  if (isRunning && !isPaused) {
    // Running state - show stop button
    return (
      <button className="lw-btn lw-btn-danger" onClick={onAbort}>
        ◼ Stop
      </button>
    );
  }

  if (isPaused) {
    // Paused state - show step controls
    return (
      <>
        <div className="lw-step-indicator">
          <span>
            Epoch {simState.progress?.epoch || 0} / {simState.progress?.totalEpochs || 0}
          </span>
          <span className="rc-paused-label">PAUSED</span>
        </div>
        <div className="lw-button-group">
          <button className="lw-btn lw-btn-step" onClick={onStep}>
            ⏭ Next Epoch
          </button>
          <button
            className="lw-btn lw-btn-primary"
            onClick={onRunToCompletion}
            title="Continue running all remaining epochs"
          >
            ▶ Continue
          </button>
          <button className="lw-btn lw-btn-reset" onClick={onReset}>
            ↻ Reset
          </button>
        </div>
        {simState.status === "complete" && onViewResults && (
          <button className="lw-btn lw-btn-success" onClick={onViewResults}>
            ✓ View Results
          </button>
        )}
      </>
    );
  }

  // Idle or complete state - show run/step buttons
  return (
    <>
      {simState.status === "complete" && <ValidityBadge runValidity={runValidity} />}
      {validitySearchComplete && validityReport && (
        <span
          className="lw-validity-badge rc-badge-search"
          title={`Best score ${validityReport.summary.bestScore}${validityReport.summary.bestScoreMax ? "/" + validityReport.summary.bestScoreMax : ""} on attempt ${validityReport.summary.bestAttempt}`}
        >
          {validityReport.summary.totalAttempts} runs
        </span>
      )}
      <div className="lw-button-group">
        <button
          className={`lw-btn lw-btn-primary ${!validation.isValid ? "disabled" : ""}`}
          onClick={onRun}
          disabled={!validation.isValid}
        >
          ▶ Run
        </button>
        <button
          className={`lw-btn lw-btn-secondary ${!validation.isValid ? "disabled" : ""}`}
          onClick={onRunUntilValid}
          disabled={!validation.isValid}
          title={`Run up to ${maxValidityAttempts} simulations and keep the highest score`}
        >
          ⟳ Search
        </button>
        <button
          className={`lw-btn lw-btn-step ${!validation.isValid ? "disabled" : ""}`}
          onClick={onStartStepMode}
          disabled={!validation.isValid}
          title="Run one epoch at a time"
        >
          ⏯ Step
        </button>
      </div>
      {validitySearchComplete && validityReport && (
        <button
          className="lw-btn lw-btn-secondary"
          onClick={onDownloadValidityData}
          title="Download all run data and analysis report as ZIP"
        >
          ⬇ Download Runs
        </button>
      )}
      {simState.status === "complete" && onViewResults && (
        <button className="lw-btn lw-btn-success" onClick={onViewResults}>
          ✓ View Results
        </button>
      )}
    </>
  );
}

ValidityBadge.propTypes = {
  runValidity: PropTypes.object,
};

RunControls.propTypes = {
  isRunning: PropTypes.bool,
  isPaused: PropTypes.bool,
  simState: PropTypes.object,
  validation: PropTypes.object,
  runValidity: PropTypes.object,
  isRunningUntilValid: PropTypes.bool,
  validityAttempts: PropTypes.number,
  maxValidityAttempts: PropTypes.number,
  validitySearchComplete: PropTypes.bool,
  validityReport: PropTypes.object,
  onRun: PropTypes.func,
  onRunUntilValid: PropTypes.func,
  onCancelRunUntilValid: PropTypes.func,
  onDownloadValidityData: PropTypes.func,
  onStartStepMode: PropTypes.func,
  onStep: PropTypes.func,
  onRunToCompletion: PropTypes.func,
  onAbort: PropTypes.func,
  onReset: PropTypes.func,
  onViewResults: PropTypes.func,
};
