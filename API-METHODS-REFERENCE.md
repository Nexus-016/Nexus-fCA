# Nexus-FCA — API Methods Reference

A quick reference for every `api.*` method. All methods from the `src/` directory are attached to the `api` object automatically.

Operations marked **[LS]** run natively over the LightSpeed task channel with an automatic, idempotent web fallback (see `README.md` → LightSpeed Task Engine).

## Login Methods

| Method | Description | Example |
|--------|-------------|---------|
| `login()` | Primary login (appstate or credentials) | `await login({ appState }, { autoReconnect: true })` |
| `nexusLogin()` | Integrated login system (username/password/2FA/appstate) | `await nexusLogin({ username, password, twofactor })` |
| `login.utils.checkLiveCookie(input)` | Sessionless cookie liveness probe (local) | `await login.utils.checkLiveCookie(cookieArray)` |

## Message Methods

| Method | Description | Example |
|--------|-------------|---------|
| `sendMessage()` | Send text/media message | `api.sendMessage('Hello!', threadID)` |
| `sendMessageMqtt()` | Send message via MQTT (faster) | `api.sendMessageMqtt('Hi!', threadID, [replyID])` |
| `editMessage()` **[LS]** | Edit an existing message (shared task engine, bounded resend) | `api.editMessage('New text', messageID)` |
| `unsendMessage()` **[LS]** | Delete/unsend a message | `api.unsendMessage(messageID)` |
| `deleteMessage()` **[LS]** | Delete messages for self only | `api.deleteMessage([id1, id2])` |
| `markAsRead()` | Mark messages as read | `api.markAsRead(threadID)` |
| `markAsDelivered()` | Mark as delivered | `api.markAsDelivered(threadID)` |
| `markAsReadAll()` | Mark all threads as read | `api.markAsReadAll()` |
| `markAsSeen()` | Mark as seen | `api.markAsSeen()` |
| `setMessageReaction()` **[LS]** | React to a message | `api.setMessageReaction('👍', messageID)` |
| `setMessageReactionMqtt()` | React via MQTT | `api.setMessageReactionMqtt('👍', messageID)` |
| `pinMessage()` | Pin a message | `api.pinMessage(messageID)` |
| `OldMessage()` | Legacy HTTP send fallback | `api.OldMessage(msg, threadID)` |

## Thread/Chat Methods

| Method | Description | Example |
|--------|-------------|---------|
| `getThreadList()` | Get list of chats | `api.getThreadList(20, null, [], callback)` |
| `getThreadInfo()` | Get chat information | `api.getThreadInfo(threadID, callback)` |
| `getThreadHistory()` | Get message history | `api.getThreadHistory(threadID, 50, null, callback)` |
| `getThreadPictures()` | Get shared pictures | `api.getThreadPictures(threadID, 0, 10, callback)` |
| `searchForThread()` | Search for chats | `api.searchForThread('name', callback)` |
| `setTitle()` **[LS]** | Change the group name | `api.setTitle('New Name', threadID)` |
| `changeThreadColor()` | Change chat color | `api.changeThreadColor('#ff0000', threadID)` |
| `changeThreadEmoji()` **[LS]** | Change chat emoji | `api.changeThreadEmoji('🎉', threadID)` |
| `changeArchivedStatus()` | Archive/unarchive chat | `api.changeArchivedStatus(threadID, true)` |
| `muteThread()` **[LS]** | Mute/unmute chat — timed mutes and unmute take the native task; permanent mute (`-1`) uses the web endpoint | `api.muteThread(threadID, 3600)` |
| `deleteThread()` **[LS]** | Delete chat | `api.deleteThread(threadID)` |
| `changeNickname()` **[LS]** | Change a member's nickname | `api.changeNickname('Nick', threadID, userID)` |

## Group Management

| Method | Description | Example |
|--------|-------------|---------|
| `createNewGroup()` **[LS]** | Create a new group (returns the real thread id from the task ack) | `api.createNewGroup([id1, id2], 'Name', callback)` |
| `addUserToGroup()` **[LS]** | Add a user to a group | `api.addUserToGroup(userID, threadID)` |
| `removeUserFromGroup()` **[LS]** | Remove a user from a group | `api.removeUserFromGroup(userID, threadID)` |
| `changeAdminStatus()` **[LS]** | Promote/demote admins | `api.changeAdminStatus(threadID, userID, true)` |
| `changeGroupImage()` **[LS]** | Change the group picture | `api.changeGroupImage(stream, threadID)` |
| `handleMessageRequest()` **[LS]** | Accept/decline a message request (accept takes the native task) | `api.handleMessageRequest(threadID, true)` |

## User Methods

