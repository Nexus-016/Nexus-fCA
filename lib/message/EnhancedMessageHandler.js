"use strict";

/**
 * Enhanced Message Handler for Nexus-FCA
 * Supports rich media, reactions, mentions, and advanced formatting
 */

const EventEmitter = require('events');
const { errorHandler } = require('../error/ErrorHandler');

class EnhancedMessage extends EventEmitter {
    constructor(rawMessage, api) {
        super();
        this.api = api;
        this.raw = rawMessage;
        
        // Standard message properties
        this.id = rawMessage.messageID || rawMessage.mid || rawMessage.message_id;
        this.threadID = rawMessage.threadID || rawMessage.tid || rawMessage.thread_id;
        this.senderID = rawMessage.senderID || rawMessage.uid || rawMessage.user_id || rawMessage.from;
        this.body = rawMessage.body || rawMessage.message || rawMessage.text || '';
        this.timestamp = rawMessage.timestamp || rawMessage.time || Date.now();
        this.type = rawMessage.type || 'message';
        
        // Enhanced properties
        this.attachments = this.parseAttachments(rawMessage.attachments || []);
        this.mentions = this.parseMentions(rawMessage.mentions || []);
        this.reactions = rawMessage.reactions || [];
        this.isFromUser = rawMessage.isGroup === false;
        this.isFromGroup = rawMessage.isGroup === true;
        this.isEdited = rawMessage.isEdited || false;
        this.replyTo = rawMessage.messageReply || null;
        
        // Rich content
        this.stickers = this.parseStickers(rawMessage.stickers || []);
        this.links = this.parseLinks(this.body);
        this.emoji = this.parseEmoji(this.body);
        
        // Metadata
        this.metadata = {
            platform: 'facebook',
            client: 'nexus-fca',
            version: '1.0.0',
            processed: Date.now()
        };
        
        this.setupMessageMethods();
    }

    /**
     * Parse attachments with enhanced metadata
     */
    parseAttachments(attachments) {
        return attachments.map(attachment => ({
            type: attachment.type || 'unknown',
            url: attachment.url || attachment.preview_url || attachment.large_preview_url,
            filename: attachment.filename || attachment.name,
            size: attachment.size || 0,
            id: attachment.id || attachment.attachment_id,
            metadata: {
                width: attachment.width,
                height: attachment.height,
                duration: attachment.duration,
                thumbnail: attachment.thumbnail_url || attachment.preview_url
            },
            // Enhanced for different attachment types
            ...(attachment.type === 'photo' && {
                isAnimated: attachment.animated || false,
                originalUrl: attachment.large_preview_url || attachment.url
            }),
            ...(attachment.type === 'video' && {
                duration: attachment.duration,
                thumbnail: attachment.thumbnail_url
            }),
            ...(attachment.type === 'audio' && {
                duration: attachment.duration,
                waveform: attachment.waveform
            }),
            ...(attachment.type === 'file' && {
                mimeType: attachment.mime_type,
                downloadUrl: attachment.url
            })
        }));
    }

    /**
     * Parse mentions with user info
     */
    parseMentions(mentions) {
        return mentions.map(mention => ({
            id: mention.id || mention.uid,
            offset: mention.offset || 0,
            length: mention.length || 0,
            name: mention.name || '',
            tag: mention.tag || '@everyone'
        }));
    }

    /**
     * Parse stickers
     */
    parseStickers(stickers) {
        return stickers.map(sticker => ({
            id: sticker.id,
            pack: sticker.pack_id,
            url: sticker.url,
            sprite: sticker.sprite_image,
            width: sticker.width,
            height: sticker.height
        }));
    }

    /**
     * Parse links from message body
     */
    parseLinks(text) {
        const linkRegex = /(https?:\/\/[^\s]+)/g;
        const matches = text.match(linkRegex) || [];
        return matches.map(url => ({
            url,
            domain: new URL(url).hostname,
            preview: null // Can be populated later
        }));
    }

    /**
     * Parse emoji from message body
     */
    parseEmoji(text) {
        const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
        return text.match(emojiRegex) || [];
    }

