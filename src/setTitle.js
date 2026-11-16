"use strict";

const utils = require("../utils");
const log = require("npmlog");

module.exports = function (defaultFuncs, api, ctx) {
	const publishLsTask = require("./lsTask.js")(defaultFuncs, api, ctx);
	const getLsVersionId = require("./getLsVersionId.js")(defaultFuncs, api, ctx);

	return function setTitle(newTitle, threadID, callback) {
		if (
			!callback &&
			(utils.getType(threadID) === "Function" ||
				utils.getType(threadID) === "AsyncFunction")
		) {
			throw { error: "please pass a threadID as a second argument." };
		}

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

		const webFallback = function () {
			const messageAndOTID = utils.generateOfflineThreadingID();
			const form = {
				client: "mercury",
				action_type: "ma-type:log-message",
				author: "fbid:" + (ctx.i_userID || ctx.userID),
				author_email: "",
				coordinates: "",
				timestamp: Date.now(),
				timestamp_absolute: "Today",
				timestamp_relative: utils.generateTimestampRelative(),
				timestamp_time_passed: "0",
				is_unread: false,
				is_cleared: false,
				is_forward: false,
				is_filtered_content: false,
				is_spoof_warning: false,
				source: "source:chat:web",
				"source_tags[0]": "source:chat",
				status: "0",
				offline_threading_id: messageAndOTID,
				message_id: messageAndOTID,
				threading_id: utils.generateThreadingID(ctx.clientID),
				manual_retry_cnt: "0",
				thread_fbid: threadID,
				thread_name: newTitle,
				thread_id: threadID,
				log_message_type: "log:thread-name"
			};

			defaultFuncs
				.post("https://www.facebook.com/messaging/set_thread_name/", ctx.jar, form)
				.then(utils.parseAndCheckLogin(ctx, defaultFuncs))
				.then(function (resData) {
					if (resData.error && resData.error === 1545012) {
						throw { error: "Cannot change chat title: Not member of chat." };
					}

					if (resData.error && resData.error === 1545003) {
						throw { error: "Cannot set title of single-user chat." };
					}

					if (resData.error) {
						throw resData;
					}

					return callback();
				})
				.catch(function (err) {
					log.error("setTitle", err);
					return callback(err);
				});
		};

		// NEXUS LIGHTSPEED (v5.3): the app renames groups with the
		// RenameThreadTask (label 32, queue = threadKey):
		//   {thread_key, thread_name, sync_group: 1}
		// (mautrix/meta socket/threads.go + its live usage in
		// pkg/connector/handlematrix.go). Renaming a DM is not supported by
		// the task (the bridge refuses it) — an LS failure here falls back to
		// the web form, which reports the proper single-user-chat error.
		getLsVersionId()
			.then(function (versionId) {
				return publishLsTask({
					taskType: "rename_thread",
					versionId: versionId,
					tasks: [{
						failure_count: null,
						label: "32",
						payload: JSON.stringify({
							thread_key: String(threadID),
							thread_name: String(newTitle),
							sync_group: 1
						}),
						queue_name: String(threadID),
						task_id: ++ctx.wsTaskNumber
					}]
				});
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
