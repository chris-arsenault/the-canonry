/**
 * EntryPointStep - Step 2: Graph anchor entity selection
 *
 * Features the Story Potential Radar visualization:
 * - Filter chips for quick kind filtering
 * - Story score bar showing narrative potential
 * - Radar chart showing 5-axis potential breakdown
 * - Mini constellation showing 1-hop network preview
 */

import React, { useState, useMemo, useEffect } from "react";
import type {
  EntityContext,
  RelationshipContext,
  NarrativeEventContext,
} from "../../../lib/chronicleTypes";
import { useWizard } from "../WizardContext";
import {
  computeAllStoryPotentials,
  getConnectedEntities,
  getUniqueKinds,
  type EntityWithPotential,
} from "../../../lib/chronicle/storyPotential";
import { getEntityUsageStats } from "../../../lib/db/chronicleRepository";
import { getEraRanges } from "../../../lib/chronicle/timelineUtils";
import {
  FilterChips,
  StoryPotentialRadarWithScore,
  StoryScoreBar,
  MiniConstellation,
} from "../visualizations";
import "./EntryPointStep.css";

interface EntryPointStepProps {
  entities: EntityContext[];
  relationships: RelationshipContext[];
  events: NarrativeEventContext[];
}

type SortOption = "story-score" | "connections" | "name" | "underused";

interface UsageMetrics {
  usageCount: number;
  unusedSelf: boolean;
  hop1Unused: number;
  hop1Total: number;
  hop2Unused: number;
  hop2Total: number;
  underusedScore: number;
  prominence: number;
}

