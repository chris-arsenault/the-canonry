function Modal({ isOpen, onClose, title, children, width = '500px' }) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1a2a3a',
          border: '1px solid #3b5068',
          borderRadius: '8px',
          width,
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid #3b5068',
          background: '#1e3a5f'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-color)',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.25rem',
              lineHeight: 1
            }}
          >×</button>
        </div>
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, background: '#1a2a3a' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default Modal;
