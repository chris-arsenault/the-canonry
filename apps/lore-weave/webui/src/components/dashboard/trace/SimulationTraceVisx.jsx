/**
 * SimulationTraceVisx - Full-screen trace visualization using visx
 *
 * Replaces Recharts-based SimulationTraceView with more flexible visx primitives.
 * Features:
 * - Multi-line pressure chart
 * - Stacked template markers at tick + 0.5
 * - Era timeline with transition markers
 * - Interactive tooltips and selection
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { ParentSize } from '@visx/responsive';
import './SimulationTraceVisx.css';
import {
  createXScale,
  createPressureYScale,
  DEFAULT_MARGIN,
  ERA_TIMELINE_HEIGHT
} from './scales';
import PressureChart from './PressureChart';
import EraTimeline from './EraTimeline';
import { SystemActivityPanel, PlaneDiffusionVis, GraphContagionVis } from '../systems';

// Color palettes (same as original)
export const PRESSURE_COLORS = [
  '#f59e0b', '#ef4444', '#22c55e', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
];

// Entity kind color palette - deterministic colors based on kind string hash
const ENTITY_KIND_COLORS = [
  '#22c55e', // green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#ef4444', // red
  '#f97316', // orange
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#a855f7', // purple
  '#eab308', // yellow
];

// Simple hash function for consistent color assignment
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Get color for an entity kind (deterministic)
function getEntityKindColor(kind) {
  if (!kind) return ENTITY_KIND_COLORS[0];
  const index = hashString(kind) % ENTITY_KIND_COLORS.length;
  return ENTITY_KIND_COLORS[index];
}

export const EVENT_COLORS = {
  template: '#22c55e',
  system: '#8b5cf6',
  action: '#f59e0b',
};

const ERA_COLORS = [
  'rgba(59, 130, 246, 0.15)',
  'rgba(168, 85, 247, 0.15)',
  'rgba(236, 72, 153, 0.15)',
  'rgba(34, 197, 94, 0.15)',
  'rgba(249, 115, 22, 0.15)',
];

// Visible tick window
const VISIBLE_TICKS = 45;

/**
 * Transform pressure updates for charting
 */
function transformPressureData(pressureUpdates) {
  if (!pressureUpdates?.length) {
    return { data: [], pressureIds: [], breakdownsByTick: new Map() };
  }

  const pressureIds = pressureUpdates[0]?.pressures?.map(p => p.id) || [];
  const breakdownsByTick = new Map();

  const data = pressureUpdates.map(update => {
    const point = { tick: update.tick, epoch: update.epoch };
    const tickBreakdowns = new Map();

    const discreteByPressure = new Map();
    for (const mod of update.discreteModifications || []) {
      if (!discreteByPressure.has(mod.pressureId)) {
        discreteByPressure.set(mod.pressureId, []);
      }
      discreteByPressure.get(mod.pressureId).push(mod);
    }

    for (const p of update.pressures) {
      point[p.id] = p.newValue;
      point[`${p.id}_name`] = p.name;

      if (p.breakdown) {
        const discreteMods = discreteByPressure.get(p.id) || [];
        const discreteTotal = discreteMods.reduce((sum, m) => sum + m.delta, 0);

        tickBreakdowns.set(p.id, {
          id: p.id,
          name: p.name,
          value: p.newValue,
          previousValue: p.previousValue,
          delta: p.newValue - p.previousValue,
          breakdown: p.breakdown,
          discreteModifications: discreteMods,
          discreteTotal,
        });
      }
    }

    if (tickBreakdowns.size > 0) {
      breakdownsByTick.set(update.tick, tickBreakdowns);
    }

    return point;
  });

  return { data, pressureIds, breakdownsByTick };
}

/**
 * Transform template applications, action applications, and system actions for event markers
 * Each marker is colored by the kind of the first entity created or system type
 */
function transformEventData(templateApplications, actionApplications, systemActions, pressureData) {
  const events = {
    template: [],
    system: [],
    action: [],
  };

  // Process template applications
  if (templateApplications?.length) {
    // Group templates by tick for stacking
    const byTick = new Map();
    for (const app of templateApplications) {
      if (!byTick.has(app.tick)) {
        byTick.set(app.tick, []);
      }
      byTick.get(app.tick).push(app);
    }

    // Create event markers with entity-based coloring
    for (const [tick, apps] of byTick) {
      apps.forEach((app, stackIndex) => {
        // Get the kind of the first entity created (for coloring)
        const firstEntityKind = app.entitiesCreated?.[0]?.kind || null;
        const color = getEntityKindColor(firstEntityKind);

        const uniqueId = `template-${tick}-${app.templateId}-${stackIndex}`;
        events.template.push({
          tick,
          uniqueId,
          templateId: app.templateId,
          data: app,
          stackIndex,
          totalAtTick: apps.length,
          entityKind: firstEntityKind,
          color,
        });
      });
    }
  }

  // Process system actions (including era transitions)
  // Filter out framework-growth (shown via template applications) and universal-catalyst (shown via action markers)
  if (systemActions?.length) {
    const filteredActions = systemActions.filter(a =>
      a.systemId !== 'framework-growth' && a.systemId !== 'universal-catalyst'
    );

    // Group by tick for stacking
    const byTick = new Map();
    for (const action of filteredActions) {
      if (!byTick.has(action.tick)) {
        byTick.set(action.tick, []);
      }
      byTick.get(action.tick).push(action);
    }

    for (const [tick, actions] of byTick) {
      actions.forEach((action, stackIndex) => {
        // Era transitions get special highlighting
        const isEraTransition = !!action.details?.eraTransition;
        const uniqueId = `system-${tick}-${action.systemId}-${stackIndex}`;

        events.system.push({
          tick,
          uniqueId,
          systemId: action.systemId,
          systemName: action.systemName,
          data: action,
          stackIndex,
          totalAtTick: actions.length,
          isEraTransition,
          color: isEraTransition ? '#f59e0b' : EVENT_COLORS.system,
        });
      });
    }
  }

  // Process action applications (agent actions from universalCatalyst)
  // Only show successful actions
  if (actionApplications?.length) {
    const successfulActions = actionApplications.filter(app => app.outcome?.status === 'success');

    // Group actions by tick for horizontal stacking
    const byTick = new Map();
    for (const app of successfulActions) {
      if (!byTick.has(app.tick)) {
        byTick.set(app.tick, []);
      }
      byTick.get(app.tick).push(app);
    }

    // Create event markers with outcome-based coloring
    for (const [tick, apps] of byTick) {
      apps.forEach((app, stackIndex) => {
        // Color by outcome status: green for success, red for failure
        const color = app.outcome.status === 'success' ? '#22c55e' : '#ef4444';
        const uniqueId = `action-${tick}-${app.actionId}-${app.actorId}`;

        events.action.push({
          tick,
          uniqueId,
          actionId: app.actionId,
          actionName: app.actionName,
          data: app,
          stackIndex,
          totalAtTick: apps.length,
          color,
        });
      });
    }
  }

  return events;
}

/**
 * Extract era boundaries from actual era transitions (systemActions)
 * Falls back to epoch-based boundaries if no transition data available
 */
function formatEpochEraLabel(era, fallback) {
  if (!era) return fallback;
  const startName = era.start?.name;
  const endName = era.end?.name || startName;
  if (!startName) return fallback;
  if (!era.transitions || era.transitions.length === 0 || startName === endName) {
    return endName;
  }
  return `${startName} → ${endName}`;
}

function extractEraBoundaries(pressureUpdates, epochStats, systemActions) {
  if (!pressureUpdates?.length) return [];

  const minTick = pressureUpdates[0].tick;
  const maxTick = pressureUpdates[pressureUpdates.length - 1].tick;

  // Find era transitions from systemActions
  const eraTransitions = (systemActions || [])
    .filter(a => a.details?.eraTransition)
    .sort((a, b) => a.tick - b.tick);

  if (eraTransitions.length > 0) {
    // Use actual era transitions
    const boundaries = [];

    // First era: from start to first transition
    const firstTransition = eraTransitions[0];
    boundaries.push({
      era: firstTransition.details.eraTransition.fromEra,
      eraId: firstTransition.details.eraTransition.fromEraId,
      epoch: firstTransition.epoch,
      startTick: minTick,
      endTick: firstTransition.tick,
    });

    // Subsequent eras from transitions
    for (let i = 0; i < eraTransitions.length; i++) {
      const transition = eraTransitions[i];
      const nextTransition = eraTransitions[i + 1];

      boundaries.push({
        era: transition.details.eraTransition.toEra,
        eraId: transition.details.eraTransition.toEraId,
        epoch: transition.epoch,
        startTick: transition.tick,
        endTick: nextTransition?.tick ?? maxTick,
      });
    }

    return boundaries;
  }

  // Fallback: use epoch-based boundaries
  const boundaries = [];
  let currentEpoch = -1;
  let currentEra = null;
  let startTick = 0;

  for (const update of pressureUpdates) {
    if (update.epoch !== currentEpoch) {
      if (currentEra !== null) {
        boundaries.push({ era: currentEra, epoch: currentEpoch, startTick, endTick: update.tick });
      }
      currentEpoch = update.epoch;
      const epochStat = epochStats?.find(e => e.epoch === currentEpoch);
      currentEra = formatEpochEraLabel(epochStat?.era, `Epoch ${currentEpoch}`);
      startTick = update.tick;
    }
  }

  if (currentEra !== null) {
    boundaries.push({
      era: currentEra,
      epoch: currentEpoch,
      startTick,
      endTick: maxTick,
    });
  }

  return boundaries;
}

