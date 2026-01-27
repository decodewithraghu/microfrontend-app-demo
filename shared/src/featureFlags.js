/**
 * Feature Flags Service
 * 
 * Features:
 * - Runtime feature toggling
 * - User/role-based flags
 * - A/B testing support
 * - Percentage rollouts
 * - Environment-based flags
 * - Local overrides for development
 * - Flag change subscriptions
 */

import { generateSecureId } from './crypto.js';
import logger from './logger.js';

// Default feature flags configuration
const DEFAULT_FLAGS = {
  // UI Features
  'ui.darkMode': { enabled: false, description: 'Enable dark mode theme' },
  'ui.newNavigation': { enabled: false, description: 'New navigation layout' },
  'ui.skeletonLoading': { enabled: true, description: 'Show skeleton screens while loading' },
  
  // MFE Features
  'mfe.dashboard': { enabled: false, description: 'Enable Dashboard MFE' },
  'mfe.settings': { enabled: false, description: 'Enable Settings MFE' },
  'mfe.prefetch': { enabled: false, description: 'Prefetch MFEs on hover' },
  
  // API Features
  'api.caching': { enabled: true, description: 'Enable API response caching' },
  'api.retry': { enabled: true, description: 'Enable automatic request retry' },
  'api.circuitBreaker': { enabled: true, description: 'Enable circuit breaker pattern' },
  
  // Security Features
  'security.csp': { enabled: true, description: 'Enable Content Security Policy' },
  'security.csrf': { enabled: true, description: 'Enable CSRF protection' },
  'security.webCrypto': { enabled: true, description: 'Use Web Crypto API for encryption' },
  
  // Analytics & Monitoring
  'analytics.enabled': { enabled: true, description: 'Enable analytics tracking' },
  'analytics.performanceMonitoring': { enabled: true, description: 'Enable performance monitoring' },
  'analytics.errorTracking': { enabled: true, description: 'Enable error tracking' },
  
  // Experimental
  'experimental.webSocket': { enabled: false, description: 'Enable WebSocket for real-time updates' },
  'experimental.serviceWorker': { enabled: false, description: 'Enable service worker for offline support' },
  'experimental.i18n': { enabled: false, description: 'Enable internationalization' },
};

/**
 * Feature Flag Entry
 */
class FeatureFlag {
  constructor(key, config = {}) {
    this.key = key;
    this.enabled = config.enabled ?? false;
    this.description = config.description || '';
    this.rolloutPercentage = config.rolloutPercentage ?? 100;
    this.allowedRoles = config.allowedRoles || [];
    this.allowedUsers = config.allowedUsers || [];
    this.environment = config.environment || null; // 'development', 'staging', 'production', null (all)
    this.startDate = config.startDate ? new Date(config.startDate) : null;
    this.endDate = config.endDate ? new Date(config.endDate) : null;
    this.metadata = config.metadata || {};
  }

  /**
   * Check if flag is active for given context
   */
  isActiveFor(context = {}) {
    const { userId, userRole, environment } = context;

    // Check if globally disabled
    if (!this.enabled) return false;

    // Check environment
    if (this.environment && environment && this.environment !== environment) {
      return false;
    }

    // Check date range
    const now = new Date();
    if (this.startDate && now < this.startDate) return false;
    if (this.endDate && now > this.endDate) return false;

    // Check allowed users
    if (this.allowedUsers.length > 0 && userId) {
      if (this.allowedUsers.includes(userId)) return true;
    }

    // Check allowed roles
    if (this.allowedRoles.length > 0 && userRole) {
      if (!this.allowedRoles.includes(userRole)) return false;
    }

    // Check rollout percentage
    if (this.rolloutPercentage < 100 && userId) {
      const hash = this._hashUserId(userId, this.key);
      if (hash > this.rolloutPercentage) return false;
    }

    return true;
  }

