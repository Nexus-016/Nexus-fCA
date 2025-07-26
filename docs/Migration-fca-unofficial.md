# Migration from fca-unofficial

This guide will help you migrate your existing `fca-unofficial` code to `nexus-fca` with full backward compatibility.

## Why Migrate?

- ✅ **Full Backward Compatibility** - Your existing code works unchanged
- ⚡ **Enhanced Performance** - Smart caching and optimization
- 🛡️ **Better Error Handling** - Automatic retry and recovery
- 🌐 **MQTT Stability** - Reliable connection management
- 💾 **Persistent Storage** - Session and message history
- 📚 **TypeScript Support** - Full type definitions
- 🚀 **Modern API** - Discord.js-style client available

## Quick Migration

### Step 1: Install Nexus-FCA

```bash
npm uninstall fca-unofficial
npm install nexus-fca
```

### Step 2: Update Your Import

```js
// Before (fca-unofficial)
const login = require('fca-unofficial');

// After (nexus-fca) - Same syntax!
const login = require('nexus-fca');
```

### Step 3: Your Code Works Unchanged!

```js
// This exact code works in both packages
const login = require('nexus-fca'); // Only line you need to change

login({ appState }, (err, api) => {
    if (err) return console.error(err);
    
    // All your existing fca-unofficial code works
    api.getThreadHistory(threadID, 50, null, (err, history) => {
        if (err) return console.error(err);
        console.log(history);
    });
    
    api.sendMessage('Hello!', threadID, (err, msgInfo) => {
        if (err) return console.error(err);
        console.log('Message sent:', msgInfo.messageID);
    });
    
    api.listen((err, event) => {
        if (err) return console.error(err);
        api.sendMessage(event.body, event.threadID);
    });
});
```

## Method Compatibility

All `fca-unofficial` methods work exactly the same in `nexus-fca`:

| fca-unofficial Method | nexus-fca Support | Enhanced Features |
|----------------------|------------------|-------------------|
| `api.sendMessage()` | ✅ Full support | + Performance optimization |
| `api.getThreadHistory()` | ✅ Full support | + Smart caching |
| `api.getThreadList()` | ✅ Full support | + Enhanced data |
| `api.getThreadInfo()` | ✅ Full support | + Persistent storage |
| `api.getUserInfo()` | ✅ Full support | + Rich user objects |
| `api.listen()` | ✅ Full support | + Better error handling |
| `api.listenMqtt()` | ✅ Full support | + Auto-reconnection |
| `api.markAsRead()` | ✅ Full support | + Batch processing |
| `api.markAsDelivered()` | ✅ Full support | + Automatic marking |
| `api.setOptions()` | ✅ Full support | + Additional options |
| `api.changeThreadColor()` | ✅ Full support | + Color validation |
| `api.changeThreadEmoji()` | ✅ Full support | + Emoji validation |
| `api.addUserToGroup()` | ✅ Full support | + Permission checks |
| `api.removeUserFromGroup()` | ✅ Full support | + Enhanced feedback |
| All other methods... | ✅ Full support | + Various enhancements |

## Advanced Migration (Optional)

### Option 1: Enhanced Compatibility Layer

Use the compatibility layer for guaranteed compatibility:

```js
const login = require('nexus-fca');
const { CompatibilityLayer } = require('nexus-fca');

login({ appState }, (err, api) => {
    if (err) return console.error(err);
    
    // Create fca-unofficial compatible wrapper
    const compatibility = new CompatibilityLayer(api);
    const fcaApi = compatibility.createWrapper('fca-unofficial');
    
    // Use exactly like fca-unofficial with enhanced performance
    fcaApi.getThreadHistory(threadID, 50, null, (err, history) => {
        // Same callback signature, enhanced performance
    });
});
```

### Option 2: Modern Client API (Recommended)

Upgrade to the modern client for better development experience:

```js
const { NexusClient } = require('nexus-fca');

// Modern event-driven approach
const client = new NexusClient({
    prefix: '!',
    performanceOptimization: true
});

client.on('ready', (api, userID) => {
    console.log(`✅ Logged in as ${userID}`);
});

client.on('message', async (message) => {
    // Rich message objects with methods
    if (message.body === 'ping') {
        await message.reply('pong');
    }
});

await client.login({ appState });
```

## Configuration Migration

### fca-unofficial Options

```js
// Your existing fca-unofficial options
const options = {
    selfListen: false,
    listenEvents: false,
    updatePresence: true,
    autoMarkDelivery: true,
    autoMarkRead: false,
    logRecordSize: 100,
    online: true,
    emitReady: false
};

api.setOptions(options);
```

