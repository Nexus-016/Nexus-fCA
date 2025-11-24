/**
 * Nexus-FCA Stealth Mode - Human Behavior Simulation
 * Implements strict rate limiting and human-like pauses to prevent bans.
 */

class StealthMode {
    constructor(options = {}) {
        this.options = {
            maxRequestsPerMinute: 3, // Very low limit for safety
            enableRandomPauses: true,
            pauseProbability: 0.05, // 5% chance to take a break after each action
            minPauseMinutes: 5,
            maxPauseMinutes: 15,
            dailyRequestLimit: 500, // Hard limit per day
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
        
        console.log(`☕ Stealth Mode: Taking a human break for ${Math.floor(duration / 60000)} minutes...`);
    }

    /**
     * Wait until it's safe to proceed
     */
    async waitIfNeeded() {
        while (true) {
            const status = this.canProceed();
            if (status.allowed) {
                this.recordAction();
                return;
            }
            
            console.log(`🛡️ Stealth Mode: Waiting ${Math.ceil(status.waitMs / 1000)}s (${status.reason})`);
            await new Promise(resolve => setTimeout(resolve, status.waitMs));
        }
    }
}

module.exports = StealthMode;
