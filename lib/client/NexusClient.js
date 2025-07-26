"use strict";

// Nexus-FCA: Modern Client Class with Discord.js style API
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const login = require('../../index');
const logger = require('../logger');

class NexusClient extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            prefix: options.prefix || '!',
            selfListen: options.selfListen || false,
            listenEvents: options.listenEvents || true,
            updatePresence: options.updatePresence || true,
            autoMarkDelivery: options.autoMarkDelivery || true,
            autoMarkRead: options.autoMarkRead || false,
            safeMode: options.safeMode || false,
            rateLimitEnabled: options.rateLimitEnabled || true,
            mqttReconnectInterval: options.mqttReconnectInterval || 3600,
            logLevel: options.logLevel || 'info',
            ...options
        };

        this.commands = new Map();
        this.api = null;
        this.user = null;
        this._ready = false;
        this._reconnectAttempts = 0;
        this._maxReconnectAttempts = 5;
        
        // Enhanced error handling
        this.on('error', this._handleError.bind(this));
    }

    /**
     * Login with credentials
     * @param {object} credentials - Login credentials
     * @returns {Promise<void>}
     */
    async login(credentials) {
        return new Promise((resolve, reject) => {
            logger('Attempting login...', 'info');
            
            login(credentials, this.options, (err, api) => {
                if (err) {
                    this.emit('error', err);
                    return reject(err);
                }

                this.api = api;
                this.user = {
                    id: api.getCurrentUserID(),
                    name: null // Will be fetched later
                };

                this._setupEventHandlers();
                this._ready = true;
                
                logger(`✅ Logged in as ${this.user.id}`, 'info');
                this.emit('ready', api, this.user.id);
                resolve();
            });
        });
    }

    /**
     * Login with AppState
     * @param {array} appState - Facebook AppState
     * @returns {Promise<void>}
     */
    async loginWithAppState(appState) {
        return this.login({ appState });
    }

    /**
     * Load commands from directory
     * @param {string} directory - Commands directory path
     */
    loadCommands(directory) {
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
            logger(`Created commands directory: ${directory}`, 'info');
            return;
        }

        const commandFiles = fs.readdirSync(directory).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            try {
                const filePath = path.join(directory, file);
                delete require.cache[require.resolve(filePath)];
                const command = require(filePath);
                
                if (command.name && typeof command.execute === 'function') {
                    this.commands.set(command.name, command);
                    logger(`🔧 Loaded command: ${command.name}`, 'info');
                    
                    // Load aliases if available
                    if (command.aliases && Array.isArray(command.aliases)) {
                        command.aliases.forEach(alias => {
                            this.commands.set(alias, command);
                        });
                    }
                }
            } catch (error) {
                logger(`❌ Failed to load command ${file}: ${error.message}`, 'error');
            }
        }
    }

    /**
     * Setup event handlers for the API
     * @private
     */
    _setupEventHandlers() {
        if (!this.api) return;

        const stopListening = this.api.listenMqtt((err, event) => {
            if (err) {
                this.emit('error', err);
                this._handleReconnect();
                return;
            }

            this._handleEvent(event);
        });

        // Store stop function for cleanup
        this._stopListening = stopListening;

        // Auto-reconnect mechanism
        setInterval(() => {
            if (this._ready && this.api) {
                this.api.refreshFb_dtsg().catch(err => {
                    logger('Failed to refresh tokens', 'warn');
                });
            }
        }, this.options.mqttReconnectInterval * 1000);
    }

    /**
     * Handle incoming events
     * @private
     * @param {object} event - Facebook event
     */
    _handleEvent(event) {
        try {
            switch (event.type) {
                case 'message':
                    this._handleMessage(event);
                    break;
                case 'message_reply':
                    this._handleMessage(event);
                    break;
                case 'event':
                    this.emit('event', event);
                    break;
                case 'typ':
                    this.emit('typing', event);
                    break;
                case 'read':
                    this.emit('read', event);
                    break;
                case 'presence':
                    this.emit('presence', event);
                    break;
                case 'message_reaction':
                    this.emit('reaction', event);
                    break;
                default:
                    this.emit('unknown', event);
            }
        } catch (error) {
            this.emit('error', error);
        }
    }

    /**
     * Handle message events
     * @private
     * @param {object} event - Message event
     */
    _handleMessage(event) {
        // Create enhanced message object
        const message = new NexusMessage(this, event);
        
        this.emit('message', message);

        // Handle commands if prefix is set
        if (this.options.prefix && event.body && event.body.startsWith(this.options.prefix)) {
            this._handleCommand(message, event);
        }
    }

    /**
     * Handle command execution
     * @private
     * @param {NexusMessage} message - Message object
     * @param {object} event - Raw event
     */
    _handleCommand(message, event) {
        const args = event.body.slice(this.options.prefix.length).trim().split(/\s+/);
        const commandName = args.shift().toLowerCase();
        
        const command = this.commands.get(commandName);
        if (!command) return;

        const commandObj = {
            name: commandName,
            args,
            message
        };

        this.emit('command', commandObj);

        // Execute command
        try {
            command.execute({
                client: this,
                api: this.api,
                message,
                args,
                event
            }).catch(error => {
                logger(`❌ Command error in ${commandName}: ${error.message}`, 'error');
                this.emit('commandError', { command: commandObj, error });
            });
        } catch (error) {
            logger(`❌ Command error in ${commandName}: ${error.message}`, 'error');
            this.emit('commandError', { command: commandObj, error });
        }
    }

    /**
     * Handle errors with enhanced recovery
     * @private
     * @param {Error} error - Error object
     */
    _handleError(error) {
        logger(`❌ Client Error: ${error.message}`, 'error');
        
        if (error.message.includes('Not logged in') || error.message.includes('Session expired')) {
            this._handleReconnect();
        }
    }

    /**
     * Handle reconnection
     * @private
     */
    _handleReconnect() {
        if (this._reconnectAttempts >= this._maxReconnectAttempts) {
            logger('❌ Max reconnection attempts reached', 'error');
            this.emit('maxReconnectAttemptsReached');
            return;
        }

        this._reconnectAttempts++;
        logger(`🔄 Attempting reconnection (${this._reconnectAttempts}/${this._maxReconnectAttempts})...`, 'warn');
        
        setTimeout(() => {
            this.emit('reconnect');
            // Reset ready state for potential re-login
            this._ready = false;
        }, 5000 * this._reconnectAttempts); // Exponential backoff
    }

    /**
     * Get current user information
     * @returns {object} User object
     */
    getUser() {
        return this.user;
    }

    /**
     * Check if client is ready
     * @returns {boolean}
     */
    isReady() {
        return this._ready && this.api;
    }

    /**
     * Destroy the client and cleanup
     */
    destroy() {
        if (this._stopListening) {
            this._stopListening();
        }
        
        this._ready = false;
        this.api = null;
        this.removeAllListeners();
        
        logger('🔌 Client destroyed', 'info');
    }
}

