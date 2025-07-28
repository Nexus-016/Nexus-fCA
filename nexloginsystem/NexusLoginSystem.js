/**
 * Nexus Login System - Advanced & Safe Facebook Login
 * Automatic appstate generation and management
 * Built for Nexus-FCA with maximum account safety
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { TOTP } = require("totp-generator");
const axios = require("axios");
const crypto = require('crypto');

class NexusLoginSystem {
    constructor(options = {}) {
        this.options = {
            appstatePath: options.appstatePath || path.join(__dirname, 'appstate.json'),
            credentialsPath: options.credentialsPath || path.join(__dirname, 'credentials.json'),
            backupPath: options.backupPath || path.join(__dirname, 'backups'),
            autoLogin: options.autoLogin !== false, // Default true
            autoSave: options.autoSave !== false,   // Default true
            safeMode: options.safeMode !== false,   // Default true
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 5000,
            ...options
        };

        this.deviceCache = new Map();
        this.loginAttempts = 0;
        this.lastLoginTime = 0;
        
        // Create directories
        this.ensureDirectories();
        
        this.logger('Nexus Login System initialized', '🚀');
    }

    logger(message, emoji = '📝') {
        const timestamp = new Date().toLocaleString();
        console.log(`${emoji} [${timestamp}] ${message}`);
    }

    ensureDirectories() {
        const dirs = [
            path.dirname(this.options.appstatePath),
            path.dirname(this.options.credentialsPath),
            this.options.backupPath
        ];
        
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    // Enhanced device simulation with better fingerprinting
    getRandomDevice() {
        const devices = [
            { model: "Pixel 6", build: "SP2A.220505.002", sdk: "30", release: "11" },
            { model: "Pixel 5", build: "RQ3A.210805.001.A1", sdk: "30", release: "11" },
            { model: "Samsung Galaxy S21", build: "G991USQU4AUDA", sdk: "30", release: "11" },
            { model: "OnePlus 9", build: "LE2115_11_C.48", sdk: "30", release: "11" },
            { model: "Xiaomi Mi 11", build: "RKQ1.200826.002", sdk: "30", release: "11" },
            { model: "Pixel 7", build: "TD1A.220804.031", sdk: "33", release: "13" },
            { model: "Samsung Galaxy S22", build: "S901USQU2AVB3", sdk: "32", release: "12" }
        ];
        
        const device = devices[Math.floor(Math.random() * devices.length)];
        const deviceId = this.generateConsistentDeviceId(device);
        
        return {
            userAgent: `Dalvik/2.1.0 (Linux; U; Android ${device.release}; ${device.model} Build/${device.build})`,
            device,
            deviceId,
            familyDeviceId: uuidv4(),
            androidId: this.generateAndroidId()
        };
    }

    generateConsistentDeviceId(device) {
        const key = `${device.model}_${device.build}`;
        if (this.deviceCache.has(key)) {
            return this.deviceCache.get(key);
        }
        
        const deviceId = uuidv4();
        this.deviceCache.set(key, deviceId);
        return deviceId;
    }

    generateAndroidId() {
        return crypto.randomBytes(8).toString('hex');
    }

    randomString(length = 10) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = 'abcdefghijklmnopqrstuvwxyz'.charAt(Math.floor(Math.random() * 26));
        for (let i = 0; i < length - 1; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    encodesig(object) {
        let data = '';
        Object.keys(object).forEach(key => {
            data += `${key}=${object[key]}`;
        });
        return crypto.createHash('md5').update(data + '62f8ce9f74b12f84c123cc23437a4a32').digest('hex');
    }

    sort(object) {
        const sortedKeys = Object.keys(object).sort();
        let sortedObject = {};
        for (const key of sortedKeys) {
            sortedObject[key] = object[key];
        }
        return sortedObject;
    }

    // Safe delay between requests
    async safeDelay(min = 1000, max = 3000) {
        if (!this.options.safeMode) return;
        
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        this.logger(`Safety delay: ${delay}ms`, '⏳');
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Check if appstate exists and is valid
    hasValidAppstate() {
        try {
            if (!fs.existsSync(this.options.appstatePath)) {
                return false;
            }

            const appstate = JSON.parse(fs.readFileSync(this.options.appstatePath, 'utf8'));
            
            if (!Array.isArray(appstate) || appstate.length === 0) {
                return false;
            }

            // Check if cookies are not too old
            const now = Date.now();
            const validCookies = appstate.filter(cookie => {
                if (!cookie.expires && !cookie.expirationDate) return true;
                
                const expires = new Date(cookie.expires || cookie.expirationDate).getTime();
                return expires > now;
            });

            return validCookies.length > appstate.length * 0.7; // 70% valid cookies required
        } catch (error) {
            this.logger(`Appstate validation failed: ${error.message}`, '❌');
            return false;
        }
    }

    // Load existing appstate
    loadAppstate() {
        try {
            if (!fs.existsSync(this.options.appstatePath)) {
                return null;
            }

            const appstate = JSON.parse(fs.readFileSync(this.options.appstatePath, 'utf8'));
            this.logger(`Loaded appstate with ${appstate.length} cookies`, '✅');
            return appstate;
        } catch (error) {
            this.logger(`Failed to load appstate: ${error.message}`, '❌');
            return null;
        }
    }

    // Save appstate with backup
    saveAppstate(appstate, metadata = {}) {
        try {
            if (!this.options.autoSave) return;

            // Create backup first
            if (fs.existsSync(this.options.appstatePath)) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupFile = path.join(this.options.backupPath, `appstate-backup-${timestamp}.json`);
                fs.copyFileSync(this.options.appstatePath, backupFile);
                this.logger(`Backup created: ${backupFile}`, '📦');
            }

            // Save new appstate
            const dataToSave = {
                appstate,
                metadata: {
                    generated: new Date().toISOString(),
                    deviceInfo: metadata.deviceInfo || {},
                    ...metadata
                },
                version: '1.0'
            };

            fs.writeFileSync(this.options.appstatePath, JSON.stringify(appstate, null, 2));
            fs.writeFileSync(
                this.options.appstatePath.replace('.json', '-full.json'), 
                JSON.stringify(dataToSave, null, 2)
            );

            this.logger(`Appstate saved with ${appstate.length} cookies`, '💾');
            return true;
        } catch (error) {
            this.logger(`Failed to save appstate: ${error.message}`, '❌');
            return false;
        }
    }

    // Enhanced login with better error handling
    async generateAppstate(credentials) {
        try {
            if (this.options.safeMode) {
                // Rate limiting check
                const timeSinceLastLogin = Date.now() - this.lastLoginTime;
                if (timeSinceLastLogin < 30000) { // 30 seconds minimum
                    this.logger('Rate limiting: Please wait before next login attempt', '⚠️');
                    await new Promise(resolve => setTimeout(resolve, 30000 - timeSinceLastLogin));
                }
            }

            this.lastLoginTime = Date.now();
            this.loginAttempts++;

            const androidDevice = this.getRandomDevice();
            const machineId = this.randomString(24);

            await this.safeDelay(1000, 2000);

            const form = {
                adid: uuidv4(),
                email: credentials.username,
                password: credentials.password,
                format: 'json',
                device_id: androidDevice.deviceId,
                cpl: 'true',
                family_device_id: androidDevice.familyDeviceId,
                locale: 'en_US',
                client_country_code: 'US',
                credentials_type: 'device_based_login_password',
                generate_session_cookies: '1',
                generate_analytics_claim: '1',
                generate_machine_id: '1',
                currently_logged_in_userid: '0',
                irisSeqID: 1,
                try_num: "1",
                enroll_misauth: "false",
                meta_inf_fbmeta: "NO_FILE",
                source: 'login',
                machine_id: machineId,
                fb_api_req_friendly_name: 'authenticate',
                fb_api_caller_class: 'com.facebook.account.login.protocol.Fb4aAuthHandler',
                api_key: '882a8490361da98702bf97a021ddc14d',
                access_token: '350685531728|62f8ce9f74b12f84c123cc23437a4a32',
                advertiser_id: uuidv4(),
                device_platform: 'android',
                app_version: '392.0.0.0.66',
                network_type: 'WIFI'
            };

            form.sig = this.encodesig(this.sort(form));

            const options = {
                url: 'https://b-graph.facebook.com/auth/login',
                method: 'post',
                data: form,
                transformRequest: [(data) => require('querystring').stringify(data)],
                headers: {
                    'content-type': 'application/x-www-form-urlencoded',
                    'x-fb-friendly-name': form["fb_api_req_friendly_name"],
                    'x-fb-http-engine': 'Liger',
                    'user-agent': androidDevice.userAgent,
                    'x-fb-connection-type': 'WIFI',
                    'x-fb-net-hni': '',
                    'x-fb-sim-hni': '',
                    'x-fb-device-group': '5120',
                    'x-tigon-is-retry': 'False',
                    'x-fb-rmd': 'cached=0;state=NO_MATCH',
                    'x-fb-request-analytics-tags': 'unknown',
                    'authorization': `OAuth ${form.access_token}`,
                    'accept-language': 'en-US,en;q=0.9',
                    'x-fb-client-ip': 'True',
                    'x-fb-server-cluster': 'True'
                },
                timeout: 30000
            };

            this.logger('Attempting login with enhanced security...', '🔐');

            return new Promise((resolve) => {
                axios.request(options).then(async (response) => {
                    try {
                        const appstate = response.data.session_cookies.map(cookie => ({
                            key: cookie.name,
                            value: cookie.value,
                            domain: cookie.domain,
                            path: cookie.path,
                            expires: cookie.expires,
                            httpOnly: cookie.httpOnly,
                            secure: cookie.secure
                        }));

                        if (credentials.i_user) {
                            appstate.push({
                                key: 'i_user',
                                value: credentials.i_user,
                                domain: '.facebook.com',
                                path: '/'
                            });
                        }

                        await this.safeDelay(500, 1500);

                        // Get additional token
                        const tokenOptions = {
                            url: `https://api.facebook.com/method/auth.getSessionforApp?format=json&access_token=${response.data.access_token}&new_app_id=275254692598279`,
                            method: 'get',
                            headers: {
                                'user-agent': androidDevice.userAgent,
                                'x-fb-connection-type': 'WIFI',
                                'authorization': `OAuth ${response.data.access_token}`
                            },
                            timeout: 15000
                        };

                        try {
                            const tokenResponse = await axios.request(tokenOptions);
                            
                            const result = {
                                success: true,
                                appstate: appstate,
                                access_token: response.data.access_token,
                                access_token_eaad6v7: tokenResponse.data.access_token,
                                device_info: {
                                    model: androidDevice.device.model,
                                    user_agent: androidDevice.userAgent,
                                    device_id: androidDevice.deviceId
                                },
                                generated_at: new Date().toISOString()
                            };

                            this.saveAppstate(appstate, result);
                            this.logger('Login successful! Appstate generated and saved', '🎉');
                            
                            resolve(result);
                        } catch (tokenError) {
                            // Token fetch failed, but we still have appstate
                            const result = {
                                success: true,
                                appstate: appstate,
                                access_token: response.data.access_token,
                                device_info: {
                                    model: androidDevice.device.model,
                                    user_agent: androidDevice.userAgent
                                },
                                warning: 'Additional token generation failed',
                                generated_at: new Date().toISOString()
                            };

                            this.saveAppstate(appstate, result);
                            this.logger('Login successful! (Token generation had issues)', '⚠️');
                            
                            resolve(result);
                        }

                    } catch (e) {
                        this.logger(`Login processing error: ${e.message}`, '❌');
                        resolve({
                            success: false,
                            message: "Login processing failed. Please try again."
                        });
                    }
                }).catch(async (error) => {
                    // Handle 2FA requirement
                    try {
                        const errorData = error.response?.data?.error?.error_data;
                        if (!errorData) {
                            throw new Error('Unknown login error');
                        }

                        let twoFactorCode;

                        if (credentials._2fa && credentials._2fa !== "0") {
                            twoFactorCode = credentials._2fa;
                        } else if (credentials.twofactor && credentials.twofactor !== "0") {
                            try {
                                this.logger('Processing 2FA with TOTP...', '🔐');
                                const cleanSecret = decodeURI(credentials.twofactor).replace(/\s+/g, '').toUpperCase();
                                const { otp } = TOTP.generate(cleanSecret);
                                twoFactorCode = otp;
                                this.logger(`Generated 2FA code: ${otp}`, '🔑');
                            } catch (e) {
                                return resolve({
                                    success: false,
                                    message: 'Invalid 2FA secret key format'
                                });
                            }
                        } else {
                            return resolve({
                                success: false,
                                message: 'Two-factor authentication required. Please provide 2FA secret or code.'
                            });
                        }

                        await this.safeDelay(2000, 4000);

                        const twoFactorForm = {
                            ...form,
                            twofactor_code: twoFactorCode,
                            encrypted_msisdn: "",
                            userid: errorData.uid,
                            machine_id: errorData.machine_id || machineId,
                            first_factor: errorData.login_first_factor,
                            credentials_type: "two_factor"
                        };

                        twoFactorForm.sig = this.encodesig(this.sort(twoFactorForm));
                        options.data = twoFactorForm;

                        this.logger('Attempting 2FA login...', '🔐');

                        try {
                            const twoFactorResponse = await axios.request(options);

                            const appstate = twoFactorResponse.data.session_cookies.map(cookie => ({
                                key: cookie.name,
                                value: cookie.value,
                                domain: cookie.domain,
                                path: cookie.path,
                                expires: cookie.expires,
                                httpOnly: cookie.httpOnly,
                                secure: cookie.secure
                            }));

                            if (credentials.i_user) {
                                appstate.push({
                                    key: 'i_user',
                                    value: credentials.i_user,
                                    domain: '.facebook.com',
                                    path: '/'
                                });
                            }

                            const result = {
                                success: true,
                                appstate: appstate,
                                access_token: twoFactorResponse.data.access_token,
                                device_info: {
                                    model: androidDevice.device.model,
                                    user_agent: androidDevice.userAgent
                                },
                                method: '2FA',
                                generated_at: new Date().toISOString()
                            };

                            this.saveAppstate(appstate, result);
                            this.logger('2FA login successful! Appstate saved', '🎉');
                            
                            resolve(result);

                        } catch (requestError) {
                            this.logger(`2FA request failed: ${requestError.message}`, '❌');
                            resolve({
                                success: false,
                                message: '2FA verification failed. Check your code and try again.'
                            });
                        }

                    } catch (twoFactorError) {
                        this.logger(`2FA error: ${twoFactorError.message}`, '❌');
                        resolve({
                            success: false,
                            message: 'Login failed. Check credentials and try again.'
                        });
                    }
                });
            });

        } catch (e) {
            this.logger(`Unexpected error: ${e.message}`, '💥');
            return {
                success: false,
                message: 'Unexpected error occurred. Please try again.'
            };
        }
    }

    // Main login method with auto-detection
    async login(credentials = null) {
        try {
            this.logger('Starting Nexus Login System...', '🚀');

            // Check for existing valid appstate first
            if (this.options.autoLogin && this.hasValidAppstate()) {
                this.logger('Valid appstate found, loading...', '✅');
                const appstate = this.loadAppstate();
                
                if (appstate) {
                    return {
                        success: true,
                        appstate: appstate,
                        method: 'existing_appstate',
                        message: 'Login successful using existing appstate'
                    };
                }
            }

            // No valid appstate, need credentials
            if (!credentials) {
                // Try to load from credentials file
                if (fs.existsSync(this.options.credentialsPath)) {
                    try {
                        credentials = JSON.parse(fs.readFileSync(this.options.credentialsPath, 'utf8'));
                        this.logger('Credentials loaded from file', '📁');
                    } catch (error) {
                        this.logger('Failed to load credentials file', '❌');
                    }
                }

                if (!credentials) {
                    return {
                        success: false,
                        message: 'No valid appstate found and no credentials provided'
                    };
                }
            }

            // Validate credentials
            if (!credentials.username || !credentials.password) {
                return {
                    success: false,
                    message: 'Username and password are required'
                };
            }

            this.logger('Generating new appstate...', '🔄');
            
            // Generate new appstate
            const result = await this.generateAppstate(credentials);
            
            if (result.success) {
                // Save credentials for future use (optional)
                if (this.options.autoSave && !fs.existsSync(this.options.credentialsPath)) {
                    try {
                        const credentialsToSave = { ...credentials };
                        delete credentialsToSave.password; // Don't save password for security
                        fs.writeFileSync(this.options.credentialsPath, JSON.stringify(credentialsToSave, null, 2));
                    } catch (error) {
                        this.logger('Failed to save credentials (non-critical)', '⚠️');
                    }
                }
            }

            return result;

        } catch (error) {
            this.logger(`Login system error: ${error.message}`, '💥');
            return {
                success: false,
                message: `System error: ${error.message}`
            };
        }
    }

    // Cleanup old backups
    cleanupBackups(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days
        try {
            if (!fs.existsSync(this.options.backupPath)) return;

            const files = fs.readdirSync(this.options.backupPath);
            const now = Date.now();
            let cleaned = 0;

            files.forEach(file => {
                const filePath = path.join(this.options.backupPath, file);
                const stats = fs.statSync(filePath);
                
                if (now - stats.mtime.getTime() > maxAge) {
                    fs.unlinkSync(filePath);
                    cleaned++;
                }
            });

            if (cleaned > 0) {
                this.logger(`Cleaned up ${cleaned} old backup files`, '🧹');
            }
        } catch (error) {
            this.logger(`Backup cleanup failed: ${error.message}`, '⚠️');
        }
    }

    // Get login status
    getStatus() {
        const hasAppstate = this.hasValidAppstate();
        const hasCredentials = fs.existsSync(this.options.credentialsPath);
        
        return {
            hasValidAppstate: hasAppstate,
            hasCredentials: hasCredentials,
            appstatePath: this.options.appstatePath,
            lastLogin: hasAppstate ? fs.statSync(this.options.appstatePath).mtime : null,
            loginAttempts: this.loginAttempts
        };
    }
}

module.exports = NexusLoginSystem;
