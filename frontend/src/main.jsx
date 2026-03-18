import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import InitErrorBoundary from './components/InitErrorBoundary';
import './index.css';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || "",
  enabled: !!import.meta.env.VITE_SENTRY_DSN && import.meta.env.PROD,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_COMMIT_SHA || "local",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
});

const sentryCreateBrowserRouter = Sentry.wrapCreateBrowserRouterV7(createBrowserRouter);
const router = sentryCreateBrowserRouter([
  {
    path: '*',
    element: (
      <Sentry.ErrorBoundary fallback={<p>Something went wrong. The error has been reported.</p>} showDialog>
        <App />
      </Sentry.ErrorBoundary>
    ),
  },
]);

document.addEventListener('mousemove', e => {
  document.documentElement.style.setProperty('--cx', e.clientX + 'px')
  document.documentElement.style.setProperty('--cy', e.clientY + 'px')
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <InitErrorBoundary>
      <RouterProvider router={router} />
    </InitErrorBoundary>
  </React.StrictMode>
);
