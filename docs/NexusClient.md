# NexusClient Documentation

The `NexusClient` is a modern, event-driven client that provides a Discord.js-style API for easier bot development with Nexus-FCA.

## Features

- 🎯 **Event-driven architecture** - Easy to handle different message types
- 🚀 **Command system** - Built-in command parsing and handling
- 🔧 **Middleware support** - Extensible with custom middleware
- ⚡ **Performance optimized** - Built-in caching and rate limiting
- 🛡️ **Error handling** - Robust error handling with automatic retry
- 🔗 **TypeScript ready** - Full TypeScript support with type definitions

## Basic Usage

```js
const { NexusClient } = require('nexus-fca');

const client = new NexusClient({
    prefix: '!',                    // Command prefix
    selfListen: false,              // Listen to own messages
    rateLimitEnabled: true,         // Enable rate limiting
    performanceOptimization: true,  // Enable performance features
    cachingEnabled: true,           // Enable smart caching
    logLevel: 'info'                // Logging level
});

// Login
await client.login({ appState: require('./appstate.json') });
```

## Configuration Options

```js
const options = {
    // Command System
    prefix: '!',                     // Command prefix (string or array)
    selfListen: false,               // Listen to own messages
    listenEvents: true,              // Listen to Facebook events
    
    // Performance
    rateLimitEnabled: true,          // Enable rate limiting
    performanceOptimization: true,   // Enable performance features
    cachingEnabled: true,            // Enable smart caching
    
    // Connection
    autoMarkDelivery: true,          // Auto mark messages as delivered
    autoMarkRead: false,             // Auto mark messages as read
    updatePresence: true,            // Update online presence
    
    // Advanced
    retryAttempts: 3,                // Retry attempts for failed operations
    circuitBreakerThreshold: 5,      // Circuit breaker failure threshold
    heartbeatInterval: 30000,        // MQTT heartbeat interval (ms)
    middlewareEnabled: true,         // Enable middleware system
    
    // Database
    databasePath: './nexus.db',      // Database file path
    
    // Logging
    logLevel: 'info'                 // 'silent', 'error', 'warn', 'info', 'verbose'
};
```

## Events

### Core Events

```js
// Login successful
client.on('ready', (api, userID) => {
    console.log(`✅ Logged in as ${userID}`);
});

// New message received
client.on('message', async (message) => {
    console.log(`📨 ${message.author.name}: ${message.body}`);
    
    if (message.body === 'ping') {
        await message.reply('🏓 Pong!');
    }
});

// Command detected
client.on('command', async ({ name, args, message }) => {
    console.log(`🎯 Command: ${name} with args:`, args);
    
    if (name === 'help') {
        await message.reply('Available commands: help, ping, userinfo');
    }
});

// Error occurred
client.on('error', (error) => {
    console.error('❌ Error:', error);
});
```

### Connection Events

```js
// MQTT reconnected
client.on('reconnect', () => {
    console.log('🔄 MQTT reconnected');
});

// Disconnected
client.on('disconnect', () => {
    console.log('⚠️ Disconnected from Facebook');
});
```

### User Events

```js
// User came online
client.on('userOnline', (user) => {
    console.log(`🟢 ${user.name} is now online`);
});

// User went offline
client.on('userOffline', (user) => {
    console.log(`🔴 ${user.name} is now offline`);
});
```

### Message Events

```js
// Message reaction added
client.on('messageReaction', (reaction, message) => {
    console.log(`${reaction.emoji} reaction on message: ${message.body}`);
});

// Message edited
client.on('messageEdit', (oldMessage, newMessage) => {
    console.log(`Message edited: "${oldMessage.body}" → "${newMessage.body}"`);
});

// Message unsent
client.on('messageUnsend', (message) => {
    console.log(`Message unsent: ${message.body}`);
});
```

### Typing Events

```js
// User started typing
client.on('typingStart', (user, thread) => {
    console.log(`⌨️ ${user.name} is typing in ${thread.name || 'private chat'}`);
});

// User stopped typing
client.on('typingStop', (user, thread) => {
    console.log(`✋ ${user.name} stopped typing`);
});
```

## Command System

### Basic Commands

```js
client.on('command', async ({ name, args, message }) => {
    switch (name) {
        case 'ping':
            await message.reply('🏓 Pong!');
            break;
            
        case 'echo':
            await message.reply(args.join(' ') || 'Nothing to echo!');
            break;
            
        case 'userinfo':
            const user = await message.getAuthor();
            await message.reply(`👤 **${user.name}**\n🆔 ID: ${user.id}\n👥 Friend: ${user.isFriend ? 'Yes' : 'No'}`);
            break;
            
        case 'threadinfo':
            const thread = await message.getThread();
            await message.reply(`📊 **${thread.name || 'Private Chat'}**\n👥 Participants: ${thread.participantCount}\n📁 Type: ${thread.threadType}`);
            break;
    }
});
```

### Advanced Command Handling

```js
// Load commands from directory
client.loadCommands('./commands');

// Register individual command
client.registerCommand('weather', async (args, message, api) => {
    const location = args.join(' ');
    if (!location) {
        return await message.reply('❌ Please provide a location!');
    }
    
    // Fetch weather data...
    await message.reply(`🌤️ Weather for ${location}: Sunny, 25°C`);
});

// Unregister command
client.unregisterCommand('weather');
```

