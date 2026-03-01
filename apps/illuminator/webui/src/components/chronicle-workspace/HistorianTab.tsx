import React, { useMemo, useCallback } from "react";
import HistorianMarginNotes from "../HistorianMarginNotes";
import HistorianToneSelector, { TONE_META } from "../HistorianToneSelector";
import { computeBackportProgress } from "../../lib/chronicleTypes";
import type { ChronicleRecord } from "../../lib/chronicleTypes";
import type { HistorianTone } from "../../lib/historianTypes";
import "./HistorianTab.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ToneMeta {
  label: string;
  symbol: string;
  description: string;
}

interface BackportLoreButtonProps {
  item: ChronicleRecord;
  onBackportLore: () => void;
  isGenerating: boolean;
}

interface HistorianTabProps {
  item: ChronicleRecord;
  isGenerating: boolean;
  isHistorianActive: boolean;
  onHistorianReview?: (tone: HistorianTone) => void;
  onSetAssignedTone?: (tone: HistorianTone) => void;
  onDetectTone?: () => void;
  onUpdateHistorianNote?: (
    targetType: string,
    chronicleId: string,
    noteId: string,
    updates: Record<string, unknown>,
  ) => void;
  onBackportLore?: () => void;
  onGeneratePrep?: () => void;
}

// ---------------------------------------------------------------------------
// ANNOTATION_TONES — the subset surfaced in tone-assignment buttons
// ---------------------------------------------------------------------------

const ANNOTATION_TONES: HistorianTone[] = [
  "witty",
  "weary",
  "elegiac",
  "cantankerous",
  "rueful",
  "conspiratorial",
  "bemused",
];

// ---------------------------------------------------------------------------
// BackportLoreButton
// ---------------------------------------------------------------------------