/**
 * Enhanced Message class
 */
class NexusMessage {
    constructor(client, data) {
        this.client = client;
        this.id = data.messageID;
        this.content = data.body || '';
        this.author = data.senderID;
        this.thread = data.threadID;
        this.attachments = data.attachments || [];
        this.mentions = data.mentions || {};
        this.timestamp = data.timestamp;
        this.isGroup = data.isGroup || false;
        this.type = data.type || 'message';
        
        // Reply information if available
        if (data.messageReply) {
            this.reply_to = {
                id: data.messageReply.messageID,
                content: data.messageReply.body,
                author: data.messageReply.senderID
            };
        }
    }

    /**
     * Reply to this message
     * @param {string|object} content - Reply content
     * @returns {Promise<void>}
     */
    async reply(content) {
        if (!this.client.api) throw new Error('Client not ready');
        
        const messageData = typeof content === 'string' ? { body: content } : content;
        return this.client.api.sendMessage(messageData, this.thread);
    }

    /**
     * React to this message
     * @param {string} emoji - Reaction emoji
     * @returns {Promise<void>}
     */
    async react(emoji) {
        if (!this.client.api) throw new Error('Client not ready');
        return this.client.api.setMessageReaction(emoji, this.id);
    }

    /**
     * Edit this message (if sent by bot)
     * @param {string} newContent - New message content
     * @returns {Promise<void>}
     */
    async edit(newContent) {
        if (!this.client.api) throw new Error('Client not ready');
        if (this.author !== this.client.user.id) {
            throw new Error('Cannot edit message from another user');
        }
        return this.client.api.editMessage(newContent, this.id);
    }

    /**
     * Unsend this message
     * @returns {Promise<void>}
     */
    async unsend() {
        if (!this.client.api) throw new Error('Client not ready');
        return this.client.api.unsendMessage(this.id);
    }

    /**
     * Get thread information
     * @returns {Promise<object>}
     */
    async getThread() {
        if (!this.client.api) throw new Error('Client not ready');
        return this.client.api.getThreadInfo(this.thread);
    }

    /**
     * Get author information
     * @returns {Promise<object>}
     */
    async getAuthor() {
        if (!this.client.api) throw new Error('Client not ready');
        return this.client.api.getUserInfo(this.author);
    }
}

module.exports = { NexusClient, NexusMessage };
