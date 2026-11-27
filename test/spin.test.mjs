import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const spinHtml = readFileSync(new URL("../public/spin.html", import.meta.url), "utf8");
assert.match(spinHtml, /<option value="">全部平台<\/option>/);
assert.match(spinHtml, /<option value="pc">PC \(Windows\)<\/option>/);
assert.match(spinHtml, /<option value="ps4">Sony PlayStation 4<\/option>/);
assert.match(spinHtml, /<option value="ps5">Sony PlayStation 5<\/option>/);
assert.match(spinHtml, /<option value="switch">Nintendo Switch<\/option>/);

const indexHtml = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const description = "威利 Whaly 的小基地。各種遊戲都玩，輕鬆聊聊，一起放鬆～新影片、開台消息跟所有連結都在這裡。";
assert.match(indexHtml, /<p class="lede">各種遊戲都玩，輕鬆聊聊，一起放鬆～<\/p>/);
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
      hasAllowedPlatform(raw) {
        const value = String(raw || "").toLowerCase();
        return ["pc", "windows", "pc (windows)", "ps4", "playstation 4", "sony playstation 4",
          "ps5", "playstation 5", "sony playstation 5"].some((alias) =>
          value.split(/[·•|,;\\/]+/).some((platform) => platform.trim() === alias));
      },
      hasPlatform(raw, selected) {
        const value = String(raw || "").toLowerCase();
        const aliases = {
          "pc (windows)": ["pc", "windows", "pc (windows)"],
          "sony playstation 4": ["ps4", "playstation 4", "sony playstation 4"],
          "sony playstation 5": ["ps5", "playstation 5", "sony playstation 5"]
        }[selected.toLowerCase()] || [selected.toLowerCase()];
        return String(value).split(/[·•|,;\\/]+/).some((platform) =>
          aliases.includes(platform.trim()));
      },
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
// Use the real platform helpers from games-util.js, so the wheel and /backlog agree on platforms.
{
  const utilCtx = { window: {} };
  utilCtx.window = utilCtx;
  vm.runInNewContext(readFileSync(new URL("../public/games-util.js", import.meta.url), "utf8"), utilCtx);
  for (const k of ["ALLOWED_PLATFORMS", "platforms", "hasAllowedPlatform", "hasPlatform"]) {
    ctx.window.PWGames[k] = utilCtx.PWGames[k];
  }
}
vm.runInNewContext(readFileSync(new URL("../public/spin.js", import.meta.url), "utf8"), ctx);

const spin = ctx.window.PWSpin;
assert.equal("SPINNER_PLATFORMS" in spin, false);
assert.equal(spin.matchesSpinnerPlatform("PC · PS5", ""), true);
assert.equal(spin.matchesSpinnerPlatform("Xbox", ""), false);
assert.equal(spin.matchesSpinnerPlatform("Nintendo Switch", ""), true);
assert.equal(spin.matchesSpinnerPlatform("Nintendo Switch", "switch"), true);
assert.equal(spin.matchesSpinnerPlatform("Nintendo Switch", "pc"), false);
assert.equal(spin.matchesSpinnerPlatform("Steam", "switch"), false);
assert.equal(spin.matchesSpinnerPlatform("Steam", "pc"), true);
assert.equal(spin.matchesSpinnerPlatform("PC · Switch", "pc"), true);
assert.equal(spin.matchesSpinnerPlatform("Sony PlayStation 4 · Switch", "ps4"), true);
assert.equal(spin.matchesSpinnerPlatform("PS5", "ps5"), true);
assert.equal(spin.matchesSpinnerPlatform("Xbox", "ps5"), false);

console.log("spin platform and meta tests passed");
