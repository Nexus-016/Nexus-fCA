const utils = require("../utils");
const log = require("npmlog");

module.exports = function (defaultFuncs, api, ctx) {
	// Helper function to retry upload with delay
	// Permanent local errors (missing/inaccessible file) are NOT retried:
	// the attachment stream's underlying file is gone, so every retry
	// would repeat the same failure and spam the console. Network/transient
	// errors still retry.
	const PERMANENT_UPLOAD_PATTERN = /^(ENOENT|EACCES|EPERM|EISDIR|ENAMETOOLONG|EMFILE)\b/;
	function isPermanentUploadError(err) {
		const code = (err && err.code) || "";
		const msg = String((err && err.message) || (err && err.error) || err || "");
		return PERMANENT_UPLOAD_PATTERN.test(String(code)) || PERMANENT_UPLOAD_PATTERN.test(msg);
	}

	async function retryUpload(form, maxRetries = 3, delayMs = 2000) {
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				const res = await defaultFuncs
					.postFormData("https://upload.facebook.com/ajax/mercury/upload.php", ctx.jar, form, {})
					.then(utils.parseAndCheckLogin(ctx, defaultFuncs));
				
				if (res.error) throw res;
				return res.payload.metadata[0];
			} catch (err) {
				if (attempt === maxRetries || isPermanentUploadError(err)) {
					// Rewrite fs ENOENT noise into a single actionable line —
					// the bot deleted its tmp attachment file before the
					// upload consumed the stream.
					if (isPermanentUploadError(err)) {
						const path = (String(err && err.message || "").match(/stat '([^']+)'/) || [])[1];
						err.message = "Attachment file not found" + (path ? `: ${path}` : "") + " — the file must exist until the upload completes (keep tmp attachment files alive while a send is in flight)";
					}
					throw err;
				}
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
				log.error("uploadAttachment", (err && (err.message || err.error)) || err);
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