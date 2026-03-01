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

import React, { useState, useMemo, useCallback } from "react";
import ChronicleImagePanel from "./ChronicleImagePanel";
import { ExpandableSeedSection, useExpandSingle } from "@the-canonry/shared-components";
import type { CohesionReport, CohesionCheck, SectionGoalCheck, CohesionIssue } from "../lib/chronicleTypes";
import type { ChronicleImageRefs } from "../lib/chronicleTypes";
import "./CohesionReportViewer.css";

// ============================================================================
// Types
// ============================================================================

interface StatusStyleEntry {
  bg: string;
  color: string;
  label: string;
}

type AssessmentStatus = "excellent" | "good" | "acceptable" | "needs_revision";

interface Assessment {
  status: AssessmentStatus;
  criticalIssueCount: number;
  minorIssueCount: number;
  failedChecks: string[];
  failedSectionGoals: SectionGoalCheck[];
}

interface RefinementState {
  generatedAt?: number;
  model?: string;
  running?: boolean;
}

interface Refinements {
  summary?: RefinementState;
  imageRefs?: RefinementState;
}

interface ChronicleImagePanelConfig {
  imageRefs: ChronicleImageRefs | null;
  entityMap: Map<string, unknown> | null;
  onGenerateChronicleImage: ((ref: unknown, prompt: string, styleInfo: unknown) => void) | null;
  onResetChronicleImage: ((ref: unknown) => void) | null;
  onUpdateChronicleAnchorText: ((ref: unknown, text: string) => void) | null;
  onUpdateChronicleImageSize: ((ref: unknown, size: unknown) => void) | null;
  onUpdateChronicleImageJustification: ((ref: unknown, just: "left" | "right") => void) | null;
  chronicleText: string | null;
  styleLibrary: unknown;
  cultures: unknown[] | null;
  cultureIdentities: unknown;
  worldContext: unknown;
  chronicleTitle: string | null;
}

interface CohesionReportViewerProps {
  report: CohesionReport | null;
  seedData?: unknown;
  onAccept: () => void;
  onRegenerate: () => void;
  onCorrectSuggestions?: () => void;
  onGenerateSummary?: () => void;
  onGenerateImageRefs?: () => void;
  onRevalidate?: () => void;
  refinements?: Refinements;
  isValidationStale?: boolean;
  editVersion?: number;
  isGenerating?: boolean;
  summaryIndicator?: React.ReactNode;
  imageRefsIndicator?: React.ReactNode;
  imageConfig?: ChronicleImagePanelConfig;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_STYLES: Record<AssessmentStatus, StatusStyleEntry> = {
  excellent: {
    bg: "#10b98120",
    color: "#10b981",
    label: "Excellent",
  },
  good: {
    bg: "#3b82f620",
    color: "#3b82f6",
    label: "Good",
  },
  acceptable: {
    bg: "#f59e0b20",
    color: "#f59e0b",
    label: "Acceptable",
  },
  needs_revision: {
    bg: "#ef444420",
    color: "#ef4444",
    label: "Needs Revision",
  },
};

// ============================================================================
// Sub-components
// ============================================================================

function getScoreClassName(score: number): string {
  if (score >= 90) return "crv-gauge-score crv-gauge-score-excellent";
  if (score >= 75) return "crv-gauge-score crv-gauge-score-good";
  if (score >= 60) return "crv-gauge-score crv-gauge-score-acceptable";
  return "crv-gauge-score crv-gauge-score-needs-revision";
}

function ScoreGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset =
    circumference - (score / 100) * circumference;
  const getColor = () => {
    if (score >= 90) return "#10b981";
    if (score >= 75) return "#3b82f6";
    if (score >= 60) return "#f59e0b";
    return "#ef4444";
  };
  return (
    <div className="crv-gauge">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle
          cx="60" cy="60" r="45" fill="none"
          stroke="var(--bg-tertiary)" strokeWidth="10"
        />
        <circle
          cx="60" cy="60" r="45" fill="none"
          stroke={getColor()} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 60 60)" className="crv-gauge-progress"
        />
      </svg>
      <div className="crv-gauge-label">
        <div className={getScoreClassName(score)}>{score}</div>
        <div className="crv-gauge-max">/ 100</div>
      </div>
    </div>
  );
}

