/* Homepage destination-card teasers from live APIs. Never invent counts. */
(function () {
  "use strict";
  function $(sel) { return document.querySelector(sel); }
  function setText(sel, text) {
    var el = $(sel);
    if (el && text) el.textContent = text;
  }
  function formatInt(n) {
    return Number(n).toLocaleString("zh-Hant");
  }

  fetch("/api/free-games")
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !Array.isArray(d.games)) return;
      var n = d.games.length;
      if (n > 0) setText("[data-dest-free]", n + " 款正在送");
    })
    .catch(function () {});

  fetch("/api/backlog?view=stats")
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.ok || !d.stats) return;
      var s = d.stats;
      if (s.total > 0) {
        setText("[data-dest-backlog]", "已完成 " + formatInt(s.completed) + "／" + formatInt(s.total));
        var bar = document.querySelector("[data-dest-bar]");
        if (bar) {
          bar.hidden = false;
          var i = bar.querySelector("i");
          if (i) i.style.width = Math.max(0, Math.min(100, (s.completed / s.total) * 100)).toFixed(1) + "%";
        }
      }
      if (s.todo > 0) {
        setText("[data-dest-spin]", "從 " + formatInt(s.todo) + " 款還沒玩的裡面轉");
      }
    })
    .catch(function () {});
})();
