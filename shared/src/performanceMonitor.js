/**
 * Performance Monitoring Service
 * 
 * Features:
 * - Web Vitals tracking (LCP, FID, CLS, FCP, TTFB)
 * - Custom metrics recording
 * - Resource timing analysis
 * - Long task detection
 * - Memory monitoring
 * - Network performance tracking
 * - MFE load time tracking
 * - Real-time performance alerts
 */

import { generateSecureId } from './crypto.js';

// Performance Thresholds (based on Web Vitals recommendations)
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 }, // Largest Contentful Paint
  FID: { good: 100, poor: 300 },   // First Input Delay
  CLS: { good: 0.1, poor: 0.25 },  // Cumulative Layout Shift
  FCP: { good: 1800, poor: 3000 }, // First Contentful Paint
  TTFB: { good: 800, poor: 1800 }, // Time to First Byte
  INP: { good: 200, poor: 500 },   // Interaction to Next Paint
};

// Rating function
const getRating = (metric, value) => {
  const threshold = THRESHOLDS[metric];
  if (!threshold) return 'unknown';
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
};

/**
 * Performance Entry
 */
class PerformanceEntry {
  constructor(name, value, tags = {}) {
    this.id = generateSecureId(8);
    this.timestamp = Date.now();
    this.name = name;
    this.value = value;
    this.tags = tags;
    this.rating = THRESHOLDS[name] ? getRating(name, value) : null;
  }

  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      name: this.name,
      value: this.value,
      tags: this.tags,
      rating: this.rating,
    };
  }
}

/**
 * MFE Load Tracker
 */
class MFELoadTracker {
  constructor() {
    this._loads = new Map();
  }

  startLoad(mfeName) {
    this._loads.set(mfeName, {
      startTime: performance.now(),
      status: 'loading',
    });
  }

  endLoad(mfeName, success = true) {
    const load = this._loads.get(mfeName);
    if (!load) return null;

    const duration = performance.now() - load.startTime;
    load.endTime = performance.now();
    load.duration = duration;
    load.status = success ? 'loaded' : 'failed';

    return {
      mfeName,
      duration,
      success,
    };
  }

  getLoadTime(mfeName) {
    const load = this._loads.get(mfeName);
    return load?.duration || null;
  }

  getAllLoadTimes() {
    const result = {};
    this._loads.forEach((load, name) => {
      result[name] = {
        duration: load.duration,
        status: load.status,
      };
    });
    return result;
  }
}

/**
 * Main Performance Monitor Class
 */
class PerformanceMonitor {
  constructor() {
    this._metrics = [];
    this._observers = [];
    this._listeners = [];
    this._mfeTracker = new MFELoadTracker();
    this._maxMetrics = 1000;
    this._sessionId = generateSecureId(16);
    
    // Initialize observers
    if (typeof window !== 'undefined') {
      this._initializeObservers();
      this._trackNavigationTiming();
    }
  }

