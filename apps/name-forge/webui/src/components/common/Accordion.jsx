import { useState } from 'react';

function Accordion({ title, badge, badgeColor, defaultOpen = false, children, headerRight }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div style={{
      borderRadius: '6px',
      overflow: 'hidden',
      marginBottom: '0.5rem'
    }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          background: 'rgba(30, 58, 95, 0.4)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: isOpen ? '6px 6px 0 0' : '6px',
          cursor: 'pointer',
          color: 'var(--text-color)',
          textAlign: 'left',
          fontSize: '0.95rem',
          fontWeight: 500
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            display: 'inline-block',
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            fontSize: '0.75rem'
          }}>▶</span>
          <span>{title}</span>
          {badge && (
            <span style={{
              background: badgeColor || 'rgba(212, 175, 55, 0.3)',
              padding: '0.15rem 0.5rem',
              borderRadius: '10px',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              color: 'var(--gold-accent)'
            }}>{badge}</span>
          )}
        </div>
        {headerRight}
      </button>
      {isOpen && (
        <div style={{
          padding: '1rem',
          background: 'rgba(20, 45, 75, 0.3)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderTop: 'none',
          borderRadius: '0 0 6px 6px'
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default Accordion;
