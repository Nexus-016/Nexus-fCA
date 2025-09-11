"use strict";

/**
 * Nexus Cookie Manager
 * Ensures Facebook session cookies stay valid and fixes expiry issues
 */

const fs = require('fs');
const path = require('path');
const logger = require('../logger');

class CookieManager {
  /**
   * Fix expiry dates on Facebook cookies to prevent rapid expiration
   * @param {Array} cookies - Array of Facebook cookies from appstate
   * @param {Object} options - Options for fixing cookies
   * @returns {Array} - Fixed cookies with proper expiry dates
   */
  static fixCookieExpiry(cookies, options = {}) {
    if (!Array.isArray(cookies) || cookies.length === 0) {
      return cookies;
    }
    
    const {
      defaultExpiryDays = 90,
      criticalExpiryDays = 90,
      refreshExisting = true
    } = options;
    
    const now = new Date();
    const criticalCookies = ['c_user', 'xs', 'fr', 'datr', 'sb', 'spin'];
    let fixedCount = 0;
    
    for (const cookie of cookies) {
      // Skip cookies with no key
      if (!cookie.key) continue;
      
      const isCritical = criticalCookies.includes(cookie.key);
      const days = isCritical ? criticalExpiryDays : defaultExpiryDays;
      
      // Check if cookie needs expiry fix
      const needsFix = !cookie.expires || 
                      refreshExisting || 
                      !this._isValidDate(cookie.expires) ||
                      this._getRemainingDays(cookie.expires) < 7;
      
      if (needsFix) {
        // Set expiry to future date
        const futureDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));
        cookie.expires = futureDate.toUTCString();
        fixedCount++;
      }
    }
    
    if (fixedCount > 0) {
      logger(`Fixed expiry dates for ${fixedCount} cookies`, 'info');
    }
    
    return cookies;
  }
  
  /**
   * Check if cookie expiry is a valid date
   * @param {string} dateStr - Date string to check
   * @returns {boolean} - True if valid date
   */
  static _isValidDate(dateStr) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }
  
  /**
   * Get days remaining until expiry
   * @param {string} dateStr - Date string to check
   * @returns {number} - Days remaining
   */
  static _getRemainingDays(dateStr) {
    if (!dateStr) return 0;
    try {
      const expiryDate = new Date(dateStr);
      const now = new Date();
      return Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));
    } catch (e) {
      return 0;
    }
  }
  
  /**
   * Check if appstate has critical cookies
   * @param {Array} cookies - Cookies to check
   * @returns {Object} - Result with status and missing cookies
   */
  static validateCriticalCookies(cookies) {
    if (!Array.isArray(cookies) || cookies.length === 0) {
      return { valid: false, missing: ['all'] };
    }
    
    const criticalCookies = ['c_user', 'xs', 'datr', 'sb'];
    const missing = [];
    
    for (const critical of criticalCookies) {
      if (!cookies.some(c => c.key === critical)) {
        missing.push(critical);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing
    };
  }
  
  /**
   * Generate default cookie expiry date
   * @param {string} cookieName - Name of cookie
   * @returns {string} - Expiry date string
   */
  static getDefaultExpiry(cookieName) {
    const now = new Date();
    const criticalCookies = ['c_user', 'xs', 'fr', 'datr', 'sb'];
    
    // Critical cookies get 90 days, others get 30 days
    const days = criticalCookies.includes(cookieName) ? 90 : 30;
    const future = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));
    return future.toUTCString();
  }
  
  /**
   * Load and fix appstate file
   * @param {string} appstatePath - Path to appstate.json
   * @returns {Array|null} - Fixed cookies or null if failed
   */
  static loadAndFixAppstate(appstatePath) {
    try {
      if (!fs.existsSync(appstatePath)) {
        logger(`Appstate file not found: ${appstatePath}`, 'error');
        return null;
      }
      
      const cookies = JSON.parse(fs.readFileSync(appstatePath, 'utf8'));
      if (!Array.isArray(cookies)) {
        logger('Invalid appstate format: not an array', 'error');
        return null;
      }
      
      // Fix expiry dates
      const fixed = this.fixCookieExpiry(cookies);
      
      // Validate critical cookies
      const validation = this.validateCriticalCookies(fixed);
      if (!validation.valid) {
        logger(`Missing critical cookies: ${validation.missing.join(', ')}`, 'warn');
      }
      
      // Save back fixed cookies
      fs.writeFileSync(appstatePath, JSON.stringify(fixed, null, 2));
      logger(`Fixed and saved appstate with ${fixed.length} cookies`, 'info');
      
      return fixed;
    } catch (err) {
      logger(`Failed to load and fix appstate: ${err.message}`, 'error');
      return null;
    }
  }
}

module.exports = { CookieManager };
