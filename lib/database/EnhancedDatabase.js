"use strict";

/**
 * Enhanced Database Manager for Nexus-FCA
 * Provides persistent storage for sessions, users, threads, and message history
 */

const fs = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const EventEmitter = require('events');
const { performanceManager } = require('../performance/PerformanceManager');
const { errorHandler } = require('../error/ErrorHandler');

class EnhancedDatabase extends EventEmitter {
    constructor(options = {}) {
        super();
        this.dbPath = options.dbPath || path.join(process.cwd(), 'Fca_Database', 'nexus.sqlite');
        this.cacheSize = options.cacheSize || 1000;
        this.db = null;
        this.cache = new Map();
        this.writeQueue = [];
        this.isProcessingQueue = false;
        this.schemas = this.getSchemas();
        this.indexes = this.getIndexes();
    }

    /**
     * Initialize database connection and setup tables
     */
    async initialize() {
        try {
            // Ensure database directory exists
            await fs.mkdir(path.dirname(this.dbPath), { recursive: true });

            // Open database connection
            this.db = await open({
                filename: this.dbPath,
                driver: sqlite3.Database
            });

            // Configure database settings
            await this.db.exec(`
                PRAGMA journal_mode = WAL;
                PRAGMA synchronous = NORMAL;
                PRAGMA cache_size = -${this.cacheSize};
                PRAGMA foreign_keys = ON;
                PRAGMA temp_store = MEMORY;
                PRAGMA mmap_size = 268435456;
            `);

            // Create tables
            await this.createTables();
            await this.createIndexes();

            // Start queue processing
            this.startQueueProcessor();

            console.log('Enhanced database initialized successfully');
            this.emit('ready');
        } catch (error) {
            errorHandler.handleError(error, 'EnhancedDatabase.initialize');
            throw error;
        }
    }

    /**
     * Define database schemas
     */
    getSchemas() {
        return {
            users: `
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    first_name TEXT,
                    last_name TEXT,
                    profile_url TEXT,
                    avatar_url TEXT,
                    is_friend BOOLEAN DEFAULT 0,
                    is_blocked BOOLEAN DEFAULT 0,
                    last_active INTEGER,
                    metadata TEXT,
                    created_at INTEGER DEFAULT (strftime('%s', 'now')),
                    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
                )
            `,
            threads: `
                CREATE TABLE IF NOT EXISTS threads (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    thread_type TEXT,
                    image_url TEXT,
                    emoji TEXT,
                    color TEXT,
                    participant_count INTEGER DEFAULT 0,
                    is_group BOOLEAN DEFAULT 0,
                    is_archived BOOLEAN DEFAULT 0,
                    is_pinned BOOLEAN DEFAULT 0,
                    last_message_id TEXT,
                    last_message_time INTEGER,
                    metadata TEXT,
                    created_at INTEGER DEFAULT (strftime('%s', 'now')),
                    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
                )
            `,
            messages: `
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    thread_id TEXT NOT NULL,
                    sender_id TEXT NOT NULL,
                    body TEXT,
                    message_type TEXT DEFAULT 'text',
                    attachments TEXT,
                    mentions TEXT,
                    reactions TEXT,
                    reply_to_id TEXT,
                    is_edited BOOLEAN DEFAULT 0,
                    is_deleted BOOLEAN DEFAULT 0,
                    timestamp INTEGER NOT NULL,
                    metadata TEXT,
                    created_at INTEGER DEFAULT (strftime('%s', 'now')),
                    FOREIGN KEY (thread_id) REFERENCES threads(id),
                    FOREIGN KEY (sender_id) REFERENCES users(id),
                    FOREIGN KEY (reply_to_id) REFERENCES messages(id)
                )
            `,
            participants: `
                CREATE TABLE IF NOT EXISTS participants (
                    thread_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    is_admin BOOLEAN DEFAULT 0,
                    joined_at INTEGER DEFAULT (strftime('%s', 'now')),
                    left_at INTEGER,
                    PRIMARY KEY (thread_id, user_id),
                    FOREIGN KEY (thread_id) REFERENCES threads(id),
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `,
            sessions: `
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT,
                    app_state TEXT,
                    cookies TEXT,
                    tokens TEXT,
                    last_used INTEGER DEFAULT (strftime('%s', 'now')),
                    expires_at INTEGER,
                    is_active BOOLEAN DEFAULT 1,
                    metadata TEXT,
                    created_at INTEGER DEFAULT (strftime('%s', 'now'))
                )
            `,
            attachments: `
                CREATE TABLE IF NOT EXISTS attachments (
                    id TEXT PRIMARY KEY,
                    message_id TEXT NOT NULL,
                    type TEXT,
                    url TEXT,
                    filename TEXT,
                    size INTEGER,
                    width INTEGER,
                    height INTEGER,
                    duration INTEGER,
                    thumbnail_url TEXT,
                    metadata TEXT,
                    created_at INTEGER DEFAULT (strftime('%s', 'now')),
                    FOREIGN KEY (message_id) REFERENCES messages(id)
                )
            `,
            cache: `
                CREATE TABLE IF NOT EXISTS cache (
                    key TEXT PRIMARY KEY,
                    value TEXT,
                    expires_at INTEGER,
                    created_at INTEGER DEFAULT (strftime('%s', 'now'))
                )
            `,
            events: `
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_type TEXT NOT NULL,
                    thread_id TEXT,
                    user_id TEXT,
                    data TEXT,
                    timestamp INTEGER DEFAULT (strftime('%s', 'now'))
                )
            `
        };
    }

