# Event Bus API Documentation

## Enterprise Pub-Sub Communication System

The Event Bus provides a robust, type-safe communication layer for micro frontends with advanced features like middleware support, event history, and dead letter queues.

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Event Types](#event-types)
4. [Core API](#core-api)
5. [Subscription Options](#subscription-options)
6. [Publishing Events](#publishing-events)
7. [Middleware](#middleware)
8. [Event History](#event-history)
9. [Dead Letter Queue](#dead-letter-queue)
10. [Cross-Tab Communication](#cross-tab-communication)
11. [Best Practices](#best-practices)
12. [Examples](#examples)

---

## Overview

The Event Bus implements the **Publisher-Subscriber (Pub-Sub)** pattern with enterprise features:

- **Typed Events**: Strongly-typed event definitions
- **Priority Handling**: Process events in priority order
- **Middleware Chain**: Transform, validate, log events
- **Event Replay**: Replay historical events
- **Dead Letter Queue**: Capture failed events
- **Cross-Tab Sync**: Share events across browser tabs

---

## Quick Start

```javascript
import eventBus, { EventTypes, Priority } from '@mfe/shared';

// Subscribe to an event
const unsubscribe = eventBus.subscribe(
  EventTypes.AUTH.LOGIN,
  (payload, meta) => {
    console.log('User logged in:', payload.user);
  }
);

// Publish an event
eventBus.publish(EventTypes.AUTH.LOGIN, {
  user: { id: '123', username: 'john' }
});

// Cleanup
unsubscribe();
```

---

## Event Types

All event types are namespaced and frozen for type safety:

### Authentication Events

```javascript
EventTypes.AUTH = {
  LOGIN: 'mfe:auth:login',
  LOGOUT: 'mfe:auth:logout',
  SESSION_EXPIRED: 'mfe:auth:session-expired',
  SESSION_REFRESHED: 'mfe:auth:session-refreshed',
  TOKEN_INVALID: 'mfe:auth:token-invalid',
}
```

### State Events

```javascript
EventTypes.STATE = {
  COUNTRY_SELECTED: 'mfe:state:country-selected',
  COUNTRY_CLEARED: 'mfe:state:country-cleared',
  USER_UPDATED: 'mfe:state:user-updated',
  PREFERENCES_CHANGED: 'mfe:state:preferences-changed',
}
```

### Data Events

```javascript
EventTypes.DATA = {
  WEATHER_LOADED: 'mfe:data:weather-loaded',
  POPULATION_LOADED: 'mfe:data:population-loaded',
  COUNTRIES_LOADED: 'mfe:data:countries-loaded',
  CACHE_INVALIDATED: 'mfe:data:cache-invalidated',
}
```

### UI Events

```javascript
EventTypes.UI = {
  LOADING_START: 'mfe:ui:loading-start',
  LOADING_END: 'mfe:ui:loading-end',
  ERROR_DISPLAYED: 'mfe:ui:error-displayed',
  NOTIFICATION: 'mfe:ui:notification',
  NAVIGATION: 'mfe:ui:navigation',
}
```

### System Events

```javascript
EventTypes.SYSTEM = {
  MFE_MOUNTED: 'mfe:system:mounted',
  MFE_UNMOUNTED: 'mfe:system:unmounted',
  ERROR: 'mfe:system:error',
  HEALTH_CHECK: 'mfe:system:health-check',
}
```

---

## Core API

### `subscribe(eventType, handler, options?)`

Subscribe to events.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `eventType` | `string` | Event type or wildcard pattern |
| `handler` | `function` | Handler function `(payload, meta) => void` |
| `options` | `object` | Subscription options |

**Returns:** `function` - Unsubscribe function

```javascript
// Basic subscription
const unsubscribe = eventBus.subscribe(
  EventTypes.AUTH.LOGIN,
  (payload, meta) => {
    console.log('Event received:', payload);
    console.log('Event meta:', meta);
  }
);

// Wildcard subscription (all auth events)
eventBus.subscribe('mfe:auth:*', (payload, meta) => {
  console.log('Auth event:', meta.type);
});

// Subscribe to all events
eventBus.subscribe('*', (payload, meta) => {
  console.log('Any event:', meta.type);
});
```

### `once(eventType, handler, options?)`

Subscribe to an event only once.

```javascript
eventBus.once(EventTypes.AUTH.LOGIN, (payload) => {
  console.log('First login:', payload.user);
  // Automatically unsubscribed after first event
});
```

### `unsubscribe(subscriptionIdOrHandler)`

Manually unsubscribe.

```javascript
// By handler function
eventBus.unsubscribe(myHandler);

// By subscription ID (returned in subscribe)
eventBus.unsubscribe('sub-123456789');
```

### `publish(eventType, payload?, options?)`

Publish an event.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `eventType` | `string` | Event type |
| `payload` | `any` | Event data |
| `options` | `object` | Publish options |

**Returns:** `Promise<boolean>` - Success status

```javascript
// Basic publish
await eventBus.publish(EventTypes.AUTH.LOGIN, {
  user: { id: '123', username: 'john' }
});

// With options
await eventBus.publish(EventTypes.STATE.COUNTRY_SELECTED, 
  { country: selectedCountry },
  {
    source: 'LoginMFE',
    broadcast: true,
    persist: true,
  }
);
```

### `publishSync(eventType, payload?, options?)`

Publish event synchronously.

```javascript
eventBus.publishSync(EventTypes.UI.LOADING_START, { key: 'weather' });
```

---

## Subscription Options

```javascript
eventBus.subscribe(eventType, handler, {
  // Priority level (lower = higher priority)
  priority: Priority.HIGH,
  
  // Only trigger once
  once: false,
  
  // Filter function for payload
  filter: (payload, meta) => payload.country?.code === 'US',
  
  // Bind context (this)
  context: myComponent,
  
  // Custom error handler
  errorHandler: (error, payload, meta) => {
    console.error('Handler error:', error);
  },
});
```

### Priority Levels

```javascript
Priority = {
  CRITICAL: 0,   // First to execute
  HIGH: 1,
  NORMAL: 2,     // Default
  LOW: 3,
  BACKGROUND: 4, // Last to execute
}
```

---

## Publishing Events

### Publish Options

```javascript
await eventBus.publish(eventType, payload, {
  // Source identifier
  source: 'WeatherMFE',
  
  // Broadcast to other windows/tabs
  broadcast: true,
  
  // Persist event to storage
  persist: false,
  
  // Process synchronously
  sync: false,
});
```

### Event Metadata

Every published event includes metadata:

```javascript
{
  id: 'abc123-xyz789',       // Unique event ID
  timestamp: 1704067200000,  // Unix timestamp
  type: 'mfe:auth:login',    // Event type
  source: 'LoginMFE',        // Publisher source
  version: '1.0.0',          // Event version
}
```

---

## Middleware

Add processing to the event pipeline:

### Adding Middleware

```javascript
import { createLoggingMiddleware } from '@mfe/shared';

// Add middleware
const removeMiddleware = eventBus.use(
  createLoggingMiddleware({ level: 'info' })
);

// Remove later
removeMiddleware();
```

### Custom Middleware

```javascript
const myMiddleware = (event, next) => {
  // Before event processing
  console.log('Processing:', event.type);
  
  // Modify event
  const modifiedEvent = {
    ...event,
    payload: {
      ...event.payload,
      processedAt: Date.now(),
    },
  };
  
  // Continue to next middleware
  return next(modifiedEvent);
  
  // Or block event
  // return next(false);
};

eventBus.use(myMiddleware);
```

### Async Middleware

```javascript
const asyncMiddleware = async (event, next) => {
  // Async validation
  const isValid = await validatePayload(event.payload);
  
  if (!isValid) {
    return next(false); // Block event
  }
  
  return next(event);
};
```

---

## Event History

Access and replay event history:

### Get History

```javascript
// Get all history
const allHistory = eventBus.getHistory();

// Filter by event type
const authHistory = eventBus.getHistory('mfe:auth:*');

// Filter with function
const recentHistory = eventBus.getHistory(
  event => Date.now() - event.timestamp < 60000
);
```

### Replay Events

```javascript
// Replay all events
await eventBus.replay();

// Replay filtered events
await eventBus.replay('mfe:state:*');

// Replay with delay between events
await eventBus.replay(null, { delay: 100 });
```

---

## Dead Letter Queue

Handle failed events:

```javascript
// Get failed events
const deadLetters = eventBus.getDeadLetterQueue();

// Each entry contains:
// {
//   event: { type, payload, meta },
//   error: 'Error message',
//   stack: 'Stack trace...',
//   failedAt: timestamp,
// }

// Clear dead letter queue
eventBus.clearDeadLetterQueue();
```

---

## Cross-Tab Communication

Events automatically sync across browser tabs:

```javascript
// Tab 1: Publish event
eventBus.publish(EventTypes.AUTH.LOGOUT, { reason: 'user' });

// Tab 2: Automatically receives the event
eventBus.subscribe(EventTypes.AUTH.LOGOUT, () => {
  // Clear local state and redirect to login
  window.location.href = '/login';
});
```

### Disable Broadcast

```javascript
// Don't broadcast to other tabs
eventBus.publish(EventTypes.UI.LOADING_START, payload, {
  broadcast: false,
});
```

---

## Best Practices

### 1. Always Unsubscribe

```javascript
// In React useEffect
useEffect(() => {
  const unsubscribe = eventBus.subscribe(eventType, handler);
  return () => unsubscribe();
}, []);
```

### 2. Use Typed Event Constants

```javascript
// ✅ Good
eventBus.publish(EventTypes.AUTH.LOGIN, payload);

// ❌ Bad
eventBus.publish('mfe:auth:login', payload);
```

### 3. Include Source in Publish

```javascript
eventBus.publish(eventType, payload, {
  source: 'WeatherMFE', // Helps with debugging
});
```

### 4. Use Appropriate Priority

```javascript
// Critical auth events should be high priority
eventBus.subscribe(EventTypes.AUTH.LOGOUT, handler, {
  priority: Priority.CRITICAL,
});

// Analytics can be low priority
eventBus.subscribe('*', analyticsHandler, {
  priority: Priority.BACKGROUND,
});
```

### 5. Filter at Subscription Level

```javascript
// ✅ Filter in subscription options
eventBus.subscribe(EventTypes.DATA.LOADED, handler, {
  filter: (payload) => payload.dataType === 'weather',
});

// ❌ Filter in handler (less efficient)
eventBus.subscribe(EventTypes.DATA.LOADED, (payload) => {
  if (payload.dataType !== 'weather') return;
  // ...
});
```

---

## Examples

### Complete Login Flow

```javascript
// Login MFE
const handleLogin = async (credentials) => {
  try {
    const result = await authService.login(credentials);
    
    // Auth events published automatically by AuthService
    // Or publish manually:
    eventBus.publish(EventTypes.AUTH.LOGIN, {
      user: result.user,
    }, { source: 'LoginMFE' });
    
  } catch (error) {
    eventBus.publish(EventTypes.SYSTEM.ERROR, {
      message: error.message,
      context: 'login',
    });
  }
};

// Other MFEs listen for login
eventBus.subscribe(EventTypes.AUTH.LOGIN, (payload) => {
  setUser(payload.user);
  redirectToHome();
});
```

### Country Selection with Filtering

```javascript
// Subscribe only to specific country events
eventBus.subscribe(
  EventTypes.STATE.COUNTRY_SELECTED,
  (payload) => {
    fetchWeatherData(payload.country);
  },
  {
    filter: (payload) => 
      payload.country?.coordinates?.latitude != null,
  }
);
```

### Debug Mode

```javascript
// Enable debug logging
eventBus.setDebugMode(true);

// Now all events are logged to console
```

---

## API Reference Summary

| Method | Description |
|--------|-------------|
| `subscribe(type, handler, opts)` | Subscribe to events |
| `once(type, handler, opts)` | Subscribe once |
| `unsubscribe(id)` | Unsubscribe |
| `publish(type, payload, opts)` | Publish event async |
| `publishSync(type, payload, opts)` | Publish event sync |
| `use(middleware)` | Add middleware |
| `removeMiddleware(middleware)` | Remove middleware |
| `getHistory(filter)` | Get event history |
| `replay(filter, opts)` | Replay events |
| `getDeadLetterQueue()` | Get failed events |
| `clearDeadLetterQueue()` | Clear dead letters |
| `getSubscriptions()` | List all subscriptions |
| `hasSubscribers(type)` | Check for subscribers |
| `clearSubscriptions(type)` | Clear subscriptions |
| `setDebugMode(enabled)` | Toggle debug mode |
| `destroy()` | Cleanup instance |

---

## Next Steps

- [State Store Guide](./API_STATE_STORE.md)
- [Middleware Reference](./API_MIDDLEWARE.md)
- [React Hooks](./API_REACT_HOOKS.md)
