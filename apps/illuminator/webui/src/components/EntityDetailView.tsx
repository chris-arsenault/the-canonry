/**
 * EntityDetailView - Inline entity detail panel (replaces EntityDetailsModal lightbox)
 *
 * Two-column layout: main content (left) + metadata sidebar (right).
 * Rendered inside EntityBrowser, replacing the entity list when an entity is selected.
 */

import React, { useState, useEffect, useCallback } from "react";
import type {
  NetworkDebugInfo,
  DescriptionChainDebug,
  ChronicleBackref,
} from "../lib/enrichmentTypes";
import HistorianMarginNotes from "./HistorianMarginNotes";
import HistorianToneSelector from "./HistorianToneSelector";
import HistorianEditionComparison from "./HistorianEditionComparison";
import { prominenceLabelFromScale } from "@canonry/world-schema";
import { useProminenceScale } from "../lib/db/indexSelectors";
import { useEntityCrud } from "../hooks/useEntityCrud";
import { useHistorianActions } from "../hooks/useHistorianActions";
import { useIlluminatorModals } from "../lib/db/modalStore";
import { useEnrichmentQueueStore } from "../lib/db/enrichmentQueueStore";
import HistoryCompressionPreviewModal from "./HistoryCompressionPreviewModal";
import BackrefImageEditor from "./BackrefImageEditor";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./EntityDetailView.css";

interface EntityEnrichment {
  text?: {
    aliases: string[];
    visualThesis?: string;
    visualTraits: string[];
    generatedAt: number;
    model: string;
    estimatedCost?: number;
    actualCost?: number;
    inputTokens?: number;
    outputTokens?: number;
    debug?: NetworkDebugInfo;
    chainDebug?: DescriptionChainDebug;
  };
  image?: {
    imageId: string;
    generatedAt: number;
    model: string;
  };
  historianNotes?: import("../lib/historianTypes").HistorianNote[];
  chronicleBackrefs?: ChronicleBackref[];
  descriptionHistory?: Array<{
    description: string;
    source?: string;
    replacedAt?: number;
  }>;
}

interface Entity {
  id: string;
  name: string;
  kind: string;
  subtype: string;
  prominence: number;
  culture?: string;
  status: string;
  summary?: string;
  description?: string;
  createdAt?: number;
  updatedAt?: number;
  enrichment?: EntityEnrichment;
}

interface EntityDetailViewProps {
  entity: Entity;
  entities: Entity[];
  onBack: () => void;
}

function formatDate(timestamp: number | undefined): string {
  if (!timestamp) return "Unknown";
  return new Date(timestamp).toLocaleString();
}

function formatCost(cost: number | undefined): string {
  if (!cost) return "N/A";
  return `$${cost.toFixed(4)}`;
}

// ---------------------------------------------------------------------------
// Sidebar sub-components
// ---------------------------------------------------------------------------

function MetadataRow({ label, value }: Readonly<{ label: string; value: string | undefined | null }>) {
  if (!value) return null;
  return (
    <div className="edv-meta-row">
      <div className="edv-meta-row-label">{label}</div>
      <div className="edv-meta-row-value">{value}</div>
    </div>
  );
}

