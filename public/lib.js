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

  var FREE_PAGE_SIZE = 3;

  function needsFreePager(total, size) {
    size = size || FREE_PAGE_SIZE;
    return (total || 0) > size;
  }

  // Slice a free-games list into a page of `size` (default 3). Page numbers are 1-based and clamped.
  function sliceFreeGames(games, page, size) {
    size = size || FREE_PAGE_SIZE;
    var list = Array.isArray(games) ? games : [];
    var pages = list.length ? Math.ceil(list.length / size) : 0;
    var p = pages ? Math.max(1, Math.min(parseInt(page, 10) || 1, pages)) : 1;
    var start = (p - 1) * size;
    return {
      page: pages ? p : 1,
      pages: pages,
      size: size,
      total: list.length,
      items: list.slice(start, start + size),
      showPager: list.length > size
    };
  }

  // Google-style page list: all numbers when there are few pages, otherwise 1 … window … last.
  function freePagerPages(current, total) {
    var pages = total || 0;
    var cur = Math.max(1, Math.min(current || 1, Math.max(1, pages)));
    if (pages <= 0) return [];
    if (pages <= 7) {
      var all = [];
      for (var i = 1; i <= pages; i++) all.push(i);
      return all;
    }
    var keep = {};
    function add(n) { if (n >= 1 && n <= pages) keep[n] = true; }
    add(1);
    add(pages);
    for (var j = cur - 1; j <= cur + 1; j++) add(j);
    if (cur <= 3) { add(2); add(3); add(4); add(5); }
    if (cur >= pages - 2) { add(pages - 1); add(pages - 2); add(pages - 3); add(pages - 4); }
    var nums = [];
    for (var n in keep) nums.push(+n);
    nums.sort(function (a, b) { return a - b; });
    var out = [];
    for (var k = 0; k < nums.length; k++) {
      if (k && nums[k] - nums[k - 1] > 1) out.push("…");
      out.push(nums[k]);
    }
    return out;
  }

  function esc(t) {
    return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function followIcon(id) {
    /* Official Simple Icons glyphs (https://simpleicons.org), currentColor, no distortion. */
    if (id === "ig") {
      return '<svg viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"/></svg>';
    }
    if (id === "threads") {
      return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.263 11.097c-.03-3.486-1.92-5.586-5.111-5.586-2.13 0-3.922.963-4.863 2.499l2.062 1.438c.535-.843 1.272-1.543 2.628-1.543 1.528 0 2.318.85 2.544 2.431a15 15 0 0 0-2.236-.173c-4.125 0-6.068 1.867-6.068 4.336s1.943 3.99 4.804 3.99c3.139 0 5.013-2.115 5.781-4.735.798.361 1.348 1.204 1.348 2.47 0 3.387-3.907 5.232-7.22 5.232-4.885 0-8.077-3.207-8.077-8.424 0-6.392 4.223-10.487 9.9-10.487 3.808 0 5.69 1.671 6.97 3.914l2.108-1.475C21.44 2.078 18.331 0 13.663 0 6.227 0 1.168 5.277 1.168 12.934c0 7 4.953 11.066 10.856 11.066 4.878 0 9.809-2.846 9.809-7.716 0-2.545-1.46-4.231-3.569-5.187m-6.33 4.855c-1.077 0-2.026-.512-2.026-1.453 0-1.483 1.822-1.934 3.606-1.934.678 0 1.34.045 1.927.173-.422 1.927-1.671 3.215-3.508 3.214Z"/></svg>';
    }
    if (id === "facebook") {
      return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></svg>';
    }
    if (id === "discord") {
      return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>';
    }
    return "";
  }
  // Follow pills on /free. Shared so the build can bake the same HTML into free.html (no layout shift).
  function followHTML(site) {
    var pills = ((site && site.followPlatforms) || []).map(function (p) {
      if (!p || !p.href || !p.label) return "";
      return '<a class="follow-pill follow-pill--' + esc(p.id || "") + '" href="' + esc(p.href) +
        '" target="_blank" rel="noopener">' + followIcon(p.id) + esc(p.label) + "</a>";
    }).join("");
    var invite = String((site && site.discordInvite) || "").trim();
    var dc = invite
      ? '<a class="follow-discord" href="' + esc(invite) + '">' + followIcon("discord") + "加入 Discord</a>"
      : "";
    return pills + dc;
  }
  // YouTube serves the same 1280x720 maxres frame as WebP at about half the bytes.
  function thumbSrc(item) {
    var t = String((item && item.thumbnail) || "");
    var m = /^https:\/\/i\.ytimg\.com\/vi\/([\w-]{11})\/maxresdefault\.jpg$/.exec(t);
    return m ? "https://i.ytimg.com/vi_webp/" + m[1] + "/maxresdefault.webp" : t;
  }
  // defer: put the address in data-src so a hidden slide does not compete with the first one.
  function imgTag(item, extra, defer) {
    var fb = item.thumbnailFallback || ("https://i.ytimg.com/vi/" + videoId(item.url) + "/hqdefault.jpg");
    // maxresdefault is 1280x720; if YouTube has no maxres for a video it answers 404 and we swap to hqdefault once
    return '<img ' + (defer ? "data-src" : "src") + '="' + esc(thumbSrc(item)) + '" data-fb="' + esc(fb) + '" onerror="this.onerror=null;this.src=this.dataset.fb" width="1280" height="720" alt="' + esc(item.title) + '" decoding="async"' + (extra || "") + ">";
  }
  function slideHTML(item, i) {
    var g = gameFromTitle(item.title);
    return '<a class="slide" href="' + esc(item.url) + '" aria-label="' + esc(item.title) + '"' + (i ? ' tabindex="-1"' : "") + ">" +
      imgTag(item, i ? ' loading="lazy"' : ' fetchpriority="high"', !!i) +
      (g ? '<span class="tag" title="' + esc(g) + '">' + esc(g) + "</span>" : "") + "</a>";
  }
  function cardHTML(item, i) {
    var g = gameFromTitle(item.title);
    return '<div class="cell reveal" style="--d:' + ((i % 3) * 0.1).toFixed(1) + 's"><a class="vcard" href="' + esc(item.url) + '">' +
      '<span class="thumb">' + imgTag(item, ' loading="lazy"') + (g ? '<span class="game" title="' + esc(g) + '">' + esc(g) + "</span>" : "") + '<span class="play" aria-hidden="true"></span></span>' +
      '<span class="vtitle">' + esc(item.title) + '</span><span class="vdate">' + esc(formatMD(item.published)) + "</span></a></div>";
  }
  function slidesHTML(items) { return items.slice(0, 3).map(slideHTML).join("\n"); }
  // Same videos in the same order as what is already on the page? Then the baked HTML stays,
  // so the hero image is not swapped for a new element (that delayed the LCP paint by seconds).
  function sameLinks(container, selector, items) {
    if (!container || !items) return false;
    var have = [].map.call(container.querySelectorAll(selector), function (a) { return a.getAttribute("href"); });
    if (have.length !== items.length) return false;
    for (var i = 0; i < items.length; i++) if (have[i] !== items[i].url) return false;
    return true;
  }
  function cardsHTML(items) { return items.map(cardHTML).join("\n"); }

  return { esc: esc, slidesHTML: slidesHTML, cardsHTML: cardsHTML, sgtDay: sgtDay, dayNum: dayNum, formatMD: formatMD, formatEndsSGT: formatEndsSGT, sameLinks: sameLinks, thumbSrc: thumbSrc, followHTML: followHTML, remainingFree: remainingFree, FREE_PAGE_SIZE: FREE_PAGE_SIZE, needsFreePager: needsFreePager, sliceFreeGames: sliceFreeGames, freePagerPages: freePagerPages, nextLongVideo: nextLongVideo, gameFromTitle: gameFromTitle, englishGameName: englishGameName, gameChipFromTitle: gameChipFromTitle, newGamesFromTitles: newGamesFromTitles, findGame: findGame, chipGames: chipGames, videoId: videoId, GAMES: GAMES };
});
