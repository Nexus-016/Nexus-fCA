"use strict";

// Nexus-FCA: Enhanced MQTT Connection Manager
// Advanced reconnection, error handling, and performance optimizations

const mqtt = require("mqtt");
const WebSocket = require("ws");
const EventEmitter = require("events");
const logger = require("../logger");

class MqttManager extends EventEmitter {
    constructor(ctx, defaultFuncs) {
        super();
        this.ctx = ctx;
        this.defaultFuncs = defaultFuncs;
        this.client = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000; // Start with 1 second
        this.maxReconnectDelay = 30000; // Max 30 seconds
        this.heartbeatInterval = null;
        this.connectionTimeout = null;
        this.lastActivity = Date.now();

        // Performance metrics
        this.metrics = {
            messagesReceived: 0,
            messagesSent: 0,
            reconnections: 0,
            errors: 0,
            lastConnected: null,
            uptime: 0
        };

        // Message queue for offline messages
        this.messageQueue = [];
        this.maxQueueSize = 1000;
    }

    /**
     * Connect to MQTT with enhanced stability
     */
    async connect() {
        try {
            if (this.isConnected) {
                logger('MQTT already connected', 'warn');
                return;
            }

            logger('🔄 Connecting to MQTT...', 'info');

            const options = this._buildConnectionOptions();
            this.client = mqtt.connect(this.ctx.mqttEndpoint, options);

            this._setupEventHandlers();
            this._startHeartbeat();

            // Connection timeout
            this.connectionTimeout = setTimeout(() => {
                if (!this.isConnected) {
                    logger('❌ MQTT connection timeout', 'error');
                    this._handleReconnect();
                }
            }, 15000);

        } catch (error) {
            logger(`❌ MQTT connection error: ${error.message}`, 'error');
            this.metrics.errors++;
            this._handleReconnect();
        }
    }

    /**
     * Build optimized connection options
     * @private
     */
    _buildConnectionOptions() {
        return {
            clientId: `nexus_fca_${this.ctx.userID}_${Date.now()}`,
            clean: true,
            connectTimeout: 10000,
            reconnectPeriod: 0, // Disable auto-reconnect, we handle it
            keepalive: 10,
            protocolVersion: 4,
            username: JSON.stringify({
                "u": this.ctx.userID,
                "s": this.ctx.syncToken || "",
                "chat_on": true,
                "fg": false,
                "d": this.ctx.clientID,
                "ct": "websocket",
                "mqtt_sid": "",
                "aid": "219994525426954",
                "st": [],
                "pm": [],
                "cp": 3,
                "ecp": 10,
                "chat_on_default": false,
                "no_auto_fg": true,
                "gas": null,
                "pack": []
            }),
            password: "",
            properties: {
                userProperties: {
                    "region": this.ctx.region || "PRN"
                }
            }
        };
    }

    /**
     * Setup enhanced event handlers
     * @private
     */
    _setupEventHandlers() {
        this.client.on('connect', () => {
            this._onConnect();
        });

        this.client.on('message', (topic, message) => {
            this._onMessage(topic, message);
        });

        this.client.on('error', (error) => {
            this._onError(error);
        });

        this.client.on('close', () => {
            this._onClose();
        });

        this.client.on('offline', () => {
            this._onOffline();
        });

        this.client.on('reconnect', () => {
            this._onReconnect();
        });
    }

    /**
     * Handle successful connection
     * @private
     */
    _onConnect() {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.metrics.lastConnected = Date.now();
        this.metrics.reconnections++;

        clearTimeout(this.connectionTimeout);

        logger('✅ MQTT connected successfully', 'info');
        logger(`📊 Connection metrics: Reconnections: ${this.metrics.reconnections}, Errors: ${this.metrics.errors}`, 'info');

        this._subscribeToTopics();
        this._processMessageQueue();

        this.emit('connected');
    }

    /**
     * Subscribe to required topics
     * @private
     */
    _subscribeToTopics() {
        const topics = [
            "/ls_req",
            "/ls_resp",
            "/legacy_web",
            "/webrtc",
            "/rtc_multi",
            "/onevc",
            "/br_sr",
            "/sr_res",
            "/t_ms",
            "/thread_typing",
            "/orca_typing_notifications",
            "/notify_disconnect",
            "/orca_presence",
            "/inbox",
            "/mercury",
            "/messaging_events",
            "/orca_message_notifications",
            "/pp",
            "/webrtc_response"
        ];

        topics.forEach(topic => {
            this.client.subscribe(topic, { qos: 0 }, (err) => {
                if (err) {
                    logger(`❌ Failed to subscribe to ${topic}: ${err.message}`, 'error');
                } else {
                    logger(`📡 Subscribed to ${topic}`, 'info');
                }
            });
        });
    }

    /**
     * Handle incoming messages with enhanced processing
     * @private
     */
    _onMessage(topic, message) {
        try {
            this.lastActivity = Date.now();
            this.metrics.messagesReceived++;

            const messageStr = message.toString();
            let parsedMessage;

            try {
                parsedMessage = JSON.parse(messageStr);
            } catch (parseError) {
                logger(`❌ Failed to parse MQTT message: ${parseError.message}`, 'warn');
                return;
            }

            // Enhanced message processing with caching
            this._processMessage(topic, parsedMessage);

        } catch (error) {
            logger(`❌ Error processing MQTT message: ${error.message}`, 'error');
            this.metrics.errors++;
        }
    }

