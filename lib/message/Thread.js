"use strict";

/**
 * Nexus-FCA Enhanced Thread Class
 * Represents a conversation thread with advanced management features
 */

class Thread {
  constructor(client, data) {
    this.client = client;
    
    // Basic thread properties
    this.threadID = data.threadID;
    this.name = data.name || 'Unknown Thread';
    this.isGroup = data.isGroup || false;
    this.participants = data.participants || [];
    this.participantIDs = data.participantIDs || [];
    
    // Thread settings
    this.color = data.color || null;
    this.emoji = data.emoji || null;
    this.nicknames = data.nicknames || {};
    this.adminIDs = data.adminIDs || [];
    
    // Thread status
    this.isArchived = data.isArchived || false;
    this.isSubscribed = data.isSubscribed !== false;
    this.muteUntil = data.muteUntil || null;
    
    // Message information
    this.messageCount = data.messageCount || 0;
    this.unreadCount = data.unreadCount || 0;
    this.lastMessage = data.lastMessage || null;
    this.lastMessageTimestamp = data.lastMessageTimestamp || null;
    
    // Thread metadata
    this.folder = data.folder || 'INBOX';
    this.timestamp = data.timestamp || Date.now();
    this.canReply = data.canReply !== false;
    this.approvalMode = data.approvalMode || false;
    
    // Cached data
    this._messages = new Map();
    this._cachedParticipants = new Map();
  }

  /**
   * Send a message to this thread
   */
  async send(content, options = {}) {
    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    return new Promise((resolve, reject) => {
      this.client.api.sendMessage(content, this.threadID, (err, messageInfo) => {
        if (err) reject(err);
        else {
          this.messageCount++;
          this.lastMessage = content;
          this.lastMessageTimestamp = Date.now();
          resolve(messageInfo);
        }
      }, options.messageID);
    });
  }

  /**
   * Get thread history with pagination
   */
  async getHistory(amount = 10, timestamp = null) {
    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    return new Promise((resolve, reject) => {
      this.client.api.getThreadHistory(this.threadID, amount, timestamp, (err, history) => {
        if (err) reject(err);
        else {
          // Cache messages
          history.forEach(msg => {
            if (msg.messageID) {
              this._messages.set(msg.messageID, msg);
            }
          });
          resolve(history);
        }
      });
    });
  }

  /**
   * Get detailed thread information
   */
  async getInfo() {
    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    return new Promise((resolve, reject) => {
      this.client.api.getThreadInfo(this.threadID, (err, info) => {
        if (err) reject(err);
        else {
          // Update current thread data
          Object.assign(this, info);
          resolve(info);
        }
      });
    });
  }

  /**
   * Add user to group thread
   */
  async addUser(userID) {
    if (!this.client.api || !this.isGroup) {
      throw new Error('Can only add users to group threads');
    }

    return new Promise((resolve, reject) => {
      this.client.api.addUserToGroup(userID, this.threadID, (err) => {
        if (err) reject(err);
        else {
          // Update participants
          if (!this.participantIDs.includes(userID)) {
            this.participantIDs.push(userID);
          }
          resolve();
        }
      });
    });
  }

  /**
   * Remove user from group thread
   */
  async removeUser(userID) {
    if (!this.client.api || !this.isGroup) {
      throw new Error('Can only remove users from group threads');
    }

    return new Promise((resolve, reject) => {
      this.client.api.removeUserFromGroup(userID, this.threadID, (err) => {
        if (err) reject(err);
        else {
          // Update participants
          this.participantIDs = this.participantIDs.filter(id => id !== userID);
          resolve();
        }
      });
    });
  }

  /**
   * Change thread title
   */
  async setTitle(newTitle) {
    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    return new Promise((resolve, reject) => {
      this.client.api.setTitle(newTitle, this.threadID, (err) => {
        if (err) reject(err);
        else {
          this.name = newTitle;
          resolve();
        }
      });
    });
  }

  /**
   * Change thread color
   */
  async setColor(color) {
    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    return new Promise((resolve, reject) => {
      this.client.api.changeThreadColor(color, this.threadID, (err) => {
        if (err) reject(err);
        else {
          this.color = color;
          resolve();
        }
      });
    });
  }

  /**
   * Change thread emoji
   */
  async setEmoji(emoji) {
    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    return new Promise((resolve, reject) => {
      this.client.api.changeThreadEmoji(emoji, this.threadID, (err) => {
        if (err) reject(err);
        else {
          this.emoji = emoji;
          resolve();
        }
      });
    });
  }

  /**
   * Set nickname for a user in this thread
   */
  async setNickname(userID, nickname) {
    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    return new Promise((resolve, reject) => {
      this.client.api.changeNickname(nickname, this.threadID, userID, (err) => {
        if (err) reject(err);
        else {
          this.nicknames[userID] = nickname;
          resolve();
        }
      });
    });
  }

