import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseFeed,
  pickVideos,
  toPayload,
  isPayload,
  loadStaticPayload,
  resolveLatest,
  onRequest,
} from "../functions/api/latest.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const staticJson = JSON.parse(
  await readFile(join(root, "public/data/latest.json"), "utf8"),
);

const UULF =
  "https://www.youtube.com/feeds/videos.xml?playlist_id=UULFa7pDF8Jgdpg-7mUeOlundQ";
const CHANNEL =
  "https://www.youtube.com/feeds/videos.xml?channel_id=UCa7pDF8Jgdpg-7mUeOlundQ";

function atomEntry({ id, title, published, href }) {
  return `<entry>
    <yt:videoId>${id}</yt:videoId>
    <title>${title}</title>
    <published>${published}</published>
    <link rel="alternate" href="${href}"/>
  </entry>`;
}

const sampleXml = `<?xml version="1.0"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">${[
  atomEntry({
    id: "gkBtjBj17FM",
    title: "《島嶼生存者 The Survivalists》從零開始的猴島求生！",
    published: "2026-11-06T10:45:37+00:00",
    href: "https://www.youtube.com/watch?v=gkBtjBj17FM",
  }),
  atomEntry({
    id: "opjMXjp0AmA",
    title: "a short should be dropped",
    published: "2026-11-09T10:30:34+00:00",
    href: "https://www.youtube.com/shorts/opjMXjp0AmA",
  }),
  atomEntry({
    id: "o8PfE9eV5Qg",
    title: "《Core Keeper 核心守護者》從零開始！我們一路打敗所有BOSS！",
    published: "2026-10-23T10:45:19+00:00",
    href: "https://www.youtube.com/watch?v=o8PfE9eV5Qg",
  }),
].join("")}</feed>`;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockFetch(handlers) {
  return async (url, init) => {
    if (init && init.method && init.method !== "GET") {
      return new Response("no", { status: 405 });
    }
    const href = typeof url === "string" ? url : url.url || String(url);
    for (const [key, fn] of Object.entries(handlers)) {
      if (href.includes(key) || href === key) return fn(href, init);
    }
    return new Response("not found", { status: 404 });
  };
}

assert.equal(isPayload(staticJson), true, "committed JSON is a valid payload");
assert.equal(staticJson.latest.url, "https://www.youtube.com/watch?v=RLLBnHS3gZo");
assert.equal(staticJson.more.length, 9);

const parsed = parseFeed(sampleXml);
assert.equal(parsed.length, 3);
const picked = pickVideos(parsed);
assert.equal(picked.length, 2);
assert.equal(picked[0].title.includes("島嶼生存者"), true);
assert.equal(picked[0].url.endsWith("gkBtjBj17FM"), true);
assert.deepEqual(toPayload(picked).more[0].url, picked[1].url);

const fromStatic = await loadStaticPayload(
  mockFetch({
    "/data/latest.json": async () => jsonResponse(staticJson),
  }),
  "https://playwhaly.com",
);
assert.equal(fromStatic.latest.title, staticJson.latest.title);
assert.equal(fromStatic.more.length, 9);

const emptyStatic = await loadStaticPayload(
  mockFetch({ "/data/latest.json": async () => jsonResponse({ error: "nope" }) }),
  "https://playwhaly.com",
);
assert.equal(emptyStatic, null);

const feedHit = await resolveLatest(
  mockFetch({
    "playlist_id=UULF": async () => new Response(sampleXml, { status: 200 }),
    "/data/latest.json": async () => jsonResponse(staticJson),
  }),
  { baseUrl: "https://playwhaly.com" },
);
assert.equal(feedHit.source, "feed");
assert.equal(feedHit.cacheSeconds, 1800);
assert.equal(feedHit.payload.latest.thumbnail.endsWith("/maxresdefault.jpg"), true);
assert.equal(feedHit.payload.latest.thumbnailFallback.endsWith("/hqdefault.jpg"), true);
assert.equal(feedHit.payload.latest.url.includes("gkBtjBj17FM"), true);

let uulfCalls = 0;
let channelCalls = 0;
const feed404 = await resolveLatest(
  mockFetch({
    "playlist_id=UULF": async () => {
      uulfCalls += 1;
      return new Response("Error 404 (Not Found)!!1", { status: 404 });
    },
    "channel_id=": async () => {
      channelCalls += 1;
      return new Response("Error 404 (Not Found)!!1", { status: 404 });
    },
    "/data/latest.json": async () => jsonResponse(staticJson),
  }),
  { baseUrl: "https://playwhaly.com" },
);
assert.equal(feed404.source, "static");
assert.equal(feed404.cacheSeconds, 300);
assert.equal(feed404.payload.latest.url, staticJson.latest.url);
assert.equal(uulfCalls, 1);
assert.equal(channelCalls, 1);

const channelOnly = await resolveLatest(
  mockFetch({
    "playlist_id=UULF": async () => new Response("nope", { status: 404 }),
    "channel_id=": async () => new Response(sampleXml, { status: 200 }),
  }),
  { baseUrl: "https://playwhaly.com" },
);
assert.equal(channelOnly.source, "feed");
assert.equal(channelOnly.payload.more.length, 1);

const bothDead = await resolveLatest(
  mockFetch({
    "playlist_id=UULF": async () => new Response("nope", { status: 404 }),
    "channel_id=": async () => new Response("nope", { status: 404 }),
    "/data/latest.json": async () => new Response("missing", { status: 404 }),
  }),
  { baseUrl: "https://playwhaly.com" },
).then(
  () => "ok",
  (err) => err.message,
);
assert.equal(bothDead, "unavailable");

const post = await onRequest({
  request: new Request("https://playwhaly.com/api/latest", { method: "POST" }),
});
assert.equal(post.status, 405);

console.log("all latest-feed tests passed");
