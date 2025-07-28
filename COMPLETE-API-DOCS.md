# 📚 Nexus-FCA Complete API Documentation

> **Complete guide for all Nexus-FCA methods, functions, and features**

---

## 🚀 Quick Start

### **Installation & Basic Setup**
```bash
npm install nexus-fca
```

```javascript
const { nexusLogin } = require('nexus-fca');

// Login and get API
const result = await nexusLogin({
    username: 'your_email@gmail.com',
    password: 'your_password',
    twofactor: 'YOUR2FASECRET' // Optional
});

if (result.success) {
    const api = result.api;
    // Now use any method below
}
```

---

## 🔐 Login Methods

### **1. Nexus Login (Recommended)**
```javascript
const { nexusLogin } = require('nexus-fca');

// ID/Password login
const result = await nexusLogin({
    username: 'email@gmail.com',
    password: 'password'
});

// With 2FA secret
const result = await nexusLogin({
    username: 'email@gmail.com',
    password: 'password',
    twofactor: 'YOUR32CHAR2FASECRET'
});

// With manual 2FA code
const result = await nexusLogin({
    username: 'email@gmail.com',
    password: 'password',
    _2fa: '123456'
});

// With existing appstate
const result = await nexusLogin({
    appstate: require('./appstate.json')
});
```

### **2. Traditional Login**
```javascript
const login = require('nexus-fca');

// Callback style
login({email: 'email@gmail.com', password: 'password'}, (err, api) => {
    if (err) return console.error(err);
    // Use api
});

// Promise style
const api = await new Promise((resolve, reject) => {
    login({email: 'email@gmail.com', password: 'password'}, (err, api) => {
        if (err) reject(err);
        else resolve(api);
    });
});
```

---

## 💬 Message Methods

### **Send Message**
```javascript
// Simple text message
api.sendMessage('Hello World!', threadID);

// With callback
api.sendMessage('Hello!', threadID, (err, messageInfo) => {
    if (err) console.error(err);
    else console.log('Message sent:', messageInfo.messageID);
});

// Advanced message with attachments
const fs = require('fs');
api.sendMessage({
    body: 'Check this image!',
    attachment: fs.createReadStream('./image.jpg')
}, threadID);

// Message with mentions
api.sendMessage({
    body: 'Hello @User!',
    mentions: [{
        tag: '@User',
        id: userID
    }]
}, threadID);

// Message with sticker
api.sendMessage({
    sticker: stickerID
}, threadID);

// Message with emoji (large)
api.sendMessage({
    emoji: '😍',
    emojiSize: 'large'
}, threadID);

// Message with URL
api.sendMessage({
    url: 'https://example.com'
}, threadID);

// Message with location
api.sendMessage({
    location: {
        latitude: 37.7749,
        longitude: -122.4194,
        current: true
    }
}, threadID);
```

### **Send Message MQTT (Faster)**
```javascript
// Same syntax as sendMessage but faster
api.sendMessageMqtt('Hello via MQTT!', threadID);

api.sendMessageMqtt({
    body: 'Fast message!',
    attachment: fs.createReadStream('./file.pdf')
}, threadID);
```

### **Message Management**
```javascript
// Edit message
api.editMessage('New message text', messageID);

// Unsend/delete message
api.unsendMessage(messageID);

// Mark as read
api.markAsRead(threadID);

// Mark as delivered
api.markAsDelivered(threadID);

// Mark all as read
api.markAsReadAll();

// Mark as seen
api.markAsSeen();

// Set message reaction
api.setMessageReaction('😍', messageID);

// Set message reaction MQTT
api.setMessageReactionMqtt('👍', messageID);

// Pin message
api.pinMessage(messageID);
```

---

## 📁 Thread/Chat Methods

