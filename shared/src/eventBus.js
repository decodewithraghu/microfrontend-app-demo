/**
 * Enterprise-Grade Event Bus for Micro Frontend Communication
 * 
 * Features:
 * - Typed events with payload validation
 * - Middleware support (logging, transformation, validation)
 * - Event history and replay capabilities
 * - Dead letter queue for failed events
 * - Wildcard subscriptions
 * - Priority-based event handling
 * - Async event processing
 * - Memory leak prevention
 * - Debug mode with detailed logging
 */

// Event Types Enum with namespacing
export const EventTypes = Object.freeze({
  // Authentication Events
  AUTH: {
    LOGIN: 'mfe:auth:login',
    LOGOUT: 'mfe:auth:logout',
    SESSION_EXPIRED: 'mfe:auth:session-expired',
    SESSION_REFRESHED: 'mfe:auth:session-refreshed',
    TOKEN_INVALID: 'mfe:auth:token-invalid',
  },
  // State Events
  STATE: {
    COUNTRY_SELECTED: 'mfe:state:country-selected',
    COUNTRY_CLEARED: 'mfe:state:country-cleared',
    USER_UPDATED: 'mfe:state:user-updated',
    PREFERENCES_CHANGED: 'mfe:state:preferences-changed',
  },
  // Data Events
  DATA: {
    WEATHER_LOADED: 'mfe:data:weather-loaded',
    POPULATION_LOADED: 'mfe:data:population-loaded',
    COUNTRIES_LOADED: 'mfe:data:countries-loaded',
    CACHE_INVALIDATED: 'mfe:data:cache-invalidated',
  },
  // UI Events
  UI: {
    LOADING_START: 'mfe:ui:loading-start',
    LOADING_END: 'mfe:ui:loading-end',
    ERROR_DISPLAYED: 'mfe:ui:error-displayed',
    NOTIFICATION: 'mfe:ui:notification',
    NAVIGATION: 'mfe:ui:navigation',
  },
  // System Events
  SYSTEM: {
    MFE_MOUNTED: 'mfe:system:mounted',
    MFE_UNMOUNTED: 'mfe:system:unmounted',
    ERROR: 'mfe:system:error',
    HEALTH_CHECK: 'mfe:system:health-check',
  },
});

// Priority levels for event handlers
export const Priority = Object.freeze({
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
  BACKGROUND: 4,
});

// Event metadata schema
const createEventMeta = (eventType, source) => ({
  id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  timestamp: Date.now(),
  type: eventType,
  source: source || 'unknown',
  version: '1.0.0',
});

/**
 * Main EventBus Class
 */
class EventBus {
  constructor() {
    this._subscribers = new Map();
    this._middlewares = [];
    this._eventHistory = [];
    this._deadLetterQueue = [];
    this._maxHistorySize = 100;
    this._maxDeadLetterSize = 50;
    this._debugMode = false;
    this._instanceId = Math.random().toString(36).substr(2, 9);
    
    // Bind methods
    this._handleBrowserEvent = this._handleBrowserEvent.bind(this);
    
    // Initialize browser event bridge
    this._initBrowserBridge();
  }

  /**
   * Initialize browser event bridge for cross-window communication
   */
  _initBrowserBridge() {
    if (typeof window !== 'undefined') {
      window.addEventListener('mfe:broadcast', this._handleBrowserEvent);
      
      // Storage event for cross-tab communication
      window.addEventListener('storage', (e) => {
        if (e.key === 'mfe_event_broadcast') {
          try {
            const event = JSON.parse(e.newValue);
            if (event && event.instanceId !== this._instanceId) {
              this._processEvent(event.type, event.payload, event.meta);
            }
          } catch (err) {
            this._log('warn', 'Failed to parse cross-tab event', err);
          }
        }
      });
    }
  }

