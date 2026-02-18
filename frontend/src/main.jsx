import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { VibeKanbanWebCompanion } from 'vibe-kanban-web-companion'
import './i18n'
import './index.css'
import App from './App.jsx'

// Delete stale service worker cache that broke Mapbox in Chrome.
// Mapbox GL manages its own tile cache — the SW should not cache it.
if ('caches' in window) {
  caches.delete('mapbox-cache');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <VibeKanbanWebCompanion />
    <App />
  </StrictMode>,
)
