import assert from "node:assert/strict";
import { createRequire } from "node:module";
const PW = createRequire(import.meta.url)("../public/lib.js");
const cfg = { anchor: "2026-11-06", everyDays: 14, lastUpload: "2026-11-06" };

assert.equal(PW.nextLongVideo({ ...cfg, today: "2026-11-16" }).text, "下一部長片：11月20日（五）");
assert.equal(PW.nextLongVideo({ ...cfg, today: "2026-11-20" }).text, "下一部長片：11月20日（五）", "on the Friday itself");
assert.equal(PW.nextLongVideo({ ...cfg, today: "2026-11-21" }).text, "新影片準備中", "Saturday, no upload yet");
assert.equal(PW.nextLongVideo({ ...cfg, today: "2026-11-21", lastUpload: "2026-11-20" }).text, "下一部長片：12月4日（五）", "uploaded on time");
assert.equal(PW.nextLongVideo({ ...cfg, today: "2026-12-04" }).text, "下一部長片：12月4日（五）");
assert.equal(PW.sgtDay("2026-11-06T10:45:37.000Z"), "2026-11-06");
assert.equal(PW.sgtDay("2026-11-06T17:00:00.000Z"), "2026-11-07", "UTC evening is next day in SGT");
assert.equal(PW.formatMD("2026-10-23T10:45:19.000Z"), "10月23日");
assert.equal(PW.gameFromTitle("《Core Keeper 核心守護者》從零開始！"), "核心守護者 Core Keeper", "old label maps to the Bahamut name");
assert.equal(PW.gameFromTitle("我們快餓死了 | 饑荒聯機版 Don't Starve Together 搞笑片段精華 EP.8"), "饑荒聯機版 Don't Starve Together", "no 《》: listed name found in the title");
assert.equal(PW.gameFromTitle("沒有遊戲名的標題"), "");
assert.equal(PW.gameFromTitle("《測試遊戲 Test Game》開場測試"), "測試遊戲 Test Game", "new games keep the full 《》 text on card tags");
assert.equal(PW.gameFromTitle("《陰森 The Forest》這根本是恐怖遊戲！"), "陰森 The Forest");
assert.equal(PW.gameFromTitle("《麥塊 Minecraft》舊名"), "當個創世神 Minecraft", "aliases map to the current name");
assert.equal(PW.videoId("https://www.youtube.com/watch?v=gkBtjBj17FM"), "gkBtjBj17FM");

// Bug 1: "Where the forest ends" must not become The Forest
assert.equal(PW.gameFromTitle("《森林盡頭 Where the forest ends》第一集"), "森林盡頭 Where the forest ends");
assert.equal(PW.gameChipFromTitle("《森林盡頭 Where the forest ends》第一集").query, "Where the forest ends");
assert.equal(PW.gameFromTitle("沒有括號 Where the forest ends 好玩"), "森林盡頭 Where the forest ends", "longest listed name wins");
assert.equal(PW.englishGameName("森林盡頭 Where the forest ends"), "Where the forest ends");

// Bug 2: a second 《》 (Project Zomboid) must not swallow the first game
const humanitzOld = "這是關於我的《HumanitZ》殭屍遊戲體驗！一款連《殭屍毀滅工程 Project Zomboid》官方都極力推薦的殭屍遊戲！";
assert.equal(PW.gameChipFromTitle(humanitzOld).label, "HumanitZ");
assert.equal(PW.gameFromTitle(humanitzOld), "HumanitZ");
assert.deepEqual(PW.newGamesFromTitles(["《全新殭屍遊戲 New Zed》比《殭屍毀滅工程 Project Zomboid》還難"]), [{ label: "全新殭屍遊戲 New Zed", query: "New Zed" }]);
assert.equal(PW.gameChipFromTitle("《Forewarned》金字塔版《恐鬼症》").label, "Forewarned");
assert.equal(PW.gameChipFromTitle("這小鎮不對勁！《怪奇鎮生存指南 I Hate This Place》彷彿闖入《怪奇物語》").label, "怪奇鎮生存指南 I Hate This Place");

