"use strict";

const utils = require("../utils");
const log = require("npmlog");

module.exports = function (defaultFuncs, api, ctx) {
	const publishLsTask = require("./lsTask.js")(defaultFuncs, api, ctx);

	return function createPoll(title, threadID, options, callback) {
		let resolveFunc = function () { };
		let rejectFunc = function () { };
		const returnPromise = new Promise(function (resolve, reject) {
			resolveFunc = resolve;
			rejectFunc = reject;
		});

		if (!callback) {
			if (utils.getType(options) == "Function") {
				callback = options;
				options = null;
			} else {
				callback = function (err) {
					if (err) {
						return rejectFunc(err);
					}
					resolveFunc();
				};
			}
		}
		if (!options) {
			options = {}; // Initial poll options are optional
		}

		const webFallback = function () {
			const form = {
				target_id: threadID,
				question_text: title
			};

			// Set fields for options (and whether they are selected initially by the posting user)
			let ind = 0;
			for (const opt in options) {
				// eslint-disable-next-line no-prototype-builtins
				if (options.hasOwnProperty(opt)) {
					form["option_text_array[" + ind + "]"] = opt;
					form["option_is_selected_array[" + ind + "]"] = options[opt]
						? "1"
						: "0";
					ind++;
				}
			}

			defaultFuncs
				.post(
					"https://www.facebook.com/messaging/group_polling/create_poll/?dpr=1",
					ctx.jar,
					form
				)
				.then(utils.parseAndCheckLogin(ctx, defaultFuncs))
				.then(function (resData) {
					if (resData.payload.status != "success") {
						throw resData;
					}

					return callback();
				})
				.catch(function (err) {
					log.error("createPoll", err);
					return callback(err);
				});
		};

		// NEXUS LIGHTSPEED: the app creates polls through the poll_creation
		// task (label 163) with the option texts as an array. The web form
		// accepts an options object ({text: selected}) — the task payload
		// wants the option texts in order. Creating the same poll twice is
		// visible but harmless, so the web fallback stays safe.
		const optionTexts = Array.isArray(options)
			? options.map(String)
			: Object.keys(options);

		publishLsTask({
			taskType: "create_poll",
			versionId: "34195258046739157",
			tasks: [{
				failure_count: null,
				label: "163",
				payload: JSON.stringify({
					question_text: String(title),
					thread_key: String(threadID),
					options: optionTexts,
					sync_group: 1
				}),
				queue_name: "poll_creation",
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
