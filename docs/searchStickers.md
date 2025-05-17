# searchStickers

Search for Facebook stickers by keyword.

## Usage
```js
api.searchStickers('cat', (err, stickers) => {
  if (err) return console.error(err);
  console.log('Stickers:', stickers);
});
```

## Arguments
- `query`: Search keyword (string).
- `callback(err, stickers)`: Callback with error or sticker array.
