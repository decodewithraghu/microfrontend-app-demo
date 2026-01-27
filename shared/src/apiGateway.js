/**
 * API Gateway / Backend for Frontend (BFF) Layer
 * 
 * Features:
 * - Centralized API request handling
 * - Request/Response caching with TTL
 * - Automatic retry with exponential backoff
 * - Request deduplication
 * - Circuit breaker pattern
 * - Request timeout handling
 * - Response transformation
 * - Error normalization
 * - Request interceptors
 * - Performance tracking
 */

import { generateSecureId } from './crypto.js';
import performanceMonitor from './performanceMonitor.js';
import logger from './logger.js';

// API Configuration
const API_CONFIG = {
  defaultTimeout: 30000, // 30 seconds
  maxRetries: 3,
  retryDelay: 1000, // Base delay in ms
  cacheTTL: 5 * 60 * 1000, // 5 minutes default cache
  circuitBreakerThreshold: 5, // Failures before opening circuit
  circuitBreakerTimeout: 30000, // Time before half-open state
};

// External API endpoints
export const API_ENDPOINTS = {
  REST_COUNTRIES: {
    base: 'https://restcountries.com/v3.1',
    all: '/all',
    byCode: (code) => `/alpha/${code}`,
    byName: (name) => `/name/${name}`,
  },
  OPEN_METEO: {
    base: 'https://api.open-meteo.com/v1',
    forecast: '/forecast',
  },
  WORLD_BANK: {
    base: 'https://api.worldbank.org/v2',
    population: (code) => `/country/${code}/indicator/SP.POP.TOTL`,
  },
};

/**
 * Request Cache with TTL
 */
class RequestCache {
  constructor() {
    this._cache = new Map();
    this._cleanupInterval = null;
    this._startCleanup();
  }

  _startCleanup() {
    this._cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this._cache.entries()) {
        if (now > entry.expiresAt) {
          this._cache.delete(key);
        }
      }
    }, 60000); // Cleanup every minute
  }

  generateKey(url, options = {}) {
    const { method = 'GET', body } = options;
    return `${method}:${url}:${body ? JSON.stringify(body) : ''}`;
  }

  get(key) {
    const entry = this._cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this._cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set(key, data, ttl = API_CONFIG.cacheTTL) {
    this._cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
    });
  }

  invalidate(pattern) {
    if (typeof pattern === 'string') {
      this._cache.delete(pattern);
    } else if (pattern instanceof RegExp) {
      for (const key of this._cache.keys()) {
        if (pattern.test(key)) {
          this._cache.delete(key);
        }
      }
    }
  }

  clear() {
    this._cache.clear();
  }

  getStats() {
    return {
      size: this._cache.size,
      entries: Array.from(this._cache.entries()).map(([key, entry]) => ({
        key,
        expiresAt: entry.expiresAt,
        age: Date.now() - entry.createdAt,
      })),
    };
  }

  destroy() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
    }
    this._cache.clear();
  }
}

/**
 * Circuit Breaker for fault tolerance
 */
class CircuitBreaker {
  constructor(options = {}) {
    this._states = new Map(); // endpoint -> state
    this._threshold = options.threshold || API_CONFIG.circuitBreakerThreshold;
    this._timeout = options.timeout || API_CONFIG.circuitBreakerTimeout;
  }

  _getState(endpoint) {
    if (!this._states.has(endpoint)) {
      this._states.set(endpoint, {
        status: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
        failures: 0,
        lastFailure: null,
        successCount: 0,
      });
    }
    return this._states.get(endpoint);
  }

  canRequest(endpoint) {
    const state = this._getState(endpoint);
    
    if (state.status === 'CLOSED') {
      return true;
    }
    
    if (state.status === 'OPEN') {
      // Check if timeout has passed
      if (Date.now() - state.lastFailure > this._timeout) {
        state.status = 'HALF_OPEN';
        state.successCount = 0;
        return true;
      }
      return false;
    }
    
    // HALF_OPEN - allow limited requests
    return true;
  }

  recordSuccess(endpoint) {
    const state = this._getState(endpoint);
    
    if (state.status === 'HALF_OPEN') {
      state.successCount++;
      // After 3 successful requests, close the circuit
      if (state.successCount >= 3) {
        state.status = 'CLOSED';
        state.failures = 0;
      }
    } else {
      state.failures = 0;
    }
  }

  recordFailure(endpoint) {
    const state = this._getState(endpoint);
    state.failures++;
    state.lastFailure = Date.now();
    
    if (state.failures >= this._threshold) {
      state.status = 'OPEN';
      logger.warn('Circuit breaker opened', { endpoint, failures: state.failures });
    }
  }

