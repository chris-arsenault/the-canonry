/**
 * CoveragePanel - Fact usage coverage across chronicles
 *
 * Shows a matrix of chronicle -> fact selections and fact usage totals.
 */

import { useMemo, useEffect, useState, useCallback } from "react";
import { getChroniclesForSimulation } from "../lib/db/chronicleRepository";

const STORAGE_KEY = "illuminator:coverageChronicleToggles";

const normalizeFact = (fact, index) => {
  if (!fact) return null;
  const id = String(fact.id || `fact_${index}`).trim();
  if (!id) return null;
  const type = fact.type || "world_truth";
  const text =
    typeof fact.text === "string" ? fact.text : fact.text != null ? String(fact.text) : "";
  return {
    id,
    text,
    type,
    required: type === "generation_constraint" ? false : Boolean(fact.required),
    disabled: Boolean(fact.disabled),
  };
};

const sortChronicles = (a, b) => {
  const aTime = a.createdAt || 0;
  const bTime = b.createdAt || 0;
  if (aTime !== bTime) return bTime - aTime;
  return String(a.title || "").localeCompare(String(b.title || ""));
};

// ============================================================================
// Word Count Histogram
// ============================================================================

const HISTOGRAM_BUCKETS = [
  { label: "<300", min: 0, max: 299 },
  { label: "300–800", min: 300, max: 799 },
  { label: "800–1.5k", min: 800, max: 1499 },
  { label: "1.5k–3k", min: 1500, max: 2999 },
  { label: "3k+", min: 3000, max: Infinity },
];

