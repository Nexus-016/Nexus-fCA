"use strict";

const utils = require("../utils");
const log = require("npmlog");

module.exports = function (defaultFuncs, api, ctx) {
	const publishLsTask = require("./lsTask.js")(defaultFuncs, api, ctx);
	const getLsVersionId = require("./getLsVersionId.js")(defaultFuncs, api, ctx);

	// NEXUS LIGHTSPEED (v5.3): voting on a group poll with the UpdatePollTask
	// (label 164, queue "poll_update"):
	//   {thread_key, poll_id, added_options: [], selected_options, sync_group: 1}
	// (mautrix/meta pkg/messagix/socket/threads.go — Create() normalizes
	// added_options/selected_options to empty arrays when unset). The
	// selected_options carry poll OPTION ids — the same OptionID the receive
	// side votes are keyed by in LSAddPollVote (table/wrappedpoll.go), as
	// they appear in the thread's poll message data.
	//
	// This operation is Lightspeed-native: this library has no proven web
	// endpoint for voting, so a task failure is reported to the caller
	// instead of silently pretending it succeeded.
	return function votePoll(threadID, pollID, optionIDs, callback) {
		if (utils.getType(threadID) !== "Number" && utils.getType(threadID) !== "String") {
			throw { error: "votePoll: threadID should be of type Number or String." };
		}
		if (utils.getType(pollID) !== "Number" && utils.getType(pollID) !== "String") {
			throw { error: "votePoll: pollID should be of type Number or String." };
		}
		if (!Array.isArray(optionIDs)) {
			throw { error: "votePoll: optionIDs should be an array of poll option ids." };
		}

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

		getLsVersionId()
			.then(function (versionId) {
				return publishLsTask({
					taskType: "update_poll",
					versionId: versionId,
					tasks: [{
						failure_count: null,
						label: "164",
						payload: JSON.stringify({
							thread_key: String(threadID),
							poll_id: String(pollID),
							added_options: [],
							selected_options: optionIDs.map(String),
							sync_group: 1
						}),
						queue_name: "poll_update",
						task_id: ++ctx.wsTaskNumber
					}]
				});
			})
			.then(function () {
				return callback();
			})
			.catch(function (err) {
				log.error("votePoll", err);
				return callback(err);
			});

		return returnPromise;
	};
};
