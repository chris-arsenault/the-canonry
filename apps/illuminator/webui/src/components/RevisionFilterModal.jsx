/**
 * RevisionFilterModal - Pre-revision entity filter
 *
 * Shows entity counts and lets the user exclude entities that have been
 * used in chronicle casts, preventing inconsistency between rewritten
 * summaries and already-generated chronicle text.
 */

import { useState } from 'react';

export default function RevisionFilterModal({
  isOpen,
  totalEligible,
  usedInChronicles,
  onStart,
  onCancel,
}) {
  const [excludeChronicle, setExcludeChronicle] = useState(true);

  if (!isOpen) return null;

  const available = excludeChronicle
    ? totalEligible - usedInChronicles
    : totalEligible;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.6)',
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        width: '440px',
        maxWidth: '95vw',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <h2 style={{ margin: 0, fontSize: '16px' }}>
            Revise Entity Summaries
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
            Rewrite summaries and descriptions with full world context.
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px' }}>
          {/* Counts */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '6px 16px',
            fontSize: '12px',
            marginBottom: '16px',
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>Total eligible entities</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{totalEligible}</span>

            <span style={{ color: 'var(--text-secondary)' }}>Used in chronicles</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: usedInChronicles > 0 ? 'var(--warning-color, #f59e0b)' : 'var(--text-muted)' }}>
              {usedInChronicles}
            </span>

            <span style={{ fontWeight: 600 }}>Available for revision</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{available}</span>
          </div>

          {/* Chronicle filter toggle */}
          {usedInChronicles > 0 && (
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '10px 12px',
              background: 'var(--bg-secondary)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
            }}>
              <input
                type="checkbox"
                checked={excludeChronicle}
                onChange={(e) => setExcludeChronicle(e.target.checked)}
                style={{ marginTop: '2px' }}
              />
              <div>
                <div style={{ fontWeight: 600 }}>Exclude entities used in chronicles</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
                  Recommended. Prevents inconsistency between rewritten descriptions and existing chronicle text.
                </div>
              </div>
            </label>
          )}

          {available === 0 && (
            <div style={{
              marginTop: '12px',
              padding: '10px 12px',
              background: 'var(--bg-tertiary)',
              borderRadius: '6px',
              borderLeft: '3px solid var(--warning-color, #f59e0b)',
              fontSize: '12px',
              color: 'var(--text-secondary)',
            }}>
              No entities available for revision with current filters.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px 16px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onCancel}
            className="illuminator-button illuminator-button-secondary"
            style={{ padding: '6px 16px', fontSize: '12px' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onStart(excludeChronicle)}
            disabled={available === 0}
            className="illuminator-button illuminator-button-primary"
            style={{ padding: '6px 16px', fontSize: '12px' }}
          >
            Start Revision ({available} entities)
          </button>
        </div>
      </div>
    </div>
  );
}
