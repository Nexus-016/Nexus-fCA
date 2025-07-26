"use strict";

/**
 * Nexus-FCA Enhanced Message Class
 * Provides Discord.js style message handling with advanced features
 */

class Message {
  constructor(client, data) {
    this.client = client;
    
    // Basic message properties
    this.messageID = data.messageID;
    this.threadID = data.threadID;
    this.senderID = data.senderID;
    this.body = data.body || '';
    this.content = data.body || ''; // Alias for Discord.js compatibility
    
    // Enhanced properties
    this.type = data.type || 'message';
    this.timestamp = data.timestamp || Date.now();
    this.attachments = data.attachments || [];
    this.mentions = data.mentions || {};
    this.args = data.args || [];
    this.isGroup = data.isGroup || false;
    
    // Reply information if this is a reply
    this.messageReply = data.messageReply || null;
    this.replyTo = data.messageReply || null; // Alias
    
    // Reaction information
    this.reactions = new Map();
    
    // Message metadata
    this.metadata = {
      deliveredAt: null,
      readAt: null,
      editedAt: null,
      isEdited: false,
      isUnsent: false
    };

    // Cache user and thread info
    this._author = null;
    this._thread = null;
  }

  /**
   * Get message author (cached)
   */
  async getAuthor() {
    if (this._author) return this._author;
    
    try {
      this._author = await this.client.getUserInfo(this.senderID);
      return this._author;
    } catch (error) {
      console.error('Failed to get author info:', error);
      return { userID: this.senderID, name: 'Unknown User' };
    }
  }

  /**
   * Get thread information (cached)
   */
  async getThread() {
    if (this._thread) return this._thread;
    
    try {
      this._thread = await this.client.getThreadInfo(this.threadID);
      return this._thread;
    } catch (error) {
      console.error('Failed to get thread info:', error);
      return { threadID: this.threadID, name: 'Unknown Thread' };
    }
  }

  /**
   * Reply to this message
   */
  async reply(content, options = {}) {
    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    const messageOptions = {
      ...options,
      replyTo: this.messageID
    };

    return new Promise((resolve, reject) => {
      this.client.api.sendMessage(content, this.threadID, (err, messageInfo) => {
        if (err) reject(err);
        else resolve(messageInfo);
      }, messageOptions.messageID);
    });
  }

  /**
   * React to this message
   */
  async react(emoji) {
    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    return new Promise((resolve, reject) => {
      this.client.api.setMessageReaction(emoji, this.messageID, (err) => {
        if (err) reject(err);
        else {
          // Update local reactions
          this.reactions.set(emoji, {
            emoji,
            userID: this.client.api.getCurrentUserID(),
            timestamp: Date.now()
          });
          resolve();
        }
      });
    });
  }

  /**
   * Remove reaction from this message
   */
  async unreact(emoji = '') {
    return this.react(emoji); // Empty string removes reaction
  }

  /**
   * Unsend/delete this message
   */
  async unsend() {
    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    return new Promise((resolve, reject) => {
      this.client.api.unsendMessage(this.messageID, (err) => {
        if (err) reject(err);
        else {
          this.metadata.isUnsent = true;
          resolve();
        }
      });
    });
  }

  /**
   * Edit this message (if supported)
   */
  async edit(newContent) {
    if (!this.client.api || !this.client.api.editMessage) {
      throw new Error('Message editing not supported');
    }

    return new Promise((resolve, reject) => {
      this.client.api.editMessage(newContent, this.messageID, (err) => {
        if (err) reject(err);
        else {
          this.body = newContent;
          this.content = newContent;
          this.metadata.isEdited = true;
          this.metadata.editedAt = Date.now();
          resolve();
        }
      });
    });
  }

