import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  tierGamesFromCsv, videosFromCsv, attachVideos, steamAppIdFor, looseKey, isoDate, videoType,
  firstBracket, bracketCandidates, buildPayload, loadTier, statsView, coverAppIdFor, coverUrlFor,
} from "../functions/api/tier.js";

const TIER = [
  "year,name_zh,name_en,tier,notes_en,notes_zh,store_game_id,platform",
  "2026,陰森,The Forest,A,cave too dark,洞裡黑到靠北,242760,Steam",
  "2026,喪屍交易所,The Walking Trade,B,Addictive,很上癮,3398110,Steam",
  "2026,,Mycelium: The Silent Contract,B,,很燒腦,,Epic",
  "2026,,New Popup Game,C,English only review,,,",
  "2026,大鏢客,Red Dead Redemption,S,,神作,CUSA03041_00,PS4",
  "2025,刺客教條：大革命,Assassin's Creed Unity,B,,還行,720,Ubisoft Connect",
  "2025,,Species: Unknown,C,,怪怪的,1234,Steam",
  "2024,,REPO,A,,好笑,3241660,Steam",
  "2024,壞資料,Bad Tier,Z,,x,1,Steam",
  "abc,壞年份,Bad Year,A,,x,1,Steam",
  "2023,,,A,,沒名字,1,Steam",
].join("\n");

const UPLOADED = [
  "Title,Date,Duration,Type,URL",
  "2020,,,,1",
  "《陰森 The Forest》EP.1,18-May-2021,0:03:43,Long Form,https://www.youtube.com/watch?v=aaa",
  "《陰森 The Forest》EP.2,2026-11-01 10:00:00,0:20:00,Long Form,https://www.youtube.com/watch?v=bbb",
  "【直播】《陰森 The Forest》,2026-11-02 10:00:00,2:00:00,Live,https://www.youtube.com/watch?v=ccc",
  "《Mycelium: The Silent Contract》直播,2026-10-01 10:00:00,0:00:00,Stream,https://www.youtube.com/watch?v=ddd",
  "比較《The Forest》跟《喪屍交易所 The Walking Trade》,2026-10-02 10:00:00,0:10:00,Long Form,https://youtu.be/eee",
  "《Species Unknown》試玩,2025-01-01,0:12:00,Long Form,https://youtu.be/fff",
  "《R.E.P.O.》好好笑,2024-05-01,0:12:00,Long Form,https://youtu.be/ggg",
  "糞GAME之夜 The Forest,2021-06-13,0:12:00,Long Form,https://youtu.be/hhh",
  "《陰森 The Forest》假連結,2021-06-13,0:12:00,Long Form,https://evil.example/watch",
].join("\n");

// rows
const games = tierGamesFromCsv(TIER);
assert.equal(games.length, 8, "bad year / tier / blank name rows are skipped");
const by = Object.fromEntries(games.map((g) => [g.name_en, g]));
assert.equal(by["The Forest"].steam_appid, "242760");
assert.equal(by["The Forest"].store_url, "https://store.steampowered.com/app/242760/");
assert.equal(by["Red Dead Redemption"].steam_appid, undefined, "PS ids are never Steam");
assert.equal(by["Assassin's Creed Unity"].steam_appid, undefined, "numeric non-Steam ids are never Steam");
assert.equal(by["Mycelium: The Silent Contract"].name_zh, "", "no invented Chinese name");
assert.equal(by["New Popup Game"].notes_en, "English only review");
assert.equal(by["New Popup Game"].notes_zh, "", "no auto-translation");
for (const g of games) {
  for (const k of Object.keys(g)) {
    assert.ok(["year", "name_zh", "name_en", "tier", "notes_zh", "notes_en", "steam_appid", "store_url", "cover"].includes(k), k);
  }
}

// cover_steam_appid: a cover for games played off Steam, without a Steam store link.
{
  const withCover = tierGamesFromCsv([
    "year,name_zh,name_en,tier,notes_en,notes_zh,store_game_id,platform,cover_steam_appid",
    "2026,暗黑破壞神 4,Diablo IV,B,,好玩,Fen,Battle.net,2344520",
    "2026,控制,Control,A,,讚,PPSA34547_00,PS5, 870780 ",
    "2026,陰森,The Forest,A,,黑,242760,Steam,999999",
    "2025,寶可夢,Pokemon UNITE,B,,亂,,Nintendo Switch,",
    "2025,壞,Bad Cover,B,,x,CUSA1,PS4,abc123",
    "2025,壞2,Bad Cover 2,B,,x,CUSA1,PS4,https://evil.example/1.jpg",
    "2025,大革命,Assassin's Creed Unity,B,,x,720,Ubisoft Connect,289650",
  ].join("\n"));
  const c = Object.fromEntries(withCover.map((g) => [g.name_en, g]));
  assert.equal(c["Diablo IV"].steam_appid, "2344520");
  assert.equal(c["Diablo IV"].store_url, undefined, "fallback covers never add a Steam store link");
  assert.equal(c["Control"].steam_appid, "870780");
  assert.equal(c["The Forest"].steam_appid, "242760", "the Steam-platform id wins over the fallback");
  assert.equal(c["The Forest"].store_url, "https://store.steampowered.com/app/242760/");
  assert.equal(c["Pokemon UNITE"].steam_appid, undefined, "blank fallback stays a text card");
  assert.equal(c["Bad Cover"].steam_appid, undefined);
  assert.equal(c["Bad Cover 2"].steam_appid, undefined);
  assert.equal(c["Assassin's Creed Unity"].steam_appid, "289650");
  assert.equal(coverAppIdFor(" 123 "), "123");
  assert.equal(coverAppIdFor("12.5"), "");
  assert.equal(coverAppIdFor(""), "");
}

