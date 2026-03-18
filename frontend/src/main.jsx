import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import InitErrorBoundary from './components/InitErrorBoundary';
import './index.css';

// ── Sentry error monitoring ──────────────────────────────────
Sentry.init({
  dsn: 'https://01ac7823d34622ec0f62148ee8183ee8@o4510981856296960.ingest.de.sentry.io/4511059867336784',
  environment: import.meta.env.MODE,
  sendDefaultPii: true,
  enabled: import.meta.env.PROD,
  tracesSampleRate: 0.2,
});

document.addEventListener('mousemove', e => {
  document.documentElement.style.setProperty('--cx', e.clientX + 'px')
  document.documentElement.style.setProperty('--cy', e.clientY + 'px')
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <InitErrorBoundary>
      <App />
    </InitErrorBoundary>
  </React.StrictMode>
);
