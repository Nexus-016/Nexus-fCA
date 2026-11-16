"use strict";

const utils = require("../utils");
const log = require("npmlog");

// Depth-first scan for the optimistic→real thread mapping the server
// returns with the create-group ack: LSReplaceOptimisticThread rows pair
// our locally generated thread id (ThreadKey1) with the real group id
// (ThreadKey2) — mautrix/meta reads exactly that from the task response
// (pkg/connector/startchat.go:104-113). The walk tolerates arrays and
// index-keyed objects so it does not depend on the exact envelope nesting.
function findOptimisticThreadReplace(node, optimisticId) {
	if (Array.isArray(node)) {
		if (
			node.length === 2 &&
			node[0] !== null && node[0] !== undefined &&
			String(node[0]) === String(optimisticId) &&
			node[1] !== null && node[1] !== undefined &&
			String(node[1]) !== String(optimisticId)
		) {
			return String(node[1]);
		}
		for (const child of node) {
			const found = findOptimisticThreadReplace(child, optimisticId);
			if (found) return found;
		}
	} else if (node && typeof node === "object") {
		if (
			node["0"] !== undefined && node["1"] !== undefined &&
			String(node["0"]) === String(optimisticId) &&
			String(node["1"]) !== String(optimisticId)
		) {
			return String(node["1"]);
		}
		for (const key of Object.keys(node)) {
			const found = findOptimisticThreadReplace(node[key], optimisticId);
			if (found) return found;
		}
	}
	return null;
}

module.exports = function (defaultFuncs, api, ctx) {
	const publishLsTask = require("./lsTask.js")(defaultFuncs, api, ctx);
	const getLsVersionId = require("./getLsVersionId.js")(defaultFuncs, api, ctx);

	return function createNewGroup(participantIDs, groupTitle, callback) {
		if (utils.getType(groupTitle) == "Function") {
			callback = groupTitle;
			groupTitle = null;
		}

		if (utils.getType(participantIDs) !== "Array") {
			throw { error: "createNewGroup: participantIDs should be an array." };
		}

		if (participantIDs.length < 2) {
			throw { error: "createNewGroup: participantIDs should have at least 2 IDs." };
		}

		let resolveFunc = function () { };
		let rejectFunc = function () { };
		const returnPromise = new Promise(function (resolve, reject) {
			resolveFunc = resolve;
			rejectFunc = reject;
		});

		if (!callback) {
			callback = function (err, threadID) {
				if (err) {
					return rejectFunc(err);
				}
				resolveFunc(threadID);
			};
		}

		const webFallback = function () {
			const pids = [];
			for (const n in participantIDs) {
				pids.push({
					fbid: participantIDs[n]
				});
			}
			pids.push({ fbid: ctx.i_userID || ctx.userID });

			const form = {
				fb_api_caller_class: "RelayModern",
				fb_api_req_friendly_name: "MessengerGroupCreateMutation",
				av: ctx.i_userID || ctx.userID,
				//This doc_id is valid as of January 11th, 2020
				doc_id: "577041672419534",
				variables: JSON.stringify({
					input: {
						entry_point: "jewel_new_group",
						actor_id: ctx.i_userID || ctx.userID,
						participants: pids,
						client_mutation_id: Math.round(Math.random() * 1024).toString(),
						thread_settings: {
							name: groupTitle,
							joinable_mode: "PRIVATE",
							thread_image_fbid: null
						}
					}
				})
			};

			defaultFuncs
				.post(
					"https://www.facebook.com/api/graphql/",
					ctx.jar,
					form
				)
				.then(utils.parseAndCheckLogin(ctx, defaultFuncs))
				.then(function (resData) {
					if (resData.errors) {
						throw resData;
					}
					return callback(null, resData.data.messenger_group_thread_create.thread.thread_key.thread_fbid);
				})
				.catch(function (err) {
					log.error("createNewGroup", err);
					return callback(err);
				});
		};

		// NEXUS LIGHTSPEED (v5.3): the app creates groups with the
		// CreateGroupTask (label 130, queue = the optimistic thread id):
		//   {participants, send_payload: {thread_id, otid, source: 0, send_type: 8}}
		// (mautrix/meta socket/threads.go + its live usage in
		// pkg/connector/startchat.go:82-90). The thread_id and otid are
		// locally generated epoch ids; the ack response carries the
		// optimistic→real thread mapping (see findOptimisticThreadReplace).
		// The participants list contains the INVITED members only — the
		// executing account is the implicit actor of the task (the web form,
		// in contrast, needs the actor + self listed explicitly).
		const epochId = utils.generateOfflineThreadingID();

		getLsVersionId()
			.then(function (versionId) {
				return publishLsTask({
					taskType: "create_group",
					versionId: versionId,
					tasks: [{
						failure_count: null,
						label: "130",
						payload: JSON.stringify({
							participants: participantIDs.map(function (u) { return String(u); }),
							send_payload: {
								thread_id: epochId,
								otid: epochId,
								source: 0,
								send_type: 8
							}
						}),
						queue_name: String(epochId),
						task_id: ++ctx.wsTaskNumber
					}]
				});
			})
			.then(function (ack) {
				const realThreadID = ack && findOptimisticThreadReplace(ack.raw, epochId);
				if (realThreadID) {
					return callback(null, realThreadID);
				}
				log.warn("createNewGroup", "Group creation acknowledged, but the ack did not carry the optimistic→real thread mapping; returning the optimistic id.");
				return callback(null, epochId);
			})
			.catch(function (err) {
				// Creation is NOT idempotent: only fall back to the web path
				// when the task provably never ran (publish error or an
				// explicit task rejection). On an ack timeout the server may
				// have already created the group — a web retry would create a
				// duplicate, so surface an explicit unknown-outcome error.
				if (err && err.error === "Lightspeed task ack timed out.") {
					log.error("createNewGroup", "Lightspeed create ack timed out — the group may already exist. Not falling back to the web path to avoid a duplicate.");
					return callback({ error: "createNewGroup: creation outcome unknown (Lightspeed ack timed out). Check Messenger before retrying." });
				}
				webFallback();
			});

		return returnPromise;
	};
};
