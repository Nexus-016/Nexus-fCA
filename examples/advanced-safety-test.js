const login = require('../index');
const fs = require('fs');

// Configuration for the "Most Advanced & Safest" Bot
const config = {
    appState: JSON.parse(fs.readFileSync('appstate.json', 'utf8')),
    options: {
        listenEvents: true,
        selfListen: false,
        // Enable the new Ultra-Safe Mode
        ultraLowBanMode: true, 
        // Use a random user agent for better anonymity
        randomUserAgent: true,
        // Enable the new Lightspeed protocol for speed
        enableLightspeed: true 
    }
};

login(config, (err, api) => {
    if (err) return console.error(err);

    console.log("Logged in successfully!");
    console.log("Current User ID:", api.getCurrentUserID());

    // 1. Demonstrate Safety Features
    const safetyMetrics = api.getHealthMetrics ? api.getHealthMetrics() : "N/A";
    console.log("Initial Safety Metrics:", safetyMetrics);

    // 2. Use the new Lightspeed Listener (Fastest)
    if (api.listenSpeed) {
        console.log("Starting Lightspeed Listener (Fastest & Safe)...");
        const listener = api.listenSpeed((err, event) => {
            if (err) return console.error(err);
            
            console.log("Received Lightspeed Event:", event.type);
            
            if (event.type === "lightspeed_event") {
                // Handle lightspeed specific events
                // Note: Payload parsing is needed for full functionality
            }
        });
    } else {
        // Fallback to standard MQTT listener (Safest)
        console.log("Starting Standard MQTT Listener (Safest)...");
        api.listenMqtt((err, event) => {
            if (err) return console.error(err);
            
            switch (event.type) {
                case "message":
                    if (event.body === "/ping") {
                        api.sendMessage("Pong! (Protected by Nexus-FCA Safety)", event.threadID);
                    }
                    break;
                case "event":
                    console.log(event);
                    break;
            }
        });
    }

    // 3. Demonstrate Dynamic DocID Fetching (Advanced)
    // This would be used internally, but here we show it exists
    // const docIDs = require('../utils').getLatestDocIDs(api);
    // console.log("Using DocIDs:", docIDs);
});
