/**
 * EventsPanel - View and filter narrative events from simulation
 *
 * Displays narrative events captured during lore-weave simulation,
 * with filtering by era, kind, significance, and tags.
 */

import { useState, useMemo, useEffect } from 'react';

// Display limit for performance - loading 7000+ events causes UI freeze
const DEFAULT_DISPLAY_LIMIT = 500;
const LOAD_MORE_INCREMENT = 250;

// Event kind colors
const EVENT_KIND_COLORS = {
  state_change: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
  relationship_change: { bg: 'rgba(168, 85, 247, 0.15)', text: '#a855f7' },
  entity_lifecycle: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
  era_transition: { bg: 'rgba(236, 72, 153, 0.15)', text: '#ec4899' },
  conflict: { bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316' },
  alliance: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e' },
  discovery: { bg: 'rgba(14, 165, 233, 0.15)', text: '#0ea5e9' },
  achievement: { bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308' },
};

function EventKindBadge({ kind }) {
  const colors = EVENT_KIND_COLORS[kind] || { bg: 'rgba(107, 114, 128, 0.15)', text: '#6b7280' };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        fontSize: '11px',
        fontWeight: 500,
        background: colors.bg,
        color: colors.text,
        borderRadius: '4px',
      }}
    >
      {kind.replace(/_/g, ' ')}
    </span>
  );
}

function SignificanceBar({ value }) {
  const percentage = Math.round(value * 100);
  const color = value >= 0.8 ? '#ef4444' : value >= 0.5 ? '#f59e0b' : '#22c55e';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          width: '60px',
          height: '6px',
          background: 'var(--bg-tertiary)',
          borderRadius: '3px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            background: color,
            borderRadius: '3px',
          }}
        />
      </div>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '32px' }}>
        {percentage}%
      </span>
    </div>
  );
}

function NarrativeTag({ tag }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 6px',
        fontSize: '10px',
        background: 'var(--bg-tertiary)',
        color: 'var(--text-muted)',
        borderRadius: '3px',
      }}
    >
      {tag}
    </span>
  );
}

function StateChangeItem({ change }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        padding: '4px 0',
      }}
    >
      <span style={{ color: 'var(--text-muted)' }}>{change.entityName}</span>
      <span style={{ fontFamily: 'monospace' }}>{change.field}:</span>
      <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>
        {String(change.previousValue)}
      </span>
      <span style={{ color: 'var(--text-muted)' }}>&rarr;</span>
      <span style={{ fontWeight: 500 }}>{String(change.newValue)}</span>
    </div>
  );
}

function EventCard({ event, entityMap, expanded, onToggle }) {
  const subjectEntity = entityMap?.get(event.subject?.id);
  const objectEntity = event.object ? entityMap?.get(event.object.id) : null;

  return (
    <div
      style={{
        padding: '16px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        marginBottom: '12px',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <EventKindBadge kind={event.eventKind} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              tick {event.tick}
            </span>
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onClick={onToggle}
          >
            {event.headline}
          </h3>
        </div>
        <SignificanceBar value={event.significance} />
      </div>

      {/* Subject/Object */}
      <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
        <span style={{ fontWeight: 500 }}>{event.subject?.name || 'Unknown'}</span>
        {event.subject?.kind && (
          <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>
            ({event.subject.kind})
          </span>
        )}
        {event.object && (
          <>
            <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>&rarr;</span>
            <span style={{ fontWeight: 500 }}>{event.object.name}</span>
            <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>
              ({event.object.kind})
            </span>
          </>
        )}
      </div>

      {/* Tags */}
      {event.narrativeTags && event.narrativeTags.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '10px' }}>
          {event.narrativeTags.map((tag) => (
            <NarrativeTag key={tag} tag={tag} />
          ))}
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div
          style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-color)',
          }}
        >
          {/* Description */}
          {event.description && (
            <p style={{ margin: '0 0 12px 0', fontSize: '13px', lineHeight: 1.5 }}>
              {event.description}
            </p>
          )}

          {/* State changes */}
          {event.stateChanges && event.stateChanges.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-muted)' }}>
                State Changes
              </div>
              {event.stateChanges.map((change, i) => (
                <StateChangeItem key={i} change={change} />
              ))}
            </div>
          )}

          {/* Causality */}
          {event.causedBy && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              <span style={{ fontWeight: 500 }}>Caused by:</span>{' '}
              {event.causedBy.actionType || event.causedBy.eventId || 'Unknown'}
              {event.causedBy.entityId && ` (${event.causedBy.entityId})`}
            </div>
          )}
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={onToggle}
        style={{
          marginTop: '8px',
          padding: '4px 8px',
          fontSize: '11px',
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
        }}
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  );
}

