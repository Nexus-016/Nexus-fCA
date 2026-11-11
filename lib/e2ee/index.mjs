var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/client.ts
import { EventEmitter } from "events";

// src/native.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import koffi from "koffi";
import JSONBig from "yumi-json-bigint";
var JSONBigNative = JSONBig({
  useNativeBigInt: true,
  parseAsBigInt32: true
});
function resolveDirname() {
  return path.dirname(fileURLToPath(import.meta.url));
}
__name(resolveDirname, "resolveDirname");
function libPath() {
  const base = path.join(resolveDirname(), "..", "build");
  if (process.platform === "win32") return path.join(base, "messagix.dll");
  if (process.platform === "darwin") return path.join(base, "messagix.dylib");
  return path.join(base, "messagix.so");
}
__name(libPath, "libPath");
var LIB_FILE = libPath();
if (!fs.existsSync(LIB_FILE)) {
  throw new Error(`Native library not found at ${LIB_FILE}. Run: npm run build:go`);
}
var lib = koffi.load(LIB_FILE);
var mk = /* @__PURE__ */ __name((ret, name, args) => lib.func(name, ret, args), "mk");
var fns = {
  MxFreeCString: mk("void", "MxFreeCString", ["char*"]),
  MxNewClient: mk("str", "MxNewClient", ["str"]),
  MxConnect: mk("str", "MxConnect", ["str"]),
  MxConnectE2EE: mk("str", "MxConnectE2EE", ["str"]),
  MxDisconnect: mk("str", "MxDisconnect", ["str"]),
  MxIsConnected: mk("str", "MxIsConnected", ["str"]),
  MxSendMessage: mk("str", "MxSendMessage", ["str"]),
  MxSendReaction: mk("str", "MxSendReaction", ["str"]),
  MxEditMessage: mk("str", "MxEditMessage", ["str"]),
  MxUnsendMessage: mk("str", "MxUnsendMessage", ["str"]),
  MxSendTyping: mk("str", "MxSendTyping", ["str"]),
  MxMarkRead: mk("str", "MxMarkRead", ["str"]),
  MxUploadMedia: mk("str", "MxUploadMedia", ["str"]),
  MxSendImage: mk("str", "MxSendImage", ["str"]),
  MxSendVideo: mk("str", "MxSendVideo", ["str"]),
  MxSendVoice: mk("str", "MxSendVoice", ["str"]),
  MxSendFile: mk("str", "MxSendFile", ["str"]),
  MxSendSticker: mk("str", "MxSendSticker", ["str"]),
  MxCreateThread: mk("str", "MxCreateThread", ["str"]),
  MxGetUserInfo: mk("str", "MxGetUserInfo", ["str"]),
  MxSetGroupPhoto: mk("str", "MxSetGroupPhoto", ["str"]),
  MxRenameThread: mk("str", "MxRenameThread", ["str"]),
  MxMuteThread: mk("str", "MxMuteThread", ["str"]),
  MxDeleteThread: mk("str", "MxDeleteThread", ["str"]),
  MxSearchUsers: mk("str", "MxSearchUsers", ["str"]),
  MxPollEvents: mk("str", "MxPollEvents", ["str"]),
  MxSendE2EEMessage: mk("str", "MxSendE2EEMessage", ["str"]),
  MxSendE2EEReaction: mk("str", "MxSendE2EEReaction", ["str"]),
  MxSendE2EETyping: mk("str", "MxSendE2EETyping", ["str"]),
  MxEditE2EEMessage: mk("str", "MxEditE2EEMessage", ["str"]),
  MxUnsendE2EEMessage: mk("str", "MxUnsendE2EEMessage", ["str"]),
  MxGetDeviceData: mk("str", "MxGetDeviceData", ["str"]),
  // E2EE Media functions
  MxSendE2EEImage: mk("str", "MxSendE2EEImage", ["str"]),
  MxSendE2EEVideo: mk("str", "MxSendE2EEVideo", ["str"]),
  MxSendE2EEAudio: mk("str", "MxSendE2EEAudio", ["str"]),
  MxSendE2EEDocument: mk("str", "MxSendE2EEDocument", ["str"]),
  MxSendE2EESticker: mk("str", "MxSendE2EESticker", ["str"]),
  MxDownloadE2EEMedia: mk("str", "MxDownloadE2EEMedia", ["str"]),
  // Cookie and push notification functions
  MxGetCookies: mk("str", "MxGetCookies", ["str"]),
  MxRegisterPushNotifications: mk("str", "MxRegisterPushNotifications", ["str"])
};
function call(fn, payload) {
  const input = JSONBigNative.stringify(payload);
  const bound = fns[fn];
  const out = bound(input);
  const data = JSONBigNative.parse(out);
  if (!data.ok) throw new Error(data.error || "Unknown error");
  return data.data;
}
__name(call, "call");
function callAsync(fn, payload) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const result = call(fn, payload);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    }, 0);
  });
}
__name(callAsync, "callAsync");
var native = {
  newClient: /* @__PURE__ */ __name((cfg) => call("MxNewClient", cfg), "newClient"),
  connect: /* @__PURE__ */ __name((handle) => call("MxConnect", { handle }), "connect"),
  connectE2EE: /* @__PURE__ */ __name((handle) => callAsync("MxConnectE2EE", { handle }), "connectE2EE"),
  disconnect: /* @__PURE__ */ __name((handle) => call("MxDisconnect", { handle }), "disconnect"),
  isConnected: /* @__PURE__ */ __name((handle) => call("MxIsConnected", { handle }), "isConnected"),
  sendMessage: /* @__PURE__ */ __name((handle, options) => callAsync("MxSendMessage", { handle, options }), "sendMessage"),
  sendReaction: /* @__PURE__ */ __name((handle, threadId, messageId, emoji) => callAsync("MxSendReaction", { handle, threadId, messageId, emoji }), "sendReaction"),
  editMessage: /* @__PURE__ */ __name((handle, messageId, newText) => callAsync("MxEditMessage", { handle, messageId, newText }), "editMessage"),
  unsendMessage: /* @__PURE__ */ __name((handle, messageId) => callAsync("MxUnsendMessage", { handle, messageId }), "unsendMessage"),
  sendTyping: /* @__PURE__ */ __name((handle, threadId, isTyping, isGroup, threadType) => callAsync("MxSendTyping", { handle, threadId, isTyping, isGroup, threadType }), "sendTyping"),
  markRead: /* @__PURE__ */ __name((handle, threadId, watermarkTs) => callAsync("MxMarkRead", { handle, threadId, watermarkTs: watermarkTs || 0n }), "markRead"),
  uploadMedia: /* @__PURE__ */ __name((handle, options) => callAsync("MxUploadMedia", { handle, options }), "uploadMedia"),
  sendImage: /* @__PURE__ */ __name((handle, options) => callAsync("MxSendImage", { handle, options }), "sendImage"),
  sendVideo: /* @__PURE__ */ __name((handle, options) => callAsync("MxSendVideo", { handle, options }), "sendVideo"),
  sendVoice: /* @__PURE__ */ __name((handle, options) => callAsync("MxSendVoice", { handle, options }), "sendVoice"),
  sendFile: /* @__PURE__ */ __name((handle, options) => callAsync("MxSendFile", { handle, options }), "sendFile"),
  sendSticker: /* @__PURE__ */ __name((handle, options) => callAsync("MxSendSticker", { handle, options }), "sendSticker"),
  createThread: /* @__PURE__ */ __name((handle, options) => callAsync("MxCreateThread", { handle, options }), "createThread"),
  getUserInfo: /* @__PURE__ */ __name((handle, options) => callAsync("MxGetUserInfo", { handle, options }), "getUserInfo"),
  setGroupPhoto: /* @__PURE__ */ __name((handle, threadId, data, mimeType) => callAsync("MxSetGroupPhoto", { handle, threadId, data, mimeType }), "setGroupPhoto"),
  renameThread: /* @__PURE__ */ __name((handle, options) => callAsync("MxRenameThread", { handle, options }), "renameThread"),
  muteThread: /* @__PURE__ */ __name((handle, options) => callAsync("MxMuteThread", { handle, options }), "muteThread"),
  deleteThread: /* @__PURE__ */ __name((handle, options) => callAsync("MxDeleteThread", { handle, options }), "deleteThread"),
  searchUsers: /* @__PURE__ */ __name((handle, options) => callAsync("MxSearchUsers", {
    handle,
    options
  }), "searchUsers"),
  pollEvents: /* @__PURE__ */ __name((handle, timeoutMs) => callAsync("MxPollEvents", { handle, timeoutMs }), "pollEvents"),
  // E2EE functions
  sendE2EEMessage: /* @__PURE__ */ __name((handle, chatJid, text, replyToId, replyToSenderJid) => callAsync("MxSendE2EEMessage", {
    handle,
    chatJid,
    text,
    replyToId,
    replyToSenderJid
  }), "sendE2EEMessage"),
  sendE2EEReaction: /* @__PURE__ */ __name((handle, chatJid, messageId, senderJid, emoji) => callAsync("MxSendE2EEReaction", { handle, chatJid, messageId, senderJid, emoji }), "sendE2EEReaction"),
  sendE2EETyping: /* @__PURE__ */ __name((handle, chatJid, isTyping) => callAsync("MxSendE2EETyping", { handle, chatJid, isTyping }), "sendE2EETyping"),
  editE2EEMessage: /* @__PURE__ */ __name((handle, chatJid, messageId, newText) => callAsync("MxEditE2EEMessage", { handle, chatJid, messageId, newText }), "editE2EEMessage"),
  unsendE2EEMessage: /* @__PURE__ */ __name((handle, chatJid, messageId) => callAsync("MxUnsendE2EEMessage", { handle, chatJid, messageId }), "unsendE2EEMessage"),
  getDeviceData: /* @__PURE__ */ __name((handle) => call("MxGetDeviceData", { handle }), "getDeviceData"),
  // E2EE Media functions
  sendE2EEImage: /* @__PURE__ */ __name((handle, options) => callAsync("MxSendE2EEImage", { handle, options }), "sendE2EEImage"),
  sendE2EEVideo: /* @__PURE__ */ __name((handle, options) => callAsync("MxSendE2EEVideo", { handle, options }), "sendE2EEVideo"),
  sendE2EEAudio: /* @__PURE__ */ __name((handle, options) => callAsync("MxSendE2EEAudio", { handle, options }), "sendE2EEAudio"),
  sendE2EEDocument: /* @__PURE__ */ __name((handle, options) => callAsync("MxSendE2EEDocument", { handle, options }), "sendE2EEDocument"),
  sendE2EESticker: /* @__PURE__ */ __name((handle, options) => callAsync("MxSendE2EESticker", { handle, options }), "sendE2EESticker"),
  downloadE2EEMedia: /* @__PURE__ */ __name((handle, options) => callAsync("MxDownloadE2EEMedia", { handle, options }), "downloadE2EEMedia"),
  // Cookie and push notification functions
  getCookies: /* @__PURE__ */ __name((handle) => call("MxGetCookies", { handle }), "getCookies"),
  registerPushNotifications: /* @__PURE__ */ __name((handle, options) => callAsync("MxRegisterPushNotifications", { handle, options }), "registerPushNotifications"),
  unload: /* @__PURE__ */ __name(() => lib.unload(), "unload")
};

