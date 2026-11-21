const FETCH_MS = 8000;
const CACHE_SECONDS = 3600;
const EMPTY_CACHE_SECONDS = 300;
const MAX_GAMES = 9;
const CACHE_KEY = "https://playwhaly.com/api/free-games";
const UA = "playwhaly.com/free-games (https://playwhaly.com/)";
const EPIC_URL =
  "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=zh-Hant&country=SG&allowCountries=SG";
const GOG_URL = "https://www.gog.com/giveaway/api/get";
const GAMERPOWER_URL = "https://www.gamerpower.com/api/giveaways?platform=pc&type=game";

const STORE_LABELS = {
  epic: "Epic 遊戲商店",
  steam: "Steam",
  gog: "GOG",
  itch: "itch.io",
  indiegala: "IndieGala",
  stove: "STOVE",
};

const AFFILIATE_PARAM = /^(ref|referrer|referer|aff|affiliate|partner|campaign|tap_s|tap_a|fbclid|gclid|mc_eid)|^(utm_)/i;

export function unwrapTitle(title) {
  const text = String(title || "").replace(/\s+/g, " ").trim();
  const wrapped = text.match(/^《(.+)》$/);
  return wrapped ? wrapped[1].trim() : text;
}

export function cleanGamerPowerTitle(title) {
  return unwrapTitle(title)
    .replace(/\s*\((?:Epic Games|Steam|GOG|itch\.io|IndieGala|Indiegala|Stove)\)\s*/gi, " ")
    .replace(/\s+Giveaway\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isGamerPowerHost(host) {
  const h = String(host || "").toLowerCase();
  return h === "gamerpower.com" || h.endsWith(".gamerpower.com");
}

export function storeFromHost(host) {
  const h = String(host || "").toLowerCase();
  if (h === "store.epicgames.com" || h === "www.epicgames.com" || h === "epicgames.com") return "epic";
  if (h === "store.steampowered.com" || h === "www.steampowered.com") return "steam";
  if (h === "www.gog.com" || h === "gog.com") return "gog";
  if (h === "itch.io" || h.endsWith(".itch.io")) return "itch";
  if (h === "freebies.indiegala.com" || h === "www.indiegala.com" || h === "indiegala.com") return "indiegala";
  if (h === "store.onstove.com" || h === "www.onstove.com") return "stove";
  return "";
}

export function isOfficialStoreUrl(href) {
  try {
    const url = new URL(href);
    if (url.protocol !== "https:") return false;
    if (isGamerPowerHost(url.hostname)) return false;
    return Boolean(storeFromHost(url.hostname));
  } catch {
    return false;
  }
}

export function sanitizeStoreUrl(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return "";
  }
  if (url.protocol !== "https:") return "";
  if (isGamerPowerHost(url.hostname)) return "";
  const store = storeFromHost(url.hostname);
  if (!store) return "";
  for (const key of [...url.searchParams.keys()]) {
    if (AFFILIATE_PARAM.test(key)) url.searchParams.delete(key);
  }
  url.hash = "";
  if (store === "epic") {
    const page = url.pathname.match(/\/(?:[a-z]{2}(?:-[A-Za-z]+)?\/)?p\/([^/]+)/i);
    if (page) return "https://store.epicgames.com/zh-Hant/p/" + page[1];
    return "";
  }
  url.hostname = url.hostname.toLowerCase();
  const out = url.toString();
  return out.endsWith("?") ? out.slice(0, -1) : out;
}

export function parseGamerPowerEnd(value) {
  if (value == null) return NaN;
  const text = String(value).trim();
  if (!text || /^n\/?a$/i.test(text)) return NaN;
  const match = text.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  if (match) return Date.parse(match[1] + "T" + match[2] + "Z");
  return Date.parse(text);
}

export function isHttpsImageUrl(href) {
  try {
    const url = new URL(href);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function epicSlug(element) {
  const mappings = []
    .concat((element && element.offerMappings) || [])
    .concat(((element && element.catalogNs) || {}).mappings || []);
  const home = mappings.find((m) => m && m.pageType === "productHome" && m.pageSlug);
  if (home) return home.pageSlug;
  const any = mappings.find((m) => m && m.pageSlug);
  if (any) return any.pageSlug;
  const product = element && element.productSlug;
  if (typeof product === "string" && product && product !== "[]") {
    return product.replace(/\/(home|bundle)?$/i, "").replace(/\/$/, "");
  }
  return "";
}

function flattenOffers(groups) {
  const out = [];
  for (const group of groups || []) {
    for (const offer of group.promotionalOffers || []) out.push(offer);
  }
  return out;
}

function currentFreeOffer(element, now) {
  const offers = flattenOffers((element && element.promotions && element.promotions.promotionalOffers) || []);
  for (const offer of offers) {
    const setting = offer.discountSetting || {};
    if (setting.discountType && setting.discountType !== "PERCENTAGE") continue;
    if (setting.discountPercentage !== 0) continue;
    const start = Date.parse(offer.startDate);
    const end = Date.parse(offer.endDate);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (now >= start && now < end) return offer;
  }
  return null;
}

function epicImage(element) {
  const images = (element && element.keyImages) || [];
  const prefer = ["OfferImageWide", "DieselStoreFrontWide", "Thumbnail", "OfferImageTall"];
  for (const type of prefer) {
    const hit = images.find((img) => img && img.type === type && isHttpsImageUrl(img.url));
    if (hit) return hit.url;
  }
  const any = images.find((img) => img && isHttpsImageUrl(img.url) && img.type !== "heroCarouselVideo");
  return any ? any.url : "";
}

export function parseEpicPromotions(data, nowMs) {
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  const elements =
    (data && data.data && data.data.Catalog && data.data.Catalog.searchStore && data.data.Catalog.searchStore.elements) ||
    [];
  const games = [];
  for (const element of elements) {
    const offerType = element && element.offerType;
    if (offerType !== "BASE_GAME" && offerType !== "BUNDLE") continue;
    const price = (element.price && element.price.totalPrice) || {};
    if (price.originalPrice === 0) continue;
    const offer = currentFreeOffer(element, now);
    if (!offer) continue;
    const title = unwrapTitle(element.title);
    const slug = epicSlug(element);
    const claimUrl = slug ? sanitizeStoreUrl("https://store.epicgames.com/zh-Hant/p/" + slug) : "";
    if (!title || !claimUrl) continue;
    const endsAt = new Date(Date.parse(offer.endDate)).toISOString();
    games.push({
      id: "epic:" + (element.namespace || "") + ":" + (element.id || slug),
      title,
      platform: STORE_LABELS.epic,
      store: "epic",
      image: epicImage(element),
      endsAt,
      claimUrl,
      source: "epic",
      kind: offerType === "BUNDLE" || /bundle/i.test(title) ? "bundle" : "game",
    });
  }
  return games;
}

function pickFirst(obj, keys) {
  if (!obj || typeof obj !== "object") return "";
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function parseGogGiveaway(data, nowMs) {
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  if (!data || typeof data !== "object") return [];
  if (data.status === "not_found" || data.code === 404) return [];
  const product = data.product && typeof data.product === "object" ? data.product : data;
  const title = unwrapTitle(pickFirst(product, ["title", "name"]) || pickFirst(data, ["title", "productTitle", "name"]));
  const slug = pickFirst(product, ["slug", "productSlug"]) || pickFirst(data, ["slug"]);
  let claimUrl = pickFirst(product, ["url", "storeLink", "link"]) || pickFirst(data, ["url", "storeLink"]);
  if (!claimUrl && ((product._links && product._links.product_card) || (data._links && data._links.product_card))) {
    const card = (product._links && product._links.product_card && product._links.product_card.href) ||
      (data._links && data._links.product_card && data._links.product_card.href);
    if (card) claimUrl = card;
  }
  if (!claimUrl && slug) claimUrl = "https://www.gog.com/en/game/" + slug.replace(/^\/+/, "");
  if (claimUrl && claimUrl.startsWith("//")) claimUrl = "https:" + claimUrl;
  if (claimUrl && claimUrl.startsWith("/")) claimUrl = "https://www.gog.com" + claimUrl;
  claimUrl = sanitizeStoreUrl(claimUrl);
  const endRaw = pickFirst(data, ["endDate", "end_date", "until"]) || pickFirst(product, ["endDate", "end_date"]);
  const endMs = Date.parse(endRaw);
  if (!title || !claimUrl || !Number.isFinite(endMs) || endMs <= now) return [];
  if (storeFromHost(hostOf(claimUrl)) !== "gog") return [];
  let image =
    pickFirst(product, ["image", "imageUrl", "image_url"]) ||
    pickFirst(data, ["image", "imageUrl", "image_url"]) ||
    ((data._links && data._links.image && data._links.image.href) || "");
  if (image.startsWith("//")) image = "https:" + image;
  if (!isHttpsImageUrl(image)) image = "";
  return [
    {
      id: "gog:" + (product.id || slug || title),
      title,
      platform: STORE_LABELS.gog,
      store: "gog",
      image,
      endsAt: new Date(endMs).toISOString(),
      claimUrl,
      source: "gog",
      kind: "game",
    },
  ];
}

function gamerPowerKind(item) {
  const type = String((item && item.type) || "");
  const title = String((item && item.title) || "");
  const hay = (type + " " + title).toLowerCase();
  if (/\b(loot|dlc)\b/.test(hay) || /in-game/.test(hay)) return "";
  if (/\bbeta\b/.test(hay) || /playtest/.test(hay)) return "";
  if (/\bkey\b/.test(hay) || /免費周末|free weekend/.test(hay)) return "";
  if (!/^game$/i.test(type.trim())) return "";
  if (/bundle/i.test(title) || /遊戲包|組合包/.test(title)) return "bundle";
  return "game";
}

function platformsOf(item) {
  return String((item && item.platforms) || "")
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
}

export function gamerPowerCandidates(items, nowMs) {
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  const list = Array.isArray(items) ? items : [];
  const out = [];
  for (const item of list) {
    if (!item || String(item.status || "").toLowerCase() !== "active") continue;
    const kind = gamerPowerKind(item);
    if (!kind) continue;
    const plats = platformsOf(item);
    // Official Epic and GOG endpoints are the source of truth for those stores.
    if (plats.some((p) => p === "epic games store" || p === "epic")) continue;
    if (plats.some((p) => p === "gog")) continue;
    const endMs = parseGamerPowerEnd(item.end_date);
    if (!Number.isFinite(endMs) || endMs <= now) continue;
    const title = cleanGamerPowerTitle(item.title);
    const openUrl = item.open_giveaway_url || item.open_giveaway || "";
    if (!title || !openUrl) continue;
    const image = isHttpsImageUrl(item.image) ? item.image : isHttpsImageUrl(item.thumbnail) ? item.thumbnail : "";
    out.push({
      id: "gamerpower:" + (item.id != null ? String(item.id) : title),
      title,
      image,
      endsAt: new Date(endMs).toISOString(),
      openUrl,
      source: "gamerpower",
      kind,
    });
  }
  return out;
}

export async function resolveStoreUrl(openUrl, fetchImpl, baseHref) {
  if (isOfficialStoreUrl(openUrl)) return sanitizeStoreUrl(openUrl);
  let current;
  try {
    current = new URL(openUrl, baseHref || "https://www.gamerpower.com/").href;
  } catch {
    return "";
  }
  for (let hop = 0; hop < 4; hop++) {
    if (isOfficialStoreUrl(current)) return sanitizeStoreUrl(current);
    if (!isGamerPowerHost(hostOf(current)) && hop > 0) return "";
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
    try {
      const res = await fetchImpl(current, {
        method: "GET",
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8" },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location") || res.headers.get("Location");
        if (!loc) return "";
        try {
          current = new URL(loc, current).href;
        } catch {
          return "";
        }
        continue;
      }
      // No redirect: only keep the URL if this hop already landed on an official store.
      return isOfficialStoreUrl(current) ? sanitizeStoreUrl(current) : "";
    } catch {
      return "";
    } finally {
      clearTimeout(timer);
    }
  }
  return isOfficialStoreUrl(current) ? sanitizeStoreUrl(current) : "";
}

async function resolveGamerPowerGames(candidates, fetchImpl) {
  const resolved = await Promise.all(
    candidates.map(async (item) => {
      const claimUrl = await resolveStoreUrl(item.openUrl, fetchImpl);
      if (!claimUrl || /gamerpower/i.test(claimUrl)) return null;
      const store = storeFromHost(hostOf(claimUrl));
      if (!store) return null;
      return {
        id: item.id,
        title: item.title,
        platform: STORE_LABELS[store] || store,
        store,
        image: item.image,
        endsAt: item.endsAt,
        claimUrl,
        source: "gamerpower",
        kind: item.kind,
      };
    }),
  );
  return resolved.filter(Boolean);
}

export function mergeGames(groups, nowMs) {
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  const seen = new Set();
  const out = [];
  for (const game of groups.flat()) {
    if (!game || !game.title || !isOfficialStoreUrl(game.claimUrl)) continue;
    if (/gamerpower/i.test(game.claimUrl)) continue;
    const end = Date.parse(game.endsAt);
    if (!Number.isFinite(end) || end <= now) continue;
    const key = game.store + ":" + game.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const clean = {
      title: game.title,
      platform: game.platform || STORE_LABELS[game.store] || game.store,
      store: game.store,
      image: isHttpsImageUrl(game.image) ? game.image : "",
      endsAt: new Date(end).toISOString(),
      claimUrl: sanitizeStoreUrl(game.claimUrl),
      source: game.source,
    };
    if (game.kind === "bundle") clean.kind = "bundle";
    if (game.id) clean.id = game.id;
    if (!clean.claimUrl) continue;
    out.push(clean);
  }
  out.sort((a, b) => {
    const end = Date.parse(a.endsAt) - Date.parse(b.endsAt);
    if (end !== 0) return end;
    return a.title.localeCompare(b.title, "zh-Hant");
  });
  return out.slice(0, MAX_GAMES);
}

export function isFreeGame(item) {
  if (!item || typeof item.title !== "string" || !item.title.trim()) return false;
  if (!isOfficialStoreUrl(item.claimUrl)) return false;
  if (/gamerpower/i.test(item.claimUrl)) return false;
  if (!Number.isFinite(Date.parse(item.endsAt))) return false;
  if (item.image && !isHttpsImageUrl(item.image)) return false;
  if (!item.platform || !item.store || !item.source) return false;
  return true;
}

export function isPayload(data) {
  return Boolean(data && Array.isArray(data.games) && data.games.every(isFreeGame));
}

export function toRss(payload, origin) {
  const site = origin || "https://playwhaly.com";
  const games = (payload && payload.games) || [];
  const esc = (text) =>
    String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const items = games
    .map((game) => {
      const end = Date.parse(game.endsAt);
      const pub = Number.isFinite(end) ? new Date(end).toUTCString() : "";
      const label = game.kind === "bundle" ? game.platform + " · 遊戲包" : game.platform;
      return [
        "<item>",
        "<title>" + esc(game.title + "（" + label + "）") + "</title>",
        "<link>" + esc(game.claimUrl) + "</link>",
        "<guid isPermaLink=\"false\">" + esc(game.id || game.claimUrl) + "</guid>",
        pub ? "<pubDate>" + pub + "</pubDate>" : "",
        "<description>" + esc("於 " + label + " 限時免費領取，領了就能留下來。") + "</description>",
        "</item>",
      ]
        .filter(Boolean)
        .join("");
    })
    .join("");
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<rss version="2.0"><channel>' +
    "<title>" + esc("威利 Whaly｜限時免費領取") + "</title>" +
    "<link>" + esc(site + "/#free-games") + "</link>" +
    "<description>" + esc("各商店目前限時免費、領了就能留下來的遊戲。Data: GamerPower.com, Epic Games Store, GOG") + "</description>" +
    "<language>zh-Hant</language>" +
    items +
    "</channel></rss>"
  );
}

async function fetchJson(url, fetchImpl, cfCache, allowStatuses) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const init = {
      method: "GET",
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/json" },
    };
    if (cfCache) init.cf = { cacheTtl: CACHE_SECONDS, cacheEverything: true };
    const res = await fetchImpl(url, init);
    if (allowStatuses && allowStatuses.includes(res.status)) {
      try {
        return { status: res.status, data: await res.json() };
      } catch {
        return { status: res.status, data: null };
      }
    }
    if (!res.ok) throw new Error("upstream " + res.status);
    return { status: res.status, data: await res.json() };
  } finally {
    clearTimeout(timer);
  }
}

export async function loadFreeGames(fetchImpl, options) {
  const cfCache = Boolean(options && options.cfCache);
  const nowMs = options && Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const results = await Promise.allSettled([
    fetchJson(EPIC_URL, fetchImpl, cfCache),
    fetchJson(GOG_URL, fetchImpl, cfCache, [404]),
    fetchJson(GAMERPOWER_URL, fetchImpl, cfCache, [201]),
  ]);
  const failed = results.filter((r) => r.status === "rejected");
  const epicData = results[0].status === "fulfilled" ? results[0].value.data : null;
  const gogHit = results[1].status === "fulfilled" ? results[1].value : null;
  const gpHit = results[2].status === "fulfilled" ? results[2].value : null;

  const epicGames = epicData ? parseEpicPromotions(epicData, nowMs) : [];
  const gogGames = gogHit && gogHit.status !== 404 ? parseGogGiveaway(gogHit.data, nowMs) : [];
  const gpItems = gpHit && gpHit.status === 200 ? gamerPowerCandidates(gpHit.data, nowMs) : [];
  const gpGames = gpItems.length ? await resolveGamerPowerGames(gpItems, fetchImpl) : [];

  const games = mergeGames([epicGames, gogGames, gpGames], nowMs);
  if (!games.length && failed.length === 3) {
    throw new Error("unavailable");
  }
  return {
    payload: {
      games,
      updatedAt: new Date(nowMs).toISOString(),
      attribution: games.some((g) => g.source === "gamerpower"),
    },
    cacheSeconds: games.length ? CACHE_SECONDS : EMPTY_CACHE_SECONDS,
  };
}

function jsonResponse(body, status, cacheSeconds) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=" + cacheSeconds,
    },
  });
}

