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
