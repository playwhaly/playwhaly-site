/* Shared helpers for /backlog and /spin. */
(function (root) {
  "use strict";

  var GENRE_ZH = {
    "Adventure": "冒險",
    "Indie": "獨立",
    "Role-playing (RPG)": "角色扮演",
    "RPG": "角色扮演",
    "Strategy": "策略",
    "Simulator": "模擬",
    "Puzzle": "解謎",
    "Shooter": "射擊",
    "Platform": "平台動作",
    "Arcade": "街機",
    "Hack and slash/Beat 'em up": "動作砍殺",
    "Turn-based strategy (TBS)": "回合策略",
    "Tactical": "戰術",
    "Point-and-click": "點選冒險",
    "Fighting": "格鬥",
    "Sport": "運動",
    "Sports": "運動",
    "Real Time Strategy (RTS)": "即時戰略",
    "Racing": "競速",
    "Card & Board Game": "卡牌桌遊",
    "Visual Novel": "視覺小說",
    "Music": "音樂",
    "Pinball": "彈珠台",
    "Quiz/Trivia": "問答",
    "MOBA": "MOBA"
  };

  var SHORT_ZH = {
    "戰神：諸神黃昏": "諸神黃昏",
    "進擊羔羊傳說": "進擊羔羊",
    "黑暗靈魂 3": "黑暗靈魂 III",
    "女神異聞錄 5 皇家版": "女神異聞錄 5",
    "鬼山魔音：擴散": "鬼山魔音",
    "最後生還者 二部曲": "最後生還者 2",
    "地平線：西域禁地 完全版": "西域禁地",
    "尼爾：自動人形": "尼爾：自動人形"
  };

  function splitGenres(raw) {
    return String(raw || "").split(/[,、;/]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function genreZh(en) { return GENRE_ZH[en] || en; }
  function genresLabel(raw) {
    return splitGenres(raw).map(genreZh).join("、") || "—";
  }
  function platforms(raw) {
    return String(raw || "").split(/[·•|,;/]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function formatRelease(s) {
    if (!s) return "—";
    var t = String(s).trim();
    var m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return m[3] + "年" + Number(m[2]) + "月" + Number(m[1]) + "日";
    m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return m[1] + "年" + Number(m[2]) + "月" + Number(m[3]) + "日";
    return t;
  }
  function fullName(g) {
    var zh = (g.name_zh || "").trim();
    var en = (g.name_en || "").trim();
    if (zh && en) return zh + " " + en;
    return g.display_name || en || zh || "";
  }
  function displayName(g) {
    var zh = (g.name_zh || "").trim();
    var en = (g.name_en || "").trim();
    if (zh && en) {
      return '<span class="gn"><span class="gz">' + esc(zh) + '</span> <span class="ge">' + esc(en) + "</span></span>";
    }
    return '<span class="gn"><span class="gz">' + esc(g.display_name || en || zh) + "</span></span>";
  }
  function shortName(g) {
    var zh = (g.name_zh || "").trim();
    var en = (g.name_en || g.display_name || "").trim();
    var s = zh || en;
    if (zh && SHORT_ZH[zh]) return SHORT_ZH[zh];
    s = s.replace(/[：:]\s*(導演剪輯版|導演版|最終剪輯版|皇家版|完全版|重製版|加強版|強化版).*$/, "");
    s = s.replace(/\s*(導演剪輯版|導演版|最終剪輯版|皇家版|完全版)$/, "");
    s = s.replace(/:\s*(Director'?s Cut|The Final Cut|Royal|Complete Edition|Remastered|Enhanced Edition).*$/i, "");
    s = s.replace(/\s+(Director'?s Cut|The Final Cut|Royal|Complete Edition)$/i, "");
    if (s.indexOf("：") !== -1 && s.length > 6) s = s.split("：").pop();
    return s.trim() || en;
  }
  function shortFontSize(label) {
    var n = Array.from(label).length;
    if (n <= 6) return 15;
    if (n <= 8) return 13.5;
    return 12;
  }
  function steamAppId(g) {
    if (g && g.steam_appid) return String(g.steam_appid);
    var src = String((g && (g.sources || g.source)) || "").toLowerCase();
    var id = String((g && g.store_game_id) || "");
    if ((src.indexOf("steam") !== -1 || !src) && /^\d+$/.test(id)) return id;
    return "";
  }
  function coverSrc(g) {
    var id = steamAppId(g);
    if (id) return "https://cdn.cloudflare.steamstatic.com/steam/apps/" + id + "/header.jpg";
    return (g && g.cover) || "";
  }
  function coverFallback(g) {
    var id = steamAppId(g);
    if (id) return "https://cdn.cloudflare.steamstatic.com/steam/apps/" + id + "/library_600x900.jpg";
    return "";
  }
  function storeUrl(g) {
    if (g && g.store_url) return g.store_url;
    var id = steamAppId(g);
    if (id) return "https://store.steampowered.com/app/" + id + "/";
    return "";
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function statusLabel(s) {
    var v = String(s || "").trim();
    var map = {
      completed: "已完成", done: "已完成", finished: "已完成", "已完成": "已完成",
      playing: "遊玩中", "in progress": "遊玩中", "in-progress": "遊玩中", "遊玩中": "遊玩中",
      planned: "未玩", backlog: "未玩", todo: "未玩", unplayed: "未玩", "未玩": "未玩"
    };
    return map[v] || map[v.toLowerCase()] || v || "未玩";
  }
  function statusChip(status) {
    var label = statusLabel(status);
    var cls = label === "已完成" ? "status-done" : label === "遊玩中" ? "status-play" : "status-todo";
    return '<span class="status-chip ' + cls + '">' + esc(label) + "</span>";
  }
  function uniqueSorted(values) {
    return values.filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) {
      return String(a).localeCompare(String(b), "zh-Hant");
    });
  }
  function fillSelect(sel, values, allLabel) {
    var current = sel.value;
    sel.innerHTML = "";
    var all = document.createElement("option");
    all.value = "";
    all.textContent = allLabel;
    sel.appendChild(all);
    values.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      sel.appendChild(o);
    });
    if (current) sel.value = current;
  }
  function formatInt(n) {
    return Number(n || 0).toLocaleString("zh-Hant");
  }

  var PAGE_SIZE = 50;
  function pageSlice(rows, page, size) {
    var list = Array.isArray(rows) ? rows : [];
    var pageSize = size || PAGE_SIZE;
    var pages = Math.max(1, Math.ceil(list.length / pageSize) || 1);
    var p = Math.min(pages, Math.max(1, page || 1));
    var start = (p - 1) * pageSize;
    var items = list.slice(start, start + pageSize);
    return {
      items: items,
      page: p,
      pageSize: pageSize,
      total: list.length,
      start: list.length ? start + 1 : 0,
      end: Math.min(start + items.length, list.length),
      pages: pages
    };
  }
  function keyOf(g) { return g.id || g.playnite_id || g.name_en || g.display_name || g.name_zh; }
  function loadBacklog() {
    return fetch("/api/backlog").then(function (r) { return r.json(); });
  }

  root.PWGames = {
    splitGenres: splitGenres,
    genreZh: genreZh,
    genresLabel: genresLabel,
    platforms: platforms,
    formatRelease: formatRelease,
    fullName: fullName,
    displayName: displayName,
    shortName: shortName,
    shortFontSize: shortFontSize,
    steamAppId: steamAppId,
    coverSrc: coverSrc,
    coverFallback: coverFallback,
    storeUrl: storeUrl,
    esc: esc,
    statusLabel: statusLabel,
    statusChip: statusChip,
    uniqueSorted: uniqueSorted,
    fillSelect: fillSelect,
    formatInt: formatInt,
    keyOf: keyOf,
    PAGE_SIZE: PAGE_SIZE,
    pageSlice: pageSlice,
    loadBacklog: loadBacklog
  };
})(window);
