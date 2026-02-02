/**
 * BackportConfigModal - Pre-backport entity selection and custom instructions
 *
 * Opens before lore backport to let the user:
 * - Select which entities to include (cast + lens)
 * - Provide custom instructions (e.g., "treat as non-canonical fable")
 */

import { useState, useMemo } from 'react';

export default function BackportConfigModal({
  isOpen,
  chronicleTitle,
  entities,
  onStart,
  onCancel,
}) {
  const [selectedIds, setSelectedIds] = useState(() => new Set(entities.map(e => e.id)));
  const [customInstructions, setCustomInstructions] = useState('');

  // Reset selections when entities change (new modal open)
  const entityKey = entities.map(e => e.id).join(',');
  const [prevKey, setPrevKey] = useState(entityKey);
  if (entityKey !== prevKey) {
    setPrevKey(entityKey);
    setSelectedIds(new Set(entities.map(e => e.id)));
    setCustomInstructions('');
  }

  const castEntities = useMemo(() => entities.filter(e => !e.isLens), [entities]);
  const lensEntities = useMemo(() => entities.filter(e => e.isLens), [entities]);
  const selectedCount = selectedIds.size;
  const allSelected = selectedCount === entities.length;

  if (!isOpen) return null;

  const toggleEntity = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(entities.map(e => e.id)));
    }
  };

  const renderEntityRow = (e) => (
    <label
      key={e.id}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 0',
        cursor: 'pointer',
        fontSize: '12px',
      }}
    >
      <input
        type="checkbox"
        checked={selectedIds.has(e.id)}
        onChange={() => toggleEntity(e.id)}
      />
      <span style={{ flex: 1 }}>
        {e.name}
        <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>
          {e.kind}{e.subtype ? ` / ${e.subtype}` : ''}
        </span>
      </span>
      {e.isLens && (
        <span style={{
          fontSize: '9px',
          padding: '1px 5px',
          borderRadius: '3px',
          background: 'rgba(139, 92, 246, 0.15)',
          color: '#8b5cf6',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Lens
        </span>
      )}
    </label>
  );

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
        width: '500px',
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
          flexShrink: 0,
        }}>
          <h2 style={{ margin: 0, fontSize: '16px' }}>
            Backport Lore to Cast
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {chronicleTitle}
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {/* Entity selection */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
            }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Entities ({selectedCount}/{entities.length})
              </span>
              <button
                onClick={toggleAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-color)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  padding: 0,
                }}
              >
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: '6px',
              padding: '8px 12px',
              maxHeight: '200px',
              overflowY: 'auto',
            }}>
              {castEntities.map(renderEntityRow)}
              {lensEntities.length > 0 && castEntities.length > 0 && (
                <div style={{
                  borderTop: '1px solid var(--border-color)',
                  marginTop: '4px',
                  paddingTop: '4px',
                }}/>
              )}
              {lensEntities.map(renderEntityRow)}
            </div>
          </div>

          {/* Custom instructions */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '11px',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              fontWeight: 600,
              marginBottom: '6px',
            }}>
              Custom Instructions (optional)
            </label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder={'e.g. "This chronicle is a fable \u2014 treat its events as in-universe fiction, not canonical history. Backported lore should reference these events as legends, myths, or disputed accounts."'}
              rows={3}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                resize: 'vertical',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
            <p style={{ margin: '4px 0 0', fontSize: '10px', color: 'var(--text-muted)' }}>
              These instructions will be injected as critical directives into the backport prompt. Use this for non-canonical chronicles (fables, prophecies, dreamscapes) or any special handling.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px 16px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end',
          flexShrink: 0,
        }}>
          <button
            onClick={onCancel}
            className="illuminator-button illuminator-button-secondary"
            style={{ padding: '6px 16px', fontSize: '12px' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onStart(Array.from(selectedIds), customInstructions.trim())}
            disabled={selectedCount === 0}
            className="illuminator-button illuminator-button-primary"
            style={{ padding: '6px 16px', fontSize: '12px' }}
          >
            Start Backport ({selectedCount} {selectedCount === 1 ? 'entity' : 'entities'})
          </button>
        </div>
      </div>
    </div>
  );
}
