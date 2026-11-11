/**
 * ===========================================================
 * Original: toru-fca by HRIDOY (https://github.com/hridoy-dev)
 * Ported to Nexus-fCA 4.1.0 - credits to original author.
 * Adaptations for Nexus ctx: no fb_dtsg_ag/req_ID fields here,
 * so fall back to safe defaults; jazoest uses ctx.ttstamp;
 * lsd uses ctx.lsd (fixed) with fb_dtsg fallback.
 * ===========================================================
 */
"use strict";

const utils = require("../utils");
const log = require("npmlog");

module.exports = function (defaultFuncs, api, ctx) {
	return function setProfileLock(enable, callback) {
		let resolveFunc = function () { };
		let rejectFunc = function () { };
		const returnPromise = new Promise(function (resolve, reject) {
			resolveFunc = resolve;
			rejectFunc = reject;
		});

		if (!callback) {
			callback = function (err, data) {
				if (err) {
					return rejectFunc(err);
				}
				resolveFunc(data);
			};
		}

		if (typeof enable !== "boolean") {
			return callback(new Error("enable must be a boolean value"));
		}

		const form = {
			av: ctx.userID,
			__aaid: 0,
			__user: ctx.userID,
			__a: 1,
			__req: utils.getSignatureID(),
			__hs: ctx.fb_dtsg_ag || "",
			dpr: 1,
			__ccg: "EXCELLENT",
			__rev: ctx.req_ID || "1027694919",
			__s: utils.getSignatureID(),
			__hsi: ctx.hsi || "",
			__comet_req: 15,
			fb_dtsg: ctx.fb_dtsg,
			jazoest: ctx.ttstamp,
			lsd: ctx.lsd || ctx.fb_dtsg,
			__spin_r: ctx.req_ID || "1027694919",
			__spin_b: "trunk",
			__spin_t: Date.now(),
			__crn: "comet.fbweb.CometProfileTimelineListViewRoute",
			fb_api_caller_class: "RelayModern",
			fb_api_req_friendly_name: "WemPrivateSharingMutation",
			server_timestamps: true,
			variables: JSON.stringify({
				enable: !enable
			}),
			doc_id: "9144138075685633"
		};

		defaultFuncs
			.post("https://www.facebook.com/api/graphql/", ctx.jar, form)
			.then(utils.parseAndCheckLogin(ctx, defaultFuncs))
			.then(function (resData) {
				if (resData.error) {
					throw resData;
				}

				const result = resData?.data?.toggle_wem_private_sharing_control_enabled;

				if (!result) {
					throw new Error("Cannot toggle profile lock status");
				}

				return callback(null, {
					private_sharing_enabled: result.private_sharing_enabled,
					is_ppg_converter: result.is_ppg_converter,
					is_ppg_user: result.is_ppg_user,
					last_toggle_time: result.private_sharing_last_toggle_time,
					owner_id: result.owner_id
				});
			})
			.catch(function (err) {
				log.error("setProfileLock", err);
				return callback(err);
			});

		return returnPromise;
	};
};
