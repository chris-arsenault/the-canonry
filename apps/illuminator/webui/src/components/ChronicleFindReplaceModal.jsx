/**
 * ChronicleFindReplaceModal - Find/replace text across all chronicle content versions
 *
 * Three-phase flow following the rename modal pattern:
 * 1. Input: enter find/replace strings
 * 2. Preview: per-instance diff with accept/reject
 * 3. Apply: selective replacement, write to DB
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { getChronicle, putChronicle } from '../lib/db/chronicleRepository';

// ============================================================================
// Scanning
// ============================================================================

const CONTEXT_RADIUS = 80;

function scanText(text, find, sourceLabel, sourceType, versionId) {
  const matches = [];
  if (!text) return matches;
  let startPos = 0;
  let idx = 0;
  while ((startPos = text.indexOf(find, startPos)) !== -1) {
    const ctxStart = Math.max(0, startPos - CONTEXT_RADIUS);
    const ctxEnd = Math.min(text.length, startPos + find.length + CONTEXT_RADIUS);
    matches.push({
      id: `${versionId || sourceType}:${idx}`,
      sourceLabel,
      sourceType,
      versionId,
      position: startPos,
      contextBefore: (ctxStart > 0 ? '\u2026' : '') + text.slice(ctxStart, startPos),
      matchedText: find,
      contextAfter: text.slice(startPos + find.length, ctxEnd) + (ctxEnd < text.length ? '\u2026' : ''),
    });
    startPos += find.length;
    idx++;
  }
  return matches;
}

function applySelectiveReplace(text, find, replace, acceptedPositions) {
  if (!text || acceptedPositions.length === 0) return text;
  const sorted = [...acceptedPositions].sort((a, b) => b - a);
  let result = text;
  for (const pos of sorted) {
    result = result.slice(0, pos) + replace + result.slice(pos + find.length);
  }
  return result;
}

// ============================================================================
// Match Row
// ============================================================================

function MatchRow({ match, replace, accepted, onToggle }) {
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
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          flex: 1,
        }}
      >
        <span style={{ color: 'var(--text-muted)' }}>{match.contextBefore}</span>
        <span style={{
          background: 'rgba(239, 68, 68, 0.2)',
          textDecoration: 'line-through',
          padding: '0 1px',
          borderRadius: '2px',
        }}>{match.matchedText}</span>
        {accepted && (
          <span style={{
            background: 'rgba(34, 197, 94, 0.2)',
            padding: '0 1px',
            borderRadius: '2px',
          }}>{replace}</span>
        )}
        <span style={{ color: 'var(--text-muted)' }}>{match.contextAfter}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Source Group
// ============================================================================

function SourceGroup({ label, matches, replace, decisions, onToggle, onAcceptAll, onRejectAll, expanded, onToggleExpand }) {
  const acceptCount = matches.filter(m => decisions[m.id]).length;

  return (
    <div style={{
      marginBottom: '4px',
      border: '1px solid var(--border-color)',
      borderRadius: '6px',
      overflow: 'hidden',
    }}>
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
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
          {label}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {matches.length} {matches.length === 1 ? 'match' : 'matches'}
        </span>
        {acceptCount > 0 && (
          <span style={{ fontSize: '10px', color: '#22c55e' }}>{acceptCount}{'\u2713'}</span>
        )}
        {matches.length - acceptCount > 0 && (
          <span style={{ fontSize: '10px', color: '#ef4444' }}>{matches.length - acceptCount}{'\u2717'}</span>
        )}
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
          {matches.map(m => (
            <MatchRow
              key={m.id}
              match={m}
              replace={replace}
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
// Modal
// ============================================================================

export default function ChronicleFindReplaceModal({ chronicleId, onClose, onApplied }) {
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [phase, setPhase] = useState('input');
  const [matches, setMatches] = useState([]);
  const [decisions, setDecisions] = useState({});
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [resultCount, setResultCount] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (phase === 'input' && inputRef.current) inputRef.current.focus();
  }, [phase]);

  // --- Scan ---
  const handleScan = useCallback(async () => {
    if (!find) return;
    const record = await getChronicle(chronicleId);
    if (!record) return;

    const allMatches = [];

    if (record.finalContent) {
      allMatches.push(...scanText(record.finalContent, find, 'Published', 'final'));
    }

    if (record.generationHistory) {
      for (const v of record.generationHistory) {
        const label = v.step
          ? `${v.step} (${new Date(v.generatedAt).toLocaleDateString()})`
          : new Date(v.generatedAt).toLocaleDateString();
        allMatches.push(...scanText(v.content, find, label, 'version', v.versionId));
      }
    }

    if (record.assembledContent && record.assembledContent !== record.finalContent) {
      allMatches.push(...scanText(record.assembledContent, find, 'Current Draft', 'assembled'));
    }

    setMatches(allMatches);
    const initial = {};
    for (const m of allMatches) initial[m.id] = true;
    setDecisions(initial);
    setExpandedGroups(new Set(['final']));
    setPhase(allMatches.length > 0 ? 'preview' : 'empty');
  }, [find, chronicleId]);

  // --- Apply ---
  const handleApply = useCallback(async () => {
    setPhase('applying');
    const record = await getChronicle(chronicleId);
    if (!record) return;

    let total = 0;
    const finalPositions = [];
    const assembledPositions = [];
    const versionPositions = {};

    for (const m of matches) {
      if (!decisions[m.id]) continue;
      if (m.sourceType === 'final') finalPositions.push(m.position);
      else if (m.sourceType === 'assembled') assembledPositions.push(m.position);
      else if (m.sourceType === 'version') {
        if (!versionPositions[m.versionId]) versionPositions[m.versionId] = [];
        versionPositions[m.versionId].push(m.position);
      }
    }

    if (finalPositions.length > 0 && record.finalContent) {
      record.finalContent = applySelectiveReplace(record.finalContent, find, replace, finalPositions);
      total += finalPositions.length;
    }

    if (assembledPositions.length > 0 && record.assembledContent) {
      record.assembledContent = applySelectiveReplace(record.assembledContent, find, replace, assembledPositions);
      total += assembledPositions.length;
    }

    if (record.generationHistory) {
      for (const v of record.generationHistory) {
        const positions = versionPositions[v.versionId];
        if (positions && positions.length > 0) {
          v.content = applySelectiveReplace(v.content, find, replace, positions);
          v.wordCount = v.content.split(/\s+/).filter(Boolean).length;
          total += positions.length;
        }
      }
    }

    record.updatedAt = Date.now();
    await putChronicle(record);

    setResultCount(total);
    setPhase('done');
    onApplied?.();
  }, [chronicleId, find, replace, matches, decisions, onApplied]);

  // --- Decision helpers ---
  const toggleDecision = useCallback((id) => {
    setDecisions(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const acceptAll = useCallback(() => {
    setDecisions(prev => {
      const next = { ...prev };
      for (const m of matches) next[m.id] = true;
      return next;
    });
  }, [matches]);

  const rejectAll = useCallback(() => {
    setDecisions(prev => {
      const next = { ...prev };
      for (const m of matches) next[m.id] = false;
      return next;
    });
  }, [matches]);

  const acceptGroup = useCallback((groupMatches) => {
    setDecisions(prev => {
      const next = { ...prev };
      for (const m of groupMatches) next[m.id] = true;
      return next;
    });
  }, []);

  const rejectGroup = useCallback((groupMatches) => {
    setDecisions(prev => {
      const next = { ...prev };
      for (const m of groupMatches) next[m.id] = false;
      return next;
    });
  }, []);

  const toggleExpand = useCallback((key) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // --- Stats ---
  const acceptCount = useMemo(() => Object.values(decisions).filter(Boolean).length, [decisions]);

  // --- Groups ---
  const groups = useMemo(() => {
    const map = new Map();
    for (const m of matches) {
      const key = m.versionId || m.sourceType;
      if (!map.has(key)) map.set(key, { key, label: m.sourceLabel, matches: [] });
      map.get(key).matches.push(m);
    }
    return Array.from(map.values());
  }, [matches]);

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
      onClick={(e) => { if (e.target === e.currentTarget && phase !== 'applying') onClose(); }}
    >
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        width: '700px',
        maxWidth: '95vw',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <h2 style={{ margin: 0, fontSize: '16px' }}>Find &amp; Replace in Chronicle</h2>
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

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', minHeight: 0 }}>
          {/* Input phase */}
          {phase === 'input' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{
                  display: 'block', fontSize: '10px', color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: 600,
                }}>Find</label>
                <input
                  ref={inputRef}
                  value={find}
                  onChange={(e) => setFind(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && find && handleScan()}
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
                <label style={{
                  display: 'block', fontSize: '10px', color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: 600,
                }}>Replace with</label>
                <input
                  value={replace}
                  onChange={(e) => setReplace(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && find && handleScan()}
                  placeholder="Replacement text..."
                  style={{
                    width: '100%', padding: '8px 12px', fontSize: '13px',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                    borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Searches published content and all generation versions. Literal match, case-sensitive.
              </p>
            </div>
          )}

          {/* Empty results */}
          {phase === 'empty' && (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
              No matches found for &ldquo;{find}&rdquo;
            </div>
          )}

          {/* Preview phase */}
          {phase === 'preview' && (
            <div>
              {/* Summary bar */}
              <div style={{
                marginBottom: '12px', padding: '8px 14px',
                background: 'var(--bg-secondary)', borderRadius: '6px',
                border: '1px solid var(--border-color)',
                display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', fontSize: '12px',
              }}>
                <span>
                  <strong>{find}</strong> &rarr; <strong>{replace || <em style={{ color: 'var(--text-muted)' }}>(delete)</em>}</strong>
                </span>
                <span style={{ color: 'var(--text-muted)' }}>|</span>
                <span style={{ color: '#22c55e' }}>{acceptCount} accept</span>
                <span style={{ color: '#ef4444' }}>{matches.length - acceptCount} reject</span>
                <span style={{ color: 'var(--text-muted)' }}>/ {matches.length} total</span>
                <div style={{ flex: 1 }} />
                <button
                  onClick={acceptAll}
                  style={{ background: 'none', border: 'none', color: '#22c55e', fontSize: '10px', cursor: 'pointer', textDecoration: 'underline' }}
                >Accept All</button>
                <button
                  onClick={rejectAll}
                  style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '10px', cursor: 'pointer', textDecoration: 'underline' }}
                >Reject All</button>
              </div>

              {groups.map(group => (
                <SourceGroup
                  key={group.key}
                  label={group.label}
                  matches={group.matches}
                  replace={replace}
                  decisions={decisions}
                  onToggle={toggleDecision}
                  onAcceptAll={() => acceptGroup(group.matches)}
                  onRejectAll={() => rejectGroup(group.matches)}
                  expanded={expandedGroups.has(group.key)}
                  onToggleExpand={() => toggleExpand(group.key)}
                />
              ))}
            </div>
          )}

          {/* Applying / Done */}
          {(phase === 'applying' || phase === 'done') && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                {phase === 'applying' ? 'Applying replacements...' : 'Replace Complete'}
              </div>
              {phase === 'done' && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  {resultCount} replacement{resultCount !== 1 ? 's' : ''} applied across {groups.length} content {groups.length === 1 ? 'source' : 'sources'}.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0,
        }}>
          {phase === 'input' && (
            <button
              onClick={handleScan}
              disabled={!find}
              className="illuminator-button"
              style={{ padding: '6px 20px', fontSize: '12px', opacity: find ? 1 : 0.5 }}
            >
              Find Matches
            </button>
          )}
          {phase === 'empty' && (
            <button
              onClick={() => setPhase('input')}
              className="illuminator-button illuminator-button-secondary"
              style={{ padding: '6px 16px', fontSize: '12px' }}
            >
              Back
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
                disabled={acceptCount === 0}
                className="illuminator-button"
                style={{ padding: '6px 20px', fontSize: '12px', opacity: acceptCount > 0 ? 1 : 0.5 }}
              >
                Apply ({acceptCount} {acceptCount === 1 ? 'replacement' : 'replacements'})
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
