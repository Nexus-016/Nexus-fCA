const login = require('../index');
const fs = require('fs');

/*
 Simple echo test script.
 Usage:
 1. Place valid appstate.json in project root (or set EMAIL/PASSWORD env vars).
 2. Run: node examples/echo-test.js
 3. Send any message; bot echoes back. Send 'quit' to stop.
*/
(async () => {
  try {
    const credentials = {};
    if (fs.existsSync('appstate.json')) {
      credentials.appState = JSON.parse(fs.readFileSync('appstate.json', 'utf8'));
    } else if (process.env.EMAIL && process.env.PASSWORD) {
      credentials.email = process.env.EMAIL;
      credentials.password = process.env.PASSWORD;
    } else {
      console.error('Provide appstate.json or EMAIL/PASSWORD env.');
      process.exit(1);
    }
    const api = await login(credentials);
    console.log('Login OK. Waiting for messages...');
    api.listen((err, msg) => {
      if (err) {
        console.error('Listen error:', err);
        return;
      }
      if (!msg || !msg.body) return;
      console.log('IN:', msg.threadID, msg.body);
      if (msg.body.toLowerCase() === 'quit') {
        api.sendMessage('Shutting down.', msg.threadID, () => process.exit(0));
        return;
      }
      api.sendMessage(msg.body, msg.threadID, (e) => {
        if (e) console.error('Send error:', e);
      });
    });
  } catch (e) {
    console.error('Login failed:', e);
  }
})();
