/**
 * CoveragePanel - Fact usage coverage across chronicles
 *
 * Shows a matrix of chronicle -> fact selections and fact usage totals.
 */

import React, { useMemo, useEffect, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { getChroniclesForSimulation } from "../lib/db/chronicleRepository";
import "./CoveragePanel.css";

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
  { label: "300\u2013800", min: 300, max: 799 },
  { label: "800\u20131.5k", min: 800, max: 1499 },
  { label: "1.5k\u20133k", min: 1500, max: 2999 },
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
    <div className="cvp-histogram">
      <div className="cvp-histogram-title">
        Word Count Distribution
        <span className="cvp-histogram-subtitle">{chronicles.length} chronicles</span>
        <span className="cvp-histogram-legend">
          <span className="cvp-histogram-legend-story">{"\u25A0"}</span> story
          <span className="cvp-histogram-legend-document">{"\u25A0"}</span> document
        </span>
      </div>
      <div className="cvp-histogram-bars">
        {data.buckets.map((bucket) => {
          const total = bucket.story + bucket.document;
          const height = total > 0 ? Math.max(4, Math.round((total / data.maxCount) * 56)) : 0;
          const storyPct = total > 0 ? (bucket.story / total) * 100 : 0;
          return (
            <div key={bucket.label} className="cvp-histogram-bucket">
              {total > 0 && <span className="cvp-histogram-count">{total}</span>}
              <div
                title={`${bucket.label}: ${bucket.story} story, ${bucket.document} document`}
                className={`cvp-histogram-bar ${total === 0 ? "cvp-histogram-bar-empty" : ""}`}
                // eslint-disable-next-line local/no-inline-styles -- dynamic height/gradient from computed data
                style={{
                  height: `${height}px`,
                  background:
                    total === 0
                      ? undefined
                      : `linear-gradient(to top, #3b82f6 ${storyPct}%, #f59e0b ${storyPct}%)`,
                  minHeight: total > 0 ? "4px" : undefined,
                  opacity: total === 0 ? undefined : 1,
                }}
              />
              <span className="cvp-histogram-bucket-label">{bucket.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

WordCountHistogram.propTypes = {
  chronicles: PropTypes.array,
};

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
        <div className="cvp-empty-msg">No active simulation run.</div>
      </div>
    );
  }

  if (loading && chronicleCount === 0) {
    return (
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Coverage</h2>
        </div>
        <div className="cvp-empty-msg">Loading chronicles...</div>
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
        <div className="cvp-empty-msg">
          No canon facts configured. Add facts in the Context tab to enable coverage tracking.
        </div>
      </div>
    );
  }

  return (
    <div className="illuminator-card">
      <div
        className="illuminator-card-header cvp-header-clickable"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className="cvp-expand-icon">{expanded ? "\u25BC" : "\u25B6"}</span>
        <h2 className="illuminator-card-title">Lore Coverage</h2>
        {!expanded && (
          <span className="illuminator-card-subtitle cvp-collapsed-subtitle">
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
            <div className="cvp-summary-controls">
              <button
                className="illuminator-button illuminator-button-secondary cvp-summary-btn"
                onClick={enableAll}
              >
                Count all
              </button>
              <button
                className="illuminator-button illuminator-button-secondary cvp-summary-btn"
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
                      title={`${fact.id}${fact.text ? `: ${fact.text}` : ""}${fact.required ? " (required)" : ""}${fact.disabled ? " (disabled \u2014 click to enable)" : " (click to disable)"}`}
                      onClick={onWorldContextChange ? () => toggleFact(fact.id) : undefined}
                      className={onWorldContextChange ? "cvp-fact-header-clickable" : undefined}
                    >
                      <div
                        className={`illuminator-coverage-fact-header ${fact.disabled ? "cvp-fact-header-disabled" : ""}`}
                      >
                        <span className="illuminator-coverage-fact-id">{fact.id}</span>
                        {fact.required && <span className="illuminator-coverage-required">R</span>}
                        {fact.disabled && <span className="cvp-fact-disabled-label">off</span>}
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
                      className={fact.disabled ? "cvp-cell-disabled" : undefined}
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
                          {!hasSynthesis && " \u2022 no synthesis"}
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
                          className={fact.disabled ? "cvp-cell-disabled" : undefined}
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
            <div className="cvp-analysis">
              <div className="cvp-analysis-title">
                Fact Coverage Analysis
                <span className="cvp-analysis-subtitle">
                  {coverageStats.chroniclesAnalyzed} chronicles analyzed
                </span>
              </div>

              {/* Global summary bar */}
              <div className="cvp-analysis-summary">
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
                    <span
                      key={key}
                      // eslint-disable-next-line local/no-inline-styles -- dynamic color from rating type config
                      style={{ color }}
                    >
                      <strong>{pct}%</strong> {key}{" "}
                      <span className="cvp-color-muted">({count})</span>
                    </span>
                  );
                })}
              </div>

              {/* Per-fact breakdown table */}
              <table className="cvp-analysis-table">
                <thead>
                  <tr>
                    <th className="cvp-analysis-th-fact">Fact</th>
                    <th className="cvp-analysis-th-integral">Integral</th>
                    <th className="cvp-analysis-th-prevalent">Prevalent</th>
                    <th className="cvp-analysis-th-mentioned">Mentioned</th>
                    <th className="cvp-analysis-th-missing">Missing</th>
                    <th className="cvp-analysis-th-strength">Strength</th>
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
                      <tr key={fact.id}>
                        <td className="cvp-analysis-td-fact" title={fact.text}>
                          {fact.id}
                        </td>
                        <td
                          className={`cvp-analysis-td-center ${agg.integral > 0 ? "cvp-color-integral" : "cvp-color-muted"}`}
                        >
                          {agg.integral}
                        </td>
                        <td
                          className={`cvp-analysis-td-center ${agg.prevalent > 0 ? "cvp-color-prevalent" : "cvp-color-muted"}`}
                        >
                          {agg.prevalent}
                        </td>
                        <td
                          className={`cvp-analysis-td-center ${agg.mentioned > 0 ? "cvp-color-mentioned" : "cvp-color-muted"}`}
                        >
                          {agg.mentioned}
                        </td>
                        <td
                          className={`cvp-analysis-td-center ${agg.missing > 0 ? "cvp-color-primary" : "cvp-color-muted"}`}
                        >
                          {agg.missing}
                        </td>
                        <td
                          className="cvp-analysis-td-strength"
                          // eslint-disable-next-line local/no-inline-styles -- dynamic color from computed strength score
                          style={{ color: strengthColor }}
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

CoveragePanel.propTypes = {
  worldContext: PropTypes.object,
  simulationRunId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onWorldContextChange: PropTypes.func,
};
