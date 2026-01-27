# Shell MFE Documentation

## Container Application

The Shell is the host application that orchestrates all Micro Frontends, manages routing, and provides the main application layout.

---

## Table of Contents

1. [Overview](#overview)
2. [Responsibilities](#responsibilities)
3. [Architecture](#architecture)
4. [Module Federation Config](#module-federation-config)
5. [Components](#components)
6. [Routing](#routing)
7. [Layout](#layout)
8. [Integration Points](#integration-points)
9. [Error Handling](#error-handling)
10. [Performance](#performance)

---

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         SHELL                               │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                      Header                            │ │
│  │  [Logo]  [Nav]  [Country: {selected}]  [User: {name}] │ │
│  └───────────────────────────────────────────────────────┘ │
│  ┌────────────┐  ┌────────────────────────────────────────┐│
│  │   Sidebar  │  │            Content Area                ││
│  │            │  │  ┌────────────────────────────────┐   ││
│  │  - Home    │  │  │         MFE Container          │   ││
│  │  - Login   │  │  │                                │   ││
│  │  - Weather │  │  │   [LoginMFE] [WeatherMFE]     │   ││
│  │  - Stats   │  │  │   [PopulationMFE]             │   ││
│  │            │  │  │                                │   ││
│  │            │  │  └────────────────────────────────┘   ││
│  └────────────┘  └────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Responsibilities

### 1. MFE Orchestration
- Load and mount remote MFEs
- Handle MFE lifecycle (mount/unmount)
- Manage MFE communication

### 2. Global State
- Maintain authentication state
- Track selected country
- Manage user preferences

### 3. Routing
- Define routes for all MFEs
- Handle navigation between MFEs
- Manage route guards

### 4. Layout
- Provide consistent header/footer
- Manage sidebar navigation
- Handle responsive design

### 5. Error Boundaries
- Catch MFE errors
- Display fallback UI
- Report errors

---

## Architecture

### File Structure

```
shell/
├── src/
│   ├── App.jsx              # Main app component
│   ├── main.jsx             # Entry point
│   ├── components/
│   │   ├── Header.jsx       # App header
│   │   ├── Sidebar.jsx      # Navigation sidebar
│   │   ├── Footer.jsx       # App footer
│   │   ├── ErrorBoundary.jsx
│   │   ├── MFEContainer.jsx # MFE wrapper
│   │   └── Notifications.jsx
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── Login.jsx        # Loads Login MFE
│   │   ├── Weather.jsx      # Loads Weather MFE
│   │   └── Population.jsx   # Loads Population MFE
│   ├── routes/
│   │   └── index.jsx        # Route definitions
│   └── styles/
│       └── global.css
├── public/
├── vite.config.js           # Module Federation config
└── package.json
```

---

## Module Federation Config

### vite.config.js

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'shell',
      
      // Remote MFEs to load
      remotes: {
        loginMFE: 'http://localhost:3001/assets/remoteEntry.js',
        weatherMFE: 'http://localhost:3002/assets/remoteEntry.js',
        populationMFE: 'http://localhost:3003/assets/remoteEntry.js',
      },
      
      // Shared dependencies
      shared: ['react', 'react-dom', 'react-router-dom'],
    }),
  ],
  
  server: {
    port: 3000,
    strictPort: true,
  },
  
  build: {
    modulePreload: false,
    target: 'esnext',
    minify: false,
    cssCodeSplit: false,
  },
});
```

---

## Components

### App.jsx

```javascript
import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import {
  useAuth,
  useEventBus,
  EventTypes,
  eventBus,
  stateStore,
} from '@mfe/shared';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Footer from './components/Footer';
import Notifications from './components/Notifications';
import ErrorBoundary from './components/ErrorBoundary';
import Routes from './routes';

function App() {
  const { isAuthenticated, user } = useAuth();

  // Initialize shared services on mount
  useEffect(() => {
    // Restore state from session storage
    stateStore.restore();
    
    // Log shell mount
    eventBus.publish(EventTypes.SYSTEM.MFE_MOUNTED, {
      name: 'Shell',
      timestamp: Date.now(),
    });

    return () => {
      eventBus.publish(EventTypes.SYSTEM.MFE_UNMOUNTED, {
        name: 'Shell',
        timestamp: Date.now(),
      });
    };
  }, []);

  // Listen for navigation events from MFEs
  useEventBus(EventTypes.UI.NAVIGATE, (payload) => {
    if (payload.path) {
      window.history.pushState({}, '', payload.path);
    }
  });

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <div className="app">
          <Header />
          <div className="app-body">
            <Sidebar />
            <main className="content">
              <Routes />
            </main>
          </div>
          <Footer />
          <Notifications />
        </div>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
```

### Header.jsx

```javascript
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useCountry } from '@mfe/shared';

function Header() {
  const { isAuthenticated, user, logout } = useAuth();
  const { selectedCountry } = useCountry();

  return (
    <header className="header">
      <div className="header-brand">
        <Link to="/">🌍 MFE App</Link>
      </div>

      <nav className="header-nav">
        <Link to="/">Home</Link>
        {isAuthenticated && (
          <>
            <Link to="/weather">Weather</Link>
            <Link to="/population">Population</Link>
          </>
        )}
      </nav>

      <div className="header-status">
        {selectedCountry && (
          <span className="selected-country">
            <img 
              src={selectedCountry.flags?.png} 
              alt="" 
              width="20" 
            />
            {selectedCountry.name?.common}
          </span>
        )}

        {isAuthenticated ? (
          <div className="user-menu">
            <span>{user?.name}</span>
            <button onClick={logout}>Logout</button>
          </div>
        ) : (
          <Link to="/login" className="login-btn">Login</Link>
        )}
      </div>
    </header>
  );
}

export default Header;
```

### MFEContainer.jsx

```javascript
import React, { Suspense, lazy, useState, useEffect } from 'react';
import ErrorBoundary from './ErrorBoundary';
import { eventBus, EventTypes } from '@mfe/shared';

const LoadingFallback = () => (
  <div className="mfe-loading">
    <div className="spinner"></div>
    <p>Loading...</p>
  </div>
);

const ErrorFallback = ({ error, resetError }) => (
  <div className="mfe-error">
    <h2>Something went wrong</h2>
    <p>{error?.message || 'Failed to load module'}</p>
    <button onClick={resetError}>Try Again</button>
  </div>
);

function MFEContainer({ name, loadComponent }) {
  const [Component, setComponent] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    // Publish loading state
    eventBus.publish(EventTypes.UI.LOADING_START, { mfe: name });

    loadComponent()
      .then((module) => {
        if (mounted) {
          setComponent(() => module.default);
          eventBus.publish(EventTypes.UI.LOADING_END, { mfe: name });
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err);
          eventBus.publish(EventTypes.SYSTEM.MFE_ERROR, {
            mfe: name,
            error: err.message,
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, [name, loadComponent]);

  if (error) {
    return (
      <ErrorFallback 
        error={error} 
        resetError={() => {
          setError(null);
          setComponent(null);
        }} 
      />
    );
  }

  if (!Component) {
    return <LoadingFallback />;
  }

  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <Suspense fallback={<LoadingFallback />}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  );
}

export default MFEContainer;
```

---

## Routing

### routes/index.jsx

```javascript
import React, { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@mfe/shared';

import Home from '../pages/Home';
import MFEContainer from '../components/MFEContainer';

// Lazy load MFEs
const loadLoginMFE = () => import('loginMFE/App');
const loadWeatherMFE = () => import('weatherMFE/App');
const loadPopulationMFE = () => import('populationMFE/App');

// Route guard for authenticated routes
function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
}

// Route guard for unauthenticated routes
function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return !isAuthenticated ? children : <Navigate to="/" />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      
      <Route
        path="/login"
        element={
          <PublicRoute>
            <MFEContainer 
              name="LoginMFE" 
              loadComponent={loadLoginMFE} 
            />
          </PublicRoute>
        }
      />
      
      <Route
        path="/weather"
        element={
          <PrivateRoute>
            <MFEContainer 
              name="WeatherMFE" 
              loadComponent={loadWeatherMFE} 
            />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/population"
        element={
          <PrivateRoute>
            <MFEContainer 
              name="PopulationMFE" 
              loadComponent={loadPopulationMFE} 
            />
          </PrivateRoute>
        }
      />
      
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default AppRoutes;
```

---

## Layout

### CSS Structure

```css
/* global.css */

/* App Layout */
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-body {
  display: flex;
  flex: 1;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  background: #1a1a2e;
  color: white;
}

.header-brand a {
  font-size: 1.5rem;
  font-weight: bold;
  text-decoration: none;
  color: inherit;
}

.header-nav {
  display: flex;
  gap: 1rem;
}

.header-nav a {
  color: #a0a0a0;
  text-decoration: none;
  transition: color 0.2s;
}

.header-nav a:hover,
.header-nav a.active {
  color: white;
}

/* Sidebar */
.sidebar {
  width: 250px;
  background: #16213e;
  padding: 1rem;
}

.sidebar-nav {
  list-style: none;
  padding: 0;
}

.sidebar-nav a {
  display: block;
  padding: 0.75rem 1rem;
  color: #a0a0a0;
  text-decoration: none;
  border-radius: 4px;
  transition: all 0.2s;
}

.sidebar-nav a:hover,
.sidebar-nav a.active {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

/* Main Content */
.content {
  flex: 1;
  padding: 2rem;
  background: #0f0f23;
  overflow-y: auto;
}

/* MFE Loading States */
.mfe-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #333;
  border-top-color: #4a90d9;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Responsive */
@media (max-width: 768px) {
  .app-body {
    flex-direction: column;
  }
  
  .sidebar {
    width: 100%;
    order: 2;
  }
}
```

---

## Integration Points

### Event Subscriptions

```javascript
// Shell listens for these events from MFEs

// Authentication events
useEventBus(EventTypes.AUTH.LOGIN, handleLogin);
useEventBus(EventTypes.AUTH.LOGOUT, handleLogout);

// Country selection
useEventBus(EventTypes.STATE.COUNTRY_SELECTED, handleCountryChange);

// Navigation requests
useEventBus(EventTypes.UI.NAVIGATE, handleNavigation);

// Notifications
useEventBus(EventTypes.UI.NOTIFICATION, showNotification);

// MFE lifecycle
useEventBus(EventTypes.SYSTEM.MFE_MOUNTED, logMFEMount);
useEventBus(EventTypes.SYSTEM.MFE_UNMOUNTED, logMFEUnmount);
useEventBus(EventTypes.SYSTEM.MFE_ERROR, handleMFEError);
```

### State Sharing

```javascript
// Shell provides these state slices to MFEs

// Authentication state
stateStore.select('auth');
// { user, isAuthenticated, token }

// Selected country
stateStore.select('country');
// { selectedCountry, countries }

// User preferences
stateStore.select('preferences');
// { theme, language }

// Loading states
stateStore.select('loading');
// { [key]: boolean }

// Errors
stateStore.select('errors');
// { [key]: string }
```

---

## Error Handling

The Shell provides comprehensive error handling when MFEs fail to load. This includes a user-friendly error page with recovery options.

### ErrorPage Component

When an MFE fails to load, users see a dedicated error page with:
- Clear error message and description
- Helpful troubleshooting hints
- **Try Again** button - reloads the current page
- **Go to Home** button - redirects to the login/home page

```javascript
// Error Page Component
const ErrorPage = ({ error, onRetry, onGoHome }) => (
  <div className="error-page">
    <div className="error-page-content">
      <div className="error-icon">⚠️</div>
      <h1 className="error-title">Oops! Something went wrong</h1>
      <h2 className="error-subtitle">Failed to load micro frontend</h2>
      <p className="error-message">
        {error?.message || 'An unexpected error occurred while loading the application.'}
      </p>
      <div className="error-details">
        <p>This could be due to:</p>
        <ul>
          <li>Network connectivity issues</li>
          <li>The micro frontend service is temporarily unavailable</li>
          <li>An internal application error</li>
        </ul>
      </div>
      <div className="error-actions">
        <button onClick={onRetry} className="error-btn error-btn-retry">
          🔄 Try Again
        </button>
        <button onClick={onGoHome} className="error-btn error-btn-home">
          🏠 Go to Home
        </button>
      </div>
    </div>
  </div>
);
```

### ErrorBoundary Component

```javascript
import React from 'react';
import { eventBus, EventTypes } from '@mfe/shared';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console for debugging
    console.error('MFE Error:', error, errorInfo);
    
    // Publish error event
    eventBus.publish(EventTypes.SYSTEM.MFE_ERROR, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
    
    // Report to monitoring service
    if (window.errorReporter) {
      window.errorReporter.captureException(error, { extra: errorInfo });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/login';
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorPage 
          error={this.state.error} 
          onRetry={this.handleRetry} 
          onGoHome={this.handleGoHome} 
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

### Error Page Styling

The error page includes smooth animations and responsive design:

```css
/* Error Page Styles */
.error-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 2rem;
}

.error-page-content {
  background: white;
  border-radius: 20px;
  padding: 3rem;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  max-width: 500px;
  animation: fadeInUp 0.5s ease-out;
}

.error-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.error-btn-retry {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.error-btn-home {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  color: white;
}
```

### Testing Error Handling

To test the error page functionality:

1. **Stop an MFE server** - Run only the shell without one of the MFE services
2. **Modify remote URL** - Change the port in `vite.config.js` to a non-existent one
3. **Block network requests** - Use browser DevTools to block MFE requests
4. **Simulate error** - Add `throw new Error('Test')` in an MFE component

---

## Performance

### Optimization Strategies

```javascript
// 1. Lazy loading MFEs
const LoginMFE = lazy(() => import('loginMFE/App'));

// 2. Preload MFEs on hover
function NavLink({ to, children, preload }) {
  const handleMouseEnter = () => {
    if (preload) {
      preload();
    }
  };

  return (
    <Link to={to} onMouseEnter={handleMouseEnter}>
      {children}
    </Link>
  );
}

// Usage
<NavLink to="/weather" preload={() => import('weatherMFE/App')}>
  Weather
</NavLink>

// 3. Cache MFE modules
const mfeCache = new Map();

async function loadMFE(name, loader) {
  if (mfeCache.has(name)) {
    return mfeCache.get(name);
  }
  
  const module = await loader();
  mfeCache.set(name, module);
  return module;
}

// 4. Measure performance
useEffect(() => {
  const timing = performance.now();
  
  return () => {
    const duration = performance.now() - timing;
    eventBus.publish(EventTypes.SYSTEM.PERFORMANCE, {
      mfe: 'Shell',
      duration,
    });
  };
}, []);
```

---

## Configuration

### Environment Variables

```env
# .env.development
VITE_LOGIN_MFE_URL=http://localhost:3001/assets/remoteEntry.js
VITE_WEATHER_MFE_URL=http://localhost:3002/assets/remoteEntry.js
VITE_POPULATION_MFE_URL=http://localhost:3003/assets/remoteEntry.js

# .env.production
VITE_LOGIN_MFE_URL=https://cdn.example.com/login/remoteEntry.js
VITE_WEATHER_MFE_URL=https://cdn.example.com/weather/remoteEntry.js
VITE_POPULATION_MFE_URL=https://cdn.example.com/population/remoteEntry.js
```

### Dynamic Remote Loading

```javascript
// vite.config.js
federation({
  name: 'shell',
  remotes: {
    loginMFE: process.env.VITE_LOGIN_MFE_URL,
    weatherMFE: process.env.VITE_WEATHER_MFE_URL,
    populationMFE: process.env.VITE_POPULATION_MFE_URL,
  },
});
```

---

## Checklist

### Development
- [ ] All MFEs can be loaded independently
- [ ] Routes work correctly
- [ ] State is shared properly
- [ ] Events are flowing
- [ ] Error boundaries catch errors

### Production
- [ ] MFE URLs are configured
- [ ] Shared dependencies are optimized
- [ ] Error reporting is enabled
- [ ] Performance metrics are tracked
- [ ] Lazy loading is working

---

## Next Steps

- [Login MFE](./MFE_LOGIN.md)
- [Weather MFE](./MFE_WEATHER.md)
- [Population MFE](./MFE_POPULATION.md)
