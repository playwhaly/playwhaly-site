# playwhaly.com

Static site for playwhaly.com, hosted on Cloudflare Pages.

## Layout

- `public/` is the static output folder. Set it as the Pages build output directory.
- `functions/` lives at the repository root, not inside `public/`. It is not served as a static folder.
- Nothing else outside `public/` is served as a static file.

## Pages

- `/` home: latest video, intro, game-name banner, destination cards, recent videos (9, skipping the newest because it is already in the hero), socials, Hello game devs.
- `/free` limited-time free games from official stores only. Claim buttons never point at GamerPower.
- `/backlog` the public game list (PC, PS4, PS5 and Nintendo Switch; at most 4 genres per game), shown 50 at a time, with compact cards on a narrow screen. Table columns: 遊戲名稱, 平台, 類型, 狀態. An optional column with no data in the list is dropped.
- `/tier` Whaly's rated games by year (S to D), from `/api/tier`. Year pills, `?year=` (cleaned with `replaceState`), Chinese name first, and only the Chinese review (`notes_zh`; the original-language review is never shown, and a missing Chinese review leaves the card with no review text), Steam covers for numeric ids on Steam rows, otherwise from the hand-checked `cover_steam_appid` column; a hand-checked `cover_url` is preferred over a constructed Steam `header.jpg` when present (an official PlayStation, Nintendo, Microsoft Store, Epic, EA, Steam or publisher image; https only, host checked server side against `COVER_HOSTS` in `functions/api/tier.js`, anything else is dropped; images lazy load and crop with `object-fit: cover`). This covers newer Steam apps whose legacy CDN path 404s. Each card's store button opens the official page of the platform actually played, from the hand-checked `store_url` column (https only, host checked server side against `STORE_HOSTS` in `functions/api/tier.js`; the label is derived from the host, e.g. 在 PlayStation Store 看看, 在 PlayStation 看看, 在 Nintendo eShop 看看, 在 Epic 看看, 在 GOG 看看, 在 Ubisoft Store 看看, 在 Microsoft Store 看看, 在 EA 看看, 在 Steam 看看; Steam `/sub/` and PlayStation `/concept/` paths are accepted; anything else is dropped). A cell value of `delisted` shows a non-clickable grey 已下架 pill and is never turned into a link. If there is no verified platform page and the cell is not `delisted`, the button falls back to that game's Steam page when a Steam app id is known, or is omitted. Links to his own uploads are matched by the first `《》` in the title.
- `/spin` a wheel that picks from unplayed games in that list.
- `/terms` and `/privacy`.
- `/robots.txt`, `/llms.txt` and `/sitemap.xml`.

Pretty URLs work on Cloudflare Pages (`free.html` is served at `/free`).

## Pages settings

- Framework preset: None
- Build command: (empty)
- Root directory: the repository root, not `public`
- Build output directory: `public`

The project must be Git connected, or deployed with Wrangler. Dashboard Direct Upload does not support Functions. If the Pages root directory is set to `public`, the Function in `functions/` will not be picked up.

`public/_headers` adds safe security headers to static pages (nosniff, referrer policy, framing limits, a narrow CSP that only covers framing, plugins, `<base>` and forms, Permissions-Policy and HSTS) and a one day cache for `/assets/*`. Functions set their own headers.

`public/_routes.json` limits Function invocation to `/api/*` and `/free-games.xml`, and excludes `/robots.txt`, `/llms.txt` and `/sitemap.xml`, so ordinary page views stay static and those files are not swallowed by Functions.

## Environment variables and bindings (Pages -> Settings)

Twitch values and the backlog CSV belong under Variables and Secrets, Production and Preview. The optional history store is a KV namespace binding, not a plain variable.

