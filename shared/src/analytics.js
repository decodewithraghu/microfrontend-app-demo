/**
 * Analytics SDK
 * 
 * Features:
 * - Event tracking
 * - Page view tracking
 * - User identification
 * - Session management
 * - Custom dimensions/properties
 * - Conversion tracking
 * - Performance metrics
 * - Error tracking
 * - Batched event sending
 */

import { generateSecureId } from './crypto.js';
import logger from './logger.js';
import performanceMonitor from './performanceMonitor.js';
import featureFlags from './featureFlags.js';

// Analytics Configuration
const ANALYTICS_CONFIG = {
  batchSize: 10,
  batchInterval: 10000, // 10 seconds
  maxQueueSize: 100,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  endpoint: null, // Remote analytics endpoint
  debug: false,
};

// Standard Event Types
export const AnalyticsEventTypes = Object.freeze({
  // Page Events
  PAGE_VIEW: 'page_view',
  PAGE_LEAVE: 'page_leave',
  
  // User Events
  USER_SIGNUP: 'user_signup',
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  
  // Interaction Events
  CLICK: 'click',
  FORM_SUBMIT: 'form_submit',
  SEARCH: 'search',
  
  // MFE Events
  MFE_LOAD: 'mfe_load',
  MFE_ERROR: 'mfe_error',
  MFE_NAVIGATION: 'mfe_navigation',
  
  // Feature Events
  FEATURE_USED: 'feature_used',
  FEATURE_FLAG_EVALUATED: 'feature_flag_evaluated',
  
  // Error Events
  ERROR: 'error',
  API_ERROR: 'api_error',
  
  // Performance Events
  PERFORMANCE: 'performance',
  WEB_VITALS: 'web_vitals',
  
  // Business Events
  COUNTRY_SELECTED: 'country_selected',
  DATA_VIEWED: 'data_viewed',
});

/**
 * Analytics Event
 */
class AnalyticsEvent {
  constructor(type, properties = {}, options = {}) {
    this.id = generateSecureId(12);
    this.type = type;
    this.timestamp = Date.now();
    this.properties = properties;
    this.sessionId = Analytics._sessionId;
    this.userId = Analytics._userId;
    this.anonymousId = Analytics._anonymousId;
    this.context = {
      page: typeof window !== 'undefined' ? {
        url: window.location.href,
        path: window.location.pathname,
        title: document.title,
        referrer: document.referrer,
      } : null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      screenSize: typeof window !== 'undefined' ? {
        width: window.screen.width,
        height: window.screen.height,
      } : null,
      viewport: typeof window !== 'undefined' ? {
        width: window.innerWidth,
        height: window.innerHeight,
      } : null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: typeof navigator !== 'undefined' ? navigator.language : null,
    };
    this.options = options;
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      timestamp: this.timestamp,
      properties: this.properties,
      sessionId: this.sessionId,
      userId: this.userId,
      anonymousId: this.anonymousId,
      context: this.context,
    };
  }
}

/**
 * Main Analytics Class
 */
class Analytics {
  static _sessionId = null;
  static _userId = null;
  static _anonymousId = null;
  
  constructor(config = {}) {
    this._config = { ...ANALYTICS_CONFIG, ...config };
    this._queue = [];
    this._traits = {};
    this._globalProperties = {};
    this._listeners = [];
    this._flushTimer = null;
    this._lastActivity = Date.now();
    
    // Initialize session
    this._initSession();
    
    // Start batch flush
    this._startBatchFlush();
    
    // Track page visibility
    this._trackPageVisibility();
    
    // Integrate with performance monitor
    this._integratePerformanceMonitor();
  }

  /**
   * Initialize or restore session
   */
  _initSession() {
    // Get or create anonymous ID
    if (typeof localStorage !== 'undefined') {
      Analytics._anonymousId = localStorage.getItem('mfe_analytics_anon_id');
      if (!Analytics._anonymousId) {
        Analytics._anonymousId = generateSecureId(24);
        localStorage.setItem('mfe_analytics_anon_id', Analytics._anonymousId);
      }
    } else {
      Analytics._anonymousId = generateSecureId(24);
    }

    // Get or create session
    this._restoreSession();
  }

  /**
   * Restore or create session
   */
  _restoreSession() {
    if (typeof sessionStorage !== 'undefined') {
      const sessionData = sessionStorage.getItem('mfe_analytics_session');
      if (sessionData) {
        try {
          const { sessionId, lastActivity } = JSON.parse(sessionData);
          const timeSinceActivity = Date.now() - lastActivity;
          
          if (timeSinceActivity < this._config.sessionTimeout) {
            Analytics._sessionId = sessionId;
            this._lastActivity = lastActivity;
            return;
          }
        } catch (e) {
          // Invalid session data
        }
      }
    }
    
    // Create new session
    Analytics._sessionId = generateSecureId(24);
    this._saveSession();
    this.track(AnalyticsEventTypes.PAGE_VIEW, { sessionStart: true });
  }

