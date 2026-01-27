/**
 * MFE Shared Library - Main Entry Point
 * 
 * This library provides enterprise-grade utilities for
 * Micro Frontend communication and state management.
 * 
 * @module @mfe/shared
 * @version 3.0.0
 */

// ============================================
// Core Services
// ============================================

// Event Bus - Pub/Sub Communication
export {
  default as eventBus,
  getEventBus,
  createEventBus,
  EventTypes,
  Priority,
} from './eventBus.js';

// State Store - Centralized State Management
export {
  default as store,
  getStore,
  createStore,
  ActionTypes,
} from './stateStore.js';

// Authentication Service
export {
  default as authService,
  getAuthService,
  login,
  logout,
  getSession,
  getUser,
  isAuthenticated,
  hasRole,
  hasPermission,
  refreshSession,
  getAuthToken,
  validateToken,
  setSelectedCountry,
  getSelectedCountry,
  clearSelectedCountry,
  Roles,
  Permissions,
  // Legacy exports
  setSession,
  clearSession,
  validateAuthToken,
} from './authService.js';

// ============================================
// New Target Architecture Services
// NOTE: These are available but not loaded by default
// to prevent initialization issues. Import directly if needed.
// ============================================

// ============================================
// Middleware Collection
// ============================================
export {
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
} from './middleware.js';

// ============================================
// React Hooks
// ============================================
export {
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
} from './hooks.js';

// ============================================
// Legacy exports for backward compatibility
// ============================================
export * from './auth.js';
export * from './events.js';
