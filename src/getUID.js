// Nexus-FCA: Advanced and Safe Facebook Chat API
// getUID.js - Resolve a Facebook profile link to its numeric user ID,
// fully locally: the link is parsed and fetched directly through the
// bot's own session. No third-party resolver service is contacted
// (the previous implementation posted every profile link to an
// external API, leaking the bot's browsing targets and adding a
// third-party point of failure).

const { URL } = require('url');
const log = require('npmlog');
const utils = require('../utils');

// Patterns for the numeric user id inside a fetched profile page.
// Modern account ids are 15+ digits; candidates are collected and the
// most plausible (longest) one wins.
const UID_PATTERNS = [
    /"userID":"(\d{5,})"/,
    /"content_owner_id_new":"(\d{5,})"/,
    /"profile_id":"?(\d{5,})"?/,
    /"entity_id":"(\d{5,})"/,
    /"actorID":"(\d{5,})"/,
    /"userVPPreviewID":"(\d{5,})"/,
    /profile\.php\?id=(\d{5,})/,
    /[?&]uid=(\d{5,})/,
    /contact_id[=:]"?(\d{5,})"?/,
    /"id":"(\d{15,})"/
];

function extractUID(html) {
    if (typeof html !== 'string') return null;
    const found = new Set();
    for (const re of UID_PATTERNS) {
        const m = html.match(re);
        if (m && m[1]) found.add(m[1]);
    }
    if (found.size === 0) return null;
    const candidates = Array.from(found);
    candidates.sort((a, b) => b.length - a.length);
    return candidates[0];
}

function looksLikeLoginPage(html) {
    return (
        /<form[^>]+action="[^"]*login[^"]*"/i.test(html) &&
        /name="password"/i.test(html)
    );
}

/**
 * Normalize any accepted input into a profile URL that can be fetched:
 *   - a bare numeric id            -> returned directly (no request)
 *   - profile.php?id=NNN (query)   -> returned directly (no request)
 *   - a bare username              -> https://www.facebook.com/<username>
 *   - any facebook.com URL         -> used as-is
 * Returns { id } when the id is known without a request, else { url }.
 */
function normalizeTarget(link) {
    const raw = String(link || '').trim();
    if (!raw) return { error: new Error('getUID: link is empty') };

    // Bare numeric id
    if (/^\d{5,}$/.test(raw)) return { id: raw };

    // Bare username (no slash/dot/colon) -> facebook profile path. Checked
    // first: "zuck" would otherwise parse as a URL whose host is "zuck".
    if (/^[A-Za-z0-9_-]{1,50}$/.test(raw)) {
        return { url: 'https://www.facebook.com/' + encodeURIComponent(raw) };
    }

    // Accept links without a protocol
    let href = raw;
    if (!/^https?:\/\//i.test(href)) {
        // Strip leading junk users often paste ("facebook.com" as hostname)
        href = 'https://' + href.replace(/^\/+/, '');
    }

    let url;
    try {
        url = new URL(href);
    } catch (e) {
        // Not a URL at all -> treat as a bare username
        if (/^[A-Za-z0-9._-]{1,50}$/.test(raw)) {
            return { url: 'https://www.facebook.com/' + encodeURIComponent(raw) };
        }
        return { error: new Error('getUID: invalid profile link') };
    }

    if (!/(^|\.)facebook\.com$|(^|\.)messenger\.com$/i.test(url.hostname)) {
        return { error: new Error('getUID: only facebook.com profile links are supported') };
    }

    // profile.php?id=NNN (or any ?id=NNN query)
    const qid = url.searchParams.get('id');
    if (qid && /^\d{5,}$/.test(qid)) return { id: qid };

    // Numeric path segment (/NNN)
    const firstSegment = url.pathname.split('/').filter(Boolean)[0];
    if (firstSegment && /^\d{5,}$/.test(firstSegment)) return { id: firstSegment };

    // Vanity username from the path
    if (firstSegment && /^[A-Za-z0-9._-]{1,50}$/.test(firstSegment)) {
        return { url: 'https://www.facebook.com/' + firstSegment };
    }

    return { url: 'https://www.facebook.com' + (url.pathname || '/') };
}

module.exports = function (defaultFuncs, api, ctx) {
    return function getUID(link, callback) {
        let resolveFunc = function () { };
        let rejectFunc = function () { };
        const returnPromise = new Promise(function (resolve, reject) {
            resolveFunc = resolve;
            rejectFunc = reject;
        });

        if (typeof callback !== 'function') {
            callback = function (err, uid) {
                if (err) return rejectFunc(err);
                resolveFunc(uid);
            };
        }

        const finish = (err, uid) => {
            if (err) {
                log.warn('getUID', err.message);
                callback(err);
            } else {
                callback(null, uid);
            }
        };

        const target = normalizeTarget(link);
        if (target.error) {
            finish(target.error);
            return returnPromise;
        }

        // The id was already part of the link - no request needed.
        if (target.id) {
            finish(null, target.id);
            return returnPromise;
        }

        // Vanity link: fetch the profile page through the bot's own session
        // (same UA + cookies as every other request - nothing leaves the
        // machine, and the account fingerprint stays consistent).
        (async () => {
            const res = await utils.get(target.url, ctx.jar, null, ctx.globalOptions, ctx);
            const body = (res && res.body) || '';

            const uid = extractUID(body);
            if (uid) return uid;

            if (looksLikeLoginPage(body)) {
                throw new Error('getUID: Facebook served a login page - the profile could not be resolved (session may be dead)');
            }
            if (res && res.statusCode && res.statusCode >= 400) {
                throw new Error('getUID: profile fetch returned HTTP ' + res.statusCode);
            }
            throw new Error('Not found');
        })()
            .then(uid => finish(null, uid))
            .catch(err => finish(err instanceof Error ? err : new Error(String(err && err.message || err))));

        return returnPromise;
    };
};
