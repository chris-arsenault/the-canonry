import React from 'react';
import { createRoot } from 'react-dom/client';
import '@penguin-tales/shared-components/styles';
import App from './App.jsx';
import './styles.css';

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
