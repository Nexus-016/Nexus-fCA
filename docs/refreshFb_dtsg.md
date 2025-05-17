# refreshFb_dtsg

Refresh the Facebook fb_dtsg token (advanced/utility).

## Usage
```js
api.refreshFb_dtsg((err, token) => {
  if (err) return console.error(err);
  console.log('fb_dtsg refreshed:', token);
});
```

## Arguments
- `callback(err, token)`: Callback with error or new token string.
