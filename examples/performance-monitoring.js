const login = require('../index');
const { PerformanceOptimizer } = require('../lib/performance/PerformanceOptimizer');
const fs = require('fs');

// Example demonstrating performance monitoring and optimization
async function performanceBot() {
    try {
        // Initialize performance optimizer
        const perfOptimizer = new PerformanceOptimizer({
            memoryThreshold: 100 * 1024 * 1024, // 100MB
            requestRateLimit: 60, // 60 requests per minute
            cacheSize: 1000,
            enableMetrics: true
        });

        const api = await login({
            appstate: JSON.parse(fs.readFileSync('appstate.json', 'utf8'))
        });

        console.log('Performance monitoring bot started!');

        // Start performance monitoring
        perfOptimizer.startMonitoring();

        // Monitor API calls
        const originalSendMessage = api.sendMessage;
        api.sendMessage = perfOptimizer.wrapFunction(originalSendMessage.bind(api), 'sendMessage');

        const originalGetUserInfo = api.getUserInfo;
        api.getUserInfo = perfOptimizer.wrapFunction(originalGetUserInfo.bind(api), 'getUserInfo');

        // Set up performance reporting
        setInterval(() => {
            const metrics = perfOptimizer.getMetrics();
            console.log('📊 Performance Metrics:', {
                memory: `${Math.round(metrics.memory.heapUsed / 1024 / 1024)}MB`,
                requests: metrics.requests.total,
                cache: `${metrics.cache.hits}/${metrics.cache.total} hits`,
                errors: metrics.errors.total
            });
        }, 60000); // Every minute

        api.listen((err, message) => {
            if (err) {
                console.error('Listen error:', err);
                return;
            }

            handlePerformanceMessage(api, message, perfOptimizer);
        });

    } catch (error) {
        console.error('Login failed:', error);
    }
}

async function handlePerformanceMessage(api, message, perfOptimizer) {
    if (!message.body) return;

    const command = message.body.toLowerCase().trim();

    switch (command) {
        case '/perf':
            await sendPerformanceReport(api, message.threadID, perfOptimizer);
            break;

        case '/cache':
            await sendCacheStatus(api, message.threadID, perfOptimizer);
            break;

        case '/memory':
            await sendMemoryStatus(api, message.threadID, perfOptimizer);
            break;

        case '/stress':
            await runStressTest(api, message.threadID, perfOptimizer);
            break;

        case '/optimize':
            await runOptimization(api, message.threadID, perfOptimizer);
            break;

        case '/metrics':
            await sendDetailedMetrics(api, message.threadID, perfOptimizer);
            break;
    }
}

async function sendPerformanceReport(api, threadID, perfOptimizer) {
    const metrics = perfOptimizer.getMetrics();
    const uptime = process.uptime();

    const report = `📊 **Performance Report**

⏱️ **Uptime:** ${formatUptime(uptime)}
🧠 **Memory:** ${Math.round(metrics.memory.heapUsed / 1024 / 1024)}MB / ${Math.round(metrics.memory.heapTotal / 1024 / 1024)}MB
📈 **Requests:** ${metrics.requests.total} (${metrics.requests.errored} errors)
💾 **Cache:** ${metrics.cache.hits}/${metrics.cache.total} (${Math.round(metrics.cache.hitRate * 100)}% hit rate)
⚡ **Performance Score:** ${calculatePerformanceScore(metrics)}/100

🔧 **Commands:**
• /cache - Cache status
• /memory - Memory details
• /stress - Run stress test
• /optimize - Run optimization
• /metrics - Detailed metrics`;

    await api.sendMessage(report, threadID);
}

async function sendCacheStatus(api, threadID, perfOptimizer) {
    const cacheStats = perfOptimizer.getCacheStats();
    
    const report = `💾 **Cache Status**

📈 **Statistics:**
• Total Requests: ${cacheStats.total}
• Cache Hits: ${cacheStats.hits}
• Cache Misses: ${cacheStats.misses}
• Hit Rate: ${Math.round(cacheStats.hitRate * 100)}%

🗂️ **Cache Entries:**
• User Info: ${cacheStats.entries.userInfo || 0}
• Thread Info: ${cacheStats.entries.threadInfo || 0}
• Messages: ${cacheStats.entries.messages || 0}

⚙️ **Settings:**
• Max Size: ${cacheStats.maxSize}
• Current Size: ${cacheStats.currentSize}
• Memory Usage: ${Math.round(cacheStats.memoryUsage / 1024)}KB`;

    await api.sendMessage(report, threadID);
}

async function sendMemoryStatus(api, threadID, perfOptimizer) {
    const memoryUsage = process.memoryUsage();
    const metrics = perfOptimizer.getMetrics();

    const report = `🧠 **Memory Status**

📊 **Current Usage:**
• Heap Used: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB
• Heap Total: ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB
• External: ${Math.round(memoryUsage.external / 1024 / 1024)}MB
• RSS: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB

📈 **Trends:**
• Peak Usage: ${Math.round(metrics.memory.peak / 1024 / 1024)}MB
• Average: ${Math.round(metrics.memory.average / 1024 / 1024)}MB
• GC Collections: ${metrics.gc ? metrics.gc.collections : 'N/A'}

⚠️ **Warnings:**
${memoryUsage.heapUsed > 100 * 1024 * 1024 ? '• High memory usage detected!' : '• Memory usage is normal'}
${memoryUsage.heapUsed / memoryUsage.heapTotal > 0.8 ? '• Heap utilization is high!' : '• Heap utilization is healthy'}`;

    await api.sendMessage(report, threadID);
}