### **Get Thread Information**
```javascript
// Get thread list
api.getThreadList(20, null, [], (err, list) => {
    if (err) return console.error(err);
    list.forEach(thread => {
        console.log(`${thread.name}: ${thread.threadID}`);
    });
});

// Get specific thread info
api.getThreadInfo(threadID, (err, info) => {
    if (err) return console.error(err);
    console.log('Thread name:', info.threadName);
    console.log('Participants:', info.participantIDs);
});

// Get thread history/messages
api.getThreadHistory(threadID, 50, null, (err, history) => {
    if (err) return console.error(err);
    history.forEach(message => {
        console.log(`${message.senderName}: ${message.body}`);
    });
});

// Get thread pictures
api.getThreadPictures(threadID, 0, 10, (err, pictures) => {
    if (err) return console.error(err);
    pictures.forEach(pic => {
        console.log('Image URL:', pic.url);
    });
});

// Search for threads
api.searchForThread('thread name', (err, results) => {
    if (err) return console.error(err);
    results.forEach(thread => {
        console.log(`Found: ${thread.name} (${thread.threadID})`);
    });
});
```

### **Thread Management**
```javascript
// Change thread name
api.setTitle('New Group Name', threadID);

// Change thread color
api.changeThreadColor('#ff0000', threadID); // Red color

// Change thread emoji
api.changeThreadEmoji('🎉', threadID);

// Archive/unarchive thread
api.changeArchivedStatus(threadID, true); // Archive
api.changeArchivedStatus(threadID, false); // Unarchive

// Mute/unmute thread
api.muteThread(threadID, 3600); // Mute for 1 hour (in seconds)
api.muteThread(threadID, 0); // Unmute

// Delete thread
api.deleteThread(threadID);
```

---

## 👥 Group Management

### **Create Group**
```javascript
// Create new group
api.createNewGroup([userID1, userID2, userID3], 'Group Name', (err, groupInfo) => {
    if (err) return console.error(err);
    console.log('Group created:', groupInfo.threadID);
});
```

### **Group Members**
```javascript
// Add user to group
api.addUserToGroup(userID, threadID);

// Remove user from group
api.removeUserFromGroup(userID, threadID);

// Change admin status
api.changeAdminStatus(threadID, userID, true); // Make admin
api.changeAdminStatus(threadID, userID, false); // Remove admin

// Change group image
const fs = require('fs');
api.changeGroupImage(fs.createReadStream('./group-image.jpg'), threadID);
```

---

## 👤 User Methods

### **Get User Information**
```javascript
// Get user info
api.getUserInfo(userID, (err, info) => {
    if (err) return console.error(err);
    console.log('Name:', info[userID].name);
    console.log('Profile URL:', info[userID].profileUrl);
    console.log('Avatar:', info[userID].thumbSrc);
});

// Get current user ID
const myUserID = api.getCurrentUserID();

// Get user ID from username
api.getUserID('username', (err, data) => {
    if (err) return console.error(err);
    console.log('User ID:', data[0].userID);
});

// Get avatar URL
api.getAvatarUser(userID, (err, avatarUrl) => {
    if (err) return console.error(err);
    console.log('Avatar URL:', avatarUrl);
});
```

### **User Profile Management**
```javascript
// Change username
api.changeUsername('new_username');

// Change bio
api.changeBio('New bio text');

// Change avatar
const fs = require('fs');
api.changeAvatar(fs.createReadStream('./avatar.jpg'));

// Change avatar V2 (enhanced)
api.changeAvatarV2(fs.createReadStream('./avatar.jpg'));

// Change cover photo
api.changeCover(fs.createReadStream('./cover.jpg'));

// Change name
api.changeName('New Display Name');

// Change nickname
api.changeNickname('New Nickname', threadID, userID);

// Set profile guard
api.setProfileGuard(true); // Enable profile guard
```

---

## 👥 Friends & Social

