# 📋 Nexus-FCA Methods Quick Reference

## 🔐 Login Methods
| Method | Description | Example |
|--------|-------------|---------|
| `nexusLogin()` | Advanced login with ID/pass/2FA | `await nexusLogin({username, password, twofactor})` |
| `login()` | Traditional login | `login({email, password}, callback)` |

## 💬 Message Methods
| Method | Description | Example |
|--------|-------------|---------|
| `sendMessage()` | Send text/media message | `api.sendMessage('Hello!', threadID)` |
| `sendMessageMqtt()` | Send message via MQTT (faster) | `api.sendMessageMqtt('Hi!', threadID, [replyID])` |
| `editMessage()` | Edit existing message | `api.editMessage('New text', messageID)` |
| `unsendMessage()` | Delete/unsend message | `api.unsendMessage(messageID)` |
| `markAsRead()` | Mark messages as read | `api.markAsRead(threadID)` |
| `markAsDelivered()` | Mark as delivered | `api.markAsDelivered(threadID)` |
| `markAsReadAll()` | Mark all threads as read | `api.markAsReadAll()` |
| `markAsSeen()` | Mark as seen | `api.markAsSeen()` |
| `setMessageReaction()` | React to message | `api.setMessageReaction('😍', messageID)` |
| `setMessageReactionMqtt()` | React via MQTT | `api.setMessageReactionMqtt('👍', messageID)` |
| `pinMessage()` | Pin message in chat | `api.pinMessage(messageID)` |

## 📁 Thread/Chat Methods
| Method | Description | Example |
|--------|-------------|---------|
| `getThreadList()` | Get list of chats | `api.getThreadList(20, null, [], callback)` |
| `getThreadInfo()` | Get chat information | `api.getThreadInfo(threadID, callback)` |
| `getThreadHistory()` | Get message history | `api.getThreadHistory(threadID, 50, null, callback)` |
| `getThreadPictures()` | Get shared pictures | `api.getThreadPictures(threadID, 0, 10, callback)` |
| `searchForThread()` | Search for chats | `api.searchForThread('name', callback)` |
| `setTitle()` | Change chat name | `api.setTitle('New Name', threadID)` |
| `changeThreadColor()` | Change chat color | `api.changeThreadColor('#ff0000', threadID)` |
| `changeThreadEmoji()` | Change chat emoji | `api.changeThreadEmoji('🎉', threadID)` |
| `changeArchivedStatus()` | Archive/unarchive chat | `api.changeArchivedStatus(threadID, true)` |
| `muteThread()` | Mute/unmute chat | `api.muteThread(threadID, 3600)` |
| `deleteThread()` | Delete chat | `api.deleteThread(threadID)` |

## 👥 Group Management
| Method | Description | Example |
|--------|-------------|---------|
| `createNewGroup()` | Create new group | `api.createNewGroup([userID1, userID2], 'Name', callback)` |
| `addUserToGroup()` | Add user to group | `api.addUserToGroup(userID, threadID)` |
| `removeUserFromGroup()` | Remove user from group | `api.removeUserFromGroup(userID, threadID)` |
| `changeAdminStatus()` | Make/remove admin | `api.changeAdminStatus(threadID, userID, true)` |
| `changeGroupImage()` | Change group picture | `api.changeGroupImage(stream, threadID)` |

## 👤 User Methods
| Method | Description | Example |
|--------|-------------|---------|
| `getUserInfo()` | Get user information | `api.getUserInfo(userID, callback)` |
| `getCurrentUserID()` | Get bot's user ID | `const myID = api.getCurrentUserID()` |
| `getUserID()` | Get user ID by username | `api.getUserID('username', callback)` |
| `getAvatarUser()` | Get user avatar URL | `api.getAvatarUser(userID, callback)` |
| `changeUsername()` | Change username | `api.changeUsername('new_username')` |
| `changeBio()` | Change bio | `api.changeBio('New bio')` |
| `changeAvatar()` | Change profile picture | `api.changeAvatar(stream)` |
| `changeAvatarV2()` | Change avatar (enhanced) | `api.changeAvatarV2(stream)` |
| `changeCover()` | Change cover photo | `api.changeCover(stream)` |
| `changeName()` | Change display name | `api.changeName('New Name')` |
| `changeNickname()` | Change nickname in chat | `api.changeNickname('Nick', threadID, userID)` |
| `setProfileGuard()` | Enable/disable profile guard | `api.setProfileGuard(true)` |

## 👥 Friends & Social
| Method | Description | Example |
|--------|-------------|---------|
| `getFriendsList()` | Get friends list | `api.getFriendsList(callback)` |
| `handleFriendRequest()` | Accept/decline friend request | `api.handleFriendRequest(userID, true)` |
| `follow()` | Send friend request/follow | `api.follow(userID)` |
| `unfriend()` | Remove friend | `api.unfriend(userID)` |
| `handleMessageRequest()` | Accept/decline message request | `api.handleMessageRequest(threadID, true)` |
| `changeBlockedStatus()` | Block/unblock user | `api.changeBlockedStatus(userID, true)` |
| `changeBlockedStatusMqtt()` | Block/unblock via MQTT | `api.changeBlockedStatusMqtt(userID, true)` |

