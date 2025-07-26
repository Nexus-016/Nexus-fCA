"use strict";

/**
 * Nexus-FCA Performance Manager
 * Handles caching, memory optimization, and performance monitoring
 */

const EventEmitter = require('events');
const logger = require('../logger');

class PerformanceManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      enableCache: options.enableCache !== false,
      cacheSize: options.cacheSize || 1000,
      cacheTTL: options.cacheTTL || 300000, // 5 minutes
      enableMetrics: options.enableMetrics !== false,
      gcInterval: options.gcInterval || 60000, // 1 minute
      ...options
    };

    this.cache = new Map();
    this.metrics = {
      requests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      avgResponseTime: 0,
      memoryUsage: 0
    };

    this.requestTimes = [];
    this.lastGC = Date.now();

    if (this.options.enableMetrics) {
      this.startMetricsCollection();
    }
  }

  /**
   * Cache management
   */
  setCacheItem(key, value, ttl = this.options.cacheTTL) {
    if (!this.options.enableCache) return;

    // Cleanup old entries if cache is full
    if (this.cache.size >= this.options.cacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });
  }

  getCacheItem(key) {
    if (!this.options.enableCache) return null;

    const item = this.cache.get(key);
    if (!item) {
      this.metrics.cacheMisses++;
      return null;
    }

    // Check TTL
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      this.metrics.cacheMisses++;
      return null;
    }

    this.metrics.cacheHits++;
    return item.value;
  }

  clearCache() {
    this.cache.clear();
    logger('Cache cleared', 'info');
  }

  /**
   * Request tracking
   */
  trackRequest(startTime) {
    const responseTime = Date.now() - startTime;
    this.requestTimes.push(responseTime);
    this.metrics.requests++;

    // Keep only last 100 requests for average calculation
    if (this.requestTimes.length > 100) {
      this.requestTimes.shift();
    }

    // Update average response time
    this.metrics.avgResponseTime = 
      this.requestTimes.reduce((a, b) => a + b, 0) / this.requestTimes.length;
  }

  trackError() {
    this.metrics.errors++;
  }

  /**
   * Memory optimization
   */
  optimizeMemory() {
    const now = Date.now();
    
    // Clean expired cache entries
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }

    // Force garbage collection if available
    if (global.gc && now - this.lastGC > this.options.gcInterval) {
      global.gc();
      this.lastGC = now;
    }

    // Update memory usage
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = memUsage.heapUsed;

    this.emit('memoryOptimized', this.metrics);
  }

  /**
   * Metrics collection
   */
  startMetricsCollection() {
    setInterval(() => {
      this.optimizeMemory();
      this.emit('metricsUpdate', this.getMetrics());
    }, 30000); // Every 30 seconds
  }

  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0,
      memoryUsageMB: Math.round(this.metrics.memoryUsage / 1024 / 1024 * 100) / 100
    };
  }

  /**
   * Performance wrapper for functions
   */
  wrapFunction(fn, cacheKey = null) {
    return async (...args) => {
      const startTime = Date.now();
      
      try {
        // Check cache first
        if (cacheKey) {
          const cached = this.getCacheItem(cacheKey);
          if (cached) {
            this.trackRequest(startTime);
            return cached;
          }
        }

        const result = await fn(...args);
        
        // Cache result if key provided
        if (cacheKey && result) {
          this.setCacheItem(cacheKey, result);
        }

        this.trackRequest(startTime);
        return result;
      } catch (error) {
        this.trackError();
        this.trackRequest(startTime);
        throw error;
      }
    };
  }

  /**
   * Rate limiting
   */
  createRateLimiter(maxRequests = 10, windowMs = 60000) {
    const requests = new Map();

    return (identifier) => {
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean old requests
      for (const [id, timestamps] of requests.entries()) {
        requests.set(id, timestamps.filter(t => t > windowStart));
        if (requests.get(id).length === 0) {
          requests.delete(id);
        }
      }

      // Check current user requests
      const userRequests = requests.get(identifier) || [];
      if (userRequests.length >= maxRequests) {
        return false; // Rate limited
      }

      // Add current request
      userRequests.push(now);
      requests.set(identifier, userRequests);
      return true; // Allowed
    };
  }
}

module.exports = PerformanceManager;
