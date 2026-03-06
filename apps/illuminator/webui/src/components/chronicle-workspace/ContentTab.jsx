import React, { useMemo, useState, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import { diffWords } from "diff";
import ChronicleVersionSelector from "./ChronicleVersionSelector";
import "./ContentTab.css";

// ============================================================================
// Assembled Content Viewer (local)
// ============================================================================

function AssembledContentViewer({
  content,
  wordCount,
  onCopy,
  compareContent,
  compareLabel,
  onQuickCheck,
  quickCheckRunning,
  quickCheckReport,
  onShowQuickCheck,
  onFindReplace,
}) {
  const diffParts = useMemo(() => {
    if (!compareContent) return null;
    return diffWords(compareContent, content);
  }, [content, compareContent]);

  let qcColorClass = "";
  if (quickCheckReport) {
    if (quickCheckReport.assessment === "clean") {
      qcColorClass = "ctab-qc-indicator-clean";
    } else if (quickCheckReport.assessment === "minor") {
      qcColorClass = "ctab-qc-indicator-minor";
    } else {
      qcColorClass = "ctab-qc-indicator-major";
    }
  }

  return (
    <div className="ilu-container ctab-viewer">
      <div className="ilu-container-header ctab-viewer-toolbar">
        <span className="ctab-word-count">
          {wordCount.toLocaleString()} words
          {diffParts && (
            <span className="ctab-diff-label">
              &mdash; diff vs {compareLabel}
              <span className="ctab-diff-added">
                +
                {diffParts
                  .filter((p) => p.added)
                  .reduce((n, p) => n + p.value.split(/\s+/).filter(Boolean).length, 0)}
              </span>
              <span className="ctab-diff-removed">
                -
                {diffParts
                  .filter((p) => p.removed)
                  .reduce((n, p) => n + p.value.split(/\s+/).filter(Boolean).length, 0)}
              </span>
            </span>
          )}
        </span>
        <div className="ctab-toolbar-actions">
          {onQuickCheck && (
            <>
              <button
                onClick={onQuickCheck}
                disabled={quickCheckRunning || !content}
                title="Check for unanchored entity references (names not in cast or name bank)"
                className={`ctab-toolbar-btn ${quickCheckRunning || !content ? "ctab-toolbar-btn-disabled" : ""}`}
              >
                {quickCheckRunning ? "Checking..." : "Quick Check"}
              </button>
              {quickCheckReport && (
                <span
                  onClick={onShowQuickCheck}
                  className={`ctab-qc-indicator ${qcColorClass}`}
                  title={`Quick check: ${quickCheckReport.assessment} (${quickCheckReport.suspects.length} suspects)`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onShowQuickCheck(e); }}
                >
                  {quickCheckReport.assessment === "clean"
                    ? "\u2713"
                    : `\u26A0 ${quickCheckReport.suspects.length}`}
                </span>
              )}
            </>
          )}
          {onFindReplace && (
            <button
              onClick={onFindReplace}
              title="Find and replace text across all versions"
              className="ctab-toolbar-btn"
            >
              Find/Replace
            </button>
          )}
          <button onClick={onCopy} className="ctab-toolbar-btn">
            Copy
          </button>
        </div>
      </div>
      <div className="ctab-viewer-body">
        {diffParts
          ? diffParts.map((part, i) => {
              if (part.added) {
                return (
                  <span key={i} className="ctab-diff-span-added">
                    {part.value}
                  </span>
                );
              }
              if (part.removed) {
                return (
                  <span key={i} className="ctab-diff-span-removed">
                    {part.value}
                  </span>
                );
              }
              return <span key={i}>{part.value}</span>;
            })
          : content}
      </div>
    </div>
  );
}

AssembledContentViewer.propTypes = {
  content: PropTypes.any,
  wordCount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onCopy: PropTypes.func,
  compareContent: PropTypes.any,
  compareLabel: PropTypes.any,
  onQuickCheck: PropTypes.func,
  quickCheckRunning: PropTypes.bool,
  quickCheckReport: PropTypes.object,
  onShowQuickCheck: PropTypes.func,
  onFindReplace: PropTypes.func,
};

