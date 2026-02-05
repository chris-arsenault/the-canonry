/**
 * Main entry point for Chronicler MFE
 * Only used in standalone development mode
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/variables.css';
import ChroniclerRemote from './ChroniclerRemote.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div style={{ padding: '24px' }}>
      <h1 style={{ marginBottom: '16px', fontFamily: '"Playfair Display", Georgia, serif' }}>Chronicler (Standalone Dev Mode)</h1>
      <p style={{ color: 'var(--color-text-muted, #8a7d6b)', marginBottom: '24px' }}>
        Chronicler is designed to run within The Canonry shell.
        Run <code>npm run canonry</code> from the repo root to use the full suite.
      </p>
      <ChroniclerRemote worldData={null} loreData={null} />
    </div>
  </React.StrictMode>
);
