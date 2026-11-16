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

  // Biweekly Friday schedule anchored on a known Friday (YYYY-MM-DD).
  // todayStr and lastUploadStr are YYYY-MM-DD in Asia/Singapore (lastUploadStr comes from the newest long video in the feed).
  // Shows "新影片準備中" when a scheduled Friday is more than 1 day behind us and no upload on or after it exists.
  function nextLongVideo(o) {
    var today = dayNum(o.today), anchor = dayNum(o.anchor), last = dayNum(o.lastUpload), step = o.everyDays || 14;
    var recent = anchor + Math.floor((today - anchor) / step) * step;
    var next = recent === today ? today : recent + step;
    var missed = today >= recent + 1 && last < recent;
    return { missed: missed, text: missed ? "新影片準備中" : "下一部長片：" + label(next) };
  }

  var KNOWN_GAMES = ["Project Zomboid", "Don't Starve Together", "Core Keeper", "The Forest", "RAFT", "Green Hell", "Forewarned", "Fargone", "The Walking Trade", "VEIN", "PEAK", "Zombie Graveyard Simulator", "Last Pirates"];

  function normSpace(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  // Phrase match with Latin word boundaries (CJK has no spaces, so a found substring counts).
  function containsPhrase(hay, needle) {
    hay = normSpace(hay).toLowerCase();
    needle = normSpace(needle).toLowerCase();
    if (!hay || !needle) return false;
    if (hay === needle) return true;
    var i = hay.indexOf(needle);
    if (i === -1) return false;
    var before = i === 0 || !/[A-Za-z0-9]/.test(hay.charAt(i - 1));
    var after = i + needle.length === hay.length || !/[A-Za-z0-9]/.test(hay.charAt(i + needle.length));
    return before && after;
  }

  function knownGameIn(text) {
    var best = "";
    for (var i = 0; i < KNOWN_GAMES.length; i++) {
      var name = KNOWN_GAMES[i];
      if (containsPhrase(text, name) && name.length > best.length) best = name;
    }
    return best;
  }

  // Trailing Latin-script run: "殭屍毀滅工程 Project Zomboid" → "Project Zomboid". No match if the text ends in CJK.
  function trailingLatin(text) {
    var m = normSpace(text).match(/[A-Za-z0-9][A-Za-z0-9 .:'&+\-!']*$/);
    if (!m || !/[A-Za-z]/.test(m[0])) return "";
    return m[0].replace(/[ .:'&+\-!']+$/g, "").trim();
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

  // English name for a chip search link: known game, else the trailing Latin part, else the whole 《》 text.
  function englishGameName(bracket) {
    var text = normSpace(bracket);
    if (!text) return "";
    return knownGameIn(text) || trailingLatin(text) || text;
  }

  // Game tag for a card: the first 《...》 part of the title, else a known game name found in the title, else ""
  function gameFromTitle(title) {
    var brackets = bracketTexts(title);
    if (brackets.length) return brackets[0];
    return knownGameIn(title);
  }

  // One chip candidate from a long-video title. Videos with no 《》 return null.
  // If a title has several 《》, prefer a known game, then one with Latin, then the last bracket
  // (so "金字塔版《恐鬼症》…|《Forewarned》" resolves to Forewarned, not 恐鬼症).
  function gameChipFromTitle(title) {
    var brackets = bracketTexts(title);
    if (!brackets.length) return null;
    var chips = brackets.map(function (b) { return { label: b, query: englishGameName(b) }; });
    for (var i = 0; i < chips.length; i++) {
      if (knownGameIn(chips[i].query) || knownGameIn(chips[i].label)) return chips[i];
    }
    for (var j = 0; j < chips.length; j++) {
      if (/[A-Za-z]/.test(chips[j].query)) return chips[j];
    }
    return chips[chips.length - 1];
  }

  function chipAlreadyListed(game, keys) {
    if (!game) return true;
    var needles = [game.query, game.label];
    for (var i = 0; i < needles.length; i++) {
      var n = normSpace(needles[i]);
      if (!n) continue;
      for (var j = 0; j < (keys || []).length; j++) {
        var k = normSpace(keys[j]);
        if (!k) continue;
        if (containsPhrase(k, n) || containsPhrase(n, k)) return true;
      }
    }
    return false;
  }

  // titles are newest first. existingKeys are current chip labels and search queries.
  // Returns new games in that same newest-first order, with no duplicates.
  function newGamesFromTitles(titles, existingKeys) {
    var keys = (existingKeys || []).slice();
    var out = [];
    for (var i = 0; i < (titles || []).length; i++) {
      var game = gameChipFromTitle(titles[i]);
      if (!game || chipAlreadyListed(game, keys)) continue;
      out.push(game);
      keys.push(game.query, game.label);
    }
    return out;
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

  return { esc: esc, slidesHTML: slidesHTML, cardsHTML: cardsHTML, sgtDay: sgtDay, dayNum: dayNum, formatMD: formatMD, nextLongVideo: nextLongVideo, gameFromTitle: gameFromTitle, englishGameName: englishGameName, gameChipFromTitle: gameChipFromTitle, newGamesFromTitles: newGamesFromTitles, videoId: videoId, KNOWN_GAMES: KNOWN_GAMES };
});
