# getThreadInfoDeprecated

Legacy version of thread info retrieval. Use only if the main method does not work for your account.

## Usage
```js
api.getThreadInfoDeprecated(threadID, (err, info) => {
  if (err) return console.error(err);
  console.log('Thread info:', info);
});
```

## Arguments
- Same as `getThreadInfo`.

## Safety Note
Deprecated methods may be removed in future versions.
