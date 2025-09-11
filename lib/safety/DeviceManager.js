"use strict";

/**
 * Nexus Device Manager
 * Ensures consistent device fingerprinting to prevent Facebook security triggers
 */

const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const { v4: uuidv4 } = require('uuid');

class DeviceManager {
  constructor(options = {}) {
    this.options = {
      enabled: options.enabled !== false,
      deviceFilePath: options.deviceFilePath || './device.json',
      ...options
    };
    
    this.deviceInfo = null;
    this.initialized = false;
  }
  
  /**
   * Initialize device manager and load/create device profile
   */
  initialize() {
    if (this.initialized) return this;
    
    try {
      // Check if environment variable overrides path
      const envPath = process.env.NEXUS_DEVICE_FILE;
      if (envPath) {
        this.options.deviceFilePath = envPath;
      }
      
      // Ensure directory exists
      const dirPath = path.dirname(this.options.deviceFilePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      // Try to load existing device info
      if (fs.existsSync(this.options.deviceFilePath)) {
        this.deviceInfo = JSON.parse(fs.readFileSync(this.options.deviceFilePath, 'utf8'));
        logger(`Loaded existing device profile: ${this.deviceInfo.deviceId}`, 'info');
      } else {
        // Create new device info
        this.deviceInfo = this._generateDeviceInfo();
        this._saveDeviceInfo();
        logger(`Created new device profile: ${this.deviceInfo.deviceId}`, 'info');
      }
      
      this.initialized = true;
      return this;
    } catch (err) {
      logger(`Failed to initialize DeviceManager: ${err.message}`, 'error');
      // Fallback to default device info
      this.deviceInfo = this._generateDeviceInfo();
      return this;
    }
  }
  
  /**
   * Generate new device information
   */
  _generateDeviceInfo() {
    const deviceId = `device_${uuidv4().replace(/-/g, '')}`;
    const familyDeviceId = `family_device_${uuidv4().replace(/-/g, '')}`;
    
    // Modern Facebook user agent strings
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.99 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.99 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
    ];
    
    return {
      deviceId,
      familyDeviceId,
      userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
      created: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };
  }
  
  /**
   * Save device information to file
   */
  _saveDeviceInfo() {
    if (!this.options.enabled || !this.deviceInfo) return false;
    
    try {
      // Update last used timestamp
      this.deviceInfo.lastUsed = new Date().toISOString();
      
      // Save to file
      fs.writeFileSync(this.options.deviceFilePath, JSON.stringify(this.deviceInfo, null, 2));
      return true;
    } catch (err) {
      logger(`Failed to save device info: ${err.message}`, 'error');
      return false;
    }
  }
  
  /**
   * Get device ID for consistent identification
   */
  getDeviceId() {
    if (!this.initialized) this.initialize();
    return this.deviceInfo?.deviceId || `device_${uuidv4().replace(/-/g, '')}`;
  }
  
  /**
   * Get family device ID for consistent identification
   */
  getFamilyDeviceId() {
    if (!this.initialized) this.initialize();
    return this.deviceInfo?.familyDeviceId || `family_device_${uuidv4().replace(/-/g, '')}`;
  }
  
  /**
   * Get user agent for consistent browser fingerprint
   */
  getUserAgent() {
    if (!this.initialized) this.initialize();
    return this.deviceInfo?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.99 Safari/537.36';
  }
  
  /**
   * Apply device information to request options
   */
  applyToRequestOptions(options = {}) {
    if (!this.initialized) this.initialize();
    
    return {
      ...options,
      headers: {
        ...options.headers,
        'User-Agent': this.getUserAgent(),
        'X-FB-Device-Id': this.getDeviceId(),
        'X-FB-Family-Device-ID': this.getFamilyDeviceId()
      }
    };
  }
  
  /**
   * Update last used timestamp
   */
  updateUsage() {
    if (!this.initialized) this.initialize();
    if (this.deviceInfo) {
      this.deviceInfo.lastUsed = new Date().toISOString();
      this._saveDeviceInfo();
    }
  }
}

module.exports = { DeviceManager };
