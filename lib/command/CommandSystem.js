"use strict";

/**
 * Advanced Command System for Nexus-FCA
 * Supports command registration, validation, permissions, and execution
 */

const EventEmitter = require('events');
const { errorHandler } = require('../error/ErrorHandler');

class Command {
    constructor(name, options = {}) {
        this.name = name.toLowerCase();
        this.description = options.description || 'No description provided';
        this.usage = options.usage || `/${name}`;
        this.aliases = (options.aliases || []).map(alias => alias.toLowerCase());
        this.category = options.category || 'general';
        this.permissions = options.permissions || [];
        this.cooldown = options.cooldown || 0; // in milliseconds
        this.dmOnly = options.dmOnly || false;
        this.groupOnly = options.groupOnly || false;
        this.ownerOnly = options.ownerOnly || false;
        this.args = options.args || [];
        this.examples = options.examples || [];
        this.hidden = options.hidden || false;
        this.enabled = options.enabled !== false;
        this.handler = options.handler || null;
        
        // Validation
        this.validateArgs = options.validateArgs !== false;
        this.maxArgs = options.maxArgs || Infinity;
        this.minArgs = options.minArgs || 0;
        
        // Advanced features
        this.subcommands = new Map();
        this.middleware = [];
        this.autocomplete = options.autocomplete || null;
        
        // Statistics
        this.stats = {
            used: 0,
            lastUsed: null,
            errors: 0
        };
    }

    /**
     * Add a subcommand
     */
    addSubcommand(subcommand) {
        if (subcommand instanceof Command) {
            this.subcommands.set(subcommand.name, subcommand);
            subcommand.aliases.forEach(alias => {
                this.subcommands.set(alias, subcommand);
            });
        }
        return this;
    }

    /**
     * Add middleware
     */
    use(middleware) {
        this.middleware.push(middleware);
        return this;
    }

    /**
     * Set the command handler
     */
    setHandler(handler) {
        this.handler = handler;
        return this;
    }

    /**
     * Check if user has permission to use this command
     */
    hasPermission(userID, permissions = []) {
        if (this.ownerOnly && !permissions.includes('owner')) {
            return false;
        }
        
        if (this.permissions.length === 0) {
            return true;
        }
        
        return this.permissions.some(perm => permissions.includes(perm));
    }

    /**
     * Validate command arguments
     */
    validateArguments(args) {
        if (!this.validateArgs) return { valid: true };

        if (args.length < this.minArgs) {
            return {
                valid: false,
                error: `This command requires at least ${this.minArgs} argument(s). Usage: ${this.usage}`
            };
        }

        if (args.length > this.maxArgs) {
            return {
                valid: false,
                error: `This command accepts at most ${this.maxArgs} argument(s). Usage: ${this.usage}`
            };
        }

        // Validate specific argument types
        for (let i = 0; i < this.args.length && i < args.length; i++) {
            const argDef = this.args[i];
            const argValue = args[i];
            
            if (argDef.type) {
                const validation = this.validateArgumentType(argValue, argDef.type);
                if (!validation.valid) {
                    return {
                        valid: false,
                        error: `Argument ${i + 1} (${argDef.name || 'unnamed'}): ${validation.error}`
                    };
                }
            }
        }

        return { valid: true };
    }

    /**
     * Validate argument type
     */
    validateArgumentType(value, type) {
        switch (type) {
            case 'number':
                const num = Number(value);
                if (isNaN(num)) {
                    return { valid: false, error: 'must be a number' };
                }
                return { valid: true, value: num };
                
            case 'integer':
                const int = parseInt(value);
                if (isNaN(int) || int != value) {
                    return { valid: false, error: 'must be an integer' };
                }
                return { valid: true, value: int };
                
            case 'boolean':
                const bool = ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
                return { valid: true, value: bool };
                
            case 'url':
                try {
                    new URL(value);
                    return { valid: true, value };
                } catch {
                    return { valid: false, error: 'must be a valid URL' };
                }
                
            case 'userID':
                if (!/^\d+$/.test(value)) {
                    return { valid: false, error: 'must be a valid user ID' };
                }
                return { valid: true, value };
                
            default:
                return { valid: true, value };
        }
    }

    /**
     * Execute the command
     */
    async execute(context) {
        try {
            this.stats.used++;
            this.stats.lastUsed = Date.now();

            // Apply middleware
            for (const middleware of this.middleware) {
                const result = await middleware(context);
                if (result === false) {
                    return; // Middleware blocked execution
                }
            }

            // Handle subcommands
            if (context.args.length > 0 && this.subcommands.has(context.args[0])) {
                const subcommand = this.subcommands.get(context.args[0]);
                const subContext = {
                    ...context,
                    args: context.args.slice(1),
                    command: subcommand
                };
                return await subcommand.execute(subContext);
            }

            // Execute main handler
            if (this.handler) {
                return await this.handler(context);
            }
        } catch (error) {
            this.stats.errors++;
            throw error;
        }
    }

