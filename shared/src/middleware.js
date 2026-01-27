/**
 * MFE Communication Middleware Collection
 * 
 * Pre-built middlewares for common use cases:
 * - Logging middleware
 * - Validation middleware
 * - Error handling middleware
 * - Rate limiting middleware
 * - Transformation middleware
 * - Analytics middleware
 */

import { EventTypes, Priority } from './eventBus.js';

/**
 * Logging Middleware
 * Logs all events with configurable detail level
 */
export const createLoggingMiddleware = (options = {}) => {
  const {
    level = 'info',
    includePayload = true,
    includeTimestamp = true,
    filter = null,
    logger = console,
  } = options;

  return (event, next) => {
    // Apply filter
    if (filter && !filter(event)) {
      return next(event);
    }

    const timestamp = includeTimestamp ? new Date().toISOString() : '';
    const prefix = `[EventBus${timestamp ? ` ${timestamp}` : ''}]`;
    
    const logData = {
      type: event.type,
      meta: event.meta,
    };

    if (includePayload) {
      logData.payload = event.payload;
    }

    logger[level](`${prefix} Event:`, logData);
    
    return next(event);
  };
};

/**
 * Validation Middleware
 * Validates event payloads against schemas
 */
export const createValidationMiddleware = (schemas = {}) => {
  return (event, next) => {
    const schema = schemas[event.type];
    
    if (!schema) {
      return next(event);
    }

    const errors = validatePayload(event.payload, schema);
    
    if (errors.length > 0) {
      console.error(`[EventBus] Validation failed for ${event.type}:`, errors);
      return next(false); // Block event
    }

    return next(event);
  };
};

/**
 * Simple payload validator
 */
const validatePayload = (payload, schema) => {
  const errors = [];

  if (schema.required) {
    for (const field of schema.required) {
      if (payload[field] === undefined || payload[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  if (schema.properties) {
    for (const [field, rules] of Object.entries(schema.properties)) {
      const value = payload[field];
      
      if (value !== undefined) {
        if (rules.type && typeof value !== rules.type) {
          errors.push(`Field ${field} must be of type ${rules.type}`);
        }
        
        if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
          errors.push(`Field ${field} must have at least ${rules.minLength} characters`);
        }
        
        if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
          errors.push(`Field ${field} must have at most ${rules.maxLength} characters`);
        }
        
        if (rules.pattern && typeof value === 'string' && !new RegExp(rules.pattern).test(value)) {
          errors.push(`Field ${field} does not match required pattern`);
        }
        
        if (rules.enum && !rules.enum.includes(value)) {
          errors.push(`Field ${field} must be one of: ${rules.enum.join(', ')}`);
        }
      }
    }
  }

  return errors;
};

/**
 * Error Handling Middleware
 * Catches and handles errors in event processing
 */
export const createErrorHandlerMiddleware = (options = {}) => {
  const {
    onError = (error, event) => console.error('[EventBus] Error:', error, event),
    rethrow = false,
    transformError = null,
  } = options;

  return async (event, next) => {
    try {
      return await next(event);
    } catch (error) {
      const processedError = transformError ? transformError(error) : error;
      onError(processedError, event);
      
      if (rethrow) {
        throw processedError;
      }
      
      return next(false); // Block event on error
    }
  };
};

/**
 * Rate Limiting Middleware
 * Prevents event flooding
 */
export const createRateLimitMiddleware = (options = {}) => {
  const {
    maxEvents = 100,
    windowMs = 1000,
    keyExtractor = (event) => event.type,
    onLimit = (event) => console.warn(`[EventBus] Rate limit exceeded for ${event.type}`),
  } = options;

  const windows = new Map();

  return (event, next) => {
    const key = keyExtractor(event);
    const now = Date.now();
    
    if (!windows.has(key)) {
      windows.set(key, { count: 0, startTime: now });
    }
    
    const window = windows.get(key);
    
    // Reset window if expired
    if (now - window.startTime > windowMs) {
      window.count = 0;
      window.startTime = now;
    }
    
    window.count++;
    
    if (window.count > maxEvents) {
      onLimit(event);
      return next(false); // Block event
    }
    
    return next(event);
  };
};

/**
 * Throttle Middleware
 * Ensures minimum time between events of same type
 */
export const createThrottleMiddleware = (options = {}) => {
  const {
    intervalMs = 100,
    keyExtractor = (event) => event.type,
  } = options;

  const lastEventTimes = new Map();

  return (event, next) => {
    const key = keyExtractor(event);
    const now = Date.now();
    const lastTime = lastEventTimes.get(key) || 0;
    
    if (now - lastTime < intervalMs) {
      return next(false); // Skip event
    }
    
    lastEventTimes.set(key, now);
    return next(event);
  };
};

/**
 * Debounce Middleware
 * Delays event processing and cancels if new event arrives
 */
export const createDebounceMiddleware = (options = {}) => {
  const {
    delayMs = 300,
    keyExtractor = (event) => event.type,
  } = options;

  const pendingEvents = new Map();

  return (event, next) => {
    const key = keyExtractor(event);
    
    // Cancel pending event
    if (pendingEvents.has(key)) {
      clearTimeout(pendingEvents.get(key).timer);
    }
    
    // Schedule new event
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pendingEvents.delete(key);
        resolve(next(event));
      }, delayMs);
      
      pendingEvents.set(key, { timer, event });
    });
  };
};

