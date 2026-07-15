import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import { ToastProvider } from './components/ui/Toast'
import { initMonitoring } from './lib/monitoring'
// Leaflet's CSS is imported alongside its JS in AtlasMap so it only ships with
// the Atlas chunk — the public landing route never pays for map styles.
import './index.css'

// Start error tracking before anything renders so early crashes are captured.
// No-op unless VITE_SENTRY_DSN is set.
initMonitoring()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
