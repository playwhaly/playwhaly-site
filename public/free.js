(function () {
  "use strict";
  var WD = "日一二三四五六";
  var storeFilter = "";
  var kindFilter = "";
  var data = { current: [], upcoming: [], ended: [] };

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
  function kindTag(g) {
    if (kindOf(g) === "dlc") return '<span class="free-kind">DLC</span>';
    if (String(g.kind || "").toLowerCase() === "bundle") return '<span class="free-kind">遊戲包</span>';
    return "";
  }
  function recBadge(g) {
    return g.recommended ? '<span class="free-rec">威利推薦</span>' : "";
  }
  function coverBlock(g, href, linked) {
    var src = g.cover || g.image || "";
    var img = src
      ? '<img src="' + esc(src) + '" alt="" width="1280" height="720" loading="eager" decoding="async">'
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
  function card(g, mode) {
    var href = g.claimUrl || "";
    var official = officialUrl(href);
    var cls = "free-card free-offer" + (mode === "current" ? " free-card-lg" : " is-dim");
    var mid = "";
    if (mode === "current") {
      var left = remaining(g.endsAt);
      mid =
        '<p class="free-left"' + (g.endsAt ? ' data-ends="' + esc(g.endsAt) + '"' : "") + ">" +
        esc(left ? left.text : "限時免費") + "</p>" +
        '<p class="free-until">' + esc(left ? left.until : formatEnds(g.endsAt)) + "</p>" +
        (official ? '<a class="btn btn-primary" href="' + esc(href) + '" target="_blank" rel="noopener">領取</a>' : "");
    } else if (mode === "upcoming") {
      mid = '<p class="free-when">' + esc(formatStarts(g.startsAt)) + "</p>";
    } else {
      mid = '<p class="free-ended"><span class="free-ended-tag">已結束</span> ' + esc(formatEnds(g.endsAt || g.endedAt)) + "</p>";
    }
    return (
      '<article class="' + cls + '" data-store="' + esc(g.store || "") + '" data-kind="' + esc(kindOf(g)) + '">' +
        coverBlock(g, official && mode === "current" ? href : "", mode === "current" && official) +
        '<h3 class="free-title">' + displayTitle(g) + kindTag(g) + "</h3>" +
        mid +
      "</article>"
    );
  }
  function renderLists() {
    function fill(id, list, mode) {
      var el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = (list || []).map(function (g) { return card(g, mode); }).join("");
    }
    fill("free-now", data.current, "current");
    fill("free-upcoming", data.upcoming, "upcoming");
    fill("free-ended", data.ended, "ended");
    applyFilter();
  }
  function applyFilter() {
    document.querySelectorAll(".free-offer").forEach(function (cardEl) {
      var ok = true;
      if (storeFilter && cardEl.getAttribute("data-store") !== storeFilter) ok = false;
      if (kindFilter && cardEl.getAttribute("data-kind") !== kindFilter) ok = false;
      cardEl.hidden = !ok;
    });
    document.querySelectorAll("[data-free-section]").forEach(function (sec) {
      var any = false;
      sec.querySelectorAll(".free-offer").forEach(function (c) { if (!c.hidden) any = true; });
      /* Upcoming/ended stay hidden when the API sent nothing at all. */
      var key = sec.getAttribute("data-free-section");
      var source = key === "upcoming" ? data.upcoming : key === "ended" ? data.ended : data.current;
      if (key !== "current" && !(source && source.length)) {
        sec.hidden = true;
        return;
      }
      sec.hidden = !any;
    });
    var empty = document.getElementById("free-empty");
    if (empty) {
      var anyVisible = false;
      document.querySelectorAll(".free-offer").forEach(function (c) { if (!c.hidden) anyVisible = true; });
      empty.hidden = anyVisible;
    }
  }
  function setChipGroup(sel, attr, value) {
    document.querySelectorAll(sel).forEach(function (btn) {
      var on = (btn.getAttribute(attr) || "") === value;
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
  function bindFilters() {
    document.querySelectorAll("[data-store-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        storeFilter = btn.getAttribute("data-store-filter") || "";
        setChipGroup("[data-store-filter]", "data-store-filter", storeFilter);
        applyFilter();
      });
    });
    document.querySelectorAll("[data-kind-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        kindFilter = btn.getAttribute("data-kind-filter") || "";
        setChipGroup("[data-kind-filter]", "data-kind-filter", kindFilter);
        applyFilter();
      });
    });
  }
  function iconSvg(id) {
    if (id === "ig") {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>';
    }
    if (id === "threads") {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16.5 11.5c-.3-3-2-4.5-4.6-4.5-2.8 0-4.6 2-4.6 5s1.8 5 4.8 5c2.4 0 4-1.3 4-3.2 0-2-1.8-2.9-4-2.6-1.7.2-2.6 1.1-2.4 2.2"/><circle cx="12" cy="12" r="9.5"/></svg>';
    }
    if (id === "facebook") {
      return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v8h4v-8H16l.6-4h-3.1V9c0-.6.4-1 1-1z"/></svg>';
    }
    if (id === "discord") {
      return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.6 5.3A16 16 0 0 0 15.6 4l-.5 1a15 15 0 0 0-6.2 0l-.5-1a16 16 0 0 0-4 1.3C1.9 9.1 1.2 12.8 1.5 16.4a16 16 0 0 0 4.9 2.5l1-1.6-1.6-.8.4-.3a11.4 11.4 0 0 0 9.6 0l.4.3-1.6.8 1 1.6a16 16 0 0 0 4.9-2.5c.4-4.2-.7-7.9-2.9-11.1zM8.7 14.2c-1 0-1.7-.9-1.7-2s.8-2 1.7-2 1.8.9 1.7 2c0 1.1-.8 2-1.7 2zm6.6 0c-1 0-1.7-.9-1.7-2s.8-2 1.7-2 1.8.9 1.7 2c0 1.1-.8 2-1.7 2z"/></svg>';
    }
    return "";
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
    var pills = ((site && site.followPlatforms) || []).map(function (p) {
      if (!p || !p.href || !p.label) return "";
      return '<a class="follow-pill follow-pill--' + esc(p.id || "") + '" href="' + esc(p.href) +
        '" target="_blank" rel="noopener">' + iconSvg(p.id) + esc(p.label) + "</a>";
    }).join("");
    var invite = String((site && site.discordInvite) || "").trim();
    var dc = invite
      ? '<a class="follow-discord" href="' + esc(invite) + '">' + iconSvg("discord") + "加入 Discord</a>"
      : "";
    mount.innerHTML = pills + dc;
    if (card) card.hidden = !(pills || dc);
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
  Promise.all([
    fetch("/api/free-games").then(function (r) { return r.ok ? r.json() : Promise.reject(); }),
    fetch("/site.json").then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
  ]).then(function (pair) {
    var payload = pair[0] || {};
    var site = pair[1] || {};
    data.current = normalizeGames(payload.games);
    data.upcoming = normalizeGames(payload.upcoming);
    data.ended = normalizeGames(payload.ended);
    fillClaim(payload.seenCount);
    renderFollow(site);
    renderLists();
    if (window.PWAmiao) {
      window.PWAmiao.setContext({ liveCount: data.current.length });
    }
  }).catch(function () {
    renderFollow({});
    var empty = document.getElementById("free-empty");
    if (empty) {
      empty.hidden = false;
      empty.textContent = "暫時讀不到免費遊戲清單，請稍後再試～";
    }
    document.querySelectorAll("[data-free-section]").forEach(function (sec) { sec.hidden = true; });
  });
})();
