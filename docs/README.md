# Nexus-FCA Documentation

Complete documentation for Nexus-FCA — advanced, hardened, and massive-load-ready Facebook Messenger API.

---

## Documentation Structure

### Core API Reference

Each `.md` file documents a single API method with signature, usage examples, response shapes, and safety notes:

| Document | API |
|----------|-----|
| [sendMessage.md](./sendMessage.md) | `api.sendMessage` |
| [sendMessageMqtt.md](./sendMessageMqtt.md) | MQTT send path |
| [listenMqtt.md](./listenMqtt.md) | `api.listenMqtt` |
| [getUserInfo.md](./getUserInfo.md) | `api.getUserInfo` |
| [getUserID.md](./getUserID.md) | `api.getUserID` |
| [getThreadInfo.md](./getThreadInfo.md) | `api.getThreadInfo` |
| [getThreadList.md](./getThreadList.md) | `api.getThreadList` |
| [getThreadHistory.md](./getThreadHistory.md) | `api.getThreadHistory` |
| [getMessage.md](./getMessage.md) | `api.getMessage` |
| [markAsRead.md](./markAsRead.md) | `api.markAsRead` |
| [markAsDelivered.md](./markAsDelivered.md) | `api.markAsDelivered` |
| [setMessageReaction.md](./setMessageReaction.md) | `api.setMessageReaction` |
| [sendTypingIndicator.md](./sendTypingIndicator.md) | `api.sendTypingIndicator` |
| [editMessage.md](./editMessage.md) | `api.editMessage` |
| [unsendMessage.md](./unsendMessage.md) | `api.unsendMessage` |
| [deleteMessage.md](./deleteMessage.md) | `api.deleteMessage` |
| [pinMessage.md](./pinMessage.md) | `api.pinMessage` / unpin |
| [forwardAttachment.md](./forwardAttachment.md) | `api.forwardAttachment` |
| [uploadAttachment.md](./uploadAttachment.md) | `api.uploadAttachment` |
| [shareLink.md](./shareLink.md) | `api.shareLink` |
| [shareContact.md](./shareContact.md) | `api.shareContact` |

### Group Management

| Document | API |
|----------|-----|
| [createNewGroup.md](./createNewGroup.md) | `api.createNewGroup` |
| [addUserToGroup.md](./addUserToGroup.md) | `api.addUserToGroup` |
| [removeUserFromGroup.md](./removeUserFromGroup.md) | `api.removeUserFromGroup` |
| [changeAdminStatus.md](./changeAdminStatus.md) | `api.changeAdminStatus` |
| [changeGroupImage.md](./changeGroupImage.md) | `api.changeGroupImage` |
| [setTitle.md](./setTitle.md) | `api.setTitle` |
| [changeThreadColor.md](./changeThreadColor.md) | `api.changeThreadColor` |
| [changeThreadEmoji.md](./changeThreadEmoji.md) | `api.changeThreadEmoji` |
| [changeNickname.md](./changeNickname.md) | `api.changeNickname` |
| [muteThread.md](./muteThread.md) | `api.muteThread` |
| [deleteThread.md](./deleteThread.md) | `api.deleteThread` |
| [createPoll.md](./createPoll.md) | `api.createPoll` |

### Profile & Account

| Document | API |
|----------|-----|
| [changeAvatar.md](./changeAvatar.md) | `api.changeAvatar` |
| [changeAvatarV2.md](./changeAvatarV2.md) | `api.changeAvatarV2` — current upload flow |
| [changeBio.md](./changeBio.md) | `api.changeBio` |
| [changeName.md](./changeName.md) | `api.changeName` |
| [changeCover.md](./changeCover.md) | `api.changeCover` |
| [changeUsername.md](./changeUsername.md) | `api.changeUsername` |
| [changeBlockedStatus.md](./changeBlockedStatus.md) | `api.changeBlockedStatus` |
| [setProfileGuard.md](./setProfileGuard.md) | `api.setProfileGuard` |
| [createPost.md](./createPost.md) | `api.createPost` |
| [createCommentPost.md](./createCommentPost.md) | `api.createCommentPost` |
| [setPostReaction.md](./setPostReaction.md) | `api.setPostReaction` |
| [setStoryReaction.md](./setStoryReaction.md) | `api.setStoryReaction` |

### New Feature Guides (v4.1+)

