# Get Thread Theme — `api.getThreadTheme`

> Fetch full theme data (id, name, colors/gradients, fallback ph brushes) for a theme ID.

**Added in:** Nexus-fCA 4.1.0

## Signature

```js
api.getThreadTheme(themeID, callback)
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `themeID` | string | yes | Theme FBID (e.g. from `createThemeAI`, or a built-in theme ID) |
| `callback` | function | no | `(err, data)` — a Promise is returned when omitted |

## Usage

```js
api.getThreadTheme(themeID, (err, theme) => {
  if (err) return console.error(err);
  console.log('Theme:', theme.id, theme.name);
});
```

## Response

Theme provider query data (`MWPThreadThemeProviderQuery`) — includes the theme's `id`, display `name` and color definitions usable for custom rendering.

## Errors

- `{ error: 'themeID is required' }`
- Unknown theme ID → server error payload.

## Related

- `api.setThreadTheme(threadID, themeFBID)` — apply a theme to a thread
- `api.createAITheme(prompt)` — generate new themes
