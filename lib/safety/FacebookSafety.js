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
            // NEW: ensure a single stable UA across entire session lifecycle
            enableUAContinuity: true,
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
        // NEW: fixed user agent anchor (set once per session)
        this._fixedUA = null;

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

        // Track last incoming event time to detect stale / dead connections
        this._lastEventTs = Date.now();
        this._reconnecting = false;
        this._activeListenerStop = null; // store stop function from listenMqtt if we attach
        this._safeRefreshInterval = null; // guard for multiple intervals
        this._safeRefreshTimer = null; // for dynamic timeout pattern
        // New stability / heartbeat fields
        this._heartbeatTimer = null;
        this._watchdogTimer = null;
        this._backoff = { attempt: 0, next: 0 };
        this._destroyed = false;
        this._postRefreshChecks = [];
        this._inFlightRefreshId = 0;
        // New: probing guard to avoid overlapping soft-stale probes
        this._probing = false;
        // Ghost detection guard
        this._ghostChecking = false;
        // Periodic recycle timer
        this._periodicRecycleTimer = null;

        this.initSafety();
    }

    initSafety() {
        // Initialize safety monitoring
        if (this.options.enableAutoRefresh) {
            this.setupSafeRefresh();
        }

        // Setup session monitoring
        this.setupSessionMonitoring();
        this._schedulePeriodicRecycle();
    }

    /**
     * Allow external code to explicitly anchor the session UA (e.g. carry over from credential phase)
     */
    setFixedUserAgent(ua){
        if(!ua || typeof ua !== 'string') return;
        this._fixedUA = ua;
    }

    /**
     * Get safe user agent that reduces detection risk (now continuity‑aware)
     */
    getSafeUserAgent() {
        if (this.options.enableUAContinuity) {
            if (this._fixedUA) return this._fixedUA;
            // choose once then cache
            this._fixedUA = this.safeUserAgents[Math.floor(Math.random() * this.safeUserAgents.length)];
            return this._fixedUA;
        }
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

        // Apply stable user agent (continuity aware)
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
        // Replace previous interval/timer to avoid stacking
        if (this._safeRefreshInterval) {
            clearInterval(this._safeRefreshInterval);
            this._safeRefreshInterval = null;
        }
        if (this._safeRefreshTimer) {
            clearTimeout(this._safeRefreshTimer);
            this._safeRefreshTimer = null;
        }
        // USER REQUEST: widen refresh window to random 3–5 hours (stealth longevity)
        // Previous risk-tier windows (25–60m) replaced per instruction.
        const schedule = () => {
            if (this._destroyed) return;
            // Base window 3h–5h. If risk escalates HIGH, clamp to 1h–1.5h for safety.
            let minMs, maxMs;
            if (this.sessionMetrics.riskLevel === 'high') {
                minMs = 60 * 60 * 1000;          // 1h
                maxMs = 90 * 60 * 1000;          // 1.5h
            } else {
                minMs = 3 * 60 * 60 * 1000;      // 3h
                maxMs = 5 * 60 * 60 * 1000;      // 5h
            }
            const interval = minMs + Math.random() * (maxMs - minMs);
            this._safeRefreshTimer = setTimeout(async () => {
                await this.refreshSafeSession();
                schedule();
            }, interval);
        };
        schedule();
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
        this._lastEventTs = Date.now();
    }

    // Expose a method for external caller (e.g., main listener) to update last event timestamp
    recordEvent() {
        this._lastEventTs = Date.now();
    }

    // Internal helper to ensure MQTT connection stays alive / auto-recover if dead after refresh
    async _ensureMqttAlive() {
        if (!this.api || this._destroyed) return;
        try {
            const now = Date.now();
            const disconnected = !this.ctx || !this.ctx.mqttClient || !this.ctx.mqttClient.connected;
            const idle = now - this._lastEventTs;
            const softStale = idle > (2.5 * 60 * 1000); // Stealth profile: 2m30s
            const hardStale = idle > 8 * 60 * 1000; // escalate earlier than watchdog hard (8m)
            const stale = hardStale;
            if (disconnected || stale) {
                await this._reconnectMqttWithBackoff(disconnected ? 'disconnected' : 'hard-stale');
                return;
            }
            if (softStale && !this._probing) {
                this._probing = true;
                const prevTs = this._lastEventTs;
                try { if (this.ctx && this.ctx.mqttClient && this.ctx.mqttClient.connected && typeof this.ctx.mqttClient.ping === 'function') this.ctx.mqttClient.ping(); } catch(_) {}
                setTimeout(() => {
                    if (this._destroyed) return;
                    if (this._lastEventTs <= prevTs) {
                        this._backoff.attempt = 0;
                        this._reconnectMqttWithBackoff('soft-stale');
                    }
                    this._probing = false;
                }, 6000 + Math.random() * 2000); // 6-8s probe window (Stealth+Resilient)
            }
        } catch(_) {}
    }

    // Progressive backoff + jitter reconnect
    async _reconnectMqttWithBackoff(reason) {
        if (this._reconnecting || this._destroyed) return;
        this._reconnecting = true;
        try {
            const now = Date.now();
            if (now < this._backoff.next) { return; }
            const attempt = ++this._backoff.attempt;
            // Stealth backoff: 1.2s * 1.8^n capped ~20s, add jitter 0-500ms
            const baseDelay = Math.min(20000, 1200 * Math.pow(1.8, Math.min(attempt, 6)));
            const jitter = Math.random() * 500;
            const delay = baseDelay + jitter;
            this._backoff.next = now + delay;
            await new Promise(r => setTimeout(r, delay));
            if (this._activeListenerStop && typeof this._activeListenerStop === 'function') { try { this._activeListenerStop(); } catch(_) {} }
            if (this.api && typeof this.api.listenMqtt === 'function' && !this._destroyed) {
                const stop = this.api.listenMqtt((err, event) => { if (!err && event) this.recordEvent(); });
                this._activeListenerStop = stop;
                this.safetyEmit('mqttReconnect', { success: true, reason, attempt, delay });
            }
            setTimeout(() => {
                if (this.ctx && this.ctx.mqttClient && this.ctx.mqttClient.connected) { this._backoff.attempt = 0; }
            }, 5000);
        } catch(e) {
            this.safetyEmit('mqttReconnect', { success: false, error: e.message, reason });
        } finally { this._reconnecting = false; }
    }

    // Public force reconnect (bypass backoff)
    forceReconnect(tag = 'manual') {
        if (this._destroyed) return;
        this._backoff.attempt = 0;
        return this._reconnectMqttWithBackoff('force-' + tag);
    }

    // Schedule periodic recycle (connection rejuvenation) every ~6h (±30m) randomized
    _schedulePeriodicRecycle() {
        if (this._periodicRecycleTimer) clearTimeout(this._periodicRecycleTimer);
        if (this._destroyed) return;
    const base = 6 * 60 * 60 * 1000; // 6h
    const jitter = (Math.random() * 60 - 30) * 60 * 1000; // ±30m
        const delay = base + jitter;
        this._periodicRecycleTimer = setTimeout(() => {
            if (this._destroyed) return;
            this.forceReconnect('periodic');
            this._schedulePeriodicRecycle();
        }, delay);
    }

    // Heartbeat ping & watchdog
    _startHeartbeat() {
        if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
        if (this._watchdogTimer) clearInterval(this._watchdogTimer);
        if (this._destroyed) return;
        // Stealth profile heartbeat: 80–100s random
        this._heartbeatTimer = setInterval(() => {
            if (this._destroyed) return;
            try {
                if (this.ctx && this.ctx.mqttClient && this.ctx.mqttClient.connected) {
                    if (this.ctx.mqttClient.ping) this.ctx.mqttClient.ping();
                    try { this.ctx.mqttClient.publish('/foreground_state', JSON.stringify({ foreground: true })); } catch(_) {}
                    this.safetyEmit('heartbeat', { ts: Date.now() });
                }
            } catch(_) {}
        }, (80 + Math.random()*20) * 1000);
        this._watchdogTimer = setInterval(() => {
            if (this._destroyed) return;
            const idle = Date.now() - this._lastEventTs;
            // Soft escalate already handled inside _ensureMqttAlive at 2m30s
            // Ghost detection earlier: 9m
            if (idle > 9 * 60 * 1000 && !this._ghostChecking && this.ctx && this.ctx.mqttClient && this.ctx.mqttClient.connected) {
                this._ghostChecking = true;
                const before = this._lastEventTs;
                try { if (this.ctx.mqttClient.ping) this.ctx.mqttClient.ping(); } catch(_) {}
                setTimeout(() => {
                    if (this._destroyed) return;
                    if (this._lastEventTs <= before) { this.forceReconnect('ghost'); }
                    setTimeout(() => { this._ghostChecking = false; }, 5 * 60 * 1000);
                }, 6000 + Math.random()*2000);
            }
            // Hard watchdog escalate: 12m
            if (idle > 12 * 60 * 1000) {
                this._backoff.attempt = 0;
                this._ensureMqttAlive();
            }
        }, 35 * 1000); // slight change to avoid pattern
    }

    /**
     * Start safety monitoring for session
     */
    startMonitoring(ctx, api) { // added persistence of ctx/api so refresh can use them
        if (!ctx || !api) return;
        this.ctx = ctx; // persist for later safe refresh
        this.api = api;
        if (this._monitorInterval) clearInterval(this._monitorInterval);
        this._monitorInterval = setInterval(() => {
            this.checkAccountHealth(ctx, api);
        }, 30000);
        // Attach lightweight hook if api emits events to update lastEventTs externally if user wires it
        this.recordEvent();
        this._startHeartbeat();
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
                    this.safetyEmit('accountIssue', {
                        type: 'session_expired',
                        message: 'User session cookie missing'
                    });
                }
            }
        } catch (error) {
            this.recordRequest(true);
            
            const safetyCheck = this.checkErrorSafety(error);
            if (!safetyCheck.safe) {
                this.safetyEmit('accountIssue', {
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
        // Improved safe session refresh implementation
        if (this._refreshing) return; // prevent concurrent refreshes
        this._refreshing = true;
        const refreshId = ++this._inFlightRefreshId;
        const startedAt = Date.now();
        let preMqttConnected = this.ctx && this.ctx.mqttClient && this.ctx.mqttClient.connected;
        let preLastEvent = this._lastEventTs;
        try {
            console.log('🔄 Performing safe session refresh...');
            if (!this.api || typeof this.api.refreshFb_dtsg !== 'function') {
                console.log('⚠️ Safe refresh skipped: api.refreshFb_dtsg not available');
                return;
            }
            // Abort protection if takes too long (network hang)
            const timeoutMs = 25 * 1000;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
            let res;
            try {
                res = await this.api.refreshFb_dtsg({ signal: controller.signal });
            } finally { clearTimeout(timeout); }
            this.sessionMetrics.errorCount = Math.max(0, this.sessionMetrics.errorCount - 1);
            this.sessionMetrics.lastActivity = Date.now();
            this.safetyEmit('safeRefresh', {
                ok: true,
                fb_dtsg: this.ctx && this.ctx.fb_dtsg,
                jazoest: this.ctx && this.ctx.jazoest,
                durationMs: Date.now() - startedAt,
                message: 'Session tokens refreshed'
            });
            // Immediate MQTT health ensure
            await this._ensureMqttAlive();
            // Schedule layered post-refresh checks (1s, 10s, 30s) to catch silent drops
            const checksAt = [1000, 10000, 30000];
            checksAt.forEach(delay => {
                const handle = setTimeout(() => {
                    if (this._destroyed) return;
                    if (refreshId !== this._inFlightRefreshId) return; // newer refresh superseded
                    this._ensureMqttAlive();
                }, delay);
                this._postRefreshChecks.push(handle);
            });
            // If previously connected and now no events for >1 min after refresh -> reconnect
            setTimeout(() => {
                if (this._destroyed) return;
                if (preMqttConnected && Date.now() - Math.max(this._lastEventTs, preLastEvent) > 60 * 1000) {
                    this._backoff.attempt = 0; // reset backoff for immediate action
                    this._ensureMqttAlive();
                }
            }, 60 * 1000);
        } catch (e) {
            this.recordRequest(true);
            this.safetyEmit('safeRefresh', {
                ok: false,
                error: e.message,
                durationMs: Date.now() - startedAt
            });
            if (this.sessionMetrics.errorCount > 3) {
                this.sessionMetrics.riskLevel = 'high';
            }
            // Force reconnection attempt if refresh failed & potential token invalidation
            this._backoff.attempt = 0;
            await this._ensureMqttAlive();
        } finally {
            this._refreshing = false;
        }
    }

    // Cleanup / destroy resources (to prevent dangling timers)
    destroy() {
        this._destroyed = true;
        const timers = [this._safeRefreshInterval, this._safeRefreshTimer, this._heartbeatTimer, this._watchdogTimer, this._periodicRecycleTimer];
        timers.forEach(t => t && clearTimeout(t));
        if (this._activeListenerStop) {
            try { this._activeListenerStop(); } catch (_) {}
            this._activeListenerStop = null;
        }
        this._postRefreshChecks.forEach(h => clearTimeout(h));
        this._postRefreshChecks = [];
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
    safetyEmit(event, data) {
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
