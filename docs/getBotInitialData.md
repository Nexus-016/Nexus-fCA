# getBotInitialData

Get initial data for the bot session (internal/advanced).

## Usage
```js
api.getBotInitialData((err, data) => {
  if (err) return console.error(err);
  console.log('Bot initial data:', data);
});
```

## Arguments
- `callback(err, data)`: Callback with error or initial data object.
