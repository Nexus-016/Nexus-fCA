<div align="center">

![20241210_183831](https://i.ibb.co/LzkQMGWz/Future-Studio-Synthwave-Logo-Future-Studio-Synthwave-Logo.png)

<h2 align="center"><b>Nexus-FCA: Advanced Facebook Chat API</b></h2>

---

## 🚀 What's New & Why Nexus-FCA is Better

- **Professional Console Banner:**
  - Beautiful blue-cyan gradient banner and info logs for a modern, premium look every time you start Nexus-FCA.
- **Clean, Modern Branding:**
  - All legacy/old credits and placeholders removed. 100% Nexus-FCA, 100% professional.
- **Advanced Feature Set:**
  - Combines and upgrades the best modules from multiple FCA forks for maximum compatibility and features.
  - Every feature is documented in the `docs/` folder with real usage examples.
- **Safe & Testable:**
  - All legacy/unsafe code removed. No more version-check errors or startup spam.
  - Test script (`test_all_features.js`) lets you safely test every feature live in Messenger.
- **Better Error Handling:**
  - Cleaner error messages, no more huge dumps for simple issues.
- **Admin & Safety Tools:**
  - Global rate limiting, allow/block lists, and Safe Mode for extra account protection.
- **Easy to Use:**
  - Simple login with `appstate.json`. No password needed after first login.
  - All features accessible via a clean API and Messenger bot commands.
- **Actively Maintained:**
  - Frequent updates, bug fixes, and new features.

---

> **Professional Console Banner:**
> When you start Nexus-FCA, you'll see a beautiful blue-cyan gradient banner in your terminal:
>
> ```
> ═══════════════════════════════════════════════════════════════════════════════
>         Welcome to Nexus-FCA - Advanced & Safe Facebook Chat API
> ═══════════════════════════════════════════════════════════════════════════════
> [ NEXUS-FCA ] > ...
> ```
>
> All status/info logs use a modern, professional gradient for easy visibility.

---

_Disclaimer_: Use responsibly. Nexus-FCA is not affiliated with Facebook. Your account may be at risk if you use this for spam or automation against Facebook's terms.

---

## Why Nexus-FCA?

- All-in-one: Combines the most advanced features from multiple FCA forks.
- Safety first: Cookie-based login, secure session management, and best practices for account protection.
- Modern: Maintained, with new features and bug fixes.
- Clean branding: No legacy credits, 100% Nexus-FCA.

## Install

```bash
npm install nexus-fca
```

## Example Usage

```javascript
const login = require("nexus-fca");

login({ appState: [] }, (err, api) => {
    if (err) return console.error(err);

    api.listenMqtt((err, event) => {
        if (err) return console.error(err);
        api.sendMessage(event.body, event.threadID);
    });
});
```

Result:

<img width="517" alt="screen shot 2016-11-04 at 14 36 00" src="https://cloud.githubusercontent.com/assets/4534692/20023545/f8c24130-a29d-11e6-9ef7-47568bdbc1f2.png">

## Main Functionality

### Sending a message

#### api.sendMessage(message, threadID[, callback][, messageID])

Various types of message can be sent:

* *Regular:* set field `body` to the desired message as a string.
* *Sticker:* set a field `sticker` to the desired sticker ID.
* *File or image:* Set field `attachment` to a readable stream or an array of readable streams.
* *URL:* set a field `url` to the desired URL.
* *Emoji:* set field `emoji` to the desired emoji as a string and set field `emojiSize` with size of the emoji (`small`, `medium`, `large`)

Note that a message can only be a regular message (which can be empty) and optionally one of the following: a sticker, an attachment or a url.

__Tip__: to find your own ID, you can look inside the cookies. The `userID` is under the name `c_user`.

__Example (Basic Message)__

```js
const login = require("nexus-fca");

login({ appState: [] }, (err, api) => {
    if (err) {
        console.error("Login Error:", err);
        return;
    }

    let yourID = "000000000000000"; // Replace with actual Facebook ID
    let msg = "Hey!";
  
    api.sendMessage(msg, yourID, (err) => {
        if (err) console.error("Message Sending Error:", err);
        else console.log("Message sent successfully!");
    });
});

```

__Example (File upload)__

```js
const login = require("nexus-fca");
const fs = require("fs"); // ✅ Required the fs module

login({ appState: [] }, (err, api) => {
    if (err) {
        console.error("Login Error:", err);
        return;
    }

    let yourID = "000000000000000"; // Replace with actual Facebook ID
    let imagePath = __dirname + "/image.jpg";

    // Check if the file exists before sending
    if (!fs.existsSync(imagePath)) {
        console.error("Error: Image file not found!");
        return;
    }

    let msg = {
        body: "Hey!",
        attachment: fs.createReadStream(imagePath)
    };

    api.sendMessage(msg, yourID, (err) => {
        if (err) console.error("Message Sending Error:", err);
        else console.log("Message sent successfully!");
    });
});

```

---

### Saving session.

To avoid logging in every time you should save AppState (cookies etc.) to a file, then you can use it without having password in your scripts.

__Example__

```js
const fs = require("fs");
const login = require("nexus-fca");

const credentials = { appState: [] };

login(credentials, (err, api) => {
    if (err) {
        console.error("Login Error:", err);
        return;
    }

    try {
        const appState = JSON.stringify(api.getAppState(), null, 2); // Pretty print for readability
        fs.writeFileSync("appstate.json", appState);
        console.log("✅ AppState saved successfully!");
    } catch (error) {
        console.error("Error saving AppState:", error);
    }
});

```

---

### Listening to a chat

#### api.listenMqtt(callback)

Listen watches for messages sent in a chat. By default this won't receive events (joining/leaving a chat, title change etc…) but it can be activated with `api.setOptions({listenEvents: true})`. This will by default ignore messages sent by the current account, you can enable listening to your own messages with `api.setOptions({selfListen: true})`.

__Example__

```js
const fs = require("fs");
const login = require("nexus-fca");

// Simple echo bot: Repeats everything you say. Stops when you say "/stop".
login({ appState: JSON.parse(fs.readFileSync("appstate.json", "utf8")) }, (err, api) => {
    if (err) {
        console.error("Login Error:", err);
        return;
    }

    api.setOptions({ listenEvents: true });

    const stopListening = api.listenMqtt((err, event) => {
        if (err) {
            console.error("Listen Error:", err);
            return;
        }

        // Mark message as read
        api.markAsRead(event.threadID, (err) => {
            if (err) console.error("Mark as read error:", err);
        });

        // Handle different event types
        switch (event.type) {
            case "message":
                if (event.body && event.body.trim().toLowerCase() === "/stop") {
                    api.sendMessage("Goodbye…", event.threadID);
                    stopListening();
                    return;
                }
                api.sendMessage(`TEST BOT: ${event.body}`, event.threadID);
                break;

            case "event":
                console.log("Event Received:", event);
                break;
        }
    });
});

```

---

## Advanced Safety & Admin Features

- **Global Rate Limiting:** Prevents spam and abuse for all sensitive actions (e.g., avatar change, messaging).
- **Safe Mode:** Set `NEXUS_FCA_SAFE_MODE=1` in your environment to disable risky features (like avatar/group changes) for extra protection.
- **Allow/Block List:** Control who can use the API with `NEXUS_FCA_ALLOW_LIST` and `NEXUS_FCA_BLOCK_LIST` (comma-separated user IDs).
- **Health Check:** Use `api.healthCheck((err, status) => { ... })` to verify the bot is running and see current safety status.
