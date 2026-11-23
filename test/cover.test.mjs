import assert from "node:assert/strict";
import { coverPathFromUrl, coverProxyUrl, isCoverProxyUrl, loadCover } from "../functions/api/cover.js";

assert.equal(coverPathFromUrl("https://www.gamerpower.com/offers/1b/6aff1d0e4942d.jpg"), "/offers/1b/6aff1d0e4942d.jpg");
assert.equal(coverProxyUrl("https://www.gamerpower.com/offers/1b/6aff1d0e4942d.jpg"), "/api/cover?p=%2Foffers%2F1b%2F6aff1d0e4942d.jpg");
for (const bad of [
  "http://www.gamerpower.com/offers/1b/a.jpg",
  "https://evil.example/offers/1b/a.jpg",
  "https://www.gamerpower.com/api/giveaways",
  "https://www.gamerpower.com/offers/../secret.jpg",
  "https://www.gamerpower.com/offers/1b/a.jpg?x=1",
  "https://www.gamerpower.com/offers/1b/a.svg",
  "not a url",
]) assert.equal(coverProxyUrl(bad), "", bad);
assert.equal(isCoverProxyUrl("/api/cover?p=%2Foffers%2F1b%2Fa.jpg"), true);
assert.equal(isCoverProxyUrl("/api/cover?p=https://evil.example/x.jpg"), false);
assert.equal(isCoverProxyUrl("https://evil.example/api/cover?p=%2Foffers%2Fa.jpg"), false);

const png = new Uint8Array([137, 80, 78, 71]);
let calls = [];
const okFetch = async (url, init) => { calls.push([url, init.redirect]); return new Response(png, { status: 200, headers: { "content-type": "image/png", "set-cookie": "a=b" } }); };
let res = await loadCover("/offers/1b/a.png", okFetch, false);
assert.equal(res.status, 200);
assert.equal(res.headers.get("content-type"), "image/png");
assert.equal(res.headers.get("set-cookie"), null, "upstream cookies are not passed on");
assert.match(res.headers.get("cache-control"), /max-age=604800/);
assert.deepEqual(calls, [["https://www.gamerpower.com/offers/1b/a.png", "manual"]]);

calls = [];
res = await loadCover("//evil.example/a.png", okFetch, false);
assert.equal(res.status, 404);
assert.equal(calls.length, 0, "bad paths never reach the network");
res = await loadCover("/offers/1b/a.png", async () => new Response("<html>", { status: 200, headers: { "content-type": "text/html" } }), false);
assert.equal(res.status, 404, "non-image upstream answers are refused");
res = await loadCover("/offers/1b/a.png", async () => new Response(null, { status: 301, headers: { location: "https://evil.example" } }), false);
assert.equal(res.status, 404, "redirects are not followed");
res = await loadCover("/offers/1b/a.png", async () => { throw new Error("down"); }, false);
assert.equal(res.status, 404);
console.log("cover proxy tests passed");
