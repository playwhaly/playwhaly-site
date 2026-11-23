(function () {
  "use strict";
  var WD = "日一二三四五六";
  var storeFilter = "";
  var SHORT_STORE = { epic: "Epic", steam: "Steam", gog: "GOG", itch: "itch.io", indiegala: "IndieGala", stove: "STOVE", meta: "Meta" };
  var data = { current: [], upcoming: [], loot: [], ended: [] };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function sgtParts(iso) {
    if (!iso) return null;
    var t = Date.parse(iso);
    if (!isFinite(t)) return null;
    var d = new Date(t + 8 * 3600000);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, day: d.getUTCDate(), w: d.getUTCDay() };
  }
  function formatEnds(iso) {
    if (window.PW && PW.formatEndsSGT) return PW.formatEndsSGT(iso);
    var p = sgtParts(iso);
    return p ? p.m + "月" + p.day + "日（" + WD.charAt(p.w) + "）截止" : "";
  }
  function formatStarts(iso) {
    var p = sgtParts(iso);
    return p ? p.m + "月" + p.day + "日（" + WD.charAt(p.w) + "）開始" : "";
  }
  function remaining(iso) {
    if (window.PW && PW.remainingFree) return PW.remainingFree(iso);
    var end = Date.parse(iso);
    if (!isFinite(end)) return null;
    var ms = end - Date.now();
    if (ms <= 0) return null;
    var hours = Math.ceil(ms / 3600000);
    var days = Math.ceil(ms / 86400000);
    return { text: hours < 24 ? "剩 " + hours + " 小時" : "剩 " + days + " 天", until: formatEnds(iso) };
  }
  function displayTitle(g) {
    var zh = (g.title_zh || g.title || "").trim();
    var en = (g.title_en || "").trim();
    if (zh && en && zh !== en) return '<span class="gz">' + esc(zh) + "</span> <span class=\"ge\">" + esc(en) + "</span>";
    return '<span class="gz">' + esc(zh || en) + "</span>";
  }
  function kindOf(g) {
    var k = String(g.kind || "game").toLowerCase();
    if (k === "dlc") return "dlc";
    return "game";
  }
  function kindTag(g, mode) {
    if (mode === "ended") return '<span class="free-kind">' + (kindOf(g) === "dlc" ? "道具" : "遊戲") + "</span>";
    if (kindOf(g) === "dlc") return "";
    if (String(g.kind || "").toLowerCase() === "bundle") return '<span class="free-kind">遊戲包</span>';
    return "";
  }
  function recBadge(g) {
    return g.recommended ? '<span class="free-rec">威利推薦</span>' : "";
  }
  function coverBlock(g, href, linked, eager) {
    var src = g.cover || g.image || "";
    var img = src
      ? '<img src="' + esc(src) + '" alt="" width="1280" height="720" loading="' + (eager ? "eager" : "lazy") + '" decoding="async">'
      : '<div class="free-cover-ph">' + esc(g.title_zh || g.title || g.title_en || "") + "</div>";
    var tags = '<span class="free-store">' + esc(g.storeLabel || g.platform || g.store) + "</span>" + recBadge(g);
    if (linked && href) {
      return '<a class="free-media" href="' + esc(href) + '" target="_blank" rel="noopener" tabindex="-1">' + img + tags + "</a>";
    }
    return '<div class="free-media">' + img + tags + "</div>";
  }
  function officialUrl(href) {
    return href && !/gamerpower/i.test(href);
  }
  function card(g, mode, i) {
    var href = g.claimUrl || "";
    var official = officialUrl(href);
    var cls = "free-card free-offer" + (mode === "current" ? " free-card-lg" : " is-dim") + (kindOf(g) === "dlc" ? " is-loot" : "");
    var mid = "";
    if (mode === "current") {
      var left = remaining(g.endsAt);
      /* No published end date: show 限時免費 without a countdown. */
      mid =
        '<p class="free-left"' + (g.endsAt ? ' data-ends="' + esc(g.endsAt) + '"' : "") + ">" +
        esc(left ? left.text : "限時免費") + "</p>" +
        '<p class="free-until">' + esc(left ? left.until : g.endsAt ? formatEnds(g.endsAt) : "截止時間未公布") + "</p>" +
        (official ? '<a class="btn btn-primary" href="' + esc(href) + '" target="_blank" rel="noopener">' +
          (kindOf(g) === "dlc" ? "前往領取" : "領取") + "</a>" : "");
    } else if (mode === "upcoming") {
      mid = '<p class="free-when">' + esc(formatStarts(g.startsAt)) + "</p>";
    } else {
      mid = '<p class="free-ended"><span class="free-ended-tag">已結束</span> ' + esc(formatEnds(g.endsAt || g.endedAt)) + "</p>";
    }
    return (
      '<article class="' + cls + '" data-store="' + esc(g.store || "") + '" data-kind="' + esc(kindOf(g)) + '">' +
        coverBlock(g, official && mode === "current" ? href : "", mode === "current" && official,
          mode === "current" && kindOf(g) !== "dlc" && i < 3) +
        '<h3 class="free-title">' + displayTitle(g) + kindTag(g, mode) + "</h3>" +
        mid +
      "</article>"
    );
  }
  function renderLists() {
    function fill(id, list, mode) {
      var el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = (list || []).map(function (g, i) { return card(g, mode, i); }).join("");
    }
    fill("free-now", data.current, "current");
    fill("free-upcoming", data.upcoming, "upcoming");
    fill("free-loot-now", data.loot, "current");
    fill("free-ended", data.ended, "ended");
    var now = document.getElementById("free-now");
    if (now) now.classList.toggle("is-many", data.current.length > 4);
    renderStoreChips();
    applyFilter();
  }
  function setCount(id, n) {
    var el = document.getElementById(id);
    if (el) el.textContent = n ? "（" + n + "）" : "";
  }
  function applyFilter() {
    document.querySelectorAll(".free-offer").forEach(function (cardEl) {
      cardEl.hidden = Boolean(storeFilter) && cardEl.getAttribute("data-store") !== storeFilter;
    });
    function visibleIn(sec) {
      var n = 0;
      sec.querySelectorAll(".free-offer").forEach(function (c) { if (!c.hidden) n++; });
      return n;
    }
    var counts = {};
    document.querySelectorAll("[data-free-section]").forEach(function (sec) {
      var key = sec.getAttribute("data-free-section");
      var n = visibleIn(sec);
      counts[key] = n;
      /* 最近結束 only exists when the history store sent something. */
      sec.hidden = key === "current" ? false : n === 0;
    });
    var gamesNow = counts.current || 0;
    var lootNow = counts["loot-current"] || 0;
    var current = document.querySelector('[data-free-section="current"]');
    if (current) current.hidden = gamesNow === 0 && (counts.upcoming || 0) > 0;
    var gamesGroup = document.getElementById("free-games-group");
    if (gamesGroup) gamesGroup.hidden = gamesNow === 0 && !(counts.upcoming || 0);
    var lootGroup = document.getElementById("free-loot-group");
    if (lootGroup) lootGroup.hidden = lootNow === 0 && !(counts["loot-upcoming"] || 0);
    setCount("free-games-count", gamesNow);
    setCount("free-loot-count", lootNow);
    var empty = document.getElementById("free-empty");
    if (empty) {
      var any = gamesNow + lootNow + (counts.upcoming || 0) + (counts["loot-upcoming"] || 0);
      empty.hidden = any > 0;
    }
  }
  function setChipGroup(sel, attr, value) {
    document.querySelectorAll(sel).forEach(function (btn) {
      var on = (btn.getAttribute(attr) || "") === value;
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
  /* Store chips come from the stores that actually have something, so no chip leads to an empty page. */
  function renderStoreChips() {
    var mount = document.getElementById("free-store-chips");
    if (!mount) return;
    var seen = {};
    var order = [];
    data.current.concat(data.upcoming, data.loot).forEach(function (g) {
      var id = g.store || "";
      /* Publisher pages (ids are host names) do not get a chip; stores do. */
      if (!id || seen[id] || id.indexOf(".") !== -1) return;
      seen[id] = SHORT_STORE[id] || String(g.storeLabel || g.platform || id).replace(/（.*）$/, "");
      order.push(id);
    });
    if (storeFilter && !seen[storeFilter]) storeFilter = "";
    var html = '<button type="button" class="filter-chip" data-store-filter="">全部商店</button>';
    order.forEach(function (id) {
      html += '<button type="button" class="filter-chip" data-store-filter="' + esc(id) + '">' + esc(seen[id]) + "</button>";
    });
    mount.innerHTML = html;
    mount.hidden = order.length < 2;
    setChipGroup("[data-store-filter]", "data-store-filter", storeFilter);
  }
  function bindFilters() {
    var mount = document.getElementById("free-store-chips");
    if (!mount) return;
    mount.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("[data-store-filter]") : null;
      if (!btn) return;
      storeFilter = btn.getAttribute("data-store-filter") || "";
      setChipGroup("[data-store-filter]", "data-store-filter", storeFilter);
      applyFilter();
    });
  }
  function fillClaim(count) {
    var num = document.getElementById("claim-count-num");
    var wrap = document.getElementById("claim-count");
    if (!wrap) return;
    if (count != null && count !== "" && Number(count) > 0) {
      if (num) num.textContent = Number(count).toLocaleString("zh-Hant");
      wrap.hidden = false;
    } else {
      wrap.hidden = true;
    }
  }
  function renderFollow(site) {
    var mount = document.getElementById("follow-row");
    var card = document.getElementById("follow-card");
    if (!mount) return;
    var html = PW.followHTML(site);
    /* /free.html ships with this row baked in. Only touch it if site.json says something different. */
    if (mount.innerHTML.trim() !== html) mount.innerHTML = html;
    if (card) card.hidden = !html;
  }
  function normalizeGames(list) {
    return (list || []).map(function (g) {
      return Object.assign({}, g, {
        cover: g.cover || g.image || "",
        title_zh: g.title_zh || g.title || "",
        storeLabel: g.storeLabel || g.platform || ""
      });
    });
  }

  bindFilters();
  /* The follow block only needs site.json, so it does not wait for the game list (less layout shift). */
  fetch("/site.json")
    .then(function (r) { return r.ok ? r.json() : {}; })
    .catch(function () { return {}; })
    .then(function (site) { renderFollow(site || {}); });
  fetch("/api/free-games")
    .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function (payload) {
      payload = payload || {};
      data.current = normalizeGames(payload.games);
      data.upcoming = normalizeGames(payload.upcoming);
      data.loot = normalizeGames(payload.loot);
      data.ended = normalizeGames(payload.ended);
      fillClaim(payload.seenCount);
      renderLists();
      if (window.PWAmiao) {
        window.PWAmiao.setContext({ liveCount: data.current.length });
      }
    })
    .catch(function () {
      var empty = document.getElementById("free-empty");
      if (empty) {
        empty.hidden = false;
        empty.textContent = "暫時讀不到免費遊戲清單，請稍後再試～";
      }
      var chips = document.getElementById("free-store-chips");
      if (chips) chips.hidden = true;
      document.querySelectorAll("[data-free-section]").forEach(function (sec) { sec.hidden = true; });
      var loot = document.getElementById("free-loot-group");
      if (loot) loot.hidden = true;
    });
})();
