# setStoryReaction

React to a Facebook story.

## Usage
```js
api.setStoryReaction('story_id', '😍', (err, res) => {
  if (err) return console.error(err);
  console.log('Reacted to story!', res);
});
```

## Arguments
- `storyID`: The ID of the story (string).
- `reaction`: Emoji or reaction string.
- `callback(err, res)`: Callback with error or result.
