/**
 * EntryPointStep - Step 2: Graph anchor entity selection
 *
 * Features the Story Potential Radar visualization:
 * - Filter chips for quick kind filtering
 * - Story score bar showing narrative potential
 * - Radar chart showing 5-axis potential breakdown
 * - Mini constellation showing 1-hop network preview
 */

import { useState, useMemo, useEffect } from 'react';
import type { EntityContext, RelationshipContext, NarrativeEventContext } from '../../../lib/chronicleTypes';
import { useWizard } from '../WizardContext';
import {
  computeAllStoryPotentials,
  getConnectedEntities,
  getUniqueKinds,
  type EntityWithPotential,
} from '../../../lib/chronicle/storyPotential';
import { getEntityUsageStats } from '../../../lib/db/chronicleRepository';
import {
  FilterChips,
  StoryPotentialRadarWithScore,
  StoryScoreBar,
  MiniConstellation,
} from '../visualizations';

interface EntryPointStepProps {
  entities: EntityContext[];
  relationships: RelationshipContext[];
  events: NarrativeEventContext[];
}

type SortOption = 'story-score' | 'connections' | 'name' | 'underused';

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

export default function EntryPointStep({
  entities,
  relationships,
  events,
}: EntryPointStepProps) {
  const {
    state,
    selectEntryPoint,
    clearEntryPoint,
    setIncludeErasInNeighborhood,
    simulationRunId,
  } = useWizard();
  const [selectedKinds, setSelectedKinds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>('story-score');
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
  const [onlyUnused, setOnlyUnused] = useState(false);
  const [usageStats, setUsageStats] = useState<Map<string, { usageCount: number }>>(new Map());
  const [usageLoading, setUsageLoading] = useState(false);

  useEffect(() => {
    if (!simulationRunId) {
      setUsageStats(new Map());
      setUsageLoading(false);
      return;
    }

    let isActive = true;
    setUsageLoading(true);

    getEntityUsageStats(simulationRunId)
      .then((stats) => {
        if (isActive) setUsageStats(stats);
      })
      .catch((err) => {
        console.error('[Chronicle Wizard] Failed to load entity usage stats:', err);
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
      adjacency.get(rel.src)!.add(rel.dst);
      adjacency.get(rel.dst)!.add(rel.src);
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

  // Filter and sort entities
  const filteredEntities = useMemo(() => {
    let result = [...entityPotentials.values()];

    // Apply kind filter
    if (selectedKinds.size > 0) {
      result = result.filter(e => selectedKinds.has(e.kind));
    }

    // Apply unused filter (requires usage stats)
    if (onlyUnused && !usageLoading) {
      result = result.filter(e => (usageMetrics.get(e.id)?.usageCount ?? 0) === 0);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'connections':
          return b.connectionCount - a.connectionCount;
        case 'underused': {
          const aScore = usageMetrics.get(a.id)?.underusedScore ?? 0;
          const bScore = usageMetrics.get(b.id)?.underusedScore ?? 0;
          if (bScore !== aScore) return bScore - aScore;
          return b.potential.overallScore - a.potential.overallScore;
        }
        case 'story-score':
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
    const { potential, connectionCount, eventCount, connectedKinds, eraIds, ...baseEntity } = entity;
    selectEntryPoint(baseEntity as EntityContext, entities, relationships, events);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 8px 0' }}>Select Entry Point</h4>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>
          Choose the central entity for your chronicle. Higher story scores indicate richer narrative potential.
        </p>
      </div>

      {/* Two column layout - fixed height to prevent jumping */}
      <div style={{ display: 'flex', gap: '20px', height: '480px' }}>
        {/* Left: Entity list */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Filter chips */}
          <div style={{ marginBottom: '12px' }}>
            <FilterChips
              options={availableKinds}
              selected={selectedKinds}
              onSelectionChange={setSelectedKinds}
              label="Filter by Kind"
            />
          </div>

          {/* Sort control and options */}
          <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="illuminator-select"
              style={{ fontSize: '11px', padding: '4px 8px' }}
            >
              <option value="story-score">Sort by Story Score</option>
              <option value="connections">Sort by Connections</option>
              <option value="underused">Sort by Underused Score</option>
              <option value="name">Sort by Name</option>
            </select>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={state.includeErasInNeighborhood}
                onChange={(e) => setIncludeErasInNeighborhood(e.target.checked)}
                style={{ margin: 0 }}
              />
              Include eras in neighborhood
            </label>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              color: usageLoading ? 'var(--text-muted)' : 'var(--text-secondary)',
              cursor: usageLoading ? 'not-allowed' : 'pointer',
            }}>
              <input
                type="checkbox"
                checked={onlyUnused}
                onChange={(e) => setOnlyUnused(e.target.checked)}
                style={{ margin: 0 }}
                disabled={usageLoading}
              />
              Only unused
            </label>
          </div>

          {/* Entity list - fills remaining height */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            minHeight: 0,
          }}>
            {filteredEntities.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No entities match the selected filters.
              </div>
            ) : (
              filteredEntities.map(entity => {
                const isSelected = state.entryPointId === entity.id;
                const isHovered = hoveredEntityId === entity.id;
                const usage = usageMetrics.get(entity.id);

                return (
                  <div
                    key={entity.id}
                    onClick={() => handleSelect(entity)}
                    onMouseEnter={() => setHoveredEntityId(entity.id)}
                    onMouseLeave={() => setHoveredEntityId(null)}
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      background: isSelected
                        ? 'var(--accent-color)'
                        : isHovered
                        ? 'var(--bg-tertiary)'
                        : 'transparent',
                      color: isSelected ? 'white' : 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {/* Selection indicator */}
                    <div style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      border: isSelected ? '2px solid white' : '2px solid var(--border-color)',
                      background: isSelected ? 'white' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {isSelected && (
                        <div style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: 'var(--accent-color)',
                        }} />
                      )}
                    </div>

                    {/* Entity info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}>
                        <span style={{ fontWeight: 500, fontSize: '13px' }}>
                          {entity.name}
                        </span>
                        <span style={{
                          padding: '1px 6px',
                          background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)',
                          borderRadius: '4px',
                          fontSize: '9px',
                          color: isSelected ? 'rgba(255,255,255,0.9)' : 'var(--text-muted)',
                        }}>
                          {entity.kind}
                        </span>
                        <span style={{
                          padding: '1px 6px',
                          background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)',
                          borderRadius: '4px',
                          fontSize: '9px',
                          color: isSelected ? 'rgba(255,255,255,0.9)' : 'var(--text-muted)',
                        }}
                        title="Prominence-weighted underuse: prominence ÷ (usage + 1)">
                          {usageLoading ? 'Underused ...' : `Underused ${usage ? usage.underusedScore.toFixed(2) : '0.00'}`}
                        </span>
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)',
                        marginTop: '2px',
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                      }}>
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
                      <div style={{
                        fontSize: '10px',
                        color: isSelected ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)',
                        marginTop: '2px',
                      }}>
                        {usageLoading ? 'Unused: ...' : (
                          `Unused: self ${usage?.unusedSelf ? '1' : '0'}/1 · 1-hop ${usage?.hop1Unused ?? 0}/${usage?.hop1Total ?? 0} · 2-hop ${usage?.hop2Unused ?? 0}/${usage?.hop2Total ?? 0}`
                        )}
                      </div>
                    </div>

                    {/* Story score bar */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '2px',
                    }}>
                      <StoryScoreBar
                        score={entity.potential.overallScore}
                        width={50}
                        height={6}
                      />
                      <span style={{
                        fontSize: '9px',
                        color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)',
                      }}>
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
        <div style={{
          width: '220px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          overflowY: 'auto',
          minHeight: 0,
        }}>
          {detailEntity ? (
            <>
              {/* Radar chart with score below */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
              }}>
                <StoryPotentialRadarWithScore
                  potential={detailEntity.potential}
                  size={160}
                />
              </div>

              {/* Mini constellation */}
              <div>
                <div style={{
                  fontSize: '9px',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  marginBottom: '4px',
                  textAlign: 'center',
                }}>
                  1-Hop Network
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                }}>
                  <MiniConstellation
                    centerName={detailEntity.name}
                    connections={detailConnections}
                    size={150}
                  />
                </div>
                {/* Inline stats */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '16px',
                  marginTop: '4px',
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                }}>
                  <span><strong>{detailEntity.connectedKinds.length}</strong> kinds</span>
                  <span><strong>{detailEntity.eraIds.length}</strong> eras</span>
                </div>
                <div style={{
                  marginTop: '6px',
                  textAlign: 'center',
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                }}>
                  {usageLoading || !detailUsage ? 'Unused: ...' : (
                    `Unused: self ${detailUsage.unusedSelf ? '1' : '0'}/1 · 1-hop ${detailUsage.hop1Unused}/${detailUsage.hop1Total} · 2-hop ${detailUsage.hop2Unused}/${detailUsage.hop2Total}`
                  )}
                </div>
                <div style={{
                  marginTop: '4px',
                  textAlign: 'center',
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                }}>
                  {usageLoading || !detailUsage ? 'Underused score: ...' : `Underused score: ${detailUsage.underusedScore.toFixed(2)}`}
                </div>
              </div>
            </>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '12px',
              background: 'var(--bg-tertiary)',
              borderRadius: '8px',
              border: '1px dashed var(--border-color)',
            }}>
              <div style={{ marginBottom: '8px', fontSize: '32px', opacity: 0.4 }}>
                ◎
              </div>
              <div>Hover or select an entity</div>
              <div style={{ fontSize: '11px', marginTop: '4px' }}>to see its story potential</div>
            </div>
          )}
        </div>
      </div>

      {/* Selected entry point summary */}
      {state.entryPoint && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'var(--bg-tertiary)',
          borderRadius: '8px',
          border: '1px solid var(--accent-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <span style={{ fontWeight: 500 }}>{state.entryPoint.name}</span>
            {state.entryPoint.summary && (
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                {state.entryPoint.summary}
              </p>
            )}
          </div>
          <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>
            <div style={{ fontWeight: 500, color: 'var(--accent-color)' }}>
              {state.candidates.length} candidates
            </div>
            <div>in 2-hop neighborhood</div>
          </div>
        </div>
      )}
    </div>
  );
}
