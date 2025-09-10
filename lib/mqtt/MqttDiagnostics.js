"use strict";
// Lightweight diagnostics helper for MQTT/WebSocket connection lifecycle.
// Captures low-level events so we can understand repeated reconnect loops.
module.exports = function attachMqttDiagnostics(ws, ctx, log){
  if(!ws || typeof ws.on !== 'function') return;
  const diag = ctx._mqttDiag = ctx._mqttDiag || { attempts:0, events:[] };
  function push(evt){
    try {
      diag.events.push({ t: Date.now(), ...evt });
      if(diag.events.length > 50) diag.events.shift();
    } catch(_) {}
  }
  ws.on('upgrade', (res)=>{ push({ type:'upgrade', status: res.statusCode, headers: safeHeaders(res.headers) }); });
  ws.on('unexpected-response', (req, res)=>{ push({ type:'unexpected_response', status: res && res.statusCode, headers: res && safeHeaders(res.headers) }); });
  ws.on('close', (code, reason)=>{ push({ type:'close', code, reason: reason && reason.toString() }); });
  ws.on('error', (err)=>{ push({ type:'error', message: err && (err.message||err.code||'').toString(), code: err && err.code }); });
  function safeHeaders(h){ if(!h) return {}; const out={}; for(const k of Object.keys(h)){ if(k.startsWith('cookie')) continue; out[k]=h[k]; } return out; }
  // expose a snapshot method
  ctx.getMqttDiagnostics = () => ({ attempts: diag.attempts, recent: [...diag.events] });
};