function ExpandableSection({
  title,
  content,
  charCount,
}: Readonly<{
  title: string;
  content: string | undefined;
  charCount?: number;
}>) {
  const [expanded, setExpanded] = useState(false);
  if (!content) return null;

  return (
    <div className="edv-expandable">
      <button onClick={() => setExpanded(!expanded)} className="edv-expandable-toggle">
        <span className={`edv-expandable-arrow ${expanded ? "edv-expandable-arrow-open" : ""}`}>
          ▶
        </span>
        <span className="edv-expandable-title">{title}</span>
        {charCount !== undefined && <span className="edv-expandable-chars">{charCount} chars</span>}
      </button>
      {expanded && <div className="edv-expandable-content">{content}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main content sub-components
// ---------------------------------------------------------------------------

function VisualTraitsList({ traits }: Readonly<{ traits: string[] }>) {
  if (!traits || traits.length === 0) return null;
  return (
    <div className="edv-traits">
      <div className="edv-traits-label">Visual Traits</div>
      <div className="edv-traits-list">
        {traits.map((trait, i) => (
          <span key={i} className="edv-traits-tag">
            {trait}
          </span>
        ))}
      </div>
    </div>
  );
}

function AliasesList({
  aliases,
  onUpdate,
}: Readonly<{
  aliases: string[];
  onUpdate?: (aliases: string[]) => void;
}>) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [addValue, setAddValue] = useState("");

  const editable = !!onUpdate;

  const handleStartEdit = (i: number) => {
    if (!editable) return;
    setEditingIndex(i);
    setEditValue(aliases[i]);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null || !onUpdate) return;
    const trimmed = editValue.trim();
    if (!trimmed) {
      // Empty = delete
      onUpdate(aliases.filter((_, i) => i !== editingIndex));
    } else {
      const updated = [...aliases];
      updated[editingIndex] = trimmed;
      onUpdate(updated);
    }
    setEditingIndex(null);
    setEditValue("");
  };

  const handleRemove = (i: number) => {
    if (!onUpdate) return;
    onUpdate(aliases.filter((_, idx) => idx !== i));
  };

  const handleAdd = () => {
    const trimmed = addValue.trim();
    if (!trimmed || !onUpdate) return;
    onUpdate([...aliases, trimmed]);
    setAddValue("");
    setAdding(false);
  };

  if ((!aliases || aliases.length === 0) && !editable) return null;

  return (
    <div className="edv-aliases">
      <div className="edv-aliases-label">
        Aliases
        {editable && !adding && (
          <button onClick={() => setAdding(true)} className="edv-aliases-add-btn">
            + Add
          </button>
        )}
      </div>
      <div className="edv-aliases-list">
        {aliases.map((alias, i) =>
          editingIndex === i ? (
            <span key={i} className="edv-aliases-edit-wrap">
              <input
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEdit();
                  if (e.key === "Escape") {
                    setEditingIndex(null);
                    setEditValue("");
                  }
                }}
                onBlur={handleSaveEdit}
                className="edv-aliases-edit-input"
                style={{ "--edv-input-width": `${Math.max(editValue.length, 4) * 7.5 + 20}px` } as React.CSSProperties}
              />
            </span>
          ) : (
            <span
              key={i}
              className={`edv-aliases-tag ${editable ? "edv-aliases-tag-editable" : ""}`}
              onClick={() => handleStartEdit(i)}
              title={editable ? "Click to edit" : undefined}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
            >
              {alias}
              {editable && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(i);
                  }}
                  className="edv-aliases-remove"
                  title="Remove alias"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
                >
                  ×
                </span>
              )}
            </span>
          )
        )}
        {adding && (
          <span className="edv-aliases-edit-wrap">
            <input
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              value={addValue}
              onChange={(e) => setAddValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") {
                  setAdding(false);
                  setAddValue("");
                }
              }}
              onBlur={() => {
                if (addValue.trim()) handleAdd();
                else setAdding(false);
              }}
              placeholder="New alias"
              className="edv-aliases-edit-input"
              style={{ "--edv-input-width": `${Math.max(addValue.length, 8) * 7.5 + 20}px` } as React.CSSProperties}
            />
          </span>
        )}
      </div>
      {aliases.length === 0 && !adding && editable && (
        <div className="edv-aliases-empty">No aliases</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EntityDetailView
// ---------------------------------------------------------------------------

export default function EntityDetailView({ entity, entities, onBack }: Readonly<EntityDetailViewProps>) {
  const prominenceScale = useProminenceScale();
  const queue = useEnrichmentQueueStore((s) => s.queue);
  const {
    handleUpdateBackrefs,
    handleUndoDescription,
    handleUpdateAliases,
    handleUpdateDescription,
    handleUpdateSummary,
    handleClearNotes,
    handleRestoreDescription,
  } = useEntityCrud();
  const {
    historianConfigured,
    isHistorianEditionActive,
    isHistorianActive,
    handleHistorianEdition,
    handleHistorianReview,
    handleUpdateHistorianNote,
    editionPreview,
    handleEditionPreviewProceed,
    handleEditionPreviewCancel,
  } = useHistorianActions();
  const { openRename, openPatchEvents } = useIlluminatorModals();

  const enrichment = entity.enrichment;
  const textEnrichment = enrichment?.text;

  // Inline editing state
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");

  const startEditSummary = useCallback(() => {
    setSummaryDraft(entity.summary || "");
    setEditingSummary(true);
  }, [entity.summary]);

  const saveSummary = useCallback(() => {
    const trimmed = summaryDraft.trim();
    if (trimmed && trimmed !== entity.summary) {
      void handleUpdateSummary(entity.id, trimmed);
    }
    setEditingSummary(false);
  }, [handleUpdateSummary, summaryDraft, entity.summary, entity.id]);

  const cancelSummary = useCallback(() => {
    setEditingSummary(false);
    setSummaryDraft("");
  }, []);

  const startEditDescription = useCallback(() => {
    setDescriptionDraft(entity.description || "");
    setEditingDescription(true);
  }, [entity.description]);

  const saveDescription = useCallback(() => {
    const trimmed = descriptionDraft.trim();
    if (trimmed && trimmed !== entity.description) {
      void handleUpdateDescription(entity.id, trimmed);
    }
    setEditingDescription(false);
  }, [handleUpdateDescription, descriptionDraft, entity.description, entity.id]);

  const cancelDescription = useCallback(() => {
    setEditingDescription(false);
    setDescriptionDraft("");
  }, []);

  // Chain debug (narrative -> thesis -> traits)
  const chainDebug: DescriptionChainDebug | undefined = textEnrichment?.chainDebug;

  // Legacy single debug
  let legacyDebug: NetworkDebugInfo | undefined = textEnrichment?.debug;
  if (!legacyDebug && !chainDebug) {
    const descriptionQueueItem = queue.find(
      (item) => item.entityId === entity.id && item.type === "description" && item.debug
    );
    legacyDebug = descriptionQueueItem?.debug;
  }

  // Escape key goes back (unless editing inline)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !editingSummary && !editingDescription) onBack();
    },
    [onBack, editingSummary, editingDescription]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Description history
  const historyLen = enrichment?.descriptionHistory?.length || 0;
  const lastEntry = historyLen > 0 ? enrichment.descriptionHistory[historyLen - 1] : null;

  return (
    <>
      <div className="edv">
        {/* Header bar */}
        <div className="edv-header">
          <button onClick={onBack} className="edv-back-btn">
            ← Back
          </button>
          <div className="edv-header-info">
            <div className="edv-entity-name">{entity.name}</div>
            <div className="edv-entity-meta">
              {entity.kind}/{entity.subtype} ·{" "}
              {prominenceLabelFromScale(entity.prominence, prominenceScale)}
              {entity.culture && ` · ${entity.culture}`}
            </div>
          </div>
          <div className="edv-esc-hint">Esc to go back</div>
        </div>

        {/* Two-column body */}
        <div className="edv-body">
          {/* Main content */}
          <div className="edv-main">
            {/* Summary */}
            {(entity.summary || handleUpdateSummary) && (
              <div className="edv-section">
                <div className="edv-section-label">
                  Summary
                  {handleUpdateSummary && !editingSummary && (
                    <button
                      onClick={startEditSummary}
                      title="Edit summary"
                      className="edv-inline-btn"
                    >
                      Edit
                    </button>
                  )}
                </div>
                {editingSummary ? (
                  <textarea
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    value={summaryDraft}
                    onChange={(e) => setSummaryDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        saveSummary();
                      }
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        cancelSummary();
                      }
                    }}
                    onBlur={saveSummary}
                    className="edv-summary-textarea"
                  />
                ) : (
                  <p className="edv-summary-text">
                    {entity.summary || <span className="edv-placeholder">No summary</span>}
                  </p>
                )}
              </div>
            )}

            {/* Visual Thesis */}
            {textEnrichment?.visualThesis && (
              <div className="edv-section">
                <div className="edv-section-label edv-section-label-visual-thesis">
                  Visual Thesis
                </div>
                <p className="edv-visual-thesis">{textEnrichment.visualThesis}</p>
              </div>
            )}

            {/* Full Description */}
            {(entity.description || handleUpdateDescription) && (
              <div className="edv-section">
                <div className="edv-section-label edv-section-label-wrap">
                  Full Description
                  {historyLen > 0 && (
                    <span className="edv-version-hint">
                      v{historyLen + 1} ({historyLen} previous)
                    </span>
                  )}
                  {historyLen > 0 && handleUndoDescription && (
                    <button
                      onClick={() => void handleUndoDescription(entity.id)}
                      title={`Revert to previous version (from ${lastEntry?.source || "unknown"}, ${lastEntry?.replacedAt ? new Date(lastEntry.replacedAt).toLocaleDateString() : "unknown"})`}
                      className="edv-inline-btn"
                    >
                      ↩ Undo
                    </button>
                  )}
                  {handleUpdateDescription && !editingDescription && (
                    <button
                      onClick={startEditDescription}
                      title="Edit description"
                      className="edv-inline-btn"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => openRename(entity.id)}
                    title="Rename this entity with full propagation across all references"
                    className="edv-inline-btn"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => openPatchEvents(entity.id)}
                    title="Repair stale names in narrative event history for this entity"
                    className="edv-inline-btn"
                  >
                    Patch Events
                  </button>
                </div>
                {historianConfigured && (
                  <>
                    <div className="edv-section-label">
                      Historian
                      <HistorianToneSelector
                        onSelect={(tone: string) => void handleHistorianEdition(entity.id, tone)}
                        disabled={isHistorianEditionActive}
                        label="Copy Edit"
                        hasNotes={false}
                      />
                      {enrichment?.descriptionHistory?.some(
                        (h: { source?: string }) => h.source === "historian-edition"
                      ) && (
                        <HistorianToneSelector
                          onSelect={(tone: string) => void handleHistorianEdition(entity.id, tone, true)}
                          disabled={isHistorianEditionActive}
                          label="Re-Edit"
                          hasNotes={false}
                        />
                      )}
                      <HistorianToneSelector
                        onSelect={(tone: string) => void handleHistorianReview(entity.id, tone)}
                        disabled={isHistorianActive}
                        label="Annotate"
                        hasNotes={
                          enrichment?.historianNotes && enrichment.historianNotes.length > 0
                        }
                      />
                      {handleClearNotes &&
                        enrichment?.historianNotes &&
                        enrichment.historianNotes.length > 0 && (
                          <button
                            onClick={() => void handleClearNotes(entity.id)}
                            title="Remove all annotations from this entity"
                            className="edv-inline-btn-ghost"
                          >
                            Clear Notes
                          </button>
                        )}
                    </div>
                    {enrichment?.descriptionHistory?.some(
                      (h: { source?: string }) =>
                        h.source === "historian-edition" || h.source === "legacy-copy-edit"
                    ) &&
                      entity.description && (
                        <HistorianEditionComparison
                          entityId={entity.id}
                          currentDescription={entity.description}
                          descriptionHistory={enrichment.descriptionHistory}
                          historianNotes={enrichment.historianNotes}
                          onRestoreVersion={(entityId, historyIndex) => void handleRestoreDescription(entityId, historyIndex)}
                        />
                      )}
                  </>
                )}
                {editingDescription ? (
                  <textarea
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    value={descriptionDraft}
                    onChange={(e) => setDescriptionDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        saveDescription();
                      }
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        cancelDescription();
                      }
                    }}
                    onBlur={saveDescription}
                    className="edv-desc-textarea"
                  />
                ) : (
                  <>
                    {entity.description ? (
                      <div className="edv-description entity-description-md">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h2: ({ children }) => <h2 className="edv-md-h2">{children}</h2>,
                            h3: ({ children }) => <h3 className="edv-md-h3">{children}</h3>,
                            p: ({ children }) => <p className="edv-md-p">{children}</p>,
                            ul: ({ children }) => <ul className="edv-md-ul">{children}</ul>,
                            ol: ({ children }) => <ol className="edv-md-ol">{children}</ol>,
                            li: ({ children }) => <li className="edv-md-li">{children}</li>,
                            table: ({ children }) => (
                              <table className="edv-md-table">{children}</table>
                            ),
                            th: ({ children }) => <th className="edv-md-th">{children}</th>,
                            td: ({ children }) => <td className="edv-md-td">{children}</td>,
                          }}
                        >
                          {entity.description}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="edv-no-desc">No description</p>
                    )}
                    {enrichment?.historianNotes && enrichment.historianNotes.length > 0 && (
                      <HistorianMarginNotes
                        notes={enrichment.historianNotes}
                        sourceText={entity.description}
                        className="edv-margin-notes-spaced"
                        onUpdateNote={(noteId: string, updates: Record<string, unknown>) =>
                          void handleUpdateHistorianNote("entity", entity.id, noteId, updates)
                        }
                      />
                    )}
                  </>
                )}
              </div>
            )}

            {/* Visual Traits */}
            <VisualTraitsList traits={textEnrichment?.visualTraits || []} />

            {/* Aliases */}
            <AliasesList
              aliases={textEnrichment?.aliases || []}
              onUpdate={(aliases) => void handleUpdateAliases(entity.id, aliases)}
            />

            {/* Chronicle Images */}
            {enrichment?.chronicleBackrefs && enrichment.chronicleBackrefs.length > 0 && (
              <>
                <div className="edv-separator" />
                <BackrefImageEditor
                  entity={entity}
                  entities={entities}
                  onUpdateBackrefs={(...args) => void handleUpdateBackrefs(...args)}
                  alwaysExpanded
                />
              </>
            )}

            {/* No enrichment fallback */}
            {!(entity.summary || entity.description) && (
              <div className="edv-no-enrichment">
                No description enrichment available. Queue a description task for this entity.
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="edv-sidebar">
            <h4 className="edv-sidebar-title">Entity Metadata</h4>

            {/* Basic info */}
            <MetadataRow label="Entity ID" value={entity.id} />
            <MetadataRow label="Status" value={entity.status} />
            <MetadataRow label="Created" value={formatDate(entity.createdAt)} />
            <MetadataRow label="Updated" value={formatDate(entity.updatedAt)} />

            {/* Description generation info */}
            {textEnrichment && (
              <>
                <div className="edv-sidebar-divider" />
                <div className="edv-sidebar-section-label">Description Generation</div>
                <MetadataRow label="Model" value={textEnrichment.model} />
                <MetadataRow label="Generated" value={formatDate(textEnrichment.generatedAt)} />
                <MetadataRow
                  label="Estimated Cost"
                  value={formatCost(textEnrichment.estimatedCost)}
                />
                <MetadataRow label="Actual Cost" value={formatCost(textEnrichment.actualCost)} />
                {textEnrichment.inputTokens !== undefined && (
                  <MetadataRow
                    label="Tokens"
                    value={`${textEnrichment.inputTokens} in / ${textEnrichment.outputTokens || 0} out`}
                  />
                )}
              </>
            )}

            {/* Debug Info */}
            {(chainDebug || legacyDebug) && (
              <>
                <div className="edv-sidebar-divider" />
                <div className="edv-sidebar-section-label">Debug Info</div>

                {chainDebug && (
                  <>
                    {chainDebug.narrative && (
                      <div className="edv-debug-step">
                        <div className="edv-debug-step-label edv-debug-step-label-narrative">
                          Step 1: Narrative
                        </div>
                        <ExpandableSection
                          title="Request"
                          content={chainDebug.narrative.request}
                          charCount={chainDebug.narrative.request?.length}
                        />
                        <ExpandableSection
                          title="Response"
                          content={chainDebug.narrative.response}
                          charCount={chainDebug.narrative.response?.length}
                        />
                      </div>
                    )}
                    {chainDebug.thesis && (
                      <div className="edv-debug-step">
                        <div className="edv-debug-step-label edv-debug-step-label-thesis">
                          Step 2: Visual Thesis
                        </div>
                        <ExpandableSection
                          title="Request"
                          content={chainDebug.thesis.request}
                          charCount={chainDebug.thesis.request?.length}
                        />
                        <ExpandableSection
                          title="Response"
                          content={chainDebug.thesis.response}
                          charCount={chainDebug.thesis.response?.length}
                        />
                      </div>
                    )}
                    {chainDebug.traits && (
                      <div className="edv-debug-step">
                        <div className="edv-debug-step-label edv-debug-step-label-traits">
                          Step 3: Visual Traits
                        </div>
                        <ExpandableSection
                          title="Request"
                          content={chainDebug.traits.request}
                          charCount={chainDebug.traits.request?.length}
                        />
                        <ExpandableSection
                          title="Response"
                          content={chainDebug.traits.response}
                          charCount={chainDebug.traits.response?.length}
                        />
                      </div>
                    )}
                  </>
                )}

                {!chainDebug && legacyDebug && (
                  <>
                    <ExpandableSection
                      title="Request"
                      content={legacyDebug.request}
                      charCount={legacyDebug.request?.length}
                    />
                    <ExpandableSection
                      title="Response"
                      content={legacyDebug.response}
                      charCount={legacyDebug.response?.length}
                    />
                  </>
                )}
              </>
            )}

            {!chainDebug && !legacyDebug && textEnrichment && (
              <div className="edv-no-debug">
                Debug info not available. This entity may have been enriched before debug
                persistence was added.
              </div>
            )}
          </div>
        </div>
      </div>

      {editionPreview && (
        <HistoryCompressionPreviewModal
          entityName={editionPreview.entityName}
          originalCount={editionPreview.originalCount}
          compressed={editionPreview.compressed}
          onProceed={handleEditionPreviewProceed}
          onCancel={handleEditionPreviewCancel}
        />
      )}
    </>
  );
}
