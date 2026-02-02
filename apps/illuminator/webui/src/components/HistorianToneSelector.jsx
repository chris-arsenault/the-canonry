/**
 * HistorianToneSelector - Popover button for selecting historian tone/mood
 *
 * Replaces the simple "Historian" button with a dropdown that lets the user
 * pick a tone before triggering a review. Same historian persona, different mood.
 */

import { useState, useRef, useEffect } from 'react';

// ============================================================================
// Tone Options
// ============================================================================

const TONE_OPTIONS = [
  {
    value: 'witty',
    label: 'Witty',
    description: 'Sarcastic, playful, sly',
    symbol: '✶',
  },
  {
    value: 'weary',
    label: 'Weary',
    description: 'Resigned satire, black humor',
    symbol: '○',
  },
  {
    value: 'forensic',
    label: 'Forensic',
    description: 'Clinical, methodical, cold',
    symbol: '◈',
  },
  {
    value: 'elegiac',
    label: 'Elegiac',
    description: 'Mournful, lyrical, grief',
    symbol: '◇',
  },
  {
    value: 'cantankerous',
    label: 'Cantankerous',
    description: 'Irritable, exacting, sharp',
    symbol: '♯',
  },
];

export const TONE_META = Object.fromEntries(
  TONE_OPTIONS.map((t) => [t.value, t])
);

// ============================================================================
// Component
// ============================================================================

export default function HistorianToneSelector({ onSelect, disabled, hasNotes, style }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (tone) => {
    setIsOpen(false);
    onSelect(tone);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', ...style }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        title="Select historian tone and generate annotations"
        style={{
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
          fontSize: '12px',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          textTransform: 'none',
          letterSpacing: 'normal',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {hasNotes ? 'Re-annotate' : 'Historian'} ▾
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            minWidth: '220px',
            padding: '4px',
          }}
        >
          <div style={{
            padding: '6px 8px 4px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            borderBottom: '1px solid var(--border-color)',
            marginBottom: '4px',
          }}>
            Historian Tone
          </div>
          {TONE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '6px 8px',
                background: 'transparent',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{
                fontSize: '13px',
                color: '#8b7355',
                width: '18px',
                textAlign: 'center',
                flexShrink: 0,
              }}>
                {option.symbol}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {option.label}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '1px' }}>
                  {option.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
