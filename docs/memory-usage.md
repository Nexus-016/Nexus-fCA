# Nexus-FCA Memory Usage Guide

## Built-in guardrails

- **Outbound MQTT buffers** (`src/sendMessageMqtt.js`, `src/listenMqtt.js`)
  - `_pendingOutbound` tracks only outstanding message IDs and is pruned immediately when an ACK lands.
  - Health metrics (`lib/health/HealthMetrics.js`) cap ACK samples at 50 entries and keep averages via exponential smoothing, so telemetry never balloons in RAM.
- **Pending edit queue** (`src/editMessage.js`)
  - `globalOptions.editSettings.maxPendingEdits` defaults to 200; oldest edits are dropped once the cap is hit, and TTL checks clear stale entries.
  - Every ACK removes the corresponding entry, and `HealthMetrics` mirrors the size so you can alert if it starts climbing.
- **Group send queue** (`index.js`)
  - Each group’s queue is capped (default 100 messages) and sweeps run every 5 minutes to drop idle or over-capacity queues.
  - Sweeper stats surface through `ctx.health.recordGroupQueuePrune`, so you can confirm that cleanup is happening.
- **Performance caches** (`lib/performance/PerformanceManager.js`)
  - Cache maps are bounded by `cacheSize` (default 1000) and enforce TTL, while request time windows keep only the last 100 samples.
  - `PerformanceOptimizer` trims its request history to 1000 entries and halves the buffer on each cleanup pass.
- **Database write queue** (`lib/database/EnhancedDatabase.js`)
  - Writes batch in chunks of 100 and the queue processor re-runs every second. Long outages are the only way to accumulate large queues.
- **Safety timers** (`lib/safety/FacebookSafety.js`)
  - All recurring timers are stored and cleared before new ones are scheduled, preventing runaway intervals during reconnect churn.

## Situations that can increase memory

| Area | Why it grows | Mitigation |
| --- | --- | --- |
| Database write queue | Target SQLite/SQL server offline → `writeQueue` keeps buffering | Monitor `writeQueue.length` or add alerts around `EnhancedDatabase.processQueue`; if storage is optional, disable DB integration entirely.
| Multiple PerformanceManager / PerformanceOptimizer instances | Each instance spawns its own metrics intervals and caches | Treat both managers as singletons; share them via dependency injection instead of `new`ing per feature.
| Elevated group queue caps | Setting `setGroupQueueCapacity` >> 100 multiplies per-thread memory | Keep caps small; rely on `_flushGroupQueue` for bursts instead of raising the ceiling.
| Pending edit saturation | Frequent edit retries without ACKs hit the 200-item cap | Investigate upstream failures (usually edit rights or MQTT drops). `api.getMemoryMetrics()` will show `pendingEditsDropped` climbing when this happens.
| Large custom caches | If you override `cacheSize` or TTLs to very large values, the Map will grow | Pick realistic TTLs; if the workload is mostly transient, disable cache (`enableCache: false`).

## Monitoring checklist

1. **Runtime snapshot** – call `api.getMemoryMetrics()` to read pending edit counts, outbound depth, and memory guard actions.
2. **Health dashboard** – `ctx.health.snapshot()` (or the API wrapper `getHealthMetrics`) exposes ACK latency samples and queue stats.
3. **Performance events** – `PerformanceManager` emits `metricsUpdate` every 30s; attach a listener and pipe to your logger or Prometheus bridge.
4. **Node heap checks** – pair the built-in metrics with `process.memoryUsage()` or `--inspect` tooling if you suspect leaks from user code.

## Configuration tips

- Tune `globalOptions.editSettings` if your bot edits aggressively; lower `maxPendingEdits` to 100 and `editTTLms` to 2–3 minutes for tighter control.
- Use `api.setGroupQueueCapacity(n)` to keep per-thread queues bounded; the sweeper already limits idle queues to 30 minutes, but lower values (10–20) reduce burst memory further.
- If you don’t need database analytics, avoid initializing `EnhancedDatabase`/`DatabaseManager`; the rest of the stack runs without it.
- Disable extra instrumentation when running on low-memory hardware:
  ```js
  const perfManager = new PerformanceManager({ enableMetrics: false, enableCache: false });
  ```
- Always reuse the same `PerformanceOptimizer`/`PerformanceManager` instead of instantiating per request handler, so their intervals remain singular.

Following the defaults keeps Nexus-FCA comfortably under a few hundred megabytes even on small VPS nodes. When memory spikes appear, start by sampling `api.getMemoryMetrics()` and check the table above to see which subsystem is accumulating work. Adjust the related caps or temporarily disable the optional feature until the upstream issue (DB outage, repeated edit failures, etc.) is resolved.
