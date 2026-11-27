// GET /api/tier: Whaly's rated games by year, from the published TierPublic tab (TIER_CSV_URL),
// with links to his own YouTube uploads from the published UploadedPublic tab (UPLOADED_CSV_URL).
// Public fields only. Never invents names, tiers, notes, covers or video links.
import { parseCsv, isAllowedCsvUrl, fetchAllowed } from "./backlog.js";

const CACHE_SECONDS = 600;
const UA = "playwhaly.com/tier (https://playwhaly.com/)";
const TIERS = ["S", "A", "B", "C", "D"];
const CJK = /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]/;
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

let memoryCache = { at: 0, key: "", body: null };

function clean(v) {
  return String(v == null ? "" : v).replace(/\s+/g, " ").trim();
}

function exactKey(v) {
  return clean(v).toLowerCase();
}

// Punctuation-insensitive: "Species: Unknown" = "Species Unknown", "R.E.P.O." = "REPO".
export function looseKey(v) {
  return clean(v).toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, "");
}

function rowsAsObjects(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const headers = rows[0].map((h) => clean(h).toLowerCase());
  return rows.slice(1).map((row) => {
    const o = {};
    headers.forEach((h, i) => { if (h) o[h] = clean(row[i]); });
    return o;
  });
}

// Steam only when the id is 1–9 digits AND the row's store is Steam. A numeric GOG, Ubisoft or
// PlayStation id is not a Steam app id and would show some other game's cover. 10-digit ids
// (common GOG product ids) are also rejected, even if the platform cell says Steam.
export function steamAppIdFor(storeGameId, platform) {
  const id = clean(storeGameId);
  if (!/^\d{1,9}$/.test(id)) return "";
  const p = clean(platform).toLowerCase();
  if (p && !/\bsteam\b/.test(p)) return "";
  return id;
}

// cover_steam_appid is a hand-checked Steam app id for the same game; anything but plain digits is ignored.
export function coverAppIdFor(raw) {
  const id = clean(raw);
  return /^\d{1,9}$/.test(id) ? id : "";
}

// cover_url: a hand-checked official cover or key art, preferred over a constructed Steam header.jpg. Only https, only on
// these official store and publisher image hosts, no credentials, no odd ports. Anything else is dropped.
export const COVER_HOSTS = [
  "image.api.playstation.com",
  "assets.nintendo.com",
  "store-images.s-microsoft.com",
  "cdn1.epicgames.com",
  "cdn2.unrealengine.com",
  "drop-assets.ea.com",
  "media.contentapi.ea.com",
  "shared.akamai.steamstatic.com",
  "shared.cloudflare.steamstatic.com",
  "cdn.akamai.steamstatic.com",
  "cdn.cloudflare.steamstatic.com",
  "www.evildeadthegame.com",
];

