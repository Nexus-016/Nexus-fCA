# httpPostFormData

Perform a raw HTTP POST request with form data (utility/advanced).

## Usage
```js
api.httpPostFormData('https://example.com', { key: 'value' }, (err, res) => {
  if (err) return console.error(err);
  console.log('Response:', res);
});
```

## Arguments
- `url`: URL to post to (string).
- `formData`: Form data to send (object).
- `callback(err, res)`: Callback with error or response object.
