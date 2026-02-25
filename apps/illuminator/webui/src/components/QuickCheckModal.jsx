/**
 * QuickCheckModal - Display results from the unanchored entity reference check.
 *
 * Each suspect entry has Search (inline entity search) and Create (open
 * CreateEntityModal with pre-populated defaults) buttons so the user can
 * resolve unanchored references without leaving the modal.
 */

import React, { useState, useMemo } from "react";
import "./QuickCheckModal.css";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ASSESSMENT_COLORS = {
  clean: "#22c55e",
  minor: "#f59e0b",
  flagged: "#ef4444",
};

const ASSESSMENT_LABELS = {
  clean: "Clean",
  minor: "Minor issues",
  flagged: "Flagged",
};

const CONFIDENCE_COLORS = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#6b7280",
};

// ---------------------------------------------------------------------------
// HighlightMatch — inline highlight helper (mirrors EntityBrowser)
// ---------------------------------------------------------------------------

function HighlightMatch({ text, query, truncate = 0, matchIndex }) {
  if (!query || !text) return text;
  const idx = matchIndex != null ? matchIndex : text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1)
    return truncate > 0 && text.length > truncate ? text.slice(0, truncate) + "\u2026" : text;

  let displayText = text;
  let displayIdx = idx;

  if (truncate > 0 && text.length > truncate) {
    const contextRadius = Math.floor(truncate / 2);
    const winStart = Math.max(0, idx - contextRadius);
    const winEnd = Math.min(text.length, idx + query.length + contextRadius);
    displayText =
      (winStart > 0 ? "\u2026" : "") +
      text.slice(winStart, winEnd) +
      (winEnd < text.length ? "\u2026" : "");
    displayIdx = idx - winStart + (winStart > 0 ? 1 : 0);
  }

  const before = displayText.slice(0, displayIdx);
  const match = displayText.slice(displayIdx, displayIdx + query.length);
  const after = displayText.slice(displayIdx + query.length);

  return (
    <>
      {before}
      <span className="qcm-highlight">{match}</span>
      {after}
    </>
  );
}

// ---------------------------------------------------------------------------
// EntitySearchPanel — inline search within a suspect card
// ---------------------------------------------------------------------------

function searchEntities(entities, query) {
  const q = query.trim().toLowerCase();
  if (!q || q.length < 2 || !entities) return [];

  const results = [];
  for (const entity of entities) {
    const matches = [];

    const nameIdx = entity.name.toLowerCase().indexOf(q);
    if (nameIdx !== -1) {
      matches.push({ field: "name", value: entity.name, matchIndex: nameIdx });
    }

    const aliases = entity.enrichment?.text?.aliases || [];
    for (const alias of aliases) {
      if (typeof alias !== "string") continue;
      const aliasIdx = alias.toLowerCase().indexOf(q);
      if (aliasIdx !== -1) {
        matches.push({ field: "alias", value: alias, matchIndex: aliasIdx });
      }
    }

    const slugAliases = entity.enrichment?.slugAliases || [];
    for (const slug of slugAliases) {
      if (typeof slug !== "string") continue;
      const slugIdx = slug.toLowerCase().indexOf(q);
      if (slugIdx !== -1) {
        matches.push({ field: "slug alias", value: slug, matchIndex: slugIdx });
      }
    }

    if (entity.summary) {
      const sumIdx = entity.summary.toLowerCase().indexOf(q);
      if (sumIdx !== -1) {
        matches.push({ field: "summary", value: entity.summary, matchIndex: sumIdx });
      }
    }

    if (entity.description) {
      const descIdx = entity.description.toLowerCase().indexOf(q);
      if (descIdx !== -1) {
        matches.push({ field: "description", value: entity.description, matchIndex: descIdx });
      }
    }

    if (matches.length > 0) {
      results.push({ entity, matches });
    }
  }

  results.sort((a, b) => {
    const aHasName = a.matches.some((m) => m.field === "name") ? 0 : 1;
    const bHasName = b.matches.some((m) => m.field === "name") ? 0 : 1;
    if (aHasName !== bHasName) return aHasName - bHasName;
    return a.entity.name.localeCompare(b.entity.name);
  });

  return results;
}

