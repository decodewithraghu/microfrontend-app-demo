/**
 * PWA Service Worker Registration
 * Handles service worker lifecycle and provides utilities for PWA features
 */

const SW_URL = '/sw.js';

// Check if service workers are supported
export function isPWASupported() {
  return 'serviceWorker' in navigator;
}

// Check if the app is running as installed PWA
export function isRunningAsPWA() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true ||
         document.referrer.includes('android-app://');
}

// Register service worker
export async function registerServiceWorker() {
  if (!isPWASupported()) {
    console.log('[PWA] Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_URL, {
      scope: '/'
    });

    console.log('[PWA] Service Worker registered with scope:', registration.scope);

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      console.log('[PWA] New Service Worker installing...');

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New content available, notify user
          console.log('[PWA] New content available');
          dispatchPWAEvent('pwa-update-available', { registration });
        }
      });
    });

    return registration;
  } catch (error) {
    console.error('[PWA] Service Worker registration failed:', error);
    return null;
  }
}

// Unregister service worker
export async function unregisterServiceWorker() {
  if (!isPWASupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const result = await registration.unregister();
    console.log('[PWA] Service Worker unregistered:', result);
    return result;
  } catch (error) {
    console.error('[PWA] Service Worker unregistration failed:', error);
    return false;
  }
}

// Update service worker
export async function updateServiceWorker() {
  if (!isPWASupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
    console.log('[PWA] Service Worker update triggered');
    return true;
  } catch (error) {
    console.error('[PWA] Service Worker update failed:', error);
    return false;
  }
}

// Skip waiting and activate new service worker
export function skipWaiting() {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
  }
}

// Clear all caches
export async function clearCache() {
  if (!isPWASupported()) {
    return false;
  }

  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('[PWA] All caches cleared');
    return true;
  } catch (error) {
    console.error('[PWA] Cache clearing failed:', error);
    return false;
  }
}

// Dispatch custom PWA events
function dispatchPWAEvent(eventName, detail = {}) {
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

// Handle online/offline status
export function setupOnlineStatusListeners() {
  window.addEventListener('online', () => {
    console.log('[PWA] App is online');
    dispatchPWAEvent('pwa-online');
  });

  window.addEventListener('offline', () => {
    console.log('[PWA] App is offline');
    dispatchPWAEvent('pwa-offline');
  });
}

// Get current online status
export function isOnline() {
  return navigator.onLine;
}

// Install prompt handling
let deferredPrompt = null;

export function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Prevent the mini-infobar from appearing
    event.preventDefault();
    // Store the event for later use
    deferredPrompt = event;
    console.log('[PWA] Install prompt captured');
    dispatchPWAEvent('pwa-install-available');
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed');
    deferredPrompt = null;
    dispatchPWAEvent('pwa-installed');
  });
}

// Show install prompt
export async function showInstallPrompt() {
  if (!deferredPrompt) {
    console.log('[PWA] No install prompt available');
    return false;
  }

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log('[PWA] Install prompt outcome:', outcome);
  deferredPrompt = null;
  return outcome === 'accepted';
}

// Check if install prompt is available
export function isInstallAvailable() {
  return deferredPrompt !== null;
}

// Initialize PWA features
export async function initPWA() {
  if (!isPWASupported()) {
    console.log('[PWA] PWA features not supported in this browser');
    return null;
  }

  // Setup listeners
  setupOnlineStatusListeners();
  setupInstallPrompt();

  // Register service worker
  const registration = await registerServiceWorker();

  // Log PWA status
  console.log('[PWA] Running as PWA:', isRunningAsPWA());
  console.log('[PWA] Online status:', isOnline());

  return registration;
}

export default {
  initPWA,
  registerServiceWorker,
  unregisterServiceWorker,
  updateServiceWorker,
  skipWaiting,
  clearCache,
  isPWASupported,
  isRunningAsPWA,
  isOnline,
  showInstallPrompt,
  isInstallAvailable,
  setupOnlineStatusListeners,
  setupInstallPrompt
};
