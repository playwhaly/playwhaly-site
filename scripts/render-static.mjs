// Re-bakes the no-JavaScript fallback (hero slides, video cards, latest badge) in public/index.html
// from public/data/latest.json, using the same renderers the page uses. Run: node scripts/render-static.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const PW = createRequire(import.meta.url)("../public/lib.js");
const data = JSON.parse(readFileSync(new URL("../public/data/latest.json", import.meta.url), "utf8"));
const file = new URL("../public/index.html", import.meta.url);
let html = readFileSync(file, "utf8");
const all = [data.latest, ...data.more];
const swap = (name, body) => {
  const re = new RegExp("(<!-- " + name + ":start -->)[\\s\\S]*?(<!-- " + name + ":end -->)");
  if (!re.test(html)) throw new Error("marker missing: " + name);
  html = html.replace(re, (_, a, b) => a + "\n" + body + "\n" + b);
};
swap("hero-slides", PW.slidesHTML(all));
swap("video-cards", PW.cardsHTML(data.more));
const game = PW.gameFromTitle(data.latest.title);
swap("latest-badge", `<span class="badge-text">最新上傳 · ${PW.esc(game)} · ${PW.formatMD(data.latest.published)}</span>`);
writeFileSync(file, html);
console.log("baked", all.length, "videos");