export function rssResponse(payload, origin, cacheSeconds) {
  return new Response(toRss(payload, origin), {
    status: 200,
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=" + cacheSeconds,
    },
  });
}

export async function onRequest(context) {
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return jsonResponse({ error: "method not allowed" }, 405, 60);
  }

  let edgeCache = null;
  try {
    edgeCache = caches.default;
  } catch {
    edgeCache = null;
  }

  if (edgeCache) {
    const hit = await edgeCache.match(CACHE_KEY);
    if (hit) return hit;
  }

  try {
    const resolved = await loadFreeGames(fetch, { cfCache: true });
    const response = jsonResponse(resolved.payload, 200, resolved.cacheSeconds);
    if (edgeCache) {
      context.waitUntil(edgeCache.put(CACHE_KEY, response.clone()));
    }
    return response;
  } catch {
    return jsonResponse({ error: "feed unavailable" }, 502, 60);
  }
}

export async function onRssRequest(context) {
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  let edgeCache = null;
  try {
    edgeCache = caches.default;
  } catch {
    edgeCache = null;
  }
  const cacheKey = "https://playwhaly.com/free-games.xml";
  if (edgeCache) {
    const hit = await edgeCache.match(cacheKey);
    if (hit) return hit;
  }
  try {
    const resolved = await loadFreeGames(fetch, { cfCache: true });
    const origin = new URL(context.request.url).origin;
    const response = rssResponse(resolved.payload, origin, resolved.cacheSeconds);
    if (edgeCache) context.waitUntil(edgeCache.put(cacheKey, response.clone()));
    return response;
  } catch {
    return new Response("Feed unavailable", {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=60" },
    });
  }
}
