/**
 * TemplateUsage - Shows template usage stats and system health
 */

import React, { useState } from "react";
import "./TemplateUsage.css";

interface FilterStep {
  description: string;
  remaining: number;
}

interface SelectionDiagnosis {
  strategy: string;
  targetKind: string;
  filterSteps: FilterStep[];
}

interface VariableDiagnosis {
  name: string;
  fromType: string;
  relationshipKind: string;
  relatedTo: string;
  kind: string;
  filterSteps: FilterStep[];
}

interface UnusedTemplate {
  templateId: string;
  summary: string;
  failedRules: string[];
  selectionCount: number;
  selectionDiagnosis: SelectionDiagnosis | null;
  variableDiagnoses: VariableDiagnosis[];
}

interface TemplateUsageStat {
  templateId: string;
  count: number;
  percentage: number;
  status: string;
}

interface TemplateUsageData {
  totalApplications: number;
  uniqueTemplatesUsed: number;
  totalTemplates: number;
  usage: TemplateUsageStat[];
  unusedTemplates: UnusedTemplate[];
}

interface SystemHealthData {
  status: string;
  populationHealth: number;
}

function FilterStepsList({ filterSteps }: Readonly<{ filterSteps: FilterStep[] }>) {
  return (
    <ul className="lw-filter-steps">
      {filterSteps.map((step, idx) => {
        const isBlocked = step.remaining === 0 && idx > 0;
        const prev: FilterStep | undefined = idx > 0 ? filterSteps[idx - 1] : undefined;
        const eliminated = prev ? prev.remaining - step.remaining : 0;
        return (
          <li key={idx} className={isBlocked ? "lw-blocked-step" : ""}>
            <span className="lw-step-desc">{step.description}</span>
            <span className="lw-step-count">
              {step.remaining}
              {eliminated > 0 && <span className="lw-eliminated"> (-{eliminated})</span>}
              {isBlocked && <span className="lw-blocked-marker"> ← blocked</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function SelectionBreakdown({ diagnosis }: Readonly<{ diagnosis: SelectionDiagnosis | null }>) {
  if (!diagnosis?.filterSteps) return null;

  return (
    <div className="lw-selection-breakdown">
      <div className="lw-selection-header">
        selection: {diagnosis.strategy} &apos;{diagnosis.targetKind}&apos;
      </div>
      <FilterStepsList filterSteps={diagnosis.filterSteps} />
    </div>
  );
}

function VariableBreakdown({ diagnoses }: Readonly<{ diagnoses: VariableDiagnosis[] }>) {
  if (diagnoses.length === 0) return null;

  return (
    <div className="lw-variable-breakdown">
      {diagnoses.map((diag, idx) => (
        <div key={idx} className="lw-variable-diagnosis">
          <div className="lw-variable-header">
            <span className="lw-variable-icon">📊</span>
            <span className="lw-variable-name">${diag.name}</span>
            {diag.fromType === "related" && (
              <span className="lw-variable-source">
                via {diag.relationshipKind} from {diag.relatedTo}
              </span>
            )}
            {diag.fromType !== "related" && diag.kind && (
              <span className="lw-variable-source">from {diag.kind}</span>
            )}
          </div>
          <FilterStepsList filterSteps={diag.filterSteps} />
        </div>
      ))}
    </div>
  );
}

function UnusedTemplateDetails({ template }: Readonly<{ template: UnusedTemplate }>) {
  if (template.failedRules.length > 0) {
    return <ul className="lw-failed-rules">{template.failedRules.map((rule, idx) => <li key={idx}>{rule}</li>)}</ul>;
  }
  if (template.selectionDiagnosis && template.selectionDiagnosis.filterSteps.length > 0) {
    return <SelectionBreakdown diagnosis={template.selectionDiagnosis} />;
  }
  if (template.variableDiagnoses.length > 0) {
    return (
      <>
        <div className="lw-targets-found">Found {template.selectionCount} valid target{template.selectionCount !== 1 ? "s" : ""}</div>
        <VariableBreakdown diagnoses={template.variableDiagnoses} />
      </>
    );
  }
  return <div className="lw-no-targets">Found {template.selectionCount} valid targets</div>;
}

function UnusedTemplateItem({ template }: Readonly<{ template: UnusedTemplate }>) {
  const [expanded, setExpanded] = useState(false);
  const icon = template.failedRules.length > 0 ? "🚫" : "🎯";

  return (
    <div className="lw-unused-template">
      <div className="lw-unused-template-header" onClick={() => setExpanded(!expanded)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }} >
        <span className="lw-unused-icon">{icon}</span>
        <span className="lw-unused-name">{template.templateId}</span>
        <span className="lw-unused-summary">{template.summary}</span>
        <span className="lw-unused-expand">{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && <div className="lw-unused-details"><UnusedTemplateDetails template={template} /></div>}
    </div>
  );
}

interface TemplateUsageProps {
  templateUsage: TemplateUsageData | null;
  systemHealth: SystemHealthData | null;
}

export default function TemplateUsage({ templateUsage, systemHealth }: Readonly<TemplateUsageProps>) {
  const [showUnused, setShowUnused] = useState(false);

  if (!templateUsage) {
    return (
      <div className="lw-panel">
        <div className="lw-panel-header">
          <div className="lw-panel-title">
            <span>🔧</span>
            Template Usage
          </div>
        </div>
        <div className="lw-panel-content">
          <div className="viewer-empty-state">
            <span className="lw-empty-icon">⚙️</span>
            <span>Template stats will appear here</span>
          </div>
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...templateUsage.usage.map((t) => t.count), 1);
  const unusedCount = templateUsage.unusedTemplates.length;

  return (
    <div className="lw-panel">
      <div className="lw-panel-header">
        <div className="lw-panel-title">
          <span>🔧</span>
          Template Usage
        </div>
        <span className="tu-used-label">
          {templateUsage.uniqueTemplatesUsed}/{templateUsage.totalTemplates} used
        </span>
      </div>
      <div className="lw-panel-content">
        {/* System health indicator */}
        {systemHealth && (
          <div className="lw-health-indicator tu-health-indicator">
            <div
              className={`lw-health-dot ${systemHealth.status} tu-health-dot`}
              style={{
                '--tu-health-dot-bg': (() => {
                  if (systemHealth.status === "stable") return "var(--lw-success)";
                  if (systemHealth.status === "functional") return "var(--lw-warning)";
                  return "var(--lw-danger)";
                })(),
              } as React.CSSProperties}
            />
            <span className="lw-health-text">
              System Health: {(systemHealth.populationHealth * 100).toFixed(0)}%
            </span>
            <span className="tu-health-status">
              {systemHealth.status}
            </span>
          </div>
        )}

        {/* Top templates */}
        <div className="lw-template-list">
          {templateUsage.usage.slice(0, 8).map((template) => {
            let fillColor;
            if (template.status === "saturated") fillColor = "var(--lw-danger)";
            else if (template.status === "warning") fillColor = "var(--lw-warning)";
            else fillColor = "var(--lw-accent)";
            return (
              <div key={template.templateId} className="lw-template-item">
                <span className="lw-template-name" title={template.templateId}>
                  {template.templateId}
                </span>
                <div className="lw-template-bar">
                  <div
                    className="lw-template-fill tu-template-fill"
                    style={{
                      '--tu-template-fill-width': `${String((template.count / maxCount) * 100)}%`,
                      '--tu-template-fill-color': fillColor as string,
                    } as React.CSSProperties}
                  />
                </div>
                <span className="lw-template-count">{template.count}×</span>
              </div>
            );
          })}
        </div>

        {/* Unused templates section */}
        {unusedCount > 0 && (
          <div className="viewer-section">
            <div className="lw-unused-header" onClick={() => setShowUnused(!showUnused)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }} >
              <span className="lw-unused-toggle">{showUnused ? "▼" : "▶"}</span>
              <span className="lw-unused-title">Unused Templates ({unusedCount})</span>
            </div>
            {showUnused && (
              <div className="lw-unused-list">
                {templateUsage.unusedTemplates.map((template) => (
                  <UnusedTemplateItem key={template.templateId} template={template} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
