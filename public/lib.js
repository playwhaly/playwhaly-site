/* Pure helpers shared by the page (window.PW) and the Node tests (module.exports). No DOM here. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PW = api;
})(typeof self !== "undefined" ? self : this, function () {
  var DAY = 86400000;
  var WD = ["日", "一", "二", "三", "四", "五", "六"];
  var TZ = "Asia/Singapore";

  // 'YYYY-MM-DD' for a Date or ISO string, in Asia/Singapore
  function sgtDay(value) {
    var d = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
  }
  function dayNum(s) {
    var p = s.split("-");
    return Math.round(Date.UTC(+p[0], p[1] - 1, +p[2]) / DAY);
  }
  function label(n) {
    var d = new Date(n * DAY);
    return (d.getUTCMonth() + 1) + "月" + d.getUTCDate() + "日（" + WD[d.getUTCDay()] + "）";
  }
  function formatMD(published) {
    var n = dayNum(sgtDay(published));
    var d = new Date(n * DAY);
    return (d.getUTCMonth() + 1) + "月" + d.getUTCDate() + "日";
  }

  function formatEndsSGT(endsAt) {
    var n = dayNum(sgtDay(endsAt));
    var d = new Date(n * DAY);
    return (d.getUTCMonth() + 1) + "月" + d.getUTCDate() + "日（" + WD[d.getUTCDay()] + "）截止";
  }

  // Remaining time until a free-game offer ends. now may be a Date, an ISO string, or omitted (uses the clock).
  // Returns null if the timestamp is missing or already over. Hours and days are rounded up.
  function remainingFree(endsAt, now) {
    var end = Date.parse(endsAt);
    var t = now == null ? Date.now() : (now instanceof Date ? now.getTime() : Date.parse(now));
    if (!isFinite(end) || !isFinite(t)) return null;
    var ms = end - t;
    if (ms <= 0) return null;
    var hours = Math.ceil(ms / 3600000);
    var days = Math.ceil(ms / 86400000);
    var until = formatEndsSGT(endsAt);
    if (hours < 24) return { text: "剩 " + hours + " 小時", until: until, hours: hours, days: 0 };
    return { text: "剩 " + days + " 天", until: until, hours: hours, days: days };
  }


  // Biweekly Friday schedule anchored on a known Friday (YYYY-MM-DD).
  // todayStr and lastUploadStr are YYYY-MM-DD in Asia/Singapore (lastUploadStr comes from the newest long video in the feed).
  // Shows "新影片準備中" when a scheduled Friday is more than 1 day behind us and no upload on or after it exists.
  // Once a long video is out on or after the scheduled Friday (including that same evening), the next slot is shown.
  function nextLongVideo(o) {
    var today = dayNum(o.today), anchor = dayNum(o.anchor), last = dayNum(o.lastUpload), step = o.everyDays || 14;
    var recent = anchor + Math.floor((today - anchor) / step) * step;
    var next = recent === today && last < today ? today : recent + step;
    var missed = today >= recent + 1 && last < recent;
    return { missed: missed, text: missed ? "新影片準備中" : "下一部長片：" + label(next) };
  }

  // Game list lives in games.js (window.PW_GAMES in the browser, require() in Node tests).
  var GAMES = (typeof module === "object" && module.exports) ? require("./games.js") : ((typeof self !== "undefined" && self.PW_GAMES) || []);

  function normSpace(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }
  // Comparison key: NFKC (full-width → half-width), lower case, single spaces. Exact keys only, no substrings.
  function gameKey(text) {
    var s = normSpace(text);
    if (s.normalize) s = s.normalize("NFKC");
    return normSpace(s).toLowerCase();
  }

  var BY_KEY = {};
  GAMES.forEach(function (g) {
    [g.name, g.search].concat(g.aliases || []).forEach(function (n) {
      var k = gameKey(n);
      if (k && !BY_KEY[k]) BY_KEY[k] = g;
    });
  });

  // The game whose name, search name or alias is exactly this text, else null.
  function findGame(text) {
    return BY_KEY[gameKey(text)] || null;
  }

  // Phrase match with Latin word boundaries (CJK has no spaces, so a found substring counts).
  function containsPhrase(hay, needle) {
    hay = gameKey(hay);
    needle = gameKey(needle);
    if (!hay || !needle) return false;
    var from = 0, i;
    while ((i = hay.indexOf(needle, from)) !== -1) {
      var before = i === 0 || !/[a-z0-9]/.test(hay.charAt(i - 1));
      var after = i + needle.length === hay.length || !/[a-z0-9]/.test(hay.charAt(i + needle.length));
      if (before && after) return true;
      from = i + 1;
    }
    return false;
  }

  // Only for titles with no 《》: the longest listed name found in the title wins,
  // so "Where the forest ends" beats "The Forest".
  var PHRASES = [];
  GAMES.forEach(function (g) {
    [g.name, g.search].concat(g.aliases || []).forEach(function (n) { if (normSpace(n)) PHRASES.push({ text: n, game: g }); });
  });
  PHRASES.sort(function (a, b) { return gameKey(b.text).length - gameKey(a.text).length; });
  function listedGameIn(text) {
    for (var i = 0; i < PHRASES.length; i++) if (containsPhrase(text, PHRASES[i].text)) return PHRASES[i].game;
    return null;
  }

  function bracketTexts(title) {
    var out = [];
    var re = /《([^》]+)》/g, m;
    while ((m = re.exec(title || ""))) {
      var t = normSpace(m[1]);
      if (t) out.push(t);
    }
    return out;
  }

  var CJK = /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]/;
  // English part of a 《》 name for the search link, for games not in games.js.
  // "刺客任務 3 Hitman 3" → "Hitman 3", "Windrose 風啟之旅" → "Windrose", "純中文遊戲" → "純中文遊戲".
  function englishGameName(bracket) {
    var text = normSpace(bracket);
    if (!text) return "";
    var g = findGame(text);
    if (g) return g.search || g.name;
    var parts = text.split(CJK).map(normSpace).filter(function (p) { return /[A-Za-z]/.test(p); });
    if (!parts.length) return text;
    var m = parts[parts.length - 1].match(/[A-Za-z][A-Za-z0-9 .:'’&+!\-]*$/);
    if (!m) return text;
    return normSpace(m[0].replace(/[\s.:'’&+!\-]+$/, ""));
  }

  // Card tag: the first 《》 (mapped to its listed name if known), else a listed game in the title, else "".
  function gameFromTitle(title) {
    var brackets = bracketTexts(title);
    if (brackets.length) {
      var g = findGame(brackets[0]);
      return g ? g.name : brackets[0];
    }
    var hit = listedGameIn(title);
    return hit ? hit.name : "";
  }

  // Chip candidate: always the FIRST 《》 (titles start with 《Game》 since the Nov 2026 retitle).
  // Other 《》 later in a title (a comparison game, 《怪奇物語》, …) never decide the chip.
  function gameChipFromTitle(title) {
    var brackets = bracketTexts(title);
    if (!brackets.length) return null;
    var g = findGame(brackets[0]);
    if (g) return { label: g.name, query: g.search || g.name, listed: true };
    return { label: brackets[0], query: englishGameName(brackets[0]), listed: false };
  }

  // titles are newest first. existingKeys are extra labels/queries already on the page (exact match).
  // Returns games that are NOT in games.js and not on the page, newest first, no duplicates.
  function newGamesFromTitles(titles, existingKeys) {
    var seen = {};
    (existingKeys || []).forEach(function (k) { seen[gameKey(k)] = true; });
    var out = [];
    for (var i = 0; i < (titles || []).length; i++) {
      var game = gameChipFromTitle(titles[i]);
      if (!game || game.listed) continue;
      var lk = gameKey(game.label), qk = gameKey(game.query);
      if (seen[lk] || seen[qk]) continue;
      out.push({ label: game.label, query: game.query });
      seen[lk] = seen[qk] = true;
    }
    return out;
  }

  function chipGames() {
    return GAMES.filter(function (g) { return g.chip; });
  }

  function videoId(url) {
    try { return new URL(url).searchParams.get("v") || ""; } catch (e) { return ""; }
  }

  function esc(t) {
    return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function imgTag(item, extra) {
    var fb = item.thumbnailFallback || ("https://i.ytimg.com/vi/" + videoId(item.url) + "/hqdefault.jpg");
    // maxresdefault is 1280x720; if YouTube has no maxres for a video it answers 404 and we swap to hqdefault once
    return '<img src="' + esc(item.thumbnail) + '" data-fb="' + esc(fb) + '" onerror="this.onerror=null;this.src=this.dataset.fb" width="1280" height="720" alt="' + esc(item.title) + '" decoding="async"' + (extra || "") + ">";
  }
  function slideHTML(item, i) {
    var g = gameFromTitle(item.title);
    return '<a class="slide" href="' + esc(item.url) + '" aria-label="' + esc(item.title) + '"' + (i ? ' tabindex="-1"' : "") + ">" +
      imgTag(item, i ? ' loading="lazy"' : ' fetchpriority="high"') +
      (g ? '<span class="tag" title="' + esc(g) + '">' + esc(g) + "</span>" : "") + "</a>";
  }
  function cardHTML(item, i) {
    var g = gameFromTitle(item.title);
    return '<div class="cell reveal" style="--d:' + ((i % 3) * 0.1).toFixed(1) + 's"><a class="vcard" href="' + esc(item.url) + '">' +
      '<span class="thumb">' + imgTag(item, ' loading="lazy"') + (g ? '<span class="game" title="' + esc(g) + '">' + esc(g) + "</span>" : "") + '<span class="play" aria-hidden="true"></span></span>' +
      '<span class="vtitle">' + esc(item.title) + '</span><span class="vdate">' + esc(formatMD(item.published)) + "</span></a></div>";
  }
  function slidesHTML(items) { return items.slice(0, 3).map(slideHTML).join("\n"); }
  function cardsHTML(items) { return items.map(cardHTML).join("\n"); }

  return { esc: esc, slidesHTML: slidesHTML, cardsHTML: cardsHTML, sgtDay: sgtDay, dayNum: dayNum, formatMD: formatMD, formatEndsSGT: formatEndsSGT, remainingFree: remainingFree, nextLongVideo: nextLongVideo, gameFromTitle: gameFromTitle, englishGameName: englishGameName, gameChipFromTitle: gameChipFromTitle, newGamesFromTitles: newGamesFromTitles, findGame: findGame, chipGames: chipGames, videoId: videoId, GAMES: GAMES };
});