/**
 * Detail panel component for pressure breakdowns
 */
function DetailPanel({ selectedTick, lockedTick, breakdownsByTick, pressureIds, pressureData, onUnlock }) {
  const displayTick = lockedTick !== null ? lockedTick : selectedTick;
  const isLocked = lockedTick !== null;

  if (displayTick === null) {
    return (
      <div className="lw-trace-view-detail">
        <div className="lw-trace-view-detail-empty">
          <div className="lw-trace-view-detail-empty-icon">&#128200;</div>
          <div>Hover over the chart to see pressure attribution details</div>
          <div className="lw-trace-view-detail-hint">Click to lock selection</div>
        </div>
      </div>
    );
  }

  const tickBreakdowns = breakdownsByTick?.get(displayTick);
  if (!tickBreakdowns) {
    return (
      <div className="lw-trace-view-detail">
        <div className="lw-trace-view-detail-header">
          <span>Tick {displayTick}</span>
          {isLocked && (
            <button className="lw-trace-view-detail-unlock" onClick={onUnlock}>
              Unlock
            </button>
          )}
        </div>
        <div className="lw-trace-view-detail-empty">No breakdown data available</div>
      </div>
    );
  }

  return (
    <div className="lw-trace-view-detail">
      <div className="lw-trace-view-detail-header">
        <span>Tick {displayTick}</span>
        {isLocked ? (
          <button className="lw-trace-view-detail-unlock" onClick={onUnlock}>
            Unlock
          </button>
        ) : (
          <span className="lw-trace-view-detail-hint-inline">Click to lock</span>
        )}
      </div>

      <div className="lw-trace-view-detail-content">
        {pressureIds.map((id, i) => {
          const info = tickBreakdowns.get(id);
          if (!info) return null;

          const { name, value, previousValue, breakdown, discreteModifications, discreteTotal } = info;
          const delta = value - previousValue;
          const hasDiscrete = discreteModifications && discreteModifications.length > 0;

          return (
            <div
              key={id}
              className="lw-trace-view-detail-pressure"
              style={{ borderLeftColor: PRESSURE_COLORS[i % PRESSURE_COLORS.length] }}
            >
              <div className="lw-trace-view-detail-pressure-header">
                <span className="lw-trace-view-detail-pressure-name">{name}</span>
                <span className="lw-trace-view-detail-pressure-value">
                  {value.toFixed(1)}
                  <span className={`lw-trace-view-detail-delta ${delta >= 0 ? 'positive' : 'negative'}`}>
                    ({delta >= 0 ? '+' : ''}{delta.toFixed(2)})
                  </span>
                </span>
              </div>

              {hasDiscrete && (
                <div className="lw-trace-view-detail-discrete">
                  <div className="lw-trace-view-detail-section-header">Discrete Changes</div>
                  {discreteModifications.map((mod, j) => {
                    const sourceType = mod.source?.type || 'unknown';
                    const sourceId = mod.source?.templateId || mod.source?.systemId || mod.source?.actionId || 'unknown';
                    return (
                      <div key={j} className="lw-trace-view-detail-row">
                        <span className="lw-trace-view-detail-label">
                          <span
                            className="lw-trace-view-discrete-badge"
                            style={{ color: EVENT_COLORS[sourceType] || '#888' }}
                          >
                            {sourceType === 'template' ? '▲' : sourceType === 'system' ? '◆' : '●'}
                          </span>
                          {sourceId}
                        </span>
                        <span className={mod.delta >= 0 ? 'positive' : 'negative'}>
                          {mod.delta >= 0 ? '+' : ''}{mod.delta.toFixed(3)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {breakdown && (
                <div className="lw-trace-view-detail-breakdown">
                  <div className="lw-trace-view-detail-section-header">Feedback</div>

                  {/* Positive feedback */}
                  {breakdown.positiveFeedback?.filter(fb => fb.contribution !== 0).map((fb, k) => (
                    <div key={`pos-${k}`} className="lw-trace-view-detail-row">
                      <span className="lw-trace-view-detail-label">
                        <span className="lw-trace-view-feedback-badge positive">+</span>
                        {fb.label}
                      </span>
                      <span className="positive">+{fb.contribution.toFixed(3)}</span>
                    </div>
                  ))}

                  {/* Negative feedback */}
                  {breakdown.negativeFeedback?.filter(fb => fb.contribution !== 0).map((fb, k) => (
                    <div key={`neg-${k}`} className="lw-trace-view-detail-row">
                      <span className="lw-trace-view-detail-label">
                        <span className="lw-trace-view-feedback-badge negative">−</span>
                        {fb.label}
                      </span>
                      <span className="negative">{fb.contribution.toFixed(3)}</span>
                    </div>
                  ))}

                  {/* Homeostasis */}
                  {breakdown.homeostasis !== 0 && (
                    <div className="lw-trace-view-detail-row">
                      <span className="lw-trace-view-detail-label">Homeostasis</span>
                      <span className={breakdown.homeostaticDelta >= 0 ? 'positive' : 'negative'}>
                        {breakdown.homeostaticDelta >= 0 ? '+' : ''}{breakdown.homeostaticDelta.toFixed(3)}
                      </span>
                    </div>
                  )}

                  {/* Era modifier if not 1 */}
                  {breakdown.eraModifier && breakdown.eraModifier !== 1 && (
                    <div className="lw-trace-view-detail-row lw-trace-view-detail-row-muted">
                      <span className="lw-trace-view-detail-label">Era modifier</span>
                      <span>×{breakdown.eraModifier.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Growth scaling if not 1 */}
                  {breakdown.growthScaling && breakdown.growthScaling !== 1 && (
                    <div className="lw-trace-view-detail-row lw-trace-view-detail-row-muted">
                      <span className="lw-trace-view-detail-label">Growth scaling</span>
                      <span>×{breakdown.growthScaling.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Feedback subtotal */}
                  <div className="lw-trace-view-detail-row lw-trace-view-detail-subtotal">
                    <span className="lw-trace-view-detail-label">Net Δ (smoothed)</span>
                    <span className={breakdown.smoothedDelta >= 0 ? 'positive' : 'negative'}>
                      {breakdown.smoothedDelta >= 0 ? '+' : ''}{breakdown.smoothedDelta.toFixed(3)}
                    </span>
                  </div>
                </div>
              )}

              {/* Total delta */}
              <div className="lw-trace-view-detail-row lw-trace-view-detail-total">
                <span className="lw-trace-view-detail-label">Total Δ</span>
                <span className={delta >= 0 ? 'positive' : 'negative'}>
                  {delta >= 0 ? '+' : ''}{delta.toFixed(3)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Template detail panel
 */
function TemplateDetailPanel({ template, isLocked, onClear }) {
  if (!template) {
    return (
      <div className="lw-trace-view-detail">
        <div className="lw-trace-view-detail-empty">
          <div className="lw-trace-view-detail-empty-icon">▲</div>
          <div>Hover over a template icon to see details</div>
          <div className="lw-trace-view-detail-hint">Click to lock selection</div>
        </div>
      </div>
    );
  }

  const app = template;
  // Get color from first entity created
  const firstEntityKind = app.entitiesCreated?.[0]?.kind || null;
  const markerColor = getEntityKindColor(firstEntityKind);

  return (
    <div className="lw-trace-view-detail">
      <div className="lw-trace-view-detail-header">
        <span>
          <span style={{ color: markerColor, marginRight: 6 }}>▲</span>
          Tick {app.tick} / Epoch {app.epoch}
        </span>
        {isLocked && (
          <button className="lw-trace-view-detail-unlock" onClick={onClear}>
            Clear
          </button>
        )}
      </div>

      <div className="lw-trace-view-detail-content">
        <div className="lw-trace-view-template-app">
          <div className="lw-trace-view-template-header">
            <span className="lw-trace-view-template-id">{app.templateId}</span>
            <span className="lw-trace-view-template-target">
              to {app.targetEntityName} ({app.targetEntityKind})
            </span>
          </div>

          {app.description && (
            <div className="lw-trace-view-template-desc">{app.description}</div>
          )}

          {app.entitiesCreated?.length > 0 && (
            <div className="lw-trace-view-template-section">
              <div className="lw-trace-view-detail-section-header">
                Entities Created ({app.entitiesCreated.length})
              </div>
              {app.entitiesCreated.map((entity, j) => (
                <div key={j} className="lw-trace-view-entity-card">
                  {/* Identity */}
                  <div className="lw-trace-view-entity-identity">
                    <span className="lw-trace-view-entity-name">{entity.name}</span>
                    <span className="lw-trace-view-entity-kind">
                      {entity.kind}/{entity.subtype}
                    </span>
                  </div>

                  {/* Attributes row */}
                  <div className="lw-trace-view-entity-attrs">
                    <div className="lw-trace-view-entity-attr">
                      <span className="lw-trace-view-entity-attr-label">Culture</span>
                      <span className="lw-trace-view-entity-attr-value">{entity.culture}</span>
                    </div>
                    <div className="lw-trace-view-entity-attr">
                      <span className="lw-trace-view-entity-attr-label">Prominence</span>
                      <span className="lw-trace-view-entity-attr-value">{entity.prominence}</span>
                    </div>
                  </div>

                  {/* Placement section */}
                  <div className="lw-trace-view-entity-placement">
                    <div className="lw-trace-view-entity-section-label">Placement</div>
                    <div className="lw-trace-view-entity-placement-grid">
                      {/* Anchor type requested */}
                      <div className="lw-trace-view-entity-placement-row">
                        <span className="lw-trace-view-entity-placement-label">Anchor</span>
                        <span className="lw-trace-view-entity-placement-value">
                          <span className={`lw-trace-view-anchor-badge ${entity.placement?.anchorType || 'unknown'}`}>
                            {entity.placement?.anchorType || entity.placementStrategy}
                          </span>
                        </span>
                      </div>

                      {/* How it was actually resolved */}
                      <div className="lw-trace-view-entity-placement-row">
                        <span className="lw-trace-view-entity-placement-label">Resolved Via</span>
                        <span className="lw-trace-view-entity-placement-value">
                        <span
                          className={`lw-trace-view-resolved-badge ${(entity.placement?.resolvedVia || 'unknown').replace(/_/g, '-')}`}
                        >
                            {entity.placement?.resolvedVia || entity.placementStrategy}
                          </span>
                          {entity.placement?.resolvedVia === 'random' && (
                            <span className="lw-trace-view-fallback-badge">fallback</span>
                          )}
                        </span>
                      </div>

                      {/* Anchor entity (for entity anchors) */}
                      {entity.placement?.anchorEntity && (
                        <div className="lw-trace-view-entity-placement-row">
                          <span className="lw-trace-view-entity-placement-label">Near Entity</span>
                          <span className="lw-trace-view-entity-placement-value">
                            <span className="lw-trace-view-anchor-entity">
                              {entity.placement.anchorEntity.name}
                            </span>
                            <span className="lw-trace-view-anchor-entity-kind">
                              ({entity.placement.anchorEntity.kind})
                            </span>
                          </span>
                        </div>
                      )}

                      {/* Culture used for placement */}
                      {entity.placement?.anchorCulture && (
                        <div className="lw-trace-view-entity-placement-row">
                          <span className="lw-trace-view-entity-placement-label">Culture</span>
                          <span className="lw-trace-view-entity-placement-value">
                            {entity.placement.anchorCulture}
                          </span>
                        </div>
                      )}

                      {/* Seed regions available */}
                      {entity.placement?.seedRegionsAvailable?.length > 0 && (
                        <div className="lw-trace-view-entity-placement-row">
                          <span className="lw-trace-view-entity-placement-label">Seed Regions</span>
                          <span className="lw-trace-view-entity-placement-value">
                            {entity.placement.seedRegionsAvailable.length} available
                          </span>
                        </div>
                      )}

                      {/* Emergent region created */}
                      {entity.placement?.emergentRegionCreated && (
                        <div className="lw-trace-view-entity-placement-row">
                          <span className="lw-trace-view-entity-placement-label">Emergent Region</span>
                          <span className="lw-trace-view-entity-placement-value">
                            <span className="lw-trace-view-emergent-badge">
                              + {entity.placement.emergentRegionCreated.label}
                            </span>
                          </span>
                        </div>
                      )}

                      {/* Coordinates */}
                      {entity.coordinates && (
                        <div className="lw-trace-view-entity-placement-row">
                          <span className="lw-trace-view-entity-placement-label">Coordinates</span>
                          <span className="lw-trace-view-entity-placement-value mono">
                            ({entity.coordinates.x.toFixed(1)}, {entity.coordinates.y.toFixed(1)}, {entity.coordinates.z?.toFixed(1) ?? '0.0'})
                          </span>
                        </div>
                      )}

                      {/* Final region */}
                      {entity.regionId && (
                        <div className="lw-trace-view-entity-placement-row">
                          <span className="lw-trace-view-entity-placement-label">Region</span>
                          <span className="lw-trace-view-entity-placement-value">
                            <span className="lw-trace-view-region-badge">{entity.regionId}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tags section */}
                  {Object.keys(entity.tags || {}).length > 0 && (
                    <div className="lw-trace-view-entity-tags-section">
                      <div className="lw-trace-view-entity-section-label">Tags</div>
                      <div className="lw-trace-view-entity-tags">
                        {Object.entries(entity.tags).map(([tag, val]) => (
                          <span key={tag} className="lw-trace-view-tag">
                            {tag}{val !== true ? `:${val}` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Derived tags from placement */}
                  {entity.derivedTags && Object.keys(entity.derivedTags).length > 0 && (
                    <div className="lw-trace-view-entity-derived-section">
                      <div className="lw-trace-view-entity-section-label">Derived from Placement</div>
                      <div className="lw-trace-view-entity-tags">
                        {Object.entries(entity.derivedTags).map(([tag, val]) => (
                          <span key={tag} className="lw-trace-view-tag derived">
                            {tag}{val !== true ? `:${val}` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Relationships Created */}
          {app.relationshipsCreated?.length > 0 && (
            <div className="lw-trace-view-template-section">
              <div className="lw-trace-view-detail-section-header">
                Relationships ({app.relationshipsCreated.length})
              </div>
              {app.relationshipsCreated.slice(0, 5).map((rel, j) => (
                <div key={j} className="lw-trace-view-detail-row">
                  <span className="lw-trace-view-rel-kind">{rel.kind}</span>
                  <span className="lw-trace-view-rel-ids">
                    {rel.srcId?.slice(0, 8)}... → {rel.dstId?.slice(0, 8)}...
                  </span>
                </div>
              ))}
              {app.relationshipsCreated.length > 5 && (
                <div className="lw-trace-view-detail-row lw-trace-view-detail-row-muted">
                  +{app.relationshipsCreated.length - 5} more
                </div>
              )}
            </div>
          )}

          {/* Pressure Changes */}
          {Object.keys(app.pressureChanges || {}).length > 0 && (
            <div className="lw-trace-view-template-section">
              <div className="lw-trace-view-detail-section-header">Pressure Changes</div>
              {Object.entries(app.pressureChanges).map(([pressureId, delta]) => (
                <div key={pressureId} className="lw-trace-view-detail-row">
                  <span className="lw-trace-view-detail-label">{pressureId}</span>
                  <span className={delta >= 0 ? 'positive' : 'negative'}>
                    {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * System action detail panel - shows system activity, especially era transitions
 */
function SystemActionDetailPanel({ systemAction, isEraTransition, isLocked, onClear }) {
  if (!systemAction) {
    return (
      <div className="lw-trace-view-detail">
        <div className="lw-trace-view-detail-empty">
          <div className="lw-trace-view-detail-empty-icon">&#9632;</div>
          <div>Hover over a system marker to see details</div>
          <div className="lw-trace-view-detail-hint">Click to lock selection</div>
        </div>
      </div>
    );
  }

  const action = systemAction;
  const eraTransition = action.details?.eraTransition;

  return (
    <div className="lw-trace-view-detail">
      <div className="lw-trace-view-detail-header">
        <span>
          <span style={{ color: isEraTransition ? '#f59e0b' : EVENT_COLORS.system, marginRight: 6 }}>
            {isEraTransition ? '★' : '■'}
          </span>
          Tick {action.tick} / Epoch {action.epoch}
        </span>
        {isLocked && (
          <button className="lw-trace-view-detail-unlock" onClick={onClear}>
            Clear
          </button>
        )}
      </div>

      <div className="lw-trace-view-detail-content">
        <div className="lw-trace-view-template-app">
          <div className="lw-trace-view-template-header">
            <span className="lw-trace-view-template-id">{action.systemName}</span>
            <span className="lw-trace-view-template-target">
              ({action.systemId})
            </span>
          </div>

          {action.description && (
            <div className="lw-trace-view-template-desc">{action.description}</div>
          )}

          {/* Era Transition Details */}
          {eraTransition && (
            <div className="lw-trace-view-template-section">
              <div className="lw-trace-view-detail-section-header">
                Era Transition
              </div>
              <div className="lw-trace-view-era-transition">
                <div className="lw-trace-view-era-flow">
                  <span className="lw-trace-view-era-from">{eraTransition.fromEra}</span>
                  <span className="lw-trace-view-era-arrow">→</span>
                  <span className="lw-trace-view-era-to">{eraTransition.toEra}</span>
                </div>

                <div className="lw-trace-view-entity-placement-grid">
                  <div className="lw-trace-view-entity-placement-row">
                    <span className="lw-trace-view-entity-placement-label">Duration</span>
                    <span className="lw-trace-view-entity-placement-value">
                      {eraTransition.tickInEra} ticks
                    </span>
                  </div>

                  <div className="lw-trace-view-entity-placement-row">
                    <span className="lw-trace-view-entity-placement-label">From Era ID</span>
                    <span className="lw-trace-view-entity-placement-value mono">
                      {eraTransition.fromEraId}
                    </span>
                  </div>

                  <div className="lw-trace-view-entity-placement-row">
                    <span className="lw-trace-view-entity-placement-label">To Era ID</span>
                    <span className="lw-trace-view-entity-placement-value mono">
                      {eraTransition.toEraId}
                    </span>
                  </div>

                  {eraTransition.prominentEntitiesLinked > 0 && (
                    <div className="lw-trace-view-entity-placement-row">
                      <span className="lw-trace-view-entity-placement-label">Entities Linked</span>
                      <span className="lw-trace-view-entity-placement-value">
                        {eraTransition.prominentEntitiesLinked} prominent entities
                      </span>
                    </div>
                  )}
                </div>

                {/* Exit conditions that triggered transition */}
                {eraTransition.exitConditionsMet?.length > 0 && (
                  <div className="lw-trace-view-entity-tags-section">
                    <div className="lw-trace-view-entity-section-label">Exit Conditions Met</div>
                    <div className="lw-trace-view-entity-tags">
                      {eraTransition.exitConditionsMet.map((cond, i) => (
                        <span key={i} className="lw-trace-view-tag">
                          {cond.type}
                          {cond.pressureId && `: ${cond.pressureId} ${cond.operator} ${cond.threshold}`}
                          {cond.entityKind && `: ${cond.entityKind} ${cond.operator} ${cond.threshold}`}
                          {cond.minTicks && `: ${cond.currentAge}/${cond.minTicks} ticks`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Summary stats */}
          <div className="lw-trace-view-template-section">
            <div className="lw-trace-view-detail-section-header">Activity Summary</div>
            <div className="lw-trace-view-entity-placement-grid">
              <div className="lw-trace-view-entity-placement-row">
                <span className="lw-trace-view-entity-placement-label">Relationships Added</span>
                <span className="lw-trace-view-entity-placement-value">
                  {action.relationshipsAdded}
                </span>
              </div>
              <div className="lw-trace-view-entity-placement-row">
                <span className="lw-trace-view-entity-placement-label">Entities Modified</span>
                <span className="lw-trace-view-entity-placement-value">
                  {action.entitiesModified}
                </span>
              </div>
            </div>
          </div>

          {/* Pressure Changes */}
          {Object.keys(action.pressureChanges || {}).length > 0 && (
            <div className="lw-trace-view-template-section">
              <div className="lw-trace-view-detail-section-header">Pressure Changes</div>
              {Object.entries(action.pressureChanges).map(([pressureId, delta]) => (
                <div key={pressureId} className="lw-trace-view-detail-row">
                  <span className="lw-trace-view-detail-label">{pressureId}</span>
                  <span className={delta >= 0 ? 'positive' : 'negative'}>
                    {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Action detail panel - shows agent action breakdown
 */
function ActionDetailPanel({ actionApplication, isLocked, onClear }) {
  if (!actionApplication) {
    return (
      <div className="lw-trace-view-detail">
        <div className="lw-trace-view-detail-empty">
          <div className="lw-trace-view-detail-empty-icon">●</div>
          <div>Hover over an action marker to see details</div>
          <div className="lw-trace-view-detail-hint">Click to lock selection</div>
        </div>
      </div>
    );
  }

  const app = actionApplication;
  const outcomeColors = {
    success: '#22c55e',
    failed_roll: '#ef4444',
    failed_no_target: '#f59e0b',
    failed_no_instigator: '#f59e0b',
  };
  const outcomeLabels = {
    success: 'Success',
    failed_roll: 'Failed Roll',
    failed_no_target: 'No Target',
    failed_no_instigator: 'No Instigator',
  };

  return (
    <div className="lw-trace-view-detail">
      <div className="lw-trace-view-detail-header">
        <span>
          <span style={{ color: outcomeColors[app.outcome.status] || '#888', marginRight: 6 }}>●</span>
          Tick {app.tick} / Epoch {app.epoch}
        </span>
        {isLocked && (
          <button className="lw-trace-view-detail-unlock" onClick={onClear}>
            Clear
          </button>
        )}
      </div>

      <div className="lw-trace-view-detail-content">
        <div className="lw-trace-view-template-app">
          {/* Action header with outcome badge */}
          <div className="lw-trace-view-template-header">
            <span className="lw-trace-view-template-id">{app.actionName}</span>
            <span
              className="lw-trace-view-outcome-badge"
              style={{
                backgroundColor: outcomeColors[app.outcome.status] || '#888',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              {outcomeLabels[app.outcome.status] || app.outcome.status}
            </span>
          </div>

          {app.outcome.description && (
            <div className="lw-trace-view-template-desc">{app.outcome.description}</div>
          )}

          {/* Participants section */}
          <div className="lw-trace-view-template-section">
            <div className="lw-trace-view-detail-section-header">Participants</div>
            <div className="lw-trace-view-entity-placement-grid">
              {/* Actor (always present) */}
              <div className="lw-trace-view-entity-placement-row">
                <span className="lw-trace-view-entity-placement-label">Actor</span>
                <span className="lw-trace-view-entity-placement-value">
                  <span className="lw-trace-view-anchor-entity">{app.actorName}</span>
                  <span className="lw-trace-view-anchor-entity-kind">
                    ({app.actorKind})
                  </span>
                </span>
              </div>

              <div className="lw-trace-view-entity-placement-row">
                <span className="lw-trace-view-entity-placement-label">Prominence</span>
                <span className="lw-trace-view-entity-placement-value">
                  {app.actorProminence}
                </span>
              </div>

              {/* Instigator (optional) */}
              {app.instigatorId && (
                <div className="lw-trace-view-entity-placement-row">
                  <span className="lw-trace-view-entity-placement-label">Instigator</span>
                  <span className="lw-trace-view-entity-placement-value">
                    <span className="lw-trace-view-anchor-entity">{app.instigatorName || app.instigatorId}</span>
                  </span>
                </div>
              )}

              {/* Target (optional) */}
              {app.targetId && (
                <div className="lw-trace-view-entity-placement-row">
                  <span className="lw-trace-view-entity-placement-label">Target</span>
                  <span className="lw-trace-view-entity-placement-value">
                    <span className="lw-trace-view-anchor-entity">{app.targetName}</span>
                    {app.targetKind && (
                      <span className="lw-trace-view-anchor-entity-kind">({app.targetKind})</span>
                    )}
                  </span>
                </div>
              )}

              {/* Second target (optional) */}
              {app.target2Id && (
                <div className="lw-trace-view-entity-placement-row">
                  <span className="lw-trace-view-entity-placement-label">Target 2</span>
                  <span className="lw-trace-view-entity-placement-value">
                    <span className="lw-trace-view-anchor-entity">{app.target2Name || app.target2Id}</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Selection context - why this action was chosen */}
          <div className="lw-trace-view-template-section">
            <div className="lw-trace-view-detail-section-header">Selection Context</div>
            <div className="lw-trace-view-entity-placement-grid">
              <div className="lw-trace-view-entity-placement-row">
                <span className="lw-trace-view-entity-placement-label">Available Actions</span>
                <span className="lw-trace-view-entity-placement-value">
                  {app.selectionContext.availableActionCount}
                </span>
              </div>

              <div className="lw-trace-view-entity-placement-row">
                <span className="lw-trace-view-entity-placement-label">Selected Weight</span>
                <span className="lw-trace-view-entity-placement-value">
                  {app.selectionContext.selectedWeight.toFixed(2)} / {app.selectionContext.totalWeight.toFixed(2)}
                  <span style={{ color: '#64748b', marginLeft: 4 }}>
                    ({((app.selectionContext.selectedWeight / app.selectionContext.totalWeight) * 100).toFixed(0)}%)
                  </span>
                </span>
              </div>

              <div className="lw-trace-view-entity-placement-row">
                <span className="lw-trace-view-entity-placement-label">Attempt Chance</span>
                <span className="lw-trace-view-entity-placement-value">
                  {(app.selectionContext.attemptChance * 100).toFixed(0)}%
                  {app.selectionContext.prominenceBonus > 0 && (
                    <span className="positive" style={{ marginLeft: 4 }}>
                      (+{(app.selectionContext.prominenceBonus * 100).toFixed(0)}% pressure bonus)
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Pressure influences breakdown - affects selection weight only, NOT success chance */}
            {app.selectionContext.pressureInfluences?.length > 0 && (
              <div className="lw-trace-view-detail-discrete" style={{ marginTop: 8 }}>
                <div className="lw-trace-view-detail-section-header">Pressure Influences (on selection weight)</div>
                {app.selectionContext.pressureInfluences.map((influence, i) => (
                  <div key={i} className="lw-trace-view-detail-row">
                    <span className="lw-trace-view-detail-label">
                      {influence.pressureId}
                      <span style={{ color: '#64748b', marginLeft: 4 }}>
                        ({influence.value.toFixed(0)} × {influence.multiplier.toFixed(1)})
                      </span>
                    </span>
                    <span className={influence.contribution >= 0 ? 'positive' : 'negative'}>
                      {influence.contribution >= 0 ? '+' : ''}{influence.contribution.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outcome details */}
          <div className="lw-trace-view-template-section">
            <div className="lw-trace-view-detail-section-header">Outcome (roll-based)</div>
            <div className="lw-trace-view-entity-placement-grid">
              <div className="lw-trace-view-entity-placement-row">
                <span className="lw-trace-view-entity-placement-label">Success Chance</span>
                <span className="lw-trace-view-entity-placement-value">
                  {(app.outcome.successChance * 100).toFixed(0)}%
                  <span style={{ color: '#64748b', marginLeft: 4 }}>
                    (base × {app.outcome.prominenceMultiplier.toFixed(1)} prominence)
                  </span>
                </span>
              </div>
            </div>

            {/* Relationships created */}
            {app.outcome.relationshipsCreated?.length > 0 && (
              <div className="lw-trace-view-detail-discrete" style={{ marginTop: 8 }}>
                <div className="lw-trace-view-detail-section-header">
                  Relationships Created ({app.outcome.relationshipsCreated.length})
                </div>
                {app.outcome.relationshipsCreated.slice(0, 5).map((rel, i) => (
                  <div key={i} className="lw-trace-view-detail-row">
                    <span className="lw-trace-view-rel-kind">{rel.kind}</span>
                    <span className="lw-trace-view-rel-ids">
                      {rel.srcName} → {rel.dstName}
                      {rel.strength !== undefined && (
                        <span style={{ color: '#64748b', marginLeft: 4 }}>
                          (str: {rel.strength.toFixed(2)})
                        </span>
                      )}
                    </span>
                  </div>
                ))}
                {app.outcome.relationshipsCreated.length > 5 && (
                  <div className="lw-trace-view-detail-row lw-trace-view-detail-row-muted">
                    +{app.outcome.relationshipsCreated.length - 5} more
                  </div>
                )}
              </div>
            )}

            {/* Prominence changes */}
            {app.outcome.prominenceChanges?.length > 0 && (
              <div className="lw-trace-view-detail-discrete" style={{ marginTop: 8 }}>
                <div className="lw-trace-view-detail-section-header">Prominence Changes</div>
                {app.outcome.prominenceChanges.map((change, i) => (
                  <div key={i} className="lw-trace-view-detail-row">
                    <span className="lw-trace-view-detail-label">{change.entityName}</span>
                    <span className={change.direction === 'up' ? 'positive' : 'negative'}>
                      {change.direction === 'up' ? '↑' : '↓'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Main trace visualization component
 */
function TraceVisualization({
  width,
  height,
  pressureData,
  pressureIds,
  eventData,
  eraBoundaries,
  hiddenPressures,
  selectedTick,
  lockedTick,
  hoveredEventId,
  selectedEventId,
  onTickHover,
  onTickClick,
  onEventHover,
  onEventClick,
  scrollOffset,
  onScrollChange,
}) {
  // Tooltip state
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef(null);

  // Calculate layout dimensions from top to bottom:
  // Space needed for x-axis labels below the chart line
  const X_AXIS_LABEL_SPACE = 25;
  const BOTTOM_PADDING = 10;

  // 1. Era timeline at top
  const eraTimelineY = DEFAULT_MARGIN.top;

  // 2. Chart starts below era timeline
  const chartTop = eraTimelineY + ERA_TIMELINE_HEIGHT + 8;

  // 3. Chart bottom (leaving room for x-axis labels and padding)
  const chartBottom = height - X_AXIS_LABEL_SPACE - BOTTOM_PADDING;

  // 4. Chart area height
  const pressureChartHeight = chartBottom - chartTop;

  const margin = useMemo(
    () => ({
      ...DEFAULT_MARGIN,
      top: chartTop,
      bottom: height - chartBottom,
    }),
    [chartTop, chartBottom, height]
  );

  // Marker stacking configuration
  const MARKER_SIZE = 10;
  const MARKER_STACK_OFFSET = 12;

  // Compute visible data slice
  const { visibleData, maxScrollOffset, currentOffset } = useMemo(() => {
    if (pressureData.length <= VISIBLE_TICKS) {
      return {
        visibleData: pressureData,
        maxScrollOffset: 0,
        currentOffset: 0
      };
    }

    const maxOffset = pressureData.length - VISIBLE_TICKS;
    const offset = scrollOffset === null ? maxOffset : Math.min(scrollOffset, maxOffset);
    const sliced = pressureData.slice(offset, offset + VISIBLE_TICKS);

    return {
      visibleData: sliced,
      maxScrollOffset: maxOffset,
      currentOffset: offset
    };
  }, [pressureData, scrollOffset]);

  // Filter events to visible range
  const visibleEvents = useMemo(() => {
    if (!visibleData.length) return eventData;

    const startTick = visibleData[0]?.tick ?? 0;
    const endTick = visibleData[visibleData.length - 1]?.tick ?? Infinity;

    return {
      template: eventData.template.filter(e => e.tick >= startTick && e.tick <= endTick),
      system: eventData.system.filter(e => e.tick >= startTick && e.tick <= endTick),
      action: eventData.action.filter(e => e.tick >= startTick && e.tick <= endTick),
    };
  }, [eventData, visibleData]);

  // Filter era boundaries to visible range
  const visibleEraBoundaries = useMemo(() => {
    if (!visibleData.length) return eraBoundaries;

    const startTick = visibleData[0]?.tick ?? 0;
    const endTick = visibleData[visibleData.length - 1]?.tick ?? Infinity;

    return eraBoundaries.filter(era =>
      era.endTick >= startTick && era.startTick <= endTick
    ).map(era => ({
      ...era,
      startTick: Math.max(era.startTick, startTick),
      endTick: Math.min(era.endTick, endTick),
    }));
  }, [eraBoundaries, visibleData]);

  // Create scales
  const xScale = useMemo(
    () => createXScale(visibleData, width, margin),
    [visibleData, width, margin]
  );

  const yScale = useMemo(
    () => createPressureYScale(visibleData, pressureIds, chartBottom, margin),
    [visibleData, pressureIds, chartBottom, margin]
  );

  // Mouse tracking ref
  const lastHoverRef = useRef(0);
  const THROTTLE_MS = 50;

  const handleMouseMove = useCallback((event) => {
    if (lockedTick !== null) {
      setTooltip(null);
      return;
    }

    const now = Date.now();
    if (now - lastHoverRef.current < THROTTLE_MS) return;
    lastHoverRef.current = now;

    // The overlay rect starts at margin.left, so we need to add margin.left
    // to convert from rect-relative coords to SVG coords for xScale
    const rectBounds = event.currentTarget.getBoundingClientRect();
    const xInRect = event.clientX - rectBounds.left;
    const yInRect = event.clientY - rectBounds.top;
    const xInSvg = xInRect + margin.left;

    // Find closest tick
    const tickValue = xScale.invert(xInSvg);
    const closestPoint = visibleData.reduce((closest, point) => {
      const dist = Math.abs(point.tick - tickValue);
      return dist < Math.abs(closest.tick - tickValue) ? point : closest;
    }, visibleData[0]);

    if (closestPoint) {
      onTickHover(closestPoint.tick);

      // Build tooltip with pressure values
      const pressureValues = pressureIds
        .filter(id => !hiddenPressures.has(id))
        .map((id, i) => ({
          name: closestPoint[`${id}_name`] || id,
          value: closestPoint[id],
          color: PRESSURE_COLORS[i % PRESSURE_COLORS.length],
        }));

      setTooltip({
        x: event.clientX,
        y: event.clientY,
        tick: closestPoint.tick,
        epoch: closestPoint.epoch,
        pressures: pressureValues,
      });
    }
  }, [xScale, visibleData, lockedTick, onTickHover, margin.left, pressureIds, hiddenPressures]);

  const handleMouseLeave = useCallback(() => {
    if (lockedTick === null) {
      setTooltip(null);
    }
  }, [lockedTick]);

  const handleClick = useCallback((event) => {
    // Same coordinate conversion as handleMouseMove
    const rectBounds = event.currentTarget.getBoundingClientRect();
    const xInRect = event.clientX - rectBounds.left;
    const xInSvg = xInRect + margin.left;

    const tickValue = xScale.invert(xInSvg);
    const closestPoint = visibleData.reduce((closest, point) => {
      const dist = Math.abs(point.tick - tickValue);
      return dist < Math.abs(closest.tick - tickValue) ? point : closest;
    }, visibleData[0]);

    if (closestPoint) {
      onTickClick(closestPoint.tick);
    }
  }, [xScale, visibleData, onTickClick, margin.left]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <svg width={width} height={height} style={{ cursor: 'crosshair' }}>
          {/* Era timeline at top */}
          <EraTimeline
            eraBoundaries={visibleEraBoundaries}
            xScale={xScale}
            y={eraTimelineY}
            height={ERA_TIMELINE_HEIGHT}
            width={width}
            margin={margin}
          />

          {/* Era backgrounds in chart area */}
          {pressureChartHeight > 0 && visibleEraBoundaries.map((era, i) => {
            const eraWidth = xScale(era.endTick) - xScale(era.startTick);
            if (eraWidth <= 0) return null;
            return (
              <rect
                key={`era-bg-${i}`}
                x={xScale(era.startTick)}
                y={margin.top}
                width={eraWidth}
                height={pressureChartHeight}
                fill={ERA_COLORS[i % ERA_COLORS.length]}
              />
            );
          })}

          {/* Pressure chart */}
          <PressureChart
            data={visibleData}
            pressureIds={pressureIds}
            hiddenPressures={hiddenPressures}
            xScale={xScale}
            yScale={yScale}
            margin={margin}
            height={chartBottom}
            width={width}
          />

          {/* Reference lines for selected/hovered tick */}
          {lockedTick !== null && visibleData.some(d => d.tick === lockedTick) && (
            <line
              x1={xScale(lockedTick)}
              y1={margin.top}
              x2={xScale(lockedTick)}
              y2={chartBottom}
              stroke="#22c55e"
              strokeWidth={2}
            />
          )}
          {lockedTick === null && selectedTick !== null && visibleData.some(d => d.tick === selectedTick) && (
            <line
              x1={xScale(selectedTick)}
              y1={margin.top}
              x2={xScale(selectedTick)}
              y2={chartBottom}
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
          )}

          {/* Invisible overlay for mouse events (pressure hover) */}
          <rect
            x={margin.left}
            y={margin.top}
            width={Math.max(0, width - margin.left - margin.right)}
            height={Math.max(0, pressureChartHeight)}
            fill="transparent"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
          />

          {/* Template markers - rendered AFTER overlay so they're on top and receive events */}
          {visibleEvents.template.map((event) => {
            // Position at tick + 0.5 to differentiate from pressure hover
            const cx = xScale(event.tick + 0.5);
            // Stack from bottom of chart, going upward
            const cy = chartBottom - 10 - (event.stackIndex * MARKER_STACK_OFFSET);
            const isHovered = event.uniqueId === hoveredEventId;
            const isSelected = event.uniqueId === selectedEventId;
            const size = isSelected ? MARKER_SIZE + 3 : isHovered ? MARKER_SIZE + 2 : MARKER_SIZE;
            const opacity = isSelected ? 1 : isHovered ? 0.9 : 0.7;

            // Triangle pointing up
            const h = size * 0.866;
            const points = `${cx},${cy - size * 0.6} ${cx - h * 0.6},${cy + size * 0.4} ${cx + h * 0.6},${cy + size * 0.4}`;

            return (
              <g
                key={event.uniqueId}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => onEventHover(event.uniqueId)}
                onMouseLeave={() => onEventHover(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick(event.uniqueId);
                }}
              >
                <polygon
                  points={points}
                  fill={event.color}
                  fillOpacity={opacity}
                  stroke={isSelected ? '#fff' : isHovered ? event.color : 'rgba(0,0,0,0.3)'}
                  strokeWidth={isSelected ? 2 : 1}
                />
                {/* Show count badge if many at same tick and this is the top one */}
                {event.stackIndex === event.totalAtTick - 1 && event.totalAtTick > 3 && (
                  <g>
                    <circle
                      cx={cx + 8}
                      cy={cy - 6}
                      r={7}
                      fill="rgba(0,0,0,0.8)"
                      stroke={event.color}
                      strokeWidth={1}
                    />
                    <text
                      x={cx + 8}
                      y={cy - 6}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#fff"
                      fontSize={9}
                      fontWeight={600}
                    >
                      {event.totalAtTick}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* System action markers - rendered AFTER template markers */}
          {visibleEvents.system.map((event) => {
            // Position at tick + 0.5, but offset vertically from templates
            const cx = xScale(event.tick + 0.5);
            // Stack above templates - use margin.top area for system events
            const cy = margin.top - 10 - (event.stackIndex * MARKER_STACK_OFFSET);
            const isHovered = event.uniqueId === hoveredEventId;
            const isSelected = event.uniqueId === selectedEventId;
            const size = isSelected ? MARKER_SIZE + 3 : isHovered ? MARKER_SIZE + 2 : MARKER_SIZE;
            const opacity = isSelected ? 1 : isHovered ? 0.9 : 0.7;

            // Era transitions get a star shape, other systems get a diamond
            if (event.isEraTransition) {
              // Star shape for era transitions
              const outerRadius = size * 0.8;
              const innerRadius = size * 0.4;
              const points = [];
              for (let i = 0; i < 10; i++) {
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const angle = (i * Math.PI / 5) - Math.PI / 2;
                points.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
              }

              return (
                <g
                  key={event.uniqueId}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => onEventHover(event.uniqueId)}
                  onMouseLeave={() => onEventHover(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick(event.uniqueId);
                  }}
                >
                  <polygon
                    points={points.join(' ')}
                    fill={event.color}
                    fillOpacity={opacity}
                    stroke={isSelected ? '#fff' : isHovered ? event.color : 'rgba(0,0,0,0.3)'}
                    strokeWidth={isSelected ? 2 : 1}
                  />
                  {/* Vertical line extending into chart for era transitions */}
                  <line
                    x1={cx}
                    y1={cy + outerRadius}
                    x2={cx}
                    y2={chartBottom}
                    stroke={event.color}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    strokeOpacity={0.5}
                  />
                </g>
              );
            } else {
              // Diamond shape for other system actions
              const halfSize = size * 0.6;
              const points = `${cx},${cy - halfSize} ${cx + halfSize},${cy} ${cx},${cy + halfSize} ${cx - halfSize},${cy}`;

              return (
                <g
                  key={event.uniqueId}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => onEventHover(event.uniqueId)}
                  onMouseLeave={() => onEventHover(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick(event.uniqueId);
                  }}
                >
                  <polygon
                    points={points}
                    fill={event.color}
                    fillOpacity={opacity}
                    stroke={isSelected ? '#fff' : isHovered ? event.color : 'rgba(0,0,0,0.3)'}
                    strokeWidth={isSelected ? 2 : 1}
                  />
                </g>
              );
            }
          })}

          {/* Action markers at y=-60 on pressure scale (circles) */}
          {visibleEvents.action.map((event) => {
            // Position at tick + 0.5 to differentiate from pressure hover
            const cx = xScale(event.tick + 0.5);
            // Position at y=-60 on pressure scale, stack upward if multiple at same tick
            const baseY = yScale(-60);
            const cy = baseY - (event.stackIndex * MARKER_STACK_OFFSET);
            const isHovered = event.uniqueId === hoveredEventId;
            const isSelected = event.uniqueId === selectedEventId;
            const radius = isSelected ? 6 : isHovered ? 5 : 4;
            const opacity = isSelected ? 1 : isHovered ? 0.9 : 0.7;

            return (
              <g
                key={event.uniqueId}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => onEventHover(event.uniqueId)}
                onMouseLeave={() => onEventHover(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick(event.uniqueId);
                }}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill={event.color}
                  fillOpacity={opacity}
                  stroke={isSelected ? '#fff' : isHovered ? event.color : 'rgba(0,0,0,0.3)'}
                  strokeWidth={isSelected ? 2 : 1}
                />
                {/* Show count badge if many at same tick and this is the top one */}
                {event.stackIndex === event.totalAtTick - 1 && event.totalAtTick > 3 && (
                  <g>
                    <circle
                      cx={cx + 8}
                      cy={cy - 6}
                      r={7}
                      fill="rgba(0,0,0,0.8)"
                      stroke={event.color}
                      strokeWidth={1}
                    />
                    <text
                      x={cx + 8}
                      y={cy - 6}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#fff"
                      fontSize={9}
                      fontWeight={600}
                    >
                      {event.totalAtTick}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Scroll slider */}
      {maxScrollOffset > 0 && (
        <div className="lw-trace-view-scroll" style={{ marginTop: 8 }}>
          <span className="lw-trace-view-scroll-label">
            Ticks {visibleData[0]?.tick ?? 0}-{visibleData[visibleData.length - 1]?.tick ?? 0}
          </span>
          <input
            type="range"
            min={0}
            max={maxScrollOffset}
            value={currentOffset}
            onChange={(e) => onScrollChange(parseInt(e.target.value, 10))}
            className="lw-trace-view-scroll-slider"
          />
          <span className="lw-trace-view-scroll-label">
            of {pressureData.length} total
          </span>
        </div>
      )}

      {/* Hover tooltip */}
      {tooltip && (
        <div
          className="lw-trace-view-tooltip"
          style={{
            position: 'fixed',
            left: tooltip.x + 15,
            top: tooltip.y - 10,
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          <div className="lw-trace-view-tooltip-header">
            Tick {tooltip.tick}
            {tooltip.epoch !== undefined && <span> / E{tooltip.epoch}</span>}
          </div>
          {tooltip.pressures?.map((p, i) => (
            <div key={i} className="lw-trace-view-tooltip-row">
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, backgroundColor: p.color, marginRight: 6 }} />
              <span style={{ flex: 1 }}>{p.name}</span>
              <span style={{ fontWeight: 500 }}>{p.value?.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Main component with responsive wrapper
 */
export default function SimulationTraceVisx({
  pressureUpdates = [],
  epochStats = [],
  templateApplications = [],
  actionApplications = [],
  systemActions = [],
  onClose,
}) {
  // State
  const [selectedTick, setSelectedTick] = useState(null);
  const [lockedTick, setLockedTick] = useState(null);
  const [hiddenPressures, setHiddenPressures] = useState(new Set());
  const [hoveredEventId, setHoveredEventId] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [scrollOffset, setScrollOffset] = useState(null);
  const [systemPanel, setSystemPanel] = useState(null); // null | 'activity' | 'plane-diffusion' | 'graph-contagion'
  const [selectedDiffusionId, setSelectedDiffusionId] = useState(null);
  const [selectedContagionId, setSelectedContagionId] = useState(null);
  const [autoScaleColors, setAutoScaleColors] = useState(false);

  // Derive available diffusion/contagion systems from what actually ran (has snapshot data in systemActions)
  const diffusionSystemsWithData = useMemo(() => {
    const systemsMap = new Map();
    for (const action of systemActions) {
      if (action.details?.diffusionSnapshot && !systemsMap.has(action.systemId)) {
        systemsMap.set(action.systemId, {
          id: action.systemId,
          name: action.systemName,
        });
      }
    }
    return Array.from(systemsMap.values());
  }, [systemActions]);

  const contagionSystemsWithData = useMemo(() => {
    const systemsMap = new Map();
    for (const action of systemActions) {
      if (action.details?.contagionSnapshot && !systemsMap.has(action.systemId)) {
        systemsMap.set(action.systemId, {
          id: action.systemId,
          name: action.systemName,
        });
      }
    }
    return Array.from(systemsMap.values());
  }, [systemActions]);

  // Auto-select first available system if none selected
  const activeDiffusionId = selectedDiffusionId ?? diffusionSystemsWithData[0]?.id ?? null;
  const activeContagionId = selectedContagionId ?? contagionSystemsWithData[0]?.id ?? null;

  const diffusionConfig = useMemo(
    () => ({
      name: diffusionSystemsWithData.find(s => s.id === activeDiffusionId)?.name,
    }),
    [diffusionSystemsWithData, activeDiffusionId]
  );

  const contagionConfig = useMemo(
    () => ({
      name: contagionSystemsWithData.find(s => s.id === activeContagionId)?.name,
    }),
    [contagionSystemsWithData, activeContagionId]
  );

  // Transform data
  const { data: pressureData, pressureIds, breakdownsByTick } = useMemo(
    () => transformPressureData(pressureUpdates),
    [pressureUpdates]
  );

  const eventData = useMemo(
    () => transformEventData(templateApplications, actionApplications, systemActions, pressureData),
    [templateApplications, actionApplications, systemActions, pressureData]
  );

  const eraBoundaries = useMemo(
    () => extractEraBoundaries(pressureUpdates, epochStats, systemActions),
    [pressureUpdates, epochStats, systemActions]
  );

  // Get selected event for detail panel (template, action, or system action)
  const selectedEvent = useMemo(() => {
    const eventId = selectedEventId || hoveredEventId;
    if (!eventId) return null;

    // Check templates first
    const templateEvent = eventData.template.find(e => e.uniqueId === eventId);
    if (templateEvent) {
      return { type: 'template', data: templateEvent.data };
    }

    // Check action applications
    const actionEvent = eventData.action.find(e => e.uniqueId === eventId);
    if (actionEvent) {
      return { type: 'action', data: actionEvent.data };
    }

    // Check system actions
    const systemEvent = eventData.system.find(e => e.uniqueId === eventId);
    if (systemEvent) {
      return { type: 'system', data: systemEvent.data, isEraTransition: systemEvent.isEraTransition };
    }

    return null;
  }, [eventData, selectedEventId, hoveredEventId]);

  // Count era transitions for display
  const eraTransitionCount = useMemo(
    () => eventData.system.filter(e => e.isEraTransition).length,
    [eventData]
  );

  // Get max tick for slider (from pressure data or system actions)
  const maxTick = useMemo(() => {
    const pressureMax = pressureData.length > 0 ? Math.max(...pressureData.map(d => d.tick)) : 0;
    const systemMax = systemActions.length > 0 ? Math.max(...systemActions.map(a => a.tick)) : 0;
    return Math.max(pressureMax, systemMax, 1);
  }, [pressureData, systemActions]);

  // Get available ticks with visualization data for the active system
  const availableVisTicks = useMemo(() => {
    if (systemPanel === 'plane-diffusion' && activeDiffusionId) {
      return [...new Set(
        systemActions
          .filter(a => a.systemId === activeDiffusionId && a.details?.diffusionSnapshot)
          .map(a => a.tick)
      )].sort((a, b) => a - b);
    }
    if (systemPanel === 'graph-contagion' && activeContagionId) {
      return [...new Set(
        systemActions
          .filter(a => a.systemId === activeContagionId && a.details?.contagionSnapshot)
          .map(a => a.tick)
      )].sort((a, b) => a - b);
    }
    return [];
  }, [systemPanel, activeDiffusionId, activeContagionId, systemActions]);

  // Initialize lockedTick to maxTick when opening a visualization panel
  // This ensures slider position matches displayed data
  React.useEffect(() => {
    if ((systemPanel === 'plane-diffusion' || systemPanel === 'graph-contagion') && lockedTick === null) {
      setLockedTick(maxTick);
    }
  }, [systemPanel, maxTick, lockedTick]);

  // Handlers
  const handleTickHover = useCallback((tick) => {
    setSelectedTick(tick);
  }, []);

  const handleTickClick = useCallback((tick) => {
    if (lockedTick === tick) {
      setLockedTick(null);
    } else {
      setLockedTick(tick);
      setSelectedTick(tick);
    }
  }, [lockedTick]);

  const handleEventHover = useCallback((eventId) => {
    if (!selectedEventId) {
      setHoveredEventId(eventId);
    }
  }, [selectedEventId]);

  const handleEventClick = useCallback((eventId) => {
    if (selectedEventId === eventId) {
      setSelectedEventId(null);
    } else {
      setSelectedEventId(eventId);
    }
  }, [selectedEventId]);

  const handleUnlock = useCallback(() => {
    setLockedTick(null);
  }, []);

  const handleClearEvent = useCallback(() => {
    setSelectedEventId(null);
    setHoveredEventId(null);
  }, []);

  const togglePressure = useCallback((id) => {
    setHiddenPressures(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="lw-trace-view-overlay">
      <div className="lw-trace-view">
        {/* Header */}
        <div className="lw-trace-view-header">
          <div className="lw-trace-view-title">
            Simulation Trace
            <span className="lw-trace-view-subtitle">
              {pressureData.length} ticks / {pressureIds.length} pressures / {eventData.template.length} templates / {eventData.action.length} actions / {eraTransitionCount} era transitions
            </span>
          </div>
          <div className="lw-trace-view-header-actions">
            <button
              className={`lw-trace-view-panel-toggle ${systemPanel === 'activity' ? 'active' : ''}`}
              onClick={() => setSystemPanel(systemPanel === 'activity' ? null : 'activity')}
            >
              Activity
            </button>
            <button
              className={`lw-trace-view-panel-toggle ${systemPanel === 'plane-diffusion' ? 'active' : ''} ${diffusionSystemsWithData.length > 0 ? 'has-data' : ''}`}
              onClick={() => setSystemPanel(systemPanel === 'plane-diffusion' ? null : 'plane-diffusion')}
              title={diffusionSystemsWithData.length > 0
                ? `${diffusionSystemsWithData.length} system(s): ${diffusionSystemsWithData.map(s => s.name).join(', ')}`
                : 'No diffusion systems ran'}
            >
              Diffusion{diffusionSystemsWithData.length > 0 && ` (${diffusionSystemsWithData.length})`}
            </button>
            <button
              className={`lw-trace-view-panel-toggle ${systemPanel === 'graph-contagion' ? 'active' : ''} ${contagionSystemsWithData.length > 0 ? 'has-data' : ''}`}
              onClick={() => setSystemPanel(systemPanel === 'graph-contagion' ? null : 'graph-contagion')}
              title={contagionSystemsWithData.length > 0
                ? `${contagionSystemsWithData.length} system(s): ${contagionSystemsWithData.map(s => s.name).join(', ')}`
                : 'No contagion systems ran'}
            >
              Contagion{contagionSystemsWithData.length > 0 && ` (${contagionSystemsWithData.length})`}
            </button>
            <button className="lw-trace-view-close" onClick={onClose}>
              x
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="lw-trace-view-content">
          {/* Left: Charts */}
          <div className="lw-trace-view-charts">
            {/* Pressure toggles */}
            <div className="lw-trace-view-toggles">
              {pressureIds.map((id, i) => {
                const name = pressureData[0]?.[`${id}_name`] || id;
                const isHidden = hiddenPressures.has(id);
                return (
                  <button
                    key={id}
                    className={`lw-trace-view-toggle ${isHidden ? 'hidden' : ''}`}
                    style={{
                      borderColor: PRESSURE_COLORS[i % PRESSURE_COLORS.length],
                      backgroundColor: isHidden ? 'transparent' : PRESSURE_COLORS[i % PRESSURE_COLORS.length] + '20',
                    }}
                    onClick={() => togglePressure(id)}
                  >
                    {name}
                  </button>
                );
              })}
            </div>

            {/* Chart area */}
            <div className={`lw-trace-view-chart-area ${lockedTick !== null ? 'locked' : ''}`}>
              <ParentSize>
                {({ width, height }) => (
                  <TraceVisualization
                    width={width}
                    height={height}
                    pressureData={pressureData}
                    pressureIds={pressureIds}
                    eventData={eventData}
                    eraBoundaries={eraBoundaries}
                    hiddenPressures={hiddenPressures}
                    selectedTick={selectedTick}
                    lockedTick={lockedTick}
                    hoveredEventId={hoveredEventId}
                    selectedEventId={selectedEventId}
                    onTickHover={handleTickHover}
                    onTickClick={handleTickClick}
                    onEventHover={handleEventHover}
                    onEventClick={handleEventClick}
                    scrollOffset={scrollOffset}
                    onScrollChange={setScrollOffset}
                  />
                )}
              </ParentSize>
            </div>

            {/* System Visualization Panels */}
            {systemPanel === 'activity' && (
              <div className="lw-trace-view-system-activity">
                <SystemActivityPanel systemActions={systemActions} />
              </div>
            )}
            {systemPanel === 'plane-diffusion' && (
              <div className="lw-trace-view-system-vis">
                {diffusionSystemsWithData.length === 0 ? (
                  <div className="vis-empty">
                    <div className="vis-empty-icon">&#9783;</div>
                    <div>No diffusion data</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                      Enable a planeDiffusion system and run simulation
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="lw-trace-view-system-controls">
                      {diffusionSystemsWithData.length > 1 && (
                        <select
                          className="lw-trace-view-system-select"
                          value={activeDiffusionId || ''}
                          onChange={(e) => setSelectedDiffusionId(e.target.value)}
                        >
                          {diffusionSystemsWithData.map((sys) => (
                            <option key={sys.id} value={sys.id}>
                              {sys.name || sys.id}
                            </option>
                          ))}
                        </select>
                      )}
                      <div className="lw-trace-view-tick-slider">
                        <span className="lw-trace-view-tick-label">Tick {lockedTick ?? 0}</span>
                        <input
                          type="range"
                          min={0}
                          max={maxTick}
                          value={lockedTick ?? 0}
                          onChange={(e) => setLockedTick(parseInt(e.target.value, 10))}
                          className="lw-trace-view-slider"
                        />
                        <span className="lw-trace-view-tick-label">/ {maxTick}</span>
                        {availableVisTicks.length > 0 && (
                          <span className="lw-trace-view-tick-count">
                            ({availableVisTicks.length} snapshots)
                          </span>
                        )}
                      </div>
                      <label className="lw-trace-view-checkbox-label">
                        <input
                          type="checkbox"
                          checked={autoScaleColors}
                          onChange={(e) => setAutoScaleColors(e.target.checked)}
                        />
                        Log scale
                      </label>
                    </div>
                    <PlaneDiffusionVis
                      config={diffusionConfig}
                      systemActions={systemActions.filter(a => a.systemId === activeDiffusionId)}
                      selectedTick={lockedTick ?? selectedTick}
                      autoScaleColors={autoScaleColors}
                    />
                  </>
                )}
              </div>
            )}
            {systemPanel === 'graph-contagion' && (
              <div className="lw-trace-view-system-vis">
                {contagionSystemsWithData.length === 0 ? (
                  <div className="vis-empty">
                    <div className="vis-empty-icon">&#9673;</div>
                    <div>No contagion data</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                      Enable a graphContagion system and run simulation
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="lw-trace-view-system-controls">
                      {contagionSystemsWithData.length > 1 && (
                        <select
                          className="lw-trace-view-system-select"
                          value={activeContagionId || ''}
                          onChange={(e) => setSelectedContagionId(e.target.value)}
                        >
                          {contagionSystemsWithData.map((sys) => (
                            <option key={sys.id} value={sys.id}>
                              {sys.name || sys.id}
                            </option>
                          ))}
                        </select>
                      )}
                      <div className="lw-trace-view-tick-slider">
                        <span className="lw-trace-view-tick-label">Tick {lockedTick ?? 0}</span>
                        <input
                          type="range"
                          min={0}
                          max={maxTick}
                          value={lockedTick ?? 0}
                          onChange={(e) => setLockedTick(parseInt(e.target.value, 10))}
                          className="lw-trace-view-slider"
                        />
                        <span className="lw-trace-view-tick-label">/ {maxTick}</span>
                        {availableVisTicks.length > 0 && (
                          <span className="lw-trace-view-tick-count">
                            ({availableVisTicks.length} snapshots)
                          </span>
                        )}
                      </div>
                    </div>
                    <GraphContagionVis
                      config={contagionConfig}
                      systemActions={systemActions.filter(a => a.systemId === activeContagionId)}
                      selectedTick={lockedTick ?? selectedTick}
                    />
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right: Detail panel */}
          {selectedEvent?.type === 'template' ? (
            <TemplateDetailPanel
              template={selectedEvent.data}
              isLocked={!!selectedEventId}
              onClear={handleClearEvent}
            />
          ) : selectedEvent?.type === 'action' ? (
            <ActionDetailPanel
              actionApplication={selectedEvent.data}
              isLocked={!!selectedEventId}
              onClear={handleClearEvent}
            />
          ) : selectedEvent?.type === 'system' ? (
            <SystemActionDetailPanel
              systemAction={selectedEvent.data}
              isEraTransition={selectedEvent.isEraTransition}
              isLocked={!!selectedEventId}
              onClear={handleClearEvent}
            />
          ) : (
            <DetailPanel
              selectedTick={selectedTick}
              lockedTick={lockedTick}
              breakdownsByTick={breakdownsByTick}
              pressureIds={pressureIds}
              pressureData={pressureData}
              onUnlock={handleUnlock}
            />
          )}
        </div>
      </div>
    </div>
  );
}
