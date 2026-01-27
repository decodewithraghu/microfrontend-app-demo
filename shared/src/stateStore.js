/**
 * Centralized State Store for Micro Frontend Applications
 * 
 * Features:
 * - Immutable state updates
 * - State persistence (sessionStorage/localStorage)
 * - State selectors with memoization
 * - Middleware support (logging, validation, transformation)
 * - Time-travel debugging
 * - State snapshots
 * - Cross-MFE state synchronization via EventBus
 */

import eventBus, { EventTypes, Priority } from './eventBus.js';

// Storage keys
const STORAGE_KEYS = {
  STATE: 'mfe_state_store',
  SNAPSHOTS: 'mfe_state_snapshots',
};

// Action types
export const ActionTypes = Object.freeze({
  // Auth actions
  SET_USER: 'SET_USER',
  CLEAR_USER: 'CLEAR_USER',
  SET_SESSION: 'SET_SESSION',
  CLEAR_SESSION: 'CLEAR_SESSION',
  
  // Country actions
  SET_COUNTRY: 'SET_COUNTRY',
  CLEAR_COUNTRY: 'CLEAR_COUNTRY',
  
  // Data actions
  SET_WEATHER_DATA: 'SET_WEATHER_DATA',
  SET_POPULATION_DATA: 'SET_POPULATION_DATA',
  SET_COUNTRIES_LIST: 'SET_COUNTRIES_LIST',
  CLEAR_DATA: 'CLEAR_DATA',
  
  // UI actions
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_NOTIFICATION: 'SET_NOTIFICATION',
  
  // Preferences
  SET_PREFERENCES: 'SET_PREFERENCES',
  
  // System
  RESET_STATE: 'RESET_STATE',
  RESTORE_STATE: 'RESTORE_STATE',
  HYDRATE_STATE: 'HYDRATE_STATE',
});

// Initial state structure
const initialState = {
  auth: {
    user: null,
    session: null,
    isAuthenticated: false,
    lastActivity: null,
  },
  country: {
    selected: null,
    list: [],
    lastUpdated: null,
  },
  data: {
    weather: null,
    population: null,
    cache: {},
  },
  ui: {
    loading: {},
    errors: {},
    notifications: [],
  },
  preferences: {
    theme: 'light',
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
  meta: {
    version: '1.0.0',
    lastUpdated: null,
    stateId: null,
  },
};

/**
 * Deep clone utility
 */
const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (obj instanceof Object) {
    return Object.keys(obj).reduce((acc, key) => {
      acc[key] = deepClone(obj[key]);
      return acc;
    }, {});
  }
  return obj;
};

/**
 * Deep freeze utility for immutability
 */
const deepFreeze = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  
  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      deepFreeze(obj[key]);
    }
  });
  
  return Object.freeze(obj);
};

/**
 * Deep merge utility
 */
const deepMerge = (target, source) => {
  const result = deepClone(target);
  
  Object.keys(source).forEach(key => {
    if (source[key] instanceof Object && key in target) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = deepClone(source[key]);
    }
  });
  
  return result;
};

/**
 * Main StateStore Class
 */
