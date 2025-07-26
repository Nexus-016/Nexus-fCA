"use strict";

/**
 * Nexus-FCA Enhanced User Class
 * Represents a Facebook user with advanced information and interaction methods
 */

class User {
  constructor(client, data) {
    this.client = client;
    
    // Basic user properties
    this.userID = data.userID || data.id;
    this.name = data.name || data.fullName || 'Unknown User';
    this.firstName = data.firstName || '';
    this.lastName = data.lastName || '';
    this.alternateName = data.alternateName || '';
    
    // Profile information
    this.profilePicture = data.profilePicture || data.thumbSrc || null;
    this.profileUrl = data.profileUrl || data.uri || null;
    this.vanity = data.vanity || null;
    this.gender = data.gender || 'unknown';
    
    // User status
    this.isOnline = data.isOnline || false;
    this.lastActive = data.lastActive || null;
    this.isFriend = data.isFriend || false;
    this.isBlocked = data.isBlocked || false;
    this.isBirthday = data.isBirthday || false;
    
    // Additional metadata
    this.type = data.type || 'user';
    this.isVerified = data.isVerified || false;
    this.isMessengerUser = data.isMessengerUser !== false;
    
    // Cache for dynamic data
    this._conversations = new Map();
    this._sharedThreads = null;
    this._lastFetched = Date.now();
  }

  /**
   * Send a direct message to this user
   */
  async send(content, options = {}) {
    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    return new Promise((resolve, reject) => {
      this.client.api.sendMessage(content, this.userID, (err, messageInfo) => {
        if (err) reject(err);
        else resolve(messageInfo);
      }, options.messageID);
    });
  }

  /**
   * Get conversation thread with this user
   */
  async getThread() {
    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    try {
      const threadInfo = await this.client.getThreadInfo(this.userID);
      return threadInfo;
    } catch (error) {
      console.error('Failed to get thread info:', error);
      return null;
    }
  }

  /**
   * Get shared threads/groups with this user
   */
  async getSharedThreads() {
    if (this._sharedThreads && (Date.now() - this._lastFetched) < 300000) {
      return this._sharedThreads; // Return cached if less than 5 minutes old
    }

    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    try {
      // Get all threads and filter for ones containing this user
      const threads = await new Promise((resolve, reject) => {
        this.client.api.getThreadList(50, null, ['INBOX'], (err, list) => {
          if (err) reject(err);
          else resolve(list);
        });
      });

      this._sharedThreads = threads.filter(thread => 
        thread.participantIDs && thread.participantIDs.includes(this.userID)
      );
      
      this._lastFetched = Date.now();
      return this._sharedThreads;
    } catch (error) {
      console.error('Failed to get shared threads:', error);
      return [];
    }
  }

  /**
   * Check friendship status
   */
  async checkFriendship() {
    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    try {
      const userInfo = await this.client.getUserInfo(this.userID);
      this.isFriend = userInfo.isFriend || false;
      return this.isFriend;
    } catch (error) {
      console.error('Failed to check friendship:', error);
      return false;
    }
  }

  /**
   * Block this user
   */
  async block() {
    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    return new Promise((resolve, reject) => {
      this.client.api.changeBlockedStatus(this.userID, true, (err) => {
        if (err) reject(err);
        else {
          this.isBlocked = true;
          resolve();
        }
      });
    });
  }

  /**
   * Unblock this user
   */
  async unblock() {
    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    return new Promise((resolve, reject) => {
      this.client.api.changeBlockedStatus(this.userID, false, (err) => {
        if (err) reject(err);
        else {
          this.isBlocked = false;
          resolve();
        }
      });
    });
  }