| Method | Description | Example |
|--------|-------------|---------|
| `getUserInfo()` | Get user information | `api.getUserInfo(userID, callback)` |
| `getCurrentUserID()` | Get the bot's user ID | `api.getCurrentUserID()` |
| `getUserID()` | Resolve a user ID from a profile link (fully local) | `api.getUserID('https://facebook.com/username', callback)` |
| `getAvatarUser()` | Get a user's avatar URL | `api.getAvatarUser(userID, callback)` |
| `getDeviceIdentifiers()` | Stable device identity `{ deviceID, familyDeviceID, machineID }` | `api.getDeviceIdentifiers()` |
| `changeUsername()` | Change username | `api.changeUsername('new_username')` |
| `changeBio()` | Change bio | `api.changeBio('New bio')` |
| `changeAvatar()` | Change profile picture | `api.changeAvatar(stream)` |
| `changeAvatarV2()` | Change avatar (updated flow) | `api.changeAvatarV2(imageURL, caption)` |
| `changeCover()` | Change cover photo | `api.changeCover(stream)` |
| `changeName()` | Change display name | `api.changeName('New Name')` |
| `setProfileGuard()` | Enable/disable profile guard | `api.setProfileGuard(true)` |
| `setProfileLock()` | Enable/disable profile lock | `api.setProfileLock(true)` |

## Friends & Social

| Method | Description | Example |
|--------|-------------|---------|
| `getFriendsList()` | Get the friends list | `api.getFriendsList(callback)` |
| `handleFriendRequest()` | Accept/decline a friend request | `api.handleFriendRequest(userID, true)` |
| `sendFriendRequest()` | Send a friend request | `api.sendFriendRequest(userID)` |
| `follow()` | Follow a user | `api.follow(userID)` |
| `unfriend()` | Remove a friend | `api.unfriend(userID)` |
| `changeBlockedStatus()` | Block/unblock a user | `api.changeBlockedStatus(userID, true)` |
| `changeBlockedStatusMqtt()` | Block/unblock via MQTT | `api.changeBlockedStatusMqtt(userID, true)` |

## Posts & Social Media

| Method | Description | Example |
|--------|-------------|---------|
| `createPost()` | Create a Facebook post | `api.createPost('Hello!', callback)` |
| `createPoll()` **[LS]** | Create a poll in a group | `api.createPoll('Question?', threadID, options)` |
| `votePoll()` **[LS]** | Vote on a poll (option ids from the poll message data) | `api.votePoll(threadID, pollID, [optionId], callback)` |
| `setPostReaction()` | React to a post | `api.setPostReaction(postID, 'LOVE')` |
| `setStoryReaction()` | React to a story | `api.setStoryReaction(storyID, 'LOVE')` |
| `sendComment()` | Comment on a post | `api.sendComment('Great!', postID)` |
| `createCommentPost()` | Create a comment post | `api.createCommentPost('Comment', postID)` |

## File & Media Methods

| Method | Description | Example |
|--------|-------------|---------|
| `uploadAttachment()` | Upload a file | `api.uploadAttachment(stream, callback)` |
| `forwardAttachment()` | Forward an attachment | `api.forwardAttachment(attachmentID, threadID)` |
| `shareContact()` | Share a contact | `api.shareContact('Message', userID, threadID)` |
| `shareLink()` | Share a link | `api.shareLink('https://example.com', threadID)` |
| `resolvePhotoUrl()` | Resolve a photo URL | `api.resolvePhotoUrl(photoID, callback)` |

## Search Methods

| Method | Description | Example |
|--------|-------------|---------|
| `searchStickers()` | Search stickers | `api.searchStickers('happy', callback)` |
| `getEmojiUrl()` | Get an emoji image URL | `api.getEmojiUrl('😍', 'large', callback)` |
| `searchFriends()` | Search friends | `api.searchFriends('query', callback)` |

## HTTP Methods

| Method | Description | Example |
|--------|-------------|---------|
| `httpGet()` | HTTP GET request | `api.httpGet(url, {}, {}, callback)` |
| `httpPost()` | HTTP POST request | `api.httpPost(url, data, {}, callback)` |
| `httpPostFormData()` | POST form data | `api.httpPostFormData(url, formData, {}, callback)` |

## Listening & Realtime

| Method | Description | Example |
|--------|-------------|---------|
| `listen()` | Listen to all events (alias of `listenMqtt`) | `api.listen(callback)` |
| `listenMqtt()` | MQTT listener | `api.listenMqtt(callback)` |
| `stopListenMqtt()` / `stopListening()` | Stop the MQTT listener | `api.stopListening(cb)` |
| `listenNotification()` | HTTP notification polling (legacy; prefer `listenRealtime`) | `api.listenNotification(callback)` |
| `listenRealtime()` | WebSocket notifications | `api.listenRealtime(callback)` |
| `sendTypingIndicator()` | Show/stop the typing indicator | `api.sendTypingIndicator(threadID, true)` |
| `autoTyping()` | Toggle automatic typing before sends | `api.autoTyping(true)` |

