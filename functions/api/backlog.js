const FETCH_MS = 8000;
const CACHE_SECONDS = 600;
const UA = "playwhaly.com/backlog (https://playwhaly.com/)";
const ALLOWED_HOSTS = new Set(["docs.google.com", "spreadsheets.google.com", "docs.googleusercontent.com"]);

const HEADER_MAP = {
  playnite_id: "playnite_id",
  store_game_id: "store_game_id",
  steam_appid: "steam_appid",
  name_en: "name_en",
  name_zh: "name_zh",
  display_name: "display_name",
  platforms: "platform",
  platform: "platform",
  sources: "sources",
  source: "sources",
  status: "status",
  completed_date: "completed_date",
  genres: "genre",
  genre: "genre",
  release_date: "release_date",
  release: "release_date",
  public: "public",
  store_url: "store_url",
  store_label: "store_label",
  顯示名稱: "display_name",
  English_name: "name_en",
  english_name: "name_en",
  英文名: "name_en",
  英文名稱: "name_en",
  中文名: "name_zh",
  中文名稱: "name_zh",
  平台: "platform",
  來源: "sources",
  狀態: "status",
  完成日: "completed_date",
  完成日期: "completed_date",
  類型: "genre",
  發行: "release_date",
  發行日: "release_date",
  發行日期: "release_date",
  公開: "public",
  加入日期: "added_date",
  added_date: "added_date",
  date_added: "added_date",
};

const STATUS_MAP = {
  completed: "已完成",
  done: "已完成",
  finished: "已完成",
  已完成: "已完成",
  playing: "遊玩中",
  "in progress": "遊玩中",
  "in-progress": "遊玩中",
  遊玩中: "遊玩中",
  planned: "未玩",
  backlog: "未玩",
  todo: "未玩",
  unplayed: "未玩",
  未玩: "未玩",
};

let memoryCache = { at: 0, body: null };

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  const s = String(text || "").replace(/^\uFEFF/, "");
  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function isAllowedCsvUrl(raw) {
  try {
    const u = new URL(String(raw || ""));
    if (u.protocol !== "https:") return false;
    if (u.username || u.password) return false;
    const host = u.hostname.toLowerCase();
    // Published Google Sheets CSVs redirect to doc-xx-...-sheets.googleusercontent.com
    return ALLOWED_HOSTS.has(host) || host.endsWith(".googleusercontent.com");
  } catch {
    return false;
  }
}

function normalizeHeader(value) {
  return String(value || "").trim().replace(/\s+/g, "_");
}

function statusLabel(value) {
  const v = String(value || "").trim();
  return STATUS_MAP[v] || STATUS_MAP[v.toLowerCase()] || v || "未玩";
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function ymd(y, m, d) {
  const Y = Number(y), M = Number(m), D = Number(d);
  if (!(Y >= 1970 && Y <= 2100 && M >= 1 && M <= 12 && D >= 1 && D <= 31)) return "";
  const dt = new Date(Date.UTC(Y, M - 1, D));
  if (dt.getUTCMonth() !== M - 1) return "";
  return Y + "-" + String(M).padStart(2, "0") + "-" + String(D).padStart(2, "0");
}

// Sheet dates: "2026-11-22" (today's format), "2026/11/22", "2026-11-22 10:00:00", "22-Nov-2026",
// "22/11/2026" (day first, as the sheet locale writes it) or a raw serial day number. Anything else → "".
export function normalizeDate(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/);
  if (m) return ymd(m[1], m[2], m[3]);
  m = s.match(/^(\d{1,2})[- ]([A-Za-z]{3})[A-Za-z]*[- ,]+(\d{4})$/);
  if (m && MONTHS[m[2].toLowerCase()]) return ymd(m[3], MONTHS[m[2].toLowerCase()], m[1]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return ymd(m[3], m[2], m[1]);
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000);
    return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  return "";
}

function isPrivateValue(value) {
  const v = String(value || "").trim().toLowerCase();
  return v === "0" || v === "false" || v === "no" || v === "n" || v === "私密" || v === "hidden" || v === "private";
}

function steamAppId(game) {
  if (game.steam_appid && /^\d+$/.test(String(game.steam_appid))) return String(game.steam_appid);
  const src = String(game.sources || "").toLowerCase();
  const id = String(game.store_game_id || "");
  if ((src.includes("steam") || !src) && /^\d+$/.test(id)) return id;
  return "";
}