    /**
     * Process messages with enhanced logic
     * @private
     */
    _processMessage(topic, message) {
        // Emit to main listener with enhanced data
        this.emit('message', {
            topic,
            message,
            timestamp: Date.now(),
            processed: true
        });

        // Update sync tokens and sequence IDs
        if (message.syncToken) {
            this.ctx.syncToken = message.syncToken;
        }

        if (message.lastIssuedSeqId) {
            this.ctx.lastSeqId = parseInt(message.lastIssuedSeqId);
        }
    }

    /**
     * Handle connection errors
     * @private
     */
    _onError(error) {
        logger(`❌ MQTT Error: ${error.message}`, 'error');
        this.metrics.errors++;
        this.emit('error', error);
    }

    /**
     * Handle connection close
     * @private
     */
    _onClose() {
        this.isConnected = false;
        logger('🔌 MQTT connection closed', 'warn');
        this._stopHeartbeat();
        this.emit('disconnected');

        // Auto-reconnect if not intentionally closed
        if (this.client && !this.client.disconnecting) {
            this._handleReconnect();
        }
    }

    /**
     * Handle offline state
     * @private
     */
    _onOffline() {
        this.isConnected = false;
        logger('📡 MQTT went offline', 'warn');
        this.emit('offline');
    }

    /**
     * Handle reconnection events
     * @private
     */
    _onReconnect() {
        logger('🔄 MQTT attempting to reconnect...', 'info');
    }

    /**
     * Enhanced reconnection with exponential backoff
     * @private
     */
    _handleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger('❌ Max MQTT reconnection attempts reached', 'error');
            this.emit('maxReconnectAttemptsReached');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);

        logger(`🔄 MQTT reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 'warn');

        setTimeout(() => {
            this.connect();
        }, delay);
    }

    /**
     * Send message with queue fallback
     */
    publish(topic, message, options = {}) {
        const messageData = {
            topic,
            message: typeof message === 'string' ? message : JSON.stringify(message),
            options,
            timestamp: Date.now()
        };

        if (this.isConnected && this.client) {
            this.client.publish(topic, messageData.message, options, (err) => {
                if (err) {
                    logger(`❌ Failed to publish to ${topic}: ${err.message}`, 'error');
                    this._queueMessage(messageData);
                } else {
                    this.metrics.messagesSent++;
                }
            });
        } else {
            this._queueMessage(messageData);
        }
    }

    /**
     * Queue message for later delivery
     * @private
     */
    _queueMessage(messageData) {
        if (this.messageQueue.length >= this.maxQueueSize) {
            this.messageQueue.shift(); // Remove oldest message
            logger('⚠️ Message queue full, dropping oldest message', 'warn');
        }

        this.messageQueue.push(messageData);
        logger(`📦 Queued message for ${messageData.topic} (queue size: ${this.messageQueue.length})`, 'info');
    }

    /**
     * Process queued messages
     * @private
     */
    _processMessageQueue() {
        if (this.messageQueue.length === 0) return;

        logger(`📦 Processing ${this.messageQueue.length} queued messages`, 'info');

        const messages = [...this.messageQueue];
        this.messageQueue = [];

        messages.forEach(messageData => {
            this.publish(messageData.topic, messageData.message, messageData.options);
        });
    }

    /**
     * Start heartbeat mechanism
     * @private
     */
    _startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected && this.client) {
                // Check if we've been inactive for too long
                const inactiveTime = Date.now() - this.lastActivity;
                if (inactiveTime > 300000) { // 5 minutes
                    logger('💓 MQTT heartbeat - inactive for 5 minutes, sending ping', 'info');
                    this.client.ping();
                }

                // Update uptime
                if (this.metrics.lastConnected) {
                    this.metrics.uptime = Date.now() - this.metrics.lastConnected;
                }
            }
        }, 60000); // Every minute
    }

    /**
     * Stop heartbeat mechanism
     * @private
     */
    _stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * Get connection metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            isConnected: this.isConnected,
            queueSize: this.messageQueue.length,
            uptime: this.metrics.lastConnected ? Date.now() - this.metrics.lastConnected : 0
        };
    }

    /**
     * Graceful disconnect
     */
    disconnect() {
        logger('🔌 Disconnecting MQTT gracefully...', 'info');

        this._stopHeartbeat();

        if (this.client) {
            this.client.publish("/browser_close", "{}", { qos: 0 });
            this.client.end(false, () => {
                logger('✅ MQTT disconnected gracefully', 'info');
                this.emit('disconnected');
            });
        }

        this.isConnected = false;
    }

    /**
     * Force disconnect
     */
    forceDisconnect() {
        logger('⚡ Force disconnecting MQTT...', 'warn');

        this._stopHeartbeat();

        if (this.client) {
            this.client.end(true);
        }

        this.isConnected = false;
        this.emit('disconnected');
    }
}

module.exports = MqttManager;
