/*
  Redirect-qualified homepage introduction.
  Eligibility is decided synchronously in index.html before CSS loads.
  This file executes only the ELIGIBLE -> RUNNING -> terminal state path.
*/
(function () {
  "use strict";

  const html = document.documentElement;
  const bootState = window.__H1_BOOT__;
  if (!bootState || bootState.state !== "ELIGIBLE") return;

  const boot = document.getElementById("boot");
  const log = document.getElementById("bootLog");
  const stage = document.getElementById("monoStage");
  const mono = document.getElementById("monogram");
  const sweep = document.getElementById("sweep");
  const skip = document.getElementById("bootSkip");
  const main = document.getElementById("main-content");

  const required = [boot, log, stage, mono, sweep, skip];
  if (required.some((node) => !node)) {
    html.classList.remove("booting", "booting-rm");
    html.classList.add("boot-done");
    bootState.state = "FAILED_SAFE";
    window.clearTimeout(window.__H1_BOOT_WATCHDOG__);
    window.dispatchEvent(new CustomEvent("h1t3k:boot", {
      detail: { name: "boot_failed_safe" }
    }));
    return;
  }

  const config = {
    monogram: "\u00F8",
    cursorHold: 180,
    gaps: [120, 110, 100, 90, 80, 70, 60],
    okDelay: 50,
    loginHold: 180,
    wipe: 100,
    warmSteps: [70, 70, 70],
    glowDelay: 50,
    sweepDuration: 320,
    hold: 180,
    exitFade: 220,
    lines: [
      { text: "ht/os — verified entry", heading: true },
      { text: "palette ......... grass/sands", ok: true },
      { text: "type ....... din2014/basenine", ok: true },
      { text: "mount /projects .............", ok: true },
      { text: "mount /field-notes ..........", ok: true },
      { text: "mount /design-archive .......", ok: true },
      { text: "link /contact ...............", ok: true }
    ]
  };

  const timers = [];
  let finished = false;

  function emit(state, name) {
    bootState.state = state;
    window.dispatchEvent(new CustomEvent("h1t3k:boot", {
      detail: { name }
    }));
  }

  function at(delay, task) {
    timers.push(window.setTimeout(task, delay));
  }

  function finish(state, eventName) {
    if (finished) return;
    finished = true;
    timers.forEach(window.clearTimeout);
    window.clearTimeout(window.__H1_BOOT_WATCHDOG__);
    window.removeEventListener("keydown", onKeydown);
    skip.removeEventListener("click", onSkip);

    try {
      sessionStorage.setItem(bootState.key, "1");
    } catch (error) {
      /* Storage is optional; the redirect marker has already been removed. */
    }

    emit(state, eventName);
    boot.classList.add("exit");
    html.classList.remove("booting", "booting-rm");
    html.classList.add("boot-done", "did-boot");

    window.setTimeout(function () {
      boot.remove();
      if (state === "SKIPPED" && main) main.focus({ preventScroll: true });
    }, config.exitFade + 20);
  }

  function onSkip() {
    finish("SKIPPED", "boot_skipped");
  }

  function onKeydown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    finish("SKIPPED", "boot_skipped");
  }

  skip.addEventListener("click", onSkip);
  window.addEventListener("keydown", onKeydown);
  skip.focus({ preventScroll: true });
  emit("RUNNING", "boot_started");

  if (document.fonts && document.fonts.load) {
    document.fonts.load("1em Monogram").then(function (faces) {
      if (faces && faces.length && mono.firstChild) {
        mono.firstChild.nodeValue = config.monogram;
      }
    }).catch(function () {
      /* The visible ht fallback remains. */
    });
  }

  if (bootState.reduced) {
    mono.classList.add("w3", "glow");
    stage.classList.add("on");
    at(420, function () { finish("COMPLETE", "boot_completed"); });
    return;
  }

  let elapsed = config.cursorHold;
  const cursorLine = document.createElement("div");
  cursorLine.className = "bl on";
  cursorLine.innerHTML = "<span><span class=\"cursor\"></span></span>";
  log.appendChild(cursorLine);

  config.lines.forEach(function (line, index) {
    elapsed += config.gaps[index] || 60;
    const row = document.createElement("div");
    row.className = "bl" + (line.heading ? " bl-head" : "");

    const text = document.createElement("span");
    text.textContent = line.text;
    row.appendChild(text);

    let ok = null;
    if (line.ok) {
      ok = document.createElement("span");
      ok.className = "ok";
      ok.textContent = "ok";
      row.appendChild(ok);
    }

    log.appendChild(row);
    const rowTime = elapsed;
    at(rowTime, function () {
      cursorLine.remove();
      row.classList.add("on");
    });
    if (ok) {
      at(rowTime + config.okDelay, function () { ok.classList.add("on"); });
    }
  });

  elapsed += 70;
  const login = document.createElement("div");
  login.className = "bl";
  login.innerHTML = "<span>login: ht<span class=\"cursor\"></span></span>";
  log.appendChild(login);
  at(elapsed, function () { login.classList.add("on"); });
  elapsed += config.loginHold;

  at(elapsed, function () { log.classList.add("wipe"); });
  elapsed += config.wipe;
  at(elapsed, function () { stage.classList.add("on"); });
  elapsed += config.warmSteps[0];
  at(elapsed, function () { mono.classList.add("w1"); });
  elapsed += config.warmSteps[1];
  at(elapsed, function () { mono.classList.add("w2"); });
  elapsed += config.warmSteps[2];
  at(elapsed, function () { mono.classList.add("w3"); });
  elapsed += config.glowDelay;
  at(elapsed, function () {
    mono.classList.add("glow");
    sweep.classList.add("run");
  });
  elapsed += config.sweepDuration + config.hold;
  at(elapsed, function () { finish("COMPLETE", "boot_completed"); });
})();
