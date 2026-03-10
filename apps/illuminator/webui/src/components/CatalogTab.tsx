/**
 * CatalogTab — Image metadata curation workspace.
 *
 * Two views:
 * - Coverage Report: per-field completeness + derivability analysis
 * - Review & Edit: table of images with inline editing for metadata
 */

import React, { useState } from "react";
import type { StyleLibrary } from "@canonry/world-schema";
import { useIlluminatorConfigStore } from "../lib/db/illuminatorConfigStore";
import CoverageReport from "./catalog/CoverageReport";
import CatalogReview from "./catalog/CatalogReview";
import "./CatalogTab.css";

interface CatalogTabProps {
  styleLibrary?: StyleLibrary | null;
}

export default function CatalogTab({ styleLibrary }: Readonly<CatalogTabProps>) {
  const { projectId, simulationRunId } = useIlluminatorConfigStore();
  const [view, setView] = useState<"report" | "review">("report");

  if (!simulationRunId || !projectId) {
    return (
      <div className="illuminator-content">
        <div className="cat-empty">No simulation loaded.</div>
      </div>
    );
  }

  return (
    <div className="illuminator-content">
      <div className="cat-workspace">
        <div className="cat-toolbar">
          <button
            className={`cat-tab-btn ${view === "report" ? "active" : ""}`}
            onClick={() => setView("report")}
          >
            Coverage Report
          </button>
          <button
            className={`cat-tab-btn ${view === "review" ? "active" : ""}`}
            onClick={() => setView("review")}
          >
            Review &amp; Edit
          </button>
        </div>
        <div className="cat-content">
          {view === "report" ? (
            <CoverageReport projectId={projectId} styleLibrary={styleLibrary} />
          ) : (
            <CatalogReview projectId={projectId} styleLibrary={styleLibrary} />
          )}
        </div>
      </div>
    </div>
  );
}
