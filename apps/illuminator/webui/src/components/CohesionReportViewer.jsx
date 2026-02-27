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

import React, { useState, useMemo } from "react";
import PropTypes from "prop-types";
import ChronicleImagePanel from "./ChronicleImagePanel";
import { ExpandableSeedSection } from "@penguin-tales/shared-components";
import "./CohesionReportViewer.css";
const STATUS_STYLES = {
  excellent: {
    bg: "#10b98120",
    color: "#10b981",
    label: "Excellent"
  },
  good: {
    bg: "#3b82f620",
    color: "#3b82f6",
    label: "Good"
  },
  acceptable: {
    bg: "#f59e0b20",
    color: "#f59e0b",
    label: "Acceptable"
  },
  needs_revision: {
    bg: "#ef444420",
    color: "#ef4444",
    label: "Needs Revision"
  }
};
function ScoreGauge({
  score
}) {
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - score / 100 * circumference;
  const getColor = () => {
    if (score >= 90) return "#10b981";
    if (score >= 75) return "#3b82f6";
    if (score >= 60) return "#f59e0b";
    return "#ef4444";
  };
  return <div className="crv-gauge">
      <svg width="120" height="120" viewBox="0 0 120 120">
        {/* Background circle */}
        <circle cx="60" cy="60" r="45" fill="none" stroke="var(--bg-tertiary)" strokeWidth="10" />
        {/* Progress circle */}
        <circle cx="60" cy="60" r="45" fill="none" stroke={getColor()} strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} transform="rotate(-90 60 60)" className="crv-gauge-progress" />
      </svg>
      <div className="crv-gauge-label">
        {}
        <div className={score >= 90 ? "crv-gauge-score crv-gauge-score-excellent" : score >= 75 ? "crv-gauge-score crv-gauge-score-good" : score >= 60 ? "crv-gauge-score crv-gauge-score-acceptable" : "crv-gauge-score crv-gauge-score-needs-revision"}>
          {score}
        </div>
        <div className="crv-gauge-max">/ 100</div>
      </div>
    </div>;
}
function CheckItem({
  label,
  check,
  isSection = false
}) {
  const [expanded, setExpanded] = useState(false);
  return <div className={`crv-check ${!check.pass ? "crv-check-fail" : ""}`}>
      <div className={`crv-check-header ${check.notes ? "crv-check-header-clickable" : ""}`} onClick={() => check.notes && setExpanded(!expanded)} role="button" tabIndex={0} onKeyDown={e => {
      if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
    }}>
        <div className="crv-check-left">
          <span className={`crv-check-icon ${check.pass ? "crv-check-icon-pass" : "crv-check-icon-fail"}`}>
            {check.pass ? "✓" : "✕"}
          </span>
          <span className={`crv-check-label ${isSection ? "crv-check-label-section" : ""}`}>
            {label}
          </span>
        </div>
        {check.notes && <span className="crv-check-toggle">{expanded ? "▾" : "▸"}</span>}
      </div>
      {expanded && check.notes && <div className="crv-check-notes">{check.notes}</div>}
    </div>;
}
function IssueCard({
  issue,
  sectionTitle
}) {
  const isCritical = issue.severity === "critical";
  return <div className={`crv-issue ${isCritical ? "crv-issue-critical" : ""}`}>
      <div className="crv-issue-header">
        <span className={`crv-issue-severity ${isCritical ? "crv-issue-severity-critical" : "crv-issue-severity-minor"}`}>
          {issue.severity}
        </span>
        <span className="crv-issue-meta">
          {issue.checkType}
          {sectionTitle && ` • ${sectionTitle}`}
        </span>
      </div>
      <div className="crv-issue-description">{issue.description}</div>
      {issue.suggestion && <div className="crv-issue-suggestion">
          <strong>Suggestion:</strong> {issue.suggestion}
        </div>}
    </div>;
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
  chronicleTitle = null
}) {
  const [activeTab, setActiveTab] = useState("summary");

  // Calculate assessment
  const assessment = useMemo(() => {
    if (!report) return null;
    const criticalIssues = report.issues.filter(i => i.severity === "critical");
    const minorIssues = report.issues.filter(i => i.severity === "minor");
    const failedChecks = [];
    if (!report.checks.plotStructure.pass) failedChecks.push("Structure");
    if (!report.checks.entityConsistency.pass) failedChecks.push("Entity Consistency");
    if (!report.checks.resolution.pass) failedChecks.push("Resolution");
    if (!report.checks.factualAccuracy.pass) failedChecks.push("Factual Accuracy");
    if (!report.checks.themeExpression.pass) failedChecks.push("Theme Expression");
    const failedSectionGoals = report.checks.sectionGoals.filter(sg => !sg.pass);
    let status;
    if (report.overallScore >= 90) status = "excellent";else if (report.overallScore >= 75) status = "good";else if (report.overallScore >= 60) status = "acceptable";else status = "needs_revision";
    return {
      status,
      criticalIssueCount: criticalIssues.length,
      minorIssueCount: minorIssues.length,
      failedChecks,
      failedSectionGoals
    };
  }, [report]);
  if (!report) {
    return <div className="crv-empty">No validation report available.</div>;
  }
  const statusStyle = STATUS_STYLES[assessment?.status || "needs_revision"];
  const resolveSectionLabel = sectionId => sectionId;
  const hasIssues = report.issues.length > 0;
  const formatTimestamp = timestamp => new Date(timestamp).toLocaleString();
  const summaryState = refinements?.summary || {};
  const imageRefsState = refinements?.imageRefs || {};
  const disabledClass = condition => condition ? "crv-btn-disabled" : "";
  return <div className="crv">
      {/* Header with score and actions */}
      <div className="crv-header">
        <div className="crv-header-left">
          <ScoreGauge score={report.overallScore} />
          <div>
            {}
            <div className={`crv-status-badge crv-status-badge-${assessment?.status || "needs_revision"}`}>
              {statusStyle.label}
            </div>
            <div className="crv-issue-count">
              {assessment?.criticalIssueCount || 0} critical issues •{" "}
              {assessment?.minorIssueCount || 0} minor issues
            </div>
            <div className="crv-edit-version">Edit version: {editVersion}</div>
            {assessment?.failedChecks.length > 0 && <div className="crv-failed-checks">Failed: {assessment.failedChecks.join(", ")}</div>}
          </div>
        </div>

        <div className="crv-actions">
          {onCorrectSuggestions && <button onClick={onCorrectSuggestions} disabled={isGenerating || !hasIssues} className={`crv-btn crv-btn-secondary ${disabledClass(isGenerating || !hasIssues)}`} title={!hasIssues ? "No issues to correct" : "Apply remediation suggestions"}>
              ✎ Correct Suggestions
            </button>}
          <button onClick={onRegenerate} disabled={isGenerating} className={`crv-btn crv-btn-secondary ${disabledClass(isGenerating)}`}>
            ⟳ Regenerate All
          </button>
          <button onClick={onAccept} disabled={isGenerating} className={`crv-btn crv-btn-primary ${report.overallScore >= 60 ? "crv-btn-accept-ready" : "crv-btn-accept-warning"} ${disabledClass(isGenerating)}`}>
            {report.overallScore >= 60 ? "Accept Chronicle ✓" : "Accept with Issues ⚠"}
          </button>
        </div>
      </div>

      {isValidationStale && <div className="crv-stale-warning">
          <div className="crv-stale-text">
            Validation is stale after edits. Revalidate to refresh the report.
          </div>
          {onRevalidate && <button onClick={onRevalidate} disabled={isGenerating} className={`crv-btn crv-btn-small ${disabledClass(isGenerating)}`}>
              Revalidate
            </button>}
        </div>}

      <div className="crv-refinements">
        <div className="crv-refinements-title">Optional Refinements</div>
        <div className="crv-refinements-list">
          {/* Summary */}
          <div className="crv-refinement-row">
            <div>
              <div className="crv-refinement-name">Add Summary</div>
              <div className="crv-refinement-desc">
                Generate a short summary for chronicle listings.
              </div>
              {summaryState.generatedAt && <div className="crv-refinement-status">
                  Done - {formatTimestamp(summaryState.generatedAt)}
                  {summaryState.model ? ` - ${summaryState.model}` : ""}
                </div>}
              {summaryIndicator && summaryState.generatedAt && <div className="crv-refinement-status-tight">{summaryIndicator}</div>}
              {!summaryState.generatedAt && !summaryState.running && <div className="crv-refinement-status">Not run yet</div>}
              {summaryState.running && <div className="crv-refinement-status">Running...</div>}
            </div>
            {onGenerateSummary && <button onClick={onGenerateSummary} disabled={isGenerating || summaryState.running} className={`crv-btn crv-btn-generate ${disabledClass(isGenerating || summaryState.running)}`}>
                {summaryState.generatedAt ? "Regenerate" : "Generate"}
              </button>}
          </div>

          {/* 3. Image Refs - finds image placement opportunities in the narrative */}
          <div className="crv-refinement-row">
            <div className="crv-refinement-content">
              <div className="crv-refinement-name">Add Image Refs</div>
              <div className="crv-refinement-desc">
                Generate image placement suggestions for this chronicle.
              </div>
              {imageRefsState.generatedAt && <div className="crv-refinement-status">
                  Done - {formatTimestamp(imageRefsState.generatedAt)}
                  {imageRefsState.model ? ` - ${imageRefsState.model}` : ""}
                </div>}
              {imageRefsIndicator && imageRefsState.generatedAt && <div className="crv-refinement-status-tight">{imageRefsIndicator}</div>}
              {!imageRefsState.generatedAt && !imageRefsState.running && <div className="crv-refinement-status">Not run yet</div>}
              {imageRefsState.running && <div className="crv-refinement-status">Running...</div>}
            </div>
            {onGenerateImageRefs && <button onClick={onGenerateImageRefs} disabled={isGenerating || imageRefsState.running} className={`crv-btn crv-btn-generate ${disabledClass(isGenerating || imageRefsState.running)}`}>
                {imageRefsState.generatedAt ? "Regenerate" : "Generate"}
              </button>}
          </div>

          {/* Show ChronicleImagePanel when imageRefs are available */}
          {imageRefs && entityMap && <div className="crv-image-panel-wrap">
              <ChronicleImagePanel imageRefs={imageRefs} entities={entityMap} onGenerateImage={onGenerateChronicleImage} onResetImage={onResetChronicleImage} onUpdateAnchorText={onUpdateChronicleAnchorText} onUpdateSize={onUpdateChronicleImageSize} onUpdateJustification={onUpdateChronicleImageJustification} chronicleText={chronicleText || undefined} isGenerating={isGenerating} styleLibrary={styleLibrary} cultures={cultures} cultureIdentities={cultureIdentities} worldContext={worldContext} chronicleTitle={chronicleTitle} />
            </div>}
        </div>
      </div>

      {/* Generation Context (expandable) */}
      {seedData && <ExpandableSeedSection seed={seedData} defaultExpanded={false} />}

      {/* Tabs */}
      <div className="crv-tabs">
        {["summary", "checks", "issues"].map(tab => <button key={tab} onClick={() => setActiveTab(tab)} className={`crv-tab ${activeTab === tab ? "crv-tab-active" : ""}`}>
            {tab}
            {tab === "issues" && report.issues.length > 0 && <span className={`crv-tab-badge ${assessment?.criticalIssueCount > 0 ? "crv-tab-badge-critical" : "crv-tab-badge-minor"}`}>
                {report.issues.length}
              </span>}
          </button>)}
      </div>

      {/* Tab content */}
      {activeTab === "summary" && <div className="crv-panel">
          <h3 className="crv-panel-title">Validation Summary</h3>

          <div className="crv-summary-grid">
            <div className="crv-summary-card">
              {}
              <div className={report.checks.plotStructure.pass ? "crv-summary-card-icon crv-summary-card-icon-pass" : "crv-summary-card-icon crv-summary-card-icon-fail"}>
                {report.checks.plotStructure.pass ? "✓" : "✕"}
              </div>
              <div className="crv-summary-card-label">Structure</div>
            </div>
            <div className="crv-summary-card">
              {}
              <div className={report.checks.entityConsistency.pass ? "crv-summary-card-icon crv-summary-card-icon-pass" : "crv-summary-card-icon crv-summary-card-icon-fail"}>
                {report.checks.entityConsistency.pass ? "✓" : "✕"}
              </div>
              <div className="crv-summary-card-label">Entity Consistency</div>
            </div>
            <div className="crv-summary-card">
              {}
              <div className={report.checks.resolution.pass ? "crv-summary-card-icon crv-summary-card-icon-pass" : "crv-summary-card-icon crv-summary-card-icon-fail"}>
                {report.checks.resolution.pass ? "✓" : "✕"}
              </div>
              <div className="crv-summary-card-label">Resolution</div>
            </div>
          </div>

          {report.checks.plotStructure.notes && <div className="crv-notes-section">
              <div className="crv-notes-label">Structure Notes:</div>
              <div className="crv-notes-text">{report.checks.plotStructure.notes}</div>
            </div>}

          {report.checks.themeExpression.notes && <div>
              <div className="crv-notes-label">Theme Expression:</div>
              <div className="crv-notes-text">{report.checks.themeExpression.notes}</div>
            </div>}
        </div>}

      {activeTab === "checks" && <div className="crv-checks-panel">
          <CheckItem label="Structure" check={report.checks.plotStructure} />
          <CheckItem label="Entity Consistency" check={report.checks.entityConsistency} />
          <CheckItem label="Resolution" check={report.checks.resolution} />
          <CheckItem label="Factual Accuracy" check={report.checks.factualAccuracy} />
          <CheckItem label="Theme Expression" check={report.checks.themeExpression} />

          <div className="crv-section-goals-header">
            Section Goals ({report.checks.sectionGoals.filter(sg => sg.pass).length}/
            {report.checks.sectionGoals.length} passed)
          </div>
          {report.checks.sectionGoals.map(sg => <div key={sg.sectionId} className="crv-section-goal-row">
              <div className="crv-section-goal-check">
                <CheckItem label={resolveSectionLabel(sg.sectionId)} check={sg} isSection />
              </div>
              {!sg.pass && <span className="crv-section-goal-label">Needs revision</span>}
            </div>)}
        </div>}

      {activeTab === "issues" && <div>
          {report.issues.length === 0 ? <div className="crv-no-issues">
              <div className="crv-no-issues-icon">🎉</div>
              <div className="crv-no-issues-text">No issues found!</div>
            </div> : <>
              {/* Critical issues first */}
              {report.issues.filter(i => i.severity === "critical").length > 0 && <div className="crv-issues-group">
                  <h4 className="crv-issues-heading crv-issues-heading-critical">
                    Critical Issues ({report.issues.filter(i => i.severity === "critical").length}
                    )
                  </h4>
                  {report.issues.filter(i => i.severity === "critical").map((issue, idx) => <IssueCard key={idx} issue={issue} sectionTitle={issue.sectionId ? resolveSectionLabel(issue.sectionId) : undefined} />)}
                </div>}

              {/* Minor issues */}
              {report.issues.filter(i => i.severity === "minor").length > 0 && <div>
                  <h4 className="crv-issues-heading crv-issues-heading-minor">
                    Minor Issues ({report.issues.filter(i => i.severity === "minor").length})
                  </h4>
                  {report.issues.filter(i => i.severity === "minor").map((issue, idx) => <IssueCard key={idx} issue={issue} sectionTitle={issue.sectionId ? resolveSectionLabel(issue.sectionId) : undefined} />)}
                </div>}
            </>}
        </div>}
    </div>;
}
ScoreGauge.propTypes = {
  score: PropTypes.number.isRequired
};
CheckItem.propTypes = {
  label: PropTypes.string.isRequired,
  check: PropTypes.object.isRequired,
  isSection: PropTypes.bool
};
IssueCard.propTypes = {
  issue: PropTypes.object.isRequired,
  sectionTitle: PropTypes.string
};
CohesionReportViewer.propTypes = {
  report: PropTypes.object,
  seedData: PropTypes.object,
  onAccept: PropTypes.func.isRequired,
  onRegenerate: PropTypes.func.isRequired,
  onCorrectSuggestions: PropTypes.func,
  onGenerateSummary: PropTypes.func,
  onGenerateImageRefs: PropTypes.func,
  onRevalidate: PropTypes.func,
  refinements: PropTypes.object,
  isValidationStale: PropTypes.bool,
  editVersion: PropTypes.number,
  isGenerating: PropTypes.bool,
  imageRefs: PropTypes.object,
  entityMap: PropTypes.object,
  onGenerateChronicleImage: PropTypes.func,
  onResetChronicleImage: PropTypes.func,
  onUpdateChronicleAnchorText: PropTypes.func,
  onUpdateChronicleImageSize: PropTypes.func,
  onUpdateChronicleImageJustification: PropTypes.func,
  chronicleText: PropTypes.string,
  summaryIndicator: PropTypes.node,
  imageRefsIndicator: PropTypes.node,
  styleLibrary: PropTypes.object,
  cultures: PropTypes.array,
  cultureIdentities: PropTypes.object,
  worldContext: PropTypes.object,
  chronicleTitle: PropTypes.string
};
