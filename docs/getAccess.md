# getAccess

Get your current Facebook access token (advanced usage).

## Usage
```js
api.getAccess((err, token) => {
  if (err) return console.error(err);
  console.log('Access token:', token);
});
```

## Arguments
- `callback(err, token)`: Callback with error or access token string.

## Safety Note
Keep your access token private.
