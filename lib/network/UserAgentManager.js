"use strict";

/**
 * UserAgentManager.js - Random User Agent Support
 * Provides realistic user agents to avoid detection
 * Supports random rotation and consistent fingerprinting
 */

const logger = require('../logger');

class UserAgentManager {
    constructor(options = {}) {
        this.randomEnabled = options.random || false;
        this.currentUA = null;
        this.userAgentPool = this.buildUserAgentPool();
    }

    /**
     * Build pool of realistic user agents
     * @returns {Array<Object>} User agent pool with metadata
     */
    buildUserAgentPool() {
        return [
            // Chrome on Windows
            {
                ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                browser: "Chrome",
                os: "Windows",
                version: "131"
            },
            {
                ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
                browser: "Chrome",
                os: "Windows",
                version: "130"
            },
            {
                ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
                browser: "Chrome",
                os: "Windows",
                version: "129"
            },
            
            // Chrome on macOS
            {
                ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                browser: "Chrome",
                os: "macOS",
                version: "131"
            },
            {
                ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
                browser: "Chrome",
                os: "macOS",
                version: "130"
            },
            
            // Edge on Windows
            {
                ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
                browser: "Edge",
                os: "Windows",
                version: "131"
            },
            {
                ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
                browser: "Edge",
                os: "Windows",
                version: "130"
            },
            
            // Firefox on Windows
            {
                ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
                browser: "Firefox",
                os: "Windows",
                version: "132"
            },
            {
                ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
                browser: "Firefox",
                os: "Windows",
                version: "131"
            },
            
            // Firefox on macOS
            {
                ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:132.0) Gecko/20100101 Firefox/132.0",
                browser: "Firefox",
                os: "macOS",
                version: "132"
            },
            
            // Safari on macOS
            {
                ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
                browser: "Safari",
                os: "macOS",
                version: "18.1"
            },
            {
                ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
                browser: "Safari",
                os: "macOS",
                version: "17.6"
            },
            
            // Chrome on Linux
            {
                ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                browser: "Chrome",
                os: "Linux",
                version: "131"
            },
            {
                ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
                browser: "Chrome",
                os: "Linux",
                version: "130"
            },
        ];
    }

    /**
     * Get a random user agent from the pool
     * @param {Object} filters - Optional filters (browser, os)
     * @returns {string} Random user agent string
     */
    getRandomUserAgent(filters = {}) {
        let pool = this.userAgentPool;

        // Apply filters
        if (filters.browser) {
            pool = pool.filter(ua => ua.browser.toLowerCase() === filters.browser.toLowerCase());
        }
        if (filters.os) {
            pool = pool.filter(ua => ua.os.toLowerCase() === filters.os.toLowerCase());
        }

        if (pool.length === 0) {
            logger("No user agents match filters, using default pool", "warn");
            pool = this.userAgentPool;
        }

        const selected = pool[Math.floor(Math.random() * pool.length)];
        logger(`Selected user agent: ${selected.browser} ${selected.version} on ${selected.os}`, "info");
        
        return selected.ua;
    }

    /**
     * Get current user agent or set a new one
     * @param {Object} options - Options for user agent selection
     * @returns {string} User agent string
     */
    getUserAgent(options = {}) {
        // If custom UA provided, use it
        if (options.userAgent) {
            this.currentUA = options.userAgent;
            this.randomEnabled = false;
            return this.currentUA;
        }

        // If random enabled and no current UA, pick one
        if (this.randomEnabled && !this.currentUA) {
            this.currentUA = this.getRandomUserAgent(options.filters || {});
            return this.currentUA;
        }

        // If current UA exists and random is disabled, keep it
        if (this.currentUA && !this.randomEnabled) {
            return this.currentUA;
        }

        // Default fallback
        if (!this.currentUA) {
            this.currentUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
        }

        return this.currentUA;
    }

    /**
     * Enable random user agent rotation
     * @param {Object} filters - Optional filters for user agent selection
     */
    enableRandom(filters = {}) {
        this.randomEnabled = true;
        this.currentUA = this.getRandomUserAgent(filters);
        logger("Random user agent enabled", "info");
    }

    /**
     * Disable random user agent rotation
     */
    disableRandom() {
        this.randomEnabled = false;
        logger("Random user agent disabled", "info");
    }

    /**
     * Set a specific user agent
     * @param {string} userAgent - User agent string
     */
    setUserAgent(userAgent) {
        this.currentUA = userAgent;
        this.randomEnabled = false;
        logger(`Custom user agent set: ${userAgent.substring(0, 50)}...`, "info");
    }

    /**
     * Get user agent metadata
     * @returns {Object} User agent information
     */
    getInfo() {
        const currentEntry = this.userAgentPool.find(ua => ua.ua === this.currentUA);
        
        return {
            userAgent: this.currentUA,
            randomEnabled: this.randomEnabled,
            browser: currentEntry?.browser || 'Unknown',
            os: currentEntry?.os || 'Unknown',
            version: currentEntry?.version || 'Unknown'
        };
    }

    /**
     * Rotate to a new random user agent
     * @param {Object} filters - Optional filters
     * @returns {string} New user agent
     */
    rotate(filters = {}) {
        if (!this.randomEnabled) {
            logger("Random user agent is disabled, cannot rotate", "warn");
            return this.currentUA;
        }

        const oldUA = this.currentUA;
        this.currentUA = this.getRandomUserAgent(filters);
        
        logger(`User agent rotated from ${oldUA?.substring(0, 30)}... to ${this.currentUA.substring(0, 30)}...`, "info");
        
        return this.currentUA;
    }

    /**
     * Get list of available browsers
     * @returns {Array<string>} Browser names
     */
    getAvailableBrowsers() {
        return [...new Set(this.userAgentPool.map(ua => ua.browser))];
    }

    /**
     * Get list of available operating systems
     * @returns {Array<string>} OS names
     */
    getAvailableOS() {
        return [...new Set(this.userAgentPool.map(ua => ua.os))];
    }

    /**
     * Create user agent manager from environment variables
     * @returns {UserAgentManager} New instance
     */
    static fromEnv() {
        const randomEnabled = process.env.NEXUS_RANDOM_USER_AGENT === 'true';
        const customUA = process.env.NEXUS_USER_AGENT;

        const manager = new UserAgentManager({ random: randomEnabled });

        if (customUA) {
            manager.setUserAgent(customUA);
        } else if (randomEnabled) {
            manager.enableRandom();
        }

        return manager;
    }
}

module.exports = UserAgentManager;
