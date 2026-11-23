# playwhaly.com

Static site for playwhaly.com, hosted on Cloudflare Pages.

## Layout

- `public/` is the static output folder. Set it as the Pages build output directory.
- `functions/` lives at the repository root, not inside `public/`. It is not served as a static folder.
- Nothing else outside `public/` is served as a static file.

## Pages

- `/` home: latest video, intro, game-name banner, destination cards, recent videos (9, skipping the newest because it is already in the hero), socials, Hello game devs.
- `/free` limited-time free games from official stores only. Claim buttons never point at GamerPower.
- `/backlog` the public game list.
- `/spin` a wheel that picks from unplayed games in that list.
- `/terms` and `/privacy`.

Pretty URLs work on Cloudflare Pages (`free.html` is served at `/free`).

## Pages settings

- Framework preset: None
- Build command: (empty)
- Root directory: the repository root, not `public`
- Build output directory: `public`

The project must be Git connected, or deployed with Wrangler. Dashboard Direct Upload does not support Functions. If the Pages root directory is set to `public`, the Function in `functions/` will not be picked up.

`public/_routes.json` limits Function invocation to `/api/*` and `/free-games.xml`, so ordinary page views stay static and do not count against the Functions request quota.

## Environment variables and bindings (Pages -> Settings)

Twitch values and the backlog CSV belong under Variables and Secrets, Production and Preview. The optional history store is a KV namespace binding, not a plain variable.

| Name | Type | Notes |
| --- | --- | --- |
| `TWITCH_CLIENT_ID` | Secret | From a Twitch developer application (dev.twitch.tv/console) |
| `TWITCH_CLIENT_SECRET` | Secret | Same application. Add it in the dashboard only, never in the repo |
| `TWITCH_CHANNEL` | Plain text, optional | Defaults to `playwhaly` |
| `BACKLOG_CSV_URL` | Secret or plain text | Published Google Sheet "Public" tab CSV URL (`https://docs.google.com/spreadsheets/d/…/pub?gid=…&single=true&output=csv` or the export equivalent). Only `docs.google.com`, `spreadsheets.google.com` and `docs.googleusercontent.com` are allowed. If this is unset or the sheet cannot be reached, `/backlog` and `/spin` show a friendly empty state. |
| `FREE_GAMES_HISTORY` | KV namespace binding | Optional. Remembers distinct free games already listed, so `/free` can show 「已整理 N 款免費遊戲」, and keeps recently ended titles for a few weeks. If this binding is missing, the counter and the 「最近結束」 block are hidden. Do not invent a number. A leftover name `FREE_GAMES_SEEN` is also accepted. |

Without the Twitch secrets, `/api/live` just answers `{"live":false}`, and the site works as normal. No variable is needed for the video feed.

For local preview, put the same values in `.dev.vars` (git-ignored) and bind KV in your Wrangler config if you want to test the counter.

## Public config files

These are static files in `public/`. Edit them in the repo. They are not environment variables.

### `public/site.json`

- `discordInvite`: URL for the 「加入 Discord」 button on `/free`. The bundled value is `/discord`, which already redirects to the invite. Set this to an empty string to hide the button.
- `followPlatforms`: the Instagram, Threads and Facebook pills in the 「追蹤免費遊戲通知」 block. Each item has `id`, `label` and `href`. The default pill colour is lavender. Hover and focus use that platform's colour.

### `public/amiao.json` and `public/assets/amiao/`

The 阿喵 corner on each page is driven only by this config. There are no AI or extra API calls.

- `credit`: the credit line filled into `[data-amiao-credit]` on the Terms page.
- `imageDir`: folder for the stills, usually `/assets/amiao/`.
- `who`, `closeLabel`, `openLabel`: visible labels.
- `pages.home`, `pages.free`, `pages.backlog`, `pages.spin`:
  - `image`: filename inside `imageDir`.
  - `lines`: 3 to 5 ordinary lines. One is picked at random on each page load.
  - `templates` (optional): lines with `{placeholders}` filled from page data. A template is only used when its `when` value is present. Examples: `/free` 「今天有 {liveCount} 款免費喔！」, `/backlog` 「還有 {unplayed} 款沒玩喵…」, `/spin` 「{game}？本喵覺得不錯喵～」.

