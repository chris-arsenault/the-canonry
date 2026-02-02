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

import { useState, useMemo } from 'react';
import ChronicleImagePanel from './ChronicleImagePanel';
import { ExpandableSeedSection } from './ChronicleSeedViewer';

const STATUS_STYLES = {
  excellent: { bg: '#10b98120', color: '#10b981', label: 'Excellent' },
  good: { bg: '#3b82f620', color: '#3b82f6', label: 'Good' },
  acceptable: { bg: '#f59e0b20', color: '#f59e0b', label: 'Acceptable' },
  needs_revision: { bg: '#ef444420', color: '#ef4444', label: 'Needs Revision' },
};

function ScoreGauge({ score }) {
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getColor = () => {
    if (score >= 90) return '#10b981';
    if (score >= 75) return '#3b82f6';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div style={{ position: 'relative', width: '120px', height: '120px' }}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        {/* Background circle */}
        <circle
          cx="60"
          cy="60"
          r="45"
          fill="none"
          stroke="var(--bg-tertiary)"
          strokeWidth="10"
        />
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
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '28px', fontWeight: 700, color: getColor() }}>
          {score}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>/ 100</div>
      </div>
    </div>
  );
}

function CheckItem({ label, check, isSection = false }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        padding: '12px',
        background: check.pass ? 'transparent' : 'rgba(239, 68, 68, 0.05)',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: check.notes ? 'pointer' : 'default',
        }}
        onClick={() => check.notes && setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              background: check.pass ? '#10b98120' : '#ef444420',
              color: check.pass ? '#10b981' : '#ef4444',
            }}
          >
            {check.pass ? '✓' : '✕'}
          </span>
          <span style={{ fontSize: '13px', fontWeight: isSection ? 400 : 500 }}>
            {label}
          </span>
        </div>
        {check.notes && (
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {expanded ? '▾' : '▸'}
          </span>
        )}
      </div>
      {expanded && check.notes && (
        <div
          style={{
            marginTop: '8px',
            marginLeft: '30px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
        >
          {check.notes}
        </div>
      )}
    </div>
  );
}