### Enhanced Options in nexus-fca

```js
// Same options work, plus new enhanced options
const options = {
    // Your existing options (all supported)
    selfListen: false,
    listenEvents: false,
    updatePresence: true,
    autoMarkDelivery: true,
    autoMarkRead: false,
    logRecordSize: 100,
    online: true,
    emitReady: false,
    
    // New enhanced options
    performanceOptimization: true,  // Enable smart caching
    rateLimitEnabled: true,         // Auto rate limiting
    autoReconnect: true,           // Auto MQTT reconnection
    errorRetryAttempts: 3,         // Auto retry failed operations
    cachingEnabled: true,          // Cache user/thread data
    persistentSessions: true       // Save login sessions
};

api.setOptions(options);
```

## Feature Comparison

### Basic Features (Same in Both)

| Feature | fca-unofficial | nexus-fca |
|---------|---------------|-----------|
| Send messages | ✅ | ✅ |
| Receive messages | ✅ | ✅ |
| Group management | ✅ | ✅ |
| Thread operations | ✅ | ✅ |
| User information | ✅ | ✅ |
| Reactions | ✅ | ✅ |
| Attachments | ✅ | ✅ |

### Enhanced Features (nexus-fca Only)

| Feature | fca-unofficial | nexus-fca |
|---------|---------------|-----------|
| Smart caching | ❌ | ✅ |
| Auto-reconnection | ❌ | ✅ |
| Error retry | ❌ | ✅ |
| Performance monitoring | ❌ | ✅ |
| TypeScript support | ❌ | ✅ |
| Persistent storage | ❌ | ✅ |
| Rich message objects | ❌ | ✅ |
| Modern client API | ❌ | ✅ |
| Command system | ❌ | ✅ |
| Middleware support | ❌ | ✅ |

## Common Migration Patterns

### Pattern 1: Simple Bot

**Before (fca-unofficial):**
```js
const login = require('fca-unofficial');

login({ appState }, (err, api) => {
    if (err) return console.error(err);
    
    api.listen((err, event) => {
        if (err) return console.error(err);
        
        if (event.body === 'ping') {
            api.sendMessage('pong', event.threadID);
        }
    });
});
```

**After (nexus-fca) - Same code:**
```js
const login = require('nexus-fca'); // Only this line changed

login({ appState }, (err, api) => {
    if (err) return console.error(err);
    
    api.listen((err, event) => {
        if (err) return console.error(err);
        
        if (event.body === 'ping') {
            api.sendMessage('pong', event.threadID);
        }
    });
});
```

### Pattern 2: Advanced Bot with Enhanced Features

**Upgraded version with enhancements:**
```js
const { NexusClient } = require('nexus-fca');

const client = new NexusClient({
    prefix: '!',
    performanceOptimization: true,
    cachingEnabled: true
});

client.on('ready', () => {
    console.log('✅ Bot ready with enhanced features!');
});

client.on('message', async (message) => {
    // Rich message object with methods
    if (message.body === 'ping') {
        await message.reply('🏓 Pong!');
    }
    
    if (message.body === 'info') {
        const thread = await message.getThread();
        await message.reply(`Thread: ${thread.name}, Participants: ${thread.participantCount}`);
    }
});

await client.login({ appState });
```

## Error Handling Migration

### fca-unofficial Error Handling

```js
api.listen((err, event) => {
    if (err) {
        console.error('Listen error:', err);
        return;
    }
    
    api.sendMessage('Hello', event.threadID, (err, msgInfo) => {
        if (err) {
            console.error('Send error:', err);
            return;
        }
        console.log('Message sent');
    });
});
```

### Enhanced Error Handling in nexus-fca

**Same callback style (backward compatible):**
```js
api.listen((err, event) => {
    if (err) {
        console.error('Listen error:', err);
        return;
    }
    
    api.sendMessage('Hello', event.threadID, (err, msgInfo) => {
        if (err) {
            console.error('Send error:', err);
            return;
        }
        console.log('Message sent');
    });
});
```

**Enhanced error handling (modern approach):**
```js
const { ErrorHandler } = require('nexus-fca');

const errorHandler = new ErrorHandler({
    retryOptions: { maxAttempts: 3 }
});

// Automatic retry on failure
const safeSendMessage = errorHandler.retry(async (message, threadID) => {
    return await api.sendMessage(message, threadID);
});

client.on('message', async (message) => {
    try {
        await safeSendMessage('Hello!', message.threadID);
    } catch (error) {
        console.error('Failed after retries:', error);
    }
});
```

## Performance Optimization

### Memory Usage

