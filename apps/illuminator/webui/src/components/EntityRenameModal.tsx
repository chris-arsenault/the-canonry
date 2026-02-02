/**
 * EntityRenameModal - Three-phase entity rename with full propagation
 *
 * Phase 1: Name input (roll from name-forge or free text)
 * Phase 2: Preview — collapsible accordion grouped by source (entity/chronicle).
 *          Each source shows all its matches together so the user can reason
 *          about one entity or chronicle at a time.
 * Phase 3: Apply changes
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { generate } from 'name-forge';
import { toCulture } from '../lib/chronicle/nameBank';
import {
  scanForReferences,
  buildRenamePatches,
  applyChroniclePatches,
  type RenameMatch,
  type MatchDecision,
  type RenameScanResult,
  type ScanNarrativeEvent,
  type EntityPatch,
  type EventPatch,
} from '../lib/entityRename';
import {
  getChroniclesForSimulation,
  getChronicle,
  putChronicle,
  type ChronicleRecord,
} from '../lib/db/chronicleRepository';
import type { CultureDefinition } from '@canonry/world-schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Entity {
  id: string;
  name: string;
  kind: string;
  subtype?: string;
  culture?: string;
  summary?: string;
  description?: string;
  enrichment?: {
    descriptionHistory?: Array<{
      description: string;
      replacedAt: number;
      source: string;
    }>;
  };
}

interface Relationship {
  kind: string;
  src: string;
  dst: string;
  status?: string;
}

type ModalMode = 'rename' | 'patch';

interface EntityRenameModalProps {
  entityId: string;
  entities: Entity[];
  cultures: CultureDefinition[];
  simulationRunId: string;
  relationships?: Relationship[];
  narrativeEvents?: ScanNarrativeEvent[];
  /** 'rename' = full rename flow, 'patch' = repair stale names in events */
  mode?: ModalMode;
  onApply: (manifest: {
    entityPatches: EntityPatch[];
    eventPatches: EventPatch[];
    targetEntityId: string | null;
    newName: string;
  }) => void;
  onClose: () => void;
}

type Phase = 'input' | 'scanning' | 'preview' | 'applying' | 'done';

type DecisionAction = 'accept' | 'reject' | 'edit';

interface DecisionState {
  action: DecisionAction;
  editText: string;
}

