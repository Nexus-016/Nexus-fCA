# unfriend

Unfriend a user on Facebook.

## Usage
```js
api.unfriend('1000123456789', (err) => {
  if (err) return console.error(err);
  console.log('User unfriended!');
});
```

## Arguments
- `userID`: User ID (string).
- `callback(err)`: Callback called when the operation is done (error or null).
