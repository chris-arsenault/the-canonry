/**
 * EraNarrativeViewer — Workspace viewer for a completed era narrative.
 *
 * Loads the full EraNarrativeRecord from IndexedDB and displays:
 * 1. Header: title, era name, tone, word count, cost
 * 2. Version selector: switch between generate/edit versions, delete, set active
 * 3. Narrative prose (primary content, dominates the view)
 * 4. Cover Image (shared CoverImageControls component with full generation pipeline)
 * 5. Image Refs (shared ChronicleImagePanel for prompt_request refs, read-only for chronicle_ref)
 * 6. Thread Synthesis (collapsible): thesis, threads, movements, motifs, images
 * 7. Source Briefs (collapsible): per-chronicle prep inputs
 * 8. Cost/model metadata footer
 * 9. Actions: re-run copy edit, export
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  getEraNarrative,
  updateEraNarrative,
  updateEraNarrativeCoverImageStatus,
  updateEraNarrativeImageRefStatus,
  updateEraNarrativeImageRefField,
  resolveActiveContent,
  deleteEraNarrativeVersion,
  setEraNarrativeActiveVersion,
} from "../lib/db/eraNarrativeRepository";
import { useChronicleStore } from "../lib/db/chronicleStore";
import { downloadEraNarrativeExport } from "../lib/chronicleExport";
import { buildChronicleScenePrompt } from "../lib/promptBuilders";
import { resolveStyleSelection } from "./StyleSelector";
import { CoverImageControls } from "./CoverImageControls";
import ChronicleImagePanel from "./ChronicleImagePanel";
import { useImageUrl } from "@the-canonry/image-store";
import type {
  EraNarrativeRecord,
  EraNarrativeThreadSynthesis,
  EraNarrativePrepBrief,
  ChronicleImageRef as NarrativeChronicleRef,
  EraNarrativeContentVersion,
} from "../lib/eraNarrativeTypes";
import type { ChronicleImageRefs, PromptRequestRef } from "../lib/chronicleTypes";
import type { EnrichmentType } from "../lib/enrichmentTypes";
import type { AvailableChronicleImage } from "../workers/tasks/eraNarrativeTask";
import type { StyleInfo } from "../lib/promptBuilders";
import type { ImageGenSettings } from "../hooks/useImageGenSettings";
import "./EraNarrativeViewer.css";

// ---------------------------------------------------------------------------
// Shared type definitions
// ---------------------------------------------------------------------------

interface EnqueueEntity {
  id: string;
  name: string;
  kind: string;
  subtype?: string;
  prominence?: string;
  culture?: string;
  status?: string;
  description?: string;
  tags?: Record<string, unknown>;
}

interface EnqueueItem {
  entity: EnqueueEntity;
  type: EnrichmentType;
  prompt: string;
  chronicleId?: string;
  [key: string]: unknown;
}

interface StyleSelectionInput {
  artisticStyleId?: string;
  compositionStyleId?: string;
  colorPaletteId?: string;
}

interface StyleLibraryInput {
  artisticStyles: Array<{
    id: string;
    name: string;
    description?: string;
    promptFragment?: string;
  }>;
  compositionStyles: Array<{
    id: string;
    name: string;
    description?: string;
    promptFragment?: string;
    suitableForKinds?: string[];
  }>;
  colorPalettes: Array<{
    id: string;
    name: string;
    description?: string;
    promptFragment?: string;
  }>;
}

interface CultureInput {
  id: string;
  name: string;
  styleKeywords?: string[];
}

interface CultureIdentitiesInput {
  visual?: Record<string, Record<string, string>>;
  descriptive?: Record<string, Record<string, string>>;
  visualKeysByKind?: Record<string, string[]>;
  descriptiveKeysByKind?: Record<string, string[]>;
}

interface WorldContextInput {
  name?: string;
  description?: string;
  toneFragments?: { core: string };
  speciesConstraint?: string;
}

interface EraNarrativeViewerProps {
  narrativeId: string;
  onEnqueue: (items: EnqueueItem[]) => void;
  styleLibrary?: StyleLibraryInput;
  styleSelection?: StyleSelectionInput;
  imageSize?: string;
  imageQuality?: string;
  imageModel?: string;
  imageGenSettings?: ImageGenSettings;
  onOpenImageSettings?: () => void;
  cultures?: CultureInput[];
  cultureIdentities?: CultureIdentitiesInput;
  worldContext?: WorldContextInput;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 2000;
const DEFAULT_STYLE_SELECTION: StyleSelectionInput = {
  artisticStyleId: "random",
  compositionStyleId: "random",
  colorPaletteId: "random",
};

const SENTINEL_ENTITY: EnqueueEntity = {
  id: "__era_narrative__",
  name: "Era Narrative",
  kind: "system",
  subtype: "",
  prominence: "",
  culture: "",
  status: "active",
  description: "",
  tags: {},
};

// ---------------------------------------------------------------------------
// Sub-component: ChronicleRefThumbnail
// ---------------------------------------------------------------------------

function ChronicleRefThumbnail({ imageId }: Readonly<{ imageId: string }>) {
  const { url, loading } = useImageUrl(imageId);
  if (loading) return <span className="ilu-hint-sm era-narrative-ref-thumb-loading">...</span>;
  if (!url) return <span className="era-narrative-ref-thumb-empty">&mdash;</span>;
  return (
    <img src={url} alt="Chronicle" loading="lazy" className="era-narrative-ref-thumb-img" />
  );
}

// ---------------------------------------------------------------------------
// Sub-component: ThreadSynthesisSection
// ---------------------------------------------------------------------------

interface ThreadSynthesisSectionProps {
  synthesis: EraNarrativeThreadSynthesis;
  threadNameMap: Record<string, string>;
}

function ThreadSynthesisSection({
  synthesis,
  threadNameMap,
}: Readonly<ThreadSynthesisSectionProps>) {
  const [showThreads, setShowThreads] = useState(false);

  const handleToggle = useCallback(() => setShowThreads((prev) => !prev), []);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") (e.currentTarget as HTMLElement).click();
    },
    []
  );

  return (
    <div className="era-narrative-collapsible">
      <div
        onClick={handleToggle}
        className={`era-narrative-collapsible-header ${showThreads ? "era-narrative-collapsible-header-open" : ""}`}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <span className="era-narrative-collapsible-title">
          Thread Synthesis ({synthesis.threads.length} threads
          {synthesis.movements?.length ? `, ${synthesis.movements.length} movements` : ""})
        </span>
        <span className="ilu-hint-sm era-narrative-collapsible-chevron">
          {showThreads ? "\u25B4" : "\u25BE"}
        </span>
      </div>

      {showThreads && (
        <div className="era-narrative-synthesis">
          {/* Thesis */}
          <div>
            <div className="ilu-hint-sm era-narrative-section-heading">Thesis</div>
            <div className="era-narrative-thesis-text">{synthesis.thesis}</div>
          </div>

          {/* Threads */}
          <div>
            <div className="ilu-hint-sm era-narrative-section-heading era-narrative-section-heading-mb6">
              Threads
            </div>
            <div className="era-narrative-thread-list">
              {synthesis.threads.map((t) => (
                <div key={t.threadId} className="era-narrative-thread-card">
                  <div className="era-narrative-thread-header">
                    <span className="era-narrative-thread-name">{t.name}</span>
                    {t.register && (
                      <span className="era-narrative-thread-register">{t.register}</span>
                    )}
                  </div>
                  <div className="ilu-hint era-narrative-thread-desc">{t.description}</div>
                  {t.arc && <div className="era-narrative-thread-arc">{t.arc}</div>}
                  {t.culturalActors.length > 0 && (
                    <div className="ilu-hint-sm era-narrative-thread-actors">
                      Cultural actors: {t.culturalActors.join(", ")}
                    </div>
                  )}
                  {t.material && (
                    <details className="era-narrative-thread-material-details">
                      <summary className="ilu-hint-sm era-narrative-thread-material-summary">
                        Material
                      </summary>
                      <div className="era-narrative-thread-material-body">{t.material}</div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Counterweight */}
          {synthesis.counterweight && (
            <div>
              <div className="ilu-hint-sm era-narrative-section-heading">Counterweight</div>
              <div className="era-narrative-counterweight-text">{synthesis.counterweight}</div>
            </div>
          )}

          {/* Strategic Dynamics */}
          {synthesis.strategicDynamics && synthesis.strategicDynamics.length > 0 && (
            <div>
              <div className="ilu-hint-sm era-narrative-section-heading era-narrative-section-heading-mb6">
                Strategic Dynamics ({synthesis.strategicDynamics.length})
              </div>
              <div className="era-narrative-sd-list">
                {synthesis.strategicDynamics.map((sd, i) => (
                  <div key={i} className="era-narrative-sd-card">
                    <div className="era-narrative-sd-interaction">
                      {sd.interaction}{" "}
                      <span className="ilu-hint era-narrative-sd-actors">
                        [{sd.actors?.join(", ")}]
                      </span>
                    </div>
                    <div className="era-narrative-sd-dynamic">{sd.dynamic}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quotes */}
          {synthesis.quotes && synthesis.quotes.length > 0 && (
            <div>
              <div className="ilu-hint-sm era-narrative-section-heading era-narrative-section-heading-mb6">
                Quotes ({synthesis.quotes.length})
              </div>
              <div className="era-narrative-quote-list">
                {synthesis.quotes.map((q, i) => (
                  <div key={i} className="era-narrative-quote-card">
                    <div className="era-narrative-quote-text">&ldquo;{q.text}&rdquo;</div>
                    <div className="ilu-hint-sm era-narrative-quote-origin">
                      {q.origin}. {q.context}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Movement Plan */}
          {synthesis.movements && synthesis.movements.length > 0 && (
            <div>
              <div className="ilu-hint-sm era-narrative-section-heading era-narrative-section-heading-mb6">
                Movement Plan
              </div>
              <div className="era-narrative-movement-list">
                {synthesis.movements.map((m) => (
                  <div key={m.movementIndex} className="era-narrative-movement-card">
                    <div className="era-narrative-movement-header">
                      <span className="era-narrative-movement-title">
                        Movement {m.movementIndex + 1}
                      </span>
                      <span className="ilu-hint-sm era-narrative-movement-years">
                        Y{m.yearRange[0]}&ndash;Y{m.yearRange[1]}
                      </span>
                    </div>
                    <div className="ilu-hint-sm era-narrative-movement-focus">
                      {m.threadFocus.map((id) => threadNameMap[id] || id).join(", ")}
                    </div>
                    <div className="era-narrative-movement-beats">{m.beats}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Motifs */}
          {(synthesis.motifs?.length ?? 0) > 0 && (
            <div>
              <div className="ilu-hint-sm era-narrative-section-heading">Motifs</div>
              <div className="era-narrative-motifs-text">
                {(synthesis.motifs || []).join(" \u00B7 ")}
              </div>
            </div>
          )}

          {/* Opening / Closing Images */}
          {(synthesis.openingImage || synthesis.closingImage) && (
            <div className="era-narrative-images-grid">
              {synthesis.openingImage && (
                <div>
                  <div className="ilu-hint-sm era-narrative-image-label">Opening Image</div>
                  <div className="era-narrative-image-text">{synthesis.openingImage}</div>
                </div>
              )}
              {synthesis.closingImage && (
                <div>
                  <div className="ilu-hint-sm era-narrative-image-label">Closing Image</div>
                  <div className="era-narrative-image-text">{synthesis.closingImage}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: SourceBriefsSection
// ---------------------------------------------------------------------------

interface SourceBriefsSectionProps {
  briefs: EraNarrativePrepBrief[];
}

function SourceBriefsSection({ briefs }: Readonly<SourceBriefsSectionProps>) {
  const [showBriefs, setShowBriefs] = useState(false);

  const handleToggle = useCallback(() => setShowBriefs((prev) => !prev), []);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") (e.currentTarget as HTMLElement).click();
    },
    []
  );

  if (briefs.length === 0) return null;

  return (
    <div className="era-narrative-collapsible">
      <div
        onClick={handleToggle}
        className={`era-narrative-collapsible-header ${showBriefs ? "era-narrative-collapsible-header-open" : ""}`}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <span className="era-narrative-collapsible-title">
          Source Briefs ({briefs.length} chronicles)
        </span>
        <span className="ilu-hint-sm era-narrative-collapsible-chevron">
          {showBriefs ? "\u25B4" : "\u25BE"}
        </span>
      </div>

      {showBriefs && (
        <div className="era-narrative-briefs-list">
          {briefs.map((brief) => (
            <div key={brief.chronicleId} className="era-narrative-brief-card">
              <div className="era-narrative-brief-header">
                <span className="era-narrative-brief-title">{brief.chronicleTitle}</span>
                {brief.eraYear != null && (
                  <span className="ilu-hint-sm era-narrative-brief-year">
                    Y{brief.eraYear}
                  </span>
                )}
              </div>
              <div className="ilu-hint era-narrative-brief-prep">{brief.prep}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: ChronicleRefsDisplay
// ---------------------------------------------------------------------------

interface ChronicleRefsDisplayProps {
  refs: NarrativeChronicleRef[];
}

function ChronicleRefsDisplay({ refs }: Readonly<ChronicleRefsDisplayProps>) {
  if (refs.length === 0) return null;
  return (
    <div className="era-narrative-chronicle-refs-section">
      <div className="ilu-hint era-narrative-chronicle-refs-heading">
        Chronicle Images ({refs.length})
      </div>
      <div className="era-narrative-chronicle-refs-list">
        {refs.map((ref) => (
          <div key={ref.refId} className="era-narrative-chronicle-ref-card">
            <div className="era-narrative-chronicle-ref-thumb">
              <ChronicleRefThumbnail imageId={ref.imageId} />
            </div>
            <div className="era-narrative-chronicle-ref-body">
              <div className="era-narrative-chronicle-ref-header">
                <span className="era-narrative-chronicle-ref-source-badge">
                  {ref.imageSource === "cover" ? "Cover" : "Scene"}
                </span>
                <span className="era-narrative-chronicle-ref-title">
                  {ref.chronicleTitle}
                </span>
              </div>
              <div className="ilu-hint-sm era-narrative-chronicle-ref-anchor">
                anchor: &ldquo;
                {ref.anchorText.length > 40
                  ? ref.anchorText.slice(0, 40) + "..."
                  : ref.anchorText}
                &rdquo;
              </div>
              {ref.caption && (
                <div className="era-narrative-chronicle-ref-caption">{ref.caption}</div>
              )}
            </div>
            <div className="ilu-hint-sm era-narrative-chronicle-ref-size">
              {ref.size}
              {ref.justification ? ` ${ref.justification}` : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: VersionSelectorRow
// ---------------------------------------------------------------------------

interface VersionSelectorRowProps {
  versions: EraNarrativeContentVersion[];
  selectedVersionId: string;
  activeVersionId: string | undefined;
  viewedVersion: EraNarrativeContentVersion | undefined;
  confirmingDeleteId: string | null;
  showInsertion: boolean;
  onSelectVersion: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onSetActive: (versionId: string) => void;
  onDelete: (versionId: string) => void;
  onConfirmDelete: (versionId: string | null) => void;
  onToggleInsertion: () => void;
  onRerunCopyEdit: () => void;
}

function VersionSelectorRow({
  versions,
  selectedVersionId,
  activeVersionId,
  viewedVersion,
  confirmingDeleteId,
  showInsertion,
  onSelectVersion,
  onSetActive,
  onDelete,
  onConfirmDelete,
  onToggleInsertion,
  onRerunCopyEdit,
}: Readonly<VersionSelectorRowProps>) {
  const handleSetActive = useCallback(() => {
    if (viewedVersion) {
      onSetActive(viewedVersion.versionId);
      onConfirmDelete(null);
    }
  }, [viewedVersion, onSetActive, onConfirmDelete]);

  const handleDeleteClick = useCallback(() => {
    if (!viewedVersion) return;
    if (confirmingDeleteId === viewedVersion.versionId) {
      onDelete(viewedVersion.versionId);
    } else {
      onConfirmDelete(viewedVersion.versionId);
    }
  }, [viewedVersion, confirmingDeleteId, onDelete, onConfirmDelete]);

  const handleDeleteBlur = useCallback(() => {
    onConfirmDelete(null);
  }, [onConfirmDelete]);

  return (
    <div className="era-narrative-version-row">
      <select
        value={selectedVersionId || activeVersionId || ""}
        onChange={onSelectVersion}
        className="illuminator-select ilu-compact-select era-narrative-version-select"
      >
        {versions.map((v) => {
          const date = new Date(v.generatedAt);
          const timeStr =
            date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
            " " +
            date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
          const stepLabel = v.step === "generate" ? "Draft" : "Edit";
          return (
            <option key={v.versionId} value={v.versionId}>
              {stepLabel} — {v.wordCount.toLocaleString()} words — {timeStr}
            </option>
          );
        })}
      </select>

      {viewedVersion && viewedVersion.versionId === activeVersionId && (
        <span className="ilu-active-badge">Active</span>
      )}
      {viewedVersion && viewedVersion.versionId !== activeVersionId && (
        <button
          onClick={handleSetActive}
          className="illuminator-button era-narrative-make-active-btn"
        >
          Make Active
        </button>
      )}

      {viewedVersion && viewedVersion.step !== "generate" && (() => {
        const isConfirming = confirmingDeleteId === viewedVersion.versionId;
        return (
          <button
            onClick={handleDeleteClick}
            onBlur={handleDeleteBlur}
            className={`illuminator-button era-narrative-delete-btn ${isConfirming ? "era-narrative-delete-btn-confirming" : "era-narrative-delete-btn-idle"}`}
            title={isConfirming ? "Click again to confirm" : "Delete this version"}
          >
            {isConfirming ? "Confirm Delete" : "Delete"}
          </button>
        );
      })()}

      <div className="era-narrative-version-actions-right">
        <button
          onClick={onToggleInsertion}
          className="illuminator-button era-narrative-insertion-toggle"
          title="Paste a scene or passage to weave into the narrative during copy edit"
        >
          {showInsertion ? "\u25BE Scene Insertion" : "\u25B8 Scene Insertion"}
        </button>
        <button
          onClick={onRerunCopyEdit}
          className="illuminator-button era-narrative-rerun-btn"
          title="Re-run copy edit on the latest version"
        >
          Re-run Copy Edit
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Polling hook (extracted to reduce main component complexity)
// ---------------------------------------------------------------------------

function usePolling(
  narrativeId: string,
  record: EraNarrativeRecord | null,
  setRecord: React.Dispatch<React.SetStateAction<EraNarrativeRecord | null>>
) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollReasonRef = useRef<"edit" | "cover_image" | "image_refs" | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const startPolling = useCallback(
    (reason: "edit" | "cover_image" | "image_refs" = "edit") => {
      stopPolling();
      pollReasonRef.current = reason;
      const snapshotCoverImage = record?.coverImage;
      const snapshotImageRefs = record?.imageRefs;

      pollRef.current = setInterval(() => {
        void (async () => {
          const updated = await getEraNarrative(narrativeId);
          if (!updated) return;
          setRecord(updated);

          const r = pollReasonRef.current;

          if (r === "edit") {
            if (
              updated.status === "complete" ||
              updated.status === "failed" ||
              updated.status === "step_complete"
            ) {
              if (updated.status === "step_complete" && updated.currentStep === "edit") {
                await updateEraNarrative(updated.narrativeId, { status: "complete" });
                const final = await getEraNarrative(narrativeId);
                if (final) setRecord(final);
              }
              stopPolling();
            }
            return;
          }

          if (r === "cover_image") {
            const hasCover = updated.coverImage?.sceneDescription;
            const hadCover = snapshotCoverImage?.sceneDescription;
            if (hasCover && hasCover !== hadCover) {
              stopPolling();
            }
            return;
          }

          if (r === "image_refs") {
            const hasRefs = updated.imageRefs?.generatedAt;
            const hadRefs = snapshotImageRefs?.generatedAt;
            if (hasRefs && hasRefs !== hadRefs) {
              stopPolling();
            }
          }
        })();
      }, POLL_INTERVAL_MS);
    },
    [narrativeId, stopPolling, record?.coverImage, record?.imageRefs, setRecord]
  );

  return { startPolling, stopPolling };
}

// ---------------------------------------------------------------------------
// Image refs conversion hook (extracted for complexity reduction)
// ---------------------------------------------------------------------------

function useImageRefsConversion(record: EraNarrativeRecord | null) {
  return useMemo(() => {
    const emptyEntities = new Map<string, never>();
    if (!record?.imageRefs) {
      return {
        chronicleCompatibleImageRefs: null as ChronicleImageRefs | null,
        chronicleRefImages: [] as NarrativeChronicleRef[],
        emptyEntities,
      };
    }

    const promptRefs: PromptRequestRef[] = [];
    const chronicleRefImages: NarrativeChronicleRef[] = [];

    for (const ref of record.imageRefs.refs) {
      if (ref.type === "prompt_request") {
        promptRefs.push(ref as unknown as PromptRequestRef);
      } else if (ref.type === "chronicle_ref") {
        chronicleRefImages.push(ref);
      }
    }

    const chronicleCompatibleImageRefs: ChronicleImageRefs | null =
      promptRefs.length > 0
        ? {
            refs: promptRefs,
            generatedAt: record.imageRefs.generatedAt,
            model: record.imageRefs.model,
          }
        : null;

    return { chronicleCompatibleImageRefs, chronicleRefImages, emptyEntities };
  }, [record?.imageRefs]);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function EraNarrativeViewer({
  narrativeId,
  onEnqueue,
  styleLibrary,
  styleSelection: externalStyleSelection,
  imageSize,
  imageQuality,
  imageModel,
  imageGenSettings,
  onOpenImageSettings,
  cultures,
  cultureIdentities,
  worldContext,
}: Readonly<EraNarrativeViewerProps>) {
  const [record, setRecord] = useState<EraNarrativeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [showInsertion, setShowInsertion] = useState(false);
  const [insertionText, setInsertionText] = useState("");

  const styleSelection = useMemo(
    () => externalStyleSelection || DEFAULT_STYLE_SELECTION,
    [externalStyleSelection]
  );

  // Polling must be declared before the load effect that references startPolling
  const { startPolling, stopPolling } = usePolling(narrativeId, record, setRecord);

  // Load record from IndexedDB
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getEraNarrative(narrativeId).then((r) => {
      if (cancelled) return;
      setRecord(r ?? null);
      setLoading(false);
      setSelectedVersionId("");
      setConfirmingDeleteId(null);
      setInsertionText(r?.editInsertion || "");
      if (r && (r.status === "pending" || r.status === "generating")) {
        startPolling("edit");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [narrativeId, startPolling]);

  const threadNameMap = useMemo(() => {
    if (!record?.threadSynthesis) return {};
    const map: Record<string, string> = {};
    for (const t of record.threadSynthesis.threads) {
      map[t.threadId] = t.name;
    }
    return map;
  }, [record?.threadSynthesis]);

  // Resolve versioned content
  const resolved = useMemo(() => {
    if (!record) return { content: undefined, versions: [] as EraNarrativeContentVersion[], activeVersionId: undefined };
    return resolveActiveContent(record);
  }, [record]);

  // Sync selectedVersionId to activeVersionId
  useEffect(() => {
    if (resolved.activeVersionId) {
      if (!selectedVersionId || !resolved.versions.some((v) => v.versionId === selectedVersionId)) {
        setSelectedVersionId(resolved.activeVersionId);
      }
    }
  }, [resolved.activeVersionId, resolved.versions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const viewedVersion =
    resolved.versions.find((v) => v.versionId === selectedVersionId) ||
    resolved.versions[resolved.versions.length - 1];
  const viewedContent = viewedVersion?.content || resolved.content;
  const viewedWordCount = viewedVersion?.wordCount || 0;

  // =========================================================================
  // Actions
  // =========================================================================

  const handleExport = useCallback(() => {
    if (!record) return;
    try {
      downloadEraNarrativeExport(record);
    } catch (err) {
      console.error("[EraNarrativeViewer] Export failed:", err);
    }
  }, [record]);

  const handleRerunCopyEdit = useCallback(async () => {
    if (!record) return;
    await updateEraNarrative(record.narrativeId, {
      status: "pending",
      currentStep: "edit",
      editInsertion: insertionText || undefined,
    });
    setSelectedVersionId("");

    onEnqueue([
      {
        entity: SENTINEL_ENTITY,
        type: "eraNarrative" as EnrichmentType,
        prompt: "",
        chronicleId: record.narrativeId,
      },
    ]);

    const updated = await getEraNarrative(record.narrativeId);
    if (updated) setRecord(updated);
    startPolling();
  }, [record, onEnqueue, startPolling, insertionText]);

  const handleForceComplete = useCallback(async () => {
    if (!record) return;
    stopPolling();
    await updateEraNarrative(record.narrativeId, { status: "complete" });
    const updated = await getEraNarrative(record.narrativeId);
    if (updated) setRecord(updated);
  }, [record, stopPolling]);

  const handleDeleteVersion = useCallback(
    async (versionId: string) => {
      if (!record) return;
      const updated = await deleteEraNarrativeVersion(record.narrativeId, versionId);
      setRecord(updated);
      setConfirmingDeleteId(null);
      if (updated.activeVersionId) setSelectedVersionId(updated.activeVersionId);
    },
    [record]
  );

  const handleSetActiveVersion = useCallback(
    async (versionId: string) => {
      if (!record) return;
      const updated = await setEraNarrativeActiveVersion(record.narrativeId, versionId);
      setRecord(updated);
    },
    [record]
  );

  // =========================================================================
  // Era Narrative Sub-Step Dispatch
  // =========================================================================

  const dispatchEraNarrativeStep = useCallback(
    (step: string, extras?: Record<string, unknown>) => {
      if (!record) return;
      onEnqueue([
        {
          entity: SENTINEL_ENTITY,
          type: "eraNarrative" as EnrichmentType,
          prompt: "",
          chronicleId: record.narrativeId,
          eraNarrativeStep: step,
          ...extras,
        },
      ]);
    },
    [record, onEnqueue]
  );

  // =========================================================================
  // Cover Image Handlers
  // =========================================================================

  const handleGenerateCoverImageScene = useCallback(() => {
    dispatchEraNarrativeStep("cover_image_scene");
    startPolling("cover_image");
  }, [dispatchEraNarrativeStep, startPolling]);

  const handleGenerateCoverImage = useCallback(() => {
    if (!record?.coverImage?.sceneDescription) return;

    void updateEraNarrativeCoverImageStatus(record.narrativeId, "generating")
      .then(() => getEraNarrative(record.narrativeId))
      .then((updated) => {
        if (updated) setRecord(updated);
      });

    const resolvedStyle = resolveStyleSelection({
      selection: styleSelection,
      entityKind: "chronicle",
      styleLibrary: styleLibrary || {
        artisticStyles: [],
        compositionStyles: [],
        colorPalettes: [],
      },
    });
    const styleInfo: StyleInfo = {
      compositionPromptFragment:
        "cinematic montage composition, overlapping character silhouettes and scene elements, layered movie-poster layout, multiple focal points at different scales, dramatic depth layering, figures and settings blending into each other, NO TEXT NO TITLES NO LETTERING",
      artisticPromptFragment: resolvedStyle.artisticStyle?.promptFragment,
      colorPalettePromptFragment: resolvedStyle.colorPalette?.promptFragment,
    };

    const prompt = buildChronicleScenePrompt(
      {
        sceneDescription: record.coverImage.sceneDescription,
        size: "medium",
        chronicleTitle: record.eraName,
        world: worldContext
          ? {
              name: worldContext.name || "Unknown World",
              description: worldContext.description,
              speciesConstraint: worldContext.speciesConstraint,
            }
          : undefined,
      },
      styleInfo
    );

    onEnqueue([
      {
        entity: { id: "__era_narrative__", name: record.eraName, kind: "era_narrative" },
        type: "image" as EnrichmentType,
        prompt,
        chronicleId: record.narrativeId,
        imageRefId: "__cover_image__",
        sceneDescription: record.coverImage.sceneDescription,
        imageType: "era_narrative",
        imageSize: imageSize || "1024x1024",
        imageQuality: imageQuality || "standard",
      },
    ]);
  }, [record, styleSelection, styleLibrary, worldContext, onEnqueue, imageSize, imageQuality]);

  // =========================================================================
  // Image Refs Handlers
  // =========================================================================

  const handleGenerateImageRefs = useCallback(async () => {
    if (!record) return;

    const store = useChronicleStore.getState();
    const available: AvailableChronicleImage[] = [];

    for (const brief of record.prepBriefs) {
      const chronicle = await store.loadChronicle(brief.chronicleId);
      if (!chronicle) continue;

      if (chronicle.coverImage?.generatedImageId && chronicle.coverImage?.sceneDescription) {
        available.push({
          chronicleId: brief.chronicleId,
          chronicleTitle: brief.chronicleTitle,
          imageSource: "cover",
          imageId: chronicle.coverImage.generatedImageId,
          sceneDescription: chronicle.coverImage.sceneDescription,
        });
      }

      if (chronicle.imageRefs?.refs) {
        for (const ref of chronicle.imageRefs.refs) {
          if (ref.type === "prompt_request" && ref.generatedImageId && ref.sceneDescription) {
            available.push({
              chronicleId: brief.chronicleId,
              chronicleTitle: brief.chronicleTitle,
              imageSource: "image_ref",
              imageRefId: ref.refId,
              imageId: ref.generatedImageId,
              sceneDescription: ref.sceneDescription,
            });
          }
        }
      }
    }

    dispatchEraNarrativeStep("image_refs", { availableChronicleImages: available });
    startPolling("image_refs");
  }, [record, dispatchEraNarrativeStep, startPolling]);

  const handleGenerateSceneImage = useCallback(
    (ref: PromptRequestRef, prompt: string, _styleInfo: StyleInfo) => {
      if (!record) return;

      void updateEraNarrativeImageRefStatus(record.narrativeId, ref.refId, "generating")
        .then(() => getEraNarrative(record.narrativeId))
        .then((updated) => {
          if (updated) setRecord(updated);
        });

      onEnqueue([
        {
          entity: { id: "__era_narrative__", name: record.eraName, kind: "era_narrative" },
          type: "image" as EnrichmentType,
          prompt,
          chronicleId: record.narrativeId,
          imageRefId: ref.refId,
          sceneDescription: ref.sceneDescription,
          imageType: "era_narrative",
          imageSize: imageSize || "1024x1024",
          imageQuality: imageQuality || "standard",
        },
      ]);
    },
    [record, onEnqueue, imageSize, imageQuality]
  );

  const handleResetImage = useCallback(
    (ref: PromptRequestRef) => {
      if (!record) return;
      void updateEraNarrativeImageRefStatus(record.narrativeId, ref.refId, "pending")
        .then(() => getEraNarrative(record.narrativeId))
        .then((updated) => {
          if (updated) setRecord(updated);
        });
    },
    [record]
  );

  const handleUpdateAnchorText = useCallback(
    (ref: PromptRequestRef, anchorText: string) => {
      if (!record) return;
      void updateEraNarrativeImageRefField(record.narrativeId, ref.refId, { anchorText })
        .then(() => getEraNarrative(record.narrativeId))
        .then((updated) => {
          if (updated) setRecord(updated);
        });
    },
    [record]
  );

  const handleUpdateSize = useCallback(
    (ref: PromptRequestRef, size: string) => {
      if (!record) return;
      const updates: { size: string; justification?: null } = { size };
      if (size === "full-width") updates.justification = null;
      void updateEraNarrativeImageRefField(record.narrativeId, ref.refId, updates)
        .then(() => getEraNarrative(record.narrativeId))
        .then((updated) => {
          if (updated) setRecord(updated);
        });
    },
    [record]
  );

  const handleUpdateJustification = useCallback(
    (ref: PromptRequestRef, justification: "left" | "right") => {
      if (!record) return;
      void updateEraNarrativeImageRefField(record.narrativeId, ref.refId, { justification })
        .then(() => getEraNarrative(record.narrativeId))
        .then((updated) => {
          if (updated) setRecord(updated);
        });
    },
    [record]
  );

  // =========================================================================
  // Convert era narrative image refs to chronicle-compatible format
  // =========================================================================

  const { chronicleCompatibleImageRefs, chronicleRefImages, emptyEntities } =
    useImageRefsConversion(record);

  // =========================================================================
  // Version selector handlers
  // =========================================================================

  const handleVersionChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedVersionId(e.target.value);
      setConfirmingDeleteId(null);
    },
    []
  );

  const handleToggleInsertion = useCallback(() => setShowInsertion((prev) => !prev), []);

  const handleInsertionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setInsertionText(e.target.value),
    []
  );

  const handleRerunCopyEditClick = useCallback(
    () => void handleRerunCopyEdit(),
    [handleRerunCopyEdit]
  );

  const handleForceCompleteClick = useCallback(
    () => void handleForceComplete(),
    [handleForceComplete]
  );

  const handleGenerateImageRefsClick = useCallback(
    () => void handleGenerateImageRefs(),
    [handleGenerateImageRefs]
  );

  // =========================================================================
  // Render
  // =========================================================================

  if (loading) {
    return <div className="ilu-hint era-narrative-loading">Loading era narrative...</div>;
  }

  if (!record) {
    return <div className="ilu-hint era-narrative-loading">Era narrative not found</div>;
  }

  const synthesis = record.threadSynthesis;
  const isGenerating = record.status === "pending" || record.status === "generating";

  return (
    <div className="era-narrative-root">
      {/* Header */}
      <div className="era-narrative-header">
        <div className="era-narrative-header-row">
          <div className="era-narrative-header-left">
            <h2 className="era-narrative-header-title">{record.eraName}</h2>
          </div>
          <div className="era-narrative-header-actions">
            <span className="era-narrative-tone-badge">{record.tone}</span>
            {viewedWordCount > 0 && (
              <span className="ilu-hint era-narrative-word-count">
                {viewedWordCount.toLocaleString()} words
              </span>
            )}
            <button
              onClick={handleExport}
              title="Export era narrative as JSON (threads, quotes, briefs, draft & edited versions)"
              className="ilu-hint-sm era-narrative-export-btn"
            >
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Version Selector + Actions */}
      {resolved.versions.length > 0 && !isGenerating && (
        <VersionSelectorRow
          versions={resolved.versions}
          selectedVersionId={selectedVersionId}
          activeVersionId={resolved.activeVersionId}
          viewedVersion={viewedVersion}
          confirmingDeleteId={confirmingDeleteId}
          showInsertion={showInsertion}
          onSelectVersion={handleVersionChange}
          onSetActive={(vId) => void handleSetActiveVersion(vId)}
          onDelete={(vId) => void handleDeleteVersion(vId)}
          onConfirmDelete={setConfirmingDeleteId}
          onToggleInsertion={handleToggleInsertion}
          onRerunCopyEdit={handleRerunCopyEditClick}
        />
      )}

      {/* Scene insertion textarea */}
      {showInsertion && !isGenerating && (
        <div className="era-narrative-insertion-wrap">
          <textarea
            value={insertionText}
            onChange={handleInsertionChange}
            placeholder="Paste a scene or passage to weave into the narrative during copy edit..."
            className="era-narrative-insertion-textarea"
          />
        </div>
      )}

      {/* Generating indicator */}
      {isGenerating && (
        <div className="era-narrative-generating">
          <span>
            {record.currentStep === "edit"
              ? "Running copy edit..."
              : `Running ${record.currentStep} step...`}
          </span>
          <button
            onClick={handleForceCompleteClick}
            title="Force status to complete (use if stuck)"
            className="era-narrative-force-complete-btn"
          >
            Mark Complete
          </button>
        </div>
      )}

      {/* Narrative Prose -- primary content */}
      {viewedContent ? (
        <div className="era-narrative-prose">{viewedContent}</div>
      ) : (
        <div className="ilu-hint era-narrative-prose-empty">
          No narrative content generated yet.
        </div>
      )}

      {/* Cover Image -- shared CoverImageControls component */}
      {!isGenerating && (
        <div className="ilu-section era-narrative-cover-section">
          <CoverImageControls
            item={record}
            onGenerateCoverImageScene={handleGenerateCoverImageScene}
            onGenerateCoverImage={handleGenerateCoverImage}
            isGenerating={isGenerating}
          />
        </div>
      )}

      {/* Image Refs -- Chronicle ref images (read-only) + ChronicleImagePanel for prompt_request refs */}
      {!isGenerating && (
        <div className="era-narrative-image-refs-section">
          {!record.imageRefs && (
            <div className="ilu-section era-narrative-image-refs-empty">
              <div>
                <div className="era-narrative-image-refs-title">Image References</div>
                <div className="ilu-hint era-narrative-image-refs-desc">
                  Place image references throughout the narrative (from chronicle images).
                </div>
              </div>
              <button
                onClick={handleGenerateImageRefsClick}
                className="ilu-action-btn era-narrative-generate-btn"
              >
                Generate
              </button>
            </div>
          )}

          <ChronicleRefsDisplay refs={chronicleRefImages} />

          {chronicleCompatibleImageRefs && (
            <ChronicleImagePanel
              imageRefs={chronicleCompatibleImageRefs}
              entities={emptyEntities}
              onGenerateImage={handleGenerateSceneImage}
              onResetImage={handleResetImage}
              onUpdateAnchorText={(ref, text) =>
                handleUpdateAnchorText(ref as PromptRequestRef, text)
              }
              onUpdateSize={(ref, size) =>
                handleUpdateSize(ref as PromptRequestRef, size as string)
              }
              onUpdateJustification={(ref, just) =>
                handleUpdateJustification(ref as PromptRequestRef, just)
              }
              chronicleText={viewedContent}
              isGenerating={isGenerating}
              styleLibrary={styleLibrary}
              styleSelection={styleSelection}
              cultures={cultures}
              cultureIdentities={cultureIdentities}
              worldContext={worldContext}
              chronicleTitle={record.eraName}
              imageSize={imageSize}
              imageQuality={imageQuality}
              imageModel={imageModel}
              imageGenSettings={imageGenSettings}
              onOpenImageSettings={onOpenImageSettings}
            />
          )}

          {record.imageRefs && (
            <div className="era-narrative-regen-row">
              <button
                onClick={handleGenerateImageRefsClick}
                className="ilu-action-btn-sm era-narrative-regen-btn"
              >
                Regenerate Image Refs
              </button>
            </div>
          )}
        </div>
      )}

      {/* Thread Synthesis -- collapsible */}
      {synthesis && (
        <ThreadSynthesisSection synthesis={synthesis} threadNameMap={threadNameMap} />
      )}

      {/* Source Briefs -- collapsible */}
      <SourceBriefsSection briefs={record.prepBriefs} />

      {/* Cost / Model Metadata */}
      <div className="ilu-hint-sm era-narrative-footer">
        {record.totalActualCost > 0 && (
          <span title="Total cost">${record.totalActualCost.toFixed(4)}</span>
        )}
        {record.totalInputTokens > 0 && (
          <span title="Total input tokens">{record.totalInputTokens.toLocaleString()} in</span>
        )}
        {record.totalOutputTokens > 0 && (
          <span title="Total output tokens">{record.totalOutputTokens.toLocaleString()} out</span>
        )}
        {synthesis && <span title="Thread synthesis model">{synthesis.model}</span>}
        <span className="era-narrative-footer-date">
          {new Date(record.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