  /**
   * Change admin status for a user
   */
  async setAdmin(userID, isAdmin = true) {
    if (!this.client.api || !this.isGroup) {
      throw new Error('Admin changes only available in group threads');
    }

    return new Promise((resolve, reject) => {
      this.client.api.changeAdminStatus(this.threadID, [userID], isAdmin, (err) => {
        if (err) reject(err);
        else {
          if (isAdmin && !this.adminIDs.includes(userID)) {
            this.adminIDs.push(userID);
          } else if (!isAdmin) {
            this.adminIDs = this.adminIDs.filter(id => id !== userID);
          }
          resolve();
        }
      });
    });
  }

  /**
   * Archive/unarchive thread
   */
  async archive(archived = true) {
    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    return new Promise((resolve, reject) => {
      this.client.api.changeArchivedStatus(this.threadID, archived, (err) => {
        if (err) reject(err);
        else {
          this.isArchived = archived;
          resolve();
        }
      });
    });
  }

  /**
   * Mute thread for specified duration
   */
  async mute(seconds = 3600) {
    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    return new Promise((resolve, reject) => {
      this.client.api.muteThread(this.threadID, seconds, (err) => {
        if (err) reject(err);
        else {
          this.muteUntil = Date.now() + (seconds * 1000);
          resolve();
        }
      });
    });
  }

  /**
   * Mark thread as read
   */
  async markAsRead() {
    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    return new Promise((resolve, reject) => {
      this.client.api.markAsRead(this.threadID, true, (err) => {
        if (err) reject(err);
        else {
          this.unreadCount = 0;
          resolve();
        }
      });
    });
  }

  /**
   * Start typing indicator
   */
  async startTyping() {
    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    return new Promise((resolve, reject) => {
      this.client.api.sendTypingIndicator(this.threadID, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Get participant information
   */
  async getParticipant(userID) {
    // Check cache first
    if (this._cachedParticipants.has(userID)) {
      return this._cachedParticipants.get(userID);
    }

    try {
      const userInfo = await this.client.getUserInfo(userID);
      this._cachedParticipants.set(userID, userInfo);
      return userInfo;
    } catch (error) {
      console.error('Failed to get participant info:', error);
      return null;
    }
  }

  /**
   * Get all participants information
   */
  async getAllParticipants() {
    const participants = [];
    
    for (const userID of this.participantIDs) {
      try {
        const participant = await this.getParticipant(userID);
        if (participant) {
          participants.push({
            ...participant,
            nickname: this.nicknames[userID] || null,
            isAdmin: this.adminIDs.includes(userID)
          });
        }
      } catch (error) {
        console.error(`Failed to get info for participant ${userID}:`, error);
      }
    }
    
    return participants;
  }

  /**
   * Check if user is admin
   */
  isAdmin(userID) {
    return this.adminIDs.includes(userID.toString());
  }

  /**
   * Check if user is participant
   */
  hasParticipant(userID) {
    return this.participantIDs.includes(userID.toString());
  }

  /**
   * Get user's nickname in this thread
   */
  getNickname(userID) {
    return this.nicknames[userID.toString()] || null;
  }

  /**
   * Check if thread is muted
   */
  isMuted() {
    return this.muteUntil && Date.now() < this.muteUntil;
  }

  /**
   * Get thread picture URLs
   */
  async getPictures(offset = 0, limit = 25) {
    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    return new Promise((resolve, reject) => {
      this.client.api.getThreadPictures(this.threadID, offset, limit, (err, pictures) => {
        if (err) reject(err);
        else resolve(pictures);
      });
    });
  }

  /**
   * Create a poll in this thread
   */
  async createPoll(title, options = {}) {
    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    return new Promise((resolve, reject) => {
      this.client.api.createPoll(title, this.threadID, options, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Get thread statistics
   */
  getStats() {
    return {
      participantCount: this.participantIDs.length,
      adminCount: this.adminIDs.length,
      messageCount: this.messageCount,
      unreadCount: this.unreadCount,
      isActive: this.lastMessageTimestamp && (Date.now() - this.lastMessageTimestamp) < 86400000, // 24 hours
      isMuted: this.isMuted(),
      isArchived: this.isArchived,
      ageInDays: Math.floor((Date.now() - this.timestamp) / 86400000)
    };
  }

  /**
   * Convert to JSON for storage
   */
  toJSON() {
    return {
      threadID: this.threadID,
      name: this.name,
      isGroup: this.isGroup,
      participants: this.participants,
      participantIDs: this.participantIDs,
      color: this.color,
      emoji: this.emoji,
      nicknames: this.nicknames,
      adminIDs: this.adminIDs,
      isArchived: this.isArchived,
      isSubscribed: this.isSubscribed,
      muteUntil: this.muteUntil,
      messageCount: this.messageCount,
      unreadCount: this.unreadCount,
      lastMessage: this.lastMessage,
      lastMessageTimestamp: this.lastMessageTimestamp,
      folder: this.folder,
      timestamp: this.timestamp,
      canReply: this.canReply,
      approvalMode: this.approvalMode
    };
  }

  /**
   * Create thread from JSON
   */
  static fromJSON(client, data) {
    return new Thread(client, data);
  }

  /**
   * Format thread for display
   */
  toString() {
    const type = this.isGroup ? 'Group' : 'Direct';
    const participants = this.isGroup ? ` (${this.participantIDs.length} members)` : '';
    return `[${type}] ${this.name}${participants}`;
  }
}

module.exports = Thread;
