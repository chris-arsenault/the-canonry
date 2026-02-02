import React from 'react';

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
  },
  card: {
    maxWidth: '420px',
    textAlign: 'center',
    background: 'rgba(12, 31, 46, 0.7)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '16px',
    padding: '28px',
  },
  title: {
    fontSize: '18px',
    marginBottom: '10px',
  },
  message: {
    fontSize: '13px',
    color: '#93c5fd',
    lineHeight: 1.6,
  },
  instructions: {
    marginTop: '16px',
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#ffffff',
    background: 'rgba(15, 23, 42, 0.6)',
    borderRadius: '8px',
    padding: '10px 12px',
  },
};

export default function RemotePlaceholder({ name, instructions }) {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.title}>{name} not connected</div>
        <div style={styles.message}>
          This viewer expects the {name} remote to be running on the same origin.
        </div>
        {instructions ? (
          <div style={styles.instructions}>{instructions}</div>
        ) : null}
      </div>
    </div>
  );
}
