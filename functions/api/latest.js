const CHANNEL_ID = "UCa7pDF8Jgdpg-7mUeOlundQ";
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const FETCH_MS = 8000;
// Edge cache for the parsed feed. YouTube itself refreshes the RSS about every 15 min, so 30 min is plenty.
const CACHE_SECONDS = 1800;
// Hero slideshow uses the newest 3, the grid shows up to 9 more (3 full rows of 3).
const NEED = 10;
const MORE = 9;
const UULF_URL =
  "https://www.youtube.com/feeds/videos.xml?playlist_id=UULF" +
  CHANNEL_ID.slice(2);
const CHANNEL_URL =
  "https://www.youtube.com/feeds/videos.xml?channel_id=" + CHANNEL_ID;
const CACHE_KEY = "https://playwhaly.com/api/latest";
const UA = "playwhaly.com/latest (https://playwhaly.com/)";

export function decodeEntities(text) {
  return String(text)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

export function cleanTitle(raw) {
  const title = decodeEntities(raw)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!title) return "";
  return title.slice(0, 300);
}

export function videoIdFromHref(href) {
  try {
    const url = new URL(href);
    if (url.hostname === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return VIDEO_ID_RE.test(id) ? id : "";
    }
    if (!/(^|\.)youtube\.com$/.test(url.hostname)) return "";
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v") || "";
      return VIDEO_ID_RE.test(id) ? id : "";
    }
    const shorts = url.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})/);
    if (shorts) return shorts[1];
    return "";
  } catch {
    return "";
  }
}

export function isShortsHref(href) {
  try {
    const url = new URL(href);
    return /\/shorts\//i.test(url.pathname);
  } catch {
    return /\/shorts\//i.test(String(href));
  }
}

export function normalizeWatchUrl(videoId) {
  return "https://www.youtube.com/watch?v=" + videoId;
}

// maxresdefault is 1280x720. A few videos have no maxres (YouTube answers 404), so the page falls back
// to thumbnailFallback (hqdefault) with an onerror handler.
export function normalizeThumbnail(videoId) {
  return "https://i.ytimg.com/vi/" + videoId + "/maxresdefault.jpg";
}

export function normalizeThumbnailFallback(videoId) {
  return "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg";
}

function tagText(block, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(
    new RegExp("<" + escaped + "\\b[^>]*>([\\s\\S]*?)</" + escaped + ">", "i"),
  );
  return match ? decodeEntities(match[1]).trim() : "";
}