/** A source entity or chronicle with all its matches grouped together. */
interface SourceGroup {
  sourceId: string;
  sourceName: string;
  sourceType: 'entity' | 'chronicle' | 'event';
  /** True for the entity being renamed */
  isSelf: boolean;
  /** Contextual label: "related", "general", "cast", etc. */
  tier: string;
  /** Actionable matches (full, partial, metadata) */
  matches: RenameMatch[];
  /** Non-actionable FK references */
  connections: RenameMatch[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<string, string> = {
  full: '#22c55e',
  partial: '#f59e0b',
  metadata: '#6366f1',
  id_slug: '#06b6d4',
};
const TYPE_LABELS: Record<string, string> = {
  full: 'full',
  partial: 'partial',
  metadata: 'meta',
  id_slug: 'connection',
};

// ---------------------------------------------------------------------------
// Match Row — actionable match with diff + accept/reject/edit
// ---------------------------------------------------------------------------

function MatchRow({
  match,
  decision,
  newName,
  onChangeAction,
  onChangeEditText,
}: {
  match: RenameMatch;
  decision: DecisionState;
  newName: string;
  onChangeAction: (action: DecisionAction) => void;
  onChangeEditText: (text: string) => void;
}) {
  const replacementText =
    decision.action === 'edit' ? decision.editText : newName;

  return (
    <div
      style={{
        padding: '6px 10px',
        background:
          decision.action === 'reject'
            ? 'var(--bg-secondary)'
            : 'var(--bg-tertiary)',
        borderRadius: '4px',
        border: '1px solid var(--border-color)',
        opacity: decision.action === 'reject' ? 0.5 : 1,
        marginBottom: '3px',
      }}
    >
      {/* Field label + type badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '3px',
          fontSize: '10px',
          color: 'var(--text-muted)',
        }}
      >
        <span
          style={{
            background: TYPE_COLORS[match.matchType] || '#666',
            color: '#fff',
            padding: '0 4px',
            borderRadius: '2px',
            fontSize: '9px',
            fontWeight: 600,
            textTransform: 'uppercase',
          }}
        >
          {TYPE_LABELS[match.matchType] || match.matchType}
        </span>
        <span style={{ opacity: 0.6 }}>{match.field}</span>
        {match.partialFragment && (
          <span style={{ fontStyle: 'italic' }}>
            &ldquo;{match.partialFragment}&rdquo;
          </span>
        )}
      </div>

      {/* Context snippet with diff */}
      <div
        style={{
          fontSize: '11px',
          lineHeight: '1.7',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          marginBottom: '4px',
        }}
      >
        <span style={{ color: 'var(--text-muted)' }}>
          {match.contextBefore}
        </span>
        <span
          style={{
            background: 'rgba(239, 68, 68, 0.2)',
            textDecoration: 'line-through',
            padding: '0 1px',
            borderRadius: '2px',
          }}
        >
          {match.matchedText}
        </span>
        {decision.action !== 'reject' && (
          <span
            style={{
              background: 'rgba(34, 197, 94, 0.2)',
              padding: '0 1px',
              borderRadius: '2px',
            }}
          >
            {replacementText}
          </span>
        )}
        <span style={{ color: 'var(--text-muted)' }}>
          {match.contextAfter}
        </span>
      </div>

      {/* Action controls */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {(['accept', 'reject', 'edit'] as DecisionAction[]).map((action) => (
          <button
            key={action}
            onClick={() => onChangeAction(action)}
            style={{
              background:
                decision.action === action
                  ? action === 'accept'
                    ? 'rgba(34, 197, 94, 0.3)'
                    : action === 'reject'
                      ? 'rgba(239, 68, 68, 0.3)'
                      : 'rgba(99, 102, 241, 0.3)'
                  : 'var(--bg-secondary)',
              border:
                decision.action === action
                  ? `1px solid ${action === 'accept' ? '#22c55e' : action === 'reject' ? '#ef4444' : '#6366f1'}`
                  : '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: '10px',
              padding: '2px 8px',
              borderRadius: '3px',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {action}
          </button>
        ))}
        {decision.action === 'edit' && (
          <input
            type="text"
            value={decision.editText}
            onChange={(e) => onChangeEditText(e.target.value)}
            placeholder="Custom replacement..."
            style={{
              flex: 1,
              background: 'var(--bg-primary)',
              border: '1px solid #6366f1',
              color: 'var(--text-primary)',
              fontSize: '11px',
              padding: '2px 6px',
              borderRadius: '3px',
              outline: 'none',
            }}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Source Section — collapsible accordion for one entity or chronicle
// ---------------------------------------------------------------------------

function SourceSection({
  group,
  expanded,
  onToggle,
  decisions,
  newName,
  onChangeAction,
  onChangeEditText,
  onAcceptAll,
  onRejectAll,
}: {
  group: SourceGroup;
  expanded: boolean;
  onToggle: () => void;
  decisions: Map<string, DecisionState>;
  newName: string;
  onChangeAction: (matchId: string, action: DecisionAction) => void;
  onChangeEditText: (matchId: string, text: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}) {
  // Per-source stats
  let accepts = 0, rejects = 0, edits = 0;
  for (const m of group.matches) {
    const d = decisions.get(m.id);
    if (!d) continue;
    if (d.action === 'accept') accepts++;
    else if (d.action === 'reject') rejects++;
    else if (d.action === 'edit') edits++;
  }
  const total = group.matches.length;

  return (
    <div
      style={{
        marginBottom: '4px',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
        overflow: 'hidden',
      }}
    >
      {/* Clickable header */}
      <div
        onClick={onToggle}
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
        {/* Expand indicator */}
        <span
          style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            width: '10px',
            flexShrink: 0,
          }}
        >
          {expanded ? '\u25BC' : '\u25B6'}
        </span>

        {/* Source name */}
        <span
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--text-primary)',
          }}
        >
          {group.sourceName}
        </span>

        {/* Type + tier badge */}
        <span
          style={{
            fontSize: '9px',
            color: 'var(--text-muted)',
            background: 'var(--bg-primary)',
            padding: '1px 6px',
            borderRadius: '3px',
            border: '1px solid var(--border-color)',
          }}
        >
          {group.sourceType}{group.tier ? `, ${group.tier}` : ''}
        </span>

        {/* Match stats */}
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {total} {total === 1 ? 'match' : 'matches'}
          {group.connections.length > 0 &&
            ` + ${group.connections.length} conn`}
        </span>
        {accepts > 0 && (
          <span style={{ fontSize: '10px', color: '#22c55e' }}>{accepts}{'\u2713'}</span>
        )}
        {rejects > 0 && (
          <span style={{ fontSize: '10px', color: '#ef4444' }}>{rejects}{'\u2717'}</span>
        )}
        {edits > 0 && (
          <span style={{ fontSize: '10px', color: '#6366f1' }}>{edits}{'\u270E'}</span>
        )}

        {/* Per-source bulk actions (stop propagation so click doesn't toggle) */}
        <button
          onClick={(e) => { e.stopPropagation(); onAcceptAll(); }}
          title="Accept all matches in this source"
          style={{
            background: 'none',
            border: 'none',
            color: '#22c55e',
            fontSize: '10px',
            cursor: 'pointer',
            padding: '0 4px',
          }}
        >
          {'all\u2713'}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRejectAll(); }}
          title="Reject all matches in this source"
          style={{
            background: 'none',
            border: 'none',
            color: '#ef4444',
            fontSize: '10px',
            cursor: 'pointer',
            padding: '0 4px',
          }}
        >
          {'all\u2717'}
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '6px 8px' }}>
          {group.matches.map((match) => {
            const decision = decisions.get(match.id) || {
              action: 'reject' as DecisionAction,
              editText: newName,
            };
            return (
              <MatchRow
                key={match.id}
                match={match}
                decision={decision}
                newName={newName}
                onChangeAction={(action) => onChangeAction(match.id, action)}
                onChangeEditText={(text) => onChangeEditText(match.id, text)}
              />
            );
          })}

          {/* Connection info for this source */}
          {group.connections.length > 0 && (
            <div style={{ marginTop: '4px' }}>
              {group.connections.map((conn) => (
                <div
                  key={conn.id}
                  style={{
                    padding: '3px 10px',
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    gap: '6px',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      background: TYPE_COLORS.id_slug,
                      color: '#fff',
                      padding: '0 3px',
                      borderRadius: '2px',
                      fontSize: '8px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    FK
                  </span>
                  <span>{conn.contextBefore}</span>
                  <span>{conn.contextAfter}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Modal
// ---------------------------------------------------------------------------

export default function EntityRenameModal({
  entityId,
  entities,
  cultures,
  simulationRunId,
  relationships,
  narrativeEvents,
  mode = 'rename',
  onApply,
  onClose,
}: EntityRenameModalProps) {
  const entity = useMemo(
    () => entities.find((e) => e.id === entityId),
    [entities, entityId],
  );

  const isPatch = mode === 'patch';

  const [phase, setPhase] = useState<Phase>('input');
  // In patch mode: newName = entity.name (current, correct), oldNameInput = user-entered stale name
  const [newName, setNewName] = useState(isPatch ? entity?.name || '' : '');
  const [oldNameInput, setOldNameInput] = useState(
    isPatch ? entityId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '',
  );
  const [scanResult, setScanResult] = useState<RenameScanResult | null>(null);
  const [decisions, setDecisions] = useState<Map<string, DecisionState>>(
    new Map(),
  );
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [applyProgress, setApplyProgress] = useState('');
  const [applyResult, setApplyResult] = useState('');
  const [isRolling, setIsRolling] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase === 'input' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [phase]);

  if (!entity) return null;

  // --- Name rolling ---
  const handleRollName = useCallback(async () => {
    if (!entity.culture) return;
    const cultureDef = cultures.find((c) => c.id === entity.culture);
    if (!cultureDef) return;
    const culture = toCulture(cultureDef);
    if (!culture) return;

    setIsRolling(true);
    try {
      const result = await generate(culture, {
        kind: entity.kind,
        subtype: entity.subtype,
        count: 1,
        seed: `rename-${Date.now()}`,
      });
      if (result.names.length > 0) {
        setNewName(result.names[0]);
      }
    } catch (err) {
      console.warn('[EntityRename] Name generation failed:', err);
    } finally {
      setIsRolling(false);
    }
  }, [entity, cultures]);

  // --- Scanning ---
  const scanOldName = isPatch ? oldNameInput.trim() : entity.name;

  const handleScan = useCallback(async () => {
    if (isPatch ? !oldNameInput.trim() : !newName.trim()) return;
    setPhase('scanning');

    console.log('[EntityRenameModal] handleScan starting', {
      scanOldName,
      newName,
      entityCount: entities.length,
      narrativeEventCount: narrativeEvents?.length ?? 0,
    });

    // Sample a narrative event to check if it has patched or original text
    if (narrativeEvents && narrativeEvents.length > 0) {
      const sample = narrativeEvents[0];
      console.log('[EntityRenameModal] Sample narrative event', {
        id: sample.id,
        description: sample.description?.substring(0, 200),
        action: (sample as any).action?.substring(0, 200),
        hasSimulationRunId: 'simulationRunId' in sample,
      });
    }

    try {
      const chronicles = await getChroniclesForSimulation(simulationRunId);
      const result = await scanForReferences(
        entityId,
        scanOldName,
        entities,
        chronicles,
        relationships,
        narrativeEvents,
      );
      // Filter out no-op matches where the matched text already equals the new name
      const effectiveName = isPatch ? entity.name : newName;
      result.matches = result.matches.filter(
        (m) => m.matchType === 'id_slug' || m.matchedText !== effectiveName,
      );

      console.log('[EntityRenameModal] Scan result', {
        totalMatches: result.matches.length,
        eventMatches: result.matches.filter((m: any) => m.sourceType === 'event').length,
      });
      setScanResult(result);

      // Initialize decisions: accept for full+metadata, reject for partial.
      // id_slug matches are informational only — no decision needed.
      const initial = new Map<string, DecisionState>();
      for (const match of result.matches) {
        if (match.matchType === 'id_slug') continue;
        initial.set(match.id, {
          action: match.matchType === 'partial' ? 'reject' : 'accept',
          editText: newName,
        });
      }
      setDecisions(initial);

      // Self entity starts expanded
      setExpandedSources(new Set([entityId]));
      setPhase('preview');
    } catch (err) {
      console.error('[EntityRename] Scan failed:', err);
      setPhase('input');
    }
  }, [newName, oldNameInput, isPatch, scanOldName, entityId, entities, simulationRunId, relationships, narrativeEvents]);

  // --- Decision handling ---
  const handleChangeAction = useCallback(
    (matchId: string, action: DecisionAction) => {
      setDecisions((prev) => {
        const next = new Map(prev);
        const current = next.get(matchId) || {
          action: 'reject',
          editText: newName,
        };
        next.set(matchId, { ...current, action });
        return next;
      });
    },
    [newName],
  );

  const handleChangeEditText = useCallback(
    (matchId: string, text: string) => {
      setDecisions((prev) => {
        const next = new Map(prev);
        const current = next.get(matchId) || {
          action: 'edit',
          editText: newName,
        };
        next.set(matchId, { ...current, editText: text });
        return next;
      });
    },
    [newName],
  );

  // --- Bulk actions (global) ---
  const handleAcceptAll = useCallback(() => {
    setDecisions((prev) => {
      const next = new Map(prev);
      for (const [id, state] of next) {
        next.set(id, { ...state, action: 'accept' });
      }
      return next;
    });
  }, []);

  const handleRejectAllPartials = useCallback(() => {
    if (!scanResult) return;
    setDecisions((prev) => {
      const next = new Map(prev);
      for (const match of scanResult.matches) {
        if (match.matchType === 'partial') {
          const current = next.get(match.id);
          if (current) {
            next.set(match.id, { ...current, action: 'reject' });
          }
        }
      }
      return next;
    });
  }, [scanResult]);

  // --- Bulk actions (per-source) ---
  const handleAcceptSource = useCallback((matchIds: string[]) => {
    setDecisions((prev) => {
      const next = new Map(prev);
      for (const id of matchIds) {
        const current = next.get(id);
        if (current) next.set(id, { ...current, action: 'accept' });
      }
      return next;
    });
  }, []);

  const handleRejectSource = useCallback((matchIds: string[]) => {
    setDecisions((prev) => {
      const next = new Map(prev);
      for (const id of matchIds) {
        const current = next.get(id);
        if (current) next.set(id, { ...current, action: 'reject' });
      }
      return next;
    });
  }, []);

  // --- Expand/collapse ---
  const toggleSource = useCallback((sourceId: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  }, []);

  // --- Apply ---
  const handleApply = useCallback(async () => {
    if (!scanResult) return;
    setPhase('applying');

    try {
      const decisionArray: MatchDecision[] = [];
      for (const [matchId, state] of decisions) {
        decisionArray.push({
          matchId,
          action: state.action,
          editText: state.action === 'edit' ? state.editText : undefined,
        });
      }

      setApplyProgress('Building patches...');
      const patches = buildRenamePatches(scanResult, newName, decisionArray);
      console.log('[EntityRenameModal] Built patches', {
        entityPatchCount: patches.entityPatches.length,
        eventPatchCount: patches.eventPatches.length,
        chroniclePatchCount: patches.chroniclePatches.length,
        eventPatchIds: patches.eventPatches.map((p: any) => p.eventId),
        eventPatchKeys: patches.eventPatches.map((p: any) => Object.keys(p.changes)),
      });

      // Apply chronicle patches directly (chronicles have their own IDB store)
      let chronicleCount = 0;
      if (patches.chroniclePatches.length > 0) {
        setApplyProgress(
          `Updating ${patches.chroniclePatches.length} chronicles...`,
        );
        chronicleCount = await applyChroniclePatches(
          patches.chroniclePatches,
          getChronicle,
          putChronicle,
        );
      }

      setApplyProgress(
        `Persisting ${patches.entityPatches.length} entity patches...`,
      );

      const parts = [`${patches.entityPatches.length} entities`, `${chronicleCount} chronicles`];
      if (patches.eventPatches.length > 0) {
        parts.push(`${patches.eventPatches.length} events`);
      }
      setApplyResult(`Updated ${parts.join(', ')}.`);

      // Pass patch manifest to parent — parent handles Dexie persistence
      onApply({
        entityPatches: patches.entityPatches,
        eventPatches: patches.eventPatches,
        targetEntityId: isPatch ? null : entityId,
        newName,
      });
      setPhase('done');
    } catch (err) {
      console.error('[EntityRename] Apply failed:', err);
      setApplyProgress(`Error: ${err}`);
    }
  }, [scanResult, decisions, newName, entityId, onApply, isPatch]);

  // --- Stats ---
  const stats = useMemo(() => {
    if (!scanResult) return { accepts: 0, rejects: 0, edits: 0, total: 0, connections: 0 };
    let accepts = 0, rejects = 0, edits = 0, connections = 0;
    for (const match of scanResult.matches) {
      if (match.matchType === 'id_slug') {
        connections++;
        continue;
      }
      const state = decisions.get(match.id);
      if (!state) continue;
      if (state.action === 'accept') accepts++;
      else if (state.action === 'reject') rejects++;
      else if (state.action === 'edit') edits++;
    }
    return { accepts, rejects, edits, total: accepts + rejects + edits, connections };
  }, [scanResult, decisions]);

  // --- Source groups (accordion data) ---
  const sourceGroups = useMemo(() => {
    if (!scanResult) return [];

    // Build a map of sourceId → { matches, connections }
    const groupMap = new Map<string, {
      sourceName: string;
      sourceType: 'entity' | 'chronicle' | 'event';
      matches: RenameMatch[];
      connections: RenameMatch[];
    }>();

    for (const match of scanResult.matches) {
      let entry = groupMap.get(match.sourceId);
      if (!entry) {
        entry = {
          sourceName: match.sourceName,
          sourceType: match.sourceType,
          matches: [],
          connections: [],
        };
        groupMap.set(match.sourceId, entry);
      }
      if (match.matchType === 'id_slug') {
        entry.connections.push(match);
      } else {
        entry.matches.push(match);
      }
    }

    // Convert to sorted array: self first, then entities, then chronicles
    // Tier is derived from the matches themselves (set by the scan function).
    const groups: SourceGroup[] = [];
    for (const [sourceId, entry] of groupMap) {
      const isSelf = sourceId === entityId && entry.sourceType === 'entity';

      // Use the tier from the first match/connection — all matches for a given
      // source share the same tier since it's set per-scan-pass.
      const firstMatch = entry.matches[0] || entry.connections[0];
      const tier = isSelf ? 'this entity' : (firstMatch?.tier ?? 'general');

      groups.push({
        sourceId,
        sourceName: entry.sourceName,
        sourceType: entry.sourceType,
        isSelf,
        tier,
        matches: entry.matches,
        connections: entry.connections,
      });
    }

    // Sort: self first, then entities (related before general), then events, then chronicles
    // Tier priority: FK-confirmed tiers sort before text-only mentions
    const tierOrder: Record<string, number> = {
      'this entity': 0, self: 0,
      related: 1, participant: 1, cast: 1,
      mention: 2, general: 2,
    };
    const typeOrder: Record<string, number> = { entity: 0, event: 1, chronicle: 2 };
    groups.sort((a, b) => {
      if (a.isSelf) return -1;
      if (b.isSelf) return 1;
      // entities before events before chronicles
      const typeA = typeOrder[a.sourceType] ?? 9;
      const typeB = typeOrder[b.sourceType] ?? 9;
      if (typeA !== typeB) return typeA - typeB;
      // FK-confirmed before text-only mentions
      const ta = tierOrder[a.tier] ?? 9;
      const tb = tierOrder[b.tier] ?? 9;
      if (ta !== tb) return ta - tb;
      return a.sourceName.localeCompare(b.sourceName);
    });

    return groups;
  }, [scanResult, entityId]);

  // Separate: sources with actionable matches vs connection-only sources
  const actionableGroups = useMemo(
    () => sourceGroups.filter((g) => g.matches.length > 0),
    [sourceGroups],
  );
  const connectionOnlyGroups = useMemo(
    () => sourceGroups.filter((g) => g.matches.length === 0 && g.connections.length > 0),
    [sourceGroups],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && phase !== 'applying') onClose();
      }}
    >
      <div
        style={{
          background: 'var(--bg-primary)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          width: '900px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '16px' }}>
              {isPatch ? 'Patch Stale Names' : 'Rename Entity'}
            </h2>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '11px',
                color: 'var(--text-muted)',
              }}
            >
              {entity.kind}
              {entity.subtype ? ` / ${entity.subtype}` : ''}
              {entity.culture ? ` / ${entity.culture}` : ''}
            </p>
          </div>
          {phase !== 'applying' && (
            <button
              onClick={onClose}
              className="illuminator-button illuminator-button-secondary"
              style={{ padding: '4px 12px', fontSize: '12px' }}
            >
              Cancel
            </button>
          )}
        </div>

        {/* Scrollable content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px 20px',
            minHeight: 0,
          }}
        >
          {/* Phase 1: Name Input */}
          {phase === 'input' && (
            <div>
              <div
                style={{
                  marginBottom: '16px',
                  padding: '12px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '4px',
                  }}
                >
                  Current Name
                </div>
                <div
                  style={{
                    fontSize: '15px',
                    color: 'var(--text-primary)',
                    fontWeight: 500,
                  }}
                >
                  {entity.name}
                </div>
              </div>

              {isPatch ? (
                /* Patch mode: user enters the OLD stale name to find */
                <>
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
                      marginBottom: '12px',
                    }}
                  >
                    <input
                      ref={inputRef}
                      type="text"
                      value={oldNameInput}
                      onChange={(e) => setOldNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && oldNameInput.trim()) handleScan();
                      }}
                      placeholder="Enter old/stale name to find..."
                      style={{
                        flex: 1,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <p
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      lineHeight: '1.6',
                    }}
                  >
                    Enter the old or stale name to search for. All occurrences
                    will be shown for review and replaced with the current name
                    &ldquo;{entity.name}&rdquo;.
                  </p>
                </>
              ) : (
                /* Rename mode: user enters the NEW name */
                <>
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
                      marginBottom: '12px',
                    }}
                  >
                    <input
                      ref={inputRef}
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newName.trim()) handleScan();
                      }}
                      placeholder="Enter new name..."
                      style={{
                        flex: 1,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        outline: 'none',
                      }}
                    />
                    {entity.culture && (
                      <button
                        onClick={handleRollName}
                        disabled={isRolling}
                        className="illuminator-button illuminator-button-secondary"
                        style={{
                          padding: '8px 16px',
                          fontSize: '12px',
                          whiteSpace: 'nowrap',
                        }}
                        title="Generate a culture-appropriate name using Name Forge"
                      >
                        {isRolling ? 'Rolling...' : 'Roll Name'}
                      </button>
                    )}
                  </div>
                  <p
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      lineHeight: '1.6',
                    }}
                  >
                    Enter a new name or use Roll Name to generate one from Name
                    Forge. The scan will find all references to &ldquo;
                    {entity.name}&rdquo; across related entities and chronicles.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Phase: Scanning */}
          {phase === 'scanning' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div
                style={{
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  marginBottom: '8px',
                }}
              >
                Scanning entities and chronicles...
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Looking for references to &ldquo;{scanOldName}&rdquo;
              </div>
            </div>
          )}

          {/* Phase 2: Preview — accordion grouped by source */}
          {phase === 'preview' && scanResult && (
            <div>
              {/* Summary stats bar */}
              <div
                style={{
                  marginBottom: '12px',
                  padding: '8px 14px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  fontSize: '12px',
                }}
              >
                <span>
                  <strong>{isPatch ? oldNameInput : entity.name}</strong> &rarr;{' '}
                  <strong>{newName}</strong>
                </span>
                <span style={{ color: 'var(--text-muted)' }}>|</span>
                <span style={{ color: '#22c55e' }}>{stats.accepts} accept</span>
                <span style={{ color: '#ef4444' }}>{stats.rejects} reject</span>
                <span style={{ color: '#6366f1' }}>{stats.edits} edit</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  / {stats.total} total
                </span>
                {stats.connections > 0 && (
                  <span style={{ color: '#06b6d4' }}>
                    + {stats.connections} connections
                  </span>
                )}
                <div style={{ flex: 1 }} />
                <button
                  onClick={handleAcceptAll}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#22c55e',
                    fontSize: '10px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Accept All
                </button>
                <button
                  onClick={handleRejectAllPartials}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f59e0b',
                    fontSize: '10px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Reject All Partials
                </button>
              </div>

              {/* Accordion: one section per source */}
              {actionableGroups.map((group) => (
                <SourceSection
                  key={group.sourceId}
                  group={group}
                  expanded={expandedSources.has(group.sourceId)}
                  onToggle={() => toggleSource(group.sourceId)}
                  decisions={decisions}
                  newName={newName}
                  onChangeAction={handleChangeAction}
                  onChangeEditText={handleChangeEditText}
                  onAcceptAll={() => handleAcceptSource(group.matches.map((m) => m.id))}
                  onRejectAll={() => handleRejectSource(group.matches.map((m) => m.id))}
                />
              ))}

              {/* Connection-only sources (no text matches, just FK refs) */}
              {connectionOnlyGroups.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '6px',
                      padding: '0 2px',
                      borderTop: '1px solid var(--border-color)',
                      paddingTop: '10px',
                    }}
                  >
                    Connections without text matches ({connectionOnlyGroups.length})
                  </div>
                  {connectionOnlyGroups.map((group) => (
                    <div
                      key={group.sourceId}
                      style={{
                        padding: '4px 12px',
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        gap: '6px',
                        alignItems: 'center',
                        marginBottom: '2px',
                      }}
                    >
                      <span
                        style={{
                          background: TYPE_COLORS.id_slug,
                          color: '#fff',
                          padding: '0 3px',
                          borderRadius: '2px',
                          fontSize: '8px',
                          fontWeight: 600,
                        }}
                      >
                        FK
                      </span>
                      <span style={{ color: 'var(--text-primary)' }}>
                        {group.sourceName}
                      </span>
                      <span>
                        ({group.sourceType}
                        {group.connections.length > 1
                          ? `, ${group.connections.length} refs`
                          : ''})
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {actionableGroups.length === 0 && connectionOnlyGroups.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '20px',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                  }}
                >
                  No references found. The entity name will still be updated.
                </div>
              )}
            </div>
          )}

          {/* Phase 3: Applying / Done */}
          {(phase === 'applying' || phase === 'done') && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div
                style={{
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  marginBottom: '8px',
                }}
              >
                {phase === 'applying' ? applyProgress : isPatch ? 'Patch Complete' : 'Rename Complete'}
              </div>
              {phase === 'done' && applyResult && (
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    marginTop: '8px',
                  }}
                >
                  {applyResult}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          {phase === 'input' && (
            <button
              onClick={handleScan}
              disabled={isPatch ? !oldNameInput.trim() : !newName.trim()}
              className="illuminator-button"
              style={{
                padding: '6px 20px',
                fontSize: '12px',
                opacity: (isPatch ? oldNameInput.trim() : newName.trim()) ? 1 : 0.5,
              }}
            >
              Scan References
            </button>
          )}
          {phase === 'preview' && (
            <>
              <button
                onClick={() => setPhase('input')}
                className="illuminator-button illuminator-button-secondary"
                style={{ padding: '6px 16px', fontSize: '12px' }}
              >
                Back
              </button>
              <button
                onClick={handleApply}
                disabled={stats.accepts === 0 && stats.edits === 0}
                className="illuminator-button"
                style={{
                  padding: '6px 20px',
                  fontSize: '12px',
                  opacity:
                    stats.accepts === 0 && stats.edits === 0 ? 0.5 : 1,
                }}
              >
                {isPatch ? 'Apply Patch' : 'Apply Rename'} ({stats.accepts + stats.edits} changes)
              </button>
            </>
          )}
          {phase === 'done' && (
            <button
              onClick={onClose}
              className="illuminator-button"
              style={{ padding: '6px 20px', fontSize: '12px' }}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
