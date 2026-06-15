(function (global) {
  "use strict";

  const REQUIRED = [
    "GameData",
    "GameState",
    "GameCombat",
    "GameLoot",
    "GameUI"
  ];

  let running = false;
  let frameId = 0;
  let lastFrameTime = 0;
  let autosaveElapsed = 0;
  let lifecycleAttached = false;
  let fatalErrorShown = false;

  function verifyDependencies() {
    const missing =
      REQUIRED.filter(
        function (name) {
          return !global[name];
        }
      );

    if (missing.length) {
      throw new Error(
        "필수 게임 스크립트가 로드되지 않았습니다: " +
        missing.join(", ")
      );
    }
  }

  function showFatalError(error) {
    console.error(
      "게임 초기화 중 치명적인 오류가 발생했습니다.",
      error
    );

    if (fatalErrorShown) {
      return;
    }

    fatalErrorShown = true;

    const box =
      document.createElement("div");

    const title =
      document.createElement("strong");

    const guide =
      document.createElement("p");

    const detail =
      document.createElement("code");

    Object.assign(
      box.style,
      {
        position: "fixed",
        zIndex: "9999",
        left: "12px",
        right: "12px",
        bottom: "12px",
        maxWidth: "536px",
        margin: "0 auto",
        padding: "16px",

        border:
          "1px solid rgba(255,111,121,0.62)",

        borderRadius:
          "14px",

        color:
          "#ffecef",

        background:
          "#35151c",

        boxShadow:
          "0 16px 36px rgba(0,0,0,0.42)",

        fontFamily:
          "system-ui, sans-serif"
      }
    );

    title.textContent =
      "게임을 시작하지 못했습니다.";

    guide.textContent =
      "파일 이름과 index.html의 스크립트 로딩 순서를 확인한 뒤 새로고침하세요.";

    detail.textContent =
      error &&
      error.message
        ? error.message
        : String(error);

    guide.style.fontSize =
      "13px";

    guide.style.lineHeight =
      "1.5";

    detail.style.display =
      "block";

    detail.style.color =
      "#ffb8c0";

    detail.style.overflowWrap =
      "anywhere";

    box.appendChild(title);
    box.appendChild(guide);
    box.appendChild(detail);

    document.body.appendChild(box);
  }

  function saveGame(force) {
    if (!global.GameState) {
      return false;
    }

    return global.GameState.save(
      Boolean(force)
    );
  }

  function gameLoop(timestamp) {
    if (!running) {
      return;
    }

    if (
      !Number.isFinite(
        lastFrameTime
      ) ||
      lastFrameTime <= 0
    ) {
      lastFrameTime =
        timestamp;
    }

    const rawDeltaMs =
      Math.max(
        0,
        timestamp -
        lastFrameTime
      );

    const deltaMs =
      Math.min(
        global.GameData
          .CONFIG
          .MAX_DELTA_MS,

        rawDeltaMs
      );

    const deltaSeconds =
      deltaMs / 1000;

    lastFrameTime =
      timestamp;

    try {
      global.GameCombat.update(
        deltaSeconds
      );

      global.GameUI.update(
        deltaSeconds
      );

      autosaveElapsed +=
        rawDeltaMs;

      if (
        autosaveElapsed >=
        global.GameData
          .CONFIG
          .AUTOSAVE_INTERVAL_MS
      ) {
        autosaveElapsed = 0;
        saveGame(false);
      }
    } catch (error) {
      running = false;
      showFatalError(error);
      return;
    }

    frameId =
      global.requestAnimationFrame(
        gameLoop
      );
  }

  function handleVisibilityChange() {
    if (
      document.visibilityState ===
      "hidden"
    ) {
      saveGame(true);

      lastFrameTime = 0;
      autosaveElapsed = 0;
    } else {
      lastFrameTime =
        global.performance.now();
    }
  }

  function attachLifecycleEvents() {
    if (lifecycleAttached) {
      return;
    }

    lifecycleAttached = true;

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    global.addEventListener(
      "pagehide",
      function () {
        saveGame(true);
      }
    );

    global.addEventListener(
      "beforeunload",
      function () {
        saveGame(true);
      }
    );
  }

  function start() {
    if (running) {
      return;
    }

    try {
      verifyDependencies();

      global.GameState.load();
      global.GameUI.initialize();

      if (
        global.GameState
          .getLastError()
      ) {
        global.GameUI.addBattleLog(
          "손상된 저장 데이터를 기본 상태로 복구했습니다.",
          "warning"
        );
      }

      global.GameCombat.initialize();
      global.GameUI.renderAll();

      attachLifecycleEvents();

      running = true;

      lastFrameTime =
        global.performance.now();

      autosaveElapsed = 0;

      saveGame(true);

      frameId =
        global.requestAnimationFrame(
          gameLoop
        );
    } catch (error) {
      showFatalError(error);
    }
  }

  function stop() {
    if (!running) {
      return;
    }

    running = false;

    if (frameId) {
      global.cancelAnimationFrame(
        frameId
      );
    }

    frameId = 0;

    saveGame(true);
  }

  global.AbyssHunterApp = {
    start: start,
    stop: stop,
    save: saveGame
  };

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      start,
      {
        once: true
      }
    );
  } else {
    start();
  }
})(window);
