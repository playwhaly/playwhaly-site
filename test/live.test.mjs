import assert from "node:assert/strict";
import { checkLive, resetTokenCache, onRequest } from "../functions/api/live.js";

const calls = [];
function mk(streamData, { tokenStatus = 200, helixStatus = 200 } = {}) {
  return async (url, init) => {
    calls.push(String(url));
    if (String(url).startsWith("https://id.twitch.tv/oauth2/token")) {
      return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: tokenStatus });
    }
    if (String(url).startsWith("https://api.twitch.tv/helix/streams")) {
      assert.equal(init.headers["Client-Id"], "id");
      assert.equal(init.headers.Authorization, "Bearer tok");
      return new Response(JSON.stringify({ data: streamData }), { status: helixStatus });
    }
    return new Response("no", { status: 404 });
  };
}
const env = { TWITCH_CLIENT_ID: "id", TWITCH_CLIENT_SECRET: "secret" };

resetTokenCache();
assert.deepEqual(await checkLive({}, mk([])), { live: false, configured: false }, "no env: offline, not configured");
assert.equal(calls.length, 0, "no network without credentials");

assert.deepEqual(await checkLive(env, mk([{ type: "live" }])), { live: true, configured: true });
assert.deepEqual(await checkLive(env, mk([])), { live: false, configured: true });
assert.equal(calls.filter((c) => c.includes("oauth2/token")).length, 1, "app token is cached between checks");
assert.equal(calls.some((c) => c.includes("user_login=playwhaly")), true, "default channel");

resetTokenCache();
await assert.rejects(checkLive(env, mk([], { helixStatus: 500 })), /helix 500/);

// the response never contains secrets
const res = await onRequest({
  request: new Request("https://playwhaly.com/api/live"),
  env: {}, // no credentials: no network call is made
  waitUntil() {},
});
const text = await res.text();
assert.equal(text, '{"live":false}');
assert.equal(res.status, 200);
assert.equal((await onRequest({ request: new Request("https://playwhaly.com/api/live", { method: "POST" }), env })).status, 405);
console.log("all live tests passed");
