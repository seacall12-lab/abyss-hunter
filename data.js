(function (global) {
  "use strict";

  const CONFIG = {
    GAME_VERSION: "0.5.0",
    SAVE_VERSION: 5,
    STORAGE_KEY: "abyssHunter.save",
    AUTOSAVE_INTERVAL_MS: 5000,
    MAX_DELTA_MS: 100,
    MONSTERS_PER_WAVE: 5,
    MONSTER_RESPAWN_DELAY_MS: 650,
    PLAYER_REVIVE_DELAY_MS: 2500,
    DEFAULT_SPEED: 1,
    SPEED_OPTIONS: [1, 2, 3],
    MAX_LEVEL: 999,
    MAX_INVENTORY: 120,
    MAX_BATTLE_LOGS: 80,
    DEFAULT_VIEW: "hunt",
    VIEW_IDS: ["hunt", "equipment", "forge", "boss"],
    INVENTORY_SORT_OPTIONS: ["newest", "score", "rarity", "level"],
    FORGE_SORT_OPTIONS: ["score", "enhancement", "rarity", "level"],
    MAX_ENHANCEMENT: 15
  };

  const PLAYER = {
    id: "warrior",
    name: "Abyss Warrior",
    className: "Warrior",
    baseStats: {
      maxHp: 140,
      attack: 16,
      defense: 4,
      attackSpeed: 1,
      critChance: 0.08,
      critDamage: 1.6,
      lifesteal: 0,
      bossDamage: 0,
      normalDamage: 0,
      goldBonus: 0
    },
    growthPerLevel: {
      maxHp: 18,
      attack: 3.2,
      defense: 1.1
    },
    colors: {
      body: "#6fe7ff",
      armor: "#3f70ba",
      outline: "#d8f7ff",
      weapon: "#f4fbff",
      aura: "rgba(111, 231, 255, 0.35)"
    }
  };

  const MONSTERS = {
    forestSlime: {
      id: "forestSlime",
      name: "Forest Slime",
      levelOffset: 0,
      maxHp: 46,
      attack: 7,
      defense: 1,
      attackInterval: 1.42,
      expReward: 18,
      goldMin: 4,
      goldMax: 7,
      shape: "slime",
      color: "#70dd8a",
      accentColor: "#baffc5",
      shadowColor: "rgba(58, 207, 106, 0.32)"
    },
    thornWolf: {
      id: "thornWolf",
      name: "Thorn Wolf",
      levelOffset: 1,
      maxHp: 66,
      attack: 10,
      defense: 2,
      attackInterval: 1.12,
      expReward: 24,
      goldMin: 6,
      goldMax: 9,
      shape: "wolf",
      color: "#9fa8b8",
      accentColor: "#dce2ee",
      shadowColor: "rgba(178, 190, 211, 0.28)"
    },
    goblinScout: {
      id: "goblinScout",
      name: "Goblin Scout",
      levelOffset: 2,
      maxHp: 82,
      attack: 12,
      defense: 3,
      attackInterval: 1.28,
      expReward: 30,
      goldMin: 8,
      goldMax: 12,
      shape: "goblin",
      color: "#93c95f",
      accentColor: "#ddf7b9",
      shadowColor: "rgba(142, 204, 78, 0.28)"
    }
  };

  const REGIONS = [
    {
      id: "beginnerForest",
      order: 1,
      name: "Beginner Forest",
      description: "The first hunting ground.",
      unlockRequirement: null,
      monsterIds: ["forestSlime", "thornWolf", "goblinScout"],
      bossIds: ["ancientTreant", "thornAlpha", "goblinWarlord"],
      background: {
        skyTop: "#172b46",
        skyBottom: "#0c1729",
        ground: "#12261f",
        accent: "#4f9b73"
      }
    },
    {
      id: "abandonedMine",
      order: 2,
      name: "Abandoned Mine",
      description: "Prepared for a later update.",
      unlockRequirement: {
        type: "bossClear",
        bossId: "goblinWarlord"
      },
      monsterIds: [],
      bossIds: [],
      background: {
        skyTop: "#252536",
        skyBottom: "#11131d",
        ground: "#24211f",
        accent: "#a1764e"
      },
      disabled: true
    }
  ];

  const BOSSES = {
    ancientTreant: {
      id: "ancientTreant",
      regionId: "beginnerForest",
      order: 1,
      name: "고대 수호목",
      subtitle: "Forest Guardian",
      unlockWave: 10,
      recommendedPower: 420,
      timeLimit: 60,
      maxHp: 2650,
      attack: 31,
      defense: 8,
      attackInterval: 1.7,
      expReward: 250,
      goldReward: 280,
      stoneReward: 4,
      shape: "treant",
      color: "#7eae63",
      accentColor: "#d5f0a8",
      auraColor: "rgba(115, 191, 92, 0.32)",
      pattern: {
        name: "Root Crush",
        interval: 9,
        firstDelay: 6.5,
        warningDuration: 2.2,
        damageMultiplier: 2.65
      },
      firstClearReward: {
        gold: 1000,
        enhancementStone: 20,
        rarity: "epic"
      },
      repeatDrop: {
        minimumRarity: "rare",
        dropChance: 1
      }
    },
    thornAlpha: {
      id: "thornAlpha",
      regionId: "beginnerForest",
      order: 2,
      name: "가시 우두머리",
      subtitle: "Thorn Pack Alpha",
      unlockWave: 20,
      recommendedPower: 850,
      timeLimit: 65,
      maxHp: 6100,
      attack: 52,
      defense: 15,
      attackInterval: 1.35,
      expReward: 520,
      goldReward: 560,
      stoneReward: 7,
      shape: "alphaWolf",
      color: "#a5aec1",
      accentColor: "#ffcf72",
      auraColor: "rgba(192, 206, 235, 0.34)",
      pattern: {
        name: "Thorn Pounce",
        interval: 8,
        firstDelay: 5.5,
        warningDuration: 1.8,
        damageMultiplier: 2.9
      },
      firstClearReward: {
        gold: 2200,
        enhancementStone: 35,
        rarity: "epic"
      },
      repeatDrop: {
        minimumRarity: "rare",
        dropChance: 1
      }
    },
    goblinWarlord: {
      id: "goblinWarlord",
      regionId: "beginnerForest",
      order: 3,
      name: "고블린 전쟁군주",
      subtitle: "Goblin Warlord",
      unlockWave: 30,
      recommendedPower: 1450,
      timeLimit: 70,
      maxHp: 11800,
      attack: 78,
      defense: 24,
      attackInterval: 1.5,
      expReward: 900,
      goldReward: 950,
      stoneReward: 12,
      shape: "warlord",
      color: "#88bd58",
      accentColor: "#ff7d65",
      auraColor: "rgba(213, 75, 62, 0.32)",
      pattern: {
        name: "Warlord Smash",
        interval: 7.5,
        firstDelay: 5,
        warningDuration: 1.6,
        damageMultiplier: 3.2
      },
      firstClearReward: {
        gold: 4000,
        enhancementStone: 55,
        rarity: "legendary",
        unlockRegionId: "abandonedMine"
      },
      repeatDrop: {
        minimumRarity: "epic",
        dropChance: 1
      }
    }
  };

  const BOSS_SKILLS = {
    smash: {
      id: "smash",
      name: "Smash",
      cooldown: 5,
      damageMultiplier: 2.35,
      ultimateGain: 22
    },
    guard: {
      id: "guard",
      name: "Guard",
      cooldown: 6,
      duration: 2.2,
      normalReduction: 0.55,
      warningReduction: 0.9
    },
    potion: {
      id: "potion",
      name: "Potion",
      cooldown: 4,
      uses: 3,
      healRatio: 0.35
    },
    ultimate: {
      id: "ultimate",
      name: "Ultimate",
      requiredGauge: 100,
      damageMultiplier: 6.5
    },
    basicAttackGaugeGain: 5,
    damageTakenGaugeGain: 0.12
  };

  const ITEM_SLOTS = {
    weapon: { id: "weapon", name: "Weapon", icon: "W", order: 1 },
    helmet: { id: "helmet", name: "Helmet", icon: "H", order: 2 },
    armor: { id: "armor", name: "Armor", icon: "A", order: 3 },
    gloves: { id: "gloves", name: "Gloves", icon: "G", order: 4 },
    boots: { id: "boots", name: "Boots", icon: "B", order: 5 },
    necklace: { id: "necklace", name: "Necklace", icon: "N", order: 6 }
  };

  const RARITIES = {
    common: {
      id: "common",
      name: "Common",
      color: "#aab2c0",
      glow: "rgba(170, 178, 192, 0.24)",
      order: 1,
      weight: 70,
      statMultiplier: 1,
      optionCount: [0, 1],
      salvageMultiplier: 1
    },
    rare: {
      id: "rare",
      name: "Rare",
      color: "#4b8eff",
      glow: "rgba(75, 142, 255, 0.34)",
      order: 2,
      weight: 23,
      statMultiplier: 1.22,
      optionCount: [1, 2],
      salvageMultiplier: 2.2
    },
    epic: {
      id: "epic",
      name: "Epic",
      color: "#af58ff",
      glow: "rgba(175, 88, 255, 0.38)",
      order: 3,
      weight: 6,
      statMultiplier: 1.52,
      optionCount: [2, 3],
      salvageMultiplier: 5
    },
    legendary: {
      id: "legendary",
      name: "Legendary",
      color: "#ff993d",
      glow: "rgba(255, 153, 61, 0.45)",
      order: 4,
      weight: 1,
      statMultiplier: 1.95,
      optionCount: [3, 4],
      salvageMultiplier: 12
    }
  };

  const ITEM_BASE_NAMES = {
    weapon: ["Iron Edge", "Thorn Blade", "Goblin Splitter"],
    helmet: ["Leather Helm", "Thorn Hood", "Scout Helmet"],
    armor: ["Traveler Armor", "Bark Plate", "Goblin Mail"],
    gloves: ["Leather Gloves", "Battle Grips", "Wolf Claws"],
    boots: ["Trail Boots", "Hunter Boots", "Silent Steps"],
    necklace: ["Forest Charm", "Blue Core Pendant", "War Token"]
  };

  const ITEM_AFFIXES = [
    { stat: "attack", name: "Attack", min: 1, max: 5, type: "flat" },
    { stat: "defense", name: "Defense", min: 1, max: 4, type: "flat" },
    { stat: "maxHp", name: "Max HP", min: 8, max: 28, type: "flat" },
    { stat: "attackSpeed", name: "Attack Speed", min: 0.01, max: 0.05, type: "ratio" },
    { stat: "critChance", name: "Crit Chance", min: 0.01, max: 0.04, type: "ratio" },
    { stat: "critDamage", name: "Crit Damage", min: 0.04, max: 0.12, type: "ratio" },
    { stat: "lifesteal", name: "Lifesteal", min: 0.005, max: 0.02, type: "ratio" },
    { stat: "bossDamage", name: "Boss Damage", min: 0.02, max: 0.08, type: "ratio" },
    { stat: "normalDamage", name: "Monster Damage", min: 0.02, max: 0.08, type: "ratio" },
    { stat: "goldBonus", name: "Gold Bonus", min: 0.02, max: 0.08, type: "ratio" }
  ];

  const LOOT = {
    baseDropChance: 0.08,
    slots: Object.keys(ITEM_SLOTS),
    rarityOrder: ["common", "rare", "epic", "legendary"]
  };

  const ENHANCEMENT = {
    maxLevel: CONFIG.MAX_ENHANCEMENT,
    successRates: [
      1,
      0.95,
      0.9,
      0.84,
      0.78,
      0.7,
      0.62,
      0.54,
      0.46,
      0.38,
      0.3,
      0.23,
      0.17,
      0.12,
      0.08
    ],
    goldBase: 55,
    stoneBase: 1,
    perLevelStatRate: 0.075,
    highLevelBonusRate: 0.025
  };

  const STAT_KEYS = [
    "maxHp",
    "attack",
    "defense",
    "attackSpeed",
    "critChance",
    "critDamage",
    "lifesteal",
    "bossDamage",
    "normalDamage",
    "goldBonus"
  ];

  const STAT_META = {
    maxHp: { name: "Max HP", type: "flat", powerWeight: 0.18 },
    attack: { name: "Attack", type: "flat", powerWeight: 5.2 },
    defense: { name: "Defense", type: "flat", powerWeight: 3.4 },
    attackSpeed: { name: "Attack Speed", type: "ratio", powerWeight: 72 },
    critChance: { name: "Crit Chance", type: "ratio", powerWeight: 420 },
    critDamage: { name: "Crit Damage", type: "ratio", powerWeight: 120 },
    lifesteal: { name: "Lifesteal", type: "ratio", powerWeight: 520 },
    bossDamage: { name: "Boss Damage", type: "ratio", powerWeight: 260 },
    normalDamage: { name: "Monster Damage", type: "ratio", powerWeight: 190 },
    goldBonus: { name: "Gold Bonus", type: "ratio", powerWeight: 90 }
  };

  function clamp(value, min, max) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : min;
  }

  function randomRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function randomInteger(min, max) {
    const safeMin = Math.ceil(Math.min(min, max));
    const safeMax = Math.floor(Math.max(min, max));
    return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
  }

  function getRequiredExp(level) {
    const safeLevel = clamp(Math.floor(level), 1, CONFIG.MAX_LEVEL);
    return Math.floor(70 + 30 * Math.pow(safeLevel, 1.35));
  }

  function getPlayerBaseStats(level) {
    const safeLevel = clamp(Math.floor(level), 1, CONFIG.MAX_LEVEL);
    const offset = safeLevel - 1;
    const base = PLAYER.baseStats;
    const growth = PLAYER.growthPerLevel;
    return {
      maxHp: Math.round(base.maxHp + growth.maxHp * offset),
      attack: Math.round((base.attack + growth.attack * offset) * 10) / 10,
      defense: Math.round((base.defense + growth.defense * offset) * 10) / 10,
      attackSpeed: Math.round((base.attackSpeed + Math.min(0.35, Math.floor(offset / 5) * 0.02)) * 100) / 100,
      critChance: Math.round((base.critChance + Math.min(0.07, Math.floor(offset / 10) * 0.01)) * 1000) / 1000,
      critDamage: base.critDamage,
      lifesteal: base.lifesteal,
      bossDamage: base.bossDamage,
      normalDamage: base.normalDamage,
      goldBonus: base.goldBonus
    };
  }

  function getRegion(regionId) {
    return REGIONS.find(function (region) {
      return region.id === regionId;
    }) || REGIONS[0];
  }

  function getMonsterTemplate(monsterId) {
    return MONSTERS[monsterId] || MONSTERS.forestSlime;
  }

  function getWaveScaling(wave) {
    const safeWave = Math.max(1, Math.floor(Number(wave) || 1));
    const offset = safeWave - 1;
    const milestone = Math.floor(offset / 10);
    return {
      hp: 1 + offset * 0.18 + milestone * 0.35,
      attack: 1 + offset * 0.12 + milestone * 0.2,
      defense: 1 + offset * 0.08 + milestone * 0.14,
      reward: 1 + offset * 0.1 + milestone * 0.15
    };
  }

  function buildMonster(regionId, wave, spawnIndex) {
    const region = getRegion(regionId);
    const monsterIds = region.monsterIds.length ? region.monsterIds : REGIONS[0].monsterIds;
    const safeWave = Math.max(1, Math.floor(Number(wave) || 1));
    const safeIndex = Math.max(0, Math.floor(Number(spawnIndex) || 0));
    const template = getMonsterTemplate(monsterIds[(safeWave - 1 + safeIndex) % monsterIds.length]);
    const scaling = getWaveScaling(safeWave);
    const variation = randomRange(0.96, 1.04);
    const maxHp = Math.max(1, Math.round(template.maxHp * scaling.hp * variation));
    const goldMin = Math.max(1, Math.round(template.goldMin * scaling.reward));
    const goldMax = Math.max(goldMin, Math.round(template.goldMax * scaling.reward));
    return {
      instanceId: [template.id, Date.now().toString(36), Math.random().toString(36).slice(2, 8)].join("-"),
      templateId: template.id,
      name: template.name,
      level: Math.max(1, safeWave + template.levelOffset),
      wave: safeWave,
      isBoss: false,
      maxHp: maxHp,
      currentHp: maxHp,
      attack: Math.max(1, Math.round(template.attack * scaling.attack * variation)),
      defense: Math.max(0, Math.round(template.defense * scaling.defense)),
      attackInterval: Math.max(0.45, template.attackInterval),
      expReward: Math.max(1, Math.round(template.expReward * scaling.reward)),
      goldReward: randomInteger(goldMin, goldMax),
      shape: template.shape,
      color: template.color,
      accentColor: template.accentColor,
      shadowColor: template.shadowColor
    };
  }

  function getBoss(bossId) {
    return BOSSES[bossId] || BOSSES.ancientTreant;
  }

  function getBossList(regionId) {
    return Object.keys(BOSSES)
      .map(function (id) {
        return BOSSES[id];
      })
      .filter(function (boss) {
        return !regionId || boss.regionId === regionId;
      })
      .sort(function (left, right) {
        return left.order - right.order;
      });
  }

  function buildBoss(bossId) {
    const boss = getBoss(bossId);
    return {
      instanceId: [boss.id, Date.now().toString(36), Math.random().toString(36).slice(2, 8)].join("-"),
      templateId: boss.id,
      name: boss.name,
      isBoss: true,
      level: boss.unlockWave,
      maxHp: boss.maxHp,
      currentHp: boss.maxHp,
      attack: boss.attack,
      defense: boss.defense,
      attackInterval: boss.attackInterval,
      expReward: boss.expReward,
      goldReward: boss.goldReward,
      stoneReward: boss.stoneReward,
      timeLimit: boss.timeLimit,
      shape: boss.shape,
      color: boss.color,
      accentColor: boss.accentColor,
      auraColor: boss.auraColor,
      pattern: JSON.parse(JSON.stringify(boss.pattern))
    };
  }

  function getItemSlot(slotId) {
    return ITEM_SLOTS[slotId] || null;
  }

  function getRarity(rarityId) {
    return RARITIES[rarityId] || RARITIES.common;
  }

  function getRarityOrder(rarityId) {
    return getRarity(rarityId).order || 0;
  }

  function getStatMeta(statKey) {
    return STAT_META[statKey] || {
      name: statKey,
      type: "flat",
      powerWeight: 0
    };
  }

  function getEnhancementRate(level) {
    const safeLevel = clamp(Math.floor(Number(level) || 0), 0, CONFIG.MAX_ENHANCEMENT);
    const highLevels = Math.max(0, safeLevel - 10);
    return safeLevel * ENHANCEMENT.perLevelStatRate + highLevels * ENHANCEMENT.highLevelBonusRate;
  }

  function getEnhancementInfo(itemOrLevel) {
    const item = typeof itemOrLevel === "object" && itemOrLevel ? itemOrLevel : null;
    const currentLevel = clamp(Math.floor(Number(item ? item.enhancement : itemOrLevel) || 0), 0, CONFIG.MAX_ENHANCEMENT);
    const itemLevel = Math.max(1, Math.floor(Number(item && item.itemLevel) || 1));
    const rarity = getRarity(item && item.rarity);
    const isMax = currentLevel >= CONFIG.MAX_ENHANCEMENT;
    const nextLevel = Math.min(CONFIG.MAX_ENHANCEMENT, currentLevel + 1);
    const rarityFactor = 1 + (rarity.order - 1) * 0.35;
    return {
      currentLevel: currentLevel,
      nextLevel: nextLevel,
      isMax: isMax,
      successChance: isMax ? 0 : ENHANCEMENT.successRates[currentLevel],
      goldCost: isMax ? 0 : Math.round(ENHANCEMENT.goldBase * Math.pow(currentLevel + 1, 1.55) * (1 + itemLevel * 0.05) * rarityFactor),
      stoneCost: isMax ? 0 : Math.max(1, Math.ceil(ENHANCEMENT.stoneBase * Math.pow(currentLevel + 1, 1.18) * rarityFactor)),
      currentRate: getEnhancementRate(currentLevel),
      nextRate: getEnhancementRate(nextLevel)
    };
  }

  function calculateEnhancementStats(baseStats, enhancementLevel) {
    const result = {};
    const rate = getEnhancementRate(enhancementLevel);
    const source = baseStats && typeof baseStats === "object" ? baseStats : {};
    Object.keys(source).forEach(function (key) {
      const value = Number(source[key]);
      if (!Number.isFinite(value) || value === 0) {
        return;
      }
      const meta = getStatMeta(key);
      result[key] = meta.type === "ratio"
        ? Math.round(value * rate * 10000) / 10000
        : Math.max(0, Math.round(value * rate * 10) / 10);
    });
    return result;
  }

  function getSalvageReward(item) {
    if (!item || typeof item !== "object") {
      return { gold: 0, enhancementStone: 0 };
    }
    const rarity = getRarity(item.rarity);
    const itemLevel = Math.max(1, Math.floor(Number(item.itemLevel || item.requiredLevel) || 1));
    const enhancement = clamp(Math.floor(Number(item.enhancement) || 0), 0, CONFIG.MAX_ENHANCEMENT);
    const bossBonus = item.sourceBossId ? 1.25 : 1;
    const enhanceBonus = 1 + enhancement * 0.18;
    const gold = Math.max(1, Math.round((12 + itemLevel * 3.5) * rarity.salvageMultiplier * enhanceBonus * bossBonus));
    const enhancementStone = Math.max(
      rarity.order === 1 && enhancement === 0 ? 0 : 1,
      Math.round((rarity.order - 1 + enhancement * 0.45) * bossBonus)
    );
    return {
      gold: gold,
      enhancementStone: enhancementStone
    };
  }

  global.GameData = {
    CONFIG: CONFIG,
    PLAYER: PLAYER,
    MONSTERS: MONSTERS,
    REGIONS: REGIONS,
    BOSSES: BOSSES,
    BOSS_SKILLS: BOSS_SKILLS,
    ITEM_SLOTS: ITEM_SLOTS,
    RARITIES: RARITIES,
    ITEM_BASE_NAMES: ITEM_BASE_NAMES,
    ITEM_AFFIXES: ITEM_AFFIXES,
    LOOT: LOOT,
    ENHANCEMENT: ENHANCEMENT,
    STAT_KEYS: STAT_KEYS,
    STAT_META: STAT_META,
    clamp: clamp,
    randomRange: randomRange,
    randomInteger: randomInteger,
    getRequiredExp: getRequiredExp,
    getPlayerBaseStats: getPlayerBaseStats,
    getRegion: getRegion,
    getMonsterTemplate: getMonsterTemplate,
    getWaveScaling: getWaveScaling,
    buildMonster: buildMonster,
    getBoss: getBoss,
    getBossList: getBossList,
    buildBoss: buildBoss,
    getItemSlot: getItemSlot,
    getRarity: getRarity,
    getRarityOrder: getRarityOrder,
    getStatMeta: getStatMeta,
    getEnhancementRate: getEnhancementRate,
    getEnhancementInfo: getEnhancementInfo,
    calculateEnhancementStats: calculateEnhancementStats,
    getSalvageReward: getSalvageReward
  };
})(window);
