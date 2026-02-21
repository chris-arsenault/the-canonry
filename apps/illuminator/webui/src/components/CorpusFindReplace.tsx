/**
 * CorpusFindReplace — Unified find/replace across chronicle content,
 * chronicle annotations, and entity annotations.
 *
 * Consolidates ChronicleFindReplaceModal (literal replace on chronicle content)
 * and AnnotationMotifTool (LLM-powered replace on entity annotations) into a
 * single tool with selectable search contexts and optional LLM-enhanced mode.
 *
 * Three-phase flow: input → scan/preview → apply
 * Optional LLM branch: preview → generate → review → apply
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { getChronicle, putChronicle, updateChronicleHistorianNotes } from '../lib/db/chronicleRepository';
import { useChronicleStore } from '../lib/db/chronicleStore';
import { useEntityStore } from '../lib/db/entityStore';
import { useEntityNavList } from '../lib/db/entitySelectors';
import { setHistorianNotes } from '../lib/db/entityRepository';
import { getEnqueue } from '../lib/db/enrichmentQueueBridge';
import { useEnrichmentQueueStore } from '../lib/db/enrichmentQueueStore';
import { reloadEntities } from '../hooks/useEntityCrud';
import type { HistorianNote } from '../lib/historianTypes';
import { isNoteActive } from '../lib/historianTypes';
import type { MotifVariationPayload, MotifVariationResult } from '../workers/tasks/motifVariationTask';

// ============================================================================
// Types
// ============================================================================

type SearchContext = 'chronicleContent' | 'chronicleAnnotations' | 'entityAnnotations';

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

type Phase = 'input' | 'scanning' | 'preview' | 'generating' | 'review' | 'applying' | 'done' | 'empty';

const CONTEXT_RADIUS = 80;
const BATCH_SIZE = 8;

const CONTEXT_LABELS: Record<SearchContext, string> = {
  chronicleContent: 'Chronicle Content',
  chronicleAnnotations: 'Chronicle Annotations',
  entityAnnotations: 'Entity Annotations',
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
  noteText: string | undefined,
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
      id: `${searchContext}:${sourceId}:${noteId || contentField || 'text'}:${idx}`,
      context: searchContext,
      sourceId,
      sourceName,
      noteId,
      noteText,
      contentField,
      contentFieldLabel,
      position: startPos,
      contextBefore: (ctxStart > 0 ? '\u2026' : '') + text.slice(ctxStart, startPos),
      matchedText: text.slice(startPos, startPos + find.length), // preserve original case
      contextAfter: text.slice(startPos + find.length, ctxEnd) + (ctxEnd < text.length ? '\u2026' : ''),
    });
    startPos += find.length;
    idx++;
  }
  return matches;
}

function applySelectiveReplace(text: string, find: string, replace: string, acceptedPositions: number[]): string {
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
function extractDiff(original: string, rewritten: string): { prefix: string; oldMiddle: string; newMiddle: string; suffix: string } {
  let prefixLen = 0;
  while (prefixLen < original.length && prefixLen < rewritten.length && original[prefixLen] === rewritten[prefixLen]) {
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
  while (prefixLen > 0 && original[prefixLen - 1] !== ' ' && original[prefixLen - 1] !== '\n') prefixLen--;
  while (suffixLen > 0 && original[original.length - suffixLen] !== ' ' && original[original.length - suffixLen] !== '\n') suffixLen--;

  const contextChars = 80;
  const prefix = original.slice(Math.max(0, prefixLen - contextChars), prefixLen);
  const suffix = original.slice(original.length - suffixLen, Math.min(original.length, original.length - suffixLen + contextChars));
  return {
    prefix: (prefixLen - contextChars > 0 ? '\u2026' : '') + prefix,
    oldMiddle: original.slice(prefixLen, original.length - suffixLen),
    newMiddle: rewritten.slice(prefixLen, rewritten.length - suffixLen),
    suffix: suffix + (original.length - suffixLen + contextChars < original.length ? '\u2026' : ''),
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
}: {
  match: CorpusMatch;
  replace: string;
  variant?: string;
  accepted: boolean;
  onToggle: () => void;
}) {
  const diff = variant ? extractDiff(match.noteText!, variant) : null;

  return (
    <div
      style={{
        padding: '6px 10px',
        background: accepted ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
        borderRadius: '4px',
        border: '1px solid var(--border-color)',
        opacity: accepted ? 1 : 0.5,
        marginBottom: '3px',
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-start',
      }}
    >
      <input
        type="checkbox"
        checked={accepted}
        onChange={onToggle}
        style={{ marginTop: '3px', cursor: 'pointer', flexShrink: 0 }}
      />
      <div
        style={{
          fontSize: '11px',
          lineHeight: '1.7',
          fontFamily: diff ? undefined : 'monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          flex: 1,
        }}
      >
        {diff ? (
          <>
            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{diff.prefix}</span>
            <span
              style={{
                background: accepted ? 'rgba(239, 68, 68, 0.15)' : 'rgba(139, 115, 85, 0.15)',
                textDecoration: accepted ? 'line-through' : 'none',
                padding: '1px 2px',
                borderRadius: '2px',
              }}
            >
              {diff.oldMiddle}
            </span>
            {accepted && (
              <>
                {' '}
                <span style={{ background: 'rgba(34, 197, 94, 0.2)', padding: '1px 2px', borderRadius: '2px' }}>
                  {diff.newMiddle}
                </span>
              </>
            )}
            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{diff.suffix}</span>
          </>
        ) : (
          <>
            <span style={{ color: 'var(--text-muted)' }}>{match.contextBefore}</span>
            <span style={{ background: 'rgba(239, 68, 68, 0.2)', textDecoration: 'line-through', padding: '0 1px', borderRadius: '2px' }}>
              {match.matchedText}
            </span>
            {accepted && (
              <span style={{ background: 'rgba(34, 197, 94, 0.2)', padding: '0 1px', borderRadius: '2px' }}>
                {replace}
              </span>
            )}
            <span style={{ color: 'var(--text-muted)' }}>{match.contextAfter}</span>
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
}: {
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
}) {
  const acceptCount = matches.filter((m) => decisions[m.id]).length;

  return (
    <div style={{ marginBottom: '4px', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
      <div
        onClick={onToggleExpand}
        style={{
          padding: '8px 12px',
          background: 'var(--bg-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '10px', flexShrink: 0 }}>
          {expanded ? '\u25BC' : '\u25B6'}
        </span>
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {matches.length} {matches.length === 1 ? 'match' : 'matches'}
        </span>
        {acceptCount > 0 && <span style={{ fontSize: '10px', color: '#22c55e' }}>{acceptCount}{'\u2713'}</span>}
        {matches.length - acceptCount > 0 && <span style={{ fontSize: '10px', color: '#ef4444' }}>{matches.length - acceptCount}{'\u2717'}</span>}
        <button
          onClick={(e) => { e.stopPropagation(); onAcceptAll(); }}
          title="Accept all in this group"
          style={{ background: 'none', border: 'none', color: '#22c55e', fontSize: '10px', cursor: 'pointer', padding: '0 4px' }}
        >
          {'all\u2713'}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRejectAll(); }}
          title="Reject all in this group"
          style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '10px', cursor: 'pointer', padding: '0 4px' }}
        >
          {'all\u2717'}
        </button>
      </div>
      {expanded && (
        <div style={{ padding: '6px 8px' }}>
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
}: {
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
}) {
  const totalMatches = sourceGroups.reduce((sum, g) => sum + g.matches.length, 0);
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
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

  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(true);
  const [contexts, setContexts] = useState<Set<SearchContext>>(
    new Set(['chronicleContent', 'chronicleAnnotations', 'entityAnnotations']),
  );
  const [llmMode, setLlmMode] = useState(false);
  const [phase, setPhase] = useState<Phase>('input');
  const [matches, setMatches] = useState<CorpusMatch[]>([]);
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [resultCount, setResultCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState('');

  // LLM mode state
  const [variants, setVariants] = useState<Map<string, string>>(new Map());
  const dispatchTimeRef = useRef<number>(0);
  const expectedBatchCountRef = useRef<number>(0);
  const matchesRef = useRef<CorpusMatch[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase === 'input' && inputRef.current) inputRef.current.focus();
  }, [phase]);

  useEffect(() => {
    matchesRef.current = matches;
  }, [matches]);

  const hasAnnotationContext = contexts.has('chronicleAnnotations') || contexts.has('entityAnnotations');

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
    setPhase('scanning');
    setError(null);
    const allMatches: CorpusMatch[] = [];

    // 1. Chronicle content
    if (contexts.has('chronicleContent')) {
      const completeIds = Object.values(chronicleNavItems)
        .filter((nav) => nav.status === 'complete')
        .map((nav) => nav.chronicleId);

      for (let i = 0; i < completeIds.length; i++) {
        setScanProgress(`Chronicle content ${i + 1}/${completeIds.length}`);
        const record = await getChronicle(completeIds[i]);
        if (!record) continue;
        const name = record.title || chronicleNavItems[completeIds[i]]?.name || 'Untitled';

        if (record.finalContent) {
          allMatches.push(...scanText(record.finalContent, find, caseSensitive, name, 'chronicleContent', completeIds[i], 'final', 'Published', undefined, undefined));
        }
        if (record.assembledContent && record.assembledContent !== record.finalContent) {
          allMatches.push(...scanText(record.assembledContent, find, caseSensitive, name, 'chronicleContent', completeIds[i], 'assembled', 'Current Draft', undefined, undefined));
        }
      }
    }

    // 2. Chronicle annotations
    if (contexts.has('chronicleAnnotations')) {
      const annotatedIds = Object.values(chronicleNavItems)
        .filter((nav) => nav.historianNoteCount > 0)
        .map((nav) => nav.chronicleId);

      for (let i = 0; i < annotatedIds.length; i++) {
        setScanProgress(`Chronicle annotations ${i + 1}/${annotatedIds.length}`);
        const record = await getChronicle(annotatedIds[i]);
        if (!record?.historianNotes) continue;
        const name = record.title || chronicleNavItems[annotatedIds[i]]?.name || 'Untitled';

        for (const note of record.historianNotes) {
          if (!isNoteActive(note)) continue;
          allMatches.push(...scanText(note.text, find, caseSensitive, name, 'chronicleAnnotations', annotatedIds[i], undefined, undefined, note.noteId, note.text));
          // Also scan anchor phrases
          if (note.anchorPhrase) {
            allMatches.push(...scanText(note.anchorPhrase, find, caseSensitive, name + ' (anchor)', 'chronicleAnnotations', annotatedIds[i], undefined, undefined, note.noteId, note.text));
          }
        }
      }
    }

    // 3. Entity annotations
    if (contexts.has('entityAnnotations')) {
      const annotatedNavs = navEntities.filter((n) => n.hasHistorianNotes);
      setScanProgress(`Entity annotations: loading ${annotatedNavs.length} entities`);

      const fullEntities = await useEntityStore.getState().loadEntities(annotatedNavs.map((n) => n.id));

      for (let i = 0; i < fullEntities.length; i++) {
        if (i % 50 === 0) setScanProgress(`Entity annotations ${i + 1}/${fullEntities.length}`);
        const entity = fullEntities[i];
        const notes = entity.enrichment?.historianNotes;
        if (!notes) continue;

        for (const note of notes) {
          if (!isNoteActive(note)) continue;
          allMatches.push(...scanText(note.text, find, caseSensitive, entity.name, 'entityAnnotations', entity.id, undefined, undefined, note.noteId, note.text));
          if (note.anchorPhrase) {
            allMatches.push(...scanText(note.anchorPhrase, find, caseSensitive, entity.name + ' (anchor)', 'entityAnnotations', entity.id, undefined, undefined, note.noteId, note.text));
          }
        }
      }
    }

    setScanProgress('');
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

    setPhase(allMatches.length > 0 ? 'preview' : 'empty');
  }, [find, caseSensitive, contexts, chronicleNavItems, navEntities]);

  // --- Generate LLM Variants ---
  const handleGenerate = useCallback(() => {
    setPhase('generating');
    setError(null);

    // Only annotation matches go through LLM
    const annotationMatches = matches.filter(
      (m) => m.context === 'chronicleAnnotations' || m.context === 'entityAnnotations',
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
          index: m.batchIndex!,
          entityName: m.sourceName,
          noteId: m.noteId || '',
          annotationText: m.noteText || '',
          matchedPhrase: m.matchedText,
        })),
      };

      const syntheticEntity = {
        id: `corpus_fr_${dispatchTime}_${bi}`,
        name: `Find/Replace: "${find}" (batch ${bi + 1})`,
        kind: 'motif' as string,
        subtype: 'variation' as string,
        prominence: 'marginal' as unknown as string,
        culture: '' as string,
        status: 'active' as string,
        description: '' as string,
        tags: {} as Record<string, unknown>,
      };

      try {
        getEnqueue()([{ entity: syntheticEntity, type: 'motifVariation' as const, prompt: JSON.stringify(payload) }]);
      } catch (err) {
        setError(`Failed to dispatch batch ${bi + 1}: ${err}`);
        setPhase('preview');
        return;
      }
    }
  }, [matches, find]);

  // --- Watch queue for LLM completion ---
  useEffect(() => {
    if (phase !== 'generating') return;
    const dispatchTime = dispatchTimeRef.current;
    if (!dispatchTime) return;

    const motifItems = queue.filter((item) => item.type === 'motifVariation' && item.queuedAt >= dispatchTime);
    if (motifItems.length === 0) return;

    const running = motifItems.filter((item) => item.status === 'running' || item.status === 'queued');
    const completed = motifItems.filter((item) => item.status === 'complete');
    const errored = motifItems.filter((item) => item.status === 'error');

    if (running.length === 0 && (completed.length > 0 || errored.length > 0)) {
      if (errored.length > 0) {
        setError(`${errored.length} batch(es) failed: ${errored[0].error || 'Unknown error'}`);
      }

      const variantMap = new Map<string, string>();
      const currentMatches = matchesRef.current;

      for (const item of completed) {
        if (!item.result?.description) continue;
        try {
          const results: MotifVariationResult[] = JSON.parse(item.result.description);
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
          if ((m.context === 'chronicleAnnotations' || m.context === 'entityAnnotations') && !variantMap.has(m.id)) {
            next[m.id] = false;
          }
        }
        return next;
      });

      setPhase(variantMap.size > 0 ? 'review' : 'empty');
    }
  }, [phase, queue]);

  // --- Apply ---
  const handleApply = useCallback(async () => {
    setPhase('applying');
    let total = 0;

    // 1. Chronicle content — group by (chronicleId, contentField)
    const contentByChronicle = new Map<string, Map<string, number[]>>();
    for (const m of matches) {
      if (m.context !== 'chronicleContent' || !decisions[m.id]) continue;
      if (!contentByChronicle.has(m.sourceId)) contentByChronicle.set(m.sourceId, new Map());
      const fields = contentByChronicle.get(m.sourceId)!;
      if (!fields.has(m.contentField!)) fields.set(m.contentField!, []);
      fields.get(m.contentField!)!.push(m.position);
    }

    for (const [chronicleId, fields] of contentByChronicle) {
      const record = await getChronicle(chronicleId);
      if (!record) continue;

      for (const [field, positions] of fields) {
        if (field === 'final' && record.finalContent) {
          record.finalContent = applySelectiveReplace(record.finalContent, find, replace, positions);
          total += positions.length;
        } else if (field === 'assembled' && record.assembledContent) {
          record.assembledContent = applySelectiveReplace(record.assembledContent, find, replace, positions);
          total += positions.length;
        }
      }

      record.updatedAt = Date.now();
      await putChronicle(record);
    }

    // 2. Chronicle annotations — group by chronicleId
    const chronAnnotChanges = new Map<string, Map<string, { noteText: string; positions: number[]; variant?: string }>>();
    for (const m of matches) {
      if (m.context !== 'chronicleAnnotations' || !decisions[m.id] || !m.noteId) continue;
      if (!chronAnnotChanges.has(m.sourceId)) chronAnnotChanges.set(m.sourceId, new Map());
      const notes = chronAnnotChanges.get(m.sourceId)!;
      if (!notes.has(m.noteId)) notes.set(m.noteId, { noteText: m.noteText!, positions: [], variant: variants.get(m.id) });
      else notes.get(m.noteId)!.positions.push(m.position);
      if (!notes.get(m.noteId)!.positions.includes(m.position)) notes.get(m.noteId)!.positions.push(m.position);
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
          const newText = applySelectiveReplace(updatedNotes[noteIdx].text, find, replace, change.positions);
          if (newText !== updatedNotes[noteIdx].text) {
            updatedNotes[noteIdx] = { ...updatedNotes[noteIdx], text: newText };
            // Also replace in anchor phrase if it matches
            if (updatedNotes[noteIdx].anchorPhrase) {
              updatedNotes[noteIdx] = {
                ...updatedNotes[noteIdx],
                anchorPhrase: updatedNotes[noteIdx].anchorPhrase!.split(find).join(replace),
              };
            }
            total += change.positions.length;
          }
        }
      }

      await updateChronicleHistorianNotes(chronicleId, updatedNotes);
    }

    // 3. Entity annotations — group by entityId
    const entityAnnotChanges = new Map<string, Map<string, { noteText: string; positions: number[]; variant?: string }>>();
    for (const m of matches) {
      if (m.context !== 'entityAnnotations' || !decisions[m.id] || !m.noteId) continue;
      if (!entityAnnotChanges.has(m.sourceId)) entityAnnotChanges.set(m.sourceId, new Map());
      const notes = entityAnnotChanges.get(m.sourceId)!;
      if (!notes.has(m.noteId)) notes.set(m.noteId, { noteText: m.noteText!, positions: [], variant: variants.get(m.id) });
      if (!notes.get(m.noteId)!.positions.includes(m.position)) notes.get(m.noteId)!.positions.push(m.position);
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
          const newText = applySelectiveReplace(updatedNotes[noteIdx].text, find, replace, change.positions);
          if (newText !== updatedNotes[noteIdx].text) {
            updatedNotes[noteIdx] = { ...updatedNotes[noteIdx], text: newText };
            if (updatedNotes[noteIdx].anchorPhrase) {
              updatedNotes[noteIdx] = {
                ...updatedNotes[noteIdx],
                anchorPhrase: updatedNotes[noteIdx].anchorPhrase!.split(find).join(replace),
              };
            }
            total += change.positions.length;
          }
        }
      }

      await setHistorianNotes(entityId, updatedNotes);
      updatedEntityIds.push(entityId);
    }

    // Refresh stores
    if (contentByChronicle.size > 0 || chronAnnotChanges.size > 0) {
      await useChronicleStore.getState().refreshAll();
    }
    if (updatedEntityIds.length > 0) {
      await reloadEntities(updatedEntityIds);
    }

    setResultCount(total);
    setPhase('done');
  }, [matches, decisions, find, replace, llmMode, variants]);

  // --- Decision helpers ---
  const toggleDecision = useCallback((id: string) => {
    setDecisions((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const acceptAllMatches = useCallback(() => {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const m of matches) {
        if (!llmMode || m.context === 'chronicleContent' || variants.has(m.id)) next[m.id] = true;
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

  const acceptGroup = useCallback((groupMatches: CorpusMatch[]) => {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const m of groupMatches) {
        if (!llmMode || m.context === 'chronicleContent' || variants.has(m.id)) next[m.id] = true;
      }
      return next;
    });
  }, [llmMode, variants]);

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
    setPhase('input');
    setMatches([]);
    setDecisions({});
    setExpandedGroups(new Set());
    setVariants(new Map());
    setResultCount(0);
    setError(null);
    setScanProgress('');
  }, []);

  // --- Stats ---
  const acceptCount = useMemo(() => Object.values(decisions).filter(Boolean).length, [decisions]);

  // --- Groups: context → source → matches ---
  const groupedByContext = useMemo(() => {
    const result: Array<{ context: SearchContext; label: string; sourceGroups: Array<{ key: string; label: string; matches: CorpusMatch[] }> }> = [];

    for (const ctx of ['chronicleContent', 'chronicleAnnotations', 'entityAnnotations'] as SearchContext[]) {
      const ctxMatches = matches.filter((m) => m.context === ctx);
      if (ctxMatches.length === 0) continue;

      const sourceMap = new Map<string, { key: string; label: string; matches: CorpusMatch[] }>();
      for (const m of ctxMatches) {
        const key = `${ctx}:${m.sourceId}`;
        if (!sourceMap.has(key)) {
          const label = m.contentFieldLabel ? `${m.sourceName} \u2014 ${m.contentFieldLabel}` : m.sourceName;
          sourceMap.set(key, { key, label, matches: [] });
        }
        sourceMap.get(key)!.matches.push(m);
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
    <div style={{ maxWidth: '800px' }}>
      {/* Input phase */}
      {phase === 'input' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Context checkboxes */}
          <div>
            <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', fontWeight: 600 }}>
              Search in
            </label>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {(['chronicleContent', 'chronicleAnnotations', 'entityAnnotations'] as SearchContext[]).map((ctx) => (
                <label key={ctx} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={contexts.has(ctx)} onChange={() => toggleContext(ctx)} style={{ cursor: 'pointer' }} />
                  {CONTEXT_LABELS[ctx]}
                </label>
              ))}
            </div>
          </div>

          {/* Find / Replace inputs */}
          <div>
            <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: 600 }}>Find</label>
            <input
              ref={inputRef}
              value={find}
              onChange={(e) => setFind(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && find && contexts.size > 0 && handleScan()}
              placeholder="Text to find..."
              style={{
                width: '100%', padding: '8px 12px', fontSize: '13px',
                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: 600 }}>Replace with</label>
            <input
              value={replace}
              onChange={(e) => setReplace(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && find && contexts.size > 0 && handleScan()}
              placeholder="Replacement text..."
              style={{
                width: '100%', padding: '8px 12px', fontSize: '13px',
                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Options row */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={caseSensitive} onChange={() => setCaseSensitive(!caseSensitive)} style={{ cursor: 'pointer' }} />
              Case sensitive
            </label>
            <label
              style={{
                display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: hasAnnotationContext ? 'pointer' : 'not-allowed',
                color: hasAnnotationContext ? 'var(--text-secondary)' : 'var(--text-muted)',
              }}
              title={hasAnnotationContext ? 'Use LLM to generate contextual replacements for annotation matches' : 'LLM mode requires annotation contexts'}
            >
              <input
                type="checkbox"
                checked={llmMode}
                onChange={() => setLlmMode(!llmMode)}
                disabled={!hasAnnotationContext}
                style={{ cursor: hasAnnotationContext ? 'pointer' : 'not-allowed' }}
              />
              LLM-enhanced replace
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button
              onClick={handleScan}
              disabled={!find || contexts.size === 0}
              className="illuminator-button"
              style={{ padding: '6px 20px', fontSize: '12px', opacity: find && contexts.size > 0 ? 1 : 0.5 }}
            >
              Find Matches
            </button>
          </div>
        </div>
      )}

      {/* Scanning */}
      {phase === 'scanning' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Scanning...</div>
          {scanProgress && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{scanProgress}</div>}
        </div>
      )}

      {/* Empty */}
      {phase === 'empty' && (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px' }}>
            No matches found for &ldquo;{find}&rdquo;
          </div>
          <button onClick={handleReset} className="illuminator-button illuminator-button-secondary" style={{ padding: '6px 16px', fontSize: '12px' }}>
            Back
          </button>
        </div>
      )}

      {/* Preview / Review phase */}
      {(phase === 'preview' || phase === 'review') && (
        <div>
          {/* Summary bar */}
          <div style={{
            marginBottom: '12px', padding: '8px 14px', background: 'var(--bg-secondary)', borderRadius: '6px',
            border: '1px solid var(--border-color)', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', fontSize: '12px',
          }}>
            <span>
              <strong>{find}</strong>
              {' \u2192 '}
              {llmMode && phase === 'review'
                ? <em style={{ color: 'var(--text-muted)' }}>contextual variants</em>
                : <strong>{replace || <em style={{ color: 'var(--text-muted)' }}>(delete)</em>}</strong>
              }
            </span>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <span style={{ color: '#22c55e' }}>{acceptCount} accept</span>
            <span style={{ color: '#ef4444' }}>{matches.length - acceptCount} reject</span>
            <span style={{ color: 'var(--text-muted)' }}>/ {matches.length} total</span>
            {phase === 'review' && <span style={{ color: 'var(--text-muted)' }}>({variants.size} variants)</span>}
            <div style={{ flex: 1 }} />
            <button onClick={acceptAllMatches} style={{ background: 'none', border: 'none', color: '#22c55e', fontSize: '10px', cursor: 'pointer', textDecoration: 'underline' }}>
              Accept All
            </button>
            <button onClick={rejectAllMatches} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '10px', cursor: 'pointer', textDecoration: 'underline' }}>
              Reject All
            </button>
          </div>

          {error && (
            <div style={{
              marginBottom: '12px', padding: '8px 14px', background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '11px', color: '#ef4444',
            }}>
              {error}
            </div>
          )}

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
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button onClick={handleReset} className="illuminator-button illuminator-button-secondary" style={{ padding: '6px 16px', fontSize: '12px' }}>
              Back
            </button>
            {phase === 'preview' && llmMode && hasAnnotationContext && (
              <button
                onClick={handleGenerate}
                className="illuminator-button illuminator-button-secondary"
                style={{ padding: '6px 16px', fontSize: '12px' }}
              >
                Generate Variants ({matches.filter((m) => m.context !== 'chronicleContent').length})
              </button>
            )}
            <button
              onClick={handleApply}
              disabled={acceptCount === 0}
              className="illuminator-button"
              style={{ padding: '6px 20px', fontSize: '12px', opacity: acceptCount > 0 ? 1 : 0.5 }}
            >
              Apply ({acceptCount} {acceptCount === 1 ? 'replacement' : 'replacements'})
            </button>
          </div>
        </div>
      )}

      {/* Generating */}
      {phase === 'generating' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Generating contextual variants...</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {matches.filter((m) => m.context !== 'chronicleContent').length} annotation matches
            {' \u00B7 '}
            {Math.ceil(matches.filter((m) => m.context !== 'chronicleContent').length / BATCH_SIZE)} LLM calls
          </div>
          {error && <div style={{ marginTop: '12px', fontSize: '12px', color: '#ef4444' }}>{error}</div>}
        </div>
      )}

      {/* Applying / Done */}
      {(phase === 'applying' || phase === 'done') && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            {phase === 'applying' ? 'Applying replacements...' : 'Replace Complete'}
          </div>
          {phase === 'done' && (
            <>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                {resultCount} replacement{resultCount !== 1 ? 's' : ''} applied.
              </div>
              <button onClick={handleReset} className="illuminator-button" style={{ padding: '6px 20px', fontSize: '12px', marginTop: '16px' }}>
                New Search
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
