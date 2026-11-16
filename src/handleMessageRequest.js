"use strict";

const utils = require("../utils");
const log = require("npmlog");

module.exports = function (defaultFuncs, api, ctx) {
	const publishLsTask = require("./lsTask.js")(defaultFuncs, api, ctx);
	const getLsVersionId = require("./getLsVersionId.js")(defaultFuncs, api, ctx);

	return function handleMessageRequest(threadID, accept, callback) {
		if (utils.getType(accept) !== "Boolean") {
			throw {
				error: "Please pass a boolean as a second argument."
			};
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
			const form = {
				client: "mercury"
			};

			if (utils.getType(threadID) !== "Array") {
				threadID = [threadID];
			}

			const messageBox = accept ? "inbox" : "other";

			for (let i = 0; i < threadID.length; i++) {
				form[messageBox + "[" + i + "]"] = threadID[i];
			}

			defaultFuncs
				.post(
					"https://www.facebook.com/ajax/mercury/move_thread.php",
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
					log.error("handleMessageRequest", err);
					return callback(err);
				});
		};

		if (utils.getType(threadID) !== "Array") {
			threadID = [threadID];
		}

		// NEXUS LIGHTSPEED (v5.3): accepting a message request is the
		// AcceptMessageRequestTask (label 66, queue "message_request"):
		//   {thread_key, sync_group: 1, ig_folder: null}
		// (mautrix/meta socket/threads.go + its live usage in
		// pkg/connector/handlematrix.go:778-781, ig_folder left unset for
		// classic Facebook threads). Only ACCEPT is migrated: there is no
		// documented Lightspeed task for declining, so accept=false keeps
		// the proven web path directly.
		if (accept) {
			getLsVersionId()
				.then(function (versionId) {
					return publishLsTask({
						taskType: "accept_message_request",
						versionId: versionId,
						tasks: threadID.map(function (tid) {
							return {
								failure_count: null,
								label: "66",
								payload: JSON.stringify({
									thread_key: String(tid),
									sync_group: 1,
									ig_folder: null
								}),
								queue_name: "message_request",
								task_id: ++ctx.wsTaskNumber
							};
						})
					});
				})
				.then(function () {
					return callback();
				})
				.catch(function () {
					webFallback();
				});
		} else {
			webFallback();
		}

		return returnPromise;
	};
};
