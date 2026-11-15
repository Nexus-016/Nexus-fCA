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

		if (!callback) {
			callback = function (err, friendList) {
				if (err) {
					return rejectFunc(err);
				}
				resolveFunc(friendList);
			};
		}

		// NEXUS LIGHTSPEED: the unsend task (label 33) carries the thread
		// key alongside the message id. The bot unsends overwhelmingly its
		// own messages, whose thread id is indexed at send time; when the
		// id is unknown the message id itself is used as the key (same
		// convention the delete task uses) and any uncertainty is covered
		// by the web fallback below — an unsend is idempotent, so falling
		// back after a possible server-side application can never corrupt
		// the thread state.
		const index = ctx._messageThreadIndex;
		const threadKey = (index && index.get(String(messageID))) || String(messageID);

		const webFallback = function () {
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
		};

		publishLsTask({
			taskType: "unsend_message",
			versionId: "25393437286970779",
			tasks: [{
				failure_count: null,
				label: "33",
				payload: JSON.stringify({
					message_id: String(messageID),
					thread_key: threadKey,
					sync_group: 1
				}),
				queue_name: "unsend_message",
				task_id: ++ctx.wsTaskNumber
			}]
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
