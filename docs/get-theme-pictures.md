# Get Theme Pictures — `api.getThemePictures`

> Fetch the picture/gallery payload attached to a theme (theme provider query, raw response).

**Added in:** Nexus-fCA 4.1.0

## Signature

```js
api.getThemePictures(id, callback)
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | string | no | Theme ID — non-string values fall back to an empty id |
| `callback` | function | no | `(err, data)` — a Promise is returned when omitted |

## Usage

```js
api.getThemePictures(themeID, (err, data) => {
  if (err) return console.error(err);
  console.log(data);
});
```

## Response

Raw GraphQL response (`MWPThreadThemeProviderQuery`, `doc_id 9734829906576883`) — traverse `data.*` for theme picture URLs.

## Notes

- Returns the **raw** response on purpose so you can extract whatever fields your UI needs.
- For the parsed theme object, use `api.getThreadTheme(themeID)` instead.
