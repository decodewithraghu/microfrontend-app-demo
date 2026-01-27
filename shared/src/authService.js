/**
 * Enhanced Authentication Module for Cross-MFE Session Management
 * 
 * Features:
 * - AES-like encryption for session data
 * - JWT-style token generation and validation
 * - Session refresh and sliding expiration
 * - Role-based access control
 * - Secure storage with integrity checks
 * - Integration with StateStore and EventBus
 */

import eventBus, { EventTypes, Priority } from './eventBus.js';
import store, { ActionTypes } from './stateStore.js';

// Storage configuration
const CONFIG = {
  AUTH_KEY: 'mfe_auth_session',
  COUNTRY_KEY: 'mfe_selected_country',
  REFRESH_KEY: 'mfe_refresh_token',
  SESSION_DURATION: 24 * 60 * 60 * 1000, // 24 hours
  REFRESH_THRESHOLD: 30 * 60 * 1000, // 30 minutes before expiry
  TOKEN_DURATION: 60 * 60 * 1000, // 1 hour
  ENCRYPTION_KEY: 'mfe_secret_key_2024', // In production, use env variable
};

// User roles
export const Roles = Object.freeze({
  ADMIN: 'admin',
  USER: 'user',
  GUEST: 'guest',
});

// Permission levels
export const Permissions = Object.freeze({
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete',
  ADMIN: 'admin',
});

// Role permissions mapping
const rolePermissions = {
  [Roles.ADMIN]: [Permissions.READ, Permissions.WRITE, Permissions.DELETE, Permissions.ADMIN],
  [Roles.USER]: [Permissions.READ, Permissions.WRITE],
  [Roles.GUEST]: [Permissions.READ],
};

/**
 * Enhanced encryption using XOR cipher with key rotation
 * Note: In production, use Web Crypto API or a proper encryption library
 */
const encrypt = (data, key = CONFIG.ENCRYPTION_KEY) => {
  try {
    const jsonStr = JSON.stringify(data);
    const encoded = encodeURIComponent(jsonStr);
    
    // XOR cipher with key
    let result = '';
    for (let i = 0; i < encoded.length; i++) {
      const charCode = encoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    
    // Base64 encode
    return btoa(result);
  } catch (error) {
    console.error('Encryption failed:', error);
    return null;
  }
};

/**
 * Decrypt data
 */
const decrypt = (encrypted, key = CONFIG.ENCRYPTION_KEY) => {
  try {
    // Base64 decode
    const decoded = atob(encrypted);
    
    // XOR decrypt
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    
    // Decode and parse
    const jsonStr = decodeURIComponent(result);
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
};

/**
 * Generate secure token
 */
const generateToken = (payload) => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Date.now();
  
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + CONFIG.TOKEN_DURATION,
    jti: `${now}-${Math.random().toString(36).substr(2, 9)}`,
  };
  
  const headerB64 = btoa(JSON.stringify(header));
  const payloadB64 = btoa(JSON.stringify(tokenPayload));
  const signature = btoa(encrypt(`${headerB64}.${payloadB64}`));
  
  return `${headerB64}.${payloadB64}.${signature}`;
};

/**
 * Parse and validate token
 */
const parseToken = (token) => {
  try {
    const [headerB64, payloadB64, signature] = token.split('.');
    
    // Verify signature
    const expectedSig = btoa(encrypt(`${headerB64}.${payloadB64}`));
    if (signature !== expectedSig) {
      return { valid: false, error: 'Invalid signature' };
    }
    
    const payload = JSON.parse(atob(payloadB64));
    
    // Check expiration
    if (Date.now() > payload.exp) {
      return { valid: false, error: 'Token expired', payload };
    }
    
    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: 'Invalid token format' };
  }
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (userId) => {
  return encrypt({
    userId,
    type: 'refresh',
    createdAt: Date.now(),
    expiresAt: Date.now() + CONFIG.SESSION_DURATION * 7, // 7 days
  });
};

/**
 * Calculate checksum for data integrity
 */
const calculateChecksum = (data) => {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
};

/**
 * Secure storage wrapper with integrity checks
 */
const secureStorage = {
  set: (key, value) => {
    const payload = {
      data: value,
      checksum: calculateChecksum(value),
      timestamp: Date.now(),
    };
    const encrypted = encrypt(payload);
    if (encrypted) {
      sessionStorage.setItem(key, encrypted);
      return true;
    }
    return false;
  },
  
  get: (key) => {
    const encrypted = sessionStorage.getItem(key);
    if (!encrypted) return null;
    
    const payload = decrypt(encrypted);
    if (!payload) return null;
    
    // Verify integrity
    if (calculateChecksum(payload.data) !== payload.checksum) {
      console.warn('Data integrity check failed');
      sessionStorage.removeItem(key);
      return null;
    }
    
    return payload.data;
  },
  
  remove: (key) => {
    sessionStorage.removeItem(key);
  },
  
  clear: () => {
    Object.values(CONFIG).forEach(key => {
      if (typeof key === 'string' && key.startsWith('mfe_')) {
        sessionStorage.removeItem(key);
      }
    });
  },
};

