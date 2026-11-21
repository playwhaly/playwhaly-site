# playwhaly.com

Static site for playwhaly.com, hosted on Cloudflare Pages.

## Layout

- `public/` is the static output folder. Set it as the Pages build output directory.
- `functions/` lives at the repository root, not inside `public/`. It is not served as a static folder.
- Nothing else outside `public/` is served as a static file.

## Pages settings

- Framework preset: None
- Build command: (empty)
- Root directory: the repository root, not `public`
- Build output directory: `public`

The project must be Git connected, or deployed with Wrangler. Dashboard Direct Upload does not support Functions. If the Pages root directory is set to `public`, the Function in `functions/` will not be picked up.

`public/_routes.json` limits Function invocation to `/api/*` and `/free-games.xml`, so ordinary page views stay static and do not count against the Functions request quota.

## Environment variables (Pages -> Settings -> Variables and Secrets, Production and Preview)

Only the Twitch live check needs any. Without them `/api/live` just answers `{"live":false}`, and the site works as normal. No variable is needed for the video feed.

| Name | Type | Notes |
| --- | --- | --- |
| `TWITCH_CLIENT_ID` | Secret | From a Twitch developer application (dev.twitch.tv/console) |
| `TWITCH_CLIENT_SECRET` | Secret | Same application. Add it in the dashboard only, never in the repo |
| `TWITCH_CHANNEL` | Plain text, optional | Defaults to `playwhaly` |

## How the pieces work

- `functions/api/latest.js` reads the YouTube RSS feed (long videos only, playlist `UULF...`, then the channel feed as backup). No API key. Edge cache 30 min. Thumbnails are `maxresdefault.jpg` with an `hqdefault.jpg` fallback (`thumbnailFallback`).
- `functions/api/live.js` asks Twitch whether the channel is live, server side only. Edge cache 60 s. The browser never sees a token.
- `functions/api/free-games.js` lists limited-time free-to-keep games. Epic comes from the official `freeGamesPromotions` endpoint (zh-Hant, SG). GOG comes from the official giveaway API. Other stores can come from GamerPower, but only after the Function follows the redirect to an official store page; any item that still points at gamerpower.com is dropped. Edge cache 1 hour. The home page section is hidden when the list is empty or the request fails, and does not show a source credit on the page. Attribution for GamerPower.com, plus a note that Epic Games Store and GOG official data are also used, is in the Terms and Privacy pages. `/free-games.xml` is the same list as RSS.
- `public/app.js` loads `/api/latest`, then `/data/latest.json`, then keeps the HTML that is already in the page. It polls `/api/live` every 2 minutes and swaps the hero slideshow for the Twitch player while live. Offline pages contain no player iframe. It also loads `/api/free-games` to fill the 限時免費領取 section.
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

This serves the page and both Functions, and applies `_redirects`. Put local-only Twitch values in `.dev.vars` (git-ignored) if you want to test the live check.
