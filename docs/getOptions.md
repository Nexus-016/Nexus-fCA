# getOptions

Get the current Nexus-FCA options.

## Usage
```js
api.getOptions((err, options) => {
  if (err) return console.error(err);
  console.log('Options:', options);
});
```

## Arguments
- `callback(err, options)`: Callback with error or options object.
