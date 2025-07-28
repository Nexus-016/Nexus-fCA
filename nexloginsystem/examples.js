/**
 * Nexus Login System - Example Usage
 * Simple examples of how to use the login system
 */

const { nexusLogin, createNexusLogin } = require('./index');

// Example 1: Quick Login (Automatic everything)
async function quickLoginExample() {
    console.log('📝 Example 1: Quick Login');
    
    const result = await nexusLogin({
        username: 'your_email@gmail.com',
        password: 'your_password',
        twofactor: 'YOUR_2FA_SECRET_KEY' // Optional but recommended
    });

    if (result.success) {
        console.log('✅ Login successful!');
        console.log('User ID:', result.api.getCurrentUserID());
        
        // Your bot code here
        result.api.sendMessage('Hello from Nexus Login System!', result.api.getCurrentUserID());
    } else {
        console.log('❌ Login failed:', result.message);
    }
}

// Example 2: Advanced Usage with Custom Options
async function advancedLoginExample() {
    console.log('📝 Example 2: Advanced Login');
    
    const login = createNexusLogin({
        appstatePath: './my-appstate.json',
        credentialsPath: './my-credentials.json',
        autoStartBot: true,
        safeMode: true
    });

    // Method 1: Login with credentials
    const result = await login.login({
        username: 'your_email@gmail.com',
        password: 'your_password',
        twofactor: 'YOUR_2FA_SECRET_KEY'
    });

    if (result.success) {
        console.log('Bot ready!');
    }
}

// Example 3: Only Generate Appstate (No Bot)
async function generateAppstateOnly() {
    console.log('📝 Example 3: Generate Appstate Only');
    
    const login = createNexusLogin({
        autoStartBot: false // Don't start bot, just generate appstate
    });

    const result = await login.login({
        username: 'your_email@gmail.com',
        password: 'your_password',
        twofactor: 'YOUR_2FA_SECRET_KEY'
    });

    if (result.success) {
        console.log('Appstate generated!');
        console.log('File saved to:', login.options.appstatePath);
        
        // Now you can use this appstate with any FCA library
        const appstate = result.appstate;
        // ... use with Nexus-FCA, fca-unofficial, etc.
    }
}

// Example 4: Load Existing Appstate
async function loadExistingAppstate() {
    console.log('📝 Example 4: Load Existing Appstate');
    
    const login = createNexusLogin();
    
    // Will automatically check for existing appstate and use it
    const result = await login.login(); // No credentials needed if appstate exists

    if (result.success) {
        console.log('Loaded existing appstate!');
        console.log('Method:', result.loginMethod);
    }
}

// Example 5: Complete Bot Setup
async function completeBotExample() {
    console.log('📝 Example 5: Complete Bot Setup');
    
    try {
        // This will:
        // 1. Check for existing appstate
        // 2. If not found, generate new one with credentials
        // 3. Start Nexus-FCA bot with ultra-safe settings
        // 4. Return ready-to-use API
        
        const result = await nexusLogin({
            username: 'your_email@gmail.com',
            password: 'your_password',
            twofactor: 'YOUR_2FA_SECRET_KEY'
        });

        if (result.success) {
            const api = result.api;
            
            // Setup message listener
            api.listenMqtt((err, event) => {
                if (err) return console.log('Listen error:', err);
                
                if (event.type === 'message') {
                    console.log('Message received:', event.body);
                    
                    // Echo bot example
                    if (event.body === 'test') {
                        api.sendMessage('Bot is working!', event.threadID);
                    }
                }
            });

            console.log('🤖 Bot is now listening for messages...');
            console.log('💬 Send "test" to verify it\'s working');
            
        } else {
            console.log('❌ Setup failed:', result.message);
        }

    } catch (error) {
        console.log('💥 Error:', error.message);
    }
}

// Run examples (uncomment to test)
// quickLoginExample();
// advancedLoginExample();
// generateAppstateOnly();
// loadExistingAppstate();
// completeBotExample();

module.exports = {
    quickLoginExample,
    advancedLoginExample,
    generateAppstateOnly,
    loadExistingAppstate,
    completeBotExample
};
