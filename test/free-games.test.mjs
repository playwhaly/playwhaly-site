import assert from "node:assert/strict";
import {
  unwrapTitle,
  cleanGamerPowerTitle,
  normalizeTitle,
  formatLocalizedTitle,
  isAdultGamerPowerText,
  isOfficialStoreUrl,
  sanitizeStoreUrl,
  parseGamerPowerEnd,
  parseEpicPromotions,
  gamerPowerCandidates,
  resolveStoreUrl,
  steamAppIdFromUrl,
  isSteamAdultApp,
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

function gpItem(overrides) {
  return {
    id: 1,
    title: "Example (Steam) Giveaway",
    type: "Game",
    status: "Active",
    platforms: "PC, Steam",
    end_date: "2026-12-01 23:59:00",
    open_giveaway_url: "https://www.gamerpower.com/open/example",
    image: "https://www.gamerpower.com/offers/1b/example.jpg",
    description: "A normal free game.",
    ...overrides,
  };
}

assert.equal(unwrapTitle("《Monument Valley》"), "Monument Valley");
assert.equal(cleanGamerPowerTitle("Mark of the Deep (Epic Games) Giveaway"), "Mark of the Deep");
assert.equal(cleanGamerPowerTitle("Contractor: The Clean Up Part 2 (Epic Games) Giveaway"), "Contractor: The Clean Up Part 2");
assert.equal(cleanGamerPowerTitle("Free itch.io Games Bundle"), "Free itch.io Games Bundle");

assert.equal(
  normalizeTitle("Contractor: The Clean Up Part 2 (Epic Games) Giveaway"),
  normalizeTitle("Contractor: The Clean Up Part II"),
);
assert.equal(normalizeTitle("Mark of the Deep"), "mark of the deep");
assert.equal(formatLocalizedTitle("Contractor: The Clean Up Part II", "Contractor: The Clean Up Part 2"), "Contractor: The Clean Up Part II");
assert.equal(formatLocalizedTitle("深海印記", "Mark of the Deep"), "深海印記 Mark of the Deep");
assert.equal(formatLocalizedTitle("深海印記 Mark of the Deep", "Mark of the Deep"), "深海印記 Mark of the Deep");

assert.equal(isAdultGamerPowerText("My Hentai Adventure (Steam) Giveaway", ""), true);
assert.equal(isAdultGamerPowerText("Quiet Town", "Contains NSFW scenes and nudity"), true);
assert.equal(isAdultGamerPowerText("Waifu Strip Puzzle", "A dress-up game"), true);
assert.equal(isAdultGamerPowerText("Rated 18+ Dungeon", ""), true);
assert.equal(isAdultGamerPowerText("Mark of the Deep (Epic Games) Giveaway", "A metroidvania under the sea."), false);
assert.equal(isAdultGamerPowerText("Adulthood", "A coming-of-age story"), false);

assert.equal(isOfficialStoreUrl("https://store.epicgames.com/zh-Hant/p/mark-of-the-deep-f7dc08"), true);
assert.equal(isOfficialStoreUrl("https://www.gamerpower.com/open/mark-of-the-deep-epic-games-giveaway"), false);
assert.equal(isOfficialStoreUrl("https://store.epicgames.com/p/mark-of-the-deep-f7dc08?ref=gamerpower"), true);
assert.equal(
  sanitizeStoreUrl("https://store.epicgames.com/p/mark-of-the-deep-f7dc08?ref=gamerpower&tap_s=abc"),
  "https://store.epicgames.com/zh-Hant/p/mark-of-the-deep-f7dc08",
);
assert.equal(
  sanitizeStoreUrl("https://store.epicgames.com/p/contractor-the-clean-up-part-ii-1b1b57"),
  "https://store.epicgames.com/zh-Hant/p/contractor-the-clean-up-part-ii-1b1b57",
);
assert.equal(
  sanitizeStoreUrl("https://freebies.indiegala.com/battle-ram?ref=gamerpower&tap_s=1069275-d1b8f4"),
  "https://freebies.indiegala.com/battle-ram",
);
assert.equal(sanitizeStoreUrl("https://www.gamerpower.com/open/anything"), "");

assert.equal(parseGamerPowerEnd("N/A"), NaN);
assert.equal(parseGamerPowerEnd("2026-11-26 23:59:00"), Date.parse("2026-11-26T23:59:00.000Z"));
assert.equal(steamAppIdFromUrl("https://store.steampowered.com/app/123456/Some_Game/"), "123456");
assert.equal(isSteamAdultApp({ required_age: 0, content_descriptors: { ids: [1, 2] } }), false);
assert.equal(isSteamAdultApp({ required_age: 18, content_descriptors: { ids: [] } }), true);
assert.equal(isSteamAdultApp({ required_age: "0", content_descriptors: { ids: [3] } }), true);
assert.equal(isSteamAdultApp({ required_age: 17, content_descriptors: { ids: ["4"] } }), true);

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

const gpList = [
  gpItem({
    id: 3853,
    title: "Mark of the Deep (Epic Games) Giveaway",
    platforms: "PC, Epic Games Store",
    end_date: "2026-11-26 23:59:00",
    open_giveaway_url: "https://www.gamerpower.com/open/mark-of-the-deep-epic-games-giveaway",
    image: "https://www.gamerpower.com/offers/1b/6aff1d0e4942d.jpg",
    description: "Claim Mark of the Deep on the Epic Games Store.",
  }),
  gpItem({
    id: 3852,
    title: "Contractor: The Clean Up Part 2 (Epic Games) Giveaway",
    platforms: "PC, Epic Games Store",
    end_date: "2026-12-02 23:59:00",
    open_giveaway_url: "https://www.gamerpower.com/open/contractor-the-clean-up-part-2-epic-games-giveaway",
    image: "https://www.gamerpower.com/offers/1b/6afc554f06761.jpg",
    description: "Score Contractor: The Clean Up Part 2 for free via Epic Games Store!",
  }),
  gpItem({
    id: 3830,
    title: "Free itch.io Games Bundle",
    platforms: "PC, Itch.io, DRM-Free",
    end_date: "2026-11-22 23:59:00",
    open_giveaway_url: "https://www.gamerpower.com/open/free-itch-io-games-bundle",
    image: "https://www.gamerpower.com/offers/1b/6ae264e50edb5.jpg",
  }),
  gpItem({
    id: 3346,
    title: "My Darkest Witch (IndieGala) Giveaway",
    platforms: "PC, DRM-Free",
    end_date: "N/A",
    open_giveaway_url: "https://www.gamerpower.com/open/my-darkest-witch-pc-giveaway",
  }),
  gpItem({
    id: 3347,
    title: "Dwarven Realms (Steam) Key Giveaway",
    platforms: "PC, Steam",
    end_date: "2026-12-01 23:59:00",
    open_giveaway_url: "https://www.gamerpower.com/open/dwarven-realms-steam-key-giveaway",
  }),
  gpItem({
    id: 99,
    title: "Loot Pack",
    type: "Loot",
    platforms: "PC, Steam",
    end_date: "2026-12-01 23:59:00",
    open_giveaway_url: "https://www.gamerpower.com/open/loot-pack",
  }),
  gpItem({
    id: 5001,
    title: "Hentai Puzzle Pack (Steam) Giveaway",
    platforms: "PC, Steam",
    end_date: "2026-12-10 23:59:00",
    open_giveaway_url: "https://www.gamerpower.com/open/hentai-puzzle-pack",
    description: "An uncensored adult collection.",
  }),
  gpItem({
    id: 5002,
    title: "Calm Forest (Steam) Giveaway",
    platforms: "PC, Steam",
    end_date: "2026-12-10 23:59:00",
    open_giveaway_url: "https://www.gamerpower.com/open/calm-forest",
    description: "A cozy game with NSFW optional scenes.",
  }),
];
const candidates = gamerPowerCandidates(gpList, NOW);
assert.deepEqual(
  candidates.map((c) => c.title),
  ["Mark of the Deep", "Contractor: The Clean Up Part 2", "Free itch.io Games Bundle"],
  "keep Epic and GOG from GamerPower; skip keys, loot, no end date, and adult titles",
);
assert.equal(candidates[2].kind, "bundle");
assert.equal(
  candidates.some((c) => /hentai|nsfw|adult/i.test(c.title)),
  false,
  "keyword blocklist drops adult GamerPower entries",
);

const redirects = {
  "https://www.gamerpower.com/open/free-itch-io-games-bundle": "https://itch.io/b/3955/itching-for-games-3",
  "https://www.gamerpower.com/open/stuck": "https://www.gamerpower.com/open/stuck-still",
  "https://www.gamerpower.com/open/stuck-still": "https://www.gamerpower.com/page/nope",
  "https://www.gamerpower.com/open/alienware": "https://www.alienwarearena.com/ucf/show/2175676/giveaway",
  "https://www.gamerpower.com/open/battle-ram": "https://freebies.indiegala.com/battle-ram?ref=gamerpower&tap_s=abc",
  "https://www.gamerpower.com/open/mark-of-the-deep-epic-games-giveaway":
    "https://store.epicgames.com/p/mark-of-the-deep-f7dc08",
  "https://www.gamerpower.com/open/contractor-the-clean-up-part-2-epic-games-giveaway":
    "https://store.epicgames.com/p/contractor-the-clean-up-part-ii-1b1b57",
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
assert.equal(
  await resolveStoreUrl("https://www.gamerpower.com/open/contractor-the-clean-up-part-2-epic-games-giveaway", redirectFetch),
  "https://store.epicgames.com/zh-Hant/p/contractor-the-clean-up-part-ii-1b1b57",
);

const merged = mergeGames([
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
    {
      title: "Contractor: The Clean Up Part 2",
      platform: "Epic 遊戲商店",
      store: "epic",
      image: "https://www.gamerpower.com/offers/1b/6afc554f06761.jpg",
      endsAt: "2026-12-02T23:59:00.000Z",
      claimUrl: "https://store.epicgames.com/zh-Hant/p/contractor-the-clean-up-part-ii-1b1b57",
      source: "gamerpower",
    },
    {
      title: "Contractor: The Clean Up Part II",
      platform: "Epic 遊戲商店",
      store: "epic",
      image: "https://cdn1.epicgames.com/offer/ns1/wide.jpg",
      endsAt: "2026-12-02T10:00:00.000Z",
      claimUrl: "https://store.epicgames.com/zh-Hant/p/contractor-the-clean-up-part-ii-1b1b57",
      source: "gamerpower",
    },
  ],
], NOW);
assert.equal(merged.every((g) => !/gamerpower/i.test(g.claimUrl)), true, "no claim URL may contain gamerpower");
assert.equal(merged.some((g) => g.claimUrl.includes("gamerpower.com")), false);
assert.equal(merged.length, 2, "duplicate Epic titles (Part 2 / Part II) and same slug collapse to one");
assert.equal(merged[0].claimUrl.startsWith("https://itch.io/"), true);
assert.equal(merged[1].claimUrl, "https://store.epicgames.com/zh-Hant/p/contractor-the-clean-up-part-ii-1b1b57");

const rss = toRss({ games: merged }, "https://playwhaly.com");
assert.equal(/<link>https?:\/\/[^<]*gamerpower/i.test(rss), false, "RSS item links must not point at gamerpower");
assert.equal(rss.includes("Data: GamerPower.com"), true);
assert.equal(rss.includes("Epic Games Store"), true);
assert.equal(rss.includes(", GOG"), false);
assert.equal(rss.includes("https://store.epicgames.com/zh-Hant/p/contractor-the-clean-up-part-ii-1b1b57"), true);
assert.equal(rss.includes("<language>zh-Hant</language>"), true);

function steamDetails(appid, data, success = true) {
  return jsonResponse({ [String(appid)]: { success, data } });
}

const loaded = await loadFreeGames(
  mockFetch({
    freeGamesPromotions: async () =>
      jsonResponse(
        epicData([
          epicElement(),
          epicElement({
            title: "Bread and Fred",
            offerMappings: [{ pageSlug: "bread-and-fred-1db362", pageType: "productHome" }],
          }),
        ]),
      ),
    "gamerpower.com/api/giveaways": async () => jsonResponse(gpList),
    "open/free-itch-io-games-bundle": async () =>
      new Response("", { status: 301, headers: { location: "https://itch.io/b/3955/itching-for-games-3" } }),
    "open/mark-of-the-deep-epic-games-giveaway": async () =>
      new Response("", { status: 301, headers: { location: "https://store.epicgames.com/p/mark-of-the-deep-f7dc08" } }),
    "open/contractor-the-clean-up-part-2-epic-games-giveaway": async () =>
      new Response("", {
        status: 301,
        headers: { location: "https://store.epicgames.com/p/contractor-the-clean-up-part-ii-1b1b57" },
      }),
    "store.epicgames.com/graphql": async () =>
      jsonResponse({
        data: {
          Catalog: {
            searchStore: {
              elements: [
                {
                  title: "Contractor: The Clean Up Part II",
                  offerMappings: [{ pageSlug: "contractor-the-clean-up-part-ii-1b1b57" }],
                  catalogNs: { mappings: [{ pageSlug: "contractor-the-clean-up-part-ii-1b1b57" }] },
                },
              ],
            },
          },
        },
      }),
  }),
  { nowMs: NOW },
);
assert.equal(isPayload(loaded.payload), true);
assert.equal(loaded.cacheSeconds, 3600);
assert.equal(loaded.payload.attribution, true);
assert.equal(
  loaded.payload.games.some((g) => g.title === "Bread and Fred"),
  false,
  "Epic feed games that GamerPower does not list are not added",
);
for (const game of loaded.payload.games) {
  assert.equal(/gamerpower/i.test(game.claimUrl), false, "claim URL must not mention gamerpower: " + game.claimUrl);
  assert.equal(isOfficialStoreUrl(game.claimUrl), true, game.claimUrl);
  assert.equal(game.source, "gamerpower");
}
const mark = loaded.payload.games.find((g) => g.claimUrl.includes("mark-of-the-deep-f7dc08"));
assert.equal(Boolean(mark), true, "GamerPower Epic entry present in the official feed is kept once");
assert.equal(mark.title, "Mark of the Deep");
assert.equal(mark.image, "https://cdn1.epicgames.com/offer/ns1/wide.jpg", "use Epic image when the feed matches");
assert.equal(mark.endsAt, "2026-11-26T16:00:00.000Z", "use Epic endDate when the feed matches");
assert.equal(mark.platform, "Epic 遊戲商店");
assert.equal(mark.store, "epic");
assert.equal(mark.source, "gamerpower");
assert.equal(
  loaded.payload.games.filter((g) => /mark of the deep/i.test(g.title)).length,
  1,
  "matching GamerPower and Epic feed entries do not duplicate",
);
const contractor = loaded.payload.games.find((g) => /contractor/i.test(g.title));
assert.equal(Boolean(contractor), true, "Epic GamerPower entry missing from the official feed is still kept");
assert.equal(contractor.title, "Contractor: The Clean Up Part II");
assert.equal(contractor.claimUrl, "https://store.epicgames.com/zh-Hant/p/contractor-the-clean-up-part-ii-1b1b57");
assert.equal(contractor.endsAt, "2026-12-02T23:59:00.000Z");
assert.equal(contractor.platform, "Epic 遊戲商店");
assert.equal(contractor.store, "epic");
assert.equal(contractor.source, "gamerpower");
assert.equal(
  loaded.payload.games.some((g) => g.source === "gamerpower" && g.claimUrl === "https://itch.io/b/3955/itching-for-games-3"),
  true,
);

const epicDown = await loadFreeGames(
  mockFetch({
    freeGamesPromotions: async () => new Response("no", { status: 500 }),
    "gamerpower.com/api/giveaways": async () => jsonResponse(gpList),
    "open/free-itch-io-games-bundle": async () =>
      new Response("", { status: 301, headers: { location: "https://itch.io/b/3955/itching-for-games-3" } }),
    "open/mark-of-the-deep-epic-games-giveaway": async () =>
      new Response("", { status: 301, headers: { location: "https://store.epicgames.com/p/mark-of-the-deep-f7dc08" } }),
    "open/contractor-the-clean-up-part-2-epic-games-giveaway": async () =>
      new Response("", {
        status: 301,
        headers: { location: "https://store.epicgames.com/p/contractor-the-clean-up-part-ii-1b1b57" },
      }),
  }),
  { nowMs: NOW },
);
assert.equal(epicDown.payload.games.length >= 3, true, "if the Epic feed fails, still return the GamerPower list");
assert.equal(
  epicDown.payload.games.every((g) => g.source === "gamerpower" && !/gamerpower/i.test(g.claimUrl)),
  true,
);
const markFallback = epicDown.payload.games.find((g) => /mark of the deep/i.test(g.title));
assert.equal(markFallback.endsAt, "2026-11-26T23:59:00.000Z", "without Epic enrichment, keep the GamerPower end date");
assert.equal(markFallback.image, "https://www.gamerpower.com/offers/1b/6aff1d0e4942d.jpg");
const contractorFallback = epicDown.payload.games.find((g) => /contractor/i.test(g.title));
assert.equal(contractorFallback.title, "Contractor: The Clean Up Part 2");
assert.equal(contractorFallback.claimUrl, "https://store.epicgames.com/zh-Hant/p/contractor-the-clean-up-part-ii-1b1b57");

const unresolved = await loadFreeGames(
  mockFetch({
    freeGamesPromotions: async () => jsonResponse(epicData([])),
    "gamerpower.com/api/giveaways": async () =>
      jsonResponse([
        gpItem({
          id: 1,
          title: "Mystery Steam Game",
          open_giveaway_url: "https://www.gamerpower.com/open/mystery-steam-game",
        }),
      ]),
    "open/mystery-steam-game": async () =>
      new Response("", { status: 301, headers: { location: "https://www.gamerpower.com/mystery-steam-game" } }),
  }),
  { nowMs: NOW },
);
assert.equal(unresolved.payload.games.length, 0, "drop giveaways whose store URL cannot be resolved");
assert.equal(unresolved.payload.games.every((g) => !/gamerpower/i.test(g.claimUrl)), true);
assert.equal(unresolved.cacheSeconds, 300);

const steamFilter = await loadFreeGames(
  mockFetch({
    freeGamesPromotions: async () => jsonResponse(epicData([])),
    "gamerpower.com/api/giveaways": async () =>
      jsonResponse([
        gpItem({
          id: 10,
          title: "Safe Steam Game (Steam) Giveaway",
          open_giveaway_url: "https://www.gamerpower.com/open/safe-steam-game",
        }),
        gpItem({
          id: 11,
          title: "Descriptor Adult Game (Steam) Giveaway",
          open_giveaway_url: "https://www.gamerpower.com/open/descriptor-adult-game",
        }),
        gpItem({
          id: 12,
          title: "Age Gated Game (Steam) Giveaway",
          open_giveaway_url: "https://www.gamerpower.com/open/age-gated-game",
        }),
        gpItem({
          id: 13,
          title: "Lookup Error Game (Steam) Giveaway",
          open_giveaway_url: "https://www.gamerpower.com/open/lookup-error-game",
        }),
      ]),
    "open/safe-steam-game": async () =>
      new Response("", { status: 301, headers: { location: "https://store.steampowered.com/app/1001/Safe/" } }),
    "open/descriptor-adult-game": async () =>
      new Response("", { status: 301, headers: { location: "https://store.steampowered.com/app/1002/Adult/" } }),
    "open/age-gated-game": async () =>
      new Response("", { status: 301, headers: { location: "https://store.steampowered.com/app/1003/Age/" } }),
    "open/lookup-error-game": async () =>
      new Response("", { status: 301, headers: { location: "https://store.steampowered.com/app/1004/Error/" } }),
    "appdetails?appids=1001": async () => steamDetails(1001, { required_age: 0, content_descriptors: { ids: [2] } }),
    "appdetails?appids=1002": async () => steamDetails(1002, { required_age: 0, content_descriptors: { ids: [3] } }),
    "appdetails?appids=1003": async () => steamDetails(1003, { required_age: 18, content_descriptors: { ids: [] } }),
    "appdetails?appids=1004": async () => new Response("no", { status: 500 }),
  }),
  { nowMs: NOW },
);
assert.deepEqual(
  steamFilter.payload.games.map((g) => g.title).sort(),
  ["Lookup Error Game", "Safe Steam Game"],
  "drop Steam games that are clearly adult; keep the rest if the lookup errors",
);
assert.equal(
  steamFilter.payload.games.every((g) => g.claimUrl.startsWith("https://store.steampowered.com/")),
  true,
);

const post = await onRequest({
  request: new Request("https://playwhaly.com/api/free-games", { method: "POST" }),
});
assert.equal(post.status, 405);

const allDown = await loadFreeGames(
  mockFetch({
    freeGamesPromotions: async () => new Response("no", { status: 500 }),
    "gamerpower.com/api/giveaways": async () => new Response("no", { status: 500 }),
  }),
  { nowMs: NOW },
).then(
  () => "ok",
  (err) => err.message,
);
assert.equal(allDown, "unavailable");

const gpDown = await loadFreeGames(
  mockFetch({
    freeGamesPromotions: async () => jsonResponse(epicData([epicElement()])),
    "gamerpower.com/api/giveaways": async () => new Response("no", { status: 500 }),
  }),
  { nowMs: NOW },
).then(
  () => "ok",
  (err) => err.message,
);
assert.equal(gpDown, "unavailable", "the list cannot be built without GamerPower");

console.log("all free-games tests passed");

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const homepage = await readFile(join(root, "public/index.html"), "utf8");
assert.equal(homepage.includes("id=\"free-games-credit\""), false, "homepage must not show a GamerPower credit note");
assert.equal(homepage.includes("部分資訊來源"), false);
const terms = await readFile(join(root, "public/terms.html"), "utf8");
const privacy = await readFile(join(root, "public/privacy.html"), "utf8");
for (const [name, html] of [["terms", terms], ["privacy", privacy]]) {
  assert.equal(html.includes("https://www.gamerpower.com/"), true, name + " should credit GamerPower.com");
  assert.equal(html.includes('rel="noopener"'), true, name + " GamerPower link should use rel=noopener");
  assert.equal(html.includes("Epic Games Store"), true, name + " should mention Epic Games Store");
  assert.equal(html.includes("GOG"), false, name + " should not name GOG as a data source");
  assert.equal(html.includes("限時免費領取"), true, name + " should mention the free-games list");
}
assert.equal(terms.includes("資料來源"), true);
assert.equal(terms.includes("Data sources"), true);
console.log("all free-games tests passed (legal credit)");

// No hard cap on the free-games list; ending-soonest stays first.
const many = [];
for (let i = 10; i >= 1; i--) {
  many.push({
    title: "Cap Test " + String(i).padStart(2, "0"),
    platform: "Steam",
    store: "steam",
    image: "https://cdn.akamai.steamstatic.com/steam/apps/10/header.jpg",
    endsAt: "2026-12-" + String(i).padStart(2, "0") + "T12:00:00.000Z",
    claimUrl: "https://store.steampowered.com/app/" + (1000 + i) + "/",
    source: "gamerpower",
  });
}
const uncapped = mergeGames([many], NOW);
assert.equal(uncapped.length, 10, "no hard cap on total free games");
assert.deepEqual(
  uncapped.map((g) => g.title),
  many.slice().reverse().map((g) => g.title),
  "sorted by ending soonest first",
);
console.log("all free-games tests passed (no cap)");
