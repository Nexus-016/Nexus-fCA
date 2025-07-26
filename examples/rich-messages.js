const login = require('../index');
const { MessageBuilder } = require('../lib/message/EnhancedMessageHandler');
const fs = require('fs');

// Example demonstrating rich message features
async function richMessageBot() {
    try {
        const api = await login({
            // Your login credentials here
            appstate: JSON.parse(fs.readFileSync('appstate.json', 'utf8'))
        });

        console.log('Rich message bot started!');

        api.listen((err, message) => {
            if (err) {
                console.error('Listen error:', err);
                return;
            }

            handleMessage(api, message);
        });

    } catch (error) {
        console.error('Login failed:', error);
    }
}

async function handleMessage(api, message) {
    if (!message.body) return;

    const command = message.body.toLowerCase().trim();

    switch (command) {
        case '/rich':
            await sendRichMessage(api, message.threadID);
            break;

        case '/photo':
            await sendPhotoMessage(api, message.threadID);
            break;

        case '/mention':
            await sendMentionMessage(api, message);
            break;

        case '/reply':
            await sendReplyMessage(api, message);
            break;

        case '/sticker':
            await sendStickerMessage(api, message.threadID);
            break;

        case '/attachment':
            await sendAttachmentMessage(api, message.threadID);
            break;

        case '/builder':
            await sendBuilderMessage(api, message.threadID);
            break;

        case '/poll':
            await sendPollMessage(api, message.threadID);
            break;
    }
}

// Send a rich formatted message
async function sendRichMessage(api, threadID) {
    const richText = `🌟 **Welcome to Rich Messages!** 🌟

📋 **Available Features:**
• Bold and italic text
• Emoji support 😊
• Multiple lines
• Links: https://github.com

💡 **Tips:**
1. Use /photo for image messages
2. Use /mention to mention users
3. Use /sticker for stickers

🎯 **Try these commands:**
• /photo - Send a photo
• /mention - Mention someone
• /reply - Reply to messages
• /sticker - Send a sticker
• /attachment - Send files
• /builder - Use message builder
• /poll - Create a poll

Happy messaging! ✨`;

    await api.sendMessage(richText, threadID);
}

// Send a photo message
async function sendPhotoMessage(api, threadID) {
    try {
        // You can use URL or local file path
        const photoUrl = 'https://picsum.photos/800/600';
        
        const message = {
            body: '📸 Here\'s a beautiful random photo for you!',
            attachment: [photoUrl]
        };

        await api.sendMessage(message, threadID);
    } catch (error) {
        await api.sendMessage('❌ Failed to send photo.', threadID);
    }
}

// Send a message with mentions
async function sendMentionMessage(api, message) {
    try {
        // Get thread info to find participants
        const threadInfo = await api.getThreadInfo(message.threadID);
        const participants = threadInfo.participantIDs.slice(0, 3); // Mention first 3 users

        if (participants.length === 0) {
            return api.sendMessage('No users to mention!', message.threadID);
        }

        // Get user info for names
        const userInfo = await api.getUserInfo(participants);
        
        let mentionText = '👋 Hello ';
        const mentions = [];
        let offset = mentionText.length;

        participants.forEach((userID, index) => {
            const user = userInfo[userID];
            const name = user ? user.name : 'Unknown User';
            
            if (index > 0) {
                mentionText += ', ';
                offset += 2;
            }
            
            mentions.push({
                id: userID,
                name: name,
                offset: offset,
                length: name.length
            });
            
            mentionText += name;
            offset += name.length;
        });

        mentionText += '! 🎉\n\nYou have been mentioned in this message!';

        const mentionMessage = {
            body: mentionText,
            mentions: mentions
        };

        await api.sendMessage(mentionMessage, message.threadID);
    } catch (error) {
        await api.sendMessage('❌ Failed to send mention message.', message.threadID);
    }
}

// Send a reply message
async function sendReplyMessage(api, message) {
    const replyMessage = {
        body: '💬 This is a reply to your message!\n\nReplies help maintain conversation context.',
        replyToMessage: message.messageID
    };

    await api.sendMessage(replyMessage, message.threadID);
}

