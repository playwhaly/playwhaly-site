// Same-origin cover images for /free. Some giveaway covers only exist on the listing site's
// image host. This serves them from playwhaly.com instead, so no page links point there.
// Only that host's /offers/ image paths are accepted, so it cannot be used as an open proxy.
const UPSTREAM = "https://www.gamerpower.com";
const PATH_RE = /^\/offers\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\.(?:jpe?g|png|webp)$/;
const MAX_BYTES = 3 * 1024 * 1024;
const BROWSER_SECONDS = 7 * 24 * 3600;
const FETCH_MS = 8000;

export function coverPathFromUrl(href) {
  try {
    const u = new URL(href);
    if (u.protocol !== "https:" || u.hostname !== "www.gamerpower.com") return "";
    return PATH_RE.test(u.pathname) && !u.search ? u.pathname : "";
  } catch {
    return "";
  }
}

export function coverProxyUrl(href) {
  const path = coverPathFromUrl(href);
  return path ? "/api/cover?p=" + encodeURIComponent(path) : "";
}

export function isCoverProxyUrl(href) {
  return typeof href === "string" && /^\/api\/cover\?p=%2Foffers%2F[A-Za-z0-9_%.-]+$/.test(href);
}

function notFound() {
  return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" } });
}

export async function loadCover(path, fetchImpl, cfCache) {
  if (!PATH_RE.test(String(path || ""))) return notFound();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const init = { method: "GET", redirect: "manual", signal: ctrl.signal, headers: { Accept: "image/*" } };
    if (cfCache) init.cf = { cacheTtl: BROWSER_SECONDS, cacheEverything: true };
    const res = await fetchImpl(UPSTREAM + path, init);
    const type = (res.headers.get("content-type") || "").toLowerCase();
    if (res.status !== 200 || !/^image\/(jpeg|png|webp)/.test(type)) return notFound();
    const body = await res.arrayBuffer();
    if (!body.byteLength || body.byteLength > MAX_BYTES) return notFound();
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": type.split(";")[0],
        "cache-control": "public, max-age=" + BROWSER_SECONDS + ", immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return notFound();
  } finally {
    clearTimeout(timer);
  }
}

export async function onRequest(context) {
  const { request } = context;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const url = new URL(request.url);
  const path = url.searchParams.get("p") || "";
  const cacheKey = "https://playwhaly.com/api/cover?p=" + encodeURIComponent(path);
  let edgeCache = null;
  try {
    edgeCache = caches.default;
  } catch {
    edgeCache = null;
  }
  if (edgeCache) {
    const hit = await edgeCache.match(cacheKey);
    if (hit) return hit;
  }
  const response = await loadCover(path, fetch, true);
  if (edgeCache && response.status === 200) context.waitUntil(edgeCache.put(cacheKey, response.clone()));
  return response;
}