async function runStressTest(api, threadID, perfOptimizer) {
    await api.sendMessage('🧪 **Starting Stress Test**\n\nRunning performance tests...', threadID);

    const startTime = Date.now();
    const promises = [];

    // Test 1: API calls
    for (let i = 0; i < 10; i++) {
        promises.push(api.getUserInfo('4')); // Generic user ID
    }

    // Test 2: Memory allocation
    const testData = [];
    for (let i = 0; i < 1000; i++) {
        testData.push(new Array(1000).fill(Math.random()));
    }

    try {
        await Promise.all(promises);
        const endTime = Date.now();
        const duration = endTime - startTime;

        const metrics = perfOptimizer.getMetrics();
        const report = `✅ **Stress Test Complete**

⏱️ **Duration:** ${duration}ms
📊 **Results:**
• API Calls: 10 requests completed
• Memory Test: 1M random numbers generated
• Cache Performance: ${Math.round(metrics.cache.hitRate * 100)}%
• Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB

${duration < 5000 ? '🟢 Performance: Excellent' : duration < 10000 ? '🟡 Performance: Good' : '🔴 Performance: Needs Attention'}`;

        await api.sendMessage(report, threadID);

        // Cleanup test data
        testData.length = 0;

    } catch (error) {
        await api.sendMessage(`❌ **Stress Test Failed**\n\nError: ${error.message}`, threadID);
    }
}

async function runOptimization(api, threadID, perfOptimizer) {
    await api.sendMessage('🔧 **Running Optimization**\n\nOptimizing performance...', threadID);

    const before = process.memoryUsage();

    // Run garbage collection if available
    if (global.gc) {
        global.gc();
    }

    // Clear old cache entries
    perfOptimizer.clearCache();

    // Optimize internal structures
    perfOptimizer.optimize();

    const after = process.memoryUsage();
    const memoryFreed = before.heapUsed - after.heapUsed;

    const report = `✅ **Optimization Complete**

🧹 **Memory Freed:** ${Math.round(memoryFreed / 1024 / 1024)}MB
💾 **Cache:** Cleared old entries
⚡ **Performance:** Structures optimized

📊 **Before/After:**
• Heap: ${Math.round(before.heapUsed / 1024 / 1024)}MB → ${Math.round(after.heapUsed / 1024 / 1024)}MB
• RSS: ${Math.round(before.rss / 1024 / 1024)}MB → ${Math.round(after.rss / 1024 / 1024)}MB

${memoryFreed > 0 ? '🟢 Optimization successful!' : '🟡 No significant memory freed'}`;

    await api.sendMessage(report, threadID);
}

async function sendDetailedMetrics(api, threadID, perfOptimizer) {
    const metrics = perfOptimizer.getMetrics();
    const detailed = perfOptimizer.getDetailedMetrics();

    const report = `📊 **Detailed Metrics**

⚡ **API Performance:**
• sendMessage: ${detailed.functions.sendMessage?.calls || 0} calls, ${detailed.functions.sendMessage?.avgTime || 0}ms avg
• getUserInfo: ${detailed.functions.getUserInfo?.calls || 0} calls, ${detailed.functions.getUserInfo?.avgTime || 0}ms avg
• listen: ${detailed.functions.listen?.calls || 0} calls

📈 **Request Patterns:**
• Peak QPS: ${detailed.requests.peakQPS || 0}
• Average Response Time: ${detailed.requests.avgResponseTime || 0}ms
• Error Rate: ${Math.round((metrics.requests.errored / metrics.requests.total) * 100) || 0}%

🧠 **Memory Patterns:**
• Peak Usage: ${Math.round(metrics.memory.peak / 1024 / 1024)}MB
• Memory Growth Rate: ${detailed.memory.growthRate || 0}MB/hour
• GC Frequency: ${detailed.gc?.frequency || 'N/A'}

💾 **Cache Efficiency:**
• Hot Data: ${detailed.cache.hotData || 0}% 
• Eviction Rate: ${detailed.cache.evictionRate || 0}%
• Average Lookup Time: ${detailed.cache.avgLookupTime || 0}ms`;

    await api.sendMessage(report, threadID);
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

function calculatePerformanceScore(metrics) {
    let score = 100;

    // Memory score (30 points)
    const memoryUsage = metrics.memory.heapUsed / (100 * 1024 * 1024); // Normalize to 100MB
    if (memoryUsage > 1) score -= 30;
    else if (memoryUsage > 0.8) score -= 20;
    else if (memoryUsage > 0.6) score -= 10;

    // Cache score (25 points)
    const cacheHitRate = metrics.cache.hitRate || 0;
    if (cacheHitRate < 0.5) score -= 25;
    else if (cacheHitRate < 0.7) score -= 15;
    else if (cacheHitRate < 0.9) score -= 5;

    // Error score (25 points)
    const errorRate = metrics.requests.total > 0 ? metrics.requests.errored / metrics.requests.total : 0;
    if (errorRate > 0.1) score -= 25;
    else if (errorRate > 0.05) score -= 15;
    else if (errorRate > 0.01) score -= 5;

    // Request score (20 points)
    const avgResponseTime = metrics.requests.avgResponseTime || 0;
    if (avgResponseTime > 5000) score -= 20;
    else if (avgResponseTime > 2000) score -= 10;
    else if (avgResponseTime > 1000) score -= 5;

    return Math.max(0, Math.round(score));
}

// Run the bot
if (require.main === module) {
    performanceBot();
}

module.exports = performanceBot;
