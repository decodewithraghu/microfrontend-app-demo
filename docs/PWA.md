# PWA (Progressive Web App) Documentation

## Overview

The MFE Shell application has been converted to a Progressive Web App, providing:

- **Offline Support**: The app can work offline using cached resources
- **Installable**: Users can install the app to their device's home screen
- **Push Notifications**: Support for push notifications (when configured)
- **Background Sync**: Ability to sync data when connectivity is restored

## PWA Features

### 1. Service Worker (`public/sw.js`)

The service worker handles:

- **Caching Strategies**:
  - **Cache-First**: For static assets (JS, CSS, images)
  - **Network-First**: For API calls and MFE remote entries
  - **Stale-While-Revalidate**: For general requests

- **Automatic Updates**: Detects and notifies users of new versions

- **Offline Fallback**: Serves cached content when offline

### 2. Web App Manifest (`public/manifest.json`)

Defines the PWA metadata:

- App name and description
- Theme and background colors
- Display mode (standalone)
- App icons for various sizes

### 3. React Integration

#### `usePWA` Hook

```jsx
import { usePWA } from './pwa/usePWA';

function MyComponent() {
  const {
    isOnline,      // Boolean: current network status
    isPWA,         // Boolean: running as installed PWA
    canInstall,    // Boolean: install prompt available
    hasUpdate,     // Boolean: new version available
    install,       // Function: trigger install prompt
    update,        // Function: apply update and reload
    checkForUpdates, // Function: check for SW updates
    clearAppCache  // Function: clear all caches
  } = usePWA();

  return (
    <div>
      {!isOnline && <p>You're offline</p>}
      {canInstall && <button onClick={install}>Install App</button>}
      {hasUpdate && <button onClick={update}>Update Available</button>}
    </div>
  );
}
```

#### PWA Components

- **`<PWAStatus />`**: Floating status indicator with install/update buttons
- **`<OfflineBanner />`**: Top banner shown when offline
- **`<InstallBanner />`**: Bottom banner prompting installation

## Icon Generation

PWA requires icons in multiple sizes. Generate them from the SVG source:

```bash
# Using ImageMagick
for size in 72 96 128 144 152 192 384 512; do
  convert public/icons/icon.svg -resize ${size}x${size} public/icons/icon-${size}x${size}.png
done

# Or use an online tool like:
# - https://realfavicongenerator.net/
# - https://www.pwabuilder.com/imageGenerator
```

## Testing PWA Features

### Chrome DevTools

1. Open DevTools → Application tab
2. Check "Service Workers" section for registration status
3. Use "Manifest" section to verify app manifest
4. Test offline mode in "Network" conditions

### Lighthouse Audit

Run a Lighthouse audit with "Progressive Web App" category enabled to check:
- Service worker registration
- HTTPS (required for production)
- Manifest validity
- Offline capability

### Local Testing

```bash
# Build the app
npm run build

# Preview the production build
npm run preview
```

Note: Service workers only work in production builds. For development:
- The service worker won't be active
- Use the build preview to test PWA features

## Configuration

### Customizing Cache Behavior

Edit `public/sw.js` to modify:

- `STATIC_ASSETS`: Files to cache on install
- `MFE_REMOTES`: MFE entry points to cache
- Caching strategies for different request types

### Customizing Manifest

Edit `public/manifest.json` to change:

- App name and description
- Theme colors
- Icon paths
- Display mode and orientation

## Browser Support

PWA features are supported in:

- Chrome 67+
- Firefox 63+
- Safari 11.3+ (iOS), 14+ (macOS)
- Edge 79+
- Samsung Internet 6.2+

## Troubleshooting

### Service Worker Not Registering

1. Check browser console for errors
2. Ensure serving over HTTPS (or localhost)
3. Verify `sw.js` is in the correct location

### Install Prompt Not Showing

The install prompt requires:
- Valid manifest with required fields
- Service worker registered
- HTTPS connection
- User engagement (visited twice within 5 minutes)

### Cache Not Updating

1. Use browser DevTools to unregister the service worker
2. Clear application cache
3. Hard refresh the page (Ctrl+Shift+R)

## Security Considerations

- Service workers require HTTPS in production
- Be careful what you cache (avoid sensitive data)
- Implement cache expiration strategies
- Consider cache versioning for updates
