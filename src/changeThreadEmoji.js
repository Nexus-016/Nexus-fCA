"use strict";

const utils = require("../utils");
const log = require("npmlog");

module.exports = function (defaultFuncs, api, ctx) {
	const publishLsTask = require("./lsTask.js")(defaultFuncs, api, ctx);

	return function changeThreadEmoji(emoji, threadID, callback) {
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

		const webFallback = function () {
			const form = {
				emoji_choice: emoji,
				thread_or_other_fbid: threadID
			};

			defaultFuncs
				.post(
					"https://www.facebook.com/messaging/save_thread_emoji/?source=thread_settings&__pc=EXP1%3Amessengerdotcom_pkg",
					ctx.jar,
					form
				)
				.then(utils.parseAndCheckLogin(ctx, defaultFuncs))
				.then(function (resData) {
					if (resData.error === 1357031) {
						throw {
							error:
								"Trying to change emoji of a chat that doesn't exist. Have at least one message in the thread before trying to change the emoji."
						};
					}
					if (resData.error) {
						throw resData;
					}

					return callback();
				})
				.catch(function (err) {
					log.error("changeThreadEmoji", err);
					return callback(err);
				});
		};

		// NEXUS LIGHTSPEED: the app changes the thread quick-reaction emoji
		// through the thread_quick_reaction task (label 100003). Idempotent
		// op — the web fallback is always safe.
		publishLsTask({
			taskType: "change_thread_emoji",
			versionId: "8798795233522156",
			tasks: [{
				failure_count: null,
				label: "100003",
				payload: JSON.stringify({
					thread_key: String(threadID),
					custom_emoji: String(emoji),
					avatar_sticker_instruction_key_id: null,
					sync_group: 1
				}),
				queue_name: "thread_quick_reaction",
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
