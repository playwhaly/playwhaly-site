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
const latestUrl = data.latest.url;
html = html.replace(
  /(<a class="badge latest" id="latest-badge-link" href=")[^"]+"/,
  "$1" + latestUrl + '"',
);
// Preload the first hero image so the browser starts it before CSS and scripts.
swap("hero-preload", `<link rel="preload" as="image" href="${PW.esc(PW.thumbSrc(data.latest))}" fetchpriority="high">`);
writeFileSync(file, html);

// /backlog shows the 3 newest videos (including the latest). Bake them in so the page does not
// jump when videos.js runs. Images keep width and height, so lazy loading does not shift anything.
const backlogFile = new URL("../public/backlog.html", import.meta.url);
let backlog = readFileSync(backlogFile, "utf8");
const bre = /(<!-- backlog-videos:start -->)[\s\S]*?(<!-- backlog-videos:end -->)/;
if (!bre.test(backlog)) throw new Error("marker missing: backlog-videos");
const backlogCards = PW.cardsHTML(all.slice(0, 3)).replace(/class="cell reveal"/g, 'class="cell reveal in"');
backlog = backlog.replace(bre, (_, a, b) => a + "\n" + backlogCards + "\n" + b);
writeFileSync(backlogFile, backlog);
// /free follow pills from site.json, baked so the card has its final height before scripts run.
const freeFile = new URL("../public/free.html", import.meta.url);
const site = JSON.parse(readFileSync(new URL("../public/site.json", import.meta.url), "utf8"));
let freeHtml = readFileSync(freeFile, "utf8");
const fre = /<div class="follow-row" id="follow-row">[\s\S]*?<\/div>\n/;
if (!fre.test(freeHtml)) throw new Error("marker missing: follow-row");
freeHtml = freeHtml.replace(fre, () => '<div class="follow-row" id="follow-row">' + PW.followHTML(site) + "</div>\n");
writeFileSync(freeFile, freeHtml);
console.log("baked", all.length, "videos");
