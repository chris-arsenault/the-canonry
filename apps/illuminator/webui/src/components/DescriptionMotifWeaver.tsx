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
import { useExpandSet } from "@the-canonry/shared-components";
import { ErrorMessage } from "@the-canonry/shared-components";
import { useEntityNavList } from "../lib/db/entitySelectors";
import { useEntityStore } from "../lib/db/entityStore";
import { useEnrichmentQueueStore } from "../lib/db/enrichmentQueueStore";
import { useAsyncAction } from "../hooks/useAsyncAction";
import type { WeaveCandidate, Phase, EntityGroupData } from "./motifWeaver/types";
import { scanDescriptionForConcepts, BATCH_SIZE, TARGET_PHRASE } from "./motifWeaver/scanning";
import { dispatchWeaveBatches } from "./motifWeaver/dispatch";
import { evaluateQueueState } from "./motifWeaver/queueWatcher";
import { applyMotifWeaves } from "./motifWeaver/applyWeaves";
import EntityGroupList from "./motifWeaver/EntityGroupList";
import "./DescriptionMotifWeaver.css";

// ============================================================================
// Phase-specific sub-components
// ============================================================================

function ScanPhase() {
  return (
    <div className="dmw-scan-layout">
      <div className="dmw-target-phrase-box">
        <div className="dmw-target-phrase-label">Target phrase</div>
        <div className="dmw-target-phrase-value">&ldquo;{TARGET_PHRASE}&rdquo;</div>
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
  );
}

function ScanningPhase() {
  return (
    <div className="dmw-centered-phase">
      <div className="dmw-phase-title">Scanning descriptions...</div>
    </div>
  );
}

function GeneratingPhase({
  candidateCount,
  groupCount,
  errorMsg,
}: Readonly<{ candidateCount: number; groupCount: number; errorMsg: string | null }>) {
  const batchCount = Math.ceil(candidateCount / BATCH_SIZE);
  return (
    <div className="dmw-centered-phase">
      <div className="dmw-phase-title">Generating sentence rewrites...</div>
      <div className="dmw-phase-subtitle">
        {candidateCount} candidates across {groupCount} entities
        {" \u00B7 "}
        {batchCount} LLM {batchCount === 1 ? "call" : "calls"}
      </div>
      {errorMsg && <ErrorMessage message={errorMsg} className="dmw-error-text" />}
    </div>
  );
}

function EmptyPhase() {
  return (
    <div className="viewer-empty-state">
      No candidate sentences found. All entities with ice-memory concepts may already
      contain the target phrase.
    </div>
  );
}