```js
// Enable smart caching to reduce Facebook API calls
const { PerformanceManager } = require('nexus-fca');

const perfManager = new PerformanceManager();

// Your existing code benefits automatically
api.getUserInfo(userID, (err, userInfo) => {
    // Cached automatically on subsequent calls
});
```

### Rate Limiting

```js
// Automatic rate limiting (no code changes needed)
const options = {
    rateLimitEnabled: true  // Prevents hitting Facebook limits
};

api.setOptions(options);

// Your existing rapid-fire messages are automatically throttled
for (let i = 0; i < 100; i++) {
    api.sendMessage(`Message ${i}`, threadID); // Auto-throttled
}
```

## Troubleshooting

### Issue 1: Login Problems

**Solution:** Same appState format works in both packages
```js
// Your existing appState.json works unchanged
const appState = require('./appstate.json');
login({ appState }, callback);
```

### Issue 2: Missing Methods

**Solution:** All fca-unofficial methods are supported
```js
// If you get "method not found" errors, use compatibility layer
const { CompatibilityLayer } = require('nexus-fca');
const compatibility = new CompatibilityLayer(api);
const compatibleApi = compatibility.createWrapper('fca-unofficial');
```

### Issue 3: Different Behavior

**Solution:** Enable strict compatibility mode
```js
const options = {
    strictCompatibility: true,  // Matches fca-unofficial behavior exactly
    performanceOptimization: false  // Disable enhancements if needed
};

api.setOptions(options);
```

## Migration Checklist

- [ ] Replace `require('fca-unofficial')` with `require('nexus-fca')`
- [ ] Test your existing bot functionality
- [ ] Enable performance optimizations (`performanceOptimization: true`)
- [ ] Enable caching (`cachingEnabled: true`)
- [ ] Consider upgrading to NexusClient for modern features
- [ ] Add error handling enhancements
- [ ] Enable TypeScript support if using TypeScript
- [ ] Update documentation and comments

## Complete Migration Example

**Before (fca-unofficial):**
```js
const login = require('fca-unofficial');

login({ appState: require('./appstate.json') }, (err, api) => {
    if (err) return console.error(err);
    
    api.setOptions({
        selfListen: false,
        listenEvents: false
    });
    
    console.log('Bot logged in successfully');
    
    api.listen((err, event) => {
        if (err) return console.error(err);
        
        if (event.type === 'message') {
            if (event.body === '!ping') {
                api.sendMessage('Pong!', event.threadID, (err) => {
                    if (err) console.error(err);
                });
            }
            
            if (event.body === '!info') {
                api.getThreadInfo(event.threadID, (err, info) => {
                    if (err) return console.error(err);
                    api.sendMessage(`Thread: ${info.threadName}`, event.threadID);
                });
            }
        }
    });
});
```

**After (nexus-fca) - Backward Compatible:**
```js
const login = require('nexus-fca'); // ONLY LINE CHANGED

login({ appState: require('./appstate.json') }, (err, api) => {
    if (err) return console.error(err);
    
    // Enable enhanced features
    api.setOptions({
        selfListen: false,
        listenEvents: false,
        performanceOptimization: true,  // NEW: Smart caching
        rateLimitEnabled: true,         // NEW: Auto rate limiting
        cachingEnabled: true            // NEW: Cache user/thread data
    });
    
    console.log('Bot logged in successfully with enhanced features');
    
    api.listen((err, event) => {
        if (err) return console.error(err);
        
        if (event.type === 'message') {
            if (event.body === '!ping') {
                api.sendMessage('Pong!', event.threadID, (err) => {
                    if (err) console.error(err);
                });
            }
            
            if (event.body === '!info') {
                // Cached automatically on subsequent calls
                api.getThreadInfo(event.threadID, (err, info) => {
                    if (err) return console.error(err);
                    api.sendMessage(`Thread: ${info.threadName}`, event.threadID);
                });
            }
        }
    });
});
```

**Upgraded Version (Optional):**
```js
const { NexusClient } = require('nexus-fca');

const client = new NexusClient({
    prefix: '!',
    performanceOptimization: true,
    cachingEnabled: true
});

client.on('ready', () => {
    console.log('✅ Bot ready with modern client!');
});

client.on('command', async ({ name, message }) => {
    if (name === 'ping') {
        await message.reply('🏓 Pong!');
    }
    
    if (name === 'info') {
        const thread = await message.getThread();
        await message.reply(`📊 Thread: ${thread.name || 'Private'}\n👥 Participants: ${thread.participantCount}`);
    }
});

await client.login({ appState: require('./appstate.json') });
```

Your migration to nexus-fca is complete! Your existing code continues to work while gaining enhanced performance, stability, and new features.
