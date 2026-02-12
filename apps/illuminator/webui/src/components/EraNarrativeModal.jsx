/**
 * EraNarrativeModal — Multi-chapter era narrative generation.
 *
 * States:
 * 1. Setup: pick era + tone, review prep coverage, start
 * 2. Generating: spinner while LLM works
 * 3. Thread synthesis review: thesis, threads, chapter plan
 * 4. Chapter review: read chapter text, advance/edit/skip
 * 5. Chapter edit review: read edited text, advance
 * 6. Title selection: pick from candidates
 * 7. Complete: summary
 */

import { useState, useMemo, useCallback } from 'react';
import { useChronicleStore } from '../lib/db/chronicleStore';
import { useEraNarrative } from '../hooks/useEraNarrative';

const TONE_OPTIONS = [
  { value: 'scholarly', label: 'Scholarly' },
  { value: 'witty', label: 'Witty' },
  { value: 'weary', label: 'Weary' },
  { value: 'forensic', label: 'Forensic' },
  { value: 'elegiac', label: 'Elegiac' },
  { value: 'cantankerous', label: 'Cantankerous' },
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
}) {
  const [selectedEraId, setSelectedEraId] = useState('');
  const [tone, setTone] = useState('weary');
  const [selectedTitle, setSelectedTitleLocal] = useState('');

  const {
    narrative,
    isActive,
    startNarrative,
    advanceStep,
    skipChapterEdit,
    selectTitle,
    cancel,
  } = useEraNarrative(onEnqueue);

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

  // Start narrative
  const handleStart = useCallback(async () => {
    if (!selectedEra) return;
    const era = wizardEras.find((e) => e.id === selectedEraId);
    if (!era) return;

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
        prep: record.historianPrep,
      });
    }

    startNarrative({
      projectId,
      simulationRunId,
      eraId: era.id,
      eraName: era.name,
      tone,
      historianConfig,
      prepBriefs,
    });
  }, [selectedEra, selectedEraId, wizardEras, chronicleItems, projectId, simulationRunId, historianConfig, tone, startNarrative]);

  const handleClose = useCallback(() => {
    if (isActive && narrative?.status !== 'complete') cancel();
    onClose();
  }, [isActive, narrative, cancel, onClose]);

  const handleSelectTitle = useCallback(async () => {
    if (!selectedTitle) return;
    await selectTitle(selectedTitle);
  }, [selectedTitle, selectTitle]);

  if (!isOpen) return null;

  const isGenerating = narrative?.status === 'pending' || narrative?.status === 'generating';
  const isStepComplete = narrative?.status === 'step_complete';
  const isFailed = narrative?.status === 'failed';
  const isComplete = narrative?.status === 'complete';
  const synthesis = narrative?.threadSynthesis;
  const currentChapter = narrative?.chapters?.find((c) => c.chapterIndex === narrative.currentChapterIndex);
  const totalChapters = synthesis?.chapterPlan?.length || 0;

  // Determine what to show
  const showSetup = !isActive && !narrative;
  const showThreadReview = isStepComplete && narrative?.currentStep === 'threads' && synthesis;
  const showChapterReview = isStepComplete && narrative?.currentStep === 'chapter' && currentChapter;
  const showChapterEditReview = isStepComplete && narrative?.currentStep === 'chapter_edit' && currentChapter;
  const showTitleSelection = isStepComplete && narrative?.currentStep === 'title' && narrative?.titleCandidates;

  // Total word count
  const totalWordCount = (narrative?.chapters || []).reduce(
    (sum, ch) => sum + (ch.editedWordCount || ch.wordCount),
    0
  );

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
            {isComplete && narrative?.selectedTitle
              ? narrative.selectedTitle
              : narrative?.eraName
                ? `Era Narrative: ${narrative.eraName}`
                : 'Era Narrative'}
          </span>
          <button
            onClick={handleClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '18px', color: 'var(--text-muted)', padding: '4px',
            }}
          >{'\u2715'}</button>
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

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Tone</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {TONE_OPTIONS.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTone(t.value)}
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

              <button
                onClick={handleStart}
                disabled={!selectedEraId || !selectedEra || selectedEra.preppedCount === 0}
                className="illuminator-button"
                style={{
                  width: '100%',
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
            </>
          )}

          {/* Generating */}
          {isGenerating && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                {narrative?.currentStep === 'threads' && 'Identifying narrative threads...'}
                {narrative?.currentStep === 'chapter' && `Writing chapter ${(narrative?.currentChapterIndex || 0) + 1}...`}
                {narrative?.currentStep === 'chapter_edit' && `Editing chapter ${(narrative?.currentChapterIndex || 0) + 1}...`}
                {narrative?.currentStep === 'title' && 'Generating title candidates...'}
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
                      <div style={{ fontSize: '13px', fontWeight: 500 }}>{t.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {t.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Chapter Plan ({synthesis.chapterPlan.length} chapters)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {synthesis.chapterPlan.map((ch) => (
                    <div key={ch.chapterIndex} style={{
                      padding: '6px 10px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}>
                      <span style={{ fontWeight: 500 }}>{ch.chapterIndex + 1}. {ch.title}</span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
                        Y{ch.yearRange[0]}–Y{ch.yearRange[1]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {synthesis.motifs.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Motifs: {synthesis.motifs.join(', ')}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Chapter Review */}
          {showChapterReview && currentChapter && (
            <>
              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>
                  Chapter {currentChapter.chapterIndex + 1}: {currentChapter.title}
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {currentChapter.wordCount} words
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
                {currentChapter.content}
              </div>
            </>
          )}

          {/* Chapter Edit Review */}
          {showChapterEditReview && currentChapter && (
            <>
              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>
                  Chapter {currentChapter.chapterIndex + 1} (edited): {currentChapter.title}
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {currentChapter.editedWordCount || currentChapter.wordCount} words
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
                {currentChapter.editedContent || currentChapter.content}
              </div>
            </>
          )}

          {/* Title Selection */}
          {showTitleSelection && narrative?.titleCandidates && (
            <>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
                Select a title
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                {narrative.titleCandidates.map((title) => (
                  <button
                    key={title}
                    onClick={() => setSelectedTitleLocal(title)}
                    style={{
                      padding: '10px 14px',
                      background: selectedTitle === title ? 'var(--accent-primary)' : 'var(--bg-primary)',
                      color: selectedTitle === title ? '#fff' : 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: selectedTitle === title ? 600 : 400,
                      textAlign: 'left',
                    }}
                  >
                    {title}
                  </button>
                ))}
              </div>
              {narrative.titleFragments && narrative.titleFragments.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>Fragments</div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {narrative.titleFragments.map((f, i) => (
                      <span key={i} style={{
                        padding: '2px 8px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                      }}>
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Complete */}
          {isComplete && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
                {narrative?.selectedTitle || 'Era Narrative Complete'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                {narrative?.eraName}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                {narrative?.chapters?.length} chapters | {totalWordCount.toLocaleString()} words |
                ${(narrative?.totalActualCost || 0).toFixed(4)}
              </div>
              <button onClick={handleClose} className="illuminator-button" style={{
                background: 'var(--accent-primary)',
                color: '#fff',
                fontWeight: 600,
                padding: '8px 24px',
              }}>
                Close
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {(showThreadReview || showChapterReview || showChapterEditReview || showTitleSelection) && (
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
              <button onClick={cancel} className="illuminator-button">Cancel</button>

              {showThreadReview && (
                <button
                  onClick={advanceStep}
                  className="illuminator-button"
                  style={{ background: 'var(--accent-primary)', color: '#fff', fontWeight: 600 }}
                >
                  Generate Chapter 1
                </button>
              )}

              {showChapterReview && (
                <>
                  <button onClick={skipChapterEdit} className="illuminator-button">
                    {narrative && narrative.currentChapterIndex < totalChapters - 1
                      ? `Skip Edit → Chapter ${narrative.currentChapterIndex + 2}`
                      : 'Skip Edit → Title'}
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

              {showChapterEditReview && (
                <button
                  onClick={advanceStep}
                  className="illuminator-button"
                  style={{ background: 'var(--accent-primary)', color: '#fff', fontWeight: 600 }}
                >
                  {narrative && narrative.currentChapterIndex < totalChapters - 1
                    ? `Generate Chapter ${narrative.currentChapterIndex + 2}`
                    : 'Generate Title'}
                </button>
              )}

              {showTitleSelection && (
                <button
                  onClick={handleSelectTitle}
                  disabled={!selectedTitle}
                  className="illuminator-button"
                  style={{
                    background: selectedTitle ? 'var(--accent-primary)' : undefined,
                    color: selectedTitle ? '#fff' : undefined,
                    fontWeight: 600,
                    opacity: selectedTitle ? 1 : 0.5,
                  }}
                >
                  Finish
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
