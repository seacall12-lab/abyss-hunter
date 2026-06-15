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

  /*
   * 슬롯별 기본 능력치 규칙
   *
   * 각 장비는 슬롯의 역할이 분명하게 느껴지도록
   * 서로 다른 기본 능력치를 가진다.
   */
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

    let result = Number.isFinite(numeric)
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
    listeners.forEach(function (listener) {
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

  function pickRandom(array) {
    if (
      !Array.isArray(array) ||
      array.length === 0
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

  function roundStatValue(value, type) {
    if (type === "ratio") {
      return Math.round(
        value * 1000
      ) / 1000;
    }

    return Math.max(
      1,
      Math.round(value)
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

  /*
   * 일반 몬스터 기본 드롭률은 8%다.
   * 웨이브가 오를수록 최대 5%p까지 증가한다.
   */
  function calculateDropChance(context) {
    const source = context || {};

    if (source.forceDrop) {
      return 1;
    }

    if (source.isBoss) {
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

    const waveBonus = Math.min(
      0.05,
      (wave - 1) * 0.001
    );

    return Data.clamp(
      Data.LOOT.baseDropChance +
      waveBonus,
      0,
      0.25
    );
  }

  function buildRarityWeights(context) {
    const source = context || {};

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

    const weights = {
      common:
        Data.RARITIES.common.weight,

      rare:
        Data.RARITIES.rare.weight,

      epic:
        Data.RARITIES.epic.weight,

      legendary:
        Data.RARITIES.legendary.weight
    };

    const progressionBonus = Math.min(
      8,
      Math.floor(
        (wave - 1) / 5
      )
    );

    weights.common = Math.max(
      35,
      weights.common -
      progressionBonus
    );

    weights.rare +=
      progressionBonus * 0.7;

    weights.epic +=
      progressionBonus * 0.24;

    weights.legendary +=
      progressionBonus * 0.06;

    if (source.isBoss) {
      weights.common *= 0.18;
      weights.rare *= 1.8;
      weights.epic *= 3.2;
      weights.legendary *= 4.5;
    }

    return weights;
  }

  function rollRarity(context) {
    const weights =
      buildRarityWeights(
        context
      );

    const entries =
      Data.LOOT
        .rarityOrder
        .map(function (rarityId) {
          return {
            id: rarityId,

            weight: Math.max(
              0,
              finiteNumber(
                weights[rarityId],
                0,
                0,
                999999
              )
            )
          };
        });

    const totalWeight =
      entries.reduce(
        function (sum, entry) {
          return sum + entry.weight;
        },
        0
      );

    if (totalWeight <= 0) {
      return "common";
    }

    let roll =
      Math.random() *
      totalWeight;

    for (
      let index = 0;
      index < entries.length;
      index += 1
    ) {
      roll -=
        entries[index].weight;

      if (roll <= 0) {
        return entries[index].id;
      }
    }

    return "common";
  }

  /*
   * 아이템 레벨은 플레이어 레벨과
   * 현재 웨이브를 함께 반영한다.
   */
  function resolveItemLevel(context) {
    const source = context || {};

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

    const waveLevel = Math.max(
      1,
      Math.ceil(wave / 2)
    );

    const centerLevel = Math.max(
      playerLevel,
      waveLevel
    );

    const levelOffset =
      Data.randomInteger(
        -1,
        source.isBoss ? 2 : 1
      );

    return Data.clamp(
      centerLevel +
      levelOffset,
      1,
      CONFIG.MAX_LEVEL
    );
  }

  function rollBaseStats(
    slotId,
    rarityId,
    itemLevel
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
      (itemLevel - 1) * 0.11;

    const stats = {};

    rules.forEach(function (rule) {
      const baseValue =
        Data.randomRange(
          rule.min,
          rule.max
        );

      const finalValue =
        baseValue *
        levelMultiplier *
        rarity.statMultiplier;

      stats[rule.stat] =
        roundStatValue(
          finalValue,
          rule.type
        );
    });

    return stats;
  }

  function getOptionCount(
    rarityId
  ) {
    const rarity =
      Data.getRarity(
        rarityId
      );

    const range =
      Array.isArray(
        rarity.optionCount
      )
        ? rarity.optionCount
        : [0, 0];

    return Data.randomInteger(
      Number(range[0]) || 0,
      Number(range[1]) || 0
    );
  }

  /*
   * 동일한 랜덤 옵션이 한 아이템에
   * 중복되지 않게 생성한다.
   *
   * 기본 능력치와 같은 능력치는 허용한다.
   */
  function rollRandomOptions(
    rarityId,
    itemLevel
  ) {
    const optionCount =
      getOptionCount(
        rarityId
      );

    if (optionCount <= 0) {
      return [];
    }

    const rarity =
      Data.getRarity(
        rarityId
      );

    const candidates =
      Data.ITEM_AFFIXES.slice();

    const options = [];

    const levelMultiplier =
      1 +
      (itemLevel - 1) * 0.025;

    while (
      candidates.length > 0 &&
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

      const baseValue =
        Data.randomRange(
          affix.min,
          affix.max
        );

      const rarityMultiplier =
        0.88 +
        rarity.statMultiplier *
        0.18;

      const value =
        roundStatValue(
          baseValue *
          levelMultiplier *
          rarityMultiplier,

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
    rarityId
  ) {
    const prefix =
      pickRandom(
        RARITY_PREFIXES[
          rarityId
        ] ||
        RARITY_PREFIXES.common
      );

    const baseName =
      pickRandom(
        Data.ITEM_BASE_NAMES[
          slotId
        ] ||
        Data.ITEM_BASE_NAMES.weapon
      );

    return [
      prefix,
      baseName
    ]
      .filter(Boolean)
      .join(" ");
  }

  function calculateItemValues(
    rarityId,
    itemLevel
  ) {
    const rarityIndex =
      Math.max(
        0,

        Data.LOOT
          .rarityOrder
          .indexOf(rarityId)
      );

    const rarityMultiplier =
      1 +
      rarityIndex * 0.9;

    const sellValue =
      Math.max(
        1,
        Math.round(
          (
            8 +
            itemLevel * 5
          ) *
          rarityMultiplier
        )
      );

    const salvageValue =
      Math.max(
        1,
        Math.round(
          (
            1 +
            itemLevel * 0.45
          ) *
          rarityMultiplier
        )
      );

    return {
      sellValue: sellValue,
      salvageValue:
        salvageValue
    };
  }

  function generateItem(context) {
    const source = context || {};

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

    const rarityId =
      Object.prototype
        .hasOwnProperty
        .call(
          Data.RARITIES,
          source.rarity
        )
        ? source.rarity
        : rollRarity(source);

    const itemLevel =
      resolveItemLevel(
        source
      );

    const values =
      calculateItemValues(
        rarityId,
        itemLevel
      );

    return {
      id: createItemId(),

      name: buildItemName(
        slotId,
        rarityId
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

      baseStats:
        rollBaseStats(
          slotId,
          rarityId,
          itemLevel
        ),

      bonusStats: {},

      randomOptions:
        rollRandomOptions(
          rarityId,
          itemLevel
        ),

      salvageValue:
        values.salvageValue,

      sellValue:
        values.sellValue,

      acquiredAt: Date.now()
    };
  }

  /*
   * 몬스터 처치 시 장비 드롭을 판정하고
   * 획득한 장비를 인벤토리에 저장한다.
   */
  function rollDrop(context) {
    const source = context || {};

    const dropChance =
      calculateDropChance(
        source
      );

    const roll = Math.random();

    if (
      !source.forceDrop &&
      roll >= dropChance
    ) {
      const missResult = {
        dropped: false,
        stored: false,
        chance: dropChance,
        roll: roll,
        item: null,
        reason: "no-drop"
      };

      emit(
        "drop-miss",
        missResult
      );

      return missResult;
    }

    const item =
      generateItem(source);

    const storedItem =
      State.addInventoryItem(
        item
      );

    const result = {
      dropped: true,

      stored:
        Boolean(storedItem),

      chance:
        dropChance,

      roll: roll,

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

    emit(
      storedItem
        ? "drop-success"
        : "inventory-full",

      result
    );

    return result;
  }

  /*
   * 아이템의 기본 능력치, 강화 능력치,
   * 랜덤 옵션을 하나로 합산한다.
   */
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

    function addStatMap(statMap) {
      if (
        !statMap ||
        typeof statMap !== "object"
      ) {
        return;
      }

      Data.STAT_KEYS.forEach(
        function (key) {
          totals[key] +=
            finiteNumber(
              statMap[key],
              0,
              -999999999,
              999999999
            );
        }
      );
    }

    addStatMap(
      item.baseStats
    );

    addStatMap(
      item.bonusStats
    );

    if (
      Array.isArray(
        item.randomOptions
      )
    ) {
      item.randomOptions.forEach(
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
    }

    return totals;
  }

  /*
   * state.js와 동일한 장비 점수를 사용한다.
   */
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
        99
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
      getItemScore(
        candidate
      );

    const equippedScore =
      getItemScore(
        equipped
      );

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
    if (!item) {
      return compareItems(
        null,
        null
      );
    }

    const equipped =
      State.getEquippedItem(
        item.slot
      );

    const comparison =
      compareItems(
        item,
        equipped
      );

    comparison.equippedItem =
      equipped;

    comparison.slot =
      item.slot;

    return comparison;
  }

  /*
   * ratio:
   * 0.05 → 5.0%
   *
   * flat:
   * 12.34 → 12.3
   */
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
        ) /
        10
      ).toFixed(1) + "%";
    }

    return String(
      Math.round(
        numeric * 10
      ) / 10
    );
  }

  /*
   * 아이템 상세 화면에서 표시할 기본 능력치 목록
   */
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

          type:
            meta.type,

          formattedValue:
            formatStatValue(
              item.baseStats[key],
              meta.type
            )
        };
      });
  }

  /*
   * 강화 능력치와 랜덤 옵션 표시 목록
   */
  function getBonusStatRows(item) {
    const rows = [];

    if (
      item &&
      item.bonusStats
    ) {
      Data.STAT_KEYS.forEach(
        function (key) {
          const value =
            finiteNumber(
              item.bonusStats[key],
              0
            );

          if (value === 0) {
            return;
          }

          const meta =
            Data.getStatMeta(key);

          rows.push({
            stat: key,
            name: meta.name,
            value: value,
            type: meta.type,

            formattedValue:
              formatStatValue(
                value,
                meta.type
              ),

            source:
              "enhancement"
          });
        }
      );
    }

    if (
      item &&
      Array.isArray(
        item.randomOptions
      )
    ) {
      item.randomOptions.forEach(
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
            stat:
              option.stat,

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

            source:
              "random"
          });
        }
      );
    }

    return rows;
  }

  /*
   * 인벤토리 정렬
   *
   * newest: 획득 시간
   * score: 장비 점수
   * rarity: 장비 등급
   * level: 아이템 레벨
   */
  function sortItems(
    items,
    sortId
  ) {
    const result =
      Array.isArray(items)
        ? items.slice()
        : [];

    const selectedSort =
      CONFIG
        .INVENTORY_SORT_OPTIONS
        .includes(sortId)
        ? sortId
        : "newest";

    result.sort(
      function (left, right) {
        if (
          selectedSort ===
          "score"
        ) {
          const scoreDifference =
            getItemScore(right) -
            getItemScore(left);

          if (
            scoreDifference !== 0
          ) {
            return scoreDifference;
          }
        }

        if (
          selectedSort ===
          "rarity"
        ) {
          const rarityDifference =
            Data.getRarityOrder(
              right.rarity
            ) -
            Data.getRarityOrder(
              left.rarity
            );

          if (
            rarityDifference !== 0
          ) {
            return rarityDifference;
          }
        }

        if (
          selectedSort ===
          "level"
        ) {
          const levelDifference =
            finiteNumber(
              right.itemLevel,
              1
            ) -
            finiteNumber(
              left.itemLevel,
              1
            );

          if (
            levelDifference !== 0
          ) {
            return levelDifference;
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

  function filterItems(
    items,
    slotFilter,
    rarityFilter
  ) {
    const source =
      Array.isArray(items)
        ? items
        : [];

    return source.filter(
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

  /*
   * 현재 저장된 인벤토리 설정을 기준으로
   * UI에서 표시할 장비 배열을 반환한다.
   */
  function getVisibleInventory(options) {
    const settings =
      State.getState().settings;

    const source =
      options || {};

    const slotFilter =
      source.slotFilter ||
      settings
        .inventorySlotFilter ||
      "all";

    const rarityFilter =
      source.rarityFilter ||
      settings
        .inventoryRarityFilter ||
      "all";

    const sortId =
      source.sort ||
      settings.inventorySort ||
      "newest";

    const filtered =
      filterItems(
        State.getState()
          .inventory,

        slotFilter,
        rarityFilter
      );

    return sortItems(
      filtered,
      sortId
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

  function getSortLabel(sortId) {
    return (
      SORT_LABELS[sortId] ||
      SORT_LABELS.newest
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

    filterItems:
      filterItems,

    getVisibleInventory:
      getVisibleInventory,

    getNextSort:
      getNextSort,

    getSortLabel:
      getSortLabel
  };
})(window);
