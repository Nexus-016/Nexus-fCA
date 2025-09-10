"use strict";

const utils = require("../utils");
const log = require("npmlog");

module.exports = function (defaultFuncs, api, ctx) {
	return function markAsDelivered(threadID, messageID, callback) {
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

		if (!threadID || !messageID) {
			return callback("Error: messageID or threadID is not defined");
		}

		const form = {};

		form["message_ids[0]"] = messageID;
		form["thread_ids[" + threadID + "][0]"] = messageID;

		// Lightweight retry with exponential backoff for transient network timeouts.
		const maxAttempts = 3;
		let attempt = 0;
		const baseDelay = 500; // ms
		const transientCodes = ['ETIMEDOUT','ECONNRESET','EAI_AGAIN'];
		if(ctx.health){
			ctx.health.deliveryAttempts++;
			// If we previously disabled delivery receipts due to repeated timeouts, short-circuit success.
			if(ctx.health.deliveryDisabledSince){
				return callback();
			}
		}
		function doPost(){
			attempt++;
			defaultFuncs
				.post(
					"https://www.facebook.com/ajax/mercury/delivery_receipts.php",
					ctx.jar,
					form
				)
				.then(utils.saveCookies(ctx.jar))
				.then(utils.parseAndCheckLogin(ctx, defaultFuncs))
				.then(function (resData) {
					if (resData.error) { throw resData; }
					if(ctx.health){ ctx.health.deliverySuccess++; }
					return callback();
				})
				.catch(function (err) {
					const code = err && (err.code || err.errno || (err.error && err.error.code));
					const isTransient = code && transientCodes.includes(code);
					if(code === 'ETIMEDOUT' && ctx.health){ ctx.health.deliveryTimeouts++; }
					if(isTransient && attempt < maxAttempts){
						const delay = Math.round(baseDelay * Math.pow(2, attempt-1) * (1 + Math.random()*0.2));
						log.warn('markAsDelivered', `Transient ${code} attempt ${attempt}/${maxAttempts} -> retrying in ${delay}ms`);
						return setTimeout(doPost, delay);
					}
					// Suppress noisy timeout logs after final retry unless verbose
					if(!(isTransient && attempt >= maxAttempts)){
						log.error("markAsDelivered", err);
					}else{
						log.warn('markAsDelivered', `Giving up after ${attempt} attempts (${code})`);
						// Adaptive disable: if too many timeouts overall, stop calling delivery receipts for this run
						if(code === 'ETIMEDOUT' && ctx.health && ctx.health.deliveryTimeouts >= 5){
							ctx.health.deliveryDisabledSince = Date.now();
							log.warn('markAsDelivered', 'Adaptive disable engaged after repeated ETIMEDOUT. Further receipts suppressed.');
						}
					}
					if (utils.getType(err) == "Object" && err.error === "Not logged in.") {
						ctx.loggedIn = false;
					}
					if(ctx.health){ ctx.health.deliveryFailed++; }
					return callback(err);
				});
		}
		doPost();

		return returnPromise;
	};
};
