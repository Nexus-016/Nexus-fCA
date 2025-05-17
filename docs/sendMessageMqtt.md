# sendMessageMqtt

Send a message using the MQTT protocol (advanced).

## Usage
```js
api.sendMessageMqtt('Hello!', '1234567890', (err, info) => {
  if (err) return console.error(err);
  console.log('Message sent via MQTT!', info);
});
```

## Arguments
- `message`: Message string or message object.
- `threadID`: Thread ID (string).
- `callback(err, info)`: Callback with error or message info object.
