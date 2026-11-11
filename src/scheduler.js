"use strict";
const log = require("npmlog");

module.exports = function (defaultFuncs, api, ctx) {
  if (!ctx._scheduler) {
    ctx._scheduler = createSchedulerInstance(api);
  }
  return ctx._scheduler;
};

function createSchedulerInstance(api) {
  const scheduledMessages = new Map();
  let nextId = 1;

  function scheduleMessage(message, threadID, when, options = {}) {
    let timestamp;
    if (when instanceof Date) {
      timestamp = when.getTime();
    } else if (typeof when === "number") {
      timestamp = when;
    } else if (typeof when === "string") {
      timestamp = new Date(when).getTime();
    } else {
      throw new Error("Invalid 'when' parameter. Must be Date, number (timestamp), or ISO string");
    }

    if (isNaN(timestamp)) {
      throw new Error("Invalid date/time");
    }

    const now = Date.now();
    if (timestamp <= now) {
      throw new Error("Scheduled time must be in the future");
    }

    const id = `scheduled_${nextId++}_${Date.now()}`;
    const delay = timestamp - now;

    const scheduled = {
      id,
      message,
      threadID,
      timestamp,
      createdAt: now,
      options: {
        replyMessageID: options.replyMessageID,
        isGroup: options.isGroup,
        callback: options.callback
      },
      cancelled: false
    };

    scheduled.timeout = setTimeout(() => {
      if (scheduled.cancelled) return;

      try {
        log.info("scheduler", `Sending scheduled message ${id}`);
        api.sendMessage(
          message,
          threadID,
          scheduled.options.callback || (() => {}),
          scheduled.options.replyMessageID,
          scheduled.options.isGroup
        ).then(() => {
          log.info("scheduler", `Scheduled message ${id} sent successfully`);
          scheduledMessages.delete(id);
        }).catch(err => {
          log.error("scheduler", `Error sending scheduled message ${id}: ${err && err.message ? err.message : String(err)}`);
          if (scheduled.options.callback) {
            scheduled.options.callback(err);
          }
          scheduledMessages.delete(id);
        });
      } catch (err) {
        log.error("scheduler", `Error in scheduled message ${id}: ${err && err.message ? err.message : String(err)}`);
        scheduledMessages.delete(id);
      }
    }, delay);

    scheduledMessages.set(id, scheduled);
    log.info("scheduler", `Message scheduled: ${id} (in ${Math.round(delay / 1000)}s)`);

    return id;
  }

  function cancelScheduledMessage(id) {
    const scheduled = scheduledMessages.get(id);
    if (!scheduled) return false;
    if (scheduled.cancelled) return false;

    clearTimeout(scheduled.timeout);
    scheduled.cancelled = true;
    scheduledMessages.delete(id);
    log.info("scheduler", `Scheduled message ${id} cancelled`);
    return true;
  }

  function getScheduledMessage(id) {
    const scheduled = scheduledMessages.get(id);
    if (!scheduled || scheduled.cancelled) return null;
    return {
      id: scheduled.id,
      message: scheduled.message,
      threadID: scheduled.threadID,
      timestamp: scheduled.timestamp,
      createdAt: scheduled.createdAt,
      options: { ...scheduled.options },
      timeUntilSend: scheduled.timestamp - Date.now()
    };
  }

  function listScheduledMessages() {
    const now = Date.now();
    const list = [];
    for (const scheduled of scheduledMessages.values()) {
      if (scheduled.cancelled) continue;
      list.push({
        id: scheduled.id,
        message: scheduled.message,
        threadID: scheduled.threadID,
        timestamp: scheduled.timestamp,
        createdAt: scheduled.createdAt,
        options: { ...scheduled.options },
        timeUntilSend: scheduled.timestamp - now
      });
    }
    return list.sort((a, b) => a.timestamp - b.timestamp);
  }

  function cancelAllScheduledMessages() {
    let count = 0;
    for (const id of scheduledMessages.keys()) {
      if (cancelScheduledMessage(id)) count++;
    }
    log.info("scheduler", `Cancelled ${count} scheduled messages`);
    return count;
  }

  function getScheduledCount() {
    return scheduledMessages.size;
  }

  function cleanup() {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, scheduled] of scheduledMessages.entries()) {
      if (scheduled.cancelled || scheduled.timestamp < now) {
        scheduledMessages.delete(id);
        cleaned++;
      }
    }
    if (cleaned > 0) log.info("scheduler", `Cleaned up ${cleaned} scheduled messages`);
  }

  const cleanupInterval = setInterval(cleanup, 5 * 60 * 1000);

  function destroy() {
    clearInterval(cleanupInterval);
    const count = cancelAllScheduledMessages();
    log.info("scheduler", "Scheduler destroyed and all resources cleaned up");
    return count;
  }

  return {
    scheduleMessage,
    cancelScheduledMessage,
    getScheduledMessage,
    listScheduledMessages,
    cancelAllScheduledMessages,
    getScheduledCount,
    cleanup,
    destroy,
    _cleanupInterval: cleanupInterval
  };
}
