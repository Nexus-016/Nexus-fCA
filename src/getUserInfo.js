"use strict";
var utils = require("../utils");
var log = require("npmlog");
var cheerio = require("cheerio");

// Format data from mbasic fallback
function formatMbasicData(userId, name, profileUrl) {
	const retObj = {};
	retObj[userId] = {
		name: name || "Facebook User",
		firstName: name ? name.split(' ')[0] : "User",
		vanity: null,
		thumbSrc: `https://graph.facebook.com/${userId}/picture?type=large`,
		profileUrl: profileUrl || `https://www.facebook.com/${userId}`,
		gender: null,
		type: "user",
		isFriend: false,
		isMessengerUser: true,
		isMessageBlockedByViewer: false,
		workInfo: null,
		messengerStatus: null
	};
	return retObj;
}

module.exports = function (defaultFuncs, api, ctx) {
	function formatData(data) {
		const retObj = {};
		for (const actor of data.messaging_actors || []) {
			retObj[actor.id] = {
				name: actor.name,
				firstName: actor.short_name || null,
				vanity: actor.username || null,
				thumbSrc: actor.big_image_src?.uri || null,
				profileUrl: actor.url || null,
				gender: actor.gender || null,
				type: actor.__typename || null,
				isFriend: actor.is_viewer_friend || false,
				isMessengerUser: actor.is_messenger_user || false,
				isMessageBlockedByViewer: actor.is_message_blocked_by_viewer || false,
				workInfo: actor.work_info || null,
				messengerStatus: actor.messenger_account_status_category || null
			};
		}
		return retObj;
	}

	// Mbasic fallback function
	async function getUserInfoMbasic(userId) {
		try {
			const url = `https://mbasic.facebook.com/profile.php?id=${userId}`;
			const res = await defaultFuncs.get(url, ctx.jar);
			const $ = cheerio.load(res.body);
			
			// Try to extract name from profile
			let name = $('title').text().replace(' | Facebook', '').trim();
			if (!name || name === 'Facebook') {
				name = $('h1').first().text().trim() || 
					   $('strong').first().text().trim() ||
					   "Facebook User";
			}
			
			return formatMbasicData(userId, name, url);
		} catch (err) {
			log.warn("getUserInfo", "Mbasic fallback failed:", err.message);
			return formatMbasicData(userId, "Facebook User", null);
		}
	}

	return function getUserInfoGraphQL(id, callback) {
		let resolveFunc, rejectFunc;
		const returnPromise = new Promise((resolve, reject) => {
			resolveFunc = resolve;
			rejectFunc = reject;
		});
		if (typeof callback !== "function") {
			callback = (err, data) => {
				if (err) return rejectFunc(err);
				resolveFunc(data);
			};
		}
		const ids = Array.isArray(id) ? id : [id];
		var form = {
			queries: JSON.stringify({
				o0: {
					doc_id: "5009315269112105",
					query_params: {
						ids: ids
					}
				}
			}),
			batch_name: "MessengerParticipantsFetcher"
		};

		// Add fb_dtsg if available
		if (ctx.fb_dtsg) {
			form.fb_dtsg = ctx.fb_dtsg;
		}

		defaultFuncs
			.post("https://www.facebook.com/api/graphqlbatch/", ctx.jar, form)
			.then(utils.parseAndCheckLogin(ctx, defaultFuncs))
			.then(function(resData) {
				if (!resData || resData.length === 0) {
					throw new Error("Empty response from server");
				}
				if (resData.error) {
					throw resData.error;
				}
				const response = resData[0];
				if (!response || !response.o0) {
					throw new Error("Invalid response format");
				}
				if (response.o0.errors && response.o0.errors.length > 0) {
					throw new Error(response.o0.errors[0].message || "GraphQL error");
				}
				const result = response.o0.data;
				if (!result || !result.messaging_actors || result.messaging_actors.length === 0) {
					log.warn("getUserInfo", "No user data found for the provided ID(s)");
					return callback(null, {});
				}
				const formattedData = formatData(result);
				return callback(null, formattedData);
			})
			.catch(async function(err) {
				log.warn("getUserInfoGraphQL", "GraphQL failed, trying mbasic fallback...");
				
				// Try mbasic fallback for each ID
				try {
					const results = {};
					for (const userId of ids) {
						const userData = await getUserInfoMbasic(userId);
						Object.assign(results, userData);
					}
					log.info("getUserInfoGraphQL", "Mbasic fallback successful");
					return callback(null, results);
				} catch (fallbackErr) {
					log.error("getUserInfoGraphQL", "All methods failed:", err.message || "Unknown error");
					callback(err);
				}
			});	
		return returnPromise;
	};
};