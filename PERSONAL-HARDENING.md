# Nexus-fCA — Personal Use Hardening Plan

> **Slogan:** Public FCA না — personal weapon. তাই "সবচেয়ে বেশি API" না, **"সবচেয়ে কম ban risk + ২৪/৭ online + আমার bot যা চায়"**.
>
> Date: 2026-11-02 · Current: Nexus-fCA 4.3.1 (local) · Bot: Goat-Bot-V2

---

## 0. Public vs Personal — priority বদলে যাচ্ছে

| Public FCA-তে লাগে | Personal FCA-তে দরকার নেই |
|---|---|
| npm publish, semver, 40+ version | ❌ skip |
| TypeScript types, docs site, multi-language docs | ❌ skip |
| 100+ API, community requests | ❌ skip — শুধু নিজের command যেটা use করে |
| Auto-update, backward compatibility | ❌ skip — manual control |
| Telegram/Discord support group | ❌ skip |

**Personal-এ যা বেশি দরকার:** ban safety, session survival, startup resilience, backup, log, minimal attack surface.

---

## 1. Priority board

### P0 — এই সপ্তাহে (না করলে risk)
| # | কাজ | কেন | Effect |
|---|---|---|---|
| 1 | `appstate.json` git untrack + cookie rotate (if ever public) | cookie leak = account takeover | Security ↑↑ |
| 2 | Startup-এর external dependency remove | GitHub down = bot exit | Uptime ↑↑ |
| 3 | Sahu-র `antiSuspension` + `AdaptiveRateLimiter` port | deepest ban protection | Ban risk ↓↓ |
| 4 | Session auto-save + ৫টা backup rotate | restart/redeploy-এ session বাঁচে | Uptime ↑↑ |
| 5 | Core API live test (send, reaction, unsend, edit, typing, thread info) | নতুন API fail silently | Debug ↑ |
| 6 | Koyeb: min scale 1, auto-sleep off, volume `/app/database/data` | 24/7 + sqlite data survive | Uptime/Data ↑↑ |
| 7 | Dedicated bot account (personal FB না) | ban হলে personal account safe | Safety ↑↑ |

### P1 — ২ সপ্তাহে
| # | কাজ | Effect |
|---|---|---|
| 8 | Circuit breaker alert → Discord webhook/log (FB message না) | silent fail বন্ধ |
| 9 | MQTT dead-cookie detect: 10 min-এ N reconnect হলে alert | zombie loop বন্ধ |
| 10 | Per-thread send queue + rate limit (token bucket) | spam flag ↓↓ |
| 11 | Unused API/command prune | attack surface ↓, load ↓ |
| 12 | New cookie warm-up: 24h read-only, তারপর light → normal | checkpoint ↓↓ |
| 13 | Log redaction: cookie/appstate কখনো log না | leak risk ↓ |

### P2 — only if actually use
| # | কাজ | Effect | সুপারিশ |
|---|---|---|---|
| 14 | E2EE enable | secret chat ↑, native crash ↑, CPU ↑ | use না করলে off |
| 15 | AI theme / sticker / story | feature ↑, doc_id maintenance ↑, mutation risk ↑ | যেটা use করো শুধু সেটা |
| 16 | OldMessage fallback | send success ↑, legacy endpoint ban risk ↑ | fallback-only |
| 17 | Proxy | flagged IP-তে help, latency/cost ↑ | clone account-এ test |

### ❌ Never
- Auto-update (supply-chain risk)
- npm publish / public release
- Per-request UA rotation (fingerprint inconsistency)
- একই account-এ multiple bot session
- Mass message / mass join / mass friend request
- Public health/uptime page without auth
- Cookie/appstate log বা screenshot

---

## 2. Effects — এক নজরে

> ↓ = কমে, ↑ = বাড়ে। "Speed ↓" মানে command একটু slow লাগবে।

