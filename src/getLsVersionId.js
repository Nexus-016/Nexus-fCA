"use strict";

const log = require("npmlog");

// NEXUS LIGHTSPEED (v5.3): resolves the CURRENT LightSpeed version id the
// same way mautrix-meta does (pkg/messagix/httpclient/js_module_parser.go):
// find the "LSVersion" JS module served by messenger.com and read the
// digits it exports. Facebook rotates this id with deployments, so
// hard-coding one value eventually breaks task publishing for new
// operations that have no live-verified id yet (mute, rename,
// remove-participant, create-group, accept-message-request, poll-update).
//
// Discipline:
// - Best-effort and SILENT: on any failure it resolves with the last-known
//   generic id (the lsTask.js default) — callers never see an error and the
//   task publish still proceeds with the generic id.
// - Cached in ctx (6h TTL) and single-flight so parallel operations share
//   one crawl; a failed crawl is remembered for 30 minutes (shorter) so a
//   transient network hiccup does not hammer messenger.com.
const DEFAULT_LS_VERSION_ID = "7214102258676893"; // last-known generic id (lsTask.js)
const LS_VERSION_TTL_MS = 6 * 60 * 60 * 1000; // refresh at most ~4x/day
const LS_VERSION_FAILURE_TTL_MS = 30 * 60 * 1000; // do not re-crawl for 30min after a failure
const LS_VERSION_PATTERN = /__d\("LSVersion"[^)]*\)\{\w+\.exports="(\d{10,})"\}/;
const MAX_BUNDLE_FETCHES = 3; // LSVersion usually ships in the first bundles

module.exports = function (defaultFuncs, api, ctx) {
	return function getLsVersionId() {
		const now = Date.now();
		const cached = ctx._lsVersionId;
		if (cached && cached.id && now - cached.ts < (cached.ok ? LS_VERSION_TTL_MS : LS_VERSION_FAILURE_TTL_MS)) {
			return Promise.resolve(cached.id);
		}
		if (ctx._lsVersionCrawl) return ctx._lsVersionCrawl;

		const crawl = (async function () {
			let html = "";
			try {
				const res = await defaultFuncs.get("https://www.messenger.com/", ctx.jar);
				html = (res && res.body) || "";
			} catch (_) {
				html = "";
			}

			let match = html.match(LS_VERSION_PATTERN);
			if (match && match[1]) return match[1];

			// The module usually ships inside a static bundle: follow a few
			// script srcs from the page and stop at the first hit.
			const srcs = [];
			try {
				const tags = String(html).match(/<script[^>]+src="(https:\/\/[^"]+\.js[^"]*)"/g) || [];
				for (const tag of tags) {
					const m = tag.match(/src="([^"]+)"/);
					if (m && srcs.indexOf(m[1]) === -1) srcs.push(m[1]);
					if (srcs.length >= MAX_BUNDLE_FETCHES) break;
				}
			} catch (_) { }

			for (const src of srcs) {
				try {
					const res = await defaultFuncs.get(src, ctx.jar);
					const body = (res && res.body) || "";
					const m2 = body.match(LS_VERSION_PATTERN);
					if (m2 && m2[1]) return m2[1];
				} catch (_) { }
			}
			return null;
		})()
			.then(function (id) {
				ctx._lsVersionId = id
					? { id: id, ts: Date.now(), ok: true }
					: { id: DEFAULT_LS_VERSION_ID, ts: Date.now(), ok: false };
				if (!id) {
					log.warn("getLsVersionId", "Could not read the LSVersion module from messenger.com; using the last-known generic version id.");
				}
				return ctx._lsVersionId.id;
			})
			.catch(function () {
				ctx._lsVersionId = { id: DEFAULT_LS_VERSION_ID, ts: Date.now(), ok: false };
				return DEFAULT_LS_VERSION_ID;
			})
			.finally(function () {
				delete ctx._lsVersionCrawl;
			});

		ctx._lsVersionCrawl = crawl;
		return crawl;
	};
};
