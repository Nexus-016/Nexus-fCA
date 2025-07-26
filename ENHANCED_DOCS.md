# Nexus-FCA: Enhanced Documentation

## 🚀 What's New in Enhanced Version

### Performance Optimizations
- **Smart Caching System**: Automatic caching of user info, thread info, and API responses
- **Request Optimization**: Intelligent batching and rate limiting
- **Memory Management**: Automatic garbage collection and memory monitoring
- **Response Time Tracking**: Real-time performance metrics

### Enhanced TypeScript Support
```typescript
import { NexusClient, NexusMessage } from 'nexus-fca';

const client = new NexusClient({
  prefix: '!',
  selfListen: false,
  rateLimitEnabled: true
});

client.on('message', (message: NexusMessage) => {
  message.reply('Hello!');
});
```

### Advanced MQTT Connection
- **Auto-Reconnection**: Exponential backoff with smart retry logic
- **Connection Stability**: Enhanced error handling and recovery
- **Real-time Metrics**: Connection quality monitoring
- **Graceful Disconnection**: Proper cleanup on shutdown

### Database & Caching System
```javascript
// Auto-cached user info
const userInfo = await api.getUserInfo(userID); // Cached for 1 hour

// Auto-cached thread info  
const threadInfo = await api.getThreadInfo(threadID); // Cached for 30 minutes

// Custom caching
await dbManager.setCache('my_key', data, 3600); // 1 hour TTL
const cachedData = await dbManager.getCache('my_key');
```

### Enhanced Error Handling
```javascript
const { NexusError, ValidationError } = require('nexus-fca');

try {
  await api.sendMessage('Hello', threadID);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Invalid input:', error.message);
  } else if (error.code === 'RATE_LIMITED') {
    console.log('Rate limited, retrying after:', error.retryAfter);
  }
}
```

### API Compatibility Layer
```javascript
// Discord.js style client
const { NexusClient } = require('nexus-fca');

const client = new NexusClient({
  prefix: '!',
  selfListen: false
});

client.on('ready', (api, userID) => {
  console.log(`Logged in as ${userID}`);
});

client.on('message', (message) => {
  if (message.content === 'ping') {
    message.reply('pong!');
  }
});

client.on('command', ({ name, args, message }) => {
  if (name === 'info') {
    message.reply(`Args: ${args.join(', ')}`);
  }
});

// Login
await client.loginWithAppState(appState);
```

## 🔧 New Features

### 1. Performance Optimizer
```javascript
const { PerformanceOptimizer } = require('nexus-fca');
const optimizer = PerformanceOptimizer.getInstance();

// Get performance report
const report = optimizer.getPerformanceReport();
console.log('Memory usage:', report.memory.usage);
console.log('Cache hit rate:', report.cache.hitRate);
console.log('Average response time:', report.requests.averageResponseTime);
```

### 2. Enhanced Message Objects
```javascript
client.on('message', async (message) => {
  // Rich message object with methods
  await message.reply('Reply to this message');
  await message.react('👍');
  await message.edit('Edited content'); // If message is from bot
  await message.unsend(); // Unsend message
  
  // Get additional info
  const thread = await message.getThread();
  const author = await message.getAuthor();
  
  console.log('Message ID:', message.id);
  console.log('Content:', message.content);
  console.log('Attachments:', message.attachments);
  console.log('Is from group:', message.isGroup);
});
```

### 3. Smart Command Loading
```javascript
// Create commands directory structure
mkdir commands/
echo 'module.exports = {
  name: "ping",
  description: "Responds with pong",
  aliases: ["p"],
  async execute({ message, args }) {
    await message.reply("Pong!");
  }
};' > commands/ping.js

// Load commands
client.loadCommands('./commands');
```

### 4. Database Management
```javascript
const { DatabaseManager } = require('nexus-fca');
const db = DatabaseManager.getInstance();

// Cache user data
await db.cacheUserInfo(userID, userInfo);
const cached = await db.getUserInfo(userID);

// Cache thread data
await db.cacheThreadInfo(threadID, threadInfo);
const threadData = await db.getThreadInfo(threadID);

// Save metrics
await db.saveMetric('messages_sent', messageCount);
const metrics = await db.getMetrics('messages_sent', 24); // Last 24 hours

// Get database stats
const stats = await db.getStats();
console.log('Cache hit rate:', stats.cache.hitRate);
```

### 5. Enhanced MQTT Manager
```javascript
const MqttManager = require('nexus-fca/lib/mqtt/MqttManager');

const mqttManager = new MqttManager(ctx, defaultFuncs);

mqttManager.on('connected', () => {
  console.log('MQTT connected with enhanced stability');
});

mqttManager.on('message', ({ topic, message }) => {
  console.log('Received message from:', topic);
});

// Get connection metrics
const metrics = mqttManager.getMetrics();
console.log('Messages received:', metrics.messagesReceived);
console.log('Connection uptime:', metrics.uptime);
console.log('Queue size:', metrics.queueSize);
```

## 📊 Performance Monitoring