  /**
   * Generate consistent hash for user
   */
  _hashUserId(userId, flagKey) {
    const str = `${userId}:${flagKey}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) % 100;
  }

  toJSON() {
    return {
      key: this.key,
      enabled: this.enabled,
      description: this.description,
      rolloutPercentage: this.rolloutPercentage,
      allowedRoles: this.allowedRoles,
      environment: this.environment,
    };
  }
}

/**
 * Main Feature Flags Service
 */
class FeatureFlagsService {
  constructor() {
    this._flags = new Map();
    this._context = {};
    this._listeners = [];
    this._overrides = new Map();
    this._sessionId = generateSecureId(16);
    
    // Initialize with default flags
    this._initializeDefaultFlags();
    
    // Load overrides from localStorage
    this._loadOverrides();
  }

  /**
   * Initialize default flags
   */
  _initializeDefaultFlags() {
    Object.entries(DEFAULT_FLAGS).forEach(([key, config]) => {
      this._flags.set(key, new FeatureFlag(key, config));
    });
  }

  /**
   * Load local overrides (for development)
   */
  _loadOverrides() {
    if (typeof localStorage === 'undefined') return;
    
    try {
      const overrides = localStorage.getItem('mfe_feature_overrides');
      if (overrides) {
        const parsed = JSON.parse(overrides);
        Object.entries(parsed).forEach(([key, value]) => {
          this._overrides.set(key, value);
        });
        logger.debug('Feature flag overrides loaded', { count: this._overrides.size });
      }
    } catch (e) {
      logger.warn('Failed to load feature flag overrides', {}, e);
    }
  }

  /**
   * Save overrides to localStorage
   */
  _saveOverrides() {
    if (typeof localStorage === 'undefined') return;
    
    try {
      const overrides = Object.fromEntries(this._overrides);
      localStorage.setItem('mfe_feature_overrides', JSON.stringify(overrides));
    } catch (e) {
      logger.warn('Failed to save feature flag overrides', {}, e);
    }
  }

  /**
   * Set evaluation context
   */
  setContext(context) {
    this._context = { ...this._context, ...context };
    logger.debug('Feature flags context updated', { context: this._context });
  }

  /**
   * Check if a feature is enabled
   */
  isEnabled(flagKey, context = {}) {
    // Check local override first
    if (this._overrides.has(flagKey)) {
      return this._overrides.get(flagKey);
    }

    const flag = this._flags.get(flagKey);
    if (!flag) {
      logger.warn('Unknown feature flag', { flagKey });
      return false;
    }

    const mergedContext = { ...this._context, ...context };
    return flag.isActiveFor(mergedContext);
  }

  /**
   * Get flag value with default
   */
  getValue(flagKey, defaultValue = false) {
    return this.isEnabled(flagKey) ? true : defaultValue;
  }

  /**
   * Set a flag configuration
   */
  setFlag(key, config) {
    const flag = new FeatureFlag(key, config);
    this._flags.set(key, flag);
    this._notifyListeners(key, flag);
    logger.info('Feature flag updated', { key, enabled: flag.enabled });
  }

  /**
   * Update multiple flags
   */
  setFlags(flagsConfig) {
    Object.entries(flagsConfig).forEach(([key, config]) => {
      this.setFlag(key, config);
    });
  }

  /**
   * Set local override (for development/testing)
   */
  setOverride(flagKey, enabled) {
    this._overrides.set(flagKey, enabled);
    this._saveOverrides();
    this._notifyListeners(flagKey, this._flags.get(flagKey));
    logger.debug('Feature flag override set', { flagKey, enabled });
  }

  /**
   * Clear local override
   */
  clearOverride(flagKey) {
    this._overrides.delete(flagKey);
    this._saveOverrides();
    this._notifyListeners(flagKey, this._flags.get(flagKey));
  }

  /**
   * Clear all overrides
   */
  clearAllOverrides() {
    this._overrides.clear();
    this._saveOverrides();
    logger.debug('All feature flag overrides cleared');
  }

  /**
   * Get all flags
   */
  getAllFlags() {
    const result = {};
    this._flags.forEach((flag, key) => {
      result[key] = {
        ...flag.toJSON(),
        currentValue: this.isEnabled(key),
        hasOverride: this._overrides.has(key),
      };
    });
    return result;
  }

  /**
   * Get enabled flags only
   */
  getEnabledFlags() {
    const result = {};
    this._flags.forEach((flag, key) => {
      if (this.isEnabled(key)) {
        result[key] = flag.toJSON();
      }
    });
    return result;
  }

  /**
   * Subscribe to flag changes
   */
  subscribe(callback) {
    this._listeners.push(callback);
    return () => {
      const index = this._listeners.indexOf(callback);
      if (index > -1) this._listeners.splice(index, 1);
    };
  }

  /**
   * Notify listeners
   */
  _notifyListeners(key, flag) {
    const value = this.isEnabled(key);
    this._listeners.forEach(listener => {
      try {
        listener(key, value, flag);
      } catch (e) {
        logger.error('Feature flag listener error', { key }, e);
      }
    });
  }

  /**
   * Load flags from remote source
   */
  async loadFromRemote(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const flagsConfig = await response.json();
      this.setFlags(flagsConfig);
      logger.info('Feature flags loaded from remote', { url, count: Object.keys(flagsConfig).length });
    } catch (e) {
      logger.error('Failed to load feature flags from remote', { url }, e);
    }
  }

  /**
   * Export current state
   */
  exportState() {
    return {
      sessionId: this._sessionId,
      context: this._context,
      flags: this.getAllFlags(),
      overrides: Object.fromEntries(this._overrides),
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Create a feature gate component helper
   */
  createGate(flagKey) {
    return {
      isEnabled: () => this.isEnabled(flagKey),
      render: (enabledContent, disabledContent = null) => {
        return this.isEnabled(flagKey) ? enabledContent : disabledContent;
      },
    };
  }
}

// Singleton instance
const featureFlags = new FeatureFlagsService();

// Export factory function
export const createFeatureFlagsService = () => new FeatureFlagsService();

export { FeatureFlag, DEFAULT_FLAGS };
export default featureFlags;