### Command File Structure

Create command files in your commands directory:

**commands/ping.js**
```js
module.exports = {
    name: 'ping',
    description: 'Check bot responsiveness',
    usage: '!ping',
    async execute(args, message, api) {
        const start = Date.now();
        const reply = await message.reply('🏓 Pinging...');
        const latency = Date.now() - start;
        
        await reply.edit(`🏓 Pong!\n⏱️ Latency: ${latency}ms`);
    }
};
```

## Middleware System

```js
// Add middleware for message processing
client.use((message, next) => {
    // Log all messages
    console.log(`📝 ${message.author.name}: ${message.body}`);
    
    // Add custom properties
    message.timestamp = Date.now();
    message.customData = { processed: true };
    
    // Continue to next middleware
    next();
});

// Add authentication middleware
client.use((message, next) => {
    // Check if user is admin
    const adminUsers = ['123456789', '987654321'];
    message.isAdmin = adminUsers.includes(message.author.id);
    
    next();
});

// Use in command handler
client.on('command', async ({ name, args, message }) => {
    if (name === 'admin' && !message.isAdmin) {
        return await message.reply('❌ Admin only command!');
    }
    
    // Handle admin command...
});
```

## Performance Features

```js
// Get performance metrics
const metrics = client.getMetrics();
console.log(`📊 Performance:
📈 Requests: ${metrics.requestCount}
⏱️ Avg Response: ${metrics.averageResponseTime}ms
💾 Cache Hit Rate: ${metrics.cacheHitRate}%
🧠 Memory Usage: ${metrics.memoryUsage}%`);

// Clear cache manually
client.clearCache();

// Optimize performance
client.optimizePerformance();
```

## Error Handling

```js
// Handle specific errors
client.on('error', (error) => {
    if (error.code === 'RATE_LIMITED') {
        console.log('⏳ Rate limited, slowing down...');
    } else if (error.code === 'CONNECTION_LOST') {
        console.log('🔄 Connection lost, attempting reconnect...');
    } else {
        console.error('❌ Unexpected error:', error);
    }
});

// Set custom error handlers
client.setErrorHandler('sendMessage', (error) => {
    console.log('💬 Failed to send message, using fallback...');
    return { success: false, fallback: true };
});
```

## Rich Message Objects

Messages received through the client have enhanced properties and methods:

```js
client.on('message', async (message) => {
    // Message properties
    console.log('Message ID:', message.id);
    console.log('Content:', message.body);
    console.log('Author:', message.author.name);
    console.log('Thread:', message.thread.name);
    console.log('Attachments:', message.attachments.length);
    console.log('Type:', message.type);
    
    // Message methods
    if (message.body === 'react') {
        await message.react('❤️');
    }
    
    if (message.body === 'edit test') {
        const sent = await message.reply('Original message');
        setTimeout(() => {
            sent.edit('Edited message');
        }, 2000);
    }
    
    if (message.body === 'forward') {
        await message.forward('target_thread_id');
    }
    
    if (message.body === 'pin') {
        await message.pin();
    }
});
```

## TypeScript Usage

```typescript
import { NexusClient, NexusMessage, NexusClientOptions } from 'nexus-fca';

const options: NexusClientOptions = {
    prefix: '!',
    rateLimitEnabled: true,
    logLevel: 'info'
};

const client = new NexusClient(options);

client.on('message', async (message: NexusMessage) => {
    if (message.body === 'ping') {
        await message.reply('Pong!');
    }
});

await client.login({ appState: appStateData });
```

## Best Practices

1. **Use event handlers** - Prefer event-driven code over callbacks
2. **Enable caching** - Improves performance for repeated operations
3. **Handle errors gracefully** - Always listen for error events
4. **Use rate limiting** - Prevent hitting Facebook's limits
5. **Structure commands** - Use the command system for organized bot code
6. **Monitor performance** - Check metrics regularly in production
7. **Use TypeScript** - Take advantage of type safety and IntelliSense

## Examples

### Simple Echo Bot
```js
const { NexusClient } = require('nexus-fca');

const client = new NexusClient({ prefix: '!' });

client.on('ready', () => {
    console.log('✅ Echo bot ready!');
});

client.on('message', async (message) => {
    if (message.body.startsWith('echo ')) {
        const text = message.body.slice(5);
        await message.reply(text);
    }
});

await client.login({ appState: require('./appstate.json') });
```

### Advanced Bot with Commands
```js
const { NexusClient } = require('nexus-fca');

const client = new NexusClient({
    prefix: '!',
    rateLimitEnabled: true,
    cachingEnabled: true
});

// Load commands from directory
client.loadCommands('./commands');

// Middleware for logging
client.use((message, next) => {
    console.log(`📝 ${message.author.name} in ${message.thread.name || 'DM'}: ${message.body}`);
    next();
});

// Handle ready event
client.on('ready', (api, userID) => {
    console.log(`🚀 Advanced bot ready! Logged in as ${userID}`);
});

// Handle commands
client.on('command', async ({ name, args, message }) => {
    console.log(`🎯 Command "${name}" executed by ${message.author.name}`);
});

// Handle errors
client.on('error', (error) => {
    console.error('❌ Bot error:', error.message);
});

await client.login({ appState: require('./appstate.json') });
```
