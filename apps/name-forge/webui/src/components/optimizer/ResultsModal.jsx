import React, { useState } from 'react';
import DomainDiff from './DomainDiff';

/**
 * ResultsModal - Modal showing optimization progress and results
 */
export default function ResultsModal({
  show,
  onClose,
  optimizing,
  progress,
  logs,
  results,
  onSaveResults,
}) {
  const [expandedResults, setExpandedResults] = useState(new Set());

  const toggleExpand = (domainId) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      if (next.has(domainId)) {
        next.delete(domainId);
      } else {
        next.add(domainId);
      }
      return next;
    });
  };

  if (!show) return null;

  return (
    <div
      className="optimizer-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget && !optimizing) onClose(); }}
    >
      <div className="optimizer-modal">
        {/* Modal Header */}
        <div className="optimizer-modal-header">
          <h2 className="mt-0 mb-0">
            {optimizing ? 'Optimization in Progress...' : 'Optimization Results'}
          </h2>
          {!optimizing && (
            <button
              onClick={onClose}
              className="modal-close-btn"
            >
              ×
            </button>
          )}
        </div>

        {/* Progress Bar (during optimization) */}
        {optimizing && (
          <div className="optimizer-progress-section">
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
                className="progress-bar-fill"
                style={{ width: `${progress.total > 0 ? (progress.current / progress.total * 100) : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Modal Body - Log and Results */}
        <div className="optimizer-modal-body">
          {/* Log Section */}
          <div className="optimizer-log-section">
            <h3 className="section-title mt-0">
              Optimization Log
            </h3>
            <div className="optimizer-log">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className={`log-entry ${log.type}`}
                >
                  {log.message}
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-muted italic">Waiting for optimization to start...</div>
              )}
            </div>

            {/* Results Table */}
            {results.length > 0 && (
              <div className="mt-lg">
                <h3 className="section-title mt-0">
                  Results Summary
                </h3>
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
                      {results.map((result, i) => {
                        const isExpanded = expandedResults.has(result.domainId);

                        return (
                          <React.Fragment key={result.domainId}>
                            <tr
                              onClick={result.success ? () => toggleExpand(result.domainId) : undefined}
                              className={`results-row ${isExpanded ? 'expanded' : ''} ${result.success ? 'clickable' : ''}`}
                            >
                              <td className="col-expand">
                                {result.success && (
                                  <span className="text-small">{isExpanded ? '▼' : '▶'}</span>
                                )}
                              </td>
                              <td>
                                {result.success ? (
                                  <span className="text-success mr-sm">✓</span>
                                ) : (
                                  <span className="text-danger mr-sm">✗</span>
                                )}
                                {result.domainId}
                              </td>
                              <td className="text-right">
                                {result.success ? result.initialFitness?.toFixed(3) : '-'}
                              </td>
                              <td className="text-right">
                                {result.success ? result.finalFitness?.toFixed(3) : '-'}
                              </td>
                              <td className={`text-right ${result.success ? 'text-gold font-bold' : 'text-danger'}`}>
                                {result.success ? `+${((result.improvement || 0) * 100).toFixed(1)}%` : result.error}
                              </td>
                            </tr>
                            {isExpanded && result.success && (
                              <tr key={`${i}-diff`}>
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
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="optimizer-modal-footer">
          {results.length > 0 && results.some(r => r.success) && !optimizing && (
            <button
              onClick={onSaveResults}
              className="optimize-button"
            >
              Save Results
            </button>
          )}
          <button
            onClick={onClose}
            disabled={optimizing}
            className={`secondary optimize-action-button ${optimizing ? 'disabled' : ''}`}
          >
            {optimizing ? 'Running...' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