  /**
   * Save session state
   */
  _saveSession() {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('mfe_analytics_session', JSON.stringify({
        sessionId: Analytics._sessionId,
        lastActivity: this._lastActivity,
      }));
    }
  }

  /**
   * Update activity timestamp
   */
  _updateActivity() {
    this._lastActivity = Date.now();
    this._saveSession();
  }

  /**
   * Start batch flush timer
   */
  _startBatchFlush() {
    this._flushTimer = setInterval(() => {
      if (this._queue.length > 0) {
        this._flush();
      }
    }, this._config.batchInterval);
  }

  /**
   * Track page visibility
   */
  _trackPageVisibility() {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.track(AnalyticsEventTypes.PAGE_LEAVE);
        this._flush(); // Flush on page leave
      } else {
        this._updateActivity();
        this.track(AnalyticsEventTypes.PAGE_VIEW);
      }
    });

    // Track before unload
    window.addEventListener('beforeunload', () => {
      this.track(AnalyticsEventTypes.PAGE_LEAVE);
      this._flush();
    });
  }

  /**
   * Integrate with performance monitor
   */
  _integratePerformanceMonitor() {
    performanceMonitor.addListener((entry) => {
      // Track web vitals
      if (['LCP', 'FID', 'CLS', 'FCP', 'TTFB'].includes(entry.name)) {
        this.track(AnalyticsEventTypes.WEB_VITALS, {
          metric: entry.name,
          value: entry.value,
          rating: entry.rating,
        });
      }
      
      // Track MFE loads
      if (entry.name === 'mfe-load-complete') {
        this.track(AnalyticsEventTypes.MFE_LOAD, {
          mfeName: entry.tags.mfeName,
          duration: entry.value,
          success: entry.tags.success,
        });
      }
    });
  }

  /**
   * Identify user
   */
  identify(userId, traits = {}) {
    Analytics._userId = userId;
    this._traits = { ...this._traits, ...traits };
    
    this._enqueue({
      type: 'identify',
      userId,
      traits: this._traits,
      timestamp: Date.now(),
    });
    
    logger.info('User identified', { userId });
    this._updateActivity();
  }

  /**
   * Clear user identity
   */
  reset() {
    Analytics._userId = null;
    this._traits = {};
    Analytics._sessionId = generateSecureId(24);
    this._saveSession();
    
    logger.info('Analytics reset');
  }

  /**
   * Set global properties for all events
   */
  setGlobalProperties(properties) {
    this._globalProperties = { ...this._globalProperties, ...properties };
  }

  /**
   * Track an event
   */
  track(eventType, properties = {}, options = {}) {
    // Check if analytics is enabled
    if (!featureFlags.isEnabled('analytics.enabled')) {
      return;
    }

    const mergedProperties = {
      ...this._globalProperties,
      ...properties,
    };

    const event = new AnalyticsEvent(eventType, mergedProperties, options);
    this._enqueue(event.toJSON());
    
    // Notify listeners
    this._notifyListeners(event);
    
    this._updateActivity();

    if (this._config.debug) {
      logger.debug('Analytics event tracked', { type: eventType, properties: mergedProperties });
    }

    return event;
  }

  /**
   * Track page view
   */
  page(name, properties = {}) {
    return this.track(AnalyticsEventTypes.PAGE_VIEW, {
      pageName: name,
      ...properties,
    });
  }

  /**
   * Track feature usage
   */
  trackFeature(featureName, properties = {}) {
    return this.track(AnalyticsEventTypes.FEATURE_USED, {
      featureName,
      ...properties,
    });
  }

  /**
   * Track error
   */
  trackError(error, properties = {}) {
    return this.track(AnalyticsEventTypes.ERROR, {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      ...properties,
    });
  }

  /**
   * Track timing
   */
  trackTiming(category, name, duration, properties = {}) {
    return this.track(AnalyticsEventTypes.PERFORMANCE, {
      category,
      name,
      duration,
      ...properties,
    });
  }

  /**
   * Add event listener
   */
  addListener(listener) {
    this._listeners.push(listener);
    return () => {
      const index = this._listeners.indexOf(listener);
      if (index > -1) this._listeners.splice(index, 1);
    };
  }

  /**
   * Notify listeners
   */
  _notifyListeners(event) {
    this._listeners.forEach(listener => {
      try {
        listener(event);
      } catch (e) {
        logger.error('Analytics listener error', {}, e);
      }
    });
  }

  /**
   * Enqueue event for sending
   */
  _enqueue(event) {
    this._queue.push(event);
    
    // Flush if queue is full
    if (this._queue.length >= this._config.batchSize) {
      this._flush();
    }
    
    // Trim queue if too large
    if (this._queue.length > this._config.maxQueueSize) {
      this._queue = this._queue.slice(-this._config.maxQueueSize);
    }
  }

  /**
   * Flush events to server
   */
  async _flush() {
    if (this._queue.length === 0) return;
    if (!this._config.endpoint) {
      // No endpoint configured, just clear queue in development
      if (this._config.debug) {
        logger.debug('Analytics events (no endpoint)', { events: this._queue });
      }
      this._queue = [];
      return;
    }

    const eventsToSend = [...this._queue];
    this._queue = [];

    try {
      const response = await fetch(this._config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batch: eventsToSend,
          sentAt: Date.now(),
        }),
        keepalive: true, // Allow sending during page unload
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      // Re-add events to queue on failure
      this._queue.unshift(...eventsToSend);
      logger.warn('Failed to send analytics', { error: error.message });
    }
  }

  /**
   * Get queued events
   */
  getQueue() {
    return [...this._queue];
  }

  /**
   * Get session info
   */
  getSessionInfo() {
    return {
      sessionId: Analytics._sessionId,
      userId: Analytics._userId,
      anonymousId: Analytics._anonymousId,
      traits: { ...this._traits },
      lastActivity: this._lastActivity,
    };
  }

  /**
   * Configure analytics
   */
  configure(config) {
    this._config = { ...this._config, ...config };
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
    }
    this._flush();
    this._listeners = [];
  }
}

// Singleton instance
const analytics = new Analytics();

// Export factory function
export const createAnalytics = (config) => new Analytics(config);

export { AnalyticsEvent };
export default analytics;
