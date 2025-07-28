"use strict";

// Nexus-FCA: Performance Optimization Module
// Memory management, request optimization, and performance monitoring

const logger = require('../logger');
const { DatabaseManager } = require('../database/DatabaseManager');

class PerformanceOptimizer {
    constructor() {
        this.metrics = {
            requests: {
                total: 0,
                successful: 0,
                failed: 0,
                averageResponseTime: 0
            },
            memory: {
                heapUsed: 0,
                heapTotal: 0,
                external: 0,
                rss: 0
            },
            cache: {
                hits: 0,
                misses: 0,
                size: 0
            },
            mqtt: {
                messagesReceived: 0,
                messagesSent: 0,
                reconnections: 0
            }
        };

        this.requestTimes = [];
        this.maxRequestTimesSample = 1000;
        this.optimizations = new Map();
        this.thresholds = {
            memoryUsage: 500 * 1024 * 1024, // 500MB
            responseTime: 5000, // 5 seconds
            cacheHitRate: 0.8, // 80%
            reconnectionRate: 0.1 // 10%
        };

        // Request queue COMPLETELY DISABLED for maximum safety
        this.requestQueue = [];
        this.processing = false;
        this.maxConcurrentRequests = Number.MAX_SAFE_INTEGER; // Unlimited for maximum safety
        this.activeRequests = 0;

        // Memory cleanup intervals
        this.cleanupInterval = null;
        this.metricsInterval = null;

        this._startPerformanceMonitoring();
    }

