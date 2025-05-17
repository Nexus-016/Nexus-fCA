# getRegion

Get your current Facebook region info.

## Usage
```js
api.getRegion((err, region) => {
  if (err) return console.error(err);
  console.log('Region:', region);
});
```

## Arguments
- `callback(err, region)`: Callback with error or region string/object.
