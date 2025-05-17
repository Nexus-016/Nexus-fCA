# addExternalModule

Dynamically add an external module to Nexus-FCA (advanced).

## Usage
```js
api.addExternalModule('path/to/module.js', (err) => {
  if (err) return console.error(err);
  console.log('Module added!');
});
```

## Arguments
- `modulePath`: Path to the external module (string).
- `callback(err)`: Callback called when the operation is done (error or null).