### **Friends Management**
```javascript
// Get friends list
api.getFriendsList((err, friends) => {
    if (err) return console.error(err);
    friends.forEach(friend => {
        console.log(`${friend.name} (${friend.userID})`);
    });
});

// Handle friend request
api.handleFriendRequest(userID, true); // Accept
api.handleFriendRequest(userID, false); // Decline

// Send friend request / Follow user
api.follow(userID);

// Unfriend user
api.unfriend(userID);

// Handle message request
api.handleMessageRequest(threadID, true); // Accept
api.handleMessageRequest(threadID, false); // Decline

// Block/unblock user
api.changeBlockedStatus(userID, true); // Block
api.changeBlockedStatus(userID, false); // Unblock

// Block/unblock user MQTT
api.changeBlockedStatusMqtt(userID, true); // Block
api.changeBlockedStatusMqtt(userID, false); // Unblock
```

---

## 📱 Posts & Social Media

### **Posts Management**
```javascript
// Create post
api.createPost('Hello Facebook!', (err, postInfo) => {
    if (err) return console.error(err);
    console.log('Post created:', postInfo.postID);
});

// Create post with image
const fs = require('fs');
api.createPost({
    text: 'Check out this image!',
    attachment: fs.createReadStream('./image.jpg')
});

// Create poll
api.createPoll('What\'s your favorite color?', ['Red', 'Blue', 'Green'], threadID);

// Set post reaction
api.setPostReaction(postID, 'LOVE'); // LOVE, LIKE, WOW, HAHA, SAD, ANGRY

// Set story reaction
api.setStoryReaction(storyID, 'LOVE');

// Send comment
api.sendComment('Great post!', postID);

// Create comment post
api.createCommentPost('This is a comment post', postID);
```

---

## 📎 File & Media Methods

### **Upload & Share**
```javascript
// Upload attachment
const fs = require('fs');
api.uploadAttachment(fs.createReadStream('./file.pdf'), (err, attachment) => {
    if (err) return console.error(err);
    console.log('Uploaded:', attachment);
});

// Forward attachment
api.forwardAttachment(attachmentID, threadID);

// Share contact
api.shareContact('Contact message', userID, threadID);

// Share link
api.shareLink('https://example.com', threadID);

// Resolve photo URL
api.resolvePhotoUrl(photoID, (err, url) => {
    if (err) return console.error(err);
    console.log('Photo URL:', url);
});
```

---

## 🔍 Search Methods

### **Search Functions**
```javascript
// Search stickers
api.searchStickers('happy', (err, stickers) => {
    if (err) return console.error(err);
    stickers.forEach(sticker => {
        console.log('Sticker ID:', sticker.stickerID);
    });
});

// Get emoji URL
api.getEmojiUrl('😍', 'large', (err, url) => {
    if (err) return console.error(err);
    console.log('Emoji URL:', url);
});
```

---

## 🌐 HTTP Methods

### **HTTP Requests**
```javascript
// HTTP GET
api.httpGet('https://api.example.com/data', {}, {}, (err, response) => {
    if (err) return console.error(err);
    console.log('Response:', response.body);
});

// HTTP POST
api.httpPost('https://api.example.com/submit', {data: 'value'}, {}, (err, response) => {
    if (err) return console.error(err);
    console.log('Response:', response.body);
});

// HTTP POST Form Data
const fs = require('fs');
api.httpPostFormData('https://api.example.com/upload', {
    file: fs.createReadStream('./file.txt')
}, {}, (err, response) => {
    if (err) return console.error(err);
    console.log('Upload response:', response.body);
});
```

---

## 🔧 Advanced Features

### **MQTT Listening**
```javascript
// Listen to messages via MQTT (faster)
api.listenMqtt((err, event) => {
    if (err) return console.error(err);
    
    if (event.type === 'message') {
        console.log(`${event.senderName}: ${event.body}`);
        
        // Echo bot example
        if (event.body === '/ping') {
            api.sendMessageMqtt('Pong!', event.threadID);
        }
    }
});

// Stop listening MQTT
api.stopListenMqtt();
```

