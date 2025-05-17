# httpGet

Perform a raw HTTP GET request (utility/advanced).

## Usage
```js
api.httpGet('https://example.com', (err, res) => {
  if (err) return console.error(err);
  console.log('Response:', res);
});
```

## Arguments
- `url`: URL to fetch (string).
- `callback(err, res)`: Callback with error or response object.
