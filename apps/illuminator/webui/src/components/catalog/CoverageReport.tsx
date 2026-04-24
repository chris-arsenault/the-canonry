/**
 * CoverageReport — Per-field completeness and derivability analysis.
 *
 * Shows a table of metadata fields with present/missing/derivable counts.
 * Provides buttons to run deterministic fill, classify fill, and title fill.
 * Vision mode checkbox enables image-based classification (slower, handles no-prompt images).
 */

import React, { useState, useCallback, useEffect, useMemo } from "react";
import type { StyleLibrary } from "@canonry/world-schema";
import { analyzeCoverage, type CoverageReport as CoverageReportData } from "../../lib/catalogAnalysis";
import { runDeterministicFill, type FillResult } from "../../lib/catalogDeterministicFill";
import {
  runClassifyFill,
  runTitleFill,
  runSampleTitles,
  runRetitle,
  type LlmFillProgress,
  type LlmFillResult,
  type StyleIds,
  type StyleNameMap,
} from "../../lib/catalogLlmFill";
import { findMostSimilarPairs, type SimilarityReport, type SimilarityProgress } from "../../lib/catalogSimilarity";
import { db } from "../../lib/db/illuminatorDb";
import "./CoverageReport.css";

interface CoverageReportProps {
  projectId: string;
  styleLibrary?: StyleLibrary | null;
}

function getApiKey(): string {
  try {
    return localStorage.getItem("illuminator:anthropicApiKey") || "";
  } catch {
    return "";
  }
}

