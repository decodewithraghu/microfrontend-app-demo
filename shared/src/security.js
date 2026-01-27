/**
 * Security Module
 * 
 * Features:
 * - Content Security Policy (CSP) management
 * - XSS protection utilities
 * - CSRF token management
 * - Secure cookie handling
 * - Input sanitization
 * - Security headers validation
 * - Subresource Integrity (SRI) helpers
 */

import { generateSecureId, hash } from './crypto.js';
import logger from './logger.js';

// Security Configuration
const SECURITY_CONFIG = {
  csrfTokenName: 'mfe_csrf_token',
  csrfHeaderName: 'X-CSRF-Token',
  cookiePrefix: 'mfe_',
  defaultCookieOptions: {
    secure: true,
    sameSite: 'Strict',
    path: '/',
  },
};

/**
 * Content Security Policy Manager
 */
class CSPManager {
  constructor() {
    this._policy = {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'font-src': ["'self'"],
      'connect-src': ["'self'"],
      'frame-src': ["'none'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': [],
    };
    this._nonces = new Set();
    this._reportUri = null;
  }

  /**
   * Add allowed source to directive
   */
  addSource(directive, source) {
    if (!this._policy[directive]) {
      this._policy[directive] = [];
    }
    if (!this._policy[directive].includes(source)) {
      this._policy[directive].push(source);
    }
    return this;
  }

  /**
   * Add multiple sources to directive
   */
  addSources(directive, sources) {
    sources.forEach(source => this.addSource(directive, source));
    return this;
  }

  /**
   * Remove source from directive
   */
  removeSource(directive, source) {
    if (this._policy[directive]) {
      const index = this._policy[directive].indexOf(source);
      if (index > -1) {
        this._policy[directive].splice(index, 1);
      }
    }
    return this;
  }

  /**
   * Generate a nonce for inline scripts/styles
   */
  generateNonce() {
    const nonce = generateSecureId(16);
    this._nonces.add(nonce);
    return nonce;
  }

  /**
   * Add nonce to script-src
   */
  addNonce(nonce) {
    this.addSource('script-src', `'nonce-${nonce}'`);
    return nonce;
  }

  /**
   * Set report URI
   */
  setReportUri(uri) {
    this._reportUri = uri;
    return this;
  }

  /**
   * Build CSP header string
   */
  buildPolicy() {
    const directives = Object.entries(this._policy)
      .filter(([, values]) => values.length > 0 || values.length === 0)
      .map(([directive, values]) => {
        if (values.length === 0) {
          return directive;
        }
        return `${directive} ${values.join(' ')}`;
      });

    if (this._reportUri) {
      directives.push(`report-uri ${this._reportUri}`);
    }

    return directives.join('; ');
  }

  /**
   * Apply CSP via meta tag (for SPAs without server control)
   */
  applyToDocument() {
    if (typeof document === 'undefined') return;

    // Remove existing CSP meta tag
    const existing = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (existing) {
      existing.remove();
    }

    // Create new meta tag
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = this.buildPolicy();
    document.head.insertBefore(meta, document.head.firstChild);

    logger.info('CSP applied', { policy: this.buildPolicy() });
  }

  /**
   * Get current policy
   */
  getPolicy() {
    return { ...this._policy };
  }

  /**
   * Configure for MFE environment
   */
  configureForMFE(mfeHosts = []) {
    // Allow MFE hosts for scripts
    mfeHosts.forEach(host => {
      this.addSource('script-src', host);
      this.addSource('connect-src', host);
    });

    // Allow external APIs
    this.addSources('connect-src', [
      'https://restcountries.com',
      'https://api.open-meteo.com',
      'https://api.worldbank.org',
    ]);

    // Allow images from external sources
    this.addSources('img-src', [
      'https://flagcdn.com',
      'https://upload.wikimedia.org',
    ]);

    return this;
  }
}

/**
 * CSRF Protection
 */
class CSRFProtection {
  constructor() {
    this._token = null;
  }

  /**
   * Generate CSRF token
   */
  generateToken() {
    this._token = generateSecureId(32);
    
    // Store in sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SECURITY_CONFIG.csrfTokenName, this._token);
    }
    
    return this._token;
  }

  /**
   * Get current token
   */
  getToken() {
    if (this._token) return this._token;
    
    if (typeof sessionStorage !== 'undefined') {
      this._token = sessionStorage.getItem(SECURITY_CONFIG.csrfTokenName);
    }
    
    if (!this._token) {
      this._token = this.generateToken();
    }
    
    return this._token;
  }

  /**
   * Validate token
   */
  validateToken(token) {
    return token === this.getToken();
  }

  /**
   * Get header for requests
   */
  getHeader() {
    return {
      [SECURITY_CONFIG.csrfHeaderName]: this.getToken(),
    };
  }

  /**
   * Add to form
   */
  addToForm(form) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = SECURITY_CONFIG.csrfTokenName;
    input.value = this.getToken();
    form.appendChild(input);
  }

  /**
   * Clear token
   */
  clearToken() {
    this._token = null;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SECURITY_CONFIG.csrfTokenName);
    }
  }
}

/**
 * Secure Cookie Manager
 * Note: For httpOnly cookies, a server is required
 */
