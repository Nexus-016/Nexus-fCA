# Generate + Set Theme — `api.generateAndSetTheme`

> One-call helper: generate an AI theme from a text prompt, then apply it to a thread. Sends progress updates into the target thread while working.

**Added in:** Nexus-fCA 4.1.0

## Signature

```js
api.generateAndSetTheme(prompt, threadID, callback)
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `prompt` | string | yes | Theme description, e.g. `'cyberpunk neon city'` |
| `threadID` | string | yes | Target thread to apply the theme to |
| `callback` | function | no | `(err, data)` — a Promise is returned when omitted |

## What It Does

1. Sends a "starting" status message to the thread.
2. Calls `api.createThemeAI(prompt)`.
3. Sends a "generated" status message with the theme ID.
4. Calls `api.changeThreadColor(theme.id, threadID)`.
5. Sends a success message, then calls your callback.

Progress lines are also appended to `theme_generation.log` in the package folder (silent fs fallback).

## Usage

```js
api.generateAndSetTheme('neon sunset', threadID, (err, data) => {
  if (err) return console.error('Theme flow failed:', err);
  console.log('Theme generated and applied');
});
```

## Errors

- AI generation failure → the `createThemeAI` error is passed through.
- Apply failure → the `changeThreadColor` error is passed through.

## Notes

- Because it **sends chat messages** for progress, do not call it in tight loops — every call produces several messages in the target thread.
- For silent generation, use `api.createAITheme(prompt)` + `api.changeThreadColor(themeID, threadID)` directly.
