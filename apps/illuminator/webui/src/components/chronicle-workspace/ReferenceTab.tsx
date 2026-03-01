import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ExpandableSeedSection, useExpandBoolean } from "@the-canonry/shared-components";
import NarrativeTimeline from "../ChronicleWizard/visualizations/NarrativeTimeline";
import {
  getEraRanges,
  prepareTimelineEvents,
  prepareCastMarkers,
  getTimelineExtent,
} from "../../lib/chronicle/timelineUtils";
import type { EraTemporalInfo, ChronicleRecord, PerspectiveSynthesisRecord, FactCoverageReport, FactCoverageEntry } from "../../lib/chronicleTypes";
import "./ReferenceTab.css";

// ============================================================================
// Shared Types
// ============================================================================

type FactCoverageRating = "integral" | "prevalent" | "mentioned" | "missing";

interface RatingStyleEntry {
  symbol: string;
  color: string;
  label: string;
}

const RATING_ORDER: FactCoverageRating[] = ["integral", "prevalent", "mentioned", "missing"];
const RATING_STYLE: Record<FactCoverageRating, RatingStyleEntry> = {
  integral: { symbol: "\u25C6", color: "#10b981", label: "integral" },
  prevalent: { symbol: "\u25C7", color: "#3b82f6", label: "prevalent" },
  mentioned: { symbol: "\u00B7", color: "#f59e0b", label: "mentioned" },
  missing: { symbol: "\u25CB", color: "var(--text-muted)", label: "missing" },
};

// ============================================================================
// Perspective Synthesis Viewer
// ============================================================================

interface PerspectiveSynthesisViewerProps {
  synthesis: PerspectiveSynthesisRecord;
}

