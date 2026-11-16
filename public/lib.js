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
  // Game tag for a card: the 《...》 part of the title, else a known game name found in the title, else ""
  function gameFromTitle(title) {
    var m = /《([^》]+)》/.exec(title || "");
    if (m) return m[1].trim();
    for (var i = 0; i < KNOWN_GAMES.length; i++) {
      if ((title || "").toLowerCase().indexOf(KNOWN_GAMES[i].toLowerCase()) !== -1) return KNOWN_GAMES[i];
    }
    return "";
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
      (g ? '<span class="tag">' + esc(g) + "</span>" : "") + "</a>";
  }
  function cardHTML(item, i) {
    var g = gameFromTitle(item.title);
    return '<div class="cell reveal" style="--d:' + ((i % 3) * 0.1).toFixed(1) + 's"><a class="vcard" href="' + esc(item.url) + '">' +
      '<span class="thumb">' + imgTag(item, ' loading="lazy"') + (g ? '<span class="game">' + esc(g) + "</span>" : "") + '<span class="play" aria-hidden="true"></span></span>' +
      '<span class="vtitle">' + esc(item.title) + '</span><span class="vdate">' + esc(formatMD(item.published)) + "</span></a></div>";
  }
  function slidesHTML(items) { return items.slice(0, 3).map(slideHTML).join("\n"); }
  function cardsHTML(items) { return items.map(cardHTML).join("\n"); }

  return { esc: esc, slidesHTML: slidesHTML, cardsHTML: cardsHTML, sgtDay: sgtDay, dayNum: dayNum, formatMD: formatMD, nextLongVideo: nextLongVideo, gameFromTitle: gameFromTitle, videoId: videoId, KNOWN_GAMES: KNOWN_GAMES };
});
