# logout

Log out the current user.

## Usage
```js
api.logout((err) => {
  if (err) return console.error(err);
  console.log('Logged out!');
});
```

## Arguments
- `callback(err)`: Callback called when the operation is done (error or null).
