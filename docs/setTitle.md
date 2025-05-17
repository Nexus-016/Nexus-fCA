# setTitle

Set the title of a group chat.

## Usage
```js
api.setTitle('New Group Name', '1234567890', (err, obj) => {
  if (err) return console.error(err);
  console.log('Title set!', obj);
});
```

## Arguments
- `newTitle`: New title (string).
- `threadID`: Thread ID (string).
- `callback(err, obj)`: Callback with error or confirmation object.
