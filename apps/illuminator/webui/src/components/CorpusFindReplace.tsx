/**
 * CorpusFindReplace — Unified find/replace across chronicle content,
 * chronicle titles, chronicle annotations, entity annotations, and
 * era narrative content.
 *
 * Consolidates ChronicleFindReplaceModal (literal replace on chronicle content)
 * and AnnotationMotifTool (LLM-powered replace on entity annotations) into a
 * single tool with selectable search contexts and optional LLM-enhanced mode.
 *
 * Three-phase flow: input → scan/preview → apply
 * Optional LLM branch: preview → generate → review → apply
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import "./CorpusFindReplace.css";
import {
  getChronicle,
  putChronicle,
  updateChronicleHistorianNotes,
} from "../lib/db/chronicleRepository";
import { useChronicleStore } from "../lib/db/chronicleStore";
import { useEntityStore } from "../lib/db/entityStore";
import { useEntityNavList } from "../lib/db/entitySelectors";
import { setHistorianNotes } from "../lib/db/entityRepository";
import { getEnqueue } from "../lib/db/enrichmentQueueBridge";
import { useEnrichmentQueueStore } from "../lib/db/enrichmentQueueStore";
import { reloadEntities } from "../hooks/useEntityCrud";
import type { HistorianNote } from "../lib/historianTypes";
import { isNoteActive } from "../lib/historianTypes";
import type {
  MotifVariationPayload,
  MotifVariationResult,
} from "../workers/tasks/motifVariationTask";
import {
  getEraNarrativesForSimulation,
  getEraNarrative,
  updateEraNarrative,
  resolveActiveContent,
} from "../lib/db/eraNarrativeRepository";

// ============================================================================
// Types
// ============================================================================

type SearchContext =
  | "chronicleContent"
  | "chronicleTitles"
  | "chronicleAnnotations"
  | "entityAnnotations"
  | "eraNarrativeContent";

interface CorpusMatch {
  id: string;
  context: SearchContext;
  sourceId: string;
  sourceName: string;
  noteId?: string;
  noteText?: string;
  /** For chronicle content: 'final' | 'assembled' | versionId */
  contentField?: string;
  contentFieldLabel?: string;
  position: number;
  contextBefore: string;
  matchedText: string;
  contextAfter: string;
  /** For LLM mode: batch correlation index */
  batchIndex?: number;
}

type Phase =
  | "input"
  | "scanning"
  | "preview"
  | "generating"
  | "review"
  | "applying"
  | "done"
  | "empty";

const CONTEXT_RADIUS = 80;
const BATCH_SIZE = 8;

const CONTEXT_LABELS: Record<SearchContext, string> = {
  chronicleContent: "Chronicle Content",
  chronicleTitles: "Chronicle Titles",
  chronicleAnnotations: "Chronicle Annotations",
  entityAnnotations: "Entity Annotations",
  eraNarrativeContent: "Era Narratives",
};

// ============================================================================
// Scanning
// ============================================================================

function scanText(
  text: string,
  find: string,
  caseSensitive: boolean,
  sourceName: string,
  searchContext: SearchContext,
  sourceId: string,
  contentField: string | undefined,
  contentFieldLabel: string | undefined,
  noteId: string | undefined,
  noteText: string | undefined
): CorpusMatch[] {
  const matches: CorpusMatch[] = [];
  if (!text) return matches;

  const haystack = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? find : find.toLowerCase();

  let startPos = 0;
  let idx = 0;
  while ((startPos = haystack.indexOf(needle, startPos)) !== -1) {
    const ctxStart = Math.max(0, startPos - CONTEXT_RADIUS);
    const ctxEnd = Math.min(text.length, startPos + find.length + CONTEXT_RADIUS);
    matches.push({
      id: `${searchContext}:${sourceId}:${noteId || contentField || "text"}:${idx}`,
      context: searchContext,
      sourceId,
      sourceName,
      noteId,
      noteText,
      contentField,
      contentFieldLabel,
      position: startPos,
      contextBefore: (ctxStart > 0 ? "\u2026" : "") + text.slice(ctxStart, startPos),
      matchedText: text.slice(startPos, startPos + find.length), // preserve original case
      contextAfter:
        text.slice(startPos + find.length, ctxEnd) + (ctxEnd < text.length ? "\u2026" : ""),
    });
    startPos += find.length;
    idx++;
  }
  return matches;
}

function applySelectiveReplace(
  text: string,
  find: string,
  replace: string,
  acceptedPositions: number[]
): string {
  if (!text || acceptedPositions.length === 0) return text;
  const sorted = [...acceptedPositions].sort((a, b) => b - a);
  let result = text;
  for (const pos of sorted) {
    result = result.slice(0, pos) + replace + result.slice(pos + find.length);
  }
  return result;
}

/**
 * Extract the changed region between the original and rewritten full annotation.
 * Finds the common prefix/suffix and returns only the differing middle.
 */
