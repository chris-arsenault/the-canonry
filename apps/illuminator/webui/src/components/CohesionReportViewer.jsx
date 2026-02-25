/**
 * CohesionReportViewer - Display validation results from Step 4
 *
 * Shows the cohesion report with:
 * - Overall score and status
 * - Individual check results
 * - Issues with suggestions
 * - Options to accept or revise
 *
 * See CHRONICLE_DESIGN.md for architecture documentation.
 */

import { useState, useMemo } from "react";
import ChronicleImagePanel from "./ChronicleImagePanel";
import { ExpandableSeedSection } from "./ChronicleSeedViewer";
import "./CohesionReportViewer.css";

const STATUS_STYLES = {
  excellent: { bg: "#10b98120", color: "#10b981", label: "Excellent" },
  good: { bg: "#3b82f620", color: "#3b82f6", label: "Good" },
  acceptable: { bg: "#f59e0b20", color: "#f59e0b", label: "Acceptable" },
  needs_revision: { bg: "#ef444420", color: "#ef4444", label: "Needs Revision" },
};

function ScoreGauge({ score }) {
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getColor = () => {
    if (score >= 90) return "#10b981";
    if (score >= 75) return "#3b82f6";
    if (score >= 60) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="crv-gauge">
      <svg width="120" height="120" viewBox="0 0 120 120">
        {/* Background circle */}
        <circle cx="60" cy="60" r="45" fill="none" stroke="var(--bg-tertiary)" strokeWidth="10" />
        {/* Progress circle */}
        <circle
          cx="60"
          cy="60"
          r="45"
          fill="none"
          stroke={getColor()}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 60 60)"
          className="crv-gauge__progress"
        />
      </svg>
      <div className="crv-gauge__label">
        {/* eslint-disable-next-line local/no-inline-styles */}
        <div className="crv-gauge__score" style={{ '--crv-gauge-color': getColor(), color: 'var(--crv-gauge-color)' }}>{score}</div>
        <div className="crv-gauge__max">/ 100</div>
      </div>
    </div>
  );
}

function CheckItem({ label, check, isSection = false }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`crv-check ${!check.pass ? "crv-check--fail" : ""}`}>
      <div
        className={`crv-check__header ${check.notes ? "crv-check__header--clickable" : ""}`}
        onClick={() => check.notes && setExpanded(!expanded)}
      >
        <div className="crv-check__left">
          <span className={`crv-check__icon ${check.pass ? "crv-check__icon--pass" : "crv-check__icon--fail"}`}>
            {check.pass ? "✓" : "✕"}
          </span>
          <span className={`crv-check__label ${isSection ? "crv-check__label--section" : ""}`}>{label}</span>
        </div>
        {check.notes && (
          <span className="crv-check__toggle">
            {expanded ? "▾" : "▸"}
          </span>
        )}
      </div>
      {expanded && check.notes && (
        <div className="crv-check__notes">
          {check.notes}
        </div>
      )}
    </div>
  );
}

function IssueCard({ issue, sectionTitle }) {
  const isCritical = issue.severity === "critical";

  return (
    <div className={`crv-issue ${isCritical ? "crv-issue--critical" : ""}`}>
      <div className="crv-issue__header">
        <span className={`crv-issue__severity ${isCritical ? "crv-issue__severity--critical" : "crv-issue__severity--minor"}`}>
          {issue.severity}
        </span>
        <span className="crv-issue__meta">
          {issue.checkType}
          {sectionTitle && ` • ${sectionTitle}`}
        </span>
      </div>
      <div className="crv-issue__description">
        {issue.description}
      </div>
      {issue.suggestion && (
        <div className="crv-issue__suggestion">
          <strong>Suggestion:</strong> {issue.suggestion}
        </div>
      )}
    </div>
  );
}

