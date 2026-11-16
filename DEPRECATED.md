# Deprecated Features & Upgrade Path

## Removed Files
The following files were removed because they were redundant, broken, or relied on legacy APIs that are no longer reliable:

- `src/getThreadListDeprecated.js`: Legacy Mercury API. Use `getThreadList.js` (GraphQL) instead.
- `src/getThreadInfoDeprecated.js`: Legacy Mercury API. Use `getThreadInfo.js` (GraphQL) instead.
- `src/getThreadHistoryDeprecated.js`: Legacy Mercury API. Use `getThreadHistory.js` (GraphQL) instead.

## Deprecated Methods

### `listenNotification`
- **Status**: Deprecated.
- **Reason**: Uses inefficient HTTP polling (every 60 seconds).
- **Replacement**: `api.listenRealtime` (WebSocket) for instant notifications.

## Upgraded Components

### `utils.js` (HTTP Client)
- **Status**: Upgraded.
- **Reason**: The legacy `request` library is unmaintained.
- **Change**: Migrated to `got` (and `axios` for specific tasks) for HTTP/2 support and improved safety.

## Removed Internal Functions
- `generateAccessiblityCookie`: Unused in the codebase.
- `getAccessFromBusiness`: Experimental and unused.
