/**
 * PWA Status Component
 * Displays PWA status indicators and provides install/update functionality
 */

import React from 'react';
import { usePWA } from '../pwa/usePWA';

const styles = {
  container: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    alignItems: 'flex-end'
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '500',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    transition: 'all 0.3s ease'
  },
  onlineBadge: {
    backgroundColor: '#4caf50',
    color: 'white'
  },
  offlineBadge: {
    backgroundColor: '#f44336',
    color: 'white'
  },
  button: {
    padding: '10px 20px',
    borderRadius: '25px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
    transition: 'all 0.3s ease'
  },
  installButton: {
    backgroundColor: '#4285f4',
    color: 'white'
  },
  updateButton: {
    backgroundColor: '#ff9800',
    color: 'white'
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    animation: 'pulse 2s infinite'
  },
  onlineDot: {
    backgroundColor: '#81c784'
  },
  offlineDot: {
    backgroundColor: '#ef5350'
  }
};

export function PWAStatus({ showOfflineIndicator = true, showInstallPrompt = true }) {
  const { isOnline, canInstall, hasUpdate, install, update } = usePWA();

  return (
    <div style={styles.container}>
      {/* Offline indicator */}
      {showOfflineIndicator && !isOnline && (
        <div style={{ ...styles.badge, ...styles.offlineBadge }}>
          <span style={{ ...styles.dot, ...styles.offlineDot }} />
          You're offline
        </div>
      )}

      {/* Update available button */}
      {hasUpdate && (
        <button
          style={{ ...styles.button, ...styles.updateButton }}
          onClick={update}
          aria-label="Update available - click to update"
        >
          🔄 Update Available
        </button>
      )}

      {/* Install button */}
      {showInstallPrompt && canInstall && (
        <button
          style={{ ...styles.button, ...styles.installButton }}
          onClick={install}
          aria-label="Install app"
        >
          📲 Install App
        </button>
      )}

      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  );
}

export function OfflineBanner() {
  const { isOnline } = usePWA();

  if (isOnline) return null;

  return (
    <div
      style={{
        backgroundColor: '#f44336',
        color: 'white',
        padding: '10px 20px',
        textAlign: 'center',
        fontSize: '14px',
        fontWeight: '500',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999
      }}
    >
      📡 You're currently offline. Some features may be unavailable.
    </div>
  );
}

export function InstallBanner({ onDismiss }) {
  const { canInstall, install } = usePWA();
  const [dismissed, setDismissed] = React.useState(false);

  if (!canInstall || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      style={{
        backgroundColor: '#4285f4',
        color: 'white',
        padding: '15px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '15px',
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.2)'
      }}
    >
      <div style={{ flex: 1 }}>
        <strong>Install MFE Shell</strong>
        <p style={{ margin: '5px 0 0', fontSize: '13px', opacity: 0.9 }}>
          Add to your home screen for quick access and offline support.
        </p>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={handleDismiss}
          style={{
            padding: '8px 16px',
            backgroundColor: 'transparent',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.5)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Not now
        </button>
        <button
          onClick={install}
          style={{
            padding: '8px 16px',
            backgroundColor: 'white',
            color: '#4285f4',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600'
          }}
        >
          Install
        </button>
      </div>
    </div>
  );
}

export default PWAStatus;
