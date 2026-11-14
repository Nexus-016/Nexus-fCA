"use strict";

/**
 * Nexus Cookie Refresher
 * Maintains cookie freshness and prevents expiry by strategically refreshing sessions
 */

const fs = require('fs');
const path = require('path');
const logger = require('../logger');

class CookieRefresher {
  constructor(options = {}) {
    this.options = {
      enabled: options.enabled !== false,
      cookieRefreshIntervalMs: options.cookieRefreshIntervalMs || 60 * 60 * 1000, // 1 hour default
      forceExpiryExtension: options.forceExpiryExtension !== false, 
      expiryDays: options.expiryDays || 60, // 60 days default expiry extension
      backupEnabled: options.backupEnabled !== false,
      maxBackups: options.maxBackups || 5,
      ...options
    };
    
    this.refreshTimer = null;
    this.ctx = null;
    this.jar = null;
    this.utils = null;
    this.defaultFuncs = null;
    this.appstatePath = null;
    this.backupPath = null;
    this.sessionStartTime = Date.now();
    this.lastRefreshTime = null;
    this.refreshCount = 0;
  }
  
  /**
   * Initialize the refresher with API context
   */
  initialize(ctx, utils, defaultFuncs, appstatePath, backupPath) {
    this.ctx = ctx;
    this.jar = ctx.jar;
    this.utils = utils;
    this.defaultFuncs = defaultFuncs;
    this.appstatePath = appstatePath;
    this.backupPath = backupPath || path.dirname(appstatePath);
    
    // Add timestamps to context for monitoring
    ctx._cookieRefresher = {
      sessionStartTime: this.sessionStartTime,
      lastRefreshTime: null,
      refreshCount: 0,
      nextScheduledRefresh: null
    };
    
    if (this.options.enabled) {
      this.start();
    }
    
    return this;
  }
  
  /**
   * Start the cookie refresh cycle
   */
  start() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    
    // Schedule next refresh
    const nextRefresh = this.options.cookieRefreshIntervalMs;
    logger('CookieRefresher', `Scheduling next cookie refresh in ${Math.floor(nextRefresh/60000)} minutes`, 'debug');
    
    this.refreshTimer = setTimeout(() => {
      this.performRefresh()
        .then(() => this.start()) // Schedule next refresh after success
        .catch(err => {
          logger('CookieRefresher', `Refresh failed: ${err.message}. Retrying in 15 minutes...`, 'warn');
          // If refresh fails, try again sooner
          setTimeout(() => this.start(), 15 * 60 * 1000); 
        });
    }, nextRefresh);
    
    // Don't prevent Node from exiting
    this.refreshTimer.unref();
    