    /**
     * Define database indexes
     */
    getIndexes() {
        return [
            'CREATE INDEX IF NOT EXISTS idx_users_name ON users(name)',
            'CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active)',
            'CREATE INDEX IF NOT EXISTS idx_threads_type ON threads(thread_type)',
            'CREATE INDEX IF NOT EXISTS idx_threads_last_message ON threads(last_message_time)',
            'CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id)',
            'CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)',
            'CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)',
            'CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type)',
            'CREATE INDEX IF NOT EXISTS idx_participants_thread ON participants(thread_id)',
            'CREATE INDEX IF NOT EXISTS idx_participants_user ON participants(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active)',
            'CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id)',
            'CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at)',
            'CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type)',
            'CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)'
        ];
    }

    /**
     * Create all tables
     */
    async createTables() {
        for (const [tableName, schema] of Object.entries(this.schemas)) {
            await this.db.exec(schema);
        }
    }

    /**
     * Create all indexes
     */
    async createIndexes() {
        for (const indexQuery of this.indexes) {
            await this.db.exec(indexQuery);
        }
    }

    /**
     * User management methods
     */
    async saveUser(user) {
        const cacheKey = `user:${user.id}`;
        
        try {
            const query = `
                INSERT OR REPLACE INTO users 
                (id, name, first_name, last_name, profile_url, avatar_url, 
                 is_friend, is_blocked, last_active, metadata, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
            `;
            
            await this.queueWrite(query, [
                user.id,
                user.name || null,
                user.firstName || null,
                user.lastName || null,
                user.profileUrl || null,
                user.avatarUrl || null,
                user.isFriend ? 1 : 0,
                user.isBlocked ? 1 : 0,
                user.lastActive || Date.now(),
                JSON.stringify(user.metadata || {})
            ]);

            // Update cache
            this.cache.set(cacheKey, user);
            
            return user;
        } catch (error) {
            errorHandler.handleError(error, 'EnhancedDatabase.saveUser');
            throw error;
        }
    }

