(function (global) {
  "use strict";

  if (!global.GameData) {
    throw new Error(
      "loot.js보다 data.js를 먼저 로드해야 합니다."
    );
  }

  if (!global.GameState) {
    throw new Error(
      "loot.js보다 state.js를 먼저 로드해야 합니다."
    );
  }

  const Data = global.GameData;
  const State = global.GameState;
  const CONFIG = Data.CONFIG;
  const listeners = new Set();

  const RARITY_PREFIXES = {
    common: [
      "낡은",
      "평범한",
      "거친"
    ],

    rare: [
      "정교한",
      "푸른",
      "마력이 깃든"
    ],

    epic: [
      "심연의",
      "영웅의",
      "저주받은"
    ],

    legendary: [
      "전설의",
      "불멸의",
      "파멸을 부르는"
    ]
  };

  const BOSS_PREFIXES = {
    ancientTreant: [
      "수호목의",
      "고목의",
      "뿌리 깊은"
    ],

    thornAlpha: [
      "우두머리의",
      "가시 돋친",
      "포식자의"
    ],

    goblinWarlord: [
      "전쟁군주의",
      "정복자의",
      "파괴적인"
    ]
  };

  const SLOT_BASE_STAT_RULES = {
    weapon: [
      {
        stat: "attack",
        min: 3,
        max: 7,
        type: "flat"
      }
    ],

    helmet: [
      {
        stat: "maxHp",
        min: 10,
        max: 22,
        type: "flat"
      },
      {
        stat: "defense",
        min: 1,
        max: 3,
        type: "flat"
      }
    ],

    armor: [
      {
        stat: "maxHp",
        min: 18,
        max: 36,
        type: "flat"
      },
      {
        stat: "defense",
        min: 2,
        max: 5,
        type: "flat"
      }
    ],

    gloves: [
      {
        stat: "attack",
        min: 1,
        max: 4,
        type: "flat"
      },
      {
        stat: "critChance",
        min: 0.005,
        max: 0.018,
        type: "ratio"
      }
    ],

    boots: [
      {
        stat: "defense",
        min: 1,
        max: 3,
        type: "flat"
      },
      {
        stat: "attackSpeed",
        min: 0.005,
        max: 0.018,
        type: "ratio"
      }
    ],

    necklace: [
      {
        stat: "maxHp",
        min: 8,
        max: 20,
        type: "flat"
      },
      {
        stat: "critDamage",
        min: 0.015,
        max: 0.045,
        type: "ratio"
      }
    ]
  };

  const SORT_LABELS = {
    newest: "최신순",
    score: "점수순",
    rarity: "등급순",
    level: "레벨순"
  };

  const FORGE_SORT_LABELS = {
    score: "점수순",
    enhancement: "강화순",
    rarity: "등급순",
    level: "레벨순"
  };

  function clone(value) {
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(
      JSON.stringify(value)
    );
  }

  function finiteNumber(
    value,
    fallback,
    min,
    max
  ) {
    const numeric = Number(value);

    let result =
      Number.isFinite(numeric)
        ? numeric
        : Number(fallback) || 0;

    if (Number.isFinite(min)) {
      result = Math.max(min, result);
    }

    if (Number.isFinite(max)) {
      result = Math.min(max, result);
    }

    return result;
  }

  function emit(type, payload) {
    listeners.forEach(
      function (listener) {
        try {
          listener({
            type: type,
            payload: payload || null
          });
        } catch (error) {
          console.error(
            "GameLoot 이벤트 처리 중 오류가 발생했습니다.",
            error
          );
        }
      }
    );
  }

  function subscribe(listener) {
    if (
      typeof listener !==
      "function"
    ) {
      return function () {};
    }

    listeners.add(listener);

    return function () {
      listeners.delete(listener);
    };
  }

  function pickRandom(array) {
    if (
      !Array.isArray(array) ||
      !array.length
    ) {
      return null;
    }

    return array[
      Data.randomInteger(
        0,
        array.length - 1
      )
    ];
  }

  function roundStatValue(
    value,
    type
  ) {
    return type === "ratio"
      ? Math.round(
          value * 10000
        ) / 10000
      : Math.max(
          1,
          Math.round(
            value * 10
          ) / 10
        );
  }

  function createItemId() {
    return [
      "item",
      Date.now().toString(36),
      Math.random()
        .toString(36)
        .slice(2, 9)
    ].join("-");
  }

  function calculateDropChance(
    context
  ) {
    const source =
      context || {};

    if (
      source.forceDrop ||
      source.isBoss
    ) {
      return 1;
    }

    const wave = Math.max(
      1,
      Math.floor(
        finiteNumber(
          source.wave,
          1,
          1,
          999999
        )
      )
    );

    return Data.clamp(
      Data.LOOT.baseDropChance +
      Math.min(
        0.05,
        (wave - 1) * 0.001
      ),
      0,
      0.25
    );
  }

  function buildRarityWeights(
    context
  ) {
    const source =
      context || {};

    const wave = Math.max(
      1,
      Math.floor(
        finiteNumber(
          source.wave,
          1,
          1,
          999999
        )
      )
    );

    const bonus = Math.min(
      10,
      Math.floor(
        (wave - 1) / 5
      )
    );

    const weights = {
      common:
        Data.RARITIES
          .common.weight,

      rare:
        Data.RARITIES
          .rare.weight,

      epic:
        Data.RARITIES
          .epic.weight,

      legendary:
        Data.RARITIES
          .legendary.weight
    };

    weights.common =
      Math.max(
        32,
        weights.common -
        bonus
      );

    weights.rare +=
      bonus * 0.7;

    weights.epic +=
      bonus * 0.24;

    weights.legendary +=
      bonus * 0.06;

    if (source.isBoss) {
      weights.common *= 0.12;
      weights.rare *= 1.9;
      weights.epic *= 3.4;
      weights.legendary *= 5;
    }

    return weights;
  }

  function enforceMinimumRarity(
    rarityId,
    minimumRarity
  ) {
    if (!minimumRarity) {
      return rarityId;
    }

    return Data.getRarityOrder(
      rarityId
    ) <
    Data.getRarityOrder(
      minimumRarity
    )
      ? minimumRarity
      : rarityId;
  }

  function rollRarity(context) {
    const weights =
      buildRarityWeights(
        context
      );

    const entries =
      Data.LOOT
        .rarityOrder
        .map(
          function (rarityId) {
            return {
              id: rarityId,

              weight: Math.max(
                0,
                finiteNumber(
                  weights[rarityId],
                  0
                )
              )
            };
          }
        );

    const total =
      entries.reduce(
        function (sum, entry) {
          return (
            sum +
            entry.weight
          );
        },
        0
      );

    if (total <= 0) {
      return "common";
    }

    let roll =
      Math.random() *
      total;

    for (
      let index = 0;
      index < entries.length;
      index += 1
    ) {
      roll -=
        entries[index].weight;

      if (roll <= 0) {
        return enforceMinimumRarity(
          entries[index].id,
          context &&
          context.minimumRarity
        );
      }
    }

    return enforceMinimumRarity(
      "common",
      context &&
      context.minimumRarity
    );
  }

  function resolveItemLevel(
    context
  ) {
    const source =
      context || {};

    const playerLevel = Math.max(
      1,
      Math.floor(
        finiteNumber(
          source.playerLevel,

          State.getState()
            .player.level,

          1,
          CONFIG.MAX_LEVEL
        )
      )
    );

    const wave = Math.max(
      1,
      Math.floor(
        finiteNumber(
          source.wave,
          1,
          1,
          999999
        )
      )
    );

    const center = Math.max(
      playerLevel,
      Math.ceil(wave / 2)
    );

    return Data.clamp(
      center +
      Data.randomInteger(
        -1,
        source.isBoss
          ? 2
          : 1
      ),
      1,
      CONFIG.MAX_LEVEL
    );
  }

  function rollBaseStats(
    slotId,
    rarityId,
    itemLevel,
    bossId
  ) {
    const rules =
      SLOT_BASE_STAT_RULES[
        slotId
      ] ||
      SLOT_BASE_STAT_RULES.weapon;

    const rarity =
      Data.getRarity(
        rarityId
      );

    const levelMultiplier =
      1 +
      (
        itemLevel - 1
      ) * 0.11;

    const bossMultiplier =
      bossId
        ? 1.08
        : 1;

    const stats = {};

    rules.forEach(
      function (rule) {
        stats[rule.stat] =
          roundStatValue(
            Data.randomRange(
              rule.min,
              rule.max
            ) *
            levelMultiplier *
            rarity.statMultiplier *
            bossMultiplier,

            rule.type
          );
      }
    );

    return stats;
  }

  function getOptionCount(
    rarityId
  ) {
    const range =
      Data.getRarity(
        rarityId
      ).optionCount || [0, 0];

    return Data.randomInteger(
      Number(range[0]) || 0,
      Number(range[1]) || 0
    );
  }

  function rollRandomOptions(
    rarityId,
    itemLevel,
    bossId
  ) {
    const optionCount =
      getOptionCount(
        rarityId
      );

    const candidates =
      Data.ITEM_AFFIXES.slice();

    const rarity =
      Data.getRarity(
        rarityId
      );

    const options = [];

    const levelMultiplier =
      1 +
      (
        itemLevel - 1
      ) * 0.025;

    const bossMultiplier =
      bossId
        ? 1.1
        : 1;

    while (
      candidates.length &&
      options.length <
      optionCount
    ) {
      const index =
        Data.randomInteger(
          0,
          candidates.length - 1
        );

      const affix =
        candidates.splice(
          index,
          1
        )[0];

      const value =
        roundStatValue(
          Data.randomRange(
            affix.min,
            affix.max
          ) *
          levelMultiplier *
          (
            0.88 +
            rarity.statMultiplier *
            0.18
          ) *
          bossMultiplier,

          affix.type
        );

      options.push({
        stat: affix.stat,
        name: affix.name,
        value: value,
        type: affix.type
      });
    }

    return options;
  }

  function buildItemName(
    slotId,
    rarityId,
    bossId
  ) {
    const prefixes =
      bossId &&
      BOSS_PREFIXES[bossId]
        ? BOSS_PREFIXES[bossId]
        : RARITY_PREFIXES[
            rarityId
          ] ||
          RARITY_PREFIXES.common;

    return [
      pickRandom(prefixes),

      pickRandom(
        Data.ITEM_BASE_NAMES[
          slotId
        ] ||
        Data.ITEM_BASE_NAMES.weapon
      )
    ]
      .filter(Boolean)
      .join(" ");
  }

  function calculateItemValues(
    rarityId,
    itemLevel,
    bossId
  ) {
    const rarity =
      Data.getRarity(
        rarityId
      );

    const bossMultiplier =
      bossId
        ? 1.35
        : 1;

    return {
      sellValue: Math.max(
        1,
        Math.round(
          (
            8 +
            itemLevel * 5
          ) *
          rarity.salvageMultiplier *
          bossMultiplier
        )
      ),

      salvageValue: Math.max(
        1,
        Math.round(
          (
            1 +
            itemLevel * 0.45
          ) *
          rarity.salvageMultiplier *
          bossMultiplier
        )
      )
    };
  }

  function generateItem(context) {
    const source =
      context || {};

    const slotId =
      Object.prototype
        .hasOwnProperty
        .call(
          Data.ITEM_SLOTS,
          source.slot
        )
        ? source.slot
        : pickRandom(
            Data.LOOT.slots
          );

    const rolledRarity =
      Object.prototype
        .hasOwnProperty
        .call(
          Data.RARITIES,
          source.rarity
        )
        ? source.rarity
        : rollRarity(source);

    const rarityId =
      enforceMinimumRarity(
        rolledRarity,
        source.minimumRarity
      );

    const itemLevel =
      resolveItemLevel(
        source
      );

    const values =
      calculateItemValues(
        rarityId,
        itemLevel,
        source.bossId
      );

    return {
      id: createItemId(),

      name: buildItemName(
        slotId,
        rarityId,
        source.bossId
      ),

      slot: slotId,
      rarity: rarityId,

      requiredLevel:
        Math.max(
          1,

          itemLevel -
          Data.randomInteger(
            0,
            1
          )
        ),

      itemLevel: itemLevel,
      enhancement: 0,
      locked: false,
      equipped: false,

      sourceBossId:
        source.bossId || null,

      baseStats:
        rollBaseStats(
          slotId,
          rarityId,
          itemLevel,
          source.bossId
        ),

      bonusStats: {},

      randomOptions:
        rollRandomOptions(
          rarityId,
          itemLevel,
          source.bossId
        ),

      salvageValue:
        values.salvageValue,

      sellValue:
        values.sellValue,

      acquiredAt:
        Date.now()
    };
  }

  function storeOrAutoSalvage(
    item,
    options
  ) {
    const settings =
      options || {};

    const bypassAuto =
      Boolean(
        settings.bypassAutoSalvage
      );

    if (
      !bypassAuto &&
      State.shouldAutoSalvage(
        item.rarity
      )
    ) {
      const salvage =
        State.salvageExternalItem(
          item,
          {
            reason:
              settings.reason ||
              "auto-salvage"
          }
        );

      return {
        stored: false,
        autoSalvaged: true,
        salvage: salvage,
        item: clone(item),
        reason: "auto-salvaged"
      };
    }

    const storedItem =
      State.addInventoryItem(
        item
      );

    return {
      stored:
        Boolean(storedItem),

      autoSalvaged: false,
      salvage: null,

      item:
        clone(
          storedItem ||
          item
        ),

      reason:
        storedItem
          ? "stored"
          : "inventory-full"
    };
  }

  function rollDrop(context) {
    const source =
      context || {};

    const chance =
      calculateDropChance(
        source
      );

    const roll =
      Math.random();

    if (
      !source.forceDrop &&
      roll >= chance
    ) {
      const miss = {
        dropped: false,
        stored: false,
        autoSalvaged: false,
        chance: chance,
        roll: roll,
        item: null,
        reason: "no-drop"
      };

      emit(
        "drop-miss",
        miss
      );

      return miss;
    }

    const item =
      generateItem(source);

    const processResult =
      storeOrAutoSalvage(
        item,
        {
          bypassAutoSalvage:
            source.bypassAutoSalvage,

          reason:
            source.isBoss
              ? "boss-drop"
              : "normal-drop"
        }
      );

    const result =
      Object.assign(
        {
          dropped: true,
          chance: chance,
          roll: roll
        },
        processResult
      );

    emit(
      result.autoSalvaged
        ? "drop-auto-salvaged"
        : result.stored
          ? "drop-success"
          : "inventory-full",

      result
    );

    return result;
  }

  function grantBossReward(
    bossId,
    options
  ) {
    const boss =
      Data.getBoss(bossId);

    const settings =
      options || {};

    const firstClear =
      Boolean(
        settings.firstClear
      );

    const rarity =
      firstClear
        ? boss
            .firstClearReward
            .rarity
        : null;

    const minimumRarity =
      firstClear
        ? boss
            .firstClearReward
            .rarity
        : boss
            .repeatDrop
            .minimumRarity;

    const item =
      generateItem({
        isBoss: true,
        bossId: boss.id,
        wave: boss.unlockWave,

        playerLevel:
          State.getState()
            .player.level,

        rarity: rarity,

        minimumRarity:
          minimumRarity
      });

    const processed =
      storeOrAutoSalvage(
        item,
        {
          bypassAutoSalvage:
            firstClear,

          reason:
            firstClear
              ? "boss-first-clear"
              : "boss-repeat-drop"
        }
      );

    const result =
      Object.assign(
        {
          bossId: boss.id,
          firstClear: firstClear,
          dropped: true
        },
        processed
      );

    emit(
      "boss-reward-item",
      result
    );

    return result;
  }

  function getItemTotalStats(item) {
    const totals = {};

    Data.STAT_KEYS.forEach(
      function (key) {
        totals[key] = 0;
      }
    );

    if (
      !item ||
      typeof item !== "object"
    ) {
      return totals;
    }

    [
      item.baseStats,
      item.bonusStats
    ].forEach(function (map) {
      const source =
        map &&
        typeof map === "object"
          ? map
          : {};

      Data.STAT_KEYS.forEach(
        function (key) {
          totals[key] +=
            finiteNumber(
              source[key],
              0,
              -999999999,
              999999999
            );
        }
      );
    });

    (
      item.randomOptions || []
    ).forEach(
      function (option) {
        if (
          option &&
          Data.STAT_KEYS.includes(
            option.stat
          )
        ) {
          totals[option.stat] +=
            finiteNumber(
              option.value,
              0,
              -999999999,
              999999999
            );
        }
      }
    );

    return totals;
  }

  function getItemScore(item) {
    if (
      !item ||
      typeof item !== "object"
    ) {
      return 0;
    }

    if (
      typeof State.getItemScore ===
      "function"
    ) {
      return State.getItemScore(
        item
      );
    }

    const totals =
      getItemTotalStats(item);

    let score = 0;

    Data.STAT_KEYS.forEach(
      function (key) {
        score +=
          totals[key] *
          Data
            .getStatMeta(key)
            .powerWeight;
      }
    );

    score +=
      finiteNumber(
        item.enhancement,
        0,
        0,
        CONFIG.MAX_ENHANCEMENT
      ) * 12;

    return Math.max(
      0,
      Math.round(score)
    );
  }

  function compareItems(
    candidate,
    equipped
  ) {
    const candidateScore =
      getItemScore(candidate);

    const equippedScore =
      getItemScore(equipped);

    const difference =
      candidateScore -
      equippedScore;

    return {
      candidateScore:
        candidateScore,

      equippedScore:
        equippedScore,

      difference:
        difference,

      isUpgrade:
        difference > 0,

      isEqual:
        difference === 0
    };
  }

  function compareWithEquipped(item) {
    const equipped =
      item
        ? State.getEquippedItem(
            item.slot
          )
        : null;

    const comparison =
      compareItems(
        item,
        equipped
      );

    comparison.equippedItem =
      equipped;

    comparison.slot =
      item
        ? item.slot
        : null;

    return comparison;
  }

  function formatStatValue(
    value,
    type
  ) {
    const numeric =
      finiteNumber(
        value,
        0,
        -999999999,
        999999999
      );

    if (type === "ratio") {
      return (
        Math.round(
          numeric * 1000
        ) / 10
      ).toFixed(1) + "%";
    }

    return String(
      Math.round(
        numeric * 10
      ) / 10
    );
  }

  function getBaseStatRows(item) {
    if (
      !item ||
      !item.baseStats
    ) {
      return [];
    }

    return Data.STAT_KEYS
      .filter(function (key) {
        return (
          finiteNumber(
            item.baseStats[key],
            0
          ) !== 0
        );
      })
      .map(function (key) {
        const meta =
          Data.getStatMeta(key);

        return {
          stat: key,
          name: meta.name,

          value:
            finiteNumber(
              item.baseStats[key],
              0
            ),

          type: meta.type,

          formattedValue:
            formatStatValue(
              item.baseStats[key],
              meta.type
            ),

          source: "base"
        };
      });
  }

  function getBonusStatRows(item) {
    const rows = [];

    if (!item) {
      return rows;
    }

    Data.STAT_KEYS.forEach(
      function (key) {
        const value =
          finiteNumber(
            item.bonusStats &&
            item.bonusStats[key],
            0
          );

        if (!value) {
          return;
        }

        const meta =
          Data.getStatMeta(key);

        rows.push({
          stat: key,

          name:
            meta.name +
            " (강화)",

          value: value,
          type: meta.type,

          formattedValue:
            formatStatValue(
              value,
              meta.type
            ),

          source: "enhancement"
        });
      }
    );

    (
      item.randomOptions || []
    ).forEach(
      function (option) {
        if (!option) {
          return;
        }

        const meta =
          Data.getStatMeta(
            option.stat
          );

        const type =
          option.type ||
          meta.type;

        rows.push({
          stat: option.stat,

          name:
            option.name ||
            meta.name,

          value:
            finiteNumber(
              option.value,
              0
            ),

          type: type,

          formattedValue:
            formatStatValue(
              option.value,
              type
            ),

          source: "random"
        });
      }
    );

    return rows;
  }

  function sortItems(
    items,
    sortId
  ) {
    const result =
      Array.isArray(items)
        ? items.slice()
        : [];

    const selected =
      CONFIG
        .INVENTORY_SORT_OPTIONS
        .includes(sortId)
        ? sortId
        : "newest";

    result.sort(
      function (left, right) {
        if (
          selected === "score"
        ) {
          const difference =
            getItemScore(right) -
            getItemScore(left);

          if (difference) {
            return difference;
          }
        }

        if (
          selected === "rarity"
        ) {
          const difference =
            Data.getRarityOrder(
              right.rarity
            ) -
            Data.getRarityOrder(
              left.rarity
            );

          if (difference) {
            return difference;
          }
        }

        if (
          selected === "level"
        ) {
          const difference =
            finiteNumber(
              right.itemLevel,
              1
            ) -
            finiteNumber(
              left.itemLevel,
              1
            );

          if (difference) {
            return difference;
          }
        }

        return (
          finiteNumber(
            right.acquiredAt,
            0
          ) -
          finiteNumber(
            left.acquiredAt,
            0
          )
        );
      }
    );

    return result;
  }

  function sortForgeItems(
    items,
    sortId
  ) {
    const result =
      Array.isArray(items)
        ? items.slice()
        : [];

    const selected =
      CONFIG
        .FORGE_SORT_OPTIONS
        .includes(sortId)
        ? sortId
        : "score";

    result.sort(
      function (left, right) {
        if (
          selected ===
          "enhancement"
        ) {
          const difference =
            finiteNumber(
              right.enhancement,
              0
            ) -
            finiteNumber(
              left.enhancement,
              0
            );

          if (difference) {
            return difference;
          }
        }

        if (
          selected === "rarity"
        ) {
          const difference =
            Data.getRarityOrder(
              right.rarity
            ) -
            Data.getRarityOrder(
              left.rarity
            );

          if (difference) {
            return difference;
          }
        }

        if (
          selected === "level"
        ) {
          const difference =
            finiteNumber(
              right.itemLevel,
              1
            ) -
            finiteNumber(
              left.itemLevel,
              1
            );

          if (difference) {
            return difference;
          }
        }

        return (
          getItemScore(right) -
          getItemScore(left)
        );
      }
    );

    return result;
  }

  function filterItems(
    items,
    slotFilter,
    rarityFilter
  ) {
    return (
      Array.isArray(items)
        ? items
        : []
    ).filter(
      function (item) {
        const slotMatches =
          !slotFilter ||
          slotFilter === "all" ||
          item.slot === slotFilter;

        const rarityMatches =
          !rarityFilter ||
          rarityFilter === "all" ||
          item.rarity ===
            rarityFilter;

        return (
          slotMatches &&
          rarityMatches
        );
      }
    );
  }

  function getVisibleInventory(
    options
  ) {
    const settings =
      State.getState().settings;

    const source =
      options || {};

    return sortItems(
      filterItems(
        State.getState()
          .inventory,

        source.slotFilter ||
        settings
          .inventorySlotFilter ||
        "all",

        source.rarityFilter ||
        settings
          .inventoryRarityFilter ||
        "all"
      ),

      source.sort ||
      settings.inventorySort ||
      "newest"
    );
  }

  function getForgeItems(sortId) {
    return sortForgeItems(
      State.getAllItems(),

      sortId ||
      State.getState()
        .forge.sort ||
      "score"
    );
  }

  function getSalvageableItems() {
    return sortItems(
      State.getState()
        .inventory
        .filter(function (item) {
          return !item.locked;
        }),

      "rarity"
    );
  }

  function getNextSort(sortId) {
    const options =
      CONFIG
        .INVENTORY_SORT_OPTIONS;

    const index =
      options.indexOf(sortId);

    return options[
      index < 0
        ? 0
        : (
            index + 1
          ) %
          options.length
    ];
  }

  function getNextForgeSort(
    sortId
  ) {
    const options =
      CONFIG
        .FORGE_SORT_OPTIONS;

    const index =
      options.indexOf(sortId);

    return options[
      index < 0
        ? 0
        : (
            index + 1
          ) %
          options.length
    ];
  }

  function getSortLabel(sortId) {
    return (
      SORT_LABELS[sortId] ||
      SORT_LABELS.newest
    );
  }

  function getForgeSortLabel(
    sortId
  ) {
    return (
      FORGE_SORT_LABELS[
        sortId
      ] ||
      FORGE_SORT_LABELS.score
    );
  }

  global.GameLoot = {
    subscribe: subscribe,

    calculateDropChance:
      calculateDropChance,

    rollRarity:
      rollRarity,

    generateItem:
      generateItem,

    rollDrop:
      rollDrop,

    grantBossReward:
      grantBossReward,

    getItemTotalStats:
      getItemTotalStats,

    getItemScore:
      getItemScore,

    compareItems:
      compareItems,

    compareWithEquipped:
      compareWithEquipped,

    getBaseStatRows:
      getBaseStatRows,

    getBonusStatRows:
      getBonusStatRows,

    formatStatValue:
      formatStatValue,

    sortItems:
      sortItems,

    sortForgeItems:
      sortForgeItems,

    filterItems:
      filterItems,

    getVisibleInventory:
      getVisibleInventory,

    getForgeItems:
      getForgeItems,

    getSalvageableItems:
      getSalvageableItems,

    getNextSort:
      getNextSort,

    getNextForgeSort:
      getNextForgeSort,

    getSortLabel:
      getSortLabel,

    getForgeSortLabel:
      getForgeSortLabel
  };
})(window);