### **Notifications**
```javascript
// Listen to notifications
api.listenNotification((err, notification) => {
    if (err) return console.error(err);
    console.log('Notification:', notification.type);
});
```

### **Typing Indicator**
```javascript
// Send typing indicator
api.sendTypingIndicator(threadID, (err) => {
    if (err) return console.error(err);
    console.log('Typing indicator sent');
});

// Auto-send typing indicator while typing
api.sendTypingIndicator(threadID);
setTimeout(() => {
    api.sendMessage('Hello after typing!', threadID);
}, 3000);
```

---

## ⚙️ Configuration & Settings

### **API Options**
```javascript
// Set global options
api.setOptions({
    listenEvents: true,      // Listen to events
    autoMarkRead: true,      // Auto mark messages as read
    autoMarkDelivery: true,  // Auto mark messages as delivered
    selfListen: false,       // Don't listen to own messages
    forceLogin: true,        // Force login if session expired
    online: true,            // Show as online
    updatePresence: true,    // Update presence status
    userAgent: 'Custom User Agent'
});

// Get current options
const options = api.getOptions();
console.log('Current options:', options);
```

### **Bot Context & Data**
```javascript
// Get bot context
const ctx = api.getCtx();
console.log('User ID:', ctx.userID);
console.log('Region:', ctx.region);

// Get access token
const access = api.getAccess();
console.log('Access info:', access);

// Get initial bot data
const initialData = api.getBotInitialData();
console.log('Initial data:', initialData);

// Get region
api.getRegion((err, region) => {
    if (err) return console.error(err);
    console.log('Current region:', region);
});

// Refresh fb_dtsg token
api.refreshFb_dtsg((err, newToken) => {
    if (err) return console.error(err);
    console.log('New fb_dtsg:', newToken);
});
```

---

## 🔐 Security & Session

### **Logout & Session Management**
```javascript
// Logout properly
api.logout((err) => {
    if (err) return console.error(err);
    console.log('Logged out successfully');
});

// Get current session appstate
const appstate = api.getAppState();
console.log('Current appstate:', appstate);

// Save appstate for next login
const fs = require('fs');
fs.writeFileSync('./appstate.json', JSON.stringify(appstate, null, 2));
```

---

## 🎨 UI Customization

### **Thread Colors**
```javascript
// Get available thread colors
api.threadColors((err, colors) => {
    if (err) return console.error(err);
    colors.forEach(color => {
        console.log(`${color.name}: ${color.hex}`);
    });
});

// Change thread color
api.changeThreadColor('#FF0000', threadID); // Red
api.changeThreadColor('blue', threadID); // Named color
```

---

## 🔄 Event Listening

### **Complete Event Handler**
```javascript
api.setOptions({ listenEvents: true });

api.listen((err, event) => {
    if (err) return console.error(err);
    
    switch (event.type) {
        case 'message':
            console.log(`Message from ${event.senderName}: ${event.body}`);
            break;
            
        case 'event':
            if (event.logMessageType === 'log:subscribe') {
                console.log(`${event.logMessageData.addedParticipants[0].fullName} joined the group`);
            }
            break;
            
        case 'typ':
            console.log(`${event.from} is typing...`);
            break;
            
        case 'read_receipt':
            console.log(`Message read by ${event.reader}`);
            break;
            
        case 'delivery_receipt':
            console.log(`Message delivered to ${event.deliveredTo.length} users`);
            break;
    }
});
```

---

## 📊 Utility Functions

### **Helper Methods**
```javascript
// Generate unique IDs
const messageID = api.utils.generateOfflineThreadingID();
const threadingID = api.utils.generateThreadingID();

// Format text
const formattedText = api.utils.formatText('Hello World');

// Get message type
const msgType = api.utils.getType(message);

// Check if stream
const isStream = api.utils.isReadableStream(fileStream);
```

---

## 🛡️ Error Handling

