(function () {
  "use strict";

  const html = document.documentElement;
  const manifest = window.H1_ROUTES;
  const bootState = window.__H1_BOOT__;
  const boot = document.getElementById("boot");
  const log = document.getElementById("bootLog");
  const stage = document.getElementById("monoStage");
  const mono = document.getElementById("monogram");
  const sweep = document.getElementById("sweep");
  const skip = document.getElementById("bootSkip");
  const routeName = document.getElementById("bootRouteName");
  const main = document.getElementById("main-content");

  const FULL_FAIL_SAFE = 2800;
  const COMPACT_DURATION = 860;
  const COMPACT_REDUCED_DURATION = 80;
  const fullTimers = [];
  let fullFinished = false;
  let compactTimer = 0;
  let compactNavigate = null;
  let compactContinue = null;
  let compactRowTimers = [];

  function emit(name, detail) {
    window.dispatchEvent(new CustomEvent("h1t3k:boot", {
      detail: Object.assign({ name: name }, detail || {})
    }));
  }

  function requiredNodesPresent() {
    return [boot, log, stage, mono, sweep, skip, routeName].every(Boolean);
  }

  function clearStage() {
    if (!requiredNodesPresent()) return;
    log.replaceChildren();
    log.classList.remove("wipe");
    stage.classList.remove("on");
    mono.classList.remove("w1", "w2", "w3", "glow");
    sweep.classList.remove("run");
    routeName.textContent = "";
    boot.classList.remove("exit", "is-compact", "is-static");
  }

  function row(text, options) {
    const element = document.createElement("div");
    element.className = "bl" + (options && options.heading ? " bl-head" : "");

    const label = document.createElement("span");
    label.textContent = text;
    element.appendChild(label);

    let ok = null;
    if (options && options.ok) {
      ok = document.createElement("span");
      ok.className = "ok";
      ok.textContent = "ok";
      element.appendChild(ok);
    }
    log.appendChild(element);
    return { element: element, ok: ok };
  }

  function finishFull(state, eventName) {
    if (fullFinished) return;
    fullFinished = true;
    fullTimers.forEach(window.clearTimeout);
    window.clearTimeout(window.__H1_BOOT_WATCHDOG__);
    skip.removeEventListener("click", skipFull);
    boot.removeEventListener("keydown", onFullKeydown);

    if (state === "COMPLETE" && typeof bootState.commitCompletion === "function") {
      bootState.storageMode = bootState.commitCompletion(Date.now());
    }

    bootState.state = state;
    emit(eventName, {
      route: bootState.route ? bootState.route.id : "unknown",
      duration: Math.round(performance.now() - bootState.startedAt)
    });

    boot.classList.add("exit");
    html.classList.remove("booting", "booting-rm");
    html.classList.add("boot-done", "did-boot");
    window.setTimeout(function () {
      boot.classList.remove("exit");
      if (main) main.focus({ preventScroll: true });
    }, 200);
  }

  function skipFull() {
    finishFull("SKIPPED", "boot_skipped");
  }

  function onFullKeydown(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    skipFull();
  }

  function scheduleFull() {
    const config = {
      cursorHold: 380,
      gaps: [150, 130, 112, 96, 84, 74],
      okDelay: 70,
      loginHold: 300,
      wipe: 120,
      warmSteps: [80, 80, 80],
      glowDelay: 60,
      sweepDuration: 400,
      hold: 260
    };
    const route = bootState.route || manifest.routes[0];
    const lines = [
      { text: "$ " + manifest.globalLine, heading: true },
      { text: "$ route ........ " + route.name.toLowerCase(), ok: true }
    ].concat(route.details.slice(0, 4).map(function (detail) {
      return { text: "$ " + detail, ok: true };
    }));

    clearStage();
    routeName.textContent = route.name;
    skip.textContent = "Skip presentation";
    skip.addEventListener("click", skipFull);
    boot.addEventListener("keydown", onFullKeydown);
    skip.focus({ preventScroll: true });
    bootState.state = "RUNNING";
    emit("boot_started", {
      route: route.id,
      reason: bootState.reason,
      reduced: bootState.reduced
    });

    if (document.fonts && document.fonts.load) {
      document.fonts.load("1em Monogram").then(function (faces) {
        if (faces && faces.length && mono.firstChild) {
          mono.firstChild.nodeValue = "\u00F8";
        }
      }).catch(function () {
        /* The visible ht fallback remains. */
      });
    }

    if (bootState.reduced) {
      boot.classList.add("is-static");
      lines.forEach(function (line) {
        const item = row(line.text, line);
        item.element.classList.add("on");
        if (item.ok) item.ok.classList.add("on");
      });
      mono.classList.add("w3", "glow");
      stage.classList.add("on");
      fullTimers.push(window.setTimeout(function () {
        finishFull("COMPLETE", "boot_completed");
      }, 140));
      return;
    }

    let elapsed = config.cursorHold;
    const cursorLine = document.createElement("div");
    cursorLine.className = "bl on";
    cursorLine.innerHTML = "<span>$ boot<span class=\"cursor\"></span></span>";
    log.appendChild(cursorLine);

    lines.forEach(function (line, index) {
      elapsed += config.gaps[index] || 60;
      const item = row(line.text, line);
      const rowTime = elapsed;
      fullTimers.push(window.setTimeout(function () {
        cursorLine.remove();
        item.element.classList.add("on");
      }, rowTime));
      if (item.ok) {
        fullTimers.push(window.setTimeout(function () {
          item.ok.classList.add("on");
        }, rowTime + config.okDelay));
      }
    });

    elapsed += 70;
    const login = row("$ login ........ ht", { ok: false });
    fullTimers.push(window.setTimeout(function () {
      login.element.classList.add("on");
    }, elapsed));
    elapsed += config.loginHold;

    fullTimers.push(window.setTimeout(function () {
      log.classList.add("wipe");
    }, elapsed));
    elapsed += config.wipe;
    fullTimers.push(window.setTimeout(function () {
      stage.classList.add("on");
    }, elapsed));
    elapsed += config.warmSteps[0];
    fullTimers.push(window.setTimeout(function () {
      mono.classList.add("w1");
    }, elapsed));
    elapsed += config.warmSteps[1];
    fullTimers.push(window.setTimeout(function () {
      mono.classList.add("w2");
    }, elapsed));
    elapsed += config.warmSteps[2];
    fullTimers.push(window.setTimeout(function () {
      mono.classList.add("w3");
    }, elapsed));
    elapsed += config.glowDelay;
    fullTimers.push(window.setTimeout(function () {
      mono.classList.add("glow");
      sweep.classList.add("run");
    }, elapsed));
    elapsed += config.sweepDuration + config.hold;

    const finishAt = Math.min(elapsed, FULL_FAIL_SAFE - 220);
    fullTimers.push(window.setTimeout(function () {
      finishFull("COMPLETE", "boot_completed");
    }, finishAt));
  }

  function showCompact(route, navigate, reduced) {
    if (typeof navigate !== "function") return;
    if (!requiredNodesPresent() || !route) {
      navigate();
      return;
    }

    window.clearTimeout(compactTimer);
    compactRowTimers.forEach(window.clearTimeout);
    compactRowTimers = [];
    if (compactContinue) skip.removeEventListener("click", compactContinue);
    compactNavigate = navigate;
    clearStage();
    boot.classList.add("is-compact");
    if (reduced) boot.classList.add("is-static");
    routeName.textContent = route.name;
    skip.textContent = "Continue now";
    html.classList.add("transitioning");
    boot.setAttribute("aria-label", "Opening " + route.name);
    skip.focus({ preventScroll: true });

    const lines = [
      "$ route ........ " + route.name.toLowerCase()
    ].concat(route.details.slice(0, 3).map(function (detail) {
      return "$ " + detail;
    }));

    lines.forEach(function (text, index) {
      const item = row(text, { heading: index === 0, ok: index > 0 });
      if (reduced) {
        item.element.classList.add("on");
        if (item.ok) item.ok.classList.add("on");
        return;
      }
      compactRowTimers.push(window.setTimeout(function () {
        item.element.classList.add("on");
        if (item.ok) item.ok.classList.add("on");
      }, 80 + index * 145));
    });

    function continueNow() {
      if (!compactNavigate) return;
      const next = compactNavigate;
      compactNavigate = null;
      window.clearTimeout(compactTimer);
      compactRowTimers.forEach(window.clearTimeout);
      compactRowTimers = [];
      skip.removeEventListener("click", continueNow);
      compactContinue = null;
      emit("compact_transition_completed", {
        route: route.id,
        reduced: reduced
      });
      next();
    }

    compactContinue = continueNow;
    skip.addEventListener("click", continueNow);
    emit("compact_transition_started", {
      route: route.id,
      reduced: reduced
    });
    compactTimer = window.setTimeout(
      continueNow,
      reduced ? COMPACT_REDUCED_DURATION : COMPACT_DURATION
    );
  }

  function resetAfterPageShow() {
    window.clearTimeout(compactTimer);
    compactRowTimers.forEach(window.clearTimeout);
    compactRowTimers = [];
    compactNavigate = null;
    if (compactContinue && skip) skip.removeEventListener("click", compactContinue);
    compactContinue = null;
    html.classList.remove("transitioning");
    if (boot) {
      boot.classList.remove("exit", "is-compact", "is-static");
      boot.setAttribute("aria-label", "H1-T3K presentation");
    }
  }

  window.H1Presentation = Object.freeze({
    compactDuration: COMPACT_DURATION,
    playCompact: showCompact,
    resetAfterPageShow: resetAfterPageShow
  });

  if (!bootState || bootState.state !== "ELIGIBLE") {
    window.clearTimeout(window.__H1_BOOT_WATCHDOG__);
    return;
  }

  if (!requiredNodesPresent() || !manifest || !bootState.route) {
    window.clearTimeout(window.__H1_BOOT_WATCHDOG__);
    html.classList.remove("booting", "booting-rm");
    html.classList.add("boot-done");
    bootState.state = "FAILED_SAFE";
    emit("boot_failed_safe", {
      route: bootState.route ? bootState.route.id : "unknown"
    });
    return;
  }

  scheduleFull();
})();
