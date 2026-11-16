// GET /api/live  ->  { "live": true|false }
//
// Server-side Twitch live check. Nothing secret ever reaches the browser.
//
// Uses the official Twitch Helix API (client-credentials "app access token", no user login needed).
// Whaly adds two secrets himself in Cloudflare (Pages project > Settings > Variables and Secrets, Production and Preview):
//   TWITCH_CLIENT_ID
//   TWITCH_CLIENT_SECRET
// Optional plain variable: TWITCH_CHANNEL (defaults to "playwhaly").
//
// If the variables are missing, or Twitch is unreachable, this answers { live: false } so the page just shows
// the normal video slideshow. There is no keyless method that is reliable (the public channel page is not a stable
// API and third party "uptime" sites are not official), so the credential route is the only supported one.
//
// Caching: the answer is cached at the edge for about 60 seconds, so Twitch is called at most about once a minute
// no matter how many people open the page. The app token is cached in memory and refreshed before it expires.

const DEFAULT_CHANNEL = "playwhaly";
const CACHE_SECONDS = 60;
const CACHE_KEY = "https://playwhaly.com/api/live";
const FETCH_MS = 6000;
const CHANNEL_RE = /^[A-Za-z0-9_]{3,25}$/;

let tokenCache = { token: "", expiresAt: 0 };

async function timedFetch(fetchImpl, url, init) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    return await fetchImpl(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function getAppToken(env, fetchImpl, now = Date.now()) {
  if (tokenCache.token && tokenCache.expiresAt - 60000 > now) return tokenCache.token;
  const body = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID,
    client_secret: env.TWITCH_CLIENT_SECRET,
    grant_type: "client_credentials",
  });
  const res = await timedFetch(fetchImpl, "https://id.twitch.tv/oauth2/token", { method: "POST", body });
  if (!res.ok) throw new Error("token " + res.status);
  const data = await res.json();
  if (!data || typeof data.access_token !== "string") throw new Error("token shape");
  tokenCache = { token: data.access_token, expiresAt: now + (Number(data.expires_in) || 3600) * 1000 };
  return tokenCache.token;
}

export function resetTokenCache() {
  tokenCache = { token: "", expiresAt: 0 };
}

// Returns { live: boolean, configured: boolean }
export async function checkLive(env, fetchImpl) {
  if (!env || !env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) {
    return { live: false, configured: false };
  }
  const channel = CHANNEL_RE.test(env.TWITCH_CHANNEL || "") ? env.TWITCH_CHANNEL : DEFAULT_CHANNEL;
  const call = async (token) =>
    timedFetch(fetchImpl, "https://api.twitch.tv/helix/streams?user_login=" + encodeURIComponent(channel), {
      method: "GET",
      headers: { "Client-Id": env.TWITCH_CLIENT_ID, Authorization: "Bearer " + token },
    });
  let token = await getAppToken(env, fetchImpl);
  let res = await call(token);
  if (res.status === 401) {
    resetTokenCache(); // token was revoked or expired early: get a new one once
    token = await getAppToken(env, fetchImpl);
    res = await call(token);
  }
  if (!res.ok) throw new Error("helix " + res.status);
  const data = await res.json();
  const live = Array.isArray(data && data.data) && data.data.some((s) => s && s.type === "live");
  return { live, configured: true };
}

function json(body, cacheSeconds, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=30, s-maxage=" + cacheSeconds,
    },
  });
}

export async function onRequest(context) {
  const method = context.request.method;
  if (method !== "GET" && method !== "HEAD") return json({ error: "method not allowed" }, 60, 405);

  let edge = null;
  try {
    edge = caches.default;
  } catch {
    edge = null;
  }
  if (edge) {
    const hit = await edge.match(CACHE_KEY);
    if (hit) return hit;
  }

  let result;
  try {
    result = await checkLive(context.env, fetch);
  } catch {
    // Twitch down or credentials wrong: behave as offline, retry soon.
    return json({ live: false }, 30);
  }
  const response = json({ live: result.live }, CACHE_SECONDS);
  if (edge) context.waitUntil(edge.put(CACHE_KEY, response.clone()));
  return response;
}
