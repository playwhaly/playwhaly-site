/* 阿喵 corner: lines and templates come from /amiao.json. No AI or extra API calls. */
(function () {
  "use strict";
  var STORAGE = "amiao-bubble-closed";
  var context = {};
  var cfg = null;
  var pageCfg = null;
  var host = null;
  var preferTemplates = false;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function joinDir(dir, file) {
    var d = String(dir || "/assets/amiao/");
    if (d.charAt(d.length - 1) !== "/") d += "/";
    return d + String(file || "normal.webp").replace(/^\//, "");
  }
  function fillTemplate(text, ctx) {
    return String(text || "").replace(/\{([a-zA-Z0-9_]+)\}/g, function (_, key) {
      return ctx[key] != null && ctx[key] !== "" ? String(ctx[key]) : "";
    });
  }
  function canFill(text, ctx) {
    var ok = true;
    String(text || "").replace(/\{([a-zA-Z0-9_]+)\}/g, function (_, key) {
      if (ctx[key] == null || ctx[key] === "") ok = false;
      return "";
    });
    return ok && /\{[a-zA-Z0-9_]+\}/.test(String(text || "")) ? true : (String(text || "").indexOf("{") === -1 || ok);
  }
  function readyTemplate(entry, ctx) {
    if (!entry) return "";
    var text = typeof entry === "string" ? entry : entry.text;
    var when = typeof entry === "string" ? null : entry.when;
    if (when && (ctx[when] == null || ctx[when] === "")) return "";
    if (!canFill(text, ctx)) return "";
    var filled = fillTemplate(text, ctx);
    return filled && filled.indexOf("{") === -1 ? filled : "";
  }
  function pool() {
    var items = ((pageCfg && pageCfg.lines) || []).filter(Boolean);
    var temps = [];
    ((pageCfg && pageCfg.templates) || []).forEach(function (entry) {
      var line = readyTemplate(entry, context);
      if (line) temps.push(line);
    });
    if (preferTemplates && temps.length) return temps;
    return items.concat(temps);
  }
  function pick(list) {
    if (!list.length) return "";
    return list[Math.floor(Math.random() * list.length)];
  }
  function isMobile() {
    return window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
  }
  function readClosed() {
    try { return sessionStorage.getItem(STORAGE) === "1"; } catch (e) { return false; }
  }
  function writeClosed(on) {
    try {
      if (on) sessionStorage.setItem(STORAGE, "1");
      else sessionStorage.removeItem(STORAGE);
    } catch (e) {}
  }
  function setBubbleOpen(open) {
    if (!host) return;
    host.classList.toggle("is-open", open);
    host.classList.toggle("is-closed", !open);
    var bubble = host.querySelector(".amiao-corner-bubble");
    if (bubble) bubble.hidden = !open;
  }
  function showLine(text) {
    if (!host) return;
    var lineEl = host.querySelector(".amiao-corner-line-text");
    if (lineEl) lineEl.textContent = text || "";
    if (text && !readClosed()) setBubbleOpen(!isMobile() || host.classList.contains("is-open"));
  }
  function refresh() {
    var line = pick(pool());
    showLine(line);
  }
  function mount(config) {
    cfg = config || {};
    var page = (document.body && document.body.getAttribute("data-page")) || "";
    pageCfg = (cfg.pages && cfg.pages[page]) || null;
    document.querySelectorAll("[data-amiao-credit]").forEach(function (el) {
      if (cfg.credit) el.textContent = cfg.credit;
    });
    host = document.getElementById("amiao-corner");
    if (!host || !pageCfg) return;
    var who = cfg.who || "阿喵";
    var closeLabel = cfg.closeLabel || "關閉對話";
    var openLabel = cfg.openLabel || "阿喵說的話";
    host.className = "amiao-corner";
    host.removeAttribute("hidden");
    host.innerHTML =
      '<button type="button" class="amiao-corner-toggle" aria-label="' + esc(openLabel) + '" aria-expanded="false">' +
        '<img class="amiao-corner-avatar" alt="' + esc(who) + '" width="52" height="52">' +
        '<span class="amiao-corner-ph" hidden>阿喵</span>' +
      "</button>" +
      '<div class="amiao-corner-bubble">' +
        '<button type="button" class="amiao-corner-close" aria-label="' + esc(closeLabel) + '">×</button>' +
        '<p class="amiao-corner-line"><span class="amiao-corner-who">' + esc(who) + "</span>" +
        '<span class="amiao-corner-line-text"></span></p>' +
      "</div>";
    var img = host.querySelector(".amiao-corner-avatar");
    var ph = host.querySelector(".amiao-corner-ph");
    img.src = joinDir(cfg.imageDir, pageCfg.image);
    img.addEventListener("error", function () {
      img.hidden = true;
      if (ph) ph.hidden = false;
    });
    var toggle = host.querySelector(".amiao-corner-toggle");
    var closeBtn = host.querySelector(".amiao-corner-close");
    toggle.addEventListener("click", function () {
      if (host.classList.contains("is-open")) {
        writeClosed(true);
        setBubbleOpen(false);
        toggle.setAttribute("aria-expanded", "false");
      } else {
        writeClosed(false);
        if (!host.querySelector(".amiao-corner-line-text").textContent) refresh();
        setBubbleOpen(true);
        toggle.setAttribute("aria-expanded", "true");
      }
    });
    closeBtn.addEventListener("click", function () {
      writeClosed(true);
      setBubbleOpen(false);
      toggle.setAttribute("aria-expanded", "false");
    });
    var startOpen = !readClosed() && !isMobile();
    setBubbleOpen(startOpen);
    toggle.setAttribute("aria-expanded", startOpen ? "true" : "false");
    refresh();
    if (isMobile() && !readClosed()) setBubbleOpen(false);
  }

  window.PWAmiao = {
    setContext: function (partial, opts) {
      Object.keys(partial || {}).forEach(function (k) { context[k] = partial[k]; });
      preferTemplates = !!(opts && opts.preferTemplates);
      if (host && pageCfg) refresh();
      preferTemplates = false;
    }
  };

  fetch("/amiao.json")
    .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
    .then(mount)
    .catch(function () {});
})();
