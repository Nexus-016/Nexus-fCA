const utils = require("../utils");
const log = require("npmlog");

module.exports = function (defaultFuncs, api, ctx) {
	// Helper function to retry upload with delay
	async function retryUpload(form, maxRetries = 3, delayMs = 2000) {
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				const res = await defaultFuncs
					.postFormData("https://upload.facebook.com/ajax/mercury/upload.php", ctx.jar, form, {})
					.then(utils.parseAndCheckLogin(ctx, defaultFuncs));
				
				if (res.error) throw res;
				return res.payload.metadata[0];
			} catch (err) {
				if (attempt === maxRetries) throw err;
				log.warn("uploadAttachment", `Attempt ${attempt} failed, retrying in ${delayMs}ms...`);
				await new Promise(resolve => setTimeout(resolve, delayMs));
			}
		}
	}

	function upload(attachments, callback) {
		callback = callback || function () { };
		const uploads = [];

		// create an array of promises
		for (let i = 0; i < attachments.length; i++) {
			if (!utils.isReadableStream(attachments[i])) {
				throw {
					error:
						"Attachment should be a readable stream and not " +
						utils.getType(attachments[i]) +
						"."
				};
			}

			const form = {
				upload_1024: attachments[i],
				voice_clip: "true"
			};

			uploads.push(retryUpload(form));
		}

		// resolve all promises
		Promise
			.all(uploads)
			.then(function (resData) {
				callback(null, resData);
			})
			.catch(function (err) {
				log.error("uploadAttachment", err);
				return callback(err);
			});
	}

	return function uploadAttachment(attachments, callback) {
		if (
			!attachments &&
			!utils.isReadableStream(attachments) &&
			!utils.getType(attachments) === "Array" &&
			(utils.getType(attachments) === "Array" && !attachments.length)
		)
			throw { error: "Please pass an attachment or an array of attachments." };

		let resolveFunc = function () { };
		let rejectFunc = function () { };
		const returnPromise = new Promise(function (resolve, reject) {
			resolveFunc = resolve;
			rejectFunc = reject;
		});

		if (!callback) {
			callback = function (err, info) {
				if (err) {
					return rejectFunc(err);
				}
				resolveFunc(info);
			};
		}

		if (utils.getType(attachments) !== "Array")
			attachments = [attachments];

		upload(attachments, (err, info) => {
			if (err) {
				return callback(err);
			}
			callback(null, info);
		});

		return returnPromise;
	};
};