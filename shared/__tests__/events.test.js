/**
 * Unit Tests for Events Module
 * Tests cross-MFE event bus functionality
 */

// Event types
const EVENT_TYPES = {
  SESSION_CHANGED: 'mfe:session-changed',
  COUNTRY_CHANGED: 'mfe:country-changed',
  LOGOUT: 'mfe:logout',
  ERROR: 'mfe:error',
};

// Event listeners storage for cleanup
const eventListeners = new Map();

// Subscribe to events
const subscribe = (eventType, callback, options = {}) => {
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
  
  return () => unsubscribe(eventType, handler);
};

// Unsubscribe from events
const unsubscribe = (eventType, handler) => {
  window.removeEventListener(eventType, handler);
  if (eventListeners.has(eventType)) {
    eventListeners.get(eventType).delete(handler);
  }
};

// Publish events
const publish = (eventType, data) => {
  const event = new CustomEvent(eventType, { 
    detail: data,
    bubbles: true,
    composed: true 
  });
  window.dispatchEvent(event);
};

// Cleanup all listeners
const cleanup = () => {
  eventListeners.forEach((handlers, eventType) => {
    handlers.forEach(handler => {
      window.removeEventListener(eventType, handler);
    });
  });
  eventListeners.clear();
};

describe('Events Module', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  describe('EVENT_TYPES', () => {
    it('should have all required event types defined', () => {
      expect(EVENT_TYPES.SESSION_CHANGED).toBe('mfe:session-changed');
      expect(EVENT_TYPES.COUNTRY_CHANGED).toBe('mfe:country-changed');
      expect(EVENT_TYPES.LOGOUT).toBe('mfe:logout');
      expect(EVENT_TYPES.ERROR).toBe('mfe:error');
    });
  });

  describe('subscribe', () => {
    it('should subscribe to events and receive data', () => {
      const callback = jest.fn();
      const testData = { message: 'test' };
      
      subscribe(EVENT_TYPES.SESSION_CHANGED, callback);
      publish(EVENT_TYPES.SESSION_CHANGED, testData);
      
      expect(callback).toHaveBeenCalledWith(testData);
    });

    it('should handle multiple subscribers for same event', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const testData = { user: 'test' };
      
      subscribe(EVENT_TYPES.SESSION_CHANGED, callback1);
      subscribe(EVENT_TYPES.SESSION_CHANGED, callback2);
      publish(EVENT_TYPES.SESSION_CHANGED, testData);
      
      expect(callback1).toHaveBeenCalledWith(testData);
      expect(callback2).toHaveBeenCalledWith(testData);
    });

    it('should return unsubscribe function', () => {
      const callback = jest.fn();
      
      const unsubscribeFn = subscribe(EVENT_TYPES.SESSION_CHANGED, callback);
      
      expect(typeof unsubscribeFn).toBe('function');
    });

    it('should unsubscribe when calling returned function', () => {
      const callback = jest.fn();
      const testData = { message: 'test' };
      
      const unsubscribeFn = subscribe(EVENT_TYPES.SESSION_CHANGED, callback);
      unsubscribeFn();
      publish(EVENT_TYPES.SESSION_CHANGED, testData);
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should only fire once when using once option', () => {
      const callback = jest.fn();
      
      subscribe(EVENT_TYPES.SESSION_CHANGED, callback, { once: true });
      publish(EVENT_TYPES.SESSION_CHANGED, { first: true });
      publish(EVENT_TYPES.SESSION_CHANGED, { second: true });
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ first: true });
    });

    it('should handle different event types independently', () => {
      const sessionCallback = jest.fn();
      const countryCallback = jest.fn();
      
      subscribe(EVENT_TYPES.SESSION_CHANGED, sessionCallback);
      subscribe(EVENT_TYPES.COUNTRY_CHANGED, countryCallback);
      
      publish(EVENT_TYPES.SESSION_CHANGED, { user: 'test' });
      
      expect(sessionCallback).toHaveBeenCalled();
      expect(countryCallback).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribe', () => {
    it('should stop receiving events after unsubscribe', () => {
      const callback = jest.fn();
      
      subscribe(EVENT_TYPES.SESSION_CHANGED, callback);
      
      // Store the handler reference for unsubscribe
      const handlers = eventListeners.get(EVENT_TYPES.SESSION_CHANGED);
      const handler = Array.from(handlers)[0];
      
      unsubscribe(EVENT_TYPES.SESSION_CHANGED, handler);
      publish(EVENT_TYPES.SESSION_CHANGED, { data: 'test' });
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should not throw when unsubscribing non-existent handler', () => {
      const fakeHandler = () => {};
      
      expect(() => {
        unsubscribe(EVENT_TYPES.SESSION_CHANGED, fakeHandler);
      }).not.toThrow();
    });
  });

  describe('publish', () => {
    it('should dispatch CustomEvent with correct type', () => {
      const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
      
      publish(EVENT_TYPES.LOGOUT, { reason: 'manual' });
      
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EVENT_TYPES.LOGOUT,
          detail: { reason: 'manual' },
        })
      );
    });

    it('should handle null data', () => {
      const callback = jest.fn();
      
      subscribe(EVENT_TYPES.SESSION_CHANGED, callback);
      publish(EVENT_TYPES.SESSION_CHANGED, null);
      
      expect(callback).toHaveBeenCalledWith(null);
    });

    it('should handle complex data objects', () => {
      const callback = jest.fn();
      const complexData = {
        user: { id: 1, name: 'Test' },
        permissions: ['read', 'write'],
        metadata: { timestamp: Date.now() },
      };
      
      subscribe(EVENT_TYPES.SESSION_CHANGED, callback);
      publish(EVENT_TYPES.SESSION_CHANGED, complexData);
      
      expect(callback).toHaveBeenCalledWith(complexData);
    });
  });

  describe('cleanup', () => {
    it('should remove all event listeners', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      subscribe(EVENT_TYPES.SESSION_CHANGED, callback1);
      subscribe(EVENT_TYPES.COUNTRY_CHANGED, callback2);
      
      cleanup();
      
      publish(EVENT_TYPES.SESSION_CHANGED, { data: 'test' });
      publish(EVENT_TYPES.COUNTRY_CHANGED, { data: 'test' });
      
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });

    it('should clear the eventListeners map', () => {
      subscribe(EVENT_TYPES.SESSION_CHANGED, jest.fn());
      
      cleanup();
      
      expect(eventListeners.size).toBe(0);
    });

    it('should be safe to call multiple times', () => {
      expect(() => {
        cleanup();
        cleanup();
        cleanup();
      }).not.toThrow();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle rapid event publishing', () => {
      const callback = jest.fn();
      
      subscribe(EVENT_TYPES.SESSION_CHANGED, callback);
      
      for (let i = 0; i < 100; i++) {
        publish(EVENT_TYPES.SESSION_CHANGED, { count: i });
      }
      
      expect(callback).toHaveBeenCalledTimes(100);
    });

    it('should maintain event order', () => {
      const receivedData = [];
      const callback = (data) => receivedData.push(data.order);
      
      subscribe(EVENT_TYPES.SESSION_CHANGED, callback);
      
      publish(EVENT_TYPES.SESSION_CHANGED, { order: 1 });
      publish(EVENT_TYPES.SESSION_CHANGED, { order: 2 });
      publish(EVENT_TYPES.SESSION_CHANGED, { order: 3 });
      
      expect(receivedData).toEqual([1, 2, 3]);
    });
  });
});
