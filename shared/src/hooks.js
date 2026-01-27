/**
 * React Hooks for MFE State and Event Management
 * 
 * Custom hooks for seamless React integration:
 * - useEventBus: Subscribe to events
 * - useStateStore: Access and update state
 * - useAuth: Authentication state and actions
 * - useCountry: Country selection management
 * - useAPIGateway: API calls with caching
 * - useFeatureFlags: Feature flag management
 * - useAnalytics: Analytics tracking
 * - usePerformance: Performance monitoring
 * - useLogger: Structured logging
 * 
 * @version 3.0.0 - Added target architecture hooks
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

// ============================================
// Target Architecture Hooks (v3.0)
// ============================================

/**
 * Hook for API Gateway with caching and error handling
 * @returns {Object} API methods and state
 */
export const useAPIGateway = () => {
  // Lazy import to avoid circular dependencies
  const [gateway, setGateway] = useState(null);
  
  useEffect(() => {
    import('./apiGateway.js').then(module => {
      setGateway(module.default);
    });
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async (method, url, options = {}) => {
    if (!gateway) {
      throw new Error('API Gateway not initialized');
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await gateway.request(method, url, options);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  const getCountries = useCallback(async () => {
    if (!gateway) return [];
    setLoading(true);
    setError(null);
    try {
      return await gateway.getCountries();
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  const getWeather = useCallback(async (lat, lon) => {
    if (!gateway) return null;
    setLoading(true);
    setError(null);
    try {
      return await gateway.getWeather(lat, lon);
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  const getPopulation = useCallback(async (countryCode) => {
    if (!gateway) return null;
    setLoading(true);
    setError(null);
    try {
      return await gateway.getPopulation(countryCode);
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  return {
    loading,
    error,
    request,
    getCountries,
    getWeather,
    getPopulation,
    clearCache: useCallback(() => gateway?.clearCache(), [gateway]),
    isReady: !!gateway,
  };
};

/**
 * Hook for feature flags with reactive updates
 * @param {string} flagKey - Feature flag key to check
 * @returns {Object} Feature flag state and methods
 */
export const useFeatureFlags = (flagKey = null) => {
  const [flags, setFlags] = useState(null);
  const [flagsService, setFlagsService] = useState(null);
  
  useEffect(() => {
    import('./featureFlags.js').then(module => {
      const service = module.default;
      setFlagsService(service);
      setFlags(service.getFlags());
      
      // Subscribe to flag changes
      const unsubscribe = service.subscribe((updatedFlags) => {
        setFlags({ ...updatedFlags });
      });
      
      return unsubscribe;
    });
  }, []);

  const isEnabled = useCallback((key) => {
    return flagsService?.isEnabled(key) ?? false;
  }, [flagsService]);

  const getValue = useCallback((key, defaultValue) => {
    return flagsService?.getValue(key, defaultValue);
  }, [flagsService]);

  const setOverride = useCallback((key, value) => {
    flagsService?.setLocalOverride(key, value);
  }, [flagsService]);

  const clearOverride = useCallback((key) => {
    flagsService?.clearLocalOverride(key);
  }, [flagsService]);

  // If a specific flag key is provided, return simplified interface
  if (flagKey) {
    return {
      enabled: isEnabled(flagKey),
      value: getValue(flagKey),
      setOverride: (value) => setOverride(flagKey, value),
      clearOverride: () => clearOverride(flagKey),
    };
  }

  return {
    flags,
    isEnabled,
    getValue,
    setOverride,
    clearOverride,
    isReady: !!flagsService,
  };
};

/**
 * Hook for analytics tracking
 * @param {string} componentName - Name of the component for context
 * @returns {Object} Analytics methods
 */
export const useAnalytics = (componentName = 'Unknown') => {
  const [analyticsService, setAnalyticsService] = useState(null);

  useEffect(() => {
    import('./analytics.js').then(module => {
      setAnalyticsService(module.default);
    });
  }, []);

  const track = useCallback((eventType, properties = {}) => {
    analyticsService?.track(eventType, {
      ...properties,
      component: componentName,
    });
  }, [analyticsService, componentName]);

  const pageView = useCallback((path, title) => {
    analyticsService?.pageView(path, title);
  }, [analyticsService]);

  const identify = useCallback((userId, traits = {}) => {
    analyticsService?.identify(userId, traits);
  }, [analyticsService]);

  const time = useCallback((eventName) => {
    return analyticsService?.time(eventName) || (() => {});
  }, [analyticsService]);

  return {
    track,
    pageView,
    identify,
    time,
    isReady: !!analyticsService,
  };
};

/**
 * Hook for performance monitoring
 * @param {string} componentName - Name of the component for tracking
 * @returns {Object} Performance monitoring methods
 */
export const usePerformance = (componentName = 'Unknown') => {
  const [perfService, setPerfService] = useState(null);
  const mountTimeRef = useRef(null);

  useEffect(() => {
    import('./performanceMonitor.js').then(module => {
      setPerfService(module.default);
      mountTimeRef.current = performance.now();
    });

    return () => {
      // Track component unmount time
      if (perfService && mountTimeRef.current) {
        const mountDuration = performance.now() - mountTimeRef.current;
        perfService.addCustomMetric(`component.${componentName}.lifetime`, mountDuration);
      }
    };
  }, [componentName]);

  const trackMetric = useCallback((name, value) => {
    perfService?.addCustomMetric(name, value);
  }, [perfService]);

  const trackTiming = useCallback((name, duration) => {
    perfService?.addCustomMetric(name, duration);
  }, [perfService]);

  const getReport = useCallback(() => {
    return perfService?.getReport() || {};
  }, [perfService]);

  const measureAsync = useCallback(async (name, asyncFn) => {
    const start = performance.now();
    try {
      return await asyncFn();
    } finally {
      const duration = performance.now() - start;
      perfService?.addCustomMetric(name, duration);
    }
  }, [perfService]);

  return {
    trackMetric,
    trackTiming,
    getReport,
    measureAsync,
    isReady: !!perfService,
  };
};

/**
 * Hook for structured logging
 * @param {string} context - Logging context (component/module name)
 * @returns {Object} Logging methods
 */
export const useLogger = (context = 'Unknown') => {
  const [loggerService, setLoggerService] = useState(null);
  const childLogger = useRef(null);

  useEffect(() => {
    import('./logger.js').then(module => {
      setLoggerService(module.default);
      childLogger.current = module.default.child({ component: context });
    });
  }, [context]);

  const log = useCallback((level, message, data = {}) => {
    childLogger.current?.[level]?.(message, data);
  }, []);

  const debug = useCallback((message, data = {}) => {
    childLogger.current?.debug(message, data);
  }, []);

  const info = useCallback((message, data = {}) => {
    childLogger.current?.info(message, data);
  }, []);

  const warn = useCallback((message, data = {}) => {
    childLogger.current?.warn(message, data);
  }, []);

  const error = useCallback((message, data = {}) => {
    childLogger.current?.error(message, data);
  }, []);

  const time = useCallback((operationName) => {
    return childLogger.current?.time(operationName) || (() => {});
  }, []);

  return {
    log,
    debug,
    info,
    warn,
    error,
    time,
    isReady: !!loggerService,
  };
};

/**
 * Hook for security utilities
 * @returns {Object} Security methods
 */
export const useSecurity = () => {
  const [securityModule, setSecurityModule] = useState(null);

  useEffect(() => {
    import('./security.js').then(module => {
      setSecurityModule(module);
    });
  }, []);

  const sanitize = useCallback((input) => {
    return securityModule?.InputSanitizer?.sanitizeHTML(input) ?? input;
  }, [securityModule]);

  const getCSRFToken = useCallback(() => {
    return securityModule?.csrfProtection?.getToken();
  }, [securityModule]);

  const validateCSRF = useCallback((token) => {
    return securityModule?.csrfProtection?.validateToken(token) ?? false;
  }, [securityModule]);

  const runSecurityAudit = useCallback(() => {
    return securityModule?.SecurityAudit?.runFullAudit() ?? {};
  }, [securityModule]);

  return {
    sanitize,
    getCSRFToken,
    validateCSRF,
    runSecurityAudit,
    isReady: !!securityModule,
  };
};

/**
 * Hook for cryptographic operations
 * @returns {Object} Crypto methods
 */
export const useCrypto = () => {
  const [cryptoModule, setCryptoModule] = useState(null);

  useEffect(() => {
    import('./crypto.js').then(module => {
      setCryptoModule(module);
    });
  }, []);

  const encrypt = useCallback(async (data, key) => {
    if (!cryptoModule) throw new Error('Crypto not initialized');
    return await cryptoModule.encrypt(data, key);
  }, [cryptoModule]);

  const decrypt = useCallback(async (data, key) => {
    if (!cryptoModule) throw new Error('Crypto not initialized');
    return await cryptoModule.decrypt(data, key);
  }, [cryptoModule]);

  const hash = useCallback(async (data, algorithm = 'SHA-256') => {
    if (!cryptoModule) throw new Error('Crypto not initialized');
    return await cryptoModule.hash(data, algorithm);
  }, [cryptoModule]);

  const generateId = useCallback(async () => {
    if (!cryptoModule) throw new Error('Crypto not initialized');
    return await cryptoModule.generateSecureId();
  }, [cryptoModule]);

  return {
    encrypt,
    decrypt,
    hash,
    generateId,
    isAvailable: cryptoModule?.isCryptoAvailable?.() ?? false,
    isReady: !!cryptoModule,
  };
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
