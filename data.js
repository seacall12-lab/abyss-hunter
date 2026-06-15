(function (global) {
  "use strict";

  const CONFIG = {
    GAME_VERSION: "0.2.0",
    SAVE_VERSION: 2,
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
    MAX_BATTLE_LOGS: 50,

    DEFAULT_VIEW: "hunt",

    INVENTORY_SORT_OPTIONS: [
      "newest",
      "score",
      "rarity",
      "level"
    ]
  };

  /*
   * 플레이어 기본 데이터
   * attackSpeed는 초당 공격 횟수다.
   */
  const PLAYER = {
    id: "warrior",
    name: "심연의 전사",
    className: "전사",

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
      name: "숲 슬라임",
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
      name: "가시늑대",
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
      name: "고블린 정찰병",
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
      name: "초보자의 숲",
      description: "심연으로 향하는 초입의 숲",
      unlockRequirement: null,

      monsterIds: [
        "forestSlime",
        "thornWolf",
        "goblinScout"
      ],

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
      name: "버려진 광산",
      description: "v0.5에서 해금될 예정인 지역",

      unlockRequirement: {
        type: "bossClear",
        regionId: "beginnerForest"
      },

      monsterIds: [],

      background: {
        skyTop: "#252536",
        skyBottom: "#11131d",
        ground: "#24211f",
        accent: "#a1764e"
      },

      disabled: true
    }
  ];

  const ITEM_SLOTS = {
    weapon: {
      id: "weapon",
      name: "무기",
      icon: "⚔",
      order: 1
    },

    helmet: {
      id: "helmet",
      name: "투구",
      icon: "◉",
      order: 2
    },

    armor: {
      id: "armor",
      name: "갑옷",
      icon: "◇",
      order: 3
    },

    gloves: {
      id: "gloves",
      name: "장갑",
      icon: "✦",
      order: 4
    },

    boots: {
      id: "boots",
      name: "신발",
      icon: "▲",
      order: 5
    },

    necklace: {
      id: "necklace",
      name: "목걸이",
      icon: "◆",
      order: 6
    }
  };

  const RARITIES = {
    common: {
      id: "common",
      name: "일반",
      color: "#aab2c0",
      glow: "rgba(170, 178, 192, 0.24)",
      order: 1,
      weight: 70,
      statMultiplier: 1,
      optionCount: [0, 1]
    },

    rare: {
      id: "rare",
      name: "희귀",
      color: "#4b8eff",
      glow: "rgba(75, 142, 255, 0.34)",
      order: 2,
      weight: 23,
      statMultiplier: 1.22,
      optionCount: [1, 2]
    },

    epic: {
      id: "epic",
      name: "영웅",
      color: "#af58ff",
      glow: "rgba(175, 88, 255, 0.38)",
      order: 3,
      weight: 6,
      statMultiplier: 1.52,
      optionCount: [2, 3]
    },

    legendary: {
      id: "legendary",
      name: "전설",
      color: "#ff993d",
      glow: "rgba(255, 153, 61, 0.45)",
      order: 4,
      weight: 1,
      statMultiplier: 1.95,
      optionCount: [3, 4]
    }
  };

  const ITEM_BASE_NAMES = {
    weapon: [
      "낡은 장검",
      "숲지기의 검",
      "고블린 절단검"
    ],

    helmet: [
      "가죽 투구",
      "숲의 철투구",
      "정찰병의 투구"
    ],

    armor: [
      "누비 갑옷",
      "숲의 판금갑옷",
      "고블린 흉갑"
    ],

    gloves: [
      "가죽 장갑",
      "전투 장갑",
      "가시 장갑"
    ],

    boots: [
      "낡은 장화",
      "추적자의 장화",
      "숲길 장화"
    ],

    necklace: [
      "나무 부적",
      "푸른 이빨 목걸이",
      "심연석 목걸이"
    ]
  };

  /*
   * ratio 유형은 소수 값으로 저장한다.
   * 예: 0.03 = 3%
   */
  const ITEM_AFFIXES = [
    {
      stat: "attack",
      name: "공격력",
      min: 1,
      max: 5,
      type: "flat"
    },

    {
      stat: "defense",
      name: "방어력",
      min: 1,
      max: 4,
      type: "flat"
    },

    {
      stat: "maxHp",
      name: "최대 HP",
      min: 8,
      max: 28,
      type: "flat"
    },

    {
      stat: "attackSpeed",
      name: "공격속도",
      min: 0.01,
      max: 0.05,
      type: "ratio"
    },

    {
      stat: "critChance",
      name: "치명타 확률",
      min: 0.01,
      max: 0.04,
      type: "ratio"
    },

    {
      stat: "critDamage",
      name: "치명타 피해",
      min: 0.04,
      max: 0.12,
      type: "ratio"
    },

    {
      stat: "lifesteal",
      name: "생명력 흡수",
      min: 0.005,
      max: 0.02,
      type: "ratio"
    },

    {
      stat: "bossDamage",
      name: "보스 피해",
      min: 0.02,
      max: 0.08,
      type: "ratio"
    },

    {
      stat: "normalDamage",
      name: "일반 몬스터 피해",
      min: 0.02,
      max: 0.08,
      type: "ratio"
    },

    {
      stat: "goldBonus",
      name: "골드 획득량",
      min: 0.02,
      max: 0.08,
      type: "ratio"
    }
  ];

  const LOOT = {
    baseDropChance: 0.08,

    slots: Object.keys(ITEM_SLOTS),

    rarityOrder: [
      "common",
      "rare",
      "epic",
      "legendary"
    ]
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

  /*
   * 능력치 표시와 아이템 점수 계산에 사용하는 공통 정보
   */
  const STAT_META = {
    maxHp: {
      name: "최대 HP",
      type: "flat",
      powerWeight: 0.18
    },

    attack: {
      name: "공격력",
      type: "flat",
      powerWeight: 5.2
    },

    defense: {
      name: "방어력",
      type: "flat",
      powerWeight: 3.4
    },

    attackSpeed: {
      name: "공격속도",
      type: "ratio",
      powerWeight: 72
    },

    critChance: {
      name: "치명타 확률",
      type: "ratio",
      powerWeight: 420
    },

    critDamage: {
      name: "치명타 피해",
      type: "ratio",
      powerWeight: 120
    },

    lifesteal: {
      name: "생명력 흡수",
      type: "ratio",
      powerWeight: 520
    },

    bossDamage: {
      name: "보스 피해",
      type: "ratio",
      powerWeight: 260
    },

    normalDamage: {
      name: "일반 몬스터 피해",
      type: "ratio",
      powerWeight: 190
    },

    goldBonus: {
      name: "골드 획득량",
      type: "ratio",
      powerWeight: 90
    }
  };

  function clamp(value, min, max) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return min;
    }

    return Math.min(
      max,
      Math.max(min, numericValue)
    );
  }

  function randomRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function randomInteger(min, max) {
    const safeMin = Math.ceil(
      Math.min(min, max)
    );

    const safeMax = Math.floor(
      Math.max(min, max)
    );

    return Math.floor(
      Math.random() * (safeMax - safeMin + 1)
    ) + safeMin;
  }

  function getRequiredExp(level) {
    const safeLevel = clamp(
      Math.floor(level),
      1,
      CONFIG.MAX_LEVEL
    );

    return Math.floor(
      70 + 30 * Math.pow(safeLevel, 1.35)
    );
  }

  function getPlayerBaseStats(level) {
    const safeLevel = clamp(
      Math.floor(level),
      1,
      CONFIG.MAX_LEVEL
    );

    const levelOffset = safeLevel - 1;
    const base = PLAYER.baseStats;
    const growth = PLAYER.growthPerLevel;

    return {
      maxHp: Math.round(
        base.maxHp +
        growth.maxHp * levelOffset
      ),

      attack: Math.round(
        (
          base.attack +
          growth.attack * levelOffset
        ) * 10
      ) / 10,

      defense: Math.round(
        (
          base.defense +
          growth.defense * levelOffset
        ) * 10
      ) / 10,

      attackSpeed: Math.round(
        (
          base.attackSpeed +
          Math.min(
            0.35,
            Math.floor(levelOffset / 5) * 0.02
          )
        ) * 100
      ) / 100,

      critChance: Math.round(
        (
          base.critChance +
          Math.min(
            0.07,
            Math.floor(levelOffset / 10) * 0.01
          )
        ) * 1000
      ) / 1000,

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
    return MONSTERS[monsterId] ||
      MONSTERS.forestSlime;
  }

  function getWaveScaling(wave) {
    const safeWave = Math.max(
      1,
      Math.floor(Number(wave) || 1)
    );

    const offset = safeWave - 1;
    const milestoneBonus = Math.floor(offset / 10);

    return {
      hp:
        1 +
        offset * 0.18 +
        milestoneBonus * 0.35,

      attack:
        1 +
        offset * 0.12 +
        milestoneBonus * 0.2,

      defense:
        1 +
        offset * 0.08 +
        milestoneBonus * 0.14,

      reward:
        1 +
        offset * 0.1 +
        milestoneBonus * 0.15
    };
  }

  function buildMonster(
    regionId,
    wave,
    spawnIndex
  ) {
    const region = getRegion(regionId);

    const monsterIds =
      region.monsterIds.length > 0
        ? region.monsterIds
        : REGIONS[0].monsterIds;

    const safeWave = Math.max(
      1,
      Math.floor(Number(wave) || 1)
    );

    const safeSpawnIndex = Math.max(
      0,
      Math.floor(Number(spawnIndex) || 0)
    );

    const monsterId =
      monsterIds[
        (
          safeWave -
          1 +
          safeSpawnIndex
        ) % monsterIds.length
      ];

    const template =
      getMonsterTemplate(monsterId);

    const scaling =
      getWaveScaling(safeWave);

    const variation =
      randomRange(0.96, 1.04);

    const maxHp = Math.max(
      1,
      Math.round(
        template.maxHp *
        scaling.hp *
        variation
      )
    );

    const attack = Math.max(
      1,
      Math.round(
        template.attack *
        scaling.attack *
        variation
      )
    );

    const defense = Math.max(
      0,
      Math.round(
        template.defense *
        scaling.defense
      )
    );

    const expReward = Math.max(
      1,
      Math.round(
        template.expReward *
        scaling.reward
      )
    );

    const goldMin = Math.max(
      1,
      Math.round(
        template.goldMin *
        scaling.reward
      )
    );

    const goldMax = Math.max(
      goldMin,
      Math.round(
        template.goldMax *
        scaling.reward
      )
    );

    return {
      instanceId: [
        template.id,
        Date.now().toString(36),
        Math.random()
          .toString(36)
          .slice(2, 8)
      ].join("-"),

      templateId: template.id,
      name: template.name,

      level: Math.max(
        1,
        safeWave + template.levelOffset
      ),

      wave: safeWave,
      isBoss: false,

      maxHp: maxHp,
      currentHp: maxHp,

      attack: attack,
      defense: defense,

      attackInterval: Math.max(
        0.45,
        template.attackInterval
      ),

      expReward: expReward,

      goldReward: randomInteger(
        goldMin,
        goldMax
      ),

      shape: template.shape,
      color: template.color,
      accentColor: template.accentColor,
      shadowColor: template.shadowColor
    };
  }

  function getItemSlot(slotId) {
    return ITEM_SLOTS[slotId] || null;
  }

  function getRarity(rarityId) {
    return RARITIES[rarityId] ||
      RARITIES.common;
  }

  function getStatMeta(statKey) {
    return STAT_META[statKey] || {
      name: statKey,
      type: "flat",
      powerWeight: 0
    };
  }

  function getRarityOrder(rarityId) {
    return getRarity(rarityId).order || 0;
  }

  global.GameData = {
    CONFIG: CONFIG,
    PLAYER: PLAYER,
    MONSTERS: MONSTERS,
    REGIONS: REGIONS,

    ITEM_SLOTS: ITEM_SLOTS,
    RARITIES: RARITIES,
    ITEM_BASE_NAMES: ITEM_BASE_NAMES,
    ITEM_AFFIXES: ITEM_AFFIXES,
    LOOT: LOOT,

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

    getItemSlot: getItemSlot,
    getRarity: getRarity,
    getStatMeta: getStatMeta,
    getRarityOrder: getRarityOrder
  };
})(window);
