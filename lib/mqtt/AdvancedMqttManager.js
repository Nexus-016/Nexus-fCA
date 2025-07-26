"use strict";

/**
 * Nexus-FCA Advanced MQTT Manager
 * Enhanced MQTT connection handling with auto-reconnection, heartbeat, and error recovery
 */

const EventEmitter = require('events');
const mqtt = require('mqtt');
const WebSocket = require('ws');
const HttpsProxyAgent = require('https-proxy-agent');
const logger = require('../logger');
const ErrorHandler = require('../error/ErrorHandler');

class AdvancedMqttManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      reconnectInterval: options.reconnectInterval || 3000,
      maxReconnectAttempts: options.maxReconnectAttempts || 10,
      heartbeatInterval: options.heartbeatInterval || 30000,
      connectionTimeout: options.connectionTimeout || 10000,
      enableAutoReconnect: options.enableAutoReconnect !== false,
      enableHeartbeat: options.enableHeartbeat !== false,
      enableProxy: options.enableProxy || false,
      proxyUrl: options.proxyUrl || null,
      ...options
    };

    this.client = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.lastHeartbeat = Date.now();
    this.heartbeatTimer = null;
    this.connectionTimer = null;
    this.errorHandler = new ErrorHandler({ maxRetries: 3 });
    
    this.subscriptions = new Set();
    this.messageQueue = [];
    this.connectionMetrics = {
      connectionAttempts: 0,
      successfulConnections: 0,
      disconnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      lastConnected: null,
      uptime: 0
    };

    // Setup error handling
    this.setupErrorHandling();
  }

  /**
   * Setup error handling and event listeners
   */
  setupErrorHandling() {
    this.errorHandler.on('criticalError', (error) => {
      logger(`MQTT Critical Error: ${error.message}`, 'error');
      this.emit('error', error);
    });

    this.errorHandler.registerFallback('mqttConnect', async (error) => {
      logger('Attempting MQTT fallback connection...', 'warn');
      await this.delay(5000);
      return this.connectWithFallback();
    });
  }

  /**
   * Enhanced connection method with retry logic
   */
  async connect(endpoint, ctx) {
    if (this.isConnecting || this.isConnected) {
      logger('MQTT connection already in progress or established', 'warn');
      return;
    }

    return this.errorHandler.wrapWithRetry(async () => {
      this.isConnecting = true;
      this.connectionMetrics.connectionAttempts++;

      logger(`Connecting to MQTT endpoint: ${endpoint}`, 'info');

      const connectionOptions = this.buildConnectionOptions(endpoint, ctx);
      
      // Set connection timeout
      this.connectionTimer = setTimeout(() => {
        if (this.isConnecting) {
          this.handleConnectionTimeout();
        }
      }, this.options.connectionTimeout);

      try {
        this.client = mqtt.connect(endpoint, connectionOptions);
        this.setupClientEventHandlers(ctx);
        
        // Wait for connection
        await this.waitForConnection();
        
        this.onConnectionSuccess();
        return this.client;
        
      } catch (error) {
        this.onConnectionError(error);
        throw error;
      }
    }, 'mqttConnect');
  }

  /**
   * Build connection options with proxy and authentication
   */
  buildConnectionOptions(endpoint, ctx) {
    const options = {
      clientId: `nexus_fca_${ctx.userID}_${Date.now()}`,
      keepalive: 60,
      reschedulePings: true,
      protocolVersion: 4,
      clean: true,
      reconnectPeriod: 0, // We handle reconnection manually
      connectTimeout: this.options.connectionTimeout,
      rejectUnauthorized: false
    };

    // Add proxy support
    if (this.options.enableProxy && this.options.proxyUrl) {
      const agent = new HttpsProxyAgent(this.options.proxyUrl);
      options.transformWsUrl = (url) => {
        const wsUrl = url.replace('wss://', 'ws://').replace('https://', 'http://');
        return wsUrl;
      };
      options.wsOptions = { agent };
    }

    // Add authentication if available
    if (ctx.mqttAuth) {
      options.username = ctx.mqttAuth.username;
      options.password = ctx.mqttAuth.password;
    }

    return options;
  }

  /**
   * Setup MQTT client event handlers
   */
  setupClientEventHandlers(ctx) {
    this.client.on('connect', () => {
      logger('MQTT connected successfully', 'info');
      this.handleConnect(ctx);
    });

    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message, ctx);
    });

    this.client.on('error', (error) => {
      this.handleError(error);
    });

    this.client.on('close', () => {
      this.handleDisconnect();
    });

    this.client.on('offline', () => {
      logger('MQTT client went offline', 'warn');
      this.isConnected = false;
      this.emit('offline');
    });

    this.client.on('reconnect', () => {
      logger('MQTT attempting reconnection', 'info');
      this.reconnectAttempts++;
    });
  }

  /**
   * Handle successful connection
   */
  handleConnect(ctx) {
    clearTimeout(this.connectionTimer);
    this.isConnected = true;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.connectionMetrics.successfulConnections++;
    this.connectionMetrics.lastConnected = Date.now();

    // Restore subscriptions
    this.restoreSubscriptions();

    // Process queued messages
    this.processMessageQueue();

    // Start heartbeat if enabled
    if (this.options.enableHeartbeat) {
      this.startHeartbeat();
    }

    this.emit('connected', this.client);
  }

  /**
   * Handle connection error
   */
  handleError(error) {
    logger(`MQTT error: ${error.message}`, 'error');
    this.isConnected = false;
    this.isConnecting = false;
    
    this.errorHandler.handleCriticalError(error, 'mqtt');
    this.emit('error', error);

    // Attempt reconnection if enabled
    if (this.options.enableAutoReconnect) {
      this.scheduleReconnection();
    }
  }

  /**
   * Handle disconnection
   */
  handleDisconnect() {
    logger('MQTT disconnected', 'warn');
    this.isConnected = false;
    this.isConnecting = false;
    this.connectionMetrics.disconnections++;

    this.stopHeartbeat();
    this.emit('disconnected');

    // Attempt reconnection if enabled
    if (this.options.enableAutoReconnect) {
      this.scheduleReconnection();
    }
  }

  /**
   * Handle connection timeout
   */
  handleConnectionTimeout() {
    logger('MQTT connection timeout', 'error');
    this.isConnecting = false;
    
    if (this.client) {
      this.client.end(true);
    }

    const timeoutError = new Error('MQTT connection timeout');
    this.handleError(timeoutError);
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  scheduleReconnection() {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      logger('Max reconnection attempts reached. Giving up.', 'error');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    const delay = Math.min(
      this.options.reconnectInterval * Math.pow(2, this.reconnectAttempts),
      30000 // Max 30 seconds
    );

    logger(`Scheduling MQTT reconnection in ${delay}ms (attempt ${this.reconnectAttempts + 1})`, 'info');

    setTimeout(() => {
      if (!this.isConnected && !this.isConnecting) {
        this.reconnect();
      }
    }, delay);
  }

  /**
   * Reconnection method
   */
  async reconnect() {
    if (this.isConnected || this.isConnecting) return;

    logger('Attempting MQTT reconnection...', 'info');
    this.reconnectAttempts++;

    try {
      // Use the same endpoint and context from the last connection
      if (this.lastEndpoint && this.lastContext) {
        await this.connect(this.lastEndpoint, this.lastContext);
      }
    } catch (error) {
      logger(`Reconnection failed: ${error.message}`, 'error');
      this.scheduleReconnection();
    }
  }

  /**
   * Enhanced publish with queue support
   */
  async publish(topic, message, options = {}) {
    const messageData = {
      topic,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      options: {
        qos: 1,
        retain: false,
        ...options
      }
    };

    if (!this.isConnected) {
      // Queue message for later delivery
      this.messageQueue.push(messageData);
      logger(`Message queued for topic: ${topic}`, 'info');
      return;
    }

    return this.errorHandler.wrapWithRetry(async () => {
      return new Promise((resolve, reject) => {
        this.client.publish(
          messageData.topic,
          messageData.message,
          messageData.options,
          (error) => {
            if (error) {
              reject(error);
            } else {
              this.connectionMetrics.messagesSent++;
              resolve();
            }
          }
        );
      });
    }, `mqttPublish:${topic}`);
  }

  /**
   * Enhanced subscribe with persistence
   */
  async subscribe(topics) {
    const topicArray = Array.isArray(topics) ? topics : [topics];
    
    // Store subscriptions for restoration after reconnection
    topicArray.forEach(topic => this.subscriptions.add(topic));

    if (!this.isConnected) {
      logger('Not connected. Subscriptions will be restored on connection.', 'warn');
      return;
    }

    return this.errorHandler.wrapWithRetry(async () => {
      return new Promise((resolve, reject) => {
        this.client.subscribe(topicArray, { qos: 1 }, (error, granted) => {
          if (error) {
            reject(error);
          } else {
            logger(`Subscribed to topics: ${topicArray.join(', ')}`, 'info');
            resolve(granted);
          }
        });
      });
    }, 'mqttSubscribe');
  }

  /**
   * Restore subscriptions after reconnection
   */
  async restoreSubscriptions() {
    if (this.subscriptions.size === 0) return;

    logger(`Restoring ${this.subscriptions.size} subscriptions...`, 'info');
    
    try {
      await this.subscribe(Array.from(this.subscriptions));
      logger('Subscriptions restored successfully', 'info');
    } catch (error) {
      logger(`Failed to restore subscriptions: ${error.message}`, 'error');
    }
  }

  /**
   * Process queued messages
   */
  async processMessageQueue() {
    if (this.messageQueue.length === 0) return;

    logger(`Processing ${this.messageQueue.length} queued messages...`, 'info');

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    for (const messageData of messages) {
      try {
        await this.publish(messageData.topic, messageData.message, messageData.options);
      } catch (error) {
        logger(`Failed to send queued message: ${error.message}`, 'error');
        // Re-queue failed message
        this.messageQueue.push(messageData);
      }
    }
  }

  /**
   * Heartbeat mechanism
   */
  startHeartbeat() {
    this.stopHeartbeat(); // Clear any existing timer
    
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.options.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  async sendHeartbeat() {
    if (!this.isConnected) return;

    try {
      await this.publish('/nexus_fca_heartbeat', {
        timestamp: Date.now(),
        clientId: this.client?.options?.clientId || 'unknown'
      });
      
      this.lastHeartbeat = Date.now();
      this.emit('heartbeat');
    } catch (error) {
      logger(`Heartbeat failed: ${error.message}`, 'error');
    }
  }

  /**
   * Handle incoming messages with error recovery
   */
  handleMessage(topic, message, ctx) {
    try {
      this.connectionMetrics.messagesReceived++;
      
      let parsedMessage;
      try {
        parsedMessage = JSON.parse(message.toString());
      } catch (parseError) {
        parsedMessage = message.toString();
      }

      this.emit('message', topic, parsedMessage, ctx);
    } catch (error) {
      logger(`Error handling message: ${error.message}`, 'error');
      this.errorHandler.handleCriticalError(error, 'messageHandling');
    }
  }

  /**
   * Wait for connection establishment
   */
  waitForConnection() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.options.connectionTimeout);

      this.once('connected', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Fallback connection method
   */
  async connectWithFallback() {
    // Implement alternative connection strategies
    logger('Implementing MQTT fallback connection...', 'warn');
    
    // Try different endpoints or protocols
    const fallbackEndpoints = [
      'wss://edge-chat.facebook.com/chat',
      'wss://gateway.facebook.com/chat'
    ];

    for (const endpoint of fallbackEndpoints) {
      try {
        logger(`Trying fallback endpoint: ${endpoint}`, 'info');
        return await this.connect(endpoint, this.lastContext);
      } catch (error) {
        logger(`Fallback endpoint failed: ${endpoint}`, 'warn');
        continue;
      }
    }

    throw new Error('All fallback endpoints failed');
  }

  /**
   * Get connection status and metrics
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      lastHeartbeat: this.lastHeartbeat,
      subscriptions: Array.from(this.subscriptions),
      queuedMessages: this.messageQueue.length,
      metrics: {
        ...this.connectionMetrics,
        uptime: this.connectionMetrics.lastConnected ? 
          Date.now() - this.connectionMetrics.lastConnected : 0
      }
    };
  }

  /**
   * Graceful shutdown
   */
  async disconnect() {
    logger('Disconnecting MQTT client...', 'info');
    
    this.options.enableAutoReconnect = false;
    this.stopHeartbeat();
    
    if (this.client && this.isConnected) {
      return new Promise((resolve) => {
        this.client.end(false, () => {
          logger('MQTT client disconnected gracefully', 'info');
          resolve();
        });
      });
    }
  }

  /**
   * Utility methods
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AdvancedMqttManager;