function extractDiff(
  original: string,
  rewritten: string
): { prefix: string; oldMiddle: string; newMiddle: string; suffix: string } {
  let prefixLen = 0;
  while (
    prefixLen < original.length &&
    prefixLen < rewritten.length &&
    original[prefixLen] === rewritten[prefixLen]
  ) {
    prefixLen++;
  }
  let suffixLen = 0;
  while (
    suffixLen < original.length - prefixLen &&
    suffixLen < rewritten.length - prefixLen &&
    original[original.length - 1 - suffixLen] === rewritten[rewritten.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }
  while (prefixLen > 0 && original[prefixLen - 1] !== " " && original[prefixLen - 1] !== "\n")
    prefixLen--;
  while (
    suffixLen > 0 &&
    original[original.length - suffixLen] !== " " &&
    original[original.length - suffixLen] !== "\n"
  )
    suffixLen--;

  const contextChars = 80;
  const prefix = original.slice(Math.max(0, prefixLen - contextChars), prefixLen);
  const suffix = original.slice(
    original.length - suffixLen,
    Math.min(original.length, original.length - suffixLen + contextChars)
  );
  return {
    prefix: (prefixLen - contextChars > 0 ? "\u2026" : "") + prefix,
    oldMiddle: original.slice(prefixLen, original.length - suffixLen),
    newMiddle: rewritten.slice(prefixLen, rewritten.length - suffixLen),
    suffix: suffix + (original.length - suffixLen + contextChars < original.length ? "\u2026" : ""),
  };
}

// ============================================================================
// Match Row
// ============================================================================

function MatchRow({
  match,
  replace,
  variant,
  accepted,
  onToggle,
}: Readonly<{
  match: CorpusMatch;
  replace: string;
  variant?: string;
  accepted: boolean;
  onToggle: () => void;
}>) {
  const diff = variant ? extractDiff(match.noteText, variant) : null;

  return (
    <div
      className={`cfr-match-row ${accepted ? "cfr-match-row-accepted" : "cfr-match-row-rejected"}`}
    >
      <input
        type="checkbox"
        checked={accepted}
        onChange={onToggle}
        className="cfr-match-checkbox"
      />
      <div className={`cfr-match-body ${diff ? "" : "cfr-match-body-mono"}`}>
        {diff ? (
          <>
            <span className="cfr-diff-context">{diff.prefix}</span>
            <span
              className={`cfr-diff-old ${accepted ? "cfr-diff-old-accepted" : "cfr-diff-old-rejected"}`}
            >
              {diff.oldMiddle}
            </span>
            {accepted && (
              <>
                {" "}
                <span className="cfr-diff-new">{diff.newMiddle}</span>
              </>
            )}
            <span className="cfr-diff-context">{diff.suffix}</span>
          </>
        ) : (
          <>
            <span className="cfr-literal-context">{match.contextBefore}</span>
            <span className="cfr-literal-old">{match.matchedText}</span>
            {accepted && <span className="cfr-literal-new">{replace}</span>}
            <span className="cfr-literal-context">{match.contextAfter}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Source Group
// ============================================================================

function SourceGroup({
  label,
  matches,
  replace,
  variants,
  decisions,
  onToggle,
  onAcceptAll,
  onRejectAll,
  expanded,
  onToggleExpand,
}: Readonly<{
  label: string;
  matches: CorpusMatch[];
  replace: string;
  variants: Map<string, string>;
  decisions: Record<string, boolean>;
  onToggle: (id: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}>) {
  const acceptCount = matches.filter((m) => decisions[m.id]).length;

  return (
    <div className="cfr-source-group">
      <div onClick={onToggleExpand} className="cfr-source-header" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggleExpand(e); }} >
        <span className="cfr-source-arrow">{expanded ? "\u25BC" : "\u25B6"}</span>
        <span className="cfr-source-label">{label}</span>
        <span className="cfr-source-count">
          {matches.length} {matches.length === 1 ? "match" : "matches"}
        </span>
        {acceptCount > 0 && (
          <span className="cfr-source-accept-count">
            {acceptCount}
            {"\u2713"}
          </span>
        )}
        {matches.length - acceptCount > 0 && (
          <span className="cfr-source-reject-count">
            {matches.length - acceptCount}
            {"\u2717"}
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAcceptAll();
          }}
          title="Accept all in this group"
          className="cfr-source-btn cfr-source-btn-accept"
        >
          {"all\u2713"}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRejectAll();
          }}
          title="Reject all in this group"
          className="cfr-source-btn cfr-source-btn-reject"
        >
          {"all\u2717"}
        </button>
      </div>
      {expanded && (
        <div className="cfr-source-matches">
          {matches.map((m) => (
            <MatchRow
              key={m.id}
              match={m}
              replace={replace}
              variant={variants.get(m.id)}
              accepted={!!decisions[m.id]}
              onToggle={() => onToggle(m.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Context Section (groups source groups under a context header)
// ============================================================================

function ContextSection({
  contextLabel,
  sourceGroups,
  replace,
  variants,
  decisions,
  onToggle,
  onAcceptGroup,
  onRejectGroup,
  expandedGroups,
  onToggleExpand,
}: Readonly<{
  contextLabel: string;
  sourceGroups: Array<{ key: string; label: string; matches: CorpusMatch[] }>;
  replace: string;
  variants: Map<string, string>;
  decisions: Record<string, boolean>;
  onToggle: (id: string) => void;
  onAcceptGroup: (matches: CorpusMatch[]) => void;
  onRejectGroup: (matches: CorpusMatch[]) => void;
  expandedGroups: Set<string>;
  onToggleExpand: (key: string) => void;
}>) {
  const totalMatches = sourceGroups.reduce((sum, g) => sum + g.matches.length, 0);
  return (
    <div className="cfr-context-section">
      <div className="cfr-context-heading">
        {contextLabel} ({totalMatches})
      </div>
      {sourceGroups.map((group) => (
        <SourceGroup
          key={group.key}
          label={group.label}
          matches={group.matches}
          replace={replace}
          variants={variants}
          decisions={decisions}
          onToggle={onToggle}
          onAcceptAll={() => onAcceptGroup(group.matches)}
          onRejectAll={() => onRejectGroup(group.matches)}
          expanded={expandedGroups.has(group.key)}
          onToggleExpand={() => onToggleExpand(group.key)}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function CorpusFindReplace() {
  const navEntities = useEntityNavList();
  const chronicleNavItems = useChronicleStore((s) => s.navItems);
  const queue = useEnrichmentQueueStore((s) => s.queue);

  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(true);
  const [contexts, setContexts] = useState<Set<SearchContext>>(
    new Set([
      "chronicleContent",
      "chronicleTitles",
      "chronicleAnnotations",
      "entityAnnotations",
      "eraNarrativeContent",
    ])
  );
  const [llmMode, setLlmMode] = useState(false);
  const [phase, setPhase] = useState<Phase>("input");
  const [matches, setMatches] = useState<CorpusMatch[]>([]);
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [resultCount, setResultCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState("");

  // LLM mode state
  const [variants, setVariants] = useState<Map<string, string>>(new Map());
  const dispatchTimeRef = useRef<number>(0);
  const expectedBatchCountRef = useRef<number>(0);
  const matchesRef = useRef<CorpusMatch[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase === "input" && inputRef.current) inputRef.current.focus();
  }, [phase]);

  useEffect(() => {
    matchesRef.current = matches;
  }, [matches]);

  const hasAnnotationContext =
    contexts.has("chronicleAnnotations") || contexts.has("entityAnnotations");

  const toggleContext = useCallback((ctx: SearchContext) => {
    setContexts((prev) => {
      const next = new Set(prev);
      if (next.has(ctx)) next.delete(ctx);
      else next.add(ctx);
      return next;
    });
  }, []);

  // --- Scan ---
  const handleScan = useCallback(async () => {
    if (!find || contexts.size === 0) return;
    setPhase("scanning");
    setError(null);
    const allMatches: CorpusMatch[] = [];

    // 1. Chronicle content
    if (contexts.has("chronicleContent")) {
      const completeIds = Object.values(chronicleNavItems)
        .filter((nav) => nav.status === "complete")
        .map((nav) => nav.chronicleId);

      for (let i = 0; i < completeIds.length; i++) {
        setScanProgress(`Chronicle content ${i + 1}/${completeIds.length}`);
        const record = await getChronicle(completeIds[i]);
        if (!record) continue;
        const name = record.title || chronicleNavItems[completeIds[i]]?.name || "Untitled";

        if (record.finalContent) {
          allMatches.push(
            ...scanText(
              record.finalContent,
              find,
              caseSensitive,
              name,
              "chronicleContent",
              completeIds[i],
              "final",
              "Published",
              undefined,
              undefined
            )
          );
        }
        if (record.assembledContent && record.assembledContent !== record.finalContent) {
          allMatches.push(
            ...scanText(
              record.assembledContent,
              find,
              caseSensitive,
              name,
              "chronicleContent",
              completeIds[i],
              "assembled",
              "Current Draft",
              undefined,
              undefined
            )
          );
        }
      }
    }

    // 2. Chronicle titles
    if (contexts.has("chronicleTitles")) {
      const allIds = Object.values(chronicleNavItems).map((nav) => nav.chronicleId);

      for (let i = 0; i < allIds.length; i++) {
        if (i % 50 === 0) setScanProgress(`Chronicle titles ${i + 1}/${allIds.length}`);
        const record = await getChronicle(allIds[i]);
        if (!record?.title) continue;
        allMatches.push(
          ...scanText(
            record.title,
            find,
            caseSensitive,
            record.title,
            "chronicleTitles",
            allIds[i],
            "title",
            "Title",
            undefined,
            undefined
          )
        );
      }
    }

    // 3. Chronicle annotations
    if (contexts.has("chronicleAnnotations")) {
      const annotatedIds = Object.values(chronicleNavItems)
        .filter((nav) => nav.historianNoteCount > 0)
        .map((nav) => nav.chronicleId);

      for (let i = 0; i < annotatedIds.length; i++) {
        setScanProgress(`Chronicle annotations ${i + 1}/${annotatedIds.length}`);
        const record = await getChronicle(annotatedIds[i]);
        if (!record?.historianNotes) continue;
        const name = record.title || chronicleNavItems[annotatedIds[i]]?.name || "Untitled";

        for (const note of record.historianNotes) {
          if (!isNoteActive(note)) continue;
          allMatches.push(
            ...scanText(
              note.text,
              find,
              caseSensitive,
              name,
              "chronicleAnnotations",
              annotatedIds[i],
              undefined,
              undefined,
              note.noteId,
              note.text
            )
          );
          // Also scan anchor phrases
          if (note.anchorPhrase) {
            allMatches.push(
              ...scanText(
                note.anchorPhrase,
                find,
                caseSensitive,
                name + " (anchor)",
                "chronicleAnnotations",
                annotatedIds[i],
                undefined,
                undefined,
                note.noteId,
                note.text
              )
            );
          }
        }
      }
    }

    // 4. Entity annotations
    if (contexts.has("entityAnnotations")) {
      const annotatedNavs = navEntities.filter((n) => n.hasHistorianNotes);
      setScanProgress(`Entity annotations: loading ${annotatedNavs.length} entities`);

      const fullEntities = await useEntityStore
        .getState()
        .loadEntities(annotatedNavs.map((n) => n.id));

      for (let i = 0; i < fullEntities.length; i++) {
        if (i % 50 === 0) setScanProgress(`Entity annotations ${i + 1}/${fullEntities.length}`);
        const entity = fullEntities[i];
        const notes = entity.enrichment?.historianNotes;
        if (!notes) continue;

        for (const note of notes) {
          if (!isNoteActive(note)) continue;
          allMatches.push(
            ...scanText(
              note.text,
              find,
              caseSensitive,
              entity.name,
              "entityAnnotations",
              entity.id,
              undefined,
              undefined,
              note.noteId,
              note.text
            )
          );
          if (note.anchorPhrase) {
            allMatches.push(
              ...scanText(
                note.anchorPhrase,
                find,
                caseSensitive,
                entity.name + " (anchor)",
                "entityAnnotations",
                entity.id,
                undefined,
                undefined,
                note.noteId,
                note.text
              )
            );
          }
        }
      }
    }

    // 5. Era narrative content
    if (contexts.has("eraNarrativeContent")) {
      const simRunId = useChronicleStore.getState().simulationRunId;
      if (simRunId) {
        const allNarratives = await getEraNarrativesForSimulation(simRunId);
        const completedNarratives = allNarratives.filter(
          (n) => n.status === "complete" || n.status === "step_complete"
        );

        for (let i = 0; i < completedNarratives.length; i++) {
          setScanProgress(`Era narratives ${i + 1}/${completedNarratives.length}`);
          const record = completedNarratives[i];
          const { content } = resolveActiveContent(record);
          if (!content) continue;
          allMatches.push(
            ...scanText(
              content,
              find,
              caseSensitive,
              record.eraName,
              "eraNarrativeContent",
              record.narrativeId,
              "activeContent",
              "Active Version",
              undefined,
              undefined
            )
          );
        }
      }
    }

    setScanProgress("");
    setMatches(allMatches);

    const initial: Record<string, boolean> = {};
    for (const m of allMatches) initial[m.id] = true;
    setDecisions(initial);

    // Expand first group per context
    const firstKeys = new Set<string>();
    const seen = new Set<SearchContext>();
    for (const m of allMatches) {
      if (!seen.has(m.context)) {
        firstKeys.add(`${m.context}:${m.sourceId}`);
        seen.add(m.context);
      }
    }
    setExpandedGroups(firstKeys);

    setPhase(allMatches.length > 0 ? "preview" : "empty");
  }, [find, caseSensitive, contexts, chronicleNavItems, navEntities]);

  // --- Generate LLM Variants ---
  const handleGenerate = useCallback(() => {
    setPhase("generating");
    setError(null);

    // Only annotation matches go through LLM
    const annotationMatches = matches.filter(
      (m) => m.context === "chronicleAnnotations" || m.context === "entityAnnotations"
    );

    // Dedupe by (sourceId, noteId) — one request per unique note
    const noteMap = new Map<string, CorpusMatch>();
    let batchIdx = 0;
    for (const m of annotationMatches) {
      const key = `${m.sourceId}:${m.noteId}`;
      if (!noteMap.has(key)) {
        m.batchIndex = batchIdx++;
        noteMap.set(key, m);
      }
    }
    const uniqueNoteMatches = Array.from(noteMap.values());

    // Build batches
    const batches: CorpusMatch[][] = [];
    for (let i = 0; i < uniqueNoteMatches.length; i += BATCH_SIZE) {
      batches.push(uniqueNoteMatches.slice(i, i + BATCH_SIZE));
    }

    const dispatchTime = Date.now();
    dispatchTimeRef.current = dispatchTime;
    expectedBatchCountRef.current = batches.length;

    for (let bi = 0; bi < batches.length; bi++) {
      const batch = batches[bi];
      const payload: MotifVariationPayload = {
        motifLabel: find,
        instances: batch.map((m) => ({
          index: m.batchIndex,
          entityName: m.sourceName,
          noteId: m.noteId || "",
          annotationText: m.noteText || "",
          matchedPhrase: m.matchedText,
        })),
      };

      const syntheticEntity = {
        id: `corpus_fr_${dispatchTime}_${bi}`,
        name: `Find/Replace: "${find}" (batch ${bi + 1})`,
        kind: "motif" as string,
        subtype: "variation" as string,
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
        setError(`Failed to dispatch batch ${bi + 1}: ${err}`);
        setPhase("preview");
        return;
      }
    }
  }, [matches, find]);

  // --- Watch queue for LLM completion ---
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
      const currentMatches = matchesRef.current;

      for (const item of completed) {
        if (!item.result?.description) continue;
        try {
          const results = JSON.parse(item.result.description) as MotifVariationResult[];
          for (const r of results) {
            const match = currentMatches.find((m) => m.batchIndex === r.index);
            if (match) {
              // Apply variant to all matches with same sourceId + noteId
              for (const m of currentMatches) {
                if (m.sourceId === match.sourceId && m.noteId === match.noteId) {
                  variantMap.set(m.id, r.variant);
                }
              }
            }
          }
        } catch {
          // Skip unparseable results
        }
      }

      setVariants(variantMap);

      // Auto-reject matches without variants
      setDecisions((prev) => {
        const next = { ...prev };
        for (const m of currentMatches) {
          if (
            (m.context === "chronicleAnnotations" || m.context === "entityAnnotations") &&
            !variantMap.has(m.id)
          ) {
            next[m.id] = false;
          }
        }
        return next;
      });

      setPhase(variantMap.size > 0 ? "review" : "empty");
    }
  }, [phase, queue]);

  // --- Apply ---
  const handleApply = useCallback(async () => {
    setPhase("applying");
    let total = 0;

    // 1. Chronicle content — group by (chronicleId, contentField)
    const contentByChronicle = new Map<string, Map<string, number[]>>();
    for (const m of matches) {
      if (m.context !== "chronicleContent" || !decisions[m.id]) continue;
      if (!contentByChronicle.has(m.sourceId)) contentByChronicle.set(m.sourceId, new Map());
      const fields = contentByChronicle.get(m.sourceId);
      if (!fields.has(m.contentField)) fields.set(m.contentField, []);
      fields.get(m.contentField).push(m.position);
    }

    for (const [chronicleId, fields] of contentByChronicle) {
      const record = await getChronicle(chronicleId);
      if (!record) continue;

      for (const [field, positions] of fields) {
        if (field === "final" && record.finalContent) {
          record.finalContent = applySelectiveReplace(
            record.finalContent,
            find,
            replace,
            positions
          );
          total += positions.length;
        } else if (field === "assembled" && record.assembledContent) {
          record.assembledContent = applySelectiveReplace(
            record.assembledContent,
            find,
            replace,
            positions
          );
          total += positions.length;
        }
      }

      record.updatedAt = Date.now();
      await putChronicle(record);
    }

    // 2. Chronicle titles — group by chronicleId
    const titleByChronicle = new Map<string, number[]>();
    for (const m of matches) {
      if (m.context !== "chronicleTitles" || !decisions[m.id]) continue;
      if (!titleByChronicle.has(m.sourceId)) titleByChronicle.set(m.sourceId, []);
      titleByChronicle.get(m.sourceId).push(m.position);
    }

    for (const [chronicleId, positions] of titleByChronicle) {
      const record = await getChronicle(chronicleId);
      if (!record?.title) continue;

      record.title = applySelectiveReplace(record.title, find, replace, positions);
      record.updatedAt = Date.now();
      await putChronicle(record);
      total += positions.length;
    }

    // 3. Chronicle annotations — group by chronicleId
    const chronAnnotChanges = new Map<
      string,
      Map<string, { noteText: string; positions: number[]; variant?: string }>
    >();
    for (const m of matches) {
      if (m.context !== "chronicleAnnotations" || !decisions[m.id] || !m.noteId) continue;
      if (!chronAnnotChanges.has(m.sourceId)) chronAnnotChanges.set(m.sourceId, new Map());
      const notes = chronAnnotChanges.get(m.sourceId);
      if (!notes.has(m.noteId))
        notes.set(m.noteId, { noteText: m.noteText, positions: [], variant: variants.get(m.id) });
      else notes.get(m.noteId).positions.push(m.position);
      if (!notes.get(m.noteId).positions.includes(m.position))
        notes.get(m.noteId).positions.push(m.position);
    }

    for (const [chronicleId, noteChanges] of chronAnnotChanges) {
      const record = await getChronicle(chronicleId);
      if (!record?.historianNotes) continue;

      const updatedNotes: HistorianNote[] = record.historianNotes.map((n) => ({ ...n }));
      for (const [noteId, change] of noteChanges) {
        const noteIdx = updatedNotes.findIndex((n) => n.noteId === noteId);
        if (noteIdx === -1) continue;

        if (llmMode && change.variant) {
          if (updatedNotes[noteIdx].text === change.noteText) {
            updatedNotes[noteIdx] = { ...updatedNotes[noteIdx], text: change.variant };
            total++;
          }
        } else {
          const newText = applySelectiveReplace(
            updatedNotes[noteIdx].text,
            find,
            replace,
            change.positions
          );
          if (newText !== updatedNotes[noteIdx].text) {
            updatedNotes[noteIdx] = { ...updatedNotes[noteIdx], text: newText };
            // Also replace in anchor phrase if it matches
            if (updatedNotes[noteIdx].anchorPhrase) {
              updatedNotes[noteIdx] = {
                ...updatedNotes[noteIdx],
                anchorPhrase: updatedNotes[noteIdx].anchorPhrase.split(find).join(replace),
              };
            }
            total += change.positions.length;
          }
        }
      }

      await updateChronicleHistorianNotes(chronicleId, updatedNotes);
    }

    // 4. Entity annotations — group by entityId
    const entityAnnotChanges = new Map<
      string,
      Map<string, { noteText: string; positions: number[]; variant?: string }>
    >();
    for (const m of matches) {
      if (m.context !== "entityAnnotations" || !decisions[m.id] || !m.noteId) continue;
      if (!entityAnnotChanges.has(m.sourceId)) entityAnnotChanges.set(m.sourceId, new Map());
      const notes = entityAnnotChanges.get(m.sourceId);
      if (!notes.has(m.noteId))
        notes.set(m.noteId, { noteText: m.noteText, positions: [], variant: variants.get(m.id) });
      if (!notes.get(m.noteId).positions.includes(m.position))
        notes.get(m.noteId).positions.push(m.position);
    }

    const updatedEntityIds: string[] = [];
    for (const [entityId, noteChanges] of entityAnnotChanges) {
      const entity = await useEntityStore.getState().loadEntity(entityId);
      if (!entity?.enrichment?.historianNotes) continue;

      const updatedNotes: HistorianNote[] = entity.enrichment.historianNotes.map((n) => ({ ...n }));
      for (const [noteId, change] of noteChanges) {
        const noteIdx = updatedNotes.findIndex((n) => n.noteId === noteId);
        if (noteIdx === -1) continue;

        if (llmMode && change.variant) {
          if (updatedNotes[noteIdx].text === change.noteText) {
            updatedNotes[noteIdx] = { ...updatedNotes[noteIdx], text: change.variant };
            total++;
          }
        } else {
          const newText = applySelectiveReplace(
            updatedNotes[noteIdx].text,
            find,
            replace,
            change.positions
          );
          if (newText !== updatedNotes[noteIdx].text) {
            updatedNotes[noteIdx] = { ...updatedNotes[noteIdx], text: newText };
            if (updatedNotes[noteIdx].anchorPhrase) {
              updatedNotes[noteIdx] = {
                ...updatedNotes[noteIdx],
                anchorPhrase: updatedNotes[noteIdx].anchorPhrase.split(find).join(replace),
              };
            }
            total += change.positions.length;
          }
        }
      }

      await setHistorianNotes(entityId, updatedNotes);
      updatedEntityIds.push(entityId);
    }

    // 5. Era narrative content — group by narrativeId
    const eraNarrativeChanges = new Map<string, number[]>();
    for (const m of matches) {
      if (m.context !== "eraNarrativeContent" || !decisions[m.id]) continue;
      if (!eraNarrativeChanges.has(m.sourceId)) eraNarrativeChanges.set(m.sourceId, []);
      eraNarrativeChanges.get(m.sourceId).push(m.position);
    }

    for (const [narrativeId, positions] of eraNarrativeChanges) {
      const record = await getEraNarrative(narrativeId);
      if (!record) continue;

      const { activeVersionId } = resolveActiveContent(record);
      const versions = [...(record.contentVersions || [])];
      const vIdx = versions.findIndex((v) => v.versionId === activeVersionId);
      if (vIdx === -1) continue;

      const updated = { ...versions[vIdx] };
      updated.content = applySelectiveReplace(updated.content, find, replace, positions);
      updated.wordCount = updated.content.split(/\s+/).filter(Boolean).length;
      versions[vIdx] = updated;

      await updateEraNarrative(narrativeId, { contentVersions: versions });
      total += positions.length;
    }

    // Refresh stores
    if (contentByChronicle.size > 0 || titleByChronicle.size > 0 || chronAnnotChanges.size > 0) {
      await useChronicleStore.getState().refreshAll();
    }
    if (updatedEntityIds.length > 0) {
      await reloadEntities(updatedEntityIds);
    }

    setResultCount(total);
    setPhase("done");
  }, [matches, decisions, find, replace, llmMode, variants]);

  // --- Decision helpers ---
  const toggleDecision = useCallback((id: string) => {
    setDecisions((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const acceptAllMatches = useCallback(() => {
    setDecisions((prev) => {
      const next = { ...prev };
      const literalContexts: Set<SearchContext> = new Set([
        "chronicleContent",
        "chronicleTitles",
        "eraNarrativeContent",
      ]);
      for (const m of matches) {
        if (!llmMode || literalContexts.has(m.context) || variants.has(m.id)) next[m.id] = true;
      }
      return next;
    });
  }, [matches, llmMode, variants]);

  const rejectAllMatches = useCallback(() => {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const m of matches) next[m.id] = false;
      return next;
    });
  }, [matches]);

  const acceptGroup = useCallback(
    (groupMatches: CorpusMatch[]) => {
      setDecisions((prev) => {
        const next = { ...prev };
        const literalContexts: Set<SearchContext> = new Set([
          "chronicleContent",
          "chronicleTitles",
          "eraNarrativeContent",
        ]);
        for (const m of groupMatches) {
          if (!llmMode || literalContexts.has(m.context) || variants.has(m.id)) next[m.id] = true;
        }
        return next;
      });
    },
    [llmMode, variants]
  );

  const rejectGroup = useCallback((groupMatches: CorpusMatch[]) => {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const m of groupMatches) next[m.id] = false;
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

  const handleReset = useCallback(() => {
    setPhase("input");
    setMatches([]);
    setDecisions({});
    setExpandedGroups(new Set());
    setVariants(new Map());
    setResultCount(0);
    setError(null);
    setScanProgress("");
  }, []);

  // --- Stats ---
  const acceptCount = useMemo(() => Object.values(decisions).filter(Boolean).length, [decisions]);

  // --- Groups: context → source → matches ---
  const groupedByContext = useMemo(() => {
    const result: Array<{
      context: SearchContext;
      label: string;
      sourceGroups: Array<{ key: string; label: string; matches: CorpusMatch[] }>;
    }> = [];

    for (const ctx of [
      "chronicleContent",
      "chronicleTitles",
      "chronicleAnnotations",
      "entityAnnotations",
      "eraNarrativeContent",
    ] as SearchContext[]) {
      const ctxMatches = matches.filter((m) => m.context === ctx);
      if (ctxMatches.length === 0) continue;

      const sourceMap = new Map<string, { key: string; label: string; matches: CorpusMatch[] }>();
      for (const m of ctxMatches) {
        const key = `${ctx}:${m.sourceId}`;
        if (!sourceMap.has(key)) {
          const label = m.contentFieldLabel
            ? `${m.sourceName} \u2014 ${m.contentFieldLabel}`
            : m.sourceName;
          sourceMap.set(key, { key, label, matches: [] });
        }
        sourceMap.get(key).matches.push(m);
      }

      result.push({
        context: ctx,
        label: CONTEXT_LABELS[ctx],
        sourceGroups: Array.from(sourceMap.values()),
      });
    }

    return result;
  }, [matches]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="cfr-root">
      {/* Input phase */}
      {phase === "input" && (
        <div className="cfr-input-form">
          {/* Context checkboxes */}
          <div>
            <label className="cfr-field-label">Search in</label>
            <div className="cfr-checkbox-row">
              {(
                [
                  "chronicleContent",
                  "chronicleTitles",
                  "chronicleAnnotations",
                  "entityAnnotations",
                  "eraNarrativeContent",
                ] as SearchContext[]
              ).map((ctx) => (
                <label key={ctx} className="cfr-context-checkbox">
                  <input
                    type="checkbox"
                    checked={contexts.has(ctx)}
                    onChange={() => toggleContext(ctx)}
                    className="cfr-cursor-pointer"
                  />
                  {CONTEXT_LABELS[ctx]}
                </label>
              ))}
            </div>
          </div>

          {/* Find / Replace inputs */}
          <div>
            <label htmlFor="find" className="cfr-field-label cfr-field-label-tight">Find</label>
            <input id="find"
              ref={inputRef}
              value={find}
              onChange={(e) => setFind(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && find && contexts.size > 0) void handleScan(); }}
              placeholder="Text to find..."
              className="cfr-text-input"
            />
          </div>
          <div>
            <label htmlFor="replace-with" className="cfr-field-label cfr-field-label-tight">Replace with</label>
            <input id="replace-with"
              value={replace}
              onChange={(e) => setReplace(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && find && contexts.size > 0) void handleScan(); }}
              placeholder="Replacement text..."
              className="cfr-text-input"
            />
          </div>

          {/* Options row */}
          <div className="cfr-options-row">
            <label className="cfr-option-label">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={() => setCaseSensitive(!caseSensitive)}
                className="cfr-cursor-pointer"
              />
              Case sensitive
            </label>
            <label
              className={`cfr-option-label ${hasAnnotationContext ? "" : "cfr-option-label-disabled"}`}
              title={
                hasAnnotationContext
                  ? "Use LLM to generate contextual replacements for annotation matches"
                  : "LLM mode requires annotation contexts"
              }
            >
              <input
                type="checkbox"
                checked={llmMode}
                onChange={() => setLlmMode(!llmMode)}
                disabled={!hasAnnotationContext}
                className={hasAnnotationContext ? "cfr-cursor-pointer" : "cfr-cursor-not-allowed"}
              />
              LLM-enhanced replace
            </label>
          </div>

          <div className="cfr-actions-row">
            <button
              onClick={() => void handleScan()}
              disabled={!find || contexts.size === 0}
              className={`illuminator-button cfr-btn-find ${find && contexts.size > 0 ? "" : "cfr-btn-half-opacity"}`}
            >
              Find Matches
            </button>
          </div>
        </div>
      )}

      {/* Scanning */}
      {phase === "scanning" && (
        <div className="cfr-phase-center">
          <div className="cfr-phase-title">Scanning...</div>
          {scanProgress && <div className="cfr-phase-subtitle">{scanProgress}</div>}
        </div>
      )}

      {/* Empty */}
      {phase === "empty" && (
        <div className="cfr-empty-center">
          <div className="cfr-empty-msg">No matches found for &ldquo;{find}&rdquo;</div>
          <button
            onClick={handleReset}
            className="illuminator-button illuminator-button-secondary cfr-btn-back"
          >
            Back
          </button>
        </div>
      )}

      {/* Preview / Review phase */}
      {(phase === "preview" || phase === "review") && (
        <div>
          {/* Summary bar */}
          <div className="cfr-summary-bar">
            <span>
              <strong>{find}</strong>
              {" \u2192 "}
              {llmMode && phase === "review" ? (
                <em className="cfr-summary-em">contextual variants</em>
              ) : (
                <strong>{replace || <em className="cfr-summary-em">(delete)</em>}</strong>
              )}
            </span>
            <span className="cfr-summary-muted">|</span>
            <span className="cfr-summary-accept">{acceptCount} accept</span>
            <span className="cfr-summary-reject">{matches.length - acceptCount} reject</span>
            <span className="cfr-summary-muted">/ {matches.length} total</span>
            {phase === "review" && (
              <span className="cfr-summary-muted">({variants.size} variants)</span>
            )}
            <div className="cfr-summary-spacer" />
            <button onClick={acceptAllMatches} className="cfr-summary-link cfr-summary-link-accept">
              Accept All
            </button>
            <button onClick={rejectAllMatches} className="cfr-summary-link cfr-summary-link-reject">
              Reject All
            </button>
          </div>

          {error && <div className="cfr-error-banner">{error}</div>}

          {/* Grouped matches */}
          {groupedByContext.map((ctxGroup) => (
            <ContextSection
              key={ctxGroup.context}
              contextLabel={ctxGroup.label}
              sourceGroups={ctxGroup.sourceGroups}
              replace={replace}
              variants={variants}
              decisions={decisions}
              onToggle={toggleDecision}
              onAcceptGroup={acceptGroup}
              onRejectGroup={rejectGroup}
              expandedGroups={expandedGroups}
              onToggleExpand={toggleExpand}
            />
          ))}

          {/* Footer actions */}
          <div className="cfr-footer">
            <button
              onClick={handleReset}
              className="illuminator-button illuminator-button-secondary cfr-btn-back"
            >
              Back
            </button>
            {phase === "preview" && llmMode && hasAnnotationContext && (
              <button
                onClick={handleGenerate}
                className="illuminator-button illuminator-button-secondary cfr-btn-back"
              >
                Generate Variants (
                {
                  matches.filter(
                    (m) => m.context === "chronicleAnnotations" || m.context === "entityAnnotations"
                  ).length
                }
                )
              </button>
            )}
            <button
              onClick={() => void handleApply()}
              disabled={acceptCount === 0}
              className={`illuminator-button cfr-btn-apply ${acceptCount > 0 ? "" : "cfr-btn-half-opacity"}`}
            >
              Apply ({acceptCount} {acceptCount === 1 ? "replacement" : "replacements"})
            </button>
          </div>
        </div>
      )}

      {/* Generating */}
      {phase === "generating" && (
        <div className="cfr-phase-center">
          <div className="cfr-phase-title">Generating contextual variants...</div>
          <div className="cfr-phase-subtitle">
            {
              matches.filter(
                (m) => m.context === "chronicleAnnotations" || m.context === "entityAnnotations"
              ).length
            }{" "}
            annotation matches
            {" \u00B7 "}
            {Math.ceil(
              matches.filter(
                (m) => m.context === "chronicleAnnotations" || m.context === "entityAnnotations"
              ).length / BATCH_SIZE
            )}{" "}
            LLM calls
          </div>
          {error && <div className="cfr-error-inline">{error}</div>}
        </div>
      )}

      {/* Applying / Done */}
      {(phase === "applying" || phase === "done") && (
        <div className="cfr-phase-center">
          <div className="cfr-phase-title">
            {phase === "applying" ? "Applying replacements..." : "Replace Complete"}
          </div>
          {phase === "done" && (
            <>
              <div className="cfr-done-msg">
                {resultCount} replacement{resultCount !== 1 ? "s" : ""} applied.
              </div>
              <button onClick={handleReset} className="illuminator-button cfr-btn-new-search">
                New Search
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
