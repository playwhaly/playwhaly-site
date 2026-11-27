import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { parseCsv, isAllowedCsvUrl, gamesFromCsv, summarize, loadBacklog } from "../functions/api/backlog.js";

const rows = parseCsv('name_en,name_zh,status\n"Foo, Inc",測試,已完成\nBar,吧,未玩\n');
assert.deepEqual(rows[0], ["name_en", "name_zh", "status"]);
assert.equal(rows[1][0], "Foo, Inc");
assert.equal(rows[1][1], "測試");

assert.equal(isAllowedCsvUrl("https://docs.google.com/spreadsheets/d/abc/pub?output=csv"), true);
assert.equal(isAllowedCsvUrl("https://evil.example/csv"), false);
assert.equal(isAllowedCsvUrl("http://docs.google.com/spreadsheets/d/abc/pub?output=csv"), false);
assert.equal(isAllowedCsvUrl("https://user:pass@docs.google.com/spreadsheets/d/abc/pub?output=csv"), false);

const csv = [
  "name_en,name_zh,display_name,platforms,sources,status,completed_date,genres,release_date,public,notes,playtime,store_game_id",
  "Stardew Valley,星露谷物語,星露谷物語,PC · Switch,steam,未玩,,Simulator,26/02/2016,1,secret note,120,413150",
  "Celeste,Celeste,Celeste,PC,steam,已完成,2024-01-02,Platform,25/01/2018,yes,,40,504230",
  "Hidden,隱藏,隱藏,PC,steam,未玩,,Puzzle,01/01/2020,0,should drop,3,1",
  "Hades,黑帝斯,黑帝斯,PC,steam,遊玩中,,Role-playing (RPG),17/09/2020,,empty public,10,1145360",
  ",,,,steam,未玩,,,,1,empty name,0,",
].join("\n");
const games = gamesFromCsv(csv);
assert.equal(games.length, 3);
assert.equal(games[0].name_zh, "星露谷物語");
assert.equal(games[0].status, "未玩");
assert.equal(games[0].steam_appid, "413150");
assert.equal(games[0].store_url, "https://store.steampowered.com/app/413150/");
assert.equal("notes" in games[0], false);
assert.equal("playtime" in games[0], false);
assert.equal(games[1].status, "已完成");
const sum = summarize(games);
assert.equal(sum.stats.total, 3);
assert.equal(sum.stats.playing, 1);
assert.equal(sum.stats.completed, 1);
assert.equal(sum.stats.todo, 1);
assert.equal(sum.recentlyCompleted[0].name_en, "Celeste");

const unset = await loadBacklog(fetch, { csvUrl: "" });
assert.equal(unset.payload.ok, false);
assert.equal(unset.payload.reason, "unset");

const blocked = await loadBacklog(fetch, { csvUrl: "https://example.com/clean.csv" });
assert.equal(blocked.payload.ok, false);

const fetched = await loadBacklog(
  async () => ({
    ok: true,
    status: 200,
    text: async () => csv,
  }),
  { csvUrl: "https://docs.google.com/spreadsheets/d/abc/pub?output=csv", nowMs: Date.parse("2026-11-23T00:00:00.000Z") },
);
assert.equal(fetched.payload.ok, true);
assert.equal(fetched.payload.games.length, 3);
assert.equal(fetched.payload.stats.todo, 1);


assert.equal(games[1].completed_date, "2024-01-02");
const PUBLIC_KEYS = new Set([
  "name_zh", "name_en", "display_name", "platform", "status",
  "genre", "release_date", "completed_date", "steam_appid",
  "store_url", "store_label", "added_date",
]);
for (const game of games) {
  for (const key of Object.keys(game)) {
    assert.equal(PUBLIC_KEYS.has(key), true, "unexpected column " + key);
  }
  assert.equal("notes" in game, false);
  assert.equal("playtime" in game, false);
  assert.equal("playnite_id" in game, false);
  assert.equal("sources" in game, false);
  assert.equal("store_game_id" in game, false);
  assert.equal("public" in game, false);
}

assert.equal(fetched.cacheSeconds, 600);