  /**
   * Follow this user (if available)
   */
  async follow() {
    if (!this.client.api || !this.client.api.follow) {
      throw new Error('Follow functionality not available');
    }

    return new Promise((resolve, reject) => {
      this.client.api.follow(this.userID, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Unfollow this user (if available)
   */
  async unfollow() {
    if (!this.client.api || !this.client.api.unfriend) {
      throw new Error('Unfollow functionality not available');
    }

    return new Promise((resolve, reject) => {
      this.client.api.unfriend(this.userID, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Get user's profile picture in different sizes
   */
  async getProfilePicture(size = 'large') {
    if (!this.client.api || !this.client.api.getAvatarUser) {
      return this.profilePicture; // Return cached version
    }

    try {
      return new Promise((resolve, reject) => {
        this.client.api.getAvatarUser(this.userID, (err, avatar) => {
          if (err) reject(err);
          else {
            this.profilePicture = avatar.url || avatar;
            resolve(this.profilePicture);
          }
        });
      });
    } catch (error) {
      console.error('Failed to get profile picture:', error);
      return this.profilePicture;
    }
  }

  /**
   * Start a voice/video call with this user (if supported)
   */
  async call(type = 'voice') {
    // This would need implementation based on Facebook's calling API
    throw new Error('Calling functionality not yet implemented');
  }

  /**
   * Create a group with this user
   */
  async createGroup(additionalUsers = [], groupName = null) {
    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    const participants = [this.userID, ...additionalUsers];
    
    return new Promise((resolve, reject) => {
      this.client.api.createNewGroup(participants, groupName, (err, threadID) => {
        if (err) reject(err);
        else resolve(threadID);
      });
    });
  }

  /**
   * Get conversation history with this user
   */
  async getHistory(amount = 10, timestamp = null) {
    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    return new Promise((resolve, reject) => {
      this.client.api.getThreadHistory(this.userID, amount, timestamp, (err, history) => {
        if (err) reject(err);
        else {
          // Cache conversation
          history.forEach(msg => {
            if (msg.messageID) {
              this._conversations.set(msg.messageID, msg);
            }
          });
          resolve(history);
        }
      });
    });
  }

  /**
   * Check if user is currently typing
   */
  isTyping() {
    // This would need to be maintained by the client's typing event handler
    return false; // Placeholder
  }

  /**
   * Get user's presence status
   */
  getPresence() {
    return {
      isOnline: this.isOnline,
      lastActive: this.lastActive,
      status: this.isOnline ? 'online' : 'offline'
    };
  }

  /**
   * Update user information from Facebook
   */
  async refresh() {
    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    try {
      const updatedInfo = await this.client.getUserInfo(this.userID);
      
      // Update all properties
      Object.assign(this, updatedInfo);
      this._lastFetched = Date.now();
      
      return this;
    } catch (error) {
      console.error('Failed to refresh user info:', error);
      throw error;
    }
  }

  /**
   * Get user's display name
   */
  getDisplayName() {
    return this.alternateName || this.name || `User ${this.userID}`;
  }

  /**
   * Get user's initials
   */
  getInitials() {
    const name = this.getDisplayName();
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  /**
   * Check if user has a profile picture
   */
  hasProfilePicture() {
    return this.profilePicture && this.profilePicture !== '';
  }

  /**
   * Get age of account (if birthday is available)
   */
  getAccountAge() {
    // This would need birthday information which might not be available
    return null; // Placeholder
  }

  /**
   * Check if user is active (recently online)
   */
  isActive(threshold = 300000) { // 5 minutes default
    if (!this.lastActive) return false;
    return (Date.now() - this.lastActive) < threshold;
  }

  /**
   * Get user statistics
   */
  getStats() {
    return {
      messageCount: this._conversations.size,
      isOnline: this.isOnline,
      isFriend: this.isFriend,
      isBlocked: this.isBlocked,
      hasProfilePicture: this.hasProfilePicture(),
      isActive: this.isActive(),
      lastUpdated: this._lastFetched
    };
  }

  /**
   * Compare users
   */
  equals(otherUser) {
    if (!otherUser) return false;
    return this.userID === otherUser.userID;
  }

  /**
   * Convert to JSON for storage
   */
  toJSON() {
    return {
      userID: this.userID,
      name: this.name,
      firstName: this.firstName,
      lastName: this.lastName,
      alternateName: this.alternateName,
      profilePicture: this.profilePicture,
      profileUrl: this.profileUrl,
      vanity: this.vanity,
      gender: this.gender,
      isOnline: this.isOnline,
      lastActive: this.lastActive,
      isFriend: this.isFriend,
      isBlocked: this.isBlocked,
      isBirthday: this.isBirthday,
      type: this.type,
      isVerified: this.isVerified,
      isMessengerUser: this.isMessengerUser,
      _lastFetched: this._lastFetched
    };
  }

  /**
   * Create user from JSON
   */
  static fromJSON(client, data) {
    const user = new User(client, data);
    user._lastFetched = data._lastFetched || Date.now();
    return user;
  }

  /**
   * Format user for display
   */
  toString() {
    const status = this.isOnline ? '🟢' : '⚫';
    const friend = this.isFriend ? '👥' : '';
    return `${status} ${this.getDisplayName()} ${friend}`.trim();
  }

  /**
   * Create a mention string for this user
   */
  toMention() {
    return `@${this.getDisplayName()}`;
  }
}

module.exports = User;
