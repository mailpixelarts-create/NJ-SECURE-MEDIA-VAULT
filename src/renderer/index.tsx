import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import './styles/themes.css';
import './styles/components.css';

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  document.body.innerHTML = `<div style="color:red;padding:20px;font-family:monospace">
    <h2>Renderer Error</h2>
    <pre>${event.error?.message}\n${event.error?.stack}</pre>
  </div>`;
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
  document.body.innerHTML = `<div style="color:red;padding:20px;font-family:monospace">
    <h2>Unhandled Promise Rejection</h2>
    <pre>${event.reason?.message || event.reason}\n${event.reason?.stack || ''}</pre>
  </div>`;
});

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <App />
);
