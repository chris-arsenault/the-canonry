/**
 * CoveragePanel - Fact usage coverage across chronicles
 *
 * Shows a matrix of chronicle -> fact selections and fact usage totals.
 */

import { useMemo, useEffect, useState, useCallback } from 'react';
import { getChroniclesForSimulation } from '../lib/db/chronicleRepository';

const STORAGE_KEY = 'illuminator:coverageChronicleToggles';

const normalizeFact = (fact, index) => {
  if (!fact) return null;
  const id = String(fact.id || `fact_${index}`).trim();
  if (!id) return null;
  const type = fact.type || 'world_truth';
  const text = typeof fact.text === 'string' ? fact.text : (fact.text != null ? String(fact.text) : '');
  return {
    id,
    text,
    type,
    required: type === 'generation_constraint' ? false : Boolean(fact.required),
    disabled: Boolean(fact.disabled),
  };
};

const sortChronicles = (a, b) => {
  const aTime = a.createdAt || 0;
  const bTime = b.createdAt || 0;
  if (aTime !== bTime) return bTime - aTime;
  return String(a.title || '').localeCompare(String(b.title || ''));
};

export default function CoveragePanel({ worldContext, simulationRunId, onWorldContextChange }) {
  const [chronicles, setChronicles] = useState([]);
  const [loading, setLoading] = useState(false);

  const [disabledChronicles, setDisabledChronicles] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(disabledChronicles));
    } catch {}
  }, [disabledChronicles]);

  useEffect(() => {
    if (!simulationRunId) return;
    let cancelled = false;
    setLoading(true);
    getChroniclesForSimulation(simulationRunId)
      .then((records) => {
        if (!cancelled) setChronicles(records);
      })
      .catch((err) => {
        console.error('[Coverage] Failed to load chronicles:', err);
        if (!cancelled) setChronicles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [simulationRunId]);

  const toggleChronicle = useCallback((chronicleId) => {
    setDisabledChronicles((prev) => ({
      ...prev,
      [chronicleId]: !prev[chronicleId],
    }));
  }, []);

  const toggleFact = useCallback((factId) => {
    if (!onWorldContextChange) return;
    const rawFacts = worldContext?.canonFactsWithMetadata || [];
    const updated = rawFacts.map((f) =>
      f.id === factId ? { ...f, disabled: !f.disabled, required: !f.disabled ? false : f.required } : f
    );
    onWorldContextChange({ canonFactsWithMetadata: updated });
  }, [onWorldContextChange, worldContext?.canonFactsWithMetadata]);

  const analysis = useMemo(() => {
    const rawFacts = worldContext?.canonFactsWithMetadata || [];
    const normalizedWorldFacts = rawFacts
      .map((fact, index) => normalizeFact(fact, index))
      .filter(Boolean);

    const chronicleList = [...(chronicles || [])].sort(sortChronicles);
    const facts = normalizedWorldFacts.filter((fact) => fact.type !== 'generation_constraint');
    const enabledFacts = facts.filter((fact) => !fact.disabled);
    const factIdSet = new Set(enabledFacts.map((fact) => fact.id));
    const allFactIdSet = new Set(facts.map((fact) => fact.id));

    const rows = chronicleList.map((chronicle) => {
      const synthesis = chronicle.perspectiveSynthesis || null;
      const facetIds = new Set();
      let unparsedCount = 0;
      for (const facet of synthesis?.facets || []) {
        if (!facet?.factId) continue;
        if (allFactIdSet.has(facet.factId)) {
          facetIds.add(facet.factId);
        } else {
          unparsedCount += 1;
        }
      }

      return {
        chronicle,
        synthesis,
        facetIds,
        unparsedCount,
        isIncluded: !disabledChronicles[chronicle.chronicleId],
      };
    });

    const factTotals = new Map(facts.map((fact) => [fact.id, 0]));
    const disabledFactIds = new Set(facts.filter((f) => f.disabled).map((f) => f.id));

    let totalSelections = 0;
    let unparsedTotal = 0;
    let includedCount = 0;

    const processedRows = rows.map((row) => {
      if (row.isIncluded) {
        includedCount += 1;
        for (const factId of row.facetIds) {
          factTotals.set(factId, (factTotals.get(factId) || 0) + 1);
        }
        let enabledHits = 0;
        for (const factId of row.facetIds) {
          if (!disabledFactIds.has(factId)) enabledHits += 1;
        }
        totalSelections += enabledHits;
        unparsedTotal += row.unparsedCount || 0;
      }

      let rowEnabledTotal = 0;
      for (const factId of row.facetIds) {
        if (!disabledFactIds.has(factId)) rowEnabledTotal += 1;
      }

      return {
        ...row,
        rowTotal: rowEnabledTotal,
      };
    });

    const chroniclesWithSynthesis = processedRows.filter((row) => row.synthesis).length;
    const unusedFacts = enabledFacts.filter((fact) => (factTotals.get(fact.id) || 0) === 0).length;
    const disabledFactCount = facts.filter((fact) => fact.disabled).length;
    const constraintCount = normalizedWorldFacts.filter((fact) => fact.type === 'generation_constraint').length;

    return {
      facts,
      factTotals,
      rows: processedRows,
      totalSelections,
      unparsedTotal,
      includedCount,
      chroniclesWithSynthesis,
      chronicleCount: processedRows.length,
      unusedFacts,
      disabledFactCount,
      constraintCount,
    };
  }, [chronicles, worldContext, disabledChronicles]);

  const {
    facts,
    factTotals,
    rows,
    totalSelections,
    unparsedTotal,
    includedCount,
    chroniclesWithSynthesis,
    chronicleCount,
    unusedFacts,
    disabledFactCount,
    constraintCount,
  } = analysis;

  const disableAll = useCallback(() => {
    const next = {};
    for (const row of rows) {
      next[row.chronicle.chronicleId] = true;
    }
    setDisabledChronicles(next);
  }, [rows]);

  const enableAll = useCallback(() => {
    setDisabledChronicles({});
  }, []);

  if (!simulationRunId) {
    return (
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Coverage</h2>
        </div>
        <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
          No active simulation run.
        </div>
      </div>
    );
  }

  if (loading && chronicleCount === 0) {
    return (
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Coverage</h2>
        </div>
        <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
          Loading chronicles...
        </div>
      </div>
    );
  }

  if (!facts.length) {
    return (
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Coverage</h2>
          <span className="illuminator-card-subtitle">Perspective synthesis fact coverage</span>
        </div>
        <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
          No canon facts configured. Add facts in the Context tab to enable coverage tracking.
        </div>
      </div>
    );
  }

  return (
    <div className="illuminator-card">
      <div className="illuminator-card-header">
        <h2 className="illuminator-card-title">Coverage</h2>
        <span className="illuminator-card-subtitle">Perspective synthesis fact usage across chronicles</span>
      </div>

      <div className="illuminator-coverage-summary">
        <div>
          <strong>Chronicles</strong>: {chronicleCount} total, {includedCount} counted, {chroniclesWithSynthesis} with synthesis
        </div>
        <div>
          <strong>Facts</strong>: {facts.length - disabledFactCount} active ({unusedFacts} unused){disabledFactCount > 0 && `, ${disabledFactCount} disabled`}
        </div>
        <div>
          <strong>Total selections</strong>: {totalSelections}
        </div>
        <div>
          <strong>Unparsed facets</strong>: {unparsedTotal}
        </div>
        {constraintCount > 0 && (
          <div>
            <strong>Constraints excluded</strong>: {constraintCount}
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button
            className="illuminator-button illuminator-button-secondary"
            style={{ padding: '4px 10px', fontSize: '11px' }}
            onClick={enableAll}
          >
            Count all
          </button>
          <button
            className="illuminator-button illuminator-button-secondary"
            style={{ padding: '4px 10px', fontSize: '11px' }}
            onClick={disableAll}
          >
            Count none
          </button>
        </div>
      </div>

      <div className="illuminator-coverage-table">
        <table>
          <thead>
            <tr>
              <th className="illuminator-coverage-sticky">Chronicle</th>
              <th className="illuminator-coverage-toggle-col">Counted</th>
              {facts.map((fact) => (
                <th
                  key={fact.id}
                  title={`${fact.id}${fact.text ? `: ${fact.text}` : ''}${fact.required ? ' (required)' : ''}${fact.disabled ? ' (disabled — click to enable)' : ' (click to disable)'}`}
                  onClick={onWorldContextChange ? () => toggleFact(fact.id) : undefined}
                  style={onWorldContextChange ? { cursor: 'pointer' } : undefined}
                >
                  <div className="illuminator-coverage-fact-header" style={fact.disabled ? { opacity: 0.4 } : undefined}>
                    <span className="illuminator-coverage-fact-id">{fact.id}</span>
                    {fact.required && <span className="illuminator-coverage-required">R</span>}
                    {fact.disabled && <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>off</span>}
                  </div>
                </th>
              ))}
              <th className="illuminator-coverage-unparsed-col">Unparsed</th>
              <th className="illuminator-coverage-total-col">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="illuminator-coverage-total-row">
              <td className="illuminator-coverage-sticky">Total usage</td>
              <td className="illuminator-coverage-toggle-col">{includedCount}</td>
              {facts.map((fact) => (
                <td key={`total-${fact.id}`} style={fact.disabled ? { opacity: 0.3 } : undefined}>
                  {factTotals.get(fact.id) || 0}
                </td>
              ))}
              <td className="illuminator-coverage-unparsed-col">{unparsedTotal}</td>
              <td className="illuminator-coverage-total-col">{totalSelections}</td>
            </tr>
            {rows.map((row) => {
              const chronicle = row.chronicle;
              const hasSynthesis = Boolean(row.synthesis);
              const rowClass = row.isIncluded ? '' : 'illuminator-coverage-row-disabled';
              return (
                <tr key={chronicle.chronicleId} className={rowClass}>
                  <td className="illuminator-coverage-sticky">
                    <div className="illuminator-coverage-chronicle-title">
                      {chronicle.title || 'Untitled Chronicle'}
                    </div>
                    <div className="illuminator-coverage-chronicle-meta">
                      {chronicle.chronicleId}
                      {!hasSynthesis && ' • no synthesis'}
                    </div>
                  </td>
                  <td className="illuminator-coverage-toggle-col">
                    <input
                      type="checkbox"
                      checked={row.isIncluded}
                      onChange={() => toggleChronicle(chronicle.chronicleId)}
                      aria-label={`Toggle counting for ${chronicle.title || chronicle.chronicleId}`}
                    />
                  </td>
                  {facts.map((fact) => (
                    <td key={`${chronicle.chronicleId}-${fact.id}`} style={fact.disabled ? { opacity: 0.3 } : undefined}>
                      {row.facetIds.has(fact.id) ? (
                        <span className="illuminator-coverage-hit" />
                      ) : (
                        <span className="illuminator-coverage-miss" />
                      )}
                    </td>
                  ))}
                  <td className="illuminator-coverage-unparsed-col">{row.unparsedCount || 0}</td>
                  <td className="illuminator-coverage-total-col">{row.rowTotal || 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
