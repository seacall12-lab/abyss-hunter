(function (global) {
  "use strict";

  if (!global.GameData) {
    throw new Error(
      "combat.js보다 data.js를 먼저 로드해야 합니다."
    );
  }

  if (!global.GameState) {
    throw new Error(
      "combat.js보다 state.js를 먼저 로드해야 합니다."
    );
  }

  const Data = global.GameData;
  const State = global.GameState;
  const CONFIG = Data.CONFIG;

  const listeners = new Set();

  /*
   * 전투 중에만 사용하는 임시 상태다.
   *
   * 몬스터의 현재 체력, 공격 타이머 등은
   * localStorage에 저장하지 않는다.
   */
  const runtime = {
    initialized: false,
    status: "idle",

    currentMonster: null,

    playerAttackTimer: 0,
    monsterAttackTimer: 0,
    respawnTimer: 0,
    reviveTimer: 0,

    spawnSequence: 0,
    totalCombatTime: 0,

    lastPlayerDamage: 0,
    lastMonsterDamage: 0,
    lastAttackWasCritical: false
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

  /*
   * UI가 전투 이벤트를 구독할 수 있도록 전달한다.
   *
   * 예:
   * player-attack
   * monster-attack
   * monster-defeated
   * level-up
   */
  function emit(type, payload) {
    const event = {
      type: type,
      payload: payload || null,
      runtime: getRuntimeSnapshot()
    };

    listeners.forEach(function (listener) {
      try {
        listener(event);
      } catch (error) {
        console.error(
          "GameCombat 이벤트 처리 중 오류가 발생했습니다.",
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

  /*
   * attackSpeed는 초당 공격 횟수이므로
   * 1 / attackSpeed로 공격 간격을 계산한다.
   */
  function getPlayerAttackInterval() {
    const attackSpeed = Data.clamp(
      State.getState().player.attackSpeed,
      0.2,
      5
    );

    return 1 / attackSpeed;
  }

  function resetAttackTimers() {
    runtime.playerAttackTimer = Math.min(
      0.28,
      getPlayerAttackInterval() * 0.4
    );

    runtime.monsterAttackTimer =
      runtime.currentMonster
        ? Math.min(
            0.72,
            runtime.currentMonster
              .attackInterval * 0.55
          )
        : 0;
  }

  function getSpawnIndex() {
    const gameState = State.getState();

    return Math.max(
      0,
      gameState
        .progression
        .defeatedInWave
    );
  }

  /*
   * 현재 지역과 웨이브에 맞는 몬스터를 생성한다.
   */
  function spawnMonster() {
    const gameState = State.getState();

    if (
      gameState.player.currentHp <= 0
    ) {
      return null;
    }

    runtime.spawnSequence += 1;

    runtime.currentMonster =
      Data.buildMonster(
        gameState
          .progression
          .currentRegionId,

        gameState
          .progression
          .currentWave,

        getSpawnIndex()
      );

    runtime.status = "fighting";
    runtime.respawnTimer = 0;

    resetAttackTimers();

    emit("monster-spawn", {
      monster: clone(
        runtime.currentMonster
      ),

      wave:
        gameState
          .progression
          .currentWave,

      defeatedInWave:
        gameState
          .progression
          .defeatedInWave
    });

    return runtime.currentMonster;
  }

  /*
   * 방어력에 따른 최종 피해량 계산
   *
   * 공격력에서 방어력의 62%를 차감한다.
   * 최소 피해는 1이다.
   */
  function calculateReducedDamage(
    rawDamage,
    defense
  ) {
    const safeRawDamage = Math.max(
      1,
      finiteNumber(
        rawDamage,
        1,
        1,
        999999999
      )
    );

    const safeDefense = Math.max(
      0,
      finiteNumber(
        defense,
        0,
        0,
        999999999
      )
    );

    const reduction =
      safeDefense * 0.62;

    return Math.max(
      1,
      Math.round(
        safeRawDamage - reduction
      )
    );
  }

  function calculatePlayerAttack() {
    const player =
      State.getState().player;

    const monster =
      runtime.currentMonster;

    if (!monster) {
      return null;
    }

    /*
     * 매 공격마다 ±9%의 피해 편차를 둔다.
     */
    const variation =
      Data.randomRange(
        0.91,
        1.09
      );

    const isCritical =
      Math.random() <
      player.critChance;

    const targetBonus =
      monster.isBoss
        ? player.bossDamage
        : player.normalDamage;

    let rawDamage =
      player.attack *
      variation *
      (1 + targetBonus);

    if (isCritical) {
      rawDamage *=
        player.critDamage;
    }

    const damage =
      calculateReducedDamage(
        rawDamage,
        monster.defense
      );

    return {
      damage: damage,
      isCritical: isCritical,
      rawDamage: rawDamage
    };
  }

  function calculateMonsterAttack() {
    const player =
      State.getState().player;

    const monster =
      runtime.currentMonster;

    if (!monster) {
      return null;
    }

    const variation =
      Data.randomRange(
        0.9,
        1.1
      );

    const rawDamage =
      monster.attack *
      variation;

    return {
      damage:
        calculateReducedDamage(
          rawDamage,
          player.defense
        ),

      rawDamage: rawDamage
    };
  }

  function applyLifesteal(damage) {
    const player =
      State.getState().player;

    if (
      player.lifesteal <= 0 ||
      damage <= 0 ||
      player.currentHp <= 0
    ) {
      return 0;
    }

    const requestedHealing =
      Math.max(
        1,
        Math.floor(
          damage *
          player.lifesteal
        )
      );

    return State.healPlayer(
      requestedHealing
    );
  }

  /*
   * 플레이어 자동 공격
   */
  function performPlayerAttack() {
    const gameState =
      State.getState();

    const monster =
      runtime.currentMonster;

    if (
      runtime.status !== "fighting" ||
      !monster ||
      monster.currentHp <= 0 ||
      gameState.player.currentHp <= 0
    ) {
      return false;
    }

    const attackResult =
      calculatePlayerAttack();

    if (!attackResult) {
      return false;
    }

    const actualDamage = Math.min(
      monster.currentHp,
      attackResult.damage
    );

    monster.currentHp = Math.max(
      0,
      monster.currentHp -
        actualDamage
    );

    runtime.lastPlayerDamage =
      actualDamage;

    runtime.lastAttackWasCritical =
      attackResult.isCritical;

    State.recordPlayerDamageDealt(
      actualDamage,
      attackResult.isCritical
    );

    const healed =
      applyLifesteal(
        actualDamage
      );

    emit("player-attack", {
      damage: actualDamage,

      isCritical:
        attackResult.isCritical,

      healed: healed,

      monsterHp:
        monster.currentHp,

      monsterMaxHp:
        monster.maxHp,

      monster: clone(monster)
    });

    if (monster.currentHp <= 0) {
      handleMonsterDefeated();
    }

    return true;
  }

  /*
   * 몬스터 자동 공격
   */
  function performMonsterAttack() {
    const gameState =
      State.getState();

    const monster =
      runtime.currentMonster;

    if (
      runtime.status !== "fighting" ||
      !monster ||
      monster.currentHp <= 0 ||
      gameState.player.currentHp <= 0
    ) {
      return false;
    }

    const attackResult =
      calculateMonsterAttack();

    if (!attackResult) {
      return false;
    }

    const actualDamage =
      State.damagePlayer(
        attackResult.damage
      );

    runtime.lastMonsterDamage =
      actualDamage;

    emit("monster-attack", {
      damage: actualDamage,

      playerHp:
        gameState
          .player
          .currentHp,

      playerMaxHp:
        gameState
          .player
          .maxHp,

      monster: clone(monster)
    });

    if (
      gameState.player.currentHp <= 0
    ) {
      handlePlayerDeath();
    }

    return true;
  }

  /*
   * loot.js가 로드되어 있으면 장비 드롭을 판정한다.
   *
   * combat.js는 loot.js보다 먼저 로드되지만,
   * 실제 호출은 전체 스크립트가 로드된 뒤 이루어진다.
   */
  function tryGenerateLoot(
    defeatedMonster
  ) {
    if (
      !global.GameLoot ||
      typeof global.GameLoot
        .rollDrop !== "function"
    ) {
      return null;
    }

    try {
      return global.GameLoot.rollDrop({
        monster: clone(
          defeatedMonster
        ),

        isBoss: Boolean(
          defeatedMonster.isBoss
        ),

        wave:
          defeatedMonster.wave,

        playerLevel:
          State.getState()
            .player.level
      });
    } catch (error) {
      console.error(
        "장비 드롭 처리 중 오류가 발생했습니다.",
        error
      );

      return null;
    }
  }

  /*
   * 몬스터 처치 보상과 다음 웨이브 진행
   */
  function handleMonsterDefeated() {
    const defeatedMonster =
      runtime.currentMonster;

    if (!defeatedMonster) {
      return;
    }

    runtime.status =
      "monster-defeated";

    const expResult =
      State.addExperience(
        defeatedMonster.expReward
      );

    const gainedGold =
      State.addGold(
        defeatedMonster.goldReward
      );

    const progressResult =
      State.recordMonsterKill();

    const lootResult =
      tryGenerateLoot(
        defeatedMonster
      );

    emit("monster-defeated", {
      monster: clone(
        defeatedMonster
      ),

      gainedExp:
        expResult.gainedExp,

      gainedGold:
        gainedGold,

      levelsGained:
        expResult.levelsGained,

      progress:
        progressResult,

      loot:
        lootResult
    });

    if (
      expResult.levelsGained > 0
    ) {
      emit("level-up", {
        levelsGained:
          expResult.levelsGained,

        level:
          State.getState()
            .player.level
      });
    }

    if (
      progressResult.waveAdvanced
    ) {
      emit("wave-advance", {
        previousWave:
          progressResult.previousWave,

        currentWave:
          progressResult.currentWave
      });
    }

    runtime.currentMonster = null;

    runtime.respawnTimer =
      CONFIG
        .MONSTER_RESPAWN_DELAY_MS /
      1000;
  }

  /*
   * 플레이어 사망 시 현재 몬스터 전투를 종료한다.
   *
   * 부활 후 새로운 몬스터와 전투를 시작한다.
   */
  function handlePlayerDeath() {
    if (
      runtime.status ===
      "player-dead"
    ) {
      return;
    }

    runtime.status =
      "player-dead";

    runtime.currentMonster = null;

    runtime.playerAttackTimer = 0;
    runtime.monsterAttackTimer = 0;
    runtime.respawnTimer = 0;

    runtime.reviveTimer =
      CONFIG
        .PLAYER_REVIVE_DELAY_MS /
      1000;

    emit("player-death", {
      reviveDelay:
        runtime.reviveTimer
    });
  }

  function revivePlayer() {
    State.revivePlayer();

    runtime.status = "reviving";
    runtime.reviveTimer = 0;
    runtime.respawnTimer = 0.35;

    emit("player-revive", {
      currentHp:
        State.getState()
          .player.currentHp,

      maxHp:
        State.getState()
          .player.maxHp
    });
  }

  /*
   * 전투 중 공격 타이머 처리
   *
   * 3배속이나 프레임 지연 상황에서 공격이 누락되지 않도록
   * while 문으로 여러 번 처리한다.
   * 한 프레임당 최대 8회로 제한한다.
   */
  function updateFighting(
    scaledDelta
  ) {
    runtime.playerAttackTimer -=
      scaledDelta;

    runtime.monsterAttackTimer -=
      scaledDelta;

    let attackGuard = 0;

    while (
      runtime.status === "fighting" &&
      runtime.playerAttackTimer <= 0 &&
      attackGuard < 8
    ) {
      performPlayerAttack();

      runtime.playerAttackTimer +=
        getPlayerAttackInterval();

      attackGuard += 1;
    }

    attackGuard = 0;

    while (
      runtime.status === "fighting" &&
      runtime.monsterAttackTimer <= 0 &&
      attackGuard < 8
    ) {
      performMonsterAttack();

      if (runtime.currentMonster) {
        runtime.monsterAttackTimer +=
          runtime.currentMonster
            .attackInterval;
      }

      attackGuard += 1;
    }
  }

  /*
   * 몬스터 재등장 또는 플레이어 부활 대기
   */
  function updateWaiting(
    scaledDelta
  ) {
    if (
      runtime.status ===
      "player-dead"
    ) {
      runtime.reviveTimer =
        Math.max(
          0,
          runtime.reviveTimer -
            scaledDelta
        );

      if (
        runtime.reviveTimer <= 0
      ) {
        revivePlayer();
      }

      return;
    }

    runtime.respawnTimer =
      Math.max(
        0,
        runtime.respawnTimer -
          scaledDelta
      );

    if (
      runtime.respawnTimer <= 0 &&
      !runtime.currentMonster
    ) {
      spawnMonster();
    }
  }

  function initialize() {
    if (runtime.initialized) {
      return getRuntimeSnapshot();
    }

    const gameState =
      State.getState();

    runtime.initialized = true;
    runtime.status = "idle";
    runtime.currentMonster = null;
    runtime.spawnSequence = 0;

    if (
      gameState.player.currentHp <= 0
    ) {
      State.revivePlayer();
    }

    spawnMonster();

    emit("initialized", {
      gameVersion:
        CONFIG.GAME_VERSION
    });

    return getRuntimeSnapshot();
  }

  /*
   * 게임 초기화 버튼 사용 후
   * 전투 임시 상태도 함께 초기화한다.
   */
  function resetRuntime() {
    runtime.initialized = false;
    runtime.status = "idle";
    runtime.currentMonster = null;

    runtime.playerAttackTimer = 0;
    runtime.monsterAttackTimer = 0;
    runtime.respawnTimer = 0;
    runtime.reviveTimer = 0;

    runtime.spawnSequence = 0;
    runtime.totalCombatTime = 0;

    runtime.lastPlayerDamage = 0;
    runtime.lastMonsterDamage = 0;

    runtime.lastAttackWasCritical =
      false;

    emit("runtime-reset", null);

    return initialize();
  }

  /*
   * main.js의 requestAnimationFrame에서 호출한다.
   *
   * deltaSeconds는 실제 경과 시간이며
   * 전투 배속은 이 함수 내부에서 적용한다.
   */
  function update(deltaSeconds) {
    if (!runtime.initialized) {
      initialize();
    }

    const gameState =
      State.getState();

    const realDelta =
      finiteNumber(
        deltaSeconds,
        0,
        0,
        CONFIG.MAX_DELTA_MS /
          1000
      );

    if (realDelta <= 0) {
      return getRuntimeSnapshot();
    }

    if (
      gameState.settings.paused
    ) {
      return getRuntimeSnapshot();
    }

    /*
     * 플레이 시간은 배속과 무관한 실제 시간으로 기록한다.
     */
    State.addPlayTime(
      realDelta
    );

    runtime.totalCombatTime +=
      realDelta;

    const speed =
      CONFIG.SPEED_OPTIONS.includes(
        Number(
          gameState.settings.speed
        )
      )
        ? Number(
            gameState.settings.speed
          )
        : CONFIG.DEFAULT_SPEED;

    const scaledDelta =
      realDelta * speed;

    if (
      runtime.status ===
      "fighting"
    ) {
      updateFighting(
        scaledDelta
      );
    } else {
      updateWaiting(
        scaledDelta
      );
    }

    return getRuntimeSnapshot();
  }

  function getCurrentMonster() {
    return runtime.currentMonster;
  }

  function getCurrentMonsterSnapshot() {
    return clone(
      runtime.currentMonster
    );
  }

  function getRuntimeSnapshot() {
    return {
      initialized:
        runtime.initialized,

      status:
        runtime.status,

      currentMonster:
        clone(
          runtime.currentMonster
        ),

      playerAttackTimer:
        runtime.playerAttackTimer,

      monsterAttackTimer:
        runtime.monsterAttackTimer,

      respawnTimer:
        runtime.respawnTimer,

      reviveTimer:
        runtime.reviveTimer,

      totalCombatTime:
        runtime.totalCombatTime,

      lastPlayerDamage:
        runtime.lastPlayerDamage,

      lastMonsterDamage:
        runtime.lastMonsterDamage,

      lastAttackWasCritical:
        runtime.lastAttackWasCritical
    };
  }

  function isPlayerAlive() {
    return (
      State.getState()
        .player.currentHp > 0
    );
  }

  function isMonsterAlive() {
    return Boolean(
      runtime.currentMonster &&
      runtime
        .currentMonster
        .currentHp > 0
    );
  }

  global.GameCombat = {
    initialize: initialize,
    update: update,

    resetRuntime:
      resetRuntime,

    subscribe: subscribe,

    getCurrentMonster:
      getCurrentMonster,

    getCurrentMonsterSnapshot:
      getCurrentMonsterSnapshot,

    getRuntimeSnapshot:
      getRuntimeSnapshot,

    isPlayerAlive:
      isPlayerAlive,

    isMonsterAlive:
      isMonsterAlive,

    calculateReducedDamage:
      calculateReducedDamage
  };
})(window);
