/**
 * EventResolutionStep - Step 4: Select events and relationships to include
 *
 * Features the Narrative Arc Timeline visualization:
 * - Intensity sparkline showing narrative pacing
 * - Era swim lanes with event cards
 * - Range brush for bulk selection
 * - Compact relationship list with visual strength indicators
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useWizard } from "../WizardContext";
import {
  getRelevantRelationships,
  getRelevantEvents,
  filterChronicleEvents,
  collapseBidirectionalRelationships,
  MAX_CHRONICLE_EVENTS,
  type EventSelectionMetrics,
} from "../../../lib/chronicle/selectionWizard";
import {
  getEraRanges,
  prepareTimelineEvents,
  computeIntensityCurve,
  getTimelineExtent,
  getEventsInRange,
  prepareCastMarkers,
} from "../../../lib/chronicle/timelineUtils";
import type { EntityContext } from "../../../lib/chronicleTypes";
import { IntensitySparkline, TimelineBrush, NarrativeTimeline } from "../visualizations";
import "./EventResolutionStep.css";

export default function EventResolutionStep() {
  const {
    state,
    toggleEvent,
    toggleRelationship,
    selectAllEvents,
    deselectAllEvents,
    selectAllRelationships,
    deselectAllRelationships,
    computeEventMetricsForSelection,
    temporalContext,
    detectedFocalEra,
    eras,
    setFocalEraOverride,
    autoFillEvents,
  } = useWizard();

  const [, setEventMetrics] = useState<Map<string, EventSelectionMetrics>>(new Map());
  const [brushSelection, setBrushSelection] = useState<[number, number] | null>(null);
  const [minEventSignificance, setMinEventSignificance] = useState<number>(0);

  // Recompute event metrics when the computation function changes
  useEffect(() => {
    const metrics = computeEventMetricsForSelection();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync derived metrics cache to updated computation source
    setEventMetrics(metrics);
  }, [computeEventMetricsForSelection]);

  // Get relevant relationships (between assigned entities + lens)
  const lensEntityIds = useMemo(() => (state.lens ? [state.lens.entityId] : []), [state.lens]);

  const relevantRelationships = useMemo(() => {
    return getRelevantRelationships(
      state.roleAssignments,
      state.candidateRelationships,
      lensEntityIds
    );
  }, [state.roleAssignments, state.candidateRelationships, lensEntityIds]);

  // Get ALL relevant events (involving assigned entities) - before filtering
  const allRelevantEvents = useMemo(() => {
    return getRelevantEvents(
      state.roleAssignments,
      state.candidateEvents
    );
  }, [state.roleAssignments, state.candidateEvents]);

  // Filter events by significance and exclude prominence-only events
  const relevantEvents = useMemo(() => {
    const entityIds = new Set(state.roleAssignments.map((a) => a.entityId));
    return filterChronicleEvents(allRelevantEvents, entityIds, {
      minSignificance: minEventSignificance,
      excludeProminenceOnly: true,
    });
  }, [allRelevantEvents, state.roleAssignments, minEventSignificance]);

  // Get era ranges directly from era definitions
  const eraRanges = useMemo(() => {
    return getEraRanges(eras);
  }, [eras]);

  const assignedEntityIds = useMemo(() => {
    return new Set(state.roleAssignments.map((a) => a.entityId));
  }, [state.roleAssignments]);

  const timelineEvents = useMemo(() => {
    return prepareTimelineEvents(
      relevantEvents,
      state.entryPointId,
      assignedEntityIds,
      state.selectedEventIds
    );
  }, [relevantEvents, state.entryPointId, assignedEntityIds, state.selectedEventIds]);

  const intensityCurve = useMemo(() => {
    return computeIntensityCurve(relevantEvents);
  }, [relevantEvents]);

  // Get timeline extent directly from era definitions
  const timelineExtent = useMemo(() => {
    return getTimelineExtent(eras);
  }, [eras]);

  // Build entity map for cast marker lookup
  const entityMap = useMemo(() => {
    const map = new Map<string, EntityContext>();
    for (const entity of state.candidates) {
      map.set(entity.id, entity);
    }
    return map;
  }, [state.candidates]);

  // Compute cast markers from role assignments, entry point, and lens
  const castMarkers = useMemo(() => {
    return prepareCastMarkers(state.roleAssignments, entityMap, state.entryPoint, state.lens);
  }, [state.roleAssignments, entityMap, state.entryPoint, state.lens]);

  // Collapse bidirectional relationships for display
  const collapsedRelationships = useMemo(
    () => collapseBidirectionalRelationships(relevantRelationships),
    [relevantRelationships]
  );

  // Get all relationship IDs (flattened from collapsed)
  const relevantRelationshipIds = useMemo(
    () => collapsedRelationships.flatMap((cr) => cr.relationshipIds),
    [collapsedRelationships]
  );

  const relevantEventIds = useMemo(() => relevantEvents.map((e) => e.id), [relevantEvents]);

  // Count how many selected events are visible (pass the current filter)
  const visibleSelectedCount = useMemo(() => {
    const relevantIdSet = new Set(relevantEventIds);
    return Array.from(state.selectedEventIds).filter((id) => relevantIdSet.has(id)).length;
  }, [relevantEventIds, state.selectedEventIds]);

  // Auto-select all on first mount if accepting defaults
  useEffect(() => {
    if (
      state.acceptDefaults &&
      state.selectedRelationshipIds.size === 0 &&
      state.selectedEventIds.size === 0
    ) {
      selectAllRelationships(relevantRelationshipIds);
      selectAllEvents(relevantEventIds);
    }
  }, [
    state.acceptDefaults,
    state.selectedRelationshipIds.size,
    state.selectedEventIds.size,
    selectAllRelationships,
    selectAllEvents,
    relevantRelationshipIds,
    relevantEventIds,
  ]);

  // Handle brush selection change - select events in range
  const handleBrushChange = useCallback(
    (range: [number, number] | null) => {
      setBrushSelection(range);
      if (range) {
        const eventsInRange = getEventsInRange(timelineEvents, range[0], range[1]);
        const idsInRange = eventsInRange.map((e) => e.id);
        // Select only events in range, deselect others
        const newSelectedIds = new Set(idsInRange);
        // Update selection
        for (const id of relevantEventIds) {
          const inNew = newSelectedIds.has(id);
          const inCurrent = state.selectedEventIds.has(id);
          if (inNew !== inCurrent) {
            toggleEvent(id);
          }
        }
      }
    },
    [timelineEvents, relevantEventIds, state.selectedEventIds, toggleEvent]
  );

  // Effective focal era
  const effectiveFocalEraId = state.focalEraOverride || detectedFocalEra?.id || null;

  return (
    <div>
      {/* Header */}
      <div className="ers-header">
        <div className="ers-header-row">
          <div>
            <h4 className="ers-title">Compose Narrative Arc</h4>
            <p className="ers-subtitle">
              Select events from the timeline to build your narrative. Use the brush to select time
              ranges.
            </p>
          </div>
          <button
            onClick={() => autoFillEvents(true)}
            className="illuminator-btn ers-btn-sm"
          >
            Auto-fill Events
          </button>
        </div>

        {/* Filters */}
        <div className="ers-filters">
          {/* Row 1: Focal Era selector */}
          {temporalContext && (
            <div className="ers-filter-row">
              <span className="ers-filter-label">Focal Era:</span>
              <select
                value={state.focalEraOverride || temporalContext.focalEra.id}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  if (detectedFocalEra && selectedId === detectedFocalEra.id) {
                    setFocalEraOverride(null);
                  } else {
                    setFocalEraOverride(selectedId);
                  }
                }}
                className="illuminator-select ers-filter-select"
              >
                {eras.map((era) => (
                  <option key={era.id} value={era.id}>
                    {era.name}
                    {detectedFocalEra?.id === era.id ? " (detected)" : ""}
                  </option>
                ))}
              </select>
              {state.focalEraOverride && (
                <button
                  onClick={() => setFocalEraOverride(null)}
                  className="illuminator-btn ers-reset-btn"
                >
                  Reset
                </button>
              )}
            </div>
          )}

          {/* Row 2: Min Significance selector */}
          <div className="ers-filter-row">
            <span className="ers-filter-label">Min Significance:</span>
            <select
              value={minEventSignificance}
              onChange={(e) => setMinEventSignificance(parseFloat(e.target.value))}
              className="illuminator-select ers-filter-select"
            >
              <option value={0}>All (&gt;0%)</option>
              <option value={0.25}>Low (&gt;25%)</option>
              <option value={0.5}>Medium (&gt;50%)</option>
              <option value={0.75}>High (&gt;75%)</option>
            </select>
            <span className="ers-filter-count">
              {relevantEvents.length} events match filter
            </span>
          </div>
        </div>
      </div>

      {/* Timeline Visualization */}
      <div className="ers-timeline-section">
        {/* Intensity Sparkline */}
        <IntensitySparkline
          points={intensityCurve}
          width={700}
          height={40}
          extent={timelineExtent}
          selectedRange={brushSelection}
        />

        {/* Narrative Timeline with Era Lanes - compact overview */}
        <div className="ers-timeline-gap">
          <NarrativeTimeline
            events={timelineEvents}
            eraRanges={eraRanges}
            width={700}
            height={castMarkers.length > 0 ? 148 : 120}
            onToggleEvent={toggleEvent}
            focalEraId={effectiveFocalEraId}
            extent={timelineExtent}
            castMarkers={castMarkers}
          />
        </div>

        {/* Timeline Brush */}
        <div className="ers-timeline-gap">
          <TimelineBrush
            width={700}
            height={36}
            extent={timelineExtent}
            selection={brushSelection}
            onSelectionChange={handleBrushChange}
          />
        </div>

        {/* Quick actions */}
        <div className="ers-quick-actions">
          <button
            onClick={() => selectAllEvents(relevantEventIds)}
            className="illuminator-btn ers-action-btn"
          >
            Select All Events
          </button>
          <button
            onClick={() => {
              deselectAllEvents();
              setBrushSelection(null);
            }}
            className="illuminator-btn ers-action-btn"
          >
            Clear Selection
          </button>
          <span
            className="ers-selection-count"
            style={{
              '--ers-count-color': state.selectedEventIds.size > MAX_CHRONICLE_EVENTS
                ? "var(--error)"
                : "var(--text-muted)",
            } as React.CSSProperties}
          >
            {visibleSelectedCount} of {relevantEvents.length} visible selected
            {state.selectedEventIds.size !== visibleSelectedCount && (
              <span className="ers-total-hint">
                ({state.selectedEventIds.size} total)
              </span>
            )}
            {state.selectedEventIds.size > MAX_CHRONICLE_EVENTS && ` (max ${MAX_CHRONICLE_EVENTS})`}
          </span>
        </div>
      </div>

      {/* Event List - scrollable for many events */}
      <div className="ers-event-list-wrap">
        <div className="ers-event-list-header">
          <span className="ers-event-list-title">
            Events {brushSelection ? "(filtered by brush)" : ""}
          </span>
          <span className="ers-event-list-count">
            {brushSelection
              ? `${getEventsInRange(timelineEvents, brushSelection[0], brushSelection[1]).length} in range`
              : `${relevantEvents.length} total`}
          </span>
        </div>
        <div className="ers-event-list-scroll">
          {(brushSelection
            ? getEventsInRange(timelineEvents, brushSelection[0], brushSelection[1])
            : timelineEvents
          )
            .sort((a, b) => a.tick - b.tick)
            .map((event) => {
              const isSelected = state.selectedEventIds.has(event.id);
              return (
                <div
                  key={event.id}
                  onClick={() => toggleEvent(event.id)}
                  className={`ers-event-row ${isSelected ? "ers-event-row-selected" : ""}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="ers-event-checkbox"
                  />
                  <span className="ers-event-tick">
                    t:{event.tick}
                  </span>
                  <span className="ers-event-headline">
                    {event.headline}
                  </span>
                  <span className="ers-event-kind-badge">
                    {event.eventKind}
                  </span>
                  {event.involvesEntryPoint && (
                    <span className="ers-event-entry-badge">
                      Entry
                    </span>
                  )}
                </div>
              );
            })}
          {relevantEvents.length === 0 && (
            <div className="ilu-empty ers-empty-events">
              No events involve assigned entities
            </div>
          )}
        </div>
      </div>

      {/* Relationships Section - Compact */}
      <div className="ers-rel-section">
        <div className="ers-rel-header">
          <span className="ers-rel-title">
            Relationships ({collapsedRelationships.length})
          </span>
          <div className="ers-rel-actions">
            <button
              onClick={() => selectAllRelationships(relevantRelationshipIds)}
              className="illuminator-btn ers-rel-action-btn"
            >
              All
            </button>
            <button
              onClick={deselectAllRelationships}
              className="illuminator-btn ers-rel-action-btn"
            >
              None
            </button>
          </div>
        </div>

        {/* Relationship visual list */}
        <div className="ers-rel-list">
          {collapsedRelationships.length === 0 ? (
            <div className="ers-rel-empty">
              No relationships between assigned entities.
            </div>
          ) : (
            collapsedRelationships.map((collapsed) => {
              const rel = collapsed.primary;
              const key = collapsed.relationshipIds.join("|");
              // Selected if ALL relationship IDs in the group are selected
              const isSelected = collapsed.relationshipIds.every((id) =>
                state.selectedRelationshipIds.has(id)
              );
              const strengthPct = collapsed.strength * 100;

              // Toggle all IDs in the collapsed group
              const handleToggle = () => {
                for (const relId of collapsed.relationshipIds) {
                  toggleRelationship(relId);
                }
              };

              return (
                <div
                  key={key}
                  onClick={handleToggle}
                  title={
                    rel.backstory ||
                    (collapsed.isBidirectional
                      ? `${rel.sourceName} ↔ ${rel.targetName} (mutual)`
                      : `${rel.sourceName} → ${rel.targetName}`)
                  }
                  className={`ers-rel-card ${isSelected ? "ers-rel-card-selected" : "ers-rel-card-unselected"}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleToggle(); }}
                >
                  {/* Strength indicator bar */}
                  <div className="ers-strength-track">
                    <div
                      className="ers-strength-fill"
                      style={{
                        '--ers-fill-height': `${strengthPct}%`,
                        '--ers-fill-bg': isSelected ? "var(--accent-color)" : "var(--text-muted)",
                      } as React.CSSProperties}
                    />
                  </div>

                  {/* Names with directional indicator */}
                  <span className="ers-rel-name">{rel.sourceName}</span>
                  <span
                    style={{
                      '--ers-dir-color': collapsed.isBidirectional ? "var(--success)" : "var(--text-muted)",
                    } as React.CSSProperties}
                    className="ers-rel-direction"
                  >
                    {collapsed.isBidirectional ? "↔" : "→"}
                  </span>
                  <span className="ers-rel-name">{rel.targetName}</span>

                  {/* Kind badge */}
                  <span
                    className="ers-rel-kind-badge"
                    style={{
                      '--ers-badge-bg': isSelected ? "var(--accent-color)" : "var(--bg-secondary)",
                      '--ers-badge-color': isSelected ? "white" : "var(--text-muted)",
                    } as React.CSSProperties}
                  >
                    {rel.kind}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="ers-summary">
        <span>
          <strong className="ers-summary-count">{state.selectedEventIds.size}</strong>{" "}
          events,{" "}
          <strong className="ers-summary-count">
            {state.selectedRelationshipIds.size}
          </strong>{" "}
          relationships
        </span>
        {temporalContext && state.selectedEventIds.size > 0 && (
          <span>
            Ticks {temporalContext.chronicleTickRange[0]}–{temporalContext.chronicleTickRange[1]}
            {temporalContext.isMultiEra && (
              <span className="ers-multi-era-warning">
                (spans {temporalContext.touchedEraIds.length} eras)
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