// helpers
assert.equal(steamAppIdFor("123", ""), "123");
assert.equal(steamAppIdFor("123", "GOG"), "");
assert.equal(steamAppIdFor("CUSA1", "Steam"), "");
assert.equal(looseKey("Species: Unknown"), looseKey("Species Unknown"));
assert.equal(looseKey("R.E.P.O."), looseKey("REPO"));
assert.equal(isoDate("21-Dec-2020"), "2020-12-21");
assert.equal(isoDate("2026-11-27 10:16:00"), "2026-11-27");
assert.equal(videoType("Stream"), "live");
assert.equal(videoType("Live"), "live");
assert.equal(videoType("Long Form"), "long");
assert.equal(videoType("Shorts"), "short");
assert.equal(firstBracket("比較《A》跟《B》"), "A");
assert.deepEqual(bracketCandidates("刺客任務 3 Hitman 3"), ["刺客任務 3 Hitman 3", "Hitman 3", "刺客任務 3"]);

// videos
const vids = videosFromCsv(UPLOADED);
assert.equal(vids.length, 8, "year headers and non-YouTube links are dropped");
attachVideos(games, vids);
const forest = by["The Forest"].videos;
// Long Form newest first, then Live. "比較《The Forest》跟《…》" counts for The Forest (its FIRST 《》).
assert.deepEqual(forest.map((v) => v.url), [
  "https://www.youtube.com/watch?v=bbb",
  "https://youtu.be/eee",
  "https://www.youtube.com/watch?v=aaa",
  "https://www.youtube.com/watch?v=ccc",
]);
assert.equal(forest[0].type, "long", "latest Long Form first");
assert.equal(forest[3].type, "live");
assert.equal(by["The Forest"].videos.some((v) => v.url === "https://youtu.be/hhh"), false, "no guessing from a bare title");
assert.equal(by["The Walking Trade"].videos, undefined, "only the first 《》 decides");
assert.equal(by["Mycelium: The Silent Contract"].videos[0].type, "live");
assert.equal(by["Species: Unknown"].videos[0].url, "https://youtu.be/fff");
assert.equal(by["REPO"].videos[0].url, "https://youtu.be/ggg");
assert.equal(by["Red Dead Redemption"].videos, undefined);

// payload
const p = buildPayload(games, Date.parse("2026-11-27T00:00:00Z"));
assert.deepEqual(p.years, [2026, 2025, 2024]);
assert.equal(p.stats.total, 8);
assert.equal(p.stats.byYear[2026], 5);
assert.deepEqual(p.games.filter((g) => g.year === 2026).map((g) => g.tier), ["S", "A", "B", "B", "C"]);
assert.deepEqual(statsView(p), { ok: true, updatedAt: p.updatedAt, years: p.years, stats: p.stats });

// loader
const fakeFetch = async (url) => ({ ok: true, status: 200, text: async () => (url.includes("gid=1") ? TIER : UPLOADED) });
const ok = await loadTier(fakeFetch, { tierUrl: "https://docs.google.com/s/pub?gid=1", uploadedUrl: "https://docs.google.com/s/pub?gid=2" });
assert.equal(ok.payload.ok, true);
assert.equal(ok.cacheSeconds, 600);
assert.equal(ok.payload.games.find((g) => g.name_en === "The Forest").videos.length >= 3, true);
assert.equal((await loadTier(fakeFetch, { tierUrl: "" })).payload.reason, "unset");
assert.equal((await loadTier(fakeFetch, { tierUrl: "https://evil.example/x.csv" })).payload.reason, "unset");
const down = await loadTier(async () => ({ ok: false, status: 500, text: async () => "" }), { tierUrl: "https://docs.google.com/s/pub?gid=1" });
assert.equal(down.payload.ok, false);
assert.equal(down.payload.reason, "unreachable");
const noVideos = await loadTier(async (url) => {
  if (url.includes("gid=2")) throw new Error("down");
  return { ok: true, status: 200, text: async () => TIER };
}, { tierUrl: "https://docs.google.com/s/pub?gid=1", uploadedUrl: "https://docs.google.com/s/pub?gid=2" });
assert.equal(noVideos.payload.ok, true, "tiers still show when the video CSV is down");
assert.equal(noVideos.payload.games.some((g) => g.videos), false);

