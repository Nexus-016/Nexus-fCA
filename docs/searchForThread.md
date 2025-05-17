# searchForThread

Search for a thread by name.

## Usage
```js
api.searchForThread('Group Name', (err, thread) => {
  if (err) return console.error(err);
  console.log('Thread:', thread);
});
```

## Arguments
- `name`: Thread name (string).
- `callback(err, thread)`: Callback with error or thread object.
