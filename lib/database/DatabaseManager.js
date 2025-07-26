"use strict";

// Nexus-FCA: Enhanced Database and Caching System
// High-performance caching with SQLite persistence

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../logger');

class DatabaseManager {
    constructor(dbPath = null) {
        this.dbPath = dbPath || path.join(__dirname, '../../Fca_Database/nexus_cache.sqlite');
        this.db = null;
        this.cache = new Map();
        this.maxCacheSize = 10000;
        this.cacheStats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0
        };
        
        // Ensure database directory exists
        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
    }

    /**
     * Initialize database connection and create tables
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    logger(`❌ Database connection failed: ${err.message}`, 'error');
                    reject(err);
                } else {
                    logger('✅ Database connected successfully', 'info');
                    this._createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    /**
     * Create necessary tables
     * @private
     */
    async _createTables() {
        const tables = [
            // Session cache table
            `CREATE TABLE IF NOT EXISTS session_cache (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                expires_at INTEGER,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            )`,
            
            // User info cache
            `CREATE TABLE IF NOT EXISTS user_cache (
                user_id TEXT PRIMARY KEY,
                name TEXT,
                profile_picture TEXT,
                data TEXT,
                last_updated INTEGER DEFAULT (strftime('%s', 'now'))
            )`,
            
            // Thread info cache
            `CREATE TABLE IF NOT EXISTS thread_cache (
                thread_id TEXT PRIMARY KEY,
                name TEXT,
                is_group INTEGER,
                participant_count INTEGER,
                data TEXT,
                last_updated INTEGER DEFAULT (strftime('%s', 'now'))
            )`,
            
            // Message history (optional, for analytics)
            `CREATE TABLE IF NOT EXISTS message_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id TEXT,
                thread_id TEXT,
                sender_id TEXT,
                body TEXT,
                timestamp INTEGER,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )`,
            
            // Performance metrics
            `CREATE TABLE IF NOT EXISTS metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                metric_name TEXT,
                metric_value REAL,
                timestamp INTEGER DEFAULT (strftime('%s', 'now'))
            )`
        ];

        for (const sql of tables) {
            await this._runQuery(sql);
        }

        // Create indexes for better performance
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_session_expires ON session_cache(expires_at)',
            'CREATE INDEX IF NOT EXISTS idx_user_updated ON user_cache(last_updated)',
            'CREATE INDEX IF NOT EXISTS idx_thread_updated ON thread_cache(last_updated)',
            'CREATE INDEX IF NOT EXISTS idx_message_thread ON message_history(thread_id)',
            'CREATE INDEX IF NOT EXISTS idx_message_timestamp ON message_history(timestamp)',
            'CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(metric_name, timestamp)'
        ];

        for (const sql of indexes) {
            await this._runQuery(sql);
        }

        logger('📊 Database tables and indexes created', 'info');
    }

    /**
     * Run a database query
     * @private
     */
    _runQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    logger(`❌ Database query failed: ${err.message}`, 'error');
                    reject(err);
                } else {
                    resolve(this);
                }
            });
        });
    }

    /**
     * Get data from database
     * @private
     */
    _getQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    logger(`❌ Database get failed: ${err.message}`, 'error');
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * Get all data from database
     * @private
     */
    _getAllQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    logger(`❌ Database getAll failed: ${err.message}`, 'error');
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * Enhanced cache management
     */
    
    // Set cache with TTL
    setCache(key, value, ttl = 3600) {
        // Memory cache
        this.cache.set(key, {
            value,
            expires: Date.now() + (ttl * 1000)
        });
        
        // Manage cache size
        if (this.cache.size > this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        // Persistent cache
        const expiresAt = Math.floor(Date.now() / 1000) + ttl;
        this._runQuery(
            'INSERT OR REPLACE INTO session_cache (key, value, expires_at, updated_at) VALUES (?, ?, ?, ?)',
            [key, JSON.stringify(value), expiresAt, Math.floor(Date.now() / 1000)]
        ).catch(err => logger(`Cache set error: ${err.message}`, 'error'));
        
        this.cacheStats.sets++;
    }

    // Get from cache
    async getCache(key) {
        // Check memory cache first
        const memoryItem = this.cache.get(key);
        if (memoryItem) {
            if (memoryItem.expires > Date.now()) {
                this.cacheStats.hits++;
                return memoryItem.value;
            } else {
                this.cache.delete(key);
            }
        }

        // Check persistent cache
        try {
            const row = await this._getQuery(
                'SELECT value, expires_at FROM session_cache WHERE key = ? AND expires_at > ?',
                [key, Math.floor(Date.now() / 1000)]
            );
            
            if (row) {
                const value = JSON.parse(row.value);
                // Restore to memory cache
                this.cache.set(key, {
                    value,
                    expires: row.expires_at * 1000
                });
                this.cacheStats.hits++;
                return value;
            }
        } catch (err) {
            logger(`Cache get error: ${err.message}`, 'error');
        }

        this.cacheStats.misses++;
        return null;
    }

    // Delete from cache
    deleteCache(key) {
        this.cache.delete(key);
        this._runQuery('DELETE FROM session_cache WHERE key = ?', [key])
            .catch(err => logger(`Cache delete error: ${err.message}`, 'error'));
        this.cacheStats.deletes++;
    }

    // Clear expired cache
    async clearExpiredCache() {
        const now = Math.floor(Date.now() / 1000);
        
        // Clear memory cache
        for (const [key, item] of this.cache.entries()) {
            if (item.expires <= Date.now()) {
                this.cache.delete(key);
            }
        }
        
        // Clear persistent cache
        try {
            const result = await this._runQuery(
                'DELETE FROM session_cache WHERE expires_at <= ?',
                [now]
            );
            logger(`🧹 Cleared ${result.changes} expired cache entries`, 'info');
        } catch (err) {
            logger(`Cache cleanup error: ${err.message}`, 'error');
        }
    }

    /**
     * User data caching
     */
    
    async cacheUserInfo(userId, userInfo) {
        const data = JSON.stringify(userInfo);
        await this._runQuery(
            'INSERT OR REPLACE INTO user_cache (user_id, name, profile_picture, data, last_updated) VALUES (?, ?, ?, ?, ?)',
            [userId, userInfo.name, userInfo.profilePicture, data, Math.floor(Date.now() / 1000)]
        );
    }

    async getUserInfo(userId) {
        try {
            const row = await this._getQuery(
                'SELECT data, last_updated FROM user_cache WHERE user_id = ?',
                [userId]
            );
            
            if (row) {
                const userData = JSON.parse(row.data);
                const age = Date.now() / 1000 - row.last_updated;
                
                // Return if less than 1 hour old
                if (age < 3600) {
                    return userData;
                }
            }
            return null;
        } catch (err) {
            logger(`User cache error: ${err.message}`, 'error');
            return null;
        }
    }

    /**
     * Thread data caching
     */
    
    async cacheThreadInfo(threadId, threadInfo) {
        const data = JSON.stringify(threadInfo);
        await this._runQuery(
            'INSERT OR REPLACE INTO thread_cache (thread_id, name, is_group, participant_count, data, last_updated) VALUES (?, ?, ?, ?, ?, ?)',
            [threadId, threadInfo.name, threadInfo.isGroup ? 1 : 0, threadInfo.participantIDs?.length || 0, data, Math.floor(Date.now() / 1000)]
        );
    }

    async getThreadInfo(threadId) {
        try {
            const row = await this._getQuery(
                'SELECT data, last_updated FROM thread_cache WHERE thread_id = ?',
                [threadId]
            );
            
            if (row) {
                const threadData = JSON.parse(row.data);
                const age = Date.now() / 1000 - row.last_updated;
                
                // Return if less than 30 minutes old
                if (age < 1800) {
                    return threadData;
                }
            }
            return null;
        } catch (err) {
            logger(`Thread cache error: ${err.message}`, 'error');
            return null;
        }
    }

    /**
     * Message history (optional)
     */
    
    async saveMessage(messageId, threadId, senderId, body) {
        try {
            await this._runQuery(
                'INSERT INTO message_history (message_id, thread_id, sender_id, body, timestamp) VALUES (?, ?, ?, ?, ?)',
                [messageId, threadId, senderId, body, Math.floor(Date.now() / 1000)]
            );
        } catch (err) {
            logger(`Message save error: ${err.message}`, 'error');
        }
    }

    async getMessageHistory(threadId, limit = 50) {
        try {
            return await this._getAllQuery(
                'SELECT * FROM message_history WHERE thread_id = ? ORDER BY timestamp DESC LIMIT ?',
                [threadId, limit]
            );
        } catch (err) {
            logger(`Message history error: ${err.message}`, 'error');
            return [];
        }
    }

    /**
     * Performance metrics
     */
    
    async saveMetric(name, value) {
        try {
            await this._runQuery(
                'INSERT INTO metrics (metric_name, metric_value) VALUES (?, ?)',
                [name, value]
            );
        } catch (err) {
            logger(`Metric save error: ${err.message}`, 'error');
        }
    }

    async getMetrics(name, hours = 24) {
        try {
            const since = Math.floor(Date.now() / 1000) - (hours * 3600);
            return await this._getAllQuery(
                'SELECT * FROM metrics WHERE metric_name = ? AND timestamp >= ? ORDER BY timestamp DESC',
                [name, since]
            );
        } catch (err) {
            logger(`Metrics get error: ${err.message}`, 'error');
            return [];
        }
    }

    /**
     * Database maintenance
     */
    
    async vacuum() {
        try {
            await this._runQuery('VACUUM');
            logger('🧹 Database vacuumed successfully', 'info');
        } catch (err) {
            logger(`Database vacuum error: ${err.message}`, 'error');
        }
    }

    async getStats() {
        try {
            const stats = {};
            
            // Get table sizes
            const tables = ['session_cache', 'user_cache', 'thread_cache', 'message_history', 'metrics'];
            for (const table of tables) {
                const row = await this._getQuery(`SELECT COUNT(*) as count FROM ${table}`);
                stats[table] = row.count;
            }
            
            // Get cache stats
            stats.cache = {
                ...this.cacheStats,
                memorySize: this.cache.size,
                hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0
            };
            
            return stats;
        } catch (err) {
            logger(`Stats error: ${err.message}`, 'error');
            return {};
        }
    }

    /**
     * Close database connection
     */
    close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        logger(`Database close error: ${err.message}`, 'error');
                    } else {
                        logger('✅ Database connection closed', 'info');
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

// Singleton instance
let dbInstance = null;

module.exports = {
    DatabaseManager,
    getInstance: (dbPath) => {
        if (!dbInstance) {
            dbInstance = new DatabaseManager(dbPath);
        }
        return dbInstance;
    }
};
