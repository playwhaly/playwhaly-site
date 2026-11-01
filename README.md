# playwhaly.com

Static site for playwhaly.com, hosted on Cloudflare Pages.

## Layout

- `public/` is the only folder that gets deployed. Set it as the Pages build output directory.
- Nothing outside `public/` is served.

## Pages settings

- Framework preset: None
- Build command: (empty)
- Build output directory: `public`

## Before every deploy

- Only `index.html`, `404.html`, `_redirects` and `favicon.svg` (plus any assets) live in `public/`.
- No notes, drafts or docs go in `public/`.
- Short links in `public/_redirects` that are commented out stay off until their real URL is confirmed.

## Local preview

```bash
python3 -m http.server 8765 --directory public
```

`_redirects` only works once deployed on Pages.