/**
 * Transformation Middleware
 * Transforms event payloads
 */
export const createTransformMiddleware = (transformers = {}) => {
  return (event, next) => {
    const transformer = transformers[event.type];
    
    if (!transformer) {
      return next(event);
    }

    const transformedPayload = transformer(event.payload, event.meta);
    
    return next({
      ...event,
      payload: transformedPayload,
    });
  };
};

/**
 * Filter Middleware
 * Filters out unwanted events
 */
export const createFilterMiddleware = (predicate) => {
  return (event, next) => {
    if (!predicate(event)) {
      return next(false); // Block event
    }
    return next(event);
  };
};

/**
 * Analytics Middleware
 * Tracks event metrics
 */
export const createAnalyticsMiddleware = (options = {}) => {
  const {
    onEvent = null,
    sampleRate = 1.0,
    exclude = [],
  } = options;

  const metrics = {
    totalEvents: 0,
    eventCounts: {},
    lastEvent: null,
    startTime: Date.now(),
  };

  const middleware = (event, next) => {
    // Check exclusion
    if (exclude.some(pattern => event.type.startsWith(pattern))) {
      return next(event);
    }

    // Sample rate check
    if (Math.random() > sampleRate) {
      return next(event);
    }

    // Track metrics
    metrics.totalEvents++;
    metrics.eventCounts[event.type] = (metrics.eventCounts[event.type] || 0) + 1;
    metrics.lastEvent = {
      type: event.type,
      timestamp: Date.now(),
    };

    // Call analytics handler
    if (onEvent) {
      try {
        onEvent(event, metrics);
      } catch (error) {
        console.error('[Analytics] Error:', error);
      }
    }

    return next(event);
  };

  // Attach metrics getter
  middleware.getMetrics = () => ({
    ...metrics,
    eventsPerSecond: metrics.totalEvents / ((Date.now() - metrics.startTime) / 1000),
  });

  middleware.resetMetrics = () => {
    metrics.totalEvents = 0;
    metrics.eventCounts = {};
    metrics.lastEvent = null;
    metrics.startTime = Date.now();
  };

  return middleware;
};

/**
 * Persistence Middleware
 * Persists specific events to storage
 */
export const createPersistenceMiddleware = (options = {}) => {
  const {
    storageKey = 'mfe_persisted_events',
    eventTypes = [],
    maxEvents = 100,
    storage = sessionStorage,
  } = options;

  return (event, next) => {
    // Check if event should be persisted
    if (eventTypes.length > 0 && !eventTypes.includes(event.type)) {
      return next(event);
    }

    try {
      const stored = JSON.parse(storage.getItem(storageKey) || '[]');
      stored.push({
        ...event,
        persistedAt: Date.now(),
      });

      // Limit stored events
      while (stored.length > maxEvents) {
        stored.shift();
      }

      storage.setItem(storageKey, JSON.stringify(stored));
    } catch (error) {
      console.error('[Persistence] Failed to persist event:', error);
    }

    return next(event);
  };
};

/**
 * Retry Middleware
 * Retries failed event processing
 */
