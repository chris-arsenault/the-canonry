/**
 * DescriptionMotifWeaver — Find sentences in entity descriptions that reference
 * ice-memory concepts and rewrite them to incorporate "the ice remembers."
 *
 * Three-phase flow:
 *   1. Scan: load entities, regex-match descriptions for ice-memory concepts,
 *      exclude entities already containing the target phrase
 *   2. Generate: batch candidate sentences to worker via enrichment queue,
 *      get sentence rewrites incorporating the phrase
 *   3. Review & Apply: per-instance accept/reject with diff preview, write back
 *      via applyRevisionPatches
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useEntityNavList } from "../lib/db/entitySelectors";
import { useEntityStore } from "../lib/db/entityStore";
import { applyRevisionPatches } from "../lib/db/entityRepository";
import { getEnqueue } from "../lib/db/enrichmentQueueBridge";
import { useEnrichmentQueueStore } from "../lib/db/enrichmentQueueStore";
import { reloadEntities } from "../hooks/useEntityCrud";
import type { MotifWeavePayload, MotifVariationResult } from "../workers/tasks/motifVariationTask";
import "./DescriptionMotifWeaver.css";

// ============================================================================
// Types
// ============================================================================

interface WeaveCandidate {
  id: string;
  batchIndex: number;
  entityId: string;
  entityName: string;
  /** The full sentence to rewrite */
  sentence: string;
  /** Character position of sentence start in description */
  sentenceStart: number;
  /** Character position of sentence end in description */
  sentenceEnd: number;
  /** What the regex matched within the sentence */
  matchedConcept: string;
  /** Context before the sentence */
  contextBefore: string;
  /** Context after the sentence */
  contextAfter: string;
}

type Phase =
  | "scan"
  | "scanning"
  | "confirm"
  | "generating"
  | "review"
  | "applying"
  | "done"
  | "empty";

const CONTEXT_RADIUS = 150;
const BATCH_SIZE = 25;
const TARGET_PHRASE = "the ice remembers";

// Targets the ice-as-archive concept, not incidental ice mentions.
// Split into two patterns to reduce regex complexity.
const ICE_MEMORY_PRIMARY =
  /ice[\s-]memor(?:y|ies)|the ice preserve[sd]|preserved in the ice|impressions? (?:in|frozen into) the ice/gi;
