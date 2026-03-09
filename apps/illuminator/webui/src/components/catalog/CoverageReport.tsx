/**
 * CoverageReport — Per-field completeness and derivability analysis.
 *
 * Shows a table of metadata fields with present/missing/derivable counts.
 * Provides buttons to run deterministic fill and LLM fill operations.
 */

import React, { useState, useCallback, useEffect } from "react";
import { analyzeCoverage, type CoverageReport as CoverageReportData } from "../../lib/catalogAnalysis";
import { runDeterministicFill, type FillResult } from "../../lib/catalogDeterministicFill";
import { runLlmFill, type LlmFillProgress, type LlmFillResult } from "../../lib/catalogLlmFill";
import "./CoverageReport.css";

interface CoverageReportProps {
  projectId: string;
}

function getApiKey(): string {
  try {
    return localStorage.getItem("illuminator:anthropicApiKey") || "";
  } catch {
    return "";
  }
}

export default function CoverageReport({ projectId }: Readonly<CoverageReportProps>) {
  const [report, setReport] = useState<CoverageReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fillResult, setFillResult] = useState<FillResult | null>(null);
  const [filling, setFilling] = useState(false);
  const [llmProgress, setLlmProgress] = useState<LlmFillProgress | null>(null);
  const [llmResult, setLlmResult] = useState<LlmFillResult | null>(null);
  const [llmFilling, setLlmFilling] = useState(false);

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

  const handleLlmFill = useCallback(async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      alert("Anthropic API key required. Set it in the Config tab.");
      return;
    }
    setLlmFilling(true);
    setLlmResult(null);
    setLlmProgress(null);
    try {
      const result = await runLlmFill(projectId, apiKey, setLlmProgress);
      setLlmResult(result);
      const data = await analyzeCoverage(projectId);
      setReport(data);
    } finally {
      setLlmFilling(false);
      setLlmProgress(null);
    }
  }, [projectId]);

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
                <td className="cov-num cov-missing">{f.missing || "—"}</td>
                <td className="cov-num cov-derivable">{f.derivable || "—"}</td>
                <td className="cov-source">{f.derivable > 0 ? f.derivableSource : "—"}</td>
                <td className="cov-num">{f.remainingAfterFill || "—"}</td>
                <td className="cov-num">{f.remainingWithPrompt || "—"}</td>
                <td className="cov-num cov-no-prompt">{f.remainingNoPrompt || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="cov-actions">
        <button
          className="cov-btn cov-btn-primary"
          onClick={handleDeterministicFill}
          disabled={filling || llmFilling}
        >
          {filling ? "Filling..." : "Run Deterministic Fill"}
        </button>
        <button
          className="cov-btn cov-btn-primary"
          onClick={handleLlmFill}
          disabled={llmFilling || filling}
        >
          {llmFilling ? "LLM Filling..." : "Run LLM Fill"}
        </button>
        <button
          className="cov-btn"
          onClick={runScan}
          disabled={loading || filling || llmFilling}
        >
          {loading ? "Scanning..." : "Refresh Report"}
        </button>
      </div>

      {llmProgress && (
        <div className="cov-fill-result">
          Batch {llmProgress.currentBatch}/{llmProgress.totalBatches}
          {" — "}
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
          <strong>LLM fill:</strong>{" "}
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
