/**
 * EraNarrativeModal — Era narrative generation.
 *
 * States:
 * 1. Setup: pick era + tone, review prep coverage, start
 * 2. Generating: spinner while LLM works
 * 3. Thread synthesis review: thesis, threads, movement plan
 * 4. Narrative review: read generated narrative, advance/edit/skip
 * 5. Edit review: read edited narrative, finish
 * 6. Complete: summary
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useChronicleStore } from "../lib/db/chronicleStore";
import { useEraNarrative } from "../hooks/useEraNarrative";
import type { UseEraNarrativeReturn, EraNarrativeConfig } from "../hooks/useEraNarrative";
import { useIlluminatorConfigStore } from "../lib/db/illuminatorConfigStore";
import { useEraTemporalInfo } from "../lib/db/indexSelectors";
import { useFloatingPillStore } from "../lib/db/floatingPillStore";
import { useIlluminatorModals } from "../lib/db/modalStore";
import { getEraNarrativesForEra, deleteEraNarrative, resolveActiveContent } from "../lib/db/eraNarrativeRepository";
import { ErrorMessage } from "@the-canonry/shared-components";
import type { HistorianConfig } from "../lib/historianTypes";
import type {
  EraNarrativeRecord,
  EraNarrativeTone,
  EraNarrativeThreadSynthesis,
  EraNarrativeContentVersion,
} from "../lib/eraNarrativeTypes";
import type { EraTemporalEntry } from "../lib/db/indexTypes";
import type { StyleLibrary } from "@canonry/world-schema";
import "./EraNarrativeModal.css";

// ============================================================================
// Constants
// ============================================================================

const PILL_ID = "era-narrative";

interface ToneOption {
  value: EraNarrativeTone;
  label: string;
  description: string;
}

const TONE_OPTIONS: ToneOption[] = [
  { value: "witty", label: "Witty", description: "Sly, dry, finds the dark comic" },
  { value: "cantankerous", label: "Cantankerous", description: "Irritable energy, argues with the dead" },
  { value: "bemused", label: "Bemused", description: "Puzzled and delighted by absurdity" },
  { value: "defiant", label: "Defiant", description: "Proud of what was attempted" },
  { value: "sardonic", label: "Sardonic", description: "Sharp irony, names the pattern" },
  { value: "tender", label: "Tender", description: "Lingers on what survived" },
  { value: "hopeful", label: "Hopeful", description: "Reads for what was seeded" },
  { value: "enthusiastic", label: "Enthusiastic", description: "Thrilled by scale and ambition" },
];

// ============================================================================
// Shared Types
// ============================================================================

interface EraOption {
  id: string;
  name: string;
  count: number;
  preppedCount: number;
}

interface ChronicleListItem {
  chronicleId: string;
  name: string;
  title?: string;
  focalEraName?: string;
  hasHistorianPrep?: boolean;
  eraYear?: number;
  narrativeStyleName?: string;
  narrativeStyleId?: string;
  eraNarrativeWeight?: string;
}

interface PreviousEraThesis {
  eraName: string;
  thesis: string;
}

interface ResolvedContent {
  content: string | undefined;
  versions: EraNarrativeContentVersion[];
  activeVersionId: string | undefined;
}

// ============================================================================
// Props
// ============================================================================

interface EraNarrativeModalProps {
  isOpen: boolean;
  onClose: () => void;
  chronicleItems: ChronicleListItem[];
  wizardEras: Array<{ id: string; name: string }>;
  projectId: string;
  simulationRunId: string;
  historianConfig: HistorianConfig;
  onEnqueue: UseEraNarrativeReturn extends { startNarrative: infer F } ? Parameters<typeof useEraNarrative>[0] : never;
  resumeNarrativeId?: string;
  styleLibrary?: StyleLibrary;
}

// ============================================================================
// Setup Section
// ============================================================================

interface SetupSectionProps {
  eraOptions: EraOption[];
  selectedEraId: string;
  selectedEra: EraOption | undefined;
  onSelectEra: (eraId: string) => void;
  previousEraThesis: PreviousEraThesis | null;
  eraChronicles: ChronicleListItem[];
  narrativeWeightMap: Record<string, string>;
  existingNarratives: EraNarrativeRecord[];
  onResume: (narrativeId: string) => Promise<void>;
  onDeleteExisting: (narrativeId: string) => Promise<void>;
  tone: EraNarrativeTone;
  onSetTone: (tone: EraNarrativeTone) => void;
  arcDirection: string;
  onSetArcDirection: (v: string) => void;
  onStart: () => void;
  onStartHeadless: () => void;
}

function ChronicleListRow({
  c,
  narrativeWeightMap,
}: {
  c: ChronicleListItem;
  narrativeWeightMap: Record<string, string>;
}) {
  const weight = c.eraNarrativeWeight || narrativeWeightMap[c.narrativeStyleId || ""] || null;
  let weightSymbol: string;
  if (weight === "structural") weightSymbol = "\u25A0";
  else if (weight === "contextual") weightSymbol = "\u25A1";
  else if (weight === "flavor") weightSymbol = "\u25CB";
  else weightSymbol = "\u2013";

  let weightColor: string;
  if (weight === "structural") weightColor = "#3b82f6";
  else if (weight === "contextual") weightColor = "#f59e0b";
  else if (weight === "flavor") weightColor = "#a855f7";
  else weightColor = "var(--text-muted)";

  return (
    <div className={`era-narr-chronicle-item${c.hasHistorianPrep ? "" : " era-narr-chronicle-item-unprepped"}`}>
      <span
        className="era-narr-chronicle-item-weight"
        title={weight ? `Weight: ${weight}` : "No weight assigned"}
        style={{ "--era-narr-weight-color": weightColor } as React.CSSProperties}
      >
        {weightSymbol}
      </span>
      <span className="era-narr-chronicle-item-title" title={c.title || c.name}>
        {c.title || c.name}
      </span>
      {c.eraYear != null && (
        <span className="era-narr-chronicle-item-year" title="Era year">
          Y{c.eraYear}
        </span>
      )}
      {c.narrativeStyleName && (
        <span className="era-narr-chronicle-item-style" title={`Style: ${c.narrativeStyleName}`}>
          {c.narrativeStyleName}
        </span>
      )}
      <span
        className={`era-narr-chronicle-item-prep${c.hasHistorianPrep ? " era-narr-chronicle-item-prep-yes" : ""}`}
        title={c.hasHistorianPrep ? "Has historian prep brief" : "No prep brief"}
      >
        {c.hasHistorianPrep ? "\u270E" : "\u2013"}
      </span>
    </div>
  );
}

function ExistingNarrativeRow({
  rec,
  onResume,
  onDelete,
}: {
  rec: EraNarrativeRecord;
  onResume: (narrativeId: string) => Promise<void>;
  onDelete: (narrativeId: string) => Promise<void>;
}) {
  const STEP_LABEL: Record<string, string> = { threads: "Threads", generate: "Draft", edit: "Edit" };

  let statusIcon: string;
  if (rec.status === "complete") statusIcon = "\u2713";
  else if (rec.status === "failed") statusIcon = "\u2717";
  else if (rec.status === "step_complete") statusIcon = "\u25CB";
  else statusIcon = "\u2026";

  let statusColor: string;
  if (rec.status === "complete") statusColor = "#10b981";
  else if (rec.status === "failed") statusColor = "#ef4444";
  else statusColor = "#f59e0b";

  const date = new Date(rec.updatedAt);
  const timeStr =
    date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " +
    date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  const canResume = rec.status !== "complete";

  const handleResume = useCallback(() => onResume(rec.narrativeId), [onResume, rec.narrativeId]);
  const handleDelete = useCallback(() => void onDelete(rec.narrativeId), [onDelete, rec.narrativeId]);

  return (
    <div className="era-narr-existing-item">
      <span
        className="era-narr-existing-item-status"
        title={rec.status}
        style={{ "--era-narr-status-color": statusColor } as React.CSSProperties}
      >
        {statusIcon}
      </span>
      <span className="era-narr-existing-item-step">
        {rec.status === "complete" ? "Complete" : `${STEP_LABEL[rec.currentStep] || rec.currentStep} step`}
      </span>
      <span className="era-narr-existing-item-time">{timeStr}</span>
      {rec.totalActualCost > 0 && (
        <span className="era-narr-existing-item-cost">
          ${rec.totalActualCost.toFixed(3)}
        </span>
      )}
      {canResume && (
        <button onClick={handleResume} className="illuminator-button era-narr-existing-item-resume-btn">
          Resume
        </button>
      )}
      {!canResume && (
        <button onClick={handleResume} className="illuminator-button era-narr-existing-item-view-btn">
          View
        </button>
      )}
      <button onClick={handleDelete} className="illuminator-button era-narr-existing-item-delete-btn" title="Delete narrative">
        {"\u2715"}
      </button>
    </div>
  );
}

function SetupSection({
  eraOptions,
  selectedEraId,
  selectedEra,
  onSelectEra,
  previousEraThesis,
  eraChronicles,
  narrativeWeightMap,
  existingNarratives,
  onResume,
  onDeleteExisting,
  tone,
  onSetTone,
  arcDirection,
  onSetArcDirection,
  onStart,
  onStartHeadless,
}: SetupSectionProps) {
  const handleEraChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => onSelectEra(e.target.value), [onSelectEra]);
  const handleArcChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => onSetArcDirection(e.target.value), [onSetArcDirection]);

  const canStart = !!selectedEraId && !!selectedEra && selectedEra.preppedCount > 0;

  return (
    <>
      <div className="era-narr-field">
        <label htmlFor="era" className="era-narr-label">Era</label>
        <select id="era" className="illuminator-select era-narr-select-full" value={selectedEraId} onChange={handleEraChange}>
          <option value="">Select an era...</option>
          {eraOptions.map((era) => (
            <option key={era.id} value={era.id}>
              {era.name} ({era.count} chronicles, {era.preppedCount}/{era.count} prepped)
            </option>
          ))}
        </select>
      </div>

      {selectedEra && selectedEra.preppedCount === 0 && (
        <div className="era-narr-warning">
          No chronicles in this era have historian prep briefs. Run Historian Prep first.
        </div>
      )}

      {selectedEra && selectedEra.preppedCount > 0 && selectedEra.preppedCount < selectedEra.count && (
        <div className="era-narr-warning">
          {selectedEra.count - selectedEra.preppedCount} chronicles are missing prep
          briefs. The narrative will be based on {selectedEra.preppedCount} prepped
          chronicles only.
        </div>
      )}

      {previousEraThesis && (
        <div className="era-narr-thesis-link">
          <div className="era-narr-thesis-link-label">
            Preceding volume thesis ({previousEraThesis.eraName})
          </div>
          <div className="era-narr-thesis-link-text">{previousEraThesis.thesis}</div>
        </div>
      )}

      {eraChronicles.length > 0 && (
        <div className="era-narr-field">
          <span className="era-narr-label">Chronicles ({eraChronicles.length})</span>
          <div className="era-narr-chronicle-list">
            {eraChronicles.map((c) => (
              <ChronicleListRow key={c.chronicleId} c={c} narrativeWeightMap={narrativeWeightMap} />
            ))}
          </div>
        </div>
      )}

      {existingNarratives.length > 0 && (
        <div className="era-narr-field">
          <span className="era-narr-label">Existing Narratives</span>
          <div className="era-narr-existing-list">
            {existingNarratives.map((rec) => (
              <ExistingNarrativeRow key={rec.narrativeId} rec={rec} onResume={onResume} onDelete={onDeleteExisting} />
            ))}
          </div>
        </div>
      )}

      <div className="era-narr-field-lg">
        <span className="era-narr-label">Tone</span>
        <div className="era-narr-tone-row">
          {TONE_OPTIONS.map((t) => (
            <button
              key={t.value}
              onClick={() => onSetTone(t.value)}
              title={t.description}
              className={`illuminator-button era-narr-tone-btn ${tone === t.value ? "era-narr-tone-btn-active" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="era-narr-field-lg">
        <label htmlFor="arc-direction" className="era-narr-label">
          Arc Direction <span className="era-narr-label-optional">(optional)</span>
        </label>
        <textarea
          id="arc-direction"
          value={arcDirection}
          onChange={handleArcChange}
          placeholder="Override the era's narrative arc. When set, the historian's thesis, thread arcs, and register choices must honor this direction."
          className="era-narr-textarea"
        />
      </div>

      <div className="era-narr-start-row">
        <button
          onClick={onStart}
          disabled={!canStart}
          className={`illuminator-button era-narr-start-btn ${canStart ? "era-narr-start-btn-primary" : "era-narr-start-btn-dimmed"}`}
        >
          Start Narrative
        </button>
        <button
          onClick={onStartHeadless}
          disabled={!canStart}
          className={`illuminator-button era-narr-headless-btn${canStart ? "" : " era-narr-start-btn-dimmed"}`}
          title="Run all steps without pausing for review"
        >
          Run Headless
        </button>
      </div>
    </>
  );
}

// ============================================================================
// Thread Review Section
// ============================================================================

function ThreadReviewSection({
  synthesis,
  threadNameMap,
}: {
  synthesis: EraNarrativeThreadSynthesis;
  threadNameMap: Record<string, string>;
}) {
  return (
    <>
      <div className="era-narr-review-group">
        <div className="era-narr-review-heading">Thesis</div>
        <div className="era-narr-thesis-text">{synthesis.thesis}</div>
      </div>

      <div className="era-narr-review-group">
        <div className="era-narr-review-heading">Threads ({synthesis.threads.length})</div>
        <div className="era-narr-thread-list">
          {synthesis.threads.map((t) => (
            <div key={t.threadId} className="era-narr-thread-card">
              <div className="era-narr-thread-card-header">
                <span className="era-narr-thread-card-name">{t.name}</span>
                {t.culturalActors?.length > 0 && (
                  <span className="era-narr-thread-card-actors">
                    [{t.culturalActors.join(", ")}]
                  </span>
                )}
                {t.register && <span className="era-narr-thread-card-register">{t.register}</span>}
              </div>
              <div className="era-narr-thread-card-desc">{t.description}</div>
              {t.material && (
                <details className="era-narr-thread-card-material">
                  <summary className="era-narr-thread-card-material-summary">Material</summary>
                  <div className="era-narr-thread-card-material-body">{t.material}</div>
                </details>
              )}
            </div>
          ))}
        </div>
      </div>

      {synthesis.movements && synthesis.movements.length > 0 && (
        <div className="era-narr-review-group">
          <div className="era-narr-review-heading">
            Movement Plan ({synthesis.movements.length} movements)
          </div>
          <div className="era-narr-movement-list">
            {synthesis.movements.map((m) => (
              <div key={m.movementIndex} className="era-narr-movement-card">
                <div className="era-narr-movement-card-header">
                  <span className="era-narr-movement-card-index">Movement {m.movementIndex + 1}</span>
                  <span className="era-narr-movement-card-range">
                    Y{m.yearRange[0]}–Y{m.yearRange[1]}
                  </span>
                </div>
                <div className="era-narr-movement-card-threads">
                  {m.threadFocus.map((id) => threadNameMap[id] || id).join(", ")}
                </div>
                {m.worldState && <div className="era-narr-movement-card-world-state">{m.worldState}</div>}
                <div className="era-narr-movement-card-beats">{m.beats}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {synthesis.counterweight && (
        <div className="era-narr-review-group">
          <div className="era-narr-review-heading">Counterweight</div>
          <div className="era-narr-counterweight">{synthesis.counterweight}</div>
        </div>
      )}

      {synthesis.strategicDynamics && synthesis.strategicDynamics.length > 0 && (
        <div className="era-narr-review-group">
          <div className="era-narr-review-heading">
            Strategic Dynamics ({synthesis.strategicDynamics.length})
          </div>
          <div className="era-narr-dynamics-list">
            {synthesis.strategicDynamics.map((sd, i) => (
              <div key={i} className="era-narr-dynamic-card">
                <div className="era-narr-dynamic-card-interaction">
                  {sd.interaction}{" "}
                  <span className="era-narr-dynamic-card-actors">
                    [{sd.actors?.join(", ")}]
                  </span>
                </div>
                <div className="era-narr-dynamic-card-text">{sd.dynamic}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {synthesis.quotes && synthesis.quotes.length > 0 && (
        <div className="era-narr-review-group">
          <div className="era-narr-review-heading">Quotes ({synthesis.quotes.length})</div>
          <div className="era-narr-quotes-list">
            {synthesis.quotes.map((q, i) => (
              <div key={i} className="era-narr-quote-card">
                <div className="era-narr-quote-card-text">&ldquo;{q.text}&rdquo;</div>
                <div className="era-narr-quote-card-origin">
                  {q.origin}. {q.context}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {synthesis.motifs && synthesis.motifs.length > 0 && (
        <div className="era-narr-review-group">
          <div className="era-narr-motifs">Motifs: {synthesis.motifs.join(", ")}</div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// Complete Section (version selector + content)
// ============================================================================

interface CompleteSectionProps {
  narrative: EraNarrativeRecord;
  resolved: ResolvedContent;
  selectedVersionId: string;
  onSelectVersion: (versionId: string) => void;
  viewedVersion: EraNarrativeContentVersion | undefined;
  viewedContent: string | undefined;
  viewedWordCount: number;
  deleteVersion: (versionId: string) => Promise<void>;
  setActiveVersion: (versionId: string) => Promise<void>;
}

function CompleteSection({
  narrative,
  resolved,
  selectedVersionId,
  onSelectVersion,
  viewedVersion,
  viewedContent,
  viewedWordCount,
  deleteVersion,
  setActiveVersion,
}: CompleteSectionProps) {
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const handleVersionChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onSelectVersion(e.target.value);
      setConfirmingDeleteId(null);
    },
    [onSelectVersion]
  );

  const handleMakeActive = useCallback(() => {
    if (viewedVersion) {
      setActiveVersion(viewedVersion.versionId);
      setConfirmingDeleteId(null);
    }
  }, [viewedVersion, setActiveVersion]);

  const handleDeleteVersion = useCallback(() => {
    if (!viewedVersion) return;
    if (confirmingDeleteId === viewedVersion.versionId) {
      deleteVersion(viewedVersion.versionId);
      setConfirmingDeleteId(null);
      onSelectVersion(resolved.activeVersionId || "");
    } else {
      setConfirmingDeleteId(viewedVersion.versionId);
    }
  }, [viewedVersion, confirmingDeleteId, deleteVersion, onSelectVersion, resolved.activeVersionId]);

  const handleDeleteBlur = useCallback(() => setConfirmingDeleteId(null), []);

  return (
    <>
      {resolved.versions.length > 0 && (
        <div className="era-narr-version-row">
          <select
            value={selectedVersionId || resolved.activeVersionId || ""}
            onChange={handleVersionChange}
            className="illuminator-select era-narr-version-select"
          >
            {resolved.versions.map((v) => {
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

          {viewedVersion && viewedVersion.versionId === resolved.activeVersionId && (
            <span className="ilu-active-badge era-narr-version-active-badge">Active</span>
          )}
          {viewedVersion && viewedVersion.versionId !== resolved.activeVersionId && (
            <button onClick={handleMakeActive} className="illuminator-button era-narr-version-make-active-btn">
              Make Active
            </button>
          )}

          {viewedVersion && viewedVersion.step !== "generate" && (
            <button
              onClick={handleDeleteVersion}
              onBlur={handleDeleteBlur}
              className={`illuminator-button era-narr-version-delete-btn ${confirmingDeleteId === viewedVersion.versionId ? "era-narr-version-delete-btn-confirming" : "era-narr-version-delete-btn-normal"}`}
              title={confirmingDeleteId === viewedVersion.versionId ? "Click again to confirm" : "Delete this version"}
            >
              {confirmingDeleteId === viewedVersion.versionId ? "Confirm Delete" : "Delete"}
            </button>
          )}
        </div>
      )}

      <div className="era-narr-content-header era-narr-content-header-mb8">
        <div className="era-narr-content-title">
          {narrative.eraName || "Era Narrative"}
        </div>
        <span className="era-narr-content-meta">
          {viewedWordCount.toLocaleString()} words | $
          {(narrative.totalActualCost || 0).toFixed(4)}
        </span>
      </div>

      {viewedContent ? (
        <div className="era-narr-content-viewer">{viewedContent}</div>
      ) : (
        <div className="era-narr-no-content">No content available</div>
      )}
    </>
  );
}

// ============================================================================
// Main Modal
// ============================================================================

export default function EraNarrativeModal({
  isOpen,
  onClose,
  chronicleItems,
  wizardEras,
  projectId,
  simulationRunId,
  historianConfig,
  onEnqueue,
  resumeNarrativeId,
  styleLibrary,
}: EraNarrativeModalProps) {
  const [selectedEraId, setSelectedEraId] = useState("");
  const [tone, setTone] = useState<EraNarrativeTone>("witty");
  const [arcDirection, setArcDirection] = useState("");
  const [existingNarratives, setExistingNarratives] = useState<EraNarrativeRecord[]>([]);
  const [previousEraThesis, setPreviousEraThesis] = useState<PreviousEraThesis | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState("");

  const {
    narrative,
    isActive,
    startNarrative,
    startHeadless,
    resumeNarrative,
    advanceStep,
    skipEdit,
    rerunCopyEdit,
    deleteVersion,
    setActiveVersion,
    cancel,
  } = useEraNarrative(onEnqueue);

  const isMinimized = useFloatingPillStore((s) => s.isMinimized(PILL_ID));
  const eraTemporalInfo = useEraTemporalInfo();

  // Check for existing narratives when era selection changes + look up previous era thesis
  useEffect(() => {
    if (!selectedEraId || !simulationRunId) {
      // Resetting to defaults without calling setState in effect body:
      // we store a flag and check below
      setExistingNarratives([]);
      setPreviousEraThesis(null);
      return;
    }
    let cancelled = false;
    getEraNarrativesForEra(simulationRunId, selectedEraId).then((records) => {
      if (cancelled) return;
      const resumable = records
        .filter((r) => r.status !== "cancelled")
        .sort((a, b) => b.updatedAt - a.updatedAt);
      setExistingNarratives(resumable);
    });

    const focalInfo = eraTemporalInfo.find((e) => e.id === selectedEraId);
    const focalOrder = focalInfo?.order ?? -1;
    const prevInfo = focalOrder > 0 ? eraTemporalInfo.find((e) => e.order === focalOrder - 1) : undefined;
    if (prevInfo) {
      getEraNarrativesForEra(simulationRunId, prevInfo.id).then((prevRecords) => {
        if (cancelled) return;
        const completed = prevRecords
          .filter((r) => r.status === "complete" && r.threadSynthesis?.thesis)
          .sort((a, b) => b.updatedAt - a.updatedAt);
        setPreviousEraThesis(
          completed.length > 0
            ? { eraName: prevInfo.name, thesis: completed[0].threadSynthesis!.thesis }
            : null
        );
      });
    } else {
      setPreviousEraThesis(null);
    }
    return () => { cancelled = true; };
  }, [selectedEraId, simulationRunId, eraTemporalInfo]);

  // Group chronicles by era and count prep coverage
  const eraOptions = useMemo((): EraOption[] => {
    return wizardEras.map((era) => {
      const eraChronicles = chronicleItems.filter((c) => c.focalEraName === era.name);
      const preppedCount = eraChronicles.filter((c) => c.hasHistorianPrep).length;
      return { id: era.id, name: era.name, count: eraChronicles.length, preppedCount };
    });
  }, [wizardEras, chronicleItems]);

  const selectedEra = eraOptions.find((e) => e.id === selectedEraId);

  // Build a weight lookup from the live style library
  const narrativeWeightMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (styleLibrary?.narrativeStyles) {
      for (const s of styleLibrary.narrativeStyles) {
        if ((s as Record<string, unknown>).eraNarrativeWeight) {
          map[s.id] = (s as Record<string, unknown>).eraNarrativeWeight as string;
        }
      }
    }
    return map;
  }, [styleLibrary]);

  // Chronicles for the selected era
  const eraChronicles = useMemo(() => {
    if (!selectedEra) return [];
    const era = wizardEras.find((e) => e.id === selectedEraId);
    if (!era) return [];
    return chronicleItems
      .filter((c) => c.focalEraName === era.name)
      .sort((a, b) => (a.eraYear ?? Infinity) - (b.eraYear ?? Infinity));
  }, [chronicleItems, wizardEras, selectedEraId, selectedEra]);

  // Build the narrative config (shared by interactive and headless start)
  const buildConfig = useCallback(async (): Promise<EraNarrativeConfig | null> => {
    const era = wizardEras.find((e) => e.id === selectedEraId);
    if (!era) return null;

    const store = useChronicleStore.getState();
    const eraChrons = chronicleItems.filter((c) => c.focalEraName === era.name);
    const prepBriefs: EraNarrativeConfig["prepBriefs"] = [];
    for (const item of eraChrons) {
      const record = await store.loadChronicle(item.chronicleId);
      if (!record?.historianPrep) continue;
      prepBriefs.push({
        chronicleId: record.chronicleId,
        chronicleTitle: record.title || item.name,
        eraYear: record.eraYear,
        weight: (record.narrativeStyle as Record<string, unknown> | undefined)?.eraNarrativeWeight as string | undefined ||
          narrativeWeightMap[record.narrativeStyleId] as string | undefined || undefined,
        prep: record.historianPrep as string,
      });
    }

    const configStore = useIlluminatorConfigStore.getState();
    const worldDynamics = configStore.worldContext?.worldDynamics || [];
    const cultureIds = configStore.cultureIdentities || {};

    const resolvedDynamics = worldDynamics
      .filter((d: Record<string, unknown>) => (d.eraOverrides as Record<string, unknown> | undefined)?.[era.id])
      .map((d: Record<string, unknown>) => {
        const override = (d.eraOverrides as Record<string, Record<string, unknown>>)[era.id];
        return override.replace ? (override.text as string) : `${(d.text as string) || ""} ${override.text as string}`;
      })
      .filter(Boolean);

    const focalEraInfo = eraTemporalInfo.find((e) => e.id === era.id);
    const focalOrder = focalEraInfo?.order ?? -1;
    const previousEraInfo = focalOrder > 0 ? eraTemporalInfo.find((e) => e.order === focalOrder - 1) : undefined;
    const nextEraInfo = eraTemporalInfo.find((e) => e.order === focalOrder + 1);
    const toSummary = (info: EraTemporalEntry | undefined) =>
      info ? { id: info.id, name: info.name, summary: info.summary || "" } : undefined;

    let prevThesis: string | undefined;
    if (previousEraInfo) {
      const prevNarratives = await getEraNarrativesForEra(simulationRunId, previousEraInfo.id);
      const completedPrev = prevNarratives
        .filter((r) => r.status === "complete" && r.threadSynthesis?.thesis)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      if (completedPrev.length > 0) {
        prevThesis = completedPrev[0].threadSynthesis!.thesis;
      }
    }

    const worldContext = focalEraInfo
      ? {
          focalEra: toSummary(focalEraInfo)!,
          previousEra: toSummary(previousEraInfo),
          nextEra: toSummary(nextEraInfo),
          previousEraThesis: prevThesis,
          resolvedDynamics,
          culturalIdentities: cultureIds as Record<string, Record<string, string>>,
        }
      : undefined;

    return {
      projectId,
      simulationRunId,
      eraId: era.id,
      eraName: era.name,
      tone,
      arcDirection: arcDirection.trim() || undefined,
      historianConfig,
      prepBriefs,
      worldContext,
    };
  }, [selectedEraId, wizardEras, chronicleItems, projectId, simulationRunId, historianConfig, tone, arcDirection, eraTemporalInfo, narrativeWeightMap]);

  const handleStart = useCallback(async () => {
    if (!selectedEra) return;
    const config = await buildConfig();
    if (config) startNarrative(config);
  }, [selectedEra, buildConfig, startNarrative]);

  const handleStartHeadless = useCallback(async () => {
    if (!selectedEra) return;
    const config = await buildConfig();
    if (config) startHeadless(config);
  }, [selectedEra, buildConfig, startHeadless]);

  const handleResume = useCallback(
    async (narrativeId: string) => {
      await resumeNarrative(narrativeId);
    },
    [resumeNarrative]
  );

  const handleDeleteExisting = useCallback(
    async (narrativeId: string) => {
      await deleteEraNarrative(narrativeId);
      setExistingNarratives((prev) => prev.filter((r) => r.narrativeId !== narrativeId));
    },
    []
  );

  const handleClose = useCallback(() => {
    if (isActive && narrative?.status !== "complete") {
      if (narrative?.status === "generating" || narrative?.status === "pending") {
        useFloatingPillStore.getState().minimize({
          id: PILL_ID,
          label: `Era: ${narrative?.eraName || "Narrative"}`,
          statusText: narrative?.currentStep || "Working",
          statusColor: "#f59e0b",
          tabId: "chronicle",
        });
        return;
      }
      cancel();
    }
    onClose();
  }, [isActive, narrative, cancel, onClose]);

  // Update pill status when state changes while minimized
  useEffect(() => {
    if (!isMinimized || !narrative) return;
    const stepLabel: Record<string, string> = { threads: "Threads", generate: "Writing", edit: "Editing" };

    let statusColor: string;
    if (narrative.status === "generating" || narrative.status === "pending") statusColor = "#f59e0b";
    else if (narrative.status === "step_complete") statusColor = "#3b82f6";
    else if (narrative.status === "complete") statusColor = "#10b981";
    else if (narrative.status === "failed") statusColor = "#ef4444";
    else statusColor = "#6b7280";

    let statusText: string;
    if (narrative.status === "complete") statusText = "Complete";
    else if (narrative.status === "failed") statusText = "Failed";
    else statusText = stepLabel[narrative.currentStep] || narrative.currentStep;

    useFloatingPillStore.getState().updatePill(PILL_ID, { statusText, statusColor });
  }, [isMinimized, narrative?.status, narrative?.currentStep, narrative]);

  // Clean up pill when process reaches terminal state
  useEffect(() => {
    if (!narrative || narrative.status === "complete" || narrative.status === "failed" || narrative.status === "cancelled") {
      useFloatingPillStore.getState().remove(PILL_ID);
    }
  }, [narrative?.status, narrative]);

  // Sync narrativeId to modal store so it survives ChroniclePanel unmount
  useEffect(() => {
    if (narrative?.narrativeId) {
      useIlluminatorModals.getState().setEraNarrativeId(narrative.narrativeId);
    }
  }, [narrative?.narrativeId]);

  // Auto-resume from store when modal re-mounts with a stored narrativeId
  useEffect(() => {
    if (isOpen && resumeNarrativeId && !isActive && !narrative) {
      resumeNarrative(resumeNarrativeId);
    }
  }, [isOpen, resumeNarrativeId, isActive, narrative, resumeNarrative]);

  // Resolve thread names for movement display
  const synthesis = narrative?.threadSynthesis;
  const threadNameMap = useMemo(() => {
    if (!synthesis) return {};
    const map: Record<string, string> = {};
    for (const t of synthesis.threads) {
      map[t.threadId] = t.name;
    }
    return map;
  }, [synthesis]);

  // Resolve versioned content from the narrative record
  const resolved = useMemo((): ResolvedContent => {
    if (!narrative) return { content: undefined, versions: [], activeVersionId: undefined };
    return resolveActiveContent(narrative);
  }, [narrative]);

  // Sync selectedVersionId using ref-based pattern (no effect-setState)
  const prevActiveVersionRef = useRef(resolved.activeVersionId);
  const prevVersionsLengthRef = useRef(resolved.versions.length);

  if (
    resolved.activeVersionId &&
    (prevActiveVersionRef.current !== resolved.activeVersionId ||
     prevVersionsLengthRef.current !== resolved.versions.length)
  ) {
    prevActiveVersionRef.current = resolved.activeVersionId;
    prevVersionsLengthRef.current = resolved.versions.length;
    if (!selectedVersionId || !resolved.versions.some((v) => v.versionId === selectedVersionId)) {
      setSelectedVersionId(resolved.activeVersionId);
    }
  }

  if (!isOpen) return null;
  if (isMinimized) return null;

  const isGenerating = narrative?.status === "pending" || narrative?.status === "generating";
  const isStepComplete = narrative?.status === "step_complete";
  const isFailed = narrative?.status === "failed";
  const isComplete = narrative?.status === "complete";
  const narrativeContent = narrative?.narrative;

  const viewedVersion =
    resolved.versions.find((v) => v.versionId === selectedVersionId) ||
    resolved.versions[resolved.versions.length - 1];
  const viewedContent = viewedVersion?.content || resolved.content;
  const viewedWordCount = viewedVersion?.wordCount || 0;

  const showSetup = !isActive && !narrative;
  const showThreadReview = isStepComplete && narrative?.currentStep === "threads" && !!synthesis;
  const showNarrativeReview = isStepComplete && narrative?.currentStep === "generate" && !!(viewedContent || narrativeContent);
  const showEditReview = isStepComplete && narrative?.currentStep === "edit" && !!(viewedContent || narrativeContent);

  const handleMinimize = () => {
    useFloatingPillStore.getState().minimize({
      id: PILL_ID,
      label: `Era: ${narrative?.eraName || "Narrative"}`,
      statusText: isGenerating ? narrative?.currentStep || "Working" : "Review",
      statusColor: isGenerating ? "#f59e0b" : "#3b82f6",
      tabId: "chronicle",
    });
  };

  const handleRerunCopyEdit = () => {
    setSelectedVersionId("");
    rerunCopyEdit();
  };

  return (
    <div
      className="era-narr-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
    >
      <div className="era-narr-modal">
        {/* Header */}
        <div className="era-narr-header">
          <span className="era-narr-header-title">
            {narrative?.eraName ? `Era Narrative: ${narrative.eraName}` : "Era Narrative"}
          </span>
          <div className="era-narr-header-actions">
            {isActive && !isComplete && (
              <button onClick={handleMinimize} className="illuminator-button era-narr-header-minimize-btn" title="Minimize to pill">
                ―
              </button>
            )}
            <button onClick={handleClose} className="era-narr-header-close-btn">
              {"\u2715"}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="era-narr-body">
          {showSetup && (
            <SetupSection
              eraOptions={eraOptions}
              selectedEraId={selectedEraId}
              selectedEra={selectedEra}
              onSelectEra={setSelectedEraId}
              previousEraThesis={previousEraThesis}
              eraChronicles={eraChronicles}
              narrativeWeightMap={narrativeWeightMap}
              existingNarratives={existingNarratives}
              onResume={handleResume}
              onDeleteExisting={handleDeleteExisting}
              tone={tone}
              onSetTone={setTone}
              arcDirection={arcDirection}
              onSetArcDirection={setArcDirection}
              onStart={() => void handleStart()}
              onStartHeadless={() => void handleStartHeadless()}
            />
          )}

          {/* Generating */}
          {isGenerating && (
            <div className="era-narr-generating">
              <div className="era-narr-generating-status">
                {narrative?.currentStep === "threads" && "Identifying narrative threads..."}
                {narrative?.currentStep === "generate" && "Writing era narrative..."}
                {narrative?.currentStep === "edit" && "Editing era narrative..."}
              </div>
              <div className="era-narr-generating-era">{narrative?.eraName}</div>
            </div>
          )}

          {/* Failed */}
          {isFailed && (
            <div className="era-narr-aborted">
              <ErrorMessage title="Generation failed" message={narrative?.error || ""} className="era-narr-aborted-error" />
              <button onClick={cancel} className="illuminator-button">
                Dismiss
              </button>
            </div>
          )}

          {/* Thread Synthesis Review */}
          {showThreadReview && synthesis && (
            <ThreadReviewSection synthesis={synthesis} threadNameMap={threadNameMap} />
          )}

          {/* Narrative Review */}
          {showNarrativeReview && (
            <>
              <div className="era-narr-content-header">
                <div className="era-narr-content-title">Era Narrative</div>
                <span className="era-narr-content-meta">{viewedWordCount.toLocaleString()} words</span>
              </div>
              <div className="era-narr-content-viewer">{viewedContent}</div>
            </>
          )}

          {/* Edit Review */}
          {showEditReview && (
            <>
              <div className="era-narr-content-header">
                <div className="era-narr-content-title">Era Narrative (edited)</div>
                <span className="era-narr-content-meta">{viewedWordCount.toLocaleString()} words</span>
              </div>
              <div className="era-narr-content-viewer">{viewedContent}</div>
            </>
          )}

          {/* Complete */}
          {isComplete && (
            <CompleteSection
              narrative={narrative!}
              resolved={resolved}
              selectedVersionId={selectedVersionId}
              onSelectVersion={setSelectedVersionId}
              viewedVersion={viewedVersion}
              viewedContent={viewedContent}
              viewedWordCount={viewedWordCount}
              deleteVersion={deleteVersion}
              setActiveVersion={setActiveVersion}
            />
          )}
        </div>

        {/* Footer */}
        {(showThreadReview || showNarrativeReview || showEditReview || isComplete) && (
          <div className="era-narr-footer">
            <div className="era-narr-footer-cost">
              {narrative?.totalActualCost ? `$${narrative.totalActualCost.toFixed(4)}` : ""}
            </div>
            <div className="era-narr-footer-actions">
              {!isComplete && (
                <button onClick={cancel} className="illuminator-button">
                  Cancel
                </button>
              )}

              {showThreadReview && (
                <button onClick={advanceStep} className="illuminator-button era-narr-footer-primary-btn">
                  Generate Narrative
                </button>
              )}

              {showNarrativeReview && (
                <>
                  <button onClick={skipEdit} className="illuminator-button">
                    Skip Edit
                  </button>
                  <button onClick={advanceStep} className="illuminator-button era-narr-footer-primary-btn">
                    Copy Edit
                  </button>
                </>
              )}

              {showEditReview && (
                <button onClick={advanceStep} className="illuminator-button era-narr-footer-primary-btn">
                  Finish
                </button>
              )}

              {isComplete && (
                <>
                  <button
                    onClick={handleRerunCopyEdit}
                    className="illuminator-button era-narr-footer-rerun-btn"
                    title="Re-run the copy edit pass on the latest version"
                  >
                    Re-run Copy Edit
                  </button>
                  <button onClick={handleClose} className="illuminator-button era-narr-footer-primary-btn">
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
