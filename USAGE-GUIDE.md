# Nexus-FCA Ultimate Usage Guide 🚀

This guide covers **every single API method** available in Nexus-FCA. All methods from the `src` directory are automatically attached to the `api` object.

---

## 📦 Table of Contents
1. [Authentication & Account](#1-authentication--account)
2. [Messaging Basics](#2-messaging-basics)
3. [Advanced Messaging (Editing, Deleting, Reacting)](#3-advanced-messaging)
4. [Group & Thread Management](#4-group--thread-management)
5. [User & Friends Data](#5-user--friends-data)
6. [Privacy & Blocking](#6-privacy--blocking)
7. [Profile Customization](#7-profile-customization)
8. [Social (Posts, Stories, Comments)](#8-social)
9. [Polls](#9-polls)
10. [Attachments & Sharing](#10-attachments--sharing)
11. [Status & Feedback](#11-status--feedback)
12. [Listening & Events](#12-listening--events)
13. [Niche & Utility APIs](#13-niche--utility-apis)
14. [Internal & Performance APIs](#14-internal--performance-apis)
15. [Account Safety & Pacing](#15-account-safety--pacing)

---

## 1. Authentication & Account
Manage your session and account-level settings.

### `getAppState()`
Returns the current session cookies. Useful for saving sessions.
```js
const appState = api.getAppState();
fs.writeFileSync('appstate.json', JSON.stringify(appState, null, 2));
```

### `getCurrentUserID()`
Returns the FBID of the logged-in bot.
```js
console.log("Bot ID:", api.getCurrentUserID());
```

### `logout()`
Logs the bot out of the session.
```js
api.logout((err) => {
    if (!err) console.log("Logged out!");
});
```

---

## 2. Messaging Basics
Sending simple and rich messages.

### `sendMessage(msg, threadID, ...)`
The core method for sending messages. 
> [!NOTE]
> **Auto-Typing**: By default, `sendMessage` will automatically send a typing indicator before the message to simulate human behavior.

```js
// Text only
api.sendMessage("Hello!", threadID);

// With attachments
api.sendMessage({
    body: "Look at this!",
    attachment: fs.createReadStream("./pic.jpg")
}, threadID);

// Mentioning someone
api.sendMessage({
    body: "Hi @User",
    mentions: [{ tag: "@User", id: "123" }]
}, threadID);

// Replying to a message
api.sendMessage("This is a reply", threadID, (err, info) => {
    // Callback handling
}, messageID);
```

### `sendTypingIndicator(threadID, ...)`
Manually shows the "typing..." bubble. Useful if you want to show typing long before sending a message.
```js
api.sendTypingIndicator(threadID, (err) => {
    // Typing indicator sent
});
```

---

## 3. Advanced Messaging
Editing, reacting, and managing messages.

### `editMessage(text, messageID)`
Edits a message sent by the bot.
```js
api.editMessage("Changed my mind!", messageID);
```

### `unsendMessage(messageID)`
Unsends (removes for everyone) a message sent by the bot.
```js
api.unsendMessage(messageID);
```

### `deleteMessage(messageIDs)`
Deletes messages for the bot only.
```js
api.deleteMessage(messageID); // Single ID
api.deleteMessage([id1, id2]); // Multiple IDs
```

### `setMessageReaction(reaction, messageID)`
Sets an emoji reaction.
```js
api.setMessageReaction("👍", messageID);
api.setMessageReaction("", messageID); // Remove reaction
```

---

## 4. Group & Thread Management
Manage group chats and thread settings.

### `createNewGroup(participantIDs, groupTitle)`
Creates a new group chat.
```js
api.createNewGroup(["ID1", "ID2"], "New Bot Group", (err, threadID) => {
    console.log("Created group:", threadID);
});
```

### `addUserToGroup(userID, threadID)`
Adds a user to a group.
```js
api.addUserToGroup("UserID", threadID);
```

### `removeUserFromGroup(userID, threadID)`
Kicks a user from a group.
```js
api.removeUserFromGroup("UserID", threadID);
```

### `changeAdminStatus(threadID, userIDs, adminStatus)`
Promotes or demotes group admins.
```js
api.changeAdminStatus(threadID, "UserID", true); // Make admin
api.changeAdminStatus(threadID, ["ID1", "ID2"], false); // Remove admins
```

### `setTitle(title, threadID)`
Changes the group name.
```js
api.setTitle("Cool Group", threadID);
```

### `changeGroupImage(imageStream, threadID)`
Changes the group's profile picture.
```js
api.changeGroupImage(fs.createReadStream("./group.jpg"), threadID);
```

### `changeThreadColor(color, threadID)`
Changes theme color. Use `api.threadColors` to see available values.
```js
api.changeThreadColor(api.threadColors.MESSENGER_BLUE, threadID);
```

### `changeThreadEmoji(emoji, threadID)`
Changes the default quick-react emoji.
```js
api.changeThreadEmoji("🔥", threadID);
```

---

## 5. User & Friends Data
Retrieve information about users and threads.

### `getUserInfo(userIDs)`
Gets detailed user info.
```js
api.getUserInfo("UserID", (err, data) => {
    console.log(data["UserID"].name);
});
```

### `getThreadInfo(threadID)`
Gets details about a group or private chat.
```js
api.getThreadInfo(threadID, (err, info) => {
    console.log("Members:", info.participantIDs);
});
```

### `getThreadHistory(threadID, amount)`
Fetches previous messages.
```js
api.getThreadHistory(threadID, 10, null, (err, history) => {
    history.forEach(msg => console.log(msg.body));
});
```

---

## 6. Privacy & Blocking
Manage security and block lists.

### `changeBlockedStatus(userID, block)`
Blocks or unblocks a user.
```js
api.changeBlockedStatus("UserID", true); // Block
```

### `setProfileGuard(boolean)`
Enables or disables profile picture guard (Shield).
```js
api.setProfileGuard(true);
```

---

## 7. Profile Customization
Update the bot's own profile.

### `changeBio(bio)`
Updates the bot's profile bio.
```js
api.changeBio("I am a Nexus-FCA powered bot!");
```

### `changeAvatar(imageStream)`
Changes the profile picture.
```js
api.changeAvatar(fs.createReadStream("./avatar.jpg"));
```

---

## 8. Social (Posts, Stories, Comments)
Interact with the Facebook feed.

### `createPost(options)`
Creates a new post on the bot's timeline.
```js
api.createPost({
    body: "Hello World from Nexus-FCA!",
    base_state: "EVERYONE" // Privacy
});
```

### `setPostReaction(postID, reactionType)`
Reacts to a post.
```js
api.setPostReaction("PostID", "LIKE");
```

---

## 9. Polls
Interactive polls in groups.

### `createPoll(title, threadID, options)`
Creates a poll in a group chat.
```js
api.createPoll("What's our bot's name?", threadID, {
    "Nexus": true,
    "Antigravity": false,
    "Classic": false
});
```

---

## 10. Attachments & Sharing
Sharing content across threads.

### `forwardAttachment(attachmentID, threadIDs)`
Forwards an existing attachment.
```js
api.forwardAttachment("AttachID", threadID);
```

---

## 11. Status & Feedback
Control read receipts and delivery status.

### `markAsRead(threadID)`
Marks a thread as read.
```js
api.markAsRead(threadID);
```

### `markAsSeen()`
Marks all messages as seen globally.
```js
api.markAsSeen();
```

---

## 12. Listening & Events
How to receive messages and events.

### `listenMqtt(callback)`
Standard listener for all incoming events.
```js
api.listenMqtt((err, event) => {
    if (event.type === "message") {
        console.log("New message:", event.body);
    }
});
```

---

## 13. Niche & Utility APIs
Specialized functions for specific use cases.

### `searchForThread(name)`
Searches for a thread by name.
```js
api.searchForThread("Nexus Group", (err, threads) => {
    console.log("Found:", threads[0].threadID);
});
```

---

## 14. Internal & Performance APIs
Metrics and safety settings.

### `getHealthMetrics()`
Returns diagnostic information about the bot's performance.
```js
console.log(api.getHealthMetrics());
```

### `setOptions(options)`
Updates configuration at runtime.
```js
api.setOptions({
    selfListen: true,
    autoMarkRead: true
});
```

---

## 15. Account Safety & Pacing
Nexus-FCA includes advanced safety features to prevent bans.

### `autoTyping(boolean)`
Enables or disables automatic typing indicators before sending messages. **Default: true.**
```js
api.autoTyping(true); // Recommended for account safety
```

### Adaptive Pacing
The library automatically adjusts request delays based on account risk.
- **Low Risk**: ~1.5s - 3s delay per message.
- **High Risk**: ~3.5s - 6.5s delay per message.

### > [!WARNING] Safe Usage Guidelines
To avoid "Automated Behavior" flags:
1. **Cooldown**: If your account is flagged, stop the bot for **24 hours**.
2. **Dynamic Headers**: Nexus-FCA now automatically syncs Client-Hints with your User-Agent. Do not override headers manually unless necessary.
3. **Appstate Refresh**: Regularly export and use a fresh `appstate.json` if you encounter session issues.

---

> [!IMPORTANT]
> This is a condensed guide. For deep technical details, refer to `API-METHODS-REFERENCE.md` and `index.d.ts`.
