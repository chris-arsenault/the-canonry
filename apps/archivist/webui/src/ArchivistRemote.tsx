/**
 * ArchivistRemote - MFE entry point for Archivist
 *
 * Loads world data from the shared Dexie store.
 */

import React, { useEffect, useMemo, useState } from "react";
import "./index.css";
import WorldExplorer from "./components/WorldExplorer.tsx";
import type { WorldState } from "./types/world.ts";
import { validateWorldData } from "./utils/schemaValidation.ts";
import { buildWorldStateForSlot } from "@the-canonry/world-store";
import { ErrorMessage } from "@the-canonry/shared-components";
import type { Optional } from "@the-canonry/shared-components";

function StateScreen({ icon, title, children, variant = "empty" }: Readonly<{
  icon: string; title: string; children: React.ReactNode; variant: Optional<"empty" | "error">;
}>) {
  return (
    <div className={`archivist-${variant === "error" ? "unavailable" : "empty"}-state`}>
      <div className="archivist-state-content">
        <div className="archivist-state-icon">{icon}</div>
        <div className="archivist-state-title">{title}</div>
        {children}
      </div>
    </div>
  );
}

export interface ArchivistRemoteProps {
  projectId: Optional<string>;
  activeSlotIndex: Optional<number>;
  /** Timestamp updated when Dexie ingestion completes (viewer). */
  dexieSeededAt: Optional<number>;
}

export default function ArchivistRemote({
  projectId,
  activeSlotIndex = 0,
  dexieSeededAt,
}: Readonly<ArchivistRemoteProps>) {
  const [worldDataState, setWorldDataState] = useState<WorldState | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const effectiveWorldData = projectId ? worldDataState : null;
  const effectiveLoading = projectId ? loading : false;
  const effectiveLoadError = projectId ? loadError : null;
  const schemaIssues = useMemo(
    () => (effectiveWorldData ? validateWorldData(effectiveWorldData) : []),
    [effectiveWorldData]
  );

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setLoadError(null);
    });

    buildWorldStateForSlot(projectId, activeSlotIndex)
      .then((loaded) => {
        if (cancelled) return;
        setWorldDataState(loaded);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("[ArchivistRemote] Failed to load world data:", err);
        setWorldDataState(null);
        setLoadError(err instanceof Error ? err.message : "Failed to load world data from Dexie.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSlotIndex, dexieSeededAt, projectId]);

  if (effectiveLoading) return (
    <StateScreen icon="⏳" title="Loading World Data">
      <div className="archivist-state-message">Reading from local storage…</div>
    </StateScreen>
  );
  if (effectiveLoadError) return (
    <StateScreen icon="❌" title="World data unavailable" variant="error">
      <ErrorMessage title="World data unavailable" message={effectiveLoadError} />
    </StateScreen>
  );
  if (!effectiveWorldData) return (
    <StateScreen icon="📜" title="No World Data">
      <div className="archivist-state-message">
        Run a simulation in Lore Weave and click &quot;View in Archivist&quot; to explore your world.
      </div>
    </StateScreen>
  );
  if (schemaIssues.length > 0) return (
    <StateScreen icon="❌" title="World data is missing required schema fields" variant="error">
      <ul className="archivist-state-list">
        {schemaIssues.map((issue, index) => <li key={`${issue}-${index}`}>{issue}</li>)}
      </ul>
    </StateScreen>
  );

  return <WorldExplorer worldData={effectiveWorldData} loreData={null} />;
}
