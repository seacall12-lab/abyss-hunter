(function (global) {
  "use strict";

  if (!global.GameData) {
    throw new Error("data.js must be loaded before state.js");
  }

  const Data = global.GameData;
  const CONFIG = Data.CONFIG;
  const STORAGE_KEY = CONFIG.STORAGE_KEY;
  const SAVE_VERSION = CONFIG.SAVE_VERSION;
  const listeners = new Set();

  let state = null;
  let dirty = false;
  let lastError = null;

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function finiteNumber(value, fallback, min, max) {
    const number = Number(value);
    let result = Number.isFinite(number) ? number : Number(fallback) || 0;
    if (Number.isFinite(min)) {
      result = Math.max(min, result);
    }
    if (Number.isFinite(max)) {
      result = Math.min(max, result);
    }
    return result;
  }

  function finiteInteger(value, fallback, min, max) {
    return Math.floor(finiteNumber(value, fallback, min, max));
  }

  function safeBoolean(value, fallback) {
    return typeof value === "boolean" ? value : Boolean(fallback);
  }

  function safeString(value, fallback, maxLength) {
    const text = typeof value === "string" ? value.trim() : "";
    return (text || String(fallback || "")).slice(0, maxLength || 100);
  }

  function emit(type, payload) {
    listeners.forEach(function (listener) {
      try {
        listener({
          type: type,
          payload: payload || null,
          state: state
        });
      } catch (error) {
        console.error("State listener failed", error);
      }
    });
  }

  function markDirty(reason) {
    dirty = true;
    emit("dirty", { reason: reason || "unknown" });
  }

  function createEmptyEquipment() {
    const equipment = {};
    Object.keys(Data.ITEM_SLOTS).forEach(function (slotId) {
      equipment[slotId] = null;
    });
    return equipment;
  }

  function createBossProgress() {
    const progress = {};
    Data.getBossList().forEach(function (boss) {
      progress[boss.id] = {
        attempts: 0,
        kills: 0,
        firstClear: false,
        bestTime: null,
        lastClearTime: null
      };
    });
    return progress;
  }

  function createDefaultStatistics() {
    return {
      totalKills: 0,
      totalGoldEarned: 0,
      totalExpEarned: 0,
      totalDeaths: 0,
      totalCriticalHits: 0,
      totalDamageDealt: 0,
      totalDamageTaken: 0,
      totalItemsFound: 0,
      totalItemsEquipped: 0,
      totalAutoEquips: 0,
      totalEnhanceAttempts: 0,
      totalEnhanceSuccesses: 0,
      totalItemsSalvaged: 0,
      totalBossAttempts: 0,
      totalBossKills: 0,
      highestSingleHit: 0,
      highestPower: 0,
      playTimeSeconds: 0
    };
  }

  function createDefaultState() {
    const now = Date.now();
    const baseStats = Data.getPlayerBaseStats(1);
    return {
      saveVersion: SAVE_VERSION,
      gameVersion: CONFIG.GAME_VERSION,
      player: {
        id: Data.PLAYER.id,
        name: Data.PLAYER.name,
        className: Data.PLAYER.className,
        level: 1,
        exp: 0,
        expToNext: Data.getRequiredExp(1),
        currentHp: baseStats.maxHp,
        maxHp: baseStats.maxHp,
        attack: baseStats.attack,
        defense: baseStats.defense,
        attackSpeed: baseStats.attackSpeed,
        critChance: baseStats.critChance,
        critDamage: baseStats.critDamage,
        lifesteal: baseStats.lifesteal,
        bossDamage: baseStats.bossDamage,
        normalDamage: baseStats.normalDamage,
        goldBonus: baseStats.goldBonus,
        power: 0
      },
      progression: {
        currentRegionId: Data.REGIONS[0].id,
        currentWave: 1,
        defeatedInWave: 0,
        highestWave: 1,
        unlockedRegionIds: [Data.REGIONS[0].id],
        clearedBossRegionIds: []
      },
      equipment: createEmptyEquipment(),
      inventory: [],
      currencies: {
        gold: 0,
        enhancementStone: 0
      },
      settings: {
        speed: CONFIG.DEFAULT_SPEED,
        paused: false,
        reducedEffects: false,
        showDamageNumbers: true,
        soundEnabled: true,
        soundVolume: 0.55,
        vibrationEnabled: true,
        screenShakeEnabled: true,
        activeView: CONFIG.DEFAULT_VIEW,
        inventorySort: "newest",
        inventorySlotFilter: "all",
        inventoryRarityFilter: "all",
        autoSalvage: {
          common: false,
          rare: false,
          epic: false,
          legendary: false
        }
      },
      forge: {
        selectedItemId: null,
        sort: "score",
        salvageSelectedIds: []
      },
      boss: {
        selectedBossId: "ancientTreant",
        progress: createBossProgress()
      },
      statistics: createDefaultStatistics(),
      recentLoot: null,
      meta: {
        createdAt: now,
        lastSavedAt: 0,
        lastLoadedAt: now,
        lastPlayedAt: now
      }
    };
  }

  function normalizeStatMap(source) {
    const result = {};
    const incoming = isPlainObject(source) ? source : {};
    Data.STAT_KEYS.forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(incoming, key)) {
        result[key] = finiteNumber(incoming[key], 0, -999999999, 999999999);
      }
    });
    return result;
  }

  function normalizeOptions(source) {
    if (!Array.isArray(source)) {
      return [];
    }
    return source.slice(0, 12).map(function (option) {
      if (!isPlainObject(option) || !Data.STAT_KEYS.includes(option.stat)) {
        return null;
      }
      const statMeta = Data.getStatMeta(option.stat);
      return {
        stat: option.stat,
        name: safeString(option.name, statMeta.name, 40),
        value: finiteNumber(option.value, 0, -999999999, 999999999),
        type: option.type === "ratio" || statMeta.type === "ratio" ? "ratio" : "flat"
      };
    }).filter(Boolean);
  }

  function normalizeItem(item, fallbackIndex) {
    if (!isPlainObject(item)) {
      return null;
    }
    const slotId = Object.prototype.hasOwnProperty.call(Data.ITEM_SLOTS, item.slot) ? item.slot : "weapon";
    const rarityId = Object.prototype.hasOwnProperty.call(Data.RARITIES, item.rarity) ? item.rarity : "common";
    const fallbackId = ["item", Date.now().toString(36), String(fallbackIndex || 0), Math.random().toString(36).slice(2, 8)].join("-");
    const enhancement = finiteInteger(item.enhancement, 0, 0, CONFIG.MAX_ENHANCEMENT);
    const baseStats = normalizeStatMap(item.baseStats || item.stats);
    const normalized = {
      id: safeString(item.id, fallbackId, 120),
      name: safeString(item.name, Data.ITEM_SLOTS[slotId].name, 100),
      slot: slotId,
      rarity: rarityId,
      requiredLevel: finiteInteger(item.requiredLevel, 1, 1, CONFIG.MAX_LEVEL),
      itemLevel: finiteInteger(item.itemLevel, item.requiredLevel || 1, 1, CONFIG.MAX_LEVEL),
      enhancement: enhancement,
      locked: safeBoolean(item.locked, false),
      equipped: safeBoolean(item.equipped, false),
      baseStats: baseStats,
      bonusStats: Data.calculateEnhancementStats(baseStats, enhancement),
      randomOptions: normalizeOptions(item.randomOptions || item.options),
      salvageValue: finiteInteger(item.salvageValue, 0, 0, 999999999),
      salvageStoneValue: finiteInteger(item.salvageStoneValue, 0, 0, 999999999),
      sellValue: finiteInteger(item.sellValue, 0, 0, 999999999),
      sourceBossId: item.sourceBossId || item.bossId || null,
      acquiredAt: finiteInteger(item.acquiredAt, Date.now(), 0, Number.MAX_SAFE_INTEGER)
    };
    const reward = Data.getSalvageReward(normalized);
    normalized.salvageValue = reward.gold;
    normalized.salvageStoneValue = reward.enhancementStone;
    return normalized;
  }

  function ensureUniqueItemId(item, usedIds) {
    if (!item) {
      return null;
    }
    const baseId = item.id || ("item-" + Date.now().toString(36));
    let candidateId = baseId;
    while (usedIds.has(candidateId)) {
      candidateId = baseId + "-" + Math.random().toString(36).slice(2, 7);
    }
    item.id = candidateId;
    usedIds.add(candidateId);
    return item;
  }

  function normalizeEquipment(source, usedIds) {
    const result = createEmptyEquipment();
    const incoming = isPlainObject(source) ? source : {};
    Object.keys(result).forEach(function (slotId, index) {
      const normalized = normalizeItem(incoming[slotId], index);
      if (normalized && normalized.slot === slotId) {
        normalized.equipped = true;
        result[slotId] = ensureUniqueItemId(normalized, usedIds);
      }
    });
    return result;
  }

  function normalizeInventory(source, usedIds) {
    if (!Array.isArray(source)) {
      return [];
    }
    return source.slice(0, CONFIG.MAX_INVENTORY).map(function (item, index) {
      const normalized = normalizeItem(item, index);
      if (!normalized) {
        return null;
      }
      normalized.equipped = false;
      return ensureUniqueItemId(normalized, usedIds);
    }).filter(Boolean);
  }

  function addStatMap(target, statMap) {
    const source = isPlainObject(statMap) ? statMap : {};
    Data.STAT_KEYS.forEach(function (key) {
      target[key] += finiteNumber(source[key], 0, -999999999, 999999999);
    });
  }

  function collectItemBonuses(item) {
    const bonuses = {};
    Data.STAT_KEYS.forEach(function (key) {
      bonuses[key] = 0;
    });
    if (!item) {
      return bonuses;
    }
    addStatMap(bonuses, item.baseStats);
    addStatMap(bonuses, item.bonusStats);
    if (Array.isArray(item.randomOptions)) {
      item.randomOptions.forEach(function (option) {
        if (option && Data.STAT_KEYS.includes(option.stat)) {
          bonuses[option.stat] += finiteNumber(option.value, 0, -999999999, 999999999);
        }
      });
    }
    return bonuses;
  }

  function collectEquipmentBonuses(targetState) {
    const bonuses = {};
    Data.STAT_KEYS.forEach(function (key) {
      bonuses[key] = 0;
    });
    Object.keys(Data.ITEM_SLOTS).forEach(function (slotId) {
      const itemBonuses = collectItemBonuses(targetState.equipment[slotId]);
      Data.STAT_KEYS.forEach(function (key) {
        bonuses[key] += itemBonuses[key];
      });
    });
    return bonuses;
  }

  function computeItemScore(item) {
    if (!item) {
      return 0;
    }
    const bonuses = collectItemBonuses(item);
    let score = 0;
    Data.STAT_KEYS.forEach(function (key) {
      score += bonuses[key] * Data.getStatMeta(key).powerWeight;
    });
    score += finiteNumber(item.enhancement, 0, 0, CONFIG.MAX_ENHANCEMENT) * 12;
    score += Data.getRarityOrder(item.rarity) * 4;
    return Math.max(0, Math.round(score));
  }

  function computeEquipmentPower(targetState) {
    return Object.keys(Data.ITEM_SLOTS).reduce(function (sum, slotId) {
      return sum + computeItemScore(targetState.equipment[slotId]);
    }, 0);
  }

  function computeCombatPower(player) {
    const rawPower =
      player.maxHp * 0.18 +
      player.attack * 5.2 +
      player.defense * 3.4 +
      player.attackSpeed * 72 +
      player.critChance * 420 +
      Math.max(0, player.critDamage - 1) * 120 +
      player.lifesteal * 520 +
      player.bossDamage * 260 +
      player.normalDamage * 190;
    return Math.max(1, Math.round(rawPower));
  }

  function applyDerivedPlayerStats(targetState, options) {
    const settings = options || {};
    const player = targetState.player;
    const oldMaxHp = finiteNumber(player.maxHp, 1, 1, 999999999);
    const oldCurrentHp = finiteNumber(player.currentHp, oldMaxHp, 0, oldMaxHp);
    const oldHpRatio = oldMaxHp > 0 ? oldCurrentHp / oldMaxHp : 1;
    const base = Data.getPlayerBaseStats(player.level);
    const bonuses = collectEquipmentBonuses(targetState);

    player.maxHp = Math.max(1, Math.round(base.maxHp + bonuses.maxHp));
    player.attack = Math.max(1, Math.round((base.attack + bonuses.attack) * 10) / 10);
    player.defense = Math.max(0, Math.round((base.defense + bonuses.defense) * 10) / 10);
    player.attackSpeed = Data.clamp(Math.round((base.attackSpeed + bonuses.attackSpeed) * 1000) / 1000, 0.2, 5);
    player.critChance = Data.clamp(base.critChance + bonuses.critChance, 0, 0.9);
    player.critDamage = Data.clamp(base.critDamage + bonuses.critDamage, 1, 5);
    player.lifesteal = Data.clamp(base.lifesteal + bonuses.lifesteal, 0, 0.5);
    player.bossDamage = Data.clamp(base.bossDamage + bonuses.bossDamage, 0, 5);
    player.normalDamage = Data.clamp(base.normalDamage + bonuses.normalDamage, 0, 5);
    player.goldBonus = Data.clamp(base.goldBonus + bonuses.goldBonus, 0, 10);
    player.expToNext = Data.getRequiredExp(player.level);
    player.power = computeCombatPower(player);

    if (settings.healToFull) {
      player.currentHp = player.maxHp;
    } else if (settings.preserveHpRatio) {
      player.currentHp = Math.round(player.maxHp * oldHpRatio);
    } else {
      player.currentHp = Math.min(player.maxHp, Math.max(0, oldCurrentHp));
    }
    if (settings.reviveIfDead && player.currentHp <= 0) {
      player.currentHp = player.maxHp;
    }
    targetState.statistics.highestPower = Math.max(targetState.statistics.highestPower || 0, player.power);
    return player;
  }

  function normalizeLevelAndExperience(player) {
    player.level = finiteInteger(player.level, 1, 1, CONFIG.MAX_LEVEL);
    player.exp = finiteInteger(player.exp, 0, 0, Number.MAX_SAFE_INTEGER);
    let guard = 0;
    while (player.level < CONFIG.MAX_LEVEL && guard < CONFIG.MAX_LEVEL) {
      const required = Data.getRequiredExp(player.level);
      if (player.exp < required) {
        break;
      }
      player.exp -= required;
      player.level += 1;
      guard += 1;
    }
    if (player.level >= CONFIG.MAX_LEVEL) {
      player.level = CONFIG.MAX_LEVEL;
      player.exp = Math.min(player.exp, Data.getRequiredExp(CONFIG.MAX_LEVEL) - 1);
    }
  }

  function normalizeProgression(targetState) {
    const progression = targetState.progression;
    const validRegionIds = Data.REGIONS.map(function (region) {
      return region.id;
    });
    if (!validRegionIds.includes(progression.currentRegionId)) {
      progression.currentRegionId = Data.REGIONS[0].id;
    }
    progression.currentWave = finiteInteger(progression.currentWave, 1, 1, 999999);
    progression.defeatedInWave = finiteInteger(progression.defeatedInWave, 0, 0, 999999999);
    if (progression.defeatedInWave >= CONFIG.MONSTERS_PER_WAVE) {
      progression.currentWave += Math.floor(progression.defeatedInWave / CONFIG.MONSTERS_PER_WAVE);
      progression.defeatedInWave %= CONFIG.MONSTERS_PER_WAVE;
    }
    progression.highestWave = Math.max(progression.currentWave, finiteInteger(progression.highestWave, progression.currentWave, 1, 999999));
    progression.unlockedRegionIds = Array.isArray(progression.unlockedRegionIds)
      ? progression.unlockedRegionIds.filter(function (regionId, index, array) {
        return validRegionIds.includes(regionId) && array.indexOf(regionId) === index;
      })
      : [Data.REGIONS[0].id];
    if (!progression.unlockedRegionIds.includes(Data.REGIONS[0].id)) {
      progression.unlockedRegionIds.unshift(Data.REGIONS[0].id);
    }
    progression.clearedBossRegionIds = Array.isArray(progression.clearedBossRegionIds)
      ? progression.clearedBossRegionIds.filter(function (id, index, array) {
        return array.indexOf(id) === index;
      })
      : [];
  }

  function normalizeSettings(settings) {
    const speed = Number(settings.speed);
    settings.speed = CONFIG.SPEED_OPTIONS.includes(speed) ? speed : CONFIG.DEFAULT_SPEED;
    settings.paused = safeBoolean(settings.paused, false);
    settings.reducedEffects = safeBoolean(settings.reducedEffects, false);
    settings.showDamageNumbers = safeBoolean(settings.showDamageNumbers, true);
    settings.soundEnabled = safeBoolean(settings.soundEnabled, true);
    settings.soundVolume = Data.clamp(finiteNumber(settings.soundVolume, 0.55, 0, 1), 0, 1);
    settings.vibrationEnabled = safeBoolean(settings.vibrationEnabled, true);
    settings.screenShakeEnabled = safeBoolean(settings.screenShakeEnabled, true);
    settings.activeView = CONFIG.VIEW_IDS.includes(settings.activeView) ? settings.activeView : CONFIG.DEFAULT_VIEW;
    settings.inventorySort = CONFIG.INVENTORY_SORT_OPTIONS.includes(settings.inventorySort) ? settings.inventorySort : "newest";
    settings.inventorySlotFilter = settings.inventorySlotFilter === "all" || Object.prototype.hasOwnProperty.call(Data.ITEM_SLOTS, settings.inventorySlotFilter) ? settings.inventorySlotFilter : "all";
    settings.inventoryRarityFilter = settings.inventoryRarityFilter === "all" || Object.prototype.hasOwnProperty.call(Data.RARITIES, settings.inventoryRarityFilter) ? settings.inventoryRarityFilter : "all";
    settings.autoSalvage = isPlainObject(settings.autoSalvage) ? settings.autoSalvage : {};
    Object.keys(Data.RARITIES).forEach(function (rarityId) {
      settings.autoSalvage[rarityId] = safeBoolean(settings.autoSalvage[rarityId], false);
    });
  }

  function normalizeBossState(targetState) {
    targetState.boss = isPlainObject(targetState.boss) ? targetState.boss : {};
    const bossList = Data.getBossList();
    const validBossIds = bossList.map(function (boss) {
      return boss.id;
    });
    targetState.boss.selectedBossId = validBossIds.includes(targetState.boss.selectedBossId)
      ? targetState.boss.selectedBossId
      : validBossIds[0];
    const incoming = isPlainObject(targetState.boss.progress) ? targetState.boss.progress : {};
    targetState.boss.progress = {};
    bossList.forEach(function (boss) {
      const progress = isPlainObject(incoming[boss.id]) ? incoming[boss.id] : {};
      targetState.boss.progress[boss.id] = {
        attempts: finiteInteger(progress.attempts, 0, 0, Number.MAX_SAFE_INTEGER),
        kills: finiteInteger(progress.kills, 0, 0, Number.MAX_SAFE_INTEGER),
        firstClear: safeBoolean(progress.firstClear, false),
        bestTime: progress.bestTime === null || progress.bestTime === undefined ? null : finiteNumber(progress.bestTime, null, 0, 999999),
        lastClearTime: progress.lastClearTime === null || progress.lastClearTime === undefined ? null : finiteNumber(progress.lastClearTime, null, 0, 999999)
      };
      if (targetState.boss.progress[boss.id].kills > 0) {
        targetState.boss.progress[boss.id].firstClear = true;
      }
    });
  }

  function sanitizeState(incomingState) {
    const defaults = createDefaultState();
    const source = isPlainObject(incomingState) ? incomingState : {};
    const sanitized = defaults;

    sanitized.saveVersion = SAVE_VERSION;
    sanitized.gameVersion = CONFIG.GAME_VERSION;
    sanitized.player = Object.assign(sanitized.player, isPlainObject(source.player) ? source.player : {});
    sanitized.player.id = Data.PLAYER.id;
    sanitized.player.name = safeString(sanitized.player.name, Data.PLAYER.name, 40);
    sanitized.player.className = Data.PLAYER.className;
    normalizeLevelAndExperience(sanitized.player);

    sanitized.progression = Object.assign(sanitized.progression, isPlainObject(source.progression) ? source.progression : {});
    normalizeProgression(sanitized);

    const usedIds = new Set();
    sanitized.equipment = normalizeEquipment(source.equipment, usedIds);
    sanitized.inventory = normalizeInventory(source.inventory, usedIds);

    sanitized.currencies = Object.assign(sanitized.currencies, isPlainObject(source.currencies) ? source.currencies : {});
    sanitized.currencies.gold = finiteInteger(sanitized.currencies.gold, source.gold || 0, 0, Number.MAX_SAFE_INTEGER);
    sanitized.currencies.enhancementStone = finiteInteger(sanitized.currencies.enhancementStone, 0, 0, Number.MAX_SAFE_INTEGER);

    sanitized.settings = Object.assign(sanitized.settings, isPlainObject(source.settings) ? source.settings : {});
    normalizeSettings(sanitized.settings);

    sanitized.forge = Object.assign(sanitized.forge, isPlainObject(source.forge) ? source.forge : {});
    sanitized.forge.selectedItemId = typeof sanitized.forge.selectedItemId === "string" ? sanitized.forge.selectedItemId : null;
    sanitized.forge.sort = CONFIG.FORGE_SORT_OPTIONS.includes(sanitized.forge.sort) ? sanitized.forge.sort : "score";
    sanitized.forge.salvageSelectedIds = Array.isArray(sanitized.forge.salvageSelectedIds)
      ? sanitized.forge.salvageSelectedIds.filter(function (id, index, array) {
        return typeof id === "string" && array.indexOf(id) === index;
      })
      : [];

    sanitized.boss = Object.assign(sanitized.boss, isPlainObject(source.boss) ? source.boss : {});
    normalizeBossState(sanitized);

    sanitized.statistics = Object.assign(sanitized.statistics, isPlainObject(source.statistics) ? source.statistics : {});
    const defaultStatistics = createDefaultStatistics();
    Object.keys(defaultStatistics).forEach(function (key) {
      sanitized.statistics[key] = finiteNumber(sanitized.statistics[key], defaultStatistics[key], 0, Number.MAX_SAFE_INTEGER);
    });

    sanitized.recentLoot = normalizeItem(source.recentLoot, 9999);
    sanitized.meta = Object.assign(sanitized.meta, isPlainObject(source.meta) ? source.meta : {});
    sanitized.meta.createdAt = finiteInteger(sanitized.meta.createdAt, Date.now(), 0, Number.MAX_SAFE_INTEGER);
    sanitized.meta.lastSavedAt = finiteInteger(sanitized.meta.lastSavedAt, 0, 0, Number.MAX_SAFE_INTEGER);
    sanitized.meta.lastLoadedAt = Date.now();
    sanitized.meta.lastPlayedAt = finiteInteger(sanitized.meta.lastPlayedAt, Date.now(), 0, Number.MAX_SAFE_INTEGER);

    sanitized.forge.salvageSelectedIds = sanitized.forge.salvageSelectedIds.filter(function (itemId) {
      const located = findItemByIdInState(sanitized, itemId);
      return located && located.location === "inventory" && !located.item.locked;
    });
    if (sanitized.forge.selectedItemId && !findItemByIdInState(sanitized, sanitized.forge.selectedItemId)) {
      sanitized.forge.selectedItemId = null;
    }

    applyDerivedPlayerStats(sanitized, {
      preserveHpRatio: false,
      reviveIfDead: true
    });
    return sanitized;
  }

  function migrateLegacySave(rawState) {
    const migrated = isPlainObject(rawState) ? clone(rawState) : {};
    let version = finiteInteger(migrated.saveVersion, 0, 0, SAVE_VERSION);

    if (version < 1) {
      migrated.player = isPlainObject(migrated.player) ? migrated.player : {};
      migrated.progression = isPlainObject(migrated.progression) ? migrated.progression : {};
      migrated.currencies = isPlainObject(migrated.currencies) ? migrated.currencies : {};
      migrated.settings = isPlainObject(migrated.settings) ? migrated.settings : {};
      migrated.statistics = isPlainObject(migrated.statistics) ? migrated.statistics : {};
      if (migrated.gold !== undefined && migrated.currencies.gold === undefined) {
        migrated.currencies.gold = migrated.gold;
      }
      if (migrated.wave !== undefined && migrated.progression.currentWave === undefined) {
        migrated.progression.currentWave = migrated.wave;
      }
      if (migrated.highestWave !== undefined && migrated.progression.highestWave === undefined) {
        migrated.progression.highestWave = migrated.highestWave;
      }
      if (migrated.totalKills !== undefined && migrated.statistics.totalKills === undefined) {
        migrated.statistics.totalKills = migrated.totalKills;
      }
      if (migrated.speed !== undefined && migrated.settings.speed === undefined) {
        migrated.settings.speed = migrated.speed;
      }
      if (migrated.paused !== undefined && migrated.settings.paused === undefined) {
        migrated.settings.paused = migrated.paused;
      }
      version = 1;
      migrated.saveVersion = version;
    }

    if (version < 2) {
      migrated.equipment = isPlainObject(migrated.equipment) ? migrated.equipment : createEmptyEquipment();
      migrated.inventory = Array.isArray(migrated.inventory) ? migrated.inventory : [];
      migrated.settings = isPlainObject(migrated.settings) ? migrated.settings : {};
      migrated.statistics = isPlainObject(migrated.statistics) ? migrated.statistics : {};
      migrated.settings.activeView = migrated.settings.activeView || CONFIG.DEFAULT_VIEW;
      migrated.settings.inventorySort = migrated.settings.inventorySort || "newest";
      migrated.settings.inventorySlotFilter = migrated.settings.inventorySlotFilter || "all";
      migrated.settings.inventoryRarityFilter = migrated.settings.inventoryRarityFilter || "all";
      version = 2;
      migrated.saveVersion = version;
    }

    if (version < 4) {
      migrated.currencies = isPlainObject(migrated.currencies) ? migrated.currencies : {};
      migrated.currencies.enhancementStone = finiteInteger(migrated.currencies.enhancementStone, 0, 0, Number.MAX_SAFE_INTEGER);
      migrated.settings = isPlainObject(migrated.settings) ? migrated.settings : {};
      migrated.settings.autoSalvage = isPlainObject(migrated.settings.autoSalvage) ? migrated.settings.autoSalvage : {};
      migrated.forge = isPlainObject(migrated.forge) ? migrated.forge : {};
      migrated.boss = isPlainObject(migrated.boss) ? migrated.boss : {};
      migrated.statistics = isPlainObject(migrated.statistics) ? migrated.statistics : {};
      [
        "totalEnhanceAttempts",
        "totalEnhanceSuccesses",
        "totalItemsSalvaged",
        "totalBossAttempts",
        "totalBossKills"
      ].forEach(function (key) {
        migrated.statistics[key] = finiteInteger(migrated.statistics[key], 0, 0, Number.MAX_SAFE_INTEGER);
      });
      version = 4;
      migrated.saveVersion = version;
    }

    if (version < 5) {
      migrated.settings = isPlainObject(migrated.settings) ? migrated.settings : {};
      if (migrated.settings.soundEnabled === undefined) {
        migrated.settings.soundEnabled = true;
      }
      if (migrated.settings.soundVolume === undefined) {
        migrated.settings.soundVolume = 0.55;
      }
      if (migrated.settings.vibrationEnabled === undefined) {
        migrated.settings.vibrationEnabled = true;
      }
      if (migrated.settings.screenShakeEnabled === undefined) {
        migrated.settings.screenShakeEnabled = true;
      }
      version = 5;
      migrated.saveVersion = version;
    }

    migrated.saveVersion = SAVE_VERSION;
    migrated.gameVersion = CONFIG.GAME_VERSION;
    return migrated;
  }

  function backupCorruptedSave(rawText) {
    if (typeof rawText !== "string" || rawText.length === 0 || !global.localStorage) {
      return;
    }
    try {
      global.localStorage.setItem(STORAGE_KEY + ".corrupt." + Date.now(), rawText.slice(0, 100000));
    } catch (error) {
      console.warn("Could not back up corrupted save", error);
    }
  }

  function load() {
    lastError = null;
    try {
      const rawText = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      if (!rawText) {
        state = createDefaultState();
        applyDerivedPlayerStats(state, { healToFull: true });
        dirty = true;
        emit("load", { source: "default", recovered: false });
        return state;
      }
      const parsed = JSON.parse(rawText);
      const previousVersion = finiteInteger(parsed && parsed.saveVersion, 0, 0, SAVE_VERSION);
      state = sanitizeState(migrateLegacySave(parsed));
      dirty = true;
      emit("load", {
        source: "storage",
        recovered: false,
        previousSaveVersion: previousVersion,
        saveVersion: state.saveVersion,
        migrated: previousVersion < SAVE_VERSION
      });
      return state;
    } catch (error) {
      lastError = error;
      try {
        const rawText = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
        backupCorruptedSave(rawText);
        if (global.localStorage) {
          global.localStorage.removeItem(STORAGE_KEY);
        }
      } catch (storageError) {
        console.warn("Could not clear corrupted save", storageError);
      }
      state = createDefaultState();
      applyDerivedPlayerStats(state, { healToFull: true });
      dirty = true;
      emit("load-error", { error: error, recovered: true });
      return state;
    }
  }

  function save(force) {
    if (!state) {
      state = createDefaultState();
      applyDerivedPlayerStats(state, { healToFull: true });
    }
    if (!dirty && !force) {
      return true;
    }
    lastError = null;
    try {
      state.saveVersion = SAVE_VERSION;
      state.gameVersion = CONFIG.GAME_VERSION;
      state.meta.lastSavedAt = Date.now();
      state.meta.lastPlayedAt = state.meta.lastSavedAt;
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      dirty = false;
      emit("save", { savedAt: state.meta.lastSavedAt });
      return true;
    } catch (error) {
      lastError = error;
      console.error("Save failed", error);
      emit("save-error", { error: error });
      return false;
    }
  }

  function reset() {
    try {
      if (global.localStorage) {
        global.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      lastError = error;
    }
    state = createDefaultState();
    applyDerivedPlayerStats(state, { healToFull: true });
    dirty = true;
    emit("reset", null);
    save(true);
    return state;
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      return function () {};
    }
    listeners.add(listener);
    return function unsubscribe() {
      listeners.delete(listener);
    };
  }

  function getState() {
    if (!state) {
      state = createDefaultState();
      applyDerivedPlayerStats(state, { healToFull: true });
    }
    return state;
  }

  function getSnapshot() {
    return clone(getState());
  }

  function recalculatePlayerStats(options) {
    const player = applyDerivedPlayerStats(getState(), options || {});
    markDirty("recalculate-player-stats");
    emit("player-stats", {
      player: player,
      equipmentPower: computeEquipmentPower(getState())
    });
    return player;
  }

  function addExperience(amount) {
    const currentState = getState();
    const player = currentState.player;
    const gainedExp = finiteInteger(amount, 0, 0, Number.MAX_SAFE_INTEGER);
    if (gainedExp <= 0) {
      return { gainedExp: 0, levelsGained: 0, reachedMaxLevel: false };
    }
    player.exp += gainedExp;
    currentState.statistics.totalExpEarned += gainedExp;
    let levelsGained = 0;
    while (player.level < CONFIG.MAX_LEVEL) {
      const required = Data.getRequiredExp(player.level);
      if (player.exp < required) {
        break;
      }
      player.exp -= required;
      player.level += 1;
      levelsGained += 1;
    }
    if (player.level >= CONFIG.MAX_LEVEL) {
      player.level = CONFIG.MAX_LEVEL;
      player.exp = Math.min(player.exp, Data.getRequiredExp(CONFIG.MAX_LEVEL) - 1);
    }
    applyDerivedPlayerStats(currentState, {
      healToFull: levelsGained > 0,
      preserveHpRatio: levelsGained === 0
    });
    markDirty("gain-experience");
    emit("experience", {
      gainedExp: gainedExp,
      levelsGained: levelsGained,
      level: player.level
    });
    return {
      gainedExp: gainedExp,
      levelsGained: levelsGained,
      reachedMaxLevel: player.level >= CONFIG.MAX_LEVEL
    };
  }

  function addGold(amount, options) {
    const currentState = getState();
    const baseAmount = finiteInteger(amount, 0, 0, Number.MAX_SAFE_INTEGER);
    const applyBonus = !options || options.applyGoldBonus !== false;
    const multiplier = applyBonus ? 1 + currentState.player.goldBonus : 1;
    const gainedGold = Math.max(0, Math.round(baseAmount * multiplier));
    if (gainedGold <= 0) {
      return 0;
    }
    currentState.currencies.gold = Math.min(Number.MAX_SAFE_INTEGER, currentState.currencies.gold + gainedGold);
    currentState.statistics.totalGoldEarned = Math.min(Number.MAX_SAFE_INTEGER, currentState.statistics.totalGoldEarned + gainedGold);
    markDirty("gain-gold");
    emit("gold", { gainedGold: gainedGold });
    return gainedGold;
  }

  function spendGold(amount) {
    const currentState = getState();
    const cost = finiteInteger(amount, 0, 0, Number.MAX_SAFE_INTEGER);
    if (cost <= 0 || currentState.currencies.gold < cost) {
      return false;
    }
    currentState.currencies.gold -= cost;
    markDirty("spend-gold");
    emit("gold-spent", { cost: cost });
    return true;
  }

  function addEnhancementStone(amount) {
    const currentState = getState();
    const gained = finiteInteger(amount, 0, 0, Number.MAX_SAFE_INTEGER);
    if (gained <= 0) {
      return 0;
    }
    currentState.currencies.enhancementStone = Math.min(Number.MAX_SAFE_INTEGER, currentState.currencies.enhancementStone + gained);
    markDirty("gain-enhancement-stone");
    emit("enhancement-stone", { gained: gained });
    return gained;
  }

  function spendEnhancementStone(amount) {
    const currentState = getState();
    const cost = finiteInteger(amount, 0, 0, Number.MAX_SAFE_INTEGER);
    if (cost <= 0 || currentState.currencies.enhancementStone < cost) {
      return false;
    }
    currentState.currencies.enhancementStone -= cost;
    markDirty("spend-enhancement-stone");
    emit("enhancement-stone-spent", { cost: cost });
    return true;
  }

  function advanceMonsterProgress() {
    const progression = getState().progression;
    const previousWave = progression.currentWave;
    progression.defeatedInWave += 1;
    if (progression.defeatedInWave >= CONFIG.MONSTERS_PER_WAVE) {
      progression.defeatedInWave = 0;
      progression.currentWave += 1;
      progression.highestWave = Math.max(progression.highestWave, progression.currentWave);
    }
    markDirty("advance-monster-progress");
    const result = {
      waveAdvanced: progression.currentWave > previousWave,
      previousWave: previousWave,
      currentWave: progression.currentWave,
      defeatedInWave: progression.defeatedInWave
    };
    emit("progress", result);
    return result;
  }

  function recordMonsterKill() {
    const currentState = getState();
    currentState.statistics.totalKills += 1;
    markDirty("monster-kill");
    const progressResult = advanceMonsterProgress();
    emit("kill", {
      totalKills: currentState.statistics.totalKills,
      progress: progressResult
    });
    return progressResult;
  }

  function setPlayerHp(value) {
    const player = getState().player;
    player.currentHp = Data.clamp(value, 0, player.maxHp);
    markDirty("set-player-hp");
    return player.currentHp;
  }

  function damagePlayer(amount) {
    const currentState = getState();
    const damage = Math.max(0, Math.round(finiteNumber(amount, 0, 0, 999999999)));
    if (damage <= 0 || currentState.player.currentHp <= 0) {
      return 0;
    }
    const actualDamage = Math.min(currentState.player.currentHp, damage);
    currentState.player.currentHp -= actualDamage;
    currentState.statistics.totalDamageTaken += actualDamage;
    if (currentState.player.currentHp <= 0) {
      currentState.player.currentHp = 0;
      currentState.statistics.totalDeaths += 1;
      emit("player-death", null);
    }
    markDirty("player-damaged");
    return actualDamage;
  }

  function healPlayer(amount) {
    const player = getState().player;
    const healing = Math.max(0, Math.round(finiteNumber(amount, 0, 0, 999999999)));
    if (healing <= 0 || player.currentHp <= 0) {
      return 0;
    }
    const before = player.currentHp;
    player.currentHp = Math.min(player.maxHp, player.currentHp + healing);
    const actualHealing = player.currentHp - before;
    if (actualHealing > 0) {
      markDirty("player-healed");
    }
    return actualHealing;
  }

  function revivePlayer() {
    const player = getState().player;
    player.currentHp = player.maxHp;
    markDirty("player-revived");
    emit("player-revive", null);
    return player.currentHp;
  }

  function recordPlayerDamageDealt(amount, isCritical) {
    const currentState = getState();
    const damage = Math.max(0, Math.round(finiteNumber(amount, 0, 0, 999999999)));
    currentState.statistics.totalDamageDealt += damage;
    currentState.statistics.highestSingleHit = Math.max(currentState.statistics.highestSingleHit, damage);
    if (isCritical) {
      currentState.statistics.totalCriticalHits += 1;
    }
    if (damage > 0) {
      markDirty("damage-dealt");
    }
  }

  function findItemByIdInState(targetState, itemId) {
    if (typeof itemId !== "string") {
      return null;
    }
    const inventoryIndex = targetState.inventory.findIndex(function (item) {
      return item.id === itemId;
    });
    if (inventoryIndex >= 0) {
      return {
        item: targetState.inventory[inventoryIndex],
        location: "inventory",
        slot: targetState.inventory[inventoryIndex].slot,
        index: inventoryIndex
      };
    }
    const slotIds = Object.keys(Data.ITEM_SLOTS);
    for (let index = 0; index < slotIds.length; index += 1) {
      const slotId = slotIds[index];
      const equippedItem = targetState.equipment[slotId];
      if (equippedItem && equippedItem.id === itemId) {
        return {
          item: equippedItem,
          location: "equipment",
          slot: slotId,
          index: -1
        };
      }
    }
    return null;
  }

  function addInventoryItem(item) {
    const currentState = getState();
    if (currentState.inventory.length >= CONFIG.MAX_INVENTORY) {
      return false;
    }
    const normalizedItem = normalizeItem(item, currentState.inventory.length);
    if (!normalizedItem) {
      return false;
    }
    const usedIds = new Set();
    currentState.inventory.forEach(function (inventoryItem) {
      usedIds.add(inventoryItem.id);
    });
    Object.keys(Data.ITEM_SLOTS).forEach(function (slotId) {
      const equippedItem = currentState.equipment[slotId];
      if (equippedItem) {
        usedIds.add(equippedItem.id);
      }
    });
    ensureUniqueItemId(normalizedItem, usedIds);
    normalizedItem.equipped = false;
    currentState.inventory.unshift(normalizedItem);
    currentState.statistics.totalItemsFound += 1;
    currentState.recentLoot = clone(normalizedItem);
    markDirty("add-inventory-item");
    emit("loot", { item: normalizedItem });
    return normalizedItem;
  }

  function setRecentLoot(item) {
    const currentState = getState();
    currentState.recentLoot = item ? normalizeItem(item, 9999) : null;
    markDirty("set-recent-loot");
    emit("loot-preview", { item: currentState.recentLoot });
    return currentState.recentLoot;
  }

  function getAllItems() {
    const currentState = getState();
    const items = currentState.inventory.slice();
    Object.keys(Data.ITEM_SLOTS).forEach(function (slotId) {
      if (currentState.equipment[slotId]) {
        items.push(currentState.equipment[slotId]);
      }
    });
    return items;
  }

  function getInventoryItem(itemId) {
    const located = findItemByIdInState(getState(), itemId);
    return located && located.location === "inventory" ? located.item : null;
  }

  function getEquippedItem(slotId) {
    if (!Object.prototype.hasOwnProperty.call(Data.ITEM_SLOTS, slotId)) {
      return null;
    }
    return getState().equipment[slotId] || null;
  }

  function findItemById(itemId) {
    return findItemByIdInState(getState(), itemId);
  }

  function canEquipItem(item) {
    if (!item) {
      return { allowed: false, reason: "item-not-found" };
    }
    if (!Object.prototype.hasOwnProperty.call(Data.ITEM_SLOTS, item.slot)) {
      return { allowed: false, reason: "invalid-slot" };
    }
    if (item.requiredLevel > getState().player.level) {
      return {
        allowed: false,
        reason: "level-too-low",
        requiredLevel: item.requiredLevel
      };
    }
    return { allowed: true, reason: null };
  }

  function equipItem(itemId) {
    const currentState = getState();
    const located = findItemByIdInState(currentState, itemId);
    if (!located || located.location !== "inventory") {
      return { success: false, reason: "item-not-found" };
    }
    const candidate = located.item;
    const permission = canEquipItem(candidate);
    if (!permission.allowed) {
      return {
        success: false,
        reason: permission.reason,
        requiredLevel: permission.requiredLevel || null,
        item: candidate
      };
    }
    const slotId = candidate.slot;
    const previousItem = currentState.equipment[slotId];
    currentState.inventory.splice(located.index, 1);
    candidate.equipped = true;
    currentState.equipment[slotId] = candidate;
    if (previousItem) {
      previousItem.equipped = false;
      currentState.inventory.unshift(previousItem);
    }
    currentState.forge.salvageSelectedIds = currentState.forge.salvageSelectedIds.filter(function (id) {
      return id !== candidate.id;
    });
    applyDerivedPlayerStats(currentState, { preserveHpRatio: true });
    currentState.statistics.totalItemsEquipped += 1;
    markDirty("equip-item");
    const result = {
      success: true,
      slot: slotId,
      item: candidate,
      previousItem: previousItem || null,
      playerPower: currentState.player.power,
      equipmentPower: computeEquipmentPower(currentState)
    };
    emit("equipment-change", result);
    return result;
  }

  function unequipItem(slotId) {
    const currentState = getState();
    if (!Object.prototype.hasOwnProperty.call(Data.ITEM_SLOTS, slotId)) {
      return { success: false, reason: "invalid-slot" };
    }
    const item = currentState.equipment[slotId];
    if (!item) {
      return { success: false, reason: "slot-empty" };
    }
    if (currentState.inventory.length >= CONFIG.MAX_INVENTORY) {
      return { success: false, reason: "inventory-full" };
    }
    currentState.equipment[slotId] = null;
    item.equipped = false;
    currentState.inventory.unshift(item);
    applyDerivedPlayerStats(currentState, { preserveHpRatio: true });
    markDirty("unequip-item");
    const result = {
      success: true,
      slot: slotId,
      item: item,
      playerPower: currentState.player.power,
      equipmentPower: computeEquipmentPower(currentState)
    };
    emit("equipment-change", result);
    return result;
  }

  function autoEquipBest() {
    const currentState = getState();
    const allItems = getAllItems();
    const selectedIds = new Set();
    const nextEquipment = createEmptyEquipment();
    const changes = [];
    Object.keys(Data.ITEM_SLOTS).forEach(function (slotId) {
      const candidates = allItems.filter(function (item) {
        return item.slot === slotId && item.requiredLevel <= currentState.player.level;
      }).sort(function (left, right) {
        return computeItemScore(right) - computeItemScore(left) ||
          Data.getRarityOrder(right.rarity) - Data.getRarityOrder(left.rarity) ||
          right.itemLevel - left.itemLevel;
      });
      const bestItem = candidates[0] || null;
      const previousItem = currentState.equipment[slotId];
      if (bestItem) {
        bestItem.equipped = true;
        nextEquipment[slotId] = bestItem;
        selectedIds.add(bestItem.id);
      }
      if ((!previousItem && bestItem) || (previousItem && !bestItem) || (previousItem && bestItem && previousItem.id !== bestItem.id)) {
        changes.push({ slot: slotId, previousItem: previousItem || null, item: bestItem || null });
      }
    });
    allItems.forEach(function (item) {
      item.equipped = selectedIds.has(item.id);
    });
    currentState.equipment = nextEquipment;
    currentState.inventory = allItems.filter(function (item) {
      return !selectedIds.has(item.id);
    }).sort(function (left, right) {
      return right.acquiredAt - left.acquiredAt;
    }).slice(0, CONFIG.MAX_INVENTORY);
    currentState.forge.salvageSelectedIds = currentState.forge.salvageSelectedIds.filter(function (id) {
      return Boolean(getInventoryItem(id));
    });
    applyDerivedPlayerStats(currentState, { preserveHpRatio: true });
    if (changes.length > 0) {
      currentState.statistics.totalItemsEquipped += changes.length;
      currentState.statistics.totalAutoEquips += 1;
      markDirty("auto-equip");
    }
    const result = {
      success: true,
      changed: changes.length > 0,
      changes: changes,
      playerPower: currentState.player.power,
      equipmentPower: computeEquipmentPower(currentState)
    };
    emit("auto-equip", result);
    if (changes.length > 0) {
      emit("equipment-change", result);
    }
    return result;
  }

  function setItemLocked(itemId, locked) {
    const located = findItemById(itemId);
    if (!located) {
      return false;
    }
    located.item.locked = Boolean(locked);
    if (located.item.locked) {
      getState().forge.salvageSelectedIds = getState().forge.salvageSelectedIds.filter(function (id) {
        return id !== located.item.id;
      });
    }
    markDirty("set-item-locked");
    emit("item-lock", {
      item: located.item,
      locked: located.item.locked,
      location: located.location
    });
    return located.item.locked;
  }

  function getEquipmentPower() {
    return computeEquipmentPower(getState());
  }

  function setSpeed(speed) {
    const numericSpeed = Number(speed);
    if (!CONFIG.SPEED_OPTIONS.includes(numericSpeed)) {
      return getState().settings.speed;
    }
    getState().settings.speed = numericSpeed;
    markDirty("set-speed");
    emit("speed", { speed: numericSpeed });
    return numericSpeed;
  }

  function setPaused(paused) {
    const nextPaused = Boolean(paused);
    getState().settings.paused = nextPaused;
    markDirty("set-paused");
    emit("pause", { paused: nextPaused });
    return nextPaused;
  }

  function togglePaused() {
    return setPaused(!getState().settings.paused);
  }

  function setActiveView(viewId) {
    const nextView = CONFIG.VIEW_IDS.includes(viewId) ? viewId : CONFIG.DEFAULT_VIEW;
    getState().settings.activeView = nextView;
    markDirty("set-active-view");
    emit("view-change", { view: nextView });
    return nextView;
  }

  function setInventorySort(sortId) {
    const nextSort = CONFIG.INVENTORY_SORT_OPTIONS.includes(sortId) ? sortId : "newest";
    getState().settings.inventorySort = nextSort;
    markDirty("set-inventory-sort");
    emit("inventory-settings", { sort: nextSort });
    return nextSort;
  }

  function setInventoryFilters(slotId, rarityId) {
    const settings = getState().settings;
    settings.inventorySlotFilter = slotId === "all" || Object.prototype.hasOwnProperty.call(Data.ITEM_SLOTS, slotId) ? slotId : "all";
    settings.inventoryRarityFilter = rarityId === "all" || Object.prototype.hasOwnProperty.call(Data.RARITIES, rarityId) ? rarityId : "all";
    markDirty("set-inventory-filters");
    emit("inventory-settings", {
      slot: settings.inventorySlotFilter,
      rarity: settings.inventoryRarityFilter
    });
    return {
      slot: settings.inventorySlotFilter,
      rarity: settings.inventoryRarityFilter
    };
  }

  function setFeedbackSettings(options) {
    const currentState = getState();
    const settings = currentState.settings;
    const source = isPlainObject(options) ? options : {};

    if (Object.prototype.hasOwnProperty.call(source, "soundEnabled")) {
      settings.soundEnabled = Boolean(source.soundEnabled);
    }
    if (Object.prototype.hasOwnProperty.call(source, "soundVolume")) {
      settings.soundVolume = Data.clamp(finiteNumber(source.soundVolume, settings.soundVolume, 0, 1), 0, 1);
    }
    if (Object.prototype.hasOwnProperty.call(source, "vibrationEnabled")) {
      settings.vibrationEnabled = Boolean(source.vibrationEnabled);
    }
    if (Object.prototype.hasOwnProperty.call(source, "screenShakeEnabled")) {
      settings.screenShakeEnabled = Boolean(source.screenShakeEnabled);
    }
    if (Object.prototype.hasOwnProperty.call(source, "reducedEffects")) {
      settings.reducedEffects = Boolean(source.reducedEffects);
    }
    if (Object.prototype.hasOwnProperty.call(source, "showDamageNumbers")) {
      settings.showDamageNumbers = Boolean(source.showDamageNumbers);
    }

    markDirty("set-feedback-settings");
    emit("feedback-settings", {
      soundEnabled: settings.soundEnabled,
      soundVolume: settings.soundVolume,
      vibrationEnabled: settings.vibrationEnabled,
      screenShakeEnabled: settings.screenShakeEnabled,
      reducedEffects: settings.reducedEffects,
      showDamageNumbers: settings.showDamageNumbers
    });

    return {
      soundEnabled: settings.soundEnabled,
      soundVolume: settings.soundVolume,
      vibrationEnabled: settings.vibrationEnabled,
      screenShakeEnabled: settings.screenShakeEnabled,
      reducedEffects: settings.reducedEffects,
      showDamageNumbers: settings.showDamageNumbers
    };
  }

  function setForgeSelectedItem(itemId) {
    const currentState = getState();
    const located = findItemById(itemId);
    currentState.forge.selectedItemId = located ? located.item.id : null;
    markDirty("set-forge-selected-item");
    emit("forge-selected", { itemId: currentState.forge.selectedItemId });
    return currentState.forge.selectedItemId;
  }

  function setForgeSort(sortId) {
    const currentState = getState();
    currentState.forge.sort = CONFIG.FORGE_SORT_OPTIONS.includes(sortId) ? sortId : "score";
    markDirty("set-forge-sort");
    emit("forge-sort", { sort: currentState.forge.sort });
    return currentState.forge.sort;
  }

  function refreshItemSalvageValues(item) {
    const reward = Data.getSalvageReward(item);
    item.salvageValue = reward.gold;
    item.salvageStoneValue = reward.enhancementStone;
    return reward;
  }

  function enhanceItem(itemId) {
    const currentState = getState();
    const located = findItemByIdInState(currentState, itemId);
    if (!located) {
      return { success: false, reason: "item-not-found" };
    }
    const item = located.item;
    const info = Data.getEnhancementInfo(item);
    const beforeLevel = item.enhancement;
    const beforeScore = computeItemScore(item);
    if (info.isMax) {
      return { success: false, reason: "max-level", item: item, info: info };
    }
    if (currentState.currencies.gold < info.goldCost) {
      return { success: false, reason: "not-enough-gold", item: item, info: info };
    }
    if (currentState.currencies.enhancementStone < info.stoneCost) {
      return { success: false, reason: "not-enough-stone", item: item, info: info };
    }
    currentState.currencies.gold -= info.goldCost;
    currentState.currencies.enhancementStone -= info.stoneCost;
    currentState.statistics.totalEnhanceAttempts += 1;
    const roll = Math.random();
    const success = roll < info.successChance;
    if (success) {
      item.enhancement = info.nextLevel;
      item.bonusStats = Data.calculateEnhancementStats(item.baseStats, item.enhancement);
      refreshItemSalvageValues(item);
      currentState.statistics.totalEnhanceSuccesses += 1;
      applyDerivedPlayerStats(currentState, { preserveHpRatio: true });
    }
    markDirty(success ? "enhance-success" : "enhance-fail");
    const result = {
      success: true,
      enhanced: success,
      reason: success ? "success" : "failed",
      item: item,
      roll: roll,
      chance: info.successChance,
      beforeLevel: beforeLevel,
      afterLevel: item.enhancement,
      beforeScore: beforeScore,
      afterScore: computeItemScore(item),
      goldCost: info.goldCost,
      stoneCost: info.stoneCost
    };
    emit("enhance-result", result);
    return result;
  }

  function shouldAutoSalvage(rarityId) {
    const rarity = Object.prototype.hasOwnProperty.call(Data.RARITIES, rarityId) ? rarityId : "common";
    return Boolean(getState().settings.autoSalvage[rarity]);
  }

  function setAutoSalvage(rarityId, enabled) {
    if (!Object.prototype.hasOwnProperty.call(Data.RARITIES, rarityId)) {
      return false;
    }
    getState().settings.autoSalvage[rarityId] = Boolean(enabled);
    markDirty("set-auto-salvage");
    emit("auto-salvage-setting", {
      rarity: rarityId,
      enabled: getState().settings.autoSalvage[rarityId]
    });
    return getState().settings.autoSalvage[rarityId];
  }

  function canSalvageLocated(located) {
    if (!located || located.location !== "inventory") {
      return { allowed: false, reason: "not-in-inventory" };
    }
    if (located.item.equipped) {
      return { allowed: false, reason: "equipped" };
    }
    if (located.item.locked) {
      return { allowed: false, reason: "locked" };
    }
    return { allowed: true, reason: null };
  }

  function getSalvagePreview(itemIds) {
    const currentState = getState();
    const ids = Array.isArray(itemIds) ? itemIds : currentState.forge.salvageSelectedIds;
    const selected = [];
    const blocked = [];
    const seen = new Set();
    let gold = 0;
    let enhancementStone = 0;
    ids.forEach(function (itemId) {
      if (seen.has(itemId)) {
        return;
      }
      seen.add(itemId);
      const located = findItemByIdInState(currentState, itemId);
      const permission = canSalvageLocated(located);
      if (!permission.allowed) {
        blocked.push({ itemId: itemId, reason: permission.reason });
        return;
      }
      const reward = refreshItemSalvageValues(located.item);
      selected.push(located.item);
      gold += reward.gold;
      enhancementStone += reward.enhancementStone;
    });
    return {
      items: selected,
      blocked: blocked,
      count: selected.length,
      gold: gold,
      enhancementStone: enhancementStone
    };
  }

  function toggleSalvageSelection(itemId) {
    const currentState = getState();
    const located = findItemByIdInState(currentState, itemId);
    const permission = canSalvageLocated(located);
    if (!permission.allowed) {
      return {
        selected: false,
        allowed: false,
        reason: permission.reason
      };
    }
    const selected = currentState.forge.salvageSelectedIds;
    const index = selected.indexOf(located.item.id);
    if (index >= 0) {
      selected.splice(index, 1);
    } else {
      selected.push(located.item.id);
    }
    markDirty("toggle-salvage-selection");
    emit("salvage-selection", getSalvagePreview());
    return {
      selected: selected.includes(located.item.id),
      allowed: true,
      reason: null
    };
  }

  function clearSalvageSelection() {
    getState().forge.salvageSelectedIds = [];
    markDirty("clear-salvage-selection");
    emit("salvage-selection", getSalvagePreview());
    return [];
  }

  function selectAllSalvageable() {
    const currentState = getState();
    currentState.forge.salvageSelectedIds = currentState.inventory.filter(function (item) {
      return !item.locked && !item.equipped;
    }).map(function (item) {
      return item.id;
    });
    markDirty("select-all-salvage");
    emit("salvage-selection", getSalvagePreview());
    return currentState.forge.salvageSelectedIds.slice();
  }

  function normalizeSalvageFilter(filter) {
    const source = filter && typeof filter === "object" ? filter : {};
    const rarity = Object.prototype.hasOwnProperty.call(Data.RARITIES, source.rarity) ? source.rarity : "all";
    let minLevel = Math.floor(Number(source.minLevel));
    let maxLevel = Math.floor(Number(source.maxLevel));
    minLevel = Number.isFinite(minLevel) ? Math.min(CONFIG.MAX_LEVEL, Math.max(1, minLevel)) : 1;
    maxLevel = Number.isFinite(maxLevel) ? Math.min(CONFIG.MAX_LEVEL, Math.max(1, maxLevel)) : CONFIG.MAX_LEVEL;
    if (minLevel > maxLevel) {
      const previousMin = minLevel;
      minLevel = maxLevel;
      maxLevel = previousMin;
    }
    return {
      rarity: rarity,
      minLevel: minLevel,
      maxLevel: maxLevel
    };
  }

  function matchesSalvageFilter(item, filter) {
    const normalized = normalizeSalvageFilter(filter);
    const itemLevel = Math.floor(Number(item && item.itemLevel) || 1);
    const rarityOk = normalized.rarity === "all" || item.rarity === normalized.rarity;
    const levelOk = itemLevel >= normalized.minLevel && itemLevel <= normalized.maxLevel;
    return rarityOk && levelOk;
  }

  function selectSalvageableByFilter(filter) {
    const currentState = getState();
    const normalized = normalizeSalvageFilter(filter);
    currentState.forge.salvageSelectedIds = currentState.inventory.filter(function (item) {
      return !item.locked && !item.equipped && matchesSalvageFilter(item, normalized);
    }).map(function (item) {
      return item.id;
    });
    markDirty("select-filtered-salvage");
    emit("salvage-selection", getSalvagePreview());
    return currentState.forge.salvageSelectedIds.slice();
  }

  function salvageExternalItem(item, options) {
    const currentState = getState();
    const normalized = normalizeItem(item, 99999);
    if (!normalized) {
      return {
        success: false,
        reason: "invalid-item",
        gold: 0,
        enhancementStone: 0,
        items: []
      };
    }
    const reward = refreshItemSalvageValues(normalized);
    currentState.currencies.gold = Math.min(Number.MAX_SAFE_INTEGER, currentState.currencies.gold + reward.gold);
    currentState.currencies.enhancementStone = Math.min(Number.MAX_SAFE_INTEGER, currentState.currencies.enhancementStone + reward.enhancementStone);
    currentState.statistics.totalItemsSalvaged += 1;
    currentState.statistics.totalGoldEarned += reward.gold;
    currentState.recentLoot = clone(normalized);
    markDirty("salvage-external-item");
    const result = {
      success: true,
      reason: options && options.reason ? options.reason : "external-salvage",
      gold: reward.gold,
      enhancementStone: reward.enhancementStone,
      items: [normalized]
    };
    emit("salvage", result);
    return result;
  }

  function salvageSelectedItems(itemIds) {
    const currentState = getState();
    const preview = getSalvagePreview(itemIds);
    if (preview.count <= 0) {
      return {
        success: false,
        reason: "no-items",
        gold: 0,
        enhancementStone: 0,
        items: [],
        blocked: preview.blocked
      };
    }
    const selectedIds = new Set(preview.items.map(function (item) {
      return item.id;
    }));
    currentState.inventory = currentState.inventory.filter(function (item) {
      return !selectedIds.has(item.id);
    });
    currentState.forge.salvageSelectedIds = currentState.forge.salvageSelectedIds.filter(function (id) {
      return !selectedIds.has(id);
    });
    if (currentState.forge.selectedItemId && selectedIds.has(currentState.forge.selectedItemId)) {
      currentState.forge.selectedItemId = null;
    }
    currentState.currencies.gold = Math.min(Number.MAX_SAFE_INTEGER, currentState.currencies.gold + preview.gold);
    currentState.currencies.enhancementStone = Math.min(Number.MAX_SAFE_INTEGER, currentState.currencies.enhancementStone + preview.enhancementStone);
    currentState.statistics.totalItemsSalvaged += preview.count;
    currentState.statistics.totalGoldEarned += preview.gold;
    markDirty("salvage-selected-items");
    const result = {
      success: true,
      reason: "salvaged",
      gold: preview.gold,
      enhancementStone: preview.enhancementStone,
      items: preview.items,
      blocked: preview.blocked
    };
    emit("salvage", result);
    return result;
  }

  function setSelectedBoss(bossId) {
    const boss = Data.getBoss(bossId);
    getState().boss.selectedBossId = boss.id;
    markDirty("set-selected-boss");
    emit("boss-selected", { bossId: boss.id });
    return boss.id;
  }

  function getBossProgress(bossId) {
    const boss = Data.getBoss(bossId);
    const progress = getState().boss.progress[boss.id];
    return progress ? clone(progress) : clone(createBossProgress()[boss.id]);
  }

  function isBossUnlocked(bossId) {
    const boss = Data.getBoss(bossId);
    return getState().progression.highestWave >= boss.unlockWave;
  }

  function recordBossAttempt(bossId) {
    const currentState = getState();
    const boss = Data.getBoss(bossId);
    if (!currentState.boss.progress[boss.id]) {
      currentState.boss.progress[boss.id] = createBossProgress()[boss.id];
    }
    currentState.boss.progress[boss.id].attempts += 1;
    currentState.statistics.totalBossAttempts += 1;
    markDirty("boss-attempt");
    emit("boss-attempt", {
      bossId: boss.id,
      progress: getBossProgress(boss.id)
    });
    return getBossProgress(boss.id);
  }

  function recordBossResult(bossId, resultType, clearTime) {
    const currentState = getState();
    const boss = Data.getBoss(bossId);
    const progress = currentState.boss.progress[boss.id] || createBossProgress()[boss.id];
    currentState.boss.progress[boss.id] = progress;
    const wasFirstClear = !progress.firstClear;
    if (resultType === "victory") {
      progress.kills += 1;
      progress.firstClear = true;
      progress.lastClearTime = finiteNumber(clearTime, 0, 0, 999999);
      progress.bestTime = progress.bestTime === null
        ? progress.lastClearTime
        : Math.min(progress.bestTime, progress.lastClearTime);
      currentState.statistics.totalBossKills += 1;
      if (boss.firstClearReward && boss.firstClearReward.unlockRegionId) {
        const regionId = boss.firstClearReward.unlockRegionId;
        if (!currentState.progression.unlockedRegionIds.includes(regionId)) {
          currentState.progression.unlockedRegionIds.push(regionId);
        }
      }
    }
    markDirty("boss-result");
    const result = {
      bossId: boss.id,
      result: resultType,
      firstClear: resultType === "victory" && wasFirstClear,
      progress: getBossProgress(boss.id)
    };
    emit("boss-result", result);
    return result;
  }

  function addPlayTime(deltaSeconds) {
    const seconds = finiteNumber(deltaSeconds, 0, 0, 10);
    if (seconds <= 0 || getState().settings.paused) {
      return getState().statistics.playTimeSeconds;
    }
    getState().statistics.playTimeSeconds += seconds;
    dirty = true;
    return getState().statistics.playTimeSeconds;
  }

  function incrementStatistic(key, amount) {
    const currentState = getState();
    if (!Object.prototype.hasOwnProperty.call(currentState.statistics, key)) {
      return 0;
    }
    const increment = finiteNumber(amount, 1, 0, Number.MAX_SAFE_INTEGER);
    currentState.statistics[key] = Math.min(Number.MAX_SAFE_INTEGER, currentState.statistics[key] + increment);
    markDirty("statistic-" + key);
    return currentState.statistics[key];
  }

  function isDirty() {
    return dirty;
  }

  function getLastError() {
    return lastError;
  }

  global.GameState = {
    SAVE_VERSION: SAVE_VERSION,
    STORAGE_KEY: STORAGE_KEY,
    createDefaultState: createDefaultState,
    load: load,
    save: save,
    reset: reset,
    subscribe: subscribe,
    getState: getState,
    getSnapshot: getSnapshot,
    markDirty: markDirty,
    isDirty: isDirty,
    getLastError: getLastError,
    recalculatePlayerStats: recalculatePlayerStats,
    addExperience: addExperience,
    addGold: addGold,
    spendGold: spendGold,
    addEnhancementStone: addEnhancementStone,
    spendEnhancementStone: spendEnhancementStone,
    advanceMonsterProgress: advanceMonsterProgress,
    recordMonsterKill: recordMonsterKill,
    setPlayerHp: setPlayerHp,
    damagePlayer: damagePlayer,
    healPlayer: healPlayer,
    revivePlayer: revivePlayer,
    recordPlayerDamageDealt: recordPlayerDamageDealt,
    addInventoryItem: addInventoryItem,
    setRecentLoot: setRecentLoot,
    getAllItems: getAllItems,
    getInventoryItem: getInventoryItem,
    getEquippedItem: getEquippedItem,
    findItemById: findItemById,
    canEquipItem: canEquipItem,
    equipItem: equipItem,
    unequipItem: unequipItem,
    autoEquipBest: autoEquipBest,
    setItemLocked: setItemLocked,
    getItemScore: computeItemScore,
    getEquipmentPower: getEquipmentPower,
    setSpeed: setSpeed,
    setPaused: setPaused,
    togglePaused: togglePaused,
    setActiveView: setActiveView,
    setInventorySort: setInventorySort,
    setInventoryFilters: setInventoryFilters,
    setFeedbackSettings: setFeedbackSettings,
    setForgeSelectedItem: setForgeSelectedItem,
    setForgeSort: setForgeSort,
    enhanceItem: enhanceItem,
    shouldAutoSalvage: shouldAutoSalvage,
    setAutoSalvage: setAutoSalvage,
    getSalvagePreview: getSalvagePreview,
    toggleSalvageSelection: toggleSalvageSelection,
    selectAllSalvageable: selectAllSalvageable,
    selectSalvageableByFilter: selectSalvageableByFilter,
    clearSalvageSelection: clearSalvageSelection,
    salvageSelectedItems: salvageSelectedItems,
    salvageExternalItem: salvageExternalItem,
    setSelectedBoss: setSelectedBoss,
    getBossProgress: getBossProgress,
    isBossUnlocked: isBossUnlocked,
    recordBossAttempt: recordBossAttempt,
    recordBossResult: recordBossResult,
    addPlayTime: addPlayTime,
    incrementStatistic: incrementStatistic
  };
})(window);
