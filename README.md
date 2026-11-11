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

`public/_routes.json` limits Function invocation to `/api/*`, so ordinary page views stay static and do not count against the Functions request quota.

## Before every deploy

- Only `index.html`, `404.html`, `_redirects`, `_routes.json`, `latest.js`, icons, the web manifest and other assets live in `public/`.
- No notes, drafts or docs go in `public/`.
- Short links in `public/_redirects` that are commented out stay off until their real URL is confirmed.

## Local preview

Static pages only:

```bash
python3 -m http.server 8765 --directory public
```

To try the newest videos Function as well:

```bash
npx wrangler pages dev public
```

`_redirects` only works once deployed on Pages.