    /**
     * Get command help
     */
    getHelp() {
        let help = `**${this.name}**\n`;
        help += `${this.description}\n\n`;
        help += `**Usage:** ${this.usage}\n`;
        
        if (this.aliases.length > 0) {
            help += `**Aliases:** ${this.aliases.join(', ')}\n`;
        }
        
        if (this.examples.length > 0) {
            help += `**Examples:**\n${this.examples.map(ex => `• ${ex}`).join('\n')}\n`;
        }
        
        if (this.subcommands.size > 0) {
            help += `**Subcommands:**\n`;
            for (const [name, cmd] of this.subcommands) {
                if (name === cmd.name) { // Avoid duplicates from aliases
                    help += `• ${name} - ${cmd.description}\n`;
                }
            }
        }
        
        return help;
    }
}

class CommandRegistry extends EventEmitter {
    constructor(options = {}) {
        super();
        this.commands = new Map();
        this.categories = new Map();
        this.cooldowns = new Map();
        this.permissions = new Map();
        this.prefix = options.prefix || '/';
        this.owners = options.owners || [];
        this.caseSensitive = options.caseSensitive || false;
        
        // Built-in commands
        if (options.builtInCommands !== false) {
            this.registerBuiltInCommands();
        }
    }

    /**
     * Register a command
     */
    register(command) {
        if (!(command instanceof Command)) {
            throw new Error('Command must be an instance of Command class');
        }

        this.commands.set(command.name, command);
        
        // Register aliases
        command.aliases.forEach(alias => {
            this.commands.set(alias, command);
        });

        // Add to category
        if (!this.categories.has(command.category)) {
            this.categories.set(command.category, []);
        }
        if (!this.categories.get(command.category).includes(command)) {
            this.categories.get(command.category).push(command);
        }

        this.emit('commandRegistered', command);
        return this;
    }

    /**
     * Unregister a command
     */
    unregister(name) {
        const command = this.commands.get(name.toLowerCase());
        if (!command) return false;

        this.commands.delete(command.name);
        command.aliases.forEach(alias => {
            this.commands.delete(alias);
        });

        // Remove from category
        const category = this.categories.get(command.category);
        if (category) {
            const index = category.indexOf(command);
            if (index > -1) {
                category.splice(index, 1);
            }
        }

        this.emit('commandUnregistered', command);
        return true;
    }

    /**
     * Get a command by name or alias
     */
    get(name) {
        return this.commands.get(this.caseSensitive ? name : name.toLowerCase());
    }

    /**
     * Check if a command exists
     */
    has(name) {
        return this.commands.has(this.caseSensitive ? name : name.toLowerCase());
    }

    /**
     * Get all commands in a category
     */
    getCategory(category) {
        return this.categories.get(category) || [];
    }

    /**
     * Get all categories
     */
    getCategories() {
        return Array.from(this.categories.keys());
    }

    /**
     * Parse a message for commands
     */
    parseMessage(message) {
        const content = message.body || message.content || '';
        
        if (!content.startsWith(this.prefix)) {
            return null;
        }

        const args = content.slice(this.prefix.length).trim().split(/\s+/);
        const commandName = args.shift();
        
        if (!commandName) return null;

        const command = this.get(commandName);
        
        return {
            command,
            name: commandName,
            args,
            rawArgs: content.slice(this.prefix.length + commandName.length).trim(),
            prefix: this.prefix
        };
    }

    /**
     * Execute a command from a message
     */
    async execute(message, api) {
        try {
            const parsed = this.parseMessage(message);
            if (!parsed || !parsed.command) {
                return null;
            }

            const { command, args, rawArgs } = parsed;

            // Check if command is enabled
            if (!command.enabled) {
                throw new Error('This command is currently disabled');
            }

            // Check context restrictions
            if (command.dmOnly && message.isFromGroup) {
                throw new Error('This command can only be used in direct messages');
            }

            if (command.groupOnly && message.isFromUser) {
                throw new Error('This command can only be used in groups');
            }

            // Check permissions
            const userPermissions = await this.getUserPermissions(message.senderID, message.threadID, api);
            if (!command.hasPermission(message.senderID, userPermissions)) {
                throw new Error('You do not have permission to use this command');
            }

            // Check cooldown
            const cooldownKey = `${command.name}:${message.senderID}`;
            const now = Date.now();
            const cooldownEnd = this.cooldowns.get(cooldownKey) || 0;
            
            if (now < cooldownEnd) {
                const remaining = Math.ceil((cooldownEnd - now) / 1000);
                throw new Error(`Command is on cooldown. Please wait ${remaining} seconds`);
            }

            // Validate arguments
            const validation = command.validateArguments(args);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            // Set cooldown
            if (command.cooldown > 0) {
                this.cooldowns.set(cooldownKey, now + command.cooldown);
            }

            // Create execution context
            const context = {
                message,
                api,
                command,
                args,
                rawArgs,
                prefix: this.prefix,
                permissions: userPermissions,
                registry: this
            };

            // Execute command
            this.emit('commandExecute', context);
            const result = await command.execute(context);
            this.emit('commandExecuted', context, result);

            return result;
        } catch (error) {
            this.emit('commandError', error, message);
            throw errorHandler.handleError(error, 'CommandRegistry.execute');
        }
    }

