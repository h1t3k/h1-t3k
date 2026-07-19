(function () {
  "use strict";

  const html = document.documentElement;
  const manifest = window.H1_ROUTES;
  const now = Date.now();
  const localStore = availableStorage("localStorage");
  const sessionStore = availableStorage("sessionStorage");
  let replay = false;
  let reduced = false;
  let transitionMatched = false;
  let transitionRoute = "";
  let storedVersion = null;
  let lastAt = null;
  let storageMode = "memory";

  function availableStorage(name) {
    try {
      return window[name];
    } catch (error) {
      return null;
    }
  }

  function read(storage, key) {
    if (!storage) return null;
    try {
      const value = storage.getItem(key);
      storageMode = storage === localStore ? "local" : "session";
      return value;
    } catch (error) {
      return null;
    }
  }

  function write(storage, key, value) {
    if (!storage) return false;
    try {
      storage.setItem(key, String(value));
      storageMode = storage === localStore ? "local" : "session";
      return true;
    } catch (error) {
      return false;
    }
  }

  function remove(storage, key) {
    if (!storage) return false;
    try {
      storage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  function readBootRecord() {
    storedVersion = read(localStore, manifest.bootVersionKey);
    lastAt = read(localStore, manifest.bootLastAtKey);
    if (storedVersion !== null && lastAt !== null) return;

    storedVersion = read(sessionStore, manifest.bootVersionKey);
    lastAt = read(sessionStore, manifest.bootLastAtKey);
    if (storedVersion !== null && lastAt !== null) return;

    const memory = window.__H1_BOOT_MEMORY__ || {};
    storedVersion = memory.version || null;
    lastAt = memory.lastAt || null;
  }

  function consumeTransition(route) {
    let raw = read(sessionStore, manifest.transitionKey);
    remove(sessionStore, manifest.transitionKey);

    if (!raw && window.name.indexOf("h1-transition:") === 0) {
      raw = window.name.slice("h1-transition:".length);
      window.name = "";
    }
    if (!raw || !route) return false;

    try {
      const token = JSON.parse(raw);
      transitionRoute = String(token.route || "");
      return transitionRoute === route.id && Number(token.expiresAt) >= now;
    } catch (error) {
      return false;
    }
  }

  function cleanReplayParameter() {
    try {
      const url = new URL(window.location.href);
      replay = url.searchParams.get(manifest.replayParameter) === manifest.replayValue;
      if (!replay) return;
      url.searchParams.delete(manifest.replayParameter);
      history.replaceState(
        history.state,
        "",
        url.pathname + (url.search ? url.search : "") + url.hash
      );
    } catch (error) {
      replay = false;
    }
  }

  function commitCompletion(timestamp) {
    const value = Number(timestamp) || Date.now();
    const localVersion = write(localStore, manifest.bootVersionKey, manifest.bootVersion);
    const localTime = write(localStore, manifest.bootLastAtKey, value);
    if (localVersion && localTime) return "local";

    const sessionVersion = write(sessionStore, manifest.bootVersionKey, manifest.bootVersion);
    const sessionTime = write(sessionStore, manifest.bootLastAtKey, value);
    if (sessionVersion && sessionTime) return "session";

    window.__H1_BOOT_MEMORY__ = {
      version: manifest.bootVersion,
      lastAt: value
    };
    storageMode = "memory";
    return storageMode;
  }

  function revealFailedSafe() {
    if (!html.classList.contains("booting") &&
        !html.classList.contains("booting-rm")) return;
    html.classList.remove("booting", "booting-rm");
    html.classList.add("boot-done");
    state.state = "FAILED_SAFE";
    window.dispatchEvent(new CustomEvent("h1t3k:boot", {
      detail: {
        name: "boot_failed_safe",
        route: state.route ? state.route.id : "unknown"
      }
    }));
    window.setTimeout(function () {
      const main = document.getElementById("main-content");
      if (main) main.focus({ preventScroll: true });
    }, 0);
  }

  if (!manifest) {
    html.classList.add("boot-done");
    return;
  }

  const route = manifest.routeForUrl(window.location.href);
  cleanReplayParameter();
  transitionMatched = consumeTransition(route);
  readBootRecord();

  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (error) {
    reduced = false;
  }

  const decision = manifest.eligibility({
    now: now,
    lastAt: lastAt,
    storedVersion: storedVersion,
    version: manifest.bootVersion,
    ttl: manifest.bootTtl,
    replay: replay,
    transitionMatched: transitionMatched
  });

  const state = {
    state: decision.eligible ? "ELIGIBLE" : "INELIGIBLE",
    reason: decision.reason,
    route: route,
    replay: replay,
    reduced: reduced,
    storageMode: storageMode,
    startedAt: performance.now(),
    transitionMatched: transitionMatched,
    transitionRoute: transitionRoute,
    commitCompletion: commitCompletion
  };

  window.__H1_BOOT__ = state;
  if (decision.eligible) {
    html.classList.add(reduced ? "booting-rm" : "booting");
    window.dispatchEvent(new CustomEvent("h1t3k:boot", {
      detail: {
        name: "boot_eligible",
        reason: decision.reason,
        route: route ? route.id : "unknown"
      }
    }));
  } else {
    html.classList.add("boot-done");
    if (transitionMatched) html.classList.add("transition-arrival");
  }

  window.__H1_BOOT_WATCHDOG__ = window.setTimeout(revealFailedSafe, 2800);
})();
