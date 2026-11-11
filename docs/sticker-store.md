# Sticker Store — `api.stickerStore`

> Browse the Messenger sticker store: search stickers, list packs, install packs, and fetch AI stickers.

**Added in:** Nexus-fCA 4.3.0

All methods are `async` (Promise-based). `api.searchStickers` remains available and untouched — this module adds the full store surface.

## Methods

| Method | Signature | Returns |
|---|---|---|
| `search(query)` | `search(query: string)` | Array of sticker results |
| `listPacks()` | `listPacks()` | Array of your installed/tray packs |
| `getStorePacks()` | `getStorePacks()` | Array of **all** store packs (auto-paginates) |
| `listAllPacks()` | `listAllPacks()` | Combined, de-duplicated list of your packs + store packs |
| `addPack(packID)` | `addPack(packID: string)` | Installs a pack on the account |
| `getStickersInPack(packID)` | `getStickersInPack(packID: string)` | Array of stickers in a pack |
| `getAiStickers()` | `getAiStickers()` | Array of trending AI-generated stickers |

## Usage

```js
// Search stickers
const results = await api.stickerStore.search('cat');
console.log(results[0]);
// { type: 'sticker', ID: '...', url: '...', animatedUrl: '...', packID: '...', label: '...', stickerID: '...' }

// List all store packs
const packs = await api.stickerStore.getStorePacks();
console.log(packs[0]);
// { id: '...', name: '...', thumbnail: '...' }

// Install a pack, then list its stickers
await api.stickerStore.addPack(packs[0].id);
const stickers = await api.stickerStore.getStickersInPack(packs[0].id);

// Send one as a message
api.sendMessage({ sticker: stickers[0].stickerID }, threadID);

// Trending AI stickers
const ai = await api.stickerStore.getAiStickers();
```

## Callback Style

`getStickersInPack`, `addPack` and friends are Promise-based; wrap with `await` or `.then()`:

```js
api.stickerStore.listPacks().then(packs => {
  console.log(`You have ${packs.length} packs`);
}).catch(console.error);
```

## Errors

- GraphQL errors are logged and thrown (first error object from the response).
- A failed request throws `Error('GraphQL request returned no data.')` or the server error.
- Login/permission failures surface through the standard session guard.

## Safety Notes

- `getStorePacks()` paginates the entire store — do not call it in a tight loop.
- Cache pack lists in your bot instead of refetching on every command.
