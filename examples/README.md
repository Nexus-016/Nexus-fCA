# Nexus-FCA Examples

This directory contains comprehensive examples demonstrating the features and capabilities of Nexus-FCA.

## Examples Overview

### 1. Basic Bot (`basic-bot.js`)
A simple bot example using the traditional FCA API approach.

**Features:**
- Basic login and message listening
- Simple command responses
- Echo functionality

**Usage:**
```bash
node examples/basic-bot.js
```

### 2. Advanced Bot (`advanced-bot.js`)
A sophisticated bot using the modern NexusClient with command system.

**Features:**
- Event-driven architecture
- Command system with permissions
- Rich message handling
- Error handling and logging
- Performance monitoring

**Commands:**
- `!help` - Show command help
- `!userinfo [user_id]` - Get user information
- `!weather <city>` - Get weather (demo)
- `!thread <action>` - Thread management
- `!roll [sides]` - Roll dice
- `!kick <user_id>` - Remove user (admin only)
- `!system <action>` - System commands (owner only)

**Usage:**
```bash
node examples/advanced-bot.js
```

### 3. Rich Messages (`rich-messages.js`)
Demonstrates advanced message features and formatting.

**Features:**
- Rich text formatting
- Photo and file attachments
- User mentions
- Message replies
- Stickers and reactions
- Message builder pattern
- Polls and interactive content

**Commands:**
- `/rich` - Show rich message features
- `/photo` - Send photo message
- `/mention` - Mention users
- `/reply` - Reply to messages
- `/sticker` - Send stickers
- `/attachment` - Send file attachments
- `/builder` - Use message builder
- `/poll` - Create interactive polls

**Usage:**
```bash
node examples/rich-messages.js
```

### 4. Performance Monitoring (`performance-monitoring.js`)
Shows how to monitor and optimize bot performance.

**Features:**
- Real-time performance metrics
- Memory usage monitoring
- Cache efficiency tracking
- API call optimization
- Stress testing
- Performance reporting

**Commands:**
- `/perf` - Performance report
- `/cache` - Cache status
- `/memory` - Memory details
- `/stress` - Run stress test
- `/optimize` - Run optimization
- `/metrics` - Detailed metrics

**Usage:**
```bash
node examples/performance-monitoring.js
```

## Setup Instructions

### Prerequisites
1. Node.js 14+ installed
2. Valid Facebook account credentials or appstate
3. Nexus-FCA package installed

### Configuration

1. **Update login credentials** in each example:
   ```javascript
   // Option 1: Email/Password
   const api = await login({
       email: "your-email@example.com",
       password: "your-password"
   });

   // Option 2: AppState (recommended)
   const api = await login({
       appstate: JSON.parse(fs.readFileSync('appstate.json', 'utf8'))
   });
   ```

2. **Set owner IDs** for advanced features:
   ```javascript
   const client = new NexusClient({
       owners: ['your-user-id-here']
   });
   ```

3. **Create appstate.json** (if using appstate method):
   ```bash
   # Run any example first with email/password to generate appstate
   # The appstate will be saved automatically
   ```

### Running Examples

```bash
# Install dependencies
npm install

# Run basic bot
node examples/basic-bot.js

# Run advanced bot
node examples/advanced-bot.js

# Run rich messages demo
node examples/rich-messages.js

# Run performance monitoring
node examples/performance-monitoring.js
```

## Integration Tips

### Using Multiple Features Together

```javascript
const { NexusClient } = require('../lib/client/NexusClient');
const { PerformanceOptimizer } = require('../lib/performance/PerformanceOptimizer');
const { MessageBuilder } = require('../lib/message/EnhancedMessageHandler');

// Combine multiple features
const client = new NexusClient({
    prefix: '!',
    performance: true,
    database: true,
    mqtt: true
});

client.on('enhancedMessage', async (message) => {
    if (message.isCommand()) {
        const command = message.getCommand();
        // Handle commands with rich responses
        const response = new MessageBuilder(client.api)
            .text(`Command: ${command.name}`)
            .mention(message.senderID, 'You');
        
        await response.send(message.threadID);
    }
});
```

### Error Handling Best Practices

```javascript
// Wrap critical operations
try {
    await api.sendMessage(message, threadID);
} catch (error) {
    console.error('Send message failed:', error);
    // Implement fallback or retry logic
}

// Use error events
client.on('error', (error) => {
    console.error('Client error:', error);
    // Log error, notify admins, etc.
});
```

### Performance Optimization

```javascript
// Enable performance monitoring
const perfOptimizer = new PerformanceOptimizer({
    enableMetrics: true,
    cacheSize: 1000,
    memoryThreshold: 100 * 1024 * 1024
});

// Monitor API calls
api.sendMessage = perfOptimizer.wrapFunction(api.sendMessage, 'sendMessage');

// Regular optimization
setInterval(() => {
    perfOptimizer.optimize();
}, 300000); // Every 5 minutes
```

## Common Patterns

### Command Handler Pattern
```javascript
const commands = {
    async ping(context) {
        await context.api.sendMessage('Pong!', context.message.threadID);
    },
    
    async echo(context) {
        const text = context.args.join(' ');
        await context.api.sendMessage(text, context.message.threadID);
    }
};

// Register commands
for (const [name, handler] of Object.entries(commands)) {
    client.commands.register(new Command(name, { handler }));
}
```

### Middleware Pattern
```javascript
// Add global middleware
client.messageHandler.use(async (message) => {
    // Log all messages
    console.log(`Message from ${message.senderID}: ${message.body}`);
    
    // Anti-spam check
    if (isSpam(message)) {
        return false; // Block message processing
    }
    
    return true; // Continue processing
});
```

### Event-Driven Pattern
```javascript
// Set up event listeners
client.on('userJoin', async (event) => {
    const welcomeMessage = new MessageBuilder(client.api)
        .text('Welcome to the group!')
        .mention(event.userID, 'New Member');
    
    await welcomeMessage.send(event.threadID);
});

client.on('messageReaction', async (event) => {
    if (event.reaction === '❤️') {
        await client.api.sendMessage('Thanks for the love!', event.threadID);
    }
});
```

## Troubleshooting

### Common Issues

1. **Login Failed**
   - Check credentials
   - Use 2FA app passwords
   - Try appstate method
   - Check for account restrictions

2. **High Memory Usage**
   - Enable performance monitoring
   - Use cache optimization
   - Implement garbage collection
   - Monitor for memory leaks

3. **MQTT Connection Issues**
   - Check network connectivity
   - Enable auto-reconnection
   - Monitor connection metrics
   - Use fallback listening methods

4. **Rate Limiting**
   - Implement request queuing
   - Add delays between requests
   - Monitor API usage
   - Use caching for repeated data

### Debug Mode

Enable debug logging for troubleshooting:

```javascript
// Set debug environment
process.env.DEBUG = 'nexus-fca:*';

// Enable verbose logging
const client = new NexusClient({
    logLevel: 'debug',
    enableMetrics: true
});
```

## Contributing

Feel free to submit additional examples or improvements to existing ones:

1. Fork the repository
2. Create your example in the `examples/` directory
3. Add documentation to this README
4. Submit a pull request

## Support

If you need help with the examples:

1. Check the main documentation in `ENHANCED_DOCS.md`
2. Review the TypeScript definitions in `index.d.ts`
3. Look at the source code in `lib/` directory
4. Create an issue on GitHub

Happy coding with Nexus-FCA! 🚀
