/* Recent videos. Home already bakes skip-latest via data.more.
   Other pages: data-skip-latest="false" includes the newest video. */
(function () {
  "use strict";
  var mount = document.querySelector("[data-videos], [data-video-list]");
  if (!mount) return;
  var skip = mount.getAttribute("data-skip-latest") === "true";
  var count = parseInt(mount.getAttribute("data-count") || "3", 10) || 3;

  function fromPayload(d) {
    if (!d) return [];
    var latest = d.latest ? [d.latest] : [];
    var more = Array.isArray(d.more) ? d.more : [];
    var all = skip ? more : latest.concat(more);
    return all.slice(0, count);
  }
  function load(url) {
    return fetch(url).then(function (r) { return r.ok ? r.json() : null; });
  }
  function render(list) {
    if (!list.length) {
      mount.innerHTML = "<p class=\"muted\">暫時還沒有影片可以顯示。</p>";
      return;
    }
    if (window.PW && typeof PW.cardsHTML === "function") {
      /* The page may already carry these cards baked in (no layout shift). Keep them if nothing changed. */
      if (!(PW.sameLinks && PW.sameLinks(mount, "a.vcard", list))) mount.innerHTML = PW.cardsHTML(list);
      mount.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
      return;
    }
    mount.innerHTML = list.map(function (v) {
      var href = v.url || (v.id ? "https://www.youtube.com/watch?v=" + v.id : "#");
      return '<a class="vcard" href="' + href + '"><span class="vtitle"></span></a>';
    }).join("");
  }

  load("/api/latest")
    .then(function (d) { return d && (d.latest || d.more) ? d : load("/data/latest.json"); })
    .catch(function () { return load("/data/latest.json"); })
    .then(function (d) { render(fromPayload(d)); })
    .catch(function () { render([]); });
})();
