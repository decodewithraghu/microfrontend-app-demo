// Cross-MFE Event Bus for secure communication

const eventListeners = new Map();

// Event types
export const EVENT_TYPES = {
  SESSION_CHANGED: 'mfe:session-changed',
  COUNTRY_CHANGED: 'mfe:country-changed',
  LOGOUT: 'mfe:logout',
  ERROR: 'mfe:error',
};

// Subscribe to events
export const subscribe = (eventType, callback, options = {}) => {
  const { once = false } = options;
  
  const handler = (event) => {
    callback(event.detail);
    if (once) {
      unsubscribe(eventType, handler);
    }
  };
  
  if (!eventListeners.has(eventType)) {
    eventListeners.set(eventType, new Set());
  }
  eventListeners.get(eventType).add(handler);
  
  window.addEventListener(eventType, handler);
  
  // Return unsubscribe function
  return () => unsubscribe(eventType, handler);
};

// Unsubscribe from events
export const unsubscribe = (eventType, handler) => {
  window.removeEventListener(eventType, handler);
  if (eventListeners.has(eventType)) {
    eventListeners.get(eventType).delete(handler);
  }
};

// Publish events
export const publish = (eventType, data) => {
  const event = new CustomEvent(eventType, { 
    detail: data,
    bubbles: true,
    composed: true 
  });
  window.dispatchEvent(event);
};

// Cleanup all listeners (useful when MFE unmounts)
export const cleanup = () => {
  eventListeners.forEach((handlers, eventType) => {
    handlers.forEach(handler => {
      window.removeEventListener(eventType, handler);
    });
  });
  eventListeners.clear();
};
