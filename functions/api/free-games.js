const FETCH_MS = 8000;
const CACHE_SECONDS = 3600;
const EMPTY_CACHE_SECONDS = 300;
const CACHE_KEY = "https://playwhaly.com/api/free-games";
const UA = "playwhaly.com/free-games (https://playwhaly.com/)";
const EPIC_URL =
  "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=zh-Hant&country=SG&allowCountries=SG";
const EPIC_GRAPHQL = "https://store.epicgames.com/graphql";
const GAMERPOWER_URL = "https://www.gamerpower.com/api/giveaways?platform=pc&type=game";
const STEAM_APPDETAILS = "https://store.steampowered.com/api/appdetails?appids=";

const STORE_LABELS = {
  epic: "Epic 遊戲商店",
  steam: "Steam",
  gog: "GOG",
  itch: "itch.io",
  indiegala: "IndieGala",
  stove: "STOVE",
};

const AFFILIATE_PARAM = /^(ref|referrer|referer|aff|affiliate|partner|campaign|tap_s|tap_a|fbclid|gclid|mc_eid)|^(utm_)/i;

const ROMAN_VALUES = {
  i: "1",
  ii: "2",
  iii: "3",
  iv: "4",
  v: "5",
  vi: "6",
  vii: "7",
  viii: "8",
  ix: "9",
  x: "10",
  xi: "11",
  xii: "12",
  xiii: "13",
  xiv: "14",
  xv: "15",
  xvi: "16",
  xvii: "17",
  xviii: "18",
  xix: "19",
  xx: "20",
};

const ADULT_PATTERNS = [
  /\bhentai\b/i,
  /\bnsfw\b/i,
  /\badult\b/i,
  /\bsexually\b/i,
  /\bsexual(?:ity)?\b/i,
  /\bnudity\b/i,
  /\bnude\b/i,
  /\berotica\b/i,
  /\berotic\b/i,
  /\bporn(?:o|ographic|ography)?\b/i,
  /\buncensored\b/i,
  /\bwaifu\s+strip\b/i,
  /\bxxx\b/i,
  /18\s*\+|\+18\b|\b18\s*plus\b|\br\s*-?\s*18\b/i,
];

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

