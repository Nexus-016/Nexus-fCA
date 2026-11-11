"use strict";
const fs = require("fs");
const path = require("path");
const log = require("npmlog");

module.exports = function (defaultFuncs, api, ctx) {
  return function enableAutoSaveAppState(options = {}) {
    const filePath = options.filePath || path.join(process.cwd(), "appstate.json");
    const interval = options.interval || 10 * 60 * 1000; // 10 minutes default
    const saveOnLogin = options.saveOnLogin !== false; // default true

    function saveAppState() {
      try {
        const appState = api.getAppState();
        if (!appState || appState.length === 0) {
          log.warn("enableAutoSaveAppState", "AppState is empty, skipping save");
          return;
        }

        const data = JSON.stringify(appState, null, 2);
        fs.writeFileSync(filePath, data, "utf8");
        log.info("enableAutoSaveAppState", `AppState saved to ${filePath}`);
      } catch (error) {
        log.error("enableAutoSaveAppState", `Error saving AppState: ${error && error.message ? error.message : String(error)}`);
      }
    }

    let immediateSaveTimer = null;
    if (saveOnLogin) {
      immediateSaveTimer = setTimeout(() => {
        saveAppState();
        immediateSaveTimer = null;
      }, 2000);
    }

    const intervalId = setInterval(saveAppState, interval);
    log.info("enableAutoSaveAppState", `Auto-save AppState enabled: ${filePath} (every ${Math.round(interval / 1000 / 60)} minutes)`);

    if (!ctx._autoSaveInterval) {
      ctx._autoSaveInterval = [];
    }
    ctx._autoSaveInterval.push(intervalId);

    return function disableAutoSaveAppState() {
      if (immediateSaveTimer) {
        clearTimeout(immediateSaveTimer);
        immediateSaveTimer = null;
      }
      clearInterval(intervalId);
      const index = ctx._autoSaveInterval ? ctx._autoSaveInterval.indexOf(intervalId) : -1;
      if (index !== -1) {
        ctx._autoSaveInterval.splice(index, 1);
      }
      log.info("enableAutoSaveAppState", "Auto-save AppState disabled");
    };
  };
};
