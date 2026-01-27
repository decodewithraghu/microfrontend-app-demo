/**
 * React Hooks for MFE State and Event Management
 * 
 * Custom hooks for seamless React integration:
 * - useEventBus: Subscribe to events
 * - useStateStore: Access and update state
 * - useAuth: Authentication state and actions
 * - useCountry: Country selection management
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import eventBus, { EventTypes, Priority } from './eventBus.js';
import store, { ActionTypes } from './stateStore.js';
import authService from './authService.js';

/**
 * Hook to subscribe to EventBus events
 * @param {string|string[]} eventTypes - Event type(s) to subscribe to
 * @param {Function} handler - Event handler function
 * @param {Object} options - Subscription options
 */
export const useEventBus = (eventTypes, handler, options = {}) => {
  const { priority = Priority.NORMAL, enabled = true } = options;
  const handlerRef = useRef(handler);
  
  // Update handler ref on change
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;

    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
    const unsubscribers = [];

    types.forEach(eventType => {
      const unsubscribe = eventBus.subscribe(
        eventType,
        (payload, meta) => handlerRef.current(payload, meta),
        { priority }
      );
      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [eventTypes, enabled, priority]);
};

/**
 * Hook to publish events
 * @returns {Function} Publish function
 */
export const useEventPublisher = () => {
  return useCallback((eventType, payload, options = {}) => {
    return eventBus.publish(eventType, payload, options);
  }, []);
};

/**
 * Hook to access and update state store
 * @param {string} selector - State path selector (e.g., 'auth.user')
 * @returns {[any, Function]} Current value and dispatch function
 */
export const useStateStore = (selector = null) => {
  const [state, setState] = useState(() => 
    selector ? store.select(selector) : store.getState()
  );

  useEffect(() => {
    const unsubscribe = store.subscribe((newValue) => {
      setState(newValue);
    }, selector);

    return unsubscribe;
  }, [selector]);

  const dispatch = useCallback((action) => {
    store.dispatch(action);
  }, []);

  return [state, dispatch];
};

/**
 * Hook for authentication management
 * @returns {Object} Auth state and methods
 */
export const useAuth = () => {
  const [user, setUser] = useState(() => authService.getUser());
  const [isAuthenticated, setIsAuthenticated] = useState(() => authService.isAuthenticated());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Subscribe to auth events
  useEffect(() => {
    const unsubLogin = eventBus.subscribe(EventTypes.AUTH.LOGIN, (payload) => {
      setUser(payload.user);
      setIsAuthenticated(true);
      setError(null);
    });

    const unsubLogout = eventBus.subscribe(EventTypes.AUTH.LOGOUT, () => {
      setUser(null);
      setIsAuthenticated(false);
    });

    const unsubExpired = eventBus.subscribe(EventTypes.AUTH.SESSION_EXPIRED, () => {
      setUser(null);
      setIsAuthenticated(false);
      setError('Session expired. Please login again.');
    });

    return () => {
      unsubLogin();
      unsubLogout();
      unsubExpired();
    };
  }, []);

  const login = useCallback(async (username, password) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await authService.login(username, password);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    authService.logout();
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      return await authService.refreshSession();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const hasRole = useCallback((role) => {
    return authService.hasRole(role);
  }, []);

  const hasPermission = useCallback((permission) => {
    return authService.hasPermission(permission);
  }, []);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    refreshSession,
    hasRole,
    hasPermission,
    getToken: authService.getAuthToken,
  };
};

/**
 * Hook for country selection management
 * @returns {Object} Country state and methods
 */
export const useCountry = () => {
  const [selectedCountry, setSelectedCountry] = useState(() => 
    authService.getSelectedCountry()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Subscribe to country events
  useEffect(() => {
    const unsubSelected = eventBus.subscribe(
      EventTypes.STATE.COUNTRY_SELECTED,
      (payload) => {
        setSelectedCountry(payload.country);
        setError(null);
      }
    );

    const unsubCleared = eventBus.subscribe(
      EventTypes.STATE.COUNTRY_CLEARED,
      () => {
        setSelectedCountry(null);
      }
    );

    return () => {
      unsubSelected();
      unsubCleared();
    };
  }, []);

  const selectCountry = useCallback((country) => {
    setIsLoading(true);
    setError(null);
    
    try {
      authService.setSelectedCountry(country);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearCountry = useCallback(() => {
    authService.clearSelectedCountry();
  }, []);

  return {
    selectedCountry,
    isLoading,
    error,
    selectCountry,
    clearCountry,
    hasCountry: !!selectedCountry,
  };
};

/**
 * Hook for loading state management
 * @param {string} key - Loading state key
 * @returns {Object} Loading state and methods
 */
export const useLoading = (key) => {
  const [isLoading, setIsLoading] = useStateStore(`ui.loading.${key}`);

  const startLoading = useCallback(() => {
    store.dispatch({
      type: ActionTypes.SET_LOADING,
      payload: { key, value: true },
    });
  }, [key]);

  const stopLoading = useCallback(() => {
    store.dispatch({
      type: ActionTypes.SET_LOADING,
      payload: { key, value: false },
    });
  }, [key]);

  const withLoading = useCallback(async (asyncFn) => {
    startLoading();
    try {
      return await asyncFn();
    } finally {
      stopLoading();
    }
  }, [startLoading, stopLoading]);

  return {
    isLoading: !!isLoading,
    startLoading,
    stopLoading,
    withLoading,
  };
};

/**
 * Hook for error state management
 * @param {string} key - Error state key
 * @returns {Object} Error state and methods
 */
export const useError = (key) => {
  const [error] = useStateStore(`ui.errors.${key}`);

  const setError = useCallback((errorMessage) => {
    store.dispatch({
      type: ActionTypes.SET_ERROR,
      payload: { key, error: errorMessage },
    });
  }, [key]);

  const clearError = useCallback(() => {
    store.dispatch({
      type: ActionTypes.CLEAR_ERROR,
      payload: { key },
    });
  }, [key]);

  return {
    error,
    hasError: !!error,
    setError,
    clearError,
  };
};

/**
 * Hook for notifications
 * @returns {Object} Notification methods
 */
export const useNotifications = () => {
  const [notifications] = useStateStore('ui.notifications');

  const showNotification = useCallback((message, type = 'info', duration = 5000) => {
    store.dispatch({
      type: ActionTypes.SET_NOTIFICATION,
      payload: { message, type, duration },
    });
    
    eventBus.publish(EventTypes.UI.NOTIFICATION, {
      message,
      type,
      duration,
    });
  }, []);

  const showSuccess = useCallback((message, duration) => {
    showNotification(message, 'success', duration);
  }, [showNotification]);

  const showError = useCallback((message, duration) => {
    showNotification(message, 'error', duration);
  }, [showNotification]);

  const showWarning = useCallback((message, duration) => {
    showNotification(message, 'warning', duration);
  }, [showNotification]);

  const showInfo = useCallback((message, duration) => {
    showNotification(message, 'info', duration);
  }, [showNotification]);

  return {
    notifications,
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
};

/**
 * Hook for user preferences
 * @returns {Object} Preferences state and methods
 */
export const usePreferences = () => {
  const [preferences] = useStateStore('preferences');

  const updatePreferences = useCallback((newPreferences) => {
    store.dispatch({
      type: ActionTypes.SET_PREFERENCES,
      payload: newPreferences,
    });
  }, []);

  const setTheme = useCallback((theme) => {
    updatePreferences({ theme });
  }, [updatePreferences]);

  const setLanguage = useCallback((language) => {
    updatePreferences({ language });
  }, [updatePreferences]);

  return {
    preferences,
    updatePreferences,
    setTheme,
    setLanguage,
    theme: preferences?.theme || 'light',
    language: preferences?.language || 'en',
  };
};

/**
 * Hook for event history (debugging)
 * @param {string} filter - Event type filter pattern
 * @returns {Array} Event history
 */
export const useEventHistory = (filter = null) => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    // Get initial history
    setHistory(eventBus.getHistory(filter));

    // Subscribe to all events to update history
    const unsubscribe = eventBus.subscribe('*', () => {
      setHistory(eventBus.getHistory(filter));
    });

    return unsubscribe;
  }, [filter]);

  const clearHistory = useCallback(() => {
    // Note: This would need EventBus support for clearing history
    setHistory([]);
  }, []);

  return { history, clearHistory };
};

/**
 * Hook for MFE lifecycle management
 * @param {string} mfeName - Name of the MFE
 */
export const useMFELifecycle = (mfeName) => {
  const publish = useEventPublisher();

  useEffect(() => {
    // Publish mount event
    publish(EventTypes.SYSTEM.MFE_MOUNTED, {
      name: mfeName,
      timestamp: Date.now(),
    });

    return () => {
      // Publish unmount event
      publish(EventTypes.SYSTEM.MFE_UNMOUNTED, {
        name: mfeName,
        timestamp: Date.now(),
      });
    };
  }, [mfeName, publish]);
};

/**
 * Hook for navigation events
 * @returns {Object} Navigation helpers
 */
export const useNavigation = () => {
  const publish = useEventPublisher();

  const navigate = useCallback((path, options = {}) => {
    publish(EventTypes.UI.NAVIGATION, {
      path,
      ...options,
    });
  }, [publish]);

  useEventBus(EventTypes.UI.NAVIGATION, (payload) => {
    if (typeof window !== 'undefined' && payload.path) {
      // Allow shell to handle navigation
      window.history.pushState(null, '', payload.path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  });

  return { navigate };
};

export default {
  useEventBus,
  useEventPublisher,
  useStateStore,
  useAuth,
  useCountry,
  useLoading,
  useError,
  useNotifications,
  usePreferences,
  useEventHistory,
  useMFELifecycle,
  useNavigation,
};
