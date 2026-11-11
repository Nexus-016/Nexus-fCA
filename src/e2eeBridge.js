/**
 * ===========================================================
 * Nexus-fCA 4.3.0 - E2EE bridge wiring (opt-in, disabled by default)
 * E2EE core: toru-fca/alpha-fca e2ee.js (Labyrinth native bridge)
 *   + lib/e2ee/index.mjs bundle. Credits to original authors.
 *
 * Enable: login option { enableE2EE: true }.
 * Needs native deps on first E2EE use:
 *   npm i koffi yumi-json-bigint
 * plus the Labyrinth native binary (see e2ee.js header).
 * When disabled, api.connectE2EE returns a clear error and the
 * bot runs exactly as before (zero risk when off).
 *
 * Exposes: api.connectE2EE(cb), api.getE2EEBridge(),
 *           api.getE2EEDeviceData(cb) (+ patched send/reaction/
 *           typing/media helpers via patchApiForE2EE when enabled)
 * ===========================================================
 */
"use strict";

var log = require("npmlog");

module.exports = function (defaultFuncs, api, ctx) {
  function loadE2EE() {
    try {
      return require("../e2ee");
    } catch (e) {
      throw new Error(
        "E2EE module failed to load: " + (e && e.message ? e.message : e)
      );
    }
  }

  // Wire patched helpers immediately when E2EE is enabled at login
  if (ctx.globalOptions && ctx.globalOptions.enableE2EE === true) {
    try {
      loadE2EE().patchApiForE2EE(api, ctx);
      log.info("E2EE", "E2EE API helpers patched (opt-in enabled)");
    } catch (e) {
      log.warn("E2EE", "patchApiForE2EE failed: " + (e && e.message ? e.message : e));
    }
  }

  api.connectE2EE = function (callback) {
    if (!ctx.globalOptions || ctx.globalOptions.enableE2EE !== true) {
      const err = new Error(
        "E2EE is not enabled. Login with { enableE2EE: true } and install native deps: npm i koffi yumi-json-bigint"
      );
      if (typeof callback === "function") callback(err);
      return Promise.reject(err);
    }
    let bridge;
    try {
      const e2ee = loadE2EE();
      e2ee.patchApiForE2EE(api, ctx);
      bridge = e2ee.createBridge(ctx);
    } catch (e) {
      if (typeof callback === "function") callback(e);
      return Promise.reject(e);
    }
    api._e2eeBridge = bridge;
    try {
      const ret = bridge.connect(callback);
      return ret && typeof ret.then === "function" ? ret : Promise.resolve(ret);
    } catch (e) {
      if (typeof callback === "function") callback(e);
      return Promise.reject(e);
    }
  };

  api.getE2EEBridge = function () {
    return api._e2eeBridge || ctx._e2eeBridge || null;
  };

  api.getE2EEDeviceData = function (callback) {
    return new Promise(function (res, rej) {
      if (ctx._e2eeDeviceData) {
        res(ctx._e2eeDeviceData);
        if (callback) callback(null, ctx._e2eeDeviceData);
        return;
      }
      let e2ee;
      try {
        e2ee = loadE2EE();
      } catch (e) {
        rej(e);
        if (callback) callback(e);
        return;
      }
      e2ee.createBridge(ctx).getDeviceData()
        .then(function (d) {
          ctx._e2eeDeviceData = d;
          res(d);
          if (callback) callback(null, d);
        })
        .catch(function (e) {
          rej(e);
          if (callback) callback(e);
        });
    });
  };

  return {
    connect: api.connectE2EE,
    getBridge: api.getE2EEBridge,
    getDeviceData: api.getE2EEDeviceData,
    get enabled() {
      return !!(ctx.globalOptions && ctx.globalOptions.enableE2EE === true);
    }
  };
};
