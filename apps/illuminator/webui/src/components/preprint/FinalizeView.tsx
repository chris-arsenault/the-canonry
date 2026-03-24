/**
 * FinalizeView — Chronicle selector + WYSIWYG editor for finalized pages.
 *
 * Uses the shared chronicle-renderer pipeline for initial content.
 * Shown as a sub-tab in PrePrintPanel.
 */

import React, { useState, useMemo } from "react";
import type { ChronicleRecord } from "../../lib/chronicleTypes";
import type { PersistedEntity } from "../../lib/db/illuminatorDb";
import FinalizeEditor from "./FinalizeEditor";
import "./FinalizeView.css";

interface FinalizeViewProps {
  chronicles: ChronicleRecord[];
  simulationRunId: string;
  entities: PersistedEntity[];
}

export default function FinalizeView({
  chronicles,
  simulationRunId,
  entities,
}: Readonly<FinalizeViewProps>) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...chronicles].sort((a, b) => (a.title || "").localeCompare(b.title || "")),
    [chronicles]
  );

  const selected = useMemo(
    () => sorted.find((c) => c.chronicleId === selectedId) ?? null,
    [sorted, selectedId]
  );

  return (
    <div className="fv-container">
      <div className="fv-sidebar">
        <div className="fv-sidebar-title">Chronicles</div>
        <div className="fv-list">
          {sorted.map((c) => (
            <button
              key={c.chronicleId}
              className={`fv-item${selectedId === c.chronicleId ? " fv-item-active" : ""}`}
              onClick={() => setSelectedId(c.chronicleId)}
              title={c.title}
            >
              <span className="fv-item-format">{c.format === "document" ? "▣" : "☰"}</span>
              <span className="fv-item-title">{c.title}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="fv-editor-area">
        {selected ? (
          <FinalizeEditor
            key={selected.chronicleId}
            chronicle={selected}
            simulationRunId={simulationRunId}
            entities={entities}
          />
        ) : (
          <div className="fv-empty">Select a chronicle to finalize</div>
        )}
      </div>
    </div>
  );
}