export function normalizeTitle(title) {
  const cleaned = cleanGamerPowerTitle(title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ");
  const numbered = cleaned.replace(
    /\b(xx|xix|xviii|xvii|xvi|xv|xiv|xiii|xii|xi|x|ix|viii|vii|vi|v|iv|iii|ii|i)\b/g,
    (token) => ROMAN_VALUES[token] || token,
  );
  return numbered.replace(/\s+/g, " ").trim();
}

export function isAdultGamerPowerText(title, description) {
  const hay = [title, description].map((v) => String(v || "")).join(" \n ");
  return ADULT_PATTERNS.some((re) => re.test(hay));
}

function hasCjk(text) {
  return /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/.test(String(text || ""));
}

export function formatLocalizedTitle(official, fallback) {
  const primary = unwrapTitle(official);
  const english = unwrapTitle(fallback);
  if (!primary) return english;
  if (!english) return primary;
  if (!hasCjk(primary)) return primary;
  const officialNorm = normalizeTitle(primary);
  const englishNorm = normalizeTitle(english);
  if (!englishNorm || officialNorm.includes(englishNorm) || primary.toLowerCase().includes(english.toLowerCase())) {
    return primary;
  }
  return primary + " " + english;
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

export function epicSlugFromUrl(href) {
  try {
    const url = new URL(href);
    const page = url.pathname.match(/\/(?:[a-z]{2}(?:-[A-Za-z]+)?\/)?p\/([^/]+)/i);
    return page ? decodeURIComponent(page[1]).toLowerCase() : "";
  } catch {
    return "";
  }
}

export function steamAppIdFromUrl(href) {
  try {
    const url = new URL(href);
    const match = url.pathname.match(/\/app\/(\d+)/i);
    return match ? match[1] : "";
  } catch {
    return "";
  }
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


function upcomingFreeOffer(element, now) {
  const offers = flattenOffers((element && element.promotions && element.promotions.upcomingPromotionalOffers) || []);
  let best = null;
  for (const offer of offers) {
    const setting = offer.discountSetting || {};
    if (setting.discountType && setting.discountType !== "PERCENTAGE") continue;
    if (setting.discountPercentage !== 0) continue;
    const start = Date.parse(offer.startDate);
    const end = Date.parse(offer.endDate);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (start <= now) continue;
    if (!best || start < Date.parse(best.startDate)) best = offer;
  }
  return best;
}

export function parseEpicUpcoming(data, nowMs) {
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
    const offer = upcomingFreeOffer(element, now);
    if (!offer) continue;
    const title = unwrapTitle(element.title);
    const slug = epicSlug(element);
    const claimUrl = slug ? sanitizeStoreUrl("https://store.epicgames.com/zh-Hant/p/" + slug) : "";
    if (!title || !claimUrl) continue;
    games.push({
      id: "epic-upcoming:" + (element.namespace || "") + ":" + (element.id || slug),
      title,
      platform: STORE_LABELS.epic,
      store: "epic",
      image: epicImage(element),
      startsAt: new Date(Date.parse(offer.startDate)).toISOString(),
      endsAt: new Date(Date.parse(offer.endDate)).toISOString(),
      claimUrl,
      source: "epic",
      kind: offerType === "BUNDLE" || /bundle/i.test(title) ? "bundle" : "game",
    });
  }
  games.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.title.localeCompare(b.title, "zh-Hant"));
  return games;
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

export function gamerPowerCandidates(items, nowMs) {
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  const list = Array.isArray(items) ? items : [];
  const out = [];
  for (const item of list) {
    if (!item || String(item.status || "").toLowerCase() !== "active") continue;
    const kind = gamerPowerKind(item);
    if (!kind) continue;
    if (isAdultGamerPowerText(item.title, item.description)) continue;
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

export function isSteamAdultApp(details) {
  if (!details || typeof details !== "object") return false;
  const age = Number(details.required_age);
  if (Number.isFinite(age) && age >= 18) return true;
  const ids = (details.content_descriptors && details.content_descriptors.ids) || [];
  return ids.some((id) => Number(id) === 3 || Number(id) === 4);
}

export async function isOfficialSteamAdult(claimUrl, fetchImpl) {
  const appid = steamAppIdFromUrl(claimUrl);
  if (!appid) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const res = await fetchImpl(STEAM_APPDETAILS + appid, {
      method: "GET",
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) return false;
    const data = await res.json();
    const entry = data && data[appid];
    if (!entry || entry.success !== true || !entry.data) return false;
    return isSteamAdultApp(entry.data);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function dropAdultSteamGames(games, fetchImpl) {
  const checked = await Promise.all(
    games.map(async (game) => {
      if (!game || game.store !== "steam") return game;
      return (await isOfficialSteamAdult(game.claimUrl, fetchImpl)) ? null : game;
    }),
  );
  return checked.filter(Boolean);
}

export function findEpicMatch(game, epicGames) {
  if (!game || game.store !== "epic") return null;
  const slug = epicSlugFromUrl(game.claimUrl);
  const titleKey = normalizeTitle(game.title);
  for (const epic of epicGames || []) {
    if (!epic) continue;
    const epicSlugValue = epicSlugFromUrl(epic.claimUrl);
    if (slug && epicSlugValue && slug === epicSlugValue) return epic;
    if (titleKey && normalizeTitle(epic.title) === titleKey) return epic;
  }
  return null;
}

export async function fetchEpicCatalogTitle(slug, keywords, fetchImpl) {
  if (!slug || !fetchImpl) return "";
  const body = JSON.stringify({
    query:
      "query($locale:String,$country:String!,$keywords:String,$count:Int){Catalog{searchStore(locale:$locale,country:$country,keywords:$keywords,count:$count){elements{title offerMappings{pageSlug} catalogNs{mappings{pageSlug}}}}}}",
    variables: { locale: "zh-Hant", country: "SG", keywords: keywords || slug, count: 10 },
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const res = await fetchImpl(EPIC_GRAPHQL, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        "Content-Type": "application/json",
        Origin: "https://store.epicgames.com",
      },
      body,
    });
    if (!res.ok) return "";
    const data = await res.json();
    const elements =
      (data && data.data && data.data.Catalog && data.data.Catalog.searchStore && data.data.Catalog.searchStore.elements) ||
      [];
    const want = String(slug).toLowerCase();
    for (const element of elements) {
      const slugs = []
        .concat((element && element.offerMappings) || [])
        .concat(((element && element.catalogNs) || {}).mappings || [])
        .map((m) => (m && m.pageSlug ? String(m.pageSlug).toLowerCase() : ""))
        .filter(Boolean);
      if (slugs.includes(want) && element.title) return unwrapTitle(element.title);
    }
    return "";
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

export async function applyEpicData(games, epicGames, fetchImpl) {
  const feed = Array.isArray(epicGames) ? epicGames : [];
  return Promise.all(
    (games || []).map(async (game) => {
      if (!game || game.store !== "epic") return game;
      const hit = findEpicMatch(game, feed);
      if (hit) {
        return {
          ...game,
          title: formatLocalizedTitle(hit.title, game.title) || game.title,
          image: hit.image || game.image,
          endsAt: hit.endsAt || game.endsAt,
          claimUrl: hit.claimUrl || game.claimUrl,
          platform: STORE_LABELS.epic,
        };
      }
      const official = await fetchEpicCatalogTitle(epicSlugFromUrl(game.claimUrl), game.title, fetchImpl);
      const title = formatLocalizedTitle(official, game.title) || game.title;
      return title === game.title ? game : { ...game, title };
    }),
  );
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
    const claimUrl = sanitizeStoreUrl(game.claimUrl);
    if (!claimUrl) continue;
    const keys = [game.store + ":" + normalizeTitle(game.title), game.store + ":url:" + claimUrl];
    const slug = game.store === "epic" ? epicSlugFromUrl(claimUrl) : "";
    if (slug) keys.push(game.store + ":slug:" + slug);
    const appid = game.store === "steam" ? steamAppIdFromUrl(claimUrl) : "";
    if (appid) keys.push(game.store + ":app:" + appid);
    if (keys.some((key) => seen.has(key))) continue;
    for (const key of keys) seen.add(key);
    const clean = {
      title: game.title,
      platform: game.platform || STORE_LABELS[game.store] || game.store,
      store: game.store,
      image: isHttpsImageUrl(game.image) ? game.image : "",
      endsAt: new Date(end).toISOString(),
      claimUrl,
      source: game.source,
    };
    if (game.kind === "bundle") clean.kind = "bundle";
    if (game.id) clean.id = game.id;
    out.push(clean);
  }
  out.sort((a, b) => {
    const end = Date.parse(a.endsAt) - Date.parse(b.endsAt);
    if (end !== 0) return end;
    return a.title.localeCompare(b.title, "zh-Hant");
  });
  return out;
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
    "<link>" + esc(site + "/free") + "</link>" +
    "<description>" +
    esc("各商店目前限時免費、領了就能留下來的遊戲。Data: GamerPower.com; some Epic titles, images and end times from the Epic Games Store") +
    "</description>" +
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


const HISTORY_KEY = "free-games-history-v1";
const ENDED_KEEP_MS = 21 * 24 * 3600 * 1000;

function historyKv(env) {
  return env && (env.FREE_GAMES_HISTORY || env.FREE_GAMES_SEEN) ? (env.FREE_GAMES_HISTORY || env.FREE_GAMES_SEEN) : null;
}

export async function updateFreeGamesHistory(kv, games, nowMs) {
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  let prev = { seenIds: [], seenCount: 0, current: [], ended: [] };
  try {
    const raw = await kv.get(HISTORY_KEY, { type: "json" });
    if (raw && typeof raw === "object") prev = { ...prev, ...raw };
  } catch {
    /* ignore unreadable history */
  }
  const current = (games || []).map((g) => ({
    id: g.id || g.claimUrl,
    title: g.title,
    store: g.store,
    platform: g.platform,
    image: g.image || "",
    endsAt: g.endsAt,
    claimUrl: g.claimUrl,
    kind: g.kind || "game",
  }));
  const currentIds = new Set(current.map((g) => g.id).filter(Boolean));
  const seen = new Set(Array.isArray(prev.seenIds) ? prev.seenIds : []);
  for (const g of current) {
    if (g.id) seen.add(g.id);
  }
  const endedMap = new Map();
  (Array.isArray(prev.ended) ? prev.ended : []).forEach((g) => {
    if (g && g.id) endedMap.set(g.id, g);
  });
  (Array.isArray(prev.current) ? prev.current : []).forEach((g) => {
    if (!g || !g.id) return;
    if (!currentIds.has(g.id)) {
      endedMap.set(g.id, { ...g, endedAt: g.endsAt || new Date(now).toISOString() });
    }
  });
  currentIds.forEach((id) => endedMap.delete(id));
  const ended = [...endedMap.values()]
    .filter((g) => {
      const t = Date.parse(g.endedAt || g.endsAt);
      return Number.isFinite(t) && now - t <= ENDED_KEEP_MS;
    })
    .sort((a, b) => Date.parse(b.endedAt || b.endsAt) - Date.parse(a.endedAt || a.endsAt))
    .slice(0, 12);
  const seenIds = [...seen];
  const next = {
    seenIds,
    seenCount: seenIds.length,
    current,
    ended,
    updatedAt: new Date(now).toISOString(),
  };
  await kv.put(HISTORY_KEY, JSON.stringify(next));
  return { seenCount: next.seenCount, ended };
}

export async function loadFreeGames(fetchImpl, options) {
  const cfCache = Boolean(options && options.cfCache);
  const nowMs = options && Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const results = await Promise.allSettled([
    fetchJson(GAMERPOWER_URL, fetchImpl, cfCache, [201]),
    fetchJson(EPIC_URL, fetchImpl, cfCache),
  ]);
  const gpHit = results[0].status === "fulfilled" ? results[0].value : null;
  const epicData = results[1].status === "fulfilled" ? results[1].value.data : null;

  if (!gpHit || (gpHit.status !== 200 && gpHit.status !== 201)) {
    throw new Error("unavailable");
  }

  const gpItems = gpHit.data ? gamerPowerCandidates(gpHit.data, nowMs) : [];
  const gpGames = gpItems.length ? await resolveGamerPowerGames(gpItems, fetchImpl) : [];
  const ageChecked = await dropAdultSteamGames(gpGames, fetchImpl);
  const epicGames = epicData ? parseEpicPromotions(epicData, nowMs) : [];
  const enriched = await applyEpicData(ageChecked, epicGames, fetchImpl);
  const games = mergeGames([enriched], nowMs);
  const upcoming = epicData ? parseEpicUpcoming(epicData, nowMs) : [];
  const payload = {
    games,
    updatedAt: new Date(nowMs).toISOString(),
    attribution: games.some((g) => g.source === "gamerpower"),
  };
  if (upcoming.length) payload.upcoming = upcoming;
  const kv = historyKv(options && options.env);
  if (kv) {
    try {
      const hist = await updateFreeGamesHistory(kv, games, nowMs);
      if (hist.seenCount) payload.seenCount = hist.seenCount;
      if (hist.ended && hist.ended.length) payload.ended = hist.ended;
    } catch {
      /* hide count and ended rather than invent numbers */
    }
  }
  return {
    payload,
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
    const resolved = await loadFreeGames(fetch, { cfCache: true, env: context.env });
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
    const resolved = await loadFreeGames(fetch, { cfCache: true, env: context.env });
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
