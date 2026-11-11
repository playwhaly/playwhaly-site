const CHANNEL_ID = "UCa7pDF8Jgdpg-7mUeOlundQ";
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const FETCH_MS = 8000;
const CACHE_SECONDS = 900;
const NEED = 5;
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

export function normalizeThumbnail(videoId) {
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
    });
    if (out.length >= NEED) break;
  }
  return out;
}

export function toPayload(videos) {
  if (!videos.length) return null;
  return { latest: videos[0], more: videos.slice(1, 5) };
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

function jsonResponse(body, status, cacheSeconds) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=" + cacheSeconds,
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
    const videos = await loadVideos(fetch, true);
    const payload = toPayload(videos);
    if (!payload) return jsonResponse({ error: "no videos" }, 502, 60);
    const response = jsonResponse(payload, 200, CACHE_SECONDS);
    if (edgeCache) {
      context.waitUntil(edgeCache.put(CACHE_KEY, response.clone()));
    }
    return response;
  } catch {
    return jsonResponse({ error: "feed unavailable" }, 502, 60);
  }
}
