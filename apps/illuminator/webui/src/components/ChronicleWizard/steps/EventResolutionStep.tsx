/**
 * EventResolutionStep - Step 4: Select events and relationships to include
 *
 * Features the Narrative Arc Timeline visualization:
 * - Intensity sparkline showing narrative pacing
 * - Era swim lanes with event cards
 * - Range brush for bulk selection
 * - Compact relationship list with visual strength indicators
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useWizard } from '../WizardContext';
import {
  getRelevantRelationships,
  getRelevantEvents,
  filterChronicleEvents,
  collapseBidirectionalRelationships,
  makeRelationshipId,
  MAX_CHRONICLE_EVENTS,
  type EventSelectionMetrics,
  type CollapsedRelationship,
} from '../../../lib/chronicle/selectionWizard';
import {
  getEraRanges,
  prepareTimelineEvents,
  computeIntensityCurve,
  getTimelineExtent,
  getEventsInRange,
} from '../../../lib/chronicle/timelineUtils';
import { IntensitySparkline, TimelineBrush, NarrativeTimeline } from '../visualizations';

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

  const [eventMetrics, setEventMetrics] = useState<Map<string, EventSelectionMetrics>>(new Map());
  const [brushSelection, setBrushSelection] = useState<[number, number] | null>(null);
  const [minEventSignificance, setMinEventSignificance] = useState<number>(0);

  // Compute event metrics when data changes
  useEffect(() => {
    const metrics = computeEventMetricsForSelection();
    setEventMetrics(metrics);
  }, [computeEventMetricsForSelection]);

  // Get relevant relationships (between assigned entities)
  const relevantRelationships = useMemo(() => {
    return getRelevantRelationships(state.roleAssignments, state.candidateRelationships);
  }, [state.roleAssignments, state.candidateRelationships]);

  // Get ALL relevant events (involving assigned entities) - before filtering
  const allRelevantEvents = useMemo(() => {
    return getRelevantEvents(
      state.roleAssignments,
      state.candidateEvents,
      state.narrativeStyle?.eventRules
    );
  }, [state.roleAssignments, state.candidateEvents, state.narrativeStyle]);

  // Filter events by significance and exclude prominence-only events
  const relevantEvents = useMemo(() => {
    const entityIds = new Set(state.roleAssignments.map(a => a.entityId));
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
    return new Set(state.roleAssignments.map(a => a.entityId));
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

  // Collapse bidirectional relationships for display
  const collapsedRelationships = useMemo(() =>
    collapseBidirectionalRelationships(relevantRelationships),
    [relevantRelationships]
  );

  // Get all relationship IDs (flattened from collapsed)
  const relevantRelationshipIds = useMemo(() =>
    collapsedRelationships.flatMap(cr => cr.relationshipIds),
    [collapsedRelationships]
  );

  const relevantEventIds = useMemo(() =>
    relevantEvents.map(e => e.id),
    [relevantEvents]
  );

  // Count how many selected events are visible (pass the current filter)
  const visibleSelectedCount = useMemo(() => {
    const relevantIdSet = new Set(relevantEventIds);
    return Array.from(state.selectedEventIds).filter(id => relevantIdSet.has(id)).length;
  }, [relevantEventIds, state.selectedEventIds]);

  // Auto-select all on first mount if accepting defaults
  useEffect(() => {
    if (state.acceptDefaults && state.selectedRelationshipIds.size === 0 && state.selectedEventIds.size === 0) {
      selectAllRelationships(relevantRelationshipIds);
      selectAllEvents(relevantEventIds);
    }
  }, [state.acceptDefaults, state.selectedRelationshipIds.size, state.selectedEventIds.size, selectAllRelationships, selectAllEvents, relevantRelationshipIds, relevantEventIds]);

  // Handle brush selection change - select events in range
  const handleBrushChange = useCallback((range: [number, number] | null) => {
    setBrushSelection(range);
    if (range) {
      const eventsInRange = getEventsInRange(timelineEvents, range[0], range[1]);
      const idsInRange = eventsInRange.map(e => e.id);
      // Select only events in range, deselect others
      const newSelectedIds = new Set(idsInRange);
      // Update selection
      for (const id of relevantEventIds) {
        if (newSelectedIds.has(id) && !state.selectedEventIds.has(id)) {
          toggleEvent(id);
        } else if (!newSelectedIds.has(id) && state.selectedEventIds.has(id)) {
          toggleEvent(id);
        }
      }
    }
  }, [timelineEvents, relevantEventIds, state.selectedEventIds, toggleEvent]);

  // Effective focal era
  const effectiveFocalEraId = state.focalEraOverride || detectedFocalEra?.id || null;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div>
            <h4 style={{ margin: '0 0 8px 0' }}>Compose Narrative Arc</h4>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>
              Select events from the timeline to build your narrative. Use the brush to select time ranges.
            </p>
          </div>
          <button
            onClick={() => autoFillEvents(true)}
            className="illuminator-btn"
            style={{ fontSize: '12px' }}
          >
            Auto-fill Events
          </button>
        </div>

        {/* Filters */}
        <div style={{
          padding: '10px 12px',
          background: 'var(--bg-tertiary)',
          borderRadius: '6px',
          fontSize: '11px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          {/* Row 1: Focal Era selector */}
          {temporalContext && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 500, minWidth: '100px' }}>Focal Era:</span>
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
                className="illuminator-select"
                style={{ padding: '4px 8px', fontSize: '11px', flex: 1, maxWidth: '200px' }}
              >
                {eras.map(era => (
                  <option key={era.id} value={era.id}>
                    {era.name}{detectedFocalEra?.id === era.id ? ' (detected)' : ''}
                  </option>
                ))}
              </select>
              {state.focalEraOverride && (
                <button
                  onClick={() => setFocalEraOverride(null)}
                  className="illuminator-btn"
                  style={{ padding: '3px 8px', fontSize: '10px' }}
                >
                  Reset
                </button>
              )}
            </div>
          )}

          {/* Row 2: Min Significance selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 500, minWidth: '100px' }}>Min Significance:</span>
            <select
              value={minEventSignificance}
              onChange={(e) => setMinEventSignificance(parseFloat(e.target.value))}
              className="illuminator-select"
              style={{ padding: '4px 8px', fontSize: '11px', flex: 1, maxWidth: '200px' }}
            >
              <option value={0}>All (&gt;0%)</option>
              <option value={0.25}>Low (&gt;25%)</option>
              <option value={0.5}>Medium (&gt;50%)</option>
              <option value={0.75}>High (&gt;75%)</option>
            </select>
            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
              {relevantEvents.length} events match filter
            </span>
          </div>
        </div>
      </div>

      {/* Timeline Visualization */}
      <div style={{ marginBottom: '20px' }}>
        {/* Intensity Sparkline */}
        <IntensitySparkline
          points={intensityCurve}
          width={700}
          height={40}
          extent={timelineExtent}
          selectedRange={brushSelection}
        />

        {/* Narrative Timeline with Era Lanes - compact overview */}
        <div style={{ marginTop: '8px' }}>
          <NarrativeTimeline
            events={timelineEvents}
            eraRanges={eraRanges}
            width={700}
            height={120}
            onToggleEvent={toggleEvent}
            focalEraId={effectiveFocalEraId}
            extent={timelineExtent}
          />
        </div>

        {/* Timeline Brush */}
        <div style={{ marginTop: '8px' }}>
          <TimelineBrush
            width={700}
            height={36}
            extent={timelineExtent}
            selection={brushSelection}
            onSelectionChange={handleBrushChange}
          />
        </div>

        {/* Quick actions */}
        <div style={{
          marginTop: '12px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
        }}>
          <button
            onClick={() => selectAllEvents(relevantEventIds)}
            className="illuminator-btn"
            style={{ padding: '4px 10px', fontSize: '11px' }}
          >
            Select All Events
          </button>
          <button
            onClick={() => {
              deselectAllEvents();
              setBrushSelection(null);
            }}
            className="illuminator-btn"
            style={{ padding: '4px 10px', fontSize: '11px' }}
          >
            Clear Selection
          </button>
          <span style={{
            marginLeft: 'auto',
            fontSize: '12px',
            color: state.selectedEventIds.size > MAX_CHRONICLE_EVENTS ? 'var(--error)' : 'var(--text-muted)',
          }}>
            {visibleSelectedCount} of {relevantEvents.length} visible selected
            {state.selectedEventIds.size !== visibleSelectedCount && (
              <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>
                ({state.selectedEventIds.size} total)
              </span>
            )}
            {state.selectedEventIds.size > MAX_CHRONICLE_EVENTS && ` (max ${MAX_CHRONICLE_EVENTS})`}
          </span>
        </div>
      </div>

      {/* Event List - scrollable for many events */}
      <div style={{
        marginBottom: '16px',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '8px 12px',
          background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '11px', fontWeight: 500 }}>
            Events {brushSelection ? '(filtered by brush)' : ''}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {brushSelection
              ? `${getEventsInRange(timelineEvents, brushSelection[0], brushSelection[1]).length} in range`
              : `${relevantEvents.length} total`}
          </span>
        </div>
        <div style={{
          maxHeight: '200px',
          overflowY: 'auto',
          padding: '4px',
        }}>
          {(brushSelection
            ? getEventsInRange(timelineEvents, brushSelection[0], brushSelection[1])
            : timelineEvents
          ).sort((a, b) => a.tick - b.tick).map(event => {
            const isSelected = state.selectedEventIds.has(event.id);
            return (
              <div
                key={event.id}
                onClick={() => toggleEvent(event.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 8px',
                  marginBottom: '2px',
                  background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  style={{ margin: 0, cursor: 'pointer' }}
                />
                <span style={{
                  width: '40px',
                  flexShrink: 0,
                  color: 'var(--text-muted)',
                  fontSize: '10px',
                }}>
                  t:{event.tick}
                </span>
                <span style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {event.headline}
                </span>
                <span style={{
                  padding: '1px 4px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '3px',
                  fontSize: '9px',
                  color: 'var(--text-muted)',
                }}>
                  {event.eventKind}
                </span>
                {event.involvesEntryPoint && (
                  <span style={{
                    padding: '1px 4px',
                    background: 'var(--accent-color)',
                    color: 'white',
                    borderRadius: '3px',
                    fontSize: '9px',
                  }}>
                    Entry
                  </span>
                )}
              </div>
            );
          })}
          {relevantEvents.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              No events involve assigned entities
            </div>
          )}
        </div>
      </div>

      {/* Relationships Section - Compact */}
      <div style={{
        borderTop: '1px solid var(--border-color)',
        paddingTop: '16px',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}>
          <span style={{ fontSize: '12px', fontWeight: 500 }}>
            Relationships ({collapsedRelationships.length})
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => selectAllRelationships(relevantRelationshipIds)}
              className="illuminator-btn"
              style={{ padding: '3px 8px', fontSize: '10px' }}
            >
              All
            </button>
            <button
              onClick={deselectAllRelationships}
              className="illuminator-btn"
              style={{ padding: '3px 8px', fontSize: '10px' }}
            >
              None
            </button>
          </div>
        </div>

        {/* Relationship visual list */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          maxHeight: '120px',
          overflowY: 'auto',
          padding: '4px',
        }}>
          {collapsedRelationships.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
              No relationships between assigned entities.
            </div>
          ) : (
            collapsedRelationships.map(collapsed => {
              const rel = collapsed.primary;
              const key = collapsed.relationshipIds.join('|');
              // Selected if ALL relationship IDs in the group are selected
              const isSelected = collapsed.relationshipIds.every(id => state.selectedRelationshipIds.has(id));
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
                  title={rel.backstory || (collapsed.isBidirectional
                    ? `${rel.sourceName} ↔ ${rel.targetName} (mutual)`
                    : `${rel.sourceName} → ${rel.targetName}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-tertiary)',
                    border: isSelected ? '1px solid var(--accent-color)' : '1px solid transparent',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Strength indicator bar */}
                  <div
                    style={{
                      width: '4px',
                      height: '20px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '2px',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        width: '100%',
                        height: `${strengthPct}%`,
                        background: isSelected ? 'var(--accent-color)' : 'var(--text-muted)',
                        borderRadius: '2px',
                      }}
                    />
                  </div>

                  {/* Names with directional indicator */}
                  <span style={{ fontWeight: 500 }}>{rel.sourceName}</span>
                  <span style={{ color: collapsed.isBidirectional ? 'var(--success)' : 'var(--text-muted)' }}>
                    {collapsed.isBidirectional ? '↔' : '→'}
                  </span>
                  <span style={{ fontWeight: 500 }}>{rel.targetName}</span>

                  {/* Kind badge */}
                  <span style={{
                    padding: '1px 4px',
                    background: isSelected ? 'var(--accent-color)' : 'var(--bg-secondary)',
                    color: isSelected ? 'white' : 'var(--text-muted)',
                    borderRadius: '3px',
                    fontSize: '9px',
                  }}>
                    {rel.kind}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Summary */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        background: 'var(--bg-tertiary)',
        borderRadius: '8px',
        fontSize: '12px',
        color: 'var(--text-muted)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
      }}>
        <span>
          <strong style={{ color: 'var(--text-primary)' }}>{state.selectedEventIds.size}</strong> events, {' '}
          <strong style={{ color: 'var(--text-primary)' }}>{state.selectedRelationshipIds.size}</strong> relationships
        </span>
        {temporalContext && state.selectedEventIds.size > 0 && (
          <span>
            Ticks {temporalContext.chronicleTickRange[0]}–{temporalContext.chronicleTickRange[1]}
            {temporalContext.isMultiEra && (
              <span style={{ marginLeft: '8px', color: 'var(--warning)' }}>
                (spans {temporalContext.touchedEraIds.length} eras)
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
