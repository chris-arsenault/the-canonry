/**
 * BackportConfigModal - Pre-backport entity selection and custom instructions
 *
 * Opens before lore backport to let the user:
 * - See per-entity backport status (backported, not needed, or pending)
 * - Select pending entities to include in backport
 * - Mark entities as "no backport needed"
 * - Provide custom instructions (e.g., "treat as non-canonical fable")
 */

import { useState, useMemo } from "react";

export default function BackportConfigModal({
  isOpen,
  chronicleTitle,
  entities,
  perEntityStatus, // Record<string, 'backported' | 'not_needed'> — already-resolved status per entity
  onStart,
  onMarkNotNeeded, // (entityIds: string[]) => void — mark entities as not needing backport
  onCancel,
}) {
  const statusMap = perEntityStatus || {};

  // Only pending entities are selectable
  const pendingEntities = useMemo(
    () => entities.filter((e) => !statusMap[e.id]),
    [entities, statusMap]
  );
  const [selectedIds, setSelectedIds] = useState(() => new Set(pendingEntities.map((e) => e.id)));
  const [customInstructions, setCustomInstructions] = useState("");

  // Reset selections when entities or status change (new modal open)
  const entityKey = entities.map((e) => e.id).join(",");
  const statusKey = Object.keys(statusMap).sort().join(",");
  const resetKey = `${entityKey}|${statusKey}`;
  const [prevKey, setPrevKey] = useState(resetKey);
  if (resetKey !== prevKey) {
    setPrevKey(resetKey);
    setSelectedIds(new Set(entities.filter((e) => !statusMap[e.id]).map((e) => e.id)));
    setCustomInstructions("");
  }

  const castEntities = useMemo(
    () => entities.filter((e) => !e.isLens && !e.isTertiary),
    [entities]
  );
  const lensEntities = useMemo(() => entities.filter((e) => e.isLens), [entities]);
  const tertiaryEntities = useMemo(() => entities.filter((e) => e.isTertiary), [entities]);

  const doneCount = entities.filter((e) => statusMap[e.id]).length;
  const selectedCount = selectedIds.size;
  const allPendingSelected = selectedCount === pendingEntities.length && pendingEntities.length > 0;

  if (!isOpen) return null;

  const toggleEntity = (id) => {
    if (statusMap[id]) return; // locked
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllPending = () => {
    if (allPendingSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingEntities.map((e) => e.id)));
    }
  };

  const selectTertiaryOnly = () => {
    setSelectedIds(new Set(tertiaryEntities.filter((e) => !statusMap[e.id]).map((e) => e.id)));
  };

  const handleMarkNotNeeded = (entityId) => {
    onMarkNotNeeded([entityId]);
  };

  const renderEntityRow = (e) => {
    const status = statusMap[e.id];
    const isLocked = !!status;

    return (
      <div
        key={e.id}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "4px 0",
          fontSize: "12px",
          opacity: isLocked ? 0.6 : 1,
        }}
      >
        {isLocked ? (
          <span
            style={{
              width: "13px",
              textAlign: "center",
              fontSize: "11px",
              color: status === "backported" ? "#10b981" : "var(--text-muted)",
            }}
          >
            {status === "backported" ? "\u2713" : "\u2014"}
          </span>
        ) : (
          <input
            type="checkbox"
            checked={selectedIds.has(e.id)}
            onChange={() => toggleEntity(e.id)}
            style={{ cursor: "pointer" }}
          />
        )}
        <span
          style={{ flex: 1, cursor: isLocked ? "default" : "pointer" }}
          onClick={() => !isLocked && toggleEntity(e.id)}
        >
          {e.name}
          <span style={{ color: "var(--text-muted)", marginLeft: "6px" }}>
            {e.kind}
            {e.subtype ? ` / ${e.subtype}` : ""}
          </span>
        </span>
        {/* Status / action tags */}
        {status === "backported" && (
          <span
            style={{
              fontSize: "9px",
              padding: "1px 5px",
              borderRadius: "3px",
              background: "rgba(16, 185, 129, 0.15)",
              color: "#10b981",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Done
          </span>
        )}
        {status === "not_needed" && (
          <span
            style={{
              fontSize: "9px",
              padding: "1px 5px",
              borderRadius: "3px",
              background: "rgba(107, 114, 128, 0.15)",
              color: "var(--text-muted)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Skipped
          </span>
        )}
        {!status && (
          <button
            onClick={(ev) => {
              ev.stopPropagation();
              handleMarkNotNeeded(e.id);
            }}
            title="Mark as no backport needed"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: "10px",
              padding: "1px 4px",
              opacity: 0.7,
            }}
            onMouseEnter={(ev) => {
              ev.currentTarget.style.opacity = "1";
            }}
            onMouseLeave={(ev) => {
              ev.currentTarget.style.opacity = "0.7";
            }}
          >
            Skip
          </button>
        )}
        {e.isLens && (
          <span
            style={{
              fontSize: "9px",
              padding: "1px 5px",
              borderRadius: "3px",
              background: "rgba(139, 92, 246, 0.15)",
              color: "#8b5cf6",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Lens
          </span>
        )}
        {e.isTertiary && (
          <span
            style={{
              fontSize: "9px",
              padding: "1px 5px",
              borderRadius: "3px",
              background: "rgba(245, 158, 11, 0.15)",
              color: "#f59e0b",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Tertiary
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.6)",
      }}
    >
      <div
        style={{
          background: "var(--bg-primary)",
          borderRadius: "12px",
          border: "1px solid var(--border-color)",
          width: "500px",
          maxWidth: "95vw",
          maxHeight: "85vh",
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
            flexShrink: 0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: "16px" }}>Backport Lore to Cast</h2>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "4px",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "11px",
                color: "var(--text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
              }}
            >
              {chronicleTitle}
            </p>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 500,
                color:
                  doneCount === entities.length
                    ? "#10b981"
                    : doneCount > 0
                      ? "#f59e0b"
                      : "var(--text-muted)",
                whiteSpace: "nowrap",
                marginLeft: "8px",
              }}
            >
              {doneCount}/{entities.length} complete
            </span>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1, minHeight: 0 }}>
          {/* Entity selection */}
          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Entities ({selectedCount} selected
                {pendingEntities.length < entities.length ? `, ${doneCount} done` : ""})
              </span>
              <span style={{ display: "flex", gap: "8px" }}>
                {tertiaryEntities.length > 0 && (
                  <button
                    onClick={selectTertiaryOnly}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#8b5cf6",
                      cursor: "pointer",
                      fontSize: "11px",
                      padding: 0,
                    }}
                  >
                    Tertiary only
                  </button>
                )}
                {pendingEntities.length > 0 && (
                  <button
                    onClick={toggleAllPending}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--accent-color)",
                      cursor: "pointer",
                      fontSize: "11px",
                      padding: 0,
                    }}
                  >
                    {allPendingSelected ? "Deselect all" : "Select all pending"}
                  </button>
                )}
              </span>
            </div>

            <div
              style={{
                background: "var(--bg-secondary)",
                borderRadius: "6px",
                padding: "8px 12px",
                maxHeight: "240px",
                overflowY: "auto",
              }}
            >
              {castEntities.map(renderEntityRow)}
              {lensEntities.length > 0 && castEntities.length > 0 && (
                <div
                  style={{
                    borderTop: "1px solid var(--border-color)",
                    marginTop: "4px",
                    paddingTop: "4px",
                  }}
                />
              )}
              {lensEntities.map(renderEntityRow)}
              {tertiaryEntities.length > 0 &&
                (castEntities.length > 0 || lensEntities.length > 0) && (
                  <div
                    style={{
                      borderTop: "1px solid var(--border-color)",
                      marginTop: "4px",
                      paddingTop: "4px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "9px",
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        fontWeight: 600,
                        marginBottom: "2px",
                      }}
                    >
                      Tertiary Cast
                    </div>
                  </div>
                )}
              {tertiaryEntities.map(renderEntityRow)}
            </div>
          </div>

          {/* Custom instructions */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "11px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                fontWeight: 600,
                marginBottom: "6px",
              }}
            >
              Custom Instructions (optional)
            </label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder={
                'e.g. "This chronicle is a fable \u2014 treat its events as in-universe fiction, not canonical history. Backported lore should reference these events as legends, myths, or disputed accounts."'
              }
              rows={3}
              style={{
                width: "100%",
                padding: "8px 10px",
                fontSize: "12px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                color: "var(--text-primary)",
                resize: "vertical",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
            <p style={{ margin: "4px 0 0", fontSize: "10px", color: "var(--text-muted)" }}>
              These instructions will be injected as critical directives into the backport prompt.
              Use this for non-canonical chronicles (fables, prophecies, dreamscapes) or any special
              handling.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px 16px",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            gap: "8px",
            justifyContent: "flex-end",
            flexShrink: 0,
          }}
        >
          <button
            onClick={onCancel}
            className="illuminator-button illuminator-button-secondary"
            style={{ padding: "6px 16px", fontSize: "12px" }}
          >
            Cancel
          </button>
          <button
            onClick={() => onStart(Array.from(selectedIds), customInstructions.trim())}
            disabled={selectedCount === 0}
            className="illuminator-button illuminator-button-primary"
            style={{ padding: "6px 16px", fontSize: "12px" }}
          >
            Start Backport ({selectedCount} {selectedCount === 1 ? "entity" : "entities"})
          </button>
        </div>
      </div>
    </div>
  );
}
