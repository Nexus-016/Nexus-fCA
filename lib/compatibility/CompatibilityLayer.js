"use strict";

/**
 * Compatibility Layer for Nexus-FCA
 * Provides compatibility with fca-unofficial, ws3-fca, and fca-utils APIs
 */

const { errorHandler } = require('../error/ErrorHandler');
const { performanceManager } = require('../performance/PerformanceManager');

class CompatibilityLayer {
    constructor(api) {
        this.api = api;
        this.mappings = new Map();
        this.setupCompatibilityMappings();
        this.interceptors = new Map();
        this.setupInterceptors();
    }

    setupCompatibilityMappings() {
        // API method mappings for different FCA packages
        this.mappings.set('fca-unofficial', {
            // Method name mappings
            methods: {
                'getThreadHistory': 'getThreadHistory',
                'getThreadList': 'getThreadList',
                'getThreadInfo': 'getThreadInfo',
                'getUserInfo': 'getUserInfo',
                'getUserID': 'getUserID',
                'sendMessage': 'sendMessage',
                'listen': 'listen',
                'logout': 'logout',
                'markAsRead': 'markAsRead',
                'markAsDelivered': 'markAsDelivered',
                'setOptions': 'setOptions',
                'getAppState': 'getAppState',
                'changeThreadColor': 'changeThreadColor',
                'changeThreadEmoji': 'changeThreadEmoji',
                'setTitle': 'setTitle',
                'addUserToGroup': 'addUserToGroup',
                'removeUserFromGroup': 'removeUserFromGroup'
            },
            // Parameter mappings
            parameters: {
                'threadID': 'threadID',
                'messageID': 'messageID',
                'userID': 'userID',
                'message': 'body',
                'attachment': 'attachment',
                'url': 'url',
                'limit': 'limit',
                'timestamp': 'timestamp'
            }
        });

        this.mappings.set('ws3-fca', {
            methods: {
                'getThreadHistory': 'getThreadHistory',
                'getThreadList': 'getThreadList',
                'sendMessage': 'sendMessage',
                'listen': 'listenMqtt',
                'getUserInfo': 'getUserInfo',
                'markAsRead': 'markAsRead'
            },
            parameters: {
                'tid': 'threadID',
                'uid': 'userID',
                'msg': 'body'
            }
        });

        this.mappings.set('fca-utils', {
            methods: {
                'getThread': 'getThreadInfo',
                'getUser': 'getUserInfo',
                'send': 'sendMessage',
                'listen': 'listen'
            },
            parameters: {
                'id': 'threadID',
                'text': 'body'
            }
        });
    }

    /**
     * Create a compatibility wrapper for a specific FCA package
     */
    createWrapper(packageName) {
        const mapping = this.mappings.get(packageName);
        if (!mapping) {
            throw new Error(`Unsupported package: ${packageName}`);
        }

        const wrapper = {};

        // Create method wrappers
        for (const [originalMethod, nexusMethod] of Object.entries(mapping.methods)) {
            if (this.api[nexusMethod]) {
                wrapper[originalMethod] = this.createMethodWrapper(
                    this.api[nexusMethod].bind(this.api),
                    mapping.parameters
                );
            }
        }

        return wrapper;
    }

