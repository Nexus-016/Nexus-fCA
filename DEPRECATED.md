# Deprecated Features & Upgrade Path

## Removed Files (Waste Code)
The following files were removed as they were either broken, redundant, or used legacy APIs that are no longer reliable:

- `src/changeAvatarV2.js`: Incomplete implementation. Use `changeAvatar.js` instead.
- `src/getThreadListDeprecated.js`: Legacy Mercury API. Use `getThreadList.js` (GraphQL).
- `src/getThreadInfoDeprecated.js`: Legacy Mercury API. Use `getThreadInfo.js` (GraphQL).
- `src/getThreadHistoryDeprecated.js`: Legacy Mercury API. Use `getThreadHistory.js` (GraphQL).

## Deprecated Features (To Be Upgraded)

### `listenNotification`
- **Status**: Deprecated
- **Reason**: Uses inefficient HTTP polling (every 60s).
- **Upgrade**: Use `api.listenRealtime` (WebSocket) for instant notifications.

### `utils.js` (HTTP Client)
- **Status**: ✅ Upgraded
- **Reason**: The legacy `request` library was deprecated.
- **Update**: Successfully migrated to `got` (and `axios` for specific tasks) to support HTTP/2 and improve performance/safety.

## Unused Functions Removed
- `generateAccessiblityCookie`: Not used in the codebase.
- `getAccessFromBusiness`: Experimental/Unused.
