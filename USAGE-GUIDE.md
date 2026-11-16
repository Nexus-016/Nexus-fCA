# Nexus-FCA Usage Guide

This guide covers the `api.*` methods available in Nexus-FCA with practical examples. All methods from the `src` directory are automatically attached to the `api` object.

> Operations marked **[LS]** run natively over the LightSpeed task channel (the same task protocol the Messenger application uses) with an automatic, idempotent web fallback. See `README.md` → LightSpeed Task Engine.

---

## Table of Contents
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
Returns the FBID of the logged-in account.
```js
console.log("Bot ID:", api.getCurrentUserID());
```

### `logout()`
Logs the bot out of the session. The anti-logout guard blocks accidental logouts; use `forceLogout()` for a deliberate one.
```js
api.logout((err) => {
    if (!err) console.log("Logged out");
});
```

---

## 2. Messaging Basics
Sending simple and rich messages.

### `sendMessage(msg, threadID, ...)`
The core method for sending messages.
> [!NOTE]
> **Auto-Typing**: By default, `sendMessage` automatically sends a typing indicator before the message.

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
Manually shows the "typing..." indicator. Useful when you want the indicator to appear well before the message is sent.
```js
api.sendTypingIndicator(threadID, (err) => {
    // Typing indicator sent
});
```

---

## 3. Advanced Messaging
Editing, reacting, and managing messages.

### `editMessage(text, messageID)` [LS]
Edits a message sent by the bot. Published through the shared LightSpeed task engine with bounded resend attempts.
```js
api.editMessage("Changed my mind!", messageID);
```

### `unsendMessage(messageID)` [LS]
Unsends (removes for everyone) a message sent by the bot.
```js
api.unsendMessage(messageID);
```

### `deleteMessage(messageIDs)` [LS]
Deletes messages for the bot only.
```js
api.deleteMessage(messageID); // Single ID
api.deleteMessage([id1, id2]); // Multiple IDs
```

### `setMessageReaction(reaction, messageID)` [LS]
Sets an emoji reaction.
```js
api.setMessageReaction("👍", messageID);
api.setMessageReaction("", messageID); // Remove reaction
```

---

## 4. Group & Thread Management
Manage group chats and thread settings.

### `createNewGroup(participantIDs, groupTitle)` [LS]
Creates a new group chat. The callback receives the **real** group thread id once the task acknowledgement resolves it.
```js
api.createNewGroup(["ID1", "ID2"], "Project Team", (err, threadID) => {
    console.log("Created group:", threadID);
});
```

### `addUserToGroup(userID, threadID)` [LS]
Adds a user to a group.
```js
api.addUserToGroup("UserID", threadID);
```

### `removeUserFromGroup(userID, threadID)` [LS]
Removes a user from a group.
```js
api.removeUserFromGroup("UserID", threadID);
```

### `changeAdminStatus(threadID, userIDs, adminStatus)` [LS]
Promotes or demotes group admins.
```js
api.changeAdminStatus(threadID, "UserID", true); // Make admin
api.changeAdminStatus(threadID, ["ID1", "ID2"], false); // Remove admins
```

### `setTitle(title, threadID)` [LS]
Changes the group name.
```js
api.setTitle("New Group Name", threadID);
```

### `changeGroupImage(imageStream, threadID)` [LS]
Changes the group's profile picture.
```js
api.changeGroupImage(fs.createReadStream("./group.jpg"), threadID);
```

### `changeThreadColor(color, threadID)`
Changes theme color. Use `api.threadColors` to see available values.
```js
api.changeThreadColor(api.threadColors.MESSENGER_BLUE, threadID);
```

### `changeThreadEmoji(emoji, threadID)` [LS]
Changes the default quick-react emoji.
```js
api.changeThreadEmoji("🔥", threadID);
```

### `changeNickname(nickname, threadID, userID)` [LS]
Changes a member's nickname.
```js
api.changeNickname("Support", threadID, "UserID");
```

### `muteThread(threadID, muteSeconds)` [LS]
Mutes a thread. Timed mutes (positive seconds) and unmute (`0`) take the native task path; a permanent mute (`-1`) uses the equivalent web endpoint.
```js
api.muteThread(threadID, 3600); // Mute for 1 hour
api.muteThread(threadID, 0);    // Unmute
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
Manage security, message requests and block lists.

### `changeBlockedStatus(userID, block)`
Blocks or unblocks a user.
```js
api.changeBlockedStatus("UserID", true); // Block
```

### `handleMessageRequest(threadID, accept)` [LS]
Accepts or declines a pending message request. Accepting takes the native task path.
```js
api.handleMessageRequest(threadID, true);  // Accept
api.handleMessageRequest(threadID, false); // Decline
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
api.changeBio("Powered by Nexus-FCA");
```

### `changeAvatar(imageStream)`
Changes the profile picture.
```js
api.changeAvatar(fs.createReadStream("./avatar.jpg"));
```

### `changeAvatarV2(imageURL, caption)`
Updated avatar flow (upload + profile picture mutation).
```js
api.changeAvatarV2("https://example.com/avatar.jpg", "New look");
```

---

## 8. Social (Posts, Stories, Comments)
Interact with the Facebook feed.

### `createPost(options)`
Creates a new post on the bot's timeline.
```js
api.createPost({
    body: "Hello from Nexus-FCA!",
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

### `createPoll(title, threadID, options)` [LS]
Creates a poll in a group chat.
```js
api.createPoll("What should we name the bot?", threadID, {
    "Nexus": true,
    "Falcon": false,
    "Classic": false
});
```

### `votePoll(threadID, pollID, optionIds, callback)` [LS]
Votes on an existing poll. Option ids come from the poll message's data (the `pollID` and each option's id as delivered in the event/thread history).
```js
api.votePoll(threadID, pollID, [optionId], (err) => {
    if (!err) console.log("Vote recorded");
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
Metrics and runtime tuning.

### `getHealthMetrics()`
Returns diagnostic information about the bot's performance (uptime, reconnects, ack latency, delivery statistics).
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
Nexus-FCA includes safety features to reduce account-flagging risk.

### `autoTyping(boolean)`
Enables or disables automatic typing indicators before sending messages. **Default: true.**
```js
api.autoTyping(true); // Recommended
```

### Adaptive Pacing
The library automatically adjusts request delays based on account risk.
- **Low risk**: ~1.5s – 3s delay per message.
- **High risk**: ~3.5s – 6.5s delay per message.

### Safe Usage Guidelines
> [!WARNING]
To avoid automated-behavior flags:
1. **Cooldown**: If your account is flagged, stop the bot for **24 hours**.
2. **Headers**: Nexus-FCA automatically syncs Client-Hints with the User-Agent. Do not override headers manually unless necessary.
3. **Appstate**: Export a fresh `appstate.json` when session issues appear; enable the Session Vault for ephemeral hosts.

---

> [!IMPORTANT]
> This is a condensed guide. For deep technical details, refer to `API-METHODS-REFERENCE.md`, `COMPLETE-API-DOCS.md` and `index.d.ts`.
