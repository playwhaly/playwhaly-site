// Rewrites the no-JS game chips and marquee in public/index.html from public/games.js.
// Run after editing games.js:  node scripts/sync-chips.mjs   (add --check to only verify)
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const games = createRequire(import.meta.url)("../public/games.js").filter((g) => g.chip);
const file = new URL("../public/index.html", import.meta.url);
const html = readFileSync(file, "utf8");
const PAW = '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="15.5" rx="6.2" ry="5"/><circle cx="4.8" cy="8.6" r="2.15"/><circle cx="9" cy="5.8" r="2.35"/><circle cx="15.2" cy="5.8" r="2.35"/><circle cx="19.2" cy="8.6" r="2.15"/></svg>';
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const chip = (g) => `<a class="chip${g.main ? " main" : ""}" href="https://www.youtube.com/@playwhaly/search?query=${encodeURIComponent(g.search || g.name)}" target="_blank" rel="noopener" title="在 YouTube 頻道搜尋：${esc(g.name)}">${PAW}<span class="chip-label">${esc(g.name)}</span></a>`;
const mq = (g, hidden) => `<span${hidden ? ' aria-hidden="true"' : ` title="${esc(g.name)}"`}>${PAW}<span class="mq-label">${esc(g.name)}</span></span>`;
const chipsRe = /(<div class="chips reveal">)[\s\S]*?(<\/div>\s*<p class="note)/;
const trackRe = /(<div class="marquee-track">)[\s\S]*?(<\/div>\s*<\/div>)/;
if (!chipsRe.test(html) || !trackRe.test(html)) throw new Error("chips or marquee markers not found in index.html");
const out = html
  .replace(chipsRe, (_, a, b) => a + games.map(chip).join("") + b)
  .replace(trackRe, (_, a, b) => a + games.map((g) => mq(g, false)).join("") + games.map((g) => mq(g, true)).join("") + b);
if (process.argv.includes("--check")) {
  if (out !== html) { console.error("index.html chips/marquee are out of date: run node scripts/sync-chips.mjs"); process.exit(1); }
  console.log("index.html chips/marquee match games.js");
} else {
  writeFileSync(file, out);
  console.log(`wrote ${games.length} chips and marquee items`);
}
