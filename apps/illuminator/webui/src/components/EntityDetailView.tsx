/**
 * EntityDetailView - Inline entity detail panel (replaces EntityDetailsModal lightbox)
 *
 * Two-column layout: main content (left) + metadata sidebar (right).
 * Rendered inside EntityBrowser, replacing the entity list when an entity is selected.
 */

import { useState, useEffect, useCallback } from "react";
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

function MetadataRow({ label, value }: { label: string; value: string | undefined | null }) {
  if (!value) return null;
  return (
    <div className="edv-meta-row">
      <div className="edv-meta-row__label">
        {label}
      </div>
      <div className="edv-meta-row__value">
        {value}
      </div>
    </div>
  );
}

function ExpandableSection({
  title,
  content,
  charCount,
}: {
  title: string;
  content: string | undefined;
  charCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!content) return null;

  return (
    <div className="edv-expandable">
      <button
        onClick={() => setExpanded(!expanded)}
        className="edv-expandable__toggle"
      >
        <span className={`edv-expandable__arrow ${expanded ? "edv-expandable__arrow--open" : ""}`}>
          ▶
        </span>
        <span className="edv-expandable__title">{title}</span>
        {charCount !== undefined && (
          <span className="edv-expandable__chars">{charCount} chars</span>
        )}
      </button>
      {expanded && (
        <div className="edv-expandable__content">
          {content}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main content sub-components
// ---------------------------------------------------------------------------

function VisualTraitsList({ traits }: { traits: string[] }) {
  if (!traits || traits.length === 0) return null;
  return (
    <div className="edv-traits">
      <div className="edv-traits__label">
        Visual Traits
      </div>
      <div className="edv-traits__list">
        {traits.map((trait, i) => (
          <span key={i} className="edv-traits__tag">
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
}: {
  aliases: string[];
  onUpdate?: (aliases: string[]) => void;
}) {
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
      <div className="edv-aliases__label">
        Aliases
        {editable && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="edv-aliases__add-btn"
          >
            + Add
          </button>
        )}
      </div>
      <div className="edv-aliases__list">
        {aliases.map((alias, i) =>
          editingIndex === i ? (
            <span key={i} className="edv-aliases__edit-wrap">
              <input
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
                className="edv-aliases__edit-input"
                // eslint-disable-next-line local/no-inline-styles
                style={{ width: `${Math.max(editValue.length, 4) * 7.5 + 20}px` }}
              />
            </span>
          ) : (
            <span
              key={i}
              className={`edv-aliases__tag ${editable ? "edv-aliases__tag--editable" : ""}`}
              onClick={() => handleStartEdit(i)}
              title={editable ? "Click to edit" : undefined}
            >
              {alias}
              {editable && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(i);
                  }}
                  className="edv-aliases__remove"
                  title="Remove alias"
                >
                  ×
                </span>
              )}
            </span>
          )
        )}
        {adding && (
          <span className="edv-aliases__edit-wrap">
            <input
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
              className="edv-aliases__edit-input"
              // eslint-disable-next-line local/no-inline-styles
              style={{ width: `${Math.max(addValue.length, 8) * 7.5 + 20}px` }}
            />
          </span>
        )}
      </div>
      {aliases.length === 0 && !adding && editable && (
        <div className="edv-aliases__empty">
          No aliases
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EntityDetailView
// ---------------------------------------------------------------------------

export default function EntityDetailView({ entity, entities, onBack }: EntityDetailViewProps) {
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
      handleUpdateSummary(entity.id, trimmed);
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
      handleUpdateDescription(entity.id, trimmed);
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
  const lastEntry = historyLen > 0 ? enrichment!.descriptionHistory![historyLen - 1] : null;

  return (
    <>
      <div className="edv">
        {/* Header bar */}
        <div className="edv__header">
          <button onClick={onBack} className="edv__back-btn">
            ← Back
          </button>
          <div className="edv__header-info">
            <div className="edv__entity-name">
              {entity.name}
            </div>
            <div className="edv__entity-meta">
              {entity.kind}/{entity.subtype} ·{" "}
              {prominenceLabelFromScale(entity.prominence, prominenceScale)}
              {entity.culture && ` · ${entity.culture}`}
            </div>
          </div>
          <div className="edv__esc-hint">Esc to go back</div>
        </div>

        {/* Two-column body */}
        <div className="edv__body">
          {/* Main content */}
          <div className="edv__main">
            {/* Summary */}
            {(entity.summary || handleUpdateSummary) && (
              <div className="edv__section">
                <div className="edv__section-label">
                  Summary
                  {handleUpdateSummary && !editingSummary && (
                    <button
                      onClick={startEditSummary}
                      title="Edit summary"
                      className="edv__inline-btn"
                    >
                      Edit
                    </button>
                  )}
                </div>
                {editingSummary ? (
                  <textarea
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
                    className="edv__summary-textarea"
                  />
                ) : (
                  <p className="edv__summary-text">
                    {entity.summary || (
                      <span className="edv__placeholder">
                        No summary
                      </span>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Visual Thesis */}
            {textEnrichment?.visualThesis && (
              <div className="edv__section">
                <div className="edv__section-label edv__section-label--visual-thesis">
                  Visual Thesis
                </div>
                <p className="edv__visual-thesis">
                  {textEnrichment.visualThesis}
                </p>
              </div>
            )}

            {/* Full Description */}
            {(entity.description || handleUpdateDescription) && (
              <div className="edv__section">
                <div className="edv__section-label edv__section-label--wrap">
                  Full Description
                  {historyLen > 0 && (
                    <span className="edv__version-hint">
                      v{historyLen + 1} ({historyLen} previous)
                    </span>
                  )}
                  {historyLen > 0 && handleUndoDescription && (
                    <button
                      onClick={() => handleUndoDescription(entity.id)}
                      title={`Revert to previous version (from ${lastEntry?.source || "unknown"}, ${lastEntry?.replacedAt ? new Date(lastEntry.replacedAt).toLocaleDateString() : "unknown"})`}
                      className="edv__inline-btn"
                    >
                      ↩ Undo
                    </button>
                  )}
                  {handleUpdateDescription && !editingDescription && (
                    <button
                      onClick={startEditDescription}
                      title="Edit description"
                      className="edv__inline-btn"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => openRename(entity.id)}
                    title="Rename this entity with full propagation across all references"
                    className="edv__inline-btn"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => openPatchEvents(entity.id)}
                    title="Repair stale names in narrative event history for this entity"
                    className="edv__inline-btn"
                  >
                    Patch Events
                  </button>
                </div>
                {historianConfigured && (
                  <>
                    <div className="edv__section-label">
                      Historian
                      <HistorianToneSelector
                        onSelect={(tone: string) => handleHistorianEdition(entity.id, tone)}
                        disabled={isHistorianEditionActive}
                        label="Copy Edit"
                        hasNotes={false}
                        // eslint-disable-next-line local/no-inline-styles
                        style={{ display: "inline-block" }}
                      />
                      {enrichment?.descriptionHistory?.some(
                        (h: { source?: string }) => h.source === "historian-edition"
                      ) && (
                        <HistorianToneSelector
                          onSelect={(tone: string) => handleHistorianEdition(entity.id, tone, true)}
                          disabled={isHistorianEditionActive}
                          label="Re-Edit"
                          hasNotes={false}
                          // eslint-disable-next-line local/no-inline-styles
                          style={{ display: "inline-block" }}
                        />
                      )}
                      <HistorianToneSelector
                        onSelect={(tone: string) => handleHistorianReview(entity.id, tone)}
                        disabled={isHistorianActive}
                        label="Annotate"
                        hasNotes={
                          enrichment?.historianNotes && enrichment.historianNotes.length > 0
                        }
                        // eslint-disable-next-line local/no-inline-styles
                        style={{ display: "inline-block" }}
                      />
                      {handleClearNotes &&
                        enrichment?.historianNotes &&
                        enrichment.historianNotes.length > 0 && (
                          <button
                            onClick={() => handleClearNotes(entity.id)}
                            title="Remove all annotations from this entity"
                            className="edv__inline-btn--ghost"
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
                          onRestoreVersion={handleRestoreDescription}
                        />
                      )}
                  </>
                )}
                {editingDescription ? (
                  <textarea
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
                    className="edv__desc-textarea"
                  />
                ) : (
                  <>
                    {entity.description ? (
                      <div className="edv__description entity-description-md">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h2: ({ children }) => (
                              <h2 className="edv__md-h2">{children}</h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="edv__md-h3">{children}</h3>
                            ),
                            p: ({ children }) => <p className="edv__md-p">{children}</p>,
                            ul: ({ children }) => (
                              <ul className="edv__md-ul">{children}</ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="edv__md-ol">{children}</ol>
                            ),
                            li: ({ children }) => (
                              <li className="edv__md-li">{children}</li>
                            ),
                            table: ({ children }) => (
                              <table className="edv__md-table">{children}</table>
                            ),
                            th: ({ children }) => (
                              <th className="edv__md-th">{children}</th>
                            ),
                            td: ({ children }) => (
                              <td className="edv__md-td">{children}</td>
                            ),
                          }}
                        >
                          {entity.description}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="edv__no-desc">
                        No description
                      </p>
                    )}
                    {enrichment?.historianNotes && enrichment.historianNotes.length > 0 && (
                      <HistorianMarginNotes
                        notes={enrichment.historianNotes}
                        sourceText={entity.description}
                        // eslint-disable-next-line local/no-inline-styles
                        style={{ marginTop: "12px" }}
                        onUpdateNote={(noteId: string, updates: Record<string, unknown>) =>
                          handleUpdateHistorianNote("entity", entity.id, noteId, updates)
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
              onUpdate={(aliases) => handleUpdateAliases(entity.id, aliases)}
            />

            {/* Chronicle Images */}
            {enrichment?.chronicleBackrefs && enrichment.chronicleBackrefs.length > 0 && (
              <>
                <div className="edv__separator" />
                <BackrefImageEditor
                  entity={entity}
                  entities={entities}
                  onUpdateBackrefs={handleUpdateBackrefs}
                  alwaysExpanded
                />
              </>
            )}

            {/* No enrichment fallback */}
            {!(entity.summary || entity.description) && (
              <div className="edv__no-enrichment">
                No description enrichment available. Queue a description task for this entity.
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="edv__sidebar">
            <h4 className="edv__sidebar-title">
              Entity Metadata
            </h4>

            {/* Basic info */}
            <MetadataRow label="Entity ID" value={entity.id} />
            <MetadataRow label="Status" value={entity.status} />
            <MetadataRow label="Created" value={formatDate(entity.createdAt)} />
            <MetadataRow label="Updated" value={formatDate(entity.updatedAt)} />

            {/* Description generation info */}
            {textEnrichment && (
              <>
                <div className="edv__sidebar-divider" />
                <div className="edv__sidebar-section-label">
                  Description Generation
                </div>
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
                <div className="edv__sidebar-divider" />
                <div className="edv__sidebar-section-label">
                  Debug Info
                </div>

                {chainDebug && (
                  <>
                    {chainDebug.narrative && (
                      <div className="edv__debug-step">
                        <div className="edv__debug-step-label edv__debug-step-label--narrative">
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
                      <div className="edv__debug-step">
                        <div className="edv__debug-step-label edv__debug-step-label--thesis">
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
                      <div className="edv__debug-step">
                        <div className="edv__debug-step-label edv__debug-step-label--traits">
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
              <div className="edv__no-debug">
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
