/* playwhaly game list: the ONE place to edit game names, chips and the marquee.
 *
 *   name    exact text inside 《》 in the YouTube titles. Used as the card tag and the chip label.
 *   search  English name for the channel search link (youtube.com/@playwhaly/search?query=...).
 *   chip    true = show as a chip and in the marquee. Order here = order on the page.
 *   main    true = highlighted chip (only Project Zomboid).
 *   aliases older or alternate names that should map to this game (exact match only, never substrings).
 *
 * Games not listed here that show up in the newest uploads get a chip automatically (see app.js).
 * Listing a game with chip:false stops it from being auto-added while keeping its card tag correct.
 * After editing, run: node scripts/sync-chips.mjs   (rewrites the no-JS chips and marquee in index.html)
 * No secrets in this file.
 */
(function (root, factory) {
  var games = factory();
  if (typeof module === "object" && module.exports) module.exports = games;
  else root.PW_GAMES = games;
})(typeof self !== "undefined" ? self : this, function () {
  return [
    // ---- Chips, in page order (recent + popular first) ----
    { name: "殭屍毀滅工程 Project Zomboid", search: "Project Zomboid", chip: true, main: true },
    { name: "島嶼生存者 The Survivalists", search: "The Survivalists", chip: true },
    { name: "核心守護者 Core Keeper", search: "Core Keeper", chip: true, aliases: ["Core Keeper 核心守護者"] }, // Bahamut ACG 123188 + GNN
    { name: "陰森 The Forest", search: "The Forest", chip: true },
    { name: "饑荒聯機版 Don't Starve Together", search: "Don't Starve Together", chip: true },
    { name: "VEIN", search: "VEIN", chip: true },
    { name: "恐鬼症 Phasmophobia", search: "Phasmophobia", chip: true, aliases: ["恐懼症 Phasmophobia", "恐鬼症", "恐懼症"] },
    { name: "怪奇鎮生存指南 I Hate This Place", search: "I Hate This Place", chip: true },
    { name: "星露谷 Stardew Valley", search: "Stardew Valley", chip: true, aliases: ["星露谷"] },
    { name: "Species: Unknown", search: "Species: Unknown", chip: true },
    { name: "蝙蝠俠：阿卡漢瘋人院 Batman: Arkham Asylum", search: "Batman: Arkham Asylum", chip: true },
    { name: "夜族崛起 V Rising", search: "V Rising", chip: true, aliases: ["夜族崛起 V Rising 1.1版"] },
    { name: "HumanitZ", search: "HumanitZ", chip: true },
    { name: "SUNKENLAND 沉沒之地", search: "SUNKENLAND", chip: true },
    { name: "當個創世神 Minecraft", search: "Minecraft", chip: true, aliases: ["麥塊 Minecraft"] },
    { name: "最後的海盜：無人生還 Last Pirates: Die Together", search: "Last Pirates", chip: true, aliases: ["Last Pirates: Die Together"] },
    { name: "The Walking Trade", search: "The Walking Trade", chip: true },
    { name: "Fargone", search: "Fargone", chip: true },

    // ---- Known games, no chip (card tags still use these names; never auto-added) ----
    { name: "筏上求生 Raft", search: "Raft", aliases: ["RAFT 筏上求生", "RAFT"] }, // Bahamut ACG 87685, board 34715, GNN
    { name: "殭屍墓園模擬器 Zombie Graveyard Simulator", search: "Zombie Graveyard Simulator" },
    { name: "綠色地獄 Green Hell", search: "Green Hell", aliases: ["Green Hell 綠色地獄", "Green Hell"] }, // Bahamut board 37386 綠色地獄
    { name: "Forewarned", search: "Forewarned" },
    { name: "合力攻頂 PEAK", search: "PEAK", aliases: ["PEAK"] },
    { name: "Dreadway", search: "Dreadway" },
    { name: "吞噬 Devour", search: "Devour" },
    { name: "刺客任務 3 Hitman 3", search: "Hitman 3" },
    { name: "森林盡頭 Where the forest ends", search: "Where the forest ends" },
    { name: "Infected Dawn", search: "Infected Dawn" },
    { name: "風啟之旅 Windrose", search: "Windrose", aliases: ["Windrose 風啟之旅"] }, // Bahamut ACG 149928 + GNN
    { name: "生存者：隱形病毒 Survivalist: Invisible Strain", search: "Survivalist: Invisible Strain" },
    { name: "求生巴士 BUS: Bro U Survived", search: "BUS: Bro U Survived" },
    { name: "泰拉瑞亞 Terraria", search: "Terraria" },
    { name: "困境：異星黎明 Stranded: Alien Dawn", search: "Stranded: Alien Dawn", aliases: ["困境：異星黎明"] },
    { name: "米德加爾的部落 Tribes of Midgard", search: "Tribes of Midgard", aliases: ["米德加爾的部落"] },
    { name: "牧場模擬器 Ranch Simulator", search: "Ranch Simulator" },
    { name: "模擬市民4 The Sims 4", search: "The Sims 4" },
    { name: "大都會：天際 Cities: Skylines", search: "Cities: Skylines" },
    { name: "小傢伙們 The Little Ones", search: "The Little Ones" },
    { name: "就只是想要吃 Just Want to Eat", search: "Just Want to Eat" },
    { name: "65號項目 Subject 65", search: "Subject 65" },
    { name: "猩紅之雪 Crimson Snow", search: "Crimson Snow" },
    { name: "猶大 Judas", search: "Judas" },
    { name: "蠟燭遊戲 List: Game of Candles", search: "List: Game of Candles" },
    { name: "切爾諾貝利未勘之地 S.W.A.N.: Chernobyl Unexplored", search: "Chernobyl Unexplored" },
    { name: "開膛破肚 Disembowel", search: "Disembowel" },
    { name: "深夜拖地 Late Night Mop", search: "Late Night Mop" },
    { name: "一天又一天 From Day to Day", search: "From Day to Day" },
    { name: "萬聖節 1 HALLOWEEN 1", search: "HALLOWEEN 1" },
    { name: "悲傷 Grief", search: "Grief" },
    { name: "溯源之懼：獨自在家 Fears to Fathom - Home Alone", search: "Fears to Fathom" },
    { name: "快到家了，快到家了 Almost Home Now", search: "Almost Home Now" },
    { name: "當代 CONTEMP", search: "CONTEMP" },
    { name: "安撫 Pacify", search: "Pacify" },
    { name: "死亡觀察 DEATHWATCH", search: "DEATHWATCH" },
    { name: "城堡毀滅者 Castle Crashers", search: "Castle Crashers" },
    { name: "永遠不再 Never Again", search: "Never Again" },
    { name: "斯凱爾女士 Maid of Sker", search: "Maid of Sker" },
    { name: "狙擊精英 V2 Sniper Elite V2 Remastered", search: "Sniper Elite V2" },
    { name: "刺客任務 1 Hitman 1", search: "Hitman 1" },
    { name: "動物森友會 Animal Crossing", search: "Animal Crossing" },
    { name: "煮過頭！2 Overcooked! 2", search: "Overcooked 2" },
    { name: "瓦爾海姆 Valheim", search: "Valheim" },
    { name: "萌萌小人大亂鬥 Gang Beasts", search: "Gang Beasts" },
    { name: "喋血復仇 Back 4 Blood", search: "Back 4 Blood" },
    { name: "寶可夢大集結 Pokemon Unite", search: "Pokemon Unite" },
    { name: "戰爭附言 Post Scriptum", search: "Post Scriptum" },
    { name: "墳墓高中 Gravewood High", search: "Gravewood High" },
    { name: "你的農場生活 Farm For Your Life", search: "Farm For Your Life" },
    { name: "死亡回歸 Returnal", search: "Returnal" },
    { name: "絕命精神病院 2 Outlast 2", search: "Outlast 2" },
    { name: "惡靈古堡 8 Resident Evil Village", search: "Resident Evil Village" },
    { name: "破門 Breaking Gates", search: "Breaking Gates", aliases: ["Breaking Gates 破門而出"] }, // Steam TW tchinese name (appid 1248550); not on Bahamut,
    { name: "黑暗靈魂 1 Dark Souls 1", search: "Dark Souls" },
    { name: "古墓奇兵：歐西里斯神殿 Lara Croft and the Temple of Osiris", search: "Temple of Osiris" },
    { name: "蹩腳的攀岩者 Crappy Climber", search: "Crappy Climber" },
    { name: "黎明死線 Dead by Daylight", search: "Dead by Daylight" }
  ];
});
