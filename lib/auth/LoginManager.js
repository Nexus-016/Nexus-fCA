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

        // NEXUS FIX: detect a dead session HERE, at login time. If the cookies
        // are expired/invalid Facebook serves the login page (HTTP 200), which
        // used to slide through and build a zombie API (no fb_dtsg, no listen).
        // Throwing with recognizable text routes the failure into Goat-Bot's
        // ACCOUNT_LOCK guard (patient retry + re-read of appstate.json).
        //
        // FALSE-POSITIVE FIX: the old check matched a bare "/login.php"
        // substring (plus standalone "login_form"/"pass" substrings). Real,
        // LOGGED-IN home pages embed escaped "login.php" URLs in their
        // prefetch/bootstrap config, so FRESH cookies were being declared
        // dead at login. New rules:
        //   * dead-session evidence requires a REAL login form (form action +
        //     password field together, or id="login_form"), and
        //   * logged-in proof (the account's c_user/i_user id present in the
        //     page bootstrap) always wins over login-form heuristics, and
        //   * a suspicious page is confirmed once against /home.php before
        //     the session is declared dead (checkpoint markers stay decisive).
        const body = (res && res.body) || "";
        const userIds = ["i_user", "c_user"]
            .map(k => (fixedAppState.find(c => c.key === k) || {}).value)
            .filter(Boolean);

        // Dead-session detection, evidence-based:
        //  * When the appstate carries c_user/i_user, the logged-in home page
        //    always embeds that id in its bootstrap data (verified live) — so
        //    "account id missing from the page" is the strongest dead signal.
        //  * Without any id in the appstate, fall back to a REAL login form
        //    (form action + password field together, or id="login_form").
        //  * A bare "/login.php" substring is NOT evidence — logged-in pages
        //    embed escaped login.php URLs in their prefetch config, which is
        //    exactly what used to kill FRESH cookies at login.
        //  * A suspicious page is confirmed once against /home.php before the
        //    session is declared dead (checkpoint markers stay decisive).
        const first = LoginManager.classifyLoginBody(body, userIds);

        // Checkpoint markers are decisive — keep them first.
        if (first.checkpoint) {
            throw new Error("Login checkpoint detected — account temporarily locked by Facebook. Complete the checkpoint in a real browser, then replace appstate.json with fresh cookies.");
        }

        // "This browser is not supported" is a DEVICE-MODE interstitial served
        // to LIVE sessions (it embeds the account's gfid for the m_basic
        // device-switch link — see handleDeviceModeFix). It is NOT dead-session
        // evidence: the interstitial usually lacks the account's id in its
        // bootstrap, so the proof check below would declare a healthy session
        // dead and block the recovery link. Hand it to the device-mode fix
        // chain in login() untouched, mirroring the upstream main framework.
        if (body.includes("This browser is not supported")) {
            return await utils.saveCookies(jar)(res);
        }

        const suspicious = userIds.length > 0 ? !first.proof : first.strongLoginForm;
        if (suspicious) {
            // Confirm once against /home.php before killing the session.
            const confirm = await utils.get("https://www.facebook.com/home.php", jar, null,
                this.globalSafety.applySafeRequestOptions(globalOptions), { noRef: true });
            const second = LoginManager.classifyLoginBody((confirm && confirm.body) || "", userIds);
            if (second.checkpoint) {
                throw new Error("Login checkpoint detected — account temporarily locked by Facebook. Complete the checkpoint in a real browser, then replace appstate.json with fresh cookies.");
            }
            const confirmedDead = userIds.length > 0 ? !second.proof : second.strongLoginForm;
            if (confirmedDead) {
                throw new Error("Not logged in — cookie session expired or invalid (Facebook served the login page). Export fresh cookies from a logged-in browser and replace appstate.json.");
            }
            // Session is alive — the home.php response carries real bootstrap data.
            return await utils.saveCookies(jar)(confirm);
        }

        return await utils.saveCookies(jar)(res);
    }

    /**
     * Extracts the three evidence signals from a login-time response body:
     *   proof          — the account's c_user/i_user id appears in the page
     *                    (present on every logged-in home page bootstrap)
     *   strongLoginForm — a REAL login form: <form action="...login..."> with
     *                    a password field together, or an explicit
     *                    id="login_form". Standalone substrings ("login.php",
     *                    "pass", "login_form" in JS config) are NOT evidence.
     *   checkpoint     — decisive checkpoint markers.
     */
    static classifyLoginBody(body, userIds) {
        const s = String(body || "");
        if (!s) return { proof: false, strongLoginForm: false, checkpoint: false };
        const proof = (userIds || []).some(id => id && s.includes(String(id)));
        const strongLoginForm =
            (/<form[^>]+action="[^"]*login[^"]*"/i.test(s) || /id="login_form"/i.test(s)) &&
            s.includes('name="pass"');
        const checkpoint = s.includes("/checkpoint/block/?next") || s.includes("checkpointSubmitButton");
        return { proof, strongLoginForm, checkpoint };
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
     * GoatBot V2 main-framework fix (upstream 1.5.35, "fix: fca not working").
     * When Facebook serves "This browser is not supported" it embeds a gfid
     * for the m_basic device-switch link. Hitting that link flips this session
     * to m_basic device mode, after which the home page serves bootstrap markup
     * that buildAPI can parse (fb_dtsg + MQTT region/endpoint). Without this,
     * datacenter IPs (Koyeb/Railway) got an unparseable page and a dead listener.
     */
    async handleDeviceModeFix(res, jar, globalOptions) {
        const body = (res && res.body) || "";
        if (!body.includes("This browser is not supported")) return res;
        try {
            const data = JSON.stringify(body);
            const seg = data.split("2Fhome.php&amp;gfid=")[1];
            if (!seg) return res;
            const gfid = seg.split("\\\\")[0].split("\\")[0];
            if (!gfid) return res;
            const link = "https://m.facebook.com/a/preferences.php?basic_site_devices=m_basic&uri="
                + encodeURIComponent("https://m.facebook.com/home.php") + "&gfid=" + gfid;
            const fixed = await utils.get(link, jar, null,
                this.globalSafety.applySafeRequestOptions(globalOptions));
            return await utils.saveCookies(jar)(fixed);
        } catch (e) {
            // Recovery is best-effort; never fail the login because of it.
            return res;
        }
    }

    /**
     * GoatBot V2 main-framework fix (upstream 1.5.35). A desktop-UA fetch of
     * the home page may lack MPageLoadClientMetrics — the bootstrap marker
     * Facebook uses to expose region/seqID. Re-fetching once with an iPhone
     * UA reliably restores it. The pinned session UA is untouched (copy only).
     */
    async handleMPageFallback(res, jar, globalOptions) {
        const body = (res && res.body) || "";
        if (body.includes("MPageLoadClientMetrics")) return res;
        try {
            const mobileOptions = {
                ...globalOptions,
                userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
            };
            const retry = await utils.get("https://www.facebook.com/", jar, null,
                this.globalSafety.applySafeRequestOptions(mobileOptions), { noRef: true });
            return await utils.saveCookies(jar)(retry);
        } catch (e) {
            return res;
        }
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

        // Handle redirects + device-mode recovery, in the upstream
        // GoatBot V2 main-framework order (1.5.35):
        // redirect -> browser-not-supported fix -> MPageLoadClientMetrics
        // UA fallback -> redirect -> browser-not-supported fix.
        let res = await mainPromise;
        res = await this.handleRedirect(res, jar, globalOptions);
        res = await this.handleDeviceModeFix(res, jar, globalOptions);
        res = await this.handleMPageFallback(res, jar, globalOptions);
        res = await this.handleRedirect(res, jar, globalOptions);
        res = await this.handleDeviceModeFix(res, jar, globalOptions);

        return res;
    }
}

module.exports = LoginManager;
