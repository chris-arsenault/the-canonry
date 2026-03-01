/**
 * SummaryRevisionModal - Batch review UI for entity summary revisions
 *
 * Shows a modal with:
 * - Batch progress indicator
 * - Per-entity inline diff view (word-level, git-style)
 * - Accept/reject toggles per entity
 * - Export button for review
 * - Continue/cancel/apply controls
 */

import React, { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import { diffWords } from "diff";
import { resolveAnchorPhrase } from "../lib/fuzzyAnchor";
import { ErrorMessage } from "@the-canonry/shared-components";
import "./SummaryRevisionModal.css";

// ============================================================================
// Inline Diff View (word-level, git-style)
// ============================================================================

function InlineDiff({ current, proposed, label }) {
  if (!proposed || proposed === current) return null;

  const changes = diffWords(current || "", proposed);

  return (
    <div className="srm-diff-section">
      <div className="srm-diff-label">{label}</div>
      <div className="srm-diff-content">
        {changes.map((part, i) => {
          if (part.added) {
            return (
              <span key={i} className="srm-diff-added">
                {part.value}
              </span>
            );
          }
          if (part.removed) {
            return (
              <span key={i} className="srm-diff-removed">
                {part.value}
              </span>
            );
          }
          return <span key={i}>{part.value}</span>;
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Patch Card
// ============================================================================

// ============================================================================
// Anchor Phrase Editor (for chronicle backref linking)
// ============================================================================

function AnchorPhraseEditor({ patch, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(patch.anchorPhrase || "");

  // Sync when patch updates externally
  useEffect(() => {
    setValue(patch.anchorPhrase || "");
  }, [patch.anchorPhrase]);

  if (!patch.anchorPhrase && !editing) return null;

  const phraseInDescription =
    patch.anchorPhrase &&
    patch.description &&
    resolveAnchorPhrase(patch.anchorPhrase, patch.description) !== null;

  if (editing) {
    return (
      <div className="srm-anchor-section">
        <div className="srm-anchor-label">Anchor Phrase</div>
        <div className="srm-anchor-edit-row">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="srm-anchor-input"
          />
          <button
            onClick={() => {
              onUpdate(patch.entityId, value);
              setEditing(false);
            }}
            className="srm-anchor-save-btn"
          >
            Save
          </button>
          <button
            onClick={() => {
              setValue(patch.anchorPhrase || "");
              setEditing(false);
            }}
            className="srm-anchor-cancel-btn"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="srm-anchor-section">
      <div className="srm-anchor-label">
        Anchor Phrase
        {!phraseInDescription && (
          <span className="srm-anchor-warning">not found in description</span>
        )}
      </div>
      <div className="srm-anchor-display">
        <span
          className={`srm-anchor-phrase ${phraseInDescription ? "srm-anchor-phrase-found" : "srm-anchor-phrase-missing"}`}
        >
          &ldquo;{patch.anchorPhrase}&rdquo;
        </span>
        <button onClick={() => setEditing(true)} className="srm-anchor-edit-trigger">
          Edit
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Patch Card
// ============================================================================

function PatchCard({
  patch,
  currentEntity,
  accepted,
  onToggle,
  expanded,
  onToggleExpand,
  onUpdateAnchorPhrase,
  descriptionBaseline,
}) {
  const hasSummaryChange = patch.summary && patch.summary !== currentEntity?.summary;
  const baselineDesc = descriptionBaseline ?? currentEntity?.description;
  const hasDescChange = patch.description && patch.description !== baselineDesc;

  return (
    <div className="srm-patch-card" data-accepted={accepted !== false}>
      {/* Header -- always visible */}
      <div onClick={onToggleExpand} className="srm-patch-header" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggleExpand(e); }} >
        <div className="srm-patch-header-left">
          <span className="srm-patch-expand-icon">{expanded ? "\u25BC" : "\u25B6"}</span>
          <span className="srm-patch-entity-name">{patch.entityName}</span>
          <span className="srm-patch-entity-kind">{patch.entityKind}</span>
          <span className="srm-patch-changes-label">
            {[hasSummaryChange && "summary", hasDescChange && "description"]
              .filter(Boolean)
              .join(" + ")}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(patch.entityId, accepted === false);
          }}
          className="srm-patch-toggle-btn"
          data-accepted={accepted !== false}
        >
          {accepted !== false ? "Accepted" : "Rejected"}
        </button>
      </div>

      {/* Expanded diff view */}
      {expanded && (
        <div className="srm-patch-expanded">
          {hasSummaryChange && (
            <InlineDiff
              current={currentEntity?.summary || ""}
              proposed={patch.summary}
              label="Summary"
            />
          )}
          {hasDescChange && (
            <InlineDiff
              current={baselineDesc || ""}
              proposed={patch.description}
              label="Description"
            />
          )}
          {onUpdateAnchorPhrase && hasDescChange && (
            <AnchorPhraseEditor patch={patch} onUpdate={onUpdateAnchorPhrase} />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Export Helpers
// ============================================================================

function buildExportText(allPatches, entityLookup, patchDecisions, descriptionBaseline) {
  const lines = [];
  for (const patch of allPatches) {
    const current = entityLookup.get(patch.entityId);
    const accepted = patchDecisions[patch.entityId] !== false;
    lines.push(
      `=== ${patch.entityName} (${patch.entityKind}) [${accepted ? "ACCEPTED" : "REJECTED"}] ===`
    );
    lines.push("");

    const hasSummaryChange = patch.summary && patch.summary !== current?.summary;
    const baselineDesc = descriptionBaseline ?? current?.description;
    const hasDescChange = patch.description && patch.description !== baselineDesc;

    if (hasSummaryChange) {
      lines.push("--- Summary ---");
      lines.push("CURRENT:");
      lines.push(current?.summary || "(empty)");
      lines.push("");
      lines.push("PROPOSED:");
      lines.push(patch.summary);
      lines.push("");
    }

    if (hasDescChange) {
      lines.push("--- Description ---");
      lines.push("CURRENT:");
      lines.push(baselineDesc || "(empty)");
      lines.push("");
      lines.push("PROPOSED:");
      lines.push(patch.description);
      lines.push("");
    }

    if (!hasSummaryChange && !hasDescChange) {
      lines.push("(no changes)");
      lines.push("");
    }

    lines.push("");
  }
  return lines.join("\n");
}

function downloadText(content, filename) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================================
// Main Modal
// ============================================================================

export default function SummaryRevisionModal({
  run,
  isActive,
  onContinue,
  onAutoContine,
  onTogglePatch,
  onAccept,
  onCancel,
  getEntityContexts,
  onUpdateAnchorPhrase,
  descriptionBaseline,
}) {
  const scrollRef = useRef(null);
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Auto-scroll on new content
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [run?.batches?.length, run?.currentBatchIndex, run?.status]);

  // Reset expanded state when batch changes
  useEffect(() => {
    setExpandedIds(new Set());
  }, [run?.currentBatchIndex, run?.status]);

  // Build entity lookup from entity contexts
  const [entityLookup, setEntityLookup] = useState(new Map());
  useEffect(() => {
    if (!run || !getEntityContexts) {
      setEntityLookup(new Map());
      return;
    }
    let cancelled = false;
    const allIds = run.batches.flatMap((b) => b.entityIds);
    Promise.resolve(getEntityContexts(allIds)).then((contexts) => {
      if (cancelled) return;
      const map = new Map();
      for (const ctx of contexts) {
        if (ctx) map.set(ctx.id, ctx);
      }
      setEntityLookup(map);
    });
    return () => {
      cancelled = true;
    };
  }, [run, getEntityContexts]);

  if (!isActive || !run) return null;

  const isGenerating = run.status === "generating" || run.status === "pending";
  const isBatchReviewing = run.status === "batch_reviewing";
  const isRunReviewing = run.status === "run_reviewing";
  const isFailed = run.status === "failed";

  const currentBatch = run.batches[run.currentBatchIndex];
  const totalBatches = run.batches.length;
  const completedBatches = run.batches.filter(
    (b) => b.status === "complete" || b.status === "failed"
  ).length;

  // Collect patches for display
  const allPatches = isRunReviewing
    ? run.batches.flatMap((b) => b.patches || [])
    : currentBatch?.patches || [];

  const acceptedCount = allPatches.filter((p) => run.patchDecisions[p.entityId] !== false).length;

  const toggleExpand = (entityId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entityId)) next.delete(entityId);
      else next.add(entityId);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(allPatches.map((p) => p.entityId)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const handleExport = () => {
    const text = buildExportText(allPatches, entityLookup, run.patchDecisions, descriptionBaseline);
    const timestamp = Date.now();
    downloadText(text, `revision-patches-${timestamp}.txt`);
  };

  return (
    <div className="srm-overlay">
      <div className="srm-modal">
        {/* Header */}
        <div className="srm-modal-header">
          <div>
            <h2 className="srm-modal-title">
              Batch Revision
              {currentBatch && !isRunReviewing && (
                <span className="srm-modal-culture">{currentBatch.culture}</span>
              )}
            </h2>
            <p className="srm-modal-subtitle">
              {isRunReviewing
                ? `All ${totalBatches} batches complete. Review and apply patches.`
                : `Batch ${run.currentBatchIndex + 1} of ${totalBatches}`}
              {completedBatches > 0 && !isRunReviewing && ` (${completedBatches} complete)`}
            </p>
          </div>
          <div className="srm-modal-header-right">
            {run.totalActualCost > 0 && (
              <span className="srm-modal-cost">${run.totalActualCost.toFixed(4)}</span>
            )}
            <button
              onClick={onCancel}
              className="illuminator-button illuminator-button-secondary srm-cancel-btn"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="srm-modal-scroll">
          {isGenerating && (
            <div className="srm-generating">
              <div className="srm-generating-label">
                Generating revisions for batch {run.currentBatchIndex + 1}...
              </div>
              {currentBatch && (
                <div className="srm-generating-detail">
                  {currentBatch.culture} ({currentBatch.entityIds.length} entities)
                </div>
              )}
            </div>
          )}

          {isFailed && currentBatch?.error && <ErrorMessage message={currentBatch.error} className="srm-error" />}

          {/* Patches */}
          {allPatches.length > 0 && (
            <div>
              <div className="srm-patches-toolbar">
                <span className="srm-patches-count">
                  {allPatches.length} entities revised
                  <span className="srm-patches-accepted">{acceptedCount} accepted</span>
                </span>
                <div className="srm-patches-actions">
                  <button onClick={handleExport} className="srm-toolbar-btn">
                    Export
                  </button>
                  <button onClick={expandAll} className="srm-toolbar-btn">
                    Expand all
                  </button>
                  <button onClick={collapseAll} className="srm-toolbar-btn">
                    Collapse all
                  </button>
                </div>
              </div>
              {allPatches.map((patch) => (
                <PatchCard
                  key={patch.entityId}
                  patch={patch}
                  currentEntity={entityLookup.get(patch.entityId)}
                  accepted={run.patchDecisions[patch.entityId]}
                  onToggle={onTogglePatch}
                  expanded={expandedIds.has(patch.entityId)}
                  onToggleExpand={() => toggleExpand(patch.entityId)}
                  onUpdateAnchorPhrase={onUpdateAnchorPhrase}
                  descriptionBaseline={descriptionBaseline}
                />
              ))}
            </div>
          )}

          {(isBatchReviewing || isRunReviewing) && allPatches.length === 0 && (
            <div className="srm-no-patches">No changes suggested for this batch.</div>
          )}

          <div ref={scrollRef} />
        </div>

        {/* Footer */}
        <div className="srm-modal-footer">
          {isBatchReviewing && (
            <>
              <button
                onClick={onAutoContine}
                className="illuminator-button illuminator-button-secondary srm-footer-btn"
              >
                Auto-Continue All
              </button>
              <button
                onClick={onContinue}
                className="illuminator-button illuminator-button-primary srm-footer-btn"
              >
                {run.currentBatchIndex + 1 < totalBatches
                  ? `Continue to Batch ${run.currentBatchIndex + 2}`
                  : "Finish Review"}
              </button>
            </>
          )}
          {isRunReviewing && (
            <button
              onClick={onAccept}
              className="illuminator-button illuminator-button-primary srm-footer-btn"
            >
              Apply Accepted ({acceptedCount})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

InlineDiff.propTypes = {
  current: PropTypes.string,
  proposed: PropTypes.string,
  label: PropTypes.string,
};

AnchorPhraseEditor.propTypes = {
  patch: PropTypes.object.isRequired,
  onUpdate: PropTypes.func.isRequired,
};

PatchCard.propTypes = {
  patch: PropTypes.object.isRequired,
  currentEntity: PropTypes.object,
  accepted: PropTypes.bool,
  onToggle: PropTypes.func.isRequired,
  expanded: PropTypes.bool,
  onToggleExpand: PropTypes.func.isRequired,
  onUpdateAnchorPhrase: PropTypes.func,
  descriptionBaseline: PropTypes.string,
};

SummaryRevisionModal.propTypes = {
  run: PropTypes.object,
  isActive: PropTypes.bool,
  onContinue: PropTypes.func,
  onAutoContine: PropTypes.func,
  onTogglePatch: PropTypes.func,
  onAccept: PropTypes.func,
  onCancel: PropTypes.func.isRequired,
  getEntityContexts: PropTypes.func,
  onUpdateAnchorPhrase: PropTypes.func,
  descriptionBaseline: PropTypes.string,
};
