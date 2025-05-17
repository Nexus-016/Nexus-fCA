# getThreadListDeprecated

Legacy version of thread list retrieval. Use only if the main method does not work for your account.

## Usage
```js
api.getThreadListDeprecated(limit, timestamp, tags, (err, list) => {
  if (err) return console.error(err);
  console.log('Thread list:', list);
});
```

## Arguments
- Same as `getThreadList`.

## Safety Note
Deprecated methods may be removed in future versions.
