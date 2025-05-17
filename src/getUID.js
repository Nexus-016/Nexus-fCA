// Nexus-FCA: Advanced and Safe Facebook Chat API
// getUID.js - Get Facebook user ID from profile link

const axios = require('axios');
const FormData = require('form-data');
const { URL } = require('url');
const log = require('npmlog');
const utils = require('../utils');

module.exports = function (defaultFuncs, api, ctx) {
  return function getUID(link, callback) {
    let resolveFunc = function () { };
    let rejectFunc = function () { };
    let returnPromise = new Promise(function (resolve, reject) {
      resolveFunc = resolve;
      rejectFunc = reject;
    });

    if (!callback) {
      callback = function (err, uid) {
        if (err) return rejectFunc(err);
        resolveFunc(uid);
      };
    }

    async function getUIDFast(url) {
      let Form = new FormData();
      let Url = new URL(url);
      Form.append('link', Url.href);
      try {
        let { data } = await axios.post('https://id.traodoisub.com/api.php', Form, {
          headers: Form.getHeaders()
        });
        if (data.error) throw new Error(data.error);
        return data.id || "Not found";
      } catch (e) {
        utils.error('getUID', "Error: " + e.message);
        throw new Error(e.message);
      }
    }

    async function getUIDSlow(url) {
      let Form = new FormData();
      let Url = new URL(url);
      Form.append('username', Url.pathname.replace(/\//g, ""));
      try {
        const userAgentArray = [
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
          "Mozilla/5.0 (Linux; Android 10; SM-G977N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.106 Mobile Safari/537.36",
          "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:54.0) Gecko/20100101 Firefox/54.0",
        ];
        // ...additional logic for slow fallback...
      } catch (e) {
        utils.error('getUID', "Error: " + e.message);
        throw new Error(e.message);
      }
    }

    // Try fast method first, fallback to slow
    getUIDFast(link)
      .then(uid => callback(null, uid))
      .catch(() => getUIDSlow(link).then(uid => callback(null, uid)).catch(callback));

    return returnPromise;
  };
};