function linkHref(block) {
  const patterns = [
    /<link\b[^>]*\brel=["']alternate["'][^>]*\bhref=["']([^"']+)["']/i,
    /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']alternate["']/i,
    /<link\b[^>]*\bhref=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const match = block.match(re);
    if (match) return decodeEntities(match[1]).trim();
  }
  return "";
}

export function parseFeed(xml) {
  if (typeof xml !== "string" || !xml.includes("<entry")) return [];
  const entries = [];
  const entryRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  let match;
  while ((match = entryRe.exec(xml))) {
    const block = match[1];
    const href = linkHref(block);
    const fromTag = tagText(block, "yt:videoId") || tagText(block, "videoId");
    const videoId = VIDEO_ID_RE.test(fromTag) ? fromTag : videoIdFromHref(href);
    const title = cleanTitle(tagText(block, "title"));
    const published = tagText(block, "published");
    if (!videoId || !title) continue;
    entries.push({
      videoId,
      title,
      published,
      href,
      isShort: isShortsHref(href),
    });
  }
  return entries;
}

export function pickVideos(entries) {
  const out = [];
  const seen = new Set();
  for (const entry of entries) {
    if (!entry || entry.isShort) continue;
    if (!VIDEO_ID_RE.test(entry.videoId)) continue;
    if (seen.has(entry.videoId)) continue;
    const publishedMs = Date.parse(entry.published);
    if (!Number.isFinite(publishedMs)) continue;
    seen.add(entry.videoId);
    out.push({
      title: entry.title,
      url: normalizeWatchUrl(entry.videoId),
      published: new Date(publishedMs).toISOString(),
      thumbnail: normalizeThumbnail(entry.videoId),
      thumbnailFallback: normalizeThumbnailFallback(entry.videoId),
    });
    if (out.length >= NEED) break;
  }
  return out;
}

export function toPayload(videos) {
  if (!videos.length) return null;
  return { latest: videos[0], more: videos.slice(1, 1 + MORE) };
}

export async function fetchFeed(url, fetchImpl, cfCache) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const init = {
      method: "GET",
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/atom+xml, text/xml, application/xml" },
    };
    if (cfCache) init.cf = { cacheTtl: CACHE_SECONDS, cacheEverything: true };
    const res = await fetchImpl(url, init);
    if (!res.ok) throw new Error("upstream " + res.status);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function loadVideos(fetchImpl, cfCache) {
  let lastError = null;
  try {
    const xml = await fetchFeed(UULF_URL, fetchImpl, cfCache);
    const videos = pickVideos(parseFeed(xml));
    if (videos.length) return videos;
  } catch (err) {
    lastError = err;
  }
  try {
    const xml = await fetchFeed(CHANNEL_URL, fetchImpl, cfCache);
    const videos = pickVideos(parseFeed(xml));
    if (videos.length) return videos;
  } catch (err) {
    lastError = err;
  }
  const error = new Error("no videos");
  error.cause = lastError;
  throw error;
}

const WATCH_HOST = /^(www\.)?youtube\.com$/;

export function isVideoItem(item) {
  if (!item || typeof item.title !== "string" || !item.title.trim()) return false;
  if (!Number.isFinite(Date.parse(item.published))) return false;
  try {
    const url = new URL(item.url);
    if (url.protocol !== "https:") return false;
    if (!WATCH_HOST.test(url.hostname)) return false;
    if (url.pathname !== "/watch") return false;
    if (!VIDEO_ID_RE.test(url.searchParams.get("v") || "")) return false;
    for (const key of ["thumbnail", "thumbnailFallback"]) {
      if (key === "thumbnailFallback" && item[key] === undefined) continue;
      const thumb = new URL(item[key]);
      if (thumb.protocol !== "https:") return false;
      if (thumb.hostname !== "i.ytimg.com") return false;
      if (!/^\/vi\/[A-Za-z0-9_-]{11}\//.test(thumb.pathname)) return false;
    }
  } catch {
    return false;
  }
  return true;
}

export function isPayload(data) {
  if (!data || !isVideoItem(data.latest) || !Array.isArray(data.more)) return false;
  return data.more.every(isVideoItem);
}

export async function loadStaticPayload(fetchImpl, baseUrl) {
  if (!fetchImpl || !baseUrl) return null;
  try {
    const res = await fetchImpl(new URL("/data/latest.json", baseUrl).href, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!isPayload(data)) return null;
    return { latest: data.latest, more: data.more.slice(0, MORE) };
  } catch {
    return null;
  }
}

export async function resolveLatest(fetchImpl, options) {
  const cfCache = Boolean(options && options.cfCache);
  const baseUrl = options && options.baseUrl;
  try {
    const videos = await loadVideos(fetchImpl, cfCache);
    const payload = toPayload(videos);
    if (payload) return { payload, source: "feed", cacheSeconds: CACHE_SECONDS };
  } catch {
    // Use the committed static list when every live feed fails.
  }
  const fallback = await loadStaticPayload(fetchImpl, baseUrl);
  if (fallback) return { payload: fallback, source: "static", cacheSeconds: 300 };
  throw new Error("unavailable");
}

function jsonResponse(body, status, cacheSeconds) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Browsers keep it 5 min, the edge keeps it cacheSeconds.
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
    const resolved = await resolveLatest(fetch, {
      cfCache: true,
      baseUrl: new URL(context.request.url).origin,
    });
    const response = jsonResponse(resolved.payload, 200, resolved.cacheSeconds);
    if (edgeCache) {
      context.waitUntil(edgeCache.put(CACHE_KEY, response.clone()));
    }
    return response;
  } catch {
    return jsonResponse({ error: "feed unavailable" }, 502, 60);
  }
}
