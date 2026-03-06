/**
 * RunControls - Simulation run/stop/step buttons
 */

import React from "react";
import "./RunControls.css";
import type { ValidityReport } from "./useValiditySearch";

interface ScoreBreakdownEntry { used: number; total: number; }

interface RunValidity {
  score: number;
  maxScore: number;
  scoreBreakdown: {
    templates: ScoreBreakdownEntry;
    actions: ScoreBreakdownEntry;
    systems: ScoreBreakdownEntry;
  } | null;
}

interface SimState { status: string; progress: { epoch: number; totalEpochs: number } | null; }
interface ValidationState { isValid: boolean; }

interface RunControlsProps {
  isRunning: boolean;
  isPaused: boolean;
  simState: SimState;
  validation: ValidationState;
  runValidity: RunValidity | null;
  isRunningUntilValid: boolean;
  validityAttempts: number;
  maxValidityAttempts: number;
  validitySearchComplete: boolean;
  validityReport: ValidityReport | null;
  onRun: () => void;
  onRunUntilValid: () => void;
  onCancelRunUntilValid: () => void;
  onDownloadValidityData: () => void;
  onStartStepMode: () => void;
  onStep: () => void;
  onRunToCompletion: () => void;
  onAbort: () => void;
  onReset: () => void;
  onViewResults: (() => void) | null;
}

function ValidityBadge({ runValidity }: Readonly<{ runValidity: RunValidity | null }>) {
  if (!runValidity) return null;
  const { score, maxScore, scoreBreakdown } = runValidity;
  const detailParts: string[] = [];
  if (scoreBreakdown?.templates) detailParts.push(`Templates ${scoreBreakdown.templates.used}/${scoreBreakdown.templates.total}`);
  if (scoreBreakdown?.actions) detailParts.push(`Actions ${scoreBreakdown.actions.used}/${scoreBreakdown.actions.total}`);
  if (scoreBreakdown?.systems) detailParts.push(`Systems ${scoreBreakdown.systems.used}/${scoreBreakdown.systems.total}`);
  const title = detailParts.length > 0 ? `Score ${score}/${maxScore} • ${detailParts.join(", ")}` : `Score ${score}/${maxScore}`;
  const scoreRatio = maxScore > 0 ? score / maxScore : 1;
  let badgeClass = "rc-badge-low";
  if (scoreRatio >= 0.9) badgeClass = "rc-badge-good";
  else if (scoreRatio >= 0.6) badgeClass = "rc-badge-mid";
  return <span className={`lw-validity-badge ${badgeClass}`} title={title}>Score {score}/{maxScore}</span>;
}

function SearchingControls({ validityAttempts, maxValidityAttempts, onCancel }: Readonly<{ validityAttempts: number; maxValidityAttempts: number; onCancel: () => void }>) {
  return (
    <>
      <div className="lw-step-indicator">
        <span>Attempt {validityAttempts} / {maxValidityAttempts}</span>
        <span className="rc-searching-label">SEARCHING FOR BEST RUN</span>
      </div>
      <button className="lw-btn lw-btn-danger" onClick={onCancel}>◼ Cancel</button>
    </>
  );
}

function RunningControls({ onAbort }: Readonly<{ onAbort: () => void }>) {
  return <button className="lw-btn lw-btn-danger" onClick={onAbort}>◼ Stop</button>;
}

function PausedControls({ simState, onStep, onRunToCompletion, onReset, onViewResults }: Readonly<{
  simState: SimState; onStep: () => void; onRunToCompletion: () => void; onReset: () => void; onViewResults: (() => void) | null;
}>) {
  return (
    <>
      <div className="lw-step-indicator">
        <span>Epoch {simState.progress?.epoch || 0} / {simState.progress?.totalEpochs || 0}</span>
        <span className="rc-paused-label">PAUSED</span>
      </div>
      <div className="lw-button-group">
        <button className="lw-btn lw-btn-step" onClick={onStep}>⏭ Next Epoch</button>
        <button className="lw-btn lw-btn-primary" onClick={onRunToCompletion} title="Continue running all remaining epochs">▶ Continue</button>
        <button className="lw-btn lw-btn-reset" onClick={onReset}>↻ Reset</button>
      </div>
      {simState.status === "complete" && onViewResults && <button className="lw-btn lw-btn-success" onClick={onViewResults}>✓ View Results</button>}
    </>
  );
}