// ============================================================================
// Content Tab
// ============================================================================

export default function ContentTab({
  item,
  isComplete,
  versions,
  selectedVersion,
  compareToVersion,
  selectedVersionId,
  compareToVersionId,
  activeVersionId,
  onSelectVersion,
  onSelectCompareVersion,
  onSetActiveVersion,
  onDeleteVersion,
  isGenerating,
  onQuickCheck,
  quickCheckRunning,
  onShowQuickCheck,
  onFindReplace,
  onDetectTertiaryCast,
  onToggleTertiaryCast,
}) {
  const content = isComplete
    ? item.finalContent
    : selectedVersion?.content || item.assembledContent;

  const wc = isComplete
    ? item.finalContent?.split(/\s+/).filter(Boolean).length || 0
    : (selectedVersion?.wordCount ??
      (item.assembledContent?.split(/\s+/).filter(Boolean).length || 0));

  const copyToClipboard = (text) => navigator.clipboard.writeText(text);

  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [tertiaryCastExpanded, setTertiaryCastExpanded] = useState(false);
  const [hoveredTertiaryId, setHoveredTertiaryId] = useState(null);
  const hoverTimeoutRef = useRef(null);

  const handleTertiaryMouseEnter = useCallback((entityId) => {
    clearTimeout(hoverTimeoutRef.current);
    setHoveredTertiaryId(entityId);
  }, []);
  const handleTertiaryMouseLeave = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => setHoveredTertiaryId(null), 150);
  }, []);

  const hasTertiaryCast = item.tertiaryCast?.length > 0;
  const tertiaryExpanded = tertiaryCastExpanded && hasTertiaryCast;

  return (
    <div>
      {/* Summary (collapsible) */}
      {item.summary && (
        <div className="ilu-container ctab-summary-section">
          <div
            onClick={() => setSummaryExpanded((v) => !v)}
            className={`ctab-summary-header ${summaryExpanded ? "ctab-summary-header-expanded" : ""}`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
          >
            <span className="ctab-summary-label">
              <span className="ctab-collapse-icon">{summaryExpanded ? "\u25BC" : "\u25B6"}</span>
              Summary
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(item.summary);
              }}
              className="ctab-copy-btn"
            >
              Copy
            </button>
          </div>
          {summaryExpanded && <div className="ctab-summary-body">{item.summary}</div>}
        </div>
      )}

      {/* Tertiary cast -- entities mentioned but not in declared cast (persisted) */}
      <div className="ctab-tertiary-section">
        <div
          onClick={() => hasTertiaryCast && setTertiaryCastExpanded((v) => !v)}
          className={`ctab-tertiary-header ${hasTertiaryCast ? "ctab-tertiary-header-expandable" : "ctab-tertiary-header-default"} ${tertiaryExpanded ? "ctab-tertiary-header-expanded" : "ctab-tertiary-header-collapsed"}`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
        >
          <span className="ctab-tertiary-label">
            {hasTertiaryCast && (
              <span className="ctab-collapse-icon">
                {tertiaryCastExpanded ? "\u25BC" : "\u25B6"}
              </span>
            )}
            Tertiary Cast
            {hasTertiaryCast && (
              <span className="ctab-tertiary-count">
                {item.tertiaryCast.filter((e) => e.accepted).length}/{item.tertiaryCast.length}
              </span>
            )}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDetectTertiaryCast?.();
            }}
            disabled={!content}
            className={`ctab-detect-btn ${content ? "ctab-detect-btn-enabled" : "ctab-detect-btn-disabled"}`}
          >
            {item.tertiaryCast ? "Re-detect" : "Detect"}
          </button>
        </div>
        {tertiaryExpanded && (
          <div className="ctab-tertiary-body">
            <div className="ctab-tertiary-chips">
              {item.tertiaryCast.map((entry) => {
                const isHovered = hoveredTertiaryId === entry.entityId;
                // Build context snippet from content if we have match positions
                let contextSnippet = null;
                if (isHovered && content && entry.matchStart != null && entry.matchEnd != null) {
                  const radius = 80;
                  const snippetStart = Math.max(0, entry.matchStart - radius);
                  const snippetEnd = Math.min(content.length, entry.matchEnd + radius);
                  const before =
                    (snippetStart > 0 ? "\u2026" : "") +
                    content.slice(snippetStart, entry.matchStart);
                  const matched = content.slice(entry.matchStart, entry.matchEnd);
                  const after =
                    content.slice(entry.matchEnd, snippetEnd) +
                    (snippetEnd < content.length ? "\u2026" : "");
                  contextSnippet = { before, matched, after };
                }
                return (
                  <span
                    key={entry.entityId}
                    className="ctab-tertiary-chip-wrapper"
                    onMouseEnter={() => handleTertiaryMouseEnter(entry.entityId)}
                    onMouseLeave={handleTertiaryMouseLeave}
                  >
                    <span
                      onClick={() => onToggleTertiaryCast?.(entry.entityId)}
                      className={`ctab-tertiary-chip ${entry.accepted ? "ctab-tertiary-chip-accepted" : "ctab-tertiary-chip-rejected"}`}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
                    >
                      {entry.name}
                      <span className="ctab-tertiary-chip-kind">{entry.kind}</span>
                    </span>
                    {isHovered && (
                      <div className="ctab-tertiary-tooltip">
                        <div className="ctab-tooltip-header">
                          <span>{entry.kind}</span>
                          <span>click to {entry.accepted ? "reject" : "accept"}</span>
                        </div>
                        {contextSnippet && (
                          <div className="ctab-tooltip-context">
                            {contextSnippet.before}
                            <span className="ctab-tooltip-match-highlight">
                              {contextSnippet.matched}
                            </span>
                            {contextSnippet.after}
                          </div>
                        )}
                        {!contextSnippet && entry.matchedAs !== entry.name && (
                          <div className="ctab-tooltip-matched-as">
                            matched as &ldquo;
                            <span className="ctab-tooltip-matched-name">{entry.matchedAs}</span>
                            &rdquo;
                          </div>
                        )}
                        <div className="ctab-tooltip-arrow" />
                      </div>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Version selector for assembly mode */}
      {!isComplete && versions && versions.length > 1 && (
        <div className="ctab-version-selector">
          <ChronicleVersionSelector
            versions={versions}
            selectedVersionId={selectedVersionId}
            activeVersionId={activeVersionId}
            compareToVersionId={compareToVersionId}
            onSelectVersion={onSelectVersion}
            onSelectCompareVersion={onSelectCompareVersion}
            onSetActiveVersion={onSetActiveVersion}
            onDeleteVersion={onDeleteVersion}
            disabled={isGenerating}
          />
        </div>
      )}

      <AssembledContentViewer
        content={content}
        wordCount={wc}
        onCopy={() => copyToClipboard(content)}
        compareContent={!isComplete ? compareToVersion?.content : undefined}
        compareLabel={!isComplete ? compareToVersion?.shortLabel : undefined}
        onQuickCheck={onQuickCheck}
        quickCheckRunning={quickCheckRunning}
        quickCheckReport={item.quickCheckReport}
        onShowQuickCheck={onShowQuickCheck}
        onFindReplace={onFindReplace}
      />
    </div>
  );
}

ContentTab.propTypes = {
  item: PropTypes.object,
  isComplete: PropTypes.bool,
  versions: PropTypes.array,
  selectedVersion: PropTypes.object,
  compareToVersion: PropTypes.object,
  selectedVersionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  compareToVersionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  activeVersionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSelectVersion: PropTypes.func,
  onSelectCompareVersion: PropTypes.func,
  onSetActiveVersion: PropTypes.func,
  onDeleteVersion: PropTypes.func,
  isGenerating: PropTypes.bool,
  onQuickCheck: PropTypes.func,
  quickCheckRunning: PropTypes.bool,
  onShowQuickCheck: PropTypes.func,
  onFindReplace: PropTypes.func,
  onDetectTertiaryCast: PropTypes.func,
  onToggleTertiaryCast: PropTypes.func,
};
