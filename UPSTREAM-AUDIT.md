# Nexus-fCA — Upstream Audit (2026-11-02)

> প্রশ্ন: "আমার FCA কি perfect? সবগুলোর থেকে ভালো?"
>
> সংক্ষিপ্ত উত্তর: **Perfect না। Paper-এ #২, feature-এ #১, proven-ness-এ Sahu #১।**
> নিচের সব সংখ্যা 2026-11-02-এ npm registry / GitHub / package tarball scan থেকে নেওয়া।

---

## 1. Ranking (weighted, 100-এ)

| # | FCA | Score | এক লাইনে |
|---|---|---|---|
| 1 | **sahu-fca 13.0.0** | **84.8** | সবচেয়ে fresh + battle-tested safety stack |
| 2 | **Nexus-fCA 4.3.1 (local)** | **79.3** | Feature-এ সবার উপরে, live proof কম |
| 3 | fca-riyad 37.2.7 | 73.0 | E2EE-তে #১, কিন্তু 50 MB + safety দুর্বল |
| 4 | toru-fca 1.1.0 | 64.0 | Fresh + real E2EE, adoption কম |
| 5 | @neoaz07/nkxfca 1.0.10 | 59.0 | ভালো safety idea, ৭ মাস পুরনো |
| 6 | @mostakim-fca/v2 2.2.3 | 55.5 | E2EE আছে, 33 MB, repo পাওয়া যায় না |
| 7 | @dongdev/fca-unofficial 4.0.3 | 51.0 | Docs/TS best, কিন্তু **archived** |
| 8 | ws3-fca 3.5.2 | 42.5 | Stable পুরনো ঘোড়া, নতুন feature নেই |

**Scoring weights:** Safety 25 · Stability 20 · API coverage 15 · E2EE 10 · Freshness 15 · Real-world proof 10 · Observability 5.

> এটা "paper score"। Live 7-day soak চালালে Nexus-এর score বাড়বে; নতুন API-গুলো fail করলে কমবে।

---

## 2. Raw npm data (2026-11-02)

| FCA | Latest | Published | DL/week | DL/month | Unpacked | Deps | Repo signal |
|---|---|---:|---:|---:|---:|---:|---|
| sahu-fca | 13.0.0 | 2026-09-18 | 1,414 | 2,897 | 978 KB | 23 | GitLab active (Aug 2026), 0 star |
| toru-fca | 1.1.0 | 2026-09-14 | 41 | 122 | 626 KB | 12 | repo field নেই |
| @neoaz07/nkxfca | 1.0.10 | 2026-04-03 | 58 | 222 | 732 KB | 20 | GitHub 404 |
| ws3-fca | 3.5.2 | 2025-08-31 | 717 | 3,202 | 841 KB | 17 | GitHub 8 star, push Apr 2026 |
| @dongdev/fca-unofficial | 4.0.3 | 2026-04-11 | 1,792 | 4,242 | 2,196 KB | 15 | GitHub 31 star, **archived** |
| @mostakim-fca/v2 | 2.2.3 | 2026-07-29 | 39 | 109 | 33,133 KB | 17 | GitHub 404 |
| fca-riyad | 37.2.7 | 2026-08-19 | 688 | 2,233 | 50,142 KB | 20 | GitHub 0 star, push Aug 2026 |
| **nexus-fca** | **4.3.1 local** / 3.4.0 npm | 4.3.1 unpub / 3.4.0: 2026-01-17 | 42 (npm 3.4.0) | 241 | 3.51 MB local / 938 KB npm | 24 | GitHub 12 star, last push 2026-01-17 |

### পড়ার নিয়ম
- **Download বেশি = বেশি লোকে ব্যবহার করছে = বেশি edge case ধরা পড়েছে।** Sahu 1,414/week এখানে সবচেয়ে এগিয়ে।
- **Size ছোট = দ্রুত install + কম attack surface।** Riyad 50 MB, Mostakim 33 MB — Koyeb free-tier-এ এগুলো heavy।
- **Published date** মানে নতুন FB fix কত দ্রুত এসেছে। Sahu/Toru September 2026-এ সবচেয়ে fresh।

---

## 3. Feature scan (keyword-এ যত files match করেছে)