function IdleControls({ simState, validation, runValidity, validitySearchComplete, validityReport,
  maxValidityAttempts, onRun, onRunUntilValid, onStartStepMode, onDownloadValidityData, onViewResults,
}: Readonly<{
  simState: SimState; validation: ValidationState; runValidity: RunValidity | null;
  validitySearchComplete: boolean; validityReport: ValidityReport | null;
  maxValidityAttempts: number;
  onRun: () => void; onRunUntilValid: () => void; onStartStepMode: () => void;
  onDownloadValidityData: () => void; onViewResults: (() => void) | null;
}>) {
  return (
    <>
      {simState.status === "complete" && <ValidityBadge runValidity={runValidity} />}
      {validitySearchComplete && validityReport && (
        <span className="lw-validity-badge rc-badge-search"
          title={`Best score ${validityReport.summary.bestScore}${validityReport.summary.bestScoreMax ? "/" + String(validityReport.summary.bestScoreMax) : ""} on attempt ${String(validityReport.summary.bestAttempt)}`}
        >{validityReport.summary.totalAttempts} runs</span>
      )}
      <div className="lw-button-group">
        <button className={`lw-btn lw-btn-primary ${!validation.isValid ? "disabled" : ""}`} onClick={onRun} disabled={!validation.isValid}>▶ Run</button>
        <button className={`lw-btn lw-btn-secondary ${!validation.isValid ? "disabled" : ""}`} onClick={onRunUntilValid} disabled={!validation.isValid}
          title={`Run up to ${String(maxValidityAttempts)} simulations and keep the highest score`}>⟳ Search</button>
        <button className={`lw-btn lw-btn-step ${!validation.isValid ? "disabled" : ""}`} onClick={onStartStepMode} disabled={!validation.isValid} title="Run one epoch at a time">⏯ Step</button>
      </div>
      {validitySearchComplete && validityReport && (
        <button className="lw-btn lw-btn-secondary" onClick={onDownloadValidityData} title="Download all run data and analysis report as ZIP">⬇ Download Runs</button>
      )}
      {simState.status === "complete" && onViewResults && <button className="lw-btn lw-btn-success" onClick={onViewResults}>✓ View Results</button>}
    </>
  );
}

export default function RunControls(props: Readonly<RunControlsProps>) {
  const { isRunning, isPaused, isRunningUntilValid } = props;

  if (isRunningUntilValid && isRunning) {
    return <SearchingControls validityAttempts={props.validityAttempts} maxValidityAttempts={props.maxValidityAttempts} onCancel={props.onCancelRunUntilValid} />;
  }
  if (isRunning && !isPaused) {
    return <RunningControls onAbort={props.onAbort} />;
  }
  if (isPaused) {
    return <PausedControls simState={props.simState} onStep={props.onStep} onRunToCompletion={props.onRunToCompletion} onReset={props.onReset} onViewResults={props.onViewResults} />;
  }
  return <IdleControls simState={props.simState} validation={props.validation} runValidity={props.runValidity}
    validitySearchComplete={props.validitySearchComplete} validityReport={props.validityReport}
    maxValidityAttempts={props.maxValidityAttempts}
    onRun={props.onRun} onRunUntilValid={props.onRunUntilValid} onStartStepMode={props.onStartStepMode}
    onDownloadValidityData={props.onDownloadValidityData} onViewResults={props.onViewResults} />;
}
