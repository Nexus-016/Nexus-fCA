// Nexus-FCA: Advanced and Safe Facebook Chat API
// createCommentPost.js - Create a comment on a Facebook post

const utils = require('../utils.js');

module.exports = function (defaultFuncs, api, ctx) {
  function handleUpload(msg, form) {
    let cb;
    const uploads = [];
    const returnPromise = new Promise(function (resolve, reject) {
      cb = error => error ? reject(error) : resolve();
    });

    for (let item of msg.attachments) {
      if (!utils.isReadableStream(item))
        return cb({ error: 'image should be a readable stream and not ' + utils.getType(item) });

      const httpData = defaultFuncs
        .postFormData('https://www.facebook.com/ajax/ufi/upload/', ctx.jar, {
          profile_id: ctx.userID,
          source: 19,
          target_id: ctx.userID,
          file: item
        })
        .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
        .then(function (res) {
          if (res.errors || res.error || !res.payload) 
            throw res;

          return {
            media: {
              id: res.payload.fbid
            }
          };
        })
        .catch(cb);
      uploads.push(httpData);
    }

    Promise
      .all(uploads)
      .then(function (main) {
        main.forEach(item => form.input.attachments.push(item));
        return cb();
      })
      .catch(cb);

    return returnPromise;
  }

  function handleURL(msg, form) {
    if (typeof msg.url == 'string') {
      form.input.attachments = [
        {
          link: {
            external: {
              url: msg.url
            }
          }
        }
      ];
    }
  }

  function handleMentions(msg, form) {
    for (let item of msg.mentions) {
      const { tag, id, fromIndex } = item;
      if (typeof tag != 'string')
        throw 'Mention tag must be string';
      if (!id)
        throw 'id must be string';
      const offset = msg.body.indexOf(tag, fromIndex || 0);
      if (offset < 0)
        throw 'Mention for "' + tag + '" not found in message string.';
      form.input.message.ranges.push({
        entity: { id },
        length: tag.length,
        offset
      });
    }
  }

  function handleSticker(msg, form) {
    if (msg.sticker) {
      form.input.attachments = [
        {
          media: {
            id: msg.sticker
          }
        }
      ];
    }
  }

  function createContent(form) {
    let cb;
    const returnPromise = new Promise(function (resolve, reject) {
      cb = (error, info) => info ? resolve(info) : reject(error);
    });

    defaultFuncs
      .post('https://www.facebook.com/api/graphql/', ctx.jar, {
        fb_api_caller_class: 'RelayModern',
        fb_api_req_friendly_name: 'useCometUFICreateCommentMutation',
        variables: JSON.stringify(form),
        server_timestamps: true,
        doc_id: 6993516810709754
      })
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then(function (res) {
        if (res.errors) 
          throw res;
        const resData = res.data.comment_create;
        const info = {
          id: resData.feedback_comment_edge.node.id,
          url: resData.feedback_comment_edge.node.feedback.url,
          count: resData.feedback.total_comment_count
        };
        return cb(null, info);
      })
      .catch(cb);
    return returnPromise;
  }

  return function createCommentPost(msg, postID, callback, replyCommentID) {
    let cb;
    const returnPromise = new Promise(function (resolve, reject) {
      cb = (error, info) => info ? resolve(info) : reject(error);
    });

    if (typeof msg == 'function') {
      const error = 'Message must be a string or object!!';
      utils.error('createCommentPost', error);
      return msg(error);
    }
    if (typeof postID == 'function') {
      const error = 'postID must be a string!!';
      utils.error('createCommentPost', error);
      return postID(error);
    }
    if (typeof callback == 'string') {
      replyCommentID = callback;
      callback = null;
    }
    if (typeof callback == 'function') 
      cb = callback;

    const MessageType = utils.getType(msg);

    if (MessageType == 'String') 
      msg = { 
        body: msg,
        attachments: [],
        mentions: [],
        sticker: null,
        url: null
      };
    else if (MessageType == 'Object') {
      msg.mentions ? !Array.isArray(msg.mentions) ? msg.mentions = [msg.mentions] : null : msg.mentions = [];
      msg.attachments ? !Array.isArray(msg.attachments) ? msg.attachments = [msg.attachments] : null : msg.attachments = [];
      isNaN(msg.sticker) ? msg.sticker = null : null;
      msg.body ? typeof msg.body == 'object' ? msg.body = JSON.stringify(msg.body) : null : msg.body = '';
    } else {
      const error = 'Message must be a string or object!!';
      utils.error('createCommentPost', error);
      return cb(error);
    }
    if (typeof postID != 'string') {
      const error = 'postID must be a string!!';
      utils.error('createCommentPost', error);
      return cb(error);
    }

    if (typeof replyCommentID != 'string') 
      replyCommentID = null;

    const form = {
      feedLocation: 'NEWSFEED',
      feedbackSource: 1,
      groupID: null,
      input: {
        client_mutation_id: Math.round(Math.random() * 19).toString(),
        actor_id: ctx.userID,
        attachments: [],
        feedback_id: Buffer.from('feedback:' + postID).toString('base64'),
        formatting_style: null,
        message: {
          ranges: [],  
          text: msg.body
        }, 
        reply_comment_parent_fbid: replyCommentID ? isNaN(replyCommentID) ? replyCommentID : Buffer.from('comment:' + postID + '_' + replyCommentID).toString('base64') : null,
        reply_target_clicked: !!replyCommentID,
        attribution_id_v2: 
          'CometHomeRoot.react,comet.home,via_cold_start,' 
          + Date.now() 
          + ',156248,4748854339,,',
        vod_video_timestamp: null,
        feedback_referrer: '/',
        is_tracking_encrypted: true,
        tracking: [], 
        feedback_source: 'NEWS_FEED', 
        idempotence_token: 'client:' + utils.getGUID(),
        session_id: utils.getGUID()
      },
      inviteShortLinkKey: null,
      renderLocation: null,
      scale: 1,
      useDefaultActor: false, 
      focusCommentID: null
    };

    handleUpload(msg, form)
      .then(_ => handleURL(msg, form))
      .then(_ => handleMentions(msg, form))
      .then(_ => handleSticker(msg, form))
      .then(_ => createContent(form))
      .then(info => cb(null, info))
      .catch(function (err) {
        utils.error('createCommentPost', err);
        return cb(null, err);
      });

    return returnPromise;
  };
};