interface CheckItemProps {
  label: string;
  check: CohesionCheck | SectionGoalCheck;
  isSection?: boolean;
}

function CheckItem({ label, check, isSection = false }: CheckItemProps) {
  const { expandedId, toggle } = useExpandSingle();
  const itemId = label;
  const expanded = expandedId === itemId;

  const handleClick = useCallback(() => {
    if (check.notes) toggle(itemId);
  }, [check.notes, toggle, itemId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  return (
    <div className={`crv-check ${!check.pass ? "crv-check-fail" : ""}`}>
      <div
        className={`crv-check-header ${check.notes ? "crv-check-header-clickable" : ""}`}
        onClick={handleClick} role="button" tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <div className="crv-check-left">
          <span className={`crv-check-icon ${check.pass ? "crv-check-icon-pass" : "crv-check-icon-fail"}`}>
            {check.pass ? "\u2713" : "\u2715"}
          </span>
          <span className={`crv-check-label ${isSection ? "crv-check-label-section" : ""}`}>
            {label}
          </span>
        </div>
        {check.notes && <span className="crv-check-toggle">{expanded ? "\u25BE" : "\u25B8"}</span>}
      </div>
      {expanded && check.notes && <div className="crv-check-notes">{check.notes}</div>}
    </div>
  );
}

interface IssueCardProps {
  issue: CohesionIssue;
  sectionTitle?: string;
}

function IssueCard({ issue, sectionTitle }: IssueCardProps) {
  const isCritical = issue.severity === "critical";
  return (
    <div className={`crv-issue ${isCritical ? "crv-issue-critical" : ""}`}>
      <div className="crv-issue-header">
        <span className={`crv-issue-severity ${isCritical ? "crv-issue-severity-critical" : "crv-issue-severity-minor"}`}>
          {issue.severity}
        </span>
        <span className="crv-issue-meta">
          {issue.checkType}
          {sectionTitle && ` \u2022 ${sectionTitle}`}
        </span>
      </div>
      <div className="crv-issue-description">{issue.description}</div>
      {issue.suggestion && (
        <div className="crv-issue-suggestion">
          <strong>Suggestion:</strong> {issue.suggestion}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Refinement Row
// ============================================================================

interface RefinementRowProps {
  name: string;
  desc: string;
  state: RefinementState;
  indicator?: React.ReactNode;
  isGenerating: boolean;
  onGenerate?: () => void;
}

function RefinementRow({ name, desc, state, indicator, isGenerating, onGenerate }: RefinementRowProps) {
  const formatTimestamp = (ts: number) => new Date(ts).toLocaleString();
  const disabledClass = isGenerating || state.running ? "crv-btn-disabled" : "";

  return (
    <div className="crv-refinement-row">
      <div className="crv-refinement-content">
        <div className="crv-refinement-name">{name}</div>
        <div className="crv-refinement-desc">{desc}</div>
        {state.generatedAt && (
          <div className="crv-refinement-status">
            Done - {formatTimestamp(state.generatedAt)}
            {state.model ? ` - ${state.model}` : ""}
          </div>
        )}
        {indicator && state.generatedAt && (
          <div className="crv-refinement-status-tight">{indicator}</div>
        )}
        {!state.generatedAt && !state.running && (
          <div className="crv-refinement-status">Not run yet</div>
        )}
        {state.running && <div className="crv-refinement-status">Running...</div>}
      </div>
      {onGenerate && (
        <button
          onClick={onGenerate}
          disabled={isGenerating || !!state.running}
          className={`crv-btn crv-btn-generate ${disabledClass}`}
        >
          {state.generatedAt ? "Regenerate" : "Generate"}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Header
// ============================================================================

interface HeaderProps {
  report: CohesionReport;
  assessment: Assessment;
  isGenerating: boolean;
  editVersion: number;
  isValidationStale: boolean;
  hasIssues: boolean;
  onAccept: () => void;
  onRegenerate: () => void;
  onCorrectSuggestions?: () => void;
  onRevalidate?: () => void;
}

function CohesionHeader({
  report, assessment, isGenerating, editVersion, isValidationStale,
  hasIssues, onAccept, onRegenerate, onCorrectSuggestions, onRevalidate,
}: HeaderProps) {
  const statusStyle = STATUS_STYLES[assessment.status];
  const disabledClass = (condition: boolean) => condition ? "crv-btn-disabled" : "";

  return (
    <>
      <div className="crv-header">
        <div className="crv-header-left">
          <ScoreGauge score={report.overallScore} />
          <div>
            <div className={`crv-status-badge crv-status-badge-${assessment.status}`}>
              {statusStyle.label}
            </div>
            <div className="crv-issue-count">
              {assessment.criticalIssueCount} critical issues{" \u2022 "}
              {assessment.minorIssueCount} minor issues
            </div>
            <div className="crv-edit-version">Edit version: {editVersion}</div>
            {assessment.failedChecks.length > 0 && (
              <div className="crv-missed-checks">
                Failed: {assessment.failedChecks.join(", ")}
              </div>
            )}
          </div>
        </div>

        <div className="crv-actions">
          {onCorrectSuggestions && (
            <button
              onClick={onCorrectSuggestions}
              disabled={isGenerating || !hasIssues}
              className={`crv-btn crv-btn-secondary ${disabledClass(isGenerating || !hasIssues)}`}
              title={!hasIssues ? "No issues to correct" : "Apply remediation suggestions"}
            >
              \u270E Correct Suggestions
            </button>
          )}
          <button
            onClick={onRegenerate} disabled={isGenerating}
            className={`crv-btn crv-btn-secondary ${disabledClass(isGenerating)}`}
          >
            \u27F3 Regenerate All
          </button>
          <button
            onClick={onAccept} disabled={isGenerating}
            className={`crv-btn crv-btn-primary ${report.overallScore >= 60 ? "crv-btn-accept-ready" : "crv-btn-accept-warning"} ${disabledClass(isGenerating)}`}
          >
            {report.overallScore >= 60 ? "Accept Chronicle \u2713" : "Accept with Issues \u26A0"}
          </button>
        </div>
      </div>

      {isValidationStale && (
        <div className="crv-stale-warning">
          <div className="crv-stale-text">
            Validation is stale after edits. Revalidate to refresh the report.
          </div>
          {onRevalidate && (
            <button
              onClick={onRevalidate} disabled={isGenerating}
              className={`crv-btn crv-btn-small ${disabledClass(isGenerating)}`}
            >
              Revalidate
            </button>
          )}
        </div>
      )}
    </>
  );
}

// ============================================================================
// Tab: Summary
// ============================================================================

function SummaryTabContent({ report }: { report: CohesionReport }) {
  return (
    <div className="crv-panel">
      <h3 className="crv-panel-title">Validation Summary</h3>
      <div className="crv-summary-grid">
        {([
          ["plotStructure", "Structure"],
          ["entityConsistency", "Entity Consistency"],
          ["resolution", "Resolution"],
        ] as const).map(([key, label]) => (
          <div key={key} className="crv-summary-card">
            <div className={report.checks[key].pass ? "crv-summary-card-icon crv-summary-card-icon-pass" : "crv-summary-card-icon crv-summary-card-icon-fail"}>
              {report.checks[key].pass ? "\u2713" : "\u2715"}
            </div>
            <div className="crv-summary-card-label">{label}</div>
          </div>
        ))}
      </div>

      {report.checks.plotStructure.notes && (
        <div className="viewer-section crv-notes-section">
          <div className="crv-notes-label">Structure Notes:</div>
          <div className="crv-notes-text">{report.checks.plotStructure.notes}</div>
        </div>
      )}

      {report.checks.themeExpression.notes && (
        <div>
          <div className="crv-notes-label">Theme Expression:</div>
          <div className="crv-notes-text">{report.checks.themeExpression.notes}</div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Tab: Checks
// ============================================================================

function ChecksTabContent({ report }: { report: CohesionReport }) {
  return (
    <div className="ilu-container crv-checks-panel">
      <CheckItem label="Structure" check={report.checks.plotStructure} />
      <CheckItem label="Entity Consistency" check={report.checks.entityConsistency} />
      <CheckItem label="Resolution" check={report.checks.resolution} />
      <CheckItem label="Factual Accuracy" check={report.checks.factualAccuracy} />
      <CheckItem label="Theme Expression" check={report.checks.themeExpression} />
      <div className="crv-section-goals-header">
        Section Goals ({report.checks.sectionGoals.filter(sg => sg.pass).length}/
        {report.checks.sectionGoals.length} passed)
      </div>
      {report.checks.sectionGoals.map((sg) => (
        <div key={sg.sectionId} className="crv-section-goal-row">
          <div className="crv-section-goal-check">
            <CheckItem label={sg.sectionId} check={sg} isSection />
          </div>
          {!sg.pass && <span className="crv-section-goal-label">Needs revision</span>}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Tab: Issues
// ============================================================================

function IssuesTabContent({ report, assessment }: { report: CohesionReport; assessment: Assessment }) {
  const criticalIssues = useMemo(
    () => report.issues.filter(i => i.severity === "critical"),
    [report.issues],
  );
  const minorIssues = useMemo(
    () => report.issues.filter(i => i.severity === "minor"),
    [report.issues],
  );

  if (report.issues.length === 0) {
    return (
      <div>
        <div className="crv-no-issues">
          <div className="crv-no-issues-icon">&#127881;</div>
          <div className="crv-no-issues-text">No issues found!</div>
        </div>
      </div>
    );
  }
  return (
    <div>
      {criticalIssues.length > 0 && (
        <div className="crv-issues-group">
          <h4 className="crv-issues-heading crv-issues-heading-critical">
            Critical Issues ({criticalIssues.length})
          </h4>
          {criticalIssues.map((issue, idx) => (
            <IssueCard key={idx} issue={issue} sectionTitle={issue.sectionId || undefined} />
          ))}
        </div>
      )}
      {minorIssues.length > 0 && (
        <div>
          <h4 className="crv-issues-heading crv-issues-heading-minor">
            Minor Issues ({minorIssues.length})
          </h4>
          {minorIssues.map((issue, idx) => (
            <IssueCard key={idx} issue={issue} sectionTitle={issue.sectionId || undefined} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function CohesionReportViewer({
  report,
  seedData,
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
  summaryIndicator,
  imageRefsIndicator,
  imageConfig,
}: CohesionReportViewerProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "checks" | "issues">("summary");

  const handleTabClick = useCallback((tab: "summary" | "checks" | "issues") => {
    setActiveTab(tab);
  }, []);

  // Calculate assessment
  const assessment = useMemo((): Assessment | null => {
    if (!report) return null;
    const failedChecks: string[] = [];
    if (!report.checks.plotStructure.pass) failedChecks.push("Structure");
    if (!report.checks.entityConsistency.pass) failedChecks.push("Entity Consistency");
    if (!report.checks.resolution.pass) failedChecks.push("Resolution");
    if (!report.checks.factualAccuracy.pass) failedChecks.push("Factual Accuracy");
    if (!report.checks.themeExpression.pass) failedChecks.push("Theme Expression");
    const failedSectionGoals = report.checks.sectionGoals.filter(sg => !sg.pass);
    let status: AssessmentStatus;
    if (report.overallScore >= 90) status = "excellent";
    else if (report.overallScore >= 75) status = "good";
    else if (report.overallScore >= 60) status = "acceptable";
    else status = "needs_revision";
    return {
      status,
      criticalIssueCount: report.issues.filter(i => i.severity === "critical").length,
      minorIssueCount: report.issues.filter(i => i.severity === "minor").length,
      failedChecks,
      failedSectionGoals,
    };
  }, [report]);

  if (!report || !assessment) {
    return <div className="crv-empty">No validation report available.</div>;
  }

  const summaryState = refinements?.summary || {};
  const imageRefsState = refinements?.imageRefs || {};
  const hasIssues = report.issues.length > 0;

  const tabs: Array<"summary" | "checks" | "issues"> = ["summary", "checks", "issues"];

  return (
    <div className="crv">
      <CohesionHeader
        report={report}
        assessment={assessment}
        isGenerating={isGenerating}
        editVersion={editVersion}
        isValidationStale={isValidationStale}
        hasIssues={hasIssues}
        onAccept={onAccept}
        onRegenerate={onRegenerate}
        onCorrectSuggestions={onCorrectSuggestions}
        onRevalidate={onRevalidate}
      />

      <div className="viewer-section crv-refinements">
        <div className="crv-refinements-title">Optional Refinements</div>
        <div className="crv-refinements-list">
          <RefinementRow
            name="Add Summary"
            desc="Generate a short summary for chronicle listings."
            state={summaryState}
            indicator={summaryIndicator}
            isGenerating={isGenerating}
            onGenerate={onGenerateSummary}
          />
          <RefinementRow
            name="Add Image Refs"
            desc="Generate image placement suggestions for this chronicle."
            state={imageRefsState}
            indicator={imageRefsIndicator}
            isGenerating={isGenerating}
            onGenerate={onGenerateImageRefs}
          />

          {imageConfig?.imageRefs && imageConfig.entityMap && (
            <div className="crv-image-panel-wrap">
              <ChronicleImagePanel
                imageRefs={imageConfig.imageRefs}
                entities={imageConfig.entityMap as Map<string, never>}
                onGenerateImage={imageConfig.onGenerateChronicleImage as never}
                onResetImage={imageConfig.onResetChronicleImage as never}
                onUpdateAnchorText={imageConfig.onUpdateChronicleAnchorText as never}
                onUpdateSize={imageConfig.onUpdateChronicleImageSize as never}
                onUpdateJustification={imageConfig.onUpdateChronicleImageJustification as never}
                chronicleText={imageConfig.chronicleText || undefined}
                isGenerating={isGenerating}
                styleLibrary={imageConfig.styleLibrary}
                cultures={imageConfig.cultures}
                cultureIdentities={imageConfig.cultureIdentities}
                worldContext={imageConfig.worldContext}
                chronicleTitle={imageConfig.chronicleTitle}
              />
            </div>
          )}
        </div>
      </div>

      {seedData && <ExpandableSeedSection seed={seedData} defaultExpanded={false} />}

      <div className="crv-tabs">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => handleTabClick(tab)}
            className={`crv-tab ${activeTab === tab ? "crv-tab-active" : ""}`}
          >
            {tab}
            {tab === "issues" && report.issues.length > 0 && (
              <span className={`crv-tab-badge ${assessment.criticalIssueCount > 0 ? "crv-tab-badge-critical" : "crv-tab-badge-minor"}`}>
                {report.issues.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "summary" && <SummaryTabContent report={report} />}
      {activeTab === "checks" && <ChecksTabContent report={report} />}
      {activeTab === "issues" && <IssuesTabContent report={report} assessment={assessment} />}
    </div>
  );
}
