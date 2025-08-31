"use strict";
// Lightweight health & metrics tracker for Nexus-FCA (extended Stage 2 + Memory Guard)
class HealthMetrics {
  constructor() {
    const now = Date.now();
    this.uptimeStart = now;
    this.lastConnectTs = 0;
    this.lastDisconnectTs = 0;
    this.lastMessageTs = 0;
    this.lastErrorTs = 0;
    this.lastErrorType = null;
    this.reconnects = 0;
    this.consecutiveFailures = 0;
    this.messagesReceived = 0;
    this.syntheticKeepAlives = 0;
    this.acksReceived = 0;
    this.pendingEdits = 0;
    this.pendingEditMap = new Map(); // messageID -> { ts, text, attempts }
    this.pendingEditsDropped = 0;     // dropped due to cap
    this.pendingEditsExpired = 0;     // expired via TTL sweep
    this.outboundQueueDepth = 0;
    this.outboundQueueDropped = 0;
    this.lastAckLatencyMs = null;
    this.avgAckLatencyMs = null;
    this._ackLatencySamples = [];
    this.p95AckLatencyMs = null;
    this.editResends = 0;
    this.editFailed = 0;
    // Memory / queue guard metrics (Stage 3)
    this.memoryGuardRuns = 0;
    this.memoryGuardLastRun = 0;
    this.memoryGuardActions = 0;
    this.groupQueuePrunedThreads = 0;
    this.groupQueueExpiredQueues = 0;
    this.groupQueueDroppedMessages = 0;
    this.pendingEditSweeps = 0;
  }
  onConnect() { this.lastConnectTs = Date.now(); this.consecutiveFailures = 0; }
  onDisconnect() { this.lastDisconnectTs = Date.now(); }
  onMessage() { this.messagesReceived++; this.lastMessageTs = Date.now(); }
  onSynthetic() { this.syntheticKeepAlives++; }
  onAck(latencyMs){
    this.acksReceived++;
    if(typeof latencyMs === 'number'){
      this.lastAckLatencyMs = latencyMs;
      if(this.avgAckLatencyMs == null) this.avgAckLatencyMs = latencyMs; else this.avgAckLatencyMs = Math.round(this.avgAckLatencyMs*0.8 + latencyMs*0.2);
      // track distribution (cap list length for memory safety)
      this._ackLatencySamples.push(latencyMs);
      if(this._ackLatencySamples.length > 50) this._ackLatencySamples.shift();
      this._recalcP95();
    }
  }
  _recalcP95(){
    if(!this._ackLatencySamples.length){ this.p95AckLatencyMs = null; return; }
    const sorted = [...this._ackLatencySamples].sort((a,b)=>a-b);
    const idx = Math.min(sorted.length-1, Math.floor(sorted.length*0.95));
    this.p95AckLatencyMs = sorted[idx];
  }
  onError(type){ this.lastErrorTs = Date.now(); this.lastErrorType = type || 'unknown'; }
  onReconnectScheduled(delay){ this.reconnects++; this.currentBackoffDelay = delay; if(delay > (this.maxObservedBackoff||0)) this.maxObservedBackoff = delay; }
  trackOutbound(depth){ this.outboundQueueDepth = depth; }
  incOutboundDropped(){ this.outboundQueueDropped++; }
  addPendingEdit(mid, text){ this.pendingEditMap.set(mid, { ts: Date.now(), text, attempts: 0 }); this.pendingEdits = this.pendingEditMap.size; }
  markEditResent(mid){ const rec = this.pendingEditMap.get(mid); if(rec){ rec.attempts++; this.editResends++; } }
  markEditFailed(mid){ if(this.pendingEditMap.delete(mid)) { this.pendingEdits = this.pendingEditMap.size; this.editFailed++; } }
  removePendingEdit(mid){ if(this.pendingEditMap.delete(mid)) this.pendingEdits = this.pendingEditMap.size; }
  incPendingEditDropped(){ this.pendingEditsDropped++; }
  incPendingEditExpired(n=1){ this.pendingEditsExpired += n; }
  sweepPendingEdits(ttlMs){
    const now = Date.now();
    let expired = 0;
    for(const [mid, val] of this.pendingEditMap.entries()){
      if(now - val.ts > ttlMs){ this.pendingEditMap.delete(mid); expired++; }
    }
    if(expired) { this.incPendingEditExpired(expired); this.pendingEditSweeps++; }
    this.pendingEdits = this.pendingEditMap.size;
  }
  // Memory guard helpers
  recordMemoryGuardRun(actions=0){ this.memoryGuardRuns++; this.memoryGuardLastRun = Date.now(); this.memoryGuardActions += actions; }
  recordGroupQueuePrune(threads, expiredQueues, droppedMsgs){
    if(threads) this.groupQueuePrunedThreads += threads;
    if(expiredQueues) this.groupQueueExpiredQueues += expiredQueues;
    if(droppedMsgs) this.groupQueueDroppedMessages += droppedMsgs;
  }
  snapshot(){
    const now = Date.now();
    const idleMs = now - (this.lastMessageTs || this.lastConnectTs || now);
    return {
      uptimeMs: now - this.uptimeStart,
      idleMs,
      reconnects: this.reconnects,
      consecutiveFailures: this.consecutiveFailures,
      lastErrorType: this.lastErrorType,
      lastErrorAgoMs: this.lastErrorTs ? now - this.lastErrorTs : null,
      currentBackoffDelay: this.currentBackoffDelay||0,
      maxObservedBackoff: this.maxObservedBackoff||0,
      messagesReceived: this.messagesReceived,
      syntheticKeepAlives: this.syntheticKeepAlives,
      acksReceived: this.acksReceived,
      lastAckLatencyMs: this.lastAckLatencyMs,
      avgAckLatencyMs: this.avgAckLatencyMs,
      p95AckLatencyMs: this.p95AckLatencyMs,
      pendingEdits: this.pendingEdits,
      pendingEditsDropped: this.pendingEditsDropped,
      pendingEditsExpired: this.pendingEditsExpired,
      editResends: this.editResends,
      editFailed: this.editFailed,
      outboundQueueDepth: this.outboundQueueDepth,
      outboundQueueDropped: this.outboundQueueDropped,
      memoryGuardRuns: this.memoryGuardRuns,
      memoryGuardLastRun: this.memoryGuardLastRun,
      memoryGuardActions: this.memoryGuardActions,
      groupQueuePrunedThreads: this.groupQueuePrunedThreads,
      groupQueueExpiredQueues: this.groupQueueExpiredQueues,
      groupQueueDroppedMessages: this.groupQueueDroppedMessages,
      pendingEditSweeps: this.pendingEditSweeps,
      healthy: this.isHealthy(idleMs)
    };
  }
  isHealthy(idleMs){ if (this.consecutiveFailures >= 10) return false; if (this.messagesReceived < 5 && idleMs > 5*60*1000) return false; return true; }
}
module.exports = { HealthMetrics };