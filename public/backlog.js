(function () {
  "use strict";
  var U = window.PWGames;
  var games = [];
  var payload = null;
  var page = 1;
  var tbody = document.getElementById("game-rows");
  var cards = document.getElementById("game-cards");
  var foot = document.getElementById("list-foot");
  var pager = document.getElementById("list-pager");
  var prevBtn = document.getElementById("page-prev");
  var nextBtn = document.getElementById("page-next");
  var q = document.getElementById("q");
  var platform = document.getElementById("platform");
  var genre = document.getElementById("genre");

  function emptyCopy() {
    if (!payload) return "暫時讀不到遊戲清單，請稍後再試～";
    if (payload.ok === false && payload.reason === "unset") {
      return payload.message || "遊戲清單還沒接上公開資料，稍後再來看看～";
    }
    if (payload.ok === false) {
      return payload.message || "暫時讀不到遊戲清單，請稍後再試～";
    }
    return "沒有符合的遊戲。";
  }

  function statusFilter() {
    var on = document.querySelector(".library .filter-chip.is-on");
    return on ? on.getAttribute("data-status") || "" : "";
  }

  function matches(g) {
    if (!U.hasAllowedPlatform(g.platform)) return false;
    var query = ((q && q.value) || "").trim().toLowerCase();
    if (query) {
      var blob = ((g.display_name || "") + " " + (g.name_zh || "") + " " + (g.name_en || "")).toLowerCase();
      if (blob.indexOf(query) === -1) return false;
    }
    var st = statusFilter();
    if (st && U.statusLabel(g.status) !== st) return false;
    if (platform && platform.value && U.allowedPlatformLabel(g.platform) !== platform.value) return false;
    if (genre && genre.value && U.splitGenres(g.genre).map(U.genreZh).indexOf(genre.value) === -1) return false;
    return true;
  }

  function renderStats(stats) {
    var box = document.getElementById("backlog-stats");
    if (!box) return;
    if (!stats) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.removeAttribute("aria-busy");
    function set(id, n) {
      var el = document.getElementById(id);
      if (el) el.textContent = U.formatInt(n);
    }
    set("stat-total", stats.total);
    set("stat-done", stats.completed);
    set("stat-play", stats.playing);
    set("stat-todo", stats.todo);
  }

  function renderPlaying(list) {
    var wrap = document.getElementById("now-playing");
    if (!wrap) return;
    if (!list || !list.length) {
      wrap.innerHTML = '<div class="now-empty"><strong>目前沒有正在玩的遊戲</strong>有開始玩的時候會出現在這裡。</div>';
      return;
    }
    wrap.innerHTML = '<ul class="done-list">' + list.map(function (g) {
      return '<li><span class="dot-done" aria-hidden="true"></span><div>' +
        U.displayName(g) + '</div><span class="plat">' + U.esc(g.platform || "") + "</span></li>";
    }).join("") + "</ul>";
  }

  function renderRecent(list) {
    var ul = document.getElementById("recent-done");
    var footEl = document.getElementById("recent-done-foot");
    var loading = document.getElementById("recent-done-loading");
    if (loading) loading.parentNode.removeChild(loading);
    if (!ul) return;
    if (!list || !list.length) {
      ul.innerHTML = "";
      if (footEl) footEl.textContent = "還沒有可顯示的完成紀錄。";
      return;
    }
    ul.innerHTML = list.map(function (g) {
      return '<li><span class="dot-done" aria-hidden="true"></span><div>' +
        U.displayName(g) + '</div><span class="plat">' + U.esc(g.platform || "") + "</span></li>";
    }).join("");
    if (footEl) footEl.textContent = "";
  }

  function rowHtml(g) {
    var name = U.fullName(g);
    var genreLabel = U.genresLabel(g.genre);
    return '<tr><td class="col-name" title="' + U.esc(name) + '">' + U.displayName(g) +
      '</td><td class="col-platform">' + U.esc(g.platform || "—") +
      '</td><td class="col-status">' + U.statusChip(g.status) +
      '</td><td class="col-genre" title="' + U.esc(genreLabel) + '">' + U.esc(genreLabel) +
      '</td><td class="col-release">' + U.esc(U.formatRelease(g.release_date)) + "</td></tr>";
  }

  function cardHtml(g) {
    var name = U.fullName(g);
    var genreLabel = U.genresLabel(g.genre);
    return '<article class="game-card" title="' + U.esc(name) + '">' +
      U.displayName(g) +
      '<div class="game-card-meta">' + U.statusChip(g.status) +
      "<span>" + U.esc(g.platform || "—") + "</span>" +
      "<span>" + U.esc(genreLabel) + "</span>" +
      "<span>" + U.esc(U.formatRelease(g.release_date)) + "</span>" +
      "</div></article>";
  }

  function render() {
    var rows = games.filter(matches);
    var slice = U.pageSlice(rows, page);
    page = slice.page;

    if (!tbody) return;

    if (!games.length) {
      tbody.innerHTML = '<tr><td colspan="5">' + U.esc(emptyCopy()) + "</td></tr>";
      if (cards) cards.innerHTML = '<article class="game-card">' + U.esc(emptyCopy()) + "</article>";
      if (foot) foot.textContent = "";
      if (prevBtn) prevBtn.hidden = true;
      if (nextBtn) nextBtn.hidden = true;
      return;
    }

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5">' + U.esc(emptyCopy()) + "</td></tr>";
      if (cards) cards.innerHTML = '<article class="game-card">' + U.esc(emptyCopy()) + "</article>";
    } else {
      tbody.innerHTML = slice.items.map(rowHtml).join("");
      if (cards) cards.innerHTML = slice.items.map(cardHtml).join("");
    }

    if (foot) {
      if (!rows.length) {
        foot.textContent = "顯示 0／" + U.formatInt(games.length) + " 款。";
      } else if (slice.pages > 1) {
        foot.textContent = "第 " + U.formatInt(slice.page) + "／" + U.formatInt(slice.pages) +
          " 頁，顯示 " + U.formatInt(slice.start) + " 到 " + U.formatInt(slice.end) +
          "／" + U.formatInt(rows.length) + " 款";
      } else {
        foot.textContent = "顯示 " + U.formatInt(rows.length) + "／" + U.formatInt(games.length) + " 款。";
      }
    }

    var showPager = !!(rows.length && slice.pages > 1);
    if (prevBtn) {
      prevBtn.hidden = !showPager;
      prevBtn.disabled = slice.page <= 1;
    }
    if (nextBtn) {
      nextBtn.hidden = !showPager;
      nextBtn.disabled = slice.page >= slice.pages;
    }
  }

  function goTo(next) {
    page = next;
    render();
    var lib = document.getElementById("lib-title");
    if (lib && lib.scrollIntoView) {
      lib.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }

  function resetAndRender() {
    page = 1;
    render();
  }

  document.querySelectorAll(".library .filter-chip").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".library .filter-chip").forEach(function (b) {
        b.classList.toggle("is-on", b === btn);
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      resetAndRender();
    });
  });
  if (q) q.addEventListener("input", resetAndRender);
  if (platform) platform.addEventListener("change", resetAndRender);
  if (genre) genre.addEventListener("change", resetAndRender);
  if (prevBtn) prevBtn.addEventListener("click", function () { if (!prevBtn.disabled) goTo(page - 1); });
  if (nextBtn) nextBtn.addEventListener("click", function () { if (!nextBtn.disabled) goTo(page + 1); });

  U.loadBacklog().then(function (data) {
    payload = data;
    var sourceGames = (data && data.ok && Array.isArray(data.games)) ? data.games : [];
    games = sourceGames.filter(function (g) { return U.hasAllowedPlatform(g.platform); });
    var stats = {
      total: games.length,
      completed: games.filter(function (g) { return U.statusLabel(g.status) === "已完成"; }).length,
      playing: games.filter(function (g) { return U.statusLabel(g.status) === "遊玩中"; }).length,
      todo: games.filter(function (g) { return U.statusLabel(g.status) === "未玩"; }).length
    };
    renderStats(stats);
    renderPlaying(games.filter(function (g) { return U.statusLabel(g.status) === "遊玩中"; }));
    renderRecent(games.filter(function (g) { return U.statusLabel(g.status) === "已完成"; }));
    var plats = [];
    var gens = [];
    games.forEach(function (g) {
      var allowed = U.allowedPlatformLabel(g.platform);
      if (allowed) plats.push(allowed);
      U.splitGenres(g.genre).forEach(function (en) { gens.push(U.genreZh(en)); });
    });
    if (platform) U.fillSelect(platform, U.ALLOWED_PLATFORMS, "全部平台");
    if (genre) U.fillSelect(genre, U.uniqueSorted(gens), "全部類型");
    page = 1;
    render();
    if (window.PWAmiao && data && data.ok) {
      window.PWAmiao.setContext({ unplayed: U.formatInt(stats.todo) });
    }
  }).catch(function () {
    payload = { ok: false, reason: "unreachable" };
    renderStats(null);
    renderPlaying([]);
    renderRecent([]);
    render();
  });
})();
