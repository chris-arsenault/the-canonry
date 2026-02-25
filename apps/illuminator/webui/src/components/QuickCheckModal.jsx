/**
 * QuickCheckModal - Display results from the unanchored entity reference check.
 *
 * Each suspect entry has Search (inline entity search) and Create (open
 * CreateEntityModal with pre-populated defaults) buttons so the user can
 * resolve unanchored references without leaving the modal.
 */

import { useState, useMemo } from "react";

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
      <span
        style={{
          background: "rgba(245, 158, 11, 0.25)",
          color: "var(--text-primary)",
          fontWeight: 600,
          borderRadius: "2px",
          padding: "0 1px",
        }}
      >
        {match}
      </span>
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
    <div
      style={{
        marginTop: "8px",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-color)",
        borderRadius: "6px",
        padding: "8px",
      }}
    >
      <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search entities..."
          autoFocus
          style={{
            flex: 1,
            background: "var(--bg-primary)",
            border: "1px solid var(--border-color)",
            borderRadius: "4px",
            padding: "4px 8px",
            fontSize: "11px",
            color: "var(--text-primary)",
            outline: "none",
          }}
        />
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "14px",
            color: "var(--text-muted)",
            padding: "2px 4px",
          }}
          title="Close search"
        >
          {"\u2715"}
        </button>
      </div>

      <div style={{ maxHeight: "200px", overflow: "auto" }}>
        {query.trim().length < 2 ? (
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              padding: "8px 4px",
              textAlign: "center",
            }}
          >
            Type at least 2 characters to search
          </div>
        ) : results.length === 0 ? (
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              padding: "8px 4px",
              textAlign: "center",
            }}
          >
            No matching entities found
          </div>
        ) : (
          results.slice(0, 10).map(({ entity, matches }) => (
            <div
              key={entity.id}
              style={{
                padding: "5px 6px",
                borderBottom: "1px solid var(--border-color)",
                fontSize: "11px",
              }}
            >
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}
              >
                <span style={{ fontWeight: 600, fontSize: "12px" }}>
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
                <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                  {entity.kind}
                  {entity.subtype ? ` / ${entity.subtype}` : ""}
                </span>
              </div>
              {matches
                .filter((m) => m.field !== "name")
                .slice(0, 3)
                .map((m, j) => (
                  <div
                    key={j}
                    style={{
                      marginTop: "2px",
                      display: "flex",
                      gap: "4px",
                      alignItems: "baseline",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "9px",
                        textTransform: "uppercase",
                        opacity: 0.7,
                        flexShrink: 0,
                      }}
                    >
                      {m.field}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
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
          <div
            style={{
              fontSize: "10px",
              color: "var(--text-muted)",
              padding: "4px",
              textAlign: "center",
            }}
          >
            +{results.length - 10} more results
          </div>
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
      style={{
        padding: "10px 12px",
        marginBottom: "8px",
        background: "var(--bg-primary)",
        borderRadius: "0 6px 6px 0",
        border: "1px solid var(--border-color)",
        borderLeftWidth: "3px",
        borderLeftColor: CONFIDENCE_COLORS[suspect.confidence] || "#6b7280",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "4px",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: "13px" }}>&ldquo;{suspect.phrase}&rdquo;</span>
        <span
          style={{
            fontSize: "10px",
            color: CONFIDENCE_COLORS[suspect.confidence] || "#6b7280",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          {suspect.confidence}
        </span>
      </div>
      {suspect.context && (
        <div
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            fontStyle: "italic",
            marginBottom: "4px",
            lineHeight: "1.4",
          }}
        >
          ...{suspect.context}...
        </div>
      )}
      <div
        style={{
          fontSize: "12px",
          color: "var(--text-secondary)",
          lineHeight: "1.4",
        }}
      >
        {suspect.reasoning}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
        {entities && (
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="illuminator-button illuminator-button-secondary"
            style={{ padding: "3px 8px", fontSize: "10px" }}
            title="Search entity database for this reference"
          >
            {searchOpen ? "Close Search" : "Search"}
          </button>
        )}
        {onCreateEntity && (
          <button
            onClick={() => onCreateEntity(suspect.phrase)}
            className="illuminator-button illuminator-button-secondary"
            style={{ padding: "3px 8px", fontSize: "10px" }}
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
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        background: "rgba(0, 0, 0, 0.5)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          width: "650px",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600 }}>
              Quick Check — Unanchored References
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
              <span style={{ color: ASSESSMENT_COLORS[assessment] || "var(--text-muted)" }}>
                {ASSESSMENT_LABELS[assessment] || assessment}
              </span>{" "}
              &bull; {suspects.length} suspect{suspects.length !== 1 ? "s" : ""}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "18px",
              color: "var(--text-muted)",
              padding: "4px",
            }}
          >
            {"\u2715"}
          </button>
        </div>

        {/* Summary */}
        <div
          style={{
            padding: "10px 20px",
            fontSize: "12px",
            color: "var(--text-secondary)",
            borderBottom: "1px solid var(--border-color)",
            lineHeight: "1.5",
          }}
        >
          {summary}
        </div>

        {/* Suspects list */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
          {suspects.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 0",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              No unanchored references detected.
            </div>
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
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            className="illuminator-button"
            style={{ padding: "6px 16px", fontSize: "12px" }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