    /**
     * Setup enhanced message methods
     */
    setupMessageMethods() {
        // Reply method
        this.reply = async (message, options = {}) => {
            try {
                const replyMessage = {
                    body: typeof message === 'string' ? message : message.body,
                    attachment: message.attachments || options.attachments,
                    mentions: message.mentions || options.mentions,
                    sticker: message.sticker || options.sticker,
                    replyToMessage: this.id
                };

                return await this.api.sendMessage(replyMessage, this.threadID);
            } catch (error) {
                throw errorHandler.handleError(error, 'EnhancedMessage.reply');
            }
        };

        // React method
        this.react = async (emoji) => {
            try {
                return await this.api.setMessageReaction(emoji, this.id);
            } catch (error) {
                throw errorHandler.handleError(error, 'EnhancedMessage.react');
            }
        };

        // Edit method (if supported)
        this.edit = async (newContent) => {
            try {
                return await this.api.editMessage(newContent, this.id);
            } catch (error) {
                throw errorHandler.handleError(error, 'EnhancedMessage.edit');
            }
        };

        // Delete method
        this.delete = async () => {
            try {
                return await this.api.deleteMessage(this.id);
            } catch (error) {
                throw errorHandler.handleError(error, 'EnhancedMessage.delete');
            }
        };

        // Forward method
        this.forward = async (targetThreadID) => {
            try {
                return await this.api.forwardAttachment(this.id, targetThreadID);
            } catch (error) {
                throw errorHandler.handleError(error, 'EnhancedMessage.forward');
            }
        };

        // Pin method
        this.pin = async () => {
            try {
                return await this.api.pinMessage(this.id);
            } catch (error) {
                throw errorHandler.handleError(error, 'EnhancedMessage.pin');
            }
        };
    }

    /**
     * Get sender information
     */
    async getSender() {
        try {
            return await this.api.getUserInfo(this.senderID);
        } catch (error) {
            throw errorHandler.handleError(error, 'EnhancedMessage.getSender');
        }
    }

    /**
     * Get thread information
     */
    async getThread() {
        try {
            return await this.api.getThreadInfo(this.threadID);
        } catch (error) {
            throw errorHandler.handleError(error, 'EnhancedMessage.getThread');
        }
    }

    /**
     * Check if message mentions a user
     */
    mentionsUser(userID) {
        return this.mentions.some(mention => mention.id === userID);
    }

    /**
     * Check if message contains specific content
     */
    contains(content, caseSensitive = false) {
        const text = caseSensitive ? this.body : this.body.toLowerCase();
        const search = caseSensitive ? content : content.toLowerCase();
        return text.includes(search);
    }

    /**
     * Check if message is a command
     */
    isCommand(prefix = '/') {
        return this.body.startsWith(prefix);
    }

    /**
     * Get command name and arguments
     */
    getCommand(prefix = '/') {
        if (!this.isCommand(prefix)) return null;
        
        const parts = this.body.slice(prefix.length).split(' ');
        return {
            name: parts[0].toLowerCase(),
            args: parts.slice(1),
            rawArgs: this.body.slice(prefix.length + parts[0].length).trim()
        };
    }

    /**
     * Convert to different formats
     */
    toJSON() {
        return {
            id: this.id,
            threadID: this.threadID,
            senderID: this.senderID,
            body: this.body,
            timestamp: this.timestamp,
            type: this.type,
            attachments: this.attachments,
            mentions: this.mentions,
            reactions: this.reactions,
            stickers: this.stickers,
            links: this.links,
            emoji: this.emoji,
            isFromUser: this.isFromUser,
            isFromGroup: this.isFromGroup,
            isEdited: this.isEdited,
            replyTo: this.replyTo,
            metadata: this.metadata
        };
    }

    toString() {
        return this.body;
    }
}

class MessageHandler extends EventEmitter {
    constructor(api) {
        super();
        this.api = api;
        this.filters = new Map();
        this.middleware = [];
        this.commandHandlers = new Map();
        this.setupEventHandlers();
    }