| Name | Type | Notes |
| --- | --- | --- |
| `TWITCH_CLIENT_ID` | Secret | From a Twitch developer application (dev.twitch.tv/console) |
| `TWITCH_CLIENT_SECRET` | Secret | Same application. Add it in the dashboard only, never in the repo |
| `TWITCH_CHANNEL` | Plain text, optional | Defaults to `playwhaly` |
| `BACKLOG_CSV_URL` | Secret or plain text | Published Google Sheet "Public" tab CSV URL (`https://docs.google.com/spreadsheets/d/…/pub?gid=…&single=true&output=csv` or the export equivalent). Only `docs.google.com`, `spreadsheets.google.com` and `docs.googleusercontent.com` are allowed. If this is unset or the sheet cannot be reached, `/backlog` and `/spin` show a friendly empty state. |
| `TIER_CSV_URL` | Plain text | Published `TierPublic` tab CSV (year, name_zh, name_en, tier, notes_en, notes_zh, store_game_id, platform, cover_steam_appid, cover_url, store_url). Same Google host allowlist. If unset or unreachable, `/tier` shows a friendly empty state. |
| `UPLOADED_CSV_URL` | Plain text, optional | Published `UploadedPublic` tab CSV (Title, Date, Duration, Type, URL). Only YouTube rows are used. If unset or down, `/tier` still shows, without video links. |
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
- `functions/api/free-games.js` powers `/free` (and `/free-games.xml`). GamerPower (all giveaway types, one request) is the source of which items appear. Every claim link is followed server side and must land on an official page, or the item is dropped. Anything that still points at gamerpower.com is dropped too.
  - `games`: PC games (plus PC VR on the Meta store, and console stores if they ever appear) whose claim lands on an official store: Epic, Steam, GOG, itch.io, IndieGala, STOVE, Meta, Ubisoft, EA, Battle.net, PlayStation, Xbox or Nintendo. Game keys handed out by third-party sites are skipped.
  - `loot`: free in-game items and DLC (shown under 「免費道具」, collapsed by default). Allowed only when the claim lands on an official store or a listed publisher page (`PUBLISHER_HOSTS`: CD PROJEKT RED, Bethesda, Paradox, Minecraft, OVERKILL). Key sites (Alienware Arena, SteelSeries, MMOBomb, DungeonLoot and similar), hardware-vendor promos, affiliate trackers and Amazon / Prime Gaming are excluded, and so are listings whose value is a code printed on the listing page.
  - Listings whose own text names a key site or Amazon are skipped before any redirect is followed, and at most 36 listings (games first) are resolved per refresh, so a refresh stays near 35 subrequests, under the 50 allowed on the Workers free plan.
  - Mobile-only giveaways, betas, playtests, free weekends and items whose end date has passed are always excluded.
  - Items with no published end date (GamerPower `N/A`) are kept without `endsAt`. The page shows 「限時免費」 and 「截止時間未公布」 with no countdown, and lists them after the dated ones.
  - Adult titles are dropped by a keyword check on the GamerPower title and description, and for Steam items by the official `appdetails` content descriptors and required age. The same Steam lookup (`l=tchinese`) drops items Steam already prices above zero and supplies Steam's Traditional Chinese name and header image when it has them.
  - The official Epic `freeGamesPromotions` endpoint (zh-Hant, SG) enriches matching Epic entries (title, image and exact end date) and supplies upcoming 100% off Epic titles for 「即將推出」 (no claim button). If that Epic call fails, the GamerPower list is still returned.
  - Optional KV history (see above) fills `seenCount` (games only) and `ended` (games and items, tagged 遊戲／道具 on the page). Edge cache 1 hour. Attribution for GamerPower.com is only on the Terms and Privacy pages. `/free-games.xml` lists the current games as RSS.
- `functions/api/backlog.js` reads `BACKLOG_CSV_URL`, caches the result for about 10 minutes, and returns only public columns (names, platform, status, genre, release date, completion date, official store link). Notes, playtime, Playnite ids and source fields are dropped. If a `public` column exists, only public rows are kept. `/backlog` filters the list in memory and renders 50 games at a time. `/spin` still loads the list but only paints a short wheel, not the full table.
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