export default function CohesionReportViewer({
  report,
  seedData = null,
  onAccept,
  onRegenerate,
  onCorrectSuggestions,
  onGenerateSummary,
  onGenerateImageRefs,
  onRevalidate,
  refinements,
  isValidationStale = false,
  editVersion = 0,
  isGenerating = false,
  imageRefs = null,
  entityMap = null,
  onGenerateChronicleImage = null,
  onResetChronicleImage = null,
  onUpdateChronicleAnchorText = null,
  onUpdateChronicleImageSize = null,
  onUpdateChronicleImageJustification = null,
  chronicleText = null,
  summaryIndicator = null,
  imageRefsIndicator = null,
  // Style library integration props
  styleLibrary = null,
  cultures = null,
  cultureIdentities = null,
  worldContext = null,
  chronicleTitle = null,
}) {
  const [activeTab, setActiveTab] = useState("summary");

  // Calculate assessment
  const assessment = useMemo(() => {
    if (!report) return null;

    const criticalIssues = report.issues.filter((i) => i.severity === "critical");
    const minorIssues = report.issues.filter((i) => i.severity === "minor");

    const failedChecks = [];
    if (!report.checks.plotStructure.pass) failedChecks.push("Structure");
    if (!report.checks.entityConsistency.pass) failedChecks.push("Entity Consistency");
    if (!report.checks.resolution.pass) failedChecks.push("Resolution");
    if (!report.checks.factualAccuracy.pass) failedChecks.push("Factual Accuracy");
    if (!report.checks.themeExpression.pass) failedChecks.push("Theme Expression");

    const failedSectionGoals = report.checks.sectionGoals.filter((sg) => !sg.pass);

    let status;
    if (report.overallScore >= 90) status = "excellent";
    else if (report.overallScore >= 75) status = "good";
    else if (report.overallScore >= 60) status = "acceptable";
    else status = "needs_revision";

    return {
      status,
      criticalIssueCount: criticalIssues.length,
      minorIssueCount: minorIssues.length,
      failedChecks,
      failedSectionGoals,
    };
  }, [report]);

  if (!report) {
    return (
      <div className="crv__empty">
        No validation report available.
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[assessment?.status || "needs_revision"];

  const sectionIdToName = new Map();
  const resolveSectionLabel = (sectionId) => sectionIdToName.get(sectionId) || sectionId;
  const hasIssues = report.issues.length > 0;
  const formatTimestamp = (timestamp) => new Date(timestamp).toLocaleString();
  const summaryState = refinements?.summary || {};
  const imageRefsState = refinements?.imageRefs || {};

  const disabledClass = (condition) => (condition ? "crv__btn--disabled" : "");

  return (
    <div className="crv">
      {/* Header with score and actions */}
      <div className="crv__header">
        <div className="crv__header-left">
          <ScoreGauge score={report.overallScore} />
          <div>
            {/* eslint-disable-next-line local/no-inline-styles */}
            <div className="crv__status-badge" style={{ '--crv-status-bg': statusStyle.bg, '--crv-status-color': statusStyle.color, background: 'var(--crv-status-bg)', color: 'var(--crv-status-color)' }}>
              {statusStyle.label}
            </div>
            <div className="crv__issue-count">
              {assessment?.criticalIssueCount || 0} critical issues •{" "}
              {assessment?.minorIssueCount || 0} minor issues
            </div>
            <div className="crv__edit-version">
              Edit version: {editVersion}
            </div>
            {assessment?.failedChecks.length > 0 && (
              <div className="crv__failed-checks">
                Failed: {assessment.failedChecks.join(", ")}
              </div>
            )}
          </div>
        </div>

        <div className="crv__actions">
          {onCorrectSuggestions && (
            <button
              onClick={onCorrectSuggestions}
              disabled={isGenerating || !hasIssues}
              className={`crv__btn crv__btn--secondary ${disabledClass(isGenerating || !hasIssues)}`}
              title={!hasIssues ? "No issues to correct" : "Apply remediation suggestions"}
            >
              ✎ Correct Suggestions
            </button>
          )}
          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            className={`crv__btn crv__btn--secondary ${disabledClass(isGenerating)}`}
          >
            ⟳ Regenerate All
          </button>
          <button
            onClick={onAccept}
            disabled={isGenerating}
            className={`crv__btn crv__btn--primary ${disabledClass(isGenerating)}`}
            // eslint-disable-next-line local/no-inline-styles
            style={{ '--crv-accept-bg': report.overallScore >= 60 ? 'var(--accent-primary)' : '#f59e0b', background: 'var(--crv-accept-bg)' }}
          >
            {report.overallScore >= 60 ? "Accept Chronicle ✓" : "Accept with Issues ⚠"}
          </button>
        </div>
      </div>

      {isValidationStale && (
        <div className="crv__stale-warning">
          <div className="crv__stale-text">
            Validation is stale after edits. Revalidate to refresh the report.
          </div>
          {onRevalidate && (
            <button
              onClick={onRevalidate}
              disabled={isGenerating}
              className={`crv__btn crv__btn--small ${disabledClass(isGenerating)}`}
            >
              Revalidate
            </button>
          )}
        </div>
      )}

      <div className="crv__refinements">
        <div className="crv__refinements-title">
          Optional Refinements
        </div>
        <div className="crv__refinements-list">
          {/* Summary */}
          <div className="crv__refinement-row">
            <div>
              <div className="crv__refinement-name">Add Summary</div>
              <div className="crv__refinement-desc">
                Generate a short summary for chronicle listings.
              </div>
              {summaryState.generatedAt && (
                <div className="crv__refinement-status">
                  Done - {formatTimestamp(summaryState.generatedAt)}
                  {summaryState.model ? ` - ${summaryState.model}` : ""}
                </div>
              )}
              {summaryIndicator && summaryState.generatedAt && (
                <div className="crv__refinement-status--tight">
                  {summaryIndicator}
                </div>
              )}
              {!summaryState.generatedAt && !summaryState.running && (
                <div className="crv__refinement-status">
                  Not run yet
                </div>
              )}
              {summaryState.running && (
                <div className="crv__refinement-status">
                  Running...
                </div>
              )}
            </div>
            {onGenerateSummary && (
              <button
                onClick={onGenerateSummary}
                disabled={isGenerating || summaryState.running}
                className={`crv__btn crv__btn--generate ${disabledClass(isGenerating || summaryState.running)}`}
              >
                {summaryState.generatedAt ? "Regenerate" : "Generate"}
              </button>
            )}
          </div>

          {/* 3. Image Refs - finds image placement opportunities in the narrative */}
          <div className="crv__refinement-row">
            <div className="crv__refinement-content">
              <div className="crv__refinement-name">Add Image Refs</div>
              <div className="crv__refinement-desc">
                Generate image placement suggestions for this chronicle.
              </div>
              {imageRefsState.generatedAt && (
                <div className="crv__refinement-status">
                  Done - {formatTimestamp(imageRefsState.generatedAt)}
                  {imageRefsState.model ? ` - ${imageRefsState.model}` : ""}
                </div>
              )}
              {imageRefsIndicator && imageRefsState.generatedAt && (
                <div className="crv__refinement-status--tight">
                  {imageRefsIndicator}
                </div>
              )}
              {!imageRefsState.generatedAt && !imageRefsState.running && (
                <div className="crv__refinement-status">
                  Not run yet
                </div>
              )}
              {imageRefsState.running && (
                <div className="crv__refinement-status">
                  Running...
                </div>
              )}
            </div>
            {onGenerateImageRefs && (
              <button
                onClick={onGenerateImageRefs}
                disabled={isGenerating || imageRefsState.running}
                className={`crv__btn crv__btn--generate ${disabledClass(isGenerating || imageRefsState.running)}`}
              >
                {imageRefsState.generatedAt ? "Regenerate" : "Generate"}
              </button>
            )}
          </div>

          {/* Show ChronicleImagePanel when imageRefs are available */}
          {imageRefs && entityMap && (
            <div className="crv__image-panel-wrap">
              <ChronicleImagePanel
                imageRefs={imageRefs}
                entities={entityMap}
                onGenerateImage={onGenerateChronicleImage}
                onResetImage={onResetChronicleImage}
                onUpdateAnchorText={onUpdateChronicleAnchorText}
                onUpdateSize={onUpdateChronicleImageSize}
                onUpdateJustification={onUpdateChronicleImageJustification}
                chronicleText={chronicleText || undefined}
                isGenerating={isGenerating}
                styleLibrary={styleLibrary}
                cultures={cultures}
                cultureIdentities={cultureIdentities}
                worldContext={worldContext}
                chronicleTitle={chronicleTitle}
              />
            </div>
          )}
        </div>
      </div>

      {/* Generation Context (expandable) */}
      {seedData && <ExpandableSeedSection seed={seedData} defaultExpanded={false} />}

      {/* Tabs */}
      <div className="crv__tabs">
        {["summary", "checks", "issues"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`crv__tab ${activeTab === tab ? "crv__tab--active" : ""}`}
          >
            {tab}
            {tab === "issues" && report.issues.length > 0 && (
              <span className={`crv__tab-badge ${assessment?.criticalIssueCount > 0 ? "crv__tab-badge--critical" : "crv__tab-badge--minor"}`}>
                {report.issues.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "summary" && (
        <div className="crv__panel">
          <h3 className="crv__panel-title">Validation Summary</h3>

          <div className="crv__summary-grid">
            <div className="crv__summary-card">
              {/* eslint-disable-next-line local/no-inline-styles */}
              <div className="crv__summary-card-icon" style={{ '--crv-check-color': report.checks.plotStructure.pass ? '#10b981' : '#ef4444', color: 'var(--crv-check-color)' }}>
                {report.checks.plotStructure.pass ? "✓" : "✕"}
              </div>
              <div className="crv__summary-card-label">
                Structure
              </div>
            </div>
            <div className="crv__summary-card">
              {/* eslint-disable-next-line local/no-inline-styles */}
              <div className="crv__summary-card-icon" style={{ '--crv-check-color': report.checks.entityConsistency.pass ? '#10b981' : '#ef4444', color: 'var(--crv-check-color)' }}>
                {report.checks.entityConsistency.pass ? "✓" : "✕"}
              </div>
              <div className="crv__summary-card-label">
                Entity Consistency
              </div>
            </div>
            <div className="crv__summary-card">
              {/* eslint-disable-next-line local/no-inline-styles */}
              <div className="crv__summary-card-icon" style={{ '--crv-check-color': report.checks.resolution.pass ? '#10b981' : '#ef4444', color: 'var(--crv-check-color)' }}>
                {report.checks.resolution.pass ? "✓" : "✕"}
              </div>
              <div className="crv__summary-card-label">
                Resolution
              </div>
            </div>
          </div>

          {report.checks.plotStructure.notes && (
            <div className="crv__notes-section">
              <div className="crv__notes-label">
                Structure Notes:
              </div>
              <div className="crv__notes-text">
                {report.checks.plotStructure.notes}
              </div>
            </div>
          )}

          {report.checks.themeExpression.notes && (
            <div>
              <div className="crv__notes-label">
                Theme Expression:
              </div>
              <div className="crv__notes-text">
                {report.checks.themeExpression.notes}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "checks" && (
        <div className="crv__checks-panel">
          <CheckItem label="Structure" check={report.checks.plotStructure} />
          <CheckItem label="Entity Consistency" check={report.checks.entityConsistency} />
          <CheckItem label="Resolution" check={report.checks.resolution} />
          <CheckItem label="Factual Accuracy" check={report.checks.factualAccuracy} />
          <CheckItem label="Theme Expression" check={report.checks.themeExpression} />

          <div className="crv__section-goals-header">
            Section Goals ({report.checks.sectionGoals.filter((sg) => sg.pass).length}/
            {report.checks.sectionGoals.length} passed)
          </div>
          {report.checks.sectionGoals.map((sg) => (
            <div key={sg.sectionId} className="crv__section-goal-row">
              <div className="crv__section-goal-check">
                <CheckItem label={resolveSectionLabel(sg.sectionId)} check={sg} isSection />
              </div>
              {!sg.pass && (
                <span className="crv__section-goal-label">
                  Needs revision
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === "issues" && (
        <div>
          {report.issues.length === 0 ? (
            <div className="crv__no-issues">
              <div className="crv__no-issues-icon">🎉</div>
              <div className="crv__no-issues-text">No issues found!</div>
            </div>
          ) : (
            <>
              {/* Critical issues first */}
              {report.issues.filter((i) => i.severity === "critical").length > 0 && (
                <div className="crv__issues-group">
                  <h4 className="crv__issues-heading crv__issues-heading--critical">
                    Critical Issues ({report.issues.filter((i) => i.severity === "critical").length}
                    )
                  </h4>
                  {report.issues
                    .filter((i) => i.severity === "critical")
                    .map((issue, idx) => (
                      <IssueCard
                        key={idx}
                        issue={issue}
                        sectionTitle={
                          issue.sectionId ? resolveSectionLabel(issue.sectionId) : undefined
                        }
                      />
                    ))}
                </div>
              )}

              {/* Minor issues */}
              {report.issues.filter((i) => i.severity === "minor").length > 0 && (
                <div>
                  <h4 className="crv__issues-heading crv__issues-heading--minor">
                    Minor Issues ({report.issues.filter((i) => i.severity === "minor").length})
                  </h4>
                  {report.issues
                    .filter((i) => i.severity === "minor")
                    .map((issue, idx) => (
                      <IssueCard
                        key={idx}
                        issue={issue}
                        sectionTitle={
                          issue.sectionId ? resolveSectionLabel(issue.sectionId) : undefined
                        }
                      />
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
