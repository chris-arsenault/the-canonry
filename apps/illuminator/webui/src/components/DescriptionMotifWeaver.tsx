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

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useEntityNavList } from "../lib/db/entitySelectors";
import { useEntityStore } from "../lib/db/entityStore";
import { applyRevisionPatches } from "../lib/db/entityRepository";
import { getEnqueue } from "../lib/db/enrichmentQueueBridge";
import { useEnrichmentQueueStore } from "../lib/db/enrichmentQueueStore";
import { reloadEntities } from "../hooks/useEntityCrud";
import type { MotifWeavePayload, MotifVariationResult } from "../workers/tasks/motifVariationTask";

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

// Targets the ice-as-archive concept, not incidental ice mentions
const ICE_MEMORY_CONCEPTS =
  /ice[\s-]memor(?:y|ies)|the ice preserve[sd]|preserved in the ice|impressions? (?:in|frozen into) the ice|ice[\s-]testimon|ice[\s-]record|the substrate(?:'s)? (?:record|testimon|memor)/gi;
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

  ICE_MEMORY_CONCEPTS.lastIndex = 0;
  let regexMatch: RegExpExecArray | null;
  while ((regexMatch = ICE_MEMORY_CONCEPTS.exec(description)) !== null) {
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
}: {
  candidate: WeaveCandidate;
  variant?: string;
  accepted: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        padding: "6px 10px",
        background: accepted ? "var(--bg-tertiary)" : "var(--bg-secondary)",
        borderRadius: "4px",
        border: "1px solid var(--border-color)",
        opacity: accepted ? 1 : 0.5,
        marginBottom: "3px",
        display: "flex",
        gap: "8px",
        alignItems: "flex-start",
      }}
    >
      <input
        type="checkbox"
        checked={accepted}
        onChange={onToggle}
        style={{ marginTop: "3px", cursor: "pointer", flexShrink: 0 }}
      />
      <div
        style={{
          fontSize: "11px",
          lineHeight: "1.7",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          flex: 1,
        }}
      >
        <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>
          {candidate.contextBefore}
        </span>
        <span
          style={{
            background:
              accepted && variant ? "rgba(239, 68, 68, 0.15)" : "rgba(139, 115, 85, 0.15)",
            textDecoration: accepted && variant ? "line-through" : "none",
            padding: "1px 2px",
            borderRadius: "2px",
          }}
        >
          {candidate.sentence}
        </span>
        {accepted && variant && (
          <>
            {" "}
            <span
              style={{
                background: "rgba(34, 197, 94, 0.2)",
                padding: "1px 2px",
                borderRadius: "2px",
              }}
            >
              {variant}
            </span>
          </>
        )}
        <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>
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
}: {
  entityName: string;
  candidates: WeaveCandidate[];
  variants: Map<string, string>;
  decisions: Record<string, boolean>;
  onToggle: (id: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const acceptCount = candidates.filter((c) => decisions[c.id]).length;

  return (
    <div
      style={{
        marginBottom: "4px",
        border: "1px solid var(--border-color)",
        borderRadius: "6px",
        overflow: "hidden",
      }}
    >
      <div
        onClick={onToggleExpand}
        style={{
          padding: "8px 12px",
          background: "var(--bg-secondary)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          userSelect: "none",
        }}
      >
        <span
          style={{ fontSize: "10px", color: "var(--text-muted)", width: "10px", flexShrink: 0 }}
        >
          {expanded ? "\u25BC" : "\u25B6"}
        </span>
        <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)" }}>
          {entityName}
        </span>
        <span style={{ fontSize: "10px", color: "var(--text-muted)", marginLeft: "auto" }}>
          {candidates.length} {candidates.length === 1 ? "candidate" : "candidates"}
        </span>
        {acceptCount > 0 && (
          <span style={{ fontSize: "10px", color: "#22c55e" }}>
            {acceptCount}
            {"\u2713"}
          </span>
        )}
        {candidates.length - acceptCount > 0 && (
          <span style={{ fontSize: "10px", color: "#ef4444" }}>
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
          style={{
            background: "none",
            border: "none",
            color: "#22c55e",
            fontSize: "10px",
            cursor: "pointer",
            padding: "0 4px",
          }}
        >
          {"all\u2713"}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRejectAll();
          }}
          title="Reject all in this entity"
          style={{
            background: "none",
            border: "none",
            color: "#ef4444",
            fontSize: "10px",
            cursor: "pointer",
            padding: "0 4px",
          }}
        >
          {"all\u2717"}
        </button>
      </div>
      {expanded && (
        <div style={{ padding: "6px 8px" }}>
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

export default function DescriptionMotifWeaver({ onClose }: { onClose: () => void }) {
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
      changesByEntity.get(c.entityId)!.push({
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
      map.get(c.entityId)!.candidates.push(c);
    }
    return Array.from(map.values());
  }, [candidates]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.6)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && phase !== "applying" && phase !== "generating")
          onClose();
      }}
    >
      <div
        style={{
          background: "var(--bg-primary)",
          borderRadius: "12px",
          border: "1px solid var(--border-color)",
          width: "820px",
          maxWidth: "95vw",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "16px" }}>Motif Weaver</h2>
            <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
              Reintroduce &ldquo;{TARGET_PHRASE}&rdquo; into descriptions where the concept exists
              but the phrase was stripped
            </p>
          </div>
          {phase !== "applying" && phase !== "generating" && (
            <button
              onClick={onClose}
              className="illuminator-button illuminator-button-secondary"
              style={{ padding: "4px 12px", fontSize: "12px" }}
            >
              Cancel
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px", minHeight: 0 }}>
          {/* Scan phase */}
          {phase === "scan" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div
                style={{
                  padding: "12px 16px",
                  background: "var(--bg-tertiary)",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                }}
              >
                <div style={{ fontSize: "12px", fontWeight: 500, marginBottom: "6px" }}>
                  Target phrase
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    fontFamily: "monospace",
                    color: "var(--text-primary)",
                  }}
                >
                  &ldquo;{TARGET_PHRASE}&rdquo;
                </div>
              </div>
              <p
                style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.6 }}
              >
                Scans entity descriptions for sentences containing ice-memory concepts (ice-memory,
                ice preserved, impressions in the ice, etc.) where the target phrase is absent.
                Candidate sentences are sent to the LLM for rewriting. You then review and
                selectively apply rewrites.
              </p>
              <p
                style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.6 }}
              >
                Light touch recommended — accept 15-25 strong rewrites to recover the motif without
                oversaturating.
              </p>
            </div>
          )}

          {/* Scanning */}
          {phase === "scanning" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div
                style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}
              >
                Scanning descriptions...
              </div>
            </div>
          )}

          {/* Confirm detection */}
          {phase === "confirm" && (
            <div>
              <div
                style={{
                  marginBottom: "12px",
                  padding: "8px 14px",
                  background: "var(--bg-secondary)",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  fontSize: "12px",
                }}
              >
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
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div
                style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}
              >
                Generating sentence rewrites...
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {candidates.length} candidates across {groups.length} entities
                {" \u00B7 "}
                {Math.ceil(candidates.length / BATCH_SIZE)} LLM{" "}
                {Math.ceil(candidates.length / BATCH_SIZE) === 1 ? "call" : "calls"}
              </div>
              {error && (
                <div style={{ marginTop: "12px", fontSize: "12px", color: "#ef4444" }}>{error}</div>
              )}
            </div>
          )}

          {/* Empty */}
          {phase === "empty" && (
            <div
              style={{
                textAlign: "center",
                padding: "30px 0",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              No candidate sentences found. All entities with ice-memory concepts may already
              contain the target phrase.
            </div>
          )}

          {/* Review phase */}
          {phase === "review" && (
            <div>
              <div
                style={{
                  marginBottom: "12px",
                  padding: "8px 14px",
                  background: "var(--bg-secondary)",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                  flexWrap: "wrap",
                  fontSize: "12px",
                }}
              >
                <span>weave &ldquo;{TARGET_PHRASE}&rdquo;</span>
                <span style={{ color: "var(--text-muted)" }}>|</span>
                <span style={{ color: "#22c55e" }}>{acceptCount} accept</span>
                <span style={{ color: "#ef4444" }}>{candidates.length - acceptCount} skip</span>
                <span style={{ color: "var(--text-muted)" }}>
                  / {variants.size} rewrites generated
                </span>
                <div style={{ flex: 1 }} />
                <button
                  onClick={acceptAll}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#22c55e",
                    fontSize: "10px",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Accept All
                </button>
                <button
                  onClick={rejectAll}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ef4444",
                    fontSize: "10px",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Reject All
                </button>
              </div>

              {error && (
                <div
                  style={{
                    marginBottom: "12px",
                    padding: "8px 14px",
                    background: "rgba(239, 68, 68, 0.1)",
                    borderRadius: "6px",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    fontSize: "11px",
                    color: "#ef4444",
                  }}
                >
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
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div
                style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}
              >
                {phase === "applying" ? "Applying rewrites..." : "Motif Weave Complete"}
              </div>
              {phase === "done" && (
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
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
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            flexShrink: 0,
          }}
        >
          {phase === "scan" && (
            <button
              onClick={handleScan}
              className="illuminator-button"
              style={{ padding: "6px 20px", fontSize: "12px" }}
            >
              Scan
            </button>
          )}
          {phase === "confirm" && (
            <>
              <button
                onClick={onClose}
                className="illuminator-button illuminator-button-secondary"
                style={{ padding: "6px 16px", fontSize: "12px" }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleGenerate(candidates)}
                className="illuminator-button"
                style={{ padding: "6px 20px", fontSize: "12px" }}
              >
                Generate Rewrites ({candidates.length})
              </button>
            </>
          )}
          {phase === "empty" && (
            <button
              onClick={onClose}
              className="illuminator-button illuminator-button-secondary"
              style={{ padding: "6px 16px", fontSize: "12px" }}
            >
              Close
            </button>
          )}
          {phase === "review" && (
            <>
              <button
                onClick={onClose}
                className="illuminator-button illuminator-button-secondary"
                style={{ padding: "6px 16px", fontSize: "12px" }}
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={acceptCount === 0}
                className="illuminator-button"
                style={{
                  padding: "6px 20px",
                  fontSize: "12px",
                  opacity: acceptCount > 0 ? 1 : 0.5,
                }}
              >
                Apply ({acceptCount} {acceptCount === 1 ? "rewrite" : "rewrites"})
              </button>
            </>
          )}
          {phase === "done" && (
            <button
              onClick={onClose}
              className="illuminator-button"
              style={{ padding: "6px 20px", fontSize: "12px" }}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
