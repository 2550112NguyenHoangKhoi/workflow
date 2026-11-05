import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Apply the saved dark-mode preference before the first paint so the app
// doesn't flash light. The Topbar moon toggle keeps this key in sync.
if (localStorage.getItem('workflow_dark_mode') === '1') {
  document.documentElement.classList.add('dark-mode');
}

// Migration: 'workflow_api_key' may hold an OFFLINE/LOCAL sentinel written before the
// Settings engine picker existed. Settings always writes 'workflow_engine_mode' alongside
// the sentinel, so a sentinel without a mode is stale — clear it so the backend's
// configured Gemini key (from .env) powers the AI features again.
if (!localStorage.getItem('workflow_engine_mode')) {
  const signal = localStorage.getItem('workflow_api_key');
  if (signal === 'OFFLINE' || signal === 'LOCAL') {
    localStorage.setItem('workflow_api_key', '');
  }
}

// Desktop app: the local backend requires the per-launch token from the Electron preload
// on every API call. Wrap fetch once so the many call sites don't each need to know.
const desktopToken = window.workflowDesktop?.apiToken;
if (desktopToken) {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || String(input);
    if (url.startsWith('http://127.0.0.1:8000/') || url.startsWith('/api/')) {
      const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
      headers.set('X-Workflow-Token', desktopToken);
      init = { ...init, headers };
    }
    return nativeFetch(input, init);
  };
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