function BackportLoreButton({ item, onBackportLore, isGenerating }: BackportLoreButtonProps) {
  const { done, total } = useMemo(() => computeBackportProgress(item), [item]);

  const allDone = done > 0 && done === total;
  const partial = done > 0 && done < total;

  let label = "Backport Lore to Cast";
  let tooltip =
    "Extract new lore from this chronicle and update cast member summaries/descriptions";
  if (allDone) {
    label = `Re-backport Lore (${done}/${total})`;
    tooltip = "Re-run lore backport for this chronicle";
  } else if (partial) {
    label = `Continue Backport (${done}/${total})`;
    tooltip = `${total - done} entities remaining`;
  }

  return (
    <div className="htab-backport-row">
      <button
        onClick={onBackportLore}
        disabled={isGenerating}
        className="ilu-action-btn htab-backport-btn"
        title={tooltip}
      >
        {label}
      </button>
      {done > 0 && (
        <span
          className={`htab-backport-status ${allDone ? "htab-backport-status-complete" : "htab-backport-status-partial"}`}
          title={`${done}/${total} entities backported`}
        >
          &#x21C4; {done}/{total}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToneRankingDisplay — extracted from HistorianTab to reduce complexity
// ---------------------------------------------------------------------------

interface ToneRankingDisplayProps {
  ranking: HistorianTone[];
  rationales?: Record<string, string>;
  rationale?: string;
}

function ToneRankingDisplay({ ranking, rationales, rationale }: ToneRankingDisplayProps) {
  return (
    <div className="htab-tone-ranking">
      Ranked:{" "}
      {ranking.map((tone, i) => {
        const meta = TONE_META[tone] as ToneMeta | undefined;
        const perTone = rationales?.[tone];
        const opacityValue = i === 0 ? 1 : i === 1 ? 0.6 : 0.4;
        return (
          <span
            key={tone}
            className="htab-tone-rank-item"
            title={perTone ?? rationale ?? undefined}
            style={
              { "--htab-rank-opacity": opacityValue } as React.CSSProperties
            }
          >
            {i > 0 ? " > " : ""}
            {meta?.label ?? tone}
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToneAssignmentSection — extracted to reduce HistorianTab complexity
// ---------------------------------------------------------------------------

interface ToneAssignmentSectionProps {
  item: ChronicleRecord;
  isGenerating: boolean;
  onSetAssignedTone: (tone: HistorianTone) => void;
  onDetectTone?: () => void;
}

function ToneAssignmentSection({
  item,
  isGenerating,
  onSetAssignedTone,
  onDetectTone,
}: ToneAssignmentSectionProps) {
  return (
    <div className="ilu-section viewer-section htab-section-spacing">
      <div className="htab-tone-header">
        <div className="viewer-section-title htab-section-title-local">Tone</div>
        {item.toneRanking?.ranking && (
          <ToneRankingDisplay
            ranking={item.toneRanking.ranking}
            rationales={item.toneRanking.rationales}
            rationale={item.toneRanking.rationale}
          />
        )}
        {onDetectTone && (
          <button
            onClick={onDetectTone}
            disabled={isGenerating}
            className="htab-tone-detect-btn"
            title="Run LLM tone detection for this chronicle"
          >
            Detect
          </button>
        )}
      </div>
      <div className="htab-tone-buttons">
        {ANNOTATION_TONES.map((tone) => {
          const meta = TONE_META[tone] as ToneMeta | undefined;
          const isAssigned = item.assignedTone === tone;
          const perTone = item.toneRanking?.rationales?.[tone];
          return (
            <button
              key={tone}
              onClick={() => onSetAssignedTone(tone)}
              className={`htab-tone-btn ${isAssigned ? "htab-tone-btn-active" : ""}`}
              title={perTone ?? meta?.description ?? tone}
            >
              {meta?.symbol} {meta?.label ?? tone}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AnnotateSection — extracted to reduce HistorianTab complexity
// ---------------------------------------------------------------------------

interface AnnotateSectionProps {
  item: ChronicleRecord;
  isGenerating: boolean;
  isHistorianActive: boolean;
  onHistorianReview: (tone: HistorianTone) => void;
}

function AnnotateSection({
  item,
  isGenerating,
  isHistorianActive,
  onHistorianReview,
}: AnnotateSectionProps) {
  const handleSelectTone = useCallback(
    (tone: HistorianTone) => onHistorianReview(tone),
    [onHistorianReview],
  );

  const handleAnnotateClick = useCallback(() => {
    if (item.assignedTone) {
      onHistorianReview(item.assignedTone);
    }
  }, [item.assignedTone, onHistorianReview]);

  const assignedMeta = item.assignedTone
    ? (TONE_META[item.assignedTone] as ToneMeta | undefined)
    : undefined;

  return (
    <div className="ilu-section viewer-section htab-section-spacing">
      <div className="viewer-section-title htab-section-title-local htab-section-title-mb12">
        Annotate
      </div>
      <div className="htab-annotate-row">
        {item.assignedTone && assignedMeta && (
          <button
            onClick={handleAnnotateClick}
            disabled={isGenerating || isHistorianActive}
            className="ilu-action-btn htab-annotate-btn"
            title={`Run historian review with assigned tone: ${assignedMeta.label ?? item.assignedTone}`}
          >
            <span className="htab-annotate-btn-symbol">
              {assignedMeta.symbol ?? "?"}
            </span>
            {(item.historianNotes?.length ?? 0) > 0 ? "Re-annotate" : "Annotate"} (
            {assignedMeta.label ?? item.assignedTone})
          </button>
        )}
        <HistorianToneSelector
          onSelect={handleSelectTone}
          disabled={isGenerating || isHistorianActive}
          hasNotes={(item.historianNotes?.length ?? 0) > 0}
          label={item.assignedTone ? "Override" : undefined}
        />
        {!item.assignedTone && (
          <div className="htab-annotate-hint">
            Select a tone to generate historian margin notes.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HistorianPrepSection — extracted to reduce HistorianTab complexity
// ---------------------------------------------------------------------------

interface HistorianPrepSectionProps {
  item: ChronicleRecord;
  isGenerating: boolean;
  onGeneratePrep: () => void;
}

function HistorianPrepSection({ item, isGenerating, onGeneratePrep }: HistorianPrepSectionProps) {
  return (
    <div className="ilu-section viewer-section htab-section-spacing">
      <div className="viewer-section-title htab-section-title-local htab-section-title-mb8">
        Historian Prep
      </div>
      <div className="htab-prep-description">
        Private reading notes in the historian&apos;s voice — observations and thematic threads for
        era narrative input.
      </div>
      <div className="htab-prep-actions">
        <button
          onClick={onGeneratePrep}
          disabled={isGenerating}
          className="ilu-action-btn htab-prep-btn"
          title={
            item.historianPrep
              ? "Regenerate historian reading notes for this chronicle"
              : "Generate historian reading notes for this chronicle"
          }
        >
          {item.historianPrep ? "Regenerate Prep Brief" : "Generate Prep Brief"}
        </button>
        {item.historianPrepGeneratedAt && (
          <span
            className="htab-prep-date"
            title={`Generated ${new Date(item.historianPrepGeneratedAt).toLocaleString()}`}
          >
            Generated {new Date(item.historianPrepGeneratedAt).toLocaleDateString()}
          </span>
        )}
      </div>
      {item.historianPrep && <div className="htab-prep-content">{item.historianPrep}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HistorianTab — main component
// ---------------------------------------------------------------------------

export default function HistorianTab({
  item,
  isGenerating,
  isHistorianActive,
  onHistorianReview,
  onSetAssignedTone,
  onDetectTone,
  onUpdateHistorianNote,
  onBackportLore,
  onGeneratePrep,
}: HistorianTabProps) {
  const handleUpdateNote = useCallback(
    (noteId: string, updates: Record<string, unknown>) => {
      onUpdateHistorianNote?.("chronicle", item.chronicleId, noteId, updates);
    },
    [onUpdateHistorianNote, item.chronicleId],
  );

  const hasNoTools =
    !onHistorianReview &&
    !onBackportLore &&
    !onGeneratePrep &&
    (item.historianNotes?.length ?? 0) <= 0;

  return (
    <div>
      {/* Tone Assignment */}
      {onSetAssignedTone && (
        <ToneAssignmentSection
          item={item}
          isGenerating={isGenerating}
          onSetAssignedTone={onSetAssignedTone}
          onDetectTone={onDetectTone}
        />
      )}

      {/* Historian Review */}
      {onHistorianReview && (
        <AnnotateSection
          item={item}
          isGenerating={isGenerating}
          isHistorianActive={isHistorianActive}
          onHistorianReview={onHistorianReview}
        />
      )}

      {/* Margin Notes */}
      {(item.historianNotes?.length ?? 0) > 0 && (
        <div className="htab-margin-notes">
          <HistorianMarginNotes
            notes={item.historianNotes}
            sourceText={item.finalContent}
            onUpdateNote={onUpdateHistorianNote ? handleUpdateNote : undefined}
          />
        </div>
      )}

      {/* Historian Prep */}
      {onGeneratePrep && (
        <HistorianPrepSection
          item={item}
          isGenerating={isGenerating}
          onGeneratePrep={onGeneratePrep}
        />
      )}

      {/* Lore Backport */}
      {onBackportLore && (
        <div className="ilu-section viewer-section htab-section-spacing">
          <div className="htab-lore-title">Lore Integration</div>
          <BackportLoreButton
            item={item}
            onBackportLore={onBackportLore}
            isGenerating={isGenerating}
          />
        </div>
      )}

      {hasNoTools && (
        <div className="ilu-empty htab-empty">
          No historian tools available for this chronicle.
        </div>
      )}
    </div>
  );
}
