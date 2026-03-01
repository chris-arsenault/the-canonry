/**
 * EntityDetailView - Inline entity detail panel (replaces EntityDetailsModal lightbox)
 *
 * Two-column layout: main content (left) + metadata sidebar (right).
 * Rendered inside EntityBrowser, replacing the entity list when an entity is selected.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { useExpandBoolean } from "@canonry/shared-components";
import HistoryCompressionPreviewModal from "./HistoryCompressionPreviewModal";
import BackrefImageEditor from "./BackrefImageEditor";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import EntityDetailSidebar from "./EntityDetailSidebar";
import "./EntityDetailView.css";

// ─── Types ───────────────────────────────────────────────────────────────

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

export interface Entity {
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

// ─── Sub-components ──────────────────────────────────────────────────────

function VisualTraitsList({ traits }: Readonly<{ traits: string[] }>) {
  if (!traits || traits.length === 0) return null;
  return (
    <div className="edv-traits">
      <div className="ilu-hint-sm edv-traits-label">Visual Traits</div>
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

function AliasEditInput({
  value,
  onChange,
  onSave,
  onCancel,
  placeholder,
}: Readonly<{
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  placeholder?: string;
}>) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") onSave();
      if (e.key === "Escape") onCancel();
    },
    [onSave, onCancel]
  );

  const handleBlur = useCallback(() => {
    if (value.trim()) onSave();
    else onCancel();
  }, [value, onSave, onCancel]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    [onChange]
  );

  return (
    <span className="edv-aliases-edit-wrap">
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="edv-aliases-edit-input edv-aliases-edit-input-dynamic"
      />
    </span>
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

  const handleSaveEdit = useCallback(() => {
    if (editingIndex === null || !onUpdate) return;
    const trimmed = editValue.trim();
    if (!trimmed) {
      onUpdate(aliases.filter((_, i) => i !== editingIndex));
    } else {
      const updated = [...aliases];
      updated[editingIndex] = trimmed;
      onUpdate(updated);
    }
    setEditingIndex(null);
    setEditValue("");
  }, [editingIndex, editValue, aliases, onUpdate]);

  const handleCancelEdit = useCallback(() => {
    setEditingIndex(null);
    setEditValue("");
  }, []);

  const handleAdd = useCallback(() => {
    const trimmed = addValue.trim();
    if (!trimmed || !onUpdate) return;
    onUpdate([...aliases, trimmed]);
    setAddValue("");
    setAdding(false);
  }, [addValue, aliases, onUpdate]);

  const handleCancelAdd = useCallback(() => {
    setAdding(false);
    setAddValue("");
  }, []);

  const handleStartAdding = useCallback(() => setAdding(true), []);

  if ((!aliases || aliases.length === 0) && !editable) return null;

  return (
    <div className="edv-aliases">
      <div className="ilu-hint-sm edv-aliases-label">
        Aliases
        {editable && !adding && (
          <button onClick={handleStartAdding} className="edv-aliases-add-btn">
            + Add
          </button>
        )}
      </div>
      <div className="edv-aliases-list">
        {aliases.map((alias, i) =>
          editingIndex === i ? (
            <AliasEditInput
              key={i}
              value={editValue}
              onChange={setEditValue}
              onSave={handleSaveEdit}
              onCancel={handleCancelEdit}
            />
          ) : (
            <AliasTag
              key={i}
              alias={alias}
              index={i}
              editable={editable}
              onStartEdit={(idx) => {
                setEditingIndex(idx);
                setEditValue(aliases[idx]);
              }}
              onRemove={onUpdate ? (idx) => onUpdate(aliases.filter((_, j) => j !== idx)) : undefined}
            />
          )
        )}
        {adding && (
          <AliasEditInput
            value={addValue}
            onChange={setAddValue}
            onSave={handleAdd}
            onCancel={handleCancelAdd}
            placeholder="New alias"
          />
        )}
      </div>
      {aliases.length === 0 && !adding && editable && (
        <div className="ilu-hint edv-aliases-empty">No aliases</div>
      )}
    </div>
  );
}

function AliasTag({
  alias,
  index,
  editable,
  onStartEdit,
  onRemove,
}: Readonly<{
  alias: string;
  index: number;
  editable: boolean;
  onStartEdit: (i: number) => void;
  onRemove?: (i: number) => void;
}>) {
  const handleClick = useCallback(() => {
    if (editable) onStartEdit(index);
  }, [editable, onStartEdit, index]);

  const handleRemoveClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove?.(index);
    },
    [onRemove, index]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
    },
    []
  );

  return (
    <span
      className={`edv-aliases-tag ${editable ? "edv-aliases-tag-editable" : ""}`}
      onClick={handleClick}
      title={editable ? "Click to edit" : undefined}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {alias}
      {editable && onRemove && (
        <span
          onClick={handleRemoveClick}
          className="edv-aliases-remove"
          title="Remove alias"
          role="button"
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          x
        </span>
      )}
    </span>
  );
}

// ─── Markdown components (stable reference) ──────────────────────────────

const markdownComponents = {
  h2: ({ children }: { children: React.ReactNode }) => <h2 className="edv-md-h2">{children}</h2>,
  h3: ({ children }: { children: React.ReactNode }) => <h3 className="edv-md-h3">{children}</h3>,
  p: ({ children }: { children: React.ReactNode }) => <p className="edv-md-p">{children}</p>,
  ul: ({ children }: { children: React.ReactNode }) => <ul className="edv-md-ul">{children}</ul>,
  ol: ({ children }: { children: React.ReactNode }) => <ol className="edv-md-ol">{children}</ol>,
  li: ({ children }: { children: React.ReactNode }) => <li className="edv-md-li">{children}</li>,
  table: ({ children }: { children: React.ReactNode }) => (
    <table className="edv-md-table">{children}</table>
  ),
  th: ({ children }: { children: React.ReactNode }) => <th className="edv-md-th">{children}</th>,
  td: ({ children }: { children: React.ReactNode }) => <td className="edv-md-td">{children}</td>,
};

const remarkPlugins = [remarkGfm];

// ─── Main component ──────────────────────────────────────────────────────

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
  const legacyDebug: NetworkDebugInfo | undefined = useMemo(() => {
    if (textEnrichment?.debug) return textEnrichment.debug;
    if (chainDebug) return undefined;
    const descriptionQueueItem = queue.find(
      (item) => item.entityId === entity.id && item.type === "description" && item.debug
    );
    return descriptionQueueItem?.debug;
  }, [textEnrichment?.debug, chainDebug, queue, entity.id]);

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
  const lastEntry = historyLen > 0 ? enrichment?.descriptionHistory?.[historyLen - 1] ?? null : null;

  // Stable callbacks for historian actions
  const handleHistorianEditionCb = useCallback(
    (tone: string) => void handleHistorianEdition(entity.id, tone),
    [handleHistorianEdition, entity.id]
  );
  const handleHistorianReEditCb = useCallback(
    (tone: string) => void handleHistorianEdition(entity.id, tone, true),
    [handleHistorianEdition, entity.id]
  );
  const handleHistorianReviewCb = useCallback(
    (tone: string) => void handleHistorianReview(entity.id, tone),
    [handleHistorianReview, entity.id]
  );
  const handleClearNotesCb = useCallback(
    () => void handleClearNotes(entity.id),
    [handleClearNotes, entity.id]
  );

  const handleRestoreVersionCb = useCallback(
    (entityId: string, historyIndex: number) => void handleRestoreDescription(entityId, historyIndex),
    [handleRestoreDescription]
  );

  const handleUpdateNotesCb = useCallback(
    (noteId: string, updates: Record<string, unknown>) =>
      void handleUpdateHistorianNote("entity", entity.id, noteId, updates),
    [handleUpdateHistorianNote, entity.id]
  );

  const handleUndoDescriptionCb = useCallback(
    () => void handleUndoDescription(entity.id),
    [handleUndoDescription, entity.id]
  );
  const handleOpenRenameCb = useCallback(
    () => openRename(entity.id),
    [openRename, entity.id]
  );
  const handleOpenPatchEventsCb = useCallback(
    () => openPatchEvents(entity.id),
    [openPatchEvents, entity.id]
  );

  const handleSummaryDraftChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setSummaryDraft(e.target.value),
    []
  );
  const handleSummaryKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveSummary();
      }
      if (e.key === "Escape") {
        e.stopPropagation();
        cancelSummary();
      }
    },
    [saveSummary, cancelSummary]
  );
  const handleDescDraftChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setDescriptionDraft(e.target.value),
    []
  );
  const handleDescKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveDescription();
      }
      if (e.key === "Escape") {
        e.stopPropagation();
        cancelDescription();
      }
    },
    [saveDescription, cancelDescription]
  );

  const handleUpdateAliasesCb = useCallback(
    (aliases: string[]) => void handleUpdateAliases(entity.id, aliases),
    [handleUpdateAliases, entity.id]
  );

  const handleUpdateBackrefsCb = useCallback(
    (entityId: string, updatedBackrefs: Parameters<typeof handleUpdateBackrefs>[1]) =>
      void handleUpdateBackrefs(entityId, updatedBackrefs),
    [handleUpdateBackrefs]
  );

  const visualTraits = textEnrichment?.visualTraits || emptyStringArray;
  const aliases = textEnrichment?.aliases || emptyStringArray;

  const hasEdition = enrichment?.descriptionHistory?.some(
    (h: { source?: string }) => h.source === "historian-edition"
  );
  const hasEditionOrLegacy = enrichment?.descriptionHistory?.some(
    (h: { source?: string }) =>
      h.source === "historian-edition" || h.source === "legacy-copy-edit"
  );
  const hasNotes = enrichment?.historianNotes != null && enrichment.historianNotes.length > 0;

  return (
    <>
      <div className="edv">
        {/* Header bar */}
        <div className="edv-header">
          <button onClick={onBack} className="edv-back-btn">
            &larr; Back
          </button>
          <div className="edv-header-info">
            <div className="edv-entity-name">{entity.name}</div>
            <div className="edv-entity-meta">
              {entity.kind}/{entity.subtype} &middot;{" "}
              {prominenceLabelFromScale(entity.prominence, prominenceScale)}
              {entity.culture && ` \u00b7 ${entity.culture}`}
            </div>
          </div>
          <div className="ilu-hint-sm edv-esc-hint">Esc to go back</div>
        </div>

        {/* Two-column body */}
        <div className="edv-body">
          {/* Main content */}
          <div className="edv-main">
            {/* Summary */}
            {(entity.summary || handleUpdateSummary) && (
              <div className="edv-section-block">
                <div className="ilu-hint-sm edv-section-label">
                  Summary
                  {handleUpdateSummary && !editingSummary && (
                    <button onClick={startEditSummary} title="Edit summary" className="edv-inline-btn">
                      Edit
                    </button>
                  )}
                </div>
                {editingSummary ? (
                  <textarea
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    value={summaryDraft}
                    onChange={handleSummaryDraftChange}
                    onKeyDown={handleSummaryKeyDown}
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
              <div className="edv-section-block">
                <div className="ilu-hint-sm edv-section-label edv-section-label-visual-thesis">
                  Visual Thesis
                </div>
                <p className="edv-visual-thesis">{textEnrichment.visualThesis}</p>
              </div>
            )}

            {/* Full Description */}
            {(entity.description || handleUpdateDescription) && (
              <div className="edv-section-block">
                <div className="ilu-hint-sm edv-section-label edv-section-label-wrap">
                  Full Description
                  {historyLen > 0 && (
                    <span className="edv-version-hint">
                      v{historyLen + 1} ({historyLen} previous)
                    </span>
                  )}
                  {historyLen > 0 && handleUndoDescription && (
                    <button
                      onClick={handleUndoDescriptionCb}
                      title={`Revert to previous version (from ${lastEntry?.source || "unknown"}, ${lastEntry?.replacedAt ? new Date(lastEntry.replacedAt).toLocaleDateString() : "unknown"})`}
                      className="edv-inline-btn"
                    >
                      &larr; Undo
                    </button>
                  )}
                  {handleUpdateDescription && !editingDescription && (
                    <button onClick={startEditDescription} title="Edit description" className="edv-inline-btn">
                      Edit
                    </button>
                  )}
                  <button
                    onClick={handleOpenRenameCb}
                    title="Rename this entity with full propagation across all references"
                    className="edv-inline-btn"
                  >
                    Rename
                  </button>
                  <button
                    onClick={handleOpenPatchEventsCb}
                    title="Repair stale names in narrative event history for this entity"
                    className="edv-inline-btn"
                  >
                    Patch Events
                  </button>
                </div>
                {historianConfigured && (
                  <>
                    <div className="ilu-hint-sm edv-section-label">
                      Historian
                      <HistorianToneSelector
                        onSelect={handleHistorianEditionCb}
                        disabled={isHistorianEditionActive}
                        label="Copy Edit"
                        hasNotes={false}
                      />
                      {hasEdition && (
                        <HistorianToneSelector
                          onSelect={handleHistorianReEditCb}
                          disabled={isHistorianEditionActive}
                          label="Re-Edit"
                          hasNotes={false}
                        />
                      )}
                      <HistorianToneSelector
                        onSelect={handleHistorianReviewCb}
                        disabled={isHistorianActive}
                        label="Annotate"
                        hasNotes={hasNotes}
                      />
                      {handleClearNotes && hasNotes && (
                        <button
                          onClick={handleClearNotesCb}
                          title="Remove all annotations from this entity"
                          className="edv-inline-btn-ghost"
                        >
                          Clear Notes
                        </button>
                      )}
                    </div>
                    {hasEditionOrLegacy && entity.description && (
                      <HistorianEditionComparison
                        entityId={entity.id}
                        currentDescription={entity.description}
                        descriptionHistory={enrichment?.descriptionHistory}
                        historianNotes={enrichment?.historianNotes}
                        onRestoreVersion={handleRestoreVersionCb}
                      />
                    )}
                  </>
                )}
                {editingDescription ? (
                  <textarea
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    value={descriptionDraft}
                    onChange={handleDescDraftChange}
                    onKeyDown={handleDescKeyDown}
                    onBlur={saveDescription}
                    className="edv-desc-textarea"
                  />
                ) : (
                  <>
                    {entity.description ? (
                      <div className="edv-description entity-description-md">
                        <ReactMarkdown
                          remarkPlugins={remarkPlugins}
                          components={markdownComponents}
                        >
                          {entity.description}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="edv-no-desc">No description</p>
                    )}
                    {hasNotes && (
                      <HistorianMarginNotes
                        notes={enrichment?.historianNotes}
                        sourceText={entity.description}
                        className="edv-margin-notes-spaced"
                        onUpdateNote={handleUpdateNotesCb}
                      />
                    )}
                  </>
                )}
              </div>
            )}

            {/* Visual Traits */}
            <VisualTraitsList traits={visualTraits} />

            {/* Aliases */}
            <AliasesList
              aliases={aliases}
              onUpdate={handleUpdateAliasesCb}
            />

            {/* Chronicle Images */}
            {enrichment?.chronicleBackrefs && enrichment.chronicleBackrefs.length > 0 && (
              <>
                <div className="edv-separator" />
                <BackrefImageEditor
                  entity={entity}
                  entities={entities}
                  onUpdateBackrefs={handleUpdateBackrefsCb}
                  alwaysExpanded
                />
              </>
            )}

            {/* No enrichment fallback */}
            {!(entity.summary || entity.description) && (
              <div className="ilu-empty edv-no-enrichment">
                No description enrichment available. Queue a description task for this entity.
              </div>
            )}
          </div>

          {/* Sidebar */}
          <EntityDetailSidebar
            entity={entity}
            textEnrichment={textEnrichment}
            chainDebug={chainDebug}
            legacyDebug={legacyDebug}
          />
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

const emptyStringArray: string[] = [];
