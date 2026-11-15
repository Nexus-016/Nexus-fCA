"use strict";

var log = require("npmlog");

module.exports = function (defaultFuncs, api, ctx) {
	// NEXUS LIGHTSPEED: shared task publisher for every MQTT-backed
	// operation. One place owns the /ls_req envelope (app_id, version_id,
	// epoch_id, optional data_trace_id), the ctx.tasks ack routing, the
	// ack timeout and the cleanup — so all operations follow the same
	// fallback discipline: a publish error, a task-level rejection or a
	// missing ack always rejects the promise and the caller falls back to
	// the proven web path. Every fallback is safe because all migrated
	// operations (unsend, delete, nickname, admin, image, poll, emoji,
	// add-participant) are idempotent on re-application.
	//
	// opts: {
	//   taskType:    internal routing type understood by the listener's
	//                getTaskResponseData (e.g. "unsend_message")
	//   tasks:       one or more fully-built task objects ({label, payload,
	//                queue_name, task_id, failure_count})
	//   appId:       Messenger app id (defaults to the standard one)
	//   versionId:   task envelope version id
	//   dataTraceId: optional payload-level data_trace_id
	// }
	return function publishLsTask(opts) {
		return new Promise(function (resolve, reject) {
			if (!opts || typeof opts !== "object") {
				return reject({ error: "publishLsTask: options required." });
			}
			const client = ctx.mqttClient;
			if (!client || !client.connected || typeof client.publish !== "function") {
				return reject({ error: "MQTT not connected." });
			}

			ctx.wsReqNumber = ctx.wsReqNumber || 0;
			ctx.wsTaskNumber = ctx.wsTaskNumber || 0;
			const requestId = ++ctx.wsReqNumber;

			const tasks = Array.isArray(opts.tasks) ? opts.tasks : [opts.tasks];
			const payload = {
				tasks: tasks,
				epoch_id: (BigInt(Date.now()) << 22n).toString(),
				version_id: opts.versionId || "7214102258676893"
			};
			if (opts.dataTraceId !== undefined) payload.data_trace_id = opts.dataTraceId;

			const content = {
				app_id: opts.appId || "2220391788200892",
				payload: JSON.stringify(payload),
				request_id: requestId,
				type: 3
			};

			let settled = false;
			let timer = null;
			const finish = function (fn, arg) {
				if (settled) return;
				settled = true;
				if (timer) clearTimeout(timer);
				if (ctx.tasks && typeof ctx.tasks.delete === "function") ctx.tasks.delete(requestId);
				fn(arg);
			};

			const timeoutMs = Number(ctx._lsTaskTimeoutMs) > 0 ? Number(ctx._lsTaskTimeoutMs) : 15000;

			// Register the ack route BEFORE publishing so a fast /ls_resp
			// cannot be missed. The listener resolves it through
			// getTaskResponseData; a null extraction is surfaced as an
			// error so the caller can fall back.
			if (!ctx.tasks || typeof ctx.tasks.set !== "function") ctx.tasks = new Map();
			ctx.tasks.set(requestId, {
				type: opts.taskType || "generic_ls_task",
				callback: function (err, data) {
					if (err) {
						log.warn("lsTask", "Lightspeed task " + (opts.taskType || "") + " rejected");
						finish(reject, { error: "Lightspeed task rejected." });
						return;
					}
					finish(resolve, data);
				}
			});

			try {
				client.publish("/ls_req", JSON.stringify(content), { qos: 1 }, function (pubErr) {
					if (pubErr) {
						log.warn("lsTask", "Lightspeed publish failed: " + (pubErr.message || pubErr));
						finish(reject, pubErr && pubErr.message ? { error: pubErr.message } : { error: "Lightspeed publish failed." });
					}
				});
			} catch (publishErr) {
				finish(reject, publishErr && publishErr.message ? { error: publishErr.message } : { error: "Lightspeed publish failed." });
				return;
			}

			timer = setTimeout(function () {
				log.warn("lsTask", "Lightspeed task " + (opts.taskType || "") + " ack timed out");
				finish(reject, { error: "Lightspeed task ack timed out." });
			}, timeoutMs);
			if (typeof timer.unref === "function") timer.unref();
		});
	};
};