class StateStore {
  constructor(options = {}) {
    const {
      persist = true,
      storageType = 'session', // 'session' | 'local'
      enableTimeTravel = true,
      maxHistorySize = 50,
      enableCrossTabSync = true,
      debugMode = false,
    } = options;

    this._state = deepClone(initialState);
    this._listeners = new Set();
    this._middlewares = [];
    this._history = [];
    this._historyIndex = -1;
    this._maxHistorySize = maxHistorySize;
    this._persist = persist;
    this._storage = storageType === 'local' ? localStorage : sessionStorage;
    this._enableTimeTravel = enableTimeTravel;
    this._enableCrossTabSync = enableCrossTabSync;
    this._debugMode = debugMode;
    this._selectorCache = new Map();
    this._instanceId = Math.random().toString(36).substr(2, 9);

    // Initialize
    this._hydrate();
    this._setupEventBusSync();
    
    if (enableCrossTabSync) {
      this._setupCrossTabSync();
    }
  }

  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled) {
    this._debugMode = enabled;
  }

  /**
   * Internal logging
   */
  _log(level, message, data = null) {
    if (!this._debugMode && level !== 'error') return;
    
    const prefix = `[StateStore:${this._instanceId}]`;
    console[level](`${prefix} ${message}`, data || '');
  }

  /**
   * Hydrate state from storage
   */
  _hydrate() {
    try {
      const stored = this._storage.getItem(STORAGE_KEYS.STATE);
      if (stored) {
        const parsed = JSON.parse(stored);
        this._state = deepMerge(initialState, parsed);
        this._log('info', 'State hydrated from storage');
      }
    } catch (error) {
      this._log('error', 'Failed to hydrate state', error);
    }
  }

  /**
   * Persist state to storage
   */
  _persistState() {
    if (!this._persist) return;
    
    try {
      const stateToPersist = {
        ...this._state,
        meta: {
          ...this._state.meta,
          lastUpdated: Date.now(),
          stateId: this._instanceId,
        },
      };
      this._storage.setItem(STORAGE_KEYS.STATE, JSON.stringify(stateToPersist));
    } catch (error) {
      this._log('error', 'Failed to persist state', error);
    }
  }

  /**
   * Setup EventBus synchronization
   */
  _setupEventBusSync() {
    // Sync state changes via EventBus
    eventBus.subscribe(EventTypes.STATE.USER_UPDATED, (payload) => {
      if (payload._storeId !== this._instanceId) {
        this._applyExternalUpdate('auth.user', payload.user);
      }
    }, { priority: Priority.HIGH });

    eventBus.subscribe(EventTypes.STATE.COUNTRY_SELECTED, (payload) => {
      if (payload._storeId !== this._instanceId) {
        this._applyExternalUpdate('country.selected', payload.country);
      }
    }, { priority: Priority.HIGH });
  }

  /**
   * Setup cross-tab synchronization
   */
  _setupCrossTabSync() {
    if (typeof window === 'undefined') return;

    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEYS.STATE && event.newValue) {
        try {
          const newState = JSON.parse(event.newValue);
          if (newState.meta?.stateId !== this._instanceId) {
            this._state = deepMerge(this._state, newState);
            this._notifyListeners();
            this._log('info', 'State synced from another tab');
          }
        } catch (error) {
          this._log('error', 'Failed to sync state from tab', error);
        }
      }
    });
  }

  /**
   * Apply external state update
   */
  _applyExternalUpdate(path, value) {
    const keys = path.split('.');
    const newState = deepClone(this._state);
    let current = newState;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    this._state = newState;
    this._notifyListeners();
  }

  /**
   * Add middleware
   */
  use(middleware) {
    if (typeof middleware !== 'function') {
      throw new Error('Middleware must be a function');
    }
    this._middlewares.push(middleware);
    return () => this.removeMiddleware(middleware);
  }

  /**
   * Remove middleware
   */
  removeMiddleware(middleware) {
    const index = this._middlewares.indexOf(middleware);
    if (index > -1) {
      this._middlewares.splice(index, 1);
    }
  }

  /**
   * Get current state (immutable)
   */
  getState() {
    return deepFreeze(deepClone(this._state));
  }

  /**
   * Get state slice by path
   */
  select(path, defaultValue = undefined) {
    const keys = path.split('.');
    let current = this._state;
    
    for (const key of keys) {
      if (current === undefined || current === null) {
        return defaultValue;
      }
      current = current[key];
    }
    
    return current !== undefined ? deepClone(current) : defaultValue;
  }

  /**
   * Create memoized selector
   */
  createSelector(path, transform = (v) => v) {
    return () => {
      const value = this.select(path);
      const cacheKey = `${path}:${JSON.stringify(value)}`;
      
      if (this._selectorCache.has(cacheKey)) {
        return this._selectorCache.get(cacheKey);
      }
      
      const result = transform(value);
      this._selectorCache.set(cacheKey, result);
      
      // Limit cache size
      if (this._selectorCache.size > 100) {
        const firstKey = this._selectorCache.keys().next().value;
        this._selectorCache.delete(firstKey);
      }
      
      return result;
    };
  }

  /**
   * Dispatch action to update state
   */
  dispatch(action) {
    if (!action || !action.type) {
      throw new Error('Action must have a type');
    }

    this._log('info', `Dispatching action: ${action.type}`, action.payload);

    // Run through middlewares
    let currentAction = action;
    for (const middleware of this._middlewares) {
      const result = middleware(this.getState(), currentAction);
      if (result === false) {
        this._log('warn', `Action ${action.type} blocked by middleware`);
        return;
      }
      if (result && result.type) {
        currentAction = result;
      }
    }

    // Save current state for time-travel
    if (this._enableTimeTravel) {
      this._saveToHistory();
    }

    // Reduce state
    const previousState = this._state;
    this._state = this._reduce(this._state, currentAction);
    
    // Update meta
    this._state.meta.lastUpdated = Date.now();

    // Clear selector cache
    this._selectorCache.clear();

    // Persist
    this._persistState();

    // Notify listeners
    this._notifyListeners(currentAction, previousState);

    // Publish state change events
    this._publishStateEvents(currentAction);
  }

  /**
   * Reducer function
   */
  _reduce(state, action) {
    const newState = deepClone(state);

    switch (action.type) {
      case ActionTypes.SET_USER:
        newState.auth.user = action.payload;
        newState.auth.isAuthenticated = !!action.payload;
        newState.auth.lastActivity = Date.now();
        break;

      case ActionTypes.CLEAR_USER:
        newState.auth.user = null;
        newState.auth.isAuthenticated = false;
        newState.auth.session = null;
        break;

      case ActionTypes.SET_SESSION:
        newState.auth.session = action.payload;
        newState.auth.lastActivity = Date.now();
        break;

      case ActionTypes.CLEAR_SESSION:
        newState.auth.session = null;
        newState.auth.isAuthenticated = false;
        break;

      case ActionTypes.SET_COUNTRY:
        newState.country.selected = action.payload;
        newState.country.lastUpdated = Date.now();
        break;

      case ActionTypes.CLEAR_COUNTRY:
        newState.country.selected = null;
        break;

      case ActionTypes.SET_WEATHER_DATA:
        newState.data.weather = action.payload;
        newState.data.cache[`weather_${action.payload?.countryCode}`] = {
          data: action.payload,
          timestamp: Date.now(),
        };
        break;

      case ActionTypes.SET_POPULATION_DATA:
        newState.data.population = action.payload;
        newState.data.cache[`population_${action.payload?.countryCode}`] = {
          data: action.payload,
          timestamp: Date.now(),
        };
        break;

      case ActionTypes.SET_COUNTRIES_LIST:
        newState.country.list = action.payload;
        newState.country.lastUpdated = Date.now();
        break;

      case ActionTypes.CLEAR_DATA:
        newState.data = deepClone(initialState.data);
        break;

      case ActionTypes.SET_LOADING:
        newState.ui.loading[action.payload.key] = action.payload.value;
        break;

      case ActionTypes.SET_ERROR:
        newState.ui.errors[action.payload.key] = action.payload.error;
        break;

      case ActionTypes.CLEAR_ERROR:
        delete newState.ui.errors[action.payload.key];
        break;

      case ActionTypes.SET_NOTIFICATION:
        newState.ui.notifications.push({
          ...action.payload,
          id: Date.now(),
          createdAt: Date.now(),
        });
        // Keep only last 10 notifications
        if (newState.ui.notifications.length > 10) {
          newState.ui.notifications.shift();
        }
        break;

      case ActionTypes.SET_PREFERENCES:
        newState.preferences = { ...newState.preferences, ...action.payload };
        break;

      case ActionTypes.RESET_STATE:
        return deepClone(initialState);

      case ActionTypes.RESTORE_STATE:
        return deepMerge(initialState, action.payload);

      case ActionTypes.HYDRATE_STATE:
        return deepMerge(newState, action.payload);

      default:
        this._log('warn', `Unknown action type: ${action.type}`);
    }

    return newState;
  }

  /**
   * Publish state events to EventBus
   */
  _publishStateEvents(action) {
    const eventMap = {
      [ActionTypes.SET_USER]: EventTypes.STATE.USER_UPDATED,
      [ActionTypes.CLEAR_USER]: EventTypes.AUTH.LOGOUT,
      [ActionTypes.SET_COUNTRY]: EventTypes.STATE.COUNTRY_SELECTED,
      [ActionTypes.CLEAR_COUNTRY]: EventTypes.STATE.COUNTRY_CLEARED,
      [ActionTypes.SET_PREFERENCES]: EventTypes.STATE.PREFERENCES_CHANGED,
    };

    const eventType = eventMap[action.type];
    if (eventType) {
      eventBus.publish(eventType, {
        ...action.payload,
        _storeId: this._instanceId,
      }, { source: 'StateStore' });
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener, selector = null) {
    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }

    const subscription = {
      listener,
      selector,
      previousValue: selector ? this.select(selector) : null,
    };

    this._listeners.add(subscription);

    return () => {
      this._listeners.delete(subscription);
    };
  }

  /**
   * Notify all listeners
   */
  _notifyListeners(action = null, previousState = null) {
    this._listeners.forEach(subscription => {
      try {
        if (subscription.selector) {
          const newValue = this.select(subscription.selector);
          if (JSON.stringify(newValue) !== JSON.stringify(subscription.previousValue)) {
            subscription.listener(newValue, subscription.previousValue, action);
            subscription.previousValue = newValue;
          }
        } else {
          subscription.listener(this.getState(), previousState, action);
        }
      } catch (error) {
        this._log('error', 'Listener error', error);
      }
    });
  }

  /**
   * Save state to history for time-travel
   */
  _saveToHistory() {
    // Remove any forward history if we're not at the end
    if (this._historyIndex < this._history.length - 1) {
      this._history = this._history.slice(0, this._historyIndex + 1);
    }

    this._history.push({
      state: deepClone(this._state),
      timestamp: Date.now(),
    });

    // Limit history size
    if (this._history.length > this._maxHistorySize) {
      this._history.shift();
    }

    this._historyIndex = this._history.length - 1;
  }

  /**
   * Undo last state change
   */
  undo() {
    if (!this._enableTimeTravel || this._historyIndex <= 0) {
      return false;
    }

    this._historyIndex--;
    this._state = deepClone(this._history[this._historyIndex].state);
    this._persistState();
    this._notifyListeners();
    
    this._log('info', `Undo to index ${this._historyIndex}`);
    return true;
  }

  /**
   * Redo state change
   */
  redo() {
    if (!this._enableTimeTravel || this._historyIndex >= this._history.length - 1) {
      return false;
    }

    this._historyIndex++;
    this._state = deepClone(this._history[this._historyIndex].state);
    this._persistState();
    this._notifyListeners();
    
    this._log('info', `Redo to index ${this._historyIndex}`);
    return true;
  }

  /**
   * Get state history
   */
  getHistory() {
    return this._history.map((entry, index) => ({
      index,
      timestamp: entry.timestamp,
      isCurrent: index === this._historyIndex,
    }));
  }

  /**
   * Jump to specific history point
   */
  jumpToHistory(index) {
    if (!this._enableTimeTravel || index < 0 || index >= this._history.length) {
      return false;
    }

    this._historyIndex = index;
    this._state = deepClone(this._history[index].state);
    this._persistState();
    this._notifyListeners();
    
    return true;
  }

  /**
   * Create state snapshot
   */
  createSnapshot(name) {
    const snapshot = {
      name,
      state: deepClone(this._state),
      createdAt: Date.now(),
    };

    try {
      const snapshots = JSON.parse(this._storage.getItem(STORAGE_KEYS.SNAPSHOTS) || '[]');
      snapshots.push(snapshot);
      
      // Keep only last 10 snapshots
      if (snapshots.length > 10) {
        snapshots.shift();
      }
      
      this._storage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(snapshots));
      this._log('info', `Snapshot created: ${name}`);
      return true;
    } catch (error) {
      this._log('error', 'Failed to create snapshot', error);
      return false;
    }
  }

  /**
   * List all snapshots
   */
  listSnapshots() {
    try {
      return JSON.parse(this._storage.getItem(STORAGE_KEYS.SNAPSHOTS) || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Restore state from snapshot
   */
  restoreSnapshot(name) {
    const snapshots = this.listSnapshots();
    const snapshot = snapshots.find(s => s.name === name);
    
    if (!snapshot) {
      this._log('warn', `Snapshot not found: ${name}`);
      return false;
    }

    this.dispatch({
      type: ActionTypes.RESTORE_STATE,
      payload: snapshot.state,
    });

    this._log('info', `Snapshot restored: ${name}`);
    return true;
  }

  /**
   * Delete snapshot
   */
  deleteSnapshot(name) {
    try {
      const snapshots = this.listSnapshots();
      const filtered = snapshots.filter(s => s.name !== name);
      this._storage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(filtered));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reset store to initial state
   */
  reset() {
    this.dispatch({ type: ActionTypes.RESET_STATE });
    this._history = [];
    this._historyIndex = -1;
    this._selectorCache.clear();
    this._log('info', 'Store reset');
  }

  /**
   * Destroy store instance
   */
  destroy() {
    this._listeners.clear();
    this._middlewares = [];
    this._history = [];
    this._selectorCache.clear();
    this._log('info', 'Store destroyed');
  }
}

// Singleton instance
let storeInstance = null;

/**
 * Get singleton store instance
 */
export const getStore = (options = {}) => {
  if (!storeInstance) {
    storeInstance = new StateStore(options);
  }
  return storeInstance;
};

/**
 * Create a new store instance (for testing)
 */
export const createStore = (options = {}) => {
  return new StateStore(options);
};

// Export default singleton
export default getStore();