export const createRetryMiddleware = (options = {}) => {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    shouldRetry = () => true,
    onRetry = null,
  } = options;

  return async (event, next) => {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await next(event);
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries && shouldRetry(error, event, attempt)) {
          if (onRetry) {
            onRetry(error, event, attempt);
          }
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
      }
    }
    
    throw lastError;
  };
};

/**
 * Circuit Breaker Middleware
 * Prevents cascading failures
 */
export const createCircuitBreakerMiddleware = (options = {}) => {
  const {
    failureThreshold = 5,
    recoveryTime = 30000,
    onOpen = () => console.warn('[CircuitBreaker] Circuit opened'),
    onClose = () => console.info('[CircuitBreaker] Circuit closed'),
  } = options;

  const state = {
    failures: 0,
    lastFailure: null,
    isOpen: false,
  };

  return async (event, next) => {
    // Check if circuit is open
    if (state.isOpen) {
      const timeSinceFailure = Date.now() - state.lastFailure;
      
      if (timeSinceFailure < recoveryTime) {
        return next(false); // Block event
      }
      
      // Try to recover
      state.isOpen = false;
      state.failures = 0;
      onClose();
    }

    try {
      const result = await next(event);
      state.failures = 0;
      return result;
    } catch (error) {
      state.failures++;
      state.lastFailure = Date.now();
      
      if (state.failures >= failureThreshold) {
        state.isOpen = true;
        onOpen();
      }
      
      throw error;
    }
  };
};

/**
 * Correlation Middleware
 * Adds correlation IDs for request tracing
 */
export const createCorrelationMiddleware = (options = {}) => {
  const {
    headerName = 'x-correlation-id',
    generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  } = options;

  return (event, next) => {
    const correlationId = event.meta?.correlationId || generateId();
    
    return next({
      ...event,
      meta: {
        ...event.meta,
        correlationId,
      },
    });
  };
};

/**
 * Batch Middleware
 * Batches multiple events together
 */
export const createBatchMiddleware = (options = {}) => {
  const {
    maxBatchSize = 10,
    maxWaitMs = 100,
    eventTypes = [],
  } = options;

  const batches = new Map();

  return (event, next) => {
    // Check if event should be batched
    if (eventTypes.length > 0 && !eventTypes.includes(event.type)) {
      return next(event);
    }

    if (!batches.has(event.type)) {
      batches.set(event.type, {
        events: [],
        timer: null,
      });
    }

    const batch = batches.get(event.type);
    batch.events.push(event);

    // Check batch size
    if (batch.events.length >= maxBatchSize) {
      clearTimeout(batch.timer);
      const events = [...batch.events];
      batch.events = [];
      
      return next({
        type: `${event.type}:batch`,
        payload: events.map(e => e.payload),
        meta: {
          ...event.meta,
          batchSize: events.length,
          batchedEventType: event.type,
        },
      });
    }

    // Set timeout for batch processing
    if (!batch.timer) {
      batch.timer = setTimeout(() => {
        const events = [...batch.events];
        batch.events = [];
        batch.timer = null;
        
        if (events.length > 0) {
          next({
            type: `${event.type}:batch`,
            payload: events.map(e => e.payload),
            meta: {
              ...event.meta,
              batchSize: events.length,
              batchedEventType: event.type,
            },
          });
        }
      }, maxWaitMs);
    }

    return Promise.resolve();
  };
};

// Export validation schemas for common events
export const eventSchemas = {
  [EventTypes.AUTH.LOGIN]: {
    required: ['user'],
    properties: {
      user: {
        type: 'object',
      },
    },
  },
  [EventTypes.STATE.COUNTRY_SELECTED]: {
    required: ['country'],
    properties: {
      country: {
        type: 'object',
      },
    },
  },
};

export default {
  createLoggingMiddleware,
  createValidationMiddleware,
  createErrorHandlerMiddleware,
  createRateLimitMiddleware,
  createThrottleMiddleware,
  createDebounceMiddleware,
  createTransformMiddleware,
  createFilterMiddleware,
  createAnalyticsMiddleware,
  createPersistenceMiddleware,
  createRetryMiddleware,
  createCircuitBreakerMiddleware,
  createCorrelationMiddleware,
  createBatchMiddleware,
  eventSchemas,
};