> সংখ্যা = ওই feature থাকা file-এর সংখ্যা, occurrence না। এটা **depth signal**, runtime proof না।

| Feature | Nexus | Sahu | Toru | NKX | WS3 | Riyad | Mostakim |
|---|---:|---:|---:|---:|---:|---:|---:|
| E2EE | 3 | 0 | 8 | 4 | 0 | **15** | 9 |
| Fingerprint lock | 2 | **8** | 0 | 3 | 0 | 0 | 0 |
| Circuit breaker | 1 | **6** | 0 | 3 | 0 | 0 | 0 |
| Anti-logout / session guard | 3 | 0 | 1 | 0 | 0 | 2 | 0 |
| Rate limit / throttle | 9 | **16** | 2 | 10 | 0 | 3 | 1 |
| MQTT reconnect | 9 | 13 | 5 | 8 | 5 | **15** | 4 |
| Typing indicator | 12 | 15 | 8 | 8 | 6 | **18** | 7 |
| Story API | **14** | 3 | 4 | 2 | 2 | 0 | 4 |
| Sticker API | 8 | 10 | 9 | 9 | 8 | **13** | 8 |
| Theme API | 11 | **22** | 10 | 15 | 5 | 17 | 11 |
| sendButtons | 1 | 0 | 1 | 0 | 0 | 0 | 1 |
| Notes API | 5 | 4 | 4 | 6 | 4 | 5 | 2 |
| Health / metrics | 8 | 12 | 2 | 6 | 0 | 0 | 0 |
| Human-like delay | 2 | 2 | 1 | 2 | 0 | 0 | 0 |
| **src/api JS files** | **100** | 85 | 101 | 75 | 43 | 86 | 90 |

**Dongdev:** bundled TypeScript build (একটা `dist/index.js`), তাই file-count তুলনা করা যায় না। Bundle scan-এ আছে: reconnect, typing, story, sticker, theme, note, proxy, rate limit, MQTT, health, retry, upload. নেই: E2EE, fingerprint, circuit breaker, sendButtons, human delay. Repo **archived**।

### গুরুত্বপূর্ণ verify
Sahu-র safety module গুলো শুধু পড়ে থাকা কোড না — `index.js`-এ wired, আর `antiSuspension` **41টা file**-এ ব্যবহৃত। এটাই Sahu-কে practical #১ বানাচ্ছে।

---

## 4. Score breakdown

| FCA | Safety /25 | Stability /20 | API /15 | E2EE /10 | Fresh /15 | Proof /10 | Ops /5 | **Total** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Sahu | 23.75 | 19.0 | 13.5 | 1.0 | 15.0 | 8.0 | 4.5 | **84.75** |
| Nexus | 22.5 | 18.0 | 14.25 | 5.0 | 12.0 | 3.0 | 4.5 | **79.25** |
| Riyad | 15.0 | 16.0 | 13.5 | 10.0 | 10.5 | 6.0 | 2.0 | **73.0** |
| Toru | 12.5 | 14.0 | 12.0 | 8.0 | 13.5 | 2.0 | 2.0 | **64.0** |
| NKX | 17.5 | 14.0 | 10.5 | 5.0 | 6.0 | 3.0 | 3.0 | **59.0** |
| Mostakim | 12.5 | 12.0 | 12.0 | 7.0 | 9.0 | 2.0 | 1.5 | **55.5** |
| Dongdev | 12.5 | 14.0 | 12.0 | 1.0 | 1.5 | 8.0 | 2.5 | **51.0** |
| WS3 | 7.5 | 14.0 | 7.5 | 1.0 | 4.5 | 7.0 | 1.0 | **42.5** |

---

## 5. Nexus কোথায় #১, কোথায় পিছিয়ে

### ✅ Nexus যেখানে সবার উপরে
1. **API breadth:** 100 src file + storyManager, stickerStore, note, sendButtons, AI theme, OldMessage fallback — একটাই codebase-এ।
2. **Safety concept coverage:** fingerprint lock + circuit breaker + sessionGuard + human delay + infinite MQTT reconnect + health — feature list-এ Sahu-র সমান বা বেশি।
3. **Size:** 3.51 MB (Riyad 50 MB, Mostakim 33 MB) — Koyeb-এ দ্রুত deploy।
4. **Maintenance system:** `MAINTENANCE.md` + doc_id table + changelog — fix হারায় না।
5. **Fresh local fixes:** AI theme endpoint, typing MQTT, cookie decode, Koyeb bind — অক্টোবর 2026 পর্যন্ত।