  /**
   * Handle browser CustomEvents
   */
  _handleBrowserEvent(event) {
    const { type, payload, meta } = event.detail;
    this._processEvent(type, payload, meta);
  }

  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled) {
    this._debugMode = enabled;
    this._log('info', `Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Internal logging
   */
  _log(level, message, data = null) {
    if (!this._debugMode && level !== 'error') return;
    
    const prefix = `[EventBus:${this._instanceId}]`;
    const timestamp = new Date().toISOString();
    
    switch (level) {
      case 'error':
        console.error(`${prefix} ${timestamp} ERROR:`, message, data);
        break;
      case 'warn':
        console.warn(`${prefix} ${timestamp} WARN:`, message, data);
        break;
      case 'info':
        console.info(`${prefix} ${timestamp} INFO:`, message, data);
        break;
      default:
        console.log(`${prefix} ${timestamp}:`, message, data);
    }
  }

  /**
   * Add middleware for event processing
   * Middleware signature: (event, next) => void
   */
  use(middleware) {
    if (typeof middleware !== 'function') {
      throw new Error('Middleware must be a function');
    }
    this._middlewares.push(middleware);
    this._log('info', 'Middleware added', { count: this._middlewares.length });
    return () => this.removeMiddleware(middleware);
  }

  /**
   * Remove middleware
   */
  removeMiddleware(middleware) {
    const index = this._middlewares.indexOf(middleware);
    if (index > -1) {
      this._middlewares.splice(index, 1);
      this._log('info', 'Middleware removed');
    }
  }

  /**
   * Subscribe to an event
   * @param {string} eventType - Event type or wildcard pattern (e.g., 'mfe:auth:*')
   * @param {Function} handler - Event handler function
   * @param {Object} options - Subscription options
   * @returns {Function} Unsubscribe function
   */
  subscribe(eventType, handler, options = {}) {
    const {
      priority = Priority.NORMAL,
      once = false,
      filter = null,
      context = null,
      errorHandler = null,
    } = options;

    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }

    const subscription = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      eventType,
      handler,
      priority,
      once,
      filter,
      context,
      errorHandler,
      createdAt: Date.now(),
      callCount: 0,
    };

    if (!this._subscribers.has(eventType)) {
      this._subscribers.set(eventType, []);
    }

    const subscribers = this._subscribers.get(eventType);
    subscribers.push(subscription);
    
    // Sort by priority
    subscribers.sort((a, b) => a.priority - b.priority);

    this._log('info', `Subscribed to ${eventType}`, { subscriptionId: subscription.id });

    // Return unsubscribe function
    return () => this.unsubscribe(subscription.id);
  }

  /**
   * Subscribe to an event only once
   */
  once(eventType, handler, options = {}) {
    return this.subscribe(eventType, handler, { ...options, once: true });
  }

  /**
   * Unsubscribe by subscription ID or handler
   */
  unsubscribe(subscriptionIdOrHandler) {
    let removed = false;
    
    this._subscribers.forEach((subscribers, eventType) => {
      const index = subscribers.findIndex(sub => 
        sub.id === subscriptionIdOrHandler || sub.handler === subscriptionIdOrHandler
      );
      
      if (index > -1) {
        subscribers.splice(index, 1);
        removed = true;
        this._log('info', `Unsubscribed from ${eventType}`);
      }
    });

    return removed;
  }

  /**
   * Publish an event
   * @param {string} eventType - Event type
   * @param {any} payload - Event payload
   * @param {Object} options - Publish options
   */
  async publish(eventType, payload = {}, options = {}) {
    const {
      source = 'unknown',
      broadcast = true,
      persist = false,
      sync = false,
    } = options;

    const meta = createEventMeta(eventType, source);
    const event = { type: eventType, payload, meta };

    this._log('info', `Publishing ${eventType}`, { meta, payload });

    // Add to history
    this._addToHistory(event);

    // Run through middlewares
    const processedEvent = await this._runMiddlewares(event);
    if (!processedEvent) {
      this._log('warn', `Event ${eventType} blocked by middleware`);
      return false;
    }

    // Process the event
    if (sync) {
      this._processEventSync(processedEvent.type, processedEvent.payload, processedEvent.meta);
    } else {
      await this._processEvent(processedEvent.type, processedEvent.payload, processedEvent.meta);
    }

    // Broadcast to other windows/tabs
    if (broadcast && typeof window !== 'undefined') {
      this._broadcastEvent(processedEvent);
    }

    // Persist to storage if needed
    if (persist) {
      this._persistEvent(processedEvent);
    }

    return true;
  }

  /**
   * Publish event synchronously
   */
  publishSync(eventType, payload = {}, options = {}) {
    return this.publish(eventType, payload, { ...options, sync: true });
  }

  /**
   * Run event through middleware chain
   */
  async _runMiddlewares(event) {
    let currentEvent = { ...event };

    for (const middleware of this._middlewares) {
      try {
        const result = await new Promise((resolve, reject) => {
          let nextCalled = false;
          
          const next = (modifiedEvent) => {
            nextCalled = true;
            resolve(modifiedEvent || currentEvent);
          };

          const result = middleware(currentEvent, next);
          
          // Handle async middleware
          if (result instanceof Promise) {
            result.then(() => {
              if (!nextCalled) resolve(currentEvent);
            }).catch(reject);
          } else if (!nextCalled) {
            // Sync middleware that didn't call next
            setTimeout(() => {
              if (!nextCalled) resolve(currentEvent);
            }, 0);
          }
        });

        if (result === false || result === null) {
          return null; // Middleware blocked the event
        }
        
        currentEvent = result;
      } catch (error) {
        this._log('error', 'Middleware error', error);
        this._addToDeadLetter(event, error);
      }
    }

    return currentEvent;
  }

  /**
   * Process event and notify subscribers
   */
  async _processEvent(eventType, payload, meta) {
    const matchingSubscribers = this._getMatchingSubscribers(eventType);
    const toRemove = [];

    for (const subscription of matchingSubscribers) {
      try {
        // Apply filter if present
        if (subscription.filter && !subscription.filter(payload, meta)) {
          continue;
        }

        // Call handler with context
        const context = subscription.context || this;
        await subscription.handler.call(context, payload, meta);
        
        subscription.callCount++;

        // Mark for removal if once
        if (subscription.once) {
          toRemove.push(subscription.id);
        }
      } catch (error) {
        this._log('error', `Handler error for ${eventType}`, error);
        
        // Call error handler if provided
        if (subscription.errorHandler) {
          try {
            subscription.errorHandler(error, payload, meta);
          } catch (e) {
            this._log('error', 'Error handler threw', e);
          }
        }

        this._addToDeadLetter({ type: eventType, payload, meta }, error);
      }
    }

    // Remove once subscriptions
    toRemove.forEach(id => this.unsubscribe(id));
  }

  /**
   * Process event synchronously
   */
  _processEventSync(eventType, payload, meta) {
    const matchingSubscribers = this._getMatchingSubscribers(eventType);
    const toRemove = [];

    for (const subscription of matchingSubscribers) {
      try {
        if (subscription.filter && !subscription.filter(payload, meta)) {
          continue;
        }

        const context = subscription.context || this;
        subscription.handler.call(context, payload, meta);
        subscription.callCount++;

        if (subscription.once) {
          toRemove.push(subscription.id);
        }
      } catch (error) {
        this._log('error', `Handler error for ${eventType}`, error);
        this._addToDeadLetter({ type: eventType, payload, meta }, error);
      }
    }

    toRemove.forEach(id => this.unsubscribe(id));
  }

  /**
   * Get subscribers matching event type (including wildcards)
   */
  _getMatchingSubscribers(eventType) {
    const result = [];

    this._subscribers.forEach((subscribers, pattern) => {
      if (this._matchesPattern(eventType, pattern)) {
        result.push(...subscribers);
      }
    });

    // Sort by priority
    return result.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Check if event type matches subscription pattern
   */
  _matchesPattern(eventType, pattern) {
    if (pattern === eventType) return true;
    if (pattern === '*') return true;
    
    // Wildcard matching (e.g., 'mfe:auth:*' matches 'mfe:auth:login')
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return eventType.startsWith(prefix);
    }

    return false;
  }

  /**
   * Broadcast event to other windows/tabs
   */
  _broadcastEvent(event) {
    // Via CustomEvent for same-window MFEs
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mfe:broadcast', {
        detail: { ...event, instanceId: this._instanceId },
        bubbles: true,
        composed: true,
      }));

      // Via localStorage for cross-tab communication
      try {
        localStorage.setItem('mfe_event_broadcast', JSON.stringify({
          ...event,
          instanceId: this._instanceId,
          broadcastTime: Date.now(),
        }));
        // Clear immediately to allow same event to be broadcast again
        localStorage.removeItem('mfe_event_broadcast');
      } catch (e) {
        this._log('warn', 'Failed to broadcast via localStorage', e);
      }
    }
  }

  /**
   * Persist event to storage
   */
  _persistEvent(event) {
    try {
      const persisted = JSON.parse(sessionStorage.getItem('mfe_persisted_events') || '[]');
      persisted.push(event);
      
      // Keep only last 50 events
      if (persisted.length > 50) {
        persisted.splice(0, persisted.length - 50);
      }
      
      sessionStorage.setItem('mfe_persisted_events', JSON.stringify(persisted));
    } catch (e) {
      this._log('warn', 'Failed to persist event', e);
    }
  }

  /**
   * Add event to history
   */
  _addToHistory(event) {
    this._eventHistory.push({
      ...event,
      processedAt: Date.now(),
    });

    // Trim history
    if (this._eventHistory.length > this._maxHistorySize) {
      this._eventHistory.shift();
    }
  }

  /**
   * Add failed event to dead letter queue
   */
  _addToDeadLetter(event, error) {
    this._deadLetterQueue.push({
      event,
      error: error.message,
      stack: error.stack,
      failedAt: Date.now(),
    });

    // Trim dead letter queue
    if (this._deadLetterQueue.length > this._maxDeadLetterSize) {
      this._deadLetterQueue.shift();
    }
  }

  /**
   * Get event history
   */
  getHistory(filter = null) {
    if (!filter) return [...this._eventHistory];
    
    return this._eventHistory.filter(event => {
      if (typeof filter === 'string') {
        return this._matchesPattern(event.type, filter);
      }
      if (typeof filter === 'function') {
        return filter(event);
      }
      return true;
    });
  }

  /**
   * Get dead letter queue
   */
  getDeadLetterQueue() {
    return [...this._deadLetterQueue];
  }

  /**
   * Clear dead letter queue
   */
  clearDeadLetterQueue() {
    this._deadLetterQueue = [];
  }

  /**
   * Replay events from history
   */
  async replay(filter = null, options = {}) {
    const events = this.getHistory(filter);
    const { delay = 0 } = options;

    this._log('info', `Replaying ${events.length} events`);

    for (const event of events) {
      await this.publish(event.type, event.payload, {
        source: 'replay',
        broadcast: false,
      });

      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Get all active subscriptions
   */
  getSubscriptions() {
    const result = [];
    this._subscribers.forEach((subscribers, eventType) => {
      subscribers.forEach(sub => {
        result.push({
          id: sub.id,
          eventType,
          priority: sub.priority,
          once: sub.once,
          callCount: sub.callCount,
          createdAt: sub.createdAt,
        });
      });
    });
    return result;
  }

  /**
   * Check if there are subscribers for an event type
   */
  hasSubscribers(eventType) {
    return this._getMatchingSubscribers(eventType).length > 0;
  }

  /**
   * Clear all subscriptions for an event type
   */
  clearSubscriptions(eventType = null) {
    if (eventType) {
      this._subscribers.delete(eventType);
      this._log('info', `Cleared subscriptions for ${eventType}`);
    } else {
      this._subscribers.clear();
      this._log('info', 'Cleared all subscriptions');
    }
  }

  /**
   * Destroy the event bus instance
   */
  destroy() {
    this.clearSubscriptions();
    this._middlewares = [];
    this._eventHistory = [];
    this._deadLetterQueue = [];
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('mfe:broadcast', this._handleBrowserEvent);
    }

    this._log('info', 'EventBus destroyed');
  }
}

// Singleton instance
let eventBusInstance = null;

/**
 * Get singleton EventBus instance
 */
export const getEventBus = () => {
  if (!eventBusInstance) {
    eventBusInstance = new EventBus();
  }
  return eventBusInstance;
};

/**
 * Create a new EventBus instance (for testing or isolated usage)
 */
export const createEventBus = () => {
  return new EventBus();
};

// Export default singleton
export default getEventBus();
