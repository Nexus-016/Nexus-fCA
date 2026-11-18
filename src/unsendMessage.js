"use strict";

const utils = require("../utils");
const log = require("npmlog");

module.exports = function (defaultFuncs, api, ctx) {
	const publishLsTask = require("./lsTask.js")(defaultFuncs, api, ctx);

	return function unsendMessage(messageID, callback) {
		let resolveFunc = function () { };
		let rejectFunc = function () { };
		const returnPromise = new Promise(function (resolve, reject) {
			resolveFunc = resolve;
			rejectFunc = reject;
		});

		// Some callers pass a threadID as the second argument (old FCA
		// signature). Only accept real functions so the promise path still
		// works instead of crashing with "callback is not a function".
		if (typeof callback !== "function") {
			callback = function (err) {
				if (err) {
					return rejectFunc(err);
				}
				resolveFunc();
			};
		}

		// NEXUS LIGHTSPEED: unsend = LightSpeed task label 33, queue
		// "unsend_message", payload {message_id} — and nothing else.
		// Verified against the genuine upstream reference (0xzer/messagix,
		// socket/messages.go DeleteMessageTask + socket/task.go TaskLabels):
		// the task does NOT carry a thread_key or sync_group, so it also
		// works for messages sent in an earlier process whose thread
		// mapping is long gone. An earlier build padded the payload with
		// thread_key/sync_group that the genuine task does not carry —
		// keep the reference shape exactly instead.
		// Note: this removes the message for everyone (actor's own
		// message); deleting only for yourself is the separate delete task
		// (deleteMessage.js, label 146).
		publishLsTask({
			taskType: "unsend_message",
			versionId: "25393437286970779",
			tasks: [{
				failure_count: null,
				label: "33",
				payload: JSON.stringify({
					message_id: String(messageID)
				}),
				queue_name: "unsend_message",
				task_id: ++ctx.wsTaskNumber
			}]
		})
			.then(function () {
				return callback();
			})
			.catch(function (err) {
				log.warn("unsendMessage", "Lightspeed unsend rejected, trying web path: " +
					(err && err.message ? err.message : (err && err.error) || err));
				webFallback();
			});

		function webFallback() {
			const form = {
				message_id: messageID
			};

			defaultFuncs
				.post(
					"https://www.facebook.com/messaging/unsend_message/",
					ctx.jar,
					form
				)
				.then(utils.parseAndCheckLogin(ctx, defaultFuncs))
				.then(function (resData) {
					if (resData.error) {
						throw resData;
					}

					return callback();
				})
				.catch(function (err) {
					log.error("unsendMessage", err);
					return callback(err);
				});
		}

		return returnPromise;
	};
};