function EntitySearchPanel({ entities, initialQuery, onClose }) {
  const [query, setQuery] = useState(initialQuery || "");
  const results = useMemo(() => searchEntities(entities, query), [entities, query]);

  return (
    <div className="qcm-search-panel">
      <div className="qcm-search-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search entities..."
          autoFocus
          className="qcm-search-input"
        />
        <button onClick={onClose} className="qcm-search-close-btn" title="Close search">
          {"\u2715"}
        </button>
      </div>

      <div className="qcm-search-results">
        {query.trim().length < 2 ? (
          <div className="qcm-search-hint">Type at least 2 characters to search</div>
        ) : results.length === 0 ? (
          <div className="qcm-search-hint">No matching entities found</div>
        ) : (
          results.slice(0, 10).map(({ entity, matches }) => (
            <div key={entity.id} className="qcm-search-result-item">
              <div className="qcm-search-result-header">
                <span className="qcm-search-result-name">
                  {matches.some((m) => m.field === "name") ? (
                    <HighlightMatch
                      text={entity.name}
                      query={query}
                      matchIndex={matches.find((m) => m.field === "name").matchIndex}
                    />
                  ) : (
                    entity.name
                  )}
                </span>
                <span className="qcm-search-result-kind">
                  {entity.kind}
                  {entity.subtype ? ` / ${entity.subtype}` : ""}
                </span>
              </div>
              {matches
                .filter((m) => m.field !== "name")
                .slice(0, 3)
                .map((m, j) => (
                  <div key={j} className="qcm-search-match-row">
                    <span className="qcm-search-match-field">{m.field}</span>
                    <span className="qcm-search-match-value">
                      <HighlightMatch
                        text={m.value}
                        query={query}
                        truncate={m.field === "summary" || m.field === "description" ? 120 : 0}
                        matchIndex={m.matchIndex}
                      />
                    </span>
                  </div>
                ))}
            </div>
          ))
        )}
        {results.length > 10 && (
          <div className="qcm-search-more">+{results.length - 10} more results</div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SuspectCard — individual suspect entry with Search/Create buttons
// ---------------------------------------------------------------------------

function SuspectCard({ suspect, entities, onCreateEntity }) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div
      className="qcm-suspect-card"
      // eslint-disable-next-line local/no-inline-styles -- dynamic confidence color from JS map
      style={{ "--qcm-confidence-color": CONFIDENCE_COLORS[suspect.confidence] || "#6b7280" }}
    >
      <div className="qcm-suspect-header">
        <span className="qcm-suspect-phrase">&ldquo;{suspect.phrase}&rdquo;</span>
        <span className="qcm-suspect-confidence">{suspect.confidence}</span>
      </div>
      {suspect.context && <div className="qcm-suspect-context">...{suspect.context}...</div>}
      <div className="qcm-suspect-reasoning">{suspect.reasoning}</div>

      {/* Action buttons */}
      <div className="qcm-suspect-actions">
        {entities && (
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="illuminator-button illuminator-button-secondary qcm-suspect-action-btn"
            title="Search entity database for this reference"
          >
            {searchOpen ? "Close Search" : "Search"}
          </button>
        )}
        {onCreateEntity && (
          <button
            onClick={() => onCreateEntity(suspect.phrase)}
            className="illuminator-button illuminator-button-secondary qcm-suspect-action-btn"
            title="Create a new entity from this reference"
          >
            + Create
          </button>
        )}
      </div>

      {/* Inline search panel */}
      {searchOpen && entities && (
        <EntitySearchPanel
          entities={entities}
          initialQuery={suspect.phrase}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuickCheckModal
// ---------------------------------------------------------------------------

export default function QuickCheckModal({ report, entities, onCreateEntity, onClose }) {
  if (!report) return null;

  const { suspects, assessment, summary } = report;

  return (
    <div
      className="qcm-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="qcm-dialog">
        {/* Header */}
        <div className="qcm-header">
          <div>
            <div className="qcm-header-title">Quick Check — Unanchored References</div>
            <div className="qcm-header-subtitle">
              <span
                className="qcm-assessment-label"
                // eslint-disable-next-line local/no-inline-styles -- dynamic assessment color from JS map
                style={{
                  "--qcm-assessment-color": ASSESSMENT_COLORS[assessment] || "var(--text-muted)",
                }}
              >
                {ASSESSMENT_LABELS[assessment] || assessment}
              </span>{" "}
              &bull; {suspects.length} suspect{suspects.length !== 1 ? "s" : ""}
            </div>
          </div>
          <button onClick={onClose} className="qcm-close-btn">
            {"\u2715"}
          </button>
        </div>

        {/* Summary */}
        <div className="qcm-summary">{summary}</div>

        {/* Suspects list */}
        <div className="qcm-suspects-list">
          {suspects.length === 0 ? (
            <div className="qcm-empty-message">No unanchored references detected.</div>
          ) : (
            suspects.map((suspect, i) => (
              <SuspectCard
                key={i}
                suspect={suspect}
                entities={entities}
                onCreateEntity={onCreateEntity}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="qcm-footer">
          <button onClick={onClose} className="illuminator-button qcm-footer-btn">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