### ❌ কেন এখনো #১ না
1. **Live proof নেই:** নতুন ১৭টা API-র একটাও real FB call-এ test করা হয়নি। Sahu-র safety stack হাজারো request-এ proven।
2. **E2EE operational না:** bridge code আছে, কিন্তু `koffi` + `yumi-json-bigint` + native binary নেই। Riyad/Toru এখানে এগিয়ে।
3. **Public release পুরনো:** npm-এ 3.4.0 (Jan 2026), local 4.3.1। GitHub-ও Jan 2026-এ থেমে আছে।
4. **Adoption কম:** 42 download/week vs Sahu 1,414, Dongdev 1,792। Edge case কম ধরা পড়েছে।
5. **Sahu-র safety integration গভীর:** `antiSuspension` 41 files + `AdaptiveRateLimiter` + `ResilienceManager` + `SessionStabilityManager` + `tokenRefresh` — আমাদের একই concept, কিন্তু module depth কম।

### ⚠️ যেটা "perfect" কখনোই হবে না
Unofficial API — FB যেকোনো দিন doc_id/endpoint বদলাবে। Sahu, Riyad, Dongdev সবাই ভাঙবে। জিতবে যে **দ্রুত fix করে**; সেটার system আমাদের আছে।

---

## 6. #১ হতে হলে ঠিক এই ৫টা কাজ

1. **Live test 17 APIs** (sticker, story, note, theme, sendButtons, searchFriends, friend request, active status, profile lock, avatar V2, OldMessage, theme get/set, story seen) — এক একটা করে, log সহ। Pass হলে `MAINTENANCE.md`-এ `⏳ → ✅`।
2. **E2EE test:** clone account-এ `npm i koffi yumi-json-bigint`, `{ enableE2EE: true }` দিয়ে secret chat test। Pass করলে Nexus-এর E2EE score 5 → 10।
3. **Sahu-র ২টা module port:** `antiSuspension.js` + `AdaptiveRateLimiter.js` — এতে safety gap প্রায় বন্ধ হবে।
4. **7-day soak:** log-এ `Circuit breaker TRIPPED`, `Not logged in`, MQTT reconnect count — এগুলো collect করে score-এ proof যোগ করো।
5. **Publish/tag:** `npm publish` (personal use হলে skip) বা GitHub-এ 4.3.1 tag + release notes। এতে freshness/proof score বাড়বে।

---

## 7. Perchance image command — আলাদা নোট

`scripts/cmds/aiimage.js` আগেই বসানো আছে:
- 46 art style (`--anime`, `--cyberpunk`, `--ghibli`, ...)
- 11 size preset (`--portrait`, `--16:9`, custom `--size 768x1024`)
- `--2` / `--4` / `--n 2` / `2img` / `4img`
- negative prompt + seed + model (flux/turbo/sana)
- `!aiimage styles` / `!aiimage sizes`

**Backend:** Perchance.org নিজে Cloudflare Turnstile-locked, server-side call করা যায় না। তাই একই feature সেট Pollinations-এ চালানো হয়েছে। Live test: `200 OK`, `image/jpeg`, 36 KB, 706 ms (512×512, flux)। Bot থেকে 2/4 image পাঠানোর code path ঠিক আছে।

---

## 8. Method & caveats

- Data source: npm registry API, npm downloads API, GitHub API, GitLab API, downloaded tarballs (`npm pack`) + keyword scan।
- Keyword scan file-count; runtime behavior নয়। "Feature আছে" ≠ "feature কাজ করছে"।
- Score weighted judgment — absolute truth না, decision aid।
- Live FB test করা হয়নি (cookie security)। তাই Nexus-এর নতুন API-গুলোর score conservative রাখা হয়েছে।
- Re-run করার নিয়ম: `npm view <pkg> version time.modified`, `api.npmjs.org/downloads/point/last-week/<pkg>`, `npm pack <pkg>` → extract → grep।
