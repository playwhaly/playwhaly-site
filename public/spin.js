(function () {
  "use strict";
  var U = window.PWGames;
  var COLORS = ["#E4E7F8", "#F8EBDD", "#EDE4F6", "#F4F0E2", "#E3EEF6", "#F6E6E6", "#E7E3F7", "#EEF3EA", "#F8E8F0", "#E8F4F0", "#F7F0D8", "#E6EEF8"];
  var allTodo = [];
  var skipped = {};
  var visible = [];
  var current = null;
  var spinning = false;
  var rotation = 0;
  var fxOn = false;
  var payload = null;
  var wheel = document.getElementById("wheel");
  var btn = document.getElementById("spin-btn");
  var platform = document.getElementById("platform");
  var genre = document.getElementById("genre");
  var countEl = document.getElementById("pool-count");
  var resultEl = document.getElementById("result");
  var burst = document.getElementById("paw-burst");

  function matchesSpinnerPlatform(rawPlatforms, selectedValue) {
    if (!selectedValue) return U.hasAllowedPlatform(rawPlatforms);
    var indexByValue = { pc: 0, ps4: 1, ps5: 2 };
    var index = indexByValue[selectedValue];
    if (index == null) return false;
    return U.hasPlatform(rawPlatforms, U.ALLOWED_PLATFORMS[index]);
  }

  function fillSpinnerPlatforms() {
    if (!platform) return;
    platform.innerHTML = "";
    var all = document.createElement("option");
    all.value = "";
    all.textContent = "全部平台";
    platform.appendChild(all);
    U.ALLOWED_PLATFORMS.forEach(function (label, index) {
      var option = document.createElement("option");
      option.value = ["pc", "ps4", "ps5"][index];
      option.textContent = label;
      platform.appendChild(option);
    });
  }

  function pool() {
    return allTodo.filter(function (g) {
      if (skipped[U.keyOf(g)]) return false;
      if (!matchesSpinnerPlatform(g.platform, platform.value)) return false;
      if (genre.value && U.splitGenres(g.genre).map(U.genreZh).indexOf(genre.value) === -1) return false;
      return true;
    });
  }

  function shuffle(list) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
    }
    return copy;
  }

  function pickWheelGames(list, prefer) {
    if (!list.length) return [];
    var nMax = Math.min(12, list.length);
    var nMin = Math.min(8, list.length);
    var n = nMin + Math.floor(Math.random() * (nMax - nMin + 1));
    var copy = shuffle(list);
    if (prefer) {
      copy = copy.filter(function (g) { return U.keyOf(g) !== U.keyOf(prefer); });
      copy.unshift(prefer);
    }
    return copy.slice(0, n);
  }

  function wheelLabel(g) {
    var s = U.shortName(g);
    var chars = Array.from(s);
    if (chars.length > 9) return chars.slice(0, 8).join("") + "…";
    return s;
  }

  function paint(list) {
    visible = list;
    if (!list.length) {
      wheel.innerHTML = "";
      wheel.style.background = "#EEF0FB";
      return;
    }
    var n = list.length;
    var slice = 360 / n;
    var parts = [];
    list.forEach(function (g, i) {
      var a0 = (-90 - slice / 2 + slice * i) * Math.PI / 180;
      var a1 = (-90 - slice / 2 + slice * (i + 1)) * Math.PI / 180;
      var x0 = 200 + 200 * Math.cos(a0);
      var y0 = 200 + 200 * Math.sin(a0);
      var x1 = 200 + 200 * Math.cos(a1);
      var y1 = 200 + 200 * Math.sin(a1);
      var fill = COLORS[i % COLORS.length];
      parts.push('<path d="M200,200 L' + x0.toFixed(2) + "," + y0.toFixed(2) +
        " A200,200 0 0 1 " + x1.toFixed(2) + "," + y1.toFixed(2) + ' Z" fill="' + fill + '" stroke="#fff" stroke-width="2.5"/>');
    });
    list.forEach(function (g, i) {
      var mid = (-90 + slice * i) * Math.PI / 180;
      var r = n > 8 ? 122 : 128;
      var x = 200 + r * Math.cos(mid);
      var y = 200 + r * Math.sin(mid);
      var label = wheelLabel(g);
      var size = U.shortFontSize(label);
      parts.push('<text x="' + x.toFixed(2) + '" y="' + y.toFixed(2) +
        '" text-anchor="middle" dominant-baseline="middle" fill="#3A2E2A" font-family="Noto Sans CJK TC, Noto Sans TC, sans-serif" font-size="' +
        size + '" font-weight="700">' + U.esc(label) + "</text>");
    });
    wheel.innerHTML = '<svg viewBox="0 0 400 400" width="100%" height="100%" aria-hidden="true">' + parts.join("") + "</svg>";
    wheel.style.background = "transparent";
  }

  function emptyMessage() {
    if (!payload) return "暫時讀不到遊戲清單，請稍後再試～";
    if (payload.ok === false && payload.reason === "unset") {
      return payload.message || "遊戲清單還沒接上公開資料，稍後再來看看～";
    }
    if (payload.ok === false) {
      return payload.message || "暫時讀不到遊戲清單，請稍後再試～";
    }
    return "這個篩選條件下，沒有還沒玩的遊戲。";
  }

  function showResult(g) {
    current = g;
    var cover = U.coverSrc(g);
    var fb = U.coverFallback(g);
    var media;
    if (cover || fb) {
      media = '<img class="result-cover" src="' + U.esc(cover || fb) + '" alt="" width="460" height="215"' +
        (fb ? ' data-fb="' + U.esc(fb) + '"' : "") + ">";
    } else {
      media = '<div class="result-cover is-placeholder">封面</div>';
    }
    var href = U.storeUrl(g);
    var store = href
      ? '<a class="btn btn-primary" href="' + U.esc(href) + '" target="_blank" rel="noopener">' +
        U.esc(g.store_label || "在官方商店看看") + "</a>"
      : "";
    resultEl.innerHTML =
      '<div class="result-body">' +
        media +
        "<div>" + U.displayName(g) +
          '<p class="meta">' + U.esc(g.platform || "") + " · " + U.esc(U.genresLabel(g.genre)) + "</p>" +
          U.statusChip(g.status) +
          (store ? '<div class="result-store">' + store + "</div>" : "") +
        "</div>" +
      "</div>" +
      '<div class="result-actions">' +
        '<button type="button" class="btn btn-primary" id="again-btn">換一個</button>' +
        '<button type="button" class="btn btn-ghost" id="skip-btn">不要這款</button>' +
      "</div>";
    var coverImg = resultEl.querySelector("img.result-cover");
    if (coverImg) {
      coverImg.addEventListener("error", function onCoverErr() {
        var next = coverImg.getAttribute("data-fb");
        if (next && coverImg.getAttribute("src") !== next) { coverImg.src = next; return; }
        var ph = document.createElement("div");
        ph.className = "result-cover is-placeholder";
        ph.textContent = "封面";
        coverImg.replaceWith(ph);
      });
    }
    var again = document.getElementById("again-btn");
    var skip = document.getElementById("skip-btn");
    if (again) again.addEventListener("click", function () { respin(); });
    if (skip) skip.addEventListener("click", function () { skipCurrent(); });
    if (window.PWAmiao) {
      window.PWAmiao.setContext({ game: U.shortName(g) }, { preferTemplates: true });
    }
  }

  function playMeowPlaceholder() {
    try {
      var ctx = playMeowPlaceholder.ctx || (playMeowPlaceholder.ctx = new (window.AudioContext || window.webkitAudioContext)());
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(620, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(840, ctx.currentTime + 0.08);
      o.frequency.exponentialRampToValueAtTime(480, ctx.currentTime + 0.18);
      g.gain.setValueAtTime(0.04, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.24);
    } catch (e) { /* ignore */ }
  }

  function pawBurst() {
    if (!burst) return;
    burst.hidden = false;
    burst.innerHTML = "";
    for (var i = 0; i < 6; i++) {
      var p = document.createElement("span");
      p.className = "paw-pop";
      p.style.setProperty("--a", (i * 60) + "deg");
      p.style.animationDelay = (i * 0.03) + "s";
      p.innerHTML = '<svg fill="#8E98E6" viewBox="0 0 24 24"><ellipse cx="12" cy="15.5" rx="6.2" ry="5"/><circle cx="4.8" cy="8.6" r="2.15"/><circle cx="9" cy="5.8" r="2.35"/><circle cx="15.2" cy="5.8" r="2.35"/><circle cx="19.2" cy="8.6" r="2.15"/></svg>';
      burst.appendChild(p);
    }
    window.setTimeout(function () { burst.hidden = true; burst.innerHTML = ""; }, 700);
  }

  function celebrate() {
    if (!fxOn) return;
    pawBurst();
    playMeowPlaceholder();
  }

  function spinTo(chosen) {
    if (!chosen) return;
    var idx = -1;
    visible.forEach(function (g, i) { if (U.keyOf(g) === U.keyOf(chosen)) idx = i; });
    if (idx < 0) {
      paint(pickWheelGames(pool(), chosen));
      idx = 0;
    }
    var n = visible.length;
    var slice = 360 / n;
    var target = 360 * 5 - idx * slice;
    spinning = true;
    btn.disabled = true;
    wheel.style.transition = "transform 4s cubic-bezier(.12,.7,.12,1)";
    rotation = (rotation % 360) + target;
    wheel.style.transform = "rotate(" + rotation + "deg)";
    window.setTimeout(function () {
      spinning = false;
      btn.disabled = false;
      wheel.style.transition = "none";
      rotation = 0;
      wheel.style.transform = "rotate(0deg)";
      var rest = visible.filter(function (g) { return U.keyOf(g) !== U.keyOf(chosen); });
      paint([chosen].concat(rest));
      showResult(chosen);
      celebrate();
    }, 4100);
  }

  function respin() {
    if (spinning) return;
    var list = pool();
    if (!list.length) {
      resultEl.innerHTML = '<p class="result-placeholder">' + U.esc(emptyMessage()) + "</p>";
      paint([]);
      return;
    }
    var nextSet = pickWheelGames(list);
    paint(nextSet);
    var chosen = nextSet[Math.floor(Math.random() * nextSet.length)];
    spinTo(chosen);
  }

  function skipCurrent() {
    if (spinning || !current) return;
    skipped[U.keyOf(current)] = true;
    updateCount();
    respin();
  }

  function updateCount() {
    if (countEl) countEl.textContent = "未玩 " + pool().length + " 款";
  }

  function onFilterChange() {
    if (spinning) return;
    var list = pool();
    updateCount();
    btn.disabled = list.length === 0;
    if (!list.length) {
      paint([]);
      resultEl.innerHTML = '<p class="result-placeholder">' + U.esc(emptyMessage()) + "</p>";
      current = null;
      return;
    }
    var prefer = current && list.some(function (g) { return U.keyOf(g) === U.keyOf(current); }) ? current : null;
    paint(pickWheelGames(list, prefer || null));
    if (prefer) showResult(prefer);
  }

  if (platform) platform.addEventListener("change", onFilterChange);
  if (genre) genre.addEventListener("change", onFilterChange);
  if (btn) btn.addEventListener("click", function () { respin(); });
  var fxBtn = document.getElementById("fx-toggle");
  if (fxBtn) {
    fxBtn.addEventListener("click", function () {
      fxOn = !fxOn;
      fxBtn.setAttribute("aria-pressed", fxOn ? "true" : "false");
      fxBtn.textContent = fxOn ? "特效：開" : "特效：關";
    });
  }

  U.loadBacklog().then(function (data) {
    payload = data;
    allTodo = (data && data.ok && Array.isArray(data.games))
      ? data.games.filter(function (g) { return U.statusLabel(g.status) === "未玩"; })
      : [];
    var gens = [];
    allTodo.forEach(function (g) {
      U.splitGenres(g.genre).forEach(function (en) { gens.push(U.genreZh(en)); });
    });
    fillSpinnerPlatforms();
    if (genre) U.fillSelect(genre, U.uniqueSorted(gens), "全部類型");
    updateCount();
    if (!pool().length) {
      paint([]);
      resultEl.innerHTML = '<p class="result-placeholder">' + U.esc(emptyMessage()) + "</p>";
      btn.disabled = true;
      return;
    }
    paint(pickWheelGames(pool()));
    resultEl.innerHTML = '<p class="result-placeholder">按「轉！」從還沒玩的遊戲裡抽一個。</p>';
    btn.disabled = false;
  }).catch(function () {
    payload = { ok: false, reason: "unreachable" };
    resultEl.innerHTML = '<p class="result-placeholder">' + U.esc(emptyMessage()) + "</p>";
    if (btn) btn.disabled = true;
  });
  window.PWSpin = { matchesSpinnerPlatform: matchesSpinnerPlatform };
})();
