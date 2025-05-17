# forwardAttachment

Forward an attachment to one or more users.

## Usage
```js
api.forwardAttachment('attachmentID', ['10001','10002'], (err) => {
  if (err) return console.error(err);
  console.log('Attachment forwarded!');
});
```

## Arguments
- `attachmentID`: The ID of the attachment.
- `userOrUsers`: User ID or array of user IDs.
- `callback(err)`: Callback called when the operation is done (error or null).
