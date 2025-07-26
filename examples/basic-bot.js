const login = require('../index');
const fs = require('fs');

// Basic bot example using the legacy API
async function basicBot() {
    try {
        // Login with credentials or appstate
        const api = await login({
            email: "your-email@example.com",
            password: "your-password"
            // OR use appstate: JSON.parse(fs.readFileSync('appstate.json', 'utf8'))
        });

        console.log('Bot logged in successfully!');

        // Listen for messages
        api.listen((err, message) => {
            if (err) {
                console.error('Listen error:', err);
                return;
            }

            console.log('Received message:', message);

            // Respond to messages
            if (message.body && message.body.toLowerCase() === 'hello') {
                api.sendMessage('Hello there!', message.threadID);
            }

            // Echo bot
            if (message.body && message.body.startsWith('echo ')) {
                const echoText = message.body.substring(5);
                api.sendMessage(echoText, message.threadID);
            }
        });

    } catch (error) {
        console.error('Login failed:', error);
    }
}

// Run the bot
if (require.main === module) {
    basicBot();
}

module.exports = basicBot;