Pages call `PWAmiao.setContext({ liveCount, unplayed, game })` after their data loads. Closing the bubble is remembered in `sessionStorage` for the tab. On a narrow screen the bubble stays closed until the avatar is tapped.

Placeholder stills may ship in `public/assets/amiao/` until licensed art is ready. Do not redraw or composite the licensed model. To swap art later, replace the files in that folder and, if needed, the filenames in `amiao.json`.

## How the pieces work

- `functions/api/latest.js` reads the YouTube RSS feed (long videos only, playlist `UULF...`, then the channel feed as backup). No API key. Edge cache 30 min. Thumbnails are `maxresdefault.jpg` with an `hqdefault.jpg` fallback (`thumbnailFallback`).
- `functions/api/live.js` asks Twitch whether the channel is live, server side only. Edge cache 60 s. The browser never sees a token.
- `functions/api/free-games.js` powers `/free` (and `/free-games.xml`). GamerPower is the source of which current games appear (Steam, Epic, GOG, itch.io and other recognized stores, including bundles already allowed by the existing filters). Adult titles are dropped: a keyword check on the GamerPower title and description, and for Steam games a lookup of the official `appdetails` content descriptors / required age after the store URL is resolved. Each claim link is followed server-side to an official store page. Any item that still points at gamerpower.com is dropped. The official Epic `freeGamesPromotions` endpoint (zh-Hant, SG) enriches matching Epic entries (title, image and exact end date) and also supplies upcoming 100% off Epic titles for the 「下週免費」 list (no claim button). If that Epic call fails, the current GamerPower list is still returned. Optional KV history (see above) fills `seenCount` and `ended`. The payload always includes `games` for RSS and compatibility. Edge cache 1 hour. Attribution for GamerPower.com, plus a note that matching or upcoming Epic entries may use official Epic data, is only on the Terms and Privacy pages. `/free-games.xml` is the same current list as RSS.
- `functions/api/backlog.js` reads `BACKLOG_CSV_URL`, caches the result for about 10 minutes, and returns only public-safe columns (names, platform, status, genre, release date, official store link). Notes and playtime are dropped. If a `public` column exists, only public rows are kept.
- `public/app.js` loads `/api/latest`, then `/data/latest.json`, then keeps the HTML that is already on the home page. It polls `/api/live` every 2 minutes and swaps the hero slideshow for the Twitch player while live. Offline pages contain no player iframe. Home recent videos use `data.more`, so the newest video is skipped (it is already in the hero). `/backlog` loads the 3 newest videos, including the latest (`data-skip-latest="false"`).
- The `parent` list for the Twitch embed is `PLAYER_PARENTS` at the top of `public/app.js`. Add any new domain there. The page's own hostname is added automatically.
- Config constants for the "next long video" line (anchor Friday, interval) are also at the top of `public/app.js`.
- `?live=1` (force live), `&mockplayer=1` (placeholder instead of the real iframe) and `?today=YYYY-MM-DD` only work on localhost and `*.pages.dev`.

## Refreshing the static fallback

`public/data/latest.json` is a checked in list of recent long videos. It is used when the YouTube feed is down. After updating it, run `node scripts/render-static.mjs` to re-bake the no-JavaScript copy in `public/index.html`.

## Tests

```bash
for t in test/*.test.mjs; do node $t; done
```

## Before every deploy

- Only the site files, `_redirects`, `_routes.json`, `data/latest.json`, icons, the web manifest and other assets live in `public/`.
- No notes, drafts or docs go in `public/`.
- Open the Pages preview URL for the branch first and check desktop and mobile.

## Local preview

```bash
npx wrangler pages dev public
```

This serves the page and the Functions, and applies `_redirects`. Put local-only Twitch and `BACKLOG_CSV_URL` values in `.dev.vars` (git-ignored) if you want to test the live check or the game list.
