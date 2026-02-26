import React, { useMemo } from "react";
import PropTypes from "prop-types";
import HistorianMarginNotes from "../HistorianMarginNotes";
import HistorianToneSelector, { TONE_META } from "../HistorianToneSelector";
import { computeBackportProgress } from "../../lib/chronicleTypes";
import "./HistorianTab.css";

function BackportLoreButton({ item, onBackportLore, isGenerating }) {
  const { done, total } = useMemo(
    () => computeBackportProgress(item),
    [item.entityBackportStatus, item.roleAssignments, item.lens, item.tertiaryCast]
  );
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
        className="htab-backport-btn"
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

BackportLoreButton.propTypes = {
  item: PropTypes.object,
  onBackportLore: PropTypes.func,
  isGenerating: PropTypes.bool,
};

const ANNOTATION_TONES = [
  "witty",
  "weary",
  "elegiac",
  "cantankerous",
  "rueful",
  "conspiratorial",
  "bemused",
];

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
}) {
  return (
    <div>
      {/* Tone Assignment */}
      {onSetAssignedTone && (
        <div className="htab-section">
          <div className="htab-tone-header">
            <div className="htab-section-title">Tone</div>
            {item.toneRanking?.ranking && (
              <div className="htab-tone-ranking">
                Ranked:{" "}
                {item.toneRanking.ranking.map((tone, i) => {
                  const meta = TONE_META[tone];
                  const perTone = item.toneRanking.rationales?.[tone];
                  return (
                    <span
                      key={i}
                      // eslint-disable-next-line local/no-inline-styles -- dynamic opacity based on rank index
                      style={{ opacity: i === 0 ? 1 : i === 1 ? 0.6 : 0.4 }}
                      title={perTone || item.toneRanking.rationale || undefined}
                    >
                      {i > 0 ? " > " : ""}
                      {meta?.label || tone}
                    </span>
                  );
                })}
              </div>
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
              const meta = TONE_META[tone];
              const isAssigned = item.assignedTone === tone;
              const perTone = item.toneRanking?.rationales?.[tone];
              return (
                <button
                  key={tone}
                  onClick={() => onSetAssignedTone(tone)}
                  className={`htab-tone-btn ${isAssigned ? "htab-tone-btn-active" : ""}`}
                  title={perTone || meta?.description || tone}
                >
                  {meta?.symbol} {meta?.label || tone}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Historian Review */}
      {onHistorianReview && (
        <div className="htab-section">
          <div className="htab-section-title htab-section-title-mb12">Annotate</div>
          <div className="htab-annotate-row">
            {item.assignedTone &&
              (() => {
                const meta = TONE_META[item.assignedTone];
                return (
                  <button
                    onClick={() => onHistorianReview(item.assignedTone)}
                    disabled={isGenerating || isHistorianActive}
                    className="htab-annotate-btn"
                    title={`Run historian review with assigned tone: ${meta?.label || item.assignedTone}`}
                  >
                    <span className="htab-annotate-btn-symbol">{meta?.symbol || "?"}</span>
                    {item.historianNotes?.length > 0 ? "Re-annotate" : "Annotate"} (
                    {meta?.label || item.assignedTone})
                  </button>
                );
              })()}
            <HistorianToneSelector
              onSelect={(tone) => onHistorianReview(tone)}
              disabled={isGenerating || isHistorianActive}
              hasNotes={item.historianNotes?.length > 0}
              label={item.assignedTone ? "Override" : undefined}
            />
            {!item.assignedTone && (
              <div className="htab-annotate-hint">
                Select a tone to generate historian margin notes.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Margin Notes */}
      {item.historianNotes?.length > 0 && (
        <div className="htab-margin-notes">
          <HistorianMarginNotes
            notes={item.historianNotes}
            sourceText={item.finalContent}
            onUpdateNote={
              onUpdateHistorianNote
                ? (noteId, updates) =>
                    onUpdateHistorianNote("chronicle", item.chronicleId, noteId, updates)
                : undefined
            }
          />
        </div>
      )}

      {/* Historian Prep */}
      {onGeneratePrep && (
        <div className="htab-section">
          <div className="htab-section-title htab-section-title-mb8">Historian Prep</div>
          <div className="htab-prep-description">
            Private reading notes in the historian&apos;s voice — observations and thematic threads for
            era narrative input.
          </div>
          <div className="htab-prep-actions">
            <button
              onClick={onGeneratePrep}
              disabled={isGenerating}
              className="htab-prep-btn"
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
      )}

      {/* Lore Backport */}
      {onBackportLore && (
        <div className="htab-section">
          <div className="htab-lore-title">Lore Integration</div>
          <BackportLoreButton
            item={item}
            onBackportLore={onBackportLore}
            isGenerating={isGenerating}
          />
        </div>
      )}

      {!onHistorianReview &&
        !onBackportLore &&
        !onGeneratePrep &&
        (item.historianNotes?.length ?? 0) <= 0 && (
          <div className="htab-empty">No historian tools available for this chronicle.</div>
        )}
    </div>
  );
}

HistorianTab.propTypes = {
  item: PropTypes.object,
  isGenerating: PropTypes.bool,
  isHistorianActive: PropTypes.bool,
  onHistorianReview: PropTypes.func,
  onSetAssignedTone: PropTypes.func,
  onDetectTone: PropTypes.func,
  onUpdateHistorianNote: PropTypes.func,
  onBackportLore: PropTypes.func,
  onGeneratePrep: PropTypes.func,
};