  /**
   * Forward this message to another thread
   */
  async forward(targetThreadID) {
    if (!this.client.api) {
      throw new Error('Client not ready');
    }

    // Forward attachments if any
    if (this.attachments.length > 0) {
      for (const attachment of this.attachments) {
        if (attachment.ID) {
          await new Promise((resolve, reject) => {
            this.client.api.forwardAttachment(attachment.ID, targetThreadID, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        }
      }
    }

    // Forward text content if any
    if (this.body.trim()) {
      return new Promise((resolve, reject) => {
        this.client.api.sendMessage(`Forwarded: ${this.body}`, targetThreadID, (err, messageInfo) => {
          if (err) reject(err);
          else resolve(messageInfo);
        });
      });
    }
  }

  /**
   * Pin this message (if in group)
   */
  async pin() {
    if (!this.client.api || !this.isGroup) {
      throw new Error('Message pinning not available');
    }

    return new Promise((resolve, reject) => {
      this.client.api.pinMessage(true, this.messageID, this.threadID, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Unpin this message
   */
  async unpin() {
    if (!this.client.api || !this.isGroup) {
      throw new Error('Message unpinning not available');
    }

    return new Promise((resolve, reject) => {
      this.client.api.pinMessage(false, this.messageID, this.threadID, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Check if message mentions a specific user
   */
  mentions(userID) {
    return Object.keys(this.mentions).includes(userID.toString());
  }

  /**
   * Check if message mentions everyone (@everyone equivalent)
   */
  mentionsEveryone() {
    // Check if message contains @everyone or @all
    return this.body.includes('@everyone') || this.body.includes('@all');
  }

  /**
   * Get mentioned users
   */
  getMentionedUsers() {
    return Object.keys(this.mentions);
  }

  /**
   * Check if message has attachments of specific type
   */
  hasAttachments(type = null) {
    if (!type) return this.attachments.length > 0;
    return this.attachments.some(att => att.type === type);
  }

  /**
   * Get attachments by type
   */
  getAttachments(type = null) {
    if (!type) return this.attachments;
    return this.attachments.filter(att => att.type === type);
  }

  /**
   * Check if message is a reply
   */
  isReply() {
    return this.messageReply !== null;
  }

  /**
   * Get the message this is replying to
   */
  getRepliedMessage() {
    return this.messageReply;
  }

  /**
   * Extract URLs from message content
   */
  extractUrls() {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return this.body.match(urlRegex) || [];
  }

  /**
   * Extract hashtags from message content
   */
  extractHashtags() {
    const hashtagRegex = /#(\w+)/g;
    const matches = this.body.match(hashtagRegex) || [];
    return matches.map(tag => tag.substring(1));
  }

  /**
   * Check if message is from bot/page
   */
  isFromBot() {
    // This would need to be enhanced based on how Facebook identifies bots
    return false; // Placeholder
  }

  /**
   * Calculate message age
   */
  getAge() {
    return Date.now() - this.timestamp;
  }

  /**
   * Format message for logging
   */
  toString() {
    const author = this._author?.name || this.senderID;
    const thread = this._thread?.name || this.threadID;
    return `[${new Date(this.timestamp).toISOString()}] ${author} in ${thread}: ${this.body}`;
  }

  /**
   * Convert to JSON for storage/transport
   */
  toJSON() {
    return {
      messageID: this.messageID,
      threadID: this.threadID,
      senderID: this.senderID,
      body: this.body,
      type: this.type,
      timestamp: this.timestamp,
      attachments: this.attachments,
      mentions: this.mentions,
      args: this.args,
      isGroup: this.isGroup,
      messageReply: this.messageReply,
      reactions: Array.from(this.reactions.entries()),
      metadata: this.metadata
    };
  }

  /**
   * Create message from JSON
   */
  static fromJSON(client, data) {
    const message = new Message(client, data);
    
    // Restore reactions
    if (data.reactions) {
      for (const [emoji, reactionData] of data.reactions) {
        message.reactions.set(emoji, reactionData);
      }
    }
    
    // Restore metadata
    if (data.metadata) {
      message.metadata = { ...message.metadata, ...data.metadata };
    }
    
    return message;
  }

  /**
   * Create a rich embed-like object for the message
   */
  createEmbed() {
    return {
      title: this.isReply() ? `Reply to: ${this.messageReply.body.substring(0, 50)}...` : 'Message',
      description: this.body,
      author: {
        name: this._author?.name || 'Unknown',
        id: this.senderID
      },
      timestamp: new Date(this.timestamp).toISOString(),
      attachments: this.attachments.map(att => ({
        type: att.type,
        url: att.url,
        filename: att.filename || att.name
      })),
      mentions: Object.keys(this.mentions),
      thread: {
        id: this.threadID,
        name: this._thread?.name || 'Unknown',
        isGroup: this.isGroup
      }
    };
  }
}

module.exports = Message;