| Action | Ban risk | Uptime | Speed | Effort/Risk |
|---|---|---|---|---|
| antiSuspension + AdaptiveRateLimiter | ↓↓ | ↑ | ↓ (50–300ms) | Medium |
| Session auto-save + backup | ↓ | ↑↑ | — | Low |
| Startup external dependency remove | ↓ | ↑↑ | ↑ | Low (done) |
| Core API live test | ↓ | ↑ | — | Low |
| Dedicated bot account | ↓↓ (personal account) | — | — | Low |
| Koyeb volume + min scale 1 | — | ↑↑ | — | Low |
| Circuit breaker alert | ↓↓ | ↑ | — | Low |
| MQTT dead-cookie alert | ↓ | ↑↑ | — | Low |
| Per-thread rate limit | ↓↓ | — | ↓ (spammy command) | Low |
| Unused API prune | ↓ | ↑ | ↑ | Medium (command break risk) |
| Warm-up 24h | ↓↓ | — | ↓ (initially) | Low |
| E2EE | — | ↑ (secret chat) | ↓ | High (native) |
| AI theme/sticker/story | ↑ (new mutation) | — | — | Medium |
| OldMessage fallback | ↑ (legacy) | ↑ (send success) | — | Low |
| Proxy | ↓ if IP flagged | — | ↓ | Medium/High |

---

## 3. যেগুলো ইতিমধ্যে fix করা হয়েছে

1. **Startup resilience (login.js)**
   - Version check: 8s timeout + fail-open (আগে GitHub down হলে crash).
   - Gban check: fail করলে exit না, warn করে continue.
   - Notification fetch: fail করলে empty string, exit না.
   - `worldtimeapi.org` call সরানো → `Date.now()`.
   - Uptime homepage: external GitHub HTML fetch সরানো → local inline HTML.
   - **Effect:** GitHub/worldtimeapi down হলেও bot start হবে; startup দ্রুত।

2. **Secret cleanup**
   - `config.json`-এর `database.uriMongodb` blank (sqlite use করছো, password রাখা দরকার নেই).
   - `.gitignore`-এ `appstate.json`, `Nexus-fCA/appstate.json`, `.env` যোগ.
   - **Effect:** ভবিষ্যতে accidental commit কমবে।

3. **Auto-update বন্ধ**
   - `fca-config.json` + `index.js` default `autoUpdate: false`.
   - **Effect:** নিজের control-এ update; supply-chain risk নেই।

> ⚠️ `appstate.json` এখনো git-tracked। নিচের কমান্ড চালাও (local file থাকবে, শুধু git থেকে বাদ যাবে):
> ```powershell
> git rm --cached appstate.json Nexus-fCA/appstate.json
> git commit -m "chore: stop tracking session cookies"
> ```
> Repo private (GitHub 404) — ঠিক আছে, কিন্তু history-তে cookie আছে। কখনো public করলে **FB password change + logout all + fresh appstate + MongoDB password rotate**।

---

## 4. Recommended `optionsFca` profile

```json
"optionsFca": {
  "forceLogin": true,
  "listenEvents": true,
  "updatePresence": false,
  "listenTyping": true,
  "logLevel": "warn",
  "selfListen": false,
  "selfListenEvent": true,
  "autoMarkDelivery": false,
  "autoReconnect": true,
  "online": false,
  "emitReady": true,
  "facebookProtection": true,
  "humanLikeDelay": true,
  "sessionGuard": true,
  "antiLogout": true,
  "backoff": {
    "baseMs": 5000,
    "maxMs": 600000,
    "factor": 1.3,
    "jitter": 0.2,
    "resetAfterMs": 420000
  }
}
```

**কেন:**
- `logLevel: "warn"` — ৭ দিন debugging; পরে `"error"`.
- `online/updatePresence: false` — ২৪/৭ "always online" bot pattern কমে; **optional**, ২৪h test করে দেখো।
- `humanLikeDelay/sessionGuard/antiLogout/facebookProtection` — explicit true, যাতে future config merge-এ হারিয়ে না যায়।
- `backoff.maxMs: 600000` — login.js-এর stableOptions-এর সাথে match; config-এ 900000 থাকলেও override হয়ে 600000 হয়।

> `config.json`-এ `mqttProactiveReconnectEnabled: true` লেখা আছে, কিন্তু `login.js` এটা `false` করে override করে। Confusion এড়াতে config-এ `false` করে দাও।

---

## 5. Koyeb (Free)

