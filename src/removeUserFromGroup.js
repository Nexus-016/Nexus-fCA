"use strict";

const utils = require("../utils");
const log = require("npmlog");

module.exports = function (defaultFuncs, api, ctx) {
	const publishLsTask = require("./lsTask.js")(defaultFuncs, api, ctx);
	const getLsVersionId = require("./getLsVersionId.js")(defaultFuncs, api, ctx);

	return function removeUserFromGroup(userID, threadID, callback) {
		if (
			!callback &&
			(utils.getType(threadID) === "Function" ||
				utils.getType(threadID) === "AsyncFunction")
		) {
			throw { error: "please pass a threadID as a second argument." };
		}
		if (
			utils.getType(threadID) !== "Number" &&
			utils.getType(threadID) !== "String"
		) {
			throw {
				error:
					"threadID should be of type Number or String and not " +
					utils.getType(threadID) +
					"."
			};
		}
		if (
			utils.getType(userID) !== "Number" &&
			utils.getType(userID) !== "String"
		) {
			throw {
				error:
					"userID should be of type Number or String and not " +
					utils.getType(userID) +
					"."
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
				uid: userID,
				tid: threadID
			};

			defaultFuncs
				.post("https://www.facebook.com/chat/remove_participants", ctx.jar, form)
				.then(utils.parseAndCheckLogin(ctx, defaultFuncs))
				.then(function (resData) {
					if (!resData) {
						throw { error: "Remove from group failed." };
					}
					if (resData.error) {
						throw resData;
					}

					return callback();
				})
				.catch(function (err) {
					log.error("removeUserFromGroup", err);
					return callback(err);
				});
		};

		// NEXUS LIGHTSPEED (v5.3): the app removes a participant with the
		// RemoveParticipantTask (label 140, queue "remove_participant_v2"):
		//   {thread_id, contact_id}
		// (mautrix/meta pkg/messagix/socket/threads.go). NOTE the field names:
		// this task uses thread_id + contact_id, not thread_key like most
		// other tasks. Removing the same member twice is idempotent, so the
		// web fallback stays safe.
		getLsVersionId()
			.then(function (versionId) {
				return publishLsTask({
					taskType: "remove_participant",
					versionId: versionId,
					tasks: [{
						failure_count: null,
						label: "140",
						payload: JSON.stringify({
							thread_id: String(threadID),
							contact_id: String(userID)
						}),
						queue_name: "remove_participant_v2",
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
