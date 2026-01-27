# State Store API Documentation

## Centralized State Management for Micro Frontends

The State Store provides Redux-like state management with immutability, persistence, time-travel debugging, and cross-MFE synchronization.

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [State Structure](#state-structure)
4. [Action Types](#action-types)
5. [Core API](#core-api)
6. [Selectors](#selectors)
7. [Subscriptions](#subscriptions)
8. [Middleware](#middleware)
9. [Time-Travel Debugging](#time-travel-debugging)
10. [Snapshots](#snapshots)
11. [Persistence](#persistence)
12. [Best Practices](#best-practices)

---

## Overview

The State Store implements a unidirectional data flow pattern with:

- **Immutable State**: All state updates create new state objects
- **Action-Based Updates**: State changes via dispatched actions
- **Middleware Support**: Intercept and transform actions
- **Subscriptions**: React to state changes
- **Time-Travel**: Undo/redo state changes
- **Persistence**: Automatic sessionStorage sync
- **Cross-Tab Sync**: State synchronized across tabs

---

## Quick Start

```javascript
import store, { ActionTypes } from '@mfe/shared';

// Get current state
const state = store.getState();

// Select specific state slice
const user = store.select('auth.user');

// Dispatch action
store.dispatch({
  type: ActionTypes.SET_USER,
  payload: { id: '123', username: 'john', role: 'admin' },
});

// Subscribe to changes
const unsubscribe = store.subscribe((newState, oldState, action) => {
  console.log('State changed:', action.type);
});
```

---

## State Structure

The store maintains a structured state tree:

```javascript
{
  // Authentication state
  auth: {
    user: {
      id: string,
      username: string,
      name: string,
      role: 'admin' | 'user' | 'guest',
      permissions: string[],
    } | null,
    session: {
      token: string,
      expiresAt: number,
    } | null,
    isAuthenticated: boolean,
    lastActivity: number | null,
  },

  // Country selection
  country: {
    selected: {
      name: { common: string, official: string },
      cca2: string,
      cca3: string,
      capital: string[],
      region: string,
      subregion: string,
      latlng: [number, number],
      population: number,
      area: number,
      flags: { png: string, svg: string },
      currencies: object,
      languages: object,
    } | null,
    list: Country[],
    lastUpdated: number | null,
  },

  // Cached data
  data: {
    weather: WeatherData | null,
    population: PopulationData | null,
    cache: {
      [key: string]: {
        data: any,
        timestamp: number,
      },
    },
  },

  // UI state
  ui: {
    loading: { [key: string]: boolean },
    errors: { [key: string]: string },
    notifications: Notification[],
  },

  // User preferences
  preferences: {
    theme: 'light' | 'dark',
    language: string,
    timezone: string,
  },

  // Store metadata
  meta: {
    version: string,
    lastUpdated: number,
    stateId: string,
  },
}
```

---

## Action Types

All available action types:

### Authentication Actions

```javascript
ActionTypes = {
  SET_USER: 'SET_USER',           // Set user data
  CLEAR_USER: 'CLEAR_USER',       // Clear user (logout)
  SET_SESSION: 'SET_SESSION',     // Set session token
  CLEAR_SESSION: 'CLEAR_SESSION', // Clear session
}
```

### Country Actions

```javascript
ActionTypes = {
  SET_COUNTRY: 'SET_COUNTRY',     // Set selected country
  CLEAR_COUNTRY: 'CLEAR_COUNTRY', // Clear selection
}
```

### Data Actions

```javascript
ActionTypes = {
  SET_WEATHER_DATA: 'SET_WEATHER_DATA',       // Store weather data
  SET_POPULATION_DATA: 'SET_POPULATION_DATA', // Store population data
  SET_COUNTRIES_LIST: 'SET_COUNTRIES_LIST',   // Store countries list
  CLEAR_DATA: 'CLEAR_DATA',                   // Clear all data
}
```

### UI Actions

```javascript
ActionTypes = {
  SET_LOADING: 'SET_LOADING',         // Set loading state
  SET_ERROR: 'SET_ERROR',             // Set error message
  CLEAR_ERROR: 'CLEAR_ERROR',         // Clear error
  SET_NOTIFICATION: 'SET_NOTIFICATION', // Add notification
}
```

### System Actions

```javascript
ActionTypes = {
  SET_PREFERENCES: 'SET_PREFERENCES', // Update preferences
  RESET_STATE: 'RESET_STATE',         // Reset to initial
  RESTORE_STATE: 'RESTORE_STATE',     // Restore from snapshot
  HYDRATE_STATE: 'HYDRATE_STATE',     // Merge state
}
```

---

## Core API

### `getState()`

Get the entire state (immutable copy).

```javascript
const state = store.getState();
console.log(state.auth.user);
// Note: state is frozen, modifications throw errors
```

### `select(path, defaultValue?)`

Get a specific state slice by path.

```javascript
// Simple selection
const user = store.select('auth.user');
const isAuth = store.select('auth.isAuthenticated');

// Nested selection
const countryName = store.select('country.selected.name.common');

// With default value
const theme = store.select('preferences.theme', 'light');

// Deep selection
const weatherCache = store.select('data.cache.weather_US');
```

### `dispatch(action)`

Dispatch an action to update state.

```javascript
// Set user
store.dispatch({
  type: ActionTypes.SET_USER,
  payload: {
    id: '123',
    username: 'john',
    name: 'John Doe',
    role: 'admin',
    permissions: ['read', 'write', 'admin'],
  },
});

// Set loading state
store.dispatch({
  type: ActionTypes.SET_LOADING,
  payload: { key: 'weather', value: true },
});

// Set error
store.dispatch({
  type: ActionTypes.SET_ERROR,
  payload: { key: 'weather', error: 'Failed to fetch' },
});

// Clear error
store.dispatch({
  type: ActionTypes.CLEAR_ERROR,
  payload: { key: 'weather' },
});

// Add notification
store.dispatch({
  type: ActionTypes.SET_NOTIFICATION,
  payload: {
    message: 'Country selected!',
    type: 'success',
    duration: 3000,
  },
});
```

---

## Selectors

### Basic Selectors

```javascript
const user = store.select('auth.user');
const country = store.select('country.selected');
const isLoading = store.select('ui.loading.weather');
```

### Memoized Selectors

Create cached selectors for computed values:

```javascript
// Create memoized selector
const getFullUserName = store.createSelector(
  'auth.user',
  (user) => user ? `${user.name} (${user.role})` : 'Guest'
);

// Use selector (cached result)
const displayName = getFullUserName();
```

### Derived State

```javascript
const getIsEuropean = store.createSelector(
  'country.selected',
  (country) => country?.region === 'Europe'
);

const getFormattedPopulation = store.createSelector(
  'country.selected.population',
  (pop) => pop?.toLocaleString() ?? 'N/A'
);
```

---

## Subscriptions

### Subscribe to All Changes

```javascript
const unsubscribe = store.subscribe((newState, oldState, action) => {
  console.log('Action:', action.type);
  console.log('New state:', newState);
});
```

### Subscribe to Specific Slice

```javascript
// Only notified when auth.user changes
const unsubscribe = store.subscribe(
  (newValue, oldValue, action) => {
    console.log('User changed:', newValue);
  },
  'auth.user' // Selector path
);
```

### Multiple Subscriptions

```javascript
// Subscribe to multiple paths
const unsub1 = store.subscribe(handleUserChange, 'auth.user');
const unsub2 = store.subscribe(handleCountryChange, 'country.selected');

// Cleanup
const cleanup = () => {
  unsub1();
  unsub2();
};
```

---

## Middleware

Add custom logic to the dispatch pipeline:

### Adding Middleware

```javascript
// Logging middleware
const loggingMiddleware = (state, action) => {
  console.log('Dispatching:', action.type);
  console.log('Current state:', state);
  return action; // Continue with action
};

const removeMiddleware = store.use(loggingMiddleware);
```

### Blocking Actions

```javascript
// Validation middleware
const validationMiddleware = (state, action) => {
  if (action.type === ActionTypes.SET_USER) {
    if (!action.payload?.username) {
      console.error('Username required');
      return false; // Block action
    }
  }
  return action;
};

store.use(validationMiddleware);
```

### Transforming Actions

```javascript
// Transform middleware
const timestampMiddleware = (state, action) => {
  return {
    ...action,
    payload: {
      ...action.payload,
      _timestamp: Date.now(),
    },
  };
};

store.use(timestampMiddleware);
```

---

## Time-Travel Debugging

Navigate through state history:

### Undo/Redo

```javascript
// Undo last change
store.undo();

// Redo undone change
store.redo();

// Check if can undo/redo
const history = store.getHistory();
const canUndo = history.length > 0 && 
                history.findIndex(h => h.isCurrent) > 0;
```

### Get History

```javascript
const history = store.getHistory();
// [
//   { index: 0, timestamp: 1704067200000, isCurrent: false },
//   { index: 1, timestamp: 1704067260000, isCurrent: true },
// ]
```

### Jump to History Point

```javascript
// Jump to specific history index
store.jumpToHistory(0); // Go to first state
```

---

## Snapshots

Save and restore state snapshots:

### Create Snapshot

```javascript
store.createSnapshot('before-logout');
store.createSnapshot('initial-state');
```

### List Snapshots

```javascript
const snapshots = store.listSnapshots();
// [
//   { name: 'before-logout', createdAt: 1704067200000, state: {...} },
//   { name: 'initial-state', createdAt: 1704067100000, state: {...} },
// ]
```

### Restore Snapshot

```javascript
store.restoreSnapshot('before-logout');
```

### Delete Snapshot

```javascript
store.deleteSnapshot('old-snapshot');
```

---

## Persistence

State is automatically persisted to sessionStorage:

### Configuration

```javascript
import { createStore } from '@mfe/shared';

const store = createStore({
  persist: true,              // Enable persistence
  storageType: 'session',     // 'session' or 'local'
  enableTimeTravel: true,     // Enable undo/redo
  maxHistorySize: 50,         // History limit
  enableCrossTabSync: true,   // Sync across tabs
});
```

### Manual Control

```javascript
// State auto-persists on every dispatch
// Hydrates from storage on initialization

// Reset clears persistence
store.reset();
```

---

## Best Practices

### 1. Use Action Constants

```javascript
// ✅ Good
store.dispatch({ type: ActionTypes.SET_USER, payload });

// ❌ Bad
store.dispatch({ type: 'SET_USER', payload });
```

### 2. Keep State Serializable

```javascript
// ✅ Good - serializable
store.dispatch({
  type: ActionTypes.SET_USER,
  payload: { id: '123', name: 'John' },
});

// ❌ Bad - non-serializable
store.dispatch({
  type: ActionTypes.SET_USER,
  payload: { handler: () => {} }, // Functions not serializable
});
```

### 3. Use Selectors for Derived Data

```javascript
// ✅ Good - computed via selector
const isAdmin = store.createSelector(
  'auth.user',
  (user) => user?.role === 'admin'
);

// ❌ Bad - storing derived data
store.dispatch({
  type: ActionTypes.SET_USER,
  payload: { ...user, isAdmin: true }, // Redundant
});
```

### 4. Cleanup Subscriptions

```javascript
// In React
useEffect(() => {
  const unsubscribe = store.subscribe(handler, 'auth.user');
  return () => unsubscribe();
}, []);
```

### 5. Use Appropriate Action Granularity

```javascript
// ✅ Good - specific actions
store.dispatch({ type: ActionTypes.SET_LOADING, payload: { key: 'weather', value: true } });
store.dispatch({ type: ActionTypes.SET_WEATHER_DATA, payload: data });
store.dispatch({ type: ActionTypes.SET_LOADING, payload: { key: 'weather', value: false } });

// ❌ Bad - too broad
store.dispatch({ type: 'UPDATE_EVERYTHING', payload: { loading: true, data, ... } });
```

---

## Examples

### Complete Data Fetching Pattern

```javascript
// Weather MFE
const fetchWeather = async (country) => {
  const cacheKey = `weather_${country.cca2}`;
  
  // Check cache
  const cached = store.select(`data.cache.${cacheKey}`);
  if (cached && Date.now() - cached.timestamp < 300000) {
    store.dispatch({
      type: ActionTypes.SET_WEATHER_DATA,
      payload: cached.data,
    });
    return;
  }
  
  // Set loading
  store.dispatch({
    type: ActionTypes.SET_LOADING,
    payload: { key: 'weather', value: true },
  });
  
  try {
    const data = await weatherApi.fetch(country.latlng);
    
    store.dispatch({
      type: ActionTypes.SET_WEATHER_DATA,
      payload: { ...data, countryCode: country.cca2 },
    });
    
  } catch (error) {
    store.dispatch({
      type: ActionTypes.SET_ERROR,
      payload: { key: 'weather', error: error.message },
    });
    
  } finally {
    store.dispatch({
      type: ActionTypes.SET_LOADING,
      payload: { key: 'weather', value: false },
    });
  }
};
```

### React Hook Integration

```javascript
import { useStateStore } from '@mfe/shared';

function WeatherDisplay() {
  const [weather] = useStateStore('data.weather');
  const [isLoading] = useStateStore('ui.loading.weather');
  const [error] = useStateStore('ui.errors.weather');
  
  if (isLoading) return <Spinner />;
  if (error) return <Error message={error} />;
  if (!weather) return <NoData />;
  
  return <WeatherCard data={weather} />;
}
```

---

## API Reference Summary

| Method | Description |
|--------|-------------|
| `getState()` | Get full state (immutable) |
| `select(path, default)` | Get state slice |
| `createSelector(path, fn)` | Create memoized selector |
| `dispatch(action)` | Dispatch action |
| `subscribe(listener, selector)` | Subscribe to changes |
| `use(middleware)` | Add middleware |
| `removeMiddleware(fn)` | Remove middleware |
| `undo()` | Undo last change |
| `redo()` | Redo change |
| `getHistory()` | Get history |
| `jumpToHistory(index)` | Jump to history point |
| `createSnapshot(name)` | Save snapshot |
| `listSnapshots()` | List snapshots |
| `restoreSnapshot(name)` | Restore snapshot |
| `deleteSnapshot(name)` | Delete snapshot |
| `reset()` | Reset to initial |
| `destroy()` | Cleanup instance |

---

## Next Steps

- [Authentication Service](./API_AUTH_SERVICE.md)
- [React Hooks](./API_REACT_HOOKS.md)
- [Testing Guide](./TESTING.md)
