(function (global) {
  "use strict";

  ["GameData", "GameState"].forEach(function (name) {
    if (!global[name]) {
      throw new Error(name + " must be loaded before loot.js");
    }
  });

  const Data = global.GameData;
  const State = global.GameState;
  const listeners = new Set();

  const SORT_LABELS = {
    newest: "Newest",
    score: "Score",
    rarity: "Rarity",
    level: "Level"
  };

  const FORGE_SORT_LABELS = {
    score: "Score",
    enhancement: "Enhancement",
    rarity: "Rarity",
    level: "Level"
  };

  const BOSS_PREFIXES = {
    ancientTreant: "Guardian",
    thornAlpha: "Alpha",
    goblinWarlord: "Warlord"
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : Number(fallback) || 0;
  }

  function emit(type, payload) {
    listeners.forEach(function (listener) {
      try {
        listener({
          type: type,
          payload: payload || null
        });
      } catch (error) {
        console.error("Loot listener failed", error);
      }
    });
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

  function calculateDropChance(context) {
    const source = context || {};
    if (source.forceDrop) {
      return 1;
    }
    const wave = Math.max(1, Math.floor(Number(source.wave) || State.getState().progression.currentWave || 1));
    const waveBonus = Math.min(0.08, Math.floor(wave / 10) * 0.01);
    const speedPenalty = 0;
    return Data.clamp(Data.LOOT.baseDropChance + waveBonus - speedPenalty, 0.02, 0.3);
  }

  function rollRarity(options) {
    const settings = options || {};
    if (settings.rarity && Data.RARITIES[settings.rarity]) {
      return settings.rarity;
    }
    const minimumOrder = settings.minimumRarity ? Data.getRarityOrder(settings.minimumRarity) : 1;
    const candidates = Data.LOOT.rarityOrder.filter(function (rarityId) {
      return Data.getRarityOrder(rarityId) >= minimumOrder;
    });
    const totalWeight = candidates.reduce(function (sum, rarityId) {
      return sum + Data.RARITIES[rarityId].weight;
    }, 0);
    let roll = Math.random() * totalWeight;
    for (let index = 0; index < candidates.length; index += 1) {
      const rarityId = candidates[index];
      roll -= Data.RARITIES[rarityId].weight;
      if (roll <= 0) {
        return rarityId;
      }
    }
    return candidates[candidates.length - 1] || "common";
  }

  function chooseSlot(source) {
    if (source && source.slot && Data.ITEM_SLOTS[source.slot]) {
      return source.slot;
    }
    return Data.LOOT.slots[Data.randomInteger(0, Data.LOOT.slots.length - 1)];
  }

  function getItemLevel(source) {
    const state = State.getState();
    const wave = Math.max(1, Math.floor(Number(source && source.wave) || state.progression.currentWave || 1));
    const playerLevel = Math.max(1, Math.floor(Number(source && source.playerLevel) || state.player.level || 1));
    const bossBoost = source && source.isBoss ? 3 : 0;
    return Math.max(1, Math.round(playerLevel + Math.floor(wave / 4) + bossBoost + Data.randomInteger(-1, 2)));
  }

  function rollBaseStats(slotId, rarityId, itemLevel, bossId) {
    const rarity = Data.getRarity(rarityId);
    const bossMultiplier = bossId ? 1.12 : 1;
    const levelScale = 1 + itemLevel * 0.09;
    const multiplier = rarity.statMultiplier * levelScale * bossMultiplier;
    const stats = {};
    function add(key, min, max, ratio) {
      const value = Data.randomRange(min, max) * multiplier;
      stats[key] = ratio
        ? Math.round(value * 10000) / 10000
        : Math.max(1, Math.round(value * 10) / 10);
    }
    if (slotId === "weapon") {
      add("attack", 4.5, 7.5, false);
    } else if (slotId === "helmet") {
      add("maxHp", 16, 30, false);
      add("defense", 1.2, 2.6, false);
    } else if (slotId === "armor") {
      add("maxHp", 24, 42, false);
      add("defense", 2.4, 4.3, false);
    } else if (slotId === "gloves") {
      add("attack", 1.5, 3.3, false);
      add("critChance", 0.006, 0.018, true);
    } else if (slotId === "boots") {
      add("maxHp", 10, 22, false);
      add("attackSpeed", 0.01, 0.035, true);
    } else if (slotId === "necklace") {
      add("critDamage", 0.035, 0.09, true);
      add("bossDamage", 0.01, 0.04, true);
    }
    return stats;
  }

  function rollRandomOptions(rarityId, itemLevel, bossId) {
    const rarity = Data.getRarity(rarityId);
    const optionRange = rarity.optionCount || [0, 0];
    const count = Data.randomInteger(optionRange[0], optionRange[1]);
    const affixes = Data.ITEM_AFFIXES.slice();
    const options = [];
    const bossMultiplier = bossId ? 1.15 : 1;
    for (let index = 0; index < count && affixes.length > 0; index += 1) {
      const affixIndex = Data.randomInteger(0, affixes.length - 1);
      const affix = affixes.splice(affixIndex, 1)[0];
      const scale = (1 + itemLevel * 0.035) * rarity.statMultiplier * bossMultiplier;
      const raw = Data.randomRange(affix.min, affix.max) * scale;
      options.push({
        stat: affix.stat,
        name: affix.name,
        value: affix.type === "ratio" ? Math.round(raw * 10000) / 10000 : Math.max(1, Math.round(raw * 10) / 10),
        type: affix.type
      });
    }
    return options;
  }

  function buildItemName(slotId, rarityId, bossId) {
    const slot = Data.getItemSlot(slotId);
    const rarity = Data.getRarity(rarityId);
    const baseNames = Data.ITEM_BASE_NAMES[slotId] || [slot.name];
    const baseName = baseNames[Data.randomInteger(0, baseNames.length - 1)];
    const prefix = bossId && BOSS_PREFIXES[bossId] ? BOSS_PREFIXES[bossId] + " " : "";
    return prefix + rarity.name + " " + baseName;
  }

  function createItemId(slotId) {
    return [
      "item",
      slotId,
      Date.now().toString(36),
      Math.random().toString(36).slice(2, 9)
    ].join("-");
  }

  function generateItem(context) {
    const source = context || {};
    const slotId = chooseSlot(source);
    const rarityId = rollRarity(source);
    const itemLevel = getItemLevel(source);
    const baseStats = rollBaseStats(slotId, rarityId, itemLevel, source.bossId);
    const item = {
      id: createItemId(slotId),
      name: buildItemName(slotId, rarityId, source.bossId),
      slot: slotId,
      rarity: rarityId,
      requiredLevel: Math.max(1, itemLevel - 2),
      itemLevel: itemLevel,
      enhancement: 0,
      locked: false,
      equipped: false,
      baseStats: baseStats,
      bonusStats: {},
      randomOptions: rollRandomOptions(rarityId, itemLevel, source.bossId),
      salvageValue: 0,
      salvageStoneValue: 0,
      sellValue: 0,
      sourceBossId: source.bossId || null,
      acquiredAt: Date.now()
    };
    const reward = Data.getSalvageReward(item);
    item.salvageValue = reward.gold;
    item.salvageStoneValue = reward.enhancementStone;
    item.sellValue = Math.max(1, Math.round(reward.gold * 0.75));
    return item;
  }

  function storeOrAutoSalvage(item, options) {
    const settings = options || {};
    const bypassAuto = Boolean(settings.bypassAutoSalvage);
    if (!bypassAuto && State.shouldAutoSalvage(item.rarity)) {
      const salvage = State.salvageExternalItem(item, {
        reason: settings.reason || "auto-salvage"
      });
      return {
        stored: false,
        autoSalvaged: true,
        salvage: salvage,
        item: clone(item),
        reason: "auto-salvaged"
      };
    }
    const storedItem = State.addInventoryItem(item);
    return {
      stored: Boolean(storedItem),
      autoSalvaged: false,
      salvage: null,
      item: clone(storedItem || item),
      reason: storedItem ? "stored" : "inventory-full"
    };
  }

  function rollDrop(context) {
    const source = context || {};
    const chance = calculateDropChance(source);
    const roll = Math.random();
    if (!source.forceDrop && roll >= chance) {
      const miss = {
        dropped: false,
        stored: false,
        autoSalvaged: false,
        chance: chance,
        roll: roll,
        item: null,
        reason: "no-drop"
      };
      emit("drop-miss", miss);
      return miss;
    }
    const item = generateItem(source);
    const processResult = storeOrAutoSalvage(item, {
      bypassAutoSalvage: source.bypassAutoSalvage,
      reason: source.isBoss ? "boss-drop" : "normal-drop"
    });
    const result = Object.assign({
      dropped: true,
      chance: chance,
      roll: roll
    }, processResult);
    emit(result.autoSalvaged ? "drop-auto-salvaged" : result.stored ? "drop-success" : "inventory-full", result);
    return result;
  }

  function grantBossReward(bossId, options) {
    const boss = Data.getBoss(bossId);
    const settings = options || {};
    const firstClear = Boolean(settings.firstClear);
    const item = generateItem({
      isBoss: true,
      bossId: boss.id,
      wave: boss.unlockWave,
      playerLevel: State.getState().player.level,
      rarity: firstClear ? boss.firstClearReward.rarity : null,
      minimumRarity: firstClear ? boss.firstClearReward.rarity : boss.repeatDrop.minimumRarity
    });
    const processed = storeOrAutoSalvage(item, {
      bypassAutoSalvage: firstClear,
      reason: firstClear ? "boss-first-clear" : "boss-repeat-drop"
    });
    const result = Object.assign({
      bossId: boss.id,
      firstClear: firstClear,
      dropped: true
    }, processed);
    emit("boss-reward-item", result);
    return result;
  }

  function getItemTotalStats(item) {
    const totals = {};
    Data.STAT_KEYS.forEach(function (key) {
      totals[key] = 0;
    });
    if (!item || typeof item !== "object") {
      return totals;
    }
    [item.baseStats, item.bonusStats].forEach(function (map) {
      const source = map && typeof map === "object" ? map : {};
      Data.STAT_KEYS.forEach(function (key) {
        totals[key] += finiteNumber(source[key], 0);
      });
    });
    if (Array.isArray(item.randomOptions)) {
      item.randomOptions.forEach(function (option) {
        if (option && Data.STAT_KEYS.includes(option.stat)) {
          totals[option.stat] += finiteNumber(option.value, 0);
        }
      });
    }
    return totals;
  }

  function getItemScore(item) {
    return State.getItemScore(item);
  }

  function compareItems(left, right) {
    if (!left && !right) {
      return 0;
    }
    if (!left) {
      return -getItemScore(right);
    }
    if (!right) {
      return getItemScore(left);
    }
    return getItemScore(left) - getItemScore(right);
  }

  function compareWithEquipped(item) {
    if (!item) {
      return {
        equippedItem: null,
        scoreDifference: 0,
        currentScore: 0,
        itemScore: 0
      };
    }
    const equippedItem = State.getEquippedItem(item.slot);
    const itemScore = getItemScore(item);
    const currentScore = equippedItem ? getItemScore(equippedItem) : 0;
    return {
      equippedItem: equippedItem,
      scoreDifference: itemScore - currentScore,
      currentScore: currentScore,
      itemScore: itemScore
    };
  }

  function statRowsFromMap(statMap, source) {
    const rows = [];
    const map = statMap && typeof statMap === "object" ? statMap : {};
    Object.keys(map).forEach(function (key) {
      const value = Number(map[key]);
      if (!Number.isFinite(value) || value === 0) {
        return;
      }
      const meta = Data.getStatMeta(key);
      rows.push({
        stat: key,
        name: meta.name,
        value: value,
        type: meta.type,
        source: source
      });
    });
    return rows;
  }

  function getBaseStatRows(item) {
    return statRowsFromMap(item && item.baseStats, "base");
  }

  function getBonusStatRows(item) {
    const rows = [];
    statRowsFromMap(item && item.bonusStats, "enhancement").forEach(function (row) {
      rows.push(row);
    });
    if (item && Array.isArray(item.randomOptions)) {
      item.randomOptions.forEach(function (option) {
        rows.push({
          stat: option.stat,
          name: option.name || Data.getStatMeta(option.stat).name,
          value: Number(option.value) || 0,
          type: option.type || Data.getStatMeta(option.stat).type,
          source: "option"
        });
      });
    }
    return rows;
  }

  function formatStatValue(rowOrValue, type) {
    const value = typeof rowOrValue === "object" ? rowOrValue.value : rowOrValue;
    const statType = typeof rowOrValue === "object" ? rowOrValue.type : type;
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return "+0";
    }
    if (statType === "ratio") {
      return (number >= 0 ? "+" : "") + (number * 100).toFixed(number === 0 ? 0 : 1) + "%";
    }
    return (number >= 0 ? "+" : "") + (Math.round(number * 10) / 10);
  }

  function sortItems(items, sortId) {
    const nextSort = Data.CONFIG.INVENTORY_SORT_OPTIONS.includes(sortId) ? sortId : "newest";
    return items.slice().sort(function (left, right) {
      if (nextSort === "score") {
        return getItemScore(right) - getItemScore(left) || right.acquiredAt - left.acquiredAt;
      }
      if (nextSort === "rarity") {
        return Data.getRarityOrder(right.rarity) - Data.getRarityOrder(left.rarity) || getItemScore(right) - getItemScore(left);
      }
      if (nextSort === "level") {
        return right.itemLevel - left.itemLevel || getItemScore(right) - getItemScore(left);
      }
      return right.acquiredAt - left.acquiredAt;
    });
  }

  function sortForgeItems(items, sortId) {
    const nextSort = Data.CONFIG.FORGE_SORT_OPTIONS.includes(sortId) ? sortId : "score";
    return items.slice().sort(function (left, right) {
      if (nextSort === "enhancement") {
        return right.enhancement - left.enhancement || getItemScore(right) - getItemScore(left);
      }
      if (nextSort === "rarity") {
        return Data.getRarityOrder(right.rarity) - Data.getRarityOrder(left.rarity) || getItemScore(right) - getItemScore(left);
      }
      if (nextSort === "level") {
        return right.itemLevel - left.itemLevel || getItemScore(right) - getItemScore(left);
      }
      return getItemScore(right) - getItemScore(left) || right.acquiredAt - left.acquiredAt;
    });
  }

  function filterItems(items, slotFilter, rarityFilter) {
    return items.filter(function (item) {
      const slotOk = !slotFilter || slotFilter === "all" || item.slot === slotFilter;
      const rarityOk = !rarityFilter || rarityFilter === "all" || item.rarity === rarityFilter;
      return slotOk && rarityOk;
    });
  }

  function getVisibleInventory() {
    const state = State.getState();
    return sortItems(
      filterItems(state.inventory, state.settings.inventorySlotFilter, state.settings.inventoryRarityFilter),
      state.settings.inventorySort
    );
  }

  function getForgeItems() {
    const state = State.getState();
    return sortForgeItems(State.getAllItems(), state.forge.sort);
  }

  function getSalvageableItems() {
    return State.getState().inventory.filter(function (item) {
      return !item.locked && !item.equipped;
    });
  }

  function getNextSort(current) {
    const options = Data.CONFIG.INVENTORY_SORT_OPTIONS;
    const index = options.indexOf(current);
    return options[(index + 1 + options.length) % options.length];
  }

  function getNextForgeSort(current) {
    const options = Data.CONFIG.FORGE_SORT_OPTIONS;
    const index = options.indexOf(current);
    return options[(index + 1 + options.length) % options.length];
  }

  function getSortLabel(sortId) {
    return SORT_LABELS[sortId] || SORT_LABELS.newest;
  }

  function getForgeSortLabel(sortId) {
    return FORGE_SORT_LABELS[sortId] || FORGE_SORT_LABELS.score;
  }

  global.GameLoot = {
    subscribe: subscribe,
    calculateDropChance: calculateDropChance,
    rollRarity: rollRarity,
    generateItem: generateItem,
    rollDrop: rollDrop,
    grantBossReward: grantBossReward,
    getItemTotalStats: getItemTotalStats,
    getItemScore: getItemScore,
    compareItems: compareItems,
    compareWithEquipped: compareWithEquipped,
    getBaseStatRows: getBaseStatRows,
    getBonusStatRows: getBonusStatRows,
    formatStatValue: formatStatValue,
    sortItems: sortItems,
    sortForgeItems: sortForgeItems,
    filterItems: filterItems,
    getVisibleInventory: getVisibleInventory,
    getForgeItems: getForgeItems,
    getSalvageableItems: getSalvageableItems,
    getNextSort: getNextSort,
    getNextForgeSort: getNextForgeSort,
    getSortLabel: getSortLabel,
    getForgeSortLabel: getForgeSortLabel
  };
})(window);