    // Update next scheduled time
    if (this.ctx && this.ctx._cookieRefresher) {
      this.ctx._cookieRefresher.nextScheduledRefresh = Date.now() + nextRefresh;
    }
  }
  
  /**
   * Perform the actual cookie refresh operation
   */
  async performRefresh() {
    if (!this.ctx || !this.jar || !this.utils || !this.defaultFuncs) {
      throw new Error('CookieRefresher not properly initialized');
    }
    
    try {
      // 1. First do a simple fetch to keep session alive
      logger('CookieRefresher', 'Refreshing cookies to extend session...', 'info');
      
      // Enhanced URL list to simulate real user activity and keep session alive
      const urls = [
        'https://www.facebook.com/',
        'https://www.facebook.com/messages/t/'
      ];
      
      let success = false;
      for (const url of urls) {
        try {
          // MAXIMUM STEALTH: Human-like delay between requests (5-10s)
          await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 5000));

          // Try multiple URLs in case some are blocked.
          // NEXUS FIX: use the plain utils.get request shape (exactly like
          // the login flow), NOT defaultFuncs.get. defaultFuncs.get injects
          // API-style query params (__a=1, __user, fb_dtsg...) which make
          // Facebook reject a plain page GET with error 1357004 ("Sorry,
          // something went wrong") in a ~250-byte async wrapper — the
          // refresher then saw a tiny body with no logged-in proof and no
          // Set-Cookie, so every healthy session was reported as
          // "All refresh URLs failed". A plain GET returns the real
          // logged-in page whose bootstrap carries the account id.
          const res = await this.utils.get(url, this.jar, null, this.ctx.globalOptions, this.ctx);

          // NEXUS FIX: success is NOT "Facebook sent Set-Cookie". Once every
          // cookie is still valid, Facebook sends NO Set-Cookie at all
          // (verified live: both refresh URLs return 200 with a fully
          // logged-in page and zero new cookies), so the old criterion
          // declared every healthy refresh a failure ("All refresh URLs
          // failed"). Success now = the request completed with a sane status
          // AND the page still carries this account's id (logged-in proof);
          // Set-Cookie is accepted as an alternative signal in case the page
          // markup changes. utils.get() already merged any Set-Cookie into
          // the jar, so no second saveCookies call is needed here.
          const status = res && res.statusCode;
          const body = (res && res.body) || "";
          const proof = !!(this.ctx && this.ctx.userID && body.includes(String(this.ctx.userID)));
          const hasNewCookies = !!(res && res.headers && res.headers["set-cookie"]);
          const alive = status >= 200 && status < 400 && (proof || hasNewCookies || !this.ctx.userID);
          if (alive) {
            success = true;
            break;
          }
          logger('CookieRefresher', `${url} returned status ${status} without logged-in proof`, 'debug');
        } catch (err) {
          logger('CookieRefresher', `Failed to refresh with ${url}: ${err.message}`, 'debug');
          // Continue to next URL
        }
      }
      
      if (!success) {
        throw new Error('All refresh URLs failed');
      }
      
      // 2. Get current cookies
      // Self-heal first: a cookie whose expires field lost its type would
      // make this very read throw ("this.expires.getTime is not a
      // function") and kill the whole refresh cycle.
      if (typeof this.utils.sanitizeCookieJar === 'function') {
        const fixed = await this.utils.sanitizeCookieJar(this.jar);
        if (fixed > 0) {
          logger('CookieRefresher', `Repaired ${fixed} cookie(s) with invalid expiry type`, 'warn');
        }
      }
      const appstate = this.utils.getAppState(this.jar);
      
      // 3. Force extend cookie expiry dates if enabled
      if (this.options.forceExpiryExtension) {
        this._extendCookieExpiry(appstate);
      }
      
      // 4. Save refreshed cookies
      if (this.appstatePath) {
        this._saveAppstate(appstate);
      }
      
      // 5. Update counters
      this.lastRefreshTime = Date.now();
      this.refreshCount++;
      if (this.ctx && this.ctx._cookieRefresher) {
        this.ctx._cookieRefresher.lastRefreshTime = this.lastRefreshTime;
        this.ctx._cookieRefresher.refreshCount = this.refreshCount;
      }
      
      logger('CookieRefresher', `Successfully refreshed cookies (refresh #${this.refreshCount})`, 'info');
      return true;
    } catch (err) {
      logger('CookieRefresher', `Cookie refresh failed: ${err.message}`, 'error');
      throw err;
    }
  }
  
  /**
   * Force extend cookie expiry dates
   */
  _extendCookieExpiry(appstate) {
    if (!Array.isArray(appstate)) return;
    
    const now = new Date();
    const expiryDate = new Date(now.getTime() + this.options.expiryDays * 24 * 60 * 60 * 1000);
    
    // Important cookies that should never expire
    const criticalCookies = ['c_user', 'xs', 'fr', 'datr', 'sb', 'spin'];
    
    let extended = 0;
    for (const cookie of appstate) {
      // Skip cookies that shouldn't have their expiry extended
      if (cookie.key && cookie.key.startsWith('_')) continue;
      
      // Set cookie expiry to far future, prioritize critical cookies.
      // NOTE: getAppState returns the jar's LIVE cookie objects, so the
      // value assigned here must be a Date — assigning a UTC string
      // (the previous behavior) poisoned the jar: every later
      // getCookies/getCookieString call threw "this.expires.getTime is
      // not a function" until the process restarted. JSON.stringify
      // serializes the Date to a normal ISO string in the saved file.
      if (
        criticalCookies.includes(cookie.key) ||
        !cookie.expires ||
        (cookie.expires instanceof Date && cookie.expires < expiryDate)
      ) {
        cookie.expires = expiryDate;
        extended++;
      }
    }
    
    logger('CookieRefresher', `Extended expiration for ${extended} cookies to ${expiryDate.toISOString()}`, 'debug');
  }
  
  /**
   * Save appstate with backup
   */
  _saveAppstate(appstate) {
    try {
      // Never overwrite a working session file with an incomplete cookie
      // set (the reported field failure: a save without c_user/xs
      // destroyed the session). The existing file is kept as-is.
      const keys = new Set(appstate.map((c) => c && c.key).filter(Boolean));
      const missing = ['c_user', 'xs'].filter((k) => !keys.has(k));
      if (missing.length > 0) {
        logger('CookieRefresher', `Refreshed cookie set is missing ${missing.join(', ')} — keeping the existing appstate file untouched`, 'warn');
        return false;
      }

      // 1. Save main appstate file
      fs.writeFileSync(this.appstatePath, JSON.stringify(appstate, null, 2));
      
      // 2. Create backup if enabled
      if (this.options.backupEnabled) {
        const backupName = `appstate_refreshed_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        const backupPath = path.join(this.backupPath, backupName);
        
        const backupData = {
          appstate,
          metadata: {
            refreshed: new Date().toISOString(),
            refreshCount: this.refreshCount,
            sessionStartTime: new Date(this.sessionStartTime).toISOString(),
            source: 'NexusCookieRefresher'
          }
        };
        
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
        
        // 3. Cleanup old backups if needed
        this._cleanupOldBackups();
      }
      
      return true;
    } catch (err) {
      logger('CookieRefresher', `Failed to save refreshed appstate: ${err.message}`, 'error');
      return false;
    }
  }
  
  /**
   * Clean up old backup files
   */
  _cleanupOldBackups() {
    try {
      const maxBackups = this.options.maxBackups;
      const backupDir = this.backupPath;
      
      // Find all appstate backup files
      const files = fs.readdirSync(backupDir)
        .filter(file => file.startsWith('appstate_refreshed_') && file.endsWith('.json'))
        .map(file => path.join(backupDir, file));
      
      // Sort by modified time (newest first)
      files.sort((a, b) => {
        return fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime();
      });
      
      // Delete old backups beyond the limit
      if (files.length > maxBackups) {
        const toDelete = files.slice(maxBackups);
        for (const file of toDelete) {
          fs.unlinkSync(file);
        }
        logger('CookieRefresher', `Cleaned up ${toDelete.length} old cookie backup files`, 'debug');
      }
    } catch (err) {
      logger('CookieRefresher', `Backup cleanup error: ${err.message}`, 'debug');
    }
  }
  
  /**
   * Stop the refresher
   */
  stop() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
  
  /**
   * Perform an immediate refresh
   */
  async refreshNow() {
    this.stop();
    await this.performRefresh();
    this.start();
    return true;
  }
}

module.exports = { CookieRefresher };
