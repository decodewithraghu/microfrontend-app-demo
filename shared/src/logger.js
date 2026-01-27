/**
 * Centralized Logging Service
 * 
 * Features:
 * - Multiple log levels (debug, info, warn, error)
 * - Structured logging with context
 * - Log aggregation and batching
 * - Remote log shipping (configurable)
 * - Performance metrics integration
 * - Error tracking integration
 * - Log filtering and sampling
 * - Correlation ID tracking
 */

import { generateSecureId } from './crypto.js';

// Log Levels
export const LogLevel = Object.freeze({
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4,
  SILENT: 5,
});

// Log Level Names
const LOG_LEVEL_NAMES = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL', 'SILENT'];

// Configuration
const LOGGER_CONFIG = {
  level: LogLevel.INFO,
  enableConsole: true,
  enableRemote: false,
  remoteEndpoint: null,
  batchSize: 10,
  batchInterval: 5000, // 5 seconds
  maxLogSize: 10000,
  sampleRate: 1.0, // 1.0 = log everything
  includeTimestamp: true,
  includeStackTrace: true,
  correlationIdHeader: 'x-correlation-id',
};

/**
 * Log Entry structure
 */
class LogEntry {
  constructor(level, message, context = {}, error = null) {
    this.id = generateSecureId(8);
    this.timestamp = new Date().toISOString();
    this.level = level;
    this.levelName = LOG_LEVEL_NAMES[level];
    this.message = message;
    this.context = context;
    this.error = error ? this._serializeError(error) : null;
    this.correlationId = context.correlationId || Logger._correlationId;
    this.sessionId = Logger._sessionId;
    this.url = typeof window !== 'undefined' ? window.location.href : null;
    this.userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
  }

  _serializeError(error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
    };
  }

  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      level: this.levelName,
      message: this.message,
      context: this.context,
      error: this.error,
      correlationId: this.correlationId,
      sessionId: this.sessionId,
      url: this.url,
    };
  }
}

/**
 * Main Logger Class
 */
class Logger {
  static _correlationId = null;
  static _sessionId = generateSecureId(16);
  
  constructor(config = {}) {
    this._config = { ...LOGGER_CONFIG, ...config };
    this._logBuffer = [];
    this._listeners = [];
    this._flushTimer = null;
    
    // Start batch flush timer if remote logging is enabled
    if (this._config.enableRemote) {
      this._startBatchFlush();
    }
    
    // Global error handler
    if (typeof window !== 'undefined') {
      this._setupGlobalErrorHandlers();
    }
  }

