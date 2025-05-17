# listenMqtt

Listen for new messages and events using the MQTT protocol.

## Usage
```js
api.listenMqtt((err, message) => {
  if (err) return console.error(err);
  console.log('Received:', message);
});
```

## Arguments
- `callback(err, message)`: Callback with error or message/event object.

## Notes
- Returns an EventEmitter with a `stopListening()` method.
