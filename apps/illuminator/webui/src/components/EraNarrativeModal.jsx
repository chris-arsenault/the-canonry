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

import React, { useState, useMemo, useCallback, useEffect } from "react";
import PropTypes from "prop-types";
import { useChronicleStore } from "../lib/db/chronicleStore";
import { useEraNarrative } from "../hooks/useEraNarrative";
import { useIlluminatorConfigStore } from "../lib/db/illuminatorConfigStore";
import { useEraTemporalInfo } from "../lib/db/indexSelectors";
import { useFloatingPillStore } from "../lib/db/floatingPillStore";
import { useIlluminatorModals } from "../lib/db/modalStore";
import {
  getEraNarrativesForEra,
  deleteEraNarrative,
  resolveActiveContent,
} from "../lib/db/eraNarrativeRepository";
import "./EraNarrativeModal.css";

const PILL_ID = "era-narrative";

const TONE_OPTIONS = [
  { value: "witty", label: "Witty", description: "Sly, dry, finds the dark comic" },
  {
    value: "cantankerous",
    label: "Cantankerous",
    description: "Irritable energy, argues with the dead",
  },
  { value: "bemused", label: "Bemused", description: "Puzzled and delighted by absurdity" },
  { value: "defiant", label: "Defiant", description: "Proud of what was attempted" },
  { value: "sardonic", label: "Sardonic", description: "Sharp irony, names the pattern" },
  { value: "tender", label: "Tender", description: "Lingers on what survived" },
  { value: "hopeful", label: "Hopeful", description: "Reads for what was seeded" },
  { value: "enthusiastic", label: "Enthusiastic", description: "Thrilled by scale and ambition" },
];

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
}) {
  const [selectedEraId, setSelectedEraId] = useState("");
  const [tone, setTone] = useState("witty");
  const [arcDirection, setArcDirection] = useState("");
  const [existingNarratives, setExistingNarratives] = useState([]);
  const [previousEraThesis, setPreviousEraThesis] = useState(null);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);

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

  // Access world context stores (must be before effects that reference it)
  const eraTemporalInfo = useEraTemporalInfo();

  // Check for existing narratives when era selection changes + look up previous era thesis
  useEffect(() => {
    if (!selectedEraId || !simulationRunId) {
      setExistingNarratives([]);
      setPreviousEraThesis(null);
      return;
    }
    getEraNarrativesForEra(simulationRunId, selectedEraId).then((records) => {
      // Show non-complete records (resumable) and recent completed ones
      const resumable = records
        .filter((r) => r.status !== "cancelled")
        .sort((a, b) => b.updatedAt - a.updatedAt);
      setExistingNarratives(resumable);
    });

    // Look up thesis from previous era's completed narrative
    const focalInfo = eraTemporalInfo.find((e) => e.id === selectedEraId);
    const focalOrder = focalInfo?.order ?? -1;
    const prevInfo =
      focalOrder > 0 ? eraTemporalInfo.find((e) => e.order === focalOrder - 1) : undefined;
    if (prevInfo) {
      getEraNarrativesForEra(simulationRunId, prevInfo.id).then((prevRecords) => {
        const completed = prevRecords
          .filter((r) => r.status === "complete" && r.threadSynthesis?.thesis)
          .sort((a, b) => b.updatedAt - a.updatedAt);
        setPreviousEraThesis(
          completed.length > 0
            ? { eraName: prevInfo.name, thesis: completed[0].threadSynthesis.thesis }
            : null
        );
      });
    } else {
      setPreviousEraThesis(null);
    }
  }, [selectedEraId, simulationRunId, eraTemporalInfo]);

  // Group chronicles by era and count prep coverage
  const eraOptions = useMemo(() => {
    return wizardEras.map((era) => {
      const eraChronicles = chronicleItems.filter((c) => c.focalEraName === era.name);
      const preppedCount = eraChronicles.filter((c) => c.hasHistorianPrep).length;
      return {
        id: era.id,
        name: era.name,
        count: eraChronicles.length,
        preppedCount,
      };
    });
  }, [wizardEras, chronicleItems]);

  const selectedEra = eraOptions.find((e) => e.id === selectedEraId);

  // Build a weight lookup from the live style library (record snapshots may be stale)
  const narrativeWeightMap = useMemo(() => {
    const map = {};
    if (styleLibrary?.narrativeStyles) {
      for (const s of styleLibrary.narrativeStyles) {
        if (s.eraNarrativeWeight) map[s.id] = s.eraNarrativeWeight;
      }
    }
    return map;
  }, [styleLibrary]);

  // Chronicles for the selected era — for the setup enumeration
  const eraChronicles = useMemo(() => {
    if (!selectedEra) return [];
    const era = wizardEras.find((e) => e.id === selectedEraId);
    if (!era) return [];
    return chronicleItems
      .filter((c) => c.focalEraName === era.name)
      .sort((a, b) => (a.eraYear ?? Infinity) - (b.eraYear ?? Infinity));
  }, [chronicleItems, wizardEras, selectedEraId, selectedEra]);

  // Build the narrative config (shared by interactive and headless start)
  const buildConfig = useCallback(async () => {
    const era = wizardEras.find((e) => e.id === selectedEraId);
    if (!era) return null;

    // Load prep briefs from chronicles in this era
    const store = useChronicleStore.getState();
    const eraChronicles = chronicleItems.filter((c) => c.focalEraName === era.name);
    const prepBriefs = [];

    for (const item of eraChronicles) {
      const record = await store.loadChronicle(item.chronicleId);
      if (!record?.historianPrep) continue;
      prepBriefs.push({
        chronicleId: record.chronicleId,
        chronicleTitle: record.title || item.name,
        eraYear: record.eraYear,
        weight:
          record.narrativeStyle?.eraNarrativeWeight ||
          narrativeWeightMap[record.narrativeStyleId] ||
          undefined,
        prep: record.historianPrep,
      });
    }

    // Build world-level context
    const configStore = useIlluminatorConfigStore.getState();
    const worldDynamics = configStore.worldContext?.worldDynamics || [];
    const cultureIds = configStore.cultureIdentities || {};

    // Resolve dynamics for focal era — only include dynamics that have an override for this era
    const resolvedDynamics = worldDynamics
      .filter((d) => d.eraOverrides?.[era.id])
      .map((d) => {
        const override = d.eraOverrides[era.id];
        return override.replace ? override.text : `${d.text || ""} ${override.text}`;
      })
      .filter(Boolean);

    // Find focal + adjacent eras from temporal info
    const focalEraInfo = eraTemporalInfo.find((e) => e.id === era.id);
    const focalOrder = focalEraInfo?.order ?? -1;
    const previousEraInfo =
      focalOrder > 0 ? eraTemporalInfo.find((e) => e.order === focalOrder - 1) : undefined;
    const nextEraInfo = eraTemporalInfo.find((e) => e.order === focalOrder + 1);

    const toSummary = (info) =>
      info ? { id: info.id, name: info.name, summary: info.summary || "" } : undefined;

    // Look up the previous era's completed narrative thesis for continuity
    let previousEraThesis;
    if (previousEraInfo) {
      const prevNarratives = await getEraNarrativesForEra(simulationRunId, previousEraInfo.id);
      const completedPrev = prevNarratives
        .filter((r) => r.status === "complete" && r.threadSynthesis?.thesis)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      if (completedPrev.length > 0) {
        previousEraThesis = completedPrev[0].threadSynthesis.thesis;
      }
    }

    const worldContext = focalEraInfo
      ? {
          focalEra: toSummary(focalEraInfo),
          previousEra: toSummary(previousEraInfo),
          nextEra: toSummary(nextEraInfo),
          previousEraThesis,
          resolvedDynamics,
          culturalIdentities: cultureIds,
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
  }, [
    selectedEraId,
    wizardEras,
    chronicleItems,
    projectId,
    simulationRunId,
    historianConfig,
    tone,
    arcDirection,
    eraTemporalInfo,
  ]);

  // Start interactive narrative
  const handleStart = useCallback(async () => {
    if (!selectedEra) return;
    const config = await buildConfig();
    if (config) startNarrative(config);
  }, [selectedEra, buildConfig, startNarrative]);

  // Start headless narrative (all steps, no pauses)
  const handleStartHeadless = useCallback(async () => {
    if (!selectedEra) return;
    const config = await buildConfig();
    if (config) startHeadless(config);
  }, [selectedEra, buildConfig, startHeadless]);

  // Resume an existing narrative
  const handleResume = useCallback(
    async (narrativeId) => {
      await resumeNarrative(narrativeId);
    },
    [resumeNarrative]
  );

  // Delete an existing narrative from the list
  const handleDeleteExisting = useCallback(async (narrativeId) => {
    await deleteEraNarrative(narrativeId);
    setExistingNarratives((prev) => prev.filter((r) => r.narrativeId !== narrativeId));
  }, []);

  const handleClose = useCallback(() => {
    if (isActive && narrative?.status !== "complete") {
      if (narrative?.status === "generating" || narrative?.status === "pending") {
        // Minimize instead of closing — keep isOpen true so pill can restore
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
    const stepLabel = { threads: "Threads", generate: "Writing", edit: "Editing" };
    let statusColor;
    if (narrative.status === "generating" || narrative.status === "pending") statusColor = "#f59e0b";
    else if (narrative.status === "step_complete") statusColor = "#3b82f6";
    else if (narrative.status === "complete") statusColor = "#10b981";
    else if (narrative.status === "failed") statusColor = "#ef4444";
    else statusColor = "#6b7280";
    let statusText;
    if (narrative.status === "complete") statusText = "Complete";
    else if (narrative.status === "failed") statusText = "Failed";
    else statusText = stepLabel[narrative.currentStep] || narrative.currentStep;
    useFloatingPillStore.getState().updatePill(PILL_ID, { statusText, statusColor });
  }, [isMinimized, narrative?.status, narrative?.currentStep]);

  // Clean up pill when process reaches terminal state
  useEffect(() => {
    if (
      !narrative ||
      narrative.status === "complete" ||
      narrative.status === "failed" ||
      narrative.status === "cancelled"
    ) {
      useFloatingPillStore.getState().remove(PILL_ID);
    }
  }, [narrative?.status]);

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

  // Resolve thread names for movement display (must be before early return)
  const synthesis = narrative?.threadSynthesis;
  const threadNameMap = useMemo(() => {
    if (!synthesis) return {};
    const map = {};
    for (const t of synthesis.threads) {
      map[t.threadId] = t.name;
    }
    return map;
  }, [synthesis]);

  // Resolve versioned content from the narrative record
  const resolved = useMemo(() => {
    if (!narrative) return { content: undefined, versions: [], activeVersionId: undefined };
    return resolveActiveContent(narrative);
  }, [narrative]);

  // Sync selectedVersionId to activeVersionId when versions change
  useEffect(() => {
    if (resolved.activeVersionId) {
      // Reset selection when active version changes (e.g., after re-run edit completes)
      // or when no version is selected yet
      if (!selectedVersionId || !resolved.versions.some((v) => v.versionId === selectedVersionId)) {
        setSelectedVersionId(resolved.activeVersionId);
      }
    }
  }, [resolved.activeVersionId, resolved.versions.length]);

  if (!isOpen) return null;
  if (isMinimized) return null;

  const isGenerating = narrative?.status === "pending" || narrative?.status === "generating";
  const isStepComplete = narrative?.status === "step_complete";
  const isFailed = narrative?.status === "failed";
  const isComplete = narrative?.status === "complete";
  const narrativeContent = narrative?.narrative;

  // Currently viewed version (for version selector)
  const viewedVersion =
    resolved.versions.find((v) => v.versionId === selectedVersionId) ||
    resolved.versions[resolved.versions.length - 1];
  const viewedContent = viewedVersion?.content || resolved.content;
  const viewedWordCount = viewedVersion?.wordCount || 0;

  // Determine what to show
  const showSetup = !isActive && !narrative;
  const showThreadReview = isStepComplete && narrative?.currentStep === "threads" && synthesis;
  const showNarrativeReview =
    isStepComplete && narrative?.currentStep === "generate" && (viewedContent || narrativeContent);
  const showEditReview =
    isStepComplete && narrative?.currentStep === "edit" && (viewedContent || narrativeContent);

  return (
    <div
      className="era-narr-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
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
              <button
                onClick={() =>
                  useFloatingPillStore.getState().minimize({
                    id: PILL_ID,
                    label: `Era: ${narrative?.eraName || "Narrative"}`,
                    statusText: isGenerating ? narrative?.currentStep || "Working" : "Review",
                    statusColor: isGenerating ? "#f59e0b" : "#3b82f6",
                    tabId: "chronicle",
                  })
                }
                className="illuminator-button era-narr-header-minimize-btn"
                title="Minimize to pill"
              >
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
          {/* Setup */}
          {showSetup && (
            <>
              <div className="era-narr-field">
                <label htmlFor="era" className="era-narr-label">Era</label>
                <select id="era"
                  className="illuminator-select era-narr-select-full"
                  value={selectedEraId}
                  onChange={(e) => setSelectedEraId(e.target.value)}
                >
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

              {selectedEra &&
                selectedEra.preppedCount > 0 &&
                selectedEra.preppedCount < selectedEra.count && (
                  <div className="era-narr-warning">
                    {selectedEra.count - selectedEra.preppedCount} chronicles are missing prep
                    briefs. The narrative will be based on {selectedEra.preppedCount} prepped
                    chronicles only.
                  </div>
                )}

              {/* Previous era thesis -- continuity link */}
              {previousEraThesis && (
                <div className="era-narr-thesis-link">
                  <div className="era-narr-thesis-link-label">
                    Preceding volume thesis ({previousEraThesis.eraName})
                  </div>
                  <div className="era-narr-thesis-link-text">{previousEraThesis.thesis}</div>
                </div>
              )}

              {/* Chronicle enumeration for selected era */}
              {eraChronicles.length > 0 && (
                <div className="era-narr-field">
                  <label className="era-narr-label">Chronicles ({eraChronicles.length})</label>
                  <div className="era-narr-chronicle-list">
                    {eraChronicles.map((c) => {
                      const weight =
                        c.eraNarrativeWeight || narrativeWeightMap[c.narrativeStyleId] || null;
                      let weightSymbol;
                      if (weight === "structural") weightSymbol = "\u25A0";
                      else if (weight === "contextual") weightSymbol = "\u25A1";
                      else if (weight === "flavor") weightSymbol = "\u25CB";
                      else weightSymbol = "\u2013";
                      let weightColor;
                      if (weight === "structural") weightColor = "#3b82f6";
                      else if (weight === "contextual") weightColor = "#f59e0b";
                      else if (weight === "flavor") weightColor = "#a855f7";
                      else weightColor = "var(--text-muted)";
                      return (
                        <div
                          key={c.chronicleId}
                          className="era-narr-chronicle-item"
                          // eslint-disable-next-line local/no-inline-styles
                          style={{ opacity: c.hasHistorianPrep ? 1 : 0.5 }}
                        >
                          <span
                            className="era-narr-chronicle-item-weight"
                            // eslint-disable-next-line local/no-inline-styles
                            style={{ color: weightColor }}
                            title={weight ? `Weight: ${weight}` : "No weight assigned"}
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
                            <span
                              className="era-narr-chronicle-item-style"
                              title={`Style: ${c.narrativeStyleName}`}
                            >
                              {c.narrativeStyleName}
                            </span>
                          )}
                          <span
                            className="era-narr-chronicle-item-prep"
                            // eslint-disable-next-line local/no-inline-styles
                            style={{ color: c.hasHistorianPrep ? "#8b7355" : "var(--text-muted)" }}
                            title={
                              c.hasHistorianPrep ? "Has historian prep brief" : "No prep brief"
                            }
                          >
                            {c.hasHistorianPrep ? "\u270E" : "\u2013"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Existing narratives for this era */}
              {existingNarratives.length > 0 && (
                <div className="era-narr-field">
                  <label className="era-narr-label">Existing Narratives</label>
                  <div className="era-narr-existing-list">
                    {existingNarratives.map((rec) => {
                      const stepLabel = { threads: "Threads", generate: "Draft", edit: "Edit" };
                      let statusIcon;
                      if (rec.status === "complete") statusIcon = "\u2713";
                      else if (rec.status === "failed") statusIcon = "\u2717";
                      else if (rec.status === "step_complete") statusIcon = "\u25CB";
                      else statusIcon = "\u2026";
                      let statusColor;
                      if (rec.status === "complete") statusColor = "#10b981";
                      else if (rec.status === "failed") statusColor = "#ef4444";
                      else statusColor = "#f59e0b";
                      const date = new Date(rec.updatedAt);
                      const timeStr =
                        date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
                        " " +
                        date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                      const canResume = rec.status !== "complete";
                      return (
                        <div key={rec.narrativeId} className="era-narr-existing-item">
                          { }
                          <span
                            className="era-narr-existing-item-status"
                            // eslint-disable-next-line local/no-inline-styles -- dynamic color from status
                            style={{ color: statusColor }}
                            title={rec.status}
                          >
                            {statusIcon}
                          </span>
                          <span className="era-narr-existing-item-step">
                            {rec.status === "complete"
                              ? "Complete"
                              : `${stepLabel[rec.currentStep] || rec.currentStep} step`}
                          </span>
                          <span className="era-narr-existing-item-time">{timeStr}</span>
                          {rec.totalActualCost > 0 && (
                            <span className="era-narr-existing-item-cost">
                              ${rec.totalActualCost.toFixed(3)}
                            </span>
                          )}
                          {canResume && (
                            <button
                              onClick={() => handleResume(rec.narrativeId)}
                              className="illuminator-button era-narr-existing-item-resume-btn"
                            >
                              Resume
                            </button>
                          )}
                          {!canResume && (
                            <button
                              onClick={() => handleResume(rec.narrativeId)}
                              className="illuminator-button era-narr-existing-item-view-btn"
                            >
                              View
                            </button>
                          )}
                          <button
                            onClick={() => void handleDeleteExisting(rec.narrativeId)}
                            className="illuminator-button era-narr-existing-item-delete-btn"
                            title="Delete narrative"
                          >
                            {"\u2715"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="era-narr-field-lg">
                <label className="era-narr-label">Tone</label>
                <div className="era-narr-tone-row">
                  {TONE_OPTIONS.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTone(t.value)}
                      title={t.description}
                      className={`illuminator-button era-narr-tone-btn ${tone === t.value ? "era-narr-tone-btn-active" : ""}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Arc Direction Override (optional) */}
              <div className="era-narr-field-lg">
                <label htmlFor="arc-direction" className="era-narr-label">
                  Arc Direction <span className="era-narr-label-optional">(optional)</span>
                </label>
                <textarea id="arc-direction"
                  value={arcDirection}
                  onChange={(e) => setArcDirection(e.target.value)}
                  placeholder="Override the era's narrative arc. When set, the historian's thesis, thread arcs, and register choices must honor this direction."
                  className="era-narr-textarea"
                />
              </div>

              <div className="era-narr-start-row">
                <button
                  onClick={() => void handleStart()}
                  disabled={!selectedEraId || !selectedEra || selectedEra.preppedCount === 0}
                  className={`illuminator-button era-narr-start-btn ${selectedEraId && selectedEra?.preppedCount > 0 ? "era-narr-start-btn-primary" : ""}`}
                  // eslint-disable-next-line local/no-inline-styles
                  style={{ opacity: selectedEraId && selectedEra?.preppedCount > 0 ? 1 : 0.5 }}
                >
                  Start Narrative
                </button>
                <button
                  onClick={() => void handleStartHeadless()}
                  disabled={!selectedEraId || !selectedEra || selectedEra.preppedCount === 0}
                  className="illuminator-button era-narr-headless-btn"
                  title="Run all steps without pausing for review"
                  // eslint-disable-next-line local/no-inline-styles
                  style={{ opacity: selectedEraId && selectedEra?.preppedCount > 0 ? 1 : 0.5 }}
                >
                  Run Headless
                </button>
              </div>
            </>
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
            <div className="era-narr-failed">
              <div className="era-narr-failed-title">Generation failed</div>
              <div className="era-narr-failed-error">{narrative?.error}</div>
              <button onClick={cancel} className="illuminator-button">
                Dismiss
              </button>
            </div>
          )}

          {/* Thread Synthesis Review */}
          {showThreadReview && synthesis && (
            <>
              <div className="era-narr-review-section">
                <div className="era-narr-review-heading">Thesis</div>
                <div className="era-narr-thesis-text">{synthesis.thesis}</div>
              </div>

              <div className="era-narr-review-section">
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
                        {t.register && (
                          <span className="era-narr-thread-card-register">{t.register}</span>
                        )}
                      </div>
                      <div className="era-narr-thread-card-desc">{t.description}</div>
                      {t.material && (
                        <details className="era-narr-thread-card-material">
                          <summary className="era-narr-thread-card-material-summary">
                            Material
                          </summary>
                          <div className="era-narr-thread-card-material-body">{t.material}</div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {synthesis.movements?.length > 0 && (
                <div className="era-narr-review-section">
                  <div className="era-narr-review-heading">
                    Movement Plan ({synthesis.movements.length} movements)
                  </div>
                  <div className="era-narr-movement-list">
                    {synthesis.movements.map((m) => (
                      <div key={m.movementIndex} className="era-narr-movement-card">
                        <div className="era-narr-movement-card-header">
                          <span className="era-narr-movement-card-index">
                            Movement {m.movementIndex + 1}
                          </span>
                          <span className="era-narr-movement-card-range">
                            Y{m.yearRange[0]}–Y{m.yearRange[1]}
                          </span>
                        </div>
                        <div className="era-narr-movement-card-threads">
                          {m.threadFocus.map((id) => threadNameMap[id] || id).join(", ")}
                        </div>
                        {m.worldState && (
                          <div className="era-narr-movement-card-world-state">{m.worldState}</div>
                        )}
                        <div className="era-narr-movement-card-beats">{m.beats}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {synthesis.counterweight && (
                <div className="era-narr-review-section">
                  <div className="era-narr-review-heading">Counterweight</div>
                  <div className="era-narr-counterweight">{synthesis.counterweight}</div>
                </div>
              )}

              {synthesis.strategicDynamics?.length > 0 && (
                <div className="era-narr-review-section">
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

              {synthesis.quotes?.length > 0 && (
                <div className="era-narr-review-section">
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

              {synthesis.motifs?.length > 0 && (
                <div className="era-narr-review-section">
                  <div className="era-narr-motifs">Motifs: {synthesis.motifs.join(", ")}</div>
                </div>
              )}
            </>
          )}

          {/* Narrative Review */}
          {showNarrativeReview && (
            <>
              <div className="era-narr-content-header">
                <div className="era-narr-content-title">Era Narrative</div>
                <span className="era-narr-content-meta">
                  {viewedWordCount.toLocaleString()} words
                </span>
              </div>
              <div className="era-narr-content-viewer">{viewedContent}</div>
            </>
          )}

          {/* Edit Review */}
          {showEditReview && (
            <>
              <div className="era-narr-content-header">
                <div className="era-narr-content-title">Era Narrative (edited)</div>
                <span className="era-narr-content-meta">
                  {viewedWordCount.toLocaleString()} words
                </span>
              </div>
              <div className="era-narr-content-viewer">{viewedContent}</div>
            </>
          )}

          {/* Complete — Workspace View */}
          {isComplete && (
            <>
              {/* Version Selector */}
              {resolved.versions.length > 0 && (
                <div className="era-narr-version-row">
                  <select
                    value={selectedVersionId || resolved.activeVersionId || ""}
                    onChange={(e) => {
                      setSelectedVersionId(e.target.value);
                      setConfirmingDeleteId(null);
                    }}
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

                  {/* Active badge or Make Active button */}
                  {viewedVersion && viewedVersion.versionId === resolved.activeVersionId && (
                    <span className="era-narr-version-active-badge">Active</span>
                  )}
                  {viewedVersion && viewedVersion.versionId !== resolved.activeVersionId && (
                    <button
                      onClick={() => {
                        setActiveVersion(viewedVersion.versionId);
                        setConfirmingDeleteId(null);
                      }}
                      className="illuminator-button era-narr-version-make-active-btn"
                    >
                      Make Active
                    </button>
                  )}

                  {/* Delete version button (cannot delete generate versions) */}
                  {viewedVersion &&
                    viewedVersion.step !== "generate" &&
                    (() => {
                      const isConfirming = confirmingDeleteId === viewedVersion.versionId;
                      return (
                        <button
                          onClick={() => {
                            if (isConfirming) {
                              deleteVersion(viewedVersion.versionId);
                              setConfirmingDeleteId(null);
                              // Reset selection to active version
                              setSelectedVersionId(resolved.activeVersionId || "");
                            } else {
                              setConfirmingDeleteId(viewedVersion.versionId);
                            }
                          }}
                          onBlur={() => setConfirmingDeleteId(null)}
                          className={`illuminator-button era-narr-version-delete-btn ${isConfirming ? "era-narr-version-delete-btn-confirming" : "era-narr-version-delete-btn-normal"}`}
                          title={isConfirming ? "Click again to confirm" : "Delete this version"}
                        >
                          {isConfirming ? "Confirm Delete" : "Delete"}
                        </button>
                      );
                    })()}
                </div>
              )}

              {/* Content header */}
              <div className="era-narr-content-header era-narr-content-header-mb8">
                <div className="era-narr-content-title">
                  {narrative?.eraName || "Era Narrative"}
                </div>
                <span className="era-narr-content-meta">
                  {viewedWordCount.toLocaleString()} words | $
                  {(narrative?.totalActualCost || 0).toFixed(4)}
                </span>
              </div>

              {/* Content viewer */}
              {viewedContent ? (
                <div className="era-narr-content-viewer">{viewedContent}</div>
              ) : (
                <div className="era-narr-no-content">No content available</div>
              )}
            </>
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
                <button
                  onClick={advanceStep}
                  className="illuminator-button era-narr-footer-primary-btn"
                >
                  Generate Narrative
                </button>
              )}

              {showNarrativeReview && (
                <>
                  <button onClick={skipEdit} className="illuminator-button">
                    Skip Edit
                  </button>
                  <button
                    onClick={advanceStep}
                    className="illuminator-button era-narr-footer-primary-btn"
                  >
                    Copy Edit
                  </button>
                </>
              )}

              {showEditReview && (
                <button
                  onClick={advanceStep}
                  className="illuminator-button era-narr-footer-primary-btn"
                >
                  Finish
                </button>
              )}

              {isComplete && (
                <>
                  <button
                    onClick={() => {
                      setSelectedVersionId("");
                      rerunCopyEdit();
                    }}
                    className="illuminator-button era-narr-footer-rerun-btn"
                    title="Re-run the copy edit pass on the latest version"
                  >
                    Re-run Copy Edit
                  </button>
                  <button
                    onClick={handleClose}
                    className="illuminator-button era-narr-footer-primary-btn"
                  >
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

EraNarrativeModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  chronicleItems: PropTypes.array.isRequired,
  wizardEras: PropTypes.array.isRequired,
  projectId: PropTypes.string,
  simulationRunId: PropTypes.string,
  historianConfig: PropTypes.object,
  onEnqueue: PropTypes.func,
  resumeNarrativeId: PropTypes.string,
  styleLibrary: PropTypes.object,
};
