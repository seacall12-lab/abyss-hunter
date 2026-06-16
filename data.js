(function (global) {
  "use strict";

  const CONFIG = {
    GAME_VERSION: "0.5.4",
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

  if (!global.GameContentData) {
    throw new Error("content-data.js must be loaded before data.js");
  }
  const Content = global.GameContentData;
  const PLAYER = Content.PLAYER;
  const MONSTERS = Content.MONSTERS;
  const REGIONS = Content.REGIONS;
  const BOSSES = Content.BOSSES;
  const BOSS_SKILLS = Content.BOSS_SKILLS;
  const ITEM_SLOTS = Content.ITEM_SLOTS;
  const RARITIES = Content.RARITIES;
  const ITEM_BASE_NAMES = Content.ITEM_BASE_NAMES;
  const ITEM_AFFIXES = Content.ITEM_AFFIXES;
  const LOOT = Content.LOOT;
  const ENHANCEMENT = Content.ENHANCEMENT;
  const STAT_KEYS = Content.STAT_KEYS;
  const STAT_META = Content.STAT_META;
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