  /**
   * Initialize Performance Observers
   */
  _initializeObservers() {
    // Long Task Observer
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            this.recordMetric('long-task', entry.duration, {
              name: entry.name,
              startTime: entry.startTime,
            });
          });
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this._observers.push(longTaskObserver);
      } catch (e) {
        console.debug('Long task observer not supported');
      }

      // Largest Contentful Paint
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.recordMetric('LCP', lastEntry.startTime, {
            element: lastEntry.element?.tagName,
            size: lastEntry.size,
          });
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this._observers.push(lcpObserver);
      } catch (e) {
        console.debug('LCP observer not supported');
      }

      // First Input Delay
      try {
        const fidObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            this.recordMetric('FID', entry.processingStart - entry.startTime, {
              name: entry.name,
            });
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
        this._observers.push(fidObserver);
      } catch (e) {
        console.debug('FID observer not supported');
      }

      // Cumulative Layout Shift
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          this.recordMetric('CLS', clsValue);
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this._observers.push(clsObserver);
      } catch (e) {
        console.debug('CLS observer not supported');
      }

      // Resource Timing
      try {
        const resourceObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.initiatorType === 'script' && entry.name.includes('remoteEntry')) {
              this.recordMetric('mfe-script-load', entry.duration, {
                url: entry.name,
                transferSize: entry.transferSize,
              });
            }
          });
        });
        resourceObserver.observe({ entryTypes: ['resource'] });
        this._observers.push(resourceObserver);
      } catch (e) {
        console.debug('Resource observer not supported');
      }
    }
  }

  /**
   * Track Navigation Timing
   */
  _trackNavigationTiming() {
    if (window.performance && window.performance.timing) {
      // Wait for load event
      window.addEventListener('load', () => {
        setTimeout(() => {
          const timing = performance.timing;
          const navigation = performance.getEntriesByType('navigation')[0];

          if (navigation) {
            this.recordMetric('TTFB', navigation.responseStart);
            this.recordMetric('FCP', navigation.domContentLoadedEventEnd);
            this.recordMetric('page-load', navigation.loadEventEnd);
            this.recordMetric('dom-interactive', navigation.domInteractive);
            this.recordMetric('dns-lookup', navigation.domainLookupEnd - navigation.domainLookupStart);
            this.recordMetric('tcp-connect', navigation.connectEnd - navigation.connectStart);
          }
        }, 0);
      });
    }
  }

  /**
   * Record a custom metric
   */
  recordMetric(name, value, tags = {}) {
    const entry = new PerformanceEntry(name, value, {
      ...tags,
      sessionId: this._sessionId,
    });

    this._metrics.push(entry);
    
    // Trim old metrics
    if (this._metrics.length > this._maxMetrics) {
      this._metrics = this._metrics.slice(-this._maxMetrics);
    }

    // Notify listeners
    this._notifyListeners(entry);

    // Check for poor performance
    if (entry.rating === 'poor') {
      console.warn(`Poor performance detected: ${name} = ${value}`, tags);
    }

    return entry;
  }

  /**
   * Add metric listener
   */
  addListener(listener) {
    this._listeners.push(listener);
    return () => {
      const index = this._listeners.indexOf(listener);
      if (index > -1) this._listeners.splice(index, 1);
    };
  }

  /**
   * Notify listeners
   */
  _notifyListeners(entry) {
    this._listeners.forEach(listener => {
      try {
        listener(entry);
      } catch (e) {
        console.error('Performance listener error:', e);
      }
    });
  }

  /**
   * Start timing an operation
   */
  startTimer(name) {
    const startTime = performance.now();
    return {
      name,
      startTime,
      end: (tags = {}) => {
        const duration = performance.now() - startTime;
        this.recordMetric(name, duration, tags);
        return duration;
      },
    };
  }

  /**
   * MFE Load Tracking
   */
  startMFELoad(mfeName) {
    this._mfeTracker.startLoad(mfeName);
    this.recordMetric('mfe-load-start', performance.now(), { mfeName });
  }

  endMFELoad(mfeName, success = true) {
    const result = this._mfeTracker.endLoad(mfeName, success);
    if (result) {
      this.recordMetric('mfe-load-complete', result.duration, {
        mfeName,
        success,
      });
    }
    return result;
  }

  getMFELoadTimes() {
    return this._mfeTracker.getAllLoadTimes();
  }

  /**
   * Get memory info (Chrome only)
   */
  getMemoryInfo() {
    if (performance.memory) {
      return {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        usagePercentage: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100,
      };
    }
    return null;
  }

  /**
   * Get all metrics
   */
  getMetrics(filter = {}) {
    let result = [...this._metrics];

    if (filter.name) {
      result = result.filter(m => m.name === filter.name);
    }
    if (filter.rating) {
      result = result.filter(m => m.rating === filter.rating);
    }
    if (filter.since) {
      result = result.filter(m => m.timestamp >= filter.since);
    }

    return result;
  }

  /**
   * Get Web Vitals summary
   */
  getWebVitals() {
    const vitals = ['LCP', 'FID', 'CLS', 'FCP', 'TTFB'];
    const result = {};

    vitals.forEach(vital => {
      const metrics = this._metrics.filter(m => m.name === vital);
      if (metrics.length > 0) {
        const latest = metrics[metrics.length - 1];
        result[vital] = {
          value: latest.value,
          rating: latest.rating,
          timestamp: latest.timestamp,
        };
      }
    });

    return result;
  }

  /**
   * Get performance summary
   */
  getSummary() {
    const webVitals = this.getWebVitals();
    const mfeLoads = this.getMFELoadTimes();
    const memory = this.getMemoryInfo();

    return {
      sessionId: this._sessionId,
      webVitals,
      mfeLoads,
      memory,
      totalMetrics: this._metrics.length,
      poorMetrics: this._metrics.filter(m => m.rating === 'poor').length,
    };
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics() {
    return {
      sessionId: this._sessionId,
      exportedAt: new Date().toISOString(),
      metrics: this._metrics.map(m => m.toJSON()),
      summary: this.getSummary(),
    };
  }

  /**
   * Clear metrics
   */
  clearMetrics() {
    this._metrics = [];
  }

  /**
   * Cleanup
   */
  destroy() {
    this._observers.forEach(observer => observer.disconnect());
    this._observers = [];
    this._listeners = [];
  }
}

// Singleton instance
const performanceMonitor = new PerformanceMonitor();

// Export factory function
export const createPerformanceMonitor = () => new PerformanceMonitor();

export { THRESHOLDS, getRating };
export default performanceMonitor;
