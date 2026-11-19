const utils = require("../utils");
const log = require("npmlog");

module.exports = function (defaultFuncs, api, ctx) {
	// Helper function to retry upload with delay.
	// Genuine Mercury uploads carry the file in the "farr" multipart field
	// (reference: mautrix/meta + 0xzer/messagix) to
	// <base_url>/ajax/mercury/upload.php, with cors fetch headers.
	// Permanent rejections (missing file, HTTP 4xx) are NOT retried.
	async function retryUpload(attachment, uploadOptions = {}) {
		const { maxRetries, delayMs } = utils.uploadRetryPolicy();
		let current = attachment;
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				const form = utils.buildUploadForm(current, uploadOptions);
				const res = await defaultFuncs
					.postFormData("https://www.facebook.com/ajax/mercury/upload.php", ctx.jar, form, {}, {}, utils.uploadRequestOptions())
					.then(utils.parseAndCheckLogin(ctx, defaultFuncs));

				if (res.error) throw res;
				return res.payload.metadata[0];
			} catch (err) {
				if (attempt === maxRetries || utils.isPermanentUploadError(err)) {
					// Rewrite fs ENOENT noise into a single actionable line —
					// the bot deleted its tmp attachment file before the
					// upload consumed the stream.
					const code = String((err && err.code) || "");
					const msg = String((err && err.message) || (err && err.error) || "");
					if (/^(ENOENT|EACCES|EPERM|EISDIR|ENAMETOOLONG|EMFILE)\b/.test(code) || /^(ENOENT|EACCES|EPERM|EISDIR|ENAMETOOLONG|EMFILE)\b/.test(msg)) {
						const filePath = (msg.match(/stat '([^']+)'/) || [])[1];
						err.message = "Attachment file not found" + (filePath ? `: ${filePath}` : "") + " — the file must exist until the upload completes (keep tmp attachment files alive while a send is in flight)";
					}
					throw err;
				}
				log.warn("uploadAttachment", `Attempt ${attempt} failed, retrying in ${delayMs}ms...`);
				await new Promise(resolve => setTimeout(resolve, delayMs));
				current = utils.reopenAttachment(attachment);
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

			uploads.push(retryUpload(attachments[i]));
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