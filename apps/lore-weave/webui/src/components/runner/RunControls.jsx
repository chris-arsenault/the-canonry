/**
 * RunControls - Simulation run/stop/step buttons
 */

import React from 'react';

function ValidityBadge({ runValidity }) {
  if (!runValidity) return null;

  const { score, maxScore, scoreBreakdown } = runValidity;

  const detailParts = [];
  if (scoreBreakdown?.templates) {
    detailParts.push(`Templates ${scoreBreakdown.templates.used}/${scoreBreakdown.templates.total}`);
  }
  if (scoreBreakdown?.actions) {
    detailParts.push(`Actions ${scoreBreakdown.actions.used}/${scoreBreakdown.actions.total}`);
  }
  if (scoreBreakdown?.systems) {
    detailParts.push(`Systems ${scoreBreakdown.systems.used}/${scoreBreakdown.systems.total}`);
  }

  const title = detailParts.length > 0
    ? `Score ${score}/${maxScore} • ${detailParts.join(', ')}`
    : `Score ${score}/${maxScore}`;

  const scoreRatio = maxScore > 0 ? score / maxScore : 1;
  const style = scoreRatio >= 0.9
    ? {
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        color: '#22c55e',
        border: '1px solid rgba(34, 197, 94, 0.3)'
      }
    : scoreRatio >= 0.6
      ? {
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          color: '#f59e0b',
          border: '1px solid rgba(245, 158, 11, 0.3)'
        }
      : {
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          color: '#ef4444',
          border: '1px solid rgba(239, 68, 68, 0.3)'
        };

  return (
    <span
      className="lw-validity-badge"
      style={style}
      title={title}
    >
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
          <span>Attempt {validityAttempts} / {maxValidityAttempts}</span>
          <span style={{ color: 'var(--lw-accent)' }}>SEARCHING FOR BEST RUN</span>
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
          <span>Epoch {simState.progress?.epoch || 0} / {simState.progress?.totalEpochs || 0}</span>
          <span style={{ color: 'var(--lw-warning)' }}>PAUSED</span>
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
        {simState.status === 'complete' && onViewResults && (
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
      {simState.status === 'complete' && (
        <ValidityBadge runValidity={runValidity} />
      )}
      {validitySearchComplete && validityReport && (
        <span
          className="lw-validity-badge"
          style={{
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
            color: '#8b5cf6',
            border: '1px solid rgba(139, 92, 246, 0.3)'
          }}
          title={`Best score ${validityReport.summary.bestScore}${validityReport.summary.bestScoreMax ? `/${validityReport.summary.bestScoreMax}` : ''} on attempt ${validityReport.summary.bestAttempt}`}
        >
          {validityReport.summary.totalAttempts} runs
        </span>
      )}
      <div className="lw-button-group">
        <button
          className={`lw-btn lw-btn-primary ${!validation.isValid ? 'disabled' : ''}`}
          onClick={onRun}
          disabled={!validation.isValid}
        >
          ▶ Run
        </button>
        <button
          className={`lw-btn lw-btn-secondary ${!validation.isValid ? 'disabled' : ''}`}
          onClick={onRunUntilValid}
          disabled={!validation.isValid}
          title={`Run up to ${maxValidityAttempts} simulations and keep the highest score`}
        >
          ⟳ Search
        </button>
        <button
          className={`lw-btn lw-btn-step ${!validation.isValid ? 'disabled' : ''}`}
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
      {simState.status === 'complete' && onViewResults && (
        <button className="lw-btn lw-btn-success" onClick={onViewResults}>
          ✓ View Results
        </button>
      )}
    </>
  );
}
