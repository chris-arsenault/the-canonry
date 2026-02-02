/**
 * TemplateUsage - Shows template usage stats and system health
 */

import React, { useState } from 'react';

function FilterStepsList({ filterSteps }) {
  return (
    <ul className="lw-filter-steps">
      {filterSteps.map((step, idx) => {
        const isBlocked = step.remaining === 0 && idx > 0;
        const prevRemaining = idx > 0 ? filterSteps[idx - 1].remaining : step.remaining;
        const eliminated = prevRemaining - step.remaining;
        return (
          <li key={idx} className={isBlocked ? 'lw-blocked-step' : ''}>
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

function SelectionBreakdown({ diagnosis }) {
  if (!diagnosis || !diagnosis.filterSteps) return null;

  return (
    <div className="lw-selection-breakdown">
      <div className="lw-selection-header">
        selection: {diagnosis.strategy} '{diagnosis.targetKind}'
      </div>
      <FilterStepsList filterSteps={diagnosis.filterSteps} />
    </div>
  );
}

function VariableBreakdown({ diagnoses }) {
  if (!diagnoses || diagnoses.length === 0) return null;

  return (
    <div className="lw-variable-breakdown">
      {diagnoses.map((diag, idx) => (
        <div key={idx} className="lw-variable-diagnosis">
          <div className="lw-variable-header">
            <span className="lw-variable-icon">📊</span>
            <span className="lw-variable-name">${diag.name}</span>
            {diag.fromType === 'related' ? (
              <span className="lw-variable-source">
                via {diag.relationshipKind} from {diag.relatedTo}
              </span>
            ) : diag.kind ? (
              <span className="lw-variable-source">
                from {diag.kind}
              </span>
            ) : null}
          </div>
          <FilterStepsList filterSteps={diag.filterSteps} />
        </div>
      ))}
    </div>
  );
}

function UnusedTemplateItem({ template }) {
  const [expanded, setExpanded] = useState(false);
  const hasFailedRules = template.failedRules && template.failedRules.length > 0;
  const hasSelectionDiagnosis = template.selectionDiagnosis && template.selectionDiagnosis.filterSteps?.length > 0;
  const hasVariableDiagnoses = template.variableDiagnoses && template.variableDiagnoses.length > 0;
  const icon = hasFailedRules ? '🚫' : '🎯';

  return (
    <div className="lw-unused-template">
      <div
        className="lw-unused-template-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="lw-unused-icon">{icon}</span>
        <span className="lw-unused-name">{template.templateId}</span>
        <span className="lw-unused-summary">{template.summary}</span>
        <span className="lw-unused-expand">{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className="lw-unused-details">
          {hasFailedRules ? (
            <ul className="lw-failed-rules">
              {template.failedRules.map((rule, idx) => (
                <li key={idx}>{rule}</li>
              ))}
            </ul>
          ) : hasSelectionDiagnosis ? (
            <SelectionBreakdown diagnosis={template.selectionDiagnosis} />
          ) : hasVariableDiagnoses ? (
            <>
              <div className="lw-targets-found">
                Found {template.selectionCount} valid target{template.selectionCount !== 1 ? 's' : ''}
              </div>
              <VariableBreakdown diagnoses={template.variableDiagnoses} />
            </>
          ) : (
            <div className="lw-no-targets">
              Found {template.selectionCount} valid targets
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TemplateUsage({ templateUsage, systemHealth }) {
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
          <div className="lw-empty-state">
            <span className="lw-empty-icon">⚙️</span>
            <span>Template stats will appear here</span>
          </div>
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...templateUsage.usage.map(t => t.count), 1);
  const unusedCount = templateUsage.unusedTemplates?.length || 0;

  return (
    <div className="lw-panel">
      <div className="lw-panel-header">
        <div className="lw-panel-title">
          <span>🔧</span>
          Template Usage
        </div>
        <span style={{ fontSize: '12px', color: 'var(--lw-text-muted)' }}>
          {templateUsage.uniqueTemplatesUsed}/{templateUsage.totalTemplates} used
        </span>
      </div>
      <div className="lw-panel-content">
        {/* System health indicator */}
        {systemHealth && (
          <div className="lw-health-indicator" style={{ marginBottom: '12px' }}>
            <div
              className={`lw-health-dot ${systemHealth.status}`}
              style={{
                backgroundColor: systemHealth.status === 'stable' ? 'var(--lw-success)' :
                                systemHealth.status === 'functional' ? 'var(--lw-warning)' : 'var(--lw-danger)'
              }}
            />
            <span className="lw-health-text">
              System Health: {(systemHealth.populationHealth * 100).toFixed(0)}%
            </span>
            <span style={{ fontSize: '12px', color: 'var(--lw-text-muted)', marginLeft: 'auto' }}>
              {systemHealth.status}
            </span>
          </div>
        )}

        {/* Top templates */}
        <div className="lw-template-list">
          {templateUsage.usage.slice(0, 8).map(template => {
            const fillColor = template.status === 'saturated' ? 'var(--lw-danger)' :
                             template.status === 'warning' ? 'var(--lw-warning)' : 'var(--lw-accent)';
            return (
              <div key={template.templateId} className="lw-template-item">
                <span className="lw-template-name" title={template.templateId}>
                  {template.templateId}
                </span>
                <div className="lw-template-bar">
                  <div
                    className="lw-template-fill"
                    style={{
                      width: `${(template.count / maxCount) * 100}%`,
                      backgroundColor: fillColor
                    }}
                  />
                </div>
                <span className="lw-template-count">{template.count}×</span>
              </div>
            );
          })}
        </div>

        {/* Unused templates section */}
        {unusedCount > 0 && (
          <div className="lw-unused-section">
            <div
              className="lw-unused-header"
              onClick={() => setShowUnused(!showUnused)}
            >
              <span className="lw-unused-toggle">{showUnused ? '▼' : '▶'}</span>
              <span className="lw-unused-title">Unused Templates ({unusedCount})</span>
            </div>
            {showUnused && (
              <div className="lw-unused-list">
                {templateUsage.unusedTemplates.map(template => (
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
