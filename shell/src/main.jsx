import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initPWA } from './pwa/registerSW';

// Initialize PWA features
initPWA().then((registration) => {
  if (registration) {
    console.log('[App] PWA initialized successfully');
  }
}).catch((error) => {
  console.warn('[App] PWA initialization failed:', error);
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