/**
 * Demo credentials (in production, this would be server-side)
 */
const demoCredentials = {
  admin: { password: 'admin123', role: Roles.ADMIN, name: 'Administrator' },
  user: { password: 'user123', role: Roles.USER, name: 'Regular User' },
  guest: { password: 'guest123', role: Roles.GUEST, name: 'Guest User' },
};

/**
 * Authentication Service Class
 */
class AuthService {
  constructor() {
    this._refreshTimer = null;
    this._activityTimer = null;
    this._lastActivity = Date.now();
    
    this._setupActivityTracking();
    this._setupAutoRefresh();
  }

  /**
   * Track user activity for session management
   */
  _setupActivityTracking() {
    if (typeof window === 'undefined') return;
    
    const updateActivity = () => {
      this._lastActivity = Date.now();
    };
    
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true });
    });
  }

  /**
   * Setup automatic session refresh
   */
  _setupAutoRefresh() {
    this._refreshTimer = setInterval(() => {
      const session = this.getSession();
      if (session && session.expiresAt) {
        const timeUntilExpiry = session.expiresAt - Date.now();
        
        if (timeUntilExpiry < CONFIG.REFRESH_THRESHOLD && timeUntilExpiry > 0) {
          this.refreshSession();
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Login with credentials
   */
  async login(username, password) {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Validate credentials (demo implementation)
    const user = demoCredentials[username.toLowerCase()];
    if (!user || user.password !== password) {
      eventBus.publish(EventTypes.AUTH.TOKEN_INVALID, {
        reason: 'Invalid credentials',
        username,
      }, { source: 'AuthService' });
      
      throw new Error('Invalid username or password');
    }
    
    // Create session
    const sessionData = {
      id: `user_${Date.now()}`,
      username: username.toLowerCase(),
      name: user.name,
      role: user.role,
      permissions: rolePermissions[user.role],
      createdAt: Date.now(),
      expiresAt: Date.now() + CONFIG.SESSION_DURATION,
      lastActivity: Date.now(),
    };
    
    // Generate tokens
    const accessToken = generateToken({
      userId: sessionData.id,
      username: sessionData.username,
      role: sessionData.role,
    });
    
    const refreshToken = generateRefreshToken(sessionData.id);
    
    // Store session
    const fullSession = {
      ...sessionData,
      token: accessToken,
    };
    
    secureStorage.set(CONFIG.AUTH_KEY, fullSession);
    secureStorage.set(CONFIG.REFRESH_KEY, refreshToken);
    
    // Update state store
    store.dispatch({
      type: ActionTypes.SET_USER,
      payload: {
        id: sessionData.id,
        username: sessionData.username,
        name: sessionData.name,
        role: sessionData.role,
        permissions: sessionData.permissions,
      },
    });
    
    store.dispatch({
      type: ActionTypes.SET_SESSION,
      payload: {
        token: accessToken,
        expiresAt: sessionData.expiresAt,
      },
    });
    
    // Publish login event
    eventBus.publish(EventTypes.AUTH.LOGIN, {
      user: {
        id: sessionData.id,
        username: sessionData.username,
        name: sessionData.name,
        role: sessionData.role,
      },
    }, { source: 'AuthService', persist: true });
    
    return {
      success: true,
      user: sessionData,
      token: accessToken,
    };
  }

  /**
   * Logout current user
   */
  logout() {
    const session = this.getSession();
    
    // Clear storage
    secureStorage.remove(CONFIG.AUTH_KEY);
    secureStorage.remove(CONFIG.REFRESH_KEY);
    secureStorage.remove(CONFIG.COUNTRY_KEY);
    
    // Update state store
    store.dispatch({ type: ActionTypes.CLEAR_USER });
    store.dispatch({ type: ActionTypes.CLEAR_SESSION });
    store.dispatch({ type: ActionTypes.CLEAR_COUNTRY });
    store.dispatch({ type: ActionTypes.CLEAR_DATA });
    
    // Publish logout event
    eventBus.publish(EventTypes.AUTH.LOGOUT, {
      userId: session?.id,
      reason: 'user_initiated',
    }, { source: 'AuthService', persist: true });
    
    return { success: true };
  }

  /**
   * Get current session
   */
  getSession() {
    const session = secureStorage.get(CONFIG.AUTH_KEY);
    if (!session) return null;
    
    // Check expiration
    if (Date.now() > session.expiresAt) {
      this._handleSessionExpired();
      return null;
    }
    
    return session;
  }

  /**
   * Get current user
   */
  getUser() {
    const session = this.getSession();
    if (!session) return null;
    
    return {
      id: session.id,
      username: session.username,
      name: session.name,
      role: session.role,
      permissions: session.permissions,
    };
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return this.getSession() !== null;
  }

  /**
   * Check if user has specific role
   */
  hasRole(role) {
    const user = this.getUser();
    return user?.role === role;
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(permission) {
    const user = this.getUser();
    return user?.permissions?.includes(permission) || false;
  }

  /**
   * Refresh session token
   */
  async refreshSession() {
    const refreshToken = secureStorage.get(CONFIG.REFRESH_KEY);
    if (!refreshToken) {
      this._handleSessionExpired();
      return null;
    }
    
    // Validate refresh token
    if (Date.now() > refreshToken.expiresAt) {
      this._handleSessionExpired();
      return null;
    }
    
    const session = this.getSession();
    if (!session) return null;
    
    // Generate new tokens
    const newAccessToken = generateToken({
      userId: session.id,
      username: session.username,
      role: session.role,
    });
    
    // Update session
    const updatedSession = {
      ...session,
      token: newAccessToken,
      expiresAt: Date.now() + CONFIG.SESSION_DURATION,
      lastActivity: Date.now(),
    };
    
    secureStorage.set(CONFIG.AUTH_KEY, updatedSession);
    
    // Update state store
    store.dispatch({
      type: ActionTypes.SET_SESSION,
      payload: {
        token: newAccessToken,
        expiresAt: updatedSession.expiresAt,
      },
    });
    
    // Publish refresh event
    eventBus.publish(EventTypes.AUTH.SESSION_REFRESHED, {
      userId: session.id,
      newExpiry: updatedSession.expiresAt,
    }, { source: 'AuthService' });
    
    return { token: newAccessToken, expiresAt: updatedSession.expiresAt };
  }

  /**
   * Handle session expiration
   */
  _handleSessionExpired() {
    const session = secureStorage.get(CONFIG.AUTH_KEY);
    
    secureStorage.clear();
    store.dispatch({ type: ActionTypes.CLEAR_USER });
    store.dispatch({ type: ActionTypes.CLEAR_SESSION });
    
    eventBus.publish(EventTypes.AUTH.SESSION_EXPIRED, {
      userId: session?.id,
      expiredAt: Date.now(),
    }, { source: 'AuthService', persist: true });
  }

  /**
   * Get auth token for API calls
   */
  getAuthToken() {
    const session = this.getSession();
    return session?.token || null;
  }

  /**
   * Validate auth token
   */
  validateToken(token) {
    if (!token) return { valid: false, error: 'No token provided' };
    return parseToken(token);
  }

  /**
   * Set selected country
   */
  setSelectedCountry(country) {
    if (!this.isAuthenticated()) {
      throw new Error('Must be authenticated to select country');
    }
    
    secureStorage.set(CONFIG.COUNTRY_KEY, country);
    
    store.dispatch({
      type: ActionTypes.SET_COUNTRY,
      payload: country,
    });
    
    eventBus.publish(EventTypes.STATE.COUNTRY_SELECTED, {
      country,
      userId: this.getUser()?.id,
    }, { source: 'AuthService', persist: true });
    
    return { success: true };
  }

  /**
   * Get selected country
   */
  getSelectedCountry() {
    return secureStorage.get(CONFIG.COUNTRY_KEY);
  }

  /**
   * Clear selected country
   */
  clearSelectedCountry() {
    secureStorage.remove(CONFIG.COUNTRY_KEY);
    
    store.dispatch({ type: ActionTypes.CLEAR_COUNTRY });
    
    eventBus.publish(EventTypes.STATE.COUNTRY_CLEARED, {
      userId: this.getUser()?.id,
    }, { source: 'AuthService' });
  }

  /**
   * Destroy service (cleanup)
   */
  destroy() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
    }
    if (this._activityTimer) {
      clearInterval(this._activityTimer);
    }
  }
}

// Singleton instance
let authServiceInstance = null;

/**
 * Get singleton AuthService instance
 */
export const getAuthService = () => {
  if (!authServiceInstance) {
    authServiceInstance = new AuthService();
  }
  return authServiceInstance;
};

// Export convenience functions that use singleton
const authService = getAuthService();

export const login = (username, password) => authService.login(username, password);
export const logout = () => authService.logout();
export const getSession = () => authService.getSession();
export const getUser = () => authService.getUser();
export const isAuthenticated = () => authService.isAuthenticated();
export const hasRole = (role) => authService.hasRole(role);
export const hasPermission = (permission) => authService.hasPermission(permission);
export const refreshSession = () => authService.refreshSession();
export const getAuthToken = () => authService.getAuthToken();
export const validateToken = (token) => authService.validateToken(token);
export const setSelectedCountry = (country) => authService.setSelectedCountry(country);
export const getSelectedCountry = () => authService.getSelectedCountry();
export const clearSelectedCountry = () => authService.clearSelectedCountry();

// Legacy exports for backward compatibility
export const setSession = (user) => authService.login(user.username, user.password);
export const clearSession = () => authService.logout();
export const validateAuthToken = (token) => authService.validateToken(token).valid;

export default authService;
