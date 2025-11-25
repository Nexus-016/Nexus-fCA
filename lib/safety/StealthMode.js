/**
 * Nexus-FCA Stealth Mode - Human Behavior Simulation
 * Implements strict rate limiting and human-like pauses to prevent bans.
 */

class StealthMode {
    constructor(options = {}) {
        this.options = {
            maxRequestsPerMinute: 1000, // Relaxed from 30 to 1000 based on user feedback
            enableRandomPauses: true,
            pauseProbability: 0.0001, // Reduced from 1% to 0.01%
            minPauseMinutes: 0.1,
            maxPauseMinutes: 0.5,
            dailyRequestLimit: 500000, // Increased from 2000 to 500k
            ...options
        };

        this.requestHistory = [];
        this.dailyCount = 0;
        this.lastReset = Date.now();
        this.inPause = false;
        this.pauseUntil = 0;
    }

    /**
     * Check if we can proceed with a request
     * Returns { allowed: boolean, waitMs: number, reason: string }
     */
    canProceed() {
        const now = Date.now();

        // Check if we are in a forced pause
        if (this.inPause) {
            if (now < this.pauseUntil) {
                return { 
                    allowed: false, 
                    waitMs: this.pauseUntil - now, 
                    reason: 'Human pause active' 
                };
            }
            this.inPause = false;
        }

        // Reset daily limit if it's a new day
        if (now - this.lastReset > 24 * 60 * 60 * 1000) {
            this.dailyCount = 0;
            this.lastReset = now;
        }

        // Check daily limit
        if (this.dailyCount >= this.options.dailyRequestLimit) {
            return { 
                allowed: false, 
                waitMs: 60 * 60 * 1000, // Wait an hour before checking again (or stop)
                reason: 'Daily limit reached' 
            };
        }

        // Clean up old history (older than 1 minute)
        this.requestHistory = this.requestHistory.filter(ts => now - ts < 60000);

        // Check rate limit
        if (this.requestHistory.length >= this.options.maxRequestsPerMinute) {
            // Calculate when the oldest request expires
            const oldest = this.requestHistory[0];
            const waitMs = 60000 - (now - oldest) + 1000; // +1s buffer
            return { 
                allowed: false, 
                waitMs: waitMs, 
                reason: 'Rate limit exceeded' 
            };
        }

        return { allowed: true, waitMs: 0 };
    }

    /**
     * Record a request and potentially trigger a random pause
     */
    recordAction() {
        const now = Date.now();
        this.requestHistory.push(now);
        this.dailyCount++;

        // Random pause trigger
        if (this.options.enableRandomPauses && Math.random() < this.options.pauseProbability) {
            this.triggerRandomPause();
        }
    }

    /**
     * Trigger a random "coffee break" pause
     */
    triggerRandomPause() {
        const minMs = this.options.minPauseMinutes * 60 * 1000;
        const maxMs = this.options.maxPauseMinutes * 60 * 1000;
        const duration = Math.floor(Math.random() * (maxMs - minMs)) + minMs;
        
        this.inPause = true;
        this.pauseUntil = Date.now() + duration;
        
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
        console.log(`☕ Stealth Mode: Taking a human break for ${timeStr}...`);
    }

    /**
     * Wait until it's safe to proceed
     */
    async waitIfNeeded() {
        let logged = false;
        while (true) {
            const status = this.canProceed();
            if (status.allowed) {
                this.recordAction();
                return;
            }
            
            // Only log once per wait cycle to avoid spamming console from parallel requests
            if (!logged && status.waitMs > 2000) {
                console.log(`🛡️ Stealth Mode: Waiting ${Math.ceil(status.waitMs / 1000)}s (${status.reason})`);
                logged = true;
            }
            
            await new Promise(resolve => setTimeout(resolve, status.waitMs));
        }
    }
}

module.exports = StealthMode;