export default function CoverageReport({ projectId, styleLibrary }: Readonly<CoverageReportProps>) {
  const [report, setReport] = useState<CoverageReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fillResult, setFillResult] = useState<FillResult | null>(null);
  const [filling, setFilling] = useState(false);
  const [llmProgress, setLlmProgress] = useState<LlmFillProgress | null>(null);
  const [llmResult, setLlmResult] = useState<LlmFillResult | null>(null);
  const [llmFilling, setLlmFilling] = useState(false);
  const [activeFill, setActiveFill] = useState<"classify" | "title" | null>(null);
  const [lastFill, setLastFill] = useState<"classify" | "title" | null>(null);
  const [useVision, setUseVision] = useState(false);
  const [retitling, setRetitling] = useState(false);

  const styleIds: StyleIds | null = useMemo(() => {
    if (!styleLibrary) return null;
    return {
      artisticStyleIds: styleLibrary.artisticStyles.map((s) => s.id),
      compositionStyleIds: styleLibrary.compositionStyles.map((s) => s.id),
      colorPaletteIds: styleLibrary.colorPalettes.map((s) => s.id),
    };
  }, [styleLibrary]);

  const styleNames: StyleNameMap | null = useMemo(() => {
    if (!styleLibrary) return null;
    return {
      artistic: new Map(styleLibrary.artisticStyles.map((s) => [s.id, s.name])),
      composition: new Map(styleLibrary.compositionStyles.map((s) => [s.id, s.name])),
      palette: new Map(styleLibrary.colorPalettes.map((s) => [s.id, s.name])),
    };
  }, [styleLibrary]);

  const anyFilling = filling || llmFilling || retitling;

  const runScan = useCallback(async () => {
    setLoading(true);
    try {
      const data = await analyzeCoverage(projectId);
      setReport(data);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Auto-scan on mount
  useEffect(() => {
    runScan();
  }, [runScan]);

  const handleDeterministicFill = useCallback(async () => {
    setFilling(true);
    setFillResult(null);
    try {
      const result = await runDeterministicFill(projectId);
      setFillResult(result);
      const data = await analyzeCoverage(projectId);
      setReport(data);
    } finally {
      setFilling(false);
    }
  }, [projectId]);

  const handleClassifyFill = useCallback(async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      alert("Anthropic API key required. Set it in the Config tab.");
      return;
    }
    if (!styleIds) {
      alert("Style library not loaded. Cannot classify images without valid style IDs.");
      return;
    }
    setLlmFilling(true);
    setActiveFill("classify");
    setLastFill("classify");
    setLlmResult(null);
    setLlmProgress(null);
    try {
      const result = await runClassifyFill({
        projectId,
        apiKey,
        styleIds,
        useVision,
        onProgress: setLlmProgress,
      });
      setLlmResult(result);
      const data = await analyzeCoverage(projectId);
      setReport(data);
    } finally {
      setLlmFilling(false);
      setLlmProgress(null);
      setActiveFill(null);
    }
  }, [projectId, styleIds, useVision]);

  const handleTitleFill = useCallback(async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      alert("Anthropic API key required. Set it in the Config tab.");
      return;
    }
    if (!styleIds || !styleNames) {
      alert("Style library not loaded. Cannot generate titles without style context.");
      return;
    }
    setLlmFilling(true);
    setActiveFill("title");
    setLastFill("title");
    setLlmResult(null);
    setLlmProgress(null);
    try {
      const result = await runTitleFill({
        projectId,
        apiKey,
        styleIds,
        styleNames,
        useVision,
        onProgress: setLlmProgress,
      });
      setLlmResult(result);
      const data = await analyzeCoverage(projectId);
      setReport(data);
    } finally {
      setLlmFilling(false);
      setLlmProgress(null);
      setActiveFill(null);
    }
  }, [projectId, styleIds, styleNames, useVision]);

  // ── Per-image title operations ──────────────────────────────────────

  const [sampleTitling, setSampleTitling] = useState(false);
  const [sampleTitleResults, setSampleTitleResults] = useState<{ imageId: string; title: string; entityName?: string }[]>([]);
  const [simReport, setSimReport] = useState<SimilarityReport | null>(null);
  const [simRunning, setSimRunning] = useState(false);
  const [simProgress, setSimProgress] = useState<SimilarityProgress | null>(null);
  const [simThreshold, setSimThreshold] = useState(0.7);

  const handleExportTitles = useCallback(async () => {
    const allImages = await db.images.where("projectId").equals(projectId).toArray();
    const titles: { imageId: string; title: string; entityName?: string; imageType?: string }[] = [];
    for (const img of allImages) {
      const rec = img as unknown as Record<string, unknown>;
      if (rec.llmTitle && rec.title) {
        titles.push({
          imageId: rec.imageId as string,
          title: rec.title as string,
          entityName: (rec.entityName as string) || undefined,
          imageType: (rec.imageType as string) || undefined,
        });
      }
    }
    const blob = new Blob([JSON.stringify(titles, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `llm-titles-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [projectId]);

  const handleClearTitles = useCallback(async () => {
    const allImages = await db.images.where("projectId").equals(projectId).toArray();
    let cleared = 0;
    for (const img of allImages) {
      const rec = img as unknown as Record<string, unknown>;
      if (rec.llmTitle) {
        await db.images.update(rec.imageId as string, { llmTitle: false });
        cleared++;
      }
    }
    setSampleTitleResults([]);
    const data = await analyzeCoverage(projectId);
    setReport(data);
    console.log(`[CoverageReport] Cleared llmTitle on ${cleared} images`);
  }, [projectId]);

  const handleSimilarity = useCallback(async () => {
    setSimRunning(true);
    setSimReport(null);
    setSimProgress(null);
    try {
      const report = await findMostSimilarPairs(projectId, setSimProgress);
      setSimReport(report);
    } finally {
      setSimRunning(false);
      setSimProgress(null);
    }
  }, [projectId]);

  const handleTitle10 = useCallback(async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      alert("Anthropic API key required. Set it in the Config tab.");
      return;
    }
    if (!styleNames || !styleIds) {
      alert("Style library not loaded.");
      return;
    }

    // Find up to 10 candidates without llmTitle
    const allImages = await db.images.where("projectId").equals(projectId).toArray();
    const candidateIds: string[] = [];
    const entityNames = new Map<string, string>();
    for (const img of allImages) {
      if (candidateIds.length >= 10) break;
      const rec = img as unknown as Record<string, unknown>;
      if (!rec.llmTitle && (rec.finalPrompt || rec.originalPrompt) && rec.artisticStyleId && rec.compositionStyleId) {
        const id = rec.imageId as string;
        candidateIds.push(id);
        if (rec.entityName) entityNames.set(id, rec.entityName as string);
      }
    }
    if (candidateIds.length === 0) {
      alert("No eligible images found (all titled, or missing prompt/style data).");
      return;
    }

    setSampleTitling(true);
    setSampleTitleResults([]);
    try {
      const titles = await runSampleTitles(candidateIds, apiKey, styleNames);
      setSampleTitleResults(titles.map((t) => ({
        ...t,
        entityName: entityNames.get(t.imageId),
      })));
      const data = await analyzeCoverage(projectId);
      setReport(data);
    } finally {
      setSampleTitling(false);
    }
  }, [projectId, styleIds, styleNames]);

  if (loading && !report) {
    return <div className="cat-loading">Scanning images...</div>;
  }

  if (!report) {
    return <div className="cat-empty">No data available.</div>;
  }

  return (
    <div className="cov-report">
      <div className="cov-header">
        <h3>Image Catalog Coverage</h3>
        <span className="cov-total">{report.totalImages} images</span>
      </div>

      <table className="cov-table">
        <thead>
          <tr>
            <th>Field</th>
            <th title="Images with this field populated">Present</th>
            <th title="Images missing this field">Missing</th>
            <th title="Missing images where this field can be derived deterministically">Derivable</th>
            <th title="Where derivable values come from">Source</th>
            <th title="Still missing after deterministic fill">Remaining</th>
            <th title="Remaining images that have prompt data (LLM-fillable)">w/ Prompt</th>
            <th title="Remaining images with no prompt data">No Prompt</th>
          </tr>
        </thead>
        <tbody>
          {report.fields.map((f) => {
            const pct = report.totalImages > 0
              ? Math.round((f.present / report.totalImages) * 100)
              : 0;
            return (
              <tr key={f.field}>
                <td className="cov-field-name">{f.field}</td>
                <td className="cov-num">
                  {f.present}
                  <span className="cov-pct" title={`${pct}% complete`}>{pct}%</span>
                </td>
                <td className="cov-num cov-missing">{f.missing || "\u2014"}</td>
                <td className="cov-num cov-derivable">{f.derivable || "\u2014"}</td>
                <td className="cov-source">{f.derivable > 0 ? f.derivableSource : "\u2014"}</td>
                <td className="cov-num">{f.remainingAfterFill || "\u2014"}</td>
                <td className="cov-num">{f.remainingWithPrompt || "\u2014"}</td>
                <td className="cov-num cov-no-prompt">{f.remainingNoPrompt || "\u2014"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="cov-actions">
        <button
          className="cov-btn cov-btn-primary"
          onClick={handleDeterministicFill}
          disabled={anyFilling}
        >
          {filling ? "Filling..." : "Deterministic Fill"}
        </button>
        <button
          className="cov-btn cov-btn-primary"
          onClick={handleClassifyFill}
          disabled={anyFilling || !styleIds}
          title={!styleIds ? "Style library not loaded" : useVision ? "Vision mode: sends images (batch 5)" : "Text mode: uses prompts (batch 20)"}
        >
          {activeFill === "classify" ? "Classifying..." : "Classify Fill"}
        </button>
        <button
          className="cov-btn cov-btn-primary"
          onClick={handleTitleFill}
          disabled={anyFilling || sampleTitling || !styleIds}
          title={!styleIds ? "Style library not loaded" : useVision ? "Vision mode: sends images (batch 5)" : "Text mode: uses prompts (batch 50)"}
        >
          {activeFill === "title" ? "Titling..." : "Title Fill"}
        </button>
        <button
          className="cov-btn"
          onClick={handleTitle10}
          disabled={anyFilling || sampleTitling || !styleNames}
          title="Generate titles for 10 untitled images to preview results"
        >
          {sampleTitling ? "Titling…" : "Title 10"}
        </button>
        <button
          className="cov-btn"
          onClick={handleClearTitles}
          disabled={anyFilling || sampleTitling}
          title="Clear all LLM title flags (makes all images eligible for re-titling)"
        >
          Clear Titles
        </button>
        <button
          className="cov-btn"
          onClick={handleExportTitles}
          title="Export all LLM-generated titles as JSON"
        >
          Export Titles
        </button>
        <button
          className="cov-btn"
          onClick={handleSimilarity}
          disabled={simRunning || anyFilling}
          title="Find the 50 most similar title pairs by Levenshtein distance"
        >
          {simRunning ? "Analyzing…" : "Similarity"}
        </button>
        <label className="cov-vision-toggle" title="Send actual images to the model for classification. Slower and more expensive, but handles images with no prompt data.">
          <input
            type="checkbox"
            checked={useVision}
            onChange={(e) => setUseVision(e.target.checked)}
            disabled={llmFilling}
          />
          Vision mode
        </label>
        <button
          className="cov-btn"
          onClick={runScan}
          disabled={loading || anyFilling}
        >
          {loading ? "Scanning..." : "Refresh"}
        </button>
      </div>

      {llmProgress && (
        <div className="cov-fill-result">
          {activeFill === "title" ? "Title" : "Classify"}{" "}
          batch {llmProgress.currentBatch}/{llmProgress.totalBatches}
          {useVision ? " (vision)" : ""}
          {" \u2014 "}
          {llmProgress.processed}/{llmProgress.total} images processed,
          {" "}{llmProgress.updated} updated, {llmProgress.errors} errors
        </div>
      )}

      {fillResult && (
        <div className="cov-fill-result">
          <strong>Deterministic fill:</strong>{" "}
          {fillResult.updated} updated, {fillResult.skipped} unchanged, {fillResult.errors} errors
          {fillResult.details.length > 0 && fillResult.details.length <= 20 && (
            <details>
              <summary>Details ({fillResult.details.length} images)</summary>
              <ul className="cov-fill-details">
                {fillResult.details.map((d) => (
                  <li key={d.imageId}>
                    <code>{d.imageId.slice(0, 20)}</code>: {d.fieldsSet.join(", ")}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {fillResult.details.length > 20 && (
            <span className="cov-fill-summary">
              {" "}({fillResult.details.length} images updated — see console for details)
            </span>
          )}
        </div>
      )}

      {llmResult && (
        <div className="cov-fill-result">
          <strong>{lastFill === "title" ? "Title" : "Classify"} fill:</strong>{" "}
          {llmResult.updated} updated, {llmResult.skipped} unchanged, {llmResult.errors} errors
          {llmResult.details.length > 0 && llmResult.details.length <= 20 && (
            <details>
              <summary>Details ({llmResult.details.length} images)</summary>
              <ul className="cov-fill-details">
                {llmResult.details.map((d) => (
                  <li key={d.imageId}>
                    <code>{d.imageId.slice(0, 20)}</code>: {d.fieldsSet.join(", ")}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {llmResult.details.length > 20 && (
            <span className="cov-fill-summary">
              {" "}({llmResult.details.length} images updated — see console for details)
            </span>
          )}
        </div>
      )}

      {sampleTitleResults.length > 0 && (
        <div className="cov-fill-result cov-title-preview">
          <strong>Title preview ({sampleTitleResults.length}):</strong>
          <ul className="cov-title-list">
            {sampleTitleResults.map((r) => (
              <li key={r.imageId}>
                <span className="cov-title-value">{r.title}</span>
                {r.entityName && <span className="cov-title-entity"> — {r.entityName}</span>}
                <code className="cov-title-id">{r.imageId.slice(0, 16)}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {simProgress && (
        <div className="cov-fill-result">
          Comparing titles — {Math.round((simProgress.completed / simProgress.total) * 100)}%
          {" "}({simProgress.pairsFound} similar pairs found)
        </div>
      )}

      {simReport && (() => {
        const aboveThreshold = simReport.pairs.filter((p) => p.similarity >= simThreshold);
        const displayPairs = simReport.pairs.slice(0, 50);
        return (
          <div className="cov-fill-result cov-sim-report">
            <div className="cov-sim-header">
              <strong>Title similarity</strong>
              <span className="cov-sim-meta">
                {" "}{simReport.pairs.length} pairs above 50%
                {" "}({simReport.uniqueTitles} unique titles from {simReport.totalTitles} images)
              </span>
            </div>
            <div className="cov-sim-toolbar">
              <label className="cov-sim-threshold-label">
                Retitle above
                <select
                  className="cov-sim-threshold-select"
                  value={simThreshold}
                  onChange={(e) => setSimThreshold(Number(e.target.value))}
                >
                  <option value={0.9}>90%</option>
                  <option value={0.8}>80%</option>
                  <option value={0.7}>70%</option>
                  <option value={0.6}>60%</option>
                  <option value={0.5}>50%</option>
                </select>
                <span className="cov-sim-threshold-count">
                  {aboveThreshold.length} pair{aboveThreshold.length !== 1 ? "s" : ""}
                </span>
              </label>
              <button
                className="cov-btn cov-btn-primary"
                disabled={aboveThreshold.length === 0 || retitling || !styleNames}
                title={`Retitle one side of ${aboveThreshold.length} pairs above ${(simThreshold * 100).toFixed(0)}% — prefers the side with prompt data`}
                onClick={async () => {
                  const apiKey = getApiKey();
                  if (!apiKey) {
                    alert("Anthropic API key required. Set it in the Config tab.");
                    return;
                  }
                  if (!styleNames) return;

                  // Pick which side to retitle per pair:
                  // prefer the side WITH prompt (cheaper, no vision needed)
                  const retitleIds = new Set<string>();
                  for (const p of aboveThreshold) {
                    if (p.hasPromptA && !p.hasPromptB) {
                      retitleIds.add(p.idA);
                    } else if (!p.hasPromptA && p.hasPromptB) {
                      retitleIds.add(p.idB);
                    } else {
                      retitleIds.add(p.idB);
                    }
                  }

                  // Build corpus from existing titles (sample ~50 that are NOT being retitled)
                  const allImages = await db.images.where("projectId").equals(projectId).toArray();
                  const corpus: string[] = [];
                  for (const img of allImages) {
                    if (corpus.length >= 50) break;
                    const rec = img as unknown as Record<string, unknown>;
                    if (rec.llmTitle && rec.title && !retitleIds.has(rec.imageId as string)) {
                      corpus.push(rec.title as string);
                    }
                  }

                  setRetitling(true);
                  setLlmProgress(null);
                  setActiveFill("title");
                  try {
                    const result = await runRetitle({
                      imageIds: Array.from(retitleIds),
                      apiKey,
                      styleNames,
                      corpus,
                      onProgress: setLlmProgress,
                    });
                    setLlmResult(result);
                    setLastFill("title");
                    // Re-run similarity to see updated pairs
                    const simResult = await findMostSimilarPairs(projectId, setSimProgress);
                    setSimReport(simResult);
                    const data = await analyzeCoverage(projectId);
                    setReport(data);
                  } finally {
                    setRetitling(false);
                    setLlmProgress(null);
                    setActiveFill(null);
                  }
                }}
              >
                {retitling ? "Retitling…" : `Retitle ${aboveThreshold.length}`}
              </button>
            </div>
            <table className="cov-sim-table">
              <thead>
                <tr>
                  <th className="cov-sim-score">Sim</th>
                  <th>Title A</th>
                  <th>Title B</th>
                </tr>
              </thead>
              <tbody>
                {displayPairs.map((p, i) => (
                  <tr key={i} className={p.similarity >= simThreshold ? "cov-sim-above" : ""}>
                    <td className="cov-sim-score">{(p.similarity * 100).toFixed(0)}%</td>
                    <td className="cov-sim-title">{p.titleA}</td>
                    <td className="cov-sim-title">{p.titleB}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {simReport.pairs.length > 50 && (
              <div className="cov-sim-meta" style={{ marginTop: 6 }}>
                Showing top 50 of {simReport.pairs.length} pairs
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
