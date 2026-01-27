# Middleware API Documentation

## Enterprise Middleware System

The middleware system provides composable, reusable processing functions that intercept events before they reach subscribers. This enables cross-cutting concerns like logging, validation, and rate limiting.

---

## Table of Contents

1. [Overview](#overview)
2. [Middleware Pattern](#middleware-pattern)
3. [Built-in Middleware](#built-in-middleware)
   - [Logging Middleware](#logging-middleware)
   - [Validation Middleware](#validation-middleware)
   - [Rate Limit Middleware](#rate-limit-middleware)
   - [Throttle Middleware](#throttle-middleware)
   - [Debounce Middleware](#debounce-middleware)
   - [Circuit Breaker Middleware](#circuit-breaker-middleware)
   - [Retry Middleware](#retry-middleware)
   - [Cache Middleware](#cache-middleware)
   - [Transform Middleware](#transform-middleware)
   - [Filter Middleware](#filter-middleware)
   - [Correlation ID Middleware](#correlation-id-middleware)
   - [Batch Middleware](#batch-middleware)
   - [Performance Middleware](#performance-middleware)
4. [Custom Middleware](#custom-middleware)
5. [Middleware Composition](#middleware-composition)
6. [Best Practices](#best-practices)

---

## Overview

```javascript
import {
  createLoggingMiddleware,
  createValidationMiddleware,
  createRateLimitMiddleware,
  createThrottleMiddleware,
  createDebounceMiddleware,
  createCircuitBreakerMiddleware,
  createRetryMiddleware,
  createCacheMiddleware,
  createTransformMiddleware,
  createFilterMiddleware,
  createCorrelationIdMiddleware,
  createBatchMiddleware,
  createPerformanceMiddleware,
  eventBus,
} from '@mfe/shared';
```

---

## Middleware Pattern

### Middleware Signature

```typescript
type Middleware = (
  event: { type: string; payload: any; options: any },
  next: () => Promise<boolean>
) => Promise<boolean>;
```

### How Middleware Works

```
┌─────────────────────────────────────────────────────────────┐
│                     Middleware Chain                        │
│                                                             │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐                │
│  │ Logging  │ → │Validation│ → │Rate Limit│ → Subscribers  │
│  └──────────┘   └──────────┘   └──────────┘                │
│                                                             │
│  Each middleware can:                                       │
│  • Modify the event                                         │
│  • Block the event (return false)                          │
│  • Log/track the event                                      │
│  • Call next() to continue the chain                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Built-in Middleware

### Logging Middleware

Logs all events for debugging and auditing.

```javascript
const loggingMiddleware = createLoggingMiddleware({
  // Log level: 'debug' | 'info' | 'warn' | 'error'
  level: 'debug',
  
  // Pretty print payloads
  prettyPrint: true,
  
  // Include timestamps
  timestamps: true,
  
  // Filter events to log
  filter: (event) => event.type.startsWith('mfe:auth'),
  
  // Custom logger
  logger: console,
  
  // Include metadata
  includeMeta: true,
});

eventBus.use(loggingMiddleware);
```

**Output Example:**
```
[2024-01-15T10:30:45.123Z] [EventBus] mfe:auth:login
  Payload: { username: "admin" }
  Meta: { id: "abc123", source: "LoginMFE" }
```

---

### Validation Middleware

Validates event payloads against schemas.

```javascript
const validationMiddleware = createValidationMiddleware({
  // Validation schemas per event type
  schemas: {
    'mfe:auth:login': {
      required: ['username', 'password'],
      types: {
        username: 'string',
        password: 'string',
      },
      custom: (payload) => {
        if (payload.username.length < 3) {
          return 'Username must be at least 3 characters';
        }
        return true;
      },
    },
    'mfe:state:country-selected': {
      required: ['country'],
      types: {
        country: 'object',
      },
    },
  },
  
  // Action on validation failure
  onInvalid: 'block', // 'block' | 'warn' | 'throw'
  
  // Include validation errors in event
  includeErrors: true,
});

eventBus.use(validationMiddleware);
```

---

### Rate Limit Middleware

Prevents too many events in a time window.

```javascript
const rateLimitMiddleware = createRateLimitMiddleware({
  // Max events per window
  limit: 100,
  
  // Time window in milliseconds
  window: 60000, // 1 minute
  
  // Per event type limits (overrides global)
  perType: {
    'mfe:data:fetch': { limit: 10, window: 60000 },
    'mfe:auth:login': { limit: 5, window: 300000 }, // 5 per 5 minutes
  },
  
  // Action when rate limited
  onLimited: (event, remaining) => {
    console.warn(`Rate limited: ${event.type}. Retry after ${remaining}ms`);
  },
  
  // Key generator for different rate limit buckets
  keyGenerator: (event) => event.options?.source || 'global',
});

eventBus.use(rateLimitMiddleware);
```

---

### Throttle Middleware

Ensures minimum time between events.

```javascript
const throttleMiddleware = createThrottleMiddleware({
  // Minimum time between events (ms)
  interval: 1000,
  
  // Leading edge (first event goes through immediately)
  leading: true,
  
  // Trailing edge (last event in interval fires after delay)
  trailing: true,
  
  // Per-type intervals
  perType: {
    'mfe:ui:scroll': 100,
    'mfe:ui:resize': 250,
  },
});

eventBus.use(throttleMiddleware);
```

---

### Debounce Middleware

Delays event until activity stops.

```javascript
const debounceMiddleware = createDebounceMiddleware({
  // Wait time after last event (ms)
  wait: 300,
  
  // Fire immediately on first event
  immediate: false,
  
  // Max wait time
  maxWait: 1000,
  
  // Per-type debounce settings
  perType: {
    'mfe:ui:search-input': { wait: 300 },
    'mfe:ui:form-change': { wait: 500 },
  },
});

eventBus.use(debounceMiddleware);
```

---

### Circuit Breaker Middleware

Prevents cascading failures.

```javascript
const circuitBreakerMiddleware = createCircuitBreakerMiddleware({
  // Failure threshold to trip circuit
  failureThreshold: 5,
  
  // Time before attempting reset (ms)
  resetTimeout: 30000,
  
  // Success threshold to close circuit
  successThreshold: 3,
  
  // Per-type circuit breakers
  perType: {
    'mfe:data:api-call': {
      failureThreshold: 3,
      resetTimeout: 60000,
    },
  },
  
  // Callbacks
  onOpen: (eventType) => {
    console.error(`Circuit OPEN for ${eventType}`);
    showNotification('Service temporarily unavailable');
  },
  onClose: (eventType) => {
    console.log(`Circuit CLOSED for ${eventType}`);
  },
  onHalfOpen: (eventType) => {
    console.log(`Circuit HALF-OPEN for ${eventType}`);
  },
});

eventBus.use(circuitBreakerMiddleware);
```

**Circuit Breaker States:**
```
┌──────────┐  failures >= threshold  ┌────────┐
│  CLOSED  │ ───────────────────────→│  OPEN  │
└──────────┘                         └────────┘
     ↑                                    │
     │                           after resetTimeout
     │                                    ↓
     │    successes >= threshold   ┌───────────┐
     └─────────────────────────────│ HALF-OPEN │
                                   └───────────┘
```

---

### Retry Middleware

Automatically retries failed events.

```javascript
const retryMiddleware = createRetryMiddleware({
  // Max retry attempts
  maxRetries: 3,
  
  // Delay between retries (ms)
  delay: 1000,
  
  // Exponential backoff
  exponential: true,
  
  // Max delay
  maxDelay: 10000,
  
  // Jitter to prevent thundering herd
  jitter: true,
  
  // Events to retry
  include: ['mfe:data:*'],
  
  // Events to never retry
  exclude: ['mfe:auth:logout'],
  
  // Retry condition
  shouldRetry: (error, attempt) => {
    return error.code !== 'AUTH_ERROR' && attempt < 3;
  },
});

eventBus.use(retryMiddleware);
```

---

### Cache Middleware

Caches event results.

```javascript
const cacheMiddleware = createCacheMiddleware({
  // TTL in milliseconds
  ttl: 60000, // 1 minute
  
  // Max cache entries
  maxSize: 100,
  
  // Events to cache
  include: ['mfe:data:fetch-*'],
  
  // Cache key generator
  keyGenerator: (event) => 
    `${event.type}:${JSON.stringify(event.payload)}`,
  
  // Conditional caching
  shouldCache: (event, result) => result.success,
  
  // Cache storage (default: Map)
  storage: new Map(),
});

eventBus.use(cacheMiddleware);
```

---

### Transform Middleware

Transforms event payloads.

```javascript
const transformMiddleware = createTransformMiddleware({
  // Transformations per event type
  transforms: {
    'mfe:auth:login': (payload) => ({
      ...payload,
      username: payload.username.toLowerCase().trim(),
      loginTime: Date.now(),
    }),
    
    'mfe:data:country-selected': (payload) => ({
      ...payload,
      country: {
        ...payload.country,
        // Add computed fields
        displayName: payload.country.name.common,
        region: payload.country.region,
      },
    }),
  },
  
  // Global transform applied to all events
  global: (payload, eventType) => ({
    ...payload,
    _meta: {
      transformedAt: Date.now(),
      eventType,
    },
  }),
});

eventBus.use(transformMiddleware);
```

---

### Filter Middleware

Filters events based on conditions.

```javascript
const filterMiddleware = createFilterMiddleware({
  // Global filter (applies to all events)
  global: (event) => {
    // Block events with empty payloads
    return event.payload !== null && event.payload !== undefined;
  },
  
  // Per-type filters
  filters: {
    'mfe:ui:click': (event) => {
      // Ignore synthetic clicks
      return event.payload.isTrusted !== false;
    },
    
    'mfe:data:save': (event) => {
      // Require auth
      return authService.isAuthenticated();
    },
  },
  
  // Blocked event callback
  onFiltered: (event, reason) => {
    console.log(`Event filtered: ${event.type} - ${reason}`);
  },
});

eventBus.use(filterMiddleware);
```

---

### Correlation ID Middleware

Adds correlation IDs for request tracking.

```javascript
const correlationIdMiddleware = createCorrelationIdMiddleware({
  // Header name for correlation ID
  headerName: 'X-Correlation-ID',
  
  // Generate correlation ID
  generator: () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  
  // Inherit from parent events
  inheritFromParent: true,
  
  // Store in event metadata
  storeIn: 'meta.correlationId',
});

eventBus.use(correlationIdMiddleware);
```

---

### Batch Middleware

Batches multiple events together.

```javascript
const batchMiddleware = createBatchMiddleware({
  // Max batch size
  maxSize: 10,
  
  // Max wait time (ms)
  maxWait: 1000,
  
  // Events to batch
  include: ['mfe:analytics:*'],
  
  // Batch key generator (events with same key are batched)
  keyGenerator: (event) => event.type,
  
  // Process batch
  processor: async (batch) => {
    // Send batched events to analytics
    await analyticsService.sendBatch(batch);
  },
});

eventBus.use(batchMiddleware);
```

---

### Performance Middleware

Tracks event performance metrics.

```javascript
const performanceMiddleware = createPerformanceMiddleware({
  // Enable performance tracking
  enabled: process.env.NODE_ENV !== 'production',
  
  // Slow event threshold (ms)
  slowThreshold: 100,
  
  // Callbacks
  onSlow: (event, duration) => {
    console.warn(`Slow event: ${event.type} took ${duration}ms`);
  },
  
  // Metrics storage
  metricsStore: {
    record: (metric) => {
      // Send to monitoring service
      monitoringService.recordMetric(metric);
    },
  },
  
  // Sample rate (0-1)
  sampleRate: 0.1, // 10% of events
});

eventBus.use(performanceMiddleware);
```

---

## Custom Middleware

### Creating Custom Middleware

```javascript
function createCustomMiddleware(options = {}) {
  return async (event, next) => {
    // Before event processing
    console.log(`Before: ${event.type}`);
    
    // Modify event
    event.payload = {
      ...event.payload,
      customField: 'added by middleware',
    };
    
    // Conditionally block event
    if (event.type === 'blocked:event') {
      console.log('Event blocked');
      return false;
    }
    
    // Continue to next middleware
    const result = await next();
    
    // After event processing
    console.log(`After: ${event.type}, success: ${result}`);
    
    return result;
  };
}

eventBus.use(createCustomMiddleware());
```

### Async Middleware

```javascript
function createAsyncMiddleware() {
  return async (event, next) => {
    // Async operation before
    await someAsyncOperation(event);
    
    // Continue chain
    const result = await next();
    
    // Async operation after
    await anotherAsyncOperation(result);
    
    return result;
  };
}
```

---

## Middleware Composition

### Combining Multiple Middleware

```javascript
import {
  createLoggingMiddleware,
  createValidationMiddleware,
  createRateLimitMiddleware,
  createCircuitBreakerMiddleware,
  eventBus,
} from '@mfe/shared';

// Development middleware stack
if (process.env.NODE_ENV === 'development') {
  eventBus.use(createLoggingMiddleware({ level: 'debug' }));
  eventBus.use(createPerformanceMiddleware({ slowThreshold: 50 }));
}

// Production middleware stack
eventBus.use(createValidationMiddleware({ schemas }));
eventBus.use(createRateLimitMiddleware({ limit: 1000, window: 60000 }));
eventBus.use(createCircuitBreakerMiddleware({ failureThreshold: 5 }));
eventBus.use(createCorrelationIdMiddleware());

// Analytics batching
eventBus.use(createBatchMiddleware({
  include: ['mfe:analytics:*'],
  maxSize: 50,
  maxWait: 5000,
}));
```

### Execution Order

```
Event Published
      │
      ↓
┌─────────────────┐
│ Logging (1st)   │ ← Logs incoming event
└────────┬────────┘
         ↓
┌─────────────────┐
│ Validation (2nd)│ ← Validates payload
└────────┬────────┘
         ↓
┌─────────────────┐
│ Rate Limit (3rd)│ ← Checks rate limits
└────────┬────────┘
         ↓
┌─────────────────┐
│ Circuit (4th)   │ ← Checks circuit state
└────────┬────────┘
         ↓
    Subscribers
```

---

## Best Practices

### 1. Order Matters

```javascript
// ✅ Correct order
eventBus.use(loggingMiddleware);      // Log everything first
eventBus.use(validationMiddleware);    // Validate early
eventBus.use(rateLimitMiddleware);     // Rate limit before processing
eventBus.use(circuitBreakerMiddleware); // Circuit breaker last

// ❌ Wrong order
eventBus.use(circuitBreakerMiddleware); // Won't see all events
eventBus.use(rateLimitMiddleware);
eventBus.use(loggingMiddleware);       // Misses blocked events
```

### 2. Keep Middleware Focused

```javascript
// ✅ Single responsibility
const authMiddleware = createFilterMiddleware({
  filters: {
    'mfe:admin:*': () => authService.hasRole('admin'),
  },
});

// ❌ Too many responsibilities
const badMiddleware = (event, next) => {
  // Logging AND validation AND rate limiting - too much!
};
```

### 3. Handle Errors Gracefully

```javascript
function createSafeMiddleware() {
  return async (event, next) => {
    try {
      return await next();
    } catch (error) {
      console.error('Middleware error:', error);
      // Don't block the chain, log and continue
      return true;
    }
  };
}
```

### 4. Use Environment-Specific Configuration

```javascript
const middlewareConfig = {
  development: {
    logging: { level: 'debug', prettyPrint: true },
    rateLimit: { limit: 10000 }, // Higher for dev
  },
  production: {
    logging: { level: 'error' },
    rateLimit: { limit: 1000 },
  },
};

const config = middlewareConfig[process.env.NODE_ENV];
eventBus.use(createLoggingMiddleware(config.logging));
eventBus.use(createRateLimitMiddleware(config.rateLimit));
```

---

## Quick Reference

| Middleware | Purpose | When to Use |
|------------|---------|-------------|
| `createLoggingMiddleware` | Debug logging | Development, auditing |
| `createValidationMiddleware` | Schema validation | All events |
| `createRateLimitMiddleware` | Prevent flooding | API calls, user actions |
| `createThrottleMiddleware` | Min time between | Scroll, resize events |
| `createDebounceMiddleware` | Wait for idle | Search, form input |
| `createCircuitBreakerMiddleware` | Fault tolerance | External services |
| `createRetryMiddleware` | Auto-retry | Network requests |
| `createCacheMiddleware` | Response caching | Expensive operations |
| `createTransformMiddleware` | Data transformation | Format conversion |
| `createFilterMiddleware` | Event filtering | Auth, feature flags |
| `createCorrelationIdMiddleware` | Request tracking | Distributed tracing |
| `createBatchMiddleware` | Batch processing | Analytics, bulk ops |
| `createPerformanceMiddleware` | Performance metrics | Monitoring |

---

## Next Steps

- [State Store](./API_STATE_STORE.md)
- [Event Bus](./API_EVENT_BUS.md)
- [Architecture](./ARCHITECTURE.md)
