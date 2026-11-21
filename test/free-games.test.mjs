import assert from "node:assert/strict";
import {
  unwrapTitle,
  cleanGamerPowerTitle,
  isOfficialStoreUrl,
  sanitizeStoreUrl,
  parseGamerPowerEnd,
  parseEpicPromotions,
  parseGogGiveaway,
  gamerPowerCandidates,
  resolveStoreUrl,
  mergeGames,
  isPayload,
  toRss,
  loadFreeGames,
  onRequest,
} from "../functions/api/free-games.js";

const NOW = Date.parse("2026-11-22T00:00:00.000Z");

function epicElement(overrides) {
  return {
    title: "Mark of the Deep",
    offerType: "BASE_GAME",
    namespace: "ns1",
    id: "id1",
    productSlug: null,
    offerMappings: [{ pageSlug: "mark-of-the-deep-f7dc08", pageType: "productHome" }],
    catalogNs: { mappings: [{ pageSlug: "mark-of-the-deep-f7dc08", pageType: "productHome" }] },
    price: { totalPrice: { originalPrice: 1850, discountPrice: 0 } },
    promotions: {
      promotionalOffers: [
        {
          promotionalOffers: [
            {
              startDate: "2026-11-19T16:00:00.000Z",
              endDate: "2026-11-26T16:00:00.000Z",
              discountSetting: { discountType: "PERCENTAGE", discountPercentage: 0 },
            },
          ],
        },
      ],
    },
    keyImages: [
      { type: "OfferImageWide", url: "https://cdn1.epicgames.com/offer/ns1/wide.jpg" },
      { type: "Thumbnail", url: "https://cdn1.epicgames.com/offer/ns1/thumb.jpg" },
    ],
    ...overrides,
  };
}

function epicData(elements) {
  return { data: { Catalog: { searchStore: { elements } } } };
}

assert.equal(unwrapTitle("《Monument Valley》"), "Monument Valley");
assert.equal(cleanGamerPowerTitle("Mark of the Deep (Epic Games) Giveaway"), "Mark of the Deep");
assert.equal(cleanGamerPowerTitle("Free itch.io Games Bundle"), "Free itch.io Games Bundle");

assert.equal(isOfficialStoreUrl("https://store.epicgames.com/zh-Hant/p/mark-of-the-deep-f7dc08"), true);
assert.equal(isOfficialStoreUrl("https://www.gamerpower.com/open/mark-of-the-deep-epic-games-giveaway"), false);
assert.equal(isOfficialStoreUrl("https://store.epicgames.com/p/mark-of-the-deep-f7dc08?ref=gamerpower"), true);
assert.equal(
  sanitizeStoreUrl("https://store.epicgames.com/p/mark-of-the-deep-f7dc08?ref=gamerpower&tap_s=abc"),
  "https://store.epicgames.com/zh-Hant/p/mark-of-the-deep-f7dc08",
);
assert.equal(
  sanitizeStoreUrl("https://freebies.indiegala.com/battle-ram?ref=gamerpower&tap_s=1069275-d1b8f4"),
  "https://freebies.indiegala.com/battle-ram",
);
assert.equal(sanitizeStoreUrl("https://www.gamerpower.com/open/anything"), "");

assert.equal(parseGamerPowerEnd("N/A"), NaN);
assert.equal(parseGamerPowerEnd("2026-11-26 23:59:00"), Date.parse("2026-11-26T23:59:00.000Z"));

const epicGames = parseEpicPromotions(
  epicData([
    epicElement(),
    epicElement({
      title: "TerraScape",
      offerMappings: [{ pageSlug: "terrascape-2b12b1", pageType: "productHome" }],
      price: { totalPrice: { originalPrice: 1328, discountPrice: 929 } },
      promotions: {
        promotionalOffers: [
          {
            promotionalOffers: [
              {
                startDate: "2026-11-21T16:00:00.000Z",
                endDate: "2026-12-21T16:00:00.000Z",
                discountSetting: { discountType: "PERCENTAGE", discountPercentage: 70 },
              },
            ],
          },
        ],
      },
    }),
    epicElement({
      title: "火之石 – 英雄放置點擊RPG",
      price: { totalPrice: { originalPrice: 0, discountPrice: 0 } },
      promotions: { promotionalOffers: [], upcomingPromotionalOffers: [] },
    }),
    epicElement({
      title: "失落城堡: 遺跡守護者",
      offerType: "ADD_ON",
      offerMappings: [{ pageSlug: "lost-castle-addon", pageType: "addon" }],
    }),
    epicElement({
      title: "Bread and Fred",
      offerMappings: [{ pageSlug: "bread-and-fred-1db362", pageType: "productHome" }],
      price: { totalPrice: { originalPrice: 1168, discountPrice: 1168 } },
      promotions: {
        promotionalOffers: [],
        upcomingPromotionalOffers: [
          {
            promotionalOffers: [
              {
                startDate: "2026-11-26T16:00:00.000Z",
                endDate: "2026-12-03T16:00:00.000Z",
                discountSetting: { discountType: "PERCENTAGE", discountPercentage: 0 },
              },
            ],
          },
        ],
      },
    }),
  ]),
  NOW,
);
assert.equal(epicGames.length, 1);
assert.equal(epicGames[0].title, "Mark of the Deep");
assert.equal(epicGames[0].claimUrl, "https://store.epicgames.com/zh-Hant/p/mark-of-the-deep-f7dc08");
assert.equal(epicGames[0].source, "epic");
assert.equal(epicGames[0].endsAt, "2026-11-26T16:00:00.000Z");
assert.equal(epicGames[0].platform, "Epic 遊戲商店");

