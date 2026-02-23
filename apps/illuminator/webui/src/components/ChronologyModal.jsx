/**
 * ChronologyModal — Historian assigns chronological years to chronicles within an era.
 *
 * Two states:
 * 1. Setup: pick era, review chronicle list (with prep status), kick off task
 * 2. Review: see assignments, adjust years, apply
 *
 * Always uses scholarly tone. Prefers historian prep notes over summaries for context.
 */

import { useState, useMemo, useCallback } from 'react';
import { useChronicleStore } from '../lib/db/chronicleStore';
import { batchUpdateChronicleEraYears } from '../lib/db/chronicleRepository';
import { useHistorianChronology } from '../hooks/useHistorianChronology';

export default function ChronologyModal({
  isOpen,
  onClose,
  chronicleItems,
  wizardEras,
  wizardEvents,
  projectId,
  simulationRunId,
  historianConfig,
  onEnqueue,
  onApplied,
}) {
  const [selectedEraId, setSelectedEraId] = useState('');
  const [expandedReasoning, setExpandedReasoning] = useState({});

  const {
    run,
    isActive,
    startChronology,
    adjustYear,
    applyChronology,
    cancelChronology,
  } = useHistorianChronology(onEnqueue);

  // Build era options from wizardEras
  const eraOptions = useMemo(() => {
    return wizardEras.map((era) => {
      const eraChronicles = chronicleItems.filter((c) => c.focalEraName === era.name);
      return {
        id: era.id,
        name: era.name,
        startTick: era.startTick,
        endTick: era.endTick,
        count: eraChronicles.length,
        preppedCount: eraChronicles.filter((c) => c.hasHistorianPrep).length,
      };
    });
  }, [wizardEras, chronicleItems]);

  // Get chronicles for the selected era
  const selectedEra = eraOptions.find((e) => e.id === selectedEraId);

  // Chronicles in the selected era for the list display
  const selectedEraChronicles = useMemo(() => {
    if (!selectedEra) return [];
    const era = wizardEras.find((e) => e.id === selectedEraId);
    if (!era) return [];
    return chronicleItems
      .filter((c) => c.focalEraName === era.name)
      .sort((a, b) => (a.eraYear || 0) - (b.eraYear || 0) || a.name.localeCompare(b.name));
  }, [selectedEra, selectedEraId, wizardEras, chronicleItems]);

  // Build context and start
  const handleStart = useCallback(async () => {
    if (!selectedEra) return;

    const era = wizardEras.find((e) => e.id === selectedEraId);
    if (!era) return;

    // Get chronicles in this era
    const eraChronicles = chronicleItems.filter(
      (item) => item.focalEraName === era.name
    );

    // Load full records for summaries
    const store = useChronicleStore.getState();
    const chronicleEntries = [];

    for (const item of eraChronicles) {
      const record = await store.loadChronicle(item.chronicleId);
      if (!record) continue;

      // Resolve event headlines for this chronicle
      const chronicleEventIds = new Set(record.selectedEventIds || []);
      const events = (wizardEvents || [])
        .filter((e) => chronicleEventIds.has(e.id))
        .map((e) => ({ tick: e.tick, headline: e.headline }));

      // Cast from role assignments
      const cast = (record.roleAssignments || []).map((r) => ({
        entityName: r.entityName,
        role: r.roleName || (r.isPrimary ? 'primary' : 'supporting'),
        kind: r.entityKind || '',
      }));

      // Prefer historian prep, then summary, then opening text
      const content = record.finalContent || record.assembledContent || '';
      const openingText = content.slice(0, 300).split(/\n\n/).slice(0, 2).join('\n\n');

      chronicleEntries.push({
        chronicleId: record.chronicleId,
        title: record.title || item.name,
        tickRange: record.temporalContext?.chronicleTickRange || [0, 0],
        temporalScope: record.temporalContext?.temporalScope || 'unknown',
        isMultiEra: record.temporalContext?.isMultiEra || false,
        cast,
        events,
        prep: record.historianPrep || undefined,
        summary: record.historianPrep ? undefined : record.summary,
        openingText: (record.historianPrep || record.summary) ? undefined : openingText,
      });
    }

    // Previous eras for context
    const previousEras = wizardEras
      .filter((e) => e.order < era.order)
      .sort((a, b) => a.order - b.order)
      .map((e) => ({
        name: e.name,
        startTick: e.startTick,
        endTick: e.endTick,
        summary: e.summary,
      }));

    const contextJson = JSON.stringify({
      era: {
        eraId: era.id,
        eraName: era.name,
        eraSummary: era.summary,
        startTick: era.startTick,
        endTick: era.endTick,
      },
      previousEras,
      chronicles: chronicleEntries,
    });

    startChronology({
      projectId,
      simulationRunId,
      eraId: era.id,
      eraName: era.name,
      contextJson,
      historianConfig,
      tone: 'scholarly',
    });
  }, [selectedEra, selectedEraId, wizardEras, chronicleItems, wizardEvents, projectId, simulationRunId, historianConfig, startChronology]);

  // Apply assignments to chronicle records
  const handleApply = useCallback(async () => {
    const assignments = applyChronology();
    if (assignments.length === 0) return;

    await batchUpdateChronicleEraYears(
      assignments.map((a) => ({
        chronicleId: a.chronicleId,
        eraYear: a.year,
        eraYearReasoning: a.reasoning,
      }))
    );

    onApplied();
  }, [applyChronology, onApplied]);

  // Cancel
  const handleCancel = useCallback(() => {
    cancelChronology();
  }, [cancelChronology]);

  // Close modal (cancel if active)
  const handleClose = useCallback(() => {
    if (isActive) cancelChronology();
    onClose();
  }, [isActive, cancelChronology, onClose]);

  if (!isOpen) return null;

  const isGenerating = run?.status === 'pending' || run?.status === 'generating';
  const isReviewing = run?.status === 'reviewing';
  const isFailed = run?.status === 'failed';
  const assignments = run?.chronologyAssignments || [];
  const sortedAssignments = [...assignments].sort((a, b) => a.year - b.year);

  // Find chronicle title by ID
  const titleMap = {};
  for (const item of chronicleItems) {
    titleMap[item.chronicleId] = item.name;
  }

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
          width: '600px',
          maxHeight: '80vh',
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
            {isReviewing ? `Chronology: ${run?.targetName}` : 'Historian Chronology'}
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

          {/* Setup state */}
          {!isActive && !isReviewing && !isFailed && (
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
                      {era.name} ({era.count} chronicles, Y{era.startTick}{'\u2013'}Y{era.endTick})
                    </option>
                  ))}
                </select>
              </div>

              {/* Chronicle list for selected era */}
              {selectedEra && selectedEraChronicles.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    marginBottom: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}>
                    <span>Chronicles ({selectedEraChronicles.length})</span>
                    <span style={{ textTransform: 'none', fontWeight: 400 }}>
                      {selectedEra.preppedCount}/{selectedEraChronicles.length} prepped
                    </span>
                  </div>
                  <div style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    maxHeight: '300px',
                    overflowY: 'auto',
                  }}>
                    {selectedEraChronicles.map((c, i) => (
                      <div
                        key={c.chronicleId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '5px 12px',
                          borderBottom: i < selectedEraChronicles.length - 1 ? '1px solid var(--border-color)' : 'none',
                          fontSize: '12px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '10px',
                            color: c.hasHistorianPrep ? '#8b7355' : 'var(--text-muted)',
                            flexShrink: 0,
                            width: '12px',
                            textAlign: 'center',
                          }}
                          title={c.hasHistorianPrep ? 'Historian prep available' : 'No historian prep'}
                        >
                          {c.hasHistorianPrep ? '\u25C6' : '\u25C7'}
                        </span>
                        <span style={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {c.name}
                        </span>
                        {c.eraYear != null && (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
                            Y{c.eraYear}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleStart}
                disabled={!selectedEraId || !selectedEra || selectedEra.count === 0}
                className="illuminator-button"
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  background: selectedEraId && selectedEra?.count > 0 ? 'var(--accent-primary)' : undefined,
                  color: selectedEraId && selectedEra?.count > 0 ? '#fff' : undefined,
                  opacity: selectedEraId && selectedEra?.count > 0 ? 1 : 0.5,
                }}
              >
                Assign Years
              </button>
            </>
          )}

          {/* Generating state */}
          {isGenerating && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                The historian is ordering chronicles...
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {run?.targetName}
              </div>
            </div>
          )}

          {/* Failed state */}
          {isFailed && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '14px', color: '#ef4444', marginBottom: '8px' }}>
                Chronology failed
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                {run?.error}
              </div>
              <button onClick={handleCancel} className="illuminator-button">
                Dismiss
              </button>
            </div>
          )}

          {/* Review state */}
          {isReviewing && sortedAssignments.length > 0 && (
            <>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                {sortedAssignments.length} chronicles ordered. Adjust years if needed, then apply.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sortedAssignments.map((a) => (
                  <div
                    key={a.chronicleId}
                    style={{
                      padding: '10px 12px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="number"
                        value={a.year}
                        min={selectedEra?.startTick}
                        max={selectedEra?.endTick}
                        onChange={(e) => adjustYear(a.chronicleId, parseInt(e.target.value, 10) || a.year)}
                        style={{
                          width: '60px',
                          padding: '4px 6px',
                          fontSize: '13px',
                          fontWeight: 600,
                          textAlign: 'center',
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          color: 'var(--text-primary)',
                        }}
                      />
                      <span style={{ fontSize: '13px', flex: 1 }}>
                        {titleMap[a.chronicleId] || a.chronicleId}
                      </span>
                      {a.reasoning && (
                        <button
                          onClick={() => setExpandedReasoning((prev) => ({
                            ...prev,
                            [a.chronicleId]: !prev[a.chronicleId],
                          }))}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: '11px', color: 'var(--text-muted)', padding: '2px 4px',
                          }}
                          title="Show reasoning"
                        >
                          {expandedReasoning[a.chronicleId] ? '\u25BC' : '\u25B6'}
                        </button>
                      )}
                    </div>
                    {expandedReasoning[a.chronicleId] && a.reasoning && (
                      <div style={{
                        marginTop: '6px',
                        paddingTop: '6px',
                        borderTop: '1px solid var(--border-color)',
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        fontStyle: 'italic',
                      }}>
                        {a.reasoning}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {isReviewing && (
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
          }}>
            <button onClick={handleCancel} className="illuminator-button">
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="illuminator-button"
              style={{
                background: 'var(--accent-primary)',
                color: '#fff',
                fontWeight: 600,
              }}
            >
              Apply ({sortedAssignments.length} years)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
