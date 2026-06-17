(function (global) {
  "use strict";

  ["GameData", "GameState", "GameCombat", "GameLoot"].forEach(function (name) {
    if (!global[name]) {
      throw new Error(name + " must be loaded before ui.js");
    }
  });

  const Data = global.GameData;
  const State = global.GameState;
  const Combat = global.GameCombat;
  const Loot = global.GameLoot;
  const CONFIG = Data.CONFIG;

  const WIDTH = 720;
  const HEIGHT = 720;
  const PLAYER_ATTACK_DURATION = 0.24;
  const MONSTER_ATTACK_DURATION = 0.24;
  const HIT_DURATION = 0.28;
  const FIELD_SHAKE_DURATION = 0.2;
  const BOSS_SMASH_DURATION = 0.36;
  const BOSS_GUARD_FLASH_DURATION = 0.72;
  const BOSS_ULTIMATE_DURATION = 0.92;
  const el = {};
  const cleanups = [];
  const effects = {
    time: 0,
    playerAttack: 0,
    monsterAttack: 0,
    playerHit: 0,
    monsterHit: 0,
    fieldShake: 0,
    criticalFlash: 0,
    lootGlow: 0,
    bossPlayerHit: 0,
    bossHit: 0,
    bossWarning: 0,
    bossSmash: 0,
    bossGuard: 0,
    bossUltimate: 0,
    texts: [],
    bossTexts: [],
    particles: [],
    bossParticles: []
  };

  let initialized = false;
  let canvas = null;
  let ctx = null;
  let bossCanvas = null;
  let bossCtx = null;
  let selectedItemId = null;
  let saveStatusTimer = 0;
  let inventoryDirty = true;
  let forgeDirty = true;
  let salvageDirty = true;
  let bossListDirty = true;
  let bossResultDismissed = false;
  let activeForgePanel = "enhance";
  let audioContext = null;
  let audioUnlocked = false;

  function getElement(id) {
    return document.getElementById(id);
  }

  function cacheElements() {
    const requiredIds = [
      "goldAmount",
      "enhancementStoneAmount",
      "settingsButton",
      "pauseButton",
      "resetButton",
      "playerLevel",
      "playerPower",
      "saveStatus",
      "expText",
      "expFill",
      "inventoryBadge",
      "bossReadyBadge",
      "huntView",
      "regionName",
      "waveText",
      "totalKills",
      "battlefield",
      "gameCanvas",
      "pauseOverlay",
      "levelUpBanner",
      "playerName",
      "playerHpText",
      "playerHpFill",
      "monsterTypeLabel",
      "monsterName",
      "monsterHpText",
      "monsterHpFill",
      "attackStat",
      "defenseStat",
      "attackSpeedStat",
      "critStat",
      "critDamageStat",
      "lifestealStat",
      "bossDamageStat",
      "goldBonusStat",
      "inventoryCount",
      "lootPreview",
      "clearLogButton",
      "statsSheetButton",
      "logSheetButton",
      "recentCombatLog",
      "battleLog",
      "equipmentView",
      "equipmentPower",
      "autoEquipButton",
      "equipmentGrid",
      "equipmentNotice",
      "inventoryCountLarge",
      "inventoryMaximum",
      "inventorySortButton",
      "slotFilter",
      "rarityFilter",
      "inventoryGrid",
      "inventoryEmpty",
      "forgeView",
      "forgeGoldAmount",
      "forgeStoneAmount",
      "forgeSubTabs",
      "forgeEnhancePanel",
      "forgeInventoryPanel",
      "forgeSalvagePanel",
      "forgeAutoSalvagePanel",
      "enhanceLimitText",
      "forgeSelectedItem",
      "forgeItemIcon",
      "forgeItemName",
      "forgeItemMeta",
      "forgeItemLevel",
      "forgeCurrentScore",
      "forgeNextScore",
      "forgeSuccessChance",
      "forgeGoldCost",
      "forgeStoneCost",
      "enhanceButton",
      "enhanceNotice",
      "forgeSortButton",
      "forgeInventoryGrid",
      "forgeInventoryEmpty",
      "salvageSelectAllButton",
      "salvageSelectedCount",
      "salvageExpectedStones",
      "salvageExpectedGold",
      "salvageInventoryGrid",
      "salvageButton",
      "salvageNotice",
      "autoSalvageCommon",
      "autoSalvageRare",
      "autoSalvageEpic",
      "autoSalvageLegendary",
      "bossView",
      "bossSelectPanel",
      "bossRegionName",
      "bossUnlockText",
      "bossBestTime",
      "bossCardList",
      "bossFirstClearReward",
      "bossStartButton",
      "bossBattlePanel",
      "activeBossName",
      "bossTimeText",
      "bossCanvas",
      "bossWarningOverlay",
      "bossWarningText",
      "bossResultOverlay",
      "bossResultEyebrow",
      "bossResultTitle",
      "bossResultDescription",
      "bossResultConfirmButton",
      "bossPlayerName",
      "bossPlayerHpText",
      "bossPlayerHpFill",
      "bossEnemyName",
      "bossEnemyHpText",
      "bossEnemyHpFill",
      "ultimateGaugeText",
      "ultimateGaugeFill",
      "bossSmashButton",
      "bossSmashCooldown",
      "bossGuardButton",
      "bossGuardCooldown",
      "bossPotionButton",
      "bossPotionCount",
      "bossUltimateButton",
      "bossUltimateStatus",
      "bossRetreatButton",
      "itemDetailOverlay",
      "itemDetailBackdrop",
      "itemDetailRarity",
      "itemDetailName",
      "itemDetailMeta",
      "itemDetailCloseButton",
      "itemDetailScore",
      "itemDetailComparison",
      "itemDetailEnhancement",
      "itemDetailLockStatus",
      "itemDetailSalvageValue",
      "itemBaseStatList",
      "itemOptionList",
      "equippedItemPreview",
      "equippedItemName",
      "equippedItemScore",
      "lockItemButton",
      "goToForgeButton",
      "unequipItemButton",
      "equipItemButton",
      "enhanceResultOverlay",
      "enhanceResultIcon",
      "enhanceResultTitle",
      "enhanceResultDescription",
      "statsSheetOverlay",
      "statsSheetBackdrop",
      "statsSheetCloseButton",
      "sheetAttackStat",
      "sheetDefenseStat",
      "sheetAttackSpeedStat",
      "sheetCritStat",
      "sheetCritDamageStat",
      "sheetLifestealStat",
      "sheetBossDamageStat",
      "sheetGoldBonusStat",
      "logSheetOverlay",
      "logSheetBackdrop",
      "logSheetClearButton",
      "logSheetCloseButton",
      "fullBattleLog",
      "settingsSheetOverlay",
      "settingsSheetBackdrop",
      "settingsSheetCloseButton",
      "soundToggle",
      "soundVolume",
      "soundVolumeText",
      "vibrationToggle",
      "screenShakeToggle",
      "reducedEffectsToggle",
      "damageNumbersToggle",
      "toastContainer"
    ];
    const missingIds = [];
    requiredIds.forEach(function (id) {
      const node = getElement(id);
      if (!node) {
        missingIds.push(id);
      }
      el[id] = node;
    });
    if (missingIds.length > 0) {
      throw new Error("Missing UI elements: #" + missingIds.join(", #"));
    }
    el.speedButtons = Array.from(document.querySelectorAll(".speed-button"));
    el.viewTabs = Array.from(document.querySelectorAll(".view-tab[data-view]"));
    el.forgeTabButtons = Array.from(document.querySelectorAll(".forge-sub-tab[data-forge-panel]"));
    el.forgePanels = Array.from(document.querySelectorAll(".forge-content-panel[data-forge-panel]"));
    el.equipmentSlots = Array.from(document.querySelectorAll(".equipment-slot[data-slot]"));
    el.autoSalvageInputs = [
      el.autoSalvageCommon,
      el.autoSalvageRare,
      el.autoSalvageEpic,
      el.autoSalvageLegendary
    ];
    canvas = el.gameCanvas;
    ctx = canvas.getContext("2d", { alpha: false });
    bossCanvas = el.bossCanvas;
    bossCtx = bossCanvas.getContext("2d", { alpha: false });
    if (!ctx || !bossCtx) {
      throw new Error("Canvas 2D context is unavailable");
    }
  }

  function clamp01(value) {
    return Math.min(1, Math.max(0, Number(value) || 0));
  }

  function formatNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return "0";
    }
    if (Math.abs(number) < 1000) {
      return String(Math.round(number));
    }
    if (Math.abs(number) < 1000000) {
      return (number / 1000).toFixed(number >= 10000 ? 0 : 1) + "천";
    }
    if (Math.abs(number) < 1000000000) {
      return (number / 1000000).toFixed(number >= 10000000 ? 0 : 1) + "백만";
    }
    return (number / 1000000000).toFixed(1) + "십억";
  }

  function formatPercent(value) {
    const number = Number(value);
    return Number.isFinite(number) ? (number * 100).toFixed(1) + "%" : "0.0%";
  }

  function formatTime(seconds) {
    if (seconds === null || seconds === undefined || !Number.isFinite(Number(seconds))) {
      return "--:--";
    }
    const safe = Math.max(0, Number(seconds));
    const minutes = Math.floor(safe / 60);
    const remain = safe - minutes * 60;
    return minutes + ":" + remain.toFixed(1).padStart(4, "0");
  }

  function formatReason(reason) {
    const labels = {
      "item-not-found": "장비를 찾을 수 없습니다",
      "invalid-slot": "잘못된 장비 부위입니다",
      "level-too-low": "레벨이 부족합니다",
      "slot-empty": "비어 있는 장비 칸입니다",
      "inventory-full": "인벤토리가 가득 찼습니다",
      "max-level": "이미 최대 강화입니다",
      "not-enough-gold": "골드가 부족합니다",
      "not-enough-stone": "강화석이 부족합니다",
      "not-in-inventory": "인벤토리에 없는 장비입니다",
      equipped: "장착 중인 장비입니다",
      locked: "잠긴 장비입니다",
      "already-active": "이미 전투 중입니다",
      cooldown: "재사용 대기 중입니다",
      "no-active-battle": "진행 중인 보스전이 없습니다",
      "no-uses": "사용 횟수가 없습니다",
      "hp-full": "체력이 이미 가득 찼습니다",
      "gauge-low": "게이지가 부족합니다",
      "unknown-skill": "알 수 없는 스킬입니다"
    };
    return labels[reason] || reason || "알 수 없는 이유";
  }

  function formatBossResult(type) {
    if (type === "victory") {
      return "승리";
    }
    if (type === "timeout") {
      return "시간 초과";
    }
    if (type === "retreat") {
      return "포기";
    }
    return "패배";
  }

  function setBar(fill, current, maximum) {
    const max = Math.max(1, Number(maximum) || 1);
    const now = Math.min(max, Math.max(0, Number(current) || 0));
    fill.style.width = (now / max * 100).toFixed(2) + "%";
  }

  function clearChildren(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function clearRarityClasses(node) {
    node.classList.remove("rarity-common", "rarity-rare", "rarity-epic", "rarity-legendary");
  }

  function scrollIntoViewSafe(node, options) {
    if (!node || typeof node.scrollIntoView !== "function") {
      return;
    }
    const settings = Object.assign({ behavior: "smooth", block: "start", inline: "nearest" }, options || {});
    try {
      node.scrollIntoView(settings);
    } catch (error) {
      node.scrollIntoView();
    }
  }

  function focusElementSafe(node) {
    if (!node || typeof node.focus !== "function") {
      return;
    }
    try {
      node.focus({ preventScroll: true });
    } catch (error) {
      node.focus();
    }
  }

  function getItemCardById(container, itemId) {
    if (!container || !itemId) {
      return null;
    }
    return Array.from(container.querySelectorAll("[data-item-id]")).find(function (card) {
      return card.dataset.itemId === itemId;
    }) || null;
  }

  function setSaveStatus(text, type) {
    el.saveStatus.textContent = text;
    el.saveStatus.classList.remove("saved", "error");
    if (type) {
      el.saveStatus.classList.add(type);
    }
    saveStatusTimer = 2;
  }

  function showToast(message, type) {
    const toast = document.createElement("div");
    toast.className = "toast" + (type ? " " + type : "");
    toast.textContent = message;
    el.toastContainer.appendChild(toast);
    window.setTimeout(function () {
      toast.classList.add("hide");
      window.setTimeout(function () {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 250);
    }, 2600);
  }

  function unlockAudio() {
    if (audioUnlocked) {
      return;
    }
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) {
      return;
    }
    try {
      audioContext = audioContext || new AudioContextConstructor();
      if (audioContext.state === "suspended") {
        audioContext.resume();
      }
      audioUnlocked = true;
    } catch (error) {
      audioContext = null;
      audioUnlocked = false;
    }
  }

  function playSound(type) {
    const settings = State.getState().settings;
    if (!settings.soundEnabled || settings.soundVolume <= 0 || !audioContext || !audioUnlocked) {
      return;
    }
    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    const oscillator = audioContext.createOscillator();
    const volume = Math.max(0, Math.min(1, settings.soundVolume));
    const table = {
      attack: [220, 0.045, "square", 0.08],
      crit: [520, 0.09, "sawtooth", 0.14],
      hit: [120, 0.065, "triangle", 0.11],
      loot: [760, 0.12, "sine", 0.12],
      enhanceSuccess: [880, 0.16, "sine", 0.14],
      enhanceFail: [160, 0.14, "triangle", 0.12],
      salvage: [300, 0.11, "square", 0.1],
      warning: [96, 0.18, "sawtooth", 0.13],
      bossSmash: [340, 0.08, "square", 0.1],
      guard: [520, 0.1, "triangle", 0.09],
      potion: [720, 0.11, "sine", 0.08],
      ultimate: [980, 0.28, "sawtooth", 0.17],
      guardBlock: [420, 0.075, "triangle", 0.075],
      bossKill: [640, 0.24, "sine", 0.16],
      tap: [440, 0.035, "sine", 0.05]
    };
    const spec = table[type] || table.tap;
    oscillator.frequency.setValueAtTime(spec[0], now);
    oscillator.type = spec[2];
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, spec[3] * volume), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + spec[1]);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + spec[1] + 0.02);
  }

  function vibrate(pattern) {
    const settings = State.getState().settings;
    if (!settings.vibrationEnabled || !navigator.vibrate) {
      return;
    }
    try {
      navigator.vibrate(pattern);
    } catch (error) {
      return;
    }
  }

  function screenShake(strong) {
    const settings = State.getState().settings;
    if (!settings.screenShakeEnabled || settings.reducedEffects) {
      return;
    }
    const node = document.getElementById("app");
    if (!node) {
      return;
    }
    node.classList.remove("screen-shake", "screen-shake-strong");
    void node.offsetWidth;
    node.classList.add(strong ? "screen-shake-strong" : "screen-shake");
  }

  function addBattleLog(message, type) {
    const row = document.createElement("li");
    row.className = type || "info";
    row.textContent = message;
    el.battleLog.insertBefore(row, el.battleLog.firstChild);
    if (el.recentCombatLog) {
      const recentRow = row.cloneNode(true);
      el.recentCombatLog.insertBefore(recentRow, el.recentCombatLog.firstChild);
      while (el.recentCombatLog.children.length > 3) {
        el.recentCombatLog.removeChild(el.recentCombatLog.lastChild);
      }
    }
    if (el.fullBattleLog) {
      const fullRow = row.cloneNode(true);
      el.fullBattleLog.insertBefore(fullRow, el.fullBattleLog.firstChild);
      while (el.fullBattleLog.children.length > CONFIG.MAX_BATTLE_LOGS) {
        el.fullBattleLog.removeChild(el.fullBattleLog.lastChild);
      }
    }
    while (el.battleLog.children.length > CONFIG.MAX_BATTLE_LOGS) {
      el.battleLog.removeChild(el.battleLog.lastChild);
    }
  }

  function renderPlayer() {
    const state = State.getState();
    const player = state.player;
    el.playerLevel.textContent = String(player.level);
    el.playerPower.textContent = "전투력 " + formatNumber(player.power);
    el.goldAmount.textContent = formatNumber(state.currencies.gold);
    el.enhancementStoneAmount.textContent = formatNumber(state.currencies.enhancementStone);
    el.expText.textContent = formatNumber(player.exp) + " / " + formatNumber(player.expToNext);
    setBar(el.expFill, player.exp, player.expToNext);
    el.playerName.textContent = player.name;
    el.playerHpText.textContent = formatNumber(player.currentHp) + " / " + formatNumber(player.maxHp);
    setBar(el.playerHpFill, player.currentHp, player.maxHp);
    el.attackStat.textContent = String(Math.round(player.attack * 10) / 10);
    el.defenseStat.textContent = String(Math.round(player.defense * 10) / 10);
    el.attackSpeedStat.textContent = player.attackSpeed.toFixed(2) + "/s";
    el.critStat.textContent = formatPercent(player.critChance);
    el.critDamageStat.textContent = formatPercent(player.critDamage);
    el.lifestealStat.textContent = formatPercent(player.lifesteal);
    el.bossDamageStat.textContent = formatPercent(player.bossDamage);
    el.goldBonusStat.textContent = formatPercent(player.goldBonus);
    el.sheetAttackStat.textContent = el.attackStat.textContent;
    el.sheetDefenseStat.textContent = el.defenseStat.textContent;
    el.sheetAttackSpeedStat.textContent = el.attackSpeedStat.textContent;
    el.sheetCritStat.textContent = el.critStat.textContent;
    el.sheetCritDamageStat.textContent = el.critDamageStat.textContent;
    el.sheetLifestealStat.textContent = el.lifestealStat.textContent;
    el.sheetBossDamageStat.textContent = el.bossDamageStat.textContent;
    el.sheetGoldBonusStat.textContent = el.goldBonusStat.textContent;
    const count = state.inventory.length;
    el.inventoryCount.textContent = String(count);
    el.inventoryCountLarge.textContent = String(count);
    el.inventoryMaximum.textContent = String(CONFIG.MAX_INVENTORY);
    el.inventoryBadge.textContent = String(count);
    el.inventoryBadge.hidden = count <= 0;
  }

  function renderProgression() {
    const state = State.getState();
    const progress = state.progression;
    const region = Data.getRegion(progress.currentRegionId);
    el.regionName.textContent = region.name;
    el.waveText.textContent = "웨이브 " + progress.currentWave + " · " + progress.defeatedInWave + "/" + CONFIG.MONSTERS_PER_WAVE;
    el.totalKills.textContent = formatNumber(state.statistics.totalKills);
  }

  function renderMonster() {
    const runtime = Combat.getRuntimeSnapshot();
    const monster = runtime.currentMonster;
    if (!monster) {
      el.monsterTypeLabel.textContent = runtime.status === "player-dead" ? "회복 중" : "다음 몬스터";
      el.monsterName.textContent = runtime.status === "player-dead" ? "플레이어 쓰러짐" : "등장 준비";
      el.monsterHpText.textContent = "0 / 0";
      setBar(el.monsterHpFill, 0, 1);
      return;
    }
    el.monsterTypeLabel.textContent = "몬스터";
    el.monsterName.textContent = monster.name;
    el.monsterHpText.textContent = formatNumber(monster.currentHp) + " / " + formatNumber(monster.maxHp);
    setBar(el.monsterHpFill, monster.currentHp, monster.maxHp);
  }

  function renderSettings() {
    const settings = State.getState().settings;
    el.speedButtons.forEach(function (button) {
      const active = Number(button.dataset.speed) === settings.speed;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    el.pauseButton.textContent = settings.paused ? "재개" : "정지";
    el.pauseButton.title = settings.paused ? "재개" : "일시정지";
    el.pauseOverlay.hidden = !settings.paused;
    el.soundToggle.checked = Boolean(settings.soundEnabled);
    el.soundVolume.value = String(settings.soundVolume);
    el.soundVolumeText.textContent = Math.round(settings.soundVolume * 100) + "%";
    el.vibrationToggle.checked = Boolean(settings.vibrationEnabled);
    el.screenShakeToggle.checked = Boolean(settings.screenShakeEnabled);
    el.reducedEffectsToggle.checked = Boolean(settings.reducedEffects);
    el.damageNumbersToggle.checked = Boolean(settings.showDamageNumbers);
    el.viewTabs.forEach(function (button) {
      const active = button.dataset.view === settings.activeView;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    CONFIG.VIEW_IDS.forEach(function (viewId) {
      const view = el[viewId + "View"];
      if (view) {
        view.hidden = settings.activeView !== viewId;
        view.classList.toggle("active", settings.activeView === viewId);
      }
    });
  }

  function renderLootPreview() {
    const item = State.getState().recentLoot;
    const container = el.lootPreview;
    clearRarityClasses(container);
    if (!item) {
      container.classList.add("empty");
      container.querySelector("strong").textContent = "획득 장비 없음";
      container.querySelector("small").textContent = "사냥 중 장비를 얻을 수 있습니다.";
      return;
    }
    const rarity = Data.getRarity(item.rarity);
    container.classList.remove("empty");
    container.classList.add("rarity-" + item.rarity);
    container.querySelector("strong").textContent = item.name;
    container.querySelector("small").textContent = rarity.name + " · 점수 " + Loot.getItemScore(item);
  }

  function createItemCard(item, context) {
    const rarity = Data.getRarity(item.rarity);
    const slot = Data.getItemSlot(item.slot);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "item-card rarity-" + item.rarity;
    if (context) {
      card.classList.add(context);
    }
    if (item.locked) {
      card.classList.add("locked");
    }
    if (item.equipped) {
      card.classList.add("equipped");
    }
    card.dataset.itemId = item.id;
    const head = document.createElement("span");
    head.className = "item-card-head";
    const icon = document.createElement("span");
    icon.className = "item-icon";
    icon.textContent = slot ? slot.icon : "?";
    const name = document.createElement("strong");
    name.className = "inventory-card-name";
    name.textContent = item.name;
    head.appendChild(icon);
    head.appendChild(name);
    const meta = document.createElement("small");
    meta.textContent = rarity.name + " · 레벨 " + item.itemLevel + " · 점수 " + Loot.getItemScore(item);
    const tags = document.createElement("span");
    tags.className = "item-tags";
    tags.textContent = (item.enhancement ? "+" + item.enhancement + " " : "+0 ") + (item.locked ? "잠김" : item.equipped ? "장착 중" : "해제됨");
    card.appendChild(head);
    card.appendChild(meta);
    card.appendChild(tags);
    card.style.setProperty("--rarity", rarity.color);
    return card;
  }

  function renderEquipment() {
    const state = State.getState();
    el.equipmentPower.textContent = formatNumber(State.getEquipmentPower());
    el.equipmentSlots.forEach(function (button) {
      const slotId = button.dataset.slot;
      const item = state.equipment[slotId];
      const slot = Data.getItemSlot(slotId);
      const nameNode = button.querySelector(".equipment-item-name");
      const metaNode = button.querySelector(".equipment-item-meta");
      clearRarityClasses(button);
      button.classList.toggle("empty", !item);
      if (!item) {
        nameNode.textContent = "비어 있음";
        metaNode.textContent = slot.name;
        return;
      }
      const rarity = Data.getRarity(item.rarity);
      button.classList.add("rarity-" + item.rarity);
      nameNode.textContent = item.name;
      metaNode.textContent = rarity.name + " · +" + item.enhancement + " · 점수 " + Loot.getItemScore(item) + (item.locked ? " · 잠김" : "");
    });
  }

  function renderInventory(force) {
    if (!force && !inventoryDirty) {
      return;
    }
    inventoryDirty = false;
    const state = State.getState();
    const items = Loot.getVisibleInventory();
    el.slotFilter.value = state.settings.inventorySlotFilter || "all";
    el.rarityFilter.value = state.settings.inventoryRarityFilter || "all";
    el.inventorySortButton.dataset.sort = state.settings.inventorySort || "newest";
    el.inventorySortButton.textContent = Loot.getSortLabel(state.settings.inventorySort || "newest");
    clearChildren(el.inventoryGrid);
    el.inventoryEmpty.hidden = items.length > 0;
    items.forEach(function (item) {
      el.inventoryGrid.appendChild(createItemCard(item, "inventory"));
    });
  }

  function focusInventoryForSlot(slotId) {
    const slot = Data.getItemSlot(slotId);
    State.setInventoryFilters(slotId || "all", "all");
    inventoryDirty = true;
    renderInventory(true);
    const panel = el.inventoryGrid.closest(".inventory-panel");
    const firstCard = el.inventoryGrid.querySelector("[data-item-id]");
    scrollIntoViewSafe(panel || el.inventoryGrid);
    focusElementSafe(firstCard);
    el.equipmentNotice.textContent = slot ? slot.name + " 장비 목록에서 교체할 장비를 선택하세요." : "인벤토리 장비를 선택하세요.";
    if (!firstCard) {
      showToast(slot ? slot.name + " 장비가 없습니다." : "선택할 장비가 없습니다.", "info");
    }
  }

  function createStatRows(target, rows, emptyText) {
    clearChildren(target);
    if (!rows || rows.length === 0) {
      const row = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = emptyText;
      dd.textContent = "";
      row.appendChild(dt);
      row.appendChild(dd);
      target.appendChild(row);
      return;
    }
    rows.forEach(function (rowData) {
      const row = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = rowData.name;
      dd.textContent = Loot.formatStatValue(rowData);
      row.appendChild(dt);
      row.appendChild(dd);
      target.appendChild(row);
    });
  }

  function openItemDetail(itemId) {
    const located = State.findItemById(itemId);
    if (!located) {
      return false;
    }
    const item = located.item;
    selectedItemId = item.id;
    const rarity = Data.getRarity(item.rarity);
    const slot = Data.getItemSlot(item.slot);
    const comparison = Loot.compareWithEquipped(item);
    clearRarityClasses(el.itemDetailOverlay);
    el.itemDetailOverlay.classList.add("rarity-" + item.rarity);
    el.itemDetailRarity.textContent = rarity.name;
    el.itemDetailRarity.style.color = rarity.color;
    el.itemDetailName.textContent = item.name;
    el.itemDetailMeta.textContent = slot.name + " · 레벨 " + item.itemLevel + (located.location === "equipment" ? " · 장착 중" : "");
    el.itemDetailScore.textContent = String(Loot.getItemScore(item));
    el.itemDetailEnhancement.textContent = "+" + item.enhancement;
    el.itemDetailLockStatus.textContent = item.locked ? "잠김" : "해제";
    const salvage = Data.getSalvageReward(item);
    el.itemDetailSalvageValue.textContent = formatNumber(salvage.gold) + "골드 / " + formatNumber(salvage.enhancementStone) + "석";
    el.itemDetailComparison.classList.remove("positive", "negative", "neutral");
    if (located.location === "equipment") {
      el.itemDetailComparison.textContent = "현재 장착 중";
      el.itemDetailComparison.classList.add("neutral");
    } else if (!comparison.equippedItem) {
      el.itemDetailComparison.textContent = "장착 장비 없음";
      el.itemDetailComparison.classList.add("positive");
    } else if (comparison.scoreDifference > 0) {
      el.itemDetailComparison.textContent = "점수 +" + comparison.scoreDifference;
      el.itemDetailComparison.classList.add("positive");
    } else if (comparison.scoreDifference < 0) {
      el.itemDetailComparison.textContent = "점수 " + comparison.scoreDifference;
      el.itemDetailComparison.classList.add("negative");
    } else {
      el.itemDetailComparison.textContent = "점수 동일";
      el.itemDetailComparison.classList.add("neutral");
    }
    createStatRows(el.itemBaseStatList, Loot.getBaseStatRows(item), "기본 능력치 없음");
    createStatRows(el.itemOptionList, Loot.getBonusStatRows(item), "추가 옵션 없음");
    const equippedItem = State.getEquippedItem(item.slot);
    if (equippedItem && equippedItem.id !== item.id) {
      el.equippedItemPreview.hidden = false;
      el.equippedItemName.textContent = equippedItem.name;
      el.equippedItemScore.textContent = "점수 " + Loot.getItemScore(equippedItem);
    } else {
      el.equippedItemPreview.hidden = true;
    }
    const permission = State.canEquipItem(item);
    el.equipItemButton.hidden = located.location === "equipment";
    el.unequipItemButton.hidden = located.location !== "equipment";
    el.equipItemButton.disabled = !permission.allowed;
    el.equipItemButton.textContent = permission.allowed ? "장착" : "필요 레벨 " + (permission.requiredLevel || "?");
    el.lockItemButton.textContent = item.locked ? "잠금 해제" : "잠금";
    el.itemDetailOverlay.hidden = false;
    return true;
  }

  function closeItemDetail() {
    el.itemDetailOverlay.hidden = true;
  }

  function equipSelectedItem() {
    if (!selectedItemId) {
      return;
    }
    const result = State.equipItem(selectedItemId);
    if (result.success) {
      el.equipmentNotice.textContent = result.item.name + " 장착 완료.";
      closeItemDetail();
      inventoryDirty = true;
      forgeDirty = true;
      salvageDirty = true;
      renderAll();
    } else {
      showToast("장착할 수 없습니다: " + formatReason(result.reason), "error");
    }
  }

  function unequipSelectedItem() {
    if (!selectedItemId) {
      return;
    }
    const located = State.findItemById(selectedItemId);
    if (!located) {
      return;
    }
    const result = State.unequipItem(located.slot);
    if (result.success) {
      el.equipmentNotice.textContent = result.item.name + " 해제 완료.";
      closeItemDetail();
      inventoryDirty = true;
      forgeDirty = true;
      salvageDirty = true;
      renderAll();
    } else {
      showToast("해제할 수 없습니다: " + formatReason(result.reason), "error");
    }
  }

  function toggleSelectedLock() {
    if (!selectedItemId) {
      return;
    }
    const located = State.findItemById(selectedItemId);
    if (!located) {
      return;
    }
    const locked = State.setItemLocked(selectedItemId, !located.item.locked);
    showToast(locked ? "장비를 잠갔습니다." : "장비 잠금을 해제했습니다.", "info");
    inventoryDirty = true;
    forgeDirty = true;
    salvageDirty = true;
    openItemDetail(selectedItemId);
  }

  function goToForge() {
    if (selectedItemId) {
      State.setForgeSelectedItem(selectedItemId);
    }
    closeItemDetail();
    State.setActiveView("forge");
    activeForgePanel = "enhance";
    forgeDirty = true;
    salvageDirty = true;
    renderAll();
  }

  function renderEnhanceSelected() {
    const state = State.getState();
    const itemId = state.forge.selectedItemId;
    const located = itemId ? State.findItemById(itemId) : null;
    const item = located ? located.item : null;
    el.forgeGoldAmount.textContent = formatNumber(state.currencies.gold);
    el.forgeStoneAmount.textContent = formatNumber(state.currencies.enhancementStone);
    if (!item) {
      el.forgeSelectedItem.classList.add("empty");
      el.forgeItemIcon.textContent = "?";
      el.forgeItemName.textContent = "장비 선택";
      el.forgeItemMeta.textContent = "아래 목록에서 선택하세요.";
      el.forgeItemLevel.textContent = "+0";
      el.forgeCurrentScore.textContent = "0";
      el.forgeNextScore.textContent = "0";
      el.forgeSuccessChance.textContent = "0%";
      el.forgeGoldCost.textContent = "0";
      el.forgeStoneCost.textContent = "0";
      el.enhanceButton.disabled = true;
      el.enhanceNotice.textContent = "강화할 장비를 선택하세요.";
      return;
    }
    const slot = Data.getItemSlot(item.slot);
    const rarity = Data.getRarity(item.rarity);
    const info = Data.getEnhancementInfo(item);
    const currentScore = Loot.getItemScore(item);
    const simulated = JSON.parse(JSON.stringify(item));
    simulated.enhancement = info.nextLevel;
    simulated.bonusStats = Data.calculateEnhancementStats(simulated.baseStats, simulated.enhancement);
    const nextScore = info.isMax ? currentScore : Loot.getItemScore(simulated);
    el.forgeSelectedItem.classList.remove("empty");
    clearRarityClasses(el.forgeSelectedItem);
    el.forgeSelectedItem.classList.add("rarity-" + item.rarity);
    el.forgeItemIcon.textContent = slot.icon;
    el.forgeItemName.textContent = item.name;
    el.forgeItemMeta.textContent = rarity.name + " · " + slot.name + " · " + (located.location === "equipment" ? "장착 중" : "인벤토리");
    el.forgeItemLevel.textContent = "+" + item.enhancement;
    el.forgeCurrentScore.textContent = String(currentScore);
    el.forgeNextScore.textContent = String(nextScore);
    el.forgeSuccessChance.textContent = info.isMax ? "최대" : Math.round(info.successChance * 100) + "%";
    el.forgeGoldCost.textContent = formatNumber(info.goldCost);
    el.forgeStoneCost.textContent = formatNumber(info.stoneCost);
    el.enhanceButton.disabled = info.isMax || state.currencies.gold < info.goldCost || state.currencies.enhancementStone < info.stoneCost;
    el.enhanceNotice.textContent = info.isMax
      ? "이미 +15까지 강화된 장비입니다."
      : "실패해도 장비는 유지되며 재화만 소모됩니다.";
  }

  function renderForgeInventory(force) {
    if (!force && !forgeDirty) {
      return;
    }
    forgeDirty = false;
    const state = State.getState();
    const items = Loot.getForgeItems();
    el.forgeSortButton.textContent = Loot.getForgeSortLabel(state.forge.sort);
    clearChildren(el.forgeInventoryGrid);
    el.forgeInventoryEmpty.hidden = items.length > 0;
    items.forEach(function (item) {
      const card = createItemCard(item, "forge");
      if (state.forge.selectedItemId === item.id) {
        card.classList.add("selected");
      }
      el.forgeInventoryGrid.appendChild(card);
    });
  }

  function renderSalvage(force) {
    if (!force && !salvageDirty) {
      return;
    }
    salvageDirty = false;
    const state = State.getState();
    const selectedIds = new Set(state.forge.salvageSelectedIds);
    const preview = State.getSalvagePreview();
    clearChildren(el.salvageInventoryGrid);
    state.inventory.forEach(function (item) {
      const reward = Data.getSalvageReward(item);
      const row = document.createElement("button");
      row.type = "button";
      row.className = "salvage-row rarity-" + item.rarity;
      row.dataset.itemId = item.id;
      row.disabled = item.locked || item.equipped;
      if (selectedIds.has(item.id)) {
        row.classList.add("selected");
      }
      const name = document.createElement("strong");
      name.textContent = item.name;
      const meta = document.createElement("span");
      meta.textContent = "+" + item.enhancement + " · 점수 " + Loot.getItemScore(item) + " · " + reward.gold + "골드 / " + reward.enhancementStone + "석";
      const stateText = document.createElement("small");
      stateText.textContent = item.locked ? "잠김" : selectedIds.has(item.id) ? "선택됨" : "눌러서 선택";
      row.appendChild(name);
      row.appendChild(meta);
      row.appendChild(stateText);
      el.salvageInventoryGrid.appendChild(row);
    });
    el.salvageSelectedCount.textContent = String(preview.count);
    el.salvageExpectedGold.textContent = formatNumber(preview.gold);
    el.salvageExpectedStones.textContent = formatNumber(preview.enhancementStone);
    el.salvageButton.disabled = preview.count <= 0;
    el.salvageSelectAllButton.textContent = preview.count > 0 && preview.count === Loot.getSalvageableItems().length ? "전체 해제" : "전체 선택";
  }

  function renderAutoSalvage() {
    const settings = State.getState().settings.autoSalvage;
    el.autoSalvageInputs.forEach(function (input) {
      input.checked = Boolean(settings[input.dataset.rarity]);
    });
  }

  function renderForgePanelVisibility() {
    el.forgeTabButtons.forEach(function (button) {
      const active = button.dataset.forgePanel === activeForgePanel;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    el.forgePanels.forEach(function (panel) {
      panel.hidden = panel.dataset.forgePanel !== activeForgePanel;
    });
  }

  function setActiveForgePanel(panelId) {
    activeForgePanel = panelId === "salvage" || panelId === "auto" ? panelId : "enhance";
    renderForgePanelVisibility();
    renderForge(true);
  }

  function renderForge(force) {
    renderForgePanelVisibility();
    renderEnhanceSelected();
    if (activeForgePanel === "enhance") {
      renderForgeInventory(force);
    } else if (activeForgePanel === "salvage") {
      renderSalvage(force);
    } else if (activeForgePanel === "auto") {
      renderAutoSalvage();
    }
  }

  function focusForgeSelectionList() {
    activeForgePanel = "enhance";
    renderForge(true);
    const items = Loot.getForgeItems();
    const selectedId = State.getState().forge.selectedItemId;
    const selectedCard = getItemCardById(el.forgeInventoryGrid, selectedId);
    const firstCard = el.forgeInventoryGrid.querySelector("[data-item-id]");
    const target = selectedCard || firstCard || el.forgeInventoryPanel;
    scrollIntoViewSafe(target);
    focusElementSafe(selectedCard || firstCard);
    if (items.length === 0) {
      showToast("강화할 장비가 없습니다.", "info");
    }
  }

  function showEnhanceResult(result) {
    const item = result.item;
    el.enhanceResultOverlay.hidden = false;
    el.enhanceResultIcon.textContent = result.enhanced ? "+" : "x";
    el.enhanceResultTitle.textContent = result.enhanced ? "강화 성공" : "강화 실패";
    el.enhanceResultDescription.textContent = result.enhanced
      ? item.name + " +" + item.enhancement + " 달성."
      : "재화만 소모되고 장비는 유지되었습니다.";
    window.setTimeout(function () {
      el.enhanceResultOverlay.hidden = true;
    }, 1100);
  }

  function handleEnhance() {
    const itemId = State.getState().forge.selectedItemId;
    if (!itemId) {
      showToast("먼저 장비를 선택하세요.", "error");
      return;
    }
    const result = State.enhanceItem(itemId);
    if (!result.success) {
      showToast("강화할 수 없습니다: " + formatReason(result.reason), "error");
      return;
    }
    showEnhanceResult(result);
    playSound(result.enhanced ? "enhanceSuccess" : "enhanceFail");
    vibrate(result.enhanced ? [20, 20, 35] : 12);
    if (result.enhanced) {
      screenShake(false);
    }
    addBattleLog(result.enhanced ? "강화 성공: " + result.item.name + " +" + result.afterLevel : "강화 실패: " + result.item.name, result.enhanced ? "reward" : "danger");
    inventoryDirty = true;
    forgeDirty = true;
    salvageDirty = true;
    renderAll();
  }

  function handleSalvage() {
    const result = State.salvageSelectedItems();
    if (!result.success) {
      showToast("분해할 장비가 없습니다.", "error");
      return;
    }
    playSound("salvage");
    vibrate(16);
    showToast(result.items.length + "개 장비를 분해했습니다.", "success");
    addBattleLog("장비 " + result.items.length + "개 분해: 골드 " + result.gold + ", 강화석 " + result.enhancementStone + " 획득.", "reward");
    inventoryDirty = true;
    forgeDirty = true;
    salvageDirty = true;
    renderAll();
  }

  function renderBossList() {
    if (!bossListDirty) {
      return;
    }
    bossListDirty = false;
    const state = State.getState();
    const region = Data.getRegion(state.progression.currentRegionId);
    const selectedBoss = Data.getBoss(state.boss.selectedBossId);
    clearChildren(el.bossCardList);
    Data.getBossList(region.id).forEach(function (boss) {
      const progress = State.getBossProgress(boss.id);
      const unlocked = State.isBossUnlocked(boss.id);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "boss-card";
      card.dataset.bossId = boss.id;
      card.classList.toggle("selected", boss.id === selectedBoss.id);
      card.classList.toggle("locked", !unlocked);
      const title = document.createElement("strong");
      title.textContent = boss.name;
      const meta = document.createElement("span");
      meta.textContent = "웨이브 " + boss.unlockWave + " · 권장 전투력 " + formatNumber(boss.recommendedPower);
      const record = document.createElement("small");
      record.textContent = progress.kills > 0 ? "처치 " + progress.kills + " · 최고 " + formatTime(progress.bestTime) : unlocked ? "도전 가능" : "잠김";
      card.appendChild(title);
      card.appendChild(meta);
      card.appendChild(record);
      el.bossCardList.appendChild(card);
    });
  }

  function renderBoss() {
    const state = State.getState();
    const region = Data.getRegion(state.progression.currentRegionId);
    const boss = Data.getBoss(state.boss.selectedBossId);
    const progress = State.getBossProgress(boss.id);
    const unlocked = State.isBossUnlocked(boss.id);
    const reward = boss.firstClearReward;
    const runtime = Combat.getRuntimeSnapshot().bossBattle;
    renderBossList();
    el.bossRegionName.textContent = region.name;
    el.bossUnlockText.textContent = unlocked
      ? boss.name + " 도전 가능."
      : "웨이브 " + boss.unlockWave + "에 도달하면 " + boss.name + "이 해금됩니다.";
    el.bossBestTime.textContent = formatTime(progress.bestTime);
    el.bossFirstClearReward.textContent = "최초: 골드 " + reward.gold + ", 강화석 " + reward.enhancementStone + ", " + Data.getRarity(reward.rarity).name + " 장비";
    el.bossStartButton.disabled = !unlocked || runtime.active;
    el.bossStartButton.textContent = runtime.active ? "전투 중" : unlocked ? boss.name + " 도전" : "잠김";
    const anyReady = Data.getBossList(region.id).some(function (entry) {
      return State.isBossUnlocked(entry.id);
    });
    el.bossReadyBadge.hidden = !anyReady;
    el.bossSelectPanel.hidden = runtime.active || Boolean(runtime.result && !bossResultDismissed);
    el.bossBattlePanel.hidden = !runtime.active && (!runtime.result || bossResultDismissed);
    renderBossBattle(runtime);
  }

  function renderBossBattle(runtime) {
    const player = State.getState().player;
    const boss = runtime.boss;
    el.bossPlayerName.textContent = player.name;
    el.bossPlayerHpText.textContent = formatNumber(player.currentHp) + " / " + formatNumber(player.maxHp);
    setBar(el.bossPlayerHpFill, player.currentHp, player.maxHp);
    if (boss) {
      el.activeBossName.textContent = boss.name;
      el.bossEnemyName.textContent = boss.name;
      el.bossEnemyHpText.textContent = formatNumber(boss.currentHp) + " / " + formatNumber(boss.maxHp);
      setBar(el.bossEnemyHpFill, boss.currentHp, boss.maxHp);
      el.bossWarningText.textContent = boss.pattern.name;
    } else {
      el.activeBossName.textContent = "보스";
      el.bossEnemyName.textContent = "보스";
      el.bossEnemyHpText.textContent = "0 / 0";
      setBar(el.bossEnemyHpFill, 0, 1);
    }
    el.bossTimeText.textContent = runtime.timeRemaining.toFixed(1);
    el.bossWarningOverlay.hidden = !runtime.warningActive;
    el.bossBattlePanel.classList.toggle("warning-active", runtime.warningActive);
    el.bossBattlePanel.classList.toggle("guard-active", runtime.guardTimer > 0);
    el.ultimateGaugeText.textContent = Math.floor(runtime.ultimateGauge) + "%";
    setBar(el.ultimateGaugeFill, runtime.ultimateGauge, 100);
    renderSkillButton(el.bossSmashButton, el.bossSmashCooldown, runtime.cooldowns.smash, "준비", Data.BOSS_SKILLS.smash.cooldown);
    renderSkillButton(el.bossGuardButton, el.bossGuardCooldown, runtime.cooldowns.guard, runtime.guardTimer > 0 ? "방어 중" : "준비", Data.BOSS_SKILLS.guard.cooldown, runtime.guardTimer > 0);
    renderSkillButton(el.bossPotionButton, el.bossPotionCount, runtime.cooldowns.potion, runtime.potionUses + "회 남음", Data.BOSS_SKILLS.potion.cooldown);
    el.bossPotionButton.disabled = !runtime.active || runtime.potionUses <= 0 || runtime.cooldowns.potion > 0 || player.currentHp >= player.maxHp;
    el.bossUltimateButton.disabled = !runtime.active || runtime.ultimateGauge < 100;
    el.bossUltimateStatus.textContent = runtime.ultimateGauge >= 100 ? "준비" : "게이지 부족";
    el.bossUltimateButton.classList.toggle("ready", runtime.active && runtime.ultimateGauge >= 100);
    el.bossResultOverlay.hidden = true;
    if (runtime.result && !bossResultDismissed) {
      el.bossResultOverlay.hidden = false;
      el.bossResultTitle.textContent = formatBossResult(runtime.result.type);
      const rewards = runtime.result.rewards;
      el.bossResultDescription.textContent = rewards
        ? "보상: 골드 " + rewards.gold + ", 강화석 " + rewards.enhancementStone + "."
        : "획득한 보상이 없습니다.";
    }
  }

  function renderSkillButton(button, label, cooldown, readyText, maxCooldown, activeState) {
    const active = cooldown > 0;
    button.disabled = active || !Combat.getRuntimeSnapshot().bossBattle.active;
    button.classList.toggle("cooling", active);
    button.classList.toggle("active-state", Boolean(activeState));
    label.textContent = active ? cooldown.toFixed(1) + "초" : readyText;
    const mask = button.querySelector(".cooldown-mask");
    if (mask) {
      const ratio = active && maxCooldown ? clamp01(cooldown / maxCooldown) : 0;
      mask.style.transform = "scaleY(" + ratio.toFixed(3) + ")";
    }
  }

  function resizeCanvas() {
    const ratio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    [canvas, bossCanvas].forEach(function (target) {
      if (!target) {
        return;
      }
      const rect = target.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      if (target.width !== width || target.height !== height) {
        target.width = width;
        target.height = height;
      }
    });
  }

  function roundedRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + width - r, y);
    context.quadraticCurveTo(x + width, y, x + width, y + r);
    context.lineTo(x + width, y + height - r);
    context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    context.lineTo(x + r, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
  }

  function easeOutBack(value) {
    const t = clamp01(value);
    const c1 = 1.7;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function getMotionProgress(remaining, duration) {
    if (remaining <= 0 || duration <= 0) {
      return 0;
    }
    return clamp01(1 - remaining / duration);
  }

  function getFieldShakeOffset() {
    const settings = State.getState().settings;
    if (!settings.screenShakeEnabled || settings.reducedEffects || effects.fieldShake <= 0) {
      return { x: 0, y: 0 };
    }
    const power = 1 - clamp01(effects.fieldShake / FIELD_SHAKE_DURATION);
    const amount = (1 - power) * 8 + 2;
    return {
      x: Math.sin(effects.time * 86) * amount,
      y: Math.cos(effects.time * 73) * amount * 0.6
    };
  }

  function pushParticle(list, particle) {
    const settings = State.getState().settings;
    list.push(particle);
    const limit = settings.reducedEffects ? 16 : 48;
    while (list.length > limit) {
      list.shift();
    }
  }

  function addImpactBurst(list, x, y, color, strong) {
    const settings = State.getState().settings;
    const count = settings.reducedEffects ? (strong ? 5 : 3) : (strong ? 14 : 8);
    for (let index = 0; index < count; index += 1) {
      const angle = Data.randomRange(-Math.PI * 0.9, Math.PI * 0.2);
      const speed = Data.randomRange(strong ? 120 : 75, strong ? 260 : 180);
      pushParticle(list, {
        x: x + Data.randomRange(-16, 16),
        y: y + Data.randomRange(-8, 12),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: strong ? Data.randomRange(0.34, 0.52) : Data.randomRange(0.22, 0.38),
        maxLife: strong ? 0.52 : 0.38,
        size: Data.randomRange(strong ? 5 : 3, strong ? 11 : 7),
        color: color || "#f7fbff",
        kind: index % 3 === 0 ? "spark" : "dust"
      });
    }
  }

  function drawParticles(context, list, delta) {
    for (let index = list.length - 1; index >= 0; index -= 1) {
      const item = list[index];
      item.life -= delta;
      item.x += item.vx * delta;
      item.y += item.vy * delta;
      item.vy += 280 * delta;
      if (item.life <= 0) {
        list.splice(index, 1);
        continue;
      }
      const alpha = clamp01(item.life / item.maxLife);
      context.save();
      context.globalAlpha = alpha;
      context.strokeStyle = item.color;
      context.fillStyle = item.color;
      if (item.kind === "spark") {
        context.lineWidth = Math.max(2, item.size * 0.45);
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(item.x, item.y);
        context.lineTo(item.x - item.vx * 0.045, item.y - item.vy * 0.045);
        context.stroke();
      } else {
        context.beginPath();
        context.arc(item.x, item.y, item.size, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }
  }

  function drawSlashArc(context, x, y, progress, color, critical) {
    if (progress <= 0) {
      return;
    }
    const eased = easeOutBack(progress);
    const alpha = Math.max(0, 1 - progress);
    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = color || "#f7fbff";
    context.lineWidth = critical ? 18 : 12;
    context.lineCap = "round";
    context.beginPath();
    context.arc(x, y, 76 + eased * 18, -0.9 + progress * 1.1, 0.25 + progress * 1.1);
    context.stroke();
    if (critical) {
      context.globalAlpha = alpha * 0.35;
      context.lineWidth = 30;
      context.strokeStyle = "#ffe66d";
      context.stroke();
    }
    context.restore();
  }

  function drawImpactRing(context, x, y, progress, color) {
    if (progress <= 0) {
      return;
    }
    const alpha = Math.max(0, 1 - progress);
    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = color || "#ffe66d";
    context.lineWidth = 5;
    context.beginPath();
    context.arc(x, y, 24 + progress * 82, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  function drawBossTelegraph(context, runtime) {
    if (!runtime.warningActive || !runtime.boss) {
      return;
    }
    const duration = Math.max(0.1, runtime.boss.pattern.warningDuration || 1);
    const remain = clamp01(runtime.warningTimer / duration);
    const pulse = 0.5 + Math.sin(effects.time * 18) * 0.5;
    context.save();
    context.globalAlpha = 0.28 + pulse * 0.18;
    context.strokeStyle = "#ff6f79";
    context.lineWidth = 8;
    context.beginPath();
    context.ellipse(WIDTH * 0.24, HEIGHT * 0.6, 120 - remain * 34, 52 - remain * 12, 0, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 0.16 + pulse * 0.12;
    context.fillStyle = "#ff304f";
    context.beginPath();
    context.ellipse(WIDTH * 0.24, HEIGHT * 0.6, 96, 42, 0, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 0.9;
    context.fillStyle = "#fff4f5";
    context.font = "900 34px system-ui, sans-serif";
    context.textAlign = "center";
    context.lineWidth = 5;
    context.strokeStyle = "rgba(0,0,0,0.8)";
    const label = remain <= 0.34 ? "방어!" : runtime.boss.pattern.name;
    context.strokeText(label, WIDTH * 0.5, HEIGHT * 0.18);
    context.fillText(label, WIDTH * 0.5, HEIGHT * 0.18);
    context.restore();
  }

  function drawGuardShield(context, x, y, runtime) {
    const guardActive = runtime.guardTimer > 0;
    const flashActive = effects.bossGuard > 0;
    if (!guardActive && !flashActive) {
      return;
    }
    const flash = clamp01(effects.bossGuard / BOSS_GUARD_FLASH_DURATION);
    const timerRatio = guardActive ? clamp01(runtime.guardTimer / Data.BOSS_SKILLS.guard.duration) : 0;
    const pulse = Math.abs(Math.sin(effects.time * 9));
    context.save();
    context.globalAlpha = 0.28 + Math.max(flash, timerRatio) * 0.34;
    context.strokeStyle = "#8cf0ff";
    context.lineWidth = 7 + flash * 6;
    context.beginPath();
    context.ellipse(x, y + 5, 94 + pulse * 8, 132 + pulse * 10, 0, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 0.12 + flash * 0.16;
    context.fillStyle = "#8cf0ff";
    context.beginPath();
    context.ellipse(x, y + 5, 86, 124, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawBossSmashFlash(context) {
    if (effects.bossSmash <= 0) {
      return;
    }
    const progress = 1 - clamp01(effects.bossSmash / BOSS_SMASH_DURATION);
    drawImpactRing(context, WIDTH * 0.72, HEIGHT * 0.46, progress, "#ffd36a");
    context.save();
    context.globalAlpha = Math.max(0, 1 - progress) * 0.58;
    context.strokeStyle = "#ffd36a";
    context.lineWidth = 12;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(WIDTH * 0.42, HEIGHT * 0.36);
    context.lineTo(WIDTH * 0.76, HEIGHT * 0.58);
    context.stroke();
    context.restore();
  }

  function drawUltimateStrike(context) {
    if (effects.bossUltimate <= 0) {
      return;
    }
    const progress = 1 - clamp01(effects.bossUltimate / BOSS_ULTIMATE_DURATION);
    const alpha = Math.max(0, 1 - progress);
    context.save();
    context.globalAlpha = alpha;
    const beam = context.createLinearGradient(WIDTH * 0.22, HEIGHT * 0.4, WIDTH * 0.76, HEIGHT * 0.43);
    beam.addColorStop(0, "rgba(140,240,255,0.2)");
    beam.addColorStop(0.45, "rgba(255,230,109,0.9)");
    beam.addColorStop(1, "rgba(255,111,121,0.65)");
    context.strokeStyle = beam;
    context.lineWidth = 24 - progress * 10;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(WIDTH * 0.27, HEIGHT * 0.5);
    context.lineTo(WIDTH * 0.75, HEIGHT * 0.43);
    context.stroke();
    context.globalAlpha = alpha * 0.85;
    drawImpactRing(context, WIDTH * 0.74, HEIGHT * 0.42, progress, "#ffe66d");
    context.restore();
  }

  function drawLootGlow(context) {
    if (effects.lootGlow <= 0) {
      return;
    }
    const progress = 1 - clamp01(effects.lootGlow / 0.9);
    const alpha = 1 - progress;
    context.save();
    context.globalAlpha = alpha * 0.72;
    context.fillStyle = "#65df9a";
    context.beginPath();
    context.arc(WIDTH * 0.5, HEIGHT * 0.2, 18 + progress * 55, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = alpha;
    context.font = "900 24px system-ui, sans-serif";
    context.textAlign = "center";
    context.lineWidth = 4;
    context.strokeStyle = "rgba(0,0,0,0.75)";
    context.strokeText("획득", WIDTH * 0.5, HEIGHT * 0.22);
    context.fillStyle = "#f4fff8";
    context.fillText("획득", WIDTH * 0.5, HEIGHT * 0.22);
    context.restore();
  }

  function drawBackground(context, region, warning) {
    const colors = region.background || Data.REGIONS[0].background;
    const gradient = context.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, warning ? "#43202f" : colors.skyTop);
    gradient.addColorStop(0.72, colors.skyBottom);
    gradient.addColorStop(1, colors.ground);
    context.fillStyle = gradient;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.save();
    context.globalAlpha = 0.18;
    context.fillStyle = colors.accent;
    for (let index = 0; index < 7; index += 1) {
      const x = 20 + index * 115;
      const h = 90 + index % 3 * 36;
      context.beginPath();
      context.moveTo(x, 470);
      context.lineTo(x + 38, 470 - h);
      context.lineTo(x + 76, 470);
      context.closePath();
      context.fill();
    }
    context.restore();
  }

  function drawPlayer(context, x, y, hit, attack) {
    const player = State.getState().player;
    const alive = player.currentHp > 0;
    const attackProgress = getMotionProgress(attack, PLAYER_ATTACK_DURATION);
    const attackCurve = attackProgress > 0 ? Math.sin(attackProgress * Math.PI) : 0;
    const shake = hit > 0 ? Math.sin(hit * 90) * 8 : 0;
    context.save();
    context.translate(x + shake + attackCurve * 46, y - attackCurve * 8);
    if (!alive) {
      context.rotate(-0.55);
      context.globalAlpha = 0.55;
    }
    context.fillStyle = "rgba(0,0,0,0.3)";
    context.beginPath();
    context.ellipse(0, 92, 70, 16, 0, 0, Math.PI * 2);
    context.fill();
    const armor = context.createLinearGradient(-45, -40, 45, 75);
    armor.addColorStop(0, "#6fe7ff");
    armor.addColorStop(0.6, "#477ec9");
    armor.addColorStop(1, "#25436f");
    context.fillStyle = armor;
    roundedRect(context, -44, -38, 88, 110, 24);
    context.fill();
    context.strokeStyle = "#d8f7ff";
    context.lineWidth = 5;
    context.stroke();
    context.fillStyle = "#f3d0b0";
    context.beginPath();
    context.arc(0, -68, 32, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#f6fbff";
    context.lineWidth = attackProgress > 0 ? 14 : 12;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(38, 0);
    context.lineTo(98 + attackCurve * 36, -58 + attackCurve * 64);
    context.stroke();
    if (hit > 0) {
      context.globalAlpha = clamp01(hit / HIT_DURATION) * 0.62;
      context.fillStyle = "#ffffff";
      roundedRect(context, -48, -42, 96, 118, 24);
      context.fill();
      context.beginPath();
      context.arc(0, -68, 34, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    drawSlashArc(context, x + 92, y - 8, attackProgress, "#d8f7ff", false);
  }

  function drawEnemy(context, monster, x, y, hit, attack) {
    if (!monster) {
      return;
    }
    const attackProgress = getMotionProgress(attack, MONSTER_ATTACK_DURATION);
    const attackCurve = attackProgress > 0 ? Math.sin(attackProgress * Math.PI) : 0;
    const shake = hit > 0 ? Math.sin(hit * 100) * 10 : 0;
    context.save();
    context.translate(x + shake - attackCurve * 42, y - attackCurve * 5);
    context.fillStyle = monster.color || "#93c95f";
    if (monster.shape === "wolf" || monster.shape === "alphaWolf") {
      context.beginPath();
      context.ellipse(0, 24, 82, 48, 0, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(-30, -30);
      context.lineTo(-62, -88);
      context.lineTo(0, -55);
      context.lineTo(46, -82);
      context.lineTo(35, -22);
      context.closePath();
      context.fill();
    } else if (monster.shape === "treant") {
      roundedRect(context, -52, -80, 104, 170, 26);
      context.fill();
      context.fillStyle = monster.accentColor || "#d5f0a8";
      context.fillRect(-36, -94, 72, 18);
    } else {
      roundedRect(context, -52, -46, 104, 132, 22);
      context.fill();
      context.fillStyle = monster.accentColor || "#ddf7b9";
      context.beginPath();
      context.arc(-18, -14, 7, 0, Math.PI * 2);
      context.arc(18, -14, 7, 0, Math.PI * 2);
      context.fill();
    }
    if (attackProgress > 0) {
      context.globalAlpha = Math.max(0, 1 - attackProgress) * 0.7;
      context.strokeStyle = monster.accentColor || "#ffefad";
      context.lineWidth = 9;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(-72, -14);
      context.lineTo(-122, -36 + attackCurve * 28);
      context.stroke();
    }
    if (hit > 0) {
      context.globalAlpha = clamp01(hit / HIT_DURATION) * 0.7;
      context.fillStyle = "#fff4c2";
      if (monster.shape === "wolf" || monster.shape === "alphaWolf") {
        context.beginPath();
        context.ellipse(0, 24, 88, 52, 0, 0, Math.PI * 2);
        context.fill();
      } else {
        roundedRect(context, -56, -86, 112, 176, 26);
        context.fill();
      }
    }
    context.restore();
  }

  function drawTextEffects(context, list, delta) {
    for (let index = list.length - 1; index >= 0; index -= 1) {
      const item = list[index];
      item.life -= delta;
      item.y += item.vy * delta;
      item.vy += 18 * delta;
      if (item.life <= 0) {
        list.splice(index, 1);
        continue;
      }
      const alpha = clamp01(item.life / item.maxLife);
      context.save();
      context.globalAlpha = alpha;
      context.font = (item.critical ? "900 " : "800 ") + item.size + "px system-ui, sans-serif";
      context.textAlign = "center";
      context.lineWidth = 4;
      context.strokeStyle = "rgba(0,0,0,0.75)";
      context.strokeText(item.text, item.x, item.y);
      context.fillStyle = item.color;
      context.fillText(item.text, item.x, item.y);
      context.restore();
    }
  }

  function renderCanvas(deltaSeconds) {
    if (!ctx) {
      return;
    }
    resizeCanvas();
    const delta = Math.min(0.1, Math.max(0, Number(deltaSeconds) || 0));
    effects.time += delta;
    effects.playerAttack = Math.max(0, effects.playerAttack - delta);
    effects.monsterAttack = Math.max(0, effects.monsterAttack - delta);
    effects.playerHit = Math.max(0, effects.playerHit - delta);
    effects.monsterHit = Math.max(0, effects.monsterHit - delta);
    effects.fieldShake = Math.max(0, effects.fieldShake - delta);
    effects.criticalFlash = Math.max(0, effects.criticalFlash - delta);
    effects.lootGlow = Math.max(0, effects.lootGlow - delta);
    const state = State.getState();
    const region = Data.getRegion(state.progression.currentRegionId);
    const runtime = Combat.getRuntimeSnapshot();
    const shake = getFieldShakeOffset();
    ctx.save();
    ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
    ctx.translate(shake.x, shake.y);
    drawBackground(ctx, region, false);
    drawLootGlow(ctx);
    drawPlayer(ctx, WIDTH * 0.28, HEIGHT * 0.55, effects.playerHit, effects.playerAttack);
    drawEnemy(ctx, runtime.currentMonster, WIDTH * 0.73, HEIGHT * 0.55, effects.monsterHit, effects.monsterAttack);
    if (effects.criticalFlash > 0) {
      drawImpactRing(ctx, WIDTH * 0.73, HEIGHT * 0.42, 1 - clamp01(effects.criticalFlash / 0.38), "#ffe66d");
    }
    drawParticles(ctx, effects.particles, delta);
    drawTextEffects(ctx, effects.texts, delta);
    ctx.restore();
  }

  function renderBossCanvas(deltaSeconds) {
    if (!bossCtx) {
      return;
    }
    resizeCanvas();
    const delta = Math.min(0.1, Math.max(0, Number(deltaSeconds) || 0));
    effects.bossPlayerHit = Math.max(0, effects.bossPlayerHit - delta);
    effects.bossHit = Math.max(0, effects.bossHit - delta);
    effects.bossWarning = Math.max(0, effects.bossWarning - delta);
    effects.bossSmash = Math.max(0, effects.bossSmash - delta);
    effects.bossGuard = Math.max(0, effects.bossGuard - delta);
    effects.bossUltimate = Math.max(0, effects.bossUltimate - delta);
    effects.fieldShake = Math.max(0, effects.fieldShake - delta);
    const state = State.getState();
    const region = Data.getRegion(state.progression.currentRegionId);
    const runtime = Combat.getRuntimeSnapshot().bossBattle;
    const boss = runtime.boss || Data.buildBoss(state.boss.selectedBossId);
    const shake = getFieldShakeOffset();
    bossCtx.save();
    bossCtx.setTransform(bossCanvas.width / WIDTH, 0, 0, bossCanvas.height / HEIGHT, 0, 0);
    bossCtx.translate(shake.x, shake.y);
    drawBackground(bossCtx, region, runtime.warningActive);
    drawBossTelegraph(bossCtx, runtime);
    drawPlayer(bossCtx, WIDTH * 0.24, HEIGHT * 0.58, effects.bossPlayerHit, effects.playerAttack);
    drawEnemy(bossCtx, boss, WIDTH * 0.72, HEIGHT * 0.55, effects.bossHit, effects.monsterAttack);
    drawGuardShield(bossCtx, WIDTH * 0.24, HEIGHT * 0.58, runtime);
    drawBossSmashFlash(bossCtx);
    drawUltimateStrike(bossCtx);
    if (runtime.warningActive) {
      const warningAlpha = 0.14 + Math.abs(Math.sin(effects.time * 12)) * 0.12;
      bossCtx.fillStyle = "rgba(255,80,90," + warningAlpha.toFixed(3) + ")";
      bossCtx.fillRect(0, 0, WIDTH, HEIGHT);
    }
    drawParticles(bossCtx, effects.bossParticles, delta);
    drawTextEffects(bossCtx, effects.bossTexts, delta);
    bossCtx.restore();
  }

  function addDamageText(list, text, x, y, critical, color) {
    const settings = State.getState().settings;
    if (!settings.showDamageNumbers) {
      return;
    }
    list.push({
      text: text,
      x: x,
      y: y,
      vy: -64,
      life: critical ? 0.9 : 0.75,
      maxLife: critical ? 0.9 : 0.75,
      size: critical ? 34 : 27,
      critical: Boolean(critical),
      color: color || (critical ? "#ffe66d" : "#f3f6ff")
    });
    while (list.length > 24) {
      list.shift();
    }
    if (settings.reducedEffects) {
      while (list.length > 10) {
        list.shift();
      }
    }
  }

  function triggerFieldShake(strong) {
    effects.fieldShake = strong ? FIELD_SHAKE_DURATION : FIELD_SHAKE_DURATION * 0.7;
  }

  function showLevelUp(level) {
    el.levelUpBanner.textContent = "레벨 " + level;
    el.levelUpBanner.classList.remove("show");
    void el.levelUpBanner.offsetWidth;
    el.levelUpBanner.classList.add("show");
    effects.criticalFlash = 0.38;
    triggerFieldShake(true);
    addDamageText(effects.texts, "레벨업", WIDTH * 0.28, HEIGHT * 0.28, true, "#ffd36a");
    addImpactBurst(effects.particles, WIDTH * 0.28, HEIGHT * 0.5, "#ffd36a", true);
  }

  function handleStateEvent(event) {
    if (event.type === "save") {
      setSaveStatus("저장됨", "saved");
    } else if (event.type === "save-error" || event.type === "load-error") {
      setSaveStatus("저장 오류", "error");
    }
    if ([
      "loot",
      "equipment-change",
      "auto-equip",
      "item-lock",
      "salvage",
      "enhance-result",
      "inventory-settings",
      "feedback-settings"
    ].includes(event.type)) {
      inventoryDirty = true;
      forgeDirty = true;
      salvageDirty = true;
    }
    if (event.type === "boss-result" || event.type === "progress") {
      bossListDirty = true;
    }
    if (event.type === "experience" && event.payload && event.payload.levelsGained > 0) {
      showLevelUp(event.payload.level);
      playSound("loot");
      vibrate([20, 25, 35]);
    }
  }

  function handleCombatEvent(event) {
    const payload = event.payload || {};
    if (event.type === "player-attack") {
      effects.playerAttack = PLAYER_ATTACK_DURATION;
      effects.monsterHit = HIT_DURATION;
      addImpactBurst(effects.particles, WIDTH * 0.71, HEIGHT * 0.49, payload.critical ? "#ffe66d" : "#d8f7ff", payload.critical);
      playSound(payload.critical ? "crit" : "attack");
      if (payload.critical) {
        effects.criticalFlash = 0.38;
        triggerFieldShake(true);
        vibrate(18);
        screenShake(false);
      } else {
        triggerFieldShake(false);
      }
      addDamageText(effects.texts, String(payload.damage), WIDTH * 0.73, HEIGHT * 0.34, payload.critical);
    } else if (event.type === "monster-attack") {
      effects.monsterAttack = MONSTER_ATTACK_DURATION;
      effects.playerHit = HIT_DURATION;
      triggerFieldShake(false);
      addImpactBurst(effects.particles, WIDTH * 0.3, HEIGHT * 0.48, "#ff8b94", false);
      playSound("hit");
      vibrate(10);
      addDamageText(effects.texts, "-" + payload.damage, WIDTH * 0.28, HEIGHT * 0.32, false, "#ff8b94");
    } else if (event.type === "monster-defeated") {
      addImpactBurst(effects.particles, WIDTH * 0.73, HEIGHT * 0.54, "#65df9a", true);
      addBattleLog(payload.monster.name + " 처치 · 골드 +" + payload.gold, "reward");
      if (payload.drop && payload.drop.dropped) {
        if (payload.drop.autoSalvaged) {
          effects.lootGlow = 0.65;
          playSound("salvage");
          addBattleLog("자동 분해: " + payload.drop.item.name + " · 골드 " + payload.drop.salvage.gold + ", 강화석 " + payload.drop.salvage.enhancementStone, "reward");
          showToast("자동 분해: " + payload.drop.item.name, "info");
        } else if (payload.drop.stored) {
          effects.lootGlow = payload.drop.item && payload.drop.item.rarity === "legendary" ? 1.15 : 0.9;
          playSound("loot");
          if (payload.drop.item && payload.drop.item.rarity === "legendary") {
            vibrate([30, 30, 50]);
            triggerFieldShake(true);
            screenShake(true);
          }
          addBattleLog("장비 획득: " + payload.drop.item.name, "loot");
          showToast("장비 획득: " + payload.drop.item.name, "success");
        }
      }
      inventoryDirty = true;
      forgeDirty = true;
      salvageDirty = true;
      bossListDirty = true;
    } else if (event.type === "player-defeated") {
      triggerFieldShake(true);
      addBattleLog("플레이어가 쓰러졌습니다. 곧 부활합니다.", "danger");
    } else if (event.type === "boss-start") {
      bossResultDismissed = false;
      addBattleLog("보스전 시작: " + payload.boss.name, "boss");
    } else if (event.type === "boss-damage") {
      effects.playerAttack = PLAYER_ATTACK_DURATION;
      effects.bossHit = HIT_DURATION;
      if (payload.source === "smash") {
        effects.bossSmash = BOSS_SMASH_DURATION;
      }
      addImpactBurst(effects.bossParticles, WIDTH * 0.7, HEIGHT * 0.5, payload.critical || payload.source === "ultimate" || payload.source === "smash" ? "#ffe66d" : "#d8f7ff", payload.critical || payload.source === "ultimate" || payload.source === "smash");
      playSound(payload.source === "ultimate" ? "ultimate" : payload.source === "smash" ? "bossSmash" : payload.critical ? "crit" : "attack");
      if (payload.source === "ultimate") {
        effects.bossUltimate = BOSS_ULTIMATE_DURATION;
        triggerFieldShake(true);
        vibrate([18, 24, 38, 24, 48]);
        screenShake(true);
      } else if (payload.source === "smash") {
        triggerFieldShake(true);
        vibrate([12, 18]);
      } else if (payload.critical) {
        triggerFieldShake(true);
      }
      addDamageText(effects.bossTexts, String(payload.damage), WIDTH * 0.72, HEIGHT * 0.32, payload.critical);
    } else if (event.type === "boss-player-hit") {
      effects.monsterAttack = MONSTER_ATTACK_DURATION;
      effects.bossPlayerHit = HIT_DURATION;
      addImpactBurst(effects.bossParticles, WIDTH * 0.25, HEIGHT * 0.51, payload.guarded ? "#8cf0ff" : "#ff8b94", !payload.guarded);
      playSound(payload.guarded ? "guardBlock" : "hit");
      vibrate(payload.guarded ? [8, 16] : [18, 26]);
      if (!payload.guarded) {
        triggerFieldShake(true);
        screenShake(false);
      } else {
        effects.bossGuard = BOSS_GUARD_FLASH_DURATION;
        triggerFieldShake(false);
      }
      addDamageText(effects.bossTexts, "-" + payload.damage, WIDTH * 0.24, HEIGHT * 0.32, false, payload.guarded ? "#8cf0ff" : "#ff8b94");
    } else if (event.type === "boss-warning") {
      effects.bossWarning = 0.75;
      triggerFieldShake(true);
      playSound("warning");
      vibrate([18, 28, 18]);
      screenShake(true);
      showToast("위험 공격 예고. 방어를 사용하세요.", "error");
    } else if (event.type === "boss-warning-end") {
      effects.bossWarning = 0;
    } else if (event.type === "boss-end") {
      bossListDirty = true;
      inventoryDirty = true;
      forgeDirty = true;
      salvageDirty = true;
      const type = payload.type;
      addBattleLog("보스전 종료: " + formatBossResult(type), type === "victory" ? "reward" : "danger");
      if (payload.rewards && payload.rewards.item) {
        playSound("bossKill");
        vibrate([35, 35, 55]);
        screenShake(true);
        const item = payload.rewards.item.item;
        if (item) {
          addBattleLog("보스 보상: " + item.name, "loot");
        }
      }
    } else if (event.type === "boss-skill") {
      if (payload.skill === "guard") {
        effects.bossGuard = BOSS_GUARD_FLASH_DURATION;
        playSound("guard");
        vibrate([10, 16]);
        addDamageText(effects.bossTexts, "방어", WIDTH * 0.24, HEIGHT * 0.27, false, "#8cf0ff");
      } else if (payload.skill === "potion") {
        playSound("potion");
        vibrate(10);
        showToast("물약으로 체력 " + payload.healed + " 회복.", "success");
        addDamageText(effects.bossTexts, "+" + payload.healed, WIDTH * 0.24, HEIGHT * 0.28, false, "#65df9a");
      } else if (payload.skill === "smash") {
        showToast("강타 적중: " + payload.damage, "success");
      } else if (payload.skill === "ultimate") {
        showToast("궁극기 적중: " + payload.damage, "success");
      }
    }
  }

  function openUtilitySheet(sheetName) {
    if (sheetName === "stats") {
      el.statsSheetOverlay.hidden = false;
    } else if (sheetName === "log") {
      el.logSheetOverlay.hidden = false;
    } else if (sheetName === "settings") {
      el.settingsSheetOverlay.hidden = false;
    }
    document.body.classList.add("sheet-open");
  }

  function closeUtilitySheets() {
    el.statsSheetOverlay.hidden = true;
    el.logSheetOverlay.hidden = true;
    el.settingsSheetOverlay.hidden = true;
    document.body.classList.remove("sheet-open");
  }

  function bindEvents() {
    function handleFirstGesture() {
      unlockAudio();
      playSound("tap");
    }
    document.addEventListener("pointerdown", handleFirstGesture, { once: true });
    cleanups.push(function () {
      document.removeEventListener("pointerdown", handleFirstGesture);
    });

    function pauseGame() {
      State.togglePaused();
      renderAll();
    }
    function resetGame() {
    if (window.confirm("로컬 저장 데이터를 초기화할까요?")) {
        State.reset();
        Combat.resetRuntime();
        resetVisuals();
        renderAll();
      }
    }
    function clearLog() {
      clearChildren(el.battleLog);
      clearChildren(el.recentCombatLog);
      clearChildren(el.fullBattleLog);
    }
    function openSettingsSheet() {
      unlockAudio();
      openUtilitySheet("settings");
      renderSettings();
    }
    function openStatsSheet() {
      openUtilitySheet("stats");
      renderPlayer();
    }
    function openLogSheet() {
      openUtilitySheet("log");
    }
    el.pauseButton.addEventListener("click", pauseGame);
    el.settingsButton.addEventListener("click", openSettingsSheet);
    el.resetButton.addEventListener("click", resetGame);
    el.clearLogButton.addEventListener("click", clearLog);
    el.logSheetClearButton.addEventListener("click", clearLog);
    el.statsSheetButton.addEventListener("click", openStatsSheet);
    el.logSheetButton.addEventListener("click", openLogSheet);
    el.statsSheetBackdrop.addEventListener("click", closeUtilitySheets);
    el.statsSheetCloseButton.addEventListener("click", closeUtilitySheets);
    el.logSheetBackdrop.addEventListener("click", closeUtilitySheets);
    el.logSheetCloseButton.addEventListener("click", closeUtilitySheets);
    el.settingsSheetBackdrop.addEventListener("click", closeUtilitySheets);
    el.settingsSheetCloseButton.addEventListener("click", closeUtilitySheets);
    cleanups.push(function () {
      el.pauseButton.removeEventListener("click", pauseGame);
      el.settingsButton.removeEventListener("click", openSettingsSheet);
      el.resetButton.removeEventListener("click", resetGame);
      el.clearLogButton.removeEventListener("click", clearLog);
      el.logSheetClearButton.removeEventListener("click", clearLog);
      el.statsSheetButton.removeEventListener("click", openStatsSheet);
      el.logSheetButton.removeEventListener("click", openLogSheet);
      el.statsSheetBackdrop.removeEventListener("click", closeUtilitySheets);
      el.statsSheetCloseButton.removeEventListener("click", closeUtilitySheets);
      el.logSheetBackdrop.removeEventListener("click", closeUtilitySheets);
      el.logSheetCloseButton.removeEventListener("click", closeUtilitySheets);
      el.settingsSheetBackdrop.removeEventListener("click", closeUtilitySheets);
      el.settingsSheetCloseButton.removeEventListener("click", closeUtilitySheets);
    });

    el.speedButtons.forEach(function (button) {
      function handleClick() {
        State.setSpeed(Number(button.dataset.speed));
        renderSettings();
      }
      button.addEventListener("click", handleClick);
      cleanups.push(function () {
        button.removeEventListener("click", handleClick);
      });
    });

    el.viewTabs.forEach(function (button) {
      function handleClick() {
        State.setActiveView(button.dataset.view);
        renderAll();
      }
      button.addEventListener("click", handleClick);
      cleanups.push(function () {
        button.removeEventListener("click", handleClick);
      });
    });

    el.forgeTabButtons.forEach(function (button) {
      function handleClick() {
        setActiveForgePanel(button.dataset.forgePanel);
      }
      button.addEventListener("click", handleClick);
      cleanups.push(function () {
        button.removeEventListener("click", handleClick);
      });
    });

    el.equipmentSlots.forEach(function (button) {
      function handleClick() {
        const item = State.getEquippedItem(button.dataset.slot);
        if (item) {
          openItemDetail(item.id);
          return;
        }
        focusInventoryForSlot(button.dataset.slot);
      }
      button.addEventListener("click", handleClick);
      cleanups.push(function () {
        button.removeEventListener("click", handleClick);
      });
    });

    function handleInventoryClick(event) {
      const card = event.target.closest("[data-item-id]");
      if (card && el.inventoryGrid.contains(card)) {
        openItemDetail(card.dataset.itemId);
      }
    }
    el.inventoryGrid.addEventListener("click", handleInventoryClick);
    cleanups.push(function () {
      el.inventoryGrid.removeEventListener("click", handleInventoryClick);
    });

    function changeSort() {
      State.setInventorySort(Loot.getNextSort(State.getState().settings.inventorySort));
      inventoryDirty = true;
      renderInventory(true);
    }
    el.inventorySortButton.addEventListener("click", changeSort);
    cleanups.push(function () {
      el.inventorySortButton.removeEventListener("click", changeSort);
    });

    function changeFilters() {
      State.setInventoryFilters(el.slotFilter.value, el.rarityFilter.value);
      inventoryDirty = true;
      renderInventory(true);
    }
    el.slotFilter.addEventListener("change", changeFilters);
    el.rarityFilter.addEventListener("change", changeFilters);
    cleanups.push(function () {
      el.slotFilter.removeEventListener("change", changeFilters);
      el.rarityFilter.removeEventListener("change", changeFilters);
    });

    function autoEquip() {
      const result = State.autoEquipBest();
      showToast(result.changed ? "가장 좋은 장비를 장착했습니다." : "더 좋은 장비가 없습니다.", result.changed ? "success" : "info");
      inventoryDirty = true;
      forgeDirty = true;
      salvageDirty = true;
      renderAll();
    }
    el.autoEquipButton.addEventListener("click", autoEquip);
    el.equipItemButton.addEventListener("click", equipSelectedItem);
    el.unequipItemButton.addEventListener("click", unequipSelectedItem);
    el.itemDetailBackdrop.addEventListener("click", closeItemDetail);
    el.itemDetailCloseButton.addEventListener("click", closeItemDetail);
    el.lockItemButton.addEventListener("click", toggleSelectedLock);
    el.goToForgeButton.addEventListener("click", goToForge);
    cleanups.push(function () {
      el.autoEquipButton.removeEventListener("click", autoEquip);
      el.equipItemButton.removeEventListener("click", equipSelectedItem);
      el.unequipItemButton.removeEventListener("click", unequipSelectedItem);
      el.itemDetailBackdrop.removeEventListener("click", closeItemDetail);
      el.itemDetailCloseButton.removeEventListener("click", closeItemDetail);
      el.lockItemButton.removeEventListener("click", toggleSelectedLock);
      el.goToForgeButton.removeEventListener("click", goToForge);
    });

    function openRecentLoot() {
      const item = State.getState().recentLoot;
      if (item) {
        openItemDetail(item.id);
      }
    }
    el.lootPreview.addEventListener("click", openRecentLoot);
    cleanups.push(function () {
      el.lootPreview.removeEventListener("click", openRecentLoot);
    });

    function changeForgeSort() {
      State.setForgeSort(Loot.getNextForgeSort(State.getState().forge.sort));
      forgeDirty = true;
      renderForge(true);
    }
    el.forgeSortButton.addEventListener("click", changeForgeSort);
    el.forgeSelectedItem.addEventListener("click", focusForgeSelectionList);
    el.enhanceButton.addEventListener("click", handleEnhance);
    cleanups.push(function () {
      el.forgeSortButton.removeEventListener("click", changeForgeSort);
      el.forgeSelectedItem.removeEventListener("click", focusForgeSelectionList);
      el.enhanceButton.removeEventListener("click", handleEnhance);
    });

    function handleForgeGridClick(event) {
      const card = event.target.closest("[data-item-id]");
      if (card && el.forgeInventoryGrid.contains(card)) {
        State.setForgeSelectedItem(card.dataset.itemId);
        forgeDirty = true;
        renderForge(true);
      }
    }
    el.forgeInventoryGrid.addEventListener("click", handleForgeGridClick);
    cleanups.push(function () {
      el.forgeInventoryGrid.removeEventListener("click", handleForgeGridClick);
    });

    function handleSalvageGridClick(event) {
      const row = event.target.closest("[data-item-id]");
      if (row && el.salvageInventoryGrid.contains(row)) {
        const result = State.toggleSalvageSelection(row.dataset.itemId);
        if (!result.allowed) {
          showToast("분해할 수 없습니다: " + formatReason(result.reason), "error");
        }
        salvageDirty = true;
        renderSalvage(true);
      }
    }
    el.salvageInventoryGrid.addEventListener("click", handleSalvageGridClick);
    cleanups.push(function () {
      el.salvageInventoryGrid.removeEventListener("click", handleSalvageGridClick);
    });

    function toggleSelectAllSalvage() {
      const preview = State.getSalvagePreview();
      if (preview.count > 0 && preview.count === Loot.getSalvageableItems().length) {
        State.clearSalvageSelection();
      } else {
        State.selectAllSalvageable();
      }
      salvageDirty = true;
      renderSalvage(true);
    }
    el.salvageSelectAllButton.addEventListener("click", toggleSelectAllSalvage);
    el.salvageButton.addEventListener("click", handleSalvage);
    cleanups.push(function () {
      el.salvageSelectAllButton.removeEventListener("click", toggleSelectAllSalvage);
      el.salvageButton.removeEventListener("click", handleSalvage);
    });

    el.autoSalvageInputs.forEach(function (input) {
      function handleChange() {
        State.setAutoSalvage(input.dataset.rarity, input.checked);
        showToast("자동 분해 설정을 변경했습니다.", "info");
      }
      input.addEventListener("change", handleChange);
      cleanups.push(function () {
        input.removeEventListener("change", handleChange);
      });
    });

    function updateFeedbackSettings() {
      State.setFeedbackSettings({
        soundEnabled: el.soundToggle.checked,
        soundVolume: Number(el.soundVolume.value),
        vibrationEnabled: el.vibrationToggle.checked,
        screenShakeEnabled: el.screenShakeToggle.checked,
        reducedEffects: el.reducedEffectsToggle.checked,
        showDamageNumbers: el.damageNumbersToggle.checked
      });
      renderSettings();
    }

    [
      el.soundToggle,
      el.soundVolume,
      el.vibrationToggle,
      el.screenShakeToggle,
      el.reducedEffectsToggle,
      el.damageNumbersToggle
    ].forEach(function (control) {
      control.addEventListener("input", updateFeedbackSettings);
      control.addEventListener("change", updateFeedbackSettings);
      cleanups.push(function () {
        control.removeEventListener("input", updateFeedbackSettings);
        control.removeEventListener("change", updateFeedbackSettings);
      });
    });

    function handleBossCardClick(event) {
      const card = event.target.closest("[data-boss-id]");
      if (card && el.bossCardList.contains(card)) {
        State.setSelectedBoss(card.dataset.bossId);
        bossListDirty = true;
        renderBoss();
      }
    }
    el.bossCardList.addEventListener("click", handleBossCardClick);
    cleanups.push(function () {
      el.bossCardList.removeEventListener("click", handleBossCardClick);
    });

    function startBoss() {
      const result = Combat.startBossBattle(State.getState().boss.selectedBossId);
      if (!result.success) {
        showToast("보스전을 시작할 수 없습니다: " + formatReason(result.reason), "error");
        return;
      }
      bossResultDismissed = false;
      renderAll();
    }
    el.bossStartButton.addEventListener("click", startBoss);
    cleanups.push(function () {
      el.bossStartButton.removeEventListener("click", startBoss);
    });

    function skill(skillId) {
      return function () {
        const result = Combat.useBossSkill(skillId);
        if (!result.success) {
          showToast("스킬을 사용할 수 없습니다: " + formatReason(result.reason), "error");
        }
      };
    }
    const smash = skill("smash");
    const guard = skill("guard");
    const potion = skill("potion");
    const ultimate = skill("ultimate");
    el.bossSmashButton.addEventListener("click", smash);
    el.bossGuardButton.addEventListener("click", guard);
    el.bossPotionButton.addEventListener("click", potion);
    el.bossUltimateButton.addEventListener("click", ultimate);
    cleanups.push(function () {
      el.bossSmashButton.removeEventListener("click", smash);
      el.bossGuardButton.removeEventListener("click", guard);
      el.bossPotionButton.removeEventListener("click", potion);
      el.bossUltimateButton.removeEventListener("click", ultimate);
    });

    function retreat() {
      Combat.abandonBossBattle();
      renderBoss();
    }
    function confirmBossResult() {
      bossResultDismissed = true;
      el.bossResultOverlay.hidden = true;
      renderBoss();
    }
    el.bossRetreatButton.addEventListener("click", retreat);
    el.bossResultConfirmButton.addEventListener("click", confirmBossResult);
    cleanups.push(function () {
      el.bossRetreatButton.removeEventListener("click", retreat);
      el.bossResultConfirmButton.removeEventListener("click", confirmBossResult);
    });

    cleanups.push(State.subscribe(handleStateEvent));
    cleanups.push(Combat.subscribe(handleCombatEvent));
  }

  function renderAll() {
    renderPlayer();
    renderProgression();
    renderMonster();
    renderSettings();
    renderLootPreview();
    renderEquipment();
    renderInventory(true);
    renderForge(true);
    renderBoss();
  }

  function update(deltaSeconds) {
    if (!initialized) {
      return;
    }
    const delta = Math.min(0.1, Math.max(0, Number(deltaSeconds) || 0));
    if (saveStatusTimer > 0) {
      saveStatusTimer -= delta;
      if (saveStatusTimer <= 0 && !el.saveStatus.classList.contains("error")) {
        el.saveStatus.textContent = State.isDirty() ? "저장 대기" : "저장됨";
        el.saveStatus.classList.remove("saved");
      }
    }
    renderPlayer();
    renderSettings();
    if (!el.huntView.hidden) {
      renderCanvas(delta);
      renderMonster();
      renderProgression();
    }
    if (!el.equipmentView.hidden) {
      renderEquipment();
      renderInventory(false);
    }
    if (!el.forgeView.hidden) {
      renderForge(false);
    }
    if (!el.bossView.hidden) {
      renderBoss();
      renderBossCanvas(delta);
    }
  }

  function resetVisuals() {
    effects.time = 0;
    effects.playerAttack = 0;
    effects.monsterAttack = 0;
    effects.playerHit = 0;
    effects.monsterHit = 0;
    effects.fieldShake = 0;
    effects.criticalFlash = 0;
    effects.lootGlow = 0;
    effects.bossPlayerHit = 0;
    effects.bossHit = 0;
    effects.bossWarning = 0;
    effects.bossSmash = 0;
    effects.bossGuard = 0;
    effects.bossUltimate = 0;
    effects.texts = [];
    effects.bossTexts = [];
    effects.particles = [];
    effects.bossParticles = [];
    clearChildren(el.battleLog);
    clearChildren(el.recentCombatLog);
    clearChildren(el.fullBattleLog);
  }

  function initialize() {
    if (initialized) {
      return true;
    }
    cacheElements();
    resizeCanvas();
    bindEvents();
    function handleResize() {
      resizeCanvas();
    }
    window.addEventListener("resize", handleResize);
    cleanups.push(function () {
      window.removeEventListener("resize", handleResize);
    });
    initialized = true;
    inventoryDirty = true;
    forgeDirty = true;
    salvageDirty = true;
    bossListDirty = true;
    renderAll();
    renderCanvas(0);
    renderBossCanvas(0);
    setSaveStatus("자동 저장 준비");
    addBattleLog("자동 사냥 시작.", "reward");
    return true;
  }

  function destroy() {
    closeItemDetail();
    closeUtilitySheets();
    while (cleanups.length > 0) {
      const cleanup = cleanups.pop();
      try {
        cleanup();
      } catch (error) {
        console.warn("UI cleanup failed", error);
      }
    }
    initialized = false;
  }

  global.GameUI = {
    initialize: initialize,
    update: update,
    renderAll: renderAll,
    renderCanvas: renderCanvas,
    renderInventory: renderInventory,
    resizeCanvas: resizeCanvas,
    addBattleLog: addBattleLog,
    setSaveStatus: setSaveStatus,
    resetVisuals: resetVisuals,
    openItemDetail: openItemDetail,
    closeItemDetail: closeItemDetail,
    destroy: destroy
  };
})(window);
