# getEmojiUrl

Get the URL to a Facebook Messenger-style emoji image asset.

## Usage
```js
const url = api.getEmojiUrl('😄', 128, 1.5);
console.log('Emoji URL:', url);
```

## Arguments
- `c`: Emoji character (string).
- `size`: Image size (32, 64, 128).
- `pixelRatio`: Pixel ratio (1.0 or 1.5).

## Returns
- URL string for the emoji image.
