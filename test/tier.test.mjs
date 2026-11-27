import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  tierGamesFromCsv, videosFromCsv, attachVideos, steamAppIdFor, looseKey, isoDate, videoType,
  firstBracket, bracketCandidates, buildPayload, loadTier, statsView, coverAppIdFor, coverUrlFor,
  storeUrlFor, storeLabelFor,
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
assert.equal(by["The Forest"].store_label, "在 Steam 看看");
assert.equal(by["Red Dead Redemption"].steam_appid, undefined, "PS ids are never Steam");
assert.equal(by["Assassin's Creed Unity"].steam_appid, undefined, "numeric non-Steam ids are never Steam");
assert.equal(by["Mycelium: The Silent Contract"].name_zh, "", "no invented Chinese name");
assert.equal(by["New Popup Game"].notes_en, "English only review");
assert.equal(by["New Popup Game"].notes_zh, "", "no auto-translation");
for (const g of games) {
  for (const k of Object.keys(g)) {
    assert.ok(["year", "name_zh", "name_en", "tier", "notes_zh", "notes_en", "steam_appid", "store_url", "store_label", "store_status", "cover"].includes(k), k);
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
  assert.equal(c["Diablo IV"].store_url, "https://store.steampowered.com/app/2344520/", "cover_steam_appid games fall back to their Steam page");
  assert.equal(c["Diablo IV"].store_label, "在 Steam 看看");
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
assert.equal(steamAppIdFor("1724969043", "Steam"), "", "10-digit GOG-style ids are not Steam app ids");
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
  assert.equal(c["Diablo IV"].steam_appid, "2344520", "cover_steam_appid still supplies the Steam id");
  assert.equal(c["Diablo IV"].cover, ps, "an allowlisted cover_url is also emitted when a steam_appid is present");
  assert.equal(c["The Forest"].steam_appid, "242760");
  assert.equal(c["The Forest"].cover, ps, "an explicit cover_url is preferred over a constructed Steam header");
  for (const n of ["Http Cover", "Evil Host", "Lookalike Host", "Script Cover", "Userinfo Cover", "Quote Cover", "Port Cover"]) {
    assert.equal(c[n].cover, undefined, n);
  }
  assert.equal(coverUrlFor(""), "");
  assert.equal(coverUrlFor("https://IMAGE.API.PLAYSTATION.COM/a.png"), "https://image.api.playstation.com/a.png");
  assert.equal(coverUrlFor("https://image.api.playstation.com/a b.png"), "");
}


// store_url: official store page of the platform played, allowlisted hosts, label from the host.
{
  const ps = "https://store.playstation.com/zh-hant-tw/product/HP9000-PPSA01287_00-RETURNALGAME0001";
  const nin = "https://www.nintendo.com/us/store/products/animal-crossing-new-horizons-switch/";
  const epic = "https://store.epicgames.com/zh-Hant/p/among-us";
  const gog = "https://www.gog.com/en/game/doom_2016";
  const ubi = "https://store.ubisoft.com/us/assassins-creed-unity/56c4948881105a1e3c8b4567.html";
  const xbox = "https://www.xbox.com/zh-tw/games/store/minecraft-java-bedrock-edition-for-pc/9nxp44l49shj";
  const ea = "https://www.ea.com/games/ufc/ufc-6";
  const games = tierGamesFromCsv([
    "year,name_zh,name_en,tier,notes_en,notes_zh,store_game_id,platform,cover_steam_appid,cover_url,store_url",
    "2021,回歸,Returnal,S,,讚,PPSA01287_00,PS5,1649240,," + ps,
    "2021,動森,Animal Crossing: New Horizons,A,,島,,Nintendo Switch,,," + nin,
    "2019,太空狼人殺,Among Us,B,,好玩,963137e4c29d4c79a81323b8fab03a40,Epic,945360,," + epic,
    "2018,毀滅戰士,Doom,A,,讚,1390579243,GOG,379720,," + gog,
    "2015,大革命,Assassin's Creed Unity,B,,x,720,Ubisoft Connect,289650,," + ubi,
    "2021,當個創世神,Minecraft,A,,沙盒,,,,," + xbox,
    "2026,UFC 6,EA Sports UFC 6,C,,生涯,PPSA23566_00,PS5,,," + ea,
    "2026,暗黑破壞神 4,Diablo IV,B,,打寶,Fen,Battle.net,2344520,,",
    "2026,陰森,The Forest,A,,黑,242760,Steam,,,https://store.playstation.com/zh-hant-tw/product/FAKE",
    "2019,古墓奇兵,Tomb Raider: Game of the Year Edition,B,,x,1724969043,Steam,,,",
    "2025,壞1,Http Store,B,,x,CUSA1,PS4,,,http://store.playstation.com/product/x",
    "2025,壞2,Evil Store,B,,x,CUSA1,PS4,,,https://evil.example/x",
    "2025,壞3,Lookalike Store,B,,x,CUSA1,PS4,,,https://store.playstation.com.evil.example/x",
    "2025,壞4,Userinfo Store,B,,x,CUSA1,PS4,,,https://a@store.playstation.com/product/x",
    "2025,壞5,Port Store,B,,x,CUSA1,PS4,,,https://store.playstation.com:8443/product/x",
  ].join("\n"));
  const c = Object.fromEntries(games.map((g) => [g.name_en, g]));
  assert.equal(c["Returnal"].store_url, ps);
  assert.equal(c["Returnal"].store_label, "在 PlayStation Store 看看");
  assert.equal(c["Returnal"].steam_appid, "1649240", "a platform store link keeps the Steam cover");
  assert.equal(c["Animal Crossing: New Horizons"].store_url, nin);
  assert.equal(c["Animal Crossing: New Horizons"].store_label, "在 Nintendo eShop 看看");
  assert.equal(c["Among Us"].store_label, "在 Epic 看看");
  assert.equal(c["Doom"].store_label, "在 GOG 看看");
  assert.equal(c["Assassin's Creed Unity"].store_label, "在 Ubisoft Store 看看");
  assert.equal(c["Minecraft"].store_label, "在 Microsoft Store 看看");
  assert.equal(c["EA Sports UFC 6"].store_label, "在 EA 看看");
  assert.equal(c["Diablo IV"].store_url, "https://store.steampowered.com/app/2344520/", "no official Battle.net host: fall back to Steam");
  assert.equal(c["Diablo IV"].store_label, "在 Steam 看看");
  assert.equal(c["The Forest"].store_url, "https://store.playstation.com/zh-hant-tw/product/FAKE");
  assert.equal(c["The Forest"].store_label, "在 PlayStation Store 看看", "a valid sheet store_url wins over the Steam-platform id");
  assert.equal(c["The Forest"].steam_appid, "242760");
  assert.equal(c["Tomb Raider: Game of the Year Edition"].steam_appid, undefined, "a 10-digit id is not a Steam app id");
  assert.equal(c["Tomb Raider: Game of the Year Edition"].store_url, undefined);
  for (const n of ["Http Store", "Evil Store", "Lookalike Store", "Userinfo Store", "Port Store"]) {
    assert.equal(c[n].store_url, undefined, n);
    assert.equal(c[n].store_label, undefined, n);
  }
  assert.equal(storeUrlFor(""), "");
  assert.equal(storeUrlFor("https://WWW.GOG.COM/en/game/doom_2016"), "https://www.gog.com/en/game/doom_2016");
  assert.equal(storeUrlFor("https://gog.com/en/game/doom_2016"), "https://www.gog.com/en/game/doom_2016");
  assert.equal(storeLabelFor("https://store.epicgames.com/zh-Hant/p/among-us"), "在 Epic 看看");
  assert.equal(storeUrlFor("https://www.ubisoft.com/game/x"), "", "www.ubisoft.com is not the store host");
}


// An allowlisted cover_url is preferred in the payload even when a Steam id is present.
{
  const header = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4025700/2228fe487077813485fe804a4f8311c289d69901/header_alt_assets_1.jpg?t=1794428767";
  const games = tierGamesFromCsv([
    "year,name_zh,name_en,tier,notes_en,notes_zh,store_game_id,platform,cover_steam_appid,cover_url",
    "2026,心動小鎮,Heartopia,A,,可愛,4025700,Steam,," + header,
  ].join("\n"));
  assert.equal(games[0].steam_appid, "4025700");
  assert.equal(games[0].cover, header);
}

// store_url: Steam /sub/, PlayStation /concept/, www.playstation.com, and an explicit delisted marker.
{
  const sub = "https://store.steampowered.com/sub/31292/";
  const concept = "https://store.playstation.com/en-sg/concept/232283";
  const psSite = "https://www.playstation.com/en-sg/games/alan-wake-remastered/";
  const ms = "https://apps.microsoft.com/detail/9n9dkmnl85xz";
  const games = tierGamesFromCsv([
    "year,name_zh,name_en,tier,notes_en,notes_zh,store_game_id,platform,cover_steam_appid,cover_url,store_url",
    "2018,冤罪殺機 決定版,Dishonored: Definitive Edition,A,,x,1724969043,Steam,,," + sub,
    "2019,卡拉邦,Caravan Stories,C,,x,CUSA1,PS4,,," + concept,
    "2023,心靈殺手 復刻版,Alan Wake Remastered,B,,x,CUSA2,PS5,,," + psSite,
    "2019,暗黑破壞神 3,Diablo III: Ultimate Evil Edition,A,,x,CUSA3,PS4,,," + ms,
    "2015,駕駛俱樂部,Driveclub,C,,x,CUSA4,PS4,,,delisted",
    "2016,鋼彈 激戰任務,Gundam Battle Operation Next,C,,x,123456,Steam,,,DELISTED",
    "2016,天命,Destiny,A,,x,CUSA5,PS4,,,https://store.playstation.com/en-sg/product/UP0002-CUSA00219_00-ASIAOLLECTION001",
  ].join("\n"));
  const c = Object.fromEntries(games.map((g) => [g.name_en, g]));
  assert.equal(c["Dishonored: Definitive Edition"].store_url, sub);
  assert.equal(c["Dishonored: Definitive Edition"].store_label, "在 Steam 看看");
  assert.equal(c["Caravan Stories"].store_url, concept);
  assert.equal(c["Caravan Stories"].store_label, "在 PlayStation Store 看看");
  assert.equal(c["Alan Wake Remastered"].store_url, psSite);
  assert.equal(c["Alan Wake Remastered"].store_label, "在 PlayStation 看看");
  assert.equal(c["Diablo III: Ultimate Evil Edition"].store_url, ms);
  assert.equal(c["Diablo III: Ultimate Evil Edition"].store_label, "在 Microsoft Store 看看");
  assert.equal(c["Driveclub"].store_status, "delisted");
  assert.equal(c["Driveclub"].store_label, "已下架");
  assert.equal(c["Driveclub"].store_url, undefined, "a delisted marker never becomes a link");
  assert.equal(c["Gundam Battle Operation Next"].store_status, "delisted");
  assert.equal(c["Gundam Battle Operation Next"].store_url, undefined, "delisted wins over a Steam-id fallback");
  assert.equal(c["Gundam Battle Operation Next"].steam_appid, "123456");
  assert.equal(storeUrlFor(sub), sub, "Steam /sub/ paths are accepted");
  assert.equal(storeUrlFor(concept), concept, "PlayStation /concept/ paths are accepted");
  assert.equal(storeUrlFor(psSite), psSite);
  assert.equal(storeLabelFor(psSite), "在 PlayStation 看看");
}

const tierJs = readFileSync(new URL("../public/tier.js", import.meta.url), "utf8");
assert.match(tierJs, /store_label/);
assert.match(tierJs, /在 Steam 看看/);
const utilJs = readFileSync(new URL("../public/games-util.js", import.meta.url), "utf8");
assert.match(utilJs, /if \(g && g\.cover\) return g\.cover/, "the client prefers an explicit cover over a constructed Steam header");
assert.match(tierJs, /store_status === "delisted"/);
assert.match(tierJs, /is-delisted/);
assert.match(tierJs, /已下架/);
// /tier shows only the Chinese review. The original-language note is never rendered,
// even when it is the only review in the sheet.
assert.doesNotMatch(tierJs, /g\.notes_en/);
assert.doesNotMatch(tierJs, /原文/);
assert.doesNotMatch(tierJs, /is-orig/);
assert.doesNotMatch(tierJs, /tier-note-lab/);
assert.match(tierJs, /notes_zh/);
{
  const m = tierJs.match(/function notesHtml\(g\) \{[\s\S]*?\n  \}/);
  assert.ok(m, "notesHtml is present");
  const notesHtml = new Function("esc", m[0] + "; return notesHtml;")(function (s) { return String(s); });
  assert.equal(notesHtml({ notes_zh: "洞裡黑到靠北", notes_en: "cave too dark" }), '<p class="tier-note">洞裡黑到靠北</p>');
  assert.equal(notesHtml({ notes_zh: "", notes_en: "English only review" }), "", "English-only review is hidden");
  assert.equal(notesHtml({ notes_zh: "   ", notes_en: "x" }), "", "blank Chinese review shows nothing");
  const both = notesHtml({ notes_zh: "讚", notes_en: "nice" });
  assert.equal(both.includes("nice"), false);
  assert.equal(both.includes("原文"), false);
}