| Document | API |
|----------|-----|
| [send-buttons.md](./send-buttons.md) | `api.sendButtons` — CTA button messages over MQTT |
| [send-friend-request.md](./send-friend-request.md) | `api.sendFriendRequest` |
| [set-active-status.md](./set-active-status.md) | `api.setActiveStatus` — appear online/offline |
| [set-profile-lock.md](./set-profile-lock.md) | `api.setProfileLock` |
| [set-story-seen.md](./set-story-seen.md) | `api.setStorySeen` |
| [search-friends.md](./search-friends.md) | `api.searchFriends` |
| [notes.md](./notes.md) | `api.note.{check,create,delete,update}` — Messenger Notes |
| [scheduler.md](./scheduler.md) | `api.scheduler` — timed message sending |
| [auto-save-appstate.md](./auto-save-appstate.md) | `api.enableAutoSaveAppState` |
| [get-thread-theme.md](./get-thread-theme.md) | `api.getThreadTheme` |
| [set-thread-theme.md](./set-thread-theme.md) | `api.setThreadTheme` |
| [get-theme-pictures.md](./get-theme-pictures.md) | `api.getThemePictures` |
| [create-ai-theme.md](./create-ai-theme.md) | `api.createAITheme` — AI-generated themes |
| [generate-and-set-theme.md](./generate-and-set-theme.md) | `api.generateAndSetTheme` — one-call helper |

### New Feature Guides (v4.3+)

| Document | API |
|----------|-----|
| [story-manager.md](./story-manager.md) | `api.storyManager` — post/check/delete stories |
| [sticker-store.md](./sticker-store.md) | `api.stickerStore` — full sticker store surface |
| [oldmessage-fallback.md](./oldmessage-fallback.md) | `api.OldMessage` — legacy HTTP send fallback |
| [e2ee-bridge.md](./e2ee-bridge.md) | `api.connectE2EE` — opt-in E2EE bridge (BETA) |

### Runtime & Infrastructure Guides

| Document | API |
|----------|-----|
| [refreshFb_dtsg.md](./refreshFb_dtsg.md) | `fb_dtsg` refresh internals |
| [listenNotification.md](./listenNotification.md) | Notification events |
| [handleMessageRequest.md](./handleMessageRequest.md) | Message request handling |
| [handleFriendRequest.md](./handleFriendRequest.md) | Friend request handling |
| [httpGet.md](./httpGet.md) / [httpPost.md](./httpPost.md) | HTTP helpers |
| [httpPostFormData.md](./httpPostFormData.md) | Form-data HTTP helper |
| [getAccess.md](./getAccess.md) / [getCtx.md](./getCtx.md) | Runtime introspection |
| [getOptions.md](./getOptions.md) | Runtime options |
| [logout.md](./logout.md) | `api.logout` / `forceLogout` |

### Configuration & Operations

| Document | Contents |
|----------|----------|
| [configuration-reference.md](./configuration-reference.md) | All options, env vars, config file keys |
| [advanced-configuration.md](./advanced-configuration.md) | Advanced setup patterns |
| [deployment-config.md](./deployment-config.md) | Deployment settings |
| [account-safety.md](./account-safety.md) | Account safety architecture |
| [cookie-management.md](./cookie-management.md) | Cookie state management |
| [memory-usage.md](./memory-usage.md) | Memory behavior and guards |

### Enhanced Modules

| Document | Contents |
|----------|----------|
| [NexusClient.md](./NexusClient.md) | Client-based API with event handling |
| [PerformanceManager.md](./PerformanceManager.md) | Performance optimization and monitoring |
| [ErrorHandler.md](./ErrorHandler.md) | Error handling with retry and circuit breaker |
| [AdvancedMqttManager.md](./AdvancedMqttManager.md) | MQTT connection management |
| [EnhancedDatabase.md](./EnhancedDatabase.md) | Persistent storage and caching |
| [CompatibilityLayer.md](./CompatibilityLayer.md) | Legacy API style compatibility tools |
| [Message.md](./Message.md) | Rich message objects |
| [Thread.md](./Thread.md) | Thread management objects |
| [User.md](./User.md) | User objects |

---

## Quick Navigation

**New to Nexus-FCA**
1. Start with the main [DOCS.md](../DOCS.md) overview
2. Check [sendMessage.md](./sendMessage.md) and [listenMqtt.md](./listenMqtt.md) for the core loop
3. Read [configuration-reference.md](./configuration-reference.md) for login options

**Building high-load bots**
1. [scheduler.md](./scheduler.md) for timed delivery
2. [sticker-store.md](./sticker-store.md) and [send-buttons.md](./send-buttons.md) for rich content
3. [memory-usage.md](./memory-usage.md) for load behavior

**Account maintenance**
1. [notes.md](./notes.md), [set-active-status.md](./set-active-status.md), [set-profile-lock.md](./set-profile-lock.md)
2. [change-avatar-v2.md](./change-avatar-v2.md)
3. [auto-save-appstate.md](./auto-save-appstate.md) and [cookie-management.md](./cookie-management.md)

---

## Usage Guidelines

- **Runnable examples**: every document includes complete, working code.
- **Verified signatures**: all signatures are checked against the source.
- **Safety notes**: rate-limiting and detection-avoidance guidance is included where relevant.
- **Promise + callback**: APIs accept a callback; omitting it returns a Promise (unless noted otherwise).

For the most complete API reference, always check the main [DOCS.md](../DOCS.md) file.