function WordCountHistogram({ chronicles }) {
  const data = useMemo(() => {
    const buckets = HISTOGRAM_BUCKETS.map((b) => ({ ...b, story: 0, document: 0 }));
    for (const c of chronicles) {
      const text = c.finalContent || c.assembledContent || "";
      const wc = text.split(/\s+/).filter(Boolean).length;
      const fmt = c.format === "document" ? "document" : "story";
      const bucket = buckets.find((b) => wc >= b.min && wc <= b.max);
      if (bucket) bucket[fmt]++;
    }
    const maxCount = Math.max(1, ...buckets.map((b) => b.story + b.document));
    return { buckets, maxCount };
  }, [chronicles]);

  if (!chronicles.length) return null;

  return (
    <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-color)" }}>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: "10px",
        }}
      >
        Word Count Distribution
        <span style={{ fontWeight: 400, textTransform: "none", marginLeft: "8px" }}>
          {chronicles.length} chronicles
        </span>
        <span
          style={{ fontWeight: 400, textTransform: "none", marginLeft: "12px", fontSize: "10px" }}
        >
          <span style={{ color: "#3b82f6" }}>■</span> story
          <span style={{ marginLeft: "8px", color: "#f59e0b" }}>■</span> document
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "60px" }}>
        {data.buckets.map((bucket) => {
          const total = bucket.story + bucket.document;
          const height = total > 0 ? Math.max(4, Math.round((total / data.maxCount) * 56)) : 0;
          const storyPct = total > 0 ? (bucket.story / total) * 100 : 0;
          return (
            <div
              key={bucket.label}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2px",
              }}
            >
              {total > 0 && (
                <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{total}</span>
              )}
              <div
                title={`${bucket.label}: ${bucket.story} story, ${bucket.document} document`}
                style={{
                  width: "100%",
                  height: `${height}px`,
                  borderRadius: "2px",
                  background:
                    total === 0
                      ? "var(--border-color)"
                      : `linear-gradient(to top, #3b82f6 ${storyPct}%, #f59e0b ${storyPct}%)`,
                  minHeight: total > 0 ? "4px" : "1px",
                  opacity: total === 0 ? 0.3 : 1,
                }}
              />
              <span style={{ fontSize: "9px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {bucket.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CoveragePanel({ worldContext, simulationRunId, onWorldContextChange }) {
  const [chronicles, setChronicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const [disabledChronicles, setDisabledChronicles] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {}
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(disabledChronicles));
    } catch {}
  }, [disabledChronicles]);

  useEffect(() => {
    if (!simulationRunId) return;
    let cancelled = false;
    setLoading(true);
    getChroniclesForSimulation(simulationRunId)
      .then((records) => {
        if (!cancelled) setChronicles(records);
      })
      .catch((err) => {
        console.error("[Coverage] Failed to load chronicles:", err);
        if (!cancelled) setChronicles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [simulationRunId]);

  const toggleChronicle = useCallback((chronicleId) => {
    setDisabledChronicles((prev) => ({
      ...prev,
      [chronicleId]: !prev[chronicleId],
    }));
  }, []);

  const toggleFact = useCallback(
    (factId) => {
      if (!onWorldContextChange) return;
      const rawFacts = worldContext?.canonFactsWithMetadata || [];
      const updated = rawFacts.map((f) =>
        f.id === factId
          ? { ...f, disabled: !f.disabled, required: !f.disabled ? false : f.required }
          : f
      );
      onWorldContextChange({ canonFactsWithMetadata: updated });
    },
    [onWorldContextChange, worldContext?.canonFactsWithMetadata]
  );

  const analysis = useMemo(() => {
    const rawFacts = worldContext?.canonFactsWithMetadata || [];
    const normalizedWorldFacts = rawFacts
      .map((fact, index) => normalizeFact(fact, index))
      .filter(Boolean);

    const chronicleList = [...(chronicles || [])].sort(sortChronicles);
    const facts = normalizedWorldFacts.filter((fact) => fact.type !== "generation_constraint");
    const enabledFacts = facts.filter((fact) => !fact.disabled);
    const factIdSet = new Set(enabledFacts.map((fact) => fact.id));
    const allFactIdSet = new Set(facts.map((fact) => fact.id));

    const rows = chronicleList.map((chronicle) => {
      const synthesis = chronicle.perspectiveSynthesis || null;
      const facetIds = new Set();
      let unparsedCount = 0;
      for (const facet of synthesis?.facets || []) {
        if (!facet?.factId) continue;
        if (allFactIdSet.has(facet.factId)) {
          facetIds.add(facet.factId);
        } else {
          unparsedCount += 1;
        }
      }

      return {
        chronicle,
        synthesis,
        facetIds,
        unparsedCount,
        isIncluded: !disabledChronicles[chronicle.chronicleId],
      };
    });

    const factTotals = new Map(facts.map((fact) => [fact.id, 0]));
    const disabledFactIds = new Set(facts.filter((f) => f.disabled).map((f) => f.id));

    let totalSelections = 0;
    let unparsedTotal = 0;
    let includedCount = 0;

    const processedRows = rows.map((row) => {
      if (row.isIncluded) {
        includedCount += 1;
        for (const factId of row.facetIds) {
          factTotals.set(factId, (factTotals.get(factId) || 0) + 1);
        }
        let enabledHits = 0;
        for (const factId of row.facetIds) {
          if (!disabledFactIds.has(factId)) enabledHits += 1;
        }
        totalSelections += enabledHits;
        unparsedTotal += row.unparsedCount || 0;
      }

      let rowEnabledTotal = 0;
      for (const factId of row.facetIds) {
        if (!disabledFactIds.has(factId)) rowEnabledTotal += 1;
      }

      return {
        ...row,
        rowTotal: rowEnabledTotal,
      };
    });

    const chroniclesWithSynthesis = processedRows.filter((row) => row.synthesis).length;
    const unusedFacts = enabledFacts.filter((fact) => (factTotals.get(fact.id) || 0) === 0).length;
    const disabledFactCount = facts.filter((fact) => fact.disabled).length;
    const constraintCount = normalizedWorldFacts.filter(
      (fact) => fact.type === "generation_constraint"
    ).length;

    return {
      facts,
      factTotals,
      rows: processedRows,
      totalSelections,
      unparsedTotal,
      includedCount,
      chroniclesWithSynthesis,
      chronicleCount: processedRows.length,
      unusedFacts,
      disabledFactCount,
      constraintCount,
    };
  }, [chronicles, worldContext, disabledChronicles]);

  const {
    facts,
    factTotals,
    rows,
    totalSelections,
    unparsedTotal,
    includedCount,
    chroniclesWithSynthesis,
    chronicleCount,
    unusedFacts,
    disabledFactCount,
    constraintCount,
  } = analysis;

  // Fact coverage analysis stats (from LLM ratings)
  const coverageStats = useMemo(() => {
    const chroniclesWithReport = chronicles.filter((c) => c.factCoverageReport?.entries?.length);
    if (!chroniclesWithReport.length || !facts.length) return null;

    // Per-fact aggregation: count how many chronicles rated each fact at each level
    const perFact = new Map();
    for (const fact of facts) {
      perFact.set(fact.id, { integral: 0, prevalent: 0, mentioned: 0, missing: 0, total: 0 });
    }

    for (const chronicle of chroniclesWithReport) {
      for (const entry of chronicle.factCoverageReport.entries) {
        const agg = perFact.get(entry.factId);
        if (agg && entry.rating) {
          if (agg[entry.rating] !== undefined) agg[entry.rating]++;
          agg.total++;
        }
      }
    }

    // Global totals
    let totalEntries = 0;
    const globalCounts = { integral: 0, prevalent: 0, mentioned: 0, missing: 0 };
    for (const [, agg] of perFact) {
      for (const r of ["integral", "prevalent", "mentioned", "missing"]) {
        globalCounts[r] += agg[r];
      }
      totalEntries += agg.total;
    }

    return {
      chroniclesAnalyzed: chroniclesWithReport.length,
      totalEntries,
      globalCounts,
      perFact,
    };
  }, [chronicles, facts]);

  const disableAll = useCallback(() => {
    const next = {};
    for (const row of rows) {
      next[row.chronicle.chronicleId] = true;
    }
    setDisabledChronicles(next);
  }, [rows]);

  const enableAll = useCallback(() => {
    setDisabledChronicles({});
  }, []);

  if (!simulationRunId) {
    return (
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Coverage</h2>
        </div>
        <div style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: "12px" }}>
          No active simulation run.
        </div>
      </div>
    );
  }

  if (loading && chronicleCount === 0) {
    return (
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Coverage</h2>
        </div>
        <div style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: "12px" }}>
          Loading chronicles...
        </div>
      </div>
    );
  }

  if (!facts.length) {
    return (
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Coverage</h2>
          <span className="illuminator-card-subtitle">Perspective synthesis fact coverage</span>
        </div>
        <div style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: "12px" }}>
          No canon facts configured. Add facts in the Context tab to enable coverage tracking.
        </div>
      </div>
    );
  }

  return (
    <div className="illuminator-card">
      <div
        className="illuminator-card-header"
        onClick={() => setExpanded((prev) => !prev)}
        style={{ cursor: "pointer", userSelect: "none" }}
      >
        <span style={{ marginRight: "8px", fontSize: "10px", color: "var(--text-muted)" }}>
          {expanded ? "\u25BC" : "\u25B6"}
        </span>
        <h2 className="illuminator-card-title">Lore Coverage</h2>
        {!expanded && (
          <span className="illuminator-card-subtitle" style={{ marginLeft: "8px" }}>
            {chronicleCount} chronicles, {facts.length - disabledFactCount} facts
            {unusedFacts > 0 ? `, ${unusedFacts} unused` : ""}
          </span>
        )}
      </div>

      {expanded && (
        <>
          <div className="illuminator-coverage-summary">
            <div>
              <strong>Chronicles</strong>: {chronicleCount} total, {includedCount} counted,{" "}
              {chroniclesWithSynthesis} with synthesis
            </div>
            <div>
              <strong>Facts</strong>: {facts.length - disabledFactCount} active ({unusedFacts}{" "}
              unused){disabledFactCount > 0 && `, ${disabledFactCount} disabled`}
            </div>
            <div>
              <strong>Total selections</strong>: {totalSelections}
            </div>
            <div>
              <strong>Unparsed facets</strong>: {unparsedTotal}
            </div>
            {constraintCount > 0 && (
              <div>
                <strong>Constraints excluded</strong>: {constraintCount}
              </div>
            )}
            <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
              <button
                className="illuminator-button illuminator-button-secondary"
                style={{ padding: "4px 10px", fontSize: "11px" }}
                onClick={enableAll}
              >
                Count all
              </button>
              <button
                className="illuminator-button illuminator-button-secondary"
                style={{ padding: "4px 10px", fontSize: "11px" }}
                onClick={disableAll}
              >
                Count none
              </button>
            </div>
          </div>

          <div className="illuminator-coverage-table">
            <table>
              <thead>
                <tr>
                  <th className="illuminator-coverage-sticky">Chronicle</th>
                  <th className="illuminator-coverage-toggle-col">Counted</th>
                  {facts.map((fact) => (
                    <th
                      key={fact.id}
                      title={`${fact.id}${fact.text ? `: ${fact.text}` : ""}${fact.required ? " (required)" : ""}${fact.disabled ? " (disabled — click to enable)" : " (click to disable)"}`}
                      onClick={onWorldContextChange ? () => toggleFact(fact.id) : undefined}
                      style={onWorldContextChange ? { cursor: "pointer" } : undefined}
                    >
                      <div
                        className="illuminator-coverage-fact-header"
                        style={fact.disabled ? { opacity: 0.4 } : undefined}
                      >
                        <span className="illuminator-coverage-fact-id">{fact.id}</span>
                        {fact.required && <span className="illuminator-coverage-required">R</span>}
                        {fact.disabled && (
                          <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>off</span>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="illuminator-coverage-unparsed-col">Unparsed</th>
                  <th className="illuminator-coverage-total-col">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="illuminator-coverage-total-row">
                  <td className="illuminator-coverage-sticky">Total usage</td>
                  <td className="illuminator-coverage-toggle-col">{includedCount}</td>
                  {facts.map((fact) => (
                    <td
                      key={`total-${fact.id}`}
                      style={fact.disabled ? { opacity: 0.3 } : undefined}
                    >
                      {factTotals.get(fact.id) || 0}
                    </td>
                  ))}
                  <td className="illuminator-coverage-unparsed-col">{unparsedTotal}</td>
                  <td className="illuminator-coverage-total-col">{totalSelections}</td>
                </tr>
                {rows.map((row) => {
                  const chronicle = row.chronicle;
                  const hasSynthesis = Boolean(row.synthesis);
                  const rowClass = row.isIncluded ? "" : "illuminator-coverage-row-disabled";
                  return (
                    <tr key={chronicle.chronicleId} className={rowClass}>
                      <td className="illuminator-coverage-sticky">
                        <div className="illuminator-coverage-chronicle-title">
                          {chronicle.title || "Untitled Chronicle"}
                        </div>
                        <div className="illuminator-coverage-chronicle-meta">
                          {chronicle.chronicleId}
                          {!hasSynthesis && " • no synthesis"}
                        </div>
                      </td>
                      <td className="illuminator-coverage-toggle-col">
                        <input
                          type="checkbox"
                          checked={row.isIncluded}
                          onChange={() => toggleChronicle(chronicle.chronicleId)}
                          aria-label={`Toggle counting for ${chronicle.title || chronicle.chronicleId}`}
                        />
                      </td>
                      {facts.map((fact) => (
                        <td
                          key={`${chronicle.chronicleId}-${fact.id}`}
                          style={fact.disabled ? { opacity: 0.3 } : undefined}
                        >
                          {row.facetIds.has(fact.id) ? (
                            <span className="illuminator-coverage-hit" />
                          ) : (
                            <span className="illuminator-coverage-miss" />
                          )}
                        </td>
                      ))}
                      <td className="illuminator-coverage-unparsed-col">
                        {row.unparsedCount || 0}
                      </td>
                      <td className="illuminator-coverage-total-col">{row.rowTotal || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Word Count Histogram */}
          {chronicleCount > 0 && (
            <WordCountHistogram
              chronicles={chronicles.filter((c) => !disabledChronicles[c.chronicleId])}
            />
          )}

          {/* Fact Coverage Analysis Stats */}
          {coverageStats && (
            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-color)" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginBottom: "10px",
                }}
              >
                Fact Coverage Analysis
                <span style={{ fontWeight: 400, textTransform: "none", marginLeft: "8px" }}>
                  {coverageStats.chroniclesAnalyzed} chronicles analyzed
                </span>
              </div>

              {/* Global summary bar */}
              <div style={{ display: "flex", gap: "16px", fontSize: "12px", marginBottom: "12px" }}>
                {[
                  { key: "integral", color: "#10b981" },
                  { key: "prevalent", color: "#3b82f6" },
                  { key: "mentioned", color: "#f59e0b" },
                  { key: "missing", color: "var(--text-muted)" },
                ].map(({ key, color }) => {
                  const count = coverageStats.globalCounts[key];
                  const pct =
                    coverageStats.totalEntries > 0
                      ? Math.round((count / coverageStats.totalEntries) * 100)
                      : 0;
                  return (
                    <span key={key} style={{ color }}>
                      <strong>{pct}%</strong> {key}{" "}
                      <span style={{ color: "var(--text-muted)" }}>({count})</span>
                    </span>
                  );
                })}
              </div>

              {/* Per-fact breakdown table */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "4px 8px 4px 0",
                        color: "var(--text-muted)",
                        fontWeight: 500,
                      }}
                    >
                      Fact
                    </th>
                    <th
                      style={{
                        textAlign: "center",
                        padding: "4px 6px",
                        color: "#10b981",
                        fontWeight: 500,
                      }}
                    >
                      Integral
                    </th>
                    <th
                      style={{
                        textAlign: "center",
                        padding: "4px 6px",
                        color: "#3b82f6",
                        fontWeight: 500,
                      }}
                    >
                      Prevalent
                    </th>
                    <th
                      style={{
                        textAlign: "center",
                        padding: "4px 6px",
                        color: "#f59e0b",
                        fontWeight: 500,
                      }}
                    >
                      Mentioned
                    </th>
                    <th
                      style={{
                        textAlign: "center",
                        padding: "4px 6px",
                        color: "var(--text-muted)",
                        fontWeight: 500,
                      }}
                    >
                      Missing
                    </th>
                    <th
                      style={{
                        textAlign: "center",
                        padding: "4px 6px",
                        color: "var(--text-muted)",
                        fontWeight: 500,
                      }}
                    >
                      Strength
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {facts.map((fact) => {
                    const agg = coverageStats.perFact.get(fact.id);
                    if (!agg || agg.total === 0) return null;
                    // Strength: weighted score 0-100 (integral=3, prevalent=2, mentioned=1, missing=0)
                    const strength = Math.round(
                      ((agg.integral * 3 + agg.prevalent * 2 + agg.mentioned * 1) /
                        (agg.total * 3)) *
                        100
                    );
                    const strengthColor =
                      strength >= 60 ? "#10b981" : strength >= 30 ? "#f59e0b" : "#ef4444";
                    return (
                      <tr key={fact.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                        <td
                          style={{
                            padding: "4px 8px 4px 0",
                            maxWidth: "200px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={fact.text}
                        >
                          {fact.id}
                        </td>
                        <td
                          style={{
                            textAlign: "center",
                            padding: "4px 6px",
                            color: agg.integral > 0 ? "#10b981" : "var(--text-muted)",
                          }}
                        >
                          {agg.integral}
                        </td>
                        <td
                          style={{
                            textAlign: "center",
                            padding: "4px 6px",
                            color: agg.prevalent > 0 ? "#3b82f6" : "var(--text-muted)",
                          }}
                        >
                          {agg.prevalent}
                        </td>
                        <td
                          style={{
                            textAlign: "center",
                            padding: "4px 6px",
                            color: agg.mentioned > 0 ? "#f59e0b" : "var(--text-muted)",
                          }}
                        >
                          {agg.mentioned}
                        </td>
                        <td
                          style={{
                            textAlign: "center",
                            padding: "4px 6px",
                            color: agg.missing > 0 ? "var(--text-primary)" : "var(--text-muted)",
                          }}
                        >
                          {agg.missing}
                        </td>
                        <td
                          style={{
                            textAlign: "center",
                            padding: "4px 6px",
                            fontWeight: 600,
                            color: strengthColor,
                          }}
                        >
                          {strength}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