## 📱 Posts & Social Media
| Method | Description | Example |
|--------|-------------|---------|
| `createPost()` | Create Facebook post | `api.createPost('Hello Facebook!', callback)` |
| `createPoll()` | Create poll in group | `api.createPoll('Question?', ['A', 'B'], threadID)` |
| `setPostReaction()` | React to post | `api.setPostReaction(postID, 'LOVE')` |
| `setStoryReaction()` | React to story | `api.setStoryReaction(storyID, 'LOVE')` |
| `sendComment()` | Comment on post | `api.sendComment('Great!', postID)` |
| `createCommentPost()` | Create comment post | `api.createCommentPost('Comment', postID)` |

## 📎 File & Media Methods
| Method | Description | Example |
|--------|-------------|---------|
| `uploadAttachment()` | Upload file | `api.uploadAttachment(stream, callback)` |
| `forwardAttachment()` | Forward attachment | `api.forwardAttachment(attachmentID, threadID)` |
| `shareContact()` | Share contact | `api.shareContact('Message', userID, threadID)` |
| `shareLink()` | Share link | `api.shareLink('https://example.com', threadID)` |
| `resolvePhotoUrl()` | Get photo URL | `api.resolvePhotoUrl(photoID, callback)` |

## 🔍 Search Methods
| Method | Description | Example |
|--------|-------------|---------|
| `searchStickers()` | Search stickers | `api.searchStickers('happy', callback)` |
| `getEmojiUrl()` | Get emoji image URL | `api.getEmojiUrl('😍', 'large', callback)` |

## 🌐 HTTP Methods
| Method | Description | Example |
|--------|-------------|---------|
| `httpGet()` | HTTP GET request | `api.httpGet(url, {}, {}, callback)` |
| `httpPost()` | HTTP POST request | `api.httpPost(url, data, {}, callback)` |
| `httpPostFormData()` | POST form data | `api.httpPostFormData(url, formData, {}, callback)` |

## 🔧 Advanced Features
| Method | Description | Example |
|--------|-------------|---------|
| `listenMqtt()` | Listen via MQTT | `api.listenMqtt(callback)` |
| `stopListenMqtt()` | Stop MQTT listening | `api.stopListenMqtt()` |
| `listenNotification()` | Listen to notifications | `api.listenNotification(callback)` |
| `sendTypingIndicator()` | Show typing indicator | `api.sendTypingIndicator(threadID)` |
| `listen()` | Listen to all events | `api.listen(callback)` |

## ⚙️ Configuration
| Method | Description | Example |
|--------|-------------|---------|
| `setOptions()` | Set API options | `api.setOptions({listenEvents: true})` |
| `getOptions()` | Get current options | `const opts = api.getOptions()` |
| `getCtx()` | Get bot context | `const ctx = api.getCtx()` |
| `getAccess()` | Get access info | `const access = api.getAccess()` |
| `getBotInitialData()` | Get initial data | `const data = api.getBotInitialData()` |
| `getRegion()` | Get current region | `api.getRegion(callback)` |
| `refreshFb_dtsg()` | Refresh security token | `api.refreshFb_dtsg(callback)` |

## 🔐 Security & Session
| Method | Description | Example |
|--------|-------------|---------|
| `logout()` | Logout properly | `api.logout(callback)` |
| `getAppState()` | Get session appstate | `const appstate = api.getAppState()` |

## 🎨 UI Customization
| Method | Description | Example |
|--------|-------------|---------|
| `threadColors()` | Get available colors | `api.threadColors(callback)` |

---

## 🚀 Message Properties

### **Message Object Properties**
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

## 🎯 Event Types
| Event Type | Description | Properties |
|------------|-------------|------------|
| `message` | New message received | `body`, `senderID`, `threadID`, `attachments` |
| `event` | Group events | `logMessageType`, `logMessageData` |
| `typ` | Typing indicator | `from`, `threadID`, `isTyping` |
| `read_receipt` | Message read | `reader`, `threadID`, `time` |
| `delivery_receipt` | Message delivered | `deliveredTo`, `threadID` |

## 🛠️ Options Configuration
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

## 🎪 Post Reaction Types
- `LIKE` - 👍 Like
- `LOVE` - ❤️ Love  
- `WOW` - 😮 Wow
- `HAHA` - 😆 Haha
- `SAD` - 😢 Sad
- `ANGRY` - 😠 Angry

## 💎 Pro Tips
1. **Use MQTT methods** (`sendMessageMqtt`, `setMessageReactionMqtt`) for faster performance
2. **Always handle errors** in callbacks and try-catch blocks
3. **Save appstate** regularly for session persistence
4. **Use environment variables** for credentials
5. **Enable `listenEvents`** for real-time functionality
6. **Set `autoMarkRead`** to appear more human-like
7. **Use `sendTypingIndicator`** before sending messages

---

**📚 For detailed examples and usage, see `COMPLETE-API-DOCS.md`**