    async getUser(userId) {
        const cacheKey = `user:${userId}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const user = await this.db.get(
                'SELECT * FROM users WHERE id = ?',
                [userId]
            );

            if (user) {
                user.metadata = JSON.parse(user.metadata || '{}');
                user.isFriend = Boolean(user.is_friend);
                user.isBlocked = Boolean(user.is_blocked);
                
                // Cache the result
                this.cache.set(cacheKey, user);
            }

            return user;
        } catch (error) {
            errorHandler.handleError(error, 'EnhancedDatabase.getUser');
            return null;
        }
    }

    /**
     * Thread management methods
     */
    async saveThread(thread) {
        const cacheKey = `thread:${thread.id}`;
        
        try {
            const query = `
                INSERT OR REPLACE INTO threads 
                (id, name, thread_type, image_url, emoji, color, participant_count,
                 is_group, is_archived, is_pinned, last_message_id, last_message_time,
                 metadata, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
            `;
            
            await this.queueWrite(query, [
                thread.id,
                thread.name || null,
                thread.threadType || 'user',
                thread.imageUrl || null,
                thread.emoji || null,
                thread.color || null,
                thread.participantCount || 0,
                thread.isGroup ? 1 : 0,
                thread.isArchived ? 1 : 0,
                thread.isPinned ? 1 : 0,
                thread.lastMessageId || null,
                thread.lastMessageTime || null,
                JSON.stringify(thread.metadata || {})
            ]);

            // Update cache
            this.cache.set(cacheKey, thread);
            
            return thread;
        } catch (error) {
            errorHandler.handleError(error, 'EnhancedDatabase.saveThread');
            throw error;
        }
    }

    async getThread(threadId) {
        const cacheKey = `thread:${threadId}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const thread = await this.db.get(
                'SELECT * FROM threads WHERE id = ?',
                [threadId]
            );

            if (thread) {
                thread.metadata = JSON.parse(thread.metadata || '{}');
                thread.isGroup = Boolean(thread.is_group);
                thread.isArchived = Boolean(thread.is_archived);
                thread.isPinned = Boolean(thread.is_pinned);
                
                // Cache the result
                this.cache.set(cacheKey, thread);
            }

            return thread;
        } catch (error) {
            errorHandler.handleError(error, 'EnhancedDatabase.getThread');
            return null;
        }
    }

    /**
     * Message management methods
     */
    async saveMessage(message) {
        try {
            const query = `
                INSERT OR REPLACE INTO messages 
                (id, thread_id, sender_id, body, message_type, attachments, mentions,
                 reactions, reply_to_id, is_edited, is_deleted, timestamp, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            await this.queueWrite(query, [
                message.id,
                message.threadId,
                message.senderId,
                message.body || null,
                message.type || 'text',
                JSON.stringify(message.attachments || []),
                JSON.stringify(message.mentions || []),
                JSON.stringify(message.reactions || []),
                message.replyToId || null,
                message.isEdited ? 1 : 0,
                message.isDeleted ? 1 : 0,
                message.timestamp,
                JSON.stringify(message.metadata || {})
            ]);

            // Update thread last message
            await this.queueWrite(
                'UPDATE threads SET last_message_id = ?, last_message_time = ? WHERE id = ?',
                [message.id, message.timestamp, message.threadId]
            );
            
            return message;
        } catch (error) {
            errorHandler.handleError(error, 'EnhancedDatabase.saveMessage');
            throw error;
        }
    }

    async getMessages(threadId, limit = 50, before = null) {
        try {
            let query = `
                SELECT * FROM messages 
                WHERE thread_id = ? AND is_deleted = 0
            `;
            let params = [threadId];

            if (before) {
                query += ' AND timestamp < ?';
                params.push(before);
            }

            query += ' ORDER BY timestamp DESC LIMIT ?';
            params.push(limit);

            const messages = await this.db.all(query, params);
            
            return messages.map(msg => ({
                ...msg,
                attachments: JSON.parse(msg.attachments || '[]'),
                mentions: JSON.parse(msg.mentions || '[]'),
                reactions: JSON.parse(msg.reactions || '[]'),
                metadata: JSON.parse(msg.metadata || '{}'),
                isEdited: Boolean(msg.is_edited),
                isDeleted: Boolean(msg.is_deleted)
            }));
        } catch (error) {
            errorHandler.handleError(error, 'EnhancedDatabase.getMessages');
            return [];
        }
    }

    /**
     * Session management methods
     */
    async saveSession(session) {
        try {
            const query = `
                INSERT OR REPLACE INTO sessions 
                (id, user_id, app_state, cookies, tokens, expires_at, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            
            await this.queueWrite(query, [
                session.id,
                session.userId || null,
                JSON.stringify(session.appState || {}),
                JSON.stringify(session.cookies || {}),
                JSON.stringify(session.tokens || {}),
                session.expiresAt || null,
                JSON.stringify(session.metadata || {})
            ]);
            
            return session;
        } catch (error) {
            errorHandler.handleError(error, 'EnhancedDatabase.saveSession');
            throw error;
        }
    }

    async getActiveSession(userId = null) {
        try {
            let query = 'SELECT * FROM sessions WHERE is_active = 1';
            let params = [];

            if (userId) {
                query += ' AND user_id = ?';
                params.push(userId);
            }

            query += ' ORDER BY last_used DESC LIMIT 1';

            const session = await this.db.get(query, params);
            
            if (session) {
                session.appState = JSON.parse(session.app_state || '{}');
                session.cookies = JSON.parse(session.cookies || '{}');
                session.tokens = JSON.parse(session.tokens || '{}');
                session.metadata = JSON.parse(session.metadata || '{}');
                session.isActive = Boolean(session.is_active);
            }

            return session;
        } catch (error) {
            errorHandler.handleError(error, 'EnhancedDatabase.getActiveSession');
            return null;
        }
    }

    /**
     * Cache management methods
     */
    async setCache(key, value, ttl = 3600) {
        try {
            const expiresAt = Date.now() + (ttl * 1000);
            
            await this.queueWrite(
                'INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)',
                [key, JSON.stringify(value), expiresAt]
            );

            // Also update memory cache
            this.cache.set(key, value);
            
            return true;
        } catch (error) {
            errorHandler.handleError(error, 'EnhancedDatabase.setCache');
            return false;
        }
    }

    async getCache(key) {
        // Check memory cache first
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }

        try {
            const cached = await this.db.get(
                'SELECT value FROM cache WHERE key = ? AND expires_at > ?',
                [key, Date.now()]
            );

            if (cached) {
                const value = JSON.parse(cached.value);
                this.cache.set(key, value);
                return value;
            }

            return null;
        } catch (error) {
            errorHandler.handleError(error, 'EnhancedDatabase.getCache');
            return null;
        }
    }

