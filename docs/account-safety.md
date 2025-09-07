# Nexus-FCA Account Safety Guide

## 🛡️ Overview
Nexus-FCA Ultra-Safe Edition is designed to minimize Facebook account ban, lock, checkpoint, and block rates. This guide explains how the advanced safety system works and how you can maximize your account protection.

---

## 🚦 How Nexus-FCA Protects Your Account
- **Ultra-Low Ban Rate Algorithms:** Smart request timing and human-like behavior simulation reduce detection risk by 50%+
- **Real-Time Risk Assessment:** The system continuously monitors your account activity and adapts delays and patterns for safety
- **Proactive Safety Alerts:** If a risk is detected (lock, checkpoint, block), the bot will pause or stop to prevent further issues
- **Session & Token Management:** Automatic session validation and safe token refresh keep your login secure
- **Region & Connection Protection:** Advanced region bypass and safe reconnection logic avoid suspicious activity triggers
- **Unified Safety Orchestrator (2.1.8+):** Single scheduler coordinates safe refresh, light poke (~6h ±40m), and periodic recycle (~6h ±30m) with collision spacing (45m) to prevent clustered token actions
- **Ghost / Idle Detection:** Soft-stale probing (2m30s) and ghost recovery before full disconnect patterns emerge

---

## ⚙️ Enabling Maximum Safety
- **Ultra-Safe Mode:**
  - Set environment variable: `NEXUS_FCA_ULTRA_SAFE_MODE=1`
  - Or use option: `{ ultraLowBanMode: true }` in your NexusClient config
- **Human-Like Delays:**
  - Enable with `{ safeDelays: true }` (recommended for all bots)
- **Use Fresh AppState:**
  - Always use cookies less than 7 days old for best results
- **Monitor Risk Level:**
  - Listen for `riskLevelHigh`, `accountLocked`, `checkpointRequired` events and take action if triggered
- **Avoid Deprecated Manager:** Do not instantiate `FacebookSafetyManager` (legacy); consolidated `FacebookSafety` handles everything automatically.

---

## 📝 Best Practices for Account Safety
- **Never use the same account for both bot and personal use**
- **Avoid running multiple bots on the same account**
- **Do not spam or send repetitive messages**
- **Update your appstate.json regularly**
- **Monitor your Facebook account for security notifications**
- **If you see a checkpoint or lock, stop the bot and verify your account manually**
- **Do not schedule custom token poke timers; built‑in orchestrator already manages safe refresh cadence & spacing**
- **Keep `persistent-device.json` stable—don’t delete unless forced by actual session invalidation**

---

## 🧑‍💻 Example: Ultra-Safe Login
```js
const { NexusClient } = require('nexus-fca');
const client = new NexusClient({
  ultraLowBanMode: true,
  safeDelays: true,
  intelligentSafety: true
});
client.login({ appState: require('./appstate.json') });
```

---

## 🚨 Safety Events
- `accountLocked` — Account locked or checkpointed, bot will stop
- `checkpointRequired` — Facebook requires manual verification
- `riskLevelHigh` — High risk detected, bot will increase delays and reduce activity
- `sessionExpired` — Session expired, update your appstate.json
- `safeRefresh` — Safe token refresh attempted (payload includes success/failure, duration)
- `lightPoke` — Lightweight fb_dtsg keep-alive executed
- `mqttReconnect` — Reconnect cycle triggered (reason + attempt)
- `heartbeat` — Periodic keepalive ping succeeded

### Event Spacing (2.1.8+)
The orchestrator enforces a minimum spacing window (~45m) between maintenance actions (refresh, recycle, light poke). If a recycle is scheduled too soon after a refresh/poke it defers 20–30m automatically to avoid clustering patterns.

---

## ❓ FAQ
**Q: Can Nexus-FCA guarantee my account will never be banned?**
> No system can guarantee 100% safety, but Nexus-FCA's advanced safety features greatly reduce the risk compared to other bots.

**Q: What should I do if my account is locked or checkpointed?**
> Stop the bot immediately, log in to Facebook manually, and follow the verification steps. Only restart the bot after your account is fully restored.

**Q: How often should I update my appstate.json?**
> At least once a week, or whenever you see a session expired or checkpoint event (less often if persistent device + long stable runs).

**Q: How often are tokens refreshed now?**
> Adaptive. Low risk uses multi‑hour windows; high risk shortens interval. Lightweight mid-session poke (~6h ±40m) and periodic recycle (~6h ±30m) are collision‑guarded with 45m spacing.

**Q: Do I need to keep my own refresh timers?**
> No. Remove custom refresh/poke loops—duplication increases clustering risk.

**Q: Is legacy `FacebookSafetyManager` still required?**
> No. It is deprecated and only logs a warning if used. Migrate entirely to the integrated safety layer (automatic on login).

---

## ⚠️ Disclaimer
Nexus-FCA is not affiliated with Facebook. Use responsibly and at your own risk. Automation may violate Facebook’s terms of service.