// page wiring
const html = readFileSync(new URL("../public/tier.html", import.meta.url), "utf8");
assert.match(html, /<html lang="zh-Hant">/);
assert.match(html, /<link rel="canonical" href="https:\/\/playwhaly.com\/tier">/);
assert.match(html, /aria-current="page" href="\/tier">遊戲分級</);
for (const f of ["index.html", "free.html", "backlog.html", "spin.html"]) {
  assert.match(readFileSync(new URL("../public/" + f, import.meta.url), "utf8"), /href="\/tier">遊戲分級</, f);
}
assert.match(readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8"), /<loc>https:\/\/playwhaly.com\/tier<\/loc>/);
const blob = ["tier.html", "tier.js"].map((f) => readFileSync(new URL("../public/" + f, import.meta.url), "utf8")).join("\n")
  + readFileSync(new URL("../functions/api/tier.js", import.meta.url), "utf8");
assert.equal(/kumimo|tailnet|tailscale|Weng|\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|[A-Z]:\\\\/i.test(blob), false, "no career or private host text");

console.log("all tier tests passed");

// cover_url: an official image for games with no Steam cover, allowlisted hosts and https only.
{
  const nin = "https://assets.nintendo.com/image/upload/c_fill,w_1200/q_auto/f_auto/store/software/switch/70010000043292/91e3";
  const ps = "https://image.api.playstation.com/vulcan/img/rnd/202011/0713/WSZqsrnejjt85wYmUqeBQvMQ.png?w=960";
  const games = tierGamesFromCsv([
    "year,name_zh,name_en,tier,notes_en,notes_zh,store_game_id,platform,cover_steam_appid,cover_url",
    "2020,血源詛咒,Bloodborne,S,,讚,CUSA00207_00,PS4,," + ps,
    "2021,寶可夢大集結,Pokémon UNITE,B,,亂,,Nintendo Switch,,\"" + nin + "\"",
    "2026,暗黑破壞神 4,Diablo IV,B,,好玩,Fen,Battle.net,2344520," + ps,
    "2026,陰森,The Forest,A,,黑,242760,Steam,," + ps,
    "2025,壞1,Http Cover,B,,x,CUSA1,PS4,,http://image.api.playstation.com/x.png",
    "2025,壞2,Evil Host,B,,x,CUSA1,PS4,,https://evil.example/x.png",
    "2025,壞3,Lookalike Host,B,,x,CUSA1,PS4,,https://image.api.playstation.com.evil.example/x.png",
    "2025,壞4,Script Cover,B,,x,CUSA1,PS4,,javascript:alert(1)",
    "2025,壞5,Userinfo Cover,B,,x,CUSA1,PS4,,https://a@image.api.playstation.com/x.png",
    "2025,壞6,Quote Cover,B,,x,CUSA1,PS4,,\"https://image.api.playstation.com/x.png\"\"onerror=alert(1)\"",
    "2025,壞7,Port Cover,B,,x,CUSA1,PS4,,https://image.api.playstation.com:8443/x.png",
  ].join("\n"));
  const c = Object.fromEntries(games.map((g) => [g.name_en, g]));
  assert.equal(c["Bloodborne"].cover, ps);
  assert.equal(c["Bloodborne"].steam_appid, undefined);
  assert.equal(c["Bloodborne"].store_url, undefined, "a cover_url never adds a store link");
  assert.equal(c["Pokémon UNITE"].cover, nin, "a quoted URL with commas survives the CSV");
  assert.equal(c["Diablo IV"].steam_appid, "2344520", "cover_steam_appid wins over cover_url");
  assert.equal(c["Diablo IV"].cover, undefined);
  assert.equal(c["The Forest"].steam_appid, "242760", "a Steam row keeps its own cover");
  assert.equal(c["The Forest"].cover, undefined);
  for (const n of ["Http Cover", "Evil Host", "Lookalike Host", "Script Cover", "Userinfo Cover", "Quote Cover", "Port Cover"]) {
    assert.equal(c[n].cover, undefined, n);
  }
  assert.equal(coverUrlFor(""), "");
  assert.equal(coverUrlFor("https://IMAGE.API.PLAYSTATION.COM/a.png"), "https://image.api.playstation.com/a.png");
  assert.equal(coverUrlFor("https://image.api.playstation.com/a b.png"), "");
}

