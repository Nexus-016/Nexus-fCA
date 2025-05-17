# getThreadHistoryDeprecated

Legacy version of thread history retrieval. Use only if the main method does not work for your account.

## Usage
```js
api.getThreadHistoryDeprecated(threadID, amount, timestamp, (err, history) => {
  if (err) return console.error(err);
  console.log('History:', history);
});
```

## Arguments
- Same as `getThreadHistory`.

## Safety Note
Deprecated methods may be removed in future versions.
