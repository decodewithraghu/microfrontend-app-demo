# Troubleshooting Guide

## Common Issues and Solutions

This guide helps diagnose and resolve common issues in the MFE application.

---

## Table of Contents

1. [Development Issues](#development-issues)
2. [Build Issues](#build-issues)
3. [Runtime Issues](#runtime-issues)
4. [Module Federation Issues](#module-federation-issues)
5. [Event Bus Issues](#event-bus-issues)
6. [State Management Issues](#state-management-issues)
7. [Authentication Issues](#authentication-issues)
8. [Performance Issues](#performance-issues)
9. [Debug Tools](#debug-tools)

---

## Development Issues

### Issue: Blank page after loading (Module Federation)

**Symptoms:**
- Application shows blank page
- Console shows `remoteEntry.js` 404 errors
- MFEs not loading in Shell

**Root Cause:**
Module Federation only works in **preview mode**. The `remoteEntry.js` files are generated during the build process, not in development mode.

**Solution:**

```bash
# Always build before preview
npm run build
npm run preview

# DO NOT use npm run dev for Module Federation testing
```

---

### Issue: MFE fails to start

**Symptoms:**
- `npm run dev` fails
- Port already in use error

**Solutions:**

```bash
# 1. Kill processes on MFE ports
npx kill-port 3000 3001 3002 3003

# 2. Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# 3. Check for conflicting processes
netstat -ano | findstr :3000
```

---

### Issue: Hot Module Replacement (HMR) not working

**Symptoms:**
- Changes don't reflect
- Need to manually refresh

**Solutions:**

```javascript
// 1. Check vite.config.js has correct HMR settings
export default {
  server: {
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
  },
};

// 2. Clear browser cache
// Chrome: Ctrl+Shift+R

// 3. Check for circular dependencies
// Use madge to detect: npx madge --circular src/
```

---

### Issue: Import errors for shared library

**Symptoms:**
- `Cannot find module '@mfe/shared'`
- Import resolution fails

**Solutions:**

```bash
# 1. Rebuild shared library
cd shared
npm run build

# 2. Check package.json has correct path
{
  "dependencies": {
    "@mfe/shared": "file:../shared"
  }
}

# 3. Link the package
cd shared && npm link
cd ../shell && npm link @mfe/shared
```

---

### Issue: Session not shared between Shell and MFEs

**Symptoms:**
- Login works but Shell doesn't recognize user
- Redirect after login doesn't work
- Country selection not persisting

**Root Cause:**
Session format mismatch between MFEs. Shell and Login MFE must use the same encoding.

**Solution:**

Both Shell and Login MFE should use identical session helpers:

```javascript
// Session keys
const AUTH_KEY = 'mfe_auth_session';
const COUNTRY_KEY = 'mfe_selected_country';

// Encrypt/Decrypt using Base64
const encryptData = (data) => {
  const jsonStr = JSON.stringify(data);
  return btoa(encodeURIComponent(jsonStr));
};

const decryptData = (encrypted) => {
  try {
    const jsonStr = decodeURIComponent(atob(encrypted));
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
};
```

---

## Build Issues

### Issue: Build fails with Module Federation

**Symptoms:**
- `Cannot find remote 'loginMFE'`
- Build hangs or fails

**Solutions:**

```javascript
// 1. Check vite.config.js remote URLs
federation({
  remotes: {
    // Ensure URLs are correct for build environment
    loginMFE: process.env.NODE_ENV === 'production'
      ? 'https://cdn.example.com/login/remoteEntry.js'
      : 'http://localhost:3001/assets/remoteEntry.js',
  },
});

// 2. Build MFEs before Shell
// Order matters: shared → MFEs → Shell

// 3. Check for TypeScript errors
npm run type-check
```

---

### Issue: CSS not loading in production

**Symptoms:**
- Styles missing after build
- FOUC (Flash of Unstyled Content)

**Solutions:**

```javascript
// 1. Check cssCodeSplit in vite.config.js
export default {
  build: {
    cssCodeSplit: false, // Bundle all CSS
  },
};

// 2. Ensure CSS imports are correct
import './styles/index.css'; // Not dynamic import

// 3. Check for CSS module naming
// Use .module.css for CSS modules
```

---

## Runtime Issues

### Issue: MFE not loading in Shell

**Symptoms:**
- Blank area where MFE should be
- Console errors about failed imports
- Error page displayed with "Failed to load micro frontend" message

**What Users See:**

When an MFE fails to load, the Shell displays a user-friendly error page with:
- ⚠️ Warning icon with animation
- Clear error title: "Oops! Something went wrong"
- Error details explaining possible causes
- Two action buttons:
  - **🔄 Try Again** - Reloads the current page
  - **🏠 Go to Home** - Redirects to the login page

**Solutions:**

```javascript
// 1. Check remoteEntry.js is accessible
fetch('http://localhost:3001/assets/remoteEntry.js')
  .then(r => r.text())
  .then(console.log)
  .catch(console.error);

// 2. Check CORS headers on MFE server
// vite.config.js
server: {
  cors: true,
}

// 3. Check network tab for failed requests
// Look for 404s or CORS errors

// 4. Verify shared dependencies are configured
federation({
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
  },
});

// 5. Ensure all MFE servers are running
// Check ports: 5001 (login), 5002 (weather), 5003 (population)
```

**Testing MFE Failure:**

To test the error handling:
1. Stop one of the MFE dev servers
2. Navigate to that MFE's route in the shell
3. The error page should appear with recovery options

---

### Issue: "Shared module is not available for eager consumption"

**Symptoms:**
- Error in console about eager consumption
- App crashes on load

**Solutions:**

```javascript
// 1. Use async boundary in entry point
// main.jsx
import('./bootstrap').then(({ default: App }) => {
  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
});

// bootstrap.jsx
import App from './App';
export default App;

// 2. Configure shared modules properly
federation({
  shared: {
    react: {
      singleton: true,
      requiredVersion: '^18.2.0',
      eager: false, // Important!
    },
  },
});
```

---

## Module Federation Issues

### Issue: Version mismatch between Shell and MFEs

**Symptoms:**
- `Invalid hook call` error
- Multiple React instances

**Solutions:**

```javascript
// 1. Ensure all projects use same React version
// All package.json files:
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}

// 2. Configure singleton in Module Federation
federation({
  shared: {
    react: {
      singleton: true,
      strictVersion: true,
    },
    'react-dom': {
      singleton: true,
      strictVersion: true,
    },
  },
});

// 3. Check for duplicate React in node_modules
npm ls react
```

---

### Issue: Dynamic remote loading fails

**Symptoms:**
- Remote MFE doesn't load
- `__webpack_require__.l` errors

**Solutions:**

```javascript
// 1. Use correct dynamic import syntax
const loadRemote = async (url, scope, module) => {
  await __webpack_init_sharing__('default');
  const container = window[scope];
  await container.init(__webpack_share_scopes__.default);
  const factory = await container.get(module);
  return factory();
};

// 2. Handle loading errors
try {
  const Module = await import('loginMFE/App');
  return Module.default;
} catch (error) {
  console.error('Failed to load MFE:', error);
  return FallbackComponent;
}
```

---

## Event Bus Issues

### Issue: Events not being received

**Symptoms:**
- Subscribers don't receive events
- Communication between MFEs broken

**Solutions:**

```javascript
// 1. Verify event type matches exactly
import { EventTypes, eventBus } from '@mfe/shared';

// ✅ Correct
eventBus.subscribe(EventTypes.AUTH.LOGIN, handler);
eventBus.publish(EventTypes.AUTH.LOGIN, payload);

// ❌ Wrong (string mismatch)
eventBus.subscribe('mfe:auth:login', handler);
eventBus.publish('mfe:auth:LOGIN', payload);

// 2. Check subscription is active
console.log(eventBus.getSubscribers('mfe:auth:login'));

// 3. Ensure useEventBus hook is properly configured
useEventBus(EventTypes.AUTH.LOGIN, handler, { enabled: true });

// 4. Check if middleware is blocking events
eventBus.use((event, next) => {
  console.log('Event passing through:', event.type);
  return next();
});
```

---

### Issue: Events firing multiple times

**Symptoms:**
- Handler called multiple times
- Duplicate processing

**Solutions:**

```javascript
// 1. Ensure cleanup in useEffect
useEffect(() => {
  const unsubscribe = eventBus.subscribe(type, handler);
  return () => unsubscribe(); // Important!
}, []);

// 2. Use once() for one-time events
eventBus.once(EventTypes.AUTH.LOGIN, handler);

// 3. Check for re-renders causing multiple subscriptions
// Use React.memo or useMemo for handlers
const handler = useCallback((payload) => {
  // Handle event
}, [dependencies]);
```

---

### Issue: Cross-tab events not working

**Symptoms:**
- Events don't sync across browser tabs
- LocalStorage listener not firing

**Solutions:**

```javascript
// 1. Verify localStorage is available
if (typeof window !== 'undefined' && window.localStorage) {
  // Safe to use
}

// 2. Check storage event listener
window.addEventListener('storage', (e) => {
  console.log('Storage event:', e.key, e.newValue);
});

// 3. Ensure cross-tab sync is enabled
eventBus.enableCrossTabSync(); // If method exists

// 4. Check if events are being published with sync option
eventBus.publish(type, payload, { crossTab: true });
```

---

## State Management Issues

### Issue: State not persisting

**Symptoms:**
- State resets on refresh
- Session data lost

**Solutions:**

```javascript
// 1. Enable persistence in StateStore
stateStore.enablePersistence({
  key: 'mfe-state',
  storage: sessionStorage,
});

// 2. Call restore on app init
useEffect(() => {
  stateStore.restore();
}, []);

// 3. Check sessionStorage in DevTools
console.log(sessionStorage.getItem('mfe-state'));

// 4. Verify state structure is serializable
// No functions, symbols, or circular references
```

---

### Issue: State updates not reflecting in UI

**Symptoms:**
- State changes but component doesn't re-render
- Stale data displayed

**Solutions:**

```javascript
// 1. Ensure using hooks correctly
const [state] = useStateStore('auth.user');
// Component re-renders when auth.user changes

// 2. Check selector path is correct
// ✅ Correct
const [user] = useStateStore('auth.user');

// ❌ Wrong (non-existent path)
const [user] = useStateStore('authentication.currentUser');

// 3. Verify immutable updates
stateStore.dispatch({
  type: 'SET_USER',
  payload: { ...user, name: 'New Name' }, // New object
});

// 4. Force component re-render if needed
const [, forceUpdate] = useReducer(x => x + 1, 0);
```

---

## Authentication Issues

### Issue: User gets logged out unexpectedly

**Symptoms:**
- Session expires too soon
- Redirected to login randomly

**Solutions:**

```javascript
// 1. Check token expiration time
const token = authService.getToken();
console.log('Token expires:', new Date(token.exp * 1000));

// 2. Verify session refresh is working
authService.refreshSession(); // Call before expiry

// 3. Check if session is being cleared
eventBus.subscribe(EventTypes.AUTH.SESSION_EXPIRED, () => {
  console.log('Session expired!');
});

// 4. Increase session duration in authService
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const REFRESH_THRESHOLD = 60 * 60 * 1000; // 1 hour before
```

---

### Issue: RBAC permissions not working

**Symptoms:**
- User can't access permitted features
- Admin features showing for regular users

**Solutions:**

```javascript
// 1. Check role assignment
console.log('User role:', authService.getCurrentUser()?.role);

// 2. Verify permission check logic
const hasPermission = authService.hasPermission('admin:dashboard');
console.log('Has permission:', hasPermission);

// 3. Check Permissions mapping
import { Roles, Permissions } from '@mfe/shared';
console.log('Admin permissions:', Permissions[Roles.ADMIN]);

// 4. Use correct role check
if (authService.hasRole(Roles.ADMIN)) {
  // Admin-only code
}
```

---

## Performance Issues

### Issue: Slow initial load

**Symptoms:**
- Long time to first contentful paint
- Large JavaScript bundles

**Solutions:**

```javascript
// 1. Analyze bundle size
npm run build -- --report
// Check dist/report.html

// 2. Lazy load MFEs
const LoginMFE = lazy(() => import('loginMFE/App'));

// 3. Preload critical MFEs
<link rel="modulepreload" href="/login/remoteEntry.js" />

// 4. Enable compression
// vite.config.js
import compression from 'vite-plugin-compression';
plugins: [compression()];

// 5. Optimize shared dependencies
shared: {
  react: {
    singleton: true,
    eager: false, // Don't bundle in each MFE
  },
}
```

---

### Issue: Memory leaks

**Symptoms:**
- App becomes slow over time
- Browser memory usage grows

**Solutions:**

```javascript
// 1. Clean up event subscriptions
useEffect(() => {
  const unsubscribe = eventBus.subscribe(type, handler);
  return () => {
    unsubscribe(); // Clean up!
  };
}, []);

// 2. Clean up timers and intervals
useEffect(() => {
  const timer = setInterval(callback, 1000);
  return () => clearInterval(timer);
}, []);

// 3. Cancel pending API calls
useEffect(() => {
  const controller = new AbortController();
  
  fetch(url, { signal: controller.signal });
  
  return () => controller.abort();
}, [url]);

// 4. Use Chrome DevTools Memory tab
// Take heap snapshots to identify leaks
```

---

## Debug Tools

### Enable Debug Mode

```javascript
// In browser console
localStorage.setItem('debug', 'mfe:*');

// Or in code
import { eventBus, createLoggingMiddleware } from '@mfe/shared';

eventBus.use(createLoggingMiddleware({
  level: 'debug',
  prettyPrint: true,
}));
```

### Event History

```javascript
// View event history
console.log(eventBus.getHistory());

// Filter by type
console.log(eventBus.getHistory('mfe:auth:*'));

// Replay events
eventBus.replay('mfe:auth:login');
```

### State Inspector

```javascript
// View current state
console.log(stateStore.getState());

// Time travel
stateStore.undo();
stateStore.redo();

// View snapshots
console.log(stateStore.getSnapshots());
```

### Debug Panel Component

```javascript
function DebugPanel() {
  const [state] = useStateStore();
  const { history } = useEventHistory();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="debug-panel">
      <h3>State</h3>
      <pre>{JSON.stringify(state, null, 2)}</pre>
      
      <h3>Events</h3>
      <ul>
        {history.slice(-10).map(e => (
          <li key={e.meta.id}>
            {e.type} - {new Date(e.meta.timestamp).toISOString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Network Debugging

```javascript
// Log all API calls
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  console.log('Fetch:', args[0]);
  const response = await originalFetch(...args);
  console.log('Response:', response.status);
  return response;
};
```

---

## Quick Reference

| Issue | Quick Fix |
|-------|-----------|
| Port in use | `npx kill-port 3000 3001 3002 3003` |
| Module not found | `cd shared && npm run build` |
| CORS error | Add `cors: true` to vite.config.js |
| Multiple React | Add `singleton: true` to shared config |
| Events not firing | Check EventTypes match exactly |
| State not updating | Ensure immutable updates |
| Session lost | Check token expiration |
| Slow load | Enable lazy loading |

---

## Getting Help

1. Check this guide first
2. Search existing issues on GitHub
3. Check browser DevTools console
4. Enable debug mode and review logs
5. Create issue with:
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Browser/OS info
   - Console errors

---

## Next Steps

- [Getting Started](./GETTING_STARTED.md)
- [Architecture](./ARCHITECTURE.md)
- [Testing Guide](./TESTING.md)
