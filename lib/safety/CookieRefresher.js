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
      const urls = [
        'https://www.facebook.com/me',
        'https://www.facebook.com/ajax/haste-response/?__a=1',
        'https://www.facebook.com/ajax/bootloader-endpoint/?__a=1'
      ];
      
      let success = false;
      for (const url of urls) {
        try {
          // Try multiple URLs in case some are blocked
          const res = await this.defaultFuncs.get(url, this.jar, {});
          
          // Save any cookies that were set
          if (res && res.headers && res.headers["set-cookie"]) {
            this.utils.saveCookies(this.jar)(res);
            success = true;
            break;
          }
        } catch (err) {
          logger('CookieRefresher', `Failed to refresh with ${url}: ${err.message}`, 'debug');
          // Continue to next URL
        }
      }
      
      if (!success) {
        throw new Error('All refresh URLs failed');
      }
      
      // 2. Get current cookies
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
    const expiryStr = expiryDate.toUTCString();
    
    // Important cookies that should never expire
    const criticalCookies = ['c_user', 'xs', 'fr', 'datr', 'sb', 'spin'];
    
    let extended = 0;
    for (const cookie of appstate) {
      // Skip cookies that shouldn't have their expiry extended
      if (cookie.key && cookie.key.startsWith('_')) continue;
      
      // Set cookie expiry to far future, prioritize critical cookies
      if (criticalCookies.includes(cookie.key) || !cookie.expires || new Date(cookie.expires) < expiryDate) {
        cookie.expires = expiryStr;
        extended++;
      }
    }
    
    logger('CookieRefresher', `Extended expiration for ${extended} cookies to ${expiryStr}`, 'debug');
  }
  
  /**
   * Save appstate with backup
   */
  _saveAppstate(appstate) {
    try {
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
