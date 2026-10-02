import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerServiceWorker } from './lib/browserNotifications';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// The service worker only handles reminders (Web Push); registering early
// lets the browser deliver them even after this tab is closed.
if (import.meta.env.PROD) void registerServiceWorker();