## Configuration & Runtime

| Method | Description | Example |
|--------|-------------|---------|
| `setOptions()` / `getOptions()` | Set/read API options | `api.setOptions({ listenEvents: true })` |
| `getCtx()` | Get the internal context | `api.getCtx()` |
| `getAccess()` | Get access info | `api.getAccess()` |
| `getBotInitialData()` | Get initial data | `api.getBotInitialData()` |
| `getRegion()` | Get the current region | `api.getRegion(callback)` |
| `refreshFb_dtsg()` | Refresh the security token | `api.refreshFb_dtsg(callback)` |
| `setFastSend()` / `setParallelSend()` / `enableGroupQueue()` / `setGroupQueueCapacity()` | Delivery queue control | `api.setParallelSend(3)` |
| `setEditOptions()` / `setBackoffOptions()` / `enableLazyPreflight()` | Engine tuning | `api.setEditOptions({ maxPendingEdits: 200 })` |
| `setListenerOptions()` / `getListenerOptions()` | Live listener options | `api.setListenerOptions({ autoMarkRead: true })` |
| `getHealthMetrics()` / `getMemoryMetrics()` | Observability | `api.getHealthMetrics()` |
| `getLatestDocIDs()` | GraphQL doc-id registry | `utils.getLatestDocIDs(api)` |

## Security & Session

| Method | Description | Example |
|--------|-------------|---------|
| `logout()` | Logout (blocked by the anti-logout guard; use `forceLogout()` deliberately) | `api.logout(callback)` |
| `forceLogout()` | Deliberate logout bypassing the guard | `api.forceLogout()` |
| `getAppState()` | Get the session appstate (deduped) | `api.getAppState()` |
| `saveSession()` / `sessionGuard()` | Persist/protect the session | `api.saveSession(path)` |
| `connectE2EE()` / `getE2EEBridge()` / `getE2EEDeviceData()` | Opt-in E2EE bridge (beta) | `api.connectE2EE(cb)` |

## UI Customization

| Method | Description | Example |
|--------|-------------|---------|
| `threadColors()` | Get available colors | `api.threadColors(callback)` |
| `getThreadTheme()` / `setThreadTheme()` | Read/apply thread themes | `api.setThreadTheme(threadID, themeFBID)` |
| `note.*` | Messenger Notes (Rich Status) management | `api.note.check(callback)` |

---

## Message Object Properties

```javascript
const message = {
    body: 'Text message',                    // Plain text
    attachment: fs.createReadStream('file'), // File attachment
    url: 'https://example.com',              // Share URL
    sticker: stickerID,                      // Sticker ID
    emoji: '😍',                             // Large emoji
    emojiSize: 'large',                      // small/medium/large
    mentions: [{                             // Mention users
        tag: '@User',
        id: userID
    }],
    location: {                              // Share location
        latitude: 37.7749,
        longitude: -122.4194,
        current: true
    }
};

api.sendMessage(message, threadID);
```

## Event Types

| Event Type | Description | Key Properties |
|------------|-------------|----------------|
| `message` | New message received | `body`, `senderID`, `threadID`, `attachments`, `mentions` |
| `event` | Group events | `logMessageType`, `logMessageData` |
| `typ` | Typing indicator | `from`, `threadID`, `isTyping` |
| `read_receipt` | Message read | `reader`, `threadID`, `time` |
| `delivery_receipt` | Message delivered | `deliveredTo`, `threadID` |
| `presence` | Presence updates | `userID`, `timestamp`, `statuses` |

## Options Configuration

```javascript
api.setOptions({
    listenEvents: true,        // Enable event listening
    autoMarkRead: true,        // Auto mark as read
    autoMarkDelivery: true,    // Auto mark as delivered
    selfListen: false,         // Don't listen to own messages
    forceLogin: true,          // Force login if expired
    online: true,              // Show as online
    updatePresence: true,      // Update presence
    userAgent: 'Custom UA'     // Custom user agent
});
```

## Post Reaction Types

`LIKE`, `LOVE`, `WOW`, `HAHA`, `SAD`, `ANGRY`

## Best Practices

1. Prefer the native MQTT paths (`sendMessage`, `sendMessageMqtt`) — they are the default delivery channel, with the web chain as automatic fallback.
2. Handle errors in every callback; structured `err.type` fields are stable for automation logic.
3. Persist the appstate (`appStatePath`) so refreshed cookies survive restarts; enable the Session Vault for ephemeral hosts.
4. Use environment variables for secrets — never hard-code credentials.
5. Enable `listenEvents` when group events are needed.
6. Use `sendTypingIndicator` (or leave `autoTyping` enabled) before sending messages.
7. Monitor `getHealthMetrics()` periodically instead of forcing reconnects.

---

For detailed examples and usage, see `COMPLETE-API-DOCS.md` and `USAGE-GUIDE.md`.
