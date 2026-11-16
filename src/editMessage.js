"use strict";

// Nexus-FCA: editMessage.js — edit a sent message through the shared
// Lightspeed task engine (label 742, queue "edit_message",
// {message_id, text} — mautrix/meta socket/threads.go). v5.3 normalizes
// the v5.2.x inline publisher onto publishLsTask (consistent ack routing,
// BigInt epoch ids instead of the old parseInt precision loss) and keeps
// the PendingEdits buffer with a bounded resend watchdog. There is no web
// path for editing, so a final failure is reported to the caller.

module.exports = function (defaultFuncs, api, ctx) {
	const publishLsTask = require("./lsTask.js")(defaultFuncs, api, ctx);

	return function editMessage(text, messageID, callback) {
		callback = callback || function () { };
		if (!ctx.mqttClient || !ctx.mqttClient.connected) {
			return callback(new Error("Not connected to MQTT"));
		}
		if (!messageID || typeof text !== "string") {
			return callback(new Error("Invalid arguments for editMessage"));
		}

		// Safety: manage pending edits buffer with cap & TTL
		const settings = ctx.globalOptions.editSettings || { maxPendingEdits: 200, editTTLms: 300000, ackTimeoutMs: 12000, maxResendAttempts: 2 };
		if (ctx.pendingEdits && typeof ctx.pendingEdits.set === "function") {
			if (ctx.pendingEdits.size >= settings.maxPendingEdits) {
				const firstKey = ctx.pendingEdits.keys().next().value;
				if (firstKey) { ctx.pendingEdits.delete(firstKey); if (ctx.health) ctx.health.incPendingEditDropped(); }
			}
			ctx.pendingEdits.set(messageID, { text, ts: Date.now(), attempts: 0 });
			if (ctx.health) ctx.health.addPendingEdit(messageID, text);
		}

		const attempt = function (attemptNo) {
			publishLsTask({
				taskType: "edit_message",
				versionId: "6903494529735864", // live-verified edit version id (v5.2.x)
				tasks: [{
					failure_count: null,
					label: "742",
					payload: JSON.stringify({ message_id: String(messageID), text: text }),
					queue_name: "edit_message",
					task_id: ++ctx.wsTaskNumber
				}]
			})
				.then(function () {
					if (ctx.pendingEdits && ctx.pendingEdits.delete) ctx.pendingEdits.delete(messageID);
					if (ctx.health) ctx.health.removePendingEdit(messageID);
					return callback(null, { queued: true, messageID: String(messageID) });
				})
				.catch(function (err) {
					// Bounded resend: retry while the TTL holds, then surface
					// the failure to the caller (editing has no web path).
					const rec = ctx.pendingEdits && ctx.pendingEdits.get ? ctx.pendingEdits.get(messageID) : null;
					if (rec && attemptNo < settings.maxResendAttempts && (Date.now() - rec.ts) < settings.editTTLms) {
						rec.attempts++;
						if (ctx.health) ctx.health.markEditResent(messageID);
						return attempt(attemptNo + 1);
					}
					if (ctx.pendingEdits && ctx.pendingEdits.delete) ctx.pendingEdits.delete(messageID);
					if (ctx.health) { ctx.health.removePendingEdit(messageID); ctx.health.markEditFailed(messageID); }
					return callback(err);
				});
		};
		attempt(0);
	};
};