export function coverUrlFor(raw) {
  const s = clean(raw);
  if (!s || s.length > 500 || /[\s"'<>\\]/.test(s)) return "";
  let u;
  try { u = new URL(s); } catch { return ""; }
  if (u.protocol !== "https:" || u.hostname === "" || u.username || u.password || u.port) return "";
  if (!COVER_HOSTS.includes(u.hostname.toLowerCase())) return "";
  return u.href;
}

// store_url: a hand-checked official store page for the platform the game was played on.
// Only https, only these official store hosts, no credentials, no odd ports. Anything else is dropped.
export const STORE_HOSTS = {
  "store.playstation.com": "在 PlayStation Store 看看",
  "www.nintendo.com": "在 Nintendo eShop 看看",
  "ec.nintendo.com": "在 Nintendo eShop 看看",
  "store.epicgames.com": "在 Epic 看看",
  "www.gog.com": "在 GOG 看看",
  "store.ubisoft.com": "在 Ubisoft Store 看看",
  "www.xbox.com": "在 Microsoft Store 看看",
  "apps.microsoft.com": "在 Microsoft Store 看看",
  "www.ea.com": "在 EA 看看",
  "store.steampowered.com": "在 Steam 看看",
  "www.playstation.com": "在 PlayStation 看看",
};

export function storeUrlFor(raw) {
  const s = clean(raw);
  if (!s || s.length > 500 || /[\s"'<>\\]/.test(s)) return "";
  let u;
  try { u = new URL(s); } catch { return ""; }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return "";
  const host = u.hostname.toLowerCase();
  // Accept a bare gog.com and normalise it to www.gog.com, which is the official host.
  if (host === "gog.com") {
    u.hostname = "www.gog.com";
  }
  if (!Object.prototype.hasOwnProperty.call(STORE_HOSTS, u.hostname.toLowerCase())) return "";
  return u.href;
}

export function storeLabelFor(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return STORE_HOSTS[host] || "";
  } catch {
    return "";
  }
}

function steamStoreUrl(appid) {
  return "https://store.steampowered.com/app/" + appid + "/";
}

export function tierGamesFromCsv(text) {
  const out = [];
  for (const r of rowsAsObjects(text)) {
    const yearRaw = r.year || "";
    const name_en = r.name_en || r.game || "";
    const tier = (r.tier || "").toUpperCase();
    if (!/^\d{4}$/.test(yearRaw) || !name_en || !TIERS.includes(tier)) continue;
    const g = {
      year: Number(yearRaw),
      name_zh: r.name_zh || "",
      name_en,
      tier,
      notes_zh: r.notes_zh || "",
      notes_en: r.notes_en || "",
    };
    const appid = steamAppIdFor(r.store_game_id, r.platform);
    if (appid) {
      g.steam_appid = appid;
    } else {
      // Played on another store or console: show the cover of the same game on Steam, when the sheet's
      // cover_steam_appid column names one.
      const cover = coverAppIdFor(r.cover_steam_appid);
      if (cover) g.steam_appid = cover;
    }
    // An allowlisted cover_url is preferred over a constructed Steam header.jpg, including when a
    // steam_appid is present. Newer Steam apps often 404 at the legacy CDN path.
    const url = coverUrlFor(r.cover_url);
    if (url) g.cover = url;
    // Official store button: prefer a hand-checked store_url for the platform actually played.
    // If that is missing or not on an allowed host, fall back to the Steam page when we have an app id
    // (the Steam-platform id, or cover_steam_appid). Owner's choice, 27 Nov 2026.
    // A cell value of "delisted" is an explicit marker: show a non-clickable 已下架 pill, no fallback.
    if (/^delisted$/i.test(clean(r.store_url))) {
      g.store_status = "delisted";
      g.store_label = "已下架";
    } else {
      const official = storeUrlFor(r.store_url);
      if (official) {
        const label = storeLabelFor(official);
        if (label) {
          g.store_url = official;
          g.store_label = label;
        }
      } else if (g.steam_appid) {
        g.store_url = steamStoreUrl(g.steam_appid);
        g.store_label = "在 Steam 看看";
      }
    }
    out.push(g);
  }
  return out;
}

export function videoType(raw) {
  const t = clean(raw).toLowerCase();
  if (t === "long form" || t === "longform" || t === "long") return "long";
  if (t === "live" || t === "stream") return "live";
  if (t === "shorts" || t === "short") return "short";
  return "";
}

// "21-Dec-2020", "2026-11-21 16:30:17", "2026-11-21" → "YYYY-MM-DD" (or "").
export function isoDate(raw) {
  const s = clean(raw);
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
  m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m && MONTHS[m[2].toLowerCase()]) {
    return m[3] + "-" + String(MONTHS[m[2].toLowerCase()]).padStart(2, "0") + "-" + m[1].padStart(2, "0");
  }
  return "";
}

function isYouTube(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    return h === "youtu.be" || h === "youtube.com" || h.endsWith(".youtube.com");
  } catch {
    return false;
  }
}

export function firstBracket(title) {
  const m = String(title || "").match(/《([^》]+)》/);
  return m ? clean(m[1]) : "";
}

// Candidate names inside one 《》: the whole text, the trailing English part, the leading Chinese part.
export function bracketCandidates(inner) {
  const text = clean(inner);
  if (!text) return [];
  const out = [text];
  const parts = text.split(CJK).map(clean).filter((p) => /[A-Za-z]/.test(p));
  if (parts.length) {
    const m = parts[parts.length - 1].match(/[A-Za-z][A-Za-z0-9 .:'’&+!\-]*$/);
    if (m) out.push(clean(m[0]));
  }
  const lead = text.split(/\s+(?=[A-Za-z])/)[0];
  if (lead && lead !== text && CJK.test(lead)) out.push(clean(lead));
  return out.filter((v, i, a) => v && a.indexOf(v) === i);
}

export function videosFromCsv(text) {
  const out = [];
  for (const r of rowsAsObjects(text)) {
    const url = r.url || "";
    const kind = videoType(r.type);
    if (!isYouTube(url) || !kind) continue; // drops the year-header rows (URL is a count)
    out.push({ title: r.title || "", url, kind, date: isoDate(r.date) });
  }
  return out;
}

export function attachVideos(games, videos) {
  const exact = new Map();
  const loose = new Map();
  const add = (map, k, g) => { if (k && !map.has(k)) map.set(k, g); };
  for (const g of games) {
    add(exact, exactKey(g.name_en), g);
    add(exact, exactKey(g.name_zh), g);
    if (g.name_zh) add(exact, exactKey(g.name_zh + " " + g.name_en), g);
    add(loose, looseKey(g.name_en), g);
    add(loose, looseKey(g.name_zh), g);
    if (g.name_zh) add(loose, looseKey(g.name_zh + g.name_en), g);
  }
  const found = new Map();
  for (const v of videos) {
    const cands = bracketCandidates(firstBracket(v.title));
    if (!cands.length) continue; // never guess from a bare title
    let hit = null;
    for (const c of cands) { hit = exact.get(exactKey(c)); if (hit) break; }
    if (!hit) for (const c of cands) { hit = loose.get(looseKey(c)); if (hit) break; }
    if (!hit) continue;
    if (!found.has(hit)) found.set(hit, []);
    found.get(hit).push(v);
  }
  const rank = { long: 0, live: 1, short: 2 };
  for (const [g, list] of found) {
    list.sort((a, b) => (rank[a.kind] - rank[b.kind]) || String(b.date).localeCompare(String(a.date)));
    g.videos = list.map((v) => ({ title: v.title, url: v.url, type: v.kind, date: v.date }));
  }
  return games;
}

const zhCollator = new Intl.Collator("zh-Hant");
const enCollator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

export function sortGames(games) {
  return games.sort((a, b) =>
    (b.year - a.year) ||
    (TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier)) ||
    zhCollator.compare(a.name_zh || a.name_en, b.name_zh || b.name_en) ||
    enCollator.compare(a.name_en, b.name_en));
}

export function buildPayload(games, nowMs) {
  const byYear = {};
  for (const g of games) byYear[g.year] = (byYear[g.year] || 0) + 1;
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);
  return {
    ok: true,
    updatedAt: new Date(nowMs || Date.now()).toISOString(),
    years,
    stats: { total: games.length, byYear },
    games: sortGames(games),
  };
}

const UNSET = { ok: false, reason: "unset", message: "分級清單還沒接上公開資料，稍後再來看看～" };
const DOWN = { ok: false, reason: "unreachable", message: "暫時讀不到分級清單，請稍後再試～" };

export async function loadTier(fetchImpl, options) {
  const tierUrl = (options && options.tierUrl) || "";
  const uploadedUrl = (options && options.uploadedUrl) || "";
  if (!tierUrl || !isAllowedCsvUrl(tierUrl)) return { payload: UNSET, cacheSeconds: 60 };
  let games;
  try {
    games = tierGamesFromCsv(await fetchAllowed(tierUrl, fetchImpl || fetch, UA));
  } catch {
    return { payload: DOWN, cacheSeconds: 60 };
  }
  // Videos are optional: if the Uploaded CSV is missing or down, the tiers still show, just without links.
  if (uploadedUrl && isAllowedCsvUrl(uploadedUrl)) {
    try {
      attachVideos(games, videosFromCsv(await fetchAllowed(uploadedUrl, fetchImpl || fetch, UA)));
    } catch {
      /* no video links this time */
    }
  }
  return { payload: buildPayload(games, options && options.nowMs), cacheSeconds: CACHE_SECONDS };
}

export function statsView(payload) {
  if (!payload || !payload.ok) return payload;
  return { ok: true, updatedAt: payload.updatedAt, years: payload.years, stats: payload.stats };
}

function jsonResponse(body, status, cacheSeconds) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=" + cacheSeconds,
    },
  });
}

export async function onRequest(context) {
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return jsonResponse({ error: "method not allowed" }, 405, 60);
  }
  const env = context.env || {};
  const tierUrl = env.TIER_CSV_URL || "";
  const uploadedUrl = env.UPLOADED_CSV_URL || "";
  const key = tierUrl + "|" + uploadedUrl;
  const now = Date.now();
  const statsOnly = new URL(context.request.url).searchParams.get("view") === "stats";
  const shape = (body) => (statsOnly ? statsView(body) : body);
  if (memoryCache.body && now - memoryCache.at < CACHE_SECONDS * 1000 && memoryCache.key === key) {
    return jsonResponse(shape(memoryCache.body), 200, CACHE_SECONDS);
  }
  const resolved = await loadTier(fetch, { tierUrl, uploadedUrl, nowMs: now });
  if (resolved.payload.ok) memoryCache = { at: now, key, body: resolved.payload };
  return jsonResponse(shape(resolved.payload), 200, resolved.cacheSeconds);
}
