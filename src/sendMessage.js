"use strict";

var utils = require("../utils");
var log = require("npmlog");
var bluebird = require("bluebird");

var allowedProperties = {
	attachment: true,
	url: true,
	sticker: true,
	emoji: true,
	emojiSize: true,
	body: true,
	mentions: true,
	location: true,
	// NEXUS EXPERIMENTAL: Messenger message effects ("power up style")
	effect: true,
	// NEXUS EXPERIMENTAL: raw attachment fbid (community-captured music/
	// XMA share shape, live verification pending)
	attachmentFbid: true,
};

module.exports = function (defaultFuncs, api, ctx) {
	// NEXUS LIGHTSPEED: native Messenger-app style send over MQTT /ls_req.
	// The Messenger app sends messages through the LightSpeed channel
	// (/ls_req tasks) instead of the legacy web endpoint; sending through
	// it keeps the bot's traffic pattern app-like and avoids the heavily
	// scrutinized www.facebook.com/messaging/send/ POST. Falls back to
	// the web path whenever MQTT is not connected or the message shape is
	// not supported by the task payload.
	const LS_APP_ID = "2220391788200892";
	const LS_VERSION_ID = "24804310205905615";
	const LS_SEND_LABEL = "46";
	const LS_READ_LABEL = "21";

	// NEXUS EXPERIMENTAL: message effects ("power up style"). The values
	// below are community-captured and are NOT documented in the genuine
	// references (messagix/mautrix carry no such field on SendMessageTask;
	// no public code anywhere sends this field). They are sent best-effort:
	// the server is expected to ignore unknown payload fields, so an
	// unrecognized value should just send the message normally without any
	// effect, and the web fallback still covers a hard rejection. Effects
	// apply to plain text/emoji sends only — sticker, attachment and
	// location sends drop the effect with a warning.
	// LIVE VERIFICATION (2026-11): LOVE, GIFT_WRAP, CELEBRATION and FIRE
	// render their Messenger effects — the community-captured mapping is
	// genuine for these four values. AVATAR_LOVE/ANGER/LAUGH/CRY did not
	// render: either the 1000-1003 values are wrong or avatar effects
	// additionally need the sender's Meta avatar configured. They stay in
	// the map marked unverified — the degrade-to-normal-send behavior
	// covers them either way.
	const LS_EFFECTS = {
		LOVE: 1,
		GIFT_WRAP: 2,
		CELEBRATION: 3,
		FIRE: 4,
		AVATAR_LOVE: 1000,
		AVATAR_ANGER: 1001,
		AVATAR_LAUGH: 1002,
		AVATAR_CRY: 1003
	};

	function canSendViaLightspeed(msg, threadIDType) {
		if (threadIDType === "Array") return false;
		const client = ctx.mqttClient;
		if (!client || !client.connected || typeof client.publish !== "function") return false;
		if (ctx.globalOptions && ctx.globalOptions.sendViaMqtt === false) return false;
		if (msg.url != null) return false; // explicit share-card flow stays on the web path
		if (msg.emoji != null && msg.body != null) return false; // web path validates this combination
		if (msg.sticker != null || msg.emoji != null) {
			// sticker/emoji own the send_type field — keep the combos the
			// task payload supports; anything mixed goes back to the web path
			if (msg.attachment != null || msg.location != null || msg.mentions != null) return false;
		}
		if (msg.attachment != null) {
			// attachments go through the LightSpeed task as fbids: every
			// attachment must be a readable stream the upload helper accepts
			const list = Array.isArray(msg.attachment) ? msg.attachment : [msg.attachment];
			for (const a of list) {
				if (!utils.isReadableStream(a)) return false;
			}
		}
		if (msg.location != null && !(msg.location.latitude != null && msg.location.longitude != null)) return false;
		// mentions are offsets into the text — a mention without body text
		// has no place to point at, so it stays on the web path
		if (msg.mentions != null && !(Array.isArray(msg.mentions) && msg.mentions.length && msg.body != null && msg.mentions.some(m => m && m.id != null))) return false;
		return msg.body != null || msg.sticker != null || msg.emoji != null || msg.attachment != null || msg.location != null || msg.attachmentFbid != null;
	}

	// NEXUS LIGHTSPEED: mention_data shape — comma-joined ids/offsets/
	// lengths/types referencing the plain body (no marker char prepended;
	// the web path's \u200E marker is a web-form-only behavior).
	function buildMentionData(msg, body) {
		if (!Array.isArray(msg.mentions) || !msg.mentions.length) return null;
		const ids = [], offsets = [], lengths = [], types = [];
		for (const m of msg.mentions) {
			if (!m || m.id == null) continue;
			let tag = String(m.tag || "");
			if (tag && tag.charAt(0) !== "@") tag = "@" + tag;
			const fromIndex = Number.isInteger(m.fromIndex) ? m.fromIndex : 0;
			let offset = body ? body.indexOf(tag, fromIndex) : -1;
			if (offset < 0 && tag.length > 1) offset = body ? body.indexOf(tag.slice(1), fromIndex) : -1;
			if (offset < 0) offset = 0;
			ids.push(String(m.id));
			offsets.push(String(offset));
			lengths.push(String(tag.length));
			types.push("p");
		}
		if (!ids.length) return null;
		return {
			mention_ids: ids.join(","),
			mention_offsets: offsets.join(","),
			mention_lengths: lengths.join(","),
			mention_types: types.join(",")
		};
	}

	// Collect LightSpeed attachment fbids from the upload metadata (the
	// upload endpoint reports the id under a type-specific key).
	function collectAttachmentFbids(metadataList) {
		const fbids = [];
		for (const m of metadataList || []) {
			if (!m) continue;
			const fbid = m.image_id || m.video_id || m.audio_id || m.file_id || m.gif_id || m.sticker_id;
			if (fbid) fbids.push(String(fbid));
		}
		return fbids;
	}

	// NEXUS LIGHTSPEED: message-id -> thread-id index so the unsend task
	// can fill its thread_key without an extra lookup (capped, FIFO).
	function recordMessageThread(messageID, threadID) {
		if (!ctx._messageThreadIndex || typeof ctx._messageThreadIndex.set !== "function") ctx._messageThreadIndex = new Map();
		const m = ctx._messageThreadIndex;
		m.set(String(messageID), String(threadID));
		if (m.size > 500) {
			const firstKey = m.keys().next().value;
			m.delete(firstKey);
		}
	}

	function sendViaLightspeed(msg, threadID, callback, replyToMessage, messageAndOTID, webFallback, attachmentFbids) {
		const client = ctx.mqttClient;
		ctx.wsReqNumber = ctx.wsReqNumber || 0;
		ctx.wsTaskNumber = ctx.wsTaskNumber || 0;
		const requestId = ++ctx.wsReqNumber;

		const body = msg.body != null ? String(msg.body) : "";
		const payload0 = {
			thread_id: String(threadID),
			otid: messageAndOTID,
			source: 2097153,
			send_type: 1,
			sync_group: 1,
			mark_thread_read: 1,
			text: body === "" ? null : body,
			initiating_source: 0,
			skip_url_preview_gen: 1,
			text_has_links: /(https?:\/\/|www\.)/i.test(body) ? 1 : 0,
			multitab_env: 0,
			metadata_dataclass: JSON.stringify({ media_accessibility_metadata: { alt_text: null } })
		};

		if (msg.sticker) { payload0.send_type = 2; payload0.sticker_id = msg.sticker; }
		if (msg.emoji) {
			payload0.send_type = 1;
			payload0.text = msg.emoji;
			payload0.hot_emoji_size = msg.emojiSize === "small" ? 1 : msg.emojiSize === "large" ? 3 : 2;
		}
		// NEXUS EXPERIMENTAL: power_up_style rides on plain text/emoji sends
		// (send_type 1). Mixed sends keep the message but drop the effect.
		if (msg.effect != null) {
			if (msg.sticker != null || msg.attachment != null || msg.location != null || msg.attachmentFbid != null) {
				log.warn("sendMessage", "Effects apply to text messages only — dropping the effect for this send");
			} else {
				const effectStyle = LS_EFFECTS[String(msg.effect).toUpperCase()];
				if (effectStyle != null) payload0.power_up_style = effectStyle;
				else log.warn("sendMessage", "Unknown effect \"" + msg.effect + "\" — sending without an effect");
			}
		}
		if (replyToMessage) {
			payload0.reply_metadata = {
				reply_source_id: String(replyToMessage),
				reply_source_type: 1,
				reply_type: 0
			};
		}
		const mentionData = buildMentionData(msg, body);
		if (mentionData) payload0.mention_data = mentionData;
		if (msg.location && msg.location.latitude != null && msg.location.longitude != null) {
			payload0.send_type = 1;
			payload0.location_data = {
				coordinates: { latitude: msg.location.latitude, longitude: msg.location.longitude },
				is_current_location: Boolean(msg.location.current),
				is_live_location: Boolean(msg.location.live)
			};
		}
		if (attachmentFbids && attachmentFbids.length) {
			// attachment carries its own send_type; the upload already
			// happened on the proven web upload endpoint before this point
			payload0.send_type = 3;
			payload0.text = body === "" ? null : body;
			payload0.attachment_fbids = attachmentFbids.map(String);
		}

		// NEXUS EXPERIMENTAL: raw attachment fbid (community-captured music/
		// XMA share shape): the fbid rides attachment_fbids with send_type
		// 1 (TEXT) — no upload, no read-task pairing. Live verification
		// pending; if this shape proves wrong the next candidate is
		// send_type 3 (MEDIA), the pairing the genuine references use for
		// uploaded media.
		if (msg.attachmentFbid != null) {
			payload0.send_type = 1;
			payload0.attachment_fbids = (Array.isArray(msg.attachmentFbid) ? msg.attachmentFbid : [msg.attachmentFbid]).map(String);
		}

		// The task envelope: the send task plus the read-watermark task
		// the Messenger app publishes alongside every send.
		const tasks = [{
			failure_count: null,
			label: LS_SEND_LABEL,
			payload: JSON.stringify(payload0),
			queue_name: String(threadID),
			task_id: ++ctx.wsTaskNumber
		}];
		if (attachmentFbids && attachmentFbids.length) {
			tasks.push({
				failure_count: null,
				label: LS_READ_LABEL,
				payload: JSON.stringify({
					thread_id: String(threadID),
					last_read_watermark_ts: Date.now(),
					sync_group: 1
				}),
				queue_name: String(threadID),
				task_id: ++ctx.wsTaskNumber
			});
		}

		const content = {
			app_id: LS_APP_ID,
			payload: JSON.stringify({
				tasks: tasks,
				epoch_id: (BigInt(Date.now()) << 22n).toString(),
				version_id: LS_VERSION_ID,
				data_trace_id: "#" + Buffer.from(String(Math.random())).toString("base64").replace(/=+$/, "")
			}),
			request_id: requestId,
			type: 3
		};

		let settled = false;
		const finish = (err, messageInfo) => {
			if (settled) return;
			settled = true;
			if (ctx.tasks && typeof ctx.tasks.delete === "function") ctx.tasks.delete(requestId);
			clearTimeout(timer);
			callback(err, messageInfo);
		};

		// NEXUS EXPERIMENTAL: attachmentFbid sends have no web fallback —
		// the legacy form cannot reference a foreign fbid, so surfacing the
		// error beats sending a duplicate plain-text message.
		const suppressWebFallback = msg.attachmentFbid != null;

		const timeoutMs = Number(ctx._lsSendTimeoutMs) > 0 ? Number(ctx._lsSendTimeoutMs) : 15000;
		const timer = setTimeout(function () {
			log.warn("sendMessage", "Lightspeed send ack timed out, falling back to the web send path");
			if (suppressWebFallback) {
				finish({ error: "Lightspeed send ack timed out (attachmentFbid send — no web fallback available)." });
				return;
			}
			try { webFallback(); } catch (e) { finish(e); }
		}, timeoutMs);
		if (typeof timer.unref === "function") timer.unref();

		// Route the /ls_resp for this request through the shared tasks map:
		// the listener resolves it via getTaskResponseData. A task whose ids
		// cannot be extracted is treated as delivered-with-unknown-id (the
		// publish was accepted at QoS 1) — falling back to the web path here
		// would risk a duplicate message.
		if (!ctx.tasks || typeof ctx.tasks.set !== "function") ctx.tasks = new Map();
		ctx.tasks.set(requestId, {
			type: "send_message_mqtt",
			callback: function (err, data) {
				if (err) {
					log.warn("sendMessage", "Lightspeed send rejected, falling back to the web send path");
					if (suppressWebFallback) {
						finish(err);
						return;
					}
					try { webFallback(); } catch (e) { finish(e); }
					return;
				}
				const messageID = data.messageID || String(messageAndOTID);
				recordMessageThread(messageID, data.threadID || threadID);
				finish(null, {
					threadID: String(data.threadID || threadID),
					messageID: messageID,
					senderID: String(ctx.userID),
					timestamp: String(Date.now()),
					attachments: [],
					body: body || "",
					type: "message"
				});
			}
		});

		try {
			client.publish("/ls_req", JSON.stringify(content), { qos: 1 });
		} catch (publishErr) {
			finish(publishErr && publishErr.message ? { error: publishErr.message } : { error: "Lightspeed publish failed." });
		}
	}

	// Helper function to retry upload with delay
	async function retryUpload(form, maxRetries = 3, delayMs = 2000) {
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				const res = await defaultFuncs
					.postFormData("https://upload.facebook.com/ajax/mercury/upload.php", ctx.jar, form, {}, {})
					.then(utils.parseAndCheckLogin(ctx, defaultFuncs));
				
				if (res.error) throw res;
				return res.payload.metadata[0];
			} catch (err) {
				// NEXUS ATTACHMENT FIX: the temp file is gone (caller deleted
				// it or the OS removed it) — no retry can bring it back, so
				// fail fast instead of stalling the send chain for
				// maxRetries × delayMs with the same ENOENT every time.
				const msg = String(err && (err.message || err.code || err));
				if (err && (err.code === "ENOENT" || msg.includes("ENOENT"))) throw err;
				if (attempt === maxRetries) throw err;
				log.warn("uploadAttachment", `Attempt ${attempt} failed, retrying in ${delayMs}ms...`);
				await new Promise(resolve => setTimeout(resolve, delayMs));
			}
		}
	}

	function uploadAttachment(attachments, callback) {
		var uploads = [];

		// create an array of promises
		for (var i = 0; i < attachments.length; i++) {
			if (!utils.isReadableStream(attachments[i])) throw { error: "Attachment should be a readable stream and not " + utils.getType(attachments[i]) + "." };
			var form = {
				upload_1024: attachments[i],
				voice_clip: "true"
			};

			uploads.push(retryUpload(form));
		}

		// resolve all promises
		bluebird
			.all(uploads)
			.then(resData => callback(null, resData))
			.catch(function (err) {
				log.error("uploadAttachment", err);
				return callback(err);
			});
	}

	function getUrl(url, callback) {
		var form = {
			image_height: 960,
			image_width: 960,
			uri: url
		};

		defaultFuncs
			.post("https://www.facebook.com/message_share_attachment/fromURI/", ctx.jar, form)
			.then(utils.parseAndCheckLogin(ctx, defaultFuncs))
			.then(function (resData) {
				if (resData.error) return callback(resData);
				if (!resData.payload) return callback({ error: "Invalid url" });
				callback(null, resData.payload.share_data.share_params);
			})
			.catch(function (err) {
				log.error("getUrl", err);
				return callback(err);
			});
	}

	function sendContent(form, threadID, isSingleUser, messageAndOTID, callback) {
		// There are three cases here:
		// 1. threadID is of type array, where we're starting a new group chat with users
		//    specified in the array.
		// 2. User is sending a message to a specific user.
		// 3. No additional form params and the message goes to an existing group chat.
		if (utils.getType(threadID) === "Array") {
			for (var i = 0; i < threadID.length; i++) form["specific_to_list[" + i + "]"] = "fbid:" + threadID[i];
			form["specific_to_list[" + threadID.length + "]"] = "fbid:" + ctx.userID;
			form["client_thread_id"] = "root:" + messageAndOTID;
			log.info("sendMessage", "Sending message to multiple users: " + threadID);
		}
		else {
			// This means that threadID is the id of a user, and the chat
			// is a single person chat
			if (isSingleUser) {
				form["specific_to_list[0]"] = "fbid:" + threadID;
				form["specific_to_list[1]"] = "fbid:" + ctx.userID;
				form["other_user_fbid"] = threadID;
			}
			else form["thread_fbid"] = threadID;
		}

		if (ctx.globalOptions.pageID) {
			form["author"] = "fbid:" + ctx.globalOptions.pageID;
			form["specific_to_list[1]"] = "fbid:" + ctx.globalOptions.pageID;
			form["creator_info[creatorID]"] = ctx.userID;
			form["creator_info[creatorType]"] = "direct_admin";
			form["creator_info[labelType]"] = "sent_message";
			form["creator_info[pageID]"] = ctx.globalOptions.pageID;
			form["request_user_id"] = ctx.globalOptions.pageID;
			form["creator_info[profileURI]"] = "https://www.facebook.com/profile.php?id=" + ctx.userID;
		}

		defaultFuncs
			.post("https://www.facebook.com/messaging/send/", ctx.jar, form)
			.then(utils.parseAndCheckLogin(ctx, defaultFuncs))
			.then(function (resData) {
				if (!resData) return callback({ error: "Send message failed." });
				if (resData.error) {
					if (resData.error === 1545012) {
						log.warn("sendMessage", "Got error 1545012. This might mean that you're not part of the conversation " + threadID);
					}
					else {
						log.error("sendMessage", resData);
					}
					return callback(resData);
				}

				var messageInfo = resData.payload.actions.reduce(function (p, v) {
					return (
						{
							threadID: v.thread_fbid,
							messageID: v.message_id,
							timestamp: v.timestamp
						} || p
					);
				}, null);

				if (messageInfo && messageInfo.messageID != null) recordMessageThread(messageInfo.messageID, messageInfo.threadID);

				return callback(null, messageInfo);
			})
			.catch(function (err) {
				log.error("sendMessage", err);
				if (utils.getType(err) == "Object" && err.error === "Not logged in.") ctx.loggedIn = false;
				return callback(err);
			});
	}

	function send(form, threadID, messageAndOTID, callback, isGroup) {
		// We're doing a query to this to check if the given id is the id of
		// a user or of a group chat. The form will be different depending
		// on that.
		if (utils.getType(threadID) === "Array") sendContent(form, threadID, false, messageAndOTID, callback);
		else {
			if (utils.getType(isGroup) != "Boolean") sendContent(form, threadID, threadID.length === 15, messageAndOTID, callback);
			else sendContent(form, threadID, !isGroup, messageAndOTID, callback);
		}
	}

	function handleUrl(msg, form, callback, cb) {
		if (msg.url) {
			form["shareable_attachment[share_type]"] = "100";
			getUrl(msg.url, function (err, params) {
				if (err) return callback(err);
				form["shareable_attachment[share_params]"] = params;
				cb();
			});
		}
		else cb();
	}

	function handleLocation(msg, form, callback, cb) {
		if (msg.location) {
			if (msg.location.latitude == null || msg.location.longitude == null) return callback({ error: "location property needs both latitude and longitude" });
			form["location_attachment[coordinates][latitude]"] = msg.location.latitude;
			form["location_attachment[coordinates][longitude]"] = msg.location.longitude;
			form["location_attachment[is_current_location]"] = !!msg.location.current;
		}
		cb();
	}

	function handleSticker(msg, form, callback, cb) {
		if (msg.sticker) form["sticker_id"] = msg.sticker;
		cb();
	}

	function handleEmoji(msg, form, callback, cb) {
		if (msg.emojiSize != null && msg.emoji == null) return callback({ error: "emoji property is empty" });
		if (msg.emoji) {
			if (msg.emojiSize == null) msg.emojiSize = "medium";
			if (msg.emojiSize != "small" && msg.emojiSize != "medium" && msg.emojiSize != "large") return callback({ error: "emojiSize property is invalid" });
			if (form["body"] != null && form["body"] != "") return callback({ error: "body is not empty" });
			form["body"] = msg.emoji;
			form["tags[0]"] = "hot_emoji_size:" + msg.emojiSize;
		}
		cb();
	}

	function handleAttachment(msg, form, callback, cb) {
		if (msg.attachment) {
			form["image_ids"] = [];
			form["gif_ids"] = [];
			form["file_ids"] = [];
			form["video_ids"] = [];
			form["audio_ids"] = [];

			if (utils.getType(msg.attachment) !== "Array") msg.attachment = [msg.attachment];
			if (msg.attachment.every(e => /_id$/.test(e[0]))) {
				//console.log(msg.attachment)
				msg.attachment.map(e => form[`${e[0]}s`].push(e[1]));
				return cb();
			}
			uploadAttachment(msg.attachment, function (err, files) {
				if (err) return callback(err);
				files.forEach(function (file) {
					var key = Object.keys(file);
					var type = key[0]; // image_id, file_id, etc
					form["" + type + "s"].push(file[type]); // push the id
				});
				cb();
			});
		}
		else cb();
	}

	function handleMention(msg, form, callback, cb) {
		if (Array.isArray(msg.mentions) && msg.mentions.length) {
			const body = String(msg.body || "");
			let mentionIndex = 0;
			for (let i = 0; i < msg.mentions.length; i++) {
				const mention = msg.mentions[i];
				if (!mention || typeof mention !== "object") continue;
				const tag = mention.tag;
				if (typeof tag !== "string" || !tag) continue;
				const id = utils.normalizeMentionID(mention.id);
				if (!id)
					continue;

				const fromIndex = Number(mention.fromIndex) || 0;
				let offset = body.indexOf(tag, fromIndex);
				if (offset < 0)
					offset = body.toLowerCase().indexOf(tag.toLowerCase(), fromIndex);
				if (offset < 0) {
					log.warn("handleMention", 'Mention for "' + tag + '" not found in message string.');
					continue;
				}

				const emptyChar = '\u200E';
				form["body"] = emptyChar + body;
				form["profile_xmd[" + mentionIndex + "][offset]"] = offset + 1;
				form["profile_xmd[" + mentionIndex + "][length]"] = tag.length;
				form["profile_xmd[" + mentionIndex + "][id]"] = id;
				form["profile_xmd[" + mentionIndex + "][type]"] = "p";
				mentionIndex++;
			}
		}
		cb();
	}

	return function sendMessage(msg, threadID, callback, replyToMessage, isGroup) {
		typeof isGroup == "undefined" ? isGroup = null : "";
		if (!callback && (utils.getType(threadID) === "Function" || utils.getType(threadID) === "AsyncFunction")) return threadID({ error: "Pass a threadID as a second argument." });
		if (!replyToMessage && utils.getType(callback) === "String") {
			replyToMessage = callback;
			callback = function () { };
		}

		var resolveFunc = function () { };
		var rejectFunc = function () { };
		var returnPromise = new Promise(function (resolve, reject) {
			resolveFunc = resolve;
			rejectFunc = reject;
		});

		if (!callback) {
			callback = function (err, data) {
				if (err) return rejectFunc(err);
				resolveFunc(data);
			};
		}

		var msgType = utils.getType(msg);
		var threadIDType = utils.getType(threadID);
		var messageIDType = utils.getType(replyToMessage);

		if (msgType !== "String" && msgType !== "Object") return callback({ error: "Message should be of type string or object and not " + msgType + "." });

		// Changing this to accomodate an array of users
		if (threadIDType !== "Array" && threadIDType !== "Number" && threadIDType !== "String") return callback({ error: "ThreadID should be of type number, string, or array and not " + threadIDType + "." });

		// NEXUS FIX (GoatBot V2 parity): the bot framework's reply lookup is
		// ID-type-tolerant because some FCA builds emit numeric message IDs.
		// Coerce a numeric replyToMessage instead of rejecting it, so dev
		// code that stored a numeric ID does not crash here.
		if (replyToMessage && messageIDType !== 'String') {
			if (messageIDType === 'Number') replyToMessage = String(replyToMessage);
			else return callback({ error: "MessageID should be of type string and not " + messageIDType + "." });
		}

		if (msgType === "String") msg = { body: msg };
		var disallowedProperties = Object.keys(msg).filter(prop => !allowedProperties[prop]);
		if (disallowedProperties.length > 0) return callback({ error: "Dissallowed props: `" + disallowedProperties.join(", ") + "`" });

		var messageAndOTID = utils.generateOfflineThreadingID();

		var form = {
			client: "mercury",
			action_type: "ma-type:user-generated-message",
			author: "fbid:" + ctx.userID,
			timestamp: Date.now(),
			timestamp_absolute: "Today",
			timestamp_relative: utils.generateTimestampRelative(),
			timestamp_time_passed: "0",
			is_unread: false,
			is_cleared: false,
			is_forward: false,
			is_filtered_content: false,
			is_filtered_content_bh: false,
			is_filtered_content_account: false,
			is_filtered_content_quasar: false,
			is_filtered_content_invalid_app: false,
			is_spoof_warning: false,
			source: "source:chat:web",
			"source_tags[0]": "source:chat",
			body: msg.body ? msg.body.toString() : "",
			html_body: false,
			ui_push_phase: "V3",
			status: "0",
			offline_threading_id: messageAndOTID,
			message_id: messageAndOTID,
			threading_id: utils.generateThreadingID(ctx.clientID),
			"ephemeral_ttl_mode:": "0",
			manual_retry_cnt: "0",
			has_attachment: !!(msg.attachment || msg.url || msg.sticker),
			signatureID: utils.getSignatureID(),
			replied_to_message_id: replyToMessage,
			reply_metadata: replyToMessage ? JSON.stringify({
				reply_source_id: replyToMessage,
				reply_source_type: 1, // 1: Message
				reply_type: 0 // 0: Reply
			}) : undefined
		};

		// NEXUS LIGHTSPEED: prefer the Messenger-app send path when MQTT is
		// connected and the message shape is supported; the web chain below
		// remains the fallback for everything else.
		const sendViaWebChain = () =>
			handleLocation(msg, form, callback, () =>
				handleSticker(msg, form, callback, () =>
					handleAttachment(msg, form, callback, () =>
						handleUrl(msg, form, callback, () =>
							handleEmoji(msg, form, callback, () =>
								handleMention(msg, form, callback, () =>
									send(form, threadID, messageAndOTID, callback, isGroup)
								)
							)
						)
					)
				)
			);

		// NEXUS EXPERIMENTAL: effects only ride the Lightspeed task — the
		// legacy web endpoint has no power_up_style, so warn when a caller
		// asks for an effect on a send that has to take the web path.
		if (msg.effect != null && !canSendViaLightspeed(msg, threadIDType))
			log.warn("sendMessage", "effect is only supported on the Lightspeed send path — it will be ignored on the web fallback for this send");

		// NEXUS EXPERIMENTAL: raw attachment fbids only ride the Lightspeed
		// task — the legacy web form cannot reference a foreign fbid, so a
		// send that cannot take Lightspeed fails loudly instead of silently
		// degrading to a plain text message.
		if (msg.attachmentFbid != null && !canSendViaLightspeed(msg, threadIDType)) {
			return callback({ error: "attachmentFbid needs the Lightspeed send path (MQTT connected) — it cannot ride the legacy web path." });
		}

		if (!canSendViaLightspeed(msg, threadIDType)) {
			sendViaWebChain();
			return returnPromise;
		}

		if (msg.attachment != null) {
			// NEXUS LIGHTSPEED: attachments go through the task payload as
			// fbids, so the streams are uploaded through the existing (and
			// proven) web upload endpoint first, then referenced in the
			// LightSpeed task. Any upload problem routes the whole message
			// through the web chain, which reports errors in the same shape
			// as before.
			const streams = (Array.isArray(msg.attachment) ? msg.attachment : [msg.attachment]);
			uploadAttachment(streams, function (uploadErr, metadataList) {
				const fbids = uploadErr ? [] : collectAttachmentFbids(metadataList);
				if (!fbids.length) {
					sendViaWebChain();
					return;
				}
				sendViaLightspeed(msg, threadID, callback, replyToMessage, messageAndOTID, sendViaWebChain, fbids);
			});
			return returnPromise;
		}

		sendViaLightspeed(msg, threadID, callback, replyToMessage, messageAndOTID, sendViaWebChain, null);
		return returnPromise;
	};
};
