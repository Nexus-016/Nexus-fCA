// Nexus-FCA: Advanced and Safe Facebook Chat API
// getAccess.js - Get Facebook access token (with 2FA support)

const utils = require('../utils');

module.exports = function (defaultFuncs, api, ctx) {
  return function getAccess(authCode = '', callback) {
    let cb;
    const url = 'https://business.facebook.com/';
    const Referer = url + 'security/twofactor/reauth/?twofac_next=' + encodeURIComponent(url + 'content_management') + '&type=avoid_bypass&app_id=0&save_device=0';
    const rt = new Promise(function (resolve, reject) {
      cb = (error, token) => token ? resolve(token) : reject(error);
    });

    if (typeof authCode == 'function') {
      callback = authCode;
      authCode = '';
    }
    if (typeof callback == 'function') cb = callback;
    if (!!ctx.access_token) 
      cb(null, ctx.access_token);
    else 
      utils
        .get(url + 'content_management', ctx.jar, null, ctx.globalOptions, null, {
          noRef: true,
          Origin: url
        })
        .then(function (res) {
          const html = res.body;
          const lsd = utils.getFrom(html, "[\"LSD\",[],{\"token\":\"", "\"}");
          return lsd;
        })
        .then(function (lsd) {
          function submitCode(code) {
            let pCb;
            const rtPromise = new Promise(function (resolve) {
              pCb = (error, token) => resolve(cb(error, token));
            });
            if (typeof code != 'string')
              pCb({
                error: 'submitCode',
                lerror: 'code must be string',
                continue: submitCode
              });
            else 
              defaultFuncs
                .post(url + 'security/twofactor/reauth/enter/', ctx.jar, {
                  approvals_code: code,
                  save_device: true,
                  lsd 
                }, ctx.globalOptions, null, {
                  Referer,
                  Origin: url
                })
                .then(function (res) {
                  // ...handle response...
                });
            return rtPromise;
          }
          cb({
            error: '2FA required',
            continue: submitCode
          });
        });
    return rt;
  };
};
