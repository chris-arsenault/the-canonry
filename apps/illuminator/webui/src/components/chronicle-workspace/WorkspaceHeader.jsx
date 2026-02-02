import { useState, useRef, useEffect } from 'react';

export default function WorkspaceHeader({
  item,
  wordCount,
  isGenerating,
  isComplete,
  onAccept,
  onRegenerate,
  onExport,
  onUnpublish,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  return (
    <div className="chronicle-workspace-header">
      <div className="chronicle-workspace-header-info">
        <h3>{item.title || item.name || 'Untitled Chronicle'}</h3>
        <div className="chronicle-workspace-header-stats">
          {wordCount.toLocaleString()} words
          {item.selectionSummary && (
            <span>
              {' '}&middot; {item.selectionSummary.entityCount} entities, {item.selectionSummary.eventCount} events
            </span>
          )}
          {item.focusType && (
            <span> &middot; {item.focusType === 'single' ? 'Single focus' : 'Ensemble'}</span>
          )}
        </div>
      </div>
      <div className="chronicle-workspace-header-actions">
        {!isComplete && onAccept && (
          <button
            onClick={onAccept}
            disabled={isGenerating}
            style={{
              padding: '8px 18px',
              background: 'var(--accent-primary)',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              opacity: isGenerating ? 0.6 : 1,
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            Accept &#x2713;
          </button>
        )}
        {isComplete && onUnpublish && (
          <button
            onClick={onUnpublish}
            style={{
              padding: '8px 16px',
              fontSize: '12px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
            title="Revert to assembly review without discarding content"
          >
            Unpublish
          </button>
        )}
        <button
          onClick={onRegenerate}
          disabled={isGenerating}
          style={{
            padding: '8px 16px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            color: 'var(--text-secondary)',
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            opacity: isGenerating ? 0.6 : 1,
            fontSize: '12px',
          }}
        >
          &#x27F3; {isComplete ? 'Restart' : 'Regenerate'}
        </button>
        <div className="workspace-overflow-menu" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              padding: '8px 10px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '14px',
              lineHeight: 1,
            }}
          >
            &hellip;
          </button>
          {menuOpen && (
            <div className="workspace-overflow-dropdown">
              {onExport && (
                <button
                  className="workspace-overflow-item"
                  onClick={() => { onExport(); setMenuOpen(false); }}
                  title="Export chronicle with full generation context as JSON"
                >
                  Export
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
