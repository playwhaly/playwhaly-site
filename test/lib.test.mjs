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
assert.equal(PW.videoId("https://www.youtube.com/watch?v=gkBtjBj17FM"), "gkBtjBj17FM");
console.log("all lib tests passed");