  getStatus(endpoint) {
    return this._getState(endpoint);
  }

  reset(endpoint) {
    this._states.delete(endpoint);
  }
}

/**
 * Request Deduplicator
 */
class RequestDeduplicator {
  constructor() {
    this._pending = new Map();
  }

  async dedupe(key, requestFn) {
    if (this._pending.has(key)) {
      return this._pending.get(key);
    }

    const promise = requestFn().finally(() => {
      this._pending.delete(key);
    });

    this._pending.set(key, promise);
    return promise;
  }
}

/**
 * Main API Gateway Class
 */
class APIGateway {
  constructor() {
    this._cache = new RequestCache();
    this._circuitBreaker = new CircuitBreaker();
    this._deduplicator = new RequestDeduplicator();
    this._interceptors = {
      request: [],
      response: [],
      error: [],
    };
    this._defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(interceptor) {
    this._interceptors.request.push(interceptor);
    return () => {
      const index = this._interceptors.request.indexOf(interceptor);
      if (index > -1) this._interceptors.request.splice(index, 1);
    };
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(interceptor) {
    this._interceptors.response.push(interceptor);
    return () => {
      const index = this._interceptors.response.indexOf(interceptor);
      if (index > -1) this._interceptors.response.splice(index, 1);
    };
  }

  /**
   * Add error interceptor
   */
  addErrorInterceptor(interceptor) {
    this._interceptors.error.push(interceptor);
    return () => {
      const index = this._interceptors.error.indexOf(interceptor);
      if (index > -1) this._interceptors.error.splice(index, 1);
    };
  }

  /**
   * Run request interceptors
   */
  async _runRequestInterceptors(config) {
    let processedConfig = { ...config };
    for (const interceptor of this._interceptors.request) {
      processedConfig = await interceptor(processedConfig);
    }
    return processedConfig;
  }

  /**
   * Run response interceptors
   */
  async _runResponseInterceptors(response, config) {
    let processedResponse = response;
    for (const interceptor of this._interceptors.response) {
      processedResponse = await interceptor(processedResponse, config);
    }
    return processedResponse;
  }

  /**
   * Run error interceptors
   */
  async _runErrorInterceptors(error, config) {
    let processedError = error;
    for (const interceptor of this._interceptors.error) {
      processedError = await interceptor(processedError, config);
    }
    return processedError;
  }

  /**
   * Execute fetch with timeout
   */
  async _fetchWithTimeout(url, options, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Sleep utility for retry delays
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Main request method with all features
   */
  async request(url, options = {}) {
    const requestId = generateSecureId(8);
    const startTime = performance.now();
    
    const config = {
      url,
      method: options.method || 'GET',
      headers: { ...this._defaultHeaders, ...options.headers },
      body: options.body,
      timeout: options.timeout || API_CONFIG.defaultTimeout,
      retries: options.retries ?? API_CONFIG.maxRetries,
      cache: options.cache ?? true,
      cacheTTL: options.cacheTTL || API_CONFIG.cacheTTL,
      dedupe: options.dedupe ?? true,
      requestId,
    };

    // Run request interceptors
    const processedConfig = await this._runRequestInterceptors(config);
    const { url: finalUrl, ...fetchOptions } = processedConfig;

    // Check circuit breaker
    const endpoint = new URL(finalUrl).hostname;
    if (!this._circuitBreaker.canRequest(endpoint)) {
      const error = new Error(`Circuit breaker open for ${endpoint}`);
      error.code = 'CIRCUIT_OPEN';
      throw error;
    }

    // Check cache for GET requests
    const cacheKey = this._cache.generateKey(finalUrl, processedConfig);
    if (processedConfig.method === 'GET' && processedConfig.cache) {
      const cached = this._cache.get(cacheKey);
      if (cached) {
        logger.debug('Cache hit', { url: finalUrl, requestId });
        performanceMonitor.recordMetric('api_cache_hit', 1, { url: finalUrl });
        return cached;
      }
    }

    // Deduplicate concurrent requests
    const requestFn = async () => {
      let lastError;
      
      for (let attempt = 0; attempt <= processedConfig.retries; attempt++) {
        try {
          if (attempt > 0) {
            const delay = API_CONFIG.retryDelay * Math.pow(2, attempt - 1);
            logger.debug('Retrying request', { url: finalUrl, attempt, delay });
            await this._sleep(delay);
          }

          const response = await this._fetchWithTimeout(
            finalUrl,
            {
              method: processedConfig.method,
              headers: processedConfig.headers,
              body: processedConfig.body ? JSON.stringify(processedConfig.body) : undefined,
            },
            processedConfig.timeout
          );

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          
          // Record success
          this._circuitBreaker.recordSuccess(endpoint);
          
          // Cache successful GET responses
          if (processedConfig.method === 'GET' && processedConfig.cache) {
            this._cache.set(cacheKey, data, processedConfig.cacheTTL);
          }

          // Record metrics
          const duration = performance.now() - startTime;
          performanceMonitor.recordMetric('api_request_duration', duration, {
            url: finalUrl,
            method: processedConfig.method,
            status: response.status,
          });

          // Run response interceptors
          return await this._runResponseInterceptors(data, processedConfig);
          
        } catch (error) {
          lastError = error;
          logger.warn('Request failed', { 
            url: finalUrl, 
            attempt, 
            error: error.message,
            requestId,
          });
          
          // Don't retry on client errors (4xx)
          if (error.message.includes('HTTP 4')) {
            break;
          }
        }
      }

      // All retries exhausted
      this._circuitBreaker.recordFailure(endpoint);
      
      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric('api_request_error', 1, {
        url: finalUrl,
        method: processedConfig.method,
        error: lastError.message,
      });

      // Run error interceptors
      const processedError = await this._runErrorInterceptors(lastError, processedConfig);
      throw processedError;
    };

    // Dedupe if enabled
    if (processedConfig.dedupe && processedConfig.method === 'GET') {
      return this._deduplicator.dedupe(cacheKey, requestFn);
    }

    return requestFn();
  }

  /**
   * Convenience methods
   */
  get(url, options = {}) {
    return this.request(url, { ...options, method: 'GET' });
  }

  post(url, body, options = {}) {
    return this.request(url, { ...options, method: 'POST', body });
  }

  put(url, body, options = {}) {
    return this.request(url, { ...options, method: 'PUT', body });
  }

  delete(url, options = {}) {
    return this.request(url, { ...options, method: 'DELETE' });
  }

  /**
   * Specialized API methods
   */
  
  // REST Countries API
  async getCountries(fields = null) {
    let url = `${API_ENDPOINTS.REST_COUNTRIES.base}${API_ENDPOINTS.REST_COUNTRIES.all}`;
    if (fields) {
      url += `?fields=${fields.join(',')}`;
    }
    return this.get(url, { cacheTTL: 30 * 60 * 1000 }); // 30 min cache
  }

  async getCountryByCode(code, fields = null) {
    let url = `${API_ENDPOINTS.REST_COUNTRIES.base}${API_ENDPOINTS.REST_COUNTRIES.byCode(code)}`;
    if (fields) {
      url += `?fields=${fields.join(',')}`;
    }
    return this.get(url, { cacheTTL: 30 * 60 * 1000 });
  }

  // Open-Meteo Weather API
  async getWeather(lat, lon, options = {}) {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current_weather: 'true',
      hourly: options.hourly || 'temperature_2m,weathercode',
      daily: options.daily || 'weathercode,temperature_2m_max,temperature_2m_min',
      timezone: options.timezone || 'auto',
      forecast_days: options.forecastDays || 7,
    });
    
    const url = `${API_ENDPOINTS.OPEN_METEO.base}${API_ENDPOINTS.OPEN_METEO.forecast}?${params}`;
    return this.get(url, { cacheTTL: 10 * 60 * 1000 }); // 10 min cache for weather
  }

  // World Bank Population API
  async getPopulation(countryCode, perPage = 20) {
    const url = `${API_ENDPOINTS.WORLD_BANK.base}${API_ENDPOINTS.WORLD_BANK.population(countryCode)}?format=json&per_page=${perPage}`;
    return this.get(url, { cacheTTL: 60 * 60 * 1000 }); // 1 hour cache
  }

  /**
   * Cache management
   */
  invalidateCache(pattern) {
    this._cache.invalidate(pattern);
  }

  clearCache() {
    this._cache.clear();
  }

  getCacheStats() {
    return this._cache.getStats();
  }

  /**
   * Circuit breaker management
   */
  getCircuitStatus(endpoint) {
    return this._circuitBreaker.getStatus(endpoint);
  }

  resetCircuit(endpoint) {
    this._circuitBreaker.reset(endpoint);
  }
}

// Singleton instance
const apiGateway = new APIGateway();

// Export factory function
export const createAPIGateway = () => new APIGateway();

export default apiGateway;
