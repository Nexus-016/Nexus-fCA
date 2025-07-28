/**
 * Nexus-FCA Advanced Safety Module - Maximum Facebook Account Protection
 * Designed to minimize ban, lock, checkpoint, and block rates
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class FacebookSafety {
    constructor(options = {}) {
        this.options = {
            enableSafeHeaders: true,
            enableHumanBehavior: true,
            enableAntiDetection: true,
            enableAutoRefresh: true,
            enableLoginValidation: true,
            enableSafeDelays: true,
            bypassRegionLock: true,
            ultraLowBanMode: true,
            ...options
        };

        // Safe user agents that reduce detection risk
        this.safeUserAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
        ];

        this.safeDomains = [
            'https://www.facebook.com',
            'https://m.facebook.com',
            'https://mbasic.facebook.com'
        ];

        this.regions = ['ASH', 'ATL', 'DFW', 'ORD', 'PHX', 'SJC', 'IAD'];
        this.currentRegion = this.regions[Math.floor(Math.random() * this.regions.length)];

        this.humanDelayPatterns = {
            typing: { min: 800, max: 2000 },
            reading: { min: 1000, max: 3000 },
            thinking: { min: 2000, max: 5000 },
            browsing: { min: 500, max: 1500 }
        };

        this.sessionMetrics = {
            requestCount: 0,
            errorCount: 0,
            lastActivity: Date.now(),
            riskLevel: 'low'
        };

        this.initSafety();
    }

    initSafety() {
        // Initialize safety monitoring
        if (this.options.enableAutoRefresh) {
            this.setupSafeRefresh();
        }

        // Setup session monitoring
        this.setupSessionMonitoring();
    }

    /**
     * Get safe user agent that reduces detection risk
     */
    getSafeUserAgent() {
        return this.safeUserAgents[Math.floor(Math.random() * this.safeUserAgents.length)];
    }

    /**
     * Apply safe headers to reduce detection risk
     */
    applySafeHeaders(originalHeaders = {}) {
        const safeHeaders = {
            'User-Agent': this.getSafeUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0',
            ...originalHeaders
        };

        if (this.currentRegion) {
            safeHeaders['X-MSGR-Region'] = this.currentRegion;
        }

        return safeHeaders;
    }

    /**
     * Generate human-like delay patterns
     */
    getHumanDelay(action = 'browsing') {
        if (!this.options.enableSafeDelays) return 0;
        
        const pattern = this.humanDelayPatterns[action] || this.humanDelayPatterns.browsing;
        const baseDelay = Math.random() * (pattern.max - pattern.min) + pattern.min;
        
        // Add randomness to make it more human-like
        const variation = baseDelay * 0.2 * (Math.random() - 0.5);
        return Math.max(100, Math.floor(baseDelay + variation));
    }

    /**
     * Apply safe request options to reduce ban risk
     */
    applySafeRequestOptions(options = {}) {
        const safeOptions = {
            ...options,
            headers: this.applySafeHeaders(options.headers),
            timeout: options.timeout || 30000,
            followRedirect: true,
            maxRedirects: 5
        };

        // Apply safe user agent
        safeOptions.userAgent = this.getSafeUserAgent();

        return safeOptions;
    }

    /**
     * Validate login credentials for safety
     */
    validateLogin(appState, email, password) {
        try {
            if (appState) {
                const parsed = typeof appState === 'string' ? JSON.parse(appState) : appState;
                
                // Check for essential cookies
                const hasEssentialCookies = parsed.some(cookie => 
                    ['c_user', 'xs', 'datr', 'sb'].includes(cookie.name || cookie.key)
                );
                
                if (!hasEssentialCookies) {
                    return { safe: false, reason: 'Missing essential authentication cookies' };
                }

                // Check cookie age (older than 30 days might be risky)
                const oldCookies = parsed.filter(cookie => {
                    const expires = new Date(cookie.expires || cookie.expirationDate);
                    const age = Date.now() - expires.getTime();
                    return age > (30 * 24 * 60 * 60 * 1000); // 30 days
                });

                if (oldCookies.length > parsed.length * 0.5) {
                    return { safe: false, reason: 'Most cookies are too old, refresh appstate' };
                }
            }

            return { safe: true, reason: 'Login credentials validated' };
        } catch (error) {
            return { safe: false, reason: `Login validation failed: ${error.message}` };
        }
    }

    /**
     * Validate current session for safety
     */
    validateSession(ctx) {
        if (!ctx) {
            return { safe: false, reason: 'No session context available' };
        }

        if (!ctx.userID || !ctx.jar) {
            return { safe: false, reason: 'Session missing essential data' };
        }

        // Check risk level
        if (this.sessionMetrics.riskLevel === 'high') {
            return { safe: false, reason: 'Session risk level too high' };
        }

        return { safe: true, reason: 'Session validated successfully' };
    }

    /**
     * Check if an error indicates potential account safety issue
     */
    checkErrorSafety(error) {
        const dangerousPatterns = [
            'checkpoint',
            'verification_required',
            'account_locked',
            'temporarily_blocked',
            'unusual_activity',
            'security_check',
            'login_approval',
            'account_suspended'
        ];

        const errorText = (error.message || error.toString()).toLowerCase();
        
        for (const pattern of dangerousPatterns) {
            if (errorText.includes(pattern)) {
                return {
                    safe: false,
                    danger: pattern,
                    recommendation: 'Stop all operations immediately'
                };
            }
        }

        return { safe: true, danger: null };
    }

    /**
     * Setup safe token refresh intervals
     */
    setupSafeRefresh() {
        // Refresh tokens every 45 minutes with randomization
        const baseInterval = 45 * 60 * 1000; // 45 minutes
        const randomVariation = Math.random() * 10 * 60 * 1000; // ±10 minutes
        const interval = baseInterval + randomVariation;

        setInterval(() => {
            this.refreshSafeSession();
        }, interval);
    }

    /**
     * Setup session monitoring
     */
    setupSessionMonitoring() {
        setInterval(() => {
            this.updateRiskLevel();
        }, 60000); // Check every minute
    }

    /**
     * Update session risk level based on activity patterns
     */
    updateRiskLevel() {
        const timeSinceLastActivity = Date.now() - this.sessionMetrics.lastActivity;
        const errorRate = this.sessionMetrics.errorCount / Math.max(1, this.sessionMetrics.requestCount);

        if (errorRate > 0.3 || timeSinceLastActivity < 1000) {
            this.sessionMetrics.riskLevel = 'high';
        } else if (errorRate > 0.1 || timeSinceLastActivity < 5000) {
            this.sessionMetrics.riskLevel = 'medium';
        } else {
            this.sessionMetrics.riskLevel = 'low';
        }
    }

    /**
     * Record request for safety metrics
     */
    recordRequest(isError = false) {
        this.sessionMetrics.requestCount++;
        this.sessionMetrics.lastActivity = Date.now();
        
        if (isError) {
            this.sessionMetrics.errorCount++;
        }
    }

    /**
     * Start safety monitoring for session
     */
    startMonitoring(ctx, api) {
        if (!ctx || !api) return;

        // Monitor for account issues
        setInterval(() => {
            this.checkAccountHealth(ctx, api);
        }, 30000); // Check every 30 seconds
    }

    /**
     * Check account health for potential issues
     */
    async checkAccountHealth(ctx, api) {
        try {
            // Basic health check - ensure we're still logged in
            if (ctx.jar) {
                const cookies = ctx.jar.getCookies('https://www.facebook.com');
                const userCookie = cookies.find(c => c.key === 'c_user');
                
                if (!userCookie) {
                    this.emit('accountIssue', {
                        type: 'session_expired',
                        message: 'User session cookie missing'
                    });
                }
            }
        } catch (error) {
            this.recordRequest(true);
            
            const safetyCheck = this.checkErrorSafety(error);
            if (!safetyCheck.safe) {
                this.emit('accountIssue', {
                    type: safetyCheck.danger,
                    message: error.message,
                    recommendation: safetyCheck.recommendation
                });
            }
        }
    }

    /**
     * Refresh session safely
     */
    async refreshSafeSession() {
        // Implement safe session refresh logic
        console.log('🔄 Performing safe session refresh...');
    }

    /**
     * Get safety recommendations based on current state
     */
    getSafetyRecommendations() {
        const recommendations = [];
        
        if (this.sessionMetrics.riskLevel === 'high') {
            recommendations.push('Reduce request frequency');
            recommendations.push('Add longer delays between actions');
        }

        if (this.sessionMetrics.errorCount > 5) {
            recommendations.push('Check account status manually');
            recommendations.push('Consider using fresh appstate');
        }

        return recommendations;
    }

    /**
     * Generate safe request timing
     */
    getNextSafeRequestTime() {
        const baseDelay = this.getHumanDelay('browsing');
        const riskMultiplier = this.sessionMetrics.riskLevel === 'high' ? 3 : 
                              this.sessionMetrics.riskLevel === 'medium' ? 2 : 1;
        
        return baseDelay * riskMultiplier;
    }

    /**
     * Emit safety events
     */
    emit(event, data) {
        if (typeof this.onSafetyEvent === 'function') {
            this.onSafetyEvent(event, data);
        }
    }

    /**
     * Set safety event handler
     */
    setSafetyEventHandler(handler) {
        this.onSafetyEvent = handler;
    }
}

module.exports = FacebookSafety;
