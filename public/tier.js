/* /tier: Whaly's rated games by year, S to D. Data comes from /api/tier. */
(function () {
  "use strict";
  var U = window.PWGames;
  var TIERS = ["S", "A", "B", "C", "D"];
  var KIND_LABEL = { long: "影片", live: "直播", short: "Shorts" };
  var board = document.getElementById("tier-board");
  var switcher = document.getElementById("year-switch");
  var payload = null;
  var current = 0;

  function esc(s) { return U.esc(s); }

  function yearFromUrl(years) {
    var raw = new URLSearchParams(location.search).get("year");
    var y = raw && /^\d{4}$/.test(raw) ? Number(raw) : 0;
    return years.indexOf(y) !== -1 ? y : 0;
  }

  function setUrl(year, latest) {
    var url = new URL(location.href);
    if (year && year !== latest) url.searchParams.set("year", String(year));
    else url.searchParams.delete("year");
    var next = url.pathname + url.search + url.hash;
    if (next !== location.pathname + location.search + location.hash) {
      history.replaceState(null, "", next);
    }
  }

  function empty(title, text) {
    board.removeAttribute("aria-busy");
    board.innerHTML = '<div class="now-empty"><strong>' + esc(title) + "</strong>" + esc(text) + "</div>";
  }

  function coverHtml(g) {
    if (!g.steam_appid) return "";
    return '<span class="tier-cover"><img src="' + esc(U.coverSrc(g)) + '" data-fb="' + esc(U.coverFallback(g)) +
      '" onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb=\'\'}else{this.parentNode.remove()}"' +
      ' width="460" height="215" alt="" loading="lazy" decoding="async"></span>';
  }

  function notesHtml(g) {
    var zh = (g.notes_zh || "").trim();
    var en = (g.notes_en || "").trim();
    var out = "";
    if (zh) out += '<p class="tier-note">' + esc(zh) + "</p>";
    if (en) {
      out += '<p class="tier-note' + (zh ? " is-orig" : "") + '" lang="en">' +
        (zh ? '<span class="tier-note-lab">原文</span>' : "") + esc(en) + "</p>";
    }
    return out;
  }

  function linksHtml(g) {
    var vids = Array.isArray(g.videos) ? g.videos : [];
    var parts = [];
    if (vids.length) {
      var first = vids[0];
      parts.push('<a class="tier-link is-video" href="' + esc(first.url) + '" target="_blank" rel="noopener" title="' +
        esc(first.title) + '">▶ ' + esc(KIND_LABEL[first.type] || "影片") + "</a>");
    }
    if (g.store_url) {
      parts.push('<a class="tier-link" href="' + esc(g.store_url) + '" target="_blank" rel="noopener">在 Steam 看看</a>');
    }
    var more = "";
    if (vids.length > 1) {
      more = '<details class="tier-more"><summary>還有 ' + (vids.length - 1) + " 部</summary><ul>" +
        vids.slice(1).map(function (v) {
          return '<li><a href="' + esc(v.url) + '" target="_blank" rel="noopener">' +
            '<span class="tier-kind">' + esc(KIND_LABEL[v.type] || "影片") + "</span>" + esc(v.title) + "</a></li>";
        }).join("") + "</ul></details>";
    }
    if (!parts.length && !more) return "";
    return '<div class="tier-links">' + parts.join("") + "</div>" + more;
  }

  function cardHtml(g) {
    var zh = (g.name_zh || "").trim();
    var en = (g.name_en || "").trim();
    var names = zh
      ? '<span class="gz">' + esc(zh) + '</span><span class="ge" lang="en">' + esc(en) + "</span>"
      : '<span class="gz" lang="en">' + esc(en) + "</span>";
    return '<article class="tier-card' + (g.steam_appid ? " has-cover" : "") + '">' +
      coverHtml(g) +
      '<div class="tier-body"><h3 class="tier-name">' + names + "</h3>" +
      notesHtml(g) + linksHtml(g) + "</div>" +
      '<span class="tier-badge t-' + g.tier.toLowerCase() + '" aria-label="' + g.tier + ' 級">' + g.tier + "</span>" +
      "</article>";
  }

  function renderSwitcher() {
    var counts = (payload.stats && payload.stats.byYear) || {};
    switcher.innerHTML = payload.years.map(function (y) {
      var on = y === current;
      return '<button type="button" class="pill year-pill' + (on ? " is-on" : "") + '" data-year="' + y +
        '" aria-pressed="' + (on ? "true" : "false") + '">' + y + ' <span class="cnt">· ' + U.formatInt(counts[y] || 0) + " 款</span></button>";
    }).join("");
  }

  function renderBoard() {
    var list = payload.games.filter(function (g) { return g.year === current; });
    if (!list.length) { empty("還沒有分級", "這一年還沒有分級的遊戲。"); return; }
    board.removeAttribute("aria-busy");
    board.innerHTML = TIERS.map(function (t) {
      var rows = list.filter(function (g) { return g.tier === t; });
      if (!rows.length) return ""; // empty tier letters are omitted
      return '<section class="tier-row" aria-label="' + t + ' 級">' +
        '<h2 class="tier-label t-' + t.toLowerCase() + '"><span>' + t + '</span><small>' + rows.length + " 款</small></h2>" +
        '<div class="tier-cards">' + rows.map(cardHtml).join("") + "</div></section>";
    }).join("");
  }

  function show(year) {
    current = year;
    setUrl(year, payload.years[0]);
    renderSwitcher();
    renderBoard();
    if (window.PWAmiao) window.PWAmiao.setContext({ year: String(year), count: U.formatInt((payload.stats.byYear || {})[year] || 0) });
  }

  switcher.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest("button[data-year]") : null;
    if (!btn || !payload) return;
    var y = Number(btn.getAttribute("data-year"));
    if (y && y !== current) show(y);
  });

  window.addEventListener("popstate", function () {
    if (!payload) return;
    show(yearFromUrl(payload.years) || payload.years[0]);
  });

  fetch("/api/tier", { headers: { Accept: "application/json" } })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data || !data.ok) {
        empty("暫時看不到", (data && data.message) || "暫時讀不到分級清單，請稍後再試～");
        return;
      }
      if (!Array.isArray(data.years) || !data.years.length || !Array.isArray(data.games)) {
        empty("還沒有分級", "目前還沒有分級的遊戲。");
        return;
      }
      payload = data;
      show(yearFromUrl(data.years) || data.years[0]);
    })
    .catch(function () { empty("暫時看不到", "暫時讀不到分級清單，請稍後再試～"); });
})();
