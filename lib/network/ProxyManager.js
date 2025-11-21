"use strict";

/**
 * ProxyManager.js - Advanced Proxy Support
 * Supports HTTP/HTTPS/SOCKS proxies for all connections
 * Compatible with HttpsProxyAgent for WebSocket and HTTP requests
 */

const logger = require('../logger');

class ProxyManager {
    constructor(proxyUrl = null) {
        this.proxyUrl = proxyUrl;
        this.proxyAgent = null;
        this.proxyType = null;
        
        if (proxyUrl) {
            this.configureProxy(proxyUrl);
        }
    }

    /**
     * Configure proxy settings
     * @param {string} proxyUrl - Proxy URL (http://host:port or socks5://host:port)
     */
    configureProxy(proxyUrl) {
        if (!proxyUrl) {
            this.proxyUrl = null;
            this.proxyAgent = null;
            this.proxyType = null;
            logger("Proxy disabled", "info");
            return;
        }

        try {
            const url = new URL(proxyUrl);
            this.proxyUrl = proxyUrl;
            this.proxyType = url.protocol.replace(':', '');

            logger(`Configuring ${this.proxyType} proxy: ${url.hostname}:${url.port}`, "info");

            // Create appropriate agent based on proxy type
            if (this.proxyType === 'http' || this.proxyType === 'https') {
                const { HttpsProxyAgent } = require('https-proxy-agent');
                this.proxyAgent = new HttpsProxyAgent(proxyUrl);
                logger("HTTP/HTTPS proxy agent created", "info");
            } else if (this.proxyType === 'socks' || this.proxyType === 'socks5' || this.proxyType === 'socks4') {
                const { SocksProxyAgent } = require('socks-proxy-agent');
                this.proxyAgent = new SocksProxyAgent(proxyUrl);
                logger("SOCKS proxy agent created", "info");
            } else {
                throw new Error(`Unsupported proxy protocol: ${this.proxyType}`);
            }

        } catch (error) {
            logger(`Proxy configuration error: ${error.message}`, "error");
            throw new Error(`Invalid proxy URL: ${error.message}`);
        }
    }

    /**
     * Get proxy agent for HTTP requests
     * @returns {Object|null} Proxy agent or null if no proxy
     */
    getHttpAgent() {
        return this.proxyAgent;
    }

    /**
     * Get proxy agent for WebSocket connections
     * @returns {Object|null} Proxy agent or null if no proxy
     */
    getWsAgent() {
        return this.proxyAgent;
    }

    /**
     * Get axios config with proxy settings
     * @returns {Object} Axios configuration object
     */
    getAxiosConfig() {
        if (!this.proxyAgent) {
            return {};
        }

        return {
            httpsAgent: this.proxyAgent,
            proxy: false // Disable axios built-in proxy, use agent instead
        };
    }

    /**
     * Get WebSocket options with proxy
     * @returns {Object} WebSocket options
     */
    getWebSocketOptions() {
        if (!this.proxyAgent) {
            return {};
        }

        return {
            agent: this.proxyAgent
        };
    }

    /**
     * Test proxy connection
     * @returns {Promise<boolean>} True if proxy is working
     */
    async testProxy() {
        if (!this.proxyUrl) {
            logger("No proxy configured to test", "warn");
            return true;
        }

        try {
            const axios = require('axios');
            logger("Testing proxy connection...", "info");

            const response = await axios.get('https://www.facebook.com', {
                ...this.getAxiosConfig(),
                timeout: 10000,
                validateStatus: () => true // Accept any status
            });

            if (response.status === 200 || response.status === 302) {
                logger("Proxy connection test successful", "info");
                return true;
            } else {
                logger(`Proxy test returned status ${response.status}`, "warn");
                return false;
            }

        } catch (error) {
            logger(`Proxy test failed: ${error.message}`, "error");
            return false;
        }
    }

    /**
     * Get proxy info for logging
     * @returns {Object} Proxy information
     */
    getInfo() {
        if (!this.proxyUrl) {
            return {
                enabled: false,
                type: null,
                host: null,
                port: null
            };
        }

        const url = new URL(this.proxyUrl);
        return {
            enabled: true,
            type: this.proxyType,
            host: url.hostname,
            port: url.port,
            username: url.username || null
        };
    }

    /**
     * Check if proxy is configured
     * @returns {boolean} True if proxy is active
     */
    isEnabled() {
        return this.proxyAgent !== null;
    }

    /**
     * Apply proxy to MQTT connection options
     * @param {Object} mqttOptions - MQTT connection options
     * @returns {Object} Modified MQTT options with proxy
     */
    applyToMqttOptions(mqttOptions) {
        if (!this.proxyAgent) {
            return mqttOptions;
        }

        // Apply proxy agent to WebSocket options
        if (!mqttOptions.wsOptions) {
            mqttOptions.wsOptions = {};
        }

        mqttOptions.wsOptions.agent = this.proxyAgent;
        logger("Applied proxy to MQTT connection", "info");

        return mqttOptions;
    }

    /**
     * Create a new proxy manager from environment variables
     * @returns {ProxyManager} New proxy manager instance
     */
    static fromEnv() {
        const proxyUrl = process.env.NEXUS_PROXY 
            || process.env.HTTP_PROXY 
            || process.env.HTTPS_PROXY 
            || process.env.ALL_PROXY;

        if (proxyUrl) {
            logger(`Loading proxy from environment: ${proxyUrl.split('@').pop()}`, "info");
            return new ProxyManager(proxyUrl);
        }

        return new ProxyManager();
    }
}

module.exports = ProxyManager;
