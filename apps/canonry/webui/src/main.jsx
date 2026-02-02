import React from 'react';
import ReactDOM from 'react-dom/client';
import '@penguin-tales/shared-components/styles';
import App from './App';

// Debug boot log to confirm client initialization in production
console.log('[Canonry] Bootstrapping app bundle');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