| Setting | Value |
|---|---|
| Build | Dockerfile |
| Run | `node index.js` |
| Env | `APPSTATE_JSON` (secret) · `NODE_ENV=production` · `HOST=0.0.0.0` |
| Database | `config.json` → `database.type: "sqlite"` (no `DB_TYPE` env) |
| Port | `8000` |
| Volume | Free-এ নেই; SQLite ephemeral |
| Region | Frankfurt or Washington, D.C. |
| Min scale | 1 |
| Max scale | 1 (একই cookie-তে ২ instance = session conflict + duplicate reply) |
| Auto-sleep | 1 hour idle; বন্ধ করা যায় না — external ping every 5 min |
| Health check | HTTP `/` (local HTML, 200) |

**Effect:** bot online থাকবে; appstate image-এ baked থাকবে না। Redeploy/restart/scale-to-zero-এ SQLite data reset হবে।

> Koyeb Free-এ volume attach করা যায় না। Permanent data চাইলে পরে MongoDB Atlas-এ যেতে হবে।

---

## 6. 7-day test plan

| Day | কাজ | Pass criteria |
|---|---|---|
| 0 | Backup `appstate.json`, `database/data/data.sqlite`, `config.json` | ৩টা file-safe copy |
| 1 | Core: `!help`, text, image, reaction, unsend, edit, typing, thread info | সব pass, send success >99% |
| 2 | Group: add/kick/nickname/thread info | no restriction error |
| 3 | New APIs: `!sticker`, `!aisticker`, `!aitheme` এক একবার | error log capture |
| 4 | Story/note/theme get-set (যেটা use করো) | doc_id pass |
| 5–7 | Normal use + soak | MQTT reconnect <3/day, breaker 0, checkpoint 0 |

**Monitor:**
- `Circuit breaker TRIPPED` → send pause; FB restriction signal
- `Not logged in` / `1357004` → cookie dead
- `Max MQTT reconnection` → network/FB issue
- Memory > 300 MB → leak
- Startup > 60s → external dependency

---

## 7. Anti-suspension port (P0 detail)

Sahu-র যে ২টা module সবচেয়ে বেশি কাজে দেবে:

1. **`src/utils/antiSuspension.js`**
   - `checkpoint`, `account_locked`, `suspended`, `device_login` ইত্যাদি signal detect করে request slow/stop করে।
   - Sahu-তে **41টা file**-এ wired — এটাই ওদের practical #1 করার কারণ।

2. **`src/utils/AdaptiveRateLimiter.js`**
   - endpoint별 bucket + penalty + adaptive multiplier।
   - base delay 100ms, max 10s — spam pattern ভাঙে।

**Port করার effect:**
- Ban risk ↓↓ (সবচেয়ে বড় gain)
- Command latency +50–300ms (acceptable)
- Code merge risk medium — তাই clone branch-এ port করে ২৪h soak, তারপর main।

> এখনই full port না করে শুধু **signal list + adaptive delay** Nexus-এর circuit breaker-এ inject করলে ৮০% gain কম risk-এ পাওয়া যাবে।

---

## 8. Personal bot account rules

1. **আলাদা FB account** — personal account না। Ban হলে loss শুধু bot account।
2. **2FA on**, but appstate login use করো; বারবার password login না।
3. **এক account = এক session** — phone/browser-এ same account logged in থাকলে session conflict।
4. **New cookie warm-up:** first 24h read-only (listen + few replies), তারপর 2–3 দিন light, তারপর normal।
5. **Mass action না:** একসাথে ২০+ message, ১০+ group join, ৫০+ friend request = instant checkpoint।
6. **Cookie age < 30 days** — expire-এর আগে refresh; dead cookie নিয়ে infinite reconnect না।
7. **Never paste appstate** chat/screenshot/public repo-তে।

---

## 9. Final target

| Metric | Target |
|---|---|
| Send success | > 99% |
| MQTT reconnect | < 3/day |
| Circuit breaker trips | 0 |
| Checkpoint / restriction | 0 |
| Startup | < 60s |
| Memory | < 300 MB |
| Cookie age | < 30 days |
| Data loss on redeploy | 0 (volume) |

**Perfect কেউ না — কিন্তু এই ৯টা target hold করলে তুমি practical-এ #1-এর কাছাকাছি থাকবে।**