/** Renders the LLM Output tab content */
function SynthesisOutputTab({ synthesis }: { synthesis: PerspectiveSynthesisRecord }) {
  return (
    <>
      {/* Constellation Summary */}
      <div className="ref-tab-group">
        <div className="ref-tab-section-heading">CONSTELLATION SUMMARY</div>
        <div className="ref-tab-text">{synthesis.constellationSummary}</div>
      </div>

      {/* Brief */}
      <div className="ref-tab-group">
        <div className="ref-tab-section-heading">PERSPECTIVE BRIEF</div>
        <div className="ref-tab-text-brief">{synthesis.brief}</div>
      </div>

      {/* Facets */}
      {synthesis.facets && synthesis.facets.length > 0 && (
        <div className="ref-tab-group">
          <div className="ref-tab-section-heading ref-tab-section-heading-mb8">
            FACETED FACTS ({synthesis.facets.length})
          </div>
          <div className="ref-tab-vlist">
            {synthesis.facets.map((facet, i) => (
              <div key={i} className="ref-tab-card ref-tab-card-accent-left">
                <div className="ref-tab-card-id">{facet.factId}</div>
                <div className="ref-tab-card-body">{facet.interpretation}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Narrative Voice */}
      {synthesis.narrativeVoice && Object.keys(synthesis.narrativeVoice).length > 0 && (
        <div className="ref-tab-group">
          <div className="ref-tab-section-heading ref-tab-section-heading-mb8">
            NARRATIVE VOICE
          </div>
          <div className="ref-tab-vlist">
            {Object.entries(synthesis.narrativeVoice).map(([key, value]) => (
              <div key={key} className="ref-tab-card ref-tab-card-accent-secondary">
                <div className="ref-tab-card-heading">{key}</div>
                <div className="ref-tab-card-body">{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entity Directives */}
      {synthesis.entityDirectives && synthesis.entityDirectives.length > 0 && (
        <div className="ref-tab-group">
          <div className="ref-tab-section-heading ref-tab-section-heading-mb8">
            ENTITY DIRECTIVES ({synthesis.entityDirectives.length})
          </div>
          <div className="ref-tab-vlist">
            {synthesis.entityDirectives.map((d, i) => (
              <div key={i} className="ref-tab-card ref-tab-card-accent-tertiary">
                <div className="ref-tab-card-heading ref-tab-card-heading-tertiary">
                  {d.entityName}
                </div>
                <div className="ref-tab-card-body">{d.directive}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Motifs */}
      {synthesis.suggestedMotifs && synthesis.suggestedMotifs.length > 0 && (
        <div className="ref-tab-group">
          <div className="ref-tab-section-heading ref-tab-section-heading-mb8">
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
  );
}

/** Renders the LLM Input tab content */
function SynthesisInputTab({ synthesis }: { synthesis: PerspectiveSynthesisRecord }) {
  const factSelectionLabel = useMemo(() => {
    if (!synthesis.factSelectionRange) return null;
    const { min, max } = synthesis.factSelectionRange;
    if (!min && !max) return null;
    if (min && max) {
      return min === max ? `Exactly ${min} facts` : `${min}\u2013${max} facts`;
    }
    if (min) return `At least ${min} facts`;
    return `Up to ${max} facts`;
  }, [synthesis.factSelectionRange]);

  return (
    <>
      {/* Narrative Style */}
      {synthesis.narrativeStyleName && (
        <div className="ref-tab-group">
          <div className="ref-tab-section-heading">NARRATIVE STYLE</div>
          <div className="ref-tab-card-style">
            <span className="ref-tab-card-name">{synthesis.narrativeStyleName}</span>
            {synthesis.narrativeStyleId && (
              <span className="ref-tab-card-inline-meta">
                ({synthesis.narrativeStyleId})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Focal Era */}
      {synthesis.focalEra && (
        <div className="ref-tab-group">
          <div className="ref-tab-section-heading">FOCAL ERA</div>
          <div className="ref-tab-card ref-tab-card-accent-green">
            <span className="ref-tab-card-name">{synthesis.focalEra.name}</span>
            <span className="ref-tab-card-inline-meta">({synthesis.focalEra.id})</span>
            {synthesis.focalEra.description && (
              <div className="ref-tab-card-sub">{synthesis.focalEra.description}</div>
            )}
          </div>
        </div>
      )}

      {/* Fact Selection Range */}
      {factSelectionLabel && (
        <div className="ref-tab-group">
          <div className="ref-tab-section-heading">FACT SELECTION RANGE</div>
          <div className="ref-tab-text">{factSelectionLabel}</div>
        </div>
      )}

      {/* Core Tone */}
      {synthesis.coreTone && (
        <div className="ref-tab-group">
          <div className="ref-tab-section-heading">CORE TONE</div>
          <div className="ref-tab-text-brief">{synthesis.coreTone}</div>
        </div>
      )}

      {/* Constellation Analysis */}
      {synthesis.constellation && (
        <ConstellationSection constellation={synthesis.constellation} />
      )}

      {/* Input Entities */}
      {synthesis.inputEntities && synthesis.inputEntities.length > 0 && (
        <div className="ref-tab-group">
          <div className="ref-tab-section-heading ref-tab-section-heading-mb8">
            ENTITIES ({synthesis.inputEntities.length})
          </div>
          <div className="ref-tab-vlist ref-tab-vlist-tight">
            {synthesis.inputEntities.map((entity, i) => (
              <div key={i} className="ref-tab-entity">
                <div className="ref-tab-entity-name">
                  {entity.name}{" "}
                  <span className="ref-tab-entity-meta">
                    ({entity.kind}
                    {entity.culture ? `, ${entity.culture}` : ""})
                  </span>
                </div>
                {entity.summary && (
                  <div className="ref-tab-entity-summary">{entity.summary}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Facts */}
      {synthesis.inputFacts && synthesis.inputFacts.length > 0 && (
        <div className="ref-tab-group">
          <div className="ref-tab-section-heading ref-tab-section-heading-mb8">
            INPUT FACTS ({synthesis.inputFacts.length})
          </div>
          <div className="ref-tab-vlist ref-tab-vlist-tight">
            {synthesis.inputFacts.map((fact, i) => (
              <div
                key={i}
                className={`ref-tab-fact ${fact.type === "generation_constraint" ? "ref-tab-fact-constraint" : "ref-tab-fact-normal"}`}
              >
                <div className="ref-tab-fact-header">
                  <span className="ref-tab-fact-id">{fact.id}</span>
                  {fact.type === "generation_constraint" && (
                    <span className="ref-tab-fact-badge">constraint</span>
                  )}
                </div>
                <div className="ref-tab-fact-text">{fact.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cultural Identities */}
      {synthesis.inputCulturalIdentities &&
        Object.keys(synthesis.inputCulturalIdentities).length > 0 && (
          <div className="ref-tab-group">
            <div className="ref-tab-section-heading ref-tab-section-heading-mb8">
              CULTURAL IDENTITIES ({Object.keys(synthesis.inputCulturalIdentities).length}{" "}
              cultures)
            </div>
            <div className="ref-tab-vlist">
              {Object.entries(synthesis.inputCulturalIdentities).map(
                ([cultureId, traits]) => (
                  <div key={cultureId} className="ref-tab-culture">
                    <div className="ref-tab-culture-name">{cultureId}</div>
                    <div className="ref-tab-culture-traits">
                      {Object.entries(traits).map(([key, value]) => (
                        <div key={key}>
                          <span className="ref-tab-culture-trait-key">{key}:</span> {value}
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
        <div className="ref-tab-group">
          <div className="ref-tab-section-heading ref-tab-section-heading-mb8">
            WORLD DYNAMICS ({synthesis.inputWorldDynamics.length})
          </div>
          <div className="ref-tab-vlist ref-tab-vlist-tight">
            {synthesis.inputWorldDynamics.map((dynamic, i) => (
              <div key={i} className="ref-tab-card ref-tab-card-accent-cyan">
                <div className="ref-tab-card-heading ref-tab-card-heading-cyan">
                  {dynamic.id}
                </div>
                <div className="ref-tab-card-body">{dynamic.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

interface ConstellationData {
  cultures: Record<string, number>;
  kinds: Record<string, number>;
  prominentTags: string[];
  dominantCulture?: string;
  cultureBalance: string;
  relationshipKinds: Record<string, number>;
}

function ConstellationSection({ constellation }: { constellation: ConstellationData }) {
  return (
    <div className="ref-tab-group">
      <div className="ref-tab-section-heading ref-tab-section-heading-mb8">
        CONSTELLATION ANALYSIS
      </div>
      <div className="ref-tab-constellation">
        <div className="ref-tab-constellation-row">
          <strong>Cultures:</strong>{" "}
          {Object.entries(constellation.cultures || {})
            .map(([k, v]) => `${k}(${v})`)
            .join(", ") || "none"}
        </div>
        <div className="ref-tab-constellation-row">
          <strong>Entity Kinds:</strong>{" "}
          {Object.entries(constellation.kinds || {})
            .map(([k, v]) => `${k}(${v})`)
            .join(", ") || "none"}
        </div>
        <div className="ref-tab-constellation-row">
          <strong>Prominent Tags:</strong>{" "}
          {constellation.prominentTags?.join(", ") || "none"}
        </div>
        <div className="ref-tab-constellation-row">
          <strong>Culture Balance:</strong> {constellation.cultureBalance}
          {constellation.dominantCulture &&
            ` (dominant: ${constellation.dominantCulture})`}
        </div>
        <div>
          <strong>Relationships:</strong>{" "}
          {constellation.relationshipKinds &&
          Object.keys(constellation.relationshipKinds).length > 0
            ? Object.entries(constellation.relationshipKinds)
                .map(([k, v]) => `${k}(${v})`)
                .join(", ")
            : "none"}
        </div>
      </div>
    </div>
  );
}

function PerspectiveSynthesisViewer({ synthesis }: PerspectiveSynthesisViewerProps) {
  const { expanded, toggle, headerProps } = useExpandBoolean();
  const [activeTab, setActiveTab] = useState<"output" | "input">("output");

  const formatCost = useCallback((cost: number) => `$${cost.toFixed(4)}`, []);
  const formatTimestamp = useCallback((ts: number) => new Date(ts).toLocaleString(), []);

  const hasInputData =
    synthesis.coreTone ||
    synthesis.inputFacts ||
    synthesis.inputCulturalIdentities ||
    synthesis.constellation ||
    synthesis.inputWorldDynamics ||
    synthesis.narrativeStyleName;

  const handleOutputTab = useCallback(() => setActiveTab("output"), []);
  const handleInputTab = useCallback(() => setActiveTab("input"), []);

  return (
    <div className="ilu-container ref-tab-synth">
      <div
        className={`ilu-container-header ref-tab-synth-header ${expanded ? "ref-tab-synth-header-expanded" : ""}`}
        {...headerProps}
      >
        <span className="ref-tab-synth-toggle">{expanded ? "\u25BC" : "\u25B6"}</span>
        <span className="ref-tab-synth-title">Perspective Synthesis</span>
        <span className="ref-tab-synth-meta">
          {synthesis.facets?.length || 0} facets &bull; {synthesis.entityDirectives?.length || 0}{" "}
          directives &bull; {synthesis.suggestedMotifs?.length || 0} motifs &bull;{" "}
          {formatCost(synthesis.actualCost)}
        </span>
      </div>

      {expanded && (
        <div className="ref-tab-synth-body">
          {hasInputData && (
            <div className="ref-tab-synth-tabs">
              <button
                onClick={handleOutputTab}
                className={`ref-tab-synth-tab-btn ${activeTab === "output" ? "ref-tab-synth-tab-btn-active" : ""}`}
              >
                LLM Output
              </button>
              <button
                onClick={handleInputTab}
                className={`ref-tab-synth-tab-btn ${activeTab === "input" ? "ref-tab-synth-tab-btn-active" : ""}`}
              >
                LLM Input
              </button>
            </div>
          )}

          {activeTab === "output" && <SynthesisOutputTab synthesis={synthesis} />}
          {activeTab === "input" && <SynthesisInputTab synthesis={synthesis} />}

          {/* Metadata */}
          <div className="ref-tab-synth-footer">
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
// Fact Coverage Grid
// ============================================================================

interface FactCoverageGridProps {
  report: FactCoverageReport;
}

function computeEntryBackground(entry: FactCoverageEntry): string | undefined {
  if (entry.wasFaceted && entry.rating === "missing") {
    return "rgba(239, 68, 68, 0.12)";
  }
  if (entry.wasFaceted && entry.rating === "mentioned") {
    return "rgba(245, 158, 11, 0.12)";
  }
  if (!entry.wasFaceted && (entry.rating === "integral" || entry.rating === "prevalent")) {
    return "rgba(16, 185, 129, 0.12)";
  }
  return undefined;
}

function FactCoverageGrid({ report }: FactCoverageGridProps) {
  if (!report?.entries?.length) return null;

  const entries = report.entries;
  const cols = useMemo(
    () => [entries.slice(0, 6), entries.slice(6, 12), entries.slice(12, 18)],
    [entries]
  );

  return (
    <div className="ref-tab-fcg">
      <div className="ref-tab-fcg-header">
        <span className="ref-tab-fcg-title">Canon Facts</span>
        <span className="ref-tab-fcg-legend">
          {RATING_ORDER.map((r) => (
            <span key={r}>
              <span
                className="ref-tab-fcg-legend-symbol"
                style={{ "--ref-legend-color": RATING_STYLE[r].color } as React.CSSProperties}
              >
                {RATING_STYLE[r].symbol}
              </span>{" "}
              {r}
            </span>
          ))}
          <span>
            <span className="ref-tab-fcg-legend-yes">yes</span>/
            <span className="ref-tab-fcg-legend-no">no</span> = included
          </span>
        </span>
      </div>
      <div className="ref-tab-fcg-grid">
        {cols.map((col, ci) => (
          <div key={ci}>
            {col.map((entry) => {
              const rs = RATING_STYLE[entry.rating as FactCoverageRating] || RATING_STYLE.missing;
              const bg = computeEntryBackground(entry);
              return (
                <div
                  key={entry.factId}
                  className={`ref-tab-fcg-entry ${bg ? "ref-tab-fcg-entry-dynamic" : ""}`}
                  // eslint-disable-next-line local/no-inline-styles -- dynamic background from mismatch logic
                  style={bg ? { "--ref-entry-bg": bg, "--ref-entry-radius": "3px" } as React.CSSProperties : undefined}
                  title={entry.factText}
                >
                  <span
                    className="ref-tab-fcg-symbol ref-tab-fcg-symbol-dynamic"
                    style={{ "--ref-symbol-color": rs.color } as React.CSSProperties}
                  >
                    {rs.symbol}
                  </span>
                  <span className="ref-tab-fcg-fact-id">{entry.factId}</span>
                  { }
                  <span
                    className={`ref-tab-fcg-included ${entry.wasFaceted ? "ref-tab-fcg-included-yes" : "ref-tab-fcg-included-no"}`}
                  >
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

// ============================================================================
// Fact Coverage Viewer
// ============================================================================

interface FactCoverageViewerProps {
  report: FactCoverageReport;
  generatedAt?: number;
}

function FactCoverageViewer({ report, generatedAt }: FactCoverageViewerProps) {
  const { expanded, headerProps } = useExpandBoolean();

  if (!report?.entries?.length) return null;

  const counts: Record<FactCoverageRating, number> = { integral: 0, prevalent: 0, mentioned: 0, missing: 0 };
  for (const e of report.entries) {
    if (counts[e.rating as FactCoverageRating] !== undefined) counts[e.rating as FactCoverageRating]++;
  }

  const sorted = useMemo(
    () =>
      [...report.entries].sort(
        (a, b) => RATING_ORDER.indexOf(a.rating as FactCoverageRating) - RATING_ORDER.indexOf(b.rating as FactCoverageRating)
      ),
    [report.entries]
  );

  const summaryText = useMemo(
    () =>
      RATING_ORDER.map((r) =>
        counts[r] > 0 ? `${RATING_STYLE[r].symbol} ${counts[r]} ${r}` : null
      )
        .filter(Boolean)
        .join("  "),
    // counts is derived from report.entries, so report.entries is the correct dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [report.entries]
  );

  return (
    <div className="ilu-container ref-tab-fcv">
      <div
        className={`ilu-container-header ref-tab-fcv-header ${expanded ? "ref-tab-fcv-header-expanded" : ""}`}
        {...headerProps}
      >
        <span className="ref-tab-synth-toggle">{expanded ? "\u25BC" : "\u25B6"}</span>
        <span className="ref-tab-synth-title">Fact Coverage</span>
        <span className="ref-tab-synth-meta">{summaryText}</span>
      </div>

      {expanded && (
        <div className="ref-tab-fcv-body">
          {sorted.map((entry) => {
            const rs = RATING_STYLE[entry.rating as FactCoverageRating] || RATING_STYLE.missing;
            return (
              <div key={entry.factId} className="ref-tab-fcv-entry">
                <div className="ref-tab-fcv-entry-row">
                  <span
                    className="ref-tab-fcv-symbol ref-tab-fcv-symbol-dynamic"
                    style={{ "--ref-symbol-color": rs.color } as React.CSSProperties}
                    title={rs.label}
                  >
                    {rs.symbol}
                  </span>
                  <span className="ref-tab-fcv-fact-text" title={entry.factText}>
                    {entry.factText}
                  </span>
                  {entry.wasFaceted && (
                    <span
                      className="ref-tab-fcv-faceted"
                      title="This fact was in the faceted set for this chronicle"
                    >
                      &#x2B21;
                    </span>
                  )}
                </div>
                {entry.evidence && <div className="ref-tab-fcv-evidence">{entry.evidence}</div>}
              </div>
            );
          })}
          {generatedAt && (
            <div className="ref-tab-fcv-meta">
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
// Temporal Context Editor
// ============================================================================

interface TemporalContextEntity {
  id: string;
  name?: string;
  kind?: string;
  culture?: string;
  createdAt?: number;
}

interface TemporalContextEditorProps {
  item: ChronicleRecord;
  eras: EraTemporalInfo[];
  events: Array<{ id: string; tick?: number; [key: string]: unknown }>;
  entities: TemporalContextEntity[];
  onUpdateTemporalContext?: (eraId: string) => void;
  onTemporalCheck?: () => void;
  temporalCheckRunning: boolean;
  isGenerating: boolean;
}

function TemporalTimeline({
  hasTimelineData,
  timelineEvents,
  eraRanges,
  containerWidth,
  castMarkers,
  focalEraId,
  timelineExtent,
}: {
  hasTimelineData: boolean;
  timelineEvents: ReturnType<typeof prepareTimelineEvents>;
  eraRanges: ReturnType<typeof getEraRanges>;
  containerWidth: number;
  castMarkers: ReturnType<typeof prepareCastMarkers>;
  focalEraId: string;
  timelineExtent: [number, number];
}) {
  const noopToggle = useCallback(() => {}, []);

  if (!hasTimelineData) {
    return (
      <div className="ref-tab-temporal-no-events">
        No events selected — timeline will appear after event curation
      </div>
    );
  }

  return (
    <div className="ref-tab-temporal-timeline">
      <div className="ref-tab-temporal-timeline-heading">
        SELECTED EVENTS TIMELINE ({timelineEvents.length} events)
      </div>
      <NarrativeTimeline
        events={timelineEvents}
        eraRanges={eraRanges}
        width={Math.max(containerWidth - 32, 300)}
        height={castMarkers.length > 0 ? 180 : 150}
        onToggleEvent={noopToggle}
        focalEraId={focalEraId}
        extent={timelineExtent}
        castMarkers={castMarkers}
      />
    </div>
  );
}

function TemporalCheckReport({ item }: { item: ChronicleRecord }) {
  const handleExport = useCallback(() => {
    if (!item.temporalCheckReport) return;
    const blob = new Blob([item.temporalCheckReport], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `temporal-check-${item.chronicleId.slice(0, 20)}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [item.temporalCheckReport, item.chronicleId]);

  if (!item.temporalCheckReport) return null;

  return (
    <div className="ref-tab-temporal-report">
      <div className="ref-tab-temporal-report-header">
        <span className="ref-tab-temporal-report-title">Alignment Check Report</span>
        <div className="ref-tab-temporal-report-actions">
          {item.temporalCheckReportGeneratedAt && (
            <span className="ref-tab-temporal-report-date">
              {new Date(item.temporalCheckReportGeneratedAt).toLocaleString()}
            </span>
          )}
          <button onClick={handleExport} className="ref-tab-temporal-export-btn">
            Export
          </button>
        </div>
      </div>
      <div className="ref-tab-temporal-report-body">{item.temporalCheckReport}</div>
    </div>
  );
}

function TemporalContextEditor({
  item,
  eras,
  events,
  entities,
  onUpdateTemporalContext,
  onTemporalCheck,
  temporalCheckRunning,
  isGenerating,
}: TemporalContextEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Derive selectedEraId from props without effect-based setState
  const focalEraIdFromContext = item.temporalContext?.focalEra?.id;
  const derivedEraId = focalEraIdFromContext || availableEras[0]?.id || "";
  const [selectedEraId, setSelectedEraId] = useState(derivedEraId);

  // Sync when the derived value changes (using a ref to avoid effect-setState)
  const prevDerivedRef = useRef(derivedEraId);
  if (prevDerivedRef.current !== derivedEraId) {
    prevDerivedRef.current = derivedEraId;
    setSelectedEraId(derivedEraId);
  }

  const focalEra = item.temporalContext?.focalEra;
  const tickRange = item.temporalContext?.chronicleTickRange;

  // Build entity map for cast markers
  const entityMap = useMemo(() => {
    if (!entities) return new Map<string, TemporalContextEntity>();
    return new Map(entities.map((e) => [e.id, e]));
  }, [entities]);

  // Filter events to only those selected for this chronicle
  const selectedEventIds = useMemo(
    () => new Set(item.selectedEventIds || []),
    [item.selectedEventIds]
  );

  // Build timeline events
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
  const timelineExtent = useMemo((): [number, number] => {
    if (availableEras.length === 0) return [0, 100];
    return getTimelineExtent(availableEras);
  }, [availableEras]);

  // Build cast markers from role assignments
  const castMarkers = useMemo(() => {
    if (!item.roleAssignments || item.roleAssignments.length === 0) return [];
    const entryPointEntity = item.entrypointId ? entityMap.get(item.entrypointId) : null;
    const markers = prepareCastMarkers(item.roleAssignments, entityMap, entryPointEntity, null);
    return markers.filter((m) => typeof m.createdAt === "number" && !Number.isNaN(m.createdAt));
  }, [item.roleAssignments, item.entrypointId, entityMap]);

  const hasTimelineData = timelineEvents.length > 0 || castMarkers.length > 0;

  const handleEraChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedEraId(event.target.value);
  }, []);

  const handleUpdateClick = useCallback(() => {
    onUpdateTemporalContext?.(selectedEraId);
  }, [onUpdateTemporalContext, selectedEraId]);

  const checkDisabled = isGenerating || temporalCheckRunning || !item.assembledContent;

  return (
    <div ref={containerRef} className="ref-tab-temporal">
      <div className="ref-tab-temporal-title">Temporal Context</div>
      {availableEras.length === 0 ? (
        <div className="ref-tab-temporal-empty">No eras available for this world.</div>
      ) : (
        <>
          {onUpdateTemporalContext && (
            <div className="ref-tab-temporal-controls">
              <div className="ref-tab-temporal-label">Focal Era</div>
              <select
                value={selectedEraId}
                onChange={handleEraChange}
                className="ref-tab-temporal-select"
              >
                {availableEras.map((era) => (
                  <option key={era.id} value={era.id}>
                    {era.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleUpdateClick}
                disabled={!selectedEraId || isGenerating}
                className={`ref-tab-temporal-update-btn ${!selectedEraId || isGenerating ? "ref-tab-temporal-update-btn-disabled" : "ref-tab-temporal-update-btn-enabled"}`}
              >
                Update Era
              </button>
            </div>
          )}
          <div className="ref-tab-temporal-info">
            <div>
              <span className="ref-tab-temporal-info-label">Current:</span>{" "}
              {focalEra?.name || "Not set"}
            </div>
            {focalEra?.summary && (
              <div>
                <span className="ref-tab-temporal-info-label">Era Summary:</span> {focalEra.summary}
              </div>
            )}
            {item.temporalContext?.temporalDescription && (
              <div>
                <span className="ref-tab-temporal-info-label">Temporal Scope:</span>{" "}
                {item.temporalContext.temporalDescription}
              </div>
            )}
            {tickRange && (
              <div>
                <span className="ref-tab-temporal-info-label">Tick Range:</span> {tickRange[0]}
                &ndash;{tickRange[1]}
              </div>
            )}
            {typeof item.temporalContext?.isMultiEra === "boolean" && (
              <div>
                <span className="ref-tab-temporal-info-label">Multi-era:</span>{" "}
                {item.temporalContext.isMultiEra ? "Yes" : "No"}
              </div>
            )}
          </div>

          <TemporalTimeline
            hasTimelineData={hasTimelineData}
            timelineEvents={timelineEvents}
            eraRanges={eraRanges}
            containerWidth={containerWidth}
            castMarkers={castMarkers}
            focalEraId={focalEra?.id || selectedEraId}
            timelineExtent={timelineExtent}
          />

          {/* Temporal Alignment Check */}
          {item.perspectiveSynthesis?.temporalNarrative && (
            <div className="ref-tab-temporal-narrative">
              <div className="ref-tab-temporal-narrative-header">
                <div className="ref-tab-temporal-narrative-title">TEMPORAL NARRATIVE</div>
                <button
                  onClick={onTemporalCheck}
                  disabled={checkDisabled}
                  title="Check if focal era / temporal narrative misalignment affected the chronicle output"
                  className={`ref-tab-temporal-check-btn ${checkDisabled ? "ref-tab-temporal-check-btn-disabled" : "ref-tab-temporal-check-btn-enabled"}`}
                >
                  {temporalCheckRunning ? "Checking..." : "Temporal Check"}
                </button>
              </div>
              <div className="ref-tab-temporal-narrative-text">
                {item.perspectiveSynthesis.temporalNarrative}
              </div>

              <TemporalCheckReport item={item} />
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

interface ReferenceTabSeedData {
  narrativeStyleId: string;
  narrativeStyleName?: string;
  entrypointId?: string;
  entrypointName?: string;
  narrativeDirection?: string;
  roleAssignments: Array<{
    role: string;
    entityId: string;
    entityName: string;
    entityKind: string;
    isPrimary: boolean;
  }>;
  selectedEventIds: string[];
  selectedRelationshipIds: string[];
  temporalContext?: {
    focalEra?: { id: string; name: string; summary?: string };
    chronicleTickRange?: [number, number];
    temporalScope?: string;
    isMultiEra?: boolean;
    touchedEraIds?: string[];
    temporalDescription?: string;
  };
}

interface ReferenceTabProps {
  item: ChronicleRecord;
  eras: EraTemporalInfo[];
  events: Array<{ id: string; tick?: number; [key: string]: unknown }>;
  entities: TemporalContextEntity[];
  isGenerating: boolean;
  onUpdateTemporalContext?: (eraId: string) => void;
  onTemporalCheck?: () => void;
  temporalCheckRunning: boolean;
  seedData: ReferenceTabSeedData;
}

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
}: ReferenceTabProps) {
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
