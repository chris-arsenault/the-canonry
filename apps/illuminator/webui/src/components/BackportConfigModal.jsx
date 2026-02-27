/**
 * BackportConfigModal - Pre-backport entity selection and custom instructions
 *
 * Opens before lore backport to let the user:
 * - See per-entity backport status (backported, not needed, or pending)
 * - Select pending entities to include in backport
 * - Mark entities as "no backport needed"
 * - Provide custom instructions (e.g., "treat as non-canonical fable")
 */

import React, { useState, useMemo } from "react";
import PropTypes from "prop-types";
import "./BackportConfigModal.css";
export default function BackportConfigModal({
  isOpen,
  chronicleTitle,
  entities,
  perEntityStatus,
  // Record<string, 'backported' | 'not_needed'> — already-resolved status per entity
  onStart,
  onMarkNotNeeded,
  // (entityIds: string[]) => void — mark entities as not needing backport
  onCancel
}) {
  const statusMap = useMemo(() => perEntityStatus || {}, [perEntityStatus]);

  // Only pending entities are selectable
  const pendingEntities = useMemo(() => entities.filter(e => !statusMap[e.id]), [entities, statusMap]);
  const [selectedIds, setSelectedIds] = useState(() => new Set(pendingEntities.map(e => e.id)));
  const [customInstructions, setCustomInstructions] = useState("");

  // Reset selections when entities or status change (new modal open)
  const entityKey = entities.map(e => e.id).join(",");
  const statusKey = Object.keys(statusMap).sort().join(",");
  const resetKey = `${entityKey}|${statusKey}`;
  const [prevKey, setPrevKey] = useState(resetKey);
  if (resetKey !== prevKey) {
    setPrevKey(resetKey);
    setSelectedIds(new Set(entities.filter(e => !statusMap[e.id]).map(e => e.id)));
    setCustomInstructions("");
  }
  const castEntities = useMemo(() => entities.filter(e => !e.isLens && !e.isTertiary), [entities]);
  const lensEntities = useMemo(() => entities.filter(e => e.isLens), [entities]);
  const tertiaryEntities = useMemo(() => entities.filter(e => e.isTertiary), [entities]);
  const doneCount = entities.filter(e => statusMap[e.id]).length;
  const selectedCount = selectedIds.size;
  const allPendingSelected = selectedCount === pendingEntities.length && pendingEntities.length > 0;
  if (!isOpen) return null;
  const toggleEntity = id => {
    if (statusMap[id]) return; // locked
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);else next.add(id);
      return next;
    });
  };
  const toggleAllPending = () => {
    if (allPendingSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingEntities.map(e => e.id)));
    }
  };
  const selectTertiaryOnly = () => {
    setSelectedIds(new Set(tertiaryEntities.filter(e => !statusMap[e.id]).map(e => e.id)));
  };
  const handleMarkNotNeeded = entityId => {
    onMarkNotNeeded([entityId]);
  };
  let progressColor;
  if (doneCount === entities.length) progressColor = "#10b981";else if (doneCount > 0) progressColor = "#f59e0b";else progressColor = "var(--text-muted)";
  const renderEntityRow = e => {
    const status = statusMap[e.id];
    const isLocked = !!status;
    return <div key={e.id} className={`bcm-entity-row ${isLocked ? "bcm-entity-row-locked" : ""}`}>
        {isLocked ? <span className={`bcm-status-icon ${status === "backported" ? "bcm-status-icon-done" : "bcm-status-icon-skipped"}`}>
            {status === "backported" ? "\u2713" : "\u2014"}
          </span> : <input type="checkbox" checked={selectedIds.has(e.id)} onChange={() => toggleEntity(e.id)} className="bcm-checkbox" />}
        <span className={`bcm-entity-name ${isLocked ? "bcm-entity-name-locked" : "bcm-entity-name-clickable"}`} onClick={() => !isLocked && toggleEntity(e.id)} role="button" tabIndex={0} onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
      }}>
          {e.name}
          <span className="bcm-entity-kind">
            {e.kind}
            {e.subtype ? ` / ${e.subtype}` : ""}
          </span>
        </span>
        {/* Status / action tags */}
        {status === "backported" && <span className="bcm-tag bcm-tag-done">Done</span>}
        {status === "not_needed" && <span className="bcm-tag bcm-tag-skipped">Skipped</span>}
        {!status && <button onClick={ev => {
        ev.stopPropagation();
        handleMarkNotNeeded(e.id);
      }} title="Mark as no backport needed" className="bcm-skip-btn">
            Skip
          </button>}
        {e.isLens && <span className="bcm-tag bcm-tag-lens">Lens</span>}
        {e.isTertiary && <span className="bcm-tag bcm-tag-tertiary">Tertiary</span>}
      </div>;
  };
  return <div className="bcm-overlay">
      <div className="bcm-dialog">
        {/* Header */}
        <div className="bcm-header">
          <h2 className="bcm-title">Backport Lore to Cast</h2>
          <div className="bcm-subtitle-row">
            <p className="bcm-chronicle-title">{chronicleTitle}</p>
            <span className="bcm-progress"
          style={{
            "--bcm-progress-color": progressColor
          }}>
              {doneCount}/{entities.length} complete
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="bcm-body">
          {/* Entity selection */}
          <div className="bcm-section">
            <div className="bcm-section-header">
              <span className="bcm-section-label">
                Entities ({selectedCount} selected
                {pendingEntities.length < entities.length ? `, ${doneCount} done` : ""})
              </span>
              <span className="bcm-action-group">
                {tertiaryEntities.length > 0 && <button onClick={selectTertiaryOnly} className="bcm-text-btn bcm-text-btn-tertiary">
                    Tertiary only
                  </button>}
                {pendingEntities.length > 0 && <button onClick={toggleAllPending} className="bcm-text-btn bcm-text-btn-accent">
                    {allPendingSelected ? "Deselect all" : "Select all pending"}
                  </button>}
              </span>
            </div>

            <div className="bcm-entity-list">
              {castEntities.map(renderEntityRow)}
              {lensEntities.length > 0 && castEntities.length > 0 && <div className="bcm-divider" />}
              {lensEntities.map(renderEntityRow)}
              {tertiaryEntities.length > 0 && (castEntities.length > 0 || lensEntities.length > 0) && <div className="bcm-divider">
                    <div className="bcm-tertiary-label">Tertiary Cast</div>
                  </div>}
              {tertiaryEntities.map(renderEntityRow)}
            </div>
          </div>

          {/* Custom instructions */}
          <div>
            <label htmlFor="custom-instructions-optional" className="bcm-instructions-label">Custom Instructions (optional)</label>
            <textarea id="custom-instructions-optional" value={customInstructions} onChange={e => setCustomInstructions(e.target.value)} placeholder={'e.g. "This chronicle is a fable \u2014 treat its events as in-universe fiction, not canonical history. Backported lore should reference these events as legends, myths, or disputed accounts."'} rows={3} className="bcm-textarea" />
            <p className="bcm-instructions-hint">
              These instructions will be injected as critical directives into the backport prompt.
              Use this for non-canonical chronicles (fables, prophecies, dreamscapes) or any special
              handling.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bcm-footer">
          <button onClick={onCancel} className="illuminator-button illuminator-button-secondary bcm-footer-btn">
            Cancel
          </button>
          <button onClick={() => onStart(Array.from(selectedIds), customInstructions.trim())} disabled={selectedCount === 0} className="illuminator-button illuminator-button-primary bcm-footer-btn">
            Start Backport ({selectedCount} {selectedCount === 1 ? "entity" : "entities"})
          </button>
        </div>
      </div>
    </div>;
}
BackportConfigModal.propTypes = {
  isOpen: PropTypes.bool,
  chronicleTitle: PropTypes.string,
  entities: PropTypes.array,
  perEntityStatus: PropTypes.object,
  onStart: PropTypes.func,
  onMarkNotNeeded: PropTypes.func,
  onCancel: PropTypes.func
};
