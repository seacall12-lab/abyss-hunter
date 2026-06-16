(function (global) {
  "use strict";

  ["GameData", "GameState"].forEach(function (name) {
    if (!global[name]) {
      throw new Error(name + " must be loaded before combat.js");
    }
  });

  const Data = global.GameData;
  const State = global.GameState;
  const CONFIG = Data.CONFIG;
  const listeners = new Set();

  const runtime = {
    initialized: false,
    status: "idle",
    currentMonster: null,
    spawnIndex: 0,
    playerAttackTimer: 0,
    monsterAttackTimer: 0,
    respawnTimer: 0,
    reviveTimer: 0
  };

  const bossRuntime = {
    active: false,
    status: "idle",
    result: null,
    rewardGranted: false,
    boss: null,
    timeRemaining: 0,
    elapsed: 0,
    playerAttackTimer: 0,
    bossAttackTimer: 0,
    patternTimer: 0,
    warningTimer: 0,
    warningActive: false,
    guardTimer: 0,
    cooldowns: {
      smash: 0,
      guard: 0,
      potion: 0,
      ultimate: 0
    },
    potionUses: 0,
    ultimateGauge: 0,
    normalPausedBeforeBoss: false
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function emit(type, payload) {
    listeners.forEach(function (listener) {
      try {
        listener({
          type: type,
          payload: payload || null,
          runtime: getRuntimeSnapshot()
        });
      } catch (error) {
        console.error("Combat listener failed", error);
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

  function calculateReducedDamage(rawDamage, defense) {
    const damage = Math.max(1, Number(rawDamage) || 1);
    const mitigation = Math.max(0, Number(defense) || 0);
    return Math.max(1, Math.round(damage * (100 / (100 + mitigation * 5))));
  }

  function getPlayerAttackInterval() {
    const attackSpeed = Data.clamp(State.getState().player.attackSpeed, 0.2, 5);
    return 1 / attackSpeed;
  }

  function rollPlayerDamage(target, options) {
    const player = State.getState().player;
    const settings = options || {};
    const targetDefense = target && target.defense ? target.defense : 0;
    const targetIsBoss = Boolean(target && target.isBoss);
    const damageBonus = targetIsBoss ? player.bossDamage : player.normalDamage;
    const multiplier = settings.multiplier || 1;
    const critical = Math.random() < player.critChance;
    const variance = Data.randomRange(0.92, 1.08);
    let raw = player.attack * multiplier * variance * (1 + damageBonus);
    if (critical) {
      raw *= player.critDamage;
    }
    return {
      damage: calculateReducedDamage(raw, targetDefense),
      critical: critical
    };
  }

  function spawnMonster() {
    const state = State.getState();
    runtime.currentMonster = Data.buildMonster(
      state.progression.currentRegionId,
      state.progression.currentWave,
      runtime.spawnIndex
    );
    runtime.spawnIndex += 1;
    runtime.playerAttackTimer = getPlayerAttackInterval();
    runtime.monsterAttackTimer = runtime.currentMonster.attackInterval;
    runtime.status = "fighting";
    emit("monster-spawn", { monster: clone(runtime.currentMonster) });
  }

  function initialize() {
    if (runtime.initialized) {
      return true;
    }
    runtime.initialized = true;
    resetRuntime();
    return true;
  }

  function resetRuntime() {
    runtime.status = "idle";
    runtime.currentMonster = null;
    runtime.spawnIndex = 0;
    runtime.playerAttackTimer = 0;
    runtime.monsterAttackTimer = 0;
    runtime.respawnTimer = 0;
    runtime.reviveTimer = 0;
    if (State.getState().player.currentHp <= 0) {
      State.revivePlayer();
    }
    spawnMonster();
    return true;
  }

  function isPlayerAlive() {
    return State.getState().player.currentHp > 0;
  }

  function isMonsterAlive() {
    return Boolean(runtime.currentMonster && runtime.currentMonster.currentHp > 0);
  }

  function getCurrentMonster() {
    return runtime.currentMonster;
  }

  function getCurrentMonsterSnapshot() {
    return runtime.currentMonster ? clone(runtime.currentMonster) : null;
  }

  function awardMonsterRewards(defeatedMonster) {
    const expResult = State.addExperience(defeatedMonster.expReward);
    const gold = State.addGold(defeatedMonster.goldReward);
    const progress = State.recordMonsterKill();
    let drop = null;
    if (global.GameLoot) {
      drop = global.GameLoot.rollDrop({
        wave: defeatedMonster.wave,
        playerLevel: State.getState().player.level,
        isBoss: false
      });
    }
    emit("monster-defeated", {
      monster: clone(defeatedMonster),
      exp: expResult,
      gold: gold,
      progress: progress,
      drop: drop
    });
  }

  function playerAttackMonster() {
    if (!runtime.currentMonster || runtime.currentMonster.currentHp <= 0 || !isPlayerAlive()) {
      return;
    }
    const result = rollPlayerDamage(runtime.currentMonster, { multiplier: 1 });
    runtime.currentMonster.currentHp = Math.max(0, runtime.currentMonster.currentHp - result.damage);
    State.recordPlayerDamageDealt(result.damage, result.critical);
    const player = State.getState().player;
    if (player.lifesteal > 0) {
      State.healPlayer(Math.round(result.damage * player.lifesteal));
    }
    emit("player-attack", {
      target: "monster",
      damage: result.damage,
      critical: result.critical,
      monster: clone(runtime.currentMonster)
    });
    if (runtime.currentMonster.currentHp <= 0) {
      const defeatedMonster = runtime.currentMonster;
      runtime.currentMonster = null;
      runtime.status = "monster-dead";
      runtime.respawnTimer = Data.CONFIG.MONSTER_RESPAWN_DELAY_MS / 1000;
      awardMonsterRewards(defeatedMonster);
    }
  }

  function monsterAttackPlayer() {
    if (!runtime.currentMonster || runtime.currentMonster.currentHp <= 0 || !isPlayerAlive()) {
      return;
    }
    const damage = calculateReducedDamage(
      runtime.currentMonster.attack * Data.randomRange(0.92, 1.08),
      State.getState().player.defense
    );
    const actual = State.damagePlayer(damage);
    emit("monster-attack", {
      damage: actual,
      monster: clone(runtime.currentMonster)
    });
    if (!isPlayerAlive()) {
      runtime.status = "player-dead";
      runtime.reviveTimer = Data.CONFIG.PLAYER_REVIVE_DELAY_MS / 1000;
      emit("player-defeated", null);
    }
  }

  function updateNormalCombat(deltaSeconds) {
    const state = State.getState();
    if (state.settings.paused || bossRuntime.active) {
      return;
    }
    if (!runtime.currentMonster && runtime.status !== "player-dead") {
      runtime.respawnTimer -= deltaSeconds;
      if (runtime.respawnTimer <= 0) {
        spawnMonster();
      }
      return;
    }
    if (!isPlayerAlive()) {
      runtime.status = "player-dead";
      runtime.reviveTimer -= deltaSeconds;
      if (runtime.reviveTimer <= 0) {
        State.revivePlayer();
        runtime.status = "idle";
        spawnMonster();
      }
      return;
    }
    if (!runtime.currentMonster) {
      return;
    }
    runtime.playerAttackTimer -= deltaSeconds;
    runtime.monsterAttackTimer -= deltaSeconds;
    while (runtime.playerAttackTimer <= 0 && runtime.currentMonster && runtime.currentMonster.currentHp > 0 && isPlayerAlive()) {
      playerAttackMonster();
      runtime.playerAttackTimer += getPlayerAttackInterval();
    }
    while (runtime.monsterAttackTimer <= 0 && runtime.currentMonster && runtime.currentMonster.currentHp > 0 && isPlayerAlive()) {
      monsterAttackPlayer();
      runtime.monsterAttackTimer += runtime.currentMonster.attackInterval;
    }
  }

  function resetBossRuntime() {
    bossRuntime.active = false;
    bossRuntime.status = "idle";
    bossRuntime.result = null;
    bossRuntime.rewardGranted = false;
    bossRuntime.boss = null;
    bossRuntime.timeRemaining = 0;
    bossRuntime.elapsed = 0;
    bossRuntime.playerAttackTimer = 0;
    bossRuntime.bossAttackTimer = 0;
    bossRuntime.patternTimer = 0;
    bossRuntime.warningTimer = 0;
    bossRuntime.warningActive = false;
    bossRuntime.guardTimer = 0;
    bossRuntime.cooldowns.smash = 0;
    bossRuntime.cooldowns.guard = 0;
    bossRuntime.cooldowns.potion = 0;
    bossRuntime.cooldowns.ultimate = 0;
    bossRuntime.potionUses = 0;
    bossRuntime.ultimateGauge = 0;
  }

  function startBossBattle(bossId) {
    const boss = Data.getBoss(bossId || State.getState().boss.selectedBossId);
    if (bossRuntime.active) {
      return { success: false, reason: "already-active" };
    }
    if (!State.isBossUnlocked(boss.id)) {
      return { success: false, reason: "locked", boss: boss };
    }
    resetBossRuntime();
    bossRuntime.active = true;
    bossRuntime.status = "fighting";
    bossRuntime.result = null;
    bossRuntime.boss = Data.buildBoss(boss.id);
    bossRuntime.timeRemaining = boss.timeLimit;
    bossRuntime.elapsed = 0;
    bossRuntime.playerAttackTimer = getPlayerAttackInterval();
    bossRuntime.bossAttackTimer = boss.attackInterval;
    bossRuntime.patternTimer = boss.pattern.firstDelay;
    bossRuntime.warningTimer = 0;
    bossRuntime.warningActive = false;
    bossRuntime.potionUses = Data.BOSS_SKILLS.potion.uses;
    bossRuntime.normalPausedBeforeBoss = State.getState().settings.paused;
    if (State.getState().player.currentHp <= 0) {
      State.revivePlayer();
    }
    State.setSelectedBoss(boss.id);
    State.recordBossAttempt(boss.id);
    emit("boss-start", { boss: clone(bossRuntime.boss) });
    return { success: true, boss: clone(bossRuntime.boss) };
  }

  function finishBossBattle(resultType) {
    if (!bossRuntime.active || bossRuntime.status === "result") {
      return null;
    }
    const boss = Data.getBoss(bossRuntime.boss.templateId);
    bossRuntime.status = "result";
    bossRuntime.active = false;
    bossRuntime.warningActive = false;
    const clearTime = Math.max(0, boss.timeLimit - bossRuntime.timeRemaining);
    const record = State.recordBossResult(boss.id, resultType, clearTime);
    let rewards = null;
    if (resultType === "victory" && !bossRuntime.rewardGranted) {
      bossRuntime.rewardGranted = true;
      const firstClear = record.firstClear;
      const bonus = firstClear ? boss.firstClearReward : { gold: 0, enhancementStone: 0 };
      const exp = State.addExperience(boss.expReward);
      const gold = State.addGold(boss.goldReward + (bonus.gold || 0));
      const stones = State.addEnhancementStone(boss.stoneReward + (bonus.enhancementStone || 0));
      const item = global.GameLoot
        ? global.GameLoot.grantBossReward(boss.id, { firstClear: firstClear })
        : null;
      rewards = {
        exp: exp,
        gold: gold,
        enhancementStone: stones,
        item: item,
        firstClear: firstClear
      };
    }
    bossRuntime.result = {
      type: resultType,
      bossId: boss.id,
      clearTime: clearTime,
      firstClear: record.firstClear,
      rewards: rewards
    };
    emit("boss-end", bossRuntime.result);
    return bossRuntime.result;
  }

  function bossDealDamage(multiplier, source) {
    if (!bossRuntime.boss || bossRuntime.boss.currentHp <= 0 || !isPlayerAlive()) {
      return 0;
    }
    const rawDamage = bossRuntime.boss.attack * (multiplier || 1) * Data.randomRange(0.94, 1.08);
    let damage = calculateReducedDamage(rawDamage, State.getState().player.defense);
    const guarded = bossRuntime.guardTimer > 0;
    if (guarded) {
      const reduction = source === "pattern"
        ? Data.BOSS_SKILLS.guard.warningReduction
        : Data.BOSS_SKILLS.guard.normalReduction;
      damage = Math.max(1, Math.round(damage * (1 - reduction)));
    }
    const actual = State.damagePlayer(damage);
    bossRuntime.ultimateGauge = Data.clamp(
      bossRuntime.ultimateGauge + actual * Data.BOSS_SKILLS.damageTakenGaugeGain,
      0,
      100
    );
    emit("boss-player-hit", {
      damage: actual,
      guarded: guarded,
      source: source || "basic"
    });
    if (!isPlayerAlive()) {
      finishBossBattle("defeat");
    }
    return actual;
  }

  function playerAttackBoss(multiplier, source) {
    if (!bossRuntime.boss || bossRuntime.boss.currentHp <= 0 || !isPlayerAlive()) {
      return 0;
    }
    const result = rollPlayerDamage(bossRuntime.boss, { multiplier: multiplier || 1 });
    bossRuntime.boss.currentHp = Math.max(0, bossRuntime.boss.currentHp - result.damage);
    State.recordPlayerDamageDealt(result.damage, result.critical);
    const player = State.getState().player;
    if (player.lifesteal > 0) {
      State.healPlayer(Math.round(result.damage * player.lifesteal));
    }
    if (source === "basic") {
      bossRuntime.ultimateGauge = Data.clamp(
        bossRuntime.ultimateGauge + Data.BOSS_SKILLS.basicAttackGaugeGain,
        0,
        100
      );
    }
    emit("boss-damage", {
      damage: result.damage,
      critical: result.critical,
      source: source || "basic",
      boss: clone(bossRuntime.boss)
    });
    if (bossRuntime.boss.currentHp <= 0) {
      finishBossBattle("victory");
    }
    return result.damage;
  }

  function updateCooldowns(deltaSeconds) {
    Object.keys(bossRuntime.cooldowns).forEach(function (key) {
      bossRuntime.cooldowns[key] = Math.max(0, bossRuntime.cooldowns[key] - deltaSeconds);
    });
    bossRuntime.guardTimer = Math.max(0, bossRuntime.guardTimer - deltaSeconds);
  }

  function updateBossBattle(deltaSeconds) {
    if (!bossRuntime.active || bossRuntime.status !== "fighting") {
      return;
    }
    updateCooldowns(deltaSeconds);
    bossRuntime.elapsed += deltaSeconds;
    bossRuntime.timeRemaining = Math.max(0, bossRuntime.timeRemaining - deltaSeconds);
    if (bossRuntime.timeRemaining <= 0) {
      finishBossBattle("timeout");
      return;
    }

    bossRuntime.playerAttackTimer -= deltaSeconds;
    while (bossRuntime.playerAttackTimer <= 0 && bossRuntime.active && bossRuntime.boss.currentHp > 0 && isPlayerAlive()) {
      playerAttackBoss(1, "basic");
      bossRuntime.playerAttackTimer += getPlayerAttackInterval();
    }

    bossRuntime.bossAttackTimer -= deltaSeconds;
    while (bossRuntime.bossAttackTimer <= 0 && bossRuntime.active && bossRuntime.boss.currentHp > 0 && isPlayerAlive()) {
      bossDealDamage(1, "basic");
      bossRuntime.bossAttackTimer += bossRuntime.boss.attackInterval;
    }

    if (!bossRuntime.active) {
      return;
    }
    if (bossRuntime.warningActive) {
      bossRuntime.warningTimer -= deltaSeconds;
      if (bossRuntime.warningTimer <= 0) {
        bossRuntime.warningActive = false;
        bossDealDamage(bossRuntime.boss.pattern.damageMultiplier, "pattern");
        bossRuntime.patternTimer = bossRuntime.boss.pattern.interval;
        emit("boss-warning-end", null);
      }
    } else {
      bossRuntime.patternTimer -= deltaSeconds;
      if (bossRuntime.patternTimer <= 0) {
        bossRuntime.warningActive = true;
        bossRuntime.warningTimer = bossRuntime.boss.pattern.warningDuration;
        emit("boss-warning", {
          pattern: bossRuntime.boss.pattern
        });
      }
    }
  }

  function useBossSkill(skillId) {
    if (!bossRuntime.active || bossRuntime.status !== "fighting") {
      return { success: false, reason: "no-active-battle" };
    }
    const player = State.getState().player;
    if (skillId === "smash") {
      if (bossRuntime.cooldowns.smash > 0) {
        return { success: false, reason: "cooldown" };
      }
      bossRuntime.cooldowns.smash = Data.BOSS_SKILLS.smash.cooldown;
      const damage = playerAttackBoss(Data.BOSS_SKILLS.smash.damageMultiplier, "smash");
      bossRuntime.ultimateGauge = Data.clamp(
        bossRuntime.ultimateGauge + Data.BOSS_SKILLS.smash.ultimateGain,
        0,
        100
      );
      emit("boss-skill", { skill: "smash", damage: damage });
      return { success: true, skill: "smash", damage: damage };
    }
    if (skillId === "guard") {
      if (bossRuntime.cooldowns.guard > 0) {
        return { success: false, reason: "cooldown" };
      }
      bossRuntime.cooldowns.guard = Data.BOSS_SKILLS.guard.cooldown;
      bossRuntime.guardTimer = Data.BOSS_SKILLS.guard.duration;
      emit("boss-skill", { skill: "guard" });
      return { success: true, skill: "guard" };
    }
    if (skillId === "potion") {
      if (bossRuntime.cooldowns.potion > 0) {
        return { success: false, reason: "cooldown" };
      }
      if (bossRuntime.potionUses <= 0) {
        return { success: false, reason: "no-uses" };
      }
      if (player.currentHp >= player.maxHp) {
        return { success: false, reason: "hp-full" };
      }
      bossRuntime.cooldowns.potion = Data.BOSS_SKILLS.potion.cooldown;
      bossRuntime.potionUses -= 1;
      const healed = State.healPlayer(Math.round(player.maxHp * Data.BOSS_SKILLS.potion.healRatio));
      emit("boss-skill", { skill: "potion", healed: healed });
      return { success: true, skill: "potion", healed: healed };
    }
    if (skillId === "ultimate") {
      if (bossRuntime.ultimateGauge < Data.BOSS_SKILLS.ultimate.requiredGauge) {
        return { success: false, reason: "gauge-low" };
      }
      bossRuntime.ultimateGauge = 0;
      const damage = playerAttackBoss(Data.BOSS_SKILLS.ultimate.damageMultiplier, "ultimate");
      emit("boss-skill", { skill: "ultimate", damage: damage });
      return { success: true, skill: "ultimate", damage: damage };
    }
    return { success: false, reason: "unknown-skill" };
  }

  function abandonBossBattle() {
    if (!bossRuntime.active) {
      return { success: false, reason: "no-active-battle" };
    }
    const result = finishBossBattle("retreat");
    return { success: true, result: result };
  }

  function update(deltaSeconds) {
    const delta = Math.min(CONFIG.MAX_DELTA_MS / 1000, Math.max(0, Number(deltaSeconds) || 0));
    if (!runtime.initialized) {
      initialize();
    }
    updateBossBattle(delta);
    updateNormalCombat(delta);
  }

  function getBossSnapshot() {
    return {
      active: bossRuntime.active,
      status: bossRuntime.status,
      result: bossRuntime.result ? clone(bossRuntime.result) : null,
      boss: bossRuntime.boss ? clone(bossRuntime.boss) : null,
      timeRemaining: bossRuntime.timeRemaining,
      elapsed: bossRuntime.elapsed,
      warningActive: bossRuntime.warningActive,
      warningTimer: bossRuntime.warningTimer,
      guardTimer: bossRuntime.guardTimer,
      cooldowns: clone(bossRuntime.cooldowns),
      potionUses: bossRuntime.potionUses,
      ultimateGauge: bossRuntime.ultimateGauge
    };
  }

  function getRuntimeSnapshot() {
    return {
      initialized: runtime.initialized,
      status: runtime.status,
      currentMonster: runtime.currentMonster ? clone(runtime.currentMonster) : null,
      playerAttackTimer: runtime.playerAttackTimer,
      monsterAttackTimer: runtime.monsterAttackTimer,
      respawnTimer: runtime.respawnTimer,
      reviveTimer: runtime.reviveTimer,
      bossBattle: getBossSnapshot()
    };
  }

  global.GameCombat = {
    initialize: initialize,
    update: update,
    resetRuntime: resetRuntime,
    subscribe: subscribe,
    getCurrentMonster: getCurrentMonster,
    getCurrentMonsterSnapshot: getCurrentMonsterSnapshot,
    getRuntimeSnapshot: getRuntimeSnapshot,
    isPlayerAlive: isPlayerAlive,
    isMonsterAlive: isMonsterAlive,
    calculateReducedDamage: calculateReducedDamage,
    startBossBattle: startBossBattle,
    abandonBossBattle: abandonBossBattle,
    useBossSkill: useBossSkill,
    useBossSmash: function () {
      return useBossSkill("smash");
    },
    useBossGuard: function () {
      return useBossSkill("guard");
    },
    useBossPotion: function () {
      return useBossSkill("potion");
    },
    useBossUltimate: function () {
      return useBossSkill("ultimate");
    },
    isBossActive: function () {
      return bossRuntime.active;
    }
  };
})(window);
  
