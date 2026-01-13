/**
 * LoginManager.js
 * 
 * Extracted login logic from index.js for better modularity
 * Handles both appState and email/password authentication
 */

const utils = require('../../utils');
const logger = require('../logger');
const EmailPasswordLogin = require('./EmailPasswordLogin');
const ProxyManager = require('../network/ProxyManager');
const UserAgentManager = require('../network/UserAgentManager');
const { CookieManager } = require('../safety/CookieManager');

class LoginManager {
    constructor(globalSafety) {
        this.globalSafety = globalSafety;
    }

    /**
     * Validate and prepare login credentials
     */
    validateLogin(appState, email, password) {
        const safetyCheck = this.globalSafety.validateLogin(appState, email, password);
        if (!safetyCheck.safe) {
            throw new Error(`Login Safety Check Failed: ${safetyCheck.reason}`);
        }
        return true;
    }

    /**
     * Initialize proxy if configured
     */
    initializeProxy(globalOptions) {
        const proxyManager = globalOptions.proxy
            ? new ProxyManager(globalOptions.proxy)
            : ProxyManager.fromEnv();

        if (proxyManager.isEnabled()) {
            logger(`🌐 Proxy enabled: ${proxyManager.getInfo().host}:${proxyManager.getInfo().port}`, 'info');
        }

        return proxyManager;
    }

    /**
     * Initialize user agent
     */
    initializeUserAgent(globalOptions) {
        const uaManager = globalOptions.randomUserAgent
            ? new UserAgentManager({ random: true })
            : UserAgentManager.fromEnv();

        if (!globalOptions.userAgent) {
            globalOptions.userAgent = uaManager.getUserAgent(globalOptions);
            logger(`🔧 User Agent: ${uaManager.getInfo().browser} ${uaManager.getInfo().version} on ${uaManager.getInfo().os}`, 'info');
        }

        // Establish continuity user agent ONCE
        if (!this.globalSafety._fixedUA) {
            this.globalSafety.setFixedUserAgent(this.globalSafety.getSafeUserAgent());
        }
        globalOptions.userAgent = this.globalSafety.getSafeUserAgent();

        return uaManager;
    }

    /**
     * Login with email and password
     */
    async loginWithEmailPassword(email, password, jar, globalOptions) {
        logger('🔐 Attempting email/password login...', 'info');

        const emailPasswordLogin = new EmailPasswordLogin();
        const validation = emailPasswordLogin.validateCredentials(email, password);

        if (!validation.valid) {
            throw new Error(`Invalid credentials: ${validation.errors.join(', ')}`);
        }

        try {
            const result = await emailPasswordLogin.login(email, password, jar);

            if (!result.success) {
                throw new Error('Email/password login failed');
            }

            logger('✅ Email/password login successful', 'info');

            // Fetch main page to build API
            const res = await utils.get('https://www.facebook.com/', jar, null,
                this.globalSafety.applySafeRequestOptions(globalOptions), { noRef: true });

            return await utils.saveCookies(jar)(res);

        } catch (err) {
            logger(`❌ Email/password login failed: ${err.message}`, 'error');
            throw err;
        }
    }

    /**
     * Login with appState (cookies)
     */
    async loginWithAppState(appState, jar, globalOptions) {
        // Parse appState if it's a string
        let parsedAppState;
        try {
            parsedAppState = typeof appState === 'string' ? JSON.parse(appState) : appState;
        } catch (e) {
            throw new Error("Failed to parse appState");
        }

        // Fix cookie expiry issues
        const fixedAppState = CookieManager.fixCookieExpiry(parsedAppState, {
            defaultExpiryDays: 90,
            criticalExpiryDays: 90,
            refreshExisting: true
        });

        // Set cookies in jar
        fixedAppState.forEach(c => {
            const str = `${c.key}=${c.value}; expires=${c.expires}; domain=${c.domain}; path=${c.path};`;
            jar.setCookie(str, "http://" + c.domain);
        });

        // Apply safety headers with continuity UA
        const res = await utils.get('https://www.facebook.com/', jar, null,
            this.globalSafety.applySafeRequestOptions(globalOptions), { noRef: true });

        return await utils.saveCookies(jar)(res);
    }

    /**
     * Handle HTTP redirects
     */
    async handleRedirect(res, jar, globalOptions) {
        const reg = /<meta http-equiv="refresh" content="0;url=([^"]+)[^>]+>/;
        const redirect = reg.exec(res.body);

        if (redirect && redirect[1]) {
            const redirectRes = await utils.get(redirect[1], jar, null,
                this.globalSafety.applySafeRequestOptions(globalOptions));
            return await utils.saveCookies(jar)(redirectRes);
        }

        return res;
    }

    /**
     * Main login method - handles both appState and email/password
     */
    async login(appState, email, password, globalOptions, jar) {
        // Validate login
        this.validateLogin(appState, email, password);

        // Initialize proxy and UA
        this.initializeProxy(globalOptions);
        this.initializeUserAgent(globalOptions);

        // Perform login
        let mainPromise;

        if (email && password) {
            mainPromise = this.loginWithEmailPassword(email, password, jar, globalOptions);
        } else if (appState) {
            mainPromise = this.loginWithAppState(appState, jar, globalOptions);
        } else {
            throw new Error("Either appState or email/password is required for authentication");
        }

        // Handle redirects
        let res = await mainPromise;
        res = await this.handleRedirect(res, jar, globalOptions);
        res = await this.handleRedirect(res, jar, globalOptions); // Second redirect handling

        return res;
    }
}

module.exports = LoginManager;
