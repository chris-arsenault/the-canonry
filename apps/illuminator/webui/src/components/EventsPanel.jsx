/**
 * EventsPanel - View and filter narrative events from simulation
 *
 * Displays narrative events captured during lore-weave simulation,
 * with filtering by era, kind, significance, and tags.
 */

import { useState, useMemo, useEffect } from "react";
import "./EventsPanel.css";

// Display limit for performance - loading 7000+ events causes UI freeze
const DEFAULT_DISPLAY_LIMIT = 500;
const LOAD_MORE_INCREMENT = 250;

// Event kind colors
const EVENT_KIND_COLORS = {
  state_change: { bg: "rgba(59, 130, 246, 0.15)", text: "#3b82f6" },
  relationship_change: { bg: "rgba(168, 85, 247, 0.15)", text: "#a855f7" },
  entity_lifecycle: { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444" },
  era_transition: { bg: "rgba(236, 72, 153, 0.15)", text: "#ec4899" },
  conflict: { bg: "rgba(249, 115, 22, 0.15)", text: "#f97316" },
  alliance: { bg: "rgba(34, 197, 94, 0.15)", text: "#22c55e" },
  discovery: { bg: "rgba(14, 165, 233, 0.15)", text: "#0ea5e9" },
  achievement: { bg: "rgba(234, 179, 8, 0.15)", text: "#eab308" },
};

function EventKindBadge({ kind }) {
  const colors = EVENT_KIND_COLORS[kind] || { bg: "rgba(107, 114, 128, 0.15)", text: "#6b7280" };
  return (
    <span
      className="events-panel-kind-badge"
      // eslint-disable-next-line local/no-inline-styles
      style={{ '--badge-bg': colors.bg, '--badge-text': colors.text, background: 'var(--badge-bg)', color: 'var(--badge-text)' }}
    >
      {kind.replace(/_/g, " ")}
    </span>
  );
}

function SignificanceBar({ value }) {
  const percentage = Math.round(value * 100);
  const color = value >= 0.8 ? "#ef4444" : value >= 0.5 ? "#f59e0b" : "#22c55e";

  return (
    <div className="events-panel-significance-row">
      <div className="events-panel-significance-track">
        <div
          className="events-panel-significance-fill"
          // eslint-disable-next-line local/no-inline-styles
          style={{ '--sig-width': `${percentage}%`, '--sig-color': color, width: 'var(--sig-width)', background: 'var(--sig-color)' }}
        />
      </div>
      <span className="events-panel-significance-label">
        {percentage}%
      </span>
    </div>
  );
}

function NarrativeTag({ tag }) {
  return (
    <span className="events-panel-narrative-tag">
      {tag}
    </span>
  );
}

function StateChangeItem({ change }) {
  return (
    <div className="events-panel-state-change">
      <span className="events-panel-state-entity-name">{change.entityName}</span>
      <span className="events-panel-state-field">{change.field}:</span>
      <span className="events-panel-state-old-value">
        {String(change.previousValue)}
      </span>
      <span className="events-panel-state-arrow">&rarr;</span>
      <span className="events-panel-state-new-value">{String(change.newValue)}</span>
    </div>
  );
}

function EventCard({ event, entityMap, expanded, onToggle }) {
  const subjectEntity = entityMap?.get(event.subject?.id);
  const objectEntity = event.object ? entityMap?.get(event.object.id) : null;

  return (
    <div className="events-panel-card">
      {/* Header row */}
      <div className="events-panel-card-header">
        <div className="events-panel-card-header-left">
          <div className="events-panel-card-meta-row">
            <EventKindBadge kind={event.eventKind} />
            <span className="events-panel-card-tick">tick {event.tick}</span>
          </div>
          <h3
            className="events-panel-card-headline"
            onClick={onToggle}
          >
            {event.headline}
          </h3>
        </div>
        <SignificanceBar value={event.significance} />
      </div>

      {/* Subject/Object */}
      <div className="events-panel-card-subject">
        <span className="events-panel-card-entity-name">{event.subject?.name || "Unknown"}</span>
        {event.subject?.kind && (
          <span className="events-panel-card-entity-kind">
            ({event.subject.kind})
          </span>
        )}
        {event.object && (
          <>
            <span className="events-panel-card-arrow">&rarr;</span>
            <span className="events-panel-card-entity-name">{event.object.name}</span>
            <span className="events-panel-card-entity-kind">
              ({event.object.kind})
            </span>
          </>
        )}
      </div>

      {/* Tags */}
      {event.narrativeTags && event.narrativeTags.length > 0 && (
        <div className="events-panel-card-tags">
          {event.narrativeTags.map((tag) => (
            <NarrativeTag key={tag} tag={tag} />
          ))}
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="events-panel-card-expanded">
          {/* Description */}
          {event.description && (
            <p className="events-panel-card-description">
              {event.description}
            </p>
          )}

          {/* State changes */}
          {event.stateChanges && event.stateChanges.length > 0 && (
            <div className="events-panel-card-state-changes">
              <div className="events-panel-card-state-changes-label">
                State Changes
              </div>
              {event.stateChanges.map((change, i) => (
                <StateChangeItem key={i} change={change} />
              ))}
            </div>
          )}

          {/* Causality */}
          {event.causedBy && (
            <div className="events-panel-card-causality">
              <span className="events-panel-card-causality-label">Caused by:</span>{" "}
              {event.causedBy.actionType || event.causedBy.eventId || "Unknown"}
              {event.causedBy.entityId && ` (${event.causedBy.entityId})`}
            </div>
          )}
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="events-panel-card-toggle"
      >
        {expanded ? "Show less" : "Show more"}
      </button>
    </div>
  );
}

export default function EventsPanel({ narrativeEvents = [], simulationRunId, entityMap }) {
  const [significanceFilter, setSignificanceFilter] = useState(0);
  const [kindFilter, setKindFilter] = useState("all");
  const [eraFilter, setEraFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("");
  const [expandedEvents, setExpandedEvents] = useState(new Set());
  const [displayLimit, setDisplayLimit] = useState(DEFAULT_DISPLAY_LIMIT);

  const events = narrativeEvents || [];

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
      if (kindFilter !== "all" && event.eventKind !== kindFilter) return false;
      if (eraFilter !== "all" && event.era !== eraFilter) return false;
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
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const safeRunId = simulationRunId ? simulationRunId.replace(/[^a-zA-Z0-9_-]+/g, "_") : "all";
    anchor.href = url;
    anchor.download = `narrative-events-${safeRunId}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  if (events.length === 0) {
    return (
      <div className="events-panel-empty">
        <div className="events-panel-empty-icon">
          <span role="img" aria-label="events">
            &#x1F4DC;
          </span>
        </div>
        <h3 className="events-panel-empty-title">No Narrative Events</h3>
        <p className="events-panel-empty-text">
          Narrative events are captured during simulation when "Enable event tracking" is turned on
          in the Lore Weave simulation parameters.
        </p>
        <div className="events-panel-empty-instructions">
          <div className="events-panel-empty-instructions-title">
            To enable event tracking:
          </div>
          <ol className="events-panel-empty-instructions-list">
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
    <div className="events-panel-root">
      {/* Filter bar */}
      <div className="events-panel-filter-bar">
        <div className="events-panel-filter-header">
          <div className="events-panel-filter-count">
            {displayedEvents.length === filteredEvents.length
              ? `${filteredEvents.length} of ${events.length} events`
              : `Showing ${displayedEvents.length} of ${filteredEvents.length} filtered (${events.length} total)`}
          </div>
          <div className="events-panel-filter-actions">
            <div className="events-panel-filter-sort-label">
              Sorted by significance
            </div>
            <button
              onClick={handleExportEvents}
              disabled={events.length === 0}
              className="events-panel-export-btn"
            >
              Export JSON
            </button>
          </div>
        </div>

        <div className="events-panel-filters-row">
          {/* Significance slider */}
          <div className="events-panel-significance-filter">
            <label className="events-panel-filter-label">
              Min significance:
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={significanceFilter}
              onChange={(e) => setSignificanceFilter(parseFloat(e.target.value))}
              className="events-panel-significance-slider"
            />
            <span className="events-panel-significance-value">
              {Math.round(significanceFilter * 100)}%
            </span>
          </div>

          {/* Kind filter */}
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="events-panel-filter-select"
          >
            <option value="all">All kinds</option>
            {uniqueKinds.map((kind) => (
              <option key={kind} value={kind}>
                {kind.replace(/_/g, " ")}
              </option>
            ))}
          </select>

          {/* Era filter */}
          <select
            value={eraFilter}
            onChange={(e) => setEraFilter(e.target.value)}
            className="events-panel-filter-select"
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
              className="events-panel-filter-select"
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
          {(significanceFilter > 0 || kindFilter !== "all" || eraFilter !== "all" || tagFilter) && (
            <button
              onClick={() => {
                setSignificanceFilter(0);
                setKindFilter("all");
                setEraFilter("all");
                setTagFilter("");
              }}
              className="events-panel-clear-filters-btn"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Events list */}
      <div className="events-panel-list">
        {sortedEvents.length === 0 ? (
          <div className="events-panel-no-match">
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
              <div className="events-panel-load-more-row">
                <button
                  onClick={handleLoadMore}
                  className="events-panel-load-more-btn"
                >
                  Load {Math.min(LOAD_MORE_INCREMENT, sortedEvents.length - displayLimit)} more
                  <span className="events-panel-load-more-remaining">
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