// src/client.ts
var Client = class extends EventEmitter {
  static {
    __name(this, "Client");
  }
  handle = null;
  options;
  cookies;
  _user = null;
  _initialData = null;
  eventLoopRunning = false;
  eventLoopAbort = null;
  _socketReady = false;
  _e2eeConnected = false;
  _fullyReadyEmitted = false;
  pendingEvents = [];
  /**
   * Create a new Messenger client
   *
   * @param cookies - Authentication cookies
   * @param options - Client options
   */
  constructor(cookies, options = {}) {
    super();
    this.cookies = cookies;
    this.options = {
      // ! todo: detect platform automatically
      platform: "facebook",
      logLevel: "none",
      enableE2EE: true,
      autoReconnect: true,
      e2eeMemoryOnly: true,
      ...options
    };
  }
  /**
   * Get the current user info
   */
  get user() {
    return this._user;
  }
  /**
   * Get the current user's Facebook ID
   */
  get currentUserId() {
    return this._user?.id ?? null;
  }
  /**
   * Get initial sync data (threads and messages)
   */
  get initialData() {
    return this._initialData;
  }
  /**
   * Check if client is fully ready (socket ready + E2EE connected if enabled)
   */
  isFullyReady() {
    if (!this._socketReady) return false;
    if (this.options.enableE2EE && !this._e2eeConnected) return false;
    return true;
  }
  /**
   * Check if client is connected
   */
  get isConnected() {
    if (!this.handle) return false;
    try {
      const status = native.isConnected(this.handle);
      return status.connected;
    } catch {
      return false;
    }
  }
  /**
   * Check if E2EE is connected
   */
  get isE2EEConnected() {
    if (!this.handle) return false;
    try {
      const status = native.isConnected(this.handle);
      return status.e2eeConnected;
    } catch {
      return false;
    }
  }
  /**
   * Connect to Messenger
   *
   * @returns User info and initial data
   */
  async connect() {
    const { handle } = native.newClient({
      cookies: this.cookies,
      platform: this.options.platform,
      devicePath: this.options.devicePath,
      deviceData: this.options.deviceData,
      e2eeMemoryOnly: this.options.e2eeMemoryOnly,
      logLevel: this.options.logLevel
    });
    this.handle = handle;
    const result = native.connect(handle);
    this._user = result.user;
    this._initialData = result.initialData;
    this.startEventLoop();
    if (this.options.enableE2EE) {
      this.connectE2EE().catch((err) => {
        this.emit("error", err);
      });
    }
    return {
      user: this._user,
      initialData: this._initialData
    };
  }
  /**
   * Connect E2EE (end-to-end encryption)
   * @warn This Promise is not resolved after the connection setup is completed; instead, it is resolved after the function finishes executing.\
   * You should not rely on this Promise to wait for the E2EE connection to be fully established.
   */
  async connectE2EE() {
    if (!this.handle) throw new Error("Not connected");
    await native.connectE2EE(this.handle);
  }
  /**
   * Disconnect from Messenger
   */
  async disconnect() {
    this.stopEventLoop();
    if (this.handle) {
      native.disconnect(this.handle);
      this.handle = null;
    }
  }
  /**
   * Send a text message
   *
   * @param threadId - Thread ID to send to
   * @param options - Message options (text, reply, mentions)
   * @returns Send result with message ID
   */
  async sendMessage(threadId, options) {
    if (!this.handle) throw new Error("Not connected");
    const opts = typeof options === "string" ? { text: options } : options;
    return native.sendMessage(this.handle, {
      threadId,
      text: opts.text,
      replyToId: opts.replyToId,
      attachmentFbIds: opts.attachmentFbIds,
      mentionIds: opts.mentions?.map((m) => m.userId),
      mentionOffsets: opts.mentions?.map((m) => m.offset),
      mentionLengths: opts.mentions?.map((m) => m.length)
    });
  }
  /**
   * Send / Remove a reaction to a message
   *
   * @param threadId - Thread ID
   * @param messageId - Message ID to react to
   * @param emoji - Reaction emoji (to remove, simply omit this parameter)
   */
  async sendReaction(threadId, messageId, emoji) {
    if (!this.handle) throw new Error("Not connected");
    await native.sendReaction(this.handle, threadId, messageId, emoji || "");
  }
  /**
   * Edit a message
   *
   * @param messageId - Message ID to edit
   * @param newText - New text content
   */
  async editMessage(messageId, newText) {
    if (!this.handle) throw new Error("Not connected");
    await native.editMessage(this.handle, messageId, newText);
  }
  /**
   * Unsend/delete a message
   *
   * @param messageId - Message ID to unsend
   */
  async unsendMessage(messageId) {
    if (!this.handle) throw new Error("Not connected");
    await native.unsendMessage(this.handle, messageId);
  }
  /**
   * Send typing indicator
   *
   * @param threadId - Thread ID
   * @param isTyping - Whether typing or not
   * @param isGroup - Whether it's a group chat
   */
  async sendTypingIndicator(threadId, isTyping = true, isGroup = false) {
    if (!this.handle) throw new Error("Not connected");
    await native.sendTyping(this.handle, threadId, isTyping, isGroup, isGroup ? 2 : 1);
  }
  /**
   * Mark messages as read
   *
   * @param threadId - Thread ID
   * @param watermarkTs - Timestamp to mark read up to (optional)
   */
  async markAsRead(threadId, watermarkTs) {
    if (!this.handle) throw new Error("Not connected");
    await native.markRead(this.handle, threadId, watermarkTs);
  }
  /**
   * Upload media to Messenger
   *
   * @param threadId - Thread ID
   * @param data - File data as Buffer
   * @param filename - Filename
   * @param mimeType - MIME type
   * @param isVoice - Whether it's a voice message
   * @returns Upload result with Facebook ID
   */
  async uploadMedia(threadId, data, filename, mimeType, isVoice = false) {
    if (!this.handle) throw new Error("Not connected");
    return native.uploadMedia(this.handle, {
      threadId,
      filename,
      mimeType,
      data: Array.from(data),
      isVoice
    });
  }
  /**
   * Send an image
   *
   * @param threadId - Thread ID
   * @param data - Image data as Buffer
   * @param filename - Filename
   * @param options - Optional: caption and replyToId
   */
  async sendImage(threadId, data, filename, options) {
    if (!this.handle) throw new Error("Not connected");
    const opts = typeof options === "string" ? { caption: options } : options;
    return native.sendImage(this.handle, {
      threadId,
      data: Array.from(data),
      filename,
      caption: opts?.caption,
      replyToId: opts?.replyToId
    });
  }
  /**
   * Send a video
   *
   * @param threadId - Thread ID
   * @param data - Video data as Buffer
   * @param filename - Filename
   * @param options - Optional: caption and replyToId
   */
  async sendVideo(threadId, data, filename, options) {
    if (!this.handle) throw new Error("Not connected");
    const opts = typeof options === "string" ? { caption: options } : options;
    return native.sendVideo(this.handle, {
      threadId,
      data: Array.from(data),
      filename,
      caption: opts?.caption,
      replyToId: opts?.replyToId
    });
  }
  /**
   * Send a voice message
   *
   * @param threadId - Thread ID
   * @param data - Audio data as Buffer
   * @param filename - Filename
   * @param options - Optional: replyToId
   */
  async sendVoice(threadId, data, filename, options) {
    if (!this.handle) throw new Error("Not connected");
    return native.sendVoice(this.handle, {
      threadId,
      data: Array.from(data),
      filename,
      replyToId: options?.replyToId
    });
  }
  /**
   * Send a file
   *
   * @param threadId - Thread ID
   * @param data - File data as Buffer
   * @param filename - Filename
   * @param mimeType - MIME type
   * @param options - Optional: caption and replyToId
   */
  async sendFile(threadId, data, filename, mimeType, options) {
    if (!this.handle) throw new Error("Not connected");
    const opts = typeof options === "string" ? { caption: options } : options;
    return native.sendFile(this.handle, {
      threadId,
      data: Array.from(data),
      filename,
      mimeType,
      caption: opts?.caption,
      replyToId: opts?.replyToId
    });
  }
  /**
   * Send a sticker
   *
   * @param threadId - Thread ID
   * @param stickerId - Sticker ID
   * @param options - Optional: replyToId
   */
  async sendSticker(threadId, stickerId, options) {
    if (!this.handle) throw new Error("Not connected");
    return native.sendSticker(this.handle, { threadId, stickerId, replyToId: options?.replyToId });
  }
  /**
   * Create a 1:1 thread with a user
   *
   * @param userId - User ID to create thread with
   * @returns Created thread info
   */
  async createThread(userId) {
    if (!this.handle) throw new Error("Not connected");
    return native.createThread(this.handle, { userId });
  }
  /**
   * Get detailed information about a user
   *
   * @param userId - User ID
   * @returns User info
   */
  async getUserInfo(userId) {
    if (!this.handle) throw new Error("Not connected");
    return native.getUserInfo(this.handle, { userId });
  }
  /**
   * Set group photo/avatar
   *
   * @param threadId - Thread ID
   * @param data - Image data as Buffer or base64 string
   * @param mimeType - MIME type (e.g., 'image/jpeg', 'image/png')
   *
   * @warn Cannot remove group photo. Messenger web doesn't have a remove option?
   */
  async setGroupPhoto(threadId, data, mimeType = "image/jpeg") {
    if (!this.handle) throw new Error("Not connected");
    const base64 = Buffer.isBuffer(data) ? data.toString("base64") : data;
    await native.setGroupPhoto(this.handle, threadId, base64, mimeType);
  }
  /**
   * Rename a group thread
   *
   * @param threadId - Thread ID
   * @param newName - New name
   */
  async renameThread(threadId, newName) {
    if (!this.handle) throw new Error("Not connected");
    native.renameThread(this.handle, { threadId, newName });
  }
  /**
   * Mute a thread
   *
   * @param threadId - Thread ID
   * @param muteSeconds - Duration in seconds (-1 for forever, 0 to unmute)
   */
  async muteThread(threadId, muteSeconds = -1) {
    if (!this.handle) throw new Error("Not connected");
    native.muteThread(this.handle, { threadId, muteSeconds });
  }
  /**
   * Unmute a thread
   *
   * @param threadId - Thread ID
   */
  async unmuteThread(threadId) {
    return this.muteThread(threadId, 0);
  }
  /**
   * Delete a thread
   *
   * @param threadId - Thread ID
   */
  async deleteThread(threadId) {
    if (!this.handle) throw new Error("Not connected");
    native.deleteThread(this.handle, { threadId });
  }
  /**
   * Search for users
   *
   * @param query - Search query
   * @returns List of matching users
   */
  async searchUsers(query) {
    if (!this.handle) throw new Error("Not connected");
    const result = await native.searchUsers(this.handle, { query });
    return result.users;
  }
  // ========== E2EE Methods ==========
  /**
   * Send an E2EE message
   *
   * @param chatJid - Chat JID
   * @param text - Message text
   * @param options - Optional: replyToId and replyToSenderJid for replies
   */
  async sendE2EEMessage(chatJid, text, options) {
    if (!this.handle) throw new Error("Not connected");
    return native.sendE2EEMessage(this.handle, chatJid, text, options?.replyToId, options?.replyToSenderJid);
  }
  /**
   * Send / Remove an E2EE reaction
   *
   * @param chatJid - Chat JID
   * @param messageId - Message ID
   * @param senderJid - Sender JID
   * @param emoji - Reaction emoji (To remove it, simply omit this parameter)
   */
  async sendE2EEReaction(chatJid, messageId, senderJid, emoji) {
    if (!this.handle) throw new Error("Not connected");
    await native.sendE2EEReaction(this.handle, chatJid, messageId, senderJid, emoji || "");
  }
  /**
   * Send E2EE typing indicator
   *
   * @param chatJid - Chat JID
   * @param isTyping - Whether typing
   */
  async sendE2EETyping(chatJid, isTyping = true) {
    if (!this.handle) throw new Error("Not connected");
    await native.sendE2EETyping(this.handle, chatJid, isTyping);
  }
  /**
   * Edit an E2EE message
   *
   * @param chatJid - Chat JID
   * @param messageId - Message ID to edit
   * @param newText - New message text
   */
  async editE2EEMessage(chatJid, messageId, newText) {
    if (!this.handle) throw new Error("Not connected");
    await native.editE2EEMessage(this.handle, chatJid, messageId, newText);
  }
  /**
   * Unsend/delete an E2EE message
   *
   * @param chatJid - Chat JID
   * @param messageId - Message ID to unsend
   */
  async unsendE2EEMessage(chatJid, messageId) {
    if (!this.handle) throw new Error("Not connected");
    await native.unsendE2EEMessage(this.handle, chatJid, messageId);
  }
  // ========== E2EE Media Methods ==========
  /**
   * Send an E2EE image
   *
   * @param chatJid - Chat JID
   * @param data - Image data as Buffer
   * @param mimeType - MIME type (e.g., image/jpeg, image/png)
   * @param options - Optional caption, dimensions, and reply options
   */
  async sendE2EEImage(chatJid, data, mimeType = "image/jpeg", options) {
    if (!this.handle) throw new Error("Not connected");
    return native.sendE2EEImage(this.handle, {
      chatJid,
      data: Array.from(data),
      mimeType,
      caption: options?.caption,
      width: options?.width,
      height: options?.height,
      replyToId: options?.replyToId,
      replyToSenderJid: options?.replyToSenderJid
    });
  }
  /**
   * Send an E2EE video
   *
   * @param chatJid - Chat JID
   * @param data - Video data as Buffer
   * @param mimeType - MIME type (default: video/mp4)
   * @param options - Optional caption, dimensions, duration, and reply options
   */
  async sendE2EEVideo(chatJid, data, mimeType = "video/mp4", options) {
    if (!this.handle) throw new Error("Not connected");
    return native.sendE2EEVideo(this.handle, {
      chatJid,
      data: Array.from(data),
      mimeType,
      caption: options?.caption,
      width: options?.width,
      height: options?.height,
      duration: options?.duration,
      replyToId: options?.replyToId,
      replyToSenderJid: options?.replyToSenderJid
    });
  }
  /**
   * Send an E2EE audio/voice message
   *
   * @param chatJid - Chat JID
   * @param data - Audio data as Buffer
   * @param mimeType - MIME type (default: audio/ogg)
   * @param options - Optional PTT (push-to-talk/voice message), duration, and reply options
   */
  async sendE2EEAudio(chatJid, data, mimeType = "audio/ogg", options) {
    if (!this.handle) throw new Error("Not connected");
    return native.sendE2EEAudio(this.handle, {
      chatJid,
      data: Array.from(data),
      mimeType,
      ptt: options?.ptt ?? false,
      duration: options?.duration,
      replyToId: options?.replyToId,
      replyToSenderJid: options?.replyToSenderJid
    });
  }
  /**
   * Send an E2EE document/file
   *
   * @param chatJid - Chat JID
   * @param data - File data as Buffer
   * @param filename - Filename
   * @param mimeType - MIME type
   * @param options - Optional reply options
   */
  async sendE2EEDocument(chatJid, data, filename, mimeType, options) {
    if (!this.handle) throw new Error("Not connected");
    return native.sendE2EEDocument(this.handle, {
      chatJid,
      data: Array.from(data),
      filename,
      mimeType,
      replyToId: options?.replyToId,
      replyToSenderJid: options?.replyToSenderJid
    });
  }
  /**
   * Send an E2EE sticker
   *
   * @param chatJid - Chat JID
   * @param data - Sticker data as Buffer (WebP format)
   * @param mimeType - MIME type (default: image/webp)
   * @param options - Optional reply options
   */
  async sendE2EESticker(chatJid, data, mimeType = "image/webp", options) {
    if (!this.handle) throw new Error("Not connected");
    return native.sendE2EESticker(this.handle, {
      chatJid,
      data: Array.from(data),
      mimeType,
      replyToId: options?.replyToId,
      replyToSenderJid: options?.replyToSenderJid
    });
  }
  /**
   * Get E2EE device data as JSON string
   *
   * Use this to persist device data externally (e.g., in a database)
   *
   * @returns Device data as JSON string
   */
  getDeviceData() {
    if (!this.handle) throw new Error("Not connected");
    const result = native.getDeviceData(this.handle);
    return result.deviceData;
  }
  /**
   * Get the current cookies from the internal client state
   *
   * Use this to export updated cookies after they've been refreshed
   *
   * @returns Current cookies as key-value object
   */
  getCookies() {
    if (!this.handle) throw new Error("Not connected");
    const result = native.getCookies(this.handle);
    return result.cookies;
  }
  /**
   * Register for web push notifications
   *
   * @param endpoint - Push notification endpoint URL
   * @param keys - Push notification keys (p256dh and auth, base64 encoded)
   */
  async registerPushNotifications(endpoint, keys) {
    if (!this.handle) throw new Error("Not connected");
    await native.registerPushNotifications(this.handle, {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth
    });
  }
  /**
   * Download and decrypt E2EE media
   *
   * Use the mediaKey, mediaSha256, and directPath from attachment metadata
   * to download and decrypt encrypted media.
   *
   * @param options - Download options from attachment metadata
   * @returns Decrypted media data as Buffer
   *
   * @example
   * ```typescript
   * const attachment = message.attachments[0];
   * const result = await client.downloadE2EEMedia({
   *     directPath: attachment.directPath!,
   *     mediaKey: attachment.mediaKey!,
   *     mediaSha256: attachment.mediaSha256!,
   *     mediaEncSha256: attachment.mediaEncSha256,
   *     mediaType: attachment.type,
   *     mimeType: attachment.mimeType!,
   *     fileSize: attachment.fileSize!,
   * });
   * fs.writeFileSync('downloaded.jpg', result.data);
   * ```
   */
  async downloadE2EEMedia(options) {
    if (!this.handle) throw new Error("Not connected");
    const result = await native.downloadE2EEMedia(this.handle, options);
    return {
      data: Buffer.from(result.data, "base64"),
      mimeType: result.mimeType,
      fileSize: result.fileSize
    };
  }
  startEventLoop() {
    if (this.eventLoopRunning) return;
    this.eventLoopRunning = true;
    this.eventLoopAbort = new AbortController();
    const loop = /* @__PURE__ */ __name(async () => {
      while (this.eventLoopRunning && this.handle) {
        try {
          await new Promise((resolve) => setImmediate(resolve));
          const event = await native.pollEvents(this.handle, 1e3);
          if (!event || event.type === "timeout") continue;
          if (event.type === "closed") {
            this.eventLoopRunning = false;
            break;
          }
          this.handleEvent(event);
        } catch (err) {
          if (this.eventLoopRunning) {
            this.emit("error", err);
          }
        }
      }
    }, "loop");
    setImmediate(loop).unref();
  }
  stopEventLoop() {
    this.eventLoopRunning = false;
    this.eventLoopAbort?.abort();
    this.eventLoopAbort = null;
  }
  checkFullyReady() {
    if (this.isFullyReady() && !this._fullyReadyEmitted) {
      this._fullyReadyEmitted = true;
      this.emit("fullyReady");
      const pending = this.pendingEvents;
      this.pendingEvents = [];
      for (const event of pending) {
        this.emitEvent(event);
      }
    }
  }
  handleEvent(event) {
    switch (event.type) {
      // System events
      case "ready":
        this._socketReady = true;
        this.emit("ready", event.data);
        this.checkFullyReady();
        break;
      case "reconnected":
        this.emit("reconnected");
        break;
      case "disconnected":
        this._socketReady = false;
        this._e2eeConnected = false;
        this._fullyReadyEmitted = false;
        this.pendingEvents = [];
        this.emit("disconnected", event.data || {});
        break;
      case "error":
        this.emit("error", new Error(event.data.message));
        if (event.data.code === 1) {
          this.stopEventLoop();
          this._socketReady = false;
          this._e2eeConnected = false;
          this._fullyReadyEmitted = false;
          this.pendingEvents = [];
        }
        break;
      case "e2eeConnected":
        this._e2eeConnected = true;
        this.emit("e2eeConnected");
        this.checkFullyReady();
        break;
      case "deviceDataChanged":
        this.emit("deviceDataChanged", event.data);
        break;
      case "raw":
        this.emit("raw", event.data);
        break;
      // queue until fullyReady
      case "message":
      case "messageEdit":
      case "messageUnsend":
      case "reaction":
      case "typing":
      case "readReceipt":
      case "e2eeMessage":
      case "e2eeReaction":
      case "e2eeReceipt":
        if (this._fullyReadyEmitted) {
          this.emitEvent(event);
        } else {
          this.pendingEvents.push(event);
        }
        break;
    }
  }
  emitEvent(event) {
    switch (event.type) {
      case "message":
        this.emit("message", event.data);
        break;
      case "messageEdit":
        this.emit("messageEdit", event.data);
        break;
      case "messageUnsend":
        this.emit("messageUnsend", event.data);
        break;
      case "reaction":
        this.emit("reaction", event.data);
        break;
      case "typing":
        this.emit("typing", event.data);
        break;
      case "readReceipt":
        this.emit("readReceipt", event.data);
        break;
      case "e2eeMessage":
        this.emit("e2eeMessage", event.data);
        break;
      case "e2eeReaction":
        this.emit("e2eeReaction", event.data);
        break;
      case "e2eeReceipt":
        this.emit("e2eeReceipt", event.data);
        break;
    }
  }
  /**
   * Unload the native library (for cleanup)
   * @warn Any attempt to find or call a function from this library after unloading it will crash.
   * @returns void
   */
  unloadLibrary() {
    if (this.handle) {
      native.unload();
    }
  }
};

