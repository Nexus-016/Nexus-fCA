"use strict";

const utils = require("../utils");
const log = require("npmlog");

module.exports = function (defaultFuncs, api, ctx) {
	const publishLsTask = require("./lsTask.js")(defaultFuncs, api, ctx);

	function handleUpload(image, callback) {
		const uploads = [];

		const form = {
			images_only: "true",
			"attachment[]": image
		};

		uploads.push(
			defaultFuncs
				.postFormData(
					"https://upload.facebook.com/ajax/mercury/upload.php",
					ctx.jar,
					form,
					{}
				)
				.then(utils.parseAndCheckLogin(ctx, defaultFuncs))
				.then(function (resData) {
					if (resData.error) {
						throw resData;
					}

					return resData.payload.metadata[0];
				})
		);

		// resolve all promises
		Promise
			.all(uploads)
			.then(function (resData) {
				callback(null, resData);
			})
			.catch(function (err) {
				log.error("handleUpload", err);
				return callback(err);
			});
	}

	return function changeGroupImage(image, threadID, callback) {
		if (
			!callback &&
			(utils.getType(threadID) === "Function" ||
				utils.getType(threadID) === "AsyncFunction")
		) {
			throw { error: "please pass a threadID as a second argument." };
		}

		if (!utils.isReadableStream(image)) {
			throw { error: "please pass a readable stream as a first argument." };
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

		// Web fallback reuses the already-uploaded image id — the upload is
		// shared by both paths, so a LightSpeed failure never uploads twice.
		const webSendWithImage = function (imageID) {
			const messageAndOTID = utils.generateOfflineThreadingID();
			const form = {
				client: "mercury",
				action_type: "ma-type:log-message",
				author: "fbid:" + (ctx.i_userID || ctx.userID),
				author_email: "",
				ephemeral_ttl_mode: "0",
				is_filtered_content: false,
				is_filtered_content_account: false,
				is_filtered_content_bh: false,
				is_filtered_content_invalid_app: false,
				is_filtered_content_quasar: false,
				is_forward: false,
				is_spoof_warning: false,
				is_unread: false,
				log_message_type: "log:thread-image",
				manual_retry_cnt: "0",
				message_id: messageAndOTID,
				offline_threading_id: messageAndOTID,
				source: "source:chat:web",
				"source_tags[0]": "source:chat",
				status: "0",
				thread_fbid: threadID,
				thread_id: "",
				timestamp: Date.now(),
				timestamp_absolute: "Today",
				timestamp_relative: utils.generateTimestampRelative(),
				timestamp_time_passed: "0"
			};

			form["thread_image_id"] = imageID;
			form["thread_id"] = threadID;

			defaultFuncs
				.post("https://www.facebook.com/messaging/set_thread_image/", ctx.jar, form)
				.then(utils.parseAndCheckLogin(ctx, defaultFuncs))
				.then(function (resData) {
					// check for errors here

					if (resData.error) {
						throw resData;
					}

					return callback();
				})
				.catch(function (err) {
					log.error("changeGroupImage", err);
					return callback(err);
				});
		};

		handleUpload(image, function (err, payload) {
			if (err) {
				return callback(err);
			}

			const imageID = payload[0] && payload[0].image_id;
			if (!imageID) {
				return callback({ error: "changeGroupImage: upload returned no image id." });
			}

			// NEXUS LIGHTSPEED: the app sets the group image through the
			// thread_image task (label 37) referencing the uploaded image id.
			// Setting the same image again is idempotent, so the web
			// fallback stays safe.
			publishLsTask({
				taskType: "change_thread_image",
				versionId: "8798795233522156",
				tasks: [{
					failure_count: null,
					label: "37",
					payload: JSON.stringify({
						thread_key: String(threadID),
						image_id: String(imageID),
						sync_group: 1
					}),
					queue_name: "thread_image",
					task_id: ++ctx.wsTaskNumber
				}]
			})
				.then(function () {
					return callback();
				})
				.catch(function () {
					webSendWithImage(String(imageID));
				});
		});

		return returnPromise;
	};
};