// Send a sticker
async function sendStickerMessage(api, threadID) {
    try {
        // Facebook sticker ID (this is a thumbs up sticker)
        const stickerMessage = {
            sticker: '369239263222822'
        };

        await api.sendMessage(stickerMessage, threadID);
        
        // Follow up with explanation
        await api.sendMessage('👍 That was a sticker! You can send stickers using their ID.', threadID);
    } catch (error) {
        await api.sendMessage('❌ Failed to send sticker.', threadID);
    }
}

// Send file attachment
async function sendAttachmentMessage(api, threadID) {
    try {
        // Create a sample text file
        const fileName = 'sample.txt';
        const fileContent = `Hello from Nexus-FCA!

This is a sample text file created by the bot.
Date: ${new Date().toISOString()}

Features demonstrated:
- File attachment
- Rich text messages
- Multiple message types

Visit: https://github.com/example/nexus-fca`;

        fs.writeFileSync(fileName, fileContent);

        const message = {
            body: '📁 Here\'s a sample file attachment!',
            attachment: fs.createReadStream(fileName)
        };

        await api.sendMessage(message, threadID);

        // Clean up
        setTimeout(() => {
            if (fs.existsSync(fileName)) {
                fs.unlinkSync(fileName);
            }
        }, 5000);

    } catch (error) {
        await api.sendMessage('❌ Failed to send attachment.', threadID);
    }
}

// Use message builder
async function sendBuilderMessage(api, threadID) {
    try {
        // Using the enhanced message builder
        const builder = new MessageBuilder(api);

        await builder
            .text('🔧 **Message Builder Demo**\n\nThis message was created using the MessageBuilder class!')
            .send(threadID);

        // Send another message with multiple features
        const complexMessage = builder
            .text('🎨 **Complex Message**\n\nFeatures:')
            .build();

        complexMessage.body += '\n• Rich text formatting\n• Multiple attachments support\n• Mention capabilities\n• Sticker support';

        await api.sendMessage(complexMessage, threadID);

    } catch (error) {
        await api.sendMessage('❌ Failed to use message builder.', threadID);
    }
}

// Create a poll (if supported)
async function sendPollMessage(api, threadID) {
    try {
        // Note: This is a conceptual example - Facebook may not support polls in all contexts
        const pollMessage = {
            body: '📊 **Quick Poll**\n\nWhat\'s your favorite programming language?\n\nReact with:\n🐍 for Python\n☕ for Java\n⚡ for JavaScript\n💎 for Ruby\n🦀 for Rust',
        };

        const sentMessage = await api.sendMessage(pollMessage, threadID);

        // Add reaction options
        const reactions = ['🐍', '☕', '⚡', '💎', '🦀'];
        
        for (const reaction of reactions) {
            setTimeout(async () => {
                try {
                    await api.setMessageReaction(reaction, sentMessage.messageID);
                } catch (error) {
                    console.log('Failed to add reaction:', error);
                }
            }, 1000);
        }

    } catch (error) {
        await api.sendMessage('❌ Failed to create poll.', threadID);
    }
}

// Auto-react to messages
function setupAutoReactions(api) {
    const reactionKeywords = {
        'love': '❤️',
        'like': '👍',
        'dislike': '👎',
        'laugh': '😂',
        'wow': '😮',
        'sad': '😢',
        'angry': '😠',
        'thanks': '🙏',
        'congrats': '🎉',
        'fire': '🔥'
    };

    return (message) => {
        if (!message.body) return;

        const text = message.body.toLowerCase();
        
        for (const [keyword, emoji] of Object.entries(reactionKeywords)) {
            if (text.includes(keyword)) {
                setTimeout(() => {
                    api.setMessageReaction(emoji, message.messageID).catch(console.error);
                }, 1000);
                break; // Only react with the first matching emoji
            }
        }
    };
}

// Run the bot
if (require.main === module) {
    richMessageBot();
}

module.exports = richMessageBot;