export default function EntryPointStep({ entities, relationships, events }: Readonly<EntryPointStepProps>) {
  const {
    state,
    eras,
    selectEntryPoint,
    clearEntryPoint,
    setIncludeErasInNeighborhood,
    simulationRunId,
  } = useWizard();
  const [selectedKinds, setSelectedKinds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>("story-score");
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
  const [onlyUnused, setOnlyUnused] = useState(false);
  const [usageStats, setUsageStats] = useState<Map<string, { usageCount: number }>>(new Map());
  const [usageLoading, setUsageLoading] = useState(false);

  // Clear usage stats when no simulationRunId
  useEffect(() => {
    if (simulationRunId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear async usage state when simulation is unset
    setUsageStats(new Map());
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear async usage state when simulation is unset
    setUsageLoading(false);
  }, [simulationRunId]);

  useEffect(() => {
    if (!simulationRunId) return;

    let isActive = true;
    setUsageLoading(true);

    getEntityUsageStats(simulationRunId)
      .then((stats) => {
        if (isActive) setUsageStats(stats);
      })
      .catch((err) => {
        console.error("[Chronicle Wizard] Failed to load entity usage stats:", err);
        if (isActive) setUsageStats(new Map());
      })
      .finally(() => {
        if (isActive) setUsageLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [simulationRunId]);

  // Compute story potentials for all entities
  const entityPotentials = useMemo(() => {
    return computeAllStoryPotentials(entities, relationships, events);
  }, [entities, relationships, events]);

  const usageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [id, stats] of usageStats) {
      counts.set(id, stats.usageCount);
    }
    return counts;
  }, [usageStats]);

  const usageMetrics = useMemo(() => {
    if (entityPotentials.size === 0) return new Map<string, UsageMetrics>();

    const entityIds = Array.from(entityPotentials.keys());
    const adjacency = new Map<string, Set<string>>();
    for (const id of entityIds) adjacency.set(id, new Set());

    for (const rel of relationships) {
      if (!adjacency.has(rel.src) || !adjacency.has(rel.dst)) continue;
      adjacency.get(rel.src).add(rel.dst);
      adjacency.get(rel.dst).add(rel.src);
    }

    const visitStamp = new Map<string, number>();
    let stamp = 1;
    const result = new Map<string, UsageMetrics>();

    for (const id of entityIds) {
      const usageCount = usageCounts.get(id) ?? 0;
      const entity = entityPotentials.get(id);
      const rawProminence = entity ? Number(entity.prominence) : 0;
      const prominence = Number.isFinite(rawProminence) ? Math.max(0, rawProminence) : 0;

      const firstHop = adjacency.get(id) || new Set<string>();
      stamp += 1;
      visitStamp.set(id, stamp);

      let hop1Total = 0;
      let hop1Unused = 0;
      for (const neighbor of firstHop) {
        if (visitStamp.get(neighbor) === stamp) continue;
        visitStamp.set(neighbor, stamp);
        hop1Total += 1;
        if ((usageCounts.get(neighbor) ?? 0) === 0) hop1Unused += 1;
      }

      let hop2Total = 0;
      let hop2Unused = 0;
      for (const neighbor of firstHop) {
        const neighborHops = adjacency.get(neighbor);
        if (!neighborHops) continue;

        for (const secondHop of neighborHops) {
          if (visitStamp.get(secondHop) === stamp) continue;
          visitStamp.set(secondHop, stamp);
          hop2Total += 1;
          if ((usageCounts.get(secondHop) ?? 0) === 0) hop2Unused += 1;
        }
      }

      result.set(id, {
        usageCount,
        unusedSelf: usageCount === 0,
        hop1Unused,
        hop1Total,
        hop2Unused,
        hop2Total,
        underusedScore: prominence / (usageCount + 1),
        prominence,
      });
    }

    return result;
  }, [entityPotentials, relationships, usageCounts]);

  // Get available kinds for filter chips
  const availableKinds = useMemo(() => {
    return getUniqueKinds(entities);
  }, [entities]);

  // Era lookups: id -> color and id -> name
  const eraColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const range of getEraRanges(eras)) {
      map.set(range.id, range.color);
    }
    return map;
  }, [eras]);

  const eraNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const era of eras) {
      map.set(era.id, era.name);
    }
    return map;
  }, [eras]);

  // Filter and sort entities
  const filteredEntities = useMemo(() => {
    let result = [...entityPotentials.values()];

    // Apply kind filter
    if (selectedKinds.size > 0) {
      result = result.filter((e) => selectedKinds.has(e.kind));
    }

    // Apply unused filter (requires usage stats)
    if (onlyUnused && !usageLoading) {
      result = result.filter((e) => (usageMetrics.get(e.id)?.usageCount ?? 0) === 0);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "connections":
          return b.connectionCount - a.connectionCount;
        case "underused": {
          const aScore = usageMetrics.get(a.id)?.underusedScore ?? 0;
          const bScore = usageMetrics.get(b.id)?.underusedScore ?? 0;
          if (bScore !== aScore) return bScore - aScore;
          return b.potential.overallScore - a.potential.overallScore;
        }
        case "story-score":
        default:
          return b.potential.overallScore - a.potential.overallScore;
      }
    });

    return result;
  }, [entityPotentials, selectedKinds, sortBy, onlyUnused, usageLoading, usageMetrics]);

  // Get entity for detail panel (hover takes priority over selection)
  const detailEntity = useMemo(() => {
    const id = hoveredEntityId || state.entryPointId;
    if (!id) return null;
    return entityPotentials.get(id) || null;
  }, [hoveredEntityId, state.entryPointId, entityPotentials]);

  // Get connections for constellation
  const detailConnections = useMemo(() => {
    if (!detailEntity) return [];
    return getConnectedEntities(detailEntity.id, entities, relationships);
  }, [detailEntity, entities, relationships]);
  const detailUsage = useMemo(() => {
    if (!detailEntity) return null;
    return usageMetrics.get(detailEntity.id) || null;
  }, [detailEntity, usageMetrics]);

  const handleSelect = (entity: EntityWithPotential) => {
    // Click again to deselect
    if (state.entryPointId === entity.id) {
      clearEntryPoint();
      return;
    }
    // Convert back to EntityContext for the wizard
    const { potential, connectionCount, eventCount, connectedKinds, eraIds, ...baseEntity } =
      entity;
    selectEntryPoint(baseEntity as EntityContext, entities, relationships, events);
  };

  return (
    <div>
      {/* Header */}
      <div className="eps-header">
        <h4 className="eps-title">Select Entry Point</h4>
        <p className="eps-subtitle">
          Choose the central entity for your chronicle. Higher story scores indicate richer
          narrative potential.
        </p>
      </div>

      {/* Two column layout - fixed height to prevent jumping */}
      <div className="eps-layout">
        {/* Left: Entity list */}
        <div className="eps-left">
          {/* Filter chips */}
          <div className="eps-filter-gap">
            <FilterChips
              options={availableKinds}
              selected={selectedKinds}
              onSelectionChange={setSelectedKinds}
              label="Filter by Kind"
            />
          </div>

          {/* Sort control and options */}
          <div className="eps-sort-row">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="illuminator-select eps-sort-select"
            >
              <option value="story-score">Sort by Story Score</option>
              <option value="connections">Sort by Connections</option>
              <option value="underused">Sort by Underused Score</option>
              <option value="name">Sort by Name</option>
            </select>
            <label className="eps-checkbox-label eps-checkbox-label-muted">
              <input
                type="checkbox"
                checked={state.includeErasInNeighborhood}
                onChange={(e) => setIncludeErasInNeighborhood(e.target.checked)}
                className="eps-checkbox"
              />
              Include eras in neighborhood
            </label>
            <label
              className="eps-checkbox-label"
              style={{
                '--eps-label-color': usageLoading ? "var(--text-muted)" : "var(--text-secondary)",
                '--eps-label-cursor': usageLoading ? "not-allowed" : "pointer",
              } as React.CSSProperties}
            >
              <input
                type="checkbox"
                checked={onlyUnused}
                onChange={(e) => setOnlyUnused(e.target.checked)}
                className="eps-checkbox"
                disabled={usageLoading}
              />
              Only unused
            </label>
          </div>

          {/* Entity list - fills remaining height */}
          <div className="eps-entity-list">
            {filteredEntities.length === 0 ? (
              <div className="ilu-empty eps-empty-list">
                No entities match the selected filters.
              </div>
            ) : (
              filteredEntities.map((entity) => {
                const isSelected = state.entryPointId === entity.id;
                const isHovered = hoveredEntityId === entity.id;
                const usage = usageMetrics.get(entity.id);

                return (
                  <div
                    key={entity.id}
                    onClick={() => handleSelect(entity)}
                    onMouseEnter={() => setHoveredEntityId(entity.id)}
                    onMouseLeave={() => setHoveredEntityId(null)}
                    className={`eps-entity-row ${isSelected ? "eps-entity-row-selected" : ""} ${isHovered && !isSelected ? "eps-entity-row-hovered" : ""}`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
                  >
                    {/* Selection indicator */}
                    <div className={`eps-radio-dot ${isSelected ? "eps-radio-dot-selected" : "eps-radio-dot-unselected"}`}>
                      {isSelected && (
                        <div className="eps-radio-dot-inner" />
                      )}
                    </div>

                    {/* Entity info */}
                    <div className="eps-entity-info">
                      <div className="eps-entity-name-row">
                        <span className="eps-entity-name">{entity.name}</span>
                        <span className={`eps-kind-badge ${isSelected ? "eps-kind-badge-selected" : "eps-kind-badge-default"}`}>
                          {entity.kind}
                        </span>
                        {entity.eraId &&
                          eraNameMap.has(entity.eraId) &&
                          (() => {
                            const eraColor = eraColorMap.get(entity.eraId);
                            const eraBgValue = isSelected ? "rgba(255,255,255,0.2)" : (eraColor ? `${eraColor}26` : undefined);
                            const eraColorValue = isSelected ? "rgba(255,255,255,0.9)" : eraColor;
                            return (
                              <span
                                className="eps-era-badge"
                                style={{
                                  '--eps-era-bg': eraBgValue,
                                  '--eps-era-color': eraColorValue,
                                } as React.CSSProperties}
                              >
                                {eraNameMap.get(entity.eraId)}
                              </span>
                            );
                          })()}
                        <span
                          className={`eps-underused-badge ${isSelected ? "eps-kind-badge-selected" : "eps-kind-badge-default"}`}
                          title="Prominence-weighted underuse: prominence ÷ (usage + 1)"
                        >
                          {(() => {
                            if (usageLoading) return "Underused ...";
                            const score = usage ? usage.underusedScore.toFixed(2) : "0.00";
                            return `Underused ${score}`;
                          })()}
                        </span>
                      </div>
                      <div className={`eps-entity-stats ${isSelected ? "eps-entity-stats-selected" : "eps-entity-stats-default"}`}>
                        <span>{entity.connectionCount} links</span>
                        <span>·</span>
                        <span>{entity.eventCount} events</span>
                        {entity.subtype && (
                          <>
                            <span>·</span>
                            <span>{entity.subtype}</span>
                          </>
                        )}
                      </div>
                      <div className={`eps-entity-usage ${isSelected ? "eps-entity-usage-selected" : "eps-entity-usage-default"}`}>
                        {(() => {
                          if (usageLoading) return "Unused: ...";
                          const selfStr = usage?.unusedSelf ? "1" : "0";
                          return `Unused: self ${selfStr}/1 · 1-hop ${usage?.hop1Unused ?? 0}/${usage?.hop1Total ?? 0} · 2-hop ${usage?.hop2Unused ?? 0}/${usage?.hop2Total ?? 0}`;
                        })()}
                      </div>
                    </div>

                    {/* Story score bar */}
                    <div className="eps-score-col">
                      <StoryScoreBar score={entity.potential.overallScore} width={50} height={6} />
                      <span className={`eps-score-pct ${isSelected ? "eps-score-pct-selected" : "eps-score-pct-default"}`}>
                        {(entity.potential.overallScore * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Detail panel - fixed height, scrollable */}
        <div className="eps-right">
          {detailEntity ? (
            <>
              {/* Radar chart with score below */}
              <div className="eps-radar-wrap">
                <StoryPotentialRadarWithScore potential={detailEntity.potential} size={160} />
              </div>

              {/* Mini constellation */}
              <div>
                <div className="eps-network-label">
                  1-Hop Network
                </div>
                <div className="eps-network-wrap">
                  <MiniConstellation
                    centerName={detailEntity.name}
                    connections={detailConnections}
                    size={150}
                  />
                </div>
                {/* Inline stats */}
                <div className="eps-inline-stats">
                  <span>
                    <strong>{detailEntity.connectedKinds.length}</strong> kinds
                  </span>
                  <span>
                    <strong>{detailEntity.eraIds.length}</strong> eras
                  </span>
                </div>
                <div className="eps-detail-usage">
                  {(() => {
                    if (usageLoading || !detailUsage) return "Unused: ...";
                    const selfStr = detailUsage.unusedSelf ? "1" : "0";
                    return `Unused: self ${selfStr}/1 · 1-hop ${detailUsage.hop1Unused}/${detailUsage.hop1Total} · 2-hop ${detailUsage.hop2Unused}/${detailUsage.hop2Total}`;
                  })()}
                </div>
                <div className="eps-detail-underused">
                  {usageLoading || !detailUsage
                    ? "Underused score: ..."
                    : `Underused score: ${detailUsage.underusedScore.toFixed(2)}`}
                </div>
              </div>
            </>
          ) : (
            <div className="eps-empty-detail">
              <div className="eps-empty-icon">◎</div>
              <div>Hover or select an entity</div>
              <div className="eps-empty-sub">to see its story potential</div>
            </div>
          )}
        </div>
      </div>

      {/* Selected entry point summary */}
      {state.entryPoint && (
        <div className="eps-selected-summary">
          <div>
            <span className="eps-selected-name">{state.entryPoint.name}</span>
            {state.entryPoint.summary && (
              <p className="eps-selected-desc">
                {state.entryPoint.summary}
              </p>
            )}
          </div>
          <div className="eps-selected-right">
            <div className="eps-candidate-count">
              {state.candidates.length} candidates
            </div>
            <div>in 2-hop neighborhood</div>
          </div>
        </div>
      )}
    </div>
  );
}
