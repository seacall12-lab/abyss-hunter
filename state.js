(function (global) {
  "use strict";

  if (!global.GameData) {
    throw new Error(
      "state.js보다 data.js를 먼저 로드해야 합니다."
    );
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
    return Boolean(value) &&
      typeof value === "object" &&
      !Array.isArray(value);
  }

  function clone(value) {
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
    const number = Number(value);

    const safeFallback =
      Number.isFinite(Number(fallback))
        ? Number(fallback)
        : 0;

    let result =
      Number.isFinite(number)
        ? number
        : safeFallback;

    if (Number.isFinite(min)) {
      result = Math.max(min, result);
    }

    if (Number.isFinite(max)) {
      result = Math.min(max, result);
    }

    return result;
  }

  function finiteInteger(
    value,
    fallback,
    min,
    max
  ) {
    return Math.floor(
      finiteNumber(
        value,
        fallback,
        min,
        max
      )
    );
  }

  function safeBoolean(
    value,
    fallback
  ) {
    return typeof value === "boolean"
      ? value
      : Boolean(fallback);
  }

  function safeString(
    value,
    fallback,
    maxLength
  ) {
    const text =
      typeof value === "string"
        ? value.trim()
        : "";

    const result =
      text || String(fallback || "");

    return result.slice(
      0,
      maxLength || 100
    );
  }

  /*
   * 기본 상태에 기존 저장 데이터를 합친다.
   *
   * 새 버전에 필드가 추가되어도 기본값이 자동으로 보완된다.
   */
  function mergeDefaults(
    defaultValue,
    incomingValue
  ) {
    if (Array.isArray(defaultValue)) {
      return Array.isArray(incomingValue)
        ? clone(incomingValue)
        : clone(defaultValue);
    }

    if (isPlainObject(defaultValue)) {
      const result = {};

      const source =
        isPlainObject(incomingValue)
          ? incomingValue
          : {};

      Object.keys(defaultValue).forEach(
        function (key) {
          result[key] = mergeDefaults(
            defaultValue[key],
            source[key]
          );
        }
      );

      Object.keys(source).forEach(
        function (key) {
          if (
            !Object.prototype
              .hasOwnProperty
              .call(result, key)
          ) {
            result[key] = clone(
              source[key]
            );
          }
        }
      );

      return result;
    }

    return incomingValue === undefined
      ? defaultValue
      : incomingValue;
  }

  function emit(type, payload) {
    listeners.forEach(
      function (listener) {
        try {
          listener({
            type: type,
            payload: payload || null,
            state: state
          });
        } catch (error) {
          console.error(
            "GameState 구독 처리 중 오류가 발생했습니다.",
            error
          );
        }
      }
    );
  }

  function markDirty(reason) {
    dirty = true;

    emit("dirty", {
      reason: reason || "unknown"
    });
  }

  function createEmptyEquipment() {
    const equipment = {};

    Object.keys(
      Data.ITEM_SLOTS
    ).forEach(function (slotId) {
      equipment[slotId] = null;
    });

    return equipment;
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
      highestSingleHit: 0,
      playTimeSeconds: 0
    };
  }

  function createDefaultState() {
    const now = Date.now();

    const baseStats =
      Data.getPlayerBaseStats(1);

    return {
      saveVersion: SAVE_VERSION,
      gameVersion: CONFIG.GAME_VERSION,

      player: {
        id: Data.PLAYER.id,
        name: Data.PLAYER.name,
        className: Data.PLAYER.className,

        level: 1,
        exp: 0,
        expToNext:
          Data.getRequiredExp(1),

        currentHp: baseStats.maxHp,
        maxHp: baseStats.maxHp,

        attack: baseStats.attack,
        defense: baseStats.defense,
        attackSpeed:
          baseStats.attackSpeed,

        critChance:
          baseStats.critChance,

        critDamage:
          baseStats.critDamage,

        lifesteal:
          baseStats.lifesteal,

        bossDamage:
          baseStats.bossDamage,

        normalDamage:
          baseStats.normalDamage,

        goldBonus:
          baseStats.goldBonus,

        power: 0
      },

      progression: {
        currentRegionId:
          Data.REGIONS[0].id,

        currentWave: 1,
        defeatedInWave: 0,
        highestWave: 1,

        unlockedRegionIds: [
          Data.REGIONS[0].id
        ],

        clearedBossRegionIds: []
      },

      /*
       * v0.2 장비 장착 시스템을 위한 구조
       */
      equipment:
        createEmptyEquipment(),

      inventory: [],

      currencies: {
        gold: 0,
        enhancementStone: 0
      },

      settings: {
        speed:
          CONFIG.DEFAULT_SPEED,

        paused: false,

        reducedEffects: false,

        showDamageNumbers: true
      },

      statistics:
        createDefaultStatistics(),

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

    const incoming =
      isPlainObject(source)
        ? source
        : {};

    Data.STAT_KEYS.forEach(
      function (key) {
        if (
          Object.prototype
            .hasOwnProperty
            .call(incoming, key)
        ) {
          result[key] = finiteNumber(
            incoming[key],
            0,
            -999999999,
            999999999
          );
        }
      }
    );

    return result;
  }

  function normalizeOptions(source) {
    if (!Array.isArray(source)) {
      return [];
    }

    return source
      .slice(0, 12)
      .map(function (option) {
        if (
          !isPlainObject(option) ||
          !Data.STAT_KEYS.includes(
            option.stat
          )
        ) {
          return null;
        }

        return {
          stat: option.stat,

          name: safeString(
            option.name,
            option.stat,
            40
          ),

          value: finiteNumber(
            option.value,
            0,
            -999999999,
            999999999
          ),

          type:
            option.type === "ratio"
              ? "ratio"
              : "flat"
        };
      })
      .filter(Boolean);
  }

  /*
   * 저장된 장비 데이터가 손상되었거나
   * 필드가 빠졌을 때 안전한 구조로 복구한다.
   */
  function normalizeItem(
    item,
    fallbackIndex
  ) {
    if (!isPlainObject(item)) {
      return null;
    }

    const slotId =
      Object.prototype
        .hasOwnProperty
        .call(
          Data.ITEM_SLOTS,
          item.slot
        )
        ? item.slot
        : "weapon";

    const rarityId =
      Object.prototype
        .hasOwnProperty
        .call(
          Data.RARITIES,
          item.rarity
        )
        ? item.rarity
        : "common";

    const fallbackId = [
      "item",
      Date.now().toString(36),
      String(fallbackIndex || 0),
      Math.random()
        .toString(36)
        .slice(2, 7)
    ].join("-");

    return {
      id: safeString(
        item.id,
        fallbackId,
        100
      ),

      name: safeString(
        item.name,
        Data.ITEM_SLOTS[slotId].name,
        80
      ),

      slot: slotId,
      rarity: rarityId,

      requiredLevel: finiteInteger(
        item.requiredLevel,
        1,
        1,
        CONFIG.MAX_LEVEL
      ),

      itemLevel: finiteInteger(
        item.itemLevel,
        item.requiredLevel || 1,
        1,
        CONFIG.MAX_LEVEL
      ),

      enhancement: finiteInteger(
        item.enhancement,
        0,
        0,
        99
      ),

      locked: safeBoolean(
        item.locked,
        false
      ),

      equipped: safeBoolean(
        item.equipped,
        false
      ),

      baseStats:
        normalizeStatMap(
          item.baseStats ||
          item.stats
        ),

      bonusStats:
        normalizeStatMap(
          item.bonusStats ||
          item.enhancementStats
        ),

      randomOptions:
        normalizeOptions(
          item.randomOptions ||
          item.options
        ),

      salvageValue: finiteInteger(
        item.salvageValue,
        0,
        0,
        999999999
      ),

      sellValue: finiteInteger(
        item.sellValue,
        0,
        0,
        999999999
      ),

      acquiredAt: finiteInteger(
        item.acquiredAt,
        Date.now(),
        0,
        Number.MAX_SAFE_INTEGER
      )
    };
  }

  /*
   * 현재 장착 중인 모든 장비의 능력치를 합산한다.
   */
  function collectEquipmentBonuses(
    targetState
  ) {
    const bonuses = {};

    Data.STAT_KEYS.forEach(
      function (key) {
        bonuses[key] = 0;
      }
    );

    function addStatMap(statMap) {
      if (!isPlainObject(statMap)) {
        return;
      }

      Data.STAT_KEYS.forEach(
        function (key) {
          bonuses[key] +=
            finiteNumber(
              statMap[key],
              0,
              -999999999,
              999999999
            );
        }
      );
    }

    Object.keys(
      Data.ITEM_SLOTS
    ).forEach(function (slotId) {
      const item =
        targetState.equipment[slotId];

      if (!item) {
        return;
      }

      addStatMap(item.baseStats);
      addStatMap(item.bonusStats);

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
              bonuses[option.stat] +=
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
    });

    return bonuses;
  }

  /*
   * 화면에 표시할 전투력 계산
   *
   * 전투력은 비교용 수치이며 실제 피해 계산식과는 별개다.
   */
  function computeCombatPower(
    player
  ) {
    const rawPower =
      player.maxHp * 0.18 +
      player.attack * 5.2 +
      player.defense * 3.4 +
      player.attackSpeed * 72 +
      player.critChance * 420 +
      Math.max(
        0,
        player.critDamage - 1
      ) * 120 +
      player.lifesteal * 520 +
      player.bossDamage * 260 +
      player.normalDamage * 190;

    return Math.max(
      1,
      Math.round(rawPower)
    );
  }

  /*
   * 레벨 기본 능력치와 장비 능력치를 다시 계산한다.
   */
  function applyDerivedPlayerStats(
    targetState,
    options
  ) {
    const settings = options || {};
    const player = targetState.player;

    const oldMaxHp = finiteNumber(
      player.maxHp,
      1,
      1,
      999999999
    );

    const oldCurrentHp =
      finiteNumber(
        player.currentHp,
        oldMaxHp,
        0,
        oldMaxHp
      );

    const oldHpRatio =
      oldMaxHp > 0
        ? oldCurrentHp / oldMaxHp
        : 1;

    const base =
      Data.getPlayerBaseStats(
        player.level
      );

    const bonuses =
      collectEquipmentBonuses(
        targetState
      );

    player.maxHp = Math.max(
      1,
      Math.round(
        base.maxHp +
        bonuses.maxHp
      )
    );

    player.attack = Math.max(
      1,
      Math.round(
        (
          base.attack +
          bonuses.attack
        ) * 10
      ) / 10
    );

    player.defense = Math.max(
      0,
      Math.round(
        (
          base.defense +
          bonuses.defense
        ) * 10
      ) / 10
    );

    player.attackSpeed =
      Data.clamp(
        Math.round(
          (
            base.attackSpeed +
            bonuses.attackSpeed
          ) * 1000
        ) / 1000,
        0.2,
        5
      );

    player.critChance =
      Data.clamp(
        base.critChance +
        bonuses.critChance,
        0,
        0.9
      );

    player.critDamage =
      Data.clamp(
        base.critDamage +
        bonuses.critDamage,
        1,
        5
      );

    player.lifesteal =
      Data.clamp(
        base.lifesteal +
        bonuses.lifesteal,
        0,
        0.5
      );

    player.bossDamage =
      Data.clamp(
        base.bossDamage +
        bonuses.bossDamage,
        0,
        5
      );

    player.normalDamage =
      Data.clamp(
        base.normalDamage +
        bonuses.normalDamage,
        0,
        5
      );

    player.goldBonus =
      Data.clamp(
        base.goldBonus +
        bonuses.goldBonus,
        0,
        10
      );

    player.expToNext =
      Data.getRequiredExp(
        player.level
      );

    player.power =
      computeCombatPower(player);

    if (settings.healToFull) {
      player.currentHp =
        player.maxHp;
    } else if (
      settings.preserveHpRatio
    ) {
      player.currentHp =
        Math.round(
          player.maxHp *
          oldHpRatio
        );
    } else {
      player.currentHp =
        Math.min(
          player.maxHp,
          Math.max(
            0,
            oldCurrentHp
          )
        );
    }

    if (
      settings.reviveIfDead &&
      player.currentHp <= 0
    ) {
      player.currentHp =
        player.maxHp;
    }

    return player;
  }

  /*
   * 경험치가 요구량보다 많으면
   * 저장 불러오기 과정에서 자동으로 레벨을 보정한다.
   */
  function normalizeLevelAndExperience(
    player
  ) {
    player.level = finiteInteger(
      player.level,
      1,
      1,
      CONFIG.MAX_LEVEL
    );

    player.exp = finiteInteger(
      player.exp,
      0,
      0,
      Number.MAX_SAFE_INTEGER
    );

    let guard = 0;

    while (
      player.level <
        CONFIG.MAX_LEVEL &&
      guard < CONFIG.MAX_LEVEL
    ) {
      const required =
        Data.getRequiredExp(
          player.level
        );

      if (player.exp < required) {
        break;
      }

      player.exp -= required;
      player.level += 1;
      guard += 1;
    }

    if (
      player.level >=
      CONFIG.MAX_LEVEL
    ) {
      player.level =
        CONFIG.MAX_LEVEL;

      player.exp = Math.min(
        player.exp,
        Data.getRequiredExp(
          CONFIG.MAX_LEVEL
        ) - 1
      );
    }
  }

  function normalizeEquipment(source) {
    const result =
      createEmptyEquipment();

    const incoming =
      isPlainObject(source)
        ? source
        : {};

    Object.keys(result).forEach(
      function (slotId, index) {
        const normalized =
          normalizeItem(
            incoming[slotId],
            index
          );

        if (
          normalized &&
          normalized.slot === slotId
        ) {
          normalized.equipped = true;
          result[slotId] =
            normalized;
        }
      }
    );

    return result;
  }

  function normalizeInventory(source) {
    if (!Array.isArray(source)) {
      return [];
    }

    const seenIds = new Set();

    return source
      .slice(
        0,
        CONFIG.MAX_INVENTORY
      )
      .map(function (item, index) {
        return normalizeItem(
          item,
          index
        );
      })
      .filter(function (item) {
        if (!item) {
          return false;
        }

        if (seenIds.has(item.id)) {
          item.id =
            item.id +
            "-" +
            Math.random()
              .toString(36)
              .slice(2, 6);
        }

        seenIds.add(item.id);
        item.equipped = false;

        return true;
      });
  }

  function normalizeProgression(
    targetState
  ) {
    const progression =
      targetState.progression;

    const validRegionIds =
      Data.REGIONS.map(
        function (region) {
          return region.id;
        }
      );

    if (
      !validRegionIds.includes(
        progression.currentRegionId
      )
    ) {
      progression.currentRegionId =
        Data.REGIONS[0].id;
    }

    progression.currentWave =
      finiteInteger(
        progression.currentWave,
        1,
        1,
        999999
      );

    progression.defeatedInWave =
      finiteInteger(
        progression.defeatedInWave,
        0,
        0,
        999999999
      );

    /*
     * 저장 데이터상 처치 수가 웨이브 기준을 넘으면
     * 웨이브와 남은 처치 수로 자동 변환한다.
     */
    if (
      progression.defeatedInWave >=
      CONFIG.MONSTERS_PER_WAVE
    ) {
      progression.currentWave +=
        Math.floor(
          progression.defeatedInWave /
          CONFIG.MONSTERS_PER_WAVE
        );

      progression.defeatedInWave %=
        CONFIG.MONSTERS_PER_WAVE;
    }

    progression.highestWave =
      Math.max(
        progression.currentWave,
        finiteInteger(
          progression.highestWave,
          progression.currentWave,
          1,
          999999
        )
      );

    progression.unlockedRegionIds =
      Array.isArray(
        progression.unlockedRegionIds
      )
        ? progression
            .unlockedRegionIds
            .filter(
              function (
                regionId,
                index,
                array
              ) {
                return (
                  validRegionIds.includes(
                    regionId
                  ) &&
                  array.indexOf(
                    regionId
                  ) === index
                );
              }
            )
        : [Data.REGIONS[0].id];

    if (
      !progression
        .unlockedRegionIds
        .includes(
          Data.REGIONS[0].id
        )
    ) {
      progression
        .unlockedRegionIds
        .unshift(
          Data.REGIONS[0].id
        );
    }

    progression
      .clearedBossRegionIds =
      Array.isArray(
        progression
          .clearedBossRegionIds
      )
        ? progression
            .clearedBossRegionIds
            .filter(
              function (
                regionId,
                index,
                array
              ) {
                return (
                  validRegionIds.includes(
                    regionId
                  ) &&
                  array.indexOf(
                    regionId
                  ) === index
                );
              }
            )
        : [];
  }

  /*
   * 저장 데이터를 현재 버전의 안전한 상태로 정리한다.
   */
  function sanitizeState(
    incomingState
  ) {
    const defaults =
      createDefaultState();

    const sanitized =
      mergeDefaults(
        defaults,
        incomingState
      );

    sanitized.saveVersion =
      SAVE_VERSION;

    sanitized.gameVersion =
      CONFIG.GAME_VERSION;

    sanitized.player.id =
      Data.PLAYER.id;

    sanitized.player.name =
      safeString(
        sanitized.player.name,
        Data.PLAYER.name,
        40
      );

    sanitized.player.className =
      Data.PLAYER.className;

    normalizeLevelAndExperience(
      sanitized.player
    );

    sanitized.equipment =
      normalizeEquipment(
        sanitized.equipment
      );

    sanitized.inventory =
      normalizeInventory(
        sanitized.inventory
      );

    sanitized.currencies.gold =
      finiteInteger(
        sanitized.currencies.gold,
        0,
        0,
        Number.MAX_SAFE_INTEGER
      );

    sanitized
      .currencies
      .enhancementStone =
      finiteInteger(
        sanitized
          .currencies
          .enhancementStone,
        0,
        0,
        Number.MAX_SAFE_INTEGER
      );

    const storedSpeed =
      Number(
        sanitized.settings.speed
      );

    sanitized.settings.speed =
      CONFIG.SPEED_OPTIONS.includes(
        storedSpeed
      )
        ? storedSpeed
        : CONFIG.DEFAULT_SPEED;

    sanitized.settings.paused =
      safeBoolean(
        sanitized.settings.paused,
        false
      );

    sanitized
      .settings
      .reducedEffects =
      safeBoolean(
        sanitized
          .settings
          .reducedEffects,
        false
      );

    sanitized
      .settings
      .showDamageNumbers =
      safeBoolean(
        sanitized
          .settings
          .showDamageNumbers,
        true
      );

    const defaultStatistics =
      createDefaultStatistics();

    Object.keys(
      defaultStatistics
    ).forEach(function (key) {
      sanitized.statistics[key] =
        finiteNumber(
          sanitized
            .statistics[key],
          defaultStatistics[key],
          0,
          Number.MAX_SAFE_INTEGER
        );
    });

    normalizeProgression(
      sanitized
    );

    sanitized.recentLoot =
      normalizeItem(
        sanitized.recentLoot,
        9999
      );

    sanitized.meta.createdAt =
      finiteInteger(
        sanitized.meta.createdAt,
        Date.now(),
        0,
        Number.MAX_SAFE_INTEGER
      );

    sanitized.meta.lastSavedAt =
      finiteInteger(
        sanitized.meta.lastSavedAt,
        0,
        0,
        Number.MAX_SAFE_INTEGER
      );

    sanitized.meta.lastLoadedAt =
      Date.now();

    sanitized.meta.lastPlayedAt =
      finiteInteger(
        sanitized.meta.lastPlayedAt,
        Date.now(),
        0,
        Number.MAX_SAFE_INTEGER
      );

    /*
     * 새로 불러올 때 HP가 0인 상태면
     * 정상적으로 사냥을 재개할 수 있도록 회복한다.
     */
    applyDerivedPlayerStats(
      sanitized,
      {
        preserveHpRatio: false,
        reviveIfDead: true
      }
    );

    return sanitized;
  }

  /*
   * saveVersion이 없거나 0인 초기 저장 형식을
   * 현재 버전 구조로 변환한다.
   */
  function migrateLegacySave(
    rawState
  ) {
    const migrated =
      isPlainObject(rawState)
        ? clone(rawState)
        : {};

    let version =
      finiteInteger(
        migrated.saveVersion,
        0,
        0,
        SAVE_VERSION
      );

    if (version < 1) {
      migrated.player =
        isPlainObject(
          migrated.player
        )
          ? migrated.player
          : {};

      migrated.progression =
        isPlainObject(
          migrated.progression
        )
          ? migrated.progression
          : {};

      migrated.currencies =
        isPlainObject(
          migrated.currencies
        )
          ? migrated.currencies
          : {};

      migrated.settings =
        isPlainObject(
          migrated.settings
        )
          ? migrated.settings
          : {};

      migrated.statistics =
        isPlainObject(
          migrated.statistics
        )
          ? migrated.statistics
          : {};

      /*
       * 이전 단순 저장 형식이 있을 경우를 대비한 변환
       */
      if (
        migrated.gold !== undefined &&
        migrated
          .currencies
          .gold === undefined
      ) {
        migrated.currencies.gold =
          migrated.gold;
      }

      if (
        migrated.wave !== undefined &&
        migrated
          .progression
          .currentWave === undefined
      ) {
        migrated
          .progression
          .currentWave =
          migrated.wave;
      }

      if (
        migrated.totalKills !==
          undefined &&
        migrated
          .statistics
          .totalKills === undefined
      ) {
        migrated
          .statistics
          .totalKills =
          migrated.totalKills;
      }

      if (
        migrated.speed !== undefined &&
        migrated
          .settings
          .speed === undefined
      ) {
        migrated.settings.speed =
          migrated.speed;
      }

      if (
        migrated.paused !==
          undefined &&
        migrated
          .settings
          .paused === undefined
      ) {
        migrated.settings.paused =
          migrated.paused;
      }

      version = 1;
      migrated.saveVersion =
        version;
    }

    migrated.saveVersion =
      SAVE_VERSION;

    return migrated;
  }

  /*
   * JSON 파싱이 불가능한 저장 데이터는 별도 키로 백업한다.
   */
  function backupCorruptedSave(
    rawText
  ) {
    if (
      typeof rawText !== "string" ||
      rawText.length === 0
    ) {
      return;
    }

    try {
      const backupKey =
        STORAGE_KEY +
        ".corrupt." +
        Date.now();

      global.localStorage.setItem(
        backupKey,
        rawText.slice(0, 100000)
      );
    } catch (error) {
      console.warn(
        "손상된 저장 데이터의 백업을 만들지 못했습니다.",
        error
      );
    }
  }

  function load() {
    lastError = null;

    try {
      const rawText =
        global.localStorage.getItem(
          STORAGE_KEY
        );

      /*
       * 기존 저장이 없으면 새 게임 생성
       */
      if (!rawText) {
        state =
          createDefaultState();

        applyDerivedPlayerStats(
          state,
          {
            healToFull: true
          }
        );

        dirty = true;

        emit("load", {
          source: "default",
          recovered: false
        });

        return state;
      }

      const parsed =
        JSON.parse(rawText);

      const migrated =
        migrateLegacySave(parsed);

      state =
        sanitizeState(migrated);

      /*
       * 마이그레이션 또는 보정된 내용을
       * 다음 자동 저장 시 다시 기록한다.
       */
      dirty = true;

      emit("load", {
        source: "storage",
        recovered: false,
        saveVersion:
          state.saveVersion
      });

      return state;
    } catch (error) {
      lastError = error;

      try {
        const rawText =
          global.localStorage.getItem(
            STORAGE_KEY
          );

        backupCorruptedSave(rawText);

        global.localStorage.removeItem(
          STORAGE_KEY
        );
      } catch (storageError) {
        console.warn(
          "손상된 저장 데이터를 정리하지 못했습니다.",
          storageError
        );
      }

      state =
        createDefaultState();

      applyDerivedPlayerStats(
        state,
        {
          healToFull: true
        }
      );

      dirty = true;

      console.error(
        "저장 데이터를 불러오지 못해 기본값으로 복구했습니다.",
        error
      );

      emit("load-error", {
        error: error,
        recovered: true
      });

      return state;
    }
  }

  function save(force) {
    if (!state) {
      state =
        createDefaultState();
    }

    /*
     * 변경 내용이 없으면 불필요한 저장을 하지 않는다.
     */
    if (!dirty && !force) {
      return true;
    }

    lastError = null;

    try {
      state.saveVersion =
        SAVE_VERSION;

      state.gameVersion =
        CONFIG.GAME_VERSION;

      state.meta.lastSavedAt =
        Date.now();

      state.meta.lastPlayedAt =
        state.meta.lastSavedAt;

      global.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
      );

      dirty = false;

      emit("save", {
        savedAt:
          state.meta.lastSavedAt
      });

      return true;
    } catch (error) {
      lastError = error;

      console.error(
        "게임 저장에 실패했습니다.",
        error
      );

      emit("save-error", {
        error: error
      });

      return false;
    }
  }

  /*
   * 모든 진행 데이터를 초기화한다.
   */
  function reset() {
    lastError = null;

    try {
      global.localStorage.removeItem(
        STORAGE_KEY
      );
    } catch (error) {
      lastError = error;

      console.warn(
        "기존 저장 데이터를 삭제하지 못했습니다.",
        error
      );
    }

    state =
      createDefaultState();

    applyDerivedPlayerStats(
      state,
      {
        healToFull: true
      }
    );

    dirty = true;

    emit("reset", null);

    save(true);

    return state;
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

  function getState() {
    if (!state) {
      state =
        createDefaultState();

      applyDerivedPlayerStats(
        state,
        {
          healToFull: true
        }
      );
    }

    return state;
  }

  function getSnapshot() {
    return clone(
      getState()
    );
  }

  function recalculatePlayerStats(
    options
  ) {
    const player =
      applyDerivedPlayerStats(
        getState(),
        options || {}
      );

    markDirty(
      "recalculate-player-stats"
    );

    emit("player-stats", {
      player: player
    });

    return player;
  }

  /*
   * 경험치 지급과 레벨업 처리
   *
   * 레벨업 시 HP를 전부 회복한다.
   */
  function addExperience(amount) {
    const currentState =
      getState();

    const player =
      currentState.player;

    const gainedExp =
      finiteInteger(
        amount,
        0,
        0,
        Number.MAX_SAFE_INTEGER
      );

    if (gainedExp <= 0) {
      return {
        gainedExp: 0,
        levelsGained: 0,
        reachedMaxLevel: false
      };
    }

    player.exp += gainedExp;

    currentState
      .statistics
      .totalExpEarned +=
      gainedExp;

    let levelsGained = 0;

    while (
      player.level <
      CONFIG.MAX_LEVEL
    ) {
      const required =
        Data.getRequiredExp(
          player.level
        );

      if (player.exp < required) {
        break;
      }

      player.exp -= required;
      player.level += 1;
      levelsGained += 1;
    }

    if (
      player.level >=
      CONFIG.MAX_LEVEL
    ) {
      player.level =
        CONFIG.MAX_LEVEL;

      player.exp = Math.min(
        player.exp,
        Data.getRequiredExp(
          CONFIG.MAX_LEVEL
        ) - 1
      );
    }

    applyDerivedPlayerStats(
      currentState,
      {
        healToFull:
          levelsGained > 0,

        preserveHpRatio:
          levelsGained === 0
      }
    );

    markDirty(
      "gain-experience"
    );

    emit("experience", {
      gainedExp: gainedExp,
      levelsGained: levelsGained,
      level: player.level
    });

    return {
      gainedExp: gainedExp,
      levelsGained: levelsGained,

      reachedMaxLevel:
        player.level >=
        CONFIG.MAX_LEVEL
    };
  }

  /*
   * 골드 획득량 증가 옵션을 적용해 골드를 지급한다.
   */
  function addGold(amount) {
    const currentState =
      getState();

    const baseAmount =
      finiteInteger(
        amount,
        0,
        0,
        Number.MAX_SAFE_INTEGER
      );

    const bonusMultiplier =
      1 +
      currentState
        .player
        .goldBonus;

    const gainedGold =
      Math.max(
        0,
        Math.round(
          baseAmount *
          bonusMultiplier
        )
      );

    if (gainedGold <= 0) {
      return 0;
    }

    currentState.currencies.gold =
      Math.min(
        Number.MAX_SAFE_INTEGER,

        currentState
          .currencies
          .gold +
        gainedGold
      );

    currentState
      .statistics
      .totalGoldEarned =
      Math.min(
        Number.MAX_SAFE_INTEGER,

        currentState
          .statistics
          .totalGoldEarned +
        gainedGold
      );

    markDirty("gain-gold");

    emit("gold", {
      gainedGold: gainedGold
    });

    return gainedGold;
  }

  function spendGold(amount) {
    const currentState =
      getState();

    const cost =
      finiteInteger(
        amount,
        0,
        0,
        Number.MAX_SAFE_INTEGER
      );

    if (
      cost <= 0 ||
      currentState
        .currencies
        .gold < cost
    ) {
      return false;
    }

    currentState
      .currencies
      .gold -= cost;

    markDirty("spend-gold");

    emit("gold-spent", {
      cost: cost
    });

    return true;
  }

  /*
   * 현재 웨이브의 처치 수를 증가시킨다.
   *
   * 몬스터 5마리 처치 시 다음 웨이브로 이동한다.
   */
  function advanceMonsterProgress() {
    const progression =
      getState().progression;

    const previousWave =
      progression.currentWave;

    progression.defeatedInWave += 1;

    if (
      progression.defeatedInWave >=
      CONFIG.MONSTERS_PER_WAVE
    ) {
      progression.defeatedInWave = 0;
      progression.currentWave += 1;

      progression.highestWave =
        Math.max(
          progression.highestWave,
          progression.currentWave
        );
    }

    markDirty(
      "advance-monster-progress"
    );

    const waveAdvanced =
      progression.currentWave >
      previousWave;

    emit("progress", {
      waveAdvanced: waveAdvanced,

      currentWave:
        progression.currentWave,

      defeatedInWave:
        progression.defeatedInWave
    });

    return {
      waveAdvanced: waveAdvanced,
      previousWave: previousWave,

      currentWave:
        progression.currentWave,

      defeatedInWave:
        progression.defeatedInWave
    };
  }

  /*
   * 누적 처치 수와 웨이브 진행도를 동시에 처리한다.
   */
  function recordMonsterKill() {
    const currentState =
      getState();

    currentState
      .statistics
      .totalKills += 1;

    markDirty("monster-kill");

    const progressResult =
      advanceMonsterProgress();

    emit("kill", {
      totalKills:
        currentState
          .statistics
          .totalKills,

      progress: progressResult
    });

    return progressResult;
  }

  function setPlayerHp(value) {
    const player =
      getState().player;

    player.currentHp =
      Data.clamp(
        value,
        0,
        player.maxHp
      );

    return player.currentHp;
  }

  /*
   * 방어력 적용 후 최종 피해량을 combat.js에서 계산하고
   * 이 함수에는 실제 받을 피해량을 전달한다.
   */
  function damagePlayer(amount) {
    const currentState =
      getState();

    const damage = Math.max(
      0,
      Math.round(
        finiteNumber(
          amount,
          0,
          0,
          999999999
        )
      )
    );

    if (
      damage <= 0 ||
      currentState
        .player
        .currentHp <= 0
    ) {
      return 0;
    }

    const actualDamage =
      Math.min(
        currentState
          .player
          .currentHp,
        damage
      );

    currentState
      .player
      .currentHp -=
      actualDamage;

    currentState
      .statistics
      .totalDamageTaken +=
      actualDamage;

    if (
      currentState
        .player
        .currentHp <= 0
    ) {
      currentState
        .player
        .currentHp = 0;

      currentState
        .statistics
        .totalDeaths += 1;

      emit(
        "player-death",
        null
      );
    }

    markDirty(
      "player-damaged"
    );

    return actualDamage;
  }

  function healPlayer(amount) {
    const player =
      getState().player;

    const healing =
      Math.max(
        0,
        Math.round(
          finiteNumber(
            amount,
            0,
            0,
            999999999
          )
        )
      );

    if (
      healing <= 0 ||
      player.currentHp <= 0
    ) {
      return 0;
    }

    const before =
      player.currentHp;

    player.currentHp =
      Math.min(
        player.maxHp,
        player.currentHp +
        healing
      );

    const actualHealing =
      player.currentHp -
      before;

    if (actualHealing > 0) {
      markDirty(
        "player-healed"
      );
    }

    return actualHealing;
  }

  function revivePlayer() {
    const player =
      getState().player;

    player.currentHp =
      player.maxHp;

    markDirty(
      "player-revived"
    );

    emit(
      "player-revive",
      null
    );

    return player.currentHp;
  }

  /*
   * 플레이어가 입힌 피해 통계 기록
   */
  function recordPlayerDamageDealt(
    amount,
    isCritical
  ) {
    const currentState =
      getState();

    const damage = Math.max(
      0,
      Math.round(
        finiteNumber(
          amount,
          0,
          0,
          999999999
        )
      )
    );

    currentState
      .statistics
      .totalDamageDealt +=
      damage;

    currentState
      .statistics
      .highestSingleHit =
      Math.max(
        currentState
          .statistics
          .highestSingleHit,
        damage
      );

    if (isCritical) {
      currentState
        .statistics
        .totalCriticalHits += 1;
    }

    if (damage > 0) {
      markDirty(
        "damage-dealt"
      );
    }
  }

  /*
   * v0.1 장비 드롭을 인벤토리에 저장한다.
   *
   * 실제 장비 목록 화면과 장착 기능은 v0.2에서 추가한다.
   */
  function addInventoryItem(item) {
    const currentState =
      getState();

    const normalizedItem =
      normalizeItem(
        item,
        currentState
          .inventory
          .length
      );

    if (
      !normalizedItem ||
      currentState
        .inventory
        .length >=
        CONFIG.MAX_INVENTORY
    ) {
      return false;
    }

    normalizedItem.equipped =
      false;

    currentState
      .inventory
      .unshift(
        normalizedItem
      );

    currentState
      .statistics
      .totalItemsFound += 1;

    currentState.recentLoot =
      clone(normalizedItem);

    markDirty(
      "add-inventory-item"
    );

    emit("loot", {
      item: normalizedItem
    });

    return normalizedItem;
  }

  function setRecentLoot(item) {
    const currentState =
      getState();

    currentState.recentLoot =
      item
        ? normalizeItem(
            item,
            9999
          )
        : null;

    markDirty(
      "set-recent-loot"
    );

    emit("loot-preview", {
      item:
        currentState.recentLoot
    });

    return currentState.recentLoot;
  }

  function setSpeed(speed) {
    const numericSpeed =
      Number(speed);

    if (
      !CONFIG
        .SPEED_OPTIONS
        .includes(numericSpeed)
    ) {
      return getState()
        .settings
        .speed;
    }

    getState()
      .settings
      .speed =
      numericSpeed;

    markDirty("set-speed");

    emit("speed", {
      speed: numericSpeed
    });

    return numericSpeed;
  }

  function setPaused(paused) {
    const nextPaused =
      Boolean(paused);

    getState()
      .settings
      .paused =
      nextPaused;

    markDirty("set-paused");

    emit("pause", {
      paused: nextPaused
    });

    return nextPaused;
  }

  function togglePaused() {
    return setPaused(
      !getState()
        .settings
        .paused
    );
  }

  /*
   * 실제 플레이 시간 누적
   *
   * 일시정지 중에는 증가하지 않는다.
   */
  function addPlayTime(
    deltaSeconds
  ) {
    const seconds =
      finiteNumber(
        deltaSeconds,
        0,
        0,
        10
      );

    if (
      seconds <= 0 ||
      getState()
        .settings
        .paused
    ) {
      return getState()
        .statistics
        .playTimeSeconds;
    }

    getState()
      .statistics
      .playTimeSeconds +=
      seconds;

    /*
     * 프레임마다 이벤트를 발생시키지는 않고
     * 저장 필요 상태만 표시한다.
     */
    dirty = true;

    return getState()
      .statistics
      .playTimeSeconds;
  }

  /*
   * 향후 통계를 추가할 때 사용할 공통 함수
   */
  function incrementStatistic(
    key,
    amount
  ) {
    const currentState =
      getState();

    if (
      !Object.prototype
        .hasOwnProperty
        .call(
          currentState.statistics,
          key
        )
    ) {
      return 0;
    }

    const increment =
      finiteNumber(
        amount,
        1,
        0,
        Number.MAX_SAFE_INTEGER
      );

    currentState
      .statistics[key] =
      Math.min(
        Number.MAX_SAFE_INTEGER,

        finiteNumber(
          currentState
            .statistics[key],
          0,
          0,
          Number.MAX_SAFE_INTEGER
        ) + increment
      );

    markDirty(
      "statistic-" + key
    );

    return currentState
      .statistics[key];
  }

  function isDirty() {
    return dirty;
  }

  function getLastError() {
    return lastError;
  }

  /*
   * 다른 스크립트에서 사용할 전역 상태 관리자
   */
  global.GameState = {
    SAVE_VERSION: SAVE_VERSION,
    STORAGE_KEY: STORAGE_KEY,

    createDefaultState:
      createDefaultState,

    load: load,
    save: save,
    reset: reset,

    subscribe: subscribe,

    getState: getState,
    getSnapshot: getSnapshot,

    markDirty: markDirty,
    isDirty: isDirty,
    getLastError: getLastError,

    recalculatePlayerStats:
      recalculatePlayerStats,

    addExperience:
      addExperience,

    addGold: addGold,
    spendGold: spendGold,

    advanceMonsterProgress:
      advanceMonsterProgress,

    recordMonsterKill:
      recordMonsterKill,

    setPlayerHp:
      setPlayerHp,

    damagePlayer:
      damagePlayer,

    healPlayer:
      healPlayer,

    revivePlayer:
      revivePlayer,

    recordPlayerDamageDealt:
      recordPlayerDamageDealt,

    addInventoryItem:
      addInventoryItem,

    setRecentLoot:
      setRecentLoot,

    setSpeed: setSpeed,
    setPaused: setPaused,
    togglePaused: togglePaused,

    addPlayTime:
      addPlayTime,

    incrementStatistic:
      incrementStatistic
  };
})(window);
