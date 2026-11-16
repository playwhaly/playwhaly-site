/* playwhaly.com homepage behaviour. Needs lib.js (window.PW). No secrets and no API keys in this file. */
(function () {
  "use strict";

  /* ---- Config (edit these) ---- */
  var SCHEDULE_ANCHOR = "2026-11-06"; // a scheduled long-video Friday, YYYY-MM-DD (Asia/Singapore)
  var SCHEDULE_EVERY_DAYS = 14;       // biweekly
  var LIVE_POLL_MS = 120000;          // how often an open page re-checks /api/live
  // Twitch only plays if `parent` lists EVERY domain the page is served on (no wildcards). The page's own hostname is
  // always added automatically, so branch previews like abc123.playwhaly-site.pages.dev work too.
  var PLAYER_PARENTS = ["playwhaly.com", "www.playwhaly.com", "playwhaly-site.pages.dev"];
  var CHANNEL = "playwhaly";

  var PW = window.PW;
  var qs = location.search;
  var host = location.hostname;
  var isPreviewHost = host === "localhost" || host === "127.0.0.1" || /\.pages\.dev$/.test(host);
  var $ = function (s) { return document.querySelector(s); };
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Scroll reveal ----
     Plain scroll/resize check instead of IntersectionObserver, so a card can never stay invisible because an
     observer callback was missed (cards that are on screen always get revealed). */
  var revealTick = 0;
  function revealNow() {
    revealTick = 0;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var all = reduce || /[?&]reveal=all/.test(qs);
    document.querySelectorAll(".reveal:not(.in)").forEach(function (e) {
      if (all || e.getBoundingClientRect().top < vh * 0.94) e.classList.add("in");
    });
  }
  function queueReveal() { if (!revealTick) revealTick = requestAnimationFrame(revealNow); }
  function observeReveals() { revealNow(); }
  window.addEventListener("scroll", queueReveal, { passive: true });
  window.addEventListener("resize", function () { queueReveal(); fitGrid(); });
  window.addEventListener("load", function () { revealNow(); fitGrid(); });

  /* Show only whole rows: hide the trailing cards that would leave a half-empty last row (3, 2 or 1 columns). */
  function fitGrid() {
    var grid = $("#video-grid");
    if (!grid) return;
    var cells = [].slice.call(grid.children);
    cells.forEach(function (c) { c.hidden = false; });
    var cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length || 1;
    var keep = cells.length >= cols ? Math.floor(cells.length / cols) * cols : cells.length;
    cells.forEach(function (c, i) { c.hidden = i >= keep; });
  }

  /* ---- Card tilt (pointer devices only) ---- */
  function bindTilt() {
    if (reduce || !window.matchMedia("(hover:hover) and (pointer:fine)").matches) return;
    document.querySelectorAll(".vcard:not([data-tilt])").forEach(function (c) {
      c.setAttribute("data-tilt", "1");
      c.addEventListener("pointermove", function (ev) {
        var r = c.getBoundingClientRect();
        c.style.setProperty("--ry", ((ev.clientX - r.left) / r.width - 0.5) * 9 + "deg");
        c.style.setProperty("--rx", -((ev.clientY - r.top) / r.height - 0.5) * 9 + "deg");
      });
      c.addEventListener("pointerleave", function () { c.style.setProperty("--rx", "0deg"); c.style.setProperty("--ry", "0deg"); });
    });
  }

  /* ---- Latest videos (from /api/latest, else /data/latest.json, else the baked-in HTML stays) ---- */
  var videos = null;     // [latest, ...more]
  var liveNow = false;

  function getJson(url) {
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, 8000);
    return fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("status " + r.status); return r.json(); })
      .then(function (d) { clearTimeout(t); return d; }, function (e) { clearTimeout(t); throw e; });
  }
  function validPayload(d) {
    function ok(i) { return i && typeof i.title === "string" && i.title && /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/.test(i.url) && /^https:\/\/i\.ytimg\.com\/vi\/[\w-]{11}\//.test(i.thumbnail) && isFinite(Date.parse(i.published)); }
    return d && ok(d.latest) && Array.isArray(d.more) && d.more.every(ok);
  }

  function renderVideos() {
    if (!videos || !videos.length) return;
    var badge = $("#latest-badge-link");
    if (badge) {
      var g = PW.gameFromTitle(videos[0].title);
      badge.href = videos[0].url;
      badge.querySelector(".badge-text").textContent = "最新上傳 · " + (g ? g + " · " : "") + PW.formatMD(videos[0].published);
    }
    var grid = $("#video-grid");
    if (grid) { grid.innerHTML = PW.cardsHTML(videos.slice(1, 10)); fitGrid(); observeReveals(); bindTilt(); }
    if (!liveNow) renderSlides();
    renderNext();
  }

  function renderSlides() {
    var stage = $(".hero .stage");
    if (!stage || !videos) return;
    stage.className = "stage";
    stage.innerHTML = PW.slidesHTML(videos);
  }

  function renderNext() {
    var el = $("#next-text");
    if (!el) return;
    var lastUpload = videos && videos[0] ? PW.sgtDay(videos[0].published) : SCHEDULE_ANCHOR;
    var q = qs.match(/[?&]today=(\d{4}-\d{2}-\d{2})/);
    var today = q && isPreviewHost ? q[1] : PW.sgtDay(new Date());
    el.textContent = PW.nextLongVideo({ today: today, anchor: SCHEDULE_ANCHOR, everyDays: SCHEDULE_EVERY_DAYS, lastUpload: lastUpload }).text;
  }

  getJson("/api/latest")
    .catch(function () { return getJson("/data/latest.json"); })
    .then(function (d) {
      if (!validPayload(d)) throw new Error("bad payload");
      videos = [d.latest].concat(d.more);
      renderVideos();
    })
    .catch(function () { renderNext(); }); // keep the baked-in fallback

  /* ---- Twitch live: the check is server side (/api/live); the browser never sees a token ---- */
  var mockPlayer = isPreviewHost && /[?&]mockplayer=1/.test(qs);

  function playerParents() {
    var list = PLAYER_PARENTS.slice();
    if (list.indexOf(host) === -1 && host !== "localhost") list.push(host);
    return list;
  }

  function showLive(on) {
    var banner = $("#live-banner");
    var stage = $(".hero .stage");
    if (banner) banner.hidden = !on;
    if (on === liveNow) return;
    liveNow = on;
    if (!stage) return;
    if (!on) { renderSlides(); return; }
    stage.className = "stage live-player";
    var pill = '<span class="live-pill"><i></i>LIVE</span>';
    if (mockPlayer) {
      stage.innerHTML = '<div class="mock-player" aria-label="Mock Twitch player (placeholder)"><svg class="mp-glyph" viewBox="0 0 24 24" aria-hidden="true"><path fill="#9146FF" d="M4 3 2.5 7v13H7v3h3l3-3h4l5-5V3H4Zm15 11-3 3h-5l-3 3v-3H6V5h13v9Z"/><path fill="#9146FF" d="M15 8h2v5h-2V8Zm-5 0h2v5h-2V8Z"/></svg><span class="mp-mock">MOCK PLAYER · preview only</span><div class="mp-bar"><span class="mp-name">playwhaly</span></div></div>' + pill;
      return;
    }
    // The iframe exists only while live. Offline pages never contain a player.
    var src = "https://player.twitch.tv/?channel=" + CHANNEL + "&muted=true" + playerParents().map(function (p) { return "&parent=" + encodeURIComponent(p); }).join("");
    var f = document.createElement("iframe");
    f.src = src;
    f.title = "playwhaly on Twitch";
    f.allowFullscreen = true;
    f.setAttribute("allow", "autoplay; fullscreen");
    f.setAttribute("frameborder", "0");
    f.setAttribute("scrolling", "no");
    stage.innerHTML = "";
    stage.appendChild(f);
    stage.insertAdjacentHTML("beforeend", pill);
  }

  function checkLive() {
    var force = qs.match(/[?&]live=(\d)/); // preview override, only honoured on localhost and pages.dev
    if (force && isPreviewHost) { showLive(force[1] === "1"); return; }
    getJson("/api/live").then(function (d) { showLive(!!(d && d.live === true)); }, function () { /* keep current state */ });
    setTimeout(checkLive, LIVE_POLL_MS);
  }

  fitGrid();
  observeReveals();
  bindTilt();
  checkLive();
})();