const ICE_MEMORY_SECONDARY =
  /ice[\s-]testimon|ice[\s-]record|the substrate(?:'s)? (?:record|testimon|memor)/gi;
function _matchesIceMemoryConcept(text: string): RegExpMatchArray | null {
  ICE_MEMORY_PRIMARY.lastIndex = 0;
  ICE_MEMORY_SECONDARY.lastIndex = 0;
  return ICE_MEMORY_PRIMARY.exec(text) || ICE_MEMORY_SECONDARY.exec(text);
}
const ALREADY_HAS_PHRASE = /the ice remembers/i;

// ============================================================================
// Sentence extraction
// ============================================================================

/**
 * Find the sentence boundaries around a regex match position.
 * Sentences end at period-space, period-newline, newline-newline, or string boundary.
 */
function extractSentence(
  text: string,
  matchStart: number,
  matchEnd: number
): { sentence: string; start: number; end: number } {
  // Walk backward to find sentence start
  let start = matchStart;
  while (start > 0) {
    const ch = text[start - 1];
    if (ch === "\n") break;
    if (ch === "." && start > 1 && /\s/.test(text[start])) break;
    start--;
  }
  // Skip leading whitespace
  while (start < matchStart && /\s/.test(text[start])) start++;

  // Walk forward to find sentence end
  let end = matchEnd;
  while (end < text.length) {
    const ch = text[end];
    if (ch === "\n") break;
    if (ch === "." && (end + 1 >= text.length || /\s/.test(text[end + 1]))) {
      end++; // include the period
      break;
    }
    end++;
  }

  return { sentence: text.slice(start, end), start, end };
}

// ============================================================================
// Scan Logic
// ============================================================================

function scanDescriptionForConcepts(
  entityId: string,
  entityName: string,
  description: string,
  startIndex: number
): WeaveCandidate[] {
  // Skip entities that already contain the target phrase
  if (ALREADY_HAS_PHRASE.test(description)) return [];

  const candidates: WeaveCandidate[] = [];
  const seenSentences = new Set<string>(); // dedupe overlapping matches in same sentence
  let idx = startIndex;

  // Collect all matches from both patterns, sorted by index
  const allMatches: RegExpExecArray[] = [];
  for (const pattern of [ICE_MEMORY_PRIMARY, ICE_MEMORY_SECONDARY]) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(description)) !== null) {
      allMatches.push(m);
    }
  }
  allMatches.sort((a, b) => a.index - b.index);
  for (const regexMatch of allMatches) {
    const { sentence, start, end } = extractSentence(
      description,
      regexMatch.index,
      regexMatch.index + regexMatch[0].length
    );

    // Dedupe: if we already have a candidate for this sentence, skip
    const sentenceKey = `${start}:${end}`;
    if (seenSentences.has(sentenceKey)) continue;
    seenSentences.add(sentenceKey);

    const ctxBefore = description.slice(Math.max(0, start - CONTEXT_RADIUS), start);
    const ctxAfter = description.slice(end, Math.min(description.length, end + CONTEXT_RADIUS));

    candidates.push({
      id: `${entityId}:${start}`,
      batchIndex: idx,
      entityId,
      entityName,
      sentence,
      sentenceStart: start,
      sentenceEnd: end,
      matchedConcept: regexMatch[0],
      contextBefore: (start - CONTEXT_RADIUS > 0 ? "\u2026" : "") + ctxBefore,
      contextAfter: ctxAfter + (end + CONTEXT_RADIUS < description.length ? "\u2026" : ""),
    });
    idx++;
  }

  return candidates;
}

// ============================================================================
// Candidate Row
// ============================================================================

