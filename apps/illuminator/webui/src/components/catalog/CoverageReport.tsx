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
  type LlmFillProgress,
  type LlmFillResult,
  type StyleIds,
  type StyleNameMap,
} from "../../lib/catalogLlmFill";
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

  const anyFilling = filling || llmFilling;

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
          disabled={anyFilling || !styleIds}
          title={!styleIds ? "Style library not loaded" : useVision ? "Vision mode: sends images (batch 5)" : "Text mode: uses prompts (batch 30)"}
        >
          {activeFill === "title" ? "Titling..." : "Title Fill"}
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
    </div>
  );
}
