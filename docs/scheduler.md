# Message Scheduler — `api.scheduler`

> Schedule messages to be sent at a future time. One scheduler instance is created per session and reused (`ctx`-cached singleton).

**Added in:** Nexus-fCA 4.1.0

## Signature

```js
const scheduler = api.scheduler;
```

## Methods

| Method | Signature | Returns |
|---|---|---|
| `scheduleMessage(message, threadID, when, options?)` | see below | Scheduled ID (`scheduled_N_<ts>`) |
| `cancelScheduledMessage(id)` | `cancelScheduledMessage(id: string)` | `true` if cancelled |
| `getScheduledMessage(id)` | `getScheduledMessage(id: string)` | Info object or `null` |
| `listScheduledMessages()` | `listScheduledMessages()` | Array, sorted by send time |
| `cancelAllScheduledMessages()` | `cancelAllScheduledMessages()` | Count cancelled |
| `getScheduledCount()` | `getScheduledCount()` | Active count |
| `cleanup()` | `cleanup()` | Removes stale/cancelled entries (also runs automatically every 5 min) |
| `destroy()` | `destroy()` | Cancels everything and stops the internal timer |

## Scheduling Parameters

| Parameter | Type | Description |
|---|---|---|
| `message` | string \| object | Passed to `api.sendMessage` at send time |
| `threadID` | string | Target thread |
| `when` | Date \| number \| string | `Date` object, Unix **ms** timestamp, or ISO date string — must be in the future |
| `options.replyMessageID` | string | Optional reply target |
| `options.isGroup` | boolean | Optional group flag |
| `options.callback` | function | Called with the send result/error |

## Usage

```js
// 10 minutes from now
const id = scheduler.scheduleMessage('Reminder!', threadID, Date.now() + 10 * 60 * 1000);

// At a specific wall-clock time (ISO string)
scheduler.scheduleMessage('Good morning', threadID, '2026-12-01T09:00:00');

// Check / cancel
console.log(scheduler.listScheduledMessages());
scheduler.cancelScheduledMessage(id);

// Destroy on shutdown
process.on('SIGINT', () => { scheduler.destroy(); process.exit(0); });
```

## Errors

- `Error("Invalid 'when' parameter. Must be Date, number (timestamp), or ISO string")`
- `Error('Invalid date/time')` — unparseable date.
- `Error('Scheduled time must be in the future')`

## Important: In-Memory Only

The scheduler lives in RAM. **Scheduled jobs are lost on process restart** — on ephemeral hosts (Koyeb/Render free tiers) or crash-loops, queued jobs vanish. For must-deliver reminders, persist them in your own database and re-schedule on boot.
