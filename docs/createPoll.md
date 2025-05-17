# createPoll

Create a poll in a thread.

## Usage
```js
api.createPoll('Favorite color?', '1234567890', { Red: false, Blue: true }, (err) => {
  if (err) return console.error(err);
  console.log('Poll created!');
});
```

## Arguments
- `title`: Poll title (string).
- `threadID`: Thread ID (string).
- `options`: Object of poll options (e.g. `{ Red: false, Blue: true }`).
- `callback(err)`: Callback called when the operation is done (error or null).