function IssueCard({ issue, sectionTitle }) {
  const isCritical = issue.severity === 'critical';

  return (
    <div
      style={{
        padding: '12px 16px',
        background: isCritical ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-primary)',
        border: `1px solid ${isCritical ? '#ef444440' : 'var(--border-color)'}`,
        borderRadius: '6px',
        marginBottom: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span
          style={{
            padding: '3px 8px',
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            borderRadius: '4px',
            background: isCritical ? '#ef4444' : '#f59e0b',
            color: 'white',
          }}
        >
          {issue.severity}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {issue.checkType}
          {sectionTitle && ` • ${sectionTitle}`}
        </span>
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '8px' }}>
        {issue.description}
      </div>
      {issue.suggestion && (
        <div
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            padding: '8px 12px',
            background: 'var(--bg-secondary)',
            borderRadius: '4px',
            borderLeft: '3px solid var(--accent-primary)',
          }}
        >
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
  const [activeTab, setActiveTab] = useState('summary');

  // Calculate assessment
  const assessment = useMemo(() => {
    if (!report) return null;

    const criticalIssues = report.issues.filter((i) => i.severity === 'critical');
    const minorIssues = report.issues.filter((i) => i.severity === 'minor');

    const failedChecks = [];
    if (!report.checks.plotStructure.pass) failedChecks.push('Structure');
    if (!report.checks.entityConsistency.pass) failedChecks.push('Entity Consistency');
    if (!report.checks.resolution.pass) failedChecks.push('Resolution');
    if (!report.checks.factualAccuracy.pass) failedChecks.push('Factual Accuracy');
    if (!report.checks.themeExpression.pass) failedChecks.push('Theme Expression');

    const failedSectionGoals = report.checks.sectionGoals.filter((sg) => !sg.pass);

    let status;
    if (report.overallScore >= 90) status = 'excellent';
    else if (report.overallScore >= 75) status = 'good';
    else if (report.overallScore >= 60) status = 'acceptable';
    else status = 'needs_revision';

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
      <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
        No validation report available.
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[assessment?.status || 'needs_revision'];

  const sectionIdToName = new Map();
  const resolveSectionLabel = (sectionId) => sectionIdToName.get(sectionId) || sectionId;
  const hasIssues = report.issues.length > 0;
  const formatTimestamp = (timestamp) => new Date(timestamp).toLocaleString();
  const summaryState = refinements?.summary || {};
  const imageRefsState = refinements?.imageRefs || {};

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Header with score and actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          padding: '24px',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <ScoreGauge score={report.overallScore} />
          <div>
            <div
              style={{
                display: 'inline-block',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                background: statusStyle.bg,
                color: statusStyle.color,
                marginBottom: '8px',
              }}
            >
              {statusStyle.label}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {assessment?.criticalIssueCount || 0} critical issues •{' '}
              {assessment?.minorIssueCount || 0} minor issues
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Edit version: {editVersion}
            </div>
            {assessment?.failedChecks.length > 0 && (
              <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>
                Failed: {assessment.failedChecks.join(', ')}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          {onCorrectSuggestions && (
            <button
              onClick={onCorrectSuggestions}
              disabled={isGenerating || !hasIssues}
              style={{
                padding: '10px 20px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                cursor: isGenerating || !hasIssues ? 'not-allowed' : 'pointer',
                opacity: isGenerating || !hasIssues ? 0.6 : 1,
                fontSize: '13px',
              }}
              title={!hasIssues ? 'No issues to correct' : 'Apply remediation suggestions'}
            >
              ✎ Correct Suggestions
            </button>
          )}
          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            style={{
              padding: '10px 20px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              opacity: isGenerating ? 0.6 : 1,
              fontSize: '13px',
            }}
          >
            ⟳ Regenerate All
          </button>
          <button
            onClick={onAccept}
            disabled={isGenerating}
            style={{
              padding: '10px 20px',
              background: report.overallScore >= 60 ? 'var(--accent-primary)' : '#f59e0b',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              opacity: isGenerating ? 0.6 : 1,
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {report.overallScore >= 60 ? 'Accept Chronicle ✓' : 'Accept with Issues ⚠'}
          </button>
        </div>
      </div>

      {isValidationStale && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '6px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Validation is stale after edits. Revalidate to refresh the report.
          </div>
          {onRevalidate && (
            <button
              onClick={onRevalidate}
              disabled={isGenerating}
              style={{
                padding: '8px 14px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                opacity: isGenerating ? 0.6 : 1,
                fontSize: '12px',
              }}
            >
              Revalidate
            </button>
          )}
        </div>
      )}

      <div
        style={{
          marginBottom: '24px',
          padding: '16px',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
          Optional Refinements
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Summary */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>Add Summary</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Generate a short summary for chronicle listings.
              </div>
              {summaryState.generatedAt && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Done - {formatTimestamp(summaryState.generatedAt)}
                  {summaryState.model ? ` - ${summaryState.model}` : ''}
                </div>
              )}
              {summaryIndicator && summaryState.generatedAt && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {summaryIndicator}
                </div>
              )}
              {!summaryState.generatedAt && !summaryState.running && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Not run yet
                </div>
              )}
              {summaryState.running && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Running...
                </div>
              )}
            </div>
            {onGenerateSummary && (
              <button
                onClick={onGenerateSummary}
                disabled={isGenerating || summaryState.running}
                style={{
                  padding: '8px 14px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-secondary)',
                  cursor: isGenerating || summaryState.running ? 'not-allowed' : 'pointer',
                  opacity: isGenerating || summaryState.running ? 0.6 : 1,
                  fontSize: '12px',
                  height: '32px',
                  alignSelf: 'center',
                }}
              >
                {summaryState.generatedAt ? 'Regenerate' : 'Generate'}
              </button>
            )}
          </div>

          {/* 3. Image Refs - finds image placement opportunities in the narrative */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>Add Image Refs</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Generate image placement suggestions for this chronicle.
              </div>
              {imageRefsState.generatedAt && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Done - {formatTimestamp(imageRefsState.generatedAt)}
                  {imageRefsState.model ? ` - ${imageRefsState.model}` : ''}
                </div>
              )}
              {imageRefsIndicator && imageRefsState.generatedAt && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {imageRefsIndicator}
                </div>
              )}
              {!imageRefsState.generatedAt && !imageRefsState.running && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Not run yet
                </div>
              )}
              {imageRefsState.running && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Running...
                </div>
              )}
            </div>
            {onGenerateImageRefs && (
              <button
                onClick={onGenerateImageRefs}
                disabled={isGenerating || imageRefsState.running}
                style={{
                  padding: '8px 14px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-secondary)',
                  cursor: isGenerating || imageRefsState.running ? 'not-allowed' : 'pointer',
                  opacity: isGenerating || imageRefsState.running ? 0.6 : 1,
                  fontSize: '12px',
                  height: '32px',
                  alignSelf: 'center',
                }}
              >
                {imageRefsState.generatedAt ? 'Regenerate' : 'Generate'}
              </button>
            )}
          </div>

          {/* Show ChronicleImagePanel when imageRefs are available */}
          {imageRefs && entityMap && (
            <div style={{ marginTop: '4px' }}>
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
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '16px',
        }}
      >
        {['summary', 'checks', 'issues'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === tab ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: activeTab === tab ? 600 : 400,
              textTransform: 'capitalize',
            }}
          >
            {tab}
            {tab === 'issues' && report.issues.length > 0 && (
              <span
                style={{
                  marginLeft: '8px',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  fontSize: '10px',
                  background: assessment?.criticalIssueCount > 0 ? '#ef4444' : '#f59e0b',
                  color: 'white',
                }}
              >
                {report.issues.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'summary' && (
        <div
          style={{
            padding: '24px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}
        >
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Validation Summary</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <div
              style={{
                padding: '16px',
                background: 'var(--bg-primary)',
                borderRadius: '6px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '24px', fontWeight: 700, color: report.checks.plotStructure.pass ? '#10b981' : '#ef4444' }}>
                {report.checks.plotStructure.pass ? '✓' : '✕'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Structure</div>
            </div>
            <div
              style={{
                padding: '16px',
                background: 'var(--bg-primary)',
                borderRadius: '6px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '24px', fontWeight: 700, color: report.checks.entityConsistency.pass ? '#10b981' : '#ef4444' }}>
                {report.checks.entityConsistency.pass ? '✓' : '✕'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Entity Consistency</div>
            </div>
            <div
              style={{
                padding: '16px',
                background: 'var(--bg-primary)',
                borderRadius: '6px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '24px', fontWeight: 700, color: report.checks.resolution.pass ? '#10b981' : '#ef4444' }}>
                {report.checks.resolution.pass ? '✓' : '✕'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Resolution</div>
            </div>
          </div>

          {report.checks.plotStructure.notes && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Structure Notes:</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {report.checks.plotStructure.notes}
              </div>
            </div>
          )}

          {report.checks.themeExpression.notes && (
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Theme Expression:</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {report.checks.themeExpression.notes}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'checks' && (
        <div
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
          }}
        >
          <CheckItem label="Structure" check={report.checks.plotStructure} />
          <CheckItem label="Entity Consistency" check={report.checks.entityConsistency} />
          <CheckItem label="Resolution" check={report.checks.resolution} />
          <CheckItem label="Factual Accuracy" check={report.checks.factualAccuracy} />
          <CheckItem label="Theme Expression" check={report.checks.themeExpression} />

          <div style={{ padding: '12px', background: 'var(--bg-tertiary)', fontWeight: 500, fontSize: '13px' }}>
            Section Goals ({report.checks.sectionGoals.filter((sg) => sg.pass).length}/{report.checks.sectionGoals.length} passed)
          </div>
          {report.checks.sectionGoals.map((sg) => (
            <div key={sg.sectionId} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <CheckItem
                  label={resolveSectionLabel(sg.sectionId)}
                  check={sg}
                  isSection
                />
              </div>
              {!sg.pass && (
                <span style={{ marginRight: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Needs revision
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'issues' && (
        <div>
          {report.issues.length === 0 ? (
            <div
              style={{
                padding: '48px',
                textAlign: 'center',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎉</div>
              <div style={{ color: 'var(--text-muted)' }}>No issues found!</div>
            </div>
          ) : (
            <>
              {/* Critical issues first */}
              {report.issues.filter((i) => i.severity === 'critical').length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#ef4444' }}>
                    Critical Issues ({report.issues.filter((i) => i.severity === 'critical').length})
                  </h4>
                  {report.issues
                    .filter((i) => i.severity === 'critical')
                    .map((issue, idx) => (
                      <IssueCard
                        key={idx}
                        issue={issue}
                        sectionTitle={issue.sectionId ? resolveSectionLabel(issue.sectionId) : undefined}
                      />
                    ))}
                </div>
              )}

              {/* Minor issues */}
              {report.issues.filter((i) => i.severity === 'minor').length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#f59e0b' }}>
                    Minor Issues ({report.issues.filter((i) => i.severity === 'minor').length})
                  </h4>
                  {report.issues
                    .filter((i) => i.severity === 'minor')
                    .map((issue, idx) => (
                      <IssueCard
                        key={idx}
                        issue={issue}
                        sectionTitle={issue.sectionId ? resolveSectionLabel(issue.sectionId) : undefined}
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