    /**
     * Create a method wrapper that handles parameter mapping
     */
    createMethodWrapper(originalMethod, parameterMapping) {
        return (...args) => {
            try {
                // Handle different argument patterns
                let mappedArgs = args;

                if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null) {
                    // Map object parameters
                    const mappedObj = {};
                    for (const [key, value] of Object.entries(args[0])) {
                        const mappedKey = parameterMapping[key] || key;
                        mappedObj[mappedKey] = value;
                    }
                    mappedArgs = [mappedObj, ...args.slice(1)];
                }

                return originalMethod(...mappedArgs);
            } catch (error) {
                return errorHandler.handleError(error, 'CompatibilityLayer');
            }
        };
    }

    /**
     * Legacy API compatibility methods
     */
    createLegacyApi() {
        return {
            // fca-unofficial style API
            getThreadHistory: (threadID, amount, timestamp, callback) => {
                if (typeof amount === 'function') {
                    callback = amount;
                    amount = 20;
                    timestamp = null;
                } else if (typeof timestamp === 'function') {
                    callback = timestamp;
                    timestamp = null;
                }

                return this.api.getThreadHistory(threadID, amount, timestamp, callback);
            },

            getThreadList: (limit, timestamp, tags, callback) => {
                if (typeof limit === 'function') {
                    callback = limit;
                    limit = 20;
                    timestamp = null;
                    tags = [];
                } else if (typeof timestamp === 'function') {
                    callback = timestamp;
                    timestamp = null;
                    tags = [];
                } else if (typeof tags === 'function') {
                    callback = tags;
                    tags = [];
                }

                return this.api.getThreadList(limit, timestamp, tags, callback);
            },

            sendMessage: (message, threadID, callback, messageID) => {
                // Handle different message formats
                let messageObj = message;
                if (typeof message === 'string') {
                    messageObj = { body: message };
                }

                return this.api.sendMessage(messageObj, threadID, callback, messageID);
            },

            // ws3-fca style shortcuts
            send: (msg, tid, callback) => {
                return this.api.sendMessage({ body: msg }, tid, callback);
            },

            getThread: (tid, callback) => {
                return this.api.getThreadInfo(tid, callback);
            },

            getUser: (uid, callback) => {
                return this.api.getUserInfo(uid, callback);
            },

            // Enhanced compatibility methods
            listen: (callback) => {
                if (this.api.listenMqtt) {
                    return this.api.listenMqtt(callback);
                } else if (this.api.listen) {
                    return this.api.listen(callback);
                }
                throw new Error('No listen method available');
            },

            // Utility methods for cross-package compatibility
            convertMessage: (message, targetFormat = 'nexus') => {
                const formats = {
                    'nexus': (msg) => ({
                        body: msg.body || msg.message || msg.text || msg.msg,
                        threadID: msg.threadID || msg.tid || msg.thread_id,
                        messageID: msg.messageID || msg.mid || msg.message_id,
                        senderID: msg.senderID || msg.uid || msg.user_id || msg.from,
                        attachments: msg.attachments || msg.attachment || [],
                        timestamp: msg.timestamp || msg.time || Date.now()
                    }),
                    'fca-unofficial': (msg) => ({
                        body: msg.body,
                        threadID: msg.threadID,
                        messageID: msg.messageID,
                        senderID: msg.senderID,
                        attachments: msg.attachments,
                        timestamp: msg.timestamp
                    }),
                    'ws3-fca': (msg) => ({
                        msg: msg.body,
                        tid: msg.threadID,
                        mid: msg.messageID,
                        uid: msg.senderID,
                        attachment: msg.attachments,
                        time: msg.timestamp
                    })
                };

                return formats[targetFormat] ? formats[targetFormat](message) : message;
            },

            // Migration helpers
            migrateFromFcaUnofficial: (oldApi) => {
                console.log('Migrating from fca-unofficial to Nexus-FCA...');
                // Copy over any custom properties or settings
                if (oldApi.options) {
                    this.api.setOptions(oldApi.options);
                }
                return this.api;
            },

            migrateFromWs3Fca: (oldApi) => {
                console.log('Migrating from ws3-fca to Nexus-FCA...');
                // Handle ws3-fca specific migration
                return this.api;
            }
        };
    }

    /**
     * Auto-detect and adapt to different FCA package styles
     */
    autoAdapt(api) {
        const adaptedApi = { ...api };

        // Add missing methods that other packages might expect
        if (!adaptedApi.send && adaptedApi.sendMessage) {
            adaptedApi.send = (msg, tid, callback) => 
                adaptedApi.sendMessage({ body: msg }, tid, callback);
        }

        if (!adaptedApi.getThread && adaptedApi.getThreadInfo) {
            adaptedApi.getThread = adaptedApi.getThreadInfo;
        }

        if (!adaptedApi.getUser && adaptedApi.getUserInfo) {
            adaptedApi.getUser = adaptedApi.getUserInfo;
        }

        // Add legacy event handling
        if (adaptedApi.listen && !adaptedApi.listenMqtt) {
            adaptedApi.listenMqtt = adaptedApi.listen;
        }

        return adaptedApi;
    }

    /**
     * Create middleware for handling different package expectations
     */
    createMiddleware() {
        return {
            // Middleware for handling different callback patterns
            callbackMiddleware: (originalCallback) => {
                return (err, data) => {
                    if (err) {
                        // Standardize error format
                        const standardError = {
                            error: err.message || err,
                            code: err.code || 'UNKNOWN_ERROR',
                            details: err.details || err
                        };
                        return originalCallback(standardError);
                    }
                    return originalCallback(null, data);
                };
            },

            // Middleware for parameter validation
            parameterMiddleware: (requiredParams) => {
                return (params) => {
                    const missing = requiredParams.filter(param => 
                        params[param] === undefined || params[param] === null
                    );
                    
                    if (missing.length > 0) {
                        throw new Error(`Missing required parameters: ${missing.join(', ')}`);
                    }
                    
                    return params;
                };
            },

            // Middleware for response transformation
            responseMiddleware: (transformer) => {
                return (response) => {
                    return transformer(response);
                };
            }
        };
    }

    setupInterceptors() {
        // Request interceptors
        this.interceptors.set('request', []);
        this.interceptors.set('response', []);
    }

    addInterceptor(type, interceptor) {
        if (this.interceptors.has(type)) {
            this.interceptors.get(type).push(interceptor);
        }
    }

    removeInterceptor(type, interceptor) {
        if (this.interceptors.has(type)) {
            const interceptors = this.interceptors.get(type);
            const index = interceptors.indexOf(interceptor);
            if (index > -1) {
                interceptors.splice(index, 1);
            }
        }
    }

    async processInterceptors(type, data) {
        const interceptors = this.interceptors.get(type) || [];
        let result = data;
        
        for (const interceptor of interceptors) {
            try {
                result = await interceptor(result);
            } catch (error) {
                errorHandler.handleError(error, `${type}Interceptor`);
            }
        }
        
        return result;
    }
}

module.exports = { CompatibilityLayer };
