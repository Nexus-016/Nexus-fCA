"use strict";

const utils = require("../utils");
const log = require("npmlog");

// NEXUS LIGHTSPEED (v5.3): the Messenger app mutes threads with the
// MuteThreadTask (label 144, queue = threadKey):
//   {thread_key, mailbox_type: 0, mute_expire_time_ms, sync_group: 1}
// (mautrix/meta pkg/messagix/socket/threads.go; the receive side echoes
// LSUpdateThreadMuteSetting {thread_key, mute_expire_time_ms} and the LS
// threads table stores it as an epoch-ms timestamp field, so timed mutes
// are sent as an absolute epoch-ms expiry).
//
// Value discipline (no guessed sentinels):
// - unmute (muteSeconds === 0) -> mute_expire_time_ms 0 (unset — the field
//   is json:",omitempty" int64 in the reference, 0 = no mute).
// - timed mutes -> absolute epoch-ms expiry (LS_MUTE_ABSOLUTE experiment
//   switch: if live verification on the bot shows the server wants a
//   relative duration instead, flip it to false without touching anything
//   else).
// - "permanent" (muteSeconds === -1) has NO documented task-side sentinel,
//   so it keeps the proven web endpoint (mute_settings: -1). Same for any
//   LS publish failure: the web path silently takes over.
const LS_MUTE_ABSOLUTE = true;

module.exports = function (defaultFuncs, api, ctx) {
	const publishLsTask = require("./lsTask.js")(defaultFuncs, api, ctx);
	const getLsVersionId = require("./getLsVersionId.js")(defaultFuncs, api, ctx);

	// muteSecond: -1=permanent mute, 0=unmute, 60=one minute, 3600=one hour, etc.
	return function muteThread(threadID, muteSeconds, callback) {
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
				thread_fbid: threadID,
				mute_settings: muteSeconds
			};

			defaultFuncs
				.post(
					"https://www.facebook.com/ajax/mercury/change_mute_thread.php",
					ctx.jar,
					form
				)
				.then(utils.saveCookies(ctx.jar))
				.then(utils.parseAndCheckLogin(ctx, defaultFuncs))
				.then(function (resData) {
					if (resData.error) {
						throw resData;
					}

					return callback();
				})
				.catch(function (err) {
					log.error("muteThread", err);
					return callback(err);
				});
		};

		// Lightspeed path only where the value semantics are unambiguous.
		let muteExpireTimeMs = null;
		if (muteSeconds === 0) {
			muteExpireTimeMs = 0; // unmute
		} else if (muteSeconds > 0 && LS_MUTE_ABSOLUTE) {
			muteExpireTimeMs = Date.now() + muteSeconds * 1000; // absolute expiry
		}

		if (muteExpireTimeMs !== null) {
			getLsVersionId()
				.then(function (versionId) {
					return publishLsTask({
						taskType: "mute_thread",
						versionId: versionId,
						tasks: [{
							failure_count: null,
							label: "144",
							payload: JSON.stringify({
								thread_key: String(threadID),
								mailbox_type: 0,
								mute_expire_time_ms: muteExpireTimeMs,
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
		} else {
			// permanent mute (-1) and the switch-off case: proven web path.
			webFallback();
		}

		return returnPromise;
	};
};
