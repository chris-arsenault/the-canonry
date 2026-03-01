/**
 * TraitPaletteSection - Visual trait palette management
 *
 * Shows existing trait palettes per entity kind and allows
 * manual triggering of palette expansion via LLM through the
 * enrichment queue (so it appears in Activity panel).
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  getPalette,
  exportPalettes,
  type TraitPalette,
  type PaletteItem,
} from "../lib/db/traitRepository";
import { ErrorMessage } from "@the-canonry/shared-components";
import "./TraitPaletteSection.css";
import type { QueueItem, EnrichmentType } from "../lib/enrichmentTypes";
import type { EnrichedEntity } from "../hooks/useEnrichmentQueue";

interface CultureInfo {
  name: string;
  description?: string;
  visualIdentity?: Record<string, string>;
}

interface EraInfo {
  id: string;
  name: string;
  description?: string;
}

interface TraitPaletteSectionProps {
  projectId: string;
  simulationRunId?: string;
  worldContext: string;
  entityKinds: string[];
  /** Map of entity kind to its subtypes */
  subtypesByKind?: Record<string, string[]>;
  /** Available eras for era-specific categories */
  eras?: EraInfo[];
  /** Cultures with visual identities for grounding palettes in world lore */
  cultures?: CultureInfo[];
  // Queue integration
  enqueue: (
    items: Array<{
      entity: EnrichedEntity;
      type: EnrichmentType;
      prompt: string;
      paletteEntityKind?: string;
      paletteWorldContext?: string;
      paletteSubtypes?: string[];
      paletteEras?: EraInfo[];
      paletteCultureContext?: CultureInfo[];
    }>
  ) => void;
  queue: QueueItem[];
  isWorkerReady: boolean;
}

