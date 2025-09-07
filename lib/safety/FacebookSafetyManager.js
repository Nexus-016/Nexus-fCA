"use strict";

/**
 * Nexus-FCA Facebook Safety Manager
 * Maximum safety features to prevent Facebook account locks/bans
 * Based on analysis of ws3-fca, fca-delta, fca-priyansh, and other leading FCA packages
 */

const EventEmitter = require('events');
const logger = require('../logger');

class FacebookSafetyManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
    console.warn('[DEPRECATION] FacebookSafetyManager is deprecated. The unified FacebookSafety module now handles all safety logic. Avoid using this manager.');
    this.options = {
            // Auto re-login detection
            autoReloginEnabled: options.autoReloginEnabled !== false,
            autoReloginRetries: options.autoReloginRetries || 3,
            
            // Account lock/suspension detection
            lockDetectionEnabled: options.lockDetectionEnabled !== false,
            suspensionDetectionEnabled: options.suspensionDetectionEnabled !== false,
            
            // Token refresh (fb_dtsg) - crucial for safety
            tokenRefreshEnabled: options.tokenRefreshEnabled !== false,
            tokenRefreshInterval: options.tokenRefreshInterval || 24 * 60 * 60 * 1000, // 24 hours
            
            // Random user agent rotation
            randomUserAgentEnabled: options.randomUserAgentEnabled !== false,
            userAgentRotationInterval: options.userAgentRotationInterval || 60 * 60 * 1000, // 1 hour
            
            // Region bypass options
            regionBypass: options.regionBypass || null, // PRN, PNB, HKG, SYD, VLL, LLA, SIN
            
            // Maximum safety mode
            maxSafetyMode: options.maxSafetyMode !== false,
            
            // No rate limiting (following best practices from ws3-fca, fca-delta)
            rateLimitingDisabled: true,
            
            // Enhanced error recovery
            errorRecoveryEnabled: options.errorRecoveryEnabled !== false,
            maxRetryAttempts: options.maxRetryAttempts || 5,
            
            // Checkpoint handling
            checkpointDetectionEnabled: options.checkpointDetectionEnabled !== false,
            
            ...options
        };
        
        this.state = {
            isLocked: false,
            isSuspended: false,
            isLoggedIn: true,
            lastTokenRefresh: Date.now(),
            consecutiveErrors: 0,
            autoReloginAttempts: 0,
            currentUserAgent: null,
            lastUserAgentRotation: Date.now()
        };
        
        this.userAgents = [
            // Optimized user agents from jonellcc contribution (nv-fca package)
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];
        
        this.errorPatterns = {
            // Account lock patterns
            lock: [
                /account.*locked/i,
                /account.*disabled/i,
                /account.*restricted/i,
                /temporarily.*blocked/i,
                /security.*check/i
            ],
            
            // Suspension patterns
            suspension: [
                /account.*suspended/i,
                /account.*deactivated/i,
                /violat.*community/i,
                /terms.*service/i
            ],
            
            // Checkpoint patterns
            checkpoint: [
                /checkpoint.*required/i,
                /verify.*identity/i,
                /additional.*verification/i,
                /confirm.*identity/i
            ],
            
            // Logout patterns
            logout: [
                /not.*logged.*in/i,
                /session.*expired/i,
                /please.*log.*in/i,
                /authentication.*failed/i
            ]
        };
        
        if (this.options.tokenRefreshEnabled) {
            this.startTokenRefreshTimer();
        }
        
        if (this.options.randomUserAgentEnabled) {
            this.startUserAgentRotation();
        }
        
    logger('🛡️ (Deprecated) Facebook Safety Manager initialized (prefer unified FacebookSafety)', 'info');
    }
    
    /**
     * Check if error indicates account lock/suspension
     */
    checkAccountStatus(error, response) {
        const errorText = (error?.message || error?.toString() || '').toLowerCase();
        const responseText = (response?.body || response?.toString() || '').toLowerCase();
        const combinedText = errorText + ' ' + responseText;
        
        // Check for account lock
        if (this.errorPatterns.lock.some(pattern => pattern.test(combinedText))) {
            this.handleAccountLock(error, response);
            return { locked: true, suspended: false, checkpoint: false, loggedOut: false };
        }
        
        // Check for account suspension
        if (this.errorPatterns.suspension.some(pattern => pattern.test(combinedText))) {
            this.handleAccountSuspension(error, response);
            return { locked: false, suspended: true, checkpoint: false, loggedOut: false };
        }
        
        // Check for checkpoint
        if (this.errorPatterns.checkpoint.some(pattern => pattern.test(combinedText))) {
            this.handleCheckpoint(error, response);
            return { locked: false, suspended: false, checkpoint: true, loggedOut: false };
        }
        
        // Check for logout
        if (this.errorPatterns.logout.some(pattern => pattern.test(combinedText))) {
            this.handleLogout(error, response);
            return { locked: false, suspended: false, checkpoint: false, loggedOut: true };
        }
        
        return { locked: false, suspended: false, checkpoint: false, loggedOut: false };
    }
    
    /**
     * Handle account lock detection
     */
    handleAccountLock(error, response) {
        this.state.isLocked = true;
        this.state.isLoggedIn = false;
        
        logger('🚨 ACCOUNT LOCK DETECTED - Stopping all operations', 'error');
        logger(`Lock Details: ${error?.message || 'Unknown lock reason'}`, 'error');
        
        this.emit('accountLocked', {
            error,
            response,
            timestamp: Date.now(),
            message: 'Account has been locked by Facebook'
        });
        
        // Stop all operations to prevent further issues
        this.stopAllOperations();
    }
    
    /**
     * Handle account suspension detection
     */
    handleAccountSuspension(error, response) {
        this.state.isSuspended = true;
        this.state.isLoggedIn = false;
        
        logger('🚨 ACCOUNT SUSPENSION DETECTED - Stopping all operations', 'error');
        logger(`Suspension Details: ${error?.message || 'Unknown suspension reason'}`, 'error');
        
        this.emit('accountSuspended', {
            error,
            response,
            timestamp: Date.now(),
            message: 'Account has been suspended by Facebook'
        });
        
        // Stop all operations to prevent further issues
        this.stopAllOperations();
    }
    
    /**
     * Handle checkpoint detection
     */
    handleCheckpoint(error, response) {
        logger('⚠️ CHECKPOINT DETECTED - Manual verification required', 'warn');
        logger(`Checkpoint Details: ${error?.message || 'Checkpoint verification required'}`, 'warn');
        
        this.emit('checkpointRequired', {
            error,
            response,
            timestamp: Date.now(),
            message: 'Facebook requires additional verification (checkpoint)'
        });
    }
    
    /**
     * Handle logout detection and attempt auto re-login
     */
    async handleLogout(error, response) {
        this.state.isLoggedIn = false;
        
        logger('⚠️ LOGOUT DETECTED - Attempting auto re-login', 'warn');
        
        if (this.options.autoReloginEnabled && this.state.autoReloginAttempts < this.options.autoReloginRetries) {
            this.state.autoReloginAttempts++;
            
            try {
                logger(`🔄 Auto re-login attempt ${this.state.autoReloginAttempts}/${this.options.autoReloginRetries}`, 'info');
                
                this.emit('autoReloginAttempt', {
                    attempt: this.state.autoReloginAttempts,
                    maxAttempts: this.options.autoReloginRetries,
                    timestamp: Date.now()
                });
                
                // Auto re-login logic will be handled by the main login module
                
            } catch (reloginError) {
                logger(`❌ Auto re-login attempt ${this.state.autoReloginAttempts} failed: ${reloginError.message}`, 'error');
                
                if (this.state.autoReloginAttempts >= this.options.autoReloginRetries) {
                    this.emit('autoReloginFailed', {
                        error: reloginError,
                        attempts: this.state.autoReloginAttempts,
                        timestamp: Date.now()
                    });
                }
            }
        } else {
            this.emit('loggedOut', {
                error,
                response,
                timestamp: Date.now(),
                message: 'Session expired - manual re-login required'
            });
        }
    }
    
    /**
     * Refresh fb_dtsg token automatically (crucial for safety)
     */
    async refreshToken(ctx, defaultFuncs) {
        try {
            logger('🔄 Refreshing fb_dtsg token for enhanced security', 'info');
            
            const response = await defaultFuncs.get('https://www.facebook.com/', ctx.jar);
            const newToken = this.extractTokenFromResponse(response.body);
            
            if (newToken && newToken !== ctx.fb_dtsg) {
                ctx.fb_dtsg = newToken;
                ctx.ttstamp = "2" + newToken.split("").map(c => c.charCodeAt(0)).join("");
                
                this.state.lastTokenRefresh = Date.now();
                
                logger('✅ Token refreshed successfully', 'info');
                this.emit('tokenRefreshed', {
                    newToken,
                    timestamp: Date.now()
                });
                
                return true;
            }
            
            return false;
        } catch (error) {
            logger(`❌ Token refresh failed: ${error.message}`, 'error');
            this.emit('tokenRefreshFailed', { error, timestamp: Date.now() });
            return false;
        }
    }
    
    /**
     * Extract fb_dtsg token from HTML response
     */
    extractTokenFromResponse(html) {
        try {
            // Multiple patterns to extract token (based on ws3-fca and fca-delta)
            const patterns = [
                /"DTSGInitData"[^"]*"token":"([^"]+)"/,
                /"token":"([^"]+)"[^}]*"DTSGInitData"/,
                /DTSGInitData.*?"token":"([^"]+)"/,
                /"fb_dtsg":"([^"]+)"/,
                /name="fb_dtsg" value="([^"]+)"/
            ];
            
            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match && match[1]) {
                    return match[1];
                }
            }
            
            return null;
        } catch (error) {
            logger(`❌ Token extraction failed: ${error.message}`, 'error');
            return null;
        }
    }
    
    /**
     * Get optimized user agent (rotated for safety)
     */
    getOptimizedUserAgent() {
        if (this.options.randomUserAgentEnabled) {
            const now = Date.now();
            
            if (!this.state.currentUserAgent || 
                (now - this.state.lastUserAgentRotation) > this.options.userAgentRotationInterval) {
                
                const randomIndex = Math.floor(Math.random() * this.userAgents.length);
                this.state.currentUserAgent = this.userAgents[randomIndex];
                this.state.lastUserAgentRotation = now;
                
                logger(`🔄 User agent rotated for enhanced safety`, 'info');
            }
        }
        
        return this.state.currentUserAgent || this.userAgents[0];
    }
    
    /**
     * Start automatic token refresh timer
     */
    startTokenRefreshTimer() {
        if (this.tokenRefreshTimer) {
            clearInterval(this.tokenRefreshTimer);
        }
        
        this.tokenRefreshTimer = setInterval(() => {
            this.emit('tokenRefreshScheduled');
        }, this.options.tokenRefreshInterval);
        
        logger(`⏰ Token refresh scheduled every ${this.options.tokenRefreshInterval / (1000 * 60 * 60)} hours`, 'info');
    }
    
    /**
     * Start user agent rotation timer
     */
    startUserAgentRotation() {
        if (this.userAgentTimer) {
            clearInterval(this.userAgentTimer);
        }
        
        this.userAgentTimer = setInterval(() => {
            this.getOptimizedUserAgent(); // This will rotate the user agent
        }, this.options.userAgentRotationInterval);
        
        logger(`🔄 User agent rotation enabled every ${this.options.userAgentRotationInterval / (1000 * 60)} minutes`, 'info');
    }
    
    /**
     * Stop all operations when account issues detected
     */
    stopAllOperations() {
        if (this.tokenRefreshTimer) {
            clearInterval(this.tokenRefreshTimer);
            this.tokenRefreshTimer = null;
        }
        
        if (this.userAgentTimer) {
            clearInterval(this.userAgentTimer);
            this.userAgentTimer = null;
        }
        
        logger('🛑 All safety operations stopped due to account issues', 'warn');
    }
    
    /**
     * Check if account is safe to use
     */
    isSafeToOperate() {
        return !this.state.isLocked && !this.state.isSuspended && this.state.isLoggedIn;
    }
    
    /**
     * Get comprehensive safety status
     */
    getSafetyStatus() {
        return {
            isSafe: this.isSafeToOperate(),
            isLocked: this.state.isLocked,
            isSuspended: this.state.isSuspended,
            isLoggedIn: this.state.isLoggedIn,
            lastTokenRefresh: this.state.lastTokenRefresh,
            consecutiveErrors: this.state.consecutiveErrors,
            autoReloginAttempts: this.state.autoReloginAttempts,
            currentUserAgent: this.state.currentUserAgent,
            uptime: Date.now() - this.state.lastTokenRefresh
        };
    }
    
    /**
     * Reset safety state (for successful operations)
     */
    resetSafetyState() {
        this.state.consecutiveErrors = 0;
        this.state.autoReloginAttempts = 0;
        
        if (!this.state.isLoggedIn && !this.state.isLocked && !this.state.isSuspended) {
            this.state.isLoggedIn = true;
            logger('✅ Safety state reset - account operational', 'info');
        }
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        this.stopAllOperations();
        this.removeAllListeners();
        logger('🛡️ Facebook Safety Manager destroyed', 'info');
    }
}

module.exports = FacebookSafetyManager;