function ApplyingDonePhase({
  phase,
  resultCount,
  candidates,
  decisions,
  variants,
}: Readonly<{
  phase: "applying" | "done";
  resultCount: number;
  candidates: WeaveCandidate[];
  decisions: Record<string, boolean>;
  variants: Map<string, string>;
}>) {
  return (
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
                .map((c) => c.entityId),
            ).size
          }{" "}
          entities.
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function DescriptionMotifWeaver({ onClose }: Readonly<{ onClose: () => void }>) {
  const navEntities = useEntityNavList();
  const queue = useEnrichmentQueueStore((s) => s.queue);

  const [phase, setPhase] = useState<Phase>("scan");
  const [candidates, setCandidates] = useState<WeaveCandidate[]>([]);
  const [variants, setVariants] = useState<Map<string, string>>(new Map());
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const { expanded: expandedGroups, toggle: toggleExpand, set: setExpandedGroups } = useExpandSet();
  const [resultCount, setResultCount] = useState(0);
  const { error: asyncError, setError, clearError } = useAsyncAction();

  const dispatchTimeRef = useRef<number>(0);
  const candidatesRef = useRef<WeaveCandidate[]>([]);

  useEffect(() => {
    candidatesRef.current = candidates;
  }, [candidates]);

  // --- Scan ---
  const handleScan = useCallback(async () => {
    setPhase("scanning");
    clearError();

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
        entity.id, entity.name, entity.description, globalIndex,
      );
      allCandidates.push(...entityCandidates);
      globalIndex += entityCandidates.length;
    }

    if (allCandidates.length === 0) {
      setPhase("empty");
      return;
    }

    setCandidates(allCandidates);
    const initial: Record<string, boolean> = {};
    for (const c of allCandidates) initial[c.id] = false;
    setDecisions(initial);
    if (allCandidates.length > 0) {
      setExpandedGroups(new Set([allCandidates[0].entityId]));
    }

    setPhase("confirm");
  }, [navEntities, clearError, setExpandedGroups]);

  // --- Generate ---
  const handleGenerate = useCallback((scanCandidates: WeaveCandidate[]) => {
    setPhase("generating");
    const { dispatchTime, errorMessage } = dispatchWeaveBatches(scanCandidates);
    dispatchTimeRef.current = dispatchTime;
    if (errorMessage) {
      setError(errorMessage);
      setPhase("scan");
    }
  }, [setError]);

  // --- Watch queue for completion ---
  useEffect(() => {
    if (phase !== "generating") return;
    const dispatchTime = dispatchTimeRef.current;
    if (!dispatchTime) return;

    const { finished, errorMessage, variantMap } = evaluateQueueState(
      queue, dispatchTime, candidatesRef.current,
    );

    if (!finished) return;

    if (errorMessage) setError(errorMessage);

    setVariants(variantMap);
    setPhase(variantMap.size > 0 ? "review" : "empty");
  }, [phase, queue, setError]);

  // --- Apply ---
  const handleApply = useCallback(async () => {
    setPhase("applying");
    const total = await applyMotifWeaves(candidates, decisions, variants);
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
    [variants],
  );

  const rejectGroup = useCallback((groupCandidates: WeaveCandidate[]) => {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const c of groupCandidates) next[c.id] = false;
      return next;
    });
  }, []);

  // --- Stats ---
  const acceptCount = useMemo(() => Object.values(decisions).filter(Boolean).length, [decisions]);

  // --- Groups (by entity) ---
  const groups = useMemo(() => {
    const map = new Map<string, EntityGroupData>();
    for (const c of candidates) {
      let group = map.get(c.entityId);
      if (!group) {
        group = { entityId: c.entityId, entityName: c.entityName, candidates: [] };
        map.set(c.entityId, group);
      }
      group.candidates.push(c);
    }
    return Array.from(map.values());
  }, [candidates]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && phase !== "applying" && phase !== "generating") onClose();
    },
    [phase, onClose],
  );

  const handleBackdropKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
    },
    [],
  );

  const handleScanClick = useCallback(() => void handleScan(), [handleScan]);
  const handleGenerateClick = useCallback(() => handleGenerate(candidates), [handleGenerate, candidates]);
  const handleApplyClick = useCallback(() => void handleApply(), [handleApply]);

  return (
    <div className="dmw-backdrop" onClick={handleBackdropClick} role="button" tabIndex={0} onKeyDown={handleBackdropKeyDown}>
      <div className="dmw-card">
        <MotifWeaverHeader phase={phase} onClose={onClose} />
        <div className="dmw-body">
          {phase === "scan" && <ScanPhase />}
          {phase === "scanning" && <ScanningPhase />}
          {phase === "confirm" && (
            <ConfirmPhase
              candidates={candidates} groups={groups} variants={variants}
              decisions={decisions} expandedGroups={expandedGroups}
              onToggle={toggleDecision} onAcceptGroup={acceptGroup}
              onRejectGroup={rejectGroup} onToggleExpand={toggleExpand}
            />
          )}
          {phase === "generating" && (
            <GeneratingPhase candidateCount={candidates.length} groupCount={groups.length} errorMsg={asyncError} />
          )}
          {phase === "empty" && <EmptyPhase />}
          {phase === "review" && (
            <ReviewPhase
              candidates={candidates} groups={groups} variants={variants}
              decisions={decisions} expandedGroups={expandedGroups}
              acceptCount={acceptCount} errorMsg={asyncError}
              onToggle={toggleDecision} onAcceptAll={acceptAll}
              onRejectAll={rejectAll} onAcceptGroup={acceptGroup}
              onRejectGroup={rejectGroup} onToggleExpand={toggleExpand}
            />
          )}
          {(phase === "applying" || phase === "done") && (
            <ApplyingDonePhase
              phase={phase} resultCount={resultCount}
              candidates={candidates} decisions={decisions} variants={variants}
            />
          )}
        </div>
        <MotifWeaverFooter
          phase={phase} acceptCount={acceptCount} candidateCount={candidates.length}
          onClose={onClose} onScan={handleScanClick}
          onGenerate={handleGenerateClick} onApply={handleApplyClick}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Header / Footer / Confirm / Review sub-components
// ============================================================================

function MotifWeaverHeader({ phase, onClose }: Readonly<{ phase: Phase; onClose: () => void }>) {
  return (
    <div className="dmw-header">
      <div>
        <h2 className="dmw-title">Motif Weaver</h2>
        <p className="dmw-subtitle">
          Reintroduce &ldquo;{TARGET_PHRASE}&rdquo; into descriptions where the concept exists
          but the phrase was stripped
        </p>
      </div>
      {phase !== "applying" && phase !== "generating" && (
        <button onClick={onClose} className="illuminator-button illuminator-button-secondary dmw-cancel-btn">
          Cancel
        </button>
      )}
    </div>
  );
}

function ConfirmPhase({
  candidates, groups, variants, decisions, expandedGroups,
  onToggle, onAcceptGroup, onRejectGroup, onToggleExpand,
}: Readonly<{
  candidates: WeaveCandidate[];
  groups: EntityGroupData[];
  variants: Map<string, string>;
  decisions: Record<string, boolean>;
  expandedGroups: Set<string>;
  onToggle: (id: string) => void;
  onAcceptGroup: (c: WeaveCandidate[]) => void;
  onRejectGroup: (c: WeaveCandidate[]) => void;
  onToggleExpand: (key: string) => void;
}>) {
  const batchCount = Math.ceil(candidates.length / BATCH_SIZE);
  return (
    <div>
      <div className="dmw-confirm-summary">
        Found <strong>{candidates.length}</strong> candidate sentences across{" "}
        <strong>{groups.length}</strong> entities.
        {" \u00B7 "}
        {batchCount} LLM {batchCount === 1 ? "call" : "calls"} to generate rewrites.
      </div>
      <EntityGroupList
        groups={groups} variants={variants} decisions={decisions}
        onToggle={onToggle} onAcceptGroup={onAcceptGroup}
        onRejectGroup={onRejectGroup} expandedGroups={expandedGroups}
        onToggleExpand={onToggleExpand}
      />
    </div>
  );
}

function ReviewPhase({
  candidates, groups, variants, decisions, expandedGroups,
  acceptCount, errorMsg,
  onToggle, onAcceptAll, onRejectAll, onAcceptGroup, onRejectGroup, onToggleExpand,
}: Readonly<{
  candidates: WeaveCandidate[];
  groups: EntityGroupData[];
  variants: Map<string, string>;
  decisions: Record<string, boolean>;
  expandedGroups: Set<string>;
  acceptCount: number;
  errorMsg: string | null;
  onToggle: (id: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onAcceptGroup: (c: WeaveCandidate[]) => void;
  onRejectGroup: (c: WeaveCandidate[]) => void;
  onToggleExpand: (key: string) => void;
}>) {
  return (
    <div>
      <div className="dmw-review-bar">
        <span>weave &ldquo;{TARGET_PHRASE}&rdquo;</span>
        <span className="dmw-review-separator">|</span>
        <span className="dmw-review-accept-count">{acceptCount} accept</span>
        <span className="dmw-review-skip-count">{candidates.length - acceptCount} skip</span>
        <span className="dmw-review-generated-count">/ {variants.size} rewrites generated</span>
        <div className="dmw-review-spacer" />
        <button onClick={onAcceptAll} className="dmw-accept-all-btn">Accept All</button>
        <button onClick={onRejectAll} className="dmw-reject-all-btn">Reject All</button>
      </div>
      {errorMsg && <ErrorMessage message={errorMsg} className="dmw-error-text" />}
      <EntityGroupList
        groups={groups} variants={variants} decisions={decisions}
        onToggle={onToggle} onAcceptGroup={onAcceptGroup}
        onRejectGroup={onRejectGroup} expandedGroups={expandedGroups}
        onToggleExpand={onToggleExpand}
      />
    </div>
  );
}

function MotifWeaverFooter({
  phase, acceptCount, candidateCount, onClose, onScan, onGenerate, onApply,
}: Readonly<{
  phase: Phase;
  acceptCount: number;
  candidateCount: number;
  onClose: () => void;
  onScan: () => void;
  onGenerate: () => void;
  onApply: () => void;
}>) {
  return (
    <div className="ilu-footer dmw-footer">
      {phase === "scan" && (
        <button onClick={onScan} className="illuminator-button dmw-footer-btn">Scan</button>
      )}
      {phase === "confirm" && (
        <>
          <button onClick={onClose} className="illuminator-button illuminator-button-secondary dmw-footer-btn-secondary">
            Cancel
          </button>
          <button onClick={onGenerate} className="illuminator-button dmw-footer-btn">
            Generate Rewrites ({candidateCount})
          </button>
        </>
      )}
      {phase === "empty" && (
        <button onClick={onClose} className="illuminator-button illuminator-button-secondary dmw-footer-btn-secondary">
          Close
        </button>
      )}
      {phase === "review" && (
        <>
          <button onClick={onClose} className="illuminator-button illuminator-button-secondary dmw-footer-btn-secondary">
            Cancel
          </button>
          <button
            onClick={onApply}
            disabled={acceptCount === 0}
            className={`illuminator-button dmw-footer-btn ${acceptCount === 0 ? "dmw-footer-btn-disabled" : ""}`}
          >
            Apply ({acceptCount} {acceptCount === 1 ? "rewrite" : "rewrites"})
          </button>
        </>
      )}
      {phase === "done" && (
        <button onClick={onClose} className="illuminator-button dmw-footer-btn">Done</button>
      )}
    </div>
  );
}
