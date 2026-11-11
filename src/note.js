/**
 * ===========================================================
 * Nexus-fCA Messenger Notes API.
 * Nexus-fCA 4.1.0.
 * Messenger Notes: api.note.check/create/delete/update
 * Example: api.note.create("hello", { privacy: "FRIENDS" }, cb)
 * ===========================================================
 */
"use strict";

const utils = require('../utils');

module.exports = function(defaultFuncs, api, ctx) {

  function checkNoteAdvanced(callback) {
    if (typeof callback !== 'function') {
      callback = () => {};
    }

    const form = {
      fb_api_caller_class: "RelayModern",
      fb_api_req_friendly_name: "MWInboxTrayNoteCreationDialogQuery",
      variables: JSON.stringify({ scale: 2 }),
      doc_id: "30899655739648624",
    };

    defaultFuncs
      .post("https://www.facebook.com/api/graphql/", ctx.jar, form)
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then(resData => {
        if (resData && resData.errors) throw resData.errors[0];
        const currentNote = resData?.data?.viewer?.actor?.msgr_user_rich_status;

        const enhancedResponse = {
          note: currentNote,
          hasActiveNote: !!currentNote,
          userId: ctx.userID,
          timestamp: Date.now(),
          expiresAt: currentNote ? (currentNote.created_time * 1000) + (24 * 60 * 60 * 1000) : null
        };

        callback(null, enhancedResponse);
      })
      .catch(err => {
        utils.error && utils.error("note.checkNoteAdvanced", err);
        callback(err);
      });
  }

  function createNoteAdvanced(text, options = {}, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    if (typeof callback !== 'function') {
      callback = () => {};
    }

    if (!text || text.trim().length === 0) {
      return callback(new Error("Note text cannot be empty"));
    }

    if (text.length > 280) {
      return callback(new Error("Note text cannot exceed 280 characters"));
    }

    const {
      privacy = "FRIENDS",
      duration = 86400,
      noteType = "TEXT_NOTE"
    } = options;

    const variables = {
      input: {
        client_mutation_id: Math.round(Math.random() * 1000000).toString(),
        actor_id: ctx.userID,
        description: text.trim(),
        duration: duration,
        note_type: noteType,
        privacy: privacy,
        session_id: utils.getGUID(),
      },
    };

    const form = {
      fb_api_caller_class: "RelayModern",
      fb_api_req_friendly_name: "MWInboxTrayNoteCreationDialogCreationStepContentMutation",
      variables: JSON.stringify(variables),
      doc_id: "24060573783603122",
    };

    defaultFuncs
      .post("https://www.facebook.com/api/graphql/", ctx.jar, form)
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then(resData => {
        if (resData && resData.errors) throw resData.errors[0];
        const status = resData?.data?.xfb_rich_status_create?.status;
        if (!status) throw new Error("Could not find note status in the server response.");

        const enhancedResponse = {
          ...status,
          createdAt: Date.now(),
          expiresAt: Date.now() + (duration * 1000),
          characterCount: text.trim().length,
          privacy: privacy
        };

        callback(null, enhancedResponse);
      })
      .catch(err => {
        utils.error && utils.error("note.createNoteAdvanced", err);
        callback(err);
      });
  }

  function deleteNoteAdvanced(noteID, callback) {
    if (typeof callback !== 'function') {
      callback = () => {};
    }

    if (!noteID) {
      return callback(new Error("Note ID is required"));
    }

    const variables = {
      input: {
        client_mutation_id: Math.round(Math.random() * 1000000).toString(),
        actor_id: ctx.userID,
        rich_status_id: noteID,
      },
    };

    const form = {
      fb_api_caller_class: "RelayModern",
      fb_api_req_friendly_name: "useMWInboxTrayDeleteNoteMutation",
      variables: JSON.stringify(variables),
      doc_id: "9532619970198958",
    };

    defaultFuncs
      .post("https://www.facebook.com/api/graphql/", ctx.jar, form)
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then(resData => {
        if (resData && resData.errors) throw resData.errors[0];
        const deletedStatus = resData?.data?.xfb_rich_status_delete;
        if (!deletedStatus) throw new Error("Could not find deletion status in the server response.");

        const enhancedResponse = {
          ...deletedStatus,
          deletedAt: Date.now(),
          noteId: noteID
        };

        callback(null, enhancedResponse);
      })
      .catch(err => {
        utils.error && utils.error("note.deleteNoteAdvanced", err);
        callback(err);
      });
  }

  function updateNote(oldNoteID, newText, options = {}, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    if (typeof callback !== 'function') {
      callback = () => {};
    }

    deleteNoteAdvanced(oldNoteID, (err, deleted) => {
      if (err) {
        return callback(err);
      }

      setTimeout(() => {
        createNoteAdvanced(newText, options, (err, created) => {
          if (err) {
            return callback(err);
          }
          callback(null, {
            deleted,
            created,
            updatedAt: Date.now()
          });
        });
      }, 1000);
    });
  }

  return {
    checkAdvanced: checkNoteAdvanced,
    createAdvanced: createNoteAdvanced,
    deleteAdvanced: deleteNoteAdvanced,
    update: updateNote,

    // Backward compatibility
    check: checkNoteAdvanced,
    create: createNoteAdvanced,
    delete: deleteNoteAdvanced,
    recreate: updateNote
  };
};