### **Best Practices**
```javascript
// Always use try-catch with async methods
try {
    const result = await nexusLogin(credentials);
    if (result.success) {
        const api = result.api;
        
        // Handle API errors
        api.sendMessage('Hello!', threadID, (err, messageInfo) => {
            if (err) {
                console.error('Send message error:', err);
                if (err.error === 'Not logged in.') {
                    // Handle re-login
                    console.log('Need to re-login');
                }
            } else {
                console.log('Message sent successfully');
            }
        });
    }
} catch (error) {
    console.error('Login error:', error.message);
}

// Listen for disconnections
api.listen((err, event) => {
    if (err) {
        if (err.error === 'Connection lost') {
            console.log('Reconnecting...');
            // Implement reconnection logic
        }
    }
});
```

---

## 💡 Complete Example Bot

```javascript
const { nexusLogin } = require('nexus-fca');
const fs = require('fs');

async function startBot() {
    try {
        // Login
        const result = await nexusLogin({
            username: process.env.FB_EMAIL,
            password: process.env.FB_PASSWORD,
            twofactor: process.env.FB_2FA_SECRET
        });
        
        if (!result.success) {
            throw new Error('Login failed: ' + result.message);
        }
        
        const api = result.api;
        console.log('✅ Bot online! User ID:', api.getCurrentUserID());
        
        // Configure API
        api.setOptions({
            listenEvents: true,
            autoMarkRead: true,
            selfListen: false
        });
        
        // Command handler
        const commands = {
            '/help': (api, event) => {
                const helpText = `🤖 Available Commands:
/help - Show this help
/ping - Test bot
/info - Bot information
/avatar [userID] - Get user avatar
/group [name] - Create group
/weather [city] - Get weather (example)`;
                api.sendMessage(helpText, event.threadID);
            },
            
            '/ping': (api, event) => {
                api.sendMessage('🏓 Pong! Bot is working!', event.threadID);
            },
            
            '/info': (api, event) => {
                api.getThreadInfo(event.threadID, (err, info) => {
                    if (err) return api.sendMessage('❌ Error getting info', event.threadID);
                    
                    const infoText = `📊 Thread Info:
Name: ${info.threadName}
Members: ${info.participantIDs.length}
Type: ${info.isGroup ? 'Group' : 'Private'}`;
                    api.sendMessage(infoText, event.threadID);
                });
            },
            
            '/avatar': (api, event) => {
                const userID = event.mentions[0]?.id || event.senderID;
                api.getUserInfo(userID, (err, info) => {
                    if (err) return api.sendMessage('❌ Error getting user info', event.threadID);
                    
                    const user = info[userID];
                    api.sendMessage({
                        body: `👤 ${user.name}'s Avatar:`,
                        url: user.thumbSrc
                    }, event.threadID);
                });
            }
        };
        
        // Message listener
        api.listen((err, event) => {
            if (err) return console.error('Listen error:', err);
            
            if (event.type === 'message' && event.body) {
                const command = event.body.split(' ')[0];
                
                if (commands[command]) {
                    commands[command](api, event);
                }
                
                // Auto-reply example
                if (event.body.toLowerCase().includes('hello bot')) {
                    api.sendMessage('👋 Hello! Type /help for commands', event.threadID);
                }
            }
            
            // Handle group events
            if (event.type === 'event') {
                if (event.logMessageType === 'log:subscribe') {
                    api.sendMessage('👋 Welcome to the group!', event.threadID);
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Bot error:', error.message);
    }
}

startBot();
```

---

## 📖 Additional Resources

- **Main Documentation**: `README.md`
- **NPM Integration**: `npm-integration-guide.md`
- **Login Guide**: `integrated-login-guide.md`
- **Test Examples**: `test-*.js` files
- **Example Bot**: `example-bot.js`

---

**🎉 You now have access to all Nexus-FCA methods and features! Build amazing Facebook bots with confidence!**
