# Nexus-fCA Maintenance System — সবচেয়ে stable থাকার প্ল্যান

> নীতি: perfect কেউ না, কিন্তু **সবচেয়ে দ্রুত fix করা টিম** আমরাই হবো।
>
> **Latest audit (2026-11-02):** Sahu 84.8 · Nexus 79.3 · Riyad 73.0 — full data in [`UPSTREAM-AUDIT.md`](UPSTREAM-AUDIT.md).
>
> **Personal-use roadmap:** [`PERSONAL-HARDENING.md`](PERSONAL-HARDENING.md) — P0/P1/P2, effects, Koyeb config, 7-day test plan.

## 1. Upstream watchlist (মাসে 1 বার চেক)
| FCA | দেখার জিনিস | Freshness (Oct 2026) |
|---|---|---|
| `sahu-fca` | নতুন doc_id / login fix | Sep 2026 ✅ freshest |
| `toru-fca` | anti-logout, session, E2EE | ~1 মাস |
| `@neoaz07/nkxfca` | fingerprint, breaker, AI | ~5 মাস |
| `ws3-fca` | UA policy, error handling | 1 বছর (stable ref) |
| `@dongdev/fca-unofficial` | docs, type changes | ~5 মাস |
| `@mostakim-fca/v2` | E2EE | ~3 মাস |
| `fca-riyad` | reaction/send fix | ~1 মাস |

## 2. Critical doc_id table (ভাঙলে এখানেই ভাঙে)
| API | doc_id | Last working | Status |
|---|---|---|---|
| AI theme | `23873748445608673` | Oct 2026 | ⚠️ flaky (FB limit) |
| Reaction | `1491398900900362` | Oct 2026 | ✅ |
| Friend request | `24614631718227645` | Oct 2026 (untested live) | ⏳ |
| Friend search | `31767020089578751` | Oct 2026 (untested live) | ⏳ |
| Active status | `9444355898946246` | Oct 2026 (untested live) | ⏳ |
| Story create | `24226878183562473` | Oct 2026 (untested live) | ⏳ |
| Story delete | `30236153679305121` | Oct 2026 (untested live) | ⏳ |
| Story check | `7723194127725452` | Oct 2026 (untested live) | ⏳ |
| Note create | `24060573783603122` | Oct 2026 (untested live) | ⏳ |
| Note delete | `9532619970198958` | Oct 2026 (untested live) | ⏳ |
| Note check | `30899999999999999`→`30899655739648624` | Oct 2026 (untested live) | ⏳ |
| Profile lock | `9144138075685633` | Oct 2026 (untested live) | ⏳ |
| Sticker search | `24004987559125954` | Oct 2026 (untested live) | ⏳ |
| Sticker packs | `10095807770482952` / `29237828849196584` | Oct 2026 (untested live) | ⏳ |
| Pack add | `9877489362345320` | Oct 2026 (untested live) | ⏳ |
| Pack content | `23982341384707469` | Oct 2026 (untested live) | ⏳ |
| AI stickers | `24151467751156443` | Oct 2026 (untested live) | ⏳ |
| Theme info | `9734829906576883` | Oct 2026 (untested live) | ⏳ |

`⏳` = live টেস্ট হলে `✅ + date` বসাও। কোনো API ভাঙলে: (1) এখানে ❌ মার্কো, (2) watchlist থেকে নতুন doc_id আনো, (3) patch + version bump + CHANGELOG।

## 3. Log signals (প্রতিদিন চোখ বুলাও)
| Log | মানে | Action |
|---|---|---|
| `Circuit breaker TRIPPED` | FB restriction দিচ্ছে | বট slow করো, স্প্যামি command বন্ধ করো |
| `field_exception 1675030` | Mutation reject | doc_id বদলেছে কিনা watchlist-এ দেখো |
| `1357004` / `Not logged in` | Session মরেছে | Fresh cookie + `APPSTATE_JSON` update |
| `Max MQTT reconnection` | Net/FB MQTT issue | Region + backoff চেক |
| `E2EE ... failed` | Bridge/native missing | `koffi` + binary চেক (E2EE on থাকলে) |

## 4. Update procedure (প্রতিবার)
1. `CHANGELOG.md` এ entry + `package.json` version bump (patch: 4.3.x, feature: 4.x.0)
2. Mock test (`node --check` + load test) — live cookie ছাড়াই
3. 1টা clone ID-তে 24h soak test, তারপর main-এ
4. এই ফাইলের টেবিল update (✅ + date / ❌ + reason)

## 5. Non-goals (করবো না)
- Auto-update (personal use, manual control)
- প্রতি request UA rotate (fingerprint lock-ই থাকবে)
- Dashboard public expose (attack surface)
