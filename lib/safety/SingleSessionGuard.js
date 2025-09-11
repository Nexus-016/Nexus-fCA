"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

function nowIso(){ return new Date().toISOString(); }

function readJsonSafe(file){
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch(_) { return null; }
}

function writeJsonSafe(file, obj){
  try { fs.writeFileSync(file, JSON.stringify(obj, null, 2)); } catch(_) {}
}

class SingleSessionGuard {
  constructor(options={}){
    const baseDir = options.dataDir || process.env.NEXUS_DATA_DIR || process.env.RENDER_DATA_DIR || process.cwd();
    this.lockPath = options.lockPath || process.env.NEXUS_SESSION_LOCK_PATH || path.join(baseDir, 'session.lock');
    this.ttlMs = options.ttlMs || parseInt(process.env.NEXUS_SESSION_TTL_MS || '900000', 10); // default 15m
    this.force = options.force || (process.env.NEXUS_FORCE_LOCK === '1' || process.env.NEXUS_FORCE_LOCK === 'true');
    this.heartbeatMs = options.heartbeatMs || 60000; // 1m
    this.sessionId = (options.sessionId) || `${process.pid}-${Math.random().toString(36).slice(2,10)}`;
    this._hbTimer = null;
    this._acquired = false;
  }

  isStale(lock){
    if(!lock || !lock.updatedAt) return true;
    const age = Date.now() - new Date(lock.updatedAt).getTime();
    return age > this.ttlMs;
  }

  acquire(){
    // Ensure parent dir exists
    try { fs.mkdirSync(path.dirname(this.lockPath), { recursive: true }); } catch(_) {}
    if (fs.existsSync(this.lockPath)){
      const existing = readJsonSafe(this.lockPath);
      if (this.isStale(existing) || this.force){
        // Take over
        try { fs.unlinkSync(this.lockPath); } catch(_) {}
      } else {
        const msg = `Another Nexus-FCA session appears active (lock: ${this.lockPath}). Set NEXUS_FORCE_LOCK=true to override or wait until stale.`;
        const error = new Error(msg);
        error.code = 'NEXUS_MULTIPLE_SESSIONS';
        throw error;
      }
    }
    const payload = {
      pid: process.pid,
      host: os.hostname(),
      sessionId: this.sessionId,
      startedAt: nowIso(),
      updatedAt: nowIso()
    };
    writeJsonSafe(this.lockPath, payload);
    this._acquired = true;
    this._startHeartbeat();
    this._installExitHooks();
    return true;
  }

  _startHeartbeat(){
    this._clearHeartbeat();
    this._hbTimer = setInterval(()=>{
      try {
        if(!this._acquired) return;
        const cur = readJsonSafe(this.lockPath) || {};
        cur.updatedAt = nowIso();
        cur.pid = process.pid;
        cur.sessionId = this.sessionId;
        cur.host = cur.host || os.hostname();
        writeJsonSafe(this.lockPath, cur);
      } catch(_){}
    }, this.heartbeatMs).unref();
  }

  _clearHeartbeat(){
    if(this._hbTimer){ try { clearInterval(this._hbTimer); } catch(_){} this._hbTimer = null; }
  }

  _installExitHooks(){
    if (this._exitHooksInstalled) return;
    this._exitHooksInstalled = true;
    const release = () => { try { this.release(); } catch(_){} };
    process.on('SIGINT', release);
    process.on('SIGTERM', release);
    process.on('exit', release);
  }

  release(){
    this._clearHeartbeat();
    if(!this._acquired) return;
    this._acquired = false;
    try { if(fs.existsSync(this.lockPath)) fs.unlinkSync(this.lockPath); } catch(_){}
  }
}

module.exports = { SingleSessionGuard };