assert.deepEqual(parseGogGiveaway({ status: "not_found", code: 404 }, NOW), []);
const gog = parseGogGiveaway(
  {
    endDate: "2026-11-29T16:00:00.000Z",
    product: {
      id: 123,
      title: "Example GOG Game",
      slug: "example_gog_game",
      image: "https://images.gog-statics.com/example.jpg",
    },
  },
  NOW,
);
assert.equal(gog.length, 1);
assert.equal(gog[0].claimUrl, "https://www.gog.com/en/game/example_gog_game");
assert.equal(gog[0].source, "gog");

const gpList = [
  {
    id: 3853,
    title: "Mark of the Deep (Epic Games) Giveaway",
    type: "Game",
    status: "Active",
    platforms: "PC, Epic Games Store",
    end_date: "2026-11-26 23:59:00",
    open_giveaway_url: "https://www.gamerpower.com/open/mark-of-the-deep-epic-games-giveaway",
    image: "https://www.gamerpower.com/offers/1b/6aff1d0e4942d.jpg",
  },
  {
    id: 3830,
    title: "Free itch.io Games Bundle",
    type: "Game",
    status: "Active",
    platforms: "PC, Itch.io, DRM-Free",
    end_date: "2026-11-22 23:59:00",
    open_giveaway_url: "https://www.gamerpower.com/open/free-itch-io-games-bundle",
    image: "https://www.gamerpower.com/offers/1b/6ae264e50edb5.jpg",
  },
  {
    id: 3346,
    title: "My Darkest Witch (IndieGala) Giveaway",
    type: "Game",
    status: "Active",
    platforms: "PC, DRM-Free",
    end_date: "N/A",
    open_giveaway_url: "https://www.gamerpower.com/open/my-darkest-witch-pc-giveaway",
  },
  {
    id: 3346 + 1,
    title: "Dwarven Realms (Steam) Key Giveaway",
    type: "Game",
    status: "Active",
    platforms: "PC, Steam",
    end_date: "2026-12-01 23:59:00",
    open_giveaway_url: "https://www.gamerpower.com/open/dwarven-realms-steam-key-giveaway",
  },
  {
    id: 99,
    title: "Loot Pack",
    type: "Loot",
    status: "Active",
    platforms: "PC, Steam",
    end_date: "2026-12-01 23:59:00",
    open_giveaway_url: "https://www.gamerpower.com/open/loot-pack",
  },
];
const candidates = gamerPowerCandidates(gpList, NOW);
assert.deepEqual(
  candidates.map((c) => c.title),
  ["Free itch.io Games Bundle"],
  "skip Epic (official API), key giveaways, loot, and items with no end date",
);
assert.equal(candidates[0].kind, "bundle");

const redirects = {
  "https://www.gamerpower.com/open/free-itch-io-games-bundle": "https://itch.io/b/3955/itching-for-games-3",
  "https://www.gamerpower.com/open/stuck": "https://www.gamerpower.com/open/stuck-still",
  "https://www.gamerpower.com/open/stuck-still": "https://www.gamerpower.com/page/nope",
  "https://www.gamerpower.com/open/alienware": "https://www.alienwarearena.com/ucf/show/2175676/giveaway",
  "https://www.gamerpower.com/open/battle-ram": "https://freebies.indiegala.com/battle-ram?ref=gamerpower&tap_s=abc",
};

function redirectFetch(url) {
  const href = String(url);
  if (redirects[href]) {
    return new Response("", { status: 301, headers: { location: redirects[href] } });
  }
  return new Response("ok", { status: 200 });
}

assert.equal(
  await resolveStoreUrl("https://www.gamerpower.com/open/free-itch-io-games-bundle", redirectFetch),
  "https://itch.io/b/3955/itching-for-games-3",
);
assert.equal(await resolveStoreUrl("https://www.gamerpower.com/open/stuck", redirectFetch), "");
assert.equal(await resolveStoreUrl("https://www.gamerpower.com/open/alienware", redirectFetch), "");
assert.equal(
  await resolveStoreUrl("https://www.gamerpower.com/open/battle-ram", redirectFetch),
  "https://freebies.indiegala.com/battle-ram",
);

