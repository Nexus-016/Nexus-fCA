# getUserID

Get Facebook user ID(s) from a name or vanity URL.

## Usage
```js
api.getUserID('Mark Zuckerberg', (err, users) => {
  if (err) return console.error(err);
  console.log('User(s):', users);
});
```

## Arguments
- `name`: Name or vanity URL (string).
- `callback(err, users)`: Callback with error or array of user objects.