export default function EventsPanel({ worldData, entityMap }) {
  const [significanceFilter, setSignificanceFilter] = useState(0);
  const [kindFilter, setKindFilter] = useState('all');
  const [eraFilter, setEraFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('');
  const [expandedEvents, setExpandedEvents] = useState(new Set());
  const [displayLimit, setDisplayLimit] = useState(DEFAULT_DISPLAY_LIMIT);

  const events = worldData?.narrativeHistory || [];
  const simulationRunId = worldData?.metadata?.simulationRunId;

  // Get unique values for filters
  const { uniqueKinds, uniqueEras, uniqueTags } = useMemo(() => {
    const kinds = new Set();
    const eras = new Set();
    const tags = new Set();

    for (const event of events) {
      kinds.add(event.eventKind);
      if (event.era) eras.add(event.era);
      for (const tag of event.narrativeTags || []) {
        tags.add(tag);
      }
    }

    return {
      uniqueKinds: Array.from(kinds).sort(),
      uniqueEras: Array.from(eras).sort(),
      uniqueTags: Array.from(tags).sort(),
    };
  }, [events]);

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (event.significance < significanceFilter) return false;
      if (kindFilter !== 'all' && event.eventKind !== kindFilter) return false;
      if (eraFilter !== 'all' && event.era !== eraFilter) return false;
      if (tagFilter && !event.narrativeTags?.includes(tagFilter)) return false;
      return true;
    });
  }, [events, significanceFilter, kindFilter, eraFilter, tagFilter]);

  // Sort by significance (highest first)
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => b.significance - a.significance);
  }, [filteredEvents]);

  // Limit displayed events for performance
  const displayedEvents = useMemo(() => {
    return sortedEvents.slice(0, displayLimit);
  }, [sortedEvents, displayLimit]);

  const hasMoreEvents = sortedEvents.length > displayLimit;

  const handleLoadMore = () => {
    setDisplayLimit((prev) => prev + LOAD_MORE_INCREMENT);
  };

  // Reset display limit when filters change
  useEffect(() => {
    setDisplayLimit(DEFAULT_DISPLAY_LIMIT);
  }, [significanceFilter, kindFilter, eraFilter, tagFilter]);

  const toggleExpanded = (eventId) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const handleExportEvents = () => {
    if (events.length === 0) return;
    const json = JSON.stringify(events, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const safeRunId = simulationRunId ? simulationRunId.replace(/[^a-zA-Z0-9_-]+/g, '_') : 'all';
    anchor.href = url;
    anchor.download = `narrative-events-${safeRunId}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  if (events.length === 0) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>
          <span role="img" aria-label="events">&#x1F4DC;</span>
        </div>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>No Narrative Events</h3>
        <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto', lineHeight: 1.6 }}>
          Narrative events are captured during simulation when "Enable event tracking" is turned on
          in the Lore Weave simulation parameters.
        </p>
        <div
          style={{
            marginTop: '24px',
            padding: '16px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            maxWidth: '400px',
            margin: '24px auto 0',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>
            To enable event tracking:
          </div>
          <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            <li>Go to the Lore Weave tab</li>
            <li>Open "Run Simulation"</li>
            <li>Enable "Narrative Events" in parameters</li>
            <li>Run a new simulation</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Filter bar */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: 500 }}>
            {displayedEvents.length === filteredEvents.length
              ? `${filteredEvents.length} of ${events.length} events`
              : `Showing ${displayedEvents.length} of ${filteredEvents.length} filtered (${events.length} total)`}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Sorted by significance
            </div>
            <button
              onClick={handleExportEvents}
              disabled={events.length === 0}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                cursor: events.length === 0 ? 'not-allowed' : 'pointer',
                color: 'var(--text-secondary)',
                opacity: events.length === 0 ? 0.6 : 1,
              }}
            >
              Export JSON
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Significance slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Min significance:</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={significanceFilter}
              onChange={(e) => setSignificanceFilter(parseFloat(e.target.value))}
              style={{ width: '100px' }}
            />
            <span style={{ fontSize: '12px', fontFamily: 'monospace', minWidth: '32px' }}>
              {Math.round(significanceFilter * 100)}%
            </span>
          </div>

          {/* Kind filter */}
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
            }}
          >
            <option value="all">All kinds</option>
            {uniqueKinds.map((kind) => (
              <option key={kind} value={kind}>
                {kind.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          {/* Era filter */}
          <select
            value={eraFilter}
            onChange={(e) => setEraFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
            }}
          >
            <option value="all">All eras</option>
            {uniqueEras.map((era) => (
              <option key={era} value={era}>
                {entityMap?.get(era)?.name || era}
              </option>
            ))}
          </select>

          {/* Tag filter */}
          {uniqueTags.length > 0 && (
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                fontSize: '12px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
              }}
            >
              <option value="">All tags</option>
              {uniqueTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          )}

          {/* Clear filters */}
          {(significanceFilter > 0 || kindFilter !== 'all' || eraFilter !== 'all' || tagFilter) && (
            <button
              onClick={() => {
                setSignificanceFilter(0);
                setKindFilter('all');
                setEraFilter('all');
                setTagFilter('');
              }}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Events list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {sortedEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
            No events match the current filters
          </div>
        ) : (
          <>
            {displayedEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                entityMap={entityMap}
                expanded={expandedEvents.has(event.id)}
                onToggle={() => toggleExpanded(event.id)}
              />
            ))}

            {/* Load more button */}
            {hasMoreEvents && (
              <div style={{ textAlign: 'center', padding: '16px' }}>
                <button
                  onClick={handleLoadMore}
                  style={{
                    padding: '10px 24px',
                    fontSize: '13px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                  }}
                >
                  Load {Math.min(LOAD_MORE_INCREMENT, sortedEvents.length - displayLimit)} more
                  <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
                    ({sortedEvents.length - displayLimit} remaining)
                  </span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