### Built-in Metrics
```javascript
// Get comprehensive performance report
const optimizer = PerformanceOptimizer.getInstance();
const report = optimizer.getPerformanceReport();

console.log('=== Performance Report ===');
console.log('Memory:', report.memory);
console.log('Requests:', report.requests);
console.log('Cache:', report.cache);
console.log('MQTT:', report.mqtt);
```

### Memory Management
```javascript
// Monitor memory usage
setInterval(() => {
  const report = optimizer.getPerformanceReport();
  if (parseFloat(report.memory.usage) > 80) {
    console.warn('High memory usage detected:', report.memory.usage);
  }
}, 60000); // Check every minute
```

## 🛡️ Enhanced Error Handling

### Error Types
```javascript
const { 
  NexusError, 
  LoginError, 
  NetworkError, 
  ValidationError, 
  RateLimitError 
} = require('nexus-fca');

// Custom error handling
client.on('error', async (error) => {
  if (error instanceof LoginError) {
    console.log('Login failed:', error.message);
    // Handle re-login
  } else if (error instanceof RateLimitError) {
    console.log('Rate limited, waiting:', error.retryAfter);
    await new Promise(resolve => setTimeout(resolve, error.retryAfter * 1000));
  }
});
```

### Recovery Strategies
```javascript
const { errorHandler } = require('nexus-fca');

// Add custom recovery strategy
errorHandler.addRecoveryStrategy('CUSTOM_ERROR', async (error, context) => {
  // Custom recovery logic
  console.log('Attempting custom recovery...');
  return { success: true, message: 'Recovery successful' };
});

// Add user-friendly message
errorHandler.addUserFriendlyMessage('CUSTOM_ERROR', 'Something went wrong, but we fixed it!');
```

## 🔄 Migration Guide

### From Old FCA
```javascript
// Old way
const login = require('nexus-fca');
login(credentials, (err, api) => {
  api.listen((err, message) => {
    api.sendMessage(message.body, message.threadID);
  });
});

// Enhanced way
const { NexusClient } = require('nexus-fca');
const client = new NexusClient();

client.on('message', (message) => {
  message.reply(message.content);
});

await client.loginWithAppState(appState);
```

### Backward Compatibility
```javascript
// Still works - traditional login
const login = require('nexus-fca');
login(credentials, (err, api) => {
  // All existing API methods work
  api.sendMessage('Hello', threadID);
  api.listen((err, message) => {
    // Traditional message handling
  });
});
```

## 📈 Best Practices

### 1. Use Enhanced Client for New Projects
```javascript
const { NexusClient } = require('nexus-fca');
const client = new NexusClient({
  prefix: '!',
  rateLimitEnabled: true,
  safeMode: true
});
```

### 2. Implement Error Handling
```javascript
client.on('error', (error) => {
  console.error('Client error:', error.message);
});

client.on('maxReconnectAttemptsReached', () => {
  console.error('Connection permanently failed');
  process.exit(1);
});
```

### 3. Monitor Performance
```javascript
setInterval(() => {
  const report = optimizer.getPerformanceReport();
  console.log(`Performance: ${report.memory.usage} memory, ${report.cache.hitRate} cache hit rate`);
}, 300000); // Every 5 minutes
```

### 4. Use Caching Effectively
```javascript
// Cache expensive operations
const getUserInfoCached = async (userID) => {
  const cached = await db.getUserInfo(userID);
  if (cached) return cached;
  
  const userInfo = await api.getUserInfo(userID);
  await db.cacheUserInfo(userID, userInfo);
  return userInfo;
};
```

## 🔧 Configuration

### Enhanced Config File
```json
{
  "autoUpdate": true,
  "mqtt": {
    "enabled": true,
    "reconnectInterval": 3600,
    "maxReconnectAttempts": 10
  },
  "performance": {
    "cacheEnabled": true,
    "maxCacheSize": 10000,
    "rateLimitEnabled": true,
    "maxConcurrentRequests": 5
  },
  "database": {
    "path": "./Fca_Database/nexus_cache.sqlite",
    "vacuumInterval": 86400
  },
  "logging": {
    "level": "info",
    "saveErrors": true
  }
}
```

## 📝 API Reference

### Enhanced Methods
- `client.loadCommands(directory)` - Load commands from directory
- `client.getUser()` - Get current user info
- `client.isReady()` - Check if client is ready
- `message.reply(content)` - Reply to message
- `message.react(emoji)` - React to message
- `message.edit(content)` - Edit message
- `message.unsend()` - Unsend message

### Performance Methods
- `optimizer.getPerformanceReport()` - Get comprehensive performance data
- `optimizer.optimizeRequest(fn, cacheKey, ttl)` - Optimize API request
- `db.getStats()` - Get database statistics
- `mqttManager.getMetrics()` - Get MQTT connection metrics

## 🚀 Examples

Check the `examples/` directory for:
- Enhanced client setup
- Command system implementation
- Performance monitoring
- Error handling patterns
- Database usage examples

---

**Nexus-FCA Enhanced** - The most advanced Facebook Chat API for Node.js with built-in performance optimization, smart caching, and enhanced error handling.
