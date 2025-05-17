# httpPost

Perform a raw HTTP POST request (utility/advanced).

## Usage
```js
api.httpPost('https://example.com', { key: 'value' }, (err, res) => {
  if (err) return console.error(err);
  console.log('Response:', res);
});
```

## Arguments
- `url`: URL to post to (string).
- `data`: Data to send (object).
- `callback(err, res)`: Callback with error or response object.