export function gamesFromCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const headers = rows[0].map(normalizeHeader);
  const keys = headers.map((h) => HEADER_MAP[h] || HEADER_MAP[h.toLowerCase()] || "");
  const hasPublic = keys.includes("public");
  const games = [];
  for (const row of rows.slice(1)) {
    if (!row.some((cell) => String(cell || "").trim())) continue;
    const raw = {};
    keys.forEach((key, i) => {
      if (key) raw[key] = String(row[i] == null ? "" : row[i]).trim();
    });
    if (hasPublic && isPrivateValue(raw.public)) continue;
    const name_zh = raw.name_zh || "";
    const name_en = raw.name_en || "";
    const display_name = raw.display_name || name_zh || name_en;
    if (!display_name) continue;
    const game = {
      name_zh,
      name_en,
      display_name,
      platform: raw.platform || "",
      status: statusLabel(raw.status),
      genre: raw.genre || "",
      release_date: raw.release_date || "",
    };
    if (raw.completed_date) game.completed_date = raw.completed_date;
    const added = normalizeDate(raw.added_date);
    if (added) game.added_date = added;
    const appid = steamAppId({ ...raw, sources: raw.sources, store_game_id: raw.store_game_id, steam_appid: raw.steam_appid });
    if (appid) game.steam_appid = appid;
    if (raw.store_url && /^https:\/\//i.test(raw.store_url) && !/gamerpower/i.test(raw.store_url)) {
      game.store_url = raw.store_url;
      if (raw.store_label) game.store_label = raw.store_label;
    } else if (appid) {
      game.store_url = "https://store.steampowered.com/app/" + appid + "/";
      game.store_label = "在 Steam 看看";
    }
    games.push(game);
  }
  return games;
}

export function summarize(games) {
  const list = Array.isArray(games) ? games : [];
  const completed = list.filter((g) => g.status === "已完成");
  const playing = list.filter((g) => g.status === "遊玩中");
  const todo = list.filter((g) => g.status === "未玩");
  const recentlyCompleted = completed
    .slice()
    .sort((a, b) => String(b.completed_date || "").localeCompare(String(a.completed_date || "")))
    .slice(0, 6);
  return {
    stats: {
      total: list.length,
      completed: completed.length,
      playing: playing.length,
      todo: todo.length,
    },
    playing,
    recentlyCompleted,
  };
}

export async function fetchAllowed(url, fetchImpl, ua) {
  let current = url;
  for (let hop = 0; hop < 5; hop++) {
    if (!isAllowedCsvUrl(current)) throw new Error("blocked host");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
    try {
      const res = await fetchImpl(current, {
        method: "GET",
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "User-Agent": ua || UA, Accept: "text/csv,text/plain,*/*" },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) throw new Error("redirect");
        current = new URL(loc, current).toString();
        continue;
      }
      if (!res.ok) throw new Error("upstream " + res.status);
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("too many redirects");
}

function jsonResponse(body, status, cacheSeconds) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=" + cacheSeconds,
    },
  });
}

export async function loadBacklog(fetchImpl, options) {
  const url = options && options.csvUrl;
  if (!url) {
    return {
      payload: {
        ok: false,
        reason: "unset",
        message: "遊戲清單還沒接上公開資料，稍後再來看看～",
      },
      cacheSeconds: 60,
    };
  }
  if (!isAllowedCsvUrl(url)) {
    return {
      payload: {
        ok: false,
        reason: "unset",
        message: "遊戲清單還沒接上公開資料，稍後再來看看～",
      },
      cacheSeconds: 60,
    };
  }
  try {
    const text = await fetchAllowed(url, fetchImpl || fetch);
    const games = gamesFromCsv(text);
    const extra = summarize(games);
    return {
      payload: {
        ok: true,
        updatedAt: new Date((options && options.nowMs) || Date.now()).toISOString(),
        stats: extra.stats,
        playing: extra.playing,
        recentlyCompleted: extra.recentlyCompleted,
        games,
      },
      cacheSeconds: CACHE_SECONDS,
    };
  } catch {
    return {
      payload: {
        ok: false,
        reason: "unreachable",
        message: "暫時讀不到遊戲清單，請稍後再試～",
      },
      cacheSeconds: 60,
    };
  }
}

// The home page only needs the counts. ?view=stats returns a few hundred bytes instead of the whole list.
export function statsView(payload) {
  if (!payload || !payload.ok) return payload;
  return { ok: true, updatedAt: payload.updatedAt, stats: payload.stats };
}

export async function onRequest(context) {
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return jsonResponse({ error: "method not allowed" }, 405, 60);
  }
  const env = context.env || {};
  const csvUrl = env.BACKLOG_CSV_URL || "";
  const now = Date.now();
  const statsOnly = new URL(context.request.url).searchParams.get("view") === "stats";
  const shape = (body) => (statsOnly ? statsView(body) : body);
  if (memoryCache.body && now - memoryCache.at < CACHE_SECONDS * 1000 && memoryCache.url === csvUrl) {
    return jsonResponse(shape(memoryCache.body), 200, CACHE_SECONDS);
  }
  const resolved = await loadBacklog(fetch, { csvUrl, nowMs: now });
  if (resolved.payload.ok) {
    memoryCache = { at: now, url: csvUrl, body: resolved.payload };
  }
  return jsonResponse(shape(resolved.payload), 200, resolved.cacheSeconds);
}