class SecureCookieManager {
  /**
   * Set a cookie with secure defaults
   */
  static set(name, value, options = {}) {
    if (typeof document === 'undefined') return;

    const cookieOptions = {
      ...SECURITY_CONFIG.defaultCookieOptions,
      ...options,
    };

    let cookie = `${SECURITY_CONFIG.cookiePrefix}${name}=${encodeURIComponent(value)}`;

    if (cookieOptions.expires) {
      cookie += `; expires=${cookieOptions.expires.toUTCString()}`;
    }
    if (cookieOptions.maxAge) {
      cookie += `; max-age=${cookieOptions.maxAge}`;
    }
    if (cookieOptions.path) {
      cookie += `; path=${cookieOptions.path}`;
    }
    if (cookieOptions.domain) {
      cookie += `; domain=${cookieOptions.domain}`;
    }
    if (cookieOptions.secure) {
      cookie += '; secure';
    }
    if (cookieOptions.sameSite) {
      cookie += `; samesite=${cookieOptions.sameSite}`;
    }

    document.cookie = cookie;
    logger.debug('Cookie set', { name });
  }

  /**
   * Get a cookie value
   */
  static get(name) {
    if (typeof document === 'undefined') return null;

    const fullName = `${SECURITY_CONFIG.cookiePrefix}${name}=`;
    const cookies = document.cookie.split(';');

    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.startsWith(fullName)) {
        return decodeURIComponent(cookie.substring(fullName.length));
      }
    }
    return null;
  }

  /**
   * Delete a cookie
   */
  static delete(name, options = {}) {
    this.set(name, '', {
      ...options,
      expires: new Date(0),
    });
  }

  /**
   * Check if cookies are enabled
   */
  static isEnabled() {
    if (typeof document === 'undefined') return false;
    
    try {
      document.cookie = 'mfe_test=1; samesite=strict';
      const enabled = document.cookie.includes('mfe_test=1');
      document.cookie = 'mfe_test=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      return enabled;
    } catch {
      return false;
    }
  }
}

/**
 * Input Sanitizer
 */
class InputSanitizer {
  /**
   * Escape HTML entities
   */
  static escapeHtml(str) {
    if (typeof str !== 'string') return str;
    
    const htmlEntities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;',
    };
    
    return str.replace(/[&<>"'`=/]/g, char => htmlEntities[char]);
  }

  /**
   * Sanitize for URL
   */
  static sanitizeUrl(url) {
    if (typeof url !== 'string') return '';
    
    // Only allow http, https, and relative URLs
    const cleaned = url.trim().toLowerCase();
    if (cleaned.startsWith('javascript:') || 
        cleaned.startsWith('data:') || 
        cleaned.startsWith('vbscript:')) {
      logger.warn('Blocked potentially dangerous URL', { url });
      return '';
    }
    
    return url;
  }

  /**
   * Sanitize object recursively
   */
  static sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return typeof obj === 'string' ? this.escapeHtml(obj) : obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[this.escapeHtml(key)] = this.sanitizeObject(value);
    }
    return sanitized;
  }

  /**
   * Strip HTML tags
   */
  static stripTags(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/<[^>]*>/g, '');
  }

  /**
   * Validate email format
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate URL format
   */
  static isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Subresource Integrity Helper
 */
class SRIHelper {
  /**
   * Generate SRI hash for content
   */
  static async generateHash(content, algorithm = 'sha384') {
    const hashValue = await hash(content);
    return `${algorithm}-${hashValue}`;
  }

  /**
   * Create script tag with SRI
   */
  static createScriptTag(src, integrity, crossOrigin = 'anonymous') {
    const script = document.createElement('script');
    script.src = src;
    script.integrity = integrity;
    script.crossOrigin = crossOrigin;
    return script;
  }

  /**
   * Create link tag with SRI
   */
  static createLinkTag(href, integrity, rel = 'stylesheet', crossOrigin = 'anonymous') {
    const link = document.createElement('link');
    link.href = href;
    link.rel = rel;
    link.integrity = integrity;
    link.crossOrigin = crossOrigin;
    return link;
  }
}

/**
 * Security Audit Helper
 */
class SecurityAudit {
  /**
   * Run security checks
   */
  static run() {
    const issues = [];

    // Check HTTPS
    if (typeof window !== 'undefined' && window.location.protocol !== 'https:') {
      if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        issues.push({
          severity: 'high',
          issue: 'Not using HTTPS',
          recommendation: 'Enable HTTPS for all production traffic',
        });
      }
    }

    // Check cookies
    if (!SecureCookieManager.isEnabled()) {
      issues.push({
        severity: 'medium',
        issue: 'Cookies disabled',
        recommendation: 'Some features may not work without cookies',
      });
    }

    // Check localStorage availability
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
    } catch {
      issues.push({
        severity: 'medium',
        issue: 'localStorage not available',
        recommendation: 'Storage features may be limited',
      });
    }

    // Check for common security headers (if accessible)
    if (typeof document !== 'undefined') {
      const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      if (!cspMeta) {
        issues.push({
          severity: 'medium',
          issue: 'No CSP meta tag found',
          recommendation: 'Add Content-Security-Policy for XSS protection',
        });
      }
    }

    return {
      timestamp: new Date().toISOString(),
      issueCount: issues.length,
      issues,
      passed: issues.filter(i => i.severity === 'high').length === 0,
    };
  }
}

// Create instances
const cspManager = new CSPManager();
const csrfProtection = new CSRFProtection();

// Export
export {
  CSPManager,
  CSRFProtection,
  SecureCookieManager,
  InputSanitizer,
  SRIHelper,
  SecurityAudit,
  cspManager,
  csrfProtection,
  SECURITY_CONFIG,
};

export default {
  cspManager,
  csrfProtection,
  SecureCookieManager,
  InputSanitizer,
  SRIHelper,
  SecurityAudit,
};
