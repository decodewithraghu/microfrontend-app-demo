/**
 * React Hook for PWA functionality
 * Provides reactive state for PWA features
 */

import { useState, useEffect, useCallback } from 'react';
import {
  initPWA,
  isOnline as checkOnline,
  isRunningAsPWA,
  isInstallAvailable,
  showInstallPrompt,
  skipWaiting,
  clearCache,
  updateServiceWorker
} from './registerSW';

export function usePWA() {
  const [isOnline, setIsOnline] = useState(checkOnline());
  const [isPWA, setIsPWA] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize PWA
    initPWA().then(() => {
      setIsInitialized(true);
      setIsPWA(isRunningAsPWA());
    });

    // Listen for PWA events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleInstallAvailable = () => setCanInstall(true);
    const handleInstalled = () => setCanInstall(false);
    const handleUpdateAvailable = () => setHasUpdate(true);

    window.addEventListener('pwa-online', handleOnline);
    window.addEventListener('pwa-offline', handleOffline);
    window.addEventListener('pwa-install-available', handleInstallAvailable);
    window.addEventListener('pwa-installed', handleInstalled);
    window.addEventListener('pwa-update-available', handleUpdateAvailable);

    // Check initial install availability
    setCanInstall(isInstallAvailable());

    return () => {
      window.removeEventListener('pwa-online', handleOnline);
      window.removeEventListener('pwa-offline', handleOffline);
      window.removeEventListener('pwa-install-available', handleInstallAvailable);
      window.removeEventListener('pwa-installed', handleInstalled);
      window.removeEventListener('pwa-update-available', handleUpdateAvailable);
    };
  }, []);

  const install = useCallback(async () => {
    const accepted = await showInstallPrompt();
    if (accepted) {
      setCanInstall(false);
    }
    return accepted;
  }, []);

  const update = useCallback(() => {
    skipWaiting();
    window.location.reload();
  }, []);

  const checkForUpdates = useCallback(async () => {
    return await updateServiceWorker();
  }, []);

  const clearAppCache = useCallback(async () => {
    return await clearCache();
  }, []);

  return {
    isOnline,
    isPWA,
    canInstall,
    hasUpdate,
    isInitialized,
    install,
    update,
    checkForUpdates,
    clearAppCache
  };
}

export default usePWA;
