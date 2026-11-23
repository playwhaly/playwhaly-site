import assert from "node:assert/strict";
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

console.log("all backlog tests passed");
