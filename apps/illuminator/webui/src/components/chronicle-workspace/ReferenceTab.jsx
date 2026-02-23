import { useState, useMemo, useEffect, useRef } from 'react';
import { ExpandableSeedSection } from '../ChronicleSeedViewer';
import NarrativeTimeline from '../ChronicleWizard/visualizations/NarrativeTimeline';
import {
  getEraRanges,
  prepareTimelineEvents,
  prepareCastMarkers,
  getTimelineExtent,
} from '../../lib/chronicle/timelineUtils';

// ============================================================================
// Perspective Synthesis Viewer (local)
// ============================================================================

function PerspectiveSynthesisViewer({ synthesis }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('output');

  if (!synthesis) return null;

  const formatCost = (cost) => `$${cost.toFixed(4)}`;
  const formatTimestamp = (ts) => new Date(ts).toLocaleString();

  const hasInputData = synthesis.coreTone || synthesis.inputFacts || synthesis.inputCulturalIdentities || synthesis.constellation || synthesis.inputWorldDynamics || synthesis.narrativeStyleName;

  return (
    <div
      style={{
        marginBottom: '16px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          background: 'var(--bg-tertiary)',
          borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {isExpanded ? '\u25BC' : '\u25B6'}
        </span>
        <span style={{ fontSize: '13px', fontWeight: 500 }}>
          Perspective Synthesis
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {synthesis.facets?.length || 0} facets &bull; {synthesis.entityDirectives?.length || 0} directives &bull; {synthesis.suggestedMotifs?.length || 0} motifs &bull; {formatCost(synthesis.actualCost)}
        </span>
      </div>

      {isExpanded && (
        <div style={{ padding: '16px' }}>
          {hasInputData && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                onClick={() => setActiveTab('output')}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: activeTab === 'output' ? 600 : 400,
                  background: activeTab === 'output' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: activeTab === 'output' ? 'white' : 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                LLM Output
              </button>
              <button
                onClick={() => setActiveTab('input')}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: activeTab === 'input' ? 600 : 400,
                  background: activeTab === 'input' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: activeTab === 'input' ? 'white' : 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                LLM Input
              </button>
            </div>
          )}

          {activeTab === 'output' && (
            <>
              {/* Constellation Summary */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  CONSTELLATION SUMMARY
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {synthesis.constellationSummary}
                </div>
              </div>

              {/* Brief */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  PERSPECTIVE BRIEF
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    lineHeight: 1.6,
                    color: 'var(--text-primary)',
                    padding: '12px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: '6px',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {synthesis.brief}
                </div>
              </div>

              {/* Facets */}
              {synthesis.facets && synthesis.facets.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    FACETED FACTS ({synthesis.facets.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {synthesis.facets.map((facet, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '10px 12px',
                          background: 'var(--bg-tertiary)',
                          borderRadius: '6px',
                          borderLeft: '3px solid var(--accent-color)',
                        }}
                      >
                        <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--accent-color)', marginBottom: '4px' }}>
                          {facet.factId}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {facet.interpretation}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Narrative Voice */}
              {synthesis.narrativeVoice && Object.keys(synthesis.narrativeVoice).length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    NARRATIVE VOICE
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.entries(synthesis.narrativeVoice).map(([key, value]) => (
                      <div
                        key={key}
                        style={{
                          padding: '10px 12px',
                          background: 'var(--bg-tertiary)',
                          borderRadius: '6px',
                          borderLeft: '3px solid var(--accent-secondary, #8b5cf6)',
                        }}
                      >
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-secondary, #8b5cf6)', marginBottom: '4px', textTransform: 'uppercase' }}>
                          {key}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Entity Directives */}
              {synthesis.entityDirectives && synthesis.entityDirectives.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    ENTITY DIRECTIVES ({synthesis.entityDirectives.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {synthesis.entityDirectives.map((d, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '10px 12px',
                          background: 'var(--bg-tertiary)',
                          borderRadius: '6px',
                          borderLeft: '3px solid var(--accent-tertiary, #f59e0b)',
                        }}
                      >
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-tertiary, #f59e0b)', marginBottom: '4px' }}>
                          {d.entityName}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {d.directive}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Motifs */}
              {synthesis.suggestedMotifs && synthesis.suggestedMotifs.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    SUGGESTED MOTIFS
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {synthesis.suggestedMotifs.map((motif, i) => (
                      <span
                        key={i}
                        style={{
                          padding: '4px 10px',
                          background: 'var(--bg-tertiary)',
                          borderRadius: '12px',
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          fontStyle: 'italic',
                        }}
                      >
                        &ldquo;{motif}&rdquo;
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'input' && (
            <>
              {/* Narrative Style */}
              {synthesis.narrativeStyleName && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    NARRATIVE STYLE
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      padding: '10px 12px',
                      background: 'var(--bg-tertiary)',
                      borderRadius: '6px',
                      borderLeft: '3px solid var(--accent-secondary, #8b5cf6)',
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{synthesis.narrativeStyleName}</span>
                    {synthesis.narrativeStyleId && (
                      <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        ({synthesis.narrativeStyleId})
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Focal Era */}
              {synthesis.focalEra && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    FOCAL ERA
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      padding: '10px 12px',
                      background: 'var(--bg-tertiary)',
                      borderRadius: '6px',
                      borderLeft: '3px solid #10b981',
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{synthesis.focalEra.name}</span>
                    <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      ({synthesis.focalEra.id})
                    </span>
                    {synthesis.focalEra.description && (
                      <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {synthesis.focalEra.description}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Fact Selection Range */}
              {synthesis.factSelectionRange && (synthesis.factSelectionRange.min || synthesis.factSelectionRange.max) && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    FACT SELECTION RANGE
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {synthesis.factSelectionRange.min && synthesis.factSelectionRange.max
                      ? synthesis.factSelectionRange.min === synthesis.factSelectionRange.max
                        ? `Exactly ${synthesis.factSelectionRange.min} facts`
                        : `${synthesis.factSelectionRange.min}–${synthesis.factSelectionRange.max} facts`
                      : synthesis.factSelectionRange.min
                        ? `At least ${synthesis.factSelectionRange.min} facts`
                        : `Up to ${synthesis.factSelectionRange.max} facts`
                    }
                  </div>
                </div>
              )}

              {/* Core Tone */}
              {synthesis.coreTone && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    CORE TONE
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      lineHeight: 1.6,
                      color: 'var(--text-primary)',
                      padding: '12px',
                      background: 'var(--bg-tertiary)',
                      borderRadius: '6px',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {synthesis.coreTone}
                  </div>
                </div>
              )}

              {/* Constellation Analysis */}
              {synthesis.constellation && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    CONSTELLATION ANALYSIS
                  </div>
                  <div style={{ padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px', fontSize: '12px' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Cultures:</strong> {Object.entries(synthesis.constellation.cultures || {}).map(([k, v]) => `${k}(${v})`).join(', ') || 'none'}
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Entity Kinds:</strong> {Object.entries(synthesis.constellation.kinds || {}).map(([k, v]) => `${k}(${v})`).join(', ') || 'none'}
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Prominent Tags:</strong> {synthesis.constellation.prominentTags?.join(', ') || 'none'}
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Culture Balance:</strong> {synthesis.constellation.cultureBalance}
                      {synthesis.constellation.dominantCulture && ` (dominant: ${synthesis.constellation.dominantCulture})`}
                    </div>
                    <div>
                      <strong>Relationships:</strong> {
                        synthesis.constellation.relationshipKinds && Object.keys(synthesis.constellation.relationshipKinds).length > 0
                          ? Object.entries(synthesis.constellation.relationshipKinds).map(([k, v]) => `${k}(${v})`).join(', ')
                          : 'none'
                      }
                    </div>
                  </div>
                </div>
              )}

              {/* Input Entities */}
              {synthesis.inputEntities && synthesis.inputEntities.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    ENTITIES ({synthesis.inputEntities.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {synthesis.inputEntities.map((entity, i) => (
                      <div key={i} style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: '6px', fontSize: '12px' }}>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                          {entity.name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({entity.kind}{entity.culture ? `, ${entity.culture}` : ''})</span>
                        </div>
                        {entity.summary && (
                          <div style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '11px' }}>
                            {entity.summary}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Facts */}
              {synthesis.inputFacts && synthesis.inputFacts.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    INPUT FACTS ({synthesis.inputFacts.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {synthesis.inputFacts.map((fact, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '8px 12px',
                          background: 'var(--bg-tertiary)',
                          borderRadius: '6px',
                          fontSize: '12px',
                          borderLeft: `3px solid ${fact.type === 'generation_constraint' ? '#f59e0b' : 'var(--accent-color)'}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)' }}>
                            {fact.id}
                          </span>
                          {fact.type === 'generation_constraint' && (
                            <span style={{ padding: '2px 6px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontSize: '10px', borderRadius: '4px' }}>
                              constraint
                            </span>
                          )}
                        </div>
                        <div style={{ color: 'var(--text-secondary)' }}>
                          {fact.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cultural Identities */}
              {synthesis.inputCulturalIdentities && Object.keys(synthesis.inputCulturalIdentities).length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    CULTURAL IDENTITIES ({Object.keys(synthesis.inputCulturalIdentities).length} cultures)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.entries(synthesis.inputCulturalIdentities).map(([cultureId, traits]) => (
                      <div key={cultureId} style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                        <div style={{ fontWeight: 500, fontSize: '12px', marginBottom: '6px', color: 'var(--text-primary)' }}>
                          {cultureId}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {Object.entries(traits).map(([key, value]) => (
                            <div key={key}>
                              <span style={{ color: 'var(--text-muted)' }}>{key}:</span> {value}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* World Dynamics */}
              {synthesis.inputWorldDynamics && synthesis.inputWorldDynamics.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    WORLD DYNAMICS ({synthesis.inputWorldDynamics.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {synthesis.inputWorldDynamics.map((dynamic, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '8px 12px',
                          background: 'var(--bg-tertiary)',
                          borderRadius: '6px',
                          fontSize: '12px',
                          borderLeft: '3px solid #06b6d4',
                        }}
                      >
                        <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#06b6d4', marginBottom: '4px' }}>
                          {dynamic.id}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {dynamic.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Metadata */}
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '16px', flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '8px' }}>
            <span>Model: {synthesis.model}</span>
            <span>Tokens: {synthesis.inputTokens} in / {synthesis.outputTokens} out</span>
            <span>Generated: {formatTimestamp(synthesis.generatedAt)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Fact Coverage Viewer (local)
// ============================================================================

const RATING_ORDER = ['integral', 'prevalent', 'mentioned', 'missing'];
const RATING_STYLE = {
  integral: { symbol: '\u25C6', color: '#10b981', label: 'integral' },
  prevalent: { symbol: '\u25C7', color: '#3b82f6', label: 'prevalent' },
  mentioned: { symbol: '\u00B7', color: '#f59e0b', label: 'mentioned' },
  missing: { symbol: '\u25CB', color: 'var(--text-muted)', label: 'missing' },
};

function FactCoverageGrid({ report }) {
  if (!report?.entries?.length) return null;

  // Static order — 3 columns of 6
  const entries = report.entries;
  const cols = [entries.slice(0, 6), entries.slice(6, 12), entries.slice(12, 18)];

  return (
    <div
      style={{
        marginBottom: '16px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '12px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Canon Facts
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', gap: '10px' }}>
          {RATING_ORDER.map((r) => (
            <span key={r}><span style={{ color: RATING_STYLE[r].color, fontWeight: 600 }}>{RATING_STYLE[r].symbol}</span> {r}</span>
          ))}
          <span><span style={{ color: '#10b981' }}>yes</span>/<span style={{ color: 'var(--text-muted)' }}>no</span> = included</span>
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 16px' }}>
        {cols.map((col, ci) => (
          <div key={ci}>
            {col.map((entry) => {
              const rs = RATING_STYLE[entry.rating] || RATING_STYLE.missing;
              // Mismatch highlights
              const bg = entry.wasFaceted && entry.rating === 'missing' ? 'rgba(239, 68, 68, 0.12)'
                : entry.wasFaceted && entry.rating === 'mentioned' ? 'rgba(245, 158, 11, 0.12)'
                : !entry.wasFaceted && (entry.rating === 'integral' || entry.rating === 'prevalent') ? 'rgba(16, 185, 129, 0.12)'
                : undefined;
              return (
                <div
                  key={entry.factId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 4px',
                    fontSize: '11px',
                    borderBottom: '1px solid var(--border-color)',
                    background: bg,
                    borderRadius: bg ? '3px' : undefined,
                  }}
                  title={entry.factText}
                >
                  <span style={{ color: rs.color, fontWeight: 600, flexShrink: 0 }}>{rs.symbol}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.factId}
                  </span>
                  <span style={{
                    flexShrink: 0,
                    fontSize: '10px',
                    color: entry.wasFaceted ? '#10b981' : 'var(--text-muted)',
                  }}>
                    {entry.wasFaceted ? 'yes' : 'no'}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function FactCoverageViewer({ report, generatedAt }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!report?.entries?.length) return null;

  const counts = { integral: 0, prevalent: 0, mentioned: 0, missing: 0 };
  for (const e of report.entries) {
    if (counts[e.rating] !== undefined) counts[e.rating]++;
  }

  const sorted = [...report.entries].sort(
    (a, b) => RATING_ORDER.indexOf(a.rating) - RATING_ORDER.indexOf(b.rating),
  );

  return (
    <div
      style={{
        marginBottom: '16px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          background: 'var(--bg-tertiary)',
          borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {isExpanded ? '\u25BC' : '\u25B6'}
        </span>
        <span style={{ fontSize: '13px', fontWeight: 500 }}>
          Fact Coverage
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {RATING_ORDER.map((r) => (
            counts[r] > 0 ? `${RATING_STYLE[r].symbol} ${counts[r]} ${r}` : null
          )).filter(Boolean).join('  ')}
        </span>
      </div>

      {isExpanded && (
        <div style={{ padding: '12px 16px' }}>
          {sorted.map((entry) => {
            const style = RATING_STYLE[entry.rating] || RATING_STYLE.missing;
            return (
              <div
                key={entry.factId}
                style={{
                  padding: '6px 0',
                  borderBottom: '1px solid var(--border-color)',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ color: style.color, fontWeight: 600, flexShrink: 0 }} title={style.label}>
                    {style.symbol}
                  </span>
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                    title={entry.factText}
                  >
                    {entry.factText}
                  </span>
                  {entry.wasFaceted && (
                    <span
                      style={{ color: '#8b7355', fontSize: '11px', flexShrink: 0 }}
                      title="This fact was in the faceted set for this chronicle"
                    >
                      &#x2B21;
                    </span>
                  )}
                </div>
                {entry.evidence && (
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    fontStyle: 'italic',
                    marginTop: '2px',
                    marginLeft: '20px',
                  }}>
                    {entry.evidence}
                  </div>
                )}
              </div>
            );
          })}
          {generatedAt && (
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'right' }}>
              {report.model} &bull; ${report.actualCost.toFixed(4)} &bull; {new Date(generatedAt).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Temporal Context Editor (local)
// ============================================================================

function TemporalContextEditor({ item, eras, events, entities, onUpdateTemporalContext, onTemporalCheck, temporalCheckRunning, isGenerating }) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(600);

  // Observe container width for responsive timeline
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const availableEras = useMemo(() => {
    if (eras && eras.length > 0) return eras;
    return item.temporalContext?.allEras || [];
  }, [eras, item.temporalContext?.allEras]);

  const [selectedEraId, setSelectedEraId] = useState(
    item.temporalContext?.focalEra?.id || availableEras[0]?.id || ''
  );

  useEffect(() => {
    setSelectedEraId(item.temporalContext?.focalEra?.id || availableEras[0]?.id || '');
  }, [item.temporalContext?.focalEra?.id, availableEras]);

  const focalEra = item.temporalContext?.focalEra;
  const tickRange = item.temporalContext?.chronicleTickRange;

  // Build entity map for cast markers
  const entityMap = useMemo(() => {
    if (!entities) return new Map();
    return new Map(entities.map((e) => [e.id, e]));
  }, [entities]);

  // Filter events to only those selected for this chronicle
  const selectedEventIds = useMemo(
    () => new Set(item.selectedEventIds || []),
    [item.selectedEventIds]
  );

  // Build timeline events (mark all as selected since we're showing only selected ones)
  const timelineEvents = useMemo(() => {
    if (!events || events.length === 0) return [];
    const filteredEvents = events.filter((e) => selectedEventIds.has(e.id));
    const entryPointId = item.entrypointId || null;
    const assignedEntityIds = new Set(
      (item.roleAssignments || []).map((r) => r.entityId)
    );
    return prepareTimelineEvents(filteredEvents, entryPointId, assignedEntityIds, selectedEventIds);
  }, [events, selectedEventIds, item.entrypointId, item.roleAssignments]);

  // Build era ranges for timeline
  const eraRanges = useMemo(() => {
    if (availableEras.length === 0) return [];
    return getEraRanges(availableEras);
  }, [availableEras]);

  // Build timeline extent from eras
  const timelineExtent = useMemo(() => {
    if (availableEras.length === 0) return [0, 100];
    return getTimelineExtent(availableEras);
  }, [availableEras]);

  // Build cast markers from role assignments
  const castMarkers = useMemo(() => {
    if (!item.roleAssignments || item.roleAssignments.length === 0) return [];
    const entryPointEntity = item.entrypointId ? entityMap.get(item.entrypointId) : null;
    const markers = prepareCastMarkers(item.roleAssignments, entityMap, entryPointEntity, null);
    // Filter out markers with missing createdAt (nav items don't carry it)
    return markers.filter((m) => typeof m.createdAt === 'number' && !Number.isNaN(m.createdAt));
  }, [item.roleAssignments, item.entrypointId, entityMap]);

  const hasTimelineData = timelineEvents.length > 0 || castMarkers.length > 0;

  return (
    <div
      ref={containerRef}
      style={{
        marginBottom: '16px',
        padding: '16px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
      }}
    >
      <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
        Temporal Context
      </div>
      {availableEras.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          No eras available for this world.
        </div>
      ) : (
        <>
          {onUpdateTemporalContext && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Focal Era
              </div>
              <select
                value={selectedEraId}
                onChange={(event) => setSelectedEraId(event.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  minWidth: '200px',
                }}
              >
                {availableEras.map((era) => (
                  <option key={era.id} value={era.id}>
                    {era.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onUpdateTemporalContext?.(selectedEraId)}
                disabled={!selectedEraId || isGenerating}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-secondary)',
                  cursor: !selectedEraId || isGenerating ? 'not-allowed' : 'pointer',
                  opacity: !selectedEraId || isGenerating ? 0.6 : 1,
                }}
              >
                Update Era
              </button>
            </div>
          )}
          <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Current:</span>{' '}
              {focalEra?.name || 'Not set'}
            </div>
            {focalEra?.summary && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Era Summary:</span>{' '}
                {focalEra.summary}
              </div>
            )}
            {item.temporalContext?.temporalDescription && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Temporal Scope:</span>{' '}
                {item.temporalContext.temporalDescription}
              </div>
            )}
            {tickRange && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Tick Range:</span>{' '}
                {tickRange[0]}&ndash;{tickRange[1]}
              </div>
            )}
            {typeof item.temporalContext?.isMultiEra === 'boolean' && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Multi-era:</span>{' '}
                {item.temporalContext.isMultiEra ? 'Yes' : 'No'}
              </div>
            )}
          </div>

          {/* Timeline visualization of selected events */}
          {hasTimelineData ? (
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>
                SELECTED EVENTS TIMELINE ({timelineEvents.length} events)
              </div>
              <NarrativeTimeline
                events={timelineEvents}
                eraRanges={eraRanges}
                width={Math.max(containerWidth - 32, 300)}
                height={castMarkers.length > 0 ? 180 : 150}
                onToggleEvent={() => {}}
                focalEraId={focalEra?.id || selectedEraId}
                extent={timelineExtent}
                castMarkers={castMarkers}
              />
            </div>
          ) : (
            <div style={{
              marginTop: '16px',
              padding: '20px 16px',
              background: 'var(--bg-secondary)',
              borderRadius: '8px',
              textAlign: 'center',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}>
              No events selected — timeline will appear after event curation
            </div>
          )}

          {/* Temporal Alignment Check */}
          {item.perspectiveSynthesis?.temporalNarrative && (
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)' }}>
                  TEMPORAL NARRATIVE
                </div>
                <button
                  onClick={onTemporalCheck}
                  disabled={isGenerating || temporalCheckRunning || !item.assembledContent}
                  title="Check if focal era / temporal narrative misalignment affected the chronicle output"
                  style={{
                    marginLeft: 'auto',
                    padding: '4px 10px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: 'var(--text-secondary)',
                    cursor: isGenerating || temporalCheckRunning || !item.assembledContent ? 'not-allowed' : 'pointer',
                    opacity: isGenerating || temporalCheckRunning || !item.assembledContent ? 0.6 : 1,
                    fontSize: '11px',
                  }}
                >
                  {temporalCheckRunning ? 'Checking...' : 'Temporal Check'}
                </button>
              </div>
              <div style={{
                fontSize: '12px',
                lineHeight: 1.6,
                color: 'var(--text-secondary)',
                padding: '10px 12px',
                background: 'var(--bg-tertiary)',
                borderRadius: '6px',
                borderLeft: '3px solid #06b6d4',
                whiteSpace: 'pre-wrap',
              }}>
                {item.perspectiveSynthesis.temporalNarrative}
              </div>

              {/* Temporal Check Report */}
              {item.temporalCheckReport && (
                <div
                  style={{
                    marginTop: '12px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '10px 12px',
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 500 }}>Alignment Check Report</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {item.temporalCheckReportGeneratedAt && (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {new Date(item.temporalCheckReportGeneratedAt).toLocaleString()}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          const blob = new Blob([item.temporalCheckReport], { type: 'text/markdown' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `temporal-check-${item.chronicleId.slice(0, 20)}-${Date.now()}.md`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        style={{
                          padding: '2px 6px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          fontSize: '10px',
                        }}
                      >
                        Export
                      </button>
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '12px',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      fontSize: '12px',
                      lineHeight: 1.7,
                      whiteSpace: 'pre-wrap',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {item.temporalCheckReport}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// Reference Tab
// ============================================================================

export default function ReferenceTab({
  item,
  eras,
  events,
  entities,
  isGenerating,
  onUpdateTemporalContext,
  onTemporalCheck,
  temporalCheckRunning,
  seedData,
}) {
  return (
    <div>
      {item.perspectiveSynthesis && (
        <PerspectiveSynthesisViewer synthesis={item.perspectiveSynthesis} />
      )}

      <ExpandableSeedSection seed={seedData} defaultExpanded={false} />

      {item.factCoverageReport && (
        <>
          <FactCoverageGrid report={item.factCoverageReport} />
          <FactCoverageViewer report={item.factCoverageReport} generatedAt={item.factCoverageReportGeneratedAt} />
        </>
      )}

      <TemporalContextEditor
        item={item}
        eras={eras}
        events={events}
        entities={entities}
        onUpdateTemporalContext={onUpdateTemporalContext}
        onTemporalCheck={onTemporalCheck}
        temporalCheckRunning={temporalCheckRunning}
        isGenerating={isGenerating}
      />
    </div>
  );
}