    /**
     * Analytics and event tracking
     */
    async logEvent(eventType, data = {}) {
        try {
            await this.queueWrite(
                'INSERT INTO events (event_type, thread_id, user_id, data) VALUES (?, ?, ?, ?)',
                [eventType, data.threadId || null, data.userId || null, JSON.stringify(data)]
            );
        } catch (error) {
            errorHandler.handleError(error, 'EnhancedDatabase.logEvent');
        }
    }

    /**
     * Queue system for write operations
     */
    queueWrite(query, params = []) {
        return new Promise((resolve, reject) => {
            this.writeQueue.push({ query, params, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.isProcessingQueue || this.writeQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        try {
            const batch = this.writeQueue.splice(0, 100); // Process in batches
            
            await this.db.exec('BEGIN TRANSACTION');
            
            for (const operation of batch) {
                try {
                    const result = await this.db.run(operation.query, operation.params);
                    operation.resolve(result);
                } catch (error) {
                    operation.reject(error);
                }
            }
            
            await this.db.exec('COMMIT');
        } catch (error) {
            await this.db.exec('ROLLBACK');
            errorHandler.handleError(error, 'EnhancedDatabase.processQueue');
        } finally {
            this.isProcessingQueue = false;
            
            // Process next batch if queue has items
            if (this.writeQueue.length > 0) {
                setTimeout(() => this.processQueue(), 10);
            }
        }
    }

    startQueueProcessor() {
        setInterval(() => {
            this.processQueue();
        }, 1000);
    }

    /**
     * Cleanup and maintenance
     */
    async cleanup() {
        try {
            // Remove expired cache entries
            await this.db.run('DELETE FROM cache WHERE expires_at < ?', [Date.now()]);
            
            // Remove old events (older than 30 days)
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            await this.db.run('DELETE FROM events WHERE timestamp < ?', [thirtyDaysAgo]);
            
            // Vacuum database
            await this.db.exec('VACUUM');
            
            console.log('Database cleanup completed');
        } catch (error) {
            errorHandler.handleError(error, 'EnhancedDatabase.cleanup');
        }
    }

    /**
     * Close database connection
     */
    async close() {
        try {
            // Process remaining queue items
            await this.processQueue();
            
            if (this.db) {
                await this.db.close();
                this.db = null;
            }
            
            this.cache.clear();
            console.log('Database connection closed');
        } catch (error) {
            errorHandler.handleError(error, 'EnhancedDatabase.close');
        }
    }
}

module.exports = { EnhancedDatabase };
