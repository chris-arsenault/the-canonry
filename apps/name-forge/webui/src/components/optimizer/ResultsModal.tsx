import React, { useCallback, useMemo } from "react";
import { useExpandSet } from "@the-canonry/shared-components";
import DomainDiff from "./DomainDiff";
import "./ResultsModal.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DomainConfig {
  [key: string]: unknown;
}

interface OptimizationResult {
  domainId: string;
  success: boolean;
  initialFitness?: number;
  finalFitness?: number;
  improvement?: number;
  error?: string;
  initialConfig?: DomainConfig;
  optimizedConfig?: DomainConfig;
}

interface ProgressInfo {
  currentDomain: string;
  current: number;
  total: number;
}

interface LogEntry {
  type: string;
  message: string;
}

interface ResultRowProps {
  result: OptimizationResult;
  index: number;
  isExpanded: boolean;
  onToggle: (domainId: string) => void;
}

interface ResultsModalProps {
  show: boolean;
  onClose: () => void;
  optimizing: boolean;
  progress: ProgressInfo;
  logs: LogEntry[];
  results: OptimizationResult[];
  onSaveResults: () => void;
}

// ---------------------------------------------------------------------------
// ResultRow - single row in the results table
// ---------------------------------------------------------------------------

function ResultRowStatus({ success }: { success: boolean }) {
  return success
    ? <span className="text-success mr-sm">&#10003;</span>
    : <span className="text-danger mr-sm">&#10007;</span>;
}

function ResultRowDetail({ result, index }: { result: OptimizationResult; index: number }) {
  if (!result.success) return null;
  return (
    <tr key={`${index}-diff`}>
      <td colSpan={5} className="diff-cell">
        <div className="diff-container">
          <div className="diff-header">
            <span className="text-gold text-xs font-bold uppercase">
              Parameter Changes
            </span>
          </div>
          <DomainDiff initial={result.initialConfig} optimized={result.optimizedConfig} />
        </div>
      </td>
    </tr>
  );
}

function ResultRow({ result, index, isExpanded, onToggle }: ResultRowProps) {
  const handleClick = useCallback(() => {
    if (result.success) onToggle(result.domainId);
  }, [result.success, result.domainId, onToggle]);

  const rowClass = useMemo(() => {
    const parts = ["results-row"];
    if (isExpanded) parts.push("expanded");
    if (result.success) parts.push("clickable");
    return parts.join(" ");
  }, [isExpanded, result.success]);

  const improvementCell = result.success
    ? `+${((result.improvement ?? 0) * 100).toFixed(1)}%`
    : result.error;
  const improvementClass = `text-right ${result.success ? "text-gold font-bold" : "text-danger"}`;

  return (
    <React.Fragment key={result.domainId}>
      <tr onClick={result.success ? handleClick : undefined} className={rowClass}>
        <td className="col-expand">
          {result.success && (
            <span className="text-small">{isExpanded ? "\u25BC" : "\u25B6"}</span>
          )}
        </td>
        <td>
          <ResultRowStatus success={result.success} />
          {result.domainId}
        </td>
        <td className="text-right">
          {result.success ? result.initialFitness?.toFixed(3) : "-"}
        </td>
        <td className="text-right">
          {result.success ? result.finalFitness?.toFixed(3) : "-"}
        </td>
        <td className={improvementClass}>
          {improvementCell}
        </td>
      </tr>
      {isExpanded && <ResultRowDetail result={result} index={index} />}
    </React.Fragment>
  );
}

// ---------------------------------------------------------------------------
// ModalProgressBar - progress section shown while optimizing
// ---------------------------------------------------------------------------

function ModalProgressBar({ progress }: { progress: ProgressInfo }) {
  const widthPercent = progress.total > 0
    ? `${(progress.current / progress.total) * 100}%`
    : "0%";

  return (
    <div className="viewer-section">
      <div className="flex justify-between mb-sm">
        <span className="text-small">
          Processing: <strong>{progress.currentDomain}</strong>
        </span>
        <span className="text-small text-muted">
          {progress.current} / {progress.total}
        </span>
      </div>
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill rm-progress-bar-fill"
          style={{ "--rm-progress-width": widthPercent } as React.CSSProperties}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ModalLogSection - log entries and results table
// ---------------------------------------------------------------------------

interface ModalLogSectionProps {
  logs: LogEntry[];
  results: OptimizationResult[];
  expandedResults: Set<string>;
  toggleExpand: (id: string) => void;
}

function ModalLogSection({ logs, results, expandedResults, toggleExpand }: ModalLogSectionProps) {
  return (
    <div className="optimizer-modal-body">
      <div className="viewer-section">
        <h3 className="section-title mt-0">Optimization Log</h3>
        <div className="optimizer-log">
          {logs.map((log, i) => (
            <div key={i} className={`log-entry ${log.type}`}>
              {log.message}
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-muted italic">Waiting for optimization to start...</div>
          )}
        </div>

        {results.length > 0 && (
          <div className="mt-lg">
            <h3 className="section-title mt-0">Results Summary</h3>
            <div className="results-table-container">
              <table className="results-table">
                <thead>
                  <tr>
                    <th className="col-expand"></th>
                    <th>Domain</th>
                    <th className="text-right">Initial</th>
                    <th className="text-right">Final</th>
                    <th className="text-right">Improvement</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, i) => (
                    <ResultRow
                      key={result.domainId}
                      result={result}
                      index={i}
                      isExpanded={expandedResults.has(result.domainId)}
                      onToggle={toggleExpand}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResultsModal - Modal showing optimization progress and results
// ---------------------------------------------------------------------------

export default function ResultsModal({
  show,
  onClose,
  optimizing,
  progress,
  logs,
  results,
  onSaveResults,
}: ResultsModalProps) {
  const { expanded: expandedResults, toggle: toggleExpand } = useExpandSet();

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget && !optimizing) onClose();
    },
    [optimizing, onClose],
  );

  const handleOverlayKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
    },
    [],
  );

  const hasSuccessfulResults = useMemo(
    () => results.length > 0 && results.some((r) => r.success),
    [results],
  );

  if (!show) return null;

  return (
    <div
      className="optimizer-modal-overlay"
      onClick={handleOverlayClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleOverlayKeyDown}
    >
      <div className="optimizer-modal">
        {/* Modal Header */}
        <div className="optimizer-modal-header">
          <h2 className="mt-0 mb-0">
            {optimizing ? "Optimization in Progress..." : "Optimization Results"}
          </h2>
          {!optimizing && (
            <button onClick={onClose} className="modal-close-btn">
              &times;
            </button>
          )}
        </div>

        {/* Progress Bar (during optimization) */}
        {optimizing && <ModalProgressBar progress={progress} />}

        {/* Modal Body - Log and Results */}
        <ModalLogSection
          logs={logs}
          results={results}
          expandedResults={expandedResults}
          toggleExpand={toggleExpand}
        />

        {/* Modal Footer */}
        <div className="optimizer-modal-footer">
          {hasSuccessfulResults && !optimizing && (
            <button onClick={onSaveResults} className="optimize-button">
              Save Results
            </button>
          )}
          <button
            onClick={onClose}
            disabled={optimizing}
            className={`secondary optimize-action-button ${optimizing ? "disabled" : ""}`}
          >
            {optimizing ? "Running..." : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