    /**
     * Setup event handlers for different message types
     */
    setupEventHandlers() {
        // Handle different event types
        this.on('message', this.handleMessage.bind(this));
        this.on('message_reaction', this.handleReaction.bind(this));
        this.on('message_unsend', this.handleUnsend.bind(this));
        this.on('message_reply', this.handleReply.bind(this));
        this.on('typ', this.handleTyping.bind(this));
        this.on('presence', this.handlePresence.bind(this));
    }

    /**
     * Process incoming message
     */
    async processMessage(rawMessage) {
        try {
            const enhancedMessage = new EnhancedMessage(rawMessage, this.api);
            
            // Apply middleware
            for (const middleware of this.middleware) {
                await middleware(enhancedMessage);
            }

            // Apply filters
            if (!this.passesFilters(enhancedMessage)) {
                return;
            }

            // Handle commands
            if (enhancedMessage.isCommand()) {
                await this.handleCommand(enhancedMessage);
            }

            // Emit enhanced message
            this.emit('enhancedMessage', enhancedMessage);
            this.emit(enhancedMessage.type, enhancedMessage);

            return enhancedMessage;
        } catch (error) {
            errorHandler.handleError(error, 'MessageHandler.processMessage');
        }
    }

    /**
     * Add message filter
     */
    addFilter(name, filterFunction) {
        this.filters.set(name, filterFunction);
    }

    /**
     * Remove message filter
     */
    removeFilter(name) {
        this.filters.delete(name);
    }

    /**
     * Check if message passes all filters
     */
    passesFilters(message) {
        for (const [name, filter] of this.filters) {
            try {
                if (!filter(message)) {
                    return false;
                }
            } catch (error) {
                console.warn(`Filter '${name}' error:`, error);
                return false;
            }
        }
        return true;
    }

    /**
     * Add middleware
     */
    use(middleware) {
        this.middleware.push(middleware);
    }

    /**
     * Register command handler
     */
    command(name, handler) {
        this.commandHandlers.set(name.toLowerCase(), handler);
    }

    /**
     * Handle command execution
     */
    async handleCommand(message) {
        const command = message.getCommand();
        if (!command) return;

        const handler = this.commandHandlers.get(command.name);
        if (handler) {
            try {
                await handler(message, command.args, command.rawArgs);
            } catch (error) {
                errorHandler.handleError(error, `Command.${command.name}`);
            }
        }
    }

    /**
     * Handle different message types
     */
    async handleMessage(message) {
        // Default message handling
    }

    async handleReaction(event) {
        // Handle message reactions
        this.emit('reaction', event);
    }

    async handleUnsend(event) {
        // Handle message unsend
        this.emit('unsend', event);
    }

    async handleReply(event) {
        // Handle message replies
        this.emit('reply', event);
    }

    async handleTyping(event) {
        // Handle typing indicators
        this.emit('typing', event);
    }

    async handlePresence(event) {
        // Handle presence updates
        this.emit('presence', event);
    }

    /**
     * Create message builder
     */
    createMessage() {
        return new MessageBuilder(this.api);
    }
}

class MessageBuilder {
    constructor(api) {
        this.api = api;
        this.message = {
            body: '',
            attachments: [],
            mentions: [],
            sticker: null,
            emoji: null
        };
    }

    text(content) {
        this.message.body = content;
        return this;
    }

    attachment(attachment) {
        if (Array.isArray(attachment)) {
            this.message.attachments.push(...attachment);
        } else {
            this.message.attachments.push(attachment);
        }
        return this;
    }

    mention(userID, name, offset = 0) {
        this.message.mentions.push({
            id: userID,
            name: name,
            offset: offset,
            length: name.length
        });
        return this;
    }

    sticker(stickerID) {
        this.message.sticker = stickerID;
        return this;
    }

    emoji(emojiCode) {
        this.message.emoji = emojiCode;
        return this;
    }

    async send(threadID) {
        try {
            return await this.api.sendMessage(this.message, threadID);
        } catch (error) {
            throw errorHandler.handleError(error, 'MessageBuilder.send');
        }
    }

    build() {
        return { ...this.message };
    }
}

module.exports = { 
    EnhancedMessage, 
    MessageHandler, 
    MessageBuilder 
};
