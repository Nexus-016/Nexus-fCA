const login = require('../index');
const { NexusClient } = require('../lib/client/NexusClient');
const { Command, CommandRegistry } = require('../lib/command/CommandSystem');
const fs = require('fs');

// Advanced bot example using the modern NexusClient
async function advancedBot() {
    try {
        // Create client instance
        const client = new NexusClient({
            prefix: '!',
            owners: ['your-user-id-here'],
            autoReconnect: true,
            commandTimeout: 30000
        });

        // Register custom commands
        registerCommands(client);

        // Set up event listeners
        setupEventListeners(client);

        // Login with credentials or appstate
        await client.login({
            email: "your-email@example.com",
            password: "your-password"
            // OR use appstate: JSON.parse(fs.readFileSync('appstate.json', 'utf8'))
        });

        console.log('Advanced bot is ready!');

    } catch (error) {
        console.error('Bot startup failed:', error);
    }
}

function registerCommands(client) {
    // Weather command
    client.commands.register(new Command('weather', {
        description: 'Get weather information for a city',
        usage: '!weather <city>',
        aliases: ['w'],
        category: 'utility',
        minArgs: 1,
        args: [
            { name: 'city', type: 'string', description: 'City name' }
        ],
        examples: ['!weather New York', '!weather London'],
        handler: async (context) => {
            const city = context.args.join(' ');
            // In a real implementation, you'd call a weather API
            const response = `Weather for ${city}: Sunny, 25°C\n(This is a demo response)`;
            await context.api.sendMessage(response, context.message.threadID);
        }
    }));

    // User info command
    client.commands.register(new Command('userinfo', {
        description: 'Get information about a user',
        usage: '!userinfo [user_id]',
        aliases: ['ui', 'user'],
        category: 'info',
        handler: async (context) => {
            const userID = context.args[0] || context.message.senderID;
            
            try {
                const userInfo = await context.api.getUserInfo(userID);
                const user = userInfo[userID];
                
                if (!user) {
                    return context.api.sendMessage('User not found!', context.message.threadID);
                }

                const info = `👤 **User Information**\n\n` +
                    `**Name:** ${user.name}\n` +
                    `**ID:** ${userID}\n` +
                    `**Profile URL:** ${user.profileUrl}\n` +
                    `**Gender:** ${user.gender}\n` +
                    `**Is Friend:** ${user.isFriend ? 'Yes' : 'No'}`;

                await context.api.sendMessage(info, context.message.threadID);
            } catch (error) {
                await context.api.sendMessage('Failed to get user information.', context.message.threadID);
            }
        }
    }));

    // Thread management command
    client.commands.register(new Command('thread', {
        description: 'Thread management commands',
        usage: '!thread <action> [arguments]',
        category: 'admin',
        permissions: ['admin'],
        handler: async (context) => {
            if (context.args.length === 0) {
                return context.api.sendMessage(
                    'Thread commands:\n' +
                    '• !thread info - Get thread information\n' +
                    '• !thread name <new_name> - Change thread name\n' +
                    '• !thread color <color> - Change thread color\n' +
                    '• !thread emoji <emoji> - Change thread emoji',
                    context.message.threadID
                );
            }

            const action = context.args[0].toLowerCase();
            const threadID = context.message.threadID;

            switch (action) {
                case 'info':
                    try {
                        const threadInfo = await context.api.getThreadInfo(threadID);
                        const info = `📋 **Thread Information**\n\n` +
                            `**Name:** ${threadInfo.threadName}\n` +
                            `**ID:** ${threadID}\n` +
                            `**Members:** ${threadInfo.participantIDs.length}\n` +
                            `**Admins:** ${threadInfo.adminIDs.length}\n` +
                            `**Color:** ${threadInfo.color}\n` +
                            `**Emoji:** ${threadInfo.emoji}`;

                        await context.api.sendMessage(info, threadID);
                    } catch (error) {
                        await context.api.sendMessage('Failed to get thread information.', threadID);
                    }
                    break;

                case 'name':
                    if (context.args.length < 2) {
                        return context.api.sendMessage('Please provide a new name!', threadID);
                    }
                    const newName = context.args.slice(1).join(' ');
                    try {
                        await context.api.setTitle(newName, threadID);
                        await context.api.sendMessage(`Thread name changed to: ${newName}`, threadID);
                    } catch (error) {
                        await context.api.sendMessage('Failed to change thread name.', threadID);
                    }
                    break;

                case 'color':
                    if (context.args.length < 2) {
                        return context.api.sendMessage('Please provide a color!', threadID);
                    }
                    const color = context.args[1];
                    try {
                        await context.api.changeThreadColor(color, threadID);
                        await context.api.sendMessage(`Thread color changed to: ${color}`, threadID);
                    } catch (error) {
                        await context.api.sendMessage('Failed to change thread color.', threadID);
                    }
                    break;

                case 'emoji':
                    if (context.args.length < 2) {
                        return context.api.sendMessage('Please provide an emoji!', threadID);
                    }
                    const emoji = context.args[1];
                    try {
                        await context.api.changeThreadEmoji(emoji, threadID);
                        await context.api.sendMessage(`Thread emoji changed to: ${emoji}`, threadID);
                    } catch (error) {
                        await context.api.sendMessage('Failed to change thread emoji.', threadID);
                    }
                    break;

                default:
                    await context.api.sendMessage('Unknown thread action!', threadID);
            }
        }
    }));

    // Fun command with reactions
    client.commands.register(new Command('roll', {
        description: 'Roll a dice',
        usage: '!roll [sides]',
        aliases: ['dice'],
        category: 'fun',
        handler: async (context) => {
            const sides = parseInt(context.args[0]) || 6;
            if (sides < 2 || sides > 100) {
                return context.api.sendMessage('Dice must have between 2 and 100 sides!', context.message.threadID);
            }

            const result = Math.floor(Math.random() * sides) + 1;
            const message = await context.api.sendMessage(
                `🎲 Rolling a ${sides}-sided dice...\n\nResult: **${result}**`,
                context.message.threadID
            );

            // Add reaction based on result
            if (result === sides) {
                await context.api.setMessageReaction('🎉', message.messageID);
            } else if (result === 1) {
                await context.api.setMessageReaction('😢', message.messageID);
            } else {
                await context.api.setMessageReaction('👍', message.messageID);
            }
        }
    }));

    // Moderation command
    client.commands.register(new Command('kick', {
        description: 'Remove a user from the group',
        usage: '!kick <user_id>',
        category: 'moderation',
        permissions: ['admin'],
        groupOnly: true,
        minArgs: 1,
        args: [
            { name: 'user_id', type: 'userID', description: 'ID of user to kick' }
        ],
        handler: async (context) => {
            const userID = context.args[0];
            const threadID = context.message.threadID;

            try {
                // Get user info for confirmation
                const userInfo = await context.api.getUserInfo(userID);
                const user = userInfo[userID];

                if (!user) {
                    return context.api.sendMessage('User not found!', threadID);
                }

                // Remove user from group
                await context.api.removeUserFromGroup(userID, threadID);
                await context.api.sendMessage(`${user.name} has been removed from the group.`, threadID);
            } catch (error) {
                await context.api.sendMessage('Failed to remove user from group.', threadID);
            }
        }
    }));

    // System command for owners
    client.commands.register(new Command('system', {
        description: 'System management commands',
        usage: '!system <action>',
        category: 'system',
        ownerOnly: true,
        hidden: true,
        handler: async (context) => {
            const action = context.args[0];

            switch (action) {
                case 'restart':
                    await context.api.sendMessage('Restarting bot...', context.message.threadID);
                    process.exit(0);
                    break;

                case 'status':
                    const uptime = process.uptime();
                    const memory = process.memoryUsage();
                    const stats = `📊 **System Status**\n\n` +
                        `**Uptime:** ${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s\n` +
                        `**Memory Usage:** ${Math.round(memory.heapUsed / 1024 / 1024)}MB\n` +
                        `**Commands:** ${client.commands.commands.size}\n` +
                        `**Performance:** ${client.performance ? 'Enabled' : 'Disabled'}`;

                    await context.api.sendMessage(stats, context.message.threadID);
                    break;

                case 'eval':
                    if (context.args.length < 2) {
                        return context.api.sendMessage('Please provide code to evaluate!', context.message.threadID);
                    }
                    try {
                        const code = context.args.slice(1).join(' ');
                        const result = eval(code);
                        await context.api.sendMessage(`Result: ${result}`, context.message.threadID);
                    } catch (error) {
                        await context.api.sendMessage(`Error: ${error.message}`, context.message.threadID);
                    }
                    break;

                default:
                    await context.api.sendMessage('Unknown system action!', context.message.threadID);
            }
        }
    }));
}

