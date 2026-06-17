(function (global) {
  "use strict";

  const REQUIRED = [
    "GameData",
    "GameState",
    "GameCombat",
    "GameLoot",
    "GameUI"
  ];

  REQUIRED.forEach(function (name) {
    if (!global[name]) {
      throw new Error(name + " is missing");
    }
  });

  const Data = global.GameData;
  const State = global.GameState;
  const Combat = global.GameCombat;
  const UI = global.GameUI;
  const CONFIG = Data.CONFIG;

  let lastFrame = 0;
  let autosaveTimer = 0;
  let started = false;
  let loopErrorCount = 0;

  function saveNow(force) {
    const saved = State.save(Boolean(force));
    if (saved) {
      UI.setSaveStatus("저장됨", "saved");
    } else {
      UI.setSaveStatus("저장 실패", "error");
    }
    return saved;
  }

  function update(deltaSeconds) {
    const state = State.getState();
    const speed = state.settings.speed || CONFIG.DEFAULT_SPEED;
    const scaledDelta = deltaSeconds * speed;
    Combat.update(scaledDelta);
    UI.update(deltaSeconds);
    State.addPlayTime(deltaSeconds);
    autosaveTimer += deltaSeconds * 1000;
    if (autosaveTimer >= CONFIG.AUTOSAVE_INTERVAL_MS) {
      autosaveTimer = 0;
      saveNow(false);
    }
  }

  function frame(timestamp) {
    if (!started) {
      return;
    }
    try {
      if (!lastFrame) {
        lastFrame = timestamp;
      }
      const rawDelta = Math.max(0, timestamp - lastFrame);
      lastFrame = timestamp;
      const deltaMs = Math.min(CONFIG.MAX_DELTA_MS, rawDelta);
      update(deltaMs / 1000);
      loopErrorCount = 0;
    } catch (error) {
      loopErrorCount += 1;
      console.error("Game loop error", error);
      UI.setSaveStatus("실행 오류", "error");
      if (loopErrorCount > 3) {
        started = false;
        saveNow(true);
        return;
      }
    }
    global.requestAnimationFrame(frame);
  }

  function handleVisibilityChange() {
    if (document.visibilityState === "hidden") {
      saveNow(true);
    } else {
      lastFrame = 0;
    }
  }

  function start() {
    if (started) {
      return;
    }
    try {
      State.load();
      Combat.initialize();
      UI.initialize();
      UI.setSaveStatus("자동 저장 준비");
      saveNow(false);
      started = true;
      lastFrame = 0;
      global.requestAnimationFrame(frame);
    } catch (error) {
      console.error("Game startup failed", error);
      const warning = document.createElement("div");
      warning.className = "startup-error";
      warning.textContent = "Abyss Hunter를 시작할 수 없습니다. " + (error && error.message ? error.message : "브라우저 콘솔을 확인하세요.");
      document.body.appendChild(warning);
    }
  }

  document.addEventListener("visibilitychange", handleVisibilityChange);
  global.addEventListener("pagehide", function () {
    saveNow(true);
  });
  global.addEventListener("beforeunload", function () {
    saveNow(true);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})(window);
  
