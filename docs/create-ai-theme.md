# Create AI Theme — `api.createAITheme`

> Generate one or more Messenger chat themes from a text prompt using Facebook's AI theme generation.

**Added in:** Nexus-fCA 4.1.0 (endpoint fixed for `field_exception 1675030` in 4.3.x)

## Signature

```js
api.createAITheme(prompt, [numThemes], callback)
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `prompt` | string | yes | Theme description — non-empty string |
| `numThemes` | number | no | 1–10 themes (default 1; values > 10 are capped) |
| `callback` | function | no | `(err, themeData)` — a Promise is returned when omitted |

## Usage

```js
// Single theme
api.createAITheme('cyberpunk neon city', (err, theme) => {
  if (err) return console.error(err);
  console.log('Generated theme:', theme.id);
  api.changeThreadColor(theme.id, threadID);   // apply it
});

// Multiple themes (all data kept)
api.createAITheme('sunset gradient', 5, (err, data) => {
  if (err) return console.error(err);
  console.log('All themes:', data.allThemes);
});
```

## Response

Theme data containing the generated theme `id` (usable with `api.changeThreadColor` / `api.setThreadTheme`). When `numThemes > 1`, the full `allThemes` list is included with complete data for each theme.

## Errors

- `{ error: 'Invalid prompt. Please provide a string.' }`
- `{ error: 'Prompt cannot be empty.' }`
- `field_exception` errors from the AI endpoint indicate the prompt was rejected upstream — retry with a simpler prompt.

## Notes

- Generation runs on `web.facebook.com/api/graphql/` (`useGenerateAIThemeMutation`) — the correct host for this mutation.
- Each generated theme costs a server-side AI quota slot; do not spam generations.
