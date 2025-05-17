// Nexus-FCA: Advanced and Safe Facebook Chat API
// getAvatarUser.js - Get user avatar URLs

const utils = require('../utils');

module.exports = function (defaultFuncs, api, ctx) {
  function handleAvatar(userIDs, height, width) {
    let cb;
    const uploads = [];
    const rtPromise = new Promise(function (resolve, reject) {
      cb = (error, data) => data ? resolve(data) : reject(error);
    });

    userIDs.map(function (v) {
      const mainPromise = defaultFuncs
        .get(`https://graph.facebook.com/${v}/picture?height=${height}&width=${width}&redirect=false&access_token=` + ctx.access_token, ctx.jar)
        .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
        .then(function (res) {
          return { 
            userID: v, 
            url: res.data.url 
          };
        })
        .catch(function (err) {
          return cb(err);
        });
      uploads.push(mainPromise);
    });

    Promise
      .all(uploads)
      .then(function (res) {
        return cb(null, res.reduce(function (Obj, { userID, url }) {
          Obj[userID] = url;
          return Obj;
        }, {}));
      })
      .catch(function (err) {
        return cb(err);
      });

    return rtPromise;
  }
  
  return function getAvatarUser(userIDs, size = [1500, 1500], callback) {
    let cb;
    const rtPromise = new Promise(function (resolve, reject) {
      cb = (err, res) => res ? resolve(res) : reject(err);
    });
    if (!Array.isArray(userIDs)) userIDs = [userIDs];
    handleAvatar(userIDs, size[0], size[1])
      .then(res => cb(null, res))
      .catch(cb);
    return rtPromise;
  };
};