// English search names: no stray leading numbers or Chinese
assert.equal(PW.englishGameName("殭屍毀滅工程 Project Zomboid"), "Project Zomboid");
assert.equal(PW.englishGameName("刺客任務 3 Hitman 3"), "Hitman 3");
assert.equal(PW.englishGameName("新作 7 Some Game 7"), "Some Game 7");
assert.equal(PW.englishGameName("Windrose 風啟之旅"), "Windrose");
assert.equal(PW.englishGameName("Neo Game 新遊戲"), "Neo Game");
assert.equal(PW.englishGameName("測試遊戲 Test Game"), "Test Game");
assert.equal(PW.englishGameName("純中文遊戲"), "純中文遊戲");
assert.equal(PW.englishGameName("Last Pirates: Die Together"), "Last Pirates");

// Listed games (chip or not) are never auto-added; unknown ones are, newest first, no duplicates
const liveTitles = [
  "靠猴子自動化生存！《島嶼生存者 The Survivalists》開荒到通關全紀錄！",
  "《Core Keeper 核心守護者》玩到最後才發現…這遊戲根本停不下來！",
  "我們的《RAFT 筏上求生》六十二天極限生存記！",
  "《合力攻頂 PEAK》玩到絕交！",
];
assert.deepEqual(PW.newGamesFromTitles(liveTitles), []);
assert.deepEqual(
  PW.newGamesFromTitles(["《測試遊戲 Test Game》開場", "《另一款遊戲 Other Game》也很新", "《測試遊戲 Test Game》再一集"].concat(liveTitles)),
  [{ label: "測試遊戲 Test Game", query: "Test Game" }, { label: "另一款遊戲 Other Game", query: "Other Game" }],
);
assert.deepEqual(PW.newGamesFromTitles(["《測試遊戲 Test Game》"], ["Test Game"]), [], "existing page keys are exact-matched");
assert.equal(PW.gameChipFromTitle("沒有括號的 Don't Starve Together 標題"), null, "no 《》 means no new chip");

// Every long-form title on the channel (Nov 2026 retitle) maps to a listed game, with its exact 《》 name
const fx = createRequire(import.meta.url)("./fixtures/long-titles-2026-11.json");
for (const v of fx) {
  const b = (v.title.match(/《([^》]+)》/) || [])[1];
  if (!b) continue;
  const g = PW.findGame(b);
  assert.ok(g, "games.js is missing: " + b);
  assert.ok(g.name === b.trim() || (g.aliases || []).includes(b.trim()), "exact name or listed old name: " + b);
  assert.equal(PW.gameFromTitle(v.title), g.name, "tag for " + v.id);
}
assert.deepEqual(PW.newGamesFromTitles(fx.map((v) => v.title)), [], "no surprise auto chips from the back catalogue");
const names = PW.GAMES.map((g) => g.name);
assert.equal(new Set(names).size, names.length, "no duplicate names in games.js");
assert.equal(PW.chipGames()[0].name, "殭屍毀滅工程 Project Zomboid");
assert.equal(PW.gameFromTitle("《Breaking Gates 破門而出》舊標題"), "破門 Breaking Gates", "old label still maps after the rename");
assert.equal(PW.gameFromTitle("《破門 Breaking Gates》新標題"), "破門 Breaking Gates");

const xssTitle = '《<script>alert(1)</script> Evil Game》危險標題';
assert.equal(PW.gameFromTitle(xssTitle), '<script>alert(1)</script> Evil Game');
assert.equal(PW.gameChipFromTitle(xssTitle).query, "Evil Game");
assert.equal(
  PW.esc(PW.gameFromTitle(xssTitle)),
  "&lt;script&gt;alert(1)&lt;/script&gt; Evil Game",
  "card tags escape raw 《》 text",
);

const html = PW.cardsHTML([{
  title: "《測試遊戲 Test Game》開場測試",
  url: "https://www.youtube.com/watch?v=AAAAAAAAAAA",
  published: "2026-11-16T10:00:00.000Z",
  thumbnail: "https://i.ytimg.com/vi/AAAAAAAAAAA/maxresdefault.jpg",
  thumbnailFallback: "https://i.ytimg.com/vi/AAAAAAAAAAA/hqdefault.jpg",
}]);
assert.equal(html.includes('<span class="game" title="測試遊戲 Test Game">測試遊戲 Test Game</span>'), true, "card HTML uses the full 《》 label and a title for hover");
assert.equal(html.includes("<script>"), false);

console.log("all lib tests passed");
