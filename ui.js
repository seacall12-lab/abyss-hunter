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
  const fx = {
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

  let initialized = false;
  let canvas = null;
  let ctx = null;
  let statusTimer = 0;
  const WIDTH = 720;
  const HEIGHT = 720;

  function $(id) {
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
      "lootPreview",
      "battleLog",
      "clearLogButton"
    ].forEach(function (id) {
      el[id] = $(id);
    });

    el.speedButtons = Array.from(
      document.querySelectorAll(".speed-button")
    );

    canvas = $("gameCanvas");

    ctx = canvas.getContext("2d", {
      alpha: false
    });

    if (!ctx) {
      throw new Error(
        "Canvas 2D context를 생성하지 못했습니다."
      );
    }
  }

  function clamp01(value) {
    return Math.min(
      1,
      Math.max(0, Number(value) || 0)
    );
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
      return (
        (number / 1000).toFixed(
          number >= 10000 ? 0 : 1
        ) + "K"
      );
    }

    if (Math.abs(number) < 1000000000) {
      return (
        (number / 1000000).toFixed(
          number >= 10000000 ? 0 : 1
        ) + "M"
      );
    }

    return (
      (number / 1000000000).toFixed(1) +
      "B"
    );
  }

  function formatPercent(value) {
    const number = Number(value);

    return Number.isFinite(number)
      ? (number * 100).toFixed(1) + "%"
      : "0%";
  }

  function setBar(
    fill,
    current,
    maximum
  ) {
    const max = Math.max(
      1,
      Number(maximum) || 1
    );

    const now = Math.min(
      max,
      Math.max(
        0,
        Number(current) || 0
      )
    );

    fill.style.width =
      (
        now /
        max *
        100
      ).toFixed(2) + "%";

    if (fill.parentElement) {
      fill.parentElement.setAttribute(
        "aria-valuemax",
        String(Math.round(max))
      );

      fill.parentElement.setAttribute(
        "aria-valuenow",
        String(Math.round(now))
      );
    }
  }

  function renderPlayer() {
    const state = State.getState();
    const player = state.player;

    el.playerLevel.textContent =
      player.level;

    el.playerPower.textContent =
      "전투력 " +
      formatNumber(player.power);

    el.goldAmount.textContent =
      formatNumber(
        state.currencies.gold
      );

    el.expText.textContent =
      formatNumber(player.exp) +
      " / " +
      formatNumber(
        player.expToNext
      );

    setBar(
      el.expFill,
      player.exp,
      player.expToNext
    );

    el.playerName.textContent =
      player.name;

    el.playerHpText.textContent =
      formatNumber(
        player.currentHp
      ) +
      " / " +
      formatNumber(
        player.maxHp
      );

    setBar(
      el.playerHpFill,
      player.currentHp,
      player.maxHp
    );

    el.attackStat.textContent =
      String(
        Math.round(
          player.attack * 10
        ) / 10
      );

    el.defenseStat.textContent =
      String(
        Math.round(
          player.defense * 10
        ) / 10
      );

    el.attackSpeedStat.textContent =
      player.attackSpeed.toFixed(2) +
      "회/초";

    el.critStat.textContent =
      formatPercent(
        player.critChance
      );
  }

  function renderProgression() {
    const state = State.getState();
    const progress =
      state.progression;

    const region =
      Data.getRegion(
        progress.currentRegionId
      );

    el.regionName.textContent =
      region.name;

    el.waveText.textContent =
      "웨이브 " +
      formatNumber(
        progress.currentWave
      ) +
      " · " +
      progress.defeatedInWave +
      "/" +
      CONFIG.MONSTERS_PER_WAVE;

    el.totalKills.textContent =
      formatNumber(
        state.statistics.totalKills
      );
  }

  function renderMonster() {
    const runtime =
      Combat.getRuntimeSnapshot();

    const monster =
      runtime.currentMonster;

    if (!monster) {
      const dead =
        runtime.status ===
        "player-dead";

      el.monsterTypeLabel.textContent =
        dead
          ? "부활 대기"
          : "다음 적 준비";

      el.monsterName.textContent =
        dead
          ? Math.max(
              0,
              runtime.reviveTimer
            ).toFixed(1) + "초"
          : "곧 출현합니다";

      el.monsterHpText.textContent =
        "0 / 0";

      setBar(
        el.monsterHpFill,
        0,
        1
      );

      return;
    }

    el.monsterTypeLabel.textContent =
      monster.isBoss
        ? "지역 보스"
        : "일반 몬스터 · LV " +
          monster.level;

    el.monsterName.textContent =
      monster.name;

    el.monsterHpText.textContent =
      formatNumber(
        monster.currentHp
      ) +
      " / " +
      formatNumber(
        monster.maxHp
      );

    setBar(
      el.monsterHpFill,
      monster.currentHp,
      monster.maxHp
    );
  }

  function renderSettings() {
    const settings =
      State.getState().settings;

    el.speedButtons.forEach(
      function (button) {
        const active =
          Number(
            button.dataset.speed
          ) ===
          Number(settings.speed);

        button.classList.toggle(
          "active",
          active
        );

        button.setAttribute(
          "aria-pressed",
          String(active)
        );
      }
    );

    el.pauseButton.innerHTML =
      settings.paused
        ? '<span aria-hidden="true">▶</span>'
        : '<span aria-hidden="true">Ⅱ</span>';

    el.pauseButton.setAttribute(
      "aria-label",
      settings.paused
        ? "게임 계속하기"
        : "게임 일시정지"
    );

    el.pauseButton.title =
      settings.paused
        ? "계속하기"
        : "일시정지";

    el.pauseOverlay.hidden =
      !settings.paused;
  }

  function getPrimaryStat(item) {
    if (
      !item ||
      !item.baseStats
    ) {
      return null;
    }

    const key =
      Object.keys(
        item.baseStats
      )[0];

    if (!key) {
      return null;
    }

    return {
      key: key,

      value:
        item.baseStats[key],

      type: [
        "attackSpeed",
        "critChance",
        "critDamage",
        "lifesteal",
        "bossDamage",
        "normalDamage",
        "goldBonus"
      ].includes(key)
        ? "ratio"
        : "flat"
    };
  }

  function statName(key) {
    const affix =
      Data.ITEM_AFFIXES.find(
        function (item) {
          return item.stat === key;
        }
      );

    return affix
      ? affix.name
      : key;
  }

  function renderLoot() {
    const item =
      State.getState().recentLoot;

    const container =
      el.lootPreview;

    container.classList.remove(
      "empty",
      "rarity-common",
      "rarity-rare",
      "rarity-epic",
      "rarity-legendary"
    );

    if (!item) {
      container.classList.add(
        "empty"
      );

      container.innerHTML =
        '<span class="loot-orb" aria-hidden="true"></span>' +
        '<div><strong>드롭 없음</strong>' +
        '<p>낮은 확률로 장비 흔적을 발견할 수 있습니다.</p></div>';

      return;
    }

    const rarity =
      Data.getRarity(
        item.rarity
      );

    const slot =
      Data.getItemSlot(
        item.slot
      );

    const primary =
      getPrimaryStat(item);

    const details = [
      rarity.name,

      slot
        ? slot.name
        : item.slot,

      "장비 점수 " +
        formatNumber(
          Loot.getItemScore(item)
        )
    ];

    if (primary) {
      details.push(
        statName(primary.key) +
        " +" +
        Loot.formatStatValue(
          primary.value,
          primary.type
        )
      );
    }

    container.classList.add(
      "rarity-" +
      item.rarity
    );

    container.innerHTML =
      '<span class="loot-orb" aria-hidden="true"></span>' +
      '<div><strong></strong><p></p></div>';

    container
      .querySelector("strong")
      .textContent =
      item.name;

    container
      .querySelector("p")
      .textContent =
      details.join(" · ");
  }

  function renderAll() {
    renderPlayer();
    renderProgression();
    renderMonster();
    renderSettings();
    renderLoot();
  }

  function setSaveStatus(
    text,
    type
  ) {
    clearTimeout(
      statusTimer
    );

    el.saveStatus.textContent =
      text;

    el.saveStatus.classList.remove(
      "saved",
      "error"
    );

    if (type) {
      el.saveStatus.classList.add(
        type
      );
    }

    if (type === "saved") {
      statusTimer =
        global.setTimeout(
          function () {
            el.saveStatus.textContent =
              "자동 저장 중";

            el.saveStatus.classList.remove(
              "saved"
            );
          },
          1800
        );
    }
  }

  function addBattleLog(
    message,
    type
  ) {
    if (!message) {
      return;
    }

    const row =
      document.createElement("li");

    const time =
      document.createElement("time");

    const text =
      document.createElement("span");

    const now = new Date();

    time.textContent = [
      now.getHours(),
      now.getMinutes(),
      now.getSeconds()
    ]
      .map(
        function (value) {
          return String(value)
            .padStart(2, "0");
        }
      )
      .join(":");

    text.textContent = message;

    if (type) {
      text.classList.add(type);
    }

    row.appendChild(time);
    row.appendChild(text);

    el.battleLog.insertBefore(
      row,
      el.battleLog.firstChild
    );

    while (
      el.battleLog.children.length >
      CONFIG.MAX_BATTLE_LOGS
    ) {
      el.battleLog.removeChild(
        el.battleLog.lastChild
      );
    }
  }

  function showLevelUp(
    level,
    count
  ) {
    el.levelUpBanner.textContent =
      count > 1
        ? "LEVEL UP ×" +
          count +
          " · LV " +
          level
        : "LEVEL UP! · LV " +
          level;

    el.levelUpBanner.classList.remove(
      "show"
    );

    void el.levelUpBanner.offsetWidth;

    el.levelUpBanner.classList.add(
      "show"
    );
  }

  function addFloatingText(
    text,
    x,
    y,
    options
  ) {
    if (
      !State.getState()
        .settings
        .showDamageNumbers
    ) {
      return;
    }

    const opt =
      options || {};

    const life =
      Number(opt.life) ||
      0.85;

    fx.texts.push({
      text: String(text),
      x: x,
      y: y,

      vx:
        Data.randomRange(
          -8,
          8
        ),

      vy: -74,

      life: life,
      maxLife: life,

      size:
        Number(opt.size) ||
        30,

      color:
        opt.color ||
        "#ffffff",

      critical:
        Boolean(
          opt.critical
        )
    });
  }

  function addParticles(
    x,
    y,
    color,
    count
  ) {
    if (
      State.getState()
        .settings
        .reducedEffects
    ) {
      return;
    }

    for (
      let index = 0;
      index <
      Math.min(
        16,
        count || 7
      );
      index += 1
    ) {
      const angle =
        Data.randomRange(
          0,
          Math.PI * 2
        );

      const speed =
        Data.randomRange(
          45,
          145
        );

      const life =
        Data.randomRange(
          0.25,
          0.5
        );

      fx.particles.push({
        x: x,
        y: y,

        vx:
          Math.cos(angle) *
          speed,

        vy:
          Math.sin(angle) *
          speed,

        radius:
          Data.randomRange(
            2,
            6
          ),

        color: color,
        life: life,
        maxLife: life
      });
    }
  }

  function handleCombatEvent(event) {
    const data =
      event.payload || {};

    switch (event.type) {
      case "monster-spawn":
        fx.flash = 0.45;

        addBattleLog(
          data.monster.name +
          " 출현 · 웨이브 " +
          data.wave
        );

        break;

      case "player-attack":
        fx.playerAttack = 0.22;
        fx.monsterHit = 0.16;

        addFloatingText(
          data.isCritical
            ? "CRIT " +
              formatNumber(
                data.damage
              )
            : formatNumber(
                data.damage
              ),

          WIDTH * 0.76,
          HEIGHT * 0.36,

          {
            size:
              data.isCritical
                ? 42
                : 30,

            color:
              data.isCritical
                ? "#ffe477"
                : "#ffffff",

            critical:
              data.isCritical,

            life:
              data.isCritical
                ? 1.05
                : 0.78
          }
        );

        addParticles(
          WIDTH * 0.75,
          HEIGHT * 0.5,

          data.isCritical
            ? "#ffe477"
            : "#aeeeff",

          data.isCritical
            ? 12
            : 7
        );

        break;

      case "monster-attack":
        fx.monsterAttack = 0.24;
        fx.playerHit = 0.18;

        addFloatingText(
          "-" +
          formatNumber(
            data.damage
          ),

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
          formatNumber(
            data.gainedExp
          ) +
          " · 골드 +" +
          formatNumber(
            data.gainedGold
          ),

          "reward"
        );

        if (
          data.loot &&
          data.loot.dropped
        ) {
          if (data.loot.stored) {
            const rarity =
              Data.getRarity(
                data.loot
                  .item
                  .rarity
              );

            addBattleLog(
              rarity.name +
              " 장비 획득: " +
              data.loot
                .item
                .name,

              data.loot
                .item
                .rarity ===
                "legendary"
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
        showLevelUp(
          data.level,
          data.levelsGained
        );

        addBattleLog(
          "레벨 " +
          data.level +
          " 달성 · HP 전부 회복",

          "critical"
        );

        break;

      case "wave-advance":
        addBattleLog(
          "웨이브 " +
          data.currentWave +
          " 진입",

          "critical"
        );

        break;

      case "player-death":
        fx.deathFlash = 0.75;

        addBattleLog(
          "전투 불능 · " +
          data.reviveDelay.toFixed(1) +
          "초 후 부활합니다.",

          "warning"
        );

        break;

      case "player-revive":
        fx.flash = 0.45;

        addBattleLog(
          "플레이어가 완전히 회복되었습니다.",
          "reward"
        );

        break;

      default:
        break;
    }

    renderAll();
  }

  function handleStateEvent(event) {
    if (event.type === "save") {
      setSaveStatus(
        "저장 완료",
        "saved"
      );
    }

    if (
      event.type ===
      "save-error"
    ) {
      setSaveStatus(
        "저장 실패",
        "error"
      );

      addBattleLog(
        "브라우저 저장에 실패했습니다.",
        "warning"
      );
    }

    if (
      event.type === "dirty" &&
      !el.saveStatus
        .classList
        .contains("error")
    ) {
      el.saveStatus.textContent =
        "저장 대기";
    }

    if (
      event.type ===
      "reset"
    ) {
      resetVisuals();

      addBattleLog(
        "게임 진행 데이터를 초기화했습니다.",
        "warning"
      );
    }

    renderAll();
  }

  function bindEvents() {
    function pause() {
      const paused =
        State.togglePaused();

      addBattleLog(
        paused
          ? "자동 전투를 일시정지했습니다."
          : "자동 전투를 계속합니다."
      );

      renderSettings();
    }

    function reset() {
      const confirmed =
        global.confirm(
          "모든 레벨, 골드, 처치 기록과 장비를 초기화합니다.\n" +
          "이 작업은 되돌릴 수 없습니다."
        );

      if (!confirmed) {
        return;
      }

      State.reset();
      Combat.resetRuntime();
      renderAll();

      setSaveStatus(
        "초기화 완료",
        "saved"
      );

      addBattleLog(
        "새 게임으로 다시 시작합니다.",
        "reward"
      );
    }

    function clearLog() {
      el.battleLog.innerHTML = "";
    }

    el.pauseButton.addEventListener(
      "click",
      pause
    );

    el.resetButton.addEventListener(
      "click",
      reset
    );

    el.clearLogButton.addEventListener(
      "click",
      clearLog
    );

    cleanups.push(function () {
      el.pauseButton.removeEventListener(
        "click",
        pause
      );

      el.resetButton.removeEventListener(
        "click",
        reset
      );

      el.clearLogButton.removeEventListener(
        "click",
        clearLog
      );
    });

    el.speedButtons.forEach(
      function (button) {
        function changeSpeed() {
          const speed =
            State.setSpeed(
              Number(
                button.dataset.speed
              )
            );

          addBattleLog(
            "전투 속도를 " +
            speed +
            "배로 변경했습니다."
          );

          renderSettings();
        }

        button.addEventListener(
          "click",
          changeSpeed
        );

        cleanups.push(function () {
          button.removeEventListener(
            "click",
            changeSpeed
          );
        });
      }
    );

    cleanups.push(
      State.subscribe(
        handleStateEvent
      )
    );

    cleanups.push(
      Combat.subscribe(
        handleCombatEvent
      )
    );
  }

  function resizeCanvas() {
    const rect =
      canvas.getBoundingClientRect();

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

    canvas.width =
      Math.round(
        width * dpr
      );

    canvas.height =
      Math.round(
        height * dpr
      );

    ctx.imageSmoothingEnabled =
      true;
  }

  function roundedRect(
    x,
    y,
    width,
    height,
    radius
  ) {
    const r = Math.min(
      radius,
      width / 2,
      height / 2
    );

    ctx.beginPath();

    ctx.moveTo(
      x + r,
      y
    );

    ctx.lineTo(
      x + width - r,
      y
    );

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

      ctx.moveTo(
        x,
        470
      );

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
        (
          index * 137
        ) % WIDTH;

      const y =
        55 +
        (
          index * 83
        ) % 290;

      const alpha =
        0.15 +
        Math.sin(
          fx.time * 1.4 +
          index
        ) *
        0.08;

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

  function drawAura(
    x,
    y,
    color
  ) {
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

  function drawPlayerShape() {
    const player =
      State.getState().player;

    const alive =
      player.currentHp > 0;

    const attack =
      fx.playerAttack > 0
        ? Math.sin(
            (
              1 -
              fx.playerAttack /
              0.22
            ) *
            Math.PI
          )
        : 0;

    const shake =
      fx.playerHit > 0
        ? Math.sin(
            fx.playerHit * 80
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
              fx.time * 3.3
            ) * 3
          : 0
      );

    drawAura(
      x,
      y + 15,
      "rgba(86,211,255,0.28)"
    );

    ctx.save();
    ctx.translate(x, y);

    if (!alive) {
      ctx.rotate(
        -Math.PI * 0.42
      );

      ctx.globalAlpha = 0.55;
    }

    if (fx.playerHit > 0) {
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

    ctx.strokeStyle =
      "#8ce9ff";

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
      fx.playerAttack > 0 &&
      !State.getState()
        .settings
        .reducedEffects
    ) {
      ctx.globalAlpha = 0.48;
      ctx.strokeStyle =
        "#b9f6ff";

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
    ctx.fillStyle =
      monster.color;

    ctx.beginPath();

    ctx.moveTo(
      -72,
      66
    );

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
    ctx.fillStyle =
      monster.color;

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
      fx.monsterAttack > 0
        ? Math.sin(
            (
              1 -
              fx.monsterAttack /
              0.24
            ) *
            Math.PI
          )
        : 0;

    const shake =
      fx.monsterHit > 0
        ? Math.sin(
            fx.monsterHit *
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
        fx.time * 3.1
      ) * 3;

    drawAura(
      x,
      y + 15,

      monster.shadowColor ||
        "rgba(255,80,80,0.25)"
    );

    ctx.save();
    ctx.translate(x, y);

    if (fx.monsterHit > 0) {
      ctx.shadowColor =
        "#ffffff";

      ctx.shadowBlur = 28;
    }

    if (
      monster.shape ===
      "wolf"
    ) {
      drawWolf(monster);
    } else if (
      monster.shape ===
      "goblin"
    ) {
      drawGoblin(monster);
    } else {
      drawSlime(monster);
    }

    ctx.restore();
  }

  function updateEffects(
    deltaSeconds
  ) {
    const delta = Math.min(
      0.1,
      Math.max(
        0,
        Number(deltaSeconds) || 0
      )
    );

    fx.time += delta;

    [
      "playerAttack",
      "monsterAttack",
      "playerHit",
      "monsterHit",
      "flash",
      "deathFlash"
    ].forEach(
      function (key) {
        fx[key] = Math.max(
          0,
          fx[key] - delta
        );
      }
    );

    fx.texts =
      fx.texts.filter(
        function (item) {
          item.life -= delta;
          item.x += item.vx * delta;
          item.y += item.vy * delta;
          item.vy += 16 * delta;

          return item.life > 0;
        }
      );

    fx.particles =
      fx.particles.filter(
        function (item) {
          item.life -= delta;

          item.x +=
            item.vx * delta;

          item.y +=
            item.vy * delta;

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
    fx.particles.forEach(
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

    fx.texts.forEach(
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

    if (fx.flash > 0) {
      ctx.fillStyle =
        "rgba(126,229,255," +
        clamp01(
          fx.flash / 0.45
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

    if (fx.deathFlash > 0) {
      ctx.fillStyle =
        "rgba(170,20,32," +
        clamp01(
          fx.deathFlash /
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

  function renderCanvas(
    deltaSeconds
  ) {
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

  function update(
    deltaSeconds
  ) {
    if (!initialized) {
      return;
    }

    renderCanvas(
      deltaSeconds
    );

    renderPlayer();
    renderProgression();
    renderMonster();
    renderSettings();
  }

  function resetVisuals() {
    Object.assign(
      fx,
      {
        time: 0,
        playerAttack: 0,
        monsterAttack: 0,
        playerHit: 0,
        monsterHit: 0,
        flash: 0,
        deathFlash: 0,
        texts: [],
        particles: []
      }
    );

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

    function resize() {
      resizeCanvas();
    }

    global.addEventListener(
      "resize",
      resize
    );

    cleanups.push(
      function () {
        global.removeEventListener(
          "resize",
          resize
        );
      }
    );

    initialized = true;

    renderAll();
    renderCanvas(0);

    setSaveStatus(
      "자동 저장 중"
    );

    addBattleLog(
      "자동 사냥을 시작합니다.",
      "reward"
    );

    return true;
  }

  function destroy() {
    while (
      cleanups.length
    ) {
      try {
        cleanups.pop()();
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
    resizeCanvas: resizeCanvas,

    addBattleLog:
      addBattleLog,

    setSaveStatus:
      setSaveStatus,

    resetVisuals:
      resetVisuals,

    destroy: destroy
  };
})(window);
