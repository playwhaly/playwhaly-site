import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const spinHtml = readFileSync(new URL("../public/spin.html", import.meta.url), "utf8");
assert.match(spinHtml, /<option value="">全部平台<\/option>/);
assert.match(spinHtml, /<option value="pc">PC \(Windows\)<\/option>/);
assert.match(spinHtml, /<option value="ps4">Sony PlayStation 4<\/option>/);
assert.match(spinHtml, /<option value="ps5">Sony PlayStation 5<\/option>/);

const indexHtml = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const description = "威利 Whaly 的小基地。各種遊戲都玩，輕鬆聊聊，一起放鬆～新影片、開台消息跟所有連結都在這裡。";
assert.equal((indexHtml.match(/<meta name="description"/g) || []).length, 1);
assert.match(indexHtml, new RegExp(`<meta name="description" content="${description}">`));
assert.match(indexHtml, new RegExp(`<meta property="og:description" content="${description}">`));
assert.match(indexHtml, new RegExp(`<meta name="twitter:description" content="${description}">`));

const elements = {
  wheel: { innerHTML: "", style: {} },
  "spin-btn": { disabled: false, addEventListener() {} },
  platform: { value: "", innerHTML: "", addEventListener() {}, appendChild() {} },
  genre: { value: "", addEventListener() {}, appendChild() {} },
  "pool-count": { textContent: "" },
  result: { innerHTML: "" },
  "paw-burst": { hidden: true, innerHTML: "" },
  "fx-toggle": { setAttribute() {}, textContent: "", addEventListener() {} }
};
const ctx = {
  window: {
    PWGames: {
      ALLOWED_PLATFORMS: ["PC (Windows)", "Sony PlayStation 4", "Sony PlayStation 5"],
      platforms(raw) { return String(raw || "").split(/[·•|,;\\/]+/).map((v) => v.trim()).filter(Boolean); },
      splitGenres() { return []; },
      genreZh(value) { return value; },
      statusLabel(value) { return value || "未玩"; },
      keyOf(game) { return game.name_en || game.name_zh || game.display_name; },
      shortName(game) { return game.name_zh || game.name_en || ""; },
      shortFontSize() { return 18; },
      esc(value) { return String(value ?? "").replace(/[&<>"\s]/g, ""); },
      uniqueSorted(values) { return [...new Set(values)].sort(); },
      fillSelect() {},
      coverSrc() { return ""; },
      coverFallback() { return ""; },
      genresLabel() { return ""; },
      displayName() { return ""; },
      statusChip() { return ""; },
      storeUrl() { return ""; },
      loadBacklog() { return Promise.resolve({ ok: true, games: [] }); }
    }
  },
  document: {
    getElementById(id) { return elements[id] || null; },
    createElement() { return { value: "", textContent: "", appendChild() {}, setAttribute() {}, addEventListener() {} }; }
  },
  console,
  setTimeout,
};
ctx.window.window = ctx.window;
ctx.window.document = ctx.document;
vm.runInNewContext(readFileSync(new URL("../public/spin.js", import.meta.url), "utf8"), ctx);

const spin = ctx.window.PWSpin;
assert.equal(spin.SPINNER_PLATFORMS.map((entry) => entry.label).join("|"),
  "全部平台|PC (Windows)|Sony PlayStation 4|Sony PlayStation 5");
assert.equal(spin.matchesSpinnerPlatform("PC · PS5", ""), true);
assert.equal(spin.matchesSpinnerPlatform("Switch", ""), false);
assert.equal(spin.matchesSpinnerPlatform("PC · Switch", "pc"), true);
assert.equal(spin.matchesSpinnerPlatform("Sony PlayStation 4 · Switch", "ps4"), true);
assert.equal(spin.matchesSpinnerPlatform("PS5", "ps5"), true);
assert.equal(spin.matchesSpinnerPlatform("Xbox", "ps5"), false);

console.log("spin platform and meta tests passed");