    /**
     * Get user permissions
     */
    async getUserPermissions(userID, threadID, api) {
        const permissions = ['user'];
        
        // Check if user is owner
        if (this.owners.includes(userID)) {
            permissions.push('owner');
        }

        // Check if user is admin in group
        try {
            const threadInfo = await api.getThreadInfo(threadID);
            if (threadInfo.adminIDs && threadInfo.adminIDs.some(admin => admin.id === userID)) {
                permissions.push('admin');
            }
        } catch (error) {
            // Ignore error, user just won't have admin permission
        }

        return permissions;
    }

    /**
     * Register built-in commands
     */
    registerBuiltInCommands() {
        // Help command
        this.register(new Command('help', {
            description: 'Show help for commands',
            usage: '/help [command]',
            aliases: ['h', '?'],
            category: 'utility',
            handler: async (context) => {
                const { args, message, api } = context;
                
                if (args.length === 0) {
                    // Show all commands
                    let help = '**Available Commands:**\n\n';
                    
                    for (const category of this.getCategories()) {
                        const commands = this.getCategory(category)
                            .filter(cmd => !cmd.hidden && cmd.name === cmd.name) // Avoid aliases
                            .sort((a, b) => a.name.localeCompare(b.name));
                        
                        if (commands.length > 0) {
                            help += `**${category.toUpperCase()}**\n`;
                            for (const cmd of commands) {
                                help += `• ${this.prefix}${cmd.name} - ${cmd.description}\n`;
                            }
                            help += '\n';
                        }
                    }
                    
                    help += `Use \`${this.prefix}help <command>\` for detailed information.`;
                    
                    return api.sendMessage(help, message.threadID);
                } else {
                    // Show specific command help
                    const commandName = args[0];
                    const command = this.get(commandName);
                    
                    if (!command) {
                        return api.sendMessage(`Command "${commandName}" not found.`, message.threadID);
                    }
                    
                    if (command.hidden) {
                        return api.sendMessage(`Command "${commandName}" not found.`, message.threadID);
                    }
                    
                    return api.sendMessage(command.getHelp(), message.threadID);
                }
            }
        }));

        // Ping command
        this.register(new Command('ping', {
            description: 'Check bot response time',
            usage: '/ping',
            category: 'utility',
            handler: async (context) => {
                const start = Date.now();
                const response = await context.api.sendMessage('Pinging...', context.message.threadID);
                const latency = Date.now() - start;
                
                return context.api.editMessage(`Pong! Latency: ${latency}ms`, response.messageID);
            }
        }));

        // Stats command
        this.register(new Command('stats', {
            description: 'Show command usage statistics',
            usage: '/stats',
            category: 'utility',
            permissions: ['admin'],
            handler: async (context) => {
                let stats = '**Command Statistics:**\n\n';
                
                const commandStats = Array.from(this.commands.values())
                    .filter(cmd => cmd.name === cmd.name) // Avoid aliases
                    .sort((a, b) => b.stats.used - a.stats.used)
                    .slice(0, 10);
                
                for (const cmd of commandStats) {
                    const lastUsed = cmd.stats.lastUsed 
                        ? new Date(cmd.stats.lastUsed).toLocaleString()
                        : 'Never';
                    stats += `• **${cmd.name}**: ${cmd.stats.used} uses, ${cmd.stats.errors} errors\n`;
                    stats += `  Last used: ${lastUsed}\n\n`;
                }
                
                return context.api.sendMessage(stats, context.message.threadID);
            }
        }));
    }

    /**
     * Auto-complete command names
     */
    autocomplete(partial) {
        const matches = [];
        const lowerPartial = partial.toLowerCase();
        
        for (const [name, command] of this.commands) {
            if (name === command.name && name.startsWith(lowerPartial)) {
                matches.push(command);
            }
        }
        
        return matches.sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Get command statistics
     */
    getStats() {
        const stats = {
            totalCommands: 0,
            totalUses: 0,
            totalErrors: 0,
            categories: {},
            topCommands: []
        };
        
        const uniqueCommands = Array.from(this.commands.values())
            .filter(cmd => cmd.name === cmd.name); // Avoid duplicates from aliases
        
        stats.totalCommands = uniqueCommands.length;
        
        for (const command of uniqueCommands) {
            stats.totalUses += command.stats.used;
            stats.totalErrors += command.stats.errors;
            
            if (!stats.categories[command.category]) {
                stats.categories[command.category] = {
                    count: 0,
                    uses: 0,
                    errors: 0
                };
            }
            
            stats.categories[command.category].count++;
            stats.categories[command.category].uses += command.stats.used;
            stats.categories[command.category].errors += command.stats.errors;
        }
        
        stats.topCommands = uniqueCommands
            .sort((a, b) => b.stats.used - a.stats.used)
            .slice(0, 10)
            .map(cmd => ({
                name: cmd.name,
                uses: cmd.stats.used,
                errors: cmd.stats.errors
            }));
        
        return stats;
    }
}

module.exports = { Command, CommandRegistry };
