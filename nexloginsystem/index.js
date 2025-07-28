/**
 * Nexus Login System - Main Entry Point
 * Intelligent login with auto appstate management
 * Built for Nexus-FCA with maximum safety
 */

const NexusLoginSystem = require('./NexusLoginSystem');
const fs = require('fs');
const path = require('path');

class NexusLogin {
    constructor(options = {}) {
        this.options = {
            // Auto-detect paths relative to project root
            appstatePath: options.appstatePath || path.join(__dirname, '../appstate.json'),
            credentialsPath: options.credentialsPath || path.join(__dirname, 'credentials.json'),
            backupPath: options.backupPath || path.join(__dirname, 'backups'),
            
            // Login behavior
            autoLogin: options.autoLogin !== false,
            autoSave: options.autoSave !== false,
            safeMode: options.safeMode !== false,
            
            // Safety settings
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 5000,
            
            // Integration with Nexus-FCA
            nexusFCA: options.nexusFCA || require('../index'),
            autoStartBot: options.autoStartBot !== false,
            
            ...options
        };

        this.loginSystem = new NexusLoginSystem(this.options);
        this.isLoggedIn = false;
        this.api = null;
    }

    // Simple login method
    async login(credentials = null) {
        try {
            console.log('🚀 Nexus Login System Starting...');
            console.log('═══════════════════════════════════════════════════════════════');

            const result = await this.loginSystem.login(credentials);

            if (!result.success) {
                console.log('❌ Login failed:', result.message);
                return result;
            }

            console.log('✅ Appstate ready!');
            console.log(`📊 Method: ${result.method || 'new_generation'}`);
            console.log(`🍪 Cookies: ${result.appstate.length}`);

            // Auto-integrate with Nexus-FCA if enabled
            if (this.options.autoStartBot) {
                console.log('🔄 Starting Nexus-FCA bot...');
                
                const nexusResult = await this.startNexusFCA(result.appstate);
                
                if (nexusResult.success) {
                    this.isLoggedIn = true;
                    this.api = nexusResult.api;
                    
                    console.log('═══════════════════════════════════════════════════════════════');
                    console.log('🎉 NEXUS-FCA READY!');
                    console.log('═══════════════════════════════════════════════════════════════');
                    console.log(`👤 User ID: ${this.api.getCurrentUserID()}`);
                    console.log('🛡️ Ultra-safe mode: ACTIVE');
                    console.log('⚡ Performance: OPTIMIZED');
                    console.log('═══════════════════════════════════════════════════════════════');
                    
                    return {
                        success: true,
                        api: this.api,
                        appstate: result.appstate,
                        loginMethod: result.method,
                        message: 'Nexus-FCA bot started successfully'
                    };
                } else {
                    console.log('⚠️ Nexus-FCA startup failed:', nexusResult.message);
                    return {
                        success: true,
                        appstate: result.appstate,
                        loginMethod: result.method,
                        warning: 'Appstate ready but bot startup failed',
                        botError: nexusResult.message
                    };
                }
            }

            return result;

        } catch (error) {
            console.log('💥 System error:', error.message);
            return {
                success: false,
                message: `System error: ${error.message}`
            };
        }
    }

    // Start Nexus-FCA with ultra-safe options
    async startNexusFCA(appstate) {
        return new Promise((resolve) => {
            const ultraSafeOptions = {
                // Core safety options
                selfListen: false,
                listenEvents: true,
                updatePresence: false,
                autoMarkDelivery: false,
                autoMarkRead: false,
                
                // Ultra-safe mode
                ultraSafeMode: true,
                safeDelays: true,
                intelligentSafety: true,
                
                // Performance options
                performanceOptimization: true,
                cachingEnabled: true,
                
                // MQTT options
                autoReconnect: true,
                mqttReconnectInterval: 3600,
                
                // Error handling
                retryAttempts: 5,
                circuitBreakerThreshold: 10,
                
                // Logging
                logLevel: 'info'
            };

            this.options.nexusFCA({ appState: appstate }, ultraSafeOptions, (err, api) => {
                if (err) {
                    resolve({
                        success: false,
                        message: err.message || 'Nexus-FCA login failed'
                    });
                    return;
                }

                resolve({
                    success: true,
                    api: api,
                    message: 'Nexus-FCA started successfully'
                });
            });
        });
    }

    // Quick setup method
    async quickSetup(username, password, twofactor = null) {
        const credentials = {
            username,
            password,
            twofactor: twofactor || undefined
        };

        return await this.login(credentials);
    }

    // Get current status
    getStatus() {
        const systemStatus = this.loginSystem.getStatus();
        
        return {
            ...systemStatus,
            isLoggedIn: this.isLoggedIn,
            hasAPI: !!this.api,
            userID: this.api ? this.api.getCurrentUserID() : null
        };
    }

    // Manual appstate loading
    async loadAppstate(appstatePath = null) {
        try {
            const targetPath = appstatePath || this.options.appstatePath;
            
            if (!fs.existsSync(targetPath)) {
                return {
                    success: false,
                    message: 'Appstate file not found'
                };
            }

            const appstate = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
            
            if (this.options.autoStartBot) {
                const result = await this.startNexusFCA(appstate);
                
                if (result.success) {
                    this.isLoggedIn = true;
                    this.api = result.api;
                }
                
                return {
                    success: result.success,
                    api: result.success ? this.api : null,
                    appstate: appstate,
                    message: result.message
                };
            }

            return {
                success: true,
                appstate: appstate,
                message: 'Appstate loaded successfully'
            };

        } catch (error) {
            return {
                success: false,
                message: `Failed to load appstate: ${error.message}`
            };
        }
    }

    // Cleanup and maintenance
    cleanup() {
        this.loginSystem.cleanupBackups();
    }
}

// Factory function for easy usage
function createNexusLogin(options = {}) {
    return new NexusLogin(options);
}

// Direct login function for simple usage
async function nexusLogin(credentials = null, options = {}) {
    const login = new NexusLogin(options);
    return await login.login(credentials);
}

module.exports = {
    NexusLogin,
    NexusLoginSystem,
    createNexusLogin,
    nexusLogin
};

// Export default for easy import
module.exports.default = NexusLogin;
