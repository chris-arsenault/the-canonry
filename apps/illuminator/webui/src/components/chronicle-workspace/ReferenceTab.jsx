import { useState, useMemo, useEffect } from 'react';
import { ExpandableSeedSection } from '../ChronicleSeedViewer';

// ============================================================================
// Perspective Synthesis Viewer (local)
// ============================================================================

function PerspectiveSynthesisViewer({ synthesis }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('output');

  if (!synthesis) return null;

  const formatCost = (cost) => `$${cost.toFixed(4)}`;
  const formatTimestamp = (ts) => new Date(ts).toLocaleString();

  const hasInputData = synthesis.coreTone || synthesis.inputFacts || synthesis.inputCulturalIdentities || synthesis.constellation;

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
// Temporal Context Editor (local)
// ============================================================================

function TemporalContextEditor({ item, eras, onUpdateTemporalContext, isGenerating }) {
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

  return (
    <div
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
  isGenerating,
  onUpdateTemporalContext,
  seedData,
}) {
  return (
    <div>
      {item.perspectiveSynthesis && (
        <PerspectiveSynthesisViewer synthesis={item.perspectiveSynthesis} />
      )}

      <ExpandableSeedSection seed={seedData} defaultExpanded={false} />

      <TemporalContextEditor
        item={item}
        eras={eras}
        onUpdateTemporalContext={onUpdateTemporalContext}
        isGenerating={isGenerating}
      />
    </div>
  );
}
