# getCtx

Get the current Facebook context/session info.

## Usage
```js
api.getCtx((err, ctx) => {
  if (err) return console.error(err);
  console.log('Context:', ctx);
});
```

## Arguments
- `callback(err, ctx)`: Callback with error or context object.