function setupEventListeners(client) {
    // Handle enhanced messages
    client.on('enhancedMessage', (message) => {
        console.log(`📨 Message from ${message.senderID}: ${message.body}`);
        
        // Auto-react to messages with hearts
        if (message.body.includes('❤️') || message.body.includes('love')) {
            message.react('❤️');
        }
    });

    // Handle command errors
    client.on('commandError', (error, message) => {
        console.error('Command error:', error);
        if (message && message.threadID) {
            client.api.sendMessage(`❌ Error: ${error.message}`, message.threadID);
        }
    });

    // Handle MQTT events
    client.on('mqttConnected', () => {
        console.log('🔌 MQTT connected');
    });

    client.on('mqttDisconnected', () => {
        console.log('🔌 MQTT disconnected');
    });

    // Handle user events
    client.on('userTyping', (event) => {
        console.log(`⌨️ ${event.from} is typing in ${event.threadID}`);
    });

    client.on('userPresence', (event) => {
        console.log(`👤 ${event.userID} is ${event.statuses} (${event.timestamp})`);
    });

    // Handle group events
    client.on('groupJoin', (event) => {
        console.log(`👋 User ${event.addedParticipants[0]} joined ${event.threadID}`);
        client.api.sendMessage(`Welcome to the group! 👋`, event.threadID);
    });

    client.on('groupLeave', (event) => {
        console.log(`👋 User ${event.leftParticipantFbId} left ${event.threadID}`);
    });

    // Handle errors
    client.on('error', (error) => {
        console.error('Client error:', error);
    });

    // Ready event
    client.on('ready', () => {
        console.log('🚀 Bot is ready and listening for messages!');
        
        // Optional: Send startup message to a specific thread
        // client.api.sendMessage('Bot is online! 🤖', 'your-thread-id');
    });
}

// Run the bot
if (require.main === module) {
    advancedBot();
}

module.exports = advancedBot;
