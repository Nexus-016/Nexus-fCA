# Auto-Save AppState — `api.enableAutoSaveAppState`

> Periodically write the current cookie state to disk so restarts always resume with fresh cookies.

**Added in:** Nexus-fCA 4.1.0

## Signature

```js
const disable = api.enableAutoSaveAppState(options)
```

| Option | Default | Description |
|---|---|---|
| `filePath` | `process.cwd()/appstate.json` | Where the state JSON is written |
| `interval` | `600000` (10 min) | Save interval in ms |
| `saveOnLogin` | `true` | Also save once ~2s after enabling |

**Returns:** a `disable()` function that clears the interval and the initial timer.

## Usage

```js
const stopAutoSave = api.enableAutoSaveAppState({
  filePath: './appstate.json',
  interval: 5 * 60 * 1000,   // every 5 minutes
  saveOnLogin: true
});

// Later: stop it
stopAutoSave();
```

## Behavior

- Skips the save when `api.getAppState()` returns an empty array.
- Saves are logged (`enableAutoSaveAppState` info lines) — failures never crash the process.
- Multiple calls stack independent intervals (all tracked; `disable()` removes its own).

## Notes

- On ephemeral hosts the disk resets on redeploy — combine this with the login options `appStatePath` / `backupPath` (CookieRefresher + session guard also persist state) and keep backups outside the container when it matters.
- This duplicates nothing internally: `sessionGuard` (auto-save every 3 min) is already on by default; use this API when you want your own file path/interval on top.