// src/login.ts
import { randomUUID } from "crypto";
import { fetch } from "undici";
var UIDLogin = class extends null {
  static {
    __name(this, "UIDLogin");
  }
  static API_ENDPOINT = "https://b-graph.facebook.com/graphql";
  static USER_AGENT = "[FBAN/FB4A;FBAV/498.1.0.64.74;FBBV/692621185;FBDM/{density=1.5,width=540,height=960};FBLC/vi_VN;FBRV/0;FBCR/MobiFone;FBMF/Xiaomi;FBBD/Xiaomi;FBPN/com.facebook.katana;FBDV/2211133C;FBSV/9;FBOP/1;FBCA/x86_64:arm64-v8a;]";
  static AUTH_TOKEN = "OAuth 350685531728|62f8ce9f74b12f84c123cc23437a4a32";
  static CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  static randomString(len) {
    let result = "";
    for (let i = 0; i < len; i++) {
      result += this.CHARS[Math.floor(Math.random() * this.CHARS.length)];
    }
    return result;
  }
  static generateNonce(size) {
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) bytes[i] = Math.floor(Math.random() * 256);
    return Buffer.from(bytes).toString("base64");
  }
  static toBase64(text) {
    return Buffer.from(text).toString("base64");
  }
  static formatPassword(pwd) {
    return `#PWD_FB4A:0:${Math.floor(Date.now() / 1e3)}:${pwd}`;
  }
  static hashData(uid) {
    return this.toBase64(JSON.stringify({ challenge_nonce: this.generateNonce(32), username: uid }));
  }
  static generateVariable(account) {
    const deviceId = randomUUID();
    const variable = {
      params: {
        params: JSON.stringify({
          client_input_params: {
            sim_phones: [],
            secure_family_device_id: randomUUID(),
            /*
            attestation_result: {
                data: this.hashData(account.uid),
                signature:
                    "MEYCIQDtz5TqO0pwysy82Ko92FErORasLag9o/pQYlZl8+zaMgIhAKon529upFiPfGgoS6OkPKg0/VahBuSDxwiTgtzpYQA3",
                keyHash: "92398b3e4d9ee926bae93a61fd75e18d750100c1e73fd44d4faa7b9ba9353eee",
            },
            */
            has_granted_read_contacts_permissions: 0,
            auth_secure_device_id: "",
            has_whatsapp_installed: 0,
            password: this.formatPassword(account.password),
            sso_token_map_json_string: "",
            event_flow: "login_manual",
            password_contains_non_ascii: "false",
            sim_serials: [],
            client_known_key_hash: "",
            encrypted_msisdn: "",
            has_granted_read_phone_permissions: 0,
            app_manager_id: "null",
            should_show_nested_nta_from_aymh: 0,
            device_id: deviceId,
            login_attempt_count: 1,
            machine_id: this.randomString(22),
            flash_call_permission_status: {
              READ_PHONE_STATE: "DENIED",
              READ_CALL_LOG: "DENIED",
              ANSWER_PHONE_CALLS: "DENIED"
            },
            accounts_list: [],
            family_device_id: deviceId,
            fb_ig_device_id: [],
            device_emails: [],
            try_num: 2,
            lois_settings: { lois_token: "" },
            event_step: "home_page",
            headers_infra_flow_id: "",
            openid_tokens: {},
            contact_point: account.uid
          },
          server_params: {
            should_trigger_override_login_2fa_action: 0,
            is_from_logged_out: 0,
            should_trigger_override_login_success_action: 0,
            login_credential_type: "none",
            server_login_source: "login",
            waterfall_id: randomUUID(),
            login_source: "Login",
            is_platform_login: 0,
            pw_encryption_try_count: 1,
            INTERNAL__latency_qpl_marker_id: 36707139,
            offline_experiment_group: "caa_iteration_v6_perf_fb_2",
            is_from_landing_page: 0,
            password_text_input_id: "jirv90:99",
            is_from_empty_password: 0,
            is_from_msplit_fallback: 0,
            ar_event_source: "login_home_page",
            username_text_input_id: "jirv90:98",
            layered_homepage_experiment_group: null,
            device_id: deviceId,
            INTERNAL__latency_qpl_instance_id: 118039064400779,
            reg_flow_source: "login_home_native_integration_point",
            is_caa_perf_enabled: 1,
            credential_type: "password",
            is_from_password_entry_page: 0,
            caller: "gslr",
            family_device_id: deviceId,
            is_from_assistive_id: 0,
            access_flow_version: "F2_FLOW",
            is_from_logged_in_switcher: 0
          }
        }),
        // const
        bloks_versioning_id: "cb6ac324faea83da28649a4d5046c3a4f0486cb987f8ab769765e316b075a76c",
        app_id: "com.bloks.www.bloks.caa.login.async.send_login_request"
      },
      scale: "1.5",
      nt_context: {
        using_white_navbar: true,
        // const
        styles_id: "55d2af294359fa6bbdb8e045ff01fc5e",
        pixel_ratio: 1.5,
        is_push_on: true,
        debug_tooling_metadata_token: null,
        is_flipper_enabled: false,
        theme_params: [],
        // can be dynamic
        bloks_version: "cb6ac324faea83da28649a4d5046c3a4f0486cb987f8ab769765e316b075a76c"
      }
    };
    return JSON.stringify(variable);
  }
  static extractCookieToken(data) {
    const tokenMatch = data.match(/"access_token":"([^"]+)"/);
    const cookiesMatch = data.match(/"session_cookies":\s*\[([^\]]+)\]/);
    const cookies = [];
    if (cookiesMatch) {
      const pattern = /"name":"([^"]+)","value":"([^"]+)"/g;
      let m;
      while (m = pattern.exec(cookiesMatch[1])) cookies.push(`${m[1]}=${m[2]}`);
    }
    return {
      token: tokenMatch?.[1] ?? "Access token not found",
      cookie: cookies.join("; ")
    };
  }
  /**
   * Performs Facebook login via Katana API
   * @param account - Account with UID and password
   * @returns Cookie and token upon successful authentication
   * @warn Accounts with 2FA are not supported, and the function will return an error
   * @deprecated This login method is unstable and may be blocked by Facebook at any time.
   */
  static async login(account) {
    const headers = {
      "User-Agent": this.USER_AGENT,
      Authorization: this.AUTH_TOKEN,
      "Content-Type": "application/x-www-form-urlencoded",
      "x-fb-sim-hni": "45201",
      "x-fb-net-hni": "45201",
      "x-fb-device-group": "2789",
      "x-fb-connection-type": "WIFI",
      "x-fb-http-engine": "Tigon/Liger",
      "x-fb-client-ip": "True",
      "x-fb-server-cluster": "True",
      "x-graphql-client-library": "graphservice",
      "x-graphql-request-purpose": "fetch",
      "x-fb-friendly-name": "FbBloksActionRootQuery-com.bloks.www.bloks.caa.login.async.send_login_request",
      "x-tigon-is-retry": "False",
      "x-zero-eh": "error",
      "Accept-Encoding": "identity"
    };
    const body = new URLSearchParams({
      method: "post",
      pretty: "false",
      format: "json",
      server_timestamps: "true",
      locale: "vi_VN",
      purpose: "fetch",
      fb_api_req_friendly_name: "FbBloksActionRootQuery-com.bloks.www.bloks.caa.login.async.send_login_request",
      fb_api_caller_class: "graphservice",
      client_doc_id: "11994080423986492941384902285",
      variables: this.generateVariable(account),
      fb_api_analytics_tags: '["GraphServices"]',
      client_trace_id: randomUUID()
    });
    const res = await fetch(this.API_ENDPOINT, { method: "POST", headers, body: body.toString() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = this.extractCookieToken((await res.text()).replace(/\\/g, ""));
    return result;
  }
};

// src/types.ts
var ThreadType = /* @__PURE__ */ ((ThreadType2) => {
  ThreadType2[ThreadType2["ONE_TO_ONE"] = 1] = "ONE_TO_ONE";
  ThreadType2[ThreadType2["GROUP"] = 2] = "GROUP";
  ThreadType2[ThreadType2["PAGE"] = 3] = "PAGE";
  ThreadType2[ThreadType2["MARKETPLACE"] = 4] = "MARKETPLACE";
  ThreadType2[ThreadType2["ENCRYPTED_ONE_TO_ONE"] = 7] = "ENCRYPTED_ONE_TO_ONE";
  ThreadType2[ThreadType2["ENCRYPTED_GROUP"] = 8] = "ENCRYPTED_GROUP";
  return ThreadType2;
})(ThreadType || {});

// src/utils.ts
var Utils = class _Utils extends null {
  static {
    __name(this, "Utils");
  }
  /**
   * Parse cookies from various formats
   * Automatically detects the format and parses accordingly
   *
   * @param input - Cookie data in any supported format
   * @returns Parsed cookies object
   */
  static parseCookies(input) {
    if (typeof input === "object" && !Array.isArray(input)) {
      return input;
    }
    if (Array.isArray(input)) {
      return _Utils.fromCookieArray(input);
    }
    if (typeof input === "string") {
      const trimmed = input.trim();
      if (_Utils.isBase64(trimmed)) {
        try {
          const decoded = Buffer.from(trimmed, "base64").toString("utf-8");
          return _Utils.parseCookies(decoded);
        } catch {
        }
      }
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try {
          const parsed = JSON.parse(trimmed);
          return _Utils.parseCookies(parsed);
        } catch {
        }
      }
      if (trimmed.includes("	") && (trimmed.startsWith("#") || trimmed.includes(".facebook.com") || trimmed.includes(".messenger.com"))) {
        return _Utils.fromNetscape(trimmed);
      }
      if (trimmed.includes("=")) {
        return _Utils.fromCookieString(trimmed);
      }
    }
    throw new Error("Unable to parse cookies: unknown format");
  }
  /**
   * Parse cookies from C3C UFC Utility / EditThisCookie array format
   *
   * @param cookies - Array of cookie objects
   * @returns Parsed cookies object
   *
   * @example
   * ```typescript
   * const cookies = Utils.fromCookieArray([
   *     { name: 'c_user', value: '123456' },
   *     { name: 'xs', value: 'abc...' }
   * ])
   * ```
   */
  static fromCookieArray(cookies) {
    const result = {};
    for (const cookie of cookies) {
      if (cookie.name && cookie.value !== void 0) {
        result[cookie.name] = String(cookie.value);
      }
    }
    return result;
  }
  /**
   * Parse cookies from cookie header string format
   *
   * @param cookieString - Cookie string (e.g., "name1=value1; name2=value2")
   * @returns Parsed cookies object
   *
   * @example
   * ```typescript
   * const cookies = Utils.fromCookieString('c_user=123456; xs=abc...; datr=xyz...')
   * ```
   */
  static fromCookieString(cookieString) {
    const result = {};
    const pairs = cookieString.split(/;\s*/);
    for (const pair of pairs) {
      const [name, ...valueParts] = pair.split("=");
      if (name && valueParts.length > 0) {
        const trimmedName = name.trim();
        const value = valueParts.join("=").trim();
        if (trimmedName && value) {
          result[trimmedName] = value;
        }
      }
    }
    return result;
  }
  /**
   * Parse cookies from Netscape/HTTP cookie file format
   *
   * @param content - Netscape cookie file content
   * @returns Parsed cookies object
   *
   * @example
   * ```typescript
   * const cookies = Utils.fromNetscape(`
   * # Netscape HTTP Cookie File
   * .facebook.com	TRUE	/	TRUE	1234567890	c_user	123456
   * .facebook.com	TRUE	/	TRUE	1234567890	xs	abc...
   * `)
   * ```
   */
  static fromNetscape(content) {
    const result = {};
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const parts = trimmed.split("	");
      if (parts.length >= 7) {
        const name = parts[5];
        const value = parts[6];
        if (name && value) {
          result[name] = value;
        }
      }
    }
    return result;
  }
  /**
   * Parse cookies from Base64 encoded string
   *
   * @param base64 - Base64 encoded cookie data
   * @returns Parsed cookies object
   */
  static fromBase64(base64) {
    const decoded = Buffer.from(base64, "base64").toString("utf-8");
    return _Utils.parseCookies(decoded);
  }
  /**
   * Convert cookies object to cookie header string
   *
   * @param cookies - Cookies object
   * @returns Cookie header string
   *
   * @example
   * ```typescript
   * const header = Utils.toCookieString({ c_user: '123456', xs: 'abc...' })
   * // Returns: "c_user=123456; xs=abc..."
   * ```
   */
  static toCookieString(cookies) {
    return Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join("; ");
  }
  /**
   * Convert cookies object to array format (C3C UFC Utility style)
   *
   * @param cookies - Cookies object
   * @param domain - Cookie domain (default: .facebook.com)
   * @returns Array of cookie objects
   *
   * @example
   * ```typescript
   * const arr = Utils.toCookieArray({ c_user: '123456', xs: 'abc...' })
   * ```
   */
  static toCookieArray(cookies, domain = ".facebook.com") {
    return Object.entries(cookies).filter(([, value]) => value !== void 0).map(([name, value]) => ({
      name,
      value,
      domain,
      path: "/",
      secure: true,
      httpOnly: true
    }));
  }
  /**
   * Convert cookies object to Netscape format
   *
   * @param cookies - Cookies object
   * @param domain - Cookie domain (default: .facebook.com)
   * @returns Netscape cookie file content
   */
  static toNetscape(cookies, domain = ".facebook.com") {
    const lines = ["# Netscape HTTP Cookie File", "# Generated by meta-messenger.js", ""];
    for (const [name, value] of Object.entries(cookies)) {
      const expiration = Math.floor(Date.now() / 1e3) + 365 * 24 * 60 * 60;
      lines.push(`${domain}	TRUE	/	TRUE	${expiration}	${name}	${value}`);
    }
    return lines.join("\n");
  }
  /**
   * Convert cookies to Base64 encoded JSON
   *
   * @param cookies - Cookies object
   * @returns Base64 encoded string
   */
  static toBase64(cookies) {
    return Buffer.from(JSON.stringify(cookies)).toString("base64");
  }
  /**
   * Filter cookies to only essential ones for Facebook/Messenger
   *
   * @param cookies - Cookies object
   * @returns Filtered cookies with only essential keys
   */
  static filterEssential(cookies) {
    const essential = ["c_user", "xs", "datr", "fr", "sb", "wd", "presence"];
    const result = {};
    for (const key of essential) {
      if (cookies[key]) {
        result[key] = cookies[key];
      }
    }
    return result;
  }
  /**
   * Validate that cookies contain required fields
   *
   * @param cookies - Cookies object
   * @returns True if cookies are valid
   */
  static validate(cookies) {
    const required = ["c_user", "xs"];
    return required.every((key) => cookies[key] && cookies[key].length > 0);
  }
  /**
   * Get missing required cookies
   *
   * @param cookies - Cookies object
   * @returns Array of missing cookie names
   */
  static getMissing(cookies) {
    const required = ["c_user", "xs"];
    return required.filter((key) => !cookies[key] || cookies[key].length === 0);
  }
  /**
   * Check if a string is valid Base64
   */
  static isBase64(str) {
    if (str.length < 4) return false;
    const base64Regex = /^[A-Za-z0-9+/]+=*$/;
    if (!base64Regex.test(str)) return false;
    return str.length > 20 && str.length % 4 === 0;
  }
};
var THUMBS_UP_STICKER_IDS = {
  SMALL: 369239263222822,
  MEDIUM: 369239343222814,
  LARGE: 369239383222810
};
function isThumbsUpSticker(stickerId) {
  if (!stickerId) return false;
  return stickerId === THUMBS_UP_STICKER_IDS.SMALL || stickerId === THUMBS_UP_STICKER_IDS.MEDIUM || stickerId === THUMBS_UP_STICKER_IDS.LARGE;
}
__name(isThumbsUpSticker, "isThumbsUpSticker");
function extractUrlFromLPHP(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (parsed.pathname === "/l.php" || parsed.pathname.endsWith("/l.php")) {
      const actualUrl = parsed.searchParams.get("u");
      if (actualUrl) return actualUrl;
    }
  } catch {
  }
  return url;
}
__name(extractUrlFromLPHP, "extractUrlFromLPHP");

// src/index.ts
async function login(cookies, options) {
  const client = new Client(cookies, options);
  await client.connect();
  return client;
}
__name(login, "login");
function createClient(cookies, options) {
  return new Client(cookies, options);
}
__name(createClient, "createClient");
var index_default = { Client, login, createClient };
export {
  Client,
  THUMBS_UP_STICKER_IDS,
  ThreadType,
  UIDLogin,
  Utils,
  createClient,
  index_default as default,
  extractUrlFromLPHP,
  isThumbsUpSticker,
  login
};
//# sourceMappingURL=index.js.map