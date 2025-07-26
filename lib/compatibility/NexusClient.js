"use strict";

/**
 * Nexus-FCA API Compatibility Layer
 * Provides fca-utils style Client class with modern event handling
 */

const EventEmitter = require('events');
const login = require('../../index');
const Message = require('../message/Message');
const Thread = require('../message/Thread');
const User = require('../message/User');
const ErrorHandler = require('../error/ErrorHandler');
const PerformanceManager = require('../performance/PerformanceManager');
const logger = require('../logger');

class NexusClient extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      prefix: options.prefix || '!',
      ignoreMessageInCommandEvent: options.ignoreMessageInCommandEvent !== false,
      selfListen: options.selfListen || false,
      listenEvents: options.listenEvents !== false,
      autoMarkDelivery: options.autoMarkDelivery !== false,
      autoMarkRead: options.autoMarkRead || false,
      enablePerformanceMode: options.enablePerformanceMode !== false,
      enableErrorRecovery: options.enableErrorRecovery !== false,
      ...options
    };

    this.api = null;
    this.isReady = false;
    this.commands = new Map();
    this.middleware = [];
    this.errorHandler = new ErrorHandler();
    this.performanceManager = new PerformanceManager();
    
    this.messageCache = new Map();
    this.userCache = new Map();
    this.threadCache = new Map();

    this.setupErrorHandling();
    this.setupPerformanceMonitoring();
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    this.errorHandler.on('criticalError', (error) => {
      this.emit('error', error);
    });

    // Register fallback strategies
    this.errorHandler.registerFallback('sendMessage', async (error) => {
      logger('Attempting message send fallback...', 'warn');
      await this.errorHandler.delay(2000);
      return null; // Return null to indicate fallback was used
    });
  }

  /**
   * Setup performance monitoring
   */
  setupPerformanceMonitoring() {
    if (!this.options.enablePerformanceMode) return;

    this.performanceManager.on('metricsUpdate', (metrics) => {
      this.emit('performanceUpdate', metrics);
    });
  }

  /**
   * Login with AppState (fca-utils style)
   */
  async loginWithAppState(appState, options = {}) {
    try {
      const credentials = { appState };
      const loginOptions = { ...this.options, ...options };

      logger('Logging in with AppState...', 'info');

      return new Promise((resolve, reject) => {
        login(credentials, loginOptions, (err, api) => {
          if (err) {
            this.emit('error', err);
            return reject(err);
          }

          this.api = api;
          this.setupApiEventHandlers();
          this.isReady = true;

          logger('Login successful!', 'info');
          this.emit('ready', api, api.getCurrentUserID());
          resolve(api);
        });
      });
    } catch (error) {
      logger(`Login failed: ${error.message}`, 'error');
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Login with credentials (email/password)
   */
  async loginWithCredentials(email, password, options = {}) {
    try {
      const credentials = { email, password };
      const loginOptions = { ...this.options, ...options };

      logger('Logging in with credentials...', 'info');

      return new Promise((resolve, reject) => {
        login(credentials, loginOptions, (err, api) => {
          if (err) {
            this.emit('error', err);
            return reject(err);
          }

          this.api = api;
          this.setupApiEventHandlers();
          this.isReady = true;

          this.emit('ready', api, api.getCurrentUserID());
          resolve(api);
        });
      });
    } catch (error) {
      logger(`Login failed: ${error.message}`, 'error');
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Setup API event handlers
   */
  setupApiEventHandlers() {
    if (!this.api) return;

    // Setup message listener
    this.api.listenMqtt((err, event) => {
      if (err) {
        this.errorHandler.handleCriticalError(err, 'messageListener');
        return;
      }

      this.handleIncomingEvent(event);
    });
  }

  /**
   * Handle incoming events with enhanced processing
   */
  async handleIncomingEvent(event) {
    try {
      // Apply middleware
      for (const middleware of this.middleware) {
        event = await middleware(event) || event;
      }

      // Process different event types
      switch (event.type) {
        case 'message':
          await this.handleMessage(event);
          break;
        case 'message_reply':
          await this.handleMessageReply(event);
          break;
        case 'message_reaction':
          this.emit('reaction', this.createReactionObject(event));
          break;
        case 'message_unsend':
          this.emit('unsend', this.createUnsendObject(event));
          break;
        case 'event':
          this.emit('event', this.createEventObject(event));
          break;
        case 'typ':
          this.emit('typing', this.createTypingObject(event));
          break;
        case 'presence':
          this.emit('presence', this.createPresenceObject(event));
          break;
        default:
          this.emit('others', event);
      }
    } catch (error) {
      this.errorHandler.handleCriticalError(error, 'eventHandling');
    }
  }

  /**
   * Handle message events
   */
  async handleMessage(event) {
    const message = this.createMessageObject(event);
    
    // Cache message
    this.messageCache.set(message.messageID, message);

    // Auto-mark as delivered/read if enabled
    if (this.options.autoMarkDelivery) {
      await this.safeApiCall(() => 
        this.api.markAsDelivered(message.threadID, message.messageID)
      );
    }

    if (this.options.autoMarkRead) {
      await this.safeApiCall(() => 
        this.api.markAsRead(message.threadID)
      );
    }

    // Emit message event
    this.emit('message', message);

    // Check for commands
    if (this.options.prefix && message.body.startsWith(this.options.prefix)) {
      await this.handleCommand(message);
    }
  }

  /**
   * Handle command processing
   */
  async handleCommand(message) {
    try {
      const args = message.body.slice(this.options.prefix.length).trim().split(/\s+/);
      const commandName = args.shift().toLowerCase();
      
      const command = {
        name: commandName,
        args: args,
        message: message,
        client: this
      };

      // Don't emit message event for commands if configured
      if (!this.options.ignoreMessageInCommandEvent) {
        this.emit('message', message);
      }

      this.emit('command', command);
    } catch (error) {
      logger(`Command processing error: ${error.message}`, 'error');
    }
  }

  /**
   * Handle message reply events
   */
  async handleMessageReply(event) {
    const message = this.createMessageObject(event);
    message.messageReply = event.messageReply;
    
    this.emit('messageReply', message);
    
    // Also emit as regular message
    this.emit('message', message);

    // Check for commands
    if (this.options.prefix && message.body.startsWith(this.options.prefix)) {
      await this.handleCommand(message);
    }
  }

  /**
   * Create enhanced message object
   */
  createMessageObject(event) {
    const message = new Message(this, event);
    
    // Add utility methods
    message.reply = async (content, options = {}) => {
      return this.sendMessage(content, message.threadID, options);
    };

    message.react = async (emoji) => {
      return this.safeApiCall(() => 
        this.api.setMessageReaction(emoji, message.messageID)
      );
    };

    message.unsend = async () => {
      return this.safeApiCall(() => 
        this.api.unsendMessage(message.messageID)
      );
    };

    return message;
  }

  /**
   * Create reaction object
   */
  createReactionObject(event) {
    return {
      messageID: event.messageID,
      threadID: event.threadID,
      reaction: event.reaction,
      senderID: event.senderID,
      userID: event.userID,
      timestamp: event.reactionTimestamp || Date.now()
    };
  }

  /**
   * Create unsend object
   */
  createUnsendObject(event) {
    return {
      messageID: event.messageID,
      threadID: event.threadID,
      senderID: event.senderID,
      deletionTimestamp: event.deletionTimestamp || Date.now()
    };
  }

  /**
   * Create event object
   */
  createEventObject(event) {
    return {
      type: event.logMessageType,
      threadID: event.threadID,
      author: event.author,
      body: event.logMessageBody,
      data: event.logMessageData,
      participantIDs: event.participantIDs || [],
      timestamp: event.timestamp || Date.now()
    };
  }

  /**
   * Create typing object
   */
  createTypingObject(event) {
    return {
      isTyping: event.isTyping,
      from: event.from,
      threadID: event.threadID,
      fromMobile: event.fromMobile || false
    };
  }

  /**
   * Create presence object
   */
  createPresenceObject(event) {
    return {
      userID: event.userID,
      status: event.statuses,
      timestamp: event.timestamp
    };
  }

  /**
   * Enhanced send message with error handling
   */
  async sendMessage(content, threadID, options = {}) {
    return this.safeApiCall(async () => {
      return new Promise((resolve, reject) => {
        this.api.sendMessage(content, threadID, (err, messageInfo) => {
          if (err) reject(err);
          else resolve(messageInfo);
        }, options.messageID);
      });
    }, 'sendMessage');
  }

  /**
   * Get thread information with caching
   */
  async getThreadInfo(threadID) {
    // Check cache first
    const cached = this.threadCache.get(threadID);
    if (cached) return cached;

    return this.safeApiCall(async () => {
      return new Promise((resolve, reject) => {
        this.api.getThreadInfo(threadID, (err, info) => {
          if (err) reject(err);
          else {
            this.threadCache.set(threadID, info);
            resolve(info);
          }
        });
      });
    }, 'getThreadInfo');
  }

  /**
   * Get user information with caching
   */
  async getUserInfo(userID) {
    // Check cache first
    const cached = this.userCache.get(userID);
    if (cached) return cached;

    return this.safeApiCall(async () => {
      return new Promise((resolve, reject) => {
        this.api.getUserInfo(userID, (err, info) => {
          if (err) reject(err);
          else {
            this.userCache.set(userID, info);
            resolve(info);
          }
        });
      });
    }, 'getUserInfo');
  }

  /**
   * Safe API call wrapper
   */
  async safeApiCall(apiFunction, context = 'unknown') {
    if (!this.api) {
      throw new Error('API not initialized. Please login first.');
    }

    return this.errorHandler.safeExecute(apiFunction, null, context);
  }

  /**
   * Add middleware for event processing
   */
  use(middleware) {
    if (typeof middleware !== 'function') {
      throw new Error('Middleware must be a function');
    }
    this.middleware.push(middleware);
  }

  /**
   * Register command handler
   */
  registerCommand(name, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Command handler must be a function');
    }
    this.commands.set(name.toLowerCase(), handler);
    logger(`Command registered: ${name}`, 'info');
  }

  /**
   * Load commands from directory
   */
  loadCommands(directory) {
    const fs = require('fs');
    const path = require('path');

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
      return;
    }

    const files = fs.readdirSync(directory).filter(f => f.endsWith('.js'));
    
    for (const file of files) {
      try {
        const command = require(path.join(directory, file));
        if (command.name && typeof command.execute === 'function') {
          this.registerCommand(command.name, command.execute);
          logger(`Loaded command: ${command.name}`, 'info');
        }
      } catch (error) {
        logger(`Failed to load command ${file}: ${error.message}`, 'error');
      }
    }
  }

  /**
   * Get client status and metrics
   */
  getStatus() {
    return {
      isReady: this.isReady,
      currentUserID: this.api?.getCurrentUserID() || null,
      commandsLoaded: this.commands.size,
      middlewareCount: this.middleware.length,
      cacheStats: {
        messages: this.messageCache.size,
        users: this.userCache.size,
        threads: this.threadCache.size
      },
      performance: this.performanceManager.getMetrics(),
      errors: this.errorHandler.generateErrorReport()
    };
  }

  /**
   * Clear caches
   */
  clearCache() {
    this.messageCache.clear();
    this.userCache.clear();
    this.threadCache.clear();
    this.performanceManager.clearCache();
    logger('All caches cleared', 'info');
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger('Shutting down Nexus Client...', 'info');
    
    if (this.api && typeof this.api.logout === 'function') {
      await this.safeApiCall(() => this.api.logout());
    }

    this.clearCache();
    this.removeAllListeners();
    
    logger('Nexus Client shutdown complete', 'info');
  }
}

module.exports = NexusClient;