function CandidateRow({
  candidate,
  variant,
  accepted,
  onToggle,
}: Readonly<{
  candidate: WeaveCandidate;
  variant?: string;
  accepted: boolean;
  onToggle: () => void;
}>) {
  return (
    <div
      className={`dmw-candidate-row ${accepted ? "dmw-candidate-row-accepted" : "dmw-candidate-row-rejected"}`}
    >
      <input
        type="checkbox"
        checked={accepted}
        onChange={onToggle}
        className="dmw-candidate-checkbox"
      />
      <div className="dmw-candidate-body">
        <span className="dmw-context-text">
          {candidate.contextBefore}
        </span>
        <span
          className={`dmw-original-sentence ${accepted && variant ? "dmw-original-strikethrough" : "dmw-original-neutral"}`}
        >
          {candidate.sentence}
        </span>
        {accepted && variant && (
          <>
            {" "}
            <span className="dmw-variant-text">
              {variant}
            </span>
          </>
        )}
        <span className="dmw-context-text">
          {candidate.contextAfter}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Entity Group
// ============================================================================

function EntityGroup({
  entityName,
  candidates,
  variants,
  decisions,
  onToggle,
  onAcceptAll,
  onRejectAll,
  expanded,
  onToggleExpand,
}: Readonly<{
  entityName: string;
  candidates: WeaveCandidate[];
  variants: Map<string, string>;
  decisions: Record<string, boolean>;
  onToggle: (id: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}>) {
  const acceptCount = candidates.filter((c) => decisions[c.id]).length;

  return (
    <div className="dmw-entity-group">
      <div
        onClick={onToggleExpand}
        className="dmw-entity-group-header"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggleExpand(e); }}
      >
        <span className="dmw-expand-icon">
          {expanded ? "\u25BC" : "\u25B6"}
        </span>
        <span className="dmw-entity-name">
          {entityName}
        </span>
        <span className="dmw-candidate-count">
          {candidates.length} {candidates.length === 1 ? "candidate" : "candidates"}
        </span>
        {acceptCount > 0 && (
          <span className="dmw-accept-count">
            {acceptCount}
            {"\u2713"}
          </span>
        )}
        {candidates.length - acceptCount > 0 && (
          <span className="dmw-reject-count">
            {candidates.length - acceptCount}
            {"\u2717"}
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAcceptAll();
          }}
          title="Accept all in this entity"
          className="dmw-bulk-accept-btn"
        >
          {"all\u2713"}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRejectAll();
          }}
          title="Reject all in this entity"
          className="dmw-bulk-reject-btn"
        >
          {"all\u2717"}
        </button>
      </div>
      {expanded && (
        <div className="dmw-entity-group-body">
          {candidates.map((c) => (
            <CandidateRow
              key={c.id}
              candidate={c}
              variant={variants.get(c.id)}
              accepted={!!decisions[c.id]}
              onToggle={() => onToggle(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Modal
// ============================================================================

export default function DescriptionMotifWeaver({ onClose }: Readonly<{ onClose: () => void }>) {
  const navEntities = useEntityNavList();
  const queue = useEnrichmentQueueStore((s) => s.queue);

  const [phase, setPhase] = useState<Phase>("scan");
  const [candidates, setCandidates] = useState<WeaveCandidate[]>([]);
  const [variants, setVariants] = useState<Map<string, string>>(new Map());
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [resultCount, setResultCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const dispatchTimeRef = useRef<number>(0);
  const candidatesRef = useRef<WeaveCandidate[]>([]);

  useEffect(() => {
    candidatesRef.current = candidates;
  }, [candidates]);

  // --- Scan ---
  const handleScan = useCallback(async () => {
    setPhase("scanning");
    setError(null);

    // Load all entities with descriptions
    const allNavs = navEntities.filter((n) => n.kind !== "era" && n.kind !== "occurrence");
    if (allNavs.length === 0) {
      setPhase("empty");
      return;
    }

    const fullEntities = await useEntityStore.getState().loadEntities(allNavs.map((n) => n.id));

    let globalIndex = 0;
    const allCandidates: WeaveCandidate[] = [];

    for (const entity of fullEntities) {
      if (!entity.description) continue;
      const entityCandidates = scanDescriptionForConcepts(
        entity.id,
        entity.name,
        entity.description,
        globalIndex
      );
      allCandidates.push(...entityCandidates);
      globalIndex += entityCandidates.length;
    }

    if (allCandidates.length === 0) {
      setPhase("empty");
      return;
    }

    setCandidates(allCandidates);
    // Default: reject all (light touch — user opts in)
    const initial: Record<string, boolean> = {};
    for (const c of allCandidates) initial[c.id] = false;
    setDecisions(initial);
    if (allCandidates.length > 0) {
      setExpandedGroups(new Set([allCandidates[0].entityId]));
    }

    // Stop for confirmation before LLM calls
    setPhase("confirm");
  }, [navEntities]);

  // --- Generate ---
  const handleGenerate = useCallback((scanCandidates: WeaveCandidate[]) => {
    setPhase("generating");

    const batches: WeaveCandidate[][] = [];
    for (let i = 0; i < scanCandidates.length; i += BATCH_SIZE) {
      batches.push(scanCandidates.slice(i, i + BATCH_SIZE));
    }

    const dispatchTime = Date.now();
    dispatchTimeRef.current = dispatchTime;

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      const payload: MotifWeavePayload = {
        mode: "weave",
        targetPhrase: TARGET_PHRASE,
        instances: batch.map((c) => ({
          index: c.batchIndex,
          entityName: c.entityName,
          sentence: c.sentence,
          surroundingContext: c.contextBefore + c.contextAfter,
        })),
      };

      const syntheticEntity = {
        id: `weave_batch_${dispatchTime}_${batchIdx}`,
        name: `Weave: ${TARGET_PHRASE} (batch ${batchIdx + 1})`,
        kind: "motif" as string,
        subtype: "weave" as string,
        prominence: "marginal" as unknown as string,
        culture: "" as string,
        status: "active" as string,
        description: "" as string,
        tags: {} as Record<string, unknown>,
      };

      try {
        getEnqueue()([
          {
            entity: syntheticEntity,
            type: "motifVariation" as const,
            prompt: JSON.stringify(payload),
          },
        ]);
      } catch (err) {
        setError(`Failed to dispatch batch ${batchIdx + 1}: ${err}`);
        setPhase("scan");
        return;
      }
    }
  }, []);

  // --- Watch queue for completion ---
  useEffect(() => {
    if (phase !== "generating") return;
    const dispatchTime = dispatchTimeRef.current;
    if (!dispatchTime) return;

    const motifItems = queue.filter(
      (item) => item.type === "motifVariation" && item.queuedAt >= dispatchTime
    );
    if (motifItems.length === 0) return;

    const running = motifItems.filter(
      (item) => item.status === "running" || item.status === "queued"
    );
    const completed = motifItems.filter((item) => item.status === "complete");
    const errored = motifItems.filter((item) => item.status === "error");

    if (running.length === 0 && (completed.length > 0 || errored.length > 0)) {
      if (errored.length > 0) {
        setError(`${errored.length} batch(es) failed: ${errored[0].error || "Unknown error"}`);
      }

      const variantMap = new Map<string, string>();
      const currentCandidates = candidatesRef.current;

      for (const item of completed) {
        if (!item.result?.description) continue;
        try {
          const results: MotifVariationResult[] = JSON.parse(item.result.description);
          for (const r of results) {
            const candidate = currentCandidates.find((c) => c.batchIndex === r.index);
            if (candidate) {
              variantMap.set(candidate.id, r.variant);
            }
          }
        } catch {
          // Skip unparseable results
        }
      }

      setVariants(variantMap);
      setPhase(variantMap.size > 0 ? "review" : "empty");
    }
  }, [phase, queue]);

  // --- Apply ---
  const handleApply = useCallback(async () => {
    setPhase("applying");

    // Group accepted changes by entity
    const changesByEntity = new Map<
      string,
      Array<{ sentenceStart: number; sentenceEnd: number; original: string; rewritten: string }>
    >();

    for (const c of candidates) {
      if (!decisions[c.id]) continue;
      const variant = variants.get(c.id);
      if (!variant) continue;

      if (!changesByEntity.has(c.entityId)) {
        changesByEntity.set(c.entityId, []);
      }
      changesByEntity.get(c.entityId).push({
        sentenceStart: c.sentenceStart,
        sentenceEnd: c.sentenceEnd,
        original: c.sentence,
        rewritten: variant,
      });
    }

    // Build patches by applying sentence replacements to descriptions
    const patches: Array<{ entityId: string; description: string }> = [];
    const updatedEntityIds: string[] = [];
    let total = 0;

    for (const [entityId, changes] of changesByEntity) {
      const entity = await useEntityStore.getState().loadEntity(entityId);
      if (!entity?.description) continue;

      // Sort changes descending by position (apply from end to preserve earlier positions)
      const sorted = [...changes].sort((a, b) => b.sentenceStart - a.sentenceStart);
      let description = entity.description;
      for (const change of sorted) {
        // Verify the original sentence still exists at the expected position
        const actual = description.slice(change.sentenceStart, change.sentenceEnd);
        if (actual === change.original) {
          description =
            description.slice(0, change.sentenceStart) +
            change.rewritten +
            description.slice(change.sentenceEnd);
          total++;
        }
      }

      if (description !== entity.description) {
        patches.push({ entityId, description });
        updatedEntityIds.push(entityId);
      }
    }

    if (patches.length > 0) {
      await applyRevisionPatches(patches, "motif-weave");
      await reloadEntities(updatedEntityIds);
    }

    setResultCount(total);
    setPhase("done");
  }, [candidates, decisions, variants]);

  // --- Decision helpers ---
  const toggleDecision = useCallback((id: string) => {
    setDecisions((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const acceptAll = useCallback(() => {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const c of candidates) {
        if (variants.has(c.id)) next[c.id] = true;
      }
      return next;
    });
  }, [candidates, variants]);

  const rejectAll = useCallback(() => {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const c of candidates) next[c.id] = false;
      return next;
    });
  }, [candidates]);

  const acceptGroup = useCallback(
    (groupCandidates: WeaveCandidate[]) => {
      setDecisions((prev) => {
        const next = { ...prev };
        for (const c of groupCandidates) {
          if (variants.has(c.id)) next[c.id] = true;
        }
        return next;
      });
    },
    [variants]
  );

  const rejectGroup = useCallback((groupCandidates: WeaveCandidate[]) => {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const c of groupCandidates) next[c.id] = false;
      return next;
    });
  }, []);

  const toggleExpand = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // --- Stats ---
  const acceptCount = useMemo(() => Object.values(decisions).filter(Boolean).length, [decisions]);

  // --- Groups (by entity) ---
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { entityId: string; entityName: string; candidates: WeaveCandidate[] }
    >();
    for (const c of candidates) {
      if (!map.has(c.entityId)) {
        map.set(c.entityId, { entityId: c.entityId, entityName: c.entityName, candidates: [] });
      }
      map.get(c.entityId).candidates.push(c);
    }
    return Array.from(map.values());
  }, [candidates]);

  return (
    <div
      className="dmw-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && phase !== "applying" && phase !== "generating")
          onClose();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
    >
      <div className="dmw-card">
        {/* Header */}
        <div className="dmw-header">
          <div>
            <h2 className="dmw-title">Motif Weaver</h2>
            <p className="dmw-subtitle">
              Reintroduce &ldquo;{TARGET_PHRASE}&rdquo; into descriptions where the concept exists
              but the phrase was stripped
            </p>
          </div>
          {phase !== "applying" && phase !== "generating" && (
            <button
              onClick={onClose}
              className="illuminator-button illuminator-button-secondary dmw-cancel-btn"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Body */}
        <div className="dmw-body">
          {/* Scan phase */}
          {phase === "scan" && (
            <div className="dmw-scan-layout">
              <div className="dmw-target-phrase-box">
                <div className="dmw-target-phrase-label">
                  Target phrase
                </div>
                <div className="dmw-target-phrase-value">
                  &ldquo;{TARGET_PHRASE}&rdquo;
                </div>
              </div>
              <p className="dmw-scan-description">
                Scans entity descriptions for sentences containing ice-memory concepts (ice-memory,
                ice preserved, impressions in the ice, etc.) where the target phrase is absent.
                Candidate sentences are sent to the LLM for rewriting. You then review and
                selectively apply rewrites.
              </p>
              <p className="dmw-scan-description">
                Light touch recommended — accept 15-25 strong rewrites to recover the motif without
                oversaturating.
              </p>
            </div>
          )}

          {/* Scanning */}
          {phase === "scanning" && (
            <div className="dmw-centered-phase">
              <div className="dmw-phase-title">
                Scanning descriptions...
              </div>
            </div>
          )}

          {/* Confirm detection */}
          {phase === "confirm" && (
            <div>
              <div className="dmw-confirm-summary">
                Found <strong>{candidates.length}</strong> candidate sentences across{" "}
                <strong>{groups.length}</strong> entities.
                {" \u00B7 "}
                {Math.ceil(candidates.length / BATCH_SIZE)} LLM{" "}
                {Math.ceil(candidates.length / BATCH_SIZE) === 1 ? "call" : "calls"} to generate
                rewrites.
              </div>
              {groups.map((group) => (
                <EntityGroup
                  key={group.entityId}
                  entityName={group.entityName}
                  candidates={group.candidates}
                  variants={variants}
                  decisions={decisions}
                  onToggle={toggleDecision}
                  onAcceptAll={() => acceptGroup(group.candidates)}
                  onRejectAll={() => rejectGroup(group.candidates)}
                  expanded={expandedGroups.has(group.entityId)}
                  onToggleExpand={() => toggleExpand(group.entityId)}
                />
              ))}
            </div>
          )}

          {/* Generating */}
          {phase === "generating" && (
            <div className="dmw-centered-phase">
              <div className="dmw-phase-title">
                Generating sentence rewrites...
              </div>
              <div className="dmw-phase-subtitle">
                {candidates.length} candidates across {groups.length} entities
                {" \u00B7 "}
                {Math.ceil(candidates.length / BATCH_SIZE)} LLM{" "}
                {Math.ceil(candidates.length / BATCH_SIZE) === 1 ? "call" : "calls"}
              </div>
              {error && (
                <div className="dmw-error-text">{error}</div>
              )}
            </div>
          )}

          {/* Empty */}
          {phase === "empty" && (
            <div className="dmw-empty-state">
              No candidate sentences found. All entities with ice-memory concepts may already
              contain the target phrase.
            </div>
          )}

          {/* Review phase */}
          {phase === "review" && (
            <div>
              <div className="dmw-review-bar">
                <span>weave &ldquo;{TARGET_PHRASE}&rdquo;</span>
                <span className="dmw-review-separator">|</span>
                <span className="dmw-review-accept-count">{acceptCount} accept</span>
                <span className="dmw-review-skip-count">{candidates.length - acceptCount} skip</span>
                <span className="dmw-review-generated-count">
                  / {variants.size} rewrites generated
                </span>
                <div className="dmw-review-spacer" />
                <button
                  onClick={acceptAll}
                  className="dmw-accept-all-btn"
                >
                  Accept All
                </button>
                <button
                  onClick={rejectAll}
                  className="dmw-reject-all-btn"
                >
                  Reject All
                </button>
              </div>

              {error && (
                <div className="dmw-review-error">
                  {error}
                </div>
              )}

              {groups.map((group) => (
                <EntityGroup
                  key={group.entityId}
                  entityName={group.entityName}
                  candidates={group.candidates}
                  variants={variants}
                  decisions={decisions}
                  onToggle={toggleDecision}
                  onAcceptAll={() => acceptGroup(group.candidates)}
                  onRejectAll={() => rejectGroup(group.candidates)}
                  expanded={expandedGroups.has(group.entityId)}
                  onToggleExpand={() => toggleExpand(group.entityId)}
                />
              ))}
            </div>
          )}

          {/* Applying / Done */}
          {(phase === "applying" || phase === "done") && (
            <div className="dmw-centered-phase">
              <div className="dmw-phase-title">
                {phase === "applying" ? "Applying rewrites..." : "Motif Weave Complete"}
              </div>
              {phase === "done" && (
                <div className="dmw-done-subtitle">
                  {resultCount} sentence{resultCount !== 1 ? "s" : ""} rewritten across{" "}
                  {
                    new Set(
                      candidates
                        .filter((c) => decisions[c.id] && variants.has(c.id))
                        .map((c) => c.entityId)
                    ).size
                  }{" "}
                  entities.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="dmw-footer">
          {phase === "scan" && (
            <button
              onClick={() => void handleScan()}
              className="illuminator-button dmw-footer-btn"
            >
              Scan
            </button>
          )}
          {phase === "confirm" && (
            <>
              <button
                onClick={onClose}
                className="illuminator-button illuminator-button-secondary dmw-footer-btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleGenerate(candidates)}
                className="illuminator-button dmw-footer-btn"
              >
                Generate Rewrites ({candidates.length})
              </button>
            </>
          )}
          {phase === "empty" && (
            <button
              onClick={onClose}
              className="illuminator-button illuminator-button-secondary dmw-footer-btn-secondary"
            >
              Close
            </button>
          )}
          {phase === "review" && (
            <>
              <button
                onClick={onClose}
                className="illuminator-button illuminator-button-secondary dmw-footer-btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleApply()}
                disabled={acceptCount === 0}
                className="illuminator-button dmw-footer-btn"
                style={{ opacity: acceptCount > 0 ? 1 : 0.5 }}
              >
                Apply ({acceptCount} {acceptCount === 1 ? "rewrite" : "rewrites"})
              </button>
            </>
          )}
          {phase === "done" && (
            <button
              onClick={onClose}
              className="illuminator-button dmw-footer-btn"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
