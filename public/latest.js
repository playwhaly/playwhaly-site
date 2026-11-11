(function () {
  var WATCH_HOST = /^(www\.)?youtube\.com$/;
  var VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

  function isWatchUrl(value) {
    try {
      var url = new URL(value);
      if (url.protocol !== "https:") return false;
      if (!WATCH_HOST.test(url.hostname)) return false;
      if (url.pathname !== "/watch") return false;
      return VIDEO_ID_RE.test(url.searchParams.get("v") || "");
    } catch {
      return false;
    }
  }

  function isThumbUrl(value) {
    try {
      var url = new URL(value);
      if (url.protocol !== "https:") return false;
      if (url.hostname !== "i.ytimg.com") return false;
      return /^\/vi\/[A-Za-z0-9_-]{11}\//.test(url.pathname);
    } catch {
      return false;
    }
  }

  function isItem(item) {
    return (
      item &&
      typeof item.title === "string" &&
      item.title.trim() !== "" &&
      isWatchUrl(item.url) &&
      isThumbUrl(item.thumbnail) &&
      Number.isFinite(Date.parse(item.published))
    );
  }

  function formatDate(published) {
    var parts = new Intl.DateTimeFormat("zh-Hant", {
      timeZone: "Asia/Singapore",
      month: "numeric",
      day: "numeric",
    }).formatToParts(new Date(published));
    var month = "";
    var day = "";
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].type === "month") month = parts[i].value;
      if (parts[i].type === "day") day = parts[i].value;
    }
    if (!month || !day) return "";
    return month + "月" + day + "日";
  }

  function fillCard(card, item) {
    if (!card || !isItem(item)) return false;
    var dateText = formatDate(item.published);
    if (!dateText) return false;
    var title = item.title.trim();
    card.setAttribute("href", item.url);
    var img = card.querySelector("img");
    if (img) {
      img.setAttribute("src", item.thumbnail);
      img.setAttribute("alt", title);
    }
    var titleEl = card.querySelector(".vcard-title");
    if (titleEl) titleEl.textContent = title;
    var dateEl = card.querySelector(".vcard-date");
    if (dateEl) dateEl.textContent = dateText;
    return true;
  }

  var section = document.querySelector("section.latest");
  if (!section) return;

  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 8000);

  fetch("/api/latest", { signal: ctrl.signal, headers: { Accept: "application/json" } })
    .then(function (res) {
      if (!res.ok) throw new Error("bad status");
      return res.json();
    })
    .then(function (data) {
      if (!data || data.error) return;
      fillCard(section.querySelector(".latest-video .vcard"), data.latest);
      var cards = section.querySelectorAll(".latest-more .vcard");
      var more = Array.isArray(data.more) ? data.more : [];
      for (var i = 0; i < cards.length && i < more.length; i++) {
        fillCard(cards[i], more[i]);
      }
    })
    .catch(function () {})
    .then(function () { clearTimeout(timer); });
})();