export default function TraitPaletteSection({
  projectId,
  simulationRunId: _simulationRunId,
  worldContext,
  entityKinds: rawEntityKinds = [],
  subtypesByKind = {},
  eras = [],
  cultures = [],
  enqueue,
  queue,
  isWorkerReady,
}: Readonly<TraitPaletteSectionProps>) {
  // Filter to valid, unique entity kinds
  const entityKinds = useMemo(
    () => [...new Set((rawEntityKinds || []).filter((k) => k && typeof k === "string"))],
    // Use joined string as stable key since parent creates new array each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [(rawEntityKinds || []).join(",")]
  );

  const [palettes, setPalettes] = useState<Record<string, TraitPalette | null>>({});
  const [loading, setLoading] = useState(true);
  const [selectedKind, setSelectedKind] = useState<string | null>(null);

  // Stable key for entityKinds to use in dependencies
  const entityKindsKey = entityKinds.join(",");

  // Track which kinds have pending/running tasks
  const expandingKinds = useMemo(() => {
    const kinds = new Set<string>();
    for (const item of queue) {
      if (
        item.type === "paletteExpansion" &&
        item.paletteEntityKind &&
        (item.status === "queued" || item.status === "running")
      ) {
        kinds.add(item.paletteEntityKind);
      }
    }
    return kinds;
  }, [queue]);

  // Track completed tasks to refresh palettes
  const completedPaletteTaskIds = useMemo(() => {
    return queue
      .filter((item) => item.type === "paletteExpansion" && item.status === "complete")
      .map((item) => item.id);
  }, [queue]);

  // Load all palettes
  const loadPalettes = useCallback(async () => {
    setLoading(true);
    try {
      const loaded: Record<string, TraitPalette | null> = {};
      for (const kind of entityKinds) {
        loaded[kind] = await getPalette(projectId, kind);
      }
      setPalettes(loaded);
    } catch (err) {
      console.error("Failed to load palettes:", err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, entityKindsKey]);

  useEffect(() => {
    void loadPalettes();
  }, [loadPalettes]);

  // Refresh palettes when a palette expansion task completes
  const lastCompletedRef = useMemo(() => ({ ids: new Set<string>() }), []);
  useEffect(() => {
    const newCompletions = completedPaletteTaskIds.filter((id) => !lastCompletedRef.ids.has(id));
    if (newCompletions.length > 0) {
      for (const id of newCompletions) {
        lastCompletedRef.ids.add(id);
      }
      void loadPalettes();
    }
  }, [completedPaletteTaskIds, lastCompletedRef, loadPalettes]);

  // Expand palette for a specific kind via queue
  const handleExpand = useCallback(
    (entityKind: string) => {
      if (!isWorkerReady) {
        alert("Worker not ready. Please wait...");
        return;
      }

      // Create a synthetic entity for the queue (palette expansion is not entity-specific)
      const syntheticEntity: EnrichedEntity = {
        id: `palette_${entityKind}`,
        name: `Palette: ${entityKind}`,
        kind: entityKind,
        subtype: "",
        prominence: "recognized",
        culture: "",
        status: "active",
        description: "",
        tags: {},
      };

      // Filter cultures to those with visual identities (more useful for grounding)
      const cultureContext = cultures
        .filter((c) => c.name && (c.visualIdentity || c.description))
        .map((c) => ({
          name: c.name,
          description: c.description,
          visualIdentity: c.visualIdentity,
        }));

      // Get subtypes for this kind
      const subtypes = subtypesByKind[entityKind] || [];

      enqueue([
        {
          entity: syntheticEntity,
          type: "paletteExpansion",
          prompt: "", // Not used - worker builds prompt from paletteEntityKind + paletteWorldContext
          paletteEntityKind: entityKind,
          paletteWorldContext: worldContext || "A fantasy world with diverse entities.",
          paletteSubtypes: subtypes.length > 0 ? subtypes : undefined,
          paletteEras: eras.length > 0 ? eras : undefined,
          paletteCultureContext: cultureContext.length > 0 ? cultureContext : undefined,
        },
      ]);
    },
    [isWorkerReady, enqueue, worldContext, subtypesByKind, eras, cultures]
  );

  // Export all palettes
  const handleExport = useCallback(async () => {
    try {
      const allPalettes = await exportPalettes(projectId);
      const json = JSON.stringify(allPalettes, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trait-palettes-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export palettes:", err);
      alert("Failed to export palettes");
    }
  }, [projectId]);

  // Count total categories
  const totalCategories = Object.values(palettes).reduce(
    (sum, p) => sum + (p?.items.length || 0),
    0
  );

  // Find recent errors for palette expansion
  const recentErrors = useMemo(() => {
    return queue
      .filter(
        (item) =>
          item.type === "paletteExpansion" && item.status === "error" && item.paletteEntityKind
      )
      .slice(-3); // Show last 3 errors
  }, [queue]);

  if (loading) {
    return (
      <div className="illuminator-card">
        <div className="ilu-empty tps-loading">
          Loading trait palettes...
        </div>
      </div>
    );
  }

  if (entityKinds.length === 0) {
    return (
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Trait Palettes</h2>
        </div>
        <div className="ilu-empty tps-empty">
          No entity kinds available. Load a world with entity kinds defined to use trait palettes.
        </div>
      </div>
    );
  }

  return (
    <div className="illuminator-card">
      <div className="illuminator-card-header">
        <h2 className="illuminator-card-title">Trait Palettes</h2>
        <div className="tps-header-actions">
          <button
            onClick={() => void handleExport()}
            className="illuminator-button illuminator-button-secondary tps-header-btn"
            disabled={totalCategories === 0}
          >
            Export
          </button>
          <button
            onClick={() => void loadPalettes()}
            className="illuminator-button illuminator-button-secondary tps-header-btn"
          >
            Refresh
          </button>
        </div>
      </div>

      <p className="tps-description">
        Trait palettes provide diverse visual directions for entity descriptions. Expand palettes to
        generate new trait categories and reduce repetition.
      </p>

      {/* Summary stats */}
      <div className="ilu-stats-grid">
        <div className="ilu-stat-card">
          <div className="ilu-stat-value">{entityKinds.length}</div>
          <div className="ilu-stat-label">Entity Kinds</div>
        </div>
        <div className="ilu-stat-card">
          <div className="ilu-stat-value">{totalCategories}</div>
          <div className="ilu-stat-label">Total Categories</div>
        </div>
      </div>

      {/* Per-kind palettes */}
      <div className="tps-kind-list">
        {entityKinds.map((kind) => {
          const palette = palettes[kind];
          const isExpanding = expandingKinds.has(kind);
          const isSelected = selectedKind === kind;

          return (
            <div
              key={kind}
              className="tps-kind-card"
            >
              {/* Header row */}
              <div
                className="tps-kind-header"
                onClick={() => setSelectedKind(isSelected ? null : kind)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
              >
                <div className="tps-kind-header-left">
                  <code className="tps-kind-badge">
                    {kind || "(unknown)"}
                  </code>
                  <span className="tps-category-count">
                    {palette?.items.length || 0} categories
                  </span>
                </div>
                <div className="tps-kind-header-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!kind) {
                        alert("Invalid entity kind");
                        return;
                      }
                      handleExpand(kind);
                    }}
                    className="illuminator-button illuminator-button-primary tps-expand-btn"
                    disabled={isExpanding || !isWorkerReady || !kind}
                    title={
                      !isWorkerReady ? "Worker not ready" : `Generate trait categories for ${kind}`
                    }
                  >
                    {isExpanding ? "Expanding..." : "Expand"}
                  </button>
                  <span className={`tps-expand-icon ${isSelected ? "tps-expand-icon-open" : "tps-expand-icon-closed"}`}>
                    ▼
                  </span>
                </div>
              </div>

              {/* Expanded content */}
              {isSelected && (
                <div className="tps-kind-body">
                  {!palette || palette.items.length === 0 ? (
                    <div className="ilu-empty tps-kind-empty">
                      No palette categories yet. Click &quot;Expand Palette&quot; to generate some.
                    </div>
                  ) : (
                    <div className="tps-palette-list">
                      {palette.items.map((item: PaletteItem) => (
                        <div
                          key={item.id}
                          className="tps-palette-item"
                        >
                          <div className="tps-palette-header">
                            <span className="tps-palette-category">
                              {item.category}
                            </span>
                            <span
                              className={`tps-usage-badge ${item.timesUsed > 0 ? "tps-usage-badge-used" : "tps-usage-badge-unused"}`}
                            >
                              used {item.timesUsed}x
                            </span>
                          </div>
                          <div className="tps-palette-description">
                            {item.description}
                          </div>
                          {item.examples.length > 0 && (
                            <div className="tps-palette-examples">
                              <em>Examples:</em> {item.examples.join(" · ")}
                            </div>
                          )}
                          {/* Binding tags: subtypes and era */}
                          {(item.subtypes?.length || item.era) ? (
                            <div className="tps-binding-tags">
                              {item.era && (
                                <span className="tps-era-tag">
                                  era: {item.era}
                                </span>
                              )}
                              {item.subtypes?.map((st) => (
                                <span
                                  key={st}
                                  className="tps-subtype-tag"
                                >
                                  {st}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Show recent errors */}
      {recentErrors.length > 0 && (
        <div className="tps-error-section">
          <div className="tps-error-content">
            <strong>Recent errors:</strong>
            {recentErrors.map((err) => (
              <ErrorMessage
                key={err.id}
                message={`${err.paletteEntityKind}: ${err.error}`}
                className="tps-error-item"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
