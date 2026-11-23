(function () {
  "use strict";
  var U = window.PWGames;
  var games = [];
  var payload = null;
  var tbody = document.getElementById("game-rows");
  var foot = document.getElementById("list-foot");
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
    var query = ((q && q.value) || "").trim().toLowerCase();
    if (query) {
      var blob = ((g.display_name || "") + " " + (g.name_zh || "") + " " + (g.name_en || "")).toLowerCase();
      if (blob.indexOf(query) === -1) return false;
    }
    var st = statusFilter();
    if (st && U.statusLabel(g.status) !== st) return false;
    if (platform && platform.value && U.platforms(g.platform).indexOf(platform.value) === -1) return false;
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

  function render() {
    if (!tbody) return;
    if (!games.length) {
      tbody.innerHTML = '<tr><td colspan="5">' + U.esc(emptyCopy()) + "</td></tr>";
      if (foot) foot.textContent = "";
      return;
    }
    var rows = games.filter(matches);
    tbody.innerHTML = rows.map(function (g) {
      var name = U.fullName(g);
      var genreLabel = U.genresLabel(g.genre);
      return '<tr><td class="col-name" title="' + U.esc(name) + '">' + U.displayName(g) +
        '</td><td class="col-platform">' + U.esc(g.platform || "—") +
        '</td><td class="col-status">' + U.statusChip(g.status) +
        '</td><td class="col-genre" title="' + U.esc(genreLabel) + '">' + U.esc(genreLabel) +
        '</td><td class="col-release">' + U.esc(U.formatRelease(g.release_date)) + "</td></tr>";
    }).join("");
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5">' + U.esc(emptyCopy()) + "</td></tr>";
    }
    if (foot) foot.textContent = "顯示 " + rows.length + "／" + games.length + " 款。";
  }

  document.querySelectorAll(".library .filter-chip").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".library .filter-chip").forEach(function (b) {
        b.classList.toggle("is-on", b === btn);
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      render();
    });
  });
  if (q) q.addEventListener("input", render);
  if (platform) platform.addEventListener("change", render);
  if (genre) genre.addEventListener("change", render);

  U.loadBacklog().then(function (data) {
    payload = data;
    games = (data && data.ok && Array.isArray(data.games)) ? data.games : [];
    renderStats(data && data.ok ? data.stats : null);
    renderPlaying(data && data.ok ? data.playing : []);
    renderRecent(data && data.ok ? data.recentlyCompleted : []);
    var plats = [];
    var gens = [];
    games.forEach(function (g) {
      U.platforms(g.platform).forEach(function (p) { plats.push(p); });
      U.splitGenres(g.genre).forEach(function (en) { gens.push(U.genreZh(en)); });
    });
    if (platform) U.fillSelect(platform, U.uniqueSorted(plats), "全部平台");
    if (genre) U.fillSelect(genre, U.uniqueSorted(gens), "全部類型");
    render();
    if (window.PWAmiao && data && data.ok && data.stats && data.stats.todo != null) {
      window.PWAmiao.setContext({ unplayed: U.formatInt(data.stats.todo) });
    }
  }).catch(function () {
    payload = { ok: false, reason: "unreachable" };
    renderStats(null);
    renderPlaying([]);
    renderRecent([]);
    render();
  });
})();
