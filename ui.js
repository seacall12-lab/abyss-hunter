(function (global) {
  "use strict";

  ["GameData", "GameState", "GameCombat", "GameLoot"].forEach(function (name) {
    if (!global[name]) {
      throw new Error("ui.js보다 " + name + " 관련 스크립트를 먼저 로드해야 합니다.");
    }
  });

  const Data = global.GameData;
  const State = global.GameState;
  const Combat = global.GameCombat;
  const Loot = global.GameLoot;
  const CONFIG = Data.CONFIG;

  const el = {};
  const cleanups = [];
  const WIDTH = 720;
  const HEIGHT = 720;

  let initialized = false;
  let canvas = null;
  let ctx = null;
  let selectedItemId = null;
  let saveStatusTimer = 0;
  let inventoryDirty = true;

  const effects = {
    time: 0,
    playerAttack: 0,
    monsterAttack: 0,
    playerHit: 0,
    monsterHit: 0,
    flash: 0,
    deathFlash: 0,
    texts: [],
    particles: []
  };

  function getElement(id) {
    const node = document.getElementById(id);

    if (!node) {
      throw new Error("필수 UI 요소를 찾을 수 없습니다: #" + id);
    }

    return node;
  }

  function cacheElements() {
    [
      "playerLevel",
      "playerPower",
      "goldAmount",
      "expText",
      "expFill",
      "regionName",
      "waveText",
      "totalKills",
      "playerName",
      "playerHpText",
      "playerHpFill",
      "monsterTypeLabel",
      "monsterName",
      "monsterHpText",
      "monsterHpFill",
      "pauseButton",
      "resetButton",
      "pauseOverlay",
      "levelUpBanner",
      "saveStatus",
      "attackStat",
      "defenseStat",
      "attackSpeedStat",
      "critStat",
      "critDamageStat",
      "lifestealStat",
      "lootPreview",
      "battleLog",
      "clearLogButton",
      "huntView",
      "equipmentView",
      "inventoryBadge",
      "inventoryCount",
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
      "itemDetailOverlay",
      "itemDetailBackdrop",
      "itemDetailCloseButton",
      "itemDetailRarity",
      "itemDetailName",
      "itemDetailMeta",
      "itemDetailScore",
      "itemDetailComparison",
      "itemBaseStatList",
      "itemOptionList",
      "equippedItemPreview",
      "equippedItemName",
      "equippedItemScore",
      "unequipItemButton",
      "equipItemButton"
    ].forEach(function (id) {
      el[id] = getElement(id);
    });

    el.speedButtons = Array.from(
      document.querySelectorAll(".speed-button")
    );

    el.viewTabs = Array.from(
      document.querySelectorAll(".view-tab[data-view]")
    );

    el.equipmentSlots = Array.from(
      document.querySelectorAll(".equipment-slot[data-slot]")
    );

    canvas = getElement("gameCanvas");
    ctx = canvas.getContext("2d", { alpha: false });

    if (!ctx) {
      throw new Error("Canvas 2D context를 생성하지 못했습니다.");
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
      return (number / 1000).toFixed(number >= 10000 ? 0 : 1) + "K";
    }

    if (Math.abs(number) < 1000000000) {
      return (number / 1000000).toFixed(number >= 10000000 ? 0 : 1) + "M";
    }

    return (number / 1000000000).toFixed(1) + "B";
  }

  function formatPercent(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "0.0%";
    }

    return (number * 100).toFixed(1) + "%";
  }

  function setBar(fill, current, maximum) {
    const max = Math.max(1, Number(maximum) || 1);
    const now = Math.min(max, Math.max(0, Number(current) || 0));

    fill.style.width = (now / max * 100).toFixed(2) + "%";

    if (fill.parentElement) {
      fill.parentElement.setAttribute("aria-valuemax", String(Math.round(max)));
      fill.parentElement.setAttribute("aria-valuenow", String(Math.round(now)));
    }
  }

  function clearRarityClasses(node) {
    node.classList.remove(
      "rarity-common",
      "rarity-rare",
      "rarity-epic",
      "rarity-legendary"
    );
  }

  function renderPlayer() {
    const state = State.getState();
    const player = state.player;

    el.playerLevel.textContent = String(player.level);
    el.playerPower.textContent = "전투력 " + formatNumber(player.power);
    el.goldAmount.textContent = formatNumber(state.currencies.gold);

    el.expText.textContent =
      formatNumber(player.exp) + " / " + formatNumber(player.expToNext);

    setBar(el.expFill, player.exp, player.expToNext);

    el.playerName.textContent = player.name;
    el.playerHpText.textContent =
      formatNumber(player.currentHp) + " / " + formatNumber(player.maxHp);

    setBar(el.playerHpFill, player.currentHp, player.maxHp);

    el.attackStat.textContent = String(Math.round(player.attack * 10) / 10);
    el.defenseStat.textContent = String(Math.round(player.defense * 10) / 10);
    el.attackSpeedStat.textContent = player.attackSpeed.toFixed(2) + "회/초";
    el.critStat.textContent = formatPercent(player.critChance);
    el.critDamageStat.textContent = formatPercent(player.critDamage);
    el.lifestealStat.textContent = formatPercent(player.lifesteal);
  }

  function renderProgression() {
    const state = State.getState();
    const progress = state.progression;
    const region = Data.getRegion(progress.currentRegionId);

    el.regionName.textContent = region.name;
    el.waveText.textContent =
      "웨이브 " + formatNumber(progress.currentWave) +
      " · " + progress.defeatedInWave + "/" + CONFIG.MONSTERS_PER_WAVE;

    el.totalKills.textContent = formatNumber(state.statistics.totalKills);
  }

  function renderMonster() {
    const runtime = Combat.getRuntimeSnapshot();
    const monster = runtime.currentMonster;

    if (!monster) {
      const dead = runtime.status === "player-dead";

      el.monsterTypeLabel.textContent = dead ? "부활 대기" : "다음 적 준비";
      el.monsterName.textContent = dead
        ? Math.max(0, runtime.reviveTimer).toFixed(1) + "초"
        : "곧 출현합니다";

      el.monsterHpText.textContent = "0 / 0";
      setBar(el.monsterHpFill, 0, 1);
      return;
    }

    el.monsterTypeLabel.textContent = monster.isBoss
      ? "지역 보스"
      : "일반 몬스터 · LV " + monster.level;

    el.monsterName.textContent = monster.name;
    el.monsterHpText.textContent =
      formatNumber(monster.currentHp) + " / " + formatNumber(monster.maxHp);

    setBar(el.monsterHpFill, monster.currentHp, monster.maxHp);
  }

  function renderSettings() {
    const settings = State.getState().settings;

    el.speedButtons.forEach(function (button) {
      const active = Number(button.dataset.speed) === Number(settings.speed);

      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    el.pauseButton.innerHTML = settings.paused
      ? '<span aria-hidden="true">▶</span>'
      : '<span aria-hidden="true">Ⅱ</span>';

    el.pauseButton.setAttribute(
      "aria-label",
      settings.paused ? "게임 계속하기" : "게임 일시정지"
    );

    el.pauseButton.title = settings.paused ? "계속하기" : "일시정지";
    el.pauseOverlay.hidden = !settings.paused;
  }

  function renderView() {
    const activeView = State.getState().settings.activeView || "hunt";

    el.viewTabs.forEach(function (button) {
      const active = button.dataset.view === activeView;

      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    el.huntView.hidden = activeView !== "hunt";
    el.huntView.classList.toggle("active", activeView === "hunt");

    el.equipmentView.hidden = activeView !== "equipment";
    el.equipmentView.classList.toggle("active", activeView === "equipment");

    if (activeView === "equipment") {
      inventoryDirty = true;
    }
  }

  function renderInventoryCounts() {
    const count = State.getState().inventory.length;

    el.inventoryCount.textContent = String(count);
    el.inventoryCountLarge.textContent = String(count);
    el.inventoryMaximum.textContent = String(CONFIG.MAX_INVENTORY);
    el.inventoryBadge.textContent = String(count);
    el.inventoryBadge.hidden = count <= 0;
  }

  function renderRecentLoot() {
    const item = State.getState().recentLoot;
    const container = el.lootPreview;

    clearRarityClasses(container);
    container.classList.remove("empty");

    if (!item) {
      container.classList.add("empty");
      container.innerHTML =
        '<span class="loot-orb" aria-hidden="true"></span>' +
        '<div><strong>드롭 없음</strong>' +
        '<p>낮은 확률로 장비를 획득할 수 있습니다.</p></div>';
      return;
    }

    const rarity = Data.getRarity(item.rarity);
    const slot = Data.getItemSlot(item.slot);
    const comparison = Loot.compareWithEquipped(item);

    let comparisonText = " · 빈 슬롯";

    if (comparison.equippedItem) {
      if (comparison.difference > 0) {
        comparisonText = " · 현재 장비보다 +" + comparison.difference;
      } else if (comparison.difference < 0) {
        comparisonText = " · 현재 장비보다 " + comparison.difference;
      } else {
        comparisonText = " · 현재 장비와 동일";
      }
    }

    container.classList.add("rarity-" + item.rarity);
    container.innerHTML =
      '<span class="loot-orb" aria-hidden="true"></span>' +
      '<div><strong></strong><p></p></div>';

    container.querySelector("strong").textContent = item.name;
    container.querySelector("p").textContent =
      rarity.name + " · " +
      (slot ? slot.name : item.slot) + " · 점수 " +
      Loot.getItemScore(item) + comparisonText;
  }

  function renderEquipment() {
    const state = State.getState();

    el.equipmentPower.textContent = formatNumber(State.getEquipmentPower());

    el.equipmentSlots.forEach(function (button) {
      const slotId = button.dataset.slot;
      const item = state.equipment[slotId];
      const nameNode = button.querySelector(".equipment-item-name");
      const metaNode = button.querySelector(".equipment-item-meta");

      clearRarityClasses(button);
      button.classList.toggle("empty", !item);

      if (!item) {
        nameNode.textContent = "비어 있음";
        metaNode.textContent = "장비를 선택하세요";
        return;
      }

      button.classList.add("rarity-" + item.rarity);
      nameNode.textContent = item.name;
      metaNode.textContent =
        Data.getRarity(item.rarity).name +
        " · 점수 " + Loot.getItemScore(item);
    });
  }

  function getInventoryCardMarkup(item) {
    const rarity = Data.getRarity(item.rarity);
    const slot = Data.getItemSlot(item.slot);
    const comparison = Loot.compareWithEquipped(item);
    const score = Loot.getItemScore(item);

    let comparisonMarkup = '<span>빈 슬롯</span>';

    if (comparison.equippedItem) {
      if (comparison.difference > 0) {
        comparisonMarkup =
          '<span class="upgrade-mark">▲ +' + comparison.difference + "</span>";
      } else if (comparison.difference < 0) {
        comparisonMarkup = "<span>▼ " + comparison.difference + "</span>";
      } else {
        comparisonMarkup = "<span>동일</span>";
      }
    }

    return (
      '<span class="inventory-card-orb" aria-hidden="true">' +
      (slot ? slot.icon : "◇") +
      "</span>" +
      '<span class="inventory-card-rarity">' + rarity.name + "</span>" +
      '<strong class="inventory-card-name"></strong>' +
      '<span class="inventory-card-meta">' +
      (slot ? slot.name : item.slot) +
      " · 아이템 LV " + item.itemLevel +
      " · 요구 LV " + item.requiredLevel +
      "</span>" +
      '<span class="inventory-card-score">' +
      "<span>점수 <strong>" + score + "</strong></span>" +
      comparisonMarkup +
      "</span>"
    );
  }

  function renderInventory(force) {
    if (!force && !inventoryDirty) {
      return;
    }

    const state = State.getState();
    const settings = state.settings;
    const items = Loot.getVisibleInventory();

    el.slotFilter.value = settings.inventorySlotFilter || "all";
    el.rarityFilter.value = settings.inventoryRarityFilter || "all";
    el.inventorySortButton.dataset.sort = settings.inventorySort || "newest";
    el.inventorySortButton.textContent = Loot.getSortLabel(
      settings.inventorySort || "newest"
    );

    el.inventoryGrid.innerHTML = "";
    el.inventoryEmpty.hidden = items.length > 0;

    items.forEach(function (item) {
      const card = document.createElement("button");

      card.type = "button";
      card.className = "inventory-card rarity-" + item.rarity;
      card.dataset.itemId = item.id;
      card.innerHTML = getInventoryCardMarkup(item);
      card.querySelector(".inventory-card-name").textContent = item.name;

      el.inventoryGrid.appendChild(card);
    });

    inventoryDirty = false;
  }

  function renderAll() {
    renderPlayer();
    renderProgression();
    renderMonster();
    renderSettings();
    renderView();
    renderInventoryCounts();
    renderRecentLoot();
    renderEquipment();
    renderInventory(true);
  }

  function setSaveStatus(text, type) {
    clearTimeout(saveStatusTimer);

    el.saveStatus.textContent = text;
    el.saveStatus.classList.remove("saved", "error");

    if (type) {
      el.saveStatus.classList.add(type);
    }

    if (type === "saved") {
      saveStatusTimer = global.setTimeout(function () {
        el.saveStatus.textContent = "자동 저장 중";
        el.saveStatus.classList.remove("saved");
      }, 1800);
    }
  }

  function addBattleLog(message, type) {
    if (!message) {
      return;
    }

    const row = document.createElement("li");
    const time = document.createElement("time");
    const text = document.createElement("span");
    const now = new Date();

    time.textContent = [
      now.getHours(),
      now.getMinutes(),
      now.getSeconds()
    ].map(function (value) {
      return String(value).padStart(2, "0");
    }).join(":");

    text.textContent = message;

    if (type) {
      text.classList.add(type);
    }

    row.appendChild(time);
    row.appendChild(text);
    el.battleLog.insertBefore(row, el.battleLog.firstChild);

    while (el.battleLog.children.length > CONFIG.MAX_BATTLE_LOGS) {
      el.battleLog.removeChild(el.battleLog.lastChild);
    }
  }

  function showLevelUp(level, count) {
    el.levelUpBanner.textContent = count > 1
      ? "LEVEL UP ×" + count + " · LV " + level
      : "LEVEL UP! · LV " + level;

    el.levelUpBanner.classList.remove("show");
    void el.levelUpBanner.offsetWidth;
    el.levelUpBanner.classList.add("show");
  }

  function createStatRows(container, rows, emptyText) {
    container.innerHTML = "";

    if (!rows.length) {
      const row = document.createElement("div");
      row.className = "empty-stat";
      row.textContent = emptyText;
      container.appendChild(row);
      return;
    }

    rows.forEach(function (item) {
      const row = document.createElement("div");
      const term = document.createElement("dt");
      const value = document.createElement("dd");

      term.textContent = item.name;
      value.textContent = "+" + item.formattedValue;

      row.appendChild(term);
      row.appendChild(value);
      container.appendChild(row);
    });
  }

  function openItemDetail(itemId) {
    const located = State.findItemById(itemId);

    if (!located) {
      closeItemDetail();
      return;
    }

    selectedItemId = itemId;

    const item = located.item;
    const rarity = Data.getRarity(item.rarity);
    const slot = Data.getItemSlot(item.slot);
    const comparison = Loot.compareWithEquipped(item);
    const baseRows = Loot.getBaseStatRows(item);
    const bonusRows = Loot.getBonusStatRows(item);

    clearRarityClasses(el.itemDetailOverlay);
    el.itemDetailOverlay.classList.add("rarity-" + item.rarity);

    el.itemDetailRarity.textContent = rarity.name;
    el.itemDetailRarity.style.color = rarity.color;
    el.itemDetailName.textContent = item.name;
    el.itemDetailMeta.textContent =
      (slot ? slot.name : item.slot) +
      " · 아이템 레벨 " + item.itemLevel +
      " · 요구 레벨 " + item.requiredLevel;

    el.itemDetailScore.textContent = String(Loot.getItemScore(item));

    el.itemDetailComparison.classList.remove("positive", "negative", "neutral");

    if (located.location === "equipment") {
      el.itemDetailComparison.textContent = "현재 장착 중";
      el.itemDetailComparison.classList.add("neutral");
    } else if (!comparison.equippedItem) {
      el.itemDetailComparison.textContent =
        "빈 슬롯 · 장착 시 +" + comparison.candidateScore;
      el.itemDetailComparison.classList.add("positive");
    } else if (comparison.difference > 0) {
      el.itemDetailComparison.textContent =
        "현재 장비보다 +" + comparison.difference;
      el.itemDetailComparison.classList.add("positive");
    } else if (comparison.difference < 0) {
      el.itemDetailComparison.textContent =
        "현재 장비보다 " + comparison.difference;
      el.itemDetailComparison.classList.add("negative");
    } else {
      el.itemDetailComparison.textContent = "현재 장비와 동일";
      el.itemDetailComparison.classList.add("neutral");
    }

    createStatRows(el.itemBaseStatList, baseRows, "기본 능력치 없음");
    createStatRows(el.itemOptionList, bonusRows, "랜덤 옵션 없음");

    const equippedItem = State.getEquippedItem(item.slot);

    if (equippedItem && equippedItem.id !== item.id) {
      el.equippedItemPreview.hidden = false;
      el.equippedItemName.textContent = equippedItem.name;
      el.equippedItemScore.textContent =
        "장비 점수 " + Loot.getItemScore(equippedItem);
    } else {
      el.equippedItemPreview.hidden = true;
    }

    const permission = State.canEquipItem(item);

    el.equipItemButton.hidden = located.location === "equipment";
    el.unequipItemButton.hidden = located.location !== "equipment";

    if (located.location === "inventory") {
      el.equipItemButton.disabled = !permission.allowed;
      el.equipItemButton.textContent = permission.allowed
        ? equippedItem
          ? "교체 장착"
          : "장착하기"
        : "요구 레벨 " + item.requiredLevel;
    }

    el.itemDetailOverlay.hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeItemDetail() {
    selectedItemId = null;

    if (el.itemDetailOverlay) {
      el.itemDetailOverlay.hidden = true;
    }

    document.body.classList.remove("modal-open");
  }

  function equipSelectedItem() {
    if (!selectedItemId) {
      return;
    }

    const result = State.equipItem(selectedItemId);

    if (!result.success) {
      if (result.reason === "level-too-low") {
        el.equipmentNotice.textContent =
          "요구 레벨 " + result.requiredLevel + " 이상에서 장착할 수 있습니다.";
      } else {
        el.equipmentNotice.textContent = "장비를 장착하지 못했습니다.";
      }

      return;
    }

    const slot = Data.getItemSlot(result.slot);

    addBattleLog(
      (slot ? slot.name : result.slot) + " 장착: " + result.item.name,
      "reward"
    );

    el.equipmentNotice.textContent =
      result.item.name + " 장착 완료 · 전투력 " +
      formatNumber(result.playerPower);

    inventoryDirty = true;
    closeItemDetail();
    renderAll();
  }

  function unequipSelectedItem() {
    if (!selectedItemId) {
      return;
    }

    const located = State.findItemById(selectedItemId);

    if (!located || located.location !== "equipment") {
      closeItemDetail();
      return;
    }

    const result = State.unequipItem(located.slot);

    if (!result.success) {
      el.equipmentNotice.textContent = result.reason === "inventory-full"
        ? "인벤토리가 가득 차 장비를 해제할 수 없습니다."
        : "장비를 해제하지 못했습니다.";

      return;
    }

    addBattleLog("장비 해제: " + result.item.name, "warning");
    el.equipmentNotice.textContent = result.item.name + " 해제 완료";

    inventoryDirty = true;
    closeItemDetail();
    renderAll();
  }

  function autoEquip() {
    const result = State.autoEquipBest();

    if (!result.changed) {
      el.equipmentNotice.textContent = "현재 장비보다 좋은 장비가 없습니다.";
      addBattleLog("자동 장착: 변경할 장비가 없습니다.");
    } else {
      el.equipmentNotice.textContent =
        result.changes.length + "개 부위를 자동 장착했습니다.";

      addBattleLog(
        "자동 장착 완료 · " + result.changes.length + "개 부위 변경",
        "reward"
      );
    }

    inventoryDirty = true;
    renderAll();
  }

  function addFloatingText(text, x, y, options) {
    if (!State.getState().settings.showDamageNumbers) {
      return;
    }

    const settings = options || {};
    const life = Number(settings.life) || 0.85;

    effects.texts.push({
      text: String(text),
      x: x,
      y: y,
      vx: Data.randomRange(-8, 8),
      vy: -74,
      life: life,
      maxLife: life,
      size: Number(settings.size) || 30,
      color: settings.color || "#ffffff",
      critical: Boolean(settings.critical)
    });
  }

  function addParticles(x, y, color, count) {
    if (State.getState().settings.reducedEffects) {
      return;
    }

    for (let index = 0; index < Math.min(16, count || 7); index += 1) {
      const angle = Data.randomRange(0, Math.PI * 2);
      const speed = Data.randomRange(45, 145);
      const life = Data.randomRange(0.25, 0.5);

      effects.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Data.randomRange(2, 6),
        color: color,
        life: life,
        maxLife: life
      });
    }
  }

  function handleCombatEvent(event) {
    const data = event.payload || {};

    switch (event.type) {
      case "monster-spawn":
        effects.flash = 0.45;
        addBattleLog(data.monster.name + " 출현 · 웨이브 " + data.wave);
        break;

      case "player-attack":
        effects.playerAttack = 0.22;
        effects.monsterHit = 0.16;

        addFloatingText(
          data.isCritical
            ? "CRIT " + formatNumber(data.damage)
            : formatNumber(data.damage),
          WIDTH * 0.76,
          HEIGHT * 0.36,
          {
            size: data.isCritical ? 42 : 30,
            color: data.isCritical ? "#ffe477" : "#ffffff",
            critical: data.isCritical,
            life: data.isCritical ? 1.05 : 0.78
          }
        );

        addParticles(
          WIDTH * 0.75,
          HEIGHT * 0.5,
          data.isCritical ? "#ffe477" : "#aeeeff",
          data.isCritical ? 12 : 7
        );

        break;

      case "monster-attack":
        effects.monsterAttack = 0.24;
        effects.playerHit = 0.18;

        addFloatingText(
          "-" + formatNumber(data.damage),
          WIDTH * 0.25,
          HEIGHT * 0.38,
          {
            color: "#ff8791",
            size: 29
          }
        );

        addParticles(
          WIDTH * 0.27,
          HEIGHT * 0.51,
          "#ff8791",
          7
        );

        break;

      case "monster-defeated":
        addBattleLog(
          data.monster.name +
          " 처치 · EXP +" +
          formatNumber(data.gainedExp) +
          " · 골드 +" +
          formatNumber(data.gainedGold),
          "reward"
        );

        if (data.loot && data.loot.dropped) {
          inventoryDirty = true;

          if (data.loot.stored) {
            const rarity = Data.getRarity(data.loot.item.rarity);

            addBattleLog(
              rarity.name + " 장비 획득: " + data.loot.item.name,
              data.loot.item.rarity === "legendary"
                ? "critical"
                : "reward"
            );
          } else {
            addBattleLog(
              "인벤토리가 가득 차 장비를 보관하지 못했습니다.",
              "warning"
            );
          }
        }

        break;

      case "level-up":
        showLevelUp(data.level, data.levelsGained);

        addBattleLog(
          "레벨 " + data.level + " 달성 · HP 전부 회복",
          "critical"
        );

        break;

      case "wave-advance":
        addBattleLog(
          "웨이브 " + data.currentWave + " 진입",
          "critical"
        );

        break;

      case "player-death":
        effects.deathFlash = 0.75;

        addBattleLog(
          "전투 불능 · " +
          data.reviveDelay.toFixed(1) +
          "초 후 부활합니다.",
          "warning"
        );

        break;

      case "player-revive":
        effects.flash = 0.45;
        addBattleLog("플레이어가 완전히 회복되었습니다.", "reward");
        break;

      default:
        break;
    }

    renderPlayer();
    renderProgression();
    renderMonster();
    renderInventoryCounts();
    renderRecentLoot();
  }

  function handleStateEvent(event) {
    if (event.type === "save") {
      setSaveStatus("저장 완료", "saved");
    }

    if (event.type === "save-error") {
      setSaveStatus("저장 실패", "error");
      addBattleLog("브라우저 저장에 실패했습니다.", "warning");
    }

    if (
      event.type === "dirty" &&
      !el.saveStatus.classList.contains("error")
    ) {
      el.saveStatus.textContent = "저장 대기";
    }

    if (
      event.type === "loot" ||
      event.type === "equipment-change" ||
      event.type === "auto-equip" ||
      event.type === "inventory-settings" ||
      event.type === "reset"
    ) {
      inventoryDirty = true;
    }

    if (event.type === "view-change") {
      renderView();
    }

    if (event.type === "reset") {
      resetVisuals();
      closeItemDetail();
      addBattleLog("게임 진행 데이터를 초기화했습니다.", "warning");
    }

    renderPlayer();
    renderSettings();
    renderInventoryCounts();
    renderRecentLoot();
    renderEquipment();

    if (!el.equipmentView.hidden) {
      renderInventory(true);
    }
  }

  function bindEvents() {
    function pauseGame() {
      const paused = State.togglePaused();

      addBattleLog(
        paused
          ? "자동 전투를 일시정지했습니다."
          : "자동 전투를 계속합니다."
      );

      renderSettings();
    }

    function resetGame() {
      const confirmed = global.confirm(
        "모든 레벨, 골드, 처치 기록과 장비를 초기화합니다.\n" +
        "이 작업은 되돌릴 수 없습니다."
      );

      if (!confirmed) {
        return;
      }

      State.reset();
      Combat.resetRuntime();
      inventoryDirty = true;
      renderAll();
      setSaveStatus("초기화 완료", "saved");
      addBattleLog("새 게임으로 다시 시작합니다.", "reward");
    }

    function clearLog() {
      el.battleLog.innerHTML = "";
    }

    el.pauseButton.addEventListener("click", pauseGame);
    el.resetButton.addEventListener("click", resetGame);
    el.clearLogButton.addEventListener("click", clearLog);

    cleanups.push(function () {
      el.pauseButton.removeEventListener("click", pauseGame);
      el.resetButton.removeEventListener("click", resetGame);
      el.clearLogButton.removeEventListener("click", clearLog);
    });

    el.speedButtons.forEach(function (button) {
      function changeSpeed() {
        const speed = State.setSpeed(Number(button.dataset.speed));

        addBattleLog("전투 속도를 " + speed + "배로 변경했습니다.");
        renderSettings();
      }

      button.addEventListener("click", changeSpeed);

      cleanups.push(function () {
        button.removeEventListener("click", changeSpeed);
      });
    });

    el.viewTabs.forEach(function (button) {
      function changeView() {
        const view = State.setActiveView(button.dataset.view);

        renderView();

        if (view === "equipment") {
          inventoryDirty = true;
          renderEquipment();
          renderInventory(true);
        } else {
          global.requestAnimationFrame(function () {
            resizeCanvas();
            renderCanvas(0);
          });
        }
      }

      button.addEventListener("click", changeView);

      cleanups.push(function () {
        button.removeEventListener("click", changeView);
      });
    });

    el.equipmentSlots.forEach(function (button) {
      function openEquippedItem() {
        const item = State.getEquippedItem(button.dataset.slot);

        if (item) {
          openItemDetail(item.id);
        } else {
          el.equipmentNotice.textContent =
            "해당 부위가 비어 있습니다. 인벤토리에서 장비를 선택하세요.";
        }
      }

      button.addEventListener("click", openEquippedItem);

      cleanups.push(function () {
        button.removeEventListener("click", openEquippedItem);
      });
    });

    function handleInventoryClick(event) {
      const card = event.target.closest(".inventory-card[data-item-id]");

      if (!card || !el.inventoryGrid.contains(card)) {
        return;
      }

      openItemDetail(card.dataset.itemId);
    }

    el.inventoryGrid.addEventListener("click", handleInventoryClick);

    cleanups.push(function () {
      el.inventoryGrid.removeEventListener("click", handleInventoryClick);
    });

    function changeSort() {
      const current =
        State.getState().settings.inventorySort ||
        "newest";

      const next = Loot.getNextSort(current);

      State.setInventorySort(next);
      inventoryDirty = true;
      renderInventory(true);
    }

    el.inventorySortButton.addEventListener("click", changeSort);

    cleanups.push(function () {
      el.inventorySortButton.removeEventListener("click", changeSort);
    });

    function changeFilters() {
      State.setInventoryFilters(
        el.slotFilter.value,
        el.rarityFilter.value
      );

      inventoryDirty = true;
      renderInventory(true);
    }

    el.slotFilter.addEventListener("change", changeFilters);
    el.rarityFilter.addEventListener("change", changeFilters);

    cleanups.push(function () {
      el.slotFilter.removeEventListener("change", changeFilters);
      el.rarityFilter.removeEventListener("change", changeFilters);
    });

    el.autoEquipButton.addEventListener("click", autoEquip);
    el.equipItemButton.addEventListener("click", equipSelectedItem);
    el.unequipItemButton.addEventListener("click", unequipSelectedItem);
    el.itemDetailBackdrop.addEventListener("click", closeItemDetail);
    el.itemDetailCloseButton.addEventListener("click", closeItemDetail);

    cleanups.push(function () {
      el.autoEquipButton.removeEventListener("click", autoEquip);
      el.equipItemButton.removeEventListener("click", equipSelectedItem);
      el.unequipItemButton.removeEventListener("click", unequipSelectedItem);
      el.itemDetailBackdrop.removeEventListener("click", closeItemDetail);
      el.itemDetailCloseButton.removeEventListener("click", closeItemDetail);
    });

    function closeWithEscape(event) {
      if (
        event.key === "Escape" &&
        !el.itemDetailOverlay.hidden
      ) {
        closeItemDetail();
      }
    }

    document.addEventListener("keydown", closeWithEscape);

    cleanups.push(function () {
      document.removeEventListener("keydown", closeWithEscape);
    });

    cleanups.push(State.subscribe(handleStateEvent));
    cleanups.push(Combat.subscribe(handleCombatEvent));
  }

  function resizeCanvas() {
    if (!canvas || !ctx) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(
      2,
      Math.max(
        1,
        global.devicePixelRatio || 1
      )
    );

    const width = Math.max(
      1,
      rect.width || 720
    );

    const height = Math.max(
      1,
      rect.height || width
    );

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.imageSmoothingEnabled = true;
  }

  function roundedRect(x, y, width, height, radius) {
    const r = Math.min(
      radius,
      width / 2,
      height / 2
    );

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(
      x + width,
      y,
      x + width,
      y + r
    );

    ctx.lineTo(
      x + width,
      y + height - r
    );

    ctx.quadraticCurveTo(
      x + width,
      y + height,
      x + width - r,
      y + height
    );

    ctx.lineTo(
      x + r,
      y + height
    );

    ctx.quadraticCurveTo(
      x,
      y + height,
      x,
      y + height - r
    );

    ctx.lineTo(
      x,
      y + r
    );

    ctx.quadraticCurveTo(
      x,
      y,
      x + r,
      y
    );

    ctx.closePath();
  }

  function drawBackground(region) {
    const colors =
      region.background ||
      Data.REGIONS[0].background;

    const gradient =
      ctx.createLinearGradient(
        0,
        0,
        0,
        HEIGHT
      );

    gradient.addColorStop(
      0,
      colors.skyTop
    );

    gradient.addColorStop(
      0.7,
      colors.skyBottom
    );

    gradient.addColorStop(
      1,
      colors.ground
    );

    ctx.fillStyle = gradient;
    ctx.fillRect(
      0,
      0,
      WIDTH,
      HEIGHT
    );

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = colors.accent;

    for (
      let index = 0;
      index < 7;
      index += 1
    ) {
      const x =
        20 +
        index * 115;

      const height =
        90 +
        index % 3 * 36;

      ctx.beginPath();
      ctx.moveTo(x, 470);
      ctx.lineTo(
        x + 38,
        470 - height
      );

      ctx.lineTo(
        x + 76,
        470
      );

      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();

    ctx.fillStyle =
      "rgba(0,0,0,0.25)";

    ctx.beginPath();

    ctx.ellipse(
      WIDTH / 2,
      HEIGHT * 0.73,
      WIDTH * 0.47,
      76,
      0,
      0,
      Math.PI * 2
    );

    ctx.fill();

    for (
      let index = 0;
      index < 20;
      index += 1
    ) {
      const x =
        index * 137 % WIDTH;

      const y =
        55 +
        index * 83 % 290;

      const alpha =
        0.15 +
        Math.sin(
          effects.time * 1.4 +
          index
        ) * 0.08;

      ctx.fillStyle =
        "rgba(205,240,255," +
        Math.max(
          0.05,
          alpha
        ) +
        ")";

      ctx.beginPath();

      ctx.arc(
        x,
        y,
        1 + index % 3,
        0,
        Math.PI * 2
      );

      ctx.fill();
    }
  }

  function drawAura(x, y, color) {
    const gradient =
      ctx.createRadialGradient(
        x,
        y,
        10,
        x,
        y,
        105
      );

    gradient.addColorStop(
      0,
      color
    );

    gradient.addColorStop(
      1,
      "rgba(0,0,0,0)"
    );

    ctx.fillStyle = gradient;
    ctx.beginPath();

    ctx.arc(
      x,
      y,
      105,
      0,
      Math.PI * 2
    );

    ctx.fill();
  }

  function getPlayerAuraColor() {
    const weapon =
      State.getState()
        .equipment
        .weapon;

    if (!weapon) {
      return "rgba(86,211,255,0.28)";
    }

    const rarity =
      Data.getRarity(
        weapon.rarity
      );

    return (
      rarity.glow ||
      "rgba(86,211,255,0.28)"
    );
  }

  function drawPlayerShape() {
    const player =
      State.getState().player;

    const alive =
      player.currentHp > 0;

    const attack =
      effects.playerAttack > 0
        ? Math.sin(
            (
              1 -
              effects.playerAttack /
              0.22
            ) *
            Math.PI
          )
        : 0;

    const shake =
      effects.playerHit > 0
        ? Math.sin(
            effects.playerHit *
            80
          ) * 8
        : 0;

    const x =
      WIDTH * 0.27 +
      attack * 46 +
      shake;

    const y =
      HEIGHT * 0.56 +
      (
        alive
          ? Math.sin(
              effects.time *
              3.3
            ) * 3
          : 0
      );

    drawAura(
      x,
      y + 15,
      getPlayerAuraColor()
    );

    ctx.save();
    ctx.translate(x, y);

    if (!alive) {
      ctx.rotate(
        -Math.PI * 0.42
      );

      ctx.globalAlpha = 0.55;
    }

    if (
      effects.playerHit > 0
    ) {
      ctx.shadowColor =
        "#ff8b94";

      ctx.shadowBlur = 24;
    }

    ctx.fillStyle =
      "rgba(0,0,0,0.34)";

    ctx.beginPath();

    ctx.ellipse(
      0,
      104,
      70,
      18,
      0,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.strokeStyle =
      "#d8f7ff";

    ctx.lineWidth = 8;
    ctx.lineCap = "round";

    ctx.beginPath();

    ctx.moveTo(-22, 52);
    ctx.lineTo(-34, 96);

    ctx.moveTo(22, 52);
    ctx.lineTo(36, 96);

    ctx.stroke();

    const armor =
      ctx.createLinearGradient(
        -45,
        -35,
        45,
        65
      );

    armor.addColorStop(
      0,
      "#6fe7ff"
    );

    armor.addColorStop(
      0.5,
      "#477ec9"
    );

    armor.addColorStop(
      1,
      "#25436f"
    );

    ctx.fillStyle = armor;

    roundedRect(
      -48,
      -42,
      96,
      112,
      26
    );

    ctx.fill();

    ctx.strokeStyle =
      "rgba(220,248,255,0.72)";

    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.fillStyle =
      "#f3d0b0";

    ctx.beginPath();

    ctx.arc(
      0,
      -72,
      34,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.fillStyle =
      "#2a3e63";

    ctx.beginPath();

    ctx.arc(
      0,
      -77,
      36,
      Math.PI,
      Math.PI * 2
    );

    ctx.fill();

    ctx.fillStyle =
      "#d8f7ff";

    ctx.fillRect(
      10,
      -76,
      8,
      5
    );

    ctx.save();

    ctx.translate(
      42,
      5
    );

    ctx.rotate(
      -0.55 +
      attack * 1.75
    );

    const weapon =
      State.getState()
        .equipment
        .weapon;

    const weaponColor =
      weapon
        ? Data.getRarity(
            weapon.rarity
          ).color
        : "#8ce9ff";

    ctx.strokeStyle =
      weaponColor;

    ctx.lineWidth = 12;
    ctx.beginPath();

    ctx.moveTo(8, 36);
    ctx.lineTo(82, -32);

    ctx.stroke();

    ctx.strokeStyle =
      "#ffffff";

    ctx.lineWidth = 4;
    ctx.beginPath();

    ctx.moveTo(16, 28);
    ctx.lineTo(82, -32);

    ctx.stroke();
    ctx.restore();

    if (
      effects.playerAttack > 0 &&
      !State.getState()
        .settings
        .reducedEffects
    ) {
      ctx.globalAlpha = 0.48;
      ctx.strokeStyle =
        weaponColor;

      ctx.lineWidth = 12;
      ctx.beginPath();

      ctx.arc(
        35,
        4,
        110,
        -1.4,
        0.55
      );

      ctx.stroke();
    }

    ctx.restore();
  }

  function drawSlime(monster) {
    ctx.fillStyle = monster.color;
    ctx.beginPath();

    ctx.moveTo(-72, 66);

    ctx.quadraticCurveTo(
      -88,
      8,
      -45,
      -42
    );

    ctx.quadraticCurveTo(
      0,
      -86,
      48,
      -40
    );

    ctx.quadraticCurveTo(
      88,
      5,
      72,
      66
    );

    ctx.quadraticCurveTo(
      0,
      98,
      -72,
      66
    );

    ctx.fill();

    ctx.fillStyle =
      "#13202b";

    ctx.beginPath();

    ctx.arc(
      -24,
      10,
      8,
      0,
      Math.PI * 2
    );

    ctx.arc(
      24,
      10,
      8,
      0,
      Math.PI * 2
    );

    ctx.fill();
  }

  function drawWolf(monster) {
    ctx.fillStyle = monster.color;
    ctx.beginPath();

    ctx.ellipse(
      0,
      20,
      72,
      46,
      0,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.beginPath();

    ctx.moveTo(-28, -34);
    ctx.lineTo(-52, -83);
    ctx.lineTo(-3, -56);
    ctx.lineTo(40, -78);
    ctx.lineTo(32, -25);
    ctx.closePath();

    ctx.fill();

    ctx.strokeStyle =
      monster.color;

    ctx.lineWidth = 16;
    ctx.lineCap = "round";

    ctx.beginPath();

    ctx.moveTo(-52, 50);
    ctx.lineTo(-62, 92);

    ctx.moveTo(35, 52);
    ctx.lineTo(52, 94);

    ctx.moveTo(64, 12);

    ctx.quadraticCurveTo(
      112,
      -8,
      104,
      -58
    );

    ctx.stroke();

    ctx.fillStyle =
      "#ffe37a";

    ctx.beginPath();

    ctx.arc(
      -19,
      -38,
      7,
      0,
      Math.PI * 2
    );

    ctx.fill();
  }

  function drawGoblin(monster) {
    ctx.fillStyle =
      "#50402f";

    roundedRect(
      -42,
      0,
      84,
      90,
      18
    );

    ctx.fill();

    ctx.fillStyle =
      monster.color;

    ctx.beginPath();

    ctx.arc(
      0,
      -35,
      47,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.beginPath();

    ctx.moveTo(-36, -50);
    ctx.lineTo(-90, -38);
    ctx.lineTo(-38, -18);

    ctx.moveTo(36, -50);
    ctx.lineTo(90, -38);
    ctx.lineTo(38, -18);

    ctx.fill();

    ctx.fillStyle =
      monster.accentColor;

    ctx.beginPath();

    ctx.arc(
      -17,
      -42,
      7,
      0,
      Math.PI * 2
    );

    ctx.arc(
      17,
      -42,
      7,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.strokeStyle =
      "#8f7555";

    ctx.lineWidth = 12;
    ctx.beginPath();

    ctx.moveTo(35, 22);
    ctx.lineTo(86, -35);

    ctx.stroke();
  }

  function drawMonsterShape() {
    const runtime =
      Combat.getRuntimeSnapshot();

    const monster =
      runtime.currentMonster;

    if (!monster) {
      if (
        runtime.status !==
        "player-dead"
      ) {
        ctx.fillStyle =
          "rgba(220,238,249,0.65)";

        ctx.font =
          "700 24px system-ui, sans-serif";

        ctx.textAlign =
          "center";

        ctx.fillText(
          "다음 몬스터 출현 준비 중",
          WIDTH * 0.72,
          HEIGHT * 0.52
        );
      }

      return;
    }

    const attack =
      effects.monsterAttack > 0
        ? Math.sin(
            (
              1 -
              effects.monsterAttack /
              0.24
            ) *
            Math.PI
          )
        : 0;

    const shake =
      effects.monsterHit > 0
        ? Math.sin(
            effects.monsterHit *
            95
          ) * 10
        : 0;

    const x =
      WIDTH * 0.74 -
      attack * 44 +
      shake;

    const y =
      HEIGHT * 0.56 +
      Math.sin(
        effects.time * 3.1
      ) * 3;

    drawAura(
      x,
      y + 15,

      monster.shadowColor ||
        "rgba(255,80,80,0.25)"
    );

    ctx.save();
    ctx.translate(x, y);

    if (
      effects.monsterHit > 0
    ) {
      ctx.shadowColor =
        "#ffffff";

      ctx.shadowBlur = 28;
    }

    if (
      monster.shape === "wolf"
    ) {
      drawWolf(monster);
    } else if (
      monster.shape === "goblin"
    ) {
      drawGoblin(monster);
    } else {
      drawSlime(monster);
    }

    ctx.restore();
  }

  function updateEffects(deltaSeconds) {
    const delta = Math.min(
      0.1,
      Math.max(
        0,
        Number(deltaSeconds) || 0
      )
    );

    effects.time += delta;

    [
      "playerAttack",
      "monsterAttack",
      "playerHit",
      "monsterHit",
      "flash",
      "deathFlash"
    ].forEach(function (key) {
      effects[key] = Math.max(
        0,
        effects[key] - delta
      );
    });

    effects.texts =
      effects.texts.filter(
        function (item) {
          item.life -= delta;
          item.x += item.vx * delta;
          item.y += item.vy * delta;
          item.vy += 16 * delta;

          return item.life > 0;
        }
      );

    effects.particles =
      effects.particles.filter(
        function (item) {
          item.life -= delta;
          item.x += item.vx * delta;
          item.y += item.vy * delta;

          item.vx *=
            Math.pow(
              0.1,
              delta
            );

          item.vy *=
            Math.pow(
              0.1,
              delta
            );

          return item.life > 0;
        }
      );
  }

  function drawEffects() {
    effects.particles.forEach(
      function (item) {
        ctx.save();

        ctx.globalAlpha =
          clamp01(
            item.life /
            item.maxLife
          );

        ctx.fillStyle =
          item.color;

        ctx.beginPath();

        ctx.arc(
          item.x,
          item.y,
          item.radius,
          0,
          Math.PI * 2
        );

        ctx.fill();
        ctx.restore();
      }
    );

    effects.texts.forEach(
      function (item) {
        const alpha =
          clamp01(
            item.life /
            item.maxLife
          );

        const scale =
          item.critical
            ? 1 +
              Math.sin(
                (
                  1 -
                  alpha
                ) *
                Math.PI
              ) *
              0.18
            : 1;

        ctx.save();

        ctx.globalAlpha =
          alpha;

        ctx.translate(
          item.x,
          item.y
        );

        ctx.scale(
          scale,
          scale
        );

        ctx.textAlign =
          "center";

        ctx.font =
          (
            item.critical
              ? "900 "
              : "800 "
          ) +
          item.size +
          "px system-ui, sans-serif";

        ctx.lineWidth =
          Math.max(
            4,
            item.size * 0.16
          );

        ctx.strokeStyle =
          "rgba(4,7,14,0.8)";

        ctx.strokeText(
          item.text,
          0,
          0
        );

        ctx.fillStyle =
          item.color;

        ctx.fillText(
          item.text,
          0,
          0
        );

        ctx.restore();
      }
    );

    if (effects.flash > 0) {
      ctx.fillStyle =
        "rgba(126,229,255," +
        clamp01(
          effects.flash /
          0.45
        ) *
        0.16 +
        ")";

      ctx.fillRect(
        0,
        0,
        WIDTH,
        HEIGHT
      );
    }

    if (
      effects.deathFlash > 0
    ) {
      ctx.fillStyle =
        "rgba(170,20,32," +
        clamp01(
          effects.deathFlash /
          0.75
        ) *
        0.3 +
        ")";

      ctx.fillRect(
        0,
        0,
        WIDTH,
        HEIGHT
      );
    }
  }

  function renderCanvas(deltaSeconds) {
    if (!ctx) {
      return;
    }

    updateEffects(
      deltaSeconds
    );

    const state =
      State.getState();

    const region =
      Data.getRegion(
        state.progression
          .currentRegionId
      );

    ctx.save();

    ctx.setTransform(
      canvas.width / WIDTH,
      0,
      0,
      canvas.height / HEIGHT,
      0,
      0
    );

    drawBackground(region);
    drawPlayerShape();
    drawMonsterShape();
    drawEffects();

    ctx.restore();
  }

  function update(deltaSeconds) {
    if (!initialized) {
      return;
    }

    if (!el.huntView.hidden) {
      renderCanvas(deltaSeconds);
      renderMonster();
      renderProgression();
    }

    renderPlayer();
    renderSettings();

    if (!el.equipmentView.hidden) {
      renderEquipment();
      renderInventory(false);
    }
  }

  function resetVisuals() {
    effects.time = 0;
    effects.playerAttack = 0;
    effects.monsterAttack = 0;
    effects.playerHit = 0;
    effects.monsterHit = 0;
    effects.flash = 0;
    effects.deathFlash = 0;
    effects.texts = [];
    effects.particles = [];

    if (el.battleLog) {
      el.battleLog.innerHTML = "";
    }
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

    global.addEventListener(
      "resize",
      handleResize
    );

    cleanups.push(function () {
      global.removeEventListener(
        "resize",
        handleResize
      );
    });

    initialized = true;
    inventoryDirty = true;

    renderAll();
    renderCanvas(0);
    setSaveStatus("자동 저장 중");
    addBattleLog("자동 사냥을 시작합니다.", "reward");

    return true;
  }

  function destroy() {
    closeItemDetail();

    while (
      cleanups.length > 0
    ) {
      const cleanup =
        cleanups.pop();

      try {
        cleanup();
      } catch (error) {
        console.warn(
          "UI 이벤트 정리 중 오류가 발생했습니다.",
          error
        );
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
