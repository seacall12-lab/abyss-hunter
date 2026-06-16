(function (global) {
  "use strict";

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
      name: "가시 늑대",
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
      description: "첫 번째 사냥터입니다.",
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
      name: "버려진 광산",
      description: "이후 업데이트를 위해 준비된 지역입니다.",
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
      subtitle: "숲의 수호자",
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
        name: "뿌리 강타",
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
      subtitle: "가시 무리 우두머리",
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
        name: "가시 도약",
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
      subtitle: "고블린 전쟁군주",
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
        name: "전쟁군주 강타",
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
      name: "강타",
      cooldown: 4.8,
      damageMultiplier: 2.35,
      ultimateGain: 22
    },
    guard: {
      id: "guard",
      name: "방어",
      cooldown: 5.5,
      duration: 2.4,
      normalReduction: 0.55,
      warningReduction: 0.9
    },
    potion: {
      id: "potion",
      name: "회복 물약",
      cooldown: 4,
      uses: 3,
      healRatio: 0.35
    },
    ultimate: {
      id: "ultimate",
      name: "궁극기",
      requiredGauge: 100,
      damageMultiplier: 6.5
    },
    basicAttackGaugeGain: 5,
    damageTakenGaugeGain: 0.12
  };

  const ITEM_SLOTS = {
    weapon: { id: "weapon", name: "무기", icon: "무", order: 1 },
    helmet: { id: "helmet", name: "투구", icon: "투", order: 2 },
    armor: { id: "armor", name: "갑옷", icon: "갑", order: 3 },
    gloves: { id: "gloves", name: "장갑", icon: "장", order: 4 },
    boots: { id: "boots", name: "신발", icon: "신", order: 5 },
    necklace: { id: "necklace", name: "목걸이", icon: "목", order: 6 }
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
      optionCount: [0, 1],
      salvageMultiplier: 1
    },
    rare: {
      id: "rare",
      name: "희귀",
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
      name: "영웅",
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
      name: "전설",
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
    weapon: ["철검", "가시 검", "고블린 절단검"],
    helmet: ["가죽 투구", "가시 두건", "정찰병 투구"],
    armor: ["여행자 갑옷", "나무껍질 흉갑", "고블린 사슬갑옷"],
    gloves: ["가죽 장갑", "전투 손아귀", "늑대 발톱"],
    boots: ["길잡이 장화", "사냥꾼 장화", "그림자 발걸음"],
    necklace: ["숲의 부적", "푸른 핵 목걸이", "전쟁 증표"]
  };

  const ITEM_AFFIXES = [
    { stat: "attack", name: "공격력", min: 1, max: 5, type: "flat" },
    { stat: "defense", name: "방어력", min: 1, max: 4, type: "flat" },
    { stat: "maxHp", name: "최대 체력", min: 8, max: 28, type: "flat" },
    { stat: "attackSpeed", name: "공격 속도", min: 0.01, max: 0.05, type: "ratio" },
    { stat: "critChance", name: "치명타 확률", min: 0.01, max: 0.04, type: "ratio" },
    { stat: "critDamage", name: "치명타 피해", min: 0.04, max: 0.12, type: "ratio" },
    { stat: "lifesteal", name: "생명력 흡수", min: 0.005, max: 0.02, type: "ratio" },
    { stat: "bossDamage", name: "보스 피해", min: 0.02, max: 0.08, type: "ratio" },
    { stat: "normalDamage", name: "몬스터 피해", min: 0.02, max: 0.08, type: "ratio" },
    { stat: "goldBonus", name: "골드 보너스", min: 0.02, max: 0.08, type: "ratio" }
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
    maxHp: { name: "최대 체력", type: "flat", powerWeight: 0.18 },
    attack: { name: "공격력", type: "flat", powerWeight: 5.2 },
    defense: { name: "방어력", type: "flat", powerWeight: 3.4 },
    attackSpeed: { name: "공격 속도", type: "ratio", powerWeight: 72 },
    critChance: { name: "치명타 확률", type: "ratio", powerWeight: 420 },
    critDamage: { name: "치명타 피해", type: "ratio", powerWeight: 120 },
    lifesteal: { name: "생명력 흡수", type: "ratio", powerWeight: 520 },
    bossDamage: { name: "보스 피해", type: "ratio", powerWeight: 260 },
    normalDamage: { name: "몬스터 피해", type: "ratio", powerWeight: 190 },
    goldBonus: { name: "골드 보너스", type: "ratio", powerWeight: 90 }
  };

  global.GameContentData = {
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
    STAT_META: STAT_META
  };
})(window);
