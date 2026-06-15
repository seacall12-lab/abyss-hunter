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

  /*
   * 장비 등급에 따른 이름 접두사
   */
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
   * 장비 슬롯별 기본 능력치 규칙
   *
   * 무기: 공격력
   * 투구·갑옷: HP와 방어력
   * 장갑: 공격력과 치명타 확률
   * 신발: 방어력과 공격속도
   * 목걸이: HP와 치명타 피해
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
      result = Math.max(
        min,
        result
      );
    }

    if (Number.isFinite(max)) {
      result = Math.min(
        max,
        result
      );
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

  function roundStatValue(
    value,
    type
  ) {
    if (type === "ratio") {
      return (
        Math.round(
          value * 1000
        ) / 1000
      );
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
   *
   * 웨이브당 0.1%p씩 증가하고
   * 최대 5%p까지 추가된다.
   *
   * 일반 몬스터 최대 드롭률은 13%다.
   * 보스는 장비를 확정 드롭한다.
   */
  function calculateDropChance(
    context
  ) {
    const source =
      context || {};

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

  /*
   * 웨이브가 높아질수록 일반 장비 비율을 낮추고
   * 희귀 이상 등급의 비율을 조금씩 높인다.
   */
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

    const weights = {
      common:
        Data.RARITIES.common.weight,

      rare:
        Data.RARITIES.rare.weight,

      epic:
        Data.RARITIES.epic.weight,

      legendary:
        Data.RARITIES
          .legendary
          .weight
    };

    const progressionBonus =
      Math.min(
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

    /*
     * 향후 보스전에서는 일반 등급을 크게 줄이고
     * 영웅·전설 확률을 높인다.
     */
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
          return (
            sum + entry.weight
          );
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
   * 장비 레벨은 플레이어 레벨과 웨이브를 함께 반영한다.
   */
  function resolveItemLevel(
    context
  ) {
    const source =
      context || {};

    const playerLevel =
      Math.max(
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

    const waveLevel =
      Math.max(
        1,
        Math.ceil(wave / 2)
      );

    const centerLevel =
      Math.max(
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
   * 같은 장비에 동일한 랜덤 옵션이 중복되지 않도록
   * 후보 배열에서 뽑은 옵션을 제거한다.
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

  /*
   * v0.3에서 판매와 분해 기능에 사용할 가치
   */
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

    const sellValue = Math.max(
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

  /*
   * 장비 한 개 생성
   */
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

      /*
       * 강화 시스템에서 추가되는 능력치
       */
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
   * 몬스터 처치 시 장비 드롭 판정
   */
  function rollDrop(context) {
    const source =
      context || {};

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

      chance: dropChance,
      roll: roll,

      item: clone(
        storedItem || item
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
   * v0.2 자동 장착 추천에 사용할 장비 점수
   *
   * 현재 전투력 계산과 비슷한 가중치를 사용한다.
   */
  function getItemScore(item) {
    if (
      !item ||
      typeof item !== "object"
    ) {
      return 0;
    }

    const weights = {
      maxHp: 0.18,
      attack: 5.2,
      defense: 3.4,
      attackSpeed: 72,
      critChance: 420,
      critDamage: 120,
      lifesteal: 520,
      bossDamage: 260,
      normalDamage: 190,
      goldBonus: 90
    };

    let score = 0;

    function addStatMap(
      statMap
    ) {
      if (
        !statMap ||
        typeof statMap !==
          "object"
      ) {
        return;
      }

      Object.keys(weights).forEach(
        function (stat) {
          score +=
            finiteNumber(
              statMap[stat],
              0,
              -999999999,
              999999999
            ) *
            weights[stat];
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
            Object.prototype
              .hasOwnProperty
              .call(
                weights,
                option.stat
              )
          ) {
            score +=
              finiteNumber(
                option.value,
                0,
                -999999999,
                999999999
              ) *
              weights[
                option.stat
              ];
          }
        }
      );
    }

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

    return {
      candidateScore:
        candidateScore,

      equippedScore:
        equippedScore,

      difference:
        candidateScore -
        equippedScore,

      isUpgrade:
        candidateScore >
        equippedScore
    };
  }

  /*
   * UI에서 능력치 표시 시 사용한다.
   *
   * ratio:
   * 0.05 → 5.0%
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
        ) / 10
      ).toFixed(1) + "%";
    }

    return String(
      Math.round(
        numeric * 10
      ) / 10
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

    getItemScore:
      getItemScore,

    compareItems:
      compareItems,

    formatStatValue:
      formatStatValue
  };
})(window);