  /**
   * Setup global error handlers
   */
  _setupGlobalErrorHandlers() {
    window.addEventListener('error', (event) => {
      this.error('Uncaught error', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      }, event.error);
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled promise rejection', {
        reason: event.reason?.message || String(event.reason),
      }, event.reason instanceof Error ? event.reason : null);
    });
  }

  /**
   * Set correlation ID for request tracking
   */
  static setCorrelationId(id) {
    Logger._correlationId = id;
  }

  /**
   * Generate new correlation ID
   */
  static generateCorrelationId() {
    Logger._correlationId = generateSecureId(16);
    return Logger._correlationId;
  }

  /**
   * Get current correlation ID
   */
  static getCorrelationId() {
    return Logger._correlationId;
  }

  /**
   * Set log level
   */
  setLevel(level) {
    this._config.level = level;
  }

  /**
   * Add log listener
   */
  addListener(listener) {
    this._listeners.push(listener);
    return () => {
      const index = this._listeners.indexOf(listener);
      if (index > -1) this._listeners.splice(index, 1);
    };
  }

  /**
   * Check if should log based on level and sampling
   */
  _shouldLog(level) {
    if (level < this._config.level) return false;
    if (this._config.sampleRate < 1.0) {
      return Math.random() < this._config.sampleRate;
    }
    return true;
  }

  /**
   * Internal log method
   */
  _log(level, message, context = {}, error = null) {
    if (!this._shouldLog(level)) return;

    const entry = new LogEntry(level, message, context, error);
    
    // Console output
    if (this._config.enableConsole) {
      this._consoleLog(entry);
    }
    
    // Notify listeners
    this._listeners.forEach(listener => {
      try {
        listener(entry);
      } catch (e) {
        console.error('Log listener error:', e);
      }
    });
    
    // Buffer for remote shipping
    if (this._config.enableRemote) {
      this._logBuffer.push(entry);
      if (this._logBuffer.length >= this._config.batchSize) {
        this._flushLogs();
      }
    }
    
    return entry;
  }

  /**
   * Console log with formatting
   */
  _consoleLog(entry) {
    const prefix = `[${entry.timestamp}] [${entry.levelName}]`;
    const contextStr = Object.keys(entry.context).length > 0 
      ? JSON.stringify(entry.context) 
      : '';
    
    const args = [
      `${prefix} ${entry.message}`,
      contextStr,
      entry.error?.stack || '',
    ].filter(Boolean);

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(...args);
        break;
      case LogLevel.INFO:
        console.info(...args);
        break;
      case LogLevel.WARN:
        console.warn(...args);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(...args);
        break;
    }
  }

  /**
   * Start batch flush timer
   */
  _startBatchFlush() {
    this._flushTimer = setInterval(() => {
      if (this._logBuffer.length > 0) {
        this._flushLogs();
      }
    }, this._config.batchInterval);
  }

  /**
   * Flush logs to remote endpoint
   */
  async _flushLogs() {
    if (!this._config.remoteEndpoint || this._logBuffer.length === 0) return;
    
    const logsToSend = [...this._logBuffer];
    this._logBuffer = [];
    
    try {
      await fetch(this._config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [this._config.correlationIdHeader]: Logger._correlationId || '',
        },
        body: JSON.stringify({ logs: logsToSend.map(l => l.toJSON()) }),
      });
    } catch (error) {
      // Re-add logs to buffer on failure (with limit)
      if (this._logBuffer.length < this._config.maxLogSize) {
        this._logBuffer.unshift(...logsToSend);
      }
      console.error('Failed to ship logs:', error);
    }
  }

  /**
   * Public logging methods
   */
  debug(message, context = {}) {
    return this._log(LogLevel.DEBUG, message, context);
  }

  info(message, context = {}) {
    return this._log(LogLevel.INFO, message, context);
  }

  warn(message, context = {}, error = null) {
    return this._log(LogLevel.WARN, message, context, error);
  }

  error(message, context = {}, error = null) {
    return this._log(LogLevel.ERROR, message, context, error);
  }

  fatal(message, context = {}, error = null) {
    return this._log(LogLevel.FATAL, message, context, error);
  }

  /**
   * Create child logger with preset context
   */
  child(defaultContext = {}) {
    const parentLogger = this;
    return {
      debug: (msg, ctx = {}) => parentLogger.debug(msg, { ...defaultContext, ...ctx }),
      info: (msg, ctx = {}) => parentLogger.info(msg, { ...defaultContext, ...ctx }),
      warn: (msg, ctx = {}, err) => parentLogger.warn(msg, { ...defaultContext, ...ctx }, err),
      error: (msg, ctx = {}, err) => parentLogger.error(msg, { ...defaultContext, ...ctx }, err),
      fatal: (msg, ctx = {}, err) => parentLogger.fatal(msg, { ...defaultContext, ...ctx }, err),
    };
  }

  /**
   * Measure and log execution time
   */
  time(label) {
    const start = performance.now();
    return {
      end: (context = {}) => {
        const duration = performance.now() - start;
        this.debug(`${label} completed`, { ...context, duration: `${duration.toFixed(2)}ms` });
        return duration;
      },
    };
  }

  /**
   * Get buffered logs
   */
  getBufferedLogs() {
    return [...this._logBuffer];
  }

  /**
   * Configure logger
   */
  configure(config) {
    this._config = { ...this._config, ...config };
    
    if (config.enableRemote && !this._flushTimer) {
      this._startBatchFlush();
    } else if (!config.enableRemote && this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
    }
    this._flushLogs(); // Final flush
    this._listeners = [];
  }
}

// Singleton instance
const logger = new Logger();

// Export factory function
export const createLogger = (config) => new Logger(config);

export default logger;