const ctx = { window: {} };
ctx.window = ctx;
vm.runInNewContext(readFileSync(new URL("../public/games-util.js", import.meta.url), "utf8"), ctx);
const slice = ctx.PWGames.pageSlice(Array.from({ length: 120 }, (_, i) => i + 1), 2, 50);
assert.equal(slice.page, 2);
assert.equal(slice.pageSize, 50);
assert.equal(slice.total, 120);
assert.equal(slice.start, 51);
assert.equal(slice.end, 100);
assert.equal(slice.pages, 3);
assert.deepEqual(slice.items, Array.from({ length: 50 }, (_, i) => i + 51));
const clamped = ctx.PWGames.pageSlice([1, 2, 3], 99, 50);
assert.equal(clamped.page, 1);
assert.deepEqual(clamped.items, [1, 2, 3]);
assert.equal(ctx.PWGames.ALLOWED_PLATFORMS.join("|"),
  "PC (Windows)|Sony PlayStation 4|Sony PlayStation 5|Nintendo Switch");
assert.equal(ctx.PWGames.hasAllowedPlatform("PC · Switch"), true);
assert.equal(ctx.PWGames.hasAllowedPlatform("PS5"), true);
assert.equal(ctx.PWGames.hasAllowedPlatform("Xbox"), false);
// Nintendo Switch games show on /backlog and get their own filter entry.
assert.equal(ctx.PWGames.hasAllowedPlatform("Nintendo Switch"), true);
assert.equal(ctx.PWGames.hasAllowedPlatform("Switch · Xbox"), true);
assert.equal(ctx.PWGames.hasPlatform("Nintendo Switch", "Nintendo Switch"), true);
assert.equal(ctx.PWGames.hasPlatform("Nintendo Switch", "PC (Windows)"), false);
assert.equal(ctx.PWGames.hasPlatform("Steam", "Nintendo Switch"), false);
assert.equal(ctx.PWGames.allowedPlatformLabel("Nintendo Switch"), "Nintendo Switch");
// At most 4 genres are shown or offered as filters; the sheet may hold more.
assert.equal(ctx.PWGames.MAX_GENRES, 4);
assert.deepEqual([...ctx.PWGames.splitGenres("Adventure, Indie, Puzzle, Shooter, Strategy, Tactical")],
  ["Adventure", "Indie", "Puzzle", "Shooter"]);
assert.equal(ctx.PWGames.genresLabel("Adventure, Indie, Puzzle, Shooter, Strategy"), "冒險、獨立、解謎、射擊");
assert.equal(ctx.PWGames.genresLabel("Adventure"), "冒險");
assert.equal(ctx.PWGames.hasAllowedPlatform(""), false);
// The live Public tab names PC games by store; those are PC games, not hidden ones.
for (const store of ["Steam", "GOG", "Epic", "Amazon", "Ubisoft Connect", "Battle.net"]) {
  assert.equal(ctx.PWGames.hasAllowedPlatform(store), true, store);
  assert.equal(ctx.PWGames.hasPlatform(store, "PC (Windows)"), true, store);
  assert.equal(ctx.PWGames.hasPlatform(store, "Sony PlayStation 4"), false, store);
}
assert.equal(ctx.PWGames.hasAllowedPlatform("Sony PlayStation 3"), false);
assert.equal(ctx.PWGames.hasAllowedPlatform("Sony PlayStation 3 | Sony PlayStation Vita"), false);
assert.equal(ctx.PWGames.hasPlatform("PC · Sony PlayStation 4", "Sony PlayStation 4"), true);
assert.equal(ctx.PWGames.hasPlatform("PS5", "Sony PlayStation 5"), true);
assert.equal(ctx.PWGames.hasPlatform("Windows · Sony PlayStation 5", "Sony PlayStation 4"), false);
assert.equal(ctx.PWGames.statusLabel("放棄"), "放棄");
assert.equal(ctx.PWGames.statusLabel("dropped"), "放棄");
assert.match(ctx.PWGames.statusChip("放棄"), /status-dropped/);

assert.equal(isAllowedCsvUrl("https://doc-0s-bc-sheets.googleusercontent.com/pub/abc/def?output=csv"), true);
assert.equal(isAllowedCsvUrl("https://evil.example/csv"), false);
assert.equal(isAllowedCsvUrl("https://evilgoogleusercontent.com/x.csv"), false);

