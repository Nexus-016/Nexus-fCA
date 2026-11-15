"use strict";

const utils = require("../utils");
const log = require("npmlog");

module.exports = function (defaultFuncs, api, ctx) {
	const publishLsTask = require("./lsTask.js")(defaultFuncs, api, ctx);

	return function deleteMessage(messageOrMessages, callback) {
		let resolveFunc = function () { };
		let rejectFunc = function () { };
		const returnPromise = new Promise(function (resolve, reject) {
			resolveFunc = resolve;
			rejectFunc = reject;
		});
		if (!callback) {
			callback = function (err) {
				if (err) {
					return rejectFunc(err);
				}
				resolveFunc();
			};
		}

		if (utils.getType(messageOrMessages) !== "Array") {
			messageOrMessages = [messageOrMessages];
		}

		const webFallback = function () {
			const form = {
				client: "mercury"
			};

			for (let i = 0; i < messageOrMessages.length; i++) {
				form["message_ids[" + i + "]"] = messageOrMessages[i];
			}

			defaultFuncs
				.post(
					"https://www.facebook.com/ajax/mercury/delete_messages.php",
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
					log.error("deleteMessage", err);
					return callback(err);
				});
		};

		// NEXUS LIGHTSPEED: the delete task carries one task per message id
		// (the id doubles as the thread key) — the same shape the delete
		// task uses in the Messenger app. Deleting for yourself is
		// idempotent, so the web fallback below is always safe.
		publishLsTask({
			taskType: "delete_message",
			versionId: "25909428212080747",
			tasks: messageOrMessages.map(function (m) {
				return {
					failure_count: null,
					label: "146",
					payload: JSON.stringify({ thread_key: String(m), remove_type: 0, sync_group: 1 }),
					queue_name: String(m),
					task_id: ++ctx.wsTaskNumber
				};
			})
		})
			.then(function () {
				return callback();
			})
			.catch(function () {
				webFallback();
			});

		return returnPromise;
	};
};