const merged = mergeGames([
  epicGames,
  [
    {
      title: "Free itch.io Games Bundle",
      platform: "itch.io",
      store: "itch",
      image: "https://www.gamerpower.com/offers/1b/6ae264e50edb5.jpg",
      endsAt: "2026-11-22T23:59:00.000Z",
      claimUrl: "https://www.gamerpower.com/open/free-itch-io-games-bundle",
      source: "gamerpower",
    },
    {
      title: "Kept Bundle",
      platform: "itch.io",
      store: "itch",
      image: "https://www.gamerpower.com/offers/1b/6ae264e50edb5.jpg",
      endsAt: "2026-11-22T23:59:00.000Z",
      claimUrl: "https://itch.io/b/3955/itching-for-games-3",
      source: "gamerpower",
      kind: "bundle",
    },
  ],
], NOW);
assert.equal(merged.every((g) => !/gamerpower/i.test(g.claimUrl)), true, "no claim URL may contain gamerpower");
assert.equal(merged.some((g) => g.claimUrl.includes("gamerpower.com")), false);
assert.equal(merged.length, 2);
assert.equal(merged[0].claimUrl.startsWith("https://itch.io/"), true);
assert.equal(merged[1].claimUrl.startsWith("https://store.epicgames.com/"), true);

const rss = toRss({ games: merged }, "https://playwhaly.com");
assert.equal(rss.includes("gamerpower"), false);
assert.equal(rss.includes("https://store.epicgames.com/zh-Hant/p/mark-of-the-deep-f7dc08"), true);
assert.equal(rss.includes("<language>zh-Hant</language>"), true);

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockFetch(handlers) {
  return async (url, init) => {
    const href = typeof url === "string" ? url : url.url || String(url);
    for (const [key, fn] of Object.entries(handlers)) {
      if (href.includes(key) || href === key) return fn(href, init);
    }
    return new Response("not found", { status: 404 });
  };
}

const loaded = await loadFreeGames(
  mockFetch({
    freeGamesPromotions: async () => jsonResponse(epicData([epicElement()])),
    "gog.com/giveaway/api/get": async () => jsonResponse({ status: "not_found", code: 404 }, 404),
    "gamerpower.com/api/giveaways": async () => jsonResponse(gpList),
    "open/free-itch-io-games-bundle": async () =>
      new Response("", { status: 301, headers: { location: "https://itch.io/b/3955/itching-for-games-3" } }),
  }),
  { nowMs: NOW },
);
assert.equal(isPayload(loaded.payload), true);
assert.equal(loaded.cacheSeconds, 3600);
assert.equal(loaded.payload.attribution, true);
assert.equal(loaded.payload.games.length, 2);
for (const game of loaded.payload.games) {
  assert.equal(/gamerpower/i.test(game.claimUrl), false, "claim URL must not mention gamerpower: " + game.claimUrl);
  assert.equal(isOfficialStoreUrl(game.claimUrl), true, game.claimUrl);
}
assert.equal(
  loaded.payload.games.some((g) => g.source === "gamerpower" && g.claimUrl === "https://itch.io/b/3955/itching-for-games-3"),
  true,
);
assert.equal(
  loaded.payload.games.some((g) => g.title === "Mark of the Deep" && g.source === "epic"),
  true,
);

const unresolved = await loadFreeGames(
  mockFetch({
    freeGamesPromotions: async () => jsonResponse(epicData([])),
    "gog.com/giveaway/api/get": async () => jsonResponse({ status: "not_found", code: 404 }, 404),
    "gamerpower.com/api/giveaways": async () =>
      jsonResponse([
        {
          id: 1,
          title: "Mystery Steam Game",
          type: "Game",
          status: "Active",
          platforms: "PC, Steam",
          end_date: "2026-12-01 23:59:00",
          open_giveaway_url: "https://www.gamerpower.com/open/mystery-steam-game",
        },
      ]),
    "open/mystery-steam-game": async () =>
      new Response("", { status: 301, headers: { location: "https://www.gamerpower.com/mystery-steam-game" } }),
  }),
  { nowMs: NOW },
);
assert.equal(unresolved.payload.games.length, 0, "drop giveaways whose store URL cannot be resolved");
assert.equal(unresolved.payload.games.every((g) => !/gamerpower/i.test(g.claimUrl)), true);
assert.equal(unresolved.cacheSeconds, 300);

const post = await onRequest({
  request: new Request("https://playwhaly.com/api/free-games", { method: "POST" }),
});
assert.equal(post.status, 405);

const allDown = await loadFreeGames(
  mockFetch({
    freeGamesPromotions: async () => new Response("no", { status: 500 }),
    "gog.com/giveaway/api/get": async () => new Response("no", { status: 500 }),
    "gamerpower.com/api/giveaways": async () => new Response("no", { status: 500 }),
  }),
  { nowMs: NOW },
).then(
  () => "ok",
  (err) => err.message,
);
assert.equal(allDown, "unavailable");

const epicOnly = await loadFreeGames(
  mockFetch({
    freeGamesPromotions: async () => jsonResponse(epicData([epicElement()])),
    "gog.com/giveaway/api/get": async () => new Response("no", { status: 500 }),
    "gamerpower.com/api/giveaways": async () => new Response("no", { status: 500 }),
  }),
  { nowMs: NOW },
);
assert.equal(epicOnly.payload.games.length, 1);
assert.equal(epicOnly.payload.attribution, false);

console.log("all free-games tests passed");