// The live Public tab header is "English name" (with a space); it must fill name_en.
{
  const live = gamesFromCsv([
    "顯示名稱,中文名,English name,平台,狀態,完成日期,影片連結,類型,store_game_id",
    "200% 混成汁 200% Mixed Juice!,200% 混成汁,200% Mixed Juice!,Steam,已完成,2021-09-29,,\"Adventure, Indie\",335190",
    "瘟疫傳說：無罪 A Plague Tale: Innocence,瘟疫傳說：無罪,A Plague Tale: Innocence,GOG,已完成,2021-07-26,,Adventure,1901367087",
  ].join("\n"));
  assert.equal(live.length, 2);
  assert.equal(live[0].name_en, "200% Mixed Juice!");
  assert.equal(live[0].name_zh, "200% 混成汁");
  assert.equal(live[0].platform, "Steam");
  assert.equal(live[1].name_en, "A Plague Tale: Innocence");
}

// /backlog table: 遊戲名稱 | 平台 | 類型 | 狀態, no 發行 column.
{
  const html = readFileSync(new URL("../public/backlog.html", import.meta.url), "utf8");
  const heads = [...html.matchAll(/<th class="col-([a-z]+)"[^>]*>([^<]+)<\/th>/g)].map((m) => m[2]);
  assert.deepEqual(heads, ["遊戲名稱", "平台", "類型", "狀態"]);
  assert.equal(html.includes("col-release"), false);
  assert.equal(html.includes("發行"), false);
}

// 加入日期 → added_date (YYYY-MM-DD), parsed robustly; /backlog sorts newest added first.
{
  const { normalizeDate } = await import("../functions/api/backlog.js");
  assert.equal(normalizeDate("2026-11-22"), "2026-11-22");
  assert.equal(normalizeDate("2026/11/7"), "2026-11-07");
  assert.equal(normalizeDate("2026-11-27 10:16:00"), "2026-11-27");
  assert.equal(normalizeDate("22-Nov-2026"), "2026-11-22");
  assert.equal(normalizeDate("22/11/2026"), "2026-11-22");
  assert.equal(normalizeDate("46348"), "2026-11-22");
  assert.equal(normalizeDate(""), "");
  assert.equal(normalizeDate("soon"), "");
  assert.equal(normalizeDate("2026-02-30"), "");

  const withAdded = gamesFromCsv([
    "顯示名稱,中文名,English name,平台,狀態,完成日期,影片連結,類型,store_game_id,加入日期",
    "乙 B,乙,B,Steam,未玩,,,Indie,1,2026-11-22",
    "甲 A,甲,A,Steam,未玩,,,Indie,2,2026-11-22",
    "新 New,新,New,PS5,未玩,,,Indie,CUSA1,2026-11-27",
    "無 None,無,None,GOG,未玩,,,Indie,3,",
    "壞 Bad,壞,Bad,Epic,未玩,,,Indie,4,not a date",
  ].join("\n"));
  assert.equal(withAdded[0].added_date, "2026-11-22");
  assert.equal("added_date" in withAdded[3], false);
  assert.equal("added_date" in withAdded[4], false);
  const sorted = ctx.PWGames.sortByAdded(withAdded).map((g) => g.name_en);
  assert.equal(sorted[0], "New", "newest added first");
  assert.deepEqual(sorted.slice(1, 3), ctx.PWGames.sortByAdded([withAdded[0], withAdded[1]]).map((g) => g.name_en), "ties by name, stable");
  assert.deepEqual(sorted.slice(3).sort(), ["Bad", "None"], "blank dates last");
  assert.equal(withAdded.map((g) => g.name_en).join(), "B,A,New,None,Bad", "sortByAdded does not mutate");

  // No date column on the page.
  const html = readFileSync(new URL("../public/backlog.html", import.meta.url), "utf8");
  assert.equal(html.includes("加入日期"), false);
}

console.log("all backlog tests passed");

// ?view=stats keeps only the counts for the home page.
{
  const { statsView } = await import("../functions/api/backlog.js");
  const small = statsView({ ok: true, updatedAt: "x", stats: { total: 2 }, playing: [1], recentlyCompleted: [2], games: [1, 2] });
  assert.deepEqual(small, { ok: true, updatedAt: "x", stats: { total: 2 } });
  assert.deepEqual(statsView({ ok: false, reason: "unset" }), { ok: false, reason: "unset" });
  console.log("stats view tests passed");
}
