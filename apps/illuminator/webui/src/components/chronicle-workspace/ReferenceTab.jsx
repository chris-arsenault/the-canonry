import { useState, useMemo, useEffect, useRef } from "react";
import { ExpandableSeedSection } from "../ChronicleSeedViewer";
import NarrativeTimeline from "../ChronicleWizard/visualizations/NarrativeTimeline";
import {
  getEraRanges,
  prepareTimelineEvents,
  prepareCastMarkers,
  getTimelineExtent,
} from "../../lib/chronicle/timelineUtils";
import "./ReferenceTab.css";

// ============================================================================
// Perspective Synthesis Viewer (local)
// ============================================================================

function PerspectiveSynthesisViewer({ synthesis }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("output");

  if (!synthesis) return null;

  const formatCost = (cost) => `$${cost.toFixed(4)}`;
  const formatTimestamp = (ts) => new Date(ts).toLocaleString();

  const hasInputData =
    synthesis.coreTone ||
    synthesis.inputFacts ||
    synthesis.inputCulturalIdentities ||
    synthesis.constellation ||
    synthesis.inputWorldDynamics ||
    synthesis.narrativeStyleName;

  return (
    <div className="ref-tab-synth">
      <div
        className={`ref-tab-synth__header ${isExpanded ? "ref-tab-synth__header--expanded" : ""}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="ref-tab-synth__toggle">
          {isExpanded ? "\u25BC" : "\u25B6"}
        </span>
        <span className="ref-tab-synth__title">Perspective Synthesis</span>
        <span className="ref-tab-synth__meta">
          {synthesis.facets?.length || 0} facets &bull; {synthesis.entityDirectives?.length || 0}{" "}
          directives &bull; {synthesis.suggestedMotifs?.length || 0} motifs &bull;{" "}
          {formatCost(synthesis.actualCost)}
        </span>
      </div>

      {isExpanded && (
        <div className="ref-tab-synth__body">
          {hasInputData && (
            <div className="ref-tab-synth__tabs">
              <button
                onClick={() => setActiveTab("output")}
                className={`ref-tab-synth__tab-btn ${activeTab === "output" ? "ref-tab-synth__tab-btn--active" : ""}`}
              >
                LLM Output
              </button>
              <button
                onClick={() => setActiveTab("input")}
                className={`ref-tab-synth__tab-btn ${activeTab === "input" ? "ref-tab-synth__tab-btn--active" : ""}`}
              >
                LLM Input
              </button>
            </div>
          )}

          {activeTab === "output" && (
            <>
              {/* Constellation Summary */}
              <div className="ref-tab-section">
                <div className="ref-tab-section-heading">
                  CONSTELLATION SUMMARY
                </div>
                <div className="ref-tab-text">
                  {synthesis.constellationSummary}
                </div>
              </div>

              {/* Brief */}
              <div className="ref-tab-section">
                <div className="ref-tab-section-heading">
                  PERSPECTIVE BRIEF
                </div>
                <div className="ref-tab-text--brief">
                  {synthesis.brief}
                </div>
              </div>

              {/* Facets */}
              {synthesis.facets && synthesis.facets.length > 0 && (
                <div className="ref-tab-section">
                  <div className="ref-tab-section-heading ref-tab-section-heading--mb8">
                    FACETED FACTS ({synthesis.facets.length})
                  </div>
                  <div className="ref-tab-vlist">
                    {synthesis.facets.map((facet, i) => (
                      <div
                        key={i}
                        className="ref-tab-card ref-tab-card--accent-left"
                      >
                        <div className="ref-tab-card__id">
                          {facet.factId}
                        </div>
                        <div className="ref-tab-card__body">
                          {facet.interpretation}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Narrative Voice */}
              {synthesis.narrativeVoice && Object.keys(synthesis.narrativeVoice).length > 0 && (
                <div className="ref-tab-section">
                  <div className="ref-tab-section-heading ref-tab-section-heading--mb8">
                    NARRATIVE VOICE
                  </div>
                  <div className="ref-tab-vlist">
                    {Object.entries(synthesis.narrativeVoice).map(([key, value]) => (
                      <div
                        key={key}
                        className="ref-tab-card ref-tab-card--accent-secondary"
                      >
                        <div className="ref-tab-card__heading">
                          {key}
                        </div>
                        <div className="ref-tab-card__body">
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Entity Directives */}
              {synthesis.entityDirectives && synthesis.entityDirectives.length > 0 && (
                <div className="ref-tab-section">
                  <div className="ref-tab-section-heading ref-tab-section-heading--mb8">
                    ENTITY DIRECTIVES ({synthesis.entityDirectives.length})
                  </div>
                  <div className="ref-tab-vlist">
                    {synthesis.entityDirectives.map((d, i) => (
                      <div
                        key={i}
                        className="ref-tab-card ref-tab-card--accent-tertiary"
                      >
                        <div className="ref-tab-card__heading ref-tab-card__heading--tertiary">
                          {d.entityName}
                        </div>
                        <div className="ref-tab-card__body">
                          {d.directive}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Motifs */}
              {synthesis.suggestedMotifs && synthesis.suggestedMotifs.length > 0 && (
                <div className="ref-tab-section">
                  <div className="ref-tab-section-heading ref-tab-section-heading--mb8">
                    SUGGESTED MOTIFS
                  </div>
                  <div className="ref-tab-motifs">
                    {synthesis.suggestedMotifs.map((motif, i) => (
                      <span key={i} className="ref-tab-motif">
                        &ldquo;{motif}&rdquo;
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "input" && (
            <>
              {/* Narrative Style */}
              {synthesis.narrativeStyleName && (
                <div className="ref-tab-section">
                  <div className="ref-tab-section-heading">
                    NARRATIVE STYLE
                  </div>
                  <div className="ref-tab-card--style">
                    <span className="ref-tab-card__name">{synthesis.narrativeStyleName}</span>
                    {synthesis.narrativeStyleId && (
                      <span className="ref-tab-card__inline-meta">
                        ({synthesis.narrativeStyleId})
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Focal Era */}
              {synthesis.focalEra && (
                <div className="ref-tab-section">
                  <div className="ref-tab-section-heading">
                    FOCAL ERA
                  </div>
                  <div className="ref-tab-card ref-tab-card--accent-green">
                    <span className="ref-tab-card__name">{synthesis.focalEra.name}</span>
                    <span className="ref-tab-card__inline-meta">
                      ({synthesis.focalEra.id})
                    </span>
                    {synthesis.focalEra.description && (
                      <div className="ref-tab-card__sub">
                        {synthesis.focalEra.description}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Fact Selection Range */}
              {synthesis.factSelectionRange &&
                (synthesis.factSelectionRange.min || synthesis.factSelectionRange.max) && (
                  <div className="ref-tab-section">
                    <div className="ref-tab-section-heading">
                      FACT SELECTION RANGE
                    </div>
                    <div className="ref-tab-text">
                      {synthesis.factSelectionRange.min && synthesis.factSelectionRange.max
                        ? synthesis.factSelectionRange.min === synthesis.factSelectionRange.max
                          ? `Exactly ${synthesis.factSelectionRange.min} facts`
                          : `${synthesis.factSelectionRange.min}–${synthesis.factSelectionRange.max} facts`
                        : synthesis.factSelectionRange.min
                          ? `At least ${synthesis.factSelectionRange.min} facts`
                          : `Up to ${synthesis.factSelectionRange.max} facts`}
                    </div>
                  </div>
                )}

              {/* Core Tone */}
              {synthesis.coreTone && (
                <div className="ref-tab-section">
                  <div className="ref-tab-section-heading">
                    CORE TONE
                  </div>
                  <div className="ref-tab-text--brief">
                    {synthesis.coreTone}
                  </div>
                </div>
              )}

              {/* Constellation Analysis */}
              {synthesis.constellation && (
                <div className="ref-tab-section">
                  <div className="ref-tab-section-heading ref-tab-section-heading--mb8">
                    CONSTELLATION ANALYSIS
                  </div>
                  <div className="ref-tab-constellation">
                    <div className="ref-tab-constellation__row">
                      <strong>Cultures:</strong>{" "}
                      {Object.entries(synthesis.constellation.cultures || {})
                        .map(([k, v]) => `${k}(${v})`)
                        .join(", ") || "none"}
                    </div>
                    <div className="ref-tab-constellation__row">
                      <strong>Entity Kinds:</strong>{" "}
                      {Object.entries(synthesis.constellation.kinds || {})
                        .map(([k, v]) => `${k}(${v})`)
                        .join(", ") || "none"}
                    </div>
                    <div className="ref-tab-constellation__row">
                      <strong>Prominent Tags:</strong>{" "}
                      {synthesis.constellation.prominentTags?.join(", ") || "none"}
                    </div>
                    <div className="ref-tab-constellation__row">
                      <strong>Culture Balance:</strong> {synthesis.constellation.cultureBalance}
                      {synthesis.constellation.dominantCulture &&
                        ` (dominant: ${synthesis.constellation.dominantCulture})`}
                    </div>
                    <div>
                      <strong>Relationships:</strong>{" "}
                      {synthesis.constellation.relationshipKinds &&
                      Object.keys(synthesis.constellation.relationshipKinds).length > 0
                        ? Object.entries(synthesis.constellation.relationshipKinds)
                            .map(([k, v]) => `${k}(${v})`)
                            .join(", ")
                        : "none"}
                    </div>
                  </div>
                </div>
              )}

              {/* Input Entities */}
              {synthesis.inputEntities && synthesis.inputEntities.length > 0 && (
                <div className="ref-tab-section">
                  <div className="ref-tab-section-heading ref-tab-section-heading--mb8">
                    ENTITIES ({synthesis.inputEntities.length})
                  </div>
                  <div className="ref-tab-vlist ref-tab-vlist--tight">
                    {synthesis.inputEntities.map((entity, i) => (
                      <div key={i} className="ref-tab-entity">
                        <div className="ref-tab-entity__name">
                          {entity.name}{" "}
                          <span className="ref-tab-entity__meta">
                            ({entity.kind}
                            {entity.culture ? `, ${entity.culture}` : ""})
                          </span>
                        </div>
                        {entity.summary && (
                          <div className="ref-tab-entity__summary">
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
                <div className="ref-tab-section">
                  <div className="ref-tab-section-heading ref-tab-section-heading--mb8">
                    INPUT FACTS ({synthesis.inputFacts.length})
                  </div>
                  <div className="ref-tab-vlist ref-tab-vlist--tight">
                    {synthesis.inputFacts.map((fact, i) => (
                      <div
                        key={i}
                        className={`ref-tab-fact ${fact.type === "generation_constraint" ? "ref-tab-fact--constraint" : "ref-tab-fact--normal"}`}
                      >
                        <div className="ref-tab-fact__header">
                          <span className="ref-tab-fact__id">
                            {fact.id}
                          </span>
                          {fact.type === "generation_constraint" && (
                            <span className="ref-tab-fact__badge">
                              constraint
                            </span>
                          )}
                        </div>
                        <div className="ref-tab-fact__text">{fact.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cultural Identities */}
              {synthesis.inputCulturalIdentities &&
                Object.keys(synthesis.inputCulturalIdentities).length > 0 && (
                  <div className="ref-tab-section">
                    <div className="ref-tab-section-heading ref-tab-section-heading--mb8">
                      CULTURAL IDENTITIES ({Object.keys(synthesis.inputCulturalIdentities).length}{" "}
                      cultures)
                    </div>
                    <div className="ref-tab-vlist">
                      {Object.entries(synthesis.inputCulturalIdentities).map(
                        ([cultureId, traits]) => (
                          <div key={cultureId} className="ref-tab-culture">
                            <div className="ref-tab-culture__name">
                              {cultureId}
                            </div>
                            <div className="ref-tab-culture__traits">
                              {Object.entries(traits).map(([key, value]) => (
                                <div key={key}>
                                  <span className="ref-tab-culture__trait-key">{key}:</span> {value}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

              {/* World Dynamics */}
              {synthesis.inputWorldDynamics && synthesis.inputWorldDynamics.length > 0 && (
                <div className="ref-tab-section">
                  <div className="ref-tab-section-heading ref-tab-section-heading--mb8">
                    WORLD DYNAMICS ({synthesis.inputWorldDynamics.length})
                  </div>
                  <div className="ref-tab-vlist ref-tab-vlist--tight">
                    {synthesis.inputWorldDynamics.map((dynamic, i) => (
                      <div
                        key={i}
                        className="ref-tab-card ref-tab-card--accent-cyan"
                      >
                        <div className="ref-tab-card__heading ref-tab-card__heading--cyan">
                          {dynamic.id}
                        </div>
                        <div className="ref-tab-card__body">
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
          <div className="ref-tab-synth__footer">
            <span>Model: {synthesis.model}</span>
            <span>
              Tokens: {synthesis.inputTokens} in / {synthesis.outputTokens} out
            </span>
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

const RATING_ORDER = ["integral", "prevalent", "mentioned", "missing"];
const RATING_STYLE = {
  integral: { symbol: "\u25C6", color: "#10b981", label: "integral" },
  prevalent: { symbol: "\u25C7", color: "#3b82f6", label: "prevalent" },
  mentioned: { symbol: "\u00B7", color: "#f59e0b", label: "mentioned" },
  missing: { symbol: "\u25CB", color: "var(--text-muted)", label: "missing" },
};

function FactCoverageGrid({ report }) {
  if (!report?.entries?.length) return null;

  // Static order — 3 columns of 6
  const entries = report.entries;
  const cols = [entries.slice(0, 6), entries.slice(6, 12), entries.slice(12, 18)];

  return (
    <div className="ref-tab-fcg">
      <div className="ref-tab-fcg__header">
        <span className="ref-tab-fcg__title">
          Canon Facts
        </span>
        <span className="ref-tab-fcg__legend">
          {RATING_ORDER.map((r) => (
            <span key={r}>
              {/* eslint-disable-next-line local/no-inline-styles */}
              <span style={{ color: RATING_STYLE[r].color, fontWeight: 600 }}>
                {RATING_STYLE[r].symbol}
              </span>{" "}
              {r}
            </span>
          ))}
          <span>
            {/* eslint-disable-next-line local/no-inline-styles */}
            <span style={{ color: "#10b981" }}>yes</span>/
            {/* eslint-disable-next-line local/no-inline-styles */}
            <span style={{ color: "var(--text-muted)" }}>no</span> = included
          </span>
        </span>
      </div>
      <div className="ref-tab-fcg__grid">
        {cols.map((col, ci) => (
          <div key={ci}>
            {col.map((entry) => {
              const rs = RATING_STYLE[entry.rating] || RATING_STYLE.missing;
              // Mismatch highlights
              const bg =
                entry.wasFaceted && entry.rating === "missing"
                  ? "rgba(239, 68, 68, 0.12)"
                  : entry.wasFaceted && entry.rating === "mentioned"
                    ? "rgba(245, 158, 11, 0.12)"
                    : !entry.wasFaceted &&
                        (entry.rating === "integral" || entry.rating === "prevalent")
                      ? "rgba(16, 185, 129, 0.12)"
                      : undefined;
              return (
                <div
                  key={entry.factId}
                  className="ref-tab-fcg__entry"
                  // eslint-disable-next-line local/no-inline-styles
                  style={{ background: bg, borderRadius: bg ? "3px" : undefined }}
                  title={entry.factText}
                >
                  {/* eslint-disable-next-line local/no-inline-styles */}
                  <span className="ref-tab-fcg__symbol" style={{ color: rs.color }}>
                    {rs.symbol}
                  </span>
                  <span className="ref-tab-fcg__fact-id">
                    {entry.factId}
                  </span>
                  {/* eslint-disable-next-line local/no-inline-styles */}
                  <span className="ref-tab-fcg__included" style={{ color: entry.wasFaceted ? "#10b981" : "var(--text-muted)" }}>
                    {entry.wasFaceted ? "yes" : "no"}
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
    (a, b) => RATING_ORDER.indexOf(a.rating) - RATING_ORDER.indexOf(b.rating)
  );

  return (
    <div className="ref-tab-fcv">
      <div
        className={`ref-tab-fcv__header ${isExpanded ? "ref-tab-fcv__header--expanded" : ""}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="ref-tab-synth__toggle">
          {isExpanded ? "\u25BC" : "\u25B6"}
        </span>
        <span className="ref-tab-synth__title">Fact Coverage</span>
        <span className="ref-tab-synth__meta">
          {RATING_ORDER.map((r) =>
            counts[r] > 0 ? `${RATING_STYLE[r].symbol} ${counts[r]} ${r}` : null
          )
            .filter(Boolean)
            .join("  ")}
        </span>
      </div>

      {isExpanded && (
        <div className="ref-tab-fcv__body">
          {sorted.map((entry) => {
            const rs = RATING_STYLE[entry.rating] || RATING_STYLE.missing;
            return (
              <div key={entry.factId} className="ref-tab-fcv__entry">
                <div className="ref-tab-fcv__entry-row">
                  {/* eslint-disable-next-line local/no-inline-styles */}
                  <span className="ref-tab-fcv__symbol" style={{ color: rs.color }} title={rs.label}>
                    {rs.symbol}
                  </span>
                  <span className="ref-tab-fcv__fact-text" title={entry.factText}>
                    {entry.factText}
                  </span>
                  {entry.wasFaceted && (
                    <span
                      className="ref-tab-fcv__faceted"
                      title="This fact was in the faceted set for this chronicle"
                    >
                      &#x2B21;
                    </span>
                  )}
                </div>
                {entry.evidence && (
                  <div className="ref-tab-fcv__evidence">
                    {entry.evidence}
                  </div>
                )}
              </div>
            );
          })}
          {generatedAt && (
            <div className="ref-tab-fcv__meta">
              {report.model} &bull; ${report.actualCost.toFixed(4)} &bull;{" "}
              {new Date(generatedAt).toLocaleString()}
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

function TemporalContextEditor({
  item,
  eras,
  events,
  entities,
  onUpdateTemporalContext,
  onTemporalCheck,
  temporalCheckRunning,
  isGenerating,
}) {
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
    item.temporalContext?.focalEra?.id || availableEras[0]?.id || ""
  );

  useEffect(() => {
    setSelectedEraId(item.temporalContext?.focalEra?.id || availableEras[0]?.id || "");
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
    const assignedEntityIds = new Set((item.roleAssignments || []).map((r) => r.entityId));
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
    return markers.filter((m) => typeof m.createdAt === "number" && !Number.isNaN(m.createdAt));
  }, [item.roleAssignments, item.entrypointId, entityMap]);

  const hasTimelineData = timelineEvents.length > 0 || castMarkers.length > 0;

  return (
    <div ref={containerRef} className="ref-tab-temporal">
      <div className="ref-tab-temporal__title">
        Temporal Context
      </div>
      {availableEras.length === 0 ? (
        <div className="ref-tab-temporal__empty">
          No eras available for this world.
        </div>
      ) : (
        <>
          {onUpdateTemporalContext && (
            <div className="ref-tab-temporal__controls">
              <div className="ref-tab-temporal__label">Focal Era</div>
              <select
                value={selectedEraId}
                onChange={(event) => setSelectedEraId(event.target.value)}
                className="ref-tab-temporal__select"
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
                className={`ref-tab-temporal__update-btn ${!selectedEraId || isGenerating ? "ref-tab-temporal__update-btn--disabled" : "ref-tab-temporal__update-btn--enabled"}`}
              >
                Update Era
              </button>
            </div>
          )}
          <div className="ref-tab-temporal__info">
            <div>
              <span className="ref-tab-temporal__info-label">Current:</span>{" "}
              {focalEra?.name || "Not set"}
            </div>
            {focalEra?.summary && (
              <div>
                <span className="ref-tab-temporal__info-label">Era Summary:</span> {focalEra.summary}
              </div>
            )}
            {item.temporalContext?.temporalDescription && (
              <div>
                <span className="ref-tab-temporal__info-label">Temporal Scope:</span>{" "}
                {item.temporalContext.temporalDescription}
              </div>
            )}
            {tickRange && (
              <div>
                <span className="ref-tab-temporal__info-label">Tick Range:</span> {tickRange[0]}
                &ndash;{tickRange[1]}
              </div>
            )}
            {typeof item.temporalContext?.isMultiEra === "boolean" && (
              <div>
                <span className="ref-tab-temporal__info-label">Multi-era:</span>{" "}
                {item.temporalContext.isMultiEra ? "Yes" : "No"}
              </div>
            )}
          </div>

          {/* Timeline visualization of selected events */}
          {hasTimelineData ? (
            <div className="ref-tab-temporal__timeline">
              <div className="ref-tab-temporal__timeline-heading">
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
            <div className="ref-tab-temporal__no-events">
              No events selected — timeline will appear after event curation
            </div>
          )}

          {/* Temporal Alignment Check */}
          {item.perspectiveSynthesis?.temporalNarrative && (
            <div className="ref-tab-temporal__narrative">
              <div className="ref-tab-temporal__narrative-header">
                <div className="ref-tab-temporal__narrative-title">
                  TEMPORAL NARRATIVE
                </div>
                <button
                  onClick={onTemporalCheck}
                  disabled={isGenerating || temporalCheckRunning || !item.assembledContent}
                  title="Check if focal era / temporal narrative misalignment affected the chronicle output"
                  className={`ref-tab-temporal__check-btn ${isGenerating || temporalCheckRunning || !item.assembledContent ? "ref-tab-temporal__check-btn--disabled" : "ref-tab-temporal__check-btn--enabled"}`}
                >
                  {temporalCheckRunning ? "Checking..." : "Temporal Check"}
                </button>
              </div>
              <div className="ref-tab-temporal__narrative-text">
                {item.perspectiveSynthesis.temporalNarrative}
              </div>

              {/* Temporal Check Report */}
              {item.temporalCheckReport && (
                <div className="ref-tab-temporal__report">
                  <div className="ref-tab-temporal__report-header">
                    <span className="ref-tab-temporal__report-title">
                      Alignment Check Report
                    </span>
                    <div className="ref-tab-temporal__report-actions">
                      {item.temporalCheckReportGeneratedAt && (
                        <span className="ref-tab-temporal__report-date">
                          {new Date(item.temporalCheckReportGeneratedAt).toLocaleString()}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          const blob = new Blob([item.temporalCheckReport], {
                            type: "text/markdown",
                          });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `temporal-check-${item.chronicleId.slice(0, 20)}-${Date.now()}.md`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="ref-tab-temporal__export-btn"
                      >
                        Export
                      </button>
                    </div>
                  </div>
                  <div className="ref-tab-temporal__report-body">
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
          <FactCoverageViewer
            report={item.factCoverageReport}
            generatedAt={item.factCoverageReportGeneratedAt}
          />
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
