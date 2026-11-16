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
assert.equal(PW.gameFromTitle("《Core Keeper 核心守護者》從零開始！"), "Core Keeper 核心守護者");
assert.equal(PW.gameFromTitle("我們快餓死了 | 饑荒聯機版 Don't Starve Together 搞笑片段精華 EP.8"), "Don't Starve Together");
assert.equal(PW.gameFromTitle("沒有遊戲名的標題"), "");
assert.equal(PW.gameFromTitle("《測試遊戲 Test Game》開場測試"), "測試遊戲 Test Game", "new games keep the full 《》 text on card tags");
assert.equal(PW.gameFromTitle("《陰森 The Forest》這根本是恐怖遊戲！"), "陰森 The Forest");
assert.equal(PW.videoId("https://www.youtube.com/watch?v=gkBtjBj17FM"), "gkBtjBj17FM");

assert.equal(PW.englishGameName("殭屍毀滅工程 Project Zomboid"), "Project Zomboid");
assert.equal(PW.englishGameName("島嶼生存者 The Survivalists"), "The Survivalists");
assert.equal(PW.englishGameName("測試遊戲 Test Game"), "Test Game");
assert.equal(PW.englishGameName("Core Keeper 核心守護者"), "Core Keeper");
assert.equal(PW.englishGameName("RAFT 筏上求生"), "RAFT");
assert.equal(PW.englishGameName("陰森 The Forest"), "The Forest");
assert.equal(PW.englishGameName("Fargone"), "Fargone");
assert.equal(PW.englishGameName("純中文遊戲"), "純中文遊戲");
assert.equal(PW.englishGameName("Don't Starve Together"), "Don't Starve Together");
assert.equal(PW.englishGameName("Last Pirates: Die Together"), "Last Pirates");

const existing = [
  "Project Zomboid", "VEIN", "島嶼生存者 The Survivalists", "The Survivalists",
  "Core Keeper", "The Forest", "Don't Starve Together", "RAFT 筏上求生", "RAFT",
  "Zombie Graveyard Simulator", "Green Hell", "Forewarned", "Fargone",
  "The Walking Trade", "Last Pirates: Die Together", "Last Pirates", "PEAK",
];
const liveTitles = [
  "《島嶼生存者 The Survivalists》從零開始的猴島求生！",
  "《Core Keeper 核心守護者》從零開始！我們一路打敗所有BOSS！",
  "《陰森 The Forest》這根本是恐怖遊戲！揭開尋子的殘酷真相！",
  "我們快餓死了，闖入的陌生人居然幫忙蓋家？ | 饑荒聯機版 Don't Starve Together 搞笑片段精華 EP.8",
  "《殭屍毀滅工程 Project Zomboid》B42全新探索！玫木鎮居然變這樣了",
  "我們的《RAFT 筏上求生》六十二天極限生存記！這是一場從四塊木板開始的海上大冒險！",
  "我把一座破墓園經營成殭屍也攻不破！《殭屍墓園模擬器 Zombie Graveyard Simulator》",
];
assert.deepEqual(PW.newGamesFromTitles(liveTitles, existing), [], "live feed games are already in the baseline");

const withNew = ["《測試遊戲 Test Game》開場測試"].concat(liveTitles);
const added = PW.newGamesFromTitles(withNew, existing);
assert.equal(added.length, 1);
assert.equal(added[0].label, "測試遊戲 Test Game");
assert.equal(added[0].query, "Test Game");

assert.equal(PW.gameChipFromTitle("沒有括號的 Don't Starve Together 標題"), null, "no 《》 means no new chip");
assert.deepEqual(
  PW.gameChipFromTitle("金字塔版《恐鬼症》竟然能瘋狂搞隊友！|《Forewarned》"),
  { label: "Forewarned", query: "Forewarned" },
  "prefer the known game when a title has two 《》",
);
assert.deepEqual(
  PW.newGamesFromTitles([
    "《測試遊戲 Test Game》開場",
    "《另一款遊戲 Other Game》也很新",
    "《測試遊戲 Test Game》再一集",
    "這絕對是一款超破壞友誼的恐怖遊戲！金字塔版《恐鬼症》竟然能瘋狂搞隊友！|《Forewarned》",
  ], existing),
  [
    { label: "測試遊戲 Test Game", query: "Test Game" },
    { label: "另一款遊戲 Other Game", query: "Other Game" },
  ],
  "newest first, no duplicates, Forewarned already listed",
);

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