    /**
     * Start performance monitoring
     * @private
     */
    _startPerformanceMonitoring() {
        // Memory cleanup every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this._performMemoryCleanup();
        }, 5 * 60 * 1000);

        // Metrics collection every minute
        this.metricsInterval = setInterval(() => {
            this._collectMetrics();
        }, 60 * 1000);
    }

    /**
     * Optimize API request with caching and queuing
     */
    async optimizeRequest(requestFn, cacheKey = null, cacheTtl = 300) {
        const startTime = Date.now();
        
        try {
            // Check cache first
            if (cacheKey) {
                const db = DatabaseManager.getInstance ? DatabaseManager.getInstance() : null;
                if (db) {
                    const cachedResult = await db.getCache(cacheKey);
                    if (cachedResult) {
                        this.metrics.cache.hits++;
                        logger(`🎯 Cache hit for ${cacheKey}`, 'info');
                        return cachedResult;
                    }
                    this.metrics.cache.misses++;
                }
            }

            // No concurrent request limiting for maximum safety
            // Rate limiting completely removed for Facebook account safety

            this.activeRequests++;
            this.metrics.requests.total++;

            // Execute request with timeout
            const result = await Promise.race([
                requestFn(),
                this._createTimeout(this.thresholds.responseTime)
            ]);

            // Cache successful result
            if (cacheKey && result) {
                const db = DatabaseManager.getInstance ? DatabaseManager.getInstance() : null;
                if (db) {
                    await db.setCache(cacheKey, result, cacheTtl);
                }
            }

            this.metrics.requests.successful++;
            return result;

        } catch (error) {
            this.metrics.requests.failed++;
            throw error;
        } finally {
            this.activeRequests--;
            const responseTime = Date.now() - startTime;
            this._recordResponseTime(responseTime);
        }
    }

    /**
     * Queue request when rate limited - DISABLED for maximum safety
     * @private
     */
    _queueRequest() {
        // Rate limiting disabled - return immediate promise for maximum safety
        return Promise.resolve();
    }

    /**
     * Process request queue - DISABLED for maximum safety
     * @private
     */
    _processQueue() {
        // Queue processing disabled for maximum Facebook account safety
        // All requests execute immediately without artificial delays
        return;
    }

    /**
     * Create timeout promise
     * @private
     */
    _createTimeout(ms) {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout')), ms);
        });
    }

    /**
     * Record response time for metrics
     * @private
     */
    _recordResponseTime(time) {
        this.requestTimes.push(time);
        
        if (this.requestTimes.length > this.maxRequestTimesSample) {
            this.requestTimes.shift();
        }

        // Calculate average response time
        const sum = this.requestTimes.reduce((a, b) => a + b, 0);
        this.metrics.requests.averageResponseTime = sum / this.requestTimes.length;
    }

    /**
     * Perform memory cleanup
     * @private
     */
    _performMemoryCleanup() {
        const memBefore = process.memoryUsage();
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }

        // Clear old request times
        if (this.requestTimes.length > this.maxRequestTimesSample / 2) {
            this.requestTimes = this.requestTimes.slice(-this.maxRequestTimesSample / 2);
        }

        // Clear expired cache
        const db = DatabaseManager.getInstance ? DatabaseManager.getInstance() : null;
        if (db && db.clearExpiredCache) {
            db.clearExpiredCache();
        }

        const memAfter = process.memoryUsage();
        const memFreed = memBefore.heapUsed - memAfter.heapUsed;
        
        if (memFreed > 0) {
            logger(`🧹 Memory cleanup: freed ${this._formatBytes(memFreed)}`, 'info');
        }

        // Check memory thresholds
        if (memAfter.heapUsed > this.thresholds.memoryUsage) {
            logger(`⚠️ High memory usage: ${this._formatBytes(memAfter.heapUsed)}`, 'warn');
        }
    }

    /**
     * Collect performance metrics
     * @private
     */
    _collectMetrics() {
        const memUsage = process.memoryUsage();
        
        this.metrics.memory = {
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss
        };

        // Calculate cache hit rate
        const totalCacheRequests = this.metrics.cache.hits + this.metrics.cache.misses;
        const cacheHitRate = totalCacheRequests > 0 ? this.metrics.cache.hits / totalCacheRequests : 0;

        // Save metrics to database
        const db = DatabaseManager.getInstance ? DatabaseManager.getInstance() : null;
        if (db && db.saveMetric) {
            db.saveMetric('memory_heap_used', memUsage.heapUsed);
            db.saveMetric('requests_total', this.metrics.requests.total);
            db.saveMetric('response_time_avg', this.metrics.requests.averageResponseTime);
            db.saveMetric('cache_hit_rate', cacheHitRate);
        }

        // Check performance thresholds
        this._checkPerformanceThresholds(cacheHitRate);
    }

    /**
     * Check performance thresholds and trigger optimizations
     * @private
     */
    _checkPerformanceThresholds(cacheHitRate) {
        const alerts = [];

        // Memory usage check
        if (this.metrics.memory.heapUsed > this.thresholds.memoryUsage) {
            alerts.push(`High memory usage: ${this._formatBytes(this.metrics.memory.heapUsed)}`);
        }

        // Response time check
        if (this.metrics.requests.averageResponseTime > this.thresholds.responseTime) {
            alerts.push(`High response time: ${this.metrics.requests.averageResponseTime}ms`);
        }

        // Cache hit rate check
        if (cacheHitRate < this.thresholds.cacheHitRate && this.metrics.cache.hits + this.metrics.cache.misses > 100) {
            alerts.push(`Low cache hit rate: ${(cacheHitRate * 100).toFixed(1)}%`);
        }

        if (alerts.length > 0) {
            logger(`⚠️ Performance alerts: ${alerts.join(', ')}`, 'warn');
        }
    }

    /**
     * Optimize message sending with ZERO delays for maximum safety
     */
    async optimizeMessageBatch(messages, sendFunction) {
        const batchSize = messages.length; // Process all at once
        const delay = 0; // No delays for maximum safety
        const results = [];

        for (let i = 0; i < messages.length; i += batchSize) {
            const batch = messages.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (message, index) => {
                // No delays - execute immediately for maximum safety
                return await this.optimizeRequest(() => sendFunction(message), null, 0);
            });

            const batchResults = await Promise.allSettled(batchPromises);
            results.push(...batchResults);

            // No delay between batches for maximum safety
        }

        return results;
    }

    /**
     * Optimize thread info requests with smart caching
     */
    async optimizeThreadInfo(threadIds, getThreadInfoFn) {
        const results = new Map();
        const uncachedIds = [];

        // Check cache for each thread
        const db = DatabaseManager.getInstance ? DatabaseManager.getInstance() : null;
        if (db) {
            for (const threadId of threadIds) {
                const cached = await db.getThreadInfo(threadId);
                if (cached) {
                    results.set(threadId, cached);
                } else {
                    uncachedIds.push(threadId);
                }
            }
        } else {
            uncachedIds.push(...threadIds);
        }

        // Fetch uncached thread info in batches
        if (uncachedIds.length > 0) {
            const batchSize = 10;
            for (let i = 0; i < uncachedIds.length; i += batchSize) {
                const batch = uncachedIds.slice(i, i + batchSize);
                
                const batchPromises = batch.map(async (threadId) => {
                    try {
                        const threadInfo = await this.optimizeRequest(
                            () => getThreadInfoFn(threadId),
                            `thread_${threadId}`,
                            1800 // 30 minutes cache
                        );
                        
                        if (db && threadInfo) {
                            await db.cacheThreadInfo(threadId, threadInfo);
                        }
                        
                        return { threadId, threadInfo };
                    } catch (error) {
                        logger(`Failed to get thread info for ${threadId}: ${error.message}`, 'warn');
                        return { threadId, error };
                    }
                });

                const batchResults = await Promise.allSettled(batchPromises);
                
                batchResults.forEach(result => {
                    if (result.status === 'fulfilled' && result.value.threadInfo) {
                        results.set(result.value.threadId, result.value.threadInfo);
                    }
                });

                // Small delay between batches
                if (i + batchSize < uncachedIds.length) {
                    await this._delay(500);
                }
            }
        }

        return results;
    }

    /**
     * Optimize user info requests with smart caching
     */
    async optimizeUserInfo(userIds, getUserInfoFn) {
        const results = new Map();
        const uncachedIds = [];

        // Check cache for each user
        const db = DatabaseManager.getInstance ? DatabaseManager.getInstance() : null;
        if (db) {
            for (const userId of userIds) {
                const cached = await db.getUserInfo(userId);
                if (cached) {
                    results.set(userId, cached);
                } else {
                    uncachedIds.push(userId);
                }
            }
        } else {
            uncachedIds.push(...userIds);
        }

        // Fetch uncached user info
        if (uncachedIds.length > 0) {
            try {
                const userInfo = await this.optimizeRequest(
                    () => getUserInfoFn(uncachedIds),
                    null, // Don't cache the batch request
                    0
                );

                // Cache individual user info
                if (userInfo && db) {
                    for (const [userId, info] of Object.entries(userInfo)) {
                        await db.cacheUserInfo(userId, info);
                        results.set(userId, info);
                    }
                }
            } catch (error) {
                logger(`Failed to get user info: ${error.message}`, 'warn');
            }
        }

        return results;
    }

    /**
     * Get comprehensive performance report
     */
    getPerformanceReport() {
        const memUsage = process.memoryUsage();
        const totalRequests = this.metrics.requests.total;
        const successRate = totalRequests > 0 ? (this.metrics.requests.successful / totalRequests) * 100 : 0;
        const cacheTotal = this.metrics.cache.hits + this.metrics.cache.misses;
        const cacheHitRate = cacheTotal > 0 ? (this.metrics.cache.hits / cacheTotal) * 100 : 0;

        return {
            memory: {
                heap: `${this._formatBytes(memUsage.heapUsed)} / ${this._formatBytes(memUsage.heapTotal)}`,
                external: this._formatBytes(memUsage.external),
                rss: this._formatBytes(memUsage.rss),
                usage: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(1) + '%'
            },
            requests: {
                total: totalRequests,
                successful: this.metrics.requests.successful,
                failed: this.metrics.requests.failed,
                successRate: successRate.toFixed(1) + '%',
                averageResponseTime: Math.round(this.metrics.requests.averageResponseTime) + 'ms',
                activeRequests: this.activeRequests,
                queueLength: this.requestQueue.length
            },
            cache: {
                hits: this.metrics.cache.hits,
                misses: this.metrics.cache.misses,
                hitRate: cacheHitRate.toFixed(1) + '%'
            },
            mqtt: this.metrics.mqtt,
            thresholds: this.thresholds,
            uptime: process.uptime()
        };
    }

    /**
     * Format bytes to human readable format
     * @private
     */
    _formatBytes(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Delay utility
     * @private
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Update MQTT metrics
     */
    updateMqttMetrics(type, value = 1) {
        if (this.metrics.mqtt[type] !== undefined) {
            this.metrics.mqtt[type] += value;
        }
    }

    /**
     * Stop performance monitoring
     */
    stop() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }

        logger('📊 Performance monitoring stopped', 'info');
    }
}

// Singleton instance
let optimizerInstance = null;

module.exports = {
    PerformanceOptimizer,
    getInstance: () => {
        if (!optimizerInstance) {
            optimizerInstance = new PerformanceOptimizer();
        }
        return optimizerInstance;
    }
};
