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

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useChronicleStore } from '../lib/db/chronicleStore';
import { useEraNarrative } from '../hooks/useEraNarrative';
import { useIlluminatorConfigStore } from '../lib/db/illuminatorConfigStore';
import { useEraTemporalInfo } from '../lib/db/indexSelectors';
import { useFloatingPillStore } from '../lib/db/floatingPillStore';
import { useIlluminatorModals } from '../lib/db/modalStore';
import { getEraNarrativesForEra, deleteEraNarrative, resolveActiveContent } from '../lib/db/eraNarrativeRepository';

const PILL_ID = 'era-narrative';

const TONE_OPTIONS = [
  { value: 'witty', label: 'Witty', description: 'Sly, dry, finds the dark comic' },
  { value: 'cantankerous', label: 'Cantankerous', description: 'Irritable energy, argues with the dead' },
  { value: 'bemused', label: 'Bemused', description: 'Puzzled and delighted by absurdity' },
  { value: 'defiant', label: 'Defiant', description: 'Proud of what was attempted' },
  { value: 'sardonic', label: 'Sardonic', description: 'Sharp irony, names the pattern' },
  { value: 'tender', label: 'Tender', description: 'Lingers on what survived' },
  { value: 'hopeful', label: 'Hopeful', description: 'Reads for what was seeded' },
  { value: 'enthusiastic', label: 'Enthusiastic', description: 'Thrilled by scale and ambition' },
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
  const [selectedEraId, setSelectedEraId] = useState('');
  const [tone, setTone] = useState('witty');
  const [arcDirection, setArcDirection] = useState('');
  const [existingNarratives, setExistingNarratives] = useState([]);
  const [previousEraThesis, setPreviousEraThesis] = useState(null);
  const [selectedVersionId, setSelectedVersionId] = useState('');
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
        .filter((r) => r.status !== 'cancelled')
        .sort((a, b) => b.updatedAt - a.updatedAt);
      setExistingNarratives(resumable);
    });

    // Look up thesis from previous era's completed narrative
    const focalInfo = eraTemporalInfo.find((e) => e.id === selectedEraId);
    const focalOrder = focalInfo?.order ?? -1;
    const prevInfo = focalOrder > 0 ? eraTemporalInfo.find((e) => e.order === focalOrder - 1) : undefined;
    if (prevInfo) {
      getEraNarrativesForEra(simulationRunId, prevInfo.id).then((prevRecords) => {
        const completed = prevRecords
          .filter((r) => r.status === 'complete' && r.threadSynthesis?.thesis)
          .sort((a, b) => b.updatedAt - a.updatedAt);
        setPreviousEraThesis(completed.length > 0
          ? { eraName: prevInfo.name, thesis: completed[0].threadSynthesis.thesis }
          : null);
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
        weight: record.narrativeStyle?.eraNarrativeWeight || narrativeWeightMap[record.narrativeStyleId] || undefined,
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
        return override.replace ? override.text : `${d.text || ''} ${override.text}`;
      })
      .filter(Boolean);

    // Find focal + adjacent eras from temporal info
    const focalEraInfo = eraTemporalInfo.find((e) => e.id === era.id);
    const focalOrder = focalEraInfo?.order ?? -1;
    const previousEraInfo = focalOrder > 0
      ? eraTemporalInfo.find((e) => e.order === focalOrder - 1)
      : undefined;
    const nextEraInfo = eraTemporalInfo.find((e) => e.order === focalOrder + 1);

    const toSummary = (info) => info ? { id: info.id, name: info.name, summary: info.summary || '' } : undefined;

    // Look up the previous era's completed narrative thesis for continuity
    let previousEraThesis;
    if (previousEraInfo) {
      const prevNarratives = await getEraNarrativesForEra(simulationRunId, previousEraInfo.id);
      const completedPrev = prevNarratives
        .filter((r) => r.status === 'complete' && r.threadSynthesis?.thesis)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      if (completedPrev.length > 0) {
        previousEraThesis = completedPrev[0].threadSynthesis.thesis;
      }
    }

    const worldContext = focalEraInfo ? {
      focalEra: toSummary(focalEraInfo),
      previousEra: toSummary(previousEraInfo),
      nextEra: toSummary(nextEraInfo),
      previousEraThesis,
      resolvedDynamics,
      culturalIdentities: cultureIds,
    } : undefined;

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
  }, [selectedEraId, wizardEras, chronicleItems, projectId, simulationRunId, historianConfig, tone, arcDirection, eraTemporalInfo]);

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
  const handleResume = useCallback(async (narrativeId) => {
    await resumeNarrative(narrativeId);
  }, [resumeNarrative]);

  // Delete an existing narrative from the list
  const handleDeleteExisting = useCallback(async (narrativeId) => {
    await deleteEraNarrative(narrativeId);
    setExistingNarratives((prev) => prev.filter((r) => r.narrativeId !== narrativeId));
  }, []);

  const handleClose = useCallback(() => {
    if (isActive && narrative?.status !== 'complete') {
      if (narrative?.status === 'generating' || narrative?.status === 'pending') {
        // Minimize instead of closing — keep isOpen true so pill can restore
        useFloatingPillStore.getState().minimize({
          id: PILL_ID,
          label: `Era: ${narrative?.eraName || 'Narrative'}`,
          statusText: narrative?.currentStep || 'Working',
          statusColor: '#f59e0b',
          tabId: 'chronicle',
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
    const stepLabel = { threads: 'Threads', generate: 'Writing', edit: 'Editing' };
    const statusColor = narrative.status === 'generating' || narrative.status === 'pending' ? '#f59e0b'
      : narrative.status === 'step_complete' ? '#3b82f6'
      : narrative.status === 'complete' ? '#10b981'
      : narrative.status === 'failed' ? '#ef4444'
      : '#6b7280';
    const statusText = narrative.status === 'complete' ? 'Complete'
      : narrative.status === 'failed' ? 'Failed'
      : stepLabel[narrative.currentStep] || narrative.currentStep;
    useFloatingPillStore.getState().updatePill(PILL_ID, { statusText, statusColor });
  }, [isMinimized, narrative?.status, narrative?.currentStep]);

  // Clean up pill when process reaches terminal state
  useEffect(() => {
    if (!narrative || narrative.status === 'complete' || narrative.status === 'failed' || narrative.status === 'cancelled') {
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

  const isGenerating = narrative?.status === 'pending' || narrative?.status === 'generating';
  const isStepComplete = narrative?.status === 'step_complete';
  const isFailed = narrative?.status === 'failed';
  const isComplete = narrative?.status === 'complete';
  const narrativeContent = narrative?.narrative;

  // Currently viewed version (for version selector)
  const viewedVersion = resolved.versions.find((v) => v.versionId === selectedVersionId)
    || resolved.versions[resolved.versions.length - 1];
  const viewedContent = viewedVersion?.content || resolved.content;
  const viewedWordCount = viewedVersion?.wordCount || 0;

  // Determine what to show
  const showSetup = !isActive && !narrative;
  const showThreadReview = isStepComplete && narrative?.currentStep === 'threads' && synthesis;
  const showNarrativeReview = isStepComplete && narrative?.currentStep === 'generate' && (viewedContent || narrativeContent);
  const showEditReview = isStepComplete && narrative?.currentStep === 'edit' && (viewedContent || narrativeContent);

  // Word count from resolved version
  const wordCount = viewedWordCount || narrativeContent?.editedWordCount || narrativeContent?.wordCount || 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.5)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          width: '700px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontWeight: 600, fontSize: '15px' }}>
            {narrative?.eraName
              ? `Era Narrative: ${narrative.eraName}`
              : 'Era Narrative'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isActive && !isComplete && (
              <button
                onClick={() => useFloatingPillStore.getState().minimize({
                  id: PILL_ID,
                  label: `Era: ${narrative?.eraName || 'Narrative'}`,
                  statusText: isGenerating ? (narrative?.currentStep || 'Working') : 'Review',
                  statusColor: isGenerating ? '#f59e0b' : '#3b82f6',
                  tabId: 'chronicle',
                })}
                className="illuminator-button"
                style={{ padding: '2px 8px', fontSize: '11px' }}
                title="Minimize to pill"
              >
                ―
              </button>
            )}
            <button
              onClick={handleClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '18px', color: 'var(--text-muted)', padding: '4px',
              }}
            >{'\u2715'}</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', overflow: 'auto', flex: 1 }}>

          {/* Setup */}
          {showSetup && (
            <>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Era</label>
                <select
                  className="illuminator-select"
                  value={selectedEraId}
                  onChange={(e) => setSelectedEraId(e.target.value)}
                  style={{ width: '100%', fontSize: '13px' }}
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
                <div style={{ padding: '10px', marginBottom: '16px', background: '#fef3c7', borderRadius: '6px', fontSize: '12px', color: '#92400e' }}>
                  No chronicles in this era have historian prep briefs. Run Historian Prep first.
                </div>
              )}

              {selectedEra && selectedEra.preppedCount > 0 && selectedEra.preppedCount < selectedEra.count && (
                <div style={{ padding: '10px', marginBottom: '16px', background: '#fef3c7', borderRadius: '6px', fontSize: '12px', color: '#92400e' }}>
                  {selectedEra.count - selectedEra.preppedCount} chronicles are missing prep briefs. The narrative will be based on {selectedEra.preppedCount} prepped chronicles only.
                </div>
              )}

              {/* Previous era thesis — continuity link */}
              {previousEraThesis && (
                <div style={{ padding: '10px', marginBottom: '16px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '6px', fontSize: '12px' }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '11px' }}>
                    Preceding volume thesis ({previousEraThesis.eraName})
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5 }}>
                    {previousEraThesis.thesis}
                  </div>
                </div>
              )}

              {/* Chronicle enumeration for selected era */}
              {eraChronicles.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Chronicles ({eraChronicles.length})
                  </label>
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: '2px',
                    maxHeight: '200px', overflow: 'auto',
                    border: '1px solid var(--border-color)', borderRadius: '6px',
                    padding: '4px',
                  }}>
                    {eraChronicles.map((c) => {
                      const weight = c.eraNarrativeWeight || narrativeWeightMap[c.narrativeStyleId] || null;
                      const weightSymbol = weight === 'structural' ? '\u25A0'
                        : weight === 'contextual' ? '\u25A1'
                        : weight === 'flavor' ? '\u25CB'
                        : '\u2013';
                      const weightColor = weight === 'structural' ? '#3b82f6'
                        : weight === 'contextual' ? '#f59e0b'
                        : weight === 'flavor' ? '#a855f7'
                        : 'var(--text-muted)';
                      return (
                        <div key={c.chronicleId} style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          padding: '3px 6px', fontSize: '12px',
                          background: 'var(--bg-primary)', borderRadius: '4px',
                          opacity: c.hasHistorianPrep ? 1 : 0.5,
                        }}>
                          <span style={{ color: weightColor, fontSize: '10px', width: '14px', textAlign: 'center' }}
                            title={weight ? `Weight: ${weight}` : 'No weight assigned'}>
                            {weightSymbol}
                          </span>
                          <span style={{ flex: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={c.title || c.name}>
                            {c.title || c.name}
                          </span>
                          {c.eraYear != null && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}
                              title="Era year">
                              Y{c.eraYear}
                            </span>
                          )}
                          {c.narrativeStyleName && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                              title={`Style: ${c.narrativeStyleName}`}>
                              {c.narrativeStyleName}
                            </span>
                          )}
                          <span style={{ color: c.hasHistorianPrep ? '#8b7355' : 'var(--text-muted)', fontSize: '11px', width: '14px', textAlign: 'center' }}
                            title={c.hasHistorianPrep ? 'Has historian prep brief' : 'No prep brief'}>
                            {c.hasHistorianPrep ? '\u270E' : '\u2013'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Existing narratives for this era */}
              {existingNarratives.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Existing Narratives
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {existingNarratives.map((rec) => {
                      const stepLabel = { threads: 'Threads', generate: 'Draft', edit: 'Edit' };
                      const statusIcon = rec.status === 'complete' ? '\u2713'
                        : rec.status === 'failed' ? '\u2717'
                        : rec.status === 'step_complete' ? '\u25CB'
                        : '\u2026';
                      const statusColor = rec.status === 'complete' ? '#10b981'
                        : rec.status === 'failed' ? '#ef4444'
                        : '#f59e0b';
                      const date = new Date(rec.updatedAt);
                      const timeStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                        + ' ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                      const canResume = rec.status !== 'complete';
                      return (
                        <div key={rec.narrativeId} style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '6px 10px',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          fontSize: '12px',
                        }}>
                          <span style={{ color: statusColor, fontWeight: 600 }} title={rec.status}>{statusIcon}</span>
                          <span style={{ flex: 1, color: 'var(--text-secondary)' }}>
                            {rec.status === 'complete' ? 'Complete' : `${stepLabel[rec.currentStep] || rec.currentStep} step`}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{timeStr}</span>
                          {rec.totalActualCost > 0 && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>${rec.totalActualCost.toFixed(3)}</span>
                          )}
                          {canResume && (
                            <button
                              onClick={() => handleResume(rec.narrativeId)}
                              className="illuminator-button"
                              style={{ padding: '2px 8px', fontSize: '11px', fontWeight: 600 }}
                            >
                              Resume
                            </button>
                          )}
                          {!canResume && (
                            <button
                              onClick={() => handleResume(rec.narrativeId)}
                              className="illuminator-button"
                              style={{ padding: '2px 8px', fontSize: '11px' }}
                            >
                              View
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteExisting(rec.narrativeId)}
                            className="illuminator-button"
                            style={{ padding: '2px 6px', fontSize: '11px', color: 'var(--text-muted)' }}
                            title="Delete narrative"
                          >
                            {'\u2715'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Tone</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {TONE_OPTIONS.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTone(t.value)}
                      title={t.description}
                      className="illuminator-button"
                      style={{
                        fontSize: '12px',
                        padding: '4px 10px',
                        background: tone === t.value ? 'var(--accent-primary)' : undefined,
                        color: tone === t.value ? '#fff' : undefined,
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Arc Direction Override (optional) */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Arc Direction <span style={{ fontStyle: 'italic' }}>(optional)</span>
                </label>
                <textarea
                  value={arcDirection}
                  onChange={(e) => setArcDirection(e.target.value)}
                  placeholder="Override the era's narrative arc. When set, the historian's thesis, thread arcs, and register choices must honor this direction."
                  style={{
                    width: '100%',
                    minHeight: '60px',
                    maxHeight: '120px',
                    padding: '8px',
                    fontSize: '12px',
                    lineHeight: 1.5,
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: 'var(--text-secondary)',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleStart}
                  disabled={!selectedEraId || !selectedEra || selectedEra.preppedCount === 0}
                  className="illuminator-button"
                  style={{
                    flex: 1,
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    background: selectedEraId && selectedEra?.preppedCount > 0 ? 'var(--accent-primary)' : undefined,
                    color: selectedEraId && selectedEra?.preppedCount > 0 ? '#fff' : undefined,
                    opacity: selectedEraId && selectedEra?.preppedCount > 0 ? 1 : 0.5,
                  }}
                >
                  Start Narrative
                </button>
                <button
                  onClick={handleStartHeadless}
                  disabled={!selectedEraId || !selectedEra || selectedEra.preppedCount === 0}
                  className="illuminator-button"
                  title="Run all steps without pausing for review"
                  style={{
                    padding: '10px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    opacity: selectedEraId && selectedEra?.preppedCount > 0 ? 1 : 0.5,
                  }}
                >
                  Run Headless
                </button>
              </div>
            </>
          )}

          {/* Generating */}
          {isGenerating && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                {narrative?.currentStep === 'threads' && 'Identifying narrative threads...'}
                {narrative?.currentStep === 'generate' && 'Writing era narrative...'}
                {narrative?.currentStep === 'edit' && 'Editing era narrative...'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {narrative?.eraName}
              </div>
            </div>
          )}

          {/* Failed */}
          {isFailed && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '14px', color: '#ef4444', marginBottom: '8px' }}>
                Generation failed
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                {narrative?.error}
              </div>
              <button onClick={cancel} className="illuminator-button">Dismiss</button>
            </div>
          )}

          {/* Thread Synthesis Review */}
          {showThreadReview && synthesis && (
            <>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Thesis</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  {synthesis.thesis}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Threads ({synthesis.threads.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {synthesis.threads.map((t) => (
                    <div key={t.threadId} style={{
                      padding: '8px 10px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500 }}>{t.name}</span>
                        {t.culturalActors?.length > 0 && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            [{t.culturalActors.join(', ')}]
                          </span>
                        )}
                        {t.register && (
                          <span style={{ fontSize: '11px', color: '#8b7355', fontStyle: 'italic' }}>
                            {t.register}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {t.description}
                      </div>
                      {t.material && (
                        <details style={{ marginTop: '6px' }}>
                          <summary style={{ fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            Material
                          </summary>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5, paddingLeft: '8px', borderLeft: '2px solid var(--border-color)' }}>
                            {t.material}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {synthesis.movements?.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Movement Plan ({synthesis.movements.length} movements)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {synthesis.movements.map((m) => (
                      <div key={m.movementIndex} style={{
                        padding: '8px 10px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 500 }}>Movement {m.movementIndex + 1}</span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            Y{m.yearRange[0]}–Y{m.yearRange[1]}
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                          {m.threadFocus.map(id => threadNameMap[id] || id).join(', ')}
                        </div>
                        {m.worldState && (
                          <div style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '11px' }}>
                            {m.worldState}
                          </div>
                        )}
                        <div style={{ color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>
                          {m.beats}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {synthesis.counterweight && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Counterweight</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {synthesis.counterweight}
                  </div>
                </div>
              )}

              {synthesis.strategicDynamics?.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Strategic Dynamics ({synthesis.strategicDynamics.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {synthesis.strategicDynamics.map((sd, i) => (
                      <div key={i} style={{
                        padding: '6px 10px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {sd.interaction} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>[{sd.actors?.join(', ')}]</span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.5 }}>
                          {sd.dynamic}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {synthesis.quotes?.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Quotes ({synthesis.quotes.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {synthesis.quotes.map((q, i) => (
                      <div key={i} style={{
                        padding: '6px 10px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}>
                        <div style={{ fontStyle: 'italic', color: 'var(--text-primary)' }}>
                          &ldquo;{q.text}&rdquo;
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {q.origin}. {q.context}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {synthesis.motifs?.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Motifs: {synthesis.motifs.join(', ')}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Narrative Review */}
          {showNarrativeReview && (
            <>
              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>
                  Era Narrative
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {viewedWordCount.toLocaleString()} words
                </span>
              </div>
              <div style={{
                padding: '16px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                fontSize: '13px',
                lineHeight: '1.7',
                whiteSpace: 'pre-wrap',
                maxHeight: '400px',
                overflow: 'auto',
                color: 'var(--text-secondary)',
              }}>
                {viewedContent}
              </div>
            </>
          )}

          {/* Edit Review */}
          {showEditReview && (
            <>
              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>
                  Era Narrative (edited)
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {viewedWordCount.toLocaleString()} words
                </span>
              </div>
              <div style={{
                padding: '16px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                fontSize: '13px',
                lineHeight: '1.7',
                whiteSpace: 'pre-wrap',
                maxHeight: '400px',
                overflow: 'auto',
                color: 'var(--text-secondary)',
              }}>
                {viewedContent}
              </div>
            </>
          )}

          {/* Complete — Workspace View */}
          {isComplete && (
            <>
              {/* Version Selector */}
              {resolved.versions.length > 0 && (
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <select
                    value={selectedVersionId || resolved.activeVersionId || ''}
                    onChange={(e) => {
                      setSelectedVersionId(e.target.value);
                      setConfirmingDeleteId(null);
                    }}
                    className="illuminator-select"
                    style={{ width: 'auto', minWidth: '240px', fontSize: '12px', padding: '4px 6px' }}
                  >
                    {resolved.versions.map((v) => {
                      const date = new Date(v.generatedAt);
                      const timeStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                        + ' ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                      const stepLabel = v.step === 'generate' ? 'Draft' : 'Edit';
                      return (
                        <option key={v.versionId} value={v.versionId}>
                          {stepLabel} — {v.wordCount.toLocaleString()} words — {timeStr}
                        </option>
                      );
                    })}
                  </select>

                  {/* Active badge or Make Active button */}
                  {viewedVersion && viewedVersion.versionId === resolved.activeVersionId ? (
                    <span style={{
                      fontSize: '11px', padding: '2px 8px',
                      background: 'rgba(16, 185, 129, 0.15)', color: '#10b981',
                      borderRadius: '999px', fontWeight: 500,
                    }}>
                      Active
                    </span>
                  ) : viewedVersion ? (
                    <button
                      onClick={() => {
                        setActiveVersion(viewedVersion.versionId);
                        setConfirmingDeleteId(null);
                      }}
                      className="illuminator-button"
                      style={{ padding: '2px 8px', fontSize: '11px' }}
                    >
                      Make Active
                    </button>
                  ) : null}

                  {/* Delete version button (cannot delete generate versions) */}
                  {viewedVersion && viewedVersion.step !== 'generate' && (() => {
                    const isConfirming = confirmingDeleteId === viewedVersion.versionId;
                    return (
                      <button
                        onClick={() => {
                          if (isConfirming) {
                            deleteVersion(viewedVersion.versionId);
                            setConfirmingDeleteId(null);
                            // Reset selection to active version
                            setSelectedVersionId(resolved.activeVersionId || '');
                          } else {
                            setConfirmingDeleteId(viewedVersion.versionId);
                          }
                        }}
                        onBlur={() => setConfirmingDeleteId(null)}
                        className="illuminator-button"
                        style={{
                          padding: '2px 8px', fontSize: '11px',
                          background: isConfirming ? '#ef4444' : undefined,
                          color: isConfirming ? '#fff' : 'var(--text-muted)',
                          borderColor: isConfirming ? '#ef4444' : undefined,
                        }}
                        title={isConfirming ? 'Click again to confirm' : 'Delete this version'}
                      >
                        {isConfirming ? 'Confirm Delete' : 'Delete'}
                      </button>
                    );
                  })()}
                </div>
              )}

              {/* Content header */}
              <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>
                  {narrative?.eraName || 'Era Narrative'}
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {viewedWordCount.toLocaleString()} words | ${(narrative?.totalActualCost || 0).toFixed(4)}
                </span>
              </div>

              {/* Content viewer */}
              {viewedContent ? (
                <div style={{
                  padding: '16px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  lineHeight: '1.7',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '400px',
                  overflow: 'auto',
                  color: 'var(--text-secondary)',
                }}>
                  {viewedContent}
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No content available
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {(showThreadReview || showNarrativeReview || showEditReview || isComplete) && (
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {narrative?.totalActualCost ? `$${narrative.totalActualCost.toFixed(4)}` : ''}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {!isComplete && (
                <button onClick={cancel} className="illuminator-button">Cancel</button>
              )}

              {showThreadReview && (
                <button
                  onClick={advanceStep}
                  className="illuminator-button"
                  style={{ background: 'var(--accent-primary)', color: '#fff', fontWeight: 600 }}
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
                    className="illuminator-button"
                    style={{ background: 'var(--accent-primary)', color: '#fff', fontWeight: 600 }}
                  >
                    Copy Edit
                  </button>
                </>
              )}

              {showEditReview && (
                <button
                  onClick={advanceStep}
                  className="illuminator-button"
                  style={{ background: 'var(--accent-primary)', color: '#fff', fontWeight: 600 }}
                >
                  Finish
                </button>
              )}

              {isComplete && (
                <>
                  <button
                    onClick={() => {
                      setSelectedVersionId('');
                      rerunCopyEdit();
                    }}
                    className="illuminator-button"
                    style={{ fontWeight: 500 }}
                    title="Re-run the copy edit pass on the latest version"
                  >
                    Re-run Copy Edit
                  </button>
                  <button
                    onClick={handleClose}
                    className="illuminator-button"
                    style={{ background: 'var(--accent-primary)', color: '#fff', fontWeight: 600 }}
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
